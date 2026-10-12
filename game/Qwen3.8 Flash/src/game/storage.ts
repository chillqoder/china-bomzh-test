import type { SaveData, Settings } from './types';

export const STORAGE_KEY = 'prudok.fishing.save.v1';

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  sensitivity: 1,
  quality: 'medium',
  floatView: true,
  hintRipples: true,
};

export function defaultSave(): SaveData {
  return {
    version: 1,
    money: 640,
    xp: 0,
    rodId: 'rod_bamboo',
    lineId: 'line_35',
    netId: 'net_6',
    bait: { cherv: 12, oparysh: 10, kukuruza: 8, zhivets: 4 },
    selectedBait: 'cherv',
    keepnet: [],
    records: {},
    history: [],
    totalCaught: 0,
    totalReleased: 0,
    totalWeight: 0,
    bestCatch: null,
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** Never throws: a corrupt / absent save simply yields a fresh profile. */
export function loadSave(): SaveData {
  if (typeof window === 'undefined') return defaultSave();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const base = defaultSave();
    const merged: SaveData = {
      ...base,
      ...parsed,
      bait: { ...base.bait, ...(parsed.bait ?? {}) },
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      records: { ...(parsed.records ?? {}) },
      keepnet: Array.isArray(parsed.keepnet) ? parsed.keepnet : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
    return merged;
  } catch {
    return defaultSave();
  }
}

export function persistSave(data: SaveData): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage full / private mode — the run simply is not remembered */
  }
}

export function wipeSave(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/* ---------------------------------- levels --------------------------------- */

const XP_TABLE: number[] = [0];
{
  let need = 140;
  for (let i = 1; i <= 60; i++) {
    XP_TABLE[i] = XP_TABLE[i - 1] + Math.round(need);
    need *= 1.24;
  }
}

export function levelFromXp(xp: number): number {
  let lvl = 1;
  while (lvl < XP_TABLE.length - 1 && xp >= XP_TABLE[lvl]) lvl++;
  return lvl;
}

export function xpBounds(xp: number): { level: number; current: number; needed: number; floor: number } {
  const level = levelFromXp(xp);
  const floor = XP_TABLE[level - 1] ?? 0;
  const ceil = XP_TABLE[level] ?? floor + 200;
  return { level, current: xp - floor, needed: ceil - floor, floor };
}
