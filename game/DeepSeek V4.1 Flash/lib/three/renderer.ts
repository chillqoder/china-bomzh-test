import * as THREE from "three";
import { buildFish, disposeObject } from "./fishMesh";
import { SPECIES_MAP } from "@/lib/game/data";
import {
  LAKE_CENTER_X,
  LAKE_CENTER_Z,
  PLAYER_POS,
  REED_CLUSTERS,
  terrainHeight,
  waterDepth,
} from "@/lib/game/terrain";
import type { FxEvent, QualityId, SimSnapshot, WeatherId } from "@/lib/game/types";

type RGB = [number, number, number];

interface Palette {
  skyTop: RGB;
  skyHorizon: RGB;
  sunColor: RGB;
  sunIntensity: number;
  hemiIntensity: number;
  hemiSky: RGB;
  hemiGround: RGB;
  fog: RGB;
  fogDensity: number;
  waterShallow: RGB;
  waterDeep: RGB;
  skyReflection: RGB;
}

interface Key {
  h: number;
  top: RGB;
  horizon: RGB;
  sun: RGB;
  sunI: number;
  hemiI: number;
  hemiGround: RGB;
  fog: RGB;
  fogD: number;
  shallow: RGB;
  deep: RGB;
  refl: RGB;
}

const KEYS: Key[] = [
  {
    h: 0,
    top: [0.05, 0.07, 0.16],
    horizon: [0.12, 0.15, 0.28],
    sun: [0.62, 0.72, 0.95],
    sunI: 0.55,
    hemiI: 0.6,
    hemiGround: [0.09, 0.1, 0.13],
    fog: [0.08, 0.1, 0.17],
    fogD: 0.0082,
    shallow: [0.07, 0.13, 0.18],
    deep: [0.03, 0.07, 0.12],
    refl: [0.07, 0.09, 0.18],
  },
  {
    h: 5,
    top: [0.18, 0.2, 0.35],
    horizon: [0.78, 0.46, 0.3],
    sun: [1.0, 0.6, 0.35],
    sunI: 0.7,
    hemiI: 0.5,
    hemiGround: [0.12, 0.1, 0.1],
    fog: [0.36, 0.3, 0.36],
    fogD: 0.0098,
    shallow: [0.1, 0.16, 0.2],
    deep: [0.04, 0.09, 0.14],
    refl: [0.3, 0.3, 0.45],
  },
  {
    h: 7.5,
    top: [0.35, 0.55, 0.8],
    horizon: [1.0, 0.76, 0.52],
    sun: [1.0, 0.85, 0.62],
    sunI: 2.3,
    hemiI: 1.0,
    hemiGround: [0.22, 0.2, 0.16],
    fog: [0.76, 0.78, 0.8],
    fogD: 0.006,
    shallow: [0.16, 0.34, 0.4],
    deep: [0.05, 0.15, 0.24],
    refl: [0.5, 0.65, 0.85],
  },
  {
    h: 12,
    top: [0.3, 0.55, 0.9],
    horizon: [0.75, 0.88, 1.0],
    sun: [1.0, 0.98, 0.92],
    sunI: 2.9,
    hemiI: 1.2,
    hemiGround: [0.26, 0.25, 0.2],
    fog: [0.82, 0.88, 0.94],
    fogD: 0.005,
    shallow: [0.17, 0.4, 0.47],
    deep: [0.04, 0.17, 0.3],
    refl: [0.6, 0.75, 0.95],
  },
  {
    h: 17,
    top: [0.35, 0.5, 0.8],
    horizon: [1.0, 0.7, 0.45],
    sun: [1.0, 0.75, 0.5],
    sunI: 2.0,
    hemiI: 0.95,
    hemiGround: [0.24, 0.2, 0.15],
    fog: [0.8, 0.72, 0.63],
    fogD: 0.006,
    shallow: [0.16, 0.33, 0.34],
    deep: [0.05, 0.15, 0.2],
    refl: [0.5, 0.6, 0.8],
  },
  {
    h: 19.5,
    top: [0.15, 0.18, 0.35],
    horizon: [0.8, 0.45, 0.35],
    sun: [0.9, 0.5, 0.3],
    sunI: 0.5,
    hemiI: 0.45,
    hemiGround: [0.1, 0.1, 0.12],
    fog: [0.3, 0.28, 0.38],
    fogD: 0.0098,
    shallow: [0.08, 0.13, 0.17],
    deep: [0.03, 0.07, 0.11],
    refl: [0.25, 0.25, 0.4],
  },
  {
    h: 22,
    top: [0.06, 0.08, 0.17],
    horizon: [0.13, 0.16, 0.29],
    sun: [0.62, 0.72, 0.95],
    sunI: 0.5,
    hemiI: 0.55,
    hemiGround: [0.09, 0.1, 0.13],
    fog: [0.09, 0.11, 0.18],
    fogD: 0.0086,
    shallow: [0.07, 0.13, 0.18],
    deep: [0.03, 0.07, 0.12],
    refl: [0.07, 0.09, 0.18],
  },
  {
    h: 24,
    top: [0.05, 0.07, 0.16],
    horizon: [0.12, 0.15, 0.28],
    sun: [0.62, 0.72, 0.95],
    sunI: 0.55,
    hemiI: 0.6,
    hemiGround: [0.09, 0.1, 0.13],
    fog: [0.08, 0.1, 0.17],
    fogD: 0.0082,
    shallow: [0.07, 0.13, 0.18],
    deep: [0.03, 0.07, 0.12],
    refl: [0.07, 0.09, 0.18],
  },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function desaturate(c: RGB, amount: number): RGB {
  const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  return [lerp(c[0], l, amount), lerp(c[1], l, amount), lerp(c[2], l, amount)];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WATER_VERT = `
uniform float uTime;
attribute float aDepth;
varying vec3 vWorld;
varying float vDepth;
void main() {
  vec3 p = position;
  float w1 = sin(p.x * 0.85 + uTime * 1.4) * 0.016;
  float w2 = sin(p.z * 1.15 - uTime * 1.0) * 0.013;
  float w3 = sin((p.x + p.z) * 0.5 + uTime * 0.7) * 0.018;
  p.y += w1 + w2 + w3;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  vDepth = aDepth;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const WATER_FRAG = `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uSkyReflection;
uniform vec3 uFogColor;
uniform float uFogDensity;
varying vec3 vWorld;
varying float vDepth;
void main() {
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float nx = sin(vWorld.x * 2.6 + uTime * 1.9) * 0.032 + sin(vWorld.z * 3.3 - uTime * 1.4) * 0.026;
  float nz = cos(vWorld.z * 2.9 + uTime * 1.7) * 0.032 + sin(vWorld.x * 3.7 + uTime * 1.1) * 0.026;
  vec3 n = normalize(vec3(nx, 1.0, nz));
  float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 2.2);
  vec3 water = mix(uShallow, uDeep, clamp(vDepth / 3.2, 0.0, 1.0));
  vec3 col = mix(water, uSkyReflection, fres * 0.8);
  vec3 halfV = normalize(uSunDir + viewDir);
  float spec = pow(max(dot(n, halfV), 0.0), 90.0) * 0.9;
  col += uSunColor * spec;
  float sparkle = pow(max(dot(n, halfV), 0.0), 600.0) * 2.2;
  col += uSunColor * sparkle;
  float foam = 1.0 - smoothstep(0.0, 0.3, vDepth);
  col = mix(col, vec3(0.8, 0.87, 0.86), foam * 0.4);
  float dist = length(cameraPosition - vWorld);
  float fogF = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));
  gl_FragColor = vec4(col, mix(0.8, 0.97, fres));
}
`;

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
varying vec3 vDir;
void main() {
  float t = clamp(vDir.y, -0.15, 1.0);
  vec3 col = mix(uHorizon, uTop, pow(max(t, 0.0), 0.55));
  if (vDir.y < 0.0) {
    col = mix(uHorizon, uHorizon * 0.6, clamp(-vDir.y * 4.0, 0.0, 1.0));
  }
  float sun = max(dot(normalize(vDir), uSunDir), 0.0);
  col += uSunColor * pow(sun, 400.0) * 1.3;
  col += uSunColor * pow(sun, 10.0) * 0.16;
  gl_FragColor = vec4(col, 1.0);
}
`;

