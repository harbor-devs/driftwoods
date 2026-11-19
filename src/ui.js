import { TILE_COST } from './config.js';

// ---------- Little drawn icons ----------
const PLANK_ICON = `
  <svg viewBox="0 0 32 32">
    <rect x="3" y="10" width="26" height="12" rx="2" fill="#c8894d" stroke="#3a2410" stroke-width="2.5"/>
    <path d="M7 14h12M11 18h14" stroke="#7a4a22" stroke-width="2" stroke-linecap="round"/>
    <circle cx="6.5" cy="16" r="1.4" fill="#3a2410"/>
    <circle cx="25.5" cy="16" r="1.4" fill="#3a2410"/>
  </svg>`;

// A coil of rope with a loose end
const ROPE_ICON = `
  <svg viewBox="0 0 32 32">
    <path d="M23 23 L29 29" stroke="#3a2410" stroke-width="5" stroke-linecap="round"/>
    <path d="M23 23 L29 29" stroke="#d9b77a" stroke-width="2" stroke-linecap="round"/>
    <circle cx="15" cy="15" r="11" fill="#d9b77a" stroke="#3a2410" stroke-width="2.5"/>
    <circle cx="15" cy="15" r="6.5" fill="none" stroke="#a5824a" stroke-width="2.5"/>
    <circle cx="15" cy="15" r="2.2" fill="#3a2410"/>
  </svg>`;

// A raft tile seen from above: 3 planks side by side
const TILE_ICON = `
  <svg viewBox="0 0 32 32">
    <rect x="5" y="5" width="7" height="22" rx="1.5" fill="#c8894d" stroke="#3a2410" stroke-width="2"/>
    <rect x="12.5" y="5" width="7" height="22" rx="1.5" fill="#b98349" stroke="#3a2410" stroke-width="2"/>
    <rect x="20" y="5" width="7" height="22" rx="1.5" fill="#d3a46c" stroke="#3a2410" stroke-width="2"/>
  </svg>`;

// Two posts with a net between them
const NET_ICON = `
  <svg viewBox="0 0 32 32">
    <path d="M8 8 L24 8 L22 26 L10 26 Z" fill="rgba(217,183,122,0.35)"/>
    <path d="M8 8h16M8.7 14h14.6M9.3 20h13.4M12 8l0.7 18M16 8v18M20 8l-0.7 18" stroke="#f0dcae" stroke-width="1.6" fill="none"/>
    <path d="M6 4v24M26 4v24" stroke="#3a2410" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M6 4v24M26 4v24" stroke="#8d5a2e" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;

// Stakes on a log, pointing up
const SPIKES_ICON = `
  <svg viewBox="0 0 32 32">
    <path d="M7 24 L9 6 L11 24 Z M14 24 L16 4 L18 24 Z M21 24 L23 6 L25 24 Z" fill="#c8894d" stroke="#3a2410" stroke-width="2" stroke-linejoin="round"/>
    <rect x="3" y="22" width="26" height="6" rx="3" fill="#6e4a2a" stroke="#3a2410" stroke-width="2"/>
  </svg>`;

// Mast with a full sail
const SAIL_ICON = `
  <svg viewBox="0 0 32 32">
    <path d="M16 3v26" stroke="#3a2410" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M16 3v26" stroke="#8d5a2e" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M7 7 H25 C27 12 27 18 25 23 H7 C9 18 9 12 7 7 Z" fill="#f1e4c3" stroke="#3a2410" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;

const ITEM_ICONS = { tile: TILE_ICON, net: NET_ICON, spikes: SPIKES_ICON, sail: SAIL_ICON };

