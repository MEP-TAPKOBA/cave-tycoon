/** @typedef {{id:string,name:string,icon:string,base:number,growth:number,unit:string,pct?:boolean,tech?:string,trip?:number,time?:number,color?:string,feed?:number,meat?:number,from?:string}} Def */
/** @type {Def[]} */
export const STATIONS = [
  {id: 'fire', name: 'Костёр', icon: '1f525', base: 75, growth: 1.11, tech: 'stones', unit: 'за тап'},
  {id: 'cave', name: 'Пещера', icon: '26f0', base: 200, growth: 1.125, unit: 'мест'},
  {id: 'storage', name: 'Склад', icon: '1f9fa', base: 500, growth: 1.225, unit: 'мяса'},
  {id: 'kitchen', name: 'Кухня', icon: '1f372', base: 1500, growth: 1.11, unit: 'рабочим', pct: true},
  {id: 'bath', name: 'Баня', icon: '2668', base: 3000, growth: 1.11, unit: 'к скорости', pct: true},
];
/** @type {Def[]} */
export const WORKERS = [
  {id: 'hunter', name: 'Охотник', icon: '1f3f9', base: 50, growth: 1.085, trip: 80 / 3, time: 10, tech: 'spears', color: '#C1694F', unit: 'мяса/с'},
  {id: 'tracker', name: 'Следопыт', from: 'hunter', icon: '1f43e', base: 1000, growth: 1.1275, trip: 400, time: 12, tech: 'traps', color: '#77B255', unit: 'мяса/с'},
  {id: 'chief', name: 'Вождь охоты', from: 'tracker', icon: '1fab6', base: 20000, growth: 1.12, trip: 3200, time: 14, tech: 'horns', color: '#DD2E44', unit: 'мяса/с'},
];
/** @type {Def[]} */
export const FARM = [
  {id: 'field', name: 'Поле пшена', icon: '1f33e', base: 750, growth: 1.15, unit: 'пшена/мин'},
  {id: 'granary', name: 'Амбар', icon: '1f3e0', base: 1000, growth: 1.15, unit: 'пшена'},
  {id: 'barn', name: 'Хлев', icon: '1f6d6', base: 2000, growth: 1.175, unit: 'мест'},
  {id: 'rabbit', name: 'Кролики', icon: '1f407', base: 600, growth: 1.09, feed: 1.5, meat: 8, unit: 'мяса/с'},
  {id: 'goat', name: 'Козы', icon: '1f410', base: 12500, growth: 1.09, feed: 3, meat: 240, unit: 'мяса/с'},
];
export const ANIMALS = FARM.filter(d => d.feed);
export const ALL = [...STATIONS, ...WORKERS, ...FARM];
