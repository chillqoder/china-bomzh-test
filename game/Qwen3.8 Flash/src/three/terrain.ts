/**
 * Procedural lakeside terrain: ground mesh with baked colours, reed belts,
 * birch + pine forest, a distant tree line, angular rocks, a wooden pier and
 * the angler's little camp (bucket, tackle box, folding stool).
 */

import * as THREE from 'three';
import {
  LAKE_BASE_RADIUS,
  LAKE_CENTER,
  PLAYER_POS,
  depthAt,
  groundHeightAt,
  isWater,
  lakeRadiusAt,
  probe,
  reedFactor,
} from '@/game/lake';
import { hash2, noise2 } from '@/game/rng';
import { disposeObject, makeSwayMaterial, mergeGeos, smoothstep } from './utils';
import type { Quality } from '@/game/types';

export const PLAYER_GROUND_Y = groundHeightAt(PLAYER_POS.x, PLAYER_POS.z);

const GRID_SIZE = 300;

function gridStep(q: Quality) {
  return q === 'low' ? 3.1 : q === 'medium' ? 2.0 : 1.35;
}

const C = {
  silt: new THREE.Color(0x4d4a2a),
  wetSand: new THREE.Color(0x9d8a5c),
  sand: new THREE.Color(0xd9c691),
  earth: new THREE.Color(0x7d5f3c),
  grass: new THREE.Color(0x5f7f3c),
  grassDry: new THREE.Color(0x87904a),
  forestFloor: new THREE.Color(0x3f5228),
};

/** Big faceted ground mesh that also forms the lake bed. */
export function buildGround(quality: Quality): THREE.Mesh {
  const step = gridStep(quality);
  const n = Math.floor(GRID_SIZE / step);
  const geo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, n, n);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const half = GRID_SIZE / 2;
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) - half + LAKE_CENTER.x;
    const z = pos.getZ(i) + LAKE_CENTER.z;
    const p = probe(x, z);
    let y: number;
    if (p.toShore > 0) {
      const d = depthAt(x, z);
      y = -d + 0.25 * noise2(x * 0.25, z * 0.25) - 0.1;
      tmp.copy(C.silt).lerp(C.wetSand, smoothstep(2.2, 0.05, d));
      const weeds = noise2(x * 0.12 + 3, z * 0.11 - 2);
      if (weeds > 0.62) tmp.lerp(new THREE.Color(0x395a30), (weeds - 0.62) * 1.6);
    } else {
      y = groundHeightAt(x, z);
      const out = -p.toShore;
      if (out < 1.5) tmp.copy(C.sand);
      else if (out < 4.6) tmp.copy(C.sand).lerp(C.earth, smoothstep(1.5, 4.6, out));
      else {
        tmp.copy(C.earth).lerp(C.grass, smoothstep(4.2, 8.5, out));
        const patch = noise2(x * 0.09, z * 0.09);
        tmp.lerp(C.grassDry, Math.max(0, patch - 0.55) * 0.9);
        tmp.lerp(C.forestFloor, smoothstep(26, 70, out) * 0.75);
      }
      const speck = 0.9 + 0.2 * noise2(x * 0.7, z * 0.7);
      tmp.multiplyScalar(speck);
    }
    // level the little camp platform and the pier approach
    const dc = Math.hypot(x - PLAYER_POS.x, z - PLAYER_POS.z);
    const flat = smoothstep(6.5, 1.2, dc) * 0.9;
    y = y * (1 - flat) + PLAYER_GROUND_Y * flat;
    const pierLine = Math.abs(x + 13) < 1.6 && z > LAKE_CENTER.z + 30 && z < LAKE_CENTER.z + 52;
    if (pierLine) y = y * 0.35 + Math.max(y, 0.1) * 0.65;
    pos.setY(i, y);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}

/** z of the shoreline for a given x, searching from far +z inward. */
export function edgeZAtX(x: number): number {
  const zStart = LAKE_CENTER.z + LAKE_BASE_RADIUS + 22;
  for (let z = zStart; z > LAKE_CENTER.z; z -= 0.5) {
    if (isWater(x, z)) return z;
  }
  return LAKE_CENTER.z;
}

export interface Scenery {
  group: THREE.Group;
  update: (time: number, wind: number) => void;
  dispose: () => void;
}

const treeCounts: Record<Quality, number> = { low: 90, medium: 170, high: 270 };
const reedCounts: Record<Quality, number> = { low: 260, medium: 620, high: 1100 };

