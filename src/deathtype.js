// ---------------------------------------------------------------------------
// THE LETTERING ON THE DEATH SCREEN
// ---------------------------------------------------------------------------
// The only place in the game that uses a real typeface rather than something
// drawn out of code.  Deathly, under the 1001Fonts Free For Personal Use
// licence, which sits beside the file in assets/ - it does NOT cover
// commercial use, so releasing this for money needs a licence from the
// foundry or a different face.
//
// `SCALE` is the face's optical size: what a size asked for here is
// multiplied by before it reaches the canvas.
// ---------------------------------------------------------------------------

const FAMILY = 'PartyDeathly';
// Resolved against this module rather than against the page, so the dev pages
// in preview/ load the same face the game does instead of looking for it
// beside themselves.
const FONT_URL = new URL('../assets/deathly/Font1.otf', import.meta.url).href;
const SCALE = 1;             // measured at 100px: cap 87, H 49.7 wide

let ready = false;
let settled = false;

/**
 * Pulled in over the FontFace API rather than declared in the stylesheet, so
 * there is a promise to wait on: canvas text does not re-draw itself when a
 * font turns up late, it just silently sets in the fallback and stays there.
 * On a screen that redraws every frame it does correct itself - which is
 * worse, not better, because what you see is the title card set in Times for
 * a moment and then jumping into the real face.  So the title card waits, and
 * `settled` is what it waits on: **it is true when the face has arrived AND
 * when it is never going to**, so a missing font costs a moment and then sets
 * in the fallback rather than leaving a blank red screen for ever.
 */
export async function loadDeathFonts() {
  try {
    const face = new FontFace(FAMILY, `url(${FONT_URL})`);
    await face.load();
    document.fonts.add(face);
    ready = true;
  } catch (e) {
    console.warn(`death type: ${FONT_URL} did not load`, e);
  } finally {
    settled = true;
  }
}

export const deathFontsReady = () => ready;
export const deathFontsSettled = () => settled;

export function setDeathFont(ctx, size) {
  ctx.font = `${Math.round(size * SCALE)}px "${FAMILY}", "Times New Roman", serif`;
}

// ---------------------------------------------------------------------------
// THE ACCENTS THIS FACE DOES NOT HAVE
// ---------------------------------------------------------------------------
// Deathly claims the accented letters and does not have them: every one of
// them - ó, á, ã, ç - is mapped straight to the unaccented glyph, so a name
// set in it comes out spelled wrong rather than set in a fallback face, which
// is worse because nothing looks broken.  Somebody's name is not a detail.
//
// So the marks are drawn, which is what everything else in this game that is
// not a letter already is.  The string is split into its base letters and its
// combining marks (NFD does that), the letters are set as one run so the face
// kerns them exactly as it would have, and each mark is then drawn over the
// letter it belongs to - found by measuring the run up to it, which is the
// same measurement the browser laid the run out with.
const MARK_W = 0.30;        // of the size, across
const MARK_T = 0.085;       // and thick
const MARK_RISE = 0.06;     // clear of the letter's own ink

const MARKS = {
  '\u0301': acute, '\u0300': grave, '\u0302': circumflex,
  '\u0303': tilde, '\u0308': diaeresis, '\u0327': cedilla,
};

/** Set a line.  `align` is 'center', 'left' or 'right' about `cx`. */
export function deathText(ctx, text, cx, y, size, align = 'center') {
  setDeathFont(ctx, size);
  ctx.textAlign = align;

  const decomposed = text.normalize('NFD');
  const base = decomposed.replace(/[\u0300-\u036f]/g, '');
  ctx.fillText(base, cx, y);
  const w = ctx.measureText(base).width;
  if (base.length === decomposed.length) return w;   // nothing to put on top

  // where the run actually starts, so a mark can be placed in page space
  const x0 = align === 'center' ? cx - w / 2 : align === 'right' ? cx - w : cx;
  ctx.save();
  ctx.textAlign = 'left';
  let bi = 0;
  for (const ch of decomposed) {
    const draw = MARKS[ch];
    if (!draw) { bi++; continue; }
    if (!bi) continue;                                // a mark with no letter
    const a = ctx.measureText(base.slice(0, bi - 1)).width;
    const b = ctx.measureText(base.slice(0, bi)).width;
    const m = ctx.measureText(base[bi - 1]);
    const asc = m.actualBoundingBoxAscent || size * 0.72;
    const desc = m.actualBoundingBoxDescent || 0;
    draw(ctx, x0 + (a + b) / 2, y, asc, desc, size);
  }
  ctx.restore();
  return w;
}

