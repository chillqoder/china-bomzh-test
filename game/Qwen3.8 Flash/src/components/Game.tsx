'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FishingGame } from '@/three/game';
import type { HudSnapshot } from '@/game/types';
import type { GameApi } from './api';
import Hud from './Hud';
import {
  BaitPanel,
  KeepnetPanel,
  PausePanel,
  RecordsPanel,
  ResultPanel,
  SettingsPanel,
  ShopPanel,
} from './Panels';

export type PanelId = 'bait' | 'net' | 'shop' | 'records' | 'settings' | 'pause' | null;

export default function Game() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<FishingGame | null>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [panel, setPanel] = useState<PanelId>(null);
  const [error, setError] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);

  // The engine (and three.js) is imported only in the browser: nothing WebGL touches runs on the server.
  useEffect(() => {
    let cancelled = false;
    let game: FishingGame | null = null;
    import('@/three/game')
      .then(({ FishingGame: Engine }) => {
        if (cancelled || !mountRef.current) return;
        try {
          game = new Engine(mountRef.current, {
            onHud: (snap) => setHud(snap),
            onRequestPause: () => setPanel((prev) => (prev === null ? 'pause' : null)),
          });
          gameRef.current = game;
          setBooted(true);
        } catch (err) {
          console.error(err);
          setError(
            'Не удалось запустить 3D-сцену: браузер не поддержал WebGL. Попробуйте другое устройство или включите аппаратное ускорение.',
          );
        }
      })
      .catch((err) => {
        console.error(err);
        console.dir(err);
        setError('Не удалось загрузить модуль игры.');
      });
    return () => {
      cancelled = true;
      game?.dispose();
      gameRef.current = null;
    };
  }, []);

  const modalOpen = panel !== null || hud?.phase === 'result';

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    game.setPaused(modalOpen);
    game.setUiBlocked(modalOpen);
  }, [modalOpen]);

  const api = useMemo<GameApi>(
    () => ({
      selectBait: (id) => gameRef.current?.selectBait(id),
      buy: (id) => gameRef.current?.buy(id),
      sell: () => gameRef.current?.sell(),
      setDrag: (v) => gameRef.current?.setDrag(v),
      adjustDrag: (d) => {
        const g = gameRef.current;
        if (g) g.setDrag(g.sim.state.drag + d);
      },
      retrieve: () => gameRef.current?.retrieve(),
      press: () => gameRef.current?.pressCast(),
      release: () => gameRef.current?.releaseCast(),
      aim: (dyaw) => gameRef.current?.aimBy(dyaw),
      resolve: (a) => gameRef.current?.resolveResult(a),
      setSetting: (key, value) => gameRef.current?.setSetting(key, value),
      reset: () => gameRef.current?.resetProgress(),
      attachPreview: (canvas, species, length) => gameRef.current?.attachPreview(canvas, species, length),
      sim: () => gameRef.current?.sim ?? null,
    }),
    [],
  );

  const close = useCallback(() => setPanel(null), []);
  const toggle = useCallback((p: PanelId) => setPanel((prev) => (prev === p ? null : p)), []);

  if (error) {
    return (
      <div className="stage">
        <div className="boot">
          <h1 style={{ fontSize: '1.05rem', margin: 0 }}>Рыбалка не запускается</h1>
          <p className="notice" style={{ maxWidth: 520 }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="stage">
      <div ref={mountRef} className="scene" />
      {booted && hud ? (
        <>
          <Hud hud={hud} api={api} panel={panel} onToggle={toggle} />
          {panel === 'bait' && <BaitPanel api={api} close={close} />}
          {panel === 'net' && <KeepnetPanel api={api} close={close} hud={hud} />}
          {panel === 'shop' && <ShopPanel api={api} close={close} hud={hud} />}
          {panel === 'records' && <RecordsPanel api={api} close={close} hud={hud} />}
          {panel === 'settings' && <SettingsPanel api={api} close={close} />}
          {panel === 'pause' && <PausePanel close={close} />}
          {hud.phase === 'result' && hud.result && (
            <ResultPanel api={api} hud={hud} netFull={hud.netCount >= hud.netCapacity} />
          )}
        </>
      ) : (
        <div className="boot">
          <div className="spinner" />
          <div>Утренний туман над прудом…</div>
          <div className="notice">Загрузка 3D-сцены</div>
        </div>
      )}
    </div>
  );
}
