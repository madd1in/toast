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

const G = {
  t: 0, last: 0, state: null, screen: 'loading',
  verb: null, first: null, hover: null,
  busy: 0, speech: null, dialog: null, menu: null, note: null, caption: null, viewRoom: null,
  fade: 0, fadeFrom: 0, fadeTarget: 0, fadeStart: 0, fadeDur: 1, fadeRes: null, fadeMode: 'iris', irisX: W / 2, irisY: SH / 2, warpLabel: '', warpCol: '#ffd23a',
  mouse: { x: W / 2, y: SH / 2 }, pointer: 'mouse', flash: {}, fast: false, skipAll: false,
  settings: { music: true, voice: false, babble: true, fullscreen: true, retro: false }, titleBtns: [], menuBtns: [], saved: null,
  reveal: 0, fly: [], shake: { until: 0, mag: 0 }, ach: {}, achToast: null, nextBlip: 0, fsTried: false,
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
  DPR = Math.min(window.devicePixelRatio || 1, 2);
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
  if (G.fast || G.skipAll) { if (Math.abs(x - a.x) > 1) a.dir = x > a.x ? 1 : -1; a.x = x; a.y = y; a.target = null; a.walking = false; return Promise.resolve(true); }
  if (Math.hypot(x - a.x, y - a.y) < 2) { a.target = null; a.walking = false; return Promise.resolve(true); }
  return new Promise(res => { a.target = [x, y]; a._res = res; });
}
function updateActors(dt) {
  const view = G.state ? viewRoomId() : null;
  for (const a of Object.values(ACT)) {
    if (!a.target) continue;
    const room = ROOMS[a.room]; const sc = room ? roomScale(room, a.y) : 1;
    const [tx, ty] = a.target, dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
    const sp = (a.speed || 170) * sc * dt / 1000;
    if (Math.abs(dx) > 2) a.dir = dx > 0 ? 1 : -1;
    if (d <= sp) {
      a.x = tx; a.y = ty; a.target = null; a.walking = false;
      const r = a._res; a._res = null; if (r) r(true);
    } else {
      a.x += dx / d * sp; a.y += dy / d * sp; a.walking = true;
      const before = Math.floor((a.phase || 0) / Math.PI);
      a.phase = (a.phase || 0) + dt * 0.011;
      if (Math.floor(a.phase / Math.PI) !== before && a.room === view && room) Sound.step(room.floor);
    }
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
    const base = Math.max(1500, 800 + text.length * 58);
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
  if (G.screen === 'title') { Sound.ambience([]); return Sound.play('title'); }
  if (G.screen === 'end') { Sound.ambience([]); return Sound.play('ending'); }
  const r = ROOMS[viewRoomId()];
  Sound.play(r.theme || ERA[r.era].theme);
  Sound.ambience(r.amb || []);
}
async function goRoom(id, roomId, x, y, dir = 1) {
  const a = ACT[id], view = id === curId();
  if (view) { irisAt(a); await fadeTo(1, 280, 'iris'); }
  a.room = roomId; a.x = x; a.y = y; a.dir = dir; a.target = null; a.walking = false;
  if (view) {
    G.first = null; music(); irisAt(a); await fadeTo(0, 320, 'iris');
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
    G.state.cur = ch; music();
    await wait(260);
    await fadeTo(0, 330, 'warp');
    if (ARRIVALS[ch] && !fl()['arr_' + ch]) { fl()['arr_' + ch] = true; await ARRIVALS[ch](); }
  } finally { G.busy--; if (!G.busy) G.skipAll = false; }
  save();
}
function cycleChar(d) { const i = PLAYERS.indexOf(curId()); switchChar(PLAYERS[(i + d + PLAYERS.length) % PLAYERS.length]); }
async function sendItem(item, to) {
  const from = curId();
  if (to === from) return say(from, 'Das hab ich doch schon.');
  const room = ROOMS[me().room];
  if (!room.klo) return say(from, KLO_NEEDED[from]);
  const it = ITEMS[item];
  if (it.nosend) return say(from, it.nosend);
  const k = OBJ[room.klo];
  await walkTo(me(), k.walk[0], k.walk[1]);
  Sound.sfx('flush'); G.kloAnim = { obj: room.klo, t: G.t }; shake(700, 2.5);
  takeItem(item, from); addItem(item, to, true);
  G.flash[to] = G.t;
  G.state.stats.sent++; unlock('post');
  await wait(1000);
  note(`${it.name} ist bei ${ACT[to].name} (${ERA[HOME_ERA[to]].label}) angekommen.`);
  const hook = SEND_LINES[item];
  await say(from, hook ? hook(to) : pick([`Ab durch die Zeit, ${ACT[to].name}!`, 'Gute Reise!', `Post für ${ACT[to].name}! Per Klo-Express.`]));
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
  G.busy++;
  try { await resolve(v, a, b); }
  catch (e) { console.error(e); }
  finally { G.busy--; if (!G.busy) G.skipAll = false; }
  save();
}
async function resolve(v, a, b) {
  const p = curId(), st = G.state;
  if (v === 'look' && !b) { st.looked[a] = 1; if (Object.keys(st.looked).length >= 25) unlock('neugier'); }
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
      st.talked[ac.id] = 1;
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
  pixel: { x: 650, y: 445, w: 66, h: 22 }, reveal: { x: 722, y: 445, w: 76, h: 22 }, hint: { x: 804, y: 445, w: 62, h: 22 }, menu: { x: 872, y: 445, w: 78, h: 22 },
  skip: { x: W - 240, y: 10, w: 184, h: 30 }, fs: { x: W - 46, y: 8, w: 38, h: 32 },
};
const inRect = (x, y, r, pad = 0) => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
function hitUI(x, y) {
  if (inRect(x, y, UI.menu)) return { type: 'menu' };
  if (inRect(x, y, UI.hint)) return { type: 'hint' };
  if (inRect(x, y, UI.reveal)) return { type: 'reveal' };
  if (inRect(x, y, UI.pixel)) return { type: 'pixel' };
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
  if (G.busy) return;
  if (y < SH) return sceneClick(x, y, right);
  if (!u) return;
  if (u.type === 'verb') { G.verb = u.id; G.first = null; Sound.sfx('click'); return; }
  if (u.type === 'inv') { const it = inv()[u.idx]; if (it) itemClick(it, right); return; }
  if (u.type === 'port') return portraitClick(u.id);
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
  if (k === 'f' || k === 'F') { toggleFullscreen(); return; }
  if (k === 'F1' || k === 'p' || k === 'P') { e.preventDefault(); toggleRetro(); return; }
  if (k.startsWith('Arrow')) { e.preventDefault(); G.pointer = 'pad'; snapNav(k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0, k === 'ArrowUp' ? -1 : k === 'ArrowDown' ? 1 : 0); return; }
  if (k === 'Enter') { e.preventDefault(); if (G.pointer === 'pad') onClick(G.mouse.x, G.mouse.y, false); else if (G.screen === 'title') titleDefault(); else if (G.speech) skipSpeech(); return; }
  if (G.screen === 'title') { if (k === ' ') titleDefault(); return; }
  if (G.screen !== 'game') return;
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
  if (G.screen === 'title') return G.titleBtns.map(b => [b.x + b.w / 2, b.y + b.h / 2]);
  if (G.screen === 'end') return G.endBtn ? [[G.endBtn.x + G.endBtn.w / 2, G.endBtn.y + G.endBtn.h / 2]] : [];
  if (G.menu) return G.menuBtns.map(b => [b.x + b.w / 2, b.y + b.h / 2]);
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
    if (down(0)) { const b = G.titleBtns.find(b => inRect(G.mouse.x, G.mouse.y, b)); if (b) titleClick(G.mouse.x, G.mouse.y); else snapNav(0, 1); }
    if (down(9)) titleDefault();
  } else if (G.screen === 'end') {
    if (down(0) || down(9)) { G.saved = null; G.screen = 'title'; music(); }
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
    if (down(8) || down(10)) toggleReveal();
    if (down(9)) { if (G.menu) G.menu = null; else if (!G.busy && !G.dialog) openMenu(); }
  }
  PAD.prev = now;
}

