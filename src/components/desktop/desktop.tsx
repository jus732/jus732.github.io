"use client";

import * as React from "react";
import { AnimatePresence } from "framer-motion";
import {
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Grid3x3,
  LayoutGrid,
  Pencil,
  Proportions,
  Trash2,
} from "lucide-react";

import { appById, type AppId } from "@/components/desktop/apps";
import {
  WindowManagerProvider,
  useWindows,
} from "@/components/desktop/window/window-manager";
import {
  DesktopConfigProvider,
  useDesktopConfig,
  type IconSize,
} from "@/components/desktop/desktop-config";
import { DesktopIcon, type IconMetrics } from "@/components/desktop/desktop-icon";
import { MobileDock, MobileIconGrid } from "@/components/desktop/mobile-home";
import { Window } from "@/components/desktop/window/window";
import { Taskbar } from "@/components/desktop/taskbar";
import { Wallpaper, WALLPAPERS } from "@/components/desktop/wallpaper";
import { ContextMenuShell, MenuDivider, MenuItem } from "@/components/desktop/context-menu";
import { APP_SIZES, TASKBAR_HEIGHT } from "@/components/desktop/app-meta";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

const WALLPAPER_STORAGE_KEY = "portfolio-wallpaper";

const ICON_ORIGIN = 12;

export const ICON_METRICS: Record<IconSize, IconMetrics> = {
  small: { grid: 84, w: 68, h: 78, box: 36, glyph: 16 },
  medium: { grid: 100, w: 84, h: 92, box: 48, glyph: 22 },
  large: { grid: 120, w: 102, h: 114, box: 60, glyph: 28 },
};

type Pos = { x: number; y: number };
type Menu =
  | { kind: "desktop"; x: number; y: number }
  | { kind: "icon"; x: number; y: number; appId: AppId };
type Marquee = { x1: number; y1: number; x2: number; y2: number };

