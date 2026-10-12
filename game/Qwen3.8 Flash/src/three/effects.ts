/**
 * Water feedback: expanding ripple rings and a pooled splash droplet system.
 * Both are simple object pools — nothing is allocated during play.
 */

import * as THREE from 'three';
import { clamp01 } from '@/game/rng';

interface Ripple {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  active: boolean;
  t: number;
  dur: number;
  max: number;
  strength: number;
}

export class Ripples {
  private pool: Ripple[] = [];
  readonly group = new THREE.Group();
  private geo: THREE.RingGeometry;
  private mat: THREE.MeshBasicMaterial;

  constructor(count = 18) {
    this.geo = new THREE.RingGeometry(0.88, 1.0, 28);
    this.geo.rotateX(-Math.PI / 2);
    this.mat = new THREE.MeshBasicMaterial({
      color: 0xd7edf2,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.geo, this.mat.clone());
      mesh.visible = false;
      mesh.renderOrder = 6;
      this.group.add(mesh);
      this.pool.push({ mesh, active: false, t: 0, dur: 1, max: 1, strength: 1 });
    }
  }

  spawn(x: number, y: number, z: number, max = 1.6, dur = 1.6, strength = 1) {
    let slot = this.pool.find((r) => !r.active);
    if (!slot) {
      slot = this.pool.reduce((a, b) => (a.t / a.dur > b.t / b.dur ? a : b));
    }
    slot.active = true;
    slot.t = 0;
    slot.dur = dur;
    slot.max = max;
    slot.strength = strength;
    slot.mesh.visible = true;
    slot.mesh.position.set(x, y + 0.02, z);
  }

  update(dt: number) {
    for (const r of this.pool) {
      if (!r.active) continue;
      r.t += dt;
      const p = r.t / r.dur;
      if (p >= 1) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const s = 0.12 + r.max * Math.pow(p, 0.6);
      r.mesh.scale.set(s, 1, s);
      r.mesh.material.opacity = (1 - p) * (1 - p) * 0.34 * r.strength;
    }
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
    for (const r of this.pool) r.mesh.material.dispose();
    this.group.clear();
  }
}

const DROPLET_VS = /* glsl */ `
  attribute float aLife;
  attribute float aSize;
  varying float vLife;
  void main() {
    vLife = aLife;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(aSize * (26.0 / max(0.001, -mv.z)), 1.0, 7.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const DROPLET_FS = /* glsl */ `
  precision mediump float;
  varying float vLife;
  uniform vec3 uColor;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    if (dot(d, d) > 0.25) discard;
    float a = clamp(1.0 - vLife, 0.0, 1.0);
    gl_FragColor = vec4(uColor, a * 0.85);
  }
`;

export class Splashes {
  readonly points: THREE.Points;
  private count: number;
  private positions: Float32Array;
  private velocities: Float32Array;
  private lives: Float32Array;
  private sizes: Float32Array;
  private geo: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;
  private cursor = 0;

  constructor(count = 320) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.lives = new Float32Array(count).fill(2);
    this.sizes = new Float32Array(count).fill(1);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('aLife', new THREE.BufferAttribute(this.lives, 1));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0xe4f2f5) } },
      vertexShader: DROPLET_VS,
      fragmentShader: DROPLET_FS,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 7;
  }

  burst(x: number, y: number, z: number, amount: number, spread = 1) {
    const n = Math.round(clamp01(amount) * 12) + 2;
    for (let i = 0; i < n; i++) {
      const k = this.cursor % this.count;
      this.cursor++;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.9 * spread;
      this.positions[k * 3] = x + Math.cos(a) * 0.05;
      this.positions[k * 3 + 1] = y + 0.02;
      this.positions[k * 3 + 2] = z + Math.sin(a) * 0.05;
      const up = 0.7 + Math.random() * 1.5 * (0.4 + amount);
      this.velocities[k * 3] = Math.cos(a) * r * 1.4;
      this.velocities[k * 3 + 1] = up;
      this.velocities[k * 3 + 2] = Math.sin(a) * r * 1.4;
      this.lives[k] = 0;
      this.sizes[k] = 1.6 + Math.random() * 2.2;
    }
  }

  update(dt: number) {
    const g = 9.4;
    let dirty = false;
    for (let i = 0; i < this.count; i++) {
      if (this.lives[i] >= 2) continue;
      this.lives[i] += dt * 1.5;
      if (this.lives[i] >= 1) {
        this.lives[i] = 2;
        this.sizes[i] = 0;
        dirty = true;
        continue;
      }
      this.velocities[i * 3 + 1] -= g * dt;
      this.positions[i * 3] += this.velocities[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
      dirty = true;
    }
    if (dirty) {
      this.geo.getAttribute('position').needsUpdate = true;
      this.geo.getAttribute('aLife').needsUpdate = true;
      this.geo.getAttribute('aSize').needsUpdate = true;
    }
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

/** Drifting low-poly cloud puffs. */
export class Clouds {
  readonly group = new THREE.Group();
  private meshes: THREE.Mesh[] = [];
  private mat: THREE.MeshLambertMaterial;
  private geo: THREE.IcosahedronGeometry;

  constructor(count = 9) {
    this.geo = new THREE.IcosahedronGeometry(1, 0);
    this.mat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
      flatShading: true,
      fog: false,
    });
    for (let i = 0; i < count; i++) {
      const puff = new THREE.Group();
      const n = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < n; j++) {
        const m = new THREE.Mesh(this.geo, this.mat.clone());
        m.position.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 7);
        m.scale.set(4 + Math.random() * 5, 2 + Math.random() * 1.6, 3 + Math.random() * 3);
        puff.add(m);
        this.meshes.push(m);
      }
      const a = Math.random() * Math.PI * 2;
      const r = 90 + Math.random() * 70;
      puff.position.set(Math.cos(a) * r, 34 + Math.random() * 26, Math.sin(a) * r - 30);
      this.group.add(puff);
    }
  }

  update(dt: number, wind: number, cover: number, tint: THREE.Color) {
    for (const child of this.group.children) {
      child.position.x += dt * (0.4 + wind * 3.2);
      if (child.position.length() > 210) {
        child.position.x *= -0.9;
        child.position.z = -30 + (Math.random() - 0.5) * 140;
      }
    }
    this.mat.opacity = 0.18 + cover * 0.5;
    this.mat.color.copy(tint);
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
    this.group.clear();
  }
}
