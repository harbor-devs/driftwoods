import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { splash } from './splash.js';

// ---------- Shark settings ----------
const CIRCLE_RADIUS = 9; // how far from the raft it circles
const CIRCLE_SPEED = 0.35; // how fast it goes around
const SWIM_SPEED = 7.5; // faster than the raft, so you can't outrun it forever
const BITE_TIME = 2; // seconds it chews before the tile is gone
const BITE_ESCAPE = 2.5; // if the tile gets this far away, the bite is cancelled
const BITE_SPLASH_EVERY = 0.3; // seconds between little splashes while it chews
const FIRST_ATTACK = 15; // seconds before the first attack
const MAX_HEALTH = 3; // oar hits to kill it
const FLEE_TIME = 3; // seconds it swims away after getting hit
const AWAY_MIN = 15; // min seconds it stays away after being scared
const AWAY_MAX = 25; // max seconds it stays away
const RESPAWN_TIME = 40; // seconds until a new shark comes after one dies
const ANGER_PER_LEVEL = 0.15; // each new shark is 15% faster

// ---------- Model settings ----------
const MODEL_PATH = '/models/shark.fbx';
const SHARK_LENGTH = 3.2; // how long the shark is, nose to tail
const SWIM_DEPTH = 0.4; // how far under the surface it swims (only the fin pokes out)
const MODEL_TURN = 0; // if the shark swims BACKWARDS, change this to Math.PI

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function distXZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

