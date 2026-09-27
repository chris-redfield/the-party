import {
  VIEW_W, VIEW_H, BLOOD_MAX, MANA_MAX, NIGHT_MINUTES, WORLD,
  VISION_SECONDS, GLASS_CLOCK_TEXT, MAX_TIPS, END_STATS,
  WIN_BATS, END, MENU, MENU_POP, CREDITS, HUD_PANELS,
} from './config.js';
import { drawHourglass, GLASS_W, GLASS_H } from './hourglass.js';
import { DISTRICTS, blockAt } from './city.js';
import { shortFact, cardFact, addressOf, claimedIds, FACT_KEYS } from './hints.js';
// the red the cat's gift pours down the screen, which is the red you dry into
import { BLOOD_RED } from './render.js';
import { lerpHex } from './palette.js';
import { deathText, setDeathFont, deathFontsSettled } from './deathtype.js';
import { drawBats } from './bats.js';
// the chalices are drawn in the same line as the city - see src/ink.js
import { inkPoly, inkPath, INK_COLOR } from './ink.js';
import { INK, CHALICE, SCROLL } from './config.js';

const FONT = (px, bold = true) =>
  `${bold ? 'bold ' : ''}${px}px "Courier New", ui-monospace, monospace`;

export function clockText(minutes) {
  const m = Math.floor(minutes);
  let h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const ampm = h < 12 ? 'AM' : 'PM';
  const hh = h === 0 ? 12 : h;
  return `${hh}:${mm} ${ampm}`;
}

/**
 * A line of HUD text with the dark outline every sprite in this game has.
 *
 * The vitals and the clock have no box behind them any more, so the only
 * thing holding them off a lit street is their own outline - the same answer
 * the floating toasts already use, and the same one the drawings use.
 */
