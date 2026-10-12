export type FishingState =
  | 'ready'
  | 'charging'
  | 'casting'
  | 'waiting'
  | 'investigating'
  | 'strike'
  | 'fighting'
  | 'result'
  | 'retrieving'
  | 'paused';

export type FishingZone = 'shallow' | 'open' | 'deep';

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';

export type Weather = 'clear' | 'cloudy' | 'overcast';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface SpeciesData {
  id: string;
  nameRu: string;
  nameEn: string;
  minWeight: number;
  maxWeight: number;
  typicalWeight: number;
  weightDistribution: 'normal' | 'skewed-small';
  preferredBait: string[];
  preferredZone: FishingZone;
  preferredDepth: [number, number];
  activityByTime: Record<TimeOfDay, number>;
  fightStrength: number;
  stamina: number;
  pricePerKg: number;
  trophyThreshold: number;
  color: string;
  bodyType: 'deep' | 'slim' | 'tall' | 'heavy' | 'elongated';
  hasBarbels: boolean;
  hasStripes: boolean;
  dorsalType: 'normal' | 'spiky' | 'rear';
}

export interface BaitData {
  id: string;
  name: string;
  description: string;
  suitableFor: string[];
  price: number;
  quantity: number;
}

export interface CaughtFish {
  id: string;
  speciesId: string;
  weight: number;
  length: number;
  baitId: string;
  caughtAt: number;
  zone: FishingZone;
}

export interface Equipment {
  rodLevel: number;
  lineLevel: number;
  keepnetLevel: number;
}

export interface PlayerProgress {
  money: number;
  xp: number;
  level: number;
  equipment: Equipment;
  bait: Record<string, number>;
  keepnet: CaughtFish[];
  records: Record<string, number>;
  history: CaughtFish[];
  selectedBait: string;
  totalCatches: number;
  totalReleased: number;
  totalSold: number;
}

export interface GameSettings {
  soundEnabled: boolean;
  mouseSensitivity: number;
  graphicsQuality: GraphicsQuality;
}

export interface FightState {
  fishDistance: number;
  fishStamina: number;
  tension: number;
  drag: number;
  fishDirection: number;
  fishBursting: boolean;
  burstTimer: number;
  slackTimer: number;
  criticalTimer: number;
  surfaceSplash: boolean;
}

export interface CastState {
  power: number;
  distance: number;
  targetX: number;
  targetZ: number;
  trajectoryProgress: number;
}

export interface BiteState {
  phase: 'none' | 'nibble' | 'dip' | 'committed';
  timer: number;
  strikeWindow: number;
  fishSpeciesId: string;
  fishWeight: number;
  fishLength: number;
  floatDepth: number;
  floatBobbing: number;
}

export interface GameState {
  fishingState: FishingState;
  cast: CastState;
  bite: BiteState;
  fight: FightState;
  gameTime: number;
  timeOfDay: TimeOfDay;
  weather: Weather;
  zone: FishingZone;
  message: string;
  lastCatch: CaughtFish | null;
  isRecord: boolean;
  isTrophy: boolean;
}
