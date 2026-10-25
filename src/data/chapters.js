export const GENERIC_STAGES = 24;
/** @type {{title:string,stages:[string,number][][]}[]} */
export const CHAPTERS = [
  {title: 'Охота, костёр и племя', stages: [
    [['taps', 20], ['fire', 2], ['heat', 50]],
    [['hunter', 2], ['storage', 1], ['earned', 3000]],
    [['cave', 2], ['hunter', 4], ['fire', 5]],
    [['storage', 3], ['hunter', 5], ['earned', 20000]],
  ]},
  {title: 'Кухня, баня и следопыты', stages: [
    [['kitchen', 1], ['hunter', 4], ['earned', 10000]],
    [['bath', 1], ['storage', 3], ['cave', 4]],
    [['tracker', 1], ['kitchen', 3], ['earned', 50000]],
    [['tracker', 3], ['bath', 3], ['fire', 10]],
    [['kitchen', 5], ['storage', 6], ['earned', 200000]],
  ]},
  {title: 'Мамонт и вождь охоты', stages: [
    [['mammoths', 1], ['hunter', 5], ['fire', 6]],
    [['storage', 5], ['tracker', 2], ['earned', 50000]],
    [['mammoths', 2], ['cave', 8], ['kitchen', 4]],
    [['chief', 1], ['storage', 9], ['earned', 200000]],
    [['mammoths', 3], ['chief', 2], ['earned', 500000]],
  ]},
  {title: 'Ночь и саблезубый тигр', stages: [
    [['heat', 60], ['hunter', 5], ['fire', 8]],
    [['tigers', 1], ['storage', 6], ['tracker', 3]],
    [['kitchen', 6], ['bath', 4], ['earned', 200000]],
    [['tigers', 2], ['chief', 2], ['cave', 10]],
    [['storage', 10], ['chief', 3], ['earned', 1000000]],
  ]},
  {title: 'Открытия', stages: [
    [['techs', 1], ['fire', 6], ['hunter', 5]],
    [['techs', 2], ['storage', 6], ['tracker', 3]],
    [['techs', 3], ['bath', 5], ['earned', 300000]],
    [['techs', 4], ['kitchen', 10], ['cave', 12]],
    [['techs', 5], ['chief', 5], ['earned', 2000000]],
  ]},
  {title: 'Ферма', stages: [
    [['field', 1], ['hunter', 5], ['storage', 5]],
    [['barn', 1], ['field', 3], ['earned', 100000]],
    [['rabbit', 2], ['barn', 2], ['fire', 10]],
    [['rabbit', 4], ['field', 6], ['earned', 500000]],
    [['goat', 1], ['barn', 4], ['techs', 3]],
    [['goat', 2], ['field', 10], ['earned', 3000000]],
  ]},
];
/** @type {Record<string, number>} */
export const FEATURE_AT = {kitchen: 1, bath: 1, tracker: 1, mammoth: 2, chief: 2, tiger: 3, techs: 4, field: 5, granary: 5, barn: 5, rabbit: 5, goat: 5};
/** @type {Record<string, [number, number, number]>} */
export const GOALS = {tribe: [0, 3, 1.2], fire: [0, 3, 2], storage: [0, 2, 1], cave: [0, 2, 1.3], kitchen: [3, 1, 1], bath: [5, 1, 1], field: [7, 1, .7], barn: [8, 1, .5], herd: [9, 2, .8]};
export const EXTRAS = ['taps', 'earned', 'mammoths', 'techs', 'tigers'];
