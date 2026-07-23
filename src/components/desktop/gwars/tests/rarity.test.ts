/**
 * Unit tests for the pure rarity/offer helpers: tier weighting under
 * luck, pity guarantees, room-aware downgrades, combo gating, and
 * deterministic rolls under a fixed seed.
 */

import { describe, expect, it } from "vitest";

import { mulberry32, UPGRADES, type UpgradeId } from "../engine";
import {
  COMBOS,
  PITY_THRESHOLD,
  RARITY,
  UNIQUES,
  availableCombos,
  defaultComboEffects,
  luckForWave,
  rollOffers,
  rollRarity,
  type ComboId,
  type OfferContext,
  type UniqueId,
  type UpgradeOffer,
} from "../rarity";

function freshMods(overrides: Partial<Record<UpgradeId, number>> = {}) {
  const mods: Record<UpgradeId, number> = {
    fireRate: 0,
    multishot: 0,
    pierce: 0,
    drone: 0,
    shield: 0,
    bomb: 0,
    pickup: 0,
    speed: 0,
    damage: 0,
    ricochet: 0,
    crit: 0,
    bulletSpeed: 0,
  };
  return { ...mods, ...overrides };
}

function ctx(overrides: Partial<OfferContext> = {}): OfferContext {
  return {
    rng: mulberry32(42),
    mods: freshMods(),
    uniques: new Set<UniqueId>(),
    combos: new Set<ComboId>(),
    luck: 0,
    pity: 0,
    ...overrides,
  };
}

function isEpicPlus(offer: UpgradeOffer): boolean {
  if (offer.kind === "combo" || offer.kind === "unique") return true;
  return offer.rarity === "epic" || offer.rarity === "legendary";
}

describe("RARITY table", () => {
  it("grants 1..4 levels from common to legendary", () => {
    expect(RARITY.common.potency).toBe(1);
    expect(RARITY.rare.potency).toBe(2);
    expect(RARITY.epic.potency).toBe(3);
    expect(RARITY.legendary.potency).toBe(4);
  });
});

describe("rollRarity", () => {
  it("shifts weight toward high tiers as luck rises", () => {
    const count = (luck: number) => {
      const rng = mulberry32(7);
      const tally = { common: 0, rare: 0, epic: 0, legendary: 0 };
      for (let i = 0; i < 4000; i++) tally[rollRarity(rng, luck)]++;
      return tally;
    };
    const low = count(0);
    const high = count(1.5);
    expect(high.common).toBeLessThan(low.common);
    expect(high.legendary).toBeGreaterThan(low.legendary);
    expect(high.epic).toBeGreaterThan(low.epic);
  });

  it("never returns below epic when a minimum is forced", () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 500; i++) {
      const r = rollRarity(rng, 0, "epic");
      expect(r === "epic" || r === "legendary").toBe(true);
    }
  });
});

describe("luckForWave", () => {
  it("ramps with wave and adds meta luck", () => {
    expect(luckForWave(1, 0)).toBe(0);
    expect(luckForWave(10, 0)).toBeGreaterThan(luckForWave(2, 0));
    expect(luckForWave(1, 0.3)).toBeCloseTo(0.3);
    // Wave ramp is capped so late waves don't trivialize the roll.
    expect(luckForWave(500, 0)).toBe(luckForWave(1000, 0));
  });
});

