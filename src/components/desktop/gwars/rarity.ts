/**
 * Rarity + fusion layer over the wave-clear reward picks. Pure data and
 * pure helpers - every roll draws from the caller's rng, so offers stay
 * deterministic per run seed and unit-testable. The stackable upgrade
 * table lives here (re-exported by engine.ts) so this module has no
 * import cycle with the engine.
 *
 * Tiers: common → rare → epic → legendary scale a stackable card's
 * potency (levels granted at once); epic+ can also deal one-time unique
 * cards. The fifth tier, combo, never rolls by weight: when the player's
 * build unlocks a fusion, one of the three slots is reserved for it.
 * Combos are additive and gated - taking one adds a fused effect on top
 * of the build and consumes nothing.
 */

import type { SoundName } from "./audio";

/* ----- Stackable upgrades (moved from engine.ts) ----- */

export type UpgradeId =
  | "fireRate"
  | "multishot"
  | "pierce"
  | "drone"
  | "shield"
  | "bomb"
  | "pickup"
  | "speed"
  | "damage"
  | "ricochet"
  | "crit"
  | "bulletSpeed";

export const UPGRADES: Record<UpgradeId, { name: string; desc: string; max: number }> = {
  fireRate: { name: "Overclock", desc: "+18% fire rate", max: 5 },
  multishot: { name: "Split Rail", desc: "+1 parallel shot", max: 3 },
  pierce: { name: "Phase Rounds", desc: "Shots pierce +1 enemy", max: 3 },
  drone: { name: "Drone Bay", desc: "+1 orbiting drone", max: 3 },
  shield: { name: "Aegis Cell", desc: "+1 recharging shield", max: 2 },
  bomb: { name: "Warhead", desc: "+1 bomb, right now", max: 9 },
  pickup: { name: "Tractor Field", desc: "Wider geom magnet", max: 4 },
  speed: { name: "Ion Thrusters", desc: "+12% move speed", max: 4 },
  damage: { name: "Hot Load", desc: "+25% bullet damage", max: 5 },
  ricochet: { name: "Wall Runners", desc: "Shots bounce off walls +1", max: 3 },
  crit: { name: "Overcharge", desc: "+10% crit chance (x3 dmg)", max: 4 },
  bulletSpeed: { name: "Rail Coils", desc: "+15% bullet speed", max: 3 },
};

/* ----- Rarity tiers ----- */

export type Rarity = "common" | "rare" | "epic" | "legendary" | "combo";
/** The four tiers that roll by weight; combo has its own slot rule. */
export type StandardRarity = Exclude<Rarity, "combo">;

export const RARITY: Record<
  Rarity,
  {
    label: string;
    color: string;
    /** Levels granted to a stackable upgrade (combo/unique ignore). */
    potency: number;
    /** Pre-luck roll weight (combo excluded - see the slot rule). */
    baseWeight: number;
    sound: SoundName;
  }
> = {
  common: { label: "Common", color: "#9aa4b2", potency: 1, baseWeight: 62, sound: "revealCommon" },
  rare: { label: "Rare", color: "#4aa3ff", potency: 2, baseWeight: 26, sound: "revealRare" },
  epic: { label: "Epic", color: "#b06bff", potency: 3, baseWeight: 9, sound: "revealEpic" },
  legendary: { label: "Legendary", color: "#ffb020", potency: 4, baseWeight: 3, sound: "revealLegendary" },
  combo: { label: "Combo", color: "#ff5cf0", potency: 0, baseWeight: 0, sound: "revealCombo" },
};

const STANDARD: StandardRarity[] = ["common", "rare", "epic", "legendary"];

/** How strongly luck inflates each tier's weight (common deflates). */
const LUCK_RAMP: Record<StandardRarity, number> = {
  common: 0,
  rare: 0.8,
  epic: 1.6,
  legendary: 2.4,
};

/* ----- Uniques: one-time build-defining cards, epic+ only ----- */

export type UniqueId =
  | "novaCore"
  | "blackHole"
  | "vengeance"
  | "overflow"
  | "seekerRounds"
  | "arcReactor"
  | "aftCannon"
  | "sawOrbitals";

