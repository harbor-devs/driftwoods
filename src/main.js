import * as THREE from 'three';
import './style.css';

// ---------- Renderer, scene, camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd8ef);
scene.fog = new THREE.Fog(0x9fd8ef, 30, 90);

const camera = new THREE.PerspectiveCamera(
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

// ---------- Ocean ----------
// One function decides how high the water is at any point and time.
// The ocean AND the raft both use it, so the raft floats on the real waves.
function waveHeight(x, z, t) {
  return (
    Math.sin(x * 0.25 + t * 1.2) * 0.35 +
    Math.cos(z * 0.2 + t * 0.9) * 0.35
  );
}

const oceanGeo = new THREE.PlaneGeometry(200, 200, 80, 80);
oceanGeo.rotateX(-Math.PI / 2); // lay the plane flat
const oceanMat = new THREE.MeshStandardMaterial({
  color: 0x2a8fbd,
  flatShading: true, // this gives the low-poly faceted look
  roughness: 0.6,
});
const ocean = new THREE.Mesh(oceanGeo, oceanMat);
ocean.receiveShadow = true;
scene.add(ocean);

const oceanPos = oceanGeo.attributes.position;

function updateOcean(t) {
  for (let i = 0; i < oceanPos.count; i++) {
    const x = oceanPos.getX(i);
    const z = oceanPos.getZ(i);
    oceanPos.setY(i, waveHeight(x, z, t));
  }
  oceanPos.needsUpdate = true;
}

// ---------- Raft ----------
const TILE_SIZE = 2;
const woodLight = new THREE.MeshStandardMaterial({ color: 0xc8955c, flatShading: true });
const woodDark = new THREE.MeshStandardMaterial({ color: 0xa8743f, flatShading: true });
const plankGeo = new THREE.BoxGeometry(0.62, 0.25, 1.9);

// One raft tile = 3 planks side by side
function makeTile() {
  const tile = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const plank = new THREE.Mesh(plankGeo, i % 2 === 0 ? woodLight : woodDark);
    plank.position.x = (i - 1) * 0.64;
    plank.castShadow = true;
    plank.receiveShadow = true;
    tile.add(plank);
  }
  return tile;
}

const raft = new THREE.Group();
scene.add(raft);

// We keep every tile in a Map using its grid spot as the key, like "0,1".
// Later this is how we add new tiles and how the shark removes them.
const tiles = new Map();

function addTile(gx, gz) {
  const key = `${gx},${gz}`;
  if (tiles.has(key)) return;
  const tile = makeTile();
  tile.position.set((gx - 0.5) * TILE_SIZE, 0, (gz - 0.5) * TILE_SIZE);
  raft.add(tile);
  tiles.set(key, tile);
}

// Starting raft: 2 x 2 tiles
addTile(0, 0);
addTile(1, 0);
addTile(0, 1);
addTile(1, 1);

// ---------- Game loop ----------
function animate() {
  const t = performance.now() / 1000;

  updateOcean(t);

  // Raft rides the wave and tilts a little
  raft.position.y = waveHeight(0, 0, t) + 0.15;
  raft.rotation.x = Math.sin(t * 0.9) * 0.04;
  raft.rotation.z = Math.cos(t * 1.2) * 0.04;

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

// ---------- Keep it fullscreen when the window resizes ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});