export function buildForest(quality: Quality): Scenery {
  const group = new THREE.Group();
  const count = treeCounts[quality];
  const pines = Math.floor(count * 0.55);
  const birches = count - pines;

  const pineTrunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 3.4, 6);
  const pineConeGeo = new THREE.ConeGeometry(1.7, 3.0, 7);
  const birchTrunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 5.4, 6);
  const birchCrownGeo = new THREE.IcosahedronGeometry(1.3, 0);
  const birchLeafGeo = new THREE.IcosahedronGeometry(1.0, 0);

  const bark = new THREE.MeshLambertMaterial({ color: 0x6b4a2a, flatShading: true });
  const pineNeedle = makeSwayMaterial({ color: 0x2f4a2c, flatShading: true }, 0.012);
  const birchBark = new THREE.MeshLambertMaterial({ color: 0xe6e3d7, flatShading: true });
  const birchLeaf = makeSwayMaterial({ color: 0x79a049, flatShading: true }, 0.03);
  const birchLeaf2 = makeSwayMaterial({ color: 0x94b45c, flatShading: true }, 0.03);

  const pineTrunk = new THREE.InstancedMesh(pineTrunkGeo, bark, pines);
  const pineL1 = new THREE.InstancedMesh(pineConeGeo, pineNeedle.material, pines);
  const pineL2 = new THREE.InstancedMesh(pineConeGeo, pineNeedle.material, pines);
  const pineL3 = new THREE.InstancedMesh(pineConeGeo, pineNeedle.material, pines);
  const birchTrunk = new THREE.InstancedMesh(birchTrunkGeo, birchBark, birches);
  const birchCrown = new THREE.InstancedMesh(birchCrownGeo, birchLeaf.material, birches);
  const birchCrown2 = new THREE.InstancedMesh(birchLeafGeo, birchLeaf2.material, birches);

  const dummy = new THREE.Object3D();
  let pi = 0;
  let bi = 0;
  let guard = 0;
  while ((pi < pines || bi < birches) && guard < count * 40) {
    guard++;
    const a = hash2(guard * 1.13, 7.7) * Math.PI * 2;
    const r = LAKE_BASE_RADIUS + 7 + hash2(guard * 2.7, 3.1) * 62;
    const x = LAKE_CENTER.x + Math.cos(a) * r;
    const z = LAKE_CENTER.z + Math.sin(a) * r;
    const th = Math.atan2(z - LAKE_CENTER.z, x - LAKE_CENTER.x);
    if (Math.hypot(x - PLAYER_POS.x, z - PLAYER_POS.z) < 7) continue;
    if (probe(x, z).toShore > -6) continue; // must be well inland
    const shore = lakeRadiusAt(th);
    if (r < shore + 6) continue;
    // leave the view corridor toward the lake mostly open on the near side
    if (z > PLAYER_POS.z - 4 && Math.abs(x) < 26 && r > shore + 22) continue;
    const y = groundHeightAt(x, z);
    const isPine = pi < pines && (bi >= birches || hash2(guard, 11.3) < 0.55);
    const s = 0.8 + hash2(guard * 3.3, 5.5) * 0.9;
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, hash2(guard, 21.7) * Math.PI * 2, 0);
    if (isPine) {
      dummy.scale.set(s, s * (0.9 + hash2(guard, 2.2) * 0.5), s);
      dummy.updateMatrix();
      pineTrunk.setMatrixAt(pi, dummy.matrix);
      dummy.position.y = y + 2.9 * dummy.scale.y;
      dummy.scale.set(s * 1.0, s * 0.95, s * 1.0);
      dummy.updateMatrix();
      pineL1.setMatrixAt(pi, dummy.matrix);
      dummy.position.y = y + 4.6 * s;
      dummy.scale.set(s * 0.78, s * 0.85, s * 0.78);
      dummy.updateMatrix();
      pineL2.setMatrixAt(pi, dummy.matrix);
      dummy.position.y = y + 6.2 * s;
      dummy.scale.set(s * 0.52, s * 0.75, s * 0.52);
      dummy.updateMatrix();
      pineL3.setMatrixAt(pi, dummy.matrix);
      pi++;
    } else {
      dummy.scale.set(s * 0.8, s, s * 0.8);
      dummy.updateMatrix();
      birchTrunk.setMatrixAt(bi, dummy.matrix);
      dummy.position.y = y + 5.6 * s;
      dummy.scale.set(s * 1.15, s * 1.5, s * 1.15);
      dummy.updateMatrix();
      birchCrown.setMatrixAt(bi, dummy.matrix);
      dummy.position.y = y + 6.9 * s;
      dummy.position.x = x + s * 0.5;
      dummy.scale.set(s * 0.8, s * 0.95, s * 0.8);
      dummy.updateMatrix();
      birchCrown2.setMatrixAt(bi, dummy.matrix);
      bi++;
    }
  }
  for (const m of [pineTrunk, pineL1, pineL2, pineL3, birchTrunk, birchCrown, birchCrown2]) {
    m.count = m === pineTrunk || m === pineL1 || m === pineL2 || m === pineL3 ? pi : bi;
    m.instanceMatrix.needsUpdate = true;
    m.castShadow = quality !== 'low';
    m.frustumCulled = false;
    group.add(m);
  }

  // dark dashes on birch trunks
  const dashGeo = new THREE.BoxGeometry(0.3, 0.12, 0.04);
  const dashMat = new THREE.MeshLambertMaterial({ color: 0x3a3730 });
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, bi * 4);
  let di = 0;
  for (let i = 0; i < bi; i++) {
    const m = new THREE.Matrix4();
    birchTrunk.getMatrixAt(i, m);
    const p = new THREE.Vector3().setFromMatrixPosition(m);
    for (let k = 0; k < 4; k++) {
      const ang = hash2(i * 4 + k, 9.1) * Math.PI * 2;
      dummy.position.set(p.x + Math.cos(ang) * 0.19, p.y + 1.1 + k * 1.05, p.z + Math.sin(ang) * 0.19);
      dummy.rotation.set(0, -ang, 0);
      dummy.scale.set(1, 0.7 + hash2(k, i) * 0.8, 1);
      dummy.updateMatrix();
      if (di < dashes.count) dashes.setMatrixAt(di++, dummy.matrix);
    }
  }
  dashes.count = di;
  dashes.instanceMatrix.needsUpdate = true;
  dashes.frustumCulled = false;
  group.add(dashes);

  return {
    group,
    update: (t, wind) => {
      const amp = 0.008 + wind * 0.05;
      pineNeedle.setTime(t);
      birchLeaf.setTime(t);
      birchLeaf2.setTime(t);
      pineNeedle.material.onBeforeCompile = pineNeedle.material.onBeforeCompile;
      void amp;
    },
    dispose: () => disposeObject(group),
  };
}

