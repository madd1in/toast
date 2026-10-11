'use strict';
// ============================================================
//  Tentakel-Toast – Echtzeit-3D (Beta), Anbindung ans Spiel
//  Ist „Echtzeit-3D“ in den Einstellungen an, lädt das Spiel js/echt3d-szene.js (three.js über die Import-Map in
//  index.html) und zeichnet in allen Blender-Räumen statt des vorgerenderten Hintergrunds ein echtes 3D-Bild; jeder
//  Raum wird beim ersten Besuch geladen. Bernard, Hoagie und Laverne laufen dann als echte 3D-Figuren, alle anderen
//  bleiben Bilder. Hotspots, Laufwege, Dialoge, Licht-Effekte und die Oberfläche bleiben die des Spiels – die 3D-Kamera
//  ist dieselbe wie beim vorgerenderten Bild. Im Pixel-Modus und solange ein Raum lädt, bleibt alles wie gehabt.
// ============================================================
const ECHT3D = {
  mod: null, loading: false, failed: false,
  rooms: { hafen: 1, landeplatz: 1, keller: 1, lobby: 1, labor: 1, konferenz: 1, gasthaus: 1, garten1776: 1, fgarten: 1, vorraum: 1, thron: 1, testkammer: 1, mars: 1, stockwerk: 1, dachboden: 1, uhrwerk: 1 },
};
function echt3dWanted(room) { return !!(G.settings.echt3d && room && ECHT3D.rooms[room.id] && !cx.isPix); }
function echt3dOn(room) { return echt3dWanted(room) && !!ECHT3D.mod && ECHT3D.mod.ready && !ECHT3D.mod.failed(room.id) && ECHT3D.mod.hasRoom(room.id); }
function echt3dLoad() {
  if (ECHT3D.mod || ECHT3D.loading || ECHT3D.failed) return;
  ECHT3D.loading = true;
  note('Echtzeit-3D wird geladen …');
  import(`./echt3d-szene.js?v=${typeof TT_VER !== 'undefined' ? TT_VER : 0}`)
    .then(m => m.init().then(() => { ECHT3D.mod = m; note('Echtzeit-3D (Beta) ist bereit.'); }))
    .catch(e => { ECHT3D.failed = true; console.error('Echtzeit-3D', e); note('Echtzeit-3D konnte nicht geladen werden – es bleibt beim vorgerenderten Bild.'); })
    .finally(() => { ECHT3D.loading = false; });
}
// Figuren, die trotz 3D-Modell als Bild bleiben: Laverne im Tentakel-Kostüm
function echt3dBild(a) { return a.id === 'laverne' && typeof kostuemAn === 'function' && kostuemAn(a); }
// bewegte Teile der Räume – dieselben Bewegungen wie bei den vorgerenderten Bildern (js/altbau.js, js/kostuem.js)
const ECHT3D_TEILE = {
  pendel: t => ({ rot: Math.sin(t * 0.0032) * 0.16 }),
  leuchter: t => ({ rot: Math.sin(t * 0.0015) * 0.04 }),
  hebel: () => { const lt = G.leverT ? G.t - G.leverT : 1e9; return { rot: 2.01 * (lt < 120 ? lt / 120 : lt < 900 ? 1 : lt < 1150 ? 1 - (lt - 900) / 250 : 0) }; },
  baum: () => {
    if (!flagOn('tree')) return { vis: false };
    let k = 1;
    if (G.treeGrowT) { const x = Math.max(0, Math.min(1, (G.t - G.treeGrowT) / 1800)); k = x < 1 ? (1 - Math.pow(1 - x, 3)) * (1 + Math.sin(x * Math.PI) * 0.08) : 1; }
    return { vis: k > 0.001, sx: Math.max(0.001, k), sy: Math.max(0.001, k) };
  },
  uhrtuer: () => ({ offen: flagOn('uhrGang') ? 1 : 0, seit: Date.now() - ((G.state && G.state.flags.uhrGangT) || 0) }),   // Lobby: Standuhr als Geheimtür (js/uhrwerk.js)
  uhrKristall: () => ({ vis: !(G.state && G.state.crystals.uhrwerk) }),
  // Requisiten im Labor (js/echt3d-szene.js, REQUISITEN): sichtbar wie die gezeichneten Fassungen, mit denselben Effekten
  req_hamster: () => ({ vis: echt3dEiDa('hamster'), schnell: !!(G.eggFx && G.eggFx.hamster && G.t - G.eggFx.hamster < 4000) }),
  req_mumie: () => ({ vis: echt3dEiDa('mumie') }),
  req_saber: () => ({ vis: echt3dEiDa('saber') && !(G.saber && G.t - G.saber.t0 < G.saber.dur) }),
  req_clawd: () => ({ vis: echt3dEiDa('clawd'), hops: !!(G.eggFx && G.eggFx.clawd && G.t - G.eggFx.clawd < 2500) }),
  req_absperrband: () => ({ vis: !!G.state && !flagOn('tatortFrei') && !flagOn('toast') }),
  clown: t => {
    if (flagOn('clownPlatt')) return { vis: false };
    let rot = Math.sin(t * 0.0013) * 0.025, sx = 1, sy = 1;
    if (G.clownStoss) { const q = (G.t - G.clownStoss) / 1100; if (q < 1) { rot += Math.sin(q * Math.PI * 4) * 0.17 * (1 - q); sy = 1 - Math.sin(q * Math.PI * 4) * 0.04 * (1 - q); } }
    if (G.clownPlatt) {
      const k = Math.min(1, (G.t - G.clownPlatt) / 1800);
      if (k >= 1) return { vis: false };
      sy = 1 - 0.88 * Math.pow(k, 0.75); sx = 1 + 0.4 * k + Math.sin(k * 42) * 0.08 * (1 - k); rot += Math.sin(k * 33) * 0.22 * (1 - k);
    }
    return { rot, sx, sy };
  },
};
// Raumwechsel im Echtzeit-3D: erst einblenden, wenn die 3D-Szene geladen ist (höchstens 6 s) – kein dunkles Bild mit Figuren
function echt3dWarten(id) {
  if (!G.settings.echt3d || G.settings.retro || !ECHT3D.rooms[id] || ECHT3D.failed) return Promise.resolve();
  echt3dLoad();
  const t0 = performance.now();
  return new Promise(fertig => {
    const pruefen = () => {
      const m = ECHT3D.mod;
      if (ECHT3D.failed || performance.now() - t0 > 6000 || (m && m.ready && (m.hasRoom(id) || m.failed(id)))) return fertig();
      setTimeout(pruefen, 60);
    };
    pruefen();
  });
}
{
  const warmOhne3D = warmRoom;
  warmRoom = async function (roomId) { await warmOhne3D(roomId); await echt3dWarten(roomId); };
}
function echt3dEiDa(id) { const e = typeof EGGS !== 'undefined' && EGGS[id]; return !!e && (!e.when || e.when()); }
// Gezeichnete Überlagerungen, die im Echtzeit-3D ein echtes Modell haben, dort nicht mehr malen (Klickflächen bleiben)
function echt3dHatModell(raum, key) { return !!(ECHT3D.mod && ECHT3D.mod.hatRequisit && echt3dOn(ROOMS[raum]) && ECHT3D.mod.hatRequisit(raum, key)); }
if (typeof EGG_DRAW !== 'undefined') {
  for (const id of ['hamster', 'mumie', 'saber', 'clawd']) {
    const kind = EGGS[id] && EGGS[id].kind, malen = kind && EGG_DRAW[kind];
    if (malen) EGG_DRAW[kind] = (c, e, t) => echt3dHatModell(e.room, e.id) ? undefined : malen(c, e, t);
  }
}
{
  const band = ROOMS.labor && ROOMS.labor.objs.find(o => o.id === 'absperrband');
  if (band && band.draw) { const malen = band.draw; band.draw = (c, t) => echt3dHatModell('labor', 'absperrband') ? undefined : malen(c, t); }
}
// Krumme Räume: Mauszeiger und Klicks treffen das, was man sieht – der Bildpunkt wird über die verbogene 3D-Geometrie
// auf die ursprüngliche Lage zurückgerechnet. Figuren, Tiere und gezeichnete Überlagerungen sind nicht verbogen.
{
  const hitOhneKrumm = hitScene;
  let merk = null;
  hitScene = function (x, y) {
    const direkt = hitOhneKrumm(x, y);
    if (y >= SH || !G.state || !ECHT3D.mod || !ECHT3D.mod.entkruemmt || ECHT3D.mod.freiAktiv()) return direkt;
    const raum = viewRoomId();
    if (!echt3dOn(ROOMS[raum])) return direkt;
    const modell = k => !!(ECHT3D.mod.hatRequisit && ECHT3D.mod.hatRequisit(raum, k));
    if (direkt && (direkt[0] === 'a' || direkt[0] === 'c')) return direkt;
    if (direkt && direkt[0] === 'e' && !modell(direkt.slice(2))) return direkt;
    if (direkt && direkt[0] === 'o' && OBJ[direkt.slice(2)] && OBJ[direkt.slice(2)].draw && !modell(direkt.slice(2))) return direkt;
    if (merk && merk.x === x && merk.y === y && merk.raum === raum && G.t - merk.t < 200) return merk.r;
    const u = ECHT3D.mod.entkruemmt(x, y, raum);
    const r = u ? hitOhneKrumm(u.x, u.y) || direkt : direkt;
    merk = { x, y, raum, t: G.t, r };
    return r;
  };
}
// Freie Kamera: gemalte Figuren, Tiere und Dinge ohne 3D-Modell werden zu Bildkarten im Raum (js/echt3d-szene.js,
// kartenStellen); Bildschirm-Effekte, die der Kamera nicht folgen können, blendet js/engine.js dann aus (echt3dFrei)
function echt3dFrei() { return !!(echt3dAktiv() && ECHT3D.mod.freiAktiv()); }
const KARTE_K = 1.6, kartenLeinwand = new Map();
let echt3dMaltKarte = false;
function echt3dKarte(key, x, y, malen) {
  let cv = kartenLeinwand.get(key);
  if (!cv) { cv = document.createElement('canvas'); cv.width = 480; cv.height = 720; kartenLeinwand.set(key, cv); }
  const g = cv.getContext('2d'), fussX = cv.width / 2, fussY = cv.height - 24;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
  g.setTransform(KARTE_K, 0, 0, KARTE_K, fussX - x * KARTE_K, fussY - y * KARTE_K);
  const haupt = cx; cx = g; echt3dMaltKarte = true;   // die Zeichenfunktionen malen über das globale cx
  try { malen(); } catch (e) { /* eine kaputte Karte soll das Bild nicht anhalten */ } finally { cx = haupt; echt3dMaltKarte = false; }
  return { key, canvas: cv, x, y, k: KARTE_K, fussY };
}
function echt3dKarten(room) {
  if (!echt3dFrei()) return [];
  const out = [];
  for (const a of Object.values(ACT)) if (a.room === room.id && a.visible && !(ECHT3D.mod.owns(a, room.id) && !echt3dBild(a))) out.push(echt3dKarte('a:' + a.id, a.x, a.y, () => drawActorOhne3D(a, room)));
  for (const e of eggList(room.id, true)) if (!(ECHT3D.mod.hatRequisit && ECHT3D.mod.hatRequisit(room.id, e.id))) out.push(echt3dKarte('e:' + e.id, e.x, e.y, () => drawEggOhneKarte(e)));
  for (const c of critterList(room.id)) out.push(echt3dKarte('c:' + c.id, c.x, c.y, () => drawCritterOhneKarte(c, room)));
  return out;
}
const drawEggOhneKarte = drawEgg, drawCritterOhneKarte = drawCritter;
drawEgg = e => { if (!echt3dFrei()) drawEggOhneKarte(e); };
drawCritter = (c, room) => { if (!echt3dFrei()) drawCritterOhneKarte(c, room); };
// Raumbild: im 3D-Raum das Echtzeit-Bild, sonst wie bisher
const drawBgOhne3D = drawBg;
drawBg = function (room) {
  if (echt3dWanted(room)) {
    echt3dLoad();
    if (echt3dOn(room)) {
      const acts = Object.values(ACT).filter(a => a.room === room.id && a.visible && !echt3dBild(a));
      const bild = ECHT3D.mod.frame(G.t, acts, Math.min(1920, W * VS * DPR * SSK), { id: room.id, zustand: room.zustand3d || {}, sprites: ECHT3D_TEILE, karten: echt3dKarten(room) });
      if (bild) {
        // Die Dialog-Kamera zoomt die Szene jetzt echt in 3D (Dolly mit Parallax) – deshalb hier die flache
        // 2D-Skalierung des Bildes zurücknehmen; Figuren-Bilder und Effekte oben drüber zoomen weiter wie gehabt
        const cz = G.cam && G.cam.z > 1.001 ? G.cam.z : 1;
        if (cz > 1) { cx.save(); cx.translate(G.cam.x, G.cam.y); cx.scale(1 / cz, 1 / cz); cx.translate(-G.cam.x, -G.cam.y); cx.drawImage(bild, 0, 0, W, SH); cx.restore(); }
        else cx.drawImage(bild, 0, 0, W, SH);
        return;
      }
    }
  }
  return drawBgOhne3D(room);
};
// Figuren, die die 3D-Szene selbst zeigt, nicht noch einmal als Bild zeichnen – nur die Comic-Zeichen der Mimik darüber
const drawActorOhne3D = drawActor;
drawActor = function (a, room) {
  if (echt3dMaltKarte) return drawActorOhne3D(a, room);   // Bildkarte wird gerade gemalt
  if (echt3dFrei() && !(ECHT3D.mod.owns(a, room.id) && !echt3dBild(a))) return;   // steht als Bildkarte im Raum
  if (echt3dOn(room) && !echt3dBild(a) && ECHT3D.mod.owns(a, room.id)) {
    const sc = roomScale(room, a.y), frei = ECHT3D.mod.freiAktiv();
    const hoch = (a._z3d || 0) * 104 * sc;   // Höhe über dem Boden (Sprung, Plattform) in Spiel-Einheiten
    if (typeof mimikDeko === 'function' && !frei) {   // Comic-Zeichen nur in der Spielkamera – beim freien Drehen säßen sie daneben
      const f = mimikForm(a, G.t);
      if (f.m) { cx.save(); cx.translate(a.x, a.y - hoch); cx.scale(sc * (a.dir < 0 ? -1 : 1), sc); mimikDeko(cx, a, G.t, f); cx.restore(); }
    }
    const zq = a._zischT3d ? (performance.now() - a._zischT3d) / 380 : 1;
    if (zq < 1 && !frei) {   // Losflitzen: Speed-Linien hinter der Figur
      cx.save(); cx.globalAlpha = Math.sin(zq * Math.PI) * 0.85; cx.strokeStyle = '#ffffff'; cx.lineWidth = 2.4; cx.lineCap = 'round';
      const hinten = a.dir < 0 ? 1 : -1;
      for (let i = 0; i < 4; i++) { const y = a.y - hoch - (30 + i * 26) * sc, x = a.x + hinten * (26 + (i % 2) * 10) * sc; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + hinten * (40 + zq * 30) * sc, y); cx.stroke(); }
      cx.restore();
    }
    return;
  }
  return drawActorOhne3D(a, room);
};
function toggleEcht3d() {
  G.settings.echt3d = !G.settings.echt3d; saveSettings(); Sound.sfx('warp');
  if (G.settings.echt3d && G.settings.retro) note('Echtzeit-3D läuft nur im Remastered-Grafikmodus.');
  else note(G.settings.echt3d ? 'Echtzeit-3D an – links/rechts ziehen, rechter Stick oder Wischen dreht; Mausrad/Pinch zoomt, C/RS setzt zurück.' : 'Echtzeit-3D aus – vorgerenderte Grafik.');
}

