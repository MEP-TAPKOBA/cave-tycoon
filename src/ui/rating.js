import {plural} from '../format.js';
import {rankScore} from '../core/quests.js';
import {ask} from '../platform/telegram.js';
import {world} from '../game.js';
import {$, openSec, openSheet, setText} from './dom.js';
import {saveNow} from './session.js';

/** @typedef {{name:string,photo:string,score:number,me:boolean}} Leader */
/** @typedef {{top:Leader[],place:number,score:number,hidden:boolean}} Board */

const COLORS = ['#C1694F', '#77B255', '#55ACEE', '#AA8DD8', '#F4900C', '#DD2E44'];
const RULES = '1 очко за веху, 2 за переселение';

/** @param {number} n @returns {string} */
const points = n => plural(n, ['очко', 'очка', 'очков']);

/** @param {string} name @returns {string} */
const colorOf = name => COLORS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % COLORS.length];

/** @param {Leader} p @param {number} place @returns {HTMLElement} */
function row(p, place) {
  const el = document.createElement('div');
  el.className = 'place' + (p.me ? ' me' : '');
  const pos = document.createElement('b'), who = document.createElement('span'), pts = document.createElement('b');
  pos.className = 'pos';
  pos.textContent = String(place);
  who.className = 'who';
  who.textContent = p.name;
  pts.className = 'pts';
  pts.textContent = String(p.score);
  /** @type {HTMLElement} */
  let ava;
  if (p.photo) {
    const img = document.createElement('img');
    img.src = p.photo;
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    ava = img;
  } else {
    ava = document.createElement('span');
    ava.textContent = [...p.name][0]?.toUpperCase() || '?';
    ava.style.background = colorOf(p.name);
  }
  ava.classList.add('ava');
  el.append(pos, ava, who, pts);
  return el;
}

function hideText() {
  setText($('hideRank'), world.state.noRank ? 'Показывать меня в рейтинге' : 'Скрывать меня в рейтинге');
}

/** @param {Board} board */
function render(board) {
  const box = $('ranks'), mine = board.top.find(p => p.me);
  const score = rankScore(world.state);
  setText($('rankText'), world.state.noRank ? `Ты скрыт из рейтинга. ${RULES}.` : `${RULES}. У тебя ${points(score)}` + (board.place ? `, место ${board.place}.` : '.'));
  box.replaceChildren(...board.top.map((p, i) => row(p, i + 1)));
  if (!mine && board.place && !world.state.noRank) {
    const gap = document.createElement('div');
    gap.className = 'gap';
    gap.textContent = '...';
    box.append(gap, row({name: 'Ты', photo: '', score: board.score, me: true}, board.place));
  }
  if (!board.top.length) {
    const empty = document.createElement('div');
    empty.className = 'gap';
    empty.textContent = 'Пока здесь никого. Стань первым вождём!';
    box.append(empty);
  }
  hideText();
}

export async function loadRating() {
  hideText();
  setText($('rankText'), `${RULES}. Шаман пересчитывает племена...`);
  try { render(await ask('/top')); } catch { setText($('rankText'), 'Шаман не отвечает, попробуй позже.'); }
}

export function toggleRating() {
  openSheet(openSec === 'rank' ? '' : 'rank');
  if (openSec === 'rank') loadRating();
}

export function toggleHidden() {
  world.state.noRank = !world.state.noRank;
  hideText();
  saveNow();
  setTimeout(loadRating, 1500);
}
