/**
 * Fishing simulation — pure logic, no React, no Three.js.
 * Owns the state machine, bite rolls, the fight model and all progression.
 * Every timer advances with delta time so the simulation never depends on frame rate.
 */

import { BAITS } from './bait';
import {
  LINES,
  NETS,
  RODS,
  lineById,
  netById,
  rodById,
  type LineSpec,
  type NetSpec,
  type RodSpec,
} from './equipment';
import { LAND_DIST, PLAYER_POS, isWater, spotFrom, type SpotInfo } from './lake';
import { chance, clamp, clamp01, lerp, mulberry32, weightedIndex, type Rand } from './rng';
import { SPECIES, SPECIES_ORDER, activityAt, depthFit, lengthFromWeight, rollWeight } from './species';
import { defaultSave, loadSave, persistSave, xpBounds } from './storage';
import { WEATHERS, pickWeather } from './weather';
import type {
  ActiveFish,
  BaitId,
  DragOption,
  Fish,
  GameMessage,
  HudSnapshot,
  MessageKind,
  Phase,
  SaveData,
  SimEvent,
  SpeciesId,
  SpeciesRecord,
  WeatherState,
} from './types';

export const CAST_DURATION = 1.05;
export const RETRIEVE_DURATION = 0.95;
const MINUTES_PER_SECOND = 1; // 24 in-game hours == 24 real minutes

export const PHASE_LABEL: Record<Phase, string> = {
  ready: 'Готов к забросу',
  charging: 'Набор силы заброса',
  casting: 'Заброс',
  waiting: 'Ожидание поклёвки',
  investigating: 'Рыба возится у насадки',
  strike: 'Пошёл решительный — подсекай!',
  fighting: 'Вываживание',
  result: 'Трофей',
  retrieving: 'Вынимаю снасти',
};

const BEHAVIOUR_LABEL: Record<string, string> = {
  cross: 'Отходит в сторону',
  run: 'Рывок от берега',
  rest: 'Замешкалась',
  sulk: 'Легла ко дну',
  headed: 'Идёт к берегу',
};

export interface SimState {
  phase: Phase;
  hour: number;
  weather: WeatherState;
  wind: number;

  // aiming / casting
  power: number;
  aimDirX: number;
  aimDirZ: number;
  estimatedDistance: number;
  target: SpotInfo | null;
  castT: number;
  retrieveT: number;

  // rig in the water
  rig: SpotInfo | null;
  floatDip: number; // cm
  floatSlide: number; // m
  floatSink: number; // 0..1, how far the float is pulled under

  // bite flow
  waitRemaining: number;
  waitTotal: number;
  biteProgress: number;
  biteStrength: number; // 0..1, drives the HUD pulse + audio
  strikeRemaining: number;
  strikeTotal: number;

  // fight
  fish: ActiveFish | null;
  tension: number; // % of the line's breaking load
  drag: number; // 1..10
  reeling: boolean;
  overload: number; // 0..1 — the line is about to snap
  slack: number; // seconds of a dangerously slack line
  /** short spike above the drag ceiling (a fish that turned and pulled hard) */
  shock: number;
  /** the reel is peeling line instead of winding: the drag ceiling was exceeded */
  slipping: boolean;

  // result
  result: Fish | null;

  message: GameMessage | null;
}

export interface BaitProduct {
  id: string;
  name: string;
  desc: string;
  price: number;
  bait: BaitId;
  amount: number;
  level: number;
}

export const BAIT_PRODUCTS: BaitProduct[] = (Object.keys(BAITS) as BaitId[]).map((id) => ({
  id: `bait_${id}`,
  name: `${BAITS[id].ru} · ${BAITS[id].packSize} шт.`,
  desc: BAITS[id].desc,
  price: BAITS[id].price,
  bait: id,
  amount: BAITS[id].packSize,
  level: 1,
}));

export class Simulation {
  save: SaveData;
  state: SimState;
  paused = false;
  castCount = 0;

  /** cast animation endpoints, read by the renderer */
  castFrom = { x: PLAYER_POS.x, y: 1.4, z: PLAYER_POS.z };
  castTo: SpotInfo | null = null;

  private events: SimEvent[] = [];
  private rand: Rand;
  private uid = 0;
  private msgId = 0;
  private saveTimer = 0;
  private weatherTimer = 20;
  private windPhase = Math.random() * 10;
  private pending: { species: SpeciesId; weight: number; length: number } | null = null;
  private script: { t: number; dip: number; slide: number }[] = [];
  private scriptIndex = 0;
  private investT = 0;
  private investDur = 2;
  private chargeUp = true;
  private missStreak = 0;
  private bankHint = false;

  constructor(seed = Math.floor(Math.random() * 1e9)) {
    this.rand = mulberry32(seed);
    this.save = typeof window === 'undefined' ? defaultSave() : loadSave();
    const hour = 5.4; // warm early morning
    const weather = WEATHERS.clouds; // the first light of the day is calm and golden
    this.state = {
      phase: 'ready',
      hour,
      weather,
      wind: weather.wind,
      power: 0,
      aimDirX: 0,
      aimDirZ: -1,
      estimatedDistance: this.rod.castMin,
      target: null,
      castT: 0,
      retrieveT: 0,
      rig: null,
      floatDip: 0,
      floatSlide: 0,
      floatSink: 0,
      waitRemaining: 0,
      waitTotal: 1,
      biteProgress: 0,
      biteStrength: 0,
      strikeRemaining: 0,
      strikeTotal: 1,
      fish: null,
      tension: 0,
      drag: 4,
      reeling: false,
      overload: 0,
      slack: 0,
      shock: 0,
      slipping: false,
      result: null,
      message: null,
    };
  }

