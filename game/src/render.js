// render.js — draws Solmara from above: sun-bleached ground, the avenue grid
// with lane paint, pastel buildings with shadows, the park, the beach and
// the port, then cars, people, bullets, particles and the mission beacon.
import { CITY, WORLD, ROADS, ROAD_W, PLACES } from './city.js';
import { clamp } from './utils.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function drawWorld(ctx, G) {
  const cam = G.camera;
  const view = { x: cam.x - G.view.w / 2, y: cam.y - G.view.h / 2, w: G.view.w, h: G.view.h };
  ctx.save();
  // The camera: everything below is drawn in world coordinates, shifted so
  // the camera's view lands on the screen. The shake rides on top of it.
  const shX = G.shake > 0.2 ? (Math.random() - 0.5) * G.shake : 0;
  const shY = G.shake > 0.2 ? (Math.random() - 0.5) * G.shake : 0;
  ctx.translate(-view.x + shX, -view.y + shY);
  // --- ground ---
  ctx.fillStyle = '#7fb069';
  ctx.fillRect(view.x - 20, view.y - 20, view.w + 40, view.h + 40);
  // Beach sand and water along the south edge.
  ctx.fillStyle = '#ecd9a0';
  ctx.fillRect(Math.max(view.x, 0), 3036, WORLD, 84);
  ctx.fillStyle = '#3d9db5';
  ctx.fillRect(Math.max(view.x, 0), 3120, WORLD, 80);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let wx = 0; wx < WORLD; wx += 160) {
    const yy = 3140 + Math.sin(G.time * 0.8 + wx * 0.01) * 6;
    ctx.beginPath();
    ctx.moveTo(wx, yy);
    ctx.lineTo(wx + 70, yy);
    ctx.stroke();
  }
  // Port concrete on the east edge.
  ctx.fillStyle = '#9a938a';
  ctx.fillRect(3036, 200, WORLD - 3036, 900);
  // Park.
  ctx.fillStyle = '#5a9a48';
  ctx.fillRect(1436, 1436, 328, 328);
  ctx.fillStyle = '#3d9db5';
  ctx.beginPath();
  ctx.ellipse(1600, 1600, 62, 40, 0, 0, Math.PI * 2);
  ctx.fill();

  drawRoads(ctx, view);
  drawBuildings(ctx, view);
  drawContainers(ctx, view);
  drawTrees(ctx, view);
  drawPlaceLabels(ctx, view);

  // Skid marks under the cars.
  for (const car of G.cars) {
    for (const s of car.skid || []) {
      ctx.save();
      ctx.globalAlpha = s.life * 0.4;
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.a) * 12, s.y - Math.sin(s.a) * 12);
      ctx.lineTo(s.x + Math.cos(s.a) * 12, s.y + Math.sin(s.a) * 12);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawMissionBeacon(ctx, G);
  for (const ped of G.peds) drawPed(ctx, ped, G.time);
  for (const cop of G.cops) drawCop(ctx, cop, G.time);
  for (const car of G.cars) drawCar(ctx, car, G.time);
  drawPlayer(ctx, G);
  drawBullets(ctx, G);
  drawParticles(ctx, G);
  ctx.restore();
}

