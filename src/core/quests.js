import {BEAST_GOAL_MAX, GOAL_SHARE, TAP_GOAL_MAX, VALLEY_GROW} from '../config.js';
import {num} from '../format.js';
import {CHAPTERS, EXTRAS, GENERIC_STAGES, GOALS} from '../data/chapters.js';
import {TECHS} from '../data/techs.js';
import {ALL} from '../data/units.js';
import {herd, lvl, staff} from './formulas.js';

/** @typedef {import('./state.js').State} State */
/** @typedef {import('./state.js').World} World */
/** @typedef {import('../data/units.js').Def} Def */
/** @typedef {{text:string,goal:number,now:number}} Quest */

/** @param {World} w @param {string} kind @param {number} goal @returns {Quest} */
export function questOf(w, kind, goal) {
  const s = w.state, def = ALL.find(d => d.id === kind);
  if (def) return {goal, now: lvl(w, kind), text: def.trip ? `${def.name}: ${goal} в племени` : def.feed ? `${def.name}: ${goal} в хлеву` : `${def.name} до ур. ${goal}`};
  if (kind === 'tribe') return {goal, now: staff(w), text: `Рабочих в племени: ${goal}`};
  if (kind === 'herd') return {goal, now: herd(w), text: `Голов скотины: ${goal}`};
  if (kind === 'taps') return {goal, now: s.taps, text: `Поохотиться ${goal} раз`};
  if (kind === 'earned') return {goal, now: s.earned, text: `Добыть ${num(goal)} мяса`};
  if (kind === 'mammoths') return {goal, now: s.mammoths, text: `Поймать мамонтов: ${goal}`};
  if (kind === 'techs') return {goal, now: s.techs.length, text: `Сделать открытий: ${goal}`};
  if (kind === 'heat') return {goal, now: s.peakHeat, text: `Разжечь костёр до ${goal}%`};
  return {goal, now: s.tigers, text: `Прогнать тигров: ${goal}`};
}

/** @param {number} valley @returns {number} */
export const stageScale = valley => 330 * 2.5 ** Math.min(valley, CHAPTERS.length) * VALLEY_GROW ** Math.max(0, valley - CHAPTERS.length);

/** @param {number} s @param {number} g @returns {number} */
const earnedGoal = (s, g) => 3000 * 1.5 ** s * VALLEY_GROW ** g;

/** @param {string} id @param {number} budget @returns {number} */
function levelFor(id, budget) {
  const def = /** @type {Def} */ (ALL.find(d => d.id === id));
  return Math.max(0, Math.floor(Math.log(budget * (def.growth - 1) / def.base + 1) / Math.log(def.growth)));
}

/** @param {string} kind @param {number} s @param {number} g @returns {number} */
export function genericGoal(kind, s, g) {
  if (GOALS[kind]) {
    const [from, start, step] = GOALS[kind], budget = GOAL_SHARE * earnedGoal(s, g);
    const bought = kind === 'tribe' ? 2 + levelFor('cave', budget) : kind === 'herd' ? 2 * levelFor('barn', budget) : levelFor(kind, budget);
    return Math.max(start + Math.floor((s - from) * step), bought);
  }
  if (kind === 'taps') return Math.round(30 * (1 + s / 2) * (1 + Math.min(g, TAP_GOAL_MAX) / 2));
  if (kind === 'earned') return Math.round(earnedGoal(s, g));
  if (kind === 'mammoths') return 1 + Math.floor(s / 5) + Math.min(g, BEAST_GOAL_MAX);
  if (kind === 'techs') return Math.min(TECHS.length, 1 + Math.floor(s / 4));
  return 1 + Math.floor(s / 10) + Math.min(g, BEAST_GOAL_MAX);
}

/** @param {World} w @returns {number} */
export const stageCount = w => CHAPTERS[w.state.valley]?.stages.length ?? GENERIC_STAGES;

/** @param {State} s @returns {number} */
export function stagesDone(s) {
  let n = s.stage;
  for (let v = 0; v < s.valley; v++) n += CHAPTERS[v]?.stages.length ?? GENERIC_STAGES;
  return n;
}

/** @param {State} s @returns {number} */
export const rankScore = s => stagesDone(s) + 2 * s.valley;

/** @param {World} w @returns {Quest[]} */
export function quests(w) {
  const s = w.state.stage, v = w.state.valley, chapter = CHAPTERS[v];
  if (s >= stageCount(w)) return [];
  if (chapter) return chapter.stages[s].map(([kind, goal]) => questOf(w, kind, goal));
  const g = v - CHAPTERS.length, pool = Object.keys(GOALS).filter(id => GOALS[id][0] <= s);
  return [pool[s % pool.length], pool[(s + (pool.length >> 1)) % pool.length], EXTRAS[s % EXTRAS.length]].map(kind => questOf(w, kind, genericGoal(kind, s, g)));
}
