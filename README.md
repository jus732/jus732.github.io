# Hi! I'm Justin Santiago.

This is my personal website, which I plan to fill with various little projects over time.

A dual-mode portfolio site built on TypeScript using Next.js 15 (App Router), Tailwind CSS 4, and Framer Motion, with assistance from my local AI setup (Qwen 3.6 35B-A3B through llama.cpp, Hermes, OpenCode) as well as Claude for more complex debugging issues.
I built the general architecture of the system and had AI handle optimization and styling.


## Modes

- **Classic** - standard portfolio layout with a fixed top nav and page transitions.
- **Desktop** - Windows-style desktop - double-click icons to open sections in draggable windows, minimize them to the taskbar, right-click for a context menu, and a bunch of little apps to play with.
  -  Desktop views are shareable: `/?app=projects` boots straight into the desktop with that window focused
  -  Preferences (theme, icon placement, etc.) persist in localStorage

Toggle between them via the "Desktop mode" button in the nav (or "Classic" in the taskbar).


## Stack

- TypeScript, Next.js 15, App Router, `@/` import alias
- Tailwind CSS 4 (CSS-first config in `src/app/globals.css`)
- Framer Motion, Lucide icons, next-themes (dark by default), shadcn-style UI primitives in `src/components/ui`
- SEO baked in: `robots.ts`, `sitemap.ts`, a build-time Open Graph image, and JSON-LD Person schema - all generated from `src/lib/site.ts`
- Deployed to Vercel
- Simple CI/CD (GitHub Actions) runs lint, typecheck, and build


## Structure

- `site.ts` is the source of truth for all user info
- 

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

## Before launch

- Replace the placeholder content in `src/lib/site.ts`
- Swap picsum.photos thumbnails for real screenshots (then drop the `remotePatterns` entry in `next.config.ts`)
- Wire the contact form to a backend or form service
