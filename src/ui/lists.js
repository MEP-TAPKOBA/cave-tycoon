import {HARVEST, MILESTONE, MILESTONE_BOOST} from '../config.js';
import {num, pct} from '../format.js';
import {TECHS} from '../data/techs.js';
import {ALL, FARM, WORKERS} from '../data/units.js';
import {cap, costOf, grainCap, grainNeed, grainRate, harvestSize, has, herd, hurt, isScared, lvl, milestones, opened, pens, perSec, perTap, ranked, seats, staff, STAT, unlocked} from '../core/formulas.js';
import {amount, purchase, purchaseTech, recover, release} from '../core/economy.js';
import {quests, stageCount} from '../core/quests.js';
import {beep, icon, valleyName, world} from '../game.js';
import {spotOf, U} from '../scene/view.js';
import {burst, celebrate} from '../scene/fx.js';
import {syncWalkers} from '../scene/people.js';
import {syncCritters} from '../scene/farm.js';
import {$, banner, holdable, screen, setText} from './dom.js';

/** @typedef {import('../data/units.js').Def} Def */
/** @typedef {import('../data/techs.js').Tech} Tech */

/** @typedef {{def:Def,el:HTMLElement,btn:HTMLButtonElement,drop:HTMLButtonElement,level:HTMLElement,info:HTMLElement,prog:HTMLElement,x2:HTMLElement,pbar:HTMLElement,eat:HTMLElement|null,html:string}} Row */

/** @returns {string} */
const boostText = () => `+${pct(MILESTONE_BOOST - 1)}%`;

/** @type {Row[]} */
export const rows = [];

/** @param {Def} def @param {number} n @returns {string} */
function statLine(def, n) {
  const show = v => def.pct ? `+${pct(v)}%` : num(v);
  const now = STAT[def.id](world);
  if (n < 1) return `${show(now)} ${def.unit}`;
  const was = world.state.levels[def.id] || 0;
  world.state.levels[def.id] = was + n;
  const next = STAT[def.id](world);
  world.state.levels[def.id] = was;
  return `${show(now)} → ${show(next)} ${def.unit}`;
}

/** @param {Def} def @returns {string} */
function promoteLine(def) {
  const src = ALL.find(d => d.id === def.from), was = lvl(world, src.id);
  if (!was) return `нужен ${src.name.toLowerCase()}`;
  const now = STAT[src.id](world), own = lvl(world, def.id);
  world.state.levels[src.id] = was - 1;
  world.state.levels[def.id] = own + 1;
  const loss = now - STAT[src.id](world);
  world.state.levels[src.id] = was;
  world.state.levels[def.id] = own;
  return `−1 ${src.name.toLowerCase()}, −${num(loss)} ${src.unit}`;
}

/** @param {Def} def */
function dismiss(def) {
  if (!release(world, def)) return;
  beep(300, .06, 'sine');
  screen.render();
}

/** @param {Def[]} defs @param {HTMLElement} box */
export function build(defs, box) {
  for (const def of defs) {
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `<div class="ico"><img src="${icon(def.icon)}" alt=""></div><div class="info"><b>${def.name}<span></span></b><small></small>${def.feed ? '<small class="eat"></small>' : def.from ? '<small class="eat from"></small>' : ''}<div class="pbar"><div class="prog"><i></i></div><em></em></div></div><button class="drop" aria-label="Распустить одного" hidden>&#8722;</button><button class="buy"></button>`;
    const btn = /** @type {HTMLButtonElement} */ (el.querySelector('.buy')), drop = /** @type {HTMLButtonElement} */ (el.querySelector('.drop'));
    holdable(btn, () => buy(def));
    drop.onclick = () => dismiss(def);
    drop.hidden = !def.trip && !def.feed;
    box.append(el);
    rows.push({def, el, btn, drop, level: el.querySelector('span'), info: el.querySelector('small'), prog: el.querySelector('.prog i'), x2: el.querySelector('.pbar em'), pbar: el.querySelector('.pbar'), eat: el.querySelector('.eat'), html: ''});
  }
}

