import {
  WORLD, WALK, TILE, TILE_N, CITY_SEED, CITY_RIM, CROSS_SCALE, CROSS_CLEAR,
  LOT_MIN, LOT_MAX, LOT_STOP, LOT_JITTER, LOT_ASPECT, LOT_MERGE, LOT_MERGE_MAX,
  PLOT_MIN, PLOT_MAX, PLOT_DEEP, PLOT_DEEP_MAX, PLOT_STOP, WALL_MIN, WALL_MAX,
  ROAD_WIDTHS, CROSS_W,
} from './config.js';
import { makeRng } from './rng.js';
import { saturate } from './palette.js';

// ---------------------------------------------------------------------------
// THE CITY IS CUT, NOT RULED
// ---------------------------------------------------------------------------
// There is no grid.  The whole city is one rectangle, and it is cut in half,
// and each half is cut in half, until no piece is big enough to cut again -
// binary space partitioning.  Every cut leaves a road behind it, and the
// pieces that survive uncut are the blocks.
//
// Two things fall out of that for free.  Blocks come in every size, because a
// cut lands anywhere in the middle of the piece it divides rather than on a
// ruled line.  And the roads inherit the shape of the tree: the first cuts
// are wide avenues running the height of the city, the last are narrow lanes
// a block and a half long, which is why the junctions are mostly T-shaped
// and no two of them look alike.
//
// The cut alone would still read as a lattice, so it is undone in places.
// Coming back up the tree, a cut whose two halves both came out as single
// pieces may be cancelled: its road is never laid and the two become one
// block.  That is where the big blocks come from, and a big block is not one
// enormous building - its core is cut again, without roads this time, into
// plots that share their party walls.  A row of four houses of four heights
// with four doors along the front of it is one block.
//
// The layout is cut from `CITY_SEED`, which is a constant: the city is built
// from scratch on every reload and comes out the same city every time.  What
// the night puts *in* it - which door is the party, what hangs beside each
// one - is rolled from the night's own seed and is different every time.
// ---------------------------------------------------------------------------

// The one city currently being played.  Walkability is asked about from
// player.js and game.js a few times a frame and there is only ever one city,
// so it is kept here rather than threaded through every call.
let CITY = null;
export function setCity(c) { CITY = c; }
export function getCity() { return CITY; }

// The cross, in world pixels, scaled as one figure - see hellCross() in
// scenery.js, which draws exactly these.  `t` is its half-thickness and has
// a floor: the shaft has to cover the centre line it burns off, so it can
// never be thinner than the paint underneath it.
const CS = CROSS_SCALE;
export const CROSS = {
  up: Math.round(196 * CS),          // how far up the road the shaft runs
  down: Math.round(62 * CS),         // the stub below the bar
  cap: Math.round(15 * CS),          // half-width of a capped end
  capW: Math.round(8 * CS),          // and how thick the cap is
  capB: Math.round(13 * CS),         // ... with its burn
  burn: Math.round(5 * CS),          // the dark lip around the whole figure
  tAvenue: Math.round(11 * CS),      // half-thickness over a twin centre line
  tLane: Math.round(8 * CS),         // ... and over a single one
};

const snap8 = (v) => Math.round(v / 8) * 8;
const roadWidth = (depth) => ROAD_WIDTHS[Math.min(depth, ROAD_WIDTHS.length - 1)];

// ---------------------------------------------------------------------------
// The cut
// ---------------------------------------------------------------------------
/**
 * Recursively halve the city rectangle.  A node is either a split - an axis,
 * the centre of the road it left behind, and two children - or a leaf, which
 * is one lot: a buildable piece of ground with a road on every side of it.
 *
 * `pad` is how wide the road bounding this piece is on each side.  A road is
 * drawn spanning its node's region *plus* those pads, so that it runs all the
 * way into the roads at either end of it instead of stopping short of them,
 * and so two crossing roads actually overlap and make a junction.
 */
