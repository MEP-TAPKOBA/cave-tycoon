import {BLESS_GIFT, MAX_SHELL_REWARD} from '../config.js';
import {up} from '../format.js';
import {ACHS} from '../data/achs.js';
import {GENERIC_STAGES} from '../data/chapters.js';
import {TECHS} from '../data/techs.js';
import {ALL} from '../data/units.js';
import {achReward, mammothMeat, starItem} from './economy.js';
import {cap, perSec, perTap, ranked} from './formulas.js';
import {quests, stageCount} from './quests.js';
import {fresh} from './state.js';

/** @typedef {import('./state.js').State} State */
/** @typedef {import('./state.js').World} World */
/** @typedef {{bought:number,blessDays:number,blessUntil:number}} Ledger */
/** @typedef {{verdict:'ok'|'fixed'|'reject',state:State}} Judgment */

export const SHELL_SLACK = 10;
export const VALLEY_EVERY = 2 * 60e3;
export const GAIN_SLACK = 20;
export const SPENT_SLACK = 2;
const FOREVER = Number.MAX_SAFE_INTEGER;

/** @param {{item:string,count:number}[]} pays @param {number} blessUntil @returns {Ledger} */
export function ledgerOf(pays, blessUntil) {
  let bought = 0, blessDays = 0;
  for (const p of pays) {
    const it = starItem(p.item);
    bought += (it?.shells || 0) * p.count;
    blessDays += (it?.days || 0) * p.count;
  }
  return {bought, blessDays, blessUntil};
}

/** @param {unknown} v @returns {boolean} */
const amountOk = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** @param {State} s @returns {boolean} */
export const sane = s => [s.meat, s.earned, s.shells, s.valley, s.stage, s.grain, s.restarts, s.blessUntil, s.life?.earned, s.life?.migrations].every(amountOk) && Object.values(s.levels).every(amountOk) && Array.isArray(s.techs) && Array.isArray(s.perks);

/** @param {State} s @param {Ledger} ledger @returns {number} */
export function shellCeiling(s, ledger) {
  let n = fresh().shells + ledger.bought + BLESS_GIFT * (ledger.blessDays + 1) + SHELL_SLACK;
  for (let v = 0; v < s.valley; v++) n += Math.min(MAX_SHELL_REWARD, 2 + Math.floor(v / 2));
  for (const a of ACHS) for (let t = 0; t < Math.min(s.tiers[a.id] || 0, a.goals.length); t++) n += achReward(t);
  return n;
}

/** @param {State} s @returns {number} */
export const spent = s => ALL.reduce((sum, d) => sum + (s.levels[d.id] ? up(d.base * (d.growth ** s.levels[d.id] - 1) / (d.growth - 1)) : 0), 0) + TECHS.reduce((sum, t) => sum + (s.techs.includes(t.id) ? t.cost : 0), 0);

/** @param {State} s @returns {boolean} */
export const spentOk = s => spent(s) <= SPENT_SLACK * (s.earned - s.meat) + 2e4;

/** @param {State} s @param {number} now @returns {World} */
const peak = (s, now) => ({state: {...s, scaredUntil: 0, boosts: {...s.boosts, hunt: FOREVER, feast: FOREVER, speed: FOREVER}}, heat: 100, fed: 1, now});

/** @param {State} base @param {number} ms @param {number} now @returns {number} */
export function gainLimit(base, ms, now) {
  const w = peak(base, now), rate = perSec(w, false, 1) + perTap(w) * 20 + mammothMeat(w) / 60;
  return GAIN_SLACK * (rate * (ms / 1000 + 60) + cap(w) + GENERIC_STAGES * Math.max(rate * 20, 330 * GENERIC_STAGES * 2.5 ** (base.valley + 1)));
}

/** @param {State} next @param {State} base @param {number} ms @param {number} now @returns {boolean} */
export const paceOk = (next, base, ms, now) => next.valley <= base.valley + 1 + ms / VALLEY_EVERY && next.life.earned - base.life.earned <= gainLimit(base, ms, now);

/** @param {State} s @param {number} now @returns {World} */
const still = (s, now) => ({state: s, heat: 0, fed: 1, now});

/** @param {State} s @param {number} from @param {number} now @returns {boolean} */
export function stagesOk(s, from, now) {
  if (s.stage > stageCount(still(s, now))) return false;
  const w = still(s, now), levels = Object.fromEntries(ALL.map(d => [d.id, ranked(w, d.id)]));
  for (let st = from; st < s.stage; st++) if (quests(still({...s, levels, stage: st}, now)).some(q => q.now < q.goal)) return false;
  return true;
}

/** @param {State} next @param {State} base @param {number} now @returns {boolean} */
export function progressOk(next, base, now) {
  if (next.valley === base.valley) return stagesOk(next, Math.min(base.stage, next.stage), now);
  return next.valley === base.valley + 1 && base.stage >= stageCount(still(base, now)) && stagesOk(next, 0, now);
}

/** @param {State} next @param {State|null} prev @param {number} ms @param {Ledger} ledger @param {number} now @returns {Judgment} */
export function judge(next, prev, ms, ledger, now) {
  if (!sane(next)) return {verdict: 'reject', state: next};
  if (prev) {
    const base = prev.restarts === next.restarts ? prev : fresh(now);
    if (!paceOk(next, base, ms, now) || !progressOk(next, base, now)) return {verdict: 'reject', state: next};
    if (!spentOk(next) && spentOk(prev)) return {verdict: 'reject', state: next};
  }
  const ceiling = Math.max(shellCeiling(next, ledger), prev && prev.restarts === next.restarts ? prev.shells : 0);
  if (next.shells <= ceiling && next.blessUntil <= ledger.blessUntil) return {verdict: 'ok', state: next};
  return {verdict: 'fixed', state: {...next, shells: Math.min(next.shells, ceiling), blessUntil: Math.min(next.blessUntil, ledger.blessUntil)}};
}
