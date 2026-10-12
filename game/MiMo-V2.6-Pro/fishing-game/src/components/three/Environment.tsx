'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';

function createRockGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.DodecahedronGeometry(1, 0);
  const positions = geometry.attributes.position.array as Float32Array;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] += (Math.random() - 0.5) * 0.4;
    positions[i + 1] += (Math.random() - 0.5) * 0.3;
    positions[i + 2] += (Math.random() - 0.5) * 0.4;
  }
  geometry.computeVertexNormals();
  return geometry;
}

function BirchTree({ position, height = 8 }: { position: [number, number, number]; height?: number }) {
  return (
    <group position={position}>
      {/* Trunk */}
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.12, 0.18, height, 8]} />
        <meshStandardMaterial color="#e8e0d0" />
      </mesh>
      {/* Black marks on trunk */}
      {[1.2, 2.5, 3.8, 5.2].map((y, i) => (
        <mesh key={i} position={[0, y, 0]} rotation={[0, i * 0.8, 0]}>
          <boxGeometry args={[0.25, 0.08, 0.25]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
      ))}
      {/* Leaves */}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[
            (Math.random() - 0.5) * 1.5,
            height * 0.5 + i * 1.2,
            (Math.random() - 0.5) * 1.5,
          ]}
        >
          <sphereGeometry args={[1.5 - i * 0.2, 8, 6]} />
          <meshStandardMaterial color="#4a8a3a" flatShading />
        </mesh>
      ))}
    </group>
  );
}

function PineTree({ position, height = 10 }: { position: [number, number, number]; height?: number }) {
  return (
    <group position={position}>
      {/* Trunk */}
      <mesh position={[0, height * 0.3, 0]}>
        <cylinderGeometry args={[0.15, 0.25, height * 0.6, 8]} />
        <meshStandardMaterial color="#5a3a20" />
      </mesh>
      {/* Pine layers */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[0, height * 0.35 + i * height * 0.12, 0]}>
          <coneGeometry args={[2.5 - i * 0.4, height * 0.25, 8]} />
          <meshStandardMaterial color="#2a5a2a" flatShading />
        </mesh>
      ))}
    </group>
  );
}

export function Shore() {
  const rocks = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      position: [
        (Math.random() - 0.5) * 30,
        Math.random() * 0.3,
        -2 + Math.random() * 4,
      ] as [number, number, number],
      scale: 0.3 + Math.random() * 0.8,
      rotation: Math.random() * Math.PI,
    }));
  }, []);

  const reeds = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      position: [
        -15 + Math.random() * 30,
        0,
        -1 + Math.random() * 2,
      ] as [number, number, number],
      height: 1 + Math.random() * 1.5,
    }));
  }, []);

  return (
    <group>
      {/* Main ground/shore */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 2]} receiveShadow>
        <planeGeometry args={[80, 30]} />
        <meshStandardMaterial color="#8a7a5a" />
      </mesh>

      {/* Sand area near water */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -2]} receiveShadow>
        <planeGeometry args={[80, 12]} />
        <meshStandardMaterial color="#c4a870" />
      </mesh>

      {/* Grass areas */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 8]} receiveShadow>
        <planeGeometry args={[80, 20]} />
        <meshStandardMaterial color="#4a7a30" />
      </mesh>

      {/* Rocks */}
      {rocks.map((rock, i) => (
        <mesh
          key={i}
          geometry={createRockGeometry()}
          position={rock.position}
          scale={rock.scale}
          rotation={[0, rock.rotation, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#7a7a7a" flatShading />
        </mesh>
      ))}

      {/* Reeds */}
      {reeds.map((reed, i) => (
        <group key={i} position={reed.position}>
          {[0, 1, 2, 3].map((j) => (
            <mesh
              key={j}
              position={[(Math.random() - 0.5) * 0.5, reed.height / 2, (Math.random() - 0.5) * 0.5]}
              rotation={[(Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3]}
            >
              <cylinderGeometry args={[0.02, 0.03, reed.height, 4]} />
              <meshStandardMaterial color="#5a8a40" />
            </mesh>
          ))}
        </group>
      ))}

      {/* Birch trees */}
      <BirchTree position={[-12, 0, 12]} height={9} />
      <BirchTree position={[-8, 0, 15]} height={7} />
      <BirchTree position={[10, 0, 14]} height={8} />
      <BirchTree position={[15, 0, 11]} height={10} />

      {/* Pine trees */}
      <PineTree position={[-18, 0, 18]} height={12} />
      <PineTree position={[18, 0, 16]} height={11} />
      <PineTree position={[-5, 0, 20]} height={13} />
      <PineTree position={[8, 0, 22]} height={10} />

      {/* Distant tree line */}
      {Array.from({ length: 20 }, (_, i) => (
        <mesh key={`distant-${i}`} position={[-40 + i * 4, 2, 35]}>
          <coneGeometry args={[3, 6, 6]} />
          <meshStandardMaterial color="#2a4a2a" />
        </mesh>
      ))}
    </group>
  );
}

export function Pier() {
  return (
    <group position={[-8, 0, -2]}>
      {/* Main platform */}
      <mesh position={[0, 0.3, -2]} castShadow receiveShadow>
        <boxGeometry args={[3, 0.2, 8]} />
        <meshStandardMaterial color="#8a6a40" />
      </mesh>
      {/* Planks */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[0, 0.42, -5.5 + i * 1.1]} castShadow>
          <boxGeometry args={[2.8, 0.05, 1]} />
          <meshStandardMaterial color="#9a7a50" />
        </mesh>
      ))}
      {/* Supports */}
      {[-1.2, 1.2].map((x) =>
        [-5, -1, 3].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, -1, z]} castShadow>
            <cylinderGeometry args={[0.12, 0.12, 3, 8]} />
            <meshStandardMaterial color="#5a4a30" />
          </mesh>
        ))
      )}
    </group>
  );
}

export function Props() {
  return (
    <group position={[3, 0, 3]}>
      {/* Bucket */}
      <group position={[0, 0, 0]}>
        <mesh position={[0, 0.35, 0]} castShadow>
          <cylinderGeometry args={[0.35, 0.25, 0.7, 12]} />
          <meshStandardMaterial color="#6a8aaa" />
        </mesh>
        {/* Handle */}
        <mesh position={[0, 0.75, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.3, 0.02, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#4a4a4a" />
        </mesh>
      </group>

      {/* Tackle box */}
      <group position={[1.2, 0, 0.5]}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[0.8, 0.4, 0.5]} />
          <meshStandardMaterial color="#3a5a3a" />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <boxGeometry args={[0.82, 0.06, 0.52]} />
          <meshStandardMaterial color="#2a4a2a" />
        </mesh>
      </group>

      {/* Folding stool */}
      <group position={[-1, 0, 1]}>
        {/* Seat */}
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.5, 0.08, 0.5]} />
          <meshStandardMaterial color="#8a6a40" />
        </mesh>
        {/* Legs */}
        {[[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.25, z]} rotation={[0, 0, (x > 0 ? 1 : -1) * 0.15]}>
            <cylinderGeometry args={[0.03, 0.03, 0.5, 8]} />
            <meshStandardMaterial color="#5a4a30" />
          </mesh>
        ))}
      </group>
    </group>
  );
}
