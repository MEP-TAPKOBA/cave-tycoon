/** @typedef {import('../core/state.js').World} World */

const STEP = 60 / 96 / 4;
const PENTA = [146.83, 174.61, 196, 220, 261.63, 293.66, 349.23, 392, 440, 523.25];
const MOTIFS = [[4, 5, 4, 3, 2], [2, 3, 4, 6, 5, 4], [7, 6, 4, 5, 4], [4, 4, 3, 2, 0], [5, 7, 8, 7, 5, 4], [2, 4, 5, 4, 2, 3], [6, 5, 4, 2, 3, 2]];

/** @param {World} world */
export function createSound(world) {
  /** @type {AudioContext|undefined} */
  let audio;
  /** @type {{bus:GainNode,noise:AudioBuffer,drone:{stop:() => void}|null}|null} */
  let band = null;
  /** @type {AudioBuffer|undefined} */
  let noiseBuf;
  let nextStep = 0, stepNo = 0;

  /** @returns {AudioBuffer} */
  function noise() {
    if (noiseBuf) return noiseBuf;
    noiseBuf = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  /** @param {number} freq @param {number} dur @param {OscillatorType} [type] @param {number} [vol] */
  function beep(freq, dur, type = 'square', vol = .05) {
    if (world.state.muted) return;
    try {
      audio ??= new AudioContext();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + dur);
      o.connect(g).connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + dur);
    } catch {}
  }

  /** @param {number[]} notes @param {number} gap */
  const tune = (notes, gap) => notes.forEach((f, i) => setTimeout(() => beep(f, .14), i * gap));

  function trumpet() {
    if (world.state.muted) return;
    try {
      audio ??= new AudioContext();
      const at = audio.currentTime, f = audio.createBiquadFilter(), g = audio.createGain(), lfo = audio.createOscillator(), depth = audio.createGain();
      const horns = [1, 1.012].map(() => audio.createOscillator());
      lfo.frequency.value = 7;
      depth.gain.value = 9;
      lfo.connect(depth);
      horns.forEach((o, i) => {
        const k = i ? 1.012 : 1;
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(240 * k, at);
        o.frequency.exponentialRampToValueAtTime(370 * k, at + .18);
        o.frequency.setValueAtTime(370 * k, at + .75);
        o.frequency.exponentialRampToValueAtTime(290 * k, at + 1.15);
        depth.connect(o.frequency);
        o.connect(f);
      });
      f.type = 'lowpass';
      f.Q.value = 3;
      f.frequency.setValueAtTime(700, at);
      f.frequency.exponentialRampToValueAtTime(1800, at + .2);
      f.frequency.exponentialRampToValueAtTime(800, at + 1.15);
      g.gain.setValueAtTime(.0001, at);
      g.gain.exponentialRampToValueAtTime(.03, at + .1);
      g.gain.setValueAtTime(.03, at + .8);
      g.gain.exponentialRampToValueAtTime(.0001, at + 1.2);
      f.connect(g).connect(audio.destination);
      for (const o of [...horns, lfo]) {
        o.start(at);
        o.stop(at + 1.25);
      }
    } catch {}
  }

  function sizzle(len = .9) {
    if (world.state.muted) return;
    try {
      audio ??= new AudioContext();
      const at = audio.currentTime, s = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
      s.buffer = noise();
      s.loop = true;
      f.type = 'highpass';
      f.frequency.setValueAtTime(1800, at);
      f.frequency.exponentialRampToValueAtTime(4500, at + len);
      g.gain.setValueAtTime(.0001, at);
      g.gain.exponentialRampToValueAtTime(.04, at + .05);
      g.gain.exponentialRampToValueAtTime(.0001, at + len);
      s.connect(f).connect(g).connect(audio.destination);
      s.start(at);
      s.stop(at + len + .02);
    } catch {}
  }

  function roar() {
    if (world.state.muted) return;
    try {
      audio ??= new AudioContext();
      const at = audio.currentTime, o = audio.createOscillator(), growl = audio.createOscillator(), depth = audio.createGain(), am = audio.createGain(), g = audio.createGain();
      const s = audio.createBufferSource(), f = audio.createBiquadFilter(), ng = audio.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(95, at);
      o.frequency.exponentialRampToValueAtTime(130, at + .25);
      o.frequency.exponentialRampToValueAtTime(65, at + 1);
      growl.frequency.value = 28;
      depth.gain.value = .4;
      am.gain.value = .6;
      growl.connect(depth).connect(am.gain);
      g.gain.setValueAtTime(.0001, at);
      g.gain.exponentialRampToValueAtTime(.06, at + .12);
      g.gain.setValueAtTime(.06, at + .55);
      g.gain.exponentialRampToValueAtTime(.0001, at + 1.05);
      s.buffer = noise();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(500, at);
      f.frequency.exponentialRampToValueAtTime(260, at + 1);
      f.Q.value = 1.5;
      ng.gain.setValueAtTime(.0001, at);
      ng.gain.exponentialRampToValueAtTime(.05, at + .1);
      ng.gain.exponentialRampToValueAtTime(.0001, at + 1);
      o.connect(am).connect(g).connect(audio.destination);
      s.connect(f).connect(ng).connect(audio.destination);
      for (const n of [o, growl, s]) {
        n.start(at);
        n.stop(at + 1.1);
      }
    } catch {}
  }

  /** @returns {{bus:GainNode,noise:AudioBuffer,drone:null}} */
  function setupBand() {
    const bus = audio.createGain(), verb = audio.createConvolver(), wet = audio.createGain();
    const len = audio.sampleRate * 2.6, imp = audio.createBuffer(2, len, audio.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = imp.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.5;
    }
    verb.buffer = imp;
    bus.gain.value = .8;
    wet.gain.value = .35;
    bus.connect(audio.destination);
    bus.connect(verb).connect(wet).connect(audio.destination);
    return {bus, noise: noise(), drone: null};
  }

  /** @param {AudioNode} node @param {number} pan */
  function out(node, pan) {
    const p = audio.createStereoPanner();
    p.pan.value = pan;
    node.connect(p).connect(band.bus);
  }

  /** @param {number} at @param {number} freq @param {number} vol @param {number} len @param {number} pan @param {BiquadFilterType} [type] @param {number} [q] */
  function hiss(at, freq, vol, len, pan, type = 'highpass', q = .7) {
    const s = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
    s.buffer = band.noise;
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(.0001, at + len);
    s.connect(f).connect(g);
    out(g, pan);
    s.start(at, Math.random() * .5);
    s.stop(at + len + .02);
  }

  /** @param {number} at @param {number} freq @param {number} vol @param {number} pan @param {boolean} slap */
  function drum(at, freq, vol, pan, slap) {
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.setValueAtTime(freq * 1.6, at);
    o.frequency.exponentialRampToValueAtTime(freq, at + .04);
    o.frequency.exponentialRampToValueAtTime(freq * .8, at + .4);
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(.0001, at + (slap ? .18 : .45));
    o.connect(g);
    out(g, pan);
    o.start(at);
    o.stop(at + .5);
    hiss(at, slap ? 1400 : 500, vol * (slap ? .9 : .35), slap ? .09 : .05, pan, 'bandpass', 1.2);
  }

  /** @param {number} at @param {number} vol @param {number} pan */
  function clave(at, vol, pan) {
    for (const [freq, v] of [[1750, 1], [2600, .4]]) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol * v, at);
      g.gain.exponentialRampToValueAtTime(.0001, at + .07);
      o.connect(g);
      out(g, pan);
      o.start(at);
      o.stop(at + .08);
    }
  }

  /** @param {number} at @param {number} freq @param {number} dur @param {number} vol @param {number} [from] */
  function blow(at, freq, dur, vol, from = freq) {
    const o = audio.createOscillator(), o2 = audio.createOscillator(), lfo = audio.createOscillator();
    const depth = audio.createGain(), soft = audio.createGain(), f = audio.createBiquadFilter(), g = audio.createGain();
    o.frequency.setValueAtTime(from, at);
    o.frequency.exponentialRampToValueAtTime(freq, at + .09);
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(from * 2, at);
    o2.frequency.exponentialRampToValueAtTime(freq * 2, at + .09);
    lfo.frequency.value = 5.2;
    depth.gain.setValueAtTime(0, at);
    depth.gain.linearRampToValueAtTime(freq * .015, at + Math.min(.4, dur * .6));
    lfo.connect(depth);
    depth.connect(o.frequency);
    depth.connect(o2.frequency);
    soft.gain.value = .1;
    o2.connect(soft).connect(f);
    o.connect(f);
    f.type = 'lowpass';
    f.frequency.value = freq * 4;
    g.gain.setValueAtTime(.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + .08);
    g.gain.setValueAtTime(vol, at + dur * .7);
    g.gain.exponentialRampToValueAtTime(.0001, at + dur);
    f.connect(g);
    out(g, -.2);
    hiss(at, freq * 2, vol * .6, Math.min(dur, .22), -.2, 'bandpass', 5);
    for (const n of [o, o2, lfo]) {
      n.start(at);
      n.stop(at + dur + .05);
    }
  }

  function startDrone() {
    if (band.drone) return;
    const o = audio.createOscillator(), o2 = audio.createOscillator(), f = audio.createBiquadFilter(), lfo = audio.createOscillator(), depth = audio.createGain(), g = audio.createGain();
    o.type = o2.type = 'sawtooth';
    o.frequency.value = 73.42;
    o2.frequency.value = 73.42 * 1.006;
    f.type = 'bandpass';
    f.frequency.value = 480;
    f.Q.value = 4;
    lfo.frequency.value = .35;
    depth.gain.value = 280;
    lfo.connect(depth).connect(f.frequency);
    g.gain.setValueAtTime(.0001, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(.06, audio.currentTime + 3);
    o.connect(f);
    o2.connect(f);
    f.connect(g);
    out(g, 0);
    for (const n of [o, o2, lfo]) n.start();
    band.drone = {stop: () => {
      g.gain.setTargetAtTime(.0001, audio.currentTime, .4);
      for (const n of [o, o2, lfo]) n.stop(audio.currentTime + 2.5);
    }};
  }

  function stopDrone() {
    band?.drone?.stop();
    if (band) band.drone = null;
  }

  /** @param {number} at */
  function phrase(at) {
    const motif = MOTIFS[Math.floor(Math.random() * MOTIFS.length)], lift = Math.random() < .3 ? 2 : 0;
    let pos = 0, prev = 0;
    for (const n of motif) {
      const len = [2, 2, 3, 4, 4, 6][Math.floor(Math.random() * 6)], freq = PENTA[Math.min(PENTA.length - 1, n + lift)] * 2;
      if (pos + len > 30) break;
      blow(at + pos * STEP, freq, len * STEP * 1.15, .05, prev && Math.random() < .35 ? prev : freq);
      prev = freq;
      pos += len;
    }
  }

  /** @param {number} s @param {number} at */
  function playStep(s, at) {
    const bar = Math.floor(s / 16), beat = s % 16, part = bar < 2 ? 'intro' : bar < 6 ? 'theme' : bar < 7 ? 'sticks' : 'rest';
    const t = at + (beat % 2 ? STEP * .16 : 0) + (Math.random() - .5) * .008;
    if (part !== 'rest') {
      if (beat === 0 || beat === 10) drum(t, 68, .5, -.1, false);
      if (beat === 7 && Math.random() < .6) drum(t, 68, .3, -.1, false);
      if (beat === 4 || beat === 12) drum(t, 190, .28, .25, true);
      if (beat % 2 && Math.random() < .3) drum(t, 190, .06, .3, true);
      hiss(t, 8000, beat % 4 === 2 ? .05 : .02, .05, .4);
    } else if (beat === 0) drum(t, 60, .5, 0, false);
    if (part === 'sticks' && [0, 3, 6, 10, 12].includes(beat)) clave(t, .07, -.45);
    if ((part === 'theme' || part === 'sticks') && beat === 0 && bar % 2 === 0) phrase(t);
  }

  function musicTick() {
    if (!audio || document.hidden || audio.state !== 'running') return;
    band ??= setupBand();
    if (!world.state.music) return stopDrone();
    startDrone();
    if (nextStep <= audio.currentTime) nextStep = audio.currentTime + .05;
    while (nextStep < audio.currentTime + .2) {
      playStep(stepNo, nextStep);
      nextStep += STEP;
      stepNo = (stepNo + 1) % 128;
    }
  }
  setInterval(musicTick, 50);
  document.addEventListener('pointerdown', () => {
    try {
      audio ??= new AudioContext();
      if (audio.state === 'suspended') audio.resume();
    } catch {}
  });

  return {
    beep,
    tune,
    trumpet,
    roar,
    sizzle,
    resume: () => void audio?.resume(),
    suspend: () => void audio?.suspend(),
  };
}
