"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Positioned right-click menu. Rendered through a portal so it can be
 * opened from inside the taskbar (whose backdrop-filter would otherwise
 * turn `position: fixed` into taskbar-relative coordinates).
 */
export function ContextMenuShell({
  x,
  y,
  onClose,
  width = 224,
  children,
}: {
  x: number;
  y: number;
  onClose: () => void;
  width?: number;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState({ left: x, top: y });

  // Clamp into the viewport once the real height is measurable
  // (layout effect, so before paint).
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      left: Math.max(4, Math.min(x, window.innerWidth - rect.width - 8)),
      top: Math.max(4, Math.min(y, window.innerHeight - rect.height - 8)),
    });
  }, [x, y]);

  // Subscribed once, reading onClose via a ref: re-subscribing on identity
  // changes can drop the listener mid-dispatch when a pointerdown flushes
  // state elsewhere (see TaskbarPopup for the full story).
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onCloseRef.current();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return createPortal(
    <motion.div
      ref={ref}
      role="menu"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      style={{ top: pos.top, left: pos.left, width }}
      className="fixed z-[70] rounded-xl border border-border bg-card/95 p-1.5 shadow-2xl backdrop-blur-xl"
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </motion.div>,
    document.body
  );
}

export function MenuItem({
  icon: Icon,
  onClick,
  children,
  className,
}: {
  icon?: LucideIcon;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-muted",
        className
      )}
    >
      {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />}
      {children}
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1.5 border-t border-border" />;
}
