import {
  CELL, GRID, WORLD, ROAD, WALK, CORE0, CORE1, RING0, RING1, CROSS0, CROSS1,
  VIEW_W, VIEW_H, PX, RA, RB, BASS_RADIUS, LIGHTING, DAWN_TINT, COLOR_DOORS,
  BUMP_ANIM, VISION_BLEED, VISION_STEPS, BAT_POOF,
} from './config.js';
import { makeRng } from './rng.js';
import { personSprite, catSprite, batSprite, greySprite } from './sprites.js';
import { PLAYER_SPEC, batLift } from './player.js';

// --- palette ---------------------------------------------------------------
// ---------------------------------------------------------------------------
// Two cities.  The left column is what anybody sees; the right column is what
// a vampire sees when a cat has lent it the eyes.  Every frame the live
// palette `C` is lerped between them by `sceneMix`, so the changeover fades
// for free and nothing downstream has to know which mode it is in.
// ---------------------------------------------------------------------------
const PALETTES = {
  //                       ordinary        vampire vision
  asphalt:        ['#232430', '#1b1b1b'],
  asphaltDark:    ['#1a1b24', '#141414'],
  coreShadow:     ['#0f1016', '#0b0b0b'],
  laneLine:       ['#b09433', '#7a7a7a'],
  walk:           ['#5b5d6e', '#4e4e4e'],
  walkAlt:        ['#525466', '#474747'],
  walkLine:       ['#42445a', '#3a3a3a'],
  curb:           ['#767a8f', '#636363'],
  cross:          ['#a9adc4', '#8c8c8c'],
  manhole:        ['#2c2e3a', '#262626'],
  wallTop:        ['#585470', '#4a4a4a'],
  wallTopDark:    ['#39364c', '#313131'],
  stoop:          ['#6a6780', '#5a5a5a'],
  dark:           ['#14151c', '#131313'],
  unlit:          ['#272b3a', '#242424'],
  litter:         ['#5a4426', '#3a3a3a'],
  litter2:        ['#463a52', '#333333'],
  litter3:        ['#2f4a34', '#2e2e2e'],
  litter4:        ['#5a3a3a', '#404040'],
  roofVent:       ['#3a3d4e', '#313131'],
  roofVentTop:    ['#4a4e63', '#3f3f3f'],
  roofVentShadow: ['#22242e', '#262626'],
  roofVentSlat:   ['#191b24', '#1e1e1e'],
  skylightFrame:  ['#585470', '#4a4a4a'],
  tankLeg:        ['#2a2118', '#242424'],
  tankBody:       ['#5c452a', '#454545'],
  tankTop:        ['#71573a', '#555555'],
  tankBand:       ['#3c2d1c', '#303030'],
  hatchBody:      ['#22242e', '#1e1e1e'],
  hatchLid:       ['#454a5e', '#3c3c3c'],
  lampPole:       ['#33354a', '#2f2f2f'],
  doorFrame:      ['#191a22', '#1a1a1a'],
  doorHandle:     ['#d8c268', '#a8a8a8'],
  triedMark:      ['#f0dcdc', '#f0dcdc'],
  // the things that are switched on
  litWindow:      ['#ffbe4a', '#e8452f'],
  litWindowPale:  ['#e8cf8a', '#b8362c'],
  litSkylight:    ['#e0bd52', '#d04a34'],
  lamp:           ['#ffd781', '#f2553c'],
  // the lamp is a bulb in a box until a cat shows you it was always a fire
  torchCup:       ['#33354a', '#2a2724'],
  flameCore:      ['#ffe7bc', '#ffe2b0'],
  flameMid:       ['#ffb347', '#f2553c'],
  flameOuter:     ['#c98a2a', '#8e1f1f'],
  // the yellow crosshair the road markings make at a four-way junction
  hellCross:      ['#b09433', '#e8452f'],
  hellCrossDark:  ['#6a5a1e', '#4a1109'],
  // decorations
  decoPumpkin:    ['#e08a26', '#b4b4b4'],
  decoCobweb:     ['#b9b9cc', '#9a9a9a'],
  decoSkeleton:   ['#dcdce8', '#c6c6c6'],
  decoBats:       ['#1d1828', '#191919'],
  decoGhost:      ['#cfcbe0', '#b6b6b6'],
  decoFace:       ['#3a1a08', '#1a1a1a'],
};

