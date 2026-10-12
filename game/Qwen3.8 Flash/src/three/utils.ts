import * as THREE from 'three';

/**
 * Merge a list of geometries (indexed or not) into a single non-indexed geometry.
 * Source geometries are disposed; the merged result owns the remaining buffers.
 */
export function mergeGeos(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const parts = geos.map((g) => {
    const p = g.index ? g.toNonIndexed() : g;
    if (p !== g) g.dispose();
    return p;
  });
  let total = 0;
  for (const p of parts) total += p.getAttribute('position').count;
  const position = new Float32Array(total * 3);
  const normal = new Float32Array(total * 3);
  const color = new Float32Array(total * 3);
  let hasColor = false;
  let offset = 0;
  for (const p of parts) {
    const pa = p.getAttribute('position');
    const na = p.getAttribute('normal');
    const ca = p.getAttribute('color') as THREE.BufferAttribute | undefined;
    if (ca) hasColor = true;
    for (let i = 0; i < pa.count; i++) {
      const k = (offset + i) * 3;
      position[k] = pa.getX(i);
      position[k + 1] = pa.getY(i);
      position[k + 2] = pa.getZ(i);
      if (na) {
        normal[k] = na.getX(i);
        normal[k + 1] = na.getY(i);
        normal[k + 2] = na.getZ(i);
      }
      if (ca) {
        color[k] = ca.getX(i);
        color[k + 1] = ca.getY(i);
        color[k + 2] = ca.getZ(i);
      }
    }
    offset += pa.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  if (hasColor) out.setAttribute('color', new THREE.BufferAttribute(color, 3));
  for (const p of parts) p.dispose();
  out.computeBoundingSphere();
  return out;
}

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));

/** Material with a simple vertex "wind sway" injected, works for Lambert/Standard. */
export function makeSwayMaterial(
  params: THREE.MeshLambertMaterialParameters,
  amplitude = 0.16,
): { material: THREE.MeshLambertMaterial; setTime: (t: number) => void } {
  const material = new THREE.MeshLambertMaterial(params);
  let shader: THREE.WebGLProgram | null = null;
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 };
    sh.uniforms.uSway = { value: amplitude };
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         uniform float uSway;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         {
           vec3 wi = vec3(0.0);
           #ifdef USE_INSTANCING
             wi = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
           #endif
           float phase = uTime * 1.6 + wi.x * 0.6 + wi.z * 0.45;
           float amount = pow(max(transformed.y, 0.0), 1.4) * uSway;
           transformed.x += sin(phase) * amount * 0.5 + sin(phase * 2.3) * amount * 0.18;
           transformed.z += cos(phase * 0.8) * amount * 0.42;
         }`,
      );
    shader = sh as unknown as THREE.WebGLProgram;
  };
  return {
    material,
    setTime: (t: number) => {
      const u = (shader as unknown as { uniforms?: Record<string, { value: number }> })?.uniforms;
      if (u?.uTime) u.uTime.value = t;
    },
  };
}

export function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) mat.dispose();
  });
}
