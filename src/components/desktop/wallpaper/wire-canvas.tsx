"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Shared scaffolding for the interactive wireframe wallpapers (Orbit, Halo,
 * Prism). Each wallpaper supplies a scene — a draw function plus an optional
 * click-to-ripple mapper — and WireCanvas owns everything they'd otherwise
 * copy-paste: DPR-aware resize, accent-token reads (re-read on theme flips),
 * eased cursor tracking, desktop-background click routing, and the RAF loop.
 * Under prefers-reduced-motion it renders one static frame and attaches no
 * listeners at all.
 */

export type Vec3 = [number, number, number];
export type RGB = [number, number, number];

const FOCAL = 3.2; // perspective strength

/** Rotate a model-space point around Y then X and project to canvas px. */
export function project(
  px: number,
  py: number,
  pz: number,
  rotX: number,
  rotY: number,
  cx: number,
  cy: number,
  radius: number
): Vec3 {
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const x1 = px * cosY + pz * sinY;
  const z1 = -px * sinY + pz * cosY;
  const y2 = py * cosX - z1 * sinX;
  const z2 = py * sinX + z1 * cosX;
  const scale = FOCAL / (FOCAL + z2);
  return [cx + x1 * radius * scale, cy + y2 * radius * scale, z2];
}

/** Undo `project`'s rotation: take a view-space direction back to model space. */
export function unrotate(x: number, y: number, z: number, rotX: number, rotY: number): Vec3 {
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const y1 = y * cosX + z * sinX;
  const z1 = -y * sinX + z * cosX;
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  return [x * cosY - z1 * sinY, y1, x * sinY + z1 * cosY];
}

