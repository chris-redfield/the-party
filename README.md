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
| `E` | knock on a door / talk to somebody / acknowledge a cat |
| `Q` | dump your candy on the pavement |
| `ESC` / `P` | pause · hold `ESC` + `R` for a fresh night |
| `M` | mute · `[` `]` zoom |

## The rules underneath

**The city** is 10×10 blocks. Each block is a building with a sidewalk ring
around it and a single door, set into the south facade — the only wall the
camera actually shows you. That is 100 doors, all of them the same red. Exactly
one, chosen at random each night, is the party.

**Bat form costs NIGHT** (the purple bar). When NIGHT runs dry the wings start
billing you in BLOOD instead, which is the whole tragedy of the design.

**Children are solid.** Trick-or-treaters walk the sidewalks in packs, and a
pack of three or four fills the pavement end to end. You cannot push through
them. That is what the wings are for. Walking into one costs you blood, knocks
you off your feet and stalls you for a moment, and they shout at you about it.
Grown-ups are solid too — they just shove you and say nothing.

Children are shorter than the adults and their heads are too big, which is how
you tell at a glance who is an obstacle and who might know something.

**Wrong doors are the only place candy comes from.** Children never give you
any; they want yours. Knock on a house that is not the party and somebody hands
you three fun-size somethings and a cup of red punch — so a wrong door is
+3 candy and +12 blood. Candy is weight. Past five pieces children start
following you, and every child in your parade makes you slower. `Q` dumps the
bag and the parade goes with it.

**Four facts pin down one door:** the district, the avenue, the street, and
what is hanging beside the door. One door per block means district + avenue +
street is already a full address; the decoration is how you recognise the place
if you stumble on it before you know where you are. Every fact narrows the
minimap, and when one block is left the map says so.

### Vampire vision

**You cannot see the monsters.** The street looks like an ordinary Halloween:
children, and adults dressed as vampires and witches. Those adults are all
human. They will talk to you, and what they tell you is something their cousin
heard — it lands in your notes under HEARSAY, and it is wrong.

The ones who actually know where the party is have been standing on that
pavement all night, and to ordinary eyes they are not there at all.

**A black cat will lend you the other way of looking.** Every cat carries the
same thing and gives it once: sixty seconds of vampire vision. The colour
drains out of the city, every light in it burns red, and the real vampires and
witches appear on the pavement — hovering, casting no shadow, eyes lit. Talk to
one and you get a real fact. While the vision holds, the monsters near you also
show as pinpricks on the minimap, so a minute is enough to actually find one.

Then it fades back and they are gone again, and you go and find another cat.

**Proximity.** Within about two blocks of the real party you start to hear the
bass, and it gets louder. There is light leaking out around the frame of the
right door as well, but you have to be close to see it — and it is purple,
which in vampire vision makes it the only thing in the world that is neither
grey nor red.

### Look

Ordinary sight is a colourful night city. Vampire vision is the same city
drained to grey with every lit thing burning red. Both are one palette table in
`src/render.js`; the live palette is lerped between the two columns every frame
by `visionMix`, which is why the changeover fades instead of snapping, and why
nothing downstream has to know which mode it is in.

Doors stay red in both. `COLOR_DOORS` in `src/config.js` greys them out.

The scenery is painted flat — the palette carries the night on its own, with no
street-lamp or darkness pass. `LIGHTING` turns the radial lighting pass back
on. `DAWN_TINT` controls the sky going peach after 4:30 AM, kept separate
because it is the timer rather than scenery mood.

`VISION_SECONDS`, `VISION_FADE` and `VISION_WARN` tune the cat's gift;
`BUMP_BLOOD`, `BUMP_STAGGER`, `BUMP_ANIM` and `BUMP_SHAKE` tune what it feels
like to be walked into.

## Source layout

```
index.html          page shell
css/style.css
src/config.js       every tunable number lives here
src/rng.js          seeded PRNG - one seed reproduces a whole city
src/city.js         block geometry, walkability, doors, districts
src/entities.js     spawning and behaviour for kids / monsters / cats
src/player.js       movement, bat form, the candy speed penalty
src/hints.js        FACT_KEYS - the facts, and the dialogue around them
src/game.js         state machine: clock, interactions, win and loss
src/render.js       camera, city, and the ordinary / vampire-vision palettes
src/hud.js          vitals, clock, minimap, clue panel, title and end cards
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
PARTY.vision()     // 60 seconds of vampire vision (or vision(n) for n)
PARTY.win()        // knock on the right door
PARTY.restart()    // a fresh night
PARTY.game         // everything
```
