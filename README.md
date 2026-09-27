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

`?label=0` starts past the studio label, which is what any scripted or
headless run wants — see below. `?seed=` and `?citySeed=` are the other two.

### The screen before the screen

**The game opens on the studio's label, not on its own title.** It is the same
screen BATIDÃO DE CÔCO opens on — a compost heap with vermin crawling over it
and SABOROSA across the middle — so the two games open the same way, and it
keeps that game's own timing to the millisecond: a quarter of a second before a
press counts, three seconds up, six tenths going down into the title card.

What it does not keep is its colours. **The heap and everything crawling on it
come in grey, and the label comes in the blood this game is made of** — the
drawing's own shading carried up a black-to-`#cf1206` ramp, so the outline and
the three flat colours inside it still read, in the one colour this game has.
Both are done to the art before it ships, by `preview/intro-prep.py`, rather
than in the browser: the photographs are 3002 × 1687 against a 1280 × 720
canvas, so shipping them at source size would be five and a half times the
pixels for no picture, and re-tinting fifteen million of them at every launch
for a screen that lasts three seconds is worse. Three frames on a 105 ms hold,
about 9.5 a second, looping — the same rate that game crawls them at.

**It leaves on its own and the title card does not.** That asymmetry is the
point of having two screens rather than two things to dismiss: this one is a
label being shown to you, the title is where the game waits for you. A press
skips it, but not for the first `LABEL.arm` — it is the first screen of the
session and a key still down from launching the game would blow through it
before it had drawn twice.

**Everything is loaded before it starts, and that is not an optimisation, it
is the whole reason it runs at all.** Cutting the character sheets reads every
one of 34 million pixels twice over — once to find the ink, once to flood the
background away and trim — and that used to happen whenever the sheets
happened to land, a second or so in. That was invisible while the first screen
was a static title card and it was half a second of frozen photograph the
moment the first screen started moving. So `main.js` waits on the label's four
pictures (decoded, not merely fetched — the first `drawImage` of an undecoded
photograph decodes it on the spot), the character sheets and the typeface, all
against a black screen where a stopped main thread looks like nothing at all,
and the label begins on the frame that finishes. Eight seconds is the floor
under the wait, so a sulking asset server cannot hold the game on black.

The ending's clip is the one thing not waited on — two megabytes wanted minutes
from now at the earliest — and it is started once the label is gone, so it is
not competing for the network with the pictures that are on screen now.

**It is also the one place in the game that fades.** Everything drawn over the
city is flat and opaque and stops rather than thins; this is not over the city,
it is a screen arriving, and cutting to a full-brightness photograph from black
reads as the page having jumped. `LABEL` in `src/config.js` holds all of it and
`LABEL.on` false opens on the title card the way it used to.

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

You cannot tell anything from looking. The street is fifteen drawn children in
fifteen costumes, and the thing wearing one of those costumes over something
else is drawn from the same fifteen — some of them are not children.

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

**And they are not cute in the other light.** In ordinary sight a pumpkin is a
cheerful gourd, lit from inside, grinning. Once the changeover is half done it
is a grey thing with a red fire in it and a mouth full of teeth — a hard swap
at the halfway mark, the same trick the street lamps play when they turn out to
have been torches all along, because a pumpkin dissolving into another pumpkin
reads as a rendering fault.

**Both of them are drawings**, `assets/pumpkins.png`: a row per variation and
two columns, the left one ordinary sight and the right one what a cat's eyes
find. The seed that used to only tilt a pumpkin now picks which row it is, so
the ones in the street are four different pumpkins rather than one drawn four
ways — add a fifth row to the sheet and a fifth pumpkin joins the street with
no code change, the same way a fifth beast would. The sheet is cut by looking
for its empty rows and empty columns rather than by dividing it up, so the
drawings may sit anywhere on it at any spacing; the one rule is a clear row
between two rows of them and a clear column between the two columns. The two
columns are **not** the same size — the vision drawings are about 8% wider than
their ordinary twins, which is how they were drawn, and the changeover keeps
that difference rather than flattening it.

