# THE PARTY

A Halloween game. You are an extremely cool vampire — the kind who wears
sunglasses at night — and you have lost the invitation to the monsters' party.
You know it is happening. You know it is in this city. You do not know which
door. It is midnight. At 6:00 AM the sun comes up and turns you into a small
pile of something the street sweeper will not even notice.

Six in-game hours run in **six real minutes** — one real second is one
game minute.

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

**Somebody has left pumpkins out.** They stand on the pavement and on the
painted crossings, they are about as big as a trick-or-treater, and they are
solid. They are also the only obstacle in the game that does not want
anything from you: walking into one costs no blood, knocks nothing out of your
hands and says nothing. It is in the way, you go round, and the wings clear it
like they clear everybody else.

**None of them ever takes a whole path.** One on the pavement stands off to
one side of it and one on a crossing hugs an edge, half out on the asphalt
where nobody could walk anyway, so there is always a lane past. That is
load-bearing, not politeness: the pavement has to stay one connected piece or
part of the city becomes unreachable on foot, and a crossing is only
`CROSS_W` wide and is the only way over a road. Flood-filling the walkable
city on an 8-pixel grid, over four different nights, says the pumpkins take
about 2% of the pavement and leave it in exactly one piece.

**And they are not cute in the other light.** In ordinary sight a pumpkin is
the same cheerful gourd that sits beside the doors, lit from inside, grinning.
Once the changeover is half done it is a dark thing with a fire in it and a
mouth full of teeth — a hard swap at the halfway mark, the same trick the
street lamps play when they turn out to have been torches all along, because a
pumpkin dissolving into another pumpkin reads as a rendering fault.

**Wrong doors are the only place candy comes from.** Children never give you
any; they want yours. Knock on a house that is not the party and somebody hands
you three fun-size somethings and a cup of red punch — so a wrong door is
+3 candy and +12 blood. Candy is weight. Past five pieces children start
following you, and every child in your parade makes you slower. `Q` dumps the
bag and the parade goes with it.

**Nobody on the street talks to you.** Children want your candy and have
nothing else to say. The only thing in this city that will tell you where the
party is, is a monster — and half of the monsters lie about it. See below.

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
beside them**. The avenues and streets are the roads the cut left behind,
numbered from the west and from the north — there are a few dozen of each and
they are not evenly spaced, so the minimap prints the address of the block you
are standing on.

**Half of them are lying.** A monster is decided a liar or not the night it is
spawned, and it never changes: about one in two of them will hand you a fact
that is true of somewhere else in the city and false about the party. A lie
always names a district, an avenue, a street or a decoration that really
exists — it is never the right one, and it is never a street with no number.
Nothing tells them apart. Same openers, same confidence, same card stock. The
witch is no more honest than the vampire.

So there is no such thing as *what you know* any more, only **what you have
been told**. The deck will happily hold two AVENUE cards that disagree; that
is not a bug in it, that is one of them lying to you, and the game will never
say which.

**You get five tips a night and no more.** Five is the four facts and one
second opinion: exactly one thing you are told can ever be corroborated, and
you do not choose which — the monster picks whichever fact you have heard
least about, so the fifth card falls where it falls. After it, every monster
in the city has the same nothing to say to you, however many you find. The
deck counts itself `n/5` in the corner so you know how many asks you have
left, which is inventory rather than deduction. `MAX_TIPS` is the number.

**Nothing is deduced for you.** The map used to intersect your facts and cross
off every door they excluded. It cannot do that now — with lies in the deck an
honest intersection of everything you have been told is empty nine times in
ten. So the map stops eliminating and starts **shading**: every tip colours in
every block it would allow, the colours stack, and a block three tips agree on
comes up hotter than a block only one mentioned. You read the overlap. A block
nothing has shaded is not a block that has been ruled out — it is a block
nobody has mentioned.

The scale is absolute and it only ever goes up. An area a tip has shaded keeps
exactly that colour for the rest of the night; the tips that come after it can
add their own areas and climb the ramp where they coincide with it, and that
is all they can do. Nothing on the map ever dims, because a shade going down
is the map quietly taking a block off the table on your behalf — which, since
it cannot know which half of your deck is lying, it has no business doing. The caption under the map counts the tips you hold and
how deep the deepest agreement goes, and it never counts doors left, because
none have been taken away.

