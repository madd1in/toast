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
  rooms: { prolog: 1, auffahrt: 1, hafen: 1, landeplatz: 1, keller: 1, lobby: 1, labor: 1, konferenz: 1, gasthaus: 1, garten1776: 1, fgarten: 1, vorraum: 1, thron: 1, testkammer: 1, mars: 1, stockwerk: 1, dachboden: 1, uhrwerk: 1 },
};
const ECHT3D_XBOX = /xbox/i.test(navigator.userAgent || '');   // Konsole: kleineres 3D-Bild, ohne Schatten (js/echt3d-szene.js)
// Bildrate halten: das 3D-Bild wird kleiner gerechnet, wenn die Bilder zu lange dauern, und wieder größer, wenn Luft ist
const ECHT3D_Q = { k: 1, ema: 16, letzt: 0 };
function echt3dBreite(voll) {
  const jetzt = performance.now(), d = ECHT3D_Q.letzt ? Math.min(120, jetzt - ECHT3D_Q.letzt) : 16; ECHT3D_Q.letzt = jetzt;
  ECHT3D_Q.ema += (d - ECHT3D_Q.ema) * 0.05;
  if (ECHT3D_Q.ema > 24) ECHT3D_Q.k = Math.max(0.62, ECHT3D_Q.k - 0.004); else if (ECHT3D_Q.ema < 17.5) ECHT3D_Q.k = Math.min(1, ECHT3D_Q.k + 0.0015);   // Ziel: flüssige 50–60 Bilder
  return Math.max(Math.min(800, Math.round(voll)), Math.round(voll * ECHT3D_Q.k / 160) * 160);   // nie unter 800 Bildpunkte Breite (sonst pixelig)   // in Stufen, damit der Renderer nicht dauernd neu anlegt
}
function echt3dWanted(room) { return !!(G.settings.echt3d && room && ECHT3D.rooms[room.id] && !cx.isPix); }
// Läuft dieser Raum im Echtzeit-3D? Nur der Raum, den man gerade sieht, wird dafür auch geladen – Abfragen für andere
// Räume (Rätsel, Requisiten, Uhrwerk) schauen nur nach; sonst lägen auf der Xbox drei, vier Räume zugleich im Grafikspeicher
function echt3dOn(room) {
  if (!echt3dWanted(room) || !ECHT3D.mod || !ECHT3D.mod.ready || (ECHT3D.mod.verloren && ECHT3D.mod.verloren()) || ECHT3D.mod.failed(room.id)) return false;
  return room.id === viewRoomId() ? ECHT3D.mod.hasRoom(room.id) : ECHT3D.mod.raumGeladen(room.id);
}
// Kann dieses Gerät WebGL 2? (three.js braucht es; manche Konsolen-Browser und alte Grafikchips nicht)
function echt3dWebgl2() {
  try { const c = document.createElement('canvas'), g = c.getContext('webgl2'); if (g) { const x = g.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); return true; } } catch (e) { /* kein WebGL */ }
  return false;
}
function echt3dLoad() {
  if (ECHT3D.mod || ECHT3D.loading || ECHT3D.failed) return;
  if (!echt3dWebgl2()) {
    ECHT3D.failed = true;
    note('Echtzeit-3D braucht WebGL 2 – dieser Browser bietet es nicht. Es bleibt beim vorgerenderten Bild.');
    return;
  }
  ECHT3D.loading = true;
  note('Echtzeit-3D wird geladen …');
  import(`./echt3d-szene.js?v=${typeof TT_VER !== 'undefined' ? TT_VER : 0}`)
    .then(m => m.init().then(() => { ECHT3D.mod = m; note('Echtzeit-3D (Beta) ist bereit.'); }))
    .catch(e => {
      ECHT3D.failed = true; console.error('Echtzeit-3D', e);
      const grund = String((e && e.message) || e || '').slice(0, 90);   // der eigentliche Grund hilft beim Nachbessern
      note(`Echtzeit-3D konnte nicht geladen werden (${grund || 'unbekannter Fehler'}) – es bleibt beim vorgerenderten Bild.`);
    })
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
  const t0 = performance.now(); let gemeldet = false;
  return new Promise(fertig => {
    const pruefen = () => {
      if (!gemeldet && performance.now() - t0 > 1200) { gemeldet = true; note('Echtzeit-3D: Raum wird geladen …'); }
      const m = ECHT3D.mod;
      if (ECHT3D.failed || performance.now() - t0 > (ECHT3D_XBOX ? 16000 : 8000) || (m && m.ready && (m.hasRoom(id) || m.failed(id)))) return fertig();   // Konsole lädt langsamer: länger aufs 3D warten statt aufs gemalte Bild zu springen
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
let echt3dUmgerechnet = false;
// Krumme Räume: Mauszeiger und Klicks treffen das, was man sieht – der Bildpunkt wird über die verbogene 3D-Geometrie
// auf die ursprüngliche Lage zurückgerechnet. Figuren, Tiere und gezeichnete Überlagerungen sind nicht verbogen.
{
  const hitOhneKrumm = hitScene;
  let merk = null;
  hitScene = function (x, y) {
    if (echt3dUmgerechnet) return hitOhneKrumm(x, y);   // Koordinaten kommen schon aus dem 3D-Picking
    if (y < SH && G.state && ECHT3D.mod && ECHT3D.mod.freiAktiv() && echt3dOn(ROOMS[viewRoomId()])) {   // gedrehte Kamera: Bildpunkt -> Raumpunkt
      if (merk && merk.x === x && merk.y === y && merk.frei && G.t - merk.t < 120) return merk.r;
      const z = ECHT3D.mod.pick(x, y, viewRoomId()), r = z ? hitOhneKrumm(Math.round(z.x), Math.round(z.y)) : null;
      merk = { x, y, frei: true, t: G.t, r };
      return r;
    }
    const direkt = hitOhneKrumm(x, y);
    if (y >= SH || !G.state || !ECHT3D.mod || !ECHT3D.mod.entkruemmt) return direkt;
    const raum = viewRoomId();
    if (!echt3dOn(ROOMS[raum])) return direkt;
    const modell = k => !!(ECHT3D.mod.hatRequisit && ECHT3D.mod.hatRequisit(raum, k));
    if (direkt && (direkt[0] === 'a' || direkt[0] === 'c')) return direkt;
    if (direkt && direkt[0] === 'e' && !modell(direkt.slice(2))) return direkt;
    if (direkt && direkt[0] === 'o' && OBJ[direkt.slice(2)] && OBJ[direkt.slice(2)].draw && !modell(direkt.slice(2))) return direkt;
    if (merk && !merk.frei && merk.x === x && merk.y === y && merk.raum === raum && G.t - merk.t < 200) return merk.r;
    const u = ECHT3D.mod.entkruemmt(x, y, raum);
    const r = u ? hitOhneKrumm(u.x, u.y) || direkt : direkt;
    merk = { x, y, raum, t: G.t, r };
    return r;
  };
}
// Freie Kamera: gemalte Figuren, Tiere und Dinge ohne 3D-Modell werden zu Bildkarten im Raum (js/echt3d-szene.js,
// kartenStellen); Bildschirm-Effekte, die der Kamera nicht folgen können, blendet js/engine.js dann aus (echt3dFrei)
function echt3dFrei() { return !!(echt3dAktiv() && ECHT3D.mod.freiAktiv()); }
function echt3dBildVonSpiel(x, y) { return echt3dFrei() && ECHT3D.mod.bildVonSpiel ? ECHT3D.mod.bildVonSpiel(x, y) : null; }
function echt3dKopf(a, room, hoehePx) { return echt3dFrei() && a.room === room.id && ECHT3D.mod.kopfPunkt ? ECHT3D.mod.kopfPunkt(a.x, a.y, hoehePx, room.id) : null; }
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
// Geschlossene Räume: im Echtzeit-3D darf man über den ganzen Boden laufen (js/echt3d-szene.js, laufflaeche3d)
{
  const clampOhne3D = clampWalk;
  clampWalk = function (room, x, y) {
    const poly = room && ECHT3D.mod && ECHT3D.mod.laufflaeche3d && echt3dOn(room) ? ECHT3D.mod.laufflaeche3d(room.id) : null;
    return clampOhne3D(poly ? { walk: poly } : room, x, y);
  };
}
// Nässe für die Pfützen: steigt beim Regen an, trocknet danach in etwa einer Dreiviertelminute ab
function echt3dNass(room) {
  if (typeof rainFx === 'undefined' || !(ROOM_FX[room.id] || {}).rain || !rainFx.t0 || rainFx.era !== room.era) return 0;
  return rainFx.on ? Math.min(1, (G.t - rainFx.t0) / 9000) : Math.max(0, 1 - (G.t - rainFx.t0) / 45000);
}
// Raumbild: im 3D-Raum das Echtzeit-Bild, sonst wie bisher
const drawBgOhne3D = drawBg;
drawBg = function (room) {
  if (echt3dWanted(room)) {
    echt3dLoad();
    if (echt3dOn(room)) {
      const acts = Object.values(ACT).filter(a => a.room === room.id && a.visible && !echt3dBild(a));
      const bild = ECHT3D.mod.frame(G.t, acts, echt3dBreite(Math.min(ECHT3D_XBOX ? 1280 : 1920, W * VS * DPR * SSK)), { id: room.id, zustand: room.zustand3d || {}, sprites: ECHT3D_TEILE, karten: echt3dKarten(room), regen: typeof rainActive === 'function' && rainActive(), nass: echt3dNass(room) });
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
    ECHT3D.mod.freiDreh(-rx * dt / 1000 * 1.8, ry * dt / 1000 * 1.6);   // Stick hoch = Blick hoch
    G.pointer = 'pad';
    echt3dZeigeKamerahinweis();
  }
  return true;
}
function echt3dPadZurueck() {
  if (!echt3dAktiv() || !echt3dKameraSteuerungErlaubt()) return false;
  echt3dKameraWechsel();
  return true;
}
function echt3dKameraWechsel() {   // Auto-Kamera hinter der Figur <-> klassische Bühnenansicht
  if (ECHT3D.mod.autoKameraUmschalten) { const an = ECHT3D.mod.autoKameraUmschalten(); note(an ? 'Kamera: hinter der Figur (C wechselt zur Bühnenansicht)' : 'Kamera: klassische Bühnenansicht (C wechselt zurück)'); }
  else if (ECHT3D.mod.freiAktiv()) ECHT3D.mod.freiZurueck();
}
// Direktsteuerung wie in Psychonauts 2: in JEDEM Echtzeit-3D-Raum laufen (WASD/Pfeile, linker Stick, Touch-Stick) und
// springen (Leertaste, A, Touch-Knopf); E bzw. A über einem Hotspot benutzt das Nächste. Klicken bleibt wie gehabt.
// Die Räume mit echten Sprungpassagen bekommen beim Betreten einen eigenen Hinweis.
const ECHT3D_PARKOUR = new Set(['dachboden', 'stockwerk', 'uhrwerk']);
function echt3dParkourAktiv() { return echt3dAktiv() && echt3dSteuerungErlaubt(); }
// nächster Hotspot in Reichweite der Figur (Spiel-Einheiten am Boden), für E / A
function echt3dNaechsterHotspot() {
  const p = me(), room = ROOMS[viewRoomId()]; if (!p || !room) return null;
  let best = null, bd = 120;
  for (const o of room.objs) {
    if (!isVisible(o)) continue;
    const w = typeof o.walk === 'function' ? o.walk() : o.walk || [o.rect[0] + o.rect[2] / 2, o.rect[1] + o.rect[3] + 10];
    const d = Math.hypot(w[0] - p.x, (w[1] - p.y) * 1.6) * (o.exit ? 0.6 : 1);   // Ausgänge findet X schon von weiter weg
    if (d < bd) { bd = d; best = o; }
  }
  for (const a of Object.values(ACT)) if (a.room === room.id && a.visible && a.id !== curId() && a.talk) {
    const d = Math.hypot(a.x - p.x, (a.y - p.y) * 1.6) - 30;
    if (d < bd) { bd = d; best = { npc: a }; }
  }
  return best;
}
// Ausgänge im Echtzeit-3D: wer mit Stick/Tasten hineinläuft, geht hindurch (Türen, Treppen, Leitern, Wege).
// Nach dem Betreten eines Raums erst ein Stück weg vom Ankunftsort, damit man nicht gleich wieder hinausfällt.
let echt3dGehtDurch = false;
// Tür- und Laufpunkt eines Ausgangs im 3D-Raum (Meter), robust: trifft der Strahl nichts (Ausgang am Bildrand, offener
// Himmel), liegt die Tür ein Stück hinter dem Laufpunkt nach außen; steht der Laufpunkt in einem Möbel, gilt die nächste
// freie Stelle davor
const echt3dAusgangCache = new Map();
function echt3dAusgangOrt(room, o) {
  const m = ECHT3D.mod, key = room.id + ':' + o.id;
  if (echt3dAusgangCache.has(key) && m.raumGeladen(room.id)) return echt3dAusgangCache.get(key);
  const wp = (typeof o.walk === 'function' ? o.walk() : o.walk) || [o.rect[0] + o.rect[2] / 2, o.rect[1] + o.rect[3] + 10];
  const [gx, gy] = clampWalk(room, wp[0], wp[1]);
  let w = m.spielerLage({ x: gx, y: gy, room: room.id }, room.id); if (!w) return null;
  if (m.bodenFrei && !m.bodenFrei(room.id, w[0], -w[1])) {
    suche: for (let r = 0.3; r <= 1.8; r += 0.3) for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, x = w[0] + Math.cos(a) * r, z = w[1] + Math.sin(a) * r;
      if (m.bodenFrei(room.id, x, -z)) { w = [x, z]; break suche; }
    }
  }
  let t = m.ausgangLage(room.id, o.id, o.rect[0] + o.rect[2] / 2, o.rect[1] + o.rect[3] * 0.6);
  if (!t) {
    const c = m.spielerLage({ x: 480, y: 400, room: room.id }, room.id) || [0, 0], dx = w[0] - c[0], dz = w[1] - c[1], d = Math.hypot(dx, dz) || 1;
    t = [w[0] + dx / d * 1.4, w[1] + dz / d * 1.4];
  }
  const lage = { t, w };
  echt3dAusgangCache.set(key, lage);
  return lage;
}
function echt3dAusgangPruefen(p) {
  if (echt3dGehtDurch || G.busy || !p || !echt3dParkourAktiv()) return;
  const room = ROOMS[p.room]; if (!room) return;
  if (!p._ankunft || p._ankunft.room !== p.room) p._ankunft = { room: p.room, x: p.x, y: p.y, weg: false };
  if (!p._ankunft.weg && Math.hypot(p.x - p._ankunft.x, (p.y - p._ankunft.y) * 1.6) > 50) p._ankunft.weg = true;
  let ziel = null;
  if (p._ausgang3d) ziel = OBJ[p._ausgang3d];
  else if (p._gelenkt && p._ankunft.weg && p.walking && ECHT3D.mod.ausgangLage) {
    // im Raum gemessen (Meter). Viele Türen liegen in der Rückwand, ein, zwei Meter hinter dem Rand der Lauffläche –
    // darum zählt die Nähe zu ihrem Laufpunkt (dem letzten Fleck davor) und die Richtung auf die Tür selbst; wer am
    // Rand der Fläche oder an Möbeln weiter auf die Tür zu drückt, geht hindurch
    const ich = ECHT3D.mod.spielerLage(p, room.id), v = p._v3d || { x: 0, z: 0 }, vl = Math.hypot(v.x, v.z);
    const drueckt = p._gestossen3d && performance.now() - p._gestossen3d < 300;
    for (const o of room.objs) {
      if (!o.exit || !isVisible(o) || !o.rect || !ich || vl < 0.25) continue;
      const lage = echt3dAusgangOrt(room, o); if (!lage) continue;
      const { t, w } = lage;
      const dx = t[0] - ich[0], dz = t[1] - ich[1], d = Math.hypot(dx, dz), drauf = (dx * v.x + dz * v.z) / ((d || 1) * vl);
      const dw = w ? Math.hypot(w[0] - ich[0], w[1] - ich[1]) : 99;
      // Leitern und Luken sind schmal: weiter Fangbereich, auch schräg darauf zu zählt
      const nm = typeof o.name === 'function' ? '' : o.name || '', leiter = /Leiter|Luke/i.test(nm + ' ' + o.id), f = leiter ? 1.45 : 1, rw = leiter ? 0.15 : 0;
      if ((d < 1.35 * f && drauf > 0.3 - rw) || (dw < 1.1 * f && drauf > 0.4 - rw) || (drueckt && Math.min(d, dw + 0.4) < 1.9 * f && drauf > 0.15 - rw / 2)) { ziel = o; break; }
    }
  } else if (p._gelenkt && p._ankunft.weg && p.walking) {
    // Rückfall ohne 3D-Lage: in Spiel-Koordinaten
    const [zx, zy] = p._zug || [0, 0], zl = Math.hypot(zx, zy * 1.6) || 1;
    for (const o of room.objs) {
      if (!o.exit || !isVisible(o)) continue;
      const w = typeof o.walk === 'function' ? o.walk() : o.walk || [o.rect[0] + o.rect[2] / 2, o.rect[1] + o.rect[3] + 10];
      const dx = w[0] - p.x, dy = (w[1] - p.y) * 1.6, d = Math.hypot(dx, dy);
      const drauf = (dx * zx + dy * zy * 1.6) / ((d || 1) * zl);
      const r = o.rect, inFlaeche = r && p.x > r[0] - 10 && p.x < r[0] + r[2] + 10 && p.y > r[1] && p.y < r[1] + r[3] + 22;
      const drueckt = p._gestossen3d && performance.now() - p._gestossen3d < 250 && d < 95 && drauf > 0.3;   // gegen die Wand neben der Tür
      if ((d < 38 && drauf > 0.45) || (d < 70 && drauf > 0.8) || (inFlaeche && drauf > 0.5) || drueckt) { ziel = o; break; }
    }
  }
  if (!p._ausgang3d) {   // erst hindurch, wenn man einen Moment zielstrebig darauf zuläuft – Vorbeistreifen zählt nicht
    const jetzt = performance.now();
    if (ziel) {
      if (!p._ausgangDruck || p._ausgangDruck.id !== ziel.id) { p._ausgangDruck = { id: ziel.id, seit: jetzt }; ziel = null; }
      else if (jetzt - p._ausgangDruck.seit < 180) ziel = null;
    } else p._ausgangDruck = null;
  }
  p._ausgang3d = null;
  if (!ziel || !ziel.exit) return;
  echt3dGehtDurch = true;
  echt3dLenkungAus(p, true);
  echt3dDurchgehen(ziel).finally(() => { echt3dGehtDurch = false; p._z3d = 0; p._vz3d = 0; });
}
async function echt3dDurchgehen(o) {   // wie „Gehe zu“, nur ohne Anlauf: die Figur steht schon im Durchgang (Regeln für verschlossene Türen gelten weiter)
  if (G.busy || G.screen !== 'game') return;
  G.busy++;
  try { await resolve('walk', 'o:' + o.id); }
  catch (e) { console.error(e); }
  finally { G.busy--; if (!G.busy) G.skipAll = false; }
  save();
}
// Hervorhebung für Controller/Tasten: das nächste Ding vor der Figur bekommt ein Schild mit „X“ (X benutzt genau das)
let echt3dTastenT = 0;   // zuletzt mit WASD/Pfeilen gelaufen (dann zeigt das Fokus-Schild „E“ statt „X“)
function drawEcht3dFokus() {
  const tasten = performance.now() - echt3dTastenT < 6000;
  if (!echt3dParkourAktiv() || ((G.pointer === 'mouse' || G.pointer === 'touch') && !tasten) || G.busy || G.photoMode || cx.isPix) return;
  const h = echt3dNaechsterHotspot(); if (!h) return;
  const room = ROOMS[viewRoomId()];
  let pos = null, name = '', verb = 'look';
  if (h.npc) {
    const a = h.npc, sc = roomScale(room, a.y);
    pos = echt3dKopf(a, room, a.h * sc + 18) || [a.x, a.y - a.h * sc - 18]; name = a.name || a.id; verb = 'talk';
  } else {
    const [hx, hy] = hotspotCenter(h);
    pos = echt3dBildVonSpiel(hx, hy) || (echt3dFrei() ? null : [hx, hy]);
    name = typeof h.name === 'function' ? h.name() : h.name;
    verb = h.exit ? 'walk' : (defaultVerb('o:' + h.id) || 'look');
  }
  if (!pos) return;
  const [sx, sy] = toScreen(pos[0], pos[1]);
  const label = `${T(VERB_LABEL[verb] || verb)} ${T(name)}`;
  cx.save();
  cx.font = '800 15px "Baloo 2", sans-serif';
  const w = cx.measureText(label).width + 44, x = Math.max(w / 2 + 6, Math.min(W - w / 2 - 6, sx)), y = Math.max(30, sy - 18);
  const puls = 1 + Math.sin(G.t * 0.008) * 0.04;
  cx.translate(x, y); cx.scale(puls, puls);
  const raus = !!h.exit;   // Ausgang: grünes Schild mit Pfeil – X geht hindurch
  R(cx, -w / 2, -15, w + (raus ? 22 : 0), 30, raus ? 'rgba(10,40,18,0.88)' : 'rgba(18,10,28,0.82)', 2, 15, raus ? '#7dff7a' : '#f1d6a0');
  E(cx, -w / 2 + 16, 0, 10, 10, '#2a6ad8', 2, 0, '#0b0610');
  txt(cx, G.pointer === 'pad' ? 'X' : 'E', -w / 2 + 16, 5, '400 13px "Titan One", sans-serif', '#ffffff', 'center');
  txt(cx, label, 12, 5, '800 15px "Baloo 2", sans-serif', raus ? '#c8ffc0' : '#fff0c8', 'center');
  if (raus) txt(cx, '➜', w / 2 + 8, 6, '800 17px "Baloo 2", sans-serif', '#7dff7a', 'center');
  cx.restore();
}
function echt3dBenutzen() {
  const h = echt3dNaechsterHotspot();
  if (!h) { note('Hier ist nichts in Reichweite. Lauf näher an etwas heran.'); return; }
  if (h.npc) return runSentence('talk', 'a:' + h.npc.id);
  const k = 'o:' + h.id;
  return runSentence(defaultVerb(k) || 'look', k);
}
// Stick/Tasten: nur die Eingabe merken – bewegt wird jedes Bild in echt3dLenkSchritt (direkt in 3D, mit Beschleunigen)
function echt3dSetzBewegungsziel(a, dx, dy) {
  if (!a || a.room !== viewRoomId() || !ECHT3D.mod || !ECHT3D.mod.lenken) return false;
  if (Math.hypot(dx, dy) < 0.025) return false;
  if (!a._gelenkt || a.target) { if (a._res) { const done = a._res; a._res = null; done(false); } a.target = null; }
  a._gelenkt = true; a._eingabe3d = { x: dx, y: dy, t: performance.now() };
  return true;
}
let echt3dTastenLesen = () => {};
function echt3dLenkSchritt(dt) {
  echt3dTastenLesen();
  const a = G.state && me();
  if (!a || !a._gelenkt || !ECHT3D.mod || !ECHT3D.mod.lenken || a.room !== viewRoomId() || !echt3dAktiv()) return;
  if (a.target) { a._gelenkt = false; a._v3d = null; return; }   // ein Klick hat übernommen
  if (a._jubelT3d && performance.now() - a._jubelT3d < 1100) { a.walking = false; a._v3d = null; return; }   // Jubelpose: kurz stillhalten
  const e = a._eingabe3d, frisch = e && performance.now() - e.t < 150 && echt3dSteuerungErlaubt();
  const sek = Math.min(0.1, dt / 1000);   // auch bei wenig Bildern pro Sekunde richtig schnell
  const r = ECHT3D.mod.lenken(a, frisch ? e.x : 0, frisch ? e.y : 0, sek, a.room);
  if (!r) return;
  if (r.stand) { a._gelenkt = false; a._v3d = null; a._blick3d = null; a.walking = false; a.run = false; return; }
  const [x, y] = r.innen ? [r.x, r.y] : clampWalk(ROOMS[a.room], r.x, r.y);
  if (!r.innen && Math.hypot(x - r.x, y - r.y) > 0.4) a._gestossen3d = performance.now();
  const mx = x - a.x, my = y - a.y;
  if (Math.abs(mx) > 0.2) a.dir = mx > 0 ? 1 : -1;
  if (Math.hypot(mx, my) > 0.01) a._zug = [mx, my];   // Bewegungsrichtung in Spiel-Koordinaten (für Türen)
  a.x = x; a.y = y; a._blick3d = r.yaw; a.walking = r.tempo > 0.35; a.run = r.tempo > 3.4;
  // Schritte hörbar machen wie beim normalen Gehen
  const room = ROOMS[a.room], vorher = Math.floor((a.phase || 0) / Math.PI);
  a.phase = (a.phase || 0) + sek * r.tempo * 2.3;
  if (room && Math.floor(a.phase / Math.PI) !== vorher && a.walking && (a._z3d || 0) < 0.05) {
    const st = (typeof STEP_STYLE !== 'undefined' && STEP_STYLE[a.id]) || [null, (a.bw || 50) / 55];
    Sound.step(room.floor, panX(a.x), st[1], false, st[0]);
  }
}
{ const updateOhneLenkung = updateActors; updateActors = function (dt) { echt3dLenkSchritt(dt); updateOhneLenkung(dt); }; }
function echt3dPadBewegen(x, y, dt) {
  if (!echt3dParkourAktiv()) return false;
  if (x || y) echt3dSetzBewegungsziel(me(), x, y);
  else echt3dLenkungAus(me());
  return true;
}
function echt3dLenkungAus(a, sofort) {   // losgelassen: ausrollen lassen (bremsen); sofort = auf der Stelle stehen
  if (!a) return;
  a._eingabe3d = null; a._lenk3d = null;
  if (!sofort || !a._gelenkt) return;
  a._gelenkt = false; a._v3d = null; a._blick3d = null; a.target = null; a.walking = false; a.run = false;
  if (a._res) { const done = a._res; a._res = null; done(true); }
}
function echt3dPadSpringen() {
  if (!echt3dParkourAktiv()) return false;
  if (G.pointer === 'pad' && G.mouse.x >= 0 && hitScene(G.mouse.x, G.mouse.y)) return false;   // Cursor auf einem Hotspot: A klickt
  ECHT3D.mod.huepfen(me());
  return true;
}
let echt3dVirtualStick = { x: 0, y: 0, aktiv: false };
// ---------- Goldene Toasts (nur Echtzeit-3D): in jedem Raum glänzt einer, oft oben auf einem Möbel – hinaufspringen! ----------
const GOLDTOAST_RAEUME = Object.keys(ECHT3D.rooms).filter(id => id !== 'prolog');
const echt3dGold = {};   // Raum -> gewählter Ort [x, y, Höhe] in Blender-Metern
const goldtoastHat = id => !!(G.state && G.state.flags && G.state.flags['goldtoast_' + id]);
const goldtoastZahl = () => GOLDTOAST_RAEUME.filter(goldtoastHat).length;
if (typeof ACH !== 'undefined') ACH.push({ id: 'goldtoasts', name: 'Goldene Krümel', desc: 'Alle goldenen Toasts in der Villa und drumherum gefunden (Echtzeit-3D).' });
function echt3dGoldtoastPruefen(p) {
  const id = p.room, m = ECHT3D.mod;
  if (!m || !m.goldtoastSetzen || !GOLDTOAST_RAEUME.includes(id) || !m.raumGeladen(id) || goldtoastHat(id)) return;
  if (!(id in echt3dGold)) {   // Platz aussuchen: ein Möbel, dessen Fuß auf der Lauffläche steht – sonst hinten auf dem Boden
    const room = ROOMS[id]; let s = 7; for (const ch of id) s = (s * 31 + ch.charCodeAt(0)) % 9973;
    // Möbel im Bild der Bühnenkamera zuerst (dort sieht man ihn glänzen), sonst irgendwo im begehbaren 3D-Raum;
    // Möbel an der Wand zählen mit (man springt von vorn hinauf)
    const kand = m.goldtoastKandidaten(id).map((k, i) => { const g = m.spielVonWelt(id, [k[0], k[1], 0]), imBild = g && g[0] > 60 && g[0] < 900 && g[1] > 40 && g[1] < 430; return [k, g, (imBild ? 0 : 1000) + (i * 7919 + s) % 997]; })
      .sort((a, b) => a[2] - b[2]);
    let ort = null;
    for (const [k, g] of kand) {
      if (!g) continue;
      const [x, y] = clampWalk(room, g[0], g[1]);
      if (Math.hypot(x - g[0], y - g[1]) < 50) { ort = k; break; }
    }
    if (!ort) { const [x, y] = clampWalk(room, 220 + (s % 520), 0); ort = m.weltVonSpiel(id, x, y + 6); }
    echt3dGold[id] = ort;
  }
  const ort = echt3dGold[id]; if (!ort) return;
  if (!m.goldtoastDa(id)) m.goldtoastSetzen(id, ort);   // (wieder) aufstellen – der Raum kann neu geladen worden sein
  const q = p._pos3d; if (!q) return;
  const abst = Math.hypot(q[0] - ort[0], q[1] - ort[1]);
  const basis = typeof progress === 'function' && typeof MILESTONES !== 'undefined' ? progress() / MILESTONES.length : 0;
  Sound.setIntensity(abst < 6 ? Math.max(basis, 0.7) : basis);   // in der Nähe: die Musik legt ihre Zusatzspuren auf
  if (abst < 5.5 && G.t - (G.goldFunkelT || 0) > 350 + abst * 260) {   // in der Nähe funkelt es leise – je näher, desto schneller
    G.goldFunkelT = G.t; const g = m.spielVonWelt(id, [ort[0], ort[1], 0]); Sound.sfx('funkeln', g ? panX(g[0]) : 0);
  }
  if (abst < 0.7 && q[2] > ort[2] - 0.35) {
    G.state.flags['goldtoast_' + id] = 1;
    if (typeof progress === 'function' && typeof MILESTONES !== 'undefined') Sound.setIntensity(progress() / MILESTONES.length);
    m.goldtoastWeg(id); Sound.sfx('goldtoast'); rumble(180, 0.4, 0.6);
    p._jubelT3d = performance.now(); if (!p._vz3d) { p._vz3d = 3.6; p._z3d = Math.max(p._z3d || 0, 0.0002); }   // kleiner Freudensprung
    if (Sound.duck) { Sound.duck(true); setTimeout(() => { if (!G.speech) Sound.duck(false); }, 1400); }   // Musik kurz leiser: die Fanfare gehört dem Toast
    if (typeof mimikStart === 'function') mimikStart(p, 'freude');
    const n = goldtoastZahl(), alle = GOLDTOAST_RAEUME.length;
    note(n >= alle ? `Alle ${alle} goldenen Toasts! Dr. Fred wäre stolz. Oder hungrig.` : `Goldener Toast! ${n} von ${alle}.`);
    G.goldtoastT = G.t;
    if (n >= alle) unlock('goldtoasts');
    save();
  }
}
// ---------- Krümel: Spuren zum Einsammeln, eine führt zum goldenen Toast ----------
const echt3dKruemel = {};
const bitZahl = m => { let n = 0; m >>>= 0; while (m) { n += m & 1; m >>>= 1; } return n; };
const kruemelZahl = () => G.state ? GOLDTOAST_RAEUME.reduce((n, id) => n + bitZahl(G.state.flags['kr_' + id] || 0), 0) : 0;
function kruemelPlanen(id) {
  const m = ECHT3D.mod, room = ROOMS[id], liste = [];
  const boden = (gx, gy) => { const [x, y] = clampWalk(room, gx, gy); const w = m.weltVonSpiel(id, x, y); return w && m.bodenFrei(id, w[0], w[1]) ? w : null; };
  const nahGenug = w => liste.every(q => Math.hypot(q[0] - w[0], q[1] - w[1]) > 0.5);
  const dazu = w => { if (w && liste.length < 30 && nahGenug(w)) liste.push([w[0], w[1], 0]); };
  const start = boden(480, 410), ziel = echt3dGold[id];
  if (start && ziel) for (let i = 1; i <= 10; i++) {   // Spur zum goldenen Toast (endet vor dem Möbel)
    const u = i / 11, x = start[0] + (ziel[0] - start[0]) * u, y = start[1] + (ziel[1] - start[1]) * u;
    if (m.bodenFrei(id, x, y)) dazu([x, y, 0]);
  }
  for (let i = 0; i < 10; i++) dazu(boden(130 + i * 78, 392 + Math.sin(i * 0.9) * 18));   // Bogen vorn
  const [, oben] = clampWalk(room, 480, 0);
  for (let i = 0; i < 8; i++) dazu(boden(250 + i * 66, oben + 18 + Math.cos(i * 0.8) * 10));   // Bogen hinten
  return liste;
}
function echt3dKruemelPruefen(p) {
  const id = p.room, m = ECHT3D.mod;
  if (!m || !m.kruemelSetzen || !GOLDTOAST_RAEUME.includes(id) || !m.raumGeladen(id) || !(id in echt3dGold)) return;
  if (!echt3dKruemel[id]) echt3dKruemel[id] = kruemelPlanen(id);
  if (!m.kruemelDa(id)) m.kruemelSetzen(id, echt3dKruemel[id], G.state.flags['kr_' + id] || 0);
}
let kruemelSerie = 0, kruemelLetzt = 0, kruemelSpeichern = 0;
function kruemelGefunden(id, weg) {   // aus js/echt3d-szene.js
  if (!G.state) return;
  G.state.flags['kr_' + id] = weg >>> 0;
  kruemelSerie = performance.now() - kruemelLetzt < 900 ? kruemelSerie + 1 : 0; kruemelLetzt = performance.now();
  Sound.sfx('kruemel' + Math.min(7, kruemelSerie));
  G.kruemelT = G.t;
  const liste = echt3dKruemel[id];
  if (liste && bitZahl(weg) >= liste.length) { note('Alle Krümel in diesem Raum!'); Sound.sfx('coin'); }
  clearTimeout(kruemelSpeichern); kruemelSpeichern = setTimeout(() => save(), 1500);
}
function drawGoldtoastZaehler() {
  if (!echt3dParkourAktiv() || cx.isPix || G.photoMode || !G.state || G.inIntro) return;
  const n = goldtoastZahl(), alle = GOLDTOAST_RAEUME.length, hier = GOLDTOAST_RAEUME.includes(viewRoomId()) && !goldtoastHat(viewRoomId());
  const frisch = G.goldtoastT && G.t - G.goldtoastT < 2500, k = frisch ? 1 + Math.sin((G.t - G.goldtoastT) * 0.02) * 0.12 * (1 - (G.t - G.goldtoastT) / 2500) : 1;
  const x = 30, y = 96;
  cx.save(); cx.translate(x, y); cx.scale(k, k); cx.rotate(-0.08);
  R(cx, -15, -13, 30, 26, '#ffd23a', 2, 8, '#8a5a10'); R(cx, -10, -8, 20, 16, '#ffe680', 0, 5);   // kleiner Goldtoast
  cx.restore();
  txt(cx, `${n}/${alle}`, x + 22, y + 6, '800 17px "Baloo 2", sans-serif', hier ? '#ffe066' : '#d7c6ff', 'left', 4, '#1b1020');
  const kz = kruemelZahl(), kk = G.kruemelT && G.t - G.kruemelT < 400 ? 1.25 - (G.t - G.kruemelT) / 1600 : 1;   // Krümel daneben
  cx.save(); cx.translate(x + 84, y); cx.scale(kk, kk); cx.rotate(0.5); R(cx, -7, -7, 14, 14, '#f2b448', 2, 3, '#6a3a00'); cx.restore();
  txt(cx, String(kz), x + 98, y + 6, '800 17px "Baloo 2", sans-serif', '#f2d29a', 'left', 4, '#1b1020');
}
function drawEcht3dParkour() {
  drawEcht3dFokus();
  drawGoldtoastZaehler();
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
    if (ziel) { echt3dUmgerechnet = true; try { sceneClick(Math.round(ziel.x), Math.round(ziel.y), right); } finally { echt3dUmgerechnet = false; } }
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
        if (ECHT3D.mod.freiAktiv() && raumKlickAt(p, drag.button === 2)) return;
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
    if (aktiv() && echt3dKameraSteuerungErlaubt() && (e.key === 'c' || e.key === 'C')) {
      e.stopImmediatePropagation(); e.preventDefault(); echt3dKameraWechsel();
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
  window.addEventListener('keyup', e => {
    tasten.delete(e.key.toLowerCase());
    if (e.key === ' ' && aktiv() && ECHT3D.mod && ECHT3D.mod.sprungLos) ECHT3D.mod.sprungLos(me());
  });
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
    echt3dGoldtoastPruefen(p);
    echt3dKruemelPruefen(p);
    echt3dAusgangPruefen(p);
  }, 90);
  // Tasten und Touch-Stick jedes Bild (vor der Bewegung) – nicht im 90-ms-Takt, sonst ruckelt es
  echt3dTastenLesen = () => {
    const p = me();
    if (!p || !aktiv() || !echt3dSteuerungErlaubt() || G.inIntro) return;
    const dx = (tasten.has('d') || tasten.has('arrowright') ? 1 : 0) - (tasten.has('a') || tasten.has('arrowleft') ? 1 : 0) + (echt3dVirtualStick.aktiv ? echt3dVirtualStick.x : 0);
    const dy = (tasten.has('s') || tasten.has('arrowdown') ? 1 : 0) - (tasten.has('w') || tasten.has('arrowup') ? 1 : 0) + (echt3dVirtualStick.aktiv ? echt3dVirtualStick.y : 0);
    if (dx || dy) { const n = Math.max(1, Math.hypot(dx, dy)); echt3dSetzBewegungsziel(p, dx / n, dy / n); if (!echt3dVirtualStick.aktiv) echt3dTastenT = performance.now(); }
    else if (G.pointer !== 'pad' && p._eingabe3d) echt3dLenkungAus(p);
  };
}
// Zeitwechsel ohne Warten: am PC lädt im Hintergrund schon die Räume der anderen beiden Helden – nur im Stehen (das
// Aufbauen eines Raums kostet einen Moment Rechenzeit) und nie auf der Xbox (Grafikspeicher, siehe speicherInfo)
setInterval(() => {
  const m = ECHT3D.mod;
  if (!m || !m.ready || !m.speicherInfo || m.speicherInfo().sparsam || G.screen !== 'game' || !G.state || G.busy || G.inIntro || G.settings.retro) return;
  const ich = me(); if (!ich || ich.walking || ich._gelenkt) return;
  const hier = viewRoomId(); if (!m.raumGeladen(hier)) return;
  // zuerst die Nachbarräume (wohin die Ausgänge hier führen – höchstens zwei), dann die Räume der anderen Helden;
  // nie mehr als vier Räume zugleich, damit nichts Geladenes gleich wieder verdrängt wird
  if (m.speicherInfo().raeume.length >= 4) return;
  const nachbarn = [...new Set((ROOMS[hier] ? ROOMS[hier].objs : []).filter(o => o.exit && isVisible(o)).map(o => o.exit[0]))].slice(0, 2);
  for (const r of [...nachbarn, ...PLAYERS.map(id => ACT[id] && ACT[id].room)]) {
    if (r && r !== hier && ECHT3D.rooms[r] && !m.raumGeladen(r) && !m.failed(r)) { m.hasRoom(r); break; }
  }
}, 3000);
