'use strict';
// ============================================================
//  Tentakel-Toast – Engine: Verben, Laufen, Sprache, Dialoge,
//  Inventar, Zeitreise-Post, Maus/Touch/Tastatur/Controller,
//  Vollbild, Erfolge, Menü, Speichern, Rendering
// ============================================================

const cv = document.getElementById('game');
const mainCx = cv.getContext('2d');
let cx = mainCx;   // im Klassik-Modus zeigt cx auf den Pixel-Renderer (js/pixel.js)
let VS = 1, DPR = 1;

const VERBS = [['give', 'Gib'], ['pick', 'Nimm'], ['use', 'Benutze'], ['open', 'Öffne'], ['look', 'Schau an'], ['push', 'Drücke'], ['close', 'Schließe'], ['talk', 'Rede mit'], ['pull', 'Ziehe']];
const VERB_LABEL = Object.fromEntries(VERBS); VERB_LABEL.walk = 'Gehe zu';
const VERB_KEYS = { g: 'give', n: 'pick', b: 'use', o: 'open', s: 'look', d: 'push', c: 'close', r: 'talk', z: 'pull' };
const PLAYERS = ['bernard', 'hoagie', 'laverne'];
const ERA = {
  present: { label: 'Gegenwart', bg: '#2d5878', theme: 'present', col: '#5fd3ff' },
  past: { label: 'Jahr 1776', bg: '#7a5426', theme: 'past', col: '#ffb15a' },
  future: { label: 'Zukunft', bg: '#5e2a86', theme: 'future', col: '#c07dff' },
};
const HOME_ERA = { bernard: 'present', hoagie: 'past', laverne: 'future' };
const SAVE_KEY = 'tentakel-toast-save-v1', SET_KEY = 'tentakel-toast-settings-v1', ACH_KEY = 'tentakel-toast-erfolge-v1';
const SLOT_KEY = 'tentakel-toast-platz-', SLOTS = 3;

const G = {
  t: 0, last: 0, state: null, screen: 'loading',
  verb: null, first: null, hover: null,
  busy: 0, speech: null, dialog: null, menu: null, note: null, caption: null, viewRoom: null,
  fade: 0, fadeFrom: 0, fadeTarget: 0, fadeStart: 0, fadeDur: 1, fadeRes: null, fadeMode: 'iris', irisX: W / 2, irisY: SH / 2, warpLabel: '', warpCol: '#ffd23a',
  mouse: { x: W / 2, y: SH / 2 }, pointer: 'mouse', flash: {}, fast: false, skipAll: false,
  settings: { music: true, voice: false, babble: true, fullscreen: true, retro: false }, titleBtns: [], menuBtns: [], saved: null,
  reveal: 0, fly: [], shake: { until: 0, mag: 0 }, ach: {}, achToast: null, nextBlip: 0, fsTried: false,
  parts: [], ripples: [], quality: 1, fpsAvg: 16.7, fpsGate: 0,
  motes: [], moteKind: null, storm: null, neon: null, bark: null, barkNext: 0, idleSince: 0, lastClick: null,
  cam: { z: 1, x: W / 2, y: SH / 2 }, photoFlash: 0,
};
const OBJ = {};

// ---------- kleine Helfer ----------
function buildIndex() { for (const r of Object.values(ROOMS)) for (const o of r.objs) { o.room = r.id; OBJ[o.id] = o; } }
function fl() { return G.state.flags; }
function curId() { return G.state.cur; }
function me() { return ACT[G.state.cur]; }
function inv(c = curId()) { return G.state.inv[c]; }
function has(i, c = curId()) { return inv(c).includes(i); }
function addItem(i, c = curId(), quiet) {
  if (!inv(c).includes(i)) inv(c).push(i);
  if (quiet) return;
  Sound.sfx('pick');
  if (c === curId() && G.screen === 'game' && !G.fast) {
    const a = me(), room = ROOMS[viewRoomId()];
    const from = a.room === room.id ? [a.x, a.y - a.h * roomScale(room, a.y) * 0.6] : [W / 2, SH / 2];
    G.fly.push({ id: i, from, t0: G.t });
    puff(from[0], from[1], '#fff1a8', 10, { vy: 80, vx: 150, r: 2.2, max: 650, spread: 12 });
  }
}
function takeItem(i, c = curId()) { const a = inv(c), k = a.indexOf(i); if (k >= 0) a.splice(k, 1); if (G.first === 'i:' + i) G.first = null; }
function whereItem(i) { return PLAYERS.find(p => G.state.inv[p].includes(i)) || null; }
function viewRoomId() { return G.viewRoom || me().room; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
const timers = [];
function wait(ms) { if (G.fast || G.skipAll) return Promise.resolve(); return new Promise(r => timers.push({ until: G.t + ms, r })); }
function skipScene() { if (!G.busy || G.dialog) return; G.skipAll = true; Voice.stop(); finishSpeech(); }
function note(text) { G.note = { text, until: G.t + 2800 }; }
function shake(ms = 400, mag = 4) { G.shake = { until: G.t + ms, mag }; }
function nameOf(key) {
  const [k, id] = key.split(':');
  if (k === 'i') return ITEMS[id].name;
  if (k === 'o') { const n = OBJ[id].name; return typeof n === 'function' ? n() : n; }
  if (k === 'a' || k === 'p') return ACT[id].name;
  return '';
}
function isVisible(o) { return !o.visible || o.visible(); }
function hotspotCenter(o) { const [x, y, w, h] = o.rect; return [x + w / 2, y + Math.min(h / 2, 90)]; }

// ---------- Partikel & Klick-Ringe ----------
const DUST = { wood: '#b08752', tile: '#a8b4cc', grass: '#8fd06a', marble: '#e2d4f4', carpet: '#9a8878' };
function puff(x, y, col, n = 3, o = {}) {
  if (G.quality < 1) n = Math.ceil(n / 2);
  for (let i = 0; i < n && G.parts.length < 90; i++) G.parts.push({
    x: x + (Math.random() - 0.5) * (o.spread || 16), y: y - Math.random() * 3,
    vx: (Math.random() - 0.5) * (o.vx || 26), vy: -(o.vy || 12) - Math.random() * 14,
    r: (o.r || 2.6) * (0.6 + Math.random() * 0.8), life: 0, max: (o.max || 480) * (0.7 + Math.random() * 0.6), col,
  });
}
function updateParts(dt) {
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i];
    if ((p.life += dt) >= p.max) { G.parts.splice(i, 1); continue; }
    p.x += p.vx * dt / 1000; p.vy += 60 * dt / 1000; p.y += p.vy * dt / 1000;
    if (p.y > SH + 8) G.parts.splice(i, 1);
  }
}
function drawParts() {
  for (const p of G.parts) {
    const k = 1 - p.life / p.max;
    cx.globalAlpha = k * 0.65;
    E(cx, p.x, p.y, p.r * (0.6 + 0.4 * k), p.r * 0.7 * (0.6 + 0.4 * k), p.col, 0);
  }
  cx.globalAlpha = 1;
}
function drawRipples() {
  for (const r of G.ripples) {
    const k = (G.t - r.t) / 430; if (k >= 1) continue;
    cx.globalAlpha = (1 - k) * 0.8;
    E(cx, r.x, r.y, 7 + k * 24, 3 + k * 9, null, 2.5, 0, '#ffe9a0');
  }
  cx.globalAlpha = 1;
}

