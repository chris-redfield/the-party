import {
  KIDS_PER_BLOCK, MONSTER_CHANCE, CAT_CHANCE, CAT_RISE, CAT_STRIDE, LIAR_CHANCE,
  BEAST_SNAP, BEAST_KEEP,
  PUMPKINS_PER_BLOCK, PUMPKIN_CROSSING_CHANCE, PUMPKIN_R, PUMPKIN_BLOCK,
  PUMPKIN_LAT, PUMPKIN_CROSS_LAT,
} from './config.js';
import { ringPoint, nearestRingT } from './city.js';

// The pavement of an old-fashioned 384px block, which is what the population
// numbers in config.js were written against.  Blocks are all sizes now, so a
// block gets a share of that population in proportion to how much pavement it
// actually has: a big one is busier than a small one, as it should be.
const NOMINAL_PERIM = 1280;

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
  // Which of the drawn children this one is.  Every child in the city is a
  // drawing now; the coded costume below it is only what stands there in the
  // second before the sheets land, and what is left if one of them never
  // does.  The seed is rolled here and never changes, so a child does not
  // become a different child when the art arrives.
  s.art = rng.int(0, 1e9);
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
  const kids = [], npcs = [], cats = [], pumpkins = [], beasts = [];

  for (const block of city.blocks) {
    const perim = block.perim;
    const busy = perim / NOMINAL_PERIM;

    // Trick-or-treaters move in packs.  A pack of three or four spans the whole
    // sidewalk, and a sidewalk is the only thing you are allowed to walk on -
    // which is the entire reason the bat exists.
    const groups = Math.max(1, Math.round(rng.int(KIDS_PER_BLOCK[0], KIDS_PER_BLOCK[1]) * busy));
    for (let gi = 0; gi < groups; gi++) {
      const stationary = rng.chance(0.28);
      const size = stationary ? rng.int(1, 3)
        : (rng.chance(0.45) ? rng.int(3, 4) : rng.int(1, 2));
      const spread = size >= 3 ? [-23, -8, 8, 23] : [rng.range(-18, 18), rng.range(-18, 18)];
      let t = rng.range(0, perim);
      let lats = spread.slice(0, size);
      if (stationary) {
        // outside one of the block's doors - a block may have several now
        const d = rng.pick(block.doors);
        t = nearestRingT(block, d.ax, d.ay) + rng.range(-20, 20);
        // +lateral is inwards everywhere, so on the south edge it is towards
        // the stoop
        lats = lats.map(() => rng.range(4, 24));
      }
      const dir = rng.chance(0.5) ? 1 : -1;
      const speed = stationary ? 0 : rng.range(24, 46);
      for (let i = 0; i < size; i++) {
        const lat = lats[i] + rng.range(-2, 2);
        const tt = t + (stationary ? rng.range(-18, 18) : rng.range(-6, 6));
        kids.push({
          kind: 'kid', block, t: tt, lat, dir, speed,
          group: `${block.id},${gi}`,
          spec: kidSpec(rng), frame: 0, anim: rng.range(0, 6),
          state: stationary ? 'idle' : 'patrol',
          // the drawings' own direction, until it takes a step and finds out
          faceLeft: true,
          bump: 0, following: false, distract: 0, sayT: 0,
          ...ringPoint(block, tt, lat),
        });
      }
    }

    // The monsters.  To ordinary eyes every one of them is another kid in a
    // costume standing on the pavement - same sprite, same shove, same
    // nothing to say.  `disguise` is what you see; `spec` is what is
    // actually there, and only a cat will show you the difference.
    //
    // `liar` is decided here and never changes: about half of them will send
    // you to the wrong side of the city and sound exactly like the half that
    // will not.  Nothing on screen ever marks it - not the sprite, not the
    // dialogue, not the card it gives you.
    // One block, one monster at the very most - `busy` only thins the small
    // blocks out, it can never buy a second one.
    const nNpc = rng.chance(Math.min(1, MONSTER_CHANCE * busy)) ? 1 : 0;
    for (let i = 0; i < nNpc; i++) {
      const isWitch = rng.chance(0.42);
      const spec = isWitch ? realWitchSpec(rng) : realVampSpec(rng);
      const t = rng.range(0, perim);
      const p = ringPoint(block, t, rng.range(-20, 20));
      npcs.push({
        kind: isWitch ? 'witch' : 'vampire',
        real: true, spec, disguise: kidSpec(rng), block,
        x: p.x, y: p.y,
        bob: rng.range(0, 6.28),
        bump: 0, say: null, sayT: 0,
        liar: rng.chance(LIAR_CHANCE),
        talked: 0, seed: rng.int(0, 1e9),
      });
    }

    // Pumpkins, left out on the pavement.  Always off to one side of it: the
    // lateral offset is what keeps a lane open past them, and a pumpkin that
    // shut a pavement would shut a whole side of a block.  They also keep
    // clear of the doorsteps, because a door you cannot stand at is a door
    // you cannot knock on.
    const nPk = Math.round(rng.int(PUMPKINS_PER_BLOCK[0], PUMPKINS_PER_BLOCK[1]) * busy);
    for (let i = 0; i < nPk; i++) {
      const t = rng.range(0, perim);
      const lat = (rng.chance(0.5) ? 1 : -1) * rng.range(PUMPKIN_LAT * 0.7, PUMPKIN_LAT);
      const q = ringPoint(block, t, lat);
      if (block.doors.some(d => Math.hypot(d.ax - q.x, d.ay - q.y) < 52)) continue;
      pumpkins.push({ x: q.x, y: q.y, block, r: PUMPKIN_R, hit: PUMPKIN_BLOCK,
                      seed: rng.int(0, 1e9) });
    }

    if (rng.chance(Math.min(0.9, CAT_CHANCE * busy))) {
      const t = rng.range(0, perim);
      const lat = rng.range(-16, 16);
      const p = ringPoint(block, t, lat);
      cats.push({
        kind: 'cat', block, t, lat,
        x: p.x, y: p.y, dir: rng.chance(0.5) ? 1 : -1,
        speed: rng.range(10, 26), pause: rng.range(0, 4),
        // what it is doing with itself: sitting, up but not going anywhere
        // yet, or walking.  `step` counts strides, not seconds.
        pose: 'sit', rise: 0, step: rng.range(0, 2), faceLeft: rng.chance(0.5),
        // every cat carries the same thing now: the other way of seeing
        used: false, eye: rng.pick(['#ffd23a', '#ffe98a', '#9bff6a']),
      });
    }
  }
  // And some on the crossings.  A crossing is only CROSS_W wide and it is the
  // only way over a road, so these sit hard against one edge of it and never
  // in the middle - there is always a clear lane on the other side, and the
  // pumpkin is half out on the asphalt where nobody could walk anyway.
  for (const c of city.crossings) {
    if (!rng.chance(PUMPKIN_CROSSING_CHANCE)) continue;
    const side = rng.chance(0.5) ? 1 : -1;
    const mx = (c.x0 + c.x1) / 2, my = (c.y0 + c.y1) / 2;
    const along = rng.range(0.3, 0.7);
    const x = c.axis === 'v' ? mx + side * PUMPKIN_CROSS_LAT : c.x0 + (c.x1 - c.x0) * along;
    const y = c.axis === 'v' ? c.y0 + (c.y1 - c.y0) * along : my + side * PUMPKIN_CROSS_LAT;
    pumpkins.push({ x, y, block: null, r: PUMPKIN_R, hit: PUMPKIN_BLOCK,
                    seed: rng.int(0, 1e9) });
  }

  // ---------------------------------------------------------------------
  // The shadow beasts.  One for every child in the city, which is what makes
  // the street in vampire vision twice as full as the street you have been
  // walking down all night: every one of them has had something at its
  // shoulder the whole time.
  //
  // They are not spawned onto the pavement, they are spawned onto a child -
  // the pavement is wherever their child is, and a child is only ever on one.
  // Nothing collides with them and nothing knows they are there.
  //
  // Each one is handed the list of everybody standing on its child's block.
  // That is what it holds itself off - see updateBeast() - and a block's worth
  // of people is a short enough list to walk every frame, where the city's
  // thousand children is not.
  const crowds = new Map();
  const crowd = (block) => {
    let c = crowds.get(block.id);
    if (!c) { c = []; crowds.set(block.id, c); }
    return c;
  };
  for (const k of kids) crowd(k.block).push(k);
  for (const n of npcs) crowd(n.block).push(n);

  for (const k of kids) {
    beasts.push({
      kind: 'beast', host: k, seed: rng.int(0, 1e9), crowd: crowd(k.block),
      // where it would like to hang: off to one side and a little behind, its
      // own distance, never nearer than the keep-out it is about to be pushed
      // back out to anyway
      side: rng.chance(0.5) ? 1 : -1,
      lag: rng.range(BEAST_KEEP + 2, BEAST_KEEP + 14), back: rng.range(-4, 6),
      ease: rng.range(2.2, 4.4),        // how quickly it closes that gap
      bob: rng.range(0, 6.28), faceLeft: rng.chance(0.5),
      x: k.x, y: k.y,
    });
  }

  return { kids, npcs, cats, pumpkins, beasts };
}

