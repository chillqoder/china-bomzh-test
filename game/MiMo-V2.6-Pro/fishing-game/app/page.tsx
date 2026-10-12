'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { useGameStore } from '@/hooks/useGameStore';
import { HUD } from '@/components/ui/HUD';
import {
  BaitPanel,
  KeepnetPanel,
  ShopPanel,
  RecordsPanel,
  SettingsPanel,
  ResultPanel,
} from '@/components/ui/Panels';

const GameScene = dynamic(
  () => import('@/components/three/GameScene').then((mod) => ({ default: mod.GameScene })),
  {
    ssr: false,
    loading: () => (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Загрузка озера...</p>
      </div>
    ),
  }
);

export default function Home() {
  const {
    game,
    settings,
    activePanel,
    isPaused,
    initGame,
    startCharging,
    updateCharge,
    cast,
    setHook,
    updateBite,
    updateFightTick,
    updateCastTrajectory,
    landCast,
    tickTime,
    togglePause,
    closePanel,
    setState,
  } = useGameStore();

  const [isReeling, setIsReeling] = useState(false);
  const [mounted, setMounted] = useState(false);
  const chargeStartRef = useRef<number>(0);
  const chargeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gameLoopRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    initGame();
    setMounted(true);
    return () => {
      if (chargeIntervalRef.current) clearInterval(chargeIntervalRef.current);
      cancelAnimationFrame(gameLoopRef.current);
    };
  }, []);

  // Game loop
  useEffect(() => {
    if (!mounted) return;

    const gameLoop = (time: number) => {
      const delta = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;

      const state = useGameStore.getState();

      if (!state.isPaused && !state.activePanel) {
        // Update time
        state.tickTime(delta);

        // Update bite/waiting state
        state.updateBite(delta);

        // Update fight if reeling
        if (state.game.fishingState === 'fighting') {
          state.updateFightTick(delta, isReeling);
        }

        // Update cast trajectory
        if (state.game.fishingState === 'casting') {
          const newProgress = state.game.cast.trajectoryProgress + delta * 1.5;
          if (newProgress >= 1) {
            state.landCast();
          } else {
            state.updateCastTrajectory(newProgress);
          }
        }
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [mounted, isReeling]);

  // Mouse/keyboard controls
  useEffect(() => {
    if (!mounted) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (activePanel || isPaused) return;

      const state = useGameStore.getState();

      // Only trigger if click is on canvas area, not UI
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.closest('button') || target.closest('.panel')) {
        return;
      }

      if (state.game.fishingState === 'ready') {
        chargeStartRef.current = Date.now();
        startCharging();

        chargeIntervalRef.current = setInterval(() => {
          const power = Math.min(1, (Date.now() - chargeStartRef.current) / 1500);
          updateCharge(power);
        }, 50);
      } else if (state.game.fishingState === 'strike') {
        setHook();
      } else if (state.game.fishingState === 'fighting') {
        setIsReeling(true);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (activePanel || isPaused) return;

      const state = useGameStore.getState();

      if (chargeIntervalRef.current) {
        clearInterval(chargeIntervalRef.current);
        chargeIntervalRef.current = null;
      }

      if (state.game.fishingState === 'charging') {
        cast();
      } else if (state.game.fishingState === 'fighting') {
        setIsReeling(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activePanel) {
          closePanel();
        } else {
          togglePause();
        }
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      if (chargeIntervalRef.current) clearInterval(chargeIntervalRef.current);
    };
  }, [mounted, activePanel, isPaused, startCharging, updateCharge, cast, setHook, togglePause, closePanel]);

  // Wheel for drag adjustment
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (game.fishingState === 'fighting') {
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        const currentDrag = game.fight.drag;
        useGameStore.getState().setDrag(currentDrag + delta);
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [game.fishingState, game.fight.drag]);

  if (!mounted) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="game-container">
      {/* 3D Scene */}
      <GameScene />

      {/* UI Overlay */}
      <div className="ui-overlay">
        <HUD />

        {/* Panels */}
        {activePanel === 'bait' && <BaitPanel />}
        {activePanel === 'keepnet' && <KeepnetPanel />}
        {activePanel === 'shop' && <ShopPanel />}
        {activePanel === 'records' && <RecordsPanel />}
        {activePanel === 'settings' && <SettingsPanel />}

        {/* Result panel */}
        {game.fishingState === 'result' && <ResultPanel />}

        {/* Pause menu */}
        {isPaused && !activePanel && (
          <div className="panel-overlay">
            <div className="panel pause-panel">
              <div className="panel-header">
                <h2>Пауза</h2>
              </div>
              <div className="panel-content">
                <button className="action-btn" onClick={togglePause}>
                  Продолжить
                </button>
                <div className="pause-info">
                  <p>Esc — пауза</p>
                  <p>ЛКМ — заброс / подсечка / вываживание</p>
                  <p>Колесо мыши — регулировка фрикциона</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
