// input.js — keyboard + mouse state, polled by the game loop each frame.
export const keys = {};
export const mouse = { x: 0, y: 0, down: false, clicked: false, worldX: 0, worldY: 0 };

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Space: 'brake',
  KeyE: 'interact',
  KeyM: 'mute',
  KeyP: 'pause', Escape: 'pause',
  KeyR: 'restart',
  Enter: 'enter',
};

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    const name = KEYMAP[e.code];
    if (name) {
      keys[name] = true;
      // Queue the press itself: a quick tap that lands between two frames
      // must still count, so the loop consumes it instead of polling the
      // held state (which a fast tap can miss entirely).
      if (!e.repeat) pressedQueue.add(name);
      if (name === 'brake' || name === 'up' || name === 'down') e.preventDefault();
    }
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    const name = KEYMAP[e.code];
    if (name) keys[name] = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    mouse.down = false;
  });
}

// Edge-triggered "just pressed" helpers: each press is queued on keydown and
// consumed once by the loop, so holding a key never double-fires and a quick
// tap between two frames is never lost.
const pressedQueue = new Set();

function takePress(name) {
  if (pressedQueue.has(name)) {
    pressedQueue.delete(name);
    return true;
  }
  return false;
}

export function interactPressed() { return takePress('interact'); }
export function pausePressed() { return takePress('pause'); }
export function enterPressed() { return takePress('enter'); }

export function consumeClick() {
  const c = mouse.clicked;
  mouse.clicked = false;
  return c;
}
