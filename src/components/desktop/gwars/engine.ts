/**
 * Pure G-Wars engine: no React, no DOM. A twin-stick arena sim driven by
 * tick(dtMs) over a fixed internal timestep, with a seedable RNG so runs
 * are deterministic and unit-testable (no test runner is wired up yet;
 * this file is the seam). Bullets, geoms, and particles are object-pooled
 * and enemy collision uses a uniform-grid spatial hash, so steady-state
 * frames allocate nothing. The UI drives it with tick(dt) and drains
 * `events` for sounds, grid ripples, and screen shake.
 */

import { ARCHETYPES, spawnPlanForWave, type EnemyTypeId } from "./enemies";
import {
  COMBOS,
  UPGRADES,
  defaultComboEffects,
  luckForWave,
  rollOffers,
  type ComboId,
  type UniqueId,
  type UpgradeId,
  type UpgradeOffer,
} from "./rarity";
import type { ShipDef } from "./weapons";

export { UPGRADES, type UpgradeId } from "./rarity";

export type Vec = { x: number; y: number };

/** Abstract input: a keyboard provider fills it today; a mouse or gamepad
 *  provider can drop in later with zero engine changes. */
export type InputState = {
  move: Vec;
  aim: Vec;
  firing: boolean;
};

export type Enemy = {
  id: number;
  type: EnemyTypeId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  /** Seconds alive; behaviors key motion off it. */
  age: number;
  /** Spawn fade-in; no collisions while > 0. */
  grace: number;
  /** Per-enemy random phase in [0, 1) for varied paths. */
  seed: number;
  /** Render rotation, advanced by behaviors. */
  spin: number;
  /** Leader enemy id (snake segments), -1 otherwise. */
  link: number;
  /** Generic behavior timer (boss minion cadence). */
  timer: number;
  /** Hit flash, seconds remaining. */
  flash: number;
};

/** The limited view of the sim that enemy behaviors get. */
export interface World {
  readonly w: number;
  readonly h: number;
  readonly wave: number;
  readonly playerX: number;
  readonly playerY: number;
  rand(): number;
  spawnChild(type: EnemyTypeId, x: number, y: number): Enemy | null;
  byId(id: number): Enemy | null;
}

export type Bullet = {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  pierce: number;
  radius: number;
  life: number;
  /** Last enemy id hit, so a piercing shot damages each enemy once. */
  lastHit: number;
  fromDrone: boolean;
};

export type Geom = {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
};

export type Particle = {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
};

export type Drone = { angle: number; x: number; y: number; cd: number };

/* ----- In-run upgrades (wave-clear reward picks) -----
 * The stackable upgrade table + rarity/offer helpers live in rarity.ts;
 * UPGRADES and UpgradeId are re-exported above for existing importers. */

export type GwarsEvent =
  | { kind: "fire" }
  | { kind: "enemySpawn"; x: number; y: number }
  | { kind: "enemyKill"; x: number; y: number; type: EnemyTypeId; color: string; radius: number }
  | { kind: "geomPickup"; x: number; y: number }
  | { kind: "multiplierUp"; multiplier: number }
  | { kind: "playerHit"; x: number; y: number; fatal: boolean; shielded: boolean }
  | { kind: "waveClear"; wave: number; choices: UpgradeOffer[] }
  | { kind: "bomb"; x: number; y: number }
  | { kind: "gameOver"; score: number; wave: number; kills: number; cores: number };

/** Permanent modifiers assembled from meta upgrades + ship + difficulty. */
export type RunConfig = {
  ship: ShipDef;
  /** Total hits the player can take; Infinity allowed (Easy mode). */
  lives: number;
  bombs: number;
  damageMul: number;
  /** > 1 fires faster. */
  fireRateMul: number;
  speedMul: number;
  pickupRadius: number;
  startMultiplier: number;
  /** Permanent meta Luck folded into the reward-roll luck ramp. */
  luck: number;
  /** Reroll charges the run starts with. */
  rerolls: number;
  seed?: number;
};

/* ----- Tuning ----- */

export const STEP = 1 / 60;
const MAX_FRAME_MS = 100;

export const PLAYER_RADIUS = 9;
const PLAYER_SPEED = 290;
const MOVE_SMOOTHING = 14;

const BULLET_POOL = 256;
const GEOM_POOL = 320;
const PARTICLE_POOL = 640;
const MAX_ENEMIES = 220;
const BULLET_LIFE = 1.6;

