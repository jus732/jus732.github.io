"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { stickVector } from "@/components/desktop/touch/stick-math";

const RADIUS = 56;

type VirtualStickProps = {
  /** Positions the touch zone, e.g. "absolute inset-y-0 left-0 z-10 w-1/2". */
  className?: string;
  onEngage?: () => void;
  /** Normalized deflection (magnitude 0..1), fired on every pointer move. */
  onVector: (x: number, y: number) => void;
  onRelease?: () => void;
};

/**
 * Floating-origin virtual thumb stick. The base ring appears wherever the
 * pointer lands inside the zone; the knob tracks the pointer clamped to the
 * ring radius. Per-frame updates mutate styles directly - no re-renders.
 */
export function VirtualStick({
  className,
  onEngage,
  onVector,
  onRelease,
}: VirtualStickProps) {
  const baseRef = React.useRef<HTMLDivElement>(null);
  const knobRef = React.useRef<HTMLDivElement>(null);
  const pointerRef = React.useRef<{ id: number; x: number; y: number } | null>(null);

  const releaseRef = React.useRef<() => void>(() => {});
  releaseRef.current = () => {
    if (!pointerRef.current) return;
    pointerRef.current = null;
    if (baseRef.current) baseRef.current.style.opacity = "0";
    if (knobRef.current) knobRef.current.style.transform = "translate(0px, 0px)";
    onVector(0, 0);
    onRelease?.();
  };

  // The zone unmounts when play stops (pause, game over); zero the vector.
  React.useEffect(() => () => releaseRef.current(), []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerRef.current) return; // one pointer per stick
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    const rect = e.currentTarget.getBoundingClientRect();
    const base = baseRef.current;
    if (base) {
      base.style.left = `${e.clientX - rect.left}px`;
      base.style.top = `${e.clientY - rect.top}px`;
      base.style.opacity = "1";
    }
    onEngage?.();
    onVector(0, 0);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerRef.current;
    if (!start || e.pointerId !== start.id) return;
    const v = stickVector(e.clientX - start.x, e.clientY - start.y, RADIUS);
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${v.x * RADIUS}px, ${v.y * RADIUS}px)`;
    }
    onVector(v.x, v.y);
  };

  const endIfTracked = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerRef.current?.id === e.pointerId) releaseRef.current();
  };

  return (
    <div
      className={cn("touch-none select-none", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endIfTracked}
      onPointerCancel={endIfTracked}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Base ring, centered on the touch point via negative margins; the
          knob's transform is mutated directly while dragging, so neither
          element uses Tailwind translate utilities. */}
      <div
        ref={baseRef}
        aria-hidden
        className="pointer-events-none absolute -ml-14 -mt-14 size-28 rounded-full border border-border/60 bg-card/30 opacity-0 backdrop-blur-sm transition-opacity duration-100"
      >
        <div
          ref={knobRef}
          className="absolute left-1/2 top-1/2 -ml-6 -mt-6 size-12 rounded-full border border-accent/60 bg-accent/25 shadow-[0_0_16px_rgba(125,249,255,0.35)]"
        />
      </div>
    </div>
  );
}
