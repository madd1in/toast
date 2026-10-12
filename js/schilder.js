'use strict';
// ============================================================
//  Tentakel-Toast – Schilder in der Spielwelt übersetzen (js/schilder.js)
//  Die Schilder in den Räumen (EMPFANG, LABOR, NUR MIT KITTEL!, KÜHLBECKEN …) sind in Blender gebaut und stecken im
//  vorgerenderten Bild wie im Echtzeit-3D. img/3d/schilder.json (aus Blender) kennt Text, Farbe und Bildlage jedes
//  Schilds. In einer anderen Sprache malt diese Datei im gemalten Bild das übersetzte Schild darüber; im Echtzeit-3D
//  tauscht js/echt3d-szene.js die Schrift gegen eine Textur mit der Übersetzung.
// ============================================================
let SCHILDER = {};
// Schilder sind oft in Großbuchstaben – die übersetzt der Übersetzer nicht (er hält sie für Codes). Darum: erst normal
// schreiben („Nur Mit Kittel!“), übersetzen lassen und das Ergebnis wieder in Großbuchstaben setzen
function schildFrage(t) {
  const gross = t === t.toUpperCase() && /[A-ZÄÖÜ]{2}/.test(t);
  return gross ? t.toLowerCase().replace(/(^|[\s\-–→←(])(\p{L})/gu, (m, a, c) => a + c.toUpperCase()) : t;
}
const SCHILD_NEU = { 'LABOR': 'BÜRO' };   // umgewidmete Schilder: das Labor liegt jetzt hinter der Standuhr im Keller
function schildText(t) {
  if (SCHILD_NEU[t]) t = SCHILD_NEU[t];
  if (typeof Lang === 'undefined' || Lang.cur === 'de' || !t) return t;
  const q = schildFrage(t), r = Lang.t(q);
  if (!r || r === q) return t;
  return q !== t ? r.toUpperCase() : r;
}
function schilderVorwaermen() { if (Lang.cur !== 'de') Lang.prewarm(Object.values(SCHILDER).flatMap(r => Object.values(r).map(s => schildFrage(s.t)))); }
fetch('img/3d/schilder.json?v=' + (typeof TT_VER !== 'undefined' ? TT_VER : 0)).then(r => r.json()).then(j => {
  SCHILDER = j || {};
  for (const id of Object.keys(SCHILDER)) schilderEinhaengen(id);
  schilderVorwaermen(); refreshBgs();
}).catch(() => {});
function schilderEinhaengen(id) {
  const room = ROOMS[id]; if (!room || room._schilder || typeof room.draw !== 'function') return;
  room._schilder = true;
  const malen = room.draw;
  room.draw = function (g) { malen.call(this, g); if ((Lang.cur !== 'de' || Object.values(SCHILDER[id] || {}).some(s => SCHILD_NEU[s.t])) && !g.isPix) schilderMalen(g, id); };
}
// Grundfarbe rund um das Schild aus dem schon gemalten Bild (damit die deutsche Schrift verschwindet)
function schildGrund(g, r) {
  try {
    const s = g.getTransform ? g.getTransform().a : 1, x0 = Math.max(0, Math.floor(r[0] * s)), y0 = Math.max(0, Math.floor(r[1] * s));
    const w = Math.max(2, Math.floor(r[2] * s)), h = Math.max(2, Math.floor(r[3] * s));
    const d = g.getImageData(x0, y0, w, h).data;
    let rr = 0, gg = 0, bb = 0, n = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (y > 1 && y < h - 2 && x > 1 && x < w - 2) continue;   // nur der Rand
      const i = (y * w + x) * 4; rr += d[i]; gg += d[i + 1]; bb += d[i + 2]; n++;
    }
    return n ? `rgb(${Math.round(rr / n)},${Math.round(gg / n)},${Math.round(bb / n)})` : null;
  } catch (e) { return null; }
}
function schilderMalen(g, id) {
  for (const s of Object.values(SCHILDER[id] || {})) {
    if (!s.r || !s.t) continue;
    const ziel = schildText(s.t);
    if (!ziel || ziel === s.t) continue;   // noch nicht übersetzt (kommt gleich, das Bild wird dann neu gemalt) oder gleich
    const [x, y, w, h] = s.r, grund = schildGrund(g, s.r);
    if (grund) R(g, x - 2, y - 1, w + 4, h + 2, grund, 0, 3);
    const zeilen = String(ziel).split('\n');
    let fs = Math.min(h / zeilen.length * 0.92, 40);
    g.font = `400 ${fs}px "Titan One", sans-serif`;
    const breit = Math.max(...zeilen.map(z => g.measureText(z).width));
    if (breit > w * 1.05) fs *= w * 1.05 / breit;
    zeilen.forEach((z, i) => txt(g, '​' + z, x + w / 2, y + h / 2 + (i - (zeilen.length - 1) / 2) * fs * 1.02 + fs * 0.36, `400 ${fs.toFixed(1)}px "Titan One", sans-serif`, s.c || '#ffe066', 'center', Math.max(1, fs * 0.1), '#140a1c'));
  }
}
