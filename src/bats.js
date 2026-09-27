// ---------------------------------------------------------------------------
// THE PARTY
// ---------------------------------------------------------------------------
// You find the door, you knock, and the night ends on what was behind it: a
// room of bats, hanging in a row and swaying, cut out of the same blood the
// card has always been.  It is footage, not drawing - but it is flattened to
// four flat tones off the end card's red and dropped onto the game's own art
// pixel, so it comes out as poster art rather than as a video playing in a
// window.  preview/quantize.py does the flattening and README says why the
// exposure has to be regularised first.
//
// Two sources, chosen by END.source, because they are good at different
// things:
//   'video'  assets/bats-ending.mp4  - 39 s, 2 MB, but it has to decode
//   'sheet'  assets/bats-win.png     - 4.5 s, 414 kB, one drawImage, cannot fail
// The video is the default and the strip is its fallback, so a browser that
// will not play it still gets bats rather than a flat card.
// ---------------------------------------------------------------------------
import {
  VIEW_W, VIEW_H, WIN_BATS, END, END_TONES,
  WIN_BATS_W, WIN_BATS_H, WIN_BATS_N, WIN_BATS_COLS,
} from './config.js';

// Resolved against this module, not against the page, so preview/ending.html
// loads the same two files the game does.
const SHEET_SRC = new URL('../assets/bats-win.png', import.meta.url).href;
const VIDEO_SRC = new URL('../assets/bats-ending.mp4', import.meta.url).href;

let sheet = null, sheetOk = false;
let video = null, videoOk = false;
let lastT = -1;            // < 0 means the card has not been drawn yet

export function loadBats() {
  if (!WIN_BATS || sheet) return;
  sheet = new Image();
  sheet.onload = () => { sheetOk = true; };
  sheet.onerror = () => { sheetOk = false; };
  sheet.src = SHEET_SRC;

  video = document.createElement('video');
  video.muted = true;                 // or nothing will autoplay
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  // `canplay` is not enough: the first draw of a video with no data yet is a
  // blank frame, and a blank frame on the winning card is a bug you only see
  // once in a hundred runs
  video.oncanplaythrough = () => { videoOk = true; };
  video.onerror = () => { videoOk = false; };
  video.src = VIDEO_SRC;
}

export const batsReady = () => sheetOk || videoOk;

/** Which of the two is actually going to be painted - for preview/ending.html
 *  and for anyone wondering why the card is flat. */
export const batsUsing = () =>
  (END.source === 'video' && videoOk) ? 'video' : sheetOk ? 'sheet' : 'none';

// The art pixel is PX x zoom = 3 screen pixels, and both sources are cut to
// it, so this is a whole-number blow-up and the blocks stay square.  426 x 3
// is two short of the screen, which is why it starts one pixel in rather than
// at the edge - the alternative is a fractional scale and shimmering blocks.
const SCALE = Math.floor(VIEW_H / WIN_BATS_H);           // 3
const W = WIN_BATS_W * SCALE, H = WIN_BATS_H * SCALE;
const OFF_X = Math.floor((VIEW_W - W) / 2);

/**
 * Paint the room behind the card.  `t` is seconds since the night ended.
 *
 * The <video> keeps its own clock and is left alone to run on it - matching it
 * to `t` every frame means seeking every frame, and a seek leaves it with no
 * decoded frame for a moment, which paints NOTHING and drops the card out from
 * under the lettering.  So it is only moved when `t` does something playback
 * cannot explain: jumps, runs backwards (the night went again), or stops dead
 * (preview/ending.html holding a still).
 *
 * And it can still come up empty - while seeking, while buffering, in the
 * first moments - so any frame the video cannot supply is drawn from the strip
 * instead.  There is always a picture or there is no card.  Returns false only
 * when neither source loaded, and the caller lays the flat red card down.
 */
export function drawBats(ctx, t) {
  const dt = t - lastT;
  const held = lastT >= 0 && dt === 0;          // the clock is not moving
  const jumped = lastT < 0 || dt < 0 || dt > 0.25;
  lastT = t;
  ctx.imageSmoothingEnabled = false;

  if (END.source === 'video' && videoOk) {
    const dur = video.duration || 0;
    if (jumped && dur) seek(t % dur);
    if (held) video.pause();
    else if (video.paused) video.play().catch(() => {});
    // HAVE_CURRENT_DATA: there is a frame in there to draw
    if (video.readyState >= 2) {
      ctx.drawImage(END.snap ? snapped() : video, OFF_X, 0, W, H);
      return true;
    }
  }

  if (!sheetOk) return false;
  const f = Math.floor(t * END.fps) % WIN_BATS_N;
  const sx = (f % WIN_BATS_COLS) * WIN_BATS_W;
  const sy = Math.floor(f / WIN_BATS_COLS) * WIN_BATS_H;
  ctx.drawImage(sheet, sx, sy, WIN_BATS_W, WIN_BATS_H, OFF_X, 0, W, H);
  return true;
}

function seek(to) {
  try { video.currentTime = to; } catch (e) { /* not seekable yet */ }
}

// ---------------------------------------------------------------------------
// Putting the four tones back
// ---------------------------------------------------------------------------
// The clip is four flat colours and the encoder does not believe it: chroma
// subsampling and ringing leave nearly every pixel a little off one of them,
// which on flat art reads as a rendering fault rather than as compression.
// Snapping fixes it exactly, and is cheap here because it happens at art size
// - 426 x 240, a ninth of the screen - and only when the video has actually
// turned over a frame, which at 12 fps is a fifth of the times we draw.
//
// The four tones differ almost entirely in red (11, 76, 142, 207), so the band
// is picked off that one channel through a 256-entry table and the other two
// come along with it.
const TONE = END_TONES.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
const BAND = (() => {
  const lut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    let best = 0, d = 1e9;
    for (let i = 0; i < TONE.length; i++) {
      const e = Math.abs(v - TONE[i][0]);
      if (e < d) { d = e; best = i; }
    }
    lut[v] = best;
  }
  return lut;
})();

let snapCanvas = null, snapCtx = null, snapAt = -1;

function snapped() {
  if (!snapCanvas) {
    snapCanvas = document.createElement('canvas');
    snapCanvas.width = WIN_BATS_W; snapCanvas.height = WIN_BATS_H;
    snapCtx = snapCanvas.getContext('2d', { willReadFrequently: true });
  }
  if (video.currentTime === snapAt) return snapCanvas;   // same frame as last time
  snapAt = video.currentTime;

  snapCtx.drawImage(video, 0, 0, WIN_BATS_W, WIN_BATS_H);
  const img = snapCtx.getImageData(0, 0, WIN_BATS_W, WIN_BATS_H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const t = TONE[BAND[d[i]]];
    d[i] = t[0]; d[i + 1] = t[1]; d[i + 2] = t[2];
  }
  snapCtx.putImageData(img, 0, 0);
  return snapCanvas;
}
