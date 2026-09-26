// Tiny procedural sound - oscillators for everything that happens to you -
// plus the one recorded thing in the game, which is the soundtrack.
import { MUSIC, MUSIC_URL, MUSIC_GAIN, MUSIC_DUCK } from './config.js';

let ac = null, master = null, bassGain = null, bassOsc = null, droneGain = null;
let started = false;
let muted = false;

export function initAudio() {
  if (ac) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = 0.55;
  master.connect(ac.destination);
}

export function resumeAudio() {
  initAudio();
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume();
  if (!started) { startBeds(); started = true; }
  startMusic();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.55;
  return muted;
}
export function isMuted() { return muted; }

// --- the soundtrack ---------------------------------------------------------
// An <audio> element rather than a decoded buffer: it is five megabytes, and
// decoding it into memory to play it front to back is the wrong trade.  It
// goes through the master gain like everything else, so mute is mute.
//
// Browsers will not let a page make a noise before it has been touched, so
// this can only ever be started from inside a real input event - it is called
// from resumeAudio(), which the first keypress or click already runs.  A
// rejected play() is normal and is not an error worth shouting about.
let musicEl = null, musicGain = null, musicWanted = false;

export function startMusic() {
  if (!MUSIC || !ac) return;
  if (!musicEl) {
    musicEl = new Audio(MUSIC_URL);
    musicEl.loop = true;
    musicEl.preload = 'auto';
    musicGain = ac.createGain();
    musicGain.gain.value = MUSIC_GAIN;
    try {
      ac.createMediaElementSource(musicEl).connect(musicGain).connect(master);
    } catch (e) {
      // no Web Audio route (very old browser): play it straight out instead,
      // which loses the ducking but keeps the music
      musicEl.volume = MUSIC_GAIN;
    }
  }
  musicWanted = true;
  const p = musicEl.play();
  if (p && p.catch) p.catch(() => {});
}

/** Pausing the game pauses the music; it picks up where it left off. */
export function setMusicPaused(paused) {
  if (!musicEl) return;
  if (paused) musicEl.pause();
  else if (musicWanted) { const p = musicEl.play(); if (p && p.catch) p.catch(() => {}); }
}

/** A fresh night starts the night's music again from the top. */
export function restartMusic() {
  if (!musicEl) { startMusic(); return; }
  musicEl.currentTime = 0;
  if (musicGain) musicGain.gain.value = MUSIC_GAIN;
  startMusic();
}

/**
 * The end of a night.  The death screen is one word on a flat red field with
 * nothing else on it, and a soundtrack still going underneath that is the
 * game carrying on without you - so it goes.  Half a second, only so it does
 * not end on a click.
 */
export function stopMusic() {
  if (!musicEl) return;
  musicWanted = false;
  if (ac && musicGain) {
    const now = ac.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(Math.max(0.0001, musicGain.gain.value), now);
    musicGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  }
  setTimeout(() => { if (!musicWanted && musicEl) musicEl.pause(); }, 520);
}

// --- ambient beds -----------------------------------------------------------
function startBeds() {
  // cold wind drone
  const noise = ac.createBufferSource();
  const len = ac.sampleRate * 2;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
  noise.buffer = buf; noise.loop = true;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 320;
  droneGain = ac.createGain(); droneGain.gain.value = 0.05;
  noise.connect(lp).connect(droneGain).connect(master);
  noise.start();

  // the party's bass, audible only when you are near it
  bassGain = ac.createGain(); bassGain.gain.value = 0;
  const bLp = ac.createBiquadFilter();
  bLp.type = 'lowpass'; bLp.frequency.value = 180;
  bassGain.connect(bLp).connect(master);
  bassOsc = ac.createOscillator();
  bassOsc.type = 'sine'; bassOsc.frequency.value = 52;
  bassOsc.connect(bassGain);
  bassOsc.start();
  pulseBass();
}

