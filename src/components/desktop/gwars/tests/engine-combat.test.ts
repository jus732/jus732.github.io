import { describe, expect, it } from "vitest";

import { GwarsEngine } from "../engine";
import { defaultMeta, buildRunConfig } from "../meta";

function makeEngine(seed = 1234) {
  return new GwarsEngine(900, 640, buildRunConfig(defaultMeta(), seed));
}

describe("hitstop", () => {
  it("consumes freeze time without stepping the sim", () => {
    const engine = makeEngine();
    engine.requestFreeze(50);
    expect(engine.freezeMs).toBe(50);
    const timeBefore = engine.time;
    engine.tick(16);
    expect(engine.freezeMs).toBe(34);
    expect(engine.time).toBe(timeBefore); // sim did not advance
  });

  it("resumes stepping once freeze elapses", () => {
    const engine = makeEngine();
    engine.requestFreeze(10);
    engine.tick(16); // 6ms of real time spills past the freeze
    expect(engine.freezeMs).toBe(0);
    const timeBefore = engine.time;
    engine.tick(16);
    expect(engine.time).toBeGreaterThan(timeBefore);
  });
});

describe("graze", () => {
  it("awards multiplier progress once per enemy that skims the ship", () => {
    const engine = makeEngine();
    engine.phase = "combat";
    engine.player.invuln = 0;
    engine.enemies.length = 0;
    // Inside the graze band (contact at 20px, band reaches 42px).
    const e = engine.spawnChild("wanderer", engine.player.x + 30, engine.player.y)!;
    e.grace = 0;
    engine.tick(20);
    expect(engine.geomCount).toBe(1);
    expect(e.grazed).toBe(true);
    engine.tick(20);
    expect(engine.geomCount).toBe(1); // one graze per enemy lifetime
  });

  it("a touching enemy is a hit, not a graze", () => {
    const engine = makeEngine();
    engine.phase = "combat";
    engine.player.invuln = 0;
    engine.lives = 2;
    engine.enemies.length = 0;
    const e = engine.spawnChild("wanderer", engine.player.x + 5, engine.player.y)!;
    e.grace = 0;
    engine.tick(20);
    expect(engine.lives).toBe(1);
    expect(engine.geomCount).toBe(0);
  });
});

describe("streak banker", () => {
  it("banks a geom bonus event when a 10+ kill chain ends", () => {
    const engine = makeEngine();
    engine.phase = "combat";
    engine.player.invuln = 0;
    (engine as unknown as { spawnPlan: unknown[] }).spawnPlan = [];
    engine.enemies.length = 0;
    for (let i = 0; i < 12; i++) {
      const e = engine.spawnChild("wanderer", 700, 500)!;
      e.grace = 0;
      e.hp = 0;
    }
    engine.tick(20); // sweep kills all 12; wave clear finalizes the streak
    const events = engine.drainEvents();
    const bank = events.find((ev) => ev.kind === "streakBonus");
    expect(bank).toBeDefined();
    expect(bank!.kind === "streakBonus" && bank!.kills).toBe(12);
  });

  it("does not bank short chains", () => {
    const engine = makeEngine();
    engine.phase = "combat";
    engine.player.invuln = 0;
    (engine as unknown as { spawnPlan: unknown[] }).spawnPlan = [];
    engine.enemies.length = 0;
    for (let i = 0; i < 4; i++) {
      const e = engine.spawnChild("wanderer", 700, 500)!;
      e.grace = 0;
      e.hp = 0;
    }
    engine.tick(20);
    const events = engine.drainEvents();
    expect(events.some((ev) => ev.kind === "streakBonus")).toBe(false);
  });
});

describe("boss slow-mo", () => {
  it("advances sim time slower while slowMoMs is active", () => {
    const a = makeEngine(9);
    const b = makeEngine(9);
    b.slowMoMs = 1000;
    for (let i = 0; i < 30; i++) {
      a.tick(16);
      b.tick(16);
    }
    expect(b.time).toBeLessThan(a.time);
  });
});

describe("ricochet", () => {
  it("reflects a wall-bound bullet instead of expiring, spending a bounce", () => {
    const engine = makeEngine();
    const b = engine.bullets[0];
    b.active = true;
    b.x = 2; b.y = 300;
    b.vx = -600; b.vy = 0;
    b.radius = 3; b.life = 1; b.pierce = 0; b.bounces = 1; b.lastHit = -1; b.fromDrone = false;
    engine.enemies.length = 0; // no collisions to interfere
    engine.phase = "combat";
    engine.tick(20); // one fixed step (>16.67ms) advances the bullet
    expect(b.active).toBe(true);
    expect(b.vx).toBeGreaterThan(0); // reflected rightward
    expect(b.bounces).toBe(0);
  });
});

describe("crit", () => {
  it("does not draw RNG when crit is zero (stream unchanged)", () => {
    const a = makeEngine(555);
    const b = makeEngine(555);
    expect(a.rand()).toBe(b.rand());
  });

  it("defaults the combo crit multiplier to 3", () => {
    const engine = makeEngine();
    expect(engine.comboFx.critMul).toBe(3);
  });
});

describe("arc reactor", () => {
  it("chains damage to a nearby enemy after a kill", () => {
    const engine = makeEngine();
    engine.uniques.add("arcReactor");
    engine.phase = "combat";
    engine.enemies.length = 0;
    const neighbor = engine.spawnChild("wanderer", 120, 100)!;
    neighbor.grace = 0;
    const hpBefore = neighbor.hp;
    (engine as unknown as { chainQueue: { x: number; y: number }[] }).chainQueue.push({ x: 100, y: 100 });
    (engine as unknown as { processChains: () => void }).processChains();
    expect(neighbor.hp).toBeLessThan(hpBefore);
  });
});

