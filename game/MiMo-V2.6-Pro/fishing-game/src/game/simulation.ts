import {
  FishingState,
  FishingZone,
  TimeOfDay,
  Weather,
  GameState,
  CaughtFish,
  FightState,
  CastState,
  BiteState,
  SpeciesData,
} from './types';
import { SPECIES, getSpeciesById, generateFishWeight, generateFishLength } from './species';
import { BAITS, getBaitById } from './bait';

export function createInitialCastState(): CastState {
  return { power: 0, distance: 0, targetX: 0, targetZ: 0, trajectoryProgress: 0 };
}

export function createInitialBiteState(): BiteState {
  return {
    phase: 'none',
    timer: 0,
    strikeWindow: 0,
    fishSpeciesId: '',
    fishWeight: 0,
    fishLength: 0,
    floatDepth: 0,
    floatBobbing: 0,
  };
}

export function createInitialFightState(): FightState {
  return {
    fishDistance: 0,
    fishStamina: 1,
    tension: 0,
    drag: 0.5,
    fishDirection: 0,
    fishBursting: false,
    burstTimer: 0,
    slackTimer: 0,
    criticalTimer: 0,
    surfaceSplash: false,
  };
}

export function createInitialGameState(): GameState {
  return {
    fishingState: 'ready',
    cast: createInitialCastState(),
    bite: createInitialBiteState(),
    fight: createInitialFightState(),
    gameTime: 8 * 60, // Start at 8:00 AM (in minutes)
    timeOfDay: 'morning',
    weather: 'clear',
    zone: 'open',
    message: 'Выберите наживку и забросьте снасть',
    lastCatch: null,
    isRecord: false,
    isTrophy: false,
  };
}

