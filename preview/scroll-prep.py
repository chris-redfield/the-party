#!/usr/bin/env python3
"""
Turn the stock scroll EPS into geometry this game can draw in its own line.

    python3 preview/scroll-prep.py ON5YU51.eps src/scrollart.js

WHAT THIS IS FOR.  The reference art is airbrushed: every roll on it is a soft
cylinder lit from one side and the sheet carries a wide gradient where it
turns.  None of that belongs on a screen where every other surface is one flat
colour with a drawn line round it.  But the SHAPE is worth having - the torn
edges especially, which are fiddly and good and which I drew badly by hand.

So this keeps the shape and throws the shading away:

  1. Rasterise the EPS with ghostscript (vector in, so no JPEG ringing to
     fight) and cut out the one design on it we are using.
  2. Split the artwork into FOUR LUMINANCE BANDS.  This is the whole trick,
     and it works because the gradients live INSIDE the bands rather than
     across them: the sheet runs 207..255 and is one band, the shaded turn is
     one band, the cut edge of a roll is one, and the dark down the middle of
     a rolled tube is one.  Quantising to four flat colours would have put
     contour lines across the sheet; quantising to four REGIONS does not.
  3. Trace the outline of every region and simplify it.
  4. Write the outlines out as plain numbers, normalised 0..1.

`src/hud.js` then fills those regions in the HUD's own parchment colours and
runs the city's `inkPath` round them, so the object on screen is the
reference's shape drawn in this game's hand.  Nothing of the original's paint
survives, and no image is shipped - the output is about 6 kB of coordinates.
"""
import json, math, subprocess, sys, tempfile, os
from pathlib import Path
import numpy as np
from PIL import Image

# The sheet holds three designs; this is the box round the one we want, as a
# fraction of the whole page.  Top right: a sheet with a short roll lying
# across its top left corner and a tall one standing down its right.
CROP = (0.40, 0.00, 1.00, 0.47)
DPI = 200

# Where one band stops and the next starts, in luminance.  Read off the
# histogram of the art itself, not guessed - see the note above.
BANDS = [205, 160, 96]          # paper | turn | down the tube | deeper in
# EXTRA THRESHOLDS THAT ARE ASKED FOR LINES BUT NEVER FOR FILL.
#
# The cut rim of a rolled tube - the thickness of the paper, seen end on - is
# a flat band at luminance 208 on this art, and the sheet's own gradient runs
# 207 to 255.  So the rim cannot be told from the paper by a threshold: put
# the cut at 215 and half the sheet goes with it.  It CAN be told by its
# edges, which jump 22 levels against the paper above it and 86 against the
# dark inside the tube - so this threshold is run for its boundaries only,
# and the hard test throws away everything it finds except the rim.  Without
# it the tube's mouth has no line under it and the roll reads as a stain on
# the sheet rather than as something standing proud of it.
#
# The general rule this is an instance of: a boundary that is soft everywhere
# except in one place still tells you where that one place is.
EDGE_ONLY = [215]
MIN_AREA = 900                  # px at DPI, below which a region is a speckle
EPS = 2.2                       # how hard the outlines are simplified, in px
# A DRAWN EDGE IS A CLIFF; SHADING IS A SLOPE.
# The first cut of this filled every band and ran a line round it, which put a
# hard edge and a dark wedge down the right of the sheet where the reference
# has nothing but a soft shadow - the algorithm had faithfully traced the
# airbrushing it was supposed to be removing.  So a band boundary only earns a
# line where the luminance actually jumps across it.  In 0..255 per pixel: the
# shading slopes at well under 3, and every real edge on this art is over 30.
HARD = 14
RUN = 6                         # points in a row before a hard run is a line
# A drawn edge does not stop being one because something soft crosses it.  The
# roll's near side runs up to meet the torn top of the sheet, and for the last
# few points of that run the reference's own shading lies over the edge and
# takes the contrast under HARD - so the run was being cut there and the tail
# thrown away for being too short, which left the roll not quite joined to the
# paper behind it.  A soft stretch this short between two hard ones is a
# smudge on a line, not a gap in it.
GAP = 10
# How far a run is allowed to carry on past the point where it fades out.
# A drawn line runs INTO the thing it meets; it does not stop a few pixels
# short of it and leave the join open.  The roll's near edge is the case that
# needs it: it climbs to meet the torn top of the sheet, loses its contrast in
# the last few pixels under the reference's own shading, and without this the
# sheet's top edge sails straight over the roll with nothing marking where it
# passes behind.  This is the same instinct as the overshoot in src/ink.js -
# a hand going past the corner rather than stopping exactly on it.


def rasterise(eps):
    tmp = Path(tempfile.mkdtemp()) / 'page.png'
    subprocess.run(['gs', '-q', '-dNOPAUSE', '-dBATCH', '-dEPSCrop',
                    '-sDEVICE=pngalpha', f'-r{DPI}', f'-sOutputFile={tmp}', str(eps)],
                   check=True)
    return Image.open(tmp).convert('RGBA')


