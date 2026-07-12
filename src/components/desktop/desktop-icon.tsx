"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, motion, MotionConfig, useMotionValue } from "framer-motion";

import type { DesktopApp } from "@/components/desktop/apps";
import { TASKBAR_HEIGHT } from "@/components/desktop/app-meta";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

export type IconMetrics = {
  /** Grid cell pitch in px. */
  grid: number;
  /** Icon footprint in px. */
  w: number;
  h: number;
  /** Rounded icon square in px. */
  box: number;
  /** Glyph size in px. */
  glyph: number;
};

type DesktopIconProps = {
  app: DesktopApp;
  /** Display label (may be a user rename). */
  label: string;
  metrics: IconMetrics;
  selected: boolean;
  renaming: boolean;
  onRenameCommit: (name: string) => void;
  onRenameCancel: () => void;
  onSelect: () => void;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  /** Position on the desktop; undefined = static flow (mobile). */
  pos?: { x: number; y: number };
  /** Group-drag callbacks; deltas are px offsets from the drag origin. */
  onDragStartGroup?: () => void;
  onDragMoveGroup?: (dx: number, dy: number) => void;
  onDragEndGroup?: (dx: number, dy: number) => void;
  /** Lets the parent shift this node during a group drag. */
  registerNode?: (el: HTMLDivElement | null) => void;
};

const PREVIEW_DELAY_MS = 450;
const PREVIEW_HEIGHT = 300;
const DRAG_CLICK_SUPPRESS_MS = 250;

/**
 * A desktop program icon. Single click selects, double click opens
 * (single tap on touch devices). Freely draggable on desktop viewports;
 * the parent commits drops (with optional grid snapping) and moves any
 * other selected icons along as a group. Hovering long enough shows a
 * preview card with a scaled-down live render of the app's content.
 */
export function DesktopIcon({
  app,
  label,
  metrics,
  selected,
  renaming,
  onRenameCommit,
  onRenameCancel,
  onSelect,
  onOpen,
  onContextMenu,
  pos,
  onDragStartGroup,
  onDragMoveGroup,
  onDragEndGroup,
  registerNode,
}: DesktopIconProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const timer = React.useRef<number | undefined>(undefined);
  const canHover = useMediaQuery("(hover: hover) and (pointer: fine)");
  const [preview, setPreview] = React.useState<{ top: number; left: number } | null>(null);
  const [dragging, setDragging] = React.useState(false);
  // Framer fires a click after drag release; swallow it briefly.
  const suppressClickUntil = React.useRef(0);

  const draggable = Boolean(pos) && !renaming;
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Plain-object drag bounds (px offsets from the icon's position).
  // Deliberately not a ref: ref constraints attach resize observers that
  // re-anchor elements via transforms.
  const dragBounds =
    pos && typeof window !== "undefined"
      ? {
          left: -pos.x,
          top: -pos.y,
          right: Math.max(-pos.x, window.innerWidth - metrics.w - pos.x),
          bottom: Math.max(
            -pos.y,
            window.innerHeight - TASKBAR_HEIGHT - metrics.h - pos.y
          ),
        }
      : undefined;

  function clearPreview() {
    window.clearTimeout(timer.current);
    setPreview(null);
  }

  function handleMouseEnter() {
    if (!canHover || dragging || renaming) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      setPreview({
        top: Math.min(rect.top, window.innerHeight - PREVIEW_HEIGHT - 72),
        left: rect.right + 12,
      });
    }, PREVIEW_DELAY_MS);
  }

  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  const Content = app.content;

  return (
    <>
      <motion.div
        ref={(el: HTMLDivElement | null) => {
          ref.current = el;
          registerNode?.(el);
        }}
        role="button"
        tabIndex={0}
        drag={draggable}
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={dragBounds}
        onDragStart={() => {
          clearPreview();
          setDragging(true);
          onDragStartGroup?.();
        }}
        onDrag={() => onDragMoveGroup?.(x.get(), y.get())}
        onDragEnd={() => {
          setDragging(false);
          suppressClickUntil.current = performance.now() + DRAG_CLICK_SUPPRESS_MS;
          // Commit inside a flush, then zero the motion values in the same
          // frame so nothing visually jumps.
          flushSync(() => onDragEndGroup?.(x.get(), y.get()));
          x.set(0);
          y.set(0);
        }}
        whileDrag={{ scale: 1.08, opacity: 0.75, zIndex: 40 }}
        style={
          pos
            ? { position: "absolute", left: pos.x, top: pos.y, width: metrics.w, x, y }
            : { width: metrics.w }
        }
        onClick={(e) => {
          e.stopPropagation();
          if (performance.now() < suppressClickUntil.current) return;
          if (renaming) return;
          clearPreview();
          // Single tap opens on touch devices; pointer devices select.
          if (!canHover) onOpen();
          else onSelect();
        }}
        onKeyDown={(e) => {
          if (renaming) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            clearPreview();
            onOpen();
          }
        }}
        onDoubleClick={() => {
          if (renaming) return;
          clearPreview();
          onOpen();
        }}
        onContextMenu={(e) => {
          clearPreview();
          onContextMenu(e);
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={clearPreview}
        onBlur={clearPreview}
        aria-label={`Open ${label}`}
        className={cn(
          "group flex cursor-default flex-col items-center gap-1.5 rounded-xl p-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          draggable && "touch-none",
          dragging && "cursor-grabbing shadow-2xl",
          selected ? "bg-accent/20 ring-1 ring-accent/40" : "hover:bg-foreground/5"
        )}
      >
        <span
          style={{ width: metrics.box, height: metrics.box }}
          className="flex items-center justify-center rounded-xl border border-glass-border bg-glass shadow-sm backdrop-blur-md transition-transform duration-200 group-hover:scale-105"
        >
          <app.icon
            style={{ width: metrics.glyph, height: metrics.glyph }}
            className="text-accent"
            strokeWidth={1.6}
          />
        </span>
        {renaming ? (
          <input
            autoFocus
            defaultValue={label}
            aria-label={`Rename ${app.title}`}
            onFocus={(e) => e.currentTarget.select()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") onRenameCommit(e.currentTarget.value);
              if (e.key === "Escape") onRenameCancel();
            }}
            onBlur={(e) => onRenameCommit(e.currentTarget.value)}
            className="w-full rounded-md border border-accent/60 bg-background px-1 py-0.5 text-center text-xs outline-none"
          />
        ) : (
          <span className="max-w-full truncate text-xs font-medium text-foreground/90 drop-shadow-sm">
            {label}
          </span>
        )}
      </motion.div>

      {/* Hover preview: a tooltip card with a live, scaled render of the section */}
      <AnimatePresence>
        {preview && !dragging && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, x: -8 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ top: preview.top, left: preview.left }}
            aria-hidden
            className="pointer-events-none fixed z-50 w-80 select-none overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
              <app.icon className="size-4 text-accent" strokeWidth={1.75} />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{label}</p>
                <p className="truncate text-xs text-muted-foreground">{app.blurb}</p>
              </div>
            </div>

            {app.livePreview && (
              <div className="relative h-44 overflow-hidden bg-background">
                {/* Render the real content at 30% scale; reduced-motion config
                    forces Reveal wrappers to render fully visible. */}
                <MotionConfig reducedMotion="always">
                  <div className="@container w-[64rem] origin-top-left scale-[0.3] p-8">
                    <Content />
                  </div>
                </MotionConfig>
                <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