// onEvent gets called with 'attack', 'bite' or 'tileLost' so main.js can react
export function createShark(scene, raft, tiles, waveHeight, onEvent = () => {}) {
  // The group is what moves around. The model goes inside it once it loads.
  const shark = new THREE.Group();
  scene.add(shark);

  // ---------- Load the real model ----------
  const materials = []; // kept so we can flash them red when hit
  let mixer = null; // plays the model's animation
  let swimAction = null;

  new FBXLoader().load(
    MODEL_PATH,
    (model) => {
      // Make it the right size: measure it, then scale so its longest side = SHARK_LENGTH
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const longest = Math.max(size.x, size.y, size.z);
      model.scale.setScalar(SHARK_LENGTH / longest);

      // If the model was built pointing along x, turn it so the nose points forward (z)
      if (size.x > size.z) model.rotation.y = Math.PI / 2;
      model.rotation.y += MODEL_TURN;

      // Center it inside the group
      const box2 = new THREE.Box3().setFromObject(model);
      const center = box2.getCenter(new THREE.Vector3());
      model.position.sub(center);

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.frustumCulled = false; // animated meshes sometimes vanish without this
          // Own copy of each material so the red flash works
          child.material = Array.isArray(child.material)
            ? child.material.map((m) => m.clone())
            : child.material.clone();
          (Array.isArray(child.material) ? child.material : [child.material]).forEach((m) => {
            if (m.emissive) materials.push(m);
          });
        }
      });

      shark.add(model);

      // The model has one animation: Swim. We just change how fast it plays.
      if (model.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        swimAction = mixer.clipAction(model.animations[0]);
        swimAction.play();
      }
    },
    undefined,
    (err) => console.error('Could not load the shark model:', err)
  );

  // ---------- State ----------
  // state can be: 'circling', 'attacking', 'biting', 'fleeing', 'away', 'dead'
  let state = 'circling';
  let angle = 0;
  let attackTimer = FIRST_ATTACK;
  let biteTimer = 0;
  let biteSplashTimer = 0; // counts down to the next chewing splash
  let timer = 0; // used by fleeing, away and dead
  let target = null; // { key, tile }
  let health = MAX_HEALTH;
  let level = 0; // goes up every time a new shark spawns
  let flashTimer = 0;

  const pos = shark.position;
  const goal = new THREE.Vector3();
  const lookPoint = new THREE.Vector3();

  function speed() {
    return SWIM_SPEED * (1 + level * ANGER_PER_LEVEL);
  }

  function setFlash(hex) {
    materials.forEach((m) => m.emissive.setHex(hex));
  }

  // Put the shark somewhere out around the raft
  function placeOnCircle(radius) {
    angle = Math.random() * Math.PI * 2;
    pos.set(
      raft.position.x + Math.cos(angle) * radius,
      0,
      raft.position.z + Math.sin(angle) * radius
    );
  }

  placeOnCircle(CIRCLE_RADIUS);

  // Where a tile actually is in the world (the raft can move)
  function tileWorld(tile) {
    return { x: raft.position.x + tile.position.x, z: raft.position.z + tile.position.z };
  }

  // Turn toward a point and swim forward
  function swimTowards(point, swimSpeed, dt) {
    const d = distXZ(pos, point);
    if (d < 0.01) return;
    lookPoint.set(point.x, pos.y, point.z);
    shark.lookAt(lookPoint);
    shark.translateZ(Math.min(swimSpeed * dt, d));
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

  function releaseTarget() {
    if (target) target.tile.rotation.y = 0; // stop the shaking
    target = null;
  }

  function backToCircling() {
    releaseTarget();
    state = 'circling';
    attackTimer = randomBetween(8, 12);
  }

  // ---------- Called by the oar ----------
  // Returns 'scared', 'killed', or null (if it can't be hit right now)
  function hit() {
    if (state === 'fleeing' || state === 'away' || state === 'dead') return null;

    releaseTarget();
    health -= 1;

    // Flash red
    setFlash(0xff3333);
    flashTimer = 0.25;

    if (health <= 0) {
      state = 'dead';
      timer = RESPAWN_TIME;
      return 'killed';
    }

    state = 'fleeing';
    timer = FLEE_TIME;
    return 'scared';
  }

  // Is the shark close to a point (and actually in the water to hit)?
  function isNear(point, range) {
    if (state === 'fleeing' || state === 'away' || state === 'dead') return false;
    return distXZ(pos, point) < range;
  }

  // Is the shark coming for the raft right now? (used for the warning banner)
  function isThreat() {
    return state === 'attacking' || state === 'biting';
  }

  // ---------- Runs every frame ----------
  function update(dt, t) {
    // Swim animation speed: calm while circling, fast while chasing, thrashing while biting
    if (swimAction) {
      if (state === 'biting') swimAction.timeScale = 2.5;
      else if (state === 'attacking' || state === 'fleeing') swimAction.timeScale = 1.8;
      else if (state === 'dead') swimAction.timeScale = 0.2;
      else swimAction.timeScale = 1;
    }
    if (mixer) mixer.update(dt);

    // Red flash fades back to normal
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) setFlash(0x000000);
    }

    if (state === 'circling') {
      angle += CIRCLE_SPEED * dt;
      goal.set(
        raft.position.x + Math.cos(angle) * CIRCLE_RADIUS,
        0,
        raft.position.z + Math.sin(angle) * CIRCLE_RADIUS
      );
      swimTowards(goal, speed() * 0.8, dt);

      attackTimer -= dt;
      if (attackTimer <= 0 && tiles.size > 0) {
        target = pickEdgeTile();
        if (target) {
          state = 'attacking';
          onEvent('attack');
        }
      }
    } else if (state === 'attacking') {
      if (!tiles.has(target.key)) {
        backToCircling();
      } else {
        const w = tileWorld(target.tile);
        goal.set(w.x, 0, w.z);
        swimTowards(goal, speed(), dt);
        if (distXZ(pos, goal) < 1.5) {
          if (target.tile.userData.item === 'spikes') {
            // Spikes! It gets stabbed and swims off instead of biting
            const tile = target.tile;
            splash(pos, 'big');
            const result = hit(); // 'scared' or 'killed'
            onEvent('spiked', { tile, result });
          } else {
            state = 'biting';
            biteTimer = BITE_TIME;
            biteSplashTimer = BITE_SPLASH_EVERY;
            splash(pos, 'medium'); // it lunges at the raft
            onEvent('bite');
          }
        }
      }
    } else if (state === 'biting') {
      if (!tiles.has(target.key)) {
        backToCircling();
      } else {
        const w = tileWorld(target.tile);
        goal.set(w.x, 0, w.z);

        if (distXZ(pos, goal) > BITE_ESCAPE) {
          // The raft pulled away, chase it again
          target.tile.rotation.y = 0;
          state = 'attacking';
        } else {
          biteTimer -= dt;
          target.tile.rotation.y = Math.sin(t * 40) * 0.08; // tile shakes

          // Little splashes while it thrashes and chews
          biteSplashTimer -= dt;
          if (biteSplashTimer <= 0) {
            biteSplashTimer = BITE_SPLASH_EVERY;
            splash(pos, 'small');
          }

          if (biteTimer <= 0) {
            splash(w, 'big'); // the tile gets ripped off
            raft.remove(target.tile);
            tiles.delete(target.key);
            target = null;
            onEvent('tileLost', { x: w.x, z: w.z });
            backToCircling();
          }
        }
      }
    } else if (state === 'fleeing') {
      // Swim straight away from the raft
      const dx = pos.x - raft.position.x;
      const dz = pos.z - raft.position.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      goal.set(pos.x + (dx / len) * 10, 0, pos.z + (dz / len) * 10);
      swimTowards(goal, speed() * 1.3, dt);

      timer -= dt;
      if (timer <= 0) {
        state = 'away';
        shark.visible = false;
        timer = randomBetween(AWAY_MIN, AWAY_MAX);
      }
    } else if (state === 'away') {
      timer -= dt;
      if (timer <= 0) {
        // It's back, and it attacks quickly this time
        placeOnCircle(CIRCLE_RADIUS * 1.6);
        shark.visible = true;
        state = 'circling';
        attackTimer = 4;
      }
    } else if (state === 'dead') {
      timer -= dt;

      // Flip belly up and sink
      shark.rotation.z = Math.min(shark.rotation.z + dt * 2, Math.PI);
      pos.y -= dt * 0.8;
      if (timer < RESPAWN_TIME - 3) shark.visible = false;

      if (timer <= 0) {
        // A new, angrier shark arrives
        level += 1;
        health = MAX_HEALTH;
        shark.rotation.set(0, 0, 0);
        placeOnCircle(CIRCLE_RADIUS * 1.6);
        shark.visible = true;
        state = 'circling';
        attackTimer = 8;
      }
      return; // skip the wave height below so it keeps sinking
    }

    // Stay under the surface so only the fin pokes out
    pos.y = waveHeight(pos.x, pos.z, t) - SWIM_DEPTH;
  }

  return { update, hit, isNear, isThreat, position: pos };
}