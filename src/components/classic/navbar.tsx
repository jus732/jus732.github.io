"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, Monitor, Moon, Sun, X } from "lucide-react";

import { site } from "@/lib/site";
import { useMode } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  // { href: "/projects", label: "Projects" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle color theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* Render a stable icon until mounted to avoid a hydration mismatch */}
      {mounted && resolvedTheme === "light" ? <Sun /> : <Moon />}
    </Button>
  );
}

/** Fixed top navigation for classic mode. */
export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { setMode } = useMode();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const reduce = useReducedMotion();

  function enterDesktopMode() {
    setMenuOpen(false);
    setMode("desktop");
    // The desktop experience lives on the homepage.
    if (pathname !== "/") router.push("/");
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-background/75 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent font-mono text-xs font-bold text-accent-foreground">
            {site.initials}
          </span>
          <span className="hidden sm:inline">{site.name}</span>
        </Link>

        <ul className="ml-auto hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm transition-colors hover:text-foreground",
                  pathname === link.href
                    ? "font-medium text-accent"
                    : "text-muted-foreground"
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            onClick={enterDesktopMode}
            className="hidden sm:inline-flex"
          >
            <Monitor />
            Desktop mode
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-border md:hidden"
          >
            <ul className="space-y-1 px-4 py-3">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "block rounded-lg px-3 py-2.5 text-sm transition-colors",
                      pathname === link.href
                        ? "bg-muted font-medium text-accent"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <button
                  onClick={enterDesktopMode}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
                >
                  <Monitor className="size-4" />
                  Desktop mode
                </button>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
