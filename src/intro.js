// ---------------------------------------------------------------------------
// THE NIGHT BEFORE THE NIGHT
// ---------------------------------------------------------------------------
// Twenty-two drawings played once: the vampire against a red sky, the clouds
// going over, the moon coming up, and the whole thing draining down to black -
// which is the frame it ends on, so it does not need an exit.  It hands
// straight to the street.
//
// It is played on a black bed and fitted by its width.  The drawings are
// 1798 x 858, which is wider than the screen is, so fitting them by height
// would cut the sides off a composition somebody framed; fitting by width
// leaves a band top and bottom, and the band is the bed.
//
// It plays `assets/intro-frames/`, not the drawings themselves: those are
// 1798 x 858 and the canvas is 1280 wide, so better than half of every one of
// them is thrown away on the way to the screen - 4.2 MB of PNG to draw 1.0 MB
// of picture, and every byte of it decoded before the intro may start, which
// is a black screen where an animation should be.  preview/intro-prep.py fits
// them to the width and writes them as webp: 343 kB for the lot.  It also
// renumbers them, because the drawings are 01-11 and 13-23 with no 12, and a
// gap in a sequence is a thing every reader of it has to know about.
// ---------------------------------------------------------------------------
import { VIEW_W, VIEW_H, INTRO } from './config.js';
import { drawSpeech } from './hud.js';

const DIR = new URL('../assets/intro-frames/', import.meta.url).href;
const FILES = Array.from({ length: INTRO.frames },
  (_, i) => `intro-${String(i + 1).padStart(2, '0')}.webp`);

const frames = [];
let ok = false, waited = 0, gaveUp = false, rushed = false;

/**
 * Four megabytes of drawings, fetched AND decoded before any of them is
 * wanted.  Started when the front door comes up rather than at launch: nothing
 * needs them until somebody chooses to play, and by then they have had the
 * whole of the menu to arrive.
 */
export async function loadIntro() {
  if (!INTRO.on || frames.length) return;
  const got = await Promise.all(FILES.map(async (file) => {
    const img = new Image();
    try {
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = () => rej(new Error(file));
        img.src = DIR + file;
      });
      // Its own catch: decode() is an optimisation - it moves the cost off the
      // first drawImage - and a decode that rejects is NOT a picture that
      // failed to load.  Letting it fall into the catch below threw away 22
      // perfectly good frames and left the intro on a black screen.
      if (img.decode) { try { await img.decode(); } catch (e) { /* drawable anyway */ } }
      return img;
    } catch (e) {
      console.warn(`intro: ${file} did not load`);
      return null;
    }
  }));
  frames.push(...got.filter(Boolean));
  ok = frames.length > 0;
}

export const introReady = () => ok;
// The drawings and the line are not the same length and are not meant to be
// tied to each other: whichever wants longer decides, so a faster intro still
// leaves the line up to be read and a slower one is not cut short by it.
/** How much of the line has arrived by `t`. */
const typed = (t) => Math.floor(t * INTRO.cps);

export const introLength = () => Math.max(frames.length * INTRO.frame, INTRO.read);

/** True once there is nothing left to play and the night should begin. */
export const introDone = (t) => !INTRO.on || gaveUp || t >= introLength();

/**
 * `t` is seconds into the intro.  It does not start until the drawings are in:
 * the bed is black and so is a screen with nothing on it yet, so waiting looks
 * like nothing rather than like a stutter - which is the whole lesson of the
 * studio label.  If they never arrive, it gives up and the night starts.
 */
export function advanceIntro(t, dt, pressed) {
  if (!ok) {
    waited += dt;
    if (waited > INTRO.giveUp) gaveUp = true;
    return t;
  }
  const next = t + dt;
  // As on the label, a press is not taken from the first frame - a key still
  // held from the menu would take the intro away before it had drawn twice.
  //
  // And the first press does not take it away at all: it finishes the line.
  // That is the convention the box is borrowed from, and it is the right one -
  // somebody hitting a key at a wall of text that is still arriving wants the
  // rest of the sentence, not to lose it.  The second press leaves.
  if (pressed && next >= INTRO.arm) {
    if (!rushed && typed(next) < INTRO.line.length) { rushed = true; return next; }
    return introLength();
  }
  return next;
}

/** Back to the top, for PARTY.intro() - and for a second night, if it ever
 *  wanted one. */
export function rewindIntro() { waited = 0; gaveUp = false; rushed = false; }

export function drawIntro(ctx, t) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (!ok) return;

  const f = frames[Math.min(frames.length - 1, Math.floor(t / INTRO.frame))];
  const w = VIEW_W;
  const h = Math.round(w * (f.naturalHeight / f.naturalWidth));
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(f, 0, Math.round((VIEW_H - h) / 2), w, h);

  // The line is up from the first frame - it is what the drawings are there to
  // sit behind - and the way out of it only offers itself once it is armed.
  const shown = rushed ? INTRO.line.length : typed(t);
  drawSpeech(ctx, INTRO.name, INTRO.line,
             t < INTRO.arm ? ''
               : shown < INTRO.line.length ? 'ENTER / SPACE for the rest of it'
               : 'ENTER / SPACE to skip',
             null, shown);
}
