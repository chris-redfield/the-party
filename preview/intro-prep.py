#!/usr/bin/env python3
"""
Prepare the label screen's art for THE PARTY.

    python3 preview/intro-prep.py ../saborosa/beatemup-dungeon/dist/assets-v2/flying-dungeon

The screen itself is BATIDAO DE COCO's - the compost with the vermin crawling
over it and the SABOROSA label on top - and it arrives here in this game's two
colours instead of its own.  The crawl goes to grey, the label goes to blood.
Both are done here rather than in the browser: the photographs are 3002 x 1687
and the game draws at 1280 x 720, so shipping them at source size would be five
and a half times the pixels for no picture, and re-tinting fifteen million of
them at every launch for a screen that lasts three seconds is worse.
"""
import sys, pathlib
from PIL import Image

W, H = 1280, 720
BLOOD = (207, 18, 6)
src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
out = pathlib.Path('assets/intro-screen'); out.mkdir(parents=True, exist_ok=True)

# --- the crawl: grey, and the worms with it (they are drawn into the frames) -
for i in (1, 2, 3):
    f = src / 'game-over' / f'saborosa-natureza-vermes-{i:03d}.webp'
    im = Image.open(f).convert('L').resize((W, H), Image.LANCZOS)
    p = out / f'vermes-{i}.webp'
    im.save(p, quality=82, method=6)
    print(f'{p}  {W}x{H} grey  {p.stat().st_size // 1024} kB')

# --- the label: its own shading, carried up a black-to-blood ramp ------------
# Not a flat silhouette: the drawing has a black outline and three flat colours
# inside it, and mapping brightness onto the ramp keeps that reading while
# putting the whole thing in the one colour this game has.
lg = Image.open(src / 'saborosa-logo.webp').convert('RGBA')
lum = lg.convert('L')
red = Image.new('RGBA', lg.size)
sp, lp, rp = lg.load(), lum.load(), red.load()
for y in range(lg.height):
    for x in range(lg.width):
        v = lp[x, y] / 255
        rp[x, y] = (round(BLOOD[0] * v), round(BLOOD[1] * v), round(BLOOD[2] * v), sp[x, y][3])
p = out / 'logo.webp'
red.save(p, quality=90, method=6, lossless=False)
print(f'{p}  {red.width}x{red.height} blood  {p.stat().st_size // 1024} kB')
