import {
  TILE, TILE_N, WORLD, VIEW_W, VIEW_H, PX,
  LIGHTING, DAWN_TINT, BUMP_ANIM, VISION_BLEED, BAT_POOF,
} from './config.js';
import { makeRng } from './rng.js';
import { personSprite, catSprite, batSprite, greySprite } from './sprites.js';
import { PLAYER_SPEC, batLift } from './player.js';
import { vampFrame, witchArt, nosferatuArt, childWitchFrame, catArt, beastArt } from './artwork.js';
import { C, MIX, lerpHex, applyVision } from './palette.js';
import { drawGround, drawBuilding, drawLamp, lampPositions , drawStreetPumpkin } from './scenery.js';

export { lampPositions };

// The light and glow layers are nothing but soft gradients, so they are drawn
// at half resolution and scaled back up: a quarter of the fill rate, and you
// cannot see the difference.
const LS = 0.5;
const LW = Math.ceil(VIEW_W * LS), LH = Math.ceil(VIEW_H * LS);
let lightCanvas = null, lightCtx = null;
let glowCanvas = null, glowCtx = null;

function ensureBuffers() {
  if (lightCanvas) return;
  lightCanvas = document.createElement('canvas');
  lightCanvas.width = LW; lightCanvas.height = LH;
  lightCtx = lightCanvas.getContext('2d');
  glowCanvas = document.createElement('canvas');
  glowCanvas.width = LW; glowCanvas.height = LH;
  glowCtx = glowCanvas.getContext('2d');
}

// ---------------------------------------------------------------------------
export function makeCamera() {
  return { x: 0, y: 0, z: 1.5, shake: 0 };
}

export function updateCamera(cam, p, dt) {
  const lead = 26;
  const tx = p.x + p.faceX * lead;
  const ty = p.y + p.faceY * lead;
  const k = 1 - Math.pow(0.0015, dt);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  const halfW = VIEW_W / (2 * cam.z), halfH = VIEW_H / (2 * cam.z);
  cam.x = Math.max(halfW, Math.min(WORLD - halfW, cam.x));
  cam.y = Math.max(halfH, Math.min(WORLD - halfH, cam.y));
  if (cam.shake > 0) cam.shake = Math.max(0, cam.shake - dt * 3);
}

/**
 * The camera gives out two offsets, and which one you use decides whether
 * things shake.
 *
 * `ox` is rounded to a whole pixel and is for the city. Ground tiles and
 * buildings are rigid bodies made of many parts, and they all have to be
 * rounded against the same whole number or a window drifts inside its own
 * facade and a tile opens a seam at its edge.
 *
 * `oxf` is the true offset, unrounded, and is for anything alive. A moving
 * sprite has to be rounded ONCE, from its real position on screen - round the
 * camera first and round the sprite second and you get two staircases,
 * stepping on different frames, and their difference is a pixel of shake in
 * whatever direction the thing is travelling. It cancels out the moment it
 * stops moving, which is why walking into a wall settles it.
 *
 * So: the city rounds through `ox`, the living round through `oxf`, and the
 * vampire holds still while the street scrolls under him.
 */
function camOrigin(cam) {
  const z = cam.z;
  let oxf = VIEW_W / 2 - cam.x * z;
  let oyf = VIEW_H / 2 - cam.y * z;
  if (cam.shake > 0) {
    oxf += Math.round((Math.random() - 0.5) * 10 * cam.shake);
    oyf += Math.round((Math.random() - 0.5) * 10 * cam.shake);
  }
  return { ox: Math.round(oxf), oy: Math.round(oyf), oxf, oyf, z };
}

// ---------------------------------------------------------------------------
// Entity drawing
// ---------------------------------------------------------------------------
function shadow(ctx, sx, sy, z, w, a = 0.35) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(sx, sy, w * z, w * 0.42 * z, 0, 0, 6.2832);
  ctx.fill();
  ctx.restore();
}

function bubble(ctx, text, sx, sy, z) {
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.textAlign = 'center';
  const w = ctx.measureText(text).width + 14;
  const h = 20;
  ctx.fillStyle = 'rgba(16,12,26,0.9)';
  ctx.fillRect(sx - w / 2, sy - h, w, h);
  ctx.strokeStyle = 'rgba(200,170,255,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(sx - w / 2, sy - h, w, h);
  ctx.fillStyle = '#ffd88a';
  ctx.fillText(text, sx, sy - 6);
}

