"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, Reorder, useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  Check,
  ExternalLink,
  Mail,
  Monitor,
  Moon,
  Pencil,
  Pin,
  PinOff,
  Search,
  Settings,
  Sun,
  X,
} from "lucide-react";

import { site } from "@/lib/site";
import { GithubIcon, LinkedinIcon } from "@/components/icons/brand";
import { apps, appById, type AppId } from "@/components/desktop/apps";
import { WALLPAPERS } from "@/components/desktop/wallpaper";
import { useWindows } from "@/components/desktop/window-manager";
import { useDesktopConfig } from "@/components/desktop/desktop-config";
import { ContextMenuShell, MenuDivider, MenuItem } from "@/components/desktop/context-menu";
import { useMode } from "@/components/providers";
import { cn } from "@/lib/utils";

function Clock() {
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const id = window.setInterval(update, 15_000);
    return () => window.clearInterval(id);
  }, []);

  if (!now) return <div className="hidden w-16 min-[480px]:block" />;

  return (
    // Hidden on very narrow screens; the taskbar runs out of room below 480px.
    <div className="hidden px-2 text-right font-mono text-xs leading-tight text-muted-foreground min-[480px]:block">
      <div className="text-foreground">
        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div className="hidden sm:block">
        {now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
      </div>
    </div>
  );
}

/**
 * Shared popup panel chrome for the start menu, search results, and
 * preferences. Dismissal uses a document-level pointerdown listener rather
 * than a backdrop element: the taskbar's backdrop-filter makes it a
 * containing block, so a `fixed inset-0` child would only cover the
 * taskbar strip.
 */
function TaskbarPopup({
  children,
  onClose,
  className,
}: {
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const panelRef = React.useRef<HTMLDivElement>(null);

  // The listeners subscribe once and read onClose through a ref. If they
  // re-subscribed on every onClose identity change, a state update flushed
  // during a pointerdown (e.g. the desktop's marquee handler) would remove
  // the listener mid-dispatch and the in-flight event would never close
  // the popup.
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (panelRef.current?.contains(target)) return;
      // Let the taskbar toggle buttons run their own open/close logic.
      if (target.closest("[data-popup-toggle]")) return;
      onCloseRef.current();
    };
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <motion.div
      ref={panelRef}
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.12 } }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "absolute bottom-16 z-50 rounded-xl border border-border bg-card/95 p-2 shadow-2xl backdrop-blur-xl",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

/* ----- Start menu: app grid with drag-to-pin ----- */

function StartTile({
  app,
  label,
  onOpen,
  onDrop,
}: {
  app: (typeof apps)[number];
  label: string;
  onOpen: () => void;
  onDrop: (clientX: number, clientY: number) => void;
}) {
  const [ghost, setGhost] = React.useState<{ x: number; y: number } | null>(null);
  const start = React.useRef<{ x: number; y: number } | null>(null);
  const suppressClick = React.useRef(false);

  return (
    <>
      <button
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          suppressClick.current = false;
          start.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          if (!ghost && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 6) return;
          setGhost({ x: e.clientX, y: e.clientY });
        }}
        onPointerUp={(e) => {
          start.current = null;
          if (ghost) {
            suppressClick.current = true;
            setGhost(null);
            onDrop(e.clientX, e.clientY);
          }
        }}
        onPointerCancel={() => {
          start.current = null;
          setGhost(null);
        }}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          onOpen();
        }}
        className="flex select-none flex-col items-center gap-1.5 rounded-xl p-2.5 transition-colors hover:bg-muted touch-none"
      >
        <span className="flex size-10 items-center justify-center rounded-xl border border-glass-border bg-glass">
          <app.icon className="size-4.5 text-accent" strokeWidth={1.6} />
        </span>
        <span className="max-w-full truncate text-xs">{label}</span>
      </button>

      {/* Drag ghost follows the cursor outside the popup (portal escapes
          the panel's overflow and the taskbar's containing block). */}
      {ghost &&
        createPortal(
          <div
            aria-hidden
            style={{ left: ghost.x, top: ghost.y }}
            className="pointer-events-none fixed z-80 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 opacity-80"
          >
            <span className="flex size-10 items-center justify-center rounded-xl border border-accent/50 bg-card shadow-2xl">
              <app.icon className="size-4.5 text-accent" strokeWidth={1.6} />
            </span>
            <span className="rounded-md bg-card/90 px-1.5 text-xs shadow">{label}</span>
          </div>,
          document.body
        )}
    </>
  );
}

