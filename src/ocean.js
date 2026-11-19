import * as THREE from 'three';
import { DRIFT_SPEED } from './config.js';

// ---------- Wave settings ----------
// Several waves from different directions stacked together = natural-looking sea.
// dx, dz = direction, freq = how close the waves are, speed = how fast they roll,
// amp = how tall, sharp = bigger number = pointier peaks and flatter troughs
const WAVES = [
  { dx: 0, dz: 1, freq: 0.2, speed: 0, amp: 0.32, sharp: 1.6 }, // main swell, flows past the raft
  { dx: 1, dz: 0, freq: 0.25, speed: 1.2, amp: 0.15, sharp: 1.4 }, // side roll
  { dx: 0.8, dz: 0.6, freq: 0.3, speed: 1.1, amp: 0.2, sharp: 1.5 }, // diagonal
  { dx: -0.6, dz: 0.8, freq: 0.45, speed: 1.6, amp: 0.12, sharp: 1.3 }, // small choppy one
];

// Tallest the water can ever get (used for coloring)
export const WAVE_MAX = WAVES.reduce((sum, w) => sum + w.amp, 0);

// How high the water is at any point and time.
// Everything that floats (raft, planks, shark) uses this same function.
export function waveHeight(x, z, t) {
  const zz = z - t * DRIFT_SPEED; // makes the whole sea drift past the raft
  let h = 0;
  for (const w of WAVES) {
    const phase = (x * w.dx + zz * w.dz) * w.freq + t * w.speed;
    const s = (Math.sin(phase) + 1) * 0.5; // 0 to 1
    h += w.amp * (Math.pow(s, w.sharp) * 2 - 1); // pow = sharp peaks, wide troughs
  }
  return h;
}

// ---------- Water colors ----------
const DEEP = new THREE.Color(0x0b4f6c); // bottom of the waves
const MID = new THREE.Color(0x1a86a8); // middle
const CREST = new THREE.Color(0x46c1d4); // top of the waves
const FOAM = new THREE.Color(0xf2fbff); // white foam on the highest peaks

export function createOcean(scene) {
  // Dark sea floor far below, so the see-through water looks deep, not pale
  const floorGeo = new THREE.PlaneGeometry(200, 200);
  floorGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(
    floorGeo,
    new THREE.MeshBasicMaterial({ color: 0x06283a })
  );
  floor.position.y = -6;
  scene.add(floor);

  // The water surface
  const geo = new THREE.PlaneGeometry(200, 200, 120, 120);
  geo.rotateX(-Math.PI / 2); // lay it flat

  const pos = geo.attributes.position;

  // One color per point on the water, changed every frame by wave height
  const colors = new Float32Array(pos.count * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, // use the colors we paint per point
    roughness: 0.25, // low = shiny, gives the sun sparkle
    metalness: 0,
    transparent: true,
    opacity: 0.88, // slightly see-through
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  const tmp = new THREE.Color();

  function update(t) {
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = waveHeight(x, z, t);
      pos.setY(i, h);

      // k = 0 at the bottom of a wave, 1 at the very top
      const k = (h / WAVE_MAX + 1) * 0.5;

      // Deep -> mid -> crest color
      if (k < 0.5) tmp.copy(DEEP).lerp(MID, k * 2);
      else tmp.copy(MID).lerp(CREST, (k - 0.5) * 2);

      // Foam only near the top, broken up so it doesn't look like a clean ring
      const breakup =
        Math.sin(x * 1.3 + t * 0.8) * Math.sin(z * 1.7 - t * 0.6) * 0.5 + 0.5;
      const foam =
        THREE.MathUtils.smoothstep(k, 0.78, 0.95) * (0.4 + 0.6 * breakup);
      tmp.lerp(FOAM, foam);

      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    pos.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.computeVertexNormals(); // recalculates the lighting angles so the sparkle moves with the waves
  }

  return { update };
}