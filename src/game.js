import {
  MIN_PER_SEC, NIGHT_MINUTES, BLOOD_DRAIN, BLOOD_MAX, MANA_MAX,
  CANDY_PER_WRONG_DOOR, PUNCH_BLOOD, BUMP_BLOOD, BUMP_STAGGER, BUMP_SHAKE,
  SIM_RADIUS, BASS_RADIUS, VISION_SECONDS, VISION_FADE, VISION_TAPER,
  VISION_BLEED, VISION_DELAY, REVEAL, CAT_TOUCH, MAX_TIPS,
} from './config.js';
import { makeRng, hashSeed } from './rng.js';
import { buildCity, ringPoint, nearestRingT, blockAt, isWalkable } from './city.js';
import { populate, updateKid, updateCat, updateBeast } from './entities.js';
import { makePlayer, updatePlayer, tryBat, wantedFollowers, shove } from './player.js';
import {
  FACT_KEYS, makeTip, tipLine, exhaustedLine, fullLine, catLine, factText,
} from './hints.js';
import { sfx, setBassProximity, stopMusic } from './audio.js';

const DOOR_REACH = 46;
const TALK_REACH = 48;
const KID_BLOCK = 19;
const NPC_BLOCK = 20;

export function newGame(seedStr, citySeed) {
  const seed = hashSeed(seedStr || String(Date.now()));
  const rng = makeRng(seed);
  // the layout comes off its own fixed seed; `rng` only decides what the
  // night puts in it
  const city = buildCity(rng, citySeed);
  city.party.districtIdx = city.party.block.district;
  const world = populate(rng, city);
  world.piles = [];

  // start far away from the party, on a sidewalk
  let start = null;
  for (let tries = 0; tries < 400; tries++) {
    const b = rng.pick(city.blocks);
    const p = ringPoint(b, rng.range(0, b.perim), 0);
    if (Math.hypot(p.x - city.party.ax, p.y - city.party.ay) > 2200) { start = p; break; }
  }
  if (!start) start = ringPoint(city.blocks[0], 200, 0);

  const player = makePlayer(start.x, start.y);

  return {
    seed: seedStr, rng, city, world, player,
    state: 'title',
    clock: { t: 0, minutes: 0 },
    // Every tip you have been told, in the order it arrived, true and false
    // mixed together with nothing to tell them apart.  There is no reduced
    // "what you know" any more: half of this is a lie, so the game cannot
    // hold an answer on your behalf, only the claims.
    tips: [], tipsTaken: 0,
    toasts: [], log: [],
    prompt: null, dialogue: null, target: null,
    vision: 0, visionMix: 0, bleed: 0, camShake: 0,
    endTitle: '', endText: '', endT: 0,   // seconds the end card has been up
    stats: { knocks: 0, talks: 0, bats: 0 },
  };
}

/**
 * Pull a buried tip up to the front of the deck.  Position in the pile is just
 * the order the tips arrived in, so coming forward is simply becoming the
 * newest thing you were told - no separate shuffle state to keep in step.
 * `id` never moves, which is what a click is resolved against.
 */
export function bringTipForward(game, id) {
  const tip = game.tips.find(t => t.id === id);
  if (!tip) return false;
  tip.order = ++game.tipsTaken;
  return true;
}

/**
 * Deal one card onto the deck, if there is room.  The only way facts enter
 * the game - the console hooks come through here too, so there is one place
 * that knows what a tip is made of and one place that knows when to stop.
 * Returns null once the night's five are gone.
 */
export function giveTip(game, key, lie, from) {
  if (game.tips.length >= MAX_TIPS) return null;
  const tip = makeTip(game.rng, game.city, key, lie);
  tip.id = tip.order = ++game.tipsTaken;
  tip.from = from;
  game.tips.push(tip);
  return tip;
}

// ---------------------------------------------------------------------------
export function toast(game, text, color = '#f0e6ff', big = false) {
  game.toasts.push({ text, color, life: 2.4, rise: 0, big });
  if (game.toasts.length > 5) game.toasts.shift();
}

function distTo(a, bx, by) { return Math.hypot(a.x - bx, a.y - by); }

