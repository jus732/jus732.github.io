"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import { Copy, Minus, Square, X } from "lucide-react";

import type { DesktopApp } from "@/components/desktop/apps";
import { MIN_WINDOW, TASKBAR_HEIGHT, type Rect } from "@/components/desktop/app-meta";
import { useWindows, type WindowState } from "@/components/desktop/window-manager";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

type WindowProps = {
  app: DesktopApp;
  state: WindowState;
};

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const RESIZE_HANDLES: { dir: ResizeDir; className: string }[] = [
  { dir: "n", className: "top-0 inset-x-3 h-1.5 cursor-n-resize" },
  { dir: "s", className: "bottom-0 inset-x-3 h-1.5 cursor-s-resize" },
  { dir: "e", className: "right-0 inset-y-3 w-1.5 cursor-e-resize" },
  { dir: "w", className: "left-0 inset-y-3 w-1.5 cursor-w-resize" },
  { dir: "ne", className: "right-0 top-0 size-3 cursor-ne-resize" },
  { dir: "nw", className: "left-0 top-0 size-3 cursor-nw-resize" },
  { dir: "se", className: "right-0 bottom-0 size-3 cursor-se-resize" },
  { dir: "sw", className: "left-0 bottom-0 size-3 cursor-sw-resize" },
];

/**
 * A desktop window: draggable by its title bar, resizable from every edge
 * and corner, minimizable, maximizable, with a short load-screen veil when
 * it first opens. Geometry is committed to the window manager (and
 * localStorage) when a gesture ends, so each app remembers its last
 * size and position.
 */
