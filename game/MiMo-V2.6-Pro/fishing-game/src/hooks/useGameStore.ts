import { create } from 'zustand';
import {
  GameState,
  PlayerProgress,
  GameSettings,
  CaughtFish,
  FishingState,
} from '../game/types';
import {
  createInitialGameState,
  createInitialFightState,
  createInitialBiteState,
  createInitialCastState,
  getZoneFromDistance,
  getTimeOfDay,
  selectFishForBite,
  calculateNextBiteDelay,
  updateFight,
  createCatchResult,
  calculateXP,
  calculateSaleValue,
  calculateLevel,
} from '../game/simulation';
import {
  loadProgress,
  saveProgress,
  loadSettings,
  saveSettings,
  getKeepnetCapacity,
} from '../game/storage';
import { getBaitById } from '../game/bait';
import { getSpeciesById } from '../game/species';

interface GameStore {
  // Game state
  game: GameState;
  progress: PlayerProgress;
  settings: GameSettings;
  activePanel: string | null;
  isPaused: boolean;

  // Actions
  initGame: () => void;
  setState: (state: FishingState) => void;
  setMessage: (msg: string) => void;

  // Casting
  startCharging: () => void;
  updateCharge: (power: number) => void;
  cast: () => void;
  updateCastTrajectory: (progress: number) => void;
  landCast: () => void;

  // Biting
  updateBite: (delta: number) => void;
  setBitePhase: (phase: 'none' | 'nibble' | 'dip' | 'committed') => void;

  // Striking & fighting
  setHook: () => void;
  startFight: () => void;
  updateFightTick: (delta: number, isReeling: boolean) => void;
  setDrag: (drag: number) => void;

  // Results
  landFish: () => void;
  keepFish: () => void;
  releaseFish: () => void;

  // Retrieval
  retrieve: () => void;
  cancelCast: () => void;

  // Progression
  sellKeepnet: () => void;
  purchaseItem: (itemId: string) => void;
  selectBait: (baitId: string) => void;

  // UI
  openPanel: (panel: string) => void;
  closePanel: () => void;
  togglePause: () => void;
  updateSettings: (settings: Partial<GameSettings>) => void;

  // Time
  tickTime: (delta: number) => void;

  // Reset for reload
  resetToReady: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: createInitialGameState(),
  progress: loadProgress(),
  settings: loadSettings(),
  activePanel: null,
  isPaused: false,

  initGame: () => {
    const progress = loadProgress();
    const settings = loadSettings();
    set({
      progress,
      settings,
      game: createInitialGameState(),
      activePanel: null,
      isPaused: false,
    });
  },

  setState: (state) => {
    set((s) => ({ game: { ...s.game, fishingState: state } }));
  },

  setMessage: (msg) => {
    set((s) => ({ game: { ...s.game, message: msg } }));
  },

  startCharging: () => {
    const { game } = get();
    if (game.fishingState !== 'ready') return;
    set((s) => ({
      game: {
        ...s.game,
        fishingState: 'charging',
        cast: { ...s.game.cast, power: 0 },
        message: 'Зажмите для зарядки заброса, отпустите для броска',
      },
    }));
  },

  updateCharge: (power) => {
    set((s) => ({
      game: { ...s.game, cast: { ...s.game.cast, power: Math.min(1, power) } },
    }));
  },

  cast: () => {
    const { game, progress } = get();
    if (game.fishingState !== 'charging') return;
    const power = game.cast.power;
    const distance = 5 + power * 50; // 5 to 55 meters
    const targetX = (Math.random() - 0.5) * distance * 0.3;
    const targetZ = -distance;

    // Reject land casts (too close)
    if (distance < 5) {
      set((s) => ({
        game: {
          ...s.game,
          fishingState: 'ready',
          cast: createInitialCastState(),
          message: 'Слишком короткий заброс! Приманка упала на берег.',
        },
      }));
      return;
    }

    const zone = getZoneFromDistance(distance);
    set((s) => ({
      game: {
        ...s.game,
        fishingState: 'casting',
        cast: {
          power,
          distance,
          targetX,
          targetZ,
          trajectoryProgress: 0,
        },
        zone,
        message: 'Приманка летит...',
      },
    }));
  },

  updateCastTrajectory: (progress) => {
    set((s) => ({
      game: {
        ...s.game,
        cast: { ...s.game.cast, trajectoryProgress: progress },
      },
    }));
  },

