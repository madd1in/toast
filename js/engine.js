'use strict';
// ============================================================
//  Tentakel-Toast – Engine: Verben, Laufen, Sprache, Dialoge,
//  Inventar, Zeitreise-Post, Menü, Speichern, Rendering
// ============================================================

const cv = document.getElementById('game');
const cx = cv.getContext('2d');
let VS = 1, DPR = 1;

const VERBS = [['give', 'Gib'], ['pick', 'Nimm'], ['use', 'Benutze'], ['open', 'Öffne'], ['look', 'Schau an'], ['push', 'Drücke'], ['close', 'Schließe'], ['talk', 'Rede mit'], ['pull', 'Ziehe']];
const VERB_LABEL = Object.fromEntries(VERBS); VERB_LABEL.walk = 'Gehe zu';
const VERB_KEYS = { g: 'give', n: 'pick', b: 'use', o: 'open', s: 'look', d: 'push', c: 'close', r: 'talk', z: 'pull' };
const PLAYERS = ['bernard', 'hoagie', 'laverne'];
const ERA = { present: { label: 'Gegenwart', bg: '#2d5878', theme: 'present' }, past: { label: 'Jahr 1776', bg: '#7a5426', theme: 'past' }, future: { label: 'Zukunft', bg: '#5e2a86', theme: 'future' } };
const HOME_ERA = { bernard: 'present', hoagie: 'past', laverne: 'future' };
const SAVE_KEY = 'tentakel-toast-save-v1', SET_KEY = 'tentakel-toast-settings-v1';

const G = {
  t: 0, last: 0, state: null, screen: 'loading',
  verb: null, first: null, hover: null,
  busy: 0, speech: null, dialog: null, menu: null, note: null, caption: null, viewRoom: null,
  fade: 0, fadeFrom: 0, fadeTarget: 0, fadeStart: 0, fadeDur: 1, fadeRes: null,
  mouse: { x: -99, y: -99, isMouse: true }, flash: {}, fast: false, skipAll: false,
  settings: { music: true, voice: false }, titleBtns: [], menuBtns: [], saved: null,
};
const OBJ = {};

// ---------- kleine Helfer ----------
function buildIndex() { for (const r of Object.values(ROOMS)) for (const o of r.objs) { o.room = r.id; OBJ[o.id] = o; } }
function fl() { return G.state.flags; }
function curId() { return G.state.cur; }
function me() { return ACT[G.state.cur]; }
function inv(c = curId()) { return G.state.inv[c]; }
function has(i, c = curId()) { return inv(c).includes(i); }
function addItem(i, c = curId(), quiet) { if (!inv(c).includes(i)) inv(c).push(i); if (!quiet) Sound.sfx('pick'); }
function takeItem(i, c = curId()) { const a = inv(c), k = a.indexOf(i); if (k >= 0) a.splice(k, 1); if (G.first === 'i:' + i) G.first = null; }
function whereItem(i) { return PLAYERS.find(p => G.state.inv[p].includes(i)) || null; }
function viewRoomId() { return G.viewRoom || me().room; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
const timers = [];
function wait(ms) { if (G.fast || G.skipAll) return Promise.resolve(); return new Promise(r => timers.push({ until: G.t + ms, r })); }
function skipScene() { if (!G.busy || G.dialog) return; G.skipAll = true; Voice.stop(); finishSpeech(); }
function note(text) { G.note = { text, until: G.t + 2600 }; }
function nameOf(key) {
  const [k, id] = key.split(':');
  if (k === 'i') return ITEMS[id].name;
  if (k === 'o') { const n = OBJ[id].name; return typeof n === 'function' ? n() : n; }
  if (k === 'a' || k === 'p') return ACT[id].name;
  return '';
}
function isVisible(o) { return !o.visible || o.visible(); }

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
  for (const a of Object.values(ACT)) {
    if (!a.target) continue;
    const room = ROOMS[a.room]; const sc = room ? roomScale(room, a.y) : 1;
    const [tx, ty] = a.target, dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
    const sp = (a.speed || 170) * sc * dt / 1000;
    if (Math.abs(dx) > 2) a.dir = dx > 0 ? 1 : -1;
    if (d <= sp) {
      a.x = tx; a.y = ty; a.target = null; a.walking = false;
      const r = a._res; a._res = null; if (r) r(true);
    } else { a.x += dx / d * sp; a.y += dy / d * sp; a.walking = true; a.phase = (a.phase || 0) + dt * 0.011; }
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
    G.speech = sp; if (a) a.talking = true;
    if (Voice.on) {
      sp.end = G.t + base * 3 + 3000;
      Voice.speak(text, a ? a.voice : { pitch: 1, rate: 1.05 }).then(() => { if (G.speech === sp) sp.end = Math.min(sp.end, G.t + 250); });
    }
  });
}
function finishSpeech() { const sp = G.speech; if (!sp) return; G.speech = null; if (sp.a) sp.a.talking = false; sp.res(); }
function skipSpeech() { if (!G.speech || G.t - G.speech.start < 160) return; Voice.stop(); finishSpeech(); }
function choose(opts) {
  G.skipAll = false;
  if (G.fast && G.autoChoose) return Promise.resolve(G.autoChoose(opts.filter(Boolean)));
  return new Promise(res => { G.dialog = { opts: opts.filter(Boolean), res }; });
}
function fadeTo(v, ms = 220) {
  if (G.fast || G.skipAll) { G.fade = v; return Promise.resolve(); }
  return new Promise(res => { if (G.fadeRes) G.fadeRes(); G.fadeFrom = G.fade; G.fadeTarget = v; G.fadeStart = G.t; G.fadeDur = ms; G.fadeRes = res; });
}

