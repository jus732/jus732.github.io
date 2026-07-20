"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

const SWATCHES = [
  "#4d9fff", // accent blue
  "#e6e9ef", // light
  "#8b94a7", // gray
  "#ef4444", // red
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ec4899", // pink
];

const BRUSH_SIZES = [3, 6, 12, 20];

/**
 * Paint: freehand drawing on a canvas with color swatches, a custom color
 * picker, brush sizes, and clear. The bitmap is preserved when the window
 * is resized (copied through an offscreen canvas).
 */
export function PaintApp() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const drawing = React.useRef(false);
  const last = React.useRef({ x: 0, y: 0 });

  const [color, setColor] = React.useState(SWATCHES[0]);
  const [size, setSize] = React.useState(BRUSH_SIZES[1]);

  // Handlers read these via refs so the canvas listeners never go stale.
  const colorRef = React.useRef(color);
  const sizeRef = React.useRef(size);
  colorRef.current = color;
  sizeRef.current = size;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      // Layout size, not getBoundingClientRect: the window mounts mid
      // scale-in animation, and a transformed measurement would leave the
      // bitmap undersized (strokes then land below-right of the cursor).
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      // Preserve the existing drawing across resizes.
      const snapshot = document.createElement("canvas");
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      snapshot.getContext("2d")?.drawImage(canvas, 0, 0);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      if (snapshot.width > 0 && snapshot.height > 0) {
        ctx.drawImage(snapshot, 0, 0, snapshot.width / dpr, snapshot.height / dpr);
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  function pointFromEvent(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // Map through the visual-to-layout ratio so strokes stay under the
    // cursor even while an ancestor transform is scaling the window.
    const scaleX = rect.width > 0 ? canvas.clientWidth / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.clientHeight / rect.height : 1;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function handlePointerDown(e: React.PointerEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pointFromEvent(e);
    // Draw a dot so single clicks leave a mark.
    drawSegment(last.current, last.current);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drawing.current) return;
    const point = pointFromEvent(e);
    drawSegment(last.current, point);
    last.current = point;
  }

  function drawSegment(from: { x: number; y: number }, to: { x: number; y: number }) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = colorRef.current;
    ctx.lineWidth = sizeRef.current;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-2">
        <div className="flex items-center gap-1.5">
          {SWATCHES.map((swatch) => (
            <button
              key={swatch}
              onClick={() => setColor(swatch)}
              aria-label={`Color ${swatch}`}
              style={{ backgroundColor: swatch }}
              className={cn(
                "size-5 rounded-lg border transition-transform hover:scale-110",
                color === swatch
                  ? "border-foreground ring-1 ring-foreground"
                  : "border-border"
              )}
            />
          ))}
          <label className="relative ml-1 cursor-pointer">
            <span
              className="block size-5 rounded-lg border border-border"
              style={{
                background:
                  "conic-gradient(#ef4444, #f59e0b, #10b981, #4d9fff, #ec4899, #ef4444)",
              }}
            />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Custom color"
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </label>
        </div>

        <div className="flex items-center gap-1.5">
          {BRUSH_SIZES.map((brush) => (
            <button
              key={brush}
              onClick={() => setSize(brush)}
              aria-label={`Brush size ${brush}`}
              className={cn(
                "flex size-7 items-center justify-center rounded-lg transition-colors",
                size === brush ? "bg-muted" : "hover:bg-muted/60"
              )}
            >
              <span
                className="rounded-full bg-foreground"
                style={{ width: Math.min(brush, 16), height: Math.min(brush, 16) }}
              />
            </button>
          ))}
        </div>

        <button
          onClick={clearCanvas}
          aria-label="Clear canvas"
          className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Trash2 className="size-3.5" />
          Clear
        </button>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => (drawing.current = false)}
          onPointerCancel={() => (drawing.current = false)}
          className="absolute inset-0 size-full cursor-crosshair touch-none"
        />
      </div>
    </div>
  );
}
