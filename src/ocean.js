import * as THREE from 'three';
import { DRIFT_SPEED } from './config.js';

// How high the water is at any point and time.
// Everything that floats (raft, planks, shark) uses this same function.
export function waveHeight(x, z, t) {
  return (
    Math.sin(x * 0.25 + t * 1.2) * 0.35 +
    Math.cos((z - t * DRIFT_SPEED) * 0.2) * 0.35
  );
}

export function createOcean(scene) {
  const geo = new THREE.PlaneGeometry(200, 200, 80, 80);
  geo.rotateX(-Math.PI / 2); // lay it flat

  const mat = new THREE.MeshStandardMaterial({
    color: 0x2a8fbd,
    flatShading: true, // low-poly faceted look
    roughness: 0.6,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  const pos = geo.attributes.position;

  function update(t) {
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, waveHeight(pos.getX(i), pos.getZ(i), t));
    }
    pos.needsUpdate = true;
  }

  return { update };
}