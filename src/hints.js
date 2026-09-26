import { DISTRICTS, DECOS } from './city.js';

// The facts that, taken together, pin down exactly one door in the city.
//
// No two blocks share a south-west corner, so the avenue a block backs onto
// plus the street its doors open onto is a unique address - but a block may
// carry a row of houses and so several doors, and the decoration is what
// picks one of them out.  That is why no two doors on the same block hang
// the same thing beside them (src/city.js): the four facts together always
// leave exactly one door standing.  (Door colour used to be a fact here.
// Now every door is the same red, so it stopped telling you anything.)
//
// Avenues and streets are the roads the cut left behind, numbered from the
// west and from the north.  There are a few dozen of each rather than ten,
// because the city is not ruled into ten columns any more - which is why the
// minimap prints the address of the block you are standing on.
//
// What a monster *says* about a fact is a claim, not the fact: half of them
// lie (LIAR_CHANCE).  So nothing downstream reads the answer out of the city
// any more - a tip carries its own value, and the truth is only ever used to
// build one, or to decide what a liar must avoid saying.
export const FACT_KEYS = ['district', 'avenue', 'street', 'deco'];

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

/** What the party's own door would answer, if it were the one talking. */
export function trueValue(key, party) {
  switch (key) {
    case 'district': return party.districtIdx;
    case 'avenue': return party.block.avenue;
    case 'street': return party.block.street;
    case 'deco': return party.deco.key;
  }
  return null;
}

/**
 * Every value a fact actually takes somewhere in this city, cached on the
 * city.  A lie is drawn from here rather than made up, because a lie that
 * names the 90th Avenue of a city with forty avenues is not a lie, it is a
 * bug you can play around.
 */
function factPool(city, key) {
  if (!city._pools) city._pools = {};
  if (!city._pools[key]) {
    const vals = new Set();
    if (key === 'deco') for (const d of city.doors) vals.add(d.deco.key);
    else for (const b of city.blocks) vals.add(b[key]);
    city._pools[key] = [...vals];
  }
  return city._pools[key];
}

/**
 * One thing a monster says.  A liar picks any value except the right one, and
 * says it in exactly the same words the truth would have used - the card it
 * lands on your deck is indistinguishable from an honest one, which is the
 * whole mechanic.
 */
export function makeTip(rng, city, key, lie) {
  const truth = trueValue(key, city.party);
  let value = truth;
  if (lie) {
    const pool = factPool(city, key).filter(v => v !== truth);
    if (pool.length) value = rng.pick(pool);
    else lie = false;                 // nothing else to say: the truth by accident
  }
  return { key, value, lie: !!lie };
}

/**
 * Every block a claim would allow, as a set of block ids - the area the tip
 * paints on the minimap.  Memoised per claim because the map redraws every
 * frame and a claim's area never changes.
 */
export function claimedIds(city, key, value) {
  if (!city._claims) city._claims = new Map();
  const k = `${key}:${value}`;
  let ids = city._claims.get(k);
  if (!ids) {
    ids = new Set();
    for (const b of city.blocks) {
      const ok = key === 'deco'
        ? b.doors.some(d => d.deco.key === value)
        : b[key] === value;
      if (ok) ids.add(b.id);
    }
    city._claims.set(k, ids);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Wording.  All of it takes the claimed value, never the city's answer.
// ---------------------------------------------------------------------------
const DECO_NAME = {};
for (const d of DECOS) DECO_NAME[d.key] = d.name;

export function factText(key, value) {
  switch (key) {
    case 'district': return `it is somewhere in ${DISTRICTS[value].name}`;
    case 'avenue': return `it is on ${ordinal(value)} Avenue`;
    case 'street': return `it is on ${ordinal(value)} Street`;
    case 'deco': return `${DECO_NAME[value] || value} hangs by the door`;
  }
  return '';
}

// What goes in a card's corner index.  The decoration's real wording is a
// sentence and will not fit there, so it gets a token; everything else is
// already short enough to print as it stands.
const DECO_TOKEN = {
  pumpkin: 'a pumpkin', cobweb: 'a cobweb', skeleton: 'a skeleton',
  bats: 'paper bats', ghost: 'a ghost', none: 'nothing at all',
};

export function cardFact(key, value) {
  if (key === 'deco') return DECO_TOKEN[value] || value;
  return shortFact(key, value);
}

export function shortFact(key, value) {
  switch (key) {
    case 'district': return DISTRICTS[value].name;
    case 'avenue': return `${ordinal(value)} Ave`;
    case 'street': return `${ordinal(value)} St`;
    case 'deco': return DECO_NAME[value] || value;
  }
  return '';
}

// --- flavour ----------------------------------------------------------------
// Nothing in here is marked as honest or dishonest.  A liar gets the same
// openers and the same confidence as anybody else; if the flavour gave it
// away there would be no mechanic.
const VAMP_OPENERS = [
  'Nice shades. Ironic.',
  'Ugh, finally, someone who is actually dead.',
  'You are late and you are lost. Classic.',
  'Keep the cape out of the gutter, amateur.',
  'I already danced. I am going home to my dirt.',
];
const WITCH_OPENERS = [
  'Hold still. I am reading you like a receipt.',
  'The cards said a vampire would come whining. Hello.',
  'You smell of panic and cheap hair product.',
  'Six hours. You have less. Listen.',
];
const CAT_LINES = [
  'The cat looks at you the way landlords do.',
  'The cat has been to the party. The cat left early.',
  'The cat does not blink. You blink. You lose.',
];

/** What a monster says when it hands you a card - true or not. */
export function tipLine(rng, kind, tip) {
  const opener = kind === 'witch' ? rng.pick(WITCH_OPENERS) : rng.pick(VAMP_OPENERS);
  return `${opener} Listen: ${factText(tip.key, tip.value)}.`;
}

const NEAR_LINES = [
  'You are practically on top of it.',
  'You are close. Use your ears.',
  'You are nowhere near it. Move.',
];

export function exhaustedLine(rng, kind, dist, liar) {
  let i = dist < 600 ? 0 : dist < 1600 ? 1 : 2;
  if (liar) i = NEAR_LINES.length - 1 - i;   // it has no reason to stop now
  const near = NEAR_LINES[i];
  return kind === 'witch'
    ? `I have told you everything I know. ${near}`
    : `I already told you. ${near}`;
}

// Once you are carrying five of these, nobody adds a sixth.  The line has to
// land as the city being done with you rather than as a menu closing, and it
// is also the last chance to say out loud that the deck is not evidence.
const FULL_VAMP = [
  'You have been told five things tonight. Go and be wrong about one of them.',
  'Five stories in your pocket and you believe all of them. Not my problem.',
  'No. You have had your allowance. Some of us are trying to have a night.',
];
const FULL_WITCH = [
  'Your hands are full of other people\'s stories. I am not adding to them.',
  'Five cards. One of them is a lie and you are still standing here asking me.',
  'I have nothing to add to that pile. Go and knock on something.',
];
export function fullLine(rng, kind) {
  return rng.pick(kind === 'witch' ? FULL_WITCH : FULL_VAMP);
}

export function catLine(rng) { return rng.pick(CAT_LINES); }

/** "12th Ave & 7th St" - the address of any block, printed under the map. */
export function addressOf(block) {
  return `${ordinal(block.avenue)} Ave & ${ordinal(block.street)} St`;
}
