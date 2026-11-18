import * as THREE from 'three';

// ---------- Shark settings ----------
const CIRCLE_RADIUS = 9; // how far from the raft it circles
const CIRCLE_SPEED = 0.35; // how fast it goes around
const SWIM_SPEED = 6; // speed when attacking
const BITE_TIME = 2; // seconds it chews before the tile is gone
const BITE_ESCAPE = 2.5; // if the tile gets this far away, the bite is cancelled
const FIRST_ATTACK = 15; // seconds before the first attack

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function distXZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function createShark(scene, raft, tiles, waveHeight) {
  // ---------- Body (made of simple low-poly cones) ----------
  const shark = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0x5b6b78, flatShading: true });

  const body = new THREE.Mesh(new THREE.ConeGeometry(0.6, 3, 6), skin);
  body.rotation.x = Math.PI / 2; // nose points forward
  shark.add(body);

  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 4), skin);
  fin.position.set(0, 0.7, -0.2); // sticks up out of the water
  fin.castShadow = true;
  shark.add(fin);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1, 4), skin);
  tail.rotation.x = -Math.PI / 2;
  tail.position.z = -1.8;
  shark.add(tail);

  scene.add(shark);

  // ---------- State ----------
  // state can be: 'circling', 'attacking', 'biting'
  let state = 'circling';
  let angle = Math.random() * Math.PI * 2;
  let attackTimer = FIRST_ATTACK;
  let biteTimer = 0;
  let target = null; // { key, tile }

  const pos = shark.position;
  const goal = new THREE.Vector3();
  const lookPoint = new THREE.Vector3();

  pos.set(
    raft.position.x + Math.cos(angle) * CIRCLE_RADIUS,
    0,
    Math.sin(angle) * CIRCLE_RADIUS
  );

  // Where a tile actually is in the world (the raft can move)
  function tileWorld(tile) {
    return { x: raft.position.x + tile.position.x, z: raft.position.z + tile.position.z };
  }

  // Turn toward a point and swim forward
  function swimTowards(point, speed, dt) {
    const d = distXZ(pos, point);
    if (d < 0.01) return;
    lookPoint.set(point.x, pos.y, point.z);
    shark.lookAt(lookPoint);
    shark.translateZ(Math.min(speed * dt, d));
  }

  // An edge tile = a tile with at least one empty side. Pick the closest one.
  function pickEdgeTile() {
    let best = null;
    let bestDist = Infinity;
    for (const [key, tile] of tiles) {
      const [gx, gz] = key.split(',').map(Number);
      const isEdge =
        !tiles.has(`${gx + 1},${gz}`) ||
        !tiles.has(`${gx - 1},${gz}`) ||
        !tiles.has(`${gx},${gz + 1}`) ||
        !tiles.has(`${gx},${gz - 1}`);
      if (!isEdge) continue;
      const d = distXZ(pos, tileWorld(tile));
      if (d < bestDist) {
        bestDist = d;
        best = { key, tile };
      }
    }
    return best;
  }

  function backToCircling() {
    target = null;
    state = 'circling';
    attackTimer = randomBetween(8, 12);
  }

  // ---------- Runs every frame ----------
  function update(dt, t) {
    if (state === 'circling') {
      angle += CIRCLE_SPEED * dt;
      goal.set(
        raft.position.x + Math.cos(angle) * CIRCLE_RADIUS,
        0,
        Math.sin(angle) * CIRCLE_RADIUS
      );
      swimTowards(goal, SWIM_SPEED * 0.6, dt);

      attackTimer -= dt;
      if (attackTimer <= 0 && tiles.size > 0) {
        target = pickEdgeTile();
        if (target) state = 'attacking';
      }
    } else if (state === 'attacking') {
      if (!tiles.has(target.key)) {
        backToCircling();
      } else {
        const w = tileWorld(target.tile);
        goal.set(w.x, 0, w.z);
        swimTowards(goal, SWIM_SPEED, dt);
        if (distXZ(pos, goal) < 1.5) {
          state = 'biting';
          biteTimer = BITE_TIME;
        }
      }
    } else if (state === 'biting') {
      if (!tiles.has(target.key)) {
        backToCircling();
      } else {
        const w = tileWorld(target.tile);
        goal.set(w.x, 0, w.z);

        if (distXZ(pos, goal) > BITE_ESCAPE) {
          // The raft got away, chase it again
          target.tile.rotation.y = 0;
          state = 'attacking';
        } else {
          biteTimer -= dt;
          target.tile.rotation.y = Math.sin(t * 40) * 0.08; // tile shakes

          if (biteTimer <= 0) {
            raft.remove(target.tile);
            tiles.delete(target.key);
            backToCircling();
          }
        }
      }
    }

    // Stay just under the surface so only the fin pokes out
    pos.y = waveHeight(pos.x, pos.z, t) - 0.35;
  }

  return { update };
}