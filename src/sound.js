// All sounds are made with code (Web Audio), so there are no audio files to load.
// Browsers only allow sound after a click, so main.js calls unlockSound() when you press Start.

const MASTER_VOLUME = 0.5; // overall loudness
const OCEAN_VOLUME = 0.05; // the quiet sea in the background
const MIN_GAP = 0.06; // seconds before the same sound can play again (stops spam)

let ctx = null;
let master = null;
let noiseBuffer = null;
let muted = false;
const lastPlayed = {};

// Two seconds of random noise. Whooshes, splashes and the sea are all filtered noise.
function makeNoiseBuffer() {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// Quiet looping sea sound that slowly gets louder and softer, like waves
function startOcean() {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 450;

  const gain = ctx.createGain();
  gain.gain.value = OCEAN_VOLUME;

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.12;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = OCEAN_VOLUME * 0.6;
  lfo.connect(lfoDepth);
  lfoDepth.connect(gain.gain);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start();
  lfo.start();
}

// ---------- Building blocks ----------

// A short musical note that slides from one pitch to another
function tone({ type = 'sine', from, to, time = 0.2, vol = 0.3, delay = 0 }) {
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + time);

  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + time + 0.05);
}

// A short burst of noise (splash, whoosh, crack) with a filter that sweeps
function noise({ filter = 'lowpass', from, to, time = 0.3, vol = 0.3, q = 1, delay = 0 }) {
  const t0 = ctx.currentTime + delay;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;

  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t0);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + time);

  source.connect(f);
  f.connect(gain);
  gain.connect(master);
  source.start(t0, Math.random());
  source.stop(t0 + time + 0.05);
}

// ---------- The sounds ----------
const SOUNDS = {
  click() {
    tone({ type: 'square', from: 600, to: 400, time: 0.06, vol: 0.06 });
  },
  error() {
    tone({ type: 'square', from: 200, to: 150, time: 0.12, vol: 0.08 });
  },

  'splash-small'() {
    noise({ filter: 'bandpass', from: 1800, to: 600, time: 0.18, vol: 0.05, q: 0.8 });
  },
  'splash-medium'() {
    noise({ filter: 'lowpass', from: 2500, to: 500, time: 0.3, vol: 0.1 });
  },
  'splash-big'() {
    noise({ filter: 'lowpass', from: 3000, to: 300, time: 0.5, vol: 0.2 });
    tone({ from: 120, to: 50, time: 0.3, vol: 0.2 });
  },

  hook() {
    noise({ filter: 'bandpass', from: 400, to: 1800, time: 0.18, vol: 0.1, q: 1.2 });
  },
  oar() {
    noise({ filter: 'bandpass', from: 300, to: 1200, time: 0.25, vol: 0.12, q: 1 });
  },
  whack() {
    tone({ from: 150, to: 60, time: 0.18, vol: 0.35 });
    noise({ filter: 'lowpass', from: 1500, to: 200, time: 0.15, vol: 0.25 });
  },

  pickup() {
    tone({ type: 'triangle', from: 520, to: 780, time: 0.1, vol: 0.18 });
    tone({ type: 'triangle', from: 780, to: 1040, time: 0.12, vol: 0.18, delay: 0.07 });
  },
  barrel() {
    tone({ from: 180, to: 90, time: 0.15, vol: 0.3 });
    noise({ filter: 'lowpass', from: 900, to: 200, time: 0.12, vol: 0.2 });
    tone({ type: 'triangle', from: 660, to: 990, time: 0.12, vol: 0.15, delay: 0.1 });
  },
  bottle() {
    [880, 1175, 1568].forEach((freq, i) => {
      tone({ from: freq, time: 0.5, vol: 0.14, delay: i * 0.1 });
    });
  },
  chime() {
    tone({ from: 1320, time: 0.4, vol: 0.09 });
    tone({ from: 1760, time: 0.4, vol: 0.09, delay: 0.12 });
  },

  build() {
    tone({ type: 'triangle', from: 220, to: 110, time: 0.12, vol: 0.3 });
    noise({ filter: 'bandpass', from: 900, time: 0.06, vol: 0.15, q: 2 });
    tone({ type: 'triangle', from: 260, to: 130, time: 0.1, vol: 0.25, delay: 0.1 });
  },

  alarm() {
    tone({ type: 'sawtooth', from: 330, time: 0.15, vol: 0.08 });
    tone({ type: 'sawtooth', from: 392, time: 0.2, vol: 0.08, delay: 0.18 });
  },
  bite() {
    tone({ type: 'sawtooth', from: 90, to: 50, time: 0.3, vol: 0.25 });
    noise({ filter: 'lowpass', from: 800, to: 200, time: 0.3, vol: 0.2 });
  },
  tileBreak() {
    noise({ filter: 'bandpass', from: 1200, to: 300, time: 0.4, vol: 0.3, q: 2 });
    noise({ filter: 'lowpass', from: 3000, to: 200, time: 0.25, vol: 0.25, delay: 0.02 });
    tone({ from: 100, to: 40, time: 0.35, vol: 0.35 });
  },
  spike() {
    tone({ type: 'square', from: 700, to: 200, time: 0.15, vol: 0.12 });
    noise({ filter: 'highpass', from: 3000, to: 1500, time: 0.1, vol: 0.15 });
    tone({ from: 150, to: 60, time: 0.18, vol: 0.3 });
  },

  win() {
    [523, 659, 784, 1047].forEach((freq, i) => {
      tone({ type: 'triangle', from: freq, time: 0.35, vol: 0.2, delay: i * 0.15 });
    });
  },
  lose() {
    [392, 330, 262, 196].forEach((freq, i) => {
      tone({ type: 'triangle', from: freq, time: 0.4, vol: 0.22, delay: i * 0.22 });
    });
  },
};

// ---------- Used by main.js ----------

// Call this from a click (the Start button). Browsers block sound before that.
export function unlockSound() {
  if (ctx) {
    ctx.resume();
    return;
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return; // very old browser: the game just stays quiet

  ctx = new AudioCtx();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : MASTER_VOLUME;
  master.connect(ctx.destination);
  noiseBuffer = makeNoiseBuffer();
  startOcean();
}

export function playSound(name) {
  if (!ctx || muted || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if (lastPlayed[name] !== undefined && now - lastPlayed[name] < MIN_GAP) return;
  lastPlayed[name] = now;
  const make = SOUNDS[name];
  if (make) make();
}

// M key. Returns true if the sound is now off.
export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, ctx.currentTime, 0.02);
  return muted;
}

// Pausing the game also pauses the sound
export function setSoundPaused(paused) {
  if (!ctx) return;
  if (paused) ctx.suspend();
  else ctx.resume();
}
