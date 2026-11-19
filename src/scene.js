import * as THREE from 'three';

// ---------- Renderer ----------
export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Tone mapping: bright parts fade softly like a real camera instead of clipping to flat white
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0; // overall brightness, try 0.9 to 1.2

// Soft shadows: blurred edges instead of hard jagged ones
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.body.appendChild(renderer.domElement);

// ---------- Scene ----------
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd8ef);
scene.fog = new THREE.Fog(0x9fd8ef, 30, 90);

// ---------- Camera ----------
const CAM_HEIGHT = 14;
const CAM_BACK = 16;

export const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(0, CAM_HEIGHT, CAM_BACK);
camera.lookAt(0, 0, 0);

// ---------- Lights ----------
// A bit brighter than before, because tone mapping darkens things slightly
scene.add(new THREE.HemisphereLight(0xffffff, 0x2a6f8f, 1.5));

const sun = new THREE.DirectionalLight(0xfff2d6, 2.6);
sun.position.set(10, 20, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -15;
sun.shadow.camera.right = 15;
sun.shadow.camera.top = 15;
sun.shadow.camera.bottom = -15;
// These two stop "shadow acne" (thin striped lines on the water and raft)
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(sun);
scene.add(sun.target); // needed so we can move where the sun points

// ---------- Camera shake ----------
// baseX / baseZ = where the camera would be without any shake
let baseX = 0;
let baseZ = 0;
let shakeAmount = 0;
const SHAKE_FADE = 6; // bigger number = shake dies out faster

// Call this to shake the screen. 0.2 = light bump, 0.6 = big hit.
export function shakeCamera(strength) {
  shakeAmount = Math.max(shakeAmount, strength); // a big shake isn't cancelled by a small one
}

// Camera follows the raft on x and z, a little behind, so you can SEE the raft move.
// The sun follows exactly, so shadows stay sharp around the raft.
export function followRaft(x, z, dt) {
  const smooth = 1 - Math.exp(-2.5 * dt); // smaller number = lazier camera
  baseX += (x - baseX) * smooth;
  baseZ += (z - baseZ) * smooth;

  // Random wobble that fades out over time
  shakeAmount *= Math.exp(-SHAKE_FADE * dt);
  if (shakeAmount < 0.001) shakeAmount = 0;
  const offX = (Math.random() * 2 - 1) * shakeAmount;
  const offY = (Math.random() * 2 - 1) * shakeAmount;

  camera.position.set(baseX + offX, CAM_HEIGHT + offY, baseZ + CAM_BACK);
  camera.lookAt(baseX, 0, baseZ); // look at the calm spot, so the wobble feels like a jolt

  sun.position.set(x + 10, 20, z + 8);
  sun.target.position.set(x, 0, z);
}

// ---------- Keep it fullscreen when the window resizes ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});