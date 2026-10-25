import {applyStatus, grant} from '../core/economy.js';
import {ask, shopStars, tg} from './telegram.js';

/** @typedef {import('../core/state.js').World} World */
/** @typedef {import('../data/shop.js').StarItem} StarItem */
/** @typedef {{gift:() => void,item:(it:StarItem) => void,fail:(offline:boolean) => void,saveNow:() => void,refresh:() => void}} StarHooks */

/** @param {World} world @param {StarHooks} hooks */
export function createStars(world, hooks) {
  let paidKeeper = false;
  let paying = false;

  /** @param {{keeper?:boolean,blessUntil?:number}} s */
  function status(s) {
    paidKeeper = Boolean(s.keeper);
    applyStatus(world, s);
    hooks.gift();
  }

  /** @param {number} [tries] */
  async function claim(tries = 1) {
    /** @type {{items:string[],keeper:boolean,blessUntil:number}} */
    let r;
    try { r = await ask('/claim'); } catch { return; }
    status(r);
    if (!r.items.length && tries > 1) return void setTimeout(() => claim(tries - 1), 2000);
    for (const id of r.items) {
      const it = grant(world, id);
      if (it) hooks.item(it);
    }
    hooks.saveNow();
    hooks.refresh();
  }

  async function sync() {
    if (!shopStars) return;
    try { status(await ask('/status')); } catch { hooks.gift(); }
    claim();
  }

  /** @param {StarItem} it */
  async function buy(it) {
    if (paying) return;
    paying = true;
    try {
      const {link} = await ask('/invoice', {item: it.id});
      tg.openInvoice(link, (/** @type {string} */ result) => {
        paying = false;
        if (result === 'paid') claim(5);
        if (result === 'failed') hooks.fail(false);
      });
    } catch {
      paying = false;
      hooks.fail(true);
    }
  }

  return {
    sync,
    buy,
    get paidKeeper() { return paidKeeper; },
    get paying() { return paying; },
  };
}
