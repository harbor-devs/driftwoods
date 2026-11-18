import * as THREE from 'three';

const FLOAT_HEIGHT = 2; // how high above the water the arrow floats
const OFFSET = 1.8; // how far from the character, toward the target
const HIDE_DIST = 5; // hide when the target is this close (you can see it already)

const BOTTLE_COLOR = 0xffd27a; // gold
const ISLAND_COLOR = 0x7ee08a; // green

export function createGuide(scene) {
  // ---------- Arrow shape (drawn flat, pointing "up" in 2D) ----------
  const shape = new THREE.Shape();
  shape.moveTo(-0.15, -0.6);
  shape.lineTo(0.15, -0.6);
  shape.lineTo(0.15, 0.1);
  shape.lineTo(0.4, 0.1);
  shape.lineTo(0, 0.7); // tip
  shape.lineTo(-0.4, 0.1);
  shape.lineTo(-0.15, 0.1);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
  const mat = new THREE.MeshStandardMaterial({
    color: BOTTLE_COLOR,
    emissive: BOTTLE_COLOR,
    emissiveIntensity: 0.4, // glows a bit so it pops on the water
    flatShading: true,
  });

  const arrow = new THREE.Mesh(geo, mat);
  arrow.rotation.x = -Math.PI / 2; // lay it flat, tip pointing forward
  arrow.castShadow = true;

  // The group turns to face the target, the arrow inside just lies flat
  const group = new THREE.Group();
  group.add(arrow);
  group.visible = false;
  scene.add(group);

  let currentKind = 'bottle';

  // from = where the player is, target = what to point at (or null), kind = 'bottle' or 'island'
  function update(t, from, target, kind) {
    if (!target) {
      group.visible = false;
      return;
    }

    const dx = target.x - from.x;
    const dz = target.z - from.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < HIDE_DIST) {
      group.visible = false;
      return;
    }

    // Change color only when the target type changes
    if (kind !== currentKind) {
      currentKind = kind;
      const color = kind === 'island' ? ISLAND_COLOR : BOTTLE_COLOR;
      mat.color.setHex(color);
      mat.emissive.setHex(color);
    }

    group.visible = true;
    group.position.set(
      from.x + (dx / dist) * OFFSET,
      FLOAT_HEIGHT + Math.sin(t * 3) * 0.15, // gentle bob
      from.z + (dz / dist) * OFFSET
    );
    group.rotation.y = Math.atan2(-dx, -dz); // point at the target
  }

  function hide() {
    group.visible = false;
  }

  return { update, hide };
}