  /* ------------------------------ accessors ------------------------------ */

  get rod(): RodSpec {
    return rodById(this.save.rodId);
  }
  get line(): LineSpec {
    return lineById(this.save.lineId);
  }
  get net(): NetSpec {
    return netById(this.save.netId);
  }
  get level(): number {
    return xpBounds(this.save.xp).level;
  }
  get baitLeft(): number {
    return this.save.bait[this.save.selectedBait] ?? 0;
  }

  /** The locked-in fish, exposed only so the renderer can show it circling the bait. */
  pendingHint(): { species: SpeciesId; length: number } | null {
    if (!this.pending) return null;
    const p = this.state.phase;
    if (p !== 'investigating' && p !== 'strike') return null;
    return { species: this.pending.species, length: this.pending.length };
  }

  drainEvents(): SimEvent[] {
    if (!this.events.length) return [];
    const out = this.events;
    this.events = [];
    return out;
  }

  private emit(e: SimEvent) {
    this.events.push(e);
  }

  say(text: string, kind: MessageKind = 'info', life = 4) {
    this.state.message = { text, kind, life, id: ++this.msgId };
    this.emit({ type: 'message', text, kind });
  }

  /* --------------------------------- input -------------------------------- */

  setAim(dirX: number, dirZ: number) {
    const len = Math.hypot(dirX, dirZ) || 1;
    this.state.aimDirX = dirX / len;
    this.state.aimDirZ = dirZ / len;
  }

  canCast(): boolean {
    return !this.paused && this.state.phase === 'ready' && this.baitLeft > 0;
  }

  beginCharge() {
    if (this.paused || this.state.phase !== 'ready') return;
    if (this.baitLeft <= 0) {
      this.say('Наживки нет — загляните в магазин', 'warn');
      return;
    }
    this.chargeUp = true;
    this.state.power = 0;
    this.setPhase('charging');
  }

  cancelCharge() {
    if (this.state.phase !== 'charging') return;
    this.state.power = 0;
    this.state.target = null;
    this.setPhase('ready');
  }

  /** Releasing the cast control. */
  releaseCharge() {
    if (this.state.phase !== 'charging') return;
    const s = this.state;
    const power = s.power;
    s.power = 0;
    if (power < 0.07) {
      s.target = null;
      this.setPhase('ready');
      this.say('Слишком слабый заброс', 'warn', 2.4);
      return;
    }
    const distance = lerp(this.rod.castMin, this.rod.castMax, power);
    const target = spotFrom(s.aimDirX, s.aimDirZ, distance);
    if (target.onLand) {
      s.target = null;
      this.setPhase('ready');
      this.say('Неудачно: насадка упала на берег', 'warn', 3);
      return;
    }
    this.save.bait[this.save.selectedBait] -= 1;
    this.castCount += 1;
    this.castTo = target;
    this.castFrom = { x: PLAYER_POS.x, y: 1.35, z: PLAYER_POS.z + 0.2 };
    s.rig = target;
    s.floatDip = 0;
    s.floatSlide = 0;
    s.floatSink = 0;
    s.castT = 0;
    this.missStreak = 0;
    this.setPhase('casting');
    this.emit({ type: 'castStarted', target });
  }

  /** "Выбрать снасти" — only valid while the rig is in the water with no fish on. */
  retrieve() {
    const p = this.state.phase;
    if (p !== 'waiting' && p !== 'investigating' && p !== 'strike') return;
    this.pending = null;
    this.state.retrieveT = 0;
    this.setPhase('retrieving');
  }

  attemptStrike() {
    if (this.paused) return;
    const s = this.state;
    if (s.phase === 'investigating') {
      this.emit({ type: 'scared' });
      this.say('Рано! Рыба почуяла подвох и бросила насадку', 'bad', 3.4);
      this.pending = null;
      this.missStreak = Math.min(4, this.missStreak + 1);
      this.startNewWait(1.4);
      this.setPhase('waiting');
      return;
    }
    if (s.phase === 'strike') {
      this.hookUp();
      return;
    }
    if (s.phase === 'waiting') {
      this.say('Подсечка ни к чему: поплавок спокоен', 'info', 2.2);
      return;
    }
    if (s.phase === 'fighting') {
      s.overload += 0.05; // an extra tug adds a short spike, that is all
    }
  }

  setReeling(v: boolean) {
    if (this.state.phase !== 'fighting') {
      this.state.reeling = false;
      return;
    }
    if (this.state.reeling === v) return;
    this.state.reeling = v;
    this.emit({ type: 'tick', strength: 0.35 });
  }

  /** Hint for the HUD: is the reel currently slipping line? */
  get slipping() {
    return this.state.slipping;
  }

  setDrag(v: number) {
    this.state.drag = clamp(Math.round(v), 1, 10);
  }

  adjustDrag(delta: number) {
    this.setDrag(this.state.drag + delta);
  }

  selectBait(id: BaitId) {
    const p = this.state.phase;
    if (p !== 'ready' && p !== 'charging') {
      this.say('Менять наживку лучше до заброса', 'info', 2.6);
      return;
    }
    this.save.selectedBait = id;
    if (p === 'charging') this.cancelCharge();
    this.say(`${BAITS[id].ru}: ${this.save.bait[id]} шт. на крючке`, 'info', 2.6);
    this.flush();
  }

