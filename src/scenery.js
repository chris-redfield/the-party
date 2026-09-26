// ---------------------------------------------------------------------------
// THE CITY, RENDERED
// ---------------------------------------------------------------------------
// Everything here is scenery: asphalt, kerbs, paving, buildings, doors,
// decorations and street lamps.  Nothing alive is drawn in this file.
//
// It is flat.  There is no lighting in this city at all - no pools under the
// lamps, no bloom off a lit window, no soft shadow under a parapet, not one
// gradient.  Every surface is a solid colour, and where a surface needs to
// read as having a second face - the side of a kerb, the shadow a building
// throws - that face is another solid colour, hard-edged, sitting next to it.
// The only transparency in the file is the material textures, which are
// neutral light-and-dark overlays and are the thing that stops a solid colour
// looking like a solid colour.
//
// It answers to the palette in `palette.js`, so a cat's gift drains the whole
// city to grey and sets the lit things burning: every colour below comes out
// of `C`, and the textures tint themselves against whatever is under them.
// ---------------------------------------------------------------------------
import { WALK, TILE, VIEW_W, VIEW_H, COLOR_DOORS } from './config.js';
import { CROSS_SHAFT } from './city.js';
import { makeRng } from './rng.js';
import { C, MIX, lerpHex } from './palette.js';

// WALL_H used to be the one facade height in the city; every building now
// carries its own (config: WALL_MIN..WALL_MAX).  Kept as the nominal.
export const WALL_H = 88;

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
// Every texture is a neutral overlay - transparent black and white only - so
// it reads as grain on anything it is laid over and survives the drain to
// grey without needing a second copy of itself.  `scale` is texture pixels
// per world pixel.
// ---------------------------------------------------------------------------
let TEX = null;

function blank(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
}

/** Per-pixel grit: what makes asphalt look like asphalt and not like paint. */
function grainTex(size, scale, amp, bias = 0.5) {
  const cv = blank(size, size);
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < size * size; i++) {
    const light = Math.random() > bias;
    const a = Math.random() * Math.random() * amp;     // mostly quiet, rarely loud
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = light ? 255 : 0;
    d[i * 4 + 3] = a * 255;
  }
  ctx.putImageData(img, 0, 0);
  return { cv, scale };
}