The pumpkin drawn out of code is still in `drawStreetPumpkin`, underneath, and
is what you get if the sheet does not load. Unlike the shadow beasts, which are
their drawing or nothing, a thing you can walk into has to be visible whatever
happened to the art. **The pumpkin hanging by a door is a different pumpkin**
and is untouched: that one is a clue value (`deco`), it is drawn out of code,
and changing how it looks would change what a tip means.

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
way to win, and all three of them land on the same card, which is the one
screen in the game that is not the game's palette at all. Flat blood red, edge
to edge, the same `#cf1206` the cat's gift pours down the screen, because it is
the same blood; it is just all outside you now. One phrase in black on it —
`DEAD`, `ASH` or `YOU FOUND THE PARTY` — as big as the screen will take, and
nothing else but the line telling you which key starts another night. The
winning one is set at `END.size` of that, 0.85, because it is the only one of
the three with a room behind it to share the screen with; the two losses still
take all of it.

**Winning is the same card with the party behind it.** Lose and the red is
flat, because there is nothing behind it. Win and it is the room the door
opened on: bats hanging in a row and swaying. It is footage, not drawing —
`assets/bats-ending.mp4`, thirty-nine seconds of a bat colony — but it is
flattened to four flat tones of the card's own blood and dropped onto the
game's art pixel, so it arrives as a poster rather than as a video playing in
a window. Three things make it read as drawn rather than as compressed: the
tone bands are decided **once over the whole cut** (per frame they crawl and
the picture boils), every frame is first pulled onto a common exposure, and it
runs at 12 fps rather than the 30 it was shot at.

There are two sources and `END.source` picks between them, because they are
good at different things. `'video'` is the 39-second clip: long enough that the
card never visibly repeats, 2 MB, and it has to decode. `'sheet'` is
`assets/bats-win.png`, fifty-four frames in a strip — four and a half seconds
on a loop, 414 kB, one `drawImage`, and it cannot fail. The video is the
default **and the strip is its fallback**: a browser that will not play the
clip still gets bats rather than a flat card, and if neither loads the card
goes flat red and the night still ends properly. The fallback is per *frame*,
not per session — any frame the video cannot supply, while it seeks or
buffers, is drawn from the strip, because a card with nothing behind the
lettering is worse than one with the wrong bats behind it for a frame.

**The video is snapped back onto its own four tones before it is drawn**, and
that is not optional either. Flat colour is exactly what an ordinary encoder
is worst at: h264 at 4:2:0 lands **half a per cent** of the clip's pixels
exactly on one of the four, and leaves ringing on every edge, which on art this
flat reads as a rendering fault rather than as compression. Lossless VP9 gets
it right and costs 25 MB. So the 2 MB file stays and `END.snap` puts the tones
back at draw time: the four differ almost entirely in red, so it is one
256-entry table on that channel. Measured on the live card, **14.9% of pixels
exactly on a tone becomes 97%** — the rest is the lettering's own edges. It
costs one pass over 426 × 240 pixels — a ninth of the screen — and only when
the video actually turns a frame over, which at 12 fps is a fifth of the times
the card is drawn. `END.snap` false shows what the encoder really returned.
`END_TONES` is the four, and they are what `preview/quantize.py` wrote; cut the
clip with a different `--tones` and they change with it. The strip needs none
of this — a PNG is exact.

That middle one is not optional. The footage is not evenly lit — there are
lightning hits at 0:19 and 1:04, a red-tinted stretch from 0:33 to 0:41, a
frame at 1:12 that goes to pure white, and a dozen smaller flashes — and a
flash lands every pixel of the frame above the same band edge, so the picture
becomes one solid slab of colour. `preview/quantize.py` therefore matches each
frame's tone distribution onto the clip's own before it bands anything, and any
frame with no contrast left in it at all is dropped and the frame before it
held in its place. Cutting the same four and a half seconds with `--regularise 0` shows
what it is for. The cut that ships overlaps the flash at 0:46, so it needs this
as much as the lightning does. The phrase waits `END.textAt` seconds, so you get the
room before you get told, and then it is set in black haloed in the blood —
`END.type`, which is `'outline'`. The other setting is `'invert'`, which cuts
the phrase out of whatever it lands on by drawing it in the red under
`difference`: red comes out black, black comes out red, and it is the more
striking of the two on a frame with a flat field behind it and close to
unreadable on a frame that is all middle tones. `WIN_BATS` false puts the win
back on the flat card. The footage both were cut out of is 29 MB, is not in
the repo, and does not ship.

