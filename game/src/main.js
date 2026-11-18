// main.js — Solmara Heat: boot, the fixed-step loop, screens (title, playing,
// paused, wasted, busted, story complete), the camera, and the ?shot= staging
// the screenshots are taken from. The world simulates in real time; a shot
// just sets the opening position and lets it run for a few seconds.
import { CITY, WORLD, PLACES } from './city.js';
import { clamp, dist } from './utils.js';
import { keys, mouse, initInput, interactPressed, pausePressed, enterPressed, consumeClick } from './input.js';
import { initAudio, resumeAudio, setMuted, isMuted, setEngine, setSiren, sfxClick, sfxBusted } from './audio.js';
import { createPlayer, updatePlayer, updateBullets, tryEnterCar, nearestCar } from './player.js';
import { spawnTrafficCar, updateVehicles, makeCar, modelByName } from './vehicles.js';
import { spawnPeds, updatePeds } from './peds.js';
import { updatePolice, addWanted } from './police.js';
import { startMission, updateMissions, updateTaxi, taxiPickup, missionMarker } from './missions.js';
import { drawWorld, updateParticles } from './render.js';
import { drawHud } from './hud.js';
import { loadSave, writeSave, clearSave } from './save.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot') || '';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

// ---- game state ------------------------------------------------------------
const G = {
  time: 0,
  state: 'title', // title | playing | paused | wasted | busted | complete
  bustedReason: '',
  city: CITY,
  player: createPlayer(PLACES.hideout.x, PLACES.hideout.y),
  cars: [],
  peds: [],
  cops: [],
  bullets: [],
  particles: [],
  wanted: 0,
  crimeTimer: 0,
  coolTimer: 0,
  spawnCd: 0,
  footCopCd: 3,
  taxiCd: 12,
  taxi: null,
  taxiOffer: false,
  taxiPed: null,
  mission: null,
  missionIndex: -1,
  missionStep: 0,
  missionCar: null,
  missionHold: 0,
  missionMarker: null,
  completedMissions: [],
  storyComplete: false,
  camera: { x: PLACES.hideout.x, y: PLACES.hideout.y },
  view: { w: 1280, h: 800 },
  shake: 0,
  banner: null,
  keys, mouse,
  lastShotAt: -99, lastShotX: 0, lastShotY: 0,
  muzzle: null,
  nearestCar: null,
  nearestCarDist: 9999,
  saveSoon: false,
  autosaveCd: 30,
  menuSel: 0,
  // The staged scene name, when one is set: the chase keeps its road clear
  // of fresh traffic (see vehicles.js).
  shot,
};

// A debug handle for play-testing (read the live state from the console).
window.__G = G;

function resize() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * ratio);
  canvas.height = Math.round(window.innerHeight * ratio);
  G.view.w = window.innerWidth;
  G.view.h = window.innerHeight;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function newWorld() {
  G.cars = [];
  G.peds = [];
  G.cops = [];
  G.bullets = [];
  G.particles = [];
  G.wanted = 0;
  G.crimeTimer = 0;
  G.coolTimer = 0;
  G.taxi = null;
  G.taxiOffer = false;
  G.taxiPed = null;
  G.mission = null;
  G.missionIndex = -1;
  G.missionStep = 0;
  G.missionCar = null;
  G.missionHold = 0;
  G.storyComplete = false;
  G.completedMissions = [];
  G.banner = null;
  G.shake = 0;
  G.player = createPlayer(PLACES.hideout.x, PLACES.hideout.y);
  G.player.cash = 0;
  spawnPeds(G, 22);
  for (let i = 0; i < 12; i++) spawnTrafficCar(G);
}

function startGame(fromSave) {
  newWorld();
  const save = fromSave ? loadSave() : null;
  if (save) {
    G.player.cash = save.cash || 0;
    G.completedMissions = save.completedMissions || [];
    G.storyComplete = !!save.storyComplete;
    G.player.x = save.x || PLACES.hideout.x;
    G.player.y = save.y || PLACES.hideout.y;
    const next = Math.max(0, save.missionIndex ?? 0);
    if (!G.storyComplete && next < 4) startMission(G, next);
  } else {
    startMission(G, 0);
  }
  G.state = 'playing';
  status.textContent = 'Playing Solmara Heat. First job: First Fare.';
  initAudio();
  resumeAudio();
}

