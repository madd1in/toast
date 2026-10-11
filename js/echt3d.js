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
  rooms: { hafen: 1, landeplatz: 1, keller: 1, lobby: 1, labor: 1, konferenz: 1, gasthaus: 1, garten1776: 1, fgarten: 1, vorraum: 1, thron: 1, testkammer: 1, mars: 1, stockwerk: 1, dachboden: 1 },
};
function echt3dWanted(room) { return !!(G.settings.echt3d && room && ECHT3D.rooms[room.id] && !cx.isPix); }
function echt3dOn(room) { return echt3dWanted(room) && !!ECHT3D.mod && ECHT3D.mod.ready && !ECHT3D.mod.failed(room.id) && ECHT3D.mod.hasRoom(room.id); }
function echt3dLoad() {
  if (ECHT3D.mod || ECHT3D.loading || ECHT3D.failed) return;
  ECHT3D.loading = true;
  note('Echtzeit-3D wird geladen …');
  import('./echt3d-szene.js')
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
// Raumbild: im 3D-Raum das Echtzeit-Bild, sonst wie bisher
const drawBgOhne3D = drawBg;
drawBg = function (room) {
  if (echt3dWanted(room)) {
    echt3dLoad();
    if (echt3dOn(room)) {
      const acts = Object.values(ACT).filter(a => a.room === room.id && a.visible && !echt3dBild(a));
      const bild = ECHT3D.mod.frame(G.t, acts, Math.min(1920, W * VS * DPR * SSK), { id: room.id, zustand: room.zustand3d || {}, sprites: ECHT3D_TEILE });
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
  if (echt3dOn(room) && !echt3dBild(a) && ECHT3D.mod.owns(a, room.id)) {
    if (typeof mimikDeko === 'function') {
      const f = mimikForm(a, G.t);
      if (f.m) { const sc = roomScale(room, a.y); cx.save(); cx.translate(a.x, a.y); cx.scale(sc * (a.dir < 0 ? -1 : 1), sc); mimikDeko(cx, a, G.t, f); cx.restore(); }
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
const echt3dAktiv = () => G.settings.echt3d && ECHT3D.rooms[viewRoomId()] && ECHT3D.mod && ECHT3D.mod.ready && !ECHT3D.mod.failed(viewRoomId()) && ECHT3D.mod.hasRoom(viewRoomId()) && !cx.isPix;
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
const ECHT3D_PARKOUR = new Set(['dachboden', 'stockwerk']);
function echt3dParkourAktiv() { return echt3dAktiv() && ECHT3D_PARKOUR.has(viewRoomId()) && echt3dSteuerungErlaubt(); }
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
    if (!ECHT3D_PARKOUR.has(viewRoomId()) || (!COARSE && G.pointer !== 'touch')) return null;
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

// ---------- Jump'n'Run-Abschnitte: Kistenparcours und Toaststufen ----------
{
  const tasten = new Set();
  const aktiv = echt3dAktiv;
  let letzterKurs = null;
  window.addEventListener('keydown', e => {
    if (!aktiv() || !echt3dSteuerungErlaubt() || !ECHT3D_PARKOUR.has(viewRoomId())) return;
    const k = e.key.toLowerCase();
    if (k === ' ') {
      if (G.screen === 'game' && !G.busy && !G.dialog) { e.stopImmediatePropagation(); e.preventDefault(); ECHT3D.mod.huepfen(me()); }
      return;
    }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { tasten.add(k); e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  window.addEventListener('keyup', e => tasten.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => { tasten.clear(); echt3dVirtualStick = { x: 0, y: 0, aktiv: false }; });
  setInterval(() => {
    const raum = viewRoomId(), kurs = aktiv() && G.screen === 'game' && ECHT3D_PARKOUR.has(raum) ? raum : null;
    if (kurs && kurs !== letzterKurs) note(kurs === 'stockwerk'
      ? 'Sprungpassage: über die Buttertoast-Stufen durch die Treppenlücke. Fehltritte setzen dich aufs letzte Brett zurück.'
      : 'Kistenparcours: lauf mit WASD, spring mit Leertaste und hol dir den Chrono-Kristall oben auf dem Stapel.');
    letzterKurs = kurs;
    const p = me();
    if (p && p._respawned3d) { p._respawned3d = false; if (G.pointer === 'touch' && navigator.vibrate) navigator.vibrate(35); note('Daneben! Du bist am letzten Sprungbrett wieder aufgetaucht.'); }
    if (!kurs || !echt3dSteuerungErlaubt()) { tasten.clear(); echt3dVirtualStick = { x: 0, y: 0, aktiv: false }; }
    if (!aktiv() || !kurs || !p || p.room !== raum) return;
    const dx = (tasten.has('d') || tasten.has('arrowright') ? 1 : 0) - (tasten.has('a') || tasten.has('arrowleft') ? 1 : 0) + (kurs && echt3dVirtualStick.aktiv ? echt3dVirtualStick.x : 0);
    const dy = (tasten.has('s') || tasten.has('arrowdown') ? 1 : 0) - (tasten.has('w') || tasten.has('arrowup') ? 1 : 0) + (kurs && echt3dVirtualStick.aktiv ? echt3dVirtualStick.y : 0);
    if (dx || dy) echt3dSetzBewegungsziel(p, dx, dy, 0.09);
  }, 90);
}
