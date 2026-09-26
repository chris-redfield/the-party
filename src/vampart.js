// ---------------------------------------------------------------------------
// THE VAMPIRE'S ARTWORK
// ---------------------------------------------------------------------------
// Everybody else in this city is drawn out of code (src/sprites.js).  He is
// not: he is a real drawing, and this is the file that puts it on the screen.
//
// `assets/vamp-frente e verso-01.png` is a sheet of eight, two columns by four
// rows.  Column 0 is his back, column 1 is his front; row 0 is standing still
// and rows 1, 2 and 3 are the walk.  The drawings face right, so walking left
// is the same frame flipped.
//
// Two things about the sheet decide how this file works:
//
//  - **The background is white and so is his face.**  Keying white out would
//    punch a hole through his head, so the transparency is flooded in from the
//    edge of each cell instead: white that can be reached from outside the
//    drawing goes, white enclosed by his outline stays.
//  - **The cells are not aligned to each other.**  Each drawing sits wherever
//    it sits, so every cell is trimmed to its own ink and stood on the
//    pavement by its own feet.  They are all scaled by the same amount, off
//    the tallest cell, so he does not change size between frames.
//
// Nothing here is generated into a file: the sheet stays the only copy of the
// art, and re-exporting it is all it takes to change him.
// ---------------------------------------------------------------------------

const SHEET = 'assets/vamp-frente%20e%20verso-01.png';
const COLS = 2, ROWS = 4;

// How tall he stands, in the same art pixels everybody else is measured in.
// The trick-or-treaters are 28 and he is a little over them - he is the one
// adult out here, and the cape needs the room.
export const VAMP_BOX = 33;

// A pixel this close to white, reachable from outside the drawing, is
// background.  The scan is generous because the sheet has soft edges.
const WHITE = 232;

let cells = null;          // [row][col] -> { cv, w, h } at native size
let unit = 0;              // native pixels per art pixel
const cache = new Map();

/**
 * Load the sheet and cut it up.  Nothing waits on this - until it lands the
 * player is drawn with the placeholder sprite, exactly as before.
 */
export async function loadVampArt() {
  try {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error(`${SHEET} did not load`));
      img.src = SHEET;
    });
    cut(img);
  } catch (e) {
    console.warn('vamp art:', e.message, '- falling back to the drawn sprite');
  }
}

export const vampArtReady = () => cells !== null;

function cut(img) {
  const cw = Math.floor(img.width / COLS), ch = Math.floor(img.height / ROWS);
  const work = document.createElement('canvas');
  work.width = cw; work.height = ch;
  const wctx = work.getContext('2d', { willReadFrequently: true });

  const grid = [];
  let tallest = 1;
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      wctx.clearRect(0, 0, cw, ch);
      wctx.drawImage(img, c * cw, r * ch, cw, ch, 0, 0, cw, ch);
      const cell = keyAndTrim(wctx, cw, ch);
      grid[r][c] = cell;
      if (cell && cell.h > tallest) tallest = cell.h;
    }
  }
  cells = grid;
  unit = tallest;                 // the tallest drawing is VAMP_BOX art pixels
}

/**
 * Flood the background away from the four edges, then trim to what is left.
 * A queue rather than recursion: a cell is most of a million pixels and the
 * stack does not survive that.
 */
function keyAndTrim(ctx, w, h) {
  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;
  const outside = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;

  const isBackground = (i) => {
    const o = i * 4;
    return d[o + 3] < 24 || (d[o] >= WHITE && d[o + 1] >= WHITE && d[o + 2] >= WHITE);
  };
  const push = (i) => {
    if (outside[i] || !isBackground(i)) return;
    outside[i] = 1;
    queue[tail++] = i;
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }

  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < w * h; i++) {
    if (outside[i]) { d[i * 4 + 3] = 0; continue; }
    if (d[i * 4 + 3] < 24) continue;
    const x = i % w, y = (i / w) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;

  ctx.putImageData(im, 0, 0);
  const tw = x1 - x0 + 1, th = y1 - y0 + 1;
  const cv = document.createElement('canvas');
  cv.width = tw; cv.height = th;
  cv.getContext('2d').drawImage(ctx.canvas, x0, y0, tw, th, 0, 0, tw, th);
  return { cv, w: tw, h: th };
}

/**
 * One frame, ready to stamp: `back` is which way he is facing, `frame` is -1
 * standing or 0..2 walking, `flip` mirrors him for walking left.  Scaled
 * copies are cached per zoom, because scaling a drawing every frame is not
 * free and there are only ever a handful of zooms.
 *
 * Returns null until the sheet has loaded, which is the caller's cue to draw
 * the placeholder instead.
 */
export function vampFrame(back, frame, flip, scale) {
  if (!cells) return null;
  const row = frame < 0 ? 0 : 1 + (frame % (ROWS - 1));
  const col = back ? 0 : 1;
  const cell = cells[row][col];
  if (!cell) return null;

  const key = `${row}|${col}|${flip ? 1 : 0}|${scale}`;
  let cv = cache.get(key);
  if (cv) return cv;

  // every cell is scaled by the same amount, so he keeps his proportions
  // between frames instead of stretching to fill a box
  const k = (VAMP_BOX * scale) / unit;
  const w = Math.max(1, Math.round(cell.w * k));
  const h = Math.max(1, Math.round(cell.h * k));
  cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  // a drawing, not pixel art: it wants a smooth reduction, and it is only
  // done once per zoom
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (flip) { ctx.translate(w, 0); ctx.scale(-1, 1); }
  ctx.drawImage(cell.cv, 0, 0, w, h);

  cv.anchorX = w / 2;      // he stands on the bottom centre of his own ink
  cv.anchorY = h;
  cache.set(key, cv);
  return cv;
}

export function clearVampCache() { cache.clear(); }
