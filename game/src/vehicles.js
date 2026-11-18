// vehicles.js — cars: the factory, arcade driving physics, traffic AI that
// follows the avenue grid, and stealing. Every car is one plain object;
// the player drives whichever car has driver === 'player'.
import { ROADS, WORLD, collideSolids, randomRoadPoint } from './city.js';
import { clamp, rand, pick, angDiff, dist } from './utils.js';
import { sfxCrash, sfxExplosion } from './audio.js';

export const CAR_MODELS = [
  { name: 'Sunbeam', color: '#e8b84b', top: 300, accel: 210, turn: 2.6 },
  { name: 'Coral Coupe', color: '#d95f4b', top: 330, accel: 230, turn: 2.8 },
  { name: 'Tide Sedan', color: '#4b8ad9', top: 290, accel: 200, turn: 2.5 },
  { name: 'Palm Van', color: '#7ab86a', top: 250, accel: 170, turn: 2.1 },
  { name: 'Marina Taxi', color: '#f2c94c', top: 300, accel: 210, turn: 2.6 },
  { name: 'Comet GT', color: '#ffd94d', top: 400, accel: 300, turn: 3.1 },
  { name: 'Harbor Truck', color: '#8a7a6a', top: 230, accel: 150, turn: 1.9 },
];

let nextCarId = 1;

export function makeCar(x, y, angle, model, kind = 'traffic', driver = 'npc') {
  return {
    id: nextCarId++,
    x, y, angle, speed: 0,
    model: model.name, color: model.color,
    top: model.top, accel: model.accel, turn: model.turn,
    kind, driver,
    hp: 100, smoke: 0, dead: false,
    // Traffic state: which avenue it is on, which way it drives, cruise speed.
    axis: 'x', line: y, dir: 1, cruise: 120 + Math.random() * 60,
    lastTurnKey: '',
    stuck: 0,
    skid: [],
  };
}

export function modelByName(name) {
  return CAR_MODELS.find((m) => m.name === name) || CAR_MODELS[0];
}

// Spawn a traffic car on a random avenue, in the correct right-hand lane.
export function spawnTrafficCar(G) {
  const p = randomRoadPoint();
  const vertical = Math.abs(p.x - ROADS.reduce((a, r) => (Math.abs(r - p.x) < Math.abs(a - p.x) ? r : a), ROADS[0])) < 1;
  const car = makeCar(p.x, p.y, 0, pick(CAR_MODELS));
  if (vertical) {
    car.axis = 'y';
    car.line = p.x;
    car.dir = Math.random() < 0.5 ? 1 : -1;
    car.x = p.x + (car.dir === 1 ? -16 : 16); // right-hand lane
    car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.axis = 'x';
    car.line = p.y;
    car.dir = Math.random() < 0.5 ? 1 : -1;
    car.y = p.y + (car.dir === 1 ? 16 : -16);
    car.angle = car.dir === 1 ? 0 : Math.PI;
  }
  car.speed = car.cruise;
  G.cars.push(car);
  return car;
}

function nearestLine(v) {
  let best = ROADS[0];
  for (const r of ROADS) if (Math.abs(r - v) < Math.abs(best - v)) best = r;
  return best;
}

// One traffic car follows its avenue; at a crossing it may turn left or right.
function updateTrafficCar(G, car, dt) {
  // Slow for the car ahead in the same lane.
  let target = car.cruise;
  for (const o of G.cars) {
    if (o === car || o.dead) continue;
    const dx = o.x - car.x;
    const dy = o.y - car.y;
    const ahead = car.axis === 'x' ? dx * car.dir : dy * car.dir;
    const side = car.axis === 'x' ? Math.abs(dy) : Math.abs(dx);
    if (ahead > 0 && ahead < 85 && side < 30) target = Math.min(target, Math.max(0, o.speed * 0.85));
  }
  car.speed += clamp(target - car.speed, -260 * dt, 150 * dt);

  const step = car.speed * dt;
  if (car.axis === 'x') car.x += car.dir * step;
  else car.y += car.dir * step;

  // At a crossing, maybe turn. The key stops it turning twice in one crossing.
  const along = car.axis === 'x' ? car.x : car.y;
  const cross = nearestLine(along);
  const key = car.axis + ':' + cross;
  if (Math.abs(along - cross) < 14 && car.lastTurnKey !== key) {
    car.lastTurnKey = key;
    const roll = Math.random();
    if (roll < 0.22) {
      // Turn: switch axis, snap to the new avenue's right-hand lane.
      if (car.axis === 'x') {
        const turnLeft = Math.random() < 0.5;
        car.axis = 'y';
        car.line = cross;
        car.dir = turnLeft ? (car.dir === 1 ? -1 : 1) : (car.dir === 1 ? 1 : -1);
        car.x = cross + (car.dir === 1 ? -16 : 16);
        car.y = nearestLine(car.y);
        car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.axis = 'x';
        car.line = cross;
        car.dir = Math.random() < 0.5 ? 1 : -1;
        car.y = cross + (car.dir === 1 ? 16 : -16);
        car.x = nearestLine(car.x);
        car.angle = car.dir === 1 ? 0 : Math.PI;
      }
    }
  }
  // Reached the edge of town: turn around at the next avenue.
  if (car.x < 60 || car.x > WORLD - 60 || car.y < 60 || car.y > WORLD - 60) {
    car.dir *= -1;
    car.angle += Math.PI;
  }
}

