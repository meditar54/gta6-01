// player.js — Kai Mercer on foot: run, sprint, aim with the mouse, shoot,
// and get in and out of cars (E). Stealing an occupied car yanks the driver
// out and puts a star on you. Bullets live here too.
import { WORLD, collideSolids, groundAt } from './city.js';
import { clamp, dist, rand } from './utils.js';
import { makePed, knockPed } from './peds.js';
import { addWanted } from './police.js';
import { sfxShot } from './audio.js';
import { modelByName } from './vehicles.js';

const FOOT_SPEED = 210;
const SPRINT_SPEED = 330;

export function createPlayer(x, y) {
  return {
    x, y, angle: 0, hp: 100,
    car: null, // the car Kai is driving, or null on foot
    fireCd: 0, hurtCd: 0, aimAngle: 0,
    cash: 0,
  };
}

export function nearestCar(G, maxD) {
  let best = null;
  let bestD = maxD;
  for (const c of G.cars) {
    if (c.dead) continue;
    const d = dist(G.player.x, G.player.y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const k = G.keys;
  if (p.hurtCd > 0) p.hurtCd -= dt;
  if (p.fireCd > 0) p.fireCd -= dt;

  if (p.car) {
    // Driving is handled by vehicles.js; the player rides along.
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    return;
  }

  // On foot: WASD, Shift to sprint, collide with buildings and cars.
  let mx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
  let my = (k.down ? 1 : 0) - (k.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    const speed = k.sprint ? SPRINT_SPEED : FOOT_SPEED;
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    p.angle = Math.atan2(my, mx);
  }
  p.x = clamp(p.x, 30, WORLD - 30);
  p.y = clamp(p.y, 30, WORLD - 30);
  collideSolids(p, 13);
  for (const c of G.cars) {
    if (c.dead) continue;
    const d = dist(p.x, p.y, c.x, c.y);
    if (d < 30 && d > 0.01) {
      p.x += ((p.x - c.x) / d) * (30 - d);
      p.y += ((p.y - c.y) / d) * (30 - d);
    }
  }
  if (groundAt(p.x, p.y) === 'water') {
    p.y = 3110; // Kai does not swim: the beach stops him.
  }

  // Aim at the mouse, fire with the left button.
  p.aimAngle = Math.atan2(G.mouse.worldY - p.y, G.mouse.worldX - p.x);
  if (G.mouse.down && p.fireCd <= 0) {
    p.fireCd = 0.22;
    G.bullets.push({
      x: p.x + Math.cos(p.aimAngle) * 20,
      y: p.y + Math.sin(p.aimAngle) * 20,
      vx: Math.cos(p.aimAngle) * 640,
      vy: Math.sin(p.aimAngle) * 640,
      life: 0.9, from: 'player', dmg: 34,
    });
    G.lastShotAt = G.time;
    G.lastShotX = p.x;
    G.lastShotY = p.y;
    G.muzzle = { x: p.x + Math.cos(p.aimAngle) * 22, y: p.y + Math.sin(p.aimAngle) * 22, t: 0.05 };
    sfxShot();
    addWanted(G, 0, ''); // firing in public draws eyes; the star comes from hits below
    if (G.wanted === 0 && Math.random() < 0.5) addWanted(G, 1, 'SHOTS FIRED');
  }

  // Slow health regen when nobody is hunting Kai.
  if (G.wanted === 0 && p.hp < 100) p.hp = Math.min(100, p.hp + 2.5 * dt);
  if (p.hp <= 0) {
    G.state = 'wasted';
    G.bustedReason = 'WASTED';
  }
}

// E near a car: get in. E in a car: get out. E near an occupied car: steal it.
export function tryEnterCar(G) {
  const p = G.player;
  if (p.car) {
    const car = p.car;
    car.driver = 'none';
    p.car = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    collideSolids(p, 13);
    return;
  }
  const car = nearestCar(G, 56);
  if (!car) return;
  if (car.driver === 'npc' || car.driver === 'cop') {
    // Yank the driver out onto the sidewalk and take the wheel.
    const driver = makePed(car.x + 40, car.y + 40);
    driver.state = 'flee';
    driver.wait = 3;
    G.peds.push(driver);
    addWanted(G, 1, 'GRAND THEFT AUTO');
  }
  car.driver = 'player';
  car.kind = 'player'; // a stolen cruiser answers to Kai now, not to the PD
  p.car = car;
  p.x = car.x;
  p.y = car.y;
}

// Bullets fly, spark off walls, drop peds and cops, and dent cars.
export function updateBullets(G, dt) {
  for (const b of [...G.bullets]) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    const wall = solidHit(G, b.x, b.y);
    if (wall) {
      dead = true;
      for (let i = 0; i < 4; i++) {
        G.particles.push({
          x: b.x, y: b.y, vx: rand(-120, 120), vy: rand(-120, 120),
          life: rand(0.1, 0.3), max: 0.3, color: '#ffd94d', size: rand(1, 3), kind: 'spark',
        });
      }
    }
    if (!dead) {
      if (b.from === 'player') {
        for (const ped of G.peds) {
          if (ped.state !== 'down' && dist(b.x, b.y, ped.x, ped.y) < 14) {
            const died = knockPed(G, ped, true);
            if (died) addWanted(G, 1, 'PEDESTRIAN DOWN');
            dead = true;
            break;
          }
        }
        if (!dead) {
          for (const cop of G.cops) {
            if (dist(b.x, b.y, cop.x, cop.y) < 14) {
              cop.hp -= 1;
              dead = true;
              break;
            }
          }
        }
        if (!dead) {
          for (const c of G.cars) {
            if (c.driver === 'player' || c.dead) continue;
            if (dist(b.x, b.y, c.x, c.y) < 26) {
              c.hp -= b.dmg;
              if (c.kind === 'police') addWanted(G, 1, 'SHOOTING AT POLICE');
              dead = true;
              break;
            }
          }
        }
      } else {
        const p = G.player;
        if (!p.car && dist(b.x, b.y, p.x, p.y) < 14) {
          hurtPlayer(G, b.dmg);
          dead = true;
        } else if (p.car && dist(b.x, b.y, p.car.x, p.car.y) < 26) {
          p.car.hp -= b.dmg * 0.5;
          dead = true;
        }
      }
    }
    if (dead) G.bullets = G.bullets.filter((o) => o !== b);
  }
  if (G.muzzle) {
    G.muzzle.t -= dt;
    if (G.muzzle.t <= 0) G.muzzle = null;
  }
}

function solidHit(G, x, y) {
  for (const b of G.city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

export function hurtPlayer(G, dmg) {
  const p = G.player;
  if (p.hurtCd > 0) return;
  p.hurtCd = 0.35;
  p.hp -= dmg;
  G.shake = Math.min(8, G.shake + 3);
  if (p.hp <= 0) {
    G.state = 'wasted';
    G.bustedReason = 'WASTED';
  }
}
