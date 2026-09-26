import {
  VIEW_W, VIEW_H, BLOOD_MAX, MANA_MAX, NIGHT_MINUTES, WORLD,
  VISION_SECONDS, VISION_WARN, GLASS_CLOCK_TEXT, MAX_TIPS, END_STATS,
} from './config.js';
import { drawHourglass, GLASS_W, GLASS_H } from './hourglass.js';
import { DISTRICTS, blockAt } from './city.js';
import { shortFact, cardFact, addressOf, claimedIds, FACT_KEYS } from './hints.js';
// the red the cat's gift pours down the screen, which is the red you dry into
import { BLOOD_RED } from './render.js';
import { deathText, setDeathFont } from './deathtype.js';

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

function panel(ctx, x, y, w, h, alpha = 0.86) {
  ctx.fillStyle = `rgba(10,8,18,${alpha})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(160,120,220,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function bar(ctx, x, y, w, h, frac, fill, back, label) {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  if (label) {
    ctx.fillStyle = '#efe8f8';
    ctx.font = FONT(13);
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 6, y + h - 5);
  }
}

// ---------------------------------------------------------------------------
export function drawHud(ctx, game) {
  const { player, clock, tips, city, prompt, dialogue, world } = game;
  ctx.textBaseline = 'alphabetic';

  // --- vitals -------------------------------------------------------------
  panel(ctx, 16, 16, 268, 92);
  bar(ctx, 26, 26, 248, 22, player.blood / BLOOD_MAX, '#b01f36', '#2a1218',
      `BLOOD ${Math.ceil(player.blood)}`);
  bar(ctx, 26, 54, 248, 18, player.mana / MANA_MAX, '#7a45d0', '#1d1630',
      `NIGHT ${Math.ceil(player.mana)}`);
  ctx.fillStyle = player.candy > 0 ? '#e8b23a' : '#7a7488';
  ctx.font = FONT(15);
  ctx.textAlign = 'left';
  let candyLine = `CANDY ${player.candy}`;
  if (player.followers > 0) candyLine += `   KIDS IN TOW ${player.followers}`;
  ctx.fillText(candyLine, 26, 94);

  // --- the hourglass ------------------------------------------------------
  // No digits.  The moon in the top bulb is ground down into the sun in the
  // bottom one, and when the sun is whole it is 6:00 AM.
  const left = NIGHT_MINUTES - clock.minutes;
  const panic = left < 60;
  drawClock(ctx, clock, panic);

  drawVision(ctx, game);
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
  panel(ctx, x, y, CLOCK_W, CLOCK_H, panic ? 0.92 : 0.86);
  drawHourglass(ctx, x + CLOCK_PAD, y + CLOCK_PAD,
                clock.minutes / NIGHT_MINUTES, clock.t, panic);

  if (GLASS_CLOCK_TEXT) {
    const hot = panic && Math.floor(clock.t * 4) % 2;
    ctx.textAlign = 'center';
    ctx.font = FONT(20);
    ctx.fillStyle = panic ? (hot ? '#ff5a4a' : '#ffb24a') : '#f0e6ff';
    ctx.fillText(clockText(clock.minutes), x + CLOCK_W / 2,
                 y + CLOCK_PAD + GLASS_H + 20);
  }
}

function drawVision(ctx, game) {
  if (game.vision <= 0 && game.visionMix <= 0.01) return;
  const low = game.vision > 0 && game.vision < VISION_WARN;
  const blink = low && Math.floor(game.clock.t * 6) % 2 === 0;
  panel(ctx, 16, 118, 268, 50, 0.86);
  ctx.textAlign = 'left';
  ctx.font = FONT(14);
  ctx.fillStyle = blink ? '#ffd0c4' : '#ff6a52';
  ctx.fillText('VAMPIRE VISION', 26, 140);
  ctx.textAlign = 'right';
  ctx.fillStyle = blink ? '#ffd0c4' : '#e8dcff';
  ctx.fillText(`${Math.ceil(game.vision)}s`, 274, 140);
  bar(ctx, 26, 146, 248, 12, game.vision / VISION_SECONDS,
      blink ? '#ffb4a0' : '#c8382c', '#2a1414');
  ctx.textAlign = 'left';
}

// ---------------------------------------------------------------------------
function drawDialogue(ctx, d) {
  const boxW = 780, boxH = 122;
  const x = VIEW_W / 2 - boxW / 2, y = VIEW_H - boxH - 28;
  panel(ctx, x, y, boxW, boxH, 0.9);
  ctx.textAlign = 'left';
  ctx.font = FONT(15);
  ctx.fillStyle = d.nameColor || '#c9a8ff';
  ctx.fillText(d.name, x + 22, y + 28);
  ctx.font = FONT(18, false);
  ctx.fillStyle = '#efe6fa';
  wrap(ctx, d.text, x + 22, y + 56, boxW - 44, 24);
  ctx.font = FONT(12);
  ctx.fillStyle = '#8a7ea8';
  ctx.textAlign = 'right';
  ctx.fillText('E / SPACE to continue', x + boxW - 20, y + boxH - 12);
}

function wrap(ctx, text, x, y, maxW, lh) {
  const words = String(text).split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y); y += lh; line = w;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
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

  if (!deck.length) {
    drawCardBack(ctx, x0, y0);
    ctx.textAlign = 'left';
    ctx.font = FONT(13);
    ctx.fillStyle = '#7a7288';
    ctx.fillText('nothing yet.', x0 + CARD_W + 14, y0 + 54);
    ctx.fillText('find a cat,', x0 + CARD_W + 14, y0 + 74);
    ctx.fillText('find a monster.', x0 + CARD_W + 14, y0 + 94);
    ctx.fillText('believe half of it.', x0 + CARD_W + 14, y0 + 114);
  } else {
    // back to front: each card has to land on top of the one behind it
    for (let i = deck.length - 1; i >= 0; i--) {
      const { x, y } = cardPos(i, deck.length);
      drawCard(ctx, x, y, deck[i], i === 0);
    }
  }

  // Not a score out of four: a count of things you have been told, which says
  // nothing about how much of it is true.  The denominator is there because
  // the night only hands over MAX_TIPS of them and you should be able to see
  // how many asks you have left - that is inventory, not deduction.
  const full = deck.length >= MAX_TIPS;
  ctx.textAlign = 'left';
  ctx.font = FONT(12);
  ctx.fillStyle = full ? '#e8b23a' : '#c9a8ff';
  ctx.fillText(`YOU HAVE BEEN TOLD  ${deck.length}/${MAX_TIPS}` +
    (full ? '   NOBODY ELSE WILL TALK' : ''), x0, VIEW_H - 14);
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
const TIP_RAMP = ['#33234f', '#4a2a72', '#66309c', '#8639c8', '#a844e8'];
const BLOCK_COLD = '#17161f';

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
  const MAP = 160, pad = 8;
  const size = MAP + pad * 2;
  // two lines under the map now, so it sits high enough for both of them
  const x = VIEW_W - size - 16, y = VIEW_H - size - 54;
  panel(ctx, x, y, size, size + 38);
  const S = MAP / WORLD;
  const MX = (wx) => x + pad + wx * S;
  const MY = (wy) => y + pad + wy * S;

  const { votes, max } = tipVotes(tips, city);

  ctx.fillStyle = '#0d0c14';                       // the roads, underneath
  ctx.fillRect(x + pad, y + pad, MAP, MAP);
  for (const b of city.blocks) {
    const bx = MX(b.x0), by = MY(b.y0);
    const bw = Math.max(1, (b.x1 - b.x0) * S - 1), bh = Math.max(1, (b.y1 - b.y0) * S - 1);
    ctx.fillStyle = tipShade(votes.get(b.id) || 0);
    ctx.fillRect(bx, by, bw, bh);
    if (b.doors.every(d => d.tried)) {
      ctx.fillStyle = 'rgba(200,70,70,0.34)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#d0424a'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + 1, by + 1); ctx.lineTo(bx + bw - 1, by + bh - 1);
      ctx.moveTo(bx + bw - 1, by + 1); ctx.lineTo(bx + 1, by + bh - 1);
      ctx.stroke();
    }
  }
  // player
  ctx.fillStyle = '#ffd24a';
  ctx.fillRect(MX(player.x) - 2, MY(player.y) - 2, 5, 5);

  // while the vision holds, the monsters within earshot show up as pinpricks
  if (game.visionMix > 0.1) {
    ctx.globalAlpha = game.visionMix;
    for (const n of game.world.npcs) {
      if (Math.hypot(n.x - player.x, n.y - player.y) > 1500) continue;
      ctx.fillStyle = n.kind === 'witch' ? '#7aff9a' : '#ff5a4a';
      ctx.fillRect(MX(n.x) - 1, MY(n.y) - 1, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = 'center';
  ctx.font = FONT(11);
  ctx.fillStyle = '#9a8ab8';
  // Not "doors left".  Nothing has been taken off the table: this is how many
  // people have said something and how far the shading gets you if they were
  // telling the truth, which they were not, half of them.
  const cap = !tips.length ? 'NOTHING BUT RUMOURS'
    : tips.length === 1 ? '1 TIP, 1 DEEP'
    : `${tips.length} TIPS, ${max} DEEP`;
  ctx.fillText(cap, x + size / 2, y + size + 14);
  ctx.fillStyle = '#7a6f92';
  ctx.fillText(addressOf(blockAt(player.x, player.y)).toUpperCase(), x + size / 2, y + size + 30);
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

export function drawTitle(ctx, t) {
  ctx.fillStyle = '#0a0812';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.34, 20, VIEW_W / 2, VIEW_H * 0.34, 480);
  g.addColorStop(0, 'rgba(120,60,200,0.35)');
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.textAlign = 'center';
  ctx.font = FONT(74);
  ctx.fillStyle = '#f0e2ff';
  ctx.fillText('THE PARTY', VIEW_W / 2, 190);
  ctx.font = FONT(17, false);
  ctx.fillStyle = '#c9a8ff';
  ctx.fillText('the monsters only get one night, and you lost the invitation', VIEW_W / 2, 224);

  const lines = [
    ['MOVE', 'WASD / ARROWS  -  sidewalks and crosswalks only'],
    ['BAT FORM', 'SPACE  -  fly over the trick-or-treaters. costs NIGHT,'],
    ['', 'and when the NIGHT runs dry it costs BLOOD instead'],
    ['KNOCK / TALK', 'E  -  wrong door means candy, and candy means children'],
    ['DUMP CANDY', 'Q  -  drop the bag, lose the tail'],
    ['', ''],
    ['BLACK CATS', `WALK INTO ONE  -  ${VISION_SECONDS} SECONDS of VAMPIRE VISION.`],
    ['', 'the living go grey, the lamps turn out to be torches, and'],
    ['', 'the monsters stop looking like somebody\'s kid. the cats go.'],
    ['', ''],
    ['THE POINT', 'only monsters know where the party is, and out here they'],
    ['', 'are dressed as trick-or-treaters like everybody else.'],
    ['', ''],
    ['THE CATCH', 'five tips a night, and half of them are lies. a liar'],
    ['', 'sounds like everybody else. a tip is a claim, not a fact:'],
    ['', 'the map shades where claims agree, and crosses off nothing.'],
  ];
  ctx.font = FONT(16);
  let y = 278;
  for (const [k, v] of lines) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#b08aff';
    ctx.fillText(k, VIEW_W / 2 - 150, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ddd2ee';
    ctx.font = FONT(16, false);
    ctx.fillText(v, VIEW_W / 2 - 132, y);
    ctx.font = FONT(16);
    y += 24;
  }
  ctx.textAlign = 'center';
  ctx.font = FONT(22);
  ctx.fillStyle = Math.floor(t * 2) % 2 ? '#ffd24a' : '#a07ad8';
  ctx.fillText('PRESS ENTER - MIDNIGHT IS WASTING', VIEW_W / 2, VIEW_H - 64);
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
  ctx.fillStyle = BLOOD_RED;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#000000';

  // The phrase is set as large as it will go: DEAD and ASH are one word and
  // fill the width, YOU FOUND IT stacks a word to a line and fills the
  // height.  Both are measured at DEATH_SIZE and scaled down to whatever
  // actually fits, so nothing is ever cut off the edge.
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
  setDeathFont(ctx, size);
  const cap = ctx.measureText('H').actualBoundingBoxAscent || size * 0.72;
  const lh = size * LINE_PITCH;
  const top = VIEW_H / 2 - ((words.length - 1) * lh) / 2 + cap / 2;
  words.forEach((w, i) => deathText(ctx, w, MID, top + i * lh, size));

  // Off by default: the night is over, and how it went is not the point.
  if (END_STATS) {
    endStats(game).forEach(([k, v], i) => {
      deathText(ctx, `${k}  ${v}`, MID, VIEW_H - 200 + i * 26, 22);
    });
  }

  if (Math.floor(t * 2) % 2) {
    deathText(ctx, 'PRESS ENTER FOR ANOTHER NIGHT', MID, VIEW_H - 46, 30);
  }
}

