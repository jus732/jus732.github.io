/**
 * Cross-run meta-progression: cores (currency), permanent tiered
 * upgrades, unlocked ships, difficulty preference, and best-run stats.
 * Pure load/save/reset over one localStorage key, guarded for SSR, plus
 * the builder that folds meta + ship + difficulty into a RunConfig.
 */

import type { RunConfig } from "./engine";
import { SHIPS, type ShipId } from "./weapons";

export const META_KEY = "portfolio-gwars";

export type MetaUpgradeId =
  | "lives"
  | "damage"
  | "fireRate"
  | "speed"
  | "pickup"
  | "multiplier"
  | "bombs"
  | "luck"
  | "reroll";

export type Difficulty = "normal" | "easy";

export type MetaState = {
  cores: number;
  upgrades: Record<MetaUpgradeId, number>;
  unlockedShips: ShipId[];
  selectedShip: ShipId;
  best: { score: number; wave: number; kills: number };
  totalKills: number;
  totalRuns: number;
  difficulty: Difficulty;
  /** Easy-mode starting lives; 0 means infinite. */
  easyLives: number;
  /** Master SFX volume, 0..1. */
  volume: number;
};

/** Permanent shop upgrades; costs.length is the max level. */
export const META_UPGRADES: Record<
  MetaUpgradeId,
  { name: string; desc: string; costs: number[] }
> = {
  lives: {
    name: "Backup Hull",
    desc: "+1 life every run",
    costs: [150, 400, 900],
  },
  damage: {
    name: "Ordnance",
    desc: "+10% bullet damage",
    costs: [100, 250, 500, 900, 1500],
  },
  fireRate: {
    name: "Autoloader",
    desc: "+8% fire rate",
    costs: [100, 250, 500, 900, 1500],
  },
  speed: {
    name: "Vector Coils",
    desc: "+6% move speed",
    costs: [120, 300, 650, 1200],
  },
  pickup: {
    name: "Magnet Array",
    desc: "Wider geom pickup",
    costs: [80, 200, 450, 800],
  },
  multiplier: {
    name: "Head Start",
    desc: "+1 starting multiplier",
    costs: [200, 500, 1000, 1800, 3000],
  },
  bombs: {
    name: "Bomb Rack",
    desc: "+1 starting bomb",
    costs: [150, 400, 900],
  },
  luck: {
    name: "Probability Coil",
    desc: "Rarer reward cards",
    costs: [150, 400, 900],
  },
  reroll: {
    name: "Mulligan Cache",
    desc: "+1 reward reroll per run",
    costs: [250, 700],
  },
};

export function defaultMeta(): MetaState {
  return {
    cores: 0,
    upgrades: {
      lives: 0,
      damage: 0,
      fireRate: 0,
      speed: 0,
      pickup: 0,
      multiplier: 0,
      bombs: 0,
      luck: 0,
      reroll: 0,
    },
    unlockedShips: ["vanguard"],
    selectedShip: "vanguard",
    best: { score: 0, wave: 0, kills: 0 },
    totalKills: 0,
    totalRuns: 0,
    difficulty: "normal",
    easyLives: 3,
    volume: 0.4,
  };
}

export function loadMeta(): MetaState {
  const meta = defaultMeta();
  if (typeof window === "undefined") return meta;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(META_KEY) ?? "{}");
    if (typeof parsed !== "object" || parsed === null) return meta;
    if (typeof parsed.cores === "number") meta.cores = Math.max(0, parsed.cores);
    for (const id of Object.keys(meta.upgrades) as MetaUpgradeId[]) {
      const level = parsed.upgrades?.[id];
      if (typeof level === "number") {
        meta.upgrades[id] = Math.min(META_UPGRADES[id].costs.length, Math.max(0, level));
      }
    }
    if (Array.isArray(parsed.unlockedShips)) {
      for (const id of parsed.unlockedShips) {
        if (id in SHIPS && !meta.unlockedShips.includes(id)) {
          meta.unlockedShips.push(id);
        }
      }
    }
    if (meta.unlockedShips.includes(parsed.selectedShip)) {
      meta.selectedShip = parsed.selectedShip;
    }
    if (typeof parsed.best?.score === "number") meta.best.score = parsed.best.score;
    if (typeof parsed.best?.wave === "number") meta.best.wave = parsed.best.wave;
    if (typeof parsed.best?.kills === "number") meta.best.kills = parsed.best.kills;
    if (typeof parsed.totalKills === "number") meta.totalKills = parsed.totalKills;
    if (typeof parsed.totalRuns === "number") meta.totalRuns = parsed.totalRuns;
    if (parsed.difficulty === "easy") meta.difficulty = "easy";
    if ([0, 3, 5].includes(parsed.easyLives)) meta.easyLives = parsed.easyLives;
    if (typeof parsed.volume === "number" && Number.isFinite(parsed.volume)) {
      meta.volume = Math.min(1, Math.max(0, parsed.volume));
    } else if (parsed.muted === true) {
      meta.volume = 0; // migrate the old mute toggle
    }
    return meta;
  } catch {
    return meta;
  }
}

export function saveMeta(meta: MetaState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Storage full or blocked; progression just won't persist.
  }
}

export function resetMeta(): MetaState {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(META_KEY);
    } catch {
      // ignore
    }
  }
  return defaultMeta();
}

/** Fold meta upgrades + selected ship + difficulty into engine config. */
export function buildRunConfig(meta: MetaState, seed?: number): RunConfig {
  const ship = SHIPS[meta.selectedShip] ?? SHIPS.vanguard;
  const up = meta.upgrades;
  const baseLives =
    meta.difficulty === "easy"
      ? meta.easyLives === 0
        ? Infinity
        : meta.easyLives
      : 1;
  return {
    ship,
    lives: baseLives + up.lives,
    bombs: 1 + up.bombs,
    damageMul: 1 + 0.1 * up.damage,
    fireRateMul: 1 + 0.08 * up.fireRate,
    speedMul: 1 + 0.06 * up.speed,
    pickupRadius: 70 + 25 * up.pickup,
    startMultiplier: 1 + up.multiplier,
    luck: 0.15 * up.luck,
    rerolls: 1 + up.reroll,
    seed,
  };
}
