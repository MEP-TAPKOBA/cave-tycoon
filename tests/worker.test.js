import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {beforeEach, test} from 'node:test';
import {BLESS_GIFT} from '../src/config.js';
import {STAR_ITEMS} from '../src/data/shop.js';
import {SHELL_SLACK} from '../src/core/check.js';
import {fresh} from '../src/core/state.js';
import worker from '../server/worker.js';

const TOKEN = '123:test';
const HOOK = 'hook-secret';
const GAME = 'https://game.test/';
const USER = {id: 42, first_name: 'Вождь'};
const CEILING = fresh().shells + BLESS_GIFT + SHELL_SLACK;

/** @param {DatabaseSync} db @param {string} sql */
function statement(db, sql) {
  /** @type {any[]} */
  let args = [];
  const st = {
    bind: (/** @type {any[]} */ ...a) => (args = a, st),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({results: db.prepare(sql).all(...args)}),
    run: async () => db.prepare(sql).run(...args),
  };
  return st;
}

/** @type {DatabaseSync} */
let db;
/** @type {any[]} */
let calls;
/** @type {any} */
let env;

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../server/schema.sql', import.meta.url), 'utf8'));
  calls = [];
  globalThis.fetch = async (/** @type {string} */ url, /** @type {any} */ init) => {
    calls.push({method: url.split('/').pop(), body: JSON.parse(init.body)});
    return Response.json({ok: true, result: 'https://t.me/invoice/x'});
  };
  env = {TOKEN, HOOK, GAME, DB: {prepare: (/** @type {string} */ sql) => statement(db, sql), batch: async (/** @type {any[]} */ list) => { for (const st of list) await st.run(); }}};
});

/** @param {object} user @returns {string} */
function initData(user) {
  const p = new URLSearchParams({auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user)});
  const data = [...p].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  p.set('hash', createHmac('sha256', secret).update(data).digest('hex'));
  return p.toString();
}

/** @param {string} path @param {object} [extra] @returns {Promise<any>} */
const ask = (path, extra = {}) => worker.fetch(new Request('https://w.test' + path, {method: 'POST', body: JSON.stringify({initData: initData(USER), ...extra})}), env).then(r => r.json());

/** @param {object} update @returns {Promise<Response>} */
const hook = update => worker.fetch(new Request('https://w.test/tg', {method: 'POST', headers: {'x-telegram-bot-api-secret-token': HOOK}, body: JSON.stringify(update)}), env);

/** @param {string} item @param {string} charge */
async function pay(item, charge) {
  const it = STAR_ITEMS.find(i => i.id === item);
  await hook({message: {from: USER, chat: {id: USER.id}, successful_payment: {invoice_payload: item, total_amount: it.stars, telegram_payment_charge_id: charge}}});
}

/** @param {Partial<import('../src/core/state.js').State>} patch @returns {string} */
const saveOf = patch => JSON.stringify({...fresh(), ...patch});
/** @returns {any} */
const stored = () => JSON.parse(/** @type {any} */ (db.prepare('SELECT data FROM saves WHERE id = ?').get(USER.id)).data);

test('чужая подпись: 403', async () => {
  const r = await worker.fetch(new Request('https://w.test/load', {method: 'POST', body: JSON.stringify({initData: initData(USER).replace('hash=', 'hash=0')})}), env);
  assert.equal(r.status, 403);
});

test('счёт собирается из STAR_ITEMS', async () => {
  await ask('/invoice', {item: 'bless'});
  const it = STAR_ITEMS.find(i => i.id === 'bless');
  assert.equal(calls[0].method, 'createInvoiceLink');
  assert.equal(calls[0].body.title, it.name);
  assert.equal(calls[0].body.prices[0].amount, it.stars);
  assert.equal(calls[0].body.subscription_period, 30 * 24 * 3600);
  assert.match(calls[0].body.description, /^На 30 дней/);
});

test('проверка перед оплатой: цена из STAR_ITEMS, Хранитель один раз', async () => {
  const pre = (/** @type {string} */ item, /** @type {number} */ total) => hook({pre_checkout_query: {id: 'q', from: USER, currency: 'XTR', invoice_payload: item, total_amount: total}}).then(r => r.json());
  assert.equal((await pre('shells30', 50)).ok, true);
  assert.equal((await pre('shells30', 1)).ok, false);
  await pay('keeper', 'c1');
  assert.equal((await pre('keeper', 150)).ok, false);
});

test('честный сейв сохраняется', async () => {
  const text = saveOf({shells: 6, meat: 100, earned: 100}), r = await ask('/save', {save: text});
  assert.equal(r.ok, true);
  assert.equal(stored().meat, 100);
  assert.equal((await ask('/load')).save, text);
});

test('накрученные ракушки срезаются, игре уходит исправленная копия', async () => {
  const r = await ask('/save', {save: saveOf({shells: 5000})});
  assert.equal(r.ok, false);
  assert.equal(JSON.parse(r.save).shells, CEILING);
  assert.equal(stored().shells, CEILING);
});

test('ракушки за звёзды учитываются сервером', async () => {
  await pay('shells150', 'c2');
  const claim = await ask('/claim');
  assert.deepEqual(claim.items, ['shells150']);
  assert.equal((await ask('/save', {save: saveOf({shells: 154})})).ok, true);
  assert.equal((await ask('/save', {save: saveOf({shells: 154 + CEILING})})).ok, false);
  assert.equal(stored().shells, 150 + CEILING);
});

test('подписка из сейва не длиннее серверной', async () => {
  const r = await ask('/save', {save: saveOf({blessUntil: Date.now() + 1e9})});
  assert.equal(JSON.parse(r.save).blessUntil, 0);
  await pay('bless', 'c3');
  const until = /** @type {any} */ (db.prepare('SELECT bless_until FROM players WHERE id = ?').get(USER.id)).bless_until;
  assert.ok(until > Date.now() + 29 * 24 * 3600e3);
  assert.equal((await ask('/save', {save: saveOf({blessUntil: until, restarts: 1})})).ok, true);
});

test('скачок через земли отклоняется, игре уходит серверная копия', async () => {
  await ask('/save', {save: saveOf({meat: 10, earned: 10})});
  const r = await ask('/save', {save: saveOf({valley: 20, life: {taps: 0, earned: 0, mammoths: 0, tigers: 0, migrations: 20}})});
  assert.equal(r.ok, false);
  assert.equal(JSON.parse(r.save).valley, 0);
  assert.equal(stored().valley, 0);
});

test('устаревшая копия не затирает серверную', async () => {
  await ask('/save', {save: saveOf({restarts: 2})});
  const r = await ask('/save', {save: saveOf({restarts: 1})});
  assert.equal(r.ok, false);
  assert.equal(JSON.parse(r.save).restarts, 2);
});

test('битый сейв: 400', async () => {
  const r = await worker.fetch(new Request('https://w.test/save', {method: 'POST', body: JSON.stringify({initData: initData(USER), save: '{"meat":"x"}'})}), env);
  assert.equal(r.status, 400);
});