  resolveResult(action: 'keep' | 'release') {
    const fish = this.state.result;
    if (!fish) return;
    const def = SPECIES[fish.species];
    if (action === 'keep') {
      if (this.save.keepnet.length >= this.net.capacity) {
        this.say('Садок полон: продайте рыбу или отпустите', 'warn', 3.6);
        return;
      }
      this.save.keepnet.push(fish);
      this.say(`В садке: ${def.ru}`, 'good', 3);
    } else {
      this.save.totalReleased += 1;
      this.say(`Отпущен в воду: ${def.ru}`, 'good', 3);
    }
    if (!this.save.bestCatch || fish.weight > this.save.bestCatch.weight) this.save.bestCatch = fish;
    this.state.result = null;
    this.state.fish = null;
    this.state.tension = 0;
    this.state.reeling = false;
    this.setPhase('ready');
    this.flush();
  }

  sellKeepnet() {
    if (!this.save.keepnet.length) {
      this.say('Садок пуст', 'info', 2.2);
      return;
    }
    const sum = this.save.keepnet.reduce((a, f) => a + f.value, 0);
    this.save.money += Math.round(sum);
    const count = this.save.keepnet.length;
    this.save.keepnet = [];
    this.emit({ type: 'sold', sum });
    this.say(`Продано ${count} рыбин: +${Math.round(sum).toLocaleString('ru-RU')} ₽`, 'good', 3.4);
    this.flush();
  }

  buy(itemId: string) {
    const baitItem = BAIT_PRODUCTS.find((b) => b.id === itemId);
    const rod = RODS.find((r) => r.id === itemId);
    const line = LINES.find((l) => l.id === itemId);
    const net = NETS.find((n) => n.id === itemId);
    const item = baitItem ?? rod ?? line ?? net;
    if (!item) return;
    if (this.level < item.level) {
      this.say(`Нужен ${item.level} уровень опыта`, 'warn', 3);
      return;
    }
    if (this.save.money < item.price) {
      this.say('Не хватает денег', 'warn', 3);
      return;
    }
    this.save.money -= item.price;
    if (baitItem) {
      this.save.bait[baitItem.bait] += baitItem.amount;
      this.save.selectedBait = baitItem.bait;
      this.say(`Куплено: ${BAITS[baitItem.bait].ru} +${baitItem.amount} шт.`, 'good', 3);
    } else if (rod) {
      this.save.rodId = rod.id;
      this.say(`Новое удилище: ${rod.name}`, 'good', 3.4);
    } else if (line) {
      this.save.lineId = line.id;
      this.say(`Новая леска: ${line.name}`, 'good', 3.4);
    } else if (net) {
      this.save.netId = net.id;
      this.say(`Новый садок: ${net.name}`, 'good', 3.4);
    }
    this.emit({ type: 'purchased', name: item.name });
    this.flush();
  }

  /* ---------------------------------- tick -------------------------------- */

  step(dt: number) {
    if (dt <= 0) return;
    const s = this.state;
    if (!this.paused) {
      this.advanceTime(dt);
      if (s.message) {
        s.message.life -= dt;
        if (s.message.life <= 0) s.message = null;
      }
      switch (s.phase) {
        case 'charging':
          this.tickCharge(dt);
          break;
        case 'casting':
          this.tickCast(dt);
          break;
        case 'waiting':
          this.tickWait(dt);
          break;
        case 'investigating':
          this.tickInvestigate(dt);
          break;
        case 'strike':
          this.tickStrike(dt);
          break;
        case 'fighting':
          this.tickFight(dt);
          break;
        case 'retrieving':
          this.tickRetrieve(dt);
          break;
        default:
          s.floatDip = Math.sin(this.windPhase * 1.7) * 0.16;
          break;
      }
    }
    this.saveTimer += dt;
    if (this.saveTimer > 2.5) {
      this.saveTimer = 0;
      this.flush();
    }
  }

  private tickCharge(dt: number) {
    const s = this.state;
    const speed = 1 / 1.25;
    if (this.chargeUp) {
      s.power += dt * speed;
      if (s.power >= 1) {
        s.power = 1;
        this.chargeUp = false;
      }
    } else {
      s.power -= dt * speed * 0.85;
      if (s.power <= 0) {
        s.power = 0;
        this.chargeUp = true;
      }
    }
    s.estimatedDistance = lerp(this.rod.castMin, this.rod.castMax, s.power);
    s.target = spotFrom(s.aimDirX, s.aimDirZ, s.estimatedDistance);
  }

  private tickCast(dt: number) {
    const s = this.state;
    s.castT = clamp01(s.castT + dt / CAST_DURATION);
    if (s.castT >= 1) {
      if (this.castTo) s.rig = this.castTo;
      s.floatDip = -1.4;
      s.floatSink = 0;
      this.setPhase('waiting');
      this.startNewWait(1);
      if (s.rig) {
        this.emit({ type: 'castLanded', target: s.rig });
        this.emit({ type: 'splash', x: s.rig.x, z: s.rig.z, power: 1 });
        this.say(`${Math.round(s.rig.distance)} м · ${s.rig.zoneName} · глубина ${s.rig.depth.toFixed(1)} м`, 'info', 3.2);
      }
      this.castTo = null;
    }
  }

