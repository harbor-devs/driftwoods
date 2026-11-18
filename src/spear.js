import * as THREE from 'three';

const SPEAR_RANGE = 5; // shark must be this close to the raft center
const COOLDOWN = 0.8; // seconds between stabs
const JAB_TIME = 0.25; // how long the stab animation takes

// onResult gets 'scared', 'killed', or 'miss'
export function createSpear(scene, raft, shark, onResult) {
  // The pivot sits on the raft and turns to face where we stab
  const pivot = new THREE.Group();
  pivot.visible = false;
  scene.add(pivot);

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5),
    new THREE.MeshStandardMaterial({ color: 0x8a5a33, flatShading: true })
  );
  shaft.rotation.x = Math.PI / 2; // lie along the pointing direction
  shaft.position.z = 1.3;

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.5, 4),
    new THREE.MeshStandardMaterial({ color: 0x9aa4ab, flatShading: true })
  );
  tip.rotation.x = Math.PI / 2;
  tip.position.z = 2.85;

  const spear = new THREE.Group();
  spear.add(shaft, tip);
  pivot.add(spear);

  let cooldown = 0;
  let jab = 0;
  const aim = new THREE.Vector3();

  function stab() {
    if (cooldown > 0) return;
    cooldown = COOLDOWN;
    jab = JAB_TIME;

    if (shark.isNear(raft.center, SPEAR_RANGE)) {
      aim.set(shark.position.x, raft.center.y, shark.position.z);
      const result = shark.hit();
      if (result) onResult(result);
    } else {
      // Nothing close, just jab forward
      aim.set(raft.center.x, raft.center.y, raft.center.z - 5);
      onResult('miss');
    }

    pivot.position.copy(raft.center);
    pivot.lookAt(aim);
    pivot.visible = true;
  }

  function update(dt) {
    cooldown = Math.max(0, cooldown - dt);

    if (jab > 0) {
      jab -= dt;
      const progress = 1 - Math.max(jab, 0) / JAB_TIME; // 0 to 1
      spear.position.z = Math.sin(progress * Math.PI) * 2; // shoots out and back
      pivot.position.copy(raft.center);
      if (jab <= 0) pivot.visible = false;
    }
  }

  return { stab, update };
}