**Everything about how the ending plays is in one mutable object**, `END` in
`src/config.js`, rather than in constants — `source`, `fps`, `textAt`, `type`.
That is so `preview/ending.html` can turn them while the card is on screen.
The game never writes to it; the values in the file are the shipped ones.

### Looking at the ending without playing to the end

`preview/ending.html` is the ending, not a drawing of it: it imports the same
`drawEnd()` `index.html` does, hands it a stand-in game object in the state it
wants, and drives the one clock the card runs off. Anything wrong there is
wrong in the game. Scrub the card's own seconds, switch video against strip and
outline against invert while it plays, drag `textAt` and the strip's frame rate
about, and flip between the winning card and the two losing ones — which also
switches the game *state*, because losing does not get the room behind the
door. It prints the `END` line to paste into `src/config.js` once you like it.

Every control is also a query parameter, so a particular beat of a particular
setting can be linked or screenshotted:
`preview/ending.html?t=2.6&source=sheet&type=invert&textAt=0.8&snap=0&title=ASH`.

`assets/bats-ending.mp4` was cut from source 0:06 to 0:45 — 39 s, 468 frames,
2 MB.

To cut a different piece: `python3 preview/quantize.py --in 6 --len 39 --mp4
assets/bats-ending.mp4` bands a stretch into something you can scrub in
`preview/scrub.html` (`i` and `o` mark a piece, `c` copies the command that
cuts it; it writes a sidecar `.json` so the page reports times in *source*
time rather than in its own). The same script with `--sheet
assets/bats-win.png` writes the strip the win card loads. It prints the four
`WIN_BATS_*` numbers to paste into `src/config.js` if the shape changes.

A phrase of one word fills the width; a phrase of several stacks a word to a
line and fills the height instead, and either way it is measured and scaled
down to whatever actually fits, so nothing is ever cut off the edge. It is
measured in the real face or not at all — Deathly arrives over the FontFace
API, and a phrase measured in the Times fallback is set at the wrong size as
well as in the wrong face — so the words wait for `deathFontsSettled()` the
way the title card does. The room behind them does not wait; it is already
holding them back for `END.textAt` seconds anyway.

You do not get told how it went. Not when you die and not when you win: no
prose, no tally of doors knocked or tips believed. You get told that it is
over. `END_STATS` in `src/config.js` puts the tally back underneath if you
want it.

The `PRESS ENTER` line gets an outline on the bats whichever way the phrase is
set, because a face that thin over a busy field lands at whatever contrast the
pixel under it happens to give — which is the same reason every floating line
in the game is stroked.

It is set in **Deathly**, the only real typeface in the game — everything
else, down to the hourglass, is drawn out of code. It is not only on the end
cards any more: **the title card is the same card the night ends on** — flat
blood red edge to edge, every word on it cut out of that red in black, in this
one face — and the same face sets **PAUSED** in the game's red over the stopped
street, and every one of the floating lines the game throws up
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

One thing the face decides for us: **its hyphen sits down on the baseline**, so
`A - B` sets as `A _ B` and reads as an underscore. The title card uses a middle
dot for every dash, and its two hyphenated words became `trick or treaters` —
the one place the typeface got a say in the writing. The pause card still has
plain dashes and still has the problem.

The card is **two blocks**: what you do on the left, what is going on out
there on the right. A key stands at its block's own edge with its lines
indented under it — the old card put the keys in a single column down the
middle of the screen, and there is no room for that once there are two of
them.

Nothing on it is a fixed size. The word is fitted to the width it is allowed
and hung off the top of its own ink (this face throws spikes well above its
cap height, so a baseline that looks right at one size shaves the tips off at
the next), and everything below is measured off it. **Both blocks take the
same size**, whichever is smaller of the size at which the longest line still
fits its block and the size at which the taller block still fits the height —
so the two read as one card rather than as two. Editing the lines cannot push
anything off the screen; add one and everything gets slightly smaller.