export const UNIQUES: Record<
  UniqueId,
  { name: string; desc: string; rarity: "epic" | "legendary" }
> = {
  novaCore: {
    name: "Nova Core",
    desc: "Every kill detonates a damaging nova",
    rarity: "legendary",
  },
  blackHole: {
    name: "Black Hole",
    desc: "A gravity well opens periodically, dragging enemies in",
    rarity: "legendary",
  },
  vengeance: {
    name: "Vengeance Field",
    desc: "Taking a hit releases a damaging shockwave",
    rarity: "epic",
  },
  overflow: {
    name: "Overflow",
    desc: "Every 5th volley becomes a piercing mega-bolt",
    rarity: "epic",
  },
  seekerRounds: {
    name: "Seeker Rounds",
    desc: "Bullets curve toward the nearest enemy",
    rarity: "epic",
  },
  arcReactor: {
    name: "Arc Reactor",
    desc: "Kills arc chain lightning to nearby enemies",
    rarity: "legendary",
  },
  aftCannon: {
    name: "Aft Cannon",
    desc: "Every volley also fires backward",
    rarity: "epic",
  },
  sawOrbitals: {
    name: "Saw Orbitals",
    desc: "Two blades orbit you, shredding contact",
    rarity: "legendary",
  },
};

/* ----- Combos: additive, gated fusions ----- */

export type ComboId =
  | "lanceArray"
  | "meltdown"
  | "swarmBay"
  | "magnetar"
  | "pinball"
  | "executioner"
  | "missileSwarm"
  | "teslaCage";

/**
 * The fused-effect knobs a combo mutates. The engine owns one instance
 * and reads it in the sim; applying a combo only ever adds on top -
 * component upgrade levels are never touched.
 */
export type ComboEffects = {
  /** Bullets pierce everything (lanceArray). */
  infinitePierce: boolean;
  /** Multiplier on lane offsets + spread angles; < 1 is tighter. */
  laneSpreadMul: number;
  fireRateMul: number;
  damageMul: number;
  /** Bullets per drone volley (1 = single shot). */
  droneShots: number;
  /** The tractor field also drags enemies toward the player. */
  enemyDrag: boolean;
  novaRadiusMul: number;
  /** Crit damage multiplier (base 3; executioner raises it). */
  critMul: number;
  /** Homing turn-rate multiplier (missileSwarm raises it). */
  homingStrength: number;
  /** Chain-lightning jumps per kill (teslaCage raises it). */
  chainJumps: number;
  /** Per-bounce bullet speed-up (pinball); 1 = no change. */
  bounceSpeedMul: number;
};

export function defaultComboEffects(): ComboEffects {
  return {
    infinitePierce: false,
    laneSpreadMul: 1,
    fireRateMul: 1,
    damageMul: 1,
    droneShots: 1,
    enemyDrag: false,
    novaRadiusMul: 1,
    critMul: 3,
    homingStrength: 1,
    chainJumps: 3,
    bounceSpeedMul: 1,
  };
}

export const COMBOS: Record<
  ComboId,
  {
    name: string;
    desc: string;
    /** Min stackable levels / owned uniques (uniques count as 1). */
    requires: Partial<Record<UpgradeId | UniqueId, number>>;
    /** Additive fused effect; never reduces component levels. */
    apply: (fx: ComboEffects) => void;
  }