function DesktopShell() {
  const { windows, open, activeId } = useWindows();
  const config = useDesktopConfig();
  const desktopRef = React.useRef<HTMLDivElement>(null);
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery("(max-width: 767px)");

  const [selected, setSelected] = React.useState<ReadonlySet<AppId>>(new Set());
  const [menu, setMenu] = React.useState<Menu | null>(null);
  const [renamingId, setRenamingId] = React.useState<AppId | null>(null);
  const [marquee, setMarquee] = React.useState<Marquee | null>(null);
  const marqueeStart = React.useRef<Pos | null>(null);
  const iconNodes = React.useRef(new Map<AppId, HTMLDivElement>());

  // The Desktop tree only mounts client-side (after the mode swap), so
  // lazy-initializing from localStorage is safe here.
  const [wallpaper, setWallpaper] = React.useState(() => {
    const stored = Number(window.localStorage.getItem(WALLPAPER_STORAGE_KEY));
    return Number.isInteger(stored) && stored >= 0 && stored < WALLPAPERS.length
      ? stored
      : 0;
  });

  const metrics = ICON_METRICS[config.iconSize];
  const desktopApps = config.desktopIcons
    .map((id) => appById(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  // Stored positions plus default slots (left-edge column) for new icons.
  const iconPos = React.useMemo(() => {
    const result: Partial<Record<AppId, Pos>> = {};
    const taken = new Set<string>();
    for (const app of desktopApps) {
      const stored = config.positions[app.id];
      if (stored) {
        result[app.id] = stored;
        taken.add(`${Math.round(stored.x)},${Math.round(stored.y)}`);
      }
    }
    let slot = 0;
    const areaH =
      typeof window === "undefined" ? 800 : window.innerHeight - TASKBAR_HEIGHT;
    const rows = Math.max(1, Math.floor((areaH - ICON_ORIGIN) / metrics.grid));
    for (const app of desktopApps) {
      if (result[app.id]) continue;
      let pos: Pos;
      do {
        pos = {
          x: ICON_ORIGIN + Math.floor(slot / rows) * metrics.grid,
          y: ICON_ORIGIN + (slot % rows) * metrics.grid,
        };
        slot++;
      } while (taken.has(`${pos.x},${pos.y}`));
      taken.add(`${pos.x},${pos.y}`);
      result[app.id] = pos;
    }
    return result;
    // desktopApps derives from config.desktopIcons
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.positions, config.desktopIcons, metrics.grid]);

  // The Welcome window doubles as the desktop's "hero"; open it on boot -
  // unless a deep link (/?app=...) asked for a specific window.
  React.useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("app");
    open(
      requested !== null && requested in APP_SIZES
        ? (requested as AppId)
        : "welcome"
    );
  }, [open]);

  // Mirror the focused window in the URL so any desktop view is shareable.
  // Welcome is the default and stays unmarked. replaceState keeps focus
  // changes out of the browser history.
  React.useEffect(() => {
    const url = new URL(window.location.href);
    if (activeId && activeId !== "welcome") url.searchParams.set("app", activeId);
    else url.searchParams.delete("app");
    window.history.replaceState(null, "", url);
  }, [activeId]);

  // Leaving the desktop drops the deep-link param.
  React.useEffect(() => {
    return () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("app");
      window.history.replaceState(null, "", url);
    };
  }, []);

  const setWallpaperPersist = React.useCallback((index: number) => {
    setWallpaper(index);
    window.localStorage.setItem(WALLPAPER_STORAGE_KEY, String(index));
  }, []);

  /* ----- Placement: snap, clamp, resolve collisions ----- */

  function areaSize() {
    const rect = surfaceRef.current?.getBoundingClientRect();
    return { w: rect?.width ?? window.innerWidth, h: rect?.height ?? window.innerHeight - TASKBAR_HEIGHT };
  }

  /** Move a set of icons by a shared delta, preserving their arrangement.
   *  Snaps to the grid when grid lock is on; free placement otherwise.
   *  `forceGrid` snaps regardless: the lock toggle re-aligns before the
   *  state update lands in this closure. */
  function commitMove(ids: AppId[], dx: number, dy: number, forceGrid = false) {
    const { w: areaW, h: areaH } = areaSize();
    const next = { ...config.positions };
    // Ensure every visible icon has a concrete position first.
    for (const app of desktopApps) next[app.id] = iconPos[app.id]!;

    if (!config.gridLock && !forceGrid) {
      for (const id of ids) {
        const cur = next[id];
        if (!cur) continue;
        next[id] = {
          x: Math.round(Math.min(Math.max(cur.x + dx, 0), areaW - metrics.w)),
          y: Math.round(Math.min(Math.max(cur.y + dy, 0), areaH - metrics.h)),
        };
      }
      config.setPositions(next);
      return;
    }

    const maxCol = Math.max(0, Math.floor((areaW - ICON_ORIGIN - metrics.w) / metrics.grid));
    const maxRow = Math.max(0, Math.floor((areaH - ICON_ORIGIN - metrics.h) / metrics.grid));
    const moving = new Set(ids);
    const occupied = new Set(
      desktopApps
        .filter((app) => !moving.has(app.id))
        .map((app) => {
          const p = next[app.id]!;
          return `${Math.round((p.x - ICON_ORIGIN) / metrics.grid)},${Math.round(
            (p.y - ICON_ORIGIN) / metrics.grid
          )}`;
        })
    );

    // Place top-left first so a dragged group keeps its internal layout.
    const ordered = [...ids].sort((a, b) => {
      const pa = next[a]!;
      const pb = next[b]!;
      return pa.y - pb.y || pa.x - pb.x;
    });
    for (const id of ordered) {
      const cur = next[id];
      if (!cur) continue;
      let col = Math.min(
        Math.max(Math.round((cur.x + dx - ICON_ORIGIN) / metrics.grid), 0),
        maxCol
      );
      let row = Math.min(
        Math.max(Math.round((cur.y + dy - ICON_ORIGIN) / metrics.grid), 0),
        maxRow
      );
      let guard = 0;
      while (occupied.has(`${col},${row}`) && guard++ < 400) {
        row++;
        if (row > maxRow) {
          row = 0;
          col = col + 1 > maxCol ? 0 : col + 1;
        }
      }
      occupied.add(`${col},${row}`);
      next[id] = { x: ICON_ORIGIN + col * metrics.grid, y: ICON_ORIGIN + row * metrics.grid };
    }
    config.setPositions(next);
  }

  /** Pin/position an app at a viewport point (start-menu drop target). */
  function handleStartDrop(id: AppId, clientX: number, clientY: number) {
    if (clientY >= window.innerHeight - TASKBAR_HEIGHT) {
      config.pinToTaskbar(id);
      return;
    }
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect || clientX < rect.left || clientX > rect.right) return;
    config.pinToDesktop(id);
    const raw = {
      x: clientX - rect.left - metrics.w / 2,
      y: clientY - rect.top - metrics.h / 2,
    };
    // Reuse the group-move placement by setting a provisional position
    // and moving it by zero (snap + collision resolution).
    config.setPositions((prev) => ({ ...prev, [id]: raw }));
    // Position state updates are async; run the snap on the next frame so
    // commitMove sees the provisional position.
    requestAnimationFrame(() => snapOne(id, raw));
  }

  function snapOne(id: AppId, raw: Pos) {
    if (!config.gridLock) return; // free placement already committed
    const { w: areaW, h: areaH } = areaSize();
    const maxCol = Math.max(0, Math.floor((areaW - ICON_ORIGIN - metrics.w) / metrics.grid));
    const maxRow = Math.max(0, Math.floor((areaH - ICON_ORIGIN - metrics.h) / metrics.grid));
    config.setPositions((prev) => {
      const occupied = new Set(
        Object.entries(prev)
          .filter(([otherId]) => otherId !== id)
          .map(([, p]) => {
            return `${Math.round((p!.x - ICON_ORIGIN) / metrics.grid)},${Math.round(
              (p!.y - ICON_ORIGIN) / metrics.grid
            )}`;
          })
      );
      let col = Math.min(Math.max(Math.round((raw.x - ICON_ORIGIN) / metrics.grid), 0), maxCol);
      let row = Math.min(Math.max(Math.round((raw.y - ICON_ORIGIN) / metrics.grid), 0), maxRow);
      let guard = 0;
      while (occupied.has(`${col},${row}`) && guard++ < 400) {
        row++;
        if (row > maxRow) {
          row = 0;
          col = col + 1 > maxCol ? 0 : col + 1;
        }
      }
      return {
        ...prev,
        [id]: { x: ICON_ORIGIN + col * metrics.grid, y: ICON_ORIGIN + row * metrics.grid },
      };
    });
  }

  /* ----- Marquee selection ----- */

  function surfacePoint(e: React.PointerEvent): Pos {
    const rect = surfaceRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handleSurfacePointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || e.target !== surfaceRef.current || isMobile) return;
    setMenu(null);
    setRenamingId(null);
    setSelected(new Set());
    marqueeStart.current = surfacePoint(e);
    surfaceRef.current!.setPointerCapture(e.pointerId);
  }

  function handleSurfacePointerMove(e: React.PointerEvent) {
    const start = marqueeStart.current;
    if (!start) return;
    const cur = surfacePoint(e);
    if (!marquee && Math.hypot(cur.x - start.x, cur.y - start.y) < 4) return;
    const box: Marquee = {
      x1: Math.min(start.x, cur.x),
      y1: Math.min(start.y, cur.y),
      x2: Math.max(start.x, cur.x),
      y2: Math.max(start.y, cur.y),
    };
    setMarquee(box);
    const hit = new Set<AppId>();
    for (const app of desktopApps) {
      const p = iconPos[app.id];
      if (!p) continue;
      if (
        p.x < box.x2 &&
        p.x + metrics.w > box.x1 &&
        p.y < box.y2 &&
        p.y + metrics.h > box.y1
      ) {
        hit.add(app.id);
      }
    }
    setSelected(hit);
  }

  function handleSurfacePointerUp() {
    marqueeStart.current = null;
    setMarquee(null);
  }

  /* ----- Group drag wiring ----- */

  function handleIconDragStart(id: AppId) {
    setMenu(null);
    if (!selected.has(id)) setSelected(new Set([id]));
  }

  function handleIconDragMove(id: AppId, dx: number, dy: number) {
    if (!selected.has(id)) return;
    for (const other of selected) {
      if (other === id) continue;
      const node = iconNodes.current.get(other);
      if (node) node.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  }

  function handleIconDragEnd(id: AppId, dx: number, dy: number) {
    const group = selected.has(id) ? [...selected] : [id];
    commitMove(group, dx, dy);
    for (const other of group) {
      if (other === id) continue;
      const node = iconNodes.current.get(other);
      if (node) node.style.transform = "";
    }
  }

  /* ----- Menus ----- */

  const iconSizeChoice = (size: IconSize, label: string) => (
    <button
      key={size}
      role="menuitemradio"
      aria-checked={config.iconSize === size}
      aria-label={`${label} icons`}
      onClick={() => {
        config.setIconSize(size);
        setMenu(null);
      }}
      className={cn(
        "flex-1 rounded-md px-2 py-1 text-xs transition-colors",
        config.iconSize === size
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted"
      )}
    >
      {label}
    </button>
  );

  const menuApp = menu?.kind === "icon" ? appById(menu.appId) : null;

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <Wallpaper variant={wallpaper} />

      {/* Desktop area (everything above the taskbar) */}
      <div
        ref={desktopRef}
        className="absolute inset-x-0 bottom-14 top-0"
        onContextMenu={(e) => {
          // Only hijack right-click on the desktop surface itself; windows
          // keep the browser's default menu behavior.
          if (e.target !== surfaceRef.current) return;
          e.preventDefault();
          setSelected(new Set());
          setMenu({ kind: "desktop", x: e.clientX, y: e.clientY });
        }}
      >
        {/* Icon + marquee layer */}
        <div
          ref={surfaceRef}
          data-desktop-surface
          className="absolute inset-0"
          onPointerDown={handleSurfacePointerDown}
          onPointerMove={handleSurfacePointerMove}
          onPointerUp={handleSurfacePointerUp}
          onPointerCancel={handleSurfacePointerUp}
        >
          {!config.iconsHidden &&
            (isMobile ? (
              <MobileIconGrid
                metrics={metrics}
                onIconContextMenu={(e, appId) => {
                  e.preventDefault();
                  setMenu({ kind: "icon", x: e.clientX, y: e.clientY, appId });
                }}
              />
            ) : (
              desktopApps.map((app) => (
                <DesktopIcon
                  key={app.id}
                  app={app}
                  label={config.labelFor(app.id)}
                  metrics={metrics}
                  selected={selected.has(app.id)}
                  renaming={renamingId === app.id}
                  onRenameCommit={(name) => {
                    config.renameApp(app.id, name);
                    setRenamingId(null);
                  }}
                  onRenameCancel={() => setRenamingId(null)}
                  onSelect={() => setSelected(new Set([app.id]))}
                  onOpen={() => {
                    setSelected(new Set());
                    open(app.id);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!selected.has(app.id)) setSelected(new Set([app.id]));
                    setMenu({ kind: "icon", x: e.clientX, y: e.clientY, appId: app.id });
                  }}
                  pos={iconPos[app.id]}
                  onDragStartGroup={() => handleIconDragStart(app.id)}
                  onDragMoveGroup={(dx, dy) => handleIconDragMove(app.id, dx, dy)}
                  onDragEndGroup={(dx, dy) => handleIconDragEnd(app.id, dx, dy)}
                  registerNode={(el) => {
                    if (el) iconNodes.current.set(app.id, el);
                    else iconNodes.current.delete(app.id);
                  }}
                />
              ))
            ))}

          {/* Selection box */}
          {marquee && (
            <div
              aria-hidden
              className="pointer-events-none absolute z-30 rounded-sm border border-accent/70 bg-accent/10"
              style={{
                left: marquee.x1,
                top: marquee.y1,
                width: marquee.x2 - marquee.x1,
                height: marquee.y2 - marquee.y1,
              }}
            />
          )}
        </div>

        {/* Window layer */}
        <AnimatePresence>
          {windows.map((win) => {
            const app = appById(win.appId);
            if (!app) return null;
            return <Window key={win.appId} app={app} state={win} />;
          })}
        </AnimatePresence>
      </div>

      {isMobile ? (
        <MobileDock wallpaper={wallpaper} onWallpaperChange={setWallpaperPersist} />
      ) : (
        <Taskbar
          wallpaper={wallpaper}
          onWallpaperChange={setWallpaperPersist}
          onStartDrop={handleStartDrop}
        />
      )}

      <AnimatePresence>
        {menu?.kind === "desktop" && (
          <ContextMenuShell
            key="desktop-menu"
            x={menu.x}
            y={menu.y}
            onClose={() => setMenu(null)}
          >
            <div className="flex items-center gap-2.5 px-3 py-1.5">
              <Proportions className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <span className="text-sm">Icon size</span>
              <div className="ml-auto flex gap-0.5">
                {iconSizeChoice("small", "S")}
                {iconSizeChoice("medium", "M")}
                {iconSizeChoice("large", "L")}
              </div>
            </div>
            <MenuItem
              icon={config.iconsHidden ? Eye : EyeOff}
              onClick={() => {
                config.setIconsHidden(!config.iconsHidden);
                setMenu(null);
              }}
            >
              {config.iconsHidden ? "Show icons" : "Hide icons"}
            </MenuItem>
            <MenuItem
              icon={Grid3x3}
              onClick={() => {
                const locking = !config.gridLock;
                config.setGridLock(locking);
                setMenu(null);
                // Re-align everything when locking back onto the grid.
                if (locking) commitMove(desktopApps.map((a) => a.id), 0, 0, true);
              }}
            >
              Lock icons to grid
              {config.gridLock && <Check className="ml-auto size-3.5 text-accent" />}
            </MenuItem>
            <MenuItem
              icon={LayoutGrid}
              onClick={() => {
                config.resetIconPositions();
                setMenu(null);
              }}
            >
              Reset icon positions
            </MenuItem>
          </ContextMenuShell>
        )}

        {menu?.kind === "icon" && menuApp && (
          <ContextMenuShell
            key={`icon-menu-${menu.appId}`}
            x={menu.x}
            y={menu.y}
            width={200}
            onClose={() => setMenu(null)}
          >
            <MenuItem
              icon={ExternalLink}
              onClick={() => {
                setMenu(null);
                setSelected(new Set());
                open(menu.appId);
              }}
            >
              Open
            </MenuItem>
            {/* Renaming happens inline on the icon; mobile icons have no input. */}
            {!isMobile && (
              <MenuItem
                icon={Pencil}
                onClick={() => {
                  setMenu(null);
                  setRenamingId(menu.appId);
                }}
              >
                Rename
              </MenuItem>
            )}
            <MenuDivider />
            <MenuItem
              icon={Trash2}
              onClick={() => {
                setMenu(null);
                setSelected(new Set());
                config.removeFromDesktop(menu.appId);
              }}
            >
              Remove from Desktop
            </MenuItem>
          </ContextMenuShell>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Desktop() {
  return (
    <WindowManagerProvider>
      <DesktopConfigProvider>
        <DesktopShell />
      </DesktopConfigProvider>
    </WindowManagerProvider>
  );
}
