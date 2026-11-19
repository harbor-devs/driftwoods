import * as THREE from 'three';
import './style.css';
import { TILE_COST, WORLD_LIMIT } from './config.js';
import { renderer, scene, camera, followRaft, shakeCamera } from './scene.js';
import { createOcean, waveHeight } from './ocean.js';
import { createRaft } from './raft.js';
import { createCharacter } from './character.js';
import { createDebris } from './debris.js';
import { createHook } from './hook.js';
import { createBuilder } from './build.js';
import { createShark } from './shark.js';
import { createOar } from './oar.js';
import { createIsland } from './island.js';
import { createGuide } from './guide.js';
import { initSplashes, updateSplashes } from './splash.js';
import {
  createHud,
  createMapBar,
  createSharkWarning,
  createPauseMenu,
  showToast,
  showEndScreen,
} from './ui.js';

// ---------- Game settings ----------
const MAP_PIECES = 3; // bottles you need to find
const RAFT_GOAL = 10; // tiles your raft needs before you can sail to the island
const BEACH_REACH = 10.5; // a tile this close to the island's middle = touching the beach

// ---------- Game state ----------
let planks = 0;
let buildMode = false;
let mapPieces = 0;
let islandRevealed = false;
let gameEnded = false;
let paused = false;
let gameTime = 0; // game clock in seconds, only ticks while NOT paused
let steerHintShown = false;
let buildHintShown = false;

function sideName(side) {
  return side < 0 ? 'left' : 'right';
}

// ---------- Create everything ----------
const ocean = createOcean(scene);
initSplashes(scene);
const raft = createRaft(scene);
const character = createCharacter(raft);
const builder = createBuilder(raft);
const island = createIsland(scene);
const guide = createGuide(scene);
const hud = createHud();
const mapBar = createMapBar(MAP_PIECES, RAFT_GOAL);
const sharkWarning = createSharkWarning();

const pauseMenu = createPauseMenu({
  onResume: () => setPaused(false),
  onRestart: () => location.reload(),
});

const debris = createDebris(scene, (event, side) => {
  if (event === 'bottleSpawned') showToast(`A bottle! Far to your ${sideName(side)}`);
  if (event === 'bottleMissed') showToast('The bottle drifted away. Another will come');
});

// The shark tells us what it's doing, and we decide how it feels
const shark = createShark(scene, raft.group, raft.tiles, waveHeight, (event) => {
  if (event === 'bite') shakeCamera(0.25);
  if (event === 'tileLost') {
    shakeCamera(0.6);
    showToast('The shark ate a tile!');
  }
});

// The hook comes out of the character's hands
const hook = createHook(scene, character.hand, debris, (kind) => {
  if (kind === 'plank') {
    planks++;
    refreshHud();
  }
  if (kind === 'bottle') foundMapPiece();
});

const oar = createOar(scene, character, shark, (result) => {
  if (result === 'scared') {
    shakeCamera(0.2);
    showToast('Whack! The shark swam off... for now');
  }
  if (result === 'killed') {
    shakeCamera(0.35);
    showToast('Shark down! Another one will come');
  }
});

function foundMapPiece() {
  mapPieces++;
  if (mapPieces < MAP_PIECES) {
    showToast(`Map piece ${mapPieces} of ${MAP_PIECES}!`);
  } else {
    debris.stopBottles(); // no more bottles once the map is complete
  }
}

// Runs every frame: when BOTH goals are done, the island shows up
function checkGoals() {
  if (islandRevealed || mapPieces < MAP_PIECES) return;

  if (raft.tiles.size < RAFT_GOAL) {
    if (!buildHintShown) {
      showToast(`Map complete! Build your raft to ${RAFT_GOAL} tiles to set sail`);
      buildHintShown = true;
    }
    return;
  }

  // Both done: put the island off to one side of the raft
  const raftX = raft.group.position.x;
  let side = Math.random() < 0.5 ? -1 : 1;
  let x = raftX + side * (10 + Math.random() * 6);
  if (Math.abs(x) > WORLD_LIMIT - 10) {
    side = -side;
    x = raftX + side * (10 + Math.random() * 6);
  }
  island.reveal(x);
  islandRevealed = true;
  showToast(`Land ho! The island is to your ${sideName(side)}`);
}

// What the arrow should point at right now
function getGuideTarget() {
  if (islandRevealed) return { pos: island.position, kind: 'island' };
  const bottle = debris.list.find((d) => d.kind === 'bottle' && !d.hooked);
  if (bottle) return { pos: bottle.mesh.position, kind: 'bottle' };
  return null;
}

function refreshHud() {
  hud.update(planks, buildMode);
}
refreshHud();

function endGame(title, text) {
  gameEnded = true;
  sharkWarning.set(false);
  guide.hide();
  showEndScreen(title, text);
}

