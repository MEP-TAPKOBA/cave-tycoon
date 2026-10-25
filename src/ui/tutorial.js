import {MILESTONE, MILESTONE_BOOST} from '../config.js';
import {pct} from '../format.js';
import {lvl} from '../core/formulas.js';
import {icon, tune, world} from '../game.js';
import {canvas, H, spotOf, U, uiScale, W} from '../scene/view.js';
import {mammoth, tiger} from '../scene/beasts.js';
import {$, openSec, setText} from './dom.js';
import {rows, techRows} from './lists.js';

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
    {text: 'Тапай по поляне: так племя охотится, и каждый тап приносит мясо. Добудь 150 мяса.', done: () => world.state.earned >= 150, at: () => scenePoint(W * .55, H * .86)},
    {text: 'Видишь костёр? Огонь согревает охотников: чем жарче, тем больше мяса, до +30%. Но он остывает, особенно ночью. Тапай по огню, чтобы подкинуть дров.', done: () => world.heat >= 30, at: firePoint},
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
    {text: 'Мамонт скоро выйдет на поляну. Тапни по нему: один мамонт даёт столько мяса, сколько племя добывает за 5 секунд, и ещё сверху.', done: () => world.state.mammoths >= 1, at: () => beastAt(mammoth, 45)},
    {text: 'Самые смелые следопыты становятся вождями. Вождь приносит больше всех и встаёт на место следопыта, но стоит 20 тыс. мяса: сначала улучши склад, чтобы столько влезло.', button: 'Понятно'},
    {text: 'Найми вождя охоты в «Племени».', done: built('chief'), at: via('tribe', 'chief')},
  ],
  [
    story('1f30a', 'Побережье', 'Шум волн, тёплый песок, рыба в лужах... Но ночью в зарослях загораются жёлтые глаза. Здесь охотится саблезубый тигр.', 'Дальше'),
    {text: 'Тигр приходит ночью, когда костёр почти погас. Доберётся до пещеры - утащит 80% мяса и покалечит половину рабочих на 30 минут.', button: 'Ой'},
    {text: 'Защита простая: держи огонь жарким. При жаре выше 60% тигр испугается и убежит. А если пришёл, тапни по нему трижды.', button: 'Понятно'},
    {text: 'Потренируйся: разожги костёр до 60%.', done: () => world.state.peakHeat >= 60, at: () => beastAt(tiger, 30) ?? firePoint()},
    {text: 'Если беда всё же случилась, «Оберег шамана» в лавке вылечит раненых, снимет страх и отгонит тигра на 2 часа.', button: 'Понятно'},
  ],
  [
    story('1f3a8', 'Снова в родной долине', 'Племя вернулось в родные края мудрее, чем ушло. У костра всё чаще говорят о новом: острые камни, ловушки, барабаны...', 'Дальше'),
    {text: 'Открытия - это разовые изобретения. Каждое усиливает племя до следующего переселения: удваивает добычу, ускоряет бег и многое другое.', button: 'Понятно'},
    {text: 'Открой «Открытия» и сделай первое. Если строка серая, в ней написано, что для неё нужно.', done: () => world.state.techs.length >= 1, at: () => openSec !== 'techs' ? pointAt(navBtn('techs')) : pointAt(techRows.find(r => !r.el.hidden && !r.btn.disabled)?.btn ?? null)},
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
export const lesson = () => world.state.noTut ? [] : LESSONS[world.state.valley] || [];

let tutShown = -1;
export function renderTutorial() {
  const step = lesson()[world.state.tut];
  if (step?.done?.()) {
    world.state.tut++;
    tune([659, 784], 90);
    return renderTutorial();
  }
  const isStory = Boolean(step?.story), blocked = $('modal').classList.contains('show');
  $('story').hidden = !isStory || blocked;
  $('coach').hidden = !step || isStory;
  const p = step && !isStory ? step.at?.() ?? null : null;
  $('finger').hidden = $('ring').hidden = !p || blocked;
  if (!step) return;
  if (tutShown !== world.state.tut) {
    tutShown = world.state.tut;
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

export function resetTutorial() {
  tutShown = -1;
}