function drawSprite(ctx, cv, sx, sy, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  // the people are still pixel art and are not to be interpolated into soup
  ctx.imageSmoothingEnabled = false;
  if (alpha < 1) ctx.globalAlpha = alpha;
  // round the position and the anchor apart, never their sum: the anchor is a
  // fixed property of the sprite and must not drag the rounding of a position
  // that is moving
  ctx.drawImage(cv, Math.round(sx) - Math.round(cv.anchorX),
                Math.round(sy) - Math.round(cv.anchorY));
  ctx.restore();
}

// A monster holds its costume until the changeover is most of the way in and
// then swaps over quickly.  A long slow dissolve between two different
// silhouettes does not read as a disguise coming off, it reads as a bug.
function swapAt(mix) { return Math.max(0, Math.min(1, (mix - 0.3) / 0.4)); }

// One costume in the crowd is a drawing rather than a grid of colours - the
// witch.  It goes through here so that a monster wearing that costume gets the
// drawing too: the disguise has to be the same child as the child standing
// next to it, or the disguise is the tell.  Everybody else, and the witch
// child herself until her sheet lands, is built out of code as before.
function childSprite(spec, dir, frame, anim, scale) {
  return (spec.costume === 'witch' && childWitchFrame(frame, anim, scale))
    || personSprite(spec, dir, frame, scale);
}

function drawPerson(ctx, e, o, t) {
  const { oxf, oyf, z } = o;
  const gx = oxf + e.x * z, gy = oyf + e.y * z;      // where the feet actually are
  const dir = e.dir || 'down';
  const frame = e.frame === undefined ? -1 : e.frame;
  const scale = PX * z;

  if (e.disguise) {
    const swap = swapAt(MIX.vision);
    // it only leaves the ground once it has stopped pretending
    const lift = (4 + Math.sin(t * 2 + (e.bob || 0)) * 3) * swap;
    const sy = gy - lift * z;
    // real monsters cast no shadow. that is the tell, once you can see them.
    if (swap < 1) shadow(ctx, gx, gy, z, 9, 0.35 * (1 - swap));
    if (swap < 1) {
      const kid = childSprite(e.disguise, dir, frame, e.anim, scale);
      drawSprite(ctx, kid, gx, sy, 1);
      drawSprite(ctx, greySprite(kid), gx, sy, MIX.vision);   // drains like any child
    }
    if (swap > 0) {
      // what is really there is a drawing, one per kind of monster; the coded
      // sprite is only what stands in until the sheet lands
      const real = (e.kind === 'witch' ? witchArt(scale) : nosferatuArt(scale))
        || personSprite(e.spec, dir, -1, scale);
      drawSprite(ctx, real, gx, sy, swap);
    }
  } else {
    shadow(ctx, gx, gy, z, 9);
    const cv = childSprite(e.spec, dir, frame, e.anim, scale);
    drawSprite(ctx, cv, gx, gy, 1);
    // the living go black and white. only the monsters keep their colour.
    if (MIX.vision > 0) drawSprite(ctx, greySprite(cv), gx, gy, MIX.vision);
  }
  if (e.sayT > 0 && e.say) bubble(ctx, e.say, gx, gy - 52 * z, z);
}