export function Window({ app, state }: WindowProps) {
  const { close, minimize, toggleMaximize, focus, setRect, restoreTo, activeId } =
    useWindows();
  const dragControls = useDragControls();
  const reduce = useReducedMotion();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const rootRef = React.useRef<HTMLDivElement>(null);

  // Drag offsets live in motion values; gestures end by folding the offset
  // into the committed rect (inside flushSync) and zeroing these, so the
  // window never visually jumps.
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const maximized = state.maximized || isMobile;
  const active = activeId === app.id;
  const { rect } = state;

  // Drag bounds as plain pixel offsets from the window's layout position,
  // resolved by Framer at drag start. Deliberately NOT a ref to the desktop
  // element: ref-based dragConstraints attach a ResizeObserver to the window
  // and re-anchor it (via a transform) whenever its size changes, which
  // fights the resize gesture below.
  const dragBounds =
    typeof window === "undefined"
      ? undefined
      : (() => {
          const areaW = window.innerWidth;
          const areaH = window.innerHeight - TASKBAR_HEIGHT;
          return {
            left: -rect.x,
            top: -rect.y,
            right: Math.max(-rect.x, areaW - rect.w - rect.x),
            bottom: Math.max(-rect.y, areaH - rect.h - rect.y),
          };
        })();

  // Boot veil: a brief "starting up" screen before the content fades in.
  const [booting, setBooting] = React.useState(true);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), reduce ? 150 : 850);
    return () => window.clearTimeout(timer);
  }, [reduce]);

  React.useEffect(() => {
    if (maximized) {
      x.set(0);
      y.set(0);
    }
  }, [maximized, x, y]);

  /* ----- Title-bar drag (including drag-out-of-maximized) ----- */

  // Pointer-down position while maximized; a real drag past the threshold
  // restores the window under the cursor (Windows behavior).
  const pendingRestore = React.useRef<{ px: number; py: number } | null>(null);

  function handleTitlePointerDown(e: React.PointerEvent) {
    if (isMobile) return;
    if (state.maximized) {
      pendingRestore.current = { px: e.clientX, py: e.clientY };
      return;
    }
    dragControls.start(e);
  }

  function handleTitlePointerMove(e: React.PointerEvent) {
    const start = pendingRestore.current;
    if (!start) return;
    if (Math.hypot(e.clientX - start.px, e.clientY - start.py) < 6) return;
    pendingRestore.current = null;

    // Restore to the remembered size, keeping the cursor at the same
    // proportional position along the title bar.
    const nx = Math.round(e.clientX - rect.w * (e.clientX / window.innerWidth));
    const ny = Math.max(0, e.clientY - 20);
    // flushSync so the un-maximized geometry is in the DOM before Framer
    // starts measuring the drag.
    flushSync(() => restoreTo(app.id, { x: nx, y: ny, w: rect.w, h: rect.h }));
    dragControls.start(e);
  }

  function handleDragEnd() {
    const next = { x: rect.x + x.get(), y: rect.y + y.get(), w: rect.w, h: rect.h };
    flushSync(() => setRect(app.id, next));
    x.set(0);
    y.set(0);
  }

  /* ----- Edge / corner resize ----- */

  function startResize(e: React.PointerEvent, dir: ResizeDir) {
    if (maximized || isMobile) return;
    e.preventDefault();
    e.stopPropagation();
    focus(app.id);

    const start = { px: e.clientX, py: e.clientY, ...rect };
    const el = rootRef.current;
    if (!el) return;
    const areaW = window.innerWidth;
    const areaH = window.innerHeight - TASKBAR_HEIGHT;
    let latest: Rect = rect;

    // Mutate the element directly during the gesture (60fps without React
    // re-renders); commit to state + localStorage once on pointer-up.
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - start.px;
      const dy = ev.clientY - start.py;
      let { x: nx, y: ny, w: nw, h: nh } = start;

      if (dir.includes("e")) nw = start.w + dx;
      if (dir.includes("s")) nh = start.h + dy;
      if (dir.includes("w")) {
        nw = start.w - dx;
        nx = start.x + dx;
      }
      if (dir.includes("n")) {
        nh = start.h - dy;
        ny = start.y + dy;
      }

      // Enforce minimums without letting n/w edges push the window around.
      if (nw < MIN_WINDOW.w) {
        if (dir.includes("w")) nx -= MIN_WINDOW.w - nw;
        nw = MIN_WINDOW.w;
      }
      if (nh < MIN_WINDOW.h) {
        if (dir.includes("n")) ny -= MIN_WINDOW.h - nh;
        nh = MIN_WINDOW.h;
      }
      nx = Math.max(0, nx);
      ny = Math.max(0, ny);
      nw = Math.min(nw, areaW - nx);
      nh = Math.min(nh, areaH - ny);

      latest = { x: nx, y: ny, w: nw, h: nh };
      el.style.left = `${nx}px`;
      el.style.top = `${ny}px`;
      el.style.width = `${nw}px`;
      el.style.height = `${nh}px`;
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      setRect(app.id, latest);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }

  const Content = app.content;

  return (
    <motion.div
      ref={rootRef}
      role="dialog"
      aria-label={app.title}
      onPointerDown={() => focus(app.id)}
      drag={!isMobile && !state.maximized}
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={dragBounds}
      onDragEnd={handleDragEnd}
      initial={reduce ? false : { opacity: 0, scale: 0.86, y: 42 }}
      animate={state.minimized ? "minimized" : "visible"}
      variants={{
        visible: {
          opacity: 1,
          scale: 1,
          y: 0,
          display: "flex",
          transition: reduce
            ? { duration: 0.1 }
            : { type: "spring", stiffness: 260, damping: 26 },
        },
        minimized: {
          opacity: 0,
          scale: 0.9,
          y: 80,
          transition: { duration: reduce ? 0.05 : 0.22, ease: "easeIn" },
          transitionEnd: { display: "none" },
        },
      }}
      exit={{
        opacity: 0,
        scale: 0.92,
        transition: { duration: reduce ? 0.05 : 0.16, ease: "easeIn" },
      }}
      style={
        maximized
          ? { zIndex: state.z, x, y, left: 0, top: 0, width: "100%", height: "100%" }
          : {
              zIndex: state.z,
              x,
              y,
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
            }
      }
      className={cn(
        "absolute flex flex-col overflow-hidden border bg-card/95 shadow-2xl backdrop-blur-md",
        maximized ? "rounded-none border-transparent" : "rounded-xl",
        !maximized && (active ? "border-accent/40" : "border-border")
      )}
    >
      {/* Title bar */}
      <div
        onPointerDown={handleTitlePointerDown}
        onPointerMove={handleTitlePointerMove}
        onPointerUp={() => (pendingRestore.current = null)}
        onDoubleClick={() => !isMobile && toggleMaximize(app.id)}
        className={cn(
          "flex h-10 shrink-0 touch-none select-none items-center gap-2.5 border-b border-border px-3",
          active ? "bg-muted/60" : "bg-transparent"
        )}
      >
        <app.icon
          className={cn("size-4", active ? "text-accent" : "text-muted-foreground")}
          strokeWidth={1.75}
        />
        <span className="text-sm font-medium">{app.title}</span>

        <div
          className="ml-auto flex items-center gap-0.5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            aria-label={`Minimize ${app.title}`}
            onClick={() => minimize(app.id)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Minus className="size-3.5" />
          </button>
          <button
            aria-label={state.maximized ? `Restore ${app.title}` : `Maximize ${app.title}`}
            onClick={() => toggleMaximize(app.id)}
            className="hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:block"
          >
            {state.maximized ? <Copy className="size-3.5" /> : <Square className="size-3" />}
          </button>
          <button
            aria-label={`Close ${app.title}`}
            onClick={() => close(app.id)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-500 hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className={cn(
          "@container relative flex-1 overflow-y-auto overscroll-contain",
          app.padded && "p-5 sm:p-6"
        )}
      >
        <Content />

        {/* Load-screen veil shown while the "program" boots */}
        <AnimatePresence>
          {booting && (
            <motion.div
              initial={false}
              exit={{ opacity: 0, transition: { duration: 0.35, ease: "easeOut" } }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-card"
            >
              <app.icon className="size-8 text-accent" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">Starting {app.title}</p>
              <div className="h-1 w-40 overflow-hidden rounded-lg bg-muted">
                <div className="animate-boot-sweep h-full w-full rounded-lg bg-accent" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Resize handles (desktop, windowed mode only) */}
      {!maximized && !isMobile && (
        <>
          {RESIZE_HANDLES.map(({ dir, className }) => (
            <div
              key={dir}
              onPointerDown={(e) => startResize(e, dir)}
              className={cn("absolute z-20 touch-none", className)}
            />
          ))}
        </>
      )}
    </motion.div>
  );
}
