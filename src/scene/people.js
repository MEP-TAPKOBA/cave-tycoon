import {num, up} from '../format.js';
import {WORKERS} from '../data/units.js';
import {hurt, lvl, perkOn, rateOf, speed} from '../core/formulas.js';
import {beep, gain, world} from '../game.js';
import {CAVE, ctx, farmBox, FOREST, H, pill, spotOf, spriteAt, U, W} from './view.js';
import {burst, floater} from './fx.js';
import {bump} from '../ui/dom.js';

/** @typedef {import('../data/units.js').Def} Def */

/** @typedef {{def:Def,xf:number,lane:number,dir:number,wait:number,carry:boolean,step:number}} Walker */
/** @typedef {{color:string,carry?:boolean|string,spear?:boolean,raise?:boolean,hat?:string,skin?:string,leg?:string,hair?:string,beard?:boolean,long?:boolean,dress?:boolean,bead?:string,band?:string,scythe?:number}} Look */

/** @typedef {{xf:number,yf:number,tx:number,ty:number,dir:number,step:number,moving:boolean,wait:number,inside:boolean,look:Look}} Kid */

/** @typedef {{y:number,draw:() => void}} Depth */

const MAX_WALKERS = 8;

/** @type {Walker[]} */
export let walkers = [];

/** @type {Kid[]} */
const kids = [
  {xf: .4, yf: .82, tx: .4, ty: .82, dir: 1, step: 0, moving: false, wait: 1, inside: false, look: {color: '#E2B84A', beard: false, hair: '#5B3A29', skin: '#F1C9A5', leg: '#D9AE88'}},
  {xf: .6, yf: .88, tx: .6, ty: .88, dir: -1, step: 0, moving: false, wait: 2, inside: false, look: {color: '#77B255', beard: false, long: true, hair: '#292F33', bead: '#55ACEE', skin: '#C08A5B', leg: '#9E6E44'}},
];

/** @param {number} dt */
export function kidsTick(dt) {
  const dark = world.night > .55;
  for (const k of kids) {
    if (k.inside) {
      if (world.night > .45) continue;
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
export function kidsDepth(t) {
  return kids.filter(k => !k.inside).map(k => {
    const i = kids.indexOf(k), hop = k.moving ? 0 : Math.max(0, Math.sin(t * 5 + i * 2)) * 3 * U;
    return {y: k.yf * H, draw: () => drawPerson(k.xf * W, k.yf * H - hop, U * .55, k.dir, k.step, k.moving, k.look)};
  });
}

export function syncWalkers() {
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
export function moveWalker(w, dt) {
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

/** @param {Walker} w */
export function drawWalker(w) {
  if (w.wait > 0 && w.xf <= CAVE) return;
  const s = U * (.75 + (w.lane - .76) * 1.6);
  drawPerson(w.xf * W, walkerY(w), s, w.dir, w.step, w.wait <= 0, {color: w.def.color, carry: w.carry, spear: !w.carry, hat: w.def.id});
}

/** @param {Walker} w @returns {number} */
export const walkerY = w => H * (.75 + (w.lane - .75) * Math.min(1, (w.xf - CAVE) / .1));

/** @param {number} x @param {number} y @param {number} s @param {number} dir @param {number} step @param {boolean} moving @param {Look} look */
export function drawPerson(x, y, s, dir, step, moving, look) {
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
export function folkDepth(t, farm) {
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

/** @type {Look} */
const KEEPER = {color: '#7B2D26', dress: true, hair: '#E1E8ED', skin: '#C08A5B', leg: '#9E6E44', bead: '#FFCC4D', band: '#FFCC4D', hat: 'chief'};
const TOSS = 2.4;
const HOLD = 1.4;
const FLIGHT = .5;
let keeperT = 0, dozeT = 0;

/** @returns {boolean} */
const keeperAwake = () => !world.state.keeperOff && world.night < .5;
/** @returns {[number, number]} */
const keeperSpot = () => [spotOf('fire').x - 16 * U, spotOf('fire').y + 22 * U];

/** @param {number} dt */
export function keeperTick(dt) {
  if (!perkOn(world, 'keeper')) return;
  const [x, y] = keeperSpot();
  if (!keeperAwake()) {
    keeperT = 0;
    if ((dozeT -= dt) <= 0) {
      dozeT = 1.6;
      floater(x - 4 * U, y - 46 * U, 'z', '#DDE6FF', 11);
    }
    return;
  }
  const was = keeperT;
  keeperT = (keeperT + dt) % TOSS;
  if (was < HOLD + FLIGHT && keeperT >= HOLD + FLIGHT) {
    const f = spotOf('fire');
    burst(f.x, f.y - 12 * U, 10, '#ffa424');
  }
}

/** @returns {Depth[]} */
export function keeperDepth() {
  if (!perkOn(world, 'keeper')) return [];
  const [x, y] = keeperSpot(), s = U * .9;
  if (!keeperAwake()) return [{y, draw: () => drawPerson(x, y, s, -1, 0, false, {...KEEPER, spear: true})}];
  const p = (keeperT - HOLD) / FLIGHT, flying = p >= 0 && p < 1, hop = flying ? Math.sin(p * Math.PI) * 3 * U : 0;
  return [{y, draw: () => {
    drawPerson(x, y - hop, s, 1, 0, false, keeperT < HOLD ? {...KEEPER, carry: 'wood'} : KEEPER);
    if (!flying) return;
    const f = spotOf('fire'), x0 = x - 7 * s, y0 = y - 44 * s, x1 = f.x, y1 = f.y - 8 * U;
    spriteAt('wood', x0 + (x1 - x0) * p, y0 + (y1 - y0) * p - Math.sin(p * Math.PI) * 30 * U, 24 * s, 1.4 + p * 8);
  }}];
}
