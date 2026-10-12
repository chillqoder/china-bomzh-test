/**
 * Procedural low-poly fish. One parametric builder, six clearly different bodies.
 * Nothing is loaded from disk: geometry is generated from species profiles.
 */

import * as THREE from 'three';
import { SPECIES, type SpeciesDef } from '@/game/species';
import type { SpeciesId } from '@/game/types';

/** Re-anchor a mesh authored in body space into the rear-pivot space. */
function withLocal(mesh: THREE.Mesh, split: number, sink: THREE.BufferGeometry[]): THREE.Mesh {
  const g = mesh.geometry.clone();
  g.translate(-axisX(split), 0, 0);
  sink.push(g);
  mesh.geometry = g;
  mesh.position.x += axisX(split);
  return mesh;
}

const SEGMENTS = 7; // ring vertices (even number: symmetric)
const BODY_STEPS = 16;

interface Pt {
  x: number;
  y: number;
  z: number;
}

function halfWidthAt(def: SpeciesDef, u: number): number {
  const p = def.profile;
  const d = p.deepestAt;
  const head = p.headLength;
  let w: number;
  if (u < head) {
    const t = u / head;
    w = Math.pow(t, 0.62);
  } else if (u < d) {
    w = 1;
  } else {
    const t = (u - d) / (1 - d);
    w = 1 - (1 - p.stocky) * Math.pow(t, 0.9);
  }
  return p.width * w;
}

function halfHeightAt(def: SpeciesDef, u: number): number {
  const p = def.profile;
  const head = p.headLength;
  const d = p.deepestAt;
  let h: number;
  if (u < head * 0.55) {
    h = Math.pow(u / (head * 0.55), 0.75) * 0.55;
  } else if (u < d) {
    const t = (u - head * 0.55) / (d - head * 0.55);
    h = 0.55 + 0.45 * Math.pow(t, 0.7);
  } else {
    const t = (u - d) / (1 - d);
    h = 1 - (1 - p.stocky * 0.9) * Math.pow(t, 0.85);
  }
  const hump = p.hump * Math.sin(Math.PI * Math.min(1, u / (d + 0.12)));
  return p.height * (h + hump * 0.5);
}

/** x coordinate along the body: nose at +0.5, tail base at -0.5 */
const axisX = (u: number) => 0.5 - u;

function ringVertices(def: SpeciesDef, u: number): Pt[] {
  const w = halfWidthAt(def, u);
  const h = halfHeightAt(def, u);
  const x = axisX(u);
  const out: Pt[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    const sy = Math.sin(a);
    const cz = Math.cos(a);
    const hh = sy > 0 ? h : h * 0.86; // slightly flatter belly
    out.push({ x, y: sy * hh, z: cz * w });
  }
  return out;
}

