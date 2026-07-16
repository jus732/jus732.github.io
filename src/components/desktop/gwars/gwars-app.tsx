"use client";

/**
 * G-Wars React shell: a full-window canvas driven by a rAF loop, with the
 * engine and every per-frame value in refs. React only re-renders on
 * discrete beats - wave clear, pause, death - via the menu overlays; the
 * in-run HUD is drawn on canvas by the renderer.
 */

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Lock, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useWindows } from "@/components/desktop/window-manager";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import {
  GwarsEngine,
  UPGRADES,
  type GwarsEvent,
  type InputState,
} from "@/components/desktop/gwars/engine";
import {
  COMBOS,
  RARITY,
  UNIQUES,
  type Rarity,
  type UpgradeOffer,
} from "@/components/desktop/gwars/rarity";
import { WarpGrid } from "@/components/desktop/gwars/grid";
import {
  render,
  renderBackdrop,
  type RenderFrame,
} from "@/components/desktop/gwars/renderer";
import { gwarsAudio } from "@/components/desktop/gwars/audio";
import {
  META_UPGRADES,
  buildRunConfig,
  defaultMeta,
  loadMeta,
  resetMeta,
  saveMeta,
  type MetaState,
  type MetaUpgradeId,
} from "@/components/desktop/gwars/meta";
import { SHIPS, SHIP_ORDER, type ShipId } from "@/components/desktop/gwars/weapons";

type Phase = "title" | "playing" | "reward" | "paused" | "over";

type RunSummary = {
  score: number;
  wave: number;
  kills: number;
  cores: number;
  newBestScore: boolean;
  newBestWave: boolean;
};

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1],
  KeyS: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
};

const AIM_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

const EASY_LIVES_OPTIONS = [3, 5, 0] as const; // 0 renders as ∞

const RARITY_RANK: Record<Rarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
  combo: 4,
};

/** The loudest sting a deal deserves: its highest-tier card. */
function bestRarity(offers: UpgradeOffer[]): Rarity {
  let best: Rarity = "common";
  for (const o of offers) {
    if (RARITY_RANK[o.rarity] > RARITY_RANK[best]) best = o.rarity;
  }
  return best;
}