function outlined(ctx, text, x, y, fill, size) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.3);
  ctx.strokeStyle = '#0b0a10';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function panel(ctx, x, y, w, h, alpha = 0.86) {
  ctx.fillStyle = `rgba(10,8,18,${alpha})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(160,120,220,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

// ---------------------------------------------------------------------------
// THE CHALICES
// ---------------------------------------------------------------------------
// The two vitals are not bars any more.  They are glasses with something in
// them, and the something moves - which is the whole point: a bar tells you a
// number, a half-empty glass tells you how much is LEFT, and it tells you
// while you are looking somewhere else.
//
// Three rules, and the liquid stops reading as liquid without any of them:
//
//   1. THE SURFACE IS NEVER FLAT AND NEVER STILL.  Two sine waves at
//      different wavelengths and drifting apart, so the surface never repeats
//      a shape you can catch.  One wave is a flag; two is water.
//   2. IT SLOSHES WHEN IT IS SPENT.  Losing blood throws the surface about
//      and it settles over the next second or so.  A drink that only ever
//      goes quietly down reads as a progress bar painted red.
//   3. IT IS OPAQUE AND IT IS FLAT.  No gradient, no shine, no alpha - the
//      house rule everywhere else in this game.  The surface reads because it
//      has the ink line ON it, not because it is lighter at the top.
//
// The glass itself is drawn with the city's own line (src/ink.js), so the
// HUD is in the same hand as the buildings and the children.

// How hard each glass is still rocking, and what it was last full to.  Module
// state because the HUD is redrawn from scratch every frame and a slosh has
// to outlive one of those.
const SLOSH = new Map();

/**
 * The outline of a goblet, as plain points in a w x h box.
 *
 * Deliberately a POLYGON and not a set of curves.  Curves would want to be
 * traced smoothly, and a smooth cup next to the buildings would be the one
 * object in the game that was not cut by hand.  Eight flats down each side of
 * the bowl, drawn with a line that wanders, reads rounder than a real arc and
 * it reads drawn.
 */
function chaliceShape(x, y, w, h) {
  const X = (f) => x + f * w, Y = (f) => y + f * h;
  // down the left of the bowl, across its foot, and back up the right
  const bowl = [
    [X(0.00), Y(0.03)], [X(0.02), Y(0.22)], [X(0.07), Y(0.40)],
    [X(0.16), Y(0.53)], [X(0.30), Y(0.61)], [X(0.50), Y(0.64)],
    [X(0.70), Y(0.61)], [X(0.84), Y(0.53)], [X(0.93), Y(0.40)],
    [X(0.98), Y(0.22)], [X(1.00), Y(0.03)],
  ];
  return {
    bowl,
    rim: { cx: X(0.5), cy: Y(0.03), rx: w * 0.5, ry: h * 0.05 },
    stem: [[X(0.42), Y(0.62)], [X(0.42), Y(0.83)],
           [X(0.58), Y(0.62)], [X(0.58), Y(0.83)]],
    foot: [[X(0.20), Y(0.98)], [X(0.40), Y(0.84)], [X(0.60), Y(0.84)],
           [X(0.80), Y(0.98)]],
    base: [[X(0.20), Y(0.98)], [X(0.80), Y(0.98)]],
    // where the drink lives: the rim line down to the inside of the bowl
    top: Y(0.06), bottom: Y(0.62),
  };
}

/** The bowl as a closed path, so the drink can be clipped to the inside. */
function bowlPath(ctx, sh) {
  ctx.beginPath();
  ctx.moveTo(sh.bowl[0][0], sh.bowl[0][1]);
  for (let i = 1; i < sh.bowl.length; i++) ctx.lineTo(sh.bowl[i][0], sh.bowl[i][1]);
  ctx.closePath();
}

/**
 * One glass, filled to `frac`.
 *
 * `key` names which glass this is so its slosh is remembered between frames,
 * and seeds its wobble so the blood glass and the night glass are cut
 * slightly differently - two identical drawings side by side look printed.
 */
function chalice(ctx, x, y, w, h, frac, key, colors, t, label, value) {
  const sh = chaliceShape(x, y, w, h);
  const f = Math.max(0, Math.min(1, frac));

  // --- how hard is it rocking -------------------------------------------
  let st = SLOSH.get(key);
  if (!st) { st = { last: f, amp: 0, t: t }; SLOSH.set(key, st); }
  const dt = Math.max(0, Math.min(0.1, t - st.t));
  st.t = t;
  // a drop throws it about; a gain rocks it too, but less
  const d = st.last - f;
  if (d > 0.0005) st.amp = Math.min(1, st.amp + d * 9);
  else if (d < -0.0005) st.amp = Math.min(1, st.amp - d * 4);
  st.last = f;
  st.amp = Math.max(0, st.amp - dt * CHALICE.settle);

  const depth = sh.bottom - sh.top;
  const surf = sh.bottom - f * depth;
  const W = INK.weight * 0.85, WB = INK.wobble * 0.8, OV = INK.over * 0.7;
  const seed = key === 'blood' ? 0x81ce : 0x2f7a;

  // --- the empty glass ---------------------------------------------------
  ctx.save();
  bowlPath(ctx, sh);
  ctx.clip();
  ctx.fillStyle = colors.empty;
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

  // --- the drink ---------------------------------------------------------
  if (f > 0.001) {
    // Two waves, different wavelengths, drifting apart at different speeds:
    // their sum never comes back round to the same shape, so the surface
    // never looks like it is looping.  The slosh rides on top of both.
    const rock = st.amp;
    const a1 = (CHALICE.rest + rock * CHALICE.rest * CHALICE.slosh) * (h / 86);
    const a2 = (CHALICE.rest * 0.55 + rock * CHALICE.rest * CHALICE.slosh * 0.45) * (h / 86);
    const k1 = 7.5 / w, k2 = 13.0 / w;
    const p1 = t * 1.7 + (key === 'blood' ? 0 : 2.1);
    const p2 = -t * 2.6 + (key === 'blood' ? 1.3 : 0.4);
    // a slosh tips the whole surface as well as rippling it
    const tilt = Math.sin(t * 5.2) * rock * CHALICE.rest * 3.1 * (h / 86);
    const sy = (px) => {
      const u = (px - x) / w;
      return surf + Math.sin(px * k1 + p1) * a1 + Math.sin(px * k2 + p2) * a2
           + (u - 0.5) * tilt;
    };
    ctx.fillStyle = colors.fill;
    ctx.beginPath();
    ctx.moveTo(x - 3, sy(x - 3));
    for (let px = x - 3; px <= x + w + 3; px += 2) ctx.lineTo(px, sy(px));
    ctx.lineTo(x + w + 3, y + h + 4);
    ctx.lineTo(x - 3, y + h + 4);
    ctx.closePath();
    ctx.fill();
    // The line on the surface.  This is what makes it a surface rather than
    // a place where one colour stops - same trick as the buildings, where
    // the ink is laid on the fill and not left as the edge between two.
    ctx.fillStyle = INK_COLOR;
    ctx.beginPath();
    ctx.moveTo(x - 3, sy(x - 3) - W * 0.6);
    for (let px = x - 3; px <= x + w + 3; px += 2) ctx.lineTo(px, sy(px) - W * 0.6);
    for (let px = x + w + 3; px >= x - 3; px -= 2) ctx.lineTo(px, sy(px) + W * 0.6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // --- the glass, over the drink -----------------------------------------
  inkPoly(ctx, sh.bowl, W, seed, WB, OV, colors.glass);
  inkPoly(ctx, [sh.stem[0], sh.stem[1]], W, seed + 1, WB, OV, colors.glass);
  inkPoly(ctx, [sh.stem[2], sh.stem[3]], W, seed + 2, WB, OV, colors.glass);
  inkPoly(ctx, sh.foot, W, seed + 3, WB, OV, colors.glass);
  inkPoly(ctx, sh.base, W * 1.1, seed + 4, WB, OV, colors.glass);
  // the rim, as an ellipse: the one curve in the drawing, because the mouth
  // of a cup seen from slightly above is the thing that says "cup"
  ctx.strokeStyle = colors.glass;
  ctx.lineWidth = W * 1.15;
  ctx.beginPath();
  ctx.ellipse(sh.rim.cx, sh.rim.cy, sh.rim.rx, sh.rim.ry, 0, 0, 6.2832);
  ctx.stroke();

  // --- what it says ------------------------------------------------------
  ctx.textAlign = 'center';
  ctx.font = FONT(13);
  outlined(ctx, `${label} ${value}`, x + w / 2, y + h + 14, colors.value, 13);
}

// ---------------------------------------------------------------------------
export function drawHud(ctx, game) {
  const { player, clock, tips, city, prompt, dialogue, world } = game;
  ctx.textBaseline = 'alphabetic';

  // --- vitals -------------------------------------------------------------
  // Two glasses instead of two bars.  They are the same two numbers, but a
  // glass is read at a glance and from the corner of the eye, which is the
  // only way anybody reads their health while something is chasing them.
  // 58x86 glasses at 70%.  The panel is sized off them rather than the other
  // way round: 232 wide is what the CANDY line underneath needs at its
  // longest ("KIDS IN TOW 8" on the end of it), and that is the widest thing
  // in here - the glasses themselves would sit happily in less.
  // The box behind them is gone.  Two drawn glasses standing on the street
  // are a drawing standing on the street; the same two inside a violet
  // rectangle are a drawing inside a widget, and the rectangle is the only
  // ruled edge left on the screen.  The words under them keep their footing
  // the way the toasts do, on their own dark outline (see `outlined`).
  // The layout is unchanged: 232 wide is still what the CANDY line needs at
  // its longest ("KIDS IN TOW 8"), and the glasses still start at y=34.
  if (HUD_PANELS) panel(ctx, 16, 16, 232, 124);
  chalice(ctx, 54, 34, 41, 60, player.blood / BLOOD_MAX, 'blood',
          { fill: '#b01f36', empty: '#241016', glass: '#e8dae0',
            label: '#c98a96', value: '#efe8f8' },
          clock.t, 'BLOOD', `${Math.ceil(player.blood)}`);
  chalice(ctx, 170, 34, 41, 60, player.mana / MANA_MAX, 'night',
          { fill: '#7a45d0', empty: '#1a1430', glass: '#ded4f0',
            label: '#a89ac8', value: '#efe8f8' },
          clock.t, 'NIGHT', `${Math.ceil(player.mana)}`);
  ctx.font = FONT(15);
  ctx.textAlign = 'left';
  let candyLine = `CANDY ${player.candy}`;
  if (player.followers > 0) candyLine += `   KIDS IN TOW ${player.followers}`;
  outlined(ctx, candyLine, 26, 130,
           player.candy > 0 ? '#e8b23a' : '#9a94a8', 15);

  // --- the hourglass ------------------------------------------------------
  // No digits.  The moon in the top bulb is ground down into the sun in the
  // bottom one, and when the sun is whole it is 6:00 AM.
  const left = NIGHT_MINUTES - clock.minutes;
  const panic = left < 60;
  drawClock(ctx, clock, panic);

  drawMinimap(ctx, game);
  // The deck stays up while somebody is talking to you - that is the moment a
  // card arrives, and watching it land is the point.  It clears the dialogue
  // box on the left, which the old text panel did not, which is why that one
  // had to be hidden.
  drawClues(ctx, tips);

  // --- interaction prompt --------------------------------------------------
  if (prompt && !dialogue) {
    ctx.textAlign = 'center';
    ctx.font = FONT(18);
    const w = ctx.measureText(prompt).width + 40;
    panel(ctx, VIEW_W / 2 - w / 2, VIEW_H - 148, w, 38, 0.8);
    ctx.fillStyle = '#f2e8ff';
    ctx.fillText(prompt, VIEW_W / 2, VIEW_H - 122);
  }

  if (dialogue) drawDialogue(ctx, dialogue);

  // --- floating toasts -----------------------------------------------------
  // The one thing the game says to you while you are playing, and it says it
  // in the same face the end of the night is set in - the letters the city
  // itself talks in.  They keep their colours: what happened is in the
  // colour, and the face is only how it is spoken.
  ctx.textAlign = 'center';
  for (const t of game.toasts) {
    const a = Math.min(1, t.life / 0.6);
    ctx.globalAlpha = a;
    // This face is thinner than the mono it replaced, and these words land
    // over a lit street full of children, so they get the same dark outline
    // every sprite in the game has rather than a panel behind them.
    const size = t.big ? 34 : 24;
    const y = VIEW_H * 0.36 - t.rise;
    setDeathFont(ctx, size);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.16);
    ctx.strokeStyle = '#0b0a10';
    ctx.strokeText(t.text, VIEW_W / 2, y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, VIEW_W / 2, y);
    ctx.globalAlpha = 1;
  }
}

// The whole clock: an hourglass in a panel, with a line of bad news under it.
// Nothing is written under the glass.  It used to say SUNRISE AT 6:00 AM,
// which never changed and so told you nothing you did not know by the second
// time you read it, and THE SKY IS GETTING IDEAS in the last hour, which went
// with it because it lived in the same two lines.  The last hour announces
// itself perfectly well without words now: the glass cracks, the sun burns up
// to its bright red and the skull's sockets light.  The panel hugs the glass.
const CLOCK_PAD = 12;
const CLOCK_W = GLASS_W + CLOCK_PAD * 2;
// room under it only if the digits have been switched back on
const CLOCK_H = GLASS_H + CLOCK_PAD * 2 + (GLASS_CLOCK_TEXT ? 26 : 0);

function drawClock(ctx, clock, panic) {
  const x = VIEW_W - 16 - CLOCK_W, y = 16;
  if (HUD_PANELS) panel(ctx, x, y, CLOCK_W, CLOCK_H, panic ? 0.92 : 0.86);
  drawHourglass(ctx, x + CLOCK_PAD, y + CLOCK_PAD,
                clock.minutes / NIGHT_MINUTES, clock.t, panic);

  if (GLASS_CLOCK_TEXT) {
    const hot = panic && Math.floor(clock.t * 4) % 2;
    ctx.textAlign = 'center';
    ctx.font = FONT(20);
    outlined(ctx, clockText(clock.minutes), x + CLOCK_W / 2,
             y + CLOCK_PAD + GLASS_H + 20,
             panic ? (hot ? '#ff5a4a' : '#ffb24a') : '#f0e6ff', 20);
  }
}

// ---------------------------------------------------------------------------
function drawDialogue(ctx, d) {
  drawSpeech(ctx, d.name, d.text, 'E / SPACE to continue', d.nameColor);
}

/**
 * The box somebody talks in.  Split out of drawDialogue so the intro can use
 * it: a line spoken over the drawings should be the same box, in the same
 * face, in the same place as every line spoken on the pavement - it is the
 * same man talking.
 */
export function drawSpeech(ctx, name, text, hint, nameColor, reveal) {
  const boxW = 780, boxH = 122;
  const x = VIEW_W / 2 - boxW / 2, y = VIEW_H - boxH - 28;
  panel(ctx, x, y, boxW, boxH, 0.9);
  ctx.textAlign = 'left';
  // A name, if anybody is saying it.  The intro is nobody: the man on the
  // drawing is you, and a box captioned YOU over a picture of yourself is the
  // one thing on that screen you have to read twice to place.  With no name
  // the line simply starts where the name was, rather than leaving a blank
  // first row - an empty caption reads as a missing one.
  let ty0 = y + 56;
  if (name) {
    ctx.font = FONT(15);
    ctx.fillStyle = nameColor || '#c9a8ff';
    ctx.fillText(name, x + 22, y + 28);
  } else ty0 = y + 34;
  ctx.font = FONT(18, false);
  ctx.fillStyle = '#efe6fa';
  // `reveal` is how many characters of it have arrived - the line types itself
  // out.  IT IS WRAPPED WHOLE AND THEN CUT, never wrapped as it grows: wrapping
  // the part of it that has arrived reflows the box on the letter that tips a
  // word onto the next line, and words jump about while you are reading them.
  if (reveal == null) {
    wrap(ctx, text, x + 22, ty0, boxW - 44, 24);
  } else {
    let left = reveal, ty = ty0;
    for (const line of wrapLines(ctx, text, boxW - 44)) {
      if (left <= 0) break;
      ctx.fillText(left >= line.length ? line : line.slice(0, left), x + 22, ty);
      left -= line.length + 1;      // the break counts, so the pace stays even
      ty += 24;
    }
  }
  if (!hint) return;
  ctx.font = FONT(12);
  ctx.fillStyle = '#8a7ea8';
  ctx.textAlign = 'right';
  ctx.fillText(hint, x + boxW - 20, y + boxH - 12);
}

function wrap(ctx, text, x, y, maxW, lh) {
  for (const line of wrapLines(ctx, text, maxW)) { ctx.fillText(line, x, y); y += lh; }
}


// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// The tips, as a deck
// ---------------------------------------------------------------------------
// Every tip you get off a monster is a card, and they pile up along the axis
// between you and the screen.  The newest lies face up at the front; the ones
// underneath show only their corner index, the way a real deck does when it
// is not squared up.
//
// The deck is no longer four cards.  Every monster gives you one and half of
// them lie, so the pile is as deep as the number of monsters you have reached
// and may hold two AVENUE cards that disagree.  Nothing marks either of them
// - the suit tells you which fact a card is about, the corner tells you what
// it claims, and the two sitting there contradicting each other is the whole
// of what the game will do for you.
const CARD_W = 92, CARD_H = 129;       // the proportions of a playing card
const CARD_DX = 12, CARD_DY = 22;      // how far each card underneath shows
// A deep pile has to stay on the screen, so the stack squeezes once it would
// climb past this line.  The corner index needs its own strip of card to be
// readable, which is what the vertical offset is for.
const CARD_CEIL = 200;
const CARD_STOCK = '#efe9e2';
const CARD_EDGE = '#14121c';
const SUITS = {
  district: ['\u2660', '#1b1622'],
  avenue: ['\u2666', '#b3122b'],
  street: ['\u2663', '#1b1622'],
  deco: ['\u2665', '#b3122b'],
};
const CARD_NAME = { district: 'DISTRICT', avenue: 'AVENUE', street: 'STREET', deco: 'THE DOOR' };

function cardShape(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapLines(ctx, text, maxW) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function drawCard(ctx, x, y, tip, front) {
  const { key, value } = tip;
  cardShape(ctx, x, y, CARD_W, CARD_H, 8);
  ctx.fillStyle = CARD_STOCK;
  ctx.fill();
  ctx.strokeStyle = CARD_EDGE;
  ctx.lineWidth = 2;
  ctx.stroke();

  const [pip, ink] = SUITS[key];
  // The corner index is the only part of a buried card you can still read, so
  // it carries the fact itself rather than a suit and a number.
  ctx.textAlign = 'left';
  ctx.font = FONT(12);
  ctx.fillStyle = ink;
  ctx.fillText(pip, x + 8, y + 17);
  const token = cardFact(key, value);
  let size = 12;
  while (size > 7) { ctx.font = FONT(size); if (ctx.measureText(token).width <= CARD_W - 34) break; size--; }
  ctx.font = FONT(size);
  ctx.fillStyle = '#2a2432';
  ctx.fillText(token, x + 23, y + 17);
  if (!front) return;

  ctx.textAlign = 'center';
  ctx.font = FONT(30);
  ctx.fillStyle = ink;
  ctx.fillText(pip, x + CARD_W / 2, y + 68);

  // the face carries the full wording, shrunk until it sits on the card
  const text = shortFact(key, value);
  let fs = 13, lines = [];
  for (const s of [13, 12, 11, 10, 9, 8]) {
    fs = s; ctx.font = FONT(s);
    lines = wrapLines(ctx, text, CARD_W - 16);
    if (lines.length <= 2) break;
  }
  ctx.font = FONT(fs);
  ctx.fillStyle = '#1b1622';
  const lh = fs + 2;
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, x + CARD_W / 2, y + 90 + i * lh));

  ctx.font = FONT(9);
  ctx.fillStyle = '#6a6478';
  ctx.fillText(CARD_NAME[key], x + CARD_W / 2, y + CARD_H - 9);
}

/** Face down: the tips you have not been given yet. */
function drawCardBack(ctx, x, y) {
  cardShape(ctx, x, y, CARD_W, CARD_H, 8);
  ctx.fillStyle = '#241a34';
  ctx.fill();
  ctx.strokeStyle = CARD_EDGE;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  cardShape(ctx, x + 6, y + 6, CARD_W - 12, CARD_H - 12, 5);
  ctx.clip();
  ctx.strokeStyle = 'rgba(160,120,220,0.30)';
  ctx.lineWidth = 2;
  for (let d = -CARD_H; d < CARD_W + CARD_H; d += 10) {
    ctx.beginPath();
    ctx.moveTo(x + d, y);
    ctx.lineTo(x + d - CARD_H, y + CARD_H);
    ctx.stroke();
  }
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.font = FONT(30);
  ctx.fillStyle = '#7a6a9c';
  ctx.fillText('?', x + CARD_W / 2, y + CARD_H / 2 + 11);
}

// Newest first, so index 0 is the card lying on top of the pile.  Drawing and
// hit-testing both go through these three, because a deck you cannot click
// accurately is worse than one you cannot click at all.
function deckOrder(tips) {
  return tips.slice().sort((a, b) => b.order - a.order);
}

/** How far apart the cards sit, given how many of them there are. */
function cardStep(n) {
  const base = VIEW_H - 34 - CARD_H;
  const room = base - CARD_CEIL;
  const dy = n > 1 ? Math.min(CARD_DY, Math.floor(room / (n - 1))) : CARD_DY;
  return { dy: Math.max(6, dy), dx: CARD_DX };
}

function cardPos(i, n) {
  const { dx, dy } = cardStep(n);
  return { x: 16 + i * dx, y: VIEW_H - 34 - CARD_H - i * dy };
}

/**
 * Which card is under this point, front first - or null for empty pavement
 * and for the card already on top, which has nowhere to come forward to.
 */
export function cardAt(px, py, tips) {
  const deck = deckOrder(tips);
  for (let i = 0; i < deck.length; i++) {
    const { x, y } = cardPos(i, deck.length);
    if (px >= x && px <= x + CARD_W && py >= y && py <= y + CARD_H) {
      return i === 0 ? null : deck[i].id;
    }
  }
  return null;
}

function drawClues(ctx, tips) {
  const deck = deckOrder(tips);
  const { x: x0, y: y0 } = cardPos(0, Math.max(1, deck.length));

  // An empty deck says nothing at all now.  It used to stand four lines of
  // instructions next to the card back - nothing yet / find a cat / find a
  // monster / believe half of it - and a count of nought out of five under
  // them, which is the corner of the screen telling you how to play at the
  // moment you are most likely to be looking at it.  The face-down card is
  // the whole message: there is a deck, and there is nothing in it.
  if (!deck.length) {
    drawCardBack(ctx, x0, y0);
  } else {
    // back to front: each card has to land on top of the one behind it
    for (let i = deck.length - 1; i >= 0; i--) {
      const { x, y } = cardPos(i, deck.length);
      drawCard(ctx, x, y, deck[i], i === 0);
    }
  }

  // Nothing is written under the deck any more.  It used to carry a count -
  // YOU HAVE BEEN TOLD 2/5, and NOBODY ELSE WILL TALK once it was full - and
  // the deck already says both: the cards are the count, and a fifth card
  // with nothing behind it is the night being done talking to you.  A number
  // under a picture of the same number is the HUD reading itself out loud.
}

// ---------------------------------------------------------------------------
// What the tips claim - which is not the same thing as what is true, and so
// is not the same thing as which doors are still possible.  The map used to
// intersect your facts and cross off everything they excluded.  It cannot do
// that any more: half of what you have been told is a lie, so an intersection
// of all of it is usually empty and always unearned.
//
// So each tip shades every block it would allow, and the shading stacks.  A
// block three tips agree on comes up hotter than a block only one mentioned,
// and nothing is ever ruled out - a block no tip has named is merely a block
// nobody has mentioned.  Reading the overlap is your job; the map only shows
// you where it is.  The stages are flat opaque colours rather than layers of
// alpha, so a depth of three is one exact colour you can learn to recognise.
//
// The ramp is ABSOLUTE, and that is the whole point of it.  One tip paints
// its area the first colour on the ramp and that area keeps that exact colour
// for the rest of the night, however many tips land afterwards - the later
// ones can only paint their own areas on top of it and climb the ramp where
// they coincide.  Nothing on this map ever goes back down.  A ramp scaled
// against the deepest overlap would dim the shallow areas every time a new
// tip arrived, which reads as the map quietly crossing them off - which is
// exactly the deduction it is not allowed to do for you.
//
// The ramp moved from violet to a wash of ink and iron-gall red when the map
// became a scroll.  Same five absolute steps, same rule, read on paper
// instead of out of a lit panel: an unmentioned block is the pale brown the
// whole city is drawn in, and every tip that names a block pulls it darker
// and redder.  The steps keep their spacing in LIGHTNESS, which is what makes
// a depth of three recognisable at a glance and what survives the map being
// glanced at rather than read.
const TIP_RAMP = ['#c79a68', '#c8834d', '#c26036', '#ad3c25', '#8e1f18'];
const BLOCK_COLD = '#c3ab7e';

// --- THE SCROLL -------------------------------------------------------------
// The map is a sheet of paper, and the sheet is not drawn by hand here - it is
// TRACED OFF THE STOCK ART, in `preview/scroll-prep.py`, and then drawn in
// this game's line.  Three goes at cutting one freehand all came out as a
// beige rectangle with tubes stuck on it; the torn edges especially are
// fiddly and good in the reference and were terrible every time I drew them.
//
// What the prep script hands over (`src/scrollart.js`) is four bands of flat
// region in 0..1 units, and nothing else - no image ships, and not one pixel
// of the original's paint survives.  The trick that gets rid of the airbrush
// is in the script: the reference's gradients run INSIDE its regions rather
// than across them, so splitting it into regions by luminance and filling
// each one flat removes the shading and keeps the drawing.  Quantising the
// colours instead would have laid contour lines across the sheet.
//
// Here we only have to fill those regions in the HUD's own colours and run
// `inkPath` round them - the city's line, on the reference's shape.
//
// `inner` is the biggest rectangle of plain sheet on it, measured by the
// script rather than guessed, and the whole scroll is sized off that: the map
// is given the width it needs and the paper grows to suit.
import { SCROLL_ART } from './scrollart.js';

const PAPER = '#e3d2a6';        // the sheet
const PAPER_CURL = '#cdb887';   // where it turns away, and the flank of a roll
const PAPER_EDGE = '#b08e5c';   // the cut edge of a rolled tube
const ROLL_HOLE = '#63492c';    // straight down the middle of one
const PAPER_MAP = '#dccb9e';    // the panel the city is drawn in
const MAP_INK = '#4a3a24';      // the line on it, and the lettering
const MAP_INK_LO = '#6f5a3a';   // the second line of lettering
// `SCROLL.turn` is how much of the reference's shadow to believe, and the two
// ends of it have both been on screen: 0 is flat paper, where the turn is
// carried by the drawn edge alone and the sheet stops looking as though it
// curves at all; 1 is the shadow at the strength the reference paints it,
// which is a dark wedge reading as a second object rather than as one sheet
// going round.  It is wanted faint.  Live, so it can be bisected while
// looking at it: `PARTY.scrollTurn(0.2)`.
const bandColors = () =>
  [PAPER, lerpHex(PAPER, PAPER_CURL, SCROLL.turn), PAPER_EDGE, ROLL_HOLE];
const SCROLL_SEED = 0x4d21;

// The art never moves and never resizes, so its points are put into screen
// coordinates once instead of ninety times a second.
let scrollAt = null;
function scrollPts(x, y, S, sq) {
  if (scrollAt && scrollAt.x === x && scrollAt.y === y
      && scrollAt.S === S && scrollAt.sq === sq) return scrollAt;
  const P = ([u, v]) => [x + u * S * sq, y + v * S];
  scrollAt = {
    x, y, S, sq,
    bands: SCROLL_ART.bands.map(band => band.map(loop => loop.map(P))),
    edges: SCROLL_ART.edges.map(e => ({ closed: e.closed, band: e.band, pts: e.pts.map(P) })),
  };
  return scrollAt;
}

/**
 * The paper.
 *
 * `S` is the art's long side in screen px and `sq` squeezes it horizontally.
 * THE SQUEEZE IS NOT A FUDGE: the map is square, this design is landscape,
 * and the scroll has to be scaled off its HEIGHT to fit the map on it - which
 * leaves the clean part of the sheet far wider than the map needs and a strip
 * of bare paper either side of the drawing.  So the art is narrowed until its
 * clean part is the width the map actually wants.  It only ever narrows, and
 * the line is laid on afterwards in screen space, so nothing about the stroke
 * is squashed with it.
 *
 * FILLING AND LINING ARE TWO DIFFERENT QUESTIONS, and keeping them apart is
 * the whole reason this looks like the reference rather than like a trace of
 * it.  Every region gets a flat colour; only the stretches of a boundary
 * where the picture actually jumps get a line.  The turn into the roll is a
 * change of colour with no line on it, because that is what a soft edge is.
 * See the long note in preview/scroll-prep.py.
 */
function drawScroll(ctx, x, y, S, sq) {
  const art = scrollPts(x, y, S, sq);
  const BAND = bandColors();
  for (let b = 0; b < art.bands.length; b++) {
    ctx.fillStyle = BAND[b];
    for (const loop of art.bands[b]) {
      ctx.beginPath();
      ctx.moveTo(loop[0][0], loop[0][1]);
      for (let i = 1; i < loop.length; i++) ctx.lineTo(loop[i][0], loop[i][1]);
      ctx.closePath();
      ctx.fill();
    }
  }
  // The silhouette carries the object, so it gets the heavier line - the same
  // rule the city uses, where a block's outline is the heaviest line on it.
  const W = INK.weight, WB = INK.wobble * 0.5;
  let seed = SCROLL_SEED;
  for (const e of art.edges) {
    inkPath(ctx, e.pts, e.band === 0 ? W * 1.15 : W * 0.75,
            seed += 7, WB, MAP_INK, e.closed);
  }
}

export function tipVotes(tips, city) {
  const votes = new Map();
  let max = 0;
  for (const t of tips) {
    for (const id of claimedIds(city, t.key, t.value)) {
      const n = (votes.get(id) || 0) + 1;
      votes.set(id, n);
      if (n > max) max = n;
    }
  }
  return { votes, max };
}

/** How deep the claims are stacked here - and nothing else. */
function tipShade(n) {
  if (!n) return BLOCK_COLD;
  return TIP_RAMP[Math.min(n, TIP_RAMP.length) - 1];
}

// The map is the city shrunk, not a grid of squares: every block is drawn at
// the size and in the place it actually has, which is the only way to read a
// city that was cut rather than ruled.  It also prints the address of the
// block you are standing on, because there is no other way to tell 11th
// Avenue from 12th once the avenues are not evenly spaced.
function drawMinimap(ctx, game) {
  const { city, player, tips } = game;
  // The sheet is laid out around the drawing, not the other way round: 160 of
  // map, a left margin, then the strip on the right that the tall roll takes
  // and the writing must not run into, and under it two lines of type with
  // enough left over that the torn bottom edge does not bite into them.
  // THE LAYOUT, WORKED BACKWARDS FROM THE PAPER.
  // `SCROLL_ART.inner` is the biggest rectangle of plain sheet on the traced
  // art - no roll on it, no turn, inside the torn edges - so the map is given
  // the size it wants and the scroll is scaled until its clean part holds it.
  // Nothing here is a number picked to look right against a drawing; move to
  // a different scroll and the map still lands on the paper.
  const MAP = 150, AIR = 13;                       // paper left round the map
  const [IX, IY, IW, IH] = SCROLL_ART.inner;
  const S = (MAP + AIR * 2) / IH;                  // the art's long side, in px
  // ...and then taken in horizontally until the clean part is only as wide as
  // the map needs.  Scaled off its height alone this design leaves 30-odd px
  // of bare paper either side of the city, which reads as a sheet that has
  // been stretched rather than one that fits.
  const sq = Math.min(1, (MAP + AIR * 2) / (IW * S));
  const sx = VIEW_W - 16 - SCROLL_ART.w * S * sq;
  // The two lines of writing go UNDER the paper, not on it.  This design is
  // landscape and its clean rectangle is wider than it is tall, so a square
  // map and two lines of type will not both fit on it however it is scaled -
  // and the map is the thing that must not shrink.  They get the dark outline
  // the vitals already use, which is what the HUD does when it has no panel.
  const sh = SCROLL_ART.h * S;
  const sy = VIEW_H - 26 - 36 - sh;
  drawScroll(ctx, sx, sy, S, sq);

  // The map, centred in the clean part of the sheet and then nudged right.
  //
  // `SCROLL.mapShift` is the nudge, in px, positive to the right.  The clean
  // rectangle stops where the paper starts rolling, so centring the map in it
  // is centring it on the FLAT part of the sheet - and the roll is paper too,
  // and the eye counts it.  Measured on the finished frame: the whole paper
  // runs 1036..1258 and the map's own middle landed at 1133, twelve or so px
  // left of the object's, which is exactly what it looked like.  One number,
  // and `PARTY.scroll({mapShift: 20})` moves it while you watch.
  const x = sx + (IX + IW / 2) * S * sq - MAP / 2 + SCROLL.mapShift;
  const y = sy + (IY + IH / 2) * S - MAP / 2;
  const SC = MAP / WORLD;
  const MX = (wx) => x + wx * SC;
  const MY = (wy) => y + wy * SC;

  const { votes, max } = tipVotes(tips, city);

  // The city is inked ONTO the paper and the streets are simply not drawn:
  // what runs between the blocks is the sheet showing through, which is how a
  // drawn map works and is why there is no road on this one.
  ctx.fillStyle = PAPER_MAP;
  ctx.fillRect(x, y, MAP, MAP);
  for (const b of city.blocks) {
    const bx = MX(b.x0), by = MY(b.y0);
    const bw = Math.max(1, (b.x1 - b.x0) * SC - 1), bh = Math.max(1, (b.y1 - b.y0) * SC - 1);
    ctx.fillStyle = tipShade(votes.get(b.id) || 0);
    ctx.fillRect(bx, by, bw, bh);
    // A block whose doors have all been knocked is struck through in the same
    // ink the map is drawn in - not in red.  Red on this sheet means one
    // thing, and the one thing is you.  The strike is drawn OVER whatever
    // shade the block has rather than washing it out, so crossing a block off
    // never costs you the depth you read it at.
    if (b.doors.every(d => d.tried)) {
      ctx.strokeStyle = MAP_INK; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(bx + 1, by + 1); ctx.lineTo(bx + bw - 1, by + bh - 1);
      ctx.moveTo(bx + bw - 1, by + 1); ctx.lineTo(bx + 1, by + bh - 1);
      ctx.stroke();
    }
  }
  // the border of the drawing, cut by hand like everything else
  inkPoly(ctx, [[x, y], [x + MAP, y], [x + MAP, y + MAP], [x, y + MAP]],
          INK.weight * 0.6, SCROLL_SEED + 300, INK.wobble * 0.5,
          INK.over * 0.4, MAP_INK, true);

  // You, and the only red on the paper.  It was a gold pip when the map was a
  // dark panel; gold on parchment is a stain.
  const px = MX(player.x), py = MY(player.y);
  ctx.fillStyle = BLOOD_RED;
  ctx.beginPath();
  ctx.arc(px, py, 3.2, 0, 6.2832);
  ctx.fill();
  ctx.strokeStyle = MAP_INK;
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // The map shows you where you are and what you have been told.  It does NOT
  // show you where the monsters are: the vision used to put a pinprick on each
  // one within earshot, which turned finding them into reading a radar instead
  // of walking the street and looking.  The only mark on this map that moves
  // is the yellow one, and that one is you.

  ctx.textAlign = 'center';
  ctx.font = FONT(11);
  // Not "doors left".  Nothing has been taken off the table: this is how many
  // people have said something and how far the shading gets you if they were
  // telling the truth, which they were not, half of them.
  const cap = !tips.length ? 'NOTHING BUT RUMOURS'
    : tips.length === 1 ? '1 TIP, 1 DEEP'
    : `${tips.length} TIPS, ${max} DEEP`;
  // under the paper rather than at the foot of the screen: two lines adrift in
  // the corner read as somebody else's HUD, two lines under the scroll read as
  // the scroll's caption
  const mid = x + MAP / 2;
  outlined(ctx, cap, mid, sy + sh + 18, PAPER, 11);
  outlined(ctx, addressOf(blockAt(player.x, player.y)).toUpperCase(),
           mid, sy + sh + 34, PAPER_CURL, 11);
}

// ---------------------------------------------------------------------------
// Full-screen states
// ---------------------------------------------------------------------------
// The night, stopped.  Same face as the end cards, and the same red - it is
// the only red the game owns, and a word this size in it over the dark street
// looks like the game rather than like a menu.  The two lines under it are
// not red: they are instructions, you have to be able to read them, and red
// on that background tested badly.  BLOOD_RED is the one to change if the
// whole thing should go white.
export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(6,4,14,0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = BLOOD_RED;
  deathText(ctx, 'PAUSED', VIEW_W / 2, VIEW_H / 2 - 6, 130);
  ctx.fillStyle = '#e4dcee';
  deathText(ctx, 'ESC TO GO BACK OUT THERE   -   M MUTES   -   [ ] ZOOM',
            VIEW_W / 2, VIEW_H / 2 + 54, 26);
  deathText(ctx, 'HOLD ESC AND PRESS R FOR A DIFFERENT NIGHT',
            VIEW_W / 2, VIEW_H / 2 + 88, 26);
}

// ---------------------------------------------------------------------------
// The title card
// ---------------------------------------------------------------------------
// The same card the night ends on: flat blood red, edge to edge, and
// everything on it cut out of that red in black, in the one face the game
// owns.  It used to be the last screen still set in the HUD's mono over a
// purple glow, which made the first thing anybody saw the one thing in the
// game that did not look like the game.
//
// **Nothing on it is a fixed size.**  The word is fitted to the width it is
// allowed, and the block of instructions is fitted to whatever room is left
// between the tagline and the ENTER line - measured, not guessed - so editing
// the lines below cannot push anything off the bottom of the screen or out
// past the right-hand edge.  Add a line and the whole block gets slightly
// smaller; take the longest one out and it gets slightly bigger.  The numbers
// underneath are where the card is laid out, and they are the only things to
// touch when it wants moving.
//
// One thing the face decides for us: **its hyphen sits on the baseline**, so
// `A - B` sets as `A _ B` and reads as an underscore.  Every dash on this card
// is a middle dot instead, and the two hyphenated words went to `trick or
// treaters`, which is the one place the typeface got a say in the writing.
// (The pause card still has its dashes, and they have the same problem.)
const TITLE_W = 620;                    // how wide the word may get
const TITLE_TOP = 40;                   // air above the tips of the letters
const TAG_SIZE = 25, TAG_GAP = 46;      // the line under it, and its drop
const COL_W = 556;                      // each block's width
const COL_L = 56, COL_R = VIEW_W - 56 - COL_W;
const BODY_GAP = 58;                    // between the tagline and the blocks
const BODY_FOOT = 58;                   // and the air kept over the ENTER line
const BODY_MAX = 28;                    // never bigger than this, however few
const BODY_PITCH = 1.2;                 // line spacing, as a fraction of size
const BODY_SPLIT = 0.6;                 // the gap between one entry and the next
const BODY_INDENT = 0.9;                // how far the lines sit under their key
const ENTER_SIZE = 30, ENTER_BASE = VIEW_H - 38;

// Two blocks: what you do on the left, what is going on out there on the
// right.  A key stands at the block's own edge and its lines are indented
// under it - the mono card put the key in a column of its own down the middle
// of the screen, which there is no room for once there are two of them.
const TITLE_LEFT = [
  ['MOVE', ['WASD / ARROWS  \u00b7  sidewalks and crosswalks only']],
  ['BAT FORM', ['SPACE  \u00b7  fly over the trick or treaters. costs NIGHT,',
                'and when the NIGHT runs dry it costs BLOOD instead']],
  ['KNOCK / TALK', ['E  \u00b7  wrong door means candy, and candy means children']],
  ['DUMP CANDY', ['Q  \u00b7  drop the bag, lose the tail']],
];
const TITLE_RIGHT = [
  ['BLACK CATS', [`WALK INTO ONE  \u00b7  ${VISION_SECONDS} SECONDS of VAMPIRE VISION.`,
                  'the living go grey, the lamps turn out to be torches,',
                  'and the monsters stop looking like somebody\'s kid.',
                  'the cats go with it.']],
  ['THE POINT', ['only monsters know where the party is, and out here',
                 'they are dressed as trick or treaters like everybody else.']],
  ['THE CATCH', ['five tips a night, and half of them are lies. a liar',
                 'sounds like everybody else. a tip is a claim, not a fact:',
                 'the map shades where claims agree, and crosses off nothing.']],
];

/** The biggest `start` will go without `text` running past `maxW`. */
function fitTo(ctx, text, maxW, start) {
  setDeathFont(ctx, start);
  const w = ctx.measureText(text).width;
  return w > maxW ? start * (maxW / w) : start;
}

// ---------------------------------------------------------------------------
// The front door
// ---------------------------------------------------------------------------
// Black, with the name across it and the three ways in under that, and it is
// the only screen in the game that is not one of the two fields - the city's
// palette or the blood.  It does not have to be: nothing of the game is on it
// yet.  What it keeps is the game's one colour, so the red that the night
// ends on is the red you start on.
//
// The chosen line is the blood; the others are the same red taken most of the
// way to black.  No marker, no cursor, no third colour - which one you are on
// is which one you can read.
const MENU_TOP = 0.50;                  // the first item, down the screen
const MENU_SIZE = 52, MENU_PITCH = 1.5;
const MENU_DIM = 0.55;                  // how far the unchosen go towards black

/**
 * The punch, as a multiplier: `1 + amount * (1 - easeOutBack(p))`.  It swells
 * on the frame it is asked for, overshoots back past its own size, and settles
 * at exactly 1 - so the line ends up where the highlight left it and the punch
 * is a move rather than a second way of being selected.
 *
 * `pop` is seconds since the choice, or null when nothing has been chosen.
 */
const easeOutBack = (p) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
};
function popScale(pop) {
  if (pop == null || MENU_POP.ms <= 0 || MENU_POP.amount <= 0) return 1;
  const p = Math.min(1, pop / MENU_POP.ms);
  return 1 + MENU_POP.amount * (1 - easeOutBack(p));
}

