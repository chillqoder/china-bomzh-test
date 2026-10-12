'use client';

import React from 'react';
import { useGameStore } from '../../hooks/useGameStore';
import { BAITS, getBaitById } from '../../game/bait';
import { SPECIES, getSpeciesById } from '../../game/species';
import { formatWeight, formatLength, formatMoney, calculateSaleValue, calculateLevel, xpForLevel } from '../../game/simulation';
import { getKeepnetCapacity, getLineStrength, getRodPower } from '../../game/storage';
import { SHOP_ITEMS } from '../../game/shop';
import { CaughtFish, GameSettings } from '../../game/types';

export function BaitPanel() {
  const { progress, selectBait, closePanel } = useGameStore();

  return (
    <div className="panel-overlay">
      <div className="panel">
        <div className="panel-header">
          <h2>Выбор наживки</h2>
          <button className="close-btn" onClick={closePanel}>×</button>
        </div>
        <div className="panel-content">
          {BAITS.map((bait) => (
            <div
              key={bait.id}
              className={`bait-item ${progress.selectedBait === bait.id ? 'selected' : ''}`}
              onClick={() => selectBait(bait.id)}
            >
              <div className="bait-header">
                <span className="bait-name">{bait.name}</span>
                <span className="bait-qty">Осталось: {progress.bait[bait.id] || 0}</span>
              </div>
              <p className="bait-desc">{bait.description}</p>
              <div className="bait-species">
                Подходит для: {bait.suitableFor.map((id) => getSpeciesById(id).nameRu).join(', ')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function KeepnetPanel() {
  const { progress, sellKeepnet, closePanel } = useGameStore();
  const capacity = getKeepnetCapacity(progress.equipment.keepnetLevel);
  const totalWeight = progress.keepnet.reduce((sum, f) => sum + f.weight, 0);
  const totalValue = progress.keepnet.reduce((sum, f) => sum + calculateSaleValue(f), 0);

  return (
    <div className="panel-overlay">
      <div className="panel">
        <div className="panel-header">
          <h2>Садок</h2>
          <button className="close-btn" onClick={closePanel}>×</button>
        </div>
        <div className="panel-content">
          <div className="keepnet-summary">
            <div className="summary-stat">
              <span>Количество:</span>
              <span>{progress.keepnet.length} / {capacity}</span>
            </div>
            <div className="summary-stat">
              <span>Общий вес:</span>
              <span>{formatWeight(totalWeight)}</span>
            </div>
            <div className="summary-stat">
              <span>Стоимость:</span>
              <span className="money">{formatMoney(totalValue)}</span>
            </div>
          </div>

          {progress.keepnet.length > 0 && (
            <button className="sell-btn" onClick={sellKeepnet}>
              Продать всю рыбу ({formatMoney(totalValue)})
            </button>
          )}

          <div className="keepnet-list">
            {progress.keepnet.length === 0 ? (
              <p className="empty-message">Садок пуст</p>
            ) : (
              progress.keepnet.map((fish: CaughtFish) => (
                <div key={fish.id} className="keepnet-item">
                  <span className="fish-species">{getSpeciesById(fish.speciesId).nameRu}</span>
                  <span className="fish-weight">{formatWeight(fish.weight)}</span>
                  <span className="fish-length">{formatLength(fish.length)}</span>
                  <span className="fish-value">{formatMoney(calculateSaleValue(fish))}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ShopPanel() {
  const { progress, purchaseItem, closePanel } = useGameStore();

  return (
    <div className="panel-overlay">
      <div className="panel">
        <div className="panel-header">
          <h2>Магазин снастей</h2>
          <button className="close-btn" onClick={closePanel}>×</button>
        </div>
        <div className="panel-content">
          <div className="shop-money">
            Ваш баланс: <span className="money">{formatMoney(progress.money)}</span>
          </div>

          <div className="shop-items">
            {SHOP_ITEMS.map((item) => {
              const canAfford = progress.money >= item.price;
              const hasLevel = progress.level >= item.level;
              const isMaxed =
                (item.type === 'line' && progress.equipment.lineLevel >= 4) ||
                (item.type === 'rod' && progress.equipment.rodLevel >= 4) ||
                (item.type === 'keepnet' && progress.equipment.keepnetLevel >= 4);

              return (
                <div key={item.id} className={`shop-item ${!canAfford || !hasLevel || isMaxed ? 'disabled' : ''}`}>
                  <div className="shop-item-header">
                    <span className="shop-item-name">{item.name}</span>
                    <span className="shop-item-price">{formatMoney(item.price)}</span>
                  </div>
                  <p className="shop-item-desc">{item.description}</p>
                  <div className="shop-item-effect">{item.effect}</div>
                  {item.level > 1 && (
                    <div className="shop-item-level">Требуется уровень: {item.level}</div>
                  )}
                  <button
                    className="buy-btn"
                    disabled={!canAfford || !hasLevel || isMaxed}
                    onClick={() => purchaseItem(item.id)}
                  >
                    {isMaxed ? 'Максимум' : 'Купить'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RecordsPanel() {
  const { progress, closePanel } = useGameStore();

  return (
    <div className="panel-overlay">
      <div className="panel">
        <div className="panel-header">
          <h2>Рекорды и статистика</h2>
          <button className="close-btn" onClick={closePanel}>×</button>
        </div>
        <div className="panel-content">
          <div className="records-summary">
            <div className="summary-stat">
              <span>Всего поймано:</span>
              <span>{progress.totalCatches}</span>
            </div>
            <div className="summary-stat">
              <span>Отпущено:</span>
              <span>{progress.totalReleased}</span>
            </div>
            <div className="summary-stat">
              <span>Продано:</span>
              <span>{progress.totalSold}</span>
            </div>
          </div>

          <h3>Рекорды по видам</h3>
          <div className="records-list">
            {SPECIES.map((species) => {
              const record = progress.records[species.id];
              return (
                <div key={species.id} className="record-item">
                  <span className="record-species">{species.nameRu}</span>
                  <span className="record-weight">
                    {record ? formatWeight(record) : '—'}
                  </span>
                  {record && record >= species.trophyThreshold && (
                    <span className="trophy-badge">🏆</span>
                  )}
                </div>
              );
            })}
          </div>

          <h3>История последних уловов</h3>
          <div className="history-list">
            {progress.history.length === 0 ? (
              <p className="empty-message">История пуста</p>
            ) : (
              progress.history.slice(0, 10).map((fish: CaughtFish, i: number) => (
                <div key={fish.id} className="history-item">
                  <span>{getSpeciesById(fish.speciesId).nameRu}</span>
                  <span>{formatWeight(fish.weight)}</span>
                  <span>{new Date(fish.caughtAt).toLocaleDateString('ru-RU')}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsPanel() {
  const { settings, updateSettings, closePanel } = useGameStore();

  return (
    <div className="panel-overlay">
      <div className="panel">
        <div className="panel-header">
          <h2>Настройки</h2>
          <button className="close-btn" onClick={closePanel}>×</button>
        </div>
        <div className="panel-content">
          <div className="setting-item">
            <label>Звук</label>
            <button
              className={`toggle-btn ${settings.soundEnabled ? 'on' : 'off'}`}
              onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
            >
              {settings.soundEnabled ? 'Включён' : 'Выключен'}
            </button>
          </div>

          <div className="setting-item">
            <label>Чувствительность мыши</label>
            <input
              type="range"
              min="0.3"
              max="2"
              step="0.1"
              value={settings.mouseSensitivity}
              onChange={(e) => updateSettings({ mouseSensitivity: parseFloat(e.target.value) })}
            />
            <span>{settings.mouseSensitivity.toFixed(1)}</span>
          </div>

          <div className="setting-item">
            <label>Качество графики</label>
            <div className="quality-buttons">
              {(['low', 'medium', 'high'] as const).map((q) => (
                <button
                  key={q}
                  className={`quality-btn ${settings.graphicsQuality === q ? 'active' : ''}`}
                  onClick={() => updateSettings({ graphicsQuality: q })}
                >
                  {q === 'low' ? 'Низкое' : q === 'medium' ? 'Среднее' : 'Высокое'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ResultPanel() {
  const { game, keepFish, releaseFish } = useGameStore();

  if (!game.lastCatch) return null;

  const species = getSpeciesById(game.lastCatch.speciesId);
  const bait = getBaitById(game.lastCatch.baitId);
  const value = calculateSaleValue(game.lastCatch);

  return (
    <div className="panel-overlay result-overlay">
      <div className="panel result-panel">
        <div className="panel-header">
          <h2>Улов!</h2>
        </div>
        <div className="panel-content result-content">
          {/* 3D preview placeholder - actual 3D shown in scene */}
          <div className="fish-preview">
            <div
              className="fish-color-preview"
              style={{ backgroundColor: species.color }}
            />
          </div>

          <div className="result-info">
            <h3 className="result-species">{species.nameRu}</h3>

            {game.isRecord && <div className="record-badge">Новый рекорд!</div>}
            {game.isTrophy && <div className="trophy-badge-large">🏆 Трофейный экземпляр!</div>}

            <div className="result-stats">
              <div className="result-stat">
                <span>Вес:</span>
                <span>{formatWeight(game.lastCatch.weight)}</span>
              </div>
              <div className="result-stat">
                <span>Длина:</span>
                <span>{formatLength(game.lastCatch.length)}</span>
              </div>
              <div className="result-stat">
                <span>Наживка:</span>
                <span>{bait.name}</span>
              </div>
              <div className="result-stat">
                <span>Время:</span>
                <span>{new Date(game.lastCatch.caughtAt).toLocaleTimeString('ru-RU')}</span>
              </div>
              <div className="result-stat">
                <span>Стоимость:</span>
                <span className="money">{formatMoney(value)}</span>
              </div>
            </div>
          </div>

          <div className="result-actions">
            <button className="action-btn keep-btn" onClick={keepFish}>
              Оставить
            </button>
            <button className="action-btn release-btn" onClick={releaseFish}>
              Отпустить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
