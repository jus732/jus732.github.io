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
  | "boss"
  | "charger"
  | "flock"
  | "dodger"
  | "orbiter"
  | "warden";

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
    hp: 120,
    speed: 58,
    score: 1000,
    geoms: 30,
    color: "#ff3b3b",
    behavior(e, world, dt) {
      // Enrages as it takes damage.
      const rage = 1 + (1 - e.hp / e.maxHp);
      const base = e.speed;
      e.speed = base * rage;
      seekPlayer(e, world, dt, 2);
      e.speed = base;
      e.spin += (0.8 + rage) * dt;
      e.timer -= dt;
      if (e.timer <= 0) {
        e.timer = 2.4;
        if (e.age > 1.5) {
          for (let i = 0; i < 3; i++) {
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
  charger: {
    id: "charger",
    radius: 12,
    hp: 4,
    speed: 100,
    score: 110,
    geoms: 3,
    color: "#ff784d",
    behavior(e, world, dt) {
      // e.link doubles as a phase flag: 0 = approach/wind-up, 1 = dashing.
      if (e.link === -1) e.link = 0;
      if (e.link === 0) {
        seekPlayer(e, world, dt, 1.6);
        e.spin = Math.atan2(world.playerY - e.y, world.playerX - e.x);
        e.timer -= dt;
        if (e.timer <= 0) {
          const dx = world.playerX - e.x;
          const dy = world.playerY - e.y;
          const d = Math.hypot(dx, dy) || 1;
          e.vx = (dx / d) * e.speed * 4.5;
          e.vy = (dy / d) * e.speed * 4.5;
          e.link = 1;
          e.timer = 0.5; // dash duration
        }
      } else {
        e.timer -= dt;
        e.vx *= Math.exp(-0.4 * dt);
        e.vy *= Math.exp(-0.4 * dt);
        if (e.timer <= 0) {
          e.link = 0;
          e.timer = 1.1 + world.rand() * 0.6; // wind-up before next dash
        }
        e.spin = Math.atan2(e.vy, e.vx);
      }
    },
    onSpawn(e) {
      e.timer = 1.0;
    },
  },
  flock: {
    id: "flock",
    radius: 5,
    hp: 1,
    speed: 165,
    score: 15,
    geoms: 1,
    color: "#7d8cff",
    behavior(e, world, dt) {
      // Murmuration feel without a neighbor scan: seek the player, but
      // add a per-member swirling offset so the cloud roils as it flows.
      const swirl = Math.sin(e.age * 3 + e.seed * 6.28) * 0.6;
      seekPlayer(e, world, dt, 3.2, swirl);
      e.spin = Math.atan2(e.vy, e.vx);
    },
  },
  dodger: {
    id: "dodger",
    radius: 10,
    hp: 2,
    speed: 190,
    score: 90,
    geoms: 2,
    color: "#4dffd6",
    behavior(e, world, dt) {
      seekPlayer(e, world, dt, 2.6);
      // If a bullet is bearing down, juke perpendicular to its path.
      const threat = world.bulletThreat(e.x, e.y, 70);
      if (threat) {
        const m = Math.hypot(threat.vx, threat.vy) || 1;
        const px = -threat.vy / m;
        const py = threat.vx / m;
        const side = e.seed - 0.5 < 0 ? -1 : 1;
        e.vx += px * side * e.speed * 3 * dt;
        e.vy += py * side * e.speed * 3 * dt;
      }
      e.spin += 3 * dt;
    },
  },
  orbiter: {
    id: "orbiter",
    radius: 9,
    hp: 3,
    speed: 175,
    score: 95,
    geoms: 2,
    color: "#c98bff",
    behavior(e, world, dt) {
      const dx = e.x - world.playerX;
      const dy = e.y - world.playerY;
      const dist = Math.hypot(dx, dy) || 1;
      // Desired orbit radius shrinks over time so it spirals inward.
      const want = Math.max(60, 260 - e.age * 22);
      const radial = dist - want; // >0 too far, <0 too close
      const tx = -dy / dist;
      const ty = dx / dist;
      const inward = -dx / dist;
      const iny = -dy / dist;
      const tgtX = tx * e.speed + inward * radial * 2;
      const tgtY = ty * e.speed + iny * radial * 2;
      const blend = Math.min(1, 3 * dt);
      e.vx += (tgtX - e.vx) * blend;
      e.vy += (tgtY - e.vy) * blend;
      e.spin += 5 * dt;
    },
  },
  warden: {
    id: "warden",
    radius: 20,
    hp: 22,
    speed: 42,
    score: 300,
    geoms: 6,
    color: "#6bd6a0",
    behavior(e, world, dt) {
      seekPlayer(e, world, dt, 1.2);
      e.spin += 0.6 * dt;
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
  charger: 5,
  splitter: 6,
  snakeHead: 7,
  flock: 8,
  dodger: 10,
  orbiter: 12,
  warden: 13,
};

/** Budget cost per spawn; a wave spends 10 + wave * 5 points. */
const COST: Partial<Record<EnemyTypeId, number>> = {
  wanderer: 1,
  seeker: 2,
  weaver: 2,
  spinner: 3,
  charger: 3,
  splitter: 4,
  snakeHead: 6,
  flock: 1,
  dodger: 3,
  orbiter: 3,
  warden: 5,
};

/** How many arrive together when this type is picked. */
const CLUSTER: Partial<Record<EnemyTypeId, number>> = {
  wanderer: 4,
  seeker: 3,
  weaver: 2,
  spinner: 2,
  charger: 2,
  splitter: 1,
  snakeHead: 1,
  flock: 12,
  dodger: 2,
  orbiter: 3,
  warden: 1,
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
  const pace = Math.max(0.28, 1 - wave * 0.03);
  // Superlinear budget: escalation accelerates so wave 10+ becomes a flood.
  let budget = 10 + wave * 5 + Math.floor(wave * wave * 0.6);

  // Later waves lean harder on higher-tier (later-introduced) archetypes.
  const introBias = 0.25 + Math.min(0.9, wave * 0.05);

  while (budget > 0) {
    // Weight recent introductions so new threats dominate as waves climb.
    let total = 0;
    for (const type of available) total += 1 + (INTRO[type] ?? 1) * introBias;
    let roll = rand() * total;
    let type: EnemyTypeId = available[0];
    for (const candidate of available) {
      roll -= 1 + (INTRO[candidate] ?? 1) * introBias;
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

/* ----- Elite affixes ----- */

export type AffixId = "veteran" | "swift" | "volatile" | "shielded" | "gilded";

/** One-affix elite modifiers. `hpMul`/`speedMul` apply at spawn; the rest
 *  are behavior flags read by the engine at hit/death time. Colors are the
 *  outer-ring tint the renderer draws. */
export const AFFIXES: Record<
  AffixId,
  { label: string; color: string; hpMul: number; speedMul: number }
> = {
  veteran: { label: "Veteran", color: "#ff5555", hpMul: 2.2, speedMul: 1 },
  swift: { label: "Swift", color: "#5ad1ff", hpMul: 1, speedMul: 1.6 },
  volatile: { label: "Volatile", color: "#ff9e4d", hpMul: 1.4, speedMul: 1 },
  shielded: { label: "Shielded", color: "#8ab8ff", hpMul: 1, speedMul: 1 },
  gilded: { label: "Gilded", color: "#ffd54d", hpMul: 1, speedMul: 1.1 },
};

const AFFIX_IDS: AffixId[] = ["veteran", "swift", "volatile", "shielded", "gilded"];

/** Weighted affix pick (volatile/shielded rarer since they're spikier). */
export function rollAffix(rand: () => number): AffixId {
  const weights: Record<AffixId, number> = {
    veteran: 30, swift: 30, gilded: 18, shielded: 12, volatile: 10,
  };
  let total = 0;
  for (const id of AFFIX_IDS) total += weights[id];
  let roll = rand() * total;
  for (const id of AFFIX_IDS) {
    roll -= weights[id];
    if (roll <= 0) return id;
  }
  return "veteran";
}
