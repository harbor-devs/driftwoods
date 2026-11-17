import * as THREE from 'three';

const GREEN = 0x6ee07a;
const RED = 0xe06e6e;

export function createBuilder(raft) {
  // See-through preview tile, added to the raft so it bobs with it
  const ghostMat = new THREE.MeshStandardMaterial({
    color: GREEN,
    transparent: true,
    opacity: 0.5,
  });
  const ghost = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.25, 1.9), ghostMat);
  ghost.visible = false;
  raft.group.add(ghost);

  let spot = null;

  function hide() {
    ghost.visible = false;
    spot = null;
  }

  // Show the ghost at the grid spot under the mouse, if it's buildable
  function hover(point, canAfford) {
    const { gx, gz } = raft.worldToGrid(point);
    if (!raft.canBuildAt(gx, gz)) {
      hide();
      return;
    }
    spot = { gx, gz };
    const p = raft.gridToLocal(gx, gz);
    ghost.position.set(p.x, 0, p.z);
    ghost.visible = true;
    ghostMat.color.set(canAfford ? GREEN : RED);
  }

  // Returns true if a tile was placed
  function place() {
    if (!spot) return false;
    raft.addTile(spot.gx, spot.gz);
    hide();
    return true;
  }

  return { hover, place, hide };
}