// ---------- Menü ----------
function openMenu() { G.menu = 'main'; if (G.pointer === 'pad') { G.mouse.x = W / 2; G.mouse.y = 0; snapNav(0, 1); } }
function menuItems() {
  if (G.menu === 'confirm') return [{ id: 'yes', label: 'Ja, neu starten' }, { id: 'back', label: 'Nein, weiterspielen' }];
  if (G.menu === 'help' || G.menu === 'ach') return [{ id: 'main', label: 'Zurück' }];
  return [
    { id: 'close', label: 'Weiterspielen' },
    { id: 'music', label: 'Musik: ' + (G.settings.music ? 'an' : 'aus') },
    { id: 'voice', label: 'Sprachausgabe: ' + (!Voice.available ? 'nicht verfügbar' : G.settings.voice ? 'an' : 'aus') },
    { id: 'babble', label: 'Plapperstimmen: ' + (G.settings.babble ? 'an' : 'aus') },
    { id: 'retro', label: 'Grafik: ' + (G.settings.retro ? 'Klassisch (Pixel)' : 'Remastered') },
    fsAvailable && { id: 'fs', label: 'Vollbild: ' + (isFullscreen() ? 'an' : 'aus') },
    { id: 'ach', label: `Erfolge (${achCount()}/${ACH.length})` },
    { id: 'help', label: 'Steuerung & Hilfe' },
    { id: 'new', label: 'Neues Spiel' },
  ].filter(Boolean);
}
function menuClick(x, y) {
  const b = G.menuBtns.find(b => inRect(x, y, b)); if (!b) return;
  Sound.sfx('click');
  if (b.id === 'close' || b.id === 'back') G.menu = null;
  else if (b.id === 'music') toggleMusic();
  else if (b.id === 'voice') toggleVoice();
  else if (b.id === 'babble') { G.settings.babble = !G.settings.babble; saveSettings(); }
  else if (b.id === 'retro') toggleRetro();
  else if (b.id === 'fs') { G.settings.fullscreen = !isFullscreen(); saveSettings(); toggleFullscreen(); }
  else if (b.id === 'help' || b.id === 'ach' || b.id === 'main') G.menu = b.id;
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
    G.state.progress = p;
    if (!G.fast) { Sound.sfx('solve'); note(`Rätsel gelöst! Fortschritt: ${p} von ${MILESTONES.length}`); }
  }
  try {
    const s = G.state; s.actors = {};
    for (const a of Object.values(ACT)) s.actors[a.id] = { room: a.room, x: Math.round(a.x), y: Math.round(a.y), dir: a.dir, visible: a.visible };
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch (e) { /* Speicher nicht verfügbar – Spiel läuft trotzdem */ }
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
  G.kloAnim = null; G.treeGrowT = 0; G.machineShake = 0; G.toastPop = 0; G.leverT = 0; G.flash = {}; G.note = null; G.fly = []; G.reveal = 0;
  for (const a of Object.values(ACT)) { a.nice = 0; a.talking = false; a.walking = false; a.target = null; a._res = null; a.speed = a.baseSpeed; }
}
function normalizeState(s) {
  s.looked = s.looked || {}; s.talked = s.talked || {}; s.stats = s.stats || { sent: 0, ms: 0 };
  if (s.progress == null) s.progress = 0;
  return s;
}
async function startNew() {
  clearSave(); resetWorld();
  G.state = normalizeState(newState()); applyActors(START_POS);
  G.screen = 'game'; G.fade = 1; G.fadeMode = 'black'; music();
  await cutscene(INTRO);
  G.inIntro = false; G.fade = 0;
  save();
  await cutscene(INTRO_TIP);
}
function continueGame(s) {
  resetWorld();
  G.state = normalizeState(s); applyActors(START_POS); if (s.actors) applyActors(s.actors);
  G.screen = 'game'; G.fade = 1; music(); irisAt(me()); fadeTo(0, 500, 'iris');
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
    const g = c.getContext('2d'); g.setTransform(s, 0, 0, s, 0, 0); room.draw(g); bgCache[key] = c;
  }
  cx.drawImage(c, 0, 0, W, SH);
}
function drawActor(a, room) {
  const sc = roomScale(room, a.y) * (a.scaleMul || 1);
  cx.save(); cx.translate(a.x, a.y);
  cx.fillStyle = 'rgba(0,0,0,0.25)'; cx.beginPath(); cx.ellipse(0, 2, 32 * sc * (a.shadowW || 1), 7 * sc, 0, 0, Math.PI * 2); cx.fill();
  cx.scale(sc * (a.dir < 0 ? -1 : 1), sc);
  CHAR[a.kind](cx, a, G.t);
  cx.restore();
}
function wrap(text, maxW) {
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
    if (sp.a.room === room.id && sp.a.visible) { const sc = roomScale(room, sp.a.y) * (sp.a.scaleMul || 1); x = sp.a.x; y = sp.a.y - sp.a.h * sc - 12; }
  }
  const maxW = Math.max(...lines.map(l => cx.measureText(l).width));
  x = Math.max(maxW / 2 + 12, Math.min(W - maxW / 2 - 12, x));
  y = Math.max(lines.length * lh + 4, y);
  cx.textAlign = 'center'; cx.textBaseline = 'alphabetic'; cx.lineJoin = 'round';
  lines.forEach((l, i) => {
    const ly = y - (lines.length - 1 - i) * lh;
    cx.lineWidth = 5; cx.strokeStyle = '#0b0610'; cx.strokeText(l, x, ly);
    cx.fillStyle = col; cx.fillText(l, x, ly);
  });
}
function drawVignette() {
  const g = cx.createRadialGradient(W / 2, SH * 0.55, 260, W / 2, SH * 0.55, 640);
  g.addColorStop(0, 'rgba(10,4,20,0)'); g.addColorStop(1, 'rgba(10,4,20,0.42)');
  cx.fillStyle = g; cx.fillRect(0, 0, W, SH);
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
    cx.save(); cx.globalAlpha = G.fade; cx.translate(W / 2, SH / 2);
    for (let i = 0; i < 9; i++) {
      const r = (G.t * 0.35 + i * 55) % 495; cx.rotate(0.35 + G.t * 0.0004);
      cx.setLineDash([26, 18]); E(cx, 0, 0, r, r * 0.6, null, 5, 0, i % 2 ? G.warpCol : '#ffffff');
    }
    cx.setLineDash([]); cx.restore();
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
  drawBg(room);
  if (room.dyn) room.dyn(cx, G.t);
  for (const o of room.objs) if (o.draw && !o.fg && isVisible(o)) o.draw(cx, G.t);
  if (cx.isPix) cx.layer(1);   // Pixel-Modus: Figuren auf eigene Ebene, damit Schilder-Texte dahinter bleiben
  const acts = Object.values(ACT).filter(a => a.room === room.id && a.visible).sort((p, q) => p.y - q.y);
  for (const a of acts) drawActor(a, room);
  for (const o of room.objs) if (o.draw && o.fg && isVisible(o)) o.draw(cx, G.t);
  cx.restore();
  if (!cx.isPix) drawVignette();
  drawReveal(room);
  drawTransition();
  drawSpeech();
  if (G.caption) {
    cx.font = '400 26px "Titan One", sans-serif';
    const w = cx.measureText(G.caption).width + 40;
    R(cx, W / 2 - w / 2, SH - 70, w, 46, 'rgba(20,10,32,0.85)', 0, 12);
    txt(cx, G.caption, W / 2, SH - 38, '400 26px "Titan One", sans-serif', '#ffd23a');
  }
  if (G.note && G.t < G.note.until) {
    cx.font = '700 15px "Baloo 2", sans-serif';
    const w = cx.measureText(G.note.text).width + 30;
    R(cx, W / 2 - w / 2, 10, w, 30, 'rgba(20,10,32,0.88)', 2, 15, '#7dff7a');
    txt(cx, G.note.text, W / 2, 30, '700 15px "Baloo 2", sans-serif', '#d8ffd2');
  }
  if (G.achToast && G.t < G.achToast.until) {
    const k = Math.min(1, (G.achToast.until - G.t) / 300, (G.t - (G.achToast.until - 4200)) / 300), x = W - 344, y = 48;
    cx.save(); cx.globalAlpha = Math.max(0, k);
    R(cx, x, y, 332, 60, 'rgba(24,14,40,0.94)', 2.5, 12, '#ffd23a');
    trophy(cx, x + 30, y + 30, 1.2);
    txt(cx, 'Erfolg: ' + G.achToast.a.name, x + 58, y + 26, '800 16px "Baloo 2", sans-serif', '#ffd23a', 'left');
    txt(cx, G.achToast.a.desc, x + 58, y + 46, '600 12px "Baloo 2", sans-serif', '#e6dcff', 'left');
    cx.restore();
  }
  if (G.inIntro && !G.fast && !G.skipAll) {
    button(UI.skip, 'Intro überspringen  »', inRect(G.mouse.x, G.mouse.y, UI.skip));
    txt(cx, 'Klick: nächste Zeile', UI.skip.x + UI.skip.w / 2, 56, '600 12px "Baloo 2", sans-serif', 'rgba(255,255,255,0.7)');
  }
  if (fsAvailable) fsIcon(UI.fs, inRect(G.mouse.x, G.mouse.y, UI.fs, 4));
  cx.restore();
}
function button(r, label, hot, active) {
  R(cx, r.x, r.y, r.w, r.h, hot ? '#3a2758' : '#24173a', 2, 8, active ? '#ffe066' : '#4a3672');
  txt(cx, label, r.x + r.w / 2, r.y + r.h / 2 + 5, '700 14px "Baloo 2", sans-serif', hot || active ? '#ffe066' : '#d7c6ff');
}
function drawUI() {
  cx.fillStyle = '#150c20'; cx.fillRect(0, SH, W, H - SH);
  cx.fillStyle = '#2c1c44'; cx.fillRect(0, SH, W, 2);
  const mx = G.mouse.x, my = G.mouse.y;
  txt(cx, G.busy || G.dialog ? '' : sentence(), 366, 462, '600 19px "Baloo 2", sans-serif', '#d7c6ff');
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
      txt(cx, v.label, v.x + v.w / 2, v.y + 27, '800 22px "Baloo 2", sans-serif', sel ? '#ffe066' : hot ? '#ffffff' : d ? '#f6efff' : '#9a82d0');
    }
    const items = inv();
    for (const s of UI.inv) {
      const id = items[s.i], hot = inRect(mx, my, s) && id, selected = id && G.first === 'i:' + id;
      R(cx, s.x, s.y, s.w, s.h, hot ? '#2c1d46' : '#1d1330', 2, 8, selected ? '#ffe066' : '#33224d');
      if (id && !G.fly.some(f => f.id === id)) { cx.save(); cx.translate(s.x + s.w / 2, s.y + s.h / 2 + 1); ICON[id](cx); cx.restore(); }
    }
    cx.globalAlpha = 1;
  }
  for (const p of UI.ports) {
    const isCur = p.id === curId(), fla = G.flash[p.id] && G.t - G.flash[p.id] < 2000;
    drawPortrait(cx, p.id, p.x, p.y, p.r, ERA[HOME_ERA[p.id]].bg);
    const ring = fla && Math.floor(G.t / 200) % 2 ? '#7dff7a' : isCur ? '#ffe066' : '#4a3a6a';
    E(cx, p.x, p.y, p.r, p.r, null, isCur || fla ? 3.5 : 2.5, 0, ring);
    txt(cx, ACT[p.id].name, p.x, p.y + 42, '800 13px "Baloo 2", sans-serif', isCur ? '#ffe066' : '#c3b2ff');
    txt(cx, ERA[HOME_ERA[p.id]].label, p.x, p.y + 58, '600 10px "Baloo 2", sans-serif', '#8a7aa8');
  }
}
function drawFly() {
  G.fly = G.fly.filter(f => G.t - f.t0 < 700);
  for (const f of G.fly) {
    const idx = inv().indexOf(f.id); if (idx < 0) continue;
    const s = UI.inv[idx], to = [s.x + s.w / 2, s.y + s.h / 2], k = Math.min(1, (G.t - f.t0) / 700), e = 1 - Math.pow(1 - k, 3);
    const x = f.from[0] + (to[0] - f.from[0]) * e, y = f.from[1] + (to[1] - f.from[1]) * e - Math.sin(k * Math.PI) * 110;
    cx.save(); cx.translate(x, y); cx.scale(1.6 - 0.6 * e, 1.6 - 0.6 * e); cx.rotate(Math.sin(k * Math.PI * 2) * 0.3); ICON[f.id](cx); cx.restore();
  }
}
function drawMenu() {
  cx.fillStyle = 'rgba(10,5,18,0.72)'; cx.fillRect(0, 0, W, H);
  const items = menuItems();
  const extra = G.menu === 'help' ? 10 * 23 + 10 : G.menu === 'ach' ? ACH.length * 31 + 10 : G.menu === 'confirm' ? 24 : 0;
  const bw = G.menu === 'help' || G.menu === 'ach' ? 560 : 420, bh = 100 + extra + items.length * 46, bx = W / 2 - bw / 2, by = Math.max(12, 300 - bh / 2);
  R(cx, bx, by, bw, bh, '#1f1432', 3, 16, '#5a4290');
  const title = { confirm: 'Wirklich von vorn?', help: 'Steuerung', ach: `Erfolge ${achCount()}/${ACH.length}` }[G.menu] || 'Pause';
  txt(cx, title, W / 2, by + 48, '400 30px "Titan One", sans-serif', '#ffd23a', 'center', 5, OUT);
  let y = by + 74;
  if (G.menu === 'main' && G.state) { txt(cx, `Fortschritt: ${progress()} von ${MILESTONES.length} Rätseln`, W / 2, y - 2, '600 13px "Baloo 2", sans-serif', '#a99ad0'); y += 10; }
  if (G.menu === 'confirm') { txt(cx, 'Der aktuelle Spielstand geht dabei verloren.', W / 2, y + 6, '600 15px "Baloo 2", sans-serif', '#c3b2ff'); y += 24; }
  if (G.menu === 'help') {
    ['Maus: Verb anklicken, dann Gegenstand oder Person', 'Rechtsklick: Standard-Aktion · ohne Verb: hinlaufen', 'Touch: tippen · lange drücken = Standard-Aktion', 'Controller: Stick = Zeiger · Steuerkreuz = von Ziel zu Ziel', 'A Aktion · X Standard · B Zurück · Y Tipp · RS Pixel-Grafik', 'LB/RB Figur wechseln · LT/RT Verb wählen', 'Ansicht/Tab/Leertaste: Hotspots · F Vollbild · F1/P Pixel-Grafik', 'Tastatur: Pfeile springen · Enter Aktion · 1–3 Figur', 'G Gib · N Nimm · B Benutze · S Schau an · R Rede mit', 'Am Chrono-Klo: Gib → Gegenstand → Gesicht unten rechts']
      .forEach((l, i) => txt(cx, l, W / 2, y + 12 + i * 23, '600 15px "Baloo 2", sans-serif', '#e6dcff'));
    y += 10 * 23 + 10;
  }
  if (G.menu === 'ach') {
    ACH.forEach((a, i) => {
      const got = !!G.ach[a.id], yy = y + 10 + i * 31;
      cx.globalAlpha = got ? 1 : 0.4; trophy(cx, bx + 34, yy, 0.8); cx.globalAlpha = 1;
      txt(cx, a.name, bx + 56, yy + 2, '800 15px "Baloo 2", sans-serif', got ? '#ffd23a' : '#8a7aa8', 'left');
      txt(cx, got ? a.desc : '???', bx + 230, yy + 2, '600 13px "Baloo 2", sans-serif', got ? '#e6dcff' : '#6a5a88', 'left');
    });
    y += ACH.length * 31 + 10;
  }
  G.menuBtns = items.map((it, i) => ({ id: it.id, x: W / 2 - 150, y: y + 6 + i * 46, w: 300, h: 38 }));
  G.menuBtns.forEach((b, i) => button(b, items[i].label, inRect(G.mouse.x, G.mouse.y, b)));
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
}

