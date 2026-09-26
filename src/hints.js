import { DISTRICTS } from './city.js';
import { GRID } from './config.js';

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
const FAKE_LINES = [
  'DUUUDE. Sick fangs. Where did you get those, the mall?',
  'Bro, is that eyeliner? That is definitely eyeliner.',
  'My roommate is a vampire too. He works in crypto.',
  'Can you do the accent? Do the accent!',
  'I have been drinking the red punch all night. I feel AMAZING.',
  'Hey, sunglasses at night! Like the song! Do you know the song?',
  'My contacts are killing me. How do you keep yours in?',
  'Do you want a Twix? I have like nine hundred Twix.',
  'Is this a costume contest thing? Are you winning?',
  'You should smile more, man. It is Halloween.',
];
const FAKE_WITCH_LINES = [
  'I made this hat myself. With a glue gun. And rage.',
  'I do tarot on the internet. Want a reading? It is forty dollars.',
  'The moon is in something. Cancer? Is cancer a moon thing?',
  'My broom is from a craft store and honestly it sweeps great.',
];
const RUMOR_PREFIX = [
  'Okay so I heard',
  'My cousin SWEARS',
  'Some guy in a Scream mask told me',
  'The lady with the fog machine said',
];

export function makeRumor(rng, city) {
  // a plausible but wrong fact - the player has no way to tell from the words
  // alone, only from noticing the speaker has a shadow.
  const key = rng.pick(FACT_KEYS);
  const fakeParty = {
    districtIdx: rng.int(0, DISTRICTS.length - 1),
    cx: rng.int(0, GRID - 1), cy: rng.int(0, GRID - 1),
    deco: rng.pick(city.doors).deco,
  };
  return `${rng.pick(RUMOR_PREFIX)} ${factText(key, fakeParty)}.`;
}

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

export function fakeLine(rng, kind) {
  return kind === 'witch' ? rng.pick(FAKE_WITCH_LINES) : rng.pick(FAKE_LINES);
}

export function catLine(rng) { return rng.pick(CAT_LINES); }