  private tickRetrieve(dt: number) {
    const s = this.state;
    s.retrieveT = clamp01(s.retrieveT + dt / RETRIEVE_DURATION);
    s.floatSink = Math.max(0, s.floatSink - dt * 3);
    s.floatDip = lerp(s.floatDip, 0.3, Math.min(1, dt * 6));
    if (s.rig) s.rig = { ...s.rig, distance: lerp(s.rig.distance, LAND_DIST * 0.5, Math.min(1, dt * 1.8)) };
    if (s.retrieveT >= 1) {
      s.rig = null;
      s.target = null;
      this.setPhase('ready');
      this.emit({ type: 'rigRetrieved' });
    }
  }

  private tickWait(dt: number) {
    const s = this.state;
    s.waitRemaining -= dt;
    s.biteStrength = 0;
    s.biteProgress = 0;
    s.floatDip = (Math.sin(this.windPhase * 2.1) * 0.22 + Math.sin(this.windPhase * 4.7) * 0.12) * (0.6 + s.wind);
    s.floatSlide *= Math.max(0, 1 - dt * 3);
    s.floatSink = Math.max(0, s.floatSink - dt * 2);
    if (s.waitRemaining <= 0) this.startInvestigation();
  }

  private tickInvestigate(dt: number) {
    const s = this.state;
    this.investT += dt;
    const p = clamp01(this.investT / this.investDur);
    s.biteProgress = p;
    while (this.scriptIndex < this.script.length && this.script[this.scriptIndex].t <= p) {
      const node = this.script[this.scriptIndex];
      this.emit({ type: 'tick', strength: clamp01(Math.abs(node.dip) / 3) });
      if (s.rig && Math.abs(node.dip) > 1.3) this.emit({ type: 'splash', x: s.rig.x, z: s.rig.z, power: 0.3 });
      this.scriptIndex++;
    }
    const prev = this.scriptIndex > 0 ? this.script[this.scriptIndex - 1] : { t: 0, dip: 0, slide: 0 };
    const next = this.script[this.scriptIndex] ?? prev;
    const span = Math.max(0.0001, next.t - prev.t);
    const k = clamp01((p - prev.t) / span);
    s.floatDip = lerp(prev.dip, next.dip, k);
    s.floatSlide = lerp(prev.slide, next.slide, k);
    s.floatSink = clamp01(p * 0.3);
    s.biteStrength = clamp01(0.3 + p * 0.55);
    if (p >= 1) this.commitBite();
  }

  private tickStrike(dt: number) {
    const s = this.state;
    s.strikeRemaining -= dt;
    const f = clamp01(1 - s.strikeRemaining / s.strikeTotal);
    s.biteProgress = 1;
    s.biteStrength = 1;
    s.floatSink = 0.7 + 0.3 * f;
    const def = this.pending ? SPECIES[this.pending.species] : SPECIES.plotva;
    s.floatDip = 5 + def.strength * 5 + Math.sin(this.windPhase * 7) * 0.6;
    if (s.strikeRemaining <= 0) this.missedBite();
  }

