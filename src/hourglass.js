// ---------------------------------------------------------------------------
// THE HOURGLASS - the night, drawn as the only clock the vampire cares about
// ---------------------------------------------------------------------------
// There are no digits on it.  The top bulb holds the night: deep violet sand
// with a few stars in it and a moon standing in the middle.  The bottom bulb
// is what the night turns into.  The sand does not just move from one to the
// other, it is the same sand: the moon is eaten away grain by grain as the
// level drops past it, and the same grains build the sun back up in the
// bottom, from the rim of its lowest ray to the top of the disc.  When the
// moon is gone the sun is whole, and that is 6:00 AM.
//
// Drawn as flat pixel art on a grid of `GLASS_UNIT`-sized cells, like every
// other thing in this game: solid fills, no alpha, no gradients.
// ---------------------------------------------------------------------------
import { GLASS_UNIT } from './config.js';

const U = GLASS_UNIT;
const HALF = 15;                    // grid columns run -HALF .. +HALF
const PLATE = 4;                    // bone end caps
const BULB = 18;                    // rows of glass in each bulb
const NECK = 2;
const ROWS = PLATE + BULB + NECK + BULB + PLATE;

export const GLASS_W = (HALF * 2 + 1) * U;
export const GLASS_H = ROWS * U;

const TOP0 = PLATE, TOP1 = TOP0 + BULB - 1;
const NECK0 = TOP1 + 1, NECK1 = NECK0 + NECK - 1;
const BOT0 = NECK1 + 1, BOT1 = BOT0 + BULB - 1;

// The bulb profile: wide shoulders falling away to a pinched neck.  One table
// of half-widths drives the glass, the sand, the walls and the column spans.
const HW_MAX = 11, HW_MIN = 1;
const TOP_HW = Array.from({ length: BULB }, (_, i) => {
  const t = i / (BULB - 1);
  return Math.round(HW_MIN + (HW_MAX - HW_MIN) * Math.pow(1 - t, 0.7));
});
const BOT_HW = [...TOP_HW].reverse();
// one bulb's worth of sand, in cells - both bulbs hold the same
const AREA = TOP_HW.reduce((a, hw) => a + hw * 2 + 1, 0);

// For a column, the run of bulb rows that actually contains it.  The profile
// only shrinks, so each column is a contiguous run.
const TOP_LAST = [], BOT_FIRST = [];
for (let ax = 0; ax <= HW_MAX; ax++) {
  let last = 0;
  for (let i = 0; i < BULB; i++) if (TOP_HW[i] >= ax) last = i;
  TOP_LAST[ax] = last;
  BOT_FIRST[ax] = BULB - 1 - last;
}

const MOUND = 3.2;      // rows the bottom heap stands proud of its own level
const DIP = 1.6;        // rows the top surface is sucked down over the drain

const C = {
  bone:    '#cbbfae',
  boneLo:  '#9b8f7c',
  boneDk:  '#6d6354',
  socket:  '#1c1526',
  ember:   '#ff5a2a',
  glass:   '#7f6cb0',
  glint:   '#b6a4e2',
  thread:  '#8d80c0',
  threadLo:'#c98a2e',
  void:    '#1a1330',
  night:   '#453a6e',
  star:    '#bdb0e8',
  moon:    '#ece4ff',
  crater:  '#b5a8d8',
  dawn:    '#9c5520',
  dawnLo:  '#7a3f18',
  sun:     '#ffc23a',
  sunHot:  '#fff0b0',
  ray:     '#ff8a2a',
  crack:   '#d3c2ff',
};

// The top cap is a skull, cut into the bone: eye sockets, a nose, and a row
// of teeth for the sand to fall out between.  A clock counting down to your
// own sunrise should look like it knows.
const SKULL = [[], [-3, -2, 2, 3], [0], [-3, -1, 1, 3]];

// Stars in the night sand.  Hand-placed to sit clear of the moon; anything
// that lands outside the glass is dropped when it is drawn.
const STARS = [[1, -8], [2, 7], [3, 9], [4, -7], [5, 6], [8, -6], [10, 5], [12, -4]];

// --- the moon (top bulb) and the sun (bottom bulb) --------------------------
// Both are built once as lists of cells, then shown only where there is sand
// to show them in: the moon is uncovered at the start and eaten from the top
// down, the sun is buried at the start and filled in from the bottom up.
const MOON_CY = TOP0 + 6.5, MOON_R = 5.5;
const MOON = [];
for (let gy = Math.floor(MOON_CY - MOON_R); gy <= Math.ceil(MOON_CY + MOON_R); gy++) {
  for (let gx = -6; gx <= 6; gx++) {
    const dy = gy + 0.5 - MOON_CY;
    const inside = Math.hypot(gx, dy) <= MOON_R;
    const bite = Math.hypot(gx - 3.6, dy) <= 5.2;         // bitten into a crescent
    if (!inside || bite) continue;
    const crater = (gx === -3 && Math.round(dy) === -2) || (gx === -2 && Math.round(dy) === 3);
    MOON.push([gx, gy, crater ? C.crater : C.moon]);
  }
}

