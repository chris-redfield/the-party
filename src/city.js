import {
  CELL, GRID, WORLD, ROAD, WALK, CORE0, CORE1, RING0, RING1,
  CROSS0, CROSS1, RA, RB, RLEN, RPERIM,
} from './config.js';
import { saturate } from './palette.js';

// ---------------------------------------------------------------------------
// Walkability
// ---------------------------------------------------------------------------

/** Sidewalk ring + crosswalks. This is where a vampire on foot may go. */
export function isWalkable(x, y) {
  if (x < 0 || y < 0 || x >= WORLD || y >= WORLD) return false;
  const cx = (x / CELL) | 0, cy = (y / CELL) | 0;
  const lx = x - cx * CELL, ly = y - cy * CELL;
  if (lx >= RING0 && lx < RING1 && ly >= RING0 && ly < RING1) {
    // inside the block: everything but the building core
    if (lx >= CORE0 && lx < CORE1 && ly >= CORE0 && ly < CORE1) return false;
    return true;
  }
  // zebra crossings over the road that runs along the left / top edge
  if (cx > 0 && lx < ROAD && ly >= CROSS0 && ly < CROSS1) return true;
  if (cy > 0 && ly < ROAD && lx >= CROSS0 && lx < CROSS1) return true;
  return false;
}

/** A bat may fly over roads and kids, but not through walls. */
export function isFlyable(x, y) {
  if (x < 0 || y < 0 || x >= WORLD || y >= WORLD) return false;
  const cx = (x / CELL) | 0, cy = (y / CELL) | 0;
  const lx = x - cx * CELL, ly = y - cy * CELL;
  return !(lx >= CORE0 && lx < CORE1 && ly >= CORE0 && ly < CORE1);
}

/** Is this point inside the paved road (used for tyre-screech flavour)? */
export function isRoad(x, y) {
  const cx = (x / CELL) | 0, cy = (y / CELL) | 0;
  const lx = x - cx * CELL, ly = y - cy * CELL;
  return lx < ROAD || ly < ROAD;
}

// ---------------------------------------------------------------------------
// The patrol ring of a block, parameterised by distance t along its perimeter
// ---------------------------------------------------------------------------
export function ringPoint(cx, cy, t, lateral = 0) {
  const ox = cx * CELL, oy = cy * CELL;
  t = ((t % RPERIM) + RPERIM) % RPERIM;
  let x, y, seg;
  if (t < RLEN) { seg = 0; x = RA + t; y = RA + lateral; }
  else if (t < 2 * RLEN) { seg = 1; x = RB + lateral; y = RA + (t - RLEN); }
  else if (t < 3 * RLEN) { seg = 2; x = RB - (t - 2 * RLEN); y = RB - lateral; }
  else { seg = 3; x = RA - lateral; y = RB - (t - 3 * RLEN); }
  return { x: ox + x, y: oy + y, seg };
}

export function blockAt(x, y) {
  return {
    cx: Math.max(0, Math.min(GRID - 1, (x / CELL) | 0)),
    cy: Math.max(0, Math.min(GRID - 1, (y / CELL) | 0)),
  };
}

// ---------------------------------------------------------------------------
// Districts - a 3x3 carve-up of the 10x10 grid, so clues can name a region
// ---------------------------------------------------------------------------
export const DISTRICTS = [
  { name: 'Gallow Heights',  cols: [0, 2], rows: [0, 2] },
  { name: 'Old Rattle',      cols: [3, 6], rows: [0, 2] },
  { name: 'Crowsfoot',       cols: [7, 9], rows: [0, 2] },
  { name: 'The Gutters',     cols: [0, 2], rows: [3, 6] },
  { name: 'Midnight Mile',   cols: [3, 6], rows: [3, 6] },
  { name: 'Sallow Docks',    cols: [7, 9], rows: [3, 6] },
  { name: 'Coffin Row',      cols: [0, 2], rows: [7, 9] },
  { name: 'Wretched Park',   cols: [3, 6], rows: [7, 9] },
  { name: 'The Rind',        cols: [7, 9], rows: [7, 9] },
];