> = {
  lanceArray: {
    name: "Lance Array",
    desc: "All lanes pierce infinitely in a tighter spread",
    requires: { multishot: 2, pierce: 2 },
    apply(fx) {
      fx.infinitePierce = true;
      fx.laneSpreadMul *= 0.6;
    },
  },
  meltdown: {
    name: "Meltdown",
    desc: "The reactor spikes: big fire rate and damage",
    requires: { fireRate: 3, damage: 3 },
    apply(fx) {
      fx.fireRateMul *= 1.35;
      fx.damageMul *= 1.35;
    },
  },
  swarmBay: {
    name: "Swarm Bay",
    desc: "Drones fire a 3-way spread",
    requires: { drone: 2, multishot: 2 },
    apply(fx) {
      fx.droneShots = Math.max(fx.droneShots, 3);
    },
  },
  magnetar: {
    name: "Magnetar",
    desc: "The tractor field drags enemies inward; bigger novas",
    requires: { pickup: 2, novaCore: 1 },
    apply(fx) {
      fx.enemyDrag = true;
      fx.novaRadiusMul *= 1.5;
    },
  },
  pinball: {
    name: "Pinball",
    desc: "Bounces keep pierce and speed shots up",
    requires: { ricochet: 2, pierce: 2 },
    apply(fx) {
      fx.bounceSpeedMul *= 1.15;
    },
  },
  executioner: {
    name: "Executioner",
    desc: "Crits hit for x5 with a shockwave",
    requires: { crit: 2, damage: 3 },
    apply(fx) {
      fx.critMul = Math.max(fx.critMul, 5);
    },
  },
  missileSwarm: {
    name: "Missile Swarm",
    desc: "Homing turns aggressive; lanes fan wide",
    requires: { seekerRounds: 1, multishot: 2 },
    apply(fx) {
      fx.homingStrength *= 2.2;
      fx.laneSpreadMul *= 1.4;
    },
  },
  teslaCage: {
    name: "Tesla Cage",
    desc: "Chain lightning jumps far more often",
    requires: { arcReactor: 1, fireRate: 3 },
    apply(fx) {
      fx.chainJumps = Math.max(fx.chainJumps, 5);
    },
  },
};

/** Combos whose requirements are met and that aren't owned yet. */
export function availableCombos(
  mods: Record<UpgradeId, number>,
  uniques: ReadonlySet<UniqueId>,
  owned: ReadonlySet<ComboId>
): ComboId[] {
  const out: ComboId[] = [];
  for (const id of Object.keys(COMBOS) as ComboId[]) {
    if (owned.has(id)) continue;
    const requires = COMBOS[id].requires;
    let met = true;
    for (const key of Object.keys(requires) as (UpgradeId | UniqueId)[]) {
      const need = requires[key] ?? 0;
      const have =
        key in UNIQUES ? (uniques.has(key as UniqueId) ? 1 : 0) : mods[key as UpgradeId];
      if (have < need) {
        met = false;
        break;
      }
    }
    if (met) out.push(id);
  }
  return out;
}

/* ----- Offers ----- */

/** A single card the reward screen renders. */
export type UpgradeOffer =
  | { kind: "stackable"; id: UpgradeId; rarity: StandardRarity; potency: number }
  | { kind: "unique"; id: UniqueId; rarity: "epic" | "legendary" }
  | { kind: "combo"; id: ComboId; rarity: "combo" };

/**
 * Rolls without an epic-or-better offer before one is forced. Pity
 * resets whenever an epic+ card is *offered* (taking it not required),
 * and ticks per roll - rerolls included.
 */
export const PITY_THRESHOLD = 6;

const LUCK_WAVE_RATE = 0.05;
const LUCK_WAVE_CAP = 0.75;

/** Run luck: a capped per-wave ramp plus the permanent meta stat. */
export function luckForWave(wave: number, metaLuck: number): number {
  return Math.min(LUCK_WAVE_CAP, (wave - 1) * LUCK_WAVE_RATE) + metaLuck;
}

/** Weighted tier roll; luck inflates high tiers and deflates common. */
export function rollRarity(
  rng: () => number,
  luck: number,
  min: StandardRarity = "common"
): StandardRarity {
  const from = STANDARD.indexOf(min);
  let total = 0;
  const weights: number[] = [];
  for (let i = from; i < STANDARD.length; i++) {
    const r = STANDARD[i];
    const base = RARITY[r].baseWeight;
    const w = r === "common" ? base / (1 + luck) : base * (1 + LUCK_RAMP[r] * luck);
    weights.push(w);
    total += w;
  }
  let roll = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return STANDARD[from + i];
  }
  return STANDARD[STANDARD.length - 1];
}

