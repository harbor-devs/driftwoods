import { camera, renderer, followRaft } from './scene.js';

const SENSITIVITY = 0.0025; // mouse look speed
const EYE_HEIGHT = 1.05; // how high his eyes are above his feet
const PITCH_MIN = -1.3; // furthest you can look down
const PITCH_MAX = 0.7; // furthest you can look up

export function createCameraController(character, raft) {
  let mode = 'top'; // 'top' or 'first'
  let yaw = 0; // looking left/right
  let pitch = -0.25; // looking up/down

  const canvas = renderer.domElement;

  // "Pointer lock" hides the mouse and gives us raw movement, like every first person game
  function isLocked() {
    return document.pointerLockElement === canvas;
  }

  function requestLock() {
    canvas.requestPointerLock();
  }

  document.addEventListener('mousemove', (e) => {
    if (mode !== 'first' || !isLocked()) return;
    yaw -= e.movementX * SENSITIVITY;
    pitch -= e.movementY * SENSITIVITY;
    pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch));
  });

  function toggle() {
    mode = mode === 'top' ? 'first' : 'top';
    character.setBodyVisible(mode === 'top');

    if (mode === 'first') {
      yaw = 0;
      pitch = -0.25;
      requestLock();
    } else {
      if (isLocked()) document.exitPointerLock();
      camera.position.set(raft.group.position.x, 14, 16); // back to the top view spot
    }
    return mode;
  }

  // Turns WASD into a world direction.
  // In top view, W is "up the screen". In first person, W is "where you're looking".
  function moveInput(input) {
    if (mode === 'top') return input;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return {
      x: c * input.x + s * input.z,
      z: -s * input.x + c * input.z,
    };
  }

  // Which way he faces in first person (the camera looks down -z, he faces +z, so add half a turn)
  function facingAngle() {
    return yaw + Math.PI;
  }

  function update(dt) {
    followRaft(raft.group.position.x, dt); // keeps the sun and shadows following the raft

    if (mode === 'top') return;

    // First person: camera sits in his head and turns with the mouse
    character.faceDirection(facingAngle(), 0.1);
    camera.position.copy(character.worldPos);
    camera.position.y += EYE_HEIGHT;
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }

  return {
    toggle,
    update,
    moveInput,
    facingAngle,
    isLocked,
    requestLock,
    get mode() {
      return mode;
    },
  };
}