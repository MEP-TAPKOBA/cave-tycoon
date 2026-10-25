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
/** @type {Map<string, string>} */
let kv;
/** @type {Set<number>} */
let blocked;

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../server/schema.sql', import.meta.url), 'utf8'));
  calls = [];
  globalThis.fetch = async (/** @type {string} */ url, /** @type {any} */ init) => {
    calls.push({method: url.split('/').pop(), body: JSON.parse(init.body)});
    const method = url.split('/').pop();
    if (method === 'sendMessage' && blocked.has(JSON.parse(init.body).chat_id)) return Response.json({ok: false, description: 'Forbidden: bot was blocked by the user'});
    return Response.json({ok: true, result: method === 'createInvoiceLink' ? 'https://t.me/invoice/x' : {message_id: 100 + calls.length}});
  };
  kv = new Map();
  blocked = new Set();
  env = {TOKEN, HOOK, GAME, ADMIN: '7', KV: {get: async (/** @type {string} */ k) => kv.get(k) ?? null, put: async (/** @type {string} */ k, /** @type {string} */ v) => void kv.set(k, v)}, DB: {prepare: (/** @type {string} */ sql) => statement(db, sql), batch: async (/** @type {any[]} */ list) => { for (const st of list) await st.run(); }}};
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

/** @param {number} chat @param {string} text @returns {Promise<any>} */
const say = (chat, text) => hook({message: {from: {id: chat, first_name: 'Деня'}, chat: {id: chat}, message_id: 1, text}}).then(r => r.status === 200 && r.headers.get('content-type')?.includes('json') ? r.json() : null);

test('подарок ракушек командой /gift: игрок получает при входе, защита его учитывает', async () => {
  const r = await say(7, `/gift ${USER.id} 50`);
  assert.match(r.text, /Подарено 50 ракушек игроку #id42/);
  assert.equal(calls.at(-1).body.chat_id, USER.id);
  const claim = await ask('/claim');
  assert.deepEqual(claim.items, ['gift:50']);
  assert.equal((await ask('/save', {save: saveOf({shells: 50 + CEILING})})).ok, true);
  assert.equal((await ask('/claim')).items.length, 0);
});

test('/gift: только из чата Дени и с понятными числами', async () => {
  assert.equal(await say(USER.id, '/gift 42 50'), null);
  assert.match((await say(7, '/gift 42')).text, /^Формат/);
  assert.match((await say(7, '/gift 42 -5')).text, /^Формат/);
  assert.match((await say(7, '/gift 42 100000')).text, /^Формат/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM pays').get().n, 0);
});

test('сейв до вайпа (без метки эпохи) сервер не принимает', async () => {
  const old = JSON.stringify({...fresh(), epoch: undefined, meat: 500});
  const r = await worker.fetch(new Request('https://w.test/save', {method: 'POST', body: JSON.stringify({initData: initData(USER), save: old})}), env);
  assert.equal(r.status, 400);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM saves').get().n, 0);
});

/** @param {object} reply @returns {Promise<any>} */
const answer = reply => hook({message: {from: {id: 7}, chat: {id: 7}, message_id: 2, text: '/send', reply_to_message: reply}}).then(r => r.json());

test('/start записывает игрока, чтобы до него доходила рассылка', async () => {
  await say(55, '/start');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM players WHERE id = 55').get().n, 1);
});

test('рассылка: черновик, /send ответом на него, повтор не шлёт дважды', async () => {
  for (const id of [7, 55, 56, 57]) await say(id, '/start');
  blocked.add(57);
  calls = [];
  const r = await say(7, '/all Привет, вождь!\nНовая версия уже в игре.');
  assert.match(r.text, /игроки \(3\)/);
  assert.equal(calls[0].body.text, 'Привет, вождь!\nНовая версия уже в игре.');
  const draft = {message_id: 100 + 1, from: {is_bot: true}, text: calls[0].body.text};
  calls = [];
  assert.match((await answer(draft)).text, /^Разослано: 2 из 3 \(остальные закрыли бота\)\.$/);
  assert.deepEqual(calls.map(c => c.body.chat_id), [55, 56, 57]);
  calls = [];
  assert.match((await answer(draft)).text, /^Разослано: 0 из 0\.$/);
  assert.equal(calls.length, 0);
});

test('рассылка: /send не на черновик и чужие команды не срабатывают', async () => {
  await say(55, '/start');
  calls = [];
  assert.match((await answer({message_id: 999, from: {is_bot: true}, text: 'Сообщение от игрока'})).text, /^Ответь командой \/send/);
  assert.match((await say(7, '/all')).text, /^Формат/);
  assert.equal(await say(55, '/all всем привет'), null);
  assert.equal(calls.length, 0);
});

/** @param {{id:number,first_name:string,photo_url?:string}} user @param {Partial<import('../src/core/state.js').State>} patch @returns {Promise<any>} */
const saveAs = (user, patch) => worker.fetch(new Request('https://w.test/save', {method: 'POST', body: JSON.stringify({initData: initData(user), save: saveOf(patch)})}), env).then(r => r.json());

test('рейтинг: очки из сейва, порядок, кто раньше набрал - выше, скрытые не видны', async () => {
  await saveAs({id: 1, first_name: 'Аня', photo_url: 'https://t.me/i/userpic/320/a.jpg'}, {valley: 0, stage: 3});
  await saveAs({id: 2, first_name: 'Боря', photo_url: 'javascript:alert(1)'}, {valley: 0, stage: 3});
  await saveAs({id: 3, first_name: 'Вика'}, {valley: 0, stage: 1, noRank: true});
  await saveAs(USER, {valley: 0, stage: 2});
  const r = await ask('/top');
  assert.deepEqual(r.top.map((/** @type {any} */ p) => [p.name, p.score, p.me]), [['Аня', 3, false], ['Боря', 3, false], ['Вождь', 2, true]]);
  assert.equal(r.top[0].photo, 'https://t.me/i/userpic/320/a.jpg');
  assert.equal(r.top[1].photo, '');
  assert.equal(r.place, 3);
  assert.equal(r.top[0].id, undefined);
  await saveAs({id: 1, first_name: 'Аня'}, {valley: 0, stage: 3, taps: 5});
  assert.equal((await ask('/top')).top[0].name, 'Аня');
  await saveAs(USER, {valley: 0, stage: 2, noRank: true});
  const hidden = await ask('/top');
  assert.equal(hidden.place, 0);
  assert.equal(hidden.hidden, true);
  assert.equal(hidden.top.length, 2);
});

test('рейтинг: свежий сейв в запросе /top сразу даёт актуальные очки и место', async () => {
  await saveAs({id: 1, first_name: 'Аня'}, {valley: 0, stage: 1});
  await saveAs(USER, {valley: 0, stage: 0});
  const r = await ask('/top', {save: saveOf({valley: 0, stage: 2})});
  assert.equal(r.score, 2);
  assert.equal(r.place, 1);
  assert.deepEqual(r.top.map((/** @type {any} */ p) => [p.name, p.score]), [['Вождь', 2], ['Аня', 1]]);
  const forged = await ask('/top', {save: saveOf({valley: 50, stage: 0})});
  assert.equal(forged.score, 2);
});
