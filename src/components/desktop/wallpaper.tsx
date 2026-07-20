"use client";

import { OrbitCanvas } from "@/components/desktop/wallpaper/orbit-canvas";
import { HaloCanvas } from "@/components/desktop/wallpaper/halo-canvas";
import { PrismCanvas } from "@/components/desktop/wallpaper/prism-canvas";

export const WALLPAPERS = ["Orbit", "Halo", "Prism"] as const;

/** Accent-tinted 1px line color for the lit copies of the wall textures. */
const GLOW_LINE = "color-mix(in srgb, var(--accent) 50%, transparent)";

/**
 * Cursor-following glow masked to the active texture: the same geometry as
 * the blueprint layer beneath, redrawn in accent plus a faint wash, clipped
 * to a soft circle around the pointer so the texture lights up under the
 * cursor. The --wall-x/y vars are written by WireCanvas's existing
 * mousemove listener (no second listener, no React state per move); they
 * default far off-screen so nothing shows before the pointer arrives, and
 * reduced motion hides the layer entirely (the listener is also absent).
 */
function GridGlow({
  backgroundImage,
  backgroundSize,
}: {
  backgroundImage: string;
  backgroundSize?: string;
}) {
  const mask =
    "radial-gradient(16rem circle at var(--wall-x, -100rem) var(--wall-y, -100rem), black, transparent 75%)";
  return (
    <div
      className="absolute inset-0 motion-reduce:hidden"
      style={{
        backgroundImage: `radial-gradient(16rem circle at var(--wall-x, -100rem) var(--wall-y, -100rem), color-mix(in srgb, var(--accent) 7%, transparent), transparent 70%), ${backgroundImage}`,
        backgroundSize: backgroundSize ? `100% 100%, ${backgroundSize}` : undefined,
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    />
  );
}

/**
 * Theme-aware wallpapers for the desktop: three interactive wireframe
 * canvases (sphere / torus / icosahedron) over distinct blueprint textures,
 * each with a cursor-following glow masked to its texture. All colors run
 * through the --wall-* / --accent tokens so each variant works in both
 * light and dark mode; motion, the lit grid, and click ripples are gated
 * behind prefers-reduced-motion inside WireCanvas / via motion-reduce.
 * Everything here sits on pointer-events-none layers behind the desktop UI.
 */
export function Wallpaper({ variant }: { variant: number }) {
  const name = WALLPAPERS[((variant % WALLPAPERS.length) + WALLPAPERS.length) % WALLPAPERS.length];

  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundColor: "var(--wall-base)" }}
    >
      {name === "Orbit" && (
        <>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(var(--wall-grid) 1px, transparent 1px), linear-gradient(90deg, var(--wall-grid) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
              maskImage: "radial-gradient(ellipse 85% 75% at 60% 45%, black, transparent)",
            }}
          />
          <GridGlow
            backgroundImage={`linear-gradient(${GLOW_LINE} 1px, transparent 1px), linear-gradient(90deg, ${GLOW_LINE} 1px, transparent 1px)`}
            backgroundSize="64px 64px, 64px 64px"
          />
          <OrbitCanvas />
        </>
      )}

      {name === "Halo" && (
        <>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(var(--wall-grid) 1.5px, transparent 1.5px)",
              backgroundSize: "28px 28px",
              maskImage: "radial-gradient(ellipse 90% 80% at 55% 45%, black, transparent)",
            }}
          />
          <GridGlow
            backgroundImage={`radial-gradient(color-mix(in srgb, var(--accent) 60%, transparent) 1.5px, transparent 1.5px)`}
            backgroundSize="28px 28px"
          />
          <HaloCanvas />
        </>
      )}

      {name === "Prism" && (
        <>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, var(--wall-grid) 0 1px, transparent 1px 48px), repeating-linear-gradient(-45deg, var(--wall-grid) 0 1px, transparent 1px 48px)",
              maskImage: "radial-gradient(ellipse 85% 75% at 60% 45%, black, transparent)",
            }}
          />
          <GridGlow
            backgroundImage={`repeating-linear-gradient(45deg, ${GLOW_LINE} 0 1px, transparent 1px 48px), repeating-linear-gradient(-45deg, ${GLOW_LINE} 0 1px, transparent 1px 48px)`}
          />
          <PrismCanvas />
        </>
      )}
    </div>
  );
}
