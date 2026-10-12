'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Water() {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color('#1a6b7a') },
      uColor2: { value: new THREE.Color('#2a9aaa') },
    }),
    []
  );

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  const vertexShader = `
    uniform float uTime;
    varying vec2 vUv;
    varying float vElevation;
    
    void main() {
      vUv = uv;
      vec3 pos = position;
      
      // Multiple wave layers for realistic ripples
      float wave1 = sin(pos.x * 0.3 + uTime * 0.8) * 0.15;
      float wave2 = sin(pos.z * 0.4 + uTime * 0.6) * 0.12;
      float wave3 = sin(pos.x * 0.15 + pos.z * 0.2 + uTime * 0.4) * 0.2;
      float wave4 = sin(pos.x * 0.8 + pos.z * 0.6 + uTime * 1.2) * 0.05;
      
      vElevation = wave1 + wave2 + wave3 + wave4;
      pos.y += vElevation;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform float uTime;
    varying vec2 vUv;
    varying float vElevation;
    
    void main() {
      float mixValue = vElevation * 0.5 + 0.5;
      vec3 color = mix(uColor1, uColor2, mixValue);
      
      // Specular highlights
      float highlight = sin(vUv.x * 40.0 + uTime * 2.0) * sin(vUv.y * 40.0 + uTime * 1.5);
      highlight = smoothstep(0.3, 0.8, highlight) * 0.15;
      color += vec3(highlight);
      
      // Distance fog
      float dist = length(vUv - 0.5) * 2.0;
      color = mix(color, vec3(0.55, 0.75, 0.8), smoothstep(0.6, 1.0, dist) * 0.4);
      
      gl_FragColor = vec4(color, 0.92);
    }
  `;

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -30]}>
      <planeGeometry args={[120, 100, 128, 128]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
}

export function WaterRipples({ position }: { position: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);
  const ringsRef = useRef<THREE.Mesh[]>([]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    ringsRef.current.forEach((ring, i) => {
      if (ring) {
        const scale = 0.5 + ((time * 0.5 + i * 0.3) % 2) * 3;
        ring.scale.set(scale, scale, scale);
        const material = ring.material as THREE.MeshBasicMaterial;
        material.opacity = Math.max(0, 0.4 - ((time * 0.5 + i * 0.3) % 2) * 0.2);
      }
    });
  });

  return (
    <group ref={groupRef} position={position}>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) ringsRef.current[i] = el;
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.02, 0]}
        >
          <ringGeometry args={[0.1, 0.15, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
        </mesh>
      ))}
    </group>
  );
}