export function drawMenu(ctx, idx, t, pop) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (!deathFontsSettled()) return;     // the same rule every card here follows

  ctx.fillStyle = BLOOD_RED;
  const big = fitTo(ctx, 'THE PARTY', TITLE_W, 170);
  setDeathFont(ctx, big);
  const asc = ctx.measureText('THE PARTY').actualBoundingBoxAscent || big * 0.95;
  deathText(ctx, 'THE PARTY', MID, VIEW_H * 0.24 + asc / 2, big);

  MENU.forEach(([label], i) => {
    ctx.fillStyle = i === idx ? BLOOD_RED : lerpHex(BLOOD_RED, '#000000', MENU_DIM);
    const y = VIEW_H * MENU_TOP + i * MENU_SIZE * MENU_PITCH;
    const k = i === idx ? popScale(pop) : 1;
    if (k === 1) { deathText(ctx, label, MID, y, MENU_SIZE); return; }
    // about the line's own middle, not its baseline, or it grows downwards
    const cy = y - MENU_SIZE * 0.34;
    ctx.save();
    ctx.translate(MID, cy);
    ctx.scale(k, k);
    ctx.translate(-MID, -cy);
    deathText(ctx, label, MID, y, MENU_SIZE);
    ctx.restore();
  });

  ctx.fillStyle = lerpHex(BLOOD_RED, '#000000', MENU_DIM);
  deathText(ctx, 'ARROWS \u00b7 ENTER', MID, ENTER_BASE, ENTER_SIZE * 0.8);
}

