import {SAVE_EPOCH} from '../src/config.js';
import {STAR_ITEMS} from '../src/data/shop.js';
import {judge, ledgerOf} from '../src/core/check.js';
import {rankScore} from '../src/core/quests.js';
import {ahead, parseSave} from '../src/core/state.js';

/** @typedef {import('../src/data/shop.js').StarItem} StarItem */
/** @typedef {{item:string,charge:string,stars:number,at:number,given:boolean}} Pay */
/** @typedef {{id:number,first_name?:string,last_name?:string,username?:string,photo_url?:string}} User */
/** @typedef {{TOKEN:string,HOOK:string,GAME:string,ADMIN?:string,KV?:any,DB:any}} Env */

const DAY = 24 * 3600;
const INIT_TTL = 24 * 3600;
const MAX_SAVE = 64 * 1024;
const TOP = 50;
const PHOTO = /^https:\/\/t\.me\/[\w./-]+$/;
const USER_TAG = /#id(\d+)/;

/** @param {string} id @returns {StarItem|undefined} */
const itemOf = id => STAR_ITEMS.find(i => i.id === id);

const SUPPORT = 'Вопросы по покупкам в «Пещерном магнате»: напиши сюда, что купил, когда и что пошло не так. Ответим и, если покупка не пришла, вернём звёзды.';
const HELLO = 'Привет, вождь! Племя ждёт: костёр не разожжён, а мамонты бродят совсем рядом.\n\nЖми «Играть», чтобы открыть «Пещерного магната». Прогресс сохраняется на сервере игры, так что играть можно и с телефона, и с компьютера.\n\nВопросы по покупкам: /paysupport';
const GIFT_USAGE = 'Формат: /gift <номер игрока> <сколько ракушек>, например /gift 123456789 50';
const MAX_GIFT = 10000;
const ALL_USAGE = 'Формат: /all <текст рассылки>. Бот покажет черновик, отправка - ответом /send на него.';
const MAX_BROADCAST = 45;
const PASSED = 'Сообщение передано. Ответим здесь же, в этом чате.';
const HOW_TO_REPLY = 'Ответь на это сообщение, чтобы ответить игроку.';

const enc = new TextEncoder();

/** @param {Env} env @param {string} method @param {object} body @returns {Promise<any>} */
const api = (env, method, body) => fetch(`https://api.telegram.org/bot${env.TOKEN}/${method}`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)}).then(r => r.json());

/** @param {Uint8Array} key @param {string} msg @returns {Promise<Uint8Array>} */
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', key, {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}

/** @param {string} initData @param {string} token @returns {Promise<User|null>} */
export async function checkInit(initData, token) {
  const p = new URLSearchParams(initData || ''), hash = p.get('hash') || '';
  p.delete('hash');
  const data = [...p].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const check = [...await hmac(await hmac(enc.encode('WebAppData'), token), data)].map(b => b.toString(16).padStart(2, '0')).join('');
  let diff = check.length ^ hash.length;
  for (let i = 0; i < check.length; i++) diff |= check.charCodeAt(i) ^ (hash.charCodeAt(i) || 0);
  if (diff || Date.now() / 1000 - Number(p.get('auth_date')) > INIT_TTL) return null;
  try { return JSON.parse(p.get('user') || 'null'); } catch { return null; }
}

/** @param {User} u @returns {string} */
const nameOf = u => [u.first_name, u.last_name].filter(Boolean).join(' ') + (u.username ? ` (@${u.username})` : '');

