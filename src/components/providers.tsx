"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";

import { APP_SIZES } from "@/components/desktop/app-meta";

/** The two site experiences. See `HomeShell` for how the switch is staged. */
export type SiteMode = "classic" | "desktop";

type ModeContextValue = {
  mode: SiteMode;
  setMode: (mode: SiteMode) => void;
  /** True once the persisted preference has been read on the client. */
  hydrated: boolean;
};

const ModeContext = React.createContext<ModeContextValue | null>(null);

const MODE_STORAGE_KEY = "portfolio-mode";

function ModeProvider({ children }: { children: React.ReactNode }) {
  // Server renders classic; the stored preference is applied after mount so SSR output stays deterministic
  // HomeShell turns the swap into a boot animation
  const [mode, setModeState] = React.useState<SiteMode>("classic");
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    // following a shared link shouldn't flip the visitor's own preference; only the homepage hosts the desktop
    const requested = new URLSearchParams(window.location.search).get("app");
    if (
      window.location.pathname === "/" &&
      requested !== null &&
      requested in APP_SIZES
    ) {
      setModeState("desktop");
    } else {
      const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
      if (stored === "desktop" || stored === "classic") {
        setModeState(stored);
      }
    }
    setHydrated(true);
  }, []);

  const setMode = React.useCallback((next: SiteMode) => {
    setModeState(next);
    window.localStorage.setItem(MODE_STORAGE_KEY, next);
  }, []);

  const value = React.useMemo(
    () => ({ mode, setMode, hydrated }),
    [mode, setMode, hydrated]
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode() {
  const ctx = React.useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within <Providers>");
  return ctx;
}

/**
 * Cross-fades light/dark switches. Watching the class attribute (rather than
 * wrapping setTheme) covers every toggle site — navbar, taskbar, terminal —
 * and skips the initial load for free, since next-themes sets the class
 * before this observer attaches. The `.theme-fade` transition rules live in
 * globals.css; reduced motion keeps the instant swap.
 */
function ThemeFade() {
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    let wasDark = root.classList.contains("dark");
    let timer: number | undefined;
    const observer = new MutationObserver(() => {
      const isDark = root.classList.contains("dark");
      if (isDark === wasDark) return;
      wasDark = isDark;
      root.classList.add("theme-fade");
      window.clearTimeout(timer);
      timer = window.setTimeout(() => root.classList.remove("theme-fade"), 350);
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      root.classList.remove("theme-fade");
    };
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={true}>
      <ThemeFade />
      <ModeProvider>{children}</ModeProvider>
    </ThemeProvider>
  );
}
