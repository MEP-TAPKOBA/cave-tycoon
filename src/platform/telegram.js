import {SERVER} from '../config.js';

/** @typedef {import('../core/state.js').World} World */

/** @type {any} */
export const tg = /** @type {any} */ (window).Telegram?.WebApp;
export const inTelegram = Boolean(tg?.initData);
/** @param {string} v @returns {boolean} */
export const tgAt = v => inTelegram && tg.isVersionAtLeast(v);
export const serverSaves = inTelegram && Boolean(SERVER);
export const shopStars = inTelegram && tgAt('6.1') && Boolean(SERVER);
if (inTelegram) {
  tg.ready();
  tg.expand();
  if (tgAt('7.7')) tg.disableVerticalSwipes();
  if (tgAt('6.1')) {
    tg.setHeaderColor('#2E1F17');
    tg.setBackgroundColor('#140D09');
  }
}

/** @param {string} path @param {Record<string, string>} [extra] @returns {Promise<any>} */
export const ask = (path, extra = {}) => fetch(SERVER + path, {method: 'POST', body: JSON.stringify({initData: tg.initData, ...extra})}).then(r => r.ok ? r.json() : Promise.reject(r.status));

/** @param {World} world @returns {(pattern:number|number[]) => void} */
export const buzzer = world => pattern => {
  if (world.state.noBuzz) return;
  if (!tgAt('6.1')) return void navigator.vibrate?.(pattern);
  if (Array.isArray(pattern)) return void tg.HapticFeedback.notificationOccurred(pattern[0] > 40 ? 'warning' : 'success');
  tg.HapticFeedback.impactOccurred(pattern > 20 ? 'heavy' : pattern > 10 ? 'medium' : 'light');
};
