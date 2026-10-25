import {icon} from '../game.js';

export const $ = id => document.getElementById(id);

/** @type {{render:() => void}} */
export const screen = {render: () => {}};

/** @param {HTMLElement} el @param {string} text */
export function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

/** @param {string} text @param {string} [code] */
export function banner(text, code = '1f389') {
  /** @type {HTMLImageElement} */ ($('bannerIcon')).src = icon(code);
  $('bannerText').textContent = text;
  $('banner').classList.add('show');
  setTimeout(() => $('banner').classList.remove('show'), 2400);
}

let lastBump = 0;
export function bump() {
  const now = performance.now();
  if (now - lastBump < 150) return;
  lastBump = now;
  const el = $('meat');
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

/** @param {HTMLButtonElement} btn @param {() => boolean} act */
export function holdable(btn, act) {
  let timer = 0, held = false;
  const stop = () => {
    clearTimeout(timer);
    timer = 0;
  };
  const repeat = delay => {
    timer = setTimeout(() => act() ? repeat(Math.max(40, delay * .85)) : stop(), delay);
  };
  btn.addEventListener('pointerdown', () => {
    held = false;
    stop();
    timer = setTimeout(() => {
      held = true;
      if (act()) repeat(140);
    }, 350);
  });
  btn.addEventListener('pointerup', () => {
    if (timer && !held) act();
    stop();
  });
  for (const type of ['pointerleave', 'pointercancel']) btn.addEventListener(type, stop);
  btn.addEventListener('click', e => {
    if (e.detail === 0) act();
  });
  btn.addEventListener('contextmenu', e => e.preventDefault());
}

/** @type {(() => void)|null} */
let onModal = null;
/** @param {string} text @param {string} big @param {string} ok @param {() => void} action @param {boolean} [cancel] @param {string} [code] */
export function modal(text, big, ok, action, cancel = false, code = '1f356') {
  /** @type {HTMLImageElement} */ ($('mIcon')).src = icon(code);
  $('mText').textContent = text;
  $('mBig').textContent = big;
  $('mOk').textContent = ok;
  $('mNo').hidden = !cancel;
  onModal = action;
  $('modal').classList.add('show');
}

$('mOk').onclick = () => {
  $('modal').classList.remove('show');
  onModal?.();
};
$('mNo').onclick = () => $('modal').classList.remove('show');

const TITLES = {quests: 'Задания и достижения', yard: 'Пещера и двор', tribe: 'Племя', farm: 'Ферма', techs: 'Открытия', shop: 'Лавка шамана'};
export let openSec = '';

/** @param {string} sec */
export function openSheet(sec) {
  if (sec !== openSec) $('sheetBody').scrollTop = 0;
  openSec = sec;
  $('sheet').classList.toggle('open', Boolean(sec));
  for (const el of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.sec'))) el.hidden = el.dataset.sec !== sec;
  for (const el of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#nav button'))) el.classList.toggle('on', el.dataset.sec === sec);
  if (sec) setText($('sheetTitle'), TITLES[sec]);
}
