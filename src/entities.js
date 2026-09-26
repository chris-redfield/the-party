import { CELL, GRID, RPERIM, KIDS_PER_BLOCK, MONSTERS_PER_BLOCK, CAT_CHANCE } from './config.js';
import { ringPoint, doorGeometry } from './city.js';

// ---------------------------------------------------------------------------
// Appearance palettes.  Placeholder art - see src/sprites.js.
// ---------------------------------------------------------------------------
const SKINS = ['#f0c9a0', '#e0a97a', '#c08552', '#8d5524', '#6b4226', '#f6dcc0'];
const HAIRS = ['#2b1d14', '#4a2f1b', '#c9a23a', '#7a2f1f', '#161320', '#8a8a96'];
const SHIRTS = ['#2f6fb0', '#3f8f52', '#b04a3a', '#7a4ab0', '#c98a2a', '#2f9a9a', '#b03a6a'];
const PANTS = ['#2e3440', '#3a3a48', '#4a3a2a', '#2a3a4a', '#40354a'];
const SHOES = ['#1a1a22', '#e8e8ee', '#6a3a2a', '#2a3a2a'];
const PUMPKINS = ['#d9812a', '#e0912f', '#c86f22'];
const SHEETS = ['#ddd8ea', '#e6e2f0', '#d2cee0'];

const KID_COSTUMES = ['ghost', 'skeleton', 'pumpkin', 'vamp', 'witch', 'plain', 'plain'];

function baseSpec(rng) {
  return {
    skin: rng.pick(SKINS),
    hair: rng.pick(HAIRS),
    eye: '#241a20',
    shirt: rng.pick(SHIRTS),
    pants: rng.pick(PANTS),
    shoes: rng.pick(SHOES),
  };
}

export function kidSpec(rng) {
  const s = baseSpec(rng);
  s.child = true;                 // shorter body, same size head
  const costume = rng.pick(KID_COSTUMES);
  switch (costume) {
    case 'ghost': s.ghost = true; s.sheet = rng.pick(SHEETS); break;
    case 'skeleton': s.shirt = '#16141c'; s.pants = '#16141c'; s.bones = true; break;
    case 'pumpkin': s.pumpkinHead = true; s.pumpkin = rng.pick(PUMPKINS); break;
    case 'vamp':
      s.cape = '#3a1b48'; s.capeLining = '#b8324a'; s.fangs = true;
      s.shirtFront = '#efe9f6'; s.tie = '#c23a52'; break;
    case 'witch':
      s.hat = '#241d30'; s.hatBand = rng.pick(['#d8b23a', '#6ce05a', '#d94a5f']); break;
  }
  s.costume = costume;
  return s;
}

/** A real vampire: paper-pale, glowing eyes, hovers, casts no shadow. */
export function realVampSpec(rng) {
  return {
    skin: rng.pick(['#e8e2f0', '#ded6ea', '#f0ecf6']),
    hair: rng.pick(['#161320', '#2a1a2e', '#3a2018']),
    eye: '#ff4d5e', mouth: '#00000055',
    shirt: '#241d33', pants: '#1b1727', shoes: '#0f0d15',
    cape: rng.pick(['#2b1740', '#331a2a', '#1d2438']),
    capeLining: '#8e1f33', fangs: true, float: true,
    shirtFront: '#ded8ea', tie: '#8f1d2f',
    glow: '#ff3d55',
  };
}
/** A real witch: green cast, glowing eyes, hovers, no shadow. */
export function realWitchSpec(rng) {
  return {
    skin: rng.pick(['#9fc48a', '#8db87c', '#a8cc96']),
    hair: rng.pick(['#2b1c14', '#4a2f1b', '#161320']),
    eye: '#8dff7a', mouth: '#00000055',
    shirt: '#2c2340', pants: '#221c30', shoes: '#141018',
    hat: '#1c1726', hatBand: '#6ce05a', float: true,
    glow: '#63e84f',
  };
}