function cut(rng, node, depth, roads) {
  const w = node.x1 - node.x0, h = node.y1 - node.y0;
  const rw = roadWidth(depth);
  const canV = w >= 2 * LOT_MIN + rw;     // a vertical cut divides the width
  const canH = h >= 2 * LOT_MIN + rw;
  const must = w > LOT_MAX || h > LOT_MAX;
  if ((!canV && !canH) || (!must && rng.chance(LOT_STOP))) return [node];

  let vertical;
  if (canV && !canH) vertical = true;
  else if (canH && !canV) vertical = false;
  else if (w > LOT_MAX && h <= LOT_MAX) vertical = true;
  else if (h > LOT_MAX && w <= LOT_MAX) vertical = false;
  else if (w > h * LOT_ASPECT) vertical = true;      // cut an oblong the long way
  else if (h > w * LOT_ASPECT) vertical = false;
  else vertical = rng.chance(0.5);

  // Where the cut lands.  Both sides have to end up at least LOT_MIN across,
  // which fixes the window it may fall in; inside that window it is free, and
  // that freedom is the whole point of doing this.
  const a0 = vertical ? node.x0 : node.y0;
  const a1 = vertical ? node.x1 : node.y1;
  const lo = a0 + LOT_MIN + rw / 2, hi = a1 - LOT_MIN - rw / 2;
  const mid = (lo + hi) / 2;
  const pos = snap8(mid + rng.range(-1, 1) * ((hi - lo) / 2) * LOT_JITTER);
  const b0 = pos - rw / 2, b1 = pos + rw / 2;

  const p = node.pad;
  const road = vertical
    ? { axis: 'v', depth, w: rw, x0: b0, x1: b1, y0: node.y0 - p.n, y1: node.y1 + p.s }
    : { axis: 'h', depth, w: rw, x0: node.x0 - p.w, x1: node.x1 + p.e, y0: b0, y1: b1 };
  const lhs = vertical
    ? { x0: node.x0, y0: node.y0, x1: b0, y1: node.y1, pad: { n: p.n, s: p.s, w: p.w, e: rw } }
    : { x0: node.x0, y0: node.y0, x1: node.x1, y1: b0, pad: { n: p.n, s: rw, w: p.w, e: p.e } };
  const rhs = vertical
    ? { x0: b1, y0: node.y0, x1: node.x1, y1: node.y1, pad: { n: p.n, s: p.s, w: rw, e: p.e } }
    : { x0: node.x0, y0: b1, x1: node.x1, y1: node.y1, pad: { n: rw, s: p.s, w: p.w, e: p.e } };

  const A = cut(rng, lhs, depth + 1, roads);
  const B = cut(rng, rhs, depth + 1, roads);

  // Undo the cut.  Only possible when neither side was cut up any further -
  // one piece each - which also means neither of them laid a road inside
  // itself, so there is nothing left stranded in the middle of the block.
  if (A.length === 1 && B.length === 1
      && w <= LOT_MERGE_MAX && h <= LOT_MERGE_MAX && rng.chance(LOT_MERGE)) {
    return [{ x0: node.x0, y0: node.y0, x1: node.x1, y1: node.y1, pad: p, merged: true }];
  }

  roads.push(road);
  return [...A, ...B];
}

/**
 * The same cut again inside one block's core, with no roads in it: what comes
 * out is the plots, and a plot is one building.  Buildings stand wall to wall
 * with no gap between them, so this partitions the core exactly and nothing
 * about walking around the block changes.
 */
function cutPlots(rng, r, out) {
  const w = r.x1 - r.x0, h = r.y1 - r.y0;
  const canV = w >= 2 * PLOT_MIN;
  const canH = h >= 2 * PLOT_DEEP;
  const must = w > PLOT_MAX || h > PLOT_DEEP_MAX;
  if ((!canV && !canH) || (!must && rng.chance(PLOT_STOP))) { out.push(r); return out; }
  let vertical;
  if (canV && !canH) vertical = true;
  else if (canH && !canV) vertical = false;
  else if (w > PLOT_MAX && h <= PLOT_DEEP_MAX) vertical = true;
  else if (h > PLOT_DEEP_MAX && w <= PLOT_MAX) vertical = false;
  else vertical = rng.chance(0.55);        // a frontage more often than a row
  const mn = vertical ? PLOT_MIN : PLOT_DEEP;
  const a0 = vertical ? r.x0 : r.y0, a1 = vertical ? r.x1 : r.y1;
  const pos = snap8((a0 + a1) / 2 + rng.range(-1, 1) * ((a1 - a0 - 2 * mn) / 2) * 0.9);
  cutPlots(rng, vertical ? { x0: r.x0, y0: r.y0, x1: pos, y1: r.y1 }
                         : { x0: r.x0, y0: r.y0, x1: r.x1, y1: pos }, out);
  cutPlots(rng, vertical ? { x0: pos, y0: r.y0, x1: r.x1, y1: r.y1 }
                         : { x0: r.x0, y0: pos, x1: r.x1, y1: r.y1 }, out);
  return out;
}

