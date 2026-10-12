'use strict';
// ============================================================
//  Tentakel-Toast – krumme gemalte Räume (js/krumm2d.js)
//  Die vorgerenderten Raumbilder sind gerade. Wie im Echtzeit-3D (js/echt3d-szene.js, KRUMM) kippen hier die Wände:
//  Alles oberhalb der Lauffläche wird Zeile für Zeile verschoben und gestreckt – je höher, desto schiefer, mit
//  Wellen in beide Richtungen. Der Boden (wo die Figuren stehen und man hinklickt) bleibt, wo er ist.
//  Einmal beim Malen in den Bild-Zwischenspeicher (engine.js, drawBg) – kostet im Spiel nichts.
// ============================================================
const KRUMM2D_STAERKE = { lobby: 1.35, labor: 1.15, konferenz: 1.15, gasthaus: 1.05, vorraum: 1.05, thron: 1.05, keller: 1, stockwerk: 0.9, dachboden: 0.8, uhrwerk: 0.7, testkammer: 0.9 };
function bgKrumm(c, room) {
  const k = KRUMM2D_STAERKE[room.id]; if (!k || G.settings.retro) return;
  const w = c.width, h = c.height, s = w / W, boden = (room.yTop || 340) * s;
  const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
  const t = tmp.getContext('2d'); t.drawImage(c, 0, 0);
  const g = c.getContext('2d'); g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  let ph = 0; for (const ch of room.id) ph = (ph * 31 + ch.charCodeAt(0)) % 628; ph /= 100;
  const zeile = Math.max(1, Math.round(s));
  for (let y = 0; y < boden; y += zeile) {
    const hoch = (boden - y) / boden;   // 0 am Boden, 1 oben
    const facher = 1 + 0.085 * k * hoch;   // Fächer: oben breiter (Wände kippen nach außen)
    const welle = (Math.sin(y / s * 0.018 + ph) * 16 + Math.sin(y / s * 0.047 + ph * 2) * 6) * k * hoch * s;   // Wellen
    const breit = w * facher;
    g.drawImage(tmp, 0, y, w, zeile, (w - breit) / 2 + welle, y, breit, zeile);
  }
  g.restore();
}
