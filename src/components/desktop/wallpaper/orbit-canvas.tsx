"use client";

import {
  WireCanvas,
  project,
  unrotate,
  makeDust,
  drawDust,
  addRipple,
  pruneRipples,
  rippleWave,
  type RippleBase,
  type Vec3,
  type WireScene,
} from "@/components/desktop/wallpaper/wire-canvas";

const LAT_RINGS = 8; // horizontal circles
const LON_LINES = 14; // vertical meridians
const LON_STEPS = 48; // segments per meridian / ring
const DUST_COUNT = 70;

/** Ripple origin: a unit direction in the sphere's model space. */
type SphereRipple = RippleBase & { origin: Vec3 };

function createOrbitScene(): WireScene {
  const dust = makeDust(DUST_COUNT);
  const ripples: SphereRipple[] = [];
  // Last frame's placement/rotation, kept so clicks can be mapped back
  // onto the sphere's surface.
  const view = { cx: 0, cy: 0, radius: 1, rotX: 0, rotY: 0 };

  /** Unit sphere point scaled by the summed ripple offsets at its position. */
  const displaced = (px: number, py: number, pz: number, t: number): Vec3 => {
    let r = 1;
    for (const rip of ripples) {
      const dot = px * rip.origin[0] + py * rip.origin[1] + pz * rip.origin[2];
      const dist = Math.acos(Math.max(-1, Math.min(1, dot)));
      r += rippleWave(dist, t - rip.start);
    }
    return [px * r, py * r, pz * r];
  };

  return {
    draw(ctx, f) {
      pruneRipples(ripples, f.t);
      drawDust(ctx, dust, f);

      const [cr, cg, cb] = f.accent;

      // Sphere placement: right of center, clear of the icon column.
      view.cx = f.width * 0.68;
      view.cy = f.height * 0.44;
      view.radius = Math.min(f.width, f.height) * 0.32;
      view.rotY = f.t * 0.00012 + f.mx * 0.55;
      view.rotX = -0.28 + f.my * 0.4;

      ctx.lineWidth = 1;

      const strokePolyline = (points: Vec3[]) => {
        for (let i = 0; i < points.length - 1; i++) {
          const [ax, ay, az] = points[i];
          const [bx, by, bz] = points[i + 1];
          // Back-of-sphere lines fade out for depth.
          const depth = 1 - ((az + bz) / 2 + 1) / 2;
          ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${0.05 + depth * 0.28})`;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      };

      const spherePoint = (phi: number, theta: number): Vec3 => {
        const [px, py, pz] = displaced(
          Math.sin(phi) * Math.cos(theta),
          Math.cos(phi),
          Math.sin(phi) * Math.sin(theta),
          f.t
        );
        return project(px, py, pz, view.rotX, view.rotY, view.cx, view.cy, view.radius);
      };

      // Latitude rings.
      for (let ring = 1; ring <= LAT_RINGS; ring++) {
        const phi = (ring / (LAT_RINGS + 1)) * Math.PI;
        const points: Vec3[] = [];
        for (let s = 0; s <= LON_STEPS; s++) {
          points.push(spherePoint(phi, (s / LON_STEPS) * Math.PI * 2));
        }
        strokePolyline(points);
      }

      // Longitude meridians.
      for (let lon = 0; lon < LON_LINES; lon++) {
        const theta = (lon / LON_LINES) * Math.PI * 2;
        const points: Vec3[] = [];
        for (let s = 0; s <= LON_STEPS; s++) {
          points.push(spherePoint((s / LON_STEPS) * Math.PI, theta));
        }
        strokePolyline(points);
      }
    },

    click(x, y, t) {
      // Project the click onto the front hemisphere (clamping clicks just
      // outside the silhouette to the rim), then undo the current rotation
      // to get a model-space origin the wavefront can expand from.
      let dx = (x - view.cx) / view.radius;
      let dy = (y - view.cy) / view.radius;
      const len = Math.hypot(dx, dy);
      if (len > 1.5) return; // too far from the sphere to feel connected
      if (len > 0.999) {
        dx = (dx / len) * 0.999;
        dy = (dy / len) * 0.999;
      }
      const dz = -Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
      addRipple(ripples, {
        origin: unrotate(dx, dy, dz, view.rotX, view.rotY),
        start: t,
      });
    },
  };
}

/**
 * Interactive desktop background: a slowly rotating wireframe sphere drawn
 * in the accent color that tilts toward the cursor over a parallax dust
 * field. Clicking the desktop sends a shockwave rippling across the
 * surface. Scaffolding (loop, resize, accent reads, reduced-motion gating)
 * lives in WireCanvas.
 */
/** Matches the 64px square grid behind this canvas (wallpaper.tsx). */
const TEXTURE = { kind: "grid", size: 64 } as const;

export function OrbitCanvas() {
  return <WireCanvas createScene={createOrbitScene} texture={TEXTURE} />;
}
