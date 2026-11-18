// save.js — Solmara Heat keeps its progress in this browser's localStorage:
// cash, which jobs are done, and where Kai was standing.
const KEY = 'solmara-heat-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(G) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      cash: Math.round(G.player.cash),
      completedMissions: G.completedMissions,
      missionIndex: G.missionIndex,
      storyComplete: G.storyComplete,
      x: Math.round(G.player.x),
      y: Math.round(G.player.y),
      savedAt: new Date().toISOString(),
    }));
  } catch {
    // Storage can be off: progress then lasts this visit only.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
