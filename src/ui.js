import { TILE_COST } from './config.js';

// ---------- HUD (top left) ----------
export function createHud() {
  const el = document.createElement('div');
  el.id = 'hud';
  document.body.appendChild(el);

  function update(planks, buildMode) {
    const hint = buildMode
      ? `BUILD MODE: click next to your raft to add a tile (${TILE_COST} planks). B to stop building`
      : 'WASD walk (lean to steer). Left click: hook. Right click or Space: oar. B: build. Esc: pause';
    el.innerHTML = `
      <div class="count">Planks: ${planks}</div>
      <div class="hint">${hint}</div>
    `;
  }

  return { update };
}

// ---------- Goals bar (top middle): map pieces + raft size ----------
export function createMapBar(totalPieces, raftGoal) {
  const el = document.createElement('div');
  el.id = 'journey';
  el.innerHTML = `
    <div class="row">
      <div class="label map-label"></div>
      <div class="slots">${'<div class="slot"></div>'.repeat(totalPieces)}</div>
    </div>
    <div class="row">
      <div class="label raft-label"></div>
      <div class="bar"><div class="fill"></div></div>
    </div>
  `;
  document.body.appendChild(el);

  const mapLabel = el.querySelector('.map-label');
  const raftLabel = el.querySelector('.raft-label');
  const slots = el.querySelectorAll('.slot');
  const fill = el.querySelector('.fill');

  let last = ''; // so we only update the page when something changed

  function set(pieces, tiles, revealed) {
    const key = `${pieces}|${tiles}|${revealed}`;
    if (key === last) return;
    last = key;

    if (revealed) mapLabel.textContent = 'Follow the green arrow to the island!';
    else if (pieces >= totalPieces) mapLabel.textContent = 'Map complete!';
    else mapLabel.textContent = `Map pieces: ${pieces} / ${totalPieces}`;
    slots.forEach((slot, i) => slot.classList.toggle('found', i < pieces));

    const ready = tiles >= raftGoal;
    raftLabel.textContent = ready
      ? `Raft: ${tiles} / ${raftGoal} tiles, ready to sail`
      : `Raft: ${tiles} / ${raftGoal} tiles`;
    fill.style.width = `${Math.min(tiles / raftGoal, 1) * 100}%`;
    fill.classList.toggle('done', ready);
  }

  return { set };
}

// ---------- Shark warning (top middle, under the goals bar) ----------
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

// ---------- Pause menu ----------
// onResume and onRestart are functions main.js gives us
export function createPauseMenu({ onResume, onRestart }) {
  const el = document.createElement('div');
  el.id = 'pause-menu';
  el.innerHTML = `
    <div class="panel">
      <h1>Paused</h1>
      <div class="buttons">
        <button class="resume">Resume</button>
        <button class="restart">Restart</button>
      </div>
      <div class="controls">
        <div><b>WASD / Arrows</b><span>Walk. Stand near an edge to lean and steer the raft</span></div>
        <div><b>Left click</b><span>Throw the hook</span></div>
        <div><b>Right click / Space</b><span>Swing the oar</span></div>
        <div><b>B</b><span>Build mode</span></div>
        <div><b>Esc / P</b><span>Pause and resume</span></div>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  el.querySelector('.resume').addEventListener('click', onResume);
  el.querySelector('.restart').addEventListener('click', onRestart);

  function show() {
    el.classList.add('show');
  }

  function hide() {
    el.classList.remove('show');
    // Drop focus from the button, so pressing Space later doesn't "click" it again
    if (document.activeElement) document.activeElement.blur();
  }

  return { show, hide };
}