"use client";

import { useEffect, useRef } from "react";
import { BAIT_MAP, RODS, LINES, KEEPNETS, levelFromXp } from "@/lib/game/data";
import {
  formatDistance,
  formatMoney,
  formatTime,
  timeOfDayLabel,
  formatWeightPlain,
} from "@/lib/game/format";
import { WEATHER_LABELS } from "@/lib/game/types";
import { useGame } from "./gameContext";

export function TopLeftHud() {
  const { profile } = useGame();
  const { level, into, need } = levelFromXp(profile.xp);
  return (
    <div className="hud hud-top-left">
      <div className="hud-card">
        <div className="hud-row">
          <span className="hud-label">Уровень</span>
          <span className="hud-value">{level}</span>
        </div>
        <div className="xp-bar">
          <div className="xp-fill" style={{ width: `${Math.min(100, (into / need) * 100)}%` }} />
        </div>
        <div className="hud-sub">
          Опыт: {into} / {need}
        </div>
        <div className="hud-row">
          <span className="hud-label">Баланс</span>
          <span className="hud-value money">{formatMoney(profile.money)}</span>
        </div>
      </div>
    </div>
  );
}

export function TopRightHud() {
  const { registerHud } = useGame();
  const timeRef = useRef<HTMLSpanElement>(null);
  const weatherRef = useRef<HTMLSpanElement>(null);
  const periodRef = useRef<HTMLSpanElement>(null);
  useEffect(
    () =>
      registerHud((h) => {
        if (timeRef.current) timeRef.current.textContent = formatTime(h.timeHour);
        if (weatherRef.current) weatherRef.current.textContent = WEATHER_LABELS[h.weather];
        if (periodRef.current) periodRef.current.textContent = timeOfDayLabel(h.timeHour);
      }),
    [registerHud]
  );
  return (
    <div className="hud hud-top-right">
      <div className="hud-card">
        <div className="hud-row">
          <span className="hud-value clock" ref={timeRef}>
            06:00
          </span>
          <span className="hud-label" ref={periodRef}>
            Утро
          </span>
        </div>
        <div className="hud-sub">
          Погода: <span ref={weatherRef}>Ясно</span>
        </div>
      </div>
    </div>
  );
}

export function BottomLeftHud() {
  const { profile, phase, sim } = useGame();
  const bait = BAIT_MAP[profile.selectedBait];
  const count = profile.bait[profile.selectedBait];
  const inWater =
    sim.attachedBait !== null &&
    (phase === "casting" ||
      phase === "waiting" ||
      phase === "investigating" ||
      phase === "strike");
  return (
    <div className="hud hud-bottom-left">
      <div className="hud-card">
        <div className="hud-row">
          <span className="hud-label">Наживка:</span>
          <span className="hud-value">
            {bait.nameRu} × {count}
            {inWater ? " (в воде)" : ""}
          </span>
        </div>
        <div className="hud-sub">Удилище: {RODS[profile.rodIndex].nameRu}</div>
        <div className="hud-sub">
          Леска: {LINES[profile.lineIndex].ratingKg} кг · Садок: {KEEPNETS[profile.keepnetIndex].capacity}
        </div>
      </div>
    </div>
  );
}

