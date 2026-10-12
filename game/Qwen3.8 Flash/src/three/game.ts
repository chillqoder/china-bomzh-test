/**
 * Game engine: WebGL renderer + input + main loop. Bridges the pure simulation
 * to the world, the HUD snapshots and the generated audio.
 */

import * as THREE from 'three';
import { Simulation } from '@/game/simulation';
import { SPECIES } from '@/game/species';
import type { BaitId, HudSnapshot, Quality, SpeciesId } from '@/game/types';
import { AudioKit } from './audio';
import { buildFish, type FishModel } from './fishModels';
import { PLAYER_EYE_Y, World } from './world';
import { clamp, clamp01 } from '@/game/rng';

export interface GameCallbacks {
  onHud: (snapshot: HudSnapshot) => void;
  onRequestPause: () => void;
}

const PIP_W = 178;
const PIP_H = 122;

export class FishingGame {
  readonly sim = new Simulation();
  private world: World;
  private renderer: THREE.WebGLRenderer;
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private audio = new AudioKit();
  private cb: GameCallbacks;
  private raf = 0;
  private last = 0;
  private hudTimer = 0;
  private yaw = 0;
  private pitch = -0.14;
  private dragging = false;
  private pointerAction: 'none' | 'charge' | 'reel' = 'none';
  private uiBlocked = false;
  private paused = false;
  private time = 0;
  private ro: ResizeObserver | null = null;
  private reelTick = 0;
  private previewCanvas: HTMLCanvasElement | null = null;
  private previewRenderer: THREE.WebGLRenderer | null = null;
  private previewScene = new THREE.Scene();
  private previewCam = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
  private previewFish: FishModel | null = null;
  private disposed = false;
  private listeners: Array<[EventTarget, string, EventListener, AddEventListenerOptions?]> = [];

  constructor(container: HTMLElement, cb: GameCallbacks) {
    this.container = container;
    this.cb = cb;
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.touchAction = 'none';
    this.canvas.setAttribute('aria-label', 'Озеро: игровая сцена рыбалки');
    container.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.autoClear = true;
    this.renderer.setClearColor(0x0b1017, 1);

    this.world = new World(this.sim.save.settings.quality ?? 'medium');
    this.applyQuality(this.sim.save.settings.quality ?? 'medium');
    this.audio.enabled = this.sim.save.settings.sound;
    this.previewCam.position.set(0, 0.45, 1.5);
    this.previewCam.lookAt(0, 0, 0);

    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.bindInput();
    this.publish(true);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    // small debug handle (handy in the console and for automated checks)
    if (typeof window !== 'undefined') (window as unknown as { __fishing?: FishingGame }).__fishing = this;
  }

  /* --------------------------------- sizing -------------------------------- */

  private resize() {
    const w = Math.max(320, this.container.clientWidth);
    const h = Math.max(240, this.container.clientHeight);
    const pr = this.pixelRatio();
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.world.camera.aspect = w / h;
    this.world.camera.updateProjectionMatrix();
    if (this.previewRenderer && this.previewCanvas) {
      const pw = this.previewCanvas.clientWidth || 240;
      const ph = this.previewCanvas.clientHeight || 180;
      this.previewRenderer.setSize(pw, ph, false);
      this.previewCam.aspect = pw / ph;
      this.previewCam.updateProjectionMatrix();
    }
  }

  private pixelRatio() {
    const q = this.sim.save.settings.quality;
    const dpr = window.devicePixelRatio || 1;
    if (q === 'low') return 1;
    if (q === 'high') return Math.min(2, dpr);
    return Math.min(1.5, dpr);
  }

  private applyQuality(q: Quality) {
    this.world.setQuality(q);
    this.renderer.shadowMap.enabled = q !== 'low';
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.resize();
  }

  /* ---------------------------------- input -------------------------------- */

  private on<K extends keyof WindowEventMap>(
    target: EventTarget,
    type: string,
    handler: EventListener,
    opts?: AddEventListenerOptions,
  ) {
    target.addEventListener(type, handler, opts);
    this.listeners.push([target, type, handler, opts]);
  }

