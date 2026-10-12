import type {
  BaitDef,
  BaitId,
  KeepnetDef,
  LineDef,
  RodDef,
  SpeciesDef,
  WeatherId,
  ZoneId,
} from "./types";

export const BAITS: BaitDef[] = [
  {
    id: "worm",
    nameRu: "Червь",
    descr: "Классическая наживка. Универсальна, хорошо держится на крючке.",
    pricePer10: 30,
    bestForRu: "Карась, окунь, лещ",
  },
  {
    id: "maggot",
    nameRu: "Опарыш",
    descr: "Мелкая подвижная личинка. Отлично собирает мелочь и леща.",
    pricePer10: 25,
    bestForRu: "Плотва, лещ, окунь",
  },
  {
    id: "corn",
    nameRu: "Кукуруза",
    descr: "Сладкие зёрна. Приманивают карася и крупного карпа.",
    pricePer10: 20,
    bestForRu: "Карась, карп",
  },
  {
    id: "livebait",
    nameRu: "Живец",
    descr: "Мелкая рыбка для хищника. Тяжёлая наживка, требует подсечки.",
    pricePer10: 60,
    bestForRu: "Щука, крупный окунь",
  },
];

export const BAIT_MAP: Record<BaitId, BaitDef> = Object.fromEntries(
  BAITS.map((b) => [b.id, b])
) as Record<BaitId, BaitDef>;

export const RODS: RodDef[] = [
  {
    id: "bamboo",
    nameRu: "Бамбуковое удилище",
    descr: "Простое и надёжное. Дальность 45 м, фрикцион до 6 кг.",
    price: 0,
    castRange: 45,
    reelSpeed: 1.35,
    maxDrag: 6,
  },
  {
    id: "fiberglass",
    nameRu: "Стеклопластиковое удилище",
    descr: "Дальше, быстрее, крепче. Дальность 55 м, фрикцион до 8 кг.",
    price: 900,
    castRange: 55,
    reelSpeed: 1.7,
    maxDrag: 8,
  },
  {
    id: "carbon",
    nameRu: "Карбоновое удилище",
    descr: "Спортивная снасть. Дальность 70 м, фрикцион до 12 кг.",
    price: 2600,
    castRange: 70,
    reelSpeed: 2.1,
    maxDrag: 12,
  },
];

export const LINES: LineDef[] = [
  {
    id: "line02",
    nameRu: "Леска 0,20 мм",
    descr: "Разрывная нагрузка 5 кг. Тонкая, но слабая.",
    price: 0,
    ratingKg: 5,
  },
  {
    id: "line025",
    nameRu: "Леска 0,25 мм",
    descr: "Разрывная нагрузка 8 кг. Хороший баланс.",
    price: 500,
    ratingKg: 8,
  },
  {
    id: "line03",
    nameRu: "Леска 0,30 мм",
    descr: "Разрывная нагрузка 12 кг. Для трофеев.",
    price: 1500,
    ratingKg: 12,
  },
];

export const KEEPNETS: KeepnetDef[] = [
  {
    id: "net10",
    nameRu: "Садок на 10 рыб",
    descr: "Стандартный садок из сетки.",
    price: 0,
    capacity: 10,
  },
  {
    id: "net20",
    nameRu: "Садок на 20 рыб",
    descr: "Вместительный, с широким кольцом.",
    price: 700,
    capacity: 20,
  },
  {
    id: "net35",
    nameRu: "Садок на 35 рыб",
    descr: "Профессиональный, для долгих сессий.",
    price: 1800,
    capacity: 35,
  },
];

function activityCurve(segments: Array<[number, number, number]>): number[] {
  const arr = new Array<number>(24).fill(0.3);
  for (const [from, to, level] of segments) {
    for (let h = from; h <= to; h++) {
      arr[((h % 24) + 24) % 24] = level;
    }
  }
  return arr;
}

