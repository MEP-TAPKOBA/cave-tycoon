import {BLESS_BOOST} from '../config.js';
import {num, pct, plural} from '../format.js';
import {ACHS} from '../data/achs.js';
import {BOOSTS, STAR_ITEMS} from '../data/shop.js';
import {blessed, boostOn, isScared, legacy, opened, perkOn} from '../core/formulas.js';
import {ACH_NOW, achReward, claimAch, purchaseBoost, tierOf} from '../core/economy.js';
import {shopStars} from '../platform/telegram.js';
import {icon, tune, world} from '../game.js';
import {BOOST_USE} from '../scene/beasts.js';
import {$, banner, screen, setText} from './dom.js';
import {starShop} from './session.js';

/** @typedef {import('../data/shop.js').Boost} Boost */

/** @param {Boost} b */
function buyBoost(b) {
  if (!purchaseBoost(world, b)) return;
  BOOST_USE[b.id]?.();
  banner(`${b.name}!`, b.icon);
  tune([523, 784, 1047], 80);
  screen.render();
}

const SHELL_IMG = `<img src="${icon('1f41a')}" alt="">`;
const boostRows = BOOSTS.map(b => {
  const el = document.createElement('div');
  el.className = 'item';
  el.innerHTML = `<div class="ico"><img src="${icon(b.icon)}" alt=""></div><div class="info"><b class="full">${b.name}<span></span></b><small class="full">${b.desc}</small></div><button class="buy"><span class="price">${SHELL_IMG}${b.price}</span></button>`;
  const btn = el.querySelector('button');
  btn.onclick = () => buyBoost(b);
  $('boosts').append(el);
  return {b, el, btn, left: el.querySelector('span')};
});
const STAR_IMG = `<img src="${icon('2b50')}" alt="">`;
const starRows = STAR_ITEMS.map(it => {
  const el = document.createElement('div');
  el.className = 'item';
  el.innerHTML = `<div class="ico"><img src="${icon(it.icon)}" alt=""></div><div class="info"><b class="full">${it.name}<span></span></b><small class="full">${it.desc}</small></div><button class="buy"><span class="price">${STAR_IMG}${it.stars}</span></button>`;
  const btn = el.querySelector('button');
  btn.onclick = () => starShop.buy(it);
  $('stars').append(el);
  return {it, el, btn, left: el.querySelector('span')};
});
const dayMonth = new Intl.DateTimeFormat('ru', {day: 'numeric', month: 'long'});
const achRows = ACHS.map(a => {
  const el = document.createElement('div');
  el.className = 'item';
  el.innerHTML = `<div class="ico"><img src="${icon(a.icon)}" alt=""></div><div class="info"><b class="full"><em></em><span></span></b><small class="full"></small><div class="prog"><i></i></div></div><div class="reward">${SHELL_IMG}<em></em></div>`;
  $('achs').append(el);
  const [name, reward] = el.querySelectorAll('em');
  return {a, el, name, reward, step: /** @type {HTMLElement} */ (el.querySelector('b span')), info: el.querySelector('small'), bar: /** @type {HTMLElement} */ (el.querySelector('.prog i')), prog: /** @type {HTMLElement} */ (el.querySelector('.prog')), side: /** @type {HTMLElement} */ (el.querySelector('.reward'))};
});

$('active').addEventListener('click', e => {
  if (!(/** @type {HTMLElement} */ (e.target)).closest('.bless') || !blessed(world)) return;
  const days = Math.ceil((world.state.blessUntil - Date.now()) / 864e5);
  banner(`Благословение: ещё ${plural(days, ['день', 'дня', 'дней'])}`, '1f9d9');
});

/** @param {number} ms @returns {string} */
const clock = ms => {
  const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

export function renderExtras() {
  const done = claimAch(world);
  if (done) {
    banner(`Достижение: ${done.ach.names[done.tier]}! +${done.reward}`, '1f3c5');
    tune([784, 988, 1175], 90);
  }
  setText($('shellCount'), String(world.state.shells));
  setText($('shopText'), `У тебя ${plural(world.state.shells, ['ракушка', 'ракушки', 'ракушек'])}. Новые даёт каждое переселение и достижения.`);
  const now = Date.now();
  for (const r of boostRows) {
    r.el.hidden = Boolean(r.b.need) && !opened(world, r.b.need);
    const owned = Boolean(r.b.once) && perkOn(world, r.b.id);
    r.el.classList.toggle('owned', owned);
    setText(r.left, owned ? 'есть' : boostOn(world, r.b.id) ? `ещё ${clock(world.state.boosts[r.b.id] - now)}` : '');
    r.btn.disabled = owned || world.state.shells < r.b.price;
  }
  $('starShop').hidden = !shopStars;
  for (const r of starRows) {
    const owned = r.it.id === 'keeper' ? perkOn(world, 'keeper') : r.it.id === 'bless' && blessed(world);
    r.el.classList.toggle('owned', owned);
    setText(r.left, r.it.id === 'bless' && owned ? `до ${dayMonth.format(world.state.blessUntil)}` : owned ? 'есть' : '');
    r.btn.disabled = owned || starShop.paying;
  }
  /** @type {[string, string, string][]} */
  const fx = [];
  if (isScared(world)) fx.push(['1f631', `−80% ${clock(world.state.scaredUntil - now)}`, ' class="warn"']);
  if (world.heat >= 1) fx.push(['1f525', `+${pct(world.heat * .003)}%`, '']);
  if (world.state.valley) fx.push(['1f5ff', `+${pct(legacy(world) - 1)}%`, '']);
  if (blessed(world)) fx.push(['1f9d9', `+${pct(BLESS_BOOST - 1)}%`, ' class="bless"']);
  for (const b of BOOSTS) if (boostOn(world, b.id)) fx.push([b.icon, clock(world.state.boosts[b.id] - now), '']);
  const chips = fx.map(([code, text, cls]) => `<span${cls}><img src="${icon(code)}" alt="">${text}</span>`).join('');
  if ($('active').innerHTML !== chips) $('active').innerHTML = chips;
  const total = ACHS.reduce((sum, a) => sum + a.goals.length, 0), got = ACHS.reduce((sum, a) => sum + tierOf(world, a), 0);
  setText($('achCount'), `${got} из ${total}`);
  for (const r of achRows) {
    const tier = tierOf(world, r.a), max = r.a.goals.length, finished = tier >= max, shown = Math.min(tier, max - 1);
    setText(r.name, r.a.names[shown]);
    setText(r.step, max > 1 ? `${Math.min(tier + 1, max)} из ${max}` : '');
    setText(r.info, finished ? 'Все ступени пройдены!' : `${r.a.desc(r.a.goals[tier])}: ${num(Math.floor(Math.min(ACH_NOW[r.a.id](world), r.a.goals[tier])))} из ${num(r.a.goals[tier])}`);
    r.bar.style.width = finished ? '100%' : `${Math.min(1, ACH_NOW[r.a.id](world) / r.a.goals[tier]) * 100}%`;
    r.prog.hidden = finished;
    r.side.hidden = finished;
    setText(r.reward, `+${achReward(tier)}`);
    r.el.classList.toggle('locked', !finished && ACH_NOW[r.a.id](world) < r.a.goals[tier] && tier === 0);
  }
}
