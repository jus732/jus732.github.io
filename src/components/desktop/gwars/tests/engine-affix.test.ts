import { describe, expect, it } from "vitest";

import { GwarsEngine } from "../engine";
import { defaultMeta, buildRunConfig } from "../meta";
import { rollAffix, AFFIXES } from "../enemies";

function makeEngine(seed = 1234) {
  return new GwarsEngine(900, 640, buildRunConfig(defaultMeta(), seed));
}

describe("elite chance ramp", () => {
  it("is zero before wave 4 and ramps toward ~0.2 by wave 15", () => {
    const engine = makeEngine();
    expect(engine.eliteChanceForWave(3)).toBe(0);
    expect(engine.eliteChanceForWave(4)).toBeGreaterThan(0);
    expect(engine.eliteChanceForWave(15)).toBeGreaterThanOrEqual(0.19);
    expect(engine.eliteChanceForWave(15)).toBeLessThanOrEqual(0.21);
  });
});

describe("rollAffix", () => {
  it("returns a known affix id", () => {
    let a = 5;
    const rng = () => (a = (a * 48271) % 2147483647) / 2147483647;
    const id = rollAffix(rng);
    expect(id in AFFIXES).toBe(true);
  });
});
