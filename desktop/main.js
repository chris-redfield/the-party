'use strict';
//
// main.js - the desktop shell for THE PARTY.
//
// The game itself is NOT ported and NOT touched. `game/` below is a byte-for-
// byte copy of the itch.io build that package.sh already produces and already
// proves loads. This file only does the four things a browser was doing for
// us and Steam will not:
//
//   1. SERVE THE FILES OVER A REAL ORIGIN.  The game is ES modules, and the
//      spec forbids `import` from `file://` - loadFile() would open on a
//      black screen with a CORS error, which is the single most common way
//      this kind of port "mysteriously fails". So we register `party://` as a
//      standard scheme and answer from disk. Same reason the README tells you
//      to run a web server in dev.
//   2. OPEN A WINDOW that is 1280x720, or fullscreen, and nothing else - no
//      menu bar, no Ctrl+W, no address bar, no accidental navigation.
//   3. LET THE STEAM OVERLAY IN (the --in-process-gpu business below).
//   4. PROVE ITSELF.  `--selftest` plays the real packaged build, counts every
//      file the game asked for and did not get, and refuses with a non-zero
//      exit if there was a single one. It is package.sh's "one 404 and it is
//      not a release" rule, carried into the executable.
//
const { app, BrowserWindow, Menu, protocol, shell } = require('electron');
const fsp = require('node:fs/promises');
const path = require('node:path');

const GAME_DIR = path.join(__dirname, 'game');
const SCHEME = 'party';
const START = `${SCHEME}://game/index.html`;
const VIEW_W = 1280, VIEW_H = 720;

