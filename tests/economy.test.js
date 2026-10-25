import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BLESS_OFFLINE_CAP, KEEPER_HEAT, OFFLINE_CAP, OFFLINE_SHARE} from '../src/config.js';
import {up} from '../src/format.js';
import {BOOSTS} from '../src/data/shop.js';
import {WORKERS} from '../src/data/units.js';
import {addMeat, claimAch, cooled, grant, heatTick, migrated, offline, purchase, purchaseBoost, restarted, shellReward} from '../src/core/economy.js';
import {perSec} from '../src/core/formulas.js';
import {rankScore} from '../src/core/quests.js';
import {NOW, at} from './world.js';

const HOUR = 3600e3;

test('мясо сверх склада пропадает', () => {
  const w = at({meat: 2400});
  assert.equal(addMeat(w, 500), 100);
  assert.equal(w.state.meat, 2500);
  assert.equal(w.state.life.earned, 100);
});

test('покупка, места в пещере, повышение', () => {
  const w = at({meat: 1100});
  assert.equal(purchase(w, WORKERS[1]), false);
  assert.equal(purchase(w, WORKERS[0]), true);
  assert.equal(w.state.meat, 1050);
  assert.equal(purchase(w, WORKERS[1]), true);
  assert.deepEqual(w.state.levels, {hunter: 0, tracker: 1});
  const full = at({meat: 1e6, levels: {hunter: 2}});
  assert.equal(purchase(full, WORKERS[0]), false);
});

test('доход вне игры: доля и лимит 2 часа', () => {
  const w = at({levels: {hunter: 2, storage: 40}});
  const rate = perSec(w);
  const r = offline(w, NOW - HOUR);
  assert.equal(r.away, 3600);
  assert.equal(r.want, rate * 3600 * OFFLINE_SHARE);
  assert.equal(r.earned, up(r.want));
  assert.equal(offline(at({levels: {hunter: 2, storage: 40}}), NOW - 10 * HOUR).away, OFFLINE_CAP);
});

test('доход вне игры с подпиской копится 4 часа', () => {
  const w = at({levels: {hunter: 2, storage: 40}, blessUntil: NOW + HOUR});
  assert.equal(offline(w, NOW - 10 * HOUR).away, BLESS_OFFLINE_CAP);
});

test('доход вне игры: страх режет добычу, склад ограничивает', () => {
  const calm = at({levels: {hunter: 2, storage: 40}}), scared = at({levels: {hunter: 2, storage: 40}, scaredUntil: NOW - HOUR / 2});
  const half = offline(scared, NOW - HOUR).want, full = offline(calm, NOW - HOUR).want;
  assert.equal(half, (perSec(calm, false) * 1800 + perSec(calm, true) * 1800) * OFFLINE_SHARE);
  assert.ok(half < full);
  const small = at({levels: {hunter: 2}});
  const r = offline(small, NOW - HOUR);
  assert.equal(r.earned, 2500);
  assert.ok(r.want > r.earned);
});

test('доход вне игры: пшено растёт и съедается', () => {
  const w = at({levels: {field: 1, goat: 1, granary: 5}, grain: 100});
  offline(w, NOW - 60e3);
  assert.equal(w.state.grain, 100 + 300 - 180);
});

test('жар: остывание вне игры, Кремень, праздник, Хранитель', () => {
  assert.equal(cooled(at(), 50, 100e3), 30);
  assert.equal(cooled(at({techs: ['flint']}), 50, 100e3), 40);
  assert.equal(cooled(at({boosts: {feast: NOW + 1}}), 50, 1e9), 50);
  assert.equal(heatTick(at({perks: ['keeper']}, {heat: 0}), 1, 0), KEEPER_HEAT);
  assert.equal(heatTick(at({perks: ['keeper']}, {heat: 0}), 1, .8), 0);
});

test('ракушки за переселение: 2 + 1 за две земли, не больше 10', () => {
  assert.equal(shellReward(at({valley: 0})), 2);
  assert.equal(shellReward(at({valley: 3})), 3);
  assert.equal(shellReward(at({valley: 15})), 9);
  assert.equal(shellReward(at({valley: 16})), 10);
  assert.equal(shellReward(at({valley: 40})), 10);
});

test('переселение и сброс сохраняют нужное', () => {
  const w = at({valley: 2, shells: 5, meat: 1e5, perks: ['keeper'], restarts: 1, levels: {fire: 9}, noBuzz: true});
  const next = migrated(w);
  assert.equal(next.valley, 3);
  assert.equal(next.shells, 8);
  assert.equal(next.meat, 0);
  assert.deepEqual(next.levels, {});
  assert.deepEqual(next.perks, ['keeper']);
  assert.equal(next.life.migrations, 1);
  assert.equal(next.noBuzz, true);
  const reset = restarted(w, false);
  assert.equal(reset.restarts, 2);
  assert.equal(reset.valley, 0);
  assert.deepEqual(reset.perks, []);
  assert.deepEqual(restarted(w, true).perks, ['keeper']);
});

test('лавка: цена, разовые покупки, таймер', () => {
  const keeper = BOOSTS.find(b => b.id === 'keeper'), hunt = BOOSTS.find(b => b.id === 'hunt');
  const w = at({shells: 70});
  assert.equal(purchaseBoost(w, keeper), true);
  assert.equal(purchaseBoost(w, keeper), false);
  assert.equal(purchaseBoost(w, hunt), true);
  assert.equal(w.state.shells, 70 - 50 - 12);
  assert.equal(w.state.boosts.hunt, NOW + 30 * 60e3);
});

test('достижение даёт ракушки один раз за ступень', () => {
  const w = at({life: {taps: 0, earned: 1, mammoths: 0, tigers: 0, migrations: 0}});
  const got = claimAch(w);
  assert.equal(got.ach.id, 'meat');
  assert.equal(got.reward, 1);
  assert.equal(w.state.shells, 5);
  assert.equal(claimAch(w), null);
});

test('подарок шамана: ракушки любого размера', () => {
  const w = at({shells: 4});
  assert.equal(grant(w, 'gift:50').shells, 50);
  assert.equal(w.state.shells, 54);
  assert.equal(grant(w, 'gift:x'), undefined);
});

test('очки рейтинга: веха 1, переселение 2; выключатель переживает переселение и сброс', () => {
  assert.equal(rankScore(at({valley: 0, stage: 3}).state), 3);
  assert.equal(rankScore(at({valley: 1, stage: 2}).state), 4 + 2 + 2);
  const w = at({valley: 2, stage: 5, noRank: true});
  assert.equal(migrated(w).noRank, true);
  assert.equal(restarted(w, false).noRank, true);
  assert.equal(rankScore(restarted(w, false)), 0);
});
