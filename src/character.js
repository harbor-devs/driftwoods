import * as THREE from 'three';
import { WALK_SPEED, WALK_ACCEL, CHAR_RADIUS } from './config.js';

// Keeps an angle between -PI and PI so turning always goes the short way
function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export function createCharacter(raft) {
  // root = where he stands on the raft. It's a child of the raft so he rides the waves with it.
  const root = new THREE.Group();
  root.position.set(0, 0.125, 0); // standing on top of the planks
  raft.group.add(root);

  // wobble = all the squash, stretch and wiggle happens here
  const wobble = new THREE.Group();
  root.add(wobble);

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xff8a3d, flatShading: true });

  // Bean body
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.5, 4, 8), skinMat);
  body.position.y = 0.6;
  body.castShadow = true;
  wobble.add(body);

  // Eyes
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const black = new THREE.MeshStandardMaterial({ color: 0x1b1b1b });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), white);
    eye.position.set(side * 0.13, 0.82, 0.3);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), black);
    pupil.position.set(side * 0.13, 0.82, 0.38);
    wobble.add(eye, pupil);
  }

  // Little feet
  const feet = [];
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 4), skinMat);
    foot.scale.set(1, 0.6, 1.3);
    foot.position.set(side * 0.16, 0.08, 0.05);
    foot.castShadow = true;
    root.add(foot);
    feet.push(foot);
  }

  // ---------- Movement state ----------
  const velocity = new THREE.Vector2(); // x and z speed
  let facing = 0; // which way he's looking
  let walkCycle = 0; // drives the waddle

  // When he swings the oar, he snaps to face that way for a moment
  let forcedFacing = 0;
  let forceTimer = 0;

  const worldPos = new THREE.Vector3(); // where he is in the world
  const hand = new THREE.Vector3(); // where the hook comes from

  function faceDirection(angle, holdTime) {
    forcedFacing = angle;
    forceTimer = holdTime;
  }

  // input is { x, z }, each between -1 and 1
  function update(dt, t, input) {
    // Same speed going diagonally as straight
    let ix = input.x;
    let iz = input.z;
    const inputLen = Math.hypot(ix, iz);
    if (inputLen > 1) {
      ix /= inputLen;
      iz /= inputLen;
    }

    // Smoothly speed up toward where you're pressing, and slow down when you let go
    const k = 1 - Math.exp(-WALK_ACCEL * dt);
    velocity.x += (ix * WALK_SPEED - velocity.x) * k;
    velocity.y += (iz * WALK_SPEED - velocity.y) * k;

    // Move one axis at a time, so he slides along edges instead of getting stuck
    const p = root.position;

    const nextX = p.x + velocity.x * dt;
    if (raft.hasTileAt(nextX + Math.sign(velocity.x) * CHAR_RADIUS, p.z)) p.x = nextX;
    else velocity.x = 0;

    const nextZ = p.z + velocity.y * dt;
    if (raft.hasTileAt(p.x, nextZ + Math.sign(velocity.y) * CHAR_RADIUS)) p.z = nextZ;
    else velocity.y = 0;

    // If the shark ate the tile under him, hop to the closest safe tile
    if (!raft.hasTileAt(p.x, p.z)) {
      const safe = raft.closestTileCenter(p.x, p.z);
      if (safe) {
        p.x = safe.x;
        p.z = safe.z;
      }
    }

    // ---------- Facing ----------
    const speed = Math.hypot(velocity.x, velocity.y);
    if (forceTimer > 0) {
      // Swinging: turn fast toward the swing direction
      forceTimer -= dt;
      facing += wrapAngle(forcedFacing - facing) * (1 - Math.exp(-30 * dt));
    } else if (speed > 0.3) {
      // Walking: turn toward where he's going
      const targetFacing = Math.atan2(velocity.x, velocity.y);
      facing += wrapAngle(targetFacing - facing) * (1 - Math.exp(-12 * dt));
    }
    root.rotation.y = facing;

    // ---------- Waddle animation ----------
    const moving = Math.min(speed / WALK_SPEED, 1); // 0 standing, 1 full speed
    walkCycle += dt * 14 * moving;
    const step = Math.sin(walkCycle);

    wobble.rotation.z = step * 0.15 * moving; // side to side wiggle
    wobble.position.y = Math.abs(step) * 0.08 * moving; // little bounce

    // Squash and stretch: breathing when idle, squishing with each step when walking
    const squash = 1 + Math.sin(t * 3) * 0.03 * (1 - moving) - Math.abs(step) * 0.06 * moving;
    const widen = 1 / Math.sqrt(squash); // keep the same "volume" so it looks squishy
    wobble.scale.set(widen, squash, widen);

    // Feet step forward and back
    feet[0].position.z = 0.05 + step * 0.15 * moving;
    feet[1].position.z = 0.05 - step * 0.15 * moving;

    // Update world positions for the hook and the oar
    root.getWorldPosition(worldPos);
    hand.copy(worldPos);
    hand.y += 0.6;
  }

  return { update, faceDirection, root, position: root.position, worldPos, hand };
}