The shading is worth what you would expect it to be worth: one tip on its own
is nearly worthless, four tips put the right door about four knocks from the
top of the pile, and eight put it within one or two. Cross-checking a single
fact is expensive — the monsters hand out whichever fact you have heard least
about, so you need three cards of the same suit, and so twelve tips, before a
suit can outvote a liar. Most nights you will be reading the shading, not
counting cards.

### How a night ends

There are two ways to lose — the blood runs out, or the sun comes up — and one
way to win, and all three of them land on the same screen, which is the one
screen in the game that is not the game's palette at all. Flat blood red, edge
to edge, the same `#cf1206` the cat's gift pours down the screen, because it is
the same blood; it is just all outside you now. One phrase in black on it —
`DEAD`, `ASH` or `YOU FOUND IT` — as big as the screen will take, and nothing
else but the line telling you which key starts another night.

A phrase of one word fills the width; a phrase of several stacks a word to a
line and fills the height instead, and either way it is measured and scaled
down to whatever actually fits, so nothing is ever cut off the edge.

You do not get told how it went. Not when you die and not when you win: no
prose, no tally of doors knocked or tips believed. You get told that it is
over. `END_STATS` in `src/config.js` puts the tally back underneath if you
want it.

It is set in **Deathly**, the only real typeface in the game — everything
else, down to the hourglass, is drawn out of code. It is not only on the end
cards any more: the same face sets the word **PAUSED**, in the game's red over
the stopped street, and every one of the floating lines the game throws up
while you play — the tip landing, the candy, the child walking into you. Those
keep their own colours, because what happened is in the colour, and they are
stroked with the same dark outline every sprite in the game has, since a face
this thin over a lit street needs it. The HUD proper — the bars, the cards,
the minimap, the address — stays in the mono face: that is data, and data
should not look like a horror poster. It lives in `assets/` with
its licence, and is loaded over the FontFace API rather than declared in the
stylesheet, because canvas text does not redraw itself when a font arrives
late: it sets in the fallback and stays there. `DEATH_SIZE` in `src/hud.js`
is how big the word goes.

> **Licence:** Deathly is 1001Fonts *Free For Personal Use*. That does not
> cover commercial use — releasing this for money needs a licence from the
> foundry, or a different face. Dystopian Canticle (SIL OFL, no such
> restriction) is still in `assets/` and is a drop-in swap: change `FAMILY`,
> `URL` and `SCALE` at the top of `src/deathtype.js`.

### The hourglass

**There are no digits on the clock, because there is no clock.** The only thing
telling you how much night is left stands in the top right corner: an hourglass
made out of bone, with a skull for a cap and the sand running out between its
teeth. The top bulb is the night — grey sand, a few stars in it, and a moon
standing in the middle. The bottom bulb is what the night turns into.

