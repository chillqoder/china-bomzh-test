import type { WeatherState } from './types';
import { clamp, lerp } from './rng';

export const WEATHERS: Record<WeatherState['id'], WeatherState> = {
  sun: { id: 'sun', name: 'Ясно', wind: 0.16, biteFactor: 1.0, lightFactor: 1.0 },
  clouds: { id: 'clouds', name: 'Переменная облачность', wind: 0.32, biteFactor: 1.08, lightFactor: 0.9 },
  overcast: { id: 'overcast', name: 'Пасмурно', wind: 0.38, biteFactor: 1.16, lightFactor: 0.74 },
  windy: { id: 'windy', name: 'Ветер, рябь', wind: 0.85, biteFactor: 0.92, lightFactor: 0.86 },
  drizzle: { id: 'drizzle', name: 'Морось', wind: 0.5, biteFactor: 1.22, lightFactor: 0.62 },
};

const ORDER: WeatherState['id'][] = ['sun', 'clouds', 'overcast', 'windy', 'drizzle', 'clouds', 'sun'];

export function pickWeather(r: () => number, hour: number): WeatherState {
  // early morning on a calm lake is mostly clear / lightly cloudy
  const calmDawn = hour < 8 || hour > 20;
  const pool = calmDawn ? ORDER.filter((i) => i !== 'windy') : ORDER;
  return WEATHERS[pool[Math.floor(r() * pool.length) % pool.length]];
}

/** Sky / light tint multipliers used by the renderer. */
export function weatherTone(w: WeatherState): { saturation: number; brightness: number } {
  return {
    saturation: w.id === 'overcast' || w.id === 'drizzle' ? 0.55 : 1,
    brightness: lerp(0.8, 1.05, clamp(w.lightFactor, 0, 1)),
  };
}
