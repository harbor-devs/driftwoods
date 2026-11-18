import * as THREE from 'three';
import {
  TILE_SIZE,
  STEER_ACCEL,
  STEER_MAX_SPEED,
  STEER_DRAG,
  SIZE_SLOWDOWN,
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

export function createRaft(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // Every tile is stored by its grid spot, like "0,1"
  const tiles = new Map();

  // The point the hook is thrown from and returns to
  const center = new THREE.Vector3(0, 0.4, 0);

  let velocityX = 0; // sideways speed

  // Grid spot -> position on the raft
  function gridToLocal(gx, gz) {
    return { x: (gx - 0.5) * TILE_SIZE, z: (gz - 0.5) * TILE_SIZE };
  }

  // Point on the water -> grid spot.
  // We subtract the raft's position first, because the raft can move.
  function worldToGrid(p) {
    const localX = p.x - group.position.x;
    const localZ = p.z - group.position.z;
    return {
      gx: Math.round(localX / TILE_SIZE + 0.5),
      gz: Math.round(localZ / TILE_SIZE + 0.5),
    };
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

  // steer is -1 (left), 0 (nothing), or 1 (right)
  function update(dt, t, steer) {
    // Bigger raft = lower top speed
    const extraTiles = Math.max(0, tiles.size - 4);
    const maxSpeed = STEER_MAX_SPEED / (1 + extraTiles * SIZE_SLOWDOWN);

    velocityX += steer * STEER_ACCEL * dt; // push
    velocityX -= velocityX * STEER_DRAG * dt; // water slows it down
    velocityX = clamp(velocityX, -maxSpeed, maxSpeed);

    group.position.x += velocityX * dt;

    // Stop at the edge of the world
    if (Math.abs(group.position.x) > WORLD_LIMIT) {
      group.position.x = clamp(group.position.x, -WORLD_LIMIT, WORLD_LIMIT);
      velocityX = 0;
    }

    // Ride the waves, and lean into turns a little
    group.position.y = waveHeight(group.position.x, 0, t) + 0.15;
    group.rotation.x = Math.sin(t * 0.9) * 0.04;
    group.rotation.z = Math.cos(t * 1.2) * 0.04 - velocityX * 0.015;

    center.x = group.position.x;
    center.y = group.position.y + 0.3;
  }

  // Starting raft: 2 x 2 tiles
  addTile(0, 0);
  addTile(1, 0);
  addTile(0, 1);
  addTile(1, 1);

  return { group, tiles, center, addTile, gridToLocal, worldToGrid, canBuildAt, update };
}