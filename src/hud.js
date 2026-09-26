import {
  VIEW_W, VIEW_H, BLOOD_MAX, MANA_MAX, NIGHT_MINUTES, WORLD,
  VISION_SECONDS, VISION_WARN, GLASS_CLOCK_TEXT,
} from './config.js';
import { drawHourglass, GLASS_W, GLASS_H } from './hourglass.js';
import { DISTRICTS, blockAt } from './city.js';
import { shortFact, cardFact, addressOf, FACT_KEYS } from './hints.js';
// the red the cat's gift pours down the screen, which is the red you dry into
import { BLOOD_RED } from './render.js';
import { deathText, deathWrap, setDeathFont } from './deathtype.js';

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
  const { player, clock, knowledge, city, prompt, dialogue, world } = game;
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
  drawClues(ctx, knowledge, city);

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
  ctx.textAlign = 'center';
  for (const t of game.toasts) {
    const a = Math.min(1, t.life / 0.6);
    ctx.globalAlpha = a;
    ctx.font = FONT(t.big ? 24 : 17);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, VIEW_W / 2, VIEW_H * 0.36 - t.rise);
    ctx.globalAlpha = 1;
  }
}

// The whole clock: an hourglass in a panel, with a line of bad news under it.
const CLOCK_PAD = 12;
const CLOCK_W = GLASS_W + CLOCK_PAD * 2;
const CLOCK_CAPTION = 46 + (GLASS_CLOCK_TEXT ? 24 : 0);
const CLOCK_H = GLASS_H + CLOCK_PAD + CLOCK_CAPTION;

