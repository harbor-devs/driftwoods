import * as THREE from 'three';
import { TILE_COST, NET_PLANKS, NET_ROPE } from './config.js';
import { sideAngle } from './raft.js';
import { makeNet } from './net.js';

const GREEN = 0x6ee07a;
const RED = 0xe06e6e;

// Everything you can build. key = the number key that picks it.
// Steps 3 and 4 add spikes and sail here.
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
    hint: 'Click an edge tile to hang a net. It catches floating stuff for you',
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

  // Ghost for an item: a thin layer on the tile + a wall on the side it will face
  const ghostItem = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 1.9), ghostMat);
  slab.position.y = 0.16;
  ghostItem.add(slab);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 0.1), ghostMat);
  wall.position.set(0, 0.4, -0.92);
  ghostItem.add(wall);
  ghostItem.visible = false;
  raft.group.add(ghostItem);

  let spot = null; // { gx, gz, itemId } where a click would build

  function hide() {
    ghost.visible = false;
    ghostItem.visible = false;
    spot = null;
  }

  // Show the right ghost at the grid spot under the mouse, if you can build there
  function hover(point, itemId, canAfford) {
    hide();
    const { gx, gz } = raft.worldToGrid(point);
    ghostMat.color.set(canAfford ? GREEN : RED);
    const p = raft.gridToLocal(gx, gz);

    if (itemId === 'tile') {
      if (!raft.canBuildAt(gx, gz)) return;
      ghost.position.set(p.x, 0, p.z);
      ghost.visible = true;
    } else {
      if (!raft.canPlaceItemAt(gx, gz)) return;
      ghostItem.position.set(p.x, 0, p.z);
      ghostItem.rotation.y = sideAngle(raft.openSide(gx, gz));
      ghostItem.visible = true;
    }

    spot = { gx, gz, itemId };
  }

  function hasSpot() {
    return spot !== null;
  }

  // Returns true if something was built
  function place() {
    if (!spot) return false;
    let ok = false;
    if (spot.itemId === 'tile') {
      raft.addTile(spot.gx, spot.gz);
      ok = true;
    } else if (spot.itemId === 'net') {
      ok = raft.addItem(spot.gx, spot.gz, 'net', makeNet());
    }
    hide();
    return ok;
  }

  return { hover, place, hide, hasSpot };
}