// ---------- Freie 3D-Kamera: 360° drehen, neigen und zoomen ----------
const echt3dAktiv = () => G.screen === 'game' && !!G.state && G.settings.echt3d && ECHT3D.rooms[viewRoomId()] && ECHT3D.mod && ECHT3D.mod.ready && !ECHT3D.mod.failed(viewRoomId()) && ECHT3D.mod.hasRoom(viewRoomId()) && !cx.isPix;
function echt3dSteuerungErlaubt() { return G.screen === 'game' && !G.menu && !G.busy && !G.dialog && !G.inIntro; }
function echt3dKameraSteuerungErlaubt() { return G.screen === 'game' && !G.menu && !G.inIntro; }
let echt3dHinweisKamera = false;
function echt3dZeigeKamerahinweis() {
  if (echt3dHinweisKamera) return;
  echt3dHinweisKamera = true;
  note('3D-Kamera: Links- oder Rechtsziehen, rechter Stick oder Wischen dreht; Mausrad oder Pinch zoomt; C, RS-Klick oder zwei Finger setzen zurück.');
}
function echt3dPadDreh(rx, ry, dt) {
  if (!echt3dAktiv() || !echt3dKameraSteuerungErlaubt()) return false;
  if (rx || ry) {
    ECHT3D.mod.freiDreh(-rx * dt / 1000 * 1.8, -ry * dt / 1000 * 1.6);
    G.pointer = 'pad';
    echt3dZeigeKamerahinweis();
  }
  return true;
}
function echt3dPadZurueck() {
  if (!echt3dAktiv() || !echt3dKameraSteuerungErlaubt() || !ECHT3D.mod.freiAktiv()) return false;
  ECHT3D.mod.freiZurueck();
  return true;
}
// Direktsteuerung wie in Psychonauts 2: in JEDEM Echtzeit-3D-Raum laufen (WASD/Pfeile, linker Stick, Touch-Stick) und
// springen (Leertaste, A, Touch-Knopf); E bzw. A über einem Hotspot benutzt das Nächste. Klicken bleibt wie gehabt.
// Die Räume mit echten Sprungpassagen bekommen beim Betreten einen eigenen Hinweis.
const ECHT3D_PARKOUR = new Set(['dachboden', 'stockwerk', 'uhrwerk']);
function echt3dParkourAktiv() { return echt3dAktiv() && echt3dSteuerungErlaubt(); }
// nächster Hotspot in Reichweite der Figur (Spiel-Einheiten am Boden), für E / A
function echt3dNaechsterHotspot() {
  const p = me(), room = ROOMS[viewRoomId()]; if (!p || !room) return null;
  let best = null, bd = 150;
  for (const o of room.objs) {
    if (!isVisible(o)) continue;
    const w = typeof o.walk === 'function' ? o.walk() : o.walk || [o.rect[0] + o.rect[2] / 2, o.rect[1] + o.rect[3] + 10];
    const d = Math.hypot(w[0] - p.x, (w[1] - p.y) * 1.6);
    if (d < bd) { bd = d; best = o; }
  }
  for (const a of Object.values(ACT)) if (a.room === room.id && a.visible && a.id !== curId() && a.talk) {
    const d = Math.hypot(a.x - p.x, (a.y - p.y) * 1.6) - 30;
    if (d < bd) { bd = d; best = { npc: a }; }
  }
  return best;
}
function echt3dBenutzen() {
  const h = echt3dNaechsterHotspot();
  if (!h) { note('Hier ist nichts in Reichweite. Lauf näher an etwas heran.'); return; }
  if (h.npc) return runSentence('talk', 'a:' + h.npc.id);
  const k = 'o:' + h.id;
  return runSentence(defaultVerb(k) || 'look', k);
}
function echt3dSetzBewegungsziel(a, dx, dy, sek) {
  if (!a || a.room !== viewRoomId() || !ECHT3D.mod || !ECHT3D.mod.bewegungsZiel) return false;
  const kraft = Math.hypot(dx, dy); if (kraft < 0.025) return false;
  const ziel = ECHT3D.mod.bewegungsZiel(a, dx, dy, sek, a.room);
  if (!ziel) return false;
  const [x, y] = clampWalk(ROOMS[a.room], ziel[0], ziel[1]);
  if (a._res) { const done = a._res; a._res = null; done(false); }
  a.target = [x, y]; a.walking = true; a.run = true;
  return true;
}
function echt3dPadBewegen(x, y, dt) {
  if (!echt3dParkourAktiv()) return false;
  if (x || y) echt3dSetzBewegungsziel(me(), x, y, dt / 1000);
  return true;
}
function echt3dPadSpringen() {
  if (!echt3dParkourAktiv()) return false;
  if (G.pointer === 'pad' && G.mouse.x >= 0 && hitScene(G.mouse.x, G.mouse.y)) return false;   // Cursor auf einem Hotspot: A klickt
  ECHT3D.mod.huepfen(me());
  return true;
}
let echt3dVirtualStick = { x: 0, y: 0, aktiv: false };
function drawEcht3dParkour() {
  if (!echt3dParkourAktiv() || (!COARSE && G.pointer !== 'touch') || cx.isPix || G.photoMode) return;
  const y = SH - 66, x = 92, jx = W - 92, r = 45;
  cx.save(); cx.globalAlpha = 0.62;
  cx.fillStyle = '#120a1c'; cx.strokeStyle = '#f1d6a0'; cx.lineWidth = 3;
  cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill(); cx.stroke();
  cx.globalAlpha = 0.88; cx.fillStyle = '#e8bd74';
  cx.beginPath(); cx.arc(x + echt3dVirtualStick.x * 23, y + echt3dVirtualStick.y * 23, 19, 0, Math.PI * 2); cx.fill();
  cx.globalAlpha = 0.66; cx.fillStyle = '#120a1c'; cx.strokeStyle = '#fff0b5';
  cx.beginPath(); cx.arc(jx, y, r, 0, Math.PI * 2); cx.fill(); cx.stroke();
  cx.globalAlpha = 1; cx.fillStyle = '#fff0b5'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.font = '800 13px "Baloo 2", sans-serif'; cx.fillText('LAUFEN', x, y + 66); cx.font = '400 25px "Titan One", sans-serif'; cx.fillText('A', jx, y - 3); cx.font = '800 13px "Baloo 2", sans-serif'; cx.fillText('SPRINGEN', jx, y + 66);
  cx.restore();
}
{
  const cv = document.getElementById('game');
  let dreh = null, geste = null;
  const finger = new Map(), parkourFinger = new Map();
  const aktiv = echt3dAktiv;

  const raumKlickAt = (p, right = true) => {
    if (p.y > SH || G.menu || G.busy || G.dialog || G.screen !== 'game') return false;
    G.mouse.x = p.x; G.mouse.y = p.y;
    const ziel = ECHT3D.mod.pick(p.x, p.y, viewRoomId());
    ECHT3D.mod.freiZurueck();
    if (ziel) setTimeout(() => { if (G.screen === 'game' && !G.busy) sceneClick(Math.round(ziel.x), Math.round(ziel.y), right); }, 720);
    return true;
  };
  const abbruchTouch = () => {
    if (geste && geste.timer) clearTimeout(geste.timer);
    geste = null; finger.clear();
    if (touch) { clearTimeout(touch.timer); touch = null; }
  };
  const stopEvent = e => { e.stopImmediatePropagation(); e.preventDefault(); };
  const abstand = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const mitte = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const zweiFinger = () => geste && geste.ids.slice(0, 2).map(id => finger.get(id)).filter(Boolean);
  const parkourKnopf = p => {
    if (!COARSE && G.pointer !== 'touch') return null;
    const y = SH - 66, r = 54;
    if (Math.hypot(p.x - 92, p.y - y) <= r) return 'laufen';
    if (Math.hypot(p.x - (W - 92), p.y - y) <= r) return 'springen';
    return null;
  };
  const parkourStickSetzen = (f, p) => {
    let x = (p.x - f.sx) / 42, y = (p.y - f.sy) / 42, m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    echt3dVirtualStick = { x, y, aktiv: true }; f.x = x; f.y = y;
  };
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    if (!aktiv()) return;
    if (e.pointerType === 'mouse' && (e.button === 0 || e.button === 2)) {
      const p = toLogical(e);
      if (!echt3dKameraSteuerungErlaubt() || p.y > SH) return;
      G.pointer = 'mouse'; G.mouse.x = p.x; G.mouse.y = p.y; firstInteraction();
      dreh = { id: e.pointerId, button: e.button, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, moved: false };
      try { cv.setPointerCapture(e.pointerId); } catch {}
      stopEvent(e); return;
    }
    if (e.pointerType === 'touch') {
      let p = toLogical(e);
      if (p.y > SH || !echt3dKameraSteuerungErlaubt()) return;
      stopEvent(e);
      if (G.pointer !== 'touch') { G.pointer = 'touch'; resize(); p = toLogical(e); }
      G.mouse.x = p.x; G.mouse.y = p.y;
      firstInteraction();
      if (touch) { clearTimeout(touch.timer); touch = null; }
      try { cv.setPointerCapture(e.pointerId); } catch {}
      const knopf = parkourKnopf(p);
      if (knopf) {
        const f = { kind: knopf, sx: p.x, sy: p.y, x: 0, y: 0 };
        parkourFinger.set(e.pointerId, f);
        if (knopf === 'springen') echt3dPadSpringen();
        else parkourStickSetzen(f, p);
        return;
      }
      finger.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, p });
      if (!geste) {
        const g = geste = { mode: 'single', id: e.pointerId, ids: [e.pointerId], free: ECHT3D.mod.freiAktiv(), moved: false, long: false, p, timer: null };
        g.timer = setTimeout(() => {
          if (geste !== g || g.mode !== 'single' || g.moved || !finger.has(g.id)) return;
          g.long = true;
          if (g.free) { if (!raumKlickAt(g.p, true)) onClick(g.p.x, g.p.y, true); }
          else onClick(g.p.x, g.p.y, true);
        }, 480);
      } else if (geste.mode === 'single') {
        if (geste.timer) clearTimeout(geste.timer);
        geste.timer = null; geste.mode = 'multi'; geste.ids.push(e.pointerId);
        geste.started = performance.now(); geste.multiMoved = geste.moved;
        const pts = zweiFinger();
        if (pts.length === 2) { geste.lastDist = abstand(pts[0], pts[1]); geste.startDist = geste.lastDist; geste.lastCenter = mitte(pts[0], pts[1]); geste.startCenter = { ...geste.lastCenter }; }
      }
      return;
    }
  }, true);
  cv.addEventListener('pointermove', e => {
    if (dreh && dreh.id === e.pointerId) {
      if (!aktiv() || !echt3dKameraSteuerungErlaubt()) { dreh = null; return; }
      const r = cv.getBoundingClientRect();
      const totalX = e.clientX - dreh.sx, totalY = e.clientY - dreh.sy;
      const distance = Math.hypot(totalX * W / r.width, totalY * H / r.height);
      if (!dreh.moved && distance <= 5) return;
      stopEvent(e);
      const dx = dreh.moved ? e.clientX - dreh.x : totalX;
      const dy = dreh.moved ? e.clientY - dreh.y : totalY;
      ECHT3D.mod.freiDreh(-dx * 0.0045, -dy * 0.0035);
      dreh.moved = true; dreh.x = e.clientX; dreh.y = e.clientY;
      echt3dZeigeKamerahinweis();
      return;
    }
    const pf = parkourFinger.get(e.pointerId);
    if (pf) {
      stopEvent(e);
      if (pf.kind === 'laufen' && echt3dParkourAktiv()) parkourStickSetzen(pf, toLogical(e));
      return;
    }
    if (!geste || !finger.has(e.pointerId)) return;
    if (!aktiv() || !echt3dKameraSteuerungErlaubt()) { stopEvent(e); abbruchTouch(); return; }
    stopEvent(e);
    const point = finger.get(e.pointerId);
    point.x = e.clientX; point.y = e.clientY; point.p = toLogical(e);
    G.mouse.x = point.p.x; G.mouse.y = point.p.y;
    if (geste.mode === 'single') {
      const r = cv.getBoundingClientRect();
      const moved = Math.hypot((point.x - point.sx) * W / r.width, (point.y - point.sy) * H / r.height);
      if (!geste.moved && moved <= 14) return;
      if (geste.timer) { clearTimeout(geste.timer); geste.timer = null; }
      const last = geste.last || { x: point.sx, y: point.sy };
      ECHT3D.mod.freiDreh(-(point.x - last.x) * 0.0045, -(point.y - last.y) * 0.0035);
      geste.moved = true; geste.last = { x: point.x, y: point.y }; geste.p = point.p;
      echt3dZeigeKamerahinweis();
      return;
    }
    const pts = zweiFinger();
    if (pts.length !== 2 || !geste.lastCenter) return;
    const dist = abstand(pts[0], pts[1]), center = mitte(pts[0], pts[1]);
    if (Math.abs(dist - geste.startDist) > 9 || Math.hypot(center.x - geste.startCenter.x, center.y - geste.startCenter.y) > 9) geste.multiMoved = true;
    ECHT3D.mod.freiZoom((geste.lastDist - dist) * 0.007);
    ECHT3D.mod.freiDreh(-(center.x - geste.lastCenter.x) * 0.0025, -(center.y - geste.lastCenter.y) * 0.002);
    geste.lastDist = dist; geste.lastCenter = center;
    if (geste.multiMoved) echt3dZeigeKamerahinweis();
  }, true);
  cv.addEventListener('pointerup', e => {
    if (dreh && dreh.id === e.pointerId) {
      const drag = dreh; dreh = null; stopEvent(e);
      if (!drag.moved) {
        const p = toLogical(e); G.mouse.x = p.x; G.mouse.y = p.y;
        if (ECHT3D.mod.freiAktiv() && raumKlickAt(p, true)) return;
        onClick(p.x, p.y, drag.button === 2);
      }
      return;
    }
    if (parkourFinger.has(e.pointerId)) {
      stopEvent(e); parkourFinger.delete(e.pointerId);
      if (![...parkourFinger.values()].some(f => f.kind === 'laufen')) echt3dVirtualStick = { x: 0, y: 0, aktiv: false };
      return;
    }
    if (!finger.has(e.pointerId)) return;
    stopEvent(e);
    const g = geste;
    finger.delete(e.pointerId);
    if (g && g.mode === 'single' && g.id === e.pointerId) {
      if (g.timer) clearTimeout(g.timer);
      geste = null;
      const p = toLogical(e);
      G.mouse.x = p.x; G.mouse.y = p.y;
      if (!g.moved && g.free) { if (!raumKlickAt(p, true)) onClick(p.x, p.y, false); }
      else if (!g.moved && !g.long) onClick(p.x, p.y, false);
      return;
    }
    if (g && g.mode === 'multi' && finger.size === 0) {
      if (!g.multiMoved && performance.now() - g.started < 650 && ECHT3D.mod.freiAktiv()) ECHT3D.mod.freiZurueck();
      geste = null;
    }
  }, true);
  cv.addEventListener('pointercancel', e => {
    if (dreh && dreh.id === e.pointerId) dreh = null;
    if (parkourFinger.has(e.pointerId)) {
      stopEvent(e); parkourFinger.delete(e.pointerId);
      if (![...parkourFinger.values()].some(f => f.kind === 'laufen')) echt3dVirtualStick = { x: 0, y: 0, aktiv: false };
    }
    if (finger.has(e.pointerId)) { stopEvent(e); abbruchTouch(); }
  }, true);
  window.addEventListener('blur', () => { dreh = null; });
  cv.addEventListener('wheel', e => {
    if (!aktiv() || !echt3dKameraSteuerungErlaubt() || toLogical(e).y > SH) return;
    e.preventDefault();
    ECHT3D.mod.freiZoom(e.deltaY * 0.0035);
  }, { passive: false });
  window.addEventListener('keydown', e => {
    if (aktiv() && echt3dKameraSteuerungErlaubt() && (e.key === 'c' || e.key === 'C') && ECHT3D.mod.freiAktiv()) {
      e.stopImmediatePropagation(); e.preventDefault(); ECHT3D.mod.freiZurueck();
    }
  }, true);
}