function drawClock(ctx, clock, panic) {
  const x = VIEW_W - 16 - CLOCK_W, y = 16;
  panel(ctx, x, y, CLOCK_W, CLOCK_H, panic ? 0.92 : 0.86);
  drawHourglass(ctx, x + CLOCK_PAD, y + CLOCK_PAD,
                clock.minutes / NIGHT_MINUTES, clock.t, panic);

  const hot = panic && Math.floor(clock.t * 4) % 2;
  let ty = y + CLOCK_PAD + GLASS_H + 18;
  ctx.textAlign = 'center';
  if (GLASS_CLOCK_TEXT) {
    ctx.font = FONT(20);
    ctx.fillStyle = panic ? (hot ? '#ff5a4a' : '#ffb24a') : '#f0e6ff';
    ctx.fillText(clockText(clock.minutes), x + CLOCK_W / 2, ty);
    ty += 24;
  }
  ctx.font = FONT(11);
  ctx.fillStyle = panic ? (hot ? '#ff5a4a' : '#ffb24a') : '#b8a8d0';
  const caption = panic ? ['THE SKY IS', 'GETTING IDEAS'] : ['SUNRISE AT', '6:00 AM'];
  caption.forEach((line, i) => ctx.fillText(line, x + CLOCK_W / 2, ty + i * 14));
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
// is not squared up.  Four cards is the whole deck and the whole address.
const CARD_W = 92, CARD_H = 129;       // the proportions of a playing card
const CARD_DX = 12, CARD_DY = 22;      // how far each card underneath shows
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

function drawCard(ctx, x, y, key, party, front) {
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
  const token = cardFact(key, party);
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
  const text = shortFact(key, party);
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
// hit-testing both go through these two, because a deck you cannot click
// accurately is worse than one you cannot click at all.
function deckOrder(knowledge) {
  return FACT_KEYS.filter(k => knowledge[k]).sort((a, b) => knowledge[b] - knowledge[a]);
}

function cardPos(i) {
  return { x: 16 + i * CARD_DX, y: VIEW_H - 34 - CARD_H - i * CARD_DY };
}

/**
 * Which card is under this point, front first - or null for empty pavement
 * and for the card already on top, which has nowhere to come forward to.
 */
export function cardAt(px, py, knowledge) {
  const known = deckOrder(knowledge);
  for (let i = 0; i < known.length; i++) {
    const { x, y } = cardPos(i);
    if (px >= x && px <= x + CARD_W && py >= y && py <= y + CARD_H) {
      return i === 0 ? null : known[i];
    }
  }
  return null;
}

function drawClues(ctx, knowledge, city) {
  const known = deckOrder(knowledge);
  const { x: x0, y: y0 } = cardPos(0);

  if (!known.length) {
    drawCardBack(ctx, x0, y0);
    ctx.textAlign = 'left';
    ctx.font = FONT(13);
    ctx.fillStyle = '#7a7288';
    ctx.fillText('nothing yet.', x0 + CARD_W + 14, y0 + 64);
    ctx.fillText('find a cat,', x0 + CARD_W + 14, y0 + 84);
    ctx.fillText('find a monster.', x0 + CARD_W + 14, y0 + 104);
  } else {
    // back to front: each card has to land on top of the one behind it
    for (let i = known.length - 1; i >= 0; i--) {
      const { x, y } = cardPos(i);
      drawCard(ctx, x, y, known[i], city.party, i === 0);
    }
  }

  ctx.textAlign = 'left';
  ctx.font = FONT(12);
  ctx.fillStyle = known.length === FACT_KEYS.length ? '#7aff9a' : '#c9a8ff';
  ctx.fillText(`WHAT YOU KNOW  ${known.length}/${FACT_KEYS.length}`, x0, VIEW_H - 14);
}

// ---------------------------------------------------------------------------
// Which doors are still possible.  A block may hold several of them, so the
// address narrows the map to one block and the decoration picks the door on
// it - which is why no two doors on a block hang the same thing.
export function candidateDoors(knowledge, city) {
  const p = city.party;
  return city.doors.filter((d) => {
    if (knowledge.avenue && d.block.avenue !== p.block.avenue) return false;
    if (knowledge.street && d.block.street !== p.block.street) return false;
    if (knowledge.district && d.block.district !== p.districtIdx) return false;
    if (knowledge.deco && d.deco.key !== p.deco.key) return false;
    return true;
  });
}

// The map is the city shrunk, not a grid of squares: every block is drawn at
// the size and in the place it actually has, which is the only way to read a
// city that was cut rather than ruled.  It also prints the address of the
// block you are standing on, because there is no other way to tell 11th
// Avenue from 12th once the avenues are not evenly spaced.
function drawMinimap(ctx, game) {
  const { city, player, knowledge } = game;
  const MAP = 160, pad = 8;
  const size = MAP + pad * 2;
  // two lines under the map now, so it sits high enough for both of them
  const x = VIEW_W - size - 16, y = VIEW_H - size - 54;
  panel(ctx, x, y, size, size + 38);
  const S = MAP / WORLD;
  const MX = (wx) => x + pad + wx * S;
  const MY = (wy) => y + pad + wy * S;

  const cands = candidateDoors(knowledge, city);
  const candSet = new Set(cands.map(d => d.block.id));

  ctx.fillStyle = '#0d0c14';                       // the roads, underneath
  ctx.fillRect(x + pad, y + pad, MAP, MAP);
  for (const b of city.blocks) {
    const bx = MX(b.x0), by = MY(b.y0);
    const bw = Math.max(1, (b.x1 - b.x0) * S - 1), bh = Math.max(1, (b.y1 - b.y0) * S - 1);
    ctx.fillStyle = candSet.has(b.id) ? '#33234f' : '#17161f';
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
  if (knowledge.marked) {
    const b = city.party.block;
    ctx.strokeStyle = '#7aff9a'; ctx.lineWidth = 2;
    ctx.strokeRect(MX(b.x0) - 1, MY(b.y0) - 1, (b.x1 - b.x0) * S + 1, (b.y1 - b.y0) * S + 1);
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
  ctx.fillText(`${cands.length} DOOR${cands.length === 1 ? '' : 'S'} LEFT`, x + size / 2, y + size + 14);
  ctx.fillStyle = '#7a6f92';
  ctx.fillText(addressOf(blockAt(player.x, player.y)).toUpperCase(), x + size / 2, y + size + 30);
}

// ---------------------------------------------------------------------------
// Full-screen states
// ---------------------------------------------------------------------------
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
    ['', 'the street is all children until a cat says otherwise.'],
  ];
  ctx.font = FONT(16);
  let y = 286;
  for (const [k, v] of lines) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#b08aff';
    ctx.fillText(k, VIEW_W / 2 - 150, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ddd2ee';
    ctx.font = FONT(16, false);
    ctx.fillText(v, VIEW_W / 2 - 132, y);
    ctx.font = FONT(16);
    y += 25;
  }
  ctx.textAlign = 'center';
  ctx.font = FONT(22);
  ctx.fillStyle = Math.floor(t * 2) % 2 ? '#ffd24a' : '#a07ad8';
  ctx.fillText('PRESS ENTER - MIDNIGHT IS WASTING', VIEW_W / 2, VIEW_H - 64);
}

export function drawEnd(ctx, game, t) {
  if (game.state !== 'win') { drawDeath(ctx, game, t); return; }

  ctx.fillStyle = 'rgba(20,6,34,0.94)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.font = FONT(64);
  ctx.fillStyle = '#e8c8ff';
  ctx.fillText('YOU FOUND IT', VIEW_W / 2, 230);
  ctx.font = FONT(20, false);
  ctx.fillStyle = '#e0d4f0';
  wrapCentered(ctx, game.endText, VIEW_W / 2, 290, 820, 30);

  ctx.font = FONT(17);
  ctx.fillStyle = '#b8a8d0';
  endStats(game).forEach(([k, v], i) => {
    ctx.fillText(`${k}  ${v}`, VIEW_W / 2, 440 + i * 26);
  });

  ctx.font = FONT(20);
  ctx.fillStyle = Math.floor(t * 2) % 2 ? '#ffd24a' : '#a07ad8';
  ctx.fillText('PRESS ENTER FOR ANOTHER NIGHT', VIEW_W / 2, VIEW_H - 50);
}

function endStats(game) {
  return [
    ['time', clockText(game.clock.minutes)],
    ['doors', `${game.stats.knocks} knocked`],
    ['candy', `${game.player.candy} pieces carried`],
    ['clues', `${FACT_KEYS.filter(k => game.knowledge[k]).length} of ${FACT_KEYS.length}`],
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

function drawDeath(ctx, game, t) {
  ctx.fillStyle = BLOOD_RED;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#000000';

  // one word, set as large as it will go and stood in the middle of the red
  const word = game.endTitle.toUpperCase();
  setDeathFont(ctx, DEATH_SIZE);
  const wide = ctx.measureText(word).width;
  const size = wide > DEATH_MAX_W ? DEATH_SIZE * (DEATH_MAX_W / wide) : DEATH_SIZE;
  setDeathFont(ctx, size);
  const cap = ctx.measureText('H').actualBoundingBoxAscent || size * 0.72;
  deathText(ctx, word, MID, VIEW_H / 2 + cap / 2, size);

  if (Math.floor(t * 2) % 2) {
    deathText(ctx, 'PRESS ENTER FOR ANOTHER NIGHT', MID, VIEW_H - 46, 30);
  }
}

function wrapCentered(ctx, text, cx, y, maxW, lh) {
  const words = String(text).split(' ');
  let line = '';
  const lines = [];
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lh));
}
