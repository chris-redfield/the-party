// ---------------------------------------------------------------------------
// THE PARTY - global tuning constants
// ---------------------------------------------------------------------------

// --- world geometry (all values in "world pixels") -------------------------
// The city is not a grid.  It is one rectangle cut in half over and over -
// binary space partitioning - and every cut leaves a road behind it.  What
// survives uncut is a block: a building core with a sidewalk ring around it,
// and a road on all four sides.  Blocks therefore come in every size between
// LOT_MIN and roughly twice that, and the roads inherit the shape of the
// tree.  See the top of src/city.js.
//
//   +--------------------------------------------------+
//   |  road                                            |
//   |   +------------------------+   +--------------+  |
//   |   | walk                   |   |              |  |
//   |   |   +----------------+   |   |   a smaller  |  |
//   |   |   | building core  |   |   |   block      |  |
//   |   |   +----------------+   |   |              |  |
//   |   +------------------------+   +--------------+  |
//
export const WORLD = 5120;           // the city is 5120 x 5120
export const WALK = 64;              // sidewalk band, inside every lot edge

// The ground is cached in fixed square tiles.  This is a rendering lattice
// and nothing else - no block, road or door is aligned to it.
export const TILE = 512;
export const TILE_N = WORLD / TILE;

// --- the cut ---------------------------------------------------------------
// CITY_SEED is deliberately a constant.  The city is generated from scratch
// on every reload, and comes out the same city every time; `?citySeed=` in
// the URL will cut you a different one.  The night's own seed decides what
// goes *in* it - which door is the party, what hangs beside each one.
export const CITY_SEED = 0x50415254;   // "PART"
export const CITY_RIM = 132;           // ring road around the whole city

// Cutting the city.  The cut runs deep and leaves small pieces, and then
// some of them are put back together on the way out - see LOT_MERGE.
export const LOT_MIN = 240;            // no piece is cut smaller than this
export const LOT_MAX = 460;            // ... and one bigger than this is cut again
export const LOT_STOP = 0.10;          // chance of leaving a cuttable piece uncut
export const LOT_JITTER = 0.9;         // 0 halves every piece, 1 cuts anywhere
export const LOT_ASPECT = 1.5;         // cut the long way once a piece is this oblong
// Putting them back.  Coming back up the tree, a cut whose two sides both
// came out as single pieces may be undone: the road between them is never
// laid and they become one block, big enough to hold a row of buildings.
// This is what stops the city reading as a lattice - it is the difference
// between "every block is a bit different" and "that block is a superblock".
export const LOT_MERGE = 0.6;
export const LOT_MERGE_MAX = 1000;     // but nothing merges into a monster

// --- the buildings on a block ----------------------------------------------
// The same cut again, one level down and with no roads in it: a block's core
// is divided into plots, and every plot is a building sharing its party walls
// with the next.  Only the plots along the south edge get a door, because a
// door in the middle of a block is a door nobody can knock on.
export const PLOT_MIN = 168;           // narrowest frontage
export const PLOT_MAX = 400;           // widest before it is divided again
export const PLOT_DEEP = 208;          // shallowest building
export const PLOT_DEEP_MAX = 430;
export const PLOT_STOP = 0.18;
// Each building carries its own height, so a block of them has a skyline.
// Raised 20% from 72/108: the old facades were short enough that a two-storey
// front had nowhere to put the upper row of windows except on top of the
// door, and a taller wall gives the whole row somewhere to go.  Note this is
// only HALF the fix - see TWO_ROW_MIN in scenery.js for why height alone
// cannot do it (at +20% a third of the doors still clashed, and the height
// that did clear it on its own made every building in the city two-storey).
export const WALL_MIN = 86;
export const WALL_MAX = 130;

// Road width by depth of the cut: the first cuts are avenues the height of
// the city, the last are lanes a block and a half long.
export const ROAD_WIDTHS = [176, 152, 128, 112, 96];
export const CROSS_W = 48;             // width of a painted pedestrian crossing

