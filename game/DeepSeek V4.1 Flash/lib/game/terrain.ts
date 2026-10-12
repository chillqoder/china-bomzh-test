export const LAKE_CENTER_X = 0;
export const LAKE_CENTER_Z = -30;
export const LAKE_RADIUS_X = 62;
export const LAKE_RADIUS_Z = 50;
export const LAKE_MAX_DEPTH = 3.9;

export const PLAYER_POS = { x: 1.5, z: 24.5 };
export const PLAYER_EYE = 1.65;

function hash2(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function smoothNoise(x: number, z: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi);
  const b = hash2(xi + 1, zi);
  const c = hash2(xi, zi + 1);
  const d = hash2(xi + 1, zi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

export function lakeDistance(x: number, z: number): number {
  const dx = (x - LAKE_CENTER_X) / LAKE_RADIUS_X;
  const dz = (z - LAKE_CENTER_Z) / LAKE_RADIUS_Z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function terrainHeight(x: number, z: number): number {
  const d = lakeDistance(x, z);
  let h = 0;
  if (d < 1) {
    h -= LAKE_MAX_DEPTH * (1 - d * d);
  }
  const landStart = 0.995;
  if (d > landStart) {
    const t = Math.min((d - landStart) * 8, 4.6);
    h += t;
  }
  if (h > -0.05) {
    const near = Math.min(1, Math.max(0, (d - 0.9) * 6));
    h += (smoothNoise(x * 0.14 + 11, z * 0.14 - 7) - 0.5) * 0.9 * near;
    h += (smoothNoise(x * 0.5, z * 0.5) - 0.5) * 0.18;
  }
  return h;
}

export function waterDepth(x: number, z: number): number {
  return Math.max(0, -terrainHeight(x, z));
}

export interface ReedCluster {
  x: number;
  z: number;
  radius: number;
  count: number;
}

function reedsAround(angleDeg: number, dist: number, radius: number, count: number): ReedCluster {
  const a = (angleDeg * Math.PI) / 180;
  const x = LAKE_CENTER_X + Math.sin(a) * (LAKE_RADIUS_X - dist);
  const z = LAKE_CENTER_Z + Math.cos(a) * (LAKE_RADIUS_Z - dist);
  return { x, z, radius, count };
}

export const REED_CLUSTERS: ReedCluster[] = [
  reedsAround(-5, 2, 3.0, 24),
  reedsAround(10, 3, 2.6, 18),
  reedsAround(-20, 6, 2.8, 20),
  reedsAround(25, 8, 2.4, 16),
  reedsAround(-40, 12, 2.4, 15),
  reedsAround(45, 16, 2.2, 14),
  reedsAround(-65, 20, 2.2, 14),
  reedsAround(70, 24, 2.0, 12),
  reedsAround(180, 6, 3.4, 22),
  reedsAround(150, 10, 2.6, 16),
  reedsAround(210, 12, 2.6, 16),
];

export function isInReeds(x: number, z: number): boolean {
  for (const c of REED_CLUSTERS) {
    const dx = x - c.x;
    const dz = z - c.z;
    if (dx * dx + dz * dz < (c.radius + 1.2) * (c.radius + 1.2)) return true;
  }
  return false;
}

export interface AimRayResult {
  hitWater: boolean;
  onLand: boolean;
  point: { x: number; z: number };
  distance: number;
  depth: number;
}

export function castRayToWater(
  origin: { x: number; y: number; z: number },
  yaw: number,
  pitch: number,
  maxRange: number
): AimRayResult {
  const cp = Math.cos(pitch);
  const dir = {
    x: -Math.sin(yaw) * cp,
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * cp,
  };
  let t: number;
  if (dir.y >= -0.001) {
    t = (0 - origin.y) / Math.min(dir.y, -0.001);
    t = Math.max(t, 200);
  } else {
    t = (0 - origin.y) / dir.y;
  }
  const px = origin.x + dir.x * t;
  const pz = origin.z + dir.z * t;
  const horiz = Math.hypot(px - origin.x, pz - origin.z);
  const depth = waterDepth(px, pz);
  return {
    hitWater: depth > 0.02,
    onLand: depth <= 0.02,
    point: { x: px, z: pz },
    distance: Math.min(horiz, maxRange),
    depth,
  };
}

export function flatDistance(x1: number, z1: number, x2: number, z2: number): number {
  return Math.hypot(x2 - x1, z2 - z1);
}