// ---------------------------------------------------------------------------
export function updateGame(game, dt, input) {
  if (game.state !== 'play') return;
  const { player: p, world, city } = game;

  // --- the night burns down ------------------------------------------------
  game.clock.t += dt;
  game.clock.minutes = game.clock.t * MIN_PER_SEC;
  if (game.clock.minutes >= NIGHT_MINUTES) return die(game, 'ASH',
    'The sky went the colour of a peach and that was the end of you. ' +
    'Somewhere, four blocks away, someone was still playing the same song.');

  p.blood -= BLOOD_DRAIN * dt;

  // Vampire vision burns down on its own clock.  It arrives fast - a cat does
  // not ease you into it - and then spends its last 30% draining away, which
  // is the whole palette, the torches and the monsters going with it.  At zero
  // the mix is exactly zero and you are back in the ordinary city.
  //
  // It does not start arriving until VISION_DELAY, which is part way down the
  // pour: the city holds ordinary while the blood is building up over it, and
  // turns as the sheet comes down and leaves.  Held there the mix keeps
  // whatever it already was - nought on a fresh cat, so nothing changes in the
  // clear first; one on a second cat, so the city does not flash back to
  // colour under the sheet.
  if (game.bleed > 0) game.bleed = Math.max(0, game.bleed - dt);
  if (game.vision > 0) {
    game.vision = Math.max(0, game.vision - dt);
    const t = game.vision;
    const shown = VISION_SECONDS - t - VISION_DELAY;    // < 0 while covered
    if (shown >= 0) {
      const taper = VISION_SECONDS * VISION_TAPER;
      game.visionMix = Math.max(0, Math.min(1,
        Math.min(shown / VISION_FADE, t / taper)));
    }
    if (game.vision === 0) {
      game.visionMix = 0;
      toast(game, 'the city goes back to normal. so do you.', '#8a7ea8');
    }
  } else if (game.visionMix > 0) {
    game.visionMix = Math.max(0, game.visionMix - dt / VISION_FADE);
  }

  // --- input ---------------------------------------------------------------
  if (!game.dialogue) {
    updatePlayer(p, dt, input);
    if (input.pressed('bat')) {
      const paid = tryBat(p, input.x, input.y);
      if (paid) {
        game.stats.bats++;
        sfx.batOn();
        if (paid === 'blood') toast(game, '-BLOOD  (the night ran dry)', '#ff6a6a');
      }
    }
    if (input.pressed('drop')) dropCandy(game);
    if (p.moving && p.bat <= 0) {
      p.stepTimer -= dt;
      if (p.stepTimer <= 0) { p.stepTimer = 0.3; sfx.step(); }
    }
  }

  // --- entities ------------------------------------------------------------
  for (const k of world.kids) {
    if (!k.following && Math.abs(k.x - p.x) + Math.abs(k.y - p.y) > SIM_RADIUS) continue;
    if (k.distract > 0) k.distract -= dt;
    updateKid(k, dt, p);
    // Children are solid.  On foot you cannot go through them, and a pack of
    // four fills the pavement - that is what the wings are for.
    if (p.bat <= 0 && !k.following) {
      const dx = p.x - k.x, dy = p.y - k.y;
      const d = Math.hypot(dx, dy);
      if (d < KID_BLOCK) {
        const a = d > 0.01 ? Math.atan2(dy, dx) : Math.random() * 6.2832;
        const px = k.x + Math.cos(a) * KID_BLOCK;
        const py = k.y + Math.sin(a) * KID_BLOCK;
        if (isWalkable(px, py)) { p.x = px; p.y = py; }
        if (k.bump <= 0) {
          // They want a treat. You have fangs, a cape and somewhere to be.
          k.bump = 2.0;
          p.blood -= BUMP_BLOOD;
          p.stagger = BUMP_STAGGER;
          p.hurtFlash = 0.3;
          shove(p, k.x, k.y);
          game.camShake = BUMP_SHAKE;
          sfx.bump();
          k.say = 'TRICK OR TREAT!';
          k.sayT = 1.4;
          toast(game, '"TRICK OR TREAT!"   you lose a second you do not have', '#d8d0e8');
        }
      }
    }
    if (k.sayT > 0) k.sayT -= dt;
  }
  // A monster in its costume is just another solid child on the pavement, and
  // it charges you for the collision like one - it has a part to play. Once a
  // cat has shown you what it is, it stops pretending and just stands there.
  const hidden = game.visionMix < REVEAL;
  for (const n of world.npcs) {
    if (n.sayT > 0) n.sayT -= dt;
    if (n.bump > 0) n.bump -= dt;
    if (p.bat > 0) continue;
    if (Math.abs(n.x - p.x) + Math.abs(n.y - p.y) > 120) continue;
    const dx = p.x - n.x, dy = p.y - n.y;
    const d = Math.hypot(dx, dy);
    if (d < NPC_BLOCK) {
      const a = d > 0.01 ? Math.atan2(dy, dx) : Math.random() * 6.2832;
      const px = n.x + Math.cos(a) * NPC_BLOCK, py = n.y + Math.sin(a) * NPC_BLOCK;
      if (isWalkable(px, py)) { p.x = px; p.y = py; }
      if (n.bump <= 0) {
        n.bump = hidden ? 2.0 : 1.6;
        shove(p, n.x, n.y);
        sfx.bump();
        if (hidden) {
          p.blood -= BUMP_BLOOD;
          p.stagger = BUMP_STAGGER;
          p.hurtFlash = 0.3;
          game.camShake = BUMP_SHAKE;
          n.say = 'TRICK OR TREAT!';
          n.sayT = 1.4;
          toast(game, '"TRICK OR TREAT!"   you lose a second you do not have', '#d8d0e8');
        } else {
          game.camShake = BUMP_SHAKE * 0.6;
        }
      }
    }
  }

  // Pumpkins are solid, and solid is all they are: they do not bite, they do
  // not shout at you, they do not cost you anything. They stand in the way,
  // you go round, and that is the whole of it. The wings clear them like they
  // clear everybody else.
  if (p.bat <= 0) for (const pk of world.pumpkins) {
    if (Math.abs(pk.x - p.x) + Math.abs(pk.y - p.y) > 90) continue;
    const dx = p.x - pk.x, dy = p.y - pk.y;
    const d = Math.hypot(dx, dy);
    if (d >= pk.hit) continue;
    const a = d > 0.01 ? Math.atan2(dy, dx) : Math.random() * 6.2832;
    const px = pk.x + Math.cos(a) * pk.hit, py = pk.y + Math.sin(a) * pk.hit;
    if (isWalkable(px, py)) { p.x = px; p.y = py; }
  }

  for (const c of world.cats) {
    if (Math.abs(c.x - p.x) + Math.abs(c.y - p.y) > SIM_RADIUS) continue;
    updateCat(c, dt);
    // No asking: you brush against it and it decides.  A cat you cannot see
    // is not there to brush against, so one already in hand cannot be spent
    // by blundering into a cat the vision has taken off the street.
    if (!c.used && game.visionMix < REVEAL
        && Math.hypot(c.x - p.x, c.y - p.y) < CAT_TOUCH) lendVision(game, c);
  }

  // The beasts keep station on the children, whether or not you can see them -
  // one that only moved while you were looking would be somewhere else every
  // time the vision came up.
  for (const b of world.beasts) {
    if (Math.abs(b.host.x - p.x) + Math.abs(b.host.y - p.y) > SIM_RADIUS) continue;
    updateBeast(b, dt, p);
  }

  manageFollowers(game);

  // --- proximity to the real party -----------------------------------------
  const pd = Math.hypot(p.x - city.party.ax, p.y - city.party.ay);
  setBassProximity(1 - Math.min(1, pd / BASS_RADIUS));

  // --- what can we interact with? ------------------------------------------
  findTarget(game);
  if (game.dialogue) {
    if (input.pressed('use') || input.pressed('bat')) game.dialogue = null;
  } else if (input.pressed('use') && game.target) {
    interact(game, game.target);
  }

  // --- toasts --------------------------------------------------------------
  for (const t of game.toasts) { t.life -= dt; t.rise += dt * 26; }
  game.toasts = game.toasts.filter(t => t.life > 0);

  if (p.blood <= 0) die(game, 'DEAD',
    'You spent your last on wings. A vampire with no blood is just a bad coat ' +
    'full of dust on a pavement that nobody sweeps.');
}