// ---------- Titel & Ende ----------
function drawMansion(c, t) {
  const body = '#2a1238', trim = '#3d1c52', win = (i) => (Math.sin(t * 0.002 + i * 1.7) > -0.6 ? '#ffd25a' : '#a07020');
  P(c, [70, 600, 470, 600, 462, 330, 78, 338], body, 4);
  P(c, [60, 344, 480, 336, 400, 250, 150, 262], trim, 4);
  P(c, [110, 340, 180, 338, 176, 170, 116, 176], body, 4);
  P(c, [100, 182, 192, 176, 150, 92], trim, 4);
  P(c, [330, 336, 420, 334, 424, 190, 334, 196], body, 4);
  P(c, [320, 202, 436, 194, 384, 112], trim, 4);
  R(c, 252, 210, 24, 60, body, 4);
  for (let i = 0; i < 3; i++) R(c, 126, 196 + i * 46, 36, 30, win(i), 3, 3);
  for (let i = 0; i < 2; i++) R(c, 356, 216 + i * 52, 44, 32, win(i + 4), 3, 3);
  for (let i = 0; i < 4; i++) R(c, 110 + i * 88, 380, 50, 50, win(i + 7), 3, 4);
  for (let i = 0; i < 4; i++) R(c, 110 + i * 88, 470, 50, 50, win(i + 12), 3, 4);
  R(c, 236, 530, 70, 70, '#5a2a1e', 4, 6);
  for (let i = 0; i < 3; i++) { const k = ((t * 0.0003) + i / 3) % 1; c.save(); c.globalAlpha = (1 - k) * 0.5; E(c, 264 + Math.sin(t * 0.002 + i) * 10, 200 - k * 90, 10 + k * 18, 7 + k * 12, '#7a5a9a', 0); c.restore(); }
}
function drawTitle() {
  const t = G.t;
  cx.fillStyle = grad(cx, 0, 0, 0, H, [[0, '#0f0622'], [0.55, '#3a1458'], [1, '#7a2f6a']]); cx.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.001 + i)); E(cx, (i * 173) % W, (i * 89) % 380, 1.4, 1.4, `rgba(255,255,255,${a})`, 0); }
  E(cx, 800, 150, 70, 70, '#ffe9b0', 4, 0, '#c8a060'); E(cx, 780, 130, 12, 9, '#f2d898', 0); E(cx, 826, 172, 9, 7, '#f2d898', 0);
  cx.save(); cx.translate(-10, 0); drawMansion(cx, t); cx.restore();
  const ta = { talking: false, walking: false, phase: 0, seed: 0 };
  cx.save(); cx.translate(500, 600); cx.scale(1.25, 1.25); CHAR.purple(cx, ta, t); cx.restore();
  cx.save(); cx.translate(40, 600); cx.scale(-1.05, 1.05); CHAR.green(cx, { ...ta, seed: 2 }, t); cx.restore();
  const title = 'TENTAKEL-TOAST';
  cx.font = '400 74px "Titan One", sans-serif';
  const tw = cx.measureText(title).width; let x = W / 2 - tw / 2;
  for (let i = 0; i < title.length; i++) {
    const ch = title[i], w = cx.measureText(ch).width, y = 108 + Math.sin(t * 0.004 + i * 0.6) * 6;
    cx.save(); cx.translate(x + w / 2, y); cx.rotate(Math.sin(t * 0.003 + i) * 0.05);
    txt(cx, ch, 0, 0, '400 74px "Titan One", sans-serif', grad(cx, 0, -60, 0, 0, [[0, '#ffe36b'], [1, '#ff8a3d']]), 'center', 12, '#2a0a3a');
    cx.restore(); x += w;
  }
  txt(cx, 'Ein inoffizielles Day-of-the-Tentacle-Fanspiel', W / 2, 150, '700 20px "Baloo 2", sans-serif', '#f3e6ff', 'center', 5, '#2a0a3a');
  const bx = 596, bw = 300, btns = [];
  if (G.saved) btns.push({ id: 'cont', label: 'Weiterspielen', big: true });
  btns.push({ id: 'new', label: G.saved ? 'Neues Spiel' : 'Spiel starten', big: !G.saved });
  btns.push({ id: 'voice', label: 'Sprachausgabe: ' + (!Voice.available ? 'nicht verfügbar' : G.settings.voice ? 'an' : 'aus') });
  btns.push({ id: 'music', label: 'Musik: ' + (G.settings.music ? 'an' : 'aus') });
  btns.push({ id: 'retro', label: 'Grafik: ' + (G.settings.retro ? 'Klassisch (Pixel)' : 'Remastered') });
  if (fsAvailable) btns.push({ id: 'fs', label: 'Vollbild beim Start: ' + (G.settings.fullscreen ? 'an' : 'aus') });
  let y = G.saved ? 236 : 262;
  G.titleBtns = btns.map(b => { const r = { ...b, x: bx, y, w: bw, h: b.big ? 50 : 34 }; y += r.h + 10; return r; });
  for (const b of G.titleBtns) {
    const hot = inRect(G.mouse.x, G.mouse.y, b);
    R(cx, b.x, b.y, b.w, b.h, b.big ? (hot ? '#ffe066' : '#ffd23a') : (hot ? '#3a2758' : 'rgba(30,18,52,0.85)'), 3, 12, b.big ? OUT : (hot ? '#ffe066' : '#6a52a0'));
    txt(cx, b.label, b.x + b.w / 2, b.y + b.h / 2 + (b.big ? 8 : 6), b.big ? '400 22px "Titan One", sans-serif' : '700 16px "Baloo 2", sans-serif', b.big ? '#2a0a3a' : (hot ? '#ffe066' : '#e6dcff'));
  }
  txt(cx, 'Spielbar mit Maus, Touch, Tastatur oder Xbox-Controller', bx + bw / 2, y + 16, '600 13px "Baloo 2", sans-serif', 'rgba(255,240,255,0.8)');
  txt(cx, 'Fan-Projekt · nicht verbunden mit LucasArts, Disney oder Double Fine', W / 2 + 140, H - 14, '600 12px "Baloo 2", sans-serif', 'rgba(255,240,255,0.7)');
}
function titleClick(x, y) {
  const b = G.titleBtns.find(b => inRect(x, y, b)); if (!b) return;
  Sound.sfx('click');
  if (b.id === 'cont') continueGame(G.saved);
  else if (b.id === 'new') startNew();
  else if (b.id === 'voice') toggleVoice();
  else if (b.id === 'music') toggleMusic();
  else if (b.id === 'retro') toggleRetro();
  else if (b.id === 'fs') { G.settings.fullscreen = !G.settings.fullscreen; saveSettings(); if (G.settings.fullscreen) enterFullscreen(); else exitFullscreen(); }
}
function fmtTime(ms) { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function drawEnd() {
  const t = G.t;
  cx.fillStyle = grad(cx, 0, 0, 0, H, [[0, '#1a0a2e'], [1, '#6a2a7a']]); cx.fillRect(0, 0, W, H);
  cx.globalAlpha = 0.5;
  for (let i = 0; i < 18; i++) { const k = ((t * 0.00015 + i / 18) % 1); heart(cx, (i * 197) % W, H - k * (H + 40), 8 + (i % 3) * 3, ['#ff5fa8', '#ffd23a', '#7dff7a'][i % 3], 2); }
  cx.globalAlpha = 1;
  txt(cx, 'ENDE', W / 2, 140, '400 96px "Titan One", sans-serif', '#ffd23a', 'center', 12, '#2a0a3a');
  txt(cx, 'Lila Tentakel ist jetzt nett. Vorerst.', W / 2, 188, '700 24px "Baloo 2", sans-serif', '#f3e6ff', 'center', 5, '#2a0a3a');
  const ta = { talking: false, walking: false, phase: 0, seed: 0, nice: 1 };
  cx.save(); cx.translate(W / 2 + 10, 420); CHAR.purple(cx, ta, t + 5000); cx.restore();
  const st = G.endStats || { ms: 0, sent: 0 };
  txt(cx, `Spielzeit ${fmtTime(st.ms)} · Zeitreise-Sendungen: ${st.sent} · Erfolge: ${achCount()}/${ACH.length}`, W / 2, 452, '800 17px "Baloo 2", sans-serif', '#ffd23a', 'center', 4, '#2a0a3a');
  const lines = ['Tentakel-Toast – ein inoffizielles Fanspiel', 'Idee, Code, Grafik und Musik: komplett neu und prozedural erzeugt', 'Day of the Tentacle © LucasArts / Disney · Remastered von Double Fine'];
  lines.forEach((l, i) => txt(cx, l, W / 2, 482 + i * 20, '600 14px "Baloo 2", sans-serif', '#d7c6ff'));
  const b = { x: W / 2 - 130, y: 548, w: 260, h: 40 }; G.endBtn = b;
  R(cx, b.x, b.y, b.w, b.h, inRect(G.mouse.x, G.mouse.y, b) ? '#ffe066' : '#ffd23a', 3, 12);
  txt(cx, 'Nochmal von vorn', W / 2, b.y + 28, '400 20px "Titan One", sans-serif', '#2a0a3a');
}
function endClick(x, y) { if (G.endBtn && inRect(x, y, G.endBtn)) { G.saved = null; G.screen = 'title'; music(); } }

// ---------- Hauptschleife ----------
function update(dt) {
  pollPad(dt);
  if (G.skipAll) for (const a of Object.values(ACT)) if (a.target) { a.x = a.target[0]; a.y = a.target[1]; }
  if (G.screen === 'game') updateActors(dt);
  const sp = G.speech;
  if (sp && (G.t >= sp.end || G.skipAll)) finishSpeech();
  else if (sp && sp.babble && G.t < sp.babbleEnd && G.t >= G.nextBlip) { Sound.blip(sp.a.voice); G.nextBlip = G.t + 70 + Math.random() * 60; }
  for (let i = timers.length - 1; i >= 0; i--) if (G.skipAll || G.t >= timers[i].until) { const r = timers[i].r; timers.splice(i, 1); r(); }
  if (G.fadeRes) {
    const k = G.skipAll ? 1 : Math.min(1, (G.t - G.fadeStart) / G.fadeDur);
    G.fade = G.fadeFrom + (G.fadeTarget - G.fadeFrom) * k;
    if (k >= 1) { const r = G.fadeRes; G.fadeRes = null; r(); }
  }
  if (G.screen === 'game' && G.state && !G.menu) G.state.stats.ms += dt;
  G.hover = null;
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
  if (G.screen === 'title') drawTitle();
  else if (G.screen === 'end') drawEnd();
  else if (G.screen === 'game') { drawScene(); drawUI(); drawFly(); if (G.menu) drawMenu(); }
  else { cx.fillStyle = '#120a1c'; cx.fillRect(0, 0, W, H); txt(cx, 'Lade …', W / 2, H / 2, '700 22px sans-serif', '#d7c6ff'); }
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
  G.saved = loadSave();
  G.screen = 'title';
  music();
}
