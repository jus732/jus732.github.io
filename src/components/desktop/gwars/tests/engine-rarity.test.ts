/**
 * Engine integration tests for the rarity system: potency application
 * with max clamping, additive combo fusion, unique flags, and reroll
 * behavior under a fixed seed.
 */

import { describe, expect, it } from "vitest";

import { GwarsEngine, UPGRADES } from "../engine";
import { defaultMeta, buildRunConfig } from "../meta";
import {
  availableCombos,
  defaultComboEffects,
  COMBOS,
  type UpgradeId,
  type UpgradeOffer,
} from "../rarity";

/** A zeroed mods map covering every UpgradeId. */
function zeroMods(): Record<UpgradeId, number> {
  return {
    fireRate: 0, multishot: 0, pierce: 0, drone: 0, shield: 0, bomb: 0,
    pickup: 0, speed: 0, damage: 0, ricochet: 0, crit: 0, bulletSpeed: 0,
  };
}

function makeEngine(seed = 1234) {
  return new GwarsEngine(900, 640, buildRunConfig(defaultMeta(), seed));
}

/** Put the engine on a reward screen with a hand-rolled offer. */
function offerTo(engine: GwarsEngine, offer: UpgradeOffer) {
  engine.phase = "reward";
  engine.pendingChoices = [offer];
  return offer;
}

describe("chooseUpgrade with rarity offers", () => {
  it("applies the rarity's potency in levels", () => {
    const engine = makeEngine();
    const offer = offerTo(engine, {
      kind: "stackable",
      id: "fireRate",
      rarity: "epic",
      potency: 3,
    });
    engine.chooseUpgrade(offer);
    expect(engine.mods.fireRate).toBe(3);
    expect(engine.phase).toBe("combat");
  });

  it("clamps potency to the upgrade's max", () => {
    const engine = makeEngine();
    engine.mods.speed = 3; // max 4: one level of room
    const offer = offerTo(engine, {
      kind: "stackable",
      id: "speed",
      rarity: "legendary",
      potency: 4,
    });
    engine.chooseUpgrade(offer);
    expect(engine.mods.speed).toBe(UPGRADES.speed.max);
  });

  it("grants bombs equal to potency", () => {
    const engine = makeEngine();
    const before = engine.bombs;
    const offer = offerTo(engine, {
      kind: "stackable",
      id: "bomb",
      rarity: "rare",
      potency: 2,
    });
    engine.chooseUpgrade(offer);
    expect(engine.bombs).toBe(before + 2);
  });

  it("sets the unique flag once and re-syncs nothing else", () => {
    const engine = makeEngine();
    const offer = offerTo(engine, {
      kind: "unique",
      id: "novaCore",
      rarity: "legendary",
    });
    engine.chooseUpgrade(offer);
    expect(engine.uniques.has("novaCore")).toBe(true);
  });

  it("applies a combo additively without touching component levels", () => {
    const engine = makeEngine();
    engine.mods.multishot = 2;
    engine.mods.pierce = 2;
    const offer = offerTo(engine, { kind: "combo", id: "lanceArray", rarity: "combo" });
    engine.chooseUpgrade(offer);
    expect(engine.combos.has("lanceArray")).toBe(true);
    expect(engine.mods.multishot).toBe(2);
    expect(engine.mods.pierce).toBe(2);
    expect(engine.comboFx.infinitePierce).toBe(true);
  });

  it("ignores offers that were not dealt", () => {
    const engine = makeEngine();
    offerTo(engine, { kind: "stackable", id: "speed", rarity: "common", potency: 1 });
    engine.chooseUpgrade({ kind: "stackable", id: "damage", rarity: "common", potency: 1 });
    expect(engine.mods.damage).toBe(0);
    expect(engine.phase).toBe("reward");
  });
});

describe("rerolls", () => {
  it("redeals deterministically and consumes a charge", () => {
    const a = makeEngine(777);
    const b = makeEngine(777);
    for (const e of [a, b]) {
      e.phase = "reward";
      e.pendingChoices = [];
      expect(e.rerollOffers()).toBe(true);
    }
    expect(a.rerolls).toBe(b.rerolls);
    expect(a.pendingChoices).toEqual(b.pendingChoices);
    expect(a.pendingChoices).toHaveLength(3);
  });

  it("refuses without charges or outside the reward phase", () => {
    const engine = makeEngine();
    engine.rerolls = 0;
    engine.phase = "reward";
    expect(engine.rerollOffers()).toBe(false);
    engine.rerolls = 1;
    engine.phase = "combat";
    expect(engine.rerollOffers()).toBe(false);
  });

  it("banks one extra reroll every third wave, up to the cap", () => {
    const engine = makeEngine();
    const start = engine.rerolls;
    engine.wave = 3;
    engine.chooseUpgrade(
      offerTo(engine, { kind: "stackable", id: "speed", rarity: "common", potency: 1 })
    );
    expect(engine.rerolls).toBe(start + 1);

    engine.wave = 4;
    engine.chooseUpgrade(
      offerTo(engine, { kind: "stackable", id: "speed", rarity: "common", potency: 1 })
    );
    expect(engine.rerolls).toBe(start + 1); // wave 4 banks nothing
  });
});

describe("new combos", () => {
  it("offers Executioner once crit 2 + damage 3 are met", () => {
    const mods = { ...zeroMods(), damage: 3, crit: 2 };
    const combos = availableCombos(mods, new Set(), new Set());
    expect(combos).toContain("executioner");
  });

  it("Executioner raises crit multiplier to 5", () => {
    const fx = defaultComboEffects();
    COMBOS.executioner.apply(fx);
    expect(fx.critMul).toBe(5);
  });

  it("Tesla Cage requires arcReactor + fireRate 3", () => {
    const mods = { ...zeroMods(), fireRate: 3 };
    const withUnique = availableCombos(mods, new Set(["arcReactor"]), new Set());
    expect(withUnique).toContain("teslaCage");
    const withoutUnique = availableCombos(mods, new Set(), new Set());
    expect(withoutUnique).not.toContain("teslaCage");
  });

  it("Pinball needs ricochet 2 + pierce 2 and speeds bounces up", () => {
    const mods = { ...zeroMods(), ricochet: 2, pierce: 2 };
    expect(availableCombos(mods, new Set(), new Set())).toContain("pinball");
    const fx = defaultComboEffects();
    COMBOS.pinball.apply(fx);
    expect(fx.bounceSpeedMul).toBeGreaterThan(1);
  });
});
