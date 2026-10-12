import {
  BAITS,
  BAIT_MAP,
  KEEPNETS,
  LINES,
  RODS,
  SPECIES,
  SPECIES_MAP,
  catchXp,
  fishValue,
  pickSpecies,
  sampleWeight,
  weightToLength,
  zoneForDepth,
} from "./data";
import { defaultProfile, saveProfile } from "./save";
import {
  PLAYER_EYE,
  PLAYER_POS,
  castRayToWater,
  flatDistance,
  isInReeds,
  terrainHeight,
  waterDepth,
} from "./terrain";
import type {
  AimInfo,
  BaitId,
  FightData,
  FishInstance,
  FloatState,
  FxEvent,
  Phase,
  Profile,
  RigPos,
  SimEvent,
  SimSnapshot,
  WeatherId,
  ZoneId,
} from "./types";

const GAME_TIME_SCALE = 1 / 60;
const MAX_LINE_LENGTH = 65;
const LANDING_DISTANCE = 2.3;
const ROD_TIP_HEIGHT = 1.9;

function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v));
}

function hashDay(day: number): number {
  const s = Math.sin(day * 91.7 + 3.3) * 43758.5453;
  return s - Math.floor(s);
}

function weatherForDay(day: number): WeatherId {
  const r = hashDay(day);
  if (r < 0.48) return "clear";
  if (r < 0.8) return "cloudy";
  return "rain";
}

interface PendingFish {
  speciesId: string;
  weight: number;
  length: number;
}

interface FightState {
  fish: PendingFish;
  distance: number;
  baseDistance: number;
  stamina: number;
  tension: number;
  drag: number;
  behavior: "run" | "cross" | "rest";
  behaviorT: number;
  lateral: number;
  lateralVel: number;
  dirX: number;
  dirZ: number;
  perpX: number;
  perpZ: number;
  criticalT: number;
  slackT: number;
  thrashT: number;
  nextThrashIn: number;
  jumpT: number;
  jumpDur: number;
  nextJumpIn: number;
  hookRunT: number;
  shoreLock: number;
  prevX: number;
  prevZ: number;
  heading: number;
  totalT: number;
}

export class FishingSim {
  profile: Profile;
  phase: Phase = "ready";
  paused = false;
  attachedBait: BaitId | null = null;

  private yaw = 0.06;
  private pitch = -0.14;
  private aim: AimInfo | null = null;
  private chargeT = 0;
  private power = 0;

  private castDirX = 0;
  private castDirZ = -1;
  private castDistance = 0;
  private castPoint = { x: 0, z: 0 };
  private castZone: ZoneId | null = null;
  private castDepth = 0;

  private flightT = 0;
  private flightDur = 0;
  private flightFrom = { x: 0, y: 2, z: 0 };
  private flightTo = { x: 0, y: 0, z: 0 };
  private flightHeight = 3;

  private biteTimer = 0;
  private nibbleTimer = 0;
  private nibblePulse = 0;
  private investigateT = 0;
  private investigateDur = 0;
  private strikeT = 0;
  private strikeWindow = 1;
  private pendingFish: PendingFish | null = null;
  private fight: FightState | null = null;

  private retrieveT = 0;
  private retrieveDur = 1;
  private retrieveFrom = { x: 0, y: 0, z: 0 };
  private retrieveTo = { x: 0, y: 0, z: 0 };

  private fxQueue: FxEvent[] = [];
  private listeners = new Set<(e: SimEvent) => void>();
  private events: SimEvent[] = [];

  constructor(profile: Profile) {
    this.profile = profile;
  }

