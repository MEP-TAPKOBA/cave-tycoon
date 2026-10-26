import {KEEPER_HEAT} from '../config.js';
import {perkOn} from '../core/formulas.js';
import {tgAt} from '../platform/telegram.js';
import {beep, buzz, icon, world} from '../game.js';
import {$, banner, screen} from './dom.js';

/** @typedef {{name:string,desc:string,icon:string,on:() => boolean,flip:() => void,shown?:() => boolean}} Setting */

const vibrates = tgAt('6.1') || 'vibrate' in navigator;

export function toggleKeeper() {
  world.state.keeperOff = !world.state.keeperOff;
  banner(world.state.keeperOff ? 'Хранитель огня уснул' : 'Хранитель огня снова у костра', '1fab5');
}

/** @type {Setting[]} */
const SETTINGS = [
  {name: 'Хранитель огня', desc: `держит жар не ниже ${KEEPER_HEAT}% днём и ночью`, icon: '1fab5', on: () => !world.state.keeperOff, flip: toggleKeeper, shown: () => perkOn(world, 'keeper')},
  {name: 'Звуки', desc: 'охота, постройки и звери', icon: '1f50a', on: () => !world.state.muted, flip: () => {
    world.state.muted = !world.state.muted;
    beep(520, .04, 'sine');
  }},
  {name: 'Музыка', desc: 'барабаны и флейта племени', icon: '1f941', on: () => world.state.music, flip: () => {
    world.state.music = !world.state.music;
  }},
  {name: 'Вибрация', desc: 'отклик на тапы и зверей', icon: '1f446', on: () => !world.state.noBuzz, flip: () => {
    world.state.noBuzz = !world.state.noBuzz;
    buzz(15);
  }, shown: () => vibrates},
];

const rows = SETTINGS.map(s => {
  const el = document.createElement('div');
  el.className = 'item';
  el.innerHTML = `<div class="ico"><img src="${icon(s.icon)}" alt=""></div><div class="info"><b class="full">${s.name}</b><small class="full">${s.desc}</small></div><button class="switch" aria-label="${s.name}"></button>`;
  const sw = /** @type {HTMLButtonElement} */ (el.querySelector('button'));
  el.onclick = () => {
    s.flip();
    screen.render();
  };
  $('settings').append(el);
  return {s, el, sw};
});

export function renderSettings() {
  for (const r of rows) {
    const on = r.s.on();
    r.el.hidden = Boolean(r.s.shown) && !r.s.shown();
    r.el.classList.toggle('off', !on);
    r.sw.classList.toggle('on', on);
    r.sw.setAttribute('aria-pressed', String(on));
  }
}