/**
 * Point -> lot, or null for "you are standing in the road".  Lots are not on
 * a grid any more, so this is a lookup into a uniform bucket index built over
 * them: cheap, and it does not care how the pieces were cut.
 */
function lotIndex(lots) {
  const buckets = new Map();
  for (const b of lots) {
    const t0x = (b.x0 / TILE) | 0, t1x = ((b.x1 - 1) / TILE) | 0;
    const t0y = (b.y0 / TILE) | 0, t1y = ((b.y1 - 1) / TILE) | 0;
    for (let ty = t0y; ty <= t1y; ty++) {
      for (let tx = t0x; tx <= t1x; tx++) {
        const id = ty * TILE_N + tx;
        if (!buckets.has(id)) buckets.set(id, []);
        buckets.get(id).push(b);
      }
    }
  }
  return (x, y) => {
    if (x < 0 || y < 0 || x >= WORLD || y >= WORLD) return null;
    const bs = buckets.get(((y / TILE) | 0) * TILE_N + ((x / TILE) | 0));
    if (!bs) return null;
    for (const b of bs) if (x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1) return b;
    return null;
  };
}

// ---------------------------------------------------------------------------
// Crossings
// ---------------------------------------------------------------------------
/**
 * A vampire on foot may only use the pavement, so every pair of lots that
 * face each other across a road needs a painted crossing between them or half
 * the city is unreachable.  Each lot feels along all four of its sides, finds
 * whatever is over the road from it, and lays one crossing per neighbour.
 *
 * On a grid you could hard-code these.  Here a long block may face three
 * different lots down one side, and it gets three crossings.
 */
function buildCrossings(lots, lotAt) {
  const seen = new Set();
  const out = [];
  const STEP = 96, MARCH = 8, MAX_GAP = 320;
  // side: 0 north, 1 east, 2 south, 3 west
  for (const b of lots) {
    for (let side = 0; side < 4; side++) {
      const horiz = side === 0 || side === 2;
      const a0 = horiz ? b.x0 : b.y0, a1 = horiz ? b.x1 : b.y1;
      const dx = side === 1 ? 1 : side === 3 ? -1 : 0;
      const dy = side === 2 ? 1 : side === 0 ? -1 : 0;
      const edge = side === 0 ? b.y0 : side === 1 ? b.x1 : side === 2 ? b.y1 : b.x0;
      for (let a = a0 + 24; a <= a1 - 24; a += STEP) {
        let n = null, gap = 0;
        for (let d = MARCH; d < MAX_GAP; d += MARCH) {
          const px = horiz ? a : edge + dx * d;
          const py = horiz ? edge + dy * d : a;
          const hit = lotAt(px, py);
          if (hit) { n = hit; gap = d; break; }
        }
        if (!n || n === b) continue;
        const key = b.id < n.id ? `${b.id}:${n.id}` : `${n.id}:${b.id}`;
        if (seen.has(key)) continue;
        // the crossing goes over the middle of however much of the two lots
        // actually face each other
        const o0 = Math.max(horiz ? b.x0 : b.y0, horiz ? n.x0 : n.y0);
        const o1 = Math.min(horiz ? b.x1 : b.y1, horiz ? n.x1 : n.y1);
        if (o1 - o0 < CROSS_W + 32) continue;
        seen.add(key);
        const c = snap8((o0 + o1) / 2);
        const g0 = Math.min(edge, edge + dx * gap + dy * gap);
        const g1 = Math.max(edge, edge + dx * gap + dy * gap);
        out.push(horiz
          ? { x0: c - CROSS_W / 2, x1: c + CROSS_W / 2, y0: g0, y1: g1, axis: 'v', a: b, b: n }
          : { x0: g0, x1: g1, y0: c - CROSS_W / 2, y1: c + CROSS_W / 2, axis: 'h', a: b, b: n });
      }
    }
  }
  return out;
}

/** Every lot has to be reachable on foot from every other one. */
function checkConnected(lots, crossings) {
  const parent = new Map(lots.map(b => [b.id, b.id]));
  const find = (i) => { while (parent.get(i) !== i) { parent.set(i, parent.get(parent.get(i))); i = parent.get(i); } return i; };
  for (const c of crossings) {
    const ra = find(c.a.id), rb = find(c.b.id);
    if (ra !== rb) parent.set(ra, rb);
  }
  const roots = new Set(lots.map(b => find(b.id)));
  if (roots.size > 1) {
    console.warn(`city: ${roots.size} unreachable islands of pavement`);
  }
  return roots.size === 1;
}

