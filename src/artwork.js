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

// The children.  All of them: there is no such thing as a coded child on that
// pavement any more, only a drawn one and the placeholder that stands in for
// it until the sheets land.
//
// Every sheet reads the same way.  Across is one child per column, down is
// three drawings of its walk, and the middle drawing stands square enough on
// both feet to be the idle as well - so there is no fourth cell for standing
// still, on any of them.  The witch was the first and has a sheet to herself;
// the other fourteen came later, nine on one sheet and five on the next, and
// nothing in here knows or cares which sheet a child came off.  Drop another
// sheet in this list and those children join the crowd.
const CHILD_SHEETS = [
  ['witch', 'assets/party-child-001.png'],
  ['kids1', 'assets/party-kids-01.png'],
  ['kids2', 'assets/party-kids-02.png'],
];

// And the cat.  Four drawings in a column: sitting, up on its feet, and two
// of the walk.  They all face left, so it is the cat walking right that is
// the mirrored one.
const CAT_SHEET = 'assets/party-cat-01.png';

// The pumpkins standing in the street - the ones you walk into, not the one
// hung by a door, which is a clue and is still drawn out of code.
//
// The sheet is a grid of drawings with space around them: down is one
// variation per row, and across is the two ways of seeing the same pumpkin -
// the left column is the ordinary gourd, the right is what it turns out to
// have been all along.  Neither the rows nor the columns are on a pitch, so
// it is cut the way the beasts are, by looking for the empty rows and empty
// columns, in both directions.  Add a fifth row and a fifth pumpkin joins the
// street without a line of code changing.
const PUMPKIN_SHEET = 'assets/pumpkins.png';

// And the things that follow the children about.  Four of them, one under the
// other, and they are the one sheet in here that is not on a grid: they are
// different animals at different sizes, so the cells are found by looking for
// the empty rows between them rather than by dividing the sheet up.  They face
// left like the cat.
const BEAST_SHEET = 'assets/party-shadow%20beasts-01.png';

// How tall he stands, in the same art pixels everybody else is measured in.
// The trick-or-treaters are 28 and he is a little over them - he is the one
// adult out here, and the cape needs the room.
export const VAMP_BOX = 33;
// A street pumpkin, in the same art pixels.  It is not a judgement call
// either: it is the height the coded one stands at, which is 1.64 x PUMPKIN_R
// in world pixels over PX of them per art pixel - so the drawing arrives the
// size the thing you walk into already was, and the collision radius in
// config.js still means what it says.
export const PUMPKIN_BOX = 17;
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
// The one number the whole crowd is sized off, and it is not a judgement
// call: it is what the coded witch-costume kid measured on the pavement, 24
// art pixels from the tip of her hat to her shoes, and she is the tallest
// child drawn.
//
// **It is not a height every child is forced to.**  Every child on every
// sheet is drawn at the same scale as every other, so one factor takes all of
// them from sheet pixels to art pixels - the witch lands on exactly the 24
// she has always been, and the rest come out wherever their own drawings put
// them.  That is the point: a ghost that is drawn shorter than a dinosaur is
// shorter than the dinosaur on the street, and the witch keeps the extra that
// her hat is worth.  Forcing them all to one height would flatten out the
// only size information the sheets carry.
export const CHILD_BOX = 24;
// The cat is the one of these that is deliberately not the size of the sprite
// it replaces.  The coded cat measures 14 x 12 art pixels and the drawing was
// matched to it at first, which made a correct-looking cat that nobody would
// ever notice; asked for, and wanted, is an animal with some presence on the
// pavement, so it is a round 40% over that.  The box is its walk, the tallest
// thing on the sheet, which leaves it sitting a little lower than it stands,
// as a cat does.
export const CAT_BOX = 12 * 1.4;
// The tallest beast on the sheet, and the rest keep their size against it -
// the sheet is drawn with a big one and three smaller ones and that is worth
// keeping.  At 30 the tall one stands just under the vampire and the little
// ones come up to a child's shoulder, which is the height at which a thing
// following a child looks like it is following the child.
export const BEAST_BOX = 30;

// A pixel this close to white, reachable from outside the drawing, is
// background.  The scan is generous because the sheet has soft edges.
const WHITE = 232;

// one entry per sheet: the cut-up cells, and the native height that stands for
// a full box, so every cell of a sheet is scaled by the same amount
const sheets = {};
const cache = new Map();
// every drawn child in the city, in one flat list, and the scale they all
// share - art pixels per pixel of sheet.  See adoptChildren().
let children = [];
let childPx = 0;

/**
 * Load the sheet and cut it up.  Nothing waits on this - until it lands the
 * player is drawn with the placeholder sprite, exactly as before.
 */