// ---------------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------------
// The drawings face left, so a child heading right is the mirrored one.  It is
// taken from the ground covered rather than from `dir`, which is which way
// round the block the child is going and says nothing about the screen: the
// same `dir` walks it left along one side of a block and right along the
// other.  Walking straight up or down there is nothing to take, so it holds
// whichever way it last faced - a child that snapped back to a default facing
// every time it turned a corner would flicker on every corner.
function faceFrom(k, x0) {
  if (Math.abs(k.x - x0) > 0.02) k.faceLeft = k.x < x0;
}

export function updateKid(k, dt, player) {
  k.anim += dt;
  if (k.bump > 0) k.bump -= dt;
  if (k.chatter > 0) k.chatter -= dt;
  const x0 = k.x;

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
    faceFrom(k, x0);
    return;
  }
  if (k.state === 'patrol') {
    k.t += k.dir * k.speed * dt;
    const p = ringPoint(k.block, k.t, k.lat);
    k.x = p.x; k.y = p.y; k.seg = p.seg;
    k.frame = Math.floor(k.anim * 6) % 2;
    faceFrom(k, x0);
  } else {
    k.frame = -1;
  }
}

/**
 * A cat sits, gets up, stands there a moment, walks, and sooner or later sits
 * back down - three poses rather than the one the coded sprite had.  The
 * standing beat is the point of it: an animal that went from sitting to
 * walking on the same frame reads as a sprite being dragged, and CAT_RISE is
 * how long it holds that pose before it commits to going anywhere.
 *
 * Which way it is facing is taken from the ground it covers rather than from
 * `dir`, because `dir` is which way round the block it is going and a block
 * has four sides: the same `dir` walks it left along one and right along the
 * other.  On the sides where it is walking straight up or down the screen
 * there is nothing to take, so it keeps whichever way it last faced.
 */