/** @param {Env} env @param {number} id @returns {Promise<void>} */
async function ensurePlayer(env, id) {
  if (await env.DB.prepare('SELECT 1 FROM players WHERE id = ?').bind(id).first()) return;
  const old = env.KV ? JSON.parse(await env.KV.get(`user:${id}`) || 'null') : null;
  /** @type {Pay[]} */
  const pays = old?.pays || [];
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO players (id, keeper, bless_until) VALUES (?, ?, ?)').bind(id, old?.keeper ? 1 : 0, old?.blessUntil || 0),
    ...pays.map(p => env.DB.prepare('INSERT OR IGNORE INTO pays (charge, user_id, item, stars, at, given) VALUES (?, ?, ?, ?, ?, ?)').bind(p.charge, id, p.item, p.stars, p.at, p.given ? 1 : 0)),
  ]);
}

/** @param {Env} env @param {number} id @returns {Promise<{keeper:boolean,blessUntil:number}>} */
async function statusOf(env, id) {
  await ensurePlayer(env, id);
  const p = await env.DB.prepare('SELECT keeper, bless_until FROM players WHERE id = ?').bind(id).first();
  return {keeper: Boolean(p?.keeper), blessUntil: p && p.bless_until > Date.now() ? p.bless_until : 0};
}

/** @param {Env} env @param {any} q @returns {Promise<object>} */
async function preCheckout(env, q) {
  const it = itemOf(q.invoice_payload);
  const no = (/** @type {string} */ error_message) => ({method: 'answerPreCheckoutQuery', pre_checkout_query_id: q.id, ok: false, error_message});
  if (!it || q.currency !== 'XTR' || q.total_amount !== it.stars) return no('Этот товар больше не продаётся. Открой игру заново.');
  if (it.once && (await statusOf(env, q.from.id)).keeper) return no('Хранитель огня у тебя уже есть.');
  return {method: 'answerPreCheckoutQuery', pre_checkout_query_id: q.id, ok: true};
}

/** @param {Env} env @param {any} msg @returns {Promise<void>} */
async function paid(env, msg) {
  const pay = msg.successful_payment, id = msg.from.id, item = pay.invoice_payload, it = itemOf(item);
  await ensurePlayer(env, id);
  const stmts = [env.DB.prepare('INSERT OR IGNORE INTO pays (charge, user_id, item, stars, at, given) VALUES (?, ?, ?, ?, ?, 0)').bind(pay.telegram_payment_charge_id, id, item, pay.total_amount, Date.now())];
  if (it?.once) stmts.push(env.DB.prepare('UPDATE players SET keeper = 1 WHERE id = ?').bind(id));
  if (it?.days) stmts.push(env.DB.prepare('UPDATE players SET bless_until = MAX(bless_until, ?) WHERE id = ?').bind((pay.subscription_expiration_date || Date.now() / 1000 + it.days * DAY) * 1000, id));
  await env.DB.batch(stmts);
  if (!env.ADMIN) return;
  const kind = pay.is_first_recurring ? ' (первая оплата)' : pay.is_recurring ? ' (продление)' : '';
  await api(env, 'sendMessage', {chat_id: env.ADMIN, text: `Покупка: ${it?.name || item}${kind}, ${pay.total_amount} звёзд.\n${nameOf(msg.from)}, игрок #id${id}`}).catch(() => null);
}

/** @param {Env} env @param {any} msg @returns {Promise<object>} */
async function gift(env, msg) {
  const [, to, n] = String(msg.text).trim().split(/\s+/).map(Number);
  const reply = (/** @type {string} */ text) => ({method: 'sendMessage', chat_id: msg.chat.id, text});
  if (!Number.isInteger(to) || to <= 0 || !Number.isInteger(n) || n < 1 || n > MAX_GIFT) return reply(GIFT_USAGE);
  await ensurePlayer(env, to);
  await env.DB.prepare('INSERT INTO pays (charge, user_id, item, stars, at, given) VALUES (?, ?, ?, 0, ?, 0)').bind(`gift-${crypto.randomUUID()}`, to, `gift:${n}`, Date.now()).run();
  const r = await api(env, 'sendMessage', {chat_id: to, text: `Шаман прислал тебе ракушки: ${n}. Загляни в игру, они уже ждут!`});
  return reply(`Подарено ${n} ракушек игроку #id${to}. Получит при входе в игру.` + (r.ok ? '' : ' Сообщение игроку не дошло: он ещё не писал боту.'));
}

