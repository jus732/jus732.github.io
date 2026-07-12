"use client";

import { OrbitCanvas } from "@/components/desktop/orbit-canvas";

export const WALLPAPERS = ["Orbit", "Meridian", "Aurora", "Slate"] as const;

/**
 * Theme-aware wallpapers for the desktop. "Orbit" (default) is the
 * interactive wireframe-sphere canvas; the rest are static CSS. All colors
 * run through the --wall-* / --accent tokens so each variant works in both
 * light and dark mode. Drift animations are gated behind
 * prefers-reduced-motion in globals.css.
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
          <OrbitCanvas />
        </>
      )}

      {name === "Meridian" && (
        <>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(var(--wall-grid) 1px, transparent 1px), linear-gradient(90deg, var(--wall-grid) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
              maskImage: "radial-gradient(ellipse 90% 80% at 50% 40%, black, transparent)",
            }}
          />
          <div
            className="animate-glow-drift absolute left-[8%] top-[-15%] h-[40rem] w-[40rem] rounded-full blur-[140px]"
            style={{ backgroundColor: "var(--wall-glow-a)" }}
          />
          <div
            className="absolute bottom-[-20%] right-[-5%] h-[32rem] w-[32rem] rounded-full blur-[130px]"
            style={{ backgroundColor: "var(--wall-glow-b)" }}
          />
        </>
      )}

      {name === "Aurora" && (
        <>
          <div
            className="animate-aurora absolute left-[-10%] top-[-20%] h-[46rem] w-[46rem] rounded-full blur-[150px]"
            style={{ backgroundColor: "var(--wall-glow-a)" }}
          />
          <div
            className="animate-aurora-slow absolute right-[-12%] top-[10%] h-[38rem] w-[38rem] rounded-full blur-[140px]"
            style={{ backgroundColor: "var(--wall-glow-b)" }}
          />
          <div
            className="animate-aurora absolute bottom-[-25%] left-[25%] h-[34rem] w-[34rem] rounded-full blur-[150px]"
            style={{ backgroundColor: "var(--wall-glow-a)" }}
          />
        </>
      )}

      {name === "Slate" && (
        <>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(var(--wall-grid) 1.5px, transparent 1.5px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, transparent 55%, var(--wall-glow-a) 140%)",
            }}
          />
        </>
      )}
    </div>
  );
}