export function getTimeOfDay(gameTimeMinutes: number): TimeOfDay {
  const hour = (gameTimeMinutes / 60) % 24;
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'day';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

export function getZoneFromDistance(distance: number): FishingZone {
  if (distance < 15) return 'shallow';
  if (distance < 35) return 'open';
  return 'deep';
}

export function calculateBiteProbability(
  species: SpeciesData,
  baitId: string,
  zone: FishingZone,
  timeOfDay: TimeOfDay
): number {
  const bait = getBaitById(baitId);
  let prob = 0;

  // Bait compatibility
  if (bait.suitableFor.includes(species.id)) {
    prob += 0.35;
    if (species.preferredBait.includes(baitId)) {
      prob += 0.15;
    }
  } else {
    prob += 0.05;
  }

  // Zone preference
  if (species.preferredZone === zone) {
    prob += 0.25;
  } else {
    const zoneDist = Math.abs(
      (species.preferredZone === 'shallow' ? 0 : species.preferredZone === 'open' ? 1 : 2) -
        (zone === 'shallow' ? 0 : zone === 'open' ? 1 : 2)
    );
    prob += Math.max(0, 0.25 - zoneDist * 0.12);
  }

  // Time of day
  prob += species.activityByTime[timeOfDay] * 0.3;

  // Random factor
  prob += (Math.random() - 0.3) * 0.15;

  return Math.max(0.02, Math.min(0.95, prob));
}

export function selectFishForBite(
  baitId: string,
  zone: FishingZone,
  timeOfDay: TimeOfDay
): { species: SpeciesData; weight: number; length: number } | null {
  const candidates = SPECIES.map((s) => ({
    species: s,
    prob: calculateBiteProbability(s, baitId, zone, timeOfDay),
  }));

  // Weight by probability
  const totalProb = candidates.reduce((sum, c) => sum + c.prob, 0);
  if (totalProb <= 0) return null;

  let roll = Math.random() * totalProb;
  for (const c of candidates) {
    roll -= c.prob;
    if (roll <= 0) {
      const weight = generateFishWeight(c.species);
      const length = generateFishLength(c.species, weight);
      return { species: c.species, weight, length };
    }
  }

  const fallback = candidates[candidates.length - 1].species;
  const weight = generateFishWeight(fallback);
  return { species: fallback, weight, length: generateFishLength(fallback, weight) };
}

export function calculateNextBiteDelay(
  baitId: string,
  zone: FishingZone,
  timeOfDay: TimeOfDay
): number {
  // Base delay 8-25 seconds, modified by conditions
  const bait = getBaitById(baitId);
  let baseDelay = 10 + Math.random() * 15;

  // Better bait and zone = shorter delay
  if (bait.suitableFor.length >= 3) baseDelay *= 0.85;
  if (zone === 'shallow') baseDelay *= 1.1; // shallow can be slower for some species
  if (zone === 'deep') baseDelay *= 1.0;

  // Time of day modifier
  if (timeOfDay === 'morning' || timeOfDay === 'evening') baseDelay *= 0.85;
  if (timeOfDay === 'night') baseDelay *= 1.3;

  return Math.max(5, Math.min(35, baseDelay));
}

export function updateFight(
  fight: FightState,
  deltaTime: number,
  isReeling: boolean,
  species: SpeciesData,
  fishWeight: number,
  lineLevel: number,
  rodLevel: number
): { fight: FightState; outcome: 'continue' | 'landed' | 'broken' | 'escaped' } {
  const newFight = { ...fight };

  const lineStrength = 4 + lineLevel * 3;
  const rodPower = 1 + rodLevel * 0.3;
  const maxTension = lineStrength * rodPower;

  // Fish movement
  newFight.burstTimer -= deltaTime;
  if (newFight.burstTimer <= 0) {
    // Decide next behavior
    const roll = Math.random();
    if (roll < 0.3) {
      newFight.fishBursting = true;
      newFight.burstTimer = 1.5 + Math.random() * 2.5;
      newFight.fishDirection = (Math.random() - 0.5) * Math.PI * 0.5;
      newFight.surfaceSplash = true;
    } else if (roll < 0.6) {
      newFight.fishBursting = false;
      newFight.burstTimer = 2 + Math.random() * 3;
      newFight.fishDirection = (Math.random() - 0.5) * Math.PI * 0.3;
      newFight.surfaceSplash = false;
    } else {
      newFight.fishBursting = false;
      newFight.burstTimer = 1 + Math.random() * 2;
      newFight.fishDirection = (Math.random() - 0.5) * Math.PI * 0.15;
      newFight.surfaceSplash = false;
    }
  }

  // Stamina
  const strengthFactor = species.fightStrength * (fishWeight / species.typicalWeight);
  const staminaDrain = isReeling
    ? 0.02 + strengthFactor * 0.015
    : -0.008 - strengthFactor * 0.005;
  newFight.fishStamina = Math.max(0, Math.min(1, newFight.fishStamina - staminaDrain * deltaTime));

  // Distance
  const reelingPull = isReeling ? (2.5 + rodPower * 1.5) * deltaTime : 0;
  const fishRun = newFight.fishBursting
    ? (0.8 + strengthFactor * 1.2) * deltaTime * (0.5 + newFight.fishStamina * 0.5)
    : 0;
  const fishTiring = newFight.fishStamina < 0.3 ? -0.3 * deltaTime : 0;

  newFight.fishDistance += fishRun + fishTiring - reelingPull;
  newFight.fishDistance = Math.max(0, Math.min(80, newFight.fishDistance));

  // Tension
  const baseTension = isReeling
    ? 0.3 + strengthFactor * 0.4 + (newFight.fishBursting ? 0.3 : 0)
    : 0.1 + strengthFactor * 0.15;
  const dragFactor = fight.drag * 0.5;
  const targetTension = baseTension + dragFactor + (newFight.fishBursting ? 0.2 : 0);
  newFight.tension += (targetTension - newFight.tension) * deltaTime * 3;
  newFight.tension = Math.max(0, Math.min(1.2, newFight.tension));

  // Critical tension tracking
  if (newFight.tension > 0.85) {
    newFight.criticalTimer += deltaTime;
    if (newFight.criticalTimer > 2.5) {
      return { fight: newFight, outcome: 'broken' };
    }
  } else {
    newFight.criticalTimer = Math.max(0, newFight.criticalTimer - deltaTime * 2);
  }

  // Slack line
  if (newFight.tension < 0.1) {
    newFight.slackTimer += deltaTime;
    if (newFight.slackTimer > 5) {
      return { fight: newFight, outcome: 'escaped' };
    }
  } else {
    newFight.slackTimer = Math.max(0, newFight.slackTimer - deltaTime * 3);
  }

  // Landing check
  if (newFight.fishDistance <= 2 && newFight.fishStamina < 0.35) {
    return { fight: newFight, outcome: 'landed' };
  }

  // Escape if fish reaches too far with high stamina
  if (newFight.fishDistance >= 75 && newFight.fishStamina > 0.6) {
    return { fight: newFight, outcome: 'escaped' };
  }

  return { fight: newFight, outcome: 'continue' };
}

export function createCatchResult(
  speciesId: string,
  weight: number,
  length: number,
  baitId: string,
  zone: FishingZone
): CaughtFish {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    speciesId,
    weight,
    length,
    baitId,
    caughtAt: Date.now(),
    zone,
  };
}

export function calculateXP(catchData: CaughtFish): number {
  const species = getSpeciesById(catchData.speciesId);
  const weightFactor = catchData.weight / species.typicalWeight;
  const baseXP = 10 + species.fightStrength * 15;
  const weightXP = weightFactor * 20;
  const trophyBonus = catchData.weight >= species.trophyThreshold ? 50 : 0;
  return Math.round(baseXP + weightXP + trophyBonus);
}

export function calculateSaleValue(catchData: CaughtFish): number {
  const species = getSpeciesById(catchData.speciesId);
  return Math.round(catchData.weight * species.pricePerKg);
}

export function calculateLevel(xp: number): number {
  // Level thresholds: 0, 100, 250, 500, 900, 1400, 2100, 3000, ...
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

export function xpForLevel(level: number): number {
  return Math.pow(level - 1, 2) * 50;
}

export function formatWeight(weight: number): string {
  return `${weight.toFixed(2).replace('.', ',')} кг`;
}

export function formatLength(length: number): string {
  return `${Math.round(length)} см`;
}

export function formatMoney(amount: number): string {
  return `${amount.toLocaleString('ru-RU')} ₽`;
}
