"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";

/** Decorative build id for the status bars (the accent hex, as a wink). */
const BUILD_HASH = "0a86e8f";

/**
 * Shared classic-mode chrome, established by the landing hero and reused by
 * the inner pages: FrameSection supplies the blueprint-grid backdrop with
 * the drifting accent glow and the cursor-reactive lit grid; WindowFrame is
 * the decorative app-window shell (faux title bar, content, status-bar
 * footer) that types its title in on mount. Purely visual — nothing drags
 * or closes, keeping classic mode distinct from the desktop windows.
 */

/* ----- Typewriter ----- */

// useLayoutEffect on the client so the reset-to-untyped happens before the
// first paint after hydration — otherwise the fully-typed SSR state flashes
// for a frame before the reveal starts. Plain useEffect on the server keeps
// SSR warning-free.
const useClientLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/**
 * Typewriter progress across `lines`, typed in order. When enabled, the
 * state starts *untyped* so the SSR markup already ships the hidden reveal
 * (same tradeoff as the hero's framer-motion initial styles — no flash of
 * final content before hydration; sr-only copies keep the text available
 * to crawlers and assistive tech). Reduced motion flips to the final text
 * in a pre-paint layout effect; `enabled: false` renders it from the
 * start. Callers must pass a referentially stable `lines`.
 */
export function useTypedLines(
  lines: readonly string[],
  { startDelay = 550, enabled = true }: { startDelay?: number; enabled?: boolean } = {}
) {
  const reduce = useReducedMotion();
  const [typing, setTyping] = React.useState<{ line: number; chars: number }>(
    enabled ? { line: 0, chars: 0 } : { line: lines.length, chars: 0 }
  );

  useClientLayoutEffect(() => {
    if (!enabled || reduce) {
      setTyping({ line: lines.length, chars: 0 });
      return;
    }
    let line = 0;
    let chars = 0;
    let timer: number;
    setTyping({ line, chars });
    const step = () => {
      if (chars < lines[line].length) {
        chars += 1;
      } else if (line + 1 < lines.length) {
        line += 1;
        chars = 0;
      } else {
        setTyping({ line: lines.length, chars: 0 });
        return;
      }
      setTyping({ line, chars });
      timer = window.setTimeout(step, chars === 0 ? 380 : 16 + Math.random() * 26);
    };
    timer = window.setTimeout(step, startDelay);
    return () => window.clearTimeout(timer);
  }, [lines, reduce, enabled, startDelay]);

  return {
    /** Visible slice of line `i`. */
    text: (i: number) =>
      typing.line > i ? lines[i] : typing.line === i ? lines[i].slice(0, typing.chars) : "",
    activeLine: typing.line,
    done: typing.line >= lines.length,
  };
}

/** Block terminal caret; solid while typing, blinking once settled. */
export function Caret({ blinking }: { blinking: boolean }) {
  return (
    <span
      aria-hidden
      className={
        "ml-0.5 inline-block h-[1.05em] w-[0.55ch] translate-y-[0.18em] bg-accent" +
        (blinking ? " animate-cursor-blink" : "")
      }
    />
  );
}

/**
 * A line that reserves space for its full text (invisible placeholder keeps
 * layout stable while typing) and paints the typed slice over it. The full
 * text stays available to assistive tech via the sr-only copy. The parent
 * element must be `relative`.
 */
export function TypedLine({
  text,
  typed,
  caret,
}: {
  text: string;
  typed: string;
  caret: React.ReactNode;
}) {
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="invisible">
        {text}
      </span>
      <span aria-hidden className="absolute inset-0">
        {typed}
        {caret}
      </span>
    </>
  );
}

/* ----- Backdrop ----- */

/**
 * Section wrapper with the hero backdrop. The pointer position feeds two
 * CSS vars that the lit-grid mask tracks — direct style writes, no React
 * state per move. All motion is disabled under reduced motion.
 */
