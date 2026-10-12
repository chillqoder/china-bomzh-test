export type ZoneId = "reeds" | "open" | "deep";
export type BaitId = "worm" | "maggot" | "corn" | "livebait";
export type WeatherId = "clear" | "cloudy" | "rain";
export type QualityId = "low" | "medium" | "high";

export type Phase =
  | "ready"
  | "charging"
  | "casting"
  | "waiting"
  | "investigating"
  | "strike"
  | "fighting"
  | "result"
  | "retrieving";

export interface SpeciesColors {
  body: number;
  belly: number;
  fins: number;
  accent?: number;
}

export interface SpeciesShape {
  profilePow: number;
  headSharp: number;
  tailSharp: number;
  heightScale: number;
  widthScale: number;
  lengthScale: number;
  tailFork: number;
  dorsalPos: number;
  dorsalSize: number;
  spinyDorsal?: boolean;
  barbels?: boolean;
  stripes?: "vertical" | "spots";
  eyeSize: number;
}

export interface SpeciesDef {
  id: string;
  nameRu: string;
  nameEn: string;
  minW: number;
  maxW: number;
  weightExp: number;
  lengthA: number;
  strength: number;
  stamina: number;
  pricePerKg: number;
  trophyW: number;
  xpBase: number;
  baitAff: Record<BaitId, number>;
  zoneAff: Record<ZoneId, number>;
  activity: number[];
  colors: SpeciesColors;
  shape: SpeciesShape;
  descr: string;
  bestBaitsRu: string;
}

export interface FishInstance {
  speciesId: string;
  weight: number;
  length: number;
  value: number;
  caughtAtHour: number;
  baitId: BaitId;
  zone: ZoneId;
  isRecord: boolean;
  isTrophy: boolean;
}

export interface KeptFish {
  speciesId: string;
  weight: number;
  length: number;
  value: number;
  caughtAtHour: number;
  baitId: BaitId;
}

export interface RecordEntry {
  weight: number;
  length: number;
  atHour: number;
  baitId: BaitId;
}

export interface HistoryEntry {
  speciesId: string;
  weight: number;
  length: number;
  atHour: number;
  outcome: "kept" | "released" | "sold" | "escaped" | "broke";
}

export interface Settings {
  sound: boolean;
  volume: number;
  sensitivity: number;
  quality: QualityId;
}

export interface Profile {
  version: number;
  money: number;
  xp: number;
  bait: Record<BaitId, number>;
  selectedBait: BaitId;
  rodIndex: number;
  lineIndex: number;
  keepnetIndex: number;
  drag: number;
  keepnet: KeptFish[];
  records: Record<string, RecordEntry>;
  history: HistoryEntry[];
  stats: {
    totalCaught: number;
    totalReleased: number;
    totalSold: number;
    totalEarned: number;
    biggestWeight: number;
    biggestSpeciesId: string | null;
  };
  gameHours: number;
  settings: Settings;
}

export interface RodDef {
  id: string;
  nameRu: string;
  descr: string;
  price: number;
  castRange: number;
  reelSpeed: number;
  maxDrag: number;
}

export interface LineDef {
  id: string;
  nameRu: string;
  descr: string;
  price: number;
  ratingKg: number;
}

export interface KeepnetDef {
  id: string;
  nameRu: string;
  descr: string;
  price: number;
  capacity: number;
}

export interface BaitDef {
  id: BaitId;
  nameRu: string;
  descr: string;
  pricePer10: number;
  bestForRu: string;
}

export interface AimInfo {
  valid: boolean;
  distance: number;
  x: number;
  z: number;
  depth: number;
  zone: ZoneId | null;
}

export interface RigPos {
  x: number;
  y: number;
  z: number;
  onWater: boolean;
  visible: boolean;
}

export interface FightData {
  speciesId: string;
  weight: number;
  distance: number;
  baseDistance: number;
  tension: number;
  stamina: number;
  drag: number;
  fishX: number;
  fishY: number;
  fishZ: number;
  heading: number;
  reeling: boolean;
  critical: boolean;
  warning: boolean;
  behavior: string;
}

export interface FloatState {
  y: number;
  hidden: boolean;
  strikeProgress: number;
  nibble: number;
}

export interface FxEvent {
  kind: "splash" | "bigSplash" | "ripple" | "bubbles";
  x: number;
  z: number;
  power: number;
}

export interface SimSnapshot {
  phase: Phase;
  power: number;
  chargeHeldT: number;
  aim: AimInfo | null;
  rig: RigPos;
  floatState: FloatState;
  castDistance: number;
  castZone: ZoneId | null;
  castDepth: number;
  fight: FightData | null;
  timeHour: number;
  weather: WeatherId;
  retrievingProgress: number;
}

export type SimEvent =
  | { type: "phase"; phase: Phase }
  | { type: "profile" }
  | { type: "message"; text: string; kind: "info" | "good" | "bad" }
  | { type: "catch"; fish: FishInstance }
  | { type: "sound"; name: string; intensity?: number };

export type PanelId = "bait" | "keepnet" | "shop" | "records" | "settings" | "pause";

export interface CatchResultInfo {
  fish: FishInstance;
  speciesNameRu: string;
  speciesNameEn: string;
  isRecord: boolean;
  isTrophy: boolean;
  caughtAtLabel: string;
  zoneLabel: string;
  baitLabel: string;
}

export const ZONE_LABELS: Record<ZoneId, string> = {
  reeds: "У камышей",
  open: "Открытая вода",
  deep: "Глубина",
};

export const WEATHER_LABELS: Record<WeatherId, string> = {
  clear: "Ясно",
  cloudy: "Облачно",
  rain: "Небольшой дождь",
};
