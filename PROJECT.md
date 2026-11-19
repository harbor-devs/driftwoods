# Driftwood

A short low-poly 3D raft game that runs in the browser. Hook floating planks, grow your raft, build nets, spikes and sails, find 3 map pieces in bottles, and sail to the island while a shark hunts your raft.

Play it: https://driftwood.harbordevs.com

## Stack
- Three.js (3D)
- Vite (dev server and build)
- Plain JavaScript, no framework
- Sound is made in code (Web Audio), no audio files
- One model file: public/models/shark.fbx (free CC0 shark, Quaternius)

## Run locally
1. npm install
2. npm run dev
3. To test the real build: npm run build, then npm run preview

Vite 8 needs Node 20.19+ or 22.12+.

## Hosting
- Hosted on Vercel (Hobby plan), project name driftwoods
- Repo: github.com/harbor-devs/driftwoods, branch main
- Every push to main deploys to production automatically
- Domain: driftwood.harbordevs.com (CNAME record in Cloudflare DNS, proxy off, pointing to Vercel)
- The old driftwoods.vercel.app address redirects to the domain

## Controls
- W A S D or arrow keys: walk (stand near an edge to lean and steer the raft)
- Left click: throw the hook
- Right click or Space: swing the oar
- B: build mode
- 1, 2, 3, 4: pick what to build (tile, catch net, spikes, sail)
- M: sound on or off
- Esc or P: pause

Keyboard and mouse only, so it is not playable on phones.

## How to win
Find 3 map pieces in bottles and grow the raft to 10 tiles. Then the island appears. Sail until a raft tile touches the island beach.

## Build costs (see src/config.js)
- Tile: 3 planks
- Catch net: 4 planks + 2 rope
- Spikes: 3 planks + 1 rope
- Sail: 6 planks + 3 rope (max 3, each makes the raft 30% faster)
- Barrels give rope

## Code layout (src)
config, scene, ocean, raft, character, debris, hook, oar, build, net, spikes, sail, shark, island, guide, splash, tilebreak, sound, ui, main, style.css

All tweakable numbers live in src/config.js.

## Versions
- V1 The Raft: DONE and live (hook, build menu, shark, map bottles, island, start screen, sound, UI)
- V2 Island update: land on the island, explore, build (later)
- V3 City: later

## Backlog (after V1)
- Shelter and storms (maybe)
- Multiplayer (later version)
- Phone controls (not planned yet)