  private tickFight(dt: number) {
    const s = this.state;
    const fish = s.fish;
    if (!fish) {
      this.setPhase('ready');
      return;
    }
    const def = SPECIES[fish.species];
    const rod = this.rod;
    const line = this.line;

    fish.behaviourTime -= dt;
    if (fish.behaviourTime <= 0) this.chooseBehaviour(fish);

    const rel = clamp01(fish.weight / def.maxW);
    const powerScale = 0.4 + def.strength * 0.95 + rel * 0.9;
    const burst =
      fish.behaviour === 'run'
        ? 1.75
        : fish.behaviour === 'cross'
          ? 1
          : fish.behaviour === 'headed'
            ? 0.5
            : fish.behaviour === 'rest'
              ? 0.3
              : 0.24;
    const fishForce = (0.3 + powerScale * 1.2) * burst * (0.4 + 0.6 * fish.stamina);
    fish.burst = clamp01(burst / 1.75);

    // Line load: the fish pulls, the angler answers through the rod.
    const rodPull = s.reeling ? rod.power * (0.28 + s.drag * 0.15) : 0;
    const absorb = 1 - rod.forgiveness * 0.3;
    const load = (fishForce + rodPull * 0.62 + (s.reeling ? 0.22 : 0)) * absorb;
    const rawPct = clamp((load / line.strengthKg) * 100, 0, 220);
    // The drag is a ceiling: above it the reel peels line instead of loading the tip.
    const cap = 26 + s.drag * 8.4; // drag 1 -> 34 %, drag 5 -> 68 %, drag 10 -> 110 %
    s.slipping = rawPct > (s.reeling ? cap : cap * 0.82);
    s.shock = Math.max(0, s.shock - dt * 1.5);
    const targetTension = Math.min(rawPct, cap) + s.shock * 34;
    s.tension += (targetTension - s.tension) * Math.min(1, dt * (targetTension > s.tension ? 3.6 : 2.6));

    // distance to the bank: heavier and stronger fish give back line
    const weightResist = 1 + 0.055 * fish.weight;
    const reelRate =
      (rod.reelSpeed * (0.5 + s.drag * 0.062) * clamp(1.5 - fishForce * 0.45, 0.12, 1.25)) / weightResist;
    if (s.reeling) fish.distance -= reelRate * (s.slipping ? 0.22 : 1) * dt;
    else if (s.slipping) fish.distance += (0.3 + powerScale * 0.35) * dt; // line peeled off the spool
    if (fish.behaviour === 'run') {
      fish.distance += (0.7 + powerScale * 1.5) * (0.45 + 0.55 * fish.stamina) * dt;
    } else if (fish.behaviour === 'cross') {
      fish.distance += 0.1 * powerScale * dt;
      fish.angle += fish.turnSign * (0.2 + 0.16 * fish.stamina) * dt;
    } else if (fish.behaviour === 'headed') {
      fish.distance -= (0.25 + powerScale * 0.2) * dt;
    } else {
      fish.distance -= 0.05 * dt;
    }
    fish.distance = Math.max(0.6, fish.distance);

    // never leave the water
    const pos = this.fishWorldPos(fish);
    if (!isWater(pos.x, pos.z) || fish.distance > rod.castMax + 14) {
      fish.turnSign *= -1;
      fish.angle *= 0.65;
      fish.distance = Math.min(fish.distance, rod.castMax + 10);
    }

    // stamina
    const resist = 0.5 + def.strength * 0.9 + def.stamina * 0.5 + rel * 0.9;
    if (s.reeling) fish.stamina -= ((0.032 + s.drag * 0.0105) / resist) * dt;
    else if (fish.behaviour === 'run') fish.stamina -= (0.026 / resist) * dt;
    else fish.stamina += 0.026 * (s.tension < 20 ? 1.7 : 0.75) * dt;
    fish.stamina = clamp(fish.stamina, 0, 1);

    // failure conditions
    if (s.tension > 100) s.overload += dt * (0.75 + (s.tension - 100) / 34);
    else s.overload = Math.max(0, s.overload - dt * (0.5 + rod.forgiveness * 0.7));
    if (s.tension < 12) s.slack += dt;
    else s.slack = Math.max(0, s.slack - dt * 1.6);

    if (s.overload >= 1) {
      this.breakLine();
      return;
    }
    if (s.slack > 2.1) {
      const risk = (s.slack - 2.1) * (0.45 + fish.stamina * 0.9);
      if (chance(this.rand, Math.min(0.6, risk) * dt)) {
        this.escaped('Сход: снасть была слишком слабой, рыба сошла с крючка');
        return;
      }
    }
    if (fish.distance > rod.castMax + 12 && chance(this.rand, dt * 0.45)) {
      this.escaped('Рыба отдала слишком много лески и ушла в глубину');
      return;
    }

    const np = this.fishWorldPos(fish);
    fish.x = np.x;
    fish.z = np.z;
    s.floatSink = 0.25;
    s.floatSlide = fish.angle * 0.5;
    s.floatDip = 1.5 + fish.burst * 4;

    if (fish.distance <= LAND_DIST && fish.stamina <= 0.32) {
      this.landFish(fish);
    } else if (fish.distance <= LAND_DIST && !this.bankHint) {
      this.bankHint = true;
      this.say('Рыба у берега, но ещё сильна — утомите её', 'info', 3.2);
    }
  }

  private chooseBehaviour(fish: ActiveFish) {
    const def = SPECIES[fish.species];
    const tired = 1 - fish.stamina;
    const weights = [
      0.85 + fish.stamina * 1.3, // cross
      0.3 + fish.stamina * (0.4 + def.strength * 1.4), // run
      0.28 + tired * 1.5, // rest
      0.16 + tired * 1.1 + (this.state.tension > 65 ? 0.35 : 0), // sulk
      fish.distance < 10 ? 0.6 + tired * 1.2 : 0.07, // headed
    ];
    const kinds: ActiveFish['behaviour'][] = ['cross', 'run', 'rest', 'sulk', 'headed'];
    const idx = weightedIndex(weights, this.rand);
    fish.behaviour = kinds[Math.max(0, idx)];
    fish.turnSign = this.rand() < 0.5 ? -1 : 1;
    const spans: Record<string, [number, number]> = {
      cross: [2.4, 5.2],
      run: [0.9, 2.1],
      rest: [1.6, 3.4],
      sulk: [1.3, 3],
      headed: [1.2, 2.6],
    };
    const [a, b] = spans[fish.behaviour];
    fish.behaviourTime = lerp(a, b, this.rand());
    if (fish.behaviour === 'run') {
      // turning and pulling hard is what snaps a light line
      this.state.shock = Math.min(1.4, this.state.shock + 0.45 + def.strength * 0.55 * fish.stamina);
      this.emit({ type: 'run', power: clamp01(def.strength * 0.6 + fish.stamina * 0.6) });
    }
  }

  private fishWorldPos(fish: ActiveFish) {
    const s = this.state;
    const c = Math.cos(fish.angle);
    const sn = Math.sin(fish.angle);
    const dx = s.aimDirX * c - s.aimDirZ * sn;
    const dz = s.aimDirX * sn + s.aimDirZ * c;
    return { x: PLAYER_POS.x + dx * fish.distance, z: PLAYER_POS.z + dz * fish.distance };
  }

  /* ------------------------------- bite logic ------------------------------ */

  private attractability(): { species: SpeciesId; w: number }[] {
    const s = this.state;
    const baitId = this.save.selectedBait;
    const zone = s.rig?.zone ?? 'mid';
    const depth = s.rig?.depth ?? 1.5;
    const out: { species: SpeciesId; w: number }[] = [];
    for (const id of SPECIES_ORDER) {
      const def = SPECIES[id];
      const compat = def.bait[baitId] ?? 0;
      if (compat <= 0.04) continue;
      const act = activityAt(def, s.hour);
      const reed = s.rig?.reedy && zone === 'shallow' ? 1.3 : 1;
      const w =
        compat *
        (0.22 + def.zones[zone]) *
        (0.2 + act) *
        (0.25 + depthFit(def, depth)) *
        reed *
        s.weather.biteFactor;
      if (w > 0.002) out.push({ species: id, w });
    }
    return out;
  }