/**
 * Shove a point out to BEAST_KEEP from everybody in `crowd` and from the
 * player, if it has got nearer than that to any of them.  Twice over, because
 * being pushed out of one child can put it inside the next.  Dead on top of
 * somebody there is no direction to be pushed in, so it takes the side the
 * beast prefers and goes there.
 */
function clearOfPeople(pt, crowd, player, side) {
  for (let pass = 0; pass < 2; pass++) {
    for (const q of crowd) clearOf(pt, q.x, q.y, side);
    if (player) clearOf(pt, player.x, player.y, side);
  }
  return pt;
}

function clearOf(pt, px, py, side) {
  const dx = pt.x - px, dy = pt.y - py;
  const d = Math.hypot(dx, dy);
  if (d >= BEAST_KEEP) return;
  if (d < 0.01) { pt.x = px + side * BEAST_KEEP; pt.y = py; return; }
  const out = (BEAST_KEEP - d) / d;
  pt.x += dx * out; pt.y += dy * out;
}

/**
 * A beast keeps station on its child: off to one side, a little behind, and
 * always arriving rather than arrived - the easing is what makes it drag
 * after a child who breaks into a walk instead of being welded to it.  It has
 * no walk of its own, and does not need one: it does not touch the ground.
 *
 * Nothing here is collision, and nothing here is on a pavement test.  It goes
 * where its child goes, and its child is the thing that knows about pavements.
 */
export function updateBeast(b, dt, player) {
  const h = b.host;
  // Where it would like to stand, moved off anybody who is standing there.
  const want = clearOfPeople({ x: h.x + b.side * b.lag, y: h.y + b.back },
                             b.crowd, player, b.side);

  const x0 = b.x;
  // Far away from where it should be - because the city stopped simulating it
  // while you were three blocks away - it is simply there.  Easing across half
  // a city would read as a thing flying at you down the street.
  if (Math.hypot(want.x - b.x, want.y - b.y) > BEAST_SNAP) {
    b.x = want.x; b.y = want.y;
  } else {
    const k = 1 - Math.exp(-b.ease * dt);    // same closing rate at any framerate
    b.x += (want.x - b.x) * k;
    b.y += (want.y - b.y) * k;
  }

  // And then the same again on where it actually ended up, which is the half
  // that does the work: it is always arriving rather than arrived, so aiming
  // it at clear ground is not the same as it being on clear ground - the
  // child it is trailing walks, and walks into it.  Resolving the position
  // itself is what makes the keep-out a fact rather than an intention.
  clearOfPeople(b, b.crowd, player, b.side);

  // it turns to face the way it is travelling, and keeps facing that way when
  // it stops - a beast that snaps back to a default facing at rest twitches
  if (Math.abs(b.x - x0) > 0.05) b.faceLeft = b.x < x0;
}

export function updateCat(c, dt) {
  if (c.pause > 0) {                         // sitting down
    c.pose = 'sit';
    c.pause -= dt;
    if (c.pause <= 0) c.rise = CAT_RISE[0] + Math.random() * (CAT_RISE[1] - CAT_RISE[0]);
    return;
  }
  if (c.rise > 0) {                          // on its feet, not moving yet
    c.pose = 'stand';
    c.rise -= dt;
    return;
  }
  c.pose = 'walk';
  const x0 = c.x;
  c.t += c.dir * c.speed * dt;
  const p = ringPoint(c.block, c.t, c.lat);
  c.x = p.x; c.y = p.y;
  c.step += (c.speed * dt) / CAT_STRIDE;     // ringPoint is arc length: t is px
  if (Math.abs(c.x - x0) > 0.02) c.faceLeft = c.x < x0;
  if (Math.random() < 0.004) { c.pause = 1 + Math.random() * 3; c.dir *= -1; }
}