const questRows = [0, 1, 2].map(() => {
  const el = document.createElement('div');
  el.className = 'quest';
  el.innerHTML = '<div class="info"><b></b><small></small><div class="prog"><i></i></div></div>';
  $('quests').append(el);
  return {el, text: el.querySelector('b'), count: el.querySelector('small'), bar: el.querySelector('i')};
});
export const techRows = TECHS.map(tech => {
  const el = document.createElement('div');
  el.className = 'item';
  el.innerHTML = `<div class="ico"><img src="${icon(tech.icon)}" alt=""></div><div class="info"><b class="full">${tech.name}</b><small class="full">${tech.desc}</small><small class="need full"></small></div><button class="buy"></button>`;
  const btn = el.querySelector('button');
  btn.onclick = () => buyTech(tech);
  $('techs').append(el);
  return {tech, el, btn, need: /** @type {HTMLElement} */ (el.querySelector('.need'))};
});
export const stageBtn = document.createElement('button');
stageBtn.className = 'buy wide pulse';
$('quests').append(stageBtn);

function renderQuests() {
  const finished = world.state.stage >= stageCount(world), qs = quests(world);
  setText($('valley'), valleyName(world.state.valley));
  setText($('stageNo'), finished ? 'все вехи пройдены' : `веха ${world.state.stage + 1} из ${stageCount(world)}`);
  questRows.forEach((row, i) => {
    const q = qs[i];
    row.el.hidden = !q;
    if (!q) return;
    setText(row.text, q.text);
    setText(row.count, q.now >= q.goal ? 'готово' : `${num(Math.floor(q.now))} из ${num(q.goal)}`);
    row.bar.style.width = `${Math.min(1, q.now / q.goal) * 100}%`;
    row.el.classList.toggle('done', q.now >= q.goal);
  });
  const ready = !finished && qs.every(q => q.now >= q.goal);
  stageBtn.hidden = !ready && !finished;
  setText(stageBtn, finished ? `Переселиться: ${valleyName(world.state.valley + 1)}` : 'Забрать награду за веху');
}

/** @param {Tech} tech */
function buyTech(tech) {
  if (!purchaseTech(world, tech)) return;
  celebrate(`Открытие: ${tech.name}!`);
  screen.render();
}

/** @param {Tech} tech @returns {string} */
function needText(tech) {
  const [id, n] = tech.need, def = ALL.find(d => d.id === id), now = lvl(world, id);
  return `Нужно: ${def.name} ${def.trip ? '×' : 'ур. '}${n}` + (now < n ? `, есть ${now}` : '');
}

/** @param {Def} def @returns {boolean} */
function buy(def) {
  const rank = ranked(world, def.id);
  if (!purchase(world, def)) return false;
  beep(520, .08);
  setTimeout(() => beep(780, .1), 70);
  const spot = spotOf(def.id);
  burst(spot.x, spot.y - 20 * U, 18, '#ffd08a');
  if (milestones(def) && Math.floor(rank / MILESTONE) < Math.floor(ranked(world, def.id) / MILESTONE)) celebrate(def.id === 'fire' ? `Костёр: тап ${boostText()}!` : `${def.name}: добыча ${boostText()}!`);
  screen.render();
  return true;
}

/** @param {Def} def @returns {string} */
const secOf = def => FARM.includes(def) ? 'farm' : WORKERS.includes(def) ? 'tribe' : 'yard';

