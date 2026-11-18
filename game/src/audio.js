// audio.js — every sound in Solmara Heat is synthesized with WebAudio.
// No audio files, no network: engine hum, sirens, gunshots, crashes, pickups
// and a low-key synth loop are all built from oscillators and noise.
let ctx = null;
let master = null;
let musicGain = null;
let engineOsc = null;
let engineGain = null;
let sirenOscA = null;
let sirenOscB = null;
let sirenGain = null;
let musicTimer = null;
let muted = false;
let step = 0;

export function initAudio() {
  if (ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
    // Engine: a sawtooth whose pitch follows the player's speed.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    // Siren: two detuned triangles alternating by gain LFO.
    sirenOscA = ctx.createOscillator();
    sirenOscA.type = 'triangle';
    sirenOscA.frequency.value = 720;
    sirenOscB = ctx.createOscillator();
    sirenOscB.type = 'triangle';
    sirenOscB.frequency.value = 960;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOscA.connect(sirenGain);
    sirenOscB.connect(sirenGain);
    sirenGain.connect(master);
    sirenOscA.start();
    sirenOscB.start();
    startMusic();
  } catch (e) {
    ctx = null; // Headless or blocked: the game plays silently, never crashes.
  }
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = muted ? 0 : 0.5;
}
export function isMuted() { return muted; }

export function setEngine(speedNorm, driving) {
  if (!ctx || !engineOsc) return;
  const target = driving ? 0.05 + speedNorm * 0.06 : 0.0;
  engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
  engineOsc.frequency.setTargetAtTime(55 + speedNorm * 165, ctx.currentTime, 0.08);
}

export function setSiren(on) {
  if (!ctx || !sirenGain) return;
  sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
  if (on) {
    const t = ctx.currentTime;
    sirenOscA.frequency.setValueAtTime(720, t);
    sirenOscB.frequency.setValueAtTime(960, t);
  }
}

function noiseBurst(dur, filterFreq, gainVal, type = 'lowpass') {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.value = gainVal;
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start();
}

function tone(freq, dur, type, gainVal, slideTo) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gainVal, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g);
  g.connect(master);
  o.start();
  o.stop(ctx.currentTime + dur + 0.02);
}

export function sfxShot() { noiseBurst(0.12, 1800, 0.5, 'highpass'); tone(160, 0.1, 'square', 0.25, 60); }
export function sfxCrash() { noiseBurst(0.25, 500, 0.6); }
export function sfxPickup() { tone(660, 0.09, 'sine', 0.3); setTimeout(() => tone(990, 0.12, 'sine', 0.3), 70); }
export function sfxWanted() { tone(440, 0.16, 'square', 0.2, 330); setTimeout(() => tone(440, 0.16, 'square', 0.2, 330), 180); }
export function sfxExplosion() { noiseBurst(0.7, 300, 0.9); tone(70, 0.6, 'sine', 0.5, 30); }
export function sfxClick() { tone(800, 0.05, 'square', 0.15); }
export function sfxMissionDone() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.3), i * 110));
}
export function sfxBusted() { [392, 370, 349, 311].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.2), i * 160)); }

// A mellow synth loop: root bass + soft pluck arpeggio, scheduled ahead.
const BASS = [55, 55, 65.41, 49];
const ARP = [220, 261.63, 329.63, 392, 329.63, 261.63];
function startMusic() {
  if (musicTimer) return;
  musicTimer = setInterval(() => {
    if (!ctx || muted) return;
    const t = ctx.currentTime + 0.05;
    const bar = BASS[step % BASS.length];
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = bar;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g);
    g.connect(musicGain);
    o.start(t);
    o.stop(t + 0.55);
    const note = ARP[(step * 2) % ARP.length];
    const p = ctx.createOscillator();
    p.type = 'sine';
    p.frequency.value = note;
    const pg = ctx.createGain();
    pg.gain.setValueAtTime(0.25, t);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    p.connect(pg);
    pg.connect(musicGain);
    p.start(t);
    p.stop(t + 0.32);
    step++;
  }, 500);
}
