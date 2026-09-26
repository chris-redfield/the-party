import {
  WALK_SPEED, BAT_SPEED, BAT_TIME, BAT_MANA, BAT_BLOOD, MANA_MAX, BLOOD_MAX,
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

export function makePlayer(x, y) {
  return {
    x, y, dir: 'down', faceX: 0, faceY: 1,
    blood: BLOOD_MAX, mana: MANA_MAX, candy: 0,
    bat: 0, batX: 0, batY: 1, batCooldown: 0,
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
  if (p.mana >= BAT_MANA) { p.mana -= BAT_MANA; return 'mana'; }
  p.mana = 0;
  p.blood -= BAT_BLOOD;
  p.hurtFlash = 0.45;
  return 'blood';
}

export function updatePlayer(p, dt, input) {
  if (!p.alive) return;
  if (p.batCooldown > 0) p.batCooldown -= dt;
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
      p.frame = Math.floor(p.anim * 6.5) % 2;
      p.stepTimer -= dt;
    } else {
      p.frame = -1;
    }
    p.mana = Math.min(MANA_MAX, p.mana + MANA_REGEN * dt);
  }

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