// ---------- Räume, Figuren, Zeitreise-Post ----------
function music() {
  if (G.screen === 'title') return Sound.play('title');
  if (G.screen === 'end') return Sound.play('ending');
  Sound.play(ERA[ROOMS[viewRoomId()].era].theme);
}
async function goRoom(id, roomId, x, y, dir = 1) {
  const a = ACT[id], view = id === curId();
  if (view) await fadeTo(1, 200);
  a.room = roomId; a.x = x; a.y = y; a.dir = dir; a.target = null; a.walking = false;
  if (view) {
    G.first = null; music(); await fadeTo(0, 200);
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
    await fadeTo(1, 160);
    G.state.cur = ch; music();
    await fadeTo(0, 160);
    if (ARRIVALS[ch] && !fl()['arr_' + ch]) { fl()['arr_' + ch] = true; await ARRIVALS[ch](); }
  } finally { G.busy--; }
  save();
}
async function sendItem(item, to) {
  const from = curId();
  if (to === from) return say(from, 'Das hab ich doch schon.');
  const room = ROOMS[me().room];
  if (!room.klo) return say(from, KLO_NEEDED[from]);
  const it = ITEMS[item];
  if (it.nosend) return say(from, it.nosend);
  const k = OBJ[room.klo];
  await walkTo(me(), k.walk[0], k.walk[1]);
  Sound.sfx('flush'); G.kloAnim = { obj: room.klo, t: G.t };
  takeItem(item, from); addItem(item, to, true);
  G.flash[to] = G.t;
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
  const p = curId();
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
    if (v === 'talk' && ac.talk) return ac.talk();
  }
  if (b && b[0] === 'a' && (v === 'give' || v === 'use')) {
    const ac = ACT[b.slice(2)];
    if (ac.refuse) return say(ac.id, typeof ac.refuse === 'function' ? ac.refuse(a.slice(2)) : ac.refuse);
  }
  if (v === 'give' && b && b[0] === 'o') return say(p, 'Ich glaube nicht, dass das etwas annimmt.');
  return say(p, pick(FALLBACK[p][v] || FALLBACK[p].use));
}

