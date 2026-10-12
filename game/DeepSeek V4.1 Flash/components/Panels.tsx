"use client";

import { useState } from "react";
import { BAITS, KEEPNETS, LINES, RODS, SPECIES, SPECIES_MAP, levelFromXp } from "@/lib/game/data";
import {
  formatCm,
  formatKg,
  formatMoney,
  formatTime,
  formatWeightPlain,
} from "@/lib/game/format";
import type { QualityId } from "@/lib/game/types";
import { useGame } from "./gameContext";

function PanelShell({
  title,
  children,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const { closePanel } = useGame();
  return (
    <div className={`panel ${wide ? "panel-wide" : ""}`}>
      <div className="panel-header">
        <h2>{title}</h2>
        <button className="game-btn close-btn" onClick={closePanel} aria-label="Закрыть">
          ✕
        </button>
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}

function BaitPanel() {
  const { profile, selectBait, phase } = useGame();
  const canSwitch = phase === "ready";
  return (
    <PanelShell title="Наживка">
      {!canSwitch && (
        <div className="panel-note">
          Сменить наживку можно, когда снасть вымотана на берег.
        </div>
      )}
      <div className="bait-list">
        {BAITS.map((b) => {
          const count = profile.bait[b.id];
          const selected = profile.selectedBait === b.id;
          return (
            <div key={b.id} className={`bait-row ${selected ? "selected" : ""}`}>
              <div className="bait-dot" data-bait={b.id} />
              <div className="bait-info">
                <div className="bait-name">
                  {b.nameRu}
                  <span className="bait-count">в наличии: {count} шт.</span>
                </div>
                <div className="bait-descr">{b.descr}</div>
                <div className="bait-for">Подходит: {b.bestForRu}</div>
              </div>
              <button
                className="game-btn"
                disabled={!canSwitch || selected}
                onClick={() => selectBait(b.id)}
              >
                {selected ? "Выбрана" : "Выбрать"}
              </button>
            </div>
          );
        })}
      </div>
    </PanelShell>
  );
}

function KeepnetPanel() {
  const { profile, sellAll, sim } = useGame();
  const capacity = KEEPNETS[profile.keepnetIndex].capacity;
  const totalWeight = profile.keepnet.reduce((a, f) => a + f.weight, 0);
  const totalValue = profile.keepnet.reduce((a, f) => a + f.value, 0);
  return (
    <PanelShell title="Садок" wide>
      <div className="keepnet-summary">
        <div className="kv">
          <span>Рыб в садке:</span>
          <b>
            {profile.keepnet.length} / {capacity}
          </b>
        </div>
        <div className="kv">
          <span>Общий вес:</span>
          <b>{formatKg(totalWeight)}</b>
        </div>
        <div className="kv">
          <span>Стоимость:</span>
          <b>{formatMoney(totalValue)}</b>
        </div>
      </div>
      <div className="capacity-bar">
        <div
          className="capacity-fill"
          style={{ width: `${Math.min(100, (profile.keepnet.length / capacity) * 100)}%` }}
        />
      </div>
      {profile.keepnet.length === 0 ? (
        <div className="panel-note">Садок пуст. Оставляйте пойманную рыбу, чтобы продать её позже.</div>
      ) : (
        <div className="keepnet-list">
          {profile.keepnet.map((f, i) => {
            const sp = SPECIES_MAP[f.speciesId];
            return (
              <div key={i} className="keepnet-row">
                <span className="fish-name">{sp.nameRu}</span>
                <span>{formatKg(f.weight)}</span>
                <span>{formatCm(f.length)}</span>
                <span className="dim">в {formatTime(f.caughtAtHour)}</span>
                <span className="money">{formatMoney(f.value)}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="panel-actions">
        <button
          className="game-btn primary"
          disabled={profile.keepnet.length === 0}
          onClick={sellAll}
        >
          Продать всю рыбу {profile.keepnet.length > 0 ? `(${formatMoney(totalValue)})` : ""}
        </button>
        <span className="dim small">Продажа зачислит деньги один раз и очистит садок.</span>
      </div>
      <div className="dim small">
        Текущая снасть: {sim.rod.nameRu} · {sim.line.nameRu}
      </div>
    </PanelShell>
  );
}

function ShopPanel() {
  const { profile, buy } = useGame();

  const baitRows = BAITS.map((b) => {
    const affordable = profile.money >= b.pricePer10;
    return (
      <div key={b.id} className="shop-row">
        <div className="shop-info">
          <div className="shop-name">{b.nameRu} × 10 шт.</div>
          <div className="dim small">{b.descr}</div>
        </div>
        <button
          className="game-btn"
          disabled={!affordable}
          onClick={() => buy(`bait:${b.id}`)}
        >
          {formatMoney(b.pricePer10)}
        </button>
      </div>
    );
  });

  const tierRows = (
    kind: "rod" | "line" | "keepnet",
    list: Array<{ nameRu: string; descr: string; price: number }>
  ) =>
    list.map((item, i) => {
      const cur =
        kind === "rod"
          ? profile.rodIndex
          : kind === "line"
            ? profile.lineIndex
            : profile.keepnetIndex;
      const owned = i <= cur;
      const isNext = i === cur + 1;
      const affordable = profile.money >= item.price;
      return (
        <div key={i} className="shop-row">
          <div className="shop-info">
            <div className="shop-name">{item.nameRu}</div>
            <div className="dim small">{item.descr}</div>
          </div>
          {owned ? (
            <span className="owned-tag">{i === cur ? "Активно" : "Куплено"}</span>
          ) : (
            <button
              className="game-btn"
              disabled={!isNext || !affordable}
              onClick={() => buy(`${kind}:${i}`)}
            >
              {isNext ? formatMoney(item.price) : "Недоступно"}
            </button>
          )}
        </div>
      );
    });

  return (
    <PanelShell title="Магазин" wide>
      <div className="dim">Баланс: {formatMoney(profile.money)}</div>
      <h3 className="shop-section">Наживка</h3>
      {baitRows}
      <h3 className="shop-section">Удилища</h3>
      {tierRows(
        "rod",
        RODS.map((r) => ({ nameRu: r.nameRu, descr: r.descr, price: r.price }))
      )}
      <h3 className="shop-section">Леска</h3>
      {tierRows(
        "line",
        LINES.map((l) => ({ nameRu: l.nameRu, descr: l.descr, price: l.price }))
      )}
      <h3 className="shop-section">Садок</h3>
      {tierRows(
        "keepnet",
        KEEPNETS.map((k) => ({ nameRu: k.nameRu, descr: k.descr, price: k.price }))
      )}
      <div className="dim small">
        Улучшения снастей сразу меняют дальность заброса, скорость подмотки, прочность лески и
        вместимость садка.
      </div>
    </PanelShell>
  );
}

function RecordsPanel() {
  const { profile } = useGame();
  const { level } = levelFromXp(profile.xp);
  const outcomes: Record<string, string> = {
    kept: "В садок",
    released: "Отпущена",
    sold: "Продана",
    escaped: "Сошла",
    broke: "Обрыв",
  };
  const history = [...profile.history].slice(-12).reverse();
  return (
    <PanelShell title="Рекорды" wide>
      <div className="keepnet-summary">
        <div className="kv">
          <span>Уровень:</span>
          <b>{level}</b>
        </div>
        <div className="kv">
          <span>Всего поймано:</span>
          <b>{profile.stats.totalCaught}</b>
        </div>
        <div className="kv">
          <span>Отпущено:</span>
          <b>{profile.stats.totalReleased}</b>
        </div>
        <div className="kv">
          <span>Самая крупная:</span>
          <b>
            {profile.stats.biggestSpeciesId
              ? `${SPECIES_MAP[profile.stats.biggestSpeciesId].nameRu} · ${formatKg(
                  profile.stats.biggestWeight
                )}`
              : "—"}
          </b>
        </div>
        <div className="kv">
          <span>Заработано:</span>
          <b>{formatMoney(profile.stats.totalEarned)}</b>
        </div>
      </div>
      <h3 className="shop-section">Личные рекорды по видам</h3>
      <div className="records-list">
        {SPECIES.map((sp) => {
          const rec = profile.records[sp.id];
          return (
            <div key={sp.id} className="record-row">
              <span className="fish-name">{sp.nameRu}</span>
              {rec ? (
                <>
                  <span>{formatKg(rec.weight)}</span>
                  <span>{formatCm(rec.length)}</span>
                  <span className="dim">в {formatTime(rec.atHour)}</span>
                  <span className="dim">на {BAITS.find((b) => b.id === rec.baitId)?.nameRu}</span>
                </>
              ) : (
                <span className="dim">Рекорд ещё не установлен</span>
              )}
            </div>
          );
        })}
      </div>
      <h3 className="shop-section">Последние события</h3>
      {history.length === 0 ? (
        <div className="panel-note">Пока ничего не произошло. Забросьте снасть!</div>
      ) : (
        <div className="history-list">
          {history.map((h, i) => {
            const sp = SPECIES_MAP[h.speciesId];
            return (
              <div key={i} className="history-row">
                <span className="dim">{formatTime(h.atHour)}</span>
                <span className="fish-name">{sp?.nameRu ?? h.speciesId}</span>
                <span>{formatWeightPlain(h.weight)} кг</span>
                <span
                  className={
                    h.outcome === "kept" || h.outcome === "sold"
                      ? "good"
                      : h.outcome === "released"
                        ? "dim"
                        : "bad"
                  }
                >
                  {outcomes[h.outcome] ?? h.outcome}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </PanelShell>
  );
}

function SettingsPanel() {
  const { profile, updateSettings, resetProgress, switchPanel } = useGame();
  const [confirmReset, setConfirmReset] = useState(false);
  const s = profile.settings;
  return (
    <PanelShell title="Настройки">
      <div className="setting-row">
        <label>Звук</label>
        <input
          type="checkbox"
          checked={s.sound}
          onChange={(e) => updateSettings({ sound: e.target.checked })}
        />
      </div>
      <div className="setting-row">
        <label>Громкость</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={s.volume}
          onChange={(e) => updateSettings({ volume: parseFloat(e.target.value) })}
        />
        <span className="dim">{Math.round(s.volume * 100)}%</span>
      </div>
      <div className="setting-row">
        <label>Чувствительность мыши</label>
        <input
          type="range"
          min={0.2}
          max={2.5}
          step={0.1}
          value={s.sensitivity}
          onChange={(e) => updateSettings({ sensitivity: parseFloat(e.target.value) })}
        />
        <span className="dim">{s.sensitivity.toFixed(1)}</span>
      </div>
      <div className="setting-row">
        <label>Качество графики</label>
        <select
          value={s.quality}
          onChange={(e) => updateSettings({ quality: e.target.value as QualityId })}
        >
          <option value="low">Низкое</option>
          <option value="medium">Среднее</option>
          <option value="high">Высокое</option>
        </select>
      </div>
      <div className="panel-actions">
        <button className="game-btn" onClick={() => switchPanel("pause")}>
          Назад
        </button>
        {confirmReset ? (
          <button
            className="game-btn danger"
            onClick={() => {
              resetProgress();
              setConfirmReset(false);
            }}
          >
            Точно сбросить всё?
          </button>
        ) : (
          <button className="game-btn" onClick={() => setConfirmReset(true)}>
            Сбросить прогресс
          </button>
        )}
      </div>
    </PanelShell>
  );
}

function PauseMenu() {
  const { closePanel, switchPanel } = useGame();
  return (
    <PanelShell title="Пауза">
      <div className="controls-list">
        <div>
          <b>ЛКМ удерживать</b> — замах, отпустить — заброс
        </div>
        <div>
          <b>ЛКМ при поклёвке</b> — подсечка, <b>ЛКМ удерживать</b> — подмотка
        </div>
        <div>
          <b>Мышь</b> — обзор, <b>колесо</b> — фрикцион
        </div>
        <div>
          <b>Escape</b> — пауза
        </div>
      </div>
      <div className="panel-actions">
        <button className="game-btn primary" onClick={closePanel}>
          Продолжить
        </button>
        <button className="game-btn" onClick={() => switchPanel("settings")}>
          Настройки
        </button>
      </div>
      <div className="dim small">Игра приостановлена, пока открыто меню.</div>
    </PanelShell>
  );
}

export function Panels() {
  const { panel, touch } = useGame();
  if (!panel) return null;
  return (
    <div className="overlay">
      <div className="panel-host" onPointerDown={(e) => e.stopPropagation()}>
        {panel === "bait" && <BaitPanel />}
        {panel === "keepnet" && <KeepnetPanel />}
        {panel === "shop" && <ShopPanel />}
        {panel === "records" && <RecordsPanel />}
        {panel === "settings" && <SettingsPanel />}
        {panel === "pause" && <PauseMenu />}
      </div>
      {touch ? null : <div className="overlay-hint">Escape — закрыть</div>}
    </div>
  );
}
