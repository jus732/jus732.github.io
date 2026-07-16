/**
 * Data-driven enemy archetypes and per-wave spawn tables. Each archetype
 * is stats + a behavior(e, world, dt) that steers velocity; the engine
 * integrates, clamps to bounds, and handles collisions/deaths. Behaviors
 * draw randomness only from world.rand() or the per-enemy seed so runs
 * stay deterministic.
 */

import type { Enemy, World } from "./engine";

export type EnemyTypeId =
  | "wanderer"
  | "seeker"
  | "weaver"
  | "spinner"
  | "splitter"
  | "shard"
  | "snakeHead"
  | "snakeBody"
  | "boss";

export type EnemyArchetype = {
  id: EnemyTypeId;
  radius: number;
  hp: number;
  speed: number;
  score: number;
  /** Geoms dropped on death. */
  geoms: number;
  color: string;
  behavior: (e: Enemy, world: World, dt: number) => void;
  onSpawn?: (e: Enemy, world: World) => void;
  onDeath?: (e: Enemy, world: World) => void;
};

const TAU = Math.PI * 2;
const SNAKE_LENGTH = 8;
const SNAKE_SPACING = 15;

/** Reflect velocity off the arena walls (engine clamps position). */
function bounce(e: Enemy, world: World) {
  if ((e.x <= e.radius + 0.5 && e.vx < 0) || (e.x >= world.w - e.radius - 0.5 && e.vx > 0)) {
    e.vx = -e.vx;
  }
  if ((e.y <= e.radius + 0.5 && e.vy < 0) || (e.y >= world.h - e.radius - 0.5 && e.vy > 0)) {
    e.vy = -e.vy;
  }
}

/** Smoothly steer velocity toward the player at the archetype's speed. */
function seekPlayer(e: Enemy, world: World, dt: number, agility: number, weave = 0) {
  const dx = world.playerX - e.x;
  const dy = world.playerY - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  let dirX = dx / dist;
  let dirY = dy / dist;
  if (weave !== 0) {
    const swing = Math.sin(e.age * 4.2 + e.seed * TAU) * weave;
    const cos = Math.cos(swing);
    const sin = Math.sin(swing);
    const wx = dirX * cos - dirY * sin;
    const wy = dirX * sin + dirY * cos;
    dirX = wx;
    dirY = wy;
  }
  const blend = Math.min(1, agility * dt);
  e.vx += (dirX * e.speed - e.vx) * blend;
  e.vy += (dirY * e.speed - e.vy) * blend;
}

export const ARCHETYPES: Record<EnemyTypeId, EnemyArchetype> = {
  wanderer: {
    id: "wanderer",
    radius: 11,
    hp: 1,
    speed: 90,
    score: 25,
    geoms: 1,
    color: "#b06cff",
    behavior(e, world, dt) {
      if (e.vx === 0 && e.vy === 0) {
        const a = e.seed * TAU;
        e.vx = Math.cos(a) * e.speed;
        e.vy = Math.sin(a) * e.speed;
      }
      // Slow random turn keeps paths meandering but smooth.
      const turn = (world.rand() - 0.5) * 3.4 * dt;
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      const vx = e.vx * cos - e.vy * sin;
      e.vy = e.vx * sin + e.vy * cos;
      e.vx = vx;
      bounce(e, world);
      e.spin += 1.6 * dt;
    },
  },
  seeker: {
    id: "seeker",
    radius: 10,
    hp: 1,
    speed: 150,
    score: 50,
    geoms: 2,
    color: "#ffb84d",
    behavior(e, world, dt) {
      seekPlayer(e, world, dt, 3.5);
      e.spin = Math.atan2(e.vy, e.vx);
    },
  },
  weaver: {
    id: "weaver",
    radius: 10,
    hp: 2,
    speed: 175,
    score: 75,
    geoms: 2,
    color: "#4dff9e",
    behavior(e, world, dt) {
      seekPlayer(e, world, dt, 5, 0.9);
      e.spin += 4 * dt;
    },
  },
  spinner: {
    id: "spinner",
    radius: 13,
    hp: 3,
    speed: 205,
    score: 100,
    geoms: 3,
    color: "#ff4d88",
    behavior(e, world, dt) {
      if (e.vx === 0 && e.vy === 0) {
        const a = e.seed * TAU;
        e.vx = Math.cos(a) * e.speed;
        e.vy = Math.sin(a) * e.speed;
      }
      bounce(e, world);
      e.spin += 7 * dt;
    },
  },
  splitter: {
    id: "splitter",
    radius: 16,
    hp: 5,
    speed: 70,
    score: 120,
    geoms: 3,
    color: "#4dc3ff",
    behavior(e, world, dt) {
      seekPlayer(e, world, dt, 2.2);
      e.spin += 1.2 * dt;
    },
    onDeath(e, world) {
      for (let i = 0; i < 3; i++) {
        world.spawnChild(
          "shard",
          e.x + (world.rand() - 0.5) * 24,
          e.y + (world.rand() - 0.5) * 24
        );
      }
    },
  },
  shard: {
    id: "shard",
    radius: 6,
    hp: 1,
    speed: 235,
    score: 30,
    geoms: 1,
    color: "#8be0ff",
    behavior(e, world, dt) {
      seekPlayer(e, world, dt, 4.5);
      e.spin = Math.atan2(e.vy, e.vx);
    },
  },
  snakeHead: {
    id: "snakeHead",
    radius: 11,
    hp: 6,
    speed: 215,
    score: 250,
    geoms: 6,
    color: "#ffe14d",
    behavior(e, world, dt) {
      seekPlayer(e, world, dt, 4, 1.1);
      e.spin = Math.atan2(e.vy, e.vx);
    },
    onSpawn(e, world) {
      let leader = e;
      for (let i = 0; i < SNAKE_LENGTH; i++) {
        const seg = world.spawnChild("snakeBody", e.x, e.y);
        if (!seg) break;
        seg.link = leader.id;
        leader = seg;
      }
    },
  },
  snakeBody: {
    id: "snakeBody",
    radius: 9,
    hp: 3,
    speed: 260,
    score: 40,
    geoms: 1,
    color: "#ffd21f",
    behavior(e, world, dt) {
      const lead = world.byId(e.link);
      if (!lead || lead.hp <= 0) {
        // Leader is gone: the chain unzips into a cascade of kills.
        e.hp = 0;
        return;
      }
      const dx = lead.x - e.x;
      const dy = lead.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > SNAKE_SPACING) {
        const pull = Math.min(e.speed, (dist - SNAKE_SPACING) * 16);
        e.vx = (dx / dist) * pull;
        e.vy = (dy / dist) * pull;
      } else {
        e.vx *= Math.exp(-8 * dt);
        e.vy *= Math.exp(-8 * dt);
      }
      e.spin = Math.atan2(dy, dx);
    },
  },
  boss: {
    id: "boss",
    radius: 42,
    hp: 90,
    speed: 55,
    score: 1000,
    geoms: 30,
    color: "#ff3b3b",
    behavior(e, world, dt) {
      // Enrages as it takes damage.
      const rage = 1 + (1 - e.hp / e.maxHp) * 0.8;
      const base = e.speed;
      e.speed = base * rage;
      seekPlayer(e, world, dt, 2);
      e.speed = base;
      e.spin += (0.8 + rage) * dt;
      e.timer -= dt;
      if (e.timer <= 0) {
        e.timer = 2.8;
        if (e.age > 1.5) {
          for (let i = 0; i < 2; i++) {
            const a = world.rand() * TAU;
            world.spawnChild(
              "shard",
              e.x + Math.cos(a) * (e.radius + 12),
              e.y + Math.sin(a) * (e.radius + 12)
            );
          }
        }
      }
    },
  },
};