export function BottomCenterHud() {
  const { phase, registerHud, startRetrieve } = useGame();
  const aimRef = useRef<HTMLSpanElement>(null);
  const powerFillRef = useRef<HTMLDivElement>(null);
  const powerLabelRef = useRef<HTMLSpanElement>(null);
  const strikeFillRef = useRef<HTMLDivElement>(null);
  const fightHintRef = useRef<HTMLDivElement>(null);
  const retrieveFillRef = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      registerHud((h) => {
        if (aimRef.current) {
          aimRef.current.textContent = formatDistance(h.aimDistance);
        }
        if (powerFillRef.current) {
          powerFillRef.current.style.width = `${Math.round(h.power * 100)}%`;
        }
        if (powerLabelRef.current) {
          powerLabelRef.current.textContent = `${Math.round(h.power * 100)}% · ~${formatDistance(
            h.predictedDistance
          )}`;
        }
        if (strikeFillRef.current) {
          strikeFillRef.current.style.width = `${Math.round((1 - h.strikeProgress) * 100)}%`;
        }
        if (fightHintRef.current) {
          if (h.phase === "fighting") {
            if (h.critical) {
              fightHintRef.current.textContent = "Натяжение критическое! Ослабьте фрикцион";
            } else if (h.stamina < 0.3) {
              fightHintRef.current.textContent = "Рыба выдохлась — подматывайте!";
            } else if (h.reeling) {
              fightHintRef.current.textContent = "Подматываем…";
            } else {
              fightHintRef.current.textContent = "Удерживайте кнопку, чтобы подматывать";
            }
          } else if (h.phase === "retrieving") {
            fightHintRef.current.textContent = "Выматываем снасть…";
          } else {
            fightHintRef.current.textContent = "";
          }
        }
        if (retrieveFillRef.current) {
          retrieveFillRef.current.style.width = `${Math.round(h.retrievingProgress * 100)}%`;
        }
      }),
    [registerHud]
  );

  return (
    <div className="hud hud-bottom-center">
      <div className="instruction-card">
        {phase === "ready" && (
          <div className="instruction">
            <b>ЛКМ (удерживать)</b> — замах и заброс · <b>мышь</b> — прицел · <b>колесо</b> —
            фрикцион
          </div>
        )}
        {phase === "charging" && (
          <div className="instruction charge">
            <div className="instruction-line">
              Отпустите ЛКМ для заброса · цель: <span ref={aimRef}>—</span> ·{" "}
              <span ref={powerLabelRef}>0%</span>
            </div>
            <div className="power-bar">
              <div className="power-fill" ref={powerFillRef} />
            </div>
          </div>
        )}
        {phase === "casting" && <div className="instruction">Заброс…</div>}
        {phase === "waiting" && (
          <div className="instruction">
            Ждём поклёвки… Следите за поплавком. <span className="dim">ЛКМ — подсечка при поклёвке</span>
          </div>
        )}
        {phase === "investigating" && (
          <div className="instruction warn">Рыба интересуется наживкой… не спешите подсекать!</div>
        )}
        {phase === "strike" && (
          <div className="instruction strike-prompt">
            <div className="strike-text">ПОДСЕКАЙТЕ!</div>
            <div className="strike-window">
              <div className="strike-fill" ref={strikeFillRef} />
            </div>
          </div>
        )}
        {phase === "fighting" && (
          <div className="instruction fight">
            <div className="instruction-line">
              <b>Удерживайте ЛКМ</b> — подмотка · <b>колесо/± </b> — фрикцион
            </div>
            <div className="fight-hint" ref={fightHintRef} />
          </div>
        )}
        {phase === "retrieving" && (
          <div className="instruction">
            <div className="instruction-line" ref={fightHintRef} />
            <div className="retrieve-bar">
              <div className="retrieve-fill" ref={retrieveFillRef} />
            </div>
          </div>
        )}
        {phase === "result" && <div className="instruction">Решите судьбу улова…</div>}
        {(phase === "waiting" || phase === "investigating") && (
          <button className="game-btn secondary retrieve-btn" onClick={startRetrieve}>
            Вымотать снасть
          </button>
        )}
      </div>
    </div>
  );
}

export function BottomRightHud() {
  const { phase, profile, registerHud, adjustDrag, sim } = useGame();
  const castInfoRef = useRef<HTMLDivElement>(null);
  const tensionFillRef = useRef<HTMLDivElement>(null);
  const tensionNumRef = useRef<HTMLSpanElement>(null);
  const staminaFillRef = useRef<HTMLDivElement>(null);
  const fishInfoRef = useRef<HTMLDivElement>(null);
  const tensionWrapRef = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      registerHud((h) => {
        if (castInfoRef.current) {
          if (h.phase === "ready" || h.phase === "charging") {
            const zone = h.aimZoneLabel ? ` · ${h.aimZoneLabel}` : "";
            castInfoRef.current.textContent = h.aimValid
              ? `Цель: ${formatDistance(h.aimDistance)}${zone}`
              : "Цель на берегу — заброс невозможен";
          } else if (h.castDistance > 0) {
            castInfoRef.current.textContent = `Заброс: ${formatDistance(h.castDistance)} · глубина ${formatDistance(
              h.castDepth
            )}${h.castZoneLabel ? ` · ${h.castZoneLabel}` : ""}`;
          } else {
            castInfoRef.current.textContent = "";
          }
        }
        if (tensionWrapRef.current) {
          tensionWrapRef.current.style.display = h.phase === "fighting" ? "" : "none";
        }
        if (tensionFillRef.current) {
          tensionFillRef.current.style.width = `${Math.min(100, Math.round((h.tension / 1.3) * 100))}%`;
          tensionFillRef.current.className = `tension-fill ${
            h.critical ? "critical" : h.warning ? "warning" : ""
          }`;
        }
        if (tensionNumRef.current) {
          tensionNumRef.current.textContent = `${Math.round(h.tension * 100)}%`;
        }
        if (staminaFillRef.current) {
          staminaFillRef.current.style.width = `${Math.round(h.stamina * 100)}%`;
        }
        if (fishInfoRef.current) {
          if (h.phase === "fighting") {
            fishInfoRef.current.textContent = `До рыбы: ${formatDistance(
              h.fishDistance
            )} · ≈${formatWeightPlain(Math.max(0.01, Math.round(h.fishWeight * 10) / 10))} кг`;
          } else {
            fishInfoRef.current.textContent = "";
          }
        }
      }),
    [registerHud]
  );

  const drag = sim.currentDrag;
  const maxDrag = sim.rod.maxDrag;

  return (
    <div className="hud hud-bottom-right">
      <div className="hud-card">
        <div className="cast-info" ref={castInfoRef} />
        <div className="hud-row drag-row">
          <span className="hud-label">Фрикцион:</span>
          <button className="mini-btn" onClick={() => adjustDrag(-0.5)} aria-label="Уменьшить">
            −
          </button>
          <span className="hud-value">
            {drag.toFixed(1).replace(".", ",")} кг
          </span>
          <button className="mini-btn" onClick={() => adjustDrag(0.5)} aria-label="Увеличить">
            +
          </button>
          <span className="hud-sub">макс {maxDrag}</span>
        </div>
        <div className="tension-wrap" ref={tensionWrapRef} style={{ display: "none" }}>
          <div className="meter-label">
            Натяжение <span ref={tensionNumRef}>0%</span>
          </div>
          <div className="tension-bar">
            <div className="tension-zones" />
            <div className="tension-fill" ref={tensionFillRef} />
          </div>
          <div className="meter-label">Силы рыбы</div>
          <div className="stamina-bar">
            <div className="stamina-fill" ref={staminaFillRef} />
          </div>
          <div className="hud-sub fish-info" ref={fishInfoRef} />
        </div>
        {(phase === "fighting" || phase === "waiting") && (
          <div className="hud-sub dim">
            {phase === "waiting" ? `Леска: ${sim.line.ratingKg} кг` : ""}
          </div>
        )}
      </div>
    </div>
  );
}

