import {num} from '../format.js';
import {boostOn, has, isScared, opened} from '../core/formulas.js';
import {caughtMammoth, mammothMeat, raid, tigerScared} from '../core/economy.js';
import {beep, buzz, gain, morse, roar, trumpet, tune, world} from '../game.js';
import {bubble, CAVE, ctx, H, pill, sprite, sprites, U, W} from './view.js';
import {burst, floater, fly} from './fx.js';
import {drawPerson} from './people.js';
import {banner, bump, screen} from '../ui/dom.js';

/** @typedef {{xf:number,yf:number,tx:number,ty:number,dx:number,delay:number,step:number,dir:number,throws:number,cool:number,color:string,moving:boolean}} Hunter */
/** @typedef {{xf:number,yf:number,x1:number,y1:number,t:number}} Spear */

/** @typedef {{xf:number,lane:number,fleeing:boolean,step:number,caught?:boolean,phase?:string,fall?:number,lift?:number,stuck?:number,crew?:Hunter[],spears?:Spear[]}} Mammoth */

/** @type {[number, number][]} */
const CREW = [[-.17, -.03], [-.13, .05], [.15, -.03], [.19, .05], [.01, .08]];
const CREW_COLORS = ['#A0522D', '#8A6B3F', '#B5533C', '#C1694F', '#9C7A4A'];
const MAMMOTH_BUZZ = [80, 1000, 80, 1000, 80, 1000, 80];
const TIGER_BUZZ = [100, 150, 450, 150, 100, 150, 450, 150, 100, 150, 450];
/** @type {[number, number, number][]} */
const STUCK = [[-14, -16, -.6], [4, -22, .2], [16, -12, .7], [-4, -8, -.3], [10, -4, .5], [-18, -2, -.8], [0, -18, 0], [20, -20, .9], [-10, -24, -.4], [8, -10, .3]];

/** @type {Mammoth|null} */
export let mammoth = null;
let mammothIn = 25;
/** @type {{xf:number,lane:number,hp:number,fleeing:boolean,step:number,shake:number}|null} */
export let tiger = null;
let tigerIn = 15;

export function catchMammoth() {
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

function mammothComes() {
  mammoth = {xf: -.15, lane: .86, fleeing: false, step: 0};
  trumpet();
  morse(MAMMOTH_BUZZ);
}

function tigerComes() {
  tiger = {xf: 1.1, lane: .82, hp: 3, fleeing: false, step: 0, shake: 0};
  roar();
  morse(TIGER_BUZZ);
}

/** @param {string} text */
function scare(text) {
  tiger.fleeing = true;
  tigerScared(world);
  floater(tiger.xf * W, tiger.lane * H - 50 * U, text, '#ffd08a', 16);
  burst(tiger.xf * W, tiger.lane * H - 20 * U, 20, '#ffa424');
  tune([440, 587], 90);
}

export function hitTiger() {
  tiger.hp--;
  tiger.shake = .25;
  burst(tiger.xf * W, tiger.lane * H - 20 * U, 10, '#e0832a');
  beep(110, .1, 'sawtooth', .08);
  buzz(15);
  if (tiger.hp <= 0) scare('Тигр прогнан!');
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
export function mammothTick(dt) {
  if (!mammoth) {
    mammothIn -= dt;
    if (mammothIn <= 0 && opened(world, 'mammoth') && Date.now() >= world.state.mammothRest) mammothComes();
  } else if (mammoth.caught) huntTick(dt);
  else {
    mammoth.xf += (mammoth.fleeing ? .45 : .07) * dt;
    mammoth.step += dt * (mammoth.fleeing ? 14 : 8);
    if (mammoth.xf > 1.2) {
      mammoth = null;
      mammothIn = nextMammoth();
    }
  }
}

/** @param {number} dt */
export function tigerTick(dt) {
  if (!tiger) {
    if (!document.hidden && world.night > .6 && world.heat < 25 && world.state.earned > 10000 && opened(world, 'tiger') && !boostOn(world, 'ward')) {
      tigerIn -= dt * (isScared(world) ? .5 : 1);
      if (tigerIn <= 0) tigerComes();
    }
  } else if (!document.hidden) {
    tiger.shake = Math.max(0, tiger.shake - dt);
    if (!tiger.fleeing && world.heat >= 60) scare('Огонь отпугнул тигра!');
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
      screen.render();
    }
    if (tiger.xf > 1.25) {
      tiger = null;
      tigerIn = 20 + Math.random() * 30;
    }
  }
}

/** @param {number} t */
export function drawMammoth(t) {
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
export function drawTiger(t) {
  const g = tiger, x = g.xf * W + Math.sin(t * 60) * g.shake * 6 * U, y = g.lane * H, size = 60 * U, bob = Math.abs(Math.sin(g.step)) * 2 * U;
  ctx.fillStyle = 'rgba(41,47,51,.22)';
  ctx.beginPath();
  ctx.ellipse(x, y, 26 * U, 5 * U, 0, 0, Math.PI * 2);
  ctx.fill();
  sprite('tiger', x, y + 6 * U - bob, size, g.fleeing, Math.sin(g.step) * .05);
  if (!g.fleeing) bubble(x, y - size + 4 * U, `Прогони! ${g.hp}`, t, '#DD2E44');
}

/** @type {Record<string, () => void>} */
export const BOOST_USE = {
  fill: () => {
    fly(W / 2, H / 2, 20);
  },
  ward: () => {
    if (tiger && !tiger.fleeing) scare('Шаман прогнал тигра!');
  },
  lure: tigerComes,
  call: mammothComes,
};

/** @param {number} [mammothDelay] */
export function resetBeasts(mammothDelay) {
  mammoth = null;
  tiger = null;
  if (mammothDelay !== undefined) mammothIn = mammothDelay;
}

export function beastsBack() {
  tigerIn = Math.max(tigerIn, 20);
  if (tiger && !tiger.fleeing) tiger.xf = Math.max(tiger.xf, .95);
}