// ---------- Eingabe ----------
const UI = {
  verbs: VERBS.map((v, i) => ({ id: v[0], label: v[1], x: 12 + (i % 3) * 102, y: 474 + Math.floor(i / 3) * 41, w: 100, h: 39 })),
  inv: Array.from({ length: 12 }, (_, i) => ({ i, x: 328 + (i % 6) * 74, y: 474 + Math.floor(i / 6) * 61, w: 70, h: 57 })),
  ports: PLAYERS.map((id, i) => ({ id, x: 814 + i * 54, y: 508, r: 23 })),
  hint: { x: 806, y: 445, w: 66, h: 22 }, menu: { x: 880, y: 445, w: 70, h: 22 },
  skip: { x: W - 196, y: 10, w: 184, h: 30 },
};
const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
function hitUI(x, y) {
  if (inRect(x, y, UI.menu)) return { type: 'menu' };
  if (inRect(x, y, UI.hint)) return { type: 'hint' };
  for (const v of UI.verbs) if (inRect(x, y, v)) return { type: 'verb', id: v.id };
  for (const s of UI.inv) if (inRect(x, y, s)) return { type: 'inv', idx: s.i };
  for (const p of UI.ports) if (Math.hypot(x - p.x, y - p.y) <= p.r + 6 || (Math.abs(x - p.x) < 27 && y > p.y && y < p.y + 62)) return { type: 'port', id: p.id };
  return null;
}
function hitScene(x, y) {
  if (y >= SH || !G.state) return null;
  const room = ROOMS[viewRoomId()];
  const acts = Object.values(ACT).filter(a => a.room === room.id && a.visible && a.id !== curId()).sort((p, q) => q.y - p.y);
  for (const a of acts) {
    const sc = roomScale(room, a.y) * (a.scaleMul || 1), w = a.bw * sc, h = a.h * sc;
    if (x >= a.x - w / 2 && x <= a.x + w / 2 && y >= a.y - h && y <= a.y + 4) return 'a:' + a.id;
  }
  for (let i = room.objs.length - 1; i >= 0; i--) {
    const o = room.objs[i]; if (!isVisible(o)) continue;
    const [rx, ry, rw, rh] = o.rect; if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) return 'o:' + o.id;
  }
  return null;
}
function dialogHit(x, y) {
  if (!G.dialog || y < 470) return -1;
  const i = Math.floor((y - 472) / 24);
  return i >= 0 && i < G.dialog.opts.length && x < 790 ? i : -1;
}
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
function onClick(x, y, right) {
  Sound.init();
  if (G.screen === 'title') return titleClick(x, y);
  if (G.screen === 'end') return endClick(x, y);
  if (G.screen !== 'game') return;
  if (G.menu) return menuClick(x, y);
  if (G.inIntro && inRect(x, y, UI.skip)) { skipScene(); return; }
  if (G.speech) { skipSpeech(); return; }
  if (G.dialog) { const i = dialogHit(x, y); if (i >= 0) { const d = G.dialog; G.dialog = null; Sound.sfx('click'); d.res(d.opts[i].id); } return; }
  const u = y >= SH ? hitUI(x, y) : null;
  if (u && u.type === 'menu') { openMenu(); return; }
  if (u && u.type === 'hint') { if (!G.busy) showHint(); return; }
  if (G.busy) return;
  if (y < SH) return sceneClick(x, y, right);
  if (!u) return;
  if (u.type === 'verb') { G.verb = u.id; G.first = null; Sound.sfx('click'); return; }
  if (u.type === 'inv') { const it = inv()[u.idx]; if (it) itemClick(it, right); return; }
  if (u.type === 'port') return portraitClick(u.id);
}
function toLogical(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
cv.addEventListener('pointermove', e => { const p = toLogical(e); G.mouse.x = p.x; G.mouse.y = p.y; G.mouse.isMouse = e.pointerType === 'mouse'; });
cv.addEventListener('pointerleave', () => { G.mouse.x = -99; G.mouse.y = -99; });
cv.addEventListener('pointerdown', e => { e.preventDefault(); const p = toLogical(e); G.mouse.x = p.x; G.mouse.y = p.y; G.mouse.isMouse = e.pointerType === 'mouse'; onClick(p.x, p.y, e.button === 2); });
cv.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => {
  if (G.screen !== 'game') { if ((e.key === 'Enter' || e.key === ' ') && G.screen === 'title') { Sound.init(); G.saved ? continueGame(G.saved) : startNew(); } return; }
  if (e.key === 'Escape') {
    if (G.menu) { G.menu = null; return; }
    if (G.busy && !G.dialog) { skipScene(); return; }
    if (!G.dialog) openMenu();
    return;
  }
  if (e.key === '.') { skipSpeech(); return; }
  if (G.busy || G.dialog || G.menu) return;
  const map = { 1: 'bernard', 2: 'hoagie', 3: 'laverne' };
  if (map[e.key]) return portraitClick(map[e.key]);
  const v = VERB_KEYS[e.key.toLowerCase()]; if (v) { G.verb = v; G.first = null; }
});

