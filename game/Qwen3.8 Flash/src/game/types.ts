/** Shared game types. Pure data — no Three.js / React imports here. */

export type Phase =
  | 'ready'
  | 'charging'
  | 'casting'
  | 'waiting'
  | 'investigating'
  | 'strike'
  | 'fighting'
  | 'result'
  | 'retrieving';

export type SpeciesId = 'karas' | 'plotva' | 'okun' | 'leshch' | 'karp' | 'shchuka';
export type BaitId = 'cherv' | 'oparysh' | 'kukuruza' | 'zhivets';
export type ZoneId = 'shallow' | 'mid' | 'deep';
export type Quality = 'low' | 'medium' | 'high';

export interface Fish {
  uid: string;
  species: SpeciesId;
  weight: number; // kg
  length: number; // cm
  bait: BaitId;
  zone: ZoneId;
  hour: number; // in-game hours at catch
  caughtAt: number; // real timestamp
  trophy: boolean;
  record: boolean;
  value: number; // rubles
  xp: number;
}

export interface Settings {
  sound: boolean;
  sensitivity: number; // 0.3 .. 2.5
  quality: Quality;
  floatView: boolean; // magnified float inset
  hintRipples: boolean;
}

export interface SpeciesRecord {
  weight: number;
  length: number;
  hour: number;
  bait: BaitId;
  caughtAt: number;
}

export interface SaveData {
  version: number;
  money: number;
  xp: number;
  rodId: string;
  lineId: string;
  netId: string;
  bait: Record<BaitId, number>;
  selectedBait: BaitId;
  keepnet: Fish[];
  records: Partial<Record<SpeciesId, SpeciesRecord>>;
  history: Fish[];
  totalCaught: number;
  totalReleased: number;
  totalWeight: number;
  bestCatch: Fish | null;
  settings: Settings;
}

export interface ActiveFish {
  species: SpeciesId;
  weight: number;
  length: number;
  bait: BaitId;
  zone: ZoneId;
  depth: number;
  /** fight runtime */
  stamina: number; // 0..1
  distance: number; // m from angler
  angle: number; // rad offset from the cast direction
  x: number; // world
  z: number; // world
  burst: number; // 0..1 current burst intensity
  behaviour: FishBehaviour;
  behaviourTime: number;
  /** +1 / -1: which way the fish swims across the cast line */
  turnSign: number;
  fightDifficulty: number;
}

export type FishBehaviour = 'cross' | 'run' | 'rest' | 'sulk' | 'headed';

export type MessageKind = 'info' | 'good' | 'warn' | 'bad';

export interface GameMessage {
  text: string;
  kind: MessageKind;
  life: number;
  id: number;
}

export type CastTarget = import('./lake').SpotInfo;

export interface WeatherState {
  id: 'sun' | 'clouds' | 'overcast' | 'windy' | 'drizzle';
  name: string;
  wind: number; // 0..1
  biteFactor: number;
  lightFactor: number;
}

export type SimEvent =
  | { type: 'phase'; phase: Phase }
  | { type: 'message'; text: string; kind: MessageKind }
  | { type: 'castStarted'; target: CastTarget }
  | { type: 'castLanded'; target: CastTarget }
  | { type: 'splash'; x: number; z: number; power: number }
  | { type: 'rigRetrieved' }
  | { type: 'biteStart' }
  | { type: 'biteCommit' }
  | { type: 'tick'; strength: number }
  | { type: 'hooked' }
  | { type: 'missed' }
  | { type: 'scared' }
  | { type: 'baitStolen' }
  | { type: 'run'; power: number }
  | { type: 'lineSnapped' }
  | { type: 'fishEscaped' }
  | { type: 'landed'; fish: Fish }
  | { type: 'levelUp'; level: number }
  | { type: 'purchased'; name: string }
  | { type: 'sold'; sum: number }
  | { type: 'dirty' };

export interface DragOption {
  id: string;
  name: string;
  desc: string;
  price: number;
  kind: 'bait' | 'rod' | 'line' | 'net';
  bait?: BaitId;
  amount?: number;
}

export interface HudSnapshot {
  phase: Phase;
  phaseLabel: string;
  message: GameMessage | null;
  instructions: string[];
  timeLabel: string;
  hour: number;
  weather: string;
  zoneName: string;
  depth: number;
  power: number;
  estimatedDistance: number;
  rigDistance: number;
  waitRemaining: number;
  waitTotal: number;
  biteProgress: number;
  strikeRemaining: number;
  strikeTotal: number;
  baitId: BaitId;
  baitName: string;
  baitLeft: number;
  baitList: { id: BaitId; name: string; left: number; active: boolean }[];
  rodName: string;
  lineName: string;
  lineStrength: number;
  netName: string;
  money: number;
  xp: number;
  level: number;
  levelProgress: number;
  levelNeeded: number;
  xpToNext: number;
  drag: number;
  tension: number;
  tensionLimit: number;
  fishDistance: number;
  fishStamina: number;
  fishBehaviour: string;
  hookedSpeciesName: string | null;
  hookedSpeciesWeight: [number, number];
  result: Fish | null;
  resultIsRecord: boolean;
  netCount: number;
  netCapacity: number;
  netWeight: number;
  netValue: number;
  canCast: boolean;
  canRetrieve: boolean;
  shop: { items: (DragOption & { owned: boolean; affordable: boolean })[] };
  records: { species: SpeciesId; ru: string; en: string; weight: number; length: number; hour: number }[];
  history: Fish[];
  totalCaught: number;
  castCount: number;
  soundOn: boolean;
}