  private bindInput() {
    this.on(this.canvas, 'pointerdown', ((e: PointerEvent) => this.pointerDown(e)) as EventListener);
    this.on(window, 'pointermove', ((e: PointerEvent) => this.pointerMove(e)) as EventListener);
    this.on(window, 'pointerup', ((e: PointerEvent) => this.pointerUp(e)) as EventListener);
    this.on(window, 'pointercancel', ((e: PointerEvent) => this.pointerUp(e)) as EventListener);
    this.on(this.canvas, 'wheel', ((e: WheelEvent) => {
      e.preventDefault();
      this.sim.adjustDrag(e.deltaY < 0 ? 1 : -1);
      this.publish(true);
    }) as EventListener, { passive: false });
    this.on(this.canvas, 'contextmenu', ((e: Event) => e.preventDefault()) as EventListener);
    this.on(window, 'keydown', ((e: KeyboardEvent) => this.keyDown(e)) as EventListener);
    this.on(window, 'keyup', ((e: KeyboardEvent) => this.keyUp(e)) as EventListener);
    this.on(window, 'blur', (() => {
      if (this.pointerAction === 'charge') this.sim.cancelCharge();
      this.sim.setReeling(false);
      this.pointerAction = 'none';
    }) as EventListener);
    this.on(window, 'pagehide', (() => this.sim.flush()) as EventListener);
  }

  private get blocked() {
    return this.uiBlocked || this.paused || this.sim.state.phase === 'result';
  }