export async function loadArtwork() {
  await Promise.all([
    sheet('vamp', VAMP_SHEET, VAMP_COLS, VAMP_ROWS),
    sheet('witch', WITCH_SHEET, 1, 1),
    sheet('nosferatu', NOSFERATU_SHEET, 1, 1),
    Promise.all(CHILD_SHEETS.map(([key, url]) => childSheet(key, url)))
      .then(adoptChildren),
    sheet('cat', CAT_SHEET, 1, 4),
    sheet('beast', BEAST_SHEET),          // no grid: cut at the empty rows
    sheet('pumpkin', PUMPKIN_SHEET, 'bands'),   // ... and at the empty columns
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
    sheets[name] = cols === 'bands' ? cutGrid(img)
      : cols ? cut(img, cols, rows) : cutBands(img);
  } catch (e) {
    console.warn(`artwork: ${e.message} - falling back to the drawn sprite`);
  }
}

/**
 * A sheet of children.  One column is one child, and what comes back is one
 * entry per child rather than one per sheet: after this nothing cares which
 * sheet anybody came off, which is what lets a new sheet be a new line in
 * CHILD_SHEETS and nothing else.
 */
async function childSheet(key, url) {
  try {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error(`${url} did not load`));
      img.src = url;
    });
    return cutChildren(img, key);
  } catch (e) {
    console.warn(`artwork: ${e.message} - those children keep the placeholder`);
    return [];
  }
}

/**
 * Take the lot of them as one crowd, and work out the one scale they are all
 * drawn at.  It is anchored on the witch, because her height is the one that
 * was agreed and the rest are drawn against her; if her sheet is the one that
 * failed, the tallest child standing takes her place, which keeps the crowd
 * the size it should be rather than shrinking it around a missing drawing.
 */
function adoptChildren(sets) {
  children = sets.flat();
  if (!children.length) return;
  const witch = children.find(c => c.key.startsWith('witch'));
  const ref = witch ? witch.unit : Math.max(...children.map(c => c.unit));
  childPx = CHILD_BOX / ref;
}

export const vampArtReady = () => !!sheets.vamp;
export const witchArtReady = () => !!sheets.witch;
export const nosferatuArtReady = () => !!sheets.nosferatu;
export const childArtReady = () => children.length > 0;
export const childArtCount = () => children.length;
export const catArtReady = () => !!sheets.cat;

function cut(img, COLS, ROWS) {
  const cw = Math.floor(img.width / COLS), ch = Math.floor(img.height / ROWS);
  const rects = [];
  for (let r = 0; r < ROWS; r++) {
    rects[r] = [];
    for (let c = 0; c < COLS; c++) rects[r][c] = { x: c * cw, y: r * ch, w: cw, h: ch };
  }
  return cutRects(img, rects);
}

/**
 * For a sheet that is not on a grid.  The drawings are found by looking for
 * the rows of the image that have nothing in them at all, and each run of
 * rows that does have something is one cell - so the drawings may be any size
 * and sit anywhere across the width, which is how a sheet of four different
 * animals comes out of a drawing program.
 *
 * The one rule it imposes is the obvious one: **one clear row between two
 * drawings.**  Two that touch, even by a pixel, are one beast as far as this
 * is concerned.
 */
function cutBands(img) {
  const { rows } = inkLines(img);
  return cutRects(img, runs(rows).map(([y, h]) => [{ x: 0, y, w: img.width, h }]));
}

/**
 * A grid found rather than divided: the empty rows cut the sheet into rows and
 * the empty columns cut those into cells, so a sheet drawn with whatever
 * spacing the artist liked comes out as grid[row][col] anyway.  Same one rule
 * as cutBands, in both directions: a clear row between two rows of drawings,
 * a clear column between two columns of them.
 */
function cutGrid(img) {
  const { rows, cols } = inkLines(img);
  const cb = runs(cols);
  return cutRects(img, runs(rows).map(([y, h]) => cb.map(([x, w]) => ({ x, y, w, h }))));
}

/**
 * The same idea in both directions, for a sheet of several characters side by
 * side: the empty columns cut it into characters and the empty rows cut each
 * of those into frames.  What comes back is one entry per character, each
 * with its own frames, its own tallest frame and its own extents - so a wide
 * child and a narrow one are two separate little sheets from here on, and
 * neither is padded out to the other's width.
 *
 * The rule is the one cutBands() imposes, in both directions now: a clear row
 * between two frames, a clear column between two characters.  A sheet where
 * two of them overlap even by a pixel is a sheet with fewer, wider characters
 * on it than the artist thinks.
 */
function cutChildren(img, key) {
  const { rows, cols } = inkLines(img);
  const rb = runs(rows), cb = runs(cols);
  return cb.map(([x, w], i) => {
    const kid = cutRects(img, rb.map(([y, h]) => [{ x, y, w, h }]));
    kid.key = `${key}|${i}`;
    return kid;
  });
}