/** Live palette, rebuilt once per frame by applyVision(). */
const C = {};
// Two readings of the same changeover.  `visionMix` is the true, continuous
// one and belongs to anything alive - people fade properly, because a person
// moving in steps reads as a dropped frame rather than as the world changing.
// `sceneMix` is the same number snapped to a handful of stages, and the city
// is drawn from that, so the street comes back in jerks.
let visionMix = 0;
let sceneMix = 0;

function lerpHex(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  const r = (ar + (br - ar) * t) | 0, g = (ag + (bg - ag) * t) | 0, bl = (ab + (bb - ab) * t) | 0;
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}
export { lerpHex };

function applyVision(mix) {
  visionMix = mix;
  sceneMix = Math.round(mix * VISION_STEPS) / VISION_STEPS;
  for (const k in PALETTES) C[k] = lerpHex(PALETTES[k][0], PALETTES[k][1], sceneMix);
}
applyVision(0);

const WALL_H = 88;          // how much of the core is drawn as a front wall

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

/** Snap the camera so art pixels land on whole screen pixels. */
function camOrigin(cam) {
  const z = cam.z;
  let ox = Math.round((VIEW_W / 2 - cam.x * z));
  let oy = Math.round((VIEW_H / 2 - cam.y * z));
  if (cam.shake > 0) {
    ox += Math.round((Math.random() - 0.5) * 10 * cam.shake);
    oy += Math.round((Math.random() - 0.5) * 10 * cam.shake);
  }
  return { ox, oy, z };
}