  private pointerDown(e: PointerEvent) {
    if (this.blocked || e.button !== 0) return;
    this.audio.resume();
    this.audio.setEnabled(this.sim.save.settings.sound);
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* not required */
    }
    const p = this.sim.state.phase;
    if (p === 'ready') {
      this.sim.beginCharge();
      this.pointerAction = this.sim.state.phase === 'charging' ? 'charge' : 'none';
    } else if (p === 'strike' || p === 'investigating' || p === 'waiting') {
      this.sim.attemptStrike();
      this.pointerAction = 'none';
    } else if (p === 'fighting') {
      this.sim.setReeling(true);
      this.pointerAction = 'reel';
    } else {
      this.pointerAction = 'none';
    }
    this.publish(true);
  }

  private lastX = 0;
  private lastY = 0;

  private pointerMove(e: PointerEvent) {
    if (!this.dragging) return;
    const sens = 0.0032 * (this.sim.save.settings.sensitivity ?? 1);
    this.yaw -= (e.clientX - this.lastX) * sens;
    this.pitch -= (e.clientY - this.lastY) * sens;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.pitch = clamp(this.pitch, -0.55, 0.62);
    this.yaw = clamp(this.yaw, -1.75, 1.75); // the shore spot faces the lake
  }

  private pointerUp(e: PointerEvent) {
    if (!this.dragging) return;
    this.dragging = false;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (this.pointerAction === 'charge') this.sim.releaseCharge();
    else if (this.pointerAction === 'reel') this.sim.setReeling(false);
    this.pointerAction = 'none';
    this.publish(true);
  }

  private keyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      this.cb.onRequestPause();
      return;
    }
    if (e.repeat || this.blocked) return;
    if (e.code === 'Space') {
      e.preventDefault();
      const p = this.sim.state.phase;
      if (p === 'ready') {
        this.sim.beginCharge();
        this.pointerAction = 'charge';
      } else if (p === 'strike' || p === 'investigating' || p === 'waiting') {
        this.sim.attemptStrike();
      } else if (p === 'fighting') {
        this.sim.setReeling(true);
        this.pointerAction = 'reel';
      }
      this.publish(true);
    }
  }

  private keyUp(e: KeyboardEvent) {
    if (e.code !== 'Space') return;
    if (this.pointerAction === 'charge') this.sim.releaseCharge();
    else if (this.pointerAction === 'reel') this.sim.setReeling(false);
    this.pointerAction = 'none';
    this.publish(true);
  }

  /* ------------------------------ public API ------------------------------ */

  setPaused(v: boolean) {
    this.paused = v;
    this.sim.paused = v;
    if (v) {
      if (this.pointerAction === 'charge') this.sim.cancelCharge();
      this.sim.setReeling(false);
      this.dragging = false;
      this.pointerAction = 'none';
    }
    this.publish(true);
  }

  setUiBlocked(v: boolean) {
    this.uiBlocked = v;
    if (v) {
      if (this.pointerAction === 'charge') this.sim.cancelCharge();
      this.sim.setReeling(false);
      this.dragging = false;
      this.pointerAction = 'none';
    }
  }

  selectBait(id: BaitId) {
    this.sim.selectBait(id);
    this.publish(true);
  }

  buy(id: string) {
    this.audio.resume();
    this.sim.buy(id);
    this.publish(true);
  }

  sell() {
    this.sim.sellKeepnet();
    this.publish(true);
  }

  setDrag(v: number) {
    this.sim.setDrag(v);
    this.publish(true);
  }

  retrieve() {
    this.sim.retrieve();
    this.publish(true);
  }

  /** Touch / button driven cast control (mirrors the mouse). */
  pressCast() {
    if (this.blocked) return;
    this.audio.resume();
    const p = this.sim.state.phase;
    if (p === 'ready') this.sim.beginCharge();
    else if (p === 'strike' || p === 'investigating' || p === 'waiting') this.sim.attemptStrike();
    else if (p === 'fighting') this.sim.setReeling(true);
    this.publish(true);
  }

  releaseCast() {
    const p = this.sim.state.phase;
    if (p === 'charging') this.sim.releaseCharge();
    else if (p === 'fighting') this.sim.setReeling(false);
    this.publish(true);
  }

  aimBy(dyaw: number) {
    this.yaw = clamp(this.yaw + dyaw, -1.75, 1.75);
  }

  resolveResult(action: 'keep' | 'release') {
    this.audio.resume();
    const hadResult = !!this.sim.state.result;
    this.sim.resolveResult(action);
    if (hadResult) this.detachPreview();
    this.publish(true);
  }

  setSetting<K extends keyof SimSaveSettings>(key: K, value: SimSaveSettings[K]) {
    this.sim.save.settings[key] = value;
    if (key === 'sound') this.audio.setEnabled(!!value);
    if (key === 'quality') this.applyQuality(value as Quality);
    this.sim.flush();
    this.publish(true);
  }

  resetProgress() {
    this.sim.save = {
      ...this.sim.save,
      money: 640,
      xp: 0,
      rodId: 'rod_bamboo',
      lineId: 'line_35',
      netId: 'net_6',
      bait: { cherv: 12, oparysh: 10, kukuruza: 8, zhivets: 4 },
      selectedBait: 'cherv',
      keepnet: [],
      records: {},
      history: [],
      totalCaught: 0,
      totalReleased: 0,
      totalWeight: 0,
      bestCatch: null,
    };
    this.sim.flush();
    this.publish(true);
  }

  /** Rotating 3D preview for the catch result panel. */
  attachPreview(canvas: HTMLCanvasElement, species: SpeciesId, lengthCm: number) {
    this.detachPreview();
    this.previewCanvas = canvas;
    if (!this.previewRenderer) {
      this.previewRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      this.previewRenderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.previewRenderer.outputColorSpace = THREE.SRGBColorSpace;
      const key = new THREE.DirectionalLight(0xfff0d8, 2.2);
      key.position.set(1.4, 2.2, 1.8);
      const fill = new THREE.HemisphereLight(0xcfe6f2, 0x3d4a2e, 0.9);
      this.previewScene.add(key, fill);
    }
    this.previewFish = buildFish(SPECIES[species], lengthCm);
    this.previewFish.group.position.set(0, 0, 0);
    this.previewScene.add(this.previewFish.group);
    const span = Math.max(0.35, lengthCm / 100);
    this.previewCam.position.set(0, span * 0.5, span * 2.4);
    this.previewCam.lookAt(0, 0, 0);
    const pw = canvas.clientWidth || 240;
    const ph = canvas.clientHeight || 180;
    this.previewRenderer.setSize(pw, ph, false);
    this.previewCam.aspect = pw / ph;
    this.previewCam.updateProjectionMatrix();
  }

  detachPreview() {
    if (this.previewFish) {
      this.previewScene.remove(this.previewFish.group);
      this.previewFish.dispose();
      this.previewFish = null;
    }
    this.previewCanvas = null;
    if (this.previewRenderer) {
      this.previewRenderer.dispose();
      this.previewRenderer = null;
    }
    this.previewScene.clear();
  }

  /* ---------------------------------- loop --------------------------------- */

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.tick(dt);
  };

  private tick(dt: number) {
    this.time += dt;
    if (!this.paused) this.sim.step(dt);

    // camera + aim
    const cam = this.world.camera;
    cam.rotation.y = this.yaw;
    cam.rotation.x = this.pitch;
    const dirX = -Math.sin(this.yaw);
    const dirZ = -Math.cos(this.yaw);
    this.sim.setAim(dirX, dirZ);

    const st = this.sim.state;
    const target = st.target;
    const fish = st.fish;
    const visual: import('./world').SimVisualState = {
      phase: st.phase,
      hour: st.hour,
      wind: st.wind,
      weather: st.weather,
      power: st.power,
      castT: st.castT,
      retrieveT: st.retrieveT,
      aimDirX: dirX,
      aimDirZ: dirZ,
      rigDistance: st.rig?.distance ?? 0,
      floatDip: st.floatDip,
      floatSink: st.floatSink,
      floatSlide: st.floatSlide,
      tension: st.tension,
      biteStrength: st.biteStrength,
      fishDistance: fish?.distance ?? 0,
      fishAngle: fish?.angle ?? 0,
      fishBurst: fish?.burst ?? 0,
      targetOnLand: !!target?.onLand,
      targetX: target?.x ?? 0,
      targetZ: target?.z ?? 0,
      hasTarget: !!target,
      hasRig: !!st.rig,
      hasFish: !!fish,
    };
    this.handleEvents();
    this.world.update(dt, visual, this.yaw);
    this.audio.setWind(st.wind);
    if (!this.paused) this.audio.ambient(dt, st.hour, st.wind);

    // draw
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, size.x, size.y);
    this.world.rod.group.visible = true;
    this.renderer.render(this.world.scene, this.world.camera);

    const showPip =
      this.sim.save.settings.floatView &&
      (st.phase === 'waiting' || st.phase === 'investigating' || st.phase === 'strike' || st.phase === 'fighting') &&
      this.world.float.group.visible;
    if (showPip) {
      this.world.updatePip();
      const cssW = this.container.clientWidth || 1;
      const cssH = this.container.clientHeight || 1;
      const scale = size.x / Math.max(1, cssW);
      const w = Math.round(PIP_W * scale);
      const h = Math.round(PIP_H * scale);
      const x = Math.round(size.x - w - 10 * scale);
      const y = Math.round(size.y - (cssH * 0.3 + PIP_H) * scale);
      this.renderer.setScissorTest(true);
      this.renderer.setScissor(x - 3, y - 3, w + 6, h + 6);
      this.renderer.setViewport(x - 3, y - 3, w + 6, h + 6);
      this.renderer.clear(true, true, false);
      this.world.rod.group.visible = false;
      this.renderer.setScissor(x, y, w, h);
      this.renderer.setViewport(x, y, w, h);
      this.renderer.clearDepth();
      this.renderer.render(this.world.scene, this.world.pipCamera);
      this.world.rod.group.visible = true;
      this.renderer.setScissorTest(false);
    }

    if (this.previewRenderer && this.previewFish && this.previewCanvas) {
      this.previewFish.group.rotation.y = this.time * 0.75;
      this.previewFish.setWiggle(this.time * 3.2);
      this.previewRenderer.clear();
      this.previewRenderer.render(this.previewScene, this.previewCam);
    }

    this.hudTimer += dt;
    if (this.hudTimer > 0.07) {
      this.hudTimer = 0;
      this.publish(false);
    }
  }

  private handleEvents() {
    const events = this.sim.drainEvents();
    if (events.length === 0) return;
    let needPublish = false;
    for (const e of events) {
      switch (e.type) {
        case 'phase':
          needPublish = true;
          break;
        case 'message':
          needPublish = true;
          break;
        case 'castStarted':
          this.audio.castWhoosh();
          break;
        case 'castLanded':
          break;
        case 'splash':
          this.world.ripples.spawn(e.x, 0, e.z, 0.9 + e.power * 2.2, 1.4 + e.power, clamp01(e.power));
          if (e.power > 0.35) {
            this.world.splashes.burst(e.x, 0.05, e.z, e.power * 0.8, 0.8 + e.power);
            this.audio.splash(clamp(e.power, 0.2, 1.2));
          }
          break;
        case 'biteStart':
          needPublish = true;
          break;
        case 'biteCommit':
          this.audio.bite();
          break;
        case 'tick':
          this.audio.tick(e.strength);
          break;
        case 'hooked': {
          const f = this.sim.state.fish;
          if (f) this.world.showHookedFish(f.species, f.length);
          this.audio.hookSet();
          const hint = this.sim.pendingHint();
          if (hint) this.world.hideShadowFish();
          needPublish = true;
          break;
        }
        case 'run':
          this.audio.strain(clamp01(e.power));
          break;
        case 'lineSnapped':
          this.audio.snap();
          this.world.hideHookedFish();
          needPublish = true;
          break;
        case 'fishEscaped':
          this.audio.splashOut();
          this.world.hideHookedFish();
          needPublish = true;
          break;
        case 'landed':
          this.audio.caught(e.fish.trophy);
          this.world.hideHookedFish();
          if (this.sim.state.rig) {
            this.world.ripples.spawn(this.sim.state.rig.x, 0, this.sim.state.rig.z, 3, 2, 1);
          }
          needPublish = true;
          break;
        case 'missed':
        case 'scared':
        case 'baitStolen':
          this.audio.splashOut();
          this.world.hideShadowFish();
          needPublish = true;
          break;
        case 'rigRetrieved':
          this.world.hideShadowFish();
          needPublish = true;
          break;
        case 'levelUp':
          this.audio.caught(true);
          needPublish = true;
          break;
        case 'purchased':
          this.audio.uiClick();
          needPublish = true;
          break;
        case 'sold':
          this.audio.uiClick();
          needPublish = true;
          break;
        case 'dirty':
          needPublish = true;
          break;
      }
    }
    // shadow fish follows the bite phase, reel clicks follow the reeling state
    if (this.sim.state.phase === 'investigating') {
      const hint = this.sim.pendingHint();
      if (hint) this.world.showShadowFish(hint.species, hint.length);
    } else {
      this.world.hideShadowFish();
    }
    if (this.sim.state.phase === 'fighting' && this.sim.state.reeling) {
      this.reelTick += 1;
      if (this.reelTick % 4 === 0) this.audio.reelClick();
    } else {
      this.reelTick = 0;
    }
    if (needPublish) this.publish(true);
  }

  private publish(_force: boolean) {
    this.cb.onHud(this.sim.snapshot());
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const [t, type, handler, opts] of this.listeners) {
      t.removeEventListener(type, handler, opts);
    }
    this.listeners = [];
    this.ro?.disconnect();
    this.sim.flush();
    this.detachPreview();
    this.world.dispose();
    this.audio.dispose();
    this.renderer.dispose();
    if (this.canvas.parentElement === this.container) this.container.removeChild(this.canvas);
  }
}

type SimSaveSettings = import('@/game/types').Settings;

export type { SimSaveSettings };