// ---------------------------------------------------------------------------
// Main scene
// ---------------------------------------------------------------------------
export function drawScene(ctx, cam, game) {
  if (LIGHTING) ensureBuffers();
  const { city, world, player, clock } = game;
  const o = camOrigin(cam);
  const { z } = o;

  const halfW = VIEW_W / (2 * z) + 64, halfH = VIEW_H / (2 * z) + 64;
  // the ground is cached in fixed square tiles; the blocks standing on it are
  // any size at all and are asked for by rectangle
  const t0x = Math.max(0, Math.floor((cam.x - halfW) / TILE));
  const t1x = Math.min(TILE_N - 1, Math.floor((cam.x + halfW) / TILE));
  const t0y = Math.max(0, Math.floor((cam.y - halfH) / TILE));
  const t1y = Math.min(TILE_N - 1, Math.floor((cam.y + halfH) / TILE));
  const tiles = [];
  for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) tiles.push({ tx, ty });
  const near = city.blocksIn(cam.x - halfW, cam.y - halfH, cam.x + halfW, cam.y + halfH);

  applyVision(game.visionMix || 0);
  ctx.imageSmoothingEnabled = false;
  drawGround(ctx, o, tiles, city);

  // candy dropped on the pavement: twists of foil, which is to say the one
  // thing out here that is genuinely shiny
  for (const pile of world.piles) {
    const sx = o.oxf + pile.x * z, sy = o.oyf + pile.y * z;
    shadow(ctx, sx, sy, z, 10, 0.3);
    for (let i = 0; i < Math.min(12, pile.amount); i++) {
      const a = (i / 12) * 6.2832 + pile.seed;
      const px = sx + Math.cos(a) * 9 * z, py = sy + Math.sin(a) * 5 * z;
      const hue = ['#e04a6a', '#e0b23a', '#4ab0e0', '#6ad04a'][i % 4];
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a * 1.7);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.ellipse(0.8 * z, 1.2 * z, 3.4 * z, 2.2 * z, 0, 0, 6.2832); ctx.fill();
      const g = ctx.createLinearGradient(0, -2.4 * z, 0, 2.4 * z);
      g.addColorStop(0, lerpHex(hue, '#ffffff', 0.45));
      g.addColorStop(0.5, hue);
      g.addColorStop(1, lerpHex(hue, '#000000', 0.45));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, 0, 3.2 * z, 2 * z, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = lerpHex(hue, '#000000', 0.3);      // the twisted ends
      ctx.beginPath(); ctx.moveTo(-3 * z, 0); ctx.lineTo(-5 * z, -1.6 * z);
      ctx.lineTo(-5 * z, 1.6 * z); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(3 * z, 0); ctx.lineTo(5 * z, -1.6 * z);
      ctx.lineTo(5 * z, 1.6 * z); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  // sorted draw list: buildings, lamps, people
  const list = [];
  for (const block of near) {
    list.push({ y: block.cy1, fn: () => drawBuilding(ctx, block, o, city, clock.t) });
    for (const l of lampPositions(block)) list.push({ y: l.y, fn: () => drawLamp(ctx, l.x, l.y, o, clock.t) });
  }
  const inView = (e) => e.x > cam.x - halfW && e.x < cam.x + halfW
    && e.y > cam.y - halfH && e.y < cam.y + halfH;

  for (const k of world.kids) if (inView(k)) list.push({ y: k.y, fn: () => drawPerson(ctx, k, o, clock.t) });
  // monsters are standing there the whole night, dressed as somebody's kid
  for (const n of world.npcs) {
    if (inView(n)) list.push({ y: n.y, fn: () => drawNpc(ctx, n, o, clock.t) });
  }
  for (const c of world.cats) if (inView(c)) list.push({ y: c.y, fn: () => drawCat(ctx, c, o, clock.t) });
  // Out of the vision there is nothing to draw and nothing to sort: the whole
  // crowd of them costs the frame nothing at all until the street turns.
  if (swapAt(MIX.vision) > 0.02) {
    for (const b of world.beasts) {
      if (inView(b)) list.push({ y: b.y, fn: () => drawBeast(ctx, b, o, clock.t) });
    }
  }
  // a pumpkin sorts by where it stands, so a child behind one is behind it
  for (const pk of world.pumpkins) {
    if (inView(pk)) list.push({ y: pk.y, fn: () => drawStreetPumpkin(ctx, pk.x, pk.y, o, pk.seed) });
  }
  list.push({ y: player.y, fn: () => drawPlayer(ctx, player, o, clock.t) });
  // the smoke sorts on the spot it was struck, not on wherever the bat is now
  if (player.poof > 0) list.push({ y: player.poofY, fn: () => drawPoof(ctx, player, o) });

  list.sort((a, b) => a.y - b.y);
  for (const item of list) item.fn();

  if (LIGHTING) drawLighting(ctx, o, near, game);
  if (DAWN_TINT) drawDawn(ctx, game.clock);
}

// A monster gets no marker of any kind.  There used to be a coloured ring on
// the ground under one, which was a HUD element pretending to be part of the
// world: what tells you it is not a child is that it has shed the costume,
// left the pavement, kept its colour and lit its eyes, and that it casts no
// shadow at all - the empty ground under it is the tell.
function drawNpc(ctx, n, o, t) {
  drawPerson(ctx, { ...n, dir: 'down', frame: -1 }, o, t);
}

