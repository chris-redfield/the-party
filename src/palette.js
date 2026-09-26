// ---------------------------------------------------------------------------
// Two cities, one palette table
// ---------------------------------------------------------------------------
// The left column is what anybody sees; the right column is what a vampire
// sees when a cat has lent it the eyes.  Every frame the live palette `C` is
// lerped between them by `MIX.scene`, so the changeover fades for free and
// nothing downstream has to know which mode it is in.
//
// `MIX.vision` is the true, continuous reading of the changeover and belongs
// to anything alive - people fade properly, because a person moving in steps
// reads as a dropped frame rather than as the world changing.  `MIX.scene` is
// the same number snapped to a handful of stages, and the city is drawn from
// that, so the street comes back in jerks.
// ---------------------------------------------------------------------------
import { VISION_STEPS } from './config.js';

export const PALETTES = {
  //                       ordinary        vampire vision
  // --- the road -----------------------------------------------------------
  asphalt:        ['#232430', '#1b1b1b'],
  asphaltLit:     ['#2e3040', '#242424'],   // where a lamp reaches it
  asphaltDark:    ['#191a24', '#141414'],
  gutter:         ['#15161e', '#101010'],
  laneLine:       ['#b09433', '#7a7a7a'],
  cross:          ['#a9adc4', '#8c8c8c'],
  manhole:        ['#3a3a42', '#2e2e2e'],
  manholeDark:    ['#1d1d24', '#1a1a1a'],
  drain:          ['#141418', '#101010'],
  // --- the pavement -------------------------------------------------------
  walk:           ['#5b5d6e', '#4e4e4e'],
  walkAlt:        ['#525466', '#474747'],
  walkLine:       ['#42445a', '#3a3a3a'],
  walkLip:        ['#73768c', '#5e5e5e'],
  curb:           ['#767a8f', '#636363'],
  curbFace:       ['#3a3c4e', '#343434'],
  coreShadow:     ['#0f1016', '#0b0b0b'],
  stoop:          ['#6a6780', '#5a5a5a'],
  litter:         ['#6b4f2a', '#3a3a3a'],
  litter2:        ['#4a3c56', '#333333'],
  litter3:        ['#33503a', '#2e2e2e'],
  litter4:        ['#5f3d3d', '#404040'],
  // --- masonry ------------------------------------------------------------
  wallTop:        ['#5e5a76', '#4c4c4c'],
  wallTopDark:    ['#33314a', '#2d2d2d'],
  ledge:          ['#6d6a85', '#585858'],
  dark:           ['#101118', '#0f0f0f'],
  unlit:          ['#1e2130', '#1b1b1b'],
  glassRefl:      ['#4a5470', '#3a3a3a'],
  frame:          ['#7d798e', '#666666'],
  frameLit:       ['#9c97ad', '#7e7e7e'],
  sill:           ['#8e8a9e', '#727272'],
  // --- the roof -----------------------------------------------------------
  roofVent:       ['#41445a', '#363636'],
  roofVentTop:    ['#565a73', '#464646'],
  roofVentShadow: ['#1c1e28', '#1e1e1e'],
  roofVentSlat:   ['#15161e', '#191919'],
  skylightFrame:  ['#5e5a76', '#4c4c4c'],
  tankLeg:        ['#251d16', '#202020'],
  tankBody:       ['#5c452a', '#454545'],
  tankTop:        ['#7b5f3f', '#5a5a5a'],
  tankDark:       ['#2e2216', '#282828'],
  tankBand:       ['#3c2d1c', '#303030'],
  hatchBody:      ['#1e2029', '#1b1b1b'],
  hatchLid:       ['#4b5064', '#3f3f3f'],
  pipe:           ['#4a4d60', '#3c3c3c'],
  // --- the things that are switched on ------------------------------------
  litWindow:      ['#ffc15a', '#e8452f'],
  litWindowPale:  ['#f0d79a', '#b8362c'],
  litWindowDeep:  ['#c98722', '#8e1f1f'],
  litSkylight:    ['#e6c45e', '#d04a34'],
  lamp:           ['#ffd781', '#f2553c'],
  lampGlass:      ['#fff3cf', '#ffb09a'],
  lampMetal:      ['#2c2e3d', '#282828'],
  lampPole:       ['#35374c', '#2f2f2f'],
  lampPoleLit:    ['#4a4e66', '#3e3e3e'],
  pool:           ['#ffb84d', '#ff4a2a'],   // what a lamp puts on the ground
  // the lamp is a bulb in a box until a cat shows you it was always a fire
  torchCup:       ['#33354a', '#2a2724'],
  flameCore:      ['#ffe7bc', '#ffe2b0'],
  flameMid:       ['#ffb347', '#f2553c'],
  flameOuter:     ['#c98a2a', '#8e1f1f'],
  // --- doors --------------------------------------------------------------
  doorFrame:      ['#1b1c25', '#1a1a1a'],
  doorReveal:     ['#0c0d12', '#0a0a0a'],
  doorHandle:     ['#d8c268', '#a8a8a8'],
  doorHandleLit:  ['#fff0b4', '#d8d8d8'],
  triedMark:      ['#f0dcdc', '#f0dcdc'],
  partyLeak:      ['#8e4cd8', '#8e4cd8'],
  partyLeakLit:   ['#d6a8ff', '#d6a8ff'],
  plate:          ['#8e8a9e', '#727272'],
  // the yellow crosshair the road markings make at a four-way junction
  hellCross:      ['#b09433', '#e8452f'],
  hellCrossDark:  ['#6a5a1e', '#4a1109'],
  // --- decorations --------------------------------------------------------
  decoPumpkin:    ['#e08a26', '#b4b4b4'],
  decoPumpkinLit: ['#ffb44a', '#d8d8d8'],
  decoPumpkinDark:['#8f4f12', '#6e6e6e'],
  decoGlow:       ['#ff8a1e', '#d03a22'],
  decoCobweb:     ['#c6c6d8', '#9a9a9a'],
  decoSkeleton:   ['#dcdce8', '#c6c6c6'],
  decoBats:       ['#1d1828', '#191919'],
  decoGhost:      ['#cfcbe0', '#b6b6b6'],
  decoFace:       ['#3a1a08', '#1a1a1a'],
};

