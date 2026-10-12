"use client";

import { createContext, useContext } from "react";
import type { FishingSim } from "@/lib/game/simulation";
import type {
  BaitId,
  CatchResultInfo,
  PanelId,
  Phase,
  Profile,
  Settings,
  WeatherId,
} from "@/lib/game/types";

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "good" | "bad";
}

export interface HudData {
  phase: Phase;
  power: number;
  predictedDistance: number;
  aimValid: boolean;
  aimDistance: number;
  aimZoneLabel: string | null;
  castDistance: number;
  castZoneLabel: string | null;
  castDepth: number;
  tension: number;
  stamina: number;
  fishDistance: number;
  fishWeight: number;
  fishSpeciesId: string | null;
  drag: number;
  maxDrag: number;
  reeling: boolean;
  floatY: number;
  floatNibble: number;
  strikeProgress: number;
  timeHour: number;
  weather: WeatherId;
  retrievingProgress: number;
  critical: boolean;
  warning: boolean;
}

export type HudCallback = (data: HudData) => void;

export interface GameApi {
  sim: FishingSim;
  profile: Profile;
  phase: Phase;
  panel: PanelId | null;
  touch: boolean;
  result: CatchResultInfo | null;
  toasts: Toast[];
  openPanel: (p: PanelId) => void;
  closePanel: () => void;
  switchPanel: (p: PanelId) => void;
  selectBait: (id: BaitId) => void;
  buy: (itemId: string) => void;
  sellAll: () => void;
  keepFish: () => void;
  releaseFish: () => void;
  resetProgress: () => void;
  updateSettings: (s: Partial<Settings>) => void;
  adjustDrag: (delta: number) => void;
  startRetrieve: () => void;
  primaryDown: () => void;
  primaryUp: () => void;
  registerHud: (cb: HudCallback) => () => void;
}

export const GameContext = createContext<GameApi | null>(null);

export function useGame(): GameApi {
  const api = useContext(GameContext);
  if (!api) throw new Error("GameContext missing");
  return api;
}
