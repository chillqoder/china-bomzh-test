import { SpeciesData, TimeOfDay, FishingZone } from './types';

export const SPECIES: SpeciesData[] = [
  {
    id: 'crucian',
    nameRu: 'Карась',
    nameEn: 'Crucian carp',
    minWeight: 0.1,
    maxWeight: 3.5,
    typicalWeight: 0.6,
    weightDistribution: 'skewed-small',
    preferredBait: ['worm', 'corn'],
    preferredZone: 'shallow',
    preferredDepth: [0.5, 2.5],
    activityByTime: { morning: 0.9, day: 0.6, evening: 0.85, night: 0.3 },
    fightStrength: 0.4,
    stamina: 0.35,
    pricePerKg: 120,
    trophyThreshold: 2.0,
    color: '#c4943a',
    bodyType: 'deep',
    hasBarbels: false,
    hasStripes: false,
    dorsalType: 'normal',
  },
  {
    id: 'roach',
    nameRu: 'Плотва',
    nameEn: 'Roach',
    minWeight: 0.05,
    maxWeight: 1.8,
    typicalWeight: 0.25,
    weightDistribution: 'skewed-small',
    preferredBait: ['maggot', 'worm'],
    preferredZone: 'shallow',
    preferredDepth: [0.3, 2.0],
    activityByTime: { morning: 0.85, day: 0.7, evening: 0.8, night: 0.2 },
    fightStrength: 0.25,
    stamina: 0.3,
    pricePerKg: 80,
    trophyThreshold: 1.0,
    color: '#b8c4cc',
    bodyType: 'slim',
    hasBarbels: false,
    hasStripes: false,
    dorsalType: 'normal',
  },
  {
    id: 'perch',
    nameRu: 'Окунь',
    nameEn: 'Perch',
    minWeight: 0.1,
    maxWeight: 2.5,
    typicalWeight: 0.5,
    weightDistribution: 'skewed-small',
    preferredBait: ['worm', 'livebait'],
    preferredZone: 'open',
    preferredDepth: [1.0, 4.0],
    activityByTime: { morning: 0.8, day: 0.75, evening: 0.85, night: 0.35 },
    fightStrength: 0.55,
    stamina: 0.5,
    pricePerKg: 150,
    trophyThreshold: 1.5,
    color: '#5a7a3a',
    bodyType: 'slim',
    hasBarbels: false,
    hasStripes: true,
    dorsalType: 'spiky',
  },
  {
    id: 'bream',
    nameRu: 'Лещ',
    nameEn: 'Bream',
    minWeight: 0.5,
    maxWeight: 6.0,
    typicalWeight: 1.8,
    weightDistribution: 'normal',
    preferredBait: ['worm', 'maggot'],
    preferredZone: 'deep',
    preferredDepth: [2.5, 6.0],
    activityByTime: { morning: 0.75, day: 0.5, evening: 0.9, night: 0.6 },
    fightStrength: 0.6,
    stamina: 0.55,
    pricePerKg: 200,
    trophyThreshold: 4.0,
    color: '#8a8a72',
    bodyType: 'tall',
    hasBarbels: false,
    hasStripes: false,
    dorsalType: 'normal',
  },
  {
    id: 'carp',
    nameRu: 'Карп',
    nameEn: 'Common carp',
    minWeight: 1.0,
    maxWeight: 15.0,
    typicalWeight: 4.0,
    weightDistribution: 'normal',
    preferredBait: ['corn', 'worm'],
    preferredZone: 'deep',
    preferredDepth: [2.0, 5.5],
    activityByTime: { morning: 0.8, day: 0.55, evening: 0.85, night: 0.5 },
    fightStrength: 0.85,
    stamina: 0.8,
    pricePerKg: 250,
    trophyThreshold: 10.0,
    color: '#b8862a',
    bodyType: 'heavy',
    hasBarbels: true,
    hasStripes: false,
    dorsalType: 'normal',
  },
  {
    id: 'pike',
    nameRu: 'Щука',
    nameEn: 'Northern pike',
    minWeight: 0.8,
    maxWeight: 12.0,
    typicalWeight: 2.5,
    weightDistribution: 'skewed-small',
    preferredBait: ['livebait'],
    preferredZone: 'open',
    preferredDepth: [1.0, 4.5],
    activityByTime: { morning: 0.85, day: 0.6, evening: 0.9, night: 0.45 },
    fightStrength: 0.95,
    stamina: 0.85,
    pricePerKg: 300,
    trophyThreshold: 8.0,
    color: '#4a7a4a',
    bodyType: 'elongated',
    hasBarbels: false,
    hasStripes: false,
    dorsalType: 'rear',
  },
];

export function getSpeciesById(id: string): SpeciesData {
  return SPECIES.find((s) => s.id === id) || SPECIES[0];
}

export function generateFishWeight(species: SpeciesData): number {
  const { minWeight, maxWeight, typicalWeight, weightDistribution } = species;
  const range = maxWeight - minWeight;
  let t: number;

  if (weightDistribution === 'skewed-small') {
    // Skewed toward smaller fish using a power curve
    t = Math.pow(Math.random(), 1.8);
    const weight = minWeight + t * range;
    return Math.round(weight * 100) / 100;
  } else {
    // Normal-ish distribution centered around typicalWeight
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1 + 0.001)) * Math.cos(2 * Math.PI * u2);
    const normalizedTypical = (typicalWeight - minWeight) / range;
    t = Math.max(0, Math.min(1, normalizedTypical + z * 0.22));
    const weight = minWeight + t * range;
    return Math.round(weight * 100) / 100;
  }
}

export function generateFishLength(species: SpeciesData, weight: number): number {
  const weightRange = species.maxWeight - species.minWeight;
  const weightRatio = (weight - species.minWeight) / weightRange;
  const baseLength = species.bodyType === 'elongated' ? 40 : species.bodyType === 'tall' ? 35 : 25;
  const maxLength = species.bodyType === 'elongated' ? 120 : species.bodyType === 'heavy' ? 90 : 55;
  const length = baseLength + weightRatio * (maxLength - baseLength);
  return Math.round(length * 10) / 10;
}
