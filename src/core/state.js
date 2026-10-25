import {HARVEST, SAVE_EPOCH} from '../config.js';

/** @typedef {{meat:number,levels:Record<string,number>,savedAt:number,muted:boolean,valley:number,stage:number,earned:number,taps:number,mammoths:number,tigers:number,techs:string[],scaredUntil:number,injured:Record<string,number>,grain:number,harvest:number,perks:string[],mammothRest:number,music:boolean,tut:number,peakHeat:number,noTut:boolean,shells:number,boosts:Record<string,number>,tiers:Record<string,number>,life:{taps:number,earned:number,mammoths:number,tigers:number,migrations:number},econ:number,blessUntil:number,blessDay:string,restarts:number,heat:number,noBuzz:boolean,epoch:number,noRank:boolean,keeperOff:boolean}} State */
/** @typedef {{readonly state:State,readonly heat:number,readonly fed:number,readonly now:number}} World */

export const TUT_DONE = 99;

/** @param {number} [now] @returns {State} */
export const fresh = (now = Date.now()) => ({meat: 0, levels: {}, savedAt: now, muted: false, valley: 0, stage: 0, earned: 0, taps: 0, mammoths: 0, tigers: 0, techs: [], scaredUntil: 0, injured: {}, grain: 0, harvest: HARVEST, perks: [], mammothRest: 0, music: true, tut: 0, peakHeat: 0, noTut: false, shells: 4, boosts: {}, tiers: {}, life: {taps: 0, earned: 0, mammoths: 0, tigers: 0, migrations: 0}, econ: 2, blessUntil: 0, blessDay: '', restarts: 0, heat: 0, noBuzz: false, epoch: SAVE_EPOCH, noRank: false, keeperOff: false});

/** @param {string|null} json @returns {State|null} */
export function parseSave(json) {
  try {
    const s = JSON.parse(json);
    if (s && typeof s.meat === 'number' && s.econ !== 2) {
      s.meat *= 10;
      s.earned *= 10;
      s.grain = (s.grain || 0) * 5;
      if (s.life) s.life.earned *= 10;
      s.econ = 2;
    }
    if (s && typeof s.meat === 'number') return {...fresh(), tut: s.earned > 100 || s.valley ? TUT_DONE : 0, life: {taps: s.taps || 0, earned: s.earned || 0, mammoths: s.mammoths || 0, tigers: s.tigers || 0, migrations: s.valley || 0}, ...s};
  } catch {}
  return null;
}

/** @param {State} a @param {State} b @returns {boolean} */
export const ahead = (a, b) => a.restarts !== b.restarts ? a.restarts > b.restarts : a.life.migrations !== b.life.migrations ? a.life.migrations > b.life.migrations : a.life.earned > b.life.earned;
