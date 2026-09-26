// ---------------------------------------------------------------------------
// THE DRAWINGS
// ---------------------------------------------------------------------------
// Most of this city is drawn out of code (src/sprites.js).  The characters who
// are not - the vampire you play, the witches and the nosferatu you find
// standing on the pavement, and the child in the witch costume - are this
// file, which puts their artwork on the screen.
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

const VAMP_SHEET = 'assets/vamp-frente%20e%20verso-01.png';
const VAMP_COLS = 2, VAMP_ROWS = 4;

// One drawing, one pose, facing you.  That is all a monster needs: they stand
// on that pavement all night and never take a step.
const WITCH_SHEET = 'assets/party-witch-01.png';
const NOSFERATU_SHEET = 'assets/party-nosferatu-01.png';

// One of the children is a drawing as well.  `assets/party-child-001.png` is
// a column of three: the whole sheet is her walk, and the middle drawing
// stands square enough on both feet to be her idle too, so there is no fourth
// cell for standing still.
const CHILD_WITCH_SHEET = 'assets/party-child-001.png';

// And the cat.  Four drawings in a column: sitting, up on its feet, and two
// of the walk.  They all face left, so it is the cat walking right that is
// the mirrored one.
const CAT_SHEET = 'assets/party-cat-01.png';

// How tall he stands, in the same art pixels everybody else is measured in.
// The trick-or-treaters are 28 and he is a little over them - he is the one
// adult out here, and the cape needs the room.
export const VAMP_BOX = 33;
// The monsters you meet are drawn at a different size on their own sheets, so
// the box is what puts them in proportion to each other rather than in
// proportion to whatever the files happened to be exported at.
//
// A monster is not an adult the way the player is an adult - it is the thing
// the costume was pretending to be, and it wants to be the biggest figure on
// the pavement.  So the witch is written as what she is: a fifth taller than
// the vampire you play, off his box rather than off a number of her own, so
// changing his height keeps the pair in proportion.
export const WITCH_BOX = VAMP_BOX * 1.2;
// The nosferatu is not scaled up the way she is: he comes in a tenth under the
// vampire you play, close enough to read as one of your own kind rather than
// as one of hers, and short enough that he is not the one you look at first.
export const NOSFERATU_BOX = VAMP_BOX * 0.9;
// The child in the witch costume is the one size in here that is not a
// judgement call: it is what the coded kid she replaces already measures on
// the pavement, 16 x 24 art pixels from the tip of the hat to her shoes.  The
// drawing takes her height so that swapping her over changes who she is and
// not how big she is - a child who grew when the art landed would move every
// crowd she stands in.
export const CHILD_WITCH_BOX = 24;
// The cat is the one of these that is deliberately not the size of the sprite
// it replaces.  The coded cat measures 14 x 12 art pixels and the drawing was
// matched to it at first, which made a correct-looking cat that nobody would
// ever notice; asked for, and wanted, is an animal with some presence on the
// pavement, so it is a round 40% over that.  The box is its walk, the tallest
// thing on the sheet, which leaves it sitting a little lower than it stands,
// as a cat does.
export const CAT_BOX = 12 * 1.4;

// A pixel this close to white, reachable from outside the drawing, is
// background.  The scan is generous because the sheet has soft edges.
const WHITE = 232;

// one entry per sheet: the cut-up cells, and the native height that stands for
// a full box, so every cell of a sheet is scaled by the same amount
const sheets = {};
const cache = new Map();

/**
 * Load the sheet and cut it up.  Nothing waits on this - until it lands the
 * player is drawn with the placeholder sprite, exactly as before.
 */
export async function loadArtwork() {
  await Promise.all([
    sheet('vamp', VAMP_SHEET, VAMP_COLS, VAMP_ROWS),
    sheet('witch', WITCH_SHEET, 1, 1),
    sheet('nosferatu', NOSFERATU_SHEET, 1, 1),
    sheet('childWitch', CHILD_WITCH_SHEET, 1, 3),
    sheet('cat', CAT_SHEET, 1, 4),
  ]);
}

async function sheet(name, url, cols, rows) {
  try {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error(`${url} did not load`));
      img.src = url;
    });
    sheets[name] = cut(img, cols, rows);
  } catch (e) {
    console.warn(`artwork: ${e.message} - falling back to the drawn sprite`);
  }
}

export const vampArtReady = () => !!sheets.vamp;
export const witchArtReady = () => !!sheets.witch;
export const nosferatuArtReady = () => !!sheets.nosferatu;
export const childWitchArtReady = () => !!sheets.childWitch;
export const catArtReady = () => !!sheets.cat;

function cut(img, COLS, ROWS) {
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
  // The tallest drawing on a sheet is one whole box and the rest keep their
  // size relative to it, so nothing stretches between frames.  The extents
  // either side of each drawing's registration point are what let every frame
  // share one canvas - see scaled().
  let left = 0, right = 0;
  for (const row of grid) for (const cell of row) {
    if (!cell) continue;
    left = Math.max(left, cell.cx);
    right = Math.max(right, cell.w - cell.cx);
  }
  return { grid, unit: tallest, left, right };
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

  // Where the *body* is, which is not the middle of the box.  In a stride the
  // legs reach out to one side and take the bounding box with them, so a
  // frame centred on its box swings the whole character sideways every step -
  // the head lurches, the legs stay put, and it reads as a shake.  The head
  // is the part that should hold still: it is drawn in the same place in
  // every frame of the sheet (to a third of a pixel), so the top of the
  // figure is what each frame is registered on.
  let sum = 0, n = 0;
  const headRows = Math.max(1, Math.round(th * 0.28));
  for (let y = y0; y < y0 + headRows; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!outside[y * w + x] && d[(y * w + x) * 4 + 3] >= 24) { sum += x - x0; n++; }
    }
  }
  const cx = n ? sum / n : tw / 2;

  const cv = document.createElement('canvas');
  cv.width = tw; cv.height = th;
  cv.getContext('2d').drawImage(ctx.canvas, x0, y0, tw, th, 0, 0, tw, th);
  return { cv, w: tw, h: th, cx };
}