// ---------- Mouse ----------
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();

// Where the mouse points on the water right now (the oar aims here)
const mouseAim = new THREE.Vector3();
let hasMouseAim = false;

// Turns the mouse position on screen into a point on the water
function getWaterPoint(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  return raycaster.ray.intersectPlane(waterPlane, hitPoint);
}

function swingTowardMouse() {
  if (!hasMouseAim) return;
  const me = character.worldPos;
  oar.swingAt(Math.atan2(mouseAim.x - me.x, mouseAim.z - me.z));
}

window.addEventListener('pointermove', (e) => {
  const p = getWaterPoint(e);
  if (!p) return;
  mouseAim.copy(p);
  hasMouseAim = true;
  if (buildMode) builder.hover(p, planks >= TILE_COST);
});

// Stop the right-click menu from popping up
window.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('pointerdown', (e) => {
  if (gameEnded || paused) return; // clicks on the pause menu don't throw the hook

  const p = getWaterPoint(e);
  if (p) {
    mouseAim.copy(p);
    hasMouseAim = true;
  }

  // Right click = swing the oar
  if (e.button === 2) {
    swingTowardMouse();
    return;
  }

  // Left click only from here
  if (e.button !== 0) return;

  if (buildMode) {
    if (planks >= TILE_COST && builder.place()) {
      planks -= TILE_COST;
      refreshHud();
    }
    return;
  }

  if (p) hook.throwAt(p);
});

// ---------- Keyboard ----------
// We keep a list of keys that are held down right now
const keysDown = new Set();

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();

  // Esc or P opens/closes the pause menu
  if ((key === 'escape' || key === 'p') && !e.repeat) {
    if (!gameEnded) setPaused(!paused);
    return;
  }

  if (gameEnded || paused) return;
  keysDown.add(key);

  if (key === 'b' && !e.repeat) {
    buildMode = !buildMode;
    builder.hide();
    refreshHud();
  }

  if (key === ' ' && !e.repeat) {
    e.preventDefault(); // stop Space from scrolling the page
    swingTowardMouse();
  }
});

window.addEventListener('keyup', (e) => {
  keysDown.delete(e.key.toLowerCase());
});

// Which way WASD / arrows are pushing. W is "up the screen" = away from the camera.
function getMoveInput() {
  const input = { x: 0, z: 0 };
  if (gameEnded) return input;
  if (keysDown.has('a') || keysDown.has('arrowleft')) input.x -= 1;
  if (keysDown.has('d') || keysDown.has('arrowright')) input.x += 1;
  if (keysDown.has('w') || keysDown.has('arrowup')) input.z -= 1;
  if (keysDown.has('s') || keysDown.has('arrowdown')) input.z += 1;
  return input;
}

// ---------- Pause ----------
function setPaused(on) {
  if (gameEnded) on = false; // no pausing on the win / lose screen
  if (on === paused) return;
  paused = on;
  keysDown.clear(); // so he doesn't keep walking after you resume
  if (paused) pauseMenu.show();
  else pauseMenu.hide();
}

// Click away from the window = let go of all keys AND pause
window.addEventListener('blur', () => {
  keysDown.clear();
  setPaused(true);
});

// Switch to another tab = pause
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
});

// ---------- Game loop ----------
let lastTime = performance.now();

function animate() {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05); // seconds since last frame
  lastTime = now;

  // Paused: just draw the frozen scene, don't move anything
  if (paused) {
    renderer.render(scene, camera);
    return;
  }

  gameTime += dt;
  const t = gameTime;

  const raftX = raft.group.position.x;
  const raftZ = raft.group.position.z;

  ocean.update(t);
  raft.update(dt, t, character.position); // raft leans based on where he stands
  character.update(dt, t, getMoveInput());
  followRaft(raftX, raftZ, dt);
  debris.update(dt, t, raftX);
  hook.update(dt);
  oar.update(dt);
  updateSplashes(dt, t);

  if (!gameEnded) {
    shark.update(dt, t);
    sharkWarning.set(shark.isThreat());

    checkGoals();
    mapBar.set(mapPieces, raft.tiles.size, islandRevealed);

    const target = getGuideTarget();
    guide.update(t, character.worldPos, target && target.pos, target && target.kind);

    island.update(dt);

    if (raft.tiles.size === 0) {
      endGame('Your raft is gone', 'The shark won this time.');
    } else if (islandRevealed) {
      // Win = any tile actually touches the island's beach
      const touching = raft.distanceTo(island.position) < BEACH_REACH;
      if (touching) {
        endGame(
          'You made it!',
          `You found the map, built a ${raft.tiles.size} tile raft, and reached the island.`
        );
      } else if (island.isArrived() && !steerHintShown) {
        showToast('Sail over and touch the beach!');
        steerHintShown = true;
      }
    }
  }

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);