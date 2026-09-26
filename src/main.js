import { VIEW_W, VIEW_H, ZOOMS, DEFAULT_ZOOM, VISION_SECONDS } from './config.js';
import { makeInput } from './input.js';
import { hashSeed } from './rng.js';
import { newGame, updateGame, knock, bringTipForward } from './game.js';
import { FACT_KEYS } from './hints.js';
import { makeCamera, updateCamera, drawScene, drawBleed } from './render.js';
import { drawHud, drawTitle, drawEnd, cardAt } from './hud.js';
import { resumeAudio, toggleMute, setBassProximity } from './audio.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_W; canvas.height = VIEW_H;
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

function fit() {
  const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  canvas.style.width = Math.floor(VIEW_W * s) + 'px';
  canvas.style.height = Math.floor(VIEW_H * s) + 'px';
}
window.addEventListener('resize', fit);
fit();

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
// the layout seed is fixed in config.js; this is the override for cutting a
// different city to look at
const cityParam = params.get('citySeed');
const citySeed = cityParam == null ? undefined : (hashSeed(cityParam) >>> 0);
let game = newGame(seedParam || undefined, citySeed);
let zoomIdx = DEFAULT_ZOOM;
let paused = false;
let last = performance.now();

const cam = makeCamera();
cam.z = ZOOMS[zoomIdx];
cam.x = game.player.x;
cam.y = game.player.y;

const input = makeInput(() => resumeAudio());

// --- the deck is the one thing you point at -------------------------------
// The canvas is letterboxed to whatever the window is, so a click has to be
// put back into the 1280x720 the game actually draws in before it means
// anything.
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (VIEW_W / r.width),
    y: (e.clientY - r.top) * (VIEW_H / r.height),
  };
}

function cardUnder(e) {
  if (game.state !== 'play' || paused) return null;
  const { x, y } = canvasPoint(e);
  return cardAt(x, y, game.knowledge);
}

canvas.addEventListener('mousedown', (e) => {
  const key = cardUnder(e);
  if (key) { bringTipForward(game, key); e.preventDefault(); }
});

// so it is discoverable at all: buried cards say they can be picked up
canvas.addEventListener('mousemove', (e) => {
  canvas.style.cursor = cardUnder(e) ? 'pointer' : '';
});

function restart() {
  game = newGame(seedParam || undefined, citySeed);
  game.state = 'play';
  cam.x = game.player.x;
  cam.y = game.player.y;
  paused = false;
}

function drawPause(c) {
  c.fillStyle = 'rgba(6,4,14,0.78)';
  c.fillRect(0, 0, VIEW_W, VIEW_H);
  c.textAlign = 'center';
  c.font = 'bold 54px "Courier New", monospace';
  c.fillStyle = '#e8d8ff';
  c.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2 - 20);
  c.font = 'bold 18px "Courier New", monospace';
  c.fillStyle = '#a898c8';
  c.fillText('ESC to go back out there   -   M mutes   -   [ ] zoom', VIEW_W / 2, VIEW_H / 2 + 24);
  c.fillText('hold ESC and press R for a different night', VIEW_W / 2, VIEW_H / 2 + 52);
}

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;          // a backgrounded tab should not cost you the night

  if (input.pressed('mute')) toggleMute();
  if (input.pressed('zoomIn') && zoomIdx < ZOOMS.length - 1) cam.z = ZOOMS[++zoomIdx];
  if (input.pressed('zoomOut') && zoomIdx > 0) cam.z = ZOOMS[--zoomIdx];

  if (game.state === 'title') {
    setBassProximity(0);
    if (input.pressed('start') || input.pressed('bat')) {
      resumeAudio();
      game.state = 'play';
    }
    drawTitle(ctx, now / 1000);
  } else if (game.state === 'win' || game.state === 'lose') {
    setBassProximity(game.state === 'win' ? 0.9 : 0);
    updateCamera(cam, game.player, dt);
    drawScene(ctx, cam, game);
    drawEnd(ctx, game, now / 1000);
    if (input.pressed('start')) restart();
  } else {
    if (input.pressed('pause')) paused = !paused;
    if (input.pressed('restart') && input.held('pause')) restart();
    if (paused) {
      setBassProximity(0);
    } else {
      updateGame(game, dt, input);
      if (game.camShake) { cam.shake = Math.max(cam.shake, game.camShake); game.camShake = 0; }
      updateCamera(cam, game.player, dt);
    }
    drawScene(ctx, cam, game);
    drawHud(ctx, game);
    drawBleed(ctx, game);          // over the HUD too: it happens to you
    if (paused) drawPause(ctx);
  }

  input.endFrame();
  requestAnimationFrame(frame);
}

// A small hatch for tinkering from the browser console.
window.PARTY = {
  get game() { return game; },
  restart,
  warp() {
    game.player.x = game.city.party.ax;
    game.player.y = game.city.party.ay;
    cam.x = game.player.x; cam.y = game.player.y;
  },
  reveal() {
    for (const k of FACT_KEYS) game.knowledge[k] = ++game.tipsTaken;
    game.knowledge.marked = true;
  },
  skipTo(min) { game.clock.t = min / 360 * 720; },
  vision(sec) { game.vision = sec === undefined ? VISION_SECONDS : sec; },
  win() { knock(game, game.city.party); },
  /** ms a frame of city costs - the scenery is the expensive half. */
  bench(n = 40) {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) drawScene(ctx, cam, game);
    return `${((performance.now() - t0) / n).toFixed(2)} ms/frame @ z${cam.z}`;
  },
};

requestAnimationFrame(frame);
