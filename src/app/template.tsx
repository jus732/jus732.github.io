"use client";

import { motion } from "framer-motion";

/**
 * Route transition: a quick opacity fade on every navigation.
 * Opacity only, on purpose: a transform here would break the fixed navbar
 * (transforms create a new containing block for position: fixed).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
