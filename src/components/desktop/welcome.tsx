"use client";

import { ArrowRight, Grip, MousePointerClick, Move, PanelBottom } from "lucide-react";

import { site } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { useWindows } from "@/components/desktop/window/window-manager";

const tips = [
  { icon: MousePointerClick, text: "Double-click a desktop icon to open it." },
  { icon: Move, text: "Drag windows by their title bar; resize from any edge." },
  { icon: Grip, text: "Icons drag anywhere and remember where you drop them." },
  { icon: PanelBottom, text: "The start menu has everything, including a few toys." },
];

/** Content of the Welcome window, opened automatically when the desktop boots. */
export function WelcomeApp() {
  const { open } = useWindows();

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-3xl font-semibold tracking-tighter sm:text-4xl">
          {site.name}
        </h2>
        <p className="mt-1.5 font-mono text-sm text-accent">{site.role}</p>
        <p className="mt-4 max-w-[46ch] leading-relaxed text-muted-foreground">
          {site.tagline}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {/* TODO: reveal projects when ready */}
        {/*<Button onClick={() => open("projects")}>*/}
        {/*  View Projects*/}
        {/*  <ArrowRight />*/}
        {/*</Button>*/}
        <Button onClick={() => open("about")}>
          About Me
          <ArrowRight />
        </Button>
        <Button variant="outline" onClick={() => open("contact")}>
          Get in Touch
        </Button>
      </div>

      <ul className="space-y-2.5 rounded-xl border border-border bg-muted/40 p-4">
        {tips.map((tip) => (
          <li key={tip.text} className="flex items-center gap-3 text-sm text-muted-foreground">
            <tip.icon className="size-4 shrink-0 text-accent" />
            {tip.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
