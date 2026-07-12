"use client";

import type * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  Brush,
  Calculator,
  FolderCode,
  Gamepad2,
  Mail,
  NotebookPen,
  Search,
  Sparkles,
  SquareTerminal,
  UserRound,
} from "lucide-react";

import { APP_SIZES, type AppId, type AppKind } from "@/components/desktop/app-meta";
import { ProjectsGrid } from "@/components/content/projects-grid";
import { AboutContent } from "@/components/content/about-content";
import { ContactContent } from "@/components/content/contact-content";
import { WelcomeApp } from "@/components/desktop/welcome";
import { TerminalApp } from "@/components/desktop/terminal";
import { SearchApp } from "@/components/desktop/search-app";
import { CalculatorApp } from "@/components/desktop/calculator-app";
import { NotepadApp } from "@/components/desktop/notepad-app";
import { PaintApp } from "@/components/desktop/paint-app";
import { TetrisApp } from "@/components/desktop/tetris/tetris-app";

export type { AppId } from "@/components/desktop/app-meta";

export type DesktopApp = {
  id: AppId;
  title: string;
  /** One-liner shown in the icon hover preview and search results. */
  blurb: string;
  icon: LucideIcon | React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** Sections live as desktop icons; utilities are pinned to the taskbar. */
  kind: AppKind;
  /** Default window size in px (clamped to the viewport). */
  size: { w: number; h: number };
  /** Render a scaled-down live render of the content in the hover preview. */
  livePreview: boolean;
  /** Whether the window applies its default content padding. */
  padded: boolean;
  content: React.ComponentType;
};

export const apps: DesktopApp[] = [
  {
    id: "welcome",
    title: "Welcome",
    blurb: "Who I am and how this desktop works.",
    icon: Sparkles,
    kind: "section",
    size: APP_SIZES.welcome,
    livePreview: true,
    padded: true,
    content: WelcomeApp,
  },
  // TODO: reveal projects when ready
  // {
  //   id: "projects",
  //   title: "Projects",
  //   blurb: "Six things I have built and shipped.",
  //   icon: FolderCode,
  //   kind: "section",
  //   size: APP_SIZES.projects,
  //   livePreview: true,
  //   padded: true,
  //   content: ProjectsGrid,
  // },
  {
    id: "about",
    title: "About",
    blurb: "Bio, skills, and how I think about engineering.",
    icon: UserRound,
    kind: "section",
    size: APP_SIZES.about,
    livePreview: true,
    padded: true,
    content: AboutContent,
  },
  {
    id: "contact",
    title: "Contact",
    blurb: "Email, links, and a message form.",
    icon: Mail,
    kind: "section",
    size: APP_SIZES.contact,
    livePreview: true,
    padded: true,
    content: ContactContent,
  },
  {
    id: "terminal",
    title: "Terminal",
    blurb: "A real shell, more or less. Try `help`.",
    icon: SquareTerminal,
    kind: "section",
    size: APP_SIZES.terminal,
    livePreview: false,
    padded: false,
    content: TerminalApp,
  },
  {
    id: "search",
    title: "Search",
    blurb: "Find any section or app on this site.",
    icon: Search,
    kind: "utility",
    size: APP_SIZES.search,
    livePreview: false,
    padded: false,
    content: SearchApp,
  },
  {
    id: "calculator",
    title: "Calculator",
    blurb: "Basic arithmetic, no cloud required.",
    icon: Calculator,
    kind: "utility",
    size: APP_SIZES.calculator,
    livePreview: false,
    padded: false,
    content: CalculatorApp,
  },
  {
    id: "notepad",
    title: "Notepad",
    blurb: "Scratch pad that autosaves to this browser.",
    icon: NotebookPen,
    kind: "utility",
    size: APP_SIZES.notepad,
    livePreview: false,
    padded: false,
    content: NotepadApp,
  },
  {
    id: "paint",
    title: "Paint",
    blurb: "A little drawing canvas. Make a mess.",
    icon: Brush,
    kind: "utility",
    size: APP_SIZES.paint,
    livePreview: false,
    padded: false,
    content: PaintApp,
  },
  {
    id: "tetris",
    title: "Tetris",
    blurb: "Full Tetris clone with hold, ghost, and high scores.",
    icon: Gamepad2,
    kind: "utility",
    size: APP_SIZES.tetris,
    livePreview: false,
    padded: false,
    content: TetrisApp,
  },
];

export const sectionApps = apps.filter((app) => app.kind === "section");
export const utilityApps = apps.filter((app) => app.kind === "utility");

export function appById(id: AppId) {
  return apps.find((app) => app.id === id);
}
