import {fresh} from '../src/core/state.js';

/** @typedef {import('../src/core/state.js').State} State */
/** @typedef {import('../src/core/state.js').World} World */

export const NOW = Date.UTC(2026, 9, 25, 12);

/** @param {Partial<State>} [patch] @param {{heat?:number,fed?:number,now?:number}} [extra] @returns {World} */
export const at = (patch = {}, extra = {}) => ({state: {...fresh(NOW), ...patch}, heat: 0, fed: 1, now: NOW, ...extra});
