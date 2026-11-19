import * as THREE from 'three';

const MAST_H = 2.4;
const SAIL_W = 1.5;
const SAIL_H = 1.3;
const SAIL_BOTTOM = 0.9; // height of the lower pole (boom)

// Sail cloth: a flat sheet, pushed forward in the middle so it looks full of wind.
// We stretch this bulge more or less with scale.z.
function buildSailGeometry() {
  const geo = new THREE.PlaneGeometry(SAIL_W, SAIL_H, 6, 6);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / SAIL_W + 0.5; // 0 to 1 across
    const v = p.getY(i) / SAIL_H + 0.5; // 0 to 1 up
    p.setZ(i, -Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.4); // bulge forward
  }
  geo.computeVertexNormals();
  return geo;
}

const sailGeo = buildSailGeometry();
const clothMat = new THREE.MeshStandardMaterial({
  color: 0xf1e4c3,
  flatShading: true,
  roughness: 1,
  side: THREE.DoubleSide,
});
const mastGeo = new THREE.CylinderGeometry(0.07, 0.09, MAST_H, 6);
const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, SAIL_W + 0.1, 5);
const woodMat = new THREE.MeshStandardMaterial({ color: 0x6e4a2a, flatShading: true, roughness: 0.9 });

export function makeSail() {
  const group = new THREE.Group();

  const mast = new THREE.Mesh(mastGeo, woodMat);
  mast.position.y = MAST_H / 2;
  mast.castShadow = true;
  group.add(mast);

  // Everything in here spins around the mast to face the way you're going
  const turn = new THREE.Group();
  group.add(turn);

  for (const y of [SAIL_BOTTOM, SAIL_BOTTOM + SAIL_H]) {
    const pole = new THREE.Mesh(poleGeo, woodMat);
    pole.rotation.z = Math.PI / 2; // lying sideways
    pole.position.set(0, y, -0.1);
    turn.add(pole);
  }

  const cloth = new THREE.Mesh(sailGeo, clothMat);
  cloth.position.set(0, SAIL_BOTTOM + SAIL_H / 2, -0.1);
  cloth.castShadow = true;
  turn.add(cloth);

  group.userData.turn = turn;
  group.userData.cloth = cloth;
  group.userData.phase = Math.random() * Math.PI * 2;
  return group;
}

// Every frame: turn the sails and fill them with wind
export function createSails(raft) {
  function update(dt, t) {
    const v = raft.velocity;
    const speed = Math.hypot(v.x, v.z);

    for (const tile of raft.tiles.values()) {
      if (tile.userData.item !== 'sail') continue;
      const s = tile.userData.itemMesh.userData;

      // Slowly turn toward the way the raft is moving (only if it's actually moving)
      if (speed > 0.3) {
        const goal = Math.atan2(-v.x, -v.z);
        let diff = goal - s.turn.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
        s.turn.rotation.y += diff * Math.min(1, dt * 3);
      }

      // Faster = fuller sail, plus a little flutter
      const puff = Math.min(speed / 4, 1);
      s.cloth.scale.z = 0.25 + puff + Math.sin(t * 6 + s.phase) * 0.06;
    }
  }

  return { update };
}