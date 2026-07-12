"use client";

import { motion } from "framer-motion";

import { site } from "@/lib/site";

/**
 * Full-screen overlay played while switching modes: a boot sequence into
 * desktop mode, and a quick fade back to classic.
 */
export function BootScreen({ kind }: { kind: "boot" | "shutdown" }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4, ease: "easeInOut" } }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background"
    >
      <motion.span
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.05 }}
        className="flex size-14 items-center justify-center rounded-xl bg-accent font-mono text-lg font-bold text-accent-foreground"
      >
        {site.initials}
      </motion.span>

      {kind === "boot" ? (
        <>
          <p className="text-sm text-muted-foreground">Starting desktop</p>
          <div className="h-1 w-52 overflow-hidden rounded-lg bg-muted">
            <div className="animate-boot-sweep h-full w-full rounded-lg bg-accent" />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Back to classic</p>
      )}
    </motion.div>
  );
}
