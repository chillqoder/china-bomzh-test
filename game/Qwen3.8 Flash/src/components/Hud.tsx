'use client';

import { useEffect, useRef, useState } from 'react';
import type { HudSnapshot } from '@/game/types';
import type { GameApi } from './api';
import type { PanelId } from './Game';
import { kg, meters, num, rub } from '@/game/format';

const ACTION: Record<string, { label: string; kind: 'primary' | 'danger' | 'default'; hold: boolean; disabled: boolean }> = {
  ready: { label: 'Замах — держать', kind: 'primary', hold: true, disabled: false },
  charging: { label: 'Отпустить для заброса', kind: 'primary', hold: true, disabled: false },
  casting: { label: 'Заброс…', kind: 'default', hold: false, disabled: true },
  waiting: { label: 'Подсечь', kind: 'default', hold: false, disabled: false },
  investigating: { label: 'Рано — ждать', kind: 'default', hold: false, disabled: false },
  strike: { label: 'ПОДСЕЧЬ!', kind: 'danger', hold: false, disabled: false },
  fighting: { label: 'Катушить — держать', kind: 'primary', hold: true, disabled: false },
  retrieving: { label: 'Вынимаю снасти…', kind: 'default', hold: false, disabled: true },
  result: { label: 'Смотрите трофей', kind: 'default', hold: false, disabled: true },
};