/** Big soft blotches: weathering, wear, the fact that no surface is uniform. */
function blotchTex(size, scale, count, amp) {
  const cv = blank(size, size);
  const ctx = cv.getContext('2d');
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = size * (0.08 + Math.random() * 0.22);
    const light = Math.random() > 0.5;
    // drawn nine times so the tile wraps without a seam
    for (let wy = -1; wy <= 1; wy++) {
      for (let wx = -1; wx <= 1; wx++) {
        const g = ctx.createRadialGradient(x + wx * size, y + wy * size, 0,
                                           x + wx * size, y + wy * size, r);
        g.addColorStop(0, `rgba(${light ? 255 : 0},${light ? 255 : 0},${light ? 255 : 0},${amp})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + wx * size - r, y + wy * size - r, r * 2, r * 2);
      }
    }
  }
  return { cv, scale };
}

/** Brick: from across a street it is horizontal striation and little else. */
function brickTex() {
  const scale = 3, bw = 8, bh = 3, tw = 48, th = 24;   // world px
  const cv = blank(tw * scale, th * scale);
  const ctx = cv.getContext('2d');
  for (let row = 0; row < th / bh; row++) {
    const off = (row % 2) * (bw / 2);
    for (let col = -1; col < tw / bw + 1; col++) {
      const x = (col * bw + off) * scale, y = row * bh * scale;
      const v = Math.random();
      ctx.fillStyle = `rgba(${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},${Math.random() * 0.10})`;
      ctx.fillRect(x, y, bw * scale - scale, bh * scale - scale);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.16)';                 // the mortar course
    ctx.fillRect(0, (row * bh + bh - 1) * scale, tw * scale, scale * 0.8);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, (row * bh + bh - 1) * scale + scale * 0.8, tw * scale, scale * 0.4);
  }
  return { cv, scale };
}

/** Rendered plaster: mottled, with the odd hairline crack and damp streak. */
function stuccoTex() {
  const scale = 2, size = 96;
  const cv = blank(size * scale, size * scale);
  const ctx = cv.getContext('2d');
  const b = blotchTex(size * scale, 1, 26, 0.09);
  ctx.drawImage(b.cv, 0, 0);
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = scale * 0.5;
  for (let i = 0; i < 5; i++) {                          // damp running down
    let x = Math.random() * size * scale, y = 0;
    ctx.beginPath(); ctx.moveTo(x, y);
    while (y < size * scale) { y += 8 * scale; x += (Math.random() - 0.5) * 6 * scale; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  return { cv, scale };
}

function ensureTextures() {
  if (TEX) return;
  // Grit is rendered finer than a world pixel on purpose: at any zoom it has
  // to read as the surface being rough, never as noise laid over a picture.
  TEX = {
    grit:     grainTex(256, 2, 0.20, 0.66),     // asphalt
    dust:     grainTex(256, 2, 0.14, 0.55),     // concrete
    wear:     blotchTex(192, 1, 30, 0.09),      // big tonal variation
    gravel:   grainTex(192, 1.5, 0.22, 0.78),   // roof, mostly dark chippings
    brick:    brickTex(),
    stucco:   stuccoTex(),
  };
}

/**
 * Lay a texture over a rectangle, locked to the world so it does not swim
 * when the camera moves and does not shrink when you zoom.
 */
let patCtx = null;
function tex(ctx, t, x, y, w, h, o, alpha) {
  if (!t.pat) {
    if (!patCtx) patCtx = blank(1, 1).getContext('2d');
    t.pat = patCtx.createPattern(t.cv, 'repeat');
  }
  const k = o.z / t.scale;
  t.pat.setTransform(new DOMMatrix([k, 0, 0, k, o.ox, o.oy]));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = t.pat;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/**
 * The shadow one thing throws on another.  Hard-edged and solid, because
 * there is no light in this city to soften it with.
 */
function drop(ctx, x, y, w, h, dx, dy) {
  ctx.fillStyle = C.coreShadow;
  ctx.fillRect(x + dx, y + dy, w, h);
}

// ---------------------------------------------------------------------------
// Small parts, rendered once and stamped
// ---------------------------------------------------------------------------
// A window is drawn forty times a frame, so it is worth rendering one and
// keeping it.  It is built at exactly the size it will be stamped at, so it
// is never scaled and never softened.  The cache is thrown away whenever the
// zoom moves or the changeover reaches its next stage, which are the only two
// things that can change what one looks like.
// ---------------------------------------------------------------------------
const CACHE = new Map();
let cacheKey = '';

function part(key, w, h, paintIt) {
  const k = `${MIX.scene}`;
  if (cacheKey !== k) { CACHE.clear(); cacheKey = k; }
  let cv = CACHE.get(key);
  if (cv) return cv;
  cv = blank(w, h);
  paintIt(cv.getContext('2d'), w / 30, h / 26);
  CACHE.set(key, cv);
  return cv;
}

/** One window: the reveal, the glass, the bars, the frame and the sill. */
function windowPart(variant, z) {
  const w = Math.max(6, Math.round(30 * z)), h = Math.max(6, Math.round(26 * z));
  return part(`win${variant}|${z}`, w, h, (g, u) => {
    const lit = variant > 0;
    const R = (x, y, ww, hh, col) => {
      g.fillStyle = col;
      g.fillRect(Math.round(x * u), Math.round(y * u),
                 Math.max(1, Math.round(ww * u)), Math.max(1, Math.round(hh * u)));
    };
    R(0, 0, 30, 24, C.dark);                       // the hole in the wall
    const glass = !lit ? C.unlit
      : variant === 1 ? C.litWindow
      : variant === 2 ? C.litWindowPale : C.litWindowDeep;
    R(3, 3, 24, 18, glass);
    if (lit) {
      // whatever is going on in there, in silhouette
      if (variant === 1) for (let i = 0; i < 3; i++) R(3, 4 + i * 3, 24, 1.5, C.litWindowDeep);
      else if (variant === 2) R(3, 3, 8, 18, C.litWindowDeep);
      else R(13, 9, 5, 12, C.dark);
    } else {
      R(3, 3, 12, 9, C.glassRefl);                 // the street, in the glass
      R(15, 3, 6, 4, C.glassRefl);
    }
    R(14, 3, 2, 18, C.frame);                      // glazing bars
    R(3, 11, 24, 2, C.frame);
    R(1, 1, 28, 2, C.frame);                       // the frame
    R(1, 1, 2, 22, C.frame);
    R(27, 1, 2, 22, C.frame);
    R(1, 21, 28, 2, C.frame);
    R(1, 1, 28, 1, C.frameLit);
    R(1, 1, 1, 22, C.frameLit);
    R(0, 21, 30, 3, C.sill);                       // the sill and its shadow
    R(0, 21, 30, 1, C.frameLit);
    R(0, 24, 30, 2, C.coreShadow);
  });
}

// ---------------------------------------------------------------------------
// The road
// ---------------------------------------------------------------------------
/**
 * Worn paint.  Road markings are never a clean rectangle - they get eaten at
 * the edges by everything that drives over them.  Each notch is bitten out of
 * one long side in road colour, small enough to read as wear: eat into the
 * middle of a stripe and it stops looking worn and starts looking broken.
 */
function paint(ctx, x, y, w, h, color, rng) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  const along = w > h;
  const thick = Math.min(w, h), len = Math.max(w, h);
  // many shallow notches, not a few deep ones: a handful of small bites off
  // an edge reads as a worn edge, while one big square reads as damage
  const n = 2 + Math.floor(len / 18);
  ctx.fillStyle = C.asphalt;
  for (let i = 0; i < n; i++) {
    const bite = thick * rng.range(0.08, 0.22);
    const run = len * rng.range(0.05, 0.15);
    const at = rng.range(0, len - run);
    const far = rng.chance(0.5);
    if (along) ctx.fillRect(x + at, far ? y + h - bite : y, run, bite);
    else ctx.fillRect(far ? x + w - bite : x, y + at, bite, run);
  }
}

/**
 * The upside-down cross.
 *
 * Saint Peter's: a Latin cross stood on its head, so the long shaft runs UP
 * and the short stub hangs below the bar.  It is not a crosshair and it is
 * not a plus - the bar sits a quarter of the way up, the shaft is three times
 * longer above it than below, and all four ends are capped, which is what
 * makes a cross read as a cross rather than as two lines that met.
 *
 * It grows out of the road paint it replaces: the shaft lies exactly along
 * the vertical lane markings and the bar exactly along the horizontal ones,
 * and it is opaque, so the yellow crosshair it burns off simply stops being
 * there.  It arrives by having its colour come up out of the asphalt over the
 * stages of the changeover rather than by fading in.
 */
function hellCross(ctx, o, j) {
  const { z } = o;
  const jx = o.ox + j.x * z;
  const jy = o.oy + j.y * z;
  const m = MIX.scene;
  const ink = lerpHex(C.asphalt, C.hellCross, Math.min(1, m * 1.15));
  const edge = lerpHex(C.asphalt, C.hellCrossDark, Math.min(1, m * 1.4));
  const R = (x, y, w, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(jx + x * z, jy + y * z, w * z, h * z);
  };
  // the bar fills whatever junction it is standing in, and no two junctions
  // are the same width now that the roads are not all one size
  const UP = CROSS_SHAFT, ARM = j.span;
  // the stub below the bar stops inside the road it is lying on, and the
  // shaft and bar are thick enough to cover the paint they replace - which
  // on an avenue is two lines and not one
  const DOWN = Math.min(62, j.arm - 2);
  const T = j.twin ? 11 : 8, CAP = 15;          // half-thickness, half-cap
  // the burn around it first, so every edge of the figure has a dark lip
  R(-T - 5, -UP - 5, (T + 5) * 2, UP + DOWN + 10, edge);
  R(-ARM, -T - 5, ARM * 2, (T + 5) * 2, edge);
  R(-CAP - 5, -UP - 5, (CAP + 5) * 2, 13, edge);
  R(-CAP - 5, DOWN - 8, (CAP + 5) * 2, 13, edge);
  R(-ARM, -CAP - 5, 13, (CAP + 5) * 2, edge);
  R(ARM - 13, -CAP - 5, 13, (CAP + 5) * 2, edge);
  // the figure
  R(-T, -UP, T * 2, UP + DOWN, ink);            // the shaft, long end up
  R(-ARM, -T, ARM * 2, T * 2, ink);             // the bar, low on the shaft
  R(-CAP, -UP, CAP * 2, 8, ink);                // and the four capped ends
  R(-CAP, DOWN - 8, CAP * 2, 8, ink);
  R(-ARM, -CAP, 8, CAP * 2, ink);
  R(ARM - 8, -CAP, 8, CAP * 2, ink);
}

// ---------------------------------------------------------------------------
// The road
// ---------------------------------------------------------------------------
// A road is one of the cuts that made the city, so it knows how deep in the
// tree it was made: the first cuts are wide avenues with a twin centre line
// down them, the last are narrow lanes with a single dashed one.  Everything
// laid on a road - the patches, the cracks, the manhole, the gully at the
// kerb - is rolled from the road's own index, so it is there every night.
//
// The code below is written once for a road running either way: `along` is
// distance down the road and `off` is distance out from its centre line, and
// the two helpers turn that into x and y depending on which way it runs.
function drawRoadSeg(ctx, o, r, idx) {
  const { ox, oy, z } = o;
  const X = (w) => ox + w * z;
  const Y = (w) => oy + w * z;
  const rng = makeRng(idx * 7919 + 13);
  const vert = r.axis === 'v';
  const len = vert ? r.y1 - r.y0 : r.x1 - r.x0;
  const mid = vert ? (r.x0 + r.x1) / 2 : (r.y0 + r.y1) / 2;
  const a0 = vert ? r.y0 : r.x0;
  const P = (along, off, la, wi, col) => paint(ctx,
    X(vert ? mid + off : a0 + along), Y(vert ? a0 + along : mid + off),
    (vert ? wi : la) * z, (vert ? la : wi) * z, col, rng);
  const F = (along, off, la, wi, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(X(vert ? mid + off : a0 + along), Y(vert ? a0 + along : mid + off),
                 (vert ? wi : la) * z, (vert ? la : wi) * z);
  };
  const AT = (along, off) => [X(vert ? mid + off : a0 + along), Y(vert ? a0 + along : mid + off)];

  // repair patches, laid in a different batch of asphalt to the road
  for (let i = 0; i < 1 + Math.floor(len / 700); i++) {
    if (!rng.chance(0.8)) continue;
    const pl = rng.range(60, 150), pw = rng.range(40, 90);
    F(rng.range(20, Math.max(24, len - pl)), rng.range(-r.w / 2 + 6, r.w / 2 - pw - 6),
      pl, pw, C.asphaltDark);
  }
  // cracks, filled with tar nobody could be bothered to smooth
  ctx.strokeStyle = C.gutter;
  ctx.lineWidth = Math.max(1, 1.4 * z);
  for (let i = 0; i < 1 + Math.floor(len / 500); i++) {
    let pa = rng.range(10, Math.max(20, len - 60)), po = rng.range(-r.w / 2 + 10, r.w / 2 - 10);
    ctx.beginPath();
    ctx.moveTo(...AT(pa, po));
    for (let k = 0; k < 3; k++) {
      pa += rng.range(10, 22); po += rng.range(-9, 9);
      ctx.lineTo(...AT(pa, po));
    }
    ctx.stroke();
  }

  // the centre line.  An avenue gets two of them; a lane gets one.
  const dash = 44, gap = 44;
  const twin = r.w >= 152;
  for (let t = 6; t < len - dash; t += dash + gap) {
    if (twin) { P(t, -11, dash, 5, C.laneLine); P(t, 6, dash, 5, C.laneLine); }
    else P(t, -3, dash, 6, C.laneLine);
  }

  // a manhole, set into the surface
  {
    const [mx, my] = AT(rng.range(len * 0.2, len * 0.8), rng.range(-r.w / 4, r.w / 4));
    const mr = 17 * z;
    ctx.fillStyle = C.manholeDark;
    ctx.beginPath(); ctx.arc(mx, my, mr * 1.12, 0, 6.2832); ctx.fill();
    ctx.fillStyle = C.manhole;
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = C.manholeDark;
    ctx.lineWidth = Math.max(1, 1.4 * z);
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath(); ctx.arc(mx, my, mr * (i / 4), 0, 6.2832); ctx.stroke();
    }
    for (let a = 0; a < 4; a++) {
      ctx.beginPath();
      ctx.moveTo(mx + Math.cos(a * 1.571) * mr * 0.25, my + Math.sin(a * 1.571) * mr * 0.25);
      ctx.lineTo(mx + Math.cos(a * 1.571) * mr * 0.88, my + Math.sin(a * 1.571) * mr * 0.88);
      ctx.stroke();
    }
  }

  // a gully at the kerb, with the grate you would expect in it
  for (let i = 0; i < 1 + Math.floor(len / 900); i++) {
    const [gx, gy] = AT(rng.range(40, Math.max(60, len - 60)),
                        rng.chance(0.5) ? -r.w / 2 + 2 : r.w / 2 - 16);
    const gw = (vert ? 14 : 26) * z, gh = (vert ? 26 : 14) * z;
    ctx.fillStyle = C.drain;
    ctx.fillRect(gx, gy, gw, gh);
    ctx.fillStyle = C.curb;
    ctx.fillRect(gx, gy, gw, 1.5 * z);
    ctx.fillStyle = C.gutter;
    for (let k = 0; k < 5; k++) {
      if (vert) ctx.fillRect(gx + 2 * z, gy + (3 + k * 5) * z, 10 * z, 2.5 * z);
      else ctx.fillRect(gx + (3 + k * 5) * z, gy + 2 * z, 2.5 * z, 10 * z);
    }
  }
}

/**
 * A painted crossing, laid between two lots that face each other across a
 * road.  On a grid these could be hard-coded at the middle of every cell
 * edge; here every one of them was worked out from who faces whom.
 */
function drawCrossing(ctx, o, c, idx) {
  const { ox, oy, z } = o;
  const rng = makeRng(idx * 104729 + 7);
  const vert = c.axis === 'v';        // the walk itself runs north-south
  const a0 = vert ? c.y0 : c.x0, a1 = vert ? c.y1 : c.x1;
  const w0 = vert ? c.x0 : c.y0, w1 = vert ? c.x1 : c.y1;
  for (let t = a0 + 6; t < a1 - 12; t += 22) {
    const x = vert ? w0 + 4 : t, y = vert ? t : w0 + 4;
    const w = vert ? (w1 - w0 - 8) : 12, h = vert ? 12 : (w1 - w0 - 8);
    paint(ctx, ox + x * z, oy + y * z, w * z, h * z, C.cross, rng);
  }
}

// ---------------------------------------------------------------------------
// The pavement
// ---------------------------------------------------------------------------
// One lot: the kerb round the outside of it, the paving between the kerb and
// the building, and the footprint the building stands in.  Every lot is a
// different size, so all of this is measured off the lot itself rather than
// off a cell that was always 512 wide.  How much litter and how many
// mismatched slabs a block has follows from how much pavement it has.
function drawWalk(ctx, o, b) {
  const { ox, oy, z } = o;
  const X = (w) => ox + w * z;
  const Y = (w) => oy + w * z;
  const bw = (b.x1 - b.x0) * z, bh = (b.y1 - b.y0) * z;
  const rng = makeRng((b.seed ^ 0x9e3779b9) >>> 0);

  // the gutter: where the road meets the kerb and the dirt collects
  ctx.fillStyle = C.gutter;
  ctx.fillRect(X(b.x0 - 6), Y(b.y0 - 6), bw + 12 * z, 6 * z);
  ctx.fillRect(X(b.x0 - 6), Y(b.y0 - 6), 6 * z, bh + 12 * z);
  ctx.fillRect(X(b.x1), Y(b.y0 - 6), 6 * z, bh + 12 * z);
  ctx.fillRect(X(b.x0 - 6), Y(b.y1), bw + 12 * z, 6 * z);

  ctx.fillStyle = C.walk;
  ctx.fillRect(X(b.x0), Y(b.y0), bw, bh);
  tex(ctx, TEX.dust, X(b.x0), Y(b.y0), bw, bh, o, 0.7);
  tex(ctx, TEX.wear, X(b.x0), Y(b.y0), bw, bh, o, 0.5);

  ctx.save();
  ctx.beginPath();
  ctx.rect(X(b.x0), Y(b.y0), bw, bh);
  ctx.clip();
  // a slab here and there out of a different batch
  for (let i = 0; i < 8 + Math.round(b.perim / 220); i++) {
    const side = rng.int(0, 3);
    if (side < 2) {
      const t = Math.floor(rng.range(b.x0, b.x1 - 32) / 32) * 32;
      ctx.fillStyle = C.walkAlt;
      ctx.fillRect(X(t), Y(side === 0 ? b.y0 : b.cy1), 32 * z, WALK * z);
    } else {
      const t = Math.floor(rng.range(b.y0, b.y1 - 32) / 32) * 32;
      ctx.fillStyle = C.walkAlt;
      ctx.fillRect(X(side === 2 ? b.x0 : b.cx1), Y(t), WALK * z, 32 * z);
    }
  }
  // stains: gum, oil, something that was thrown up in 1997
  for (let i = 0; i < 5 + Math.round(b.perim / 340); i++) {
    const [px, py] = ringSpot(rng, b, 8);
    const r = rng.range(3, 8);
    ctx.fillStyle = rng.chance(0.5) ? C.walkLine : C.walkAlt;
    ctx.beginPath();
    ctx.ellipse(X(px), Y(py), r * z, r * 0.7 * z, 0, 0, 6.2832);
    ctx.fill();
  }
  // paving slabs: a dark joint with a lit lip on the far side of it, which is
  // the whole trick to making a flat fill look like something laid by hand
  const joint = (px, py, w2, h2) => {
    ctx.fillStyle = C.walkLine;
    ctx.fillRect(X(px), Y(py), Math.max(1, w2 * z * 1.4), Math.max(1, h2 * z * 1.4));
    ctx.fillStyle = C.walkLip;
    ctx.fillRect(X(px) + (w2 > 1 ? 0 : Math.max(1, 1.4 * z)),
                 Y(py) + (h2 > 1 ? 0 : Math.max(1, 1.4 * z)),
                 Math.max(1, w2 * z), Math.max(1, h2 * z));
  };
  for (let t = b.x0; t <= b.x1; t += 32) { joint(t, b.y0, 1, WALK); joint(t, b.cy1, 1, WALK); }
  for (let t = b.y0; t <= b.y1; t += 32) { joint(b.x0, t, WALK, 1); joint(b.cx1, t, WALK, 1); }
  ctx.restore();

  // the kerb: a top face, and a face turned down to the road
  const K = 4;
  ctx.fillStyle = C.curbFace;
  ctx.fillRect(X(b.x0 - 2), Y(b.y0 - 2), bw + 4 * z, (K + 2) * z);
  ctx.fillRect(X(b.x0 - 2), Y(b.y0 - 2), (K + 2) * z, bh + 4 * z);
  ctx.fillRect(X(b.x1 - K), Y(b.y0 - 2), (K + 2) * z, bh + 4 * z);
  ctx.fillRect(X(b.x0 - 2), Y(b.y1 - K), bw + 4 * z, (K + 2) * z);
  ctx.fillStyle = C.curb;
  ctx.fillRect(X(b.x0), Y(b.y0), bw, K * z);
  ctx.fillRect(X(b.x0), Y(b.y0), K * z, bh);
  ctx.fillRect(X(b.x1 - K), Y(b.y0), K * z, bh);
  ctx.fillRect(X(b.x0), Y(b.y1 - K), bw, K * z);

  // litter: leaves, a wrapper, whatever the wind put there
  for (let i = 0; i < 5 + Math.round(b.perim / 340); i++) {
    const [px, py] = ringSpot(rng, b, 6);
    const s2 = rng.range(3, 6), a = rng.range(0, 6.28);
    ctx.save();
    ctx.translate(X(px), Y(py));
    ctx.rotate(a);
    ctx.fillStyle = C.coreShadow;
    ctx.beginPath(); ctx.ellipse(1.5 * z, 1.5 * z, s2 * z, s2 * 0.6 * z, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = C[rng.pick(['litter', 'litter2', 'litter3', 'litter4'])];
    ctx.beginPath(); ctx.ellipse(0, 0, s2 * z, s2 * 0.6 * z, 0, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  // the footprint the building stands in
  ctx.fillStyle = C.asphaltDark;
  ctx.fillRect(X(b.cx0), Y(b.cy0), (b.cx1 - b.cx0) * z, (b.cy1 - b.cy0) * z);
}

/** A random point on the paving of a block, `m` in from either edge of it. */
function ringSpot(rng, b, m) {
  const side = rng.int(0, 3);
  if (side < 2) {
    return [rng.range(b.x0 + m, b.x1 - m),
      side === 0 ? rng.range(b.y0 + m, b.cy0 - m) : rng.range(b.cy1 + m, b.y1 - m)];
  }
  return [side === 2 ? rng.range(b.x0 + m, b.cx0 - m) : rng.range(b.cx1 + m, b.x1 - m),
    rng.range(b.y0 + m, b.y1 - m)];
}

// A patch of ground never changes: same asphalt, same cracks, same slabs,
// every frame of the night.  So the city is cached in fixed square tiles and
// stamped after that, and the whole road surface costs one drawImage per tile
// instead of two hundred fills.  The tiles are a rendering lattice and
// nothing else - blocks and roads come in every size and straddle them
// freely, so a tile draws whatever overlaps it and lets its neighbour draw
// the rest.  The cache is thrown away when the zoom changes or the changeover
// moves to its next stage, which are the only two things that can alter it.
const TILES = new Map();
let tileKey = '';

function groundTile(o, tx, ty, city) {
  const key = `${o.z}|${MIX.scene}`;
  if (key !== tileKey) { TILES.clear(); tileKey = key; }
  const id = ty * 1000 + tx;
  let cv = TILES.get(id);
  if (cv) return cv;
  const s = Math.round(TILE * o.z);
  cv = blank(s, s);
  const g = cv.getContext('2d');
  // the tile is painted in world coordinates shifted onto its own canvas, so
  // every texture lands exactly where it would have
  const to = { ox: -tx * TILE * o.z, oy: -ty * TILE * o.z, z: o.z };
  const wx0 = tx * TILE, wy0 = ty * TILE, wx1 = wx0 + TILE, wy1 = wy0 + TILE;
  g.fillStyle = C.asphalt;
  g.fillRect(0, 0, s, s);
  tex(g, TEX.wear, 0, 0, s, s, to, 0.55);
  tex(g, TEX.grit, 0, 0, s, s, to, 0.65);
  city.roads.forEach((r, i) => {
    if (r.x1 > wx0 && r.x0 < wx1 && r.y1 > wy0 && r.y0 < wy1) drawRoadSeg(g, to, r, i);
  });
  city.crossings.forEach((c, i) => {
    if (c.x1 > wx0 && c.x0 < wx1 && c.y1 > wy0 && c.y0 < wy1) drawCrossing(g, to, c, i);
  });
  for (const b of city.blocksIn(wx0 - 8, wy0 - 8, wx1 + 8, wy1 + 8)) drawWalk(g, to, b);
  TILES.set(id, cv);
  return cv;
}

export function drawGround(ctx, o, tiles, city) {
  ensureTextures();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = C.asphalt;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const live = new Set();
  for (const { tx, ty } of tiles) {
    live.add(ty * 1000 + tx);
    ctx.drawImage(groundTile(o, tx, ty, city),
                  Math.round(o.ox + tx * TILE * o.z), Math.round(o.oy + ty * TILE * o.z));
  }
  // A tile is a megabyte or two.  Walking the width of the city would hold a
  // hundred of them otherwise, so anything off screen goes once there is a
  // screenful and a half of them.
  if (TILES.size > 24) for (const id of TILES.keys()) if (!live.has(id)) TILES.delete(id);

  // The crosses go on last, over the stamped tiles.  They cannot be baked
  // into one: the shaft of a cross is longer than the junction it stands in
  // and runs up the road past the block above, so a tile would cut it off at
  // its own edge and leave a stub - which is exactly what it did.
  if (MIX.scene > 0.01) {
    const w = VIEW_W / o.z, h = VIEW_H / o.z;
    const wx = -o.ox / o.z, wy = -o.oy / o.z;
    for (const j of city.junctions) {
      if (j.x < wx - 260 || j.x > wx + w + 260) continue;
      if (j.y < wy - 260 || j.y > wy + h + 260) continue;
      hellCross(ctx, o, j);
    }
  }
}

// ---------------------------------------------------------------------------
// Decorations - the thing hanging by the door, which is also a clue
// ---------------------------------------------------------------------------
function drawDeco(ctx, kind, sx, sy, z) {
  ctx.save();
  switch (kind) {
    case 'pumpkin': {
      const r = 9 * z;
      ctx.fillStyle = C.coreShadow;
      ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.95, r * 1.05, r * 0.3, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = C.decoPumpkinDark;
      ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.88, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = C.decoPumpkin;
      ctx.beginPath(); ctx.ellipse(sx, sy, r * 0.84, r * 0.84, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = C.decoPumpkinLit;
      ctx.beginPath(); ctx.ellipse(sx - r * 0.3, sy - r * 0.1, r * 0.34, r * 0.72, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = C.decoPumpkinDark;
      for (const d of [-0.62, 0.62]) {
        ctx.beginPath();
        ctx.ellipse(sx + d * r * 0.86, sy, r * 0.10, r * 0.8, 0, 0, 6.2832);
        ctx.fill();
      }
      ctx.fillStyle = C.tankLeg;                       // the stalk
      ctx.fillRect(sx - 1.5 * z, sy - r - 3 * z, 3 * z, 4 * z);
      // the face it is burning through
      ctx.fillStyle = C.decoGlow;
      ctx.beginPath();
      ctx.moveTo(sx - 5.5 * z, sy - 3 * z); ctx.lineTo(sx - 1.5 * z, sy - 1 * z);
      ctx.lineTo(sx - 5.5 * z, sy + 0.5 * z); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx + 5.5 * z, sy - 3 * z); ctx.lineTo(sx + 1.5 * z, sy - 1 * z);
      ctx.lineTo(sx + 5.5 * z, sy + 0.5 * z); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx - 5 * z, sy + 3 * z);
      ctx.lineTo(sx - 2 * z, sy + 5.5 * z); ctx.lineTo(sx + 1 * z, sy + 3.2 * z);
      ctx.lineTo(sx + 4 * z, sy + 5.5 * z); ctx.lineTo(sx + 5 * z, sy + 3 * z);
      ctx.lineTo(sx + 2 * z, sy + 2 * z); ctx.lineTo(sx - 2 * z, sy + 2 * z);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'cobweb': {
      ctx.strokeStyle = C.decoCobweb;
      ctx.lineWidth = Math.max(1, z * 0.7);
      const ax = sx + 10 * z, ay = sy - 16 * z;        // anchored in the corner
      for (let r = 4; r <= 16; r += 4) {
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
          const a = Math.PI * 0.5 + (i / 6) * Math.PI * 0.5;
          const px = ax + Math.cos(a) * r * z, py = ay + Math.sin(a) * r * z;
          if (i === 0) ctx.moveTo(px, py);
          else {
            const pa = Math.PI * 0.5 + ((i - 0.5) / 6) * Math.PI * 0.5;
            ctx.quadraticCurveTo(ax + Math.cos(pa) * r * 0.84 * z, ay + Math.sin(pa) * r * 0.84 * z, px, py);
          }
        }
        ctx.stroke();
      }
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI * 0.5 + (i / 6) * Math.PI * 0.5;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + Math.cos(a) * 17 * z, ay + Math.sin(a) * 17 * z);
        ctx.stroke();
      }
      break;
    }
    case 'skeleton': {
      ctx.fillStyle = C.coreShadow;
      ctx.beginPath(); ctx.ellipse(sx + 2 * z, sy + 2 * z, 7 * z, 12 * z, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = C.decoSkeleton;
      ctx.beginPath(); ctx.ellipse(sx, sy - 12 * z, 4.5 * z, 5 * z, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = C.decoFace;
      ctx.beginPath(); ctx.ellipse(sx - 1.8 * z, sy - 12.5 * z, 1.4 * z, 1.8 * z, 0, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx + 1.8 * z, sy - 12.5 * z, 1.4 * z, 1.8 * z, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = C.decoSkeleton;
      ctx.fillRect(sx - 1.6 * z, sy - 7 * z, 3.2 * z, 9 * z);
      for (let i = 0; i < 4; i++) ctx.fillRect(sx - 4 * z, sy - 6 * z + i * 2.4 * z, 8 * z, 1.2 * z);
      ctx.fillRect(sx - 7 * z, sy - 6 * z, 3 * z, 1.4 * z);
      ctx.fillRect(sx + 4 * z, sy - 6 * z, 3 * z, 1.4 * z);
      ctx.fillRect(sx - 3 * z, sy + 2 * z, 1.6 * z, 6 * z);
      ctx.fillRect(sx + 1.4 * z, sy + 2 * z, 1.6 * z, 6 * z);
      break;
    }
    case 'bats': {
      // three of them, strung far enough apart to be three of them, and each
      // edged so a black paper bat still reads against a black window
      for (let i = -1; i <= 1; i++) {
        const bx = sx + i * 14 * z, by = sy - 15 * z + Math.abs(i) * 7 * z;
        ctx.strokeStyle = C.decoCobweb;
        ctx.lineWidth = Math.max(1, z * 0.5);
        ctx.beginPath(); ctx.moveTo(bx, by - 15 * z); ctx.lineTo(bx, by - 3 * z); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx - 3 * z, by - 3.5 * z, bx - 7 * z, by - 2.5 * z);
        ctx.quadraticCurveTo(bx - 4.5 * z, by - 0.5 * z, bx - 4 * z, by + 2.5 * z);
        ctx.quadraticCurveTo(bx - 2.5 * z, by + 0.5 * z, bx, by + 2 * z);
        ctx.quadraticCurveTo(bx + 2.5 * z, by + 0.5 * z, bx + 4 * z, by + 2.5 * z);
        ctx.quadraticCurveTo(bx + 4.5 * z, by - 0.5 * z, bx + 7 * z, by - 2.5 * z);
        ctx.quadraticCurveTo(bx + 3 * z, by - 3.5 * z, bx, by);
        ctx.fillStyle = C.decoBats;
        ctx.fill();
        ctx.lineWidth = Math.max(1, z * 0.6);
        ctx.stroke();
        ctx.beginPath(); ctx.ellipse(bx, by - 1.2 * z, 1.9 * z, 2.3 * z, 0, 0, 6.2832); ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case 'ghost': {
      const gx = sx, gy = sy - 10 * z;
      ctx.strokeStyle = C.decoCobweb;
      ctx.lineWidth = Math.max(1, z * 0.5);
      ctx.beginPath(); ctx.moveTo(gx, gy - 22 * z); ctx.lineTo(gx, gy - 7 * z); ctx.stroke();
      ctx.fillStyle = C.decoGhost;
      ctx.beginPath();
      ctx.moveTo(gx - 7 * z, gy + 9 * z);
      ctx.quadraticCurveTo(gx - 8 * z, gy - 8 * z, gx, gy - 8 * z);
      ctx.quadraticCurveTo(gx + 8 * z, gy - 8 * z, gx + 7 * z, gy + 9 * z);
      ctx.quadraticCurveTo(gx + 3.5 * z, gy + 5 * z, gx, gy + 9 * z);
      ctx.quadraticCurveTo(gx - 3.5 * z, gy + 5 * z, gx - 7 * z, gy + 9 * z);
      ctx.fill();
      ctx.fillStyle = C.decoFace;
      ctx.beginPath(); ctx.ellipse(gx - 2.5 * z, gy - 3 * z, 1.5 * z, 2 * z, 0, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.ellipse(gx + 2.5 * z, gy - 3 * z, 1.5 * z, 2 * z, 0, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.ellipse(gx, gy + 1.5 * z, 1.8 * z, 2.4 * z, 0, 0, 6.2832); ctx.fill();
      break;
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Doors
// ---------------------------------------------------------------------------
function drawDoor(ctx, door, o, isParty, pulse) {
  const { ox, oy, z } = o;
  const col = COLOR_DOORS ? door.color : { hex: '#4a4a4a', trim: '#606060' };
  const px = ox + door.x * z;        // doorstep, centred on the south facade
  const py = oy + door.y * z;

  // a short building gets a short door, so the lintel over it stays on the
  // wall instead of climbing onto the roof behind
  const wallH = door.plot ? door.plot.wallH : 88;
  const dw = 36 * z, dh = Math.min(54, wallH - 12) * z;
  const dx = px - dw / 2, dy = py - dh;

  // the reveal: the wall is thick, and the door sits back inside it
  ctx.fillStyle = C.doorReveal;
  ctx.fillRect(dx - 6 * z, dy - 8 * z, dw + 12 * z, dh + 8 * z);

  // the step, with a nosing and the dark under it
  const SD = 20 * z, SW = 56 * z;
  drop(ctx, px - SW / 2, py, SW, SD, 3 * z, 3 * z);
  ctx.fillStyle = C.stoop;
  ctx.fillRect(px - SW / 2, py, SW, SD);
  ctx.fillStyle = C.curb;
  ctx.fillRect(px - SW / 2, py, SW, 2 * z);
  ctx.fillStyle = C.coreShadow;
  ctx.fillRect(px - SW / 2, py + SD - 3 * z, SW, 3 * z);

  // the frame
  ctx.fillStyle = C.doorFrame;
  ctx.fillRect(dx - 4 * z, dy - 5 * z, dw + 8 * z, dh + 5 * z);
  ctx.fillStyle = C.frame;
  ctx.fillRect(dx - 4 * z, dy - 5 * z, dw + 8 * z, 1.5 * z);

  // the door itself: painted wood with two sunk panels
  ctx.fillStyle = col.hex;
  ctx.fillRect(dx, dy, dw, dh);
  for (const [pyy, phh] of [[0.10, 0.34], [0.52, 0.38]]) {
    const ax = dx + 5 * z, ay = dy + dh * pyy, aw = dw - 10 * z, ah = dh * phh;
    ctx.fillStyle = C.doorFrame;
    ctx.fillRect(ax, ay, aw, ah);
    ctx.fillStyle = col.trim;
    ctx.fillRect(ax + 1.5 * z, ay + 1.5 * z, aw - 3 * z, ah - 3 * z);
    ctx.fillStyle = col.hex;
    ctx.fillRect(ax + 3 * z, ay + 3 * z, aw - 6 * z, ah - 6 * z);
  }
  // the handle
  ctx.fillStyle = C.doorHandle;
  ctx.beginPath();
  ctx.ellipse(dx + dw - 7 * z, dy + dh * 0.54, 2.6 * z, 2.6 * z, 0, 0, 6.2832);
  ctx.fill();
  ctx.fillStyle = C.doorHandleLit;
  ctx.beginPath();
  ctx.ellipse(dx + dw - 7.7 * z, dy + dh * 0.54 - 0.7 * z, 1 * z, 1 * z, 0, 0, 6.2832);
  ctx.fill();
  // a number plate, screwed on crooked forty years ago
  ctx.fillStyle = C.plate;
  ctx.fillRect(dx + 4 * z, dy + 4 * z, 12 * z, 7 * z);
  ctx.fillStyle = C.doorFrame;
  ctx.font = `${Math.max(5, 6 * z)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(String(door.number), dx + 10 * z, dy + 10 * z);

  // a lintel over the opening
  ctx.fillStyle = C.ledge;
  ctx.fillRect(dx - 8 * z, dy - 9 * z, dw + 16 * z, 4 * z);
  ctx.fillStyle = C.coreShadow;
  ctx.fillRect(dx - 8 * z, dy - 5 * z, dw + 16 * z, 1.5 * z);

  if (door.tried) {
    ctx.strokeStyle = C.triedMark;   // has to read against the red
    ctx.lineWidth = Math.max(2, 3 * z);
    ctx.beginPath();
    ctx.moveTo(dx + 5 * z, dy + 6 * z); ctx.lineTo(dx + dw - 5 * z, dy + dh - 6 * z);
    ctx.moveTo(dx + dw - 5 * z, dy + 6 * z); ctx.lineTo(dx + 5 * z, dy + dh - 6 * z);
    ctx.stroke();
  }

  drawDeco(ctx, door.deco.key, px + 34 * z, py - 30 * z, z);

  if (isParty) {
    // The only tell on the door itself, and only from close up: light getting
    // out around a door that is shut on something loud.  It is painted on,
    // like everything else here - the pulse is the colour changing, not the
    // opacity.
    const lit = lerpHex(C.partyLeak, C.partyLeakLit, pulse);
    ctx.fillStyle = lit;
    ctx.fillRect(dx - 2 * z, dy - 2 * z, dw + 4 * z, 2 * z);
    ctx.fillRect(dx - 2 * z, dy - 2 * z, 2 * z, dh + 4 * z);
    ctx.fillRect(dx + dw, dy - 2 * z, 2 * z, dh + 4 * z);
    ctx.fillRect(dx - 3 * z, py - 3 * z, dw + 6 * z, 3 * z);
  }
}

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------
// A block is a row, or a grid, of buildings standing wall to wall: its core
// was cut into plots and every plot is a house of its own, with its own
// colour, its own height and - if it stands along the front of the block -
// its own red door.  They are drawn back to front, so each facade covers the
// roof of whatever is behind it.
//
// Nothing here is measured off a fixed 256-pixel core any more.  A building
// is laid out from its plot: the facade is as wide as the plot, it gets as
// many windows as fit across it, and whatever stands on the roof is placed
// and then checked against the room there actually is.
export function drawBuilding(ctx, block, o, city, t) {
  const { z } = o;
  // the dark the whole mass puts on the pavement around itself, once for the
  // block - there is no daylight between two buildings that share a wall
  ctx.fillStyle = C.coreShadow;
  ctx.fillRect(o.ox + (block.cx0 - 7) * z, o.oy + (block.cy0 - 7) * z,
               (block.cx1 - block.cx0 + 14) * z, (block.cy1 - block.cy0 + 14) * z);
  // A block may be a thousand pixels across and run off both sides of the
  // screen, so the buildings on it are culled one at a time rather than all
  // together.  The margin covers the stoop, the decoration and the shadow.
  for (const plot of block.buildings) {
    if (o.ox + (plot.x1 + 32) * z < 0 || o.ox + (plot.x0 - 32) * z > VIEW_W) continue;
    if (o.oy + (plot.y1 + 48) * z < 0 || o.oy + (plot.y0 - 32) * z > VIEW_H) continue;
    drawPlot(ctx, plot, block, o, t);
  }
}

function drawPlot(ctx, plot, block, o, t) {
  const { ox, oy, z } = o;
  const X = (wx) => ox + wx * z;
  const Y = (wy) => oy + wy * z;
  const { x0, y0, x1, y1 } = plot;
  const w = (x1 - x0) * z;
  const cw = x1 - x0, ch = y1 - y0;
  const wallH = plot.wallH;                      // its own height, and its own roofline
  const rh = (ch - wallH) * z;
  const rng = makeRng(plot.seed);
  // a roll that cannot turn itself inside out on a small roof
  const rr = (lo, hi) => (hi <= lo ? lo : rng.range(lo, hi));
  const base = lerpHex(plot.base, plot.baseM, MIX.scene);
  const baseDark = lerpHex(plot.baseDark, plot.baseDarkM, MIX.scene);
  const roof = lerpHex(plot.roof, plot.roofM, MIX.scene);
  const roofLight = lerpHex(plot.roofLight, plot.roofLightM, MIX.scene);
  ctx.imageSmoothingEnabled = false;

  // --- roof ---------------------------------------------------------------
  const deck = y0 + (ch - wallH);                // where the roof stops
  ctx.fillStyle = roof;
  ctx.fillRect(X(x0), Y(y0), w, rh);
  tex(ctx, TEX.gravel, X(x0), Y(y0), w, rh, o, 0.35);
  tex(ctx, TEX.wear, X(x0), Y(y0), w, rh, o, 0.8);

  // tar-paper seams
  ctx.fillStyle = roofLight;
  for (let ry = y0 + 16; ry < deck - 8; ry += 18)
    ctx.fillRect(X(x0 + 6), Y(ry), w - 12 * z, Math.max(1, 1.2 * z));

  // a puddle that has been there since it last rained
  {
    const pw = rr(30, 60), ph = pw * 0.45;
    const px = rr(x0 + 30, x1 - 30 - pw), py = rr(y0 + 40, deck - 30 - ph);
    ctx.fillStyle = C.roofVentShadow;
    ctx.beginPath();
    ctx.ellipse(X(px + pw / 2), Y(py + ph / 2), pw / 2 * z, ph / 2 * z, 0, 0, 6.2832);
    ctx.fill();
  }

  // skylights, as many as the frontage has room for
  for (let i = 0; i < 4; i++) {
    const sx2 = x0 + 26 + i * 110, sy2 = y0 + 30 + rr(0, 26);
    if (sx2 + 40 > x1 - 10 || sy2 + 28 > deck - 6) break;
    const lit = rng.chance(0.45);
    drop(ctx, X(sx2 - 2), Y(sy2 - 2), 40 * z, 28 * z, 3 * z, 4 * z);
    ctx.fillStyle = C.skylightFrame;
    ctx.fillRect(X(sx2 - 2), Y(sy2 - 2), 40 * z, 28 * z);
    ctx.fillStyle = lit ? C.litSkylight : C.dark;
    ctx.fillRect(X(sx2), Y(sy2), 36 * z, 24 * z);
    if (!lit) { ctx.fillStyle = C.glassRefl; ctx.fillRect(X(sx2), Y(sy2), 16 * z, 10 * z); }
    ctx.fillStyle = C.skylightFrame;
    ctx.fillRect(X(sx2 + 17), Y(sy2), 2 * z, 24 * z);
  }
  // air handling units
  for (let i = 0; i < 2; i++) {
    const aw = rr(26, 40), ah = rr(18, 26);
    const ax2 = rr(x0 + 20, x1 - 20 - aw);
    const ay2 = rr(y0 + 66, deck - 12 - ah);
    if (ay2 + ah > deck - 6) continue;
    drop(ctx, X(ax2), Y(ay2), aw * z, ah * z, 4 * z, 5 * z);
    ctx.fillStyle = C.roofVent;
    ctx.fillRect(X(ax2), Y(ay2), aw * z, ah * z);
    ctx.fillStyle = C.roofVentTop;
    ctx.fillRect(X(ax2), Y(ay2), aw * z, 4 * z);
    ctx.fillStyle = C.roofVentSlat;
    for (let v = 0; v < 3; v++) ctx.fillRect(X(ax2 + 4), Y(ay2 + 8 + v * 5), (aw - 8) * z, 2 * z);
  }
  // water tank on stilts
  if (deck - y0 > 70) {
    const tx = rr(x0 + 30, x1 - 70), ty = y0 + 24;
    drop(ctx, X(tx), Y(ty), 44 * z, 46 * z, 5 * z, 7 * z);
    ctx.fillStyle = C.tankLeg;
    for (let l = 0; l < 4; l++) ctx.fillRect(X(tx + 4 + l * 11), Y(ty + 30), 3 * z, 14 * z);
    // three flat bands make a barrel without a gradient in sight
    ctx.fillStyle = C.tankDark;
    ctx.fillRect(X(tx), Y(ty), 44 * z, 32 * z);
    ctx.fillStyle = C.tankBody;
    ctx.fillRect(X(tx + 5), Y(ty), 30 * z, 32 * z);
    ctx.fillStyle = C.tankTop;
    ctx.fillRect(X(tx + 22), Y(ty), 9 * z, 32 * z);
    ctx.fillStyle = C.tankTop;
    ctx.beginPath();
    ctx.ellipse(X(tx + 22), Y(ty + 2), 22 * z, 5 * z, 0, 0, 6.2832);
    ctx.fill();
    ctx.fillStyle = C.tankBand;
    for (let b = 0; b < 3; b++) ctx.fillRect(X(tx), Y(ty + 10 + b * 8), 44 * z, 1.6 * z);
  }
  // roof hatch and a vent pipe
  {
    const hx = x1 - 54, hy = deck - 34;
    drop(ctx, X(hx), Y(hy), 24 * z, 18 * z, 3 * z, 4 * z);
    ctx.fillStyle = C.hatchBody;
    ctx.fillRect(X(hx), Y(hy), 24 * z, 18 * z);
    ctx.fillStyle = C.hatchLid;
    ctx.fillRect(X(hx), Y(hy), 24 * z, 5 * z);
    ctx.fillStyle = C.pipe;
    ctx.fillRect(X(x0 + 20), Y(deck - 26), 5 * z, 16 * z);
  }

  // the parapet running round the roof: this is what gives the block height
  const P = 10;
  ctx.fillStyle = C.wallTop;
  ctx.fillRect(X(x0), Y(y0), w, P * z);
  ctx.fillRect(X(x0), Y(y0), P * z, rh);
  ctx.fillRect(X(x1 - P), Y(y0), P * z, rh);
  ctx.fillStyle = C.wallTopDark;
  ctx.fillRect(X(x0), Y(y0 + P), w, 4 * z);
  ctx.fillRect(X(x0 + P), Y(y0 + P), 4 * z, rh - P * z);
  ctx.fillRect(X(x1 - P - 4), Y(y0 + P), 4 * z, rh - P * z);

  // upper storeys on the north face, so the block has a back as well as a
  // front - but only on the building at the back, since anything in front of
  // it is looking at that building's wall and not at the sky
  if (plot.y0 === block.cy0) for (let c = 0; c < 20; c++) {
    const wx = x0 + 16 + c * 40;
    if (wx + 22 > x1 - 10) break;
    const lit = rng.chance(0.4);
    ctx.fillStyle = C.doorReveal;
    ctx.fillRect(X(wx - 1), Y(y0 + 13), 24 * z, 16 * z);
    ctx.fillStyle = lit ? C.litSkylight : C.unlit;
    ctx.fillRect(X(wx), Y(y0 + 14), 22 * z, 14 * z);
    if (!lit) { ctx.fillStyle = C.glassRefl; ctx.fillRect(X(wx), Y(y0 + 14), 10 * z, 6 * z); }
  }

  // --- the front wall -----------------------------------------------------
  const fy = y1 - wallH;
  ctx.fillStyle = C.wallTop;                    // parapet over the facade
  ctx.fillRect(X(x0), Y(fy - 10), w, 10 * z);
  ctx.fillStyle = C.wallTopDark;
  ctx.fillRect(X(x0), Y(fy - 3), w, 3 * z);

  ctx.fillStyle = base;
  ctx.fillRect(X(x0), Y(fy), w, wallH * z);
  const material = plot.seed % 3 === 0 ? TEX.stucco : TEX.brick;
  tex(ctx, material, X(x0), Y(fy), w, wallH * z, o, 0.95);
  tex(ctx, TEX.wear, X(x0), Y(fy), w, wallH * z, o, 0.55);

  // a string course between the storeys
  ctx.fillStyle = C.ledge;
  ctx.fillRect(X(x0), Y(fy + 40), w, 3 * z);
  ctx.fillStyle = C.coreShadow;
  ctx.fillRect(X(x0), Y(fy + 43), w, 2 * z);

  // the plinth the whole thing stands on
  ctx.fillStyle = baseDark;
  ctx.fillRect(X(x0), Y(y1 - 12), w, 12 * z);
  ctx.fillStyle = C.coreShadow;
  ctx.fillRect(X(x0), Y(y1 - 3), w, 3 * z);

  // --- windows ------------------------------------------------------------
  // as many as go across this particular frontage, centred on it, and none
  // of them where the door is
  // A shallow plot gets a short building, and a short building has room for
  // one row of windows rather than two: a row needs 32 more of the facade,
  // and anything that does not fit ends up hanging below the plinth.
  const PITCH = 46, WINW = 30;
  const cols = Math.max(1, Math.floor((cw - 8 - WINW) / PITCH) + 1);
  const rows = Math.max(1, Math.min(2, Math.floor((wallH - 52) / 32) + 1));
  const span = (cols - 1) * PITCH + WINW;
  const first = x0 + (cw - span) / 2;
  const doorX = (x0 + x1) / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = Math.round(first + c * PITCH);
      const wy = fy + 14 + r * 32;
      // the door lives in the bottom row.  The gap kept for it is the door
      // and its frame and no more - on a narrow frontage a wider gap takes
      // out every window on the wall and leaves a house that is all door.
      if (r === rows - 1 && wx + WINW > doorX - 28 && wx < doorX + 28) continue;
      const variant = rng.chance(0.55) ? rng.int(1, 3) : 0;
      const cv = windowPart(variant, z);
      ctx.drawImage(cv, Math.round(X(wx - 2)), Math.round(Y(wy - 2)));
    }
  }

  if (plot.door) drawDoor(ctx, plot.door, o, plot.door.isParty, 0.5 + 0.5 * Math.sin(t * 4));
}

// ---------------------------------------------------------------------------
// Street lamps
// ---------------------------------------------------------------------------
/**
 * One at each corner of the pavement, and another halfway down any side long
 * enough to be dark in the middle otherwise - which is a thing that can only
 * happen now that a block may be twice as long as its neighbour.
 */
export function lampPositions(block) {
  const { rx0, ry0, rx1, ry1 } = block;
  const out = [
    { x: rx0, y: ry0 }, { x: rx1, y: ry0 },
    { x: rx0, y: ry1 }, { x: rx1, y: ry1 },
  ];
  const GAP = 380;
  const nx = Math.floor((rx1 - rx0) / GAP), ny = Math.floor((ry1 - ry0) / GAP);
  for (let i = 1; i <= nx; i++) {
    const x = rx0 + (rx1 - rx0) * (i / (nx + 1));
    out.push({ x, y: ry0 }, { x, y: ry1 });
  }
  for (let i = 1; i <= ny; i++) {
    const y = ry0 + (ry1 - ry0) * (i / (ny + 1));
    out.push({ x: rx0, y }, { x: rx1, y });
  }
  return out;
}

export function drawLamp(ctx, lx, ly, o, t) {
  const { ox, oy, z } = o;
  const sx = ox + lx * z, sy = oy + ly * z;
  ctx.imageSmoothingEnabled = false;

  // the shadow the column lays across the pavement
  ctx.fillStyle = C.coreShadow;
  ctx.fillRect(sx + 3 * z, sy - 2 * z, 30 * z, 5 * z);
  // the base, then the column with a lit edge down one side
  ctx.fillStyle = C.lampMetal;
  ctx.fillRect(sx - 8 * z, sy - 5 * z, 16 * z, 5 * z);
  ctx.fillStyle = C.lampPole;
  ctx.fillRect(sx - 3.5 * z, sy - 62 * z, 7 * z, 57 * z);
  ctx.fillStyle = C.lampPoleLit;
  ctx.fillRect(sx + 1.5 * z, sy - 62 * z, 2 * z, 57 * z);
  // the arm out over the road
  ctx.fillStyle = C.lampPole;
  ctx.fillRect(sx - 2 * z, sy - 70 * z, 13 * z, 4 * z);
  ctx.fillRect(sx - 3.5 * z, sy - 70 * z, 7 * z, 9 * z);

  const hx = sx + 11 * z, hy = sy - 69 * z;
  // Below half way through the changeover it is a lamp; above it, it always
  // was a torch.  The city steps between the two - it does not dissolve.
  if (MIX.scene < 0.5) {
    ctx.fillStyle = C.lampMetal;
    ctx.fillRect(hx - 12 * z, hy - 4 * z, 22 * z, 5 * z);
    ctx.fillStyle = C.lamp;
    ctx.fillRect(hx - 10 * z, hy + 1 * z, 18 * z, 4 * z);
    ctx.fillStyle = C.lampGlass;
    ctx.fillRect(hx - 8 * z, hy + 1 * z, 14 * z, 2 * z);
  } else {
    drawFlame(ctx, hx, hy + 4 * z, z, t, lx * 0.017 + ly * 0.011);
  }
}

/** A guttering fire where the bulb used to be. */
function drawFlame(ctx, sx, sy, z, t, phase) {
  ctx.fillStyle = C.torchCup;
  ctx.beginPath();
  ctx.moveTo(sx - 8 * z, sy - 7 * z);
  ctx.lineTo(sx + 8 * z, sy - 7 * z);
  ctx.lineTo(sx + 5 * z, sy);
  ctx.lineTo(sx - 5 * z, sy);
  ctx.closePath();
  ctx.fill();

  const h = (26 + 5 * Math.sin(t * 7 + phase)) * z;
  const sway = Math.sin(t * 5.5 + phase) * 4 * z;
  for (const [k, col] of [[1, C.flameOuter], [0.62, C.flameMid], [0.3, C.flameCore]]) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(sx - 7 * k * z, sy - 6 * z);
    ctx.quadraticCurveTo(sx - 9 * k * z, sy - h * 0.5, sx + sway * k, sy - h * k);
    ctx.quadraticCurveTo(sx + 9 * k * z, sy - h * 0.5, sx + 7 * k * z, sy - 6 * z);
    ctx.closePath();
    ctx.fill();
  }
}