// ---------------------------------------------------------------------------
// Flags. All optional; the shipped build is launched with none of them.
//   --windowed            open in a 1280x720 window instead of fullscreen
//   --dev                 F12 opens devtools, renderer console is mirrored
//   --no-overlay-hack     drop --in-process-gpu (see below)
//   --selftest[=out.png]  load, screenshot, report, quit
// ---------------------------------------------------------------------------
const argv = process.argv.slice(1);
const flag = (name) => argv.some((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const flagVal = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const WINDOWED = flag('windowed') || process.env.PARTY_WINDOWED === '1';
const DEV = flag('dev');
// Safe mode: for a machine whose compositor does not work - a container, a
// shell with a syscall filter over shared memory, a broken driver. It gives
// up the GPU, keeps Chromium's shared memory off /dev/shm, and drives frames
// off a timer instead of off the compositor. Slower, and it runs.
const SAFE = flag('safe-mode') || process.env.PARTY_SAFE_MODE === '1';
const SELFTEST = flag('selftest');
// --ending also drives the scripted run into the winning card, which is the
// one place the game plays 39 seconds of H.264 and the only thing a machine's
// video decoding can break on its own.
const ENDING = flag('ending');
const SELFTEST_PNG = flagVal('selftest', path.join(app.getPath('temp'), 'the-party-selftest.png'));
// The scripted run always drives its own frames; a normal run only does so in
// safe mode, or if asked.
const SOFT_FRAMES = (SELFTEST || SAFE || flag('soft-frames')) && !flag('no-soft-frames');

// The Steam overlay draws by hooking the process that owns the GL context.
// Chromium puts that in a separate GPU process, which Steam does not follow,
// so without this switch the overlay (and therefore Shift+Tab, screenshots
// and the browser) silently does nothing. It is a workaround for Steam's side
// and it is reported to misbehave on some Nvidia setups, so it is one flag
// away from being off: ship with it, and if a player reports a black window
// or a GPU crash, `--no-overlay-hack` is the thing to have them try.
if (!flag('no-overlay-hack') && process.env.PARTY_OVERLAY_HACK !== '0') {
  app.commandLine.appendSwitch('in-process-gpu');
}

// Chromium wants /dev/shm for every frame it composites, and it is FATAL
// rather than graceful when it cannot have it:
//
//   FATAL:platform_shared_memory_region_posix.cc(219)] Creating shared memory
//   in /dev/shm/.org.chromium.Chromium.pcdijw failed: No such process (3)
//
// The game dies before it draws a pixel, and this is not a rare machine: it
// took one laptop, on Ubuntu 22.04, with a /dev/shm that is mode 1777 with
// 16 GB free, where `touch /dev/shm/x` works, where a probe run from THIS
// process writes there happily, and where Chrome itself runs fine. Whatever
// answers that syscall answers it only for us, and it answers `ESRCH`, which
// `access()` is not supposed to be able to return at all.
//
// So Linux does not get a vote. Chromium's shared memory goes to the temp
// directory, which is what every container on earth already does, and the
// cost on a healthy machine - a canvas game's worth of frames through /tmp
// instead of a RAM disk - is not worth one player in ten seeing a dead
// window. `--use-dev-shm` puts it back.
if (process.platform === 'linux' && !flag('use-dev-shm')) {
  app.commandLine.appendSwitch('disable-dev-shm-usage');
}
if (SAFE) app.commandLine.appendSwitch('disable-gpu');

// The music is fetched on the first keypress, so autoplay gating has never
// bitten us - but a desktop build has no business being gated at all.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// ---------------------------------------------------------------------------
// THE LINUX SANDBOX IS OFF, and it is off for two separate reasons.
//
// The first is Steam: Electron's Linux sandbox needs a setuid-root
// chrome-sandbox helper, Steam unpacks a depot as the player, which strips
// that, and the game refuses to start with "SUID sandbox helper binary ... is
// not configured correctly".
//
// The second was found the hard way, on one Ubuntu 22.04 laptop running
// kernel 6.8, and it is worth writing down because it looks like three other
// bugs before it looks like this one:
//
//   ERROR:platform_shared_memory_region_posix.cc(214)] Creating shared memory
//   in /dev/shm/... failed: No such process (3)
//
// It is FATAL on /dev/shm and a black window everywhere else. /dev/shm is
// innocent - send Chromium to /tmp instead and it fails there identically,
// with the same `ESRCH`, an errno `access()` cannot return. The directory is
// not the subject of that sentence. **It is Chromium's own seccomp filter
// answering for a syscall it does not allow**, inside the sandboxed renderer,
// on a kernel newer than the filter. The process can create the file; the
// policy will not let it. Chrome on the same machine is fine because Chrome's
// sandbox is installed properly and ours is a prebuilt binary in a home
// directory.
//
// What makes it hard to see: the only configuration that ever worked was one
// that happened to also set `sandbox: false` on the window for an unrelated
// reason, so the fix looked like it was about frames.
//
// We render nothing but our own local files from our own scheme, with no node
// in the renderer, so there is no remote content for a sandbox to contain.
// `--with-sandbox` puts both halves back, for testing this claim.
const LINUX_UNSANDBOXED = process.platform === 'linux' && !flag('with-sandbox');
if (LINUX_UNSANDBOXED) app.commandLine.appendSwitch('no-sandbox');

// ---------------------------------------------------------------------------
// party:// - standard scheme, so the page gets a real origin and ES modules,
// fetch, and media all behave exactly as they do under python3 -m http.server.
// ---------------------------------------------------------------------------
protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.otf': 'font/otf',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.mp4': 'video/mp4', '.m4a': 'audio/mp4', '.webm': 'video/webm',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.txt': 'text/plain',
};

const misses = [];   // every path the game asked for and did not get

function handle(req) {
  const u = new URL(req.url);
  // decodeURIComponent because one sprite sheet is called
  // "party-shadow beasts-01.png" - a space in a filename arrives percent-
  // encoded and a naive join looks for a file named "...%20beasts...".
  const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
  const file = path.join(GAME_DIR, rel);
  // Nothing outside game/ is reachable, whatever the page asks for.
  if (!file.startsWith(GAME_DIR + path.sep)) {
    misses.push(rel + ' (outside game/)');
    return new Response('forbidden', { status: 403 });
  }
  return serve(file, rel, req);
}

async function serve(file, rel, req) {
  let body;
  try {
    body = await fsp.readFile(file);
  } catch (e) {
    // favicon.ico is the browser asking on its own behalf, not the game -
    // package.sh forgives it and so do we.
    if (!/(^|\/)favicon\.ico$/.test(rel)) misses.push(rel);
    return new Response('not found', { status: 404 });
  }
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = { 'content-type': type, 'accept-ranges': 'bytes' };

  // Chromium asks for media in ranges once a server says it can. The ending
  // clip and the soundtrack are the two files this matters for; answering 200
  // with the whole body to a Range request makes the media element give up.
  const range = req.headers.get('range');
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (m) {
    const total = body.length;
    let start = m[1] === '' ? total - Number(m[2]) : Number(m[1]);
    let end = m[1] === '' || m[2] === '' ? total - 1 : Number(m[2]);
    start = Math.max(0, Math.min(start, total - 1));
    end = Math.max(start, Math.min(end, total - 1));
    return new Response(body.subarray(start, end + 1), {
      status: 206,
      headers: { ...headers, 'content-range': `bytes ${start}-${end}/${total}`, 'content-length': String(end - start + 1) },
    });
  }
  return new Response(body, { status: 200, headers });
}

// ---------------------------------------------------------------------------
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: VIEW_W, height: VIEW_H,
    useContentSize: true,
    minWidth: 640, minHeight: 360,
    backgroundColor: '#07060c',   // the page's own background: no white flash
    fullscreen: !WINDOWED && !SELFTEST,
    // A window created hidden only becomes visible on 'ready-to-show', which
    // is itself a paint - and a renderer that is not visible has its
    // requestAnimationFrame suspended. The scripted run therefore opens
    // visible: hidden-then-show deadlocks it at zero frames.
    show: SELFTEST,
    paintWhenInitiallyHidden: true,
    autoHideMenuBar: true,
    title: 'THE PARTY',
    webPreferences: {
      // The game is a page with no privileges: no node, isolated, sandboxed.
      // Soft frames are the one exception - the preload has to patch
      // requestAnimationFrame in the page's OWN world, which an isolated
      // context by definition forbids. See soft-frames.js.
      contextIsolation: !SOFT_FRAMES,
      nodeIntegration: false,
      sandbox: !SOFT_FRAMES && !LINUX_UNSANDBOXED,
      preload: SOFT_FRAMES ? path.join(__dirname, 'soft-frames.js') : undefined,
      backgroundThrottling: false,  // a six-minute clock must not slow down
      // The game is a canvas game at a fixed 1280x720 logical size; smoothing
      // is the page's own business (css sets image-rendering: pixelated).
    },
  });

  // No application menu at all: it is what makes Ctrl+W, Ctrl+R and Alt
  // dead keys in a shipped build.
  Menu.setApplicationMenu(null);

  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });

  // Nothing in this game navigates or opens a window. If it ever does, it
  // goes to the player's real browser, not into our frameless game window.
  win.webContents.on('will-navigate', (e, url) => { if (url !== START) e.preventDefault(); });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });

  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    // F11 and Alt+Enter are what players reach for. ENTER alone is the game's
    // pause key, so the alt is not optional.
    if (input.key === 'F11' || (input.key === 'Enter' && input.alt)) {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
    if (DEV && input.key === 'F12') win.webContents.toggleDevTools();
  });

  win.loadURL(START);
  return win;
}

