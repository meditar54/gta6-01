// utils.js — small math and random helpers shared by every Solmara Heat module.
export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const angTo = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);

// Shortest signed turn from angle a to angle b, in (-PI, PI].
export function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;

// Deterministic generator so the city looks the same in every screenshot.
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Circle vs axis-aligned rectangle: returns the push-out vector, or null.
export function circleRectPush(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  let dx = cx - nx;
  let dy = cy - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 === 0) {
    // Center inside the rectangle: push out along the shortest side.
    const left = cx - rx;
    const right = rx + rw - cx;
    const top = cy - ry;
    const bottom = ry + rh - cy;
    const m = Math.min(left, right, top, bottom);
    if (m === left) return { x: -(left + r), y: 0 };
    if (m === right) return { x: right + r, y: 0 };
    if (m === top) return { x: 0, y: -(top + r) };
    return { x: 0, y: bottom + r };
  }
  const d = Math.sqrt(d2);
  const push = (r - d) / d;
  return { x: dx * push, y: dy * push };
}

export function pointInRect(x, y, rx, ry, rw, rh) {
  return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
}

// Format cash like $1,250.
export function fmtCash(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}