def trace(mask):
    """Every outer contour in a binary mask, 8-connected, as pixel loops.

    Moore-neighbourhood border following.  Returns them longest first, since
    the long ones are the shapes and the short ones are almost always the
    stair-step round a corner.
    """
    h, w = mask.shape
    pad = np.zeros((h + 2, w + 2), bool)
    pad[1:-1, 1:-1] = mask
    seen = np.zeros_like(pad)
    nbr = [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]
    out = []
    ys, xs = np.nonzero(pad & ~np.roll(pad, 1, axis=0))      # a pixel with nothing above
    for y0, x0 in zip(ys, xs):
        if seen[y0, x0]:
            continue
        loop = [(x0, y0)]
        seen[y0, x0] = True
        cy, cx, d = y0, x0, 6
        for _ in range(4 * pad.size):
            for k in range(8):
                dy, dx = nbr[(d + k) % 8]
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < pad.shape[0] and 0 <= nx < pad.shape[1] and pad[ny, nx]:
                    d = ((d + k) + 5) % 8
                    cy, cx = ny, nx
                    break
            else:
                break
            if (cx, cy) == (x0, y0):
                break
            if not seen[cy, cx]:
                seen[cy, cx] = True
            loop.append((cx, cy))
        if len(loop) > 24:
            out.append([(x - 1, y - 1) for x, y in loop])
    out.sort(key=len, reverse=True)
    return out


def sobel(lum):
    """Local luminance jump per pixel - big on a drawn edge, small on a gradient."""
    gx = np.zeros_like(lum); gy = np.zeros_like(lum)
    gx[:, 1:-1] = (lum[:, 2:] - lum[:, :-2]) * 0.5
    gy[1:-1, :] = (lum[2:, :] - lum[:-2, :]) * 0.5
    return np.hypot(gx, gy)


def hard_runs(loop, grad, closed_ok=True):
    """Split a traced loop into the runs of it that lie on a real edge.

    Every point is asked how hard the picture jumps where it sits; the soft
    stretches - the ones that only exist because a gradient happened to cross
    a threshold - are dropped, and what is left is the drawing.
    """
    h, w = grad.shape
    hard = []
    for x, y in loop:
        y0, y1 = max(0, y - 2), min(h, y + 3)
        x0, x1 = max(0, x - 2), min(w, x + 3)
        hard.append(grad[y0:y1, x0:x1].max() if y1 > y0 and x1 > x0 else 0)
    hard = [v >= HARD for v in hard]
    # close the smudges before deciding where the line starts and stops
    n = len(hard)
    for i in range(n):
        if hard[i]:
            continue
        j = i
        while j < n and not hard[j]:
            j += 1
        if j - i <= GAP and i > 0 and j < n and hard[i - 1] and hard[j]:
            for k in range(i, j):
                hard[k] = True
    if all(hard) and closed_ok:
        return [(loop, True)]                      # the whole thing is drawn
    REACH = 7
    runs, cur, start = [], [], 0
    for idx, (p, ok) in enumerate(zip(loop, hard)):
        if ok:
            if not cur: start = idx
            cur.append(p)
        elif cur:
            if len(cur) >= RUN:
                runs.append((loop[max(0, start - REACH):idx + REACH], False))
            cur = []
    if len(cur) >= RUN:
        runs.append((loop[max(0, start - REACH):], False))
    # a loop that starts and ends hard is one run through the seam
    if len(runs) > 1 and hard[0] and hard[-1]:
        runs[0] = (runs[-1][0] + runs[0][0], False)
        runs.pop()
    return runs


def simplify(pts, eps):
    """Douglas-Peucker, iterative so a 40,000-point loop cannot blow the stack."""
    if len(pts) < 3:
        return pts
    keep = np.zeros(len(pts), bool)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    P = np.asarray(pts, float)
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        a, b = P[i], P[j]
        seg = b - a
        L = math.hypot(*seg)
        if L < 1e-9:
            d = np.hypot(*(P[i + 1:j] - a).T)
        else:
            rel = P[i + 1:j] - a
            d = np.abs(seg[0] * rel[:, 1] - seg[1] * rel[:, 0]) / L
        k = int(np.argmax(d))
        if d[k] > eps:
            keep[i + 1 + k] = True
            stack.append((i, i + 1 + k))
            stack.append((i + 1 + k, j))
    return [tuple(p) for p in P[keep]]


