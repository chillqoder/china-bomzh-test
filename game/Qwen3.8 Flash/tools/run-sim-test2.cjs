/**
 * Extra headless checks: missed bites, early strikes, bait consumption,
 * wait-time distribution and trophy rate after the balance pass.
 */
const path = require('path');
const dir = process.argv[2] || '/tmp/simtest';
const { Simulation } = require(path.join(dir, 'simulation.js'));
const { SPECIES } = require(path.join(dir, 'species.js'));

const dt = 1 / 30;

function newSim(bait, seed) {
  const sim = new Simulation(seed);
  sim.save.bait = { cherv: 999, oparysh: 999, kukuruza: 999, zhivets: 999 };
  sim.save.selectedBait = bait;
  return sim;
}

function chargeTo(sim, power) {
  sim.setAim(0, -1);
  sim.beginCharge();
  for (let i = 0; i < 200; i++) {
    sim.step(dt);
    if (sim.state.power >= power) break;
  }
}

/** 1) missed bites + early strikes */
function missTest(mode, seconds = 240) {
  const sim = newSim('cherv', 7);
  const counts = { missed: 0, scared: 0, stolen: 0, biteSeen: 0 };
  for (let t = 0; t < seconds; t += dt) {
    const p = sim.state.phase;
    if (p === 'ready') {
      chargeTo(sim, 0.3);
      sim.releaseCharge();
    } else if (p === 'investigating' && mode === 'early') {
      sim.attemptStrike();
    } else if (p === 'strike') {
      if (mode === 'perfect') sim.attemptStrike();
    } else if (p === 'result') {
      sim.resolveResult('release');
    } else if (p === 'fighting') {
      sim.setReeling(sim.state.tension < 60);
    }
    sim.step(dt);
    for (const e of sim.drainEvents()) {
      if (e.type === 'missed') counts.missed++;
      if (e.type === 'scared') counts.scared++;
      if (e.type === 'baitStolen') counts.stolen++;
      if (e.type === 'biteStart') counts.biteSeen++;
    }
  }
  return counts;
}

console.log('=== никогда не подсекаем (missed bites) ===', missTest('never'));
console.log('=== ранняя подсечка (scare) ===', missTest('early'));

/** 2) bait consumption: exactly one unit per cast, no cast without bait */
{
  const sim = newSim('cherv', 3);
  sim.save.bait.cherv = 3;
  let casts = 0;
  for (let i = 0; i < 6; i++) {
    // wait until ready
    for (let t = 0; t < 400 && sim.state.phase !== 'ready'; t += dt) {
      if (sim.state.phase === 'result') sim.resolveResult('release');
      if (sim.state.phase === 'fighting') sim.setReeling(sim.state.tension < 55);
      sim.step(dt);
    }
    chargeTo(sim, 0.25);
    const before = sim.save.bait.cherv;
    sim.releaseCharge();
    if (sim.state.phase === 'casting') {
      casts++;
      if (sim.save.bait.cherv !== before - 1) console.log('  !! bait not consumed correctly');
    }
    for (let t = 0; t < 60 * dt * 60; t += dt) sim.step(dt); // let it play out
  }
  console.log(`\n=== наживка: сделано забросов ${casts} из 3 возможных, остаток ${sim.save.bait.cherv} ===`);
  sim.setAim(0, -1);
  sim.beginCharge();
  sim.step(dt);
  console.log('  без наживки заброс блокируется:', sim.state.phase === 'ready' ? 'да' : 'нет');
}

/** 3) wait-time distribution per condition */
function waitStats(bait, power, seed) {
  const sim = newSim(bait, seed);
  chargeTo(sim, power);
  sim.releaseCharge();
  const waits = [];
  let lastPhase = sim.state.phase;
  for (let t = 0; t < 900; t += dt) {
    sim.step(dt);
    for (const e of sim.drainEvents()) {
      if (e.type === 'biteStart') waits.push(sim.state.waitTotalBefore ?? waits.length);
    }
    if (lastPhase === 'waiting' && sim.state.phase === 'retrieving') break;
    if (sim.state.phase === 'ready' && sim.state.waitRemaining > 0) break;
    lastPhase = sim.state.phase;
    if (sim.state.phase === 'fighting') sim.setReeling(sim.state.tension < 55);
    if (sim.state.phase === 'result') sim.resolveResult('release');
    if (sim.state.phase === 'waiting' && waits.length === 0 && sim.state.waitRemaining > 0) {
      waits.push(sim.state.waitTotal);
      break;
    }
  }
  return waits[0] ?? -1;
}

