import { VIEW_W, VIEW_H, ZOOMS, DEFAULT_ZOOM, VISION_SECONDS, MIN_PER_SEC, INK, CHALICE, GLASS, SCROLL, BACK_WINDOWS, SKYLIGHTS, END, MENU, MENU_POP, INTRO } from './config.js';
import { resetInk, inkShapeCount } from './ink.js';
import { makeInput } from './input.js';
import { hashSeed } from './rng.js';
import { newGame, updateGame, knock, bringTipForward, giveTip } from './game.js';
import { isWalkable } from './city.js';
import { FACT_KEYS } from './hints.js';
import { makeCamera, updateCamera, drawScene, drawBleed, setWorldLattice } from './render.js';
import { drawHud, drawTitle, drawMenu, drawCredits, drawEnd, drawPause, cardAt, tipVotes } from './hud.js';
import { resumeAudio, toggleMute, setBassProximity, setMusicPaused, restartMusic } from './audio.js';
import { loadDeathFonts } from './deathtype.js';
import { loadBats } from './bats.js';
import { loadLabel, advanceLabel, drawLabel, labelDone } from './label.js';
import { loadIntro, advanceIntro, drawIntro, introDone, rewindIntro, introReady } from './intro.js';
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

// ---------------------------------------------------------------------------
// NOTHING MOVES UNTIL EVERYTHING IS READY
// ---------------------------------------------------------------------------
// These used to be fired off and forgotten, on the argument that until they
// land the game draws placeholders and nothing is hurt by waiting.  That was
// true while the first screen was a static title card.  It stopped being true
// the moment the first screen became a photograph with vermin crawling over
// it: cutting the character sheets reads every one of 34 million pixels, twice
// over, and that landed a second or so in - which is the middle of the
// fade-in.  Half a second of frozen animation reads as a broken game.
//
// So the loading is done FIRST, against a black screen, where a stopped main
// thread looks like nothing at all, and the label starts on the frame it is
// all finished.  The typeface is in here because the title card behind the
// label waits on it anyway.
//
// The one thing NOT waited on is the ending's clip - two megabytes wanted
// minutes from now at the earliest - which is started once the label is gone.
let ready = false;
Promise.race([
  Promise.all([loadLabel(), loadArtwork(), loadDeathFonts()]),
  // a floor under it, so a sulking asset server cannot hold the game on a
  // black screen: every one of those falls back on its own anyway
  new Promise(r => setTimeout(r, 8000)),
]).then(() => {
  ready = true;
  // four megabytes of drawings, wanted at the next screen but one: the menu
  // is the whole time they have to arrive, and they are not waited on here
  loadIntro();
});

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
// the layout seed is fixed in config.js; this is the override for cutting a
// different city to look at
const cityParam = params.get('citySeed');
const citySeed = cityParam == null ? undefined : (hashSeed(cityParam) >>> 0);
let game = newGame(seedParam || undefined, citySeed);
let zoomIdx = DEFAULT_ZOOM;
let paused = false;
// Seconds the studio label has been up.  `?label=0` starts past it, which is
// what dev-harness.html and any scripted run want: the label swallows the
// first press, so a recipe that taps Enter to start the night would otherwise
// spend that press skipping a label and then sit on the title card.
let batsStarted = false;
let menuIdx = 0;                   // which way in is lit on the front door
let menuPop = null;                // seconds since one was chosen, or null
let introT = 0;                    // seconds into the drawn intro
let labelT = new URLSearchParams(location.search).get('label') === '0' ? 1e9 : 0;
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

/**
 * Walking out of a night, from the pause card.  Not a restart: it lands on the
 * front door instead of back in the street.
 *
 * The fresh night HAS to be built here rather than on the way back in, because
 * `beginNight` only rewinds the intro - it does not build a world.  Without
 * this the next START GAME would hand the player back the very night they just
 * left, clock, candy and all.
 *
 * The soundtrack is deliberately NOT stopped.  It has been playing since the
 * first keypress, over the front door as much as over the street, so the title
 * card is a place it belongs - the end of a night fades it out because that
 * ends on a card of its own, and this does not.  The one thing to undo is the
 * pause card's own pause, or the music would be left stopped with nothing on
 * the way back in to start it again.
 */
function toTitle() {
  game = newGame(seedParam || undefined, citySeed);
  game.state = 'title';
  cam.x = game.player.x;
  cam.y = game.player.y;
  paused = false;
  setMusicPaused(false);
  menuIdx = 0;
  menuPop = null;
}

/**
 * Close the game.  Reachable only where it can work - EXIT is in the menu only
 * when CAN_QUIT (see src/config.js).  `window.close()` shuts the shell's one
 * window and its `window-all-closed` handler quits the app from there, so the
 * page needs no IPC and no privileges and stays sandboxed.  Verified against
 * the real shell: a sandboxed, context-isolated, node-less renderer closes it
 * and Electron exits 0.
 */
