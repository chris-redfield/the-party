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

**The city is cut, not ruled.** It is one square of ground, and it is cut in
half, and each half is cut in half, until no piece is big enough to cut again
— binary space partitioning. Every cut leaves a road behind it, and the pieces
that survive uncut are the blocks. Nothing is on a grid: blocks run from about
240 pixels across to nearly a thousand, the roads inherit the shape of the
tree — the first cuts are wide avenues with a twin centre line running the
height of the city, the last are narrow lanes a block and a half long — and
most junctions are T-shaped because that is what halving a rectangle gives
you.

**Some of the cuts are then undone.** Coming back up the tree, a cut whose two
halves both came out in one piece may be cancelled: its road is never laid and
the two become one block. That is where the big blocks come from, and it is
what stops the whole thing reading as a lattice.

**A big block is not one big building.** Its core is cut again, without roads
this time, into plots — and a plot is a house, sharing its party walls with
the next one. Each carries its own colour, its own height and its own roofline,
so a block reads as a row of houses rather than a slab. Only the houses along
the front of a block get a door, set into the south facade, because a door in
the middle of a block is a door nobody can knock on. That comes out at about
eighty blocks, a hundred and fifty buildings and a hundred and twenty-five red
doors. Exactly one of them, chosen at random each night, is the party.

**The layout never changes.** It is cut from `CITY_SEED` in `src/config.js`,
which is a constant, so the city is built from scratch on every reload and
comes out the same city every time — the one you learned last night.
`?citySeed=anything` cuts you a different one. What the night's own seed
decides is what goes *in* it: which door is the party, what hangs beside each
one, and where everybody is standing.

**Bat form costs NIGHT** (the purple bar). When NIGHT runs dry the wings start
billing you in BLOOD instead, which is the whole tragedy of the design.

A vampire does not grow wings, he stops being there: the change is struck on
the spot as a poof of smoke, which stays where it happened while the bat
leaves it. There is not a transparent pixel in it, and it never fades, thins
or shrinks away — it is solid, it is still moving, and then it is simply not
there, the way a sprite animation ends on its last frame.

**The street is children.** There are no adults out here at all — the grown-ups
are all indoors, behind all those doors, handing out fun-size somethings.
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

No two blocks share a south-west corner, so district + avenue + street lands
you on exactly one block; the decoration then picks out which of that block's
doors it is, which is why **no two doors on the same block hang the same thing
beside them**. Every fact narrows the minimap, and the map counts the doors
still standing. The avenues and streets are the roads the cut left behind,
numbered from the west and from the north — there are a few dozen of each and
they are not evenly spaced, so the minimap prints the address of the block you
are standing on.

### The hourglass

**There are no digits on the clock, because there is no clock.** The only thing
telling you how much night is left stands in the top right corner: an hourglass
made out of bone, with a skull for a cap and the sand running out between its
teeth. The top bulb is the night — violet sand, a few stars in it, and a moon
standing in the middle. The bottom bulb is what the night turns into.

It is the same sand. The level in the top falls past the moon and eats it away
grain by grain, and those grains come through the neck and build a sun back up
in the bottom, from the tips of its lowest rays to the top of the disc. Half a
moon and half a sun is three in the morning. No moon and a whole sun is 6:00
AM. In the last hour the glass starts to crack, the sun goes white, and the
skull's eye sockets catch the light that is coming for you.

`GLASS_UNIT` in `src/config.js` is how big one of its art pixels is, and
`GLASS_CLOCK_TEXT` puts the digits back underneath it if you want them.

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
- the yellow markings at the junctions burn off the asphalt and come back up
  as a cross, upside down
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

The city is flat. There is no lighting in it at all - no pools under the
lamps, no bloom off a lit window, no soft shadow under a parapet, not one
gradient. Every surface is a solid colour, and where a surface has to read as
having a second face - the side of a kerb, the dark a building puts on the
pavement, the underside of a sill - that face is another solid colour sitting
hard-edged next to it. All of it is in `src/scenery.js`, which draws the
ground, the buildings, the doors, the decorations and the lamps, and knows
nothing about the game.

**The one thing that is not flat is the material.** Every surface carries a
texture: grit on the asphalt, dust on the concrete, gravel on a roof, a brick
bond or rendered plaster on a facade, and a slow blotchy weathering over all
of it. They are neutral light-and-dark overlays with no colour of their own,
so they tint themselves against whatever is underneath, survive the drain to
grey without a second copy, and are the only transparency in the file. They
are locked to the world rather than the screen, so the road does not swim when
the camera moves or shrink when you zoom.

**The ordinary city is a colourful night, not a grey one.** The whole left
column of the palette, and the colours the city generator picks for its
blocks, go through `saturate()` once at load; `SATURATION` in `src/palette.js`
is the dial. The right column never does - what a vampire sees has no hue in
it anywhere, by design.

**Two cities, one table.** The palette is `src/palette.js`: a left column for
what anybody sees and a right column for what a vampire sees, lerped every
frame into the live palette `C`, so nothing downstream has to know which mode
it is in. There are two readings of how far through the changeover we are:
`MIX.vision`, the true continuous one, which everything alive is drawn from,
and `MIX.scene`, the same number snapped to `VISION_STEPS` stages, which the
city is drawn from. Doors stay red in both; `COLOR_DOORS` greys them out. The
living are drained by drawing a cached greyscale twin of the sprite over the
top - same silhouette, so it reads as desaturation.

