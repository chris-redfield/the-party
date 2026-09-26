import {
  VIEW_W, VIEW_H, BLOOD_MAX, MANA_MAX, NIGHT_MINUTES, GRID, CELL,
  VISION_SECONDS, VISION_WARN,
} from './config.js';
import { DISTRICTS } from './city.js';
import { shortFact, FACT_KEYS } from './hints.js';

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
  const { player, clock, knowledge, city, log, prompt, dialogue, world } = game;
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

  // --- clock --------------------------------------------------------------
  const left = NIGHT_MINUTES - clock.minutes;
  const panic = left < 60;
  panel(ctx, VIEW_W - 268, 16, 252, 76, panic ? 0.92 : 0.86);
  ctx.textAlign = 'right';
  ctx.font = FONT(38);
  ctx.fillStyle = panic ? (Math.floor(clock.t * 4) % 2 ? '#ff5a4a' : '#ffb24a') : '#f0e6ff';
  ctx.fillText(clockText(clock.minutes), VIEW_W - 30, 58);
  ctx.font = FONT(13);
  ctx.fillStyle = '#b8a8d0';
  ctx.fillText(panic ? 'THE SKY IS GETTING IDEAS' : 'SUNRISE AT 6:00 AM', VIEW_W - 30, 78);
  // night progress
  ctx.fillStyle = '#2a2038';
  ctx.fillRect(VIEW_W - 268, 92, 252, 6);
  ctx.fillStyle = panic ? '#ff7a3a' : '#6a4ab0';
  ctx.fillRect(VIEW_W - 268, 92, 252 * (clock.minutes / NIGHT_MINUTES), 6);

  drawVision(ctx, game);
  drawMinimap(ctx, game);
  if (!dialogue) drawClues(ctx, knowledge, city, log);

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
function drawClues(ctx, knowledge, city, log) {
  const known = FACT_KEYS.filter(k => knowledge[k]);
  const rumors = log.filter(l => l.rumor).slice(-2);
  const rows = Math.max(known.length, 1) + (rumors.length ? rumors.length + 1 : 0);
  const h = 46 + rows * 20;
  panel(ctx, 16, VIEW_H - h - 16, 372, h);
  ctx.textAlign = 'left';
  ctx.font = FONT(13);
  ctx.fillStyle = '#c9a8ff';
  ctx.fillText(`WHAT YOU KNOW  (${known.length}/${FACT_KEYS.length})`, 28, VIEW_H - h + 6);
  ctx.font = FONT(14, false);
  let y = VIEW_H - h + 30;
  if (!known.length) {
    ctx.fillStyle = '#7a7288';
    ctx.fillText('nothing. ask somebody real.', 28, y);
    y += 20;
  }
  for (const k of known) {
    ctx.fillStyle = '#e8dcff';
    ctx.fillText('* ' + shortFact(k, city.party), 28, y);
    y += 20;
  }
  if (rumors.length) {
    ctx.font = FONT(12);
    ctx.fillStyle = '#a06a6a';
    ctx.fillText('HEARSAY  (from people in costumes)', 28, y + 2);
    y += 20;
    ctx.font = FONT(13, false);
    for (const r of rumors) {
      ctx.fillStyle = '#8a6a72';
      ctx.fillText('? ' + clipTo(ctx, r.text, 330), 28, y);
      y += 20;
    }
  }
}

function clipTo(ctx, text, maxW) {
  let t = text;
  while (t.length > 4 && ctx.measureText(t).width > maxW) t = t.slice(0, -2);
  return t === text ? t : t + '...';
}

// ---------------------------------------------------------------------------
export function candidateBlocks(knowledge, city) {
  const out = [];
  for (let cy = 0; cy < GRID; cy++) {
    for (let cx = 0; cx < GRID; cx++) {
      if (knowledge.col && cx !== city.party.cx) continue;
      if (knowledge.row && cy !== city.party.cy) continue;
      if (knowledge.district) {
        const d = DISTRICTS[city.party.districtIdx];
        if (cx < d.cols[0] || cx > d.cols[1] || cy < d.rows[0] || cy > d.rows[1]) continue;
      }
      out.push({ cx, cy });
    }
  }
  return out;
}

