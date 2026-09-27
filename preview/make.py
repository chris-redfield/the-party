# The look they picked - black shadows cut out of the end card's blood - at a
# range of fidelities.  Two dials only: how big an art pixel is, and how many
# tones of red the room is allowed.  Everything is decided once over the whole
# segment, never per frame, or the bands crawl and the picture boils.
from PIL import Image, ImageOps, ImageFilter
import glob, sys, os, json

W, H = 1280, 720
hexc = lambda h: tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
BLACK, BLOOD, LIT = '#0b0b0b', '#cf1206', '#f2543a'

def ramp(n):
    """black -> blood -> a hot edge, as n flat steps"""
    if n == 2: return [hexc(BLACK), hexc(BLOOD)]
    stops = [hexc(BLACK), hexc(BLOOD)] if n <= 4 else [hexc(BLACK), hexc(BLOOD), hexc(LIT)]
    out = []
    for i in range(n):
        t = i / (n - 1) * (len(stops) - 1)
        a, b, f = stops[int(t)], stops[min(len(stops) - 1, int(t) + 1)], t - int(t)
        out.append(tuple(round(a[c] + (b[c] - a[c]) * f) for c in range(3)))
    return out

frames = [Image.open(f).convert('L') for f in sorted(glob.glob(sys.argv[1] + '/*.png'))]

def prep(im, bw, tones):
    # smoothing has to come down as the pixels get smaller, or fine work that
    # is the whole point of a finer grid gets wiped off before it is banded
    src = im.filter(ImageFilter.MedianFilter(5 if bw >= 6 else 3)) if bw >= 3 else im
    s = src.resize((W // bw, H // bw), Image.LANCZOS)
    return s.filter(ImageFilter.MedianFilter(3)) if tones == 2 and bw >= 4 else s

def cuts(smalls, n):
    hist = [0] * 256
    for s in smalls:
        for i, c in enumerate(s.histogram()): hist[i] += c
    total = sum(hist); want = [total * k / n for k in range(1, n)]
    out, run, wi = [], 0, 0
    for v in range(256):
        run += hist[v]
        while wi < len(want) and run >= want[wi]: out.append(v); wi += 1
    return out + [256] * (n - 1 - len(out))

def band(s, cut, cols):
    lut = []
    for v in range(256):
        b = 0
        while b < len(cut) and v >= cut[b]: b += 1
        lut.append(b)
    idx = s.point(lut)
    out = Image.new('RGB', s.size); px, ip = out.load(), idx.load()
    for y in range(s.size[1]):
        for x in range(s.size[0]): px[x, y] = cols[ip[x, y]]
    return out

#        name     art px  tones
VARIANTS = [('v6_2',  6, 2),     # what they saw
            ('v4_2',  4, 2),
            ('v3_2',  3, 2),     # 3 px IS the game's own art pixel (PX 2 x zoom 1.5)
            ('v3_3',  3, 3),
            ('v3_4',  3, 4),
            ('v2_5',  2, 5)]     # nearly the footage again
out = {}
for name, bw, n in VARIANTS:
    smalls = [prep(f, bw, n) for f in frames]
    cut = cuts(smalls, n); cols = ramp(n)
    tiles = [band(s, cut, cols) for s in smalls]
    w, h = tiles[0].size
    cn = 8; rows = (len(tiles) + cn - 1) // cn
    sheet = Image.new('RGB', (w * cn, h * rows), (0, 0, 0))
    for i, t in enumerate(tiles): sheet.paste(t, ((i % cn) * w, (i // cn) * h))
    sheet = sheet.quantize(colors=max(2, n), method=Image.MEDIANCUT)
    sheet.save(f"{sys.argv[2]}/{name}.png", optimize=True)
    out[name] = dict(w=w, h=h, n=len(tiles), cols=cn, px=bw, tones=n)
    print(f"{name}  {bw}px  {n} tones  tile {w}x{h}  "
          f"sheet {os.path.getsize(f'{sys.argv[2]}/{name}.png')//1024} kB")
json.dump(out, open(sys.argv[2] + '/meta2.json', 'w'))
