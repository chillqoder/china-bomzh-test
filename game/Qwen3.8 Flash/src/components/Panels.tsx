'use client';

import { useEffect, useRef, useState } from 'react';
import type { GameApi } from './api';
import type { HudSnapshot } from '@/game/types';
import { SPECIES } from '@/game/species';
import { BAITS } from '@/game/bait';
import { LINES, NETS, RODS } from '@/game/equipment';
import { clockLabel, cm, kg, meters, num, rub } from '@/game/format';

function Frame({
  title,
  sub,
  close,
  children,
  wide,
}: {
  title: string;
  sub?: string;
  close: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="panel" style={wide ? { width: 'min(760px, 96vw)' } : undefined}>
        <div className="panel-head">
          <div>
            <h2>{title}</h2>
            {sub && <div className="sub">{sub}</div>}
          </div>
          <button className="ghost" onClick={close}>
            Закрыть (Esc)
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------------------------- bait ---------------------------------- */

export function BaitPanel({ api, close }: { api: GameApi; close: () => void }) {
  const sim = api.sim();
  const rows = sim?.baitView() ?? [];
  return (
    <Frame title="Наживка" sub="Одна насадка расходуется на заброс. Рыба может её украсть при промахе." close={close} wide>
      <div className="list">
        {rows.map((b) => (
          <div key={b.id} className={`row${b.active ? ' active' : ''}`}>
            <div>
              <div className="title">
                {b.ru} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {b.left} шт.</span>
              </div>
              <div className="desc">{b.desc}</div>
              <div className="badges" style={{ marginTop: 6 }}>
                {b.suits.map((s) => (
                  <span key={s} className="badge">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="right">
              <button className={b.active ? 'primary' : 'ghost'} disabled={b.left === 0} onClick={() => api.selectBait(b.id)}>
                {b.active ? 'На крючке' : 'Надеть'}
              </button>
              <span className="notice">{rub(b.price)} / пачка</span>
            </div>
          </div>
        ))}
      </div>
      <p className="notice" style={{ marginTop: 12 }}>
        Наживка определяет, какая рыба откликнется: червь — карась, окунь, лещ; опарыш — плотва и подлещик;
        кукуруза — карась и карп; живец — щука и крупный окунь. Зона и время суток меняют всё не меньше.
      </p>
    </Frame>
  );
}

/* --------------------------------- keepnet -------------------------------- */

export function KeepnetPanel({ api, close, hud }: { api: GameApi; close: () => void; hud: HudSnapshot }) {
  const sim = api.sim();
  const fish = sim?.save.keepnet ?? [];
  return (
    <Frame
      title="Садок"
      sub={`${hud.netCount} из ${hud.netCapacity} · общий вес ${kg(hud.netWeight)} · оценка ${rub(hud.netValue)}`}
      close={close}
    >
      {fish.length === 0 ? (
        <p className="notice">Садок пуст. Оставьте рыбу после поимки — и она появится здесь.</p>
      ) : (
        <div className="list">
          {fish.map((f, i) => (
            <div className="row" key={f.uid + i}>
              <div>
                <div className="title">
                  {SPECIES[f.species].ru}
                  {f.trophy && <span className="badge trophy" style={{ marginLeft: 8 }}>Трофей</span>}
                </div>
                <div className="desc">
                  {kg(f.weight)} · {cm(f.length)} · {BAITS[f.bait].ru} · {clockLabel(f.hour)} · {f.zone}
                </div>
              </div>
              <div className="right">{rub(f.value)}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="notice">Продажа зачисляет деньги один раз и освобождает садок.</span>
        <button className="primary" disabled={fish.length === 0} onClick={() => api.sell()}>
          Продать всё · {rub(hud.netValue)}
        </button>
      </div>
    </Frame>
  );
}

/* ---------------------------------- shop ---------------------------------- */

export function ShopPanel({ api, close, hud }: { api: GameApi; close: () => void; hud: HudSnapshot }) {
  const sim = api.sim();
  const [tab, setTab] = useState<'bait' | 'rod' | 'line' | 'net'>('bait');
  const items = (sim?.shopView() ?? []).filter((i) => i.kind === tab);
  const tabs: [typeof tab, string][] = [
    ['bait', 'Наживки'],
    ['rod', 'Удилища'],
    ['line', 'Леска'],
    ['net', 'Садки'],
  ];
  return (
    <Frame title="Магазин" sub={`Баланс: ${rub(hud.money)} · уровень ${hud.level}`} close={close} wide>
      <div className="seg" style={{ marginBottom: 12 }}>
        {tabs.map(([id, label]) => (
          <button key={id} className={`small${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="list">
        {items.map((it) => {
          const owned = it.owned;
          const levelNeed =
            (tab === 'rod' && RODS.find((r) => r.id === it.id)?.level) ||
            (tab === 'line' && LINES.find((l) => l.id === it.id)?.level) ||
            (tab === 'net' && NETS.find((n) => n.id === it.id)?.level) ||
            1;
          const tooPoor = !owned && hud.money < it.price;
          const locked = !owned && hud.level < levelNeed;
          return (
            <div className={`row${owned ? ' active' : ''}`} key={it.id}>
              <div>
                <div className="title">{it.name}</div>
                <div className="desc">{it.desc}</div>
                {tab === 'rod' && (
                  <div className="notice" style={{ marginTop: 4 }}>
                    Заброс до {meters(RODS.find((r) => r.id === it.id)?.castMax ?? 0, 0)} · тяга{' '}
                    {num(RODS.find((r) => r.id === it.id)?.power ?? 0, 2)} · амортизация{' '}
                    {num((RODS.find((r) => r.id === it.id)?.forgiveness ?? 0) * 100, 0)}%
                  </div>
                )}
                {tab === 'line' && (
                  <div className="notice" style={{ marginTop: 4 }}>
                    Обрыв около {num(LINES.find((l) => l.id === it.id)?.strengthKg ?? 0, 1)} кг нагрузки
                  </div>
                )}
                {tab === 'net' && (
                  <div className="notice" style={{ marginTop: 4 }}>
                    Вместимость {NETS.find((n) => n.id === it.id)?.capacity ?? 0} рыб
                  </div>
                )}
              </div>
              <div className="right">
                <button
                  className={owned ? 'ghost' : 'primary'}
                  disabled={owned || tooPoor || locked}
                  onClick={() => api.buy(it.id)}
                >
                  {owned ? 'Куплено' : rub(it.price)}
                </button>
                {locked && <span className="notice">нужен {levelNeed} уровень</span>}
                {tooPoor && !locked && <span className="notice">не хватает {rub(it.price - hud.money)}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

/* --------------------------------- records -------------------------------- */

export function RecordsPanel({ api, close, hud }: { api: GameApi; close: () => void; hud: HudSnapshot }) {
  const sim = api.sim();
  const recs = sim?.recordsView() ?? [];
  return (
    <Frame
      title="Рекорды"
      sub={`Поймано: ${hud.totalCaught} · отпущено: ${sim?.save.totalReleased ?? 0} · вес в садке и дома: ${kg(sim?.save.totalWeight ?? 0)}`}
      close={close}
      wide
    >
      <table className="table">
        <thead>
          <tr>
            <th>Вид</th>
            <th>Рекорд</th>
            <th>Длина</th>
            <th>Время</th>
            <th>Насадка</th>
            <th>Трофей от</th>
          </tr>
        </thead>
        <tbody>
          {recs.map((r) => (
            <tr key={r.species}>
              <td>
                {r.ru} <span style={{ color: 'var(--muted)' }}>({r.en})</span>
              </td>
              <td>{r.best ? kg(r.weight) : '—'}</td>
              <td>{r.best ? cm(r.length) : '—'}</td>
              <td>{r.best ? clockLabel(r.hour) : '—'}</td>
              <td>{r.best && r.bait ? BAITS[r.bait].ru : '—'}</td>
              <td>{kg(r.trophyKg)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ margin: '18px 0 6px', fontSize: '0.9rem' }}>Последние поклёвки</h3>
      {hud.history.length === 0 ? (
        <p className="notice">История пуста — сначала поймайте что-нибудь.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Вид</th>
              <th>Вес</th>
              <th>Длина</th>
              <th>Насадка</th>
              <th>Время</th>
              <th>Оценка</th>
            </tr>
          </thead>
          <tbody>
            {hud.history.slice(0, 10).map((f, i) => (
              <tr key={f.uid + i}>
                <td>{SPECIES[f.species].ru}</td>
                <td>{kg(f.weight)}</td>
                <td>{cm(f.length)}</td>
                <td>{BAITS[f.bait].ru}</td>
                <td>{clockLabel(f.hour)}</td>
                <td>{rub(f.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ margin: '18px 0 6px', fontSize: '0.9rem' }}>Кто где берёт</h3>
      <div className="grid2">
        {SPECIES_ORDER.map((id) => (
          <div className="row" key={id}>
            <div>
              <div className="title">{SPECIES[id].ru}</div>
              <div className="desc">{SPECIES[id].blurb}</div>
              <div className="notice" style={{ marginTop: 4 }}>
                Любимая насадка:{' '}
                {Object.entries(SPECIES[id].bait)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 2)
                  .map(([b]) => BAITS[b as keyof typeof BAITS].ru)
                  .join(', ')}{' '}
                · глубина {num(SPECIES[id].depthPref[0], 1)}–{num(SPECIES[id].depthPref[1], 1)} м · вес от{' '}
                {kg(SPECIES[id].minW)} до {kg(SPECIES[id].maxW)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

const SPECIES_ORDER = ['karas', 'plotva', 'okun', 'leshch', 'karp', 'shchuka'] as const;

/* -------------------------------- settings -------------------------------- */

export function SettingsPanel({ api, close }: { api: GameApi; close: () => void }) {
  const sim = api.sim();
  const s = sim?.save.settings;
  const [confirmReset, setConfirmReset] = useState(false);
  if (!s) return null;
  return (
    <Frame title="Настройки" sub="Всё сохраняется локально в браузере" close={close}>
      <div className="field">
        <div className="head">
          <span>Звук (плеск, подсечка, катушка, птицы)</span>
          <div className="seg">
            <button className={`small${s.sound ? ' on' : ''}`} onClick={() => api.setSetting('sound', true)}>
              Вкл
            </button>
            <button className={`small${!s.sound ? ' on' : ''}`} onClick={() => api.setSetting('sound', false)}>
              Выкл
            </button>
          </div>
        </div>
      </div>
      <div className="field">
        <div className="head">
          <span>Чувствительность мыши</span>
          <span>{num(s.sensitivity, 2)}</span>
        </div>
        <input
          type="range"
          min={0.3}
          max={2.5}
          step={0.05}
          value={s.sensitivity}
          onChange={(e) => api.setSetting('sensitivity', Number(e.target.value))}
        />
      </div>
      <div className="field">
        <div className="head">
          <span>Качество графики</span>
          <div className="seg">
            {(['low', 'medium', 'high'] as const).map((q) => (
              <button
                key={q}
                className={`small${s.quality === q ? ' on' : ''}`}
                onClick={() => api.setSetting('quality', q)}
              >
                {q === 'low' ? 'Низкое' : q === 'medium' ? 'Среднее' : 'Высокое'}
              </button>
            ))}
          </div>
        </div>
        <span className="notice">Низкое: без теней и с упрощённым лесом. Высокое: тени и плотный лес.</span>
      </div>
      <div className="field">
        <div className="head">
          <span>Увеличенный вид поплавка</span>
          <div className="seg">
            <button className={`small${s.floatView ? ' on' : ''}`} onClick={() => api.setSetting('floatView', true)}>
              Показывать
            </button>
            <button className={`small${!s.floatView ? ' on' : ''}`} onClick={() => api.setSetting('floatView', false)}>
              Скрыть
            </button>
          </div>
        </div>
        <span className="notice">Видно в правом верхнем углу, когда снасть в воде.</span>
      </div>
      <div className="field" style={{ borderBottom: 'none' }}>
        <div className="head">
          <span>Прогресс</span>
          {confirmReset ? (
            <div className="seg">
              <button
                className="small danger"
                onClick={() => {
                  api.reset();
                  setConfirmReset(false);
                }}
              >
                Да, начать заново
              </button>
              <button className="small ghost" onClick={() => setConfirmReset(false)}>
                Отмена
              </button>
            </div>
          ) : (
            <button className="small ghost" onClick={() => setConfirmReset(true)}>
              Сбросить прогресс
            </button>
          )}
        </div>
      </div>
    </Frame>
  );
}

/* ---------------------------------- pause --------------------------------- */

export function PausePanel({ close }: { close: () => void }) {
  return (
    <Frame title="Пауза" sub="Симуляция остановлена, мир на месте" close={close}>
      <dl className="facts">
        <dt>Обзор</dt>
        <dd>отянуть мышью / пальцем</dd>
        <dt>Заброс</dt>
        <dd>зажать левую кнопку, отпустить</dd>
        <dt>Подсечка</dt>
        <dd>клик по поклёвке</dd>
        <dt>Вываживание</dt>
        <dd>держать кнопку — подмотка</dd>
        <dt>Фрикцион</dt>
        <dd>колесо мыши или кнопки ±</dd>
        <dt>Пауза</dt>
        <dd>Esc</dd>
      </dl>
      <p className="notice">
        Советы: в камышах мелководья берёт карась и окунь, на открытой воде — плотва и лещ, в яме — карп и щука.
        Щука живёт на живце, карп уважает кукурузу. Натяжение выше 85% рвёт леску, слишком слабая леска — риск схода.
      </p>
      <div style={{ marginTop: 12 }}>
        <button className="primary" onClick={close}>
          Продолжить рыбалку
        </button>
      </div>
    </Frame>
  );
}

/* --------------------------------- result --------------------------------- */

export function ResultPanel({
  api,
  hud,
  netFull,
}: {
  api: GameApi;
  hud: HudSnapshot;
  netFull: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fish = hud.result;
  useEffect(() => {
    if (!fish || !canvasRef.current) return;
    api.attachPreview(canvasRef.current, fish.species, fish.length);
  }, [api, fish]);
  if (!fish) return null;
  const def = SPECIES[fish.species];
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Результат">
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>{def.ru}</h2>
            <div className="sub">{def.en} · {def.blurb}</div>
          </div>
          <div className="badges">
            {hud.resultIsRecord && <span className="badge">Новый рекорд!</span>}
            {fish.trophy && <span className="badge trophy">Трофей</span>}
          </div>
        </div>
        <div className="result-grid">
          <canvas ref={canvasRef} className="fish-preview" />
          <div>
            <div className="big-weight">{kg(fish.weight)}</div>
            <dl className="facts">
              <dt>Длина</dt>
              <dd>{cm(fish.length)}</dd>
              <dt>Насадка</dt>
              <dd>{BAITS[fish.bait].ru}</dd>
              <dt>Место</dt>
              <dd>{fish.zone === 'shallow' ? 'Заводь' : fish.zone === 'mid' ? 'Открытая вода' : 'Яма'}</dd>
              <dt>Поймано в</dt>
              <dd>{clockLabel(fish.hour)}</dd>
              <dt>Оценка</dt>
              <dd>{rub(fish.value)}</dd>
              <dt>Опыт</dt>
              <dd>+{fish.xp}</dd>
              <dt>Трофейный вес</dt>
              <dd>от {kg(def.trophyKg)}</dd>
            </dl>
            <div className="action-row" style={{ justifyContent: 'flex-start' }}>
              <button className="primary" disabled={netFull} onClick={() => api.resolve('keep')}>
                Оставить
              </button>
              <button className="ghost" onClick={() => api.resolve('release')}>
                Отпустить
              </button>
            </div>
            {netFull && <p className="notice">Садок полон: продайте рыбу или отпустите этот экземпляр.</p>}
            <p className="notice">
              Отпущенная рыба даёт опыт, но не попадает в садок и не продаётся.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