const FIN_ICON = `
  <svg viewBox="0 0 32 32">
    <path d="M4 26 C12 22 16 12 15 4 C20 10 25 18 28 26 Z" fill="#fff3d6" stroke="#3a1010" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M2 28h28" stroke="#fff3d6" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;

const X_MARK = `
  <svg viewBox="0 0 24 24">
    <path d="M6 6l12 12M18 6L6 18" stroke="#b3261e" stroke-width="3.5" stroke-linecap="round"/>
  </svg>`;

// Replays the little pop animation on one counter
function bump(box) {
  box.classList.remove('bump');
  void box.offsetWidth; // restarts the animation
  box.classList.add('bump');
}

// ---------- Planks + rope counter (top left) + controls badges (bottom left) ----------
export function createHud() {
  // Wooden sign with the plank count and the rope count
  const el = document.createElement('div');
  el.id = 'hud';
  el.className = 'wood';
  el.innerHTML = `
    <span class="count planks"><span class="icon">${PLANK_ICON}</span><span class="num">0</span></span>
    <span class="count rope"><span class="icon">${ROPE_ICON}</span><span class="num">0</span></span>
  `;
  document.body.appendChild(el);
  const plankBox = el.querySelector('.planks');
  const plankNum = plankBox.querySelector('.num');
  const ropeBox = el.querySelector('.rope');
  const ropeNum = ropeBox.querySelector('.num');

  // Small key badges instead of a long sentence
  const keys = document.createElement('div');
  keys.id = 'keys';
  keys.innerHTML = `
    <div><kbd>WASD</kbd>Walk</div>
    <div><kbd>L-Click</kbd>Hook</div>
    <div><kbd>R-Click</kbd><kbd>Space</kbd>Oar</div>
    <div><kbd>B</kbd><span class="build-label">Build</span></div>
    <div><kbd>Esc</kbd>Pause</div>
  `;
  document.body.appendChild(keys);
  const buildLabel = keys.querySelector('.build-label');

  let lastPlanks = null;
  let lastRope = null;

  function update(planks, rope, buildMode) {
    if (planks !== lastPlanks) {
      plankNum.textContent = planks;
      if (lastPlanks !== null) bump(plankBox); // skip the pop the very first time
      lastPlanks = planks;
    }
    if (rope !== lastRope) {
      ropeNum.textContent = rope;
      if (lastRope !== null) bump(ropeBox);
      lastRope = rope;
    }
    el.classList.toggle('can-build', planks >= TILE_COST);
    buildLabel.textContent = buildMode ? 'Stop building' : 'Build';
  }

  return { update };
}

// ---------- Build menu (bottom right) + hint paper (top left), only in build mode ----------
export function createBuildMenu(items) {
  const slotsHtml = items
    .map(
      (item) => `
      <div class="slot" data-id="${item.id}">
        <kbd>${item.key}</kbd>
        <span class="icon">${ITEM_ICONS[item.id] || ''}</span>
        <span class="name">${item.name}</span>
        <span class="cost">
          <span>${item.planks}</span>${PLANK_ICON}
          ${item.rope > 0 ? `<span>${item.rope}</span>${ROPE_ICON}` : ''}
        </span>
      </div>`
    )
    .join('');

  const el = document.createElement('div');
  el.id = 'build-menu';
  el.className = 'wood';
  el.innerHTML = `<div class="title">Build</div><div class="slots">${slotsHtml}</div>`;
  document.body.appendChild(el);
  const slots = el.querySelectorAll('.slot');

  // Paper note under the planks counter that says what to do
  const hint = document.createElement('div');
  hint.id = 'build-hint';
  hint.className = 'parchment';
  document.body.appendChild(hint);

  let last = ''; // only touch the page when something changed

  function set(on, selectedId, planks, rope) {
    const key = `${on}|${selectedId}|${planks}|${rope}`;
    if (key === last) return;
    last = key;

    el.classList.toggle('show', on);
    hint.classList.toggle('show', on);

    slots.forEach((slot, i) => {
      const item = items[i];
      slot.classList.toggle('selected', item.id === selectedId);
      slot.classList.toggle('poor', planks < item.planks || rope < item.rope);
    });

    const selected = items.find((it) => it.id === selectedId);
    if (selected) hint.textContent = `${selected.hint} (1 to ${items.length} to switch)`;
  }

  return { set };
}

// ---------- Goals board (top right): map pieces + raft size ----------
export function createMapBar(totalPieces, raftGoal) {
  const el = document.createElement('div');
  el.id = 'journey';
  el.className = 'wood';
  el.innerHTML = `
    <div class="label map-label"></div>
    <div class="scraps">${`<div class="scrap">${X_MARK}</div>`.repeat(totalPieces)}</div>
    <div class="label raft-label"></div>
    <div class="cells">${'<div class="cell"></div>'.repeat(raftGoal)}</div>
  `;
  document.body.appendChild(el);

  const mapLabel = el.querySelector('.map-label');
  const raftLabel = el.querySelector('.raft-label');
  const scraps = el.querySelectorAll('.scrap');
  const cells = el.querySelectorAll('.cell');

  let last = ''; // so we only update the page when something changed

  function set(pieces, tiles, revealed) {
    const key = `${pieces}|${tiles}|${revealed}`;
    if (key === last) return;
    last = key;

    if (revealed) mapLabel.textContent = 'Follow the green arrow!';
    else if (pieces >= totalPieces) mapLabel.textContent = 'Map complete!';
    else mapLabel.textContent = `Map pieces ${pieces} / ${totalPieces}`;
    scraps.forEach((scrap, i) => scrap.classList.toggle('found', i < pieces));

    const ready = tiles >= raftGoal;
    raftLabel.textContent = ready ? 'Raft ready to sail!' : `Raft ${tiles} / ${raftGoal} tiles`;
    cells.forEach((cell, i) => cell.classList.toggle('filled', i < tiles));
    el.classList.toggle('ready', ready);
  }

  return { set };
}

// ---------- Shark warning (red plank under the goals board) ----------
export function createSharkWarning() {
  const el = document.createElement('div');
  el.id = 'shark-warning';
  el.innerHTML = `${FIN_ICON}<span>SHARK!</span>`;
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

// ---------- Message on a paper scroll (bottom middle) ----------
let toastTimeout = null;

export function showToast(text) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'parchment';
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
  box.className = 'overlay';
  box.innerHTML = `
    <div class="wood board">
      <h1>${title}</h1>
      <p>${text}</p>
      <div class="buttons">
        <button class="btn primary" id="restart">Play again</button>
      </div>
    </div>
  `;
  document.body.appendChild(box);
  document.getElementById('restart').addEventListener('click', () => location.reload());
}

// ---------- Pause menu ----------
// onResume and onRestart are functions main.js gives us
export function createPauseMenu({ onResume, onRestart }) {
  const el = document.createElement('div');
  el.id = 'pause-menu';
  el.className = 'overlay';
  el.innerHTML = `
    <div class="wood board">
      <h1>Paused</h1>
      <div class="buttons">
        <button class="btn primary resume">Resume</button>
        <button class="btn restart">Restart</button>
      </div>
      <div class="controls">
        <div><span class="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>Walk (or arrow keys). Stand near an edge to lean and steer the raft</span></div>
        <div><span class="keys"><kbd>L-Click</kbd></span><span>Throw the hook</span></div>
        <div><span class="keys"><kbd>R-Click</kbd><kbd>Space</kbd></span><span>Swing the oar</span></div>
        <div><span class="keys"><kbd>B</kbd></span><span>Build mode</span></div>
        <div><span class="keys"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd></span><span>Pick what to build</span></div>
        <div><span class="keys"><kbd>Esc</kbd><kbd>P</kbd></span><span>Pause and resume</span></div>
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