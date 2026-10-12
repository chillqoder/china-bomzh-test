import { PlayerProgress, GameSettings, CaughtFish } from './types';
import { BAITS } from './bait';
import { calculateLevel } from './simulation';

const PROGRESS_KEY = 'fishing_progress';
const SETTINGS_KEY = 'fishing_settings';

export function createDefaultProgress(): PlayerProgress {
  return {
    money: 500,
    xp: 0,
    level: 1,
    equipment: { rodLevel: 1, lineLevel: 1, keepnetLevel: 1 },
    bait: {
      worm: 15,
      maggot: 20,
      corn: 10,
      livebait: 8,
    },
    keepnet: [],
    records: {},
    history: [],
    selectedBait: 'worm',
    totalCatches: 0,
    totalReleased: 0,
    totalSold: 0,
  };
}

export function createDefaultSettings(): GameSettings {
  return {
    soundEnabled: true,
    mouseSensitivity: 1.0,
    graphicsQuality: 'medium',
  };
}

export function loadProgress(): PlayerProgress {
  if (typeof window === 'undefined') return createDefaultProgress();
  try {
    const stored = localStorage.getItem(PROGRESS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure level is consistent with XP
      parsed.level = calculateLevel(parsed.xp);
      return { ...createDefaultProgress(), ...parsed };
    }
  } catch (e) {
    console.error('Failed to load progress:', e);
  }
  return createDefaultProgress();
}

export function saveProgress(progress: PlayerProgress): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch (e) {
    console.error('Failed to save progress:', e);
  }
}

export function loadSettings(): GameSettings {
  if (typeof window === 'undefined') return createDefaultSettings();
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...createDefaultSettings(), ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return createDefaultSettings();
}

export function saveSettings(settings: GameSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export function getKeepnetCapacity(level: number): number {
  return 5 + level * 3;
}

export function getLineStrength(level: number): number {
  return 4 + level * 3;
}

export function getRodPower(level: number): number {
  return 1 + level * 0.3;
}