function buildBody(def: SpeciesDef, u0: number, u1: number, steps: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const back = new THREE.Color(def.profile.colors.back);
  const side = new THREE.Color(def.profile.colors.side);
  const belly = new THREE.Color(def.profile.colors.belly);
  const rings: Pt[][] = [];
  for (let i = 0; i <= steps; i++) {
    const u = u0 + (u1 - u0) * (i / steps);
    rings.push(ringVertices(def, u));
  }
  for (const ring of rings) {
    for (const v of ring) {
      pos.push(v.x, v.y, v.z - axisX(u0));
      const rel = v.y / Math.max(0.001, halfHeightAt(def, u0));
      const c = rel > 0.25 ? back.clone().lerp(side, Math.max(0, 1 - (rel - 0.25) * 2.2)) : side.clone().lerp(belly, Math.min(1, -rel * 1.6 + 0.25));
      col.push(c.r, c.g, c.b);
    }
  }
  // cap the nose on the first ring
  const noseClosed = u0 < 0.001;
  if (noseClosed) {
    const n = new THREE.Vector3(0.5 + 0.01, 0, 0);
    const base = pos.length / 3;
    pos.push(n.x - axisX(u0), 0, 0);
    col.push(belly.r, belly.g, belly.b);
    for (let i = 0; i < SEGMENTS; i++) {
      idx.push(base, i + 1, i);
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    const a = i * SEGMENTS;
    const b = (i + 1) * SEGMENTS;
    for (let j = 0; j < SEGMENTS; j++) {
      const j2 = (j + 1) % SEGMENTS;
      idx.push(a + j, b + j, b + j2);
      idx.push(a + j, b + j2, a + j2);
    }
  }
  if (u1 >= 0.999) {
    const base = pos.length / 3;
    pos.push(0, 0, 0);
    col.push(back.r, back.g, back.b);
    const last = (rings.length - 1) * SEGMENTS;
    for (let i = 0; i < SEGMENTS; i++) idx.push(base, last + i, last + ((i + 1) % SEGMENTS));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function finGeometry(
  points: [number, number][],
  thickness = 0.006,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
  });
  g.translate(0, 0, -thickness / 2);
  return g;
}

export interface FishModel {
  group: THREE.Group;
  tail: THREE.Group;
  body: THREE.Group;
  setWiggle: (v: number) => void;
  dispose: () => void;
}

export function buildFish(def: SpeciesDef, lengthCm: number): FishModel {
  const p = def.profile;
  const scale = Math.max(0.08, lengthCm / 100);
  const group = new THREE.Group();
  const body = new THREE.Group();
  const rear = new THREE.Group();
  const tail = new THREE.Group();
  const disposables: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const bodyMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.55,
    metalness: 0.12,
  });
  const finMat = new THREE.MeshStandardMaterial({
    color: p.colors.fin,
    flatShading: true,
    roughness: 0.75,
    metalness: 0.05,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.94,
  });
  materials.push(bodyMat, finMat);

  const split = 0.68;
  const frontGeo = buildBody(def, 0.001, split, Math.round(BODY_STEPS * split));
  const rearGeo = buildBody(def, split, 1, Math.round(BODY_STEPS * (1 - split)) + 1);
  disposables.push(frontGeo, rearGeo);
  body.add(new THREE.Mesh(frontGeo, bodyMat));
  rear.position.x = axisX(split);
  rear.add(new THREE.Mesh(rearGeo, bodyMat));

  // caudal fin
  const spread = p.tailSpread;
  const fork = p.tailFork;
  const tailGeo = finGeometry([
    [0, -0.02],
    [-spread * 0.55, -spread],
    [-spread * (0.85 + fork), -spread * 0.72],
    [-spread * (0.6 + fork * 0.4), 0],
    [-spread * (0.85 + fork), spread * 0.72],
    [-spread * 0.55, spread],
  ]);
  disposables.push(tailGeo);
  const caudal = new THREE.Mesh(tailGeo, finMat);
  caudal.rotation.y = Math.PI / 2;
  caudal.position.set(-0.02, 0, 0);
  tail.position.x = axisX(1);
  tail.add(caudal);
  rear.add(tail);

  // dorsal fin(s)
  const dorsalH = p.dorsalSize * p.height * 3.1;
  const mkDorsal = (from: number, to: number, height: number, forwardLean: number) => {
    const g = finGeometry([
      [axisX(from), halfHeightAt(def, from) * 0.92],
      [axisX(to), halfHeightAt(def, to) * 0.92],
      [axisX(to - 0.04), halfHeightAt(def, Math.min(0.99, to - 0.02)) + height * 0.5],
      [axisX((from + to) / 2 - forwardLean), halfHeightAt(def, (from + to) / 2) + height],
      [axisX(from + 0.03), halfHeightAt(def, from + 0.02) + height * 0.35],
    ]);
    disposables.push(g);
    return new THREE.Mesh(g, finMat);
  };
  const dPos = p.dorsalPos;
  if (p.dorsalCount >= 2) {
    body.add(mkDorsal(dPos - 0.16, dPos - 0.02, dorsalH, 0.02));
    const second = mkDorsal(dPos + 0.02, dPos + 0.16, dorsalH * 0.8, 0.02);
    rear.add(withLocal(second, split, disposables));
  } else {
    const span = def.id === 'shchuka' ? 0.16 : 0.26;
    body.add(mkDorsal(dPos - span / 2, dPos + span / 2, dorsalH, 0.03));
  }
  // anal fin
  const analGeo = finGeometry([
    [axisX(p.analPos - 0.05), -halfHeightAt(def, p.analPos - 0.05) * 0.9],
    [axisX(p.analPos + 0.09), -halfHeightAt(def, p.analPos + 0.08) * 0.85],
    [axisX(p.analPos + 0.05), -halfHeightAt(def, p.analPos + 0.05) - p.analSize * p.height * 1.9],
  ]);
  disposables.push(analGeo);
  const analMesh = new THREE.Mesh(analGeo, finMat);
  if (p.analPos > split) rear.add(withLocal(analMesh, split, disposables));
  else body.add(analMesh);

  // pectoral fins
  for (const sign of [-1, 1]) {
    const g = finGeometry([
      [0, 0],
      [-0.12, -0.02],
      [-0.15, -0.075],
      [-0.04, -0.05],
    ]);
    disposables.push(g);
    const m = new THREE.Mesh(g, finMat);
    m.position.set(axisX(p.headLength + 0.03), -halfHeightAt(def, p.headLength) * 0.35, sign * halfWidthAt(def, p.headLength) * 0.8);
    m.rotation.y = Math.PI / 2;
    m.rotation.x = sign * 0.5;
    body.add(m);
  }

  // pelvic fins
  for (const sign of [-1, 1]) {
    const g = finGeometry([
      [0, 0],
      [-0.09, -0.01],
      [-0.11, -0.05],
    ]);
    disposables.push(g);
    const m = new THREE.Mesh(g, finMat);
    m.position.set(axisX(p.headLength + 0.16), -halfHeightAt(def, p.headLength + 0.16) * 0.7, sign * halfWidthAt(def, p.headLength + 0.16) * 0.45);
    m.rotation.y = Math.PI / 2;
    body.add(m);
  }

  // pike / perch gill-cover hint + mouth line
  if (def.id === 'shchuka') {
    const g = finGeometry([
      [0, 0],
      [-0.46, -0.02],
      [-0.44, 0.06],
    ]);
    disposables.push(g);
    const jaw = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({ color: 0x243a1c, flatShading: true, side: THREE.DoubleSide }),
    );
    materials.push(jaw.material);
    jaw.position.set(axisX(0.02), -halfHeightAt(def, 0.05) * 0.25, 0);
    body.add(jaw);
  }

  // barbels (carp)
  if (p.barbels) {
    const bMat = new THREE.MeshStandardMaterial({ color: p.colors.fin, roughness: 0.8, flatShading: true });
    materials.push(bMat);
    for (const sign of [-1, 1]) {
      const geo = new THREE.CylinderGeometry(0.006, 0.003, 0.11, 4);
      disposables.push(geo);
      const c = new THREE.Mesh(geo, bMat);
      c.position.set(axisX(0.03), -halfHeightAt(def, 0.03) * 0.5, sign * halfWidthAt(def, 0.03) * 0.7);
      c.rotation.z = -Math.PI / 2.6;
      c.rotation.x = sign * 0.4;
      body.add(c);
    }
  }

  // eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: p.colors.eye });
  materials.push(eyeMat);
  const eyeGeo = new THREE.SphereGeometry(0.018, 6, 5);
  disposables.push(eyeGeo);
  for (const sign of [-1, 1]) {
    const e = new THREE.Mesh(eyeGeo, eyeMat);
    const u = p.headLength * 0.62;
    e.position.set(axisX(u), halfHeightAt(def, u) * 0.18, sign * halfWidthAt(def, u) * 0.92);
    e.scale.setScalar((lengthCm / 40) * 0.9 + 0.4);
    body.add(e);
  }

  // perch stripes / pike spots
  if (p.stripes) {
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x1e2c17, side: THREE.DoubleSide, transparent: true, opacity: 0.82 });
    materials.push(stripeMat);
    for (let i = 0; i < 7; i++) {
      const u = 0.16 + i * 0.085;
      const h = halfHeightAt(def, u);
      const w = halfWidthAt(def, u);
      const g = new THREE.PlaneGeometry(0.028, h * 1.7);
      disposables.push(g);
      for (const sign of [-1, 1]) {
        const m = new THREE.Mesh(g, stripeMat);
        m.position.set(axisX(u), h * 0.1, sign * (w + 0.0015));
        m.rotation.y = sign > 0 ? 0 : Math.PI;
        m.rotation.x = sign * 0.12;
        body.add(m);
      }
    }
  }
  if (p.spots) {
    const spotMat = new THREE.MeshBasicMaterial({ color: 0xcdd88a, side: THREE.DoubleSide });
    materials.push(spotMat);
    for (let i = 0; i < 14; i++) {
      const u = 0.2 + (i % 7) * 0.09;
      const sign = i < 7 ? 1 : -1;
      const h = halfHeightAt(def, u);
      const w = halfWidthAt(def, u);
      const g = new THREE.PlaneGeometry(0.03, 0.018);
      disposables.push(g);
      const m = new THREE.Mesh(g, spotMat);
      m.position.set(axisX(u), (i % 3) * 0.03 - h * 0.15, sign * (w + 0.0012));
      m.rotation.y = sign > 0 ? 0 : Math.PI;
      body.add(m);
    }
  }

  group.add(body);
  group.add(rear);

  let wiggle = 0;
  const model: FishModel = {
    group,
    tail,
    body,
    setWiggle: (v: number) => {
      wiggle = v;
      rear.rotation.y = Math.sin(v) * 0.34;
      tail.rotation.y = Math.sin(v - 0.7) * 0.4;
      body.rotation.y = Math.sin(v * 0.6) * 0.05;
    },
    dispose: () => {
      for (const g of disposables) g.dispose();
      for (const m of materials) m.dispose();
      group.clear();
    },
  };
  group.scale.setScalar(scale);
  return model;
}

export function fishFor(species: SpeciesId, lengthCm: number) {
  return buildFish(SPECIES[species], lengthCm);
}
