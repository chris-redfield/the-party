// ---------------------------------------------------------------------------
// THE LINE THE DRAWINGS ARE MADE OF
// ---------------------------------------------------------------------------
// Every character in this game is a hand-drawn ink outline round a flat fill.
// The city was not: it was axis-aligned `fillRect` with a noise texture over
// it, which is a different medium standing next to the art rather than the
// same one.  This module is the one line the whole city is now drawn with.
//
// What actually makes that line read as hand-drawn - all three matter, and
// dropping any one of them turns it back into a computer line:
//
//   1. IT WANDERS.  The stroke leaves its ideal path and comes back.  Not
//      noise per pixel - that is a shaky line, and shaky reads as an effect.
//      A few slow control points over the length of the edge, smoothed.
//   2. IT VARIES IN WEIGHT.  A brush presses harder somewhere.  This is the
//      big one: a wandering line of constant width still reads as a computer
//      imitating a hand.  So an edge is a FILLED POLYGON, not a stroke - the
//      two sides wander independently and the gap between them breathes.
//   3. IT OVERSHOOTS.  A hand drawing a box runs the corners past each other,
//      because stopping exactly on a point is harder than going past it.
//      This is what "clunky but deliberate" looks like in one word: the
//      corner is wrong on purpose and it is wrong the same way every time.
//
// DETERMINISM IS NOT OPTIONAL.  Every wobble here is a pure function of the
// thing being drawn - a building's own seed and which edge of it this is.
// It is computed in WORLD units, so the same wall wobbles identically at
// every zoom and from every camera position.  Drive any of it from time, from
// screen position or from Math.random and the whole city crawls and boils the
// moment the player takes a step, which is the single worst thing this style
// could do.  It is drawn, so it holds still.

export const INK_COLOR = '#0d0b10';

// Rolled once per edge and remembered, because an edge is re-drawn every
// frame and has to come out the same every time.
const OFFSETS = new Map();

/** Deterministic 0..1 from two integers.  No state, no clock. */
function hash2(a, b) {
  let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2545f491) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/**
 * The shape of one edge, as control points along it at t = 0..1.
 *
 * `n` control points, each with how far the line wanders off true (`off`) and
 * how thick the brush is there (`w`, a multiple of the nominal weight).  A
 * long wall gets more points than a window frame, so the wobble has the same
 * wavelength everywhere rather than one wiggle per edge whatever its length.
 *
 * `wlen` is the edge's length in WORLD px, not screen px, and that is the
 * whole reason this function takes it separately.  Count the points off the
 * screen length instead and a building re-rolls its own wobble the moment the
 * player touches the zoom keys, because the same wall is suddenly 300 px long
 * instead of 190 and lands in a different cache slot.  Walking never did this
 * - a wall's width does not change when the camera moves - so it looked
 * stable right up until somebody pressed `[`.
 */
function edgeShape(seed, edge, wlen, wobble) {
  const key = `${seed}|${edge}|${Math.round(wlen)}|${wobble}`;
  let s = OFFSETS.get(key);
  if (s) return s;
  // One control point roughly every 45 world px, never fewer than 3 - two
  // points is a straight line with a tilt, which is not a wobble at all.
  //
  // The ceiling has to be high enough for the longest line in the city, which
  // is a whole block's silhouette and can run 600+ world px.  Capped at 9 it
  // drifted about 7px across the entire wall - measurably not straight, and
  // to the eye still a ruled line, because one lazy bend over 600px is not a
  // wobble.  The cost is bounded anyway: only a handful of edges are ever
  // this long, and windows still come out at the floor of 3.
  const n = Math.max(3, Math.min(20, Math.round(wlen / 45) + 2));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const r1 = hash2(seed * 31 + edge, i * 7 + 1);
    const r2 = hash2(seed * 17 + edge, i * 13 + 5);
    // the ends wander less than the middle: a line that starts off-target
    // reads as a misplaced line rather than a drawn one
    const ease = Math.sin((i / (n - 1)) * Math.PI);
    pts.push({
      t: i / (n - 1),
      off: (r1 - 0.5) * 2 * wobble * (0.35 + 0.65 * ease),
      w: 0.62 + r2 * 0.85,          // the brush breathes between ~0.6x and ~1.5x
    });
  }
  s = pts;
  OFFSETS.set(key, s);
  return s;
}

/**
 * One drawn edge from (x0,y0) to (x1,y1), as a filled polygon.
 *
 * Down one side and back up the other, so the two banks of the line are
 * independent and the weight varies along it.  Quadratic midpoints smooth
 * the control points - straight segments between them would read as a
 * polygon, which is a different kind of wrong from a drawn line.
 *
 * All of x0..y1 are SCREEN coordinates; `weight` and `wobble` are screen too.
 * The caller scales them by the zoom, so the line gets fatter as you zoom in
 * exactly like the ink in a sprite does.
 */
