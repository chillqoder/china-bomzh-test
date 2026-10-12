'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface RodProps {
  tension: number;
  isCasting: boolean;
  castProgress: number;
  floatPosition: [number, number, number];
  isFighting: boolean;
}

export function FishingRod({ tension, isCasting, castProgress, floatPosition, isFighting }: RodProps) {
  const groupRef = useRef<THREE.Group>(null);
  const tipRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  // Rod bend based on tension
  useFrame(() => {
    if (tipRef.current) {
      const bendAngle = tension * 0.6 + (isCasting ? castProgress * 0.3 : 0);
      tipRef.current.rotation.x = -bendAngle;
      tipRef.current.rotation.z = tension * 0.15;
    }
  });

  // Line geometry
  const lineObject = useMemo(() => {
    const points = [];
    for (let i = 0; i <= 20; i++) {
      points.push(new THREE.Vector3(0, 0, 0));
    }
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.8 });
    return new THREE.Line(geom, mat);
  }, []);

  useFrame(() => {
    if (!tipRef.current) return;

    const tipPos = new THREE.Vector3();
    tipRef.current.getWorldPosition(tipPos);

    const floatPos = new THREE.Vector3(...floatPosition);
    const points: THREE.Vector3[] = [];

    // Create a catenary-like curve from rod tip to float
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const x = tipPos.x + (floatPos.x - tipPos.x) * t;
      const y = tipPos.y + (floatPos.y - tipPos.y) * t - Math.sin(t * Math.PI) * (0.5 + tension * 1.5);
      const z = tipPos.z + (floatPos.z - tipPos.z) * t;
      points.push(new THREE.Vector3(x, y, z));
    }

    lineObject.geometry.setFromPoints(points);
    lineObject.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <group ref={groupRef} position={[0.4, -0.3, -0.8]}>
      {/* Rod handle */}
      <mesh position={[0, 0, 0]} rotation={[0.3, 0, -0.2]}>
        <cylinderGeometry args={[0.025, 0.03, 0.4, 8]} />
        <meshStandardMaterial color="#3a2a1a" />
      </mesh>

      {/* Rod grip (cork) */}
      <mesh position={[0, 0.15, 0.05]} rotation={[0.3, 0, -0.2]}>
        <cylinderGeometry args={[0.035, 0.035, 0.25, 8]} />
        <meshStandardMaterial color="#c4a060" />
      </mesh>

      {/* Reel */}
      <group position={[0.05, 0.08, 0.02]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.06, 0.04, 12]} />
          <meshStandardMaterial color="#4a4a4a" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Reel handle */}
        <mesh position={[0, 0.04, 0.06]} rotation={[0.5, 0, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.08, 8]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
      </group>

      {/* Rod blank (main body) */}
      <group position={[0, 0.35, 0.1]} rotation={[0.3, 0, -0.2]}>
        <mesh>
          <cylinderGeometry args={[0.012, 0.022, 1.2, 8]} />
          <meshStandardMaterial color="#2a3a4a" />
        </mesh>

        {/* Line guides */}
        {[0.2, 0.5, 0.8, 1.0].map((y, i) => (
          <group key={i} position={[0, y, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.015, 0.004, 6, 12]} />
              <meshStandardMaterial color="#6a6a6a" metalness={0.5} />
            </mesh>
          </group>
        ))}

        {/* Rod tip (flexible) */}
        <group ref={tipRef} position={[0, 0.6, 0]}>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.004, 0.012, 0.6, 8]} />
            <meshStandardMaterial color="#1a2a3a" />
          </mesh>
          {/* Tip guide */}
          <mesh position={[0, 0.6, 0]}>
            <torusGeometry args={[0.012, 0.003, 6, 12]} />
            <meshStandardMaterial color="#6a6a6a" />
          </mesh>
        </group>
      </group>

      {/* Fishing line */}
      <primitive object={lineObject} />
    </group>
  );
}

interface FloatProps {
  position: [number, number, number];
  depth: number;
  bobbing: number;
  isVisible: boolean;
  isBite: boolean;
}

export function FishingFloat({ position, depth, bobbing, isVisible, isBite }: FloatProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bobRef = useRef(0);

  useFrame((state) => {
    if (!groupRef.current) return;

    bobRef.current = state.clock.elapsedTime;

    // Floating animation
    const bobY = Math.sin(bobRef.current * 2) * 0.03 + bobbing * 0.1;
    const sinkY = depth * 0.3;

    groupRef.current.position.set(position[0], position[1] + bobY - sinkY, position[2]);
    groupRef.current.rotation.x = Math.sin(bobRef.current * 1.5) * 0.1 + depth * 0.3;
    groupRef.current.rotation.z = Math.cos(bobRef.current * 1.2) * 0.05;
  });

  if (!isVisible) return null;

  return (
    <group ref={groupRef} position={position}>
      {/* Float body (red/white) */}
      <mesh position={[0, 0.15, 0]}>
        <capsuleGeometry args={[0.04, 0.12, 4, 8]} />
        <meshStandardMaterial color={isBite ? '#ff2020' : '#cc3030'} />
      </mesh>

      {/* White stripe */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.042, 0.042, 0.04, 8]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Float tip (antenna) */}
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.008, 0.012, 0.15, 8]} />
        <meshStandardMaterial color="#202020" />
      </mesh>

      {/* Float bottom (keel) */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.02, 0.005, 0.08, 8]} />
        <meshStandardMaterial color="#202020" />
      </mesh>
    </group>
  );
}

interface CastTrajectoryProps {
  progress: number;
  targetPosition: [number, number, number];
  isCasting: boolean;
}

export function CastTrajectory({ progress, targetPosition, isCasting }: CastTrajectoryProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current) return;
    if (isCasting && progress < 1) {
      // Parabolic trajectory
      const t = progress;
      const startX = 0.4;
      const startY = 1.5;
      const startZ = -0.8;
      const endX = targetPosition[0];
      const endY = 0;
      const endZ = targetPosition[2];

      const x = startX + (endX - startX) * t;
      const y = startY + (endY - startY) * t + Math.sin(t * Math.PI) * 3;
      const z = startZ + (endZ - startZ) * t;

      meshRef.current.position.set(x, y, z);
      meshRef.current.visible = true;
    } else {
      meshRef.current.visible = false;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.05, 8, 8]} />
      <meshBasicMaterial color="#ffff00" />
    </mesh>
  );
}

interface SplashProps {
  position: [number, number, number];
  active: boolean;
}

export function Splash({ position, active }: SplashProps) {
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Mesh[]>([]);

  useFrame((state) => {
    if (!groupRef.current) return;
    particlesRef.current.forEach((particle, i) => {
      if (particle) {
        const t = (state.clock.elapsedTime * 2 + i * 0.1) % 1;
        particle.position.y = t * 2;
        particle.scale.setScalar(1 - t);
        (particle.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      }
    });
    groupRef.current.visible = active;
  });

  return (
    <group ref={groupRef} position={position}>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) particlesRef.current[i] = el;
          }}
          position={[
            Math.cos((i / 8) * Math.PI * 2) * 0.3,
            0,
            Math.sin((i / 8) * Math.PI * 2) * 0.3,
          ]}
        >
          <sphereGeometry args={[0.08, 6, 6]} />
          <meshBasicMaterial color="#80c0e0" transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}
