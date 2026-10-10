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
  rooms: { hafen: 1, landeplatz: 1, keller: 1, lobby: 1, labor: 1, konferenz: 1, gasthaus: 1, garten1776: 1, fgarten: 1, vorraum: 1, thron: 1, testkammer: 1, mars: 1 },
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
      if (bild) { cx.drawImage(bild, 0, 0, W, SH); return; }
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
  else note(G.settings.echt3d ? 'Echtzeit-3D (Beta) an – alle 3D-Räume, Bernard, Hoagie und Laverne als echte 3D-Figuren.' : 'Echtzeit-3D aus – vorgerenderte Grafik.');
}
