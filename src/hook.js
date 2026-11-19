import * as THREE from 'three';
import { HOOK_SPEED, HOOK_RANGE, CATCH_RADIUS } from './config.js';
import { splash } from './splash.js';

const HOOK_SCALE = 1.5; // make the hook bigger so you can see it from the top camera
const HOOK_HEIGHT = 1.2; // how high above the water it flies
const CARRY_DROP = 0.8; // caught things hang this far below the hook's eye

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

// ---------- A real fishhook shape ----------
// The group's center is the eye (where the rope ties on). The hook hangs down from it.
function makeHookMesh() {
  const metal = new THREE.MeshStandardMaterial({
    color: 0xc9d1d8,
    metalness: 0.5,
    roughness: 0.35,
    flatShading: true,
  });
  const hook = new THREE.Group();

  // Eye: small ring at the top
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 10), metal);
  hook.add(eye);

  // Shank: the straight rod going down
  const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.45, 6), metal);
  shank.position.y = -0.295;
  hook.add(shank);

  // Bend: part of a ring, curving down, around, and back up like a J
  const BEND_R = 0.18;
  const BEND_ARC = Math.PI + 0.6;
  const bend = new THREE.Mesh(
    new THREE.TorusGeometry(BEND_R, 0.035, 6, 14, BEND_ARC),
    metal
  );
  bend.position.set(BEND_R, -0.52, 0);
  bend.rotation.z = Math.PI; // start the curve where the shank ends
  hook.add(bend);

  // Point: a small cone at the end of the curve
  const point = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 5), metal);
  point.position.set(0.29, -0.36, 0);
  point.rotation.z = 0.6; // follows the direction of the curve
  hook.add(point);

  hook.traverse((m) => {
    if (m.isMesh) m.castShadow = true;
  });
  hook.scale.setScalar(HOOK_SCALE);
  return hook;
}

// origin = where the hook is thrown from and comes back to (the character's hands)
// onCatch(kind) runs every time something reaches him. kind is 'plank' or 'bottle'
export function createHook(scene, origin, debris, onCatch) {
  const mesh = makeHookMesh();
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
    target.y = HOOK_HEIGHT;
    mesh.position.copy(origin);

    // Turn the hook so its point faces back toward the player (so it "snags" on the way back)
    mesh.rotation.set(0, Math.atan2(dir.x, dir.z) + Math.PI / 2, 0);
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
        splash(d.mesh.position, 'small'); // yanked out of the water
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
      if (state === 'out' && pos.distanceTo(target) < 0.1) {
        splash(pos, 'medium'); // the hook lands in the water
        state = 'back';
      }
    } else if (state === 'back') {
      moveTowards(pos, origin, HOOK_SPEED * 0.6 * dt);
      if (!caught) tryCatch();

      if (pos.distanceTo(origin) < 0.5) {
        if (caught) {
          const kind = caught.kind;
          debris.remove(caught);
          caught = null;
          onCatch(kind);
        }
        state = 'idle';
      }
    }

    // Caught thing hangs under the hook
    if (caught) {
      caught.mesh.position.copy(pos);
      caught.mesh.position.y -= CARRY_DROP;
    }

    // Rope goes from his hands to the hook's eye
    const p = ropeGeo.attributes.position;
    p.setXYZ(0, origin.x, origin.y, origin.z);
    p.setXYZ(1, pos.x, pos.y, pos.z);
    p.needsUpdate = true;
  }

  return { throwAt, update };
}