// ---------- Raum-Atmosphäre: Hall, Licht auf Figuren, Bloom, Wetter, Schwebeteilchen ----------
// light: [Seite der Hauptlichtquelle (-1 links, 1 rechts), Führungslicht, Schattenfarbe]
const ROOM_FX = {
  lobby: { verb: [1.0, 0.16], light: [-1, '#ffe2b0', '#1c2c66'], bloom: 0.22, amb: ['crickets', 'traffic'], motes: 'dust', music: 'lounge' },
  labor: { verb: [1.5, 0.2], light: [1, '#c0fff4', '#0c2a40'], bloom: 0.3, amb: ['drip', 'beeps'], motes: 'dust', flicker: 'neon', reflect: 0.2 },
  gasthaus: { verb: [0.7, 0.14], light: [-1, '#ffc070', '#3a1a10'], bloom: 0.3, amb: ['creak'], motes: 'warm', flicker: 'fire', music: 'tavern' },
  garten1776: { verb: [0.3, 0.06], light: [1, '#fff0c0', '#2a3a58'], bloom: 0.22, amb: ['wind', 'moo'], motes: 'leaf', fg: ['#1f3d1a', '#2c5222'], sky: 'birds' },
  fgarten: { verb: [0.6, 0.1], light: [-1, '#ffb8f0', '#1c0c48'], bloom: 0.34, amb: ['future', 'rain'], motes: 'firefly', fg: ['#2a0f3e', '#45206a'], sky: 'cars', storm: true, rain: true },
  vorraum: { music: 'march', verb: [2.2, 0.24], light: [1, '#e4c8ff', '#1a0c3a'], bloom: 0.28, amb: ['rain', 'palace'], motes: 'magic', storm: true, reflect: 0.22 },
  thron: { verb: [2.6, 0.26], light: [-1, '#f4c4ff', '#1a0830'], bloom: 0.32, amb: ['rain', 'palace'], motes: 'magic', storm: true, reflect: 0.22 },
};
function roomFx() { return (G.state && ROOM_FX[viewRoomId()]) || {}; }
function hexA(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
const glowCache = {};
function glowSprite(col) {
  let c = glowCache[col];
  if (!c) {
    c = glowCache[col] = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, hexA(col, 1)); gr.addColorStop(0.35, hexA(col, 0.45)); gr.addColorStop(1, hexA(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  return c;
}
// additives Leuchten an (x, y) mit Radius r und Stärke a – nur HD
function glow(x, y, r, col, a) {
  if (cx.isPix || a <= 0.01) return;
  cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = Math.min(1, a);
  cx.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2); cx.restore();
}
// statische Bildebenen (z. B. Himmel und Hügel im Titel) einmal pro Auflösung puffern
const layerCache = {};
function cachedLayer(key, h, draw) {
  const s = VS * DPR; let c = layerCache[key];
  if (!c || c._s !== s) {
    c = layerCache[key] = document.createElement('canvas'); c.width = Math.ceil(W * s); c.height = Math.ceil(h * s); c._s = s;
    const g = c.getContext('2d'); g.setTransform(s, 0, 0, s, 0, 0);
    const keep = cx; cx = g; try { draw(); } finally { cx = keep; }
  }
  cx.drawImage(c, 0, 0, W, h);
}
function panX(x) { return Math.max(-0.8, Math.min(0.8, (x / W) * 2 - 1)); }
function panOf(a) { return a && G.state && a.room === viewRoomId() ? panX(a.x) : null; }

const MOTES = {
  dust: { n: 22, make: m => Object.assign(m, { x: Math.random() * W, y: 20 + Math.random() * SH * 0.8, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 4, r: 0.9 + Math.random() * 1.3, col: '#fff2d6' }) },
  warm: { n: 20, make: m => Object.assign(m, { x: Math.random() * W, y: 40 + Math.random() * SH * 0.8, vx: (Math.random() - 0.5) * 6, vy: -3 - Math.random() * 5, r: 0.9 + Math.random() * 1.4, col: '#ffd59a' }) },
  magic: { n: 18, make: m => Object.assign(m, { x: Math.random() * W, y: SH * (0.4 + Math.random() * 0.6), vx: (Math.random() - 0.5) * 8, vy: -8 - Math.random() * 14, r: 1 + Math.random() * 1.6, col: Math.random() < 0.5 ? '#e6a8ff' : '#ffd6ff', glow: 1 }) },
  firefly: { n: 16, make: m => Object.assign(m, { x: Math.random() * W, y: SH * (0.35 + Math.random() * 0.55), vx: 0, vy: 0, r: 1.6, col: '#e8ff8a', glow: 1 }) },
  leaf: { n: 12, make: (m, init) => Object.assign(m, { x: init ? Math.random() * W : Math.random() * W - 160, y: init ? Math.random() * SH : -12, vx: 20, vy: 22 + Math.random() * 16, r: 4 + Math.random() * 2.5, rot: Math.random() * 6.3, spin: (Math.random() - 0.5) * 4, col: pick(['#e0782e', '#c8501e', '#e8b040', '#a8401a']) }) },
};
function updateMotes(dt) {
  const kind = G.screen === 'game' ? roomFx().motes : null, def = MOTES[kind];
  if (G.moteKind !== kind) {
    G.motes = []; G.moteKind = kind;
    if (def) for (let i = 0; i < def.n; i++) G.motes.push(def.make({ life: Math.random() * 6000, max: 5000 + Math.random() * 6000, seed: Math.random() * 100 }, true));
  }
  if (!def) return;
  const s = dt / 1000, p = me();
  for (const m of G.motes) {
    m.life += dt;
    if (kind === 'firefly') {
      // ziellos herumschwirren und der Spielfigur ausweichen
      m.vx += (Math.sin(G.t * 0.0013 + m.seed) * 30 - m.vx) * s; m.vy += (Math.cos(G.t * 0.0017 + m.seed * 1.3) * 18 - m.vy) * s;
      if (p.room === viewRoomId()) { const dx = m.x - p.x, dy = m.y - (p.y - 70), d = Math.hypot(dx, dy) || 1; if (d < 95) { m.vx += dx / d * 240 * s; m.vy += dy / d * 240 * s; } }
    } else if (kind === 'leaf') { m.rot += m.spin * s; m.vx = 18 + Math.sin(G.t * 0.0009 + m.seed) * 26; }
    else m.vx += (Math.random() - 0.5) * 4 * s;
    m.x += m.vx * s; m.y += m.vy * s;
    const out = m.x < -40 || m.x > W + 40 || m.y < -40 || m.y > SH + 20;
    if (out || (kind !== 'leaf' && m.life > m.max)) { m.life = 0; m.max = 5000 + Math.random() * 6000; def.make(m, false); }
  }
}
function drawMotes() {
  const kind = G.moteKind; if (!MOTES[kind]) return;
  for (const m of G.motes) {
    if (kind === 'leaf') {
      cx.save(); cx.translate(m.x, m.y); cx.rotate(m.rot); cx.scale(1, 0.45 + 0.55 * Math.abs(Math.sin(m.rot * 1.7)));
      E(cx, 0, 0, m.r, m.r * 0.5, m.col, 1.2, 0, 'rgba(40,16,8,0.7)'); L(cx, [-m.r, 0, m.r, 0], 1, 'rgba(60,24,8,0.6)');
      cx.restore(); continue;
    }
    let a = Math.sin(Math.PI * Math.min(1, m.life / m.max));
    if (kind === 'firefly') a *= (0.55 + 0.45 * Math.sin(G.t * 0.006 + m.seed * 7)) * (rainFx.on ? 0.12 : 1);   // bei Regen verstecken sich die Glühwürmchen
    if (a <= 0.02) continue;
    if (m.glow) glow(m.x, m.y, m.r * 7, m.col, 0.5 * a);
    cx.globalAlpha = a * (m.glow ? 1 : 0.55); E(cx, m.x, m.y, m.r, m.r, m.col, 0); cx.globalAlpha = 1;
  }
}

// Gewitter über Lilas Palast, flackernde Laborröhren, Kaminfeuer im Gasthaus
// Sichtbarer Regen (z. B. Zukunftsgarten im Gewitter): Schauer kommen und gehen,
// Tropfen fallen schräg und spritzen unten auf, Glühwürmchen und Donner pausieren in der Trockenphase
const rainFx = { drops: [], splashes: [], on: false, next: 0 };
function rainActive() { return !!(G.state && G.screen === 'game' && (ROOM_FX[viewRoomId()] || {}).rain && rainFx.on); }
function roomAmb() {
  const r = ROOMS[viewRoomId()], fx = ROOM_FX[r.id] || {};
  const list = [...new Set([...(r.amb || []), ...(fx.amb || [])])];
  return rainFx.on ? list : list.filter(n => n !== 'rain');
}
function updateRain(dt) {
  const want = G.screen === 'game' && !G.menu && (ROOM_FX[viewRoomId()] || {}).rain;
  if (!want) {
    if (rainFx.drops.length || rainFx.on || rainFx.next) { rainFx.drops = []; rainFx.splashes = []; rainFx.on = false; rainFx.next = 0; }
    return;
  }
  if (!rainFx.next) {   // beim Betreten: erst eine Schauer, danach Wechsel zwischen Regen und Pause
    rainFx.on = true; rainFx.next = G.t + 16000 + Math.random() * 14000;
    Sound.ambience(roomAmb());
  }
  if (G.t >= rainFx.next) {
    rainFx.on = !rainFx.on;
    rainFx.next = G.t + (rainFx.on ? 20000 + Math.random() * 18000 : 12000 + Math.random() * 16000);
    Sound.ambience(roomAmb());
    if (!rainFx.on) { rainFx.drops = []; rainFx.splashes = []; }
  }
  if (!rainFx.on) return;
  const want2 = G.quality < 1 ? 20 : 34;
  if (rainFx.drops.length > want2) rainFx.drops.length = want2;
  while (rainFx.drops.length < want2) rainFx.drops.push({ x: Math.random() * (W + 140), y: Math.random() * SH, land: 312 + Math.random() * 122, v: 660 + Math.random() * 260 });
  const s = dt / 1000;
  for (let i = rainFx.drops.length - 1; i >= 0; i--) {
    const d = rainFx.drops[i];
    d.y += d.v * s; d.x -= d.v * 0.16 * s;
    if (d.y >= d.land) {
      rainFx.splashes.push({ x: d.x, y: d.land, t: G.t });
      Object.assign(d, { x: Math.random() * (W + 140), y: -20 - Math.random() * 80, land: 312 + Math.random() * 122, v: 660 + Math.random() * 260 });
    }
  }
  for (let i = rainFx.splashes.length - 1; i >= 0; i--) if (G.t - rainFx.splashes[i].t > 240) rainFx.splashes.splice(i, 1);
}
function drawRain() {
  if (!rainFx.drops.length) return;
  cx.strokeStyle = 'rgba(188,216,255,0.4)'; cx.lineWidth = 1.5; cx.lineCap = 'round';
  cx.beginPath();
  for (const d of rainFx.drops) { cx.moveTo(d.x, d.y - 9); cx.lineTo(d.x + 1.4, d.y); }
  cx.stroke();
  for (const sp of rainFx.splashes) {
    const k = (G.t - sp.t) / 240;
    cx.globalAlpha = (1 - k) * 0.6;
    E(cx, sp.x, sp.y, 2 + k * 5, 0.9 + k * 2, null, 1.2, 0, '#cfe4ff');
  }
  cx.globalAlpha = 1;
}
function updateWeather() {
  const fx = G.screen === 'game' ? roomFx() : {};
  if (fx.storm && !G.menu && (!fx.rain || rainFx.on)) {
    const st = G.storm || (G.storm = { next: G.t + 5000 + Math.random() * 7000, flash: -1e9, thunder: 0 });
    if (G.t >= st.next) { st.flash = G.t; st.thunder = G.t + 500 + Math.random() * 1400; st.next = G.t + 16000 + Math.random() * 22000; }
    if (st.thunder && G.t >= st.thunder) { st.thunder = 0; Sound.sfx('thunder', (Math.random() - 0.5) * 1.2); rumble(500, 0.3, 0.2); }
  } else G.storm = null;
  if (fx.flicker === 'neon') {
    const ne = G.neon || (G.neon = { next: G.t + 8000 + Math.random() * 10000, start: -1e9 });
    if (G.t >= ne.next) { ne.start = G.t; ne.next = G.t + 14000 + Math.random() * 20000; }
  } else G.neon = null;
}
function drawLightFx(hd) {
  const fx = roomFx();
  if (hd && fx.flicker === 'fire') {
    const n = Math.sin(G.t * 0.013) * 0.5 + Math.sin(G.t * 0.031 + 1) * 0.3 + Math.sin(G.t * 0.071 + 2) * 0.2;
    cx.save(); cx.globalCompositeOperation = 'soft-light'; cx.globalAlpha = 0.1 + n * 0.06; cx.fillStyle = '#ff9a40'; cx.fillRect(0, 0, W, SH); cx.restore();
  }
  if (G.neon) {
    const k = G.t - G.neon.start;
    if ((k > 0 && k < 60) || (k > 130 && k < 180) || (k > 280 && k < 330)) { cx.fillStyle = 'rgba(0,10,20,0.38)'; cx.fillRect(0, 0, W, SH); }
  }
  if (G.storm) {
    const k = G.t - G.storm.flash;
    const a = k < 0 ? 0 : k < 70 ? 0.5 : k < 140 ? 0.08 : k < 230 ? 0.36 : k < 900 ? 0.36 * (1 - (k - 230) / 670) : 0;
    if (a > 0) {
      cx.save(); if (hd) cx.globalCompositeOperation = 'screen';
      cx.fillStyle = `rgba(214,226,255,${(hd ? a : a * 0.6).toFixed(3)})`; cx.fillRect(0, 0, W, SH); cx.restore();
    }
  }
}

// Bloom: helle Stellen der fertigen Szene verkleinert, weichgezeichnet und per "screen" wieder darüber
const bloomC = document.createElement('canvas'), bloomG = bloomC.getContext('2d');
bloomC.width = 240; bloomC.height = 110;
const BLOOM_OK = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;
function drawBloom(alpha, h = SH) {
  if (!BLOOM_OK || !alpha || G.quality < 1) return;
  const bw = bloomC.width, bh = Math.round(bw * h / W);
  if (bloomC.height !== bh) bloomC.height = bh;
  bloomG.globalCompositeOperation = 'copy';
  bloomG.filter = 'brightness(0.7) contrast(3) saturate(1.3) blur(3px)';
  bloomG.drawImage(cv, 0, 0, cv.width, Math.round(cv.height * h / H), 0, 0, bw, bh);
  bloomG.filter = 'none';
  cx.save(); cx.globalCompositeOperation = 'screen'; cx.globalAlpha = alpha; cx.drawImage(bloomC, 0, 0, W, h); cx.restore();
}

// Figuren im HD-Modus: erst in einen Puffer zeichnen, dann Licht-/Schattenseite, Bodenschatten und Randlicht auftragen
const actBuf = document.createElement('canvas'), actG = actBuf.getContext('2d');
const rimBuf = document.createElement('canvas'), rimG = rimBuf.getContext('2d');
function drawActorLit(a, sc, lt, refl) {
  const bs = Math.min(VS * DPR, G.quality < 1 ? 1.5 : 3), k = sc * bs, top = a.h + 90, bot = 30, fade = a.h * 0.55;
  const pw = Math.ceil(270 * k), ph = Math.ceil((top + bot) * k), need = Math.ceil((top + Math.max(bot, fade)) * k);
  if (actBuf.width < pw || actBuf.height < need) { actBuf.width = rimBuf.width = Math.max(actBuf.width, pw); actBuf.height = rimBuf.height = Math.max(actBuf.height, need); }
  const g = actG, ox = pw / 2, oy = top * k, [side, key, fill] = lt;
  // im Stand atmen die Figuren ganz leicht
  const br = a.walking ? 0 : Math.sin(G.t * 0.0024 + (a.seed || 0) * 3) * 0.007;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, pw, ph);
  g.setTransform(k * (a.dir < 0 ? -1 : 1) * (1 - br * 0.5) * (a._turn || 1), 0, 0, k * (1 + br), ox, oy);
  CHAR[a.kind](g, a, G.t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  const half = (a.bw || 50) * 1.4 * k, hg = g.createLinearGradient(ox + side * half, 0, ox - side * half, 0);
  hg.addColorStop(0, hexA(key, 0.26)); hg.addColorStop(0.42, hexA(key, 0)); hg.addColorStop(0.58, hexA(fill, 0)); hg.addColorStop(1, hexA(fill, 0.42));
  g.fillStyle = hg; g.fillRect(0, 0, pw, ph);
  const vg = g.createLinearGradient(0, oy - a.h * k, 0, oy);
  vg.addColorStop(0, hexA(key, 0.12)); vg.addColorStop(0.3, hexA(key, 0)); vg.addColorStop(0.8, 'rgba(10,0,24,0)'); vg.addColorStop(1, 'rgba(10,0,24,0.28)');
  g.fillStyle = vg; g.fillRect(0, 0, pw, ph);
  if (G.quality >= 1) {
    // Silhouette minus leicht verschobene Silhouette = die Kante, die zur Lichtquelle zeigt
    const r = rimG, d = Math.max(2, 5.5 * k);
    r.setTransform(1, 0, 0, 1, 0, 0); r.globalCompositeOperation = 'source-over'; r.clearRect(0, 0, pw, ph);
    r.drawImage(actBuf, 0, 0, pw, ph, 0, 0, pw, ph);
    r.globalCompositeOperation = 'source-in'; r.fillStyle = key; r.fillRect(0, 0, pw, ph);
    r.globalCompositeOperation = 'destination-out'; r.drawImage(actBuf, 0, 0, pw, ph, -side * d, d * 0.7, pw, ph);
    g.globalAlpha = 0.42; g.drawImage(rimBuf, 0, 0, pw, ph, 0, 0, pw, ph); g.globalAlpha = 1;
    // Maltextur auf die Figur (auf die Silhouette begrenzt)
    r.setTransform(1, 0, 0, 1, 0, 0); r.globalCompositeOperation = 'source-over'; r.clearRect(0, 0, pw, ph);
    const pat = r.createPattern(paperCanvas(), 'repeat'); if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(0.7 * bs));
    r.fillStyle = pat; r.fillRect(0, 0, pw, ph);
    r.globalCompositeOperation = 'destination-in'; r.drawImage(actBuf, 0, 0, pw, ph, 0, 0, pw, ph);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.28; g.drawImage(rimBuf, 0, 0, pw, ph, 0, 0, pw, ph); g.globalAlpha = 1;
  }
  g.globalCompositeOperation = 'source-over';
  if (refl) {
    // Spiegelbild: an der Fußlinie gespiegelt und nach unten ausgeblendet
    const r = rimG, fh = Math.ceil(fade * k);
    r.setTransform(1, 0, 0, 1, 0, 0); r.globalCompositeOperation = 'source-over'; r.clearRect(0, 0, pw, oy + fh);
    r.setTransform(1, 0, 0, -1, 0, 2 * oy); r.drawImage(actBuf, 0, 0, pw, ph, 0, 0, pw, ph);
    r.setTransform(1, 0, 0, 1, 0, 0); r.globalCompositeOperation = 'destination-in';
    const fg = r.createLinearGradient(0, oy, 0, oy + fh); fg.addColorStop(0, 'rgba(0,0,0,1)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
    r.fillStyle = fg; r.fillRect(0, oy, pw, fh); r.globalCompositeOperation = 'source-over';
    cx.save(); cx.globalAlpha = refl; cx.drawImage(rimBuf, 0, oy, pw, fh, a.x - ox / bs, a.y + 1, pw / bs, fh / bs); cx.restore();
  }
  cx.drawImage(actBuf, 0, 0, pw, ph, a.x - ox / bs, a.y - oy / bs, pw / bs, ph / bs);
}

// Leben am Himmel: Vogelschwärme über dem Garten 1776, Schwebeautos über dem Zukunftsgarten
const sky = { list: [], next: 0, room: null };
function updateSky(dt) {
  const kind = G.screen === 'game' && G.state ? roomFx().sky : null, vr = G.state ? viewRoomId() : null;
  if (sky.room !== vr) { sky.room = vr; sky.list = []; sky.next = G.t + 1500; }
  if (!kind) return;
  if (G.t >= sky.next) {
    const dir = Math.random() < 0.5 ? 1 : -1, y = 26 + Math.random() * 70;
    if (kind === 'birds') {
      const n = 3 + Math.floor(Math.random() * 4);
      sky.list.push({ kind, dir, x: dir > 0 ? -60 : W + 60, y, v: 55 + Math.random() * 25, n, seed: Math.random() * 9 });
      sky.next = G.t + 9000 + Math.random() * 9000;
    } else {
      const col = pick(['#ffd23a', '#7fe8ff', '#ff7ad9', '#a6ff8f']);
      sky.list.push({ kind, dir, x: dir > 0 ? -50 : W + 50, y, v: 260 + Math.random() * 180, col, seed: Math.random() * 9 });
      Sound.sfx('whoosh', dir > 0 ? -0.6 : 0.6);
      sky.next = G.t + 4500 + Math.random() * 6000;
    }
  }
  for (let i = sky.list.length - 1; i >= 0; i--) { const o = sky.list[i]; o.x += o.dir * o.v * dt / 1000; if (o.x < -120 || o.x > W + 120) sky.list.splice(i, 1); }
}
function drawSky() {
  for (const o of sky.list) {
    if (o.kind === 'birds') {
      for (let i = 0; i < o.n; i++) {
        const bx = o.x - o.dir * (Math.abs(i - (o.n - 1) / 2) * 16 + i * 2), by = o.y + Math.abs(i - (o.n - 1) / 2) * 9 + Math.sin(G.t * 0.004 + i) * 2;
        const f = Math.sin(G.t * 0.018 + i * 1.3 + o.seed) * 4;
        L(cx, [bx - 7, by - f, bx - 2, by, bx, by - 1, bx + 2, by, bx + 7, by - f], 2, '#3a2a3a');
      }
    } else {
      const x = o.x, y = o.y + Math.sin(G.t * 0.003 + o.seed) * 3;
      if (!cx.isPix) {   // Lichtspur
        const tg = cx.createLinearGradient(x - o.dir * 90, y, x, y); tg.addColorStop(0, hexA(o.col, 0)); tg.addColorStop(1, hexA(o.col, 0.55));
        cx.save(); cx.globalCompositeOperation = 'lighter'; cx.strokeStyle = tg; cx.lineWidth = 3; cx.lineCap = 'round';
        cx.beginPath(); cx.moveTo(x - o.dir * 90, y + 3); cx.lineTo(x - o.dir * 10, y + 3); cx.stroke(); cx.restore();
      }
      R(cx, x - 16, y - 5, 32, 11, '#4a2a7a', 2, 5); E(cx, x + o.dir * 3, y - 6, 9, 6, '#bfe8ff', 1.5);
      E(cx, x + o.dir * 15, y + 1, 3, 2.5, o.col, 0); E(cx, x - 10, y + 7, 4, 1.5, hexA(o.col, 0.8), 0);
    }
  }
}
// Hotspot-Funkeln: ab und zu blitzt etwas auf, das man noch nicht angeschaut hat
const glint = { next: 0, at: null, t0: 0 };
function updateGlint() {
  if (G.screen !== 'game' || !G.state || G.busy || G.dialog || G.menu || G.inIntro) return;
  if (G.t < glint.next) return;
  glint.next = G.t + 4500 + Math.random() * 3500;
  const room = ROOMS[viewRoomId()];
  const cand = room.objs.filter(o => isVisible(o) && !o.exit && !G.state.looked['o:' + o.id] && o.rect[2] < 400);
  if (!cand.length) { glint.at = null; return; }
  const o = pick(cand), [x, y, w, h] = o.rect;
  glint.at = [x + w * (0.2 + Math.random() * 0.6), y + Math.min(h, 120) * (0.15 + Math.random() * 0.4)]; glint.t0 = G.t;
}
function drawGlint() {
  if (!glint.at) return;
  const k = (G.t - glint.t0) / 700; if (k < 0 || k > 1) return;
  const [x, y] = glint.at, a = Math.sin(k * Math.PI), r = 3 + a * 9;
  cx.save(); cx.globalAlpha = a * 0.9;
  if (!cx.isPix) { const g = cx.createRadialGradient(x, y, 0, x, y, r * 1.6); g.addColorStop(0, 'rgba(255,250,220,0.55)'); g.addColorStop(1, 'rgba(255,250,220,0)'); cx.fillStyle = g; cx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4); }
  cx.translate(x, y); cx.rotate(k * 1.2);
  L(cx, [-r, 0, r, 0], 2, '#fffbe6'); L(cx, [0, -r, 0, r], 2, '#fffbe6'); L(cx, [-r * 0.45, -r * 0.45, r * 0.45, r * 0.45], 1.2, '#fffbe6'); L(cx, [-r * 0.45, r * 0.45, r * 0.45, -r * 0.45], 1.2, '#fffbe6');
  cx.restore();
}
// kleines Verb-Symbol am Zeiger: zeigt, was ein Rechtsklick tun würde
function verbBadge(x, y, v) {
  const bx = x + 16, by = y + 16;
  E(cx, bx, by, 11, 11, '#241539', 2, 0, '#ffe066');
  cx.save(); cx.translate(bx, by);
  if (v === 'look') { E(cx, 0, 0, 7, 4.5, '#ffffff', 1.5, 0, '#ffe066'); E(cx, 0, 0, 2.5, 2.5, '#241539', 0); }
  else if (v === 'talk') { R(cx, -6.5, -5, 13, 8, '#ffffff', 1.5, 3, '#ffe066'); P(cx, [-2, 3, -4.5, 7, 2, 3], '#ffffff', 0); }
  else if (v === 'walk') { L(cx, [-5, 0, 5, 0], 2.2, '#ffe066'); L(cx, [1, -4, 5, 0, 1, 4], 2.2, '#ffe066'); }
  else { E(cx, 0, 1.5, 4.5, 4, '#ffd8b0', 1.5, 0, '#ffe066'); R(cx, -4, -6, 2.4, 6, '#ffd8b0', 1, 1, '#ffe066'); R(cx, -1.2, -7, 2.4, 7, '#ffd8b0', 1, 1, '#ffe066'); R(cx, 1.6, -6, 2.4, 6, '#ffd8b0', 1, 1, '#ffe066'); }
  cx.restore();
}

// Vordergrund-Gräser an den Bildrändern (Tiefenwirkung im Freien), wiegen sich im Wind
function drawForeground(fg) {
  const t = G.t * 0.0018;
  for (let i = 0; i < 46; i++) {
    const side = i % 2, k = (i * 0.618) % 1, x = side ? W - 6 - k * 150 : 6 + k * 150, x2 = i % 7 === 0 ? 220 + ((i * 97) % 520) : x;
    const h = (i % 7 === 0 ? 10 : 16) + ((i * 37) % 22), lean = Math.sin(t + x2 * 0.03) * 5 + (side ? -2 : 2);
    S(cx, fg[i % 2], 0, () => { cx.moveTo(x2 - 3.5, SH + 2); cx.quadraticCurveTo(x2 + lean * 0.4, SH - h * 0.6, x2 + lean, SH - h); cx.quadraticCurveTo(x2 + lean * 0.3 + 1, SH - h * 0.5, x2 + 3.5, SH + 2); cx.closePath(); });
  }
}

// Dialog-Kamera: bei Gesprächen zoomt die Szene sanft auf die Gesprächspartner
function updateCam(dt) {
  const c = G.cam; let z = 1, fx = c.x, fy = c.y;
  if (G.dialog && G.screen === 'game' && G.state && !G.menu) {
    const p = me(), room = ROOMS[viewRoomId()];
    if (p.room === room.id) {
      const npc = Object.values(ACT).filter(a => a.room === room.id && a.visible && a.id !== p.id).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
      fx = npc ? (p.x + npc.x) / 2 : p.x; fy = p.y - p.h * roomScale(room, p.y) * 0.62; z = 1.07;
    }
  }
  const k = Math.min(1, dt * 0.004);
  c.z += (z - c.z) * k; c.x += (fx - c.x) * k; c.y += (fy - c.y) * k;
}
function camApply() { const c = G.cam; if (c.z > 1.001) { cx.translate(c.x, c.y); cx.scale(c.z, c.z); cx.translate(-c.x, -c.y); } }

// ---------- Chrono-Kristalle: in jedem Raum (außer dem Thronsaal) liegt einer versteckt ----------
const CRYSTAL_ROOMS = ['labor', 'lobby', 'gasthaus', 'garten1776', 'fgarten', 'vorraum'];
const CRYSTAL_COL = { present: '#7fe8ff', past: '#ffc46a', future: '#d79bff' };
const crystalPos = {};
function crystalAt(id) {
  if (crystalPos[id]) return crystalPos[id];
  const room = ROOMS[id]; if (!room || !room.walk) return null;
  let seed = 0; for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const xs = room.walk.map(p => p[0]), ys = room.walk.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  let best = [(x0 + x1) / 2, (y0 + y1) / 2];
  for (let i = 0; i < 400; i++) {
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
    // genug Abstand zum Rand der Lauffläche und nicht hinter einer Figur versteckt
    const free = Object.values(START_POS).every(sp => sp.room !== id || Math.hypot(sp.x - x, (sp.y - y) * 1.5) > 95);
    if (free && [[0, 0], [24, 0], [-24, 0], [0, 14], [0, -14]].every(([dx, dy]) => inPoly(x + dx, y + dy, room.walk))) { best = [x, y]; break; }
  }
  return (crystalPos[id] = best);
}
function crystalCount() { return CRYSTAL_ROOMS.filter(r => G.state.crystals[r]).length; }
function updateCrystals() {
  if (G.screen !== 'game' || !G.state || G.inIntro) return;
  const p = me(), id = p.room;
  if (!CRYSTAL_ROOMS.includes(id) || G.state.crystals[id] || id !== viewRoomId()) return;
  const c = crystalAt(id); if (!c || Math.hypot(p.x - c[0], (p.y - c[1]) * 1.6) > 28) return;
  G.state.crystals[id] = Date.now();
  Sound.sfx('crystal', panX(c[0])); rumble(120, 0.1, 0.5);
  puff(c[0], c[1] - 14, CRYSTAL_COL[ROOMS[id].era] || '#ffffff', 12, { vy: 70, vx: 140, r: 2.4, max: 700, spread: 10 });
  const n = crystalCount();
  note(n === CRYSTAL_ROOMS.length ? 'Alle Chrono-Kristalle gefunden!' : `Chrono-Kristall gefunden! (${n}/${CRYSTAL_ROOMS.length})`);
  if (n === CRYSTAL_ROOMS.length) unlock('kristalle');
  save();
}
function drawCrystal(room) {
  if (!G.state || G.inIntro || !CRYSTAL_ROOMS.includes(room.id) || G.state.crystals[room.id]) return;
  const c = crystalAt(room.id); if (!c) return;
  const col = CRYSTAL_COL[room.era] || '#ffffff', bob = Math.sin(G.t * 0.004) * 3, x = c[0], y = c[1] - 16 + bob;
  cx.globalAlpha = 0.25; E(cx, x, c[1], 9, 3, '#000000', 0); cx.globalAlpha = 1;
  glow(x, y, 26, col, 0.55);
  P(cx, [x, y - 11, x + 7, y - 2, x, y + 10, x - 7, y - 2], col, 2.5);
  P(cx, [x, y - 11, x + 7, y - 2, x, y - 1], 'rgba(255,255,255,0.55)', 0);
  const tw = Math.sin(G.t * 0.007);
  if (tw > 0.3) { const sx = x + 6, sy = y - 9, r = 2 + tw * 3; L(cx, [sx - r, sy, sx + r, sy], 1.5, '#ffffff'); L(cx, [sx, sy - r, sx, sy + r], 1.5, '#ffffff'); }
}

// Foto-Taste: aktuelles Bild als PNG speichern
const ALBUM_KEY = 'tentakel-toast-fotos-v1', ALBUM_MAX = 12, albumImgs = [];
function albumList() { try { return JSON.parse(localStorage.getItem(ALBUM_KEY) || '[]') || []; } catch (e) { return []; } }
function albumAdd() {
  try {
    const c = document.createElement('canvas'); c.width = 384; c.height = 240;
    c.getContext('2d').drawImage(cv, 0, 0, c.width, c.height);
    const list = albumList(); list.unshift({ src: c.toDataURL('image/jpeg', 0.72), at: Date.now(), room: G.state ? viewRoomId() : G.screen });
    while (list.length > ALBUM_MAX) list.pop();
    localStorage.setItem(ALBUM_KEY, JSON.stringify(list)); albumImgs.length = 0;
  } catch (e) { /* Speicher voll oder gesperrt */ }
}
function albumImage(i, src) { let im = albumImgs[i]; if (!im) { im = albumImgs[i] = new Image(); im.src = src; } return im; }
function takePhoto() {
  if (!cv.toBlob) return;
  G.photoFlash = G.t; Sound.sfx('photo');
  albumAdd();
  cv.toBlob(b => {
    if (!b) return;
    const a = document.createElement('a'); a.href = URL.createObjectURL(b);
    a.download = `tentakel-toast-foto-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png');
}

// ---------- Nebenbei-Sprüche: NPCs murmeln vor sich hin, gelangweilte Spielfiguren melden sich ----------
function startBark(id, text) {
  const a = ACT[id];
  G.bark = { a, text, start: G.t, until: G.t + Math.max(2200, 1000 + text.length * 55), babbleEnd: G.t + Math.min(1800, text.length * 40) };
  a.talking = true;
}
function endBark() { const b = G.bark; if (!b) return; G.bark = null; if (!G.speech || G.speech.a !== b.a) b.a.talking = false; }
function updateBarks() {
  if (G.screen !== 'game' || !G.state || G.fast) { endBark(); return; }
  const b = G.bark;
  if (b && (G.t >= b.until || G.speech || G.busy || G.dialog || b.a.room !== viewRoomId())) endBark();
  else if (b && G.settings.babble && !Voice.on && G.t < b.babbleEnd && G.t >= G.nextBlip) { Sound.blip(b.a.voice, panOf(b.a)); G.nextBlip = G.t + 90 + Math.random() * 70; }
  if (G.mouse.x !== G.lastMx || G.mouse.y !== G.lastMy || G.busy || G.speech || G.dialog || G.menu) { G.lastMx = G.mouse.x; G.lastMy = G.mouse.y; G.idleSince = G.t; }
  const calm = !G.busy && !G.speech && !G.dialog && !G.menu && !G.inIntro && G.fade === 0 && !G.bark && !me().walking;
  if (!calm) { G.barkNext = Math.max(G.barkNext, G.t + 5000); return; }
  const p = me();
  if (G.t - G.idleSince > 40000 && p.visible && IDLE[p.id]) { G.idleSince = G.t; startBark(p.id, pick(IDLE[p.id])); return; }
  if (G.t < G.barkNext) return;
  G.barkNext = G.t + 11000 + Math.random() * 9000;
  const npcs = NPCS.filter(id => ACT[id].room === viewRoomId() && ACT[id].visible && BARKS[id]);
  if (npcs.length) { const id = pick(npcs); startBark(id, pick(G.settings.party && PARTY_BARKS[id] && Math.random() < 0.6 ? PARTY_BARKS[id] : BARKS[id])); }
}
function drawBark() {
  const b = G.bark; if (!b || G.speech) return;
  const room = ROOMS[viewRoomId()], a = b.a; if (a.room !== room.id) return;
  const sc = roomScale(room, a.y) * (a.scaleMul || 1);
  cx.font = '700 17px "Baloo 2", system-ui, sans-serif';
  const lines = wrap(b.text, 300), lh = 19, maxW = Math.max(...lines.map(l => cx.measureText(l).width));
  const x = Math.max(maxW / 2 + 12, Math.min(W - maxW / 2 - 12, a.x)), y = Math.max(lines.length * lh + 4, a.y - a.h * sc - 10);
  cx.save(); cx.globalAlpha = Math.max(0, Math.min(1, (b.until - G.t) / 300, (G.t - b.start) / 200)) * 0.92;
  cx.textAlign = 'center'; cx.textBaseline = 'alphabetic'; cx.lineJoin = 'round';
  lines.forEach((l, i) => { const ly = y - (lines.length - 1 - i) * lh; cx.lineWidth = 4; cx.strokeStyle = '#0b0610'; cx.strokeText(l, x, ly); cx.fillStyle = a.color; cx.fillText(l, x, ly); });
  cx.restore();
}

// ---------- Vollbild ----------
const fsAvailable = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
function isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
function lockLandscape() { try { if (G.pointer === 'touch' && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* nicht unterstützt */ } }
function enterFullscreen() {
  const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req || isFullscreen()) return;
  try { const p = req.call(el, { navigationUI: 'hide' }); if (p && p.then) p.then(lockLandscape).catch(() => {}); else lockLandscape(); } catch (e) { /* abgelehnt */ }
}
function exitFullscreen() { const ex = document.exitFullscreen || document.webkitExitFullscreen; if (ex && isFullscreen()) try { ex.call(document); } catch (e) { /* ok */ } }
function toggleFullscreen() { if (isFullscreen()) exitFullscreen(); else enterFullscreen(); }
function firstInteraction() {
  Sound.init();
  if (G.settings.fullscreen && !G.fsTried) { G.fsTried = true; enterFullscreen(); }
}

// ---------- Größe & Skalierung ----------
const bgCache = {};
function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  VS = Math.max(0.2, Math.min(vw / W, vh / H));
  DPR = Math.min(window.devicePixelRatio || 1, G.quality < 1 ? 1.3 : 2);
  cv.style.width = Math.floor(W * VS) + 'px'; cv.style.height = Math.floor(H * VS) + 'px';
  cv.width = Math.round(W * VS * DPR); cv.height = Math.round(H * VS * DPR);
  for (const k in bgCache) delete bgCache[k];
}
function roomScale(room, y) { const k = Math.max(0, Math.min(1, (y - room.yTop) / (room.yBot - room.yTop))); return room.sMin + (room.sMax - room.sMin) * k; }
function inPoly(x, y, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins;
  }
  return ins;
}
function clampWalk(room, x, y) {
  const poly = room.walk; if (inPoly(x, y, poly)) return [x, y];
  let best = [x, y], bd = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    const px = ax + dx * t, py = ay + dy * t, d = (px - x) ** 2 + (py - y) ** 2;
    if (d < bd) { bd = d; best = [px, py]; }
  }
  const cxp = poly.reduce((s, p) => s + p[0], 0) / poly.length, cyp = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  const dl = Math.hypot(cxp - best[0], cyp - best[1]) || 1;
  return [best[0] + (cxp - best[0]) / dl * 3, best[1] + (cyp - best[1]) / dl * 3];
}

// ---------- Laufen ----------
function walkTo(a, x, y, noClamp) {
  if (typeof a === 'string') a = ACT[a];
  if (!noClamp) [x, y] = clampWalk(ROOMS[a.room], x, y);
  if (a._res) { const r = a._res; a._res = null; r(false); }
  a.run = false;
  if (G.fast || G.skipAll) { if (Math.abs(x - a.x) > 1) a.dir = x > a.x ? 1 : -1; a.x = x; a.y = y; a.target = null; a.walking = false; return Promise.resolve(true); }
  if (Math.hypot(x - a.x, y - a.y) < 2) { a.target = null; a.walking = false; return Promise.resolve(true); }
  return new Promise(res => { a.target = [x, y]; a._res = res; });
}
function updateActors(dt) {
  const view = G.state ? viewRoomId() : null;
  for (const a of Object.values(ACT)) {
    if (!a.target) continue;
    const room = ROOMS[a.room]; const sc = room ? roomScale(room, a.climbY != null ? a.climbY : a.y) : 1;
    const [tx, ty] = a.target, dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
    const sp = (a.speed || 170) * (a.run ? 2.6 : 1) * sc * dt / 1000;
    if (Math.abs(dx) > 2) a.dir = dx > 0 ? 1 : -1;
    if (d <= sp) {
      a.x = tx; a.y = ty; a.target = null; a.walking = false; a.run = false;
      const r = a._res; a._res = null; if (r) r(true);
    } else {
      a.x += dx / d * sp; a.y += dy / d * sp; a.walking = true;
      const before = Math.floor((a.phase || 0) / Math.PI);
      a.phase = (a.phase || 0) + dt * (a.run ? 0.02 : 0.011);
      if (Math.floor(a.phase / Math.PI) !== before && G.state && a.id === curId()) G.state.stats.steps = (G.state.stats.steps || 0) + 1;
      if (Math.floor(a.phase / Math.PI) !== before && a.room === view && room && a.climb) {
        Sound.sfx('rustle', panX(a.x));   // Klettern: Blätter rascheln und rieseln herab
        puff(a.x + (Math.random() - 0.5) * 30, a.y - a.h * roomScale(room, a.climbY) * 0.5, pick(['#6ac26a', '#4f9a4a', '#9ad86a']), 2, { vy: -10, vx: 30, r: 3, max: 900, spread: 30 });
      } else if (Math.floor(a.phase / Math.PI) !== before && a.room === view && room) {
        Sound.step(room.floor, panX(a.x), (a.bw || 50) / 55, rainFx.on);
        puff(a.x, a.y, DUST[room.floor] || '#b0a8a0', 2, { vy: 10, r: 2.4, max: 420, spread: 18 });
      }
    }
  }
}
// Aktions-Pose starten (wird von draw.js gezeichnet); beim Graben fliegt Erde
function act(id, kind, dur) { const a = ACT[id]; if (a && !G.fast) a.pose = { kind, t0: G.t, dur, puff: 0 }; }
function updatePoses() {
  const view = G.state ? viewRoomId() : null;
  for (const a of Object.values(ACT)) {
    const p = a.pose; if (!p) continue;
    if (G.t - p.t0 > p.dur) { a.pose = null; continue; }
    if (p.kind === 'dig' && a.room === view && G.t - p.puff > 260) { p.puff = G.t; puff(a.x + a.dir * 34, a.y - 4, '#6a4a2a', 4, { vy: 60, vx: 70, r: 3.2, max: 650, spread: 14 }); }
    if (p.kind === 'pour' && a.room === view && G.t - p.puff > 120) { p.puff = G.t; puff(a.x + a.dir * 44, a.y - 40, '#8ac8ff', 2, { vy: -30, vx: 20, r: 2.4, max: 500, spread: 8 }); }
  }
}
function walkPoint(key) {
  const [k, id] = key.split(':');
  if (k === 'o') { const o = OBJ[id]; const w = typeof o.walk === 'function' ? o.walk() : o.walk; return w || [o.rect[0] + o.rect[2] / 2, o.rect[1] + o.rect[3] + 10]; }
  const a = ACT[id], p = me(), side = p.x < a.x ? -1 : 1;
  return [a.x + side * (a.talkDist || 82), a.y + 6];
}
function faceTarget(key) {
  const [k, id] = key.split(':'), p = me();
  let fx;
  if (k === 'o') { const o = OBJ[id]; if (o.face) { p.dir = o.face; return; } fx = o.rect[0] + o.rect[2] / 2; }
  else if (k === 'a') { fx = ACT[id].x; const a = ACT[id]; if (!a.fixedDir && a.id !== curId()) a.dir = p.x > a.x ? 1 : -1; }
  if (fx !== undefined && Math.abs(fx - p.x) > 6) p.dir = fx > p.x ? 1 : -1;
}

// ---------- Sprechen ----------
function say(id, text) {
  if (G.fast || G.skipAll) return Promise.resolve();
  return new Promise(res => {
    const a = id ? ACT[id] : null;
    const base = Math.max(1500, 800 + text.length * 58) * ({ langsam: 1.45, schnell: 0.7 }[G.settings.textSpeed] || 1);
    const sp = { a, text, start: G.t, end: G.t + base, res };
    sp.babble = !!(a && a.voice && G.settings.babble && !Voice.on);
    sp.babbleEnd = G.t + Math.min(base - 300, text.length * 46);
    G.speech = sp; if (a) a.talking = true;
    Sound.duck(true);
    if (Voice.on) {
      sp.end = G.t + base * 3 + 3000;
      Voice.speak(text, a ? a.voice : { pitch: 1, rate: 1.05 }).then(() => { if (G.speech === sp) sp.end = Math.min(sp.end, G.t + 250); });
    }
  });
}
function finishSpeech() { const sp = G.speech; if (!sp) return; G.speech = null; if (sp.a) sp.a.talking = false; Sound.duck(false); sp.res(); }
function skipSpeech() { if (!G.speech || G.t - G.speech.start < 160) return; Voice.stop(); finishSpeech(); }
function choose(opts) {
  G.skipAll = false;
  const list = opts.filter(Boolean);
  if (G.fast && G.autoChoose) return Promise.resolve(G.autoChoose(list));
  return new Promise(res => {
    G.dialog = { opts: list, res };
    if (G.pointer === 'pad') { G.mouse.x = 60; G.mouse.y = 484; }
  });
}
function fadeTo(v, ms = 220, mode) {
  if (mode) G.fadeMode = mode;
  if (G.fast || G.skipAll) { G.fade = v; return Promise.resolve(); }
  return new Promise(res => { if (G.fadeRes) G.fadeRes(); G.fadeFrom = G.fade; G.fadeTarget = v; G.fadeStart = G.t; G.fadeDur = ms; G.fadeRes = res; });
}
function irisAt(a) { const room = ROOMS[a.room]; G.irisX = a.x; G.irisY = a.y - a.h * roomScale(room, a.y) * 0.55; }

// ---------- Räume, Figuren, Zeitreise-Post ----------
function music() {
  if (G.screen === 'rock') return Sound.play('rock');
  if (G.screen === 'toaster') return Sound.play('lounge');
  if (G.screen === 'title' || G.screen === 'end') { Sound.ambience(G.screen === 'title' ? ['crickets', 'wind', 'owl'] : []); Sound.setReverb(1.4, 0.14); return Sound.play(G.screen === 'title' ? 'title' : 'ending'); }
  const r = ROOMS[viewRoomId()], fx = ROOM_FX[r.id] || {};
  Sound.play(fx.music || r.theme || ERA[r.era].theme);
  Sound.ambience(roomAmb());
  if (fx.verb) Sound.setReverb(fx.verb[0], fx.verb[1]);
  Sound.setIntensity(progress() / MILESTONES.length);
}
async function goRoom(id, roomId, x, y, dir = 1) {
  const a = ACT[id], view = id === curId();
  if (view) { irisAt(a); await fadeTo(1, 280, 'iris'); }
  a.room = roomId; a.x = x; a.y = y; a.dir = dir; a.target = null; a.walking = false;
  if (PLAYERS.includes(id) && G.state) markVisit(roomId);
  if (view) {
    G.first = null; G.parts.length = 0; G.ripples.length = 0; music(); irisAt(a); await fadeTo(0, 320, 'iris');
    showSign(roomId);
    const r = ROOMS[roomId]; if (r.onEnter) await r.onEnter();
  }
}
async function switchChar(ch) {
  if (G.busy || ch === curId() || G.screen !== 'game') return;
  ++actToken;
  const old = me(); if (old._res) { const r = old._res; old._res = null; r(false); } old.target = null; old.walking = false;
  G.busy++;
  try {
    G.verb = null; G.first = null;
    G.warpLabel = `${ACT[ch].name} · ${ERA[HOME_ERA[ch]].label}`; G.warpCol = ERA[HOME_ERA[ch]].col;
    Sound.sfx('warp');
    await fadeTo(1, 330, 'warp');
    G.state.cur = ch; G.parts.length = 0; G.ripples.length = 0; music();
    await wait(260);
    await fadeTo(0, 330, 'warp');
    showSign(me().room);
    if (ARRIVALS[ch] && !fl()['arr_' + ch]) { fl()['arr_' + ch] = true; await ARRIVALS[ch](); }
  } finally { G.busy--; if (!G.busy) G.skipAll = false; }
  save();
}
function cycleChar(d) { const i = PLAYERS.indexOf(curId()); switchChar(PLAYERS[(i + d + PLAYERS.length) % PLAYERS.length]); }
async function sendItem(item, to) {
  const from = curId();
  if (to === from) return say(from, 'Das hab ich doch schon.');
  const it = ITEMS[item];
  if (it.nosend) return say(from, it.nosend);
  // Klo-Schnellversand: ohne Klo im Raum geht's kurz zum Klo der eigenen Zeit und danach zurück
  let room = ROOMS[me().room], back = null;
  if (!room.klo) {
    const kr = kloRoomOf(from); if (!kr) return say(from, KLO_NEEDED[from]);
    const a = me(), kw = OBJ[kr.klo].walk; back = [a.room, a.x, a.y, a.dir];
    await goRoom(from, kr.id, kw[0], kw[1], OBJ[kr.klo].face || a.dir);
    room = kr;
  }
  const k = OBJ[room.klo];
  await walkTo(me(), k.walk[0], k.walk[1]);
  Sound.sfx('flush', panX(me().x)); G.kloAnim = { obj: room.klo, t: G.t }; shake(700, 2.5);
  { const [kx, ky, kw, kh] = k.rect; G.sendFx = { item, to, room: room.id, x: kx + kw / 2, y: ky + Math.min(kh, 200) * 0.45, h: Math.min(kh, 200), t0: G.t, col: ERA[HOME_ERA[to]].col }; }
  takeItem(item, from); addItem(item, to, true);
  G.flash[to] = G.t;
  G.state.stats.sent++; unlock('post');
  await wait(1000);
  Sound.sfx('sparkle');
  note(`${it.name} ist bei ${ACT[to].name} (${ERA[HOME_ERA[to]].label}) angekommen.`);
  const hook = SEND_LINES[item];
  await say(from, hook ? hook(to) : pick([`Ab durch die Zeit, ${ACT[to].name}!`, 'Gute Reise!', `Post für ${ACT[to].name}! Per Klo-Express.`]));
  if (back) await goRoom(from, ...back);
}
function kloRoomOf(c) { return Object.values(ROOMS).find(r => r.klo && r.era === HOME_ERA[c]); }
// Taste K / Klo-Knopf / Stick-Klick: ausgewählten Gegenstand verschicken oder Auswahl starten
async function quickKlo() {
  if (G.screen !== 'game' || G.busy || G.dialog || G.menu || G.inIntro) return;
  const sel = G.first && G.first[0] === 'i' ? G.first.slice(2) : null;
  if (!sel) {
    if (!inv().some(i => !ITEMS[i].nosend)) { note('Klo-Post: Nichts zum Verschicken dabei.'); return; }
    G.verb = 'give'; G.first = null; Sound.sfx('click');
    note('Klo-Post: Gegenstand wählen, dann ein Gesicht unten rechts');
    return;
  }
  const others = PLAYERS.filter(c => c !== curId());
  G.first = null; G.verb = null;
  G.busy++;
  try {
    const to = await choose([...others.map(o => ({ id: o, text: `${ITEMS[sel].name} an ${ACT[o].name} schicken (${ERA[HOME_ERA[o]].label})` })), { id: 'no', text: 'Lieber doch nicht.' }]);
    if (to !== 'no') await sendItem(sel, to);
  } catch (e) { console.error(e); }
  finally { G.busy--; if (!G.busy) G.skipAll = false; }
  save();
}
async function useWithKlo(item) {
  const others = PLAYERS.filter(c => c !== curId());
  const c = await choose([...others.map(o => ({ id: o, text: `An ${ACT[o].name} schicken (${ERA[HOME_ERA[o]].label})` })), { id: 'no', text: 'Lieber doch nicht.' }]);
  if (c === 'no') return;
  return sendItem(item, c);
}

// ---------- Erfolge ----------
function loadAch() { try { G.ach = JSON.parse(localStorage.getItem(ACH_KEY) || '{}') || {}; } catch (e) { G.ach = {}; } }
function saveAch() { try { localStorage.setItem(ACH_KEY, JSON.stringify(G.ach)); } catch (e) { /* ok */ } }
function unlock(id) {
  if (G.ach[id]) return;
  const a = ACH.find(x => x.id === id); if (!a) return;
  G.ach[id] = Date.now(); saveAch();
  G.achToast = { a, until: G.t + 4200 };
  Sound.sfx('achieve');
}
function achCount() { return ACH.filter(a => G.ach[a.id]).length; }

// ---------- Satzbau & Ausführung ----------
let actToken = 0;
function defaultVerb(key) {
  if (!key) return null;
  const [k, id] = key.split(':');
  if (k === 'a') return ACT[id].dv || 'talk';
  if (k === 'o') { const o = OBJ[id]; return o.exit ? 'walk' : (o.dv || 'look'); }
  if (k === 'i') return 'look';
  return null;
}
function sentence() {
  const v = VERB_LABEL[G.verb || 'walk'];
  if (G.first) {
    let s = `${v} ${nameOf(G.first)} ${G.verb === 'give' ? 'an' : 'mit'}`;
    if (G.hover && G.hover !== G.first) s += ' ' + nameOf(G.hover);
    return s;
  }
  return G.hover ? `${v} ${nameOf(G.hover)}` : v;
}
async function runSentence(v, a, b) {
  if (G.busy || G.screen !== 'game') return;
  const tok = ++actToken;
  const tgt = [b, a].find(k => k && (k[0] === 'o' || k[0] === 'a'));
  if (tgt && v !== 'look') {
    const [x, y] = walkPoint(tgt);
    const ok = await walkTo(me(), x, y);
    if (!ok || tok !== actToken) return;
  }
  if (tgt) faceTarget(tgt);
  // bei jeder Handlung bewegt sich die Figur: greifen, ziehen oder in die Hocke zum Aufheben
  if (tgt && v !== 'look' && v !== 'talk' && v !== 'walk') act(curId(), v === 'pick' ? 'pick' : v === 'pull' ? 'pull' : 'reach', v === 'pick' ? 650 : 520);
  G.busy++;
  try { await resolve(v, a, b); }
  catch (e) { console.error(e); }
  finally { G.busy--; if (!G.busy) G.skipAll = false; }
  save();
}
async function resolve(v, a, b) {
  const p = curId(), st = G.state;
  if (v === 'look' && !b) {
    st.looked[a] = (st.looked[a] || 0) + 1;
    if (Object.keys(st.looked).length >= 25) unlock('neugier');
    if (st.looked[a] >= 4 && st.looked[a] % 3 === 1 && LOOK_AGAIN[p]) return say(p, pick(LOOK_AGAIN[p]));
  }
  if (b && b[0] === 'p') {
    if (a[0] !== 'i') return say(p, 'Das kann ich nicht verschicken.');
    return sendItem(a.slice(2), b.slice(2));
  }
  const keys = b ? [`${v} ${a} ${b}`, v === 'use' ? `use ${b} ${a}` : null, v === 'use' ? `give ${a} ${b}` : null] : [`${v} ${a}`];
  for (const k of keys) if (k && RULES[k]) { const r = await RULES[k](); if (r !== false) return; }
  if (!b && a[0] === 'o') {
    const o = OBJ[a.slice(2)];
    if (o.exit && (v === 'walk' || v === 'open' || v === 'use')) { Sound.sfx('door'); return goRoom(p, ...o.exit); }
    if (o.klo && (v === 'open' || v === 'use' || v === 'close')) return say(p, KLO_SELF[p]);
    if (o.txt && o.txt[v]) return say(p, typeof o.txt[v] === 'function' ? o.txt[v]() : o.txt[v]);
    if (v === 'look' && o.look) return say(p, typeof o.look === 'function' ? o.look() : o.look);
  }
  if (b && b[0] === 'o' && OBJ[b.slice(2)].klo && a[0] === 'i') return useWithKlo(a.slice(2));
  if (b && a[0] === 'o' && b[0] === 'i' && OBJ[a.slice(2)].klo) return useWithKlo(b.slice(2));
  if (v === 'walk') return;
  if (!b && a[0] === 'i') {
    const it = ITEMS[a.slice(2)];
    if (v === 'look') return say(p, typeof it.look === 'function' ? it.look() : it.look);
    if (it.txt && it.txt[v]) return say(p, it.txt[v]);
  }
  if (!b && a[0] === 'a') {
    const ac = ACT[a.slice(2)];
    if (v === 'look' && ac.look) return say(p, typeof ac.look === 'function' ? ac.look() : ac.look);
    if (v === 'talk' && ac.talk) {
      st.talked[ac.id] = 1; Sound.sting(ac.id);
      if (NPCS.every(n => st.talked[n])) unlock('plausch');
      return ac.talk();
    }
  }
  if (b && b[0] === 'a' && (v === 'give' || v === 'use')) {
    const ac = ACT[b.slice(2)];
    if (ac.refuse) return say(ac.id, typeof ac.refuse === 'function' ? ac.refuse(a.slice(2)) : ac.refuse);
  }
  if (v === 'give' && b && b[0] === 'o') return say(p, 'Ich glaube nicht, dass das etwas annimmt.');
  return say(p, pick(FALLBACK[p][v] || FALLBACK[p].use));
}

// ---------- UI-Geometrie & Trefferprüfung ----------
const UI = {
  verbs: VERBS.map((v, i) => ({ id: v[0], label: v[1], x: 12 + (i % 3) * 102, y: 474 + Math.floor(i / 3) * 41, w: 100, h: 39 })),
  inv: Array.from({ length: 12 }, (_, i) => ({ i, x: 328 + (i % 6) * 74, y: 474 + Math.floor(i / 6) * 61, w: 70, h: 57 })),
  ports: PLAYERS.map((id, i) => ({ id, x: 814 + i * 54, y: 508, r: 23 })),
  klo: { x: 562, y: 445, w: 82, h: 22 }, pixel: { x: 650, y: 445, w: 66, h: 22 }, reveal: { x: 722, y: 445, w: 76, h: 22 }, hint: { x: 804, y: 445, w: 62, h: 22 }, menu: { x: 872, y: 445, w: 78, h: 22 },
  skip: { x: W - 240, y: 10, w: 184, h: 30 }, fs: { x: W - 46, y: 8, w: 38, h: 32 },
};
const inRect = (x, y, r, pad = 0) => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
function hitUI(x, y) {
  if (inRect(x, y, UI.menu)) return { type: 'menu' };
  if (inRect(x, y, UI.hint)) return { type: 'hint' };
  if (inRect(x, y, UI.reveal)) return { type: 'reveal' };
  if (inRect(x, y, UI.pixel)) return { type: 'pixel' };
  if (inRect(x, y, UI.klo)) return { type: 'klo' };
  for (const v of UI.verbs) if (inRect(x, y, v)) return { type: 'verb', id: v.id };
  for (const s of UI.inv) if (inRect(x, y, s)) return { type: 'inv', idx: s.i };
  for (const p of UI.ports) if (Math.hypot(x - p.x, y - p.y) <= p.r + 6 || (Math.abs(x - p.x) < 27 && y > p.y && y < p.y + 62)) return { type: 'port', id: p.id };
  return null;
}
function hitScene(x, y) {
  if (y >= SH || !G.state) return null;
  const room = ROOMS[viewRoomId()], pad = G.pointer === 'touch' ? 12 : 0;
  const acts = Object.values(ACT).filter(a => a.room === room.id && a.visible && a.id !== curId()).sort((p, q) => q.y - p.y);
  for (const a of acts) {
    const sc = roomScale(room, a.y) * (a.scaleMul || 1), w = a.bw * sc, h = a.h * sc;
    if (x >= a.x - w / 2 - pad && x <= a.x + w / 2 + pad && y >= a.y - h - pad && y <= a.y + 4 + pad) return 'a:' + a.id;
  }
  for (let i = room.objs.length - 1; i >= 0; i--) {
    const o = room.objs[i]; if (!isVisible(o)) continue;
    const [rx, ry, rw, rh] = o.rect; if (x >= rx - pad && x <= rx + rw + pad && y >= ry - pad && y <= ry + rh + pad) return 'o:' + o.id;
  }
  return null;
}
function dialogHit(x, y) {
  if (!G.dialog || y < 470) return -1;
  const i = Math.floor((y - 472) / 24);
  return i >= 0 && i < G.dialog.opts.length && x < 790 ? i : -1;
}

// ---------- Klick-Logik ----------
function sceneClick(x, y, right) {
  const h = hitScene(x, y);
  G.ripples.push({ x, y, t: G.t });
  if (right) { if (h) { const dv = defaultVerb(h); G.verb = null; G.first = null; runSentence(dv || 'look', h); } return; }
  if (!h) { G.first = null; G.verb = null; ++actToken; walkTo(me(), x, y); return; }
  if (G.first) { const v = G.verb, a = G.first; G.first = null; G.verb = null; return runSentence(v, a, h); }
  const v = G.verb || 'walk'; G.verb = null;
  runSentence(v, h);
}
function itemClick(id, right) {
  const k = 'i:' + id;
  if (right) { G.verb = null; G.first = null; return runSentence('look', k); }
  if (G.first) {
    if (G.first === k) { G.first = null; return; }
    const v = G.verb, a = G.first; G.first = null; G.verb = null; return runSentence(v, a, k);
  }
  const v = G.verb || 'use';
  if ((v === 'use' && !ITEMS[id].alone) || v === 'give') { G.verb = v; G.first = k; return; }
  G.verb = null; runSentence(v, k);
}
function portraitClick(ch) {
  if (G.first && G.first[0] === 'i') { const a = G.first; G.first = null; G.verb = null; return runSentence('give', a, 'p:' + ch); }
  G.verb = null; G.first = null; switchChar(ch);
}
function toggleReveal() { if (G.t < G.reveal) G.reveal = 0; else { G.reveal = G.t + 3200; Sound.sfx('reveal'); } }
function onClick(x, y, right) {
  firstInteraction();
  if (G.screen === 'title') return titleClick(x, y);
  if (G.screen === 'end') return endClick(x, y);
  if (G.screen === 'rock') return rockClick(x, y);
  if (G.screen === 'toaster') return toasterClick(x, y);
  if (G.screen !== 'game') return;
  if (G.menu) return menuClick(x, y);
  if (fsAvailable && inRect(x, y, UI.fs, 4)) { toggleFullscreen(); return; }
  if (G.inIntro && inRect(x, y, UI.skip)) { skipScene(); return; }
  if (G.speech) { skipSpeech(); return; }
  if (G.dialog) { const i = dialogHit(x, y); if (i >= 0) { const d = G.dialog; G.dialog = null; Sound.sfx('click'); d.res(d.opts[i].id); } return; }
  const u = y >= SH ? hitUI(x, y) : null;
  if (u && u.type === 'menu') { openMenu(); return; }
  if (u && u.type === 'hint') { if (!G.busy) showHint(); return; }
  if (u && u.type === 'reveal') { toggleReveal(); return; }
  if (u && u.type === 'pixel') { toggleRetro(); return; }
  if (u && u.type === 'klo') { quickKlo(); return; }
  if (G.busy) return;
  if (y < SH) {
    // Doppelklick/-tipp: rennen, Ausgänge sofort benutzen
    const lc = G.lastClick, dbl = !right && lc && G.t - lc.t < 380 && Math.hypot(x - lc.x, y - lc.y) < 30;
    G.lastClick = dbl ? null : { x, y, t: G.t };
    sceneClick(x, y, right);
    if (dbl) quickArrive(x, y);
    return;
  }
  if (!u) return;
  if (u.type === 'verb') { G.verb = u.id; G.first = null; Sound.sfx('click'); return; }
  if (u.type === 'inv') { const it = inv()[u.idx]; if (it) itemClick(it, right); return; }
  if (u.type === 'port') return portraitClick(u.id);
}
function quickArrive(x, y) {
  const a = me(); if (!a.target) return;
  const h = hitScene(x, y), o = h && h[0] === 'o' ? OBJ[h.slice(2)] : null;
  if (o && o.exit) { a.x = a.target[0]; a.y = a.target[1]; return; }
  a.run = true; puff(a.x, a.y, DUST[ROOMS[a.room].floor] || '#b0a8a0', 4, { vy: 14, r: 3, spread: 22 });
}
function onBack() {
  if (G.menu) { G.menu = G.menu === 'main' ? null : 'main'; return; }
  if (G.speech) { skipSpeech(); return; }
  if (G.dialog) { const d = G.dialog; G.dialog = null; d.res(d.opts[d.opts.length - 1].id); return; }
  if (G.busy) { skipScene(); return; }
  if (G.first || G.verb) { G.first = null; G.verb = null; Sound.sfx('click'); }
}

// ---------- Maus & Touch ----------
function toLogical(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
let touch = null;
cv.addEventListener('pointermove', e => {
  const p = toLogical(e);
  if (e.pointerType === 'mouse') { G.pointer = 'mouse'; G.mouse.x = p.x; G.mouse.y = p.y; }
  else if (touch && Math.hypot(p.x - touch.x, p.y - touch.y) > 14) { clearTimeout(touch.timer); touch.moved = true; }
});
cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { G.mouse.x = -99; G.mouse.y = -99; } });
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  const p = toLogical(e);
  G.mouse.x = p.x; G.mouse.y = p.y;
  if (e.pointerType === 'mouse') { G.pointer = 'mouse'; onClick(p.x, p.y, e.button === 2); return; }
  G.pointer = 'touch';
  firstInteraction();
  if (G.screen === 'rock') { onClick(p.x, p.y, false); return; }   // Rhythmus braucht den Moment des Antippens
  touch = { x: p.x, y: p.y, long: false };
  touch.timer = setTimeout(() => {
    if (!touch || touch.moved) return;
    touch.long = true; if (navigator.vibrate) navigator.vibrate(25);
    onClick(touch.x, touch.y, true);
  }, 480);
});
cv.addEventListener('pointerup', e => {
  if (e.pointerType === 'mouse' || !touch) return;
  clearTimeout(touch.timer);
  const t = touch; touch = null;
  if (!t.long) onClick(t.x, t.y, false);
});
cv.addEventListener('pointercancel', () => { if (touch) clearTimeout(touch.timer); touch = null; });
cv.addEventListener('contextmenu', e => e.preventDefault());

// ---------- Tastatur ----------
window.addEventListener('keydown', e => {
  firstInteraction();
  const k = e.key;
  if (G.screen === 'toaster') {
    e.preventDefault();
    if (k === 'Escape') endToaster();
    else if ((k === ' ' || k === 'Enter') && !e.repeat) { if (TS.phase === 'done') startToaster(); else toasterPress(); }
    return;
  }
  if (G.screen === 'rock') {
    e.preventDefault();
    if (e.repeat) return;
    const lane = { a: 0, A: 0, ArrowLeft: 0, s: 1, S: 1, ArrowDown: 1, d: 2, D: 2, ArrowRight: 2 }[k];
    if (RK.phase === 'select' && ['1', '2', '3'].includes(k)) beginRock(['leicht', 'normal', 'schwer'][+k - 1]);
    else if (RK.phase === 'select' && k === 'Enter') beginRock('normal');
    else if (lane != null && !RK.done) rockHit(lane);
    else if (k === 'Escape') endRock();
    else if (k === 'Enter' && RK.done) startRock();
    return;
  }
  if (konamiKey(k)) { e.preventDefault(); return; }
  if (k === 'f' || k === 'F') { toggleFullscreen(); return; }
  if (k === 'o' || k === 'O' || k === 'F2') { if (G.screen !== 'loading') { e.preventDefault(); takePhoto(); } return; }
  if (k === 'F1' || k === 'p' || k === 'P') { e.preventDefault(); toggleRetro(); return; }
  if (k.startsWith('Arrow')) { e.preventDefault(); G.pointer = 'pad'; snapNav(k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0, k === 'ArrowUp' ? -1 : k === 'ArrowDown' ? 1 : 0); return; }
  if (k === 'Enter') { e.preventDefault(); if (G.pointer === 'pad') onClick(G.mouse.x, G.mouse.y, false); else if (G.screen === 'title') { if (!G.menu) titleDefault(); } else if (G.speech) skipSpeech(); return; }
  if (G.screen === 'title') { if (k === 'Escape' && G.menu) G.menu = null; else if (k === ' ' && !G.menu) titleDefault(); return; }
  if (G.screen !== 'game') return;
  if ((k === 'm' || k === 'M') && G.menu === 'map') { G.menu = null; return; }
  if (k === 'Escape') {
    if (G.menu) { G.menu = null; return; }
    if (G.busy && !G.dialog) { skipScene(); return; }
    if (!G.dialog) openMenu();
    return;
  }
  if (k === '.' || k === ' ') { e.preventDefault(); if (G.speech) skipSpeech(); else if (k === ' ' && !G.busy) toggleReveal(); return; }
  if (k === 'Tab') { e.preventDefault(); toggleReveal(); return; }
  if (G.busy || G.dialog || G.menu) return;
  if (k === 'h' || k === 'H') return showHint();
  if (k === 'k' || k === 'K') return quickKlo();
  if (k === 'm' || k === 'M') { G.mapFrom = null; return openMap(); }
  const map = { 1: 'bernard', 2: 'hoagie', 3: 'laverne' };
  if (map[k]) return portraitClick(map[k]);
  const v = VERB_KEYS[k.toLowerCase()]; if (v) { G.verb = v; G.first = null; }
});

// ---------- Controller (Gamepad API, Xbox-Layout) ----------
try { if ('gamepadInputEmulation' in navigator) navigator.gamepadInputEmulation = 'gamepad'; } catch (e) { /* nur Edge auf Xbox */ }
const PAD = { prev: [], hold: {}, idx: -1 };
window.addEventListener('gamepadconnected', e => { PAD.idx = e.gamepad.index; note('Controller verbunden: A Aktion · X Standard · B Zurück · Y Tipp · LB/RB Figur · LT/RT Verb'); });
window.addEventListener('gamepaddisconnected', () => { PAD.idx = -1; });
function currentPad() {
  if (!navigator.getGamepads) return null;
  const pads = navigator.getGamepads();
  if (PAD.idx >= 0 && pads[PAD.idx] && pads[PAD.idx].connected) return pads[PAD.idx];
  for (const p of pads) if (p && p.connected) { PAD.idx = p.index; return p; }
  return null;
}
function rumble(ms, strong, weak) {
  if (G.pointer === 'touch') { if (navigator.vibrate) navigator.vibrate(Math.min(ms, 120)); return; }
  if (G.pointer !== 'pad') return;
  const gp = currentPad(), va = gp && gp.vibrationActuator;
  if (va && va.playEffect) va.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {});
}
const RUMBLE = { flush: [450, 0.6, 0.4], pop: [160, 0.5, 0.3], coin: [70, 0, 0.5], hearts: [380, 0.2, 0.5], zap: [200, 0.6, 0.2], dig: [260, 0.7, 0.2], bad: [220, 0.8, 0.1], run: [300, 0.3, 0.3], solve: [200, 0.2, 0.5], achieve: [180, 0.2, 0.6], warp: [300, 0.3, 0.6], riff: [600, 0.7, 0.7], door: [90, 0.4, 0] };
Sound.onSfx(n => { const r = RUMBLE[n]; if (r) rumble(...r); });
function navTargets() {
  if (G.menu) return G.menuBtns.map(b => [b.x + b.w / 2, b.y + b.h / 2]);
  if (G.screen === 'title') return G.titleBtns.map(b => [b.x + b.w / 2, b.y + b.h / 2]);
  if (G.screen === 'end') return G.endBtn ? [[G.endBtn.x + G.endBtn.w / 2, G.endBtn.y + G.endBtn.h / 2]] : [];
  if (G.dialog) return G.dialog.opts.map((o, i) => [60, 484 + i * 24]);
  if (G.screen !== 'game') return [];
  const T = [], room = ROOMS[viewRoomId()];
  for (const o of room.objs) if (isVisible(o)) T.push(hotspotCenter(o));
  for (const a of Object.values(ACT)) if (a.room === room.id && a.visible && a.id !== curId()) T.push([a.x, a.y - a.h * roomScale(room, a.y) * 0.55]);
  for (const v of UI.verbs) T.push([v.x + v.w / 2, v.y + v.h / 2]);
  inv().forEach((id, i) => { const s = UI.inv[i]; T.push([s.x + s.w / 2, s.y + s.h / 2]); });
  for (const p of UI.ports) T.push([p.x, p.y]);
  return T;
}
function snapNav(dx, dy) {
  const { x, y } = G.mouse, targets = navTargets();
  if (!targets.length) return;
  let best = null, bs = Infinity;
  for (const [tx, ty] of targets) {
    const vx = tx - x, vy = ty - y, along = vx * dx + vy * dy;
    if (along < 6) continue;
    const s = along + Math.abs(vx * dy - vy * dx) * 2.2;
    if (s < bs) { bs = s; best = [tx, ty]; }
  }
  if (!best && (x < 0 || y < 0)) best = targets[0];
  if (best) { G.mouse.x = best[0]; G.mouse.y = best[1]; Sound.sfx('tick'); }
}
function pollPad(dt) {
  const gp = currentPad(); if (!gp) return;
  const btn = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
  const now = gp.buttons.map((b, i) => btn(i));
  const down = i => now[i] && !PAD.prev[i];
  const dz = v => Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82;
  const ax = dz(gp.axes[0] || 0), ay = dz(gp.axes[1] || 0), rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
  const mag = Math.hypot(ax, ay);
  if (mag > 0 || rx || ry) {
    if (G.pointer !== 'pad' || G.mouse.x < 0) { G.mouse.x = W / 2; G.mouse.y = SH / 2; }
    G.pointer = 'pad';
    const sp = 760 * (0.25 + 0.75 * mag);
    G.mouse.x = Math.max(0, Math.min(W, G.mouse.x + ax * sp * dt / 1000 + rx * 220 * dt / 1000));
    G.mouse.y = Math.max(0, Math.min(H - 1, G.mouse.y + ay * sp * dt / 1000 + ry * 220 * dt / 1000));
  }
  if (now.some(Boolean)) { G.pointer = 'pad'; Sound.init(); }
  if (down(11)) toggleRetro();
  // Steuerkreuz mit Wiederholung beim Halten
  [[12, 0, -1], [13, 0, 1], [14, -1, 0], [15, 1, 0]].forEach(([i, dx, dy]) => {
    if (down(i)) { snapNav(dx, dy); PAD.hold[i] = G.t + 380; }
    else if (now[i] && G.t > (PAD.hold[i] || Infinity)) { snapNav(dx, dy); PAD.hold[i] = G.t + 140; }
  });
  if (G.screen === 'title') {
    if (G.menu) { if (down(0)) onClick(G.mouse.x, G.mouse.y, false); if (down(1) || down(9)) G.menu = null; }
    else {
      if (down(0)) { const b = G.titleBtns.find(b => inRect(G.mouse.x, G.mouse.y, b)); if (b) titleClick(G.mouse.x, G.mouse.y); else snapNav(0, 1); }
      if (down(9)) titleDefault();
    }
  } else if (G.screen === 'toaster') {
    if (down(0)) { if (TS.phase === 'done') startToaster(); else toasterPress(); }
    if (down(1) || down(9)) endToaster();
  } else if (G.screen === 'rock') {
    if (RK.done) { if (down(0)) startRock(); if (down(1) || down(9)) endRock(); }
    else { if (down(2) || down(14)) rockHit(0); if (down(0) || down(13)) rockHit(1); if (down(1) || down(15)) rockHit(2); if (down(9)) endRock(); }
  } else if (G.screen === 'end') {
    if (down(0) || down(9)) { G.saved = null; G.hasSaves = anySave(); G.screen = 'title'; music(); }
  } else if (G.screen === 'game') {
    if (down(0)) onClick(G.mouse.x, G.mouse.y, false);
    if (down(2)) onClick(G.mouse.x, G.mouse.y, true);
    if (down(1)) onBack();
    if (down(3) && !G.busy && !G.menu) showHint();
    if (down(4) && !G.busy && !G.menu && !G.dialog) cycleChar(-1);
    if (down(5) && !G.busy && !G.menu && !G.dialog) cycleChar(1);
    if ((down(6) || down(7)) && !G.busy && !G.menu && !G.dialog) {
      const ids = [null, ...VERBS.map(v => v[0])], i = ids.indexOf(G.verb);
      G.verb = ids[(i + (down(7) ? 1 : -1) + ids.length) % ids.length]; G.first = null; Sound.sfx('tick');
    }
    if (down(8)) toggleReveal();
    if (down(10)) quickKlo();
    if (down(9)) { if (G.menu) G.menu = null; else if (!G.busy && !G.dialog) openMenu(); }
  }
  PAD.prev = now;
}

// ---------- Menü ----------
function openMenu() { G.menu = 'main'; Sound.sfx('menu'); if (G.pointer === 'pad') { G.mouse.x = W / 2; G.mouse.y = 0; snapNav(0, 1); } }
function menuItems() {
  const back = { id: G.screen === 'game' ? 'main' : 'close', label: 'Zurück' };
  if (G.menu === 'confirm') return [{ id: 'yes', label: 'Ja, neu starten' }, { id: 'back', label: 'Nein, weiterspielen' }];
  if (G.menu === 'help' || G.menu === 'ach' || G.menu === 'notes') return [back];
  if (G.menu === 'album' || G.menu === 'bios') return [back];
  if (G.menu === 'extras') return [{ id: 'rock', label: 'Minispiel: Tentakel-Rock' }, { id: 'toaster', label: 'Minispiel: Gut-O-Mat' }, { id: 'album', label: `Fotoalbum (${albumList().length})` }, { id: 'bios', label: 'Figuren-Steckbriefe' }, { id: 'jukebox', label: 'Musikbox' }, { id: 'ach', label: `Erfolge (${achCount()}/${ACH.length})` }, back];
  if (G.menu === 'jukebox') return [...JUKEBOX.map(([id, label]) => ({ id: 'jb_' + id, label: (Sound.current === id ? '♪  ' : '') + label })), back];
  if (G.menu === 'save') return [...slotItems('save'), { id: 'export', label: 'Als Datei exportieren' }, back];
  if (G.menu === 'load') {
    const auto = loadSave();
    return [{ id: 'auto', label: 'Autosave: ' + slotLabel(auto), off: !auto }, ...slotItems('load'), { id: 'import', label: 'Aus Datei importieren' }, back];
  }
  if (G.menu === 'settings') return [
    { id: 'music', label: 'Musik: ' + (G.settings.music ? 'an' : 'aus') },
    { id: 'voice', label: 'Sprachausgabe: ' + (!Voice.available ? 'nicht verfügbar' : G.settings.voice ? 'an' : 'aus') },
    { id: 'babble', label: 'Plapperstimmen: ' + (G.settings.babble ? 'an' : 'aus') },
    { id: 'tspeed', label: 'Textgeschwindigkeit: ' + (G.settings.textSpeed || 'normal') },
    { id: 'hotspots', label: 'Hotspot-Hilfe: ' + (G.settings.hotspots ? 'an' : 'aus') },
    { id: 'retro', label: 'Grafik: ' + (G.settings.retro ? 'Klassisch (Pixel)' : 'Remastered') },
    fsAvailable && { id: 'fs', label: 'Vollbild: ' + (isFullscreen() ? 'an' : 'aus') },
    back,
  ].filter(Boolean);
  return [
    { id: 'close', label: 'Weiterspielen' },
    { id: 'notes', label: 'Notizbuch' },
    { id: 'map', label: 'Zeitreise-Karte  (M)' },
    { id: 'extras', label: 'Extras' },
    { id: 'save', label: 'Spiel speichern' },
    { id: 'load', label: 'Spiel laden' },
    { id: 'settings', label: 'Einstellungen' },
    { id: 'help', label: 'Steuerung & Hilfe' },
    { id: 'new', label: 'Neues Spiel' },
  ];
}
function menuClick(x, y) {
  if (G.menu === 'album' && G.albumView != null) { G.albumView = null; return; }
  const b = G.menuBtns.find(b => inRect(x, y, b)); if (!b) return;
  Sound.sfx('click');
  if (b.id === 'close' || b.id === 'back') G.menu = null;
  else if (b.id === 'music') toggleMusic();
  else if (b.id === 'voice') toggleVoice();
  else if (b.id === 'babble') { G.settings.babble = !G.settings.babble; saveSettings(); }
  else if (b.id === 'hotspots') { G.settings.hotspots = !G.settings.hotspots; saveSettings(); }
  else if (b.id === 'tspeed') { const o = ['langsam', 'normal', 'schnell']; G.settings.textSpeed = o[(o.indexOf(G.settings.textSpeed || 'normal') + 1) % 3]; saveSettings(); }
  else if (b.id === 'retro') toggleRetro();
  else if (b.id === 'fs') { G.settings.fullscreen = !isFullscreen(); saveSettings(); toggleFullscreen(); }
  else if (/^save\d$/.test(b.id)) saveSlot(+b.id.slice(4));
  else if (/^load\d$/.test(b.id)) { if (!b.off) loadFrom(readSlot(+b.id.slice(4))); }
  else if (b.id === 'auto') { if (!b.off) loadFrom(loadSave()); }
  else if (b.id === 'export') exportSave();
  else if (b.id === 'import') importSave();
  else if (b.id === 'rock') startRock();
  else if (b.id === 'toaster') startToaster();
  else if (b.id.startsWith('jb_')) { G.jbOn = true; Sound.play(b.id.slice(3)); }
  else if (b.id.startsWith('ph_')) { G.albumView = +b.id.slice(3); Sound.sfx('page'); }
  else if (b.id.startsWith('mp_')) fastTravel(b.id.slice(3));
  else if (b.id === 'map') { G.mapFrom = 'main'; openMap(true); }
  else if (b.id === 'mapback') G.menu = G.mapFrom === 'main' ? 'main' : null;
  else if (['help', 'ach', 'main', 'notes', 'save', 'load', 'settings', 'jukebox', 'extras', 'album', 'bios'].includes(b.id)) {
    G.albumView = null;
    if (b.id === 'notes' || b.id === 'bios') Sound.sfx('page');
    G.menu = b.id;
  }
  else if (b.id === 'new') G.menu = 'confirm';
  else if (b.id === 'yes') { G.menu = null; startNew(); }
}
function toggleMusic() { G.settings.music = !G.settings.music; Sound.setMusic(G.settings.music); saveSettings(); }
function toggleVoice() { if (!Voice.available) return; G.settings.voice = !G.settings.voice; Voice.on = G.settings.voice; saveSettings(); }
function toggleRetro() {
  G.settings.retro = !G.settings.retro; saveSettings(); Sound.setRetro(G.settings.retro); Sound.sfx('warp');
  if (G.screen === 'game') note(G.settings.retro ? 'Grafik: Klassisch (Pixel) · F1 oder P schaltet zurück' : 'Grafik: Remastered · F1 oder P für Pixel-Stil');
}

// ---------- Speichern ----------
function save() {
  if (G.screen !== 'game' || !G.state) return;
  const p = progress();
  if (p > (G.state.progress || 0)) {
    G.state.progress = p; Sound.setIntensity(p / MILESTONES.length);
    if (!G.fast) {
      const seen = G.state.cards || (G.state.cards = {}), m = MILESTONES.find(m => milestoneDone(m) && !seen[m]);
      if (m) seen[m] = 1;
      G.chapterCard = { n: p, title: (m && CHAPTERS[m]) || 'Rätsel gelöst', t0: G.t };
      Sound.sfx('chapter');
    }
  }
  try { localStorage.setItem(SAVE_KEY, snapshot()); } catch (e) { /* Speicher nicht verfügbar – Spiel läuft trotzdem */ }
}
function snapshot() {
  const s = G.state; s.actors = {};
  for (const a of Object.values(ACT)) s.actors[a.id] = { room: a.room, x: Math.round(a.x), y: Math.round(a.y), dir: a.dir, visible: a.visible };
  s.savedAt = Date.now();
  return JSON.stringify(s);
}
function readSlot(n) { try { const raw = localStorage.getItem(SLOT_KEY + n); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
function anySave() { if (loadSave()) return true; for (let i = 1; i <= SLOTS; i++) if (readSlot(i)) return true; return false; }
function slotLabel(s) {
  if (!s) return 'leer';
  const d = s.savedAt ? new Date(s.savedAt) : null;
  const when = d ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' · ' : '';
  return `${when}${ACT[s.cur] ? ACT[s.cur].name : '?'} · ${s.progress || 0}/${MILESTONES.length}`;
}
function slotItems(mode) {
  return Array.from({ length: SLOTS }, (_, i) => { const s = readSlot(i + 1); return { id: mode + (i + 1), label: `Platz ${i + 1}: ${slotLabel(s)}`, off: mode === 'load' && !s }; });
}
function saveSlot(n) {
  if (G.screen !== 'game' || !G.state) return;
  if (G.busy) { note('Speichern geht erst nach der laufenden Szene.'); return; }
  try { localStorage.setItem(SLOT_KEY + n, snapshot()); G.menu = null; Sound.sfx('pick'); note(`Spiel auf Platz ${n} gespeichert.`); }
  catch (e) { note('Speichern nicht möglich – der Browser blockiert den Speicher.'); }
}
function loadFrom(s) {
  if (G.busy) { note('Laden geht erst nach der laufenden Szene.'); return; }
  if (!s || !s.flags || !s.inv || !ACT[s.cur]) { note('Dieser Spielstand ist leer oder beschädigt.'); return; }
  G.menu = null; Sound.sfx('warp');
  continueGame(s); save();
  note(`Spielstand geladen: ${ACT[s.cur].name}, ${s.progress || 0} von ${MILESTONES.length} Rätseln.`);
}
function exportSave() {
  if (!G.state || G.busy) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([snapshot()], { type: 'application/json' }));
  a.download = `tentakel-toast-spielstand-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  note('Spielstand als Datei exportiert.');
}
function importSave() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    f.text().then(t => { let s = null; try { s = JSON.parse(t); } catch (e) { /* keine gültige Datei */ } loadFrom(s); });
  };
  inp.click();
}
function loadSave() { try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ok */ } }
function saveSettings() { try { localStorage.setItem(SET_KEY, JSON.stringify(G.settings)); } catch (e) { /* ok */ } }
function loadSettings() {
  try { const s = JSON.parse(localStorage.getItem(SET_KEY) || 'null'); if (s) Object.assign(G.settings, s); } catch (e) { /* ok */ }
  Sound.setMusic(G.settings.music); Sound.setRetro(!!G.settings.retro); Voice.on = G.settings.voice;
}
function applyActors(map) {
  for (const [id, s] of Object.entries(map)) {
    const a = ACT[id]; if (!a) continue;
    Object.assign(a, { room: s.room, x: s.x, y: s.y, dir: s.dir, visible: s.visible !== false, target: null, walking: false, talking: false });
  }
}