  private biteScore(): number {
    return this.attractability().reduce((a, b) => a + b.w, 0);
  }

  private startNewWait(mult = 1) {
    const s = this.state;
    const n = clamp01(this.biteScore() / 1.25);
    const base = lerp(34, 7.8, Math.pow(n, 0.65));
    const jitter = 0.78 + this.rand() * 0.5;
    s.waitTotal = clamp(base * jitter * mult * (1 + this.missStreak * 0.2), 5, 70);
    s.waitRemaining = s.waitTotal;
    s.biteProgress = 0;
    s.biteStrength = 0;
  }

  private startInvestigation() {
    const s = this.state;
    const list = this.attractability();
    let chosen: SpeciesId | null = null;
    if (list.length) {
      const idx = weightedIndex(
        list.map((l) => l.w * (0.7 + this.rand() * 0.6)),
        this.rand,
      );
      if (idx >= 0) chosen = list[idx].species;
    }
    if (!chosen) chosen = this.rand() < 0.5 ? 'plotva' : 'karas';
    const def = SPECIES[chosen];
    const zone = s.rig?.zone ?? 'mid';
    const depth = s.rig?.depth ?? 1;
    const weight = rollWeight(def, this.rand, zone, depth);
    // From here the fish is locked: the same individual is fought and landed.
    this.pending = { species: chosen, weight, length: Math.round(lengthFromWeight(def, weight) * 10) / 10 };
    this.buildScript(def.strength);
    this.investT = 0;
    this.investDur = lerp(1.5, 2.6, this.rand());
    this.scriptIndex = 0;
    this.setPhase('investigating');
    this.emit({ type: 'biteStart' });
  }

  private buildScript(strength: number) {
    const r = this.rand;
    const nodes: { t: number; dip: number; slide: number }[] = [];
    const count = 3 + Math.floor(r() * 3);
    for (let i = 0; i < count; i++) {
      const t = (i + 0.6) / (count + 0.9);
      const amp = 0.4 + r() * (1.1 + strength * 1.7);
      nodes.push({ t, dip: amp * (0.45 + r() * 0.55), slide: (r() - 0.5) * (0.2 + strength * 0.5) });
    }
    nodes.push({ t: 0.96, dip: 2.6 + strength * 3, slide: (r() - 0.5) * 0.35 });
    this.script = nodes;
  }

  private commitBite() {
    const s = this.state;
    const def = this.pending ? SPECIES[this.pending.species] : SPECIES.karas;
    s.strikeTotal = clamp(def.strikeWindow * (0.85 + this.rand() * 0.4), 0.55, 2.2);
    s.strikeRemaining = s.strikeTotal;
    this.setPhase('strike');
    this.emit({ type: 'biteCommit' });
    if (s.rig) this.emit({ type: 'splash', x: s.rig.x, z: s.rig.z, power: 0.7 });
  }

  private missedBite() {
    const stolen = chance(this.rand, 0.45);
    this.missStreak = Math.min(4, this.missStreak + 1);
    this.emit({ type: 'missed' });
    this.pending = null;
    if (stolen) {
      this.emit({ type: 'baitStolen' });
      this.say('Рыба украла насадку — пора перевынаживаться', 'bad', 3.6);
      this.state.retrieveT = 0;
      this.setPhase('retrieving');
      return;
    }
    this.say('Не успели подсечь — рыба бросила насадку', 'warn', 3.2);
    this.startNewWait(1.25);
    this.setPhase('waiting');
  }

  private hookUp() {
    const s = this.state;
    if (!this.pending || !s.rig) {
      this.startNewWait(1);
      this.setPhase('waiting');
      return;
    }
    const { species, weight, length } = this.pending;
    const def = SPECIES[species];
    const rel = clamp01(weight / def.maxW);
    const fish: ActiveFish = {
      species,
      weight,
      length,
      bait: this.save.selectedBait,
      zone: s.rig.zone,
      depth: s.rig.depth,
      stamina: 1,
      distance: s.rig.distance,
      angle: 0,
      x: s.rig.x,
      z: s.rig.z,
      burst: 0.6,
      behaviour: 'cross',
      behaviourTime: 1.4 + this.rand(),
      turnSign: this.rand() < 0.5 ? -1 : 1,
      fightDifficulty: clamp01(def.strength * 0.55 + rel * 0.45),
    };
    s.fish = fish;
    s.tension = 22;
    s.overload = 0;
    s.slack = 0;
    s.shock = 0;
    s.slipping = false;
    s.reeling = false;
    this.bankHint = false;
    this.missStreak = 0;
    this.pending = null;
    this.setPhase('fighting');
    this.emit({ type: 'hooked' });
    this.say(
      weight >= def.trophyKg ? `Подсечка! Это ${def.ru} — крупный, держите снасть` : `Подсечка! ${def.ru} на крючке`,
      weight >= def.trophyKg ? 'good' : 'info',
      3.6,
    );
    this.emit({ type: 'splash', x: s.rig.x, z: s.rig.z, power: 0.9 });
  }

  private breakLine() {
    const s = this.state;
    this.emit({ type: 'lineSnapped' });
    this.say('Обрыв лески — рыба сошла', 'bad', 4);
    if (s.rig) this.emit({ type: 'splash', x: s.rig.x, z: s.rig.z, power: 1.1 });
    s.fish = null;
    s.result = null;
    s.tension = 0;
    s.overload = 0;
    s.slack = 0;
    s.reeling = false;
    s.rig = null;
    s.retrieveT = 1;
    this.setPhase('ready');
    this.flush();
  }