/** @param {Env} env @param {string} admin @returns {Promise<number[]>} */
async function audience(env, admin) {
  const {results} = await env.DB.prepare('SELECT id FROM players ORDER BY id').all();
  return results.map((/** @type {{id:number}} */ r) => r.id).filter((/** @type {number} */ id) => String(id) !== admin);
}

/** @param {Env} env @param {any} msg @returns {Promise<object>} */
async function draft(env, msg) {
  const text = String(msg.text).replace(/^\/all(@\w+)?\s*/, '').trim();
  if (!text) return {method: 'sendMessage', chat_id: msg.chat.id, text: ALL_USAGE};
  if (!env.KV) return {method: 'sendMessage', chat_id: msg.chat.id, text: 'Рассылка не работает: у сервера нет KV.'};
  const n = (await audience(env, env.ADMIN)).length;
  const sent = await api(env, 'sendMessage', {chat_id: msg.chat.id, text});
  if (!sent.ok) return {method: 'sendMessage', chat_id: msg.chat.id, text: `Черновик не создан: ${sent.description || 'ошибка Telegram'}`};
  await env.KV.put(`draft:${sent.result.message_id}`, '[]', {expirationTtl: 30 * DAY});
  return {method: 'sendMessage', chat_id: msg.chat.id, text: `Так сообщение увидят игроки (${n}). Чтобы разослать, ответь на него командой /send.` + (n > MAX_BROADCAST ? ` За один раз уйдёт ${MAX_BROADCAST}, остальным - повторным /send на тот же черновик.` : '')};
}

/** @param {Env} env @param {any} msg @returns {Promise<object>} */
async function broadcast(env, msg) {
  const src = msg.reply_to_message, reply = (/** @type {string} */ text) => ({method: 'sendMessage', chat_id: msg.chat.id, text});
  const key = `draft:${src?.message_id}`, saved = src?.text && env.KV ? await env.KV.get(key) : null;
  if (saved === null) return reply('Ответь командой /send на черновик, который прислал бот после /all.');
  const done = new Set(JSON.parse(saved));
  const ids = (await audience(env, env.ADMIN)).filter(id => !done.has(id)), batch = ids.slice(0, MAX_BROADCAST);
  let ok = 0;
  for (const id of batch) {
    done.add(id);
    if ((await api(env, 'sendMessage', {chat_id: id, text: src.text})).ok) ok++;
  }
  await env.KV.put(key, JSON.stringify([...done]), {expirationTtl: 30 * DAY});
  const left = ids.length - batch.length;
  return reply(`Разослано: ${ok} из ${batch.length}` + (batch.length > ok ? ' (остальные закрыли бота)' : '') + (left ? `. Осталось ${left}: ответь /send на тот же черновик ещё раз.` : '.'));
}

/** @param {Env} env @param {any} msg @returns {Promise<object|null>} */
async function support(env, msg) {
  if (!env.ADMIN) return null;
  if (String(msg.chat.id) === env.ADMIN) {
    const to = msg.reply_to_message?.text?.match(USER_TAG)?.[1];
    if (!to || !msg.text) return null;
    const r = await api(env, 'sendMessage', {chat_id: Number(to), text: `Ответ поддержки:\n\n${msg.text}`});
    return {method: 'sendMessage', chat_id: msg.chat.id, reply_to_message_id: msg.message_id, text: r.ok ? 'Отправлено.' : `Не отправлено: ${r.description || 'ошибка Telegram'}`};
  }
  const head = `Сообщение от ${nameOf(msg.from)}, игрок #id${msg.from.id}`;
  if (msg.text) await api(env, 'sendMessage', {chat_id: env.ADMIN, text: `${head}:\n\n${msg.text}\n\n${HOW_TO_REPLY}`});
  else {
    await api(env, 'sendMessage', {chat_id: env.ADMIN, text: `${head}: вложение, пересылаю ниже.\n\n${HOW_TO_REPLY}`});
    await api(env, 'forwardMessage', {chat_id: env.ADMIN, from_chat_id: msg.chat.id, message_id: msg.message_id});
  }
  return {method: 'sendMessage', chat_id: msg.chat.id, text: PASSED};
}