export function FrameSection({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const sectionRef = React.useRef<HTMLElement>(null);

  function handlePointerMove(e: React.PointerEvent) {
    const el = sectionRef.current;
    if (!el || reduce) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--hero-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--hero-y", `${e.clientY - rect.top}px`);
  }

  return (
    <section
      ref={sectionRef}
      onPointerMove={handlePointerMove}
      className={`group relative overflow-hidden ${className}`}
    >
      {/* Background: blueprint grid fading toward the left + drifting glow */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_80%_70%_at_70%_45%,black,transparent)]"
          style={{
            backgroundImage:
              "linear-gradient(var(--wall-grid) 1px, transparent 1px), linear-gradient(90deg, var(--wall-grid) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="animate-glow-drift absolute right-[-10%] top-[12%] h-[34rem] w-[34rem] rounded-full bg-accent/15 blur-[120px]" />
        {/* Grid-reactive glow: the same grid geometry redrawn in accent plus a
            faint wash, masked to a soft circle that tracks the cursor so the
            lines light up under it and fade back as it leaves. */}
        <div
          className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 motion-reduce:hidden"
          style={{
            backgroundImage:
              "radial-gradient(15rem circle at var(--hero-x, 70%) var(--hero-y, 45%), color-mix(in srgb, var(--accent) 7%, transparent), transparent 70%), linear-gradient(color-mix(in srgb, var(--accent) 50%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--accent) 50%, transparent) 1px, transparent 1px)",
            backgroundSize: "100% 100%, 56px 56px, 56px 56px",
            WebkitMaskImage:
              "radial-gradient(15rem circle at var(--hero-x, 70%) var(--hero-y, 45%), black, transparent 75%)",
            maskImage:
              "radial-gradient(15rem circle at var(--hero-x, 70%) var(--hero-y, 45%), black, transparent 75%)",
          }}
        />
      </div>

      {children}
    </section>
  );
}

/* ----- Window shell ----- */

/** Status-bar footer: ● build hash on the left, local time on the right. */
function StatusBar() {
  // Clock is set on the client only, so SSR output stays stable.
  const [clock, setClock] = React.useState<string | null>(null);
  React.useEffect(() => {
    const update = () =>
      setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    update();
    const id = window.setInterval(update, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex items-center justify-between gap-4 border-t border-border/70 bg-muted/40 px-4 py-2 font-mono text-[11px] tracking-wide text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="size-1.5 rounded-full bg-accent" />
        <span className="sr-only">online, </span>
        build {BUILD_HASH}
      </span>
      <span>{clock ?? "--:--"}</span>
    </div>
  );
}

/** External typing control for WindowFrame's title bar (see useTypedLines). */
export type TypedTitle = { typed: string; caret: React.ReactNode };

/**
 * Decorative app-window shell. Traffic-light dots in the title bar keep it
 * visually distinct from desktop-mode windows (those use Windows-style icon
 * buttons on the right). Default reveal: the title types in on mount
 * (`typeDelay` staggers windows sharing a page), the caret disappears once
 * it's done, and the content fades in. Pass `typedTitle` to drive the
 * title typing externally instead (the hero chains it into content typing);
 * the caller then owns the caret and content shows immediately. SSR and
 * reduced motion render everything at once, no typing, caret, or fade.
 */
export function WindowFrame({
  title,
  className = "",
  contentClassName = "px-6 py-8 sm:px-8 sm:py-10",
  typedTitle,
  typeDelay = 250,
  children,
}: {
  title: string;
  className?: string;
  contentClassName?: string;
  typedTitle?: TypedTitle;
  typeDelay?: number;
  children: React.ReactNode;
}) {
  const ownLines = React.useMemo(() => [title], [title]);
  const own = useTypedLines(ownLines, { startDelay: typeDelay, enabled: !typedTitle });
  const contentVisible = typedTitle ? true : own.done;

  return (
    <div
      className={`overflow-hidden rounded-xl border border-border/70 bg-card/55 shadow-[var(--surface-shadow)] backdrop-blur-sm ${className}`}
    >
      <div className="flex items-center gap-3 border-b border-border/70 bg-muted/40 px-4 py-2.5">
        <span aria-hidden className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-muted-foreground/30" />
          <span className="size-2.5 rounded-full bg-muted-foreground/30" />
          <span className="size-2.5 rounded-full bg-accent/70" />
        </span>
        <span className="relative font-mono text-xs text-muted-foreground">
          {typedTitle ? (
            <TypedLine text={title} typed={typedTitle.typed} caret={typedTitle.caret} />
          ) : (
            <TypedLine
              text={title}
              typed={own.text(0)}
              caret={!own.done && <Caret blinking={false} />}
            />
          )}
        </span>
      </div>

      <div
        className={`${contentClassName} transition-opacity duration-500 motion-reduce:transition-none ${
          contentVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        {children}
      </div>

      <StatusBar />
    </div>
  );
}

/**
 * Consistent page header for the inner classic pages: the hero's app-window
 * chrome with the page title as its terminal path. Uses WindowFrame's
 * default reveal — title types, then the h1, lede, and optional children
 * (used by About and Contact to host their first content block) fade in
 * together. Wrap the surrounding section in FrameSection to get the
 * matching backdrop.
 */
export function PageHeader({
  title,
  lede,
  className = "max-w-2xl",
  typeDelay,
  children,
}: {
  title: string;
  lede: string;
  className?: string;
  typeDelay?: number;
  children?: React.ReactNode;
}) {
  return (
    <WindowFrame
      title={`justin — ~/${title.toLowerCase()}`}
      className={className}
      contentClassName="px-6 py-7 sm:px-8 sm:py-8"
      typeDelay={typeDelay}
    >
      <header>
        <h1 className="text-4xl font-semibold tracking-tighter sm:text-5xl">{title}</h1>
        {lede && <p className="mt-4 leading-relaxed text-muted-foreground">{lede}</p>}
      </header>
      {children && <div className="mt-6">{children}</div>}
    </WindowFrame>
  );
}