app.whenReady().then(() => {
  protocol.handle(SCHEME, handle);
  createWindow();
  if (SELFTEST) selftest();
  else if (!SAFE) watchdog();
});

// ---------------------------------------------------------------------------
// A black window that never becomes anything is the worst failure this shell
// has, because the game is in fact loaded and fine: the page is laid out, the
// city is built, the loader finished - and the machine never produced a frame,
// so requestAnimationFrame was never called and nothing ever moved. There is
// nothing for a player to see and nothing for them to report.
//
// So we look. If twenty seconds in the page cannot get a single frame, the
// compositor is not coming, and the game restarts itself in safe mode, which
// does not need one. Safe mode never gets here, so this cannot loop.
// ---------------------------------------------------------------------------
function restartSafe(why) {
  console.error(`[the-party] ${why}`);
  console.error('[the-party] restarting in safe mode (--safe-mode to skip the wait).');
  app.relaunch({ args: process.argv.slice(1).concat('--safe-mode') });
  app.exit(0);
}

function watchdog() {
  // The GPU process dying is the loud version of the same illness and needs no
  // waiting: nothing is going to be composited after that.
  app.on('child-process-gone', (e, d) => {
    if (d.type === 'GPU') restartSafe(`the GPU process is gone (${d.reason}).`);
  });

  // The quiet version. Eight seconds, not twenty: this asks the PAGE for a
  // frame, which has nothing to do with the game's own loader, so there is
  // nothing to wait out. A machine that is merely slow still answers.
  win.webContents.once('did-finish-load', () => setTimeout(async () => {
    const frames = await win.webContents.executeJavaScript(`new Promise((res) => {
      let n = 0; const t0 = performance.now();
      const step = () => { n++; if (performance.now() - t0 < 600) requestAnimationFrame(step); else res(n); };
      requestAnimationFrame(step);
      setTimeout(() => res(n), 2500);
    })`).catch(() => 0);
    if (frames > 0) return;
    restartSafe('no frames in 8 s: this machine is not compositing.');
  }, 8000));
}

