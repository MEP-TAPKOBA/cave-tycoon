import {num} from '../format.js';
import {boostOn, cap, lvl, opened, perkOn, perTap} from '../core/formulas.js';
import {doused, heatTick, stokeHeat, tapped} from '../core/economy.js';
import {beep, buzz, gain, sizzle, world} from '../game.js';
import {bubble, CAVE, ctx, FH, glow, H, hits, mix, pill, shade, sign, spotOf, sprite, spriteAt, tag, theme, treeKind, U, W} from './view.js';
import {burst, drawFx, floater, fly, fxTick, particles} from './fx.js';
import {drawWalker, folkDepth, keeperDepth, keeperTick, kidsDepth, kidsTick, moveWalker, walkers, walkerY} from './people.js';
import {critters, drawFarm, farmTick} from './farm.js';
import {catchMammoth, drawMammoth, drawTiger, hitTiger, mammoth, mammothTick, resetBeasts, tiger, tigerTick} from './beasts.js';
import {banner, bump} from '../ui/dom.js';

const POUR_AFTER = .6;
let smokeT = 0, steamT = 0, weatherT = 0, pressT = -1, pouring = false, dropT = 0;

const stars = Array.from({length: 40}, () => [Math.random(), Math.random() * .4, Math.random() * 1.4 + .4]);
const clouds = [[.1, .1, 1], [.5, .2, .7], [.8, .07, 1.2], [1.15, .26, .9]];

