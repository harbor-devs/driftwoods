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

// ---------- Keep it fullscreen when the window resizes ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});