// ---------------------------------------------------------------------------
function findTarget(game) {
  const { player: p, world, city } = game;
  let best = null, bestD = Infinity;

  // only doors on the blocks you could possibly be standing against
  for (const b of city.blocksIn(p.x - DOOR_REACH, p.y - DOOR_REACH,
                                p.x + DOOR_REACH, p.y + DOOR_REACH)) {
    for (const d of b.doors) {
      const dist = Math.hypot(p.x - d.ax, p.y - d.ay);
      if (dist < DOOR_REACH && dist < bestD) { bestD = dist; best = { type: 'door', door: d }; }
    }
  }
  // you cannot ask a question of something you still think is a child
  if (game.visionMix >= REVEAL) for (const n of world.npcs) {
    const dist = distTo(n, p.x, p.y);
    if (dist < TALK_REACH && dist < bestD) { bestD = dist; best = { type: 'npc', npc: n }; }
  }

  game.target = best;
  if (!best) { game.prompt = null; return; }
  if (best.type === 'door') {
    const d = best.door;
    game.prompt = d.tried
      ? '[E]  knock again on this door (you already tried it)'
      : '[E]  knock on the red door';
  } else {
    game.prompt = `[E]  talk to the ${best.npc.kind === 'witch' ? 'witch' : 'vampire'}`;
  }
}

