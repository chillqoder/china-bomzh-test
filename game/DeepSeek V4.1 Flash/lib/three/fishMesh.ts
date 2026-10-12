import * as THREE from "three";
import { weightToLength } from "@/lib/game/data";
import type { SpeciesDef } from "@/lib/game/types";

function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v));
}

function makeBodyTexture(sp: SpeciesDef): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const body = new THREE.Color(sp.colors.body);
  const belly = new THREE.Color(sp.colors.belly);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, `#${body.clone().multiplyScalar(0.62).getHexString()}`);
  grad.addColorStop(0.45, `#${body.getHexString()}`);
  grad.addColorStop(1, `#${belly.getHexString()}`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  if (sp.shape.stripes === "vertical") {
    const accent = new THREE.Color(sp.colors.accent ?? 0x222222);
    ctx.fillStyle = `#${accent.getHexString()}`;
    const bars = 7;
    for (let i = 0; i < bars; i++) {
      const x = (i + 0.5) * (w / bars) - 8;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x, 0, 16, h);
    }
    ctx.globalAlpha = 1;
  } else if (sp.shape.stripes === "spots") {
    const accent = new THREE.Color(sp.colors.accent ?? 0xdddddd);
    ctx.fillStyle = `#${accent.getHexString()}`;
    for (let i = 0; i < 46; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h * 0.6;
      const rx = 5 + Math.random() * 9;
      const ry = 3 + Math.random() * 5;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function finShape(
  len: number,
  spread: number,
  fork: number,
  jagged: boolean
): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  if (jagged) {
    const spikes = 6;
    for (let i = 1; i <= spikes; i++) {
      const t = i / spikes;
      const x = len * t;
      const y = spread * (1 - t * 0.55) + (i % 2 === 0 ? spread * 0.18 : -spread * 0.05);
      s.lineTo(x, y);
    }
    s.lineTo(len, 0);
    for (let i = 1; i <= spikes; i++) {
      const t = i / spikes;
      const x = len * t;
      const y = -spread * (1 - t * 0.55) - (i % 2 === 0 ? spread * 0.18 : -spread * 0.05);
      s.lineTo(x, y);
    }
  } else {
    s.quadraticCurveTo(len * 0.35, spread * 0.75, len, spread);
    const center = len * (1 - fork * 0.65);
    s.lineTo(center, 0);
    s.lineTo(len, -spread);
    s.quadraticCurveTo(len * 0.35, -spread * 0.75, 0, 0);
  }
  s.closePath();
  return s;
}

function finMesh(shape: THREE.Shape, color: number, opacity = 0.95): THREE.Mesh {
  const geo = new THREE.ShapeGeometry(shape, 6);
  const mat = new THREE.MeshStandardMaterial({
    color,
    side: THREE.DoubleSide,
    roughness: 0.7,
    metalness: 0.05,
    transparent: true,
    opacity,
    flatShading: true,
  });
  return new THREE.Mesh(geo, mat);
}

export function buildFish(sp: SpeciesDef, weightKg: number): THREE.Group {
  const group = new THREE.Group();
  const lengthCm = weightToLength(sp, weightKg);
  const L = lengthCm / 100;
  const sh = sp.shape;

  const geo = new THREE.SphereGeometry(1, 14, 10);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const count = pos.count;
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = clamp((z + 1) / 2, 0.001, 0.999);
    let r = Math.pow(Math.sin(Math.PI * t), sh.profilePow);
    if (t > 0.65) {
      const k = (t - 0.65) / 0.35;
      r *= 1 - sh.headSharp * k * k;
    }
    if (t < 0.3) {
      const k = 1 - t / 0.3;
      r *= 1 - sh.tailSharp * k * k * 0.7;
    }
    const origR = Math.hypot(x, y) || 1e-5;
    const nx = (x / origR) * r * sh.widthScale;
    const ny = (y / origR) * r * sh.heightScale;
    pos.setXYZ(i, nx, ny, z * sh.lengthScale);
  }
  geo.computeVertexNormals();

  const uvs = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const u = clamp((z / sh.lengthScale + 1) / 2, 0, 1);
    const ang = Math.atan2(y, x);
    const v = (ang + Math.PI) / (Math.PI * 2);
    uvs.setXY(i, u, v);
  }

  const bodyMat = new THREE.MeshStandardMaterial({
    map: makeBodyTexture(sp),
    roughness: 0.45,
    metalness: 0.25,
    flatShading: true,
  });
  const body = new THREE.Mesh(geo, bodyMat);
  group.add(body);

  const zSpan = sh.lengthScale * 2;
  const unit = L / zSpan;

  const caudalLen = 0.34 * zSpan * 0.55;
  const caudal = finMesh(
    finShape(caudalLen, 0.32 * sh.heightScale, sh.tailFork, false),
    sp.colors.fins
  );
  caudal.rotation.y = Math.PI / 2;
  caudal.position.set(0, 0, -sh.lengthScale + 0.03);
  group.add(caudal);

  const dorsalZ = -sh.lengthScale + sh.dorsalPos * zSpan;
  const dorsal = finMesh(
    finShape(0.42 * (sh.spinyDorsal ? 0.95 : 0.85), 0.3 * sh.dorsalSize, 0.05, !!sh.spinyDorsal),
    sp.colors.fins
  );
  dorsal.rotation.y = Math.PI / 2;
  dorsal.position.set(0, sh.heightScale * 0.72, dorsalZ);
  group.add(dorsal);

  const anal = finMesh(finShape(0.2, 0.18 * sh.dorsalSize, 0.15, false), sp.colors.fins, 0.9);
  anal.rotation.y = Math.PI / 2;
  anal.position.set(0, -sh.heightScale * 0.72, dorsalZ - 0.14 * zSpan);
  group.add(anal);

  for (const side of [-1, 1]) {
    const pect = finMesh(finShape(0.2, 0.14, 0.2, false), sp.colors.fins, 0.9);
    pect.rotation.set(0, side * Math.PI * 0.5, side * 0.45 + Math.PI * 0.05);
    pect.position.set(side * sh.widthScale * 0.68, -sh.heightScale * 0.18, sh.lengthScale * 0.35);
    group.add(pect);
  }

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.3 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(sp.shape.eyeSize, 6, 5), eyeMat);
    eye.position.set(side * sh.widthScale * 0.55, sh.heightScale * 0.32, sh.lengthScale * 0.78);
    group.add(eye);
  }

  if (sh.barbels) {
    const barbelMat = new THREE.MeshStandardMaterial({ color: 0x6b5426, roughness: 0.8 });
    for (const side of [-1, 1]) {
      const barbel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.004, 0.12, 4),
        barbelMat
      );
      barbel.position.set(side * 0.035, -0.03, sh.lengthScale * 0.98);
      barbel.rotation.x = 0.9;
      barbel.rotation.z = side * 0.25;
      group.add(barbel);
    }
  }

  group.scale.setScalar(unit);
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  group.userData.lengthCm = lengthCm;
  return group;
}

export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        const anyMat = m as THREE.MeshStandardMaterial;
        if (anyMat.map) anyMat.map.dispose();
        m.dispose();
      }
    }
  });
}
