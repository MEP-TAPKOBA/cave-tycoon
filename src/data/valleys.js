/** @typedef {[string,string]} Shade */
/** @typedef {{name:string,skyTop:Shade,skyBot:Shade,mount:Shade,groundTop:Shade,groundBot:Shade,path:Shade,pineBack:Shade,pineFront:Shade,rock:Shade,rockSpot:Shade,extra?:'snow'|'volcano'|'sea'}} Valley */
/** @type {Valley[]} */
export const VALLEYS = [
  {name: 'Зелёная долина', skyTop: ['#141a35', '#5fa8dd'], skyBot: ['#3a2f4a', '#f3d9b0'], mount: ['#232842', '#7e8fa8'], groundTop: ['#26331b', '#88a852'], groundBot: ['#1a2412', '#5c7a34'], path: ['#3b2c1c', '#b89464'], pineBack: ['#10261a', '#2c5f36'], pineFront: ['#0c1f14', '#24502d'], rock: ['#3b3330', '#8a7a6a'], rockSpot: ['#2b2522', '#6e6155']},
  {name: 'Ледник', skyTop: ['#101830', '#8fc4ea'], skyBot: ['#2c3550', '#e8f2f8'], mount: ['#3a4560', '#dfe9f2'], groundTop: ['#4a5468', '#e9f0f5'], groundBot: ['#363e50', '#c4d2de'], path: ['#2c3240', '#a9b8c6'], pineBack: ['#16283a', '#3f6a6e'], pineFront: ['#102030', '#335a5e'], rock: ['#3e4452', '#9aa6b4'], rockSpot: ['#2e3440', '#7c8896'], extra: 'snow'},
  {name: 'Вулкан', skyTop: ['#1a0c10', '#b5654a'], skyBot: ['#4a1c14', '#f0b080'], mount: ['#24141a', '#5a3a3a'], groundTop: ['#2a1e18', '#7a5a3a'], groundBot: ['#1a120e', '#4e3a28'], path: ['#3a2014', '#a0623a'], pineBack: ['#1e1a10', '#4a4a24'], pineFront: ['#16120a', '#3a3a1c'], rock: ['#2e2222', '#6a5050'], rockSpot: ['#201818', '#4e3a3a'], extra: 'volcano'},
  {name: 'Побережье', skyTop: ['#0e1a38', '#4fb0e8'], skyBot: ['#2a3a5a', '#fbe6c0'], mount: ['#1e3048', '#6a9ab8'], groundTop: ['#4a4430', '#e8d49a'], groundBot: ['#3a3424', '#c8b070'], path: ['#3a3020', '#d8c088'], pineBack: ['#102a20', '#2e7a52'], pineFront: ['#0c2018', '#256645'], rock: ['#3a3630', '#a09480'], rockSpot: ['#2a2620', '#807460'], extra: 'sea'},
];
