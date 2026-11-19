import * as THREE from 'three';
import {
  TILE_COST,
  NET_PLANKS,
  NET_ROPE,
  SPIKE_PLANKS,
  SPIKE_ROPE,
  SAIL_PLANKS,
  SAIL_ROPE,
  MAX_SAILS,
} from './config.js';
import { sideAngle } from './raft.js';
import { makeNet } from './net.js';
import { makeSpikes } from './spikes.js';
import { makeSail } from './sail.js';

const GREEN = 0x6ee07a;
const RED = 0xe06e6e;

// Everything you can build. key = the number key that picks it.
// edge = must go on an edge tile. make = the function that builds its 3D model.
export const BUILD_ITEMS = [
  {
    id: 'tile',
    key: '1',
    name: 'Tile',
    planks: TILE_COST,
    rope: 0,
    hint: 'Click next to your raft to add a tile',
  },
  {
    id: 'net',
    key: '2',
    name: 'Catch net',
    planks: NET_PLANKS,
    rope: NET_ROPE,
    edge: true,
    make: makeNet,
    hint: 'Click an edge tile to hang a net. It catches floating stuff for you',
  },
  {
    id: 'spikes',
    key: '3',
    name: 'Spikes',
    planks: SPIKE_PLANKS,
    rope: SPIKE_ROPE,
    edge: true,
    make: makeSpikes,
    hint: 'Click an edge tile to add spikes. The shark gets hurt if it bites there',
  },
  {
    id: 'sail',
    key: '4',
    name: 'Sail',
    planks: SAIL_PLANKS,
    rope: SAIL_ROPE,
    edge: false,
    make: makeSail,
    hint: `Click any free tile to raise a sail. Each one makes you faster (max ${MAX_SAILS})`,
  },
];

export function createBuilder(raft) {
  // See-through preview, added to the raft so it bobs with it
  const ghostMat = new THREE.MeshStandardMaterial({
    color: GREEN,
    transparent: true,
    opacity: 0.5,
  });

  // Ghost for a new tile
  const ghost = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.25, 1.9), ghostMat);
  ghost.visible = false;
  raft.group.add(ghost);

  // Ghost for an item: a thin layer on the tile, plus a wall (edge items) or a mast (sail)
  const ghostItem = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 1.9), ghostMat);
  slab.position.y = 0.16;
  ghostItem.add(slab);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 0.1), ghostMat);
  wall.position.set(0, 0.4, -0.92);
  ghostItem.add(wall);
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.4, 0.15), ghostMat);
  mast.position.y = 1.2;
  ghostItem.add(mast);
  ghostItem.visible = false;
  raft.group.add(ghostItem);

  let spot = null; // { gx, gz, item } where a click would build

  function hide() {
    ghost.visible = false;
    ghostItem.visible = false;
    spot = null;
  }

  // Show the right ghost at the grid spot under the mouse, if you can build there
  function hover(point, item, canAfford) {
    hide();
    const { gx, gz } = raft.worldToGrid(point);
    ghostMat.color.set(canAfford ? GREEN : RED);
    const p = raft.gridToLocal(gx, gz);

    if (item.id === 'tile') {
      if (!raft.canBuildAt(gx, gz)) return;
      ghost.position.set(p.x, 0, p.z);
      ghost.visible = true;
    } else {
      if (!raft.canPlaceItemAt(gx, gz, item.edge)) return;
      ghostItem.position.set(p.x, 0, p.z);
      wall.visible = item.edge;
      mast.visible = !item.edge;
      ghostItem.rotation.y = item.edge ? sideAngle(raft.openSide(gx, gz)) : 0;
      ghostItem.visible = true;
    }

    spot = { gx, gz, item };
  }

  function hasSpot() {
    return spot !== null;
  }

  // Returns true if something was built
  function place() {
    if (!spot) return false;
    const { gx, gz, item } = spot;
    let ok = false;
    if (item.id === 'tile') {
      raft.addTile(gx, gz);
      ok = true;
    } else {
      ok = raft.addItem(gx, gz, item.id, item.make(), item.edge);
    }
    hide();
    return ok;
  }

  return { hover, place, hide, hasSpot };
}