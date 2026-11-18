// city.js — Solmara, a sun-soaked coastal city, generated once from a fixed seed.
// The world is a road grid: 8 north-south and 8 east-west avenues, blocks of
// buildings between them, a park in the middle, a container port on the east edge
// and a beach with open water along the south edge.
import { mulberry32, randi, pick } from './utils.js';

export const WORLD = 3200;
export const ROADS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROAD_W = 72;
export const HALF = ROAD_W / 2;

const BUILDING_COLORS = [
  '#e8b4b8', '#f2d5a0', '#a8d8d8', '#d9a5c0', '#f5e6c8',
  '#b8d0e8', '#e8c9a0', '#c8b8e8', '#a8c8a0', '#e8a8a0',
];
const ROOF_COLORS = ['#c96f4a', '#7a6a5a', '#5a7a8a', '#8a5a6a', '#6a8a5a'];

function buildCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const trees = [];
  const containers = [];
  const lamps = [];

  // Buildings fill every block except the park block and the port strip.
  for (let bx = 0; bx < 7; bx++) {
    for (let by = 0; by < 7; by++) {
      const x0 = ROADS[bx] + HALF + 14;
      const y0 = ROADS[by] + HALF + 14;
      const x1 = ROADS[bx + 1] - HALF - 14;
      const y1 = ROADS[by + 1] - HALF - 14;
      if (bx === 3 && by === 3) {
        // Central park: trees and a pond instead of buildings.
        for (let i = 0; i < 26; i++) {
          trees.push({
            x: x0 + rng() * (x1 - x0),
            y: y0 + rng() * (y1 - y0),
            r: 10 + rng() * 9,
          });
        }
        continue;
      }
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const w = 70 + rng() * 110;
        const h = 60 + rng() * 100;
        const x = x0 + rng() * Math.max(1, x1 - x0 - w);
        const y = y0 + rng() * Math.max(1, y1 - y0 - h);
        const b = { x, y, w, h, color: pick(BUILDING_COLORS), roof: pick(ROOF_COLORS), tall: rng() < 0.25 };
        // Keep buildings from overlapping each other in the same block.
        if (buildings.some((o) => o.x < b.x + b.w + 18 && b.x < o.x + o.w + 18 && o.y < b.y + b.h + 18 && b.y < o.y + o.h + 18)) continue;
        buildings.push(b);
      }
    }
  }

  // Port strip on the east edge: stacked shipping containers.
  for (let i = 0; i < 14; i++) {
    containers.push({
      x: 3060 + (i % 2) * 62,
      y: 260 + Math.floor(i / 2) * 110,
      w: 54,
      h: 96,
      color: pick(['#d95f4b', '#4b8ad9', '#e8b84b', '#4bd97a', '#b84bd9']),
    });
  }

  // Street lamps along every avenue, both sides, every 200 px.
  for (const r of ROADS) {
    for (let d = 120; d < WORLD; d += 200) {
      lamps.push({ x: r - HALF - 8, y: d });
      lamps.push({ x: r + HALF + 8, y: d });
    }
  }
  // Sidewalk trees, scattered but never on a road.
  for (let i = 0; i < 90; i++) {
    const x = 100 + rng() * (WORLD - 200);
    const y = 100 + rng() * (WORLD - 200);
    if (isRoad(x, y)) continue;
    trees.push({ x, y, r: 8 + rng() * 7 });
  }

  return { buildings, trees, containers, lamps, seed };
}

// Named places the story uses. All coordinates are world coordinates.
export const PLACES = {
  hideout: { x: 700, y: 700, label: 'Voss Garage' },
  bank: { x: 1500, y: 1100, label: 'Solmara Trust Bank' },
  port: { x: 3090, y: 620, label: 'Port Solmara' },
  marina: { x: 1000, y: 3060, label: 'Marina Bay' },
  hospital: { x: 2500, y: 2500, label: 'Solmara General' },
  plaza: { x: 1600, y: 1600, label: 'Palm Plaza Park' },
  dealer: { x: 2100, y: 900, label: 'Comet Motors' },
  diner: { x: 900, y: 2100, label: 'Sunset Diner' },
};

export const CITY = buildCity(7);

export function isRoad(x, y) {
  if (x < 0 || y < 0 || x > WORLD || y > WORLD) return false;
  for (const r of ROADS) {
    if (Math.abs(x - r) <= HALF || Math.abs(y - r) <= HALF) return true;
  }
  return false;
}

// True when a point sits inside a building or a container (solid obstacles).
export function solidAt(x, y) {
  for (const b of CITY.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  for (const c of CITY.containers) {
    if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return c;
  }
  return null;
}

// Push a circle out of every solid it overlaps. Returns true if it moved.
export function collideSolids(ent, r) {
  let moved = false;
  for (const b of CITY.buildings) {
    const nx = Math.max(b.x, Math.min(ent.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(ent.y, b.y + b.h));
    const dx = ent.x - nx;
    const dy = ent.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 === 0) { ent.x = b.x - r; moved = true; continue; }
      const d = Math.sqrt(d2);
      ent.x += (dx / d) * (r - d);
      ent.y += (dy / d) * (r - d);
      moved = true;
    }
  }
  for (const c of CITY.containers) {
    const nx = Math.max(c.x, Math.min(ent.x, c.x + c.w));
    const ny = Math.max(c.y, Math.min(ent.y, c.y + c.h));
    const dx = ent.x - nx;
    const dy = ent.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0) {
      const d = Math.sqrt(d2);
      ent.x += (dx / d) * (r - d);
      ent.y += (dy / d) * (r - d);
      moved = true;
    }
  }
  return moved;
}

// Nearest point on the road network (used to spawn traffic and police).
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROADS) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y: clampY(y) }; }
  }
  for (const ry of ROADS) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x: clampX(x), y: ry }; }
  }
  return best;
  function clampX(v) { return Math.max(80, Math.min(WORLD - 80, v)); }
  function clampY(v) { return Math.max(80, Math.min(WORLD - 80, v)); }
}

// A random point on a random avenue (traffic / pedestrian spawning).
export function randomRoadPoint() {
  if (Math.random() < 0.5) {
    return { x: pick(ROADS), y: 80 + Math.random() * (WORLD - 160) };
  }
  return { x: 80 + Math.random() * (WORLD - 160), y: pick(ROADS) };
}

// Is this point on the beach / in the water at the south edge?
export function groundAt(x, y) {
  if (y > 3120) return 'water';
  if (y > 3036) return 'sand';
  if (x > 3036 && y < 1100) return 'port';
  if (x > 1436 && x < 1764 && y > 1436 && y < 1764) return 'park';
  return isRoad(x, y) ? 'road' : 'grass';
}

export { randi };