/** @param {number} x @param {number} y */
export function hunt(x, y) {
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

function stoke() {
  world.heat = stokeHeat(world);
  const f = spotOf('fire');
  burst(f.x, f.y - 20 * U, 8, '#ffa424');
  floater(f.x, f.y - 55 * U, `Жар ${Math.round(world.heat)}%`, '#ffa424', 13);
  beep(90 + Math.random() * 40, .06, 'sawtooth', .04);
  buzz(5);
}

function startPour() {
  const f = spotOf('fire');
  if (world.heat <= 0) return void (pressT = -1);
  if (boostOn(world, 'feast')) {
    pressT = -1;
    return floater(f.x, f.y - 55 * U, 'Праздник: огонь не потушить', '#9fd3ff', 13);
  }
  pouring = true;
  if (perkOn(world, 'keeper') && !world.state.keeperOff) banner('Хранитель огня уснул', '1fab5');
  sizzle(.5);
  buzz(10);
}

/** @param {number} dt */
function pourTick(dt) {
  if (pressT < 0) return;
  pressT += dt;
  if (!pouring && pressT >= POUR_AFTER) startPour();
  if (!pouring) return;
  const f = spotOf('fire');
  world.heat = doused(world, dt);
  dropT -= dt;
  if (dropT < 0) {
    dropT = .05;
    particles.push({kind: 'dot', x: f.x + (Math.random() - .5) * 10 * U, y: f.y - 8 * U, vx: (Math.random() - .5) * 120, vy: -60 - Math.random() * 80, grav: 500, life: .5, max: .5, size: (1.5 + Math.random()) * U, color: '#9fd3ff'});
    particles.push({kind: 'smoke', x: f.x + (Math.random() - .5) * 16 * U, y: f.y - 14 * U, vx: (Math.random() - .5) * 14, vy: -30 * U, life: 1.6, max: 1.6, size: 5 * U, color: '#ffffff'});
  }
  if (world.heat > 0) return;
  release();
  for (let i = 0; i < 10; i++) particles.push({kind: 'smoke', x: f.x + (Math.random() - .5) * 30 * U, y: f.y - 10 * U, vx: (Math.random() - .5) * 30, vy: -(20 + Math.random() * 20) * U, life: 2.4, max: 2.4, size: 7 * U, color: '#ffffff'});
  floater(f.x, f.y - 55 * U, 'Костёр потушен', '#9fd3ff', 14);
  sizzle(1.4);
  buzz(20);
}

export function release() {
  pressT = -1;
  pouring = false;
}

/** @param {number} t */
function drawPour(t) {
  const f = spotOf('fire'), x0 = f.x + 10 * U, y0 = f.y - 92 * U, y1 = f.y - 6 * U;
  ctx.strokeStyle = 'rgba(93,173,236,.75)';
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = y0 + (y1 - y0) * i / 6, b = y0 + (y1 - y0) * (i + 1) / 6;
    ctx.lineWidth = (5 - i * .5) * U;
    ctx.beginPath();
    ctx.moveTo(x0 - (x0 - f.x) * i / 6 + Math.sin(t * 30 + i) * U, a);
    ctx.lineTo(x0 - (x0 - f.x) * (i + 1) / 6 + Math.sin(t * 30 + i + 1) * U, b);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(x0 + 8 * U, y0 - 6 * U);
  ctx.rotate(-2.21 + Math.sin(t * 6) * .04);
  ctx.fillStyle = '#A0522D';
  ctx.beginPath();
  ctx.moveTo(-9 * U, -10 * U);
  ctx.lineTo(9 * U, -10 * U);
  ctx.lineTo(7 * U, 10 * U);
  ctx.lineTo(-7 * U, 10 * U);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#662113';
  ctx.lineWidth = 2 * U;
  ctx.beginPath();
  ctx.moveTo(-8.5 * U, -4 * U);
  ctx.lineTo(8.5 * U, -4 * U);
  ctx.moveTo(-7.5 * U, 5 * U);
  ctx.lineTo(7.5 * U, 5 * U);
  ctx.stroke();
  ctx.fillStyle = '#5DADEC';
  ctx.beginPath();
  ctx.ellipse(0, -10 * U, 9 * U, 3 * U, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** @param {number} dt */
export function update(dt) {
  walkers.forEach(w => moveWalker(w, dt));
  farmTick(dt);
  kidsTick(dt);
  keeperTick(dt);
  for (const c of clouds) {
    c[0] += .01 * dt;
    if (c[0] > 1.25) c[0] = -.25;
  }
  mammothTick(dt);
  world.heat = heatTick(world, dt, world.night);
  pourTick(dt);
  tigerTick(dt);
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
  fxTick(dt);
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

/** @param {number} t */
function drawCave(t) {
  const day = 1 - world.night, th = theme();
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
      glow(tx, ty - 6 * U, 30 * U, .15 + world.night * .3);
      sprite('fire', tx, ty + 2 * U, 15 * U * (1 + Math.sin(t * 10 + s) * .08));
    }
  }
  tag(cx, cy - ch - 26 * U, l ? `Пещера, ур. ${l}` : 'Пещера');
  hits.push({id: 'cave', x: cx, y: cy - ch * .5, r: cw * 1.3});
}

/** @param {number} t */
function drawStations(t) {
  const f = spotOf('fire'), fl = lvl(world, 'fire'), lit = world.heat > 0, r = (20 + Math.min(fl, 30) * .6) * U * (.25 + world.heat / 100);
  if (lit) glow(f.x, f.y - r / 2, r * 3, (.2 + world.night * .35) * (.3 + world.heat / 100));
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (.05 + i * .225);
    sprite('rock', f.x + Math.cos(a) * 15 * U, f.y + 3 * U - Math.sin(a) * 2 * U, 9 * U);
  }
  sprite('wood', f.x - 5 * U, f.y + 4 * U, 15 * U, false, -1.25);
  sprite('wood', f.x + 5 * U, f.y + 4 * U, 15 * U, true, 1.25);
  if (lit) sprite('fire', f.x, f.y, r * (1 + Math.sin(t * 12) * .06), Math.sin(t * 3) > 0, Math.sin(t * 9) * .04);
  if (world.heat < 25) bubble(f.x - 6 * U, f.y - 40 * U, 'Дров!', t, '#F4900C');
  else if (fl) tag(f.x, f.y - r - 10 * U, `ур. ${fl}`);
  hits.push({id: 'fire', x: f.x, y: f.y - 14 * U, r: 30 * U});
  if (pouring) drawPour(t);

  const k = spotOf('kitchen'), kl = lvl(world, 'kitchen');
  if (!opened(world, 'kitchen')) sprite('rock', k.x, k.y + 4 * U, 22 * U);
  else if (!kl) sign(k.x, k.y, 'Кухня', t);
  else {
    for (let i = -2; i <= 2; i++) sprite('rock', k.x + i * 7 * U, k.y + 3 * U, 8 * U);
    glow(k.x, k.y - 6 * U, 40 * U, .1 + world.night * .25);
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

  const st = spotOf('storage'), fill = Math.min(1, world.state.meat / cap(world));
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
    glow(b.x, b.y - 10 * U, 30 * U, .1 + world.night * .3);
    sprite('hut', b.x, b.y + 4 * U, 50 * U);
    sprite('hotspring', b.x + 16 * U, b.y - 44 * U - Math.abs(Math.sin(t * 2)) * 3 * U, 18 * U);
    tag(b.x, b.y - 72 * U, `Баня, ур. ${bl}`);
  }
  if (opened(world, 'bath')) hits.push({id: 'bath', x: b.x, y: b.y - 22 * U, r: 34 * U});
}

/** @param {number} t */
export function draw(t) {
  hits.length = 0;
  const th = theme(), day = (Math.sin(t / 30) + 1) / 2, tree = treeKind();
  world.night = 1 - day;
  const sky = ctx.createLinearGradient(0, 0, 0, H * .5);
  sky.addColorStop(0, shade(th.skyTop, day));
  sky.addColorStop(1, shade(th.skyBot, day));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H * .5);
  if (world.night > .55) {
    ctx.fillStyle = `rgba(255,255,240,${(world.night - .55) * 2})`;
    for (const [sx, sy, sr] of stars) {
      ctx.beginPath();
      ctx.arc(sx * W, sy * H, sr * (1 + Math.sin(t * 3 + sx * 50) * .3), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  sprite('sun', W * .72, H * (.5 - .38 * day) + 18 * U, 36 * U, false, t * .1);
  sprite('moon', W * .4, H * (.5 - .38 * world.night) + 14 * U, 28 * U);
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
  drawCave(t);
  drawStations(t);
  const depth = [...folkDepth(t, false), ...walkers.map(w => ({y: walkerY(w), draw: () => drawWalker(w)})), ...kidsDepth(t), ...keeperDepth()];
  if (mammoth) depth.push({y: mammoth.lane * H, draw: () => drawMammoth(t)});
  if (tiger) depth.push({y: tiger.lane * H, draw: () => drawTiger(t)});
  for (const d of depth.sort((a, b) => a.y - b.y)) d.draw();
  for (let i = 0; i < 4; i++) sprite(tree, W * (.87 + i * .055), H * (1.04 - (i % 2) * .06), 66 * U);
  drawFarm(t);
  drawFx();
  if (world.night > .3) {
    ctx.fillStyle = `rgba(10,15,40,${(world.night - .3) * .35})`;
    ctx.fillRect(0, 0, W, FH);
  }
}

/** @param {number} x @param {number} y */
export function tap(x, y) {
  if (tiger && !tiger.fleeing && Math.hypot(x - tiger.xf * W, y - (tiger.lane * H - 20 * U)) < 45 * U) return hitTiger();
  if (mammoth && !mammoth.fleeing && Math.hypot(x - mammoth.xf * W, y - (mammoth.lane * H - 35 * U)) < 55 * U) return catchMammoth();
  const hit = hits.find(h => Math.hypot(x - h.x, y - h.y) < h.r);
  if (hit?.id === 'fire') {
    pressT = 0;
    return stoke();
  }
  hunt(x, y);
}

/** @param {number} [mammothDelay] */
export function resetScene(mammothDelay) {
  walkers.length = 0;
  critters.length = 0;
  particles.length = 0;
  resetBeasts(mammothDelay);
  release();
  world.heat = 0;
}
