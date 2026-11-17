import * as THREE from 'three';
import './style.css';
import { createShark } from './shark.js';
import { createIsland } from './island.js';

// ---------- Settings ----------
const DRIFT_SPEED = 2; // how fast the world flows past the raft
const HOOK_SPEED = 22; // how fast the hook flies out
const HOOK_RANGE = 14; // how far you can throw
const CATCH_RADIUS = 1.4; // how close the hook must get to grab something
const TILE_COST = 3; // planks needed for one new raft tile

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

// ---------- HUD (the counter in the top left) ----------
const hud = document.createElement('div');
hud.id = 'hud';
document.body.appendChild(hud);

let planks = 0;
let buildMode = false;

function updateHud() {
  const hint = buildMode
    ? `BUILD MODE: click next to your raft to add a tile (${TILE_COST} planks). Press B to stop building`
    : 'Click the water to throw your hook. Press B to build';
  hud.innerHTML = `
    <div class="count">Planks: ${planks}</div>
    <div class="hint">${hint}</div>
  `;
}
updateHud();

// ---------- Ocean ----------
// One function decides how high the water is at any point and time.
// The "z - t * DRIFT_SPEED" part makes the waves roll toward you,
// so it feels like the raft is moving forward.
function waveHeight(x, z, t) {
  return (
    Math.sin(x * 0.25 + t * 1.2) * 0.35 +
    Math.cos((z - t * DRIFT_SPEED) * 0.2) * 0.35
  );
}

const oceanGeo = new THREE.PlaneGeometry(200, 200, 80, 80);
oceanGeo.rotateX(-Math.PI / 2);
const oceanMat = new THREE.MeshStandardMaterial({
  color: 0x2a8fbd,
  flatShading: true,
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

// Every tile is stored by its grid spot, like "0,1".
// This is how we add tiles now and how the shark will remove them later.
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

// The point the hook is thrown from and returns to
const raftCenter = new THREE.Vector3(0, 0.4, 0);

// ---------- Floating debris (planks to collect) ----------
const debrisList = [];
const debrisGeo = new THREE.BoxGeometry(1.6, 0.2, 0.4);

function spawnDebris() {
  const mesh = new THREE.Mesh(debrisGeo, woodDark);
  mesh.position.set((Math.random() - 0.5) * 30, 0, -45);
  mesh.rotation.y = Math.random() * Math.PI;
  mesh.castShadow = true;
  scene.add(mesh);
  debrisList.push({ mesh, hooked: false });
}

let spawnTimer = 0;

function updateDebris(dt, t) {
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnDebris();
    spawnTimer = 1 + Math.random() * 1.5;
  }

  // Loop backwards so we can safely remove items while looping
  for (let i = debrisList.length - 1; i >= 0; i--) {
    const d = debrisList[i];
    if (d.hooked) continue; // the hook controls hooked debris

    d.mesh.position.z += DRIFT_SPEED * dt;
    d.mesh.position.y = waveHeight(d.mesh.position.x, d.mesh.position.z, t) + 0.05;

    // Floated past us, remove it
    if (d.mesh.position.z > 30) {
      scene.remove(d.mesh);
      debrisList.splice(i, 1);
    }
  }
}

// ---------- Hook ----------
const hookMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.25, 8, 6),
  new THREE.MeshStandardMaterial({ color: 0x555555, flatShading: true })
);
hookMesh.castShadow = true;
hookMesh.visible = false;
scene.add(hookMesh);

const ropeGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(),
  new THREE.Vector3(),
]);
const rope = new THREE.Line(ropeGeo, new THREE.LineBasicMaterial({ color: 0x3b2a1a }));
rope.frustumCulled = false; // always draw the rope
rope.visible = false;
scene.add(rope);

// state can be: 'idle' (in hand), 'out' (flying), 'back' (reeling in)
const hook = { state: 'idle', target: new THREE.Vector3(), caught: null };

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

function tryCatch() {
  const pos = hookMesh.position;
  for (const d of debrisList) {
    if (d.hooked) continue;
    const dx = d.mesh.position.x - pos.x;
    const dz = d.mesh.position.z - pos.z;
    if (Math.sqrt(dx * dx + dz * dz) < CATCH_RADIUS) {
      d.hooked = true;
      hook.caught = d;
      hook.state = 'back';
      return;
    }
  }
}

function updateHook(dt) {
  if (hook.state === 'idle') {
    hookMesh.visible = false;
    rope.visible = false;
    return;
  }

  hookMesh.visible = true;
  rope.visible = true;
  const pos = hookMesh.position;

  if (hook.state === 'out') {
    moveTowards(pos, hook.target, HOOK_SPEED * dt);
    tryCatch();
    if (hook.state === 'out' && pos.distanceTo(hook.target) < 0.1) {
      hook.state = 'back';
    }
  } else if (hook.state === 'back') {
    moveTowards(pos, raftCenter, HOOK_SPEED * 0.6 * dt);
    if (!hook.caught) tryCatch();

    if (pos.distanceTo(raftCenter) < 0.5) {
      if (hook.caught) {
        scene.remove(hook.caught.mesh);
        debrisList.splice(debrisList.indexOf(hook.caught), 1);
        hook.caught = null;
        planks++;
        updateHud();
      }
      hook.state = 'idle';
    }
  }

  // Caught plank sticks to the hook
  if (hook.caught) hook.caught.mesh.position.copy(pos);

  // Rope goes from raft to hook
  const p = ropeGeo.attributes.position;
  p.setXYZ(0, raftCenter.x, raftCenter.y, raftCenter.z);
  p.setXYZ(1, pos.x, pos.y, pos.z);
  p.needsUpdate = true;
}