// ---------------------------------------------------------------------------
// Ground
// ---------------------------------------------------------------------------
function drawGround(ctx, o, cells) {
  const { ox, oy, z } = o;
  // asphalt underneath everything
  ctx.fillStyle = C.asphalt;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  for (const { cx, cy } of cells) {
    const bx = cx * CELL, by = cy * CELL;
    const X = (w) => ox + (bx + w) * z;
    const Y = (w) => oy + (by + w) * z;

    // lane markings on the two roads that border this cell
    ctx.fillStyle = C.laneLine;
    const dash = 44, gap = 44;
    for (let t = 0; t < CELL; t += dash + gap) {
      // vertical road (left edge of the cell)
      ctx.fillRect(X(ROAD / 2 - 3), Y(t), 6 * z, dash * z);
      // horizontal road (top edge)
      ctx.fillRect(X(t), Y(ROAD / 2 - 3), dash * z, 6 * z);
    }

    // sidewalk ring
    ctx.fillStyle = C.walk;
    ctx.fillRect(X(RING0), Y(RING0), (RING1 - RING0) * z, (RING1 - RING0) * z);
    ctx.fillStyle = C.asphaltDark;   // hole punched for the building footprint
    ctx.fillRect(X(CORE0), Y(CORE0), (CORE1 - CORE0) * z, (CORE1 - CORE0) * z);

    // paving joints
    ctx.fillStyle = C.walkLine;
    for (let t = RING0; t <= RING1; t += 32) {
      ctx.fillRect(X(t), Y(RING0), Math.max(1, z), WALK * z);
      ctx.fillRect(X(t), Y(CORE1), Math.max(1, z), WALK * z);
      ctx.fillRect(X(RING0), Y(t), WALK * z, Math.max(1, z));
      ctx.fillRect(X(CORE1), Y(t), WALK * z, Math.max(1, z));
    }
    // curb highlight along the road side
    ctx.fillStyle = C.curb;
    ctx.fillRect(X(RING0), Y(RING0), (RING1 - RING0) * z, 3 * z);
    ctx.fillRect(X(RING0), Y(RING0), 3 * z, (RING1 - RING0) * z);
    ctx.fillRect(X(RING1 - 3), Y(RING0), 3 * z, (RING1 - RING0) * z);
    ctx.fillRect(X(RING0), Y(RING1 - 3), (RING1 - RING0) * z, 3 * z);

    // zebra crossings
    ctx.fillStyle = C.cross;
    if (cx > 0) for (let s = 6; s < ROAD - 6; s += 22)
      ctx.fillRect(X(s), Y(CROSS0 + 4), 12 * z, (CROSS1 - CROSS0 - 8) * z);
    if (cy > 0) for (let s = 6; s < ROAD - 6; s += 22)
      ctx.fillRect(X(CROSS0 + 4), Y(s), (CROSS1 - CROSS0 - 8) * z, 12 * z);

    // Where two roads meet, the yellow markings cross in the middle of the
    // junction and make a neat little crosshair.  Vampire vision burns that
    // out of the asphalt and stands a cross up in its place, upside down.
    // Road paint only - the zebra crossings are also the surface you are
    // allowed to walk on, so those do not move a pixel.
    if (sceneMix > 0.01) {
      const jx = X(ROAD / 2), jy = Y(ROAD / 2);
      ctx.save();
      ctx.globalAlpha = sceneMix;
      ctx.fillStyle = C.asphalt;                   // wipe the crosshair away
      ctx.fillRect(X(0), Y(0), ROAD * z, ROAD * z);
      // Long arm up, short arm down: Saint Peter's, the wrong way up.  The
      // bar lies exactly along the horizontal lane markings and runs the full
      // width of the junction, and the stem lies along the vertical ones, so
      // the figure is continuous with the road paint it grew out of instead
      // of sitting just off it.
      ctx.fillStyle = C.hellCrossDark;
      ctx.fillRect(jx - 7 * z, jy - 143 * z, 14 * z, 198 * z);
      ctx.fillRect(X(4), jy - 7 * z, (ROAD - 8) * z, 14 * z);
      ctx.fillStyle = C.hellCross;
      ctx.fillRect(jx - 4 * z, jy - 140 * z, 8 * z, 192 * z);
      ctx.fillRect(X(0), jy - 4 * z, ROAD * z, 8 * z);
      ctx.restore();
    }

    // scatter: manholes, leaves, spilled candy wrappers
    const rng = makeRng(cx * 7919 + cy * 104729 + 13);
    for (let i = 0; i < 7; i++) {
      const t = rng.range(RING0 + 8, RING1 - 8);
      const side = rng.int(0, 3);
      let px, py;
      if (side === 0) { px = t; py = rng.range(RING0 + 6, CORE0 - 6); }
      else if (side === 1) { px = t; py = rng.range(CORE1 + 6, RING1 - 6); }
      else if (side === 2) { px = rng.range(RING0 + 6, CORE0 - 6); py = t; }
      else { px = rng.range(CORE1 + 6, RING1 - 6); py = t; }
      ctx.fillStyle = C[rng.pick(['litter', 'litter2', 'litter3', 'litter4'])];
      const s = rng.range(3, 6);
      ctx.fillRect(X(px), Y(py), s * z, s * z);
    }
    ctx.fillStyle = C.manhole;
    ctx.beginPath();
    ctx.arc(X(ROAD / 2), Y(CELL * 0.7), 16 * z, 0, 6.2832);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------
const DECO_KEYS = {
  pumpkin: 'decoPumpkin', cobweb: 'decoCobweb', skeleton: 'decoSkeleton',
  bats: 'decoBats', ghost: 'decoGhost', none: null,
};

function drawDeco(ctx, kind, sx, sy, z) {
  const key = DECO_KEYS[kind];
  if (!key) return;
  const col = C[key];
  ctx.fillStyle = col;
  switch (kind) {
    case 'pumpkin':
      ctx.beginPath(); ctx.arc(sx, sy, 8 * z, 0, 6.2832); ctx.fill();
      ctx.fillStyle = C.decoFace;
      ctx.fillRect(sx - 5 * z, sy - 2 * z, 3 * z, 3 * z);
      ctx.fillRect(sx + 2 * z, sy - 2 * z, 3 * z, 3 * z);
      ctx.fillRect(sx - 4 * z, sy + 3 * z, 8 * z, 2 * z);
      break;
    case 'cobweb':
      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, z * 0.8);
      for (let r = 3; r <= 9; r += 3) {
        ctx.beginPath(); ctx.arc(sx, sy - 6 * z, r * z, 0.1, Math.PI - 0.1); ctx.stroke();
      }
      for (let a = 0; a < 5; a++) {
        ctx.beginPath(); ctx.moveTo(sx, sy - 6 * z);
        const ang = 0.2 + a * 0.68;
        ctx.lineTo(sx + Math.cos(ang) * 10 * z, sy - 6 * z + Math.sin(ang) * 10 * z);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    case 'skeleton':
      ctx.fillRect(sx - 3 * z, sy - 14 * z, 6 * z, 6 * z);
      ctx.fillRect(sx - 2 * z, sy - 8 * z, 4 * z, 8 * z);
      ctx.fillRect(sx - 6 * z, sy - 6 * z, 12 * z, 2 * z);
      break;
    case 'bats':
      for (let i = -1; i <= 1; i++) {
        ctx.fillRect(sx + i * 9 * z - 5 * z, sy - 12 * z + Math.abs(i) * 3 * z, 10 * z, 3 * z);
        ctx.fillRect(sx + i * 9 * z - 2 * z, sy - 13 * z + Math.abs(i) * 3 * z, 4 * z, 3 * z);
      }
      break;
    case 'ghost':
      ctx.fillRect(sx - 1 * z, sy - 16 * z, 2 * z, 8 * z);
      ctx.beginPath(); ctx.arc(sx, sy - 6 * z, 6 * z, Math.PI, 0); ctx.fill();
      ctx.fillRect(sx - 6 * z, sy - 6 * z, 12 * z, 7 * z);
      break;
  }
}

function drawDoor(ctx, door, o, isParty, pulse) {
  const { ox, oy, z } = o;
  const col = COLOR_DOORS ? door.color : { hex: '#4a4a4a', trim: '#606060' };
  const px = ox + door.x * z;        // doorstep, centred on the south facade
  const py = oy + door.y * z;

  // a step out onto the pavement: makes an entrance read as an entrance
  const SD = 20 * z, SW = 52 * z;
  ctx.fillStyle = C.stoop;
  ctx.fillRect(px - SW / 2, py, SW, SD);
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(px - SW / 2, py + SD - 4 * z, SW, 4 * z);

  const dw = 36 * z, dh = 54 * z;
  const dx = px - dw / 2, dy = py - dh;

  ctx.fillStyle = C.doorFrame;                     // frame
  ctx.fillRect(dx - 3 * z, dy - 3 * z, dw + 6 * z, dh + 6 * z);
  ctx.fillStyle = col.hex;
  ctx.fillRect(dx, dy, dw, dh);
  ctx.fillStyle = col.trim;
  ctx.fillRect(dx + 3 * z, dy + 3 * z, dw - 6 * z, dh * 0.18);
  ctx.fillStyle = C.doorHandle;                    // handle
  ctx.fillRect(dx + dw - 8 * z, dy + dh / 2 - 2 * z, 4 * z, 4 * z);

  if (door.tried) {
    ctx.strokeStyle = C.triedMark;   // has to read against the red
    ctx.lineWidth = Math.max(2, 3 * z);
    ctx.beginPath();
    ctx.moveTo(dx + 4 * z, dy + 4 * z); ctx.lineTo(dx + dw - 4 * z, dy + dh - 4 * z);
    ctx.moveTo(dx + dw - 4 * z, dy + 4 * z); ctx.lineTo(dx + 4 * z, dy + dh - 4 * z);
    ctx.stroke();
  }

  drawDeco(ctx, door.deco.key, px + 32 * z, py - 26 * z, z);

  if (isParty) {
    // the only tell on the door itself, and only from close up: light spilling
    // out under it and around the frame.  Painted, not a light source.
    const a = 0.34 + 0.16 * pulse;
    ctx.fillStyle = `rgba(190,140,255,${a})`;
    ctx.fillRect(dx - 2 * z, dy - 2 * z, dw + 4 * z, 2 * z);
    ctx.fillRect(dx - 2 * z, dy - 2 * z, 2 * z, dh + 4 * z);
    ctx.fillRect(dx + dw, dy - 2 * z, 2 * z, dh + 4 * z);
    ctx.fillStyle = `rgba(210,170,255,${a * 0.8})`;
    ctx.fillRect(dx - 4 * z, py - 3 * z, dw + 8 * z, 3 * z);
    ctx.fillStyle = `rgba(190,140,255,${a * 0.35})`;
    ctx.fillRect(px - SW / 2, py, SW, SD * 0.7);
  }
}

function drawBuilding(ctx, block, o, city, t) {
  const { ox, oy, z } = o;
  const bx = block.cx * CELL, by = block.cy * CELL;
  const X = (w) => ox + (bx + w) * z;
  const Y = (w) => oy + (by + w) * z;
  const w = (CORE1 - CORE0) * z;
  const rng = makeRng(block.seed);
  const base = lerpHex(block.base, block.baseM, sceneMix);
  const baseDark = lerpHex(block.baseDark, block.baseDarkM, sceneMix);
  const roof = lerpHex(block.roof, block.roofM, sceneMix);
  const roofLight = lerpHex(block.roofLight, block.roofLightM, sceneMix);

  // a hard shadow on the pavement so the mass reads as solid
  ctx.fillStyle = C.coreShadow;
  ctx.fillRect(X(CORE0 - 7), Y(CORE0 - 7), w + 14 * z, (CORE1 - CORE0 + 14) * z);

  // --- roof ---------------------------------------------------------------
  const rh = (CORE1 - CORE0 - WALL_H) * z;
  ctx.fillStyle = roof;
  ctx.fillRect(X(CORE0), Y(CORE0), w, rh);

  // gravel speckle
  for (let i = 0; i < 44; i++) {
    const gx = rng.range(CORE0 + 10, CORE1 - 12);
    const gy = rng.range(CORE0 + 10, CORE1 - WALL_H - 10);
    ctx.fillStyle = rng.chance(0.5) ? roofLight : C.asphaltDark;
    ctx.fillRect(X(gx), Y(gy), 3 * z, 3 * z);
  }
  // tar-paper seams
  ctx.fillStyle = roofLight;
  for (let ry = CORE0 + 16; ry < CORE1 - WALL_H - 8; ry += 18)
    ctx.fillRect(X(CORE0 + 6), Y(ry), w - 12 * z, Math.max(1, z));

  // skylights
  for (let i = 0; i < 2; i++) {
    const sx2 = CORE0 + 26 + i * 110, sy2 = CORE0 + 30 + rng.range(0, 26);
    ctx.fillStyle = C.skylightFrame;
    ctx.fillRect(X(sx2 - 2), Y(sy2 - 2), 40 * z, 28 * z);
    ctx.fillStyle = rng.chance(0.45) ? C.litSkylight : C.dark;
    ctx.fillRect(X(sx2), Y(sy2), 36 * z, 24 * z);
    ctx.fillStyle = C.skylightFrame;
    ctx.fillRect(X(sx2 + 17), Y(sy2), 2 * z, 24 * z);
  }
  // air handling units
  for (let i = 0; i < 2; i++) {
    const ax2 = rng.range(CORE0 + 20, CORE1 - 60);
    const ay2 = rng.range(CORE0 + 66, CORE1 - WALL_H - 34);
    const aw = rng.range(26, 40), ah = rng.range(18, 26);
    ctx.fillStyle = C.roofVentShadow; ctx.fillRect(X(ax2 + 2), Y(ay2 + 3), aw * z, ah * z);
    ctx.fillStyle = C.roofVent; ctx.fillRect(X(ax2), Y(ay2), aw * z, ah * z);
    ctx.fillStyle = C.roofVentTop; ctx.fillRect(X(ax2), Y(ay2), aw * z, 4 * z);
    ctx.fillStyle = C.roofVentSlat;
    for (let v = 0; v < 3; v++) ctx.fillRect(X(ax2 + 4), Y(ay2 + 8 + v * 5), (aw - 8) * z, 2 * z);
  }
  // water tank on stilts
  {
    const tx = rng.range(CORE0 + 30, CORE1 - 70), ty = CORE0 + 24;
    ctx.fillStyle = C.tankLeg;
    for (let l = 0; l < 4; l++) ctx.fillRect(X(tx + 4 + l * 11), Y(ty + 30), 3 * z, 14 * z);
    ctx.fillStyle = C.tankBody; ctx.fillRect(X(tx), Y(ty), 44 * z, 32 * z);
    ctx.fillStyle = C.tankTop; ctx.fillRect(X(tx), Y(ty), 44 * z, 5 * z);
    ctx.fillStyle = C.tankBand;
    for (let b = 0; b < 3; b++) ctx.fillRect(X(tx), Y(ty + 10 + b * 8), 44 * z, 2 * z);
  }
  // roof hatch
  {
    const hx = CORE1 - 54, hy = CORE1 - WALL_H - 34;
    ctx.fillStyle = C.hatchBody; ctx.fillRect(X(hx), Y(hy), 24 * z, 18 * z);
    ctx.fillStyle = C.hatchLid; ctx.fillRect(X(hx), Y(hy), 24 * z, 5 * z);
  }

  // lip around the whole roof: gives the block its height
  ctx.fillStyle = C.wallTop;
  ctx.fillRect(X(CORE0), Y(CORE0), w, 9 * z);
  ctx.fillRect(X(CORE0), Y(CORE0), 9 * z, rh);
  ctx.fillRect(X(CORE1 - 9), Y(CORE0), 9 * z, rh);
  ctx.fillStyle = C.wallTopDark;
  ctx.fillRect(X(CORE0), Y(CORE0 + 9), w, 3 * z);

  // upper storeys visible on the north face, so the block has a front and back
  for (let c = 0; c < 6; c++) {
    const wx = CORE0 + 16 + c * 40;
    if (wx + 22 > CORE1 - 10) break;
    ctx.fillStyle = rng.chance(0.4) ? C.litSkylight : C.dark;
    ctx.fillRect(X(wx), Y(CORE0 + 14), 22 * z, 14 * z);
  }

  // parapet above the front wall
  ctx.fillStyle = C.wallTop;
  ctx.fillRect(X(CORE0), Y(CORE1 - WALL_H - 8), w, 8 * z);
  ctx.fillStyle = C.wallTopDark;
  ctx.fillRect(X(CORE0), Y(CORE1 - WALL_H), w, 4 * z);

  // front wall
  ctx.fillStyle = base;
  ctx.fillRect(X(CORE0), Y(CORE1 - WALL_H + 4), w, (WALL_H - 4) * z);
  ctx.fillStyle = baseDark;
  ctx.fillRect(X(CORE0), Y(CORE1 - 10), w, 10 * z);

  // windows on the front wall
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 5; c++) {
      const wx = CORE0 + 14 + c * 46;
      const wy = CORE1 - WALL_H + 14 + r * 32;
      if (wx > CORE0 + 88 && wx < CORE0 + 152 && r === 1) continue;   // the door lives here
      const lit = rng.chance(0.55);
      ctx.fillStyle = C.dark;
      ctx.fillRect(X(wx - 2), Y(wy - 2), 30 * z, 24 * z);
      ctx.fillStyle = lit ? (rng.chance(0.3) ? C.litWindow : C.litWindowPale) : C.unlit;
      ctx.fillRect(X(wx), Y(wy), 26 * z, 20 * z);
      ctx.fillStyle = C.dark;
      ctx.fillRect(X(wx + 12), Y(wy), 2 * z, 20 * z);
      ctx.fillRect(X(wx), Y(wy + 9), 26 * z, 2 * z);
    }
  }

  for (const d of block.doors) drawDoor(ctx, d, o, d.isParty, 0.5 + 0.5 * Math.sin(t * 4));
}