export const SPECIES: SpeciesDef[] = [
  {
    id: "crucian",
    nameRu: "Карась",
    nameEn: "Crucian carp",
    minW: 0.05,
    maxW: 2.0,
    weightExp: 3.0,
    lengthA: 3.0,
    strength: 0.7,
    stamina: 0.7,
    pricePerKg: 120,
    trophyW: 1.0,
    xpBase: 18,
    baitAff: { worm: 1.2, maggot: 0.6, corn: 1.3, livebait: 0.05 },
    zoneAff: { reeds: 1.3, open: 0.8, deep: 0.35 },
    activity: activityCurve([
      [5, 10, 0.9],
      [10, 16, 1.2],
      [16, 21, 1.0],
      [21, 23, 0.5],
      [0, 4, 0.35],
    ]),
    colors: { body: 0xb08948, belly: 0xd9c07f, fins: 0x8a6a38 },
    shape: {
      profilePow: 0.62,
      headSharp: 0.2,
      tailSharp: 0.45,
      heightScale: 1.35,
      widthScale: 0.62,
      lengthScale: 0.92,
      tailFork: 0.25,
      dorsalPos: 0.55,
      dorsalSize: 0.75,
      eyeSize: 0.09,
    },
    descr: "Плотный, высокий в спине, с бронзово-золотистым отливом.",
    bestBaitsRu: "кукуруза, червь",
  },
  {
    id: "roach",
    nameRu: "Плотва",
    nameEn: "Roach",
    minW: 0.03,
    maxW: 1.2,
    weightExp: 3.2,
    lengthA: 3.4,
    strength: 0.5,
    stamina: 0.55,
    pricePerKg: 100,
    trophyW: 0.6,
    xpBase: 14,
    baitAff: { worm: 0.8, maggot: 1.3, corn: 0.5, livebait: 0.05 },
    zoneAff: { reeds: 0.9, open: 1.1, deep: 0.5 },
    activity: activityCurve([
      [5, 9, 1.3],
      [9, 16, 0.9],
      [16, 21, 1.25],
      [21, 23, 0.4],
      [0, 4, 0.3],
    ]),
    colors: { body: 0xc7ccd2, belly: 0xeff1f3, fins: 0xd06a4a },
    shape: {
      profilePow: 0.8,
      headSharp: 0.3,
      tailSharp: 0.5,
      heightScale: 0.95,
      widthScale: 0.5,
      lengthScale: 1.05,
      tailFork: 0.75,
      dorsalPos: 0.5,
      dorsalSize: 0.6,
      eyeSize: 0.1,
    },
    descr: "Стройная серебристая рыбка с красноватыми плавниками.",
    bestBaitsRu: "опарыш, червь",
  },
  {
    id: "perch",
    nameRu: "Окунь",
    nameEn: "Perch",
    minW: 0.05,
    maxW: 1.8,
    weightExp: 2.9,
    lengthA: 3.4,
    strength: 0.85,
    stamina: 0.75,
    pricePerKg: 130,
    trophyW: 0.9,
    xpBase: 18,
    baitAff: { worm: 1.2, maggot: 0.9, corn: 0.15, livebait: 1.0 },
    zoneAff: { reeds: 1.2, open: 0.7, deep: 0.9 },
    activity: activityCurve([
      [5, 9, 1.3],
      [9, 16, 0.8],
      [16, 21, 1.3],
      [21, 23, 0.6],
      [0, 4, 0.4],
    ]),
    colors: { body: 0x6f7d3a, belly: 0xcfd3a5, fins: 0xc44a30, accent: 0x2e3320 },
    shape: {
      profilePow: 0.68,
      headSharp: 0.25,
      tailSharp: 0.5,
      heightScale: 1.15,
      widthScale: 0.6,
      lengthScale: 1.0,
      tailFork: 0.4,
      dorsalPos: 0.62,
      dorsalSize: 0.85,
      spinyDorsal: true,
      stripes: "vertical",
      eyeSize: 0.11,
    },
    descr: "Полосатый хищник с яркими красными плавниками.",
    bestBaitsRu: "червь, живец",
  },
  {
    id: "bream",
    nameRu: "Лещ",
    nameEn: "Bream",
    minW: 0.3,
    maxW: 5.0,
    weightExp: 2.7,
    lengthA: 3.4,
    strength: 0.95,
    stamina: 0.95,
    pricePerKg: 150,
    trophyW: 2.5,
    xpBase: 26,
    baitAff: { worm: 1.1, maggot: 1.3, corn: 0.8, livebait: 0.05 },
    zoneAff: { reeds: 0.7, open: 1.0, deep: 1.3 },
    activity: activityCurve([
      [4, 8, 1.4],
      [8, 16, 0.7],
      [16, 20, 1.15],
      [20, 23, 0.9],
      [0, 3, 0.7],
    ]),
    colors: { body: 0xa9a58c, belly: 0xd9d6bf, fins: 0x7d7a63 },
    shape: {
      profilePow: 0.55,
      headSharp: 0.15,
      tailSharp: 0.55,
      heightScale: 1.5,
      widthScale: 0.42,
      lengthScale: 0.9,
      tailFork: 0.6,
      dorsalPos: 0.45,
      dorsalSize: 0.65,
      eyeSize: 0.08,
    },
    descr: "Высокий, сжатый с боков, серебристо-бронзовый красавец.",
    bestBaitsRu: "опарыш, червь",
  },
  {
    id: "carp",
    nameRu: "Карп",
    nameEn: "Common carp",
    minW: 0.5,
    maxW: 14.0,
    weightExp: 2.6,
    lengthA: 3.2,
    strength: 1.7,
    stamina: 1.35,
    pricePerKg: 180,
    trophyW: 5.0,
    xpBase: 40,
    baitAff: { worm: 0.9, maggot: 0.35, corn: 1.4, livebait: 0.03 },
    zoneAff: { reeds: 0.6, open: 1.1, deep: 0.95 },
    activity: activityCurve([
      [4, 9, 1.2],
      [9, 16, 0.9],
      [16, 21, 1.25],
      [21, 23, 0.9],
      [0, 3, 0.8],
    ]),
    colors: { body: 0x9a7434, belly: 0xc9a760, fins: 0x6f5222 },
    shape: {
      profilePow: 0.6,
      headSharp: 0.25,
      tailSharp: 0.5,
      heightScale: 1.2,
      widthScale: 0.65,
      lengthScale: 1.0,
      tailFork: 0.35,
      dorsalPos: 0.5,
      dorsalSize: 0.9,
      barbels: true,
      eyeSize: 0.09,
    },
    descr: "Мощная золотисто-коричневая рыба с усами. Боец что надо!",
    bestBaitsRu: "кукуруза, червь",
  },
  {
    id: "pike",
    nameRu: "Щука",
    nameEn: "Northern pike",
    minW: 0.3,
    maxW: 12.0,
    weightExp: 2.7,
    lengthA: 4.6,
    strength: 1.5,
    stamina: 0.95,
    pricePerKg: 200,
    trophyW: 4.0,
    xpBase: 36,
    baitAff: { worm: 0.15, maggot: 0.05, corn: 0.01, livebait: 1.6 },
    zoneAff: { reeds: 1.35, open: 0.5, deep: 0.9 },
    activity: activityCurve([
      [5, 9, 1.4],
      [9, 16, 0.7],
      [16, 21, 1.4],
      [21, 23, 0.7],
      [0, 4, 0.5],
    ]),
    colors: { body: 0x5d7a45, belly: 0xb8c29a, fins: 0x435c31, accent: 0xd8e0a8 },
    shape: {
      profilePow: 0.9,
      headSharp: 0.8,
      tailSharp: 0.6,
      heightScale: 0.85,
      widthScale: 0.5,
      lengthScale: 1.5,
      tailFork: 0.3,
      dorsalPos: 0.85,
      dorsalSize: 0.7,
      stripes: "spots",
      eyeSize: 0.1,
    },
    descr: "Стремительная зелёная хищница с вытянутым телом.",
    bestBaitsRu: "живец",
  },
];