app.on('window-all-closed', () => app.quit());

// ---------------------------------------------------------------------------
// --selftest: the packaged build playing itself and grading the result.
//
// It waits long enough for main.js's own loader to finish (it blocks on the
// label's four pictures, the character sheets and the typeface, with an eight
// second floor), presses ENTER to leave the title card, screenshots the real
// window, then reports. A single file the game asked for and did not get is
// a failed build, same rule as package.sh.
// ---------------------------------------------------------------------------
function selftest() {
  const errors = [];
  win.webContents.on('console-message', (e, level, message) => {
    // Electron's own development-time security warning is not the game's
    // output and does not appear in a packaged build. Everything else at
    // error level is a failed run.
    if (level >= 3 && !/Electron Security Warning/.test(message)) errors.push(message);
    if (DEV) console.log(`   [renderer] ${message}`);
  });
  win.webContents.on('did-fail-load', (e, code, desc, url) => errors.push(`did-fail-load ${code} ${desc} ${url}`));
  win.webContents.on('render-process-gone', (e, d) => errors.push(`render-process-gone ${d.reason}`));

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const js = (src) => win.webContents.executeJavaScript(src).catch((e) => String(e));
  const state = () => js(`(window.PARTY && PARTY.game && PARTY.game.state) || 'none'`);

  // A press has to be HELD for at least one frame: `input.pressed` is an edge
  // read once per frame, so a down and up inside the same tick is never
  // observed and the menu does not move. These are real OS-level key events
  // through the shell rather than events dispatched inside the page, so a
  // pass also proves input arrives in the packaged app.
  const press = async (keyCode = 'Return') => {
    win.focus();
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode });
    await wait(150);
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode });
  };

  win.webContents.once('did-finish-load', async () => {
    // main.js blocks on the label's pictures, the character sheets and the
    // typeface before the first screen, with an eight second floor under it.
    await wait(14000);

    // ENTER on the menu commits PLAY, and again through HOW TO PLAY and the
    // drawn intro, which ENTER also rushes. Nothing is pressed once the city
    // is up, because in `play` ENTER is the pause key.
    let st = await state();
    const deadline = Date.now() + 30000;
    while (st !== 'play' && Date.now() < deadline) {
      await press();
      await wait(600);
      st = await state();
    }
    await wait(1500);   // let the camera settle onto the player

    const probe = await js(`(async () => {
      // How many frames the page actually got in half a second. A shell whose
      // window is never composited still loads and lays out the page - the
      // canvas is the right size, the city is built - but requestAnimationFrame
      // never fires, nothing animates, no input edge is ever read, and the
      // game sits on the title screen looking like a broken build.
      const frames = await new Promise((res) => {
        let n = 0; const t0 = performance.now();
        const step = () => { n++; if (performance.now() - t0 < 500) requestAnimationFrame(step); else res(n); };
        requestAnimationFrame(step);
        setTimeout(() => res(n), 2000);
      });
      const c = document.getElementById('game');
      const P = window.PARTY, g = P && P.game;
      return {
        frames,
        canvas: c ? c.width + 'x' + c.height : 'NO CANVAS',
        hooks: !!P,
        state: g ? g.state : '?',
        clock: g && g.clock ? g.clock.t.toFixed(1) : -1,
        doors: g && g.city && g.city.doors ? g.city.doors.length : -1,
        player: g && g.player ? Math.round(g.player.x) + ',' + Math.round(g.player.y) : '?',
        // The ending's clip is never in the DOM - it is a texture, not an
        // element - so the only way to ask whether this machine decodes it is
        // to decode it. Same file, same protocol, nothing else running.
        video: await new Promise((res) => {
          const v = document.createElement('video');
          v.muted = true;
          v.oncanplaythrough = () => res('decodes');
          v.onerror = () => res('FAILS: ' + (v.error ? v.error.message || v.error.code : '?'));
          v.src = 'party://game/assets/bats-ending.mp4';
          setTimeout(() => res('timeout at readyState ' + v.readyState), 12000);
        }),
        music: (() => { const a = document.querySelector('audio'); return a ? (a.paused ? 'paused' : 'playing') : 'none'; })(),
      };
    })()`);

    // Two ways to get the picture, in order of fidelity:
    //   1. capturePage - the real window as the compositor drew it.
    //   2. the canvas' own pixels, read out of the page. Needs no compositor,
    //      so it is what comes back on a machine that cannot produce a frame,
    //      and it is still the game's real output, drawn by the real renderer
    //      out of the real party:// files.
    let shot = 'none';
    const png = await win.webContents.capturePage({ x: 0, y: 0, width: VIEW_W, height: VIEW_H });
    if (!png.isEmpty()) {
      await fsp.writeFile(SELFTEST_PNG, png.toPNG());
      shot = `${png.getSize().width}x${png.getSize().height} window`;
    } else {
      const data = await js(`document.getElementById('game').toDataURL('image/png')`);
      const buf = Buffer.from(String(data).split(',')[1] || '', 'base64');
      await fsp.writeFile(SELFTEST_PNG, buf);
      shot = `${(buf.length / 1024).toFixed(0)} kB canvas readback (this machine composites nothing)`;
    }

    // The winning card, pinned to a chosen beat so the capture is comparable
    // between runs - it runs off game.endT, not off the page clock.
    let ending = '';
    if (ENDING) {
      await js(`(() => { PARTY.win(); setInterval(() => { PARTY.game.endT = 2.2; }, 8); })()`);
      await wait(4000);
      const file = SELFTEST_PNG.replace(/(\.png)?$/i, '-ending.png');
      const cap = await win.webContents.capturePage({ x: 0, y: 0, width: VIEW_W, height: VIEW_H });
      if (!cap.isEmpty()) await fsp.writeFile(file, cap.toPNG());
      else await fsp.writeFile(file, Buffer.from(String(
        await js(`document.getElementById('game').toDataURL('image/png')`)).split(',')[1] || '', 'base64'));
      ending = `${file}  state=${await js(`PARTY.game.state`)}`;
    }

    console.log('');
    console.log('   electron ' + process.versions.electron + ' / chrome ' + process.versions.chrome);
    console.log('   probe    ' + JSON.stringify(probe));
    console.log('   shot     ' + SELFTEST_PNG + '  ' + shot);
    if (ending) console.log('   ending   ' + ending);
    if (misses.length) {
      console.log('   MISSING  ' + misses.length + ' request(s) the game made and did not get:');
      for (const m of [...new Set(misses)]) console.log('            ' + m);
    } else {
      console.log('   missing  none');
    }
    if (errors.length) {
      console.log('   ERRORS   ' + errors.length);
      for (const m of errors.slice(0, 10)) console.log('            ' + m);
    } else {
      console.log('   errors   none');
    }

    // The same rule package.sh ends on: one thing the game asked for and did
    // not get and this is not a release. Plus: it has to have reached the
    // city, under its own frames, with a picture to show for it.
    const ok = !misses.length && !errors.length && probe
      && probe.state === 'play' && probe.frames > 0 && probe.canvas === VIEW_W + 'x' + VIEW_H;
    console.log('   ' + (ok ? 'SELFTEST PASS' : 'SELFTEST FAIL'));
    app.exit(ok ? 0 : 1);
  });
}