// ---------------------------------------------------------------------------
// Street lamps - also the main light sources
// ---------------------------------------------------------------------------
export function lampPositions(block) {
  const bx = block.cx * CELL, by = block.cy * CELL;
  return [
    { x: bx + RA, y: by + RA }, { x: bx + RB, y: by + RA },
    { x: bx + RA, y: by + RB }, { x: bx + RB, y: by + RB },
  ];
}

function drawLamp(ctx, lx, ly, o, t) {
  const { ox, oy, z } = o;
  const sx = ox + lx * z, sy = oy + ly * z;
  ctx.fillStyle = C.lampPole;
  ctx.fillRect(sx - 3 * z, sy - 58 * z, 6 * z, 58 * z);
  ctx.fillRect(sx - 8 * z, sy - 3 * z, 16 * z, 4 * z);
  if (sceneMix < 1) {             // the bulb: one of the two things still lit
    ctx.save();
    ctx.globalAlpha = 1 - sceneMix;
    ctx.fillStyle = C.lamp;
    ctx.fillRect(sx - 7 * z, sy - 66 * z, 14 * z, 9 * z);
    ctx.restore();
  }
  // and underneath the bulb, all night, it was a torch
  if (sceneMix > 0.01) drawFlame(ctx, sx, sy - 58 * z, z, t, lx * 0.017 + ly * 0.011);
}

