/** @typedef {{id:string,name:string,icon:string,desc:string,cost:number,need:[string,number]}} Tech */
/** @type {Tech[]} */
export const TECHS = [
  {id: 'stones', name: 'Острые камни', icon: '1fa93', desc: 'мясо за тап +34%', cost: 1500, need: ['fire', 5]},
  {id: 'flint', name: 'Кремень', icon: '1f4a5', desc: 'костёр остывает вдвое медленнее', cost: 4000, need: ['fire', 10]},
  {id: 'spears', name: 'Каменные копья', icon: '1f9b4', desc: 'охотники приносят на 34% больше', cost: 8000, need: ['hunter', 5]},
  {id: 'traps', name: 'Ловушки', icon: '1faa4', desc: 'следопыты приносят на 34% больше', cost: 80000, need: ['tracker', 5]},
  {id: 'drums', name: 'Барабаны', icon: '1f941', desc: 'племя бегает на 7% быстрее', cost: 200000, need: ['bath', 5]},
  {id: 'salt', name: 'Соль', icon: '1f9c2', desc: 'кухня работает на 17% лучше', cost: 500000, need: ['kitchen', 10]},
  {id: 'paint', name: 'Наскальная живопись', icon: '1f3a8', desc: 'мамонты приходят вдвое чаще', cost: 1200000, need: ['cave', 15]},
  {id: 'horns', name: 'Рога вождя', icon: '1f98c', desc: 'вожди приносят на 34% больше', cost: 6000000, need: ['chief', 5]},
  {id: 'sickle', name: 'Каменный серп', icon: '1f331', desc: 'поле даёт на 34% больше пшена', cost: 30000, need: ['field', 5]},
  {id: 'fence', name: 'Плетёный загон', icon: '1f410', desc: 'скотина даёт на 34% больше мяса', cost: 400000, need: ['barn', 6]},
];
