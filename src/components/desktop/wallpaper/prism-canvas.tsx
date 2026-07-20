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

const DUST_COUNT = 55;
// Facets translate as rigid plates, so exaggerate the shared wave a touch.
const FACET_GAIN = 1.5;

/** Icosahedron vertices (golden-ratio construction), normalized to r = 1. */
const PHI = (1 + Math.sqrt(5)) / 2;
const NORM = Math.hypot(1, PHI);
const VERTICES: Vec3[] = (
  [
    [-1, PHI, 0],
    [1, PHI, 0],
    [-1, -PHI, 0],
    [1, -PHI, 0],
    [0, -1, PHI],
    [0, 1, PHI],
    [0, -1, -PHI],
    [0, 1, -PHI],
    [PHI, 0, -1],
    [PHI, 0, 1],
    [-PHI, 0, -1],
    [-PHI, 0, 1],
  ] as Vec3[]
).map(([x, y, z]) => [x / NORM, y / NORM, z / NORM]);

const FACES: [number, number, number][] = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

/** Unit face normals (≡ normalized centroids for an origin-centered solid). */
const NORMALS: Vec3[] = FACES.map(([a, b, c]) => {
  const nx = VERTICES[a][0] + VERTICES[b][0] + VERTICES[c][0];
  const ny = VERTICES[a][1] + VERTICES[b][1] + VERTICES[c][1];
  const nz = VERTICES[a][2] + VERTICES[b][2] + VERTICES[c][2];
  const len = Math.hypot(nx, ny, nz);
  return [nx / len, ny / len, nz / len];
});

/** Ripple origin: a unit direction in the solid's model space. */
type SphereRipple = RippleBase & { origin: Vec3 };

function createPrismScene(): WireScene {
  const dust = makeDust(DUST_COUNT);
  const ripples: SphereRipple[] = [];
  const view = { cx: 0, cy: 0, radius: 1, rotX: 0, rotY: 0 };

  return {
    draw(ctx, f) {
      pruneRipples(ripples, f.t);
      drawDust(ctx, dust, f);

      const [cr, cg, cb] = f.accent;

      view.cx = f.width * 0.67;
      view.cy = f.height * 0.44;
      view.radius = Math.min(f.width, f.height) * 0.3;
      view.rotY = f.t * 0.00013 + f.mx * 0.55;
      view.rotX = -0.3 + 0.1 * Math.sin(f.t * 0.00007) + f.my * 0.4;

      ctx.lineWidth = 1;

      // Flat facets: each face translates rigidly along its normal as the
      // wavefront passes its centroid, so plates pop apart and reseat.
      // Every edge is shared by two faces, halving the stroke alpha keeps
      // the resting weight in line with the other wallpapers.
      for (let i = 0; i < FACES.length; i++) {
        const n = NORMALS[i];
        let offset = 0;
        for (const rip of ripples) {
          const dot = n[0] * rip.origin[0] + n[1] * rip.origin[1] + n[2] * rip.origin[2];
          offset +=
            rippleWave(Math.acos(Math.max(-1, Math.min(1, dot))), f.t - rip.start) *
            FACET_GAIN;
        }

        const corners = FACES[i].map((vi) => {
          const [vx, vy, vz] = VERTICES[vi];
          return project(
            vx + n[0] * offset,
            vy + n[1] * offset,
            vz + n[2] * offset,
            view.rotX,
            view.rotY,
            view.cx,
            view.cy,
            view.radius
          );
        });

        const depth = 1 - ((corners[0][2] + corners[1][2] + corners[2][2]) / 3 + 1) / 2;
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${0.03 + depth * 0.17})`;
        ctx.beginPath();
        ctx.moveTo(corners[0][0], corners[0][1]);
        ctx.lineTo(corners[1][0], corners[1][1]);
        ctx.lineTo(corners[2][0], corners[2][1]);
        ctx.closePath();
        ctx.stroke();
      }
    },

    click(x, y, t) {
      // Project the click onto the front of the circumsphere and undo the
      // rotation, same mapping as Orbit; facets react by centroid distance.
      let dx = (x - view.cx) / view.radius;
      let dy = (y - view.cy) / view.radius;
      const len = Math.hypot(dx, dy);
      if (len > 1.5) return;
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
 * "Prism" wallpaper: a slowly tumbling wireframe icosahedron in the accent
 * color that tilts toward the cursor over a parallax dust field. Clicking
 * the desktop pops its facets outward in a travelling wave. Scaffolding
 * lives in WireCanvas.
 */
/** Matches the 48px diagonal crosshatch behind this canvas (wallpaper.tsx). */
const TEXTURE = { kind: "diag", size: 48 } as const;

export function PrismCanvas() {
  return <WireCanvas createScene={createPrismScene} texture={TEXTURE} />;
}
