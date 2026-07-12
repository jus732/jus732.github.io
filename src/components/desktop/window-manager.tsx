"use client";

import * as React from "react";

import {
  APP_SIZES,
  TASKBAR_HEIGHT,
  type AppId,
  type Rect,
} from "@/components/desktop/app-meta";

export type WindowState = {
  appId: AppId;
  minimized: boolean;
  maximized: boolean;
  /** Stacking order; higher is closer to the user. */
  z: number;
  /** Window geometry (px from the desktop's top-left). */
  rect: Rect;
};

type WindowManagerValue = {
  windows: WindowState[];
  open: (appId: AppId) => void;
  close: (appId: AppId) => void;
  minimize: (appId: AppId) => void;
  toggleMaximize: (appId: AppId) => void;
  focus: (appId: AppId) => void;
  /** Commit new geometry (drag end, resize end); persisted per app. */
  setRect: (appId: AppId, rect: Rect) => void;
  /** Leave maximized mode with an explicit target rect (title-bar drag-out). */
  restoreTo: (appId: AppId, rect: Rect) => void;
  /** appId of the top-most non-minimized window, if any. */
  activeId: AppId | null;
};

const WindowManagerContext = React.createContext<WindowManagerValue | null>(null);

export function useWindows() {
  const ctx = React.useContext(WindowManagerContext);
  if (!ctx) throw new Error("useWindows must be used inside <WindowManagerProvider>");
  return ctx;
}

const RECTS_STORAGE_KEY = "portfolio-window-rects";

function loadSavedRects(): Partial<Record<AppId, Rect>> {
  try {
    return JSON.parse(window.localStorage.getItem(RECTS_STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function persistRect(appId: AppId, rect: Rect) {
  const all = loadSavedRects();
  all[appId] = rect;
  window.localStorage.setItem(RECTS_STORAGE_KEY, JSON.stringify(all));
}

/** Keep a rect fully inside the desktop area (above the taskbar). */
function clampRect(rect: Rect): Rect {
  const areaW = window.innerWidth;
  const areaH = window.innerHeight - TASKBAR_HEIGHT;
  const w = Math.min(rect.w, areaW - 8);
  const h = Math.min(rect.h, areaH - 8);
  const x = Math.min(Math.max(rect.x, 0), Math.max(0, areaW - w));
  const y = Math.min(Math.max(rect.y, 0), Math.max(0, areaH - h));
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

export function WindowManagerProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = React.useState<WindowState[]>([]);
  // Monotonic counters kept in refs; z-order changes should not re-create callbacks.
  const zCounter = React.useRef(1);
  const openCounter = React.useRef(0);

  const open = React.useCallback((appId: AppId) => {
    setWindows((prev) => {
      const existing = prev.find((w) => w.appId === appId);
      if (existing) {
        // Restore + focus instead of opening a duplicate instance.
        return prev.map((w) =>
          w.appId === appId ? { ...w, minimized: false, z: ++zCounter.current } : w
        );
      }
      // Remembered geometry wins; otherwise cascade from the top-left.
      const saved = loadSavedRects()[appId];
      const cascade = (openCounter.current++ % 5) * 32;
      const size = APP_SIZES[appId];
      const rect = clampRect(
        saved ?? { x: 120 + cascade, y: 48 + cascade, w: size.w, h: size.h }
      );
      return [
        ...prev,
        { appId, minimized: false, maximized: false, z: ++zCounter.current, rect },
      ];
    });
  }, []);

  const close = React.useCallback((appId: AppId) => {
    setWindows((prev) => prev.filter((w) => w.appId !== appId));
  }, []);

  const minimize = React.useCallback((appId: AppId) => {
    setWindows((prev) =>
      prev.map((w) => (w.appId === appId ? { ...w, minimized: true } : w))
    );
  }, []);

  const toggleMaximize = React.useCallback((appId: AppId) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.appId === appId
          ? { ...w, maximized: !w.maximized, z: ++zCounter.current }
          : w
      )
    );
  }, []);

  const focus = React.useCallback((appId: AppId) => {
    setWindows((prev) => {
      const target = prev.find((w) => w.appId === appId);
      // Skip the state update if the window is already on top and visible.
      if (!target || (!target.minimized && target.z === zCounter.current)) return prev;
      return prev.map((w) =>
        w.appId === appId ? { ...w, minimized: false, z: ++zCounter.current } : w
      );
    });
  }, []);

  const setRect = React.useCallback((appId: AppId, rect: Rect) => {
    const clamped = clampRect(rect);
    persistRect(appId, clamped);
    setWindows((prev) =>
      prev.map((w) => (w.appId === appId ? { ...w, rect: clamped } : w))
    );
  }, []);

  const restoreTo = React.useCallback((appId: AppId, rect: Rect) => {
    const clamped = clampRect(rect);
    persistRect(appId, clamped);
    setWindows((prev) =>
      prev.map((w) =>
        w.appId === appId
          ? { ...w, maximized: false, rect: clamped, z: ++zCounter.current }
          : w
      )
    );
  }, []);

  const activeId = React.useMemo(() => {
    const visible = windows.filter((w) => !w.minimized);
    if (visible.length === 0) return null;
    return visible.reduce((top, w) => (w.z > top.z ? w : top)).appId;
  }, [windows]);

  const value = React.useMemo(
    () => ({
      windows,
      open,
      close,
      minimize,
      toggleMaximize,
      focus,
      setRect,
      restoreTo,
      activeId,
    }),
    [windows, open, close, minimize, toggleMaximize, focus, setRect, restoreTo, activeId]
  );

  return (
    <WindowManagerContext.Provider value={value}>
      {children}
    </WindowManagerContext.Provider>
  );
}
