import {BLESS_BOOST, BLESS_GIFT, HARVEST, MILESTONE, MILESTONE_BOOST} from './config.js';
import {num, pct, plural, up} from './format.js';
import {ACHS} from './data/achs.js';
import {CHAPTERS, FEATURE_AT} from './data/chapters.js';
import {BOOSTS, STAR_ITEMS} from './data/shop.js';
import {TECHS} from './data/techs.js';
import {ALL, ANIMALS, FARM, STATIONS, WORKERS} from './data/units.js';
import {VALLEYS} from './data/valleys.js';
import {STAT, animalRate, blessed, boostOn, cap, costOf, grainCap, grainNeed, grainRate, harvestSize, has, herd, hurt, isScared, legacy, lvl, milestones, opened, pens, perkOn, perSec, perTap, ranked, rateOf, seats, speed, staff, unlocked} from './core/formulas.js';
import {ACH_NOW, achReward, addMeat, advanceStage, blessGift, caughtMammoth, claimAch, cooled, farmStep, heatTick, mammothMeat, migrated, offline, purchase, purchaseBoost, purchaseTech, raid, recover, release, restarted, stokeHeat, tapped, tierOf, tigerScared, shellReward, amount} from './core/economy.js';
import {quests, stageCount} from './core/quests.js';
import {TUT_DONE} from './core/state.js';
import {createSaves, load} from './platform/saves.js';
import {createSound} from './platform/sound.js';
import {createStars} from './platform/stars.js';
import {buzzer, serverSaves, shopStars, tg, tgAt} from './platform/telegram.js';

/** @typedef {import('./core/state.js').State} State */
/** @typedef {import('./core/state.js').World} World */
/** @typedef {import('./data/units.js').Def} Def */
/** @typedef {import('./data/techs.js').Tech} Tech */
/** @typedef {import('./data/valleys.js').Valley} Valley */
/** @typedef {import('./data/valleys.js').Shade} Shade */
/** @typedef {import('./data/shop.js').Boost} Boost */
/** @typedef {import('./data/shop.js').StarItem} StarItem */
/** @typedef {import('./data/achs.js').AchLine} AchLine */
/** @typedef {{def:Def,xf:number,yf:number,vx:number,step:number}} Critter */
/** @typedef {{def:Def,xf:number,lane:number,dir:number,wait:number,carry:boolean,step:number}} Walker */
/** @typedef {{color:string,carry?:boolean|string,spear?:boolean,raise?:boolean,hat?:string,skin?:string,leg?:string,hair?:string,beard?:boolean,long?:boolean,dress?:boolean,bead?:string,band?:string,scythe?:number}} Look */
/** @typedef {{phase:string,i:number,xf:number,yf:number,dir:number,step:number,moving:boolean,swing:number,mowing:boolean,cut:boolean[],grow:number,stack:number,carry:boolean,placed:boolean}} Farmer */
/** @typedef {{xf:number,yf:number,tx:number,ty:number,dir:number,step:number,moving:boolean,wait:number,inside:boolean,look:Look}} Kid */
/** @typedef {{xf:number,yf:number,tx:number,ty:number,dx:number,delay:number,step:number,dir:number,throws:number,cool:number,color:string,moving:boolean}} Hunter */
/** @typedef {{xf:number,yf:number,x1:number,y1:number,t:number}} Spear */
/** @typedef {{y:number,draw:() => void}} Depth */
/** @typedef {{xf:number,lane:number,fleeing:boolean,step:number,caught?:boolean,phase?:string,fall?:number,lift?:number,stuck?:number,crew?:Hunter[],spears?:Spear[]}} Mammoth */
/** @typedef {{kind:'dot'|'smoke'|'fly'|'text',x:number,y:number,vx:number,vy:number,life:number,max:number,size:number,color:string,grav?:number,text?:string,delay?:number,speed?:number}} Particle */
/** @typedef {{def:Def,el:HTMLElement,btn:HTMLButtonElement,drop:HTMLButtonElement,level:HTMLElement,info:HTMLElement,prog:HTMLElement,x2:HTMLElement,pbar:HTMLElement,eat:HTMLElement|null,html:string}} Row */

/** @type {[number, number][]} */
const CREW = [[-.17, -.03], [-.13, .05], [.15, -.03], [.19, .05], [.01, .08]];
const CREW_COLORS = ['#A0522D', '#8A6B3F', '#B5533C', '#C1694F', '#9C7A4A'];
/** @type {[number, number, number][]} */
const STUCK = [[-14, -16, -.6], [4, -22, .2], [16, -12, .7], [-4, -8, -.3], [10, -4, .5], [-18, -2, -.8], [0, -18, 0], [20, -20, .9], [-10, -24, -.4], [8, -10, .3]];
const MAX_WALKERS = 8;
const MAX_FRAME = 900;
const CAVE = .12;
const FOREST = .94;
const TARGET = {x: 30, y: 30};
const CONFETTI = ['#FFCC4D', '#F4900C', '#77B255', '#55ACEE', '#DD2E44', '#AA8DD8'];
const FONT = "'Rubik', system-ui, sans-serif";
const $ = id => document.getElementById(id);
/** @param {string} code @returns {string} */
const icon = code => `assets/twemoji/${code}.svg`;

/** @type {State} */
let state = load();
let heat = 0;
let night = 0;
let fedNow = 1;
/** @type {World} */
const world = {get state() { return state; }, get heat() { return heat; }, get fed() { return fedNow; }, get now() { return Date.now(); }};
const buzz = buzzer(world);
const {save, saveNow, pull, pullServer, pullCloud} = createSaves(world, welcomeBack);
const sound = createSound(world);
const {beep, tune} = sound;

/** @returns {string} */
const boostText = () => `+${pct(MILESTONE_BOOST - 1)}%`;
/** @returns {Valley} */
const theme = () => VALLEYS[state.valley % VALLEYS.length];
/** @returns {string} */
const treeKind = () => theme().extra === 'sea' ? 'palm' : 'pine';
/** @param {number} v @returns {string} */
const valleyName = v => VALLEYS[v % VALLEYS.length].name + (v >= VALLEYS.length ? ` ${Math.floor(v / VALLEYS.length) + 1}` : '');

let lastFull = 0;
/** @param {number} got @param {number} n */
function overflow(got, n) {
  const now = performance.now();
  if (got < n && now - lastFull > 1500) {
    lastFull = now;
    beep(140, .12, 'square', .04);
  }
}

/** @param {number} n @returns {number} */
function gain(n) {
  const got = addMeat(world, n);
  overflow(got, n);
  return got;
}

/** @param {HTMLButtonElement} btn @param {() => boolean} act */
function holdable(btn, act) {
  let timer = 0, held = false;
  const stop = () => {
    clearTimeout(timer);
    timer = 0;
  };
  const repeat = delay => {
    timer = setTimeout(() => act() ? repeat(Math.max(40, delay * .85)) : stop(), delay);
  };
  btn.addEventListener('pointerdown', () => {
    held = false;
    stop();
    timer = setTimeout(() => {
      held = true;
      if (act()) repeat(140);
    }, 350);
  });
  btn.addEventListener('pointerup', () => {
    if (timer && !held) act();
    stop();
  });
  for (const type of ['pointerleave', 'pointercancel']) btn.addEventListener(type, stop);
  btn.addEventListener('click', e => {
    if (e.detail === 0) act();
  });
  btn.addEventListener('contextmenu', e => e.preventDefault());
}