**The red goes up before the lettering does.** The card is redrawn every
frame, so setting it before the face arrives does not leave Times on the
screen — it leaves Times on the screen for a moment and then snaps into the
real face, which is worse. So the field is filled immediately and the words
wait on `deathFontsSettled()`, which is true when the font has arrived *and*
when it is never going to: a font that fails still gets its card, in the
fallback, rather than leaving a blank red screen for ever. The face is also
asked for in `index.html` with a `<link rel="preload">`, so the fetch starts
with the page instead of waiting for `main.js` to run and ask. Proved with the
font load deliberately slowed to three seconds: at 1.5 s the card is a flat
red field with not one black pixel on it, and at 5 s it is fully set.

> **Licence:** Deathly is 1001Fonts *Free For Personal Use*. That does not
> cover commercial use — releasing this for money needs a licence from the
> foundry, or a different face. Dystopian Canticle (SIL OFL, no such
> restriction) is still in `assets/` and is a drop-in swap: change `FAMILY`,
> `FONT_URL` and `SCALE` at the top of `src/deathtype.js`.

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
then it goes — and the city turns underneath it as it comes down and leaves,
rather than being already turned when it lifts. For thirty seconds:

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

**And the street turns out to have been crowded.** There is a shadow beast for
every single trick-or-treater in the city — over a thousand of them — and you
never see one without a cat's eyes. Each keeps station on its own child: off to
one side, a little behind, always closing the gap rather than welded to it,
and off the ground, so it lays nothing on the pavement.

**They stand near people and never on them.** `BEAST_KEEP` is a hard 20 art
pixels from the middle of a beast to the middle of anybody — its own child,
everybody else on that child's block, and you — and it is enforced on where
the beast *ends up*, not only on where it was aiming. That distinction is the
whole of it: a beast is always arriving rather than arrived, and the child it
trails walks, and walks into it. What it buys is that a pack of four children
comes with a ring of beasts around it rather than a pack of children wearing
them. They do not walk,
because they do not touch anything: nothing collides with them, nothing knows
they are there, and no pavement test is ever run on them. Their child is the
thing that knows about pavements, and they go where it goes.

They arrive on the same beat the costumes come off on, which is the point of
them — the street does not slowly fill up with them, it turns out to have been
full the whole time you were walking down it.

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
Going *in* is stepped too, but at eighteen stages over `VISION_FADE` that is a
jump every fifteenth of a second, and half of them happen under blood anyway.

**Going in is timed against the blood.** The changeover does not begin with the
pour. It waits out `VISION_WAIT` of it — the ~0.54 s the sheet spends building
up over you — and then turns: about half done by the time the blood starts
sliding off, four fifths of the way by the time it is gone, finished a quarter
of a second later. So none of it happens in the clear before the blood, and
none of it is finished and waiting when the blood lifts. `VISION_WAIT` is the
whole dial: 0 puts it back under the blood entirely, `VISION_BLEED_GO` (0.72)
holds it until the sheet is already leaving. While it is held the mix keeps
whatever it already had, which also means a second cat taken mid-vision does
not flash the city back to colour under the sheet.

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
**The player** uses the true, unrounded one, and is rounded exactly once from
his real position on screen. Round the camera first and the sprite second and
you have two staircases stepping on different frames: as the camera chases the
vampire the two nearly cancel, and what is left over is a pixel of him
twitching back and forth along whatever direction he is walking. It stops dead
when he walks into a wall, because then neither staircase is advancing.
Measured over 400 frames at a walking pace: fourteen direction reversals
before, none after.

**Everybody else rounds with the street, not with the camera.** That rule used
to cover everything alive, and it was wrong for everything that is not the
player: a standing child sat at `round(camera + x)` while the pavement under
her sat at `round(camera)`, two roundings of the same sliding number half a
pixel out of step, so the gap between her feet and the paving stone opened and
closed by a pixel as the camera went past. That is what a still child
shivering actually is. So `worldPos()` in `src/render.js` puts children,
monsters, cats and beasts on the city's whole number and rounds their own
offset from it — the gap is then a fixed integer and cannot change, whatever
the camera does. Measured over 420 frames of walking: **75 reversals before, 0
after**, and the player's own count is untouched at 2, because his code path
never changed. Proved in pixels as well as in arithmetic — the camera swept
across one screen pixel in eighths, the child isolated by differencing each
frame against the same frame with her hidden: her gap to the street reads 1095
at every offset, and her drawn pixel count is identical in all eight frames.

What it costs is up to one pixel between the player and the world, and that is
the right thing to spend it on: he is the one that is moving, and the eye
catches a still figure shivering against a still street long before it catches
a walking one being a pixel out.

