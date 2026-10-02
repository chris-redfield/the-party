'use strict';
//
// soft-frames.js - a preload loaded only by `--selftest`, `--safe-mode` or
// `--soft-frames`. A normal run never sees this file.
//
// Why it exists: a compositor-less machine - a CI box, a container, a shell
// with no shared memory - loads the page, lays it out and runs its modules
// perfectly well, but never produces a frame, so requestAnimationFrame is
// never called and the game sits on its title screen forever. That looks
// exactly like a broken build and it is not one.
//
// So these runs drive frames off setTimeout instead, which is the same trick
// dev-harness.html plays on headless Chrome. The timestamps stay real, so dt
// and the six-minute clock are unaffected, and the game is fully playable -
// it is how the first build anybody played was running.
//
let frames = 0;
const raf = (cb) => setTimeout(() => { frames++; cb(performance.now()); }, 16);
window.requestAnimationFrame = raf;
window.cancelAnimationFrame = (id) => clearTimeout(id);
Object.defineProperty(window, '__selftestFrames', { get: () => frames });
