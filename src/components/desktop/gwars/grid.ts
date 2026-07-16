/**
 * Warping vector grid: a field of points held to their home positions by
 * springs, stored in flat Float32Arrays. Explosions push points outward
 * (pulse) and the player drags a subtle well along (negative force), then
 * the springs ripple everything back. Purely cosmetic - lives outside the
 * deterministic engine and is driven by the render loop.
 */

const SPACING = 42;
const STIFFNESS = 110;
/** Exponential velocity damping per second. */
const DAMPING = 5.5;
/** Displacement clamp so huge blasts don't tear the field apart. */
const MAX_OFFSET = 60;

export class WarpGrid {
  cols = 0;
  rows = 0;
  /** Current point positions. */
  px = new Float32Array(0);
  py = new Float32Array(0);
  private vx = new Float32Array(0);
  private vy = new Float32Array(0);
  /** Rest (home) positions. */
  hx = new Float32Array(0);
  hy = new Float32Array(0);

  resize(w: number, h: number) {
    const cols = Math.max(2, Math.round(w / SPACING) + 1);
    const rows = Math.max(2, Math.round(h / SPACING) + 1);
    this.cols = cols;
    this.rows = rows;
    const n = cols * rows;
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.hx = new Float32Array(n);
    this.hy = new Float32Array(n);
    const stepX = w / (cols - 1);
    const stepY = h / (rows - 1);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        this.hx[i] = this.px[i] = c * stepX;
        this.hy[i] = this.py[i] = r * stepY;
      }
    }
  }

  /** Radial impulse: positive force pushes out, negative pulls in. */
  pulse(x: number, y: number, radius: number, force: number) {
    const r2 = radius * radius;
    for (let i = 0; i < this.px.length; i++) {
      const dx = this.px[i] - x;
      const dy = this.py[i] - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2 || d2 < 0.001) continue;
      const d = Math.sqrt(d2);
      const falloff = 1 - d / radius;
      const k = (force * falloff) / d;
      this.vx[i] += dx * k;
      this.vy[i] += dy * k;
    }
  }

  update(dt: number) {
    const damp = Math.exp(-DAMPING * dt);
    for (let i = 0; i < this.px.length; i++) {
      let ox = this.px[i] - this.hx[i];
      let oy = this.py[i] - this.hy[i];
      this.vx[i] = (this.vx[i] - ox * STIFFNESS * dt) * damp;
      this.vy[i] = (this.vy[i] - oy * STIFFNESS * dt) * damp;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      ox = this.px[i] - this.hx[i];
      oy = this.py[i] - this.hy[i];
      if (ox > MAX_OFFSET) this.px[i] = this.hx[i] + MAX_OFFSET;
      else if (ox < -MAX_OFFSET) this.px[i] = this.hx[i] - MAX_OFFSET;
      if (oy > MAX_OFFSET) this.py[i] = this.hy[i] + MAX_OFFSET;
      else if (oy < -MAX_OFFSET) this.py[i] = this.hy[i] - MAX_OFFSET;
    }
  }
}
