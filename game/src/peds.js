// peds.js — the people of Solmara: they stroll the sidewalks, cross at the
// corners, scatter when a gun goes off or a car bears down on them, and a
// few of them hail taxis once Kai has a reputation.
import { WORLD, randomRoadPoint, collideSolids, groundAt } from './city.js';
import { clamp, dist, rand, pick } from './utils.js';

const SHIRTS = ['#e84b6a', '#4b8ad9', '#f2c94c', '#7ab86a', '#b84bd9', '#e8e8e8', '#ff8a3c', '#3cb8a0'];
const SKINS = ['#f2c9a0', '#d9a06a', '#a06a3c', '#8a5a2c', '#f2d5b8'];

export function makePed(x, y) {
  return {
    x, y, angle: rand(0, Math.PI * 2),
    speed: rand(28, 52), state: 'walk', // walk | flee | down | taxi
    shirt: pick(SHIRTS), skin: pick(SKINS),
    tx: x, ty: y, wait: 0, downTimer: 0, hp: 1,
    taxi: false, boarded: false,
  };
}

export function spawnPeds(G, n) {
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint();
    const ped = makePed(p.x + rand(-40, 40), p.y + rand(-40, 40));
    pickWalkTarget(ped);
    G.peds.push(ped);
  }
}

function pickWalkTarget(ped) {
  const p = randomRoadPoint();
  ped.tx = p.x;
  ped.ty = p.y;
}

export function updatePeds(G, dt) {
  // Keep the sidewalks busy near the player.
  let near = 0;
  for (const p of G.peds) if (dist(p.x, p.y, G.player.x, G.player.y) < 900) near++;
  if (near < 16) {
    const p = randomRoadPoint();
    if (dist(p.x, p.y, G.player.x, G.player.y) > 350 && dist(p.x, p.y, G.player.x, G.player.y) < 900) {
      const ped = makePed(p.x, p.y);
      pickWalkTarget(ped);
      G.peds.push(ped);
    }
  }
  for (const ped of [...G.peds]) {
    if (dist(ped.x, ped.y, G.player.x, G.player.y) > 1300) {
      G.peds = G.peds.filter((o) => o !== ped);
      continue;
    }
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        if (ped.hp <= 0) {
          G.peds = G.peds.filter((o) => o !== ped);
        } else {
          ped.state = 'flee';
          ped.wait = 2;
        }
      }
      continue;
    }
    // Threat check: gunfire nearby, or a fast car closing in.
    let threat = null;
    if (G.lastShotAt && G.time - G.lastShotAt < 0.8 && dist(ped.x, ped.y, G.lastShotX, G.lastShotY) < 260) {
      threat = { x: G.lastShotX, y: G.lastShotY };
    }
    if (!threat) {
      for (const c of G.cars) {
        if (Math.abs(c.speed) > 150 && dist(ped.x, ped.y, c.x, c.y) < 90) {
          threat = { x: c.x, y: c.y };
          break;
        }
      }
    }
    if (threat) ped.state = 'flee';
    if (ped.state === 'flee') {
      const a = Math.atan2(ped.y - threat.y, ped.x - threat.x);
      ped.angle = a;
      ped.x += Math.cos(a) * 150 * dt;
      ped.y += Math.sin(a) * 150 * dt;
      ped.wait -= dt;
      if (ped.wait <= 0) { ped.state = 'walk'; pickWalkTarget(ped); }
    } else if (ped.state === 'walk' && !ped.taxi) {
      const d = dist(ped.x, ped.y, ped.tx, ped.ty);
      if (d < 12) {
        ped.wait -= dt;
        if (ped.wait <= -rand(1, 4)) { pickWalkTarget(ped); ped.wait = 0; }
      } else {
        ped.angle = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
      }
    }
    ped.x = clamp(ped.x, 30, WORLD - 30);
    ped.y = clamp(ped.y, 30, WORLD - 30);
    collideSolids(ped, 10);
    if (groundAt(ped.x, ped.y) === 'water') {
      ped.y = 3110;
      pickWalkTarget(ped);
    }
  }
}

// A pedestrian hit by a car or a bullet goes down. Returns true if it died.
export function knockPed(G, ped, lethal) {
  if (ped.state === 'down') return ped.hp <= 0;
  ped.state = 'down';
  ped.downTimer = lethal ? 9999 : rand(2.5, 5);
  if (lethal) ped.hp = 0;
  for (let i = 0; i < 8; i++) {
    G.particles.push({
      x: ped.x, y: ped.y, vx: rand(-90, 90), vy: rand(-90, 90),
      life: rand(0.2, 0.5), max: 0.5, color: '#c94b4b', size: rand(2, 4), kind: 'spark',
    });
  }
  return lethal;
}
