"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameAudio } from "@/lib/game/audio";
import { BAIT_MAP, SPECIES_MAP } from "@/lib/game/data";
import { formatTime } from "@/lib/game/format";
import { loadProfile, saveProfile } from "@/lib/game/save";
import { FishingSim } from "@/lib/game/simulation";
import { terrainHeight } from "@/lib/game/terrain";
import { GameRenderer } from "@/lib/three/renderer";
import type {
  BaitId,
  CatchResultInfo,
  PanelId,
  Phase,
  Profile,
  Settings,
  SimEvent,
  WeatherId,
  ZoneId,
} from "@/lib/game/types";
import { WEATHER_LABELS, ZONE_LABELS } from "@/lib/game/types";
import { CatchResult } from "./CatchResult";
import { GameContext, type GameApi, type HudCallback, type HudData, type Toast } from "./gameContext";
import {
  BottomCenterHud,
  BottomLeftHud,
  BottomRightHud,
  FloatMagnifier,
  Toasts,
  Toolbar,
  TopLeftHud,
  TopRightHud,
} from "./Hud";
import { Panels } from "./Panels";
import { TouchControls } from "./TouchControls";

const initialProfile: Profile = {
  version: 1,
  money: 250,
  xp: 0,
  bait: { worm: 15, maggot: 15, corn: 12, livebait: 8 },
  selectedBait: "worm",
  rodIndex: 0,
  lineIndex: 0,
  keepnetIndex: 0,
  drag: 3,
  keepnet: [],
  records: {},
  history: [],
  stats: {
    totalCaught: 0,
    totalReleased: 0,
    totalSold: 0,
    totalEarned: 0,
    biggestWeight: 0,
    biggestSpeciesId: null,
  },
  gameHours: 6,
  settings: { sound: true, volume: 0.6, sensitivity: 1, quality: "medium" },
};