// Cats are a thing of ordinary sight.  The other way of looking does not
// include them at all - they go out of the street as the colour does, and
// come back as it comes back, which is presumably how they prefer it.
function drawCat(ctx, c, o, t) {
  const a = 1 - MIX.vision;
  if (a <= 0.02) return;
  const { oxf, oyf, z } = o;
  const sx = oxf + c.x * z, sy = oyf + c.y * z;
  shadow(ctx, sx, sy, z, 7, 0.28 * a);
  const drawn = catArt(c.pose, c.step, c.faceLeft, PX * z);
  drawSprite(ctx, drawn || catSprite(c.used ? '#6a6a72' : c.eye, PX * z), sx, sy, a);
  // A cat you have already brushed against keeps its eyes and stops burning
  // them at you.  The coded sprite says that by swapping the eye colour out;
  // the drawing has its red painted in, so it says it the way the street says
  // it - the colour drains and the animal stays exactly where it was.
  if (drawn && c.used) drawSprite(ctx, greySprite(drawn), sx, sy, a);
}

// The other half of the street.  A shadow beast is the exact opposite of a cat
// here: the cat is a thing of ordinary sight and goes as the vision comes, and
// the beast is only ever there once the vision has arrived.  It comes in on
// the same beat the costumes come off on - the street does not fill up
// gradually, it turns out to have been full - and like everything that has
// stopped pretending to be a child, it is off the ground and throws nothing on
// to the pavement.
function drawBeast(ctx, b, o, t) {
  const a = swapAt(MIX.vision);
  if (a <= 0.02) return;
  const cv = beastArt(b.seed, b.faceLeft, PX * o.z);
  if (!cv) return;               // they are the drawing or they are nothing
  const lift = 5 + Math.sin(t * 1.6 + b.bob) * 3;
  drawSprite(ctx, cv, o.oxf + b.x * o.z, o.oyf + (b.y - lift) * o.z, a);
}

// ---------------------------------------------------------------------------
// The poof
// ---------------------------------------------------------------------------
// A vampire does not grow wings, it stops being there.  What is left on the
// pavement for half a second is the shape he was standing in, coming apart:
// puffs shoving outwards and upwards off the spot, thinning as they go.  It
// is pinned to where the change happened rather than to the bat, which is
// what makes the bat look like it came out of it.
const POOF_SMOKE = ['#847c96', '#a79fba', '#cbc4da'];   // back to front
const POOF_PUFFS = 11;

function drawPoof(ctx, p, o) {
  const { oxf: ox, oyf: oy, z } = o;
  const u = Math.max(0, Math.min(1, 1 - p.poof / BAT_POOF));
  // Still travelling when its time is up.  It does not ease to a halt, thin
  // out or shrink away - all of those are fading by another name.  It is one
  // solid thing that moves for a third of a second and is then not there,
  // the way a sprite animation ends on its last frame.
  const grow = Math.pow(u, 0.8);
  const gx = ox + p.poofX * z, gy = oy + p.poofY * z;

  // Not one transparent pixel in it.  Flat pixel art has no alpha anywhere
  // else, and smoke you can see the kerb through reads as a bug rather than
  // as smoke.
  for (let layer = 0; layer < POOF_SMOKE.length; layer++) {
    ctx.fillStyle = POOF_SMOKE[layer];
    ctx.beginPath();
    let drew = false;
    for (let i = layer; i < POOF_PUFFS; i += POOF_SMOKE.length) {
      const hash = Math.sin(i * 12.9898 + p.poofSeed) * 43758.5453;
      const j = hash - Math.floor(hash);         // 0..1, steady for this puff
      // every third puff hangs back near the middle so it does not read as a
      // ring of identical blobs
      const near = i % 3 === 0 ? 0.5 : 1;
      const r = (4 + j * 3) * near * (1 + 0.25 * u);
      const a = (i / POOF_PUFFS) * 6.2832 + p.poofSeed + grow * 0.5;
      const d = grow * (11 + j * 7) * near;
      const x = gx + Math.cos(a) * d * z;
      const y = gy + Math.sin(a) * d * 0.45 * z - (4 + grow * 13) * near * z;
      ctx.moveTo(x + r * z, y);
      ctx.arc(x, y, r * z, 0, 6.2832);
      drew = true;
    }
    if (drew) ctx.fill();   // one solid fill per tone - no stacking, no alpha
  }
}