const SUN_CY = BOT1 - 6.5, SUN_R = 4.5;
const SUN = [];
for (let gy = Math.floor(SUN_CY - SUN_R); gy <= Math.ceil(SUN_CY + SUN_R); gy++) {
  for (let gx = -6; gx <= 6; gx++) {
    const dy = gy + 0.5 - SUN_CY;
    const d = Math.hypot(gx, dy);
    if (d > SUN_R) continue;
    SUN.push([gx, gy, d <= 2 ? C.sunHot : C.sun]);
  }
}
const RAYS = [];
for (let k = 0; k < 8; k++) {
  const a = k * Math.PI / 4;
  for (let d = SUN_R + 1.2; d <= SUN_R + 3.2; d += 1) {
    const gx = Math.round(Math.cos(a) * d);
    const gy = Math.round(SUN_CY + Math.sin(a) * d - 0.5);
    if (!RAYS.some(r => r[0] === gx && r[1] === gy)) RAYS.push([gx, gy]);
  }
}

// Cracks that open in the last hour, in the order they open: one running down
// from the right shoulder, one climbing the bottom bulb.  Both are cells that
// sit on glass, so they read as a fracture and not as a missing pixel.
const CRACKS = [
  [9, TOP0 + 1], [8, TOP0 + 2], [8, TOP0 + 3], [7, TOP0 + 4], [6, TOP0 + 5],
  [-9, BOT1 - 1], [-9, BOT1 - 2], [-8, BOT1 - 3], [-8, BOT1 - 4], [-7, BOT1 - 5],
];

/** Fraction of one bulb's area lying below a given fractional row. */
function surfaceRow(hws, r0, frac) {
  const target = Math.max(0, Math.min(1, frac)) * AREA;
  let acc = 0;
  for (let i = hws.length - 1; i >= 0; i--) {
    const w = hws[i] * 2 + 1;
    if (acc + w >= target) return r0 + i + 1 - (target - acc) / w;
    acc += w;
  }
  return r0;
}

/**
 * @param p  0 at midnight, 1 at sunrise
 * @param t  seconds, for the grains
 */