/** @param {Env} env @param {any} u @returns {Promise<object|null>} */
async function hook(env, u) {
  if (u.pre_checkout_query) return preCheckout(env, u.pre_checkout_query);
  const msg = u.message;
  if (!msg) return null;
  if (msg.successful_payment) {
    await paid(env, msg);
    return null;
  }
  const text = String(msg.text || '');
  if (text.startsWith('/paysupport')) return {method: 'sendMessage', chat_id: msg.chat.id, text: SUPPORT};
  if (text.startsWith('/start')) {
    await ensurePlayer(env, msg.from.id);
    return {method: 'sendMessage', chat_id: msg.chat.id, text: HELLO, reply_markup: {inline_keyboard: [[{text: 'Играть', web_app: {url: env.GAME}}]]}};
  }
  const admin = Boolean(env.ADMIN) && String(msg.chat.id) === env.ADMIN;
  if (admin && text.startsWith('/gift')) return gift(env, msg);
  if (admin && text.startsWith('/all')) return draft(env, msg);
  if (admin && text.startsWith('/send')) return broadcast(env, msg);
  if (text.startsWith('/')) return null;
  return support(env, msg);
}

/** @param {Env} env @param {string} item @returns {Promise<Response>} */
async function invoice(env, item) {
  const it = itemOf(item);
  if (!it) return new Response('unknown item', {status: 400});
  const description = it.desc[0].toUpperCase() + it.desc.slice(1);
  const r = await api(env, 'createInvoiceLink', {title: it.name, description, payload: item, currency: 'XTR', prices: [{label: it.name, amount: it.stars}], ...(it.days ? {subscription_period: it.days * DAY} : {})});
  return r.ok ? Response.json({link: r.result}) : new Response(r.description || 'telegram error', {status: 502});
}

/** @param {Env} env @param {User} user @returns {Promise<Response>} */
async function claim(env, user) {
  const status = await statusOf(env, user.id);
  const {results} = await env.DB.prepare('UPDATE pays SET given = 1 WHERE user_id = ? AND given = 0 RETURNING item').bind(user.id).all();
  return Response.json({items: results.map((/** @type {{item:string}} */ r) => r.item), ...status});
}

/** @param {Env} env @param {User} user @returns {Promise<Response>} */
async function load(env, user) {
  const row = await env.DB.prepare('SELECT data, saved_at FROM saves WHERE id = ?').bind(user.id).first();
  return Response.json({save: row?.data ?? null, savedAt: row?.saved_at ?? 0, now: Date.now()});
}

/** @param {Env} env @param {number} id @returns {Promise<import('../src/core/check.js').Ledger>} */
async function ledger(env, id) {
  await ensurePlayer(env, id);
  const p = await env.DB.prepare('SELECT bless_until FROM players WHERE id = ?').bind(id).first();
  const {results} = await env.DB.prepare('SELECT item, COUNT(*) AS count FROM pays WHERE user_id = ? GROUP BY item').bind(id).all();
  return ledgerOf(results, p?.bless_until || 0);
}

