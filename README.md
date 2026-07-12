# Hi! I'm Justin Santiago.

This is my personal website, which I plan to fill with various little projects over time.

A dual-mode portfolio site built with Next.js 15 (App Router), Tailwind CSS 4, and Framer Motion.

## Modes

- **Classic** - standard portfolio layout with a fixed top nav and page transitions.
- **Desktop** - the homepage becomes a Windows-style desktop: double-click icons to open sections in draggable windows, minimize them to the taskbar, right-click for a context menu, and try the Terminal (`help`).

Toggle between them via the "Desktop mode" button in the nav (or "Classic" in the taskbar). The preference persists in localStorage.

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Stack

- Next.js 15, App Router, TypeScript, `@/` import alias
- Tailwind CSS 4 (CSS-first config in `src/app/globals.css`)
- Framer Motion, Lucide icons, next-themes (dark by default), shadcn-style UI primitives in `src/components/ui`

## Structure

```
src/
  app/            routes + metadata (server components)
  components/
    classic/      navbar, hero, footer, page chrome
    content/      section content shared by both modes
    desktop/      window manager, windows, taskbar, icons, wallpaper
    ui/           button, card, badge, input, textarea
  lib/site.ts     all placeholder content in one place
```

## Before launch

- Replace the placeholder content in `src/lib/site.ts` (name, links, projects, bio).
- Set the real domain in `site.url` (used for metadata / Open Graph).
- Swap picsum.photos thumbnails for real screenshots.
- Wire the contact form to a backend or form service.

Deploys cleanly to Vercel with zero config.