  private escaped(text: string) {
    this.emit({ type: 'fishEscaped' });
    this.say(text, 'warn', 4);
    const s = this.state;
    s.fish = null;
    s.tension = 0;
    s.overload = 0;
    s.slack = 0;
    s.shock = 0;
    s.slipping = false;
    s.reeling = false;
    this.missStreak = Math.min(4, this.missStreak + 1);
    if (s.rig) {
      s.retrieveT = 0;
      this.setPhase('retrieving');
    } else {
      this.setPhase('ready');
    }
    this.flush();
  }

  private landFish(fish: ActiveFish) {
    const def = SPECIES[fish.species];
    const weight = fish.weight;
    const length = fish.length;
    const trophy = weight >= def.trophyKg;
    const zoneBonus = fish.zone === 'deep' ? 1.12 : fish.zone === 'shallow' ? 0.95 : 1;
    const xp = Math.round(
      def.xpBase + def.xpPerKg * weight + fish.fightDifficulty * 45 + (trophy ? 70 : 0),
    );
    const value = Math.max(20, Math.round(def.pricePerKg * weight * zoneBonus * (trophy ? 1.3 : 1)));
    const prev: SpeciesRecord | undefined = this.save.records[fish.species];
    const record = !prev || weight > prev.weight;
    const caught: Fish = {
      uid: `f${Date.now().toString(36)}${++this.uid}`,
      species: fish.species,
      weight,
      length,
      bait: fish.bait,
      zone: fish.zone,
      hour: this.state.hour,
      caughtAt: Date.now(),
      trophy,
      record,
      value,
      xp,
    };
    const before = this.level;
    this.save.xp += xp;
    this.save.totalCaught += 1;
    this.save.totalWeight = Math.round((this.save.totalWeight + weight) * 100) / 100;
    this.save.history = [caught, ...this.save.history].slice(0, 40);
    if (record) {
      this.save.records[fish.species] = {
        weight,
        length,
        hour: this.state.hour,
        bait: fish.bait,
        caughtAt: caught.caughtAt,
      };
    }
    this.state.result = caught;
    this.state.fish = null;
    this.state.rig = null;
    this.state.tension = 0;
    this.state.reeling = false;
    this.state.overload = 0;
    this.setPhase('result');
    this.emit({ type: 'landed', fish: caught });
    if (this.level > before) this.emit({ type: 'levelUp', level: this.level });
    this.flush();
  }