const GEOMS_PER_MULT = 12;
const MULT_CAP = 30;
const GEOM_LIFE = 8;
const GEOM_SCORE = 5;
const GEOM_MAGNET_ACCEL = 1400;

const INVULN_ON_HIT = 2.5;
const INVULN_ON_SHIELD = 1.2;
const SHIELD_REGEN_S = 18;

const DRONE_ORBIT_RADIUS = 36;
const DRONE_SPIN = 1.9;
const DRONE_RANGE = 460;
const DRONE_COOLDOWN = 0.45;
const DRONE_SPREAD_ANGLE = 0.18;

const REROLL_CAP = 5;
const REROLL_EVERY_WAVES = 3;

/* Unique-upgrade tuning */
const NOVA_RADIUS = 90;
const NOVA_DAMAGE = 2;
const NOVA_COLOR = "#ffb020";
const BLACK_HOLE_PERIOD = 9;
const BLACK_HOLE_LIFE = 3.5;
const BLACK_HOLE_RADIUS = 240;
const BLACK_HOLE_PULL = 900;
const BLACK_HOLE_COLOR = "#b06bff";
const VENGEANCE_RADIUS = 200;
const VENGEANCE_DAMAGE = 4;
const OVERFLOW_EVERY = 5;
const OVERFLOW_DAMAGE_MUL = 4;
const ENEMY_DRAG_ACCEL = 260;

export { BLACK_HOLE_RADIUS, BLACK_HOLE_COLOR };

/** Deterministic seedable RNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cores banked at run end, proportional to score + waves cleared. */
export function coresForRun(score: number, wavesCleared: number): number {
  return Math.round(score / 400) + wavesCleared * 8;
}

/* ----- Spatial hash (uniform grid, zero-alloc rebuild) ----- */

/** Cell size must exceed max enemy radius + max bullet radius so a 3x3
 *  neighborhood query around a point catches every possible overlap. */
const HASH_CELL = 72;

class SpatialHash {
  private cols = 1;
  private rows = 1;
  private head = new Int32Array(1);
  private next = new Int32Array(MAX_ENEMIES);

  configure(w: number, h: number) {
    this.cols = Math.max(1, Math.ceil(w / HASH_CELL));
    this.rows = Math.max(1, Math.ceil(h / HASH_CELL));
    if (this.head.length < this.cols * this.rows) {
      this.head = new Int32Array(this.cols * this.rows);
    }
  }

  rebuild(enemies: Enemy[]) {
    this.head.fill(-1);
    if (this.next.length < enemies.length) {
      this.next = new Int32Array(enemies.length * 2);
    }
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const cx = Math.min(this.cols - 1, Math.max(0, (e.x / HASH_CELL) | 0));
      const cy = Math.min(this.rows - 1, Math.max(0, (e.y / HASH_CELL) | 0));
      const cell = cy * this.cols + cx;
      this.next[i] = this.head[cell];
      this.head[cell] = i;
    }
  }

  /** Visit enemy indices in the 3x3 cells around (x, y). */
  query(x: number, y: number, visit: (index: number) => void) {
    const cx = Math.min(this.cols - 1, Math.max(0, (x / HASH_CELL) | 0));
    const cy = Math.min(this.rows - 1, Math.max(0, (y / HASH_CELL) | 0));
    for (let gy = Math.max(0, cy - 1); gy <= Math.min(this.rows - 1, cy + 1); gy++) {
      for (let gx = Math.max(0, cx - 1); gx <= Math.min(this.cols - 1, cx + 1); gx++) {
        let i = this.head[gy * this.cols + gx];
        while (i !== -1) {
          visit(i);
          i = this.next[i];
        }
      }
    }
  }
}

/* ----- Engine ----- */

export type EnginePhase = "combat" | "reward" | "over";

export class GwarsEngine implements World {
  w: number;
  h: number;
  phase: EnginePhase = "combat";
  wave = 1;
  score = 0;
  kills = 0;
  multiplier: number;
  geomCount = 0;
  lives: number;
  bombs: number;
  time = 0;
  events: GwarsEvent[] = [];
  pendingChoices: UpgradeOffer[] = [];
  /** One-time cards acquired this run (read by the HUD / reward UI). */
  uniques = new Set<UniqueId>();
  combos = new Set<ComboId>();
  /** Fused-effect knobs; COMBOS[id].apply mutates these additively. */
  comboFx = defaultComboEffects();
  rerolls: number;
  /** Gravity well spawned by the Black Hole unique (renderer reads it). */
  blackHole = { active: false, x: 0, y: 0, life: 0 };