// --- the upside-down cross --------------------------------------------------
// How big the figure that burns out of a junction is, against the size it was
// drawn at originally.  It is scaled as a whole, so it keeps its proportions.
export const CROSS_SCALE = 0.8;
// It must never reach the kerb: a cross touching the pavement reads as a
// painted road marking that has come loose.  This is the gap it keeps from
// the sidewalk on every side, and it wins over CROSS_SCALE at a tight
// junction - a cross in a narrow lane comes out smaller still.
export const CROSS_CLEAR = 10;

// --- rendering --------------------------------------------------------------
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const PX = 2;                 // world pixels per art pixel
export const ZOOMS = [1, 1.5, 2];
export const DEFAULT_ZOOM = 1;       // index into ZOOMS -> 1.5x

// --- scenery lighting -------------------------------------------------------
// false: the city is painted flat and the palette carries the night on its own.
// true: re-enables the radial street-lamp / darkness pass in render.js.
export const LIGHTING = false;
// The sky going peach after ~4:30 AM is a gameplay signal, not scenery mood,
// so it survives LIGHTING being off.  Set false for a completely flat screen.
export const DAWN_TINT = true;

// Doors are all the same blood red.  Set this false to grey them out.
export const COLOR_DOORS = true;

// --- vampire vision ---------------------------------------------------------
// The city is ordinary and colourful to ordinary eyes.  A black cat will lend
// you the other way of looking at it: everything drains to grey, every light
// burns red, and the things that were always standing on the pavement become
// visible.  It does not last.
export const VISION_SECONDS = 30;
export const VISION_FADE = 1.2;        // seconds to bleed IN at the start
// The last 30% of it is spent bleeding back out: the colour creeps in, the
// torches gutter, the monsters sink back into the crowd.  At zero you are all
// the way back to ordinary sight.
export const VISION_TAPER = 0.30;
export const VISION_WARN = VISION_SECONDS * VISION_TAPER;   // HUD starts flashing
// The cat's gift arrives as blood running down the screen: it pours in from
// the top on dripping runs, covers everything for a beat, and then slides off
// the bottom - and the city changes as it goes, not behind it.
export const VISION_BLEED = 1.5;
// Where in the pour the sheet stops holding and starts leaving, as a fraction
// of VISION_BLEED.  drawBleed's own timing.
export const VISION_BLEED_GO = 0.72;
// How much of the pour the changeover WAITS OUT before the city starts
// turning, as a fraction of VISION_BLEED.  This is the one dial for it.
//   0     the city turns under the blood and is done before it lifts
//   0.36  turns while the sheet is still coming down, most of the way through
//         by the time it leaves, finished just after  <- here
//   0.72  holds until the sheet starts to go, then turns in the open
export const VISION_WAIT = 0.36;
export const VISION_DELAY = VISION_BLEED * VISION_WAIT;       // ~0.54 s
// how much of the changeover has to have happened before a monster stops
// looking like a child - the prompt and the picture use the same number
export const REVEAL = 0.5;
// The city does not change over smoothly.  The scenery - palette, buildings,
// torches, the crosses at the junctions - snaps between this many fixed
// stages instead of sliding, so the street comes back in jerks.  The people
// are not on this clock: they fade properly, because a stepped person reads
// as a dropped frame rather than as a change in the world.
//
// Against the wear-off this works out at a jump roughly every half second.
// Fewer stages is nastier: each jump is bigger and lands less often.
export const VISION_STEPS = 18;
export const CAT_TOUCH = 26;           // walk this close and the cat does it

// --- the hourglass ----------------------------------------------------------
// The clock is not a clock.  It is an hourglass with the moon in the top bulb
// and the sun in the bottom, and the same sand makes one out of the other.
export const GLASS_UNIT = 4;          // px per art pixel of the hourglass
// The digits are gone on purpose.  Set true to put a readout back under it.
export const GLASS_CLOCK_TEXT = false;