// ---------------------------------------------------------------------------
function interact(game, target) {
  if (target.type === 'door') return knock(game, target.door);
  if (target.type === 'npc') return talk(game, target.npc);
}

export function knock(game, door) {
  const { player: p, city } = game;
  sfx.knock();
  game.stats.knocks++;
  if (door.isParty) {
    game.state = 'win';
    game.endT = 0;
    game.endTitle = 'YOU FOUND IT';
    game.endText =
      'The door opens on a wall of sound and a room with no mirrors in it. ' +
      'Nobody asks for your invitation. Somebody hands you something red in a ' +
      'plastic cup. Outside, the sun comes up without you, which is exactly how ' +
      'you like it.';
    sfx.win();
    return;
  }
  const first = !door.tried;
  door.tried = true;
  p.candy += CANDY_PER_WRONG_DOOR;
  p.blood = Math.min(BLOOD_MAX, p.blood + PUNCH_BLOOD);
  sfx.wrong();
  const lines = [
    'A man dressed as a hot dog gives you three fun-size somethings and a cup of red punch.',
    'Wrong house. They compliment the cape. They give you candy. You take the candy.',
    'Six children scream. An adult apologises. You leave with more candy than you arrived with.',
    'Not the party. Just a party. The punch is warm and suspiciously good.',
  ];
  game.dialogue = {
    name: 'THE WRONG DOOR',
    nameColor: '#ff8a6a',
    text: game.rng.pick(lines) +
      `  (+${CANDY_PER_WRONG_DOOR} candy, +${PUNCH_BLOOD} blood)` +
      (first ? '' : '  You have knocked here before. They remember you.'),
  };
  toast(game, `+${CANDY_PER_WRONG_DOOR} candy   +${PUNCH_BLOOD} blood`, '#e8b23a');
}

// A witch hands over the hardest thing she can, in this order.  Listed by
// hand rather than read off FACT_KEYS, so the two can be reordered apart.
const WITCH_ORDER = ['district', 'avenue', 'street', 'deco'];

