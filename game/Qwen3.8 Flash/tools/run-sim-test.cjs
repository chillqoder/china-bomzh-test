/**
 * Headless logic check for the simulation (no DOM, no WebGL).
 * Run: npx tsc src/game/*.ts --outDir /tmp/simtest --module commonjs --target es2020 --skipLibCheck
 *      node tools/run-sim-test.mjs
 */
const path = require('path');
const fs = require('fs');

const dir = process.argv[2] || '/tmp/simtest';
const { Simulation } = require(path.join(dir, 'simulation.js'));
const { spotFrom } = require(path.join(dir, 'lake.js'));

function makeRig(sim, power) {
  // aim straight out to the lake (-z) with a chosen power
  sim.setAim(0, -1);
  sim.beginCharge();
  for (let i = 0; i < 100; i++) {
    sim.step(1 / 60);
    if (Math.abs(sim.state.power - power) < 0.02) break;
  }
  sim.releaseCharge();
}

function run({ bait, power, seconds = 400, reelStrategy = 'smart', seed = 1 }) {
  const sim = new Simulation(seed);
  sim.save.bait = { cherv: 40, oparysh: 40, kukuruza: 40, zhivets: 40 };
  sim.save.selectedBait = bait;
  const log = [];
  const seen = new Set();
  let landed = 0;
  let broke = 0;
  let escaped = 0;
  let missed = 0;
  let scared = 0;
  let stolen = 0;
  let casts = 0;
  const dt = 1 / 30;
  let reeling = false;

  makeRig(sim, power);
  casts++;
  const start = sim.state.hour;

  for (let t = 0; t < seconds; t += dt) {
    const phase = sim.state.phase;
    seen.add(phase);
    if (phase === 'ready') {
      if (sim.state.result) {
        sim.resolveResult(landed % 3 === 2 ? 'release' : 'keep');
      }
      makeRig(sim, power);
      casts++;
      continue;
    }
    if (phase === 'result') {
      landed++;
      const r = sim.state.result;
      log.push(
        `${r.species} ${r.weight}kg/${r.length}cm bait=${r.bait} zone=${r.zone} value=${r.value} xp=${r.xp} trophy=${r.trophy}`,
      );
      sim.resolveResult(landed % 3 === 2 ? 'release' : 'keep');
      continue;
    }
    if (phase === 'strike') {
      sim.attemptStrike(); // perfect hook-up
      continue;
    }
    if (phase === 'fighting') {
      const s = sim.state;
      if (reelStrategy === 'smart') {
        // keep tension in the safe band
        reeling = s.tension < 78;
      } else if (reelStrategy === 'aggressive') {
        reeling = true;
      } else {
        reeling = false;
      }
      sim.setReeling(reeling);
      if (!reeling && s.tension < 5) sim.setReeling(true);
    }
    if (phase === 'charging' && sim.state.power >= power - 0.001) {
      sim.releaseCharge();
    }
    sim.step(dt);
    for (const e of sim.drainEvents()) {
      if (e.type === 'lineSnapped') broke++;
      if (e.type === 'fishEscaped') escaped++;
      if (e.type === 'missed') missed++;
      if (e.type === 'scared') scared++;
      if (e.type === 'baitStolen') stolen++;
    }
  }
  return { seen: [...seen], landed, broke, escaped, missed, scared, stolen, casts, log, hourSpan: sim.state.hour - start };
}

console.log('=== geometry / zones sanity ===');
for (const d of [4, 8, 12, 18, 26, 34, 44]) {
  const s = spotFrom(0, -1, d);
  console.log(
    `  ${String(d).padStart(2)} м: depth=${s.depth.toFixed(2)} zone=${s.zone} ${s.zoneName} land=${s.onLand}`,
  );
}

const cases = [
  { name: 'червь · мелководье (8 м)', bait: 'cherv', power: 0.1, seconds: 320 },
  { name: 'опарыш · открытая вода (20 м)', bait: 'oparysh', power: 0.38, seconds: 320 },
  { name: 'кукуруза · открытая вода (22 м)', bait: 'kukuruza', power: 0.44, seconds: 320 },
  { name: 'живец · яма (34 м)', bait: 'zhivets', power: 0.72, seconds: 320 },
  { name: 'агрессивная подмотка (обрыв?)', bait: 'kukuruza', power: 0.44, seconds: 320, reelStrategy: 'aggressive' },
  { name: 'без подмотки (сход?)', bait: 'cherv', power: 0.3, seconds: 320, reelStrategy: 'none' },
];

for (const c of cases) {
  const r = run(c);
  console.log(`\n=== ${c.name} ===`);
  console.log(
    `  phases: ${r.seen.join(', ')}\n  landed=${r.landed} broken=${r.broke} escaped=${r.escaped} missed=${r.missed} scared=${r.scared} stolen=${r.stolen} casts=${r.casts}`,
  );
  r.log.slice(0, 8).forEach((l) => console.log('   • ' + l));
}

// persistence check
console.log('\n=== persistence ===');
const sim = new Simulation(42);
sim.save.money = 1234;
sim.save.records['karas'] = { weight: 0.77, length: 31, hour: 6.2, bait: 'cherv', caughtAt: Date.now() };
try {
  sim.flush();
  console.log('  flush() survived without localStorage:', typeof window);
} catch (e) {
  console.log('  flush failed:', e.message);
}
const spot = spotFrom(0, -1, 2);
console.log('  cast onto the bank rejected as expected:', spot.onLand);

if (!fs.existsSync('/tmp/simtest')) console.log('  (out dir missing)');