// The marks themselves.  Wedges rather than strokes, because every letter on
// this face is a wedge - a round accent over a spiked letter reads as a
// different font having been patched in, which is the thing being avoided.
function wedge(ctx, cx, y, size, lean) {
  const w = size * MARK_W, t = size * MARK_T;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, y + lean * w / 2);
  ctx.lineTo(cx + w / 2, y - lean * w / 2);
  ctx.lineTo(cx + w / 2, y - lean * w / 2 + t);
  ctx.lineTo(cx - w / 2, y + lean * w / 2 + t);
  ctx.closePath();
  ctx.fill();
}
const above = (y, asc, size) => y - asc - size * MARK_RISE;
function acute(ctx, cx, y, asc, desc, size) { wedge(ctx, cx, above(y, asc, size), size, 0.9); }
function grave(ctx, cx, y, asc, desc, size) { wedge(ctx, cx, above(y, asc, size), size, -0.9); }
function circumflex(ctx, cx, y, asc, desc, size) {
  const w = size * MARK_W, t = size * MARK_T, top = above(y, asc, size);
  ctx.beginPath();
  ctx.moveTo(cx, top - w * 0.42);
  ctx.lineTo(cx + w / 2, top + t * 0.6);
  ctx.lineTo(cx + w * 0.3, top + t * 1.1);
  ctx.lineTo(cx, top - w * 0.02);
  ctx.lineTo(cx - w * 0.3, top + t * 1.1);
  ctx.lineTo(cx - w / 2, top + t * 0.6);
  ctx.closePath();
  ctx.fill();
}
function tilde(ctx, cx, y, asc, desc, size) {
  const w = size * MARK_W, t = size * MARK_T, top = above(y, asc, size);
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, top + t);
  ctx.quadraticCurveTo(cx - w * 0.2, top - t * 1.4, cx, top + t * 0.2);
  ctx.quadraticCurveTo(cx + w * 0.2, top + t * 1.6, cx + w / 2, top - t * 0.3);
  ctx.lineTo(cx + w / 2, top + t * 0.8);
  ctx.quadraticCurveTo(cx + w * 0.2, top + t * 2.6, cx, top + t * 1.2);
  ctx.quadraticCurveTo(cx - w * 0.2, top - t * 0.4, cx - w / 2, top + t * 2);
  ctx.closePath();
  ctx.fill();
}
function diaeresis(ctx, cx, y, asc, desc, size) {
  const w = size * MARK_W, t = size * MARK_T, top = above(y, asc, size);
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + d * w * 0.26, top - t * 0.2);
    ctx.lineTo(cx + d * w * 0.26 + t * 0.7, top + t * 0.7);
    ctx.lineTo(cx + d * w * 0.26, top + t * 1.5);
    ctx.lineTo(cx + d * w * 0.26 - t * 0.7, top + t * 0.7);
    ctx.closePath();
    ctx.fill();
  }
}
function cedilla(ctx, cx, y, asc, desc, size) {
  const w = size * MARK_W, t = size * MARK_T, foot = y + desc + size * 0.02;
  ctx.beginPath();
  ctx.moveTo(cx - t * 0.4, foot);
  ctx.lineTo(cx + t * 0.5, foot);
  ctx.lineTo(cx + t * 0.2, foot + w * 0.42);
  ctx.lineTo(cx - w * 0.34, foot + w * 0.5);
  ctx.lineTo(cx - w * 0.30, foot + w * 0.2);
  ctx.lineTo(cx - t * 0.1, foot + w * 0.24);
  ctx.closePath();
  ctx.fill();
}

/** The same, wrapped to `maxW`.  Returns how many lines it took. */
export function deathWrap(ctx, text, cx, y, size, maxW, lh) {
  setDeathFont(ctx, size);
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => deathText(ctx, l, cx, y + i * lh, size));
  return lines.length;
}