// ---------- Spielstart ----------
function resetWorld() {
  G.verb = null; G.first = null; G.speech = null; G.dialog = null; G.caption = null; G.viewRoom = null; G.inIntro = false;
  endBark(); G.barkNext = G.t + 8000; G.idleSince = G.t; G.lastClick = null;
  G.kloAnim = null; G.treeGrowT = 0; G.machineShake = 0; G.toastPop = 0; G.leverT = 0; G.flash = {}; G.note = null; G.fly = []; G.reveal = 0;
  for (const a of Object.values(ACT)) { a.nice = 0; a.talking = false; a.walking = false; a.target = null; a._res = null; a.speed = a.baseSpeed; }
}
function normalizeState(s) {
  s.looked = s.looked || {}; s.talked = s.talked || {}; s.stats = s.stats || { sent: 0, ms: 0 }; s.crystals = s.crystals || {}; s.visited = s.visited || {}; s.signs = s.signs || {};
  if (s.progress == null) s.progress = 0;
  return s;
}
async function startNew() {
  clearSave(); resetWorld();
  G.state = normalizeState(newState()); applyActors(START_POS);
  G.screen = 'game'; G.fade = 1; G.fadeMode = 'black'; music();
  await cutscene(INTRO);
  G.inIntro = false; G.fade = 0;
  save(); showSign(me().room);
  await cutscene(INTRO_TIP);
}
function continueGame(s) {
  resetWorld();
  G.state = normalizeState(s); applyActors(START_POS); if (s.actors) applyActors(s.actors);
  G.screen = 'game'; G.fade = 1; music(); irisAt(me()); fadeTo(0, 500, 'iris');
  if (!G.fast) G.sign = { room: me().room, t0: G.t + 450 };   // beim Fortsetzen: wo war ich nochmal?
}
function titleDefault() { if (G.saved) continueGame(G.saved); else startNew(); }
async function cutscene(fn) {
  G.busy++;
  try { await fn(); } catch (e) { console.error(e); }
  finally { G.busy--; G.skipAll = false; }
}

