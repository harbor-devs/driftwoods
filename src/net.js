import * as THREE from 'three';
import { NET_REACH } from './config.js';

// ---------- Net shape ----------
// Built facing forward (negative z). raft.js turns it to face the open side.
const EDGE_Z = -0.92; // the edge of the tile
const POST_X = 0.82; // how far apart the two posts are (from the middle)
const BAR_Y = 0.8; // height of the top rope bar
const COLS = 8; // net squares across
const ROWS = 4; // net squares down

// A point on the net. u goes 0 to 1 across, v goes 0 (top) to 1 (bottom, in the water).
// Measured from the top bar, so the net can swing around it.
function netPoint(u, v) {
  return new THREE.Vector3(
    (u - 0.5) * POST_X * 2,
    -v * 1.1,
    -v * 0.6 - Math.sin(u * Math.PI) * v * 0.3 // bellies outward in the middle
  );
}

// Make the net mesh once and share it between all nets (cheaper)
function buildNetGeometry() {
  const pts = [];
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c <= COLS; c++) pts.push(netPoint(c / COLS, r / ROWS));
  }
  const idx = (r, c) => r * (COLS + 1) + c;

  // Rope lines: across each row, and down each column
  const line = [];
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c < COLS; c++) line.push(pts[idx(r, c)], pts[idx(r, c + 1)]);
  }
  for (let c = 0; c <= COLS; c++) {
    for (let r = 0; r < ROWS; r++) line.push(pts[idx(r, c)], pts[idx(r + 1, c)]);
  }
  const lineGeo = new THREE.BufferGeometry().setFromPoints(line);

  // A see-through sheet behind the lines, so the net reads as one shape
  const clothGeo = new THREE.BufferGeometry().setFromPoints(pts);
  const tris = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const a = idx(r, c);
      const b = idx(r, c + 1);
      const d = idx(r + 1, c);
      const e = idx(r + 1, c + 1);
      tris.push(a, d, b, b, d, e);
    }
  }
  clothGeo.setIndex(tris);
  clothGeo.computeVertexNormals();

  return { lineGeo, clothGeo };
}

const { lineGeo, clothGeo } = buildNetGeometry();

const ropeMat = new THREE.LineBasicMaterial({ color: 0xf0dcae });
const clothMat = new THREE.MeshStandardMaterial({
  color: 0xd9b77a,
  transparent: true,
  opacity: 0.28,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const postGeo = new THREE.CylinderGeometry(0.06, 0.07, 1.0, 6);
const postMat = new THREE.MeshStandardMaterial({ color: 0x6e4a2a, flatShading: true, roughness: 0.9 });
const barGeo = new THREE.CylinderGeometry(0.035, 0.035, POST_X * 2 + 0.16, 5);
const barMat = new THREE.MeshStandardMaterial({ color: 0xd9b77a, flatShading: true, roughness: 1 });
const floatGeo = new THREE.SphereGeometry(0.09, 6, 4);
const floatMat = new THREE.MeshStandardMaterial({ color: 0xe8743b, flatShading: true });

export function makeNet() {
  const group = new THREE.Group();

  // Two posts at the edge of the tile
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(sx * POST_X, 0.35, EDGE_Z);
    post.castShadow = true;
    group.add(post);
  }

  // Rope bar across the top
  const bar = new THREE.Mesh(barGeo, barMat);
  bar.rotation.z = Math.PI / 2; // lying sideways
  bar.position.set(0, BAR_Y, EDGE_Z);
  group.add(bar);

  // The net hangs from the bar and swings around it
  const swing = new THREE.Group();
  swing.position.set(0, BAR_Y, EDGE_Z);
  group.add(swing);
  swing.add(new THREE.LineSegments(lineGeo, ropeMat));
  swing.add(new THREE.Mesh(clothGeo, clothMat));

  // Orange floats along the bottom, so you can spot nets in the water
  for (let i = 0; i <= 3; i++) {
    const f = new THREE.Mesh(floatGeo, floatMat);
    f.position.copy(netPoint(i / 3, 1));
    swing.add(f);
  }

  group.userData.swing = swing;
  group.userData.wiggle = 0; // jumps to 1 when it catches something, then fades
  group.userData.phase = Math.random() * Math.PI * 2;
  return group;
}

// Every frame: anything floating into a net gets caught.
// onCatch(kind) is the same function the hook uses, so the counters go up the same way.
export function createNets(raft, debris, onCatch) {
  const catchPoint = new THREE.Vector3();

  function update(dt, t) {
    for (const tile of raft.tiles.values()) {
      if (tile.userData.item !== 'net') continue;
      const net = tile.userData.itemMesh;
      const side = tile.userData.itemSide;

      // The middle of the net, out in the water past the tile edge
      catchPoint.set(
        raft.group.position.x + tile.position.x + side.dx * 1.4,
        0,
        raft.group.position.z + tile.position.z + side.dz * 1.4
      );

      // Loop backwards because we remove things while looping
      for (let i = debris.list.length - 1; i >= 0; i--) {
        const d = debris.list[i];
        if (d.hooked || d.kind === 'bottle') continue; // bottles are hook-only
        const dist = Math.hypot(d.mesh.position.x - catchPoint.x, d.mesh.position.z - catchPoint.z);
        if (dist < NET_REACH) {
          const kind = d.kind;
          debris.remove(d);
          net.userData.wiggle = 1;
          onCatch(kind);
        }
      }

      // Gentle sway with the waves, plus a shake right after a catch
      const w = net.userData.wiggle;
      net.userData.wiggle = Math.max(0, w - dt * 2.5);
      net.userData.swing.rotation.x =
        Math.sin(t * 1.6 + net.userData.phase) * 0.05 + w * Math.sin(t * 22) * 0.15;
    }
  }

  return { update };
}