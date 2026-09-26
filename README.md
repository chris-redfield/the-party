# THE PARTY

A Halloween game. You are an extremely cool vampire — the kind who wears
sunglasses at night — and you have lost the invitation to the monsters' party.
You know it is happening. You know it is in this city. You do not know which
door. It is midnight. At 6:00 AM the sun comes up and turns you into a small
pile of something the street sweeper will not even notice.

Six in-game hours run in **twelve real minutes**.

## Running it

It is plain HTML5 + ES modules, no build step, no dependencies. Because it uses
ES modules it must be served over HTTP (opening `index.html` off the disk will
fail on CORS):

```bash
cd the-party
python3 -m http.server 8080
# then open http://localhost:8080
```

Any static server works. Drop the folder on itch.io / GitHub Pages as-is.

## Controls

| key | |
|---|---|
| `WASD` / arrows | walk — sidewalks and crosswalks only |
| `SPACE` | bat form: fly over children, and over roads |
| `E` | knock on a door / talk to a monster you can actually see |
| `Q` | dump your candy on the pavement |
| `ESC` / `P` | pause · hold `ESC` + `R` for a fresh night |
| `M` | mute · `[` `]` zoom |
| click a card | pull a buried tip back to the front of the deck |

## The rules underneath

**The city** is 10×10 blocks. Each block is a building with a sidewalk ring
around it and a single door, set into the south facade — the only wall the
camera actually shows you. That is 100 doors, all of them the same red. Exactly
one, chosen at random each night, is the party.

**Bat form costs NIGHT** (the purple bar). When NIGHT runs dry the wings start
billing you in BLOOD instead, which is the whole tragedy of the design.

A vampire does not grow wings, he stops being there: the change is struck on
the spot as a poof of smoke, which stays where it happened while the bat
leaves it. There is not a transparent pixel in it, and it never fades, thins
or shrinks away — it is solid, it is still moving, and then it is simply not
there, the way a sprite animation ends on its last frame.

**The street is children.** There are no adults out here at all — the grown-ups
are all indoors, behind the hundred doors, handing out fun-size somethings.
Everything walking the pavement is a trick-or-treater, and so is everything
standing still on it.

**Children are solid.** They move in packs, and a pack of three or four fills
the pavement end to end. You cannot push through them. That is what the wings
are for. Walking into one costs you blood, knocks you off your feet and stalls
you for a moment, and they shout at you about it.

You cannot tell anything from looking. Every figure on the street is the same
height with the same too-big head, and some of them are not children.

**Wrong doors are the only place candy comes from.** Children never give you
any; they want yours. Knock on a house that is not the party and somebody hands
you three fun-size somethings and a cup of red punch — so a wrong door is
+3 candy and +12 blood. Candy is weight. Past five pieces children start
following you, and every child in your parade makes you slower. `Q` dumps the
bag and the parade goes with it.

**Nobody on the street talks to you.** Children want your candy and have
nothing else to say. The only thing in this city that will tell you where the
party is, is a monster — and see below.

**Four facts pin down one door:** the district, the avenue, the street, and
what is hanging beside the door. Each one you are given is a playing card, and
they stack up bottom left along the axis between you and the screen — newest
lying face up on top, the ones underneath showing only their corner index, the
way a deck does when it is not squared up. Until you have been given anything
the deck is one card, face down. Click any card that is not already on top and
it comes to the front, so you can read whichever one you need; and the deck
stays up while a monster is talking to you, because that is the moment a card
lands on it.

One door per block means district + avenue + street is already a full address;
the decoration is how you recognise the place if you stumble on it before you
know where you are. Every fact narrows the minimap, and when one block is left
the map says so.

### Vampire vision

**You cannot see the monsters.** They have been standing on that pavement all
night, and to ordinary eyes every one of them is another kid in a costume —
same sprite, same silhouette, same solid shove when you walk into one, same
nothing to say. You have walked past a dozen of them already.

**A black cat will lend you the other way of looking.** You do not ask: walk
into one and it decides. Blood comes down over the whole screen — a sheet
pouring from the top on runs of different lengths, each ending in a heavy
rounded drop, with a few already falling free of it. It covers everything, and
then it fades, and what is underneath is not the city it covered. For thirty
seconds:

- the colour drains out of everyone living, and only the monsters keep theirs
- the street lamps turn out to have been torches the entire time
- the yellow markings at every four-way junction burn off the asphalt and come
  back up as a cross, upside down
- the monsters stop pretending: they shed the costume, lift off the pavement,
  cast no shadow, and their eyes light
- the cats go. They are a thing of ordinary sight and the other way of looking
  does not include them, so a cat you have not spent yet is invisible — and
  untouchable — until the colour comes back

Talk to one and you get a real fact. While the vision holds, the monsters near
you also show as pinpricks on the minimap, which is most of how you find one
in the time you have.

