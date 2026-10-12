/** Tiny deterministic-friendly RNG + helpers (no external deps). */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rand = () => number;

export const randRange = (r: Rand, min: number, max: number) => min + r() * (max - min);

export const randInt = (r: Rand, min: number, max: number) =>
  Math.floor(min + r() * (max - min + 1));

export function chance(r: Rand, p: number) {
  return r() < p;
}

/** Weighted pick. Returns index, or -1 when total weight is not positive. */
export function weightedIndex(weights: number[], r: Rand): number {
  let total = 0;
  for (let i = 0; i < weights.length; i++) if (weights[i] > 0) total += weights[i];
  if (total <= 0) return -1;
  let x = r() * total;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] <= 0) continue;
    x -= weights[i];
    if (x <= 0) return i;
  }
  return weights.length - 1;
}

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Cheap value noise, good enough for scattering props / shoreline bumps. */
export function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function noise2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export const clamp01 = (v: number) => clamp(v, 0, 1);
