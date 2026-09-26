// ---------------------------------------------------------------------------
// Procedural pixel art.  Every sprite is a small grid of single-character
// colour keys that gets rasterised once into an offscreen canvas and cached.
// No external image assets, so the whole game is a handful of text files.
// ---------------------------------------------------------------------------

export const W = 16;      // art pixels
export const H = 28;
export const OUTLINE = '#0b0a10';

// --- body templates (rows 4..26; rows 0..3 are reserved for hats) ----------
const BODY_FRONT_TOP = [
  '................', //  4
  '....hhhhhhhh....', //  5
  '...hhhhhhhhhh...', //  6
  '...hhhhhhhhhh...', //  7
  '...hssssssssh...', //  8
  '...sEssssssEs...', //  9
  '...ssssssssss...', // 10
  '....sssmmsss....', // 11
  '....ssssssss....', // 12
  '.....ssssss.....', // 13
  '......ssss......', // 14  neck
  '...tttttttttt...', // 15
  '..stttttttttts..', // 16
  '..stttttttttts..', // 17
  '..stttttttttts..', // 18
  '...tttttttttt...', // 19
  '...pppppppppp...', // 20
  '...pppppppppp...', // 21
];
const BODY_BACK_TOP = [
  '................',
  '....hhhhhhhh....',
  '...hhhhhhhhhh...',
  '...hhhhhhhhhh...',
  '...hhhhhhhhhh...',
  '...hhhhhhhhhh...',
  '...hhhhhhhhhh...',
  '....hhhhhhhh....',
  '....hhhhhhhh....',
  '.....hhhhhh.....',
  '......ssss......',
  '...tttttttttt...',
  '..stttttttttts..',
  '..stttttttttts..',
  '..stttttttttts..',
  '...tttttttttt...',
  '...pppppppppp...',
  '...pppppppppp...',
];
// legs, rows 22..26
const LEGS = [
  [ // frame 0 - contact pose
    '..pppp....pppp..',
    '..pppp....pppp..',
    '..pppp....pppp..',
    '.bbbbb....bbbbb.',
    '.bbbbb....bbbbb.',
  ],
  [ // frame 1 - passing pose
    '....pppppppp....',
    '....pppp.ppp....',
    '....pppp.ppp....',
    '...bbbbb.bbb....',
    '...bbbbb.bbbb...',
  ],
];
// standing still
const LEGS_IDLE = [
  '...pppp..pppp...',
  '...pppp..pppp...',
  '...pppp..pppp...',
  '..bbbbb..bbbbb..',
  '..bbbbb..bbbbb..',
];

// --- overlays ---------------------------------------------------------------
const CAPE = {
  9:  '................',
  10: '..CC........CC..',
  11: '.CCCCCCCCCCCCCC.',
  12: '.CCCCCCCCCCCCCC.',
  13: '.CCCCCCCCCCCCCC.',
  14: '.CCCCCCCCCCCCCC.',
  15: '.CCCCCCCCCCCCCC.',
  16: '.CCCCCCCCCCCCCC.',
  17: '.CCCCCCCCCCCCCC.',
  18: '.CCCCCCCCCCCCCC.',
  19: '..CCCCCCCCCCCC..',
  20: '..CCCCCCCCCCCC..',
  21: '...CCCCCCCCCC...',
  22: '....CCCCCCCC....',
};
const COLLAR = {
  13: '..L..........L..',
  14: '..LL........LL..',
  15: '.LLL........LLL.',
};
const GLASSES = {
  8:  '...GGGGGGGGGG...',
  9:  '...GwGGGGGGwG...',
};
// a crisp white shirt-front + bow tie: keeps the silhouette from going to mud
const SHIRT_FRONT = {
  15: '......WWWW......',
  16: '......WWWW......',
  17: '......WWWW......',
  18: '......WWWW......',
  19: '......WWWW......',
};
const BOWTIE = { 15: '.....RRRRRR.....' };
const ROBE = {
  22: '..pppppppppppp..',
  23: '..pppppppppppp..',
  24: '...pppppppppp...',
  25: '....pppppppp....',
  26: '.....pppppp.....',
};
const HAT_WITCH = {
  0: '.......HH.......',
  1: '......HHHH......',
  2: '......HHHH......',
  3: '.....HHHHHH.....',
  4: '....HHHHHHHH....',
  5: '..HHHHHHHHHHHH..',
  6: '.HHHHHHHHHHHHHH.',
};
const HAT_BAND = { 4: '....AAAAAAAA....' };
const BONES = {
  16: '....wwwwwwww....',
  17: '....w......w....',
  18: '....wwwwwwww....',
  19: '....w......w....',
  20: '......ww........',
  21: '......ww........',
};
const FANGS = { 12: '......f..f......' };
const GHOST = {
  5:  '....NNNNNNNN....',
  6:  '...NNNNNNNNNN...',
  7:  '..NNNNNNNNNNNN..',
  8:  '..NNeeNNNNeeNN..',
  9:  '..NNeeNNNNeeNN..',
  10: '..NNNNNNNNNNNN..',
  11: '..NNNNNNNNNNNN..',
  12: '.NNNNNNNNNNNNNN.',
  13: '.NNNNNNNNNNNNNN.',
  14: '.NNNNNNNNNNNNNN.',
  15: '.NNNNNNNNNNNNNN.',
  16: '.NNNNNNNNNNNNNN.',
  17: '.NNNNNNNNNNNNNN.',
  18: '.NNNNNNNNNNNNNN.',
  19: '.NNNNNNNNNNNNNN.',
  20: '.NNNNNNNNNNNNNN.',
  21: '.NNNNNNNNNNNNNN.',
  22: '.NNNNNNNNNNNNNN.',
  23: '.NNNNNNNNNNNNNN.',
  24: '.NNNNNNNNNNNNNN.',
  25: '.NN.NNN.NNN.NNN.',
};
const PUMPKIN_HEAD = {
  5:  '......OO........',
  6:  '....PPPPPPPP....',
  7:  '...PPPPPPPPPP...',
  8:  '...PPkkPPkkPP...',
  9:  '...PPkkPPkkPP...',
  10: '...PPPPPPPPPP...',
  11: '...PkPkkPkPkP...',
  12: '....PPPPPPPP....',
  13: '.....PPPPPP.....',
};

