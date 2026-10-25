import {CLOUD_EVERY, CLOUD_MAX, SAVE_KEY, SERVER} from '../config.js';
import {ahead, fresh, parseSave} from '../core/state.js';
import {ask, serverSaves, tg, tgAt} from './telegram.js';

/** @typedef {import('../core/state.js').State} State */
/** @typedef {import('../core/state.js').World} World */

/** @returns {State} */
export function load() {
  try { return parseSave(localStorage.getItem(SAVE_KEY)) || fresh(); } catch { return fresh(); }
}

/** @returns {Promise<string|null>} */
const cloudSave = () => new Promise(done => tgAt('6.9') ? tg.CloudStorage.getItem(SAVE_KEY, (/** @type {any} */ err, /** @type {string} */ json) => done(err ? null : json || null)) : done(null));

/** @param {World} world @param {(since:number) => void} welcomeBack */
export function createSaves(world, welcomeBack) {
  let syncAt = 0;
  let remoteReady = false;
  let frozen = false;
  let pulling = false;

  function save() {
    if (frozen) return;
    world.state.savedAt = Date.now();
    world.state.heat = world.heat;
    const json = JSON.stringify(world.state);
    try { localStorage.setItem(SAVE_KEY, json); } catch {}
    if (!remoteReady || Date.now() - syncAt < CLOUD_EVERY) return;
    syncAt = Date.now();
    if (serverSaves) pushSave(json);
    else if (json.length <= CLOUD_MAX) tg.CloudStorage.setItem(SAVE_KEY, json, () => {});
  }

  function saveNow() {
    syncAt = 0;
    save();
  }

  /** @param {string} json @param {number} away */
  function adopt(json, away) {
    const s = parseSave(json);
    if (!s) return;
    frozen = true;
    s.savedAt = Date.now() - away;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch {}
    location.reload();
  }

  /** @param {string} json */
  function pushSave(json) {
    fetch(SERVER + '/save', {method: 'POST', keepalive: true, body: JSON.stringify({initData: tg.initData, save: json})})
      .then(r => r.ok ? r.json() : null)
      .then(r => r && !r.ok && adopt(r.save, r.now - r.savedAt))
      .catch(() => {});
  }

  function pullCloud() {
    if (!tgAt('6.9')) return;
    cloudSave().then(json => {
      remoteReady = true;
      const cloud = json ? parseSave(json) : null;
      if (cloud && ahead(cloud, world.state)) return adopt(json, Date.now() - cloud.savedAt);
      saveNow();
    });
  }

  async function pullServer() {
    if (pulling) return;
    pulling = true;
    /** @type {{save:string|null,savedAt:number,now:number}|null} */
    let r = null;
    try { r = await ask('/load'); } catch {}
    pulling = false;
    if (!r) return welcomeBack(world.state.savedAt);
    remoteReady = true;
    const server = r.save ? parseSave(r.save) : null;
    if (server && ahead(server, world.state)) return adopt(r.save, r.now - r.savedAt);
    if (!server) {
      const json = await cloudSave(), cloud = json ? parseSave(json) : null;
      if (cloud && ahead(cloud, world.state)) {
        await ask('/save', {save: json}).catch(() => {});
        return adopt(json, Date.now() - cloud.savedAt);
      }
    }
    welcomeBack(server ? Date.now() - Math.min(Date.now() - world.state.savedAt, r.now - r.savedAt) : world.state.savedAt);
    saveNow();
  }

  const pull = () => serverSaves ? pullServer() : pullCloud();

  return {save, saveNow, pull, pullServer, pullCloud};
}