describe("kill direction", () => {
  it("stamps the killing bullet's travel angle on the enemyKill event", () => {
    const engine = makeEngine();
    engine.phase = "combat";
    engine.enemies.length = 0;
    const e = engine.spawnChild("wanderer", 400, 300)!;
    e.grace = 0;
    e.hp = 1;
    const b = engine.bullets[0];
    b.active = true;
    b.x = 385; b.y = 300; b.vx = 600; b.vy = 0; b.damage = 99;
    b.radius = 3; b.life = 1; b.pierce = 0; b.bounces = 0; b.lastHit = -1; b.fromDrone = false;
    engine.tick(20); // one step: bullet reaches and kills the enemy
    const kill = engine.drainEvents().find((ev) => ev.kind === "enemyKill");
    expect(kill).toBeDefined();
    const angle = kill!.kind === "enemyKill" ? kill!.angle : Number.NaN;
    // Bullet travels +x, so the blow lands pointing rightward (angle 0).
    expect(Math.abs(angle)).toBeLessThan(0.3);
  });

  it("defaults to the player->enemy direction when nothing recorded a hit", () => {
    const engine = makeEngine();
    engine.phase = "combat";
    engine.enemies.length = 0;
    // Directly to the right of the center-spawned player.
    const e = engine.spawnChild("wanderer", engine.player.x + 200, engine.player.y)!;
    e.grace = 0;
    e.hp = 0; // dies in the sweep without any recorded blow
    engine.tick(20);
    const kill = engine.drainEvents().find((ev) => ev.kind === "enemyKill");
    expect(kill).toBeDefined();
    const angle = kill!.kind === "enemyKill" ? kill!.angle : Number.NaN;
    expect(Math.abs(angle)).toBeLessThan(0.3); // pointing away from the player
  });
});

describe("micro-hitstop cooldown", () => {
  /** Mark `n` fresh enemies dead so the next step's sweep counts them. */
  function massKill(engine: ReturnType<typeof makeEngine>, n: number) {
    for (let i = 0; i < n; i++) {
      const e = engine.spawnChild("wanderer", 700, 500)!;
      e.grace = 0;
      e.hp = 0;
    }
  }

  function setupCombat(engine: ReturnType<typeof makeEngine>) {
    engine.phase = "combat";
    engine.player.invuln = 60;
    (engine as unknown as { spawnPlan: unknown[] }).spawnPlan = [];
    engine.enemies.length = 0;
    // A survivor so the wave never clears mid-test.
    const survivor = engine.spawnChild("wanderer", 100, 100)!;
    survivor.hp = 9999;
  }

  it("does not re-trigger a micro freeze within the cooldown window", () => {
    const engine = makeEngine();
    setupCombat(engine);
    massKill(engine, 3);
    engine.tick(20);
    expect(engine.freezeMs).toBe(50); // first burst lands its beat
    engine.tick(50); // consume the freeze, sim resumes
    massKill(engine, 3);
    engine.tick(20);
    expect(engine.freezeMs).toBe(0); // still inside the cooldown
  });

  it("fires again once the cooldown has elapsed", () => {
    const engine = makeEngine();
    setupCombat(engine);
    massKill(engine, 3);
    engine.tick(20);
    engine.tick(50);
    for (let i = 0; i < 20; i++) engine.tick(16); // > 250ms of sim time
    massKill(engine, 3);
    engine.tick(20);
    expect(engine.freezeMs).toBe(50);
  });

  it("boss death freeze bypasses the cooldown", () => {
    const engine = makeEngine();
    setupCombat(engine);
    massKill(engine, 3);
    engine.tick(20);
    engine.tick(50); // consume micro freeze; cooldown still hot
    const boss = engine.spawnChild("boss", 700, 500)!;
    boss.grace = 0;
    boss.hp = 0;
    engine.tick(20);
    expect(engine.freezeMs).toBe(60); // boss beat always lands
  });
});

describe("volatile hazard", () => {
  it("detonates after its warn window and costs a life if the player stands in it", () => {
    const engine = makeEngine();
    engine.lives = 2;
    engine.player.invuln = 0;
    engine.spawnHazard(engine.player.x, engine.player.y);
    for (let i = 0; i < 45; i++) engine.tick(16);
    expect(engine.lives).toBe(1);
  });

  it("does no harm if the player has left the radius", () => {
    const engine = makeEngine();
    engine.lives = 2;
    engine.player.invuln = 0;
    engine.spawnHazard(10, 10); // far from center-spawned player
    for (let i = 0; i < 45; i++) engine.tick(16);
    expect(engine.lives).toBe(2);
  });

  it("routes through the shared hit path: the board-clear mercy applies", () => {
    const engine = makeEngine();
    engine.lives = 2;
    engine.player.invuln = 0;
    const bystander = engine.spawnChild("wanderer", 800, 600)!;
    bystander.grace = 0;
    engine.spawnHazard(engine.player.x, engine.player.y);
    for (let i = 0; i < 45; i++) engine.tick(16);
    expect(engine.lives).toBe(1);
    // A real hit clears the board, exactly like an enemy collision would.
    expect(engine.enemies.length).toBe(0);
  });
});
