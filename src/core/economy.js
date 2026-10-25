import {AWAY_COOL, BLESS_GIFT, BLESS_OFFLINE_CAP, HARVEST, KEEPER_HEAT, MAMMOTH_REST, MAX_SHELL_REWARD, OFFLINE_CAP, OFFLINE_SHARE} from '../config.js';
import {up} from '../format.js';
import {ACHS} from '../data/achs.js';
import {STAR_ITEMS} from '../data/shop.js';
import {WORKERS} from '../data/units.js';
import {blessed, boostOn, cap, costOf, grainCap, grainNeed, grainRate, harvestSize, has, herd, isScared, legacy, lvl, pens, perkOn, perSec, perTap, seats, staff, steadyFed, unlocked} from './formulas.js';
import {quests} from './quests.js';
import {TUT_DONE, fresh} from './state.js';

/** @typedef {import('./state.js').State} State */
/** @typedef {import('./state.js').World} World */
/** @typedef {import('../data/units.js').Def} Def */
/** @typedef {import('../data/techs.js').Tech} Tech */
/** @typedef {import('../data/shop.js').Boost} Boost */
/** @typedef {import('../data/shop.js').StarItem} StarItem */
/** @typedef {import('../data/achs.js').AchLine} AchLine */

/** @param {World} w @param {number} n @returns {number} */
export function addMeat(w, n) {
  const s = w.state, got = Math.min(n, Math.max(0, cap(w) - s.meat));
  s.meat += got;
  s.earned += got;
  s.life.earned += got;
  return got;
}

/** @param {World} w @param {Def} def @returns {number} */
export function amount(w, def) {
  const room = def.from ? lvl(w, def.from) : def.trip ? seats(w) - staff(w) : def.feed ? pens(w) - herd(w) : Infinity;
  return Math.min(1, room);
}

/** @param {World} w @param {Def} def @returns {boolean} */
export function purchase(w, def) {
  const s = w.state, n = amount(w, def), c = costOf(w, def, n);
  if (n < 1 || s.meat < c) return false;
  s.meat -= c;
  s.levels[def.id] = lvl(w, def.id) + n;
  if (def.from) {
    s.levels[def.from] -= n;
    s.injured[def.from] = Math.min(s.injured[def.from] || 0, lvl(w, def.from));
  }
  return true;
}

/** @param {World} w @param {Def} def @returns {boolean} */
export function release(w, def) {
  const s = w.state, l = lvl(w, def.id);
  if (!l) return false;
  s.levels[def.id] = l - 1;
  if ((s.injured[def.id] || 0) > l - 1) s.injured[def.id] = l - 1;
  return true;
}

/** @param {World} w @param {Tech} tech @returns {boolean} */
export function purchaseTech(w, tech) {
  const s = w.state;
  if (has(w, tech.id) || !unlocked(w, tech) || s.meat < tech.cost) return false;
  s.meat -= tech.cost;
  s.techs.push(tech.id);
  return true;
}

/** @type {Record<string, (w:World) => void>} */
const BOOST_EFFECT = {
  fill: w => void addMeat(w, Math.max(0, cap(w) - w.state.meat)),
  ward: w => {
    w.state.scaredUntil = 0;
    w.state.injured = {};
  },
  heal: w => {
    w.state.scaredUntil = 0;
    w.state.injured = {};
  },
  lure: w => {
    w.state.boosts.ward = 0;
  },
};

/** @param {World} w @param {Boost} b @returns {boolean} */
export function purchaseBoost(w, b) {
  const s = w.state;
  if (s.shells < b.price || (b.once && perkOn(w, b.id))) return false;
  s.shells -= b.price;
  if (b.once) s.perks.push(b.id);
  if (b.mins) s.boosts[b.id] = Math.max(w.now, s.boosts[b.id] || 0) + b.mins * 60e3;
  BOOST_EFFECT[b.id]?.(w);
  return true;
}

/** @param {World} w */
export function tapped(w) {
  w.state.taps++;
  w.state.life.taps++;
}

/** @param {World} w @returns {number} */
export const mammothMeat = w => up(Math.max(170 * legacy(w), perSec(w) * 5 + perTap(w) * 10 / 3));

/** @param {World} w */
export function caughtMammoth(w) {
  w.state.mammoths++;
  w.state.life.mammoths++;
  w.state.mammothRest = w.now + MAMMOTH_REST * 1000;
}

/** @param {World} w */
export function tigerScared(w) {
  w.state.tigers++;
  w.state.life.tigers++;
}

/** @param {World} w @returns {number} */
export function raid(w) {
  const s = w.state, loss = s.meat * .8;
  s.meat -= loss;
  s.scaredUntil = w.now + 30 * 60e3;
  s.injured = Object.fromEntries(WORKERS.map(d => [d.id, Math.floor(lvl(w, d.id) / 2)]));
  return loss;
}

/** @param {World} w @returns {boolean} */
export function recover(w) {
  if (!w.state.scaredUntil || isScared(w)) return false;
  w.state.scaredUntil = 0;
  w.state.injured = {};
  return true;
}

/** @param {World} w @returns {number} */
export function stokeHeat(w) {
  const heat = Math.min(100, w.heat + 7);
  w.state.peakHeat = Math.max(w.state.peakHeat, Math.round(heat));
  return heat;
}

/** @param {World} w @param {number} dt @param {number} night @returns {number} */
export function heatTick(w, dt, night) {
  const heat = boostOn(w, 'feast') ? 100 : Math.max(0, w.heat - dt * (1 + night * 1.5) / 5 * (has(w, 'flint') ? .5 : 1));
  return perkOn(w, 'keeper') && night < .5 ? Math.max(heat, KEEPER_HEAT) : heat;
}

