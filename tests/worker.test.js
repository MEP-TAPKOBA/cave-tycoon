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

let messageNo = 0;
/** @param {number} chat @param {string} text @param {number} [id] @returns {Promise<any>} */
const say = (chat, text, id = ++messageNo) => hook({message: {from: {id: chat, first_name: 'Деня'}, chat: {id: chat}, message_id: id, text}}).then(r => r.status === 200 && r.headers.get('content-type')?.includes('json') ? r.json() : null);

test('подарок ракушек командой /gift: игрок получает при входе, защита его учитывает', async () => {
  const r = await say(7, `/gift ${USER.id} 50`);
  assert.match(r.text, /Подарено игроку #id42: 50 ракушек/);
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

test('подарок подписки /bless: срок продлевается от сегодня или от конца подписки, защита его учитывает', async () => {
  const r = await say(7, `/bless ${USER.id} 7`);
  assert.match(r.text, /Подарено игроку #id42: Благословение шамана на 7 дней/);
  assert.match(calls.at(-1).body.text, /^Шаман благословил тебя на 7 дней: \+25%/);
  const status = await ask('/claim');
  assert.deepEqual(status.items, ['bless:7']);
  assert.ok(Math.abs(status.blessUntil - (Date.now() + 7 * 864e5)) < 5e3);
  await say(7, `/bless ${USER.id} 3`);
  const until = (await ask('/status')).blessUntil;
  assert.ok(Math.abs(until - (Date.now() + 10 * 864e5)) < 5e3);
  assert.equal((await ask('/save', {save: saveOf({blessUntil: until, shells: 10 * BLESS_GIFT + CEILING})})).ok, true);
  assert.equal((await ask('/save', {save: saveOf({blessUntil: until, shells: 11 * BLESS_GIFT + CEILING, restarts: 1})})).ok, false);
});

test('подаренные дни подписки не сгорают при продлении через Telegram', async () => {
  const DAY = 864e5, now = Date.now(), e1 = Math.floor(now / 1000) + 30 * 86400;
  /** @param {number} who @param {string} charge @param {number} exp */
  const renew = (who, charge, exp) => hook({message: {from: {id: who}, chat: {id: who}, successful_payment: {invoice_payload: 'bless', total_amount: 300, telegram_payment_charge_id: charge, subscription_expiration_date: exp, is_recurring: true}}});
  /** @param {number} who @returns {number} */
  const until = who => /** @type {any} */ (db.prepare('SELECT bless_until FROM players WHERE id = ?').get(who)).bless_until;
  await renew(USER.id, 'r1', e1);
  assert.equal(until(USER.id), e1 * 1000);
  await renew(USER.id, 'r2', e1 + 30 * 86400);
  assert.equal(until(USER.id), (e1 + 30 * 86400) * 1000);
  await say(7, `/bless ${USER.id} 7`);
  assert.equal(until(USER.id), (e1 + 30 * 86400) * 1000 + 7 * DAY);
  await renew(USER.id, 'r3', e1 + 60 * 86400);
  assert.equal(until(USER.id), (e1 + 60 * 86400) * 1000 + 7 * DAY);
  await renew(USER.id, 'r3', e1 + 60 * 86400);
  assert.equal(until(USER.id), (e1 + 60 * 86400) * 1000 + 7 * DAY);
  await say(7, '/bless 43 10');
  await renew(43, 'r4', e1);
  assert.ok(Math.abs(until(43) - (e1 * 1000 + 10 * DAY)) < 5e3);
});

test('/bless: только из чата Дени и с понятными числами', async () => {
  assert.equal(await say(USER.id, '/bless 42 7'), null);
  assert.match((await say(7, '/bless 42')).text, /^Формат/);
  assert.match((await say(7, '/bless 42 0')).text, /^Формат/);
  assert.match((await say(7, '/bless 42 1000')).text, /^Формат/);
  assert.match((await say(7, '/bless все 7')).text, /^Формат/);
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
  assert.match((await answer(draft)).text, /^Разослано: 2 из 3 \(остальные закрыли бота\)\.$/);
  assert.equal(calls.length, 0);
});

/** @returns {Promise<void>} */
async function cron() {
  /** @type {Promise<unknown>[]} */
  const jobs = [];
  worker.scheduled({}, env, {waitUntil: p => void jobs.push(p)});
  await Promise.all(jobs);
}

test('рассылка больше 45: один /send, остальным бот досылает сам по расписанию и пишет Дене', async () => {
  const ids = Array.from({length: 100}, (_, i) => 1000 + i);
  for (const id of [7, ...ids]) db.prepare('INSERT INTO players (id) VALUES (?)').run(id);
  blocked.add(1099);
  calls = [];
  await say(7, '/all Новая версия!');
  const draft = {message_id: 100 + 1, from: {is_bot: true}, text: 'Новая версия!'};
  calls = [];
  assert.equal((await answer(draft)).text, 'Отправлено 45 из 100, остальным разошлю сам в ближайшие минуты и напишу, когда закончу.');
  assert.equal(calls.length, 45);
  calls = [];
  await cron();
  assert.equal(calls.length, 45);
  assert.ok(calls.every(c => c.body.chat_id !== 7));
  calls = [];
  await cron();
  assert.deepEqual(calls.map(c => c.body.chat_id), [...ids.slice(90), '7']);
  assert.equal(calls.at(-1).body.text, 'Рассылка закончена: дошло до 99 из 100.');
  calls = [];
  await cron();
  assert.equal(calls.length, 0);
  assert.match((await answer(draft)).text, /^Разослано: 99 из 100/);
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

test('/gift all: подарок всем сразу, без черновика; сообщения больше 45 бот досылает сам', async () => {
  const ids = Array.from({length: 50}, (_, i) => 1000 + i);
  for (const id of [7, ...ids]) db.prepare('INSERT INTO players (id) VALUES (?)').run(id);
  blocked.add(1003);
  calls = [];
  const r = await say(7, '/gift all 20');
  assert.equal(r.text, 'Подарено всем игрокам (50): 20 ракушек. Сообщение дошло до 44, остальным 5 напишу сам в ближайшие минуты.');
  assert.equal(calls.length, 45);
  calls = [];
  await cron();
  assert.deepEqual(calls.map(c => c.body.chat_id), [...ids.slice(45), '7']);
  assert.equal(calls.at(-1).body.text, 'Сообщения о подарке разосланы: дошло до 49 из 50.');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM pays WHERE item = 'gift:20' AND user_id != 7").get().n, 50);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM pays WHERE user_id = 7').get().n, 0);
  assert.equal(kv.size, 0);
  calls = [];
  await say(7, '/gift all 20');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM pays WHERE item = 'gift:20'").get().n, 100);
  assert.equal(calls.length, 45);
});

test('/bless all: подписка всем сразу; повтор того же сообщения от Telegram не дарит дважды', async () => {
  for (const id of [7, 55, 56]) await say(id, '/start');
  calls = [];
  const r = await say(7, '/bless all 5', 500);
  assert.equal(r.text, 'Подарено всем игрокам (2): Благословение шамана на 5 дней. Сообщение дошло до 2.');
  const until = () => /** @type {any} */ (db.prepare('SELECT bless_until FROM players WHERE id = 55').get()).bless_until;
  const first = until();
  assert.ok(Math.abs(first - (Date.now() + 5 * 864e5)) < 5e3);
  await say(7, '/bless all 5', 500);
  assert.equal(until(), first);
  assert.equal(/** @type {any} */ (db.prepare('SELECT bless_until FROM players WHERE id = 7').get()).bless_until, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM pays WHERE item = 'bless:5'").get().n, 2);
  await say(7, '/bless all 5');
  assert.ok(Math.abs(until() - (first + 5 * 864e5)) < 5e3);
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
  const r = await ask('/top', {save: saveOf({valley: 0, stage: 2, taps: 20, peakHeat: 50, earned: 3000, levels: {fire: 2, hunter: 2, storage: 1}})});
  assert.equal(r.score, 2);
  assert.equal(r.place, 1);
  assert.deepEqual(r.top.map((/** @type {any} */ p) => [p.name, p.score]), [['Вождь', 2], ['Аня', 1]]);
  const forged = await ask('/top', {save: saveOf({valley: 50, stage: 0})});
  assert.equal(forged.score, 2);
});

test('после оплаты Дене приходит сообщение о покупке', async () => {
  calls = [];
  await pay('shells30', 'c9');
  const alert = calls.find(c => c.method === 'sendMessage' && c.body.chat_id === '7');
  assert.equal(alert.body.text, 'Покупка: Горсть ракушек, 50 звёзд.\nВождь, игрок #id42');
  calls = [];
  await hook({message: {from: USER, chat: {id: USER.id}, successful_payment: {invoice_payload: 'bless', total_amount: 300, telegram_payment_charge_id: 'c10', is_recurring: true}}});
  assert.match(calls.find(c => c.body.chat_id === '7').body.text, /^Покупка: Благословение шамана \(продление\), 300 звёзд/);
});
