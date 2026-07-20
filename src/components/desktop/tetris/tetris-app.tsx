"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Pause,
  Play,
  Repeat2,
  RotateCw,
  RotateCcw,
  Settings2,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useWindows } from "@/components/desktop/window/window-manager";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import {
  COLS,
  HIDDEN,
  PREVIEW_CELLS,
  ROWS,
  TOTAL_ROWS,
  TetrisEngine,
  type PieceType,
  type TetrisEvent,
} from "@/components/desktop/tetris/engine";
import { tetrisAudio, type SoundName } from "@/components/desktop/tetris/audio";

/* ----- Themes ----- */

type ThemeId = "electric" | "sunset";

type Theme = {
  id: ThemeId;
  name: string;
  tagline: string;
  board: string;
  grid: string;
  ghost: string;
  flash: string;
  glow: boolean;
  pieces: Record<PieceType, string>;
};

const THEMES: Theme[] = [
  {
    id: "electric",
    name: "Electric",
    tagline: "Neon on midnight",
    board: "#0a0e15",
    grid: "rgba(148, 178, 255, 0.07)",
    ghost: "rgba(160, 190, 255, 0.4)",
    flash: "rgba(200, 228, 255, 0.9)",
    glow: true,
    pieces: {
      I: "#22d3ee",
      O: "#facc15",
      T: "#a78bfa",
      S: "#34d399",
      Z: "#fb7185",
      J: "#4d9fff",
      L: "#fb923c",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    tagline: "Warm retro tones",
    board: "#211510",
    grid: "rgba(255, 196, 140, 0.08)",
    ghost: "rgba(255, 205, 160, 0.4)",
    flash: "rgba(255, 232, 205, 0.9)",
    glow: false,
    pieces: {
      I: "#f4a261",
      O: "#e9c46a",
      T: "#b5838d",
      S: "#8ab17d",
      Z: "#e5484d",
      J: "#a26a42",
      L: "#ff8552",
    },
  },
];

/* ----- Controls ----- */

type ActionId =
  | "moveLeft"
  | "moveRight"
  | "rotateCW"
  | "rotateCCW"
  | "softDrop"
  | "hardDrop"
  | "hold"
  | "pause";

const DEFAULT_CONTROLS: Record<ActionId, string> = {
  moveLeft: "ArrowLeft",
  moveRight: "ArrowRight",
  rotateCW: "ArrowUp",
  rotateCCW: "KeyZ",
  softDrop: "ArrowDown",
  hardDrop: "Space",
  hold: "ShiftLeft",
  pause: "KeyP",
};

const ACTION_LABELS: { id: ActionId; label: string }[] = [
  { id: "moveLeft", label: "Move left" },
  { id: "moveRight", label: "Move right" },
  { id: "rotateCW", label: "Rotate" },
  { id: "rotateCCW", label: "Rotate counter" },
  { id: "softDrop", label: "Soft drop" },
  { id: "hardDrop", label: "Hard drop" },
  { id: "hold", label: "Hold" },
  { id: "pause", label: "Pause" },
];

const KEY_NAMES: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Space: "Space",
  ShiftLeft: "Shift",
  ShiftRight: "R Shift",
  ControlLeft: "Ctrl",
  ControlRight: "R Ctrl",
  AltLeft: "Alt",
  Enter: "Enter",
  Tab: "Tab",
  Backspace: "Bksp",
};

function prettyKey(code: string) {
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  return code;
}

/* ----- Persistence ----- */

const THEME_KEY = "portfolio-tetris-theme";
const CONTROLS_KEY = "portfolio-tetris-controls";
const SCORES_KEY = "portfolio-tetris-scores";
const MUTED_KEY = "portfolio-tetris-muted";

type ScoreEntry = { score: number; lines: number; level: number; at: number };

function loadScores(): ScoreEntry[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SCORES_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => typeof s?.score === "number");
  } catch {
    return [];
  }
}

function loadControls(): Record<ActionId, string> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CONTROLS_KEY) ?? "{}");
    const merged = { ...DEFAULT_CONTROLS };
    for (const action of Object.keys(merged) as ActionId[]) {
      if (typeof parsed?.[action] === "string") merged[action] = parsed[action];
    }
    return merged;
  } catch {
    return { ...DEFAULT_CONTROLS };
  }
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/* ----- Tuning ----- */