/**
 * Who made it.  The blood card, like the two the night ends on and like the
 * one HOW TO PLAY opens - black words cut out of the red.  The front door is
 * the only black screen in the game and this is not it.
 *
 * Three lines at three sizes, fitted as one block: the widest line decides the
 * size and the others take their share of it, so the studio stays the biggest
 * thing on the card however long a name gets.  Each line carries the gap that
 * follows it as well, because the first two are one sentence - SABOROSA is
 * these people - and a sentence that breaks over two lines should sit closer
 * together than the next thing does.
 */
const CREDITS_BASE = 58;                // the middle line, before fitting
const CREDITS_PITCH = 1.7;              // line to line, off each line's own size

export function drawCredits(ctx, t) {
  ctx.fillStyle = BLOOD_RED;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (!deathFontsSettled()) return;
  ctx.fillStyle = '#000000';

  let unit = CREDITS_BASE;
  for (const [line, rel] of CREDITS) {
    unit = Math.min(unit, fitTo(ctx, line, VIEW_W - 160, CREDITS_BASE * rel) / rel);
  }
  // The gaps BETWEEN the lines are what the block is, not the gaps after them -
  // centring on the sum of all of them hangs an empty line's worth of air off
  // the bottom and pushes the words up the card.
  const gaps = CREDITS.slice(0, -1).map(([, rel, gap], i) =>
    unit * rel * CREDITS_PITCH * (gap == null ? 1 : gap));
  const span = gaps.reduce((a, b) => a + b, 0);
  // and a baseline is not the middle of a letter: half a cap puts the ink on
  // the centre line rather than the line the ink sits on
  let y = VIEW_H / 2 - span / 2 + unit * CREDITS[0][1] * 0.34;
  CREDITS.forEach(([line, rel], i) => {
    deathText(ctx, line, MID, y, unit * rel);
    y += gaps[i] || 0;
  });

  if (Math.floor(t * 2) % 2) {
    deathText(ctx, 'ENTER \u00b7 BACK', MID, ENTER_BASE, ENTER_SIZE);
  }
}