let bassStep = 0;
function pulseBass() {
  if (!ac) return;
  const now = ac.currentTime;
  const target = bassTarget;
  if (target > 0.001 && bassGain) {
    bassGain.gain.cancelScheduledValues(now);
    bassGain.gain.setValueAtTime(target, now);
    bassGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.26);
    bassOsc.frequency.setValueAtTime(bassStep % 4 === 2 ? 66 : 52, now);
  }
  bassStep++;
  setTimeout(pulseBass, 340);
}

let bassTarget = 0;
/**
 * 0..1 - how close the vampire is to the real party.  It drives the bass, and
 * it ducks the soundtrack out of the bass's way: since the purple light at the
 * door was taken out, this thump is the only thing in the world that knows
 * where the party is, and it cannot be competing with a mix.
 */
export function setBassProximity(k) {
  k = Math.max(0, Math.min(1, k));
  bassTarget = k * 0.42;
  if (musicGain && musicWanted && ac) {
    const want = MUSIC_GAIN * (1 - MUSIC_DUCK * k);
    // a slow follow, so walking past the party does not pump the track
    musicGain.gain.setTargetAtTime(want, ac.currentTime, 0.35);
  }
}

// --- one-shots --------------------------------------------------------------
function blip({ type = 'square', f0, f1, dur, gain = 0.2, filter }) {
  if (!ac || muted) return;
  const now = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, now);
  if (f1 !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), now + dur);
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
  let node = o;
  if (filter) {
    const bq = ac.createBiquadFilter();
    bq.type = 'lowpass'; bq.frequency.value = filter;
    node = o.connect(bq);
    bq.connect(g);
  } else o.connect(g);
  g.connect(master);
  o.start(now); o.stop(now + dur + 0.02);
}

function noiseBurst(dur, gain, freq) {
  if (!ac || muted) return;
  const now = ac.currentTime;
  const len = Math.ceil(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource(); src.buffer = buf;
  const bq = ac.createBiquadFilter(); bq.type = 'bandpass'; bq.frequency.value = freq;
  const g = ac.createGain(); g.gain.value = gain;
  src.connect(bq).connect(g).connect(master);
  src.start(now);
}

export const sfx = {
  step: () => blip({ type: 'sine', f0: 150, f1: 90, dur: 0.06, gain: 0.05 }),
  batOn: () => { blip({ type: 'sawtooth', f0: 420, f1: 1100, dur: 0.22, gain: 0.12, filter: 2200 }); noiseBurst(0.18, 0.1, 900); },
  batLand: () => blip({ type: 'sine', f0: 300, f1: 120, dur: 0.12, gain: 0.1 }),
  bump: () => { blip({ type: 'square', f0: 220, f1: 140, dur: 0.1, gain: 0.12 }); noiseBurst(0.12, 0.08, 500); },
  candy: () => blip({ type: 'square', f0: 660, f1: 990, dur: 0.09, gain: 0.09 }),
  knock: () => { noiseBurst(0.06, 0.22, 180); setTimeout(() => noiseBurst(0.06, 0.22, 180), 130); },
  wrong: () => { blip({ type: 'sawtooth', f0: 300, f1: 110, dur: 0.4, gain: 0.14, filter: 1400 }); },
  mana: () => { blip({ type: 'triangle', f0: 520, f1: 1040, dur: 0.25, gain: 0.12 }); },
  hurt: () => blip({ type: 'sawtooth', f0: 180, f1: 60, dur: 0.3, gain: 0.16, filter: 900 }),
  talk: () => blip({ type: 'square', f0: 380, f1: 420, dur: 0.05, gain: 0.05 }),
  clue: () => { [523, 659, 784].forEach((f, i) => setTimeout(() => blip({ type: 'triangle', f0: f, dur: 0.18, gain: 0.1 }), i * 90)); },
  win: () => [392, 523, 659, 784, 1046].forEach((f, i) =>
    setTimeout(() => blip({ type: 'square', f0: f, dur: 0.35, gain: 0.13, filter: 3000 }), i * 130)),
  lose: () => [392, 330, 262, 196].forEach((f, i) =>
    setTimeout(() => blip({ type: 'sawtooth', f0: f, dur: 0.6, gain: 0.14, filter: 1200 }), i * 220)),
};