function respawn(after) {
  const cash = G.player.cash;
  const missionIndex = Math.max(0, G.missionIndex);
  newWorld();
  G.player.cash = Math.max(0, Math.round(cash * 0.9));
  G.player.x = PLACES.hospital.x;
  G.player.y = PLACES.hospital.y;
  startMission(G, missionIndex);
  G.state = 'playing';
  G.banner = {
    text: after === 'wasted' ? 'PATCHED UP' : 'BACK ON THE STREET',
    sub: 'Solmara General took its cut — 10% of your cash',
    t: 3, color: '#7ab86a',
  };
}

// ---- simulation ------------------------------------------------------------
function update(dt) {
  G.time += dt;
  if (G.banner) {
    G.banner.t -= dt;
    if (G.banner.t <= 0) G.banner = null;
  }
  updatePlayer(G, dt);
  updateVehicles(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateBullets(G, dt);
  updateMissions(G, dt);
  updateTaxi(G, dt);
  updateParticles(G, dt);

  // Mouse aim in world coordinates.
  G.mouse.worldX = G.camera.x - G.view.w / 2 + G.mouse.x;
  G.mouse.worldY = G.camera.y - G.view.h / 2 + G.mouse.y;

  // Nearest car, for the contextual hint and the E key.
  const car = nearestCar(G, 56);
  G.nearestCar = car;
  G.nearestCarDist = car ? dist(G.player.x, G.player.y, car.x, car.y) : 9999;

  // Camera follows Kai, clamped to the world.
  const tx = clamp(G.player.x, G.view.w / 2 - 60, WORLD - G.view.w / 2 + 60);
  const ty = clamp(G.player.y, G.view.h / 2 - 60, WORLD - G.view.h / 2 + 60);
  G.camera.x += (tx - G.camera.x) * Math.min(1, dt * 5);
  G.camera.y += (ty - G.camera.y) * Math.min(1, dt * 5);

  // Mission marker for the renderer and the minimap.
  G.missionMarker = missionMarker(G);

  // Interact: enter/steal a car, pick up a taxi fare.
  if (interactPressed()) {
    if (G.taxiOffer && taxiPickup(G)) {
      // Fare boarded.
    } else {
      tryEnterCar(G);
    }
  }

  // Engine + siren follow the action.
  const driving = !!G.player.car;
  setEngine(driving ? Math.abs(G.player.car.speed) / G.player.car.top : 0, driving);
  setSiren(G.wanted > 0 && G.cars.some((c) => c.kind === 'police' && dist(c.x, c.y, G.player.x, G.player.y) < 700));

  // Autosave every 30 s, and right after a job pays out.
  G.autosaveCd -= dt;
  if (G.saveSoon || G.autosaveCd <= 0) {
    writeSave(G);
    G.saveSoon = false;
    G.autosaveCd = 30;
  }

  // Taxi fare offer: a waving ped near Kai's car.
  if (!G.taxi && G.taxiOffer && G.taxiPed) {
    const d = dist(G.taxiPed.x, G.taxiPed.y, G.player.x, G.player.y);
    if (d > 200) { G.taxiOffer = false; G.taxiPed.taxi = false; G.taxiPed.state = 'walk'; G.taxiPed = null; }
  }
}

// ---- screens ----------------------------------------------------------------
function drawTitle() {
  // A slow pan over the city sits behind the menu.
  G.time += 1 / 60;
  G.camera.x = 1600 + Math.sin(G.time * 0.05) * 500;
  G.camera.y = 1600 + Math.cos(G.time * 0.04) * 400;
  drawWorld(ctx, G);
  ctx.fillStyle = 'rgba(8, 12, 20, 0.55)';
  ctx.fillRect(0, 0, G.view.w, G.view.h);

  const cx = G.view.w / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 64px ' + FONT;
  ctx.fillText('SOLMARA HEAT', cx, 170);
  ctx.fillStyle = '#fff';
  ctx.font = '22px ' + FONT;
  ctx.fillText('A sun-soaked open-world crime story — drive it, steal it, outrun it.', cx, 208);
  ctx.font = '16px ' + FONT;
  ctx.fillStyle = '#ffd94d';
  ctx.fillText('Kai Mercer owes Mara Voss $50,000. Four jobs will clear the debt.', cx, 238);

  const save = loadSave();
  const items = save
    ? ['CONTINUE — ' + '$' + (save.cash || 0) + ', ' + (save.completedMissions || []).length + '/4 jobs done', 'NEW GAME', 'HOW TO PLAY']
    : ['NEW GAME', 'HOW TO PLAY'];
  G.menuSel = Math.min(G.menuSel, items.length - 1);
  G.menuItems = items;
  const top = 300;
  items.forEach((label, i) => {
    const y = top + i * 56;
    const sel = i === G.menuSel;
    ctx.fillStyle = sel ? '#ffd94d' : 'rgba(255,255,255,0.12)';
    ctx.fillRect(cx - 260, y - 30, 520, 44);
    ctx.fillStyle = sel ? '#111' : '#fff';
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillText(label, cx, y);
  });
  ctx.fillStyle = '#bbb';
  ctx.font = '15px ' + FONT;
  ctx.fillText('WASD move / drive  •  Mouse aim, click to shoot  •  E enter & steal cars  •  SPACE handbrake', cx, top + items.length * 56 + 20);
  ctx.fillText('SHIFT sprint  •  P pause  •  M mute  •  Progress saves automatically', cx, top + items.length * 56 + 46);
  ctx.fillStyle = '#888';
  ctx.font = '13px ' + FONT;
  ctx.fillText('All original: Solmara, Kai Mercer, Mara Voss and every car, name and song are invented for this game.', cx, G.view.h - 24);
}

function drawPaused() {
  drawWorld(ctx, G);
  drawHud(ctx, G, G.view.w, G.view.h);
  ctx.fillStyle = 'rgba(8, 12, 20, 0.6)';
  ctx.fillRect(0, 0, G.view.w, G.view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px ' + FONT;
  ctx.fillText('PAUSED', G.view.w / 2, G.view.h / 2 - 40);
  ctx.font = '18px ' + FONT;
  ctx.fillText('P / Esc — resume    •    M — ' + (isMuted() ? 'unmute' : 'mute') + '    •    R — restart the story', G.view.w / 2, G.view.h / 2 + 10);
  ctx.fillText('Progress is saved automatically. Close the tab any time — Continue is on the title screen.', G.view.w / 2, G.view.h / 2 + 40);
}

function drawOver() {
  drawWorld(ctx, G);
  ctx.fillStyle = 'rgba(8, 12, 20, 0.65)';
  ctx.fillRect(0, 0, G.view.w, G.view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = G.state === 'wasted' ? '#ff5a4b' : '#4b8ad9';
  ctx.font = 'bold 56px ' + FONT;
  ctx.fillText(G.bustedReason, G.view.w / 2, G.view.h / 2 - 30);
  ctx.fillStyle = '#fff';
  ctx.font = '19px ' + FONT;
  ctx.fillText(G.state === 'wasted'
    ? 'Kai got patched up at Solmara General — they took 10% of his cash for the trouble.'
    : 'Solmara PD hauled Kai in — but Mara Voss posted bail, and the debt is still waiting.',
    G.view.w / 2, G.view.h / 2 + 12);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 20px ' + FONT;
  ctx.fillText('Press Enter or click to get back on the street', G.view.w / 2, G.view.h / 2 + 56);
}

function drawFrame() {
  ctx.clearRect(0, 0, G.view.w, G.view.h);
  if (G.state === 'title') {
    drawTitle();
  } else if (G.state === 'paused') {
    drawPaused();
  } else if (G.state === 'wasted' || G.state === 'busted') {
    drawOver();
  } else {
    drawWorld(ctx, G);
    drawHud(ctx, G, G.view.w, G.view.h);
  }
}

// ---- shot staging ------------------------------------------------------------
// ?shot=start  — the title screen.
// ?shot=foot   — Kai on foot downtown, mission 1 live, peds and traffic around.
// ?shot=chase  — Kai fleeing at speed in the Comet GT, 3 stars, three cruisers on him.
// ?shot=mission— Kai on foot at the port, about to steal the gold Comet GT.
function stageShot(name) {
  newWorld();
  G.state = 'playing';
  if (name === 'foot') {
    // Kai on foot by the garage, the Sunbeam waiting with its beacon on.
    G.player.x = 660;
    G.player.y = 760;
    startMission(G, 0);
    return;
  }
  if (name === 'chase') {
    const car = makeCar(1400, 1400, 0, modelByName('Comet GT'), 'player', 'player');
    car.speed = 330;
    G.cars.push(car);
    G.player.car = car;
    G.player.x = car.x;
    G.player.y = car.y;
    startMission(G, 2);
    G.missionStep = 1; // the escape leg
    addWanted(G, 3, '');
    for (let i = 0; i < 3; i++) {
      // Start them a few car-lengths back so the shot catches the pursuit
      // in full flight instead of a pile-up on the player's bumper.
      const cop = makeCar(1400 - 320 - i * 130, 1400 + (i - 1) * 70, 0, modelByName('Tide Sedan'), 'police', 'cop');
      cop.color = '#e8e8e8';
      cop.speed = 300;
      G.cars.push(cop);
    }
    // Clear the player's escape route so the shot catches him at speed,
    // not grinding through a traffic jam at the next crossing.
    G.cars = G.cars.filter((c) => !(c.kind === 'traffic' && Math.abs(c.y - 1400) < 90 && c.x > 1300));
    return;
  }
  if (name === 'mission') {
    G.player.x = 2960;
    G.player.y = 560;
    startMission(G, 1);
    return;
  }
  // start (or anything else): the title screen.
  G.state = 'title';
  newWorld();
}

// ---- the loop ----------------------------------------------------------------
function runGame() {
  initInput(canvas);
  resize();
  window.addEventListener('resize', resize);
  if (shot) {
    stageShot(shot);
    // Let the staged scene simulate a few seconds so traffic and peds settle.
    // In the chase scene Kai keeps his foot down so the shot catches him at speed.
    // The chase gets a shorter run-up so he is still flying down a clear
    // avenue when the shutter clicks, not tangled in traffic.
    if (shot === 'chase') G.keys.up = true;
    const preroll = shot === 'chase' ? 72 : 180;
    for (let i = 0; i < preroll; i++) {
      if (G.state === 'playing') update(STEP);
    }
    G.keys.up = false;
    drawFrame();
    window.__shotReady = true;
    // Keep the world alive after the shot so a human opening the same URL
    // sees a moving city, not a frozen frame.
    let last = performance.now();
    let acc = 0;
    function frame(now) {
      requestAnimationFrame(frame);
      acc += Math.min((now - last) / 1000, MAX_FRAME);
      last = now;
      while (acc >= STEP) {
        if (G.state === 'playing') update(STEP);
        acc -= STEP;
      }
      drawFrame();
    }
    requestAnimationFrame(frame);
    return;
  }

  newWorld();
  let acc = 0;
  let last = performance.now();
  let mutedKeyPrev = false;

  function frame(now) {
    requestAnimationFrame(frame);
    acc += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    if (G.keys.mute && !mutedKeyPrev) setMuted(!isMuted());
    mutedKeyPrev = !!G.keys.mute;

    if (G.state === 'title') {
      // Menu: arrows/Enter, or click a row.
      if (G.keys.down && !frame.downPrev) G.menuSel = Math.min((G.menuItems || []).length - 1, G.menuSel + 1);
      if (G.keys.up && !frame.upPrev) G.menuSel = Math.max(0, G.menuSel - 1);
      frame.downPrev = !!G.keys.down;
      frame.upPrev = !!G.keys.up;
      if (consumeClick()) {
        const cx = G.view.w / 2;
        const top = 300;
        (G.menuItems || []).forEach((label, i) => {
          const y = top + i * 56;
          if (G.mouse.x > cx - 260 && G.mouse.x < cx + 260 && G.mouse.y > y - 30 && G.mouse.y < y + 14) {
            G.menuSel = i;
            chooseMenu();
          }
        });
      }
      if (enterPressed()) chooseMenu();
      G.time += 1 / 60;
    } else if (G.state === 'playing') {
      if (pausePressed()) {
        G.state = 'paused';
        status.textContent = 'Paused.';
      } else {
        while (acc >= STEP) {
          update(STEP);
          acc -= STEP;
          if (G.state !== 'playing') break;
        }
      }
    } else if (G.state === 'paused') {
      acc = 0;
      if (pausePressed() || enterPressed()) {
        G.state = 'playing';
        status.textContent = 'Playing.';
      }
      if (G.keys.restart) {
        clearSave();
        startGame(false);
      }
    } else if (G.state === 'wasted' || G.state === 'busted') {
      acc = 0;
      if (enterPressed() || consumeClick()) {
        sfxBusted();
        respawn(G.state);
      }
    }
    drawFrame();
  }

  function chooseMenu() {
    sfxClick();
    initAudio();
    resumeAudio();
    const save = loadSave();
    const items = save ? ['continue', 'new', 'how'] : ['new', 'how'];
    const choice = items[G.menuSel];
    if (choice === 'continue') startGame(true);
    else if (choice === 'new') {
      clearSave();
      startGame(false);
    }
    // 'how' stays on the title screen: the controls are printed under the menu.
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.state === 'playing') {
      G.state = 'paused';
      status.textContent = 'Paused.';
    }
  });

  status.textContent = 'Solmara Heat. Press Enter or click New Game to start.';
  requestAnimationFrame(frame);
}

runGame();
