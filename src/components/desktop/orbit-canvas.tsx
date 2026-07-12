"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";

const LAT_RINGS = 8; // horizontal circles
const LON_LINES = 14; // vertical meridians
const LON_STEPS = 48; // segments per meridian / ring
const DUST_COUNT = 70;
const FOCAL = 3.2; // perspective strength

type Dust = { x: number; y: number; depth: number; r: number; phase: number };

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const n = parseInt(
    value.length === 3 ? value.split("").map((c) => c + c).join("") : value,
    16
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Interactive desktop background: a slowly rotating wireframe sphere drawn
 * in the accent color that tilts toward the cursor, over a faint parallax
 * dust field. Canvas 2D, a few hundred line segments per frame, no React
 * state in the loop. Under prefers-reduced-motion it renders one static
 * frame and skips the mouse listener entirely.
 */
export function OrbitCanvas() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Mouse state lives outside React; target is set by the listener,
    // current eases toward it each frame.
    const mouse = { tx: 0, ty: 0, x: 0, y: 0 };

    let accent: [number, number, number] = [77, 159, 255];
    const readAccent = () => {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim();
      if (value.startsWith("#")) accent = hexToRgb(value);
    };
    readAccent();

    // Deterministic-enough dust field, generated once per mount.
    const dust: Dust[] = Array.from({ length: DUST_COUNT }, () => ({
      x: Math.random(),
      y: Math.random(),
      depth: 0.25 + Math.random() * 0.75,
      r: 0.6 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
    }));

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduce) draw(0);
    };

    const project = (
      px: number,
      py: number,
      pz: number,
      rotX: number,
      rotY: number,
      cx: number,
      cy: number,
      radius: number
    ): [number, number, number] => {
      // Rotate around Y, then X.
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
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      if (width === 0 || height === 0) return;

      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      const [cr, cg, cb] = accent;

      // Dust field with slight mouse parallax and a slow twinkle.
      for (const d of dust) {
        const alpha = 0.1 + 0.12 * (0.5 + 0.5 * Math.sin(t * 0.0006 + d.phase));
        ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha * d.depth})`;
        ctx.beginPath();
        ctx.arc(
          d.x * width - mouse.x * 22 * d.depth,
          d.y * height - mouse.y * 14 * d.depth,
          d.r,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      // Sphere placement: right of center, clear of the icon column.
      const cx = width * 0.68;
      const cy = height * 0.44;
      const radius = Math.min(width, height) * 0.32;
      const rotY = t * 0.00012 + mouse.x * 0.55;
      const rotX = -0.28 + mouse.y * 0.4;

      ctx.lineWidth = 1;

      const strokePolyline = (points: [number, number, number][]) => {
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

      // Latitude rings.
      for (let ring = 1; ring <= LAT_RINGS; ring++) {
        const phi = (ring / (LAT_RINGS + 1)) * Math.PI;
        const points: [number, number, number][] = [];
        for (let s = 0; s <= LON_STEPS; s++) {
          const theta = (s / LON_STEPS) * Math.PI * 2;
          points.push(
            project(
              Math.sin(phi) * Math.cos(theta),
              Math.cos(phi),
              Math.sin(phi) * Math.sin(theta),
              rotX,
              rotY,
              cx,
              cy,
              radius
            )
          );
        }
        strokePolyline(points);
      }

      // Longitude meridians.
      for (let lon = 0; lon < LON_LINES; lon++) {
        const theta = (lon / LON_LINES) * Math.PI * 2;
        const points: [number, number, number][] = [];
        for (let s = 0; s <= LON_STEPS; s++) {
          const phi = (s / LON_STEPS) * Math.PI;
          points.push(
            project(
              Math.sin(phi) * Math.cos(theta),
              Math.cos(phi),
              Math.sin(phi) * Math.sin(theta),
              rotX,
              rotY,
              cx,
              cy,
              radius
            )
          );
        }
        strokePolyline(points);
      }
    };

    let raf = 0;
    const loop = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    const onMouseMove = (e: MouseEvent) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };

    // Re-read the accent when the theme class flips.
    const themeObserver = new MutationObserver(() => {
      readAccent();
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
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      themeObserver.disconnect();
    };
  }, [reduce]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full"
    />
  );
}
