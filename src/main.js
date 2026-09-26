import { VIEW_W, VIEW_H, ZOOMS, DEFAULT_ZOOM, VISION_SECONDS, MIN_PER_SEC } from './config.js';
import { makeInput } from './input.js';
import { hashSeed } from './rng.js';
import { newGame, updateGame, knock, bringTipForward, giveTip } from './game.js';
import { isWalkable } from './city.js';
import { FACT_KEYS } from './hints.js';
import { makeCamera, updateCamera, drawScene, drawBleed } from './render.js';
import { drawHud, drawTitle, drawEnd, drawPause, cardAt, tipVotes } from './hud.js';
import { resumeAudio, toggleMute, setBassProximity, setMusicPaused, restartMusic } from './audio.js';
import { loadDeathFonts } from './deathtype.js';
import { loadArtwork } from './artwork.js';

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

// The death screen is set in a real typeface, which has to be fetched before
// anything can be drawn with it.  Nothing waits on this: it is wanted minutes
// into a night at the earliest, and until it lands the screen sets in serif.
loadDeathFonts();
// The drawn characters - the vampire and the witches - cut out of their
// sheets.  Nothing waits on this either: until they land, both are drawn with
// the placeholder sprites.
loadArtwork();

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
  return cardAt(x, y, game.tips);
}

canvas.addEventListener('mousedown', (e) => {
  const id = cardUnder(e);
  if (id) { bringTipForward(game, id); e.preventDefault(); }
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
  restartMusic();
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
    if (input.pressed('pause')) { paused = !paused; setMusicPaused(paused); }
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
  /** four honest tips - the deck the game used to hand you by default */
  reveal() { for (const k of FACT_KEYS) giveTip(game, k, false, 'reveal'); },
  /** one lie, to see a contradiction land on the deck and the map */
  lie(key) {
    const t = giveTip(game, key || FACT_KEYS[1], true, 'reveal');
    return t ? t.value : 'the deck is full - five a night';
  },
  /**
   * After a run: was that night a mirage or just a night you could not find
   * anybody?  Says how many tips you got, how many were lies, and whether the
   * deepest shading on your map was over the real block or somewhere a liar
   * sent you.  Reading it mid-run spoils the run.
   */
  postmortem() {
    const g = game;
    const { votes, max } = tipVotes(g.tips, g.city);
    const pb = g.city.party.block.id;
    const mine = votes.get(pb) || 0;
    const hot = [...votes.entries()].filter(([, n]) => n === max).map(([id]) => id);
    return {
      clock: `${Math.floor(g.clock.minutes / 60)}:${String(Math.floor(g.clock.minutes % 60)).padStart(2, '0')}`,
      tips: g.tips.length,
      lies: g.tips.filter(t => t.lie).length,
      monstersTalkedTo: g.stats.talks,
      doorsKnocked: g.stats.knocks,
      deepestShade: max,
      shadeOverTheRealBlock: mine,
      verdict: !g.tips.length ? 'no tips at all - you never reached a monster'
        : mine === max ? `the map was pointing at it (${hot.length} block(s) that deep)`
        : `MIRAGE - the deepest shading was ${max} deep and the real block only ${mine}`,
      cards: g.tips.map(t => `${t.lie ? 'LIE ' : 'TRUE'}  ${t.key} = ${t.value}`),
    };
  },
  /** which of your cards were lies - the one thing the game will not show you */
  tips() {
    return game.tips.map(t =>
      `${t.lie ? 'LIE ' : 'TRUE'}  ${t.key} = ${t.value}  (from ${t.from})`);
  },
  // off MIN_PER_SEC, not off a hardcoded night: the night has been six real
  // minutes and twelve, and this has to follow it
  /** for headless invariant checks - is this world point walkable? */
  isWalkable,
  skipTo(min) { game.clock.t = min / MIN_PER_SEC; },
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