function StartMenu({
  onClose,
  onStartDrop,
}: {
  onClose: () => void;
  onStartDrop: (id: AppId, clientX: number, clientY: number) => void;
}) {
  const { open } = useWindows();
  const { labelFor } = useDesktopConfig();

  // The taskbar's live search field already covers desktop viewports; the
  // Search app only surfaces on mobile, where that field doesn't exist.
  const startApps = apps.filter((app) => app.id !== "search");

  return (
    <TaskbarPopup onClose={onClose} className="left-2 w-80">
      <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">All apps</p>
      <div className="grid grid-cols-4 gap-0.5 p-1">
        {startApps.map((app) => (
          <StartTile
            key={app.id}
            app={app}
            label={labelFor(app.id)}
            onOpen={() => {
              open(app.id);
              onClose();
            }}
            onDrop={(x, y) => {
              onStartDrop(app.id, x, y);
              onClose();
            }}
          />
        ))}
      </div>
      <p className="border-t border-border px-3 pb-1 pt-2 text-xs text-muted-foreground">
        Drag an app to the desktop or taskbar to pin it.
      </p>
    </TaskbarPopup>
  );
}

/* ----- Search field with live results ----- */

function SearchField() {
  const { open } = useWindows();
  const { labelFor } = useDesktopConfig();
  const [query, setQuery] = React.useState("");

  const q = query.trim().toLowerCase();
  // The Search app is redundant next to this field; keep it out of results.
  const results = q
    ? apps
        .filter(
          (app) =>
            app.id !== "search" &&
            `${labelFor(app.id)} ${app.title} ${app.blurb}`.toLowerCase().includes(q)
        )
        .slice(0, 8)
    : [];

  const launch = (id: AppId) => {
    open(id);
    setQuery("");
  };

  return (
    <div className="relative hidden shrink-0 md:block" data-popup-toggle>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) launch(results[0].id);
          if (e.key === "Escape") setQuery("");
        }}
        placeholder="Search"
        aria-label="Search apps"
        className="h-9 w-44 rounded-lg border border-glass-border bg-foreground/5 pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-accent/50"
      />

      <AnimatePresence>
        {q && (
          <TaskbarPopup onClose={() => setQuery("")} className="left-0 bottom-13 w-72">
            {results.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No apps match “{query.trim()}”.
              </p>
            ) : (
              <ul>
                {results.map((app, i) => (
                  <li key={app.id}>
                    <button
                      onClick={() => launch(app.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
                        i === 0 && "bg-muted/60"
                      )}
                    >
                      <app.icon className="size-4 shrink-0 text-accent" strokeWidth={1.75} />
                      <span className="min-w-0 truncate">{labelFor(app.id)}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {app.kind === "section" ? "Section" : "App"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </TaskbarPopup>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ----- Preferences (taskbar config) ----- */

/**
 * Preferences content: theme, wallpaper, classic-mode switch, and social
 * links. Rendered in a taskbar popup on desktop and inside the full-screen
 * settings view on mobile.
 */
export function PreferencesPanel({
  wallpaper,
  onWallpaperChange,
}: {
  wallpaper: number;
  onWallpaperChange: (index: number) => void;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const { setMode } = useMode();

  const rowClass =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted";

  return (
    <>
      <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">Theme</p>
      <div className="flex gap-1 px-1">
        <button
          onClick={() => setTheme("dark")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
            resolvedTheme === "dark" ? "bg-muted font-medium" : "hover:bg-muted/60"
          )}
        >
          <Moon className="size-4" strokeWidth={1.75} />
          Dark
        </button>
        <button
          onClick={() => setTheme("light")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
            resolvedTheme === "light" ? "bg-muted font-medium" : "hover:bg-muted/60"
          )}
        >
          <Sun className="size-4" strokeWidth={1.75} />
          Light
        </button>
      </div>

      <p className="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground">Wallpaper</p>
      <ul>
        {WALLPAPERS.map((name, index) => (
          <li key={name}>
            <button onClick={() => onWallpaperChange(index)} className={rowClass}>
              <span
                className={cn(
                  "size-3 rounded-full border",
                  index === wallpaper ? "border-accent bg-accent/60" : "border-border"
                )}
              />
              {name}
              {index === wallpaper && <Check className="ml-auto size-3.5 text-accent" />}
            </button>
          </li>
        ))}
      </ul>

      <div className="my-2 border-t border-border" />
      <button onClick={() => setMode("classic")} className={rowClass}>
        <Monitor className="size-4 text-accent" strokeWidth={1.75} />
        Switch to classic site
      </button>
      <div className="mt-1 flex items-center gap-1 border-t border-border px-2 pt-2">
        <a
          href={`mailto:${site.email}`}
          aria-label="Email"
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-accent"
        >
          <Mail className="size-4" />
        </a>
        <a
          href={site.github}
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-accent"
        >
          <GithubIcon />
        </a>
        <a
          href={site.linkedin}
          target="_blank"
          rel="noreferrer"
          aria-label="LinkedIn"
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-accent"
        >
          <LinkedinIcon />
        </a>
      </div>
    </>
  );
}

function PreferencesMenu({
  onClose,
  wallpaper,
  onWallpaperChange,
}: {
  onClose: () => void;
  wallpaper: number;
  onWallpaperChange: (index: number) => void;
}) {
  return (
    <TaskbarPopup onClose={onClose} className="right-2 max-h-[75vh] w-64 overflow-y-auto">
      <PreferencesPanel wallpaper={wallpaper} onWallpaperChange={onWallpaperChange} />
    </TaskbarPopup>
  );
}

/* ----- Unified app row ----- */

function TaskbarItem({
  id,
  onContextMenu,
}: {
  id: AppId;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const { windows, open, minimize, focus, activeId } = useWindows();
  const { labelFor } = useDesktopConfig();
  const app = appById(id);
  const suppressClickUntil = React.useRef(0);
  if (!app) return null;

  const win = windows.find((w) => w.appId === id);
  const isActive = activeId === id && !win?.minimized;
  const label = labelFor(id);

  return (
    <Reorder.Item
      value={id}
      as="div"
      dragMomentum={false}
      onDragEnd={() => {
        suppressClickUntil.current = performance.now() + 250;
      }}
      className="shrink-0"
    >
      <button
        onClick={() => {
          if (performance.now() < suppressClickUntil.current) return;
          if (!win) open(id);
          else if (!win.minimized && activeId === id) minimize(id);
          else focus(id);
        }}
        onContextMenu={onContextMenu}
        aria-label={win ? `${isActive ? "Minimize" : "Focus"} ${label}` : `Open ${label}`}
        title={label}
        className={cn(
          "relative flex size-10 items-center justify-center rounded-lg transition-colors hover:bg-foreground/10",
          isActive && "bg-foreground/10"
        )}
      >
        <app.icon
          className={cn("size-4.5", isActive ? "text-accent" : "text-foreground/80")}
          strokeWidth={1.6}
        />
        {win && (
          <span
            className={cn(
              "absolute bottom-0.5 left-1/2 h-1 -translate-x-1/2 rounded-full bg-accent transition-all",
              isActive ? "w-4" : "w-1 opacity-70"
            )}
          />
        )}
      </button>
    </Reorder.Item>
  );
}

type TaskbarProps = {
  wallpaper: number;
  onWallpaperChange: (index: number) => void;
  onStartDrop: (id: AppId, clientX: number, clientY: number) => void;
};

type ItemMenu = { id: AppId; x: number; y: number; rename: boolean };

/**
 * Bottom taskbar: start menu (app grid with drag-to-pin), a live search
 * field, one unified row of pinned + running apps (icon-only, reorderable
 * by drag), then preferences, classic-mode switch, and the clock.
 */
export function Taskbar({ wallpaper, onWallpaperChange, onStartDrop }: TaskbarProps) {
  const { windows, open, close } = useWindows();
  const config = useDesktopConfig();
  const { setMode } = useMode();
  const [popup, setPopup] = React.useState<"start" | "prefs" | null>(null);
  const [itemMenu, setItemMenu] = React.useState<ItemMenu | null>(null);

  // Session display order: pinned apps plus any running unpinned apps.
  // Reorders of the pinned subset persist; transient apps keep their
  // position for the session only. The Welcome app never auto-appears:
  // it is the home screen, and its button would read as a second start
  // button next to the real one (it still shows if explicitly pinned).
  const [order, setOrder] = React.useState<AppId[]>(() => [...config.taskbarPins]);
  React.useEffect(() => {
    setOrder((prev) => {
      const running = new Set(windows.map((w) => w.appId));
      const pinned = new Set(config.taskbarPins);
      const keep = prev.filter((id) => pinned.has(id) || running.has(id));
      const kept = new Set(keep);
      const added = [
        ...config.taskbarPins.filter((id) => !kept.has(id)),
        ...windows
          .map((w) => w.appId)
          .filter((id) => id !== "welcome" && !pinned.has(id) && !kept.has(id)),
      ];
      const next = [...keep, ...added];
      return next.join() === prev.join() ? prev : next;
    });
  }, [windows, config.taskbarPins]);

  const handleReorder = (next: AppId[]) => {
    setOrder(next);
    const pinned = new Set(config.taskbarPins);
    config.reorderTaskbar(next.filter((id) => pinned.has(id)));
  };

  const menuApp = itemMenu ? appById(itemMenu.id) : null;
  const menuRunning = itemMenu ? windows.some((w) => w.appId === itemMenu.id) : false;
  const menuPinned = itemMenu ? config.taskbarPins.includes(itemMenu.id) : false;

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 h-14 border-t border-glass-border bg-glass backdrop-blur-xl">
      <div className="flex h-full items-center gap-1.5 px-2 sm:px-3">
        {/* Start */}
        <button
          data-popup-toggle
          onClick={() => setPopup(popup === "start" ? null : "start")}
          aria-label="Open start menu"
          aria-expanded={popup === "start"}
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-foreground/10",
            popup === "start" && "bg-foreground/10"
          )}
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent font-mono text-xs font-bold text-accent-foreground">
            {site.initials}
          </span>
        </button>

        <SearchField />

        {/* Unified pinned + running apps, drag to reorder */}
        <Reorder.Group
          axis="x"
          values={order}
          onReorder={handleReorder}
          as="div"
          className="flex min-w-0 items-center gap-0.5 overflow-x-auto px-0.5"
        >
          {order.map((id) => (
            <TaskbarItem
              key={id}
              id={id}
              onContextMenu={(e) => {
                e.preventDefault();
                setItemMenu({ id, x: e.clientX, y: e.clientY, rename: false });
              }}
            />
          ))}
        </Reorder.Group>

        {/* Right cluster */}
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <button
            data-popup-toggle
            onClick={() => setPopup(popup === "prefs" ? null : "prefs")}
            aria-label="Open preferences"
            aria-expanded={popup === "prefs"}
            className={cn(
              "flex size-10 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-foreground/10",
              popup === "prefs" && "bg-foreground/10"
            )}
          >
            <Settings className="size-4.5" strokeWidth={1.6} />
          </button>
          <button
            onClick={() => setMode("classic")}
            className="hidden h-10 items-center gap-2 rounded-lg px-3 text-sm text-foreground/80 transition-colors hover:bg-foreground/10 sm:flex"
          >
            <Monitor className="size-4.5" strokeWidth={1.6} />
            Classic
          </button>
          <Clock />
        </div>
      </div>

      <AnimatePresence>
        {popup === "start" && (
          <StartMenu onClose={() => setPopup(null)} onStartDrop={onStartDrop} />
        )}
        {popup === "prefs" && (
          <PreferencesMenu
            onClose={() => setPopup(null)}
            wallpaper={wallpaper}
            onWallpaperChange={onWallpaperChange}
          />
        )}
      </AnimatePresence>

      {/* Taskbar icon context menu */}
      <AnimatePresence>
        {itemMenu && menuApp && (
          <ContextMenuShell
            key={`taskbar-menu-${itemMenu.id}`}
            x={itemMenu.x}
            y={itemMenu.y}
            width={210}
            onClose={() => setItemMenu(null)}
          >
            {itemMenu.rename ? (
              <div className="p-1">
                <input
                  autoFocus
                  defaultValue={config.labelFor(itemMenu.id)}
                  aria-label={`Rename ${menuApp.title}`}
                  onFocus={(e) => e.currentTarget.select()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      config.renameApp(itemMenu.id, e.currentTarget.value);
                      setItemMenu(null);
                    }
                    if (e.key === "Escape") setItemMenu(null);
                  }}
                  className="w-full rounded-md border border-accent/60 bg-background px-2 py-1 text-sm outline-none"
                />
                <p className="mt-1 px-1 text-xs text-muted-foreground">
                  Enter saves, Esc cancels.
                </p>
              </div>
            ) : (
              <>
                <MenuItem
                  icon={ExternalLink}
                  onClick={() => {
                    open(itemMenu.id);
                    setItemMenu(null);
                  }}
                >
                  Open
                </MenuItem>
                <MenuItem
                  icon={Pencil}
                  onClick={() => setItemMenu({ ...itemMenu, rename: true })}
                >
                  Rename
                </MenuItem>
                {menuPinned ? (
                  <MenuItem
                    icon={PinOff}
                    onClick={() => {
                      config.unpinFromTaskbar(itemMenu.id);
                      setItemMenu(null);
                    }}
                  >
                    Remove from Taskbar
                  </MenuItem>
                ) : (
                  <MenuItem
                    icon={Pin}
                    onClick={() => {
                      config.pinToTaskbar(itemMenu.id);
                      setItemMenu(null);
                    }}
                  >
                    Pin to Taskbar
                  </MenuItem>
                )}
                {menuRunning && (
                  <>
                    <MenuDivider />
                    <MenuItem
                      icon={X}
                      onClick={() => {
                        close(itemMenu.id);
                        setItemMenu(null);
                      }}
                    >
                      Close
                    </MenuItem>
                  </>
                )}
              </>
            )}
          </ContextMenuShell>
        )}
      </AnimatePresence>
    </div>
  );
}
