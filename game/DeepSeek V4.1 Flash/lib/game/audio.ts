export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private ambienceGain: GainNode | null = null;
  private enabled = true;
  private volume = 0.6;
  private lastReelTick = 0;
  private birdTimer: number | null = null;

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.05);
    }
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master && this.ctx && this.enabled) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    }
  }

  ensure(): void {
    if (typeof window === "undefined") return;
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this.makeNoiseBuffer();
      this.startAmbience();
    } catch {
      this.ctx = null;
    }
  }

  private makeNoiseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private startAmbience(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = 0.055;
    src.connect(filter).connect(gain).connect(this.master!);
    src.start();

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.14;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();
    this.ambienceGain = gain;

    const scheduleBird = () => {
      this.birdTimer = window.setTimeout(() => {
        this.birdChirp();
        scheduleBird();
      }, 5000 + Math.random() * 12000);
    };
    scheduleBird();
  }

  private birdChirp(): void {
    if (!this.ctx || !this.master || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (let k = 0; k < 3; k++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      const start = t + k * 0.14;
      osc.frequency.setValueAtTime(2100 + Math.random() * 500, start);
      osc.frequency.exponentialRampToValueAtTime(2600 + Math.random() * 600, start + 0.08);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.022, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);
      osc.connect(gain).connect(this.master);
      osc.start(start);
      osc.stop(start + 0.14);
    }
  }

  private noiseBurst(duration: number, gainValue: number, filterFrom: number, filterTo: number): void {
    if (!this.ctx || !this.master || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterFrom, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, filterTo), t + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.05);
  }

  private tone(
    freqFrom: number,
    freqTo: number,
    duration: number,
    gainValue: number,
    type: OscillatorType = "sine",
    delay = 0
  ): void {
    if (!this.ctx || !this.master || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqTo), t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(gainValue, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  play(name: string, intensity = 1): void {
    if (!this.ctx || !this.enabled) return;
    switch (name) {
      case "splash":
        this.noiseBurst(0.55 * intensity + 0.2, 0.4, 1400, 200);
        break;
      case "splashSoft":
        this.noiseBurst(0.3, 0.22, 900, 250);
        break;
      case "nibble":
        this.tone(720, 640, 0.09, 0.07);
        break;
      case "bite":
        this.tone(520, 320, 0.32, 0.16, "sine");
        this.tone(300, 240, 0.22, 0.1, "sine", 0.1);
        break;
      case "hook":
        this.noiseBurst(0.4, 0.35, 2000, 300);
        this.tone(900, 500, 0.12, 0.12, "square");
        break;
      case "steal":
        this.tone(420, 170, 0.3, 0.12, "sine");
        break;
      case "spook":
        this.noiseBurst(0.25, 0.25, 600, 150);
        this.tone(240, 180, 0.2, 0.08);
        break;
      case "reelStart":
        this.tone(1150, 1000, 0.04, 0.06, "square");
        break;
      case "land":
        this.noiseBurst(0.5, 0.4, 1600, 250);
        this.tone(660, 880, 0.3, 0.1, "sine", 0.15);
        this.tone(880, 1180, 0.4, 0.1, "sine", 0.32);
        break;
      case "escape":
        this.tone(500, 300, 0.22, 0.12, "sine");
        this.tone(320, 180, 0.3, 0.12, "sine", 0.2);
        break;
      case "break":
        this.noiseBurst(0.18, 0.5, 3000, 400);
        this.tone(180, 70, 0.4, 0.2, "sawtooth");
        break;
      case "levelup":
        this.tone(520, 520, 0.14, 0.1, "sine", 0);
        this.tone(660, 660, 0.14, 0.1, "sine", 0.13);
        this.tone(780, 780, 0.2, 0.12, "sine", 0.26);
        this.tone(1040, 1040, 0.3, 0.12, "sine", 0.4);
        break;
      case "ui":
        this.tone(880, 820, 0.05, 0.05, "square");
        break;
      case "buy":
        this.tone(740, 740, 0.08, 0.08, "sine");
        this.tone(990, 990, 0.12, 0.08, "sine", 0.08);
        break;
      default:
        break;
    }
  }

  reelTick(): void {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    if (now - this.lastReelTick < 0.09) return;
    this.lastReelTick = now;
    this.tone(1250, 1050, 0.025, 0.045, "square");
  }

  dispose(): void {
    if (this.birdTimer !== null) {
      window.clearTimeout(this.birdTimer);
      this.birdTimer = null;
    }
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined);
      this.ctx = null;
    }
    this.master = null;
    this.ambienceGain = null;
    this.noiseBuffer = null;
  }
}
