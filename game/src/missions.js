// missions.js — the story of Solmara Heat: four jobs for Mara Voss, the fixer
// who owns Kai's debt, plus repeatable taxi fares once Kai has a reputation.
// A mission is a list of steps; each step is one clear objective with a marker.
import { PLACES, nearestRoadPoint } from './city.js';
import { dist, fmtCash } from './utils.js';
import { makeCar, modelByName } from './vehicles.js';
import { addWanted } from './police.js';
import { sfxMissionDone, sfxPickup } from './audio.js';

export const MISSIONS = [
  {
    id: 'first-fare',
    title: 'First Fare',
    giver: 'Mara Voss',
    briefing: 'Mara needs a driver she can trust. Take the Sunbeam parked at the garage and drop her client at the Marina. Easy money. Don\'t scratch the paint.',
    reward: 300,
    steps: [
      { kind: 'getInCar', car: 'Sunbeam', at: PLACES.hideout, text: 'Get in the Sunbeam at Voss Garage' },
      { kind: 'goto', at: PLACES.marina, r: 90, text: 'Drive the client to Marina Bay' },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    giver: 'Mara Voss',
    briefing: 'A gold Comet GT just rolled off a freighter at Port Solmara. The owner won\'t miss it until morning. Steal it and bring it to the garage — and try not to bring the whole PD with you.',
    reward: 600,
    steps: [
      { kind: 'steal', car: 'Comet GT', at: PLACES.port, text: 'Steal the gold Comet GT at the port' },
      { kind: 'goto', at: PLACES.hideout, r: 90, text: 'Deliver the Comet GT to Voss Garage' },
    ],
  },
  {
    id: 'harbor-run',
    title: 'Harbor Run',
    giver: 'Mara Voss',
    briefing: 'A package is waiting at the Sunset Diner. Pick it up, and whatever you do, don\'t stop for the cops — the Harbor Kings tipped them off. Lose them, then get the package to Palm Plaza.',
    reward: 900,
    steps: [
      { kind: 'goto', at: PLACES.diner, r: 70, text: 'Pick up the package at the Sunset Diner' },
      { kind: 'escape', at: PLACES.plaza, r: 100, text: 'Lose the cops, then deliver to Palm Plaza Park' },
    ],
  },
  {
    id: 'big-score',
    title: 'The Big Score',
    giver: 'Mara Voss',
    briefing: 'This is the one that clears your debt, Kai. Solmara Trust Bank, noon, in and out. Grab the cash, then get to the garage with every cop in the city on your tail. Make it count.',
    reward: 2500,
    steps: [
      { kind: 'goto', at: PLACES.bank, r: 80, text: 'Reach Solmara Trust Bank' },
      { kind: 'hold', at: PLACES.bank, r: 70, secs: 4, text: 'Hold E — crack the vault' },
      { kind: 'escape', at: PLACES.hideout, r: 90, text: 'Escape with the cash — reach Voss Garage' },
    ],
  },
];

export function startMission(G, index) {
  const def = MISSIONS[index];
  if (!def) return;
  G.missionIndex = index;
  G.missionStep = 0;
  G.mission = def;
  G.missionHold = 0;
  G.missionCar = null;
  G.banner = { text: def.title, sub: def.giver + ': ' + def.briefing, t: 4.5, color: '#ffd94d' };
  setupStep(G);
}

function setupStep(G) {
  const step = G.mission.steps[G.missionStep];
  if (!step) return;
  G.missionHold = 0;
  if (step.kind === 'getInCar' || step.kind === 'steal') {
    // The job car waits on the road by the step's place, never inside a building.
    const spot = nearestRoadPoint(step.at.x, step.at.y);
    const car = makeCar(spot.x, spot.y, 0, modelByName(step.car), 'mission', 'none');
    G.cars.push(car);
    G.missionCar = car;
  }
  if (step.kind === 'escape' && G.mission.id === 'harbor-run' && G.missionStep === 1) {
    addWanted(G, 2, 'THE HARBOR KINGS TIPPED OFF THE PD');
  }
  if (step.kind === 'escape' && G.mission.id === 'big-score' && G.missionStep === 2) {
    addWanted(G, 4, 'BANK ALARM — EVERY UNIT RESPONDING');
  }
}

export function missionObjective(G) {
  if (!G.mission) return null;
  const step = G.mission.steps[G.missionStep];
  return step ? step.text : null;
}

export function missionMarker(G) {
  if (!G.mission) return null;
  const step = G.mission.steps[G.missionStep];
  if (!step) return null;
  if ((step.kind === 'getInCar' || step.kind === 'steal') && G.missionCar) {
    return { x: G.missionCar.x, y: G.missionCar.y };
  }
  return { x: step.at.x, y: step.at.y };
}

function completeStep(G) {
  sfxPickup();
  G.missionStep++;
  if (G.missionStep >= G.mission.steps.length) {
    completeMission(G);
  } else {
    setupStep(G);
  }
}

function completeMission(G) {
  const def = G.mission;
  G.player.cash += def.reward;
  G.completedMissions.push(def.id);
  G.banner = { text: 'JOB DONE  +' + fmtCash(def.reward), sub: def.title + ' — Mara Voss is pleased', t: 3.5, color: '#7ab86a' };
  sfxMissionDone();
  G.mission = null;
  G.missionCar = null;
  if (G.missionIndex + 1 < MISSIONS.length) {
    startMission(G, G.missionIndex + 1);
  } else {
    G.storyComplete = true;
    G.banner = { text: 'STORY COMPLETE', sub: 'The debt is paid. Solmara is yours — free roam!', t: 5, color: '#ffd94d' };
  }
  G.saveSoon = true;
}

export function updateMissions(G, dt) {
  if (!G.mission) return;
  const step = G.mission.steps[G.missionStep];
  if (!step) return;
  const p = G.player;
  if (step.kind === 'getInCar') {
    if (p.car === G.missionCar) completeStep(G);
  } else if (step.kind === 'steal') {
    if (p.car === G.missionCar) {
      addWanted(G, 1, 'COMET GT REPORTED STOLEN');
      completeStep(G);
    }
  } else if (step.kind === 'goto') {
    const tx = p.car ? p.car.x : p.x;
    const ty = p.car ? p.car.y : p.y;
    if (dist(tx, ty, step.at.x, step.at.y) < step.r) completeStep(G);
  } else if (step.kind === 'hold') {
    const inZone = dist(p.x, p.y, step.at.x, step.at.y) < step.r;
    if (inZone && G.keys.interact && !p.car) {
      G.missionHold += dt;
      if (G.missionHold >= step.secs) completeStep(G);
    } else {
      G.missionHold = Math.max(0, G.missionHold - dt * 2);
    }
  } else if (step.kind === 'escape') {
    const tx = p.car ? p.car.x : p.x;
    const ty = p.car ? p.car.y : p.y;
    if (dist(tx, ty, step.at.x, step.at.y) < step.r && G.wanted <= 1) completeStep(G);
  }
}

// ---- Taxi fares: the repeatable side job ---------------------------------
export function updateTaxi(G, dt) {
  if (G.completedMissions.length === 0) return; // Mara's first job comes first
  const p = G.player;
  if (G.taxi) {
    const tx = p.car ? p.car.x : p.x;
    const ty = p.car ? p.car.y : p.y;
    if (dist(tx, ty, G.taxi.dest.x, G.taxi.dest.y) < 80) {
      const fare = G.taxi.fare;
      p.cash += fare;
      G.banner = { text: 'FARE PAID  +' + fmtCash(fare), sub: 'Thanks for the ride, pal', t: 2.5, color: '#7ab86a' };
      sfxMissionDone();
      G.taxi = null;
      G.saveSoon = true;
    }
    return;
  }
  G.taxiCd -= dt;
  if (G.taxiCd > 0) return;
  G.taxiCd = 20;
  // A fare appears: a pedestrian waving at the curb near the player.
  const cands = G.peds.filter((ped) => ped.state === 'walk' && dist(ped.x, ped.y, p.x, p.y) < 600);
  if (cands.length === 0) return;
  const ped = cands[0];
  ped.taxi = true;
  ped.state = 'taxi';
  G.taxiPed = ped;
  G.taxiOffer = true;
}

export function taxiPickup(G) {
  const p = G.player;
  if (!G.taxiOffer || !p.car) return false;
  const ped = G.taxiPed;
  if (!ped || dist(ped.x, ped.y, p.x, p.y) > 80) return false;
  G.peds = G.peds.filter((o) => o !== ped);
  const dests = [PLACES.marina, PLACES.diner, PLACES.plaza, PLACES.hospital, PLACES.dealer];
  const dest = dests[Math.floor(Math.random() * dests.length)];
  G.taxi = { dest, fare: 60 + Math.floor(Math.random() * 90) };
  G.taxiOffer = false;
  G.taxiPed = null;
  G.banner = { text: 'FARE ON BOARD', sub: 'Get them to ' + dest.label, t: 2.5, color: '#f2c94c' };
  sfxPickup();
  return true;
}
