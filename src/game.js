import {VALLEYS} from './data/valleys.js';
import {addMeat} from './core/economy.js';
import {load} from './platform/saves.js';
import {createSound} from './platform/sound.js';
import {buzzer, rhythm} from './platform/telegram.js';

/** @typedef {import('./core/state.js').State} State */

/** @typedef {{state:State,heat:number,night:number,fed:number,readonly now:number}} Game */

/** @type {Game} */
export const world = {state: load(), heat: 0, night: 0, fed: 1, get now() { return Date.now(); }};

export const buzz = buzzer(world);
export const morse = rhythm(world);

export const sound = createSound(world);
export const {beep, tune, trumpet, roar, sizzle} = sound;

/** @param {string} code @returns {string} */
export const icon = code => `assets/twemoji/${code}.svg`;

/** @param {number} v @returns {string} */
export const valleyName = v => VALLEYS[v % VALLEYS.length].name + (v >= VALLEYS.length ? ` ${Math.floor(v / VALLEYS.length) + 1}` : '');

let lastFull = 0;
/** @param {number} got @param {number} n */
export function overflow(got, n) {
  const now = performance.now();
  if (got < n && now - lastFull > 1500) {
    lastFull = now;
    beep(140, .12, 'square', .04);
  }
}

/** @param {number} n @returns {number} */
export function gain(n) {
  const got = addMeat(world, n);
  overflow(got, n);
  return got;
}
