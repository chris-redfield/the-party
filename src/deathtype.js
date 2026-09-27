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
const URL = 'assets/deathly/Font1.otf';
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
    const face = new FontFace(FAMILY, `url(${URL})`);
    await face.load();
    document.fonts.add(face);
    ready = true;
  } catch (e) {
    console.warn(`death type: ${URL} did not load`, e);
  } finally {
    settled = true;
  }
}

export const deathFontsReady = () => ready;
export const deathFontsSettled = () => settled;

export function setDeathFont(ctx, size) {
  ctx.font = `${Math.round(size * SCALE)}px "${FAMILY}", "Times New Roman", serif`;
}

/** Set a line.  `align` is 'center', 'left' or 'right' about `cx`. */
export function deathText(ctx, text, cx, y, size, align = 'center') {
  setDeathFont(ctx, size);
  ctx.textAlign = align;
  ctx.fillText(text, cx, y);
  return ctx.measureText(text).width;
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
