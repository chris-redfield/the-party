const MAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'bat',
  KeyE: 'use', Enter: 'start', Backspace: 'back',
  KeyQ: 'drop', KeyM: 'mute',
  BracketLeft: 'zoomOut', BracketRight: 'zoomIn',
  KeyR: 'restart',
};

// THERE IS NO PAUSE KEY IN THIS TABLE, and that is deliberate.
//
// It was Escape, which cannot work: the game ships to itch.io in a fullscreen
// embed and Escape belongs to the browser's Fullscreen API, so pressing it
// paused the night AND dropped the player out of fullscreen, every time.  It
// was briefly P, which nobody would ever guess.
//
// So pausing is ENTER, and Enter is already `start`.  The two never collide
// because they never share a screen: `start` chooses on the title card, opens
// the night from HOW TO PLAY, hurries the intro along and deals a fresh night
// from an end card, and every one of those is a state in which the game is
// not running.  `pause` is the only thing Enter can mean while it IS running.
// So the play branch in src/main.js reads `start` as the pause toggle rather
// than there being a second binding here - two actions on one key would fire
// together on HOW TO PLAY, where Enter starts the night and would also have
// to mean back.
//
// `back` is Backspace, and it only exists on the cards - the one place where
// there is somewhere to go back TO.

export function makeInput(onFirstKey) {
  const down = new Set();
  const edge = new Set();
  let woken = false;

  const key = (e) => MAP[e.code];

  window.addEventListener('keydown', (e) => {
    const a = key(e);
    if (!a) return;
    e.preventDefault();
    if (!woken) { woken = true; onFirstKey && onFirstKey(); }
    if (!down.has(a)) edge.add(a);
    down.add(a);
  });
  window.addEventListener('keyup', (e) => {
    const a = key(e);
    if (!a) return;
    e.preventDefault();
    down.delete(a);
  });
  window.addEventListener('blur', () => { down.clear(); });

  return {
    get x() { return (down.has('right') ? 1 : 0) - (down.has('left') ? 1 : 0); },
    get y() { return (down.has('down') ? 1 : 0) - (down.has('up') ? 1 : 0); },
    held: (a) => down.has(a),
    pressed: (a) => edge.has(a),
    endFrame: () => edge.clear(),
  };
}
