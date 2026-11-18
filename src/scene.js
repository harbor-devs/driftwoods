import * as THREE from 'three';

// ---------- Renderer ----------
export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// ---------- Scene ----------
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd8ef);
scene.fog = new THREE.Fog(0x9fd8ef, 30, 90);

// ---------- Camera ----------
export const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(0, 14, 16);
camera.lookAt(0, 0, 0);

// ---------- Lights ----------
scene.add(new THREE.HemisphereLight(0xffffff, 0x2a6f8f, 1.2));

const sun = new THREE.DirectionalLight(0xfff2d6, 2);
sun.position.set(10, 20, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -15;
sun.shadow.camera.right = 15;
sun.shadow.camera.top = 15;
sun.shadow.camera.bottom = -15;
scene.add(sun);
scene.add(sun.target); // needed so we can move where the sun points

// Camera follows the raft sideways, but a little behind, so you can SEE the raft move.
// The sun follows exactly, so shadows stay sharp around the raft.
export function followRaft(x, dt) {
  const smooth = 1 - Math.exp(-2.5 * dt); // smaller number = lazier camera
  camera.position.x += (x - camera.position.x) * smooth;
  camera.lookAt(camera.position.x, 0, 0);

  sun.position.x = x + 10;
  sun.target.position.x = x;
}

// ---------- Keep it fullscreen when the window resizes ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});