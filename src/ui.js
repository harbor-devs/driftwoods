import { TILE_COST } from './config.js';

// ---------- HUD (top left) ----------
export function createHud() {
  const el = document.createElement('div');
  el.id = 'hud';
  document.body.appendChild(el);

  function update(planks, buildMode) {
    const hint = buildMode
      ? `BUILD MODE: click next to your raft to add a tile (${TILE_COST} planks). Press B to stop building`
      : 'Click the water to throw your hook. Press B to build';
    el.innerHTML = `
      <div class="count">Planks: ${planks}</div>
      <div class="hint">${hint}</div>
    `;
  }

  return { update };
}

// ---------- Journey bar (top middle) ----------
export function createJourneyBar() {
  const el = document.createElement('div');
  el.id = 'journey';
  el.innerHTML = `
    <div class="label">Island</div>
    <div class="bar"><div class="fill"></div></div>
  `;
  document.body.appendChild(el);
  const fill = el.querySelector('.fill');

  function set(progress) {
    fill.style.width = `${progress * 100}%`;
  }

  return { set };
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