export type OfferContext = {
  rng: () => number;
  mods: Record<UpgradeId, number>;
  uniques: ReadonlySet<UniqueId>;
  combos: ReadonlySet<ComboId>;
  luck: number;
  pity: number;
};

function roomFor(mods: Record<UpgradeId, number>, id: UpgradeId): number {
  // Bombs are consumable, so a big grant is never wasted.
  return id === "bomb" ? Infinity : UPGRADES[id].max - mods[id];
}

/** Step the tier down until its potency fits the remaining room. */
function fitRarity(rarity: StandardRarity, room: number): StandardRarity {
  let i = STANDARD.indexOf(rarity);
  while (i > 0 && RARITY[STANDARD[i]].potency > room) i--;
  return STANDARD[i];
}

function isEpicPlus(offer: UpgradeOffer): boolean {
  if (offer.kind !== "stackable") return true;
  return offer.rarity === "epic" || offer.rarity === "legendary";
}

/** Pick one card for a slot whose tier already rolled. */
function pickCard(
  ctx: OfferContext,
  rarity: StandardRarity,
  used: Set<string>,
  holdTier: boolean
): UpgradeOffer {
  const pool: (UpgradeId | UniqueId)[] = [];
  for (const id of Object.keys(UPGRADES) as UpgradeId[]) {
    if (used.has(id)) continue;
    if (id !== "bomb" && ctx.mods[id] >= UPGRADES[id].max) continue;
    pool.push(id);
  }
  if (rarity === "epic" || rarity === "legendary") {
    for (const id of Object.keys(UNIQUES) as UniqueId[]) {
      if (used.has(id) || ctx.uniques.has(id)) continue;
      if (UNIQUES[id].rarity === rarity) pool.push(id);
    }
  }

  // A pity-forced tier should land at full strength when it can: prefer
  // cards with enough room instead of downgrading the guarantee away.
  let candidates = pool;
  if (holdTier) {
    const full = pool.filter(
      (id) => id in UNIQUES || roomFor(ctx.mods, id as UpgradeId) >= RARITY[rarity].potency
    );
    if (full.length > 0) candidates = full;
  }

  if (candidates.length === 0) {
    // Pool exhausted: pad with a bomb, mirroring the pre-rarity rule.
    return { kind: "stackable", id: "bomb", rarity, potency: RARITY[rarity].potency };
  }

  const picked = candidates[Math.floor(ctx.rng() * candidates.length)];
  used.add(picked);
  if (picked in UNIQUES) {
    const id = picked as UniqueId;
    return { kind: "unique", id, rarity: UNIQUES[id].rarity };
  }
  const id = picked as UpgradeId;
  const fitted = fitRarity(rarity, roomFor(ctx.mods, id));
  return { kind: "stackable", id, rarity: fitted, potency: RARITY[fitted].potency };
}

/**
 * Deal the three wave-clear cards. When a combo is unlocked, one slot is
 * reserved for it (the jackpot is never missable); the rest roll a tier
 * by luck-scaled weight, then a card. Returns the next pity counter.
 */
export function rollOffers(ctx: OfferContext): { offers: UpgradeOffer[]; pity: number } {
  const offers: (UpgradeOffer | null)[] = [null, null, null];
  const used = new Set<string>();

  const unlocked = availableCombos(ctx.mods, ctx.uniques, ctx.combos);
  if (unlocked.length > 0) {
    const slot = Math.floor(ctx.rng() * offers.length);
    const id = unlocked[Math.floor(ctx.rng() * unlocked.length)];
    offers[slot] = { kind: "combo", id, rarity: "combo" };
  }

  // The pity guarantee lands on the first normally rolled slot.
  let forceEpic = ctx.pity >= PITY_THRESHOLD;
  for (let slot = 0; slot < offers.length; slot++) {
    if (offers[slot]) continue;
    const rarity = rollRarity(ctx.rng, ctx.luck, forceEpic ? "epic" : "common");
    offers[slot] = pickCard(ctx, rarity, used, forceEpic);
    forceEpic = false;
  }

  const dealt = offers as UpgradeOffer[];
  return { offers: dealt, pity: dealt.some(isEpicPlus) ? 0 : ctx.pity + 1 };
}