// Player driving: arcade physics — accelerate, brake/reverse, steer by speed,
// handbrake drift, building collisions that scrape speed off.
export function drivePlayerCar(G, car, dt) {
  const k = G.keys;
  const forward = (k.up ? 1 : 0) - (k.down ? 1 : 0);
  const steer = (k.left ? -1 : 0) + (k.right ? 1 : 0);
  const handbrake = !!k.brake;
  if (forward > 0) car.speed += car.accel * dt;
  else if (forward < 0) car.speed -= (car.speed > 5 ? car.accel * 1.1 : car.accel * 0.45) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 60 * dt);
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 320 * dt);
  }
  car.speed = clamp(car.speed, -car.top * 0.45, car.top);
  const grip = handbrake ? 1.7 : 1;
  const spd = Math.abs(car.speed) / car.top;
  car.angle += steer * car.turn * grip * (0.35 + 0.65 * spd) * Math.sign(car.speed || 1) * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = nx;
  car.y = ny;
  car.x = clamp(car.x, 40, WORLD - 40);
  car.y = clamp(car.y, 40, WORLD - 40);
  const hitWall = collideSolids(car, 24);
  if (hitWall && Math.abs(car.speed) > 120) {
    car.speed *= 0.45;
    car.hp -= 6;
    G.shake = Math.min(10, G.shake + 4);
    sfxCrash();
    spawnSparks(G, car.x, car.y, 6);
  } else if (hitWall) {
    car.speed *= 0.7;
  }
  // Skid marks while cornering hard or handbraking.
  if (Math.abs(car.speed) > 140 && (handbrake || Math.abs(steer) > 0)) {
    car.skid.push({ x: car.x, y: car.y, a: car.angle, life: 1 });
    if (car.skid.length > 40) car.skid.shift();
  }
  for (const s of car.skid) s.life -= dt * 0.25;
  car.skid = car.skid.filter((s) => s.life > 0);
  if (car.hp <= 0 && !car.dead) explodeCar(G, car);
}

export function spawnSparks(G, x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    G.particles.push({
      x, y, vx: Math.cos(a) * rand(60, 220), vy: Math.sin(a) * rand(60, 220),
      life: rand(0.2, 0.5), max: 0.5, color: '#ffd94d', size: rand(2, 4), kind: 'spark',
    });
  }
}

export function explodeCar(G, car) {
  car.dead = true;
  car.hp = 0;
  G.shake = 14;
  sfxExplosion();
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    G.particles.push({
      x: car.x, y: car.y, vx: Math.cos(a) * rand(40, 260), vy: Math.sin(a) * rand(40, 260),
      life: rand(0.4, 1.1), max: 1.1, color: pick(['#ff7a3c', '#ffd94d', '#5a5a5a', '#ff3c3c']),
      size: rand(4, 10), kind: 'fire',
    });
  }
  if (car.driver === 'player') {
    G.player.car = null;
    car.driver = 'none'; // the wreck stays put; nobody drives it now
    G.player.x = car.x + 40;
    G.player.y = car.y + 40;
    G.player.hp -= 25;
  } else {
    G.cars = G.cars.filter((c) => c !== car);
  }
}