export function drawTitle(ctx, t) {
  ctx.fillStyle = BLOOD_RED;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#000000';

  // The red goes up straight away and the words wait for the face.  Every
  // frame of this card is redrawn, so setting it before the font lands does
  // not leave Times on the screen - it leaves Times on the screen for a
  // moment and then snaps into the real face, which is the sort of thing you
  // cannot un-see once you have seen it.  A flat red field for the same
  // moment reads as the card arriving.  See deathFontsSettled(): this waits
  // on the answer, not on success, so a font that never comes still gets its
  // card, in whatever the fallback is.
  if (!deathFontsSettled()) return;

  // The word is hung off the top of its own ink rather than off a baseline
  // somebody guessed: this face throws spikes well above its cap height, and
  // a baseline that looks right at one size shaves the tips off at the next.
  const big = fitTo(ctx, 'THE PARTY', TITLE_W, 170);
  setDeathFont(ctx, big);
  const asc = ctx.measureText('THE PARTY').actualBoundingBoxAscent || big * 0.95;
  const titleBase = TITLE_TOP + asc;
  deathText(ctx, 'THE PARTY', MID, titleBase, big);

  const tag = 'the monsters only get one night, and you lost the invitation';
  const tagBase = titleBase + TAG_GAP;
  deathText(ctx, tag, MID, tagBase, fitTo(ctx, tag, VIEW_W - 120, TAG_SIZE));

  // everything below the tagline is measured off it, so the card cannot close
  // up on itself when the word above changes size
  const top = tagBase + BODY_GAP, bottom = ENTER_BASE - BODY_FOOT;

  // One size for both blocks, and it is whichever is smaller: the size at
  // which the longest line still fits its block, or the size at which the
  // taller block still fits the height.  Both blocks take it, so the two read
  // as one card rather than as two.
  let size = BODY_MAX;
  for (const [key, lines] of [...TITLE_LEFT, ...TITLE_RIGHT]) {
    size = Math.min(size, fitTo(ctx, key, COL_W, BODY_MAX));
    for (const l of lines) {
      size = Math.min(size, fitTo(ctx, l, COL_W - BODY_MAX * BODY_INDENT, BODY_MAX));
    }
  }
  const steps = (block) => block.reduce((n, [, l]) => n + 1 + l.length + BODY_SPLIT, 0)
    - BODY_SPLIT - 1;
  size = Math.min(size, (bottom - top) / (Math.max(steps(TITLE_LEFT), steps(TITLE_RIGHT)) * BODY_PITCH));

  const block = (entries, x) => {
    let y = top;
    for (const [key, lines] of entries) {
      deathText(ctx, key, x, y, size, 'left');
      y += size * BODY_PITCH;
      for (const l of lines) {
        deathText(ctx, l, x + size * BODY_INDENT, y, size, 'left');
        y += size * BODY_PITCH;
      }
      y += size * BODY_PITCH * BODY_SPLIT;
    }
  };
  block(TITLE_LEFT, COL_L);
  block(TITLE_RIGHT, COL_R);

  // It blinks by being there and then not being there, which is how the end
  // card's line blinks.  Two colours taking turns was the mono card's trick
  // and there is only one colour on this one.
  if (Math.floor(t * 2) % 2) {
    deathText(ctx, 'ENTER \u00b7 MIDNIGHT IS WASTING       ESC \u00b7 BACK',
              MID, ENTER_BASE, ENTER_SIZE);
  }
}