export function FloatMagnifier() {
  const { registerHud } = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      registerHud((h) => {
        const canvas = canvasRef.current;
        const wrap = wrapRef.current;
        if (!wrap) return;
        const show =
          h.phase === "waiting" ||
          h.phase === "investigating" ||
          h.phase === "strike" ||
          h.phase === "retrieving";
        wrap.style.display = show ? "" : "none";
        if (!canvas || !show) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const w = canvas.width;
        const hh = canvas.height;
        const t = performance.now() / 1000;
        const grad = ctx.createLinearGradient(0, 0, 0, hh);
        grad.addColorStop(0, "#4f7d86");
        grad.addColorStop(0.45, "#3c6b74");
        grad.addColorStop(1, "#274f5a");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, hh);
        ctx.strokeStyle = "rgba(220,240,240,0.25)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const ry = hh * 0.28 + i * 16 + Math.sin(t * 1.2 + i) * 3;
          ctx.beginPath();
          ctx.ellipse(w / 2, ry, w * (0.32 + i * 0.14), 5 + i * 2, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        const dip = -h.floatY;
        const cx = w / 2;
        const baseY = hh * 0.52;
        const y = baseY + dip * hh * 2.4;
        ctx.save();
        ctx.translate(cx, y);
        ctx.rotate(Math.min(0.9, dip * 1.6));
        ctx.fillStyle = "#f2efe6";
        ctx.fillRect(-4, -8, 8, 26);
        ctx.fillStyle = "#e0602c";
        ctx.beginPath();
        ctx.ellipse(0, -16, 9, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f0d34a";
        ctx.fillRect(-9, -26, 18, 5);
        ctx.fillStyle = "#e23b2c";
        ctx.fillRect(-3, -52, 6, 28);
        ctx.beginPath();
        ctx.arc(0, -54, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        if (h.strikeProgress > 0) {
          ctx.strokeStyle = "rgba(255,90,70,0.9)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(w / 2, hh / 2, w / 2 - 6, -Math.PI / 2, -Math.PI / 2 + (1 - h.strikeProgress) * Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,0.75)";
          for (let i = 0; i < 5; i++) {
            const bx = cx + Math.sin(t * 6 + i * 1.7) * 20;
            const by = y + 14 + ((t * 30 + i * 17) % 40);
            ctx.beginPath();
            ctx.arc(bx, by, 2 + (i % 2), 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (h.floatNibble > 0.15) {
          ctx.strokeStyle = "rgba(220,240,240,0.4)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(cx, baseY + 10, 26 + h.floatNibble * 10, 6, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }),
    [registerHud]
  );

  return (
    <div className="hud mag-wrap" ref={wrapRef}>
      <div className="mag-circle">
        <canvas ref={canvasRef} width={132} height={132} className="mag-canvas" />
      </div>
      <div className="mag-label">Поплавок</div>
    </div>
  );
}

export function Toolbar() {
  const { openPanel, panel, profile } = useGame();
  const items: Array<{ id: "bait" | "keepnet" | "shop" | "records" | "settings"; label: string }> = [
    { id: "bait", label: "Наживка" },
    { id: "keepnet", label: "Садок" },
    { id: "shop", label: "Магазин" },
    { id: "records", label: "Рекорды" },
    { id: "settings", label: "Настройки" },
  ];
  return (
    <div className="hud toolbar">
      {items.map((it) => (
        <button
          key={it.id}
          className={`game-btn toolbar-btn ${panel === it.id ? "active" : ""}`}
          onClick={() => openPanel(it.id)}
        >
          {it.label}
          {it.id === "keepnet" && profile.keepnet.length > 0 && (
            <span className="badge">{profile.keepnet.length}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Toasts() {
  const { toasts } = useGame();
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