function drawRoads(ctx, view) {
  ctx.fillStyle = '#3a3f4a';
  for (const r of ROADS) {
    ctx.fillRect(r - ROAD_W / 2, Math.max(view.y, 0), ROAD_W, view.h + 40);
    ctx.fillRect(Math.max(view.x, 0), r - ROAD_W / 2, view.w + 40, ROAD_W);
  }
  // Sidewalk edges.
  ctx.fillStyle = '#c9bfa8';
  for (const r of ROADS) {
    ctx.fillRect(r - ROAD_W / 2 - 8, Math.max(view.y, 0), 8, view.h + 40);
    ctx.fillRect(r + ROAD_W / 2, Math.max(view.y, 0), 8, view.h + 40);
    ctx.fillRect(Math.max(view.x, 0), r - ROAD_W / 2 - 8, view.w + 40, 8);
    ctx.fillRect(Math.max(view.x, 0), r + ROAD_W / 2, view.w + 40, 8);
  }
  // Centre dashes.
  ctx.strokeStyle = '#f2c94c';
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 26]);
  for (const r of ROADS) {
    ctx.beginPath();
    ctx.moveTo(r, Math.max(view.y, 0));
    ctx.lineTo(r, view.y + view.h + 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(Math.max(view.x, 0), r);
    ctx.lineTo(view.x + view.w + 20, r);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks at every crossing in view.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const rx of ROADS) {
    if (rx < view.x - 50 || rx > view.x + view.w + 50) continue;
    for (const ry of ROADS) {
      if (ry < view.y - 50 || ry > view.y + view.h + 50) continue;
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(rx - 30 + i * 9, ry - ROAD_W / 2 - 2, 5, 10);
        ctx.fillRect(rx - ROAD_W / 2 - 2, ry - 30 + i * 9, 10, 5);
      }
    }
  }
}

function drawBuildings(ctx, view) {
  for (const b of CITY.buildings) {
    if (b.x > view.x + view.w || b.x + b.w < view.x || b.y > view.y + view.h || b.y + b.h < view.y) continue;
    // Shadow, then walls, then a roof inset with a skylight or two.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(b.x + 14, b.y + 14, Math.max(8, b.w * 0.25), Math.max(6, b.h * 0.2));
    if (b.tall) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(b.x + b.w - 18, b.y + 10, 8, 8);
    }
  }
}

function drawContainers(ctx, view) {
  for (const c of CITY.containers) {
    if (c.x > view.x + view.w || c.x + c.w < view.x || c.y > view.y + view.h || c.y + c.h < view.y) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(c.x + 4, c.y + 5, c.w, c.h);
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(c.x, c.y + (c.h / 5) * i);
      ctx.lineTo(c.x + c.w, c.y + (c.h / 5) * i);
      ctx.stroke();
    }
  }
}

