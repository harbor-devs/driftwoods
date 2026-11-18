import * as THREE from 'three';
import './style.css';
import { TILE_COST, JOURNEY_TIME } from './config.js';
import { renderer, scene, camera, followRaft } from './scene.js';
import { createOcean, waveHeight } from './ocean.js';
import { createRaft } from './raft.js';
import { createCharacter } from './character.js';
import { createDebris } from './debris.js';
import { createHook } from './hook.js';
import { createBuilder } from './build.js';
import { createShark } from './shark.js';
import { createSpear } from './spear.js';
import { createIsland } from './island.js';
import { createHud, createJourneyBar, showToast, showEndScreen } from './ui.js';

// ---------- Game state ----------
let planks = 0;
let buildMode = false;
let journeyTime = 0;
let gameEnded = false;

// ---------- Create everything ----------
const ocean = createOcean(scene);
const raft = createRaft(scene);
const character = createCharacter(raft);
const debris = createDebris(scene);
const builder = createBuilder(raft);
const shark = createShark(scene, raft.group, raft.tiles, waveHeight);
const island = createIsland(scene);
const hud = createHud();
const journeyBar = createJourneyBar();

// The hook comes out of the character's hands
const hook = createHook(scene, character.hand, debris, () => {
  planks++;
  refreshHud();
});

const spear = createSpear(scene, raft, shark, (result) => {
  if (result === 'scared') showToast('Hit! The shark swam off... for now');
  if (result === 'killed') showToast('Shark down! Another one will come');
  if (result === 'miss') showToast('Missed. Wait till it gets close');
});

function refreshHud() {
  hud.update(planks, buildMode);
}
refreshHud();

// ---------- Mouse ----------
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const aimPoint = new THREE.Vector3();

// Turns the mouse position on screen into a point on the water
function getWaterPoint(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  return raycaster.ray.intersectPlane(waterPlane, aimPoint);
}

window.addEventListener('pointermove', (e) => {
  if (!buildMode) return;
  const p = getWaterPoint(e);
  if (p) builder.hover(p, planks >= TILE_COST);
});

window.addEventListener('pointerdown', (e) => {
  if (gameEnded) return;

  if (buildMode) {
    if (planks >= TILE_COST && builder.place()) {
      planks -= TILE_COST;
      refreshHud();
    }
    return;
  }

  const p = getWaterPoint(e);
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
    spear.stab();
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

  ocean.update(t);
  raft.update(dt, t, character.position); // raft leans based on where he stands
  character.update(dt, t, getMoveInput());
  followRaft(raft.group.position.x, dt);
  debris.update(dt, t, raft.group.position.x);
  hook.update(dt);
  spear.update(dt);

  if (!gameEnded) {
    shark.update(dt, t);

    journeyTime += dt;
    const progress = Math.min(journeyTime / JOURNEY_TIME, 1);
    journeyBar.set(progress);
    island.update(progress);

    if (progress > 0.85) debris.stopSpawning(); // no new planks near the island

    if (raft.tiles.size === 0) {
      gameEnded = true;
      showEndScreen('Your raft is gone', 'The shark won this time.');
    } else if (progress >= 1) {
      gameEnded = true;
      showEndScreen(
        'You made it!',
        `You reached the island with ${raft.tiles.size} tiles left. Island update coming soon.`
      );
    }
  }

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);