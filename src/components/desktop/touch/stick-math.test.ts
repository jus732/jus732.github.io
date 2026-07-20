/**
 * Unit tests for the virtual-stick deflection math: clamping, linear
 * scaling inside the ring, and direction preservation.
 */

import { describe, expect, it } from "vitest";

import { stickVector } from "./stick-math";

describe("stickVector", () => {
  it("returns zero at the origin", () => {
    expect(stickVector(0, 0, 56)).toEqual({ x: 0, y: 0 });
  });

  it("scales linearly inside the radius", () => {
    const v = stickVector(28, 0, 56);
    expect(v.x).toBeCloseTo(0.5);
    expect(v.y).toBeCloseTo(0);
  });

  it("clamps magnitude to 1 outside the radius", () => {
    const v = stickVector(0, 300, 56);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(1);
  });

  it("preserves direction on diagonals", () => {
    const v = stickVector(100, 100, 56);
    expect(v.x).toBeCloseTo(Math.SQRT1_2);
    expect(v.y).toBeCloseTo(Math.SQRT1_2);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
  });

  it("guards a non-positive radius", () => {
    expect(stickVector(10, 10, 0)).toEqual({ x: 0, y: 0 });
  });
});
