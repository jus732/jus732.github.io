/**
 * Synthesized Tetris sound effects: short oscillator/noise voices built on
 * the Web Audio API, so there are no audio assets and no dependencies.
 * The AudioContext is created lazily inside a user gesture (autoplay
 * policy) and every sound schedules at currentTime for zero-lag playback.
 */

export type SoundName =
  | "move"
  | "rotate"
  | "hold"
  | "hardDrop"
  | "clear1"
  | "clear2"
  | "clear3"
  | "clear4"
  | "levelUp"
  | "gameOver";

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

class TetrisAudio {
  muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined" || !("AudioContext" in window)) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
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

  /** Low-passed noise burst for the hard-drop impact. */
  private thump(at = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + at;
    const len = Math.floor(ctx.sampleRate * 0.1);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.45, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  play(name: SoundName) {
    if (this.muted || !this.ensure()) return;
    switch (name) {
      case "move":
        this.tone({ freq: 210, type: "triangle", dur: 0.04, vol: 0.09 });
        break;
      case "rotate":
        this.tone({ freq: 300, to: 420, type: "triangle", dur: 0.07, vol: 0.12 });
        break;
      case "hold":
        this.tone({ freq: 392, type: "triangle", dur: 0.05, vol: 0.12 });
        this.tone({ freq: 523, type: "triangle", at: 0.055, dur: 0.07, vol: 0.12 });
        break;
      case "hardDrop":
        this.thump();
        this.tone({ freq: 160, to: 55, type: "sine", dur: 0.12, vol: 0.3 });
        break;
      case "clear1":
        this.arp([660, 880], { dur: 0.09, vol: 0.14 });
        break;
      case "clear2":
        this.arp([523, 659, 784], { dur: 0.09, vol: 0.14 });
        break;
      case "clear3":
        this.arp([523, 659, 784, 1047], { dur: 0.09, vol: 0.14 });
        break;
      case "clear4":
        // Tetris fanfare: fast run up plus a held, brighter top note
        this.arp([523, 659, 784, 1047], { gap: 0.045, dur: 0.09, vol: 0.16 });
        this.tone({ freq: 1319, type: "sawtooth", at: 0.19, dur: 0.28, vol: 0.14 });
        this.tone({ freq: 1315, type: "triangle", at: 0.19, dur: 0.28, vol: 0.12 });
        break;
      case "levelUp":
        this.arp([392, 523, 659], { at: 0.14, gap: 0.07, type: "triangle", dur: 0.1, vol: 0.13 });
        this.tone({ freq: 784, type: "triangle", at: 0.35, dur: 0.22, vol: 0.15 });
        break;
      case "gameOver":
        this.arp([392, 330, 262, 196], {
          gap: 0.15,
          type: "sawtooth",
          dur: 0.16,
          vol: 0.11,
        });
        this.tone({ freq: 98, type: "sine", at: 0.58, dur: 0.5, vol: 0.2 });
        break;
    }
  }
}

/** Module singleton so reopening the window reuses one AudioContext. */
export const tetrisAudio = new TetrisAudio();