export const SPECIES_MAP: Record<string, SpeciesDef> = Object.fromEntries(
  SPECIES.map((s) => [s.id, s])
) as Record<string, SpeciesDef>;

export function sampleWeight(sp: SpeciesDef): number {
  const u = Math.random();
  const w = sp.minW + (sp.maxW - sp.minW) * Math.pow(u, sp.weightExp);
  return Math.round(w * 1000) / 1000;
}

export function weightToLength(sp: SpeciesDef, weightKg: number): number {
  return sp.lengthA * Math.cbrt(Math.max(1, weightKg * 1000));
}

export function fishValue(sp: SpeciesDef, weightKg: number): number {
  return Math.max(1, Math.round(weightKg * sp.pricePerKg));
}

export function zoneForDepth(depth: number): ZoneId {
  if (depth < 0.85) return "reeds";
  if (depth < 2.1) return "open";
  return "deep";
}

export function biteScore(
  sp: SpeciesDef,
  bait: BaitId,
  zone: ZoneId,
  hour: number,
  weather: WeatherId = "clear"
): number {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  const baitAff = sp.baitAff[bait] ?? 0;
  let weatherMult = 1;
  if (weather === "rain") {
    weatherMult = sp.id === "pike" ? 1.15 : sp.id === "perch" ? 1.1 : 0.92;
  } else if (weather === "cloudy") {
    weatherMult = 1.05;
  }
  return Math.max(0.01, baitAff) * sp.zoneAff[zone] * sp.activity[h] * weatherMult;
}

export function pickSpecies(
  bait: BaitId,
  zone: ZoneId,
  hour: number,
  weather: WeatherId = "clear"
): { sp: SpeciesDef; quality: number } {
  const scores = SPECIES.map((sp) => ({
    sp,
    score: biteScore(sp, bait, zone, hour, weather),
  }));
  const total = scores.reduce((a, s) => a + s.score, 0);
  let r = Math.random() * total;
  let picked = scores[0];
  for (const s of scores) {
    r -= s.score;
    if (r <= 0) {
      picked = s;
      break;
    }
  }
  const maxScore = Math.max(...scores.map((s) => s.score));
  return { sp: picked.sp, quality: maxScore };
}

export function xpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += 120 + (l - 1) * 90;
  return total;
}

export function levelFromXp(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let remaining = xp;
  while (true) {
    const need = 120 + (level - 1) * 90;
    if (remaining < need) return { level, into: remaining, need };
    remaining -= need;
    level++;
  }
}

export function catchXp(sp: SpeciesDef, weightKg: number, trophy: boolean): number {
  return Math.round(sp.xpBase + weightKg * 25 + (trophy ? 60 : 0));
}

export function ammoLabel(n: number): string {
  return `${n} шт.`;
}