/* ----- Spawn tables ----- */

/** First wave each archetype can appear on. */
const INTRO: Partial<Record<EnemyTypeId, number>> = {
  wanderer: 1,
  seeker: 2,
  weaver: 3,
  spinner: 4,
  splitter: 6,
  snakeHead: 7,
};

/** Budget cost per spawn; a wave spends 10 + wave * 5 points. */
const COST: Partial<Record<EnemyTypeId, number>> = {
  wanderer: 1,
  seeker: 2,
  weaver: 2,
  spinner: 3,
  splitter: 4,
  snakeHead: 6,
};

/** How many arrive together when this type is picked. */
const CLUSTER: Partial<Record<EnemyTypeId, number>> = {
  wanderer: 4,
  seeker: 3,
  weaver: 2,
  spinner: 2,
  splitter: 1,
  snakeHead: 1,
};

/**
 * Build the timed spawn list for a wave: escalating budget, new
 * archetypes introduced over time, clusters arriving in pulses that
 * tighten on later waves. Boss waves (every 5th) swap the budget for
 * bosses plus a light escort trickle.
 */
export function spawnPlanForWave(
  wave: number,
  rand: () => number
): { type: EnemyTypeId; at: number }[] {
  const plan: { type: EnemyTypeId; at: number }[] = [];
  let t = 1.2;

  if (wave % 5 === 0) {
    const bosses = 1 + Math.floor(wave / 15);
    for (let i = 0; i < bosses; i++) {
      plan.push({ type: "boss", at: t + i * 2.5 });
    }
    const escorts = Math.min(24, wave);
    for (let i = 0; i < escorts; i++) {
      t += 0.9 + rand() * 1.4;
      plan.push({ type: i % 3 === 0 ? "seeker" : "wanderer", at: t });
    }
    return plan.sort((a, b) => a.at - b.at);
  }

  const available = (Object.keys(INTRO) as EnemyTypeId[]).filter(
    (type) => wave >= (INTRO[type] ?? Infinity)
  );
  const pace = Math.max(0.4, 1 - wave * 0.025);
  let budget = 10 + wave * 5;

  while (budget > 0) {
    // Weight recent introductions slightly so new threats show up.
    let total = 0;
    for (const type of available) total += 1 + (INTRO[type] ?? 1) * 0.25;
    let roll = rand() * total;
    let type: EnemyTypeId = available[0];
    for (const candidate of available) {
      roll -= 1 + (INTRO[candidate] ?? 1) * 0.25;
      if (roll <= 0) {
        type = candidate;
        break;
      }
    }
    const cluster = Math.max(
      1,
      Math.min(CLUSTER[type] ?? 1, Math.ceil((CLUSTER[type] ?? 1) * (0.6 + rand() * 0.8)))
    );
    for (let i = 0; i < cluster; i++) {
      plan.push({ type, at: t + i * 0.14 });
      budget -= COST[type] ?? 1;
      if (budget <= 0) break;
    }
    t += (0.7 + rand() * 1.3) * pace;
  }

  return plan.sort((a, b) => a.at - b.at);
}