// The end of a night is one phrase on a flat red field and nothing else - no
// prose, no tally of how it went.  Set true to put the stats back under it.
// --- the screen before the screen -------------------------------------------
// The studio label that BATIDAO DE COCO opens on, in this game's colours.  The
// numbers are that game's own, so the two open on the same beat: a press is
// not taken for the first quarter second, it holds for three, and it goes down
// into the title over six tenths.  `on` false and the game opens on the title
// card the way it used to.  See src/label.js.
export const LABEL = {
  on: true,
  hold: 3.0,        // seconds up before it leaves by itself
  fadeIn: 0.4,      // up out of black
  fadeOut: 0.6,     // down into the title card
  arm: 0.25,        // before a press counts
  frame: 0.105,     // one photograph of the crawl - about 9.5 a second
  wide: 0.52,       // how much of the screen the label spans
};

export const END_STATS = false;

// --- what is behind the right door ------------------------------------------
// The winning card is not flat: it is the party itself, a room of bats hanging
// in a row and swaying, flattened to four tones of the card's own blood and
// dropped onto the game's art pixel.  Set WIN_BATS false and the win goes back
// to the flat red card the two losses land on.
export const WIN_BATS = true;
// `assets/bats-win.png`: the short strip.  These only change if it is cut again
// - preview/quantize.py prints them.
export const WIN_BATS_W = 426;         // one frame, in art pixels (x3 on screen)
export const WIN_BATS_H = 240;
export const WIN_BATS_N = 54;          // four and a half seconds of it, looping
export const WIN_BATS_COLS = 8;        // how the strip is wrapped in the sheet

// Everything about how the ending PLAYS lives in one mutable object rather
// than in constants, because `preview/ending.html` runs the game's own
// drawEnd() and turns these live - which is the only way a preview of the
// ending can be trusted to be the ending.  The values written here are the
// shipped ones; nothing in the game writes to it.
export const END = {
  // 'video' plays assets/bats-ending.mp4 (39 s), 'sheet' the short strip.
  // A missing or unplayable video falls back to the strip, and a missing
  // strip to the flat red card.
  source: 'video',
  fps: 12,          // the strip's own rate; the video carries its own
  textAt: 1.4,      // seconds of bats before the phrase arrives
  // How the phrase sits on the bats - 'invert' cuts it out of whatever it
  // lands on, 'outline' sets it in black haloed in the blood.  See drawEndCard.
  type: 'outline',
  // How big the phrase is set on the winning card, as a fraction of the size
  // it would otherwise fill.  1 is as large as it will go, which is what the
  // two losing cards still do - they have nothing behind them to share the
  // screen with, and this one does.
  size: 0.85,
  // The video comes back off the encoder soft: h264 lands only half a per cent
  // of its pixels exactly on one of the four tones, and a flat palette with
  // ringing on every edge is the one thing this game's look cannot carry.  So
  // each frame is snapped back onto the four before it is blown up - at art
  // size, which is a fiftieth of the pixels doing it after.  Turn it off to
  // see what the encoder actually gives back.  The strip needs none of this.
  snap: true,
};
// The four tones, which are what preview/quantize.py wrote: the card's black,
// the card's blood, and two even steps between them.  If the clip is ever cut
// with a different --tones, these change with it.
export const END_TONES = ['#0b0b0b', '#4c0d09', '#8e1008', '#cf1206'];

// --- the night --------------------------------------------------------------
// Six in-game hours in six real minutes: one real second is one game minute,
// which is a clock you can feel.  It was twelve, and halving it halves every
// real-time budget in the game with it - how far you can walk, how many cats
// you can find, how many of the five tips you can actually collect.  The
// things that burn per real second (BLOOD_DRAIN, MANA_REGEN) now cost half as
// much over a whole night; the things measured in seconds (VISION_SECONDS)
// are now twice the share of it.
export const NIGHT_SECONDS = 6 * 60;       // 6 real minutes ...
export const NIGHT_MINUTES = 6 * 60;       // ... = midnight -> 6 AM
export const MIN_PER_SEC = NIGHT_MINUTES / NIGHT_SECONDS;   // 1.0