  landCast: () => {
    const { game, progress } = get();
    // Consume bait
    const baitId = progress.selectedBait;
    const newBait = { ...progress.bait };
    if (newBait[baitId] && newBait[baitId] > 0) {
      newBait[baitId] -= 1;
    }

    const biteDelay = calculateNextBiteDelay(baitId, game.zone, game.timeOfDay);

    set((s) => ({
      progress: { ...s.progress, bait: newBait },
      game: {
        ...s.game,
        fishingState: 'waiting',
        bite: {
          ...createInitialBiteState(),
          timer: biteDelay,
        },
        message: 'Ждём поклёвку... Следите за поплавком',
      },
    }));

    saveProgress({ ...progress, bait: newBait });
  },

  updateBite: (delta) => {
    const { game } = get();
    if (game.fishingState !== 'waiting' && game.fishingState !== 'investigating' && game.fishingState !== 'strike')
      return;

    const newBite = { ...game.bite };

    if (game.fishingState === 'waiting') {
      newBite.timer -= delta;
      newBite.floatBobbing = Math.sin(Date.now() * 0.002) * 0.1;

      if (newBite.timer <= 0) {
        // Start investigating
        const { progress, game: g } = get();
        const fishData = selectFishForBite(progress.selectedBait, g.zone, g.timeOfDay);
        if (fishData) {
          newBite.phase = 'nibble';
          newBite.fishSpeciesId = fishData.species.id;
          newBite.fishWeight = fishData.weight;
          newBite.fishLength = fishData.length;
          newBite.timer = 2 + Math.random() * 3;
          newBite.floatDepth = 0.3;
          set((s) => ({
            game: {
              ...s.game,
              fishingState: 'investigating',
              bite: newBite,
              message: 'Рыба интересуется наживкой...',
            },
          }));
          return;
        }
      }
    } else if (game.fishingState === 'investigating') {
      newBite.timer -= delta;

      // Float movements
      if (newBite.phase === 'nibble') {
        newBite.floatBobbing = Math.sin(Date.now() * 0.005) * 0.3;
        newBite.floatDepth = 0.3 + Math.sin(Date.now() * 0.003) * 0.15;
        if (newBite.timer <= 0) {
          newBite.phase = 'dip';
          newBite.timer = 1.5 + Math.random() * 2;
          newBite.floatDepth = 0.6;
        }
      } else if (newBite.phase === 'dip') {
        newBite.floatBobbing = Math.sin(Date.now() * 0.008) * 0.5;
        newBite.floatDepth = 0.6 + Math.sin(Date.now() * 0.006) * 0.25;
        if (newBite.timer <= 0) {
          newBite.phase = 'committed';
          newBite.timer = 1.8 + Math.random() * 1.2; // Strike window
          newBite.strikeWindow = newBite.timer;
          newBite.floatDepth = 1.0;
          set((s) => ({
            game: {
              ...s.game,
              fishingState: 'strike',
              bite: newBite,
              message: 'ПОКЛЁВКА! Подсекайте!',
            },
          }));
          return;
        }
      }
    } else if (game.fishingState === 'strike') {
      newBite.timer -= delta;
      newBite.floatDepth = 1.0 + Math.sin(Date.now() * 0.01) * 0.2;
      newBite.floatBobbing = Math.sin(Date.now() * 0.012) * 0.6;

      if (newBite.timer <= 0) {
        // Missed strike
        set((s) => ({
          game: {
            ...s.game,
            fishingState: 'retrieving',
            bite: createInitialBiteState(),
            message: 'Рыба сорвалась с крючка! Попробуйте ещё раз.',
          },
        }));
        return;
      }
    }

    set((s) => ({ game: { ...s.game, bite: newBite } }));
  },

  setBitePhase: (phase) => {
    set((s) => ({
      game: { ...s.game, bite: { ...s.game.bite, phase } },
    }));
  },

  setHook: () => {
    const { game } = get();
    if (game.fishingState !== 'strike') {
      // Early strike - scare fish
      if (game.fishingState === 'investigating') {
        set((s) => ({
          game: {
            ...s.game,
            fishingState: 'retrieving',
            bite: createInitialBiteState(),
            message: 'Слишком рано! Рыба испугалась.',
          },
        }));
      }
      return;
    }

    const { progress, game: g } = get();
    const species = getSpeciesById(g.bite.fishSpeciesId);

    set((s) => ({
      game: {
        ...s.game,
        fishingState: 'fighting',
        fight: {
          ...createInitialFightState(),
          fishDistance: g.cast.distance * 0.8,
          fishStamina: 1,
          drag: 0.5,
        },
        message: `Подсекли ${species.nameRu.toLowerCase()}! Боритесь с рыбой!`,
      },
    }));
  },

