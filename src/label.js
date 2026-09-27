// ---------------------------------------------------------------------------
// THE SCREEN BEFORE THE SCREEN
// ---------------------------------------------------------------------------
// The studio label, and it is not this game's: it is the one BATIDAO DE COCO
// opens on - a photograph of a compost heap with vermin crawling over it and
// SABOROSA on top - so the two games open the same way.  What it is not is the
// same *colours*.  The heap and everything crawling on it come in grey, and
// the label comes in the blood this game is made of.  Both are done to the art
// before it ships rather than in the browser; see preview/intro-prep.py.
//
// It is a sibling of the end card and of the title in shape: it owns its own
// clock, it draws itself, and it hands back one boolean when the shell should
// move on.  Nothing outside it knows how long a label is looked at.
//
// It comes before the title card rather than instead of it, and it leaves on
// its own - the title is where the game waits for you.  Making both wait would
// be two presses to reach a game that takes one.
// ---------------------------------------------------------------------------
import { VIEW_W, VIEW_H, LABEL } from './config.js';

const DIR = new URL('../assets/intro-screen/', import.meta.url).href;
const frames = [];
let logo = null;

/**
 * Fetch AND decode all four pictures, and resolve only when they are ready to
 * be stamped.  The decode matters as much as the fetch: the first drawImage of
 * an undecoded photograph decodes it there and then, on the main thread, and
 * on this screen that lands in the middle of the crawl.
 *
 * A picture that will not load is dropped rather than waited on - a label
 * screen is not worth failing to start over.
 */
export async function loadLabel() {
  if (!LABEL.on || frames.length) return;
  const get = async (file) => {
    const img = new Image();
    try {
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = () => rej(new Error(file));
        img.src = DIR + file;
      });
      if (img.decode) await img.decode();
      return img;
    } catch (e) {
      console.warn(`label: ${file} did not load`);
      return null;
    }
  };
  const got = await Promise.all(
    ['vermes-1.webp', 'vermes-2.webp', 'vermes-3.webp', 'logo.webp'].map(get));
  frames.push(...got.slice(0, 3).filter(Boolean));
  logo = got[3];
}

/** True once there is nothing left to show and the title should come up. */
export const labelDone = (t) => !LABEL.on || t >= LABEL.hold + LABEL.fadeOut;

/**
 * `t` is seconds the label has been up, and `pressed` is whether anything was
 * hit this frame.  Returns the time to carry into the next frame - a press
 * jumps it straight to the start of the leaving, and a press during the
 * leaving does nothing, because there is nothing left to skip.
 *
 * A press is not taken for the first LABEL.arm seconds. This is the first
 * screen of the session and a key still down from launching the game would
 * blow through it before it had drawn twice.
 */
export function advanceLabel(t, dt, pressed) {
  const next = t + dt;
  if (pressed && next >= LABEL.arm && next < LABEL.hold) return LABEL.hold;
  return next;
}

export function drawLabel(ctx, t) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // the crawl, on this screen's own clock - three photographs on a loop
  const f = frames.length
    ? frames[Math.floor(t / LABEL.frame) % frames.length] : null;
  ctx.imageSmoothingEnabled = true;
  if (f) ctx.drawImage(f, 0, 0, VIEW_W, VIEW_H);

  if (logo) {
    // width-driven, height follows: the label is wide and short, and sizing it
    // off the height would make it enormous the moment either number moved
    const dw = VIEW_W * LABEL.wide;
    const dh = dw * (logo.naturalHeight / logo.naturalWidth);
    ctx.drawImage(logo, VIEW_W / 2 - dw / 2, VIEW_H / 2 - dh / 2, dw, dh);
  }

  // Up out of black on the way in and back down on the way out.  This is the
  // one place in the game that fades: it is not an effect over the city, it is
  // a screen arriving, and cutting to a full-brightness photograph from black
  // reads as the page having jumped.
  if (t < LABEL.fadeIn) veil(ctx, 1 - t / LABEL.fadeIn);
  if (t >= LABEL.hold) veil(ctx, (t - LABEL.hold) / LABEL.fadeOut);
}

function veil(ctx, a) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, a);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.restore();
}
