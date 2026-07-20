"use client";

import * as React from "react";

import { apps, sectionApps, appById, type AppId } from "@/components/desktop/apps";

export type IconSize = "small" | "medium" | "large";
export type IconPos = { x: number; y: number };

const DESKTOP_ICONS_KEY = "portfolio-desktop-icons";
const TASKBAR_PINS_KEY = "portfolio-taskbar-pins";
const APP_NAMES_KEY = "portfolio-app-names";
const DESKTOP_PREFS_KEY = "portfolio-desktop-prefs";
const ICON_POSITIONS_KEY = "portfolio-icon-positions";

const DEFAULT_TASKBAR_PINS: AppId[] = ["calculator", "notepad", "paint"];

type DesktopPrefs = { iconSize: IconSize; iconsHidden: boolean; gridLock: boolean };
const DEFAULT_PREFS: DesktopPrefs = {
  iconSize: "medium",
  iconsHidden: false,
  gridLock: true,
};

const KNOWN_IDS = new Set(apps.map((app) => app.id));

/** State + setter persisted to localStorage. The provider only mounts
 *  client-side (desktop mode renders post-hydration), so lazy reads are safe. */
function usePersisted<T>(key: string, fallback: T, validate?: (v: unknown) => T | null) {
  const [value, setValue] = React.useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as unknown;
        const valid = validate ? validate(parsed) : (parsed as T);
        if (valid !== null) return valid as T;
      }
    } catch {
      // fall through to the default
    }
    return fallback;
  });

  const set = React.useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        window.localStorage.setItem(key, JSON.stringify(resolved));
        return resolved;
      });
    },
    [key]
  );

  return [value, set] as const;
}

const validIdArray = (v: unknown): AppId[] | null =>
  Array.isArray(v) ? (v.filter((id) => KNOWN_IDS.has(id)) as AppId[]) : null;

type DesktopConfigValue = {
  /** Apps pinned to the desktop, in creation order (positions held separately). */
  desktopIcons: AppId[];
  /** Apps pinned to the taskbar, in display order. */
  taskbarPins: AppId[];
  names: Partial<Record<AppId, string>>;
  iconSize: IconSize;
  iconsHidden: boolean;
  gridLock: boolean;
  positions: Partial<Record<AppId, IconPos>>;
  labelFor: (id: AppId) => string;
  pinToDesktop: (id: AppId) => void;
  removeFromDesktop: (id: AppId) => void;
  pinToTaskbar: (id: AppId) => void;
  unpinFromTaskbar: (id: AppId) => void;
  /** Persist a new pin order (from taskbar drag-reorder). */
  reorderTaskbar: (pins: AppId[]) => void;
  /** Persist a new desktop icon order (from the mobile grid drag-reorder). */
  reorderDesktop: (ids: AppId[]) => void;
  /** null clears a custom name back to the app's default title. */
  renameApp: (id: AppId, name: string | null) => void;
  setIconSize: (size: IconSize) => void;
  setIconsHidden: (hidden: boolean) => void;
  setGridLock: (locked: boolean) => void;
  setPositions: (
    next:
      | Partial<Record<AppId, IconPos>>
      | ((prev: Partial<Record<AppId, IconPos>>) => Partial<Record<AppId, IconPos>>)
  ) => void;
  resetIconPositions: () => void;
};

const DesktopConfigContext = React.createContext<DesktopConfigValue | null>(null);

export function useDesktopConfig() {
  const ctx = React.useContext(DesktopConfigContext);
  if (!ctx) {
    throw new Error("useDesktopConfig must be used inside <DesktopConfigProvider>");
  }
  return ctx;
}

export function DesktopConfigProvider({ children }: { children: React.ReactNode }) {
  const [desktopIcons, setDesktopIcons] = usePersisted<AppId[]>(
    DESKTOP_ICONS_KEY,
    sectionApps.map((app) => app.id),
    validIdArray
  );
  const [taskbarPins, setTaskbarPins] = usePersisted<AppId[]>(
    TASKBAR_PINS_KEY,
    DEFAULT_TASKBAR_PINS,
    validIdArray
  );
  const [names, setNames] = usePersisted<Partial<Record<AppId, string>>>(
    APP_NAMES_KEY,
    {},
    (v) => (v && typeof v === "object" && !Array.isArray(v) ? (v as never) : null)
  );
  const [prefs, setPrefs] = usePersisted<DesktopPrefs>(DESKTOP_PREFS_KEY, DEFAULT_PREFS, (v) => {
    if (!v || typeof v !== "object") return null;
    const p = v as Partial<DesktopPrefs>;
    return {
      iconSize: p.iconSize === "small" || p.iconSize === "large" ? p.iconSize : "medium",
      iconsHidden: Boolean(p.iconsHidden),
      gridLock: p.gridLock !== false,
    };
  });
  const [positions, setPositions] = usePersisted<Partial<Record<AppId, IconPos>>>(
    ICON_POSITIONS_KEY,
    {},
    (v) => (v && typeof v === "object" && !Array.isArray(v) ? (v as never) : null)
  );

  const labelFor = React.useCallback(
    (id: AppId) => names[id] ?? appById(id)?.title ?? id,
    [names]
  );

  const value = React.useMemo<DesktopConfigValue>(
    () => ({
      desktopIcons,
      taskbarPins,
      names,
      iconSize: prefs.iconSize,
      iconsHidden: prefs.iconsHidden,
      gridLock: prefs.gridLock,
      positions,
      labelFor,
      pinToDesktop: (id) =>
        setDesktopIcons((prev) => (prev.includes(id) ? prev : [...prev, id])),
      removeFromDesktop: (id) => setDesktopIcons((prev) => prev.filter((x) => x !== id)),
      pinToTaskbar: (id) =>
        setTaskbarPins((prev) => (prev.includes(id) ? prev : [...prev, id])),
      unpinFromTaskbar: (id) => setTaskbarPins((prev) => prev.filter((x) => x !== id)),
      reorderTaskbar: (pins) => setTaskbarPins(pins),
      reorderDesktop: (ids) => setDesktopIcons(ids),
      renameApp: (id, name) =>
        setNames((prev) => {
          const next = { ...prev };
          if (name && name.trim() && name.trim() !== appById(id)?.title) {
            next[id] = name.trim();
          } else {
            delete next[id];
          }
          return next;
        }),
      setIconSize: (iconSize) => setPrefs((p) => ({ ...p, iconSize })),
      setIconsHidden: (iconsHidden) => setPrefs((p) => ({ ...p, iconsHidden })),
      setGridLock: (gridLock) => setPrefs((p) => ({ ...p, gridLock })),
      setPositions,
      resetIconPositions: () => setPositions({}),
    }),
    [
      desktopIcons,
      taskbarPins,
      names,
      prefs,
      positions,
      labelFor,
      setDesktopIcons,
      setTaskbarPins,
      setNames,
      setPrefs,
      setPositions,
    ]
  );

  return (
    <DesktopConfigContext.Provider value={value}>{children}</DesktopConfigContext.Provider>
  );
}