export function buildReedBelt(quality: Quality): Scenery {
  const group = new THREE.Group();
  const count = reedCounts[quality];
  const stalk = new THREE.BoxGeometry(0.03, 1.25, 0.03);
  stalk.translate(0, 0.62, 0);
  const head = new THREE.BoxGeometry(0.06, 0.3, 0.06);
  head.translate(0, 1.36, 0);
  const merged = mergeGeos([stalk, head]);
  const sway = makeSwayMaterial({ color: 0x93974f, flatShading: true }, 0.16);
  const mesh = new THREE.InstancedMesh(merged, sway.material, count);
  const dummy = new THREE.Object3D();
  let placed = 0;
  let guard = 0;
  while (placed < count && guard < count * 60) {
    guard++;
    const a = hash2(guard * 1.7, 4.3) * Math.PI * 2;
    const R = lakeRadiusAt(a);
    const band = 0.2 + hash2(guard * 3.1, 9.7) * 5.5; // 0.2..5.7 m inside the shore
    const r = R - band;
    const x = LAKE_CENTER.x + Math.cos(a) * r;
    const z = LAKE_CENTER.z + Math.sin(a) * r;
    if (reedFactor(x, z) < 0.5) continue;
    if (depthAt(x, z) > 1.0) continue;
    if (Math.hypot(x - PLAYER_POS.x, z - PLAYER_POS.z) < 6.5) continue;
    const s = 0.6 + hash2(guard, 17.1) * 0.75;
    dummy.position.set(x, -depthAt(x, z) * 0.55, z);
    dummy.rotation.set((hash2(guard, 5) - 0.5) * 0.25, hash2(guard, 6) * 6.28, (hash2(guard, 7) - 0.5) * 0.25);
    dummy.scale.set(s, s * (0.7 + hash2(guard, 8) * 0.6), s);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed++, dummy.matrix);
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  group.add(mesh);

  // water lilies in the calm reedy corners
  const padGeo = new THREE.CircleGeometry(0.17, 7);
  padGeo.rotateX(-Math.PI / 2);
  const padMat = new THREE.MeshLambertMaterial({ color: 0x5c8f45, flatShading: true, side: THREE.DoubleSide });
  const pads = new THREE.InstancedMesh(padGeo, padMat, Math.floor(placed * 0.06) + 6);
  let pn = 0;
  for (let i = 0; i < count * 4 && pn < pads.count; i++) {
    const a = hash2(i * 2.3, 1.9) * Math.PI * 2;
    const r = lakeRadiusAt(a) - (0.8 + hash2(i, 3.4) * 4);
    const x = LAKE_CENTER.x + Math.cos(a) * r;
    const z = LAKE_CENTER.z + Math.sin(a) * r;
    const d = depthAt(x, z);
    if (d < 0.2 || d > 0.9) continue;
    dummy.position.set(x, 0.02, z);
    dummy.rotation.set(0, hash2(i, 9) * 6.28, 0);
    dummy.scale.setScalar(0.7 + hash2(i, 11) * 0.9);
    dummy.updateMatrix();
    pads.setMatrixAt(pn++, dummy.matrix);
  }
  pads.count = pn;
  pads.instanceMatrix.needsUpdate = true;
  group.add(pads);

  return {
    group,
    update: (t) => sway.setTime(t),
    dispose: () => {
      disposeObject(group);
    },
  };
}

