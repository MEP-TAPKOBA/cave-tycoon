import {num, up} from '../format.js';
import {ANIMALS} from '../data/units.js';
import {animalRate, grainCap, herd, lvl, opened} from '../core/formulas.js';
import {farmStep} from '../core/economy.js';
import {gain, world} from '../game.js';
import {bubble, ctx, farmBox, FH, hits, pill, sign, sprite, tag, treeKind, U, W} from './view.js';
import {burst, floater} from './fx.js';
import {drawPerson, folkDepth} from './people.js';

/** @typedef {import('../data/units.js').Def} Def */

/** @typedef {{def:Def,xf:number,yf:number,vx:number,step:number}} Critter */

/** @typedef {{phase:string,i:number,xf:number,yf:number,dir:number,step:number,moving:boolean,swing:number,mowing:boolean,cut:boolean[],grow:number,stack:number,carry:boolean,placed:boolean}} Farmer */

/** @type {Critter[]} */
export let critters = [];
let farmAcc = 0, farmT = 0;

/** @type {Farmer} */
const farmer = {phase: 'mow', i: 0, xf: 0, yf: 0, dir: 1, step: 0, moving: false, swing: 0, mowing: false, cut: [], grow: 1, stack: 0, carry: false, placed: false};

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

export function syncCritters() {
  for (const def of ANIMALS) {
    const want = Math.min(lvl(world, def.id), 6);
    const mine = critters.filter(c => c.def === def);
    for (let i = mine.length; i < want; i++) critters.push({def, xf: Math.random(), yf: .3 + Math.random() * .7, vx: (Math.random() - .5) * .2, step: Math.random() * 6});
    if (mine.length > want) critters = critters.filter(c => c.def !== def).concat(mine.slice(0, want));
  }
}

/** @param {number} dt */
export function farmTick(dt) {
  const {harvested, fed} = farmStep(world, dt), fb = farmBox();
  if (harvested > 0) floater((fb.fx0 + fb.fx1) / 2, fb.y0 + 10 * U, `+${num(harvested)} пшена`, '#FFCC4D', 14);
  world.fed = fed;
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
export function drawFarm(t) {
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
    tag((b.fx0 + b.fx1) / 2, b.y1 - 2 * U, `Пшено ${num(Math.floor(world.state.grain))} из ${num(grainCap(world))}`);
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
    if (herd(world) && world.fed < .99) bubble((b.px0 + b.px1) / 2, b.y0 + 18 * U, 'Мало пшена!', t, '#DD2E44');
    else tag(hx - 4 * U, b.y0 - 22 * U, `Хлев, ур. ${bl}`);
  }
  hits.push({id: 'barn', x: (b.px0 + b.px1) / 2, y: (b.y0 + b.y1) / 2, r: (b.px1 - b.px0) / 2});
  fence(b.px0, b.px1, b.y0 + 4 * U, b.y1);
  for (const d of folkDepth(t, true)) d.draw();
}