/** How much colour the ordinary city has in it.  1 leaves it as written. */
export const SATURATION = 1.9;

/**
 * Push a colour away from grey without moving how bright it is.  The ordinary
 * city is meant to be a colourful night, not a grey one with a tint - so the
 * whole left column goes through this once at load.  The right column never
 * does: what a vampire sees has no hue in it at all, by design.
 */
export function saturate(hex, k = SATURATION) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return hex;                      // a grey stays a grey
  const d = max - min;
  let sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0)
        : max === g ? (b - r) / d + 2
        : (r - g) / d + 4;
  h /= 6;
  sat = Math.min(1, sat * k);
  const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
  const p = 2 * l - q;
  const ch = (tc) => {
    if (tc < 0) tc += 1;
    if (tc > 1) tc -= 1;
    if (tc < 1 / 6) return p + (q - p) * 6 * tc;
    if (tc < 1 / 2) return q;
    if (tc < 2 / 3) return p + (q - p) * (2 / 3 - tc) * 6;
    return p;
  };
  const out = [ch(h + 1 / 3), ch(h), ch(h - 1 / 3)]
    .map(v => Math.round(Math.max(0, Math.min(1, v)) * 255));
  return '#' + ((1 << 24) | (out[0] << 16) | (out[1] << 8) | out[2]).toString(16).slice(1);
}

for (const k in PALETTES) PALETTES[k][0] = saturate(PALETTES[k][0]);

/** Live palette, rebuilt once per frame by applyVision(). */
export const C = {};

/** How far through the changeover we are, in both readings. */
export const MIX = { vision: 0, scene: 0 };

export function lerpHex(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  const r = (ar + (br - ar) * t) | 0, g = (ag + (bg - ag) * t) | 0, bl = (ab + (bb - ab) * t) | 0;
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}

/** `#rrggbb` -> `rgba(r,g,b,a)`, for the soft edges realism needs. */
export function rgba(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function applyVision(mix) {
  MIX.vision = mix;
  MIX.scene = Math.round(mix * VISION_STEPS) / VISION_STEPS;
  for (const k in PALETTES) C[k] = lerpHex(PALETTES[k][0], PALETTES[k][1], MIX.scene);
}
applyVision(0);
