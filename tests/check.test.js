import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BLESS_GIFT} from '../src/config.js';
import {STATIONS, WORKERS} from '../src/data/units.js';
import {addMeat, migrated, purchase, restarted} from '../src/core/economy.js';
import {SHELL_SLACK, judge, ledgerOf, sane, shellCeiling, spent, spentOk} from '../src/core/check.js';
import {fresh} from '../src/core/state.js';
import {NOW, at} from './world.js';

const NONE = {bought: 0, blessDays: 0, blessUntil: 0};
const BASE = fresh(NOW).shells + BLESS_GIFT + SHELL_SLACK;

/** @param {import('../src/core/state.js').State} s */
const copy = s => structuredClone(s);

test('книга покупок: ракушки и дни подписки из STAR_ITEMS', () => {
  assert.deepEqual(ledgerOf([{item: 'shells30', count: 2}, {item: 'shells400', count: 1}, {item: 'bless', count: 1}, {item: 'keeper', count: 1}], 5), {bought: 460, blessDays: 30, blessUntil: 5});
});

test('потолок ракушек: старт, переселения, достижения, подарки, покупки', () => {
  assert.equal(shellCeiling(fresh(NOW), NONE), BASE);
  assert.equal(shellCeiling({...fresh(NOW), valley: 3}, NONE), BASE + 2 + 2 + 3);
  assert.equal(shellCeiling({...fresh(NOW), valley: 30}, NONE) - BASE, [...Array(30).keys()].reduce((n, v) => n + Math.min(10, 2 + Math.floor(v / 2)), 0));
  assert.equal(shellCeiling({...fresh(NOW), tiers: {meat: 3, fire: 9}}, NONE), BASE + 1 + 1 + 2 + 1);
  assert.equal(shellCeiling(fresh(NOW), {bought: 150, blessDays: 30, blessUntil: 0}), BASE + 150 + 30 * BLESS_GIFT);
});

test('честная игра проходит проверку', () => {
  const w = at({meat: 0});
  const prev = copy(w.state);
  for (let i = 0; i < 40; i++) {
    addMeat(w, 400);
    purchase(w, WORKERS[0]) || purchase(w, STATIONS[0]) || purchase(w, STATIONS[2]);
  }
  w.state.shells += 3;
  assert.ok(spentOk(w.state));
  assert.equal(judge(w.state, prev, 20e3, NONE, NOW).verdict, 'ok');
});

test('лишние ракушки срезаются до потолка, купленные остаются', () => {
  const s = {...fresh(NOW), shells: 999};
  const r = judge(s, null, 0, NONE, NOW);
  assert.equal(r.verdict, 'fixed');
  assert.equal(r.state.shells, BASE);
  assert.equal(judge({...fresh(NOW), shells: 150}, null, 0, {bought: 150, blessDays: 0, blessUntil: 0}, NOW).verdict, 'ok');
});

test('ракушки, уже принятые сервером, не срезаются', () => {
  const prev = {...fresh(NOW), shells: 80};
  assert.equal(judge({...prev, shells: 70}, prev, 20e3, NONE, NOW).verdict, 'ok');
});

test('подписка не длиннее, чем записано на сервере', () => {
  const r = judge({...fresh(NOW), blessUntil: NOW + 1e9}, null, 0, {bought: 0, blessDays: 30, blessUntil: NOW + 1000}, NOW);
  assert.equal(r.verdict, 'fixed');
  assert.equal(r.state.blessUntil, NOW + 1000);
});

test('скачок земель и добычи быстрее времени отклоняется', () => {
  const prev = {...fresh(NOW), stage: 4};
  assert.equal(judge({...prev, valley: 1, stage: 0, life: {...prev.life, migrations: 1}}, prev, 20e3, NONE, NOW).verdict, 'ok');
  assert.equal(judge({...prev, valley: 9, stage: 0}, prev, 20e3, NONE, NOW).verdict, 'reject');
  assert.equal(judge({...prev, valley: 2, stage: 0}, prev, 3600e3, NONE, NOW).verdict, 'reject');
  assert.equal(judge({...prev, earned: 1e12, life: {...prev.life, earned: 1e12}}, prev, 20e3, NONE, NOW).verdict, 'reject');
});