export default function Hud({
  hud,
  api,
  panel,
  onToggle,
}: {
  hud: HudSnapshot;
  api: GameApi;
  panel: PanelId;
  onToggle: (p: PanelId) => void;
}) {
  const action = ACTION[hud.phase] ?? ACTION.ready;
  const [pulse, setPulse] = useState(false);
  const holdRef = useRef(false);

  useEffect(() => {
    setPulse(hud.phase === 'strike');
  }, [hud.phase]);

  const tensionColor = hud.tension > 100 ? '#e8735a' : hud.tension > 82 ? '#f0c060' : '#7fd0b0';
  const powerColor = hud.power > 0.92 ? '#e8735a' : hud.power > 0.6 ? '#f0c060' : '#7fd0b0';
  const showFight = hud.phase === 'fighting';
  const showCast = hud.phase === 'charging' || hud.phase === 'ready' || hud.phase === 'waiting';

  const pressProps = action.hold
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          e.preventDefault();
          holdRef.current = true;
          api.press();
        },
        onPointerUp: () => {
          if (holdRef.current) api.release();
          holdRef.current = false;
        },
        onPointerLeave: () => {
          if (holdRef.current) api.release();
          holdRef.current = false;
        },
        onPointerCancel: () => {
          if (holdRef.current) api.release();
          holdRef.current = false;
        },
      }
    : {
        onClick: () => {
          api.press();
          api.release();
        },
      };

  return (
    <div className="hud">
      <div className={`pulse-frame${pulse ? ' on' : ''}`} />

      {/* top left: progress */}
      <div className="card top-left">
        <div className="stat-row">
          <span className="chip">
            Уровень <b>{hud.level}</b>
          </span>
          <span className="chip">
            Деньги <b>{rub(hud.money)}</b>
          </span>
        </div>
        <div className="bar" style={{ marginTop: 8 }}>
          <i style={{ width: `${Math.round(hud.levelProgress * 100)}%`, background: 'var(--accent-2)' }} />
        </div>
        <div className="stat-row" style={{ marginTop: 6, color: 'var(--muted)' }}>
          <span>Опыт: {num(hud.xp, 0)} · до {hud.level + 1} ур. ещё {num(hud.xpToNext, 0)}</span>
          <span>Забросов: {hud.castCount}</span>
        </div>
      </div>

      {/* top right: clock + menu */}
      <div className="top-right">
        <div className="card stat-row">
          <span className="chip">
            Время <b>{hud.timeLabel}</b>
          </span>
          <span className="chip">{hud.weather}</span>
        </div>
        <div className="menu-col">
          <button className="small ghost" onClick={() => onToggle('bait')} aria-pressed={panel === 'bait'}>
            Наживка
          </button>
          <button className="small ghost" onClick={() => onToggle('net')} aria-pressed={panel === 'net'}>
            Садок · {hud.netCount}
          </button>
          <button className="small ghost" onClick={() => onToggle('shop')} aria-pressed={panel === 'shop'}>
            Магазин
          </button>
          <button className="small ghost" onClick={() => onToggle('records')} aria-pressed={panel === 'records'}>
            Рекорды
          </button>
          <button className="small ghost" onClick={() => onToggle('settings')} aria-pressed={panel === 'settings'}>
            Настройки
          </button>
        </div>
      </div>

      {/* toast */}
      {hud.message && <div className={`toast ${hud.message.kind}`}>{hud.message.text}</div>}

      {/* bottom left: tackle */}
      <div className="card bottom-left">
        <div className="stat-row">
          <span className="chip">
            {hud.baitName} <b>{hud.baitLeft}</b>
          </span>
        </div>
        <div style={{ marginTop: 6, color: 'var(--muted)' }}>{hud.rodName}</div>
        <div style={{ color: 'var(--muted)' }}>
          {hud.lineName} · обрыв при {num(hud.lineStrength, 1)} кг
        </div>
        <div style={{ color: 'var(--muted)' }}>
          {hud.netName}: {hud.netCount}/{hud.netCapacity} · {kg(hud.netWeight)}
        </div>
      </div>

      {/* bottom center: state + action */}
      <div className="bottom-center">
        <div className="phase-label">{hud.phaseLabel}</div>
        <div className="card instructions">
          {hud.instructions.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
          <div className="notice" style={{ marginTop: 4 }}>
            Мышь: обзор и заброс · колесо: фрикцион · Esc: пауза
          </div>
        </div>
        <div className="action-row">
          <button
            className={`action-main ${action.kind === 'primary' ? 'primary' : action.kind === 'danger' ? 'danger' : ''}`}
            disabled={action.disabled}
            {...pressProps}
          >
            {action.label}
          </button>
          <button
            className="ghost"
            disabled={!hud.canRetrieve}
            onClick={() => api.retrieve()}
            title="Вынуть оснастку из воды"
          >
            Снасти
          </button>
          <button className="ghost" onClick={() => api.aim(-0.14)} title="Повернуть влево">
            ◀
          </button>
          <button className="ghost" onClick={() => api.aim(0.14)} title="Повернуть вправо">
            ▶
          </button>
        </div>
      </div>

      {/* bottom right: numbers */}
      <div className="card bottom-right">
        {showCast && (
          <div className="metric">
            <span className="label">Дальность</span>
            <span className="value">
              {hud.phase === 'charging'
                ? `${num(hud.estimatedDistance, 0)} м`
                : hud.rigDistance > 0
                  ? `${num(hud.rigDistance, 0)} м`
                  : '—'}
            </span>
          </div>
        )}
        {hud.zoneName !== '—' && (
          <div className="metric">
            <span className="label">Точка</span>
            <span className="value" style={{ fontSize: '0.74rem' }}>
              {hud.zoneName} · {num(hud.depth, 1)} м
            </span>
          </div>
        )}
        {hud.phase === 'charging' && (
          <>
            <div className="metric">
              <span className="label">Мощность</span>
              <span className="value">{num(hud.power * 100, 0)}%</span>
            </div>
            <div className="bar tall">
              <i style={{ width: `${Math.round(hud.power * 100)}%`, background: powerColor }} />
            </div>
          </>
        )}
        {hud.phase === 'waiting' && (
          <>
            <div className="metric">
              <span className="label">Ждём поклёвку</span>
              <span className="value">≈ {Math.ceil(hud.waitRemaining)} с</span>
            </div>
            <div className="bar">
              <i
                style={{
                  width: `${Math.round((1 - hud.waitRemaining / Math.max(0.001, hud.waitTotal)) * 100)}%`,
                  background: 'var(--accent)',
                }}
              />
            </div>
          </>
        )}
        {(hud.phase === 'investigating' || hud.phase === 'strike') && (
          <div className="bar tall">
            <i
              style={{
                width: `${Math.round((hud.phase === 'strike' ? 1 - hud.strikeRemaining / Math.max(0.001, hud.strikeTotal) : hud.biteProgress) * 100)}%`,
                background: hud.phase === 'strike' ? '#e8735a' : '#f0c060',
              }}
            />
          </div>
        )}
        {(hud.phase === 'investigating' || hud.phase === 'strike') && (
          <div className="metric">
            <span className="label">Поклёвка</span>
            <span className="value" style={{ color: '#ffdfa0' }}>
              {hud.phase === 'strike' ? 'РЕШИТЕЛЬНАЯ' : 'пробует'}
            </span>
          </div>
        )}

        <div className="metric">
          <span className="label">Фрикцион</span>
          <span className="value">
            <button className="small ghost" onClick={() => api.adjustDrag(-1)} aria-label="Ослабить фрикцион">
              −
            </button>{' '}
            {hud.drag}/10{' '}
            <button className="small ghost" onClick={() => api.adjustDrag(1)} aria-label="Затянуть фрикцион">
              +
            </button>
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={hud.drag}
          onChange={(e) => api.setDrag(Number(e.target.value))}
          aria-label="Настройка фрикциона"
          style={{ width: '100%' }}
        />

        {showFight && (
          <>
            <div className="metric">
              <span className="label">Натяжение лески</span>
              <span className="value" style={{ color: tensionColor }}>
                {num(hud.tension, 0)}% · {num((hud.tension / 100) * hud.tensionLimit, 1)} кг
              </span>
            </div>
            <div className="bar tall" style={{ position: 'relative' }}>
              <i style={{ width: `${Math.min(100, hud.tension)}%`, background: tensionColor }} />
              <span style={{ position: 'absolute', left: '60%', top: -2, bottom: -2, width: 1, background: 'rgba(240,192,96,.75)' }} />
              <span style={{ position: 'absolute', left: '85%', top: -2, bottom: -2, width: 1, background: 'rgba(232,115,90,.8)' }} />
            </div>
            <div className="metric">
              <span className="label">Дистанция до рыбы</span>
              <span className="value">{meters(hud.fishDistance, 1)}</span>
            </div>
            <div className="metric">
              <span className="label">Силы рыбы</span>
              <span className="value">{num(hud.fishStamina * 100, 0)}%</span>
            </div>
            <div className="bar">
              <i style={{ width: `${Math.round(hud.fishStamina * 100)}%`, background: '#e2a05f' }} />
            </div>
            <div className="metric">
              <span className="label">{hud.hookedSpeciesName ?? 'Рыба'}</span>
              <span className="value" style={{ fontSize: '0.74rem' }}>
                {hud.fishBehaviour}
              </span>
            </div>
          </>
        )}
        {showFight && (
          <div className="notice">
            Безопасно до 60%, опасно до 85%, выше — леска на пределе. Слабая леска: рыба может сойти.
          </div>
        )}
      </div>

      {/* bite alert that does not rely on text alone */}
      {(hud.phase === 'investigating' || hud.phase === 'strike') && (
        <div className="bite-hint">{hud.phase === 'strike' ? 'КЛЮЁТ' : 'ПОКЛЁВКА'}</div>
      )}
    </div>
  );
}