export function inkEdge(ctx, x0, y0, x1, y1, weight, seed, edge, wobble, over = 0, unit = 1) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 0.6) return;
  const ux = dx / len, uy = dy / len;      // along
  const nx = -uy, ny = ux;                 // across
  // the overshoot, one end rolled against the other so a box's four corners
  // never all run past by the same amount
  const o0 = over * (0.35 + hash2(seed, edge * 3 + 91) * 0.9);
  const o1 = over * (0.35 + hash2(seed, edge * 3 + 47) * 0.9);
  const ax = x0 - ux * o0, ay = y0 - uy * o0;
  const L = len + o0 + o1;
  const wlen = len / unit;                           // world px, so zoom-stable
  const pts = edgeShape(seed, edge, wlen, 1);
  // A hand holds a short line true and lets a long one get away from it.  A
  // window frame keeps the wobble it was tuned with; a block-long wall gets
  // up to three times as much, which is what stops the biggest shapes in the
  // city reading as ruled while every small one still looks deliberate.
  const wob = wobble * (1 + Math.min(2, wlen / 300));

  const P = (t, side) => {
    const s = pts[0];
    // walk the control points for this t
    let i = 0;
    while (i < pts.length - 2 && pts[i + 1].t < t) i++;
    const a = pts[i], b = pts[i + 1];
    const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
    const off = (a.off + (b.off - a.off) * f) * wob;
    const w = (a.w + (b.w - a.w) * f) * weight * 0.5;
    const cx = ax + ux * (t * L), cy = ay + uy * (t * L);
    return [cx + nx * (off + side * w), cy + ny * (off + side * w)];
  };

  ctx.beginPath();
  // One curve segment per control point, not two.  A quadratic through the
  // midpoints is already smooth at this density, and this is the hottest loop
  // in the renderer - every extra segment here is paid four times over on
  // every edge of every building on screen, every frame.
  const N = pts.length;
  let p = P(0, +1);
  ctx.moveTo(p[0], p[1]);
  for (let i = 1; i <= N; i++) {            // down one bank
    const t = i / N, q = P(t, +1);
    const m = P(t - 0.5 / N, +1);
    ctx.quadraticCurveTo(m[0], m[1], q[0], q[1]);
  }
  for (let i = N; i >= 0; i--) {            // and back up the other
    const t = i / N, q = P(t, -1);
    const m = P(t + 0.5 / N > 1 ? 1 : t + 0.5 / N, -1);
    ctx.quadraticCurveTo(m[0], m[1], q[0], q[1]);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * A drawn box: four edges that do not quite meet, which is the whole point.
 *
 * `edge` seeds which of the four this is, so the same building's four walls
 * differ from each other but never from themselves.  Pass `skip` to leave a
 * side open - a facade standing on the pavement has no drawn line along its
 * foot, because there is nothing there to draw: it meets the ground.
 */
export function inkBox(ctx, x, y, w, h, weight, seed, wobble, over, skip = '', unit = 1) {
  ctx.fillStyle = INK_COLOR;
  if (!skip.includes('t')) inkEdge(ctx, x, y, x + w, y, weight, seed, 0, wobble, over, unit);
  if (!skip.includes('r')) inkEdge(ctx, x + w, y, x + w, y + h, weight, seed, 1, wobble, over, unit);
  if (!skip.includes('b')) inkEdge(ctx, x + w, y + h, x, y + h, weight, seed, 2, wobble, over, unit);
  if (!skip.includes('l')) inkEdge(ctx, x, y + h, x, y, weight, seed, 3, wobble, over, unit);
}

/** A single drawn rule - a string course, a sill, a seam in the roof. */
export function inkLine(ctx, x0, y0, x1, y1, weight, seed, edge, wobble, over = 0, unit = 1) {
  ctx.fillStyle = INK_COLOR;
  inkEdge(ctx, x0, y0, x1, y1, weight, seed, edge, wobble, over, unit);
}

/** Throw the remembered wobbles away - only when the style itself changes. */
export function resetInk() { OFFSETS.clear(); }

/**
 * How many distinct edge shapes have been rolled.
 *
 * This is the zoom-stability check, and it is worth keeping: walk the city at
 * one zoom, read it, change zoom, read it again.  If the number barely moves,
 * every building kept the line it already had.  If it climbs with the zoom,
 * something is keying a shape off screen pixels again and the whole city will
 * re-draw itself under the player's feet every time they press `[`.
 */
export function inkShapeCount() { return OFFSETS.size; }
