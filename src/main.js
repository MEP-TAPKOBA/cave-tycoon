import {FARM, STATIONS, WORKERS} from './data/units.js';
import {cooled} from './core/economy.js';
import {stageCount} from './core/quests.js';
import {TUT_DONE} from './core/state.js';
import {serverSaves, tg, tgAt} from './platform/telegram.js';
import {beep, buzz, sound, world} from './game.js';
import {canvas, H, W} from './scene/view.js';
import {syncWalkers} from './scene/people.js';
import {beastsBack} from './scene/beasts.js';
import {draw, hunt, tap, update} from './scene/scene.js';
import {$, banner, openSec, openSheet, screen} from './ui/dom.js';
import {build, renderLists, stageBtn} from './ui/lists.js';
import {lesson, renderTutorial, resetTutorial} from './ui/tutorial.js';
import {gift, pull, pullCloud, pullServer, save, saveNow, starShop, welcomeBack} from './ui/session.js';
import {askMigrate, askRestart, claimStage} from './ui/progress.js';
import {renderExtras} from './ui/shop.js';
import {toggleHidden, toggleRating} from './ui/rating.js';

function renderList() {
  renderLists();
  renderExtras();
  renderTutorial();
}
screen.render = renderList;

build(STATIONS, $('stations'));
build(WORKERS, $('workers'));
build(FARM, $('farm'));
syncWalkers();
openSheet('');
world.heat = cooled(world, world.state.heat, Date.now() - world.state.savedAt);
if (!serverSaves) welcomeBack(world.state.savedAt);

canvas.addEventListener('pointerdown', e => {
  const r = canvas.getBoundingClientRect();
  tap(e.clientX - r.left, e.clientY - r.top);
});
$('hunt').onclick = () => hunt(W * (.4 + Math.random() * .3), H * (.8 + Math.random() * .1));
$('mute').onclick = () => {
  world.state.muted = !world.state.muted;
  renderList();
};
$('music').onclick = () => {
  world.state.music = !world.state.music;
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
$('rank').hidden = !serverSaves;
$('hud').classList.toggle('ranked', serverSaves);
$('rank').onclick = toggleRating;
$('hideRank').onclick = toggleHidden;
$('storyNext').onclick = () => $('coachOk').click();
$('coachOk').onclick = () => {
  world.state.tut++;
  if (!lesson()[world.state.tut]) banner('Удачи, вождь!', '1f5ff');
  renderList();
};
$('coachSkip').onclick = () => {
  world.state.tut = TUT_DONE;
  world.state.noTut = true;
  renderList();
};
$('buzz').hidden = !tgAt('6.1') && !('vibrate' in navigator);
$('buzz').onclick = () => {
  world.state.noBuzz = !world.state.noBuzz;
  buzz(15);
  renderList();
};
$('tutAgain').onclick = () => {
  world.state.noTut = false;
  world.state.tut = 0;
  resetTutorial();
  openSheet('');
  renderList();
};
stageBtn.onclick = () => world.state.stage >= stageCount(world) ? askMigrate() : claimStage();
$('reset').onclick = askRestart;

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
    if (hiddenAt) world.heat = cooled(world, world.heat, Date.now() - hiddenAt);
    beastsBack();
    gift();
    if (serverSaves) return void pullServer();
    pullCloud();
    return welcomeBack(world.state.savedAt);
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
