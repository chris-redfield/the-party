// ---------------------------------------------------------------------------
// THE PARTY
// ---------------------------------------------------------------------------
// You find the door, you knock, and the night ends on what was behind it: a
// room of bats, hanging in a row and swaying, cut out of the same blood the
// card has always been.  It is footage, not drawing - but it is flattened to
// four flat tones off the end card's red and dropped onto the game's own art
// pixel, so it comes out as poster art rather than as a video playing in a
// window.  The banding was decided once over the whole clip, never per frame,
// or the tones crawl about and the picture boils.
//
// `assets/bats-win.png` is a strip of WIN_BATS_N frames laid out left to right
// and wrapped every WIN_BATS_COLS.  Nothing here allocates per frame and the
// sheet is one drawImage, so the card costs about what the flat fill did.
// ---------------------------------------------------------------------------
import {
  VIEW_W, VIEW_H, WIN_BATS, WIN_BATS_FPS,
  WIN_BATS_W, WIN_BATS_H, WIN_BATS_N, WIN_BATS_COLS,
} from './config.js';

const SRC = 'assets/bats-win.png';
let sheet = null, ok = false;

export function loadBats() {
  if (!WIN_BATS || sheet) return;
  sheet = new Image();
  sheet.onload = () => { ok = true; };
  sheet.onerror = () => { ok = false; };     // no sheet, no bats: the card
  sheet.src = SRC;                            // falls back to flat red
}

export const batsReady = () => ok;

// The art pixel is PX x zoom = 3 screen pixels, and the sheet is cut to it, so
// this is a whole-number blow-up and the blocks stay square.  426 x 3 is two
// short of the screen, which is why it starts one pixel in rather than at the
// edge - the alternative is a fractional scale and shimmering block edges.
const SCALE = Math.floor(VIEW_H / WIN_BATS_H);           // 3
const OFF_X = Math.floor((VIEW_W - WIN_BATS_W * SCALE) / 2);

/** Paint the room behind the card.  `t` is seconds since it ended. */
export function drawBats(ctx, t) {
  if (!ok) return false;
  const f = Math.floor(t * WIN_BATS_FPS) % WIN_BATS_N;
  const sx = (f % WIN_BATS_COLS) * WIN_BATS_W;
  const sy = Math.floor(f / WIN_BATS_COLS) * WIN_BATS_H;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, sx, sy, WIN_BATS_W, WIN_BATS_H,
                OFF_X, 0, WIN_BATS_W * SCALE, WIN_BATS_H * SCALE);
  return true;
}