// Every night ends on the same card now - the two ways of losing and the one
// way of winning.  Flat blood red, one phrase in black on it as big as the
// screen will take, and the line telling you which key starts another night.
// You do not get told how it went; you get told that it is over.
export function drawEnd(ctx, game, t) {
  drawEndCard(ctx, game, t);
}

function endStats(game) {
  return [
    ['time', clockText(game.clock.minutes)],
    ['doors', `${game.stats.knocks} knocked`],
    ['candy', `${game.player.candy} pieces carried`],
    ['tips', `${game.tips.length} taken, ${game.tips.filter(t => t.lie).length} of them lies`],
    ['party', `${DISTRICTS[game.city.party.districtIdx].name}, ${addressOf(game.city.party.block)}`],
    ['door', `the one with ${game.city.party.deco.name}`],
  ];
}

// ---------------------------------------------------------------------------
// Dried
// ---------------------------------------------------------------------------
// The one screen in the game that is not the game's palette at all: flat
// blood red, edge to edge, with one word cut out of it in black.  It is the
// same red the cat's gift pours down the screen, because it is the same
// blood - it is just all outside you now.  Nothing else is on it.  You do
// not get told how it went; you get told that it is over.
const MID = VIEW_W / 2;
const DEATH_SIZE = 260;          // as big as the word will go ...
const DEATH_MAX_W = 940;         // ... until it runs out of screen