/**
 * One frame, ready to stamp: `back` is which way he is facing, `frame` counts
 * up while he walks (-1 when he is standing), and `flip` mirrors him for
 * walking left.
 *
 * The walk is the sheet's own rows, in the order the sheet lays them out:
 * row 0 is him standing still and rows 1, 2 and 3 are the three beats of the
 * cycle. Nothing is mirrored to make a pose and nothing is skipped or
 * re-ordered - the mirror is only ever for facing left.
 */
const WALK_ROWS = [1, 2, 3];

export function vampFrame(back, frame, flip, scale) {
  const sh = sheets.vamp;
  if (!sh) return null;
  const row = frame < 0 ? 0 : WALK_ROWS[frame % WALK_ROWS.length];
  const col = back ? 0 : 1;
  const cell = sh.grid[row][col];
  if (!cell) return null;
  return scaled(`vamp|${row}|${col}`, cell, sh, VAMP_BOX, flip, scale);
}

/** The witch, standing there. One pose, and she never needs another. */
export function witchArt(scale) { return still('witch', WITCH_BOX, scale); }

/** The other monster on the pavement, drawn the same way and just as still. */
export function nosferatuArt(scale) { return still('nosferatu', NOSFERATU_BOX, scale); }

// Her walk is the sheet, top to bottom, and the middle drawing doubles as the
// idle.  It is driven off the child's own animation clock rather than off the
// `frame` the coded sprite uses, because that frame only ever counts 0, 1 -
// it was written for a two-pose walk - and reading it would cost her the
// third drawing.  Same cadence the coded walk runs at, so a street of children
// still steps together.
const CHILD_WALK = [0, 1, 2];
const CHILD_IDLE = 1;
const CHILD_RATE = 6;                   // beats a second, as in updateKid()

export function childWitchFrame(frame, anim, scale) {
  const sh = sheets.childWitch;
  if (!sh) return null;
  const row = frame < 0 ? CHILD_IDLE
    : CHILD_WALK[Math.floor((anim || 0) * CHILD_RATE) % CHILD_WALK.length];
  const cell = sh.grid[row][0];
  if (!cell) return null;
  return scaled(`childWitch|${row}`, cell, sh, CHILD_WITCH_BOX, false, scale);
}

// Which drawing the cat is standing in.  `pose` is the animal's own state -
// see updateCat() - and `step` counts strides rather than seconds, so the
// walk is paced by the ground it covers.
const CAT_SIT = 0, CAT_STAND = 1, CAT_WALK = [2, 3];

export function catArt(pose, step, faceLeft, scale) {
  const sh = sheets.cat;
  if (!sh) return null;
  const row = pose === 'sit' ? CAT_SIT
    : pose === 'stand' ? CAT_STAND
    : CAT_WALK[Math.floor(step || 0) % CAT_WALK.length];
  const cell = sh.grid[row][0];
  if (!cell) return null;
  return scaled(`cat|${row}`, cell, sh, CAT_BOX, !faceLeft, scale);
}

function still(name, box, scale) {
  const sh = sheets[name];
  if (!sh) return null;
  const cell = sh.grid[0][0];
  if (!cell) return null;
  return scaled(name, cell, sh, box, false, scale);
}

/**
 * A cell at the size it will actually be stamped at.
 *
 * **Every frame of a sheet gets the same canvas and the same anchors.** That
 * is the whole point of this function and it is what stops him shaking. Sized
 * individually, one pose comes out 149 pixels tall and the next 148 - a real
 * quarter-pixel difference in the drawings, rounded up to a whole one - and
 * because he is anchored at the feet, his head jumps a pixel every step. The
 * legs are supposed to move; nothing else is.
 *
 * So the canvas is the sheet's own extents, each drawing is placed inside it
 * at a fractional offset from the shared anchor, and the sub-pixel difference
 * between poses stays sub-pixel instead of being rounded into a twitch. The
 * anchors are whole numbers, so the position it is stamped at is the only
 * thing that decides where it lands.
 *
 * Cached per zoom: scaling a drawing every frame is not free, and there are
 * only ever a handful of zooms.
 */
function scaled(key, cell, sh, box, flip, scale) {
  const k = `${key}|${flip ? 1 : 0}|${scale}`;
  let cv = cache.get(k);
  if (cv) return cv;

  const f = (box * scale) / sh.unit;
  const ax = Math.round(sh.left * f) + 1;                 // shared anchor, whole pixels
  const W = ax + Math.ceil(sh.right * f) + 1;
  const H = Math.ceil(sh.unit * f) + 2;
  const feet = H - 1;

  cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  // a drawing, not pixel art: it wants a smooth reduction, done once per zoom
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  // fractional on purpose - this is where the difference between poses lives
  ctx.drawImage(cell.cv, ax - cell.cx * f, feet - cell.h * f,
                cell.w * f, cell.h * f);

  cv.anchorX = flip ? W - ax : ax;
  cv.anchorY = feet;
  cache.set(k, cv);
  return cv;
}

export function clearArtCache() { cache.clear(); }
