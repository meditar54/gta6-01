# Solmara Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/meditar54/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/meditar54/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmara Heat** is an open-world crime game in the spirit of GTA 6, built for the make.fun gta6-01 bounty. Kai Mercer, a getaway driver, owes the fixer Mara Voss $50,000. Four jobs will clear the debt — if Solmara PD and the Harbor Kings don't get him first.

The city of Solmara is a sun-soaked coastal town: an avenue grid with traffic and pedestrians, a central park, a container port, and a beach on the south edge. Everything is original — the city, the characters, the cars, the story, the art and the music. Nothing is taken from any commercial game.

<sub>Entered on [make.fun](https://make.fun/?ref=07pa6jxr&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

## What is in the game

- **An open world to explore on foot and by car** — 3,200 × 3,200 px of streets, blocks, park, port and beach, with a camera that follows Kai.
- **Traffic and pedestrians** — cars drive the avenue grid in their own lanes and turn at crossings; people stroll the sidewalks and scatter when shots are fired or a car bears down on them.
- **Cars to steal and drive** — walk up to any car and press E. Yank the driver out and the PD notices. Arcade handling with acceleration, braking, handbrake drift and skid marks.
- **A wanted level (1–5 stars) with police who respond** — crimes raise the heat, patrol cars chase and ram, foot cops shoot and bust. Lay low and the stars bleed away.
- **Missions and a story** — four jobs for Mara Voss (a first fare, a stolen Comet GT, a harbor run, a bank vault), each with objective markers, a minimap blip and a payout. Finish all four and the debt is paid.
- **Combat** — mouse aim, click to shoot. Cops shoot back.
- **A HUD with a minimap** — health, cash, wanted stars, the whole city shrunk to a corner with the player, the objective, police and fares as blips, plus a speedometer when driving.
- **Side work** — once Kai has a reputation, pedestrians hail taxis. Pick up a fare, get them where they're going, get paid.
- **Start screen and saving** — New Game / Continue / How to Play, and progress (cash, jobs done, position) saves automatically to localStorage.
- **Sound** — every sound is synthesized with WebAudio: engine hum, two-tone sirens, gunshots, crashes, pickups and a mellow synth loop. No audio files, no network.

## Play

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. Keyboard and mouse. No network, no build step: `game/` is plain static files.

| Key | Does |
| --- | --- |
| WASD / arrows | Move on foot, drive in a car |
| Mouse | Aim (on foot), click to shoot |
| E | Enter / exit / steal a car, pick up a taxi fare, crack the vault |
| SPACE | Handbrake while driving |
| SHIFT | Sprint on foot |
| P / Esc | Pause |
| M | Mute |
| R (on pause screen) | Restart the story |

## How it is built

2D top-down canvas, hand-written JavaScript, zero libraries and zero external assets. All art is drawn procedurally on the canvas; all sound is synthesized with WebAudio. The source is split into one file per job under `game/src/`:

- `city.js` — Solmara itself: the avenue grid, buildings, park, port, beach, named places
- `vehicles.js` — cars, driving physics, traffic AI, stealing, explosions
- `peds.js` — pedestrians: strolling, fleeing, taxi fares
- `police.js` — the wanted system and police pursuit
- `player.js` — Kai on foot: movement, aiming, shooting, entering cars
- `missions.js` — the four story jobs and the taxi side work
- `render.js` — everything drawn: city, cars, people, bullets, particles
- `hud.js` — health, cash, wanted stars, minimap, objective, banners
- `audio.js` — synthesized sound and music
- `input.js` — keyboard and mouse
- `save.js` — localStorage progress
- `main.js` — boot, the game loop, screens, camera, screenshot staging

## Build the entry

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with `buildDossier` from `vendor/makefun-game.ts`.

## Screenshots

`?shot=` stages a scene for screenshots: `start` (title screen), `foot` (Kai on foot by the garage), `chase` (a three-star pursuit in the Comet GT), `mission` (the gold Comet GT at the port). Each plays the real rules forward for a few seconds, so every screenshot is the game itself.