export function districtOf(cx, cy) {
  return DISTRICTS.findIndex(d =>
    cx >= d.cols[0] && cx <= d.cols[1] && cy >= d.rows[0] && cy <= d.rows[1]);
}

// ---------------------------------------------------------------------------
// Doors
// ---------------------------------------------------------------------------

// Every door in this city is the same red.  It is not a clue any more; it is
// just what a door looks like here.
export const DOOR_PAINT = {
  key: 'red', name: 'blood red', hex: '#7e2230', trim: '#a8303f',
};

export const DECOS = [
  { key: 'pumpkin',  name: 'a grinning pumpkin' },
  { key: 'cobweb',   name: 'a fat grey cobweb' },
  { key: 'skeleton', name: 'a dangling skeleton' },
  { key: 'bats',     name: 'a string of paper bats' },
  { key: 'ghost',    name: 'a bedsheet ghost on a stick' },
  { key: 'none',     name: 'absolutely no decoration at all' },
];

/**
 * The one entrance of a block, set into the south facade - the only wall the
 * camera actually shows.  `x, y` is the doorstep; `ax, ay` is where the vampire
 * has to stand to knock.
 */
export function doorGeometry(cx, cy) {
  const ox = cx * CELL, oy = cy * CELL;
  const mid = (CORE0 + CORE1) / 2;   // 320
  return { x: ox + mid, y: oy + CORE1, ax: ox + mid, ay: oy + RB };
}

/** Drain a colour to the grey of the same brightness. */
export function toMono(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const v = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  const h = v.toString(16).padStart(2, '0');
  return `#${h}${h}${h}`;
}

// ---------------------------------------------------------------------------
// City generation
// ---------------------------------------------------------------------------
export function buildCity(rng) {
  const blocks = [];
  const doors = [];
  for (let cy = 0; cy < GRID; cy++) {
    for (let cx = 0; cx < GRID; cx++) {
      const height = rng.int(2, 5);              // storeys, purely cosmetic
      const palette = rng.pick([
        ['#4a4f63', '#30344a'], ['#5a4d3c', '#3a3229'], ['#3e4a5e', '#282f3c'],
        ['#573f4a', '#372730'], ['#44523f', '#2b3429'], ['#5f5240', '#3e352a'],
      ]);
      // the same boost the palette table gets: an ordinary night city has
      // colour in it, and only the vampire's does not
      const base = saturate(palette[0]);
      // roof and seams come off the same roll, so they are picked together
      const roofing = rng.pick([
        ['#2c3040', '#363b4e'], ['#2f3628', '#3a4331'], ['#382c34', '#453641'],
      ]);
      const roof = saturate(roofing[0]);
      const roofLight = saturate(roofing[1]);
      const block = {
        cx, cy, height, base,
        district: districtOf(cx, cy),
        baseDark: saturate(palette[1]), roof, roofLight,
        // the same four surfaces as a vampire sees them: same value, no hue
        baseM: toMono(base), baseDarkM: toMono(saturate(palette[1])),
        roofM: toMono(roof), roofLightM: toMono(roofLight),
        lamps: rng.int(2, 4),
        seed: rng.int(0, 1e9),
      };
      const g = doorGeometry(cx, cy);
      const door = {
        id: doors.length,
        cx, cy,
        x: g.x, y: g.y, ax: g.ax, ay: g.ay,
        color: DOOR_PAINT,
        deco: rng.pick(DECOS),
        number: rng.int(1, 99),
        tried: false,
        isParty: false,
      };
      doors.push(door);
      block.door = door;
      block.doors = [door];
      blocks.push(block);
    }
  }
  // Pick the one true door. Keep it off the outermost rim so the player always
  // has room to circle around it.
  const inner = doors.filter(d => d.cx > 0 && d.cx < GRID - 1 && d.cy > 0 && d.cy < GRID - 1);
  const party = rng.pick(inner);
  party.isParty = true;

  return { blocks, doors, party, blockAt: (cx, cy) => blocks[cy * GRID + cx] };
}
