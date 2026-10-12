/**
 * Balance probe: uses the real rollWeight and the real bite timer.
 * node tools/probe-balance.cjs /tmp/simtest
 */
const path = require('path');
const dir = process.argv[2] || '/tmp/simtest';
const { Simulation } = require(path.join(dir, 'simulation.js'));
const { SPECIES, rollWeight } = require(path.join(dir, 'species.js'));
const { spotFrom } = require(path.join(dir, 'lake.js'));

let seedState = 12345;
const rnd = () => {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
};

console.log('=== вес: реальная выборка rollWeight (12000 рыб, зона mid, глубина 2) ===');
for (const id of Object.keys(SPECIES)) {
  const def = SPECIES[id];
  const ws = [];
  for (let i = 0; i < 12000; i++) ws.push(rollWeight(def, rnd, 'mid', 2));
  ws.sort((a, b) => a - b);
  const p = (q) => ws[Math.min(ws.length - 1, Math.floor(q * ws.length))];
  const trophies = ws.filter((w) => w >= def.trophyKg).length / ws.length;
  const giants = ws.filter((w) => w >= def.maxW * 0.8).length / ws.length;
  console.log(
    `  ${def.ru.padEnd(7)} медиана ${p(0.5).toFixed(2)} · p90 ${p(0.9).toFixed(2)} · p99 ${p(0.99).toFixed(2)} · макс ${p(1).toFixed(2)} кг · трофеев ${(100 * trophies).toFixed(1)}% · гигантов ${(100 * giants).toFixed(2)}%`,
  );
}

console.log('\n=== длина по весу ===');
for (const id of Object.keys(SPECIES)) {
  const def = SPECIES[id];
  const L = (w) => (def.k * Math.cbrt(w)).toFixed(0);
  console.log(`  ${def.ru.padEnd(7)} ${def.minW}кг→${L(def.minW)}см · медиана→${L(def.mode)}см · ${def.maxW}кг→${L(def.maxW)}см`);
}

/** bite wait measured from the real timer */
function wait(bait, power, hour, seed, zoneHint) {
  const sim = new Simulation(seed);
  sim.save.bait = { cherv: 50, oparysh: 50, kukuruza: 50, zhivets: 50 };
  sim.save.selectedBait = bait;
  sim.state.hour = hour;
  sim.setAim(0, -1);
  sim.beginCharge();
  for (let i = 0; i < 300 && sim.state.power < power; i++) sim.step(1 / 60);
  sim.releaseCharge();
  const spot = spotFrom(0, -1, sim.state.rig ? sim.state.rig.distance : 0);
  const dt = 1 / 30;
  let warm = 0;
  while (sim.state.phase !== 'waiting' && warm < 60) {
    sim.step(dt);
    warm += dt;
  }
  let waited = 0;
  while (sim.state.phase === 'waiting' && waited < 400) {
    sim.step(dt);
    waited += dt;
  }
  return { waited: waited, zone: spot.zoneName, depth: +spot.depth.toFixed(2), phase: sim.state.phase, hint: zoneHint };
}

console.log('\n=== время до поклёвки (30 замеров на случай) ===');
const cases = [
  ['кукуруза, 22 м, 7:30 (хорошо)', 'kukuruza', 0.44, 7.5],
  ['червь, 8 м, 8:00 (хорошо)', 'cherv', 0.1, 8.0],
  ['живец, 30 м, 6:00 (хищник днём)', 'zhivets', 0.62, 6.0],
  ['опарыш, 15 м, 14:00 (середина дня)', 'oparysh', 0.3, 14.0],
  ['кукуруза, 30 м, 23:00 (ночь, плохо)', 'kukuruza', 0.62, 23.0],
  ['живец, 6 м, 13:00 (плохо)', 'zhivets', 0.02, 13.0],
];
for (const [label, bait, power, hour] of cases) {
  const runs = [];
  for (let i = 0; i < 30; i++) runs.push(wait(bait, power, hour, 100 + i * 7).waited);
  runs.sort((a, b) => a - b);
  const avg = runs.reduce((a, b) => a + b, 0) / runs.length;
  console.log(
    `  ${label.padEnd(34)} среднее ${avg.toFixed(1)} с · разброс ${runs[0].toFixed(1)}–${runs[runs.length - 1].toFixed(1)} с`,
  );
}

/** how long a fight lasts with sensible play, per species */
function fightLength(species, weight, strategy, seed) {
  const sim = new Simulation(seed);
  sim.save.bait = { cherv: 5, oparysh: 5, kukuruza: 5, zhivets: 5 };
  sim.setAim(0, -1);
  sim.beginCharge();
  for (let i = 0; i < 300 && sim.state.power < 0.45; i++) sim.step(1 / 60);
  sim.releaseCharge();
  for (let i = 0; i < 200 && sim.state.phase !== 'waiting'; i++) sim.step(1 / 60);
  // splice a chosen fish in through the normal pipeline
  sim.state.waitRemaining = 0.001;
  const dt = 1 / 30;
  for (let i = 0; i < 200 && sim.state.phase !== 'strike'; i++) sim.step(dt);
  sim.pending = { species, weight, length: SPECIES[species].k * Math.cbrt(weight) };
  sim.state.phase = 'strike';
  sim.state.strikeRemaining = 2;
  sim.state.strikeTotal = 2;
  sim.attemptStrike();
  if (sim.state.phase !== 'fighting') return { ok: false, reason: 'не удалось зайти в бой' };
  let t = 0;
  let breaks = 0;
  let escapes = 0;
  while (t < 240) {
    const s = sim.state;
    if (strategy === 'smart') sim.setReeling(s.tension < 72);
    else if (strategy === 'maxdrag') {
      sim.setDrag(10);
      sim.setReeling(s.tension < 96);
    } else if (strategy === 'soft') {
      sim.setDrag(2);
      sim.setReeling(s.tension < 55 && s.fish.stamina > 0.2);
    }
    sim.step(dt);
    t += dt;
    for (const e of sim.drainEvents()) {
      if (e.type === 'lineSnapped') breaks++;
      if (e.type === 'fishEscaped') escapes++;
    }
    if (sim.state.phase === 'result')
      return { ok: true, seconds: +t.toFixed(1), breaks, escapes, weight: sim.state.result.weight };
    if (sim.state.phase !== 'fighting') return { ok: false, reason: sim.state.phase, breaks, escapes };
  }
  return { ok: false, reason: 'слишком долго (>240 с)', breaks, escapes };
}

console.log('\n=== длительность боя (умная подмотка / макс. фрикцион / мягкая) ===');
const trials = [
  ['plotva', 0.2],
  ['karas', 0.5],
  ['okun', 0.8],
  ['leshch', 2.2],
  ['karp', 6.5],
  ['shchuka', 4.0],
];
for (const strategy of ['smart', 'maxdrag', 'soft']) {
  const line = [];
  for (const [sp, w] of trials) {
    const res = fightLength(sp, w, strategy, 4000 + Math.floor(w * 977));
    line.push(
      `${SPECIES[sp].ru} ${w}кг: ${res.ok ? `${res.seconds}с${res.breaks ? ' +разрыв' : ''}${res.escapes ? ' +сход' : ''}` : `неудача(${res.reason})`}`,
    );
  }
  console.log(`  ${strategy.padEnd(8)} ${line.join(' | ')}`);
}
