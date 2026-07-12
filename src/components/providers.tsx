"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";

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
  // Server renders classic; the stored preference is applied after mount so
  // SSR output stays deterministic. HomeShell turns the swap into a boot
  // animation rather than a flash.
  const [mode, setModeState] = React.useState<SiteMode>("classic");
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
    if (stored === "desktop" || stored === "classic") {
      setModeState(stored);
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

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <ModeProvider>{children}</ModeProvider>
    </ThemeProvider>
  );
}