  on(cb: (e: SimEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(e: SimEvent): void {
    this.events.push(e);
  }

  private flush(): void {
    if (this.events.length === 0) return;
    const evts = this.events;
    this.events = [];
    for (const e of evts) {
      for (const cb of this.listeners) cb(e);
    }
  }

  drainFx(): FxEvent[] {
    const q = this.fxQueue;
    this.fxQueue = [];
    return q;
  }

  get weather(): WeatherId {
    return weatherForDay(Math.floor(this.profile.gameHours / 24));
  }

  get timeHour(): number {
    return this.profile.gameHours;
  }

  get rod() {
    return RODS[this.profile.rodIndex];
  }

  get line() {
    return LINES[this.profile.lineIndex];
  }

  get keepnet() {
    return KEEPNETS[this.profile.keepnetIndex];
  }

  get currentDrag(): number {
    return clamp(this.profile.drag, 1, this.rod.maxDrag);
  }

  setView(yaw: number, pitch: number): void {
    this.yaw = yaw;
    this.pitch = clamp(pitch, -1.15, 0.55);
  }

  getView(): { yaw: number; pitch: number } {
    return { yaw: this.yaw, pitch: this.pitch };
  }

  private playerPos() {
    return { x: PLAYER_POS.x, y: terrainHeight(PLAYER_POS.x, PLAYER_POS.z) + PLAYER_EYE, z: PLAYER_POS.z };
  }

  updateAim(): AimInfo {
    const origin = this.playerPos();
    const ray = castRayToWater(origin, this.yaw, this.pitch, this.rod.castRange + 40);
    const dist = flatDistance(origin.x, origin.z, ray.point.x, ray.point.z);
    const depth = waterDepth(ray.point.x, ray.point.z);
    const valid = ray.hitWater;
    const aim: AimInfo = {
      valid,
      distance: dist,
      x: ray.point.x,
      z: ray.point.z,
      depth,
      zone: valid ? zoneForDepth(depth) : null,
    };
    return aim;
  }

  // ————— input —————

  primaryDown(): void {
    if (this.paused) return;
    switch (this.phase) {
      case "ready":
        this.startCharging();
        break;
      case "investigating":
        this.spookFish();
        break;
      case "strike":
        this.hookFish();
        break;
      case "fighting":
        this.setReeling(true);
        break;
      default:
        break;
    }
  }

  primaryUp(): void {
    if (this.paused) return;
    if (this.phase === "charging") {
      this.doCast();
    } else if (this.phase === "fighting") {
      this.setReeling(false);
    }
  }

  cancelCharge(): void {
    if (this.phase !== "charging") return;
    this.chargeT = 0;
    this.power = 0;
    this.setPhase("ready");
  }

  private setReeling(on: boolean): void {
    if (this.fight) this.reelingActive = on;
  }

  reelingActive = false;

  private startCharging(): void {
    if (this.profile.bait[this.profile.selectedBait] <= 0) {
      this.message("Наживка закончилась. Купите новую в магазине.", "bad");
      return;
    }
    this.chargeT = 0;
    this.power = 0;
    this.setPhase("charging");
  }

  private doCast(): void {
    this.chargeT = 0;
    const aim = this.updateAim();
    if (!aim.valid) {
      this.power = 0;
      this.message("Нельзя забросить на берег — цельтесь в воду.", "bad");
      this.setPhase("ready");
      return;
    }
    const dirX = aim.x - PLAYER_POS.x;
    const dirZ = aim.z - PLAYER_POS.z;
    const len = Math.hypot(dirX, dirZ) || 1;
    this.castDirX = dirX / len;
    this.castDirZ = dirZ / len;

    const wanted = Math.max(2.5, this.power * this.rod.castRange);
    const dist = Math.min(wanted, aim.distance === 0 ? wanted : aim.distance);
    this.castDistance = dist;
    this.castPoint = {
      x: PLAYER_POS.x + this.castDirX * dist,
      z: PLAYER_POS.z + this.castDirZ * dist,
    };
    this.castDepth = waterDepth(this.castPoint.x, this.castPoint.z);
    this.castZone = zoneForDepth(this.castDepth);

    const origin = this.playerPos();
    this.flightFrom = { x: origin.x, y: origin.y + 0.4, z: origin.z };
    this.flightTo = { x: this.castPoint.x, y: 0, z: this.castPoint.z };
    this.flightDur = 0.45 + this.power * 0.45 + dist * 0.012;
    this.flightHeight = 2.2 + this.power * 3.2 + dist * 0.03;
    this.flightT = 0;
    this.power = 0;
    this.setPhase("casting");
  }

  startRetrieve(): void {
    if (this.paused) return;
    if (!(this.phase === "waiting" || this.phase === "investigating")) return;
    const shoreX = PLAYER_POS.x + this.castDirX * 2;
    const shoreZ = PLAYER_POS.z + this.castDirZ * 2;
    this.retrieveFrom = { x: this.castPoint.x, y: 0, z: this.castPoint.z };
    this.retrieveTo = { x: shoreX, y: 0, z: shoreZ };
    this.retrieveT = 0;
    this.retrieveDur = Math.max(0.9, this.castDistance / 4.2);
    this.setPhase("retrieving");
    this.emit({ type: "sound", name: "reelStart" });
  }

  selectBait(id: BaitId): boolean {
    if (this.phase !== "ready") {
      this.message("Сначала вымотайте снасть, потом меняйте наживку.", "info");
      return false;
    }
    this.profile.selectedBait = id;
    this.emit({ type: "profile" });
    return true;
  }

  adjustDrag(delta: number): void {
    this.profile.drag = clamp(this.profile.drag + delta, 1, this.rod.maxDrag);
    this.emit({ type: "profile" });
  }

  setDrag(value: number): void {
    this.profile.drag = clamp(value, 1, this.rod.maxDrag);
    this.emit({ type: "profile" });
  }

  buy(itemId: string): { ok: boolean; msg: string } {
    const [kind, key] = itemId.split(":");
    const p = this.profile;
    if (kind === "bait") {
      const def = BAIT_MAP[key as BaitId];
      if (!def) return { ok: false, msg: "Товар не найден" };
      if (p.money < def.pricePer10) return { ok: false, msg: "Недостаточно денег" };
      p.money -= def.pricePer10;
      p.bait[def.id] += 10;
      this.message(`Куплено: ${def.nameRu} ×10`, "good");
      this.emit({ type: "profile" });
      return { ok: true, msg: "Куплено" };
    }
    if (kind === "rod" || kind === "line" || kind === "keepnet") {
      const list = kind === "rod" ? RODS : kind === "line" ? LINES : KEEPNETS;
      const idx = parseInt(key, 10);
      const def = list[idx];
      if (!def) return { ok: false, msg: "Товар не найден" };
      const cur = kind === "rod" ? p.rodIndex : kind === "line" ? p.lineIndex : p.keepnetIndex;
      if (idx <= cur) return { ok: false, msg: "Уже куплено" };
      if (idx !== cur + 1) return { ok: false, msg: "Сначала купите предыдущий уровень" };
      if (p.money < def.price) return { ok: false, msg: "Недостаточно денег" };
      p.money -= def.price;
      if (kind === "rod") {
        p.rodIndex = idx;
        p.drag = clamp(p.drag, 1, RODS[idx].maxDrag);
      } else if (kind === "line") {
        p.lineIndex = idx;
      } else {
        p.keepnetIndex = idx;
      }
      this.message(`Куплено: ${def.nameRu}`, "good");
      this.emit({ type: "profile" });
      return { ok: true, msg: "Куплено" };
    }
    return { ok: false, msg: "Товар не найден" };
  }

  sellAll(): { ok: boolean; total: number } {
    const p = this.profile;
    if (p.keepnet.length === 0) return { ok: false, total: 0 };
    const total = p.keepnet.reduce((a, f) => a + f.value, 0);
    p.money += total;
    p.stats.totalSold += p.keepnet.length;
    p.stats.totalEarned += total;
    for (const f of p.keepnet) {
      p.history.push({
        speciesId: f.speciesId,
        weight: f.weight,
        length: f.length,
        atHour: f.caughtAtHour,
        outcome: "sold",
      });
    }
    p.keepnet = [];
    this.message(`Рыба продана за ${total} ₽`, "good");
    this.emit({ type: "profile" });
    return { ok: true, total };
  }

  keepFish(): boolean {
    if (this.phase !== "result" || !this.resultFish) return false;
    const p = this.profile;
    if (p.keepnet.length >= this.keepnet.capacity) {
      this.message("Садок полон! Отпустите рыбу или продайте улов.", "bad");
      return false;
    }
    const f = this.resultFish;
    p.keepnet.push({
      speciesId: f.speciesId,
      weight: f.weight,
      length: f.length,
      value: f.value,
      caughtAtHour: f.caughtAtHour,
      baitId: f.baitId,
    });
    const xp = catchXp(SPECIES_MAP[f.speciesId], f.weight, f.isTrophy);
    this.addXp(xp, false);
    p.history.push({
      speciesId: f.speciesId,
      weight: f.weight,
      length: f.length,
      atHour: f.caughtAtHour,
      outcome: "kept",
    });
    this.resultFish = null;
    this.message(`Отправлено в садок: ${SPECIES_MAP[f.speciesId].nameRu}.`, "good");
    this.emit({ type: "profile" });
    this.setPhase("ready");
    return true;
  }

  releaseFish(): boolean {
    if (this.phase !== "result" || !this.resultFish) return false;
    const p = this.profile;
    const f = this.resultFish;
    const xp = Math.round(catchXp(SPECIES_MAP[f.speciesId], f.weight, f.isTrophy) * 1.3);
    this.addXp(xp, true);
    p.history.push({
      speciesId: f.speciesId,
      weight: f.weight,
      length: f.length,
      atHour: f.caughtAtHour,
      outcome: "released",
    });
    this.resultFish = null;
    this.message(`Отпущено: ${SPECIES_MAP[f.speciesId].nameRu}. +${xp} опыта`, "good");
    this.emit({ type: "profile" });
    this.setPhase("ready");
    return true;
  }

  private addXp(xp: number, released: boolean): void {
    const p = this.profile;
    const levelBefore = this.levelFor(p.xp);
    p.xp += xp;
    const levelAfter = this.levelFor(p.xp);
    if (levelAfter > levelBefore) {
      this.message(`Новый уровень: ${levelAfter}!`, "good");
      this.emit({ type: "sound", name: "levelup" });
    }
    if (released) p.stats.totalReleased += 1;
  }

  levelFor(xp: number): number {
    let level = 1;
    let remaining = xp;
    while (true) {
      const need = 120 + (level - 1) * 90;
      if (remaining < need) return level;
      remaining -= need;
      level++;
    }
  }

  setSettings(partial: Partial<Profile["settings"]>): void {
    this.profile.settings = { ...this.profile.settings, ...partial };
    this.emit({ type: "profile" });
  }

  resetProgress(): void {
    const settings = this.profile.settings;
    const fresh = defaultProfile();
    fresh.settings = settings;
    this.profile = fresh;
    this.phase = "ready";
    this.attachedBait = null;
    this.fight = null;
    this.resultFish = null;
    this.message("Прогресс сброшен", "info");
    this.emit({ type: "profile" });
    saveProfile(this.profile);
  }

  save(): void {
    saveProfile(this.profile);
  }

  // ————— messages & fish —————

  private message(text: string, kind: "info" | "good" | "bad"): void {
    this.emit({ type: "message", text, kind });
  }

  private setPhase(p: Phase): void {
    if (p === this.phase) return;
    this.phase = p;
    if (p !== "fighting") this.reelingActive = false;
    this.emit({ type: "phase", phase: p });
  }

  // ————— bite sequence —————

  private scheduleBite(): void {
    const bait = this.attachedBait ?? this.profile.selectedBait;
    const hour = this.profile.gameHours;
    const { quality } = pickSpecies(bait, this.castZone ?? "open", hour, this.weather);
    const q = clamp(quality / 1.35, 0, 1);
    const t = Math.min(34, 8 + 20 * (1 - q));
    this.biteTimer = t * (0.75 + Math.random() * 0.6);
    this.nibbleTimer = 3 + Math.random() * 6;
  }

  private startInvestigation(): void {
    const bait = this.attachedBait ?? this.profile.selectedBait;
    const hour = this.profile.gameHours;
    const { sp } = pickSpecies(bait, this.castZone ?? "open", hour, this.weather);
    const weight = sampleWeight(sp);
    const length = weightToLength(sp, weight);
    this.pendingFish = { speciesId: sp.id, weight, length };
    this.investigateT = 0;
    this.investigateDur = 2.6 + Math.random() * 2.6;
    this.setPhase("investigating");
    this.emit({ type: "sound", name: "nibble" });
    this.fxQueue.push({ kind: "ripple", x: this.castPoint.x, z: this.castPoint.z, power: 0.5 });
  }

  private spookFish(): void {
    this.pendingFish = null;
    this.setPhase("waiting");
    this.scheduleBite();
    this.biteTimer *= 1.15;
    this.message("Рано подсекли — рыба испугалась и ушла.", "bad");
    this.emit({ type: "sound", name: "spook" });
    this.fxQueue.push({ kind: "ripple", x: this.castPoint.x, z: this.castPoint.z, power: 0.8 });
  }

  private stealBait(): void {
    this.pendingFish = null;
    this.attachedBait = null;
    this.setPhase("waiting");
    this.scheduleBite();
    this.message("Поздно! Рыба утащила наживку.", "bad");
    this.emit({ type: "sound", name: "steal" });
    if (this.profile.bait[this.profile.selectedBait] <= 0) {
      this.message("Наживка закончилась. Купите новую в магазине.", "bad");
    }
    this.emit({ type: "profile" });
  }

  private hookFish(): void {
    if (!this.pendingFish) {
      this.setPhase("waiting");
      this.scheduleBite();
      return;
    }
    const fish = this.pendingFish;
    const perpX = -this.castDirZ;
    const perpZ = this.castDirX;
    const drag = this.currentDrag;
    this.fight = {
      fish,
      distance: this.castDistance + 2,
      baseDistance: this.castDistance + 2,
      stamina: 1,
      tension: 0.05,
      drag,
      behavior: "run",
      behaviorT: 1.4,
      lateral: 0,
      lateralVel: (Math.random() < 0.5 ? -1 : 1) * 0.8,
      dirX: this.castDirX,
      dirZ: this.castDirZ,
      perpX,
      perpZ,
      criticalT: 0,
      slackT: 0,
      thrashT: 0,
      nextThrashIn: 3 + Math.random() * 4,
      jumpT: 0,
      jumpDur: 0.6,
      nextJumpIn: 4 + Math.random() * 5,
      hookRunT: 1.5,
      shoreLock: 0,
      prevX: this.castPoint.x,
      prevZ: this.castPoint.z,
      heading: 0,
      totalT: 0,
    };
    this.attachedBait = null;
    this.pendingFish = null;
    this.setPhase("fighting");
    this.emit({ type: "sound", name: "hook" });
    this.fxQueue.push({ kind: "bigSplash", x: this.castPoint.x, z: this.castPoint.z, power: 1 });
    this.message("Есть! Рыба на крючке — вываживайте!", "good");
    this.emit({ type: "sound", name: "reelStart" });
  }

  // ————— update —————

  update(dt: number): void {
    if (this.paused) {
      this.flush();
      return;
    }
    this.profile.gameHours = (this.profile.gameHours + dt * GAME_TIME_SCALE) % 24;
    this.aim = this.phase === "ready" || this.phase === "charging" ? this.updateAim() : this.aim;

    switch (this.phase) {
      case "charging":
        this.chargeT += dt;
        this.power = clamp(this.chargeT / 1.4, 0, 1);
        break;
      case "casting":
        this.updateCasting(dt);
        break;
      case "waiting":
        this.updateWaiting(dt);
        break;
      case "investigating":
        this.updateInvestigating(dt);
        break;
      case "strike":
        this.updateStrike(dt);
        break;
      case "fighting":
        this.updateFight(dt);
        break;
      case "retrieving":
        this.updateRetrieving(dt);
        break;
      default:
        break;
    }
    this.flush();
  }

  private updateCasting(dt: number): void {
    this.flightT += dt;
    if (this.flightT >= this.flightDur) {
      this.flightT = this.flightDur;
      const bait = this.profile.selectedBait;
      if (this.profile.bait[bait] > 0) {
        this.profile.bait[bait] -= 1;
      }
      this.attachedBait = bait;
      this.emit({ type: "profile" });
      this.fxQueue.push({
        kind: "bigSplash",
        x: this.castPoint.x,
        z: this.castPoint.z,
        power: 0.4 + this.power * 0.6 + 0.3,
      });
      this.emit({ type: "sound", name: "splash" });
      this.setPhase("waiting");
      this.scheduleBite();
    }
  }

  private floatBase(time: number): number {
    return -0.02 + Math.sin(time * 1.3) * 0.012 + Math.sin(time * 0.53 + 1.7) * 0.008;
  }

  private globalT = 0;

  private updateWaiting(dt: number): void {
    this.globalT += dt;
    this.nibbleTimer -= dt;
    if (this.nibbleTimer <= 0) {
      this.nibblePulse = 1;
      this.nibbleTimer = 6 + Math.random() * 8;
      this.fxQueue.push({ kind: "ripple", x: this.castPoint.x, z: this.castPoint.z, power: 0.25 });
    }
    this.nibblePulse = Math.max(0, this.nibblePulse - dt * 1.4);
    this.biteTimer -= dt;
    if (this.biteTimer <= 0) {
      this.startInvestigation();
    }
  }

  private updateInvestigating(dt: number): void {
    this.globalT += dt;
    this.investigateT += dt;
    const p = this.investigateT / this.investigateDur;
    if (p > 0.45 && Math.random() < dt * 1.6) {
      this.fxQueue.push({ kind: "ripple", x: this.castPoint.x, z: this.castPoint.z, power: 0.4 });
      this.emit({ type: "sound", name: "nibble" });
    }
    if (this.investigateT >= this.investigateDur) {
      this.strikeT = 0;
      const sp = this.pendingFish ? SPECIES_MAP[this.pendingFish.speciesId] : SPECIES[0];
      this.strikeWindow = clamp(1.35 - sp.strength * 0.28 - Math.random() * 0.2, 0.7, 1.4);
      this.setPhase("strike");
      this.emit({ type: "sound", name: "bite" });
      this.fxQueue.push({ kind: "bubbles", x: this.castPoint.x, z: this.castPoint.z, power: 1 });
      this.fxQueue.push({ kind: "ripple", x: this.castPoint.x, z: this.castPoint.z, power: 0.9 });
    }
  }

  private updateStrike(dt: number): void {
    this.globalT += dt;
    this.strikeT += dt;
    if (this.strikeT >= this.strikeWindow) {
      this.stealBait();
    }
  }

  private updateRetrieving(dt: number): void {
    this.globalT += dt;
    this.retrieveT += dt;
    if (this.retrieveT >= this.retrieveDur) {
      if (this.attachedBait) {
        this.profile.bait[this.attachedBait] += 1;
        this.attachedBait = null;
        this.emit({ type: "profile" });
      }
      this.fxQueue.push({ kind: "ripple", x: this.retrieveTo.x, z: this.retrieveTo.z, power: 0.5 });
      this.setPhase("ready");
    }
  }

  resultFish: FishInstance | null = null;

  private updateFight(dt: number): void {
    const f = this.fight;
    if (!f) return;
    this.globalT += dt;
    f.totalT += dt;
    const sp = SPECIES_MAP[f.fish.speciesId];
    const lineRating = this.line.ratingKg;

    // behavior switching
    f.behaviorT -= dt;
    if (f.behaviorT <= 0) {
      const r = Math.random();
      const runChance = 0.24 + f.stamina * 0.22;
      if (r < runChance) {
        f.behavior = "run";
        f.behaviorT = 1.1 + Math.random() * 1.6;
      } else if (r < runChance + 0.42) {
        f.behavior = "cross";
        f.behaviorT = 2 + Math.random() * 2.2;
        f.lateralVel = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 1.1);
      } else {
        f.behavior = "rest";
        f.behaviorT = 1.6 + Math.random() * 2.4;
      }
    }

    // thrash bursts
    f.nextThrashIn -= dt;
    if (f.nextThrashIn <= 0 && f.stamina > 0.12) {
      f.thrashT = 0.75;
      f.nextThrashIn = 3.5 + Math.random() * 5;
      this.fxQueue.push({ kind: "splash", x: this.castPoint.x, z: this.castPoint.z, power: 0.7 });
      this.emit({ type: "sound", name: "splashSoft" });
    }
    f.thrashT = Math.max(0, f.thrashT - dt);

    // jumps
    f.nextJumpIn -= dt;
    if (f.nextJumpIn <= 0 && f.stamina < 0.75) {
      f.jumpT = f.jumpDur;
      f.nextJumpIn = 5 + Math.random() * 6;
      const pos = this.fishWorldPos(f);
      this.fxQueue.push({ kind: "bigSplash", x: pos.x, z: pos.z, power: 0.8 });
      this.emit({ type: "sound", name: "splashSoft" });
    }
    f.jumpT = Math.max(0, f.jumpT - dt);

    const phaseMult = f.behavior === "run" ? 2.35 : f.behavior === "cross" ? 1.15 : 0.42;
    const thrashMult = f.thrashT > 0 ? 1.5 : 1;
    const staminaFactor = 0.5 + 0.5 * f.stamina;
    const hookRun = f.hookRunT > 0 ? 1.25 : 1;
    f.hookRunT = Math.max(0, f.hookRunT - dt);

    const F =
      ((sp.strength * Math.pow(f.fish.weight, 0.6)) / 2.6) *
      phaseMult *
      staminaFactor *
      thrashMult *
      hookRun;

    const dragKg = clamp(f.drag, 1, this.rod.maxDrag);
    const dragFactor = 0.55 + 0.45 * (dragKg / 12);
    const reeling = this.reelingActive;
    const baseT = F / lineRating;
    const isCritical = f.tension > 0.98;
    const reelExtra = reeling ? (isCritical ? 0.02 : 0.1 + 0.22 * (dragKg / 12)) : 0.02;
    const tensionTarget = baseT * dragFactor + reelExtra;
    f.tension += (tensionTarget - f.tension) * Math.min(1, dt * 4.5);
    f.tension = clamp(f.tension, 0, 1.6);

    // line movement
    let take = Math.max(0, F - dragKg * 0.8) * 1.15;
    if (f.tension > 1.0) take *= 1.5;
    take = Math.min(take, 3.2);
    let reel = 0;
    if (reeling && f.tension < 1.02) {
      reel = this.rod.reelSpeed * (1 - 0.52 * clamp(f.tension, 0, 1));
    }
    f.distance = clamp(f.distance + (take - reel) * dt, 1.2, MAX_LINE_LENGTH + 5);
    if (f.distance >= MAX_LINE_LENGTH) {
      this.breakLine(f, "Рыба размотала всю леску и оборвала снасть!");
      return;
    }

    // stamina
    if (f.behavior === "rest" && f.tension < 0.38) {
      f.stamina = Math.min(1, f.stamina + 0.045 * dt);
    } else {
      const drain = (0.035 + 0.085 * clamp(f.tension, 0, 1)) / sp.stamina;
      f.stamina = Math.max(0, f.stamina - drain * dt);
    }

    // critical & slack
    if (f.tension > 0.98) {
      f.criticalT += dt;
    } else {
      f.criticalT = Math.max(0, f.criticalT - dt * 0.6);
    }
    if (f.criticalT > 1.3) {
      this.breakLine(f);
      return;
    }
    if (f.tension < 0.09 && !reeling) {
      f.slackT += dt;
      if (f.slackT > 5 && Math.random() < 0.3 * dt) {
        this.escapeFish("Леска провисла — рыба сошла с крючка!");
        return;
      }
    } else {
      f.slackT = Math.max(0, f.slackT - dt * 2);
    }

    // lateral movement
    if (f.behavior === "cross") {
      f.lateral += f.lateralVel * dt;
    } else if (f.behavior === "run") {
      f.lateral += f.lateralVel * 0.25 * dt;
    }
    f.lateral *= 1 - 0.22 * dt;
    f.lateral = clamp(f.lateral, -10, 10);
    if (f.distance < 5) f.lateral *= 1 - 0.9 * dt;

    // landing check
    if (f.distance <= LANDING_DISTANCE && f.shoreLock <= 0) {
      const smallFish = f.fish.weight <= 0.35;
      if (f.stamina <= 0.45 || smallFish) {
        this.landFish(f);
        return;
      }
      f.shoreLock = 2;
      f.behavior = "run";
      f.behaviorT = 1.4;
      this.fxQueue.push({ kind: "bigSplash", x: this.castPoint.x, z: this.castPoint.z, power: 0.9 });
      this.message("Рыба не даётся — у самого берега рванула в глубину!", "bad");
      this.emit({ type: "sound", name: "splashSoft" });
    }
    f.shoreLock = Math.max(0, f.shoreLock - dt);

    // heading from movement
    const pos = this.fishWorldPos(f);
    const dx = pos.x - f.prevX;
    const dz = pos.z - f.prevZ;
    if (dx * dx + dz * dz > 1e-6) {
      f.heading = Math.atan2(dx, dz);
    }
    f.prevX = pos.x;
    f.prevZ = pos.z;
  }

  private fishWorldPos(f: FightState): { x: number; z: number } {
    return {
      x: PLAYER_POS.x + f.dirX * f.distance + f.perpX * f.lateral,
      z: PLAYER_POS.z + f.dirZ * f.distance + f.perpZ * f.lateral,
    };
  }

  private breakLine(f: FightState, customMsg?: string): void {
    this.profile.history.push({
      speciesId: f.fish.speciesId,
      weight: f.fish.weight,
      length: f.fish.length,
      atHour: this.profile.gameHours,
      outcome: "broke",
    });
    this.message(customMsg ?? "Леска оборвалась! Рыба ушла — проверьте фрикцион.", "bad");
    this.fight = null;
    this.attachedBait = null;
    this.emit({ type: "sound", name: "break" });
    this.setPhase("ready");
    this.emit({ type: "profile" });
  }

  private escapeFish(msg: string): void {
    if (!this.fight) return;
    const f = this.fight;
    this.profile.history.push({
      speciesId: f.fish.speciesId,
      weight: f.fish.weight,
      length: f.fish.length,
      atHour: this.profile.gameHours,
      outcome: "escaped",
    });
    this.message(msg, "bad");
    this.fight = null;
    this.attachedBait = null;
    this.emit({ type: "sound", name: "escape" });
    this.setPhase("ready");
    this.emit({ type: "profile" });
  }

  private landFish(f: FightState): void {
    const sp = SPECIES_MAP[f.fish.speciesId];
    const weight = f.fish.weight;
    const length = f.fish.length;
    const value = fishValue(sp, weight);
    const isTrophy = weight >= sp.trophyW;
    const prev = this.profile.records[sp.id];
    const isRecord = !prev || weight > prev.weight;
    if (isRecord) {
      this.profile.records[sp.id] = {
        weight,
        length,
        atHour: this.profile.gameHours,
        baitId: this.profile.selectedBait,
      };
    }
    const fish: FishInstance = {
      speciesId: sp.id,
      weight,
      length,
      value,
      caughtAtHour: this.profile.gameHours,
      baitId: (this.attachedBait ?? this.profile.selectedBait) as BaitId,
      zone: this.castZone ?? "open",
      isRecord,
      isTrophy,
    };
    const p = this.profile;
    p.stats.totalCaught += 1;
    if (weight > p.stats.biggestWeight) {
      p.stats.biggestWeight = weight;
      p.stats.biggestSpeciesId = sp.id;
    }
    this.resultFish = fish;
    this.fight = null;
    this.reelingActive = false;
    this.emit({ type: "sound", name: "land" });
    this.fxQueue.push({ kind: "bigSplash", x: PLAYER_POS.x + this.castDirX * 2.5, z: PLAYER_POS.z + this.castDirZ * 2.5, power: 1 });
    this.setPhase("result");
    this.emit({ type: "catch", fish });
    this.emit({ type: "profile" });
  }

  // ————— snapshot —————

  private rigState(): RigPos {
    switch (this.phase) {
      case "casting": {
        const p = this.flightT / this.flightDur;
        const x = this.flightFrom.x + (this.flightTo.x - this.flightFrom.x) * p;
        const z = this.flightFrom.z + (this.flightTo.z - this.flightFrom.z) * p;
        const y =
          this.flightFrom.y * (1 - p) +
          this.flightTo.y * p +
          Math.sin(Math.PI * p) * this.flightHeight;
        return { x, y, z, onWater: false, visible: true };
      }
      case "waiting":
      case "investigating":
      case "strike":
        return { x: this.castPoint.x, y: 0, z: this.castPoint.z, onWater: true, visible: true };
      case "retrieving": {
        const p = clamp(this.retrieveT / this.retrieveDur, 0, 1);
        const ease = p * p * (3 - 2 * p);
        const x = this.retrieveFrom.x + (this.retrieveTo.x - this.retrieveFrom.x) * ease;
        const z = this.retrieveFrom.z + (this.retrieveTo.z - this.retrieveFrom.z) * ease;
        const lift = p > 0.8 ? ((p - 0.8) / 0.2) * 1.6 : 0;
        return { x, y: lift, z, onWater: lift < 0.05, visible: true };
      }
      case "fighting": {
        if (!this.fight) return { x: 0, y: 0, z: 0, onWater: true, visible: true };
        const pos = this.fishWorldPos(this.fight);
        return { x: pos.x, y: -0.24, z: pos.z, onWater: true, visible: true };
      }
      default:
        return { x: 0, y: ROD_TIP_HEIGHT, z: 0, onWater: false, visible: false };
    }
  }

  private floatState(): FloatState {
    const hidden = this.phase === "fighting";
    if (this.phase === "strike") {
      const p = clamp(this.strikeT / this.strikeWindow, 0, 1);
      return {
        y: -0.42 + Math.sin(this.globalT * 17) * 0.03,
        hidden: false,
        strikeProgress: p,
        nibble: 0,
      };
    }
    if (this.phase === "investigating") {
      const p = clamp(this.investigateT / this.investigateDur, 0, 1);
      const freq = 2.2 + p * 3.6;
      const ampl = 0.03 + p * 0.16;
      const dip = Math.pow(Math.max(0, Math.sin(this.globalT * freq)), 3) * ampl;
      return {
        y: this.floatBase(this.globalT) - dip,
        hidden: false,
        strikeProgress: 0,
        nibble: p,
      };
    }
    if (this.phase === "waiting" || this.phase === "retrieving") {
      const pulse = Math.pow(this.nibblePulse, 2) * 0.12;
      const nx = this.nibblePulse > 0 ? Math.sin(this.globalT * 14) * pulse : 0;
      return {
        y: this.floatBase(this.globalT) - nx,
        hidden: this.phase === "retrieving" && this.retrieveT / this.retrieveDur > 0.8,
        strikeProgress: 0,
        nibble: this.nibblePulse,
      };
    }
    return { y: 0, hidden, strikeProgress: 0, nibble: 0 };
  }

  private fightSnapshot(): FightData | null {
    const f = this.fight;
    if (!f) return null;
    const pos = this.fishWorldPos(f);
    let fishY = -0.26;
    if (f.jumpT > 0) {
      const jp = 1 - f.jumpT / f.jumpDur;
      fishY = -0.26 + Math.sin(Math.PI * jp) * 0.55;
    }
    void pos;
    return {
      speciesId: f.fish.speciesId,
      weight: f.fish.weight,
      distance: f.distance,
      baseDistance: f.baseDistance,
      tension: f.tension,
      stamina: f.stamina,
      drag: f.drag,
      fishX: f.prevX,
      fishY,
      fishZ: f.prevZ,
      heading: f.heading,
      reeling: this.reelingActive,
      critical: f.tension > 0.98,
      warning: f.tension > 0.72,
      behavior: f.behavior,
    };
  }

  snapshot(): SimSnapshot {
    return {
      phase: this.phase,
      power: this.power,
      chargeHeldT: this.chargeT,
      aim: this.phase === "ready" || this.phase === "charging" ? this.aim : null,
      rig: this.rigState(),
      floatState: this.floatState(),
      castDistance: this.castDistance,
      castZone: this.castZone,
      castDepth: this.castDepth,
      fight: this.fightSnapshot(),
      timeHour: this.profile.gameHours,
      weather: this.weather,
      retrievingProgress:
        this.phase === "retrieving" ? clamp(this.retrieveT / this.retrieveDur, 0, 1) : 0,
    };
  }

  isReedsCast(): boolean {
    return isInReeds(this.castPoint.x, this.castPoint.z);
  }

  itemOwned(itemId: string): boolean {
    const [kind, key] = itemId.split(":");
    const p = this.profile;
    if (kind === "rod") return parseInt(key, 10) <= p.rodIndex;
    if (kind === "line") return parseInt(key, 10) <= p.lineIndex;
    if (kind === "keepnet") return parseInt(key, 10) <= p.keepnetIndex;
    return false;
  }

  nextTierPrice(kind: "rod" | "line" | "keepnet"): number | null {
    const list = kind === "rod" ? RODS : kind === "line" ? LINES : KEEPNETS;
    const cur = kind === "rod" ? this.profile.rodIndex : kind === "line" ? this.profile.lineIndex : this.profile.keepnetIndex;
    if (cur + 1 >= list.length) return null;
    return list[cur + 1].price;
  }

  itemList() {
    return { baits: BAITS, rods: RODS, lines: LINES, keepnets: KEEPNETS };
  }
}
