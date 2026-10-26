import assert from 'node:assert/strict';
import {test} from 'node:test';
import {pct} from '../src/format.js';
import {ALL, FARM, STATIONS, WORKERS} from '../src/data/units.js';
import {STAT, animalRate, cap, cook, costOf, grainNeed, grainRate, legacy, live, mult, perSec, perTap, rateOf, speed} from '../src/core/formulas.js';
import {at} from './world.js';

const byId = Object.fromEntries(ALL.map(d => [d.id, d]));

test('тап: 4 на старте, +1 за уровень костра', () => {
  assert.equal(perTap(at()), 4);
  assert.equal(perTap(at({levels: {fire: 1}})), 5);
  assert.equal(perTap(at({levels: {fire: 2}})), 6);
});

test('цены первых построек и рабочих', () => {
  const first = {fire: 75, cave: 200, storage: 500, kitchen: 1500, bath: 3000, hunter: 50, tracker: 1000, chief: 20000, rabbit: 600, goat: 12500, granary: 1000};
  for (const [id, price] of Object.entries(first)) assert.equal(costOf(at(), byId[id], 1), price, id);
});

test('цена растёт по growth', () => {
  const w = at({levels: {hunter: 10}});
  assert.equal(costOf(w, WORKERS[0], 1), Math.ceil(50 * 1.085 ** 10 - 1e-9));
});

test('склад: 2500 x 1.267 в степени уровня', () => {
  assert.equal(cap(at()), 2500);
  assert.equal(cap(at({levels: {storage: 1}})), 3167);
  assert.equal(cap(at({levels: {storage: 10}})), Math.floor(2500 * 1.267 ** 10));
});

test('охотник, предки, жар, благословение, страх', () => {
  assert.equal(rateOf(at({levels: {hunter: 1}}), WORKERS[0]), 3);
  assert.equal(legacy(at()), 1);
  assert.equal(legacy(at({valley: 1})), 1.17);
  assert.equal(live(at({}, {heat: 100})), 1.3);
  assert.equal(perTap(at({blessUntil: Date.now() * 2})), 5);
  assert.equal(perTap(at({scaredUntil: Date.now() * 2})), 1);
});

test('прибавка +40% каждые 25 уровней, повышение её не отнимает', () => {
  assert.equal(mult(at({levels: {hunter: 24}}), 'hunter'), 1);
  assert.equal(mult(at({levels: {hunter: 25}}), 'hunter'), 1.4);
  assert.equal(mult(at({levels: {hunter: 15, tracker: 10}}), 'hunter'), 1.4);
  assert.equal(mult(at({levels: {hunter: 50}}), 'hunter'), 1.4 ** 2);
});

test('ферма: поле 300/мин, коза ест 180/мин и даёт 240/с', () => {
  const w = at({levels: {field: 1, goat: 1}});
  assert.equal(grainRate(w), 300);
  assert.equal(grainNeed(w), 180);
  assert.equal(animalRate(w, FARM[4], 1), 240);
  assert.equal(animalRate(w, FARM[4], .5), 120);
});

test('баня и бустер «Быстрые ноги»', () => {
  assert.equal(speed(at({levels: {bath: 3}})), 1.04);
  assert.equal(speed(at({levels: {bath: 25}})), 1.34);
  assert.equal(speed(at({boosts: {speed: Date.now() * 2}})), 2);
});

test('кухня: 2% за уровень, с солью на 17% сильнее', () => {
  assert.equal(cook(at({levels: {kitchen: 1}})), 1.02);
  assert.equal(cook(at({levels: {kitchen: 10}})), 1.2);
  assert.equal(cook(at({levels: {kitchen: 10}, techs: ['salt']})), 1.24);
});

test('следопыт и вождь дорожают быстрее охотника', () => {
  assert.deepEqual(WORKERS.map(d => d.growth), [1.085, 1.1275, 1.12]);
  assert.equal(costOf(at({levels: {tracker: 10}}), WORKERS[1], 1), 3321);
  assert.equal(costOf(at({levels: {chief: 25}}), WORKERS[2], 1), 340002);
});

test('добыча в секунду складывается из рабочих и скотины', () => {
  const w = at({levels: {hunter: 2, rabbit: 1}});
  assert.equal(perSec(w), rateOf(w, WORKERS[0]) + animalRate(w, FARM[3]));
});

test('каждая покупка прибавляет хотя бы 1: 60 уровней подряд без «N → N»', () => {
  for (const def of [...STATIONS, ...WORKERS, ...FARM]) {
    const show = v => def.pct ? pct(v) : v;
    for (let l = 0; l < 60; l++) {
      const levels = def.from ? {[def.id]: l, [def.from]: 1} : {[def.id]: l};
      const now = show(STAT[def.id](at({levels}))), next = show(STAT[def.id](at({levels: {...levels, [def.id]: l + 1}})));
      assert.ok(next >= now + 1, `${def.name}: ур. ${l} → ${l + 1}: ${now} → ${next}`);
    }
  }
});
