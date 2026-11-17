import * as THREE from 'three';
import { TILE_SIZE } from './config.js';
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

export function createRaft(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // Every tile is stored by its grid spot, like "0,1"
  const tiles = new Map();

  // The point the hook is thrown from and returns to
  const center = new THREE.Vector3(0, 0.4, 0);

  // Grid spot -> position on the raft
  function gridToLocal(gx, gz) {
    return { x: (gx - 0.5) * TILE_SIZE, z: (gz - 0.5) * TILE_SIZE };
  }

  // Point on the water -> grid spot (the opposite of gridToLocal)
  function worldToGrid(p) {
    return {
      gx: Math.round(p.x / TILE_SIZE + 0.5),
      gz: Math.round(p.z / TILE_SIZE + 0.5),
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

  // Ride the waves and tilt a little
  function update(t) {
    group.position.y = waveHeight(0, 0, t) + 0.15;
    group.rotation.x = Math.sin(t * 0.9) * 0.04;
    group.rotation.z = Math.cos(t * 1.2) * 0.04;
    center.y = group.position.y + 0.3;
  }

  // Starting raft: 2 x 2 tiles
  addTile(0, 0);
  addTile(1, 0);
  addTile(0, 1);
  addTile(1, 1);

  return { group, tiles, center, addTile, gridToLocal, worldToGrid, canBuildAt, update };
}