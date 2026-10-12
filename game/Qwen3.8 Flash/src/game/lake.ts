/**
 * The lake shape, depth model and fishing zones.
 * Shared by the simulation (zone / depth logic) and the renderer (geometry),
 * so the visible shoreline and the gameplay maths can never disagree.
 */

import { clamp, smoothstep } from './rng';
import type { ZoneId } from './types';

export const LAKE_CENTER = { x: 0, z: -40 };
export const LAKE_BASE_RADIUS = 44;

/** The angler's fixed spot: 1.6 m of dry sand in front of the water. */
export const PLAYER_POS = { x: 0, z: 3.8 };
export const EYE_HEIGHT = 1.62;

/** Water radius for a direction (radians, measured from the lake centre). */
export function lakeRadiusAt(theta: number): number {
  return (
    LAKE_BASE_RADIUS +
    3.6 * Math.sin(theta * 3 + 0.4) +
    2.2 * Math.sin(theta * 2 - 1.1) +
    1.1 * Math.sin(theta * 5 + 2.0)
  );
}

export interface LakeProbe {
  inside: boolean;
  /** metres from the point to the shoreline; > 0 means open water */
  toShore: number;
  rho: number;
}

export function probe(x: number, z: number): LakeProbe {
  const dx = x - LAKE_CENTER.x;
  const dz = z - LAKE_CENTER.z;
  const theta = Math.atan2(dz, dx);
  const r = Math.hypot(dx, dz);
  const R = lakeRadiusAt(theta);
  return { inside: r < R, toShore: R - r, rho: r / R };
}

export function isWater(x: number, z: number): boolean {
  return probe(x, z).inside;
}

/** Deep pocket, the place where the biggest fish hold in the daytime. */
export const PIT = { x: -15, z: -55, radius: 13, extra: 2.3 };

export function depthAt(x: number, z: number): number {
  const p = probe(x, z);
  if (!p.inside) return 0;
  const bowl = Math.pow(Math.max(0, 1 - p.rho * p.rho), 1.35);
  let d = 5.6 * bowl;
  const pd = Math.hypot(x - PIT.x, z - PIT.z);
  if (pd < PIT.radius) {
    d += PIT.extra * Math.pow(Math.cos((pd / PIT.radius) * Math.PI * 0.5), 1.5);
  }
  return Math.max(0, d);
}

export function zoneOf(depth: number): ZoneId {
  if (depth < 1.25) return 'shallow';
  if (depth < 2.9) return 'mid';
  return 'deep';
}

/** Reeds grow in the calm shallow belt, in patches all around the lake. */
export function reedFactor(x: number, z: number): number {
  const dx = x - LAKE_CENTER.x;
  const dz = z - LAKE_CENTER.z;
  const theta = Math.atan2(dz, dx);
  const v = 0.5 + 0.5 * Math.sin(theta * 2 + 1.2) * Math.cos(theta * 3 - 0.4);
  return smoothstep(0.6, 0.85, v);
}

export function zoneName(depth: number, x: number, z: number): string {
  const z0 = zoneOf(depth);
  if (z0 === 'deep') return 'Глубокая яма';
  if (z0 === 'shallow') return reedFactor(x, z) > 0.4 ? 'Заводь у камышей' : 'Прибрежная мель';
  return 'Открытая вода';
}

export interface SpotInfo {
  x: number;
  z: number;
  distance: number;
  depth: number;
  zone: ZoneId;
  zoneName: string;
  reedy: boolean;
  onLand: boolean;
}

/** Describe a point relative to the angler — used for aiming + casting. */
export function describeSpot(x: number, z: number): SpotInfo {
  const distance = Math.hypot(x - PLAYER_POS.x, z - PLAYER_POS.z);
  const depth = depthAt(x, z);
  const p = probe(x, z);
  return {
    x,
    z,
    distance,
    depth,
    zone: zoneOf(depth),
    zoneName: zoneName(depth, x, z),
    reedy: reedFactor(x, z) > 0.4 && depth < 1.4,
    onLand: !p.inside || depth < 0.12,
  };
}

/** Point at `distance` metres from the angler along a unit direction. */
export function spotFrom(dirX: number, dirZ: number, distance: number): SpotInfo {
  const len = Math.hypot(dirX, dirZ) || 1;
  const ux = dirX / len;
  const uz = dirZ / len;
  return describeSpot(PLAYER_POS.x + ux * distance, PLAYER_POS.z + uz * distance);
}

export const MAX_CAST_RANGE = 52;
export const LAND_DIST = 3.6; // how close to the bank a fish must come to be netted

/** Height of the terrain outside the lake (bank, meadow, forest floor). */
export function groundHeightAt(x: number, z: number): number {
  const p = probe(x, z);
  const out = Math.max(0, -p.toShore); // metres inland
  const bank = 0.55 * smoothstep(0, 3.2, out) + 0.35 * smoothstep(3.2, 12, out);
  const rolling =
    0.9 * Math.sin(x * 0.045 + 1.1) * Math.cos(z * 0.037 - 0.4) +
    0.55 * Math.sin(x * 0.021 - 2.2) * Math.sin(z * 0.026 + 0.9);
  const far = smoothstep(24, 95, out) * 3.4;
  return bank + rolling * (0.35 + smoothstep(2, 20, out)) + far;
}

export function surfaceColorAt(x: number, z: number): 'sand' | 'earth' | 'grass' {
  const p = probe(x, z);
  const out = -p.toShore;
  if (out < 1.4) return 'sand';
  if (out < 4.5) return 'earth';
  return 'grass';
}

export const clamp01 = (v: number) => clamp(v, 0, 1);
