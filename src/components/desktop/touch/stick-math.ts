/**
 * Normalized stick deflection for a pointer offset (px) from the stick base.
 * Direction is preserved; magnitude is len/radius clamped to 1.
 */
export function stickVector(
  dx: number,
  dy: number,
  radius: number
): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (len === 0 || radius <= 0) return { x: 0, y: 0 };
  const mag = Math.min(len / radius, 1);
  return { x: (dx / len) * mag, y: (dy / len) * mag };
}
