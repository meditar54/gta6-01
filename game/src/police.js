// police.js — the wanted system: stars 0-5, crimes that raise them, cops that
// spawn and chase, foot cops that shoot and bust, and cooling off when the
// heat dies down. Solmara PD answers every star with more cars.
import { WORLD, randomRoadPoint } from './city.js';
import { clamp, dist, rand } from './utils.js';
import { makeCar, modelByName } from './vehicles.js';
import { sfxWanted } from './audio.js';

export const MAX_WANTED = 5;

export function addWanted(G, n, reason) {
  const before = G.wanted;
  G.wanted = clamp(G.wanted + n, 0, MAX_WANTED);
  G.crimeTimer = 0;
  if (G.wanted > before) {
    G.banner = { text: reason || 'WANTED LEVEL UP', sub: 'Solmara PD is on you', t: 2.2, color: '#ff5a4b' };
    sfxWanted();
  }
}

export function copCountFor(wanted) {
  return wanted <= 0 ? 0 : Math.min(6, wanted + 1);
}

function spawnCopCar(G) {
  for (let i = 0; i < 10; i++) {
    const p = randomRoadPoint();
    const d = dist(p.x, p.y, G.player.x, G.player.y);
    if (d > 380 && d < 750) {
      const car = makeCar(p.x, p.y, 0, modelByName('Tide Sedan'), 'police', 'cop');
      car.color = '#e8e8e8';
      car.top = 350;
      car.accel = 280;
      G.cars.push(car);
      return car;
    }
  }
  return null;
}

function spawnFootCop(G, x, y) {
  const cop = {
    x, y, angle: 0, hp: 2, state: 'chase',
    shootCd: rand(0.5, 1.2), bustTimer: 0, shirt: '#2a3a5a', skin: '#d9a06a',
  };
  G.cops.push(cop);
  return cop;
}

export function updatePolice(G, dt) {
  const p = G.player;
  // Cooling off: no crime for a while and no cop in sight, stars bleed away.
  if (G.wanted > 0) {
    G.crimeTimer += dt;
    const nearestCop = nearestCopDist(G);
    if (G.crimeTimer > 22 && nearestCop > 320) {
      G.coolTimer += dt;
      if (G.coolTimer > 7) {
        G.wanted -= 1;
        G.coolTimer = 0;
        G.crimeTimer = 0;
        G.banner = { text: 'HEAT DYING DOWN', sub: 'You slipped away — for now', t: 2, color: '#7ab86a' };
      }
    } else {
      G.coolTimer = 0;
    }
  }
  // Keep the right number of patrol cars on the road.
  const want = copCountFor(G.wanted);
  let have = G.cars.filter((c) => c.kind === 'police' && !c.dead).length;
  G.spawnCd -= dt;
  while (have < want && G.spawnCd <= 0) {
    if (spawnCopCar(G)) have++;
    G.spawnCd = 1.2;
    if (have >= want) break;
  }
  // Remove patrol cars once the heat is gone.
  if (G.wanted === 0) {
    G.cars = G.cars.filter((c) => !(c.kind === 'police' && dist(c.x, c.y, p.x, p.y) > 900));
    G.cops = [];
  }
  // Foot cops: when the player is on foot and wanted, a patrol car drops one off.
  if (G.wanted >= 2 && !p.car && G.cops.length < Math.min(3, G.wanted)) {
    G.footCopCd -= dt;
    if (G.footCopCd <= 0) {
      G.footCopCd = 4;
      const car = G.cars.find((c) => c.kind === 'police' && dist(c.x, c.y, p.x, p.y) < 500);
      if (car) spawnFootCop(G, car.x + 30, car.y + 30);
    }
  }
  // Foot cop behaviour: chase, shoot at range, bust up close.
  for (const cop of [...G.cops]) {
    const d = dist(cop.x, cop.y, p.x, p.y);
    cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
    if (p.car) {
      // Player escaped in a car: the foot cop gives up and fades out.
      G.cops = G.cops.filter((o) => o !== cop);
      continue;
    }
    if (d > 320) {
      cop.x += Math.cos(cop.angle) * 190 * dt;
      cop.y += Math.sin(cop.angle) * 190 * dt;
    } else if (d > 46) {
      cop.x += Math.cos(cop.angle) * 120 * dt;
      cop.y += Math.sin(cop.angle) * 120 * dt;
      cop.shootCd -= dt;
      if (cop.shootCd <= 0) {
        cop.shootCd = rand(0.9, 1.6);
        copShoot(G, cop);
      }
    } else {
      // Busted: a cop on top of you for a second and a half ends the run.
      cop.bustTimer += dt;
      if (cop.bustTimer > 1.5) {
        G.state = 'busted';
        G.bustedReason = 'BUSTED';
        return;
      }
    }
    if (cop.hp <= 0) {
      G.cops = G.cops.filter((o) => o !== cop);
      addWanted(G, 2, 'OFFICER DOWN');
    }
  }
}

function nearestCopDist(G) {
  let best = Infinity;
  for (const c of G.cars) {
    if (c.kind === 'police') best = Math.min(best, dist(c.x, c.y, G.player.x, G.player.y));
  }
  for (const cop of G.cops) best = Math.min(best, dist(cop.x, cop.y, G.player.x, G.player.y));
  return best;
}

function copShoot(G, cop) {
  const p = G.player;
  const a = Math.atan2(p.y - cop.y, p.x - cop.x) + rand(-0.12, 0.12);
  G.bullets.push({
    x: cop.x, y: cop.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520,
    life: 1.1, from: 'cop', dmg: 7,
  });
  G.muzzle = { x: cop.x, y: cop.y, t: 0.06 };
}