const FLAME_ROWS = 9;

/** A guttering fire, drawn in the same chunky rows as everything else. */
function drawFlame(ctx, sx, sy, z, t, phase) {
  ctx.save();
  ctx.globalAlpha = sceneMix;
  ctx.fillStyle = C.torchCup;
  ctx.fillRect(sx - 8 * z, sy - 6 * z, 16 * z, 6 * z);
  for (let i = 0; i < FLAME_ROWS; i++) {
    const u = i / (FLAME_ROWS - 1);            // 0 at the cup, 1 at the tip
    const w = (13 - u * 10) * (1 + 0.16 * Math.sin(t * 9 + phase + u * 5));
    const dx = Math.sin(t * 6.5 + phase + u * 4) * u * 4;
    ctx.fillStyle = u < 0.3 ? C.flameCore : (u < 0.68 ? C.flameMid : C.flameOuter);
    ctx.fillRect(sx + dx * z - (w / 2) * z, sy - 6 * z - (i + 1) * 3 * z, w * z, 3 * z);
  }
  ctx.restore();
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
  if (alpha < 1) { ctx.save(); ctx.globalAlpha = alpha; }
  ctx.drawImage(cv, Math.round(sx - cv.anchorX), Math.round(sy - cv.anchorY));
  if (alpha < 1) ctx.restore();
}