  player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    fireCd: 0,
    invuln: 1.2,
    shieldCharges: 0,
    shieldRegen: 0,
    thrustTimer: 0,
  };

  mods: Record<UpgradeId, number> = {
    fireRate: 0,
    multishot: 0,
    pierce: 0,
    drone: 0,
    shield: 0,
    bomb: 0,
    pickup: 0,
    speed: 0,
    damage: 0,
  };

  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  geoms: Geom[] = [];
  particles: Particle[] = [];
  drones: Drone[] = [];

  readonly config: RunConfig;

  private input: InputState = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, firing: false };
  private rng: () => number;
  private acc = 0;
  private nextId = 1;
  private hash = new SpatialHash();
  private spawnPlan: { type: EnemyTypeId; at: number }[] = [];
  private spawnIndex = 0;
  private spawnClock = 0;
  private droneSpin = 0;
  private activeParticles = 0;
  /** Waves rolled without an epic+ offer (see PITY_THRESHOLD). */
  private pity = 0;
  /** Volley counter for the Overflow unique. */
  private volleyCount = 0;
  private blackHoleCd = BLACK_HOLE_PERIOD;
  /** Nova blasts queued by kills, applied after the death sweep. */
  private novaQueue: { x: number; y: number }[] = [];

  constructor(w: number, h: number, config: RunConfig) {
    this.w = w;
    this.h = h;
    this.config = config;
    this.rng = mulberry32(config.seed ?? (Math.random() * 0xffffffff) >>> 0);
    this.multiplier = config.startMultiplier;
    this.lives = config.lives;
    this.bombs = config.bombs;
    this.rerolls = config.rerolls;
    this.player.x = w / 2;
    this.player.y = h / 2;
    for (let i = 0; i < BULLET_POOL; i++) {
      this.bullets.push({
        active: false, x: 0, y: 0, vx: 0, vy: 0, damage: 0,
        pierce: 0, radius: 0, life: 0, lastHit: -1, fromDrone: false,
      });
    }
    for (let i = 0; i < GEOM_POOL; i++) {
      this.geoms.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
    }
    for (let i = 0; i < PARTICLE_POOL; i++) {
      this.particles.push({
        active: false, x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 1, size: 0, color: "#fff",
      });
    }
    this.syncDrones();
    this.buildWave();
  }

  /* ----- World interface (what enemy behaviors see) ----- */

  get playerX() {
    return this.player.x;
  }

  get playerY() {
    return this.player.y;
  }

  rand(): number {
    return this.rng();
  }

  spawnChild(type: EnemyTypeId, x: number, y: number): Enemy | null {
    if (this.enemies.length >= MAX_ENEMIES) return null;
    return this.spawnEnemyAt(type, x, y, 0.4);
  }

  byId(id: number): Enemy | null {
    for (const e of this.enemies) if (e.id === id) return e;
    return null;
  }

  /* ----- Public API driven by the UI ----- */

  setInput(input: InputState) {
    this.input = input;
  }

  setBounds(w: number, h: number) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.hash.configure(this.w, this.h);
    this.player.x = clamp(this.player.x, PLAYER_RADIUS, this.w - PLAYER_RADIUS);
    this.player.y = clamp(this.player.y, PLAYER_RADIUS, this.h - PLAYER_RADIUS);
    for (const e of this.enemies) {
      e.x = clamp(e.x, e.radius, this.w - e.radius);
      e.y = clamp(e.y, e.radius, this.h - e.radius);
    }
  }

  requestBomb() {
    if (this.phase !== "combat" || this.bombs <= 0) return;
    this.bombs--;
    this.events.push({ kind: "bomb", x: this.player.x, y: this.player.y });
    this.clearBoard(true);
  }

  chooseUpgrade(offer: UpgradeOffer) {
    if (this.phase !== "reward" || !this.pendingChoices.includes(offer)) return;
    if (offer.kind === "stackable") {
      if (offer.id === "bomb") {
        this.bombs += offer.potency;
      } else {
        this.mods[offer.id] = Math.min(
          UPGRADES[offer.id].max,
          this.mods[offer.id] + offer.potency
        );
      }
      if (offer.id === "shield") this.player.shieldCharges = this.mods.shield;
      if (offer.id === "drone") this.syncDrones();
    } else if (offer.kind === "unique") {
      this.uniques.add(offer.id);
    } else {
      // Additive fusion: nothing is consumed, component levels stay.
      this.combos.add(offer.id);
      COMBOS[offer.id].apply(this.comboFx);
    }
    this.pendingChoices = [];
    if (this.wave % REROLL_EVERY_WAVES === 0) {
      this.rerolls = Math.min(REROLL_CAP, this.rerolls + 1);
    }
    this.wave++;
    this.buildWave();
    this.phase = "combat";
  }

  /** Redeal the reward cards, spending one reroll charge. */
  rerollOffers(): boolean {
    if (this.phase !== "reward" || this.rerolls <= 0) return false;
    this.rerolls--;
    this.pendingChoices = this.rollUpgrades();
    return true;
  }

  tick(dtMs: number) {
    this.acc += Math.min(dtMs, MAX_FRAME_MS);
    const stepMs = STEP * 1000;
    while (this.acc >= stepMs) {
      this.acc -= stepMs;
      this.step(STEP);
    }
  }

  drainEvents(): GwarsEvent[] {
    if (this.events.length === 0) return [];
    const drained = this.events;
    this.events = [];
    return drained;
  }

  /* ----- Simulation ----- */

  private step(dt: number) {
    this.updateParticles(dt); // effects keep settling on reward/over frames
    if (this.phase !== "combat") return;
    this.time += dt;

    this.updatePlayer(dt);
    this.updateSpawning(dt);
    this.updateBlackHole(dt);
    this.updateEnemies(dt);
    this.hash.rebuild(this.enemies);
    this.updateBullets(dt);
    this.updateDrones(dt);
    this.updateGeoms(dt);
    this.checkPlayerCollision();
    this.sweepDead();
    this.processNovas();
    this.checkWaveClear();
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    const { move, aim, firing } = this.input;
    const speed =
      PLAYER_SPEED * this.config.speedMul * (1 + 0.12 * this.mods.speed);

    const blend = Math.min(1, dt * MOVE_SMOOTHING);
    p.vx += (move.x * speed - p.vx) * blend;
    p.vy += (move.y * speed - p.vy) * blend;
    p.x = clamp(p.x + p.vx * dt, PLAYER_RADIUS, this.w - PLAYER_RADIUS);
    p.y = clamp(p.y + p.vy * dt, PLAYER_RADIUS, this.h - PLAYER_RADIUS);

    const aiming = aim.x !== 0 || aim.y !== 0;
    if (aiming) {
      p.angle = Math.atan2(aim.y, aim.x);
    } else if (move.x !== 0 || move.y !== 0) {
      p.angle = Math.atan2(move.y, move.x);
    }

    p.invuln = Math.max(0, p.invuln - dt);

    // Shield charges refill one at a time while below capacity.
    if (this.mods.shield > 0 && p.shieldCharges < this.mods.shield) {
      p.shieldRegen += dt;
      if (p.shieldRegen >= SHIELD_REGEN_S) {
        p.shieldRegen = 0;
        p.shieldCharges++;
      }
    }

    // Thruster sparks while moving.
    if ((move.x !== 0 || move.y !== 0) && !this.reduceParticles()) {
      p.thrustTimer -= dt;
      if (p.thrustTimer <= 0) {
        p.thrustTimer = 0.035;
        const back = Math.atan2(-p.vy, -p.vx);
        this.spawnParticle(
          p.x + Math.cos(back) * 10,
          p.y + Math.sin(back) * 10,
          Math.cos(back + (this.rng() - 0.5) * 0.6) * 90,
          Math.sin(back + (this.rng() - 0.5) * 0.6) * 90,
          0.3,
          2.2,
          this.config.ship.color
        );
      }
    }

    p.fireCd -= dt;
    if (firing && aiming) {
      const cooldown =
        this.config.ship.cooldown /
        (this.config.fireRateMul *
          Math.pow(1.18, this.mods.fireRate) *
          this.comboFx.fireRateMul);
      while (p.fireCd <= 0) {
        p.fireCd += cooldown;
        this.fireVolley(p.angle);
      }
    } else if (p.fireCd < 0) {
      p.fireCd = 0;
    }
  }

  private fireVolley(angle: number) {
    const ship = this.config.ship;
    const fx = this.comboFx;
    const damage =
      ship.damage *
      this.config.damageMul *
      (1 + 0.25 * this.mods.damage) *
      fx.damageMul;
    const pierce = fx.infinitePierce ? 999 : ship.pierce + this.mods.pierce;
    const lanes = 1 + this.mods.multishot;
    const p = this.player;

    // Overflow: every Nth volley is a single piercing mega-bolt instead.
    if (this.uniques.has("overflow") && ++this.volleyCount % OVERFLOW_EVERY === 0) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      this.spawnBullet(
        p.x + cos * 12,
        p.y + sin * 12,
        cos * ship.bulletSpeed,
        sin * ship.bulletSpeed,
        damage * OVERFLOW_DAMAGE_MUL,
        999,
        ship.bulletRadius * 2.4,
        false
      );
      this.events.push({ kind: "fire" });
      return;
    }

    for (const da of ship.spreadAngles) {
      const a =
        angle + da * fx.laneSpreadMul + (this.rng() - 0.5) * 2 * ship.jitter;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      for (let lane = 0; lane < lanes; lane++) {
        const off = (lane - (lanes - 1) / 2) * 7 * fx.laneSpreadMul;
        this.spawnBullet(
          p.x + cos * 12 - sin * off,
          p.y + sin * 12 + cos * off,
          cos * ship.bulletSpeed,
          sin * ship.bulletSpeed,
          damage,
          pierce,
          ship.bulletRadius,
          false
        );
      }
    }
    this.events.push({ kind: "fire" });
  }

  private spawnBullet(
    x: number, y: number, vx: number, vy: number,
    damage: number, pierce: number, radius: number, fromDrone: boolean
  ) {
    for (const b of this.bullets) {
      if (b.active) continue;
      b.active = true;
      b.x = x;
      b.y = y;
      b.vx = vx;
      b.vy = vy;
      b.damage = damage;
      b.pierce = pierce;
      b.radius = radius;
      b.life = BULLET_LIFE;
      b.lastHit = -1;
      b.fromDrone = fromDrone;
      return;
    }
  }

  /* ----- Waves & spawning ----- */

  private buildWave() {
    this.spawnPlan = spawnPlanForWave(this.wave, this.rng);
    this.spawnIndex = 0;
    this.spawnClock = 0;
  }

  private updateSpawning(dt: number) {
    this.spawnClock += dt;
    while (
      this.spawnIndex < this.spawnPlan.length &&
      this.spawnPlan[this.spawnIndex].at <= this.spawnClock
    ) {
      if (this.enemies.length >= MAX_ENEMIES) {
        this.spawnPlan[this.spawnIndex].at = this.spawnClock + 0.5;
        break;
      }
      this.spawnEnemy(this.spawnPlan[this.spawnIndex].type);
      this.spawnIndex++;
    }
  }

  private spawnEnemy(type: EnemyTypeId) {
    const arch = ARCHETYPES[type];
    // Prefer a spot away from the player so spawns never feel cheap.
    let x = 0;
    let y = 0;
    for (let attempt = 0; attempt < 8; attempt++) {
      x = arch.radius + this.rng() * (this.w - arch.radius * 2);
      y = arch.radius + this.rng() * (this.h - arch.radius * 2);
      const dx = x - this.player.x;
      const dy = y - this.player.y;
      if (dx * dx + dy * dy > 170 * 170) break;
    }
    const e = this.spawnEnemyAt(type, x, y, 0.9);
    this.events.push({ kind: "enemySpawn", x: e.x, y: e.y });
  }

  private spawnEnemyAt(type: EnemyTypeId, x: number, y: number, grace: number): Enemy {
    const arch = ARCHETYPES[type];
    const hpScale = 1 + (this.wave - 1) * 0.07;
    const e: Enemy = {
      id: this.nextId++,
      type,
      x: clamp(x, arch.radius, this.w - arch.radius),
      y: clamp(y, arch.radius, this.h - arch.radius),
      vx: 0,
      vy: 0,
      hp: arch.hp * hpScale,
      maxHp: arch.hp * hpScale,
      radius: arch.radius,
      speed: arch.speed * Math.min(1.4, 1 + (this.wave - 1) * 0.012),
      age: 0,
      grace,
      seed: this.rng(),
      spin: 0,
      link: -1,
      timer: 0,
      flash: 0,
    };
    this.enemies.push(e);
    arch.onSpawn?.(e, this);
    return e;
  }

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      e.age += dt;
      e.grace = Math.max(0, e.grace - dt);
      e.flash = Math.max(0, (e.flash ?? 0) - dt);
      if (e.grace > 0) continue; // still materializing
      ARCHETYPES[e.type].behavior(e, this, dt);
      e.x = clamp(e.x + e.vx * dt, e.radius, this.w - e.radius);
      e.y = clamp(e.y + e.vy * dt, e.radius, this.h - e.radius);
    }
  }

  private updateBullets(dt: number) {
    for (const b of this.bullets) {
      if (!b.active) continue;
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (
        b.life <= 0 ||
        b.x < -20 || b.x > this.w + 20 ||
        b.y < -20 || b.y > this.h + 20
      ) {
        b.active = false;
        continue;
      }
      this.hash.query(b.x, b.y, (i) => {
        if (!b.active) return;
        const e = this.enemies[i];
        if (e.grace > 0 || e.hp <= 0 || e.id === b.lastHit) return;
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        const rr = e.radius + b.radius;
        if (dx * dx + dy * dy > rr * rr) return;
        e.hp -= b.damage;
        e.flash = 0.08;
        b.lastHit = e.id;
        if (!this.reduceParticles()) {
          this.spawnBurst(b.x, b.y, ARCHETYPES[e.type].color, 3, 140, 0.25);
        }
        if (b.pierce > 0) {
          b.pierce--;
        } else {
          b.active = false;
        }
      });
    }
  }

  private updateDrones(dt: number) {
    if (this.drones.length === 0) return;
    this.droneSpin += DRONE_SPIN * dt;
    const damage =
      0.55 *
      this.config.damageMul *
      (1 + 0.25 * this.mods.damage) *
      this.comboFx.damageMul;
    for (let i = 0; i < this.drones.length; i++) {
      const d = this.drones[i];
      d.angle = this.droneSpin + (i * Math.PI * 2) / this.drones.length;
      d.x = this.player.x + Math.cos(d.angle) * DRONE_ORBIT_RADIUS;
      d.y = this.player.y + Math.sin(d.angle) * DRONE_ORBIT_RADIUS;
      d.cd -= dt;
      if (d.cd > 0) continue;
      // Fire at the nearest live enemy in range.
      let best: Enemy | null = null;
      let bestD = DRONE_RANGE * DRONE_RANGE;
      for (const e of this.enemies) {
        if (e.grace > 0 || e.hp <= 0) continue;
        const dx = e.x - d.x;
        const dy = e.y - d.y;
        const dist = dx * dx + dy * dy;
        if (dist < bestD) {
          bestD = dist;
          best = e;
        }
      }
      if (!best) continue;
      d.cd = DRONE_COOLDOWN;
      const a = Math.atan2(best.y - d.y, best.x - d.x);
      // Swarm Bay fuses drones into a fanned volley.
      const shots = this.comboFx.droneShots;
      for (let s = 0; s < shots; s++) {
        const sa = a + (s - (shots - 1) / 2) * DRONE_SPREAD_ANGLE;
        this.spawnBullet(
          d.x, d.y,
          Math.cos(sa) * 640, Math.sin(sa) * 640,
          damage, 0, 2, true
        );
      }
    }
  }

  /** Black Hole unique: a periodic gravity well that drags enemies in. */
  private updateBlackHole(dt: number) {
    const bh = this.blackHole;
    if (!this.uniques.has("blackHole")) return;
    if (!bh.active) {
      this.blackHoleCd -= dt;
      if (this.blackHoleCd <= 0 && this.enemies.length > 0) {
        this.blackHoleCd = BLACK_HOLE_PERIOD;
        bh.active = true;
        bh.life = BLACK_HOLE_LIFE;
        bh.x = 60 + this.rng() * Math.max(1, this.w - 120);
        bh.y = 60 + this.rng() * Math.max(1, this.h - 120);
      }
      return;
    }
    bh.life -= dt;
    if (bh.life <= 0) {
      bh.active = false;
      return;
    }
    for (const e of this.enemies) {
      if (e.grace > 0) continue;
      const dx = bh.x - e.x;
      const dy = bh.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist < BLACK_HOLE_RADIUS && dist > 6) {
        const pull = BLACK_HOLE_PULL * (1 - dist / BLACK_HOLE_RADIUS);
        e.vx += (dx / dist) * pull * dt;
        e.vy += (dy / dist) * pull * dt;
      }
    }
  }

  private syncDrones() {
    const want = this.config.ship.drones + this.mods.drone;
    while (this.drones.length < want) {
      this.drones.push({ angle: 0, x: this.player.x, y: this.player.y, cd: 0 });
    }
  }

  private updateGeoms(dt: number) {
    const p = this.player;
    const magnetR =
      this.config.pickupRadius + 40 * this.mods.pickup;
    // Magnetar: the tractor field pulls enemies inward too - more geoms
    // reach you, but so does everything else.
    if (this.comboFx.enemyDrag) {
      for (const e of this.enemies) {
        if (e.grace > 0) continue;
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist < magnetR * 1.4 && dist > 0.001) {
          e.vx += (dx / dist) * ENEMY_DRAG_ACCEL * dt;
          e.vy += (dy / dist) * ENEMY_DRAG_ACCEL * dt;
        }
      }
    }
    for (const g of this.geoms) {
      if (!g.active) continue;
      g.life -= dt;
      if (g.life <= 0) {
        g.active = false;
        continue;
      }
      const damp = Math.exp(-3 * dt);
      g.vx *= damp;
      g.vy *= damp;
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      const dist = Math.hypot(dx, dy);
      if (dist < magnetR && dist > 0.001) {
        g.vx += (dx / dist) * GEOM_MAGNET_ACCEL * dt;
        g.vy += (dy / dist) * GEOM_MAGNET_ACCEL * dt;
      }
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (dist < PLAYER_RADIUS + 7) {
        g.active = false;
        this.collectGeom(g.x, g.y);
      }
    }
  }

  private collectGeom(x: number, y: number) {
    this.geomCount++;
    this.score += GEOM_SCORE * this.multiplier;
    this.events.push({ kind: "geomPickup", x, y });
    const next = Math.min(
      MULT_CAP,
      this.config.startMultiplier + Math.floor(this.geomCount / GEOMS_PER_MULT)
    );
    if (next > this.multiplier) {
      this.multiplier = next;
      this.events.push({ kind: "multiplierUp", multiplier: next });
    }
  }

  private checkPlayerCollision() {
    const p = this.player;
    if (p.invuln > 0) return;
    let hit = false;
    this.hash.query(p.x, p.y, (i) => {
      if (hit) return;
      const e = this.enemies[i];
      if (e.grace > 0 || e.hp <= 0) return;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const rr = e.radius + PLAYER_RADIUS;
      if (dx * dx + dy * dy <= rr * rr) hit = true;
    });
    if (!hit) return;

    // Vengeance Field: any hit lashes back with a damaging shockwave.
    if (this.uniques.has("vengeance")) {
      for (const e of this.enemies) {
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= VENGEANCE_RADIUS) continue;
        e.hp -= VENGEANCE_DAMAGE * this.config.damageMul;
        e.flash = 0.08;
        if (dist > 0.001) {
          e.vx += (dx / dist) * 380;
          e.vy += (dy / dist) * 380;
        }
      }
      this.spawnBurst(p.x, p.y, "#ff9e4d", 24, 380, 0.6);
    }

    if (p.shieldCharges > 0) {
      p.shieldCharges--;
      p.shieldRegen = 0;
      p.invuln = INVULN_ON_SHIELD;
      // Shield pops: shove everything nearby away instead of dying.
      for (const e of this.enemies) {
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 160 && dist > 0.001) {
          e.vx += (dx / dist) * 420;
          e.vy += (dy / dist) * 420;
        }
      }
      this.events.push({ kind: "playerHit", x: p.x, y: p.y, fatal: false, shielded: true });
      return;
    }

    this.lives--;
    const fatal = this.lives <= 0;
    this.multiplier = this.config.startMultiplier;
    this.geomCount = 0;
    p.invuln = INVULN_ON_HIT;
    this.clearBoard(false);
    this.spawnBurst(p.x, p.y, this.config.ship.color, 60, 420, 0.9);
    this.events.push({ kind: "playerHit", x: p.x, y: p.y, fatal, shielded: false });
    if (fatal) this.endRun();
  }

  /** Kill every live enemy; bombs score half value, deaths score nothing. */
  private clearBoard(scored: boolean) {
    for (const e of this.enemies) {
      const arch = ARCHETYPES[e.type];
      this.spawnBurst(e.x, e.y, arch.color, 8, 260, 0.6);
      if (scored) {
        this.kills++;
        this.score += Math.floor(arch.score / 2);
      }
    }
    this.enemies.length = 0;
  }

  private endRun() {
    this.phase = "over";
    const cores = coresForRun(this.score, this.wave - 1);
    this.events.push({
      kind: "gameOver",
      score: this.score,
      wave: this.wave,
      kills: this.kills,
      cores,
    });
  }

  /** Remove enemies whose hp hit zero this step, paying out score/geoms. */
  private sweepDead() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hp > 0) continue;
      const arch = ARCHETYPES[e.type];
      this.kills++;
      this.score += arch.score * this.multiplier;
      for (let g = 0; g < arch.geoms; g++) {
        this.spawnGeom(e.x, e.y);
      }
      this.spawnBurst(
        e.x, e.y, arch.color,
        Math.min(26, 6 + Math.floor(e.radius)), 300, 0.7
      );
      this.events.push({
        kind: "enemyKill",
        x: e.x,
        y: e.y,
        type: e.type,
        color: arch.color,
        radius: e.radius,
      });
      arch.onDeath?.(e, this);
      if (this.uniques.has("novaCore")) {
        this.novaQueue.push({ x: e.x, y: e.y });
      }
      // onDeath may push children; recompute position before swap-remove.
      const last = this.enemies.length - 1;
      this.enemies[i] = this.enemies[last];
      this.enemies.pop();
    }
  }

  /** Nova Core: kills detonate. Damage lands after the sweep, so chain
   *  kills cascade one step at a time instead of recursing. */
  private processNovas() {
    if (this.novaQueue.length === 0) return;
    const radius = NOVA_RADIUS * this.comboFx.novaRadiusMul;
    const damage = NOVA_DAMAGE * this.config.damageMul;
    for (const n of this.novaQueue) {
      for (const e of this.enemies) {
        if (e.grace > 0 || e.hp <= 0) continue;
        const dx = e.x - n.x;
        const dy = e.y - n.y;
        if (dx * dx + dy * dy > radius * radius) continue;
        e.hp -= damage;
        e.flash = 0.08;
      }
      if (!this.reduceParticles()) {
        this.spawnBurst(n.x, n.y, NOVA_COLOR, 12, 340, 0.5);
      }
    }
    this.novaQueue.length = 0;
  }

  private checkWaveClear() {
    if (this.phase !== "combat") return;
    if (this.spawnIndex < this.spawnPlan.length || this.enemies.length > 0) return;
    // Auto-bank any geoms still on the floor so nothing is lost to the pause.
    for (const g of this.geoms) {
      if (!g.active) continue;
      g.active = false;
      this.collectGeom(g.x, g.y);
    }
    this.phase = "reward";
    this.pendingChoices = this.rollUpgrades();
    this.events.push({ kind: "waveClear", wave: this.wave, choices: this.pendingChoices });
  }

  private rollUpgrades(): UpgradeOffer[] {
    // Rarity/pity/combo logic is pure in rarity.ts; drawing from the run
    // RNG keeps offers (and rerolls) deterministic per seed.
    const result = rollOffers({
      rng: this.rng,
      mods: this.mods,
      uniques: this.uniques,
      combos: this.combos,
      luck: luckForWave(this.wave, this.config.luck),
      pity: this.pity,
    });
    this.pity = result.pity;
    return result.offers;
  }

  /* ----- Pooled effects ----- */

  private spawnGeom(x: number, y: number) {
    for (const g of this.geoms) {
      if (g.active) continue;
      const a = this.rng() * Math.PI * 2;
      const v = 60 + this.rng() * 160;
      g.active = true;
      g.x = x;
      g.y = y;
      g.vx = Math.cos(a) * v;
      g.vy = Math.sin(a) * v;
      g.life = GEOM_LIFE;
      return;
    }
  }

  spawnBurst(
    x: number, y: number, color: string,
    count: number, speed: number, life: number
  ) {
    for (let i = 0; i < count; i++) {
      const a = this.rng() * Math.PI * 2;
      const v = speed * (0.35 + this.rng() * 0.65);
      this.spawnParticle(
        x, y,
        Math.cos(a) * v, Math.sin(a) * v,
        life * (0.5 + this.rng() * 0.5),
        1.5 + this.rng() * 2,
        color
      );
    }
  }

  private spawnParticle(
    x: number, y: number, vx: number, vy: number,
    life: number, size: number, color: string
  ) {
    for (const p of this.particles) {
      if (p.active) continue;
      p.active = true;
      this.activeParticles++;
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.life = life;
      p.maxLife = life;
      p.size = size;
      p.color = color;
      return;
    }
  }

  /** Soft cap: skip cosmetic sparks once the pool is running hot. */
  private reduceParticles(): boolean {
    return this.activeParticles > PARTICLE_POOL * 0.8;
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.activeParticles--;
        continue;
      }
      const damp = Math.exp(-2.2 * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