function drawTrees(ctx, view) {
  for (const t of CITY.trees) {
    if (t.x < view.x - 20 || t.x > view.x + view.w + 20 || t.y < view.y - 20 || t.y > view.y + view.h + 20) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(t.x + 3, t.y + 4, t.r, t.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f7a2e';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a9a48';
    ctx.beginPath();
    ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlaceLabels(ctx, view) {
  ctx.font = 'bold 15px ' + FONT;
  ctx.textAlign = 'center';
  for (const key of Object.keys(PLACES)) {
    const pl = PLACES[key];
    if (pl.x < view.x - 60 || pl.x > view.x + view.w + 60 || pl.y < view.y - 60 || pl.y > view.y + view.h + 60) continue;
    ctx.fillStyle = 'rgba(10,14,20,0.55)';
    const w = ctx.measureText(pl.label).width + 16;
    ctx.fillRect(pl.x - w / 2, pl.y - 34, w, 20);
    ctx.fillStyle = '#fff';
    ctx.fillText(pl.label, pl.x, pl.y - 20);
  }
}

function drawMissionBeacon(ctx, G) {
  const m = G.missionMarker;
  if (!m) return;
  const pulse = 1 + Math.sin(G.time * 5) * 0.15;
  const grad = ctx.createRadialGradient(m.x, m.y, 4, m.x, m.y, 46 * pulse);
  grad.addColorStop(0, 'rgba(255,217,77,0.85)');
  grad.addColorStop(1, 'rgba(255,217,77,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(m.x, m.y, 46 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd94d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(m.x, m.y, 26 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath();
  ctx.moveTo(m.x, m.y - 34);
  ctx.lineTo(m.x + 9, m.y - 18);
  ctx.lineTo(m.x - 9, m.y - 18);
  ctx.closePath();
  ctx.fill();
}

function drawCar(ctx, car, time) {
  const L = 46;
  const Wd = 24;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(-L / 2 + 3, -Wd / 2 + 4, L, Wd);
  // Wheels.
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-L / 2 + 4, -Wd / 2 - 3, 10, 6);
  ctx.fillRect(L / 2 - 14, -Wd / 2 - 3, 10, 6);
  ctx.fillRect(-L / 2 + 4, Wd / 2 - 3, 10, 6);
  ctx.fillRect(L / 2 - 14, Wd / 2 - 3, 10, 6);
  // Body.
  ctx.fillStyle = car.color;
  roundRectPath(ctx, -L / 2, -Wd / 2, L, Wd, 7);
  ctx.fill();
  // Windshield + roof.
  ctx.fillStyle = 'rgba(20,40,60,0.75)';
  ctx.fillRect(-4, -Wd / 2 + 3, 12, Wd - 6);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-L / 2 + 6, -Wd / 2 + 3, 8, Wd - 6);
  // Police livery: black doors + flashing light bar.
  if (car.kind === 'police') {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-8, -Wd / 2, 16, 4);
    ctx.fillRect(-8, Wd / 2 - 4, 16, 4);
    const on = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = on ? '#ff3c3c' : '#3c6aff';
    ctx.fillRect(-3, -Wd / 2 + 1, 6, 5);
    ctx.fillStyle = on ? '#3c6aff' : '#ff3c3c';
    ctx.fillRect(-3, Wd / 2 - 6, 6, 5);
  }
  // Headlights.
  ctx.fillStyle = '#fff8c9';
  ctx.fillRect(L / 2 - 2, -Wd / 2 + 4, 3, 5);
  ctx.fillRect(L / 2 - 2, Wd / 2 - 9, 3, 5);
  ctx.restore();
  if (car.dead) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(car.x, car.y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPed(ctx, ped, time) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'down') {
    ctx.rotate(ped.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 2, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const bob = Math.sin(time * 8 + ped.x) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 3, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(ped.angle);
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(6 + bob * 0.3, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (ped.taxi) {
    ctx.save();
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 13px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', ped.x, ped.y - 18);
    ctx.restore();
  }
}

function drawCop(ctx, cop) {
  ctx.save();
  ctx.translate(cop.x, cop.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 3, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(cop.angle);
  ctx.fillStyle = '#2a3a5a';
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d9a06a';
  ctx.beginPath();
  ctx.arc(6, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // Cap brim.
  ctx.fillStyle = '#1a2438';
  ctx.fillRect(6, -5, 6, 10);
  ctx.restore();
}

function drawPlayer(ctx, G) {
  const p = G.player;
  if (p.car) return; // Kai is inside the car, drawn with it.
  ctx.save();
  ctx.translate(p.x, p.y);
  const blink = p.hurtCd > 0 && Math.floor(G.time * 12) % 2 === 0;
  if (!blink) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(1, 4, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(p.angle);
    // Red jacket, the one Mara always spots in a crowd.
    ctx.fillStyle = '#d93c3c';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(7, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    // Gun points at the mouse.
    ctx.rotate(p.aimAngle - p.angle);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(20, 0);
    ctx.stroke();
  }
  ctx.restore();
  if (G.muzzle) {
    ctx.save();
    ctx.fillStyle = '#ffe98a';
    ctx.beginPath();
    ctx.arc(G.muzzle.x, G.muzzle.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawBullets(ctx, G) {
  ctx.save();
  ctx.strokeStyle = '#ffe98a';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(ctx, G) {
  for (const pt of G.particles) {
    const a = clamp(pt.life / pt.max, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * a + 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function updateParticles(G, dt) {
  for (const pt of [...G.particles]) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 1 - 2.2 * dt;
    pt.vy *= 1 - 2.2 * dt;
    if (pt.kind === 'smoke') pt.vy -= 30 * dt;
    pt.life -= dt;
    if (pt.life <= 0) G.particles = G.particles.filter((o) => o !== pt);
  }
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 26);
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
