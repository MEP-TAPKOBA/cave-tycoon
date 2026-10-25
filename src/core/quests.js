import {num} from '../format.js';
import {CHAPTERS, EXTRAS, GENERIC_STAGES, GOALS} from '../data/chapters.js';
import {TECHS} from '../data/techs.js';
import {ALL} from '../data/units.js';
import {herd, lvl, staff} from './formulas.js';

/** @typedef {import('./state.js').World} World */
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

/** @param {string} kind @param {number} s @param {number} g @returns {number} */
export function genericGoal(kind, s, g) {
  if (GOALS[kind]) {
    const [from, start, step] = GOALS[kind];
    return Math.round((start + Math.floor((s - from) * step)) * (1 + g / 2));
  }
  if (kind === 'taps') return Math.round(30 * (1 + s / 2) * (1 + g / 2));
  if (kind === 'earned') return Math.round(3000 * 1.5 ** s * 2.5 ** g);
  if (kind === 'mammoths') return 1 + Math.floor(s / 5) + g;
  if (kind === 'techs') return Math.min(TECHS.length, 1 + Math.floor(s / 4));
  return 1 + Math.floor(s / 10) + g;
}

/** @param {World} w @returns {number} */
export const stageCount = w => CHAPTERS[w.state.valley]?.stages.length ?? GENERIC_STAGES;

/** @param {World} w @returns {Quest[]} */
export function quests(w) {
  const s = w.state.stage, v = w.state.valley, chapter = CHAPTERS[v];
  if (s >= stageCount(w)) return [];
  if (chapter) return chapter.stages[s].map(([kind, goal]) => questOf(w, kind, goal));
  const g = v - CHAPTERS.length, pool = Object.keys(GOALS).filter(id => GOALS[id][0] <= s);
  return [pool[s % pool.length], pool[(s + (pool.length >> 1)) % pool.length], EXTRAS[s % EXTRAS.length]].map(kind => questOf(w, kind, genericGoal(kind, s, g)));
}
