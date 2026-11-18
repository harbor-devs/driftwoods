import * as THREE from 'three';

const OAR_RANGE = 3; // how far the oar reaches from him
const OAR_ARC = 1.3; // how wide the swing is on each side (about 75 degrees)
const SWING_TIME = 0.28; // how long one swing takes
const COOLDOWN = 0.6; // seconds between swings
const IDLE_TILT = -1.25; // holds the oar upright when not swinging

// onHit gets 'scared' or 'killed'
export function createOar(character, shark, onHit) {
  // The pivot is at his hand. Rotating it swings the whole oar.
  const pivot = new THREE.Group();
  pivot.position.set(0.32, 0.7, 0);
  character.root.add(pivot);

  const wood = new THREE.MeshStandardMaterial({ color: 0x9a6a3c, flatShading: true });

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 5), wood);
  shaft.rotation.x = Math.PI / 2; // lie along the pointing direction
  shaft.position.z = 0.8;
  shaft.castShadow = true;

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.55), wood);
  blade.position.z = 1.8;
  blade.castShadow = true;

  pivot.add(shaft, blade);
  pivot.rotation.set(IDLE_TILT, 0, 0);

  let cooldown = 0;
  let swing = 0; // time left in the current swing
  let hasChecked = false; // only check for a hit once per swing
  let aimAngle = 0;

  // angle = direction to swing, in world space
  function swingAt(angle) {
    if (cooldown > 0) return;
    cooldown = COOLDOWN;
    swing = SWING_TIME;
    hasChecked = false;
    aimAngle = angle;
    character.faceDirection(angle, SWING_TIME + 0.1);
  }

  function checkHit() {
    const me = character.worldPos;
    if (!shark.isNear(me, OAR_RANGE)) return;

    // Is the shark inside the arc we swung at?
    const dx = shark.position.x - me.x;
    const dz = shark.position.z - me.z;
    let diff = Math.atan2(dx, dz) - aimAngle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // keep it between -PI and PI
    if (Math.abs(diff) > OAR_ARC) return;

    const result = shark.hit();
    if (result) onHit(result);
  }

  function update(dt) {
    cooldown = Math.max(0, cooldown - dt);

    if (swing > 0) {
      swing -= dt;
      const p = 1 - Math.max(swing, 0) / SWING_TIME; // 0 to 1 through the swing
      const eased = 1 - (1 - p) * (1 - p); // fast start, slows at the end (feels punchy)

      pivot.rotation.x = 0; // oar goes flat
      pivot.rotation.y = OAR_ARC - eased * OAR_ARC * 2; // sweep from one side to the other

      // Check the hit partway through, when the oar is out in front
      if (!hasChecked && p > 0.35) {
        hasChecked = true;
        checkHit();
      }

      if (swing <= 0) pivot.rotation.set(IDLE_TILT, 0, 0); // back to holding it
    }
  }

  return { swingAt, update };
}