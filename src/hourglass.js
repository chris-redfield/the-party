// ---------------------------------------------------------------------------
// THE HOURGLASS - the night, drawn as the only clock the vampire cares about
// ---------------------------------------------------------------------------
// There are no digits on it.  The top bulb holds the night: deep grey sand
// with a few stars in it and a moon standing in the middle.  The bottom bulb
// is what the night turns into.  The sand does not just move from one to the
// other, it is the same sand: the moon is eaten away as the level drops past
// it, and the same grains build the sun back up in the bottom, from the rim
// of its lowest ray to the top of the disc.  When the moon is gone the sun is
// whole, and that is 6:00 AM.
//
// It used to be flat pixel art on a grid of cells, which is how the whole game
// looked once.  It is not how it looks now: the buildings, the children and
// the two chalices next to it are all a hand-drawn line round a flat fill, and
// a 4px-gridded object in the opposite corner of the same screen was the last
// thing on it still made out of a different medium.  So it is cut the same way
// as everything else now - `inkEdge` from src/ink.js, the line that wanders,
// varies in weight and overshoots its corners.
//
// Three things that took a rewrite to learn, and all three would look like
// bugs if you met them from the other end:
//
//   1. THE LINE IS TWO COLOURS, not one.  The bone is a pale fill, so the
//      line on it is the city's near-black ink.  The glass has nothing in it
//      but the dark inside the bulb, so the line on it has to be chalk - a
//      light line on a dark ground.  Same hand, opposite end of the scale.
//      Drawing the whole object in either one alone loses half of it.
//   2. NOTHING ANIMATED MAY GO THROUGH `inkEdge`.  The wobble it rolls is
//      cached per edge on the edge's LENGTH, so a line whose length changes
//      every frame - the sand's surface, the falling thread - mints a new
//      cache entry every frame for ever.  The moving parts are drawn as plain
//      paths with a wobble of their own, which is what the chalices do with
//      the drink for the same reason.
//   3. THE SAND EATS THE DRAWING, it does not hide it.  The moon and the sun
//      are drawn whole, outline and all, and CLIPPED to the sand that is left
//      (or that has arrived).  A line cut off mid-stroke is what makes the
//      moon look ground down rather than switched off.
//
// The layout is still measured on the old 31 x 46 grid of `GLASS_UNIT` cells,
// so the clock sits exactly where it sat and the HUD around it did not move.
// Nothing is snapped to that grid any more; it is only the ruler.
// ---------------------------------------------------------------------------
import { GLASS_UNIT, GLASS } from './config.js';
import { inkEdge, inkPoly, INK_COLOR } from './ink.js';

const U = GLASS_UNIT;
const HALF = 15.5;                  // grid columns run -HALF .. +HALF
const PLATE = 4;                    // bone end caps
const BULB = 18;                    // rows of glass in each bulb
const NECK = 2;
const ROWS = PLATE + BULB + NECK + BULB + PLATE;

export const GLASS_W = HALF * 2 * U;
export const GLASS_H = ROWS * U;

const TOP0 = PLATE;                 // 4  - the top bulb's shoulder
const NECK0 = TOP0 + BULB;          // 22 - where it has pinched to nothing
const NECK1 = NECK0 + NECK;         // 24
const BOT1 = NECK1 + BULB;          // 42 - the bottom bulb's floor

// The bulb profile: wide shoulders falling away to a pinched neck.  One curve
// drives the glass, the sand and the two levels.  `t` runs 0 at the shoulder
// to 1 at the neck.
const HW_MAX = 11, HW_MIN = 1.15;
const hwAt = (t) => HW_MIN + (HW_MAX - HW_MIN) * Math.pow(1 - t, 0.7);

// Sampled once, for turning "how full is it" into "where is the surface".
// The bulb is not a box, so a level two thirds of the way up does NOT hold two
// thirds of the sand - it holds much more, because the glass is wider there.
const SLICES = 72;
const TOP_W = Array.from({ length: SLICES }, (_, i) => hwAt((i + 0.5) / SLICES) * 2);
const BOT_W = [...TOP_W].reverse();
const AREA = TOP_W.reduce((a, w) => a + w, 0);

// where the lower reflection hangs, just under the waist
const GLINT_LO = NECK1 + 2.2;

const MOUND = 3.2;      // rows the bottom heap stands proud of its own level
const DIP = 1.6;        // rows the top surface is sucked down over the drain