export function renderLists() {
  syncWalkers();
  syncCritters();
  renderQuests();
  setText($('herd'), `${herd(world)} из ${pens(world)}`);
  const hungry = herd(world) > 0 && grainRate(world) < grainNeed(world), spill = lvl(world, 'field') > 0 && harvestSize(world) > grainCap(world);
  const wait = Math.max(0, Math.ceil(HARVEST - world.state.harvest)), clock = `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, '0')}`;
  $('farmNote').classList.toggle('warn', hungry || spill);
  setText($('farmText'), hungry ? `Скотине не хватает пшена: растёт ${num(grainRate(world))} в минуту, а съедают ${num(grainNeed(world))}. Расширь поле!` : spill ? `Амбар вмещает ${num(grainCap(world))} пшена, а урожай ${num(harvestSize(world))}: лишнее пропадает. Расширь амбар!` : lvl(world, 'field') || herd(world) ? `Амбар: ${num(Math.floor(world.state.grain))} из ${num(grainCap(world))} · урожай +${num(harvestSize(world))} через ${clock} · едят ${num(grainNeed(world))}/мин` : 'Распаши поле и построй хлев: кролики и козы едят пшено и дают мясо');
  setText($('meat'), num(Math.floor(world.state.meat)));
  setText($('cap'), `из ${num(cap(world))}`);
  $('counter').classList.toggle('full', world.state.meat >= cap(world));
  if (recover(world)) {
    banner('Племя оправилось от страха', '1fa79');
  }
  setText($('rate'), `${num(perSec(world))}/с`);
  $('counter').classList.toggle('scared', isScared(world));
  $('heatBar').style.width = `${world.heat}%`;
  setText($('techCount'), `${world.state.techs.length} из ${TECHS.length}`);
  $('allTechs').hidden = world.state.techs.length < TECHS.length;
  $('doneHead').hidden = !world.state.techs.length;
  for (const r of techRows) {
    const open = unlocked(world, r.tech), owned = has(world, r.tech.id), box = owned ? $('techsDone') : $('techs');
    if (r.el.parentElement !== box) box.append(r.el);
    r.el.classList.toggle('owned', owned);
    r.el.classList.toggle('locked', !open && !owned);
    r.need.hidden = owned;
    r.need.classList.toggle('miss', !open);
    setText(r.need, needText(r.tech));
    setText(r.btn, num(r.tech.cost));
    r.btn.disabled = !open || world.state.meat < r.tech.cost;
  }
  setText($('staff'), `${staff(world)} из ${seats(world)}`);
  setText($('huntText'), `Охотиться +${num(perTap(world))}`);
  for (const r of rows) {
    const n = amount(world, r.def), c = costOf(world, r.def, Math.max(n, 1)), l = lvl(world, r.def.id);
    setText(r.level, l ? (r.def.trip || r.def.feed ? `×${l}` + (hurt(world, r.def.id) ? `, ранены ${hurt(world, r.def.id)}` : '') : `ур. ${l}`) : '');
    setText(r.info, statLine(r.def, 1));
    if (r.def.from) setText(r.eat, promoteLine(r.def));
    else if (r.eat) r.eat.classList.toggle('warn', world.fed < .99);
    if (r.eat && !r.def.from) setText(r.eat, `едят ${num(l * r.def.feed * 60)}` + ` → ${num((l + 1) * r.def.feed * 60)}` + '/мин');
    r.pbar.classList.toggle('off', !milestones(r.def));
    const step = ranked(world, r.def.id) % MILESTONE;
    r.prog.style.width = `${step / MILESTONE * 100}%`;
    setText(r.x2, `${boostText()} через ${MILESTONE - step}`);
    r.drop.disabled = !l;
    const html = n >= 1 ? `${num(Math.ceil(c - 1e-6))}` : r.def.from ? `Нужен<small>${ALL.find(d => d.id === r.def.from).name.toLowerCase()}</small>` : 'Нет мест';
    if (r.html !== html) {
      r.html = html;
      r.btn.innerHTML = html;
    }
    r.btn.disabled = n < 1 || world.state.meat < c;
  }
  for (const r of rows) r.el.hidden = !opened(world, r.def.id);
  const dots = {quests: !stageBtn.hidden, techs: opened(world, 'techs') && techRows.some(r => !has(world, r.tech.id) && unlocked(world, r.tech) && world.state.meat >= r.tech.cost)};
  for (const r of rows) dots[secOf(r.def)] ||= !r.el.hidden && !r.btn.disabled;
  for (const el of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#nav button'))) {
    el.classList.toggle('dot', Boolean(dots[el.dataset.sec]));
    el.hidden = (el.dataset.sec === 'techs' && !opened(world, 'techs')) || (el.dataset.sec === 'farm' && !opened(world, 'field'));
  }
}
