import * as THREE from 'three';
import { SPIKE_HITS } from './config.js';

// Built facing forward (negative z). raft.js turns it to face the open side.
const STAKES = 6;
const EDGE_Z = -0.92; // the edge of the tile
const STAKE_LEN = 0.75;

const stakeGeo = new THREE.ConeGeometry(0.08, STAKE_LEN, 5);
const stakeMat = new THREE.MeshStandardMaterial({ color: 0x8a5a30, flatShading: true, roughness: 0.9 });
const logGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 6);
const logMat = new THREE.MeshStandardMaterial({ color: 0x5e3d22, flatShading: true, roughness: 0.9 });

export function makeSpikes() {
  const group = new THREE.Group();

  // A log lying along the edge that the stakes are tied to
  const log = new THREE.Mesh(logGeo, logMat);
  log.rotation.z = Math.PI / 2; // lying sideways
  log.position.set(0, 0.12, EDGE_Z);
  log.castShadow = true;
  group.add(log);

  // Stakes pointing out over the water and a bit up
  const stakes = [];
  for (let i = 0; i < STAKES; i++) {
    const stake = new THREE.Mesh(stakeGeo, stakeMat);
    const tilt = -1.0 + (Math.random() - 0.5) * 0.25; // not all the same angle
    stake.rotation.x = tilt; // cones point up by default, this tips them outward
    stake.rotation.z = (Math.random() - 0.5) * 0.2;
    // Move it so its base sits on the log
    const half = STAKE_LEN / 2;
    stake.position.set(
      -0.75 + (i / (STAKES - 1)) * 1.5,
      0.12 + Math.cos(tilt) * half,
      EDGE_Z + Math.sin(tilt) * half
    );
    stake.castShadow = true;
    group.add(stake);
    stakes.push(stake);
  }

  group.userData.stakes = stakes;
  group.userData.hits = SPIKE_HITS; // hits left before it breaks
  return group;
}

// The shark hit the spikes. Some stakes snap off.
// Returns true if the spikes are now fully broken.
export function damageSpikes(spikes) {
  spikes.userData.hits -= 1;
  const left = Math.max(0, spikes.userData.hits);
  const showing = Math.ceil((STAKES * left) / SPIKE_HITS);
  spikes.userData.stakes.forEach((stake, i) => {
    stake.visible = i < showing;
  });
  return left <= 0;
}