// ---------- Menü ----------
function openMenu() { G.menu = 'main'; }
function menuItems() {
  if (G.menu === 'confirm') return [{ id: 'yes', label: 'Ja, neu starten' }, { id: 'back', label: 'Nein, weiterspielen' }];
  if (G.menu === 'help') return [{ id: 'main', label: 'Zurück' }];
  return [
    { id: 'close', label: 'Weiterspielen' },
    { id: 'music', label: 'Musik: ' + (G.settings.music ? 'an' : 'aus') },
    { id: 'voice', label: 'Sprachausgabe: ' + (!Voice.available ? 'nicht verfügbar' : G.settings.voice ? 'an' : 'aus') },
    { id: 'help', label: 'Steuerung & Hilfe' },
    { id: 'new', label: 'Neues Spiel' },
  ];
}
function menuClick(x, y) {
  const b = G.menuBtns.find(b => inRect(x, y, b)); if (!b) return;
  Sound.sfx('click');
  if (b.id === 'close' || b.id === 'back') G.menu = null;
  else if (b.id === 'music') toggleMusic();
  else if (b.id === 'voice') toggleVoice();
  else if (b.id === 'help') G.menu = 'help';
  else if (b.id === 'main') G.menu = 'main';
  else if (b.id === 'new') G.menu = 'confirm';
  else if (b.id === 'yes') { G.menu = null; startNew(); }
}
function toggleMusic() { G.settings.music = !G.settings.music; Sound.setMusic(G.settings.music); saveSettings(); }
function toggleVoice() { if (!Voice.available) return; G.settings.voice = !G.settings.voice; Voice.on = G.settings.voice; saveSettings(); }

// ---------- Speichern ----------
function save() {
  if (G.screen !== 'game' || !G.state) return;
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
  Sound.setMusic(G.settings.music); Voice.on = G.settings.voice;
}
function applyActors(map) {
  for (const [id, s] of Object.entries(map)) {
    const a = ACT[id]; if (!a) continue;
    Object.assign(a, { room: s.room, x: s.x, y: s.y, dir: s.dir, visible: s.visible !== false, target: null, walking: false, talking: false });
  }
}

// ---------- Spielstart ----------
function resetWorld() {
  G.verb = null; G.first = null; G.speech = null; G.dialog = null; G.caption = null; G.viewRoom = null;
  G.kloAnim = null; G.treeGrowT = 0; G.machineShake = 0; G.toastPop = 0; G.leverT = 0; G.flash = {}; G.note = null;
  for (const a of Object.values(ACT)) { a.nice = 0; a.talking = false; a.walking = false; a.target = null; a._res = null; a.speed = a.baseSpeed; }
}
async function startNew() {
  clearSave(); resetWorld();
  G.state = newState(); applyActors(START_POS);
  G.screen = 'game'; G.fade = 1; music();
  await cutscene(INTRO);
  G.inIntro = false; G.fade = 0;
  save();
  await cutscene(INTRO_TIP);
}
function continueGame(s) {
  resetWorld();
  G.state = s; applyActors(START_POS); if (s.actors) applyActors(s.actors);
  G.screen = 'game'; G.fade = 1; music(); fadeTo(0, 400);
}
async function cutscene(fn) {
  G.busy++;
  try { await fn(); } catch (e) { console.error(e); }
  finally { G.busy--; G.skipAll = false; }
}