// A monster holds its costume until the changeover is most of the way in and
// then swaps over quickly.  A long slow dissolve between two different
// silhouettes does not read as a disguise coming off, it reads as a bug.
function swapAt(mix) { return Math.max(0, Math.min(1, (mix - 0.3) / 0.4)); }

function drawPerson(ctx, e, o, t) {
  const { ox, oy, z } = o;
  const gx = ox + e.x * z, gy = oy + e.y * z;      // where the feet actually are
  const dir = e.dir || 'down';
  const frame = e.frame === undefined ? -1 : e.frame;
  const scale = PX * z;

  if (e.disguise) {
    const swap = swapAt(visionMix);
    // it only leaves the ground once it has stopped pretending
    const lift = (4 + Math.sin(t * 2 + (e.bob || 0)) * 3) * swap;
    const sy = gy - lift * z;
    // real monsters cast no shadow. that is the tell, once you can see them.
    if (swap < 1) shadow(ctx, gx, gy, z, 9, 0.35 * (1 - swap));
    if (swap < 1) {
      const kid = personSprite(e.disguise, dir, frame, scale);
      drawSprite(ctx, kid, gx, sy, 1);
      drawSprite(ctx, greySprite(kid), gx, sy, visionMix);   // drains like any child
    }
    if (swap > 0) drawSprite(ctx, personSprite(e.spec, dir, -1, scale), gx, sy, swap);
  } else {
    shadow(ctx, gx, gy, z, 9);
    const cv = personSprite(e.spec, dir, frame, scale);
    drawSprite(ctx, cv, gx, gy, 1);
    // the living go black and white. only the monsters keep their colour.
    if (visionMix > 0) drawSprite(ctx, greySprite(cv), gx, gy, visionMix);
  }
  if (e.sayT > 0 && e.say) bubble(ctx, e.say, gx, gy - 52 * z, z);
}