// Child proportions.  Rows dropped out of the finished grid: two off the
// torso, one off the waist, two off the legs.  The head is left alone, so a
// kid ends up shorter AND top-heavy, which is what reads as "child" at this
// size.  Cutting after compositing means costumes and capes shrink with them.
const CHILD_CUT = new Set([18, 19, 21, 24, 25]);

// ---------------------------------------------------------------------------
// Rasteriser
// ---------------------------------------------------------------------------
function blankGrid(w, h) {
  const g = new Array(h);
  for (let y = 0; y < h; y++) g[y] = new Array(w).fill(null);
  return g;
}

function stamp(grid, rows, colors, yOffset = 0) {
  const entries = Array.isArray(rows)
    ? rows.map((r, i) => [i + yOffset, r])
    : Object.entries(rows).map(([k, r]) => [Number(k) + yOffset, r]);
  for (const [y, row] of entries) {
    if (y < 0 || y >= grid.length) continue;
    for (let x = 0; x < row.length && x < grid[y].length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const c = colors[ch];
      if (c) grid[y][x] = c;
    }
  }
}

/** Turn a colour grid into a canvas, adding a 1px dark outline around it. */
export function rasterize(grid, scale, outline = OUTLINE) {
  const h = grid.length, w = grid[0].length;
  const cw = w + 2, chh = h + 2;
  const cv = document.createElement('canvas');
  cv.width = cw * scale; cv.height = chh * scale;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (outline) {
    ctx.fillStyle = outline;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (grid[y][x]) continue;
      // transparent pixel touching an opaque one -> outline
      const n = (grid[y - 1] && grid[y - 1][x]) || (grid[y + 1] && grid[y + 1][x])
        || grid[y][x - 1] || grid[y][x + 1];
      if (n) ctx.fillRect((x + 1) * scale, (y + 1) * scale, scale, scale);
    }
    // outline also needs to wrap pixels on the grid border
    for (let y = 0; y < h; y++) {
      if (grid[y][0]) ctx.fillRect(0, (y + 1) * scale, scale, scale);
      if (grid[y][w - 1]) ctx.fillRect((w + 1) * scale, (y + 1) * scale, scale, scale);
    }
    for (let x = 0; x < w; x++) {
      if (grid[0][x]) ctx.fillRect((x + 1) * scale, 0, scale, scale);
      if (grid[h - 1][x]) ctx.fillRect((x + 1) * scale, (h + 1) * scale, scale, scale);
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = grid[y][x];
    if (!c) continue;
    ctx.fillStyle = c;
    ctx.fillRect((x + 1) * scale, (y + 1) * scale, scale, scale);
  }
  cv.anchorX = (cw * scale) / 2;   // sprite origin: bottom centre (the feet)
  cv.anchorY = (h + 1) * scale;
  return cv;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------
const cache = new Map();

export function personSprite(spec, dir, frame, scale) {
  const key = JSON.stringify(spec) + '|' + dir + '|' + frame + '|' + scale;
  let cv = cache.get(key);
  if (cv) return cv;

  const g = blankGrid(W, H);
  const back = dir === 'up';
  const colors = {
    h: spec.hair, s: spec.skin, E: spec.eye, m: spec.mouth || '#00000055',
    t: spec.shirt, p: spec.pants, b: spec.shoes,
    C: spec.cape, L: spec.capeLining, G: '#14121c', w: '#e9e6f2',
    W: spec.shirtFront || '#e7e3f0', R: spec.tie || '#a5243a',
    H: spec.hat, A: spec.hatBand || '#d8b23a', f: '#ffffff',
    O: '#4c7a33', P: spec.pumpkin || '#d9812a', k: '#2a1508',
    e: '#0d0c14', N: spec.sheet || '#ddd8ea',
  };

  if (spec.cape) stamp(g, CAPE, colors);
  stamp(g, back ? BODY_BACK_TOP : BODY_FRONT_TOP, colors, 4);
  const legs = spec.float ? null : (frame < 0 ? LEGS_IDLE : LEGS[frame % 2]);
  if (legs) stamp(g, legs, colors, 22);
  else stamp(g, ROBE, colors);
  if (spec.shirtFront && !back) { stamp(g, SHIRT_FRONT, colors); stamp(g, BOWTIE, colors); }
  if (spec.cape) stamp(g, COLLAR, colors);
  if (spec.bones) stamp(g, BONES, colors);
  if (spec.pumpkinHead) stamp(g, PUMPKIN_HEAD, colors);
  if (spec.hat) { stamp(g, HAT_WITCH, colors); stamp(g, HAT_BAND, colors); }
  if (spec.glasses && !back) stamp(g, GLASSES, colors);
  if (spec.fangs && !back) stamp(g, FANGS, colors);
  if (spec.ghost) stamp(g, GHOST, colors);

  cv = rasterize(spec.child ? g.filter((_, i) => !CHILD_CUT.has(i)) : g, scale);
  cache.set(key, cv);
  return cv;
}

// ---------------------------------------------------------------------------
// Cat + bat
// ---------------------------------------------------------------------------
const CAT_ROWS = [
  '..k......k..',
  '..kk....kk..',
  '.kkkkkkkkkk.',
  '.kykkkkkkyk.',
  '.kkkkkkkkkk.',
  '.kkkkkkkkkk.',
  'kkkkkkkkkkkk',
  'kkkkkkkkkkkk',
  '.k.kk..kk.k.',
  '.k.kk..kk.k.',
];
export function catSprite(eye, scale) {
  const key = 'cat|' + eye + '|' + scale;
  let cv = cache.get(key);
  if (cv) return cv;
  const g = blankGrid(12, 10);
  stamp(g, CAT_ROWS, { k: '#16141c', y: eye });
  cv = rasterize(g, scale);
  cache.set(key, cv);
  return cv;
}

const BAT_ROWS = [
  [
    '.w............w.',
    '.ww..........ww.',
    '.www...ww...www.',
    '.wwwwwwwwwwwwww.',
    '..wwwwwwwwwwww..',
    '....wwwwwwww....',
    '......wwww......',
  ],
  [
    '................',
    '......wwww......',
    '.w...wwwwww...w.',
    '.wwwwwwwwwwwwww.',
    '.wwwwwwwwwwwwww.',
    '..wwww....wwww..',
    '..ww........ww..',
  ],
];
export function batSprite(frame, scale) {
  const key = 'bat|' + frame + '|' + scale;
  let cv = cache.get(key);
  if (cv) return cv;
  const g = blankGrid(16, 7);
  stamp(g, BAT_ROWS[frame % 2], { w: '#241c30' });
  // two red eyes
  const row = frame % 2 === 0 ? 3 : 3;
  g[row][6] = '#e0364c'; g[row][9] = '#e0364c';
  cv = rasterize(g, scale);
  cache.set(key, cv);
  return cv;
}

export function clearSpriteCache() { cache.clear(); greyCache = new WeakMap(); }

// ---------------------------------------------------------------------------
// Greyscale twins
// ---------------------------------------------------------------------------
// Under vampire vision the living are drained of colour and only the monsters
// keep theirs.  Rather than rebuild a sprite per colour, every canvas gets one
// grey twin, built once and drawn over the top at whatever alpha the
// changeover is at - identical silhouette, so it reads as a desaturation.
let greyCache = new WeakMap();

export function greySprite(cv) {
  let g = greyCache.get(cv);
  if (g) return g;
  g = document.createElement('canvas');
  g.width = cv.width; g.height = cv.height;
  const ctx = g.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.filter = 'grayscale(1)';
  ctx.drawImage(cv, 0, 0);
  ctx.filter = 'none';
  g.anchorX = cv.anchorX; g.anchorY = cv.anchorY;
  greyCache.set(cv, g);
  return g;
}