// There is no colour in this object at all except the sun.  The bone, the
// glass, the night sand, the stars, the moon it is grinding down, the grains
// coming through the neck and the cracks that open in the last hour are all
// greys - the same greys the old violet-and-gold palette worked out to, so
// nothing has changed value or lost its separation, only its hue.
//
// The sun keeps one, and it is the game's own red: the thing building up in
// the bottom bulb is the thing that ends you, and it is the exact red of the
// screen it ends you on.  It is the only hue in the corner of the screen, so
// the eye goes to it, which is the whole point of a clock you cannot read.
const C = {
  bone:    '#c0c0c0',
  boneLo:  '#9a9a9a',
  socket:  '#191919',
  chalk:   '#d2d2d2',   // the line on the glass - light, because the glass is dark
  glint:   '#f0f0f0',
  thread:  '#8b8b8b',
  threadLo:'#6e6e6e',
  void:    '#181818',
  night:   '#434343',
  star:    '#bababa',
  moon:    '#e9e9e9',
  crater:  '#b1b1b1',
  dawn:    '#6e6e6e',
  crack:   '#e4e4e4',
  // the sun, and nothing else
  sun:     '#cf1206',   // the same red the death screen is
  sunHot:  '#ff5544',   // ... and what it goes to in the last hour
  ray:     '#8f1b10',
  // the sockets in the last hour are the sun's light in them, not a colour
  // of their own, so they are the only other thing allowed to be red
  ember:   '#e8200c',
};

// Seeds.  Every wobble in here is a pure function of one of these and an edge
// number - never of `t`, never of where the clock happens to be on screen.
// Drive any of it from the frame and the whole object crawls, which on a thing
// this small reads as static rather than as a drawing.
const S_GLASS = 0x5ea1, S_BONE = 0x71d3, S_MOON = 0x2c09,
      S_SUN = 0x9f42, S_CRACK = 0x3b6e;

// --- the moon: a disc with a bite out of it ---------------------------------
// Built as a real crescent rather than two overlapping circles, because the
// outline has to be ONE closed line or the hand-drawn edge shows a seam where
// the bite meets the rim.  The two arcs are stitched at their intersections.
const MOON_CY = TOP0 + 6.5, MOON_R = 5.5, BITE_X = 3.6, BITE_R = 5.2;
const MOON_PTS = (() => {
  const xi = (BITE_X * BITE_X + MOON_R * MOON_R - BITE_R * BITE_R) / (2 * BITE_X);
  const yi = Math.sqrt(Math.max(0, MOON_R * MOON_R - xi * xi));
  const a0 = Math.atan2(yi, xi);              // where the two rims cross
  const b0 = Math.atan2(yi, xi - BITE_X);     // the same point, from the bite
  const pts = [];
  for (let i = 0; i <= 9; i++) {              // the long way round the moon
    const a = a0 + (2 * Math.PI - 2 * a0) * (i / 9);
    pts.push([Math.cos(a) * MOON_R, MOON_CY + Math.sin(a) * MOON_R]);
  }
  // and back along the bite - the FAR side of it, through 180 degrees.  Take
  // the near side by mistake and the two arcs bulge the same way: the moon
  // comes out a fat egg with a seam in it rather than a crescent.
  for (let i = 0; i <= 6; i++) {
    const b = (2 * Math.PI - b0) - (2 * Math.PI - 2 * b0) * (i / 6);
    pts.push([BITE_X + Math.cos(b) * BITE_R, MOON_CY + Math.sin(b) * BITE_R]);
  }
  return pts;
})();
const CRATERS = [[-2.6, MOON_CY - 2.2, 1.0], [-1.4, MOON_CY + 2.6, 0.7]];

// Stars in the night sand.  Hand-placed to sit clear of the moon; each is a
// four-pointed spark rather than a dot, because a dot at this size is dust.
const STARS = [[-8, TOP0 + 1.2, 0.9], [7, TOP0 + 2.4, 1.1], [9, TOP0 + 3.6, 0.7],
               [-7, TOP0 + 4.6, 0.8], [6, TOP0 + 5.6, 0.9], [-6, TOP0 + 8.4, 1.0],
               [5, TOP0 + 10.5, 0.8], [-4, TOP0 + 12.4, 0.9]];

// --- the sun (bottom bulb) ---------------------------------------------------
const SUN_CY = BOT1 - 6.5, SUN_R = 4.4;
const SUN_PTS = Array.from({ length: 11 }, (_, i) => {
  const a = (i / 11) * Math.PI * 2;
  return [Math.cos(a) * SUN_R, SUN_CY + Math.sin(a) * SUN_R];
});
const RAYS = Array.from({ length: 8 }, (_, k) => {
  const a = k * Math.PI / 4 + 0.19;
  return [[Math.cos(a) * (SUN_R + 1.1), SUN_CY + Math.sin(a) * (SUN_R + 1.1)],
          [Math.cos(a) * (SUN_R + 3.0), SUN_CY + Math.sin(a) * (SUN_R + 3.0)]];
});