const DAS_MS = 140; // delay before horizontal auto-repeat
const ARR_MS = 30; // auto-repeat rate once moving

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  life: number;
  maxLife: number;
};

type Phase = "menu" | "playing" | "paused" | "over";

/* ----- Small pieces of UI ----- */

function PiecePreview({
  type,
  theme,
  dimmed = false,
}: {
  type: PieceType | null;
  theme: Theme;
  dimmed?: boolean;
}) {
  const unit = 18;
  return (
    <div
      className={cn("relative h-7.5 w-14 transition-opacity", dimmed && "opacity-35")}
      aria-hidden
    >
      {type &&
        PREVIEW_CELLS[type].cells.map(([x, y], i) => {
          const { w, h } = PREVIEW_CELLS[type];
          const offX = (56 - w * unit) / 2;
          const offY = (30 - h * unit) / 2;
          return (
            <span
              key={i}
              className="absolute rounded-[3px]"
              style={{
                width: unit - 2,
                height: unit - 2,
                left: offX + x * unit,
                top: offY + y * unit,
                backgroundColor: theme.pieces[type],
                boxShadow: "inset 0 1.5px 0 rgba(255,255,255,0.3)",
              }}
            />
          );
        })}
    </div>
  );
}

function Overlay({
  children,
  reduce,
}: {
  children: React.ReactNode;
  reduce: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: reduce ? 1 : 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: reduce ? 1 : 0.98 }}
      transition={{ duration: reduce ? 0.08 : 0.16, ease: "easeOut" }}
      className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-card/90 p-4 backdrop-blur-sm"
    >
      {children}
    </motion.div>
  );
}

/* ----- The app ----- */

