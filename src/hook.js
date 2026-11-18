import * as THREE from 'three';
import { HOOK_SPEED, HOOK_RANGE, CATCH_RADIUS } from './config.js';

// Moves "current" toward "target" by at most "maxStep"
function moveTowards(current, target, maxStep) {
  const diff = target.clone().sub(current);
  const dist = diff.length();
  if (dist <= maxStep) {
    current.copy(target);
    return;
  }
  current.add(diff.multiplyScalar(maxStep / dist));
}

// origin = where the hook is thrown from and comes back to (the character's hands)
// onCatch runs every time a piece of debris reaches him
export function createHook(scene, origin, debris, onCatch) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x555555, flatShading: true })
  );
  mesh.castShadow = true;
  mesh.visible = false;
  scene.add(mesh);

  const ropeGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]);
  const rope = new THREE.Line(ropeGeo, new THREE.LineBasicMaterial({ color: 0x3b2a1a }));
  rope.frustumCulled = false; // always draw the rope
  rope.visible = false;
  scene.add(rope);

  // state can be: 'idle' (in hand), 'out' (flying), 'back' (reeling in)
  let state = 'idle';
  let caught = null;
  const target = new THREE.Vector3();

  function throwAt(point) {
    if (state !== 'idle') return;

    const dir = point.clone().sub(origin);
    dir.y = 0;
    if (dir.length() > HOOK_RANGE) dir.setLength(HOOK_RANGE);

    target.copy(origin).add(dir);
    target.y = 0.4;
    mesh.position.copy(origin);
    state = 'out';
  }

  function tryCatch() {
    for (const d of debris.list) {
      if (d.hooked) continue;
      const dx = d.mesh.position.x - mesh.position.x;
      const dz = d.mesh.position.z - mesh.position.z;
      if (Math.sqrt(dx * dx + dz * dz) < CATCH_RADIUS) {
        d.hooked = true;
        caught = d;
        state = 'back';
        return;
      }
    }
  }

  function update(dt) {
    if (state === 'idle') {
      mesh.visible = false;
      rope.visible = false;
      return;
    }

    mesh.visible = true;
    rope.visible = true;
    const pos = mesh.position;

    if (state === 'out') {
      moveTowards(pos, target, HOOK_SPEED * dt);
      tryCatch();
      if (state === 'out' && pos.distanceTo(target) < 0.1) state = 'back';
    } else if (state === 'back') {
      moveTowards(pos, origin, HOOK_SPEED * 0.6 * dt);
      if (!caught) tryCatch();

      if (pos.distanceTo(origin) < 0.5) {
        if (caught) {
          debris.remove(caught);
          caught = null;
          onCatch();
        }
        state = 'idle';
      }
    }

    // Caught piece sticks to the hook
    if (caught) caught.mesh.position.copy(pos);

    // Rope goes from his hands to the hook
    const p = ropeGeo.attributes.position;
    p.setXYZ(0, origin.x, origin.y, origin.z);
    p.setXYZ(1, pos.x, pos.y, pos.z);
    p.needsUpdate = true;
  }

  return { throwAt, update };
}