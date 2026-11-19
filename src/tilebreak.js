import * as THREE from 'three';
import { waveHeight } from './ocean.js';
import { randomWoodMaterial } from './raft.js';
import { splash } from './splash.js';

// ---------- Settings ----------
const GRAVITY = 14;
const FLOAT_MIN = 2.2; // seconds the pieces bob on the water before sinking
const FLOAT_MAX = 3.2;
const SINK_TIME = 0.9; // seconds they take to sink and shrink away

// Same shapes as a real raft tile, so the pieces look like parts of it
const plankGeo = new THREE.BoxGeometry(0.62, 0.25, 1.9);
const beamGeo = new THREE.BoxGeometry(1.95, 0.12, 0.18);
const beamMat = new THREE.MeshStandardMaterial({
  color: 0x6e4a2a,
  flatShading: true,
  roughness: 0.9,
});

let scene = null;
let time = 0; // game time from the last update, so new pieces know the wave height
const pieces = [];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// Call once at the start
export function initTileBreak(s) {
  scene = s;
}

function addPiece(geo, mat, x, y, z, baseScale) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x + randomBetween(-0.4, 0.4), y, z + randomBetween(-0.4, 0.4));
  mesh.rotation.set(
    randomBetween(0, Math.PI),
    randomBetween(0, Math.PI),
    randomBetween(0, Math.PI)
  );
  mesh.scale.setScalar(baseScale);
  mesh.castShadow = true;
  scene.add(mesh);

  const a = Math.random() * Math.PI * 2; // which way it flies
  const out = randomBetween(1.5, 3.5);
  pieces.push({
    mesh,
    baseScale,
    state: 'fly', // 'fly', then 'float', then 'sink'
    vel: new THREE.Vector3(Math.cos(a) * out, randomBetween(4, 6.5), Math.sin(a) * out),
    spin: new THREE.Vector3(randomBetween(-6, 6), randomBetween(-6, 6), randomBetween(-6, 6)),
    drift: new THREE.Vector3(),
    phase: Math.random() * Math.PI * 2,
    timer: 0,
    sinkTime: 0,
  });
}

// Call when the shark finishes a tile. x and z are where the tile was in the world.
export function spawnTileBreak(x, z) {
  if (!scene) return;
  const y = waveHeight(x, z, time) + 0.5;
  for (let i = 0; i < 3; i++) addPiece(plankGeo, randomWoodMaterial(), x, y, z, 0.8);
  for (let i = 0; i < 2; i++) addPiece(beamGeo, beamMat, x, y, z, 0.6);
}

// Runs every frame from main.js
export function updateTileBreak(dt, t) {
  time = t;

  for (let i = pieces.length - 1; i >= 0; i--) {
    const p = pieces[i];
    const m = p.mesh;
    const pos = m.position;

    if (p.state === 'fly') {
      // Thrown up and out, spinning, then falls
      p.vel.y -= GRAVITY * dt;
      pos.addScaledVector(p.vel, dt);
      m.rotation.x += p.spin.x * dt;
      m.rotation.y += p.spin.y * dt;
      m.rotation.z += p.spin.z * dt;

      const water = waveHeight(pos.x, pos.z, t);
      if (p.vel.y < 0 && pos.y < water + 0.05) {
        // Hit the water: little splash, then float
        splash(pos, 'small');
        p.state = 'float';
        p.timer = randomBetween(FLOAT_MIN, FLOAT_MAX);
        p.drift.set(p.vel.x * 0.25, 0, p.vel.z * 0.25);
      }
    } else if (p.state === 'float') {
      // Bob on the waves and slowly drift
      pos.x += p.drift.x * dt;
      pos.z += p.drift.z * dt;
      p.drift.multiplyScalar(Math.max(1 - 1.5 * dt, 0));
      pos.y = waveHeight(pos.x, pos.z, t) + 0.02 + Math.sin(t * 3 + p.phase) * 0.03;

      // Settle toward lying flat, with a little rocking
      const ease = Math.min(1, 4 * dt);
      m.rotation.x += (Math.sin(t * 2 + p.phase) * 0.15 - m.rotation.x) * ease;
      m.rotation.z += (Math.cos(t * 2.3 + p.phase) * 0.15 - m.rotation.z) * ease;
      m.rotation.y += p.spin.y * 0.1 * dt;

      p.timer -= dt;
      if (p.timer <= 0) p.state = 'sink';
    } else {
      // Sink and shrink, then remove
      p.sinkTime += dt;
      pos.y -= dt * 0.7;
      m.scale.setScalar(p.baseScale * Math.max(1 - p.sinkTime / SINK_TIME, 0.01));

      if (p.sinkTime >= SINK_TIME) {
        scene.remove(m);
        pieces.splice(i, 1);
      }
    }
  }
}