// ---------- Rendering ----------
function drawBg(room) {
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
function drawScene() {
  const room = ROOMS[viewRoomId()];
  cx.save(); cx.beginPath(); cx.rect(0, 0, W, SH); cx.clip();
  drawBg(room);
  if (room.dyn) room.dyn(cx, G.t);
  for (const o of room.objs) if (o.draw && !o.fg && isVisible(o)) o.draw(cx, G.t);
  const acts = Object.values(ACT).filter(a => a.room === room.id && a.visible).sort((p, q) => p.y - q.y);
  for (const a of acts) drawActor(a, room);
  for (const o of room.objs) if (o.draw && o.fg && isVisible(o)) o.draw(cx, G.t);
  if (G.fade > 0) { cx.fillStyle = `rgba(12,6,20,${G.fade})`; cx.fillRect(0, 0, W, SH); }
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
    R(cx, W / 2 - w / 2, 10, w, 30, 'rgba(20,10,32,0.85)', 2, 15, '#7dff7a');
    txt(cx, G.note.text, W / 2, 30, '700 15px "Baloo 2", sans-serif', '#d8ffd2');
  }
  if (G.inIntro && !G.fast && !G.skipAll) {
    button(UI.skip, 'Intro überspringen  »', inRect(G.mouse.x, G.mouse.y, UI.skip));
    txt(cx, 'Klick: nächste Zeile', W - 104, 58, '600 12px "Baloo 2", sans-serif', 'rgba(255,255,255,0.65)');
  }
  cx.restore();
}
function button(r, label, hot, active) {
  R(cx, r.x, r.y, r.w, r.h, hot ? '#3a2758' : '#24173a', 2, 8, active ? '#ffe066' : '#4a3672');
  txt(cx, label, r.x + r.w / 2, r.y + r.h / 2 + 5, '700 14px "Baloo 2", sans-serif', hot ? '#ffe066' : '#d7c6ff');
}
function drawUI() {
  cx.fillStyle = '#150c20'; cx.fillRect(0, SH, W, H - SH);
  cx.fillStyle = '#2c1c44'; cx.fillRect(0, SH, W, 2);
  const mx = G.mouse.x, my = G.mouse.y;
  txt(cx, G.busy || G.dialog ? '' : sentence(), 400, 462, '600 19px "Baloo 2", sans-serif', '#d7c6ff');
  button(UI.hint, 'Tipp', inRect(mx, my, UI.hint));
  button(UI.menu, 'Menü', inRect(mx, my, UI.menu));
  if (G.dialog) {
    const hi = dialogHit(mx, my);
    G.dialog.opts.forEach((o, i) => txt(cx, o.text, 22, 492 + i * 24, '700 19px "Baloo 2", sans-serif', i === hi ? '#ffe066' : '#c3b2ff', 'left'));
  } else {
    const dv = !G.verb && !G.first ? defaultVerb(G.hover) : null;
    cx.globalAlpha = G.busy ? 0.45 : 1;
    for (const v of UI.verbs) {
      const hot = inRect(mx, my, v), sel = G.verb === v.id, d = dv === v.id;
      if (hot) R(cx, v.x, v.y, v.w, v.h, '#22163a', 0, 8);
      txt(cx, v.label, v.x + v.w / 2, v.y + 27, '800 22px "Baloo 2", sans-serif', sel ? '#ffe066' : hot ? '#ffffff' : d ? '#f6efff' : '#9a82d0');
    }
    const items = inv();
    for (const s of UI.inv) {
      const id = items[s.i], hot = inRect(mx, my, s) && id, selected = id && G.first === 'i:' + id;
      R(cx, s.x, s.y, s.w, s.h, hot ? '#2c1d46' : '#1d1330', 2, 8, selected ? '#ffe066' : '#33224d');
      if (id) { cx.save(); cx.translate(s.x + s.w / 2, s.y + s.h / 2 + 1); ICON[id](cx); cx.restore(); }
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
function drawMenu() {
  cx.fillStyle = 'rgba(10,5,18,0.7)'; cx.fillRect(0, 0, W, H);
  const items = menuItems(), bw = 420, bh = G.menu === 'help' ? 360 : 120 + items.length * 46, bx = W / 2 - bw / 2, by = Math.max(20, 300 - bh / 2);
  R(cx, bx, by, bw, bh, '#1f1432', 3, 16, '#5a4290');
  const title = G.menu === 'confirm' ? 'Wirklich von vorn?' : G.menu === 'help' ? 'Steuerung' : 'Pause';
  txt(cx, title, W / 2, by + 52, '400 30px "Titan One", sans-serif', '#ffd23a', 'center', 5, OUT);
  let y = by + 80;
  if (G.menu === 'confirm') { txt(cx, 'Der aktuelle Spielstand geht dabei verloren.', W / 2, y + 6, '600 15px "Baloo 2", sans-serif', '#c3b2ff'); y += 24; }
  if (G.menu === 'help') {
    ['Verb anklicken, dann Gegenstand oder Person.', 'Ohne Verb: Klick = hinlaufen.', 'Rechtsklick: Standard-Aktion (hervorgehoben).', 'Inventar: "Benutze X mit Y", "Gib X an Y".', 'Gesichter unten rechts: Figur wechseln (Taste 1–3).', 'Am Chrono-Klo: Gegenstand auf ein Gesicht geben,', 'um ihn in eine andere Zeit zu schicken.', 'Klick oder Esc überspringt Text.', 'Tasten: G Gib · N Nimm · B Benutze · S Schau an …']
      .forEach((l, i) => txt(cx, l, W / 2, y + 8 + i * 24, '600 15px "Baloo 2", sans-serif', '#e6dcff'));
    y += 9 * 24 + 6;
  }
  G.menuBtns = items.map((it, i) => ({ id: it.id, x: W / 2 - 150, y: y + i * 46, w: 300, h: 38 }));
  G.menuBtns.forEach((b, i) => button(b, items[i].label, inRect(G.mouse.x, G.mouse.y, b)));
}
function drawCursor() {
  if (!G.mouse.isMouse || G.mouse.x < 0) return;
  const { x, y } = G.mouse, hot = G.screen === 'game' && (G.hover || (G.mouse.y >= SH && hitUI(x, y)));
  const col = G.busy && G.screen === 'game' && !G.dialog && !G.menu ? '#8a7aa8' : hot ? '#ffe066' : '#ffffff';
  cx.lineCap = 'round';
  for (const [w, c] of [[5, '#0b0610'], [2, col]]) {
    cx.lineWidth = w; cx.strokeStyle = c; cx.beginPath();
    cx.moveTo(x - 12, y); cx.lineTo(x - 4, y); cx.moveTo(x + 4, y); cx.lineTo(x + 12, y);
    cx.moveTo(x, y - 12); cx.lineTo(x, y - 4); cx.moveTo(x, y + 4); cx.lineTo(x, y + 12); cx.stroke();
  }
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
  for (let i = 0; i < 3; i++) R(c, 126 + 0, 196 + i * 46, 36, 30, win(i), 3, 3);
  for (let i = 0; i < 2; i++) R(c, 356, 216 + i * 52, 44, 32, win(i + 4), 3, 3);
  for (let i = 0; i < 4; i++) R(c, 110 + i * 88, 380, 50, 50, win(i + 7), 3, 4);
  for (let i = 0; i < 4; i++) R(c, 110 + i * 88, 470, 50, 50, win(i + 12), 3, 4);
  R(c, 236, 530, 70, 70, '#5a2a1e', 4, 6);
  E(c, 140, 120, 3, 3, '#ffd25a', 0);
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
  // Titel
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
  // Buttons
  const bx = 596, bw = 300;
  const btns = [];
  if (G.saved) btns.push({ id: 'cont', label: 'Weiterspielen', big: true });
  btns.push({ id: 'new', label: G.saved ? 'Neues Spiel' : 'Spiel starten', big: !G.saved });
  btns.push({ id: 'voice', label: 'Sprachausgabe: ' + (!Voice.available ? 'nicht verfügbar' : G.settings.voice ? 'an' : 'aus') });
  btns.push({ id: 'music', label: 'Musik: ' + (G.settings.music ? 'an' : 'aus') });
  let y = 300;
  G.titleBtns = btns.map(b => { const r = { ...b, x: bx, y, w: bw, h: b.big ? 50 : 38 }; y += r.h + 12; return r; });
  for (const b of G.titleBtns) {
    const hot = inRect(G.mouse.x, G.mouse.y, b);
    R(cx, b.x, b.y, b.w, b.h, b.big ? (hot ? '#ffe066' : '#ffd23a') : (hot ? '#3a2758' : 'rgba(30,18,52,0.85)'), 3, 12, b.big ? OUT : '#6a52a0');
    txt(cx, b.label, b.x + b.w / 2, b.y + b.h / 2 + (b.big ? 8 : 6), b.big ? '400 22px "Titan One", sans-serif' : '700 16px "Baloo 2", sans-serif', b.big ? '#2a0a3a' : (hot ? '#ffe066' : '#e6dcff'));
  }
  txt(cx, 'Fan-Projekt · nicht verbunden mit LucasArts, Disney oder Double Fine', W / 2 + 140, H - 14, '600 12px "Baloo 2", sans-serif', 'rgba(255,240,255,0.7)');
}
function titleClick(x, y) {
  const b = G.titleBtns.find(b => inRect(x, y, b)); if (!b) return;
  Sound.sfx('click');
  if (b.id === 'cont') continueGame(G.saved);
  else if (b.id === 'new') startNew();
  else if (b.id === 'voice') toggleVoice();
  else if (b.id === 'music') toggleMusic();
}
function drawEnd() {
  const t = G.t;
  cx.fillStyle = grad(cx, 0, 0, 0, H, [[0, '#1a0a2e'], [1, '#6a2a7a']]); cx.fillRect(0, 0, W, H);
  cx.globalAlpha = 0.5;
  for (let i = 0; i < 18; i++) { const k = ((t * 0.00015 + i / 18) % 1); heart(cx, (i * 197) % W, H - k * (H + 40), 8 + (i % 3) * 3, ['#ff5fa8', '#ffd23a', '#7dff7a'][i % 3], 2); }
  cx.globalAlpha = 1;
  txt(cx, 'ENDE', W / 2, 150, '400 96px "Titan One", sans-serif', '#ffd23a', 'center', 12, '#2a0a3a');
  txt(cx, 'Lila Tentakel ist jetzt nett. Vorerst.', W / 2, 200, '700 24px "Baloo 2", sans-serif', '#f3e6ff', 'center', 5, '#2a0a3a');
  const ta = { talking: false, walking: false, phase: 0, seed: 0, nice: 1 };
  cx.save(); cx.translate(W / 2 + 10, 440); CHAR.purple(cx, ta, t + 5000); cx.restore();
  const lines = ['Tentakel-Toast – ein inoffizielles Fanspiel', 'Idee, Code, Grafik und Musik: komplett neu und prozedural erzeugt', 'Day of the Tentacle © LucasArts / Disney · Remastered von Double Fine'];
  lines.forEach((l, i) => txt(cx, l, W / 2, 486 + i * 22, '600 15px "Baloo 2", sans-serif', '#d7c6ff'));
  const b = { x: W / 2 - 130, y: 548, w: 260, h: 40 }; G.endBtn = b;
  R(cx, b.x, b.y, b.w, b.h, inRect(G.mouse.x, G.mouse.y, b) ? '#ffe066' : '#ffd23a', 3, 12);
  txt(cx, 'Nochmal von vorn', W / 2, b.y + 28, '400 20px "Titan One", sans-serif', '#2a0a3a');
}
function endClick(x, y) { if (G.endBtn && inRect(x, y, G.endBtn)) { G.saved = null; G.screen = 'title'; music(); } }

// ---------- Hauptschleife ----------
function update(dt) {
  if (G.skipAll) for (const a of Object.values(ACT)) if (a.target) { a.x = a.target[0]; a.y = a.target[1]; }
  if (G.screen === 'game') updateActors(dt);
  if (G.speech && (G.t >= G.speech.end || G.skipAll)) finishSpeech();
  for (let i = timers.length - 1; i >= 0; i--) if (G.skipAll || G.t >= timers[i].until) { const r = timers[i].r; timers.splice(i, 1); r(); }
  if (G.fadeRes) {
    const k = G.skipAll ? 1 : Math.min(1, (G.t - G.fadeStart) / G.fadeDur);
    G.fade = G.fadeFrom + (G.fadeTarget - G.fadeFrom) * k;
    if (k >= 1) { const r = G.fadeRes; G.fadeRes = null; r(); }
  }
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
function render() {
  const s = VS * DPR;
  cx.setTransform(s, 0, 0, s, 0, 0);
  cx.clearRect(0, 0, W, H);
  if (G.screen === 'title') drawTitle();
  else if (G.screen === 'end') drawEnd();
  else if (G.screen === 'game') { drawScene(); drawUI(); if (G.menu) drawMenu(); }
  else { cx.fillStyle = '#120a1c'; cx.fillRect(0, 0, W, H); txt(cx, 'Lade …', W / 2, H / 2, '700 22px sans-serif', '#d7c6ff'); }
  drawCursor();
}
function frame(ts) {
  const dt = Math.min(50, ts - (G.last || ts)); G.last = ts; G.t += dt;
  try { update(dt); render(); } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
async function boot() {
  resize(); window.addEventListener('resize', resize);
  buildIndex();
  requestAnimationFrame(frame);
  try {
    await Promise.race([
      Promise.all(['800 21px "Baloo 2"', '600 18px "Baloo 2"', '700 15px "Baloo 2"', '400 40px "Titan One"'].map(f => document.fonts.load(f))),
      new Promise(r => setTimeout(r, 3000)),
    ]);
  } catch (e) { /* Fallback-Schrift */ }
  for (const k in bgCache) delete bgCache[k];
  loadSettings();
  G.saved = loadSave();
  G.screen = 'title';
  music();
}
