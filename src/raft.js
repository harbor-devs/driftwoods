import * as THREE from 'three';
import {
  TILE_SIZE,
  STEER_ACCEL,
  STEER_MAX_SPEED,
  STEER_DRAG,
  SIZE_SLOWDOWN,
  LEAN_DEADZONE,
  WORLD_LIMIT,
  FORWARD_LIMIT,
  BACK_LIMIT,
} from './config.js';
import { waveHeight } from './ocean.js';

// ---------- Wood ----------
// Different wood shades, so the raft looks hand-built from random scraps
const WOOD_COLORS = [
  0xc8955c, // light
  0xb98349, // honey
  0xa8743f, // medium
  0xd3a46c, // pale
  0x9a6a3a, // dark
  0x9c8f7c, // old grey, sun-bleached
];
const woodMats = WOOD_COLORS.map(
  (color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 })
);

// debris.js uses this too, so floating planks match the raft
export function randomWoodMaterial() {
  return woodMats[Math.floor(Math.random() * woodMats.length)];
}

const plankGeo = new THREE.BoxGeometry(0.62, 0.25, 1.9);

// Dark crossbeams under the planks that hold a tile together
const beamGeo = new THREE.BoxGeometry(1.95, 0.12, 0.18);
const beamMat = new THREE.MeshStandardMaterial({
  color: 0x6e4a2a,
  flatShading: true,
  roughness: 0.9,
});

// One raft tile = 3 planks side by side, on 2 crossbeams
function makeTile() {
  const tile = new THREE.Group();

  for (let i = 0; i < 3; i++) {
    const plank = new THREE.Mesh(plankGeo, randomWoodMaterial());
    plank.scale.z = 0.95 + Math.random() * 0.08; // slightly different lengths
    plank.position.set(
      (i - 1) * 0.64,
      (Math.random() - 0.5) * 0.03, // tiny height differences
      (Math.random() - 0.5) * 0.06 // not perfectly lined up
    );
    plank.rotation.y = (Math.random() - 0.5) * 0.03; // very slightly crooked
    plank.castShadow = true;
    plank.receiveShadow = true;
    tile.add(plank);
  }

  for (const side of [-1, 1]) {
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, -0.185, side * 0.6);
    beam.castShadow = true;
    tile.add(beam);
  }

  return tile;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Small values near zero become zero, so standing in the middle = no drift
function deadzone(value) {
  if (Math.abs(value) < LEAN_DEADZONE) return 0;
  return value;
}