The people are not part of any of this. `drawSprite` turns image smoothing off
for exactly as long as it takes to stamp one down, so the trick-or-treaters
stay pixel art whatever the city does around them.

`LIGHTING` still exists and still turns on a full-screen darkness-and-glow
pass over the finished frame, which does light the people as well. It is off.
`DAWN_TINT` controls the sky going peach after 4:30 AM, kept separate because
it is the timer rather than scenery mood.

`VISION_SECONDS` and `VISION_FADE` tune the cat's gift, `VISION_TAPER` is the
fraction of it spent wearing off, `VISION_BLEED` the length of the pour,
`VISION_BLEED_GO` where in that pour the sheet starts to leave, `VISION_WAIT`
how much of the pour the palette waits out before it turns — raise it and the
city changes later and more in the open, lower it and the change goes back
under the blood where you cannot see it — with `VISION_DELAY` the seconds the
last two work out at, and
`CAT_TOUCH` how close you have to pass, `VISION_STEPS` how coarsely the city
steps between the two palettes. The blood is a pure overlay in `drawBleed` -
it accelerates the way a falling thing does, covers for a beat and fades out;
the changeover is the one thing timed against it. `REVEAL` is how far the changeover has
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
                    a monster carries two looks: `disguise` and `spec`,
                    and every child carries a shadow beast
src/player.js       movement, bat form, the candy speed penalty
src/hints.js        FACT_KEYS - the facts, and the dialogue around them
src/game.js         state machine: clock, interactions, win and loss
src/palette.js      the ordinary / vampire-vision colour table, and the mix
src/scenery.js      the city: asphalt, kerbs, buildings, doors, decorations,
                    street lamps. flat, textured, no living thing.
src/render.js       camera, the draw order, the people, and the effects
src/hud.js          vitals, minimap, the deck of tips, title and ends
src/hourglass.js    the clock, which is a moon being ground into a sun
src/label.js        the studio's label, which is the first thing on screen
src/bats.js         the room behind the right door: the clip that plays
                    under the winning card, and its still-image fallback
src/audio.js        procedural sound, and the one recorded thing there is:
                    the soundtrack in assets/ost, streamed and looped
src/sprites.js      PLACEHOLDER ART for everybody drawn out of code.
src/artwork.js      the ones who are not: the vampire, the witches, the
                    nosferatu, the cat, the shadow beasts and all fifteen
                    children, cut out of real drawings in assets/