function drawPlayer(ctx, p, o, t) {
  const { oxf: ox, oyf: oy, z } = o;
  const lift = batLift(p);
  // knocked back: a hard shove away from whatever hit you, then a little hop
  // as the vampire picks itself up and pretends that did not happen.
  const bt = p.bumpT > 0 ? p.bumpT / BUMP_ANIM : 0;     // 1 at impact -> 0
  const recoil = bt * bt * 15;
  const hop = bt > 0 ? Math.sin((1 - bt) * Math.PI) * 12 : 0;

  // the mark on the ground stays put; only the vampire leaves it, which is
  // what makes the shove read as a shove and not a teleport
  const gx = ox + p.x * z, gy = oy + p.y * z;
  const sx = gx + p.bumpX * recoil * z;
  const sy = gy + p.bumpY * recoil * z;

  // He has a shadow like everybody else and nothing else under him.  The
  // purple ring that used to mark him is gone: you know which one you are.
  shadow(ctx, gx, gy, z, lift > 0 ? 7 : 10, lift > 0 ? 0.22 : 0.4);

  let cv;
  if (p.bat > 0) {
    cv = batSprite(Math.floor(p.anim * 9) % 2, PX * z);
    ctx.drawImage(cv, Math.round(sx) - Math.round(cv.anchorX),
                  Math.round(sy - (lift + hop) * z) - Math.round(cv.anchorY));
  } else {
    // his own artwork if it has loaded, the drawn placeholder until it has.
    // The sheet faces right, so walking left is the same frame mirrored.
    cv = vampFrame(p.dir === 'up', p.frame, p.faceX < -0.1, PX * z)
      || personSprite(PLAYER_SPEC, p.dir, p.frame, PX * z);
    ctx.drawImage(cv, Math.round(sx) - Math.round(cv.anchorX),
                  Math.round(sy - hop * z) - Math.round(cv.anchorY));
  }

  // the hit itself: a short white star on the side that got shoved
  if (bt > 0.45) {
    const k = (bt - 0.45) / 0.55;
    const cxp = sx - p.bumpX * 15 * z, cyp = sy - 32 * z - p.bumpY * 10 * z;
    ctx.save();
    ctx.globalAlpha = 0.35 + k * 0.65;
    ctx.strokeStyle = '#fff6e8';
    ctx.lineWidth = Math.max(1, 2 * z);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * 6.2832 + 0.4;
      const r0 = 5 * z + (1 - k) * 7 * z, r1 = r0 + 9 * z;
      ctx.beginPath();
      ctx.moveTo(cxp + Math.cos(a) * r0, cyp + Math.sin(a) * r0);
      ctx.lineTo(cxp + Math.cos(a) * r1, cyp + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (p.hurtFlash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.max(0, p.hurtFlash) * 0.6;
    ctx.fillStyle = '#c01030';
    ctx.fillRect(sx - 26 * z, sy - 60 * z, 52 * z, 62 * z);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Night, street light, sunrise
// ---------------------------------------------------------------------------
function drawLighting(ctx, o, blocks, game) {
  const { ox, oy, z } = o;
  const { world, player, clock } = game;

  // how dark is it?  pitch black at the witching hour, bleaching out near 6 AM
  const dawn = Math.max(0, (clock.minutes - 270) / 90);     // starts ~4:30 AM
  const darkness = 0.80 - dawn * 0.48;

  lightCtx.clearRect(0, 0, LW, LH);
  lightCtx.fillStyle = `rgba(8,6,20,${darkness})`;
  lightCtx.fillRect(0, 0, LW, LH);
  lightCtx.globalCompositeOperation = 'destination-out';

  const punch = (wx, wy, r, strength = 1) => {
    const rr = r * z * LS;
    const sx = (ox + wx * z) * LS, sy = (oy + wy * z) * LS;
    if (sx < -rr || sx > LW + rr || sy < -rr || sy > LH + rr) return;
    const g = lightCtx.createRadialGradient(sx, sy, 0, sx, sy, rr);
    g.addColorStop(0, `rgba(0,0,0,${strength})`);
    g.addColorStop(0.55, `rgba(0,0,0,${strength * 0.5})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lightCtx.fillStyle = g;
    lightCtx.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
  };

  for (const block of blocks) {
    for (const l of lampPositions(block)) punch(l.x, l.y - 24, 176, 0.95);
    for (const d of block.doors) if (d.deco.key === 'pumpkin') punch(d.ax, d.ay, 52, 0.6);
  }
  punch(player.x, player.y - 20, 90, 0.5);

  lightCtx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(lightCanvas, 0, 0, VIEW_W, VIEW_H);
  ctx.imageSmoothingEnabled = false;

  // additive warm pools.  No purple bleed at the party door - LIGHTING is off,
  // but if it is ever switched on it must not put the tell back.
  glowCtx.clearRect(0, 0, LW, LH);
  const add = (wx, wy, r, color, alpha) => {
    const rr = r * z * LS;
    const sx = (ox + wx * z) * LS, sy = (oy + wy * z) * LS;
    if (sx < -rr || sx > LW + rr || sy < -rr || sy > LH + rr) return;
    const g = glowCtx.createRadialGradient(sx, sy, 0, sx, sy, rr);
    g.addColorStop(0, color); g.addColorStop(1, 'transparent');
    glowCtx.globalAlpha = alpha;
    glowCtx.fillStyle = g;
    glowCtx.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
  };
  for (const block of blocks) {
    for (const l of lampPositions(block)) add(l.x, l.y - 26, 120, '#ffb84d', 0.20);
    for (const d of block.doors) if (d.deco.key === 'pumpkin') add(d.ax, d.ay, 46, '#ff8a1e', 0.35);
  }
  glowCtx.globalAlpha = 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(glowCanvas, 0, 0, VIEW_W, VIEW_H);
  ctx.restore();
  ctx.imageSmoothingEnabled = false;

}

/** The sky starting to kill you.  Not scenery mood - it is the timer. */
// ---------------------------------------------------------------------------
// The blood
// ---------------------------------------------------------------------------
// A cat lends you the eyes and it comes down the screen as blood: a sheet
// pouring from the top on runs of different lengths, each ending in a heavy
// rounded drop, with a few already falling free of it.  It covers everything
// for a beat and then slides off the bottom, and the city it uncovers is not
// the one it covered.  Drawn over the HUD as well, because it is happening to
// you and not to the city.
export const BLOOD_RED = '#cf1206';
const BLEED_DRIP = 96;             // how far the longest run reaches

const RUNS = (() => {
  const rng = makeRng(0xb1005d);
  const out = [];
  for (let x = -24; x < VIEW_W + 48; x += 42) {
    out.push({
      x: Math.round(x + rng.range(-9, 9)),
      w: Math.round(rng.range(16, 38) / 4) * 4,   // keep the widths chunky
      len: rng.range(0.22, 1),
      lag: rng.range(0, 0.30),                    // runs do not all start together
      drop: rng.chance(0.4),
    });
  }
  return out;
})();

// It falls, so it accelerates: the edge creeps at the top where you can watch
// the runs form, and is moving by the time it reaches the bottom.  Once it has
// the whole screen it does not drain anywhere - it just goes, and what is
// underneath was never the city you were looking at.
const POUR_END = 0.62;             // covered by here
const FADE_START = 0.72;           // holds until here, then goes
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export function drawBleed(ctx, game) {
  if (!game.bleed) return;
  const u = 1 - game.bleed / VISION_BLEED;          // 0..1 through the pour
  const alpha = u < FADE_START
    ? 1 : Math.pow(1 - (u - FADE_START) / (1 - FADE_START), 1.4);
  if (alpha <= 0.01) return;
  const pour = Math.min(1, u / POUR_END);
  const lead = Math.pow(pour, 1.7) * (VIEW_H + BLEED_DRIP);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = BLOOD_RED;
  ctx.fillRect(0, 0, VIEW_W, Math.min(VIEW_H, lead));

  if (lead <= VIEW_H) {                            // runs, while the edge shows
    ctx.beginPath();
    for (const d of RUNS) {
      const grow = easeOut(Math.max(0, Math.min(1, (pour - d.lag) / (1 - d.lag))));
      const len = d.len * BLEED_DRIP * grow;
      const r = d.w / 2;
      if (len <= r) continue;
      ctx.rect(d.x - r, lead, d.w, len - r);       // the run
      ctx.moveTo(d.x + r, lead + len - r);         // the drop on the end of it
      ctx.arc(d.x, lead + len - r, r, 0, 6.2832);
      if (d.drop) {                                // and one already falling
        const dr = Math.max(3, r * 0.62);
        const dy = lead + len + 22 + grow * 70;
        if (dy - dr < VIEW_H) { ctx.moveTo(d.x + dr, dy); ctx.arc(d.x, dy, dr, 0, 6.2832); }
      }
    }
    ctx.fill();
  }
  ctx.restore();
}

function drawDawn(ctx, clock) {
  const dawn = Math.max(0, (clock.minutes - 270) / 90);   // from ~4:30 AM
  if (dawn <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(0.34, dawn * 0.32);
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#ff9440'); g.addColorStop(0.45, '#d8563c'); g.addColorStop(1, '#1e1226');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.restore();
}
