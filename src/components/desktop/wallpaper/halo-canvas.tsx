"use client";

import {
  WireCanvas,
  project,
  makeDust,
  drawDust,
  addRipple,
  pruneRipples,
  rippleWave,
  type RippleBase,
  type Vec3,
  type WireScene,
} from "@/components/desktop/wallpaper/wire-canvas";

const RING_RADIUS = 1; // main ring, model units
const TUBE_RADIUS = 0.42;
const RING_STEPS = 72; // segments along the main ring
const TUBE_STEPS = 20; // segments around the tube
const SECTION_COUNT = 26; // cross-section circles around the ring
const SPINE_COUNT = 9; // longitudinal lines along the ring
const DUST_COUNT = 55;

/** Ripple origin: an angle along the main ring. */
type RingRipple = RippleBase & { u0: number };

function createHaloScene(): WireScene {
  const dust = makeDust(DUST_COUNT);
  const ripples: RingRipple[] = [];
  const view = { cx: 0, cy: 0, radius: 1, rotX: 0, rotY: 0 };

  /** Summed ripple offset at ring angle `u` — the wave travels around the
   *  ring in both directions from the click, meeting at the far side. */
  const waveAt = (u: number, t: number): number => {
    let w = 0;
    for (const rip of ripples) {
      let d = Math.abs(u - rip.u0) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      w += rippleWave(d, t - rip.start);
    }
    return w;
  };

  /** Torus surface point; ripples fatten/pinch the tube (displacement along
   *  the tube normal) as the front passes their ring angle. */
  const torusPoint = (u: number, v: number, t: number): Vec3 => {
    const tube = TUBE_RADIUS + waveAt(u, t);
    const ring = RING_RADIUS + tube * Math.cos(v);
    return [ring * Math.cos(u), tube * Math.sin(v), ring * Math.sin(u)];
  };

  return {
    draw(ctx, f) {
      pruneRipples(ripples, f.t);
      drawDust(ctx, dust, f);

      const [cr, cg, cb] = f.accent;

      view.cx = f.width * 0.66;
      view.cy = f.height * 0.45;
      view.radius = Math.min(f.width, f.height) * 0.26;
      // Mostly face-on with a slow wobble; spinning about Y carries the
      // wireframe around the ring.
      view.rotY = f.t * 0.00014 + f.mx * 0.55;
      view.rotX = -0.95 + 0.12 * Math.sin(f.t * 0.00008) + f.my * 0.4;

      ctx.lineWidth = 1;

      const strokePolyline = (points: Vec3[]) => {
        for (let i = 0; i < points.length - 1; i++) {
          const [ax, ay, az] = points[i];
          const [bx, by, bz] = points[i + 1];
          const depth = 1 - ((az + bz) / 2 + 1.4) / 2.8; // z spans ±(R + tube)
          ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${0.05 + Math.max(0, depth) * 0.3})`;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      };

      const projected = (u: number, v: number): Vec3 => {
        const [px, py, pz] = torusPoint(u, v, f.t);
        return project(px, py, pz, view.rotX, view.rotY, view.cx, view.cy, view.radius);
      };

      // Cross-section circles around the tube.
      for (let s = 0; s < SECTION_COUNT; s++) {
        const u = (s / SECTION_COUNT) * Math.PI * 2;
        const points: Vec3[] = [];
        for (let i = 0; i <= TUBE_STEPS; i++) {
          points.push(projected(u, (i / TUBE_STEPS) * Math.PI * 2));
        }
        strokePolyline(points);
      }

      // Longitudinal spines along the ring.
      for (let s = 0; s < SPINE_COUNT; s++) {
        const v = (s / SPINE_COUNT) * Math.PI * 2;
        const points: Vec3[] = [];
        for (let i = 0; i <= RING_STEPS; i++) {
          points.push(projected((i / RING_STEPS) * Math.PI * 2, v));
        }
        strokePolyline(points);
      }
    },

    click(x, y, t) {
      // Ring topology: find the ring angle whose centerline lands nearest
      // the click and let the wave run around the ring from there.
      const reach = view.radius * (RING_RADIUS + TUBE_RADIUS);
      if (Math.hypot(x - view.cx, y - view.cy) > reach * 1.6) return;
      let bestU = 0;
      let bestDist = Infinity;
      for (let s = 0; s < RING_STEPS; s++) {
        const u = (s / RING_STEPS) * Math.PI * 2;
        const [sx, sy] = project(
          RING_RADIUS * Math.cos(u),
          0,
          RING_RADIUS * Math.sin(u),
          view.rotX,
          view.rotY,
          view.cx,
          view.cy,
          view.radius
        );
        const dist = Math.hypot(sx - x, sy - y);
        if (dist < bestDist) {
          bestDist = dist;
          bestU = u;
        }
      }
      addRipple(ripples, { u0: bestU, start: t });
    },
  };
}

/**
 * "Halo" wallpaper: a slowly spinning wireframe torus in the accent color
 * that tilts toward the cursor over a parallax dust field. Clicking the
 * desktop pinches a wave around the ring. Scaffolding lives in WireCanvas.
 */
/** Matches the 28px dot lattice behind this canvas (wallpaper.tsx). */
const TEXTURE = { kind: "dots", size: 28, dotRadius: 1.5 } as const;

export function HaloCanvas() {
  return <WireCanvas createScene={createHaloScene} texture={TEXTURE} />;
}
