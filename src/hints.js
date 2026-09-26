import { DISTRICTS } from './city.js';

// The facts that, taken together, pin down exactly one door in the city.
// Every block has one door, so district + avenue + street is already an
// address; the decoration is how you recognise the place if you stumble on it
// before you know where you are.  (Door colour used to be a fact here.  Now
// every door is the same red, so it stopped telling you anything.)
export const FACT_KEYS = ['district', 'col', 'row', 'deco'];

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function factText(key, party) {
  switch (key) {
    case 'district': return `it is somewhere in ${DISTRICTS[party.districtIdx].name}`;
    case 'col': return `it is on ${ordinal(party.cx + 1)} Avenue`;
    case 'row': return `it is on ${ordinal(party.cy + 1)} Street`;
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
    case 'col': return `${ordinal(party.cx + 1)} Ave`;
    case 'row': return `${ordinal(party.cy + 1)} St`;
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
