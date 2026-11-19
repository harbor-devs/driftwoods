import * as THREE from 'three';
import { waveHeight } from './ocean.js';
import { playSound } from './sound.js';

// ---------- Splash sizes ----------
// drops = how many water drops fly up
// power = how high and far they fly
// ring = how wide the ring on the water spreads
const SIZES = {
  small: { drops: 5, power: 0.6, ring: 0.8 },
  medium: { drops: 10, power: 1, ring: 1.4 },
  big: { drops: 22, power: 1.4, ring: 2.4 },
};

const DROP_LIFE = 0.8; // seconds a drop lives (max)
const RING_LIFE = 0.7; // seconds a ring takes to spread and fade
const RING_OPACITY = 0.8; // how see-through the ring starts
const GRAVITY = 14;

let scene = null;
let time = 0; // game time from the last update, so splashes know the wave height
const drops = [];
const rings = [];

// Shared shapes and materials (made once, reused by every splash)
const dropGeo = new THREE.IcosahedronGeometry(0.07, 0); // tiny low-poly ball
const dropMat = new THREE.MeshStandardMaterial({
  color: 0xe8f8ff,
  roughness: 0.2,
  flatShading: true,
});

const ringGeo = new THREE.RingGeometry(0.7, 1, 20);
ringGeo.rotateX(-Math.PI / 2); // lay it flat on the water
const ringMat = new THREE.MeshBasicMaterial({
  color: 0xf2fbff,
  transparent: true,
  opacity: RING_OPACITY,
  depthWrite: false, // so it doesn't cut holes in the water behind it
  side: THREE.DoubleSide,
});

// Call once at the start so splashes know where to go
export function initSplashes(s) {
  scene = s;
}

// Make a splash at a point on the water. size = 'small', 'medium' or 'big'
export function splash(point, size = 'medium') {
  if (!scene) return;
  const s = SIZES[size] || SIZES.medium;
  playSound(`splash-${SIZES[size] ? size : 'medium'}`);
  const y = waveHeight(point.x, point.z, time);

  // Drops fly up and out in a circle
  for (let i = 0; i < s.drops; i++) {
    const mesh = new THREE.Mesh(dropGeo, dropMat);
    mesh.position.set(point.x, y + 0.05, point.z);
    const baseScale = 0.7 + Math.random() * 0.8 * s.power;
    mesh.scale.setScalar(baseScale);
    scene.add(mesh);

    const a = Math.random() * Math.PI * 2; // which way this drop flies
    const out = (0.8 + Math.random() * 1.8) * s.power; // how fast it flies outward
    drops.push({
      mesh,
      baseScale,
      velocity: new THREE.Vector3(
        Math.cos(a) * out,
        (3 + Math.random() * 3) * s.power,
        Math.sin(a) * out
      ),
      life: DROP_LIFE,
    });
  }

  // Ring spreads out on the water. Each ring gets its own material so it can fade alone.
  const mat = ringMat.clone();
  const ring = new THREE.Mesh(ringGeo, mat);
  ring.position.set(point.x, y + 0.1, point.z);
  ring.scale.setScalar(0.2);
  ring.renderOrder = 1; // draw after the water so it shows on top
  scene.add(ring);
  rings.push({ mesh: ring, mat, size: s.ring, life: RING_LIFE });
}

// Runs every frame from main.js
export function updateSplashes(dt, t) {
  time = t;

  // Drops: fly, fall, and vanish when they hit the water again
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.velocity.y -= GRAVITY * dt;
    d.mesh.position.addScaledVector(d.velocity, dt);
    d.life -= dt;

    const p = d.mesh.position;
    const water = waveHeight(p.x, p.z, t);
    const fellBackIn = d.velocity.y < 0 && p.y < water;

    if (d.life <= 0 || fellBackIn) {
      scene.remove(d.mesh);
      drops.splice(i, 1);
      continue;
    }
    d.mesh.scale.setScalar(d.baseScale * Math.max(d.life / DROP_LIFE, 0.3));
  }

  // Rings: grow wider and fade out, riding the waves
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.life -= dt;

    if (r.life <= 0) {
      scene.remove(r.mesh);
      r.mat.dispose(); // free the cloned material
      rings.splice(i, 1);
      continue;
    }

    const k = 1 - r.life / RING_LIFE; // 0 to 1 through its life
    const ease = 1 - (1 - k) * (1 - k); // fast at first, then slows down
    r.mesh.scale.setScalar(0.2 + ease * r.size);
    r.mat.opacity = RING_OPACITY * (1 - k);

    const p = r.mesh.position;
    p.y = waveHeight(p.x, p.z, t) + 0.1;
  }
}