import * as THREE from 'three';
import {
  TILE_SIZE,
  STEER_ACCEL,
  STEER_MAX_SPEED,
  STEER_DRAG,
  SIZE_SLOWDOWN,
  LEAN_DEADZONE,
  WORLD_LIMIT,
} from './config.js';
import { waveHeight } from './ocean.js';

const woodLight = new THREE.MeshStandardMaterial({ color: 0xc8955c, flatShading: true });
const woodDark = new THREE.MeshStandardMaterial({ color: 0xa8743f, flatShading: true });
const plankGeo = new THREE.BoxGeometry(0.62, 0.25, 1.9);

// One raft tile = 3 planks side by side
function makeTile() {
  const tile = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const plank = new THREE.Mesh(plankGeo, i % 2 === 0 ? woodLight : woodDark);
    plank.position.x = (i - 1) * 0.64;
    plank.castShadow = true;
    plank.receiveShadow = true;
    tile.add(plank);
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

  let velocityX = 0; // sideways speed

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
    // How far he is from the balance point decides the lean (-1 to 1)
    const com = centerOfMass();
    const leanX = deadzone(clamp((charPos.x - com.x) / TILE_SIZE, -1, 1));
    const leanZ = clamp((charPos.z - com.z) / TILE_SIZE, -1, 1);

    // Bigger raft = lower top speed
    const extraTiles = Math.max(0, tiles.size - 4);
    const maxSpeed = STEER_MAX_SPEED / (1 + extraTiles * SIZE_SLOWDOWN);

    velocityX += leanX * STEER_ACCEL * dt; // leaning pushes it
    velocityX -= velocityX * STEER_DRAG * dt; // water slows it down
    velocityX = clamp(velocityX, -maxSpeed, maxSpeed);

    group.position.x += velocityX * dt;

    // Stop at the edge of the world
    if (Math.abs(group.position.x) > WORLD_LIMIT) {
      group.position.x = clamp(group.position.x, -WORLD_LIMIT, WORLD_LIMIT);
      velocityX = 0;
    }

    // Ride the waves, and dip toward the side he's standing on
    group.position.y = waveHeight(group.position.x, 0, t) + 0.15;
    group.rotation.x = Math.sin(t * 0.9) * 0.04 + leanZ * 0.05;
    group.rotation.z = Math.cos(t * 1.2) * 0.04 - leanX * 0.07;

    center.x = group.position.x;
    center.y = group.position.y + 0.3;
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
    canBuildAt,
    update,
  };
}