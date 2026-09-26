import { DISTRICTS } from './city.js';

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
export const FACT_KEYS = ['district', 'avenue', 'street', 'deco'];

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function factText(key, party) {
  switch (key) {
    case 'district': return `it is somewhere in ${DISTRICTS[party.districtIdx].name}`;
    case 'avenue': return `it is on ${ordinal(party.block.avenue)} Avenue`;
    case 'street': return `it is on ${ordinal(party.block.street)} Street`;
    case 'deco': return `${party.deco.name} hangs by the door`;
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

export function cardFact(key, party) {
  if (key === 'deco') return DECO_TOKEN[party.deco.key] || party.deco.key;
  return shortFact(key, party);
}

export function shortFact(key, party) {
  switch (key) {
    case 'district': return DISTRICTS[party.districtIdx].name;
    case 'avenue': return `${ordinal(party.block.avenue)} Ave`;
    case 'street': return `${ordinal(party.block.street)} St`;
    case 'deco': return party.deco.name;
  }
  return '';
}

// --- flavour ----------------------------------------------------------------
const REAL_VAMP_OPENERS = [
  'Nice shades. Ironic.',
  'Ugh, finally, someone who is actually dead.',
  'You are late and you are lost. Classic.',
  'Keep the cape out of the gutter, amateur.',
  'I already danced. I am going home to my dirt.',
];
const REAL_WITCH_OPENERS = [
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
export function realLine(rng, kind, key, party) {
  const opener = kind === 'witch' ? rng.pick(REAL_WITCH_OPENERS) : rng.pick(REAL_VAMP_OPENERS);
  return `${opener} Listen: ${factText(key, party)}.`;
}

export function exhaustedLine(rng, kind, party, dist) {
  const near = dist < 600 ? 'You are practically on top of it.'
    : dist < 1600 ? 'You are close. Use your ears.'
    : 'You are nowhere near it. Move.';
  return kind === 'witch'
    ? `I have told you everything I know. ${near}`
    : `I already told you. ${near}`;
}

export function catLine(rng) { return rng.pick(CAT_LINES); }

/** "12th Ave & 7th St" - the address of any block, printed under the map. */
export function addressOf(block) {
  return `${ordinal(block.avenue)} Ave & ${ordinal(block.street)} St`;
}
