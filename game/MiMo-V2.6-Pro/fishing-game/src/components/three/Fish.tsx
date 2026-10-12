'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SpeciesData } from '../../game/types';

interface FishModelProps {
  species: SpeciesData;
  weight: number;
  isRotating?: boolean;
  scale?: number;
}

export function FishModel({ species, weight, isRotating = false, scale = 1 }: FishModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current && isRotating) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
    if (tailRef.current) {
      tailRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 3) * 0.3;
    }
  });

  const weightRatio = weight / species.maxWeight;
  const bodyScale = 0.5 + weightRatio * 0.5;

  const bodyGeometry = useMemo(() => {
    switch (species.bodyType) {
      case 'deep':
        // Compact, deep body (crucian carp)
        return <sphereGeometry args={[0.4, 12, 8]} />;
      case 'slim':
        // Slim body (roach, perch)
        return <capsuleGeometry args={[0.2, 0.8, 8, 12]} />;
      case 'tall':
        // Tall, flattened body (bream)
        return <sphereGeometry args={[0.35, 12, 8]} />;
      case 'heavy':
        // Broad, heavy body (carp)
        return <sphereGeometry args={[0.5, 12, 8]} />;
      case 'elongated':
        // Elongated body (pike)
        return <capsuleGeometry args={[0.18, 1.2, 8, 12]} />;
      default:
        return <capsuleGeometry args={[0.25, 0.6, 8, 12]} />;
    }
  }, [species.bodyType]);

  return (
    <group ref={groupRef} scale={scale * bodyScale}>
      {/* Main body */}
      <mesh scale={[1, species.bodyType === 'tall' ? 1.3 : species.bodyType === 'heavy' ? 1.1 : 1, 1]} castShadow>
        {bodyGeometry}
        <meshStandardMaterial color={species.color} flatShading />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0, 0.6]} scale={[0.8, 0.7, 0.9]}>
        <sphereGeometry args={[0.3, 10, 8]} />
        <meshStandardMaterial color={species.color} flatShading />
      </mesh>

      {/* Eye */}
      <mesh position={[0.15, 0.1, 0.75]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
      <mesh position={[0.15, 0.12, 0.78]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Dorsal fin */}
      <group
        position={[0, species.dorsalType === 'rear' ? 0.35 : 0.4, species.dorsalType === 'rear' ? -0.3 : 0]}
        rotation={[species.dorsalType === 'spiky' ? -0.3 : -0.1, 0, 0]}
      >
        <mesh>
          {species.dorsalType === 'spiky' ? (
            <coneGeometry args={[0.2, 0.35, 6]} />
          ) : (
            <boxGeometry args={[0.05, 0.3, 0.5]} />
          )}
          <meshStandardMaterial color={species.color} flatShading transparent opacity={0.85} />
        </mesh>
      </group>

      {/* Tail fin */}
      <group ref={tailRef} position={[0, 0, -0.7]}>
        <mesh position={[0, 0, -0.2]} rotation={[0, 0, 0]}>
          <coneGeometry args={[0.25, 0.4, 8]} />
          <meshStandardMaterial color={species.color} flatShading transparent opacity={0.8} />
        </mesh>
        <mesh position={[0, 0.15, -0.25]} rotation={[0.5, 0, 0]}>
          <coneGeometry args={[0.15, 0.3, 6]} />
          <meshStandardMaterial color={species.color} flatShading transparent opacity={0.7} />
        </mesh>
      </group>

      {/* Pectoral fins */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.3, -0.1, 0.3]} rotation={[0, 0, side * 0.8]}>
          <boxGeometry args={[0.2, 0.03, 0.15]} />
          <meshStandardMaterial color={species.color} flatShading transparent opacity={0.75} />
        </mesh>
      ))}

      {/* Pelvic fins */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.2, -0.25, -0.1]} rotation={[0, 0, side * 0.6]}>
          <boxGeometry args={[0.15, 0.03, 0.12]} />
          <meshStandardMaterial color={species.color} flatShading transparent opacity={0.75} />
        </mesh>
      ))}

      {/* Anal fin */}
      <mesh position={[0, -0.35, -0.3]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.03, 0.15, 0.25]} />
        <meshStandardMaterial color={species.color} flatShading transparent opacity={0.75} />
      </mesh>

      {/* Stripes (for perch) */}
      {species.hasStripes && (
        <>
          {[0.2, -0.1, -0.4].map((z, i) => (
            <mesh key={i} position={[0, 0, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.28, 0.28, 0.04, 12]} />
              <meshStandardMaterial color="#2a3a2a" flatShading />
            </mesh>
          ))}
        </>
      )}

      {/* Barbels (for carp) */}
      {species.hasBarbels && (
        <>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.12, -0.15, 0.7]} rotation={[0.5, 0, side * 0.3]}>
              <cylinderGeometry args={[0.01, 0.005, 0.15, 4]} />
              <meshStandardMaterial color={species.color} />
            </mesh>
          ))}
        </>
      )}

      {/* Shimmer overlay */}
      <mesh scale={[1.01, 1.01, 1.01]}>
        {bodyGeometry}
        <meshStandardMaterial
          color={species.color}
          flatShading
          transparent
          opacity={0.15}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

export function UnderwaterFish({ species, weight }: { species: SpeciesData; weight: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.elapsedTime;
      groupRef.current.position.y = Math.sin(t * 0.5) * 0.2;
      groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.8, -15]} rotation={[0, Math.PI * 0.15, 0]}>
      <FishModel species={species} weight={weight} scale={0.4} />
    </group>
  );
}
