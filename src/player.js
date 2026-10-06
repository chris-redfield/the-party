import {
  WALK_SPEED, BAT_SPEED, BAT_TIME, BAT_MANA, BAT_BLOOD, BAT_POOF, MANA_MAX, BLOOD_MAX,
  MANA_REGEN, CANDY_PER_FOLLOWER, MAX_FOLLOWERS, MIN_SPEED_MULT, FOLLOW_THRESHOLD,
  BUMP_ANIM,
} from './config.js';
import { isWalkable, isFlyable } from './city.js';

export const PLAYER_SPEC = {
  skin: '#e4dced', hair: '#14121a', eye: '#1a1622',
  shirt: '#20202e', pants: '#181822', shoes: '#0f0e16',
  cape: '#2b1740', capeLining: '#8e1f33',
  glasses: true, fangs: true,
  shirtFront: '#efecf6', tie: '#b82b42',
};

const HALF_W = 9;
const HALF_H = 5;

function clear(x, y, fly) {
  const test = fly ? isFlyable : isWalkable;
  return test(x - HALF_W, y - HALF_H) && test(x + HALF_W, y - HALF_H)
      && test(x - HALF_W, y + HALF_H) && test(x + HALF_W, y + HALF_H);
}

// Getting shoved around is the good part, and it is aimed by his centre alone:
// the kids, the monsters and the pumpkins each put him on a ring around
// themselves and only ask whether that one point is pavement.  His body is
// wider than a point, so a knock towards a wall or out over the kerb can leave
// a corner or two of him inside it.  Movement refuses any step whose four
// corners are not all clear, and one step is about two pixels, so from in
// there *every* direction is refused at once and he is welded to the spot -
// the only way out was to spend blood on wings.
//
// So the overshoot is given back before he is asked to move: the shortest
// nudge that puts the whole body on ground it may stand on.  The shove itself
// is untouched.  The recoil you see is drawn from `bumpX/bumpY` in render.js
// and never was his position, so he is still thrown about in every direction
// and still ends up displaced - he just cannot be left standing in a wall.
const OUT_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1],
                  [-1, -1], [1, -1], [-1, 1], [1, 1]];
// A centre-legal shove can bury him by at most a corner of the body box, so
// the way out is never longer than that diagonal.
const UNSTICK_MAX = Math.ceil(Math.hypot(HALF_W, HALF_H)) + 2;

function unstick(p, fly) {
  if (clear(p.x, p.y, fly)) return;
  for (let d = 1; d <= UNSTICK_MAX; d++) {
    for (const [ox, oy] of OUT_DIRS) {
      const x = p.x + ox * d, y = p.y + oy * d;
      if (clear(x, y, fly)) { p.x = x; p.y = y; return; }
    }
  }
}

export function makePlayer(x, y) {
  return {
    x, y, dir: 'down', faceX: 0, faceY: 1,
    blood: BLOOD_MAX, mana: MANA_MAX, candy: 0,
    bat: 0, batX: 0, batY: 1, batCooldown: 0,
    poof: 0, poofX: 0, poofY: 0, poofSeed: 0,
    anim: 0, frame: -1, moving: false,
    hurtFlash: 0, gainFlash: 0, followers: 0, stagger: 0,
    bumpT: 0, bumpX: 0, bumpY: 0,
    stepTimer: 0, alive: true,
  };
}

export function speedMultiplier(p) {
  const m = 1 - 0.045 * p.followers - 0.005 * p.candy;
  return Math.max(MIN_SPEED_MULT, m);
}

export function wantedFollowers(p) {
  if (p.candy < FOLLOW_THRESHOLD) return 0;
  return Math.min(MAX_FOLLOWERS, Math.floor(p.candy / CANDY_PER_FOLLOWER));
}

