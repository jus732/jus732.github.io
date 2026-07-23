/**
 * All G-Wars Canvas 2D drawing: the warp grid, additive-glow ("lighter")
 * entities and particles, screen shake, and the HUD - score, multiplier,
 * wave, lives, bombs - drawn on canvas so gameplay never re-renders
 * React. A pure function of engine + grid state; no allocation beyond
 * canvas paths.
 */

import {
  BLACK_HOLE_COLOR,
  BLACK_HOLE_RADIUS,
  PLAYER_RADIUS,
  WARDEN_AURA,
  type GwarsEngine,
} from "./engine";
import { ARCHETYPES, AFFIXES } from "./enemies";
import type { WarpGrid } from "./grid";
import { COMBOS, RARITY, UNIQUES } from "./rarity";

export type RenderFrame = {
  w: number;
  h: number;
  /** performance.now() for blink/pulse phases. */
  now: number;
  /** Seconds since last frame, for renderer-local animations (rings). */
  dt: number;
  /** Phosphor-trail persistence layer; the app disables it under reduced motion. */
  trails: boolean;
  shakeX: number;
  shakeY: number;
};

const BG = "#04060d";
const GEOM_COLOR = "#b6ff4d";
const GEOM_FILL = "rgba(182, 255, 77, 0.3)";
/** Phosphor layer: per-second fade rate and blend weight of the ghosts.
 *  Actors are re-drawn crisp on the main canvas every frame, so the trail
 *  layer only ever contributes the fading tail, never the body itself. */
const TRAIL_DECAY = 30;
const TRAIL_MIX = 0.35;
const HUD_DIM = "rgba(148, 163, 196, 0.85)";
const HUD_BRIGHT = "#e2ecff";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const TAU = Math.PI * 2;

/* Phosphor trails: the additive entity pass is drawn into an offscreen
 * canvas whose alpha decays each frame, so everything bright drags a
 * fading light trail. Composited onto the main canvas with "lighter".
 * Rendered at half device resolution — trails are soft by design, and
 * quartering the pixels roughly quarters the layer's fill cost. */
const TRAIL_SCALE = 0.5;
let trailCanvas: HTMLCanvasElement | null = null;
let trailCtx: CanvasRenderingContext2D | null = null;

function ensureTrail(pxW: number, pxH: number, dpr: number): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!trailCanvas) {
    trailCanvas = document.createElement("canvas");
    trailCtx = trailCanvas.getContext("2d");
  }
  if (!trailCtx) return null;
  const w = Math.max(1, Math.round(pxW * TRAIL_SCALE));
  const h = Math.max(1, Math.round(pxH * TRAIL_SCALE));
  if (trailCanvas.width !== w || trailCanvas.height !== h) {
    trailCanvas.width = w;
    trailCanvas.height = h;
  }
  const s = dpr * TRAIL_SCALE;
  trailCtx.setTransform(s, 0, 0, s, 0, 0);
  return trailCtx;
}

/* Star dust: a sparse drifting field behind the grid for arena depth.
 * Positions are pure hash functions of the index — nothing to store. */
const STAR_COUNT = 70;