function talk(game, npc) {
  const { city, rng } = game;
  sfx.talk();
  game.stats.talks++;
  const label = npc.kind === 'witch' ? 'WITCH' : 'VAMPIRE';

  // Five a night and no more.  There is no "you already know everything" -
  // you can be told the same fact twice and that is the only way to catch a
  // liar - but the night stops handing them over at MAX_TIPS, so the fifth
  // card is the last thing anybody in this city will tell you.
  if (game.tips.length >= MAX_TIPS) {
    game.dialogue = {
      name: label, nameColor: npc.kind === 'witch' ? '#7aff9a' : '#ff6a7a',
      text: fullLine(rng, npc.kind),
    };
    return;
  }
  if (npc.talked > 0) {
    const d = Math.hypot(game.player.x - city.party.ax, game.player.y - city.party.ay);
    game.dialogue = {
      name: label, nameColor: npc.kind === 'witch' ? '#7aff9a' : '#ff6a7a',
      text: exhaustedLine(rng, npc.kind, d, npc.liar),
    };
    return;
  }

  // Whichever fact you have heard least about.  Corroboration is the game
  // now, and you cannot corroborate a fact nobody has mentioned - so the deck
  // fills out across all four before anyone doubles up on one.
  const heard = {};
  for (const k of FACT_KEYS) heard[k] = 0;
  for (const t of game.tips) heard[t.key]++;
  const fewest = Math.min(...FACT_KEYS.map(k => heard[k]));
  const thin = FACT_KEYS.filter(k => heard[k] === fewest);
  const key = npc.kind === 'witch'
    ? (WITCH_ORDER.find(k => thin.includes(k)) || thin[0])
    : rng.pick(thin);

  const tip = giveTip(game, key, npc.liar, npc.kind);
  npc.talked++;
  sfx.clue();
  game.log.push({ text: factText(tip.key, tip.value), lie: tip.lie });

  game.dialogue = {
    name: label,
    nameColor: npc.kind === 'witch' ? '#7aff9a' : '#ff6a7a',
    text: tipLine(rng, npc.kind, tip),
  };
  // Not "CLUE": it is a thing somebody said to you.  Half of them lie and the
  // HUD must never be the thing that tells you which half you just met.
  toast(game, `A TIP   ${game.tips.length}/${MAX_TIPS}`, '#c9a8ff', true);
}

/**
 * The cat does not wait to be asked.  You walk into it, the blood comes down
 * over everything, and when it has run off the bottom you are looking at the
 * other city.  No dialogue box: stopping the game dead would waste the
 * seconds it just gave you.
 */
function lendVision(game, cat) {
  cat.used = true;
  game.vision = VISION_SECONDS;
  game.bleed = VISION_BLEED;
  sfx.mana();
  toast(game, `VAMPIRE VISION  -  ${VISION_SECONDS} SECONDS`, '#e8452f', true);
  toast(game, catLine(game.rng), '#ffd24a');
}

// ---------------------------------------------------------------------------
function manageFollowers(game) {
  const { player: p, world } = game;
  const want = wantedFollowers(p);
  const current = world.kids.filter(k => k.following);
  p.followers = current.length;
  if (current.length < want) {
    let best = null, bestD = 400;
    for (const k of world.kids) {
      if (k.following || k.distract > 0) continue;
      const d = Math.hypot(k.x - p.x, k.y - p.y);
      if (d < bestD) { bestD = d; best = k; }
    }
    if (best) {
      best.following = true;
      best.followSlot = current.length;
      best.say = 'candy!';
      best.sayT = 1.2;
      toast(game, 'a child has decided you are a parade', '#e8b23a');
    }
  } else if (current.length > want) {
    const k = current[current.length - 1];
    releaseKid(k, 3);
  }
  current.forEach((k, i) => { k.followSlot = i; });
}

/** Put a child back on the pavement where they are actually standing. */
function releaseKid(k, distract) {
  k.following = false;
  k.state = 'patrol';
  k.distract = distract;
  k.block = blockAt(k.x, k.y);
  k.t = nearestRingT(k.block, k.x, k.y);
  k.lat = 0;
  k.speed = 26 + Math.random() * 20;
  k.dir = Math.random() < 0.5 ? 1 : -1;
}

function dropCandy(game) {
  const { player: p, world } = game;
  if (p.candy <= 0) { toast(game, 'you have nothing to drop', '#7a7288'); return; }
  const amount = Math.max(1, Math.floor(p.candy * 0.6));
  p.candy -= amount;
  world.piles.push({ x: p.x, y: p.y, amount, seed: Math.random() * 6.28, life: 30 });
  if (world.piles.length > 8) world.piles.shift();
  for (const k of world.kids) {
    if (!k.following) continue;
    releaseKid(k, 12);
  }
  sfx.candy();
  toast(game, `dumped ${amount} candy. they are not following you, they are following that.`, '#e8b23a');
}

// ---------------------------------------------------------------------------
function die(game, title, text) {
  if (game.state !== 'play') return;
  game.state = 'lose';
  game.endT = 0;
  game.endTitle = title;
  game.endText = text;
  game.player.alive = false;
  // the one word on the red field has nothing under it
  stopMusic();
  sfx.lose();
}