/** @param {Env} env @param {User} user @returns {Promise<Response>} */
async function top(env, user) {
  const {results} = await env.DB.prepare('SELECT id, first, photo, score FROM saves WHERE hidden = 0 ORDER BY score DESC, score_at, id LIMIT ?').bind(TOP).all();
  const me = await env.DB.prepare('SELECT score, score_at, hidden FROM saves WHERE id = ?').bind(user.id).first();
  const ahead = me && !me.hidden ? await env.DB.prepare('SELECT COUNT(*) AS n FROM saves WHERE hidden = 0 AND (score > ? OR (score = ? AND (score_at < ? OR (score_at = ? AND id < ?))))').bind(me.score, me.score, me.score_at, me.score_at, user.id).first() : null;
  return Response.json({top: results.map((/** @type {{id:number,first:string,photo:string,score:number}} */ r) => ({name: r.first || 'Вождь', photo: r.photo, score: r.score, me: r.id === user.id})), place: ahead ? ahead.n + 1 : 0, score: me?.score ?? 0, hidden: Boolean(me?.hidden)});
}

/** @param {Env} env @param {User} user @param {unknown} text @returns {Promise<Response>} */
async function store(env, user, text) {
  const s = typeof text === 'string' && text.length <= MAX_SAVE && text.includes(`"epoch":${SAVE_EPOCH}`) ? parseSave(text) : null;
  if (!s) return new Response('bad save', {status: 400});
  const now = Date.now(), row = await env.DB.prepare('SELECT data, saved_at FROM saves WHERE id = ?').bind(user.id).first();
  const prev = row ? parseSave(row.data) : null;
  if (prev && ahead(prev, s)) return Response.json({ok: false, save: row.data, savedAt: row.saved_at, now});
  const {verdict, state} = judge(s, prev, row ? now - row.saved_at : 0, await ledger(env, user.id), now);
  if (verdict === 'reject') return Response.json({ok: false, save: row?.data ?? null, savedAt: row?.saved_at ?? now, now});
  const data = verdict === 'fixed' ? JSON.stringify(state) : text;
  const photo = PHOTO.test(user.photo_url || '') ? user.photo_url : '';
  await env.DB.prepare('INSERT INTO saves (id, data, saved_at, name, score, score_at, first, photo, hidden) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, saved_at = excluded.saved_at, name = excluded.name, score_at = CASE WHEN excluded.score = saves.score THEN saves.score_at ELSE excluded.score_at END, score = excluded.score, first = excluded.first, photo = excluded.photo, hidden = excluded.hidden').bind(user.id, data, now, nameOf(user), rankScore(state), now, (user.first_name || 'Вождь').slice(0, 64), photo, state.noRank ? 1 : 0).run();
  return Response.json(verdict === 'fixed' ? {ok: false, save: data, savedAt: now, now} : {ok: true, savedAt: now, now});
}

export default {
  /** @param {Request} req @param {Env} env @returns {Promise<Response>} */
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = {'access-control-allow-origin': new URL(env.GAME).origin, 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type', vary: 'origin'};
    if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
    if (req.method !== 'POST') return new Response('not found', {status: 404});
    if (url.pathname === '/tg') {
      if (req.headers.get('x-telegram-bot-api-secret-token') !== env.HOOK) return new Response('forbidden', {status: 403});
      const out = await hook(env, await req.json());
      return out ? Response.json(out) : new Response('ok');
    }
    /** @type {any} */
    let body;
    try { body = JSON.parse(await req.text()); } catch { return new Response('bad request', {status: 400, headers: cors}); }
    const user = await checkInit(body.initData, env.TOKEN);
    if (!user) return new Response('forbidden', {status: 403, headers: cors});
    /** @type {Response} */
    let res;
    if (url.pathname === '/invoice') res = await invoice(env, body.item);
    else if (url.pathname === '/claim') res = await claim(env, user);
    else if (url.pathname === '/status') res = Response.json(await statusOf(env, user.id));
    else if (url.pathname === '/load') res = await load(env, user);
    else if (url.pathname === '/save') res = await store(env, user, body.save);
    else if (url.pathname === '/top') {
      if (body.save) await store(env, user, body.save);
      res = await top(env, user);
    }
    else res = new Response('not found', {status: 404});
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    return res;
  },
};