  startFight: () => {
    // Handled in setHook
  },

  updateFightTick: (delta, isReeling) => {
    const { game, progress } = get();
    if (game.fishingState !== 'fighting') return;

    const species = getSpeciesById(game.bite.fishSpeciesId);
    const result = updateFight(
      game.fight,
      delta,
      isReeling,
      species,
      game.bite.fishWeight,
      progress.equipment.lineLevel,
      progress.equipment.rodLevel
    );

    if (result.outcome === 'landed') {
      get().landFish();
    } else if (result.outcome === 'broken') {
      set((s) => ({
        game: {
          ...s.game,
          fishingState: 'retrieving',
          fight: createInitialFightState(),
          bite: createInitialBiteState(),
          message: 'Леска оборвалась! Рыба ушла.',
        },
      }));
    } else if (result.outcome === 'escaped') {
      set((s) => ({
        game: {
          ...s.game,
          fishingState: 'retrieving',
          fight: createInitialFightState(),
          bite: createInitialBiteState(),
          message: 'Рыба сорвалась! Попробуйте ещё раз.',
        },
      }));
    } else {
      set((s) => ({
        game: { ...s.game, fight: result.fight },
      }));
    }
  },

  setDrag: (drag) => {
    set((s) => ({
      game: { ...s.game, fight: { ...s.game.fight, drag: Math.max(0, Math.min(1, drag)) } },
    }));
  },

  landFish: () => {
    const { game, progress } = get();
    const species = getSpeciesById(game.bite.fishSpeciesId);
    const catchData = createCatchResult(
      game.bite.fishSpeciesId,
      game.bite.fishWeight,
      game.bite.fishLength,
      progress.selectedBait,
      game.zone
    );

    const isRecord = !progress.records[catchData.speciesId] || catchData.weight > progress.records[catchData.speciesId];
    const isTrophy = catchData.weight >= species.trophyThreshold;

    set((s) => ({
      game: {
        ...s.game,
        fishingState: 'result',
        lastCatch: catchData,
        isRecord,
        isTrophy,
        fight: createInitialFightState(),
        bite: createInitialBiteState(),
        message: `Поймали ${species.nameRu.toLowerCase()}!`,
      },
    }));
  },

  keepFish: () => {
    const { game, progress } = get();
    if (!game.lastCatch) return;

    const capacity = getKeepnetCapacity(progress.equipment.keepnetLevel);
    if (progress.keepnet.length >= capacity) {
      set((s) => ({
        game: {
          ...s.game,
          message: 'Садок полон! Продайте рыбу или выпустите её.',
        },
      }));
      return;
    }

    const species = getSpeciesById(game.lastCatch.speciesId);
    const xpGain = calculateXP(game.lastCatch);
    const newXP = progress.xp + xpGain;
    const newLevel = calculateLevel(newXP);
    const newRecords = { ...progress.records };
    if (!newRecords[game.lastCatch.speciesId] || game.lastCatch.weight > newRecords[game.lastCatch.speciesId]) {
      newRecords[game.lastCatch.speciesId] = game.lastCatch.weight;
    }

    const newProgress: PlayerProgress = {
      ...progress,
      xp: newXP,
      level: newLevel,
      keepnet: [...progress.keepnet, game.lastCatch],
      records: newRecords,
      history: [game.lastCatch, ...progress.history].slice(0, 100),
      totalCatches: progress.totalCatches + 1,
    };

    saveProgress(newProgress);
    set({
      progress: newProgress,
      game: {
        ...game,
        fishingState: 'ready',
        lastCatch: null,
        cast: createInitialCastState(),
        message: `${species.nameRu} добавлен в садок. +${xpGain} опыта`,
      },
    });
  },

