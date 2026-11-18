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
import {
  createHud,
  createMapBar,
  createSharkWarning,
  showToast,
  showEndScreen,
} from './ui.js';

// ---------- Game settings ----------
const MAP_PIECES = 3; // bottles you need to find
const DOCK_DISTANCE = 9; // how lined up with the island you must be to land

// ---------- Game state ----------
let planks = 0;
let buildMode = false;
let mapPieces = 0;
let gameEnded = false;
let steerHintShown = false;

function sideName(side) {
  return side < 0 ? 'left' : 'right';
}

// ---------- Create everything ----------
const ocean = createOcean(scene);
const raft = createRaft(scene);
const character = createCharacter(raft);
const builder = createBuilder(raft);
const island = createIsland(scene);
const hud = createHud();
const mapBar = createMapBar(MAP_PIECES);
const sharkWarning = createSharkWarning();

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
  mapBar.set(mapPieces);

  if (mapPieces < MAP_PIECES) {
    showToast(`Map piece ${mapPieces} of ${MAP_PIECES}!`);
    return;
  }

  // Map complete: the island shows up off to one side
  debris.stopBottles();
  const raftX = raft.group.position.x;
  let side = Math.random() < 0.5 ? -1 : 1;
  let x = raftX + side * (10 + Math.random() * 6);
  if (Math.abs(x) > WORLD_LIMIT - 10) {
    side = -side;
    x = raftX + side * (10 + Math.random() * 6);
  }
  island.reveal(x);
  showToast(`Map complete! Land is to your ${sideName(side)}`);
}

function refreshHud() {
  hud.update(planks, buildMode);
}
refreshHud();

function endGame(title, text) {
  gameEnded = true;
  sharkWarning.set(false);
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
  if (gameEnded) return;

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
  keysDown.add(key);
  if (gameEnded) return;

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

// If you click away from the window, let go of all keys
window.addEventListener('blur', () => keysDown.clear());

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

// ---------- Game loop ----------
let lastTime = performance.now();

function animate() {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05); // seconds since last frame
  lastTime = now;
  const t = now / 1000;

  const raftX = raft.group.position.x;

  ocean.update(t);
  raft.update(dt, t, character.position); // raft leans based on where he stands
  character.update(dt, t, getMoveInput());
  followRaft(raftX, dt);
  debris.update(dt, t, raftX);
  hook.update(dt);
  oar.update(dt);

  if (!gameEnded) {
    shark.update(dt, t);
    sharkWarning.set(shark.isThreat());
    island.update(dt);

    if (raft.tiles.size === 0) {
      endGame('Your raft is gone', 'The shark won this time.');
    } else if (island.isArrived()) {
      const linedUp = Math.abs(raftX - island.position.x) < DOCK_DISTANCE;
      if (linedUp) {
        endGame(
          'You made it!',
          `You found the map and reached the island with ${raft.tiles.size} tiles left.`
        );
      } else if (!steerHintShown) {
        showToast('Steer over to the island!');
        steerHintShown = true;
      }
    }
  }

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);