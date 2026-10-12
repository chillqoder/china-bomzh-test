'use client';

import React from 'react';
import { useGameStore } from '../../hooks/useGameStore';
import { formatWeight, formatLength, formatMoney, calculateSaleValue, xpForLevel } from '../../game/simulation';
import { getSpeciesById } from '../../game/species';
import { getBaitById } from '../../game/bait';
import { getKeepnetCapacity, getLineStrength, getRodPower } from '../../game/storage';

export function HUD() {
  const { game, progress, settings, activePanel, openPanel, closePanel, togglePause, isPaused } = useGameStore();
  const [reeling, setReeling] = React.useState(false);

  const species = game.bite.fishSpeciesId ? getSpeciesById(game.bite.fishSpeciesId) : null;
  const bait = getBaitById(progress.selectedBait);
  const capacity = getKeepnetCapacity(progress.equipment.keepnetLevel);
  const keepnetValue = progress.keepnet.reduce((sum, f) => sum + calculateSaleValue(f), 0);
  const keepnetWeight = progress.keepnet.reduce((sum, f) => sum + f.weight, 0);

  const getTimeString = () => {
    const hours = Math.floor(game.gameTime / 60) % 24;
    const minutes = Math.floor(game.gameTime % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const getWeatherLabel = () => {
    switch (game.weather) {
      case 'clear': return 'Ясно';
      case 'cloudy': return 'Облачно';
      case 'overcast': return 'Пасмурно';
      default: return 'Ясно';
    }
  };

  const getTimeLabel = () => {
    switch (game.timeOfDay) {
      case 'morning': return 'Утро';
      case 'day': return 'День';
      case 'evening': return 'Вечер';
      case 'night': return 'Ночь';
      default: return 'Утро';
    }
  };

  const getInstructions = () => {
    switch (game.fishingState) {
      case 'ready':
        return 'Зажмите ЛКМ для зарядки заброса. Отпустите для броска.';
      case 'charging':
        return `Заряд: ${Math.round(game.cast.power * 100)}%. Отпустите ЛКМ для заброса.`;
      case 'casting':
        return 'Приманка летит...';
      case 'waiting':
        return 'Ждём поклёвку. Следите за поплавком.';
      case 'investigating':
        return 'Рыба интересуется наживкой... Ждите.';
      case 'strike':
        return 'ПОКЛЁВКА! Нажмите ЛКМ для подсечки!';
      case 'fighting':
        return 'Держите ЛКМ для вываживания. Отпустите для ослабления.';
      case 'result':
        return 'Поздравляем! Выберите действие.';
      case 'retrieving':
        return 'Выводим снасть...';
      default:
        return '';
    }
  };

  return (
    <>
      {/* Top Left - Level, XP, Money */}
      <div className="hud-top-left">
        <div className="hud-stat">
          <span className="hud-label">Уровень</span>
          <span className="hud-value">{progress.level}</span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">Опыт</span>
          <div className="xp-bar">
            <div
              className="xp-fill"
              style={{
                width: `${((progress.xp - xpForLevel(progress.level)) / (xpForLevel(progress.level + 1) - xpForLevel(progress.level))) * 100}%`,
              }}
            />
          </div>
          <span className="hud-value">{progress.xp} XP</span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">Деньги</span>
          <span className="hud-value money">{formatMoney(progress.money)}</span>
        </div>
      </div>

      {/* Top Right - Time, Weather */}
      <div className="hud-top-right">
        <div className="hud-stat">
          <span className="hud-label">Время</span>
          <span className="hud-value">{getTimeString()}</span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">Погода</span>
          <span className="hud-value">{getWeatherLabel()}</span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">Период</span>
          <span className="hud-value">{getTimeLabel()}</span>
        </div>
      </div>

      {/* Bottom Left - Bait, Rod, Line */}
      <div className="hud-bottom-left">
        <div className="hud-stat">
          <span className="hud-label">Наживка</span>
          <span className="hud-value">{bait.name} ({progress.bait[progress.selectedBait] || 0})</span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">Удилище</span>
          <span className="hud-value">Ур. {progress.equipment.rodLevel}</span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">Леска</span>
          <span className="hud-value">{getLineStrength(progress.equipment.lineLevel)} кг</span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">Зона</span>
          <span className="hud-value">
            {game.zone === 'shallow' ? 'Мелководье' : game.zone === 'open' ? 'Открытая вода' : 'Глубина'}
          </span>
        </div>
      </div>

      {/* Bottom Center - Instructions */}
      <div className="hud-bottom-center">
        <div className="instruction-box">{getInstructions()}</div>
        {game.message && <div className="message-box">{game.message}</div>}
      </div>

      {/* Bottom Right - Cast, Drag, Tension */}
      <div className="hud-bottom-right">
        {(game.fishingState === 'charging' || game.fishingState === 'casting') && (
          <>
            <div className="hud-stat">
              <span className="hud-label">Заряд заброса</span>
              <div className="power-bar">
                <div className="power-fill" style={{ width: `${game.cast.power * 100}%` }} />
              </div>
            </div>
            <div className="hud-stat">
              <span className="hud-label">Дистанция</span>
              <span className="hud-value">{Math.round(5 + game.cast.power * 50)} м</span>
            </div>
          </>
        )}

        {(game.fishingState === 'waiting' || game.fishingState === 'investigating' || game.fishingState === 'strike') && (
          <div className="hud-stat">
            <span className="hud-label">Дистанция</span>
            <span className="hud-value">{Math.round(game.cast.distance)} м</span>
          </div>
        )}

        {game.fishingState === 'fighting' && (
          <>
            <div className="hud-stat">
              <span className="hud-label">Натяжение</span>
              <div className="tension-bar">
                <div
                  className={`tension-fill ${game.fight.tension > 0.85 ? 'critical' : game.fight.tension > 0.6 ? 'warning' : 'safe'}`}
                  style={{ width: `${game.fight.tension * 100}%` }}
                />
              </div>
              <span className="hud-value">{Math.round(game.fight.tension * 100)}%</span>
            </div>
            <div className="hud-stat">
              <span className="hud-label">Фрикцион</span>
              <div className="drag-controls">
                <button onClick={() => useGameStore.getState().setDrag(game.fight.drag - 0.1)}>-</button>
                <span className="hud-value">{Math.round(game.fight.drag * 100)}%</span>
                <button onClick={() => useGameStore.getState().setDrag(game.fight.drag + 0.1)}>+</button>
              </div>
            </div>
            <div className="hud-stat">
              <span className="hud-label">Дистанция до рыбы</span>
              <span className="hud-value">{Math.round(game.fight.fishDistance)} м</span>
            </div>
            <div className="hud-stat">
              <span className="hud-label">Силы рыбы</span>
              <div className="stamina-bar">
                <div className="stamina-fill" style={{ width: `${game.fight.fishStamina * 100}%` }} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Menu buttons */}
      <div className="hud-buttons">
        <button className="hud-btn" onClick={() => openPanel('bait')}>Наживка</button>
        <button className="hud-btn" onClick={() => openPanel('keepnet')}>Садок ({progress.keepnet.length}/{capacity})</button>
        <button className="hud-btn" onClick={() => openPanel('shop')}>Магазин</button>
        <button className="hud-btn" onClick={() => openPanel('records')}>Рекорды</button>
        <button className="hud-btn" onClick={() => openPanel('settings')}>Настройки</button>
      </div>

      {/* Retrieve button */}
      {(game.fishingState === 'waiting' || game.fishingState === 'investigating') && (
        <button
          className="action-btn retrieve-btn"
          onClick={() => useGameStore.getState().retrieve()}
        >
          Вывести снасть
        </button>
      )}

      {/* Fight reel button (touch) */}
      {game.fishingState === 'fighting' && (
        <button
          className="action-btn reel-btn"
          onPointerDown={() => setReeling(true)}
          onPointerUp={() => setReeling(false)}
          onPointerLeave={() => setReeling(false)}
        >
          {reeling ? 'ВЫВАЖИВАЕМ...' : 'КРУТИТЬ КАТУШКУ'}
        </button>
      )}

      {/* Cast button (touch) */}
      {game.fishingState === 'ready' && (
        <button
          className="action-btn cast-btn"
          onPointerDown={() => useGameStore.getState().startCharging()}
          onPointerUp={() => useGameStore.getState().cast()}
        >
          ЗАБРОС
        </button>
      )}

      {/* Hook set button (touch) */}
      {game.fishingState === 'strike' && (
        <button
          className="action-btn hook-btn"
          onClick={() => useGameStore.getState().setHook()}
        >
          ПОДСЕЧЬ!
        </button>
      )}
    </>
  );
}
