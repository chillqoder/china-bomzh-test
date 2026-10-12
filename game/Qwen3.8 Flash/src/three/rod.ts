/**
 * First-person tackle: a flexible rod (handle, reel, guides, whipping tip),
 * a dynamic fishing line and the float. Everything is procedural.
 */

import * as THREE from 'three';
import { PLAYER_POS } from '@/game/lake';
import { clamp, lerp } from '@/game/rng';
import { disposeObject } from './utils';

export interface RodPose {
  phase: string;
  /** 0..1 line load */
  tension: number;
  power: number;
  castT: number;
  retrieveT: number;
  /** radians: where the rig / fish is relative to the view direction */
  targetYaw: number;
  targetPitch: number;
  time: number;
  wind: number;
  /** 0..1 fish burst, makes the tip shake */
  shake: number;
  bite: number;
}

const SEGMENTS = 16;
const SEG_LEN = 0.105;
/** Rest angle of the blank in camera space (negative = pointing forward over the lake). */
const ROD_BASE = -0.58;

export class RodRig {
  readonly group = new THREE.Group();
  private base = new THREE.Group();
  private pivots: THREE.Group[] = [];
  private tip = new THREE.Object3D();
  private reelSpin = 0;
  private reelHandle: THREE.Group;
  private materials: THREE.Material[] = [];
  private bend = 0;
  private yaw = 0;
  private pitch = 0;

