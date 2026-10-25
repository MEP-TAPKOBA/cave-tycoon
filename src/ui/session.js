import {BLESS_GIFT} from '../config.js';
import {num, up} from '../format.js';
import {blessGift, offline} from '../core/economy.js';
import {createSaves} from '../platform/saves.js';
import {createStars} from '../platform/stars.js';
import {overflow, tune, world} from '../game.js';
import {H, W} from '../scene/view.js';
import {fly} from '../scene/fx.js';
import {banner, bump, modal, screen} from './dom.js';

export const {save, saveNow, pull, pullServer, pullCloud} = createSaves(world, welcomeBack);

/** @param {number} since */
export function welcomeBack(since) {
  const {away, want, earned} = offline(world, since);
  overflow(earned, up(want));
  if (away < 20 || earned < 1) return;
  modal(earned < want ? 'Пока тебя не было, племя добыло столько, сколько влезло в склад' : 'Пока тебя не было, племя добыло', `${num(earned)} мяса`, 'Забрать', () => {
    fly(W / 2, H / 2, 25);
    tune([523, 659, 784], 80);
    bump();
  });
}

export function gift() {
  if (!blessGift(world)) return;
  banner(`Шаман благословляет: +${BLESS_GIFT}`, '1f9d9');
  saveNow();
}

export const starShop = createStars(world, {
  gift,
  item: it => {
    banner(it.shells ? `+${it.shells} ракушек!` : `${it.name}!`, it.icon);
    tune([523, 784, 1047], 80);
  },
  fail: down => banner(down ? 'Шаман не отвечает, попробуй позже' : 'Оплата не прошла', '2b50'),
  saveNow,
  refresh: () => screen.render(),
});
