#!/usr/bin/env python3
"""
Cut a piece of the bat footage into the game's look.

    python3 preview/quantize.py --in 41.5 --len 6 --sheet assets/bats-win.png
    python3 preview/quantize.py --mp4 preview/whole.mp4        # the lot, to scrub

The footage is not evenly lit.  There are lightning hits, a red-tinted stretch,
a frame that goes to pure white and a dozen smaller flashes, and a flat global
banding turns every one of them into a solid slab of one colour - the frame
stops being a picture.  So before anything is banded each frame is pulled onto
a common exposure (--regularise), and any frame with no contrast left in it at
all is dropped and the one before it held in its place.  The bands themselves
are still decided ONCE over the whole piece, or they crawl between frames and
the picture boils.
"""
import argparse, subprocess, sys
import numpy as np

VIEW_W, VIEW_H = 1280, 720
BLACK, BLOOD, LIT = (11, 11, 11), (207, 18, 6), (242, 84, 58)
PCTS = [2, 10, 30, 50, 70, 90, 98]       # the shape of a frame, in seven numbers
DEAD = 18                                # p98-p2 below this and there is no picture left


def ramp(n):
    stops = [BLACK, BLOOD] if n <= 4 else [BLACK, BLOOD, LIT]
    out = []
    for i in range(n):
        t = i / (n - 1) * (len(stops) - 1)
        a, b, f = stops[int(t)], stops[min(len(stops) - 1, int(t) + 1)], t - int(t)
        out.append(tuple(round(a[c] + (b[c] - a[c]) * f) for c in range(3)))
    return out


def read(path, t0, dur, fps, w, h):
    vf = f'fps={fps},scale={w}:{h}'
    cmd = ['ffmpeg', '-v', 'error']
    if t0: cmd += ['-ss', str(t0)]
    cmd += ['-i', path]
    if dur: cmd += ['-t', str(dur)]
    cmd += ['-vf', vf, '-f', 'rawvideo', '-pix_fmt', 'gray', '-']
    buf = subprocess.run(cmd, capture_output=True).stdout
    n = len(buf) // (w * h)
    return np.frombuffer(buf, np.uint8)[:n * w * h].reshape(n, h, w)


def regularise(frames, strength):
    """Pull every frame onto the exposure the clip mostly has."""
    pc = np.array([np.percentile(f, PCTS) for f in frames])     # n x 7
    ref = np.median(pc, axis=0)
    dead = (pc[:, -1] - pc[:, 0]) < DEAD
    out = np.empty_like(frames)
    last = None
    for i, f in enumerate(frames):
        if dead[i] and last is not None:
            out[i] = last                       # nothing in it: hold the frame before
            continue
        src = np.concatenate(([0], pc[i], [255]))
        dst = np.concatenate(([0], ref, [255]))
        src = np.maximum.accumulate(src)        # interp needs it going one way
        mapped = np.interp(np.arange(256), src, dst)
        lut = np.arange(256) * (1 - strength) + mapped * strength
        out[i] = np.clip(lut, 0, 255).astype(np.uint8)[f]
        last = out[i]
    return out, dead


def cuts(frames, n):
    """One set of band edges for the whole piece, on equal areas of picture."""
    flat = frames.reshape(-1)
    return np.percentile(flat, [100 * k / n for k in range(1, n)])


def band(frames, edges, cols):
    idx = np.digitize(frames, edges).astype(np.uint8)
    pal = np.array(cols, np.uint8)
    return pal[idx]                             # n x h x w x 3


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='assets/bats-dancing.mp4')
    ap.add_argument('--in', dest='t0', type=float, default=0)
    ap.add_argument('--len', dest='dur', type=float, default=0)
    ap.add_argument('--fps', type=int, default=12)
    ap.add_argument('--px', type=int, default=3, help='screen pixels per art pixel')
    ap.add_argument('--tones', type=int, default=4)
    ap.add_argument('--regularise', type=float, default=1.0, help='0 = off, 1 = full')
    ap.add_argument('--cols', type=int, default=8, help='sheet wrap')
    ap.add_argument('--sheet'), ap.add_argument('--mp4')
    ap.add_argument('--codec', default='libx264')
    ap.add_argument('--crf', type=int, default=26)
    ap.add_argument('--ffmpeg-out', default='/usr/bin/ffmpeg',
                    help='an ffmpeg that can encode h264 (the conda one often cannot)')
    a = ap.parse_args()

    w, h = VIEW_W // a.px, VIEW_H // a.px
    frames = read(a.src, a.t0, a.dur, a.fps, w, h)
    if not len(frames): sys.exit('no frames - check --src and --in')
    reg, dead = regularise(frames, a.regularise) if a.regularise > 0 else (frames, np.zeros(len(frames), bool))
    out = band(reg, cuts(reg, a.tones), ramp(a.tones))
    print(f"{len(frames)} frames  {w}x{h}  {a.tones} tones  "
          f"regularise {a.regularise}  frames held: {int(dead.sum())}")

    if a.sheet:
        from PIL import Image
        rows = (len(out) + a.cols - 1) // a.cols
        sheet = np.zeros((rows * h, a.cols * w, 3), np.uint8)
        for i, f in enumerate(out):
            r, c = divmod(i, a.cols)
            sheet[r*h:(r+1)*h, c*w:(c+1)*w] = f
        Image.fromarray(sheet).quantize(colors=a.tones).save(a.sheet, optimize=True)
        print(f"  -> {a.sheet}   WIN_BATS_W {w}  WIN_BATS_H {h}  "
              f"WIN_BATS_N {len(out)}  WIN_BATS_COLS {a.cols}")
    if a.mp4:
        # nearest-neighbour back up to the screen, so the blocks stay square
        import os
        enc = a.ffmpeg_out if os.path.exists(a.ffmpeg_out) else 'ffmpeg'
        p = subprocess.Popen(
            [enc, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
             '-s', f'{w}x{h}', '-r', str(a.fps), '-i', '-',
             # whatever h264 this ffmpeg has; four flat colours need no bitrate
             '-c:v', a.codec, '-pix_fmt', 'yuv420p', '-crf', str(a.crf), a.mp4],
            stdin=subprocess.PIPE)
        p.communicate(out.tobytes())
        # the scrub page needs to know where in the SOURCE this copy starts, or
        # the times it reports and the cut command it writes are off by --in
        import json
        json.dump({'in': a.t0, 'fps': a.fps, 'px': a.px, 'tones': a.tones,
                   'regularise': a.regularise, 'held': int(dead.sum()),
                   'frames': len(out)}, open(a.mp4 + '.json', 'w'))
        print(f"  -> {a.mp4}   starts at {a.t0:g}s of the source")


main()