Nothing in the city fades between the two states, because nothing in the city
uses opacity. A street lamp is a lamp below half way through the changeover
and a torch above it, and it steps from one to the other. The upside-down
cross arrives by having its colour come up out of the asphalt over the stages,
not by fading in over it.

**The cross.** Saint Peter's: a Latin cross stood on its head, so the long
shaft runs up and the short stub hangs below the bar, with all four ends
capped. The shaft lies exactly along the vertical lane markings and the bar
exactly along the horizontal ones, and it is opaque, so the paint it burns off
simply stops being there — on an avenue that is a twin centre line rather than
a single one, so the shaft is thicker there to cover both. It is drawn over
the finished street rather than into it, because the shaft is longer than the
junction it stands in and runs up the road past the block above - baked into
that block's tile it would be cut off at the tile's own edge, which is exactly
what it did.

**Not every junction gets one.** A cross needs road above it to stand its
shaft in, so it only goes where the road carries on north far enough - at a
crossroads, and at any T that opens that way. And because a cross is most of
three hundred pixels tall while the junction under it is a fraction of that,
two junctions close together would have one cross growing up through the
next one's stub. Where a pair would touch, only the wider one is burned: two
of them fighting reads as a drawing fault rather than as something coming up
out of the road. Of about a hundred and thirty junctions in the city, a
hundred and four end up with a cross.

**A patch of ground never changes**, so the city is cached in fixed 512-pixel
square tiles and stamped after that: the whole road surface costs one
`drawImage` per tile instead of two hundred fills, which is what pays for the
detail in it. The tiles are a rendering lattice and nothing else — blocks and
roads are any size and straddle them freely, so a tile draws whatever overlaps
it and lets its neighbour draw the rest. The cache is thrown away when the zoom
changes or the changeover moves to its next stage - the only two things that
can alter it - and tiles that go off screen are dropped, because a tile is a
megabyte. Buildings are not cached, so they are culled one at a time rather
than a block at a time: a block a thousand pixels wide runs off both sides of
the screen at once. Windows are cached the same way, at the exact size they will be
stamped at so they are never scaled, and stamped forty times a frame.
`PARTY.bench()` reports what a frame of city costs.

The people are not part of any of this. `drawSprite` turns image smoothing off
for exactly as long as it takes to stamp one down, so the trick-or-treaters
stay pixel art whatever the city does around them.

`LIGHTING` still exists and still turns on a full-screen darkness-and-glow
pass over the finished frame, which does light the people as well. It is off.
`DAWN_TINT` controls the sky going peach after 4:30 AM, kept separate because
it is the timer rather than scenery mood.

`VISION_SECONDS` and `VISION_FADE` tune the cat's gift, `VISION_TAPER` is the
fraction of it spent wearing off, `VISION_BLEED` the length of the pour and
`CAT_TOUCH` how close you have to pass, `VISION_STEPS` how coarsely the city
steps between the two palettes. The blood is a pure overlay in `drawBleed` -
it accelerates the way a falling thing does, covers for a beat and fades out,
so nothing has to be timed against it. `REVEAL` is how far the changeover has
to have gone before a monster drops its costume - the picture and the `[E]`
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
src/city.js         the cut: BSP into blocks, blocks into buildings, plus
                    walkability, crossings, junctions, doors and districts
src/entities.js     spawning and behaviour for kids / monsters / cats.
                    a monster carries two looks: `disguise` and `spec`
src/player.js       movement, bat form, the candy speed penalty
src/hints.js        FACT_KEYS - the facts, and the dialogue around them
src/game.js         state machine: clock, interactions, win and loss
src/palette.js      the ordinary / vampire-vision colour table, and the mix
src/scenery.js      the city: asphalt, kerbs, buildings, doors, decorations,
                    street lamps. flat, textured, no living thing.
src/render.js       camera, the draw order, the people, and the effects
src/hud.js          vitals, minimap, the deck of tips, title and ends
src/hourglass.js    the clock, which is a moon being ground into a sun
src/audio.js        procedural sound - no audio files
src/sprites.js      PLACEHOLDER ART. self-contained on purpose.
src/input.js
src/main.js         loop and wiring
```

`src/sprites.js` is deliberately the only file that knows what anybody looks
like. It builds every character out of small colour grids at load time and
caches the result. To swap in real art, replace `personSprite`, `catSprite` and
`batSprite` with something that returns a canvas or image with `anchorX` /
`anchorY` set to the sprite's feet, and nothing else has to change.

## Tinkering

The dials for the cut are all in `src/config.js`. `LOT_MIN` / `LOT_MAX` are
how small and how large a piece may be before it must be cut again, `LOT_STOP`
is the chance of leaving a cuttable piece alone, `LOT_JITTER` is how far off
centre a cut may land (0 halves everything and gives you a grid), `LOT_ASPECT`
is when a piece is oblong enough to be cut the long way, and `LOT_MERGE` /
`LOT_MERGE_MAX` govern putting the pieces back together. One level down,
`PLOT_MIN` / `PLOT_MAX` and `PLOT_DEEP` / `PLOT_DEEP_MAX` are the frontage and
the depth of a single building, `PLOT_STOP` how often a plot is left whole,
and `WALL_MIN` / `WALL_MAX` the range of building heights that gives a block
its skyline. `ROAD_WIDTHS` is road width by depth of cut, `CITY_RIM` the ring
road round the outside.

`?seed=anything` in the URL pins the night, so you can replay the same one.
`?citySeed=anything` cuts a different city; without it the layout is always
the one in `CITY_SEED`.

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
PARTY.bench()      // ms a frame of city costs
PARTY.game         // everything
```