function quitGame() {
  window.close();
}

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;          // a backgrounded tab should not cost you the night

  // Black, and still, until the art is in.  See above: this is the one place
  // in the run where the main thread is allowed to stop.
  if (!ready) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    input.endFrame();
    requestAnimationFrame(frame);
    return;
  }

  // The label comes before everything, including the title card, and it is not
  // part of the game object: a restart goes back to a fresh night, not back to
  // the studio's name.
  if (!labelDone(labelT)) {
    labelT = advanceLabel(labelT, dt, input.pressed('start') || input.pressed('bat'));
    drawLabel(ctx, labelT);
    input.endFrame();
    requestAnimationFrame(frame);
    return;
  }
  // the label is over: now the ending's clip can have the network to itself
  if (!batsStarted) { batsStarted = true; loadBats(); }

  if (input.pressed('mute')) toggleMute();
  if (input.pressed('zoomIn') && zoomIdx < ZOOMS.length - 1) cam.z = ZOOMS[++zoomIdx];
  if (input.pressed('zoomOut') && zoomIdx > 0) cam.z = ZOOMS[--zoomIdx];

  if (game.state === 'title') {
    // The front door.  Three ways in, and the two that are not the game open a
    // card that comes straight back here - there is nowhere else to go from
    // them, so ENTER and BACKSPACE both mean back.
    setBassProximity(0);
    // The cursor moves freely right up until something is chosen; after that
    // the line is committed and the screen is only waiting for its punch to
    // finish.  A second press in that window does nothing - it is not a queue.
    if (menuPop == null) {
      if (input.pressed('up')) menuIdx = (menuIdx + MENU.length - 1) % MENU.length;
      if (input.pressed('down')) menuIdx = (menuIdx + 1) % MENU.length;
      if (input.pressed('start') || input.pressed('bat')) {
        menuPop = 0;
        if (MENU[menuIdx][1] === 'play') resumeAudio();   // on the press, not after it
      }
    } else {
      menuPop += dt;
      if (menuPop >= MENU_POP.hold) {
        const to = MENU[menuIdx][1];
        menuPop = null;
        // EXIT is the one choice that does not lead to a screen
        if (to === 'exit') quitGame();
        else game.state = to === 'play' ? beginNight() : to;
      }
    }
    drawMenu(ctx, menuIdx, now / 1000, menuPop);
  } else if (game.state === 'howto') {
    // The red card the game used to open on.  ENTER still starts the night
    // from here, because that is what it has always done on this card.
    setBassProximity(0);
    if (input.pressed('start') || input.pressed('bat')) { resumeAudio(); game.state = beginNight(); }
    if (input.pressed('back')) game.state = 'title';
    drawTitle(ctx, now / 1000);
  } else if (game.state === 'credits') {
    setBassProximity(0);
    if (input.pressed('start') || input.pressed('bat') || input.pressed('back')) {
      game.state = 'title';
    }
    drawCredits(ctx, now / 1000);
  } else if (game.state === 'intro') {
    // The drawn intro, which is not the game: the clock does not run, nothing
    // is simulated, and it ends on its own last frame - which is black, so it
    // hands to the street without needing anything between them.
    setBassProximity(0);
    introT = advanceIntro(introT, dt, input.pressed('start') || input.pressed('bat'));
    drawIntro(ctx, introT);
    if (introDone(introT)) game.state = 'play';
  } else if (game.state === 'win' || game.state === 'lose') {
    setBassProximity(game.state === 'win' ? 0.9 : 0);
    updateCamera(cam, game.player, dt);
    drawScene(ctx, cam, game);
    // the card runs off its own clock, not the page's: the bats have to start
    // at their first frame and the phrase has to land a beat after them
    game.endT += dt;
    drawEnd(ctx, game, game.endT);
    if (input.pressed('start')) restart();
  } else {
    // Enter is `start` everywhere else and the pause toggle here; see the note
    // in src/input.js for why it is read off `start` rather than bound twice.
    if (input.pressed('start')) { paused = !paused; setMusicPaused(paused); }
    if (input.pressed('restart') && input.held('start')) restart();
    // Backspace is `back`, and the note in src/input.js has it existing only
    // where there is somewhere to go back TO - which on the pause card there
    // now is.  ENTER cannot be the one that leaves: it is already the way back
    // into the street, and that is the collision input.js refuses to have.
    // Read only while PAUSED, so a stray Backspace out in the street can never
    // throw a night away.  It returns before drawing, or the fresh night's
    // street would flash up for a frame on the way to the front door.
    if (paused && input.pressed('back')) {
      toTitle();
      input.endFrame();
      requestAnimationFrame(frame);
      return;
    }
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

/** Choosing to play does not start the night, it starts the drawing of it. */
function beginNight() {
  if (!INTRO.on) return 'play';
  introT = 0;
  rewindIntro();
  return 'intro';
}

// A small hatch for tinkering from the browser console.
window.PARTY = {
  get game() { return game; },
  /** seconds the studio label has been up, for checking it headlessly */
  get label() { return labelT; },
  /** false while the art is still being cut and nothing is allowed to move */
  get ready() { return ready; },
  /** light a way in, and pin its punch part way through, for looking at it */
  menu(i = 0, pop = null) { menuIdx = i; menuPop = pop; },
  /** are the intro's drawings in yet? */
  get introLoaded() { return introReady(); },
  /** pin the intro part way through, for looking at one drawing */
  introAt(sec) { game.state = 'intro'; introT = sec; },
  /** replay the intro, optionally at a different rate - PARTY.intro(6) */
  intro(fps) {
    if (fps) INTRO.frame = 1 / fps;
    game.state = beginNight();
    return `${(1 / INTRO.frame).toFixed(1)} a second, ${(22 * INTRO.frame).toFixed(1)} s in all`;
  },
  get cam() { return cam; },
  /**
   * A/B for the drawn line on the buildings.  `PARTY.ink(false)` puts the old
   * crisp textured city straight back; `PARTY.ink(true)` returns.  Pass an
   * object to turn one dial without a reload - `PARTY.ink({weight: 3.2})`,
   * `PARTY.ink({wobble: 0})` for a heavy but true line, `PARTY.ink({grit: 1})`
   * to put the old surface noise back under the ink.
   */
  ink(v) {
    if (typeof v === 'boolean') INK.on = v;
    else if (v && typeof v === 'object') Object.assign(INK, v);
    resetInk();          // the wobbles are cached per edge; the dials moved
    return { ...INK };
  },
  /** distinct drawn-edge shapes rolled so far - see inkShapeCount in ink.js */
  inkShapes: inkShapeCount,
  /**
   * The drink in the two chalices.  `PARTY.chalice({rest: 3})` for a livelier
   * surface, `{slosh: 0}` to stop a hit throwing it about, `{rest: 0}` for a
   * dead flat top - worth seeing once, it is the old bar wearing a glass.
   */
  chalice(v) { if (v) Object.assign(CHALICE, v); return { ...CHALICE }; },
  /**
   * A/B for the hourglass.  `PARTY.glass(false)` puts the old flat pixel-art
   * clock back, `PARTY.glass(true)` returns to the drawn one, and an object
   * turns one of the line's dials - `PARTY.glass({wobble: 2.5})` for a
   * shakier hand, `{over: 0}` to stop the corners running past each other.
   * Evaluation furniture; the loser of the two comes out.
   */
  glass(v) {
    if (typeof v === 'boolean') GLASS.ink = v;
    else if (v && typeof v === 'object') Object.assign(GLASS, v);
    return { ...GLASS };
  },
  /**
   * A/B for the row of windows that used to lie on the back building's roof.
   * `PARTY.backWindows(true)` puts them back where they were, for one look at
   * why they had to go.  Nothing else moves: the roll behind them is still
   * made either way, so no other window in the city changes.
   */
  /**
   * The map's scroll.  `{turn}` is how much of the stock art's shadow survives
   * where the paper rolls up - 0 is flat paper and the drawn edge alone, 1 is
   * the reference's own wedge.  `{mapShift}` slides the city on the sheet, in
   * px, positive to the right.
   */
  scroll(v) { if (v) Object.assign(SCROLL, v); return { ...SCROLL }; },
  backWindows(on) { BACK_WINDOWS.on = !!on; return BACK_WINDOWS.on; },
  /**
   * A/B for the glass in the roofs.  `PARTY.skylights(true)` puts them back.
   * Same deal as `backWindows`: the rolls behind them are spent either way,
   * so turning it moves nothing else in the city.
   */
  skylights(on) { SKYLIGHTS.on = !!on; return SKYLIGHTS.on; },
  /** A/B for the rounding rule the people are drawn on - evaluation only. */
  worldLattice(on) { setWorldLattice(on); return on ? 'people on the street lattice' : 'people on the camera lattice (the old rule)'; },
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
  /** the ending's live dials - preview/ending.html turns these too */
  END,
  win() { knock(game, game.city.party); },
  /** ms a frame of city costs - the scenery is the expensive half. */
  bench(n = 40) {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) drawScene(ctx, cam, game);
    return `${((performance.now() - t0) / n).toFixed(2)} ms/frame @ z${cam.z}`;
  },
};

requestAnimationFrame(frame);