// ---------------------------------------------------------------------------
// Junctions - where the crosses burn through
// ---------------------------------------------------------------------------
/**
 * Where a road crosses a road.  Cutting a rectangle in half leaves mostly
 * T-junctions rather than the crossroads a grid gives you, so the cross is
 * placed wherever the vertical road carries on far enough *upwards* to hold
 * the shaft: at a crossroads, and at every T that opens north.
 */
function buildJunctions(roads) {
  const all = [];
  const vs = roads.filter(r => r.axis === 'v');
  const hs = roads.filter(r => r.axis === 'h');
  for (const v of vs) {
    for (const h of hs) {
      const x0 = Math.max(v.x0, h.x0), x1 = Math.min(v.x1, h.x1);
      const y0 = Math.max(v.y0, h.y0), y1 = Math.min(v.y1, h.y1);
      if (x1 - x0 < 8 || y1 - y0 < 8) continue;
      // The cross stands where the two centre lines cross, not in the middle
      // of the overlap: the shaft has to lie along the paint it burns off,
      // and at a junction where one road stops short of the other's far kerb
      // those are not the same point.
      const jx = (v.x0 + v.x1) / 2, jy = (h.y0 + h.y1) / 2;
      if (jx <= x0 || jx >= x1 || jy <= y0 || jy >= y1) continue;

      const span = v.w / 2, arm = h.w / 2;      // to the kerb, across and along
      if (v.y0 > jy - CROSS.up - CROSS.burn - CROSS_CLEAR) continue;   // no road above to stand the shaft in

      // Sized to the junction it is in.  Nothing may come within CROSS_CLEAR
      // of a kerb, so a narrow lane gets a cross smaller than CROSS_SCALE
      // would have made it rather than one that runs onto the pavement.
      const bar = Math.min(span * CROSS_SCALE, span - CROSS_CLEAR);
      const down = Math.min(CROSS.down, arm - CROSS_CLEAR - CROSS.burn);
      const t = v.w >= 152 ? CROSS.tAvenue : CROSS.tLane;
      if (bar < CROSS.cap + CROSS.burn || down < CROSS.capW
          || t + CROSS.burn > span - CROSS_CLEAR
          || CROSS.cap + CROSS.burn > arm - CROSS_CLEAR) continue;     // too tight for a figure at all

      // CROSS first: what is worked out per junction overrides the nominal
      all.push({ ...CROSS, x: jx, y: jy, span, arm, bar, down, t });
    }
  }

  // A cross is most of two hundred pixels tall and the junction it stands in
  // is a fraction of that, so two junctions close together - and the cut
  // makes plenty of those, including staggered crossroads sixteen pixels
  // apart - would have one cross growing up through the next one's stub.
  // Two of them fighting reads as a drawing fault rather than as something
  // burning out of the road, so where a pair would touch, only one is
  // burned: the wider junction, which is the one with the most road to burn.
  all.sort((a, b) => (b.span - a.span) || (b.arm - a.arm) || (a.y - b.y) || (a.x - b.x));
  const kept = [];
  for (const j of all) {
    j.bounds = crossBounds(j);
    if (kept.some(k => overlaps(j.bounds, k.bounds))) continue;
    kept.push(j);
  }
  kept.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  return kept;
}

/** Exactly the ground a cross covers, burn included - see hellCross(). */
function crossBounds(j) {
  const half = Math.max(j.bar, j.cap + j.burn);
  return {
    x0: j.x - half, x1: j.x + half,
    y0: j.y - j.up - j.burn, y1: j.y + j.down + j.burn,
  };
}

const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

// ---------------------------------------------------------------------------
// Where the road markings stop
// ---------------------------------------------------------------------------
/**
 * A centre line is not painted through a junction.  On the old grid every
 * crossing was a clean four-way and two lines crossing in the middle of it
 * read as a crosshair; the cut makes T-junctions, staggered crossings and
 * roads that run a little way into one another, and a centre line carried
 * through one of those runs into the side of the other road, or doubles up
 * with a second line a few pixels away.  So each road is given the stretches
 * of itself that any other road overlaps, and paints nothing there.
 */