/** @param {World} w @param {number} from @param {number} ms @returns {number} */
export const cooled = (w, from, ms) => boostOn(w, 'feast') ? from : Math.max(0, from - ms / 1000 * AWAY_COOL * (has(w, 'flint') ? .5 : 1));

/** @param {World} w @param {number} dt @returns {{harvested:number,fed:number}} */
export function farmStep(w, dt) {
  const s = w.state;
  let harvested = 0;
  if (!lvl(w, 'field')) s.harvest = HARVEST;
  else if ((s.harvest += dt) >= HARVEST) {
    s.harvest = 0;
    harvested = Math.max(0, Math.min(harvestSize(w), grainCap(w) - s.grain));
    s.grain += harvested;
  }
  const need = grainNeed(w) / 60 * dt, eaten = Math.min(s.grain, need);
  s.grain -= eaten;
  return {harvested, fed: need > 0 ? eaten / need : 1};
}

/** @param {World} w @param {number} since @returns {{away:number,want:number,earned:number}} */
export function offline(w, since) {
  const s = w.state, now = w.now, away = Math.min((now - since) / 1000, blessed(w) ? BLESS_OFFLINE_CAP : OFFLINE_CAP);
  const scared = Math.min(away, Math.max(0, Math.min(s.scaredUntil, now) - (now - away * 1000)) / 1000), fed = steadyFed(w);
  const want = (perSec(w, false, fed) * (away - scared) + perSec(w, true, fed) * scared) * OFFLINE_SHARE, earned = addMeat(w, up(want));
  s.grain = Math.max(0, Math.min(grainCap(w), s.grain + (grainRate(w) - grainNeed(w)) / 60 * away));
  return {away, want, earned};
}

/** @param {World} w @returns {number|null} */
export function advanceStage(w) {
  if (!quests(w).every(q => q.now >= q.goal)) return null;
  w.state.stage++;
  return up(Math.max(perSec(w) * 20, 330 * w.state.stage * 2.5 ** w.state.valley));
}

/** @param {World} w @returns {number} */
export const shellReward = w => Math.min(MAX_SHELL_REWARD, 2 + Math.floor(w.state.valley / 2));

/** @param {World} w @returns {State} */
export function migrated(w) {
  const s = w.state;
  const keep = {muted: s.muted, music: s.music, noBuzz: s.noBuzz, noTut: s.noTut, shells: s.shells + shellReward(w), boosts: s.boosts, perks: s.perks, mammothRest: s.mammothRest, tiers: s.tiers, blessUntil: s.blessUntil, blessDay: s.blessDay, restarts: s.restarts, life: {...s.life, migrations: s.life.migrations + 1}};
  return {...fresh(), ...keep, valley: s.valley + 1, tut: s.noTut ? TUT_DONE : 0};
}

/** @param {World} w @param {boolean} keeper @returns {State} */
export function restarted(w, keeper) {
  const s = w.state;
  return {...fresh(), muted: s.muted, music: s.music, noBuzz: s.noBuzz, blessUntil: s.blessUntil, blessDay: s.blessDay, restarts: s.restarts + 1, perks: keeper ? ['keeper'] : []};
}

/** @param {World} w @param {{keeper?:boolean,blessUntil?:number}} status */
export function applyStatus(w, status) {
  if (status.keeper && !perkOn(w, 'keeper')) w.state.perks.push('keeper');
  w.state.blessUntil = status.blessUntil || 0;
}

/** @param {World} w @returns {boolean} */
export function blessGift(w) {
  const s = w.state, today = new Date(w.now).toDateString();
  if (!blessed(w) || s.blessDay === today) return false;
  s.blessDay = today;
  s.shells += BLESS_GIFT;
  return true;
}

/** @param {string} id @returns {StarItem|undefined} */
export function starItem(id) {
  const gift = /^gift:(\d+)$/.exec(id);
  return gift ? {id, name: 'Подарок шамана', icon: '1f41a', desc: '', stars: 0, shells: Number(gift[1])} : STAR_ITEMS.find(i => i.id === id);
}

/** @param {World} w @param {string} id @returns {StarItem|undefined} */
export function grant(w, id) {
  const it = starItem(id);
  if (it?.shells) w.state.shells += it.shells;
  return it;
}

/** @type {Record<string, (w:World) => number>} */
export const ACH_NOW = {
  meat: w => w.state.life.earned,
  taps: w => w.state.life.taps,
  tribe: staff,
  mammoth: w => w.state.life.mammoths,
  tiger: w => w.state.life.tigers,
  move: w => w.state.life.migrations,
  tech: w => w.state.techs.length,
  farm: herd,
  fire: w => w.state.peakHeat,
  full: w => w.state.meat >= cap(w) ? 1 : 0,
};

/** @param {number} tier @returns {number} */
export const achReward = tier => Math.min(3, 1 + Math.floor(tier / 2));
/** @param {World} w @param {AchLine} a @returns {number} */
export const tierOf = (w, a) => w.state.tiers[a.id] || 0;

/** @param {World} w @returns {{ach:AchLine,tier:number,reward:number}|null} */
export function claimAch(w) {
  const ach = ACHS.find(a => tierOf(w, a) < a.goals.length && ACH_NOW[a.id](w) >= a.goals[tierOf(w, a)]);
  if (!ach) return null;
  const tier = tierOf(w, ach), reward = achReward(tier);
  w.state.tiers[ach.id] = tier + 1;
  w.state.shells += reward;
  return {ach, tier, reward};
}
