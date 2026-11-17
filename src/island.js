import * as THREE from 'three';

const START_Z = -95; // far away, hidden in the fog
const END_Z = -16; // right in front of the raft

export function createIsland(scene) {
  const island = new THREE.Group();

  const sandMat = new THREE.MeshStandardMaterial({ color: 0xe8d29a, flatShading: true });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x6fbf5a, flatShading: true });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a5a33, flatShading: true });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f9a45, flatShading: true });

  // Sandy base
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(9, 11, 1.5, 9), sandMat);
  sand.receiveShadow = true;
  island.add(sand);

  // Green hill in the middle
  const hill = new THREE.Mesh(new THREE.ConeGeometry(5, 4, 7), grassMat);
  hill.position.set(-1, 2.5, -2);
  hill.castShadow = true;
  island.add(hill);

  // Simple palm tree: a trunk plus a flat cone on top
  function addPalm(x, z, height) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, height, 5), trunkMat);
    trunk.position.set(x, 0.75 + height / 2, z);
    trunk.castShadow = true;
    island.add(trunk);

    const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.8, 6), leafMat);
    leaves.position.set(x, 0.75 + height + 0.2, z);
    leaves.castShadow = true;
    island.add(leaves);
  }

  addPalm(4, 3, 3);
  addPalm(5.5, -1, 3.6);
  addPalm(-5, 4, 2.8);

  island.position.set(0, -0.3, START_Z);
  scene.add(island);

  // progress goes from 0 (start) to 1 (arrived)
  function update(progress) {
    island.position.z = START_Z + (END_Z - START_Z) * progress;
  }

  return { update };
}