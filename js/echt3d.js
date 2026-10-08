'use strict';
// ============================================================
//  Tentakel-Toast – Echtzeit-3D (Beta), Anbindung ans Spiel
//  Ist „Echtzeit-3D“ in den Einstellungen an, lädt das Spiel beim ersten Besuch eines 3D-fähigen Raums
//  js/echt3d-szene.js (three.js über die Import-Map in index.html) und zeichnet dort statt des vorgerenderten
//  Hintergrunds und der Figuren-Sprites ein echtes 3D-Bild. Hotspots, Laufwege, Dialoge, Licht-Effekte und die
//  Oberfläche bleiben die des Spiels – die 3D-Kamera ist dieselbe wie beim vorgerenderten Bild.
//  Im Pixel-Modus und solange die Szene lädt, bleibt alles wie gehabt.
// ============================================================
const ECHT3D = { mod: null, loading: false, failed: false, rooms: { hafen: true } };
function echt3dWanted(room) { return !!(G.settings.echt3d && room && ECHT3D.rooms[room.id] && !cx.isPix); }
function echt3dOn(room) { return echt3dWanted(room) && ECHT3D.mod && ECHT3D.mod.ready; }
function echt3dLoad() {
  if (ECHT3D.mod || ECHT3D.loading || ECHT3D.failed) return;
  ECHT3D.loading = true;
  note('Echtzeit-3D wird geladen …');
  import('./echt3d-szene.js')
    .then(m => m.init().then(() => { ECHT3D.mod = m; note('Echtzeit-3D (Beta) ist bereit.'); }))
    .catch(e => { ECHT3D.failed = true; console.error('Echtzeit-3D', e); note('Echtzeit-3D konnte nicht geladen werden – es bleibt beim vorgerenderten Bild.'); })
    .finally(() => { ECHT3D.loading = false; });
}
// Raumbild: im 3D-Raum das Echtzeit-Bild, sonst wie bisher
const drawBgOhne3D = drawBg;
drawBg = function (room) {
  if (echt3dWanted(room)) {
    echt3dLoad();
    if (echt3dOn(room)) {
      const acts = Object.values(ACT).filter(a => a.room === room.id && a.visible);
      cx.drawImage(ECHT3D.mod.frame(G.t, acts, Math.min(1920, W * VS * DPR * SSK)), 0, 0, W, SH);
      return;
    }
  }
  return drawBgOhne3D(room);
};
// Figuren, die die 3D-Szene selbst zeigt, nicht noch einmal als Sprite zeichnen
const drawActorOhne3D = drawActor;
drawActor = function (a, room) {
  if (echt3dOn(room) && ECHT3D.mod.owns(a)) return;
  return drawActorOhne3D(a, room);
};
function toggleEcht3d() {
  G.settings.echt3d = !G.settings.echt3d; saveSettings(); Sound.sfx('warp');
  if (G.settings.echt3d && G.settings.retro) note('Echtzeit-3D läuft nur im Remastered-Grafikmodus.');
  else note(G.settings.echt3d ? 'Echtzeit-3D (Beta) an – zu sehen im Hafen 1776.' : 'Echtzeit-3D aus – vorgerenderte Grafik.');
}
