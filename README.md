# justin-santiago.com

Hey there! This is my personal website, which I plan to fill with various little projects over time.

A dual-mode portfolio site built on TypeScript using Next.js 15 (App Router), Tailwind CSS 4, and Framer Motion, with assistance from my local inference setup (see [footnotes section](https://github.com/jus732/jus732.github.io#footnotes) for more detail) and Claude for more complex debugging issues.


## Stack

- TypeScript, Next.js 15, App Router, `@/` import alias
- Tailwind CSS 4 (CSS-first config in `src/app/globals.css`)
- Framer Motion, Lucide icons, next-themes (dark by default), shadcn-style UI primitives in `src/components/ui`
- SEO baked in: `robots.ts`, `sitemap.ts`, a build-time Open Graph image, and JSON-LD Person schema - all generated from `src/lib/site.ts`
- Simple CI/CD (GitHub Actions) runs lint, typecheck, and build
- Deployed to Vercel

## Modes

- **Classic** - standard portfolio layout with a fixed top nav and page transitions.
- **Desktop** - Windows-style desktop - double-click icons to open sections in draggable windows, minimize them to the taskbar, right-click for a context menu, and a bunch of little apps to play with.
  -  Desktop views are shareable: `/?app=projects` boots straight into the desktop with that window focused
  -  Preferences (theme, icon placement, etc.) persist in localStorage

Toggle between them via the "Desktop mode" button in the nav (or "Classic" in the taskbar).


## Structure

- `site.ts` is the source of truth for all user info

```
src/
  app/            routes + metadata, robots/sitemap/OG image (server components)
  components/
    classic/      navbar, hero, footer, page chrome
    content/      section content shared by both modes
    desktop/      window manager, windows, taskbar, icons, backgrounds
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



## Footnotes

### Local inference setup

#### Harness
  - current: [oh-my-pi](https://github.com/can1357/oh-my-pi)
  - previously used:
   - [Hermes](https://github.com/nousresearch/hermes-agent)
   - [OpenCode](https://github.com/anomalyco/opencode)

#### Inference servers
  - [exllamav3](https://github.com/turboderp-org/exllamav3)
    - very underrated, my server of choice - the best for a single user with an NVIDIA GPU
    - in my usage it provides the best throughput and highest quality quantizations per GB thanks to its support of Trellis quantization 
  - [vllm](https://github.com/vllm-project/vllm)
    - what I use to serve my local network
    - best for concurrency thanks to continuous batching, paged attention, etc. 
  - [llama.cpp](https://github.com/ggml-org/llama.cpp)
    - where I started; easiest to get started and very solid performance, especially after creating my own personal branch for unmerged optimizations
  
#### Models
  - Qwen3.6/Qwen.3.8 27B
    - most bang for buck possible - despite being small at 27 billion parameters, very fast and extremely capable once tuned
  - Qwen3.8 Flash-Next
    - highest quality model I can run on my server, used mainly for tasks requiring high reasoning and world knowledge
  - Qwen3.6 35B-A3B
    - before building the inference server, easily the most reliable; in hindsight, pretty lacking in intelligence, but extremely fast
  - Gemma 26B-A4B
    - great for language and natural chat 
   
#### Specs
  - previously, I was using my gaming PC to run light inference - specifically Qwen3.6 35B-A3B and 27B + Gemma 26B-A4B. after a couple months of researching, here's the final build I ended up with to serve my local network:

CPU: AMD Ryzen 9 9900X

Motherboard: ASUS ProArt B850-CREATOR WIFI NEO

RAM: 2x32GB Samsung DDR5-4800 ECC (pushed to 5200 through AEMP)

GPUs: 2× RTX 3090 (Gigabyte AORUS GeForce RTX 3090 Xtreme, Zotac Gaming GeForce RTX 3090 Trinity OC)

OS: Ubuntu 26.04.1 LTS