export default function GameView() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<FishingSim | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const audioRef = useRef<GameAudio | null>(null);

  const hudDataRef = useRef<HudData | null>(null);
  const hudSubsRef = useRef<Set<HudCallback>>(new Set());
  const panelRef = useRef<PanelId | null>(null);
  const resultRef = useRef<CatchResultInfo | null>(null);
  const yawRef = useRef(0.06);
  const pitchRef = useRef(-0.14);
  const heldRef = useRef(false);
  const lookDragRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const toastTimersRef = useRef<number[]>([]);
  const toastIdRef = useRef(1);
  const touchRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("ready");
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [result, setResult] = useState<CatchResultInfo | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [touch, setTouch] = useState(false);

  const pushToast = useCallback((text: string, kind: Toast["kind"]) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev.slice(-3), { id, text, kind }]);
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
    toastTimersRef.current.push(timer);
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const sim = simRef.current;
      if (sim) saveProfile(sim.profile);
      saveTimerRef.current = null;
    }, 400);
  }, []);

  const handleSimEvent = useCallback(
    (e: SimEvent) => {
      const sim = simRef.current;
      if (!sim) return;
      if (e.type === "phase") {
        setPhase(e.phase);
        if (e.phase !== "result") {
          setResult(null);
          resultRef.current = null;
        }
      } else if (e.type === "profile") {
        setProfile({ ...sim.profile });
        scheduleSave();
      } else if (e.type === "message") {
        pushToast(e.text, e.kind);
      } else if (e.type === "catch") {
        const sp = SPECIES_MAP[e.fish.speciesId];
        const info: CatchResultInfo = {
          fish: e.fish,
          speciesNameRu: sp.nameRu,
          speciesNameEn: sp.nameEn,
          isRecord: e.fish.isRecord,
          isTrophy: e.fish.isTrophy,
          caughtAtLabel: formatTime(e.fish.caughtAtHour),
          zoneLabel: ZONE_LABELS[e.fish.zone as ZoneId],
          baitLabel: BAIT_MAP[e.fish.baitId].nameRu,
        };
        setResult(info);
        resultRef.current = info;
        audioRef.current?.play("land");
      } else if (e.type === "sound") {
        audioRef.current?.play(e.name, e.intensity ?? 1);
      }
    },
    [pushToast, scheduleSave]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const prof = loadProfile();
    const sim = new FishingSim(prof);
    simRef.current = sim;
    setProfile({ ...prof });
    panelRef.current = null;
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __sim?: FishingSim }).__sim = sim;
    }

    const isTouch =
      typeof window !== "undefined" &&
      (window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window);
    touchRef.current = isTouch;
    setTouch(isTouch);

    const renderer = new GameRenderer(canvas, prof.settings.quality);
    rendererRef.current = renderer;

    const audio = new GameAudio();
    audioRef.current = audio;
    audio.setEnabled(prof.settings.sound);
    audio.setVolume(prof.settings.volume);

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      renderer.resize(rect.width, rect.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const unsub = sim.on(handleSimEvent);

    const view = sim.getView();
    yawRef.current = view.yaw;
    pitchRef.current = view.pitch;

    const onPointerDown = (e: PointerEvent) => {
      audio.ensure();
      if (panelRef.current !== null || resultRef.current !== null) return;
      canvas.setPointerCapture(e.pointerId);
      if (e.button === 2) {
        sim.cancelCharge();
        return;
      }
      if (e.button !== 0) return;
      heldRef.current = true;
      lookDragRef.current = true;
      sim.primaryDown();
    };

    const onPointerMove = (e: PointerEvent) => {
      const sensitivity = sim.profile.settings.sensitivity;
      const looking =
        heldRef.current ||
        sim.phase === "ready" ||
        sim.phase === "charging";
      if (!looking) return;
      const dx = e.movementX || 0;
      const dy = e.movementY || 0;
      yawRef.current -= dx * 0.0032 * sensitivity;
      pitchRef.current -= dy * 0.0028 * sensitivity;
      pitchRef.current = Math.min(0.55, Math.max(-1.15, pitchRef.current));
      sim.setView(yawRef.current, pitchRef.current);
    };

    const onPointerUp = () => {
      lookDragRef.current = false;
      if (heldRef.current) {
        heldRef.current = false;
        sim.primaryUp();
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (panelRef.current !== null) return;
      e.preventDefault();
      sim.adjustDrag(e.deltaY < 0 ? 0.5 : -0.5);
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (panelRef.current !== null) {
          setPanel(null);
          panelRef.current = null;
        } else if (resultRef.current === null) {
          setPanel("pause");
          panelRef.current = "pause";
        }
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") saveProfile(sim.profile);
    };
    const onBeforeUnload = () => saveProfile(sim.profile);

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);

    let raf = 0;
    let last = performance.now();
    let saveAccum = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      sim.paused = panelRef.current !== null;
      sim.update(dt);
      const snapshot = sim.snapshot();
      const fx = sim.drainFx();
      renderer.update(snapshot, dt, yawRef.current, pitchRef.current, fx);

      const fight = snapshot.fight;
      const hud: HudData = {
        phase: snapshot.phase,
        power: snapshot.power,
        predictedDistance: snapshot.aim
          ? Math.min(snapshot.power * sim.rod.castRange, snapshot.aim.distance)
          : snapshot.power * sim.rod.castRange,
        aimValid: snapshot.aim ? snapshot.aim.valid : true,
        aimDistance: snapshot.aim ? snapshot.aim.distance : 0,
        aimZoneLabel: snapshot.aim && snapshot.aim.zone ? ZONE_LABELS[snapshot.aim.zone] : null,
        castDistance: snapshot.castDistance,
        castZoneLabel: snapshot.castZone ? ZONE_LABELS[snapshot.castZone] : null,
        castDepth: snapshot.castDepth,
        tension: fight ? fight.tension : 0,
        stamina: fight ? fight.stamina : 0,
        fishDistance: fight ? fight.distance : 0,
        fishWeight: fight ? fight.weight : 0,
        fishSpeciesId: fight ? fight.speciesId : null,
        drag: sim.currentDrag,
        maxDrag: sim.rod.maxDrag,
        reeling: fight ? fight.reeling : false,
        floatY: snapshot.floatState.y,
        floatNibble: snapshot.floatState.nibble,
        strikeProgress: snapshot.floatState.strikeProgress,
        timeHour: snapshot.timeHour,
        weather: snapshot.weather,
        retrievingProgress: snapshot.retrievingProgress,
        critical: fight ? fight.critical : false,
        warning: fight ? fight.warning : false,
      };
      hudDataRef.current = hud;
      for (const cb of hudSubsRef.current) cb(hud);

      if (fight && fight.reeling) audio.reelTick();

      saveAccum += dt;
      if (saveAccum > 10) {
        saveAccum = 0;
        saveProfile(sim.profile);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    setReady(true);

    return () => {
      cancelAnimationFrame(raf);
      unsub();
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      for (const t of toastTimersRef.current) window.clearTimeout(t);
      toastTimersRef.current = [];
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      saveProfile(sim.profile);
      renderer.dispose();
      audio.dispose();
      simRef.current = null;
      rendererRef.current = null;
      audioRef.current = null;
    };
  }, [handleSimEvent]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (renderer) renderer.setQuality(profile.settings.quality);
  }, [profile.settings.quality]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.setVolume(profile.settings.volume);
      audio.setEnabled(profile.settings.sound);
    }
  }, [profile.settings.volume, profile.settings.sound]);

  const registerHud = useCallback((cb: HudCallback) => {
    hudSubsRef.current.add(cb);
    if (hudDataRef.current) cb(hudDataRef.current);
    return () => {
      hudSubsRef.current.delete(cb);
    };
  }, []);

  const api: GameApi | null = useMemo(() => {
    const sim = simRef.current;
    if (!sim) return null;
    const setPanelBoth = (p: PanelId | null) => {
      panelRef.current = p;
      setPanel(p);
    };
    return {
      sim,
      profile,
      phase,
      panel,
      touch,
      result,
      toasts,
      openPanel: (p) => {
        audioRef.current?.ensure();
        audioRef.current?.play("ui");
        setPanelBoth(p);
      },
      closePanel: () => setPanelBoth(null),
      switchPanel: (p) => setPanelBoth(p),
      selectBait: (id: BaitId) => {
        audioRef.current?.play("ui");
        if (sim.selectBait(id)) setPanelBoth(null);
      },
      buy: (itemId: string) => {
        const res = sim.buy(itemId);
        if (res.ok) audioRef.current?.play("buy");
        else pushToast(res.msg, "bad");
      },
      sellAll: () => {
        sim.sellAll();
      },
      keepFish: () => {
        sim.keepFish();
      },
      releaseFish: () => {
        sim.releaseFish();
      },
      resetProgress: () => {
        sim.resetProgress();
        setPanelBoth(null);
      },
      updateSettings: (s: Partial<Settings>) => {
        sim.setSettings(s);
      },
      adjustDrag: (delta: number) => {
        sim.adjustDrag(delta);
      },
      startRetrieve: () => {
        sim.startRetrieve();
      },
      primaryDown: () => {
        audioRef.current?.ensure();
        sim.primaryDown();
      },
      primaryUp: () => {
        sim.primaryUp();
      },
      registerHud,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, phase, panel, touch, result, toasts, pushToast, registerHud, ready]);

  const showGame = ready && api !== null;
  const content = showGame ? (
    <GameContext.Provider value={api}>
      <div className="hud-layer">
        <TopLeftHud />
        <TopRightHud />
        <BottomLeftHud />
        <BottomCenterHud />
        <BottomRightHud />
        <FloatMagnifier />
        <Toolbar />
        <Toasts />
        <TouchControls />
      </div>
      {result && <CatchResult />}
      <Panels />
    </GameContext.Provider>
  ) : null;

  return (
    <div className="game-root">
      <div className="canvas-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} className="game-canvas" />
      </div>
      {content}
      {!showGame && (
        <div className="loading-screen">
          <div className="loading-title">Рыбалка на озере</div>
          <div className="loading-sub">Расставляем снасти…</div>
        </div>
      )}
    </div>
  );
}
