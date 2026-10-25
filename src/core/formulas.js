import {BLESS_BOOST, HARVEST, MILESTONE, MILESTONE_BOOST} from '../config.js';
import {up} from '../format.js';
import {FEATURE_AT} from '../data/chapters.js';
import {ALL, ANIMALS, FARM, STATIONS, WORKERS} from '../data/units.js';

/** @typedef {import('./state.js').World} World */
/** @typedef {import('../data/units.js').Def} Def */
/** @typedef {import('../data/techs.js').Tech} Tech */

/** @param {World} w @param {string} id @returns {number} */
export const lvl = (w, id) => w.state.levels[id] || 0;
/** @param {World} w @param {string} id @returns {number} */
export const ranked = (w, id) => lvl(w, id) + ALL.filter(d => d.from === id).reduce((sum, d) => sum + ranked(w, d.id), 0);
/** @param {World} w @param {string} id @returns {number} */
export const mult = (w, id) => MILESTONE_BOOST ** Math.floor(ranked(w, id) / MILESTONE);
/** @param {World} w @param {string} id @returns {boolean} */
export const has = (w, id) => w.state.techs.includes(id);
/** @param {World} w @param {Def} def @returns {number} */
export const techMult = (w, def) => def.tech && has(w, def.tech) ? 1.34 : 1;
/** @param {World} w @param {string} id @returns {boolean} */
export const boostOn = (w, id) => (w.state.boosts[id] || 0) > w.now;
/** @param {World} w @returns {boolean} */
export const blessed = w => w.state.blessUntil > w.now;
/** @param {World} w @returns {number} */
export const bless = w => blessed(w) ? BLESS_BOOST : 1;
/** @param {World} w @param {string} id @returns {boolean} */
export const perkOn = (w, id) => w.state.perks.includes(id);
/** @param {World} w @param {string} id @returns {boolean} */
export const opened = (w, id) => w.state.valley >= (FEATURE_AT[id] ?? 0);
/** @param {World} w @returns {number} */
export const legacy = w => 1 + up(((7 / 6) ** w.state.valley - 1) * 100) / 100;
/** @param {World} w @returns {number} */
export const live = w => 1 + up(w.heat * .3) / 100;
/** @param {Def} def @returns {boolean} */
export const milestones = def => def.id === 'fire' || Boolean(def.trip) || Boolean(def.feed);
/** @param {World} w @returns {number} */
export const seats = w => 2 + lvl(w, 'cave');
/** @param {World} w @returns {number} */
export const cap = w => Math.floor(2500 * 1.267 ** lvl(w, 'storage'));
/** @param {World} w @returns {number} */
export const staff = w => WORKERS.reduce((sum, d) => sum + lvl(w, d.id), 0);
/** @param {World} w @returns {number} */
export const speed = w => (1 + up(5 / 3 * lvl(w, 'bath')) / 100) * (has(w, 'drums') ? 1.07 : 1) * (boostOn(w, 'speed') ? 2 : 1);
/** @param {World} w @returns {number} */
export const hype = w => boostOn(w, 'hunt') ? 2 : 1;
/** @param {World} w @returns {number} */
export const cook = w => 1 + up(10 / 3 * lvl(w, 'kitchen') * (has(w, 'salt') ? 7 / 6 : 1)) / 100;
/** @param {World} w @returns {boolean} */
export const isScared = w => w.now < w.state.scaredUntil;
/** @param {World} w @param {string} id @param {boolean} [scared] @returns {number} */
export const hurt = (w, id, scared = isScared(w)) => scared ? w.state.injured[id] || 0 : 0;
/** @param {World} w @returns {number} */
export const perTap = w => up((30 + 10 * lvl(w, 'fire')) / 9 * mult(w, 'fire') * techMult(w, STATIONS[0]) * legacy(w) * bless(w) * live(w) * hype(w) * (boostOn(w, 'feast') ? 5 : 1) * (isScared(w) ? .2 : 1));
/** @param {World} w @param {Def} def @param {boolean} [scared] @returns {number} */
export const rateOf = (w, def, scared = isScared(w)) => up((lvl(w, def.id) - hurt(w, def.id, scared)) * def.trip / def.time * speed(w) * cook(w) * mult(w, def.id) * techMult(w, def) * legacy(w) * bless(w) * live(w) * hype(w) * (scared ? .2 : 1));
/** @param {World} w @returns {number} */
export const pens = w => 2 * lvl(w, 'barn');
/** @param {World} w @returns {number} */
export const herd = w => ANIMALS.reduce((sum, a) => sum + lvl(w, a.id), 0);
/** @param {World} w @returns {number} */
export const grainRate = w => up(300 * lvl(w, 'field') * (has(w, 'sickle') ? 1.34 : 1) * (boostOn(w, 'grain') ? 3 : 1));
/** @param {World} w @returns {number} */
export const harvestSize = w => grainRate(w) * HARVEST / 60;
/** @param {World} w @returns {number} */
export const grainNeed = w => up(ANIMALS.reduce((sum, a) => sum + lvl(w, a.id) * a.feed * 60, 0));
/** @param {World} w @returns {number} */
export const grainCap = w => 1500 * (1 + lvl(w, 'granary'));
/** @param {World} w @returns {number} */
export const steadyFed = w => grainNeed(w) ? Math.min(1, grainRate(w) / grainNeed(w)) : 1;
/** @param {World} w @param {Def} def @param {number} [fed] @param {boolean} [scared] @returns {number} */
export const animalRate = (w, def, fed = w.fed, scared = isScared(w)) => up(lvl(w, def.id) * def.meat * fed * mult(w, def.id) * (has(w, 'fence') ? 1.34 : 1) * legacy(w) * bless(w) * hype(w) * (scared ? .2 : 1));
/** @param {World} w @param {boolean} [scared] @param {number} [fed] @returns {number} */
export const perSec = (w, scared = isScared(w), fed = w.fed) => WORKERS.reduce((sum, d) => sum + rateOf(w, d, scared), 0) + ANIMALS.reduce((sum, a) => sum + animalRate(w, a, fed, scared), 0);
/** @param {World} w @param {Def} def @param {number} n @returns {number} */
export const costOf = (w, def, n) => up(def.base * def.growth ** lvl(w, def.id) * (def.growth ** n - 1) / (def.growth - 1));
/** @param {World} w @param {Tech} tech @returns {boolean} */
export const unlocked = (w, tech) => lvl(w, tech.need[0]) >= tech.need[1];

/** @type {Record<string, (w:World) => number>} */
export const STAT = {
  fire: w => perTap(w),
  cave: w => seats(w),
  storage: w => cap(w),
  kitchen: w => cook(w) - 1,
  bath: w => speed(w) - 1,
  hunter: w => rateOf(w, WORKERS[0]),
  tracker: w => rateOf(w, WORKERS[1]),
  chief: w => rateOf(w, WORKERS[2]),
  field: w => grainRate(w),
  granary: w => grainCap(w),
  barn: w => pens(w),
  rabbit: w => animalRate(w, FARM[3], 1),
  goat: w => animalRate(w, FARM[4], 1),
};