// Car-vs-car bumps: push apart, trade speed, spark and scrape paint.
export function collideCars(G, dt) {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      if (a.dead || b.dead) continue;
      const d = dist(a.x, a.y, b.x, b.y);
      if (d < 52 && d > 0.01) {
        const push = (52 - d) / 2;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 90) {
          a.speed *= 0.7;
          b.speed *= 0.7;
          a.hp -= 4;
          b.hp -= 4;
          spawnSparks(G, (a.x + b.x) / 2, (a.y + b.y) / 2, 4);
          if (a.driver === 'player' || b.driver === 'player') {
            sfxCrash();
            G.shake = Math.min(8, G.shake + 3);
          }
        }
        if (a.hp <= 0 && !a.dead) explodeCar(G, a);
        if (b.hp <= 0 && !b.dead) explodeCar(G, b);
      }
    }
  }
}

export function updateVehicles(G, dt) {
  // Keep the streets busy: traffic near the player, despawned far away.
  let traffic = G.cars.filter((c) => c.kind === 'traffic');
  for (const c of [...traffic]) {
    if (dist(c.x, c.y, G.player.x, G.player.y) > 1400) {
      G.cars = G.cars.filter((o) => o !== c);
    }
  }
  traffic = G.cars.filter((c) => c.kind === 'traffic');
  // The staged chase keeps its road clear: no fresh traffic wanders onto
  // Kai's escape route while the shutter is about to click.
  let tries = 0;
  while (traffic.length < 14 && tries < 24 && G.shot !== 'chase') {
    tries++;
    const p = randomRoadPoint();
    if (dist(p.x, p.y, G.player.x, G.player.y) < 500) continue;
    spawnTrafficCar(G);
    traffic = G.cars.filter((c) => c.kind === 'traffic');
  }
  for (const c of G.cars) {
    if (c.dead) continue;
    if (c.kind === 'traffic') updateTrafficCar(G, c, dt);
    else if (c.kind === 'police') updatePoliceCar(G, c, dt);
    else if (c.driver === 'player') drivePlayerCar(G, c, dt);
    if (c.hp > 0 && c.hp < 35) {
      c.smoke += dt;
      if (c.smoke > 0.12) {
        c.smoke = 0;
        G.particles.push({
          x: c.x + rand(-8, 8), y: c.y + rand(-8, 8), vx: rand(-10, 10), vy: rand(-40, -15),
          life: rand(0.5, 0.9), max: 0.9, color: '#666', size: rand(5, 9), kind: 'smoke',
        });
      }
    }
  }
  collideCars(G, dt);
}

// Police pursuit driving: steer straight at the player, ramming speed a little
// below the player's top speed so a good driver can still break away.
function updatePoliceCar(G, car, dt) {
  const p = G.player;
  const tx = p.car ? p.car.x : p.x;
  const ty = p.car ? p.car.y : p.y;
  const want = Math.atan2(ty - car.y, tx - car.x);
  const turn = clamp(angDiff(car.angle, want), -1, 1);
  car.angle += turn * 3.4 * dt;
  const d = dist(car.x, car.y, tx, ty);
  const target = d > 90 ? car.top * 0.92 : car.top * 0.55;
  car.speed += clamp(target - car.speed, -300 * dt, 260 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 40, WORLD - 40);
  car.y = clamp(car.y, 40, WORLD - 40);
  const hitWall = collideSolids(car, 24);
  if (hitWall) {
    car.speed *= 0.6;
    // Unstick: nudge the nose away from the wall and keep going.
    car.angle += 0.6 * dt * (Math.random() < 0.5 ? 1 : -1);
  }
  if (Math.abs(car.speed) < 20) {
    car.stuck += dt;
    if (car.stuck > 2.5) {
      const p2 = nearestRoadPointSafe(G);
      car.x = p2.x;
      car.y = p2.y;
      car.angle = Math.atan2(ty - p2.y, tx - p2.x);
      car.speed = 100;
      car.stuck = 0;
    }
  } else {
    car.stuck = 0;
  }
  if (car.hp <= 0 && !car.dead) explodeCar(G, car);
}

function nearestRoadPointSafe(G) {
  for (let i = 0; i < 12; i++) {
    const p = randomRoadPoint();
    const d = dist(p.x, p.y, G.player.x, G.player.y);
    if (d > 350 && d < 700) return p;
  }
  return { x: G.player.x + 400, y: G.player.y };
}