function drawMinimap(ctx, game) {
  const { city, player, knowledge } = game;
  const S = 17, pad = 8;
  const size = GRID * S + pad * 2;
  const x = VIEW_W - size - 16, y = VIEW_H - size - 16;
  panel(ctx, x, y, size, size + 22);

  const cands = candidateBlocks(knowledge, city);
  const candSet = new Set(cands.map(c => c.cy * GRID + c.cx));

  for (let cy = 0; cy < GRID; cy++) {
    for (let cx = 0; cx < GRID; cx++) {
      const bx = x + pad + cx * S, by = y + pad + cy * S;
      const isCand = candSet.has(cy * GRID + cx);
      ctx.fillStyle = isCand ? '#33234f' : '#17161f';
      ctx.fillRect(bx + 1, by + 1, S - 2, S - 2);
      const block = city.blockAt(cx, cy);
      if (block.door.tried) {
        ctx.fillStyle = 'rgba(200,70,70,0.34)';
        ctx.fillRect(bx + 1, by + 1, S - 2, S - 2);
        ctx.strokeStyle = '#d0424a'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx + 3, by + 3); ctx.lineTo(bx + S - 3, by + S - 3);
        ctx.moveTo(bx + S - 3, by + 3); ctx.lineTo(bx + 3, by + S - 3);
        ctx.stroke();
      }
    }
  }
  if (knowledge.marked) {
    const bx = x + pad + city.party.cx * S, by = y + pad + city.party.cy * S;
    ctx.strokeStyle = '#7aff9a'; ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, S, S);
  }
  // player
  const px = x + pad + (player.x / CELL) * S, py = y + pad + (player.y / CELL) * S;
  ctx.fillStyle = '#ffd24a';
  ctx.fillRect(px - 2, py - 2, 5, 5);

  // while the vision holds, the monsters within earshot show up as pinpricks
  if (game.visionMix > 0.1) {
    ctx.globalAlpha = game.visionMix;
    for (const n of game.world.npcs) {
      if (!n.real) continue;
      if (Math.hypot(n.x - player.x, n.y - player.y) > 1500) continue;
      ctx.fillStyle = n.kind === 'witch' ? '#7aff9a' : '#ff5a4a';
      ctx.fillRect(x + pad + (n.x / CELL) * S - 1, y + pad + (n.y / CELL) * S - 1, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = 'center';
  ctx.font = FONT(11);
  ctx.fillStyle = '#9a8ab8';
  ctx.fillText(`${cands.length} BLOCK${cands.length === 1 ? '' : 'S'} LEFT`, x + size / 2, y + size + 14);
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
    ['BLACK CATS', 'E  -  a cat lends you VAMPIRE VISION for one minute.'],
    ['', 'the colour goes out of the city, every light burns red,'],
    ['', 'and the real monsters appear on the pavement.'],
    ['', ''],
    ['THE POINT', 'only real monsters know where the party is. without the'],
    ['', 'vision you cannot see them, let alone ask them. everyone'],
    ['', 'else out here is a person in a costume with a rumour.'],
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
  const win = game.state === 'win';
  ctx.fillStyle = win ? 'rgba(20,6,34,0.94)' : 'rgba(30,10,8,0.94)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.font = FONT(64);
  ctx.fillStyle = win ? '#e8c8ff' : '#ff9a6a';
  ctx.fillText(win ? 'YOU FOUND IT' : game.endTitle, VIEW_W / 2, 230);
  ctx.font = FONT(20, false);
  ctx.fillStyle = '#e0d4f0';
  wrapCentered(ctx, game.endText, VIEW_W / 2, 290, 820, 30);

  ctx.font = FONT(17);
  ctx.fillStyle = '#b8a8d0';
  const stats = [
    `time:   ${clockText(game.clock.minutes)}`,
    `doors:  ${game.stats.knocks} knocked`,
    `candy:  ${game.player.candy} pieces carried`,
    `clues:  ${FACT_KEYS.filter(k => game.knowledge[k]).length} of ${FACT_KEYS.length}`,
    `party:  ${DISTRICTS[game.city.party.districtIdx].name}, ` +
      `${game.city.party.cx + 1} Ave & ${game.city.party.cy + 1} St`,
    `door:   the one with ${game.city.party.deco.name}`,
  ];
  stats.forEach((s, i) => ctx.fillText(s, VIEW_W / 2, 440 + i * 26));

  ctx.font = FONT(20);
  ctx.fillStyle = Math.floor(t * 2) % 2 ? '#ffd24a' : '#a07ad8';
  ctx.fillText('PRESS ENTER FOR ANOTHER NIGHT', VIEW_W / 2, VIEW_H - 50);
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
