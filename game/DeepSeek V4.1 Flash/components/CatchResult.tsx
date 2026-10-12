"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { SPECIES_MAP } from "@/lib/game/data";
import { formatCm, formatKg, formatMoney } from "@/lib/game/format";
import { buildFish, disposeObject } from "@/lib/three/fishMesh";
import { useGame } from "./gameContext";

function FishPreview({ speciesId, weight }: { speciesId: string; weight: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sp = SPECIES_MAP[speciesId];
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(240, 150, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 240 / 150, 0.01, 20);
    const fish = buildFish(sp, weight);
    scene.add(fish);

    const scale = Math.max(fish.userData.lengthCm / 100, 0.12);
    camera.position.set(scale * 0.9, scale * 0.5, scale * 2.2);
    camera.lookAt(0, 0, 0);

    const amb = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(amb);
    const key = new THREE.DirectionalLight(0xfff2e0, 2.6);
    key.position.set(1.4, 2, 1.6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9db8d8, 1.1);
    rim.position.set(-1.5, 0.6, -1.2);
    scene.add(rim);

    let raf = 0;
    let last = performance.now();
    fish.rotation.y = -1.1;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      fish.rotation.y += dt * 0.6;
      fish.rotation.z = Math.sin(now / 900) * 0.08;
      fish.position.y = Math.sin(now / 700) * scale * 0.05;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      disposeObject(fish);
      renderer.dispose();
    };
  }, [speciesId, weight]);

  return <canvas ref={canvasRef} className="fish-preview" width={240} height={150} />;
}

export function CatchResult() {
  const { result, keepFish, releaseFish, profile, sim } = useGame();
  if (!result) return null;
  const fish = result.fish;
  const keepnetFull = profile.keepnet.length >= sim.keepnet.capacity;
  return (
    <div className="overlay result-overlay">
      <div className="panel result-panel">
        <div className="result-left">
          <FishPreview speciesId={fish.speciesId} weight={fish.weight} />
          <div className="result-badges">
            {result.isRecord && <span className="badge-record">Новый рекорд!</span>}
            {result.isTrophy && <span className="badge-trophy">Трофей!</span>}
          </div>
        </div>
        <div className="result-right">
          <h2 className="result-title">{result.speciesNameRu}</h2>
          <div className="result-latin">{result.speciesNameEn}</div>
          <div className="result-grid">
            <div className="kv">
              <span>Вес:</span>
              <b>{formatKg(fish.weight)}</b>
            </div>
            <div className="kv">
              <span>Длина:</span>
              <b>{formatCm(fish.length)}</b>
            </div>
            <div className="kv">
              <span>Наживка:</span>
              <b>{result.baitLabel}</b>
            </div>
            <div className="kv">
              <span>Время:</span>
              <b>{result.caughtAtLabel}</b>
            </div>
            <div className="kv">
              <span>Зона:</span>
              <b>{result.zoneLabel}</b>
            </div>
            <div className="kv">
              <span>Цена:</span>
              <b className="money">{formatMoney(fish.value)}</b>
            </div>
          </div>
          <div className="result-actions">
            <button className="game-btn primary big" disabled={keepnetFull} onClick={keepFish}>
              Оставить
            </button>
            <button className="game-btn big" onClick={releaseFish}>
              Отпустить
            </button>
          </div>
          {keepnetFull ? (
            <div className="dim small">Садок полон — отпустите рыбу или продайте улов.</div>
          ) : (
            <div className="dim small">
              «Оставить» — в садок (можно продать). «Отпустить» — опыт без денег.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
