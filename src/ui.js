import { TILE_COST } from './config.js';

// ---------- HUD (top left) ----------
export function createHud() {
  const el = document.createElement('div');
  el.id = 'hud';
  document.body.appendChild(el);

  function update(planks, buildMode) {
    const hint = buildMode
      ? `BUILD MODE: click next to your raft to add a tile (${TILE_COST} planks). B to stop building`
      : 'WASD walk (lean to steer). Left click: hook. Right click or Space: oar. B: build';
    el.innerHTML = `
      <div class="count">Planks: ${planks}</div>
      <div class="hint">${hint}</div>
    `;
  }

  return { update };
}

// ---------- Map pieces bar (top middle) ----------
export function createMapBar(total) {
  const el = document.createElement('div');
  el.id = 'journey';
  el.innerHTML = `
    <div class="label"></div>
    <div class="slots">${'<div class="slot"></div>'.repeat(total)}</div>
  `;
  document.body.appendChild(el);

  const label = el.querySelector('.label');
  const slots = el.querySelectorAll('.slot');

  function set(count) {
    label.textContent =
      count >= total ? 'Map complete! Reach the island' : `Map pieces: ${count} / ${total}`;
    slots.forEach((slot, i) => slot.classList.toggle('found', i < count));
  }

  set(0);
  return { set };
}

// ---------- Shark warning (top middle, under the map bar) ----------
export function createSharkWarning() {
  const el = document.createElement('div');
  el.id = 'shark-warning';
  el.textContent = 'SHARK!';
  document.body.appendChild(el);

  let showing = false;

  // Only touch the page when it actually changes (this runs every frame)
  function set(on) {
    if (on === showing) return;
    showing = on;
    el.classList.toggle('show', on);
  }

  return { set };
}

// ---------- Popup message (bottom middle) ----------
let toastTimeout = null;

export function showToast(text) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- Win / lose screen ----------
export function showEndScreen(title, text) {
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