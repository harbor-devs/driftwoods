import * as THREE from 'three';
import './style.css';
import { TILE_COST, JOURNEY_TIME } from './config.js';
import { renderer, scene, camera } from './scene.js';
import { createOcean, waveHeight } from './ocean.js';
import { createRaft } from './raft.js';
import { createDebris } from './debris.js';
import { createHook } from './hook.js';
import { createBuilder } from './build.js';
import { createShark } from './shark.js';
import { createIsland } from './island.js';
import { createHud, createJourneyBar, showEndScreen } from './ui.js';

// ---------- Game state ----------
let planks = 0;
let buildMode = false;
let journeyTime = 0;
let gameEnded = false;

// ---------- Create everything ----------
const ocean = createOcean(scene);
const raft = createRaft(scene);
const debris = createDebris(scene);
const builder = createBuilder(raft);
const shark = createShark(scene, raft.group, raft.tiles, waveHeight);
const island = createIsland(scene);
const hud = createHud();
const journeyBar = createJourneyBar();

const hook = createHook(scene, raft, debris, () => {
  planks++;
  refreshHud();
});

function refreshHud() {
  hud.update(planks, buildMode);
}
refreshHud();

// ---------- Input ----------
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

window.addEventListener('keydown', (e) => {
  if (e.key === 'b' || e.key === 'B') {
    buildMode = !buildMode;
    builder.hide();
    refreshHud();
  }
});

// ---------- Game loop ----------
let lastTime = performance.now();

function animate() {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05); // seconds since last frame
  lastTime = now;
  const t = now / 1000;

  ocean.update(t);
  raft.update(t);
  debris.update(dt, t);
  hook.update(dt);

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