// --- the vampire ------------------------------------------------------------
export const BLOOD_MAX = 100;
export const MANA_MAX = 100;
export const WALK_SPEED = 132;             // world px / sec
export const BAT_SPEED = 300;
export const BAT_TIME = 0.55;              // seconds airborne
export const BAT_MANA = 25;
export const BAT_POOF = 0.35;              // how long the smoke hangs about
export const BAT_BLOOD = 14;               // paid instead when mana is short
export const MANA_REGEN = 7.5;             // per second
export const BLOOD_DRAIN = 5 / 60;         // per second (~1.8 per game-hour)

// --- candy ------------------------------------------------------------------
export const CANDY_PER_WRONG_DOOR = 3;
export const PUNCH_BLOOD = 12;             // blood punch at the wrong party
export const BUMP_BLOOD = 3;
export const BUMP_STAGGER = 0.32;      // seconds of being stuck in a child
export const BUMP_ANIM = 0.30;         // length of the knocked-back hop
export const BUMP_SHAKE = 0.55;
export const FOLLOW_THRESHOLD = 5;         // candy needed before kids tail you
export const CANDY_PER_FOLLOWER = 5;
export const MAX_FOLLOWERS = 8;
export const MIN_SPEED_MULT = 0.42;

// --- population -------------------------------------------------------------
export const KIDS_PER_BLOCK = [3, 6];
// Real monsters, standing on the pavement all night dressed as trick-or-
// treaters.  There are no adults out here, so these are the only things that
// know anything - but a monster you trip over on the way to the next one is
// not worth finding, so there is at most ONE to a block and plenty of blocks
// with none.  This is a chance rather than a range precisely so the cap is
// structural: there is no number you can raise here that puts two on a block.
// It is scaled by how much pavement the block has, so the smallest blocks are
// the emptiest ones; most blocks are big enough that the scale tops out.
export const MONSTER_CHANCE = 0.5;         // per block, before the size scale

// Half of them lie.  A liar hands you a fact that is real somewhere else in
// the city and wrong about the party, in exactly the words the truth would
// have used - so no single tip is worth anything, only a tip standing next to
// another tip that agrees with it.  0 puts the old honest city back.
export const LIAR_CHANCE = 0.5;

// And you only get five of them. Five is four facts and one second opinion:
// exactly one thing you have been told can ever be corroborated in a night,
// and you do not get to choose which - the monster picks whichever fact you
// have heard least about. After the fifth card nobody will tell you anything
// else, however many monsters you find.
export const MAX_TIPS = 5;
export const CAT_CHANCE = 0.45;            // per block

// A cat does not go from sitting to walking.  It gets up, and it stands there
// on all four feet for a second or so looking at nothing, and then it goes -
// which is the whole of what makes a drawn animal read as an animal rather
// than as a sprite being moved about.  Both ends of the range are used: a
// street of cats that all hold it for exactly a second looks synchronised.
export const CAT_RISE = [1.0, 1.5];        // seconds up before it moves
// Its walk is paced by the pavement rather than by the clock: this many
// pixels of ground per change of pose, so a slow cat plods and a quick one
// does not moonwalk.
export const CAT_STRIDE = 7;

// --- the shadow beasts -------------------------------------------------------
// One for every trick-or-treater, and you never see them unless a cat has lent
// you its eyes.  They keep station on their child rather than walking, so the
// only number they need is the distance at which keeping station gives way to
// simply being there - past this it has been out of the simulation and is
// catching up from wherever it was left, which must not be a flight down the
// street.
export const BEAST_SNAP = 90;
// How much room a beast leaves around a person.  It is measured from the
// middle of one to the middle of the other, and a child and a beast are each
// about eight art pixels either side of their middle, so at 20 the two
// drawings have clear ground between them.  This is a keep-out and not a
// preference: the beast is pushed out of anybody it would stand on, its own
// child included, which is why a pack of four children ends up ringed by
// their beasts rather than wearing them.
export const BEAST_KEEP = 20;

