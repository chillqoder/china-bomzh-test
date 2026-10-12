import type { BaitId, SpeciesId, ZoneId } from './types';
import { clamp, lerp } from './rng';

/** Cross-section / fin parameters for the procedural low-poly fish builder. */
export interface FishProfile {
  /** total length relative to a 1.0 reference fish (multiplied by real length) */
  stretch: number;
  /** body half-height at the deepest point */
  height: number;
  /** body half-width at the deepest point */
  width: number;
  /** where the body is deepest, 0 = nose, 1 = tail base */
  deepestAt: number;
  /** how abruptly the head tapers */
  headTaper: number;
  /** caudal peduncle thickness */
  stocky: number;
  /** tail fin spread */
  tailSpread: number;
  tailFork: number;
  dorsalSize: number;
  dorsalPos: number;
  dorsalCount: number;
  analSize: number;
  analPos: number;
  headLength: number;
  barbels: boolean;
  stripes: boolean;
  spots: boolean;
  hump: number;
  colors: {
    back: number;
    side: number;
    belly: number;
    fin: number;
    eye: number;
  };
}

export interface SpeciesDef {
  id: SpeciesId;
  ru: string;
  en: string;
  blurb: string;
  minW: number;
  maxW: number;
  /** median weight of the population, kg */
  mode: number;
  /** lognormal spread: bigger means a fatter tail of giants */
  spread: number;
  /** length = k * cbrt(weight), in cm */
  k: number;
  bait: Record<BaitId, number>;
  zones: Record<ZoneId, number>;
  depthPref: [number, number];
  /** 24 hourly activity values, 0..1 */
  activity: number[];
  strength: number;
  stamina: number;
  pricePerKg: number;
  trophyKg: number;
  xpBase: number;
  xpPerKg: number;
  /** seconds available for the hook set on a committed bite */
  strikeWindow: number;
  /** how likely the fish is to come to a shallow, reedy cast */
  shyOfBank: number;
  profile: FishProfile;
}

const hours = (pairs: [number, number][]): number[] => {
  // piecewise-linear activity over 24 h
  const out: number[] = [];
  for (let h = 0; h < 24; h++) {
    let best = 0;
    for (let i = 0; i < pairs.length; i++) {
      const a = pairs[i][0];
      const b = pairs[i][1];
      if (h >= a && h <= b) {
        const t = (h - a) / Math.max(0.001, b - a);
        best = Math.max(best, Math.sin(t * Math.PI));
      }
    }
    out.push(clamp(best, 0, 1));
  }
  return out;
};