// ---------- Rendering ----------
function drawBg(room) {
  if (cx.isPix) return cx.blitRoom(room);
  const s = VS * DPR, key = room.id;
  let c = bgCache[key];
  if (!c || c._s !== s) {
    c = document.createElement('canvas'); c.width = Math.ceil(W * s); c.height = Math.ceil(SH * s); c._s = s;
    const g = c.getContext('2d'); g.setTransform(s, 0, 0, s, 0, 0);
    HDS.deco = HDS.shadow = true; HDS.scale = s;
    try { room.draw(g); } finally { HDS.deco = HDS.shadow = false; }
    finishBg(g, c, room); bgCache[key] = c;
  }
  cx.drawImage(c, 0, 0, W, SH);
}
// Malerische Nachbearbeitung des Raumhintergrunds (einmal pro Raum und Auflösung):
// weiches Leuchten, Licht-Verlauf von der Lichtquelle, Malgrund-Textur
let paperTex = null;
function paperCanvas() {
  if (paperTex) return paperTex;
  const n = 256, c = document.createElement('canvas'); c.width = c.height = n;
  const x = c.getContext('2d'), img = x.createImageData(n, n);
  const octs = [[4, 0.42], [16, 0.3], [64, 0.18], [256, 0.1]].map(([f, w]) => ({ f, w, a: Float32Array.from({ length: f * f }, () => Math.random()) }));
  const smp = (o, u, v) => {
    const fx = u * o.f, fy = v * o.f, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, f = o.f;
    const at = (i, j) => o.a[((j % f + f) % f) * f + ((i % f + f) % f)];
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
  };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let v = 0; for (const o of octs) v += smp(o, i / n, j / n) * o.w;
    const k = (j * n + i) * 4, g = Math.max(0, Math.min(255, 128 + (v - 0.5) * 120));
    img.data[k] = img.data[k + 1] = img.data[k + 2] = g; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return (paperTex = c);
}
function finishBg(g, c, room) {
  if (!HDS.on) return;
  const fx = ROOM_FX[room.id] || {}, lt = fx.light;
  g.save();
  if (BLOOM_OK) {
    // Orton-Effekt: unscharfe Kopie per soft-light gibt Tiefe und ein weiches, gemaltes Leuchten
    const t = document.createElement('canvas'); t.width = Math.ceil(c.width / 4); t.height = Math.ceil(c.height / 4);
    const tg = t.getContext('2d'); tg.filter = 'blur(5px)'; tg.drawImage(c, 0, 0, t.width, t.height);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.5; g.drawImage(t, 0, 0, c.width, c.height);
    g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.1; g.drawImage(t, 0, 0, c.width, c.height);
    g.setTransform(c._s, 0, 0, c._s, 0, 0);
  }
  if (lt) {
    const [side, key, fill] = lt, gx = side < 0 ? W * 0.12 : W * 0.88;
    const rg = g.createRadialGradient(gx, -60, 30, gx, -60, W * 1.15);
    rg.addColorStop(0, hexA(key, 0.55)); rg.addColorStop(0.45, hexA(key, 0.06)); rg.addColorStop(1, hexA(fill, 0.6));
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 1; g.fillStyle = rg; g.fillRect(0, 0, W, SH);
  }
  const pat = g.createPattern(paperCanvas(), 'repeat');
  if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(0.6));
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.2; g.fillStyle = pat; g.fillRect(0, 0, W, SH);
  g.restore();
}
// kurze Drehung statt hartem Spiegeln, wenn eine Figur die Richtung wechselt
function turnScale(a) {
  if (a._ld === undefined) { a._ld = a.dir; a._dt = -1e9; }
  if (a._ld !== a.dir) { a._ld = a.dir; a._dt = G.t; }
  const k = Math.min(1, (G.t - a._dt) / 170);
  return 0.2 + 0.8 * (1 - Math.pow(1 - k, 3));
}
function drawActor(a, room) {
  const sc = roomScale(room, a.climbY != null ? a.climbY : a.y) * (a.scaleMul || 1), lt = !cx.isPix && (ROOM_FX[room.id] || {}).light, sx = lt ? -lt[0] * 7 * sc : 0;
  const lift = a.climbY != null ? a.climbY - a.y : 0, shrink = 1 - Math.min(0.6, lift / 300);
  a._turn = turnScale(a);
  cx.save(); cx.translate(a.x, a.y + lift);
  // zweiteiliger Schatten: weicher Saum + dunklerer Kontaktkern, im HD-Modus von der Lichtquelle weg verschoben
  cx.fillStyle = 'rgba(0,0,0,0.16)'; cx.beginPath(); cx.ellipse(sx, 2, 34 * sc * (a.shadowW || 1) * shrink, 8 * sc * shrink, 0, 0, Math.PI * 2); cx.fill();
  cx.fillStyle = 'rgba(0,0,0,0.18)'; cx.beginPath(); cx.ellipse(sx * 0.4, 2, 21 * sc * (a.shadowW || 1) * shrink, 4.8 * sc * shrink, 0, 0, Math.PI * 2); cx.fill();
  if (lift) cx.translate(0, -lift);
  if (lt) { cx.restore(); drawActorLit(a, sc, lt, (ROOM_FX[room.id] || {}).reflect); partyHat(a, sc); return; }
  cx.scale(sc * (a.dir < 0 ? -1 : 1) * a._turn, sc);
  CHAR[a.kind](cx, a, G.t);
  cx.restore();
  partyHat(a, sc);
}
function stageText(t) { return t.replace(/\*([^*]+)\*/g, '($1)'); }
function wrap(text, maxW) {
  text = stageText(text);
  const words = text.split(' '), lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (cx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}
function drawSpeech() {
  const sp = G.speech; if (!sp) return;
  const room = ROOMS[viewRoomId()];
  cx.font = '800 21px "Baloo 2", system-ui, sans-serif';
  const lines = wrap(sp.text, 400), lh = 23;
  let x = W / 2, y = 36 + lines.length * lh, col = '#ffffff';
  if (sp.a) {
    col = sp.a.color;
    if (sp.a.room === room.id && sp.a.visible) { const sc = roomScale(room, sp.a.climbY != null ? sp.a.climbY : sp.a.y) * (sp.a.scaleMul || 1); x = sp.a.x; y = sp.a.y - sp.a.h * sc - 12; }
  }
  const maxW = Math.max(...lines.map(l => cx.measureText(l).width));
  x = Math.max(maxW / 2 + 12, Math.min(W - maxW / 2 - 12, x));
  y = Math.max(lines.length * lh + 4, y);
  cx.textAlign = 'center'; cx.textBaseline = 'alphabetic'; cx.lineJoin = 'round';
  const pk = Math.min(1, (G.t - sp.start) / 140), pop = pk < 1 ? 0.82 + 0.18 * (1 - Math.pow(1 - pk, 3)) + Math.sin(pk * Math.PI) * 0.06 : 1;
  cx.save(); cx.translate(x, y); cx.scale(pop, pop); cx.translate(-x, -y);
  lines.forEach((l, i) => {
    const ly = y - (lines.length - 1 - i) * lh;
    if (!cx.isPix) { cx.fillStyle = 'rgba(8,2,16,0.45)'; cx.fillText(l, x + 2, ly + 3); }
    cx.lineWidth = 5; cx.strokeStyle = '#0b0610'; cx.strokeText(l, x, ly);
    cx.fillStyle = col; cx.fillText(l, x, ly);
  });
  cx.restore();
}
function drawVignette() {
  const g = cx.createRadialGradient(W / 2, SH * 0.55, 260, W / 2, SH * 0.55, 640);
  g.addColorStop(0, 'rgba(10,4,20,0)'); g.addColorStop(1, 'rgba(10,4,20,0.42)');
  cx.fillStyle = g; cx.fillRect(0, 0, W, SH);
}
// Farbstimmung pro Raum (nur HD-Modus): kühles Labor, warmes 1776, violette Zukunft
const GRADE = {
  lobby: ['#5a8ad0', 0.18], labor: ['#26b8b8', 0.14], gasthaus: ['#c8873a', 0.2],
  garten1776: ['#ffcf80', 0.13], fgarten: ['#e050b0', 0.1], vorraum: ['#b08ad8', 0.14], thron: ['#a060e0', 0.14],
};
function drawGrade() {
  const g = GRADE[viewRoomId()]; if (!g) return;
  cx.save();
  cx.globalCompositeOperation = 'soft-light';
  cx.globalAlpha = g[1];
  cx.fillStyle = g[0];
  cx.fillRect(0, 0, W, SH);
  cx.restore();
}
function drawReveal(room) {
  if (G.t > G.reveal) return;
  const k = Math.min(1, (G.reveal - G.t) / 400), pulse = 1 + Math.sin(G.t * 0.012) * 0.25;
  cx.save(); cx.globalAlpha = k;
  const spots = [];
  for (const o of room.objs) if (isVisible(o)) spots.push([...hotspotCenter(o), (o.exit ? '» ' : '') + (typeof o.name === 'function' ? o.name() : o.name)]);
  for (const a of Object.values(ACT)) if (a.room === room.id && a.visible && a.id !== curId()) spots.push([a.x, a.y - a.h * roomScale(room, a.y) * 0.55, a.name]);
  for (const [x, y, n] of spots) {
    E(cx, x, y, 8 * pulse, 8 * pulse, 'rgba(255,224,102,0.25)', 2.5, 0, '#ffe066'); E(cx, x, y, 3, 3, '#ffe066', 0);
    txt(cx, n, x, y - 14, '800 13px "Baloo 2", sans-serif', '#fff6d0', 'center', 4, '#1b1020');
  }
  cx.restore();
}
function drawTransition() {
  if (G.fade <= 0) return;
  if (G.fadeMode === 'iris') {
    const r = Math.max(0, 1 - G.fade) * Math.hypot(W, SH);
    cx.save(); cx.beginPath(); cx.rect(0, 0, W, SH); cx.arc(G.irisX, G.irisY, r, 0, Math.PI * 2); cx.fillStyle = '#0c0614'; cx.fill('evenodd');
    if (r > 2) { cx.beginPath(); cx.arc(G.irisX, G.irisY, r, 0, Math.PI * 2); cx.lineWidth = 6; cx.strokeStyle = OUT; cx.stroke(); }
    cx.restore();
  } else if (G.fadeMode === 'warp') {
    cx.fillStyle = `rgba(12,6,20,${G.fade})`; cx.fillRect(0, 0, W, SH);
    if (cx.isPix) {
      cx.save(); cx.globalAlpha = G.fade; cx.translate(W / 2, SH / 2);
      for (let i = 0; i < 9; i++) {
        const r = (G.t * 0.35 + i * 55) % 495; cx.rotate(0.35 + G.t * 0.0004);
        cx.setLineDash([26, 18]); E(cx, 0, 0, r, r * 0.6, null, 5, 0, i % 2 ? G.warpCol : '#ffffff');
      }
      cx.setLineDash([]); cx.restore();
    } else {
      // Sterntunnel: Lichtstreifen rasen nach außen, Spiralarme drehen sich um ein helles Zentrum
      cx.save(); cx.globalAlpha = G.fade; cx.translate(W / 2, SH / 2);
      glow(0, 0, 260, G.warpCol, 0.5); glow(0, 0, 90, '#ffffff', 0.7);
      cx.lineCap = 'round';
      for (let i = 0; i < 70; i++) {
        const ang = i * 2.399 + G.t * 0.0007, q = ((G.t * 0.0011 + i * 0.137) % 1), r = 20 + q * q * 560;
        cx.globalAlpha = G.fade * Math.min(1, q * 3);
        cx.strokeStyle = i % 3 ? G.warpCol : '#ffffff'; cx.lineWidth = 1 + q * 3;
        cx.beginPath(); cx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r * 0.62); cx.lineTo(Math.cos(ang) * r * (1.08 + q * 0.25), Math.sin(ang) * r * 0.62 * (1.08 + q * 0.25)); cx.stroke();
      }
      cx.globalAlpha = G.fade * 0.6;
      for (let arm = 0; arm < 3; arm++) {
        cx.strokeStyle = arm === 1 ? '#ffffff' : G.warpCol; cx.lineWidth = 4;
        cx.beginPath();
        for (let j = 0; j <= 40; j++) { const u = j / 40, ang = arm * 2.094 + u * 5 - G.t * 0.003, r = 12 + u * 300; const px = Math.cos(ang) * r, py = Math.sin(ang) * r * 0.62; if (j) cx.lineTo(px, py); else cx.moveTo(px, py); }
        cx.stroke();
      }
      cx.restore();
    }
    if (G.fade > 0.5 && G.warpLabel) {
      cx.globalAlpha = (G.fade - 0.5) * 2;
      txt(cx, G.warpLabel, W / 2, SH / 2 + 14, '400 40px "Titan One", sans-serif', G.warpCol, 'center', 8, '#0c0614');
      cx.globalAlpha = 1;
    }
  } else { cx.fillStyle = `rgba(12,6,20,${G.fade})`; cx.fillRect(0, 0, W, SH); }
}
function fsIcon(r, hot) {
  R(cx, r.x, r.y, r.w, r.h, hot ? 'rgba(58,39,88,0.9)' : 'rgba(20,12,32,0.55)', 2, 8, '#6a52a0');
  const x0 = r.x + 10, y0 = r.y + 8, x1 = r.x + r.w - 10, y1 = r.y + r.h - 8, a = 6, col = hot ? '#ffe066' : '#e6dcff', f = isFullscreen() ? -1 : 1;
  for (const [x, y, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
    const bx = f > 0 ? x : x + sx * a, by = f > 0 ? y : y + sy * a;
    L(cx, [bx, by + sy * a * f, bx, by, bx + sx * a * f, by], 2.5, col);
  }
}
function drawScene() {
  const room = ROOMS[viewRoomId()];
  cx.save(); cx.beginPath(); cx.rect(0, 0, W, SH); cx.clip();
  cx.save();
  if (G.t < G.shake.until) cx.translate((Math.random() - 0.5) * G.shake.mag * 2, (Math.random() - 0.5) * G.shake.mag * 2);
  camApply();
  drawBg(room);
  drawSky();
  HDS.deco = true;   // Raum-Grafik: handgezeichnete Kanten, Fasen, Holzmaserung
  try {
    if (room.dyn) room.dyn(cx, G.t);
    for (const o of room.objs) if (o.draw && !o.fg && isVisible(o)) o.draw(cx, G.t);
  } finally { HDS.deco = false; }
  drawCrystal(room);
  if (cx.isPix) cx.layer(1);   // Pixel-Modus: Figuren auf eigene Ebene, damit Schilder-Texte dahinter bleiben
  const acts = Object.values(ACT).filter(a => a.room === room.id && a.visible).sort((p, q) => p.y - q.y);
  for (const a of acts) drawActor(a, room);
  HDS.deco = true;
  try { for (const o of room.objs) if (o.draw && o.fg && isVisible(o)) o.draw(cx, G.t); } finally { HDS.deco = false; }
  if (!cx.isPix) { drawMotes(); const fg = (ROOM_FX[room.id] || {}).fg; if (fg) drawForeground(fg); }
  drawSendPortal();
  drawParts(); drawRipples(); drawRain(); drawGlint();
  cx.restore();
  drawLightFx(!cx.isPix);
  drawDisco();
  if (!cx.isPix) { drawBloom((ROOM_FX[room.id] || {}).bloom); drawGrade(); drawVignette(); }
  drawReveal(room);
  drawConfetti();
  drawHotspotHelp(room);
  drawChapterCard();
  drawSign();
  drawTransition();
  cx.save(); camApply(); drawBark(); drawSpeech(); cx.restore();
  if (G.photoFlash && G.t - G.photoFlash < 260) { cx.fillStyle = `rgba(255,255,255,${(0.7 * (1 - (G.t - G.photoFlash) / 260)).toFixed(3)})`; cx.fillRect(0, 0, W, SH); }
  if (G.caption) {
    cx.font = '400 26px "Titan One", sans-serif';
    const w = cx.measureText(G.caption).width + 40;
    R(cx, W / 2 - w / 2, SH - 70, w, 46, 'rgba(20,10,32,0.85)', 0, 12);
    txt(cx, G.caption, W / 2, SH - 38, '400 26px "Titan One", sans-serif', '#ffd23a');
  }
  drawToasts();
  if (G.inIntro && !G.fast && !G.skipAll) {
    button(UI.skip, 'Intro überspringen  »', inRect(G.mouse.x, G.mouse.y, UI.skip));
    txt(cx, 'Klick: nächste Zeile', UI.skip.x + UI.skip.w / 2, 56, '600 12px "Baloo 2", sans-serif', 'rgba(255,255,255,0.7)');
  }
  if (fsAvailable) fsIcon(UI.fs, inRect(G.mouse.x, G.mouse.y, UI.fs, 4));
  cx.restore();
}
// Hinweiszeile oben und Erfolgs-Toast (im Spiel und auf dem Titelbildschirm)
function drawToasts() {
  if (G.note && G.t < G.note.until) {
    cx.font = '700 15px "Baloo 2", sans-serif';
    const w = cx.measureText(G.note.text).width + 30;
    R(cx, W / 2 - w / 2, 10, w, 30, 'rgba(20,10,32,0.88)', 2, 15, '#7dff7a');
    txt(cx, G.note.text, W / 2, 30, '700 15px "Baloo 2", sans-serif', '#d8ffd2');
  }
  if (G.achToast && G.t < G.achToast.until) {
    const k = Math.min(1, (G.achToast.until - G.t) / 300, (G.t - (G.achToast.until - 4200)) / 300), x = W - 344 + (1 - k) * 60, y = 48;
    cx.save(); cx.globalAlpha = Math.max(0, k);
    R(cx, x, y, 332, 60, 'rgba(24,14,40,0.94)', 2.5, 12, '#ffd23a');
    trophy(cx, x + 30, y + 30, 1.2);
    txt(cx, 'Erfolg: ' + G.achToast.a.name, x + 58, y + 26, '800 16px "Baloo 2", sans-serif', '#ffd23a', 'left');
    txt(cx, G.achToast.a.desc, x + 58, y + 46, '600 12px "Baloo 2", sans-serif', '#e6dcff', 'left');
    cx.restore();
  }
}
function button(r, label, hot, active) {
  R(cx, r.x, r.y, r.w, r.h, hot ? '#3a2758' : '#24173a', 2, 8, active ? '#ffe066' : '#4a3672');
  txt(cx, label, r.x + r.w / 2, r.y + r.h / 2 + 5, '700 14px "Baloo 2", sans-serif', hot || active ? '#ffe066' : '#d7c6ff');
}
function drawUIBack() {
  if (cx.isPix) { cx.fillStyle = '#150c20'; cx.fillRect(0, SH, W, H - SH); cx.fillStyle = '#2c1c44'; cx.fillRect(0, SH, W, 2); return; }
  cx.fillStyle = grad(cx, 0, SH, 0, H, [[0, '#26153c'], [0.35, '#180c28'], [1, '#0d0617']]); cx.fillRect(0, SH, W, H - SH);
  const pat = cx.createPattern(paperCanvas(), 'repeat'); if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(0.6));
  cx.save(); cx.globalCompositeOperation = 'overlay'; cx.globalAlpha = 0.2; cx.fillStyle = pat; cx.fillRect(0, SH, W, H - SH); cx.restore();
  cx.fillStyle = grad(cx, 0, SH, W, SH, [[0, '#3a2458'], [0.5, '#9a7ad8'], [1, '#3a2458']]); cx.fillRect(0, SH, W, 3);
  cx.fillStyle = 'rgba(0,0,0,0.45)'; cx.fillRect(0, SH + 3, W, 4);
  for (const [x, w] of [[6, 312], [322, 452]]) {
    R(cx, x, 468, w, 129, 'rgba(8,3,18,0.5)', 2, 12, '#3d2c5e');
    L(cx, [x + 10, 596, x + w - 10, 596], 1.5, 'rgba(180,150,255,0.14)');
  }
}
function drawUI() {
  drawUIBack();
  const mx = G.mouse.x, my = G.mouse.y;
  if (!G.busy && !G.dialog) {
    const full = sentence(), verb = VERB_LABEL[G.verb || 'walk'], rest = full.slice(verb.length), f = '600 19px "Baloo 2", sans-serif';
    cx.font = f; const w1 = cx.measureText(verb).width, w2 = cx.measureText(rest).width, x0 = 366 - (w1 + w2) / 2;
    txt(cx, verb, x0, 462, '800 19px "Baloo 2", sans-serif', G.verb ? '#ffe066' : '#b8a4e8', 'left');
    txt(cx, rest, x0 + w1, 462, f, G.hover || G.first ? '#ffffff' : '#d7c6ff', 'left');
  }
  button(UI.klo, 'Klo-Post', inRect(mx, my, UI.klo), G.verb === 'give' && !G.first);
  button(UI.pixel, G.settings.retro ? 'HD' : 'Pixel', inRect(mx, my, UI.pixel), G.settings.retro);
  button(UI.reveal, 'Zeigen', inRect(mx, my, UI.reveal), G.t < G.reveal);
  button(UI.hint, 'Tipp', inRect(mx, my, UI.hint));
  button(UI.menu, 'Menü', inRect(mx, my, UI.menu));
  if (G.dialog) {
    const hi = dialogHit(mx, my);
    G.dialog.opts.forEach((o, i) => {
      if (i === hi && G.pointer === 'pad') R(cx, 14, 474 + i * 24, 760, 22, '#22163a', 0, 6);
      txt(cx, o.text, 22, 492 + i * 24, '700 19px "Baloo 2", sans-serif', i === hi ? '#ffe066' : '#c3b2ff', 'left');
    });
  } else {
    const dv = !G.verb && !G.first ? defaultVerb(G.hover) : null;
    cx.globalAlpha = G.busy ? 0.45 : 1;
    for (const v of UI.verbs) {
      const hot = inRect(mx, my, v), sel = G.verb === v.id, d = dv === v.id;
      if (hot || sel) R(cx, v.x, v.y, v.w, v.h, sel ? '#2a1b46' : '#22163a', 0, 8);
      if ((hot || sel) && !cx.isPix) { cx.save(); cx.shadowColor = sel ? 'rgba(255,224,102,0.7)' : 'rgba(200,180,255,0.6)'; cx.shadowBlur = 12 * VS * DPR; }
      txt(cx, v.label, v.x + v.w / 2, v.y + 27, '800 22px "Baloo 2", sans-serif', sel ? '#ffe066' : hot ? '#ffffff' : d ? '#f6efff' : '#9a82d0');
      if ((hot || sel) && !cx.isPix) cx.restore();
    }
    const items = inv();
    for (const s of UI.inv) {
      const id = items[s.i], hot = inRect(mx, my, s) && id, selected = id && G.first === 'i:' + id;
      R(cx, s.x, s.y, s.w, s.h, hot ? '#2c1d46' : '#1d1330', 2, 8, selected ? '#ffe066' : '#33224d');
      if (!cx.isPix) { L(cx, [s.x + 7, s.y + 4, s.x + s.w - 7, s.y + 4], 2.5, 'rgba(0,0,0,0.4)'); L(cx, [s.x + 7, s.y + s.h - 3, s.x + s.w - 7, s.y + s.h - 3], 1.5, 'rgba(190,160,255,0.16)'); }
      if (id && !G.fly.some(f => f.id === id) && !(G.sendFx && G.sendFx.item === id && G.sendFx.to === curId() && G.t - G.sendFx.t0 < 1350)) {
        const lift = hot ? 4 : selected ? 2 + Math.sin(G.t * 0.006) * 2 : 0, sc = hot ? 1.1 : 1;
        if ((hot || selected) && !cx.isPix) glow(s.x + s.w / 2, s.y + s.h / 2, 34, selected ? '#ffe066' : '#c8b0ff', 0.35);
        cx.save(); cx.translate(s.x + s.w / 2, s.y + s.h / 2 + 1 - lift); cx.scale(sc, sc);
        if (!cx.isPix) { const k = VS * DPR; cx.shadowColor = 'rgba(0,0,0,0.5)'; cx.shadowBlur = (3 + lift) * k; cx.shadowOffsetY = (2 + lift) * k; }
        ICON[id](cx); cx.restore();
      }
    }
    cx.globalAlpha = 1;
  }
  for (const p of UI.ports) {
    const isCur = p.id === curId(), fla = G.flash[p.id] && G.t - G.flash[p.id] < 2000;
    if (isCur && !cx.isPix) { const g = cx.createRadialGradient(p.x, p.y, p.r * 0.8, p.x, p.y, p.r * 1.7); g.addColorStop(0, 'rgba(255,224,102,0.35)'); g.addColorStop(1, 'rgba(255,224,102,0)'); cx.fillStyle = g; cx.fillRect(p.x - p.r * 2, p.y - p.r * 2, p.r * 4, p.r * 4); }
    drawPortrait(cx, p.id, p.x, p.y, p.r, ERA[HOME_ERA[p.id]].bg, G.t, !!(G.speech && G.speech.a && G.speech.a.id === p.id));
    const ring = fla && Math.floor(G.t / 200) % 2 ? '#7dff7a' : isCur ? '#ffe066' : mix(ERA[HOME_ERA[p.id]].col, '#241739', 0.35);
    E(cx, p.x, p.y, p.r, p.r, null, isCur || fla ? 3.5 : 2.5, 0, ring);
    txt(cx, ACT[p.id].name, p.x, p.y + 42, '800 13px "Baloo 2", sans-serif', isCur ? '#ffe066' : '#c3b2ff');
    txt(cx, ERA[HOME_ERA[p.id]].label, p.x, p.y + 58, '600 10px "Baloo 2", sans-serif', '#8a7aa8');
  }
}
// Zeitportal am Klo (im Raum) und der Flug des Gegenstands zum Porträt des Empfängers (über der Leiste)
function drawSendPortal() {
  const f = G.sendFx; if (!f || viewRoomId() !== f.room) return;
  const k = (G.t - f.t0) / 1500; if (k > 1) return;
  const a = Math.sin(Math.min(1, k * 1.4) * Math.PI), rot = G.t * 0.006;
  glow(f.x, f.y, f.h * 0.9, f.col, 0.7 * a); glow(f.x, f.y, f.h * 0.45, '#ffffff', 0.5 * a);
  cx.save(); cx.globalAlpha = a; cx.translate(f.x, f.y);
  for (let i = 0; i < 5; i++) {   // wirbelnde Ringe
    cx.rotate(rot + i * 1.25);
    S(cx, null, 3 - i * 0.4, () => cx.ellipse(0, 0, f.h * (0.2 + i * 0.09), f.h * (0.08 + i * 0.035), 0, 0.3, Math.PI * 1.4), i % 2 ? '#ffffff' : f.col);
  }
  cx.restore();
  for (let i = 0; i < 10; i++) { const q = (G.t * 0.0015 + i / 10) % 1, ang = i * 2.4 + G.t * 0.004; E(cx, f.x + Math.cos(ang) * f.h * 0.5 * (1 - q), f.y + Math.sin(ang) * f.h * 0.3 * (1 - q), 2, 2, '#ffffff', 0); }
}
function drawSendFly() {
  const f = G.sendFx; if (!f) return;
  const k = (G.t - f.t0 - 450) / 900; if (k < 0) return;
  if (k > 1) {   // Ankunft: Lichtring am Porträt
    const q = (k - 1) / 0.6; if (q > 1) { G.sendFx = null; return; }
    const p = UI.ports.find(p => p.id === f.to); if (!p) return;
    glow(p.x, p.y, 40 + q * 30, f.col, 0.6 * (1 - q));
    cx.save(); cx.globalAlpha = 1 - q; E(cx, p.x, p.y, p.r + 4 + q * 26, p.r + 4 + q * 26, null, 3, 0, f.col); cx.restore();
    return;
  }
  const p = UI.ports.find(p => p.id === f.to); if (!p) return;
  const e = k * k * (3 - 2 * k), x0 = f.x, y0 = f.y - 30, cx1 = (x0 + p.x) / 2, cy1 = Math.min(y0, p.y) - 160;
  const bx = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * cx1 + e * e * p.x, by = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * cy1 + e * e * p.y;
  for (let i = 1; i <= 5; i++) {   // Leuchtspur
    const e2 = Math.max(0, e - i * 0.04), tx = (1 - e2) * (1 - e2) * x0 + 2 * (1 - e2) * e2 * cx1 + e2 * e2 * p.x, ty = (1 - e2) * (1 - e2) * y0 + 2 * (1 - e2) * e2 * cy1 + e2 * e2 * p.y;
    glow(tx, ty, 16 - i * 2, f.col, 0.5 - i * 0.08);
  }
  glow(bx, by, 26, f.col, 0.7);
  cx.save(); cx.translate(bx, by); const sc = 1.3 - 0.4 * e; cx.scale(sc, sc); cx.rotate(k * Math.PI * 2); ICON[f.item](cx); cx.restore();
}
// filmische Kapitelkarte: schwarze Balken fahren ein, Titel in der Mitte
function drawChapterCard() {
  const c = G.chapterCard; if (!c) return;
  const k = (G.t - c.t0) / 3200; if (k > 1) { G.chapterCard = null; return; }
  const a = Math.min(1, k * 6, (1 - k) * 5), bar = 52 * a;
  cx.fillStyle = 'rgba(6,2,12,0.92)'; cx.fillRect(0, 0, W, bar); cx.fillRect(0, SH - bar, W, bar);
  cx.save(); cx.globalAlpha = a;
  glow(W / 2, SH / 2 - 10, 260, '#ffd23a', 0.25);
  R(cx, W / 2 - 300, SH / 2 - 62, 600, 104, 'rgba(18,8,32,0.82)', 2, 16, '#ffd23a');
  txt(cx, `Kapitel ${c.n} von ${MILESTONES.length}`, W / 2, SH / 2 - 28, '800 15px "Baloo 2", sans-serif', '#c3b2ff', 'center', 3, '#0b0610');
  const sl = (1 - Math.min(1, k * 5)) * 30;
  txt(cx, c.title, W / 2 + sl, SH / 2 + 18, '400 34px "Titan One", sans-serif', '#ffd23a', 'center', 7, '#2a0a3a');
  L(cx, [W / 2 - 240, SH / 2 + 30, W / 2 - 60, SH / 2 + 30], 2, 'rgba(255,210,58,0.6)'); L(cx, [W / 2 + 60, SH / 2 + 30, W / 2 + 240, SH / 2 + 30], 2, 'rgba(255,210,58,0.6)');
  cx.restore();
}
// Hotspot-Hilfe: dezente, pulsierende Punkte an allem, was man benutzen kann (Einstellung)
function drawHotspotHelp(room) {
  if (!G.settings.hotspots || G.t < G.reveal || G.busy || G.dialog) return;
  const pulse = 0.5 + 0.5 * Math.sin(G.t * 0.004);
  for (const o of room.objs) if (isVisible(o)) { const [x, y] = hotspotCenter(o); cx.globalAlpha = 0.35 + pulse * 0.25; E(cx, x, y, 4, 4, o.exit ? '#7fe8ff' : '#ffe066', 1.5, 0, '#1b1020'); }
  for (const a of Object.values(ACT)) if (a.room === room.id && a.visible && a.id !== curId()) { cx.globalAlpha = 0.35 + pulse * 0.25; E(cx, a.x, a.y - a.h * roomScale(room, a.y) * 0.55, 4, 4, '#ff9ad9', 1.5, 0, '#1b1020'); }
  cx.globalAlpha = 1;
}
function drawFly() {
  drawSendFly();
  G.fly = G.fly.filter(f => G.t - f.t0 < 700);
  for (const f of G.fly) {
    const idx = inv().indexOf(f.id); if (idx < 0) continue;
    const s = UI.inv[idx], to = [s.x + s.w / 2, s.y + s.h / 2], k = Math.min(1, (G.t - f.t0) / 700), e = 1 - Math.pow(1 - k, 3);
    const x = f.from[0] + (to[0] - f.from[0]) * e, y = f.from[1] + (to[1] - f.from[1]) * e - Math.sin(k * Math.PI) * 110;
    cx.save(); cx.translate(x, y); cx.scale(1.6 - 0.6 * e, 1.6 - 0.6 * e); cx.rotate(Math.sin(k * Math.PI * 2) * 0.3); ICON[f.id](cx); cx.restore();
  }
}
const JUKEBOX = [['title', 'Titelmelodie'], ['present', 'Gegenwart'], ['lounge', 'Lobby-Lounge'], ['past', 'Jahr 1776'], ['tavern', 'Taverne „Zum Krummen Kamin“'], ['future', 'Zukunft'], ['march', 'Wachparade'], ['palace', 'Lilas Palast'], ['rock', 'Tentakel-Rock (Begleitband)'], ['ending', 'Abspann']];
const HELP = [
  'Maus: Verb anklicken, dann Gegenstand oder Person', 'Rechtsklick: Standard-Aktion · ohne Verb: hinlaufen',
  'Doppelklick/-tipp: rennen · Ausgänge sofort benutzen', 'Touch: tippen · lange drücken = Standard-Aktion',
  'Controller: Stick = Zeiger · Steuerkreuz = von Ziel zu Ziel', 'A Aktion · X Standard · B Zurück · Y Tipp · RS Pixel-Grafik',
  'LB/RB Figur wechseln · LT/RT Verb wählen · LS Klo-Post', 'Ansicht/Tab/Leertaste: Hotspots · F Vollbild · F1/P Pixel-Grafik',
  'Tastatur: Pfeile springen · Enter Aktion · 1–3 Figur · K Klo-Post', 'G Gib · N Nimm · B Benutze · S Schau an · R Rede mit',
  'Klo-Post: Gegenstand wählen → Gesicht unten rechts (geht überall) · O Foto',
  'Menü → Extras: Minispiele, Fotoalbum, Figuren-Steckbriefe, Musikbox, Erfolge',
  'M: Zeitreise-Karte – besuchte Orte deiner Zeit per Schnellreise erreichen',
];
function drawMenu() {
  // Pixel-Modus: Texte werden erst am Ende über die Pixel gelegt – alles darunter würde durch das Menü scheinen
  if (cx.isPix) cx.texts = cx.texts.filter(q => q.layer !== cx.layerIdx);
  if (G.menu === 'map') return drawMap();
  cx.fillStyle = 'rgba(10,5,18,0.72)'; cx.fillRect(0, 0, W, H);
  const items = menuItems();
  const extra = G.menu === 'bios' ? 3 * 140 + 8 : G.menu === 'album' ? 3 * 92 + 34 : G.menu === 'help' ? HELP.length * 23 + 10 : G.menu === 'ach' ? ACH.length * 28 + 10 : G.menu === 'notes' ? NOTES.length * 28 + 50 : G.menu === 'confirm' ? 24 : 0;
  const bw = G.menu === 'bios' ? 780 : G.menu === 'album' ? 640 : G.menu === 'help' || G.menu === 'ach' || G.menu === 'notes' ? 560 : 420, bh = 100 + extra + items.length * 46, bx = W / 2 - bw / 2, by = Math.max(12, 300 - bh / 2);
  R(cx, bx, by, bw, bh, '#1f1432', 3, 16, '#5a4290');
  const title = { confirm: 'Wirklich von vorn?', help: 'Steuerung', ach: `Erfolge ${achCount()}/${ACH.length}`, notes: 'Notizbuch', save: 'Spiel speichern', load: 'Spiel laden', settings: 'Einstellungen', jukebox: 'Musikbox', extras: 'Extras', album: 'Fotoalbum', bios: 'Figuren-Steckbriefe' }[G.menu] || 'Pause';
  txt(cx, title, W / 2, by + 48, '400 30px "Titan One", sans-serif', '#ffd23a', 'center', 5, OUT);
  let y = by + 74;
  if (G.menu === 'main' && G.state) { txt(cx, `Fortschritt: ${progress()} von ${MILESTONES.length} Rätseln`, W / 2, y - 2, '600 13px "Baloo 2", sans-serif', '#a99ad0'); y += 10; }
  if (G.menu === 'confirm') { txt(cx, 'Der aktuelle Spielstand geht dabei verloren.', W / 2, y + 6, '600 15px "Baloo 2", sans-serif', '#c3b2ff'); y += 24; }
  if (G.menu === 'help') {
    HELP.forEach((l, i) => txt(cx, l, W / 2, y + 12 + i * 23, '600 15px "Baloo 2", sans-serif', '#e6dcff'));
    y += HELP.length * 23 + 10;
  }
  if (G.menu === 'bios') { drawBios(bx, y); y += 3 * 140 + 8; }
  let photoBtns = [];
  if (G.menu === 'album') {
    const list = albumList();
    if (!list.length) txt(cx, 'Noch keine Fotos. Drück O (oder F2) im Spiel, um eins zu machen.', W / 2, y + 40, '600 15px "Baloo 2", sans-serif', '#c3b2ff');
    else if (cx.isPix) txt(cx, 'Die Fotos sind nur im HD-Modus zu sehen.', W / 2, y + 40, '600 15px "Baloo 2", sans-serif', '#c3b2ff');
    else list.forEach((ph, i) => {
      const r = { id: 'ph_' + i, x: bx + 26 + (i % 4) * 148, y: y + 8 + Math.floor(i / 4) * 92, w: 138, h: 86 };
      const im = albumImage(i, ph.src), hot = inRect(G.mouse.x, G.mouse.y, r);
      R(cx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, hot ? '#ffe066' : '#3d2c5e', 0, 6);
      if (im.complete && im.naturalWidth) cx.drawImage(im, r.x, r.y, r.w, r.h);
      photoBtns.push(r);
    });
    y += 3 * 92 + 34;
  }
  if (G.menu === 'notes' && G.state) {
    NOTES.forEach(([m, text], i) => {
      const done = milestoneDone(m), yy = y + 16 + i * 28;
      if (done) L(cx, [bx + 40, yy - 5, bx + 46, yy + 1, bx + 58, yy - 11], 3, '#7dff7a'); else E(cx, bx + 49, yy - 5, 6, 6, null, 2, 0, '#6a5a88');
      txt(cx, done ? text : '???', bx + 72, yy, '600 15px "Baloo 2", sans-serif', done ? '#e6dcff' : '#6a5a88', 'left');
    });
    y += NOTES.length * 28 + 8;
    const st = G.state.stats;
    txt(cx, `Spielzeit ${fmtTime(st.ms)} · Sendungen: ${st.sent} · Schritte: ${(st.steps || 0).toLocaleString('de-DE')} · Kristalle: ${crystalCount()}/${CRYSTAL_ROOMS.length}`, W / 2, y + 10, '700 14px "Baloo 2", sans-serif', '#ffd23a');
    txt(cx, 'Feststecken? Der Tipp-Knopf verrät den nächsten Schritt.', W / 2, y + 30, '600 13px "Baloo 2", sans-serif', '#a99ad0');
    y += 42;
  }
  if (G.menu === 'ach') {
    ACH.forEach((a, i) => {
      const got = !!G.ach[a.id], yy = y + 10 + i * 28;
      cx.globalAlpha = got ? 1 : 0.4; trophy(cx, bx + 34, yy, 0.8); cx.globalAlpha = 1;
      txt(cx, !got && a.secret ? 'Geheimer Erfolg' : a.name, bx + 56, yy + 2, '800 15px "Baloo 2", sans-serif', got ? '#ffd23a' : '#8a7aa8', 'left');
      txt(cx, got ? a.desc : '???', bx + 230, yy + 2, '600 13px "Baloo 2", sans-serif', got ? '#e6dcff' : '#6a5a88', 'left');
    });
    y += ACH.length * 28 + 10;
  }
  const btnW = G.menu === 'save' || G.menu === 'load' ? 360 : 300;
  G.menuBtns = photoBtns.concat(items.map((it, i) => ({ id: it.id, off: it.off, label: it.label, x: W / 2 - btnW / 2, y: y + 6 + i * 46, w: btnW, h: 38 })));
  G.menuBtns.filter(b => !b.id.startsWith('ph_')).forEach((b, i) => { cx.globalAlpha = b.off ? 0.45 : 1; button(b, items[i].label, !b.off && inRect(G.mouse.x, G.mouse.y, b)); cx.globalAlpha = 1; });
  if (G.menu === 'album' && G.albumView != null && !cx.isPix) {
    const ph = albumList()[G.albumView];
    if (ph) {
      cx.fillStyle = 'rgba(6,2,12,0.88)'; cx.fillRect(0, 0, W, H);
      const im = albumImage(G.albumView, ph.src);
      R(cx, 96, 46, 768, 480, '#000000', 4, 6, '#ffe066');
      if (im.complete && im.naturalWidth) cx.drawImage(im, 96, 46, 768, 480);
      txt(cx, new Date(ph.at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' · Klick zum Schließen', W / 2, 560, '700 15px "Baloo 2", sans-serif', '#e6dcff', 'center', 4, '#0b0610');
    }
  }
}
function drawCursor() {
  if (G.pointer === 'touch' || G.mouse.x < 0) return;
  const { x, y } = G.mouse, pad = G.pointer === 'pad';
  const hot = G.screen === 'game' ? (G.hover || (y >= SH && hitUI(x, y))) : G.titleBtns.some(b => inRect(x, y, b));
  const col = G.busy && G.screen === 'game' && !G.dialog && !G.menu ? '#8a7aa8' : hot ? '#ffe066' : '#ffffff';
  const s = pad ? 1.4 : 1;
  cx.lineCap = 'round';
  for (const [w, c] of [[5, '#0b0610'], [2, col]]) {
    cx.lineWidth = w; cx.strokeStyle = c; cx.beginPath();
    cx.moveTo(x - 12 * s, y); cx.lineTo(x - 4 * s, y); cx.moveTo(x + 4 * s, y); cx.lineTo(x + 12 * s, y);
    cx.moveTo(x, y - 12 * s); cx.lineTo(x, y - 4 * s); cx.moveTo(x, y + 4 * s); cx.lineTo(x, y + 12 * s); cx.stroke();
    if (pad) { cx.beginPath(); cx.arc(x, y, 15, 0, Math.PI * 2); cx.stroke(); }
  }
  if (pad && G.screen === 'game' && G.hover && y < SH && !G.busy) txt(cx, nameOf(G.hover), x, y - 24, '800 15px "Baloo 2", sans-serif', '#ffe066', 'center', 4, '#0b0610');
  if (G.screen === 'game' && G.hover && y < SH && !G.busy && !G.verb && !G.first && !G.dialog && !G.menu) { const v = defaultVerb(G.hover); if (v) verbBadge(x, y, v); }
}

// ---------- Titel & Ende ----------
function drawMansion(c, t) {
  const body = '#2e1440', trim = '#45205e', lit = i => Math.sin(t * 0.002 + i * 1.7) > -0.6, win = i => (lit(i) ? '#ffd25a' : '#8a5a2a');
  P(c, [70, 600, 470, 600, 462, 330, 78, 338], body, 4);
  P(c, [60, 344, 480, 336, 400, 250, 150, 262], trim, 4);
  for (let y = 274; y < 336; y += 13) {   // Dachziegel-Reihen
    const xl = 150 + (y - 262) / 82 * -90, xr = 400 + (y - 250) / 86 * 80;
    L(c, [xl + 4, y, xr - 4, y], 1.5, 'rgba(10,2,20,0.35)');
  }
  P(c, [110, 340, 180, 338, 176, 170, 116, 176], body, 4);
  P(c, [100, 182, 192, 176, 150, 92], trim, 4);
  P(c, [330, 336, 420, 334, 424, 190, 334, 196], body, 4);
  P(c, [320, 202, 436, 194, 384, 112], trim, 4);
  L(c, [384, 112, 384, 84], 2.5, '#1a0c26'); P(c, [384, 86, 404, 92, 384, 98], '#c89a3a', 2);   // Wetterfahne
  R(c, 252, 210, 24, 60, body, 4);
  const wins = [];
  for (let i = 0; i < 3; i++) wins.push([126, 196 + i * 46, 36, 30, i]);
  for (let i = 0; i < 2; i++) wins.push([356, 216 + i * 52, 44, 32, i + 4]);
  for (let i = 0; i < 4; i++) wins.push([110 + i * 88, 380, 50, 50, i + 7]);
  for (let i = 0; i < 4; i++) wins.push([110 + i * 88, 470, 50, 50, i + 12]);
  for (const [x, y, w, h, i] of wins) {
    R(c, x, y, w, h, win(i), 3, 4);
    L(c, [x + w / 2, y + 2, x + w / 2, y + h - 2], 2, 'rgba(40,16,30,0.55)'); L(c, [x + 2, y + h / 2, x + w - 2, y + h / 2], 2, 'rgba(40,16,30,0.55)');
  }
  if (!c.isPix) {   // warmes Licht strahlt aus den Fenstern
    for (const [x, y, w, h, i] of wins) if (lit(i)) glow(x + w / 2, y + h / 2, Math.max(w, h) * 1.3, '#ffbe5a', 0.32);
  }
  // Mondlicht auf den rechten Kanten
  for (const pts of [[462, 330, 470, 600], [400, 250, 480, 336], [176, 170, 180, 338], [150, 92, 192, 176], [424, 190, 420, 334], [384, 112, 436, 194]]) L(c, pts, 3, 'rgba(214,190,255,0.24)');
  R(c, 236, 530, 70, 70, '#6a3220', 4, 6); R(c, 246, 540, 22, 50, '#4a2014', 2, 3); R(c, 274, 540, 22, 50, '#4a2014', 2, 3);
  for (const lx of [222, 320]) {   // Laternen neben der Tür
    R(c, lx - 6, 534, 12, 18, '#ffcf6a', 2, 3);
    if (!c.isPix) { const g = c.createRadialGradient(lx, 543, 2, lx, 543, 40); g.addColorStop(0, 'rgba(255,200,110,0.45)'); g.addColorStop(1, 'rgba(255,200,110,0)'); c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(lx - 40, 503, 80, 80); c.restore(); }
  }
  for (let i = 0; i < 3; i++) { const k = ((t * 0.0003) + i / 3) % 1; c.save(); c.globalAlpha = (1 - k) * 0.5; E(c, 264 + Math.sin(t * 0.002 + i) * 10, 200 - k * 90, 10 + k * 18, 7 + k * 12, 'rgba(122,90,154,0.9)', 0); c.restore(); }
}
// Hügelkamm mit Tannen-Silhouetten (Ebenen für Tiefe)
function ridge(base, amp, col, seed, pineH) {
  const ry = x => base + Math.sin(x * 0.008 + seed) * amp + Math.sin(x * 0.021 + seed * 2) * amp * 0.45;
  S(cx, col, 0, () => { cx.moveTo(-4, H + 4); for (let x = -4; x <= W + 8; x += 16) cx.lineTo(x, ry(x)); cx.lineTo(W + 8, H + 4); cx.closePath(); });
  for (let i = 0; i < 34; i++) {
    const x = ((i * 97 + seed * 131) % (W + 40)) - 20, y = ry(x) + 2, h = pineH * (0.6 + ((i * 53) % 10) / 14);
    P(cx, [x - h * 0.32, y, x, y - h, x + h * 0.32, y], col, 0);
  }
}
function fog(y, alpha, speed, off) {
  for (let i = 0; i < 6; i++) {
    const x = ((G.t * speed + i * 260 + off) % 1500) - 270, yy = y + Math.sin(i * 1.7 + off) * 8;
    cx.save(); cx.translate(x, yy); cx.scale(1, 0.13);
    const g = cx.createRadialGradient(0, 0, 0, 0, 0, 210); g.addColorStop(0, `rgba(206,176,236,${alpha})`); g.addColorStop(1, 'rgba(206,176,236,0)');
    cx.fillStyle = g; cx.fillRect(-210, -210, 420, 420); cx.restore();
  }
}
const TITLE_LIGHT = [1, '#e0d2ff', '#10081f'];
function titleActor(id, x, y, sc, dir, seed, extra) {
  const base = ACT[id], a = Object.assign({ ...base, x, y, dir, walking: false, talking: false, target: null, seed }, extra);
  cx.fillStyle = 'rgba(0,0,0,0.3)'; cx.beginPath(); cx.ellipse(x - 6 * sc, y + 2, 34 * sc * (base.shadowW || 1), 7 * sc, 0, 0, Math.PI * 2); cx.fill();
  if (cx.isPix) { cx.save(); cx.translate(x, y); cx.scale(sc * dir, sc); CHAR[base.kind](cx, a, G.t); cx.restore(); }
  else drawActorLit(a, sc, TITLE_LIGHT, 0);
  if (G.settings.party) { const [hx, hk] = HAT[base.kind] || [0, 0.97]; hatAt(x + hx * sc * dir, y - base.h * hk * sc + bobY(a, G.t) * sc, sc, dir, seed); }
}
function drawTitle() {
  const t = G.t;
  const sky = () => {
    cx.fillStyle = grad(cx, 0, 0, 0, H, [[0, '#090320'], [0.45, '#27104a'], [0.75, '#561e62'], [1, '#9a426c']]); cx.fillRect(0, 0, W, H);
    if (!cx.isPix) for (let i = 0; i < 160; i++) {   // Milchstraße
      const k = (i * 0.618) % 1, x = k * W, y = 60 + (1 - k) * 260 + Math.sin(i * 12.9) * 46;
      E(cx, x, y, 0.9, 0.9, `rgba(230,210,255,${0.12 + 0.18 * Math.abs(Math.sin(i * 3.1))})`, 0);
    }
  };
  if (cx.isPix) sky(); else cachedLayer('titleSky', H, sky);
  for (let i = 0; i < 70; i++) { const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.001 + i)); E(cx, (i * 173) % W, (i * 89) % 380, 1.4, 1.4, i % 9 === 0 ? `rgba(255,220,180,${a})` : `rgba(255,255,255,${a})`, 0); }
  for (let i = 0; i < 8; i++) {   // ein paar größere Funkelsterne
    const x = 40 + (i * 389 + 70) % (W - 80), y = 26 + (i * 127) % 320, tw = Math.sin(t * 0.0035 + i * 2.1);
    if (tw < 0.25) continue;
    cx.globalAlpha = Math.min(1, tw * 1.3); L(cx, [x - 5, y, x + 5, y], 1.5, '#ffffff'); L(cx, [x, y - 5, x, y + 5], 1.5, '#ffffff'); E(cx, x, y, 1.4, 1.4, '#ffffff', 0); cx.globalAlpha = 1;
  }
  // Mond mit Hof
  for (const [r, a] of [[230, 0.16], [140, 0.22]]) { const mg = cx.createRadialGradient(800, 140, 40, 800, 140, r); mg.addColorStop(0, `rgba(255,236,196,${a})`); mg.addColorStop(1, 'rgba(255,236,196,0)'); cx.fillStyle = mg; cx.fillRect(800 - r, 140 - r, r * 2, r * 2); }
  E(cx, 800, 140, 66, 66, '#fff0c4', 3, 0, '#d8b070');
  if (G.moonWink && G.t - G.moonWink < 1400) {   // der Mond hat ein Gesicht – für einen Moment
    const k = (G.t - G.moonWink) / 1400, a = Math.min(1, k * 8, (1 - k) * 5);
    cx.save(); cx.globalAlpha = a;
    E(cx, 782, 128, 5, 7, '#6a4a2a', 0); L(cx, [808, 130, 814, 126, 822, 130], 3, '#6a4a2a');
    S(cx, null, 3, () => { cx.moveTo(780, 158); cx.quadraticCurveTo(800, 174, 822, 156); }, '#6a4a2a');
    E(cx, 774, 150, 7, 4, 'rgba(255,140,140,0.5)', 0); E(cx, 828, 150, 7, 4, 'rgba(255,140,140,0.5)', 0);
    cx.restore();
  }
  for (const [x, y, rx, ry] of [[778, 118, 13, 10], [826, 160, 10, 8], [812, 116, 6, 5], [784, 166, 7, 6]]) E(cx, x, y, rx, ry, 'rgba(226,196,140,0.55)', 0);
  for (let i = 0; i < 3; i++) {   // Wolken ziehen vor dem Mond vorbei, Unterkante vom Mond angeleuchtet
    const wx = ((t * (0.01 + i * 0.004) + i * 470) % 1500) - 260, wy = 104 + i * 46, s = 1 + i * 0.25;
    cx.save(); cx.globalAlpha = 0.85 - i * 0.12;
    for (const [dx, dy, rx, ry] of [[0, 0, 70, 20], [-46, 6, 44, 15], [48, 5, 50, 16], [10, -12, 40, 17]]) E(cx, wx + dx * s, wy + dy * s, rx * s, ry * s, '#3e1f5e', 0);
    for (const [dx, dy, rx, ry] of [[4, 12, 60, 6], [-40, 14, 30, 4]]) E(cx, wx + dx * s, wy + dy * s, rx * s, ry * s, 'rgba(255,214,170,0.22)', 0);
    cx.restore();
  }
  const sk = (t % 5600) / 800;   // Sternschnuppe alle paar Sekunden
  if (sk < 1) {
    const n = Math.floor(t / 5600), sx = 120 + (n * 263) % 560, sy = 40 + (n * 71) % 120, ex = sx + 170 * sk, ey = sy + 60 * sk;
    cx.save(); cx.globalAlpha = Math.sin(sk * Math.PI);
    cx.strokeStyle = grad(cx, ex - 90, ey - 32, ex, ey, [[0, 'rgba(255,255,255,0)'], [1, '#ffffff']]); cx.lineWidth = 2.5; cx.lineCap = 'round';
    cx.beginPath(); cx.moveTo(Math.max(sx, ex - 90), Math.max(sy, ey - 32)); cx.lineTo(ex, ey); cx.stroke(); E(cx, ex, ey, 2.2, 2.2, '#ffffff', 0);
    cx.restore();
  }
  // Landschaft in Ebenen: ferne Hügel, Nebel, nähere Hügel
  if (cx.isPix) { ridge(432, 16, '#3c1d5e', 1, 30); ridge(478, 12, '#26123f', 4, 40); }
  else { cachedLayer('ridge1', H, () => ridge(432, 16, '#3c1d5e', 1, 30)); fog(470, 0.26, 0.006, 0); cachedLayer('ridge2', H, () => ridge(478, 12, '#26123f', 4, 40)); }
  // Fledermäuse um den Turm
  const scare = G.batScare && G.t - G.batScare < 2500 ? (G.t - G.batScare) / 2500 : 0;
  for (let i = 0; i < 3; i++) {
    const x = 374 + Math.cos(t * 0.0011 + i * 2.1) * (80 + i * 14) + scare * (i - 1) * 400, y = 150 + Math.sin(t * 0.0017 + i) * 40 - scare * 260 * (1 - scare * 0.5), wy = Math.sin(t * (scare ? 0.06 : 0.022) + i * 3) * 5;
    L(cx, [x - 9, y - wy, x - 4, y, x, y - 2, x + 4, y, x + 9, y - wy], 2.2, '#12081c');
  }
  cx.save(); cx.translate(-10, 0); drawMansion(cx, t); cx.restore();
  const fk = (t % 17000) / 3600;   // ab und zu saust das Chrono-Klo durch die Zeit
  if (fk < 1) {
    const kx = -90 + fk * (W + 180), ky = 262 - Math.sin(fk * Math.PI) * 70;
    for (let i = 1; i <= 8; i++) glow(kx - i * 26, ky + i * 6, 24 - i * 1.5, ['#ff5fa8', '#ffd23a', '#7fe8ff', '#a6ff8f'][i % 4], 0.7 - i * 0.07);
    cx.save(); cx.translate(kx, ky); cx.rotate(Math.sin(t * 0.006) * 0.25 + 0.2); cx.scale(1.6, 1.6);
    R(cx, -11, -16, 22, 32, '#7a3ab8', 2, 4); S(cx, '#9a5ad8', 2, () => cx.ellipse(0, -16, 13, 7, 0, Math.PI, 0)); E(cx, 0, -4, 3.5, 3.5, '#ffe066', 0);
    cx.restore();
  }
  if (!cx.isPix) fog(552, 0.2, 0.009, 400);
  // Vordergrund-Hügel
  S(cx, grad(cx, 0, 520, 0, H, [[0, '#2a5236'], [1, '#0c2214']]), 0, () => { cx.moveTo(-4, 566); cx.quadraticCurveTo(260, 522, 500, 558); cx.quadraticCurveTo(740, 592, 964, 546); cx.lineTo(964, 604); cx.lineTo(-4, 604); cx.closePath(); });
  S(cx, 'rgba(210,190,255,0.12)', 0, () => { cx.moveTo(500, 558); cx.quadraticCurveTo(740, 592, 964, 546); cx.lineTo(964, 552); cx.quadraticCurveTo(740, 598, 500, 564); cx.closePath(); });
  // die drei Helden im Mondlicht, gegenüber Lila Tentakel; Grüner Tentakel links
  titleActor('green', 46, 604, 1.05, -1, 2);
  titleActor('bernard', 292, 590, 0.6, 1, 1);
  titleActor('hoagie', 352, 592, 0.6, 1, 3);
  titleActor('laverne', 410, 588, 0.6, 1, 5);
  titleActor('lila', 512, 604, 1.2, -1, 0);
  // Gras und Glühwürmchen
  for (let i = 0; i < (cx.isPix ? 14 : 40); i++) {
    const gx = (i * 167 + 30) % W, gy = 566 + ((i * 71) % 34), sw = Math.sin(t * 0.002 + i) * 2;
    L(cx, [gx - 4, gy, gx - 6 + sw, gy - 9], 2, '#3f7a48'); L(cx, [gx, gy, gx + sw, gy - 12], 2, '#4f9458'); L(cx, [gx + 4, gy, gx + 6 + sw, gy - 9], 2, '#3f7a48');
  }
  if (!cx.isPix) {
    for (let i = 0; i < 12; i++) {
      const x = (i * 211 + Math.sin(t * 0.0007 + i) * 60 + 960) % W, y = 520 + Math.sin(t * 0.0011 + i * 2) * 34, a = 0.5 + 0.5 * Math.sin(t * 0.006 + i * 5);
      glow(x, y, 12, '#e2ff8c', 0.55 * a);
    }
    const vg = cx.createRadialGradient(W / 2, H * 0.45, 300, W / 2, H * 0.5, 720); vg.addColorStop(0, 'rgba(8,2,18,0)'); vg.addColorStop(1, 'rgba(8,2,18,0.5)');
    cx.fillStyle = vg; cx.fillRect(0, 0, W, H);
  }
  // Logo: dunkler Hof, Tiefe, Verlauf und ein Glanzlicht, das über die Buchstaben wandert
  if (!cx.isPix) { const lg = cx.createRadialGradient(W / 2, 100, 40, W / 2, 100, 380); lg.addColorStop(0, 'rgba(14,4,30,0.5)'); lg.addColorStop(1, 'rgba(14,4,30,0)'); cx.fillStyle = lg; cx.fillRect(0, 0, W, 260); }
  const title = 'TENTAKEL-TOAST', font = '400 74px "Titan One", sans-serif';
  cx.font = font;
  const tw = cx.measureText(title).width, gl = ((t * 0.0045) % 26) - 6; let x = W / 2 - tw / 2;
  for (let i = 0; i < title.length; i++) {
    const ch = title[i], w = cx.measureText(ch).width, y = 106 + Math.sin(t * 0.004 + i * 0.6) * 6, hl = Math.max(0, 1 - Math.abs(gl - i) / 1.6);
    cx.save(); cx.translate(x + w / 2, y); cx.rotate(Math.sin(t * 0.003 + i) * 0.05);
    txt(cx, ch, 0, 8, font, '#6a1838', 'center', 12, '#2a0a3a');
    txt(cx, ch, 0, 0, font, grad(cx, 0, -60, 0, 0, [[0, mix('#fff0a0', '#ffffff', hl)], [0.5, mix('#ffd04a', '#fff6d0', hl * 0.8)], [1, '#ff7a30']]), 'center', 12, '#2a0a3a');
    cx.restore(); x += w;
  }
  for (const [sx, sy, ph] of [[178, 52, 0], [790, 70, 2], [700, 34, 4], [256, 132, 1]]) {   // Funkeln am Logo
    const k = Math.sin(t * 0.004 + ph * 1.7); if (k < 0.2) continue;
    const r = 3 + k * 6; cx.globalAlpha = k; L(cx, [sx - r, sy, sx + r, sy], 2, '#fff6d0'); L(cx, [sx, sy - r, sx, sy + r], 2, '#fff6d0'); cx.globalAlpha = 1;
  }
  // Untertitel auf einem Banner
  const sub = 'Ein inoffizielles Day-of-the-Tentacle-Fanspiel';
  cx.font = '700 19px "Baloo 2", sans-serif';
  const sw2 = cx.measureText(sub).width + 50, x0 = W / 2 - sw2 / 2, x1 = W / 2 + sw2 / 2;
  P(cx, [x0 - 28, 140, x0 + 6, 138, x0 + 6, 168, x0 - 28, 170, x0 - 16, 154], '#5a1446', 2.5);
  P(cx, [x1 + 28, 140, x1 - 6, 138, x1 - 6, 168, x1 + 28, 170, x1 + 16, 154], '#5a1446', 2.5);
  P(cx, [x0, 132, x1, 132, x1, 162, x0, 162], '#8a2a6a', 3);
  txt(cx, sub, W / 2, 153, '700 19px "Baloo 2", sans-serif', '#fff0fa', 'center', 4, '#3a0a2a');
  const bx = 596, bw = 300, btns = [];
  if (G.saved) btns.push({ id: 'cont', label: 'Weiterspielen', big: true });
  btns.push({ id: 'new', label: G.saved ? 'Neues Spiel' : 'Spiel starten', big: !G.saved });
  if (G.hasSaves) btns.push({ id: 'load', label: 'Spielstand laden' });
  btns.push({ id: 'voice', label: 'Sprachausgabe: ' + (!Voice.available ? 'nicht verfügbar' : G.settings.voice ? 'an' : 'aus') });
  btns.push({ id: 'music', label: 'Musik: ' + (G.settings.music ? 'an' : 'aus') });
  btns.push({ id: 'retro', label: 'Grafik: ' + (G.settings.retro ? 'Klassisch (Pixel)' : 'Remastered') });
  if (fsAvailable) btns.push({ id: 'fs', label: 'Vollbild beim Start: ' + (G.settings.fullscreen ? 'an' : 'aus') });
  let y = (G.saved ? 236 : 262) - (G.hasSaves ? 22 : 0);
  G.titleBtns = btns.map(b => { const r = { ...b, x: bx, y, w: bw, h: b.big ? 50 : 34 }; y += r.h + 10; return r; });
  const p0 = G.titleBtns[0].y - 18;
  R(cx, bx - 18, p0, bw + 36, y + 30 - p0, 'rgba(20,9,38,0.72)', 2.5, 18, '#7a5ab8');
  L(cx, [bx - 4, p0 + 3, bx + bw + 4, p0 + 3], 1.5, 'rgba(255,255,255,0.14)');
  for (const b of G.titleBtns) {
    const hot = inRect(G.mouse.x, G.mouse.y, b);
    b.hs = (b.hs || 1) + ((hot ? 1.045 : 1) - (b.hs || 1)) * 0.25;
    cx.save(); cx.translate(b.x + b.w / 2, b.y + b.h / 2); cx.scale(b.hs, b.hs); cx.translate(-b.x - b.w / 2, -b.y - b.h / 2);
    if (hot) R(cx, b.x - 2, b.y - 2, b.w + 4, b.h + 4, 'rgba(255,224,102,0.16)', 0, 14);
    R(cx, b.x, b.y, b.w, b.h, b.big ? (hot ? '#ffe066' : '#ffd23a') : (hot ? '#3a2758' : '#251640'), 3, 12, b.big ? '#5a2a10' : (hot ? '#ffe066' : '#6a52a0'));
    txt(cx, b.label, b.x + b.w / 2, b.y + b.h / 2 + (b.big ? 8 : 6), b.big ? '400 22px "Titan One", sans-serif' : '700 16px "Baloo 2", sans-serif', b.big ? '#2a0a3a' : (hot ? '#ffe066' : '#e6dcff'));
    cx.restore();
  }
  txt(cx, 'Spielbar mit Maus, Touch, Tastatur oder Xbox-Controller', bx + bw / 2, y + 16, '600 13px "Baloo 2", sans-serif', 'rgba(255,240,255,0.8)');
  txt(cx, 'Fan-Projekt · nicht verbunden mit LucasArts, Disney oder Double Fine', W / 2 + 140, H - 14, '600 12px "Baloo 2", sans-serif', 'rgba(255,240,255,0.7)');
}
const TITLE_HITS = [['green', 0, 440, 92, 600], ['bernard', 270, 450, 316, 592], ['hoagie', 326, 476, 386, 594], ['laverne', 390, 456, 434, 590], ['lila', 468, 396, 562, 604]];
function titleEgg(x, y) {
  if (Math.hypot(x - 800, y - 140) < 66) { G.moonWink = G.t; Sound.sfx('wink'); return true; }
  for (let i = 0; i < 3; i++) {
    const t = G.t, bx = 374 + Math.cos(t * 0.0011 + i * 2.1) * (80 + i * 14), by = 150 + Math.sin(t * 0.0017 + i) * 40;
    if (Math.hypot(x - bx, y - by) < 22 && !(G.batScare && G.t - G.batScare < 2500)) { G.batScare = G.t; Sound.sfx('squeak'); return true; }
  }
  const h = TITLE_HITS.find(([, x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
  if (h) {
    const id = h[0], lines = BARKS[id] || IDLE[id];
    G.titleBark = { id, x: (h[1] + h[3]) / 2, y: h[2] - 8, text: pick(lines), start: G.t, until: G.t + 2600, babbleEnd: G.t + 1200 };
    return true;
  }
  return false;
}
function drawTitleBark() {
  const b = G.titleBark; if (!b || G.t > b.until) return;
  cx.font = '700 17px "Baloo 2", system-ui, sans-serif';
  const lines = wrap(b.text, 260), lh = 19, maxW = Math.max(...lines.map(l => cx.measureText(l).width));
  const x = Math.max(maxW / 2 + 12, Math.min(W - maxW / 2 - 12, b.x));
  cx.save(); cx.globalAlpha = Math.max(0, Math.min(1, (b.until - G.t) / 300, (G.t - b.start) / 150));
  cx.textAlign = 'center'; cx.lineJoin = 'round';
  lines.forEach((l, i) => { const ly = b.y - (lines.length - 1 - i) * lh; cx.lineWidth = 4; cx.strokeStyle = '#0b0610'; cx.strokeText(l, x, ly); cx.fillStyle = ACT[b.id].color; cx.fillText(l, x, ly); });
  cx.restore();
}
function titleClick(x, y) {
  if (G.menu) return menuClick(x, y);
  const b = G.titleBtns.find(b => inRect(x, y, b)); if (!b) { titleEgg(x, y); return; }
  Sound.sfx('click');
  if (b.id === 'load') G.menu = 'load';
  else if (b.id === 'cont') continueGame(G.saved);
  else if (b.id === 'new') startNew();
  else if (b.id === 'voice') toggleVoice();
  else if (b.id === 'music') toggleMusic();
  else if (b.id === 'retro') toggleRetro();
  else if (b.id === 'fs') { G.settings.fullscreen = !G.settings.fullscreen; saveSettings(); if (G.settings.fullscreen) enterFullscreen(); else exitFullscreen(); }
}
function fmtTime(ms) { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
const FW = { rockets: [], sparks: [], conf: [], next: 0 };
const FW_COLS = ['#ffd23a', '#ff5fa8', '#7fe8ff', '#a6ff8f', '#d79bff', '#ffffff'];
const CREDITS = [
  ['Tentakel-Toast', 'ein inoffizielles Fanspiel'],
  ['Idee, Code, Grafik und Musik', 'komplett neu und prozedural im Browser erzeugt'],
  ['Licht, Schatten und Feuerwerk', 'gezeichnet auf einem einzigen Canvas'],
  ['Musik und Geräusche', 'live aus dem WebAudio-Synthesizer'],
  ['Day of the Tentacle', '© LucasArts / Disney · Remastered von Double Fine'],
  ['Danke fürs Spielen!', 'Und denk dran: Frühstück ist die wichtigste Mahlzeit der Weltrettung.'],
];
function updateEnd(dt) {
  if (G.screen !== 'end') return;
  const s = dt / 1000;
  if (G.t >= FW.next) {
    const x = 110 + Math.random() * 740;
    FW.rockets.push({ x0: x, x1: x + (Math.random() - 0.5) * 120, y1: 70 + Math.random() * 170, t0: G.t, col: pick(FW_COLS) });
    Sound.sfx('firework', panX(x)); FW.next = G.t + 650 + Math.random() * 900;
  }
  for (let i = FW.rockets.length - 1; i >= 0; i--) {
    const r = FW.rockets[i], k = (G.t - r.t0) / 600;
    if (k >= 1) {
      FW.rockets.splice(i, 1);
      const n = G.quality < 1 ? 36 : 64, col2 = pick(FW_COLS);
      for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2, v = 90 + Math.random() * 140; FW.sparks.push({ x: r.x1, y: r.y1, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 1100 + Math.random() * 800, col: j % 3 ? r.col : col2 }); }
    }
  }
  for (let i = FW.sparks.length - 1; i >= 0; i--) {
    const p = FW.sparks[i]; p.life += dt;
    if (p.life > p.max) { FW.sparks.splice(i, 1); continue; }
    p.vx *= 0.985; p.vy = p.vy * 0.985 + 70 * s; p.x += p.vx * s; p.y += p.vy * s;
  }
  while (FW.conf.length < 46) FW.conf.push({ x: Math.random() * W, y: -10 - Math.random() * H, v: 40 + Math.random() * 50, r: Math.random() * 6, sp: (Math.random() - 0.5) * 6, col: pick(FW_COLS) });
  for (const c of FW.conf) { c.y += c.v * s; c.x += Math.sin(G.t * 0.002 + c.r * 3) * 20 * s; c.r += c.sp * s; if (c.y > H + 10) { c.y = -10; c.x = Math.random() * W; } }
}
function drawEnd() {
  const t = G.t, hd = !cx.isPix;
  cx.fillStyle = grad(cx, 0, 0, 0, H, [[0, '#080320'], [0.55, '#2a0f4a'], [1, '#6a2a6e']]); cx.fillRect(0, 0, W, H);
  for (let i = 0; i < (hd ? 80 : 30); i++) { const a = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.0012 + i)); E(cx, (i * 173) % W, (i * 89) % 330, 1.3, 1.3, `rgba(255,255,255,${a})`, 0); }
  // Feuerwerk
  for (const r of FW.rockets) {
    const k = (G.t - r.t0) / 600, x = r.x0 + (r.x1 - r.x0) * k, y = H - (H - r.y1) * (1 - Math.pow(1 - k, 2));
    L(cx, [x, y, x - (r.x1 - r.x0) * 0.05, y + 26], 2.5, 'rgba(255,230,180,0.7)'); E(cx, x, y, 2.5, 2.5, '#fff6d0', 0);
  }
  for (const p of FW.sparks) {
    const a = 1 - p.life / p.max;
    if (hd) glow(p.x, p.y, 8, p.col, 0.85 * a);
    else { cx.globalAlpha = a; E(cx, p.x, p.y, 1.8, 1.8, p.col, 0); cx.globalAlpha = 1; }
  }
  // Hügel mit allen Figuren
  S(cx, grad(cx, 0, 520, 0, H, [[0, '#2a5236'], [1, '#0c2214']]), 0, () => { cx.moveTo(-4, 572); cx.quadraticCurveTo(480, 528, 964, 572); cx.lineTo(964, 604); cx.lineTo(-4, 604); cx.closePath(); });
  const cast = [['green', 70, 1.0, 1], ['bernard', 180, 0.62, 1], ['hoagie', 262, 0.62, 1], ['laverne', 344, 0.62, 1], ['lila', 480, 0.92, 1], ['drfred', 614, 0.66, -1], ['gertrude', 704, 0.62, -1], ['hancock', 792, 0.62, -1], ['wache', 892, 0.9, -1]];
  cast.forEach(([id, x, sc, dir], i) => {
    const y = 586 - Math.sin((x - 480) / 480 * Math.PI / 2 + Math.PI / 2) * 0 - Math.abs(Math.sin(t * 0.004 + i * 1.3)) * 6;
    titleActor(id, x, y, sc, dir, i, { talking: Math.sin(t * 0.0021 + i * 2.2) > 0.7, nice: id === 'lila' ? 1 : 0 });
  });
  // Konfetti
  for (const c of (hd ? FW.conf : FW.conf.slice(0, 16))) { cx.save(); cx.translate(c.x, c.y); cx.rotate(c.r); cx.scale(1, Math.abs(Math.cos(c.r * 1.7)) + 0.2); cx.fillStyle = c.col; cx.fillRect(-3, -2, 6, 4); cx.restore(); }
  // Titel, Statistik, Abspann
  if (hd) { const lg = cx.createRadialGradient(W / 2, 120, 40, W / 2, 120, 360); lg.addColorStop(0, 'rgba(14,4,30,0.55)'); lg.addColorStop(1, 'rgba(14,4,30,0)'); cx.fillStyle = lg; cx.fillRect(0, 0, W, 300); }
  const gl = ((t * 0.004) % 14) - 3;
  ['E', 'N', 'D', 'E'].forEach((ch, i) => {
    const x = W / 2 + (i - 1.5) * 76, y = 122 + Math.sin(t * 0.004 + i * 0.8) * 6, hl = Math.max(0, 1 - Math.abs(gl - i) / 1.4);
    txt(cx, ch, x, y + 8, '400 96px "Titan One", sans-serif', '#6a1838', 'center', 12, '#2a0a3a');
    txt(cx, ch, x, y, '400 96px "Titan One", sans-serif', grad(cx, 0, y - 80, 0, y, [[0, mix('#fff0a0', '#ffffff', hl)], [1, '#ff7a30']]), 'center', 12, '#2a0a3a');
  });
  txt(cx, 'Lila Tentakel ist jetzt nett. Vorerst.', W / 2, 172, '700 24px "Baloo 2", sans-serif', '#f3e6ff', 'center', 5, '#2a0a3a');
  const st = G.endStats || { ms: 0, sent: 0 }, steps = G.state && G.state.stats.steps ? ` · ${G.state.stats.steps.toLocaleString('de-DE')} Schritte` : '';
  txt(cx, `Spielzeit ${fmtTime(st.ms)} · Sendungen: ${st.sent}${steps} · Erfolge: ${achCount()}/${ACH.length} · Kristalle: ${G.state ? crystalCount() : 0}/${CRYSTAL_ROOMS.length}`, W / 2, 204, '800 16px "Baloo 2", sans-serif', '#ffd23a', 'center', 4, '#2a0a3a');
  const ci = Math.floor(t / 3600) % CREDITS.length, ck = (t % 3600) / 3600, ca = Math.min(1, ck * 6, (1 - ck) * 6);
  cx.save(); cx.globalAlpha = ca;
  txt(cx, CREDITS[ci][0], W / 2, 246, '400 22px "Titan One", sans-serif', '#ffffff', 'center', 5, '#2a0a3a');
  txt(cx, CREDITS[ci][1], W / 2, 270, '600 15px "Baloo 2", sans-serif', '#d7c6ff', 'center', 4, '#2a0a3a');
  cx.restore();
  const bt = { x: W / 2 - 130, y: 294, w: 260, h: 40 }; G.endBtn = bt;
  R(cx, bt.x, bt.y, bt.w, bt.h, inRect(G.mouse.x, G.mouse.y, bt) ? '#ffe066' : '#ffd23a', 3, 12, '#5a2a10');
  txt(cx, 'Nochmal von vorn', W / 2, bt.y + 28, '400 20px "Titan One", sans-serif', '#2a0a3a');
}
function endClick(x, y) { if (G.endBtn && inRect(x, y, G.endBtn)) { G.saved = null; G.hasSaves = anySave(); G.screen = 'title'; music(); } }

// ---------- Minispiel: Tentakel-Rock (Rhythmus-Spiel mit dem Grünen Tentakel) ----------
const ROCK = { lanes: [400, 500, 600], cols: ['#7dff7a', '#ffe066', '#ff7ad9'], top: 70, hitY: 500, look: 1.6, keyLabels: ['A / ←', 'S / ↓', 'D / →'], padLabels: ['X', 'A', 'B'] };
const RK = { notes: [], score: 0, combo: 0, best: 0, hits: 0, fx: [], done: false, flash: [0, 0, 0], btns: [], start: 0, lastHit: 0 };
function rockLane(n) { return /^(E4|G4)$/.test(n) ? 0 : /^(A4|B4)$/.test(n) ? 1 : 2; }
const ROCK_KEY = 'tentakel-toast-rock-v1', ROCK_DIFF = { leicht: { look: 2.0, label: 'Leicht' }, normal: { look: 1.6, label: 'Normal' }, schwer: { look: 1.25, label: 'Schwer' } };
function rockBest() { try { return JSON.parse(localStorage.getItem(ROCK_KEY) || '{}') || {}; } catch (e) { return {}; } }
// Auswahl des Schwierigkeitsgrads; die Bühne läuft schon im Hintergrund
function startRock() {
  G.menu = null; G.screen = 'rock';
  Object.assign(RK, { phase: 'select', notes: [], score: 0, combo: 0, best: 0, hits: 0, fx: [], done: false, flash: [0, 0, 0], btns: [], lastHit: 0, record: false });
  Sound.ambience([]); Sound.play(null); Sound.setReverb(1.1, 0.12);
}
function beginRock(diff) {
  RK.phase = 'play'; RK.diff = diff; ROCK.look = ROCK_DIFF[diff].look;
  let notes = Sound.chart.map(c => ({ note: c.note, len: c.len || 0, lane: rockLane(c.note), t: c.beat * 0.5, state: 0 }));
  if (diff === 'leicht') notes = notes.filter(n => n.len || Math.abs(n.t * 2 - Math.round(n.t * 2)) < 0.01);   // nur Noten auf vollen Schlägen
  if (diff === 'schwer') notes = notes.concat(notes.filter((n, i) => i % 3 === 1 && !n.len).map(n => ({ ...n, t: n.t + 0.25, lane: (n.lane + 1) % 3 }))).sort((a, b) => a.t - b.t);
  RK.notes = notes;
  Sound.play(null); Sound.play('rock');
  RK.start = G.t + 150;
}
function rockTime() { const ac = Sound.ctx; return ac && Sound.songT0 && Sound.current === 'rock' ? ac.currentTime - Sound.songT0 : (G.t - RK.start) / 1000; }
function rockHit(lane) {
  if (RK.phase === 'select') { beginRock(['leicht', 'normal', 'schwer'][lane]); return; }
  if (RK.done) return;
  RK.flash[lane] = G.t;
  const now = rockTime();
  let best = null, bd = 1;
  for (const n of RK.notes) if (!n.state && n.lane === lane) { const d = Math.abs(n.t - now); if (d < bd) { bd = d; best = n; } }
  if (best && bd < 0.18) {
    best.state = 1; RK.hits++; RK.combo++; RK.best = Math.max(RK.best, RK.combo); RK.lastHit = G.t;
    const perfect = bd < 0.07, mult = 1 + Math.min(3, Math.floor(RK.combo / 8));
    RK.score += (perfect ? 100 : 50) * mult;
    RK.fx.push({ text: perfect ? 'Perfekt!' : 'Gut!', x: ROCK.lanes[lane], y: ROCK.hitY - 40, t0: G.t, col: perfect ? '#ffe066' : '#c8f0ff' });
    Sound.note('guitar', best.note, best.len ? best.len * 0.5 : 0.3);
    if (perfect) for (let i = 0; i < 8; i++) puff(ROCK.lanes[lane], ROCK.hitY, ROCK.cols[lane], 1, { vy: 120, vx: 160, r: 2.6, max: 500 });
  } else { RK.combo = 0; Sound.sfx('miss'); }
}
function updateRock() {
  if (G.screen !== 'rock' || RK.done || RK.phase !== 'play') return;
  const now = rockTime();
  for (const n of RK.notes) if (!n.state && now - n.t > 0.18) { n.state = 2; RK.combo = 0; RK.fx.push({ text: 'Daneben', x: ROCK.lanes[n.lane], y: ROCK.hitY - 40, t0: G.t, col: '#ff8a8a' }); }
  if (now > 33.5) {
    RK.done = true;
    const pct = RK.hits / RK.notes.length;
    if (pct >= 0.8) unlock('rockstar');
    const best = rockBest();
    if (RK.score > (best[RK.diff] || 0)) { best[RK.diff] = RK.score; RK.record = true; try { localStorage.setItem(ROCK_KEY, JSON.stringify(best)); } catch (e) { /* ok */ } }
    Sound.sfx('cheer');
  }
  RK.fx = RK.fx.filter(f => G.t - f.t0 < 700);
}
function endRock() { G.screen = G.state ? 'game' : 'title'; music(); }
function drawRock() {
  const t = G.t, now = rockTime(), beat = now / 0.5, bp = 1 - (beat - Math.floor(beat)), hd = !cx.isPix;
  // Bühne: Rückwand, Lautsprecher, wandernde Scheinwerfer, Publikum
  cx.fillStyle = grad(cx, 0, 0, 0, H, [[0, '#14062a'], [0.7, '#2a0e3e'], [1, '#08020e']]); cx.fillRect(0, 0, W, H);
  for (const x of [40, 840]) { R(cx, x, 250, 80, 150, '#1c1424', 3, 6); for (const yy of [290, 360]) { E(cx, x + 40, yy, 26 + bp * 2, 26 + bp * 2, '#2e2438', 3); E(cx, x + 40, yy, 9, 9, '#0c0812', 2); } }
  if (hd) {
    cx.save(); cx.globalCompositeOperation = 'lighter';
    ROCK.cols.forEach((col, i) => {
      const ang = Math.sin(t * 0.0009 + i * 2.1) * 0.5, x0 = 200 + i * 280;
      cx.save(); cx.translate(x0, -10); cx.rotate(ang);
      const g = cx.createLinearGradient(0, 0, 0, 520); g.addColorStop(0, hexA(col, 0.32)); g.addColorStop(1, hexA(col, 0));
      cx.fillStyle = g; cx.beginPath(); cx.moveTo(-14, 0); cx.lineTo(14, 0); cx.lineTo(120, 520); cx.lineTo(-120, 520); cx.closePath(); cx.fill(); cx.restore();
    });
    cx.restore();
  }
  R(cx, -4, 420, W + 8, 30, '#3a2238', 3, 0);   // Bühnenkante
  // Grüner Tentakel mit Gitarre
  const ga = { ...ACT.green, x: 200, y: 420 - bp * 4, dir: 1, walking: false, talking: G.t - RK.lastHit < 160, seed: 2 };
  if (hd) drawActorLit(ga, 1.3, [1, '#ffe2ff', '#140828'], 0); else { cx.save(); cx.translate(ga.x, ga.y); cx.scale(1.3, 1.3); CHAR.green(cx, ga, t); cx.restore(); }
  cx.save(); cx.translate(222, 330 - bp * 4); cx.rotate(-0.5);
  P(cx, [-30, -12, 8, -18, 18, -6, 8, 14, -30, 10], '#c8322e', 2.5); R(cx, 10, -4, 78, 7, '#6a3a1a', 2, 2); R(cx, 86, -7, 14, 13, '#2a1a10', 2, 3);
  E(cx, -8, -2, 6, 6, '#1a0a0a', 0); cx.restore();
  // Publikum wippt im Takt
  for (let i = 0; i < 22; i++) { const x = (i * 47 + 10) % W, y = 560 + ((i * 37) % 30) - Math.abs(Math.sin((beat + i * 0.3) * Math.PI)) * 8; E(cx, x, y, 18, 22, '#0a0410', 0); E(cx, x, y - 26, 11, 12, '#0a0410', 0); if (i % 4 === 0) L(cx, [x + 10, y - 20, x + 18, y - 52], 6, '#0a0410'); }
  // Bahnen, Trefferzone, Noten
  ROCK.lanes.forEach((x, i) => {
    R(cx, x - 38, ROCK.top - 20, 76, ROCK.hitY - ROCK.top + 60, 'rgba(10,4,24,0.55)', 2, 18, hexA(ROCK.cols[i], 0.35));
    const fl = Math.max(0, 1 - (t - RK.flash[i]) / 220);
    E(cx, x, ROCK.hitY, 30 + fl * 6, 30 + fl * 6, hexA(ROCK.cols[i], 0.18 + fl * 0.5), 4, 0, ROCK.cols[i]);
    txt(cx, G.pointer === 'pad' ? ROCK.padLabels[i] : ROCK.keyLabels[i], x, ROCK.hitY + 56, '800 15px "Baloo 2", sans-serif', '#e6dcff', 'center', 4, '#0b0610');
  });
  for (const n of RK.notes) {
    if (n.state === 1) continue;
    const dt = n.t - now; if (dt > ROCK.look || dt < -0.3) continue;
    const x = ROCK.lanes[n.lane], y = ROCK.hitY - dt / ROCK.look * (ROCK.hitY - ROCK.top), col = n.state === 2 ? '#6a5a7a' : ROCK.cols[n.lane];
    if (n.len) { const y2 = ROCK.hitY - (dt + n.len * 0.5) / ROCK.look * (ROCK.hitY - ROCK.top); R(cx, x - 8, Math.max(ROCK.top, y2), 16, y - Math.max(ROCK.top, y2), hexA(col, 0.5), 0, 8); }
    if (n.state !== 2) glow(x, y, 34, col, 0.5);
    E(cx, x, y, 22, 22, col, 3); E(cx, x - 6, y - 7, 7, 5, 'rgba(255,255,255,0.55)', 0);
  }
  drawParts();
  for (const f of RK.fx) { const k = (G.t - f.t0) / 700; cx.globalAlpha = 1 - k; txt(cx, f.text, f.x, f.y - k * 30, '400 22px "Titan One", sans-serif', f.col, 'center', 5, '#0b0610'); cx.globalAlpha = 1; }
  // Anzeige
  txt(cx, 'TENTAKEL-ROCK', 24, 44, '400 30px "Titan One", sans-serif', '#a6ff8f', 'left', 6, '#0b0610');
  txt(cx, 'Esc / Menü: beenden', 24, 66, '600 13px "Baloo 2", sans-serif', '#c3b2ff', 'left', 3, '#0b0610');
  txt(cx, `${RK.score}`, W - 24, 46, '400 32px "Titan One", sans-serif', '#ffe066', 'right', 6, '#0b0610');
  if (RK.combo > 2) txt(cx, `${RK.combo}er-Kombo · x${1 + Math.min(3, Math.floor(RK.combo / 8))}`, W - 24, 70, '800 15px "Baloo 2", sans-serif', '#ffffff', 'right', 4, '#0b0610');
  R(cx, 300, 18, 360, 10, 'rgba(255,255,255,0.12)', 0, 5); R(cx, 300, 18, 360 * Math.max(0, Math.min(1, now / 32)), 10, '#a6ff8f', 0, 5);
  if (now < 1.2) txt(cx, now < 0 ? 'Bereit?' : 'Los!', W / 2, 230, '400 54px "Titan One", sans-serif', '#ffe066', 'center', 9, '#0b0610');
  // Auswahl des Schwierigkeitsgrads
  RK.btns = [];
  if (RK.phase === 'select') {
    cx.fillStyle = 'rgba(8,3,18,0.6)'; cx.fillRect(0, 0, W, H);
    R(cx, W / 2 - 250, 110, 500, 360, '#1f1432', 3, 18, '#7a5ab8');
    txt(cx, 'Tentakel-Rock', W / 2, 166, '400 38px "Titan One", sans-serif', '#a6ff8f', 'center', 6, '#0b0610');
    txt(cx, 'Triff die Noten im Takt – du spielst die Lead-Gitarre!', W / 2, 198, '700 16px "Baloo 2", sans-serif', '#e6dcff');
    const best = rockBest();
    ['leicht', 'normal', 'schwer'].forEach((d, i) => {
      const b = { id: d, x: W / 2 - 160, y: 222 + i * 62, w: 320, h: 50 };
      RK.btns.push(b);
      button(b, `${ROCK_DIFF[d].label}${best[d] ? '   ·   Rekord ' + best[d] : ''}`, inRect(G.mouse.x, G.mouse.y, b), d === 'normal');
      txt(cx, G.pointer === 'pad' ? ROCK.padLabels[i] : ROCK.keyLabels[i].split(' ')[0], b.x - 26, b.y + 31, '800 16px "Baloo 2", sans-serif', ROCK.cols[i], 'center', 4, '#0b0610');
    });
    const bb = { id: 'back', x: W / 2 - 90, y: 412, w: 180, h: 38 }; RK.btns.push(bb); button(bb, 'Zurück zum Spiel', inRect(G.mouse.x, G.mouse.y, bb));
    return;
  }
  // Ergebnis
  if (RK.done) {
    cx.fillStyle = 'rgba(8,3,18,0.72)'; cx.fillRect(0, 0, W, H);
    const pct = RK.hits / RK.notes.length, rank = pct >= 0.95 ? 'Legende des Tentakel-Rock!' : pct >= 0.8 ? 'Rockstar!' : pct >= 0.55 ? 'Garagenband' : 'Nochmal üben, Mann.';
    R(cx, W / 2 - 230, 120, 460, 330, '#1f1432', 3, 18, '#7a5ab8');
    txt(cx, rank, W / 2, 180, '400 34px "Titan One", sans-serif', '#ffd23a', 'center', 6, '#2a0a3a');
    txt(cx, `${RK.hits} von ${RK.notes.length} Tönen · ${Math.round(pct * 100)} %`, W / 2, 224, '800 20px "Baloo 2", sans-serif', '#ffffff');
    txt(cx, `Punkte: ${RK.score} · beste Kombo: ${RK.best}`, W / 2, 254, '700 17px "Baloo 2", sans-serif', '#d7c6ff');
    txt(cx, RK.record ? `Neuer Rekord (${ROCK_DIFF[RK.diff].label})!` : `Rekord (${ROCK_DIFF[RK.diff].label}): ${rockBest()[RK.diff] || 0}`, W / 2, 284, '800 16px "Baloo 2", sans-serif', RK.record ? '#ffe066' : '#c3b2ff');
    if (pct >= 0.8) txt(cx, 'Erfolg: Tentakel-Rockstar', W / 2, 310, '800 15px "Baloo 2", sans-serif', '#a6ff8f');
    RK.btns = [{ id: 'again', label: 'Nochmal', x: W / 2 - 200, y: 340, w: 180, h: 44 }, { id: 'back', label: 'Zurück zum Spiel', x: W / 2 + 20, y: 340, w: 180, h: 44 }];
    for (const b of RK.btns) button(b, b.label, inRect(G.mouse.x, G.mouse.y, b));
  }
}
function rockClick(x, y) {
  if (RK.phase === 'select') { const b = RK.btns.find(b => inRect(x, y, b)); if (b) { Sound.sfx('click'); if (b.id === 'back') endRock(); else beginRock(b.id); } return; }
  if (RK.done) { const b = RK.btns.find(b => inRect(x, y, b)); if (!b) return; Sound.sfx('click'); if (b.id === 'again') startRock(); else endRock(); return; }
  const i = ROCK.lanes.findIndex(lx => Math.abs(x - lx) < 70);
  if (i >= 0 && y > ROCK.top - 30) rockHit(i);
}

// ---------- Minispiel: Gut-O-Mat (Toast-Timing) ----------
// Eine Nadel pendelt über die Röstskala; wer sie im goldbraunen Bereich stoppt, bekommt die meisten Punkte.
const TOASTER_KEY = 'tentakel-toast-toaster-v1';
const TS = { round: 0, rounds: 5, score: 0, results: [], phase: 'play', pos: 0, dir: 1, speed: 0, stopT: 0, line: '', btns: [] };
function startToaster() {
  G.menu = null; G.screen = 'toaster';
  Object.assign(TS, { round: 1, score: 0, results: [], phase: 'play', pos: 0, dir: 1, speed: 0.55, stopT: 0, line: 'Halte die Nadel im goldbraunen Bereich an!', btns: [], record: false });
  Sound.ambience([]); Sound.play('lounge'); Sound.setReverb(1.2, 0.12);
}
function toasterBest() { try { return +localStorage.getItem(TOASTER_KEY) || 0; } catch (e) { return 0; } }
function toasterPress() {
  if (TS.phase === 'play') {
    TS.phase = 'stop'; TS.stopT = G.t;
    const d = Math.abs(TS.pos - 0.62), pts = Math.max(0, Math.round(100 - d * 260));
    TS.last = { pos: TS.pos, pts }; TS.score += pts; TS.results.push(pts);
    const kind = TS.pos < 0.5 ? 'raw' : TS.pos > 0.76 ? 'burnt' : 'good';
    TS.line = pick(TOAST_LINES[kind]); TS.kind = kind;
    Sound.sfx('pop'); setTimeout(() => Sound.sfx(kind === 'good' ? 'ding' : 'bad'), 250);
    if (G.settings.babble) for (let i = 0; i < 6; i++) setTimeout(() => Sound.blip(ACT.drfred.voice, 0.3), 300 + i * 110);
  } else if (TS.phase === 'stop' && G.t - TS.stopT > 600) {
    if (TS.round >= TS.rounds) {
      TS.phase = 'done';
      if (TS.score >= 400) unlock('toastmeister');
      if (TS.score > toasterBest()) { TS.record = true; try { localStorage.setItem(TOASTER_KEY, String(TS.score)); } catch (e) { /* ok */ } }
      Sound.sfx('cheer');
    } else { TS.round++; TS.phase = 'play'; TS.pos = 0; TS.dir = 1; TS.speed = 0.55 + (TS.round - 1) * 0.22; TS.line = `Runde ${TS.round} – schneller!`; Sound.sfx('tick'); }
  }
}
function updateToaster(dt) {
  if (G.screen !== 'toaster' || TS.phase !== 'play') return;
  TS.pos += TS.dir * TS.speed * dt / 1000;
  if (TS.pos >= 1) { TS.pos = 1; TS.dir = -1; Sound.sfx('tick'); } else if (TS.pos <= 0) { TS.pos = 0; TS.dir = 1; Sound.sfx('tick'); }
}
function toastColor(p) {   // blass → goldbraun → verkohlt
  return p < 0.62 ? mix('#f2e2b4', '#d08a3a', p / 0.62) : mix('#d08a3a', '#2a1a12', Math.min(1, (p - 0.62) / 0.38));
}
function drawToaster() {
  const t = G.t, hd = !cx.isPix;
  cx.fillStyle = grad(cx, 0, 0, 0, H, [[0, '#1d2a3e'], [1, '#0c1220']]); cx.fillRect(0, 0, W, H);
  for (let i = 0; i < 12; i++) R(cx, i * 84, 360, 82, 82, i % 2 ? '#2a3a52' : '#24324a', 0, 0);   // Fliesen
  R(cx, 0, 440, W, 160, '#3a2a22', 0, 0); R(cx, 0, 440, W, 10, '#5a4030', 0, 0);   // Tresen
  // der Gut-O-Mat
  const sh = TS.phase === 'play' ? Math.sin(t * 0.05) * TS.speed * 1.5 : 0;
  cx.save(); cx.translate(480 + sh, 372);
  R(cx, -170, -110, 340, 210, '#dfe4ea', 4, 46); R(cx, -120, -150, 90, 30, '#3a3a44', 3, 10); R(cx, 30, -150, 90, 30, '#3a3a44', 3, 10);
  // Toast springt nach dem Stoppen heraus
  const pop = TS.phase !== 'play' ? Math.sin(Math.min(1, (t - TS.stopT) / 400) * Math.PI / 2) : 0;
  const col = toastColor(TS.phase === 'play' ? Math.min(0.5, TS.pos * 0.5) : TS.last ? TS.last.pos : 0);
  for (const ox of [-75, 75]) {
    cx.save(); cx.translate(ox, -150 - pop * 72);
    S(cx, mix(col, '#3a1a08', 0.35), 3, () => { cx.moveTo(-34, 40); cx.lineTo(-34, -10); cx.quadraticCurveTo(-42, -40, -16, -40); cx.quadraticCurveTo(0, -52, 16, -40); cx.quadraticCurveTo(42, -40, 34, -10); cx.lineTo(34, 40); cx.closePath(); });   // Kruste
    S(cx, col, 0, () => { cx.moveTo(-26, 34); cx.lineTo(-26, -8); cx.quadraticCurveTo(-32, -31, -12, -31); cx.quadraticCurveTo(0, -41, 12, -31); cx.quadraticCurveTo(32, -31, 26, -8); cx.lineTo(26, 34); cx.closePath(); });   // Krume
    for (const [px, py] of [[-12, -12], [8, -4], [-4, 12], [14, 18], [-16, 22]]) E(cx, px, py, 1.6, 1.2, mix(col, '#3a1a08', 0.25), 0);
    if (TS.phase !== 'play' && TS.kind === 'burnt' && hd) for (let i = 0; i < 3; i++) { const q = ((t * 0.0008) + i / 3) % 1; cx.globalAlpha = (1 - q) * 0.5; E(cx, Math.sin(i + t * 0.003) * 10, -50 - q * 80, 10 + q * 16, 7 + q * 10, '#5a5060', 0); cx.globalAlpha = 1; }
    cx.restore();
  }
  R(cx, -170, -110, 340, 210, null, 4, 46);
  // Röstskala mit Nadel
  const gx = 0, gy = 40, r = 120;
  const zones = [[0, 0.5, '#f2e2b4'], [0.5, 0.76, '#e0a040'], [0.76, 1, '#3a2418']];
  for (const [a0, a1, zc] of zones) { cx.beginPath(); cx.arc(gx, gy, r, Math.PI + a0 * Math.PI, Math.PI + a1 * Math.PI); cx.lineWidth = 26; cx.strokeStyle = zc; cx.stroke(); }
  cx.beginPath(); cx.arc(gx, gy, r, Math.PI, 2 * Math.PI); cx.lineWidth = 2; cx.strokeStyle = '#1b1020'; cx.stroke();
  const golden = Math.PI + 0.62 * Math.PI; L(cx, [gx + Math.cos(golden) * (r - 18), gy + Math.sin(golden) * (r - 18), gx + Math.cos(golden) * (r + 18), gy + Math.sin(golden) * (r + 18)], 3, '#ffd23a');
  const na = Math.PI + (TS.phase === 'play' ? TS.pos : TS.last ? TS.last.pos : 0) * Math.PI;
  L(cx, [gx, gy, gx + Math.cos(na) * (r - 6), gy + Math.sin(na) * (r - 6)], 5, '#c8322e'); E(cx, gx, gy, 10, 10, '#3a3a44', 3);
  txt(cx, 'GUT-O-MAT', 0, 82, '400 22px "Titan One", sans-serif', '#7a3ab8', 'center', 0);
  cx.restore();
  // Dr. Fred schaut zu und kommentiert
  const fa = { ...ACT.drfred, x: 120, y: 470, dir: 1, walking: false, talking: TS.phase === 'stop' && t - TS.stopT < 1100, seed: 4 };
  if (hd) drawActorLit(fa, 1.15, [1, '#fff0d0', '#10182a'], 0); else { cx.save(); cx.translate(fa.x, fa.y); cx.scale(1.15, 1.15); CHAR.drfred(cx, fa, t); cx.restore(); }
  // Anzeige
  txt(cx, 'GUT-O-MAT', 24, 44, '400 30px "Titan One", sans-serif', '#ffd23a', 'left', 6, '#0b0610');
  txt(cx, `Runde ${Math.min(TS.round, TS.rounds)} von ${TS.rounds} · Punkte ${TS.score}`, W - 24, 44, '800 18px "Baloo 2", sans-serif', '#ffffff', 'right', 4, '#0b0610');
  txt(cx, TS.line, W / 2, 84, '700 20px "Baloo 2", sans-serif', TS.phase === 'stop' ? ACT.drfred.color : '#e6dcff', 'center', 5, '#0b0610');
  if (TS.phase === 'stop' && TS.last) txt(cx, `+${TS.last.pts}`, 480 + 150, 250, '400 40px "Titan One", sans-serif', TS.last.pts >= 85 ? '#ffe066' : TS.last.pts >= 50 ? '#c8f0ff' : '#ff8a8a', 'center', 7, '#0b0610');
  txt(cx, TS.phase === 'play' ? 'Leertaste / Klick / A: Stopp!' : TS.phase === 'stop' ? 'Weiter mit Leertaste / Klick / A' : '', W / 2, 580, '700 15px "Baloo 2", sans-serif', '#c3b2ff', 'center', 4, '#0b0610');
  TS.btns = [];
  if (TS.phase === 'done') {
    cx.fillStyle = 'rgba(8,3,18,0.72)'; cx.fillRect(0, 0, W, H);
    R(cx, W / 2 - 230, 140, 460, 300, '#1f1432', 3, 18, '#7a5ab8');
    const rank = TS.score >= 450 ? 'Toast-Großmeister!' : TS.score >= 400 ? 'Toast-Meister!' : TS.score >= 280 ? 'Ordentlicher Toast' : 'Eher Knäckebrot';
    txt(cx, rank, W / 2, 196, '400 34px "Titan One", sans-serif', '#ffd23a', 'center', 6, '#2a0a3a');
    txt(cx, `${TS.score} von ${TS.rounds * 100} Punkten · ${TS.results.join(' · ')}`, W / 2, 238, '800 18px "Baloo 2", sans-serif', '#ffffff');
    txt(cx, TS.record ? 'Neuer Rekord!' : `Rekord: ${toasterBest()}`, W / 2, 268, '800 16px "Baloo 2", sans-serif', TS.record ? '#ffe066' : '#c3b2ff');
    if (TS.score >= 400) txt(cx, 'Erfolg: Toast-Meister', W / 2, 294, '800 15px "Baloo 2", sans-serif', '#a6ff8f');
    TS.btns = [{ id: 'again', label: 'Nochmal', x: W / 2 - 200, y: 350, w: 180, h: 44 }, { id: 'back', label: 'Zurück zum Spiel', x: W / 2 + 20, y: 350, w: 180, h: 44 }];
    for (const b of TS.btns) button(b, b.label, inRect(G.mouse.x, G.mouse.y, b));
  }
}
function toasterClick(x, y) {
  if (TS.phase === 'done') { const b = TS.btns.find(b => inRect(x, y, b)); if (!b) return; Sound.sfx('click'); if (b.id === 'again') startToaster(); else endToaster(); return; }
  toasterPress();
}
function endToaster() { G.screen = G.state ? 'game' : 'title'; music(); }

// ---------- Ortsschilder: beim ersten Betreten eines Raums ----------
function showSign(roomId) {
  if (G.fast || G.inIntro || !G.state) return;
  const s = G.state.signs || (G.state.signs = {}); if (s[roomId]) return;
  s[roomId] = 1; G.sign = { room: roomId, t0: G.t + 200 }; Sound.sfx('sign');
}
function markVisit(r) {
  const v = G.state.visited || (G.state.visited = {});
  if (r && !v[r]) { v[r] = 1; if (Object.keys(ROOMS).every(id => v[id])) unlock('reise'); }
}
function updateVisits() { if (G.screen === 'game' && G.state) for (const p of PLAYERS) markVisit(ACT[p].room); }
// kleines Zeit-Symbol: Uhr (Gegenwart), Schreibfeder (1776), Planet (Zukunft)
function eraIcon(c, era, x, y, s = 1) {
  c.save(); c.translate(x, y); c.scale(s, s);
  if (era === 'present') { E(c, 0, 0, 11, 11, '#fff6e0', 2); L(c, [0, 0, 0, -7], 2.2, '#3a2a1a'); L(c, [0, 0, 5, 2], 2.2, '#3a2a1a'); E(c, 0, 0, 1.6, 1.6, '#c8322e', 0); }
  else if (era === 'past') { S(c, '#fff6e0', 2, () => { c.moveTo(-8, 10); c.quadraticCurveTo(-6, -4, 9, -12); c.quadraticCurveTo(4, 2, -8, 10); }); L(c, [-8, 10, 2, -3], 1.4, '#9a7a50'); E(c, -9, 11, 2, 2, '#1b1020', 0); }
  else { E(c, 0, 0, 8, 8, '#e3a6ff', 2); S(c, null, 2, () => c.ellipse(0, 0, 14, 4.5, -0.35, 0, Math.PI * 2), '#fff6e0'); E(c, -3, -3, 2.5, 2, 'rgba(255,255,255,0.6)', 0); }
  c.restore();
}
function drawSign() {
  const s = G.sign; if (!s) return;
  if (G.chapterCard || G.menu) { s.t0 = G.t; return; }   // wartet, bis die Kapitelkarte weg ist
  const k = (G.t - s.t0) / 3300; if (k < 0) return; if (k > 1) { G.sign = null; return; }
  const room = ROOMS[s.room], era = ERA[room.era], a = Math.min(1, k * 7, (1 - k) * 6), e = 1 - Math.pow(1 - Math.min(1, k * 4.5), 3);
  cx.font = '400 30px "Titan One", sans-serif'; const tw = cx.measureText(room.name).width;
  cx.font = '800 12px "Baloo 2", sans-serif'; const sw = cx.measureText(era.label.toUpperCase()).width;
  const x = 18 - (1 - e) * 70, y = 18, w = Math.max(tw, sw) + 92, h = 68;
  cx.save(); cx.globalAlpha = a;
  glow(x + 36, y + 34, 80, era.col, 0.3);
  R(cx, x, y, w, h, 'rgba(14,6,26,0.84)', 2, 16, mix(era.col, '#241739', 0.25));
  if (!cx.isPix) L(cx, [x + 14, y + 4, x + w - 14, y + 4], 1.5, 'rgba(255,255,255,0.14)');
  E(cx, x + 36, y + 34, 22, 22, mix(era.col, '#1a0e2c', 0.55), 2.5, 0, era.col);
  eraIcon(cx, room.era, x + 36, y + 34, 1.05);
  txt(cx, room.name, x + 68, y + 38, '400 30px "Titan One", sans-serif', '#fff6e0', 'left', 6, '#1b0a2a');
  const lw = (w - 84) * Math.min(1, Math.max(0, k * 3.2 - 0.3));
  if (lw > 0) L(cx, [x + 68, y + 46, x + 68 + lw, y + 46], 2, mix(era.col, '#ffffff', 0.2));
  txt(cx, era.label.toUpperCase(), x + 69, y + 61, '800 12px "Baloo 2", sans-serif', era.col, 'left');
  cx.restore();
}

// ---------- Zeitreise-Karte mit Schnellreise ----------
const MAP_ORDER = { present: ['labor', 'lobby'], past: ['gasthaus', 'garten1776'], future: ['fgarten', 'vorraum', 'thron'] };
const mapThumbs = {};
function openMap(fromMenu) {
  if (G.screen !== 'game' || !G.state || G.dialog || G.inIntro || (G.busy && !fromMenu)) return;
  for (const k in mapThumbs) delete mapThumbs[k];
  G.menu = 'map'; G.mapT0 = G.t; Sound.sfx('unfold');
  if (G.pointer === 'pad') { G.mouse.x = W / 2; G.mouse.y = 0; snapNav(0, 1); }
}
function mapRooms(era) { const order = (MAP_ORDER[era] || []).filter(id => ROOMS[id]); return order.concat(Object.values(ROOMS).filter(r => r.era === era && !order.includes(r.id)).map(r => r.id)); }
// Postkarten-Vorschau eines Raums: Hintergrund plus Gegenstände im aktuellen Zustand
function mapThumb(room, w, h) {
  const s = Math.min(2, VS * DPR); let c = mapThumbs[room.id];
  if (c && c._s === s) return c;
  c = document.createElement('canvas'); c.width = Math.ceil(w * s); c.height = Math.ceil(h * s); c._s = s;
  const g = c.getContext('2d'), keep = cx;
  g.setTransform(s * w / W, 0, 0, s * h / SH, 0, 0);
  try {
    cx = g; drawBg(room);
    HDS.deco = true;
    for (const o of room.objs) if (o.draw && isVisible(o)) o.draw(g, G.t);
  } catch (e) { /* die Vorschau bleibt beim Hintergrund */ }
  finally { HDS.deco = false; cx = keep; }
  return (mapThumbs[room.id] = c);
}
function travelSpot(roomId) {
  for (const r of Object.values(ROOMS)) for (const o of r.objs) if (o.exit && o.exit[0] === roomId && r.id !== roomId) return o.exit.slice(1);
  const room = ROOMS[roomId], xs = room.walk.map(p => p[0]), ys = room.walk.map(p => p[1]);
  return [...clampWalk(room, (Math.min(...xs) + Math.max(...xs)) / 2, Math.max(...ys) - 15), 1];
}
async function fastTravel(roomId) {
  const a = me(), room = ROOMS[roomId];
  if (!room || G.busy || a.room === roomId || room.era !== ROOMS[a.room].era || !G.state.visited[roomId]) return;
  G.menu = null; ++actToken; if (a._res) { const r = a._res; a._res = null; r(false); } a.target = null; a.walking = false;
  const [x, y, dir] = travelSpot(roomId);
  G.busy++;
  try { Sound.sfx('whoosh'); G.state.stats.trips = (G.state.stats.trips || 0) + 1; await goRoom(a.id, roomId, x, y, dir || 1); }
  finally { G.busy--; if (!G.busy) G.skipAll = false; }
  save();
}
function drawMap() {
  const k = Math.min(1, (G.t - (G.mapT0 || 0)) / 260), e = 1 - Math.pow(1 - k, 3), t = G.t;
  cx.fillStyle = `rgba(8,3,16,${(0.8 * e).toFixed(3)})`; cx.fillRect(0, 0, W, H);
  cx.save(); cx.globalAlpha = e;
  const bx = 24, by = 12, bw = W - 48, bh = H - 24;
  R(cx, bx, by, bw, bh, grad(cx, 0, by, 0, by + bh, [[0, '#2a1a40'], [1, '#150b24']]), 3, 18, '#7a5ab8');
  txt(cx, 'Zeitreise-Karte', W / 2, by + 42, '400 30px "Titan One", sans-serif', '#ffd23a', 'center', 5, OUT);
  txt(cx, 'Besuchte Orte deiner Zeit anklicken: Schnellreise · Andere Zeiten erreicht nur die Klo-Post', W / 2, by + 64, '600 13px "Baloo 2", sans-serif', '#a99ad0');
  const here = me().room, myEra = ROOMS[here].era, btns = [], vis = G.state.visited || {}, colW = (bw - 40) / 3;
  ['present', 'past', 'future'].forEach((era, ci) => {
    const ex = bx + 20 + ci * colW + 6, ew = colW - 12, own = era === myEra, er = ERA[era], top = by + 78;
    R(cx, ex, top, ew, bh - 150, own ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)', 2, 14, own ? er.col : '#3d2c5e');
    E(cx, ex + 30, top + 30, 18, 18, mix(er.col, '#1a0e2c', 0.55), 2, 0, er.col); eraIcon(cx, era, ex + 30, top + 30, 0.85);
    txt(cx, er.label, ex + 56, top + 37, '400 21px "Titan One", sans-serif', own ? er.col : mix(er.col, '#6a5a88', 0.5), 'left', 4, OUT);
    const res = PLAYERS.find(p => HOME_ERA[p] === era);
    if (res) { drawPortrait(cx, res, ex + ew - 28, top + 30, 18, er.bg, t, false); E(cx, ex + ew - 28, top + 30, 18, 18, null, 2.5, 0, res === curId() ? '#ffe066' : mix(er.col, '#241739', 0.35)); }
    mapRooms(era).forEach((id, ri) => {
      const room = ROOMS[id], cw = 196, th = Math.round(cw * SH / W), x = ex + (ew - cw) / 2, y = top + 62 + ri * 120, seen = !!vis[id];
      const isHere = id === here, can = seen && own && !isHere && !G.busy, r = { id: 'mp_' + id, x, y, w: cw, h: th + 24 }, hot = can && inRect(G.mouse.x, G.mouse.y, r);
      if (isHere && !cx.isPix) glow(x + cw / 2, y + th / 2, 140, '#ffd23a', 0.22 + Math.sin(t * 0.005) * 0.08);
      if (hot && !cx.isPix) glow(x + cw / 2, y + th / 2, 130, er.col, 0.25);
      cx.save(); if (!own && seen) cx.globalAlpha *= 0.62;
      R(cx, x - 3, y - 3, cw + 6, th + 30, isHere ? '#3a2758' : hot ? '#33224f' : '#1d1330', 2.5, 9, isHere ? '#ffe066' : hot ? er.col : '#3d2c5e');
      if (seen) {
        const img = !cx.isPix && mapThumb(room, cw, th);
        if (img) cx.drawImage(img, x, y, cw, th); else R(cx, x, y, cw, th, mix(er.bg, '#1a0e2c', 0.3), 0, 6);
        for (const p of PLAYERS) if (ACT[p].room === id) { const pi = PLAYERS.indexOf(p), px = x + 18 + pi * 30, py = y + th - 16; drawPortrait(cx, p, px, py, 12, ERA[HOME_ERA[p]].bg, t, false); E(cx, px, py, 12, 12, null, 2, 0, p === curId() ? '#ffe066' : '#1b1020'); }
        txt(cx, room.name, x + cw / 2, y + th + 18, '800 14px "Baloo 2", sans-serif', isHere ? '#ffe066' : hot ? '#ffffff' : '#e6dcff');
        if (isHere) txt(cx, 'Du bist hier', x + cw - 8, y + 18, '800 12px "Baloo 2", sans-serif', '#ffe066', 'right', 4, '#1b1020');
        else if (hot) txt(cx, 'Schnellreise »', x + cw - 8, y + 18, '800 12px "Baloo 2", sans-serif', '#ffffff', 'right', 4, '#1b1020');
      } else {
        R(cx, x, y, cw, th, '#120a1e', 0, 6);
        for (let i = 0; i < 5; i++) E(cx, x + 30 + i * 34, y + th / 2 + Math.sin(t * 0.002 + i) * 6, 26, 14, 'rgba(120,100,170,0.08)', 0);
        txt(cx, '?', x + cw / 2, y + th / 2 + 14, '400 38px "Titan One", sans-serif', '#4a3a68', 'center');
        txt(cx, '???', x + cw / 2, y + th + 18, '800 14px "Baloo 2", sans-serif', '#6a5a88');
      }
      cx.restore();
      if (can) btns.push(r);
    });
  });
  const back = { id: 'mapback', x: W / 2 - 150, y: by + bh - 52, w: 300, h: 38 };
  button(back, G.mapFrom === 'main' ? 'Zurück' : 'Karte schließen  (M)', inRect(G.mouse.x, G.mouse.y, back));
  G.menuBtns = btns.concat([back]);
  cx.restore();
}

// ---------- Figuren-Steckbriefe ----------
// Figuren einmal pro Zustand vorrendern (bekannt/Silhouette); im Menü wird nur noch das Bild kopiert
const bioCache = {};
function bioKnown(id) { return PLAYERS.includes(id) || !!(G.state && (G.state.talked[id] || G.state.looked['a:' + id])); }
function bioFigure(id, known, x, y, hgt) {
  const base = ACT[id], a = Object.assign({}, base, { x: null, dir: 1, walking: false, talking: false, target: null, pose: null, climb: false, climbY: null, seed: 1 }), sc = hgt / base.h;
  if (cx.isPix) {
    if (!known) { txt(cx, '?', x, y - hgt * 0.4, '400 40px "Titan One", sans-serif', '#4a3a68'); return; }
    cx.save(); cx.translate(x, y); cx.scale(sc, sc); CHAR[base.kind](cx, a, 0); cx.restore(); return;
  }
  const k = VS * DPR, bw = 110, bh = hgt + 14, key = `${id}|${known ? 1 : 0}|${k.toFixed(2)}`;
  let c = bioCache[key];
  if (!c) {
    c = bioCache[key] = document.createElement('canvas'); c.width = Math.ceil(bw * k); c.height = Math.ceil(bh * k);
    const g = c.getContext('2d'), keep = cx;
    g.setTransform(k * sc, 0, 0, k * sc, bw / 2 * k, (bh - 4) * k);
    cx = g;
    try { CHAR[base.kind](g, a, 0); } catch (e) { /* Figur fehlt – leere Karte */ } finally { cx = keep; }
    if (!known) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#0d0718'; g.fillRect(0, 0, c.width, c.height); }
  }
  cx.drawImage(c, x - bw / 2, y - bh + 4, bw, bh);
}
function drawBios(bx, y) {
  ['bernard', 'hoagie', 'laverne', ...NPCS].forEach((id, i) => {
    const x = bx + 20 + (i % 3) * 248, yy = y + 4 + Math.floor(i / 3) * 140, w = 240, h = 132, known = bioKnown(id), b = BIOS[id] || {}, col = ACT[id].color;
    R(cx, x, yy, w, h, known ? '#281a40' : '#1a1129', 2, 12, known ? mix(col, '#241739', 0.45) : '#33224d');
    if (known && !cx.isPix) glow(x + 40, yy + h - 30, 60, col, 0.12);
    E(cx, x + 40, yy + h - 9, 26, 5, 'rgba(0,0,0,0.3)', 0);
    bioFigure(id, known, x + 40, yy + h - 8, 112);
    const nm = known ? ACT[id].name : '???'; let nz = 18; cx.font = `400 ${nz}px "Titan One", sans-serif`;
    while (nz > 13 && cx.measureText(nm).width > w - 94) { nz--; cx.font = `400 ${nz}px "Titan One", sans-serif`; }
    txt(cx, nm, x + 84, yy + 26, `400 ${nz}px "Titan One", sans-serif`, known ? '#ffd23a' : '#6a5a88', 'left', 4, OUT);
    const role = known ? b.role || '' : 'Noch nicht getroffen'; let fz = 11; cx.font = `800 ${fz}px "Baloo 2", sans-serif`;
    while (fz > 8 && cx.measureText(role).width > w - 92) { fz--; cx.font = `800 ${fz}px "Baloo 2", sans-serif`; }
    txt(cx, role, x + 84, yy + 43, `800 ${fz}px "Baloo 2", sans-serif`, known ? mix(col, '#ffffff', 0.25) : '#5a4a78', 'left');
    cx.font = '600 12px "Baloo 2", sans-serif';
    wrap(known ? b.bio || '' : 'Schau dir diese Figur an oder sprich mit ihr, um mehr zu erfahren.', w - 94).slice(0, 5).forEach((l, j) => txt(cx, l, x + 84, yy + 62 + j * 15, '600 12px "Baloo 2", sans-serif', known ? '#e6dcff' : '#6a5a88', 'left'));
  });
}

// ---------- Party-Modus: Geheimcode ↑ ↑ ↓ ↓ ← → ← → B A ----------
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const CONF = [];
function konamiKey(k) {
  const kk = k.length === 1 ? k.toLowerCase() : k, i = G.kIdx || 0;
  G.kIdx = kk === KONAMI[i] ? i + 1 : kk === KONAMI[0] ? (i === 2 ? 2 : 1) : 0;
  if (G.kIdx < KONAMI.length) return false;
  G.kIdx = 0; toggleParty(); return true;
}
function toggleParty() {
  G.settings.party = !G.settings.party; saveSettings();
  if (G.settings.party) { Sound.sfx('party'); confettiBurst(W / 2, G.screen === 'game' ? SH * 0.45 : H * 0.42, 140); unlock('party'); note('Party-Modus an! Hütchen auf! (Code noch mal = aus)'); }
  else { Sound.sfx('click'); CONF.length = 0; note('Party-Modus aus. Schade eigentlich.'); }
}
function confettiBurst(x, y, n) {
  for (let i = 0; i < n && CONF.length < 300; i++) {
    const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 380;
    CONF.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 240, r: Math.random() * 6, vr: (Math.random() - 0.5) * 12, s: 4 + Math.random() * 4, c: FW_COLS[i % FW_COLS.length], f: Math.random() * 6 });
  }
}
function updateConfetti(dt) {
  const s = dt / 1000, on = G.settings.party && (G.screen === 'game' || G.screen === 'title') && !G.menu && !G.fast;
  if (on && Math.random() < dt * 0.011 && CONF.length < 150) CONF.push({ x: Math.random() * W, y: -10, vx: (Math.random() - 0.5) * 40, vy: 40 + Math.random() * 40, r: Math.random() * 6, vr: (Math.random() - 0.5) * 8, s: 4 + Math.random() * 3, c: pick(FW_COLS), f: Math.random() * 6 });
  for (let i = CONF.length - 1; i >= 0; i--) {
    const p = CONF[i];
    p.vx -= p.vx * 2 * s; p.vy += (140 - 2 * p.vy) * s;   // Luftwiderstand: segelt mit ~70 px/s herab
    p.x += p.vx * s + Math.sin(G.t * 0.003 + p.f) * 22 * s; p.y += p.vy * s; p.r += p.vr * s;
    if (p.y > H + 12 || (!G.settings.party && p.y > H)) CONF.splice(i, 1);
  }
}
function drawConfetti() {
  for (const p of CONF) {
    const w = p.s, h = Math.max(1, p.s * 0.6 * Math.abs(Math.cos(G.t * 0.008 + p.f)));
    cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.fillRect(-w / 2, -h / 2, w, h); cx.restore();
  }
}
function drawDisco() {
  if (!G.settings.party || cx.isPix) return;
  for (let i = 0; i < 3; i++) glow(W / 2 + Math.sin(G.t * 0.0006 + i * 2.1) * 380, SH * 0.62 + Math.cos(G.t * 0.0009 + i * 1.3) * 90, 210, ['#ff5fa8', '#7fe8ff', '#ffd23a'][i], 0.15);
}
// Partyhütchen: [x-Versatz zur Kopfmitte, Anteil der Figurenhöhe] je Figurenart
const HAT = { bernard: [6, 0.985], hoagie: [8, 0.975], laverne: [4, 0.9], drfred: [4, 0.97], gertrude: [4, 0.97], hancock: [4, 0.97], green: [0, 0.97], purple: [0, 0.97], guard: [0, 0.97] };
const HAT_COLS = [['#ff5fa8', '#ffd23a'], ['#7fe8ff', '#ff5fa8'], ['#a6ff8f', '#d79bff'], ['#ffd23a', '#7fe8ff']];
const CROUCH_LEN = { bernard: 82, hoagie: 64, laverne: 74 };
function hatAt(x, y, s, dir, n) {
  const [c1, c2] = HAT_COLS[Math.abs(Math.round(n)) % HAT_COLS.length], hw = h => 13 * (1 - h / 38);
  cx.save(); cx.translate(x, y); cx.scale(s * dir, s); cx.rotate(0.2 + Math.sin(G.t * 0.004 + n) * 0.06);
  P(cx, [-13, 0, 13, 0, 0, -38], c1, 0);
  for (const [h1, h2] of [[7, 13], [20, 25]]) P(cx, [-hw(h1), -h1, hw(h1), -h1, hw(h2), -h2, -hw(h2), -h2], c2, 0);
  P(cx, [-13, 0, 13, 0, 0, -38], null, 2.5);
  E(cx, 0, -39, 5, 5, '#ffffff', 2);
  cx.restore();
}
function partyHat(a, sc) {
  if (!G.settings.party) return;
  const [hx, hk] = HAT[a.kind] || [0, 0.97], d = a.dir < 0 ? -1 : 1, top = a.h * hk;
  const ln = a.walking ? (a.run ? 0.08 : 0.035) : 0, cl = CROUCH_LEN[a.id] && !a.climb ? crouch(a, G.t, CROUCH_LEN[a.id]) : 0;
  hatAt(a.x + (hx + ln * top * 0.55) * sc * d * (a._turn || 1), a.y + (-top + bobY(a, G.t) + cl + nod(a, G.t)) * sc, sc, d, PLAYERS.indexOf(a.id) + 1 + (a.seed || 0));
}

