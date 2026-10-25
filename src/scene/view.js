import {VALLEYS} from '../data/valleys.js';
import {icon, world} from '../game.js';
import {$} from '../ui/dom.js';

/** @typedef {import('../data/valleys.js').Valley} Valley */
/** @typedef {import('../data/valleys.js').Shade} Shade */

const MAX_FRAME = 900;
export const CAVE = .12;
export const FOREST = .94;

export const FONT = "'Rubik', system-ui, sans-serif";

export const canvas = /** @type {HTMLCanvasElement} */ ($('canvas'));
export const ctx = canvas.getContext('2d');
export let W = 0, H = 0, FH = 0, U = 1;
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
export let uiScale = 1;
function fit() {
  uiScale = desktop.matches ? Math.min(innerHeight, MAX_FRAME) / BASE_H : innerWidth / BASE_W;
  document.documentElement.style.setProperty('--k', String(uiScale));
  resize();
}
new ResizeObserver(resize).observe(canvas);
addEventListener('resize', fit);
fit();

/** @type {{id:string,x:number,y:number,r:number}[]} */
export const hits = [];

/** @returns {Valley} */
export const theme = () => VALLEYS[world.state.valley % VALLEYS.length];
/** @returns {string} */
export const treeKind = () => theme().extra === 'sea' ? 'palm' : 'pine';

/** @returns {{fx0:number,fx1:number,px0:number,px1:number,y0:number,y1:number}} */
export function farmBox() {
  return {fx0: W * .05, fx1: W * .46, px0: W * .52, px1: W * .95, y0: H + 26 * U, y1: Math.max(H + 90 * U, FH - 74)};
}

/** @param {string} id @returns {{x:number,y:number}} */
export function spotOf(id) {
  const p = {fire: [.1, .86], kitchen: [.43, .63], storage: [.585, .6], bath: [.73, .58]}[id] || [CAVE, .72];
  return {x: p[0] * W, y: p[1] * H};
}

/** @param {string} a @param {string} b @param {number} k @returns {string} */
export function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** @param {Shade} s @param {number} day @returns {string} */
export const shade = (s, day) => mix(s[0], s[1], day);

const SPRITES = {mammoth: '1f9a3', tiger: '1f405', meat: '1f356', fire: '1f525', hut: '1f6d6', rock: '1faa8', wood: '1fab5', pine: '1f332', palm: '1f334', volcano: '1f30b', basket: '1f9fa', skull: '1f480', hotspring: '2668', cloud: '2601', sun: '2600', moon: '1f319', feather: '1fab6', grain: '1f33e', rabbit: '1f407', goat: '1f410', seedling: '1f331'};
/** @type {Record<string, HTMLCanvasElement>} */
export const sprites = {};
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
export function sprite(name, x, y, size, flip = false, rot = 0) {
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
export function spriteAt(name, x, y, size, rot = 0) {
  const c = sprites[name];
  if (!c) return;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(c, -size / 2, -size / 2, size, size);
  ctx.restore();
}

/** @param {number} x @param {number} y @param {number} r @param {number} a */
export function glow(x, y, r, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,172,51,${a})`);
  g.addColorStop(1, 'rgba(255,172,51,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** @param {number} x @param {number} y @param {number} w @param {number} h @param {number} r @param {string} color */
export function pill(x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** @param {number} x @param {number} y @param {string} text */
export function tag(x, y, text) {
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
export function bubble(x, y, text, t, color) {
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
export function sign(x, y, label, t) {
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