function markGaps(roads) {
  for (const r of roads) {
    const vert = r.axis === 'v';
    const gaps = [];
    for (const o of roads) {
      if (o === r) continue;
      if (o.x1 <= r.x0 || o.x0 >= r.x1 || o.y1 <= r.y0 || o.y0 >= r.y1) continue;
      gaps.push(vert ? [Math.max(r.y0, o.y0), Math.min(r.y1, o.y1)]
                     : [Math.max(r.x0, o.x0), Math.min(r.x1, o.x1)]);
    }
    gaps.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const g of gaps) {
      const last = merged[merged.length - 1];
      if (last && g[0] <= last[1]) last[1] = Math.max(last[1], g[1]);
      else merged.push(g);
    }
    r.gaps = merged;
  }
}

// ---------------------------------------------------------------------------
// Walkability
// ---------------------------------------------------------------------------

/** Sidewalk ring + crossings.  This is where a vampire on foot may go. */
export function isWalkable(x, y) {
  if (!CITY || x < 0 || y < 0 || x >= WORLD || y >= WORLD) return false;
  const lot = CITY.lotAt(x, y);
  if (lot) {
    // inside the lot: everything but the building core
    return !(x >= lot.cx0 && x < lot.cx1 && y >= lot.cy0 && y < lot.cy1);
  }
  for (const c of CITY.crossingsNear(x, y)) {
    if (x >= c.x0 && x < c.x1 && y >= c.y0 && y < c.y1) return true;
  }
  return false;
}

/** A bat may fly over roads and kids, but not through walls. */
export function isFlyable(x, y) {
  if (!CITY || x < 0 || y < 0 || x >= WORLD || y >= WORLD) return false;
  const lot = CITY.lotAt(x, y);
  if (!lot) return true;
  return !(x >= lot.cx0 && x < lot.cx1 && y >= lot.cy0 && y < lot.cy1);
}

/** Is this point inside the paved road (used for tyre-screech flavour)? */
export function isRoad(x, y) {
  return !!CITY && !CITY.lotAt(x, y);
}

// ---------------------------------------------------------------------------
// The patrol ring of a block, parameterised by distance t along its perimeter
// ---------------------------------------------------------------------------
// Every lot is a different size, so the ring is a different length on every
// block and `t` is measured in world pixels around that particular one.
// `lateral` is positive *inwards* on all four sides, towards the building.
export function ringPoint(block, t, lateral = 0) {
  const { rx0, ry0, rx1, ry1, perim } = block;
  const w = rx1 - rx0, h = ry1 - ry0;
  t = ((t % perim) + perim) % perim;
  if (t < w) return { x: rx0 + t, y: ry0 + lateral, seg: 0 };
  t -= w;
  if (t < h) return { x: rx1 - lateral, y: ry0 + t, seg: 1 };
  t -= h;
  if (t < w) return { x: rx1 - t, y: ry1 - lateral, seg: 2 };
  t -= w;
  return { x: rx0 + lateral, y: ry1 - t, seg: 3 };
}

/** Project a world point onto a block's ring and return the path parameter. */
export function nearestRingT(block, x, y) {
  const { rx0, ry0, rx1, ry1 } = block;
  const w = rx1 - rx0, h = ry1 - ry0;
  const cx = Math.min(rx1, Math.max(rx0, x)), cy = Math.min(ry1, Math.max(ry0, y));
  const cands = [
    [Math.abs(y - ry0), cx - rx0],                    // north
    [Math.abs(x - rx1), w + (cy - ry0)],              // east
    [Math.abs(y - ry1), w + h + (rx1 - cx)],          // south
    [Math.abs(x - rx0), w + h + w + (ry1 - cy)],      // west
  ];
  cands.sort((a, b) => a[0] - b[0]);
  return cands[0][1];
}