// Cracks that open in the last hour, in the order they open: one running down
// from the right shoulder, one climbing the bottom bulb.  A crack is a run of
// short segments that do not line up, revealed a segment at a time - a line
// that grows smoothly is a wipe, and a wipe reads as an effect.
const CRACKS = [
  [[9.6, TOP0 + 0.6], [8.2, TOP0 + 2.4], [8.8, TOP0 + 4.0], [7.0, TOP0 + 5.8]],
  [[-9.8, BOT1 - 0.4], [-9.0, BOT1 - 2.2], [-9.6, BOT1 - 3.8], [-7.6, BOT1 - 5.6]],
];

/** Where the surface sits, given how much of one bulb's sand is below it. */
function level(ws, y0, frac) {
  const target = Math.max(0, Math.min(1, frac)) * AREA;
  let acc = 0;
  for (let i = ws.length - 1; i >= 0; i--) {
    if (acc + ws[i] >= target) {
      const f = ws[i] === 0 ? 0 : (target - acc) / ws[i];
      return y0 + (i + 1 - f) * (BULB / SLICES);
    }
    acc += ws[i];
  }
  return y0;
}

/**
 * @param p  0 at midnight, 1 at sunrise
 * @param t  seconds, for the grains
 */
export function drawHourglass(ctx, ox, oy, p, t, panic = false) {
  p = Math.max(0, Math.min(1, p));

  // grid units -> screen.  Everything below is written in grid units.
  const X = (gx) => ox + (gx + HALF) * U;
  const Y = (gy) => oy + gy * U;
  const P = (pt) => [X(pt[0]), Y(pt[1])];
  const W = GLASS.weight, WB = GLASS.wobble, OV = GLASS.over;
  const ink = INK_COLOR;

  /** a flat fill behind a drawn outline - the house rule, everywhere */
  const fill = (pts, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    const a = P(pts[0]);
    ctx.moveTo(a[0], a[1]);
    for (let i = 1; i < pts.length; i++) { const q = P(pts[i]); ctx.lineTo(q[0], q[1]); }
    ctx.closePath();
    ctx.fill();
  };
  const line = (pts, col, seed, weight = W) =>
    inkPoly(ctx, pts.map(P), weight, seed, WB, OV, col, false);
  const shut = (pts, col, seed, weight = W) =>
    inkPoly(ctx, pts.map(P), weight, seed, WB, OV, col, true);

  // --- where the two surfaces are sitting this frame -------------------------
  const topLevel = level(TOP_W, TOP0, 1 - p);
  const botLevel = level(BOT_W, NECK1, p);
  // the top dishes out over the drain, the bottom heaps up under it, and both
  // have a slow wander along them so the sand does not lie to a ruled edge
  const sag = (gx) => Math.sin(gx * 1.7) * 0.11 + Math.sin(gx * 0.83 + 1.3) * 0.08;
  const topY = (gx) => topLevel + Math.max(0, DIP * (1 - Math.abs(gx) / 5)) + sag(gx);
  const heap = MOUND * Math.min(1, p * 8);   // it takes a moment to start
  const botY = (gx) => Math.max(NECK1,
    botLevel - Math.max(0, heap * (1 - Math.abs(gx) / 5)) + sag(gx + 3));

  // --- the glass, as one closed shape ---------------------------------------
  const SIDE = 9;
  const bank = (s) => {
    const pts = [];
    for (let i = 0; i <= SIDE; i++) {          // down into the neck
      const f = i / SIDE;
      pts.push([s * hwAt(f), TOP0 + BULB * f]);
    }
    pts.push([s * HW_MIN, NECK1]);             // through the waist
    for (let i = 0; i <= SIDE; i++) {          // and out into the bottom bulb
      const f = i / SIDE;
      pts.push([s * hwAt(1 - f), NECK1 + BULB * f]);
    }
    return pts;
  };
  const left = bank(-1), right = bank(1);
  const glassShape = [...left, ...right.slice().reverse()];

  const glassPath = () => {
    ctx.beginPath();
    const a = P(glassShape[0]);
    ctx.moveTo(a[0], a[1]);
    for (let i = 1; i < glassShape.length; i++) {
      const q = P(glassShape[i]); ctx.lineTo(q[0], q[1]);
    }
    ctx.closePath();
  };

  // --- the posts it hangs between -------------------------------------------
  for (const s of [-1, 1]) {
    const post = [[s * 13.4, TOP0 - 0.6], [s * 15.2, TOP0 - 0.6],
                  [s * 15.2, BOT1 + 0.6], [s * 13.4, BOT1 + 0.6]];
    fill(post, C.bone);
    // the inner face catches less light than the front of it
    fill([post[0], [s * 14.0, TOP0 - 0.6], [s * 14.0, BOT1 + 0.6], post[3]], C.boneLo);
    shut(post, ink, S_BONE + (s > 0 ? 1 : 0));
  }

  // --- the inside of the glass ----------------------------------------------
  ctx.save();
  glassPath();
  ctx.clip();
  ctx.fillStyle = C.void;
  ctx.fillRect(X(-HALF), Y(0), GLASS_W, GLASS_H);

  // the sand in the top bulb, and the moon still standing in it
  const sandPath = (yAt, yEnd) => {
    ctx.beginPath();
    ctx.moveTo(X(-12), Y(yAt(-12)));
    for (let gx = -12; gx <= 12; gx += 0.5) ctx.lineTo(X(gx), Y(yAt(gx)));
    ctx.lineTo(X(12), Y(yEnd));
    ctx.lineTo(X(-12), Y(yEnd));
    ctx.closePath();
  };
  /** the drawn line ON the surface, the way the drink has one in a chalice */
  const surfaceLine = (yAt, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let gx = -12; gx <= 12; gx += 0.5) ctx.lineTo(X(gx), Y(yAt(gx)) - W * 0.55);
    for (let gx = 12; gx >= -12; gx -= 0.5) ctx.lineTo(X(gx), Y(yAt(gx)) + W * 0.55);
    ctx.closePath();
    ctx.fill();
  };

  if (p < 1) {
    ctx.fillStyle = C.night;
    sandPath(topY, NECK1);
    ctx.fill();
    // the moon, eaten by the falling level: drawn whole and cut to the sand
    ctx.save();
    sandPath(topY, NECK1);
    ctx.clip();
    fill(MOON_PTS, C.moon);
    for (const [cx, cy, r] of CRATERS) {
      ctx.fillStyle = C.crater;
      ctx.beginPath();
      ctx.ellipse(X(cx), Y(cy), r * U, r * U * 0.85, 0, 0, 6.2832);
      ctx.fill();
    }
    shut(MOON_PTS, ink, S_MOON);
    // the stars, in the sand rather than behind it
    for (const [gx, gy, r] of STARS) {
      ctx.fillStyle = C.star;
      ctx.beginPath();
      ctx.moveTo(X(gx), Y(gy - r));
      ctx.quadraticCurveTo(X(gx), Y(gy), X(gx + r * 0.9), Y(gy));
      ctx.quadraticCurveTo(X(gx), Y(gy), X(gx), Y(gy + r));
      ctx.quadraticCurveTo(X(gx), Y(gy), X(gx - r * 0.9), Y(gy));
      ctx.quadraticCurveTo(X(gx), Y(gy), X(gx), Y(gy - r));
      ctx.fill();
    }
    ctx.restore();
    surfaceLine(topY, ink);
  }

  // the sand in the bottom bulb, and the sun coming up inside it
  if (p > 0) {
    ctx.fillStyle = C.dawn;
    sandPath(botY, BOT1);
    ctx.fill();
    const hot = panic && Math.floor(t * 5) % 2;
    ctx.save();
    sandPath(botY, BOT1);
    ctx.clip();
    RAYS.forEach(([a, b], i) =>
      line([a, b], hot ? C.sunHot : C.ray, S_SUN + 7 + i, W * 1.2));
    fill(SUN_PTS, hot ? C.sunHot : C.sun);
    shut(SUN_PTS, hot ? C.sunHot : C.ray, S_SUN, W * 1.1);
    ctx.restore();
    surfaceLine(botY, ink);
  }

  // --- the run of sand -------------------------------------------------------
  // The one place still moving, so none of it goes near the ink cache: a plain
  // tapered thread and a handful of grains, drawn straight onto the glass.
  if (p < 1) {
    const y0 = NECK0 - 1.4, y1 = botY(0);
    ctx.fillStyle = C.night;
    ctx.fillRect(X(-HW_MIN), Y(NECK0), HW_MIN * 2 * U, (NECK1 - NECK0) * U);
    ctx.beginPath();
    ctx.moveTo(X(-0.55), Y(y0));
    ctx.lineTo(X(0.55), Y(y0));
    for (let gy = NECK1; gy <= y1; gy += 0.5) {
      ctx.lineTo(X(0.34 + Math.sin(gy * 0.9) * 0.1), Y(gy));
    }
    for (let gy = y1; gy >= NECK1; gy -= 0.5) {
      ctx.lineTo(X(-0.34 + Math.sin(gy * 0.9) * 0.1), Y(gy));
    }
    ctx.closePath();
    ctx.fillStyle = C.thread;
    ctx.fill();
    // loose grains, falling the way falling things do
    for (let k = 0; k < 5; k++) {
      const ph = (t * 1.6 + k / 5) % 1;
      const gy = NECK1 + (y1 - NECK1) * (ph * ph * 0.65 + ph * 0.35);
      if (gy > y1 - 0.3) continue;
      const jx = Math.sin(k * 9.7 + Math.floor(t * 12) * 1.9) * 0.9;
      ctx.fillStyle = ph > 0.6 ? C.threadLo : C.star;
      ctx.beginPath();
      ctx.ellipse(X(jx), Y(gy), U * 0.28, U * 0.4, 0, 0, 6.2832);
      ctx.fill();
    }
    // and the splash where it lands
    ctx.fillStyle = C.star;
    const sx = Math.floor(t * 12) % 2 ? 1.1 : -1.1;
    ctx.beginPath();
    ctx.ellipse(X(sx), Y(y1 - 0.2), U * 0.3, U * 0.24, 0, 0, 6.2832);
    ctx.fill();
  }

  // --- the last hour ---------------------------------------------------------
  if (panic) {
    const segs = CRACKS.reduce((a, c) => a + c.length - 1, 0);
    let n = Math.ceil(Math.min(1, Math.max(0, (p - 5 / 6) * 6)) * segs);
    for (const [ci, crack] of CRACKS.entries()) {
      for (let i = 0; i < crack.length - 1 && n > 0; i++, n--) {
        line([crack[i], crack[i + 1]], C.crack, S_CRACK + ci * 4 + i, W * 0.8);
      }
    }
  }

  // a reflection running down the inside of each bulb, so the glass reads as
  // glass and not as a hole cut in the frame
  line([[-8.6, TOP0 + 1.4], [-10.0, TOP0 + 4.2]], C.glint, S_GLASS + 21, W * 0.75);
  line([[-2.2, GLINT_LO], [-4.4, GLINT_LO + 2.6]], C.glint, S_GLASS + 22, W * 0.75);
  ctx.restore();

  // --- the glass itself, over everything in it -------------------------------
  line(left, C.chalk, S_GLASS);
  line(right, C.chalk, S_GLASS + 1);

  // --- the bone it is held in ------------------------------------------------
  const cap = (y0, y1, seed) => {
    const plate = [[-HALF + 0.3, y0], [HALF - 0.3, y0], [HALF - 0.3, y1], [-HALF + 0.3, y1]];
    fill(plate, C.bone);
    fill([[-HALF + 0.3, y1 - 0.9], [HALF - 0.3, y1 - 0.9],
          [HALF - 0.3, y1], [-HALF + 0.3, y1]], C.boneLo);
    shut(plate, ink, seed);
  };
  cap(0.4, PLATE, S_BONE + 4);
  cap(ROWS - PLATE, ROWS - 1.2, S_BONE + 5);
  // it stands on two feet, not on a slab
  for (const s of [-1, 1]) {
    const foot = [[s * 9.6, ROWS - 1.2], [s * 14.8, ROWS - 1.2],
                  [s * 14.4, ROWS - 0.2], [s * 10.0, ROWS - 0.2]];
    fill(foot, C.boneLo);
    shut(foot, ink, S_BONE + 6 + (s > 0 ? 1 : 0));
  }

  // the skull cut into the top cap, and its sockets catching the light that is
  // coming for you.  A clock counting down to your own sunrise should know.
  const socket = panic && Math.floor(t * 6) % 2 ? C.ember : C.socket;
  for (const s of [-1, 1]) {
    ctx.fillStyle = socket;
    ctx.beginPath();
    ctx.ellipse(X(s * 2.6), Y(1.5), U * 0.62, U * 0.5, s * 0.2, 0, 6.2832);
    ctx.fill();
  }
  fill([[0, 1.9], [0.8, 3.0], [-0.8, 3.0]], C.socket);          // the nose
  [-3.4, -1.7, 1.7, 3.4].forEach((gx, i) =>                     // and the teeth
    line([[gx, PLATE - 1.1], [gx, PLATE]], ink, S_BONE + 10 + i, W * 0.7));
}
