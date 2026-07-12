# Hi! I'm Justin Santiago.

This is my personal website, which I plan to fill with various little projects over time.

A dual-mode portfolio site built with Next.js 15 (App Router), Tailwind CSS 4, and Framer Motion.

## Modes

- **Classic** - standard portfolio layout with a fixed top nav and page transitions.
- **Desktop** - the homepage becomes a Windows-style desktop: double-click icons to open sections in draggable windows, minimize them to the taskbar, right-click for a context menu, and try the Terminal (`help`, with Up/Down command history).

Toggle between them via the "Desktop mode" button in the nav (or "Classic" in the taskbar). The preference persists in localStorage. Desktop views are shareable: `/?app=projects` boots straight into the desktop with that window focused (without overwriting the visitor's saved preference). The desktop bundle is lazy-loaded, so classic-mode visitors never download it.

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

Other scripts:

```bash
npm run lint       # ESLint (flat config, next/core-web-vitals)
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

CI (GitHub Actions) runs lint, typecheck, and build on every push and PR.

## Stack

- Next.js 15, App Router, TypeScript, `@/` import alias
- Tailwind CSS 4 (CSS-first config in `src/app/globals.css`)
- Framer Motion, Lucide icons, next-themes (dark by default), shadcn-style UI primitives in `src/components/ui`
- SEO baked in: `robots.ts`, `sitemap.ts`, a build-time Open Graph image, and JSON-LD Person schema - all generated from `src/lib/site.ts`

## Structure

```
src/
  app/            routes + metadata, robots/sitemap/OG image (server components)
  components/
    classic/      navbar, hero, footer, page chrome
    content/      section content shared by both modes
    desktop/      window manager, windows, taskbar, icons, wallpaper
    ui/           button, card, badge, input, textarea
  lib/site.ts     all placeholder content in one place
```

## Before launch

- Replace the placeholder content in `src/lib/site.ts` (name, links, projects, bio).
- Swap picsum.photos thumbnails for real screenshots (then drop the `remotePatterns` entry in `next.config.ts`).
- Wire the contact form to a backend or form service.

Deploys cleanly to Vercel with zero config.