src/input.js
src/main.js         loop and wiring
```

The shadow beasts are `assets/party-shadow beasts-01.png`, and that sheet is
the one that is **not on a grid**: it is four different animals at four
different sizes, so `cutBands()` finds them by looking for the rows of the
image that have nothing in them at all and treats each run of rows that does
as one drawing. Add a fifth to the sheet and a fifth beast walks the street
without a line of code changing; the one rule is a clear row between two of
them, since two that touch are one beast as far as that is concerned. They
keep their sizes against each other — `BEAST_BOX` is the tallest of them at 30
art pixels, just under the vampire, which leaves the small ones at about a
child's shoulder. They face left, like the cat, and the mirror is the one
heading right. There is no coded stand-in for a beast: it is the drawing or it
is nothing, which is the right answer for a thing you can only see through a
cat's eyes.

The cat is `assets/party-cat-01.png`, four drawings in a column: sitting,
standing, and two of the walk. It is the one drawing here that is deliberately
**not** the size of the sprite it replaces — the coded cat is 14 × 12 art
pixels and `CAT_BOX` is 40% over that, because a correctly sized cat is a cat
nobody notices. The sheet faces left, so it is the cat walking right that is
mirrored, and which way it faces is taken from the ground it covers rather
than from `dir` (that is which way round the block it is going, and a block
has four sides).

`assets/pumpkins.png` is the street pumpkins, and it is the other sheet cut by
its own empty space rather than on a pitch — but in both directions, so it
comes out as rows of variations by columns of ways-of-seeing. `PUMPKIN_BOX` is
17 art pixels, which is not a judgement call either: it is the height the coded
pumpkin already stood at, so the drawing arrives the size the obstacle was and
`PUMPKIN_BLOCK` still means what it says.

`updateCat()` gives it the three states the sheet is drawn for: it sits, it
gets up, and it **holds that standing pose for `CAT_RISE` — a second to a
second and a half — before it goes anywhere**. That beat is the point of it:
an animal that goes from sitting to walking on the same frame reads as a
sprite being dragged about. The walk is paced by `CAT_STRIDE` pixels of
pavement per pose rather than by the clock, so a slow cat plods. Both
constants are in `src/config.js`.

One thing the swap costs: cats used to have their own eye colours, and the
drawing's eyes are red for all of them. A cat you have already brushed against
still shows it — the red drains out of the drawing (the grey twin, drawn over
the top) where the coded sprite used to swap the colour.

`src/sprites.js` knows what everybody in the city looks like, and builds every
one of them out of small colour grids at load time. To swap in real art,
replace `personSprite`, `catSprite` and `batSprite` with something that returns
a canvas or image with `anchorX` / `anchorY` set to the sprite's feet, and
nothing else has to change.

**Almost nobody out here is drawn out of code any more**: the vampire you
play, the two monsters you find standing on the pavement — the witch and the
nosferatu — the cat, the shadow beasts, and every one of the fifteen
trick-or-treaters. They are real drawings, and `src/artwork.js` cuts them out
of their sheets and puts them on screen. What is left in `src/sprites.js` is
the placeholder underneath and the bat.

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
off the drawings) and **the nosferatu comes in a tenth under him** (90%), wider
in the shoulders and nothing else. Neither is ever seen outside vampire vision: out
of it they are wearing a child's costume like every other monster, and that
costume is still built out of code. They keep their colour when the street
drains, the way every monster does.

**Every child on the street is a drawing.** They are in `CHILD_SHEETS` at the
top of `src/artwork.js` — the witch on `assets/party-child-001.png` by
herself, then nine on `party-kids-01.png` and five on `party-kids-02.png`,
fifteen in all. Every sheet reads the same way: **across is one child per
column, down is three drawings of its walk**, and there is no fourth cell for
standing still, because the middle drawing stands square enough on both feet
to be the idle and that is the one they hold when they stop. Drop another
sheet in that list and its children join the crowd; nothing else knows or
cares which sheet anybody came off.

Which child a child is, is one seed rolled in `kidSpec()` and never changed,
taken modulo however many drawings turned up. **Nobody is weighted and nobody
is special** — the witch takes her turn as one of fifteen, and over a city of
a thousand children they come out even (min 57, max 88 of an expected 65 on
the night this was written, which is an ordinary chi-square for fifteen bins).
A monster's disguise is built by that same `kidSpec()`, so the thing pretending
to be a child draws from exactly the pool the children draw from. That is load
bearing: a disguise off a different shelf from the children is the tell.

**They are not all the same height, and that is on purpose.** Every child on
every sheet is drawn at the same scale as every other, so one factor carries
all of them from sheet pixels to art pixels: the witch lands on exactly the 24
she has always been (`CHILD_BOX`, what the coded kid she replaced measured,
hat to shoes) and the rest come out wherever their own drawings put them —
about 16½ for the little ghost, about 25 for the one with the long head. The
alternative, forcing every child to one height, would throw away the only size
information the sheets carry, and the crowd is better for a short one and a
tall one being in it.

Their walk runs off the child's own animation clock rather than off the
`frame` number the coded sprite takes, since that frame only ever counts 0, 1
— it was written for a two-pose walk and would cost every one of them their
third drawing. It steps at the same six beats a second `updateKid()` drives
the coded walk at, so a street of children still steps together.

**They are drawn facing left, so a child heading right is that drawing
mirrored.** Which way a child faces is taken from the ground it covers and not
from `dir` — `dir` is which way round the block it is going and says nothing
about the screen, since the same `dir` walks it left along one side of a block
and right along the other. Up and down the vertical sides there is nothing to
take, so it holds whichever way it last faced; a child that snapped back to a
default at every corner would flicker at every corner. Checked over a few
thousand samples of children actually walking: facing matched travel direction
every time, none wrong. Nobody has a back — the kids walk a block's ring, not
a compass, and there is no drawing of anybody from behind.

The coded children in `src/sprites.js` are not gone — they are what stands on
the pavement in the moment before the sheets land, and what is left if one
never does.

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
