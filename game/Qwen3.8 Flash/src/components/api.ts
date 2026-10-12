import type { BaitId, Settings, SpeciesId } from '@/game/types';
import type { Simulation } from '@/game/simulation';

/** The narrow interface the React HUD uses to talk to the engine. */
export interface GameApi {
  selectBait(id: BaitId): void;
  buy(id: string): void;
  sell(): void;
  setDrag(v: number): void;
  adjustDrag(delta: number): void;
  retrieve(): void;
  press(): void;
  release(): void;
  aim(deltaYaw: number): void;
  resolve(action: 'keep' | 'release'): void;
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void;
  reset(): void;
  attachPreview(canvas: HTMLCanvasElement, species: SpeciesId, lengthCm: number): void;
  sim(): Simulation | null;
}