interface Ripple {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  maxScale: number;
}

interface SplashSystem {
  points: THREE.Points;
  velocities: Float32Array;
  life: number;
  maxLife: number;
  active: boolean;
}

export class GameRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private quality: QualityId;
  private time = 0;

  private waterMat: THREE.ShaderMaterial;
  private skyMat: THREE.ShaderMaterial;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private ambient: THREE.AmbientLight;

  private rodGroup: THREE.Group;
  private rodJoint1: THREE.Group;
  private rodJoint2: THREE.Group;
  private tipAnchor: THREE.Object3D;
  private lineMesh: THREE.Line;
  private linePositions: Float32Array;
  private floatGroup: THREE.Group;
  private aimMarker: THREE.Group;
  private aimRingMat: THREE.MeshBasicMaterial;

  private ripples: Ripple[] = [];
  private splashes: SplashSystem[] = [];
  private bubbleSystem: SplashSystem;
  private rain: THREE.Points;
  private rainSpeeds: Float32Array;

  private fightFish: THREE.Group | null = null;
  private fightFishKey = "";

  private lastPhase = "";
  private castAnim = 0;
  private prevPower = 0;
  private lastTension = 0;

  constructor(canvas: HTMLCanvasElement, quality: QualityId) {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality === "high",
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = quality !== "low";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x9aa7b0, 0.006);

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.05, 700);
    this.camera.rotation.order = "YXZ";

    const pGround = terrainHeight(PLAYER_POS.x, PLAYER_POS.z);
    this.camera.position.set(PLAYER_POS.x, pGround + 1.65, PLAYER_POS.z);

    this.hemi = new THREE.HemisphereLight(0xbdd7ef, 0x5a5138, 1.0);
    this.scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.12);
    this.scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sun.position.set(40, 60, 20);
    this.sun.castShadow = quality !== "low";
    this.sun.shadow.mapSize.set(quality === "high" ? 2048 : 1024, quality === "high" ? 2048 : 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -80;
    sc.right = 80;
    sc.top = 80;
    sc.bottom = -80;
    sc.near = 10;
    sc.far = 260;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.sun.target.position.set(LAKE_CENTER_X, 0, LAKE_CENTER_Z);

    // water
    const waterGeo = new THREE.PlaneGeometry(210, 190, 130, 120);
    waterGeo.rotateX(-Math.PI / 2);
    waterGeo.translate(LAKE_CENTER_X, 0, LAKE_CENTER_Z);
    const posAttr = waterGeo.attributes.position as THREE.BufferAttribute;
    const depths = new Float32Array(posAttr.count);
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      depths[i] = Math.min(5, waterDepth(x, z));
    }
    waterGeo.setAttribute("aDepth", new THREE.BufferAttribute(depths, 1));
    this.waterMat = new THREE.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color(1, 1, 1) },
        uShallow: { value: new THREE.Color(0.2, 0.42, 0.42) },
        uDeep: { value: new THREE.Color(0.04, 0.18, 0.26) },
        uSkyReflection: { value: new THREE.Color(0.6, 0.75, 0.95) },
        uFogColor: { value: new THREE.Color(0.82, 0.88, 0.94) },
        uFogDensity: { value: 0.005 },
      },
    });
    const water = new THREE.Mesh(waterGeo, this.waterMat);
    water.renderOrder = 2;
    this.scene.add(water);

    // sky
    const skyGeo = new THREE.SphereGeometry(480, 28, 16);
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(0.3, 0.55, 0.9) },
        uHorizon: { value: new THREE.Color(0.75, 0.88, 1.0) },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color(1, 1, 1) },
      },
    });
    const sky = new THREE.Mesh(skyGeo, this.skyMat);
    this.scene.add(sky);

    this.buildTerrain();
    this.buildTrees();
    this.buildReeds();
    this.buildRocks();
    this.buildPier();
    this.buildProps();

    // rod
    const rod = this.buildRod();
    this.rodGroup = rod.group;
    this.rodJoint1 = rod.joint1;
    this.rodJoint2 = rod.joint2;
    this.tipAnchor = rod.tip;
    this.camera.add(this.rodGroup);
    this.scene.add(this.camera);

    // line
    this.linePositions = new Float32Array(32 * 3);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(this.linePositions, 3));
    this.lineMesh = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ color: 0xdfeccd, transparent: true, opacity: 0.65 })
    );
    this.lineMesh.frustumCulled = false;
    this.scene.add(this.lineMesh);

    // float
    this.floatGroup = this.buildFloat();
    this.scene.add(this.floatGroup);

    // aim marker
    const aim = this.buildAimMarker();
    this.aimMarker = aim.group;
    this.aimRingMat = aim.material;
    this.scene.add(this.aimMarker);

    // ripples pool
    for (let i = 0; i < 10; i++) {
      const geo = new THREE.RingGeometry(0.72, 0.85, 36);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xd7ecef,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 3;
      this.scene.add(mesh);
      this.ripples.push({ mesh, life: 0, maxLife: 1, maxScale: 2 });
    }

    // splash systems
    for (let i = 0; i < 4; i++) {
      this.splashes.push(this.makeParticleSystem(64, 0xe8f2f4, 0.07));
    }
    this.bubbleSystem = this.makeParticleSystem(26, 0xffffff, 0.05);

    // rain
    const rainCount = quality === "low" ? 0 : 700;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(Math.max(1, rainCount) * 3);
    this.rainSpeeds = new Float32Array(Math.max(1, rainCount));
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 70;
      rainPos[i * 3 + 1] = Math.random() * 26;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
      this.rainSpeeds[i] = 7 + Math.random() * 5;
    }
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
    this.rain = new THREE.Points(
      rainGeo,
      new THREE.PointsMaterial({
        color: 0xaecbe0,
        size: 0.055,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      })
    );
    this.rain.position.set(PLAYER_POS.x, 0, PLAYER_POS.z);
    this.rain.visible = false;
    this.scene.add(this.rain);

    this.setQuality(quality);
  }

  private buildTerrain(): void {
    const size = 320;
    const seg = this.quality === "low" ? 96 : 140;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const cSand = new THREE.Color(0xc9b98a);
    const cSandWet = new THREE.Color(0x9a8a5f);
    const cBed = new THREE.Color(0x2e2a20);
    const cGrass = new THREE.Color(0x7da34e);
    const cGrassDark = new THREE.Color(0x5f7f3a);
    const cDirt = new THREE.Color(0x8a7648);
    const rand = mulberry32(1337);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      let col: THREE.Color;
      if (h < -2.6) col = cBed.clone();
      else if (h < -0.05) col = cBed.clone().lerp(cSandWet, Math.min(1, (h + 2.6) / 2.6));
      else if (h < 0.55) col = cSandWet.clone().lerp(cSand, Math.min(1, (h + 0.05) / 0.6));
      else if (h < 1.4) {
        col = cSand.clone().lerp(cGrass, Math.min(1, (h - 0.55) / 0.85));
        if (rand() < 0.15) col.lerp(cDirt, 0.4);
      } else {
        col = cGrass.clone().lerp(cGrassDark, Math.min(1, (h - 1.4) / 2.5));
      }
      const v = 0.92 + rand() * 0.16;
      colors[i * 3] = col.r * v;
      colors[i * 3 + 1] = col.g * v;
      colors[i * 3 + 2] = col.b * v;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = this.quality !== "low";
    this.scene.add(mesh);
  }

  private buildTrees(): void {
    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.17, 3.4, 6);
    trunkGeo.translate(0, 1.7, 0);
    const birchLeafGeo = new THREE.IcosahedronGeometry(1.1, 0);
    const pineConeGeo = new THREE.ConeGeometry(1.5, 2.3, 7);
    const trunkMatB = new THREE.MeshStandardMaterial({ color: 0xe6e0d0, roughness: 0.9, flatShading: true });
    const trunkMatP = new THREE.MeshStandardMaterial({ color: 0x6b4f34, roughness: 0.95, flatShading: true });
    const birchMat = new THREE.MeshStandardMaterial({ color: 0x86b054, roughness: 0.9, flatShading: true });
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x3e6b3c, roughness: 0.9, flatShading: true });

    const rand = mulberry32(2024);
    type T = { kind: "birch" | "pine"; x: number; z: number; s: number };
    const trees: T[] = [];
    let guard = 0;
    while (trees.length < 66 && guard++ < 3000) {
      const a = rand() * Math.PI * 2;
      const r = 70 + rand() * 60;
      const x = LAKE_CENTER_X + Math.cos(a) * r;
      const z = LAKE_CENTER_Z + Math.sin(a) * r * 0.9;
      const h = terrainHeight(x, z);
      if (h < 1.1 || h > 6) continue;
      if (Math.hypot(x - PLAYER_POS.x, z - PLAYER_POS.z) < 7) continue;
      trees.push({ kind: rand() < 0.5 ? "birch" : "pine", x, z, s: 0.8 + rand() * 0.9 });
    }
    // a few closer birches to frame the scene
    const framing: T[] = [
      { kind: "birch", x: -12, z: 26, s: 1.1 },
      { kind: "birch", x: -15, z: 22, s: 0.9 },
      { kind: "birch", x: 14, z: 27, s: 1.2 },
      { kind: "birch", x: 17, z: 22, s: 1.0 },
      { kind: "pine", x: -19, z: 28, s: 1.3 },
      { kind: "pine", x: 20, z: 29, s: 1.4 },
      { kind: "pine", x: 24, z: 20, s: 1.1 },
      { kind: "birch", x: -9, z: 31, s: 1.3 },
    ];
    for (const f of framing) trees.push(f);

    const dummy = new THREE.Object3D();
    const birches = trees.filter((t) => t.kind === "birch");
    const pines = trees.filter((t) => t.kind === "pine");

    const birchTrunks = new THREE.InstancedMesh(trunkGeo, trunkMatB, birches.length);
    const birchLeaves = new THREE.InstancedMesh(birchLeafGeo, birchMat, birches.length * 2);
    birches.forEach((t, i) => {
      const y = terrainHeight(t.x, t.z);
      dummy.position.set(t.x, y, t.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(t.s);
      dummy.updateMatrix();
      birchTrunks.setMatrixAt(i, dummy.matrix);
      dummy.position.set(t.x, y + 3.4 * t.s, t.z);
      dummy.scale.set(1.2 * t.s, 1.5 * t.s, 1.2 * t.s);
      dummy.updateMatrix();
      birchLeaves.setMatrixAt(i * 2, dummy.matrix);
      dummy.position.set(t.x + 0.7 * t.s, y + 2.7 * t.s, t.z + 0.3 * t.s);
      dummy.scale.setScalar(0.8 * t.s);
      dummy.updateMatrix();
      birchLeaves.setMatrixAt(i * 2 + 1, dummy.matrix);
    });

    const pineTrunks = new THREE.InstancedMesh(trunkGeo, trunkMatP, pines.length);
    const pineCones = new THREE.InstancedMesh(pineConeGeo, pineMat, pines.length * 3);
    pines.forEach((t, i) => {
      const y = terrainHeight(t.x, t.z);
      dummy.position.set(t.x, y, t.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(t.s * 1.15);
      dummy.updateMatrix();
      pineTrunks.setMatrixAt(i, dummy.matrix);
      const base = y + 2.6 * t.s;
      for (let k = 0; k < 3; k++) {
        dummy.position.set(t.x, base + k * 1.35 * t.s, t.z);
        const cs = t.s * (1.35 - k * 0.3);
        dummy.scale.set(cs, t.s * 1.05, cs);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        pineCones.setMatrixAt(i * 3 + k, dummy.matrix);
      }
    });

    for (const m of [birchTrunks, birchLeaves, pineTrunks, pineCones]) {
      m.castShadow = this.quality !== "low";
      this.scene.add(m);
    }

    // distant treeline
    const farGeo = new THREE.ConeGeometry(3.2, 8, 6);
    const farMat = new THREE.MeshStandardMaterial({ color: 0x3c5a3a, roughness: 1, flatShading: true });
    const farCount = 130;
    const far = new THREE.InstancedMesh(farGeo, farMat, farCount);
    for (let i = 0; i < farCount; i++) {
      const a = rand() * Math.PI * 2;
      const r = 120 + rand() * 55;
      const x = LAKE_CENTER_X + Math.cos(a) * r;
      const z = LAKE_CENTER_Z + Math.sin(a) * r;
      const y = Math.max(0, terrainHeight(x, z));
      dummy.position.set(x, y + 3.6, z);
      const s = 1 + rand() * 1.6;
      dummy.scale.set(s, s * (0.9 + rand() * 0.5), s);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      dummy.updateMatrix();
      far.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(far);
  }

  private buildReeds(): void {
    const geo = new THREE.CylinderGeometry(0.012, 0.02, 1.7, 4);
    geo.translate(0, 0.85, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x6f8a3f, roughness: 1, flatShading: true });
    const total = REED_CLUSTERS.reduce((a, c) => a + c.count, 0);
    const mesh = new THREE.InstancedMesh(geo, mat, total);
    const dummy = new THREE.Object3D();
    const rand = mulberry32(555);
    let placed = 0;
    for (const c of REED_CLUSTERS) {
      for (let i = 0; i < c.count; i++) {
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * c.radius;
        const x = c.x + Math.cos(a) * r;
        const z = c.z + Math.sin(a) * r;
        const y = terrainHeight(x, z);
        if (y > 0.4) continue;
        dummy.position.set(x, y, z);
        dummy.rotation.set((rand() - 0.5) * 0.25, rand() * Math.PI, (rand() - 0.5) * 0.25);
        dummy.scale.setScalar(0.7 + rand() * 0.8);
        dummy.updateMatrix();
        mesh.setMatrixAt(placed, dummy.matrix);
        placed++;
      }
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
  }

  private buildRocks(): void {
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8b8a86, roughness: 1, flatShading: true });
    const count = 46;
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    const rand = mulberry32(777);
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < 600) {
      const a = rand() * Math.PI * 2;
      const r = 44 + rand() * 24;
      let x = LAKE_CENTER_X + Math.cos(a) * r;
      let z = LAKE_CENTER_Z + Math.sin(a) * r * 0.85;
      if (rand() < 0.5) {
        x = PLAYER_POS.x + (rand() - 0.5) * 44;
        z = PLAYER_POS.z + (rand() - 0.5) * 24;
      }
      if (Math.hypot(x - PLAYER_POS.x, z - PLAYER_POS.z) < 13) continue;
      const y = terrainHeight(x, z);
      if (y < -0.9 || y > 2.2) continue;
      dummy.position.set(x, y + 0.02, z);
      dummy.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
      const s = 0.18 + rand() * 0.42;
      dummy.scale.set(s, s * 0.65, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = this.quality !== "low";
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  private buildPier(): void {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.9, flatShading: true });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x6b563b, roughness: 0.95, flatShading: true });
    const x0 = -13;
    const zStart = 24;
    const zEnd = 2;
    const step = 1.1;
    const n = Math.floor((zStart - zEnd) / step);
    for (let i = 0; i <= n; i++) {
      const z = zStart - i * step;
      const h = terrainHeight(x0, z);
      const deckY = Math.max(1.15, h + 0.75);
      const plank = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.95), woodMat);
      plank.position.set(x0, deckY, z);
      plank.rotation.y = (Math.sin(i * 1.7) * 0.02);
      plank.castShadow = this.quality !== "low";
      plank.receiveShadow = true;
      group.add(plank);
      if (i % 2 === 0) {
        for (const side of [-0.9, 0.9]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, deckY + 1.4, 6), darkMat);
          post.position.set(x0 + side, deckY - (deckY + 1.4) / 2 + 0.12, z);
          post.castShadow = this.quality !== "low";
          group.add(post);
        }
      }
    }
    this.scene.add(group);
  }

  private buildProps(): void {
    const group = new THREE.Group();
    const px = 3.1;
    const pz = 21.8;
    const gy = terrainHeight(px, pz);

    const bucketMat = new THREE.MeshStandardMaterial({ color: 0x3f6d5a, roughness: 0.8, flatShading: true });
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.26, 10), bucketMat);
    bucket.position.set(px, gy + 0.13, pz);
    bucket.castShadow = this.quality !== "low";
    group.add(bucket);

    const boxMat = new THREE.MeshStandardMaterial({ color: 0x4a6d8c, roughness: 0.8, flatShading: true });
    const tackle = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.26), boxMat);
    tackle.position.set(px - 0.85, gy + 0.12, pz + 0.55);
    tackle.rotation.y = 0.5;
    tackle.castShadow = this.quality !== "low";
    group.add(tackle);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.26), boxMat.clone());
    lid.position.set(px - 0.85, gy + 0.26, pz + 0.55);
    lid.rotation.y = 0.5;
    lid.rotation.z = -0.15;
    group.add(lid);

    const seatMat = new THREE.MeshStandardMaterial({ color: 0x8c3b2e, roughness: 0.9, flatShading: true });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.8 });
    const stool = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.38), seatMat);
    seat.position.y = 0.45;
    stool.add(seat);
    for (const [sx, sz] of [
      [-0.15, -0.15],
      [0.15, -0.15],
      [-0.15, 0.15],
      [0.15, 0.15],
    ]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.45, 6), legMat);
      leg.position.set(sx, 0.225, sz);
      stool.add(leg);
    }
    stool.position.set(px + 1.1, gy, pz + 0.2);
    stool.rotation.y = -0.4;
    group.add(stool);

    this.scene.add(group);
  }

  private buildRod(): { group: THREE.Group; joint1: THREE.Group; joint2: THREE.Group; tip: THREE.Object3D } {
    const group = new THREE.Group();
    group.position.set(0.34, -0.46, -0.32);
    group.rotation.set(0.06, -0.12, 0.04);

    const corkMat = new THREE.MeshStandardMaterial({ color: 0x9a7b50, roughness: 0.9 });
    const blankMat = new THREE.MeshStandardMaterial({ color: 0x3d3a35, roughness: 0.5, metalness: 0.3 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x596066, roughness: 0.35, metalness: 0.8 });

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.023, 0.4, 8), corkMat);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, 0, 0.2);
    group.add(handle);

    const reelBody = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.042, 10), metalMat);
    reelBody.rotation.z = Math.PI / 2;
    reelBody.position.set(0, -0.052, 0.03);
    group.add(reelBody);
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.026, 10), metalMat);
    spool.rotation.z = Math.PI / 2;
    spool.position.set(0.012, -0.052, 0.03);
    group.add(spool);
    const crank = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.04, 6), metalMat as THREE.Material);
    crank.rotation.z = Math.PI / 2;
    crank.position.set(-0.042, -0.052, 0.03);
    group.add(crank);

    const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.012, 0.56, 8), blankMat);
    seg1.rotation.x = Math.PI / 2;
    seg1.position.set(0, 0.015, -0.28);
    group.add(seg1);

    const joint1 = new THREE.Group();
    joint1.position.set(0, 0.015, -0.56);
    group.add(joint1);
    const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.0085, 0.5, 8), blankMat);
    seg2.rotation.x = Math.PI / 2;
    seg2.position.set(0, 0, -0.25);
    joint1.add(seg2);

    const joint2 = new THREE.Group();
    joint2.position.set(0, 0, -0.5);
    joint1.add(joint2);
    const seg3 = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.006, 0.46, 8), blankMat);
    seg3.rotation.x = Math.PI / 2;
    seg3.position.set(0, 0, -0.23);
    joint2.add(seg3);

    for (const [j, dy] of [
      [joint1, 0.02],
      [joint2, 0.014],
    ] as Array<[THREE.Group, number]>) {
      const guide = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0022, 6, 12), metalMat);
      guide.position.set(0, dy, 0.05);
      j.add(guide);
    }

    const tip = new THREE.Object3D();
    tip.position.set(0, 0, -0.47);
    joint2.add(tip);

    group.traverse((o) => {
      o.frustumCulled = false;
    });
    return { group, joint1, joint2, tip };
  }

  private buildFloat(): THREE.Group {
    const group = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.6 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xe0602c, roughness: 0.55 });
    const red = new THREE.MeshStandardMaterial({ color: 0xe23b2c, roughness: 0.55 });
    const yellow = new THREE.MeshStandardMaterial({ color: 0xf0d34a, roughness: 0.55 });

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.004, 0.1, 6), white);
    stem.position.y = -0.05;
    group.add(stem);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.11, 8), orange);
    body.position.y = 0.055;
    group.add(body);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.02, 8), yellow);
    band.position.y = 0.115;
    group.add(band);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.16, 6), red);
    antenna.position.y = 0.21;
    group.add(antenna);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), red);
    top.position.y = 0.29;
    group.add(top);
    group.traverse((o) => {
      o.frustumCulled = false;
    });
    return group;
  }

  private buildAimMarker(): { group: THREE.Group; material: THREE.MeshBasicMaterial } {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: 0x6fd06b,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 36), mat);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), mat);
    dot.rotation.x = -Math.PI / 2;
    dot.position.y = 0.001;
    group.add(dot);
    for (let k = 0; k < 4; k++) {
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.3), mat);
      tick.rotation.x = -Math.PI / 2;
      tick.rotation.z = (k * Math.PI) / 2;
      const a = (k * Math.PI) / 2 + Math.PI / 2;
      tick.position.set(Math.cos(a) * 0.86, 0.001, Math.sin(a) * 0.86);
      group.add(tick);
    }
    group.renderOrder = 4;
    return { group, material: mat };
  }

  private makeParticleSystem(count: number, color: number, size: number): SplashSystem {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(Math.max(1, count) * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    points.visible = false;
    points.frustumCulled = false;
    this.scene.add(points);
    return {
      points,
      velocities: new Float32Array(Math.max(1, count) * 3),
      life: 0,
      maxLife: 0.75,
      active: false,
    };
  }

  private spawnSplash(x: number, z: number, power: number): void {
    let sys = this.splashes.find((s) => !s.active);
    if (!sys) sys = this.splashes[0];
    const count = sys.velocities.length / 3;
    const posAttr = sys.points.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      posAttr.setXYZ(i, x + (Math.random() - 0.5) * 0.15, 0.02, z + (Math.random() - 0.5) * 0.15);
      const a = Math.random() * Math.PI * 2;
      const speed = (0.6 + Math.random() * 1.6) * (0.5 + power);
      sys.velocities[i * 3] = Math.cos(a) * speed * 0.55;
      sys.velocities[i * 3 + 1] = (1.4 + Math.random() * 2.6) * (0.4 + power * 0.8);
      sys.velocities[i * 3 + 2] = Math.sin(a) * speed * 0.55;
    }
    posAttr.needsUpdate = true;
    sys.life = sys.maxLife;
    sys.active = true;
    sys.points.visible = true;
    (sys.points.material as THREE.PointsMaterial).opacity = 0.95;
  }

  private spawnBubbles(x: number, z: number): void {
    const sys = this.bubbleSystem;
    const count = sys.velocities.length / 3;
    const posAttr = sys.points.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      posAttr.setXYZ(i, x + (Math.random() - 0.5) * 0.5, -0.15, z + (Math.random() - 0.5) * 0.5);
      sys.velocities[i * 3] = (Math.random() - 0.5) * 0.1;
      sys.velocities[i * 3 + 1] = 0.2 + Math.random() * 0.3;
      sys.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
    }
    posAttr.needsUpdate = true;
    sys.life = 1.6;
    sys.maxLife = 1.6;
    sys.active = true;
    sys.points.visible = true;
    (sys.points.material as THREE.PointsMaterial).opacity = 0.8;
  }

  private spawnRipple(x: number, z: number, power: number): void {
    let r = this.ripples.find((rp) => rp.life <= 0);
    if (!r) r = this.ripples[0];
    r.life = 1.6;
    r.maxLife = 1.6;
    r.maxScale = 1.5 + power * 3.5;
    r.mesh.position.set(x, 0.025, z);
    r.mesh.scale.setScalar(0.2);
    r.mesh.visible = true;
    (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55;
  }

  consumeFx(events: FxEvent[]): void {
    for (const e of events) {
      if (e.kind === "splash" || e.kind === "bigSplash") {
        this.spawnSplash(e.x, e.z, e.power);
        this.spawnRipple(e.x, e.z, e.power);
        if (e.kind === "bigSplash") {
          this.spawnRipple(e.x, e.z, e.power * 0.6);
        }
      } else if (e.kind === "ripple") {
        this.spawnRipple(e.x, e.z, e.power);
      } else if (e.kind === "bubbles") {
        this.spawnBubbles(e.x, e.z);
      }
    }
  }

  private paletteFor(hour: number, weather: WeatherId): Palette {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= hour) i++;
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const t = THREE.MathUtils.clamp((hour - a.h) / (b.h - a.h), 0, 1);
    const p: Palette = {
      skyTop: lerpRGB(a.top, b.top, t),
      skyHorizon: lerpRGB(a.horizon, b.horizon, t),
      sunColor: lerpRGB(a.sun, b.sun, t),
      sunIntensity: lerp(a.sunI, b.sunI, t),
      hemiIntensity: lerp(a.hemiI, b.hemiI, t),
      hemiSky: lerpRGB(a.top, b.top, t),
      hemiGround: lerpRGB(a.hemiGround, b.hemiGround, t),
      fog: lerpRGB(a.fog, b.fog, t),
      fogDensity: lerp(a.fogD, b.fogD, t),
      waterShallow: lerpRGB(a.shallow, b.shallow, t),
      waterDeep: lerpRGB(a.deep, b.deep, t),
      skyReflection: lerpRGB(a.refl, b.refl, t),
    };
    if (weather === "cloudy") {
      p.sunIntensity *= 0.5;
      p.hemiIntensity *= 0.85;
      p.skyTop = desaturate(p.skyTop, 0.35);
      p.skyHorizon = desaturate(p.skyHorizon, 0.3);
      p.fog = desaturate(p.fog, 0.25);
      p.fogDensity *= 1.35;
      p.waterShallow = desaturate(p.waterShallow, 0.2);
      p.skyReflection = desaturate(p.skyReflection, 0.3);
    } else if (weather === "rain") {
      p.sunIntensity *= 0.3;
      p.hemiIntensity *= 0.7;
      p.skyTop = desaturate(p.skyTop, 0.55);
      p.skyHorizon = desaturate(p.skyHorizon, 0.5);
      p.fog = desaturate(p.fog, 0.45);
      p.fogDensity *= 1.7;
      p.waterShallow = desaturate(p.waterShallow, 0.35).map((v) => v * 0.8) as RGB;
      p.waterDeep = desaturate(p.waterDeep, 0.3).map((v) => v * 0.8) as RGB;
      p.skyReflection = desaturate(p.skyReflection, 0.45);
    }
    return p;
  }

  setQuality(q: QualityId): void {
    this.quality = q;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const pr = q === "low" ? 0.75 : q === "medium" ? Math.min(dpr, 1.5) : Math.min(dpr, 2);
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.enabled = q !== "low";
    this.sun.castShadow = q !== "low";
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
    const size = q === "high" ? 2048 : 1024;
    this.sun.shadow.mapSize.set(size, size);
    if (this.rain) {
      const count = this.rainSpeeds.length;
      this.rain.visible = q !== "low" && this.rain.visible;
      void count;
    }
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private updateRod(dt: number, snapshot: SimSnapshot): void {
    this.castAnim = Math.max(0, this.castAnim - dt * 2.6);
    if (snapshot.phase === "casting" && this.lastPhase !== "casting") {
      this.castAnim = 1;
    }
    const t = this.time;
    const bob = Math.sin(t * 1.05) * 0.008;
    const bobY = Math.sin(t * 0.85 + 1) * 0.004;
    let rotX = 0.06 + bob;
    let posZ = -0.32;
    if (snapshot.phase === "charging") {
      rotX += snapshot.power * 0.5;
      posZ += snapshot.power * 0.1;
    }
    if (this.castAnim > 0) {
      const p = 1 - this.castAnim;
      const swing = Math.sin(p * Math.PI) * -0.85 * (0.4 + this.prevPower * 0.6);
      rotX += swing;
    }
    const fight = snapshot.fight;
    let bend = 0;
    if (fight) {
      this.lastTension = fight.tension;
      bend = THREE.MathUtils.clamp(fight.tension, 0, 1.25);
    } else {
      this.lastTension *= 1 - dt * 3;
      bend = this.lastTension;
    }
    this.rodJoint1.rotation.x = -bend * 0.32 + Math.sin(t * 9) * bend * 0.012;
    this.rodJoint2.rotation.x = -bend * 0.5 + Math.sin(t * 12) * bend * 0.02;
    this.rodGroup.rotation.x = rotX;
    this.rodGroup.position.z = posZ;
    this.rodGroup.position.y = -0.46 + bobY;
    if (fight && fight.reeling) {
      this.rodGroup.position.x = 0.34 + Math.sin(t * 22) * 0.006;
    } else {
      this.rodGroup.position.x = 0.34;
    }
  }

  private updateLine(snapshot: SimSnapshot): void {
    const tipPos = new THREE.Vector3();
    this.tipAnchor.getWorldPosition(tipPos);
    const rig = snapshot.rig;
    let end: THREE.Vector3;
    let sag: number;
    if (!rig.visible) {
      end = tipPos.clone().add(new THREE.Vector3(0.05, -0.7, -0.15));
      sag = 0.25;
    } else if (snapshot.phase === "casting") {
      end = new THREE.Vector3(rig.x, Math.max(rig.y, 0.02), rig.z);
      sag = 0.12;
    } else if (snapshot.phase === "fighting" && snapshot.fight) {
      const f = snapshot.fight;
      end = new THREE.Vector3(f.fishX, f.fishY + 0.05, f.fishZ);
      sag = 0.05 + Math.max(0, (1 - f.tension)) * 0.22;
    } else {
      end = new THREE.Vector3(rig.x, Math.max(rig.y, 0.02) + snapshot.floatState.y, rig.z);
      sag = 0.3 + Math.min(1.2, tipPos.distanceTo(end) * 0.012);
    }
    const mid = tipPos.clone().lerp(end, 0.5);
    mid.y -= sag;
    const posAttr = this.lineMesh.geometry.attributes.position as THREE.BufferAttribute;
    const n = 32;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = (1 - t) * (1 - t) * tipPos.x + 2 * (1 - t) * t * mid.x + t * t * end.x;
      const y = (1 - t) * (1 - t) * tipPos.y + 2 * (1 - t) * t * mid.y + t * t * end.y;
      const z = (1 - t) * (1 - t) * tipPos.z + 2 * (1 - t) * t * mid.z + t * t * end.z;
      this.linePositions[i * 3] = x;
      this.linePositions[i * 3 + 1] = y;
      this.linePositions[i * 3 + 2] = z;
    }
    posAttr.needsUpdate = true;
  }

  private updateFloat(snapshot: SimSnapshot): void {
    const rig = snapshot.rig;
    const fs = snapshot.floatState;
    const visible = rig.visible && !fs.hidden;
    this.floatGroup.visible = visible;
    if (!visible) return;
    this.floatGroup.position.set(rig.x, rig.y + fs.y, rig.z);
    const dip = Math.max(0, -fs.y);
    this.floatGroup.rotation.x = -dip * 1.4 + Math.sin(this.time * 2) * 0.03;
    this.floatGroup.rotation.z = Math.sin(this.time * 1.6) * 0.05 - dip * 0.5;
    if (snapshot.phase === "retrieving") {
      this.floatGroup.rotation.z = 0.6;
    }
  }

  private updateAimMarker(snapshot: SimSnapshot): void {
    const aim = snapshot.aim;
    const show = !!aim && (snapshot.phase === "ready" || snapshot.phase === "charging");
    this.aimMarker.visible = show;
    if (!show || !aim) return;
    this.aimMarker.position.set(aim.x, 0.04, aim.z);
    if (aim.valid) {
      this.aimRingMat.color.setHex(0x6fd06b);
      this.aimRingMat.opacity = snapshot.phase === "charging" ? 0.65 + snapshot.power * 0.3 : 0.3;
    } else {
      this.aimRingMat.color.setHex(0xe05545);
      this.aimRingMat.opacity = 0.8;
    }
    const pulse = snapshot.phase === "charging" ? 1 + snapshot.power * 0.35 : 1;
    this.aimMarker.scale.setScalar(pulse);
  }

  private updateFightFish(snapshot: SimSnapshot): void {
    const fight = snapshot.fight;
    if (!fight) {
      if (this.fightFish) this.fightFish.visible = false;
      return;
    }
    const key = `${fight.speciesId}_${fight.weight.toFixed(2)}`;
    if (!this.fightFish || this.fightFishKey !== key) {
      if (this.fightFish) {
        this.scene.remove(this.fightFish);
        disposeObject(this.fightFish);
      }
      const sp = SPECIES_MAP[fight.speciesId];
      this.fightFish = buildFish(sp, fight.weight);
      this.fightFishKey = key;
      this.scene.add(this.fightFish);
    }
    this.fightFish.visible = true;
    this.fightFish.position.set(fight.fishX, fight.fishY, fight.fishZ);
    this.fightFish.rotation.y = fight.heading;
    this.fightFish.rotation.z = Math.sin(this.time * 3.2) * 0.12;
  }

  private updateParticles(dt: number): void {
    for (const r of this.ripples) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const p = 1 - r.life / r.maxLife;
      r.mesh.scale.setScalar(0.2 + p * r.maxScale);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - p);
      if (r.life <= 0) r.mesh.visible = false;
    }
    for (const s of [...this.splashes, this.bubbleSystem]) {
      if (!s.active) continue;
      s.life -= dt;
      const posAttr = s.points.geometry.attributes.position as THREE.BufferAttribute;
      const count = s.velocities.length / 3;
      for (let i = 0; i < count; i++) {
        s.velocities[i * 3 + 1] -= 9.8 * dt * (s === this.bubbleSystem ? -0.03 : 1);
        posAttr.setXYZ(
          i,
          posAttr.getX(i) + s.velocities[i * 3] * dt,
          posAttr.getY(i) + s.velocities[i * 3 + 1] * dt,
          posAttr.getZ(i) + s.velocities[i * 3 + 2] * dt
        );
      }
      posAttr.needsUpdate = true;
      const mat = s.points.material as THREE.PointsMaterial;
      mat.opacity = Math.max(0, 0.85 * (s.life / s.maxLife));
      if (s.life <= 0) {
        s.active = false;
        s.points.visible = false;
      }
    }
  }

  private updateRain(dt: number, weather: WeatherId): void {
    const show = weather === "rain" && this.quality !== "low" && this.rainSpeeds.length > 100;
    this.rain.visible = show;
    if (!show) return;
    const posAttr = this.rain.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.rainSpeeds.length; i++) {
      let y = posAttr.getY(i) - this.rainSpeeds[i] * dt;
      let x = posAttr.getX(i) + dt * 1.4;
      if (y < -0.5) {
        y = 22 + Math.random() * 6;
        x = (Math.random() - 0.5) * 70;
      }
      if (x > 35) x = -35;
      posAttr.setY(i, y);
      posAttr.setX(i, x);
    }
    posAttr.needsUpdate = true;
  }

  update(snapshot: SimSnapshot, dt: number, yaw: number, pitch: number, fx: FxEvent[]): void {
    this.time += dt;
    this.consumeFx(fx);
    const palette = this.paletteFor(snapshot.timeHour, snapshot.weather);

    // camera
    const ground = terrainHeight(PLAYER_POS.x, PLAYER_POS.z);
    const idleBob = Math.sin(this.time * 1.05) * 0.006;
    this.camera.position.set(PLAYER_POS.x, ground + 1.65 + idleBob, PLAYER_POS.z);
    this.camera.rotation.y = yaw;
    this.camera.rotation.x = pitch;

    // lights
    const dayPhase = (snapshot.timeHour - 6) / 12;
    const isDay = dayPhase >= 0 && dayPhase <= 1;
    const azim = THREE.MathUtils.lerp(-1.15, 1.15, THREE.MathUtils.clamp(dayPhase, 0, 1));
    const elevRaw = Math.sin(THREE.MathUtils.clamp(dayPhase, 0, 1) * Math.PI);
    let sunDir: THREE.Vector3;
    let sunColor = new THREE.Color(...palette.sunColor);
    if (isDay && elevRaw > 0.02) {
      const elev = Math.max(0.08, elevRaw * 1.0);
      sunDir = new THREE.Vector3(Math.sin(azim), elev, -Math.cos(azim)).normalize();
    } else {
      sunDir = new THREE.Vector3(Math.sin(-azim), 0.6, -Math.cos(azim) * 0.6).normalize();
      sunColor = new THREE.Color(0.5, 0.6, 0.85).multiplyScalar(0.8);
    }
    this.sun.position.copy(sunDir.clone().multiplyScalar(120));
    this.sun.position.add(this.sun.target.position);
    this.sun.color.copy(sunColor);
    this.sun.intensity = palette.sunIntensity;
    this.hemi.intensity = palette.hemiIntensity;
    this.hemi.color.setRGB(...palette.hemiSky);
    this.hemi.groundColor.setRGB(...palette.hemiGround);
    this.ambient.intensity = 0.08 + palette.sunIntensity * 0.03;

    const fogColor = new THREE.Color(...palette.fog);
    (this.scene.fog as THREE.FogExp2).color.copy(fogColor);
    (this.scene.fog as THREE.FogExp2).density = palette.fogDensity;

    // sky
    (this.skyMat.uniforms.uTop.value as THREE.Color).setRGB(...palette.skyTop);
    (this.skyMat.uniforms.uHorizon.value as THREE.Color).setRGB(...palette.skyHorizon);
    (this.skyMat.uniforms.uSunDir.value as THREE.Vector3).copy(sunDir);
    (this.skyMat.uniforms.uSunColor.value as THREE.Color).copy(sunColor).multiplyScalar(1.2);

    // water
    (this.waterMat.uniforms.uTime.value as number) = this.time;
    (this.waterMat.uniforms.uSunDir.value as THREE.Vector3).copy(sunDir);
    (this.waterMat.uniforms.uSunColor.value as THREE.Color).copy(sunColor);
    (this.waterMat.uniforms.uShallow.value as THREE.Color).setRGB(...palette.waterShallow);
    (this.waterMat.uniforms.uDeep.value as THREE.Color).setRGB(...palette.waterDeep);
    (this.waterMat.uniforms.uSkyReflection.value as THREE.Color).setRGB(...palette.skyReflection);
    (this.waterMat.uniforms.uFogColor.value as THREE.Color).copy(fogColor);
    (this.waterMat.uniforms.uFogDensity.value as number) = palette.fogDensity;

    this.prevPower = snapshot.power;
    this.updateRod(dt, snapshot);
    this.updateLine(snapshot);
    this.updateFloat(snapshot);
    this.updateAimMarker(snapshot);
    this.updateFightFish(snapshot);
    this.updateParticles(dt);
    this.updateRain(dt, snapshot.weather);

    this.lastPhase = snapshot.phase;
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    if (this.fightFish) {
      this.scene.remove(this.fightFish);
      disposeObject(this.fightFish);
      this.fightFish = null;
    }
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Line) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          const anyMat = m as THREE.MeshStandardMaterial;
          if (anyMat.map) anyMat.map.dispose();
          m.dispose();
        }
      }
    });
    this.renderer.dispose();
  }
}
