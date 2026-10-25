import {STAR_ITEMS} from '../src/data/shop.js';
import {ahead, parseSave} from '../src/core/state.js';

/** @typedef {import('../src/data/shop.js').StarItem} StarItem */
/** @typedef {{item:string,charge:string,stars:number,at:number,given:boolean}} Pay */
/** @typedef {{id:number,first_name?:string,last_name?:string,username?:string}} User */
/** @typedef {{TOKEN:string,HOOK:string,GAME:string,ADMIN?:string,KV?:any,DB:any}} Env */

const DAY = 24 * 3600;
const INIT_TTL = 24 * 3600;
const MAX_SAVE = 64 * 1024;
const USER_TAG = /#id(\d+)/;

/** @param {string} id @returns {StarItem|undefined} */
const itemOf = id => STAR_ITEMS.find(i => i.id === id);

const SUPPORT = 'Вопросы по покупкам в «Пещерном магнате»: напиши сюда, что купил, когда и что пошло не так. Ответим и, если покупка не пришла, вернём звёзды.';
const HELLO = 'Привет, вождь! Племя ждёт: костёр не разожжён, а мамонты бродят совсем рядом.\n\nЖми «Играть», чтобы открыть «Пещерного магната». Прогресс сохраняется на сервере игры, так что играть можно и с телефона, и с компьютера.\n\nВопросы по покупкам: /paysupport';
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
  if (text.startsWith('/start')) return {method: 'sendMessage', chat_id: msg.chat.id, text: HELLO, reply_markup: {inline_keyboard: [[{text: 'Играть', web_app: {url: env.GAME}}]]}};
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

/** @param {Env} env @param {User} user @param {unknown} text @returns {Promise<Response>} */
async function store(env, user, text) {
  const s = typeof text === 'string' && text.length <= MAX_SAVE ? parseSave(text) : null;
  if (!s) return new Response('bad save', {status: 400});
  const now = Date.now(), row = await env.DB.prepare('SELECT data, saved_at FROM saves WHERE id = ?').bind(user.id).first();
  if (row && ahead(parseSave(row.data), s)) return Response.json({ok: false, save: row.data, savedAt: row.saved_at, now});
  await env.DB.prepare('INSERT INTO saves (id, data, saved_at, name) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, saved_at = excluded.saved_at, name = excluded.name').bind(user.id, text, now, nameOf(user)).run();
  return Response.json({ok: true, savedAt: now, now});
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
    else res = new Response('not found', {status: 404});
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    return res;
  },
};
