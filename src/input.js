const MAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'bat',
  KeyE: 'use', Enter: 'start',
  KeyQ: 'drop', KeyM: 'mute',
  BracketLeft: 'zoomOut', BracketRight: 'zoomIn',
  KeyR: 'restart', Escape: 'pause', KeyP: 'pause',
};

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