/** The lot a point is standing on, or the nearest one if it is in the road. */
export function blockAt(x, y) {
  if (!CITY) return null;
  const lot = CITY.lotAt(x, y);
  if (lot) return lot;
  let best = CITY.blocks[0], bestD = Infinity;
  for (const b of CITY.blocks) {
    const dx = Math.max(b.x0 - x, 0, x - b.x1), dy = Math.max(b.y0 - y, 0, y - b.y1);
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Districts - a 3x3 carve-up of the city, so clues can name a region
// ---------------------------------------------------------------------------
// The cut does not respect these and is not meant to: a district is a part of
// town, and a block belongs to whichever one its middle stands in.
export const DISTRICTS = [
  { name: 'Gallow Heights',  col: 0, row: 0 },
  { name: 'Old Rattle',      col: 1, row: 0 },
  { name: 'Crowsfoot',       col: 2, row: 0 },
  { name: 'The Gutters',     col: 0, row: 1 },
  { name: 'Midnight Mile',   col: 1, row: 1 },
  { name: 'Sallow Docks',    col: 2, row: 1 },
  { name: 'Coffin Row',      col: 0, row: 2 },
  { name: 'Wretched Park',   col: 1, row: 2 },
  { name: 'The Rind',        col: 2, row: 2 },
];
const THIRD = WORLD / 3;
for (const d of DISTRICTS) {
  d.x0 = d.col * THIRD; d.x1 = d.x0 + THIRD;
  d.y0 = d.row * THIRD; d.y1 = d.y0 + THIRD;
}

export function districtOf(x, y) {
  const col = Math.max(0, Math.min(2, (x / THIRD) | 0));
  const row = Math.max(0, Math.min(2, (y / THIRD) | 0));
  return row * 3 + col;
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
 * A building's entrance, set into its south facade - the only wall the camera
 * actually shows.  `x, y` is the doorstep; `ax, ay` is where the vampire has
 * to stand to knock, out on the pavement of the block the building is on.
 * Only buildings along the south edge of a block have one.
 */
export function doorGeometry(plot, block) {
  return {
    x: (plot.x0 + plot.x1) / 2, y: plot.y1,
    ax: (plot.x0 + plot.x1) / 2, ay: block.ry1,
  };
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
/**
 * `rng` is the night: which door is the party, what hangs beside each one.
 * The layout underneath it comes off `CITY_SEED` and never changes.
 */
export function buildCity(rng, layoutSeed = CITY_SEED) {
  const lrng = makeRng(layoutSeed);
  const roads = [];
  const rim = CITY_RIM;
  const lots = cut(lrng, {
    x0: rim, y0: rim, x1: WORLD - rim, y1: WORLD - rim,
    pad: { n: rim, s: rim, w: rim, e: rim },
  }, 0, roads);

  // the ring road round the outside, so the outermost pavement has a kerb on
  // both sides of it like every other pavement in the city
  roads.push({ axis: 'h', depth: 0, w: rim, x0: 0, x1: WORLD, y0: 0, y1: rim });
  roads.push({ axis: 'h', depth: 0, w: rim, x0: 0, x1: WORLD, y0: WORLD - rim, y1: WORLD });
  roads.push({ axis: 'v', depth: 0, w: rim, x0: 0, x1: rim, y0: 0, y1: WORLD });
  roads.push({ axis: 'v', depth: 0, w: rim, x0: WORLD - rim, x1: WORLD, y0: 0, y1: WORLD });

  // sort north-west first so block ids, avenue numbers and street numbers all
  // run the way you would read them off a map
  lots.sort((a, b) => (a.y0 - b.y0) || (a.x0 - b.x0));

  // Avenues run north-south, streets east-west, and they are numbered from
  // the west and from the north.  A block is addressed by the avenue it backs
  // onto and the street its door opens onto, which is unique: two lots cannot
  // share a south-west corner.
  const avenues = [...new Set(lots.map(l => l.x0))].sort((a, b) => a - b);
  const streets = [...new Set(lots.map(l => l.y1))].sort((a, b) => a - b);

  const blocks = [];
  const doors = [];
  lots.forEach((lot, i) => {
    lot.id = i;
    lot.w = lot.x1 - lot.x0; lot.h = lot.y1 - lot.y0;
    lot.mx = (lot.x0 + lot.x1) / 2; lot.my = (lot.y0 + lot.y1) / 2;
    // the building core, and the ring the pavement is walked along
    lot.cx0 = lot.x0 + WALK; lot.cy0 = lot.y0 + WALK;
    lot.cx1 = lot.x1 - WALK; lot.cy1 = lot.y1 - WALK;
    lot.rx0 = lot.x0 + WALK / 2; lot.ry0 = lot.y0 + WALK / 2;
    lot.rx1 = lot.x1 - WALK / 2; lot.ry1 = lot.y1 - WALK / 2;
    lot.perim = 2 * ((lot.rx1 - lot.rx0) + (lot.ry1 - lot.ry0));
    lot.district = districtOf(lot.mx, lot.my);
    lot.avenue = avenues.indexOf(lot.x0) + 1;
    lot.street = streets.indexOf(lot.y1) + 1;
    lot.lamps = rng.int(2, 4);
    lot.seed = rng.int(0, 1e9);            // the ground, which is per block

    // Cut the core into buildings.  North rows first in the list, so drawing
    // them in order puts each facade over the roof of whatever is behind it.
    const plots = cutPlots(rng, {
      x0: lot.cx0, y0: lot.cy0, x1: lot.cx1, y1: lot.cy1,
    }, []);
    plots.sort((a, b) => (a.y1 - b.y1) || (a.x0 - b.x0));

    // No two doors on one block hang the same thing beside them.  That is
    // load-bearing: the address narrows the city to one block, and the
    // decoration is the only thing left to tell one door on it from another.
    const front = plots.filter(pl => pl.y1 === lot.cy1);
    const decos = rng.shuffle(DECOS.slice());
    if (front.length > DECOS.length) {
      console.warn(`city: block ${i} has ${front.length} doors and only ${DECOS.length} decorations`);
    }

    let d = 0;
    for (const pl of plots) {
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
      Object.assign(pl, {
        block: lot,
        // how tall this one is.  Neighbours differ, so a row of them has a
        // skyline instead of one long parapet.
        wallH: Math.min(rng.int(WALL_MIN, WALL_MAX), pl.y1 - pl.y0 - 56),
        base, baseDark: saturate(palette[1]), roof, roofLight,
        // the same four surfaces as a vampire sees them: same value, no hue
        baseM: toMono(base), baseDarkM: toMono(saturate(palette[1])),
        roofM: toMono(roof), roofLightM: toMono(roofLight),
        seed: rng.int(0, 1e9),
      });

      if (pl.y1 !== lot.cy1) continue;     // no door onto the inside of a block
      const g = doorGeometry(pl, lot);
      const door = {
        id: doors.length,
        block: lot, plot: pl,
        x: g.x, y: g.y, ax: g.ax, ay: g.ay,
        color: DOOR_PAINT,
        deco: decos[d++ % decos.length],
        number: rng.int(1, 99),
        tried: false,
        isParty: false,
      };
      doors.push(door);
      pl.door = door;
    }

    lot.buildings = plots;
    lot.doors = plots.filter(pl => pl.door).map(pl => pl.door);
    lot.door = lot.doors[0];
    blocks.push(lot);
  });

  const lotAt = lotIndex(blocks);
  const crossings = buildCrossings(blocks, lotAt);
  checkConnected(blocks, crossings);
  markGaps(roads);
  const junctions = buildJunctions(roads);

  // crossings are asked about every time the player takes a step, so they get
  // the same bucket index the lots have
  const cbuckets = new Map();
  for (const c of crossings) {
    for (let ty = (c.y0 / TILE) | 0; ty <= ((c.y1 - 1) / TILE) | 0; ty++) {
      for (let tx = (c.x0 / TILE) | 0; tx <= ((c.x1 - 1) / TILE) | 0; tx++) {
        const id = ty * TILE_N + tx;
        if (!cbuckets.has(id)) cbuckets.set(id, []);
        cbuckets.get(id).push(c);
      }
    }
  }

  // Pick the one true door.  Keep it off the outer rim of the city so the
  // player always has room to circle around it.
  const inner = doors.filter(d => d.block.x0 > CITY_RIM + 8 && d.block.x1 < WORLD - CITY_RIM - 8
    && d.block.y0 > CITY_RIM + 8 && d.block.y1 < WORLD - CITY_RIM - 8);
  const party = rng.pick(inner.length ? inner : doors);
  party.isParty = true;

  const city = {
    blocks, doors, party, roads, junctions, crossings, avenues, streets,
    lotAt,
    crossingsNear: (x, y) => cbuckets.get(((y / TILE) | 0) * TILE_N + ((x / TILE) | 0)) || [],
    /** every block whose lot touches a world-space rectangle */
    blocksIn: (x0, y0, x1, y1) => blocks.filter(b =>
      b.x1 > x0 && b.x0 < x1 && b.y1 > y0 && b.y0 < y1),
    roadsIn: (x0, y0, x1, y1) => roads.filter(r =>
      r.x1 > x0 && r.x0 < x1 && r.y1 > y0 && r.y0 < y1),
  };
  setCity(city);
  return city;
}
