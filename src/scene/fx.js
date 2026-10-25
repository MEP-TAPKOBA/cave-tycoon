import {tune} from '../game.js';
import {ctx, FH, FONT, spriteAt, U, W} from './view.js';
import {banner} from '../ui/dom.js';

/** @typedef {{kind:'dot'|'smoke'|'fly'|'text',x:number,y:number,vx:number,vy:number,life:number,max:number,size:number,color:string,grav?:number,text?:string,delay?:number,speed?:number}} Particle */

const TARGET = {x: 30, y: 30};
const CONFETTI = ['#FFCC4D', '#F4900C', '#77B255', '#55ACEE', '#DD2E44', '#AA8DD8'];

/** @type {Particle[]} */
export let particles = [];

/** @param {number} x @param {number} y @param {string} text @param {string} color @param {number} [size] */
export function floater(x, y, text, color, size = 16) {
  particles.push({kind: 'text', x, y, vx: 0, vy: -40, life: 1.1, max: 1.1, size, color, text});
}

/** @param {number} x @param {number} y @param {number} n @param {string} color */
export function burst(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 160;
    particles.push({kind: 'dot', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, grav: 400, life: .7, max: .7, size: (2 + Math.random() * 2) * U, color});
  }
}

/** @param {number} x @param {number} y @param {number} n */
export function fly(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 120;
    particles.push({kind: 'fly', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 3, max: 3, size: 4 * U, color: '#b5532a', delay: .25, speed: 200});
  }
}

/** @param {string} text */
export function celebrate(text) {
  banner(text);
  for (let i = 0; i < 70; i++) {
    particles.push({kind: 'dot', x: Math.random() * W, y: -10, vx: (Math.random() - .5) * 80, vy: 40 + Math.random() * 120, grav: 120, life: 2.5, max: 2.5, size: (2 + Math.random() * 3) * U, color: CONFETTI[i % CONFETTI.length]});
  }
  tune([523, 659, 784, 1047], 90);
}

/** @param {number} dt */
export function fxTick(dt) {
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

export function drawFx() {
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
}
