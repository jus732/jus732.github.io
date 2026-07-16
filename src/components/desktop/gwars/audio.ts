/**
 * Synthesized G-Wars sound effects: short oscillator/noise voices built
 * on the Web Audio API, mirroring tetris/audio.ts - no assets, no deps.
 * The AudioContext is created lazily inside a user gesture (autoplay
 * policy) and every sound schedules at currentTime for zero-lag playback.
 * High-frequency combat sounds (fire, kills) are rate-limited and pitch-
 * jittered here so a maxed fire-rate build stays a texture, not a buzz.
 */

export type SoundName =
  | "fire"
  | "enemySpawn"
  | "enemyKill"
  | "geomPickup"
  | "playerHit"
  | "playerDeath"
  | "waveClear"
  | "bomb"
  | "upgradePick"
  | "gameOver"
  | "uiSelect"
  | "revealCommon"
  | "revealRare"
  | "revealEpic"
  | "revealLegendary"
  | "revealCombo"
  | "reroll";

type ToneOpts = {
  freq: number;
  /** Optional pitch glide target. */
  to?: number;
  type?: OscillatorType;
  /** Start offset in seconds from now. */
  at?: number;
  dur?: number;
  vol?: number;
};

/** Min seconds between repeats of spammy combat sounds. */
const THROTTLE: Partial<Record<SoundName, number>> = {
  fire: 0.045,
  enemyKill: 0.04,
  enemySpawn: 0.06,
  geomPickup: 0.05,
};

class GwarsAudio {
  muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lastAt: Partial<Record<SoundName, number>> = {};

  private ensure(): AudioContext | null {
    if (typeof window === "undefined" || !("AudioContext" in window)) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.4;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private tone({ freq, to, type = "square", at = 0, dur = 0.08, vol = 0.15 }: ToneOpts) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    // 5ms attack and an exponential tail avoid start/stop clicks
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  private arp(
    notes: number[],
    { gap = 0.055, at = 0, ...rest }: Omit<ToneOpts, "freq"> & { gap?: number } = {}
  ) {
    notes.forEach((freq, i) => this.tone({ freq, at: at + i * gap, ...rest }));
  }

  /** Filtered noise burst for impacts and whooshes. */
  private thump(at = 0, { cutoff = 420, dur = 0.1, vol = 0.45 } = {}) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + at;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  /** ±jitter as a pitch multiplier, so rapid repeats don't drone. */
  private vary(freq: number, jitter = 0.06) {
    return freq * (1 - jitter + Math.random() * jitter * 2);
  }

  play(name: SoundName) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;

    const minGap = THROTTLE[name];
    if (minGap !== undefined) {
      const last = this.lastAt[name] ?? -Infinity;
      if (ctx.currentTime - last < minGap) return;
      this.lastAt[name] = ctx.currentTime;
    }

    switch (name) {
      case "fire":
        // The heartbeat of the game: tiny, quiet, always a little different.
        this.tone({ freq: this.vary(820), to: 240, type: "square", dur: 0.045, vol: 0.035 });
        break;
      case "enemySpawn":
        this.tone({ freq: this.vary(190), to: 330, type: "triangle", dur: 0.07, vol: 0.06 });
        break;
      case "enemyKill":
        this.tone({ freq: this.vary(640), to: 110, type: "square", dur: 0.09, vol: 0.09 });
        this.thump(0, { cutoff: 1600, dur: 0.05, vol: 0.08 });
        break;
      case "geomPickup":
        this.tone({ freq: this.vary(1180, 0.1), to: 1560, type: "sine", dur: 0.06, vol: 0.09 });
        break;
      case "playerHit":
        this.thump(0, { cutoff: 900, dur: 0.12, vol: 0.35 });
        this.tone({ freq: 320, to: 80, type: "sawtooth", dur: 0.18, vol: 0.2 });
        break;
      case "playerDeath":
        this.thump(0, { cutoff: 600, dur: 0.25, vol: 0.5 });
        this.tone({ freq: 240, to: 36, type: "sawtooth", dur: 0.6, vol: 0.24 });
        this.arp([392, 311, 233, 156], { at: 0.05, gap: 0.09, type: "square", dur: 0.12, vol: 0.1 });
        break;
      case "waveClear":
        // Short chime; the reveal sting that follows carries the drama.
        this.arp([784, 1047], { gap: 0.07, type: "triangle", dur: 0.12, vol: 0.13 });
        break;
      case "bomb":
        this.thump(0, { cutoff: 300, dur: 0.4, vol: 0.55 });
        this.tone({ freq: 130, to: 28, type: "sine", dur: 0.5, vol: 0.3 });
        this.tone({ freq: 700, to: 60, type: "sawtooth", dur: 0.25, vol: 0.08 });
        break;
      case "upgradePick":
        this.arp([660, 990], { gap: 0.06, type: "triangle", dur: 0.09, vol: 0.14 });
        break;
      case "gameOver":
        this.arp([440, 349, 277, 220], { gap: 0.15, type: "sawtooth", dur: 0.16, vol: 0.11 });
        this.tone({ freq: 110, type: "sine", at: 0.58, dur: 0.5, vol: 0.2 });
        break;
      case "uiSelect":
        this.tone({ freq: 440, type: "triangle", dur: 0.04, vol: 0.09 });
        break;

      /* Reveal stings escalate by tier; all start ~0.18s in so they
       * land just after the waveClear chime (or the reroll swish). */
      case "revealCommon":
        this.tone({ freq: 392, type: "triangle", at: 0.18, dur: 0.07, vol: 0.08 });
        break;
      case "revealRare":
        this.arp([523, 659], { at: 0.18, gap: 0.07, type: "triangle", dur: 0.1, vol: 0.12 });
        break;
      case "revealEpic":
        this.arp([523, 659, 880], { at: 0.18, gap: 0.065, type: "triangle", dur: 0.1, vol: 0.13 });
        break;
      case "revealLegendary":
        this.arp([523, 659, 880, 1175], { at: 0.18, gap: 0.06, dur: 0.1, vol: 0.12 });
        this.tone({ freq: 1568, type: "triangle", at: 0.44, dur: 0.3, vol: 0.13 });
        break;
      case "revealCombo":
        // Prismatic: a fast run up with a detuned, shimmering held top.
        this.arp([523, 622, 740, 880, 1047], { at: 0.18, gap: 0.05, type: "triangle", dur: 0.09, vol: 0.12 });
        this.tone({ freq: 1319, type: "sawtooth", at: 0.46, dur: 0.4, vol: 0.09 });
        this.tone({ freq: 1327, type: "triangle", at: 0.46, dur: 0.4, vol: 0.1 });
        break;
      case "reroll":
        this.thump(0, { cutoff: 2400, dur: 0.09, vol: 0.12 });
        this.tone({ freq: 520, to: 330, type: "triangle", dur: 0.06, vol: 0.1 });
        this.tone({ freq: 330, to: 560, type: "triangle", at: 0.07, dur: 0.06, vol: 0.1 });
        break;
    }
  }
}

/** Module singleton so reopening the window reuses one AudioContext. */
export const gwarsAudio = new GwarsAudio();