**There is no colour in it except the sun.** The bone, the glass, the sand,
the stars, the moon being ground down, the grains coming through the neck and
the cracks that open at the end are all greys. The sun is the one hue on it,
and it is `#cf1206` — the exact red of the screen it puts you on, because it
is the same thing. It is the only colour in that corner of the screen, so
your eye goes to it, which is what a clock you cannot read has instead of
digits. (The skull's sockets are allowed the same red in the last hour: that
is not a colour of their own, it is the sun's light in them.)

It is the same sand. The level in the top falls past the moon and eats it away
grain by grain, and those grains come through the neck and build a sun back up
in the bottom, from the tips of its lowest rays to the top of the disc. Half a
moon and half a sun is three in the morning. No moon and a whole sun is 6:00
AM. In the last hour the glass starts to crack, the sun burns up from
its red to a bright one, and the skull's eye sockets catch the light that is
coming for you.

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

Talk to one and you get one tip, once, for ever — and half of them are lying
(see above). While the vision holds, the monsters near you also show as
pinpricks on the minimap, which is most of how you find one in the time you
have. A fact you have already been told is still worth being told again by
somebody else — a second voice agreeing with the first is the only thing that
makes either of them worth believing — but only until the fifth card, and then
the city is done talking to you.

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
bass, and it gets louder. That is the only thing the world itself will tell
you. The right door used to leak purple light around its frame from close up;
it does not any more, because a door that looks different is a door you can
find by looking, and that turns the tips, the lying and the whole deck into
decoration on a game about wandering until you spot a glow. Every one of the
hundred and twenty-five doors looks exactly like every other one, in both ways
of seeing, right up until you knock on it.

### Look

The city is flat. There is no lighting in it at all - no pools under the
lamps, no bloom off a lit window, no soft shadow under a parapet, not one
gradient. Every surface is a solid colour, and where a surface has to read as
having a second face - the side of a kerb, the dark a building puts on the
pavement, the underside of a sill - that face is another solid colour sitting
hard-edged next to it. All of it is in `src/scenery.js`, which draws the
ground, the buildings, the doors, the decorations and the lamps, and knows
nothing about the game.

**Centre lines stop at junctions.** On the old grid every crossing was a clean
four-way, and two centre lines crossing in the middle of one read as a
crosshair. The cut makes tees, staggered crossings and roads that run a little
way into one another, and a centre line carried straight through one of those
runs into the flank of the other road, or doubles up with a second line a few
pixels from it. So every road knows the stretches of itself that another road
overlaps and paints nothing there, which is what real road marking does
anyway.

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
capped. It stands where the two roads' centre lines cross — not in the middle
of the junction rectangle, which at a tee where one road stops short of the
other's far kerb is a different point — and the shaft runs up the road along
the centre line, opaque, so the paint it covers simply stops being there. On
an avenue that is a twin centre line rather than a single one, and the twin
line is painted narrow enough that the shaft covers both halves of it. It is
drawn over the finished street rather than into it, because the shaft is
longer than the junction it stands in and runs up the road past the block
above - baked into that block's tile it would be cut off at the tile's own
edge, which is exactly what it did.

**It never reaches the kerb.** A cross touching the pavement reads as a road
marking that has come loose, so every one of them keeps `CROSS_CLEAR` clear of
the sidewalk on all four sides. That is a floor, not a target: the figure is
drawn at `CROSS_SCALE` of its original size, and in a narrow lane where even
that would run onto the pavement the bar and the stub are cut back further
until they fit. So a cross in a grand avenue is a big one and a cross in a
side street is a small one, and neither of them touches anything it should
not.

**Not every junction gets one.** A cross needs road above it to stand its
shaft in, so it only goes where the road carries on north far enough — which,
since the cut yields tees and corners and no crossroads at all, means any tee
that opens that way. And because a cross is most of
three hundred pixels tall while the junction under it is a fraction of that,
two junctions close together would have one cross growing up through the
next one's stub. Where a pair would touch, only the wider one is burned: two
of them fighting reads as a drawing fault rather than as something coming up
out of the road. Of a hundred and sixty-odd junctions in the city, a
hundred and six end up with a cross.

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

**The camera hands out two offsets, and which one a thing uses matters.** The
city uses the rounded one: ground tiles and buildings are rigid bodies made of
many parts, and they all have to round against the same whole number or a
window drifts inside its own facade and a tile opens a seam at its edge.
Everything alive uses the true, unrounded one, and is rounded exactly once
from its real position on screen. Round the camera first and the sprite
second and you have two staircases stepping on different frames: as the camera
chases the vampire the two nearly cancel, and what is left over is a pixel of
him twitching back and forth along whatever direction he is walking. It stops
dead when he walks into a wall, because then neither staircase is advancing.
Measured over 400 frames at a walking pace: fourteen direction reversals
before, none after.

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
looks like a child. `PUMPKINS_PER_BLOCK` and `PUMPKIN_CROSSING_CHANCE` are how many pumpkins are
in your way, `PUMPKIN_R` how big one is and `PUMPKIN_BLOCK` how close you may
get to it, with `PUMPKIN_LAT` / `PUMPKIN_CROSS_LAT` the offsets that keep a
lane open past them. `MONSTERS_PER_BLOCK` is how many of them are out there, `LIAR_CHANCE` how
many of those are lying to you (0 gives you back the old honest city) and
`MAX_TIPS` how many cards a night will hand over at all;
`BUMP_BLOOD`, `BUMP_STAGGER`, `BUMP_ANIM` and `BUMP_SHAKE` tune what it feels
like to be walked into, and `BAT_POOF` is how long the smoke hangs about.

## Sound

Everything that happens to you is made out of oscillators at the moment it
happens — the step, the knock, the wrong door, the wings, the card landing.
There are no sound files for any of it, and `src/audio.js` is the whole of it.

The exception is the soundtrack, which is a real recording: `assets/ost` is
streamed through an `<audio>` element into the same master gain as everything
else, so it loops through the night, `M` mutes it with the rest, `ESC` pauses
it where it stands, and a fresh night starts it again from the top. When you
die it goes — the death screen is one word on a flat red field and a
soundtrack still playing under it is the game carrying on without you.

**It gets out of the way of the bass.** The thump leaking out of the real
party is, since the light around that door was removed, the only thing the
world itself will tell you about where the party is, so it cannot be fighting
a mix: as you close on the door the track ducks by `MUSIC_DUCK` and the bass
is what is left. `MUSIC_GAIN` is the level, and `MUSIC = false` gives you the
old purely procedural build.

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
src/audio.js        procedural sound, and the one recorded thing there is:
                    the soundtrack in assets/ost, streamed and looped
src/sprites.js      PLACEHOLDER ART for everybody drawn out of code.
src/artwork.js      the ones who are not: the vampire, the witches and the
                    nosferatu, cut out of real drawings in assets/
src/input.js
src/main.js         loop and wiring
```

`src/sprites.js` knows what everybody in the city looks like, and builds every
one of them out of small colour grids at load time. To swap in real art,
replace `personSprite`, `catSprite` and `batSprite` with something that returns
a canvas or image with `anchorX` / `anchorY` set to the sprite's feet, and
nothing else has to change.

**Three characters are the exception and are not drawn out of code**: the
vampire you play, and the two monsters you find standing on the pavement — the
witch and the nosferatu. They are real drawings, and `src/artwork.js` cuts
them out of their sheets and puts them on screen.

The vampire is `assets/vamp-frente e verso-01.png`, a sheet of eight: column 0
is his back, column 1 his front, row 0 standing still and rows 1–3 the walk.
`VAMP_BOX` is how tall he stands (33 art pixels, a little over the 28
everybody else is — he is the one adult out there and the cape needs the
room).

The walk is the sheet's own rows in the order the sheet lays them out — row 0
standing still, rows 1, 2 and 3 the three beats of the cycle. Nothing is
mirrored to make a pose, nothing is skipped and nothing is re-ordered; the
mirror is only ever for facing left. If a frame ever looks wrong, the fix
belongs in the sheet, not in the code that plays it.

The monsters are `assets/party-witch-01.png` and
`assets/party-nosferatu-01.png`, one drawing of one pose each, facing you —
and that is all a monster needs, because it stands on that pavement all night
and never takes a step. `WITCH_BOX` and `NOSFERATU_BOX` are their heights. The
sheets are all drawn at different sizes, so the boxes are what put the
characters in proportion to each other rather than in proportion to whatever
the files were exported at, and both are written off `VAMP_BOX` so that
changing the player's height keeps the three of them in proportion: **the
witch stands a fifth taller than the vampire you play** (120% of him, measured
off the drawings) and **the nosferatu stands exactly his height**, wider in the
shoulders and nothing else. Neither is ever seen outside vampire vision: out
of it they are wearing a child's costume like every other monster, and that
costume is still built out of code. They keep their colour when the street
drains, the way every monster does.

Two things about the sheet decide how that file works. Its background is white
**and so is his face**, so keying white out would punch a hole through his
head: the transparency is flooded in from the edges of each cell instead, and
white the outline encloses survives. And the eight drawings are not aligned to
each other, so each is trimmed to its own ink and stood on the pavement by its
own feet — all scaled by the same amount, off the tallest cell, so he does not
change size between frames.

**Each frame is registered on his head, not on the middle of its own box.**
That is not fussiness: in a stride the legs reach out to one side and take the
bounding box with them, so a frame centred on its box swings the whole
character sideways every step — the head lurches, the legs stay put, and it
reads as a shake. The head is drawn in the same place in every frame of the
sheet, to a third of a pixel, so the top of the figure is what each frame
hangs from. Vertically he still stands on the bottom of his own ink, because
what should hold still down there is the ground. The drawings face right, so walking left is the
same frame mirrored; walking north shows his back and everything else shows his
front. Nothing is generated into a file: the sheet stays the only copy of the
art, and re-exporting it is all it takes to change him. Until it loads he is
drawn with the old placeholder sprite, so a missing or broken sheet costs you
nothing but his looks.

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
road round the outside, and `CROSS_SCALE` / `CROSS_CLEAR` the size of the
upside-down cross and the gap it keeps from the pavement.

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
PARTY.isWalkable(x, y)   // for invariant checks: may a vampire stand here?
PARTY.game         // everything
```