  releaseFish: () => {
    const { game, progress } = get();
    if (!game.lastCatch) return;

    const species = getSpeciesById(game.lastCatch.speciesId);
    const xpGain = calculateXP(game.lastCatch);
    const newXP = progress.xp + xpGain;
    const newLevel = calculateLevel(newXP);
    const newRecords = { ...progress.records };
    if (!newRecords[game.lastCatch.speciesId] || game.lastCatch.weight > newRecords[game.lastCatch.speciesId]) {
      newRecords[game.lastCatch.speciesId] = game.lastCatch.weight;
    }

    const newProgress: PlayerProgress = {
      ...progress,
      xp: newXP,
      level: newLevel,
      records: newRecords,
      history: [game.lastCatch, ...progress.history].slice(0, 100),
      totalCatches: progress.totalCatches + 1,
      totalReleased: progress.totalReleased + 1,
    };

    saveProgress(newProgress);
    set({
      progress: newProgress,
      game: {
        ...game,
        fishingState: 'ready',
        lastCatch: null,
        cast: createInitialCastState(),
        message: `${species.nameRu} отпущен на волю. +${xpGain} опыта`,
      },
    });
  },

  retrieve: () => {
    set((s) => ({
      game: {
        ...s.game,
        fishingState: 'ready',
        bite: createInitialBiteState(),
        fight: createInitialFightState(),
        cast: createInitialCastState(),
        message: 'Снасть вымотана. Готов к забросу.',
      },
    }));
  },

  cancelCast: () => {
    set((s) => ({
      game: {
        ...s.game,
        fishingState: 'ready',
        cast: createInitialCastState(),
        bite: createInitialBiteState(),
        message: 'Заброс отменён.',
      },
    }));
  },

  sellKeepnet: () => {
    const { progress } = get();
    if (progress.keepnet.length === 0) return;

    const totalValue = progress.keepnet.reduce((sum, fish) => sum + calculateSaleValue(fish), 0);
    const newProgress: PlayerProgress = {
      ...progress,
      money: progress.money + totalValue,
      keepnet: [],
      totalSold: progress.totalSold + progress.keepnet.length,
    };

    saveProgress(newProgress);
    set({
      progress: newProgress,
      game: { ...get().game, message: `Продано рыбы на ${totalValue} ₽` },
    });
  },

  purchaseItem: (itemId) => {
    const { progress } = get();
    const { SHOP_ITEMS } = require('../game/shop');
    const item = SHOP_ITEMS.find((i: any) => i.id === itemId);
    if (!item || progress.money < item.price || progress.level < item.level) return;

    const newProgress = { ...progress, money: progress.money - item.price };

    if (item.type === 'bait') {
      const baitId = item.id.replace('bait_', '');
      const amount = item.id === 'bait_maggot' ? 15 : item.id === 'bait_livebait' ? 5 : 10;
      newProgress.bait = {
        ...newProgress.bait,
        [baitId]: (newProgress.bait[baitId] || 0) + amount,
      };
    } else if (item.type === 'line') {
      newProgress.equipment = {
        ...newProgress.equipment,
        lineLevel: Math.min(4, newProgress.equipment.lineLevel + 1),
      };
    } else if (item.type === 'rod') {
      newProgress.equipment = {
        ...newProgress.equipment,
        rodLevel: Math.min(4, newProgress.equipment.rodLevel + 1),
      };
    } else if (item.type === 'keepnet') {
      newProgress.equipment = {
        ...newProgress.equipment,
        keepnetLevel: Math.min(4, newProgress.equipment.keepnetLevel + 1),
      };
    }

    saveProgress(newProgress);
    set({ progress: newProgress });
  },

  selectBait: (baitId) => {
    const { progress } = get();
    const newProgress = { ...progress, selectedBait: baitId };
    saveProgress(newProgress);
    set({ progress: newProgress });
  },

  openPanel: (panel) => set({ activePanel: panel }),
  closePanel: () => set({ activePanel: null }),
  togglePause: () => set((s) => ({ isPaused: !s.isPaused })),

  updateSettings: (newSettings) => {
    const { settings } = get();
    const merged = { ...settings, ...newSettings };
    saveSettings(merged);
    set({ settings: merged });
  },

  tickTime: (delta) => {
    set((s) => {
      const newGameTime = s.game.gameTime + delta * 0.5; // Accelerated time
      const newTimeOfDay = getTimeOfDay(newGameTime);
      return {
        game: {
          ...s.game,
          gameTime: newGameTime,
          timeOfDay: newTimeOfDay,
        },
      };
    });
  },

  resetToReady: () => {
    set((s) => ({
      game: {
        ...s.game,
        fishingState: 'ready',
        cast: createInitialCastState(),
        bite: createInitialBiteState(),
        fight: createInitialFightState(),
        message: 'Готов к рыбалке!',
      },
    }));
  },
}));