describe("rollOffers", () => {
  it("always deals exactly 3 offers", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { offers } = rollOffers(ctx({ rng: mulberry32(seed) }));
      expect(offers).toHaveLength(3);
    }
  });

  it("is deterministic for a fixed seed", () => {
    const a = rollOffers(ctx({ rng: mulberry32(99) }));
    const b = rollOffers(ctx({ rng: mulberry32(99) }));
    expect(a).toEqual(b);
  });

  it("never repeats the same non-bomb card in one deal", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { offers } = rollOffers(ctx({ rng: mulberry32(seed), luck: 1 }));
      const ids = offers
        .map((o) => o.id as string)
        .filter((id) => id !== "bomb");
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("excludes maxed stackables from the pool", () => {
    const mods = freshMods();
    for (const id of Object.keys(UPGRADES) as UpgradeId[]) {
      if (id !== "bomb") mods[id] = UPGRADES[id].max;
    }
    for (let seed = 1; seed <= 20; seed++) {
      const { offers } = rollOffers(ctx({ rng: mulberry32(seed), mods }));
      for (const o of offers) {
        if (o.kind === "stackable") expect(o.id).toBe("bomb");
      }
    }
  });

  it("downgrades rarity so potency never overflows remaining room", () => {
    // fireRate at 4/5 has 1 level of room: only common may be offered.
    const mods = freshMods({ fireRate: 4 });
    for (let seed = 1; seed <= 80; seed++) {
      const { offers } = rollOffers(
        ctx({ rng: mulberry32(seed), mods, luck: 2 })
      );
      for (const o of offers) {
        if (o.kind === "stackable" && o.id !== "bomb") {
          expect(o.potency).toBeLessThanOrEqual(UPGRADES[o.id].max - mods[o.id]);
        }
      }
    }
  });

  it("guarantees an epic+ offer once pity hits the threshold", () => {
    // An rng pinned low always rolls common, so only pity can rescue us.
    const lowRng = () => 0.0001;
    let pity = 0;
    let sawEpicPlus = false;
    for (let roll = 0; roll <= PITY_THRESHOLD; roll++) {
      const result = rollOffers(ctx({ rng: lowRng, pity }));
      pity = result.pity;
      if (result.offers.some(isEpicPlus)) {
        sawEpicPlus = true;
        break;
      }
    }
    expect(sawEpicPlus).toBe(true);
  });

  it("resets pity when an epic+ card is offered", () => {
    const lowRng = () => 0.0001;
    const forced = rollOffers(ctx({ rng: lowRng, pity: PITY_THRESHOLD }));
    expect(forced.offers.some(isEpicPlus)).toBe(true);
    expect(forced.pity).toBe(0);
  });

  it("counts rolls without epic+ toward pity", () => {
    const lowRng = () => 0.0001;
    const { pity } = rollOffers(ctx({ rng: lowRng, pity: 2 }));
    expect(pity).toBe(3);
  });

  it("only offers uniques at epic or legendary rarity", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { offers } = rollOffers(ctx({ rng: mulberry32(seed), luck: 2 }));
      for (const o of offers) {
        if (o.kind === "unique") {
          expect(o.rarity === "epic" || o.rarity === "legendary").toBe(true);
          expect(UNIQUES[o.id].rarity).toBe(o.rarity);
        }
      }
    }
  });

  it("never re-offers an owned unique", () => {
    const owned = new Set<UniqueId>(Object.keys(UNIQUES) as UniqueId[]);
    for (let seed = 1; seed <= 100; seed++) {
      const { offers } = rollOffers(
        ctx({ rng: mulberry32(seed), uniques: owned, luck: 3 })
      );
      expect(offers.some((o) => o.kind === "unique")).toBe(false);
    }
  });

  it("reserves exactly one slot for a combo when one is unlocked", () => {
    const mods = freshMods({ multishot: 2, pierce: 2 });
    for (let seed = 1; seed <= 40; seed++) {
      const { offers } = rollOffers(ctx({ rng: mulberry32(seed), mods }));
      expect(offers.filter((o) => o.kind === "combo")).toHaveLength(1);
    }
  });

  it("offers no combo before requirements are met or after it is owned", () => {
    const noReq = rollOffers(ctx({ rng: mulberry32(5) }));
    expect(noReq.offers.some((o) => o.kind === "combo")).toBe(false);

    const mods = freshMods({ multishot: 2, pierce: 2 });
    const owned = new Set<ComboId>(["lanceArray"]);
    for (let seed = 1; seed <= 40; seed++) {
      const { offers } = rollOffers(
        ctx({ rng: mulberry32(seed), mods, combos: owned })
      );
      expect(offers.some((o) => o.kind === "combo")).toBe(false);
    }
  });
});

describe("availableCombos", () => {
  it("gates on stackable levels and unique flags", () => {
    expect(availableCombos(freshMods(), new Set(), new Set())).toEqual([]);
    expect(
      availableCombos(freshMods({ multishot: 2, pierce: 2 }), new Set(), new Set())
    ).toContain("lanceArray");
    // Magnetar needs both a stackable level and an owned unique.
    expect(
      availableCombos(freshMods({ pickup: 2 }), new Set(), new Set())
    ).not.toContain("magnetar");
    expect(
      availableCombos(
        freshMods({ pickup: 2 }),
        new Set<UniqueId>(["novaCore"]),
        new Set()
      )
    ).toContain("magnetar");
  });

  it("excludes combos already owned", () => {
    const mods = freshMods({ fireRate: 3, damage: 3 });
    expect(
      availableCombos(mods, new Set(), new Set<ComboId>(["meltdown"]))
    ).not.toContain("meltdown");
  });
});

describe("COMBOS.apply", () => {
  it("fuses additively onto the effect knobs", () => {
    const fx = defaultComboEffects();
    COMBOS.meltdown.apply(fx);
    expect(fx.fireRateMul).toBeGreaterThan(1);
    expect(fx.damageMul).toBeGreaterThan(1);
    COMBOS.lanceArray.apply(fx);
    expect(fx.infinitePierce).toBe(true);
    expect(fx.laneSpreadMul).toBeLessThan(1);
  });
});
