// ---------------------------------------------------------------------------
// THE PARTY - global tuning constants
// ---------------------------------------------------------------------------

// --- world geometry (all values in "world pixels") -------------------------
// A city block cell is laid out like this (cell-local coordinates):
//
//   0 .......128 .....192 .................448 .....512
//   |  road   |sidewalk|   building core     |sidewalk|
//
// The road band sits on the LEFT and TOP edge of every cell, so it is shared
// with the neighbouring cell.  The sidewalk forms a closed ring around the
// building core, which is what the vampire walks on.
export const CELL = 512;
export const GRID = 10;              // 10 x 10 blocks
export const WORLD = CELL * GRID;    // 5120 x 5120
export const ROAD = 128;
export const WALK = 64;              // sidewalk band width
export const CORE0 = ROAD + WALK;    // 192  - core starts
export const CORE1 = CELL - WALK;    // 448  - core ends
export const RING0 = ROAD;           // 128  - sidewalk ring outer edge
export const RING1 = CELL;           // 512
export const CROSS0 = 296;           // crosswalk strip across a road
export const CROSS1 = 344;

// ring centre-line, used to path NPCs around a block
export const RA = RING0 + WALK / 2;  // 160
export const RB = RING1 - WALK / 2;  // 480
export const RLEN = RB - RA;         // 320
export const RPERIM = RLEN * 4;      // 1280

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
// the bottom - by which time the city behind it has changed.
export const VISION_BLEED = 1.5;
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

// --- the night --------------------------------------------------------------
export const NIGHT_SECONDS = 12 * 60;      // 12 real minutes ...
export const NIGHT_MINUTES = 6 * 60;       // ... = midnight -> 6 AM
export const MIN_PER_SEC = NIGHT_MINUTES / NIGHT_SECONDS;   // 0.5

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
// know anything, which is why there are more of them than there used to be.
export const MONSTERS_PER_BLOCK = [0, 2];
export const CAT_CHANCE = 0.45;            // per block
export const SIM_RADIUS = 1400;            // entities further away idle

// --- party proximity --------------------------------------------------------
export const BASS_RADIUS = 900;            // you start to feel the bass