  constructor() {
    const blank = new THREE.MeshLambertMaterial({ color: 0x6b4a2c, flatShading: true });
    const grip = new THREE.MeshLambertMaterial({ color: 0x24211d, flatShading: true });
    const cork = new THREE.MeshLambertMaterial({ color: 0xb08a5c, flatShading: true });
    const metal = new THREE.MeshLambertMaterial({ color: 0xc9ccd1, flatShading: true });
    const ring = new THREE.MeshLambertMaterial({ color: 0x9aa3ad, flatShading: true });
    this.materials.push(blank, grip, cork, metal, ring);

    // handle / butt
    const butt = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.3, 8), grip);
    butt.position.y = -0.14;
    this.base.add(butt);
    const corkGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.16, 8), cork);
    corkGrip.position.y = 0.09;
    this.base.add(corkGrip);

    // reel: seat, spool, handle
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 6), metal);
    seat.position.set(0, 0.06, -0.032);
    seat.rotation.x = Math.PI / 2;
    this.base.add(seat);
    const reelBody = new THREE.Group();
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.05, 12), metal);
    spool.rotation.z = Math.PI / 2;
    reelBody.add(spool);
    const line = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 0.044, 12),
      new THREE.MeshLambertMaterial({ color: 0xe8eef0, flatShading: true }),
    );
    this.materials.push(line.material as THREE.Material);
    reelBody.add(line);
    this.reelHandle = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.045, 0.008), metal);
    arm.position.y = 0.024;
    this.reelHandle.add(arm);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.03, 8), cork);
    knob.rotation.z = Math.PI / 2;
    knob.position.y = 0.045;
    this.reelHandle.add(knob);
    this.reelHandle.position.set(0.03, 0, 0);
    reelBody.add(this.reelHandle);
    reelBody.position.set(0.0, 0.03, -0.058);
    this.base.add(reelBody);

    // blank: a chain of tapered segments, each on its own pivot
    let parent: THREE.Object3D = this.base;
    for (let i = 0; i < SEGMENTS; i++) {
      const pivot = new THREE.Group();
      pivot.position.y = i === 0 ? 0.18 : SEG_LEN;
      parent.add(pivot);
      const rBottom = lerp(0.02, 0.006, i / SEGMENTS);
      const rTop = lerp(0.02, 0.006, (i + 1) / SEGMENTS);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, SEG_LEN, 6), blank);
      seg.position.y = SEG_LEN / 2;
      pivot.add(seg);
      if (i % 2 === 1 && i < SEGMENTS - 1) {
        const guide = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0022, 4, 8), ring);
        guide.position.y = SEG_LEN * 0.9;
        guide.rotation.x = Math.PI / 2;
        pivot.add(guide);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.02, 0.004), ring);
        foot.position.y = SEG_LEN * 0.78;
        foot.position.z = -0.008;
        pivot.add(foot);
      }
      this.pivots.push(pivot);
      parent = pivot;
    }
    const tipRing = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.002, 4, 8), ring);
    tipRing.rotation.x = Math.PI / 2;
    tipRing.position.y = SEG_LEN;
    this.pivots[this.pivots.length - 1].add(tipRing);
    this.tip.position.y = SEG_LEN + 0.005;
    this.pivots[this.pivots.length - 1].add(this.tip);

    this.group.add(this.base);
    // held to the right of the view, pointing up and forward over the lake
    // held to the right of the view, blank angled up and out over the water
    this.base.position.set(0.27, -0.34, -0.26);
    this.base.rotation.set(ROD_BASE, -0.06, 0.1);
  }

  get tipObject(): THREE.Object3D {
    return this.tip;
  }

  tipWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.tip.getWorldPosition(out);
  }

  update(dt: number, p: RodPose) {
    const t = p.time;
    const idle = Math.sin(t * 0.9) * 0.012 + Math.sin(t * 1.7) * 0.006;

    // target rod attitude per phase, expressed as an offset around the rest angle
    let basePitch = 0.0;
    let baseYaw = 0.0;
    let bend = 0.05;
    switch (p.phase) {
      case 'charging':
        basePitch = 0.5 + p.power * 0.38; // rod drawn back behind the shoulder
        baseYaw = 0.18;
        bend = 0.03 + p.power * 0.05;
        break;
      case 'casting':
        basePitch = lerp(0.72, -0.3, clamp(p.castT * 3.2, 0, 1)); // the forward whip
        bend = 0.4 * (1 - clamp(p.castT * 2, 0, 1));
        break;
      case 'waiting':
        basePitch = -0.12;
        baseYaw = clamp(p.targetYaw, -0.5, 0.5);
        bend = 0.05 + p.bite * 0.1;
        break;
      case 'investigating':
      case 'strike':
        basePitch = -0.16;
        baseYaw = clamp(p.targetYaw, -0.5, 0.5) + Math.sin(t * 26) * 0.02 * p.bite;
        bend = 0.14 + p.bite * 0.42;
        break;
      case 'fighting': {
        basePitch = -0.06 + p.tension * 0.0022;
        baseYaw = clamp(p.targetYaw, -0.7, 0.7);
        bend = 0.12 + p.tension * 0.011;
        break;
      }
      case 'retrieving':
        basePitch = 0.3;
        bend = 0.07;
        break;
      case 'result':
        basePitch = 0.16;
        baseYaw = -0.22;
        bend = 0.02;
        break;
      default:
        basePitch = 0.0;
        baseYaw = 0.06;
        bend = 0.04;
    }
    const shake = p.shake * Math.sin(t * 34) * 0.02;
    this.yaw = lerp(this.yaw, baseYaw + shake, Math.min(1, dt * 7));
    this.pitch = lerp(this.pitch, basePitch + idle, Math.min(1, dt * 7));
    this.bend = lerp(this.bend, bend, Math.min(1, dt * 8));

    this.base.rotation.x = ROD_BASE + this.pitch;
    this.base.rotation.y = this.yaw;
    const windSag = p.wind * 0.02;
    for (let i = 0; i < this.pivots.length; i++) {
      const k = i / SEGMENTS;
      const flex = Math.pow(k, 1.25);
      this.pivots[i].rotation.x = -(this.bend * flex * 0.55 + windSag * flex);
      if (p.phase === 'fighting') {
        this.pivots[i].rotation.z = Math.sin(t * 11 + i) * 0.006 * p.shake;
      } else {
        this.pivots[i].rotation.z = 0;
      }
    }

    // reel handle spins while reeling in
    if (p.phase === 'fighting') {
      this.reelSpin += dt * (p.tension > 4 ? 6 : 1.2);
    } else if (p.phase === 'retrieving') {
      this.reelSpin += dt * 9;
    } else {
      this.reelSpin += dt * 0.2;
    }
    this.reelHandle.rotation.x = this.reelSpin;
  }

  dispose() {
    disposeObject(this.group);
    for (const m of this.materials) m.dispose();
  }
}

/** Continuous line from the rod tip to the float / hooked fish. */
export class FishingLine {
  readonly mesh: THREE.Line;
  private geo: THREE.BufferGeometry;
  private mat: THREE.LineBasicMaterial;
  private count: number;
  private pos: Float32Array;

