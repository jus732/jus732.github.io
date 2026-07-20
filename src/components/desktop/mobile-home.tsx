"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Settings } from "lucide-react";

import { apps, appById, type AppId, type DesktopApp } from "@/components/desktop/apps";
import { useWindows } from "@/components/desktop/window/window-manager";
import { useDesktopConfig } from "@/components/desktop/desktop-config";
import type { IconMetrics } from "@/components/desktop/desktop-icon";
import { PreferencesPanel } from "@/components/desktop/taskbar";
import { cn } from "@/lib/utils";

const DRAG_CLICK_SUPPRESS_MS = 250;

type MobileIconProps = {
  app: DesktopApp;
  label: string;
  metrics: IconMetrics;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  /** Drop point in viewport px; the grid resolves it to a slot. */
  onDrop: (clientX: number, clientY: number) => void;
  registerCell: (el: HTMLDivElement | null) => void;
};

/**
 * A home-screen icon: single tap opens, drag rearranges. The cell animates
 * to its new grid slot via layout animation while the drag transform snaps
 * back to origin, so a successful drop settles into place.
 */
function MobileIcon({
  app,
  label,
  metrics,
  onOpen,
  onContextMenu,
  onDrop,
  registerCell,
}: MobileIconProps) {
  // Framer fires a click after drag release; swallow it briefly.
  const suppressClickUntil = React.useRef(0);

  return (
    <motion.div
      ref={registerCell}
      role="button"
      tabIndex={0}
      layout
      drag
      dragSnapToOrigin
      dragMomentum={false}
      dragElastic={0}
      whileDrag={{ scale: 1.08, opacity: 0.8, zIndex: 40 }}
      onDragEnd={(e, info) => {
        suppressClickUntil.current = performance.now() + DRAG_CLICK_SUPPRESS_MS;
        // info.point is page-relative; the desktop never scrolls, but prefer
        // real client coordinates when the event carries them.
        const px = "clientX" in e ? e.clientX : info.point.x;
        const py = "clientY" in e ? e.clientY : info.point.y;
        onDrop(px, py);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (performance.now() < suppressClickUntil.current) return;
        onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      onContextMenu={onContextMenu}
      aria-label={`Open ${label}`}
      style={{ width: metrics.w }}
      className="flex touch-none select-none flex-col items-center gap-1.5 rounded-xl p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        style={{ width: metrics.box, height: metrics.box }}
        className="flex items-center justify-center rounded-xl border border-glass-border bg-glass shadow-sm backdrop-blur-md"
      >
        <app.icon
          style={{ width: metrics.glyph, height: metrics.glyph }}
          className="text-accent"
          strokeWidth={1.6}
        />
      </span>
      <span className="max-w-full truncate text-xs font-medium text-foreground/90 drop-shadow-sm">
        {label}
      </span>
    </motion.div>
  );
}

type MobileIconGridProps = {
  metrics: IconMetrics;
  onIconContextMenu: (e: React.MouseEvent, appId: AppId) => void;
};

/**
 * iOS-style home screen: icons flow left-to-right in fixed-width columns
 * distributed evenly across the viewport, so the margins between apps and
 * screen edges stay uniform. Releasing a dragged icon commits it to the
 * slot nearest the drop point (persisted with the desktop icon order).
 */
export function MobileIconGrid({ metrics, onIconContextMenu }: MobileIconGridProps) {
  const { open } = useWindows();
  const config = useDesktopConfig();
  const cells = React.useRef(new Map<AppId, HTMLDivElement>());

  const ids = config.desktopIcons;
  const gridApps = ids
    .map((id) => appById(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  function handleDrop(id: AppId, clientX: number, clientY: number) {
    // Resolve the drop point to a reading-order slot index: every settled
    // cell in a row above it counts, plus same-row cells left of it. Drops
    // into gaps or empty grid space land on the nearest slot instead of
    // being ignored (which would snap the icon back).
    let index = 0;
    for (const [otherId, el] of cells.current) {
      if (otherId === id) continue; // its rect carries the drag transform
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const sameRow = Math.abs(cy - clientY) <= r.height / 2;
      if (cy < clientY - r.height / 2 || (sameRow && cx < clientX)) index++;
    }
    const next = ids.filter((i) => i !== id);
    next.splice(index, 0, id);
    if (next.join() !== ids.join()) config.reorderDesktop(next);
  }

  return (
    <div
      // Marked as desktop surface so taps on empty grid space reach the
      // wallpaper's click-ripple handler (it fills the actual surface div).
      data-desktop-surface
      className="grid h-full content-start justify-evenly gap-y-2 overflow-y-auto px-1 py-4"
      style={{ gridTemplateColumns: `repeat(auto-fill, ${metrics.w}px)` }}
    >
      {gridApps.map((app) => (
        <MobileIcon
          key={app.id}
          app={app}
          label={config.labelFor(app.id)}
          metrics={metrics}
          onOpen={() => open(app.id)}
          onContextMenu={(e) => onIconContextMenu(e, app.id)}
          onDrop={(x, y) => handleDrop(app.id, x, y)}
          registerCell={(el) => {
            if (el) cells.current.set(app.id, el);
            else cells.current.delete(app.id);
          }}
        />
      ))}
    </div>
  );
}

type MobileDockProps = {
  wallpaper: number;
  onWallpaperChange: (index: number) => void;
};

/**
 * Mobile replacement for the taskbar: a centered home button that toggles a
 * full-screen list of every app, with a gear leading to the preferences
 * panel (theme, wallpaper, classic mode).
 */
export function MobileDock({ wallpaper, onWallpaperChange }: MobileDockProps) {
  const reduce = useReducedMotion();
  const { open } = useWindows();
  const { labelFor } = useDesktopConfig();
  const [view, setView] = React.useState<"apps" | "settings" | null>(null);

  return (
    <>
      <div className="absolute inset-x-0 bottom-0 z-40 flex h-14 items-center justify-center border-t border-glass-border bg-glass backdrop-blur-xl">
        <button
          onClick={() => setView(view ? null : "apps")}
          aria-label={view ? "Close app list" : "Open app list"}
          aria-expanded={view !== null}
          className="flex size-10 items-center justify-center rounded-full border border-foreground/40 transition-colors active:bg-foreground/10"
        >
          <span
            aria-hidden
            className={cn(
              "size-3.5 rounded-[4px] border-2 transition-colors",
              view ? "border-accent" : "border-foreground/70"
            )}
          />
        </button>
      </div>

      {/* Full-screen overlay above any open (maximized) windows; the home
          bar stays visible so the button also dismisses it. */}
      <AnimatePresence>
        {view && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ zIndex: 9999 }}
            className="absolute inset-x-0 bottom-14 top-0 flex flex-col bg-background/95 backdrop-blur-xl"
          >
            <div className="flex h-14 shrink-0 items-center gap-2 px-4">
              {view === "settings" ? (
                <>
                  <button
                    onClick={() => setView("apps")}
                    aria-label="Back to all apps"
                    className="-ml-2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ArrowLeft className="size-4.5" strokeWidth={1.75} />
                  </button>
                  <span className="text-sm font-medium">Settings</span>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-muted-foreground">All apps</span>
                  <button
                    onClick={() => setView("settings")}
                    aria-label="Open settings"
                    className="-mr-2 ml-auto rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Settings className="size-4.5" strokeWidth={1.6} />
                  </button>
                </>
              )}
            </div>

            {view === "settings" ? (
              <div className="flex-1 overflow-y-auto px-2 pb-6">
                <PreferencesPanel wallpaper={wallpaper} onWallpaperChange={onWallpaperChange} />
              </div>
            ) : (
              <div
                className="grid flex-1 content-start justify-evenly gap-y-3 overflow-y-auto px-1 pb-6"
                style={{ gridTemplateColumns: "repeat(auto-fill, 88px)" }}
              >
                {apps.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => {
                      open(app.id);
                      setView(null);
                    }}
                    className="flex w-[88px] flex-col items-center gap-1.5 rounded-xl p-2 transition-colors hover:bg-muted"
                  >
                    <span className="flex size-12 items-center justify-center rounded-2xl border border-glass-border bg-glass">
                      <app.icon className="size-5 text-accent" strokeWidth={1.6} />
                    </span>
                    <span className="max-w-full truncate text-xs">{labelFor(app.id)}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