let lastBump = 0;
function bump() {
  const now = performance.now();
  if (now - lastBump < 150) return;
  lastBump = now;
  const el = $('meat');
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

const canvas = /** @type {HTMLCanvasElement} */ ($('canvas'));
const ctx = canvas.getContext('2d');
let W = 0, H = 0, FH = 0, U = 1;
function resize() {
  const r = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  W = r.width;
  FH = r.height;
  H = FH * .62;
  U = Math.min(H / 320, W / 330);
  canvas.width = W * dpr;
  canvas.height = FH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
const desktop = matchMedia('(min-width:600px)');
const rootCss = getComputedStyle(document.documentElement);
const BASE_W = Number(rootCss.getPropertyValue('--base-w'));
const BASE_H = Number(rootCss.getPropertyValue('--base-h'));
let uiScale = 1;
function fit() {
  uiScale = desktop.matches ? Math.min(innerHeight, MAX_FRAME) / BASE_H : innerWidth / BASE_W;
  document.documentElement.style.setProperty('--k', String(uiScale));
  resize();
}
new ResizeObserver(resize).observe(canvas);
addEventListener('resize', fit);
fit();

/** @type {Particle[]} */
let particles = [];
/** @type {Walker[]} */
let walkers = [];
/** @type {Mammoth|null} */
let mammoth = null;
let mammothIn = 25;
/** @type {{xf:number,lane:number,hp:number,fleeing:boolean,step:number,shake:number}|null} */
let tiger = null;
let tigerIn = 15;
/** @type {Critter[]} */
let critters = [];
let farmAcc = 0, farmT = 0;
/** @type {Kid[]} */
const kids = [
  {xf: .4, yf: .82, tx: .4, ty: .82, dir: 1, step: 0, moving: false, wait: 1, inside: false, look: {color: '#E2B84A', beard: false, hair: '#5B3A29', skin: '#F1C9A5', leg: '#D9AE88'}},
  {xf: .6, yf: .88, tx: .6, ty: .88, dir: -1, step: 0, moving: false, wait: 2, inside: false, look: {color: '#77B255', beard: false, long: true, hair: '#292F33', bead: '#55ACEE', skin: '#C08A5B', leg: '#9E6E44'}},
];
/** @type {Farmer} */
const farmer = {phase: 'mow', i: 0, xf: 0, yf: 0, dir: 1, step: 0, moving: false, swing: 0, mowing: false, cut: [], grow: 1, stack: 0, carry: false, placed: false};
let smokeT = 0, steamT = 0, weatherT = 0;
/** @type {{id:string,x:number,y:number,r:number}[]} */
let hits = [];
const stars = Array.from({length: 40}, () => [Math.random(), Math.random() * .4, Math.random() * 1.4 + .4]);
const clouds = [[.1, .1, 1], [.5, .2, .7], [.8, .07, 1.2], [1.15, .26, .9]];

/** @returns {{fx0:number,fx1:number,px0:number,px1:number,y0:number,y1:number}} */
function farmBox() {
  return {fx0: W * .05, fx1: W * .46, px0: W * .52, px1: W * .95, y0: H + 26 * U, y1: Math.max(H + 90 * U, FH - 74)};
}

/** @returns {[number, number][]} */
function cropSpots() {
  const b = farmBox(), cols = 4, rows = Math.max(1, Math.floor((b.y1 - b.y0 - 20 * U) / (30 * U)));
  return Array.from({length: Math.min(cols * rows, lvl(world, 'field') * 2)}, (_, i) => [b.fx0 + (b.fx1 - b.fx0) * ((i % cols) + .5) / cols, b.y0 + 34 * U + Math.floor(i / cols) * 30 * U]);
}

/** @param {number} n @returns {number[]} */
function mowOrder(n) {
  const out = [];
  for (let r = 0; r * 4 < n; r++) {
    const row = [];
    for (let k = r * 4; k < Math.min(n, r * 4 + 4); k++) row.push(k);
    out.push(...(r % 2 ? row.reverse() : row));
  }
  return out;
}

/** @returns {[number, number]} */
const granarySpot = () => [farmBox().fx0 + 22 * U, farmBox().y0 + 4 * U];
/** @returns {[number, number]} */
const stackSpot = () => [farmBox().fx1 - 12 * U, farmBox().y1 - 12 * U];

/** @param {number} dt */
function farmerTick(dt) {
  const f = farmer, spots = cropSpots();
  if (!spots.length) return;
  while (f.cut.length < spots.length) f.cut.push(false);
  f.cut.length = spots.length;
  if (!f.placed) {
    f.xf = (spots[0][0] - 14 * U) / W;
    f.yf = (spots[0][1] + 4 * U) / FH;
    f.placed = true;
  }
  f.grow = Math.min(1, f.grow + dt / 12);
  /** @param {number} x @param {number} y @returns {boolean} */
  const go = (x, y) => {
    const dx = x - f.xf * W, dy = y - f.yf * FH, d = Math.hypot(dx, dy);
    f.moving = d > 1.5;
    if (!f.moving) return true;
    const v = Math.min(d, 42 * U * dt) / d;
    f.xf += dx * v / W;
    f.yf += dy * v / FH;
    f.step += dt * 9;
    if (Math.abs(dx) > .5) f.dir = Math.sign(dx);
    return false;
  };
  if (f.phase === 'mow') {
    const order = mowOrder(spots.length), k = order[f.i];
    if (k === undefined) {
      f.phase = 'stack';
      return;
    }
    const [cx, cy] = spots[k];
    if (!go(cx - 14 * U, cy + 4 * U) || f.grow < 1) return;
    f.dir = 1;
    if (!f.mowing) {
      f.mowing = true;
      f.swing = .45;
      return;
    }
    f.swing -= dt;
    if (f.swing > 0) return;
    f.cut[k] = true;
    f.mowing = false;
    f.i++;
    burst(cx, cy - 8 * U, 6, '#9BC45A');
  } else if (f.phase === 'stack') {
    const [sx, sy] = stackSpot();
    if (!go(sx - 26 * U, sy + 4 * U)) return;
    f.dir = 1;
    f.stack = Math.min(1.6, f.stack + dt / .8);
    if (f.stack >= 1.6) {
      f.phase = 'haul';
      f.carry = true;
    }
  } else if (f.phase === 'haul') {
    const [gx, gy] = granarySpot();
    if (!go(gx + 18 * U, gy + 10 * U)) return;
    burst(gx, gy - 16 * U, 10, '#E2B84A');
    Object.assign(f, {phase: 'mow', i: 0, grow: 0, stack: 0, carry: false});
    f.cut.fill(false);
  }
}

/** @param {number} dt */
function kidsTick(dt) {
  const dark = night > .55;
  for (const k of kids) {
    if (k.inside) {
      if (night > .45) continue;
      Object.assign(k, {inside: false, xf: CAVE + .02, yf: .78, wait: Math.random()});
    }
    if (dark) {
      k.tx = CAVE + .01;
      k.ty = .77;
    } else if (!k.moving && (k.wait -= dt) <= 0) {
      k.tx = .2 + Math.random() * .62;
      k.ty = .76 + Math.random() * .18;
      k.wait = .4 + Math.random() * 2.2;
    }
    const dx = (k.tx - k.xf) * W, dy = (k.ty - k.yf) * H, d = Math.hypot(dx, dy);
    k.moving = d > 1.5;
    if (k.moving) {
      const v = Math.min(d, (dark ? 95 : 70) * U * dt) / d;
      k.xf += dx * v / W;
      k.yf += dy * v / H;
      k.step += dt * 16;
      if (Math.abs(dx) > .5) k.dir = Math.sign(dx);
    } else if (dark) k.inside = true;
  }
}

/** @param {number} t @returns {Depth[]} */
function kidsDepth(t) {
  return kids.filter(k => !k.inside).map(k => {
    const i = kids.indexOf(k), hop = k.moving ? 0 : Math.max(0, Math.sin(t * 5 + i * 2)) * 3 * U;
    return {y: k.yf * H, draw: () => drawPerson(k.xf * W, k.yf * H - hop, U * .55, k.dir, k.step, k.moving, k.look)};
  });
}

/** @param {number} x @param {number} y @param {number} k */
function drawStack(x, y, k) {
  ctx.fillStyle = '#E2B84A';
  ctx.beginPath();
  ctx.ellipse(x, y, 20 * U * k, 22 * U * k, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#C9962E';
  ctx.lineWidth = 1.6 * U;
  ctx.beginPath();
  for (const sx of [-12, -4, 4, 12]) {
    ctx.moveTo(x + sx * U * k, y);
    ctx.quadraticCurveTo(x + sx * .7 * U * k, y - 12 * U * k, x + sx * .25 * U * k, y - 20 * U * k);
  }
  ctx.stroke();
}

/** @param {number} x @param {number} y */
function drawGranary(x, y) {
  for (const sx of [-14, -5, 4, 13]) pill(x + (sx - 1.5) * U, y - 10 * U, 3 * U, 10 * U, 1 * U, '#662113');
  pill(x - 18 * U, y - 30 * U, 36 * U, 21 * U, 3 * U, '#A0522D');
  ctx.strokeStyle = 'rgba(102,33,19,.5)';
  ctx.lineWidth = 1.2 * U;
  ctx.beginPath();
  for (const sy of [-23, -16]) {
    ctx.moveTo(x - 17 * U, y + sy * U);
    ctx.lineTo(x + 17 * U, y + sy * U);
  }
  ctx.stroke();
  pill(x - 4 * U, y - 26 * U, 9 * U, 17 * U, 2 * U, '#662113');
  ctx.fillStyle = '#E2B84A';
  ctx.beginPath();
  ctx.moveTo(x - 24 * U, y - 28 * U);
  ctx.lineTo(x, y - 46 * U);
  ctx.lineTo(x + 24 * U, y - 28 * U);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#C9962E';
  ctx.beginPath();
  for (const sx of [-14, -6, 2, 10]) {
    ctx.moveTo(x + sx * U, y - 29 * U);
    ctx.lineTo(x + (sx + 4) * U, y - 37 * U);
  }
  ctx.stroke();
}

function syncCritters() {
  for (const def of ANIMALS) {
    const want = Math.min(lvl(world, def.id), 6);
    const mine = critters.filter(c => c.def === def);
    for (let i = mine.length; i < want; i++) critters.push({def, xf: Math.random(), yf: .3 + Math.random() * .7, vx: (Math.random() - .5) * .2, step: Math.random() * 6});
    if (mine.length > want) critters = critters.filter(c => c.def !== def).concat(mine.slice(0, want));
  }
}

/** @param {number} dt */
function farmTick(dt) {
  const {harvested, fed} = farmStep(world, dt), fb = farmBox();
  if (harvested > 0) floater((fb.fx0 + fb.fx1) / 2, fb.y0 + 10 * U, `+${num(harvested)} пшена`, '#FFCC4D', 14);
  fedNow = fed;
  farmAcc += ANIMALS.reduce((sum, a) => sum + animalRate(world, a), 0) * dt;
  farmT += dt;
  if (farmT >= 2) {
    farmT = 0;
    const got = gain(up(farmAcc));
    farmAcc = 0;
    const b = farmBox();
    if (got >= .1) floater((b.px0 + b.px1) / 2, b.y0 + 10 * U, '+' + num(got), '#FFFFFF', 13);
  }
  farmerTick(dt);
  for (const c of critters) {
    c.step += dt * (c.def.id === 'rabbit' ? 9 : 4);
    c.xf += c.vx * dt;
    if (c.xf < 0 || c.xf > 1) c.vx = -c.vx;
    c.xf = Math.max(0, Math.min(1, c.xf));
    if (Math.random() < dt * .4) c.vx = (Math.random() - .5) * (c.def.id === 'rabbit' ? .4 : .18);
  }
}

/** @param {string} id @returns {{x:number,y:number}} */
function spotOf(id) {
  const p = {fire: [.1, .86], kitchen: [.43, .63], storage: [.585, .6], bath: [.73, .58]}[id] || [CAVE, .72];
  return {x: p[0] * W, y: p[1] * H};
}

/** @param {number} x @param {number} y @param {string} text @param {string} color @param {number} [size] */
function floater(x, y, text, color, size = 16) {
  particles.push({kind: 'text', x, y, vx: 0, vy: -40, life: 1.1, max: 1.1, size, color, text});
}

/** @param {number} x @param {number} y @param {number} n @param {string} color */
function burst(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 160;
    particles.push({kind: 'dot', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, grav: 400, life: .7, max: .7, size: (2 + Math.random() * 2) * U, color});
  }
}

/** @param {number} x @param {number} y @param {number} n */
function fly(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 120;
    particles.push({kind: 'fly', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 3, max: 3, size: 4 * U, color: '#b5532a', delay: .25, speed: 200});
  }
}

/** @param {number} x @param {number} y */
function hunt(x, y) {
  const n = gain(perTap(world));
  tapped(world);
  if (n > 0) {
    floater(x, y - 10, '+' + num(n), '#ffd08a');
    fly(x, y, 2);
  }
  beep(150 + Math.random() * 50, .08, 'triangle', .12);
  buzz(8);
  bump();
}

function catchMammoth() {
  const n = gain(mammothMeat(world));
  const x = mammoth.xf * W, y = mammoth.lane * H - 30 * U;
  caughtMammoth(world);
  Object.assign(mammoth, {fleeing: true, caught: true, phase: 'run', fall: 0, lift: 0, stuck: 0, spears: [], crew: CREW.map(([ox, oy], i) => ({xf: CAVE, yf: .76, tx: Math.min(.97, Math.max(.05, mammoth.xf + ox)), ty: mammoth.lane + oy, dx: 0, delay: i * .18, step: 0, dir: 1, throws: 2, cool: i * .12, color: CREW_COLORS[i], moving: false}))});
  floater(x, y - 30 * U, `Мамонт! +${num(n)}`, '#ffd08a', 22);
  burst(x, y, 30, '#ffd08a');
  fly(x, y, 12);
  tune([392, 523, 659], 80);
  buzz([20, 40, 20]);
  bump();
}

function stoke() {
  heat = stokeHeat(world);
  const f = spotOf('fire');
  burst(f.x, f.y - 20 * U, 8, '#ffa424');
  floater(f.x, f.y - 55 * U, `Жар ${Math.round(heat)}%`, '#ffa424', 13);
  beep(90 + Math.random() * 40, .06, 'sawtooth', .04);
  buzz(5);
}

/** @param {string} text */
function scare(text) {
  tiger.fleeing = true;
  tigerScared(world);
  floater(tiger.xf * W, tiger.lane * H - 50 * U, text, '#ffd08a', 16);
  burst(tiger.xf * W, tiger.lane * H - 20 * U, 20, '#ffa424');
  tune([440, 587], 90);
}

function hitTiger() {
  tiger.hp--;
  tiger.shake = .25;
  burst(tiger.xf * W, tiger.lane * H - 20 * U, 10, '#e0832a');
  beep(110, .1, 'sawtooth', .08);
  buzz(15);
  if (tiger.hp <= 0) scare('Тигр прогнан!');
}

/** @param {Tech} tech */
function buyTech(tech) {
  if (!purchaseTech(world, tech)) return;
  celebrate(`Открытие: ${tech.name}!`);
  renderList();
}

/** @param {Tech} tech @returns {string} */
function needText(tech) {
  const [id, n] = tech.need, def = ALL.find(d => d.id === id), now = lvl(world, id);
  return `Нужно: ${def.name} ${def.trip ? '×' : 'ур. '}${n}` + (now < n ? `, есть ${now}` : '');
}

/** @param {string} text @param {string} [code] */
function banner(text, code = '1f389') {
  /** @type {HTMLImageElement} */ ($('bannerIcon')).src = icon(code);
  $('bannerText').textContent = text;
  $('banner').classList.add('show');
  setTimeout(() => $('banner').classList.remove('show'), 2400);
}

/** @param {string} text */
function celebrate(text) {
  banner(text);
  for (let i = 0; i < 70; i++) {
    particles.push({kind: 'dot', x: Math.random() * W, y: -10, vx: (Math.random() - .5) * 80, vy: 40 + Math.random() * 120, grav: 120, life: 2.5, max: 2.5, size: (2 + Math.random() * 3) * U, color: CONFETTI[i % CONFETTI.length]});
  }
  tune([523, 659, 784, 1047], 90);
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
  renderList();
  return true;
}

/** @type {(() => void)|null} */
let onModal = null;
/** @param {string} text @param {string} big @param {string} ok @param {() => void} action @param {boolean} [cancel] @param {string} [code] */
function modal(text, big, ok, action, cancel = false, code = '1f356') {
  /** @type {HTMLImageElement} */ ($('mIcon')).src = icon(code);
  $('mText').textContent = text;
  $('mBig').textContent = big;
  $('mOk').textContent = ok;
  $('mNo').hidden = !cancel;
  onModal = action;
  $('modal').classList.add('show');
}

function claimStage() {
  const want = advanceStage(world);
  if (want === null) return;
  const reward = gain(want);
  fly(W / 2, H / 2, 20);
  celebrate(`Веха пройдена! +${num(reward)} мяса`);
  bump();
  renderList();
}

function askMigrate() {
  const next = CHAPTERS[state.valley + 1];
  modal(`Племя уходит в новые земли: ${valleyName(state.valley + 1)}. Мясо, постройки, рабочие и открытия останутся здесь, зато мудрость предков навсегда прибавит к добыче 17%, а в пути племя найдёт ${plural(shellReward(world), ['ракушку', 'ракушки', 'ракушек'])}.` + (next ? ` Там племя освоит новое: ${next.title.toLowerCase()}.` : ''), `Добыча +${pct((7 / 6) ** (state.valley + 1) - 1)}%`, 'Переселиться', migrate, true, '1f5fa');
}

function migrate() {
  $('fade').classList.add('show');
  tune([330, 294, 262], 150);
  setTimeout(() => {
    state = migrated(world);
    walkers = [];
    critters = [];
    particles = [];
    mammoth = null;
    mammothIn = state.valley === FEATURE_AT.mammoth ? 8 : 25;
    tiger = null;
    heat = 0;
    tutShown = -1;
    save();
    openSheet('');
    renderList();
    $('fade').classList.remove('show');
    const chapter = CHAPTERS[state.valley];
    celebrate(chapter ? `Новое: ${chapter.title}` : `Новые земли: ${valleyName(state.valley)}`);
  }, 900);
}

const TITLES = {quests: 'Задания и достижения', yard: 'Пещера и двор', tribe: 'Племя', farm: 'Ферма', techs: 'Открытия', shop: 'Лавка шамана'};
let openSec = '';

/** @param {Def} def @returns {string} */
const secOf = def => FARM.includes(def) ? 'farm' : WORKERS.includes(def) ? 'tribe' : 'yard';

/** @param {string} sec */
function openSheet(sec) {
  if (sec !== openSec) $('sheetBody').scrollTop = 0;
  openSec = sec;
  $('sheet').classList.toggle('open', Boolean(sec));
  for (const el of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.sec'))) el.hidden = el.dataset.sec !== sec;
  for (const el of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#nav button'))) el.classList.toggle('on', el.dataset.sec === sec);
  if (sec) setText($('sheetTitle'), TITLES[sec]);
}

function syncWalkers() {
  for (const def of WORKERS) {
    const want = Math.min(lvl(world, def.id) - hurt(world, def.id), MAX_WALKERS);
    const mine = walkers.filter(w => w.def === def);
    for (let i = mine.length; i < want; i++) {
      walkers.push({def, xf: CAVE, lane: .76 + Math.random() * .2, dir: 1, wait: Math.random() * def.time, carry: false, step: 0});
    }
    if (mine.length > want) walkers = walkers.filter(w => w.def !== def).concat(mine.slice(0, want));
  }
  walkers.sort((a, b) => a.lane - b.lane);
}

let lastTick = 0;
/** @param {Walker} w */
function deliver(w) {
  const n = up(rateOf(world, w.def) * w.def.time / speed(world) / walkers.filter(o => o.def === w.def).length);
  gain(n);
  const now = performance.now();
  if (now - lastTick > 300) {
    lastTick = now;
    floater(CAVE * W + 20 + Math.random() * 40, H * (.68 + Math.random() * .1), '+' + num(n), '#f3e6d3', 12);
    beep(880, .04, 'sine', .03);
  }
  bump();
}

/** @param {Walker} w @param {number} dt */
function moveWalker(w, dt) {
  if (w.wait > 0) {
    w.wait -= dt;
    return;
  }
  const v = 2 * (FOREST - CAVE) * speed(world) / (w.def.time - .5);
  w.xf += w.dir * v * dt;
  w.step += dt * 7 * speed(world);
  if (w.dir > 0 && w.xf >= FOREST) {
    w.xf = FOREST;
    w.dir = -1;
    w.carry = true;
    w.wait = .5 / speed(world);
  } else if (w.dir < 0 && w.xf <= CAVE) {
    w.xf = CAVE;
    w.dir = 1;
    w.carry = false;
    deliver(w);
  }
}

/** @returns {number} */
const nextMammoth = () => (45 + Math.random() * 60) / (has(world, 'paint') ? 2 : 1);

/** @param {number} dt */
function huntTick(dt) {
  const m = mammoth, crew = m.crew;
  let ready = true;
  for (const h of crew) {
    h.moving = false;
    if (h.delay > 0) {
      h.delay -= dt;
      ready = false;
      continue;
    }
    const dx = h.tx - h.xf, dy = h.ty - h.yf, d = Math.hypot(dx, dy);
    if (d > .004) {
      const v = Math.min(d, .6 * dt);
      h.xf += dx / d * v;
      h.yf += dy / d * v;
      h.step += dt * 12;
      h.moving = true;
      if (Math.abs(dx) > .002) h.dir = Math.sign(dx);
      ready = false;
    }
  }
  if (m.phase === 'run' && ready) m.phase = 'throw';
  if (m.phase === 'throw') {
    for (const h of crew) {
      h.dir = Math.sign(m.xf - h.xf) || 1;
      h.cool -= dt;
      if (h.cool <= 0 && h.throws > 0) {
        h.throws--;
        h.cool = .5;
        m.spears.push({xf: h.xf + h.dir * .02, yf: h.yf - .07, x1: m.xf + (Math.random() - .5) * .08, y1: m.lane - .1 - Math.random() * .06, t: 0});
        beep(300, .05, 'triangle', .03);
      }
    }
    for (const s of m.spears) s.t += dt / .35;
    for (const s of m.spears.filter(s => s.t >= 1)) {
      m.stuck++;
      burst(s.x1 * W, s.y1 * H, 6, '#e0832a');
      beep(120, .08, 'sawtooth', .05);
    }
    m.spears = m.spears.filter(s => s.t < 1);
    if (!m.spears.length && crew.every(h => !h.throws)) m.phase = 'fall';
  } else if (m.phase === 'fall') {
    m.fall = Math.min(1, m.fall + dt / .6);
    if (m.fall >= 1) {
      burst(m.xf * W, m.lane * H, 24, '#c9b08a');
      tune([196, 147], 140);
      buzz(30);
      crew.forEach((h, i) => {
        h.dx = (i - 2) * .045;
        h.tx = m.xf + h.dx;
        h.ty = m.lane + .01;
      });
      m.phase = 'gather';
    }
  } else if (m.phase === 'gather' && ready) m.phase = 'carry';
  else if (m.phase === 'carry') {
    m.lift = Math.min(1, m.lift + dt / .5);
    if (m.lift < 1) return;
    m.xf -= .09 * dt;
    m.step += dt * 6;
    for (const h of crew) {
      h.xf = h.tx = m.xf + h.dx;
      h.dir = -1;
      h.step += dt * 6;
      h.moving = true;
    }
    if (m.xf <= CAVE - .01) {
      mammoth = null;
      mammothIn = nextMammoth();
    }
  }
}

/** @param {number} dt */
function update(dt) {
  walkers.forEach(w => moveWalker(w, dt));
  farmTick(dt);
  kidsTick(dt);
  for (const c of clouds) {
    c[0] += .01 * dt;
    if (c[0] > 1.25) c[0] = -.25;
  }
  if (!mammoth) {
    mammothIn -= dt;
    if (mammothIn <= 0 && opened(world, 'mammoth') && Date.now() >= state.mammothRest) mammoth = {xf: -.15, lane: .86, fleeing: false, step: 0};
  } else if (mammoth.caught) huntTick(dt);
  else {
    mammoth.xf += (mammoth.fleeing ? .45 : .07) * dt;
    mammoth.step += dt * (mammoth.fleeing ? 14 : 8);
    if (mammoth.xf > 1.2) {
      mammoth = null;
      mammothIn = nextMammoth();
    }
  }
  heat = heatTick(world, dt, night);
  if (!tiger) {
    if (!document.hidden && night > .6 && heat < 25 && state.earned > 10000 && opened(world, 'tiger') && !boostOn(world, 'ward')) {
      tigerIn -= dt * (isScared(world) ? .5 : 1);
      if (tigerIn <= 0) tiger = {xf: 1.1, lane: .82, hp: 3, fleeing: false, step: 0, shake: 0};
    }
  } else if (!document.hidden) {
    tiger.shake = Math.max(0, tiger.shake - dt);
    if (!tiger.fleeing && heat >= 60) scare('Огонь отпугнул тигра!');
    const calm = isScared(world) ? .5 : 1;
    tiger.xf += (tiger.fleeing ? .5 : -.06 * calm) * dt;
    tiger.step += dt * (tiger.fleeing ? 14 : 6 * calm);
    if (!tiger.fleeing && tiger.xf <= CAVE + .06) {
      const loss = raid(world);
      tiger.fleeing = true;
      floater(tiger.xf * W + 40 * U, tiger.lane * H - 50 * U, `−${num(loss)} мяса`, '#ff8a6a', 18);
      banner('Тигр утащил 80% мяса и покалечил полплемени!', '1f631');
      tune([220, 165, 110], 160);
      buzz([60, 40, 60]);
      renderList();
    }
    if (tiger.xf > 1.25) {
      tiger = null;
      tigerIn = 20 + Math.random() * 30;
    }
  }
  smokeT -= dt;
  if (smokeT < 0) {
    smokeT = .14;
    const f = spotOf('fire');
    particles.push({kind: 'smoke', x: f.x, y: f.y - 22 * U, vx: (Math.random() - .5) * 10, vy: -22 * U, life: 2.2, max: 2.2, size: 4 * U, color: '#9a8f86'});
  }
  steamT -= dt;
  if (steamT < 0 && lvl(world, 'bath')) {
    steamT = .3;
    const b = spotOf('bath');
    particles.push({kind: 'smoke', x: b.x + 8 * U, y: b.y - 46 * U, vx: (Math.random() - .5) * 12, vy: -18 * U, life: 1.8, max: 1.8, size: 5 * U, color: '#ffffff'});
  }
  weatherT -= dt;
  const extra = theme().extra;
  if (weatherT < 0 && extra === 'snow') {
    weatherT = .08;
    particles.push({kind: 'dot', x: Math.random() * W, y: -5, vx: (Math.random() - .5) * 20, vy: 25 + Math.random() * 25, life: 8, max: 8, size: (1 + Math.random() * 1.5) * U, color: '#ffffff'});
  }
  if (weatherT < 0 && extra === 'volcano') {
    weatherT = .25;
    particles.push({kind: 'smoke', x: W * .58, y: H * .53 - 112 * U, vx: 6 + Math.random() * 8, vy: -10 * U, life: 4, max: 4, size: 7 * U, color: '#3a3030'});
  }
  for (const p of particles) {
    p.life -= dt;
    if (p.kind === 'fly') {
      if (p.delay > 0) {
        p.delay -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= .9;
        p.vy *= .9;
      } else {
        const dx = TARGET.x - p.x, dy = TARGET.y - p.y, d = Math.hypot(dx, dy);
        p.speed += 1800 * dt;
        const step = Math.min(d, p.speed * dt);
        p.x += dx / d * step;
        p.y += dy / d * step;
        if (d < 8) p.life = 0;
      }
    } else {
      p.vy += (p.grav || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
  particles = particles.filter(p => p.life > 0 && p.y < FH + 20);
}

/** @param {string} a @param {string} b @param {number} k @returns {string} */
function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** @param {Shade} s @param {number} day @returns {string} */
const shade = (s, day) => mix(s[0], s[1], day);

const SPRITES = {mammoth: '1f9a3', tiger: '1f405', meat: '1f356', fire: '1f525', hut: '1f6d6', rock: '1faa8', wood: '1fab5', pine: '1f332', palm: '1f334', volcano: '1f30b', basket: '1f9fa', skull: '1f480', hotspring: '2668', cloud: '2601', sun: '2600', moon: '1f319', feather: '1fab6', grain: '1f33e', rabbit: '1f407', goat: '1f410', seedling: '1f331'};
/** @type {Record<string, HTMLCanvasElement>} */
const sprites = {};
for (const [name, code] of Object.entries(SPRITES)) {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 144;
    c.getContext('2d').drawImage(img, 0, 0, 144, 144);
    sprites[name] = c;
  };
  img.src = icon(code);
}

/** @param {string} name @param {number} x @param {number} y @param {number} size @param {boolean} [flip] @param {number} [rot] */
function sprite(name, x, y, size, flip = false, rot = 0) {
  const c = sprites[name];
  if (!c) return;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(c, -size / 2, -size, size, size);
  ctx.restore();
}

/** @param {string} name @param {number} x @param {number} y @param {number} size @param {number} [rot] */
function spriteAt(name, x, y, size, rot = 0) {
  const c = sprites[name];
  if (!c) return;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(c, -size / 2, -size / 2, size, size);
  ctx.restore();
}

/** @param {number} x @param {number} y @param {number} r @param {number} a */
function glow(x, y, r, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,172,51,${a})`);
  g.addColorStop(1, 'rgba(255,172,51,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** @param {number} x @param {number} y @param {number} w @param {number} h @param {number} r @param {string} color */
function pill(x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** @param {number} x @param {number} y @param {string} text */
function tag(x, y, text) {
  ctx.font = `700 ${Math.round(9 * U)}px ${FONT}`;
  const w = ctx.measureText(text).width + 12 * U, h = 15 * U;
  pill(x - w / 2, y - h / 2 + 2 * U, w, h, h / 2, 'rgba(41,47,51,.25)');
  pill(x - w / 2, y - h / 2, w, h, h / 2, '#FFF4DF');
  ctx.fillStyle = '#3B2A1E';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + .5 * U);
}

/** @param {number} x @param {number} y @param {string} text @param {number} t @param {string} color */
function bubble(x, y, text, t, color) {
  const by = y - Math.abs(Math.sin(t * 4)) * 5 * U;
  ctx.font = `800 ${Math.round(11 * U)}px ${FONT}`;
  const w = ctx.measureText(text).width + 18 * U, h = 21 * U;
  pill(x - w / 2, by - h / 2 + 2.5 * U, w, h, h / 2, 'rgba(41,47,51,.3)');
  pill(x - w / 2, by - h / 2, w, h, h / 2, color);
  ctx.beginPath();
  ctx.moveTo(x - 5 * U, by + h / 2 - 1);
  ctx.lineTo(x, by + h / 2 + 6 * U);
  ctx.lineTo(x + 5 * U, by + h / 2 - 1);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, by + .5 * U);
}

/** @param {number} x @param {number} y @param {string} label @param {number} t */
function sign(x, y, label, t) {
  ctx.setLineDash([4 * U, 4 * U]);
  ctx.strokeStyle = `rgba(255,255,255,${.35 + Math.sin(t * 3) * .15})`;
  ctx.lineWidth = 1.5 * U;
  ctx.beginPath();
  ctx.ellipse(x, y - 2 * U, 30 * U, 8 * U, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  pill(x - 2.5 * U, y - 30 * U, 5 * U, 30 * U, 2 * U, '#662113');
  pill(x - 28 * U, y - 47 * U, 56 * U, 20 * U, 5 * U, '#C1694F');
  pill(x - 25 * U, y - 45 * U, 50 * U, 16 * U, 4 * U, '#D99E82');
  ctx.fillStyle = '#662113';
  ctx.font = `800 ${Math.round(10 * U)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y - 36.5 * U);
}

/** @param {number} day @param {number} t */
function drawExtra(day, t) {
  const extra = theme().extra;
  if (extra === 'sea') {
    ctx.fillStyle = mix('#1C5A8A', '#55ACEE', day);
    ctx.fillRect(0, H * .43, W, H * .08);
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = 2 * U;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const x = ((i * .17 + t * .01) % 1.1) * W, y = H * (.45 + (i % 3) * .02);
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 6 * U, y - 3 * U, x + 12 * U, y);
    }
    ctx.stroke();
  }
  if (extra === 'volcano') sprite('volcano', W * .58, H * .53, 120 * U);
}

/** @param {number} night @param {number} t */
function drawCave(night, t) {
  const day = 1 - night, th = theme();
  ctx.fillStyle = shade(th.rock, day);
  ctx.beginPath();
  [[0, .14], [.09, .17], [.17, .26], [.22, .4], [.27, .56], [.26, .76], [0, .8]].forEach(([x, y], i) => i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(th.rockSpot, day);
  ctx.beginPath();
  ctx.ellipse(.07 * W, .3 * H, 14 * U, 6 * U, -.3, 0, Math.PI * 2);
  ctx.ellipse(.19 * W, .48 * H, 10 * U, 5 * U, .5, 0, Math.PI * 2);
  ctx.fill();
  const cx = CAVE * W, cy = .75 * H, cw = .075 * W, ch = .2 * H, l = lvl(world, 'cave');
  ctx.fillStyle = '#292F33';
  ctx.beginPath();
  ctx.ellipse(cx, cy, cw, ch, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  if (l) glow(cx, cy - ch * .4, cw * 1.4, Math.min(.12 + l * .03, .4));
  if (l >= 3) {
    ctx.strokeStyle = '#662113';
    ctx.lineWidth = 2.5 * U;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + cw * 1.1, cy - ch * .9);
    ctx.lineTo(cx + cw * 2, cy - ch * .7);
    ctx.stroke();
    ctx.fillStyle = '#C1694F';
    ctx.beginPath();
    ctx.ellipse(cx + cw * 1.55, cy - ch * .62, 7 * U, 10 * U, Math.sin(t * 1.5) * .08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#D99E82';
    ctx.beginPath();
    ctx.ellipse(cx + cw * 1.55, cy - ch * .62, 3 * U, 5 * U, Math.sin(t * 1.5) * .08, 0, Math.PI * 2);
    ctx.fill();
  }
  if (l >= 6) sprite('skull', cx, cy - ch * .98, 18 * U);
  if (l >= 1) {
    for (const s of [-1, 1]) {
      const tx = cx + s * cw * 1.15, ty = cy - ch * .45;
      pill(tx - 2 * U, ty, 4 * U, 22 * U, 2 * U, '#662113');
      glow(tx, ty - 6 * U, 30 * U, .15 + night * .3);
      sprite('fire', tx, ty + 2 * U, 15 * U * (1 + Math.sin(t * 10 + s) * .08));
    }
  }
  tag(cx, cy - ch - 26 * U, l ? `Пещера, ур. ${l}` : 'Пещера');
  hits.push({id: 'cave', x: cx, y: cy - ch * .5, r: cw * 1.3});
}

/** @param {number} night @param {number} t */
function drawStations(night, t) {
  const f = spotOf('fire'), fl = lvl(world, 'fire'), lit = heat > 0, r = (20 + Math.min(fl, 30) * .6) * U * (.25 + heat / 100);
  if (lit) glow(f.x, f.y - r / 2, r * 3, (.2 + night * .35) * (.3 + heat / 100));
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (.05 + i * .225);
    sprite('rock', f.x + Math.cos(a) * 15 * U, f.y + 3 * U - Math.sin(a) * 2 * U, 9 * U);
  }
  sprite('wood', f.x - 5 * U, f.y + 4 * U, 15 * U, false, -1.25);
  sprite('wood', f.x + 5 * U, f.y + 4 * U, 15 * U, true, 1.25);
  if (lit) sprite('fire', f.x, f.y, r * (1 + Math.sin(t * 12) * .06), Math.sin(t * 3) > 0, Math.sin(t * 9) * .04);
  if (heat < 25) bubble(f.x - 6 * U, f.y - 40 * U, 'Дров!', t, '#F4900C');
  else if (fl) tag(f.x, f.y - r - 10 * U, `ур. ${fl}`);
  hits.push({id: 'fire', x: f.x, y: f.y - 14 * U, r: 30 * U});

  const k = spotOf('kitchen'), kl = lvl(world, 'kitchen');
  if (!opened(world, 'kitchen')) sprite('rock', k.x, k.y + 4 * U, 22 * U);
  else if (!kl) sign(k.x, k.y, 'Кухня', t);
  else {
    for (let i = -2; i <= 2; i++) sprite('rock', k.x + i * 7 * U, k.y + 3 * U, 8 * U);
    glow(k.x, k.y - 6 * U, 40 * U, .1 + night * .25);
    sprite('fire', k.x, k.y, 16 * U * (1 + Math.sin(t * 11) * .07));
    ctx.strokeStyle = '#662113';
    ctx.lineWidth = 3.5 * U;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const s of [-1, 1]) {
      ctx.moveTo(k.x + s * 22 * U, k.y + 2 * U);
      ctx.lineTo(k.x + s * 22 * U, k.y - 26 * U);
      ctx.lineTo(k.x + s * 26 * U, k.y - 32 * U);
      ctx.moveTo(k.x + s * 22 * U, k.y - 26 * U);
      ctx.lineTo(k.x + s * 18 * U, k.y - 32 * U);
    }
    ctx.moveTo(k.x - 28 * U, k.y - 27 * U);
    ctx.lineTo(k.x + 28 * U, k.y - 27 * U);
    ctx.stroke();
    spriteAt('meat', k.x, k.y - 27 * U, 26 * U, t * 1.5);
    tag(k.x, k.y - 50 * U, `Кухня, ур. ${kl}`);
  }
  if (opened(world, 'kitchen')) hits.push({id: 'kitchen', x: k.x, y: k.y - 22 * U, r: 34 * U});

  const st = spotOf('storage'), fill = Math.min(1, state.meat / cap(world));
  const pile = [[-9, -25], [0, -26], [9, -25], [-5, -32], [5, -32], [0, -39]];
  sprite('basket', st.x, st.y + 4 * U, 40 * U);
  for (let i = 0; i < Math.ceil(fill * pile.length); i++) spriteAt('meat', st.x + pile[i][0] * U, st.y + pile[i][1] * U, 15 * U, (i % 2 ? .4 : -.4) + Math.sin(t * 2 + i) * .05);
  if (fill >= 1) bubble(st.x, st.y - 62 * U, 'Склад полон!', t, '#DD2E44');
  else tag(st.x, st.y - 56 * U, `Склад, ур. ${lvl(world, 'storage')}`);
  hits.push({id: 'storage', x: st.x, y: st.y - 20 * U, r: 30 * U});

  const b = spotOf('bath'), bl = lvl(world, 'bath');
  if (!opened(world, 'bath')) sprite(treeKind(), b.x, b.y + 4 * U, 40 * U);
  else if (!bl) sign(b.x, b.y, 'Баня', t);
  else {
    glow(b.x, b.y - 10 * U, 30 * U, .1 + night * .3);
    sprite('hut', b.x, b.y + 4 * U, 50 * U);
    sprite('hotspring', b.x + 16 * U, b.y - 44 * U - Math.abs(Math.sin(t * 2)) * 3 * U, 18 * U);
    tag(b.x, b.y - 72 * U, `Баня, ур. ${bl}`);
  }
  if (opened(world, 'bath')) hits.push({id: 'bath', x: b.x, y: b.y - 22 * U, r: 34 * U});
}

/** @param {Walker} w */
function drawWalker(w) {
  if (w.wait > 0 && w.xf <= CAVE) return;
  const s = U * (.75 + (w.lane - .76) * 1.6);
  drawPerson(w.xf * W, walkerY(w), s, w.dir, w.step, w.wait <= 0, {color: w.def.color, carry: w.carry, spear: !w.carry, hat: w.def.id});
}

/** @param {Walker} w @returns {number} */
const walkerY = w => H * (.75 + (w.lane - .75) * Math.min(1, (w.xf - CAVE) / .1));

/** @param {number} x @param {number} y @param {number} s @param {number} dir @param {number} step @param {boolean} moving @param {Look} look */
function drawPerson(x, y, s, dir, step, moving, look) {
  const swing = moving ? Math.sin(step) * 4 : 0, bob = moving ? Math.abs(Math.sin(step)) * 1.5 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(41,47,51,.22)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 9 * s, 2.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.scale(dir * s, s);
  ctx.translate(0, -bob);
  const skin = look.skin || '#D4AB88', leg = look.leg || '#AF7E57', hair = look.hair || '#292F33';
  if (look.carry) spriteAt(look.carry === true ? 'meat' : look.carry, -7, look.carry === true ? -27 : -44, look.carry === true ? 17 : 26, look.carry === true ? -.7 : 1.4);
  if (look.long) pill(-9, -38, 7.5, 21, 3.7, hair);
  pill(-5 + swing * .5, -12, 4.5, 12, 2.2, leg);
  pill(.5 - swing * .5, -12, 4.5, 12, 2.2, leg);
  ctx.fillStyle = look.color;
  ctx.beginPath();
  ctx.moveTo(-7, -11);
  ctx.lineTo(-6, -24);
  ctx.quadraticCurveTo(0, -27, 6, -24);
  ctx.lineTo(7, -11);
  ctx.lineTo(3.5, -13);
  ctx.lineTo(0, -10);
  ctx.lineTo(-3.5, -13);
  ctx.closePath();
  ctx.fill();
  if (look.dress) {
    ctx.beginPath();
    ctx.moveTo(-7, -14);
    ctx.lineTo(-9.5, -4);
    ctx.lineTo(9.5, -4);
    ctx.lineTo(7, -14);
    ctx.closePath();
    ctx.fill();
  }
  if (look.bead) {
    ctx.fillStyle = look.bead;
    for (const bx of [-3.5, 0, 3.5]) {
      ctx.beginPath();
      ctx.arc(bx, -22.5 + Math.abs(bx) * .3, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (look.scythe !== undefined) {
    ctx.save();
    ctx.translate(6, -18);
    ctx.rotate(look.scythe);
    pill(-1.2, -24, 2.4, 27, 1.2, '#8A4B38');
    ctx.strokeStyle = '#C9CDD1';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -23);
    ctx.quadraticCurveTo(-9, -27, -16, -19);
    ctx.stroke();
    ctx.restore();
  }
  if (look.spear) {
    ctx.save();
    ctx.translate(6, -18);
    ctx.rotate((look.raise ? -1.6 : -.5) + swing * .05);
    pill(-1.8, -15, 3.6, 16, 1.8, '#662113');
    ctx.fillStyle = '#8A4B38';
    ctx.beginPath();
    ctx.ellipse(0, -16, 3.6, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  pill(4, -21, 4, 9, 2, skin);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(1, -32, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(0, -33, 8.6, Math.PI * .95, Math.PI * 2.02);
  ctx.fill();
  if (look.beard !== false) {
    ctx.beginPath();
    ctx.arc(2.5, -28.5, 5.2, -.1, Math.PI + .2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(4.5, -32.5, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#292F33';
  ctx.beginPath();
  ctx.arc(5, -32.5, .9, 0, Math.PI * 2);
  ctx.fill();
  if (look.band) pill(-7.5, -37, 16, 2.6, 1.3, look.band);
  if (look.hat === 'chief') spriteAt('feather', -4, -45, 14, -.35);
  if (look.hat === 'tracker') pill(-7.5, -37, 16, 2.6, 1.3, '#FFCC4D');
  ctx.restore();
}

/** @param {number} t */
function drawMammoth(t) {
  const m = mammoth, x = m.xf * W, y = m.lane * H, size = 82 * U, bob = Math.abs(Math.sin(m.step)) * 2 * U;
  ctx.fillStyle = 'rgba(41,47,51,.22)';
  ctx.beginPath();
  ctx.ellipse(x, y, 34 * U, 6 * U, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!m.caught) {
    sprite('mammoth', x, y + 4 * U - bob, size, true, Math.sin(m.step) * .04);
    if (!m.fleeing) bubble(x, y - size - 4 * U, 'Тапни!', t, '#F4900C');
    return;
  }
  const out = m.crew.filter(h => h.delay <= 0), carry = m.phase === 'carry';
  const front = out.filter(h => carry || h.yf >= m.lane);
  out.filter(h => !front.includes(h)).forEach(drawHunter);
  if (carry) front.forEach(drawHunter);
  if (carry) ctx.globalAlpha = intoCave(m.xf);
  const cy0 = y + 4 * U - size * .5, cy1 = y - size * .42, cy2 = y - 34 * U - size * .4 + Math.sin(m.step) * 1.5 * U;
  const cy = m.lift > 0 ? cy1 + (cy2 - cy1) * m.lift : cy0 + (cy1 - cy0) * m.fall;
  ctx.save();
  ctx.translate(x, cy);
  ctx.rotate((m.fall + m.lift) * Math.PI / 2);
  ctx.scale(-1, 1);
  if (sprites.mammoth) ctx.drawImage(sprites.mammoth, -size / 2, -size / 2, size, size);
  for (let i = 0; i < Math.min(m.stuck, STUCK.length); i++) {
    const [sx, sy, a] = STUCK[i];
    ctx.save();
    ctx.translate(sx * U, sy * U);
    ctx.rotate(a);
    pill(-1.3 * U, -20 * U, 2.6 * U, 20 * U, 1.3 * U, '#662113');
    ctx.restore();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  for (const s of m.spears) {
    const p = s.t, arc = 30 * U, vx = (s.x1 - s.xf) * W, vy = (s.y1 - s.yf) * H;
    ctx.save();
    ctx.translate(s.xf * W + vx * p, s.yf * H + vy * p - Math.sin(p * Math.PI) * arc);
    ctx.rotate(Math.atan2(vy - Math.cos(p * Math.PI) * Math.PI * arc, vx));
    pill(-16 * U, -1.3 * U, 18 * U, 2.6 * U, 1.3 * U, '#662113');
    ctx.fillStyle = '#8A4B38';
    ctx.beginPath();
    ctx.moveTo(6 * U, 0);
    ctx.lineTo(1 * U, -3 * U);
    ctx.lineTo(1 * U, 3 * U);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  if (!carry) front.forEach(drawHunter);
}

/** @type {{id:string,farm?:boolean,look:Look,at:() => [number, number]}[]} */
const FOLK = [
  {id: 'cave', look: {color: '#8A6B3F', spear: true, band: '#DD2E44', skin: '#C08A5B', leg: '#9E6E44'}, at: () => [CAVE * W + 26 * U, .79 * H]},
  {id: 'fire', look: {color: '#B5533C', hair: '#A7AFB5', skin: '#D4AB88'}, at: () => [spotOf('fire').x + 16 * U, spotOf('fire').y + 20 * U]},
  {id: 'kitchen', look: {color: '#C1694F', carry: true, beard: false, long: true, dress: true, hair: '#5B3A29', bead: '#FFCC4D', skin: '#F1C9A5', leg: '#D9AE88'}, at: () => [spotOf('kitchen').x + 16 * U, spotOf('kitchen').y + 20 * U]},
  {id: 'storage', look: {color: '#A0522D', carry: true, beard: false, hair: '#7A5230', skin: '#9C6A44', leg: '#7D5232'}, at: () => [spotOf('storage').x + 16 * U, spotOf('storage').y + 20 * U]},
  {id: 'bath', look: {color: '#9C7A4A', beard: false, long: true, dress: true, band: '#55ACEE', bead: '#DD2E44', skin: '#C08A5B', leg: '#9E6E44'}, at: () => [spotOf('bath').x + 16 * U, spotOf('bath').y + 20 * U]},
  {id: 'barn', farm: true, look: {color: '#77B255', hair: '#C69A5B', skin: '#F1C9A5', leg: '#D9AE88', band: '#8A4B38'}, at: () => [farmBox().px0 + 18 * U, farmBox().y0 + 40 * U]},
];
/** @type {Record<string, number>} */
const folkBorn = {};
let folkReady = false;

/** @param {number} t @param {boolean} farm @returns {Depth[]} */
function folkDepth(t, farm) {
  /** @type {Depth[]} */
  const out = [];
  FOLK.forEach((f, i) => {
    if (Boolean(f.farm) !== farm) return;
    if (!lvl(world, f.id)) {
      delete folkBorn[f.id];
      return;
    }
    folkBorn[f.id] ??= folkReady ? t : -9;
    const p = Math.min(1, (t - folkBorn[f.id]) / .4), pop = 1 + 2.7 * (p - 1) ** 3 + 1.7 * (p - 1) ** 2;
    if (pop < .05) return;
    const [x, y] = f.at();
    out.push({y, draw: () => drawPerson(x, y - Math.abs(Math.sin(t * 1.6 + i)) * U, U * .78 * pop, Math.sin(t * .25 + i * 2) > 0 ? 1 : -1, 0, false, f.look)});
  });
  if (!farm) folkReady = true;
  return out;
}

/** @param {number} xf @returns {number} */
const intoCave = xf => Math.max(0, Math.min(1, (xf - CAVE + .01) / .05));

/** @param {Hunter} h */
function drawHunter(h) {
  if (mammoth.phase === 'carry') ctx.globalAlpha = intoCave(h.xf);
  if (ctx.globalAlpha <= 0) return void (ctx.globalAlpha = 1);
  drawPerson(h.xf * W, h.yf * H, U * .8, h.dir, h.step, h.moving, {color: h.color, spear: h.throws > 0, raise: mammoth.phase === 'throw'});
  ctx.globalAlpha = 1;
}

/** @param {number} t */
function drawTiger(t) {
  const g = tiger, x = g.xf * W + Math.sin(t * 60) * g.shake * 6 * U, y = g.lane * H, size = 60 * U, bob = Math.abs(Math.sin(g.step)) * 2 * U;
  ctx.fillStyle = 'rgba(41,47,51,.22)';
  ctx.beginPath();
  ctx.ellipse(x, y, 26 * U, 5 * U, 0, 0, Math.PI * 2);
  ctx.fill();
  sprite('tiger', x, y + 6 * U - bob, size, g.fleeing, Math.sin(g.step) * .05);
  if (!g.fleeing) bubble(x, y - size + 4 * U, `Прогони! ${g.hp}`, t, '#DD2E44');
}

/** @param {number} x0 @param {number} x1 @param {number} y0 @param {number} y1 */
function fence(x0, x1, y0, y1) {
  ctx.strokeStyle = '#C1694F';
  ctx.lineWidth = 3 * U;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const k of [.35, .75]) {
    ctx.moveTo(x0, y0 - 14 * U * k);
    ctx.lineTo(x1, y0 - 14 * U * k);
    ctx.moveTo(x0, y1 - 14 * U * k);
    ctx.lineTo(x1, y1 - 14 * U * k);
    ctx.moveTo(x0, y0 - 14 * U * k);
    ctx.lineTo(x0, y1 - 14 * U * k);
    ctx.moveTo(x1, y0 - 14 * U * k);
    ctx.lineTo(x1, y1 - 14 * U * k);
  }
  ctx.stroke();
  const n = Math.max(2, Math.round((x1 - x0) / (22 * U)));
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n;
    pill(x - 2 * U, y0 - 16 * U, 4 * U, 18 * U, 2 * U, '#662113');
    pill(x - 2 * U, y1 - 16 * U, 4 * U, 18 * U, 2 * U, '#662113');
  }
}

const MEADOW = /** @type {[string, number, number, number][]} */ ([
  ['tree', .07, .12, 62], ['tree', .17, .2, 50], ['rock', .3, .22, 22], ['rock', .35, .27, 15], ['tree', .64, .1, 56], ['tree', .74, .18, 70],
  ['rock', .52, .42, 30], ['rock', .59, .47, 19], ['tree', .9, .38, 78], ['tree', .1, .62, 84], ['rock', .26, .66, 26], ['tree', .2, .72, 60],
  ['rock', .78, .76, 32], ['rock', .85, .82, 20], ['tree', .45, .9, 74], ['rock', .62, .95, 22],
]).sort((a, c) => a[2] - c[2]);
const TUFTS = Array.from({length: 46}, (_, i) => [(i * .618 + .1) % 1, (i * .7549 + .05) % 1]);

/** @param {{fx0:number,fx1:number,px0:number,px1:number,y0:number,y1:number}} b @param {number} t */
function drawMeadow(b, t) {
  const top = b.y0 - 6 * U, h = b.y1 - top + 40;
  ctx.strokeStyle = 'rgba(30,60,25,.22)';
  ctx.lineWidth = 1.6 * U;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [xf, yf] of TUFTS) {
    const x = xf * W, y = top + yf * h, k = .7 + yf * .6;
    for (const dx of [-3, 0, 3]) {
      ctx.moveTo(x + dx * U * k, y);
      ctx.lineTo(x + dx * 1.6 * U * k + Math.sin(t * 1.5 + xf * 9) * U, y - 7 * U * k);
    }
  }
  ctx.stroke();
  for (const [kind, xf, yf, size] of MEADOW) {
    const x = xf * W, y = top + yf * h, tree = kind === 'tree', s = (tree ? 62 : size) * U * (.9 + yf * .2);
    ctx.fillStyle = 'rgba(20,30,15,.28)';
    ctx.beginPath();
    ctx.ellipse(x + (tree ? 4 * U : 2 * U), y, s * (tree ? .38 : .45), s * .1, 0, 0, Math.PI * 2);
    ctx.fill();
    sprite(tree ? treeKind() : 'rock', x, y + s * (tree ? .04 : .12), s, xf > .5, tree ? Math.sin(t * .8 + xf * 7) * .015 : 0);
  }
}

/** @param {number} t */
function drawFarm(t) {
  const b = farmBox(), fl = lvl(world, 'field'), bl = lvl(world, 'barn');
  if (!opened(world, 'field')) return drawMeadow(b, t);
  pill(b.fx0, b.y0, b.fx1 - b.fx0, b.y1 - b.y0, 14 * U, '#8A4B38');
  ctx.strokeStyle = 'rgba(102,33,19,.45)';
  ctx.lineWidth = 2 * U;
  ctx.beginPath();
  for (let y = b.y0 + 14 * U; y < b.y1 - 6 * U; y += 14 * U) {
    ctx.moveTo(b.fx0 + 8 * U, y);
    ctx.lineTo(b.fx1 - 8 * U, y);
  }
  ctx.stroke();
  const [gx, gy] = granarySpot(), gl = lvl(world, 'granary');
  if (gl) {
    drawGranary(gx, gy);
    tag(gx, gy - 50 * U, `Амбар, ур. ${gl}`);
  } else if (fl) sign(gx, gy - 4 * U, 'Амбар', t);
  if (!fl) sign((b.fx0 + b.fx1) / 2, (b.y0 + b.y1) / 2 + 20 * U, 'Поле', t);
  else {
    const f = farmer, g = f.grow;
    cropSpots().forEach(([x, y], i) => {
      if (!f.cut[i]) return sprite(g >= .6 ? 'grain' : 'seedling', x, y, (20 + 10 * g) * U, false, Math.sin(t * 2 + i) * .08);
      ctx.strokeStyle = '#C9A55A';
      ctx.lineWidth = 1.6 * U;
      ctx.beginPath();
      for (const sx of [-4, 0, 4]) {
        ctx.moveTo(x + sx * U, y);
        ctx.lineTo(x + (sx + 1) * U, y - 5 * U);
      }
      ctx.stroke();
      const fade = f.phase === 'mow' ? 1 : f.phase === 'stack' ? 1 - Math.min(1, f.stack) : 0;
      if (fade <= 0) return;
      ctx.globalAlpha = fade;
      sprite('grain', x + 8 * U, y + 2 * U, 24 * U, false, 1.45);
      ctx.globalAlpha = 1;
    });
    if (f.phase === 'stack' && f.stack > 0) drawStack(...stackSpot(), Math.min(1, f.stack));
    tag((b.fx0 + b.fx1) / 2, b.y1 - 2 * U, `Пшено ${num(Math.floor(state.grain))} из ${num(grainCap(world))}`);
    const scythe = f.carry ? undefined : f.mowing ? -1.6 + (1 - f.swing / .45) * 2.2 : -.5;
    drawPerson(f.xf * W, f.yf * FH, U * .78, f.dir, f.step, f.moving, {color: '#77B255', skin: '#C08A5B', leg: '#9E6E44', hair: '#7A5230', band: '#E2B84A', scythe, carry: f.carry ? 'grain' : undefined});
  }
  hits.push({id: 'field', x: (b.fx0 + b.fx1) / 2, y: (b.y0 + b.y1) / 2, r: (b.fx1 - b.fx0) / 2});

  pill(b.px0, b.y0, b.px1 - b.px0, b.y1 - b.y0, 14 * U, 'rgba(255,204,77,.28)');
  if (!bl) sign((b.px0 + b.px1) / 2, (b.y0 + b.y1) / 2 + 20 * U, 'Хлев', t);
  else {
    const hx = b.px1 - 26 * U, hy = b.y0 + 34 * U;
    ctx.fillStyle = '#FFCC4D';
    ctx.beginPath();
    ctx.ellipse(hx - 4 * U, hy + 2 * U, 22 * U, 7 * U, 0, 0, Math.PI * 2);
    ctx.fill();
    pill(hx - 26 * U, hy - 26 * U, 4 * U, 28 * U, 2 * U, '#662113');
    pill(hx + 16 * U, hy - 26 * U, 4 * U, 28 * U, 2 * U, '#662113');
    ctx.fillStyle = '#C1694F';
    ctx.beginPath();
    ctx.moveTo(hx - 34 * U, hy - 22 * U);
    ctx.lineTo(hx - 4 * U, hy - 40 * U);
    ctx.lineTo(hx + 26 * U, hy - 22 * U);
    ctx.closePath();
    ctx.fill();
    const sorted = [...critters].sort((a, c) => a.yf - c.yf);
    for (const c of sorted) {
      const x = b.px0 + 16 * U + c.xf * (b.px1 - b.px0 - 32 * U), y = b.y0 + 40 * U + c.yf * (b.y1 - b.y0 - 52 * U);
      const rabbit = c.def.id === 'rabbit', hop = rabbit ? Math.abs(Math.sin(c.step)) * 6 * U : 0;
      ctx.fillStyle = 'rgba(41,47,51,.2)';
      ctx.beginPath();
      ctx.ellipse(x, y, (rabbit ? 8 : 12) * U, 2.5 * U, 0, 0, Math.PI * 2);
      ctx.fill();
      sprite(c.def.id, x, y + 2 * U - hop, (rabbit ? 24 : 34) * U, c.vx > 0, rabbit ? 0 : Math.sin(c.step) * .05);
    }
    if (herd(world) && fedNow < .99) bubble((b.px0 + b.px1) / 2, b.y0 + 18 * U, 'Мало пшена!', t, '#DD2E44');
    else tag(hx - 4 * U, b.y0 - 22 * U, `Хлев, ур. ${bl}`);
  }
  hits.push({id: 'barn', x: (b.px0 + b.px1) / 2, y: (b.y0 + b.y1) / 2, r: (b.px1 - b.px0) / 2});
  fence(b.px0, b.px1, b.y0 + 4 * U, b.y1);
  for (const d of folkDepth(t, true)) d.draw();
}

/** @param {number} t */
function draw(t) {
  hits = [];
  const th = theme(), day = (Math.sin(t / 30) + 1) / 2, tree = treeKind();
  night = 1 - day;
  const sky = ctx.createLinearGradient(0, 0, 0, H * .5);
  sky.addColorStop(0, shade(th.skyTop, day));
  sky.addColorStop(1, shade(th.skyBot, day));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H * .5);
  if (night > .55) {
    ctx.fillStyle = `rgba(255,255,240,${(night - .55) * 2})`;
    for (const [sx, sy, sr] of stars) {
      ctx.beginPath();
      ctx.arc(sx * W, sy * H, sr * (1 + Math.sin(t * 3 + sx * 50) * .3), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  sprite('sun', W * .72, H * (.5 - .38 * day) + 18 * U, 36 * U, false, t * .1);
  sprite('moon', W * .4, H * (.5 - .38 * night) + 14 * U, 28 * U);
  ctx.globalAlpha = .55 + .4 * day;
  for (const [cx, cy, cs] of clouds) sprite('cloud', cx * W, cy * H + 16 * U * cs, 38 * U * cs);
  ctx.globalAlpha = 1;
  ctx.fillStyle = shade(th.mount, day);
  ctx.beginPath();
  ctx.moveTo(0, H * .5);
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, H * (.36 + .05 * Math.sin(x / W * 9) + .03 * Math.sin(x / W * 23 + 1)));
  ctx.lineTo(W, H * .5);
  ctx.fill();
  drawExtra(day, t);
  const ground = ctx.createLinearGradient(0, H * .5, 0, FH);
  ground.addColorStop(0, shade(th.groundTop, day));
  ground.addColorStop(1, shade(th.groundBot, day));
  ctx.fillStyle = ground;
  ctx.fillRect(0, H * .5, W, FH - H * .5);
  ctx.fillStyle = shade(th.path, day);
  ctx.globalAlpha = .45;
  ctx.beginPath();
  ctx.roundRect(CAVE * W, H * .73, W, H * .26, 18 * U);
  ctx.fill();
  ctx.globalAlpha = 1;
  for (let i = 0; i < 5; i++) sprite(tree, W * (.87 + i * .04), H * .61, 34 * U);
  drawCave(night, t);
  drawStations(night, t);
  const depth = [...folkDepth(t, false), ...walkers.map(w => ({y: walkerY(w), draw: () => drawWalker(w)})), ...kidsDepth(t)];
  if (mammoth) depth.push({y: mammoth.lane * H, draw: () => drawMammoth(t)});
  if (tiger) depth.push({y: tiger.lane * H, draw: () => drawTiger(t)});
  for (const d of depth.sort((a, b) => a.y - b.y)) d.draw();
  for (let i = 0; i < 4; i++) sprite(tree, W * (.87 + i * .055), H * (1.04 - (i % 2) * .06), 66 * U);
  drawFarm(t);
  for (const p of particles) {
    const a = Math.max(0, p.life / p.max);
    if (p.kind === 'text') {
      ctx.globalAlpha = Math.min(1, a * 2);
      ctx.font = `800 ${Math.round(p.size * U)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3.5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#3B2A1E';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    } else if (p.kind === 'fly') {
      ctx.globalAlpha = 1;
      spriteAt('meat', p.x, p.y, 16 * U, p.life * 6);
    } else {
      ctx.globalAlpha = p.kind === 'smoke' ? a * .35 : Math.min(1, a * 3);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.kind === 'smoke' ? p.size * (1 + (1 - a) * 2) : p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  if (night > .3) {
    ctx.fillStyle = `rgba(10,15,40,${(night - .3) * .35})`;
    ctx.fillRect(0, 0, W, FH);
  }
}

/** @type {Row[]} */
const rows = [];

/** @param {Def} def @param {number} n @returns {string} */
function statLine(def, n) {
  const show = v => def.pct ? `+${pct(v)}%` : num(v);
  const now = STAT[def.id](world);
  if (n < 1) return `${show(now)} ${def.unit}`;
  const was = state.levels[def.id] || 0;
  state.levels[def.id] = was + n;
  const next = STAT[def.id](world);
  state.levels[def.id] = was;
  return `${show(now)} → ${show(next)} ${def.unit}`;
}

/** @param {Def} def @returns {string} */
function promoteLine(def) {
  const src = ALL.find(d => d.id === def.from), was = lvl(world, src.id);
  if (!was) return `нужен ${src.name.toLowerCase()}`;
  const now = STAT[src.id](world), own = lvl(world, def.id);
  state.levels[src.id] = was - 1;
  state.levels[def.id] = own + 1;
  const loss = now - STAT[src.id](world);
  state.levels[src.id] = was;
  state.levels[def.id] = own;
  return `−1 ${src.name.toLowerCase()}, −${num(loss)} ${src.unit}`;
}

/** @param {Def} def */
function dismiss(def) {
  if (!release(world, def)) return;
  beep(300, .06, 'sine');
  renderList();
}

/** @param {Def[]} defs @param {HTMLElement} box */
function build(defs, box) {
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
const techRows = TECHS.map(tech => {
  const el = document.createElement('div');
  el.className = 'item';
  el.innerHTML = `<div class="ico"><img src="${icon(tech.icon)}" alt=""></div><div class="info"><b class="full">${tech.name}</b><small class="full">${tech.desc}</small><small class="need full"></small></div><button class="buy"></button>`;
  const btn = el.querySelector('button');
  btn.onclick = () => buyTech(tech);
  $('techs').append(el);
  return {tech, el, btn, need: /** @type {HTMLElement} */ (el.querySelector('.need'))};
});
const stageBtn = document.createElement('button');
stageBtn.className = 'buy wide pulse';
$('quests').append(stageBtn);

/** @param {HTMLElement} el @param {string} text */
function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

function renderQuests() {
  const finished = state.stage >= stageCount(world), qs = quests(world);
  setText($('valley'), valleyName(state.valley));
  setText($('stageNo'), finished ? 'все вехи пройдены' : `веха ${state.stage + 1} из ${stageCount(world)}`);
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
  setText(stageBtn, finished ? `Переселиться: ${valleyName(state.valley + 1)}` : 'Забрать награду за веху');
}

function renderList() {
  syncWalkers();
  syncCritters();
  renderQuests();
  setText($('herd'), `${herd(world)} из ${pens(world)}`);
  const hungry = herd(world) > 0 && grainRate(world) < grainNeed(world), spill = lvl(world, 'field') > 0 && harvestSize(world) > grainCap(world);
  const wait = Math.max(0, Math.ceil(HARVEST - state.harvest)), clock = `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, '0')}`;
  $('farmNote').classList.toggle('warn', hungry || spill);
  setText($('farmText'), hungry ? `Скотине не хватает пшена: растёт ${num(grainRate(world))} в минуту, а съедают ${num(grainNeed(world))}. Расширь поле!` : spill ? `Амбар вмещает ${num(grainCap(world))} пшена, а урожай ${num(harvestSize(world))}: лишнее пропадает. Расширь амбар!` : lvl(world, 'field') || herd(world) ? `Амбар: ${num(Math.floor(state.grain))} из ${num(grainCap(world))} · урожай +${num(harvestSize(world))} через ${clock} · едят ${num(grainNeed(world))}/мин` : 'Распаши поле и построй хлев: кролики и козы едят пшено и дают мясо');
  $('music').classList.toggle('off', !state.music);
  setText($('meat'), num(Math.floor(state.meat)));
  setText($('cap'), `из ${num(cap(world))}`);
  $('counter').classList.toggle('full', state.meat >= cap(world));
  if (recover(world)) {
    banner('Племя оправилось от страха', '1fa79');
  }
  setText($('rate'), `${num(perSec(world))}/с`);
  $('counter').classList.toggle('scared', isScared(world));
  $('heatBar').style.width = `${heat}%`;
  setText($('techCount'), `${state.techs.length} из ${TECHS.length}`);
  $('allTechs').hidden = state.techs.length < TECHS.length;
  $('doneHead').hidden = !state.techs.length;
  for (const r of techRows) {
    const open = unlocked(world, r.tech), owned = has(world, r.tech.id), box = owned ? $('techsDone') : $('techs');
    if (r.el.parentElement !== box) box.append(r.el);
    r.el.classList.toggle('owned', owned);
    r.el.classList.toggle('locked', !open && !owned);
    r.need.hidden = owned;
    r.need.classList.toggle('miss', !open);
    setText(r.need, needText(r.tech));
    setText(r.btn, num(r.tech.cost));
    r.btn.disabled = !open || state.meat < r.tech.cost;
  }
  setText($('staff'), `${staff(world)} из ${seats(world)}`);
  setText($('huntText'), `Охотиться +${num(perTap(world))}`);
  const muteSrc = icon(state.muted ? '1f507' : '1f50a');
  if ($('muteIcon').getAttribute('src') !== muteSrc) $('muteIcon').setAttribute('src', muteSrc);
  setText($('buzz'), state.noBuzz ? 'Включить вибрацию' : 'Выключить вибрацию');
  for (const r of rows) {
    const n = amount(world, r.def), c = costOf(world, r.def, Math.max(n, 1)), l = lvl(world, r.def.id);
    setText(r.level, l ? (r.def.trip || r.def.feed ? `×${l}` + (hurt(world, r.def.id) ? `, ранены ${hurt(world, r.def.id)}` : '') : `ур. ${l}`) : '');
    setText(r.info, statLine(r.def, 1));
    if (r.def.from) setText(r.eat, promoteLine(r.def));
    else if (r.eat) r.eat.classList.toggle('warn', fedNow < .99);
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
    r.btn.disabled = n < 1 || state.meat < c;
  }
  for (const r of rows) r.el.hidden = !opened(world, r.def.id);
  const dots = {quests: !stageBtn.hidden, techs: opened(world, 'techs') && techRows.some(r => !has(world, r.tech.id) && unlocked(world, r.tech) && state.meat >= r.tech.cost)};
  for (const r of rows) dots[secOf(r.def)] ||= !r.el.hidden && !r.btn.disabled;
  for (const el of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#nav button'))) {
    el.classList.toggle('dot', Boolean(dots[el.dataset.sec]));
    el.hidden = (el.dataset.sec === 'techs' && !opened(world, 'techs')) || (el.dataset.sec === 'farm' && !opened(world, 'field'));
  }
  renderExtras();
  renderTutorial();
}

/** @param {number} since */
function welcomeBack(since) {
  const {away, want, earned} = offline(world, since);
  overflow(earned, up(want));
  if (away < 20 || earned < 1) return;
  modal(earned < want ? 'Пока тебя не было, племя добыло столько, сколько влезло в склад' : 'Пока тебя не было, племя добыло', `${num(earned)} мяса`, 'Забрать', () => {
    fly(W / 2, H / 2, 25);
    tune([523, 659, 784], 80);
    bump();
  });
}

/** @typedef {{text:string,done?:() => boolean,at?:() => {x:number,y:number}|null,button?:string,story?:boolean,icon?:string,title?:string}} Step */

/** @param {Element|null} el @returns {{x:number,y:number}|null} */
function pointAt(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect(), a = $('app').getBoundingClientRect();
  return r.width ? {x: (r.left - a.left + r.width / 2) / uiScale, y: (r.top - a.top + r.height / 2) / uiScale} : null;
}

/** @param {number} x @param {number} y @returns {{x:number,y:number}} */
function scenePoint(x, y) {
  const r = canvas.getBoundingClientRect(), a = $('app').getBoundingClientRect();
  return {x: (r.left - a.left + x) / uiScale, y: (r.top - a.top + y) / uiScale};
}

/** @param {string} sec @returns {Element|null} */
const navBtn = sec => document.querySelector(`#nav button[data-sec="${sec}"]`);

/** @param {string} sec @param {string} id @returns {() => {x:number,y:number}|null} */
const via = (sec, id) => () => {
  if (openSec !== sec) return pointAt(navBtn(sec));
  const btn = rows.find(r => r.def.id === id).btn, box = $('sheetBody').getBoundingClientRect(), r = btn.getBoundingClientRect();
  if (r.top < box.top || r.bottom > box.bottom) btn.scrollIntoView({block: 'nearest'});
  return pointAt(btn);
};

/** @param {{xf:number,lane:number,fleeing:boolean}|null} beast @param {number} lift @returns {{x:number,y:number}|null} */
const beastAt = (beast, lift) => beast && !beast.fleeing ? scenePoint(beast.xf * W, beast.lane * H - lift * U) : null;

/** @param {string} icon @param {string} title @param {string} text @param {string} button @returns {Step} */
const story = (icon, title, text, button) => ({story: true, icon, title, text, button});
/** @param {string} id @returns {() => boolean} */
const built = id => () => lvl(world, id) >= 1;
const firePoint = () => scenePoint(spotOf('fire').x, spotOf('fire').y - 14 * U);

/** @type {Step[][]} */
const LESSONS = [
  [
    story('1f5ff', 'Добро пожаловать в Пещерный магнат!', 'Давным-давно, когда мир был молод, а мамонты огромны, маленькое племя нашло пустую пещеру на краю леса. Холодные ночи, голодные дети и ни куска мяса в запасе...', 'Дальше'),
    story('1f356', 'Ты - новый вождь', 'Племя выбрало тебя. Добудь мяса, обустрой пещеру, расширь племя и проведи его через ледники, вулканы и далёкие берега.', 'Дальше'),
    story('1f9d9', 'Я - Старейшина', 'Я видел много зим и буду рядом. Слушай мои советы, и племя никогда не будет голодать. Начнём с охоты!', 'В путь!'),
    {text: 'Тапай по поляне: так племя охотится, и каждый тап приносит мясо. Добудь 150 мяса.', done: () => state.earned >= 150, at: () => scenePoint(W * .55, H * .86)},
    {text: 'Видишь костёр? Огонь согревает охотников: чем жарче, тем больше мяса, до +30%. Но он остывает, особенно ночью. Тапай по огню, чтобы подкинуть дров.', done: () => heat >= 30, at: firePoint},
    {text: 'Открой «Двор» и улучши костёр: с каждым уровнем один тап приносит больше мяса.', done: built('fire'), at: via('yard', 'fire')},
    {text: 'Вечно тапать тяжело. В «Племени» найми охотника: он сам ходит в лес и носит мясо, даже когда тебя нет в игре.', done: built('hunter'), at: via('tribe', 'hunter')},
    {text: 'Каждому рабочему нужно место в пещере, а сейчас их всего два. Улучшай пещеру во «Дворе»: каждый уровень даёт место ещё одному рабочему.', done: built('cave'), at: via('yard', 'cave')},
    {text: 'Всё мясо хранится на складе. Видишь наверху «из 2,5 тыс.»? Больше не влезет, и лишнее мясо пропадёт! Улучшай склад, чтобы хранить больше. Нужно 500 мяса.', done: built('storage'), at: via('yard', 'storage')},
    {text: `Полоска под строкой - путь к прибавке: каждые ${MILESTONE} уровней постройка или отряд начинают давать на ${pct(MILESTONE_BOOST - 1)}% больше.`, button: 'Ясно'},
    {text: 'Загляни в «Задания». За каждую веху дают награду мясом, а за достижения - ракушки.', done: () => openSec === 'quests', at: () => pointAt(navBtn('quests'))},
    {text: 'Пройди 4 вехи, и племя двинется в новые земли. Там нас ждёт новое, а мудрость предков навсегда прибавит к добыче 17%.', button: 'Вперёд!'},
  ],
  [
    story('1f3d4', 'Ледник', 'Племя шло много дней и пришло к ледяным горам. Ветер режет как нож, но предки знали секреты тепла: горячая еда и жаркая баня.', 'Дальше'),
    {text: 'Мудрость предков уже работает: вся добыча навсегда стала больше. А пещера и склад начинаются заново, так что не забывай их улучшать.', button: 'Понятно'},
    {text: 'В пути племя нашло ракушки. Это особые деньги: в лавке шамана на них покупают бустеры. Загляни в лавку, она наверху у ракушки.', done: () => openSec === 'shop', at: () => pointAt($('shells'))},
    {text: 'Построй кухню во «Дворе». Жареное мясо сытнее: каждый уровень кухни прибавляет около 3% к добыче охотников, следопытов и вождей.', done: built('kitchen'), at: via('yard', 'kitchen')},
    {text: 'Теперь баня. Отогретые охотники бегают быстрее и приносят мясо чаще: почти +2% скорости за уровень.', done: built('bath'), at: via('yard', 'bath')},
    {text: 'В снегах живут следопыты: ходят дольше, но приносят в 12 раз больше охотника. Следопытом становится охотник: найми следопыта в «Племени», и один охотник получит повышение.', done: built('tracker'), at: via('tribe', 'tracker')},
  ],
  [
    story('1f30b', 'Вулкан', 'Земля под ногами тёплая и дымится. По долинам бродят мамонты: огромные, медленные и очень вкусные.', 'Дальше'),
    {text: 'Мамонт скоро выйдет на поляну. Тапни по нему: один мамонт даёт столько мяса, сколько племя добывает за 5 секунд, и ещё сверху.', done: () => state.mammoths >= 1, at: () => beastAt(mammoth, 45)},
    {text: 'Самые смелые следопыты становятся вождями. Вождь приносит больше всех и встаёт на место следопыта, но стоит 20 тыс. мяса: сначала улучши склад, чтобы столько влезло.', button: 'Понятно'},
    {text: 'Найми вождя охоты в «Племени».', done: built('chief'), at: via('tribe', 'chief')},
  ],
  [
    story('1f30a', 'Побережье', 'Шум волн, тёплый песок, рыба в лужах... Но ночью в зарослях загораются жёлтые глаза. Здесь охотится саблезубый тигр.', 'Дальше'),
    {text: 'Тигр приходит ночью, когда костёр почти погас. Доберётся до пещеры - утащит 80% мяса и покалечит половину рабочих на 30 минут.', button: 'Ой'},
    {text: 'Защита простая: держи огонь жарким. При жаре выше 60% тигр испугается и убежит. А если пришёл, тапни по нему трижды.', button: 'Понятно'},
    {text: 'Потренируйся: разожги костёр до 60%.', done: () => state.peakHeat >= 60, at: () => beastAt(tiger, 30) ?? firePoint()},
    {text: 'Если беда всё же случилась, «Оберег шамана» в лавке вылечит раненых, снимет страх и отгонит тигра на 2 часа.', button: 'Понятно'},
  ],
  [
    story('1f3a8', 'Снова в родной долине', 'Племя вернулось в родные края мудрее, чем ушло. У костра всё чаще говорят о новом: острые камни, ловушки, барабаны...', 'Дальше'),
    {text: 'Открытия - это разовые изобретения. Каждое усиливает племя до следующего переселения: удваивает добычу, ускоряет бег и многое другое.', button: 'Понятно'},
    {text: 'Открой «Открытия» и сделай первое. Если строка серая, в ней написано, что для неё нужно.', done: () => state.techs.length >= 1, at: () => openSec !== 'techs' ? pointAt(navBtn('techs')) : pointAt(techRows.find(r => !r.el.hidden && !r.btn.disabled)?.btn ?? null)},
  ],
  [
    story('1f33e', 'Снова Ледник', 'Охотиться приходится всё дальше. И старейшина предлагает невиданное: растить пшено и держать зверей прямо у пещеры.', 'Дальше'),
    {text: 'Внизу появилась ферма. Распаши поле: оно растит пшено, корм для скотины.', done: built('field'), at: via('farm', 'field')},
    {text: 'Построй хлев: каждый уровень даёт место ещё двум зверям.', done: built('barn'), at: via('farm', 'barn')},
    {text: 'Заведи кроликов. Они едят пшено и каждые две секунды приносят мясо.', done: built('rabbit'), at: via('farm', 'rabbit')},
    {text: 'Урожай пшена собирается раз в 5 минут и ложится в амбар. Если корма не хватает, скотина даёт меньше мяса: расширяй поле вместе со стадом, а амбар вместе с полем. Потом заведи коз: едят больше, но и мяса дают куда больше.', button: 'Понятно'},
    story('1f3c6', 'Ты знаешь всё', 'Я научил тебя всему, что знал сам. Дальше веди племя сам, вождь. Пусть костёр горит жарко, а мамонты ходят рядом!', 'Вперёд!'),
  ],
];

/** @returns {Step[]} */
const lesson = () => state.noTut ? [] : LESSONS[state.valley] || [];

let tutShown = -1;
function renderTutorial() {
  const step = lesson()[state.tut];
  if (step?.done?.()) {
    state.tut++;
    tune([659, 784], 90);
    return renderTutorial();
  }
  const isStory = Boolean(step?.story), blocked = $('modal').classList.contains('show');
  $('story').hidden = !isStory || blocked;
  $('coach').hidden = !step || isStory;
  const p = step && !isStory ? step.at?.() ?? null : null;
  $('finger').hidden = $('ring').hidden = !p || blocked;
  if (!step) return;
  if (tutShown !== state.tut) {
    tutShown = state.tut;
    if (isStory) {
      /** @type {HTMLImageElement} */ ($('storyIcon')).src = icon(step.icon);
      setText($('storyTitle'), step.title);
      setText($('storyText'), step.text);
      setText($('storyNext'), step.button);
    } else {
      setText($('coachText'), step.text);
      $('coachOk').hidden = !step.button;
      setText($('coachOk'), step.button || '');
    }
  }
  if (p) {
    $('finger').style.left = `${p.x - 14}px`;
    $('finger').style.top = `${p.y + 6}px`;
    $('ring').style.left = `${p.x}px`;
    $('ring').style.top = `${p.y}px`;
  }
}

/** @type {Record<string, () => void>} */
const BOOST_USE = {
  fill: () => {
    fly(W / 2, H / 2, 20);
  },
  ward: () => {
    if (tiger && !tiger.fleeing) scare('Шаман прогнал тигра!');
  },
  lure: () => {
    tiger = {xf: 1.1, lane: .82, hp: 3, fleeing: false, step: 0, shake: 0};
  },
  call: () => {
    mammoth = {xf: -.15, lane: .86, fleeing: false, step: 0};
  },
};

/** @param {Boost} b */
function buyBoost(b) {
  if (!purchaseBoost(world, b)) return;
  BOOST_USE[b.id]?.();
  banner(`${b.name}!`, b.icon);
  tune([523, 784, 1047], 80);
  renderList();
}

function gift() {
  if (!blessGift(world)) return;
  banner(`Шаман благословляет: +${BLESS_GIFT}`, '1f9d9');
  saveNow();
}

const starShop = createStars(world, {
  gift,
  item: it => {
    banner(it.shells ? `+${it.shells} ракушек!` : `${it.name}!`, it.icon);
    tune([523, 784, 1047], 80);
  },
  fail: down => banner(down ? 'Шаман не отвечает, попробуй позже' : 'Оплата не прошла', '2b50'),
  saveNow,
  refresh: renderList,
});

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

/** @param {number} ms @returns {string} */
const clock = ms => {
  const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

function renderExtras() {
  const done = claimAch(world);
  if (done) {
    banner(`Достижение: ${done.ach.names[done.tier]}! +${done.reward}`, '1f3c5');
    tune([784, 988, 1175], 90);
  }
  setText($('shellCount'), String(state.shells));
  setText($('shopText'), `У тебя ${plural(state.shells, ['ракушка', 'ракушки', 'ракушек'])}. Новые даёт каждое переселение и достижения.`);
  const now = Date.now();
  for (const r of boostRows) {
    r.el.hidden = Boolean(r.b.need) && !opened(world, r.b.need);
    const owned = Boolean(r.b.once) && perkOn(world, r.b.id);
    r.el.classList.toggle('owned', owned);
    setText(r.left, owned ? 'есть' : boostOn(world, r.b.id) ? `ещё ${clock(state.boosts[r.b.id] - now)}` : '');
    r.btn.disabled = owned || state.shells < r.b.price;
  }
  $('starShop').hidden = !shopStars;
  for (const r of starRows) {
    const owned = r.it.id === 'keeper' ? perkOn(world, 'keeper') : r.it.id === 'bless' && blessed(world);
    r.el.classList.toggle('owned', owned);
    setText(r.left, r.it.id === 'bless' && owned ? `до ${dayMonth.format(state.blessUntil)}` : owned ? 'есть' : '');
    r.btn.disabled = owned || starShop.paying;
  }
  /** @type {[string, string, string][]} */
  const fx = [];
  if (isScared(world)) fx.push(['1f631', `−80% ${clock(state.scaredUntil - now)}`, ' class="warn"']);
  if (heat >= 1) fx.push(['1f525', `+${pct(heat * .003)}%`, '']);
  if (state.valley) fx.push(['1f5ff', `+${pct(legacy(world) - 1)}%`, '']);
  if (blessed(world)) fx.push(['1f9d9', `+${pct(BLESS_BOOST - 1)}%`, '']);
  for (const b of BOOSTS) if (boostOn(world, b.id)) fx.push([b.icon, clock(state.boosts[b.id] - now), '']);
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

build(STATIONS, $('stations'));
build(WORKERS, $('workers'));
build(FARM, $('farm'));
syncWalkers();
openSheet('');
heat = cooled(world, state.heat, Date.now() - state.savedAt);
if (!serverSaves) welcomeBack(state.savedAt);

canvas.addEventListener('pointerdown', e => {
  const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (tiger && !tiger.fleeing && Math.hypot(x - tiger.xf * W, y - (tiger.lane * H - 20 * U)) < 45 * U) return hitTiger();
  if (mammoth && !mammoth.fleeing && Math.hypot(x - mammoth.xf * W, y - (mammoth.lane * H - 35 * U)) < 55 * U) return catchMammoth();
  const hit = hits.find(h => Math.hypot(x - h.x, y - h.y) < h.r);
  if (hit?.id === 'fire') return stoke();
  hunt(x, y);
});
$('hunt').onclick = () => hunt(W * (.4 + Math.random() * .3), H * (.8 + Math.random() * .1));
$('mute').onclick = () => {
  state.muted = !state.muted;
  renderList();
};
$('music').onclick = () => {
  state.music = !state.music;
  renderList();
};
for (const el of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#nav button'))) {
  el.onclick = () => {
    openSheet(openSec === el.dataset.sec ? '' : el.dataset.sec);
    beep(520, .04, 'sine');
  };
}
$('close').onclick = () => openSheet('');
$('shells').onclick = () => openSheet(openSec === 'shop' ? '' : 'shop');
$('storyNext').onclick = () => $('coachOk').click();
$('coachOk').onclick = () => {
  state.tut++;
  if (!lesson()[state.tut]) banner('Удачи, вождь!', '1f5ff');
  renderList();
};
$('coachSkip').onclick = () => {
  state.tut = TUT_DONE;
  state.noTut = true;
  renderList();
};
$('buzz').hidden = !tgAt('6.1') && !('vibrate' in navigator);
$('buzz').onclick = () => {
  state.noBuzz = !state.noBuzz;
  buzz(15);
  renderList();
};
$('tutAgain').onclick = () => {
  state.noTut = false;
  state.tut = 0;
  tutShown = -1;
  openSheet('');
  renderList();
};
stageBtn.onclick = () => state.stage >= stageCount(world) ? askMigrate() : claimStage();
$('mOk').onclick = () => {
  $('modal').classList.remove('show');
  onModal?.();
};
$('mNo').onclick = () => $('modal').classList.remove('show');
$('reset').onclick = () => modal('Начать с самой первой долины? Пропадёт всё, включая мудрость предков.', 'Начать заново?', 'Да, заново', () => {
  state = restarted(world, starShop.paidKeeper);
  walkers = [];
  critters = [];
  particles = [];
  mammoth = null;
  tiger = null;
  heat = 0;
  saveNow();
  renderList();
}, true, '26a0');

let lastFrame = performance.now();
/** @param {number} now */
function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, .1);
  lastFrame = now;
  update(dt);
  draw(now / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setInterval(renderList, 100);
setInterval(() => document.hidden || save(), 5000);
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    sound.resume();
    if (hiddenAt) heat = cooled(world, heat, Date.now() - hiddenAt);
    tigerIn = Math.max(tigerIn, 20);
    if (tiger && !tiger.fleeing) tiger.xf = Math.max(tiger.xf, .95);
    gift();
    if (serverSaves) return void pullServer();
    pullCloud();
    return welcomeBack(state.savedAt);
  }
  hiddenAt = Date.now();
  sound.suspend();
  saveNow();
});
addEventListener('pagehide', saveNow);
if (tgAt('8.0')) {
  tg.onEvent('deactivated', saveNow);
  tg.onEvent('activated', pull);
}
pull();
starShop.sync();
renderList();
