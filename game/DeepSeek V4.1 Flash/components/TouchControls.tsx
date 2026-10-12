"use client";

import { useGame } from "./gameContext";

export function TouchControls() {
  const { touch, phase, primaryDown, primaryUp, startRetrieve, adjustDrag } = useGame();
  if (!touch) return null;

  const contextLabel =
    phase === "ready"
      ? "Заброс"
      : phase === "charging"
        ? "Отпустите"
        : phase === "investigating"
          ? "Рано!"
          : phase === "strike"
            ? "ПОДСЕЧЬ!"
            : phase === "fighting"
              ? "Подмотка"
              : null;

  return (
    <div className="touch-controls">
      {(phase === "waiting" || phase === "investigating") && (
        <button className="game-btn touch-btn" onClick={startRetrieve}>
          Вымотать
        </button>
      )}
      <div className="touch-drag">
        <button className="mini-btn big-mini" onClick={() => adjustDrag(-0.5)}>
          −
        </button>
        <span className="touch-drag-label">Фрикцион</span>
        <button className="mini-btn big-mini" onClick={() => adjustDrag(0.5)}>
          +
        </button>
      </div>
      {contextLabel && (
        <button
          className={`game-btn touch-btn primary ${
            phase === "strike" ? "strike-btn" : ""
          }`}
          onPointerDown={(e) => {
            e.preventDefault();
            primaryDown();
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            primaryUp();
          }}
          onPointerCancel={() => primaryUp()}
          onPointerLeave={() => primaryUp()}
        >
          {contextLabel}
        </button>
      )}
    </div>
  );
}