export function TetrisApp() {
  const { activeId } = useWindows();
  const reduce = useReducedMotion() ?? false;
  const coarse = useMediaQuery("(pointer: coarse)");

  const [phase, setPhase] = React.useState<Phase>("menu");
  const [hud, setHud] = React.useState({ score: 0, level: 1, lines: 0 });
  const [hold, setHold] = React.useState<PieceType | null>(null);
  const [canHold, setCanHold] = React.useState(true);
  const [nextQ, setNextQ] = React.useState<PieceType[]>([]);
  const [themeId, setThemeId] = React.useState<ThemeId>("electric");
  const [controls, setControls] = React.useState<Record<ActionId, string>>(DEFAULT_CONTROLS);
  const [panel, setPanel] = React.useState<null | "settings" | "scores">(null);
  const [rebind, setRebind] = React.useState<ActionId | null>(null);
  const [scores, setScores] = React.useState<ScoreEntry[]>([]);
  const [lastRank, setLastRank] = React.useState<number | null>(null);
  const [muted, setMuted] = React.useState(false);

  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

  // Load persisted prefs once on mount.
  React.useEffect(() => {
    setScores(loadScores());
    setControls(loadControls());
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    if (savedTheme === "electric" || savedTheme === "sunset") setThemeId(savedTheme);
    setMuted(window.localStorage.getItem(MUTED_KEY) === "1");
  }, []);

  React.useEffect(() => {
    tetrisAudio.muted = muted;
  }, [muted]);

  const toggleMute = React.useCallback(() => {
    setMuted((m) => {
      const next = !m;
      window.localStorage.setItem(MUTED_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  /* Everything the 60fps loop touches lives in refs. */
  const engineRef = React.useRef<TetrisEngine | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const boardWrapRef = React.useRef<HTMLDivElement>(null);
  const cellRef = React.useRef(24);
  const rafRef = React.useRef<number | null>(null);
  const lastTsRef = React.useRef(0);
  const particlesRef = React.useRef<Particle[]>([]);
  const flashesRef = React.useRef<{ y: number; until: number }[]>([]);
  const shakeRef = React.useRef({ mag: 0, until: 0 });
  // Held movement keys with press timestamps, for DAS/ARR repeat.
  const heldRef = React.useRef(new Map<ActionId, { downAt: number; lastRepeat: number }>());
  const dirOrderRef = React.useRef<ActionId[]>([]);

  const phaseRef = React.useRef(phase);
  phaseRef.current = phase;
  const themeRef = React.useRef(theme);
  themeRef.current = theme;
  const controlsRef = React.useRef(controls);
  controlsRef.current = controls;
  const rebindRef = React.useRef(rebind);
  rebindRef.current = rebind;
  const activeRef = React.useRef(activeId);
  activeRef.current = activeId;
  const reduceRef = React.useRef(reduce);
  reduceRef.current = reduce;
  const hudRef = React.useRef({ score: -1, level: -1, lines: -1, hold: "", next: "" });

  const syncHud = React.useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    const prev = hudRef.current;
    const holdKey = `${e.hold ?? ""}:${e.canHold}`;
    const nextKey = e.queue.slice(0, 3).join("");
    if (prev.score !== e.score || prev.level !== e.level || prev.lines !== e.lines) {
      setHud({ score: e.score, level: e.level, lines: e.lines });
    }
    if (prev.hold !== holdKey) {
      setHold(e.hold);
      setCanHold(e.canHold);
    }
    if (prev.next !== nextKey) setNextQ(e.queue.slice(0, 3));
    hudRef.current = {
      score: e.score,
      level: e.level,
      lines: e.lines,
      hold: holdKey,
      next: nextKey,
    };
  }, []);

  /* ----- Canvas drawing ----- */

  const draw = React.useCallback((now: number) => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const cell = cellRef.current;
    const t = themeRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = COLS * cell;
    const h = ROWS * cell;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();

    const shake = shakeRef.current;
    if (now < shake.until && !reduceRef.current) {
      const falloff = (shake.until - now) / 220;
      ctx.translate(
        (Math.random() - 0.5) * 2 * shake.mag * falloff,
        (Math.random() - 0.5) * 2 * shake.mag * falloff
      );
    }

    // Board backdrop + grid
    ctx.fillStyle = t.board;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = t.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) {
      ctx.moveTo(x * cell + 0.5, 0);
      ctx.lineTo(x * cell + 0.5, h);
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.moveTo(0, y * cell + 0.5);
      ctx.lineTo(w, y * cell + 0.5);
    }
    ctx.stroke();

    const drawCell = (bx: number, by: number, color: string) => {
      if (by < HIDDEN) return;
      const px = bx * cell;
      const py = (by - HIDDEN) * cell;
      const r = Math.max(2, cell * 0.16);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(px + 1, py + 1, cell - 2, cell - 2, r);
      ctx.fill();
      // glossy top edge + shaded base give the blocks depth
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.beginPath();
      ctx.roundRect(px + 2, py + 2, cell - 4, (cell - 4) * 0.38, r * 0.8);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(px + 2, py + cell - 4, cell - 4, 2.5);
    };

    if (engine) {
      for (let y = HIDDEN; y < TOTAL_ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const type = engine.board[y][x];
          if (type) drawCell(x, y, t.pieces[type]);
        }
      }

      if (engine.active && !engine.over) {
        const a = engine.active;
        // Ghost outline at the landing position
        const gy = engine.ghostY();
        if (gy > a.y) {
          ctx.strokeStyle = t.ghost;
          ctx.lineWidth = 2;
          for (const { x, y } of engine.activeCells()) {
            const by = y + (gy - a.y);
            if (by < HIDDEN) continue;
            ctx.beginPath();
            ctx.roundRect(
              x * cell + 2,
              (by - HIDDEN) * cell + 2,
              cell - 4,
              cell - 4,
              Math.max(2, cell * 0.14)
            );
            ctx.stroke();
          }
        }
        if (t.glow) {
          ctx.shadowColor = t.pieces[a.type];
          ctx.shadowBlur = cell * 0.55;
        }
        for (const { x, y } of engine.activeCells()) drawCell(x, y, t.pieces[a.type]);
        ctx.shadowBlur = 0;
      }
    }

    // Row-clear flashes
    for (const flash of flashesRef.current) {
      const alpha = Math.max(0, (flash.until - now) / 150);
      if (alpha <= 0) continue;
      ctx.fillStyle = t.flash;
      ctx.globalAlpha = alpha;
      ctx.fillRect(0, (flash.y - HIDDEN) * cell, w, cell);
      ctx.globalAlpha = 1;
    }

    // Particles
    for (const p of particlesRef.current) {
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size * alpha, p.size * alpha);
      ctx.restore();
    }

    ctx.restore();
  }, []);

  /* ----- Effects from engine events ----- */

  const finishGame = React.useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    let rank: number | null = null;
    if (e.score > 0) {
      const entry: ScoreEntry = {
        score: e.score,
        lines: e.lines,
        level: e.level,
        at: Date.now(),
      };
      const next = [...loadScores(), entry]
        .sort((a, b) => b.score - a.score || a.at - b.at)
        .slice(0, 10);
      const index = next.indexOf(entry);
      rank = index === -1 ? null : index + 1;
      window.localStorage.setItem(SCORES_KEY, JSON.stringify(next));
      setScores(next);
    }
    setLastRank(rank);
    setPhase("over");
  }, []);

  const reactToEvents = React.useCallback(
    (events: TetrisEvent[]) => {
      const now = performance.now();
      const cell = cellRef.current;
      for (const ev of events) {
        if (ev.kind === "clear") {
          tetrisAudio.play(`clear${Math.min(ev.count, 4)}` as SoundName);
          for (const row of ev.rows) flashesRef.current.push({ y: row, until: now + 150 });
          if (!reduceRef.current) {
            for (const c of ev.cells) {
              const count = ev.count >= 4 ? 3 : 2;
              for (let i = 0; i < count; i++) {
                particlesRef.current.push({
                  x: (c.x + 0.5) * cell,
                  y: (c.y - HIDDEN + 0.5) * cell,
                  vx: (Math.random() - 0.5) * 300,
                  vy: -40 - Math.random() * 260,
                  size: cell * (0.22 + Math.random() * 0.16),
                  rot: Math.random() * Math.PI,
                  vr: (Math.random() - 0.5) * 10,
                  color: themeRef.current.pieces[c.type],
                  life: 450 + Math.random() * 300,
                  maxLife: 750,
                });
              }
            }
            shakeRef.current = {
              mag: ev.count >= 4 ? 5 : 2.5,
              until: now + (ev.count >= 4 ? 220 : 140),
            };
          }
        } else if (ev.kind === "hardDrop") {
          tetrisAudio.play("hardDrop");
          if (!reduceRef.current && ev.distance > 2) {
            shakeRef.current = { mag: 1.8, until: now + 90 };
          }
        } else if (ev.kind === "levelUp") {
          tetrisAudio.play("levelUp");
        } else if (ev.kind === "gameOver") {
          tetrisAudio.play("gameOver");
          finishGame();
        }
      }
    },
    [finishGame]
  );

  /* ----- Game loop ----- */

  const stopLoop = React.useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const ensureLoop = React.useCallback(() => {
    if (rafRef.current !== null) return;
    lastTsRef.current = performance.now();

    const step = (ts: number) => {
      const dt = Math.min(ts - lastTsRef.current, 100);
      lastTsRef.current = ts;
      const engine = engineRef.current;

      if (phaseRef.current === "playing" && engine && !engine.over) {
        // DAS/ARR horizontal repeat; the most recent held direction wins.
        const dir = dirOrderRef.current[dirOrderRef.current.length - 1];
        if (dir) {
          const held = heldRef.current.get(dir);
          if (held && ts - held.downAt >= DAS_MS && ts - held.lastRepeat >= ARR_MS) {
            if (engine.move(dir === "moveLeft" ? -1 : 1)) tetrisAudio.play("move");
            held.lastRepeat = ts;
          }
        }
        engine.tick(dt, heldRef.current.has("softDrop"));
        reactToEvents(engine.drainEvents());
        syncHud();
      }

      // Advance particles
      const particles = particlesRef.current;
      if (particles.length > 0) {
        const s = dt / 1000;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.life -= dt;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          p.vy += 640 * s;
          p.x += p.vx * s;
          p.y += p.vy * s;
          p.rot += p.vr * s;
        }
      }
      flashesRef.current = flashesRef.current.filter((f) => f.until > ts);

      draw(ts);

      const busy =
        phaseRef.current === "playing" ||
        particles.length > 0 ||
        flashesRef.current.length > 0 ||
        ts < shakeRef.current.until;
      if (busy) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(step);
  }, [draw, reactToEvents, syncHud]);

  React.useEffect(() => stopLoop, [stopLoop]);

  /* ----- Phase control ----- */

  const startGame = React.useCallback(() => {
    engineRef.current = new TetrisEngine();
    particlesRef.current = [];
    flashesRef.current = [];
    shakeRef.current = { mag: 0, until: 0 };
    heldRef.current.clear();
    dirOrderRef.current = [];
    hudRef.current = { score: -1, level: -1, lines: -1, hold: "", next: "" };
    setLastRank(null);
    setPanel(null);
    setPhase("playing");
    syncHud();
    ensureLoop();
  }, [ensureLoop, syncHud]);

  const pauseGame = React.useCallback(() => {
    setPhase((p) => (p === "playing" ? "paused" : p));
  }, []);

  const resumeGame = React.useCallback(() => {
    heldRef.current.clear();
    dirOrderRef.current = [];
    setPanel(null);
    setPhase("playing");
    ensureLoop();
  }, [ensureLoop]);

  // Losing window focus (another window, minimize, tab hidden) pauses.
  React.useEffect(() => {
    if (phase === "playing" && activeId !== "tetris") pauseGame();
  }, [activeId, phase, pauseGame]);

  React.useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") pauseGame();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [pauseGame]);

  /* ----- Input ----- */

  const performAction = React.useCallback(
    (action: ActionId) => {
      const engine = engineRef.current;
      if (!engine || phaseRef.current !== "playing" || engine.over) return;
      const now = performance.now();
      switch (action) {
        case "moveLeft":
        case "moveRight":
          if (engine.move(action === "moveLeft" ? -1 : 1)) tetrisAudio.play("move");
          heldRef.current.set(action, { downAt: now, lastRepeat: now });
          dirOrderRef.current = [
            ...dirOrderRef.current.filter((a) => a !== action),
            action,
          ];
          break;
        case "rotateCW":
          if (engine.rotate(1)) tetrisAudio.play("rotate");
          break;
        case "rotateCCW":
          if (engine.rotate(-1)) tetrisAudio.play("rotate");
          break;
        case "softDrop":
          heldRef.current.set(action, { downAt: now, lastRepeat: now });
          tetrisAudio.play("move");
          engine.tick(30, true); // instant first row, no waiting on the loop
          break;
        case "hardDrop":
          engine.hardDrop(); // hardDrop sound rides on the engine event
          break;
        case "hold":
          if (engine.holdPiece()) tetrisAudio.play("hold");
          break;
        case "pause":
          pauseGame();
          return;
      }
      reactToEvents(engine.drainEvents());
      syncHud();
    },
    [pauseGame, reactToEvents, syncHud]
  );

  const releaseAction = React.useCallback((action: ActionId) => {
    heldRef.current.delete(action);
    if (action === "moveLeft" || action === "moveRight") {
      dirOrderRef.current = dirOrderRef.current.filter((a) => a !== action);
    }
  }, []);

  React.useEffect(() => {
    const codeToAction = (code: string): ActionId | null => {
      const map = controlsRef.current;
      for (const action of Object.keys(map) as ActionId[]) {
        if (map[action] === code) return action;
      }
      return null;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (activeRef.current !== "tetris") return;

      // Key-capture mode for remapping
      if (rebindRef.current) {
        e.preventDefault();
        e.stopPropagation();
        const action = rebindRef.current;
        if (e.code !== "Escape") {
          setControls((prev) => {
            const next = { ...prev };
            // Swap with whichever action already used this key
            for (const other of Object.keys(next) as ActionId[]) {
              if (next[other] === e.code) next[other] = prev[action];
            }
            next[action] = e.code;
            window.localStorage.setItem(CONTROLS_KEY, JSON.stringify(next));
            return next;
          });
        }
        setRebind(null);
        return;
      }

      const action = codeToAction(e.code);
      const p = phaseRef.current;

      if (p === "playing") {
        if (!action) return;
        e.preventDefault();
        if (e.repeat) return; // repeats are handled by our own DAS/ARR
        performAction(action);
      } else if (p === "paused") {
        if (action === "pause") {
          e.preventDefault();
          resumeGame();
        }
      } else if (
        // Menu: Enter or Space starts. Game over: Enter only, so hard-drop
        // mashing can't skip the score screen. Skip when a button has focus
        // so keyboard navigation of the overlay still works.
        (e.code === "Enter" || (e.code === "Space" && p === "menu")) &&
        !(e.target as HTMLElement | null)?.closest?.("button, input, a")
      ) {
        e.preventDefault();
        startGame();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (activeRef.current !== "tetris") return;
      const action = codeToAction(e.code);
      if (action) {
        if (phaseRef.current === "playing") e.preventDefault();
        releaseAction(action);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [performAction, releaseAction, resumeGame, startGame]);

  /* ----- Board sizing ----- */

  React.useEffect(() => {
    const wrap = boardWrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const fit = () => {
      // Layout size (transform-independent): the window animates its scale
      // while opening, and previews render the app scaled down.
      const availW = wrap.clientWidth - 4;
      const availH = wrap.clientHeight - 4;
      if (availW <= 0 || availH <= 0) return;
      const cell = Math.max(10, Math.floor(Math.min(availW / COLS, availH / ROWS)));
      cellRef.current = cell;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = COLS * cell * dpr;
      canvas.height = ROWS * cell * dpr;
      canvas.style.width = `${COLS * cell}px`;
      canvas.style.height = `${ROWS * cell}px`;
      draw(performance.now());
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [draw]);

  // Repaint the static board when the theme changes or play stops.
  React.useEffect(() => {
    if (rafRef.current === null) draw(performance.now());
  }, [themeId, phase, draw]);

  const setThemePersist = (id: ThemeId) => {
    setThemeId(id);
    window.localStorage.setItem(THEME_KEY, id);
  };

  const openPanel = (which: "settings" | "scores") => {
    pauseGame();
    setRebind(null);
    setPanel(which);
  };

  /* ----- Touch controls (coarse pointers only) ----- */

  const touchRepeats = React.useRef(new Map<ActionId, number>());

  const stopTouchRepeat = (action: ActionId) => {
    const id = touchRepeats.current.get(action);
    if (id !== undefined) {
      window.clearInterval(id);
      touchRepeats.current.delete(action);
    }
  };

  const touchButton = (
    action: ActionId,
    icon: React.ReactNode,
    label: string,
    repeat = false
  ) => {
    const end = () => {
      releaseAction(action);
      stopTouchRepeat(action);
    };
    return (
      <button
        key={action}
        aria-label={label}
        className="flex h-14 flex-1 items-center justify-center rounded-xl border border-border bg-muted/40 text-foreground active:bg-muted"
        onPointerDown={(e) => {
          e.preventDefault();
          performAction(action);
          if (repeat) {
            stopTouchRepeat(action);
            touchRepeats.current.set(
              action,
              window.setInterval(() => performAction(action), 110)
            );
          }
        }}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        onContextMenu={(e) => e.preventDefault()}
      >
        {icon}
      </button>
    );
  };

  const keyHint = (action: ActionId) => prettyKey(controls[action]);

  const wordmarkColors: PieceType[] = ["T", "S", "I", "Z", "J", "L"];

  return (
    <div className="relative flex h-full select-none flex-col @container">
      {/* Compact HUD: replaces the side panels in narrow windows. */}
      <div className="flex items-center gap-2 border-b border-border px-2 py-1.5 @min-[600px]:hidden">
        <div
          className="rounded-lg border border-border bg-muted/30 px-1"
          aria-label="Held piece"
        >
          <PiecePreview type={hold} theme={theme} dimmed={!canHold} />
        </div>
        <div className="flex items-center" aria-label="Next pieces">
          {(nextQ.length ? nextQ.slice(0, 2) : [null, null]).map((type, i) => (
            <PiecePreview key={i} type={type} theme={theme} dimmed={i > 0} />
          ))}
        </div>
        <div className="ml-auto text-right font-mono">
          <p className="text-sm font-semibold leading-tight tabular-nums">
            {hud.score.toLocaleString()}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Lv {hud.level} · Ln {hud.lines}
          </p>
        </div>
        <div className="flex gap-0.5">
          {phase === "playing" && (
            <Button variant="ghost" size="sm" aria-label="Pause" onClick={pauseGame}>
              <Pause />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            aria-label="Tetris options"
            onClick={() => openPanel("settings")}
          >
            <Settings2 />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4 p-2 @min-[600px]:p-4">
        {/* Side panel */}
        <aside className="hidden w-40 shrink-0 flex-col gap-3 text-center @min-[600px]:flex">
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="mb-2 flex items-baseline justify-between text-sm font-medium text-muted-foreground">
              Hold
              <kbd className="font-mono text-[10px] opacity-70">{keyHint("hold")}</kbd>
            </p>
            <PiecePreview type={hold} theme={theme} dimmed={!canHold} />
          </div>
          <div className="mt-auto rounded-xl border border-border bg-muted/30 p-3 font-mono">
            <p className="text-sm text-muted-foreground">Score</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight m-3 mb-4">
              {hud.score.toLocaleString()}
            </p>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>
                Level <span className="text-foreground mr-3">{hud.level}</span>
              </span>
              <span>
                Lines <span className="text-foreground">{hud.lines}</span>
              </span>
            </div>
          </div>
        </aside>

        {/* Board */}
        <div
          ref={boardWrapRef}
          className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center"
        >
          <canvas
            ref={canvasRef}
            className="rounded-lg border border-border/70"
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>

        {/* Side panel */}
        <aside className="hidden w-40 shrink-0 flex-col gap-3 mr-6 @min-[600px]:flex">

          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="mb-2 text-sm font-medium text-muted-foreground text-center">Next</p>
            <div className="space-y-4 pl-10 mt-3">
              {(nextQ.length ? nextQ : [null, null, null]).map((type, i) => (
                <PiecePreview key={i} type={type} theme={theme} dimmed={i > 0} />
              ))}
            </div>
          </div>

          <div className="mt-auto space-y-1.5">
            {phase === "playing" && (
              <Button variant="outline" size="sm" className="w-full" onClick={pauseGame}>
                <Pause /> Pause
              </Button>
            )}
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                aria-label="Tetris options"
                onClick={() => openPanel("settings")}
              >
                <Settings2 />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                aria-label="Tetris leaderboard"
                onClick={() => openPanel("scores")}
              >
                <Trophy />
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {/* Touch controls: movement cluster left, action cluster right. */}
      {coarse && (
        <div className="flex items-center gap-4 border-t border-border px-3 py-2 pb-3">
          <div className="flex flex-1 gap-1.5">
            {touchButton("moveLeft", <ArrowLeft className="size-6" />, "Move left", true)}
            {touchButton("softDrop", <ArrowDown className="size-6" />, "Soft drop", true)}
            {touchButton("moveRight", <ArrowRight className="size-6" />, "Move right", true)}
          </div>
          <div className="flex flex-1 gap-1.5">
            {touchButton("hold", <Repeat2 className="size-6" />, "Hold piece")}
            {touchButton("hardDrop", <ArrowDownToLine className="size-6" />, "Hard drop")}
            {touchButton("rotateCW", <RotateCw className="size-6" />, "Rotate")}
          </div>
        </div>
      )}

      {/* Overlays */}
      <AnimatePresence>
        {phase === "menu" && !panel && (
          <Overlay key="menu" reduce={reduce}>
            <div className="text-center">
              <h2 className="text-4xl font-black tracking-[0.3em]">
                {"TETRIS".split("").map((ch, i) => (
                  <span key={i} style={{ color: theme.pieces[wordmarkColors[i]] }}>
                    {ch}
                  </span>
                ))}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Lines will not clear themselves.
              </p>
              {scores[0] && (
                <p className="mt-4 font-mono text-sm text-muted-foreground">
                  Best <span className="text-accent">{scores[0].score.toLocaleString()}</span>
                </p>
              )}
              <div className="mt-6 flex flex-col items-center gap-2">
                <Button onClick={startGame} data-testid="tetris-play">
                  <Play /> Play
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setPanel("settings")}>
                    Options
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPanel("scores")}>
                    Scores
                  </Button>
                </div>
              </div>
              {!coarse && (
                <p className="mt-6 font-mono text-xs text-muted-foreground">
                  {keyHint("moveLeft")} {keyHint("moveRight")} move · {keyHint("rotateCW")}{" "}
                  rotate · {keyHint("hardDrop")} drop · {keyHint("hold")} hold
                </p>
              )}
            </div>
          </Overlay>
        )}

        {phase === "paused" && !panel && (
          <Overlay key="paused" reduce={reduce}>
            <div className="text-center">
              <h2 className="text-2xl font-semibold tracking-tight">Paused</h2>
              <div className="mt-5 flex flex-col items-center gap-2">
                <Button onClick={resumeGame}>
                  <Play /> Resume
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={startGame}>
                    Restart
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPanel("settings")}>
                    Options
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPhase("menu")}>
                    Quit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleMute}
                    aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
                  >
                    {muted ? <VolumeX /> : <Volume2 />}
                  </Button>
                </div>
              </div>
            </div>
          </Overlay>
        )}

        {phase === "over" && !panel && (
          <Overlay key="over" reduce={reduce}>
            <div className="text-center" data-testid="tetris-gameover">
              <h2 className="text-2xl font-semibold tracking-tight">Game over</h2>
              {lastRank !== null && (
                <p className="mt-1 text-sm text-accent">Leaderboard rank #{lastRank}</p>
              )}
              <dl className="mx-auto mt-5 grid w-56 grid-cols-3 gap-2 font-mono">
                {(
                  [
                    ["Score", hud.score.toLocaleString()],
                    ["Level", hud.level],
                    ["Lines", hud.lines],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border bg-muted/30 p-2">
                    <dt className="text-[10px] text-muted-foreground">{label}</dt>
                    <dd className="text-sm font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 flex flex-col items-center gap-2">
                <Button onClick={startGame} data-testid="tetris-again">
                  <Play /> Play again
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setPanel("scores")}>
                    Scores
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPhase("menu")}>
                    Menu
                  </Button>
                </div>
              </div>
            </div>
          </Overlay>
        )}

        {panel === "settings" && (
          <Overlay key="settings" reduce={reduce}>
            <div className="my-auto w-full max-w-sm py-2">
              <h2 className="text-lg font-semibold tracking-tight">Options</h2>

              <p className="mb-2 mt-4 text-xs font-medium text-muted-foreground">Theme</p>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setThemePersist(t.id)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      themeId === t.id
                        ? "border-accent bg-accent/10"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.tagline}</p>
                    <div className="mt-2 flex gap-1">
                      {Object.values(t.pieces).map((color, i) => (
                        <span
                          key={i}
                          className="size-3 rounded-[3px]"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </button>
                ))}
              </div>

              <p className="mb-2 mt-5 text-xs font-medium text-muted-foreground">Sound</p>
              <button
                onClick={toggleMute}
                aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
                className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
              >
                <span>Sound effects</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {muted ? "Muted" : "On"}
                  {muted ? (
                    <VolumeX className="size-4" />
                  ) : (
                    <Volume2 className="size-4 text-accent" />
                  )}
                </span>
              </button>

              <p className="mb-2 mt-5 text-xs font-medium text-muted-foreground">Controls</p>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {ACTION_LABELS.map(({ id, label }) => (
                  <li key={id} className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-sm">{label}</span>
                    <button
                      onClick={() => setRebind(rebind === id ? null : id)}
                      className={cn(
                        "min-w-16 rounded-lg border px-2 py-1 font-mono text-xs transition-colors",
                        rebind === id
                          ? "animate-pulse border-accent text-accent"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {rebind === id ? "Press key" : prettyKey(controls[id])}
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setControls({ ...DEFAULT_CONTROLS });
                    window.localStorage.removeItem(CONTROLS_KEY);
                    setRebind(null);
                  }}
                >
                  Reset defaults
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setRebind(null);
                    setPanel(null);
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          </Overlay>
        )}

        {panel === "scores" && (
          <Overlay key="scores" reduce={reduce}>
            <div className="my-auto w-full max-w-sm py-2">
              <h2 className="text-lg font-semibold tracking-tight">High scores</h2>
              {scores.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Nothing yet. The board is waiting.
                </p>
              ) : (
                <ol className="mt-3 divide-y divide-border rounded-xl border border-border font-mono text-sm">
                  {scores.map((entry, i) => (
                    <li key={entry.at} className="flex items-center gap-3 px-3 py-1.5">
                      <span className="w-5 text-right text-xs text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="flex-1 font-semibold tabular-nums">
                        {entry.score.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        L{entry.level} · {entry.lines} lines
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {dateFmt.format(entry.at)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="mt-4 flex justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={scores.length === 0}
                  onClick={() => {
                    window.localStorage.removeItem(SCORES_KEY);
                    setScores([]);
                  }}
                >
                  Clear
                </Button>
                <Button size="sm" onClick={() => setPanel(null)}>
                  Done
                </Button>
              </div>
            </div>
          </Overlay>
        )}
      </AnimatePresence>
    </div>
  );
}