function starHash(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function drawStars(ctx: CanvasRenderingContext2D, frame: RenderFrame) {
  ctx.save();
  // Weaker shake than the arena: reads as a deeper layer.
  ctx.translate(frame.shakeX * 0.4, frame.shakeY * 0.4);
  ctx.fillStyle = "#9db4ff";
  for (let i = 0; i < STAR_COUNT; i++) {
    const speed = 2 + starHash(i, 3) * 6;
    const x = (starHash(i, 1) * frame.w + frame.now * 0.001 * speed) % frame.w;
    const y = (starHash(i, 2) * frame.h + frame.now * 0.0006 * speed) % frame.h;
    const size = i % 6 === 0 ? 2 : 1;
    const twinkle = 0.75 + 0.25 * Math.sin(frame.now * 0.001 + i * 1.7);
    ctx.globalAlpha = (0.08 + starHash(i, 4) * 0.16) * twinkle;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/* Soft radial vignette, cached per canvas size. */
let vignette: CanvasGradient | null = null;
let vignetteKey = "";

function drawVignette(ctx: CanvasRenderingContext2D, frame: RenderFrame) {
  const key = `${frame.w}x${frame.h}`;
  if (key !== vignetteKey) {
    vignette = ctx.createRadialGradient(
      frame.w / 2, frame.h / 2, Math.min(frame.w, frame.h) * 0.45,
      frame.w / 2, frame.h / 2, Math.hypot(frame.w, frame.h) * 0.62
    );
    vignette.addColorStop(0, "rgba(2, 3, 8, 0)");
    vignette.addColorStop(1, "rgba(2, 3, 8, 0.5)");
    vignetteKey = key;
  }
  ctx.fillStyle = vignette!;
  ctx.fillRect(0, 0, frame.w, frame.h);
}

/* Expanding shockwave rings on kills. Renderer-owned (cosmetic), pooled,
 * driven by enemyKill events pushed in from the app via spawnRing(). */
type Ring = { active: boolean; x: number; y: number; r: number; maxR: number; life: number; maxLife: number; color: string };
const RING_POOL = 48;
const rings: Ring[] = Array.from({ length: RING_POOL }, () => ({
  active: false, x: 0, y: 0, r: 0, maxR: 0, life: 0, maxLife: 1, color: "#fff",
}));

export function spawnRing(x: number, y: number, radius: number, color: string) {
  for (const ring of rings) {
    if (ring.active) continue;
    ring.active = true;
    ring.x = x;
    ring.y = y;
    ring.r = radius * 0.6;
    ring.maxR = radius * 3.2 + 40;
    ring.life = ring.maxLife = 0.32;
    ring.color = color;
    return;
  }
}

/** Set by the app when a multiplier milestone fires; drives the HUD pulse. */
let milestonePulseUntil = 0;
export function flashMilestone(now: number) {
  milestonePulseUntil = now + 600;
}

/* Full-screen color wash, canvas-drawn (boss deaths). Kept out of React:
 * a state-driven overlay would re-render the whole app on the heaviest
 * frame of the game. The reward-pick flash stays in React, where a
 * re-render is already happening. */
let screenFlashColor = "#ffffff";
let screenFlashLife = 0;
let screenFlashMax = 1;
export function flashScreen(color: string, duration = 0.45) {
  screenFlashColor = color;
  screenFlashLife = screenFlashMax = duration;
}

function drawScreenFlash(ctx: CanvasRenderingContext2D, frame: RenderFrame) {
  if (screenFlashLife <= 0) return;
  screenFlashLife -= frame.dt;
  if (screenFlashLife <= 0) return;
  ctx.globalAlpha = 0.26 * (screenFlashLife / screenFlashMax);
  ctx.fillStyle = screenFlashColor;
  ctx.fillRect(0, 0, frame.w, frame.h);
  ctx.globalAlpha = 1;
}

/* Kill shatter: the enemy's neon outline breaks into tangential line
 * fragments that fly outward (shoved along the killing blow), spin, and
 * fade. Renderer-owned and driven by real frame dt, so debris keeps
 * flying through engine hitstop — that contrast sells the beat. */
type Shard = {
  active: boolean;
  /** Seconds before the fragment appears (staged boss clusters). */
  delay: number;
  x: number; y: number; vx: number; vy: number;
  rot: number; vrot: number; len: number;
  life: number; maxLife: number;
  color: string;
};
const SHARD_POOL = 220;
const shards: Shard[] = Array.from({ length: SHARD_POOL }, () => ({
  active: false, delay: 0, x: 0, y: 0, vx: 0, vy: 0,
  rot: 0, vrot: 0, len: 8, life: 0, maxLife: 1, color: "#fff",
}));

export function spawnShatter(
  x: number, y: number, radius: number, color: string,
  angle: number, delay = 0
) {
  const count = Math.min(9, 5 + Math.floor(radius / 8));
  const rot0 = Math.random() * TAU;
  let spawned = 0;
  for (const s of shards) {
    if (s.active) continue;
    const edge = rot0 + (spawned / count) * TAU;
    s.active = true;
    s.delay = delay;
    // Fragment starts on the outline, oriented like the edge it broke from.
    s.x = x + Math.cos(edge) * radius * 0.7;
    s.y = y + Math.sin(edge) * radius * 0.7;
    const out = 60 + Math.random() * 120;
    s.vx = Math.cos(edge) * out + Math.cos(angle) * (90 + Math.random() * 120);
    s.vy = Math.sin(edge) * out + Math.sin(angle) * (90 + Math.random() * 120);
    s.rot = edge + Math.PI / 2;
    s.vrot = (Math.random() - 0.5) * 14;
    s.len = Math.max(6, radius * (0.5 + Math.random() * 0.45));
    s.life = s.maxLife = 0.4 + Math.random() * 0.2;
    s.color = color;
    if (++spawned >= count) return;
  }
}

/** Boss death: shatter clusters marching across the body with staggered
 *  delays, escalating to a final white blast, riding the engine's
 *  hitstop + slow-mo. */
export function spawnBossShatter(x: number, y: number, radius: number, color: string) {
  for (let i = 0; i < 4; i++) {
    const last = i === 3;
    const ox = last ? 0 : (Math.random() - 0.5) * radius * 1.4;
    const oy = last ? 0 : (Math.random() - 0.5) * radius * 1.4;
    spawnShatter(
      x + ox, y + oy,
      radius * (last ? 1.1 : 0.55),
      last ? "#ffffff" : color,
      Math.random() * TAU,
      i * 0.13
    );
  }
}

function drawShards(ctx: CanvasRenderingContext2D, dt: number) {
  for (const s of shards) {
    if (!s.active) continue;
    if (s.delay > 0) {
      s.delay -= dt;
      continue;
    }
    s.life -= dt;
    if (s.life <= 0) {
      s.active = false;
      continue;
    }
    const damp = Math.exp(-3 * dt);
    s.vx *= damp;
    s.vy *= damp;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.rot += s.vrot * dt;
    const t = s.life / s.maxLife;
    // Fragments shrink as they burn out.
    const hl = (s.len * (0.4 + 0.6 * t)) / 2;
    const cx = Math.cos(s.rot) * hl;
    const cy = Math.sin(s.rot) * hl;
    ctx.globalAlpha = t;
    ctx.beginPath();
    ctx.moveTo(s.x - cx, s.y - cy);
    ctx.lineTo(s.x + cx, s.y + cy);
    glowStroke(ctx, s.color, 1.6);
  }
  ctx.globalAlpha = 1;
}

/* Arc Reactor chain-lightning segments. Renderer-owned, pooled, driven by
 * chain events pushed from the app via spawnArc(). */
const CHAIN_ARC_COLOR = "#8ad9ff";
type Arc = { active: boolean; x1: number; y1: number; x2: number; y2: number; life: number };
const ARC_POOL = 64;
const arcs: Arc[] = Array.from({ length: ARC_POOL }, () => ({
  active: false, x1: 0, y1: 0, x2: 0, y2: 0, life: 0,
}));

export function spawnArc(x1: number, y1: number, x2: number, y2: number) {
  for (const a of arcs) {
    if (a.active) continue;
    a.active = true; a.x1 = x1; a.y1 = y1; a.x2 = x2; a.y2 = y2; a.life = 0.18;
    return;
  }
}

function drawArcs(ctx: CanvasRenderingContext2D, dt: number) {
  for (const a of arcs) {
    if (!a.active) continue;
    a.life -= dt;
    if (a.life <= 0) { a.active = false; continue; }
    ctx.globalAlpha = Math.min(1, a.life / 0.18);
    ctx.beginPath();
    ctx.moveTo(a.x1, a.y1);
    // A slight midpoint jag reads as electricity.
    const mx = (a.x1 + a.x2) / 2 + (a.y2 - a.y1) * 0.12;
    const my = (a.y1 + a.y2) / 2 - (a.x2 - a.x1) * 0.12;
    ctx.lineTo(mx, my);
    ctx.lineTo(a.x2, a.y2);
    glowStroke(ctx, CHAIN_ARC_COLOR, 1.6);
  }
  ctx.globalAlpha = 1;
}

function drawRings(ctx: CanvasRenderingContext2D, dt: number) {
  for (const ring of rings) {
    if (!ring.active) continue;
    ring.life -= dt;
    if (ring.life <= 0) {
      ring.active = false;
      continue;
    }
    const t = 1 - ring.life / ring.maxLife;
    ring.r += (ring.maxR - ring.r) * Math.min(1, dt * 12);
    ctx.globalAlpha = (1 - t) * 0.8;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r, 0, TAU);
    glowStroke(ctx, ring.color, 2 * (1 - t) + 0.5);
  }
  ctx.globalAlpha = 1;
}

/** Two-pass additive stroke of the current path: halo then core. */
function glowStroke(ctx: CanvasRenderingContext2D, color: string, width = 2) {
  ctx.strokeStyle = color;
  const alpha = ctx.globalAlpha;
  // Wide faint halo, tighter mid glow, then the crisp core line.
  ctx.globalAlpha = alpha * 0.12;
  ctx.lineWidth = width * 6;
  ctx.stroke();
  ctx.globalAlpha = alpha * 0.3;
  ctx.lineWidth = width * 3;
  ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Mix a #rrggbb color toward white by `amt` (0..1). */
function brighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgb(${Math.round(r + (255 - r) * amt)},${Math.round(
    g + (255 - g) * amt
  )},${Math.round(b + (255 - b) * amt)})`;
}

function polygon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  sides: number,
  rot: number
) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * TAU;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function pinwheel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  rot: number
) {
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = rot + (i / 4) * TAU;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
    ctx.lineTo(
      x + Math.cos(a + 0.5) * radius * 0.55,
      y + Math.sin(a + 0.5) * radius * 0.55
    );
  }
}

function arrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  rot: number
) {
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(rot) * radius * 1.3, y + Math.sin(rot) * radius * 1.3);
  ctx.lineTo(x + Math.cos(rot + 2.5) * radius, y + Math.sin(rot + 2.5) * radius);
  ctx.lineTo(x + Math.cos(rot + Math.PI) * radius * 0.35, y + Math.sin(rot + Math.PI) * radius * 0.35);
  ctx.lineTo(x + Math.cos(rot - 2.5) * radius, y + Math.sin(rot - 2.5) * radius);
  ctx.closePath();
}

function drawEnemy(ctx: CanvasRenderingContext2D, engine: GwarsEngine, index: number) {
  const e = engine.enemies[index];
  const arch = ARCHETYPES[e.type];
  let r = e.radius;
  let color = e.flash > 0 ? "#ffffff" : arch.color;
  ctx.globalAlpha = 1;

  // Spawn telegraph: the sprite blinks three times in place as a dim
  // ghost, then materializes with a brief white-hot flash.
  if (e.grace > 0) {
    const t = Math.min(1, e.grace / 0.9); // 1 = just spawned, 0 = done
    if (t > 0.15) {
      const phase = (1 - t) / 0.85; // 0 → 1 across the blink window
      if (Math.floor(phase * 6) % 2 === 1) return; // off-beat: invisible
      ctx.globalAlpha = 0.3;
      r = e.radius * 0.9;
    } else {
      const f = 1 - t / 0.15; // 0 at flash start → 1 fully spawned
      color = brighten(arch.color, 0.85 * (1 - f));
      r = e.radius * (1.2 - 0.2 * f);
    }
  }

  switch (e.type) {
    case "wanderer":
      polygon(ctx, e.x, e.y, r, 4, e.spin);
      glowStroke(ctx, color, 2);
      break;
    case "seeker":
    case "shard":
      arrow(ctx, e.x, e.y, r, e.spin);
      glowStroke(ctx, color, 1.8);
      break;
    case "weaver":
      polygon(ctx, e.x, e.y, r, 4, e.spin);
      glowStroke(ctx, color, 2);
      polygon(ctx, e.x, e.y, r * 0.5, 4, -e.spin);
      glowStroke(ctx, color, 1.2);
      break;
    case "spinner":
      pinwheel(ctx, e.x, e.y, r, e.spin);
      glowStroke(ctx, color, 2);
      break;
    case "splitter":
      polygon(ctx, e.x, e.y, r, 6, e.spin);
      glowStroke(ctx, color, 2.2);
      polygon(ctx, e.x, e.y, r * 0.55, 3, -e.spin * 1.5);
      glowStroke(ctx, color, 1.2);
      break;
    case "snakeHead":
      arrow(ctx, e.x, e.y, r * 1.15, e.spin);
      glowStroke(ctx, color, 2.2);
      break;
    case "snakeBody":
      polygon(ctx, e.x, e.y, r, 5, e.spin);
      glowStroke(ctx, color, 1.6);
      break;
    case "charger":
      polygon(ctx, e.x, e.y, r, 3, e.spin);
      glowStroke(ctx, color, 2.4);
      // Telegraph: a bright aim-line while winding up.
      if (e.link === 0 && e.timer < 0.4) {
        ctx.globalAlpha *= 0.6;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(e.spin) * 60, e.y + Math.sin(e.spin) * 60);
        glowStroke(ctx, "#ffcaa8", 1.4);
        ctx.globalAlpha /= 0.6;
      }
      break;
    case "flock":
      polygon(ctx, e.x, e.y, r, 3, e.spin);
      glowStroke(ctx, color, 1.4);
      break;
    case "dodger":
      polygon(ctx, e.x, e.y, r, 5, e.spin);
      glowStroke(ctx, color, 2);
      polygon(ctx, e.x, e.y, r * 0.45, 5, -e.spin);
      glowStroke(ctx, color, 1);
      break;
    case "orbiter":
      pinwheel(ctx, e.x, e.y, r, e.spin);
      glowStroke(ctx, color, 1.8);
      break;
    case "warden":
      polygon(ctx, e.x, e.y, r, 6, e.spin);
      glowStroke(ctx, color, 2.6);
      polygon(ctx, e.x, e.y, r * 0.6, 3, -e.spin);
      glowStroke(ctx, color, 1.4);
      // Aura bubble so the protected zone reads.
      ctx.globalAlpha *= 0.18;
      ctx.beginPath();
      ctx.arc(e.x, e.y, WARDEN_AURA, 0, TAU);
      glowStroke(ctx, color, 1.2);
      ctx.globalAlpha /= 0.18;
      break;
    case "boss": {
      polygon(ctx, e.x, e.y, r, 7, e.spin);
      glowStroke(ctx, color, 3);
      polygon(ctx, e.x, e.y, r * 0.62, 7, -e.spin * 1.4);
      glowStroke(ctx, color, 1.6);
      // HP ring drains as the boss takes damage.
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 8, -Math.PI / 2, -Math.PI / 2 + TAU * (e.hp / e.maxHp));
      ctx.strokeStyle = "#ffb1b1";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
  }
  if (e.affix) {
    const ac = AFFIXES[e.affix].color;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r + 5, 0, TAU);
    ctx.globalAlpha *= 0.9;
    glowStroke(ctx, ac, 1.6);
    ctx.globalAlpha /= 0.9;
    // Shielded: a second solid bubble that reads as "still up".
    if (e.shielded) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 9, 0, TAU);
      ctx.globalAlpha *= 0.5;
      glowStroke(ctx, "#cfe0ff", 1.2);
      ctx.globalAlpha /= 0.5;
    }
  }
  ctx.globalAlpha = 1;
}

function drawPlayer(ctx: CanvasRenderingContext2D, engine: GwarsEngine, now: number) {
  const p = engine.player;
  const color = engine.config.ship.color;
  // Invulnerability blink.
  if (p.invuln > 0 && Math.floor(now / 90) % 2 === 1) return;

  // Recoil: kick the ship slightly opposite the aim just after firing.
  // fireCd rises to the *effective* cooldown on each volley, then ticks
  // down; a high fraction means "just fired", so the kick decays with it.
  const cd = engine.volleyCooldown;
  const kick = cd > 0 ? Math.max(0, Math.min(1, p.fireCd / cd)) : 0;
  const rx = p.x - Math.cos(p.angle) * kick * 3;
  const ry = p.y - Math.sin(p.angle) * kick * 3;

  arrow(ctx, rx, ry, PLAYER_RADIUS * 1.35, p.angle);
  glowStroke(ctx, color, 2.2);

  // Muzzle flash: a bright short spike at the nose while the kick is fresh.
  if (kick > 0.35) {
    const nx = rx + Math.cos(p.angle) * PLAYER_RADIUS * 1.5;
    const ny = ry + Math.sin(p.angle) * PLAYER_RADIUS * 1.5;
    ctx.globalAlpha = (kick - 0.35) * 1.4;
    ctx.beginPath();
    ctx.arc(nx, ny, 2 + kick * 3, 0, TAU);
    glowStroke(ctx, "#ffffff", 2);
    ctx.globalAlpha = 1;
  }

  if (p.shieldCharges > 0) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER_RADIUS + 8 + Math.sin(now * 0.008) * 1.5, 0, TAU);
    ctx.globalAlpha = 0.35 + 0.15 * p.shieldCharges;
    glowStroke(ctx, "#8ab8ff", 1.4);
    ctx.globalAlpha = 1;
  }

  for (const d of engine.drones) {
    polygon(ctx, d.x, d.y, 5, 3, d.angle);
    glowStroke(ctx, color, 1.4);
  }

  for (const bl of engine.blades) {
    polygon(ctx, bl.x, bl.y, 8, 3, bl.angle * 3);
    glowStroke(ctx, "#cfe0ff", 1.6);
  }
}

function drawBullets(ctx: CanvasRenderingContext2D, engine: GwarsEngine) {
  const color = engine.config.ship.color;
  // Higher damage builds read as fatter, brighter bolts.
  const power = 1 + Math.min(1, engine.mods.damage * 0.15);
  for (const b of engine.bullets) {
    if (!b.active) continue;
    const stretch = b.fromDrone ? 0.016 : 0.028;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * stretch, b.y - b.vy * stretch);
    ctx.lineTo(b.x, b.y);
    glowStroke(ctx, color, (b.fromDrone ? 1.2 : b.radius * 0.9) * power);
  }
}

function drawGeoms(ctx: CanvasRenderingContext2D, engine: GwarsEngine, now: number) {
  for (const g of engine.geoms) {
    if (!g.active) continue;
    // Fade out as they expire; spin slowly for sparkle.
    ctx.globalAlpha = Math.min(1, g.life / 1.5);
    const pulse = 1 + 0.2 * Math.sin(now * 0.012 + g.x);
    polygon(ctx, g.x, g.y, 4 * pulse, 4, now * 0.004 + g.x);
    ctx.fillStyle = GEOM_FILL;
    ctx.fill();
    glowStroke(ctx, GEOM_COLOR, 1.4);
  }
  ctx.globalAlpha = 1;
}

function drawParticles(ctx: CanvasRenderingContext2D, engine: GwarsEngine) {
  for (const p of engine.particles) {
    if (!p.active) continue;
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.size * alpha;
    ctx.beginPath();
    ctx.moveTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** The Black Hole unique's gravity well: nested counter-rotating rings. */
function drawBlackHole(ctx: CanvasRenderingContext2D, engine: GwarsEngine, now: number) {
  const bh = engine.blackHole;
  if (!bh.active) return;
  // Fade out as the well collapses.
  ctx.globalAlpha = Math.max(0.15, Math.min(1, bh.life / 0.6));
  const spin = now * 0.0026;
  for (let ring = 0; ring < 3; ring++) {
    const r = 12 + ring * 14;
    const dir = ring % 2 === 0 ? 1 : -1;
    ctx.beginPath();
    ctx.arc(bh.x, bh.y, r, spin * dir, spin * dir + Math.PI * 1.4);
    glowStroke(ctx, BLACK_HOLE_COLOR, 1.6);
  }
  // Faint event-horizon boundary so the pull radius reads.
  ctx.globalAlpha *= 0.25;
  ctx.beginPath();
  ctx.arc(bh.x, bh.y, BLACK_HOLE_RADIUS * (0.9 + Math.sin(now * 0.004) * 0.06), 0, TAU);
  ctx.strokeStyle = BLACK_HOLE_COLOR;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawHazards(ctx: CanvasRenderingContext2D, engine: GwarsEngine, now: number) {
  for (const hz of engine.hazards) {
    if (!hz.active) continue;
    const t = 1 - hz.warn / 0.6; // 0..1 as it charges
    // Pulsing danger ring at the blast radius, filling toward detonation.
    ctx.globalAlpha = 0.3 + 0.4 * t + Math.sin(now * 0.02) * 0.1;
    ctx.beginPath();
    ctx.arc(hz.x, hz.y, hz.radius, 0, TAU);
    glowStroke(ctx, "#ff9e4d", 1.2 + t * 1.5);
    // Growing inner fill telegraphs the timing.
    ctx.beginPath();
    ctx.arc(hz.x, hz.y, hz.radius * t, 0, TAU);
    ctx.globalAlpha = 0.15 + 0.2 * t;
    glowStroke(ctx, "#ffd0a0", 1);
  }
  ctx.globalAlpha = 1;
}

function drawGrid(ctx: CanvasRenderingContext2D, grid: WarpGrid, intensity: number) {
  const { cols, rows, px, py } = grid;
  if (cols === 0) return;
  // Brighter, warmer grid as the multiplier climbs.
  const alpha = 0.15 + intensity * 0.22;
  const g = Math.round(118 - intensity * 40);
  const b = Math.round(255 - intensity * 60);
  ctx.strokeStyle = `rgba(78, ${g}, ${b}, ${alpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c === 0) ctx.moveTo(px[i], py[i]);
      else ctx.lineTo(px[i], py[i]);
    }
  }
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const i = r * cols + c;
      if (r === 0) ctx.moveTo(px[i], py[i]);
      else ctx.lineTo(px[i], py[i]);
    }
  }
  ctx.stroke();
}

