import assert from 'node:assert/strict';
import {test} from 'node:test';
import {SAVE_EPOCH} from '../src/config.js';
import {TUT_DONE, ahead, fresh, parseSave} from '../src/core/state.js';

test('старый сейв (econ не 2): мясо x10, пшено x5', () => {
  const s = parseSave(JSON.stringify({meat: 100, earned: 500, grain: 10, valley: 1, taps: 7, levels: {fire: 3}}));
  assert.equal(s.meat, 1000);
  assert.equal(s.earned, 5000);
  assert.equal(s.grain, 50);
  assert.equal(s.econ, 2);
  assert.equal(s.tut, TUT_DONE);
  assert.deepEqual(s.life, {taps: 7, earned: 5000, mammoths: 0, tigers: 0, migrations: 1});
  assert.equal(s.levels.fire, 3);
  assert.equal(s.shells, 4);
});

test('старый сейв с life: заработанное за всю игру тоже x10', () => {
  const life = {taps: 1, earned: 30, mammoths: 2, tigers: 0, migrations: 0};
  const s = parseSave(JSON.stringify({meat: 1, earned: 3, life}));
  assert.equal(s.life.earned, 300);
  assert.equal(s.tut, 0);
});

test('сейв econ 2 не пересчитывается и дополняется полями', () => {
  const s = parseSave(JSON.stringify({meat: 5, earned: 50, grain: 3, econ: 2}));
  assert.equal(s.meat, 5);
  assert.equal(s.grain, 3);
  assert.equal(s.restarts, 0);
  assert.equal(s.noBuzz, false);
  assert.equal(s.noBeasts, false);
});

test('битый сейв - null', () => {
  assert.equal(parseSave('{'), null);
  assert.equal(parseSave(null), null);
  assert.equal(parseSave('{"shells":5}'), null);
});

test('ahead: сначала сбросы, потом переселения, потом добыча', () => {
  const s = (restarts, migrations, earned) => ({...fresh(), restarts, life: {taps: 0, earned, mammoths: 0, tigers: 0, migrations}});
  assert.equal(ahead(s(1, 0, 0), s(0, 9, 9e9)), true);
  assert.equal(ahead(s(0, 9, 9e9), s(1, 0, 0)), false);
  assert.equal(ahead(s(0, 2, 0), s(0, 1, 9e9)), true);
  assert.equal(ahead(s(0, 1, 10), s(0, 1, 9)), true);
  assert.equal(ahead(s(0, 1, 9), s(0, 1, 9)), false);
});

test('сейв после вайпа получает метку эпохи, даже если её не было', () => {
  assert.equal(fresh().epoch, SAVE_EPOCH);
  assert.equal(parseSave(JSON.stringify({meat: 1, econ: 2})).epoch, SAVE_EPOCH);
});
