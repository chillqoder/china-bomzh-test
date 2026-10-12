/**
 * Trade-off probe for reel drag: does high drag really risk the line,
 * and does low drag really let the fish get away?
 * node tools/probe-drag.cjs /tmp/simtest
 */
const path = require('path');
const dir = process.argv[2] || '/tmp/simtest';
const { Simulation } = require(path.join(dir, 'simulation.js'));
const { SPECIES } = require(path.join(dir, 'species.js'));

const dt = 1 / 30;

function fight(species, weight, opts) {
  const { drag, rule, lineId, seed, distance } = opts;
  const sim = new Simulation(seed);
  sim.save.lineId = lineId || 'line_35';
  sim.setAim(0, -1);
  sim.beginCharge();
  for (let i = 0; i < 300 && sim.state.power < (distance || 0.45); i++) sim.step(1 / 60);
  sim.releaseCharge();
  for (let i = 0; i < 3000 && sim.state.phase !== 'strike'; i++) sim.step(dt);
  sim.pending = { species, weight, length: SPECIES[species].k * Math.cbrt(weight) };
  sim.state.phase = 'strike';
  sim.state.strikeRemaining = 2;
  sim.state.strikeTotal = 2;
  sim.attemptStrike();
  if (sim.state.phase !== 'fighting') return { outcome: 'no-fight', t: 0, maxTension: 0 };
  sim.setDrag(drag);
  let t = 0;
  let maxTension = 0;
  let peak = 0;
  while (t < 300) {
    const s = sim.state;
    if (rule === 'hold') sim.setReeling(true);
    else if (rule === 'watch') sim.setReeling(s.tension < 100);
    else if (rule === 'smart') sim.setReeling(s.tension < 78);
    sim.step(dt);
    t += dt;
    maxTension = Math.max(maxTension, s.tension);
    peak = Math.max(peak, s.overload);
    for (const e of sim.drainEvents()) {
      if (e.type === 'lineSnapped') return { outcome: 'обрыв', t: +t.toFixed(1), maxTension: +maxTension.toFixed(0), peak: +peak.toFixed(2) };
      if (e.type === 'fishEscaped') return { outcome: 'сход', t: +t.toFixed(1), maxTension: +maxTension.toFixed(0), peak: +peak.toFixed(2) };
    }
    if (sim.state.phase === 'result')
      return { outcome: 'в садке', t: +t.toFixed(1), maxTension: +maxTension.toFixed(0), peak: +peak.toFixed(2) };
    if (sim.state.phase !== 'fighting') return { outcome: sim.state.phase, t: +t.toFixed(1), maxTension: +maxTension.toFixed(0), peak: +peak.toFixed(2) };
  }
  return { outcome: 'затянулся', t: t, maxTension: +maxTension.toFixed(0), peak: +peak.toFixed(2) };
}

function suite(label, species, weight, cfgs) {
  console.log(`\n=== ${label} (${SPECIES[species].ru} ${weight} кг) ===`);
  for (const c of cfgs) {
    const res = [];
    for (let s = 0; s < 12; s++) res.push(fight(species, weight, { ...c, seed: 1000 + s * 131 }));
    const counts = {};
    for (const r of res) counts[r.outcome] = (counts[r.outcome] || 0) + 1;
    const avg = (res.reduce((a, b) => a + b.t, 0) / res.length).toFixed(1);
    const tension = (res.reduce((a, b) => a + b.maxTension, 0) / res.length).toFixed(0);
    console.log(
      `  ${`drag ${c.drag}${c.lineId ? ' · ' + c.lineId : ''} · ${c.rule}`.padEnd(30)} ${Object.entries(counts).map(([k, v]) => `${k} ${v}/12`).join(', ')} · бодрствует ${avg}с · натяжение ~${tension}%`,
    );
  }
}

suite('Карпёрок на тонкой леске', 'karp', 5.5, [
  { drag: 10, rule: 'hold' },
  { drag: 10, rule: 'watch' },
  { drag: 5, rule: 'smart' },
  { drag: 2, rule: 'hold' },
  { drag: 5, rule: 'smart', lineId: 'line_7' },
]);

suite('Плотвичка', 'plotva', 0.25, [
  { drag: 10, rule: 'hold' },
  { drag: 5, rule: 'smart' },
  { drag: 1, rule: 'hold' },
]);

suite('Щука', 'shchuka', 4.2, [
  { drag: 8, rule: 'hold' },
  { drag: 5, rule: 'smart' },
  { drag: 5, rule: 'smart', lineId: 'line_5' },
  { drag: 3, rule: 'hold' },
]);

suite('Крупный лещ', 'leshch', 3.6, [
  { drag: 7, rule: 'watch' },
  { drag: 4, rule: 'smart' },
  { drag: 4, rule: 'smart', lineId: 'line_5' },
]);