export function hexToRgb(hex: string): RGB {
  const value = hex.replace("#", "");
  const n = parseInt(
    value.length === 3 ? value.split("").map((c) => c + c).join("") : value,
    16
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ----- Click ripples -----
 * A ripple is an expanding front travelling across the shape's surface,
 * measured as an angular distance from where the click landed. Scenes store
 * whatever origin fits their geometry (a unit direction for the sphere and
 * icosahedron, a ring angle for the torus) and ask rippleWave for the
 * signed surface offset at each vertex.
 */

export type RippleBase = { start: number };

const RIPPLE_DURATION = 1500; // ms from impact to fully settled
const RIPPLE_TRAVEL = Math.PI; // radians the front covers over the duration
const RIPPLE_WIDTH = 0.42; // angular thickness of the front
const RIPPLE_AMP = 0.16; // peak offset as a fraction of shape radius
const MAX_RIPPLES = 6;

export function addRipple<T extends RippleBase>(ripples: T[], ripple: T) {
  if (ripples.length >= MAX_RIPPLES) ripples.shift();
  ripples.push(ripple);
}

/** Drop fully decayed ripples (list is ordered by start time). */
export function pruneRipples(ripples: RippleBase[], t: number) {
  while (ripples.length > 0 && t - ripples[0].start > RIPPLE_DURATION) {
    ripples.shift();
  }
}

/**
 * Signed surface offset at angular distance `dist` from a ripple's origin,
 * `age` ms after the click. A derivative-of-Gaussian wavelet rides the
 * expanding front — outward bulge trailing a slight inward dip — and decays
 * quadratically, so the surface eases back to rest rather than denting.
 */
export function rippleWave(dist: number, age: number): number {
  const p = age / RIPPLE_DURATION;
  if (p <= 0 || p >= 1) return 0;
  const u = (dist - p * RIPPLE_TRAVEL) / RIPPLE_WIDTH;
  if (u < -2.5 || u > 2.5) return 0;
  return -RIPPLE_AMP * u * Math.exp(-u * u) * (1 - p) * (1 - p);
}

/* ----- Desktop-surface click ripples -----
 * Independent of the shape ripples above: every left click on the bare
 * desktop sends a colorless distortion wave through the field — nearby dust
 * motes get shoved outward (in drawDust), and a warped copy of the
 * wallpaper's own texture, drawn in the grid color, shimmers across the
 * wavefront like a gravity lens passing over it. Nothing is painted where
 * the field is at rest; only the displacement is visible. Decays in well
 * under a second. Never active under reduced motion (WireCanvas attaches no
 * pointer listeners there).
 */

export type SurfaceRipple = { x: number; y: number; start: number };

/** The wallpaper texture behind the canvas, so the warp can match it. */
export type WallTexture =
  | { kind: "grid"; size: number }
  | { kind: "dots"; size: number; dotRadius: number }
  | { kind: "diag"; size: number };

export type RGBA = [number, number, number, number];

const SURFACE_DURATION = 650; // ms from click to fully settled
const SURFACE_TRAVEL = 170; // px the wavefront expands
const SURFACE_WIDTH = 46; // px thickness of the front
const SURFACE_AMP = 11; // px peak displacement at the front
const WARP_STEP = 6; // px sampling step along warped texture lines
const WARP_MIN = 0.35; // px below which displacement isn't worth drawing

/** Wavefront radius at normalized age `p`, easing out as it expands. */
function surfaceRadius(p: number) {
  return 6 + (1 - (1 - p) ** 3) * SURFACE_TRAVEL;
}

/** Signed radial displacement at `dist` px from the click, age fraction `p`. */
function surfaceOffset(dist: number, p: number): number {
  const u = (dist - surfaceRadius(p)) / SURFACE_WIDTH;
  if (u < -2.5 || u > 2.5) return 0;
  return -SURFACE_AMP * u * Math.exp(-u * u) * (1 - p) * (1 - p);
}

/**
 * Stroke one texture line (start point + unit direction, `len` px long)
 * with each sample displaced radially away from the ripple. The path breaks
 * wherever displacement is negligible so the undisturbed stretch of the
 * line is never double-painted over the DOM texture beneath.
 */
function strokeWarpedLine(
  ctx: CanvasRenderingContext2D,
  rip: SurfaceRipple,
  p: number,
  sx: number,
  sy: number,
  dirX: number,
  dirY: number,
  len: number
) {
  let drawing = false;
  ctx.beginPath();
  for (let s = 0; s <= len; s += WARP_STEP) {
    const x = sx + dirX * s;
    const y = sy + dirY * s;
    const dx = x - rip.x;
    const dy = y - rip.y;
    const dist = Math.hypot(dx, dy) || 1;
    const off = surfaceOffset(dist, p);
    if (Math.abs(off) > WARP_MIN) {
      const wx = x + (dx / dist) * off;
      const wy = y + (dy / dist) * off;
      if (drawing) ctx.lineTo(wx, wy);
      else ctx.moveTo(wx, wy);
      drawing = true;
    } else {
      drawing = false;
    }
  }
  ctx.stroke();
}

function drawSurfaceWarp(
  ctx: CanvasRenderingContext2D,
  ripples: SurfaceRipple[],
  f: WireFrame,
  texture: WallTexture,
  grid: RGBA
) {
  const [gr, gg, gb, ga] = grid;
  for (const rip of ripples) {
    const p = (f.t - rip.start) / SURFACE_DURATION;
    if (p <= 0 || p >= 1) continue;
    // Slightly above the texture's own alpha so the moving warped copy
    // reads over the static lines beneath, still fading with the wave.
    const alpha = Math.min(1, ga * 2.4) * (1 - p);
    const reach = surfaceRadius(p) + SURFACE_WIDTH * 2.5;
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${gr}, ${gg}, ${gb}, ${alpha})`;
    ctx.fillStyle = ctx.strokeStyle;

    if (texture.kind === "grid") {
      const s = texture.size;
      for (let x = Math.floor((rip.x - reach) / s) * s; x <= rip.x + reach; x += s) {
        strokeWarpedLine(ctx, rip, p, x, rip.y - reach, 0, 1, reach * 2);
      }
      for (let y = Math.floor((rip.y - reach) / s) * s; y <= rip.y + reach; y += s) {
        strokeWarpedLine(ctx, rip, p, rip.x - reach, y, 1, 0, reach * 2);
      }
    } else if (texture.kind === "dots") {
      const s = texture.size;
      for (let x = Math.floor((rip.x - reach) / s) * s; x <= rip.x + reach; x += s) {
        for (let y = Math.floor((rip.y - reach) / s) * s; y <= rip.y + reach; y += s) {
          const dx = x - rip.x;
          const dy = y - rip.y;
          const dist = Math.hypot(dx, dy) || 1;
          const off = surfaceOffset(dist, p);
          if (Math.abs(off) <= WARP_MIN) continue;
          ctx.beginPath();
          ctx.arc(x + (dx / dist) * off, y + (dy / dist) * off, texture.dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      // Diagonal stripes: two 45° families. CSS repeating-linear-gradient
      // phases from a corner, so line constants are offset by the canvas
      // dims: x − y ≡ −H and x + y ≡ W + H (mod period along the axis).
      const period = texture.size * Math.SQRT2;
      const inv = Math.SQRT1_2;
      for (const family of [1, -1] as const) {
        // Line constant c: x − family·y = c; phase anchor per family.
        const anchor = family === 1 ? -f.height : f.width + f.height;
        const cClick = rip.x - family * rip.y;
        const k0 = Math.ceil((cClick - reach * Math.SQRT2 - anchor) / period);
        for (let c = anchor + k0 * period; c <= cClick + reach * Math.SQRT2; c += period) {
          // Closest point of the line to the click, then walk ±reach along it.
          const t0 = (cClick - c) / 2;
          const px = rip.x - t0;
          const py = rip.y + family * t0;
          strokeWarpedLine(
            ctx,
            rip,
            p,
            px - inv * reach,
            py - family * inv * reach,
            inv,
            family * inv,
            reach * 2
          );
        }
      }
    }
  }
}

/* ----- Parallax dust field ----- */

export type Dust = { x: number; y: number; depth: number; r: number; phase: number };

export function makeDust(count: number): Dust[] {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    depth: 0.25 + Math.random() * 0.75,
    r: 0.6 + Math.random() * 1.1,
    phase: Math.random() * Math.PI * 2,
  }));
}

/** Accent-tinted dust with slight mouse parallax and a slow twinkle. */
export function drawDust(ctx: CanvasRenderingContext2D, dust: Dust[], f: WireFrame) {
  const [cr, cg, cb] = f.accent;
  for (const d of dust) {
    const alpha = 0.1 + 0.12 * (0.5 + 0.5 * Math.sin(f.t * 0.0006 + d.phase));
    let x = d.x * f.width - f.mx * 22 * d.depth;
    let y = d.y * f.height - f.my * 14 * d.depth;
    // Surface clicks shove nearby motes outward as the wavefront passes.
    for (const c of f.clicks) {
      const p = (f.t - c.start) / SURFACE_DURATION;
      if (p <= 0 || p >= 1) continue;
      const dx = x - c.x;
      const dy = y - c.y;
      const dist = Math.hypot(dx, dy) || 1;
      const push = surfaceOffset(dist, p) * 1.8 * d.depth;
      if (push === 0) continue;
      x += (dx / dist) * push;
      y += (dy / dist) * push;
    }
    ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha * d.depth})`;
    ctx.beginPath();
    ctx.arc(x, y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ----- The canvas host ----- */

export type WireFrame = {
  t: number;
  width: number;
  height: number;
  /** Eased cursor position, each axis in [-1, 1]. */
  mx: number;
  my: number;
  accent: RGB;
  /** Active desktop-surface click ripples (canvas px). */
  clicks: SurfaceRipple[];
};

export type WireScene = {
  draw: (ctx: CanvasRenderingContext2D, frame: WireFrame) => void;
  /** Map a desktop-background click (canvas px) into a scene ripple. */
  click?: (x: number, y: number, t: number) => void;
};

export function WireCanvas({
  createScene,
  texture,
}: {
  createScene: () => WireScene;
  /** Wallpaper texture behind the canvas; enables the click warp effect. */
  texture?: WallTexture;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const scene = createScene();
    const surfaceClicks: SurfaceRipple[] = [];
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Mouse state lives outside React; target is set by the listener,
    // current eases toward it each frame.
    const mouse = { tx: 0, ty: 0, x: 0, y: 0 };

    let accent: RGB = [10, 134, 232];
    let wallGrid: RGBA = [44, 40, 32, 0.05];
    const readTheme = () => {
      const style = getComputedStyle(document.documentElement);
      const accentValue = style.getPropertyValue("--accent").trim();
      if (accentValue.startsWith("#")) accent = hexToRgb(accentValue);
      const gridMatch = style
        .getPropertyValue("--wall-grid")
        .match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/);
      if (gridMatch) {
        wallGrid = [
          +gridMatch[1],
          +gridMatch[2],
          +gridMatch[3],
          gridMatch[4] === undefined ? 1 : +gridMatch[4],
        ];
      }
    };
    readTheme();

    const frame: WireFrame = {
      t: 0,
      width: 0,
      height: 0,
      mx: 0,
      my: 0,
      accent,
      clicks: surfaceClicks,
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      if (width === 0 || height === 0) return;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      while (surfaceClicks.length > 0 && t - surfaceClicks[0].start > SURFACE_DURATION) {
        surfaceClicks.shift();
      }
      frame.t = t;
      frame.width = width;
      frame.height = height;
      frame.mx = mouse.x;
      frame.my = mouse.y;
      frame.accent = accent;
      if (texture) drawSurfaceWarp(ctx, surfaceClicks, frame, texture, wallGrid);
      scene.draw(ctx, frame);
    };

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduce) draw(0);
    };

    let raf = 0;
    const loop = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    const onMouseMove = (e: MouseEvent) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
      // Same listener also feeds the DOM grid-glow layers (wallpaper.tsx):
      // the cursor position lands in two CSS vars their masks track.
      const host = canvas.parentElement;
      if (host) {
        const rect = host.getBoundingClientRect();
        host.style.setProperty("--wall-x", `${e.clientX - rect.left}px`);
        host.style.setProperty("--wall-y", `${e.clientY - rect.top}px`);
      }
    };

    // The canvas itself is pointer-events-none; ripple only on clicks that
    // land on the bare desktop surface (icons, windows and the taskbar all
    // swallow their own pointer events). Every such click ripples the
    // surface; clicks near the shape additionally ripple its geometry.
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as Element | null;
      if (!target?.matches?.("[data-desktop-surface]")) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const t = performance.now();
      if (surfaceClicks.length >= MAX_RIPPLES) surfaceClicks.shift();
      surfaceClicks.push({ x, y, start: t });
      scene.click?.(x, y, t);
    };

    // Re-read theme colors when the theme class flips.
    const themeObserver = new MutationObserver(() => {
      readTheme();
      if (reduce) draw(0);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    window.addEventListener("resize", resize);
    resize();

    if (!reduce) {
      window.addEventListener("mousemove", onMouseMove, { passive: true });
      window.addEventListener("pointerdown", onPointerDown, { passive: true });
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("pointerdown", onPointerDown);
      themeObserver.disconnect();
    };
  }, [reduce, createScene, texture]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full"
    />
  );
}
