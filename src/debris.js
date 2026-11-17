import * as THREE from 'three';
import { DRIFT_SPEED } from './config.js';
import { waveHeight } from './ocean.js';

const debrisGeo = new THREE.BoxGeometry(1.6, 0.2, 0.4);
const debrisMat = new THREE.MeshStandardMaterial({ color: 0xa8743f, flatShading: true });

export function createDebris(scene) {
  const list = []; // every floating piece: { mesh, hooked }
  let spawnTimer = 0;
  let spawning = true;

  function spawn() {
    const mesh = new THREE.Mesh(debrisGeo, debrisMat);
    mesh.position.set((Math.random() - 0.5) * 30, 0, -45);
    mesh.rotation.y = Math.random() * Math.PI;
    mesh.castShadow = true;
    scene.add(mesh);
    list.push({ mesh, hooked: false });
  }

  function remove(d) {
    scene.remove(d.mesh);
    const i = list.indexOf(d);
    if (i !== -1) list.splice(i, 1);
  }

  function stopSpawning() {
    spawning = false;
  }

  function update(dt, t) {
    if (spawning) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawn();
        spawnTimer = 1 + Math.random() * 1.5;
      }
    }

    // Loop backwards so removing items while looping is safe
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      if (d.hooked) continue; // the hook controls hooked pieces

      d.mesh.position.z += DRIFT_SPEED * dt;
      d.mesh.position.y = waveHeight(d.mesh.position.x, d.mesh.position.z, t) + 0.05;

      if (d.mesh.position.z > 30) remove(d); // floated past us
    }
  }

  return { list, update, remove, stopSpawning };
}