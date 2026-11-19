import * as THREE from 'three';
import { DRIFT_SPEED, WORLD_LIMIT } from './config.js';
import { waveHeight } from './ocean.js';
import { randomWoodMaterial } from './raft.js';

// ---------- Bottle settings ----------
const BOTTLE_FIRST = 20; // seconds before the first bottle shows up
const BOTTLE_MIN = 25; // min seconds between bottles
const BOTTLE_MAX = 35; // max seconds between bottles
const BOTTLE_SIDE_MIN = 12; // how far to the side a bottle spawns (min)
const BOTTLE_SIDE_MAX = 18; // (max), so you have to steer to reach it

// ---------- Barrel settings ----------
const BARREL_CHANCE = 0.12; // each time something spawns, this is the chance it's a barrel

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// ---------- Shared shapes and materials (made once, reused, cheaper) ----------
const plankGeo = new THREE.BoxGeometry(1.6, 0.2, 0.4);

const glassMat = new THREE.MeshStandardMaterial({
  color: 0x7fd6b0,
  transparent: true,
  opacity: 0.55,
  roughness: 0.1,
  flatShading: true,
});
const corkMat = new THREE.MeshStandardMaterial({ color: 0xb07a45, flatShading: true });
const paperMat = new THREE.MeshStandardMaterial({
  color: 0xfff1c9,
  emissive: 0xffd27a, // glows a little so you can spot it
  emissiveIntensity: 0.6,
  flatShading: true,
});
const bodyGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.7, 8);
const neckGeo = new THREE.CylinderGeometry(0.08, 0.14, 0.25, 8);
const corkGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.1, 6);
const paperGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.45, 6);

// Pulsing white ring on the water around the bottle
const ringGeo = new THREE.RingGeometry(0.9, 1.1, 24);
const ringMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.6,
  depthWrite: false,
});

// Barrel: a side view of a barrel (fat in the middle), spun around to make it round.
// Each point is (distance from the middle, height).
const barrelProfile = [
  new THREE.Vector2(0, -0.45),
  new THREE.Vector2(0.32, -0.45),
  new THREE.Vector2(0.38, -0.22),
  new THREE.Vector2(0.4, 0),
  new THREE.Vector2(0.38, 0.22),
  new THREE.Vector2(0.32, 0.45),
  new THREE.Vector2(0, 0.45),
];
const barrelGeo = new THREE.LatheGeometry(barrelProfile, 10); // 10 sides = low-poly look
const barrelMat = new THREE.MeshStandardMaterial({
  color: 0x8f5c2f,
  flatShading: true,
  roughness: 0.85,
  side: THREE.DoubleSide,
});
// Dark iron bands around the barrel (two in the middle, two near the ends)
const bandGeo = new THREE.TorusGeometry(0.385, 0.035, 4, 10);
const endBandGeo = new THREE.TorusGeometry(0.335, 0.035, 4, 10);
const bandMat = new THREE.MeshStandardMaterial({
  color: 0x3d3b40,
  metalness: 0.4,
  roughness: 0.5,
  flatShading: true,
});

function makeBottle() {
  const group = new THREE.Group(); // follows the waves
  const bottle = new THREE.Group(); // lies on its side and rolls

  const paper = new THREE.Mesh(paperGeo, paperMat); // rolled up map piece inside
  bottle.add(paper);

  const body = new THREE.Mesh(bodyGeo, glassMat);
  body.castShadow = true;
  bottle.add(body);

  const neck = new THREE.Mesh(neckGeo, glassMat);
  neck.position.y = 0.475;
  bottle.add(neck);

  const cork = new THREE.Mesh(corkGeo, corkMat);
  cork.position.y = 0.64;
  bottle.add(cork);

  bottle.rotation.z = Math.PI / 2; // lying down
  group.add(bottle);

  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2; // flat on the water
  group.add(ring);

  return { group, bottle, ring };
}