function drawHud(ctx: CanvasRenderingContext2D, engine: GwarsEngine, frame: RenderFrame) {
  const pad = 14;
  ctx.textBaseline = "top";

  // Score + multiplier, top-left.
  ctx.textAlign = "left";
  ctx.font = `600 10px ${MONO}`;
  ctx.fillStyle = HUD_DIM;
  ctx.fillText("SCORE", pad, pad);
  ctx.font = `700 20px ${MONO}`;
  ctx.fillStyle = HUD_BRIGHT;
  ctx.fillText(engine.score.toLocaleString(), pad, pad + 13);
  const pulse = frame.now < milestonePulseUntil
    ? (milestonePulseUntil - frame.now) / 600
    : 0;
  if (pulse > 0) {
    ctx.save();
    ctx.translate(pad, pad + 43);
    ctx.scale(1 + pulse * 0.5, 1 + pulse * 0.5);
    ctx.font = `700 12px ${MONO}`;
    ctx.textAlign = "left";
    ctx.fillStyle = GEOM_COLOR;
    ctx.globalAlpha = 0.5 + 0.5 * pulse;
    ctx.fillText(`x${engine.multiplier}`, 0, -6);
    ctx.restore();
    ctx.globalAlpha = 1;
  } else {
    ctx.font = `700 12px ${MONO}`;
    ctx.fillStyle = engine.multiplier > 1 ? GEOM_COLOR : HUD_DIM;
    ctx.fillText(`x${engine.multiplier}`, pad, pad + 37);
  }

  // Wave, top-center.
  ctx.textAlign = "center";
  ctx.font = `600 10px ${MONO}`;
  ctx.fillStyle = HUD_DIM;
  ctx.fillText("WAVE", frame.w / 2, pad);
  ctx.font = `700 18px ${MONO}`;
  ctx.fillStyle = HUD_BRIGHT;
  ctx.fillText(String(engine.wave), frame.w / 2, pad + 13);

  // Lives + bombs, top-right.
  const shipColor = engine.config.ship.color;
  ctx.textAlign = "right";
  ctx.font = `600 10px ${MONO}`;
  ctx.fillStyle = HUD_DIM;
  ctx.fillText("LIVES", frame.w - pad, pad);
  if (!Number.isFinite(engine.lives) || engine.lives > 6) {
    ctx.font = `700 16px ${MONO}`;
    ctx.fillStyle = shipColor;
    ctx.fillText(
      Number.isFinite(engine.lives) ? `x${engine.lives}` : "∞",
      frame.w - pad,
      pad + 13
    );
  } else {
    for (let i = 0; i < engine.lives; i++) {
      arrow(ctx, frame.w - pad - 6 - i * 16, pad + 20, 6, -Math.PI / 2);
      ctx.strokeStyle = shipColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  ctx.font = `600 10px ${MONO}`;
  ctx.fillStyle = HUD_DIM;
  ctx.fillText("BOMBS", frame.w - pad, pad + 34);
  for (let i = 0; i < Math.min(engine.bombs, 8); i++) {
    polygon(ctx, frame.w - pad - 5 - i * 13, pad + 52, 5, 4, Math.PI / 4);
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Acquired uniques/combos, bottom-left: the build at a glance.
  let icon = 0;
  const iy = frame.h - pad - 9;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 8px ${MONO}`;
  for (const id of engine.uniques) {
    const ix = pad + 9 + icon * 22;
    const color = RARITY[UNIQUES[id].rarity].color;
    polygon(ctx, ix, iy, 8, 4, Math.PI / 4);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(UNIQUES[id].name[0], ix, iy + 0.5);
    icon++;
  }
  for (const id of engine.combos) {
    const ix = pad + 9 + icon * 22;
    const color = RARITY.combo.color;
    polygon(ctx, ix, iy, 8.5, 6, frame.now * 0.001);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(COMBOS[id].name[0], ix, iy + 0.5);
    icon++;
  }
  ctx.textBaseline = "top";
}

/** Grid-only frame for the title screen, before a run exists. */
export function renderBackdrop(
  ctx: CanvasRenderingContext2D,
  grid: WarpGrid,
  frame: RenderFrame
) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, frame.w, frame.h);
  drawStars(ctx, frame);
  drawGrid(ctx, grid, 0);
  drawVignette(ctx, frame);
}

/** The movers that deposit phosphor ghosts. Drawn twice per frame: once
 *  into the trail layer (the fading tail) and once crisp on the main
 *  canvas (the body). */
function drawTrailLights(
  g: CanvasRenderingContext2D,
  engine: GwarsEngine,
  frame: RenderFrame
) {
  drawBlackHole(g, engine, frame.now);
  drawBullets(g, engine);
  for (let i = 0; i < engine.enemies.length; i++) drawEnemy(g, engine, i);
}

/** Main-canvas only: pickups, sparks, telegraphs and one-shot effects
 *  that would smear into mush (or lose readability) if they ghosted. */
function drawCrispLights(
  g: CanvasRenderingContext2D,
  engine: GwarsEngine,
  frame: RenderFrame
) {
  drawGeoms(g, engine, frame.now);
  drawParticles(g, engine);
  drawHazards(g, engine, frame.now);
  if (engine.phase !== "over") drawPlayer(g, engine, frame.now);
  drawShards(g, frame.dt);
  drawRings(g, frame.dt);
  drawArcs(g, frame.dt);
}

export function render(
  ctx: CanvasRenderingContext2D,
  engine: GwarsEngine,
  grid: WarpGrid,
  frame: RenderFrame
) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, frame.w, frame.h);
  drawStars(ctx, frame);

  const intensity = Math.min(1, (engine.multiplier - 1) / 20);
  ctx.save();
  ctx.translate(frame.shakeX, frame.shakeY);
  drawGrid(ctx, grid, intensity);
  ctx.restore();

  const dpr = frame.w > 0 ? ctx.canvas.width / frame.w : 1;
  const tctx = frame.trails
    ? ensureTrail(ctx.canvas.width, ctx.canvas.height, dpr)
    : null;

  if (tctx && trailCanvas) {
    // Decay last frame's light (frame-rate independent), then stamp the
    // current movers on top so the layer holds their afterimages.
    const keep = Math.exp(-(frame.dt || 1 / 60) * TRAIL_DECAY);
    tctx.globalCompositeOperation = "destination-in";
    tctx.fillStyle = `rgba(0, 0, 0, ${keep})`;
    tctx.fillRect(0, 0, frame.w, frame.h);
    tctx.globalCompositeOperation = "lighter";
    tctx.lineJoin = "round";
    drawTrailLights(tctx, engine, frame);
    tctx.globalCompositeOperation = "source-over";
  }

  ctx.save();
  ctx.translate(frame.shakeX, frame.shakeY);
  ctx.globalCompositeOperation = "lighter";
  if (tctx && trailCanvas) {
    ctx.globalAlpha = TRAIL_MIX;
    ctx.drawImage(trailCanvas, 0, 0, frame.w, frame.h);
    ctx.globalAlpha = 1;
  }
  ctx.lineJoin = "round";
  drawTrailLights(ctx, engine, frame);
  drawCrispLights(ctx, engine, frame);
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();

  drawVignette(ctx, frame);
  drawScreenFlash(ctx, frame);
  drawHud(ctx, engine, frame);
}
