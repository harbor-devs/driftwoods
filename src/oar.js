import * as THREE from 'three';

// ---------- Oar settings ----------
const SWING_TIME = 0.45; // whole swing: wind up, slam, hold, recover
const COOLDOWN = 0.7; // seconds between swings
const HIT_RADIUS = 2; // shark must be this close to where the blade lands

// Angles the oar goes through (rotation around his shoulder)
const REST = -2.1; // resting up on his shoulder
const WINDUP = -2.7; // pulled back behind him
const SLAM = 0.35; // smashed down in front of him

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function distXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

// onHit gets 'scared' or 'killed'
export function createOar(scene, character, shark, onHit) {
  // The pivot is his shoulder. Rotating it swings the whole oar.
  const pivot = new THREE.Group();
  pivot.position.set(0.32, 0.9, 0);
  character.root.add(pivot);

  const wood = new THREE.MeshStandardMaterial({ color: 0x9a6a3c, flatShading: true });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x7a4f2a, flatShading: true });

  // Handle grip (the T at the top)
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.07), darkWood);
  grip.position.z = -0.05;
  pivot.add(grip);

  // Long shaft
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.7, 6), wood);
  shaft.rotation.x = Math.PI / 2; // lie along the pointing direction
  shaft.position.z = 0.85;
  shaft.castShadow = true;
  pivot.add(shaft);

  // Wide flat blade at the end
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.75), darkWood);
  blade.position.z = 2;
  blade.castShadow = true;
  pivot.add(blade);

  pivot.rotation.x = REST;

  // ---------- Splash particles ----------
  const dropGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  const dropMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true });
  const drops = [];

  function splash(at, count) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(dropGeo, dropMat);
      mesh.position.copy(at);
      scene.add(mesh);
      drops.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          3 + Math.random() * 3,
          (Math.random() - 0.5) * 4
        ),
        life: 0.6,
      });
    }
  }

  function updateDrops(dt) {
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.velocity.y -= 12 * dt; // gravity
      d.mesh.position.addScaledVector(d.velocity, dt);
      d.life -= dt;
      d.mesh.scale.setScalar(Math.max(d.life / 0.6, 0.01)); // shrink away
      if (d.life <= 0) {
        scene.remove(d.mesh);
        drops.splice(i, 1);
      }
    }
  }

  // ---------- Swing ----------
  let cooldown = 0;
  let swingTime = 0; // time left in the current swing
  let hasImpacted = false;
  const impact = new THREE.Vector3();

  // angle = which way to face for the slam, in world space
  function swingAt(angle) {
    if (cooldown > 0) return;
    cooldown = COOLDOWN;
    swingTime = SWING_TIME;
    hasImpacted = false;
    character.faceDirection(angle, SWING_TIME);
  }

  // The moment the blade hits the water
  function doImpact() {
    blade.getWorldPosition(impact);

    let hit = false;
    if (shark.isNear(impact, HIT_RADIUS) && distXZ(shark.position, impact) < HIT_RADIUS) {
      const result = shark.hit();
      if (result) {
        hit = true;
        onHit(result);
      }
    }

    impact.y = 0.2;
    splash(impact, hit ? 18 : 8); // bigger splash when you connect
  }

  function update(dt) {
    cooldown = Math.max(0, cooldown - dt);
    updateDrops(dt);

    if (swingTime <= 0) return;
    swingTime -= dt;
    const p = 1 - Math.max(swingTime, 0) / SWING_TIME; // 0 to 1 through the swing

    if (p < 0.25) {
      // Wind up: pull back over the shoulder
      const q = p / 0.25;
      pivot.rotation.x = lerp(REST, WINDUP, 1 - (1 - q) * (1 - q));
    } else if (p < 0.5) {
      // Slam: speeds up as it comes down (feels heavy)
      const q = (p - 0.25) / 0.25;
      pivot.rotation.x = lerp(WINDUP, SLAM, q * q);
    } else {
      if (!hasImpacted) {
        hasImpacted = true;
        pivot.rotation.x = SLAM;
        doImpact();
      }
      if (p >= 0.75) {
        // Recover: lift back up to the shoulder
        const q = (p - 0.75) / 0.25;
        pivot.rotation.x = lerp(SLAM, REST, q * q * (3 - 2 * q));
      }
    }

    if (swingTime <= 0) pivot.rotation.x = REST;
  }

  return { swingAt, update };
}