  constructor(points = 40) {
    this.count = points;
    this.pos = new Float32Array(points * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.LineBasicMaterial({
      color: 0xe9f0f2,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.mesh = new THREE.Line(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
  }

  /** Quadratic curve with sag; jitter makes a taut line sing during the fight. */
  update(from: THREE.Vector3, to: THREE.Vector3, sag: number, taut: number, time: number) {
    const arr = this.pos;
    const n = this.count;
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    mid.y -= sag;
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const it = 1 - t;
      // quadratic Bezier
      v.set(
        it * it * from.x + 2 * it * t * mid.x + t * t * to.x,
        it * it * from.y + 2 * it * t * mid.y + t * t * to.y,
        it * it * from.z + 2 * it * t * mid.z + t * t * to.z,
      );
      if (taut > 0.02) {
        const s = Math.sin(t * 22 - time * 26) * 0.012 * taut * Math.sin(t * Math.PI);
        v.x += s;
        v.y += s * 0.5;
      }
      arr[i * 3] = v.x;
      arr[i * 3 + 1] = v.y;
      arr[i * 3 + 2] = v.z;
    }
    this.geo.getAttribute('position').needsUpdate = true;
  }

  setVisible(v: boolean) {
    this.mesh.visible = v;
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

/** The float: visible after the cast, animated by the simulation's dip values. */
export class FloatRig {
  readonly group = new THREE.Group();
  private inner = new THREE.Group();
  private materials: THREE.Material[] = [];

  constructor() {
    const red = new THREE.MeshLambertMaterial({ color: 0xd83a2b, flatShading: true });
    const white = new THREE.MeshLambertMaterial({ color: 0xf3f2ea, flatShading: true });
    const bright = new THREE.MeshLambertMaterial({ color: 0xffb020, flatShading: true });
    const hookMat = new THREE.MeshLambertMaterial({ color: 0x6d7378, flatShading: true });
    this.materials.push(red, white, bright, hookMat);

    const lower = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.09, 8), white);
    lower.rotation.x = Math.PI;
    lower.position.y = -0.045;
    this.inner.add(lower);
    const upper = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.075, 8), red);
    upper.position.y = 0.038;
    this.inner.add(upper);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.12, 6), bright);
    stem.position.y = 0.13;
    this.inner.add(stem);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 5), red);
    bead.position.y = 0.19;
    this.inner.add(bead);
    // a bit of bait below the surface
    const bait = new THREE.Mesh(new THREE.SphereGeometry(0.014, 5, 4), hookMat);
    bait.position.y = -0.13;
    this.inner.add(bait);
    this.group.add(this.inner);
    this.group.visible = false;
  }

  place(x: number, surfaceY: number, z: number, dipCm: number, sink: number, slide: number, tilt: number) {
    this.group.visible = true;
    this.group.position.set(x + slide, surfaceY - dipCm / 100 - sink * 0.09, z);
    this.inner.rotation.z = tilt;
    this.inner.rotation.x = clamp(sink, 0, 1) * 0.45;
  }

  hide() {
    this.group.visible = false;
  }

  dispose() {
    disposeObject(this.group);
    for (const m of this.materials) m.dispose();
  }
}

/** Aiming marker drawn on the water while the cast is charging. */
export class AimMarker {
  readonly mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private inner: THREE.Mesh;

  constructor() {
    const geo = new THREE.RingGeometry(0.34, 0.5, 24);
    geo.rotateX(-Math.PI / 2);
    this.mat = new THREE.MeshBasicMaterial({
      color: 0x9be89b,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.visible = false;
    this.mesh.renderOrder = 5;
    const g2 = new THREE.RingGeometry(0.06, 0.13, 16);
    g2.rotateX(-Math.PI / 2);
    this.inner = new THREE.Mesh(g2, this.mat);
    this.mesh.add(this.inner);
  }

  place(x: number, y: number, z: number, ok: boolean, pulse: number) {
    this.mesh.visible = true;
    this.mesh.position.set(x, y + 0.03, z);
    this.mat.color.set(ok ? 0x9be89b : 0xe8836b);
    this.mat.opacity = 0.55 + 0.35 * pulse;
    const s = 1 + pulse * 0.18;
    this.mesh.scale.set(s, 1, s);
  }

  hide() {
    this.mesh.visible = false;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.inner.geometry.dispose();
    this.mat.dispose();
  }
}

export const ROD_ANCHOR = new THREE.Vector3(PLAYER_POS.x, PLAYER_POS.z + 0.2, 0);