/** Try to turn into a bat. Returns 'mana' | 'blood' | null. */
export function tryBat(p, ix, iy) {
  if (p.bat > 0 || p.batCooldown > 0 || !p.alive) return null;
  let dx = ix, dy = iy;
  if (dx === 0 && dy === 0) { dx = p.faceX; dy = p.faceY; }
  const len = Math.hypot(dx, dy) || 1;
  p.batX = dx / len; p.batY = dy / len;
  p.bat = BAT_TIME;
  p.batCooldown = BAT_TIME + 0.18;
  // the smoke is struck here, on the frame the change happens, and stays on
  // this spot while the bat leaves it
  p.poof = BAT_POOF;
  p.poofX = p.x; p.poofY = p.y;
  p.poofSeed = Math.random() * 6.2832;
  if (p.mana >= BAT_MANA) { p.mana -= BAT_MANA; return 'mana'; }
  p.mana = 0;
  p.blood -= BAT_BLOOD;
  p.hurtFlash = 0.45;
  return 'blood';
}

export function updatePlayer(p, dt, input) {
  if (!p.alive) return;
  if (p.batCooldown > 0) p.batCooldown -= dt;
  if (p.poof > 0) p.poof -= dt;
  if (p.hurtFlash > 0) p.hurtFlash -= dt;
  if (p.stagger > 0) p.stagger -= dt;
  if (p.bumpT > 0) p.bumpT -= dt;
  if (p.gainFlash > 0) p.gainFlash -= dt;

  const flying = p.bat > 0;
  let vx = 0, vy = 0, speed;

  if (flying) {
    p.bat -= dt;
    // a bat keeps its heading but can be steered a little
    if (input.x || input.y) {
      const l = Math.hypot(input.x, input.y);
      p.batX += (input.x / l - p.batX) * Math.min(1, dt * 5);
      p.batY += (input.y / l - p.batY) * Math.min(1, dt * 5);
      const n = Math.hypot(p.batX, p.batY) || 1;
      p.batX /= n; p.batY /= n;
    }
    vx = p.batX; vy = p.batY;
    speed = BAT_SPEED * Math.max(0.55, speedMultiplier(p) + 0.25);
    p.anim += dt * 3;
  } else {
    vx = input.x; vy = input.y;
    const l = Math.hypot(vx, vy);
    if (l > 0) { vx /= l; vy /= l; }
    speed = WALK_SPEED * speedMultiplier(p) * (p.stagger > 0 ? 0 : 1);
    p.moving = l > 0 && p.stagger <= 0;
    if (l > 0) {
      p.faceX = vx; p.faceY = vy;
      p.dir = vy < -0.5 ? 'up' : 'down';
      p.anim += dt;
      // Just a step counter - it is the sprite that knows how many poses
      // there are to cycle through, and they are not the same number for the
      // drawn vampire and the placeholder behind him.
      p.frame = Math.floor(p.anim * 6);
      p.stepTimer -= dt;
    } else {
      p.frame = -1;
    }
    p.mana = Math.min(MANA_MAX, p.mana + MANA_REGEN * dt);
  }

  unstick(p, flying);
  const nx = p.x + vx * speed * dt;
  const ny = p.y + vy * speed * dt;
  if (clear(nx, p.y, flying)) p.x = nx;
  if (clear(p.x, ny, flying)) p.y = ny;

  if (flying && p.bat <= 0) {
    // must land on something walkable; if not, nudge to the nearest sidewalk
    if (!clear(p.x, p.y, false)) {
      let found = false;
      for (let r = 8; r <= 160 && !found; r += 8) {
        for (let a = 0; a < 16; a++) {
          const ang = (a / 16) * Math.PI * 2;
          const tx = p.x + Math.cos(ang) * r, ty = p.y + Math.sin(ang) * r;
          if (clear(tx, ty, false)) { p.x = tx; p.y = ty; found = true; break; }
        }
      }
    }
  }
  p.blood = Math.min(BLOOD_MAX, p.blood);
  if (p.blood <= 0) { p.blood = 0; p.alive = false; }
}

/** Somebody walked into you. Take the shove, in the direction it came from. */
export function shove(p, fromX, fromY) {
  const dx = p.x - fromX, dy = p.y - fromY;
  const d = Math.hypot(dx, dy) || 1;
  p.bumpX = dx / d;
  p.bumpY = dy / d;
  p.bumpT = BUMP_ANIM;
}

/** Height off the ground while in bat form, for the sprite + shadow. */
export function batLift(p) {
  if (p.bat <= 0) return 0;
  const t = 1 - p.bat / BAT_TIME;        // 0..1 through the flight
  return Math.sin(t * Math.PI) * 26;
}