// ---------- Mouse + building ----------
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const aimPoint = new THREE.Vector3();

// Turns the mouse position on screen into a point on the water
function getWaterPoint(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  return raycaster.ray.intersectPlane(waterPlane, aimPoint);
}

// Turns a point on the water into a raft grid spot (the opposite of addTile's math)
function worldToGrid(p) {
  return {
    gx: Math.round(p.x / TILE_SIZE + 0.5),
    gz: Math.round(p.z / TILE_SIZE + 0.5),
  };
}

function isNextToRaft(gx, gz) {
  return (
    tiles.has(`${gx + 1},${gz}`) ||
    tiles.has(`${gx - 1},${gz}`) ||
    tiles.has(`${gx},${gz + 1}`) ||
    tiles.has(`${gx},${gz - 1}`)
  );
}

function canBuildAt(gx, gz) {
  return !tiles.has(`${gx},${gz}`) && isNextToRaft(gx, gz);
}

// The see-through preview tile. It's added to the raft so it bobs with it.
const ghostMat = new THREE.MeshStandardMaterial({
  color: 0x6ee07a,
  transparent: true,
  opacity: 0.5,
});
const ghost = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.25, 1.9), ghostMat);
ghost.visible = false;
raft.add(ghost);
let ghostSpot = null;

function hideGhost() {
  ghost.visible = false;
  ghostSpot = null;
}

window.addEventListener('pointermove', (e) => {
  if (!buildMode) return;
  const p = getWaterPoint(e);
  if (!p) return;

  const { gx, gz } = worldToGrid(p);
  if (canBuildAt(gx, gz)) {
    ghostSpot = { gx, gz };
    ghost.position.set((gx - 0.5) * TILE_SIZE, 0, (gz - 0.5) * TILE_SIZE);
    ghost.visible = true;
    ghostMat.color.set(planks >= TILE_COST ? 0x6ee07a : 0xe06e6e); // green or red
  } else {
    hideGhost();
  }
});

window.addEventListener('pointerdown', (e) => {
  // Build mode: place a tile
  if (buildMode) {
    if (ghostSpot && planks >= TILE_COST) {
      addTile(ghostSpot.gx, ghostSpot.gz);
      planks -= TILE_COST;
      hideGhost();
      updateHud();
    }
    return;
  }

  // Normal mode: throw the hook
  if (hook.state !== 'idle') return;
  const p = getWaterPoint(e);
  if (!p) return;

  const dir = p.clone().sub(raftCenter);
  dir.y = 0;
  if (dir.length() > HOOK_RANGE) dir.setLength(HOOK_RANGE);

  hook.target.copy(raftCenter).add(dir);
  hook.target.y = 0.4;
  hookMesh.position.copy(raftCenter);
  hook.state = 'out';
});

// B key switches build mode on and off
window.addEventListener('keydown', (e) => {
  if (e.key === 'b' || e.key === 'B') {
    buildMode = !buildMode;
    hideGhost();
    updateHud();
  }
});

// ---------- Shark, island, win and lose ----------
const shark = createShark(scene, raft, tiles, waveHeight);
const island = createIsland(scene);

const JOURNEY_TIME = 180; // seconds to reach the island
let journeyTime = 0;
let gameEnded = false;

// Journey bar at the top of the screen
const journey = document.createElement('div');
journey.id = 'journey';
journey.innerHTML = `
  <div class="label">Island</div>
  <div class="bar"><div class="fill"></div></div>
`;
document.body.appendChild(journey);
const journeyFill = journey.querySelector('.fill');

function showEndScreen(title, text) {
  gameEnded = true;
  const box = document.createElement('div');
  box.id = 'game-over';
  box.innerHTML = `
    <h1>${title}</h1>
    <p>${text}</p>
    <button id="restart">Play again</button>
  `;
  document.body.appendChild(box);
  document.getElementById('restart').addEventListener('click', () => location.reload());
}

// ---------- Game loop ----------
let lastTime = performance.now();

function animate() {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05); // seconds since last frame
  lastTime = now;
  const t = now / 1000;

  updateOcean(t);

  // Raft rides the wave and tilts a little
  raft.position.y = waveHeight(0, 0, t) + 0.15;
  raft.rotation.x = Math.sin(t * 0.9) * 0.04;
  raft.rotation.z = Math.cos(t * 1.2) * 0.04;
  raftCenter.y = raft.position.y + 0.3;

  updateDebris(dt, t);
  updateHook(dt);

  if (!gameEnded) {
    shark.update(dt, t);

    journeyTime += dt;
    const progress = Math.min(journeyTime / JOURNEY_TIME, 1);
    journeyFill.style.width = `${progress * 100}%`;
    island.update(progress);

    // Stop new planks spawning when we're close to the island
    if (progress > 0.85) spawnTimer = Infinity;

    if (tiles.size === 0) {
      showEndScreen('Your raft is gone', 'The shark won this time.');
    } else if (progress >= 1) {
      showEndScreen(
        'You made it!',
        `You reached the island with ${tiles.size} tiles left. Island update coming soon.`
      );
    }
  }

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

// ---------- Keep it fullscreen when the window resizes ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});