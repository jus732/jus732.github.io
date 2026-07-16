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
  type GwarsEngine,
} from "./engine";
import { ARCHETYPES } from "./enemies";
import type { WarpGrid } from "./grid";
import { COMBOS, RARITY, UNIQUES } from "./rarity";

export type RenderFrame = {
  w: number;
  h: number;
  /** performance.now() for blink/pulse phases. */
  now: number;
  shakeX: number;
  shakeY: number;
};

const BG = "#04060d";
const GRID_LINE = "rgba(78, 118, 255, 0.15)";
const GEOM_COLOR = "#b6ff4d";
const HUD_DIM = "rgba(148, 163, 196, 0.85)";
const HUD_BRIGHT = "#e2ecff";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const TAU = Math.PI * 2;

/** Two-pass additive stroke of the current path: halo then core. */
function glowStroke(ctx: CanvasRenderingContext2D, color: string, width = 2) {
  ctx.strokeStyle = color;
  ctx.globalAlpha *= 0.25;
  ctx.lineWidth = width * 3;
  ctx.stroke();
  ctx.globalAlpha *= 4; // restore (× 0.25 above)
  ctx.lineWidth = width;
  ctx.stroke();
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
  // Materialize: scale up and fade in during spawn grace.
  const grow = e.grace > 0 ? 1 - e.grace / 0.9 : 1;
  ctx.globalAlpha = 0.25 + 0.75 * grow;
  const r = e.radius * (0.4 + 0.6 * grow);
  const color = e.flash > 0 ? "#ffffff" : arch.color;

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
  ctx.globalAlpha = 1;
}

function drawPlayer(ctx: CanvasRenderingContext2D, engine: GwarsEngine, now: number) {
  const p = engine.player;
  const color = engine.config.ship.color;
  // Invulnerability blink.
  if (p.invuln > 0 && Math.floor(now / 90) % 2 === 1) return;

  arrow(ctx, p.x, p.y, PLAYER_RADIUS * 1.35, p.angle);
  glowStroke(ctx, color, 2.2);

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
}

function drawBullets(ctx: CanvasRenderingContext2D, engine: GwarsEngine) {
  const color = engine.config.ship.color;
  for (const b of engine.bullets) {
    if (!b.active) continue;
    const stretch = b.fromDrone ? 0.012 : 0.02;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * stretch, b.y - b.vy * stretch);
    ctx.lineTo(b.x, b.y);
    glowStroke(ctx, color, b.fromDrone ? 1.2 : b.radius * 0.9);
  }
}

function drawGeoms(ctx: CanvasRenderingContext2D, engine: GwarsEngine, now: number) {
  for (const g of engine.geoms) {
    if (!g.active) continue;
    // Fade out as they expire; spin slowly for sparkle.
    ctx.globalAlpha = Math.min(1, g.life / 1.5);
    polygon(ctx, g.x, g.y, 4, 4, now * 0.004 + g.x);
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

function drawGrid(ctx: CanvasRenderingContext2D, grid: WarpGrid) {
  const { cols, rows, px, py } = grid;
  if (cols === 0) return;
  ctx.strokeStyle = GRID_LINE;
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
  ctx.font = `700 12px ${MONO}`;
  ctx.fillStyle = engine.multiplier > 1 ? GEOM_COLOR : HUD_DIM;
  ctx.fillText(`x${engine.multiplier}`, pad, pad + 37);

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
  drawGrid(ctx, grid);
}

export function render(
  ctx: CanvasRenderingContext2D,
  engine: GwarsEngine,
  grid: WarpGrid,
  frame: RenderFrame
) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, frame.w, frame.h);

  ctx.save();
  ctx.translate(frame.shakeX, frame.shakeY);
  drawGrid(ctx, grid);

  ctx.globalCompositeOperation = "lighter";
  ctx.lineJoin = "round";
  drawBlackHole(ctx, engine, frame.now);
  drawGeoms(ctx, engine, frame.now);
  drawBullets(ctx, engine);
  for (let i = 0; i < engine.enemies.length; i++) drawEnemy(ctx, engine, i);
  if (engine.phase !== "over") drawPlayer(ctx, engine, frame.now);
  drawParticles(ctx, engine);
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();

  drawHud(ctx, engine, frame);
}
