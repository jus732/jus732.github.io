"use client";

import * as React from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";

import { useMode, type SiteMode } from "@/components/providers";
import { Navbar } from "@/components/classic/navbar";
import { Hero } from "@/components/classic/hero";
import { Footer } from "@/components/classic/footer";
import { Desktop } from "@/components/desktop/desktop";
import { BootScreen } from "@/components/desktop/boot-screen";

/**
 * The homepage switchboard. `mode` is the user's chosen experience;
 * `visual` is what is actually on screen. When they diverge (a toggle, or a
 * persisted desktop preference restored after hydration), a boot/shutdown
 * overlay covers the swap so the transition reads as intentional.
 */
export function HomeShell() {
  const { mode, hydrated } = useMode();
  const reduce = useReducedMotion();
  const [visual, setVisual] = React.useState<SiteMode>("classic");
  const [overlay, setOverlay] = React.useState<"boot" | "shutdown" | null>(null);
  // Tracked in a ref so the transition effect depends on `mode` only;
  // depending on `visual` would cancel the overlay-dismiss timer when the
  // scene swaps mid-transition.
  const visualRef = React.useRef<SiteMode>("classic");

  React.useEffect(() => {
    if (!hydrated || mode === visualRef.current) return;

    const entering = mode === "desktop";
    setOverlay(entering ? "boot" : "shutdown");

    // Swap the scene while the overlay is opaque, then lift the overlay.
    const swapDelay = reduce ? 100 : entering ? 750 : 350;
    const doneDelay = reduce ? 250 : entering ? 1450 : 800;

    const swap = window.setTimeout(() => {
      visualRef.current = mode;
      setVisual(mode);
    }, swapDelay);
    const done = window.setTimeout(() => setOverlay(null), doneDelay);
    return () => {
      window.clearTimeout(swap);
      window.clearTimeout(done);
    };
  }, [mode, hydrated, reduce]);

  return (
    <>
      {visual === "classic" ? (
        <>
          <Navbar />
          <main>
            <Hero />
          </main>
          <Footer />
        </>
      ) : (
        <Desktop />
      )}

      <AnimatePresence>{overlay && <BootScreen kind={overlay} />}</AnimatePresence>
    </>
  );
}