// ---------- Hauptschleife ----------
function update(dt) {
  pollPad(dt);
  if (G.skipAll) for (const a of Object.values(ACT)) if (a.target) { a.x = a.target[0]; a.y = a.target[1]; }
  if (G.screen === 'game') updateActors(dt);
  const sp = G.speech;
  if (sp && (G.t >= sp.end || G.skipAll)) finishSpeech();
  else if (sp && sp.babble && G.t < sp.babbleEnd && G.t >= G.nextBlip) { Sound.blip(sp.a.voice, panOf(sp.a)); G.nextBlip = G.t + 70 + Math.random() * 60; }
  for (let i = timers.length - 1; i >= 0; i--) if (G.skipAll || G.t >= timers[i].until) { const r = timers[i].r; timers.splice(i, 1); r(); }
  updateEnd(dt); updateRock(); updateToaster(dt); updatePoses(); updateVisits(); updateConfetti(dt);
  const tb = G.titleBark;
  if (tb && G.screen === 'title' && G.t < tb.babbleEnd && G.t >= G.nextBlip && G.settings.babble) { Sound.blip(ACT[tb.id].voice, panX(tb.x)); G.nextBlip = G.t + 90 + Math.random() * 70; }
  updateParts(dt); updateMotes(dt); updateWeather(); updateRain(dt); updateBarks(); updateCam(dt); updateCrystals(); updateSky(dt); updateGlint();
  Sound.muffle(!!G.menu && G.menu !== 'jukebox' && G.screen === 'game');
  if (G.jbOn && G.menu !== 'jukebox') { G.jbOn = false; music(); }
  while (G.ripples.length && G.t - G.ripples[0].t > 500) G.ripples.shift();
  if (G.fadeRes) {
    const k = G.skipAll ? 1 : Math.min(1, (G.t - G.fadeStart) / G.fadeDur);
    G.fade = G.fadeFrom + (G.fadeTarget - G.fadeFrom) * k;
    if (k >= 1) { const r = G.fadeRes; G.fadeRes = null; r(); }
  }
  if (G.screen === 'game' && G.state && !G.menu) G.state.stats.ms += dt;
  G.hover = null;
  if (G.screen === 'game' && G.pointer === 'mouse' && !G.busy) {
    const u = G.mouse.y >= SH ? hitUI(G.mouse.x, G.mouse.y) : null, key = u && u.type === 'verb' ? u.id : u && u.type === 'inv' && inv()[u.idx] ? 'inv' + u.idx : null;
    if (key && key !== G.lastVerbHover) Sound.sfx('hover');
    G.lastVerbHover = key;
  }
  if (G.screen === 'game' && !G.dialog && !G.menu && G.state) {
    const { x, y } = G.mouse;
    if (y < SH) G.hover = hitScene(x, y);
    else {
      const u = hitUI(x, y);
      if (u && u.type === 'inv') { const id = inv()[u.idx]; if (id) G.hover = 'i:' + id; }
      if (u && u.type === 'port' && G.first) G.hover = 'p:' + u.id;
    }
  }
}
function drawScreen() {
  if (G.screen === 'title') { drawTitle(); drawTitleBark(); drawConfetti(); if (!cx.isPix) drawBloom(0.2, H); drawToasts(); if (G.menu) drawMenu(); }
  else if (G.screen === 'end') { drawEnd(); if (!cx.isPix) drawBloom(0.22, H); }
  else if (G.screen === 'toaster') { drawToaster(); if (!cx.isPix) drawBloom(0.2, H); }
  else if (G.screen === 'rock') { drawRock(); if (!cx.isPix) drawBloom(0.25, H); }
  else if (G.screen === 'game') { drawScene(); drawUI(); drawFly(); if (G.menu) drawMenu(); }
  else {   // Ladebildschirm: hüpfender Toast mit Tentakel-Schatten
    cx.fillStyle = grad(cx, 0, 0, 0, H, [[0, '#0c0420'], [1, '#2a0f4a']]); cx.fillRect(0, 0, W, H);
    const t = G.t, y = H / 2 - 20 - Math.abs(Math.sin(t * 0.006)) * 26, sq = 1 + Math.max(0, Math.cos(t * 0.012)) * 0.06;
    E(cx, W / 2, H / 2 + 34, 34 - Math.abs(Math.sin(t * 0.006)) * 10, 7, 'rgba(0,0,0,0.35)', 0);
    cx.save(); cx.translate(W / 2, y); cx.scale(sq, 2 - sq); cx.rotate(Math.sin(t * 0.004) * 0.15);
    S(cx, '#e8b060', 3, () => { cx.moveTo(-28, 26); cx.lineTo(-28, -10); cx.quadraticCurveTo(-34, -34, -14, -34); cx.quadraticCurveTo(0, -44, 14, -34); cx.quadraticCurveTo(34, -34, 28, -10); cx.lineTo(28, 26); cx.closePath(); });
    R(cx, -20, -20, 40, 40, '#f6dca0', 0, 6); E(cx, -8, -4, 3, 3.5, '#1b1020', 0); E(cx, 8, -4, 3, 3.5, '#1b1020', 0);
    S(cx, null, 2.5, () => { cx.moveTo(-7, 8); cx.quadraticCurveTo(0, 14, 7, 8); });
    cx.restore();
    txt(cx, 'Lade' + '.'.repeat(1 + Math.floor(t / 400) % 3), W / 2, H / 2 + 80, '400 26px "Titan One", sans-serif', '#ffd23a', 'center', 5, '#1b1020');
  }
  drawCursor();
}
function render() {
  // Klassik-Modus: alles wird vom Pixel-Renderer (js/pixel.js) direkt als 320×200-Pixel-Art gezeichnet
  if (G.settings.retro) {
    PIX.begin(); cx = PIX;
    try { drawScreen(); } finally { cx = mainCx; }
    pixComposite(mainCx, cv);
    return;
  }
  const s = VS * DPR;
  cx.setTransform(s, 0, 0, s, 0, 0);
  cx.clearRect(0, 0, W, H);
  drawScreen();
}
function frame(ts) {
  const dt = Math.min(50, ts - (G.last || ts)); G.last = ts; G.t += dt;
  // adaptive Qualität: bei anhaltendem Ruckeln DPR und Partikeldichte drosseln, später wieder hoch
  G.fpsAvg += (dt - G.fpsAvg) * 0.03;
  if (G.t > 4000 && G.t - G.fpsGate > 6000) {
    if (G.fpsAvg > 24 && G.quality > 0.5) { G.quality = 0.5; G.fpsGate = G.t; resize(); }
    else if (G.fpsAvg < 17 && G.quality < 1) { G.quality = 1; G.fpsGate = G.t; resize(); }
  }
  try { update(dt); render(); } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
async function boot() {
  resize(); window.addEventListener('resize', resize);
  document.addEventListener('fullscreenchange', resize); document.addEventListener('webkitfullscreenchange', resize);
  buildIndex();
  requestAnimationFrame(frame);
  try {
    await Promise.race([
      Promise.all(['800 21px "Baloo 2"', '600 18px "Baloo 2"', '700 15px "Baloo 2"', '400 40px "Titan One"', '500 20px "Pixelify Sans"', '700 20px "Pixelify Sans"'].map(f => document.fonts.load(f))),
      new Promise(r => setTimeout(r, 3000)),
    ]);
  } catch (e) { /* Fallback-Schrift */ }
  for (const k in bgCache) delete bgCache[k];
  loadSettings(); loadAch();
  G.saved = loadSave(); G.hasSaves = anySave();
  G.screen = 'title';
  music();
}