export function createRaft(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // Every tile is stored by its grid spot, like "0,1"
  const tiles = new Map();

  // The middle of the raft in the world (the spear still uses this)
  const center = new THREE.Vector3(0, 0.4, 0);

  // Raft speed on both axes. Forward (up the screen) is negative z.
  const velocity = { x: 0, z: 0 };

  // Grid spot -> position on the raft
  function gridToLocal(gx, gz) {
    return { x: (gx - 0.5) * TILE_SIZE, z: (gz - 0.5) * TILE_SIZE };
  }

  // Position on the raft -> grid spot
  function localToGrid(x, z) {
    return {
      gx: Math.round(x / TILE_SIZE + 0.5),
      gz: Math.round(z / TILE_SIZE + 0.5),
    };
  }

  // Point in the world -> grid spot (subtract where the raft is first)
  function worldToGrid(p) {
    return localToGrid(p.x - group.position.x, p.z - group.position.z);
  }

  // Is there a tile at this spot on the raft? (the character uses this to not walk off)
  function hasTileAt(x, z) {
    const { gx, gz } = localToGrid(x, z);
    return tiles.has(`${gx},${gz}`);
  }

  function closestTileCenter(x, z) {
    let best = null;
    let bestDist = Infinity;
    for (const tile of tiles.values()) {
      const d = Math.hypot(tile.position.x - x, tile.position.z - z);
      if (d < bestDist) {
        bestDist = d;
        best = { x: tile.position.x, z: tile.position.z };
      }
    }
    return best;
  }

  // Shortest distance from any tile to a point in the world (used for landing on the island)
  function distanceTo(point) {
    let best = Infinity;
    for (const tile of tiles.values()) {
      const d = Math.hypot(
        group.position.x + tile.position.x - point.x,
        group.position.z + tile.position.z - point.z
      );
      if (d < best) best = d;
    }
    return best;
  }

  // The balance point of the raft (average of all tile positions)
  function centerOfMass() {
    let sx = 0;
    let sz = 0;
    for (const tile of tiles.values()) {
      sx += tile.position.x;
      sz += tile.position.z;
    }
    const n = Math.max(tiles.size, 1);
    return { x: sx / n, z: sz / n };
  }

  function addTile(gx, gz) {
    const key = `${gx},${gz}`;
    if (tiles.has(key)) return;
    const tile = makeTile();
    const p = gridToLocal(gx, gz);
    tile.position.set(p.x, 0, p.z);
    group.add(tile);
    tiles.set(key, tile);
  }

  function isNextToRaft(gx, gz) {
    return (
      tiles.has(`${gx + 1},${gz}`) ||
      tiles.has(`${gx - 1},${gz}`) ||
      tiles.has(`${gx},${gz + 1}`) ||
      tiles.has(`${gx},${gz - 1}`)
    );
  }

  function canBuildAt(gx, gz) {
    return !tiles.has(`${gx},${gz}`) && isNextToRaft(gx, gz);
  }

  // charPos = where the character stands on the raft
  function update(dt, t, charPos) {
    // How far he is from the balance point decides the lean (-1 to 1) on both axes
    const com = centerOfMass();
    const leanX = deadzone(clamp((charPos.x - com.x) / TILE_SIZE, -1, 1));
    const leanZ = deadzone(clamp((charPos.z - com.z) / TILE_SIZE, -1, 1));

    // Bigger raft = heavier: slower to speed up AND lower top speed
    const extraTiles = Math.max(0, tiles.size - 4);
    const heaviness = 1 + extraTiles * SIZE_SLOWDOWN;
    const maxSpeed = STEER_MAX_SPEED / heaviness;
    const accel = STEER_ACCEL / heaviness;

    // Leaning pushes it, water slows it down
    velocity.x += leanX * accel * dt;
    velocity.z += leanZ * accel * dt;
    velocity.x -= velocity.x * STEER_DRAG * dt;
    velocity.z -= velocity.z * STEER_DRAG * dt;

    // Cap the total speed, so going diagonal isn't faster
    const speed = Math.hypot(velocity.x, velocity.z);
    if (speed > maxSpeed) {
      velocity.x *= maxSpeed / speed;
      velocity.z *= maxSpeed / speed;
    }

    group.position.x += velocity.x * dt;
    group.position.z += velocity.z * dt;

    // Edges of the world: left/right, forward (negative z), back (positive z)
    if (Math.abs(group.position.x) > WORLD_LIMIT) {
      group.position.x = clamp(group.position.x, -WORLD_LIMIT, WORLD_LIMIT);
      velocity.x = 0;
    }
    if (group.position.z < -FORWARD_LIMIT) {
      group.position.z = -FORWARD_LIMIT;
      velocity.z = 0;
    }
    if (group.position.z > BACK_LIMIT) {
      group.position.z = BACK_LIMIT;
      velocity.z = 0;
    }

    // Ride the waves, and dip toward the side he's standing on
    group.position.y = waveHeight(group.position.x, group.position.z, t) + 0.15;
    group.rotation.x = Math.sin(t * 0.9) * 0.04 + leanZ * 0.05;
    group.rotation.z = Math.cos(t * 1.2) * 0.04 - leanX * 0.07;

    center.x = group.position.x;
    center.y = group.position.y + 0.3;
    center.z = group.position.z;
  }

  // Starting raft: 2 x 2 tiles
  addTile(0, 0);
  addTile(1, 0);
  addTile(0, 1);
  addTile(1, 1);

  return {
    group,
    tiles,
    center,
    addTile,
    gridToLocal,
    worldToGrid,
    hasTileAt,
    closestTileCenter,
    distanceTo,
    canBuildAt,
    update,
  };
}