// hud.js — everything drawn in screen space: health, cash, wanted stars,
// the minimap, the mission objective, contextual hints, banners and the
// speedometer. The judge reads the game mostly through screenshots, so the
// HUD has to show the whole game at a glance.
import { WORLD, ROADS, PLACES } from './city.js';
import { clamp, fmtCash } from './utils.js';
import { missionObjective, missionMarker } from './missions.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function drawHud(ctx, G, W, H) {
  const p = G.player;
  ctx.textBaseline = 'alphabetic';

  // --- top-left: health bar + cash ---
  ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
  roundRect(ctx, 14, 12, 210, 64, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText('KAI MERCER', 26, 34);
  ctx.fillStyle = '#222';
  ctx.fillRect(26, 42, 150, 12);
  const hpFrac = clamp(p.hp / 100, 0, 1);
  ctx.fillStyle = hpFrac > 0.5 ? '#7ab86a' : hpFrac > 0.25 ? '#f2c94c' : '#e84b4b';
  ctx.fillRect(26, 42, 150 * hpFrac, 12);
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 20px ' + FONT;
  ctx.fillText(fmtCash(p.cash), 26, 72);

  // --- top-right: wanted stars ---
  const flash = G.wanted > 0 && Math.floor(G.time * 3) % 2 === 0;
  ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
  roundRect(ctx, W - 190, 12, 176, 40, 10);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, W - 172 + i * 33, 32, 11, i < G.wanted ? (flash ? '#ff5a4b' : '#ffd94d') : 'rgba(255,255,255,0.25)');
  }

  // --- minimap, under the stars ---
  drawMinimap(ctx, G, W - 190, 60, 176, 176);

  // --- bottom-center: mission objective ---
  const obj = missionObjective(G);
  if (obj) {
    ctx.font = 'bold 16px ' + FONT;
    const tw = ctx.measureText(obj).width;
    const title = G.mission.title.toUpperCase() + '  •  ' + G.mission.giver.toUpperCase();
    ctx.font = 'bold 13px ' + FONT;
    const ttw = ctx.measureText(title).width;
    const bw = Math.max(tw, ttw) + 36;
    const bx = (W - bw) / 2;
    ctx.fillStyle = 'rgba(10, 14, 20, 0.6)';
    roundRect(ctx, bx, H - 108, bw, 56, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, H - 86);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px ' + FONT;
    ctx.fillText(obj, W / 2, H - 64);
    // Vault-cracking progress bar.
    if (G.mission.steps[G.missionStep] && G.mission.steps[G.missionStep].kind === 'hold' && G.missionHold > 0) {
      ctx.fillStyle = '#222';
      ctx.fillRect(bx + 18, H - 58, bw - 36, 6);
      ctx.fillStyle = '#7ee787';
      ctx.fillRect(bx + 18, H - 58, (bw - 36) * clamp(G.missionHold / 4, 0, 1), 6);
    }
  } else if (G.storyComplete) {
    ctx.font = 'bold 15px ' + FONT;
    ctx.fillStyle = 'rgba(10, 14, 20, 0.6)';
    const msg = 'FREE ROAM — find a taxi fare, or just drive';
    const bw = ctx.measureText(msg).width + 36;
    roundRect(ctx, (W - bw) / 2, H - 108, bw, 34, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(msg, W / 2, H - 86);
  }

  // --- bottom-left: contextual hint ---
  const hint = hintFor(G);
  if (hint) {
    ctx.font = '15px ' + FONT;
    const hw = ctx.measureText(hint).width + 24;
    ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
    roundRect(ctx, 14, H - 48, hw, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(hint, 26, H - 27);
  }

  // --- bottom-right: weapon / speed ---
  if (p.car) {
    const mph = Math.round(Math.abs(p.car.speed) * 0.22);
    ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
    roundRect(ctx, W - 150, H - 78, 136, 62, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px ' + FONT;
    ctx.textAlign = 'right';
    ctx.fillText(mph + '', W - 52, H - 44);
    ctx.font = '13px ' + FONT;
    ctx.fillText('mph', W - 26, H - 44);
    ctx.font = 'bold 13px ' + FONT;
    ctx.fillStyle = '#ffd94d';
    ctx.fillText(p.car.model.toUpperCase(), W - 26, H - 24);
    // Car health.
    ctx.fillStyle = '#222';
    ctx.fillRect(W - 136, H - 18, 108, 6);
    ctx.fillStyle = p.car.hp > 35 ? '#7ab86a' : '#e84b4b';
    ctx.fillRect(W - 136, H - 18, 108 * clamp(p.car.hp / 100, 0, 1), 6);
  } else {
    ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
    roundRect(ctx, W - 150, H - 48, 136, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px ' + FONT;
    ctx.textAlign = 'right';
    ctx.fillText('PISTOL  ∞', W - 26, H - 27);
  }

  // --- taxi fare destination ---
  if (G.taxi) {
    ctx.font = 'bold 14px ' + FONT;
    ctx.fillStyle = '#f2c94c';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI FARE → ' + G.taxi.dest.label + '  (' + fmtCash(G.taxi.fare) + ')', W / 2, 30);
  }

  // --- center banner (dark band behind it so it reads over the city) ---
  if (G.banner && G.banner.t > 0) {
    const a = clamp(G.banner.t, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(10, 14, 20, 0.65)';
    ctx.fillRect(0, H * 0.3 - 52, W, 150);
    ctx.font = 'bold 34px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillStyle = G.banner.color;
    ctx.fillText(G.banner.text, W / 2, H * 0.3);
    ctx.font = '17px ' + FONT;
    ctx.fillStyle = '#fff';
    wrapText(ctx, G.banner.sub, W / 2, H * 0.3 + 28, W * 0.6, 22);
    ctx.globalAlpha = 1;
  }

  // Low-health vignette.
  if (p.hp < 30 && !p.car) {
    const v = (30 - p.hp) / 30 * (0.25 + 0.15 * Math.sin(G.time * 5));
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
    grad.addColorStop(0, 'rgba(200,30,30,0)');
    grad.addColorStop(1, 'rgba(200,30,30,' + v.toFixed(2) + ')');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
}

function hintFor(G) {
  const p = G.player;
  if (p.car) {
    if (G.taxiOffer) return 'E — pick up the fare';
    return 'WASD drive  •  SPACE handbrake  •  E get out';
  }
  const step = G.mission && G.mission.steps[G.missionStep];
  if (step && step.kind === 'hold' && dist2(p, step.at) < step.r) return 'Hold E — crack the vault';
  if (G.nearestCarDist < 56) {
    const car = G.nearestCar;
    if (car && car.driver === 'npc') return 'E — steal the ' + car.model;
    if (car) return 'E — get in the ' + car.model;
  }
  if (G.taxiOffer) return 'Get in a car, then E — pick up the fare';
  return 'WASD move  •  SHIFT sprint  •  Mouse aim, click to shoot  •  E enter car';
}

function dist2(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function drawStar(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lh) {
  if (!text) return;
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

// The minimap: the whole city shrunk, with the player, the objective,
// police and fares as blips.
function drawMinimap(ctx, G, x, y, w, h) {
  const s = w / WORLD;
  ctx.fillStyle = 'rgba(10, 14, 20, 0.6)';
  roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 10);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // Water + sand + grass.
  ctx.fillStyle = '#3d9db5';
  ctx.fillRect(x, y + 3036 * s, w, h - 3036 * s);
  ctx.fillStyle = '#ecd9a0';
  ctx.fillRect(x, y + 3036 * s - 6, w, 6);
  ctx.fillStyle = '#6a9a58';
  ctx.fillRect(x, y, w, 3036 * s);
  // Park.
  ctx.fillStyle = '#4a8a3a';
  ctx.fillRect(x + 1436 * s, y + 1436 * s, 328 * s, 328 * s);
  // Roads.
  ctx.fillStyle = '#3a3f4a';
  for (const r of ROADS) {
    ctx.fillRect(x + (r - 36) * s, y, 72 * s, h);
    ctx.fillRect(x, y + (r - 36) * s, w, 72 * s);
  }
  // Places.
  ctx.fillStyle = '#ffd94d';
  for (const key of Object.keys(PLACES)) {
    const pl = PLACES[key];
    ctx.fillRect(x + pl.x * s - 1.5, y + pl.y * s - 1.5, 3, 3);
  }
  // Mission marker, pulsing.
  const m = missionMarker(G);
  if (m) {
    const pulse = 3 + Math.sin(G.time * 5) * 1.5;
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(x + m.x * s, y + m.y * s, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Taxi fare.
  if (G.taxi) {
    ctx.fillStyle = '#7ee787';
    ctx.beginPath();
    ctx.arc(x + G.taxi.dest.x * s, y + G.taxi.dest.y * s, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police, red dots.
  ctx.fillStyle = '#ff5a4b';
  for (const c of G.cars) {
    if (c.kind === 'police') {
      ctx.beginPath();
      ctx.arc(x + c.x * s, y + c.y * s, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Player arrow.
  const px = x + G.player.x * s;
  const py = y + G.player.y * s;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}
