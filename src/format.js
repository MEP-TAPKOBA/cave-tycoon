const fmt = new Intl.NumberFormat('ru', {notation: 'compact', maximumFractionDigits: 1});
/** @param {number} v @returns {number} */
export const up = v => Math.max(0, Math.ceil(v - 1e-9));
/** @param {number} v @returns {string} */
export const num = v => fmt.format(v < 1000 ? Math.max(0, Math.ceil(v - 1e-9)) : v);
/** @param {number} share @returns {number} */
export const pct = share => Math.max(0, Math.ceil(share * 100 - 1e-9));
/** @param {number} n @param {[string, string, string]} forms @returns {string} */
export const plural = (n, [one, few, many]) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many}`;