const LINE_PITCH = 0.84;         // line spacing, as a fraction of the size
const STACK_ROOM = VIEW_H - 150; // ... and the air the ENTER line needs

function drawEndCard(ctx, game, t) {
  // Losing is the flat card.  Winning is the room behind the door, in the same
  // two colours the card was always made of - see src/bats.js.
  const bats = WIN_BATS && game.state === 'win' && drawBats(ctx, t);
  if (!bats) {
    ctx.fillStyle = BLOOD_RED;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  ctx.fillStyle = '#000000';

  // The card cuts its words out of the red in black.  Over the bats there is
  // no one colour to cut out of - black type would vanish into a black bat -
  // and END.type says what to do about it.  Either way the phrase waits
  // END.textAt seconds, so you get the room before you get told.
  //
  //   'invert'   drawn in the red under `difference`, so red comes out black
  //              and black comes out red: the phrase is cut out of whatever
  //              it happens to land on.  Strongest where the frame behind it
  //              is flat, weakest on a frame that is all middle tones.
  //   'outline'  black letters haloed in the blood, which is what every other
  //              thin face in the game gets over the street.  Reads the same
  //              on every frame, and is the same rule as the ENTER line.
  //
  // Both stay inside the card's two colours.  Neither is furniture: pick one.
  const invert = bats && END.type === 'invert';
  if (bats) {
    if (t < END.textAt) return drawEndFooter(ctx, t, true);
    if (invert) { ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = BLOOD_RED; }
  }

  // The phrase is set as large as it will go: DEAD and ASH are one word and
  // fill the width, YOU FOUND THE PARTY stacks a word to a line and fills
  // the height.  Both are measured at DEATH_SIZE and scaled down to whatever
  // actually fits, so nothing is ever cut off the edge.
  //
  // It is measured in the real face or not at all: Deathly arrives over the
  // FontFace API, and a phrase measured in the Times fallback is set at the
  // wrong size AND in the wrong face for the moment before it lands.  The
  // card is already holding the room back for END.textAt seconds, so holding
  // the words as well costs nothing.
  if (!deathFontsSettled()) { ctx.globalCompositeOperation = 'source-over'; return drawEndFooter(ctx, t, bats); }
  const words = game.endTitle.toUpperCase().split(/\s+/).filter(Boolean);
  setDeathFont(ctx, DEATH_SIZE);
  let size = DEATH_SIZE;
  for (const w of words) {
    const wide = ctx.measureText(w).width;
    if (wide > DEATH_MAX_W) size = Math.min(size, DEATH_SIZE * (DEATH_MAX_W / wide));
  }
  if (words.length > 1) {
    size = Math.min(size, STACK_ROOM / ((words.length - 1) * LINE_PITCH + 0.78));
  }
  // the winning card shares the screen with the room behind it, so it does not
  // take all of it - the two losing cards still do
  if (bats) size *= END.size;
  setDeathFont(ctx, size);
  const cap = ctx.measureText('H').actualBoundingBoxAscent || size * 0.72;
  const lh = size * LINE_PITCH;
  const top = VIEW_H / 2 - ((words.length - 1) * lh) / 2 + cap / 2;
  words.forEach((w, i) => {
    if (bats && !invert) {
      ctx.lineWidth = Math.max(4, size * 0.05);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = BLOOD_RED;
      ctx.textAlign = 'center';
      ctx.strokeText(w, MID, top + i * lh);
      ctx.fillStyle = '#0b0b0b';
    }
    deathText(ctx, w, MID, top + i * lh, size);
  });

  // Off by default: the night is over, and how it went is not the point.
  if (END_STATS) {
    endStats(game).forEach(([k, v], i) => {
      deathText(ctx, `${k}  ${v}`, MID, VIEW_H - 200 + i * 26, 22);
    });
  }

  ctx.globalCompositeOperation = 'source-over';
  drawEndFooter(ctx, t, bats);
}

// The line that starts another night blinks on both cards.  Inverting it the
// way the phrase is inverted does not work at this size - a thin face over a
// busy field comes out at whatever contrast the pixel under it happens to
// give.  So it gets what every other thin face in the game gets over the
// street: an outline.  Black letters haloed in the blood read on the red and
// on the bats both, and it is still only the two colours.
const FOOTER = 'PRESS ENTER FOR ANOTHER NIGHT';
function drawEndFooter(ctx, t, onBats) {
  if (!(Math.floor(t * 2) % 2)) return;
  ctx.globalCompositeOperation = 'source-over';
  if (onBats) {
    setDeathFont(ctx, 30);
    ctx.textAlign = 'center';
    ctx.lineWidth = 6; ctx.lineJoin = 'round';
    ctx.strokeStyle = BLOOD_RED;
    ctx.strokeText(FOOTER, MID, VIEW_H - 46);
  }
  ctx.fillStyle = '#0b0b0b';
  deathText(ctx, FOOTER, MID, VIEW_H - 46, 30);
}

