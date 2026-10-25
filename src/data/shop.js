import {BLESS_BOOST, BLESS_GIFT, KEEPER_HEAT} from '../config.js';
import {pct} from '../format.js';

/** @typedef {{id:string,name:string,icon:string,desc:string,price:number,mins?:number,need?:string,once?:boolean}} Boost */
/** @type {Boost[]} */
export const BOOSTS = [
  {id: 'keeper', name: 'Хранитель огня', icon: '1fab5', desc: `навсегда: днём жар не ниже ${KEEPER_HEAT}%`, price: 50, once: true},
  {id: 'hunt', name: 'Великая охота', icon: '1f3f9', desc: 'вся добыча x2 на 30 минут', price: 12, mins: 30},
  {id: 'feast', name: 'Праздник у костра', icon: '1f525', desc: 'тап x5, а огонь не гаснет 10 минут', price: 6, mins: 10},
  {id: 'speed', name: 'Быстрые ноги', icon: '1f463', desc: 'племя бегает вдвое быстрее 30 минут', price: 8, mins: 30},
  {id: 'fill', name: 'Полный склад', icon: '1f9fa', desc: 'склад сразу заполняется мясом', price: 4},
  {id: 'ward', name: 'Оберег шамана', icon: '1f9d9', desc: 'лечит раненых, снимает страх, тигр не придёт 2 часа', price: 10, mins: 120, need: 'tiger'},
  {id: 'heal', name: 'Лечение', icon: '1fa79', desc: 'лечит раненых и снимает страх, но от тигра не защищает', price: 6, need: 'tiger'},
  {id: 'lure', name: 'Приманка для тигра', icon: '1f405', desc: 'тигр приходит прямо сейчас: прогони его ради заданий', price: 4, need: 'tiger'},
  {id: 'call', name: 'Зов мамонта', icon: '1f9a3', desc: 'мамонт приходит прямо сейчас', price: 4, need: 'mammoth'},
  {id: 'grain', name: 'Плодородие', icon: '1f33e', desc: 'поле даёт втрое больше пшена 1 час', price: 6, mins: 60, need: 'field'},
];
/** @typedef {{id:string,name:string,icon:string,desc:string,stars:number,shells?:number,once?:boolean,days?:number}} StarItem */
/** @type {StarItem[]} */
export const STAR_ITEMS = [
  {id: 'shells30', name: 'Горсть ракушек', icon: '1f41a', desc: '30 ракушек для лавки шамана', stars: 50, shells: 30},
  {id: 'shells150', name: 'Мешок ракушек', icon: '1f41a', desc: '150 ракушек для лавки шамана', stars: 200, shells: 150},
  {id: 'shells400', name: 'Сундук ракушек', icon: '1f41a', desc: '400 ракушек для лавки шамана', stars: 500, shells: 400},
  {id: 'keeper', name: 'Хранитель огня', icon: '1fab5', desc: `навсегда: днём жар не ниже ${KEEPER_HEAT}%`, stars: 150, once: true},
  {id: 'bless', name: 'Благословение шамана', icon: '1f9d9', desc: `на 30 дней: добыча +${pct(BLESS_BOOST - 1)}%, ${BLESS_GIFT} ракушек каждый день, доход без тебя копится 4 часа вместо 2`, stars: 300, days: 30},
];
