import { describe, expect, it } from "vitest";

import { spawnPlanForWave, ARCHETYPES } from "../enemies";
import { mulberry32 } from "../engine";

describe("spawn density", () => {
  it("late non-boss waves spawn many more enemies than early ones", () => {
    const early = spawnPlanForWave(3, mulberry32(42));
    const late = spawnPlanForWave(13, mulberry32(42));
    expect(late.length).toBeGreaterThan(early.length * 2);
  });

  it("wave 12 fields a genuinely dense plan", () => {
    const plan = spawnPlanForWave(12, mulberry32(7));
    expect(plan.length).toBeGreaterThanOrEqual(40);
  });
});

describe("composition bias", () => {
  it("late waves field a higher share of tough archetypes than early waves", () => {
    const toughness = (plan: { type: keyof typeof ARCHETYPES }[]) =>
      plan.reduce((s, p) => s + ARCHETYPES[p.type].hp, 0) / plan.length;
    const early = spawnPlanForWave(6, mulberry32(99));
    const late = spawnPlanForWave(14, mulberry32(99));
    expect(toughness(late)).toBeGreaterThan(toughness(early));
  });
});