/** Which rows and which columns of a sheet have anything in them at all. */
function inkLines(img) {
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, img.width, img.height).data;
  const rows = new Uint8Array(img.height), cols = new Uint8Array(img.width);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const o = (y * img.width + x) * 4;
      if (d[o + 3] >= 24 && !(d[o] >= WHITE && d[o + 1] >= WHITE && d[o + 2] >= WHITE)) {
        rows[y] = 1; cols[x] = 1;
      }
    }
  }
  return { rows, cols };
}

/** The runs of set flags in a line, as [start, length]. */
function runs(flags) {
  const out = [];
  let start = -1;
  for (let i = 0; i <= flags.length; i++) {
    const on = i < flags.length && flags[i];
    if (on && start < 0) start = i;
    else if (!on && start >= 0) { out.push([start, i - start]); start = -1; }
  }
  return out;
}

function cutRects(img, rects) {
  const work = document.createElement('canvas');
  const wctx = work.getContext('2d', { willReadFrequently: true });

  const grid = [];
  let tallest = 1;
  for (let r = 0; r < rects.length; r++) {
    grid[r] = [];
    for (let c = 0; c < rects[r].length; c++) {
      const q = rects[r][c];
      work.width = q.w; work.height = q.h;          // resizing is what clears it
      wctx.drawImage(img, q.x, q.y, q.w, q.h, 0, 0, q.w, q.h);
      const cell = keyAndTrim(wctx, q.w, q.h);
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

// A child's walk is its column, top to bottom, and the middle drawing doubles
// as the idle.  It is driven off the child's own animation clock rather than
// off the `frame` the coded sprite uses, because that frame only ever counts
// 0, 1 - it was written for a two-pose walk - and reading it would cost every
// one of them their third drawing.  Same cadence the coded walk runs at, so a
// street of children still steps together.
//
// They all face left, and a child heading right is that drawing mirrored - see
// faceFrom() in entities.js for where the facing comes from.
//
// Which child a child is, is `seed` modulo however many drawings turned up:
// one seed per kid, rolled once when the city is populated.  Nobody is
// weighted and nobody is special - the witch takes her turn as one of fifteen
// - and adding a sheet changes the odds for everybody without a line of code.
const CHILD_IDLE = 1;
const CHILD_RATE = 6;                   // beats a second, as in updateKid()

export function childFrame(seed, frame, anim, faceLeft, scale) {
  if (seed == null || !children.length) return null;
  const kid = children[((seed % children.length) + children.length) % children.length];
  const rows = kid.grid.length;
  const row = frame < 0 ? Math.min(CHILD_IDLE, rows - 1)
    : Math.floor((anim || 0) * CHILD_RATE) % rows;
  const cell = (kid.grid[row] || [])[0] || (kid.grid[Math.min(CHILD_IDLE, rows - 1)] || [])[0];
  if (!cell) return null;
  // kid.unit * childPx is this child's own height at the crowd's one scale -
  // see CHILD_BOX.  It is not a number anybody chose for this child.
  // They are all drawn facing left, so the child walking right is the mirror.
  return scaled(`${kid.key}|${row}`, cell, kid, kid.unit * childPx, !faceLeft, scale);
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

/**
 * One of the beasts.  `seed` is the animal - taken modulo however many
 * drawings the sheet turned out to hold, so adding a fifth to the sheet puts
 * a fifth beast on the street and nothing here has to change - and they are
 * drawn facing left, so the mirror is the one heading right.
 *
 * There is no coded stand-in for these: they are the drawing or they are not
 * there at all, which is the right answer for something you can only see
 * through a cat's eyes anyway.
 */
/**
 * One of the street pumpkins.  `seed` picks the variation - modulo however
 * many rows the sheet turned out to hold - and `evil` picks the column: the
 * ordinary gourd or the thing it is under a cat's eyes.  There is no blend
 * between the two columns and there is not meant to be; see drawStreetPumpkin.
 *
 * Returns null if the sheet did not load, and the coded pumpkin is drawn
 * instead - unlike the beasts, this one has a stand-in, because a pumpkin you
 * can walk into has to be visible whatever happened to the art.
 */
export function pumpkinArt(seed, evil, scale) {
  const sh = sheets.pumpkin;
  if (!sh) return null;
  const rows = sh.grid.length;
  const row = ((seed % rows) + rows) % rows;
  const cols = sh.grid[row];
  const col = evil ? Math.min(1, cols.length - 1) : 0;
  const cell = cols[col];
  if (!cell) return null;
  return scaled(`pumpkin|${row}|${col}`, cell, sh, PUMPKIN_BOX, false, scale);
}

export const pumpkinArtReady = () => !!sheets.pumpkin;

export function beastArt(seed, faceLeft, scale) {
  const sh = sheets.beast;
  if (!sh) return null;
  const row = ((seed % sh.grid.length) + sh.grid.length) % sh.grid.length;
  const cell = sh.grid[row][0];
  if (!cell) return null;
  return scaled(`beast|${row}`, cell, sh, BEAST_BOX, !faceLeft, scale);
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