export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  karas: {
    id: 'karas',
    ru: 'Карась',
    en: 'Crucian carp',
    blurb: 'Осторожная глубокая рыбка с бронзовым отливом. Держится тины и камыша.',
    minW: 0.08,
    maxW: 1.75,
    mode: 0.28,
    spread: 0.45,
    k: 36,
    bait: { cherv: 0.9, oparysh: 0.7, kukuruza: 1.0, zhivets: 0.05 },
    zones: { shallow: 1.0, mid: 0.75, deep: 0.35 },
    depthPref: [0.3, 2.2],
    activity: hours([
      [4, 11],
      [16, 21],
    ]),
    strength: 0.34,
    stamina: 0.55,
    pricePerKg: 190,
    trophyKg: 0.95,
    xpBase: 18,
    xpPerKg: 26,
    strikeWindow: 1.05,
    shyOfBank: 0.2,
    profile: {
      stretch: 1.0,
      height: 0.3,
      width: 0.16,
      deepestAt: 0.42,
      headTaper: 0.75,
      stocky: 0.5,
      tailSpread: 0.5,
      tailFork: 0.28,
      dorsalSize: 0.42,
      dorsalPos: 0.42,
      dorsalCount: 1,
      analSize: 0.34,
      analPos: 0.62,
      headLength: 0.24,
      barbels: false,
      stripes: false,
      spots: false,
      hump: 0.0,
      colors: { back: 0x6b5a34, side: 0xb08d4a, belly: 0xe4d6ac, fin: 0x8c7040, eye: 0x2a2018 },
    },
  },
  plotva: {
    id: 'plotva',
    ru: 'Плотва',
    en: 'Roach',
    blurb: 'Стройная серебристая рыбка с красноватыми плавниками. Клюёт решительно и звонко.',
    minW: 0.04,
    maxW: 0.9,
    mode: 0.16,
    spread: 0.42,
    k: 45,
    bait: { cherv: 0.55, oparysh: 1.0, kukuruza: 0.6, zhivets: 0.1 },
    zones: { shallow: 0.9, mid: 1.0, deep: 0.45 },
    depthPref: [0.3, 2.6],
    activity: hours([
      [5, 13],
      [17, 20.5],
    ]),
    strength: 0.24,
    stamina: 0.4,
    pricePerKg: 120,
    trophyKg: 0.55,
    xpBase: 12,
    xpPerKg: 20,
    strikeWindow: 0.9,
    shyOfBank: 0.05,
    profile: {
      stretch: 1.12,
      height: 0.22,
      width: 0.13,
      deepestAt: 0.4,
      headTaper: 0.7,
      stocky: 0.45,
      tailSpread: 0.46,
      tailFork: 0.34,
      dorsalSize: 0.3,
      dorsalPos: 0.45,
      dorsalCount: 1,
      analSize: 0.26,
      analPos: 0.66,
      headLength: 0.26,
      barbels: false,
      stripes: false,
      spots: false,
      hump: 0.0,
      colors: { back: 0x4c6f78, side: 0xcfd8dd, belly: 0xf2f4f5, fin: 0xb0483f, eye: 0xd94b3a },
    },
  },
  okun: {
    id: 'okun',
    ru: 'Окунь',
    en: 'Perch',
    blurb: 'Полосатый хищник с колючим спинным плавником. Активен весь день, любит глубину.',
    minW: 0.06,
    maxW: 1.9,
    mode: 0.30,
    spread: 0.44,
    k: 38,
    bait: { cherv: 0.8, oparysh: 0.4, kukuruza: 0.15, zhivets: 0.6 },
    zones: { shallow: 0.55, mid: 1.0, deep: 0.85 },
    depthPref: [0.6, 4.2],
    activity: hours([
      [6, 11],
      [15, 20],
    ]),
    strength: 0.46,
    stamina: 0.6,
    pricePerKg: 210,
    trophyKg: 1.0,
    xpBase: 22,
    xpPerKg: 30,
    strikeWindow: 0.95,
    shyOfBank: 0.15,
    profile: {
      stretch: 1.05,
      height: 0.26,
      width: 0.14,
      deepestAt: 0.44,
      headTaper: 0.72,
      stocky: 0.52,
      tailSpread: 0.44,
      tailFork: 0.3,
      dorsalSize: 0.46,
      dorsalPos: 0.4,
      dorsalCount: 2,
      analSize: 0.3,
      analPos: 0.68,
      headLength: 0.28,
      barbels: false,
      stripes: true,
      spots: false,
      hump: 0.12,
      colors: { back: 0x3f5b33, side: 0x86a252, belly: 0xd7dcae, fin: 0x9d4a2e, eye: 0xd8b23a },
    },
  },
  leshch: {
    id: 'leshch',
    ru: 'Лещ',
    en: 'Bream',
    blurb: 'Высокая, уплощённая по бокам рыба с серебристо-бронзовым боку. Вечером берёт уверенно.',
    minW: 0.25,
    maxW: 4.8,
    mode: 0.95,
    spread: 0.42,
    k: 40,
    bait: { cherv: 0.75, oparysh: 0.95, kukuruza: 0.7, zhivets: 0.05 },
    zones: { shallow: 0.35, mid: 1.0, deep: 0.9 },
    depthPref: [1.0, 4.6],
    activity: hours([
      [5, 9],
      [17, 22.5],
    ]),
    strength: 0.58,
    stamina: 0.72,
    pricePerKg: 165,
    trophyKg: 2.4,
    xpBase: 30,
    xpPerKg: 24,
    strikeWindow: 1.15,
    shyOfBank: 0.35,
    profile: {
      stretch: 0.98,
      height: 0.34,
      width: 0.13,
      deepestAt: 0.45,
      headTaper: 0.68,
      stocky: 0.42,
      tailSpread: 0.5,
      tailFork: 0.42,
      dorsalSize: 0.4,
      dorsalPos: 0.44,
      dorsalCount: 1,
      analSize: 0.42,
      analPos: 0.66,
      headLength: 0.2,
      barbels: false,
      stripes: false,
      spots: false,
      hump: 0.18,
      colors: { back: 0x5a5b3f, side: 0xb9bda4, belly: 0xe8e6d2, fin: 0x7d7a5c, eye: 0x3a3524 },
    },
  },
  karp: {
    id: 'karp',
    ru: 'Карп',
    en: 'Common carp',
    blurb: 'Тяжёлое золотисто-бурое тело с короткими усиками. Сильнейший противник на снасти.',
    minW: 0.7,
    maxW: 12.5,
    mode: 2.30,
    spread: 0.42,
    k: 33,
    bait: { cherv: 0.6, oparysh: 0.4, kukuruza: 0.95, zhivets: 0.1 },
    zones: { shallow: 0.25, mid: 0.8, deep: 1.0 },
    depthPref: [1.4, 5.6],
    activity: hours([
      [7, 12],
      [15, 21],
    ]),
    strength: 0.85,
    stamina: 0.95,
    pricePerKg: 240,
    trophyKg: 6.0,
    xpBase: 55,
    xpPerKg: 22,
    strikeWindow: 1.4,
    shyOfBank: 0.5,
    profile: {
      stretch: 1.08,
      height: 0.29,
      width: 0.19,
      deepestAt: 0.46,
      headTaper: 0.62,
      stocky: 0.62,
      tailSpread: 0.52,
      tailFork: 0.3,
      dorsalSize: 0.34,
      dorsalPos: 0.42,
      dorsalCount: 1,
      analSize: 0.3,
      analPos: 0.64,
      headLength: 0.24,
      barbels: true,
      stripes: false,
      spots: false,
      hump: 0.22,
      colors: { back: 0x5c4522, side: 0xb98b41, belly: 0xe8d3a0, fin: 0x8a6a34, eye: 0x2f2414 },
    },
  },
  shchuka: {
    id: 'shchuka',
    ru: 'Щука',
    en: 'Northern pike',
    blurb: 'Зелёная стрела с торчащей мордой и смещённым назад плавником. Бьёт резко, сопротивляется отчаянно.',
    minW: 0.45,
    maxW: 8.5,
    mode: 1.45,
    spread: 0.45,
    k: 48,
    bait: { cherv: 0.08, oparysh: 0.03, kukuruza: 0.03, zhivets: 1.0 },
    zones: { shallow: 1.0, mid: 0.8, deep: 0.7 },
    depthPref: [0.5, 4.5],
    activity: hours([
      [4, 9],
      [18, 23.5],
    ]),
    strength: 0.95,
    stamina: 0.8,
    pricePerKg: 290,
    trophyKg: 3.6,
    xpBase: 60,
    xpPerKg: 20,
    strikeWindow: 1.5,
    shyOfBank: 0.1,
    profile: {
      stretch: 1.62,
      height: 0.17,
      width: 0.14,
      deepestAt: 0.36,
      headTaper: 0.5,
      stocky: 0.5,
      tailSpread: 0.44,
      tailFork: 0.34,
      dorsalSize: 0.26,
      dorsalPos: 0.68,
      dorsalCount: 1,
      analSize: 0.26,
      analPos: 0.78,
      headLength: 0.36,
      barbels: false,
      stripes: false,
      spots: true,
      hump: 0.0,
      colors: { back: 0x2f4a24, side: 0x7f9a44, belly: 0xd8dba4, fin: 0x4e6a34, eye: 0xe0c23a },
    },
  },
};