console.log('\n=== время до поклёвки,good conditions vs poor (30 замеров) ===');
const good = [];
const poor = [];
for (let s = 1; s <= 30; s++) {
  good.push(waitStats('kukuruza', 0.4, s * 13 + 1));
  poor.push(waitStats('zhivets', 0.05, s * 17 + 5));
}
const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log(`  кукуруза · открытая вода: среднее ${avg(good)} с, min ${Math.min(...good)} с, max ${Math.max(...good)} с`);
console.log(`  живец · мелководье(плохо): среднее ${avg(poor)} с, min ${Math.min(...poor)} с, max ${Math.max(...poor)} с`);

/** 4) weight / trophy distribution after retune */
console.log('\n=== распределение веса (10000 роллов на вид, средняя зона) ===');
let r = 1;
const rnd = () => {
  r = (r * 1103515245 + 12345) % 2147483648;
  return r / 2147483648;
};
for (const id of Object.keys(SPECIES)) {
  const def = SPECIES[id];
  const ws = [];
  let trophies = 0;
  for (let i = 0; i < 10000; i++) {
    const w = def.minW + (def.maxW - def.minW) * Math.pow(rnd(), def.skew);
    const ww = w * 1.05 * (0.82 + 0.35 * Math.min(1, 2 / 4));
    const clamped = Math.max(def.minW * 0.8, Math.min(def.maxW, ww));
    ws.push(clamped);
    if (clamped >= def.trophyKg) trophies++;
  }
  ws.sort((a, b) => a - b);
  const p = (q) => ws[Math.floor(q * (ws.length - 1))].toFixed(2);
  console.log(
    `  ${def.ru.padEnd(7)} медиана ${p(0.5)} кг · 90% ${p(0.9)} кг · 99% ${p(0.99)} кг · максимум ${p(1)} кг · трофеев ${(100 * trophies / ws.length).toFixed(1)}%`,
  );
}

/** 5) keepnet / sell / shop */
{
  const sim = newSim('cherv', 9);
  sim.save.money = 1000;
  sim.save.xp = 400;
  for (let t = 0; t < 2000 && sim.save.keepnet.length < 3; t += dt) {
    if (sim.state.phase === 'ready') {
      chargeTo(sim, 0.28);
      sim.releaseCharge();
    }
    if (sim.state.phase === 'strike') sim.attemptStrike();
    if (sim.state.phase === 'fighting') sim.setReeling(sim.state.tension < 70);
    if (sim.state.phase === 'result') sim.resolveResult('keep');
    sim.step(dt);
    sim.drainEvents();
  }
  const net = sim.save.keepnet;
  const value = net.reduce((a, f) => a + f.value, 0);
  console.log(`\n=== садок: ${net.length} рыбы, вес ${sim.save.keepnet.reduce((a, f) => a + f.weight, 0).toFixed(2)} кг, оценка ${value} ===`);
  const moneyBefore = sim.save.money;
  sim.sellKeepnet();
  console.log(`  продажа зачислена один раз: ${moneyBefore} -> ${sim.save.money}, садок теперь ${sim.save.keepnet.length}`);
  const lv = sim.level;
  sim.buy('line_5');
  console.log(`  покупка лески: деньги ${sim.save.money}, уровень ${lv}, активная леска ${sim.save.lineId}`);
  sim.save.money = 99999;
  sim.buy('rod_feeder');
  sim.buy('net_20');
  console.log(`  апгрейды: ${sim.save.rodId}, ${sim.save.netId}, заброс до ${sim.rod.castMax} м, садок ${sim.net.capacity}`);
  console.log(`  история: ${sim.save.history.length} записей, рекорды: ${JSON.stringify(Object.keys(sim.save.records))}`);
}
