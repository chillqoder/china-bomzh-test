/**
 * The lake world: sky dome, sun / moon light with an accelerated day cycle,
 * water, terrain, tackle and creature views. Assembled from procedural pieces.
 */

import * as THREE from 'three';
import { LAKE_CENTER, PLAYER_POS, groundHeightAt, depthAt } from '@/game/lake';
import { clamp, clamp01, lerp } from '@/game/rng';
import type { Quality, WeatherState } from '@/game/types';
import { Clouds, Ripples, Splashes } from './effects';
import { buildFish, type FishModel } from './fishModels';
import {
  buildCamp,
  buildForest,
  buildGround,
  buildPier,
  buildReedBelt,
  buildRocks,
  buildTreeline,
  PLAYER_GROUND_Y,
  type Scenery,
} from './terrain';
import { AimMarker, FishingLine, FloatRig, RodRig } from './rod';
import { Water } from './water';
import { SPECIES } from '@/game/species';

const SKY_VS = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FS = /* glsl */ `
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform float uHaze;
  void main() {
    float h = clamp(vDir.y * 1.15 + 0.06, 0.0, 1.0);
    vec3 col = mix(uBottom, uTop, pow(h, 0.65));
    float sd = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
    col += uSunColor * pow(sd, 220.0) * 2.2;
    col += uSunColor * pow(sd, 12.0) * 0.28 * (0.5 + uHaze);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export interface SimVisualState {
  phase: string;
  hour: number;
  wind: number;
  weather: WeatherState;
  power: number;
  castT: number;
  retrieveT: number;
  aimDirX: number;
  aimDirZ: number;
  rigDistance: number;
  floatDip: number;
  floatSink: number;
  floatSlide: number;
  tension: number;
  biteStrength: number;
  fishDistance: number;
  fishAngle: number;
  fishBurst: number;
  targetOnLand: boolean;
  targetX: number;
  targetZ: number;
  hasTarget: boolean;
  hasRig: boolean;
  hasFish: boolean;
}

export class World {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly pipCamera: THREE.PerspectiveCamera;
  readonly water: Water;
  readonly rod: RodRig;
  readonly line: FishingLine;
  readonly float: FloatRig;
  readonly marker: AimMarker;
  readonly ripples: Ripples;
  readonly splashes: Splashes;
  private clouds: Clouds;
  private scenery: Scenery[] = [];
  private ground: THREE.Mesh | null = null;
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private ambient: THREE.AmbientLight;
  private hooked: FishModel | null = null;
  private shadow: FishModel | null = null;
  private shadowPhase = 0;
  private sunTarget = new THREE.Object3D();
  time = 0;
  quality: Quality;

  constructor(quality: Quality) {
    this.quality = quality;
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 700);
    this.camera.position.set(PLAYER_POS.x, PLAYER_GROUND_Y + 1.62, PLAYER_POS.z);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.pipCamera = new THREE.PerspectiveCamera(20, 1, 0.02, 200);
    this.pipCamera.rotation.order = 'YXZ';

    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VS,
      fragmentShader: SKY_FS,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x2f6f9c) },
        uBottom: { value: new THREE.Color(0xf0c39a) },
        uSunColor: { value: new THREE.Color(0xffd8a8) },
        uSunDir: { value: new THREE.Vector3(0.6, 0.2, -0.4) },
        uHaze: { value: 0.6 },
      },
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1;
    this.scene.add(this.sky);

    this.sun = new THREE.DirectionalLight(0xffe0b0, 1.6);
    this.sun.position.set(40, 25, -20);
    this.sun.target = this.sunTarget;
    this.scene.add(this.sun, this.sunTarget);
    this.hemi = new THREE.HemisphereLight(0xbcd8e8, 0x4c5a34, 0.6);
    this.scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.22);
    this.scene.add(this.ambient);

    this.scene.fog = new THREE.FogExp2(0xbcd3dd, 0.0034);

    this.water = new Water(56, quality === 'low' ? 80 : quality === 'medium' ? 130 : 170);
    this.scene.add(this.water.mesh);

    this.ripples = new Ripples(quality === 'low' ? 10 : 20);
    this.splashes = new Splashes(quality === 'low' ? 140 : 320);
    this.clouds = new Clouds(quality === 'low' ? 5 : 10);
    this.scene.add(this.ripples.group, this.splashes.points, this.clouds.group);

    this.rod = new RodRig();
    this.camera.add(this.rod.group);
    this.line = new FishingLine(quality === 'low' ? 22 : 36);
    this.scene.add(this.line.mesh);
    this.float = new FloatRig();
    this.scene.add(this.float.group);
    this.marker = new AimMarker();
    this.scene.add(this.marker.mesh);

    this.buildScenery(quality);
  }

  private buildScenery(quality: Quality) {
    this.clearScenery();
    this.ground = buildGround(quality);
    this.scene.add(this.ground);
    const pieces: Scenery[] = [
      buildTreeline(),
      buildForest(quality),
      buildReedBelt(quality),
      buildRocks(quality),
      buildPier(),
      buildCamp(),
    ];
    for (const p of pieces) {
      this.scene.add(p.group);
      this.scenery.push(p);
    }
    if (quality !== 'low') {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
      const c = this.sun.shadow.camera;
      c.left = -55;
      c.right = 55;
      c.top = 55;
      c.bottom = -55;
      c.near = 1;
      c.far = 180;
      this.sun.shadow.bias = -0.0008;
    } else {
      this.sun.castShadow = false;
    }
  }

  private clearScenery() {
    for (const s of this.scenery) {
      this.scene.remove(s.group);
      s.dispose();
    }
    this.scenery = [];
    if (this.ground) {
      this.scene.remove(this.ground);
      this.ground.geometry.dispose();
      (this.ground.material as THREE.Material).dispose();
      this.ground = null;
    }
  }

  setQuality(q: Quality) {
    if (q === this.quality) return;
    this.quality = q;
    this.water.mesh.geometry.dispose();
    this.water.mesh.geometry = new THREE.PlaneGeometry(112, 112, q === 'low' ? 80 : q === 'medium' ? 130 : 170, q === 'low' ? 80 : q === 'medium' ? 130 : 170);
    this.water.mesh.rotation.x = -Math.PI / 2;
    this.water.mesh.position.set(LAKE_CENTER.x, 0, LAKE_CENTER.z);
    this.buildScenery(q);
  }

  /* ------------------------------ creature views ----------------------------- */

  showHookedFish(species: keyof typeof SPECIES, lengthCm: number) {
    this.hideHookedFish();
    this.hooked = buildFish(SPECIES[species], lengthCm);
    this.hooked.group.visible = false;
    this.scene.add(this.hooked.group);
  }

  hideHookedFish() {
    if (!this.hooked) return;
    this.scene.remove(this.hooked.group);
    this.hooked.dispose();
    this.hooked = null;
  }

  showShadowFish(species: keyof typeof SPECIES, lengthCm: number) {
    if (this.shadow) return;
    this.shadow = buildFish(SPECIES[species], lengthCm);
    const tint = new THREE.MeshBasicMaterial({ color: 0x1e3326, fog: true });
    this.shadow.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = tint;
    });
    this.shadow.group.visible = false;
    this.scene.add(this.shadow.group);
  }

  hideShadowFish() {
    if (!this.shadow) return;
    this.scene.remove(this.shadow.group);
    this.shadow.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.Material).dispose) (m.material as THREE.Material).dispose();
    });
    this.shadow.dispose();
    this.shadow = null;
  }

  /* -------------------------------- day cycle -------------------------------- */

  private skyTop = new THREE.Color();
  private skyBottom = new THREE.Color();
  private fogColor = new THREE.Color();
  private sunColor = new THREE.Color();

  updateSky(hour: number, weather: WeatherState) {
    const a = ((hour - 6) / 24) * Math.PI * 2;
    const elev = Math.sin(a);
    const e = clamp01(elev);
    const warm = clamp01(1 - Math.abs(elev) * 2.4);
    const cover = weather.id === 'overcast' || weather.id === 'drizzle' ? 1 : weather.id === 'clouds' ? 0.55 : 0.2;
    const dim = lerp(0.35, 1, clamp01(weather.lightFactor));

    const dayTop = new THREE.Color(0x3f7fb0);
    const dayBottom = new THREE.Color(0xaed3e0);
    const duskTop = new THREE.Color(0x2b3d63);
    const duskBottom = new THREE.Color(0xe48a52);
    const nightTop = new THREE.Color(0x0a1226);
    const nightBottom = new THREE.Color(0x1b2a44);
    const grey = new THREE.Color(0x8e9aa1);

    const night = clamp01(-elev * 2.2);
    this.skyTop.copy(dayTop).lerp(duskTop, warm).lerp(nightTop, night);
    this.skyBottom.copy(dayBottom).lerp(duskBottom, warm).lerp(nightBottom, night);
    if (cover > 0.4) {
      this.skyTop.lerp(grey, cover * 0.55);
      this.skyBottom.lerp(grey, cover * 0.7);
    }
    this.sunColor.set(0xffdca8).lerp(new THREE.Color(0xff8a3d), warm * 0.75);
    if (cover > 0.5) this.sunColor.lerp(grey, cover * 0.5);
    this.fogColor.copy(this.skyBottom).multiplyScalar(0.92);
    if (night > 0.4) this.fogColor.lerp(new THREE.Color(0x141d2e), night);

    this.skyMat.uniforms.uTop.value.copy(this.skyTop);
    this.skyMat.uniforms.uBottom.value.copy(this.skyBottom);
    this.skyMat.uniforms.uSunColor.value.copy(this.sunColor);
    this.skyMat.uniforms.uHaze.value = 0.35 + warm * 0.5 + cover * 0.3;

    const dirX = Math.cos(a) * 0.85;
    const dirY = Math.max(0.02, Math.abs(Math.sin(a)));
    const dirZ = -0.35 + Math.cos(a) * 0.2;
    const sunDir = new THREE.Vector3(dirX, Math.sin(a), dirZ).normalize();
    const lightDir = elev > 0 ? sunDir : sunDir.clone().multiply(new THREE.Vector3(-0.4, -1, -0.4)).normalize();
    this.skyMat.uniforms.uSunDir.value.copy(elev > -0.1 ? sunDir : lightDir);

    this.sun.position.copy(lightDir).multiplyScalar(70).add(new THREE.Vector3(LAKE_CENTER.x, 0, LAKE_CENTER.z));
    this.sunTarget.position.set(PLAYER_POS.x, 0, PLAYER_POS.z - 12);
    this.sun.color.copy(elev > 0 ? this.sunColor : new THREE.Color(0x8ea6cc));
    this.sun.intensity = lerp(0.18, 2.1, e) * dim;
    this.hemi.color.copy(this.skyTop).lerp(new THREE.Color(0xffffff), 0.25);
    this.hemi.groundColor.set(0x4c5a34);
    this.hemi.intensity = lerp(0.25, 0.75, e) * dim + 0.12;
    this.ambient.intensity = lerp(0.1, 0.3, e) * dim + night * 0.06;

    const morningMist = clamp01(1 - Math.abs(hour - 6.2) / 2.6) * 0.0022;
    const fogDensity = 0.0031 + morningMist + cover * 0.0011 + night * 0.0026;
    (this.scene.fog as THREE.FogExp2).color.copy(this.fogColor);
    (this.scene.fog as THREE.FogExp2).density = fogDensity;
    void dirY;

    this.water.setColors({
      sky: this.skyBottom.clone().lerp(this.skyTop, 0.35),
      sun: this.sunColor,
      sunDir: elev > 0 ? sunDir : new THREE.Vector3(0.2, 0.4, -0.6),
      fog: this.fogColor,
      fogDensity,
      rain: weather.id === 'drizzle' ? 1 : 0,
    });
    this.water.mesh.visible = true;
  }

  /* --------------------------------- update -------------------------------- */

  update(dt: number, s: SimVisualState, camYaw: number) {
    this.time += dt;
    this.updateSky(s.hour, s.weather);
    this.water.update(this.time, 0.15 + s.wind * 0.9);
    this.ripples.update(dt);
    this.splashes.update(dt);
    const cover = s.weather.id === 'overcast' || s.weather.id === 'drizzle' ? 1 : s.weather.id === 'clouds' ? 0.55 : 0.15;
    this.clouds.update(dt, s.wind, cover, this.skyTop.clone().lerp(new THREE.Color(0xffffff), 0.55).multiplyScalar(lerp(0.5, 1, clamp01(Math.sin(((s.hour - 6) / 24) * Math.PI * 2) + 0.3))));
    for (const sc of this.scenery) sc.update(this.time, s.wind);

    // rig position in the world
    const dirX = s.aimDirX;
    const dirZ = s.aimDirZ;
    let rigX = PLAYER_POS.x + dirX * s.rigDistance;
    let rigZ = PLAYER_POS.z + dirZ * s.rigDistance;

    if (s.phase === 'casting') {
      const t = clamp01(s.castT);
      const from = new THREE.Vector3(PLAYER_POS.x, 1.3, PLAYER_POS.z + 0.2);
      const to = new THREE.Vector3(rigX, 0.05, rigZ);
      const pos = new THREE.Vector3().lerpVectors(from, to, t);
      pos.y = lerp(from.y, to.y, t) + Math.sin(Math.PI * t) * (2.2 + s.rigDistance * 0.06);
      rigX = pos.x;
      rigZ = pos.z;
      this.float.place(pos.x, pos.y - 0.1, pos.z, 0, 0, 0, 0.5);
      this.float.group.visible = true;
    } else if (s.phase === 'retrieving') {
      const t = clamp01(s.retrieveT);
      const nearX = PLAYER_POS.x + dirX * 2.2;
      const nearZ = PLAYER_POS.z + dirZ * 2.2;
      rigX = lerp(rigX, nearX, t);
      rigZ = lerp(rigZ, nearZ, t);
      this.float.place(rigX, this.water.surfaceY(rigX, rigZ), rigZ, s.floatDip, s.floatSink, s.floatSlide, 0.15);
    } else if (s.hasRig || s.hasFish) {
      const surf = this.water.surfaceY(rigX, rigZ);
      this.float.place(rigX, surf, rigZ, s.floatDip, s.floatSink, s.floatSlide, s.floatSlide * 0.6);
    } else {
      this.float.hide();
    }

    // aim marker
    if (s.phase === 'charging' && s.hasTarget) {
      const my = s.targetOnLand ? groundHeightAt(s.targetX, s.targetZ) + 0.06 : this.water.surfaceY(s.targetX, s.targetZ);
      this.marker.place(s.targetX, my, s.targetZ, !s.targetOnLand, 0.5 + 0.5 * Math.sin(this.time * 7));
    } else {
      this.marker.hide();
    }

    // rod attitude toward the rig / fish
    let focusX = rigX;
    let focusZ = rigZ;
    if (s.hasFish) {
      focusX = PLAYER_POS.x + Math.cos(s.fishAngle) * dirX - Math.sin(s.fishAngle) * dirZ * 1;
      focusZ = PLAYER_POS.z + Math.sin(s.fishAngle) * dirX + Math.cos(s.fishAngle) * dirZ;
      focusX = PLAYER_POS.x + (dirX * Math.cos(s.fishAngle) - dirZ * Math.sin(s.fishAngle)) * s.fishDistance;
      focusZ = PLAYER_POS.z + (dirX * Math.sin(s.fishAngle) + dirZ * Math.cos(s.fishAngle)) * s.fishDistance;
    }
    const toFocus = new THREE.Vector3(focusX - this.camera.position.x, 0, focusZ - this.camera.position.z);
    const focusYaw = Math.atan2(toFocus.x, -toFocus.z);
    const rel = Math.atan2(Math.sin(focusYaw - camYaw), Math.cos(focusYaw - camYaw));
    const dist = Math.hypot(focusX - PLAYER_POS.x, focusZ - PLAYER_POS.z);
    const rodPitch = s.hasRig || s.hasFish ? Math.atan2(this.camera.position.y - 0.1, Math.max(1, dist)) : 0;

    this.rod.update(dt, {
      phase: s.phase,
      tension: s.tension,
      power: s.power,
      castT: s.castT,
      retrieveT: s.retrieveT,
      targetYaw: rel,
      targetPitch: rodPitch,
      time: this.time,
      wind: s.wind,
      shake: s.hasFish ? s.fishBurst : 0,
      bite: s.biteStrength,
    });

    // line: tip -> float / fish
    const tip = this.rod.tipWorld(new THREE.Vector3());
    const showLine = s.hasRig || s.hasFish || s.phase === 'casting';
    this.line.setVisible(showLine);
    if (showLine) {
      const end = new THREE.Vector3();
      if (s.hasFish && this.hooked) {
        this.hooked.group.getWorldPosition(end);
        end.y += 0.02;
      } else {
        this.float.group.getWorldPosition(end);
      }
      const sag = s.hasFish ? clamp(0.5 - s.tension / 200, 0.02, 0.5) : s.phase === 'casting' ? 0.35 : clamp(0.42 - s.wind * 0.2, 0.06, 0.42);
      this.line.update(tip, end, sag, s.hasFish ? clamp01(s.tension / 120) : 0, this.time);
    }

    // hooked fish view
    if (this.hooked) {
      this.hooked.group.visible = s.hasFish;
      if (s.hasFish) {
        const fx = focusX;
        const fz = focusZ;
        const surf = this.water.surfaceY(fx, fz);
        const submerge = lerp(-0.35, 0.02, clamp01(1 - s.fishBurst));
        this.hooked.group.position.set(fx, surf + submerge, fz);
        const heading = Math.atan2(dirX, dirZ) + s.fishAngle + (s.fishBurst > 0.5 ? 0.3 : 0);
        this.hooked.group.rotation.set(
          Math.sin(this.time * 3) * 0.06,
          heading,
          Math.sin(this.time * 2.2) * 0.08 + clamp01(s.fishBurst) * 0.2,
        );
        this.hooked.setWiggle(this.time * (4 + s.fishBurst * 11));
        if (s.fishBurst > 0.62 && Math.random() < dt * 6) {
          this.splashes.burst(fx, surf, fz, 0.5 + s.fishBurst * 0.5, 1.3);
          this.ripples.spawn(fx, surf, fz, 1.6 + s.fishBurst * 2, 1.7, 0.9);
        }
      }
    }

    // curious fish under the float
    if (this.shadow) {
      this.shadow.group.visible = s.phase === 'investigating' || s.phase === 'strike';
      if (this.shadow.group.visible) {
        this.shadowPhase += dt * (s.phase === 'strike' ? 1.6 : 0.9);
        const r = 0.85 + Math.sin(this.shadowPhase * 0.7) * 0.3;
        const px = rigX + Math.cos(this.shadowPhase) * r;
        const pz = rigZ + Math.sin(this.shadowPhase * 1.1) * r;
        const d = Math.max(0.2, depthAt(px, pz));
        this.shadow.group.position.set(px, -Math.min(d * 0.55, 0.45), pz);
        this.shadow.group.rotation.set(0, -this.shadowPhase + Math.PI / 2, Math.sin(this.shadowPhase) * 0.12);
        this.shadow.setWiggle(this.time * 7);
      }
    }

    // tiny ripple around the float, plus the bite signal rings
    if ((s.hasRig || s.hasFish) && Math.random() < dt * (0.5 + s.wind)) {
      this.ripples.spawn(rigX, 0, rigZ, 0.55, 1.4, 0.28);
    }
  }

  /** Picture-in-picture camera framing the float. */
  updatePip() {
    if (!this.float.group.visible) return;
    const f = this.float.group.position;
    const cam = this.camera.position;
    const dir = new THREE.Vector3(f.x - cam.x, 0, f.z - cam.z).normalize();
    const dist = Math.min(1.6, Math.max(0.6, f.distanceTo(cam) * 0.06));
    const pos = new THREE.Vector3(f.x + dir.x * dist, f.y + 0.34, f.z + dir.z * dist);
    pos.y += this.water.surfaceY(pos.x, pos.z) * 0.4;
    this.pipCamera.position.copy(pos);
    this.pipCamera.lookAt(f.x, f.y - 0.02, f.z);
    this.pipCamera.rotation.z = Math.sin(this.time * 1.4) * 0.008;
  }

  dispose() {
    this.hideHookedFish();
    this.hideShadowFish();
    this.clearScenery();
    this.water.dispose();
    this.rod.dispose();
    this.line.dispose();
    this.float.dispose();
    this.marker.dispose();
    this.ripples.dispose();
    this.splashes.dispose();
    this.clouds.dispose();
    this.sky.geometry.dispose();
    this.skyMat.dispose();
    this.scene.clear();
  }
}

export const PLAYER_EYE_Y = PLAYER_GROUND_Y + 1.62;
