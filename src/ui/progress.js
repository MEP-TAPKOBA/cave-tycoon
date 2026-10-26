import {num, pct, plural} from '../format.js';
import {CHAPTERS, FEATURE_AT} from '../data/chapters.js';
import {advanceStage, migrated, restarted, shellReward} from '../core/economy.js';
import {gain, tune, valleyName, world} from '../game.js';
import {H, W} from '../scene/view.js';
import {celebrate, fly} from '../scene/fx.js';
import {resetScene} from '../scene/scene.js';
import {$, bump, modal, openSheet, screen} from './dom.js';
import {resetTutorial} from './tutorial.js';
import {saveNow, starShop} from './session.js';

export function claimStage() {
  const want = advanceStage(world);
  if (want === null) return;
  const reward = gain(want);
  saveNow();
  fly(W / 2, H / 2, 20);
  celebrate(`Веха пройдена! +${num(reward)} мяса`);
  bump();
  screen.render();
}

export function askMigrate() {
  const next = CHAPTERS[world.state.valley + 1];
  modal(`Племя уходит в новые земли: ${valleyName(world.state.valley + 1)}. Мясо, постройки, рабочие и открытия останутся здесь, зато мудрость предков навсегда прибавит к добыче 17%, а в пути племя найдёт ${plural(shellReward(world), ['ракушку', 'ракушки', 'ракушек'])}.` + (next ? ` Там племя освоит новое: ${next.title.toLowerCase()}.` : ''), `Добыча +${pct((7 / 6) ** (world.state.valley + 1) - 1)}%`, 'Переселиться', migrate, true, '1f5fa');
}

function migrate() {
  $('fade').classList.add('show');
  tune([330, 294, 262], 150);
  setTimeout(() => {
    world.state = migrated(world);
    resetScene(world.state.valley === FEATURE_AT.mammoth ? 8 : 25);
    resetTutorial();
    saveNow();
    openSheet('');
    screen.render();
    $('fade').classList.remove('show');
    const chapter = CHAPTERS[world.state.valley];
    celebrate(chapter ? `Новое: ${chapter.title}` : `Новые земли: ${valleyName(world.state.valley)}`);
  }, 900);
}

export function askRestart() {
  modal('Начать с самой первой долины? Пропадёт всё, включая мудрость предков.', 'Начать заново?', 'Да, заново', () => {
    world.state = restarted(world, starShop.paidKeeper);
    resetScene();
    saveNow();
    screen.render();
  }, true, '26a0');
}
