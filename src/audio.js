// Tiny procedural sound. No files, no library - just oscillators.
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
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.55;
  return muted;
}
export function isMuted() { return muted; }

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
/** 0..1 - how close the vampire is to the real party. */
export function setBassProximity(k) {
  bassTarget = Math.max(0, Math.min(1, k)) * 0.42;
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