export function buildRocks(quality: Quality): Scenery {
  const geo = new THREE.DodecahedronGeometry(0.6, 0);
  const mat = new THREE.MeshLambertMaterial({ color: 0x8b8d88, flatShading: true });
  const count = quality === 'low' ? 22 : quality === 'medium' ? 44 : 70;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  const colors = new Float32Array(count * 3);
  const c = new THREE.Color();
  let n = 0;
  let guard = 0;
  while (n < count && guard < count * 60) {
    guard++;
    const a = hash2(guard * 5.1, 2.7) * Math.PI * 2;
    const r = lakeRadiusAt(a) - 1.2 + hash2(guard, 3.3) * 6;
    const x = LAKE_CENTER.x + Math.cos(a) * r;
    const z = LAKE_CENTER.z + Math.sin(a) * r;
    if (Math.hypot(x - PLAYER_POS.x, z - PLAYER_POS.z) < 8) continue;
    const p = probe(x, z);
    const s = 0.3 + hash2(guard, 12.9) * 0.8;
    dummy.position.set(x, Math.max(-0.3, p.toShore > 0 ? -s * 0.4 : groundHeightAt(x, z) - s * 0.35), z);
    dummy.rotation.set(hash2(guard, 1) * 3, hash2(guard, 2) * 6.28, hash2(guard, 3) * 3);
    dummy.scale.set(s, s * (0.55 + hash2(guard, 4) * 0.5), s * (0.8 + hash2(guard, 6) * 0.5));
    dummy.updateMatrix();
    mesh.setMatrixAt(n, dummy.matrix);
    c.setHSL(0.09 + hash2(guard, 8) * 0.05, 0.06, 0.42 + hash2(guard, 9) * 0.16);
    c.toArray(colors, n * 3);
    n++;
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  geo.setAttribute('color', new THREE.InstancedBufferAttribute(colors, 3));
  const m2 = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, flatShading: true });
  mesh.material = m2;
  mesh.castShadow = quality !== 'low';
  mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  return { group, update: () => {}, dispose: () => disposeObject(group) };
}

/** Distant forest silhouette ring, unlit and fogged. */
export function buildTreeline(): Scenery {
  const segments = 260;
  const radius = 128;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a);
    const z = Math.sin(a);
    const jag =
      5.2 +
      3.4 * Math.sin(a * 21) * Math.cos(a * 13) +
      2.1 * Math.sin(a * 47 + 1.3) +
      1.4 * Math.sin(a * 91 + 0.4);
    const base = -3;
    positions.push(LAKE_CENTER.x + x * (radius + 14), base, LAKE_CENTER.z + z * (radius + 14));
    positions.push(LAKE_CENTER.x + x * radius, jag, LAKE_CENTER.z + z * radius);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color: 0x33452c, side: THREE.DoubleSide, fog: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  const group = new THREE.Group();
  group.add(mesh);
  return { group, update: () => {}, dispose: () => disposeObject(group) };
}