// --- pumpkins in the way -----------------------------------------------------
// Somebody has left them out on the pavement and on the crossings.  They are
// about as big as a trick-or-treater and they are solid, but they never take
// the whole width of anything: a pavement pumpkin sits off to one side and a
// crossing one hugs its edge, so there is always a lane past it.  They cost
// you nothing but the two steps it takes to go round - the wings clear them,
// like they clear everybody else.
export const PUMPKINS_PER_BLOCK = [0, 2];
export const PUMPKIN_CROSSING_CHANCE = 0.22;   // per painted crossing
export const PUMPKIN_R = 20;                   // world px - a child is ~48 across
export const PUMPKIN_BLOCK = 22;               // how close you may get to one
export const PUMPKIN_LAT = 16;                 // how far off the middle of the pavement
export const PUMPKIN_CROSS_LAT = 12;           // ... and off the middle of a crossing
export const SIM_RADIUS = 1400;            // entities further away idle

// --- the soundtrack ---------------------------------------------------------
// The one thing in this game that is a file rather than code.  It is streamed
// through an <audio> element into the same master gain as the procedural
// noise, so M mutes it with everything else, and it loops - it is three and a
// half minutes against a six minute night.
//
// MUSIC_DUCK is the important one.  The bass leaking out of the real party is
// now the only thing the world itself will tell you, so the music gets out of
// its way: at the door the track is down by this much and the bass is what
// you hear.  Turn MUSIC off for the old purely procedural build.
export const MUSIC = true;
export const MUSIC_URL = 'assets/ost/Game.m4a.mp4';
export const MUSIC_GAIN = 1.0;         // full, before the 0.55 master gain
export const MUSIC_DUCK = 0.55;        // how far it drops when you are on top of the party

// --- party proximity --------------------------------------------------------
export const BASS_RADIUS = 900;            // you start to feel the bass

// --- the ink the city is drawn in -------------------------------------------
// The buildings used to be crisp axis-aligned rectangles with a noise texture
// over them, which put the city in a different medium from the people
// standing on it.  These are the dials on the drawn line that replaced it -
// see src/ink.js for what each one is actually doing to the stroke.
//
// It is a live object rather than four consts because the whole point is to
// be able to sit in the game and turn it: `PARTY.ink({weight: 3})` at the
// console, or `PARTY.ink(false)` to put the old crisp city back for a
// side-by-side.  Nothing here is on a timer and nothing here is random per
// frame - see the note at the top of ink.js.
export const INK = {
  on: true,
  weight: 2.3,      // screen px at z=1.  The art's line is heavy; so is this.
  wobble: 1.5,      // how far the stroke wanders off true, screen px at z=1
  over: 3.0,        // how far a corner runs past its neighbour
  // How much of the old surface noise survives underneath.  The drawings are
  // flat colour, so the city has to be nearly flat too or the line is the
  // only thing that matches and the fill still gives it away.  0 is fully
  // flat, 1 is the old gritty wall.
  grit: 0.22,
};

// --- what is in the glasses --------------------------------------------------
// The two vitals are chalices now, and the drink in them moves.  These are the
// dials on that movement - live, like INK above, so they can be turned at the
// console while watching it: `PARTY.chalice({rest: 3})`.
export const CHALICE = {
  // The idle ripple, in px at the glass's nominal 86px height.  This is the
  // one that decides whether the drink reads as liquid when nothing is
  // happening.  Too high and it looks like it is boiling.
  rest: 1.1,
  // How far a hit throws the surface, as a multiple of the ripple.  Losing
  // blood should visibly slap the drink about - that is the whole difference
  // between a glass and a progress bar that happens to be glass-shaped.
  slosh: 5.5,
  // how fast a slosh settles back down, in units per second
  settle: 1.6,
};
