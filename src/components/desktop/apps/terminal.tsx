"use client";

import * as React from "react";
import { useTheme } from "next-themes";

import { site, projects, skills } from "@/lib/site";
import { useMode } from "@/components/providers";
import { useWindows } from "@/components/desktop/window/window-manager";

type Line = { kind: "cmd" | "out"; text: string };

const PROMPT = "guest@portfolio:~$";

const BANNER: Line[] = [
  { kind: "out", text: `Portfolio shell. ${site.name}, ${site.role}.` },
  { kind: "out", text: "Type `help` to see what this thing can do." },
  { kind: "out", text: "" },
];

/**
 * A small interactive shell. Commands can open other windows, flip the
 * theme, or bail back to classic mode.
 */
export function TerminalApp() {
  const { open, close } = useWindows();
  const { setMode } = useMode();
  const { resolvedTheme, setTheme } = useTheme();

  const [lines, setLines] = React.useState<Line[]>(BANNER);
  const [input, setInput] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Shell-style history: Up/Down walk past commands; the in-progress draft
  // comes back when walking forward past the newest entry.
  const historyRef = React.useRef<string[]>([]);
  const [histPos, setHistPos] = React.useState<number | null>(null);
  const draftRef = React.useRef("");

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  function run(raw: string) {
    const cmd = raw.trim().toLowerCase();
    const echo: Line = { kind: "cmd", text: raw };

    const print = (...out: string[]) =>
      setLines((prev) => [...prev, echo, ...out.map((text) => ({ kind: "out" as const, text }))]);

    switch (cmd) {
      case "":
        setLines((prev) => [...prev, echo]);
        break;
      case "help":
        print(
          "available commands:",
          "  whoami     who is behind this site",
          "  skills     tech I work with",
          "  projects   open the Projects window",
          "  about      open the About window",
          "  contact    open the Contact window",
          "  theme      toggle dark / light",
          "  classic    switch to the classic site",
          "  clear      clear the screen",
          "  exit       close this terminal"
        );
        break;
      case "whoami":
        print(`${site.name}. ${site.role}. ${site.tagline}`);
        break;
      case "skills":
        print(...skills.map((g) => `  ${g.category.toLowerCase()}: ${g.items.join(", ")}`));
        break;
      case "projects":
        print(
          ...projects.map((p) => `  ${p.name.toLowerCase().padEnd(12)} ${p.tech[0]}`),
          "opening Projects window..."
        );
        open("projects");
        break;
      case "about":
        print("opening About window...");
        open("about");
        break;
      case "contact":
        print(`email: ${site.email}. opening Contact window...`);
        open("contact");
        break;
      case "theme":
        print(`switching to ${resolvedTheme === "dark" ? "light" : "dark"} theme`);
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
        break;
      case "classic":
        print("leaving the desktop...");
        window.setTimeout(() => setMode("classic"), 400);
        break;
      case "clear":
        setLines([]);
        break;
      case "exit":
        close("terminal");
        break;
      default:
        print(`command not found: ${cmd}. Try \`help\`.`);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const history = historyRef.current;
    if (event.key === "Enter") {
      run(input);
      if (input.trim() && history[history.length - 1] !== input) {
        history.push(input);
      }
      setHistPos(null);
      setInput("");
    } else if (event.key === "ArrowUp") {
      if (history.length === 0) return;
      event.preventDefault();
      if (histPos === null) draftRef.current = input;
      const pos = histPos === null ? history.length - 1 : Math.max(0, histPos - 1);
      setHistPos(pos);
      setInput(history[pos]);
    } else if (event.key === "ArrowDown") {
      if (histPos === null) return;
      event.preventDefault();
      const pos = histPos + 1;
      if (pos >= history.length) {
        setHistPos(null);
        setInput(draftRef.current);
      } else {
        setHistPos(pos);
        setInput(history[pos]);
      }
    }
  }

  return (
    // Click-to-focus convenience; the input itself is fully accessible.
    <div
      className="flex h-full cursor-text flex-col overflow-y-auto bg-background p-4 font-mono text-[13px] leading-relaxed"
      onClick={() => inputRef.current?.focus()}
    >
      {lines.map((line, i) => (
        <div key={i} className="whitespace-pre-wrap break-words">
          {line.kind === "cmd" ? (
            <>
              <span className="text-accent">{PROMPT}</span>{" "}
              <span>{line.text}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{line.text || " "}</span>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2">
        <span className="shrink-0 text-accent">{PROMPT}</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Terminal input"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full bg-transparent caret-accent outline-none"
        />
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
