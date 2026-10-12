/**
 * Generated audio only — no sample files. A short noise buffer plus oscillators
 * covers splashes, ticks, reel clicks, the hook set, a snap and a landing chime,
 * together with a soft lakeside ambience (water lap + distant birds).
 */

export class AudioKit {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private ambience: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private birdTimer = 0;
  enabled = true;

  /** Must be called from a user gesture. */
  resume() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 1.6);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
    this.startAmbience();
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v ? 0.55 : 0.0001, this.ctx.currentTime, 0.1);
    }
  }

  private noiseSource(): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noise) return null;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    return s;
  }

  private startAmbience() {
    const ctx = this.ctx;
    if (!ctx) return;
    const src = this.noiseSource();
    if (!src) return;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    src.connect(filter).connect(gain).connect(this.master!);
    src.start();
    this.ambience = { src, gain, filter };
  }

  setWind(v: number) {
    if (!this.ctx || !this.ambience) return;
    const t = this.ctx.currentTime;
    this.ambience.gain.gain.setTargetAtTime(0.03 + v * 0.11, t, 0.6);
    this.ambience.filter.frequency.setTargetAtTime(300 + v * 900, t, 0.8);
  }

  private blip(freq: number, dur: number, type: OscillatorType, gain: number, sweep = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), ctx.currentTime + dur);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g).connect(this.master!);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  private hiss(dur: number, from: number, to: number, gain: number, q = 1) {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const src = this.noiseSource();
    if (!src) return;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(filter).connect(g).connect(this.master!);
    src.start();
    src.stop(ctx.currentTime + dur + 0.05);
  }

  castWhoosh() {
    this.hiss(0.45, 400, 1800, 0.14, 0.7);
  }

  splash(power = 1) {
    this.hiss(0.28 + power * 0.16, 900 + power * 300, 180, 0.12 + power * 0.12, 1.1);
    this.blip(160 + power * 60, 0.16, 'sine', 0.06 + power * 0.04, -80);
  }

  tick(strength = 0.5) {
    this.blip(900 + strength * 700, 0.05, 'triangle', 0.05 + strength * 0.05, -220);
  }

  bite() {
    this.blip(1320, 0.09, 'square', 0.07, -350);
    this.blip(880, 0.16, 'triangle', 0.06, -240);
  }

  hookSet() {
    this.hiss(0.18, 1400, 500, 0.14, 1.4);
    this.blip(300, 0.2, 'sawtooth', 0.05, -120);
  }

  reelClick() {
    this.blip(2200, 0.02, 'square', 0.022, -400);
  }

  strain(level: number) {
    this.blip(180 + level * 120, 0.22, 'sawtooth', 0.03 + level * 0.05, 60);
  }

  snap() {
    this.blip(2400, 0.06, 'square', 0.12, -1400);
    this.hiss(0.35, 2200, 220, 0.16, 1.2);
  }

  caught(trophy: boolean) {
    const base = trophy ? 523 : 440;
    this.blip(base, 0.22, 'triangle', 0.1);
    window.setTimeout(() => this.blip(base * 1.5, 0.26, 'triangle', 0.09), 110);
    if (trophy) window.setTimeout(() => this.blip(base * 2, 0.4, 'triangle', 0.08), 240);
  }

  splashOut() {
    this.hiss(0.5, 700, 120, 0.1, 0.9);
  }

  uiClick() {
    this.blip(680, 0.09, 'triangle', 0.05, 180);
  }

  /** Occasional distant bird at dawn / dusk. */
  ambient(dt: number, hour: number, wind: number) {
    if (!this.ctx || !this.enabled) return;
    this.birdTimer -= dt;
    if (this.birdTimer > 0) return;
    this.birdTimer = 6 + Math.random() * 16;
    const dawn = hour > 4.5 && hour < 9;
    const dusk = hour > 18 && hour < 21;
    if ((dawn || dusk) && wind < 0.6 && Math.random() < 0.75) {
      const f = 1900 + Math.random() * 900;
      this.blip(f, 0.09, 'sine', 0.02, -500);
      window.setTimeout(() => this.blip(f * 1.2, 0.07, 'sine', 0.016, -300), 130);
    }
  }

  dispose() {
    try {
      this.ambience?.src.stop();
      this.ambience = null;
      void this.ctx?.close();
    } catch {
      /* already closed */
    }
    this.ctx = null;
    this.master = null;
  }
}