export function buildPier(): Scenery {
  const group = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x8a6a45, flatShading: true });
  const woodDark = new THREE.MeshLambertMaterial({ color: 0x6b5136, flatShading: true });
  const x0 = -13;
  const shoreZ = edgeZAtX(x0);
  const length = 15;
  const deckY = 0.85;
  const planks = 22;
  for (let i = 0; i < planks; i++) {
    const t = i / (planks - 1);
    const z = shoreZ + 1.5 - t * length;
    const geo = new THREE.BoxGeometry(2.2, 0.09, length / planks + 0.08);
    const m = new THREE.Mesh(geo, i % 5 === 0 ? woodDark : wood);
    m.position.set(x0, deckY + Math.sin(i * 1.7) * 0.015, z);
    m.rotation.y = (hash2(i, 3) - 0.5) * 0.012;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  // posts + rails
  for (let i = 0; i < 5; i++) {
    const z = shoreZ + 1.2 - (i / 4) * (length - 1);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.1, 0.18), woodDark);
      post.position.set(x0 + side * 1.0, deckY - 1.3, z);
      post.castShadow = true;
      group.add(post);
    }
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, length), wood);
  rail.position.set(x0 - 1.0, deckY + 0.95, shoreZ + 1.2 - (length - 1) / 2);
  group.add(rail);
  const rail2 = rail.clone();
  rail2.position.x = x0 + 1.0;
  group.add(rail2);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const z = shoreZ + 1.2 - (i / 4) * (length - 1);
      const upright = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.0, 0.09), woodDark);
      upright.position.set(x0 + side * 1.0, deckY + 0.45, z);
      group.add(upright);
    }
  }
  return { group, update: () => {}, dispose: () => disposeObject(group) };
}

/** Bucket, tackle box and folding stool beside the angler. */
export function buildCamp(): Scenery {
  const group = new THREE.Group();
  const gy = PLAYER_GROUND_Y;
  const metal = new THREE.MeshLambertMaterial({ color: 0x9aa6ad, flatShading: true });
  const metalDark = new THREE.MeshLambertMaterial({ color: 0x5d666c, flatShading: true });
  const plastic = new THREE.MeshLambertMaterial({ color: 0x2f6f8f, flatShading: true });
  const boxMat = new THREE.MeshLambertMaterial({ color: 0x7d3f2c, flatShading: true });
  const lidMat = new THREE.MeshLambertMaterial({ color: 0x94502f, flatShading: true });
  const canvasMat = new THREE.MeshLambertMaterial({ color: 0x4b6142, flatShading: true });

  // bucket
  const bucket = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.28, 10, 1, true), metal);
  body.position.y = 0.14;
  bucket.add(body);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.14, 10), metalDark);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.005;
  bucket.add(bottom);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 4, 10, Math.PI), metalDark);
  handle.rotation.set(Math.PI / 2, 0, 0);
  handle.position.y = 0.3;
  bucket.add(handle);
  bucket.position.set(1.55, gy, PLAYER_POS.z + 0.9);
  group.add(bucket);

  // tackle box
  const tackle = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.28), boxMat);
  b.position.y = 0.08;
  tackle.add(b);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.3), lidMat);
  lid.position.y = 0.19;
  tackle.add(lid);
  const latch = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), metal);
  latch.position.set(0, 0.16, 0.15);
  tackle.add(latch);
  tackle.position.set(0.6, gy, PLAYER_POS.z + 1.5);
  tackle.rotation.y = -0.4;
  group.add(tackle);

  // folding stool
  const stool = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 10), canvasMat);
  seat.position.y = 0.4;
  stool.add(seat);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 5), metalDark);
    leg.position.set(Math.cos(a) * 0.11, 0.2, Math.sin(a) * 0.11);
    leg.rotation.z = Math.cos(a) * 0.24;
    leg.rotation.x = -Math.sin(a) * 0.24;
    stool.add(leg);
  }
  stool.position.set(-1.9, gy, PLAYER_POS.z + 1.2);
  group.add(stool);

  // rolled ground sheet + thermos for atmosphere
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 8), canvasMat);
  roll.rotation.z = Math.PI / 2;
  roll.position.set(-2.6, gy + 0.11, PLAYER_POS.z + 2.1);
  group.add(roll);
  const thermos = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.24, 8), plastic);
  thermos.position.set(1.0, gy + 0.12, PLAYER_POS.z + 2.0);
  group.add(thermos);

  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return { group, update: () => {}, dispose: () => disposeObject(group) };
}