// ---------------------------------------------------------------------------
// Spawning
// ---------------------------------------------------------------------------
export function populate(rng, city) {
  const kids = [], npcs = [], cats = [];

  for (const block of city.blocks) {
    const { cx, cy } = block;

    // Trick-or-treaters move in packs.  A pack of three or four spans the whole
    // sidewalk, and a sidewalk is the only thing you are allowed to walk on -
    // which is the entire reason the bat exists.
    const groups = rng.int(KIDS_PER_BLOCK[0], KIDS_PER_BLOCK[1]);
    for (let gi = 0; gi < groups; gi++) {
      const stationary = rng.chance(0.28);
      const size = stationary ? rng.int(1, 3)
        : (rng.chance(0.45) ? rng.int(3, 4) : rng.int(1, 2));
      const spread = size >= 3 ? [-23, -8, 8, 23] : [rng.range(-18, 18), rng.range(-18, 18)];
      let t = rng.range(0, RPERIM);
      let lats = spread.slice(0, size);
      if (stationary) {
        const g = doorGeometry(cx, cy);
        t = nearestRingT(cx, cy, g.ax, g.ay) + rng.range(-20, 20);
        // the door is on the south edge, where +lateral is towards the stoop
        lats = lats.map(() => rng.range(4, 24));
      }
      const dir = rng.chance(0.5) ? 1 : -1;
      const speed = stationary ? 0 : rng.range(24, 46);
      for (let i = 0; i < size; i++) {
        const lat = lats[i] + rng.range(-2, 2);
        const tt = t + (stationary ? rng.range(-18, 18) : rng.range(-6, 6));
        kids.push({
          kind: 'kid', cx, cy, t: tt, lat, dir, speed,
          group: `${cx},${cy},${gi}`,
          spec: kidSpec(rng), frame: 0, anim: rng.range(0, 6),
          state: stationary ? 'idle' : 'patrol',
          bump: 0, following: false, distract: 0, sayT: 0,
          ...ringPoint(cx, cy, tt, lat),
        });
      }
    }

    // The monsters.  To ordinary eyes every one of them is another kid in a
    // costume standing on the pavement - same sprite, same shove, same
    // nothing to say.  `disguise` is what you see; `spec` is what is
    // actually there, and only a cat will show you the difference.
    const nNpc = rng.int(MONSTERS_PER_BLOCK[0], MONSTERS_PER_BLOCK[1]);
    for (let i = 0; i < nNpc; i++) {
      const isWitch = rng.chance(0.42);
      const spec = isWitch ? realWitchSpec(rng) : realVampSpec(rng);
      const t = rng.range(0, RPERIM);
      const p = ringPoint(cx, cy, t, rng.range(-20, 20));
      npcs.push({
        kind: isWitch ? 'witch' : 'vampire',
        real: true, spec, disguise: kidSpec(rng), cx, cy,
        x: p.x, y: p.y,
        bob: rng.range(0, 6.28),
        bump: 0, say: null, sayT: 0,
        talked: 0, seed: rng.int(0, 1e9),
      });
    }

    if (rng.chance(CAT_CHANCE)) {
      const t = rng.range(0, RPERIM);
      const p = ringPoint(cx, cy, t, rng.range(-16, 16));
      cats.push({
        kind: 'cat', cx, cy, t, lat: rng.range(-16, 16),
        x: p.x, y: p.y, dir: rng.chance(0.5) ? 1 : -1,
        speed: rng.range(10, 26), pause: rng.range(0, 4),
        // every cat carries the same thing now: the other way of seeing
        used: false, eye: rng.pick(['#ffd23a', '#ffe98a', '#9bff6a']),
      });
    }
  }
  return { kids, npcs, cats };
}

/** Project a world point onto the block's ring and return the path parameter. */
export function nearestRingT(cx, cy, x, y) {
  let best = 0, bestD = Infinity;
  for (let t = 0; t < RPERIM; t += 8) {
    const p = ringPoint(cx, cy, t, 0);
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------------
export function updateKid(k, dt, player) {
  k.anim += dt;
  if (k.bump > 0) k.bump -= dt;
  if (k.chatter > 0) k.chatter -= dt;

  if (k.following) {
    // trail the player, jostling for position
    const dx = player.x - k.x, dy = player.y - k.y;
    const d = Math.hypot(dx, dy) || 1;
    const want = 34 + k.followSlot * 12;
    const pull = (d - want) * 2.4;
    const sp = Math.max(-90, Math.min(140, pull));
    k.x += (dx / d) * sp * dt;
    k.y += (dy / d) * sp * dt;
    k.frame = sp > 8 ? (Math.floor(k.anim * 7) % 2) : -1;
    return;
  }
  if (k.state === 'patrol') {
    k.t += k.dir * k.speed * dt;
    const p = ringPoint(k.cx, k.cy, k.t, k.lat);
    k.x = p.x; k.y = p.y; k.seg = p.seg;
    k.frame = Math.floor(k.anim * 6) % 2;
  } else {
    k.frame = -1;
  }
}

export function updateCat(c, dt) {
  if (c.pause > 0) { c.pause -= dt; return; }
  c.t += c.dir * c.speed * dt;
  const p = ringPoint(c.cx, c.cy, c.t, c.lat);
  c.x = p.x; c.y = p.y;
  if (Math.random() < 0.004) { c.pause = 1 + Math.random() * 3; c.dir *= -1; }
}
