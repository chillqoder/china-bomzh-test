/**
 * Stylised lake water: a displaced plane with a hand-written shader.
 * The shoreline in the shader uses exactly the same maths as the gameplay lake
 * model, so a cast is never "on water" where the picture shows sand.
 */

import * as THREE from 'three';
import { LAKE_BASE_RADIUS, LAKE_CENTER, PIT } from '@/game/lake';

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWind;
  varying vec3 vWorld;
  varying vec3 vViewDir;
  varying float vWave;

  void main() {
    vec3 p = position;
    float w = uWind;
    float a =
      sin(p.x * 0.34 + uTime * 1.15) * 0.055 +
      sin(p.y * 0.27 - uTime * 0.92) * 0.045 +
      sin((p.x + p.y) * 0.72 + uTime * 2.05) * (0.016 + 0.03 * w);
    p.z += a;
    vWave = a;
    vec4 world = modelMatrix * vec4(p.x, 0.0, p.y, 1.0);
    vWorld = world.xyz;
    vec4 mv = viewMatrix * world;
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uWind;
  uniform vec2 uCenter;
  uniform float uRadius;
  uniform vec2 uPitXZ;
  uniform float uPitR;
  uniform vec3 uSkyColor;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSand;
  uniform float uRain;

  varying vec3 vWorld;
  varying vec3 vViewDir;
  varying float vWave;

  float lakeRadius(float th) {
    return uRadius + 3.6 * sin(th * 3.0 + 0.4) + 2.2 * sin(th * 2.0 - 1.1) + 1.1 * sin(th * 5.0 + 2.0);
  }

  void main() {
    vec2 d = vWorld.xz - uCenter;
    float r = length(d);
    float th = atan(d.y, d.x);
    float R = lakeRadius(th);
    float rho = r / R;
    if (rho >= 1.0) discard;

    float depth = 5.6 * pow(max(0.0, 1.0 - rho * rho), 1.35);
    float pd = length(vWorld.xz - uPitXZ);
    if (pd < uPitR) {
      depth += 2.3 * pow(cos(pd / uPitR * 1.5708), 1.5);
    }

    // analytical wave normal
    float t = uTime;
    float gx = 0.34 * cos(vWorld.x * 0.34 + t * 1.15) * 0.055
             + 0.72 * cos((vWorld.x + vWorld.z) * 0.72 + t * 2.05) * (0.016 + 0.03 * uWind);
    float gz = -0.27 * sin(vWorld.z * 0.27 - t * 0.92) * 0.045
             + 0.72 * cos((vWorld.x + vWorld.z) * 0.72 + t * 2.05) * (0.016 + 0.03 * uWind);
    float rip = (0.010 + 0.03 * uWind);
    gx += sin(vWorld.x * 3.1 + t * 3.3) * rip * 0.6 + sin(vWorld.z * 5.3 - t * 2.1) * rip * 0.3;
    gz += cos(vWorld.z * 2.9 + t * 2.7) * rip * 0.6 + cos(vWorld.x * 4.7 + t * 1.7) * rip * 0.35;
    vec3 N = normalize(vec3(-gx * 3.0, 1.0, -gz * 3.0));

    vec3 V = normalize(vViewDir);
    float fres = pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 3.0);

    vec3 body = mix(uShallow, uDeep, smoothstep(0.2, 2.2, depth));
    body = mix(uSand, body, smoothstep(0.05, 0.55, depth));
    vec3 col = mix(body, uSkyColor, 0.12 + 0.5 * fres);

    // sun glitter
    vec3 H = normalize(uSunDir + V);
    float spec = pow(max(dot(N, H), 0.0), 420.0);
    col += uSunColor * spec * 1.1;
    // broad, broken-up glitter instead of a smooth vertical band
    float glitter = pow(max(dot(N, H), 0.0), 42.0);
    float mask = 0.45 + 0.55 * sin(vWorld.x * 2.7 + uTime * 1.9) * cos(vWorld.z * 2.3 - uTime * 1.4);
    col += uSunColor * glitter * 0.1 * max(mask, 0.0);

    // shoreline foam
    float foamBand = smoothstep(0.55, 0.0, depth);
    float lap = 0.5 + 0.5 * sin(r * 5.0 - t * (1.1 + uWind * 1.6));
    col = mix(col, vec3(0.92, 0.95, 0.93), foamBand * lap * 0.5);

    // drizzle dimples
    if (uRain > 0.001) {
      float rz = fract(sin(dot(floor(vWorld.xz * 6.0), vec2(12.9898, 78.233))) * 43758.5453);
      float pulse = step(0.985 - uRain * 0.05, fract(rz + t * 1.7));
      col += vec3(0.35, 0.42, 0.4) * pulse * uRain * 0.5;
    }

    float alpha = mix(0.55, 0.93, smoothstep(0.08, 1.9, depth));

    // distance fog
    float dist = length(cameraPosition - vWorld);
    float fogF = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));

    gl_FragColor = vec4(col, alpha);
  }
`;

export class Water {
  mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(radius = LAKE_BASE_RADIUS + 12, segments = 150) {
    const geo = new THREE.PlaneGeometry(radius * 2, radius * 2, segments, segments);
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uWind: { value: 0.25 },
        uCenter: { value: new THREE.Vector2(LAKE_CENTER.x, LAKE_CENTER.z) },
        uRadius: { value: LAKE_BASE_RADIUS },
        uPitXZ: { value: new THREE.Vector2(PIT.x, PIT.z) },
        uPitR: { value: PIT.radius },
        uSkyColor: { value: new THREE.Color(0x9fc4d8) },
        uSunColor: { value: new THREE.Color(0xffd9a0) },
        uSunDir: { value: new THREE.Vector3(0.4, 0.5, 0.6) },
        uFogColor: { value: new THREE.Color(0xbcd3dd) },
        uFogDensity: { value: 0.0085 },
        uDeep: { value: new THREE.Color(0x0f4444) },
        uShallow: { value: new THREE.Color(0x4f9c86) },
        uSand: { value: new THREE.Color(0xb9a273) },
        uRain: { value: 0 },
      },
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(LAKE_CENTER.x, 0, LAKE_CENTER.z);
    this.mesh.renderOrder = 3;
    this.mesh.frustumCulled = false;
  }

  setColors(colors: {
    sky: THREE.Color;
    sun: THREE.Color;
    sunDir: THREE.Vector3;
    fog: THREE.Color;
    fogDensity: number;
    rain: number;
  }) {
    const u = this.material.uniforms;
    u.uSkyColor.value.copy(colors.sky);
    u.uSunColor.value.copy(colors.sun);
    u.uSunDir.value.copy(colors.sunDir).normalize();
    u.uFogColor.value.copy(colors.fog);
    u.uFogDensity.value = colors.fogDensity;
    u.uRain.value = colors.rain;
  }

  update(time: number, wind: number) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uWind.value = wind;
  }

  /** Height of the animated surface at a point — keeps the float glued to the water. */
  surfaceY(x: number, z: number): number {
    const t = this.material.uniforms.uTime.value as number;
    const w = this.material.uniforms.uWind.value as number;
    return (
      Math.sin(x * 0.34 + t * 1.15) * 0.055 +
      Math.sin(z * 0.27 - t * 0.92) * 0.045 +
      Math.sin((x + z) * 0.72 + t * 2.05) * (0.016 + 0.03 * w)
    );
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