function makeBarrel() {
  const group = new THREE.Group(); // follows the waves, turned a random way
  const lying = new THREE.Group(); // tips the barrel onto its side
  lying.rotation.z = Math.PI / 2;
  group.add(lying);
  const roll = new THREE.Group(); // spins around the barrel's long middle line
  lying.add(roll);

  const body = new THREE.Mesh(barrelGeo, barrelMat);
  body.castShadow = true;
  roll.add(body);

  for (const y of [-0.22, 0.22]) {
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.rotation.x = Math.PI / 2; // wrap around the barrel
    band.position.y = y;
    roll.add(band);
  }
  for (const y of [-0.4, 0.4]) {
    const band = new THREE.Mesh(endBandGeo, bandMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    roll.add(band);
  }

  group.rotation.y = Math.random() * Math.PI;
  return { group, roll };
}

// onEvent gets called with ('bottleSpawned', side) or ('bottleMissed')
// side is -1 for left, 1 for right
export function createDebris(scene, onEvent = () => {}) {
  const list = []; // every floating thing: { mesh, hooked, kind, ... }
  let spawnTimer = 0;
  let spawning = true;
  let bottleTimer = BOTTLE_FIRST;
  let bottlesOn = true;

  function spawnPlank(raftX) {
    const mesh = new THREE.Mesh(plankGeo, randomWoodMaterial()); // random wood shade
    mesh.scale.x = 0.85 + Math.random() * 0.3; // some longer, some shorter
    // Spawn around the raft, wherever it has steered to
    mesh.position.set(raftX + (Math.random() - 0.5) * 30, 0, -45);
    mesh.rotation.y = Math.random() * Math.PI;
    mesh.castShadow = true;
    scene.add(mesh);
    // phase = each plank rocks a bit differently, so they don't move in sync
    list.push({ mesh, hooked: false, kind: 'plank', phase: Math.random() * Math.PI * 2 });
  }

  function spawnBarrel(raftX) {
    const b = makeBarrel();
    b.group.position.set(raftX + (Math.random() - 0.5) * 30, 0, -45);
    scene.add(b.group);
    list.push({
      mesh: b.group,
      roll: b.roll,
      hooked: false,
      kind: 'barrel',
      phase: Math.random() * Math.PI * 2,
    });
  }

  function spawnBottle(raftX) {
    let side = Math.random() < 0.5 ? -1 : 1;
    const dist = randomBetween(BOTTLE_SIDE_MIN, BOTTLE_SIDE_MAX);
    let x = raftX + side * dist;

    // Too close to the edge of the world? Put it on the other side instead
    if (Math.abs(x) > WORLD_LIMIT - 2) {
      side = -side;
      x = raftX + side * dist;
    }

    const b = makeBottle();
    b.group.position.set(x, 0, -45);
    scene.add(b.group);
    list.push({ mesh: b.group, bottle: b.bottle, ring: b.ring, hooked: false, kind: 'bottle' });
    onEvent('bottleSpawned', side);
  }

  function remove(d) {
    scene.remove(d.mesh);
    const i = list.indexOf(d);
    if (i !== -1) list.splice(i, 1);
  }

  function stopSpawning() {
    spawning = false;
  }

  // No more bottles once the map is complete
  function stopBottles() {
    bottlesOn = false;
  }

  function hasBottle() {
    return list.some((d) => d.kind === 'bottle');
  }

  function update(dt, t, raftX) {
    if (spawning) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        if (Math.random() < BARREL_CHANCE) spawnBarrel(raftX);
        else spawnPlank(raftX);
        spawnTimer = 1 + Math.random() * 1.5;
      }
    }

    // Only one bottle at a time. The timer only counts while there's none out there.
    if (bottlesOn && !hasBottle()) {
      bottleTimer -= dt;
      if (bottleTimer <= 0) {
        spawnBottle(raftX);
        bottleTimer = randomBetween(BOTTLE_MIN, BOTTLE_MAX);
      }
    }

    // The ring breathes in and out (all bottles share it, so do it once)
    const pulse = 1 + 0.25 * Math.sin(t * 3);
    ringMat.opacity = 0.35 + 0.25 * Math.sin(t * 3);

    // Loop backwards so removing items while looping is safe
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];

      if (d.hooked) {
        if (d.ring) d.ring.visible = false; // no ring while it's on the hook
        continue; // the hook controls hooked things
      }

      d.mesh.position.z += DRIFT_SPEED * dt;

      if (d.kind === 'bottle') {
        d.mesh.position.y = waveHeight(d.mesh.position.x, d.mesh.position.z, t) + 0.1;
        d.bottle.rotation.x = Math.sin(t * 1.5) * 0.3; // rolls with the waves
        d.ring.scale.set(pulse, pulse, pulse);
      } else if (d.kind === 'barrel') {
        // Heavy, so it sits half under the water and rolls slowly back and forth
        d.mesh.position.y = waveHeight(d.mesh.position.x, d.mesh.position.z, t) + 0.1;
        d.roll.rotation.y = Math.sin(t * 1.2 + d.phase) * 0.5;
        d.mesh.rotation.x = Math.sin(t * 1.1 + d.phase) * 0.08;
      } else {
        d.mesh.position.y = waveHeight(d.mesh.position.x, d.mesh.position.z, t) + 0.05;
        // Rock and tilt with the waves
        d.mesh.rotation.x = Math.sin(t * 1.1 + d.phase) * 0.12;
        d.mesh.rotation.z = Math.cos(t * 1.4 + d.phase) * 0.15;
      }

      if (d.mesh.position.z > 30) {
        // floated past us
        if (d.kind === 'bottle') onEvent('bottleMissed');
        remove(d);
      }
    }
  }

  return { list, update, remove, stopSpawning, stopBottles };
}