test('переселение без пройденных вех отклоняется, сколько ни жди', () => {
  const prev = {...fresh(NOW), stage: 3};
  assert.equal(judge({...prev, valley: 1, stage: 0, life: {...prev.life, migrations: 1}}, prev, 3600e3, NONE, NOW).verdict, 'reject');
  assert.equal(judge({...fresh(NOW), valley: 1, life: {...fresh(NOW).life, migrations: 1}}, fresh(NOW), 3600e3, NONE, NOW).verdict, 'reject');
});

test('веха засчитывается, только если её задания выполнены', () => {
  const prev = fresh(NOW);
  assert.equal(judge({...prev, stage: 1}, prev, 20e3, NONE, NOW).verdict, 'reject');
  const done = {...prev, stage: 1, taps: 20, peakHeat: 50, levels: {fire: 2}, earned: 500, life: {...prev.life, earned: 500}};
  assert.equal(judge(done, prev, 20e3, NONE, NOW).verdict, 'ok');
  assert.equal(judge({...done, stage: 99}, prev, 3600e3, NONE, NOW).verdict, 'reject');
});

test('повышенные рабочие не ломают уже пройденную веху', () => {
  const prev = {...fresh(NOW), stage: 1, taps: 20, peakHeat: 50, levels: {fire: 2}, earned: 3000, life: {...fresh(NOW).life, earned: 3000}};
  const next = {...prev, stage: 2, levels: {fire: 2, storage: 1, hunter: 0, tracker: 2}, earned: 5000, life: {...prev.life, earned: 5000}};
  assert.equal(judge(next, prev, 20e3, NONE, NOW).verdict, 'ok');
});

test('переселение и сброс не считаются подделкой', () => {
  const w = at({valley: 4, stage: 6, shells: 20, earned: 1e6, life: {taps: 0, earned: 1e6, mammoths: 0, tigers: 0, migrations: 4}});
  const prev = copy(w.state);
  assert.equal(judge(migrated(w), prev, 20e3, NONE, NOW).verdict, 'ok');
  const again = restarted(w, false);
  assert.equal(judge(again, prev, 20e3, NONE, NOW).verdict, 'ok');
  assert.equal(judge({...again, valley: 5}, prev, 20e3, NONE, NOW).verdict, 'reject');
});

test('постройки дороже заработанного отклоняются, старые сейвы прощаются', () => {
  const prev = {...fresh(NOW), earned: 1000, life: {...fresh(NOW).life, earned: 1000}};
  const forged = {...prev, levels: {storage: 40}};
  assert.ok(spent(forged) > 1e6);
  assert.equal(judge(forged, prev, 20e3, NONE, NOW).verdict, 'reject');
  assert.equal(judge(forged, forged, 20e3, NONE, NOW).verdict, 'ok');
  assert.equal(judge(forged, null, 0, NONE, NOW).verdict, 'ok');
});

test('битые числа отклоняются', () => {
  assert.equal(sane(fresh(NOW)), true);
  assert.equal(sane({...fresh(NOW), meat: NaN}), false);
  assert.equal(sane({...fresh(NOW), shells: -5}), false);
  assert.equal(sane({...fresh(NOW), levels: {fire: Infinity}}), false);
  assert.equal(judge({...fresh(NOW), meat: -1}, null, 0, NONE, NOW).verdict, 'reject');
});

test('подарок шамана считается купленными ракушками', () => {
  assert.equal(ledgerOf([{item: 'gift:50', count: 1}, {item: 'gift:7', count: 2}], 0).bought, 64);
  assert.equal(ledgerOf([{item: 'bless:7', count: 2}, {item: 'bless', count: 1}], 0).blessDays, 44);
});