Every cat carries the same thing and gives it once.

**It does not switch off, it wears off.** The last 30% of it is spent
bleeding back out — the colour creeping in, the torches guttering, the crosses
sinking back into ordinary road paint, the monsters settling back into the
crowd. Once a monster looks like a child again you cannot talk to it, whether
or not the clock says you have seconds left. At zero you are all the way back
in the ordinary city, and you go and find another cat.

**And the city comes back badly.** The scenery does not slide between the two
palettes, it snaps: the street, the buildings, the torches and the crosses are
drawn from the changeover rounded to `VISION_STEPS` fixed stages, so the world
jerks its way back in about half a second at a time. The people are deliberately
not on that clock — they fade continuously — because a person moving in steps
reads as a dropped frame, while a street doing it reads as the world changing.
Going *in* is smooth either way, because going in is a wall of blood.

**Proximity.** Within about two blocks of the real party you start to hear the
bass, and it gets louder. There is light leaking out around the frame of the
right door as well, but you have to be close to see it — and it is purple,
which in vampire vision makes it the only thing in the world that is neither
grey nor red.

### Look

Ordinary sight is a colourful night city. Vampire vision is the same city
drained to grey with every lit thing burning red. Both are one palette table in
`src/render.js`; the live palette is lerped between the two columns every frame,
which is why nothing downstream has to know which mode it is in. There are two
readings of how far through the changeover we are: `visionMix`, the true
continuous one, which everything alive is drawn from, and `sceneMix`, the same
number snapped to `VISION_STEPS` stages, which the city is drawn from.

Doors stay red in both. `COLOR_DOORS` in `src/config.js` greys them out.

The torches, the junction crosses and the draining of the living are all keyed
to the same `visionMix`, so they arrive and leave together. The living are
drained by drawing a cached greyscale twin of the sprite over the top at
`visionMix` — same silhouette, so it reads as desaturation and costs one extra
canvas per sprite.

The scenery is painted flat — the palette carries the night on its own, with no
street-lamp or darkness pass. `LIGHTING` turns the radial lighting pass back
on. `DAWN_TINT` controls the sky going peach after 4:30 AM, kept separate
because it is the timer rather than scenery mood.

`VISION_SECONDS` and `VISION_FADE` tune the cat's gift, `VISION_TAPER` is the
fraction of it spent wearing off, `VISION_BLEED` the length of the pour and
`CAT_TOUCH` how close you have to pass, `VISION_STEPS` how coarsely the city
steps between the two palettes. The blood is a pure overlay in
`drawBleed` — it accelerates the way a falling thing does, covers for a beat
and fades out, so nothing has to be timed against it. `REVEAL` is how far the changeover
has to have gone before a monster drops its costume — the picture and the `[E]`
prompt read the same number, so you can never talk to something that still
looks like a child. `MONSTERS_PER_BLOCK` is how many of them are out there;
`BUMP_BLOOD`, `BUMP_STAGGER`, `BUMP_ANIM` and `BUMP_SHAKE` tune what it feels
like to be walked into, and `BAT_POOF` is how long the smoke hangs about.

## Source layout

```
index.html          page shell
css/style.css
src/config.js       every tunable number lives here
src/rng.js          seeded PRNG - one seed reproduces a whole city
src/city.js         block geometry, walkability, doors, districts
src/entities.js     spawning and behaviour for kids / monsters / cats.
                    a monster carries two looks: `disguise` and `spec`
src/player.js       movement, bat form, the candy speed penalty
src/hints.js        FACT_KEYS - the facts, and the dialogue around them
src/game.js         state machine: clock, interactions, win and loss
src/render.js       camera, city, and the ordinary / vampire-vision palettes
src/hud.js          vitals, clock, minimap, the deck of tips, title and ends
src/audio.js        procedural sound - no audio files
src/sprites.js      PLACEHOLDER ART. self-contained on purpose.
src/input.js
src/main.js         loop and wiring
```

`src/sprites.js` is deliberately the only file that knows what anything looks
like. It builds every character out of small colour grids at load time and
caches the result. To swap in real art, replace `personSprite`, `catSprite` and
`batSprite` with something that returns a canvas or image with `anchorX` /
`anchorY` set to the sprite's feet, and nothing else has to change.

## Tinkering

`?seed=anything` in the URL pins the city so you can replay the same night.

`dev-harness.html` is a test page that runs the game under scripted keyboard
input, for taking screenshots headlessly. Not part of the game.

From the browser console:

```js
PARTY.reveal()     // learn every fact
PARTY.warp()       // stand outside the real party
PARTY.skipTo(330)  // jump the clock to 5:30 AM
PARTY.vision()     // 30 seconds of vampire vision (or vision(n) for n)
                   // vision(9) or less drops you straight into the wear-off
PARTY.win()        // knock on the right door
PARTY.restart()    // a fresh night
PARTY.game         // everything
```
