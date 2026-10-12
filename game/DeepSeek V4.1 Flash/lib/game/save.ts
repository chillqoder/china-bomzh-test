import type { BaitId, Profile, QualityId, Settings } from "./types";

const KEY = "ozero-fishing-save-v1";

export function defaultProfile(): Profile {
  return {
    version: 1,
    money: 250,
    xp: 0,
    bait: { worm: 15, maggot: 15, corn: 12, livebait: 8 },
    selectedBait: "worm",
    rodIndex: 0,
    lineIndex: 0,
    keepnetIndex: 0,
    drag: 3,
    keepnet: [],
    records: {},
    history: [],
    stats: {
      totalCaught: 0,
      totalReleased: 0,
      totalSold: 0,
      totalEarned: 0,
      biggestWeight: 0,
      biggestSpeciesId: null,
    },
    gameHours: 6,
    settings: {
      sound: true,
      volume: 0.6,
      sensitivity: 1,
      quality: "medium",
    },
  };
}

function sanitize(loaded: Partial<Profile>): Profile {
  const def = defaultProfile();
  const p: Profile = { ...def };
  if (typeof loaded.money === "number" && isFinite(loaded.money)) p.money = Math.max(0, loaded.money);
  if (typeof loaded.xp === "number" && isFinite(loaded.xp)) p.xp = Math.max(0, loaded.xp);
  if (loaded.bait && typeof loaded.bait === "object") {
    for (const id of ["worm", "maggot", "corn", "livebait"] as BaitId[]) {
      const v = (loaded.bait as Record<string, unknown>)[id];
      if (typeof v === "number" && isFinite(v)) p.bait[id] = Math.max(0, Math.floor(v));
    }
  }
  if (loaded.selectedBait && p.bait[loaded.selectedBait as BaitId] !== undefined) {
    p.selectedBait = loaded.selectedBait as BaitId;
  }
  p.rodIndex = clampInt(loaded.rodIndex, 0, 2, 0);
  p.lineIndex = clampInt(loaded.lineIndex, 0, 2, 0);
  p.keepnetIndex = clampInt(loaded.keepnetIndex, 0, 2, 0);
  if (typeof loaded.drag === "number" && isFinite(loaded.drag)) {
    p.drag = Math.min(12, Math.max(1, loaded.drag));
  }
  if (Array.isArray(loaded.keepnet)) {
    p.keepnet = loaded.keepnet
      .filter((f) => f && typeof f.weight === "number" && typeof f.speciesId === "string")
      .slice(0, 60)
      .map((f) => ({
        speciesId: f.speciesId,
        weight: f.weight,
        length: typeof f.length === "number" ? f.length : 20,
        value: typeof f.value === "number" ? f.value : 1,
        caughtAtHour: typeof f.caughtAtHour === "number" ? f.caughtAtHour : 6,
        baitId: (f.baitId ?? "worm") as BaitId,
      }));
  }
  if (loaded.records && typeof loaded.records === "object") {
    p.records = loaded.records;
  }
  if (Array.isArray(loaded.history)) {
    p.history = loaded.history.slice(-30);
  }
  if (loaded.stats && typeof loaded.stats === "object") {
    p.stats = { ...def.stats, ...loaded.stats };
  }
  if (typeof loaded.gameHours === "number" && isFinite(loaded.gameHours)) {
    p.gameHours = ((loaded.gameHours % 24) + 24) % 24;
  }
  if (loaded.settings && typeof loaded.settings === "object") {
    const s: Partial<Settings> = loaded.settings;
    if (typeof s.sound === "boolean") p.settings.sound = s.sound;
    if (typeof s.volume === "number") p.settings.volume = Math.min(1, Math.max(0, s.volume));
    if (typeof s.sensitivity === "number") {
      p.settings.sensitivity = Math.min(2.5, Math.max(0.2, s.sensitivity));
    }
    if (s.quality === "low" || s.quality === "medium" || s.quality === "high") {
      p.settings.quality = s.quality as QualityId;
    }
  }
  return p;
}

function clampInt(v: unknown, min: number, max: number, def: number): number {
  if (typeof v !== "number" || !isFinite(v)) return def;
  return Math.min(max, Math.max(min, Math.floor(v)));
}

export function loadProfile(): Profile {
  if (typeof window === "undefined") return defaultProfile();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw) as Partial<Profile>;
    return sanitize(parsed);
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(p: Profile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage full or unavailable — ignore
  }
}

export function clearProfile(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