// ---------------------------------------------------------------------------
// Main scene
// ---------------------------------------------------------------------------
export function drawScene(ctx, cam, game) {
  if (LIGHTING) ensureBuffers();
  const o = camOrigin(cam);
  const { z } = o;
  const { city, world, player, clock } = game;

  const halfW = VIEW_W / (2 * z) + 64, halfH = VIEW_H / (2 * z) + 64;
  const c0x = Math.max(0, Math.floor((cam.x - halfW) / CELL));
  const c1x = Math.min(GRID - 1, Math.floor((cam.x + halfW) / CELL));
  const c0y = Math.max(0, Math.floor((cam.y - halfH) / CELL));
  const c1y = Math.min(GRID - 1, Math.floor((cam.y + halfH) / CELL));
  const cells = [];
  for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) cells.push({ cx, cy });

  applyVision(game.visionMix || 0);
  ctx.imageSmoothingEnabled = false;
  drawGround(ctx, o, cells);

  // candy dropped on the pavement
  for (const pile of world.piles) {
    const sx = o.ox + pile.x * z, sy = o.oy + pile.y * z;
    shadow(ctx, sx, sy, z, 10, 0.3);
    for (let i = 0; i < Math.min(12, pile.amount); i++) {
      const a = (i / 12) * 6.2832 + pile.seed;
      ctx.fillStyle = ['#e04a6a', '#e0b23a', '#4ab0e0', '#6ad04a'][i % 4];
      ctx.fillRect(sx + Math.cos(a) * 9 * z - 2 * z, sy + Math.sin(a) * 5 * z - 2 * z, 5 * z, 5 * z);
    }
  }

  // sorted draw list: buildings, lamps, people
  const list = [];
  for (const { cx, cy } of cells) {
    const block = city.blockAt(cx, cy);
    list.push({ y: cy * CELL + CORE1, fn: () => drawBuilding(ctx, block, o, city, clock.t) });
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
  list.push({ y: player.y, fn: () => drawPlayer(ctx, player, o, clock.t) });
  // the smoke sorts on the spot it was struck, not on wherever the bat is now
  if (player.poof > 0) list.push({ y: player.poofY, fn: () => drawPoof(ctx, player, o) });

  list.sort((a, b) => a.y - b.y);
  for (const item of list) item.fn();

  if (LIGHTING) drawLighting(ctx, o, cells, game);
  if (DAWN_TINT) drawDawn(ctx, game.clock);
}

