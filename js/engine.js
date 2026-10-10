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
// Schwache Geräte (Xbox-Edge, Handys mit höchstens 2 GB): kleinere Zeichenflächen und weniger zwischengespeicherte Raumbilder,
// sonst läuft der Arbeitsspeicher voll und der Browser beendet die Seite
// (Adresszusatz ?lowmem=1 erzwingt den Sparmodus, ?lowmem=0 schaltet ihn ab)
const LOWMEM = (() => { try { const q = /[?&]lowmem=(\d)/.exec(location.search); return q ? q[1] === '1' : /Xbox/i.test(navigator.userAgent) || (navigator.deviceMemory > 0 && navigator.deviceMemory <= 2); } catch (e) { return false; } })();
const MAX_PX = LOWMEM ? 2.4e6 : Infinity;   // Pixelbudget der Hauptfläche (Szenen- und Hintergrundpuffer sind je etwa so groß)
const BG_KEEP = LOWMEM ? 3 : 7;             // so viele Raumhintergründe bleiben im Zwischenspeicher

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
  settings: { music: true, voice: false, babble: true, fullscreen: true, retro: false, lang: 'de' }, titleBtns: [], menuBtns: [], saved: null,
  reveal: 0, fly: [], shake: { until: 0, mag: 0 }, ach: {}, achToast: null, nextBlip: 0, fsTried: false,
  parts: [], ripples: [], quality: 1, fpsAvg: 16.7, fpsGate: 0,
  motes: [], moteKind: null, storm: null, neon: null, bark: null, barkNext: 0, idleSince: 0, lastClick: null,
  cam: { z: 1, x: W / 2, y: SH / 2 }, photoFlash: 0,
  view: { x: (W - W * SH / H) / 2 }, ms: { x: -99, y: -99 }, hudK: 0, invPin: false, coin: null, inScene: false, modernPass: false,
};
let VH = SH;   // Höhe der Fläche, auf die Szenen-Overlays gezeichnet werden (moderne Ansicht: ganzer Bildschirm)
let SSK = 1;   // Überabtastung der Szene in der modernen Ansicht (schärfere Vergrößerung)
let UIS = 1;   // Schrift-/Bedienskalierung: auf Touch-Geräten und kleinen Bildschirmen größer
const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const uf = px => Math.round(px * UIS);
// Text-Einstellung: Größe und dunkler Hintergrund hinter Sprechtexten (Lesehilfe)
const TEXT_MODES = [['normal', 1, false], ['groß', 1.18, false], ['groß, mit Hintergrund', 1.18, true], ['sehr groß, mit Hintergrund', 1.36, true]];
function textMode() { return TEXT_MODES[G.settings.textMode || 0] || TEXT_MODES[0]; }
// Lesehilfe: abgerundeter Kasten hinter einem Textblock (Mitte x, Grundlinie der letzten Zeile y)
function readBox(x, yLast, w, n, lh, fsz) {
  if (!textMode()[2]) return;
  const top = yLast - (n - 1) * lh - fsz * 0.95, h = (n - 1) * lh + fsz * 1.35;
  R(cx, x - w / 2 - 12, top - 4, w + 24, h + 8, cx.isPix ? '#140a20' : 'rgba(10,4,20,0.66)', 0, 10);
}
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
  Sound.sfx('pick'); if (ITEM_SFX[i]) setTimeout(() => Sound.sfx(ITEM_SFX[i]), 90);
  if (c === curId() && G.screen === 'game' && !G.fast) {
    const a = me(), room = ROOMS[viewRoomId()];
    const from = a.room === room.id ? [a.x, a.y - a.h * roomScale(room, a.y) * 0.6] : [W / 2, SH / 2];
    G.fly.push({ id: i, from, t0: G.t }); G.hudPeek = G.t + 1900;
    puff(from[0], from[1], '#fff1a8', 10, { vy: 80, vx: 150, r: 2.2, max: 650, spread: 12 });
  }
}
const ITEM_SFX = { zucker: 'sugar', kaffee: 'slosh', wasser: 'slosh', muenze: 'coin', schaufel: 'clank', eimer: 'knock', apfel: 'thunk', lapfel: 'thunk', butzen: 'thunk', brot: 'page', zelle: 'zap', toast: 'pop', sticks: 'click2', altsticks: 'click2' };
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
  if (k === 'c') return CRITTERS[id].name;
  if (k === 'e') return EGGS[id].name;
  return '';
}
// Notizbuch und Erfolge: bei vielen Einträgen rücken die Zeilen enger zusammen, damit „Zurück“ im Bild bleibt
const noteRow = () => NOTES.length > 14 ? 23 : 28, achRow = () => ACH.length > 26 ? 31 : 36;
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
  lobby: { verb: [1.0, 0.16], light: [-1, '#ffe2b0', '#1c2c66'], bloom: 0.22, amb: ['crickets', 'traffic', 'air', 'chime'], motes: 'dust', music: 'lounge' },
  labor: { music: 'lab', verb: [1.5, 0.2], light: [1, '#c0fff4', '#0c2a40'], bloom: 0.3, amb: ['drip', 'beeps', 'hum'], motes: 'dust', flicker: 'neon', reflect: 0.2 },
  gasthaus: { verb: [0.7, 0.14], light: [-1, '#ffc070', '#3a1a10'], bloom: 0.3, amb: ['creak', 'chime', 'blub'], motes: 'warm', flicker: 'fire', music: 'tavern' },
  garten1776: { verb: [0.3, 0.06], light: [1, '#fff0c0', '#2a3a58'], bloom: 0.22, amb: ['wind', 'moo', 'rain'], rain: true, motes: 'leaf', fg: ['#1f3d1a', '#2c5222'], sky: 'birds' },
  fgarten: { verb: [0.6, 0.1], light: [-1, '#ffb8f0', '#1c0c48'], bloom: 0.34, amb: ['future', 'rain'], motes: 'firefly', fg: ['#2a0f3e', '#45206a'], sky: 'cars', storm: true, rain: true },
  vorraum: { music: 'march', verb: [2.2, 0.24], light: [1, '#e4c8ff', '#1a0c3a'], bloom: 0.28, amb: ['rain', 'palace'], motes: 'magic', storm: true, reflect: 0.22 },
  thron: { verb: [2.6, 0.26], light: [-1, '#f4c4ff', '#1a0830'], bloom: 0.32, amb: ['rain', 'palace', 'air'], motes: 'magic', storm: true, reflect: 0.22 },
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
      // im Zukunftsgarten ziehen die Laternen die Glühwürmchen sanft an
      if (viewRoomId() === 'fgarten' && !rainFx.on) { const lx = 545 - m.x, ly = 60 - m.y, ld = Math.hypot(lx, ly); if (ld > 95) { m.vx += lx / ld * 70 * s; m.vy += ly / ld * 70 * s; } }
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
const rainFx = { drops: [], splashes: [], on: false, next: 0, era: null, t0: 0 };
// Wetter je Epoche: in der Zukunft wechseln Schauer und Pausen, 1776 gibt es nur ab und zu einen kurzen Sommerregen mit Regenbogen
const RAIN_ERA = {
  future: { first: true, wet: [20000, 18000], dry: [12000, 16000] },
  past: { first: false, firstDry: [50000, 70000], wet: [15000, 8000], dry: [110000, 110000], bow: true },
};
function rainActive() { return !!(G.state && G.screen === 'game' && (ROOM_FX[viewRoomId()] || {}).rain && rainFx.on); }
function roomAmb() {
  const r = ROOMS[viewRoomId()], fx = ROOM_FX[r.id] || {};
  const list = [...new Set([...(r.amb || []), ...(fx.amb || [])])];
  if (G.state && !fl().guardGone && ACT.wache.room === r.id && ACT.wache.visible) list.push('snore');   // die Wache schnarcht leise
  if (rainFx.on && rainFx.era === 'past' && r.id === 'gasthaus') list.push('rainin');   // Sommerregen gedämpft durchs Fenster
  return rainFx.on ? list : list.filter(n => n !== 'rain');
}
function updateRain(dt) {
  // Die Schauer-Phasen laufen in allen Zukunfts-Räumen weiter (auch im Palast),
  // sichtbare Tropfen gibt es nur draußen – so bleibt das Wetter beim Reingehen bestehen
  const room = G.screen === 'game' && G.state ? ROOMS[viewRoomId()] : null, wx = room && RAIN_ERA[room.era];
  if (!room || !wx || G.menu) {
    if (rainFx.drops.length || rainFx.on || rainFx.next) { rainFx.drops = []; rainFx.splashes = []; rainFx.on = false; rainFx.next = 0; }
    rainFx.era = null;
    return;
  }
  if (rainFx.era !== room.era) { rainFx.drops = []; rainFx.splashes = []; rainFx.on = false; rainFx.next = 0; rainFx.era = room.era; }
  if (!rainFx.next) {   // beim Betreten der Zukunft: erst eine Schauer; in 1776 erst einmal trocken
    rainFx.on = wx.first; rainFx.t0 = G.t;
    rainFx.next = G.t + (wx.first ? 16000 + Math.random() * 14000 : wx.firstDry[0] + Math.random() * wx.firstDry[1]);
    Sound.ambience(roomAmb());
  }
  if (G.t >= rainFx.next) {
    rainFx.on = !rainFx.on; rainFx.t0 = G.t;
    const d = rainFx.on ? wx.wet : wx.dry;
    rainFx.next = G.t + d[0] + Math.random() * d[1];
    Sound.ambience(roomAmb());
    if (!rainFx.on) { rainFx.drops = []; rainFx.splashes = []; }
    if (wx.bow) showerTurn(room, rainFx.on); else if (room.id === 'fgarten') futureRainBark(rainFx.on);
  }
  if (!rainFx.on || !(ROOM_FX[room.id] || {}).rain) {
    if (rainFx.drops.length) { rainFx.drops = []; rainFx.splashes = []; }
    return;
  }
  const want2 = (G.quality < 1 ? 20 : 34) * (rainFx.era === 'past' ? 1.6 : 1) | 0;   // Sommerregen etwas dichter
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
  // vor dem hellen Sommerhimmel von 1776 dunklere, längere Striche, sonst sieht man den Regen kaum
  const past = rainFx.era === 'past', len = past ? 14 : 9;
  cx.strokeStyle = past ? 'rgba(70,96,140,0.5)' : 'rgba(188,216,255,0.4)'; cx.lineWidth = past ? 1.8 : 1.5; cx.lineCap = 'round';
  cx.beginPath();
  for (const d of rainFx.drops) { cx.moveTo(d.x, d.y - len); cx.lineTo(d.x + len * 0.16, d.y); }
  cx.stroke();
  for (const sp of rainFx.splashes) {
    const k = (G.t - sp.t) / 240;
    cx.globalAlpha = (1 - k) * 0.6;
    E(cx, sp.x, sp.y, 2 + k * 5, 0.9 + k * 2, null, 1.2, 0, '#cfe4ff');
  }
  cx.globalAlpha = 1;
}
// Sommerregen 1776: Spruch des Helden draußen, danach ein Regenbogen über dem Garten
function showerTurn(room, wet) {
  if (!wet) { G.rainbow = G.t; if (room.id === 'garten1776') wait(1400).then(() => { if (viewRoomId() === 'garten1776' && !G.menu) Sound.sfx('rainbow', 0.2); }); }
  if (room.id !== 'garten1776' || me().room !== room.id) return;   // ob gerade jemand spricht, zählt erst beim Spruch selbst
  wait(wet ? 1800 : 3600).then(() => { if (viewRoomId() === 'garten1776' && !G.busy && !G.speech && !G.dialog && !G.bark && !G.menu) startBark(curId(), pick(SHOWER_BARKS[wet ? 'wet' : 'bow'])); });
}
function futureRainBark(wet) {
  if (me().room !== 'fgarten' || G.t - (G.wxBarkT || -1e9) < 90000) return;
  G.wxBarkT = G.t;
  wait(1500).then(() => { if (viewRoomId() === 'fgarten' && !G.busy && !G.speech && !G.dialog && !G.bark && !G.menu) startBark(curId(), pick(FUTURE_RAIN_BARKS[wet ? 'wet' : 'dry'])); });
}
// Hologramm-Werbung: flackerndes Pink über dem Turm, Lichtkegel von der Turmspitze, Bildstörung beim Wechsel
function drawHolo(room) {
  if (room.id !== 'fgarten') return;
  const cyc = 4200, n = Math.floor(G.t / cyc), k = (G.t % cyc) / cyc, text = T(HOLO_ADS[n % HOLO_ADS.length]);
  const glitch = k < 0.06 || (k > 0.5 && k < 0.52 && n % 2 === 1), x = 648, y = 78, h = 30, fnt = '800 12px "Baloo 2", sans-serif';
  cx.save(); cx.font = fnt;
  const w = Math.min(196, cx.measureText(text).width + 24), fl = 0.8 + 0.2 * Math.sin(G.t * 0.031) * Math.sin(G.t * 0.0117), ox = glitch ? (Math.random() - 0.5) * 7 : 0;
  cx.globalAlpha = (glitch ? 0.35 : 0.85) * fl;
  if (!cx.isPix) {
    const bg = cx.createLinearGradient(0, 126, 0, y + h / 2); bg.addColorStop(0, 'rgba(255,120,220,0.4)'); bg.addColorStop(1, 'rgba(255,120,220,0)');
    cx.fillStyle = bg; cx.beginPath(); cx.moveTo(x - 3, 126); cx.lineTo(x - w / 2, y + h / 2); cx.lineTo(x + w / 2, y + h / 2); cx.lineTo(x + 3, 126); cx.fill();
    glow(x, y, w * 0.6, '#ff7ad8', 0.25 * fl);
  }
  R(cx, x - w / 2 + ox, y - h / 2, w, h, 'rgba(255,90,200,0.2)', 1.5, 6, '#ff8ade');
  cx.fillStyle = 'rgba(255,190,245,0.14)'; for (let yy = y - h / 2 + 2; yy < y + h / 2 - 1; yy += 3) cx.fillRect(x - w / 2 + ox + 2, yy, w - 4, 1);
  txt(cx, '\u200b' + text, x + ox, y + 4, fnt, '#ffe0f8', 'center');
  cx.restore();
}
function showerDim() {
  if (rainFx.era !== 'past') return 0;
  if (rainFx.on) return Math.min(1, (G.t - rainFx.t0) / 2500);
  return G.rainbow ? Math.max(0, 1 - (G.t - G.rainbow) / 3500) : 0;
}
function drawRainbow(room) {
  if (room.id !== 'garten1776' || !G.rainbow || rainFx.on) return;
  const k = G.t - G.rainbow; if (k > 34000) return;
  const a = Math.max(0, Math.min(1, (k - 1200) / 4000, (34000 - k) / 6000)) * 0.42; if (a <= 0) return;
  if (a > 0.3 && G.screen === 'game' && !G.ach.regenbogen) unlock('regenbogen');
  cx.save(); cx.beginPath(); cx.rect(0, 0, 2000, 226); cx.clip();
  cx.globalAlpha = a; cx.lineWidth = 5.4;
  ['#ff4a4a', '#ff9a3a', '#ffe14a', '#5ad85a', '#4aa8ff', '#6a5aff', '#b05aff'].forEach((c, i) => { cx.strokeStyle = c; cx.beginPath(); cx.arc(560, 300, 236 - i * 5, Math.PI, 2 * Math.PI); cx.stroke(); });
  cx.restore();
}
function drawWindowRain(room) {
  if (room.id !== 'gasthaus' || !rainFx.on || rainFx.era !== 'past') return;
  cx.save(); cx.beginPath(); cx.rect(484, 72, 112, 104); cx.clip();
  cx.fillStyle = 'rgba(40,50,70,0.3)'; cx.fillRect(484, 72, 112, 104);
  cx.strokeStyle = 'rgba(60,84,124,0.6)'; cx.lineWidth = 1.5; cx.beginPath();
  for (let i = 0; i < 22; i++) { const x = 480 + ((i * 53) % 120), y = 66 + ((G.t * 0.5 + i * 97) % 124); cx.moveTo(x, y); cx.lineTo(x - 2.4, y + 13); }
  cx.stroke(); cx.restore();
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
let bloomKey = '', bloomT = -1e9;
function drawBloom(alpha, h = SH) {
  if (!BLOOM_OK || !alpha || G.quality < 1) return;
  const bw = bloomC.width, bh = Math.round(bw * h / W), rk = (G.state ? viewRoomId() : G.screen) + '|' + bh;   // auf dem Titelbild gibt es noch keinen Spielstand
  if (bloomC.height !== bh) bloomC.height = bh;
  if (rk !== bloomKey || G.t - bloomT >= 30) {   // 30 Hz reichen für das weiche Leuchten
    bloomKey = rk; bloomT = G.t;
    bloomG.globalCompositeOperation = 'copy';
    bloomG.filter = 'brightness(0.7) contrast(3) saturate(1.3) blur(3px)';
    const src = cx.canvas && cx.canvas !== cv ? cx.canvas : cv;
    bloomG.drawImage(src, 0, 0, src.width, src === cv ? Math.round(cv.height * h / H) : src.height, 0, 0, bw, bh);
    bloomG.filter = 'none';
  }
  cx.save(); cx.globalCompositeOperation = 'screen'; cx.globalAlpha = alpha; cx.drawImage(bloomC, 0, 0, W, h); cx.restore();
}

// Figuren im HD-Modus: erst in einen Puffer zeichnen, dann Licht-/Schattenseite, Bodenschatten und Randlicht auftragen
const actBuf = document.createElement('canvas'), actG = actBuf.getContext('2d');
const rimBuf = document.createElement('canvas'), rimG = rimBuf.getContext('2d');
const inkBuf = document.createElement('canvas'), inkG = inkBuf.getContext('2d');
const INK_DIRS = Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)]);
// Tusche-Kontur: die Silhouette der ganzen Figur rundum versetzt in Konturfarbe hinterlegen –
// eine durchgehende Außenlinie statt einzeln umrandeter Teile
function inkify(src, pw, ph, rad, side = 0) {
  if (inkBuf.width < pw || inkBuf.height < ph) { inkBuf.width = Math.max(inkBuf.width, pw); inkBuf.height = Math.max(inkBuf.height, ph); }
  if (rimBuf.width < pw || rimBuf.height < ph) { rimBuf.width = Math.max(rimBuf.width, pw); rimBuf.height = Math.max(rimBuf.height, ph); }
  const r = rimG; r.setTransform(1, 0, 0, 1, 0, 0); r.globalAlpha = 1; r.globalCompositeOperation = 'source-over'; r.clearRect(0, 0, pw, ph);
  r.drawImage(src, 0, 0, pw, ph, 0, 0, pw, ph); r.globalCompositeOperation = 'source-in'; r.fillStyle = OUT; r.fillRect(0, 0, pw, ph); r.globalCompositeOperation = 'source-over';
  const g = inkG; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, pw, ph);
  const dirs = G.quality < 1 ? INK_DIRS.filter((_, i) => i % 2 === 0) : INK_DIRS;
  // Schattenseite und unten dicker, Lichtseite dünner – wie eine Tuschefeder
  for (const [dx, dy] of dirs) { const w = side ? Math.max(0.55, Math.min(1.6, 1 - side * dx * 0.45 + dy * 0.2)) : 1; g.drawImage(rimBuf, 0, 0, pw, ph, dx * rad * w, dy * rad * w, pw, ph); }
  g.drawImage(src, 0, 0, pw, ph, 0, 0, pw, ph);
  return inkBuf;
}
function drawActorLit(a, sc, lt, refl) {
  const bs = Math.min(VS * DPR * SSK, G.quality < 1 ? 1.5 : 2.4), k = sc * bs, top = a.h + 90, bot = 30, fade = a.h * 0.55;
  const pw = Math.ceil(270 * k), ph = Math.ceil((top + bot) * k), need = Math.ceil((top + Math.max(bot, fade)) * k);
  if (actBuf.width < pw || actBuf.height < need) { actBuf.width = rimBuf.width = Math.max(actBuf.width, pw); actBuf.height = rimBuf.height = Math.max(actBuf.height, need); }
  const g = actG, ox = pw / 2, oy = top * k, [side, key, fill] = lt;
  // im Stand atmen die Figuren ganz leicht
  const br = a.walking ? 0 : Math.sin(G.t * 0.0024 + (a.seed || 0) * 3) * 0.007;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, pw, ph);
  g.setTransform(k * (a.dir < 0 ? -1 : 1) * (1 - br * 0.5) * (a._turn || 1), 0, 0, k * (1 + br), ox, oy);
  HDS.ink = true;
  try { CHAR[a.kind](g, a, G.t); } finally { HDS.ink = false; }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  const half = (a.bw || 50) * 1.4 * k, hg = g.createLinearGradient(ox + side * half, 0, ox - side * half, 0);
  hg.addColorStop(0, hexA(key, 0.26)); hg.addColorStop(0.42, hexA(key, 0)); hg.addColorStop(0.58, hexA(fill, 0)); hg.addColorStop(1, hexA(fill, 0.42));
  g.fillStyle = hg; g.fillRect(0, 0, pw, ph);
  const fire = fireLight(a);
  if (fire) {   // flackerndes Kaminlicht von der Feuerseite
    const fg = g.createLinearGradient(ox + fire.side * half, 0, ox - fire.side * half * 0.35, 0);
    fg.addColorStop(0, `rgba(255,140,50,${Math.min(0.62, 0.8 * fire.k).toFixed(3)})`); fg.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = fg; g.fillRect(0, 0, pw, ph);
  }
  const vg = g.createLinearGradient(0, oy - a.h * k, 0, oy);
  vg.addColorStop(0, hexA(key, 0.12)); vg.addColorStop(0.3, hexA(key, 0)); vg.addColorStop(0.8, 'rgba(10,0,24,0)'); vg.addColorStop(1, 'rgba(10,0,24,0.28)');
  g.fillStyle = vg; g.fillRect(0, 0, pw, ph);
  const floorCol = DUST[(ROOMS[a.room] || {}).floor];
  if (floorCol) { const bg = g.createLinearGradient(0, oy - 34 * k, 0, oy); bg.addColorStop(0, hexA(floorCol, 0)); bg.addColorStop(1, hexA(floorCol, 0.26)); g.fillStyle = bg; g.fillRect(0, oy - 34 * k, pw, 34 * k); }   // Bodenreflex
  if (G.quality >= 1) {
    // Silhouette minus leicht verschobene Silhouette = die Kante, die zur Lichtquelle zeigt
    const r = rimG, d = Math.max(2, 5.5 * k);
    r.setTransform(1, 0, 0, 1, 0, 0); r.globalCompositeOperation = 'source-over'; r.clearRect(0, 0, pw, ph);
    r.drawImage(actBuf, 0, 0, pw, ph, 0, 0, pw, ph);
    r.globalCompositeOperation = 'source-in'; r.fillStyle = key; r.fillRect(0, 0, pw, ph);
    r.globalCompositeOperation = 'destination-out'; r.drawImage(actBuf, 0, 0, pw, ph, -side * d, d * 0.7, pw, ph);
    g.globalAlpha = 0.42; g.drawImage(rimBuf, 0, 0, pw, ph, 0, 0, pw, ph); g.globalAlpha = 1;
    if (fire && fire.k > 0.12) {   // Randlicht vom Feuer
      r.setTransform(1, 0, 0, 1, 0, 0); r.globalCompositeOperation = 'source-over'; r.clearRect(0, 0, pw, ph);
      r.drawImage(actBuf, 0, 0, pw, ph, 0, 0, pw, ph);
      r.globalCompositeOperation = 'source-in'; r.fillStyle = '#ffb060'; r.fillRect(0, 0, pw, ph);
      r.globalCompositeOperation = 'destination-out'; r.drawImage(actBuf, 0, 0, pw, ph, -fire.side * d * 0.9, d * 0.4, pw, ph);
      g.globalAlpha = Math.min(0.9, fire.k * 1.2); g.drawImage(rimBuf, 0, 0, pw, ph, 0, 0, pw, ph); g.globalAlpha = 1;
    }
    // Maltextur auf die Figur (auf die Silhouette begrenzt)
    r.setTransform(1, 0, 0, 1, 0, 0); r.globalCompositeOperation = 'source-over'; r.clearRect(0, 0, pw, ph);
    const pat = r.createPattern(paperCanvas(), 'repeat'); if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(0.7 * bs));
    r.fillStyle = pat; r.fillRect(0, 0, pw, ph);
    r.globalCompositeOperation = 'destination-in'; r.drawImage(actBuf, 0, 0, pw, ph, 0, 0, pw, ph);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.28; g.drawImage(rimBuf, 0, 0, pw, ph, 0, 0, pw, ph); g.globalAlpha = 1;
  }
  g.globalCompositeOperation = 'source-over';
  const out = inkify(actBuf, pw, ph, Math.max(1.5, 2.3 * k), side);
  if (refl) {
    // Spiegelbild: an der Fußlinie gespiegelt und nach unten ausgeblendet
    const r = rimG, fh = Math.ceil(fade * k);
    r.setTransform(1, 0, 0, 1, 0, 0); r.globalCompositeOperation = 'source-over'; r.clearRect(0, 0, pw, oy + fh);
    r.setTransform(1, 0, 0, -1, 0, 2 * oy); r.drawImage(out, 0, 0, pw, ph, 0, 0, pw, ph);
    r.setTransform(1, 0, 0, 1, 0, 0); r.globalCompositeOperation = 'destination-in';
    const fg = r.createLinearGradient(0, oy, 0, oy + fh); fg.addColorStop(0, 'rgba(0,0,0,1)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
    r.fillStyle = fg; r.fillRect(0, oy, pw, fh); r.globalCompositeOperation = 'source-over';
    cx.save(); cx.globalAlpha = refl; cx.drawImage(rimBuf, 0, oy, pw, fh, a.x - ox / bs, a.y + 1, pw / bs, fh / bs); cx.restore();
  }
  cx.drawImage(out, 0, 0, pw, ph, a.x - ox / bs, a.y - oy / bs, pw / bs, ph / bs);
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
  if (G.dialog && G.screen === 'game' && G.state && !G.menu && !G.settings.retro) {
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
// Foto im Look der Epoche: Gegenwart mit Datumsstempel, 1776 in Sepia, Zukunft mit Neon und Scanlines
function photoCanvas() {
  const era = G.state && G.screen === 'game' ? ROOMS[viewRoomId()].era : null, w = cv.width, h = cv.height, s = w / W;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  if (BLOOM_OK && era === 'past') g.filter = 'sepia(0.8) contrast(1.06) brightness(1.03)';
  else if (BLOOM_OK && era === 'future') g.filter = 'saturate(1.4) hue-rotate(-14deg) contrast(1.08)';
  g.drawImage(cv, 0, 0); g.filter = 'none';
  g.setTransform(s, 0, 0, s, 0, 0);
  if (era === 'past') {
    const vg = g.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 620); vg.addColorStop(0, 'rgba(60,30,10,0)'); vg.addColorStop(1, 'rgba(60,30,10,0.55)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    txt(g, 'Anno 1776', W - 24, H - 22, 'italic 400 30px Georgia, serif', 'rgba(255,240,210,0.85)', 'right', 4, 'rgba(60,30,10,0.6)');
  } else if (era === 'future') {
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1.5);
    g.strokeStyle = '#7fe8ff'; g.lineWidth = 3;
    for (const [x, y, dx, dy] of [[16, 16, 1, 1], [W - 16, 16, -1, 1], [16, H - 16, 1, -1], [W - 16, H - 16, -1, -1]]) { g.beginPath(); g.moveTo(x, y + dy * 34); g.lineTo(x, y); g.lineTo(x + dx * 34, y); g.stroke(); }
    txt(g, '● ZUKUNFT · LIVE', W - 30, H - 24, '700 20px "Pixelify Sans", monospace', '#ff5fa8', 'right', 4, 'rgba(10,0,30,0.7)');
  } else if (era === 'present') {
    const d = new Date(), st = `'${String(d.getFullYear()).slice(2)} ${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}`;
    txt(g, st, W - 28, H - 24, '700 26px "Pixelify Sans", monospace', '#ffab3a', 'right', 3, 'rgba(80,20,0,0.5)');   // Datumsstempel wie bei alten Kameras
  }
  return c;
}
function albumAdd(src) {
  try {
    const c = document.createElement('canvas'); c.width = 384; c.height = 240;
    c.getContext('2d').drawImage(src || cv, 0, 0, c.width, c.height);
    const list = albumList(); list.unshift({ src: c.toDataURL('image/jpeg', 0.72), at: Date.now(), room: G.state ? viewRoomId() : G.screen });
    while (list.length > ALBUM_MAX) list.pop();
    localStorage.setItem(ALBUM_KEY, JSON.stringify(list)); albumImgs.length = 0;
  } catch (e) { /* Speicher voll oder gesperrt */ }
}
function albumImage(i, src) { let im = albumImgs[i]; if (!im) { im = albumImgs[i] = new Image(); im.src = src; } return im; }
function takePhoto() {
  if (!cv.toBlob) return;
  Sound.sfx('photo');
  G.photoMode = true; try { render(); } finally { G.photoMode = false; }   // sauberes Bild ohne Bedienleiste und Zeiger
  const pc = photoCanvas(); G.photoFlash = G.t;
  albumAdd(pc);
  pc.toBlob(b => {
    if (!b) return;
    const a = document.createElement('a'); a.href = URL.createObjectURL(b);
    a.download = `tentakel-toast-foto-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png');
}

// ---------- Nebenbei-Sprüche: NPCs murmeln vor sich hin, gelangweilte Spielfiguren melden sich ----------
function startBark(id, text) {
  if (Lang.active && !Lang.has(text)) { const tok = G.barkTok = (G.barkTok || 0) + 1; Lang.tAsync(text, 2000).then(tt => { if (G.barkTok === tok && !G.bark && !G.speech && !G.busy && !G.dialog) startBark(id, tt); }); return; }
  text = T(text);
  const a = ACT[id];
  G.bark = { a, text, start: G.t, until: G.t + Math.max(2200, 1000 + text.length * 55), babbleEnd: G.t + Math.min(1800, text.length * 40) };
  a.talking = true;
}
function endBark() { const b = G.bark; if (!b) return; G.bark = null; if (!G.speech || G.speech.a !== b.a) b.a.talking = false; }
function updateBarks() {
  if (G.screen !== 'game' || !G.state || G.fast) { endBark(); return; }
  const b = G.bark;
  if (b && (G.t >= b.until || G.speech || G.busy || G.dialog || b.a.room !== viewRoomId())) endBark();
  else if (b && G.settings.babble && !Voice.on && G.t < b.babbleEnd && G.t >= G.nextBlip) { b.a.vowel = Sound.blip(b.a.voice, panOf(b.a)); b.a.vowelT = G.t; G.nextBlip = G.t + 90 + Math.random() * 70; }
  if (G.mouse.x !== G.lastMx || G.mouse.y !== G.lastMy || G.busy || G.speech || G.dialog || G.menu) { G.lastMx = G.mouse.x; G.lastMy = G.mouse.y; G.idleSince = G.t; }
  const calm = !G.busy && !G.speech && !G.dialog && !G.menu && !G.inIntro && G.fade === 0 && !G.bark && !me().walking;
  if (!calm) { G.barkNext = Math.max(G.barkNext, G.t + 5000); if (G.busy || G.speech || G.dialog || G.menu) G.chat = null; return; }
  const p = me();
  if (G.t - G.idleSince > 40000 && p.visible && IDLE[p.id]) { G.idleSince = G.t; startBark(p.id, pick(IDLE[p.id])); return; }
  if (G.chat) {   // laufendes Zwiegespräch: nächste Zeile kurz nachdem die vorige verklungen ist
    const c = G.chat, here = c.ids.every(id => ACT[id].room === viewRoomId() && ACT[id].visible);
    if (c.i >= c.lines.length || !here) { G.chat = null; G.barkNext = G.t + 9000 + Math.random() * 8000; return; }
    if (c.next == null) { c.next = G.t + 380; return; }
    if (G.t < c.next) return;
    const [id, text] = c.lines[c.i];
    if (Lang.active && !Lang.has(text) && (c.tries = (c.tries || 0) + 1) < 8) { Lang.tAsync(text, 2000); c.next = G.t + 500; return; }
    c.i++; c.next = null; c.tries = 0; startBark(id, text);
    return;
  }
  if (G.t < G.barkNext) return;
  G.barkNext = G.t + 11000 + Math.random() * 9000;
  const chats = (NPC_CHATS[viewRoomId()] || []).filter(ch => ch.every(([id]) => ACT[id].room === viewRoomId() && ACT[id].visible && (!PLAYERS.includes(id) || id === p.id)));
  if (chats.length && !G.settings.party && Math.random() < 0.4) {
    const seen = G.chatSeen || (G.chatSeen = {}), fresh = chats.filter(ch => !seen[ch[0][1]]), ch = pick(fresh.length ? fresh : chats);
    seen[ch[0][1]] = 1;
    G.chat = { lines: ch, ids: [...new Set(ch.map(l => l[0]))], i: 0, next: G.t };
    return;
  }
  const npcs = [...NPCS, ...(typeof GUESTS !== 'undefined' ? GUESTS : [])].filter(id => ACT[id].room === viewRoomId() && ACT[id].visible && BARKS[id]);
  if (npcs.length) { const id = pick(npcs); startBark(id, pick(G.settings.party && PARTY_BARKS[id] && Math.random() < 0.6 ? PARTY_BARKS[id] : BARKS[id])); }
}
function drawBark(scr) {
  const b = G.bark; if (!b || G.speech) return;
  const room = ROOMS[viewRoomId()], a = b.a; if (a.room !== room.id) return;
  const sc = roomScale(room, a.y) * (a.scaleMul || 1);
  const bsz = uf(17); cx.font = `700 ${bsz}px "Baloo 2", system-ui, sans-serif`;
  const lines = wrap(b.text, 300 * Math.min(UIS, 1.25)), lh = bsz + 2, maxW = Math.max(...lines.map(l => cx.measureText(l).width));
  let [ax, ay] = [a.x, a.y - a.h * sc - 10]; if (scr) [ax, ay] = scrPt(ax, ay);
  const x = Math.max(maxW / 2 + 12, Math.min(W - maxW / 2 - 12, ax)), y = Math.max(lines.length * lh + 4, ay);
  cx.save(); cx.globalAlpha = Math.max(0, Math.min(1, (b.until - G.t) / 300, (G.t - b.start) / 200)) * 0.92;
  cx.textAlign = 'center'; cx.textBaseline = 'alphabetic'; cx.lineJoin = 'round';
  readBox(x, y, maxW, lines.length, lh, bsz);
  lines.forEach((l, i) => { const ly = y - (lines.length - 1 - i) * lh; cx.lineWidth = 4; cx.strokeStyle = '#0b0610'; cx.strokeText(l, x, ly); cx.fillStyle = a.color; cx.fillText(l, x, ly); });
  cx.restore();
}

// ---------- Vollbild ----------
const fsAvailable = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
function isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
// verfügbare Fläche: sichtbarer Viewport minus Safe-Area-Ränder (Notch), die der body als Innenabstand hat
function viewSize() {
  const vv = window.visualViewport;
  let vw = vv && vv.width ? vv.width : window.innerWidth, vh = vv && vv.height ? vv.height : window.innerHeight;
  try { const cs = getComputedStyle(document.body); vw -= (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0); vh -= (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0); } catch (e) { /* ok */ }
  return [Math.max(120, vw), Math.max(120, vh)];
}
// Drehen am Handy: die neuen Maße kommen oft verspätet – sofort und mehrmals kurz danach nachmessen
let resizeTimers = [];
function resizeSoon() {
  resize();
  for (const t of resizeTimers) clearTimeout(t);
  resizeTimers = [120, 350, 800].map(ms => setTimeout(resize, ms));
}
function onOrient() { G.orientT = performance.now(); resizeSoon(); if (isFullscreen()) lockLandscape(); }
function onFsChange() {
  resizeSoon();
  if (isFullscreen()) { lockLandscape(); return; }
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* ok */ }
  // hat das Drehen (nicht der Spieler) das Vollbild beendet, kehrt es beim nächsten Tippen zurück
  if (G.settings.fullscreen && performance.now() - (G.orientT || -1e9) < 1500) G.fsTried = false;
}
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
  if (G.settings.lang && G.settings.lang !== 'de' && !Lang.active && Lang.state !== 'loading' && (Lang.supported() || navigator.onLine)) setLang(G.settings.lang, false);
  if (G.settings.fullscreen && !G.fsTried) { G.fsTried = true; enterFullscreen(); }
}

// ---------- Größe & Skalierung ----------
const bgCache = {};
function resize() {
  const [vw, vh] = viewSize();
  const vs = Math.max(0.2, Math.min(vw / W, vh / H)), dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, G.quality < 1 ? 1.3 : 2, LOWMEM ? 1 : 2, Math.sqrt(MAX_PX / (W * vs * H * vs))));
  const cw = Math.round(W * vs * dpr), ch = Math.round(H * vs * dpr);
  if (vs !== VS || dpr !== DPR || cw !== cv.width || ch !== cv.height) {   // nur bei echter Änderung neu anlegen (Puffer bleiben sonst erhalten)
    VS = vs; DPR = dpr;
    cv.style.width = Math.floor(W * VS) + 'px'; cv.style.height = Math.floor(H * VS) + 'px';
    cv.width = cw; cv.height = ch;
    for (const k in bgCache) delete bgCache[k];
  }
  UIS = Math.max(COARSE || G.pointer === 'touch' ? 1.25 : 1, Math.min(1.45, 0.8 / VS)) * textMode()[1];
  if (typeof layoutHud === 'function') layoutHud();
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
        const st = STEP_STYLE[a.id] || [null, (a.bw || 50) / 55];
        const inPuddle = !rainFx.on && rainFx.t0 && G.t - rainFx.t0 < 40000 && (room.era === 'past' || room.era === 'future');
        Sound.step(room.floor, panX(a.x), st[1], (rainFx.on && !!(ROOM_FX[room.id] || {}).rain) || inPuddle, st[0]);   // nasse Füße auch in den Pfützen nach der Schauer
        puff(a.x, a.y, DUST[room.floor] || '#b0a8a0', 2, { vy: 10, r: 2.4, max: 420, spread: 18 });
        if (room.id === 'garten1776' && Math.random() < 0.5) puff(a.x, a.y - 2, pick(['#e0782e', '#e8b040', '#c8501e']), 1, { vy: 30, vx: 70, r: 2.6, max: 700, spread: 12 });   // Laub wirbelt auf
      }
    }
  }
}
// Gangart je Figur: [Klang, Gewicht]
const STEP_STYLE = { bernard: ['scuff', 0.85], hoagie: ['thud', 1.5], laverne: ['click', 0.7], drfred: ['scuff', 0.75], gertrude: [null, 1.05], hancock: ['click', 0.95], green: ['squish', 1], wache: ['squish', 1.2], lila: ['squish', 1.3] };
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
  if (k === 'c') { const c = CRIT[id], p = me(), side = p.x < c.x ? -1 : 1; return [c.x + side * 56, c.y + 4]; }
  if (k === 'e') { const e = EGGS[id], p = me(), side = p.x < e.x ? -1 : 1; return e.walk || [e.x + side * (e.w / 2 + 40), e.y + 6]; }
  const a = ACT[id], p = me(), side = p.x < a.x ? -1 : 1;
  return [a.x + side * (a.talkDist || 82), a.y + 6];
}
function faceTarget(key) {
  const [k, id] = key.split(':'), p = me();
  let fx;
  if (k === 'o') { const o = OBJ[id]; if (o.face) { p.dir = o.face; return; } fx = o.rect[0] + o.rect[2] / 2; }
  else if (k === 'a') { fx = ACT[id].x; const a = ACT[id]; if (!a.fixedDir && a.id !== curId()) a.dir = p.x > a.x ? 1 : -1; }
  else if (k === 'c') { const c = CRIT[id]; fx = c.x; c.dir = p.x > c.x ? 1 : -1; }
  else if (k === 'e') fx = EGGS[id].x;
  if (fx !== undefined && Math.abs(fx - p.x) > 6) p.dir = fx > p.x ? 1 : -1;
}

// ---------- Sprechen ----------
function say(id, text) {
  if (G.fast || G.skipAll) return Promise.resolve();
  if (Lang.active && !Lang.has(text)) return Lang.tAsync(text, 2200).then(tt => G.skipAll ? undefined : sayNow(id, tt));
  return sayNow(id, T(text));
}
function textLen(s) { return Lang.charWrap || Lang.cur === 'ko' ? s.length * 2.2 : s.length; }
function sayNow(id, text) {
  return new Promise(res => {
    const a = id ? ACT[id] : null;
    const base = Math.max(1500, 800 + textLen(text) * 58) * ({ langsam: 1.45, schnell: 0.7 }[G.settings.textSpeed] || 1);
    const sp = { a, text, start: G.t, end: G.t + base, res };
    sp.babble = !!(a && a.voice && G.settings.babble && !Voice.on);
    sp.babbleEnd = G.t + Math.min(base - 300, textLen(text) * 46);
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
    const show = () => { G.dialog = { opts: list, res }; if (G.pointer === 'pad') { G.mouse.x = 60; G.mouse.y = 484; } };
    if (Lang.active) Promise.all(list.map(o => Lang.tAsync(o.text, 1800))).then(show); else show();
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
  Sound.setHero(G.screen === 'game' && G.state ? curId() : null);
  if (G.screen === 'rock') return Sound.play('rock');
  if (G.screen === 'toaster') return Sound.play('lounge');
  if (G.screen === 'title' || G.screen === 'end') { Sound.ambience(G.screen === 'title' ? ['crickets', 'wind', 'owl'] : []); Sound.setReverb(1.4, 0.14); return Sound.play(G.screen === 'title' ? 'title' : 'ending'); }
  const r = ROOMS[viewRoomId()], fx = ROOM_FX[r.id] || {};
  Sound.play(fx.music || r.theme || ERA[r.era].theme);
  Sound.ambience(roomAmb());
  if (fx.verb) Sound.setReverb(fx.verb[0], fx.verb[1]);
  Sound.setIntensity(progress() / MILESTONES.length);
}
// Große Bilder vor dem Zeigen dekodieren lassen: auf schwacher Hardware (Xbox-Edge) fehlen sie sonst in den ersten Bildern nach einem
// Raum- oder Figurenwechsel (zum Beispiel Hoagie nach dem Zeitstrudel). Höchstens ms warten, fertig geladene Bilder kosten fast nichts.
function warmImgs(list, ms = 1800) {
  if (G.fast) return Promise.resolve();
  const ps = list.filter(im => im && im.decode && imgOk(im)).map(im => im.decode().catch(() => {}));
  return ps.length ? Promise.race([Promise.all(ps), new Promise(r => setTimeout(r, ms))]) : Promise.resolve();
}
function warmRoom(roomId) {
  const imgs = [typeof RAUM3D !== 'undefined' ? RAUM3D[roomId] : null];
  for (const a of Object.values(ACT)) if (a.room === roomId && a.visible) { const d = typeof FIG3D !== 'undefined' && (FIG3D[a.id] || FIG3D[a.kind]); if (d) imgs.push(d.img); }
  return warmImgs(imgs);
}
async function goRoom(id, roomId, x, y, dir = 1) {
  const a = ACT[id], view = id === curId();
  if (view) { irisAt(a); await fadeTo(1, 280, 'iris'); }
  a.room = roomId; a.x = x; a.y = y; a.dir = dir; a.target = null; a.walking = false;
  if (PLAYERS.includes(id) && G.state) markVisit(roomId);
  if (view) G.viewRoomLast = null;
  if (view) {
    G.first = null; G.parts.length = 0; G.ripples.length = 0; if (G.sign && G.sign.room !== roomId) G.sign = null; music(); irisAt(a); await warmRoom(roomId); await fadeTo(0, 320, 'iris');
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
    G.state.cur = ch; G.parts.length = 0; G.ripples.length = 0; G.sign = null; music();
    await wait(260);
    await warmRoom(me().room);
    await fadeTo(0, 330, 'warp');
    Sound.sting(ch);
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
  // Türen mit eigener Hingeh-Regel (z. B. zum Thronsaal) öffnet ein Linksklick direkt, statt sie nur anzuschauen
  if (k === 'o') { const o = OBJ[id]; return o.exit ? 'walk' : (o.dv || (typeof RULES !== 'undefined' && RULES['walk ' + key] ? 'walk' : 'look')); }
  if (k === 'i') return 'look';
  if (k === 'c') return 'use';
  if (k === 'e') return EGGS[id].dv || 'look';
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
  const tgt = [b, a].find(k => k && (k[0] === 'o' || k[0] === 'a' || k[0] === 'c' || k[0] === 'e'));
  for (const k of [a, b]) if (k && k[0] === 'c') { const c = CRIT[k.slice(2)]; c.calm = G.t + 9000; c.mode = 'sit'; c.until = G.t + 9000; }
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
  if (a[0] === 'c' || (b && b[0] === 'c')) return critterResolve(v, a, b);
  if (a[0] === 'e' || (b && b[0] === 'e')) return eggResolve(v, a, b);
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
  for (const c of critterList(room.id)) {
    const sc = roomScale(room, c.y), w = c.w * sc, h = c.h * sc;
    if (x >= c.x - w / 2 - pad - 4 && x <= c.x + w / 2 + pad + 4 && y >= c.y - h - pad - 4 && y <= c.y + 6 + pad) return 'c:' + c.id;
  }
  for (const e of eggList(room.id)) if (x >= e.x - e.w / 2 - pad && x <= e.x + e.w / 2 + pad && y >= e.y - e.h - pad && y <= e.y + 4 + pad) return 'e:' + e.id;
  for (let i = room.objs.length - 1; i >= 0; i--) {
    const o = room.objs[i]; if (!isVisible(o)) continue;
    const [rx, ry, rw, rh] = o.rect; if (x >= rx - pad && x <= rx + rw + pad && y >= ry - pad && y <= ry + rh + pad) return 'o:' + o.id;
  }
  return null;
}
function dialogHit(x, y) {
  if (G.dialog && modernUI()) { const { y0, lh } = dialogLayout(), i = Math.floor((y - y0 + lh * 0.7) / lh); return i >= 0 && i < G.dialog.opts.length && x > 20 && x < W - 20 ? i : -1; }
  if (!G.dialog || y < 470) return -1;
  const i = Math.floor((y - 472) / 24);
  return i >= 0 && i < G.dialog.opts.length && x < 790 ? i : -1;
}

// ---------- Klick-Logik ----------
function sceneClick(x, y, right) {
  const h = hitScene(x, y);
  G.ripples.push({ x, y, t: G.t });
  if (right) { if (h) { const dv = defaultVerb(h); G.verb = null; G.first = null; runSentence(dv || 'look', h); } return; }
  if (!h && !G.first && !G.verb && selfHit(x, y)) return emote();
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
  if (ch === curId() && !G.busy) { G.verb = null; G.first = null; return emote(); }   // eigenes Porträt: kleine Aktion
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
  if (modernUI()) return modernClick(x, y, right);
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
  if (G.pointer !== 'touch') { G.pointer = 'touch'; resize(); }
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
  if (k === 'Escape' && G.coin) { G.coin = null; return; }
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
  if ((k === 'i' || k === 'I') && modernUI()) { G.invPin = !G.invPin; Sound.sfx('click'); return; }
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
  if (G.screen === 'title') return [...(G.langPills || []).map(p => [p.x + p.w / 2, p.y + p.h / 2]), ...G.titleBtns.map(b => [b.x + b.w / 2, b.y + b.h / 2])];
  if (G.screen === 'end') return G.endBtn ? [[G.endBtn.x + G.endBtn.w / 2, G.endBtn.y + G.endBtn.h / 2]] : [];
  if (G.screen === 'game' && modernUI()) return navTargetsModern();
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
  if (G.menu === 'album' || G.menu === 'bios' || G.menu === 'gaeste') return [back];
  if (G.menu === 'eggs') return [{ id: 'extras', label: 'Zurück' }];
  if (G.menu === 'extras') return [{ id: 'rock', label: 'Minispiel: Tentakel-Rock' }, { id: 'toaster', label: 'Minispiel: Gut-O-Mat' }, { id: 'album', label: `Fotoalbum (${albumList().length})` }, { id: 'bios', label: 'Figuren-Steckbriefe' }, ...(typeof GUESTS !== 'undefined' && gbKnown() ? [{ id: 'gaeste', label: `Gästebuch (${gbCount()}/${gbGesamt()})` }] : []), { id: 'eggs', label: `Fundstücke (${eggsFound()}/${Object.keys(EGGS).length})` }, { id: 'jukebox', label: 'Musikbox' }, { id: 'ach', label: `Erfolge (${achCount()}/${ACH.length})` }, back];
  if (G.menu === 'jukebox') return [...JUKEBOX.map(([id, label]) => ({ id: 'jb_' + id, label: (Sound.current === id ? '♪  ' : '') + label })), back];
  if (G.menu === 'save') return [...slotItems('save'), { id: 'export', label: 'Als Datei exportieren' }, back];
  if (G.menu === 'load') {
    const auto = loadSave();
    return [{ id: 'auto', label: 'Autosave: ' + slotLabel(auto), off: !auto }, ...slotItems('load'), { id: 'import', label: 'Aus Datei importieren' }, back];
  }
  if (G.menu === 'settings') return [
    { id: 'music', label: 'Musik: ' + (G.settings.music ? 'an' : 'aus') },
    { id: 'lang', label: langLabel() },
    { id: 'voice', label: 'Sprachausgabe: ' + (!Voice.available ? 'nicht verfügbar' : G.settings.voice ? 'an' : 'aus') },
    { id: 'babble', label: 'Plapperstimmen: ' + (G.settings.babble ? 'an' : 'aus') },
    { id: 'textm', label: 'Text: ' + textMode()[0] },
    { id: 'tspeed', label: 'Textgeschwindigkeit: ' + (G.settings.textSpeed || 'normal') },
    { id: 'alite', label: 'Klang: ' + (G.settings.audioLite == null ? `automatisch (${Sound.lite ? 'sparsam' : 'voll'})` : G.settings.audioLite ? 'sparsam (Handy)' : 'voll') },
    { id: 'ui', label: 'Bedienung: ' + (G.settings.ui === 'classic' ? 'Klassisch (Verben)' : 'Modern (minimal)') },
    { id: 'hotspots', label: 'Hotspot-Hilfe: ' + (G.settings.hotspots ? 'an' : 'aus') },
    { id: 'retro', label: 'Grafik: ' + (G.settings.retro ? 'Klassisch (Pixel)' : 'Remastered') },
    typeof toggleEcht3d === 'function' && { id: 'echt3d', label: 'Echtzeit-3D (Beta): ' + (G.settings.echt3d ? 'an' : 'aus') },
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
  else if (b.id === 'lang') cycleLang();
  else if (b.id === 'babble') { G.settings.babble = !G.settings.babble; saveSettings(); }
  else if (b.id === 'textm') { G.settings.textMode = ((G.settings.textMode || 0) + 1) % TEXT_MODES.length; saveSettings(); resize(); }
  else if (b.id === 'alite') { const v = G.settings.audioLite; G.settings.audioLite = v == null ? !Sound.lite : v === Sound.mobile ? null : !v; Sound.setLite(G.settings.audioLite); saveSettings(); }
  else if (b.id === 'hotspots') { G.settings.hotspots = !G.settings.hotspots; saveSettings(); }
  else if (b.id === 'ui') { G.settings.ui = G.settings.ui === 'classic' ? 'modern' : 'classic'; G.coin = null; G.viewRoomLast = null; saveSettings(); }
  else if (b.id === 'tspeed') { const o = ['langsam', 'normal', 'schnell']; G.settings.textSpeed = o[(o.indexOf(G.settings.textSpeed || 'normal') + 1) % 3]; saveSettings(); }
  else if (b.id === 'retro') toggleRetro();
  else if (b.id === 'echt3d') toggleEcht3d();
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
  else if (['help', 'ach', 'main', 'notes', 'save', 'load', 'settings', 'jukebox', 'extras', 'album', 'bios', 'eggs', 'gaeste'].includes(b.id)) {
    G.albumView = null;
    if (b.id === 'notes' || b.id === 'bios' || b.id === 'gaeste') Sound.sfx('page');
    if (b.id === 'gaeste') G.gbSeite = 0;
    G.menu = b.id;
  }
  else if (b.id === 'gbseite') { G.gbSeite = gbSeite() + 1 < gbSeiten() ? gbSeite() + 1 : gbSeite() - 1; Sound.sfx('page'); }
  else if (b.id === 'new') G.menu = 'confirm';
  else if (b.id === 'yes') { G.menu = null; startNew(); }
}
function toggleMusic() { G.settings.music = !G.settings.music; Sound.setMusic(G.settings.music); saveSettings(); }
// ---------- Sprachen ----------
function langLabel() {
  const l = LANGS.find(q => q.id === (G.settings.lang || 'de')) || LANGS[0];
  const st = Lang.cur === 'de' ? (Lang.supported() ? '' : ' (andere übersetzen online)') : Lang.state === 'loading' ? (Lang.supported() ? ` (lädt ${Math.round(Lang.progress * 100)} %)` : ' (verbindet …)') : Lang.state === 'tap' ? ' (tippen zum Laden)' : Lang.state === 'ready' ? '' : ' (nicht verfügbar)';
  return `​Sprache · Language: ${l.label}${st}`;
}
function cycleLang() {
  const i = LANGS.findIndex(q => q.id === (G.settings.lang || 'de'));
  setLang(LANGS[(i + 1) % LANGS.length].id, true);
}
// ---------- Sprachleiste auf dem Titelbild: jede Sprache direkt anklickbar ----------
const LANG_SHORT = { de: 'DE', en: 'EN', fr: 'FR', es: 'ES', ja: '日本語', zh: '中文', ko: '한국어' };
function langPills() {
  cx.font = '800 15px "Baloo 2", sans-serif';
  const out = [];
  let x = 16, y = 34;
  for (const l of LANGS) {
    const w = Math.max(34, cx.measureText(LANG_SHORT[l.id]).width + 18);
    if (x + w > 16 + 252) { x = 16; y += 30; }
    out.push({ id: l.id, x, y, w, h: 24 });
    x += w + 6;
  }
  out.rows = Math.ceil(out.length ? (out[out.length - 1].y - 34) / 30 + 1 : 1);
  return out;
}
function drawLangPills() {
  const pills = langPills();
  G.langPills = pills;
  cx.save();
  txt(cx, 'Sprache · Language', 16, 24, '700 13px "Baloo 2", sans-serif', 'rgba(255,240,255,0.85)', 'left', 3, 'rgba(20,4,30,0.8)');
  for (const p of pills) {
    const aktiv = (G.settings.lang || 'de') === p.id;
    const hot = inRect(G.mouse.x, G.mouse.y, p, 3);
    const lade = aktiv && Lang.state === 'loading';
    if (lade) cx.globalAlpha = 0.55 + Math.sin(G.t * 0.008) * 0.3;
    R(cx, p.x, p.y, p.w, p.h, aktiv ? '#ffd23a' : hot ? '#3a2758' : 'rgba(30,17,50,0.82)', 2, 12, aktiv ? '#5a2a10' : hot ? '#ffe066' : '#6a52a0');
    txt(cx, LANG_SHORT[p.id], p.x + p.w / 2, p.y + 16.5, '800 15px "Baloo 2", sans-serif', aktiv ? '#2a0a3a' : hot ? '#ffe066' : '#e6dcff');
    cx.globalAlpha = 1;
    if (lade) txt(cx, Math.round(Lang.progress * 100) + ' %', p.x + p.w / 2, p.y - 5, '700 10px "Baloo 2", sans-serif', '#7dff7a', 'center', 2, '#0b0610');
  }
  cx.restore();
}
// Texte, die oft vorkommen, gleich im Hintergrund übersetzen lassen
function langStrings() {
  const out = [];
  const add = s => { if (typeof s === 'string') out.push(s); };
  try {
    Object.values(ITEMS).forEach(i => add(i.name)); Object.values(ACT).forEach(a => add(a.name)); Object.values(ROOMS).forEach(r => add(r.name));
    Object.values(OBJ).forEach(o => add(typeof o.name === 'function' ? o.name() : o.name));
    Object.values(CRITTERS).forEach(c => add(c.name)); Object.values(EGGS).forEach(e => add(e.name)); Object.values(VERB_LABEL).forEach(add);
    Object.values(ERA).forEach(e => add(e.label)); HUD_BTNS.forEach(b => add(b[1])); HELP.forEach(add); JUKEBOX.forEach(j => add(j[1]));
    ACH.forEach(a => { add(a.name); add(a.desc); }); NOTES.forEach(n => add(n[1]));
    Object.values(NPC_CHATS).forEach(list => list.forEach(ch => ch.forEach(l => add(l[1])))); HOLO_ADS.forEach(add);
    for (const m of ['main', 'settings', 'extras']) { const keep = G.menu; G.menu = m; try { menuItems().forEach(it => add(it.label)); } finally { G.menu = keep; } }
  } catch (e) { /* Liste ist nur ein Vorgriff */ }
  return out;
}
function refreshBgs() { for (const k in bgCache) delete bgCache[k]; for (const r of Object.values(ROOMS)) delete r._pix; }
Lang.onBg(refreshBgs);
function setLang(id, user) {
  G.settings.lang = id; saveSettings(); Voice.setLang(id); refreshBgs();
  if (user && id !== 'de' && Voice.available && !G.settings.voice) { G.settings.voice = true; Voice.on = true; }   // Sprachausgabe in der gewählten Sprache
  Lang.set(id).then(ok => {
    if (G.settings.lang !== id) return;
    if (ok && id !== 'de') { Lang.prewarm(langStrings()); if (user) note(`Sprache: ${LANGS.find(q => q.id === id).label}${Voice.hasVoice ? '' : ' – keine passende Stimme installiert'}`); }
    else if (!ok && Lang.state === 'tap') { if (user) note('Tippe noch einmal, um das Sprachpaket zu laden.'); }
    else if (!ok && id !== 'de') { note('Diese Sprache ist gerade nicht verfügbar – ohne Internet bleibt es beim Deutschen.'); }
  });
}
function toggleVoice() { if (!Voice.available) return; G.settings.voice = !G.settings.voice; Voice.on = G.settings.voice; saveSettings(); }
function toggleRetro() {
  G.settings.retro = !G.settings.retro; saveSettings(); Sound.setRetro(G.settings.retro); Sound.sfx('warp');
  if (!Sound.current && G.screen !== 'loading') music();   // Sicherheitsnetz: nach dem Wechsel läuft immer Musik
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
  if (G.settings.lang && G.settings.lang !== 'de') setLang(G.settings.lang, false);
  Sound.setMusic(G.settings.music); Sound.setRetro(!!G.settings.retro); Sound.setParty(!!G.settings.party); Sound.setLite(G.settings.audioLite); Voice.on = G.settings.voice;
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
  const s = VS * DPR * SSK, key = room.bgKey ? room.id + '|' + room.bgKey() : room.id;   // bgKey: Zustand des Raums (Altbau in 3D, js/altbau.js)
  let c = bgCache[key];
  // neu zeichnen bei anderer Auflösung – oder wenn der Browser den Puffer verworfen hat (Speicherdruck auf Mobilgeräten)
  if (!c || c._s !== s || (c._g.isContextLost && c._g.isContextLost())) {
    c = document.createElement('canvas'); c.width = Math.ceil(W * s); c.height = Math.ceil(SH * s); c._s = s;
    const g = c._g = c.getContext('2d'); g.setTransform(s, 0, 0, s, 0, 0);
    HDS.deco = HDS.shadow = true; HDS.scale = s;
    Lang.bgTag(true);
    try { room.draw(g); } finally { HDS.deco = HDS.shadow = false; Lang.bgTag(false); }
    finishBg(g, c, room); bgCache[key] = c;
    const ks = Object.keys(bgCache); for (let i = 0; i < ks.length - BG_KEEP; i++) if (ks[i] !== key) delete bgCache[ks[i]];
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
  const sc = roomScale(room, a.climbY != null ? a.climbY : a.y) * (a.scaleMul || 1), lt = !cx.isPix && (ROOM_FX[room.id] || {}).light;
  let sx = lt ? -lt[0] * 7 * sc : 0;
  const lift = a.climbY != null ? a.climbY - a.y : 0, shrink = 1 - Math.min(0.6, lift / 300), fire = !cx.isPix && fireLight(a);
  if (fire) sx = -fire.side * (5 + 9 * fire.k) * sc;
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
  text = stageText(T(text));
  const cw = Lang.charWrap, sep = cw ? '' : ' ', words = cw ? Array.from(text) : text.split(' '), lines = []; let line = '';
  for (const w of words) { const t = line ? line + sep + w : w; if (cx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}
function drawSpeech(scr) {
  const sp = G.speech; if (!sp) return;
  const room = ROOMS[viewRoomId()];
  const fsz = uf(21); cx.font = `800 ${fsz}px "Baloo 2", system-ui, sans-serif`;
  const lines = wrap(sp.text, 400 * Math.min(UIS, 1.25)), lh = fsz + 2;
  let x = W / 2, y = 36 + lines.length * lh, col = '#ffffff';
  if (sp.a) {
    col = sp.a.color;
    if (sp.a.room === room.id && sp.a.visible) { const sc = roomScale(room, sp.a.climbY != null ? sp.a.climbY : sp.a.y) * (sp.a.scaleMul || 1); x = sp.a.x; y = sp.a.y - sp.a.h * sc - 12; if (scr) [x, y] = scrPt(x, y); }
  }
  const maxW = Math.max(...lines.map(l => cx.measureText(l).width));
  x = Math.max(maxW / 2 + 12, Math.min(W - maxW / 2 - 12, x));
  y = Math.max(lines.length * lh + 4, y);
  cx.textAlign = 'center'; cx.textBaseline = 'alphabetic'; cx.lineJoin = 'round';
  const pk = Math.min(1, (G.t - sp.start) / 140), pop = pk < 1 ? 0.82 + 0.18 * (1 - Math.pow(1 - pk, 3)) + Math.sin(pk * Math.PI) * 0.06 : 1;
  cx.save(); cx.translate(x, y); cx.scale(pop, pop); cx.translate(-x, -y);
  readBox(x, y, maxW, lines.length, lh, fsz);
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
function drawReveal(room, scr) {
  if (G.t > G.reveal) return;
  const k = Math.min(1, (G.reveal - G.t) / 400), pulse = 1 + Math.sin(G.t * 0.012) * 0.25;
  cx.save(); cx.globalAlpha = k;
  const spots = [];
  for (const o of room.objs) if (isVisible(o)) spots.push([...hotspotCenter(o), (o.exit ? '» ' : '') + (typeof o.name === 'function' ? o.name() : o.name)]);
  for (const a of Object.values(ACT)) if (a.room === room.id && a.visible && a.id !== curId()) spots.push([a.x, a.y - a.h * roomScale(room, a.y) * 0.55, a.name]);
  for (const c of critterList(room.id)) spots.push([c.x, c.y - c.h * roomScale(room, c.y) * 0.6, c.name]);
  for (let [x, y, n] of spots) {
    if (scr) { [x, y] = toScreen(x, y); if (x < -20 || x > W + 20) continue; }
    E(cx, x, y, 8 * pulse, 8 * pulse, 'rgba(255,224,102,0.25)', 2.5, 0, '#ffe066'); E(cx, x, y, 3, 3, '#ffe066', 0);
    txt(cx, n, x, y - 14, '800 13px "Baloo 2", sans-serif', '#fff6d0', 'center', 4, '#1b1020');
  }
  cx.restore();
}
// Zeitreise-Übergang: Zeitwirbel (in Unreal gerendert) dreht sich hinter den Lichtstreifen,
// in der Mitte taumelt ein Chrono-Klo (in Blender gerendert, 24 Bilder im Raster 6×4)
const VORTEX_IMG = loadImg('img/vortex.jpg');
const KLO_SPIN = loadImg('img/klo_spin.png');
function drawVortexBg(SH) {
  if (!imgOk(VORTEX_IMG)) return;
  const d = Math.hypot(W, SH) * (1.05 + 0.08 * Math.sin(G.t * 0.001));
  cx.save(); cx.globalAlpha = G.fade * 0.95; cx.translate(W / 2, SH / 2); cx.rotate(G.t * 0.0009); cx.scale(1, 0.78);
  cx.drawImage(VORTEX_IMG, -d / 2, -d / 2, d, d);
  cx.restore();
}
function drawKloSpin(SH) {
  if (!imgOk(KLO_SPIN)) return false;
  const fs = KLO_SPIN.naturalWidth / 6, f = Math.floor(G.t / 45) % 24, sx = (f % 6) * fs, sy = Math.floor(f / 6) * fs;
  const k = Math.min(1, G.fade * 1.6), size = 120 + 70 * k, y = SH / 2 - 46 + Math.sin(G.t * 0.006) * 8;
  cx.save(); cx.globalAlpha = Math.min(1, G.fade * 1.4); cx.translate(W / 2, y); cx.rotate(Math.sin(G.t * 0.004) * 0.25);
  cx.drawImage(KLO_SPIN, sx, sy, fs, fs, -size / 2, -size / 2, size, size);
  cx.restore();
  return true;
}
function drawTransition() {
  if (G.fade <= 0) return;
  const SH = VH;
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
      drawVortexBg(SH);
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
    const klo = !cx.isPix && drawKloSpin(SH);
    if (G.fade > 0.5 && G.warpLabel) {
      cx.globalAlpha = (G.fade - 0.5) * 2;
      txt(cx, G.warpLabel, W / 2, SH / 2 + (klo ? 92 : 14), '400 40px "Titan One", sans-serif', G.warpCol, 'center', 8, '#0c0614');
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
  drawHolo(room);
  drawRainbow(room);
  drawWindowRain(room);
  drawMeteor(room);
  drawLobbyBat(room);
  drawCandles(room);
  HDS.deco = true;   // Raum-Grafik: handgezeichnete Kanten, Fasen, Holzmaserung
  try {
    if (room.dyn) room.dyn(cx, G.t);
    for (const o of room.objs) if (o.draw && !o.fg && isVisible(o)) o.draw(cx, G.t);
  } finally { HDS.deco = false; }
  drawCrystal(room);
  if (cx.isPix) cx.layer(1);   // Pixel-Modus: Figuren auf eigene Ebene, damit Schilder-Texte dahinter bleiben
  const acts = [...Object.values(ACT).filter(a => a.room === room.id && a.visible), ...critterList(room.id), ...eggList(room.id, true)].sort((p, q) => p.y - q.y);
  for (const a of acts) if (a.egg) drawEgg(a); else if (a.crit) drawCritter(a, room); else drawActor(a, room);
  drawSaber();
  HDS.deco = true;
  try { for (const o of room.objs) if (o.draw && o.fg && isVisible(o)) o.draw(cx, G.t); } finally { HDS.deco = false; }
  drawSwanFlight();
  drawEmbers(room);
  drawSteam(room);
  drawLabArc(room);
  if (!cx.isPix) { drawRays(room); drawMotes(); const fg = (ROOM_FX[room.id] || {}).fg; if (fg && !G.modernPass) drawForeground(fg); }
  drawSendPortal();
  drawParts(); drawRipples(); drawRain(); drawGlint();
  cx.restore();
  { const dm = room.id === 'garten1776' ? showerDim() : 0; if (dm > 0) { cx.fillStyle = `rgba(44,56,80,${(0.36 * dm).toFixed(3)})`; cx.fillRect(0, 0, W, SH); } }
  drawLightFx(!cx.isPix);
  drawDisco();
  if (!cx.isPix) { drawBloom((ROOM_FX[room.id] || {}).bloom); drawGrade(); drawVignette(); }
  if (G.modernPass) { if (G.fadeMode === 'iris') drawTransition(); cx.restore(); return; }
  drawReveal(room);
  drawConfetti();
  drawHotspotHelp(room);
  drawChapterCard();
  drawSign();
  drawTransition();
  cx.save(); camApply(); drawBark(); drawSpeech(); cx.restore();
  if (G.photoFlash && G.t - G.photoFlash < 260) { cx.fillStyle = `rgba(255,255,255,${(0.7 * (1 - (G.t - G.photoFlash) / 260)).toFixed(3)})`; cx.fillRect(0, 0, W, SH); }
  if (G.inIntro) { cx.fillStyle = '#08030e'; cx.fillRect(0, 0, W, 24); cx.fillRect(0, SH - 24, W, 24); }   // Kino-Balken im Intro
  drawCaption(SH - 70);
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
  drawKloFunk();
  if (G.note && G.t < G.note.until) {
    const nz = uf(15), nf = `700 ${nz}px "Baloo 2", sans-serif`; cx.font = nf;
    const w = Math.min(W - 20, cx.measureText(T(G.note.text)).width + 30), nh = nz * 2;
    R(cx, W / 2 - w / 2, 10, w, nh, 'rgba(20,10,32,0.88)', 2, nh / 2, '#7dff7a');
    txt(cx, G.note.text, W / 2, 10 + nh * 0.68, nf, '#d8ffd2');
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
  const bz = Math.min(uf(14), Math.round(r.h * 0.5));
  txt(cx, label, r.x + r.w / 2, r.y + r.h / 2 + bz * 0.36, `700 ${bz}px "Baloo 2", sans-serif`, hot || active ? '#ffe066' : '#d7c6ff');
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
    cx.font = f; const w1 = cx.measureText(T(verb)).width, w2 = cx.measureText(T(rest)).width, x0 = 366 - (w1 + w2) / 2;
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
    const p = portPos(f.to); if (!p) return;
    glow(p.x, p.y, 40 + q * 30, f.col, 0.6 * (1 - q));
    cx.save(); cx.globalAlpha = 1 - q; E(cx, p.x, p.y, p.r + 4 + q * 26, p.r + 4 + q * 26, null, 3, 0, f.col); cx.restore();
    return;
  }
  const p = portPos(f.to); if (!p) return;
  const f0 = modernUI() ? toScreen(f.x, f.y - 30) : [f.x, f.y - 30];
  const e = k * k * (3 - 2 * k), x0 = f0[0], y0 = f0[1], cx1 = (x0 + p.x) / 2, cy1 = Math.min(y0, p.y) - 160;
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
  const SH = VH;
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
function drawHotspotHelp(room, scr) {
  if (!G.settings.hotspots || G.t < G.reveal || G.busy || G.dialog) return;
  const pulse = 0.5 + 0.5 * Math.sin(G.t * 0.004), P2 = (x, y) => scr ? toScreen(x, y) : [x, y];
  for (const o of room.objs) if (isVisible(o)) { const [x, y] = P2(...hotspotCenter(o)); cx.globalAlpha = 0.35 + pulse * 0.25; E(cx, x, y, 4, 4, o.exit ? '#7fe8ff' : '#ffe066', 1.5, 0, '#1b1020'); }
  for (const a of Object.values(ACT)) if (a.room === room.id && a.visible && a.id !== curId()) { cx.globalAlpha = 0.35 + pulse * 0.25; const [x, y] = P2(a.x, a.y - a.h * roomScale(room, a.y) * 0.55); E(cx, x, y, 4, 4, '#ff9ad9', 1.5, 0, '#1b1020'); }
  cx.globalAlpha = 1;
}
function drawFly() {
  drawSendFly();
  G.fly = G.fly.filter(f => G.t - f.t0 < 700);
  for (const f of G.fly) {
    const idx = inv().indexOf(f.id); if (idx < 0) continue;
    const to = flyTarget(idx), from = modernUI() ? toScreen(...f.from) : f.from, k = Math.min(1, (G.t - f.t0) / 700), e = 1 - Math.pow(1 - k, 3);
    const x = from[0] + (to[0] - from[0]) * e, y = from[1] + (to[1] - from[1]) * e - Math.sin(k * Math.PI) * 110;
    cx.save(); cx.translate(x, y); cx.scale(1.6 - 0.6 * e, 1.6 - 0.6 * e); cx.rotate(Math.sin(k * Math.PI * 2) * 0.3); ICON[f.id](cx); cx.restore();
  }
}
// Musikbox: Plattenspieler mit Spektrum, Takt-Puls und Besetzung des laufenden Stücks
const INST_DE = { harp: 'Harfe', bassoon: 'Fagott', pizz: 'Pizzicato', tuba: 'Tuba', arp: 'Arpeggio-Synth', synbass: 'Synth-Bass', bell: 'Glocken', clar: 'Klarinette', pad: 'Flächen', strings: 'Streicher', brass: 'Blechbläser', epiano: 'E-Piano', pluck: 'Zupfgitarre', fiddle: 'Fiedel', guitar: 'E-Gitarre', chug: 'Rhythmusgitarre', organ: 'Orgel' };
const JB_COL = { title: '#ffd23a', present: '#7fd0ff', lounge: '#ff9a6a', past: '#ffb860', tavern: '#e88a3a', future: '#d58aff', march: '#ff6a8a', palace: '#b06aff', rock: '#ff4a4a', ending: '#7dff7a' };
function drawJukebox(bx, by, bw) {
  const id = Sound.current, entry = JUKEBOX.find(j => j[0] === id), on = !!entry && Sound.musicOn, inf = id ? Sound.info(id) : null;
  const col = JB_COL[id] || '#a99ad0', px = bx + bw - 222, py = by + 210, r = 112;
  const now = G.t; G.jbAng = (G.jbAng || 0) + (on ? Math.min(100, now - (G.jbLast || now)) * 0.0035 : 0); G.jbLast = now;
  const ac = Sound.ctx, spb = inf ? 60 / inf.bpm : 0.5, beat = on && ac ? Math.max(0, (ac.currentTime - Sound.songT0) / spb) : 0, pulse = on ? Math.pow(1 - (beat % 1), 3) : 0;
  // Gehäuse
  R(cx, px - 160, py - 132, 320, 266, '#2c1d44', 3, 18, '#5a4290');
  if (!cx.isPix) { cx.save(); cx.globalAlpha = 0.5; L(cx, [px - 148, py - 120, px + 148, py - 120], 2, 'rgba(255,255,255,0.12)'); cx.restore(); }
  glow(px, py, r * 1.6, col, 0.12 + pulse * 0.18);
  E(cx, px, py, r + 9, r + 9, '#17121f', 3);
  E(cx, px, py, r, r, '#121016', 0);
  if (!cx.isPix) {
    for (let i = 0; i < 9; i++) E(cx, px, py, 50 + i * 7, 50 + i * 7, null, 1, 0, 'rgba(255,255,255,0.05)');
    cx.save(); cx.globalCompositeOperation = 'screen';
    for (const a0 of [-1.05, 2.1]) { cx.fillStyle = 'rgba(255,255,255,0.07)'; cx.beginPath(); cx.moveTo(px, py); cx.arc(px, py, r - 2, a0, a0 + 0.42); cx.closePath(); cx.fill(); }   // fester Glanz
    cx.restore();
  }
  // Etikett dreht sich mit
  cx.save(); cx.translate(px, py); cx.rotate(G.jbAng); cx.scale(1 + pulse * 0.05, 1 + pulse * 0.05);
  E(cx, 0, 0, 42, 42, col, 2); E(cx, 0, 0, 32, 32, null, 1.2, 0, 'rgba(0,0,0,0.25)');
  if (id && ERA) eraIcon(cx, id === 'past' || id === 'tavern' || id === 'samba' ? 'past' : id === 'future' || id === 'palace' || id === 'march' ? 'future' : 'present', 0, -16, 0.9);
  E(cx, 0, 22, 9, 3, 'rgba(0,0,0,0.3)', 0);
  E(cx, 0, 0, 4, 4, '#d8d8e4', 1.5);
  cx.restore();
  // Tonarm
  const pvx = px + 132, pvy = py - 104, ang = on ? 2.18 + Math.sin(now * 0.002) * 0.012 : 1.72;
  E(cx, pvx, pvy, 14, 14, '#4a3a66', 2.5); E(cx, pvx, pvy, 6, 6, '#c8c8d8', 1.5);
  const hx = pvx + Math.cos(ang) * 150, hy = pvy + Math.sin(ang) * 150;
  L(cx, [pvx - Math.cos(ang) * 22, pvy - Math.sin(ang) * 22, hx, hy], 7, OUT); L(cx, [pvx - Math.cos(ang) * 22, pvy - Math.sin(ang) * 22, hx, hy], 3.5, '#d8d8e4');
  E(cx, pvx - Math.cos(ang) * 26, pvy - Math.sin(ang) * 26, 7, 7, '#8a8aa0', 2);
  cx.save(); cx.translate(hx, hy); cx.rotate(ang + 0.5); R(cx, -6, -4, 18, 9, '#c8c8d8', 2, 2); cx.restore();
  if (on) floaters(cx, { seed: 0.3 }, now, px + 70, py - 70, 3, (x, y, s, i) => noteGlyph(cx, x, y, s * 1.2, ['#ffd23a', '#ff7ab8', '#7fe8ff'][i]));
  // Spektrum (gespiegelt); ohne echte Messwerte (Offline-Aufnahme) tanzen die Balken im Takt
  const spec = on ? Sound.spectrum() : null, n = 30, x0 = px - 150, bwid = 300 / n, base = py + 210, sr = ac ? ac.sampleRate : 44100;
  let real = false; if (spec) for (let i = 0; i < spec.length && !real; i++) if (spec[i] > 0) real = true;
  for (let i = 0; i < n; i++) {
    let v;
    if (real) {
      const f0 = 55 * Math.pow(8000 / 55, i / n), f1 = 55 * Math.pow(8000 / 55, (i + 1) / n), b0 = Math.floor(f0 / (sr / 1024)), b1 = Math.max(b0 + 1, Math.ceil(f1 / (sr / 1024)));
      let s = 0; for (let b = b0; b < b1; b++) s = Math.max(s, spec[b] || 0); v = s / 255;
    } else v = on ? 0.18 + 0.32 * Math.abs(Math.sin(now * 0.004 + i * 0.7) * Math.sin(now * 0.0023 + i * 1.3)) + pulse * 0.45 * Math.exp(-i / 9) : 0.04;
    const h = Math.max(2, v * 78), x = x0 + i * bwid + 1;
    cx.fillStyle = mix(col, '#ffffff', Math.min(1, v * 0.8)); cx.fillRect(x, base - h, bwid - 2.5, h);
    cx.globalAlpha = 0.22; cx.fillRect(x, base + 3, bwid - 2.5, h * 0.4); cx.globalAlpha = 1;
  }
  L(cx, [x0, base + 1.5, x0 + 300, base + 1.5], 1, 'rgba(255,255,255,0.18)');
  // Titel und Besetzung
  txt(cx, entry ? entry[1] : 'Kein Stück ausgewählt', px, base + 48, '400 20px "Titan One", sans-serif', on ? col : '#a99ad0', 'center', 4, OUT);
  const insts = inf ? inf.inst.filter(k => INST_DE[k]).map(k => INST_DE[k]) : [];
  const sub = !Sound.musicOn ? 'Musik ist in den Einstellungen ausgeschaltet' : inf ? `${inf.bpm} BPM · ${insts.slice(0, 4).join(', ')}${inf.inst.includes('drum') ? ' · Schlagzeug' : ''}` : 'Wähle links ein Stück';
  txt(cx, sub, px, base + 70, '600 13px "Baloo 2", sans-serif', '#c3b2ff');
  if (on) for (let i = 0; i < 4; i++) E(cx, px - 27 + i * 18, base + 88, 4, 4, Math.floor(beat) % 4 === i ? col : '#3d2c5e', 0);
  const hero = G.state && G.screen === 'game' ? curId() : null;
  if (on && hero && inf.lead && !G.settings.retro) {   // die aktive Figur spielt die Melodie mit
    const lbl = `Melodie mit ${{ bernard: 'E-Piano', hoagie: 'E-Gitarre', laverne: 'Glocken' }[hero]} – gefärbt von ${ACT[hero].name}`;
    cx.font = '700 13px "Baloo 2", sans-serif'; const tw = cx.measureText(T(lbl)).width;
    drawPortrait(cx, hero, px - tw / 2 - 6, base + 120, 13, '#3d2c5e', now, pulse > 0.5);
    txt(cx, lbl, px - tw / 2 + 14, base + 125, '700 13px "Baloo 2", sans-serif', '#ffe066', 'left');
  }
}
const JUKEBOX = [['title', 'Titelmelodie'], ['present', 'Gegenwart'], ['lounge', 'Lobby-Lounge'], ['lab', 'Dr. Freds Laborwalzer'], ['past', 'Jahr 1776'], ['tavern', 'Taverne „Zum Krummen Kamin“'], ['future', 'Zukunft'], ['march', 'Wachparade'], ['palace', 'Lilas Palast'], ['rock', 'Tentakel-Rock (Begleitband)'], ['ending', 'Abspann']];
const HELP = [
  'Modern (HD): Linksklick = hingehen oder passende Aktion · Rechtsklick = Aktionsmenü',
  'Inventar: Maus an den unteren Rand oder I · Gegenstand anklicken, dann Ziel oder Gesicht',
  'Maus: Verb anklicken, dann Gegenstand oder Person', 'Rechtsklick: Standard-Aktion · ohne Verb: hinlaufen',
  'Doppelklick/-tipp: rennen · Ausgänge sofort benutzen', 'Touch: tippen · lange drücken = Standard-Aktion',
  'Controller: Stick = Zeiger · Steuerkreuz = von Ziel zu Ziel', 'A Aktion · X Standard · B Zurück · Y Tipp · RS Pixel-Grafik',
  'LB/RB Figur wechseln · LT/RT Verb wählen · LS Klo-Post', 'Ansicht/Tab/Leertaste: Hotspots · F Vollbild · F1/P Pixel-Grafik',
  'Tastatur: Pfeile springen · Enter Aktion · 1–3 Figur · K Klo-Post', 'G Gib · N Nimm · B Benutze · S Schau an · R Rede mit',
  'Klo-Post: Gegenstand wählen → Gesicht unten rechts (geht überall) · O Foto',
  'Menü → Extras: Minispiele, Fotoalbum, Figuren-Steckbriefe, Musikbox, Erfolge',
  'M: Zeitreise-Karte – besuchte Orte deiner Zeit per Schnellreise erreichen',
  'Eigenes Porträt (oder die Figur auf freier Fläche) anklicken: kleine Aktion – Brille, Luftgitarre, Gähnen …',
];
function drawMenu() {
  // Pixel-Modus: Texte werden erst am Ende über die Pixel gelegt – alles darunter würde durch das Menü scheinen
  if (cx.isPix) cx.texts = cx.texts.filter(q => q.layer !== cx.layerIdx);
  if (G.menu === 'map') return drawMap();
  cx.fillStyle = 'rgba(10,5,18,0.72)'; cx.fillRect(0, 0, W, H);
  const items = menuItems();
  const jb = G.menu === 'jukebox';
  const extra = G.menu === 'eggs' ? Object.keys(EGGS).length * 30 + 34 : G.menu === 'bios' ? 3 * 140 + 8 : G.menu === 'gaeste' ? gbRows() * 128 + 48 : G.menu === 'album' ? 3 * 92 + 34 : G.menu === 'help' ? HELP.length * 23 + 10 : G.menu === 'ach' ? Math.ceil(ACH.length / 2) * achRow() + 14 : G.menu === 'notes' ? NOTES.length * noteRow() + 50 : G.menu === 'confirm' ? 24 : 0;
  const bw = jb ? 820 : G.menu === 'eggs' ? 620 : G.menu === 'bios' ? 780 : G.menu === 'gaeste' ? 824 : G.menu === 'ach' ? 860 : G.menu === 'album' ? 640 : G.menu === 'help' || G.menu === 'notes' ? 560 : 420, mst = items.length > 11 ? 40 : items.length > 10 ? 43 : 46, bh = jb ? 566 : 100 + extra + items.length * mst, bx = W / 2 - bw / 2, by = Math.max(12, 300 - bh / 2);
  R(cx, bx, by, bw, bh, '#1f1432', 3, 16, '#5a4290');
  const title = { confirm: 'Wirklich von vorn?', help: 'Steuerung', ach: `Erfolge ${achCount()}/${ACH.length}`, notes: 'Notizbuch', save: 'Spiel speichern', load: 'Spiel laden', settings: 'Einstellungen', jukebox: 'Musikbox', extras: 'Extras', album: 'Fotoalbum', bios: 'Figuren-Steckbriefe', eggs: 'Fundstücke', gaeste: 'Gästebuch' }[G.menu] || 'Pause';
  txt(cx, title, W / 2, by + 48, '400 30px "Titan One", sans-serif', '#ffd23a', 'center', 5, OUT);
  let y = by + 74;
  if (G.menu === 'main' && G.state) { txt(cx, `Fortschritt: ${progress()} von ${MILESTONES.length} Rätseln`, W / 2, y - 2, '600 13px "Baloo 2", sans-serif', '#a99ad0'); y += 10; }
  if (G.menu === 'confirm') { txt(cx, 'Der aktuelle Spielstand geht dabei verloren.', W / 2, y + 6, '600 15px "Baloo 2", sans-serif', '#c3b2ff'); y += 24; }
  if (G.menu === 'help') {
    HELP.forEach((l, i) => txt(cx, l, W / 2, y + 12 + i * 23, '600 15px "Baloo 2", sans-serif', '#e6dcff'));
    y += HELP.length * 23 + 10;
  }
  if (G.menu === 'bios') { drawBios(bx, y); y += 3 * 140 + 8; }
  if (G.menu === 'gaeste') { drawGuestbook(bx, y); y += gbRows() * 128 + 48; }
  if (G.menu === 'eggs') { drawEggList(bx, y, bw); y += Object.keys(EGGS).length * 30 + 34; }
  if (jb) drawJukebox(bx, by, bw);
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
      const done = milestoneDone(m), yy = y + 16 + i * noteRow();
      if (done) L(cx, [bx + 40, yy - 5, bx + 46, yy + 1, bx + 58, yy - 11], 3, '#7dff7a'); else E(cx, bx + 49, yy - 5, 6, 6, null, 2, 0, '#6a5a88');
      txt(cx, done ? text : '???', bx + 72, yy, '600 15px "Baloo 2", sans-serif', done ? '#e6dcff' : '#6a5a88', 'left');
    });
    y += NOTES.length * noteRow() + 8;
    const st = G.state.stats;
    txt(cx, `Spielzeit ${fmtTime(st.ms)} · Sendungen: ${st.sent} · Schritte: ${(st.steps || 0).toLocaleString('de-DE')} · Kristalle: ${crystalCount()}/${CRYSTAL_ROOMS.length}`, W / 2, y + 10, '700 14px "Baloo 2", sans-serif', '#ffd23a');
    txt(cx, 'Feststecken? Der Tipp-Knopf verrät den nächsten Schritt.', W / 2, y + 30, '600 13px "Baloo 2", sans-serif', '#a99ad0');
    y += 42;
  }
  if (G.menu === 'ach') {
    const cw = (bw - 40) / 2;
    ACH.forEach((a, i) => {
      const got = !!G.ach[a.id], x = bx + 20 + (i % 2) * cw, yy = y + 14 + Math.floor(i / 2) * achRow();
      cx.globalAlpha = got ? 1 : 0.4; trophy(cx, x + 16, yy, 0.8); cx.globalAlpha = 1;
      txt(cx, !got && a.secret ? 'Geheimer Erfolg' : a.name, x + 36, yy + 1, '800 15px "Baloo 2", sans-serif', got ? '#ffd23a' : '#8a7aa8', 'left');
      cx.font = '600 12px "Baloo 2", sans-serif';
      txt(cx, got ? (wrap(a.desc, cw - 46)[0] || '') : '???', x + 36, yy + 16, '600 12px "Baloo 2", sans-serif', got ? '#e6dcff' : '#6a5a88', 'left');
    });
    y += Math.ceil(ACH.length / 2) * achRow() + 14;
  }
  const btnW = G.menu === 'save' || G.menu === 'load' ? 360 : 300;
  G.menuBtns = photoBtns.concat(items.map((it, i) => jb ? { id: it.id, off: it.off, label: it.label, x: bx + 30, y: by + 76 + i * Math.min(43, (bh - 90) / items.length), w: 340, h: Math.min(35, (bh - 90) / items.length - 5) } : { id: it.id, off: it.off, label: it.label, x: W / 2 - btnW / 2, y: y + 6 + i * mst, w: btnW, h: Math.min(38, mst - 4) }));
  G.menuBtns.filter(b => !b.id.startsWith('ph_')).forEach((b, i) => { cx.globalAlpha = b.off ? 0.45 : 1; button(b, items[i].label, !b.off && inRect(G.mouse.x, G.mouse.y, b)); cx.globalAlpha = 1; });
  if (G.menu === 'gaeste' && typeof gbBlaettern === 'function' && gbBlaettern()) {   // Seitenwechsel oben rechts im Gästebuch
    const r = { id: 'gbseite', label: gbSeite() + 1 < gbSeiten() ? `Seite ${gbSeite() + 2}  ▶` : `◀  Seite ${gbSeite()}`, x: bx + bw - 176, y: by + 28, w: 156, h: 34 };
    G.menuBtns.push(r); button(r, r.label, inRect(G.mouse.x, G.mouse.y, r));
  }
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
  if (G.pointer === 'touch' || G.mouse.x < 0 || G.photoMode) return;
  const { x, y } = G.mouse, pad = G.pointer === 'pad';
  const inSc = G.screen === 'game' && (modernUI() ? G.inScene : y < SH);
  const hot = G.screen === 'game' ? (G.hover || (modernUI() ? (G.coin ? G.coin.items.some(b => inRect(x, y, b)) : hitHUD(x, y)) : y >= SH && hitUI(x, y))) : G.titleBtns.some(b => inRect(x, y, b));
  const col = G.busy && G.screen === 'game' && !G.dialog && !G.menu ? '#8a7aa8' : hot ? '#ffe066' : '#ffffff';
  const s = pad ? 1.4 : 1;
  cx.lineCap = 'round';
  for (const [w, c] of [[5, '#0b0610'], [2, col]]) {
    cx.lineWidth = w; cx.strokeStyle = c; cx.beginPath();
    cx.moveTo(x - 12 * s, y); cx.lineTo(x - 4 * s, y); cx.moveTo(x + 4 * s, y); cx.lineTo(x + 12 * s, y);
    cx.moveTo(x, y - 12 * s); cx.lineTo(x, y - 4 * s); cx.moveTo(x, y + 4 * s); cx.lineTo(x, y + 12 * s); cx.stroke();
    if (pad) { cx.beginPath(); cx.arc(x, y, 15, 0, Math.PI * 2); cx.stroke(); }
  }
  if (modernUI() && G.screen === 'game' && !G.menu && !G.busy && !G.dialog) { drawTip(x, y, inSc); return; }
  if (pad && G.screen === 'game' && G.hover && inSc && !G.busy) txt(cx, nameOf(G.hover), x, y - 24, '800 15px "Baloo 2", sans-serif', '#ffe066', 'center', 4, '#0b0610');
  if (G.screen === 'game' && G.hover && inSc && !G.busy && !G.verb && !G.first && !G.dialog && !G.menu) { const v = defaultVerb(G.hover); if (v) verbBadge(x, y, v); }
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
// Titel-Logo in 3D (in Blender gerendert: Toast-Buchstaben mit Kruste, lila Tentakel mit Saugnäpfen).
// Wippt sanft; im Pixel-Modus und solange das Bild lädt, bleibt das gezeichnete Logo.
const LOGO_IMG = loadImg('img/logo.png');
function drawLogo3d(t) {
  if (cx.isPix || !LOGO_IMG.complete || !LOGO_IMG.naturalWidth) return false;
  const w = 590, h = w * LOGO_IMG.naturalHeight / LOGO_IMG.naturalWidth, x = W / 2 - w * 0.47, y = -2 + Math.sin(t * 0.0021) * 3;
  const s = 1 + Math.sin(t * 0.0017) * 0.01;
  cx.save(); cx.translate(x + w / 2, y + h / 2); cx.scale(s, s); cx.rotate(Math.sin(t * 0.0013) * 0.008);
  cx.drawImage(LOGO_IMG, -w / 2, -h / 2, w, h);
  cx.restore();
  return true;
}
// Herrenhaus in 3D (in Blender modelliert: Holzverkleidung, Schindeldach, schiefe Fensterläden, Gaube).
// Die Ankerpunkte (Anteile im Bild) kommen aus der Kamera-Projektion in Blender: Schornstein, Fenster, Laternen.
const HAUS_IMG = loadImg('img/haus.png');
const HAUS_AT = {"chimney": [0.488, 0.224], "windows": [[0.176, 0.615], [0.176, 0.783], [0.353, 0.618], [0.353, 0.786], [0.53, 0.621], [0.53, 0.789], [0.707, 0.624], [0.707, 0.792], [0.194, 0.254], [0.194, 0.34], [0.194, 0.425], [0.66, 0.301], [0.66, 0.398]], "lamps": [[0.341, 0.889], [0.55, 0.892]]};
// Laternen am Herrenhaus (3D-Haus: aus den Blender-Ankern, sonst die gezeichneten): [x, Oberkante]
function titleLamps() {
  if (!cx.isPix && imgOk(HAUS_IMG)) { const h = 522, w = h * HAUS_IMG.naturalWidth / HAUS_IMG.naturalHeight, x = 262 - w / 2, y = 606 - h; return HAUS_AT.lamps.map(([fx, fy]) => [x + fx * w, y + fy * h - LAMP_TOP]); }
  return [[212, 534], [310, 534]];   // gezeichnetes Haus steht 10 px weiter links
}
const LAMP_TOP = 14;
// auf jedem Laternendach sitzt ein Vogel – Tipper auf dem Titel lässt ihn auffliegen
function drawLampBirds(c, t) {
  const scare = G.lanternScare && t - G.lanternScare < 2600 ? (t - G.lanternScare) / 2600 : 0;
  titleLamps().forEach(([lx, top], i) => {
    if (scare > 0 && scare < 1) {
      const d = i ? 1 : -1, bx = lx + d * (14 + scare * 210), by = top - 8 - Math.sin(scare * Math.PI) * 90 - scare * 40, fw = Math.sin(t * 0.05) * 6;
      E(c, bx, by, 3.2, 2.4, '#8a5a3a', 1.2); L(c, [bx - 7, by - fw, bx, by, bx + 7, by - fw], 1.8, '#8a5a3a');
      return;
    }
    const hop = Math.max(0, Math.sin(t * 0.006 + lx)) * 1.4, look = Math.sin(t * 0.0009 + lx) > 0 ? 1 : -1, by = top - 5 - hop;
    E(c, lx + 1, by, 3.6, 3, '#8a5a3a', 1.1);
    E(c, lx + 1 + look * 3, by - 3, 2.2, 2, '#8a5a3a', 0.9);
    P(c, [lx + 1 + look * 4.6, by - 2.8, lx + 1 + look * 6.8, by - 2.2, lx + 1 + look * 4.6, by - 1.6], '#e8a040', 0.7);
    if (Math.sin(t * 0.0035 + lx) > 0.95) txt(c, '♪', lx + 7, by - 7, '700 7px "Baloo 2", sans-serif', '#3a2410');
  });
}
function drawHaus3d(t) {
  if (cx.isPix || !imgOk(HAUS_IMG)) return false;
  const h = 522, w = h * HAUS_IMG.naturalWidth / HAUS_IMG.naturalHeight, x = 262 - w / 2, y = 606 - h, at = ([fx, fy]) => [x + fx * w, y + fy * h];
  const [sx, sy] = at(HAUS_AT.chimney);
  for (let i = 0; i < 3; i++) { const k = ((t * 0.0003) + i / 3) % 1; cx.save(); cx.globalAlpha = (1 - k) * 0.5; E(cx, sx + Math.sin(t * 0.002 + i) * 10, sy - 6 - k * 90, 10 + k * 18, 7 + k * 12, 'rgba(122,90,154,0.9)', 0); cx.restore(); }
  cx.drawImage(HAUS_IMG, x, y, w, h);
  HAUS_AT.windows.forEach((p, i) => { const [wx, wy] = at(p), k = 0.5 + 0.5 * Math.sin(t * 0.0021 + i * 1.7); glow(wx, wy, i < 8 ? 40 : 28, '#ffbe5a', 0.12 + 0.22 * k); });
  HAUS_AT.lamps.forEach((p, i) => { const [lx, ly] = at(p), f = 0.85 + 0.15 * Math.sin(t * 0.017 + i * 2.3) * Math.sin(t * 0.007 + i); glow(lx, ly, 38, '#ffc86e', 0.5 * f); });
  return true;
}
// Gewitter hinter dem Herrenhaus: Wolkentürme, die von innen aufleuchten, alle paar Sekunden ein verästelter Blitz
// (hinter dem Haus, das im Blitzlicht kurz hell wird) und – etwas später – der Donner.
const STORM_P = 6200;
function stormBolt(t) {
  const n = Math.floor(t / STORM_P), h = i => { const x = Math.sin((n * 7 + i) * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const tb = t - n * STORM_P - h(0) * 2600;
  if (tb < 0 || tb > 520) return { n, tb, a: 0, h };
  const a = tb < 80 ? 1 : tb < 150 ? 0.2 : tb < 250 ? 0.95 : tb < 300 ? 0.3 : Math.max(0, (520 - tb) / 220) * 0.8;
  return { n, tb, a, h };
}
function drawStormBack(t) {
  const b = stormBolt(t), fl = b.a;
  // Wolkentürme über dem Haus, Unterseite im Blitz hell
  for (let i = 0; i < 11; i++) {
    const x = -20 + i * 56 + Math.sin(t * 0.00018 + i * 1.7) * 18, y = 40 + Math.sin(i * 2.3) * 30 + (i % 3) * 22, r = 58 + (i % 4) * 18;
    E(cx, x, y - r * 0.18, r * 1.2, r * 0.55, '#3a2058', 0);   // Mondlicht auf den Wolkenkuppen
    E(cx, x, y, r * 1.25, r * 0.6, i % 2 ? '#1a0a2c' : '#22103a', 0);
    if (fl > 0 && !cx.isPix) E(cx, x + 6, y + r * 0.28, r * 1.0, r * 0.24, `rgba(214,190,255,${(0.4 * fl).toFixed(3)})`, 0);
  }
  if (fl <= 0) return;
  if (!cx.isPix) glow(60 + b.h(1) * 170, 120, 280, '#c8b4ff', 0.5 * fl);
  // Blitz: Zickzack von der Wolke bis hinter das Haus, zwei Äste
  const zig = (x, y, len, steps, seed) => { const pts = [x, y]; for (let i = 1; i <= steps; i++) { x += (b.h(seed + i) - 0.5) * 46; y += len / steps; pts.push(x, y); } return pts; };
  const x0 = 50 + b.h(1) * 170, main = zig(x0, 30, 330, 9, 10);   // links vom Logo herunter, endet hinter dem Haus
  const br1 = zig(main[6], main[7], 110, 4, 30), br2 = zig(main[10], main[11], 90, 3, 50);
  cx.save(); cx.globalAlpha = fl; cx.lineCap = cx.lineJoin = 'round';
  for (const [pts, w] of [[main, 1], [br1, 0.55], [br2, 0.45]]) {
    if (!cx.isPix) L(cx, pts, 12 * w, 'rgba(180,150,255,0.35)');
    L(cx, pts, 4.5 * w, '#e8dcff'); L(cx, pts, 1.8 * w, '#ffffff');
  }
  cx.restore();
}
function drawStormFront(t) {
  const b = stormBolt(t);
  if (b.tb > 300 && G.titleThunder !== b.n && G.screen === 'title') { G.titleThunder = b.n; Sound.sfx('thunder'); }   // der Donner kommt hinterher
  if (b.a <= 0 || cx.isPix) return;
  cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = 0.16 * b.a;   // das Haus im Blitzlicht
  cx.fillStyle = '#b8a8ff'; cx.fillRect(0, 0, 560, 610); cx.restore();
}
{ const hausOhneGewitter = drawHaus3d; drawHaus3d = function (t) { if (cx.isPix || !imgOk(HAUS_IMG)) return hausOhneGewitter(t); drawStormBack(t); const r = hausOhneGewitter(t); drawStormFront(t); return r; }; }
{ const villaOhneGewitter = drawMansion; drawMansion = function (c, t) { if (c === cx && G.screen === 'title') drawStormBack(t); villaOhneGewitter(c, t); if (c === cx && G.screen === 'title') drawStormFront(t); }; }
// Grüner und Lila Tentakel in 3D (Blender, Toon-Look mit Kontur); wippen und federn leicht.
// Im Pixel-Modus und mit Partyhütchen bleiben die gezeichneten Figuren.
// Auch die drei Helden gibt es fürs Titelbild in 3D (gleicher Maßstab wie in Blender gerendert),
// dazu Dr. Fred, Gertrude, Hancock, die Wache und der nett gewordene (rosa) Lila Tentakel für den Abspann.
const TENT_IMG = Object.fromEntries([['green', 'tent_gruen'], ['lila', 'tent_lila'], ['nett', 'tent_nett'], ['bernard', 'held_bernard'], ['hoagie', 'held_hoagie'], ['laverne', 'held_laverne'],
  ['drfred', 'npc_drfred'], ['gertrude', 'npc_gertrude'], ['hancock', 'npc_hancock'], ['wache', 'npc_wache']].map(([id, f]) => [id, loadImg(`img/${f}.png`)]));
// Fußpunkt (Anteil der Breite), Höhe bei Maßstab sc0 und Blickrichtung im gerenderten Bild
const TENT_AT = {
  green: [0.5, 205, 1.05, 1], lila: [0.476, 240, 1.2, 1], nett: [0.476, 240, 1.2, 1],   // Tentakel v2 (tent_titel.py): Mund nach rechts
  bernard: [0.512, 151, 0.6, 1], hoagie: [0.463, 122, 0.6, 1], laverne: [0.54, 137, 0.6, 1],
  drfred: [0.585, 143, 0.66, 1], gertrude: [0.48, 120, 0.62, 1], hancock: [0.59, 121, 0.62, 1], wache: [0.405, 228, 0.9, -1],
};
function titleTent3d(id, x, y, seed, sc, dir) {
  const im = TENT_IMG[id];
  if (cx.isPix || G.settings.party || !imgOk(im)) return false;
  const [fx, hh, sc0, d0] = TENT_AT[id], h = sc ? hh * sc / sc0 : hh, w = h * im.naturalWidth / im.naturalHeight, t = G.t, sq = Math.sin(t * 0.004 + seed * 1.3);
  const flip = dir && dir !== d0 ? -1 : 1;
  cx.fillStyle = 'rgba(0,0,0,0.3)'; cx.beginPath(); cx.ellipse(x, y + 2, Math.min(w * 0.42, h * 0.24), 8, 0, 0, Math.PI * 2); cx.fill();
  cx.save(); cx.translate(x, y + 8 + Math.sin(t * 0.003 + seed) * 2); cx.scale((1 - sq * 0.012) * flip, 1 + sq * 0.022); cx.rotate(Math.sin(t * 0.0019 + seed) * 0.025);
  cx.drawImage(im, -fx * w, -h, w, h);
  cx.restore();
  return true;
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
  if (!drawHaus3d(t)) { cx.save(); cx.translate(-10, 0); drawMansion(cx, t); cx.restore(); }
  drawLampBirds(cx, t);
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
  if (!titleTent3d('green', 46, 604, 2)) titleActor('green', 46, 604, 1.05, -1, 2);
  if (!titleTent3d('bernard', 292, 590, 1)) titleActor('bernard', 292, 590, 0.6, 1, 1);
  if (!titleTent3d('hoagie', 352, 592, 3)) titleActor('hoagie', 352, 592, 0.6, 1, 3);
  if (!titleTent3d('laverne', 410, 588, 5)) titleActor('laverne', 410, 588, 0.6, 1, 5);
  if (!titleTent3d('lila', 504, 604, 0, null, -1)) titleActor('lila', 512, 604, 1.2, -1, 0);
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
  const title = 'TENTAKEL-TOAST', font = '400 74px "Titan One", sans-serif', logo3d = drawLogo3d(t);
  cx.font = font;
  const tw = cx.measureText(title).width, gl = ((t * 0.0045) % 26) - 6; let x = W / 2 - tw / 2;
  for (let i = 0; i < (logo3d ? 0 : title.length); i++) {
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
  const sw2 = cx.measureText(T(sub)).width + 50, x0 = W / 2 - sw2 / 2, x1 = W / 2 + sw2 / 2;
  P(cx, [x0 - 28, 140, x0 + 6, 138, x0 + 6, 168, x0 - 28, 170, x0 - 16, 154], '#5a1446', 2.5);
  P(cx, [x1 + 28, 140, x1 - 6, 138, x1 - 6, 168, x1 + 28, 170, x1 + 16, 154], '#5a1446', 2.5);
  P(cx, [x0, 132, x1, 132, x1, 162, x0, 162], '#8a2a6a', 3);
  txt(cx, sub, W / 2, 153, '700 19px "Baloo 2", sans-serif', '#fff0fa', 'center', 4, '#3a0a2a');
  if (G.photoMode) return;   // Foto vom Titelbild: ohne Menü
  drawLangPills();
  const bx = 596, bw = 300, btns = [];
  if (G.saved) btns.push({ id: 'cont', label: 'Weiterspielen', big: true });
  btns.push({ id: 'new', label: G.saved ? 'Neues Spiel' : 'Spiel starten', big: !G.saved });
  if (G.hasSaves) btns.push({ id: 'load', label: 'Spielstand laden' });
  btns.push({ id: 'lang', label: langLabel() });
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
  for (const [lx, top] of titleLamps()) {   // Vögel auf den Laternen verscheuchen
    if (Math.abs(x - lx) < 26 && y > top - 36 && y < top + 22 && !(G.lanternScare && G.t - G.lanternScare < 2600)) { G.lanternScare = G.t; Sound.sfx('flutter'); Sound.sfx('chirp'); return true; }
  }
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
  for (const p of G.langPills || []) if (inRect(x, y, p, 3)) { Sound.sfx('click'); setLang(p.id, true); return; }
  const b = G.titleBtns.find(b => inRect(x, y, b)); if (!b) { titleEgg(x, y); return; }
  Sound.sfx('click');
  if (b.id === 'load') G.menu = 'load';
  else if (b.id === 'cont') continueGame(G.saved);
  else if (b.id === 'new') startNew();
  else if (b.id === 'voice') toggleVoice();
  else if (b.id === 'lang') cycleLang();
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
// Schriftzug "ENDE" in 3D (Blender, wie das Titel-Logo); im Pixel-Modus bleiben die gezeichneten Buchstaben
const ENDE_IMG = loadImg('img/ende.png');
function drawEnde3d(t) {
  if (cx.isPix || !imgOk(ENDE_IMG)) return false;
  const w = 310, h = w * ENDE_IMG.naturalHeight / ENDE_IMG.naturalWidth, s = 1 + Math.sin(t * 0.0023) * 0.025;
  cx.save(); cx.translate(W / 2, 100 + Math.sin(t * 0.004) * 5); cx.scale(s, s); cx.rotate(Math.sin(t * 0.0017) * 0.02);
  cx.drawImage(ENDE_IMG, -w / 2, -h / 2, w, h);
  cx.restore();
  return true;
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
    if (titleTent3d(id === 'lila' ? 'nett' : id, x, y, i, sc, dir)) {
      if (id === 'lila') for (let k = 0; k < 4; k++) {   // Herzchen über dem nett gewordenen Tentakel
        const f = (t * 0.0006 + k * 0.25) % 1;
        cx.globalAlpha = 1 - f; heart(cx, x + (-20 + k * 16 + Math.sin(t * 0.004 + k) * 6) * sc, y - (205 + f * 70) * sc, 7 * sc, '#ff5fa8'); cx.globalAlpha = 1;
      }
    } else titleActor(id, x, y, sc, dir, i, { talking: Math.sin(t * 0.0021 + i * 2.2) > 0.7, nice: id === 'lila' ? 1 : 0 });
  });
  // Konfetti
  for (const c of (hd ? FW.conf : FW.conf.slice(0, 16))) { cx.save(); cx.translate(c.x, c.y); cx.rotate(c.r); cx.scale(1, Math.abs(Math.cos(c.r * 1.7)) + 0.2); cx.fillStyle = c.col; cx.fillRect(-3, -2, 6, 4); cx.restore(); }
  // Titel, Statistik, Abspann
  if (hd) { const lg = cx.createRadialGradient(W / 2, 120, 40, W / 2, 120, 360); lg.addColorStop(0, 'rgba(14,4,30,0.55)'); lg.addColorStop(1, 'rgba(14,4,30,0)'); cx.fillStyle = lg; cx.fillRect(0, 0, W, 300); }
  const gl = ((t * 0.004) % 14) - 3;
  if (!drawEnde3d(t)) ['E', 'N', 'D', 'E'].forEach((ch, i) => {
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
  s[roomId] = 1; G.sign = { room: roomId, t0: G.t + 200 }; Sound.sfx('sign'); Sound.motif(ROOMS[roomId].era);
}
function markVisit(r) {
  const v = G.state.visited || (G.state.visited = {});
  if (r && !v[r]) { v[r] = 1; if (Object.entries(ROOMS).every(([id, rm]) => v[id] || rm.noMap)) unlock('reise'); }
}
function updateVisits() {
  if (G.screen !== 'game' || !G.state) return;
  for (const p of PLAYERS) markVisit(ACT[p].room);
  if (G.t - (G.ambSync || 0) > 1000) { G.ambSync = G.t; Sound.ambience(roomAmb()); }
}
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
  cx.font = '400 30px "Titan One", sans-serif'; const tw = cx.measureText(T(room.name)).width;
  cx.font = '800 12px "Baloo 2", sans-serif'; const sw = cx.measureText(T(era.label.toUpperCase())).width;
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
function mapRooms(era) { const order = (MAP_ORDER[era] || []).filter(id => ROOMS[id]); return order.concat(Object.values(ROOMS).filter(r => r.era === era && !r.noMap && !order.includes(r.id)).map(r => r.id)); }   // noMap: Ausflugsziele wie das Marsgesicht stehen nicht auf der Karte
// Postkarten-Vorschau eines Raums: Hintergrund plus Gegenstände im aktuellen Zustand
function mapThumb(room, w, h) {
  const s = Math.min(2, VS * DPR); let c = mapThumbs[room.id];
  if (c && c._s === s) return c;
  c = document.createElement('canvas'); c.width = Math.ceil(w * s); c.height = Math.ceil(h * s); c._s = s;
  const g = c.getContext('2d'), keep = cx;
  g.setTransform(s * w / W, 0, 0, s * h / SH, 0, 0);
  try {
    cx = g; drawBg(room); if (room.thumb) room.thumb(g);
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
    const list = mapRooms(era), rh = Math.min(120, (bh - 222) / list.length);   // mehr Orte pro Epoche: kleinere Postkarten
    list.forEach((id, ri) => {
      const room = ROOMS[id], cw = Math.min(196, Math.round((rh - 30) * W / SH)), th = Math.round(cw * SH / W), x = ex + (ew - cw) / 2, y = top + 62 + ri * rh, seen = !!vis[id];
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
  const k = VS * DPR, bw = 110, bh = hgt + 14, key = `${id}|${known ? 1 : 0}|${k.toFixed(2)}|${fig3dOk(base.kind) ? 3 : 2}`;
  let c = bioCache[key];
  if (!c) {
    c = bioCache[key] = document.createElement('canvas'); c.width = Math.ceil(bw * k); c.height = Math.ceil(bh * k);
    const g = c.getContext('2d'), keep = cx;
    g.setTransform(k * sc, 0, 0, k * sc, bw / 2 * k, (bh - 4) * k);
    cx = g; HDS.ink = true;
    try { CHAR[base.kind](g, a, 0); } catch (e) { /* Figur fehlt – leere Karte */ } finally { cx = keep; HDS.ink = false; }
    const ink = inkify(c, c.width, c.height, Math.max(1.2, 2.3 * k * sc));
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.drawImage(ink, 0, 0, c.width, c.height, 0, 0, c.width, c.height);
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
  G.settings.party = !G.settings.party; saveSettings(); Sound.setParty(G.settings.party);
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

// ---------- Moderne, minimale Bedienung (HD) ----------
// Die Szene füllt den ganzen Bildschirm (Kamera fährt mit), statt Verbleiste gibt es Linksklick = passende
// Aktion, Rechtsklick = Aktionsmenü, eine einblendbare Inventarleiste und kleine Symbol-Knöpfe.
const MK = H / SH, VW = W / MK;
const sceneCv = document.createElement('canvas'), sceneCx = sceneCv.getContext('2d');
function modernUI() { return G.settings.ui !== 'classic'; }   // die minimale Bedienung gilt auch im Pixel-Look
function toScreen(x, y) { return [(x - G.view.x) * MK, y * MK]; }
function toScene(x, y) { return [G.view.x + x / MK, y / MK]; }
function scrPt(x, y) { const c = G.cam; if (c.z > 1.001) { x = c.x + (x - c.x) * c.z; y = c.y + (y - c.y) * c.z; } return toScreen(x, y); }
function camTarget() {
  const room = viewRoomId(), p = me(), sp = G.speech && G.speech.a;
  let fx = W / 2;
  if (p.room === room && p.visible) {
    fx = p.x + (p.walking ? (p.dir || 1) * 70 : 0);
    if (sp && sp !== p && sp.room === room && sp.visible) fx = (p.x + sp.x) / 2;   // im Gespräch beide ins Bild
  } else if (sp && sp.room === room) fx = sp.x;
  return Math.max(0, Math.min(W - VW, fx - VW / 2));
}
function updateView(dt) {
  if (!G.state || G.screen !== 'game') return;
  const t = camTarget(), r = viewRoomId();
  if (G.viewRoomLast !== r) { G.view.x = t; G.viewRoomLast = r; return; }
  G.view.x += (t - G.view.x) * Math.min(1, dt * 0.0032);
}
// Pixel-Look mit minimaler Bedienung: Szene mit Kamera direkt in den 320×200-Puffer – der Schwenk rastet auf ganze Pixel
function drawSceneModernPix() {
  const off = Math.round(G.view.x * MK * PSCALE);
  G.modernPass = true; SSK = MK;
  try { cx.save(); cx.setTransform(MK, 0, 0, MK, -off / PSCALE, 0); drawScene(); cx.restore(); }
  finally { SSK = 1; G.modernPass = false; }
  cx.setTransform(1, 0, 0, 1, 0, 0);
  drawSceneOverlays();
}
function drawSceneModern() {
  if (cx.isPix) return drawSceneModernPix();
  const s = VS * DPR * MK, w = Math.ceil(W * s), h = Math.ceil(SH * s);
  if (sceneCv.width !== w || sceneCv.height !== h) { sceneCv.width = w; sceneCv.height = h; }
  const keep = cx; cx = sceneCx; SSK = MK; G.modernPass = true;
  try { cx.setTransform(s, 0, 0, s, 0, 0); cx.clearRect(0, 0, W, SH); drawScene(); }
  finally { cx = keep; SSK = 1; G.modernPass = false; }
  const k = VS * DPR; cx.setTransform(k, 0, 0, k, 0, 0);
  cx.drawImage(sceneCv, G.view.x * s, 0, VW * s, SH * s, 0, 0, W, H);
  drawParallaxFg();
  drawSceneOverlays();
}
function drawCaption(y) {
  if (!G.caption) return;
  cx.font = '400 26px "Titan One", sans-serif';
  const w = cx.measureText(T(G.caption)).width + 40;
  R(cx, W / 2 - w / 2, y, w, 46, 'rgba(20,10,32,0.85)', 0, 12);
  txt(cx, G.caption, W / 2, y + 32, '400 26px "Titan One", sans-serif', '#ffd23a');
}
function drawSceneOverlays() {
  const room = ROOMS[viewRoomId()];
  VH = H;
  try {
    drawReveal(room, true); drawConfetti(); drawHotspotHelp(room, true);
    drawChapterCard(); drawSign();
    if (G.fadeMode !== 'iris') drawTransition();
    drawBark(true); drawSpeech(true);
    if (G.photoFlash && G.t - G.photoFlash < 260) { cx.fillStyle = `rgba(255,255,255,${(0.7 * (1 - (G.t - G.photoFlash) / 260)).toFixed(3)})`; cx.fillRect(0, 0, W, H); }
    drawCaption(H - 128);
    drawToasts();
    if (G.inIntro && !G.fast && !G.skipAll) {
      button(UI.skip, 'Intro überspringen  »', inRect(G.mouse.x, G.mouse.y, UI.skip));
      txt(cx, 'Klick: nächste Zeile', UI.skip.x + UI.skip.w / 2, 56, '600 12px "Baloo 2", sans-serif', 'rgba(255,255,255,0.7)');
    }
    if (fsAvailable && !G.photoMode) fsIcon(UI.fs, inRect(G.mouse.x, G.mouse.y, UI.fs, 4));
  } finally { VH = SH; }
}

// Leiste: Symbol-Knöpfe oben rechts, Tasche unten links, Gesichter unten rechts, Inventar blendet sich ein
const HUD = { bag: null, ports: [], btns: [] };
const HUD_BTNS = [['klo', 'Klo-Post (K)'], ['reveal', 'Zeigen (Tab)'], ['pixel', 'Pixel-Grafik (P)'], ['hint', 'Tipp (H)'], ['menu', 'Menü (Esc)']];
function layoutHud() {   // auf Touch-Geräten größere Ziele
  const s = Math.min(UIS, 1.35), bw = Math.round(40 * s), bh = Math.round(32 * s), r = Math.round(19 * s), n = HUD_BTNS.length;
  HUD.bag = { x: 12, y: H - 10 - Math.round(50 * s), w: Math.round(52 * s), h: Math.round(50 * s) };
  HUD.ports = PLAYERS.map((id, i) => ({ id, x: W - 12 - r - (2 - i) * (2 * r + 7), y: H - 14 - r, r }));
  HUD.btns = HUD_BTNS.map(([id, tip], i) => ({ id, tip, x: W - 54 - (n - i) * (bw + 6), y: 8, w: bw, h: bh }));
}
layoutHud();
const easeOut = k => 1 - Math.pow(1 - k, 3);
function hudShelf() { const x = HUD.bag.x + HUD.bag.w + 10, right = HUD.ports[0].x - HUD.ports[0].r - 12; return { x, y: H - 68 + (1 - easeOut(G.hudK)) * 86, w: right - x, h: 60 }; }
function hudSlots() { const s = hudShelf(), sw = Math.min(60, (s.w - 16) / 12); return Array.from({ length: 12 }, (_, i) => ({ i, x: s.x + 8 + i * sw, y: s.y + 4, w: sw - 4, h: 52 })); }
function portPos(id) { return modernUI() ? HUD.ports.find(p => p.id === id) : UI.ports.find(p => p.id === id); }
function flyTarget(idx) {
  if (!modernUI()) { const s = UI.inv[idx]; return [s.x + s.w / 2, s.y + s.h / 2]; }
  if (G.hudK > 0.5) { const s = hudSlots()[idx]; return [s.x + s.w / 2, s.y + s.h / 2]; }
  return [HUD.bag.x + HUD.bag.w / 2, HUD.bag.y + HUD.bag.h / 2];
}
function updateHud(dt) {
  if (G.screen !== 'game') { G.hudK = 0; return; }
  const m = G.mouse, ptr = G.pointer !== 'touch' && m.x >= 0;
  const over = ptr && (m.y > H - 12 || inRect(m.x, m.y, HUD.bag, 6) || (G.hudK > 0.3 && inRect(m.x, m.y, hudShelf(), 16)));
  const want = !G.inIntro && !G.menu && !G.dialog && !(G.busy && G.t > (G.hudPeek || 0)) && (over || G.invPin || G.t < (G.hudPeek || 0));
  if (want !== !!G.hudWant && (over || G.invPin)) Sound.sfx('shelf');
  G.hudWant = want;
  G.hudK += ((want ? 1 : 0) - G.hudK) * Math.min(1, dt * 0.012);
}
function hitHUD(x, y) {
  if (G.screen !== 'game' || G.inIntro) return null;
  for (const b of HUD.btns) if (inRect(x, y, b)) return { type: b.id };
  if (inRect(x, y, HUD.bag)) return { type: 'bag' };
  for (const p of HUD.ports) if (Math.hypot(x - p.x, y - p.y) <= p.r + 5) return { type: 'port', id: p.id };
  if (G.hudK > 0.6) { for (const s of hudSlots()) if (inRect(x, y, s)) return { type: 'inv', idx: s.i }; if (inRect(x, y, hudShelf())) return { type: 'shelf' }; }
  return null;
}
function hudIcon(b, hot) {
  R(cx, b.x, b.y, b.w, b.h, hot ? 'rgba(58,39,88,0.92)' : 'rgba(18,10,30,0.5)', 1.5, 10, hot ? '#ffe066' : 'rgba(170,140,230,0.55)');
  const x = b.x + b.w / 2, y = b.y + b.h / 2, col = hot ? '#ffe066' : '#e6dcff';
  if (b.id === 'menu') for (const d of [-6, 0, 6]) L(cx, [x - 9, y + d, x + 9, y + d], 2.4, col);
  else if (b.id === 'hint') txt(cx, '?', x, y + 8, '400 22px "Titan One", sans-serif', col);
  else if (b.id === 'reveal') { E(cx, x, y, 11, 6.5, null, 2.2, 0, col); E(cx, x, y, 3.5, 3.5, col, 0); }
  else if (b.id === 'pixel') { for (const [dx, dy, on] of [[-8, -8, 1], [0, -8, 0], [-8, 0, 0], [0, 0, 1]]) R(cx, x + dx, y + dy, 7, 7, on ? col : null, 1.6, 1, col); if (G.settings.retro) E(cx, x + 10, y - 9, 2.5, 2.5, '#7dff7a', 0); }
  else if (b.id === 'klo') { R(cx, x - 8, y - 10, 9, 9, null, 2, 2, col); S(cx, null, 2.2, () => { cx.moveTo(x - 10, y + 1); cx.lineTo(x + 10, y + 1); cx.quadraticCurveTo(x + 8, y + 9, x, y + 10); cx.quadraticCurveTo(x - 8, y + 9, x - 10, y + 1); }, col); }
}
function drawHUD() {
  if (G.inIntro) return;
  const mx = G.mouse.x, my = G.mouse.y, dim = G.busy && !G.dialog;
  cx.save(); if (dim) cx.globalAlpha = 0.4;
  // Symbol-Knöpfe oben rechts (mit Hinweis beim Darüberfahren)
  for (const b of HUD.btns) {
    const hot = !dim && inRect(mx, my, b);
    hudIcon(b, hot || (b.id === 'reveal' && G.t < G.reveal) || (b.id === 'klo' && G.verb === 'give' && !G.first));
    if (hot) txt(cx, b.tip, Math.min(W - 60, b.x + b.w / 2), b.y + b.h + uf(16), `700 ${uf(12)}px "Baloo 2", sans-serif`, '#fff6d0', 'center', 4, '#0b0610');
  }
  // Tasche unten links mit Anzahl
  const bg = HUD.bag, bh = inRect(mx, my, bg) || G.invPin, n = inv().length;
  if (!cx.isPix) glow(bg.x + bg.w / 2, bg.y + bg.h / 2, 46, '#000000', 0);
  R(cx, bg.x, bg.y, bg.w, bg.h, bh ? 'rgba(58,39,88,0.92)' : 'rgba(18,10,30,0.55)', 1.5, 14, bh ? '#ffe066' : 'rgba(170,140,230,0.55)');
  const bx = bg.x + bg.w / 2, by = bg.y + bg.h / 2 + 3;
  R(cx, bx - 14, by - 9, 28, 20, '#a8743a', 2, 6, '#3a2010'); S(cx, '#c08848', 2, () => { cx.moveTo(bx - 14, by - 7); cx.quadraticCurveTo(bx, by + 6, bx + 14, by - 7); cx.lineTo(bx + 14, by - 9); cx.quadraticCurveTo(bx, by - 15, bx - 14, by - 9); cx.closePath(); }, '#3a2010');
  S(cx, null, 2.4, () => { cx.moveTo(bx - 8, by - 10); cx.quadraticCurveTo(bx, by - 22, bx + 8, by - 10); }, '#3a2010'); E(cx, bx, by - 1, 2.6, 2.6, '#ffd23a', 1.2, 0, '#3a2010');
  if (n) { E(cx, bg.x + bg.w - 6, bg.y + 6, 9, 9, '#ff5fa8', 2, 0, '#1b1020'); txt(cx, String(n), bg.x + bg.w - 6, bg.y + 10.5, '800 12px "Baloo 2", sans-serif', '#ffffff'); }
  // Gesichter unten rechts: Figur wechseln, Gegenstand hierher = Klo-Post
  for (const p of HUD.ports) {
    const isCur = p.id === curId(), fla = G.flash[p.id] && G.t - G.flash[p.id] < 2000, hot = !dim && Math.hypot(mx - p.x, my - p.y) <= p.r + 5;
    if ((isCur || hot) && !cx.isPix) glow(p.x, p.y, 34, isCur ? '#ffe066' : '#c8b0ff', 0.35);
    drawPortrait(cx, p.id, p.x, p.y, p.r, ERA[HOME_ERA[p.id]].bg, G.t, !!(G.speech && G.speech.a && G.speech.a.id === p.id));
    E(cx, p.x, p.y, p.r, p.r, null, isCur || fla || hot ? 3 : 2, 0, fla && Math.floor(G.t / 200) % 2 ? '#7dff7a' : isCur ? '#ffe066' : hot ? '#ffffff' : mix(ERA[HOME_ERA[p.id]].col, '#241739', 0.3));
    if (hot) txt(cx, G.first && G.first[0] === 'i' ? `An ${ACT[p.id].name} schicken` : `${ACT[p.id].name} · ${ERA[HOME_ERA[p.id]].label}`, Math.min(W - 70, p.x), p.y - p.r - 11, `800 ${uf(13)}px "Baloo 2", sans-serif`, '#fff6d0', 'center', 4, '#0b0610');
  }
  // Inventarleiste
  if (G.hudK > 0.02) {
    const sh = hudShelf(), items = inv();
    cx.save(); cx.globalAlpha *= Math.min(1, G.hudK * 1.6);
    R(cx, sh.x, sh.y, sh.w, sh.h, 'rgba(14,7,26,0.82)', 1.5, 16, 'rgba(170,140,230,0.45)');
    if (!cx.isPix) L(cx, [sh.x + 16, sh.y + 2, sh.x + sh.w - 16, sh.y + 2], 1.5, 'rgba(255,255,255,0.12)');
    for (const s of hudSlots()) {
      const id = items[s.i], hot = id && inRect(mx, my, s), sel = id && G.first === 'i:' + id;
      if (hot || sel) R(cx, s.x, s.y, s.w, s.h, sel ? 'rgba(255,224,102,0.16)' : 'rgba(200,180,255,0.12)', 1.5, 12, sel ? '#ffe066' : 'rgba(200,180,255,0.5)');
      else E(cx, s.x + s.w / 2, s.y + s.h / 2 + 18, 16, 3, 'rgba(0,0,0,0.25)', 0);
      if (id && !G.fly.some(f => f.id === id) && !(G.sendFx && G.sendFx.item === id && G.sendFx.to === curId() && G.t - G.sendFx.t0 < 1350)) {
        const lift = hot ? 4 : sel ? 2 + Math.sin(G.t * 0.006) * 2 : 0;
        if ((hot || sel) && !cx.isPix) glow(s.x + s.w / 2, s.y + s.h / 2, 30, sel ? '#ffe066' : '#c8b0ff', 0.3);
        cx.save(); cx.translate(s.x + s.w / 2, s.y + s.h / 2 - lift); cx.scale(0.92, 0.92); ICON[id](cx); cx.restore();
      }
    }
    if (!items.length) txt(cx, 'Noch nichts dabei', sh.x + sh.w / 2, sh.y + 36, '700 15px "Baloo 2", sans-serif', '#8a7aa8');
    cx.restore();
  }
  cx.restore();
  // Gesprächsauswahl als Overlay unten
  if (G.dialog) {
    const { y0, lh } = dialogLayout(), hi = dialogHit(mx, my);
    cx.fillStyle = grad(cx, 0, y0 - 46, 0, H, [[0, 'rgba(8,3,16,0)'], [0.35, 'rgba(8,3,16,0.78)'], [1, 'rgba(8,3,16,0.92)']]); cx.fillRect(0, y0 - 46, W, H - y0 + 46);
    G.dialog.opts.forEach((o, i) => {
      const yy = y0 + i * lh, on = i === hi;
      if (on) R(cx, 24, yy - lh * 0.72, W - 48, lh - 2, 'rgba(255,224,102,0.1)', 0, 10);
      txt(cx, '​' + (on ? '›  ' : '·  ') + T(o.text), 44, yy, `700 ${uf(20)}px "Baloo 2", sans-serif`, on ? '#ffe066' : '#d7c6ff', 'left', 4, '#0b0610');
    });
  }
  if (G.coin) drawCoin();
}
function dialogLayout() { const n = G.dialog ? G.dialog.opts.length : 0, lh = Math.round(32 * UIS); return { y0: H - 20 - (n - 1) * lh, lh }; }

// Aktionsmenü (Rechtsklick / langes Tippen): nur die Aktionen, die bei diesem Ding etwas bewirken können
function verbsFor(key) {
  const [k, id] = key.split(':');
  if (k === 'i') return ['look', 'use'];
  if (k === 'c') return ['look', 'use', 'talk', 'pick', 'push'];
  if (k === 'e') { const e = EGGS[id]; return ['look', ...['use', 'talk', 'pick', 'push'].filter(v => e[v])]; }
  const out = [];
  if (k === 'o' && OBJ[id].exit) out.push('walk');
  out.push('look');
  const dv = defaultVerb(key); if (dv && !out.includes(dv)) out.push(dv);
  if (k === 'a' && ACT[id].talk && !out.includes('talk')) out.push('talk');
  for (const [v] of VERBS) if (!out.includes(v) && RULES[`${v} ${key}`]) out.push(v);
  if (k === 'o' && OBJ[id].txt) for (const v of Object.keys(OBJ[id].txt)) if (VERB_LABEL[v] && !out.includes(v)) out.push(v);
  if (k === 'o' && OBJ[id].klo && !out.includes('use')) out.push('use');
  return out.slice(0, 6);
}
function openCoin(x, y, key) {
  const vs = verbsFor(key); if (!vs.length) return;
  cx.font = `800 ${uf(15)}px "Baloo 2", sans-serif`;
  const n = vs.length, rad = (n <= 2 ? 44 : 64) * Math.min(UIS, 1.3);
  const ccx = Math.max(110, Math.min(W - 110, x)), ccy = Math.max(90, Math.min(H - 70, y));
  const items = vs.map((v, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2, label = key[0] === 'c' && v === 'use' ? 'Streicheln' : VERB_LABEL[v], w = cx.measureText(label).width + 26, h = Math.round(30 * Math.min(UIS, 1.3));
    return { v, label, x: ccx + Math.cos(a) * rad * 1.25 - w / 2, y: ccy + Math.sin(a) * rad - h / 2, w, h };
  });
  G.coin = { x: ccx, y: ccy, key, items, t0: G.t };
  Sound.sfx('menu');
}
function drawCoin() {
  const c = G.coin, k = easeOut(Math.min(1, (G.t - c.t0) / 160)), mx = G.mouse.x, my = G.mouse.y;
  cx.save(); cx.globalAlpha = k;
  if (!cx.isPix) glow(c.x, c.y, 120, '#000000', 0);
  E(cx, c.x, c.y, 9, 9, 'rgba(14,7,26,0.86)', 2, 0, '#ffe066');
  const n = c.items.length, ny = c.y + (n === 1 ? 34 : n === 2 ? 76 : n === 3 ? 62 : 92);
  txt(cx, nameOf(c.key), c.x, c.y + (ny - c.y) * Math.min(UIS, 1.3), `800 ${uf(15)}px "Baloo 2", sans-serif`, '#ffe066', 'center', 4, '#0b0610');
  for (const b of c.items) {
    const hot = inRect(mx, my, b), bx = c.x + (b.x - c.x) * k, by = c.y + (b.y - c.y) * k;
    L(cx, [c.x, c.y, bx + b.w / 2, by + b.h / 2], 1.5, 'rgba(255,224,102,0.35)');
    R(cx, bx, by, b.w, b.h, hot ? '#ffe066' : 'rgba(30,18,50,0.94)', 2, 15, hot ? '#fff6d0' : 'rgba(255,224,102,0.7)');
    txt(cx, b.label, bx + b.w / 2, by + b.h * 0.67, `800 ${uf(15)}px "Baloo 2", sans-serif`, hot ? '#2a0a3a' : '#fff6d0');
  }
  cx.restore();
}
function coinPick(v, key) {
  if (key[0] === 'i') { const it = key.slice(2); if (v === 'use' && !ITEMS[it].alone) { G.verb = 'use'; G.first = key; return; } return runSentence(v, key); }
  runSentence(v, key);
}
function modernItemClick(it) {
  const k = 'i:' + it;
  if (G.first === k) { if (ITEMS[it].alone) { G.first = null; G.verb = null; return runSentence('use', k); } G.first = null; G.verb = null; return; }
  if (G.first) { const v = G.verb || 'use', a = G.first; G.first = null; G.verb = null; return runSentence(v, a, k); }
  if (G.verb && G.verb !== 'use' && G.verb !== 'give') { const v = G.verb; G.verb = null; return runSentence(v, k); }
  G.verb = G.verb || 'use'; G.first = k; Sound.sfx('click');
}
function modernClick(x, y, right) {
  if (G.coin) { const b = G.coin.items.find(b => inRect(x, y, b)), key = G.coin.key; G.coin = null; if (b) { Sound.sfx('click'); coinPick(b.v, key); } return; }
  const u = hitHUD(x, y);
  if (u) {
    if (u.type === 'menu') return openMenu();
    if (u.type === 'hint') { if (!G.busy) showHint(); return; }
    if (u.type === 'reveal') return toggleReveal();
    if (u.type === 'klo') return quickKlo();
    if (u.type === 'pixel') return toggleRetro();
    if (u.type === 'bag') { G.invPin = !G.invPin; Sound.sfx('click'); return; }
    if (G.busy) return;
    if (u.type === 'inv') { const it = inv()[u.idx]; if (!it) return; if (right) { G.first = null; G.verb = null; return openCoin(x, y, 'i:' + it); } return modernItemClick(it); }
    if (u.type === 'port') return portraitClick(u.id);
    return;
  }
  if (G.busy) return;
  const [sx, sy] = toScene(x, y), h = hitScene(sx, sy);
  if (right) {
    if (G.first || G.verb) { G.first = null; G.verb = null; Sound.sfx('click'); return; }
    if (h) openCoin(x, y, h);
    return;
  }
  if (!h && !G.first && !G.verb && selfHit(sx, sy)) return emote();   // Gegenstände hinter der Figur haben Vorrang (sonst verdeckt sie, wovor sie gerade steht)
  const lc = G.lastClick, dbl = lc && G.t - lc.t < 380 && Math.hypot(sx - lc.x, sy - lc.y) < 30;
  G.lastClick = dbl ? null : { x: sx, y: sy, t: G.t };
  G.ripples.push({ x: sx, y: sy, t: G.t });
  if (!h) { G.first = null; G.verb = null; ++actToken; walkTo(me(), sx, sy); }
  else if (G.first) { const v = G.verb || 'use', a = G.first; G.first = null; G.verb = null; runSentence(v, a, h); }
  else { const v = G.verb || defaultVerb(h) || 'walk'; G.verb = null; runSentence(v, h); }
  if (dbl) quickArrive(sx, sy);
}
// Beschriftung am Zeiger: Ding unter dem Zeiger bzw. ganzer Satz, getragener Gegenstand hängt am Zeiger
function drawTip(x, y, inSc) {
  if (G.pointer === 'touch' || x < 0) return;
  if (G.first && G.first[0] === 'i') { cx.save(); cx.globalAlpha = 0.9; cx.translate(x + 22, y + 22); cx.scale(0.62, 0.62); ICON[G.first.slice(2)](cx); cx.restore(); }
  let label = null;
  if (G.first || G.verb) label = sentence();
  else if (G.hover && (inSc || G.hover[0] === 'i')) label = nameOf(G.hover);
  if (G.hover && inSc && !G.verb && !G.first) { const v = defaultVerb(G.hover); if (v) verbBadge(x, y, v); }
  if (!label) return;
  const tz = uf(15); cx.font = `800 ${tz}px "Baloo 2", sans-serif`;
  const w = cx.measureText(T(label)).width, tx = Math.max(w / 2 + 8, Math.min(W - w / 2 - 8, x)), ty = Math.max(24, y - 22);
  txt(cx, label, tx, ty, `800 ${tz}px "Baloo 2", sans-serif`, G.first ? '#ffffff' : '#ffe066', 'center', 4, '#0b0610');
}
function navTargetsModern() {
  if (G.coin) return G.coin.items.map(b => [b.x + b.w / 2, b.y + b.h / 2]);
  if (G.dialog) { const { y0, lh } = dialogLayout(); return G.dialog.opts.map((o, i) => [80, y0 + i * lh - 6]); }
  const T = [], room = ROOMS[viewRoomId()], add = (x, y) => { const [sx, sy] = toScreen(x, y); if (sx > 4 && sx < W - 4 && sy < H - 70) T.push([sx, sy]); };
  for (const o of room.objs) if (isVisible(o)) add(...hotspotCenter(o));
  for (const a of Object.values(ACT)) if (a.room === room.id && a.visible && a.id !== curId()) add(a.x, a.y - a.h * roomScale(room, a.y) * 0.55);
  for (const b of HUD.btns) T.push([b.x + b.w / 2, b.y + b.h / 2]);
  T.push([HUD.bag.x + HUD.bag.w / 2, HUD.bag.y + HUD.bag.h / 2]);
  for (const p of HUD.ports) T.push([p.x, p.y]);
  if (G.hudK > 0.6) inv().forEach((id, i) => { const s = hudSlots()[i]; T.push([s.x + s.w / 2, s.y + s.h / 2]); });
  return T;
}

// ---------- Tierische Mitbewohner ----------
const CRIT = {};   // Laufzeitzustand; story.js lädt nach engine.js, darum erst beim ersten Gebrauch anlegen
function ensureCrit() { if (!CRIT._ok) { Object.defineProperty(CRIT, '_ok', { value: true }); for (const [id, d] of Object.entries(CRITTERS)) CRIT[id] = Object.assign({ id, crit: true, x: null, y: 0, dir: 1, mode: 'sit', until: 0, phase: 0, calm: 0, seed: Math.random() * 6, nextSound: 0 }, d); } }
function critterList(room) { ensureCrit(); return Object.values(CRIT).filter(c => c.room === room && c.x != null && ROOMS[c.room]); }
function randWalkPt(room) {
  const xs = room.walk.map(p => p[0]), ys = room.walk.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  for (let i = 0; i < 40; i++) { const x = x0 + Math.random() * (x1 - x0), y = y0 + Math.random() * (y1 - y0); if (inPoly(x, y, room.walk)) return [x, y]; }
  return clampWalk(room, (x0 + x1) / 2, y1 - 10);
}
function updateCritters(dt) {
  ensureCrit();
  if (G.screen !== 'game' || !G.state) return;
  for (const c of Object.values(CRIT)) {
    const room = ROOMS[c.room]; if (!room) continue;
    if (c.x == null) { [c.x, c.y] = randWalkPt(room); c.mode = pick(c.idles); c.until = G.t + 2000 + Math.random() * 5000; }
    // Spielfiguren zu nahe? Dann weglaufen – außer man hat sich gerade um das Tier gekümmert
    const p = PLAYERS.map(id => ACT[id]).find(a => a.room === c.room && a.visible && Math.hypot(a.x - c.x, (a.y - c.y) * 1.8) < 64);
    if (p && G.t > c.calm && c.mode !== 'flee') {
      const away = c.x >= p.x ? 1 : -1;
      [c.tx, c.ty] = clampWalk(room, c.x + away * (110 + Math.random() * 90), c.y + (Math.random() - 0.5) * 40);
      c.mode = 'flee'; c.dir = c.tx > c.x ? 1 : -1;
      if (c.room === viewRoomId() && G.t > c.nextSound - 4000) { Sound.sfx(c.sound, panX(c.x)); c.nextSound = G.t + 6000; }
    }
    if (c.mode === 'walk' || c.mode === 'flee') {
      const sp = c.speed * (c.mode === 'flee' ? 2.4 : 1) * dt / 1000, dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
      c.phase += dt * (c.mode === 'flee' ? 0.03 : 0.016);
      if (d <= sp) { c.x = c.tx; c.y = c.ty; c.mode = pick(c.idles); c.until = G.t + 2500 + Math.random() * 6000; }
      else { c.x += dx / d * sp; c.y += dy / d * sp; c.dir = dx > 0 ? 1 : -1; }
    } else if (G.t > c.until && G.t > c.calm) {
      if (Math.random() < 0.6) { [c.tx, c.ty] = randWalkPt(room); c.mode = 'walk'; }
      else { c.mode = pick(c.idles); c.until = G.t + 2500 + Math.random() * 5000; }
    }
    // ab und zu ein Lebenszeichen, wenn man im selben Raum ist
    if (c.room === viewRoomId() && !G.busy && G.t > c.nextSound && c.mode !== 'sleep') { if (G.nextCritter && G.t > G.nextCritter) Sound.sfx(c.sound, panX(c.x)); c.nextSound = G.t + 9000 + Math.random() * 14000; G.nextCritter = G.t + 3000; }
  }
}
function drawCritter(c, room) {
  const sc = roomScale(room, c.y) * 0.95;
  cx.fillStyle = 'rgba(0,0,0,0.2)'; cx.beginPath(); cx.ellipse(c.x, c.y + 1, c.w * 0.45 * sc, 5 * sc, 0, 0, Math.PI * 2); cx.fill();
  cx.save(); cx.translate(c.x, c.y + (c.mode === 'flee' || c.mode === 'walk' ? -Math.abs(Math.sin(c.phase)) * 2 * sc : 0)); cx.scale(sc * (c.dir < 0 ? -1 : 1), sc);
  CRITTER_DRAW[c.kind](cx, c, G.t);
  cx.restore();
  if (G.settings.party) hatAt(c.x + (c.kind === 'cat' ? 17 : c.kind === 'hen' ? 11 : 0) * sc * (c.dir < 0 ? -1 : 1), c.y - (c.kind === 'cat' ? 31 : c.kind === 'hen' ? 39 : 13) * sc, sc * 0.55, c.dir < 0 ? -1 : 1, 3);
}
// ---------- Easter Eggs ----------
const EGG = {};   // Laufzeitobjekte (story.js lädt nach engine.js, darum erst beim ersten Gebrauch anlegen)
function eggOf(id) { if (!EGG[id]) EGG[id] = Object.assign({ id, egg: true, seed: (id.length * 0.37) % 1 }, EGGS[id]); return EGG[id]; }
function eggList(room, draw) {
  if (typeof EGGS === 'undefined') return [];
  if (!G.eggFx) G.eggFx = {};
  return Object.keys(EGGS).map(eggOf).filter(e => e.room === room && (draw || !e.when || e.when()));
}
function drawEgg(e) { cx.save(); cx.translate(e.x, e.y); try { EGG_DRAW[e.kind](cx, e, G.t); } finally { cx.restore(); } }
function eggsFound() { const s = G.state && G.state.eggs; return s ? Object.keys(EGGS).filter(k => s[k]).length : 0; }
// Liste der Easter Eggs: gefundene mit Namen, Ort und Zeit-Symbol, die anderen als Rätsel mit Hinweis auf die Epoche
function drawEggList(bx, y, bw) {
  const seen = (G.state && G.state.eggs) || {};
  txt(cx, 'Kleine Verbeugungen vor den Klassikern – gefunden, wenn man sie einmal anschaut.', W / 2, y + 12, '600 13px "Baloo 2", sans-serif', '#a99ad0');
  Object.entries(EGGS).forEach(([id, e], i) => {
    const yy = y + 42 + i * 30, got = !!seen[id], room = ROOMS[e.room], era = ERA[room.era];
    cx.globalAlpha = got ? 1 : 0.45; eraIcon(cx, room.era, bx + 44, yy - 5, 0.8); cx.globalAlpha = 1;
    txt(cx, got ? e.name : '???', bx + 70, yy, '800 16px "Baloo 2", sans-serif', got ? '#ffd23a' : '#8a7aa8', 'left');
    txt(cx, got ? `${room.name} · ${era.label}` : `irgendwo in der Epoche „${era.label}“`, bx + bw - 30, yy, '600 13px "Baloo 2", sans-serif', got ? '#e6dcff' : '#6a5a88', 'right');
  });
}
async function eggResolve(v, a, b) {
  const key = a[0] === 'e' ? a : b, id = key.slice(2), e = eggOf(id), p = curId();
  if (!G.eggFx) G.eggFx = {};
  const item = a[0] === 'i' ? a.slice(2) : b && b[0] === 'i' ? b.slice(2) : null;
  if (v === 'look') { const seen = G.state.eggs || (G.state.eggs = {}); seen[id] = 1; if (Object.keys(EGGS).every(k => seen[k])) unlock('eier'); }
  if (item || v === 'give') return say(p, e.give || 'Das braucht hier keiner.');
  const r = e[v];
  if (typeof r === 'function') return r(p);
  return say(p, pick(r || e.look));
}
// Hand-Position für das Lichtschwert: Schulter und Armlänge je Held (wie in draw.js)
const SABER_ARM = { bernard: [7, -144, 50], hoagie: [24, -126, 44], laverne: [6, -138, 48] };
function drawSaber() {
  const s = G.saber; if (!s) return;
  const a = ACT[s.id], arm = SABER_ARM[s.id]; if (!a || !arm || a.room !== viewRoomId()) return;
  const room = ROOMS[a.room], sc = roomScale(room, a.y) * (a.scaleMul || 1), d = a.dir || 1, po = pose(a, G.t);
  const ang = po && po.front != null ? -0.12 * (1 - po.mix) + po.front * po.mix : -1.5, f3 = !cx.isPix && a._fig;   // 3D-Figur: Hand aus dem Rendering
  const hx = f3 ? f3[12] : arm[0] - arm[2] * Math.sin(ang), hy = f3 ? f3[13] : arm[1] + arm[2] * Math.cos(ang), ph = ang - 1.1;
  const grow = Math.min(1, (G.t - s.t0) / 220) * (s.off ? Math.max(0, 1 - (G.t - s.off) / 220) : 1), len = 92 * grow;
  const x0 = a.x + d * hx * sc, y0 = a.y + hy * sc, x1 = x0 + d * -Math.sin(ph) * len * sc, y1 = y0 + Math.cos(ph) * len * sc;
  if (len < 1) return;
  const col = '#7fc8ff';
  if (!cx.isPix) {
    glow((x0 + x1) / 2, (y0 + y1) / 2, 60 * sc, col, 0.35);
    cx.save(); cx.globalCompositeOperation = 'lighter'; cx.lineCap = 'round';
    for (const [w, al] of [[12, 0.22], [6, 0.55]]) { cx.strokeStyle = hexA(col, al); cx.lineWidth = w * sc; cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x1, y1); cx.stroke(); }
    cx.restore();
  } else L(cx, [x0, y0, x1, y1], 4, col);
  L(cx, [x0, y0, x1, y1], 2.2 * sc, '#ffffff');
  cx.save(); cx.translate(x0, y0); cx.rotate(Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2); R(cx, -3 * sc, 0, 6 * sc, 18 * sc, '#c8ccd8', 1.5, 1.5); cx.restore();
}
// Fledermaus: flattert ab und zu draußen am Lobbyfenster vorbei (nur im Fensterglas sichtbar)
function batK() { const m = (G.t + 9000) % 23000; return m < 1500 ? m / 1500 : -1; }
// Kaminfunken im Gasthaus: steigen aus dem Feuer auf, glimmen und verlöschen
function drawEmbers(room) {
  if (room.id !== 'gasthaus') return;
  for (let i = 0; i < 13; i++) {
    const q = ((G.t * 0.00042) + i * 0.0769) % 1, x = 104 + ((i * 37) % 70) + Math.sin(G.t * 0.003 + i * 2.3) * 6 * q, y = 296 - q * 82;
    const a = Math.sin(q * Math.PI) * (0.6 + 0.4 * Math.sin(G.t * 0.02 + i * 5));
    if (a <= 0.05) continue;
    if (!cx.isPix) glow(x, y, 10, '#ff9a40', 0.55 * a);
    cx.globalAlpha = a; E(cx, x, y, 1.9, 1.9, q < 0.5 ? '#ffe080' : '#ff8a30', 0); cx.globalAlpha = 1;
  }
}
// Lichtbogen im Labor: zwischen Kabelende und Gut-O-Mat springt ab und zu ein Funke über
function updateLabArc() {
  const here = G.screen === 'game' && G.state && viewRoomId() === 'labor' && !G.menu;
  if (!here) { G.arc = null; return; }
  const a = G.arc || (G.arc = { next: G.t + 6000 + Math.random() * 8000, t0: -1e9 });
  if (G.t >= a.next) { a.t0 = G.t; a.next = G.t + 14000 + Math.random() * 12000; Sound.sfx('crackle', panX(395)); }
}
const LAB_ARC = { x0: 392, y0: 135, x1: 397, y1: 167 };   // Kabelklemme -> Pol am Gut-O-Mat (die 3D-Fassung in js/altbau.js misst sie neu)
function drawLabArc(room) {
  if (room.id !== 'labor' || !G.arc) return;
  const k = G.t - G.arc.t0; if (k < 0 || k > 480) return;
  const flick = (Math.floor(k / 45) % 3) !== 1; if (!flick) return;
  const A = LAB_ARC, seed = Math.floor(k / 45), pts = [A.x0, A.y0], dx = (A.x1 - A.x0) / 6, dy = (A.y1 - A.y0) / 6;
  const rn = i => { const r = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return r - Math.floor(r) - 0.5; };
  for (let i = 1; i < 6; i++) pts.push(A.x0 + i * dx + rn(i) * 15, A.y0 + i * dy);
  pts.push(A.x1, A.y1);
  const fork = [pts[6], pts[7], pts[6] + 7 + rn(9) * 6, pts[7] + 4, pts[6] + 12 + rn(11) * 6, pts[7] + 10];   // kleiner Seitenast
  if (!cx.isPix) { glow((A.x0 + A.x1) / 2, (A.y0 + A.y1) / 2, 44, '#7ad8ff', 0.6); cx.save(); cx.globalAlpha = 0.08; cx.fillStyle = '#9ee4ff'; cx.fillRect(-200, -200, 2400, 900); cx.restore(); }
  L(cx, pts, 4.6, 'rgba(110,210,255,0.7)'); L(cx, fork, 2.6, 'rgba(110,210,255,0.6)');
  L(cx, pts, 1.6, '#ffffff'); L(cx, fork, 1, '#e8f8ff');
}
// Dampf über Gertrudes Kessel
function drawSteam(room) {
  if (room.id !== 'gasthaus') return;
  for (let i = 0; i < 6; i++) {
    const q = ((G.t / 3600) + i / 6) % 1, x = 140 + Math.sin(q * 3 + i * 1.7) * 7 + q * 6, y = 248 - q * 58;
    const a = Math.sin(q * Math.PI) * 0.2; if (a <= 0.02) continue;
    cx.globalAlpha = a; E(cx, x, y, 4 + q * 10, 3 + q * 8, '#fff8ee', 0); cx.globalAlpha = 1;
  }
}
// Kerzen am Kronleuchter im Thronsaal: flackernde Flammen mit warmem Schein
function drawCandles(room) {
  if (room.id !== 'thron') return;
  [259, 279, 299, 319, 339].forEach((x, i) => {
    const f = Math.sin(G.t * 0.017 + i * 1.9) * 0.5 + Math.sin(G.t * 0.041 + i * 3.1) * 0.3, h = 7 + f * 1.6, sx = Math.sin(G.t * 0.013 + i) * 0.8;
    if (!cx.isPix) glow(x, 64, 16 + f * 3, '#ffc860', 0.42 + f * 0.08);
    S(cx, '#ffd84a', 0, () => { cx.moveTo(x - 2.6, 68); cx.quadraticCurveTo(x - 3, 64 - h * 0.4, x + sx, 66 - h); cx.quadraticCurveTo(x + 3, 64 - h * 0.4, x + 2.6, 68); cx.closePath(); });
    E(cx, x, 66.5, 1.2, 1.8, '#fff6d0', 0);
  });
}
const LOBBY_FENSTER = { x: 582, y: 70, w: 58, h: 110 };   // Fensterglas der Lobby (die 3D-Lobby in js/altbau.js setzt es neu)
function drawLobbyBat(room) {
  if (room.id !== 'lobby') return;
  const k = batK(); if (k < 0) return;
  const F = LOBBY_FENSTER, x = F.x - 10 + k * (F.w + 24), y = F.y + F.h * 0.53 - Math.sin(k * Math.PI) * 34 + Math.sin(k * 30) * 4, fl = Math.sin(G.t * 0.05);
  cx.save(); cx.beginPath(); cx.rect(F.x, F.y, F.w, F.h); cx.clip();
  cx.translate(x, y);
  for (const s of [-1, 1]) P(cx, [0, 0, s * 7, -4 - fl * 5, s * 12, -1 - fl * 3, s * 9, 2, s * 5, 1], '#1a1020', 1);
  E(cx, 0, 0, 3, 2.6, '#1a1020', 0); E(cx, 1.2, -0.6, 0.6, 0.6, '#ff6040', 0);
  cx.restore();
}
function drawSwanFlight() {
  const k = eggFx('swan', G.t, 3200); if (k < 0 || viewRoomId() !== 'gasthaus') return;
  const x = -60 + k * 1100, y = 120 - Math.sin(k * Math.PI) * 60 + Math.sin(G.t * 0.004) * 6;
  if (!cx.isPix) for (let i = 1; i <= 5; i++) glow(x - i * 26, y + Math.sin(G.t * 0.004 + i) * 6, 10, '#c8e0ff', 0.25 / i);
  drawSwan(cx, x, y, G.t);
}
// lila Meteor über dem Zukunftsgarten, etwa alle 32 Sekunden
function meteorK() { const m = (G.t + 15000) % 32000; return m < 1400 ? m / 1400 : -1; }
function drawMeteor(room) {
  if (room.id !== 'fgarten') return;
  const k = meteorK(); if (k < 0) return;
  const x = 920 - k * 640, y = 20 + k * 150;
  if (!cx.isPix) { for (let i = 0; i < 8; i++) glow(x + i * 14, y - i * 3.3, 14 - i, '#c070ff', 0.4 - i * 0.04); glow(x, y, 26, '#ffd0ff', 0.6); }
  else L(cx, [x, y, x + 50, y - 12], 3, '#c070ff');
  E(cx, x, y, 4, 4, '#ffe8ff', 0);
}
// Klo-Funk: alle paar Minuten schickt ein anderer Held eine kurze Nachricht durch die Zeit
function updateKloFunk() {
  if (G.screen !== 'game' || !G.state || G.fast || G.inIntro) return;
  if (!G.funkNext) G.funkNext = G.t + 100000 + Math.random() * 60000;
  if (G.funk && G.t - G.funk.t0 > 6500) G.funk = null;
  if (G.t < G.funkNext || G.busy || G.dialog || G.menu || G.speech || G.fade !== 0) return;
  const seen = G.state.funkSeen || (G.state.funkSeen = {});
  const me_ = curId(), list = KLO_FUNK.filter(m => m[1] === me_ && !seen[m[2]]);
  G.funkNext = G.t + 150000 + Math.random() * 90000;
  const m = list.length ? pick(list) : null; if (!m) return;
  seen[m[2]] = 1; save();
  if (Object.keys(seen).length >= 3) wait(6800).then(() => unlock('brieffreund'));
  G.funk = { from: m[0], text: m[2], t0: G.t };
  wait(4200).then(() => { if (curId() === me_ && G.screen === 'game' && !G.busy && !G.speech && !G.dialog && !G.bark && !G.menu) startBark(me_, pick(FUNK_REPLY[me_])); });
  Sound.sfx('flush', -0.6); wait(600).then(() => { if (G.settings.babble) for (let i = 0; i < 5; i++) wait(i * 110).then(() => Sound.blip(ACT[m[0]].voice, -0.5)); });
}
function drawKloFunk() {
  const f = G.funk; if (!f || G.screen !== 'game') return;
  const k = (G.t - f.t0) / 6500, a = Math.min(1, k * 8, (1 - k) * 6); if (a <= 0) return;
  const fz = uf(14); cx.font = `700 ${fz}px "Baloo 2", sans-serif`;
  const lines = wrap(T(f.text), 300 * Math.min(UIS, 1.3)), lh = fz + 3, w = Math.max(...lines.map(l => cx.measureText(l).width)) + 84, h = 34 + lines.length * lh;
  const x = 14 - (1 - Math.min(1, k * 6)) * 60, y = 96;
  cx.save(); cx.globalAlpha = a;
  R(cx, x, y, w, h, 'rgba(20,10,32,0.9)', 2.5, 12, ERA[HOME_ERA[f.from]].col);
  drawPortrait(cx, f.from, x + 30, y + h / 2, 20, ERA[HOME_ERA[f.from]].bg, G.t, k < 0.4);
  txt(cx, `Klo-Post von ${ACT[f.from].name}`, x + 58, y + 20, `800 ${uf(12)}px "Baloo 2", sans-serif`, ERA[HOME_ERA[f.from]].col, 'left');
  lines.forEach((l, i) => txt(cx, '\u200b' + l, x + 58, y + 22 + (i + 1) * lh, `700 ${fz}px "Baloo 2", sans-serif`, '#f3eaff', 'left'));
  cx.restore();
}
function updateEggs() {
  if (G.screen !== 'game' || !G.state || G.fast) return;
  const view = viewRoomId(), st = G.eggSt || (G.eggSt = {});
  const peek = view === 'lobby' && edPeek(G.t) > 0; if (peek && !st.ed && !G.menu) Sound.sfx('psst', panX(EGGS.ed.x)); st.ed = peek;
  const met = view === 'fgarten' && meteorK() >= 0; if (met && !st.meteor && !G.menu) Sound.sfx('meteor', 0.3); st.meteor = met;
  const bat = view === 'lobby' && batK() >= 0; if (bat && !st.bat && !G.menu) Sound.sfx('squeak', 0.25); st.bat = bat;
}
async function critterResolve(v, a, b) {
  const key = a[0] === 'c' ? a : b, id = key.slice(2), c = CRIT[id], L = CRITTER_LINES[id], p = curId();
  const item = a[0] === 'i' ? a.slice(2) : b && b[0] === 'i' ? b.slice(2) : null;
  c.mode = c.kind === 'cat' && v === 'use' ? 'sit' : c.mode === 'sleep' ? 'sit' : c.mode; c.until = G.t + 5000;
  if (item || v === 'give') return say(p, (L.give && (L.give[item] || L.give.any)) || 'Lieber nicht.');
  if (v === 'look') return say(p, pick(L.look));
  if (v === 'use') {
    Sound.sfx(c.kind === 'cat' ? 'purr' : c.sound, panX(c.x));
    const pets = G.state.pets || (G.state.pets = {}); pets[id] = 1;
    if (Object.keys(CRITTERS).every(k => pets[k])) unlock('tierfreund');
    puff(c.x, c.y - c.h * 0.8, '#ff9ad9', 4, { vy: 30, r: 2.2, spread: 10 });
    return say(p, pick(L.use));
  }
  if (v === 'talk') { Sound.sfx(c.sound, panX(c.x)); return say(p, pick(L.talk)); }
  if (v === 'pick' || v === 'push') { c.calm = 0; return say(p, pick(L[v])); }
  return say(p, pick(L.look));
}

// ---------- Kaminlicht ----------
const fireSrc = {};
function fireNoise(t) { return Math.sin(t * 0.013) * 0.5 + Math.sin(t * 0.031 + 1) * 0.3 + Math.sin(t * 0.071 + 2) * 0.2; }
// ---------- Lichtstrahlen ----------
// Mondlicht durchs Lobbyfenster, Sonne durchs Gasthausfenster, Lichtkegel der Laborlampe, Kronleuchter und Spot auf den Thron,
// Sonnenstrahlen mit Linsenreflexen im Garten 1776. win = Fensterglas [x0, y0, x1, y1], dx = Neigung, cone = [x, y, Breite oben, unten, Boden]
const RAYS = {
  lobby: [{ win: [582, 70, 640, 180], dx: -0.62, len: 240, col: '196,214,255', a: 0.2, floor: 382 }],
  gasthaus: [{ win: [486, 70, 598, 178], dx: 0.66, len: 220, col: '255,228,170', a: 0.25, floor: 330, cloud: true }],
  labor: [{ cone: [789, 64, 14, 240, 420], col: '196,255,240', a: 0.12, neon: true }],
  thron: [{ cone: [296, 96, 56, 200, 402], col: '255,214,150', a: 0.15, flick: true }, { cone: [655, -10, 70, 240, 398], col: '236,200,255', a: 0.14 }],
  garten1776: [{ sun: [200, 68], col: '255,246,210', a: 0.11 }],
};
function rayCol(r, a) { return `rgba(${r.col},${Math.max(0, a).toFixed(3)})`; }
function rayDust(r, a, pts) {
  const n = G.quality < 1 ? 6 : 14;
  for (let i = 0; i < n; i++) {
    const u = (G.t * 0.000025 * (1 + (i % 3) * 0.5) + i * 0.137) % 1, v = (i * 0.618) % 1, w = (i * 0.37) % 1;
    const [x, y] = pts(u, v, w), tw = Math.sin(Math.PI * u) * (0.5 + 0.5 * Math.sin(G.t * 0.004 + i * 2.1));
    cx.fillStyle = rayCol(r, a * 4.5 * tw); cx.fillRect(x + Math.sin(G.t * 0.001 + i) * 3, y, 1.8, 1.8);
  }
}
function drawRays(room) {
  const list = RAYS[room.id]; if (!list || !HDS.on) return;
  cx.save(); cx.globalCompositeOperation = 'screen';
  for (const r of list) {
    let a = r.a;
    if (r.cloud) a *= 0.72 + 0.28 * Math.sin(G.t * 0.00035) * Math.sin(G.t * 0.00021 + 1);   // Wolken ziehen vor der Sonne vorbei
    if (r.flick) a *= 0.86 + 0.09 * Math.sin(G.t * 0.013) + 0.05 * Math.sin(G.t * 0.041);
    if (r.neon && G.neon) { const k = G.t - G.neon.start; if ((k > 0 && k < 60) || (k > 130 && k < 180) || (k > 280 && k < 330)) a *= 0.12; }
    if (r.win) {
      const [x0, y0, x1, y1] = r.win, D = r.len, Dx = r.dx * D, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const g = cx.createLinearGradient(mx, my, mx + Dx, my + D);
      g.addColorStop(0, rayCol(r, a)); g.addColorStop(0.55, rayCol(r, a * 0.45)); g.addColorStop(1, rayCol(r, 0));
      cx.fillStyle = g;
      for (let i = 0; i < 4; i++) {   // vier Streifen, die einzeln schimmern
        const xa = x0 + (x1 - x0) * i / 4, xb = x0 + (x1 - x0) * (i + 1) / 4;
        cx.globalAlpha = 0.62 + 0.38 * Math.sin(G.t * 0.0009 + i * 1.9);
        cx.beginPath();
        if (r.dx < 0) { cx.moveTo(xa, y0); cx.lineTo(xb, y0); cx.lineTo(xb, y1); cx.lineTo(xb + Dx, y1 + D); cx.lineTo(xa + Dx, y1 + D); cx.lineTo(xa + Dx, y0 + D); }
        else { cx.moveTo(xa, y0); cx.lineTo(xb, y0); cx.lineTo(xb + Dx, y0 + D); cx.lineTo(xb + Dx, y1 + D); cx.lineTo(xa + Dx, y1 + D); cx.lineTo(xa, y1); }
        cx.closePath(); cx.fill();
      }
      cx.globalAlpha = 1;
      if (r.floor) {   // Lichtfleck, wo der Strahl auf den Boden trifft
        const fx = mx + r.dx * (r.floor - my), rx = (x1 - x0) * 0.95;
        cx.save(); cx.translate(fx, r.floor); cx.scale(1, 0.2);
        const fg = cx.createRadialGradient(0, 0, 0, 0, 0, rx); fg.addColorStop(0, rayCol(r, a * 1.1)); fg.addColorStop(1, rayCol(r, 0));
        cx.fillStyle = fg; cx.fillRect(-rx, -rx, rx * 2, rx * 2); cx.restore();
      }
      rayDust(r, a, (u, v, w) => [x0 + (x1 - x0) * v + Dx * u, y0 + (y1 - y0) * w + D * u]);
    } else if (r.cone) {
      const [x, y, w0, w1, fy] = r.cone;
      for (const [k, al] of [[1, 1], [0.45, 0.9]]) {   // weicher Mantel und hellerer Kern
        const g = cx.createLinearGradient(0, y, 0, fy);
        g.addColorStop(0, rayCol(r, a * 1.5 * al)); g.addColorStop(0.65, rayCol(r, a * 0.5 * al)); g.addColorStop(1, rayCol(r, 0));
        cx.fillStyle = g; cx.beginPath(); cx.moveTo(x - w0 * k / 2, y); cx.lineTo(x + w0 * k / 2, y); cx.lineTo(x + w1 * k / 2, fy); cx.lineTo(x - w1 * k / 2, fy); cx.closePath(); cx.fill();
      }
      cx.save(); cx.translate(x, fy - 12); cx.scale(1, 0.18);
      const fg = cx.createRadialGradient(0, 0, 0, 0, 0, w1 * 0.55); fg.addColorStop(0, rayCol(r, a * 1.2)); fg.addColorStop(1, rayCol(r, 0));
      cx.fillStyle = fg; cx.fillRect(-w1, -w1, w1 * 2, w1 * 2); cx.restore();
      rayDust(r, a, (u, v) => [x + (v - 0.5) * (w0 + (w1 - w0) * u) * 0.8, y + (fy - y) * u]);
    } else if (r.sun) {
      const [sx, sy] = r.sun, rot = G.t * 0.00004;
      for (let i = 0; i < 12; i++) {
        const an = rot + i * Math.PI / 6 + Math.sin(i * 7.3) * 0.12, len = 260 + (i % 3) * 110, wd = 0.06 + (i % 2) * 0.04;
        const g = cx.createRadialGradient(sx, sy, 24, sx, sy, len);
        g.addColorStop(0, rayCol(r, a * (0.7 + 0.3 * Math.sin(G.t * 0.0007 + i)))); g.addColorStop(1, rayCol(r, 0));
        cx.fillStyle = g; cx.beginPath(); cx.moveTo(sx, sy); cx.arc(sx, sy, len, an - wd, an + wd); cx.closePath(); cx.fill();
      }
      // Linsenreflexe auf der Linie von der Sonne durch die Bildmitte
      const vx = modernUI() ? G.view.x + VW / 2 : W / 2, vy = SH * 0.55;
      for (const [k, rr, al, c2] of [[0.5, 14, 1.2, '255,240,190'], [0.85, 30, 0.6, '190,230,255'], [1.25, 9, 1.1, '255,200,240'], [1.65, 46, 0.45, '220,255,200']]) {
        const fx = sx + (vx - sx) * k, fy = sy + (vy - sy) * k, g = cx.createRadialGradient(fx, fy, 0, fx, fy, rr);
        g.addColorStop(0, `rgba(${c2},${(a * al * 0.55).toFixed(3)})`); g.addColorStop(0.7, `rgba(${c2},${(a * al * 0.3).toFixed(3)})`); g.addColorStop(1, `rgba(${c2},0)`);
        cx.fillStyle = g; cx.fillRect(fx - rr, fy - rr, rr * 2, rr * 2);
      }
    }
  }
  cx.restore();
}

// ---------- Leerlauf-Ticks ----------
// Steht die Spielfigur eine Weile still, rückt Bernard die Brille oder grübelt, Hoagie spielt Luftgitarre, Laverne gähnt oder jagt eine Fliege
const FIDGET = { bernard: [['glasses', 1700, 'specs'], ['think', 2800, 'hmm']], hoagie: [['airguitar', 3300, 'airguitar'], ['belly', 2200, 'bellydrum']], laverne: [['yawn', 2600, 'yawn'], ['fly', 3800, 'buzz']] };
function fidget(p, kind) {
  const f = FIDGET[p.id] && (kind ? FIDGET[p.id].find(q => q[0] === kind) : pick(FIDGET[p.id])); if (!f) return;
  p.pose = { kind: f[0], t0: G.t, dur: f[1], puff: 0, fidget: true };
  if (G.state) { const seen = G.state.fidgets || (G.state.fidgets = {}); seen[f[0]] = 1; if (Object.values(FIDGET).every(l => l.every(q => seen[q[0]]))) unlock('geduld'); }
  G.stillSince = G.t + f[1] + 5000 + Math.random() * 7000;
  if (f[2]) Sound.sfx(f[2], panX(p.x));
}
// Eigene Figur anklicken: sofort eine kleine Aktion (jedes Mal eine andere)
function selfHit(x, y) {
  const p = me(), room = ROOMS[p.room]; if (!p.visible || p.room !== viewRoomId()) return false;
  const sc = roomScale(room, p.y) * (p.scaleMul || 1), w = p.bw * sc, h = p.h * sc;
  return x >= p.x - w / 2 && x <= p.x + w / 2 && y >= p.y - h && y <= p.y + 4;
}
function emote() {
  const p = me(), list = FIDGET[p.id]; if (!list || p.walking || G.busy) return;
  const was = p.pose && p.pose.fidget ? p.pose.kind : G.lastEmote, opts = list.filter(f => f[0] !== was);
  const k = pick(opts.length ? opts : list)[0]; G.lastEmote = k; fidget(p, k);
}
// Geräusche zu den Mini-Aktionen der Nebenfiguren – nur im sichtbaren Raum, genau zum Start der Aktion
const NPC_FOLEY = [
  ['gertrude', a => idleAct(a, G.t, 13000, 3800, 6000), 'hummel'], ['gertrude', a => idleAct(a, G.t, 11000, 2600), 'wipe'],
  ['hancock', a => idleAct(a, G.t, 8000, 1700), 'quill'], ['green', a => idleAct(a, G.t, 9000, 3400, 2500), 'lala'],
  ['lila', a => a.nice ? -1 : idleAct(a, G.t, 10000, 2400, 4000), 'scheme'], ['drfred', a => gesture(a, G.t) > 0.15 ? 1 : -1, 'bulb'],
];
function updateNpcFoley() {
  if (G.screen !== 'game' || !G.state || G.fast) return;
  const view = viewRoomId(), st = G.foley || (G.foley = {});
  for (const [id, fn, snd] of NPC_FOLEY) {
    const a = ACT[id], k = id + snd;
    if (!a || a.room !== view || !a.visible) { st[k] = true; continue; }   // erst beim nächsten echten Start klingen, nicht mitten in der Aktion
    const on = fn(a) >= 0;
    if (on && !st[k] && !G.menu && !G.dialog) Sound.sfx(snd, panX(a.x));
    st[k] = on;
  }
}
// Die Katze kommt zu Bernard, wenn er eine Weile stillsteht, und schmiegt sich schnurrend an
function updateSnuggle() {
  const c = CRIT.katze, p = G.state && me(); if (!c || !p || c.x == null) return;
  const still = p.room === c.room && p.visible && !p.walking && !G.busy && !G.dialog;
  if (!still) { c.stillT = G.t; if (c.mode === 'rub') { c.mode = 'sit'; c.until = G.t + 1500; } return; }
  if (c.mode === 'rub') { if (G.t > c.rubEnd) { c.mode = 'sit'; c.until = G.t + 4000; c.calm = G.t + 3000; c.nextSnuggle = G.t + 40000; } return; }
  if (c.snuggle && c.mode !== 'walk') {   // angekommen
    c.snuggle = false; c.mode = 'rub'; c.rubEnd = G.t + 5200; c.calm = G.t + 8000; c.dir = p.x > c.x ? 1 : -1;
    if (c.room === viewRoomId()) Sound.sfx('purr', panX(c.x));
    return;
  }
  if (!c.snuggle && c.mode !== 'sleep' && c.mode !== 'flee' && G.t - (c.stillT || G.t) > 4500 && G.t > (c.nextSnuggle || 0)) {
    const side = c.x < p.x ? -1 : 1;
    [c.tx, c.ty] = clampWalk(ROOMS[c.room], p.x + side * 30, p.y + 2);
    c.mode = 'walk'; c.dir = c.tx > c.x ? 1 : -1; c.snuggle = true; c.calm = G.t + 15000;
  }
}
function updateFidget() {
  if (G.screen !== 'game' || !G.state || G.fast) return;
  const p = me(), f = p.pose && p.pose.fidget;
  const calm = !G.busy && !G.speech && !G.dialog && !G.menu && !G.inIntro && G.fade === 0 && !p.walking && !p.talking && !p.climb && p.visible && !G.photoMode && p.room === viewRoomId();
  if (!calm || (p.pose && !f)) { if (f && !calm) p.pose = null; G.stillSince = Math.max(G.stillSince || 0, G.t); return; }
  if (!p.pose && G.t - (G.stillSince || 0) > 7000) fidget(p);
}

function fireLight(a) {
  const room = ROOMS[a.room], fx = room && ROOM_FX[room.id];
  if (!fx || fx.flicker !== 'fire' || a.room !== viewRoomId()) return null;
  let src = fireSrc[room.id];
  if (src === undefined) { const o = room.objs.find(o => /kamin|feuer|ofen/i.test(o.id + ' ' + (typeof o.name === 'string' ? o.name : ''))); src = fireSrc[room.id] = o ? hotspotCenter(o) : null; }
  if (!src) return null;
  const dx = src[0] - a.x, dist = Math.hypot(dx, (src[1] - a.y) * 0.5), k = Math.max(0, 1 - dist / 640) * (0.72 + 0.28 * fireNoise(G.t + a.x));
  return k > 0.02 ? { side: dx < 0 ? -1 : 1, k } : null;
}

// ---------- Vordergrund mit Parallaxe (moderne Ansicht) ----------
// unscharfe dunkle Silhouetten am Bildrand bewegen sich beim Kameraschwenk schneller als die Szene – Tiefe
// x im Vordergrund-Raum: nur sichtbar, wenn die Kamera an den jeweiligen Raumrand fährt
const FG_PROPS = {
  lobby: [['plant', -14], ['lamp', 982]], labor: [['flask', -16], ['pipe', 990]], gasthaus: [['chair', -10], ['barrel', 984]],
  garten1776: [['post', 986]], fgarten: [['alien', 988]], vorraum: [['curtain', -30], ['curtain', 990, -1]], thron: [['curtain', -30], ['curtain', 990, -1]],
};
const FG_PAR = 1.38, fgCache = {};
function fgShape(c, kind) {
  const F = (fn) => { c.beginPath(); fn(); c.fill(); };
  if (kind === 'plant') {
    F(() => { c.moveTo(-26, 0); c.lineTo(-20, -44); c.lineTo(20, -44); c.lineTo(26, 0); c.closePath(); });
    for (const [x, y, rx, ry, r] of [[-30, -78, 30, 9, -0.9], [26, -84, 32, 9, 0.8], [-6, -112, 10, 34, 0.15], [-40, -104, 26, 8, -1.2], [36, -110, 28, 8, 1.1], [8, -90, 30, 9, 0.4]]) F(() => c.ellipse(x, y, rx, ry, r, 0, Math.PI * 2));
  } else if (kind === 'lamp') {
    F(() => c.rect(-3, -150, 6, 150)); F(() => { c.moveTo(-26, -150); c.lineTo(-16, -190); c.lineTo(16, -190); c.lineTo(26, -150); c.closePath(); }); F(() => c.ellipse(0, -2, 24, 6, 0, 0, Math.PI * 2));
  } else if (kind === 'flask') {   // Rundkolben auf Stativ
    F(() => c.rect(-44, -8, 88, 8)); F(() => c.rect(30, -190, 6, 190)); F(() => c.rect(-6, -150, 40, 5));
    F(() => c.ellipse(-4, -68, 38, 40, 0, 0, Math.PI * 2)); F(() => c.rect(-12, -150, 16, 50)); F(() => c.ellipse(-4, -152, 12, 4, 0, 0, Math.PI * 2));
  } else if (kind === 'pipe') {
    F(() => c.rect(-9, -440, 18, 440)); F(() => c.ellipse(0, -120, 22, 22, 0, 0, Math.PI * 2)); F(() => c.rect(-60, -76, 60, 14));
  } else if (kind === 'chair') {
    F(() => c.rect(-30, -100, 8, 100)); F(() => c.rect(18, -100, 8, 100)); F(() => c.rect(-30, -100, 56, 10)); F(() => c.rect(-30, -62, 56, 8)); F(() => c.rect(-34, -46, 72, 9));
  } else if (kind === 'barrel') {
    F(() => { c.moveTo(-30, 0); c.quadraticCurveTo(-40, -58, -30, -116); c.lineTo(30, -116); c.quadraticCurveTo(40, -58, 30, 0); c.closePath(); });
  } else if (kind === 'post') {
    F(() => c.rect(-9, -130, 18, 130)); F(() => c.rect(-90, -96, 180, 6)); F(() => c.rect(-90, -54, 180, 6));
  } else if (kind === 'alien') {
    for (const [a, l] of [[-0.6, 120], [-0.15, 150], [0.35, 130], [0.8, 95]]) F(() => { c.moveTo(-6, 0); c.quadraticCurveTo(Math.sin(a) * l * 0.4 - 10, -l * 0.6, Math.sin(a) * l, -l); c.quadraticCurveTo(Math.sin(a) * l * 0.4 + 10, -l * 0.6, 6, 0); c.closePath(); });
  } else if (kind === 'curtain') {
    F(() => { c.moveTo(-60, -440); c.lineTo(40, -440); for (let y = -440; y <= 0; y += 40) c.quadraticCurveTo(40 + Math.sin(y * 0.05) * 10, y + 20, 30 + Math.sin(y * 0.03) * 8, y + 40); c.lineTo(-60, 0); c.closePath(); });
  }
}
function fgSprite(room, i, kind, flip) {
  const s = Math.min(2, VS * DPR) * MK, key = room + i + '|' + s.toFixed(2);
  let c = fgCache[key]; if (c) return c;
  const w = 260, h = 470; c = fgCache[key] = document.createElement('canvas'); c.width = Math.ceil(w * s); c.height = Math.ceil(h * s);
  const g = c.getContext('2d'), grd = GRADE[room], col = mix(grd ? grd[0] : '#403060', '#06030c', 0.86);
  g.setTransform(s * (flip || 1), 0, 0, s, (flip < 0 ? w - w / 2 : w / 2) * s, (h - 12) * s);
  if (BLOOM_OK) g.filter = `blur(${(2.6 * s).toFixed(1)}px)`;
  g.fillStyle = col; fgShape(g, kind);
  g.filter = 'none'; g.globalCompositeOperation = 'source-atop';
  const lg = g.createLinearGradient(-130, 0, 130, 0); lg.addColorStop(0, 'rgba(255,255,255,0.05)'); lg.addColorStop(1, 'rgba(0,0,0,0.15)');
  g.setTransform(s, 0, 0, s, w / 2 * s, (h - 12) * s); g.fillStyle = lg; g.fillRect(-130, -460, 260, 470);
  return c;
}
function drawParallaxFg() {
  if (G.fade >= 1) return;
  const room = viewRoomId(), cen = (W - VW) / 2, off = cen + (G.view.x - cen) * FG_PAR;   // Vordergrund-Kamera
  const fg = (ROOM_FX[room] || {}).fg;
  if (fg) {   // Gras am unteren Rand, schneller als die Szene
    cx.save(); cx.setTransform(VS * DPR * MK, 0, 0, VS * DPR * MK, -off * VS * DPR * MK, 0);
    const keep = cx; drawForeground(fg); cx.restore();
  }
  for (const [i, [kind, x, flip]] of (FG_PROPS[room] || []).entries()) {
    const sx = (x - off) * MK; if (sx < -260 || sx > W + 260) continue;
    const img = fgSprite(room, i, kind, flip || 1);
    cx.drawImage(img, sx - 130 * MK, H - 458 * MK, 260 * MK, 470 * MK);
  }
}

// ---------- Hauptschleife ----------
function update(dt) {
  pollPad(dt);
  if (G.skipAll) for (const a of Object.values(ACT)) if (a.target) { a.x = a.target[0]; a.y = a.target[1]; }
  if (G.screen === 'game') updateActors(dt);
  const sp = G.speech;
  if (sp && (G.t >= sp.end || G.skipAll)) finishSpeech();
  else if (sp && sp.babble && G.t < sp.babbleEnd && G.t >= G.nextBlip) { sp.a.vowel = Sound.blip(sp.a.voice, panOf(sp.a)); sp.a.vowelT = G.t; G.nextBlip = G.t + 70 + Math.random() * 60; }
  for (let i = timers.length - 1; i >= 0; i--) if (G.skipAll || G.t >= timers[i].until) { const r = timers[i].r; timers.splice(i, 1); r(); }
  updateEnd(dt); updateRock(); updateToaster(dt); updatePoses(); updateVisits(); updateConfetti(dt); updateCritters(dt);
  const tb = G.titleBark;
  if (tb && G.screen === 'title' && G.t < tb.babbleEnd && G.t >= G.nextBlip && G.settings.babble) { Sound.blip(ACT[tb.id].voice, panX(tb.x)); G.nextBlip = G.t + 90 + Math.random() * 70; }
  updateParts(dt); updateMotes(dt); updateEggs(); updateKloFunk(); updateLabArc(); updateFidget(); updateNpcFoley(); updateSnuggle(); updateWeather(); updateRain(dt); updateBarks(); updateCam(dt); updateCrystals(); updateSky(dt); updateGlint();
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
  if (modernUI()) { updateView(dt); updateHud(dt); }
  if (G.mouse.x < 0) { G.ms.x = -99; G.ms.y = -99; } else if (modernUI() && G.screen === 'game') [G.ms.x, G.ms.y] = toScene(G.mouse.x, G.mouse.y); else { G.ms.x = G.mouse.x; G.ms.y = G.mouse.y; }
  if (G.coin && (G.busy || G.menu || G.dialog || G.screen !== 'game')) G.coin = null;
  if (G.screen === 'game' && G.pointer === 'mouse' && !G.busy) {
    const u = modernUI() ? hitHUD(G.mouse.x, G.mouse.y) : G.mouse.y >= SH ? hitUI(G.mouse.x, G.mouse.y) : null, key = u && u.type === 'verb' ? u.id : u && u.type === 'inv' && inv()[u.idx] ? 'inv' + u.idx : null;
    if (key && key !== G.lastVerbHover) Sound.sfx('hover');
    G.lastVerbHover = key;
  }
  G.inScene = false;
  if (G.screen === 'game' && !G.dialog && !G.menu && G.state && modernUI()) {
    const { x, y } = G.mouse, u = hitHUD(x, y);
    G.inScene = !u && !G.coin && x >= 0;
    if (u && u.type === 'inv') { const id = inv()[u.idx]; if (id) G.hover = 'i:' + id; }
    else if (u && u.type === 'port' && G.first) G.hover = 'p:' + u.id;
    else if (G.inScene) G.hover = hitScene(...toScene(x, y));
  } else if (G.screen === 'game' && !G.dialog && !G.menu && G.state) {
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
  else if (G.screen === 'game') { if (modernUI()) { drawSceneModern(); if (!G.photoMode) drawHUD(); } else { drawScene(); drawUI(); } if (!G.photoMode) drawFly(); if (G.menu) drawMenu(); }
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
// Umgebungslicht: die Ränder neben dem Spielbild (Handy quer, breite Monitore) leuchten weich in den Farben der Szene
const ambCv = document.getElementById('amb'), ambG = ambCv && ambCv.getContext('2d');
let ambMid = null, ambMidG = null;
function updateAmbilight() {
  if (!ambG || document.hidden || G.t - (G.ambT || 0) < (G.quality < 1 ? 260 : 140)) return;
  G.ambT = G.t;
  const r = cv.getBoundingClientRect(), gap = Math.max(window.innerWidth - r.width, window.innerHeight - r.height);
  ambCv.style.opacity = gap > 24 ? '1' : '0';
  if (gap <= 24) return;
  // Der Rand-Canvas ist winzig und läuft deshalb auf der CPU: das Hauptbild direkt hineinzuziehen zwingt die Grafikkarte, die ganze Fläche
  // zurückzugeben (spürbarer Ruckler alle 140 ms in Chrome/Edge). Darum erst auf einen kleinen, aber beschleunigbaren Zwischencanvas verkleinern.
  if (!ambMid) { ambMid = document.createElement('canvas'); ambMid.width = 224; ambMid.height = 140; ambMidG = ambMid.getContext('2d'); }
  ambMidG.drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, ambMid.width, ambMid.height);
  ambG.globalCompositeOperation = 'source-over'; ambG.filter = 'blur(1.2px)';
  ambG.drawImage(ambMid, -3, -3, ambCv.width + 6, ambCv.height + 6); ambG.filter = 'none';
  ambG.fillStyle = 'rgba(10,5,18,0.42)'; ambG.fillRect(0, 0, ambCv.width, ambCv.height);
}
function frame(ts) {
  if (G.last && ts - G.last < 10.5 && !G.fast) { requestAnimationFrame(frame); return; }   // Monitore mit hoher Bildrate: jedes zweite Bild genügt
  const dt = Math.min(50, ts - (G.last || ts)); G.last = ts; G.t += dt;
  // adaptive Qualität: bei anhaltendem Ruckeln DPR und Partikeldichte drosseln, später wieder hoch
  G.fpsAvg += (dt - G.fpsAvg) * 0.03;
  if (G.t > 4000 && G.t - G.fpsGate > 6000) {
    if (G.fpsAvg > 24 && G.quality > 0.5) { G.quality = 0.5; G.fpsGate = G.t; resize(); }
    else if (G.fpsAvg < 17 && G.quality < 1) { G.quality = 1; G.fpsGate = G.t; resize(); }
  }
  try { update(dt); render(); updateAmbilight(); } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
async function boot() {
  resize(); window.addEventListener('resize', resizeSoon);
  window.addEventListener('orientationchange', onOrient);
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', onOrient);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resizeSoon);
  document.addEventListener('fullscreenchange', onFsChange); document.addEventListener('webkitfullscreenchange', onFsChange);
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
  // die großen Figuren-Atlanten der Helden im Hintergrund dekodieren, solange das Titelbild läuft
  setTimeout(() => warmImgs(PLAYERS.map(id => typeof FIG3D !== 'undefined' && FIG3D[id] && FIG3D[id].img), 6000), 1500);
}