/** Name/description shared by all three card kinds. */
function offerInfo(offer: UpgradeOffer): { name: string; desc: string } {
  if (offer.kind === "stackable") return UPGRADES[offer.id];
  if (offer.kind === "unique") return UNIQUES[offer.id];
  return COMBOS[offer.id];
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

export function GwarsApp() {
  const { activeId } = useWindows();
  const reduce = useReducedMotion() ?? false;
  const coarse = useMediaQuery("(pointer: coarse)");

  const [phase, setPhase] = React.useState<Phase>("title");
  const [panel, setPanel] = React.useState<null | "shop">(null);
  const [meta, setMeta] = React.useState<MetaState>(defaultMeta);
  const [choices, setChoices] = React.useState<UpgradeOffer[]>([]);
  const [clearedWave, setClearedWave] = React.useState(0);
  const [rerolls, setRerolls] = React.useState(0);
  /** Bumped per deal (wave clear or reroll) to replay the reveal. */
  const [dealId, setDealId] = React.useState(0);
  const [pickFlash, setPickFlash] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<RunSummary | null>(null);
  const [confirmReset, setConfirmReset] = React.useState(false);

  /* Everything the 60fps loop touches lives in refs. */
  const engineRef = React.useRef<GwarsEngine | null>(null);
  const gridRef = React.useRef<WarpGrid | null>(null);
  if (!gridRef.current) gridRef.current = new WarpGrid();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const rafRef = React.useRef<number | null>(null);
  const lastTsRef = React.useRef(0);
  const keysRef = React.useRef(new Set<string>());
  const inputRef = React.useRef<InputState>({
    move: { x: 0, y: 0 },
    aim: { x: 0, y: 0 },
    firing: false,
  });
  const sizeRef = React.useRef({ w: 900, h: 640, dpr: 1 });
  const frameRef = React.useRef<RenderFrame>({ w: 900, h: 640, now: 0, shakeX: 0, shakeY: 0 });
  const shakeRef = React.useRef({ mag: 0, until: 0 });
  /** Keep animating this long after the last effect, then idle. */
  const tailRef = React.useRef(0);
  const pickupSoundAtRef = React.useRef(0);

  const phaseRef = React.useRef(phase);
  phaseRef.current = phase;
  const panelRef = React.useRef(panel);
  panelRef.current = panel;
  const choicesRef = React.useRef(choices);
  choicesRef.current = choices;
  const metaRef = React.useRef(meta);
  metaRef.current = meta;
  const activeRef = React.useRef(activeId);
  activeRef.current = activeId;
  const reduceRef = React.useRef(reduce);
  reduceRef.current = reduce;

  // Load persisted meta once on mount.
  React.useEffect(() => {
    setMeta(loadMeta());
  }, []);

  React.useEffect(() => {
    gwarsAudio.muted = meta.muted;
  }, [meta.muted]);

  const updateMeta = React.useCallback((fn: (m: MetaState) => MetaState) => {
    setMeta((prev) => {
      const next = fn(prev);
      saveMeta(next);
      return next;
    });
  }, []);

  const toggleMute = React.useCallback(() => {
    updateMeta((m) => ({ ...m, muted: !m.muted }));
  }, [updateMeta]);

  /* ----- Canvas drawing ----- */

  const draw = React.useCallback((now: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const grid = gridRef.current;
    if (!canvas || !ctx || !grid) return;
    const { w, h, dpr } = sizeRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const frame = frameRef.current;
    frame.w = w;
    frame.h = h;
    frame.now = now;
    const shake = shakeRef.current;
    if (now < shake.until && !reduceRef.current) {
      const falloff = (shake.until - now) / 300;
      frame.shakeX = (Math.random() - 0.5) * 2 * shake.mag * falloff;
      frame.shakeY = (Math.random() - 0.5) * 2 * shake.mag * falloff;
    } else {
      frame.shakeX = 0;
      frame.shakeY = 0;
    }

    const engine = engineRef.current;
    if (engine) render(ctx, engine, grid, frame);
    else renderBackdrop(ctx, grid, frame);
  }, []);

  /* ----- Effects from engine events ----- */

  const finishRun = React.useCallback(
    (ev: Extract<GwarsEvent, { kind: "gameOver" }>) => {
      const prev = metaRef.current;
      setSummary({
        score: ev.score,
        wave: ev.wave,
        kills: ev.kills,
        cores: ev.cores,
        newBestScore: ev.score > prev.best.score && ev.score > 0,
        newBestWave: ev.wave > prev.best.wave,
      });
      updateMeta((m) => ({
        ...m,
        cores: m.cores + ev.cores,
        totalKills: m.totalKills + ev.kills,
        totalRuns: m.totalRuns + 1,
        best: {
          score: Math.max(m.best.score, ev.score),
          wave: Math.max(m.best.wave, ev.wave),
          kills: Math.max(m.best.kills, ev.kills),
        },
      }));
      gwarsAudio.play("gameOver");
      setPhase("over");
    },
    [updateMeta]
  );

  const reactToEvents = React.useCallback(
    (events: GwarsEvent[], now: number) => {
      const grid = gridRef.current!;
      for (const ev of events) {
        switch (ev.kind) {
          case "fire":
            gwarsAudio.play("fire");
            break;
          case "enemySpawn":
            gwarsAudio.play("enemySpawn");
            grid.pulse(ev.x, ev.y, 70, 90);
            break;
          case "enemyKill":
            gwarsAudio.play("enemyKill");
            grid.pulse(ev.x, ev.y, 90 + ev.radius * 3, 240);
            if (ev.type === "boss" && !reduceRef.current) {
              shakeRef.current = { mag: 7, until: now + 320 };
            }
            break;
          case "geomPickup":
            // Pickups arrive in bursts; keep the (future) sound sane.
            if (now - pickupSoundAtRef.current > 70) {
              pickupSoundAtRef.current = now;
              gwarsAudio.play("geomPickup");
            }
            break;
          case "multiplierUp":
            gwarsAudio.play("uiSelect");
            break;
          case "playerHit":
            gwarsAudio.play(ev.fatal ? "playerDeath" : "playerHit");
            grid.pulse(ev.x, ev.y, 220, 520);
            if (!reduceRef.current) {
              shakeRef.current = {
                mag: ev.shielded ? 4 : 9,
                until: now + (ev.shielded ? 160 : 300),
              };
            }
            break;
          case "waveClear":
            gwarsAudio.play("waveClear");
            gwarsAudio.play(RARITY[bestRarity(ev.choices)].sound);
            setClearedWave(ev.wave);
            setChoices(ev.choices);
            setRerolls(engineRef.current?.rerolls ?? 0);
            setDealId((d) => d + 1);
            setPhase("reward");
            break;
          case "bomb":
            gwarsAudio.play("bomb");
            grid.pulse(ev.x, ev.y, 480, 900);
            if (!reduceRef.current) shakeRef.current = { mag: 6, until: now + 260 };
            break;
          case "gameOver":
            finishRun(ev);
            break;
        }
        tailRef.current = now + 1600;
      }
    },
    [finishRun]
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
      const grid = gridRef.current!;
      const p = phaseRef.current;

      if (engine && (p === "playing" || p === "reward" || p === "over")) {
        if (p === "playing") {
          // Fold held keys into the abstract InputState (mutated in place).
          const keys = keysRef.current;
          const input = inputRef.current;
          let mx = 0;
          let my = 0;
          for (const code in MOVE_KEYS) {
            if (keys.has(code)) {
              mx += MOVE_KEYS[code][0];
              my += MOVE_KEYS[code][1];
            }
          }
          let ax = 0;
          let ay = 0;
          for (const code in AIM_KEYS) {
            if (keys.has(code)) {
              ax += AIM_KEYS[code][0];
              ay += AIM_KEYS[code][1];
            }
          }
          if (mx !== 0 && my !== 0) {
            mx *= Math.SQRT1_2;
            my *= Math.SQRT1_2;
          }
          if (ax !== 0 && ay !== 0) {
            ax *= Math.SQRT1_2;
            ay *= Math.SQRT1_2;
          }
          input.move.x = mx;
          input.move.y = my;
          input.aim.x = ax;
          input.aim.y = ay;
          input.firing = ax !== 0 || ay !== 0;
          engine.setInput(input);

          // The player drags a subtle well through the grid.
          grid.pulse(engine.player.x, engine.player.y, 90, -160 * (dt / 1000));
        }
        engine.tick(dt); // outside combat this only settles particles
        reactToEvents(engine.drainEvents(), ts);
      }

      grid.update(dt / 1000);
      draw(ts);

      const busy = phaseRef.current === "playing" || ts < tailRef.current;
      if (busy) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(step);
  }, [draw, reactToEvents]);

  React.useEffect(() => stopLoop, [stopLoop]);

  /* ----- Phase control ----- */

  const startRun = React.useCallback(() => {
    const { w, h } = sizeRef.current;
    engineRef.current = new GwarsEngine(w, h, buildRunConfig(metaRef.current));
    keysRef.current.clear();
    shakeRef.current = { mag: 0, until: 0 };
    setChoices([]);
    setSummary(null);
    setPanel(null);
    setPhase("playing");
    gwarsAudio.play("uiSelect");
    ensureLoop();
  }, [ensureLoop]);

  const pauseGame = React.useCallback(() => {
    keysRef.current.clear();
    setPhase((p) => (p === "playing" ? "paused" : p));
  }, []);

  const resumeGame = React.useCallback(() => {
    keysRef.current.clear();
    setPanel(null);
    setPhase("playing");
    ensureLoop();
  }, [ensureLoop]);

  const quitToTitle = React.useCallback(() => {
    engineRef.current = null;
    setChoices([]);
    setPanel(null);
    setPhase("title");
  }, []);

  const pickUpgrade = React.useCallback(
    (offer: UpgradeOffer | undefined) => {
      const engine = engineRef.current;
      if (!engine || !offer) return;
      gwarsAudio.play("upgradePick");
      // Rarity-colored send-off: particle burst at the ship + a flash.
      engine.spawnBurst(
        engine.player.x,
        engine.player.y,
        RARITY[offer.rarity].color,
        36,
        360,
        0.8
      );
      if (!reduceRef.current) setPickFlash(RARITY[offer.rarity].color);
      engine.chooseUpgrade(offer);
      setChoices([]);
      setPhase("playing");
      ensureLoop();
    },
    [ensureLoop]
  );

  const rerollCards = React.useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !engine.rerollOffers()) return;
    gwarsAudio.play("reroll");
    gwarsAudio.play(RARITY[bestRarity(engine.pendingChoices)].sound);
    setChoices(engine.pendingChoices);
    setRerolls(engine.rerolls);
    setDealId((d) => d + 1);
  }, []);

  // Losing window focus (another window, minimize, tab hidden) pauses.
  React.useEffect(() => {
    if (phase === "playing" && activeId !== "gwars") pauseGame();
  }, [activeId, phase, pauseGame]);

  React.useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") pauseGame();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [pauseGame]);

  /* ----- Input ----- */

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activeRef.current !== "gwars") return;
      const p = phaseRef.current;

      if (p === "playing") {
        if (e.code === "Escape" || e.code === "KeyP") {
          e.preventDefault();
          pauseGame();
          return;
        }
        if (e.code === "Space") {
          e.preventDefault();
          if (!e.repeat) engineRef.current?.requestBomb();
          return;
        }
        if (e.code in MOVE_KEYS || e.code in AIM_KEYS) {
          e.preventDefault();
          keysRef.current.add(e.code);
        }
      } else if (p === "paused") {
        if (e.code === "Escape" || e.code === "KeyP" || e.code === "Enter") {
          e.preventDefault();
          if (!panelRef.current) resumeGame();
        }
      } else if (p === "reward") {
        const digit = ["Digit1", "Digit2", "Digit3", "Numpad1", "Numpad2", "Numpad3"].indexOf(
          e.code
        );
        if (digit >= 0) {
          e.preventDefault();
          pickUpgrade(choicesRef.current[digit % 3]);
        } else if (e.code === "KeyR") {
          e.preventDefault();
          if (!e.repeat) rerollCards();
        }
      } else if (
        (p === "title" || p === "over") &&
        e.code === "Enter" &&
        !panelRef.current &&
        !(e.target as HTMLElement | null)?.closest?.("button, input, a")
      ) {
        e.preventDefault();
        startRun();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (activeRef.current !== "gwars") return;
      if (e.code in MOVE_KEYS || e.code in AIM_KEYS) {
        if (phaseRef.current === "playing") e.preventDefault();
        keysRef.current.delete(e.code);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [pauseGame, pickUpgrade, rerollCards, resumeGame, startRun]);

  /* ----- Canvas sizing (world adapts to the window) ----- */

  React.useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const fit = () => {
      // Layout size (transform-independent): the window animates its
      // scale while opening, and previews render the app scaled down.
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w <= 0 || h <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      gridRef.current!.resize(w, h);
      engineRef.current?.setBounds(w, h);
      draw(performance.now());
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [draw]);

  // Repaint the static frame when play stops on an overlay.
  React.useEffect(() => {
    if (rafRef.current === null) draw(performance.now());
  }, [phase, draw]);

  /* ----- Shop actions ----- */

  const buyUpgrade = (id: MetaUpgradeId) => {
    const level = meta.upgrades[id];
    const cost = META_UPGRADES[id].costs[level];
    if (cost === undefined || meta.cores < cost) return;
    gwarsAudio.play("uiSelect");
    updateMeta((m) => ({
      ...m,
      cores: m.cores - cost,
      upgrades: { ...m.upgrades, [id]: m.upgrades[id] + 1 },
    }));
  };

  const unlockShip = (id: ShipId) => {
    const ship = SHIPS[id];
    if (meta.unlockedShips.includes(id) || meta.cores < ship.cost) return;
    gwarsAudio.play("uiSelect");
    updateMeta((m) => ({
      ...m,
      cores: m.cores - ship.cost,
      unlockedShips: [...m.unlockedShips, id],
      selectedShip: id,
    }));
  };

  /* ----- Shared UI bits ----- */

  const shipTiles = (compact: boolean) => (
    <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
      {SHIP_ORDER.map((id) => {
        const ship = SHIPS[id];
        const unlocked = meta.unlockedShips.includes(id);
        const selected = meta.selectedShip === id;
        return (
          <button
            key={id}
            onClick={() => {
              if (unlocked) {
                gwarsAudio.play("uiSelect");
                updateMeta((m) => ({ ...m, selectedShip: id }));
              } else if (panel === "shop") {
                unlockShip(id);
              } else {
                setPanel("shop");
              }
            }}
            className={cn(
              "rounded-xl border p-2 text-left transition-colors",
              selected && unlocked
                ? "border-accent bg-accent/10"
                : "border-border hover:bg-muted/50",
              !unlocked && "opacity-70"
            )}
          >
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: ship.color }}
              />
              {ship.name}
              {!unlocked && <Lock className="ml-auto size-3 text-muted-foreground" />}
            </p>
            <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
              {unlocked ? ship.tagline : `${ship.cost.toLocaleString()} cores`}
            </p>
          </button>
        );
      })}
    </div>
  );

  const muteButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleMute}
      aria-label={meta.muted ? "Unmute sound effects" : "Mute sound effects"}
    >
      {meta.muted ? <VolumeX /> : <Volume2 />}
    </Button>
  );

  const engine = engineRef.current;

  return (
    <div className="relative h-full select-none overflow-hidden bg-[#04060d]">
      <div ref={wrapRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block" onContextMenu={(e) => e.preventDefault()} />
      </div>

      {/* Rarity-colored screen flash when a reward card is taken. */}
      {pickFlash && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-30"
          style={{ backgroundColor: pickFlash }}
          initial={{ opacity: 0.26 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          onAnimationComplete={() => setPickFlash(null)}
        />
      )}

      {/* Pause button floats over the canvas while playing. */}
      {phase === "playing" && (
        <button
          onClick={pauseGame}
          aria-label="Pause"
          className="absolute bottom-3 right-3 z-10 rounded-lg border border-border/60 bg-card/60 p-2 text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
        >
          <Pause className="size-4" />
        </button>
      )}

      <AnimatePresence>
        {phase === "title" && !panel && (
          <Overlay key="title" reduce={reduce}>
            <div className="my-auto w-full max-w-md py-2 text-center">
              <h2
                className="text-4xl font-black tracking-[0.3em]"
                style={{ color: "#7df9ff", textShadow: "0 0 24px rgba(125,249,255,0.55)" }}
              >
                G-WARS
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Clear waves. Bank cores. Upgrade. Go again.
              </p>

              <dl className="mx-auto mt-4 grid w-full max-w-xs grid-cols-3 gap-2 font-mono">
                {(
                  [
                    ["Best score", meta.best.score.toLocaleString()],
                    ["Best wave", meta.best.wave || "-"],
                    ["Cores", meta.cores.toLocaleString()],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border bg-muted/30 p-2">
                    <dt className="text-[10px] text-muted-foreground">{label}</dt>
                    <dd className="text-sm font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>

              <p className="mb-2 mt-4 text-left text-xs font-medium text-muted-foreground">
                Ship
              </p>
              {shipTiles(false)}

              <p className="mb-2 mt-4 text-left text-xs font-medium text-muted-foreground">
                Difficulty
              </p>
              <div className="flex items-center gap-2">
                {(
                  [
                    ["normal", "Normal · 1 life"],
                    ["easy", "Easy"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => updateMeta((m) => ({ ...m, difficulty: id }))}
                    className={cn(
                      "flex-1 rounded-lg border px-2 py-1.5 text-xs transition-colors",
                      meta.difficulty === id
                        ? "border-accent bg-accent/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {label}
                  </button>
                ))}
                {meta.difficulty === "easy" &&
                  EASY_LIVES_OPTIONS.map((n) => (
                    <button
                      key={n}
                      onClick={() => updateMeta((m) => ({ ...m, easyLives: n }))}
                      className={cn(
                        "w-10 rounded-lg border px-0 py-1.5 font-mono text-xs transition-colors",
                        meta.easyLives === n
                          ? "border-accent bg-accent/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      )}
                      aria-label={n === 0 ? "Infinite lives" : `${n} lives`}
                    >
                      {n === 0 ? "∞" : n}
                    </button>
                  ))}
              </div>

              <div className="mt-5 flex items-center justify-center gap-2">
                <Button onClick={startRun} data-testid="gwars-play">
                  <Play /> Play
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPanel("shop")}>
                  Shop
                </Button>
                {muteButton}
              </div>

              <p className="mt-5 font-mono text-xs text-muted-foreground">
                WASD move · Arrows aim &amp; fire · Space bomb · Esc pause
              </p>
              {coarse && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Heads up: this one needs a keyboard.
                </p>
              )}
            </div>
          </Overlay>
        )}

        {phase === "reward" && !panel && (
          <Overlay key="reward" reduce={reduce}>
            <div className="my-auto w-full max-w-md py-2 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">
                Wave {clearedWave} clear
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Pick one upgrade</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {choices.map((offer, i) => {
                  const rar = RARITY[offer.rarity];
                  const info = offerInfo(offer);
                  const epicPlus = RARITY_RANK[offer.rarity] >= RARITY_RANK.epic;
                  return (
                    <motion.button
                      key={`${dealId}-${i}`}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.94 }}
                      animate={
                        reduce
                          ? { opacity: 1 }
                          : { opacity: 1, y: 0, scale: epicPlus ? [0.94, 1.07, 1] : 1 }
                      }
                      transition={{
                        delay: reduce ? 0 : 0.08 + i * 0.12,
                        duration: 0.3,
                        ease: "easeOut",
                      }}
                      onClick={() => pickUpgrade(offer)}
                      className="relative overflow-hidden rounded-xl border bg-card/60 p-3 text-left transition-colors hover:bg-accent/10"
                      style={{
                        borderColor: rar.color,
                        boxShadow: `0 0 14px ${rar.color}40, inset 0 0 20px ${rar.color}14`,
                      }}
                    >
                      {offer.kind === "combo" && !reduce && (
                        <motion.div
                          aria-hidden
                          className="pointer-events-none absolute inset-0"
                          style={{
                            background:
                              "linear-gradient(120deg, transparent 15%, rgba(255,92,240,0.22) 35%, rgba(74,163,255,0.22) 50%, rgba(255,176,32,0.22) 65%, transparent 85%)",
                            backgroundSize: "300% 100%",
                          }}
                          animate={{ backgroundPosition: ["100% 0%", "-100% 0%"] }}
                          transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                        />
                      )}
                      <div className="relative">
                        <p className="flex items-center justify-between gap-1 font-mono text-[10px]">
                          <span className="text-muted-foreground">[{i + 1}]</span>
                          <span
                            className="rounded px-1 py-px font-semibold uppercase tracking-wider"
                            style={{ color: rar.color, backgroundColor: `${rar.color}1f` }}
                          >
                            {rar.label}
                          </span>
                        </p>
                        <p className="mt-1 text-sm font-semibold">{info.name}</p>
                        <p className="mt-1 text-xs leading-snug text-muted-foreground">
                          {info.desc}
                        </p>
                        <p className="mt-2 font-mono text-[10px]" style={{ color: rar.color }}>
                          {offer.kind === "stackable"
                            ? offer.id === "bomb"
                              ? `+${offer.potency} bomb${offer.potency > 1 ? "s" : ""}`
                              : `+${offer.potency} lv${engine ? ` · ${engine.mods[offer.id]}/${UPGRADES[offer.id].max}` : ""}`
                            : offer.kind === "unique"
                              ? "Unique · one-time"
                              : "Fusion · new effect"}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={rerolls <= 0}
                  onClick={rerollCards}
                >
                  <RotateCcw /> Reroll ({rerolls})
                </Button>
              </div>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                1/2/3 pick · R reroll
              </p>
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
                  <Button variant="ghost" size="sm" onClick={startRun}>
                    <RotateCcw /> Restart
                  </Button>
                  <Button variant="ghost" size="sm" onClick={quitToTitle}>
                    Quit
                  </Button>
                  {muteButton}
                </div>
              </div>
            </div>
          </Overlay>
        )}

        {phase === "over" && !panel && summary && (
          <Overlay key="over" reduce={reduce}>
            <div className="my-auto w-full max-w-md py-2 text-center" data-testid="gwars-gameover">
              <h2 className="text-2xl font-semibold tracking-tight">Run over</h2>
              {(summary.newBestScore || summary.newBestWave) && (
                <p className="mt-1 text-sm text-accent">
                  {summary.newBestScore ? "New best score" : "New best wave"}
                </p>
              )}
              <dl className="mx-auto mt-5 grid w-72 grid-cols-3 gap-2 font-mono">
                {(
                  [
                    ["Score", summary.score.toLocaleString()],
                    ["Wave", summary.wave],
                    ["Kills", summary.kills],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border bg-muted/30 p-2">
                    <dt className="text-[10px] text-muted-foreground">{label}</dt>
                    <dd className="text-sm font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 font-mono text-sm">
                <span className="text-accent">+{summary.cores.toLocaleString()}</span>{" "}
                <span className="text-muted-foreground">
                  cores banked · {meta.cores.toLocaleString()} total
                </span>
              </p>
              <div className="mt-5 flex flex-col items-center gap-2">
                <Button onClick={startRun} data-testid="gwars-again">
                  <Play /> Retry
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setPanel("shop")}>
                    Shop
                  </Button>
                  <Button variant="ghost" size="sm" onClick={quitToTitle}>
                    Title
                  </Button>
                </div>
              </div>
            </div>
          </Overlay>
        )}

        {panel === "shop" && (
          <Overlay key="shop" reduce={reduce}>
            <div className="my-auto w-full max-w-md py-2">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold tracking-tight">Shop</h2>
                <p className="font-mono text-sm">
                  <span className="text-accent">{meta.cores.toLocaleString()}</span>{" "}
                  <span className="text-muted-foreground">cores</span>
                </p>
              </div>

              <p className="mb-2 mt-4 text-xs font-medium text-muted-foreground">
                Permanent upgrades
              </p>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {(Object.keys(META_UPGRADES) as MetaUpgradeId[]).map((id) => {
                  const def = META_UPGRADES[id];
                  const level = meta.upgrades[id];
                  const cost = def.costs[level];
                  const maxed = cost === undefined;
                  return (
                    <li key={id} className="flex items-center gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{def.name}</p>
                        <p className="text-xs text-muted-foreground">{def.desc}</p>
                      </div>
                      <div className="flex gap-0.5" aria-hidden>
                        {def.costs.map((_, i) => (
                          <span
                            key={i}
                            className={cn(
                              "h-1.5 w-3 rounded-full",
                              i < level ? "bg-accent" : "bg-muted"
                            )}
                          />
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-20 font-mono text-xs"
                        disabled={maxed || meta.cores < cost}
                        onClick={() => buyUpgrade(id)}
                      >
                        {maxed ? "Max" : cost.toLocaleString()}
                      </Button>
                    </li>
                  );
                })}
              </ul>

              <p className="mb-2 mt-4 text-xs font-medium text-muted-foreground">Ships</p>
              {shipTiles(true)}

              <div className="mt-4 flex justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(confirmReset && "text-destructive")}
                  onClick={() => {
                    if (!confirmReset) {
                      setConfirmReset(true);
                      return;
                    }
                    setConfirmReset(false);
                    setMeta(resetMeta());
                  }}
                  onBlur={() => setConfirmReset(false)}
                >
                  {confirmReset ? "Really reset everything?" : "Reset progress"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setConfirmReset(false);
                    setPanel(null);
                  }}
                >
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