function drawNpc(ctx, n, o, t) {
  drawPerson(ctx, { ...n, dir: 'down', frame: -1 }, o, t);
  const ring = swapAt(visionMix);
  if (ring <= 0) return;
  // no shadow, but a faint ring of nothing-in-particular on the ground it is
  // not standing on.  Readable once you know to look for it.
  const { ox, oy, z } = o;
  ctx.save();
  ctx.globalAlpha = (0.20 + 0.08 * Math.sin(t * 3 + n.bob)) * ring;
  ctx.strokeStyle = n.spec.glow;
  ctx.lineWidth = Math.max(1, 2 * z);
  ctx.beginPath();
  ctx.ellipse(ox + n.x * z, oy + n.y * z, 12 * z, 5 * z, 0, 0, 6.2832);
  ctx.stroke();
  ctx.restore();
}

// Cats are a thing of ordinary sight.  The other way of looking does not
// include them at all - they go out of the street as the colour does, and
// come back as it comes back, which is presumably how they prefer it.
function drawCat(ctx, c, o, t) {
  const a = 1 - visionMix;
  if (a <= 0.02) return;
  const { ox, oy, z } = o;
  const sx = ox + c.x * z, sy = oy + c.y * z;
  shadow(ctx, sx, sy, z, 7, 0.28 * a);
  drawSprite(ctx, catSprite(c.used ? '#6a6a72' : c.eye, PX * z), sx, sy, a);
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
  const { ox, oy, z } = o;
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
  const { ox, oy, z } = o;
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

  shadow(ctx, gx, gy, z, lift > 0 ? 7 : 10, lift > 0 ? 0.22 : 0.4);
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = '#9d5cff';
  ctx.lineWidth = Math.max(1, 2 * z);
  ctx.beginPath();
  ctx.ellipse(gx, gy, 13 * z, 6 * z, 0, 0, 6.2832);
  ctx.stroke();
  ctx.restore();

  let cv;
  if (p.bat > 0) {
    cv = batSprite(Math.floor(p.anim * 9) % 2, PX * z);
    ctx.drawImage(cv, Math.round(sx - cv.anchorX), Math.round(sy - (lift + hop) * z - cv.anchorY));
  } else {
    cv = personSprite(PLAYER_SPEC, p.dir, p.frame, PX * z);
    ctx.drawImage(cv, Math.round(sx - cv.anchorX), Math.round(sy - hop * z - cv.anchorY));
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
function drawLighting(ctx, o, cells, game) {
  const { ox, oy, z } = o;
  const { world, player, clock, city } = game;

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

  for (const { cx, cy } of cells) {
    const block = city.blockAt(cx, cy);
    for (const l of lampPositions(block)) punch(l.x, l.y - 24, 176, 0.95);
    for (const d of block.doors) if (d.deco.key === 'pumpkin') punch(d.ax, d.ay, 52, 0.6);
  }
  punch(player.x, player.y - 20, 90, 0.5);
  const party = city.party;
  punch(party.ax, party.ay, 120, 0.5 + 0.2 * Math.sin(clock.t * 4));

  lightCtx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(lightCanvas, 0, 0, VIEW_W, VIEW_H);
  ctx.imageSmoothingEnabled = false;

  // additive warm pools + the party's purple bleed
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
  for (const { cx, cy } of cells) {
    const block = city.blockAt(cx, cy);
    for (const l of lampPositions(block)) add(l.x, l.y - 26, 120, '#ffb84d', 0.20);
    for (const d of block.doors) if (d.deco.key === 'pumpkin') add(d.ax, d.ay, 46, '#ff8a1e', 0.35);
  }
  const pd = Math.hypot(player.x - party.ax, player.y - party.ay);
  if (pd < BASS_RADIUS * 1.4) {
    const k = 1 - Math.min(1, pd / (BASS_RADIUS * 1.4));
    add(party.ax, party.ay, 150, '#a24cff', 0.28 * (0.6 + 0.4 * Math.sin(clock.t * 6)) + 0.2 * k);
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
const BLOOD_RED = '#cf1206';
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