export const SPECIES_ORDER: SpeciesId[] = ['karas', 'plotva', 'okun', 'leshch', 'karp', 'shchuka'];

export const speciesById = (id: SpeciesId) => SPECIES[id];

export function activityAt(def: SpeciesDef, hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  const i0 = Math.floor(h) % 24;
  const i1 = (i0 + 1) % 24;
  const t = h - Math.floor(h);
  return lerp(def.activity[i0], def.activity[i1], t);
}

/** 0..1 fit of a depth to the species' preferred band. */
export function depthFit(def: SpeciesDef, depth: number): number {
  const [lo, hi] = def.depthPref;
  const mid = (lo + hi) / 2;
  const half = Math.max(0.35, (hi - lo) / 2);
  const d = Math.abs(depth - mid) / half;
  return clamp(1 - (d - 1) * 0.75, 0.05, 1) * (depth < lo * 0.4 ? 0.35 : 1);
}

export function lengthFromWeight(def: SpeciesDef, weight: number): number {
  const base = def.k * Math.cbrt(weight);
  return Math.max(def.minW * 40, base);
}

/**
 * Lognormal sample around the species median: small and medium fish are common,
 * heavy specimens are genuinely rare. Deeper water lifts the whole curve.
 */
export function rollWeight(def: SpeciesDef, r: () => number, zone: ZoneId, depth: number): number {
  // the mean of three uniforms is a cheap, well-behaved normal(0, 1)
  const z = ((r() + r() + r()) / 3 - 0.5) * 3.46;
  let w = def.mode * Math.exp(def.spread * z);
  const zoneBoost = zone === 'deep' ? 1.16 : zone === 'mid' ? 1.04 : 0.86;
  w *= zoneBoost * (0.85 + 0.3 * Math.min(1, depth / 4));
  // rare specimen from the far tail of the population
  if (r() < 0.028) w = lerp(w, def.maxW * (0.72 + 0.28 * r()), 0.9);
  w = clamp(w, def.minW * 0.8, def.maxW);
  return Math.round(w * 100) / 100;
}
