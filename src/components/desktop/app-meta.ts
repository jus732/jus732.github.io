/**
 * App metadata with no React imports. The window manager needs default
 * sizes at open time; keeping them here avoids a runtime import cycle with
 * the full registry in apps.tsx (which pulls in content components).
 */

export type AppId =
  | "welcome"
  | "projects"
  | "about"
  | "contact"
  | "terminal"
  | "search"
  | "calculator"
  | "notepad"
  | "paint"
  | "tetris";

/** Sections are portfolio content (desktop icons + start menu "routes");
 *  utilities are the small taskbar apps. */
export type AppKind = "section" | "utility";

export type Rect = { x: number; y: number; w: number; h: number };

export const APP_SIZES: Record<AppId, { w: number; h: number }> = {
  welcome: { w: 640, h: 540 },
  projects: { w: 1000, h: 660 },
  about: { w: 880, h: 620 },
  contact: { w: 920, h: 580 },
  terminal: { w: 680, h: 460 },
  search: { w: 560, h: 470 },
  calculator: { w: 340, h: 500 },
  notepad: { w: 660, h: 500 },
  paint: { w: 820, h: 600 },
  tetris: { w: 620, h: 720 },
};

export const MIN_WINDOW = { w: 320, h: 240 };

/** Height of the taskbar in px (h-14). Windows are confined above it. */
export const TASKBAR_HEIGHT = 56;