def main(eps_path, out_path):
    page = rasterise(eps_path)
    W, H = page.size
    box = (int(CROP[0] * W), int(CROP[1] * H), int(CROP[2] * W), int(CROP[3] * H))
    art = page.crop(box)
    art = art.crop(art.split()[3].getbbox())          # tight to the ink
    a = np.array(art)
    rgb = a[..., :3].astype(float)
    solid = a[..., 3] > 128
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]

    aw, ah = art.size
    scale = 1.0 / max(aw, ah)
    grad = sobel(np.where(solid, lum, 0.0))
    norm = lambda pts: [[round(x * scale, 4), round(y * scale, 4)] for x, y in pts]

    # WHAT GETS FILLED and WHAT GETS A LINE are two different questions.
    #
    # Filled: all four.  Band 1 is the reference's shadow, and it is shipped
    # separately from the rest precisely so the HUD can decide how much of it
    # to believe - see SCROLL_TURN in src/hud.js.  Filled at full strength it
    # is a dark wedge the reference does not have; dropped entirely, the sheet
    # stops reading as if it curves into the roll at all.  It is wanted faint.
    #
    # Lined: every band boundary, but only along the stretches of it where the
    # picture actually jumps.  That keeps the edge where the sheet disappears
    # behind the roll - a real edge, in the reference too - and throws away the
    # soft side of the same region, which is only the airbrush fading out.  So
    # the turn arrives as a change of colour with no line on it, which is what
    # a soft edge is.
    FILLED = {0, 1, 2, 3}
    layers, edges = [], []
    for band in range(4):
        hi = BANDS[band - 1] if band else 1e9
        lo = BANDS[band] if band < len(BANDS) else -1e9
        mask = solid if band == 0 else solid & (lum < hi) & (lum >= lo)
        loops = []
        for loop in trace(mask):
            if len(loop) < 40:
                continue
            xs = [p[0] for p in loop]; ys = [p[1] for p in loop]
            if (max(xs) - min(xs)) * (max(ys) - min(ys)) < MIN_AREA:
                continue
            if band in FILLED:
                loops.append(norm(simplify(loop, EPS)))
            for run, closed in hard_runs(loop, grad):
                run = simplify(run, EPS)
                if len(run) >= 3:
                    edges.append({'closed': closed, 'band': band, 'pts': norm(run)})
        layers.append(loops)
        print(f'band {band}: {len(loops)} filled region(s), '
              f'{sum(len(l) for l in loops)} points', file=sys.stderr)
    for t in EDGE_ONLY:
        for loop in trace(solid & (lum >= t)):
            if len(loop) < 40:
                continue
            for run, closed in hard_runs(loop, grad):
                run = simplify(run, EPS)
                if len(run) >= 3:
                    edges.append({'closed': closed, 'band': 2, 'pts': norm(run)})
    print(f'{len(edges)} drawn edge(s), '
          f'{sum(len(e["pts"]) for e in edges)} points '
          f'({sum(1 for e in edges if e["closed"])} closed)', file=sys.stderr)

    # THE BOX THE MAP GOES IN, measured rather than guessed.
    # The biggest axis-aligned rectangle that is nothing but flat sheet - no
    # roll, no turn, and inside the torn edges.  The HUD sizes the whole scroll
    # off this, so changing which design is cropped above cannot silently push
    # the city off the paper.
    clean = solid & (lum >= BANDS[0])
    heights = np.zeros(clean.shape[1], int)
    best = (0, 0, 0, 0, 0)                        # area, x, y, w, h
    for row in range(clean.shape[0]):
        heights = np.where(clean[row], heights + 1, 0)
        stack = []
        for col in range(clean.shape[1] + 1):
            hgt = heights[col] if col < clean.shape[1] else 0
            start = col
            while stack and stack[-1][1] >= hgt:
                s0, h0 = stack.pop()
                area = h0 * (col - s0)
                if area > best[0]:
                    best = (area, s0, row - h0 + 1, col - s0, h0)
                start = s0
            stack.append((start, hgt))
    _, ix, iy, iw, ih = best
    data = {'w': round(aw * scale, 4), 'h': round(ah * scale, 4),
            'bands': layers, 'edges': edges,
            'inner': [round(ix * scale, 4), round(iy * scale, 4),
                      round(iw * scale, 4), round(ih * scale, 4)]}
    print(f'inner box {iw}x{ih}px at {ix},{iy}  '
          f'({iw / aw:.2f} x {ih / ah:.2f} of the art)', file=sys.stderr)
    body = json.dumps(data, separators=(',', ':'))
    Path(out_path).write_text(
        '// GENERATED by preview/scroll-prep.py - do not edit by hand.\n'
        '//\n'
        '// The outlines of the scroll, traced off the stock EPS and stripped of\n'
        '// every bit of its airbrushing: four bands of flat region, in 0..1 units\n'
        '// of the drawing\'s longest side.  src/hud.js fills them in the HUD\'s own\n'
        '// colours and runs the city\'s drawn line round them.\n'
        '//\n'
        '// bands   what gets FILLED: 0 the silhouette, 2 the cut end of a rolled\n'
        '//         tube, 3 the hole down the middle of it.  Band 1 is the\n'
        '//         reference\'s shadow and is deliberately not among them - a\n'
        '//         shadow is not a shape, and filling it put a dark wedge and a\n'
        '//         hard edge down the sheet that the reference does not have.\n'
        '// edges   what gets a LINE: the stretches of those boundaries where the\n'
        '//         picture actually jumps.  The soft side of a band is only the\n'
        '//         airbrush fading out and is left undrawn.\n'
        '// inner   the largest rectangle of plain sheet, for the map to sit in\n'
        f'export const SCROLL_ART = {body};\n')
    print(f'wrote {out_path} ({len(body)} bytes)', file=sys.stderr)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