// ---------- Direktsteuerung und Jump'n'Run-Abschnitte (Toaststufen, Kistenparcours, Uhrwerk) ----------
{
  const tasten = new Set();
  const aktiv = echt3dAktiv;
  let letzterRaum = null, standSeit = 0, hinweisDirekt = false;
  window.addEventListener('keydown', e => {
    if (!aktiv() || !echt3dSteuerungErlaubt()) return;
    const k = e.key.toLowerCase();
    if (k === ' ') {
      if (G.screen === 'game' && !G.busy && !G.dialog) { e.stopImmediatePropagation(); e.preventDefault(); ECHT3D.mod.huepfen(me()); }
      return;
    }
    if (k === 'e' && !e.repeat) {
      if (G.screen === 'game' && !G.busy && !G.dialog) { e.stopImmediatePropagation(); e.preventDefault(); echt3dBenutzen(); }
      return;
    }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { tasten.add(k); e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  window.addEventListener('keyup', e => tasten.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => { tasten.clear(); echt3dVirtualStick = { x: 0, y: 0, aktiv: false }; });
  const KURS = {
    stockwerk: 'Sprungpassage: über die Buttertoast-Stufen durch die Treppenlücke. Fehltritte setzen dich aufs letzte Brett zurück.',
    dachboden: 'Kistenparcours: lauf mit WASD, spring mit Leertaste und hol dir den Chrono-Kristall oben auf dem Stapel.',
    uhrwerk: 'Uhrwerk: Zahnrad – Kolben – Zahnrad. Spring im richtigen Takt und duck dich nicht vorm Pendel weg … sondern drum herum!',
  };
  setInterval(() => {
    if (G.screen !== 'game' || !G.state) { tasten.clear(); letzterRaum = null; echt3dVirtualStick = { x: 0, y: 0, aktiv: false }; return; }
    const raum = viewRoomId(), drei = aktiv();
    if (G.inIntro) return;   // im Vorspann keine Hinweise und keine Steuerung
    if (drei && raum !== letzterRaum) {
      if (KURS[raum]) note(KURS[raum]);
      else if (!hinweisDirekt) { hinweisDirekt = true; note('Echtzeit-3D: WASD oder linker Stick laufen, Leertaste/A springt, E benutzt das Nächste. Ziehen dreht die Kamera um dich.'); }
    }
    letzterRaum = drei ? raum : null;
    const p = me();
    if (p && p._gebonkt3d) {   // vom Riesenpendel erwischt: BONK, Schreck-Take, Rumble
      p._gebonkt3d = false;
      Sound.sfx('boulder'); Sound.sfx('rubber'); shake(320, 6); rumble(260, 0.7, 0.9);
      if (typeof mimikStart === 'function') mimikStart(p, 'schreck');
      note('BOOOING! Das Pendel hat dich erwischt.');
    }
    if (p && p._respawned3d) {
      p._respawned3d = false;
      if (G.pointer === 'touch' && navigator.vibrate) navigator.vibrate(35);
      if (typeof mimikStart === 'function') mimikStart(p, 'schwindel');
      Sound.sfx('chirp');
      note('Daneben! Du bist am letzten Sprungbrett wieder aufgetaucht – mit Sternchen um den Kopf.');
    }
    if (p && p._zischT3d && p._zischT3d !== p._zischGesehen) {   // Losflitzen: Staubwolke und Zisch (nur nach einer Pause, sonst nervt es)
      p._zischGesehen = p._zischT3d;
      if (performance.now() - standSeit > 700) { Sound.sfx('whoosh', panX(p.x)); puff(p.x - p.dir * 14, p.y - 4, '#e8dcc8', 6, { vy: 30, vx: -p.dir * 90, r: 3, max: 420, spread: 8 }); }
    }
    if (p && !p.walking) standSeit = standSeit || performance.now(); else standSeit = 0;
    if (!drei || !echt3dSteuerungErlaubt()) { tasten.clear(); echt3dVirtualStick = { x: 0, y: 0, aktiv: false }; }
    if (!drei || !p || p.room !== raum) return;
    const dx = (tasten.has('d') || tasten.has('arrowright') ? 1 : 0) - (tasten.has('a') || tasten.has('arrowleft') ? 1 : 0) + (echt3dVirtualStick.aktiv ? echt3dVirtualStick.x : 0);
    const dy = (tasten.has('s') || tasten.has('arrowdown') ? 1 : 0) - (tasten.has('w') || tasten.has('arrowup') ? 1 : 0) + (echt3dVirtualStick.aktiv ? echt3dVirtualStick.y : 0);
    if (dx || dy) echt3dSetzBewegungsziel(p, dx, dy, 0.09);
  }, 90);
}