  private advanceTime(dt: number) {
    const s = this.state;
    s.hour = (s.hour + (dt * MINUTES_PER_SECOND) / 60) % 24;
    this.windPhase += dt * (0.7 + s.wind);
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = lerp(16, 34, this.rand());
      const next = pickWeather(this.rand, s.hour);
      if (next.id !== s.weather.id) {
        s.weather = next;
        this.say(`Погода меняется: ${next.name}`, 'info', 2.6);
      }
    }
    const gust = 0.55 + 0.45 * Math.sin(this.windPhase * 0.6) * Math.sin(this.windPhase * 0.23 + 1.2);
    const target = clamp(s.weather.wind * (0.55 + 0.85 * gust), 0, 1.4);
    s.wind = lerp(s.wind, target, Math.min(1, dt * 0.9));
  }

  private setPhase(p: Phase) {
    if (this.state.phase === p) return;
    this.state.phase = p;
    this.emit({ type: 'phase', phase: p });
  }

  /* -------------------------------- snapshot ------------------------------- */

  shopView(): (DragOption & { owned: boolean; affordable: boolean })[] {
    const items: (DragOption & { owned: boolean; affordable: boolean })[] = [];
    for (const b of BAIT_PRODUCTS) {
      items.push({
        id: b.id,
        kind: 'bait',
        name: b.name,
        desc: b.desc,
        price: b.price,
        bait: b.bait,
        amount: b.amount,
        owned: false,
        affordable: this.save.money >= b.price,
      });
    }
    for (const r of RODS.slice(1)) {
      items.push({
        id: r.id,
        kind: 'rod',
        name: r.name,
        desc: `${r.desc} (заброс до ${r.castMax} м)`,
        price: r.price,
        owned: this.save.rodId === r.id,
        affordable: this.save.money >= r.price && this.level >= r.level,
      });
    }
    for (const l of LINES.slice(1)) {
      items.push({
        id: l.id,
        kind: 'line',
        name: l.name,
        desc: l.desc,
        price: l.price,
        owned: this.save.lineId === l.id,
        affordable: this.save.money >= l.price && this.level >= l.level,
      });
    }
    for (const n of NETS.slice(1)) {
      items.push({
        id: n.id,
        kind: 'net',
        name: n.name,
        desc: n.desc,
        price: n.price,
        owned: this.save.netId === n.id,
        affordable: this.save.money >= n.price && this.level >= n.level,
      });
    }
    return items;
  }

  recordsView() {
    return SPECIES_ORDER.map((id) => {
      const def = SPECIES[id];
      const rec = this.save.records[id];
      return {
        species: id as SpeciesId,
        ru: def.ru,
        en: def.en,
        blurb: def.blurb,
        weight: rec?.weight ?? 0,
        length: rec?.length ?? 0,
        hour: rec?.hour ?? 0,
        bait: rec?.bait ?? null,
        minW: def.minW,
        maxW: def.maxW,
        trophyKg: def.trophyKg,
        best: !!rec,
      };
    });
  }

  baitView() {
    return (Object.keys(BAITS) as BaitId[]).map((id) => ({
      id,
      ru: BAITS[id].ru,
      en: BAITS[id].en,
      desc: BAITS[id].desc,
      suits: BAITS[id].suits.map((s) => SPECIES[s].ru),
      left: this.save.bait[id],
      price: BAITS[id].price,
      packSize: BAITS[id].packSize,
      active: this.save.selectedBait === id,
    }));
  }

  snapshot(): HudSnapshot {
    const s = this.state;
    const bounds = xpBounds(this.save.xp);
    const fish = s.fish;
    const def = fish ? SPECIES[fish.species] : null;
    return {
      phase: s.phase,
      phaseLabel: PHASE_LABEL[s.phase],
      message: s.message,
      instructions: this.instructions(),
      timeLabel: `${String(Math.floor(s.hour)).padStart(2, '0')}:${String(Math.floor((s.hour % 1) * 60)).padStart(2, '0')}`,
      hour: s.hour,
      weather: s.weather.name,
      zoneName: s.rig?.zoneName ?? s.target?.zoneName ?? '—',
      depth: s.rig?.depth ?? s.target?.depth ?? 0,
      power: s.power,
      estimatedDistance: s.phase === 'charging' ? s.estimatedDistance : 0,
      rigDistance: fish ? fish.distance : (s.rig?.distance ?? 0),
      waitRemaining: Math.max(0, s.waitRemaining),
      waitTotal: s.waitTotal,
      biteProgress: s.biteProgress,
      strikeRemaining: Math.max(0, s.strikeRemaining),
      strikeTotal: s.strikeTotal,
      baitId: this.save.selectedBait,
      baitName: BAITS[this.save.selectedBait].ru,
      baitLeft: this.baitLeft,
      baitList: (Object.keys(this.save.bait) as BaitId[]).map((id) => ({
        id,
        name: BAITS[id].ru,
        left: this.save.bait[id],
        active: id === this.save.selectedBait,
      })),
      rodName: this.rod.name,
      lineName: this.line.name,
      lineStrength: this.line.strengthKg,
      netName: this.net.name,
      money: this.save.money,
      xp: this.save.xp,
      level: bounds.level,
      levelProgress: bounds.needed > 0 ? clamp01(bounds.current / bounds.needed) : 1,
      levelNeeded: bounds.needed,
      xpToNext: Math.max(0, bounds.needed - bounds.current),
      drag: s.drag,
      tension: s.tension,
      tensionLimit: this.line.strengthKg,
      fishDistance: fish ? fish.distance : 0,
      fishStamina: fish ? fish.stamina : 0,
      fishBehaviour: fish ? BEHAVIOUR_LABEL[fish.behaviour] ?? '' : '',
      hookedSpeciesName: def ? def.ru : null,
      hookedSpeciesWeight: def ? [def.minW, def.maxW] : [0, 0],
      result: s.result,
      resultIsRecord: !!s.result?.record,
      netCount: this.save.keepnet.length,
      netCapacity: this.net.capacity,
      netWeight: this.save.keepnet.reduce((a, f) => a + f.weight, 0),
      netValue: this.save.keepnet.reduce((a, f) => a + f.value, 0),
      canCast: this.canCast(),
      canRetrieve: s.phase === 'waiting' || s.phase === 'investigating' || s.phase === 'strike',
      shop: { items: [] },
      records: SPECIES_ORDER.map((id) => ({
        species: id,
        ru: SPECIES[id].ru,
        en: SPECIES[id].en,
        weight: this.save.records[id]?.weight ?? 0,
        length: this.save.records[id]?.length ?? 0,
        hour: this.save.records[id]?.hour ?? 0,
      })),
      history: this.save.history,
      totalCaught: this.save.totalCaught,
      castCount: this.castCount,
      soundOn: this.save.settings.sound,
    };
  }

  instructions(): string[] {
    const s = this.state;
    switch (s.phase) {
      case 'ready':
        return this.baitLeft > 0
          ? ['Зажмите левую кнопку мыши — идёт набор силы', 'Отпустите — последует заброс']
          : ['Наживки нет: купите в «Магазин» или выберите другую во «Наживка»'];
      case 'charging':
        return [`Мощность ${Math.round(s.power * 100)}% · ${Math.round(s.estimatedDistance)} м до точки`];
      case 'casting':
        return ['Снасть в полёте…'];
      case 'waiting':
        return [
          `Ждём поклёвку · ${Math.max(0, Math.ceil(s.waitRemaining))} c · ${s.rig?.zoneName ?? ''}`,
          'Левая кнопка — подсечь · кнопка «Снасти» — вынуть оснастку',
        ];
      case 'investigating':
        return ['Поплавок подрагивает: рыба пробует насадку', 'Не спешите — ждём решительной поклевки'];
      case 'strike':
        return ['КЛЮЁТ! Подсекайте — левая кнопка мыши'];
      case 'fighting':
        return [
          'Держите кнопку — подмотка. Отпустили — отдаёте слабины',
          `Фрикцион ${s.drag}/10 · следите за натяжением лески`,
        ];
      case 'result':
        return ['Решайте: оставить в садке или отпустить'];
      case 'retrieving':
        return ['Вынимаю оснастку из воды…'];
      default:
        return [];
    }
  }

  flush() {
    persistSave(this.save);
  }
}
