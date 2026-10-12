'use client';

import React, { useRef, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Water, WaterRipples } from './Water';
import { Shore, Pier, Props } from './Environment';
import { FishingRod, FishingFloat, CastTrajectory, Splash } from './FishingGear';
import { UnderwaterFish } from './Fish';
import { useGameStore } from '../../hooks/useGameStore';
import { getSpeciesById } from '../../game/species';

function CameraController() {
  const { camera, gl } = useThree();
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const rotation = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const dom = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0) {
        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      const sensitivity = 0.003;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;

      rotation.current.y -= dx * sensitivity;
      rotation.current.x -= dy * sensitivity;
      rotation.current.x = Math.max(-1.2, Math.min(1.2, rotation.current.x));

      lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = () => {
      isDragging.current = false;
    };

    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('pointerleave', onPointerUp);

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointerleave', onPointerUp);
    };
  }, [gl]);

  useFrame(() => {
    camera.rotation.set(rotation.current.x, rotation.current.y, 0, 'YXZ');
  });

  return null;
}

function TimeOfDayLighting() {
  const { game } = useGameStore();
  const dirLightRef = useRef<THREE.DirectionalLight>(null);

  const sunColor = useMemo(() => {
    switch (game.timeOfDay) {
      case 'morning':
        return '#ffcc80';
      case 'day':
        return '#ffffff';
      case 'evening':
        return '#ff9060';
      case 'night':
        return '#4060a0';
      default:
        return '#ffffff';
    }
  }, [game.timeOfDay]);

  const ambientIntensity = useMemo(() => {
    switch (game.timeOfDay) {
      case 'morning':
        return 0.4;
      case 'day':
        return 0.6;
      case 'evening':
        return 0.35;
      case 'night':
        return 0.15;
      default:
        return 0.4;
    }
  }, [game.timeOfDay]);

  const sunPosition = useMemo(() => {
    switch (game.timeOfDay) {
      case 'morning':
        return [50, 30, -30] as [number, number, number];
      case 'day':
        return [20, 60, -20] as [number, number, number];
      case 'evening':
        return [-50, 25, -40] as [number, number, number];
      case 'night':
        return [-30, 50, -30] as [number, number, number];
      default:
        return [50, 40, -30] as [number, number, number];
    }
  }, [game.timeOfDay]);

  return (
    <>
      <ambientLight intensity={ambientIntensity} color={sunColor} />
      <directionalLight
        ref={dirLightRef}
        position={sunPosition}
        intensity={game.timeOfDay === 'night' ? 0.3 : 1.2}
        color={sunColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={100}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      {/* Fog */}
      <fog
        attach="fog"
        args={[
          game.timeOfDay === 'night' ? '#0a1520' : game.timeOfDay === 'evening' ? '#c08060' : '#8ab0c0',
          20,
          120,
        ]}
      />
    </>
  );
}

function AimMarker() {
  const { game } = useGameStore();
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const isActive = game.fishingState === 'charging' || game.fishingState === 'ready';
    meshRef.current.visible = isActive;

    if (isActive) {
      const distance = 5 + game.cast.power * 50;
      meshRef.current.position.set(0, 0.05, -distance);
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
      meshRef.current.scale.setScalar(scale);
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.8, 1.2, 32]} />
      <meshBasicMaterial color="#ffff00" transparent opacity={0.5} />
    </mesh>
  );
}

function CatchPreview() {
  const { game } = useGameStore();
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current && game.fishingState === 'result' && game.lastCatch) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.8;
    }
  });

  if (game.fishingState !== 'result' || !game.lastCatch) return null;

  const species = getSpeciesById(game.lastCatch.speciesId);

  return (
    <group ref={groupRef} position={[0, 1.5, -2]}>
      <UnderwaterFish species={species} weight={game.lastCatch.weight} />
    </group>
  );
}

export function GameScene() {
  const { game, settings } = useGameStore();

  const floatPosition = useMemo(() => {
    if (game.fishingState === 'waiting' || game.fishingState === 'investigating' || game.fishingState === 'strike') {
      return [game.cast.targetX, 0, game.cast.targetZ] as [number, number, number];
    }
    return [0, -10, 0] as [number, number, number];
  }, [game.fishingState, game.cast.targetX, game.cast.targetZ]);

  const quality = settings.graphicsQuality;

  return (
    <Canvas
      shadows={quality !== 'low'}
      camera={{ position: [0, 2, 5], fov: 65, near: 0.1, far: 200 }}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      gl={{ antialias: quality !== 'low', alpha: false }}
    >
      <Suspense fallback={null}>
        <TimeOfDayLighting />
        <CameraController />

        {/* Sky background */}
        <color attach="background" args={[game.timeOfDay === 'night' ? '#0a1520' : '#87CEEB']} />

        {/* Water */}
        <Water />

        {/* Water ripples at float */}
        {(game.fishingState === 'waiting' || game.fishingState === 'investigating') && (
          <WaterRipples position={floatPosition} />
        )}

        {/* Environment */}
        <Shore />
        <Pier />
        <Props />

        {/* Aim marker */}
        <AimMarker />

        {/* Fishing gear */}
        <FishingRod
          tension={game.fight.tension}
          isCasting={game.fishingState === 'casting'}
          castProgress={game.cast.trajectoryProgress}
          floatPosition={floatPosition}
          isFighting={game.fishingState === 'fighting'}
        />

        {/* Float */}
        <FishingFloat
          position={floatPosition}
          depth={game.bite.floatDepth}
          bobbing={game.bite.floatBobbing}
          isVisible={
            game.fishingState === 'waiting' ||
            game.fishingState === 'investigating' ||
            game.fishingState === 'strike' ||
            game.fishingState === 'fighting'
          }
          isBite={game.bite.phase === 'committed'}
        />

        {/* Cast trajectory ball */}
        <CastTrajectory
          progress={game.cast.trajectoryProgress}
          targetPosition={[game.cast.targetX, 0, game.cast.targetZ]}
          isCasting={game.fishingState === 'casting'}
        />

        {/* Splash on landing */}
        <Splash
          position={floatPosition}
          active={game.fishingState === 'waiting' && game.bite.timer > 0 && game.bite.timer < 0.5}
        />

        {/* Splash during fight */}
        {game.fight.surfaceSplash && (
          <Splash
            position={[game.cast.targetX, 0, game.cast.targetZ - game.fight.fishDistance * 0.3]}
            active={true}
          />
        )}

        {/* Catch preview */}
        <CatchPreview />
      </Suspense>
    </Canvas>
  );
}