export function drawHourglass(ctx, ox, oy, p, t, panic = false) {
  p = Math.max(0, Math.min(1, p));
  const colX = gx => ox + (gx + HALF) * U;
  const rowY = gy => oy + gy * U;
  const cell = (gx, gy, c) => { ctx.fillStyle = c; ctx.fillRect(colX(gx), rowY(gy), U, U); };
  const band = (gx0, gx1, gy, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(colX(gx0), rowY(gy), (gx1 - gx0 + 1) * U, U);
  };
  const colFill = (gx, y0, y1, c) => {
    const a = Math.round(y0), b = Math.round(y1);
    if (b <= a) return;
    ctx.fillStyle = c;
    ctx.fillRect(colX(gx), a, U, b - a);
  };

  // where the two surfaces are sitting this frame
  const topRow = surfaceRow(TOP_HW, TOP0, 1 - p);
  const botRow = surfaceRow(BOT_HW, BOT0, p);
  // the top dishes out over the drain, the bottom heaps up under it
  const topY = gx => rowY(topRow) + Math.max(0, DIP * (1 - Math.abs(gx) / 5)) * U;
  // the heap takes a moment to start and cannot climb out of the bulb
  const heap = MOUND * Math.min(1, p * 8);
  const botY = gx => Math.max(rowY(BOT0),
                              rowY(botRow) - Math.max(0, heap * (1 - Math.abs(gx) / 5)) * U);

  // --- frame: the whole thing is made out of bone ---------------------------
  for (let gy = TOP0; gy <= BOT1; gy++) {
    const knuckle = gy <= TOP0 + 1 || gy >= BOT1 - 1;
    for (const s of [-1, 1]) {
      cell(s * 14, gy, C.bone);
      cell(s * 15, gy, C.boneDk);
      if (knuckle) cell(s * 13, gy, C.bone);
    }
  }
  for (let gy = 0; gy < PLATE; gy++) band(-HALF, HALF, gy, gy === PLATE - 1 ? C.boneLo : C.bone);
  for (let gy = ROWS - PLATE; gy < ROWS; gy++) {
    if (gy === ROWS - 1) {            // it stands on two feet
      band(-HALF, -10, gy, C.boneDk);
      band(10, HALF, gy, C.boneDk);
    } else band(-HALF, HALF, gy, gy === ROWS - PLATE ? C.boneLo : C.bone);
  }
  // the skull, and its sockets catching the light that is coming for you
  const socket = panic && Math.floor(t * 6) % 2 ? C.ember : C.socket;
  SKULL.forEach((row, ry) => {
    for (const gx of row) cell(gx, ry, ry === 1 ? socket : C.boneDk);
  });

  // --- glass: the empty void first, then whatever sand is in it -------------
  for (let gy = TOP0; gy <= BOT1; gy++) {
    const hw = gy < NECK0 ? TOP_HW[gy - TOP0]
             : gy > NECK1 ? BOT_HW[gy - BOT0]
             : HW_MIN;
    const prev = gy === TOP0 ? hw
      : gy - 1 < NECK0 ? TOP_HW[gy - 1 - TOP0]
      : gy - 1 > NECK1 ? BOT_HW[gy - 1 - BOT0]
      : HW_MIN;
    band(-hw, hw, gy, C.void);
    // the wall, widened wherever the profile steps, so it stays unbroken
    for (let c = hw + 1; c <= Math.max(hw + 1, prev + 1); c++) {
      cell(c, gy, C.glass);
      cell(-c, gy, C.glass);
    }
  }
  // the neck is sand all night - it is the one place still running
  if (p < 1) for (let gy = NECK0; gy <= NECK1; gy++) band(-HW_MIN, HW_MIN, gy, C.night);

  for (let gx = -HW_MAX; gx <= HW_MAX; gx++) {
    const ax = Math.abs(gx);
    // top bulb: sand lies below the surface
    const tTop = rowY(TOP0), tBot = rowY(TOP0 + TOP_LAST[ax] + 1);
    colFill(gx, Math.max(tTop, topY(gx)), tBot, C.night);
    // bottom bulb: sand lies below the heap line
    const bTop = rowY(BOT0 + BOT_FIRST[ax]), bBot = rowY(BOT1 + 1);
    colFill(gx, Math.max(bTop, botY(gx)), bBot, ax > 8 ? C.dawnLo : C.dawn);
  }

  // stars, then the moon - both only where there is still night to hold them
  for (const [i, gx] of STARS) {
    if (Math.abs(gx) > TOP_HW[i]) continue;
    const gy = TOP0 + i;
    if (rowY(gy) + U / 2 > topY(gx)) cell(gx, gy, C.star);
  }
  for (const [gx, gy, c] of MOON) {
    if (Math.abs(gx) > TOP_HW[gy - TOP0]) continue;
    if (rowY(gy) + U / 2 > topY(gx)) cell(gx, gy, c);
  }

  // the sun, filled in from the bottom as the sand piles onto it
  const hot = panic && Math.floor(t * 5) % 2;
  for (const [gx, gy] of RAYS) {
    if (gy < BOT0 || gy > BOT1 || Math.abs(gx) > BOT_HW[gy - BOT0]) continue;
    if (rowY(gy) + U / 2 > botY(gx)) cell(gx, gy, hot ? C.sunHot : C.ray);
  }
  for (const [gx, gy, c] of SUN) {
    if (Math.abs(gx) > BOT_HW[gy - BOT0]) continue;
    if (rowY(gy) + U / 2 > botY(gx)) cell(gx, gy, hot && c === C.sun ? C.sunHot : c);
  }

  // --- the run of sand ------------------------------------------------------
  if (p < 1) {
    const y0 = rowY(NECK1 + 1), y1 = botY(0);
    for (let gy = NECK1 + 1; gy <= BOT1; gy++) {
      const y = rowY(gy);
      if (y + U > y1) break;
      const f = (y - y0) / Math.max(1, y1 - y0);
      cell(0, gy, f > 0.6 ? C.threadLo : C.thread);
    }
    // loose grains, falling the way falling things do
    for (let k = 0; k < 5; k++) {
      const ph = (t * 1.6 + k / 5) % 1;
      const y = y0 + (y1 - y0) * (ph * ph * 0.65 + ph * 0.35);
      if (y + U > y1) continue;
      const jx = Math.round(Math.sin(k * 9.7 + Math.floor(t * 20) * 1.9));
      ctx.fillStyle = ph > 0.6 ? C.sun : C.star;
      ctx.fillRect(colX(jx), Math.round(y), U, U);
    }
    // and the splash where it lands
    const sx = Math.floor(t * 12) % 2 ? 1 : -1;
    ctx.fillStyle = C.sun;
    ctx.fillRect(colX(sx), Math.round(y1) - U, U, U);
  }

  // --- the last hour --------------------------------------------------------
  if (panic) {
    const n = Math.ceil(Math.min(1, (p - 5 / 6) * 6) * CRACKS.length);
    for (let i = 0; i < n; i++) cell(CRACKS[i][0], CRACKS[i][1], C.crack);
  }

  // a reflection running down the inside of each bulb, so the glass reads as
  // glass and not as a hole cut in the panel
  cell(-10, TOP0 + 1, C.glint);
  cell(-9, TOP0 + 2, C.glint);
  cell(-2, BOT0 + 2, C.glint);
  cell(-3, BOT0 + 3, C.glint);
}
