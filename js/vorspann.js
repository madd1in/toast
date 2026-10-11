'use strict';
// ============================================================
//  Tentakel-Toast – Ladebildschirm und Kino-Vorspann (js/vorspann.js)
//  Ladebildschirm: Nachthimmel mit Mond, die krumme Villa als Scherenschnitt mit flackernden Fenstern, das Logo,
//  ein Toast auf der Flucht vor dem Lila Tentakel, ein echter Fortschrittsbalken (Schriften und Bilder, js/draw.js:
//  TT_LADEN) und wechselnde Tipps.
//  Intro: Kinobalken fahren ein, eine Titelkarte mit Logo und Schreibmaschinen-Text eröffnet die Geschichte, die
//  Einblendungen („Fünf Jahre nach …“) erscheinen als Kino-Untertitel statt als Kasten.
// ============================================================
const LADE_TIPPS = [
  'Tipp: Zieh in der Lobby am Pendel der Standuhr …',
  'Tipp: Im Echtzeit-3D läufst du mit WASD und springst mit der Leertaste.',
  'Tipp: Rechtsklick zeigt alle Aktionen für ein Ding.',
  'Tipp: Gegenstände reisen per Chrono-Klo durch die Zeit.',
  'Tipp: Taste H gibt einen Hinweis, wenn du feststeckst.',
  'Wusstest du? Der Hamster heißt Ed. Er ist nicht zu verwechseln mit Onkel Ed.',
];
function ladeFortschritt() {
  const L = typeof TT_LADEN !== 'undefined' ? TT_LADEN : null;
  const bilder = L && L.n ? L.ok / L.n : 0.5, schrift = G.schriftOk ? 1 : Math.min(0.9, G.t / 2600);
  return Math.max(0, Math.min(1, schrift * 0.35 + bilder * 0.65));
}
function villaSilhouette(c, t, x0, boden, s) {   // krumm wie in Day of the Tentacle: nichts steht gerade
  const sil = '#160828', P2 = pts => P(c, pts.map((v, i) => i % 2 ? boden - v * s : x0 + v * s), sil, 0);
  P2([0, 0, 6, 150, -4, 170, 120, 182, 250, 168, 262, 150, 256, 0]);   // Haupthaus, leicht verzogen
  P2([-14, 168, 126, 236, 270, 164]);   // Dach, schief
  P2([160, 190, 168, 300, 196, 296, 190, 186]);   // Schornstein, gekippt
  P2([30, 170, 26, 262, 88, 270, 92, 172]);   // Turm
  P2([18, 258, 56, 352, 100, 266]);   // Turmspitze, verbogen
  L(c, [x0 + 56 * s, boden - 352 * s, x0 + 62 * s, boden - 372 * s], 2, sil);
  const fenster = [[30, 60], [80, 64], [150, 58], [200, 62], [44, 118], [110, 122], [180, 116], [52, 210], [64, 230]];
  for (const [i, [fx, fy]] of fenster.entries()) {
    const fl = 0.65 + 0.35 * Math.sin(t * 0.004 + i * 2.3) * Math.sin(t * 0.0017 + i);
    const w = 22 * s, h = 26 * s, x = x0 + fx * s, y = boden - fy * s - h, kipp = Math.sin(i * 1.7) * 3 * s;
    if (!c.isPix) glowAt(c, x + w / 2, y + h / 2, 30 * s, '#ffc860', 0.18 * fl);
    P(c, [x + kipp, y, x + w + kipp, y + 2, x + w, y + h, x, y + h - 1], `rgba(255,${200 + Math.round(30 * fl)},96,${0.75 + 0.25 * fl})`, 0);
    L(c, [x + w / 2 + kipp / 2, y + 1, x + w / 2, y + h], 1.5, sil); L(c, [x + kipp / 2, y + h / 2, x + w + kipp / 2, y + h / 2], 1.5, sil);
  }
}
function toastFigur(c, x, y, sq, rot) {
  c.save(); c.translate(x, y); c.scale(sq, 2 - sq); c.rotate(rot);
  S(c, '#e8b060', 3, () => { c.moveTo(-28, 26); c.lineTo(-28, -10); c.quadraticCurveTo(-34, -34, -14, -34); c.quadraticCurveTo(0, -44, 14, -34); c.quadraticCurveTo(34, -34, 28, -10); c.lineTo(28, 26); c.closePath(); });
  R(c, -20, -20, 40, 40, '#f6dca0', 0, 6);
  E(c, -8, -6, 5, 6, '#ffffff', 1.5); E(c, 8, -6, 5, 6, '#ffffff', 1.5); E(c, -6, -5, 2.4, 3, '#1b1020', 0); E(c, 10, -5, 2.4, 3, '#1b1020', 0);   // schaut panisch nach hinten
  E(c, 1, 10, 5, 4, '#7a2222', 1.5);   // „AAAH!“
  c.restore();
}
function tentakelFigur(c, x, y, sq, t) {
  c.save(); c.translate(x, y); c.scale(sq, 2 - sq);
  S(c, '#8e44c9', 3, () => { c.moveTo(-20, 0); c.quadraticCurveTo(-26, -60, -6, -86); c.quadraticCurveTo(10, -100, 20, -80); c.quadraticCurveTo(26, -40, 22, 0); c.closePath(); });
  for (let i = 0; i < 4; i++) E(c, 14, -14 - i * 16, 4, 3.4, '#c79bec', 1.2);
  E(c, 2, -70, 13, 7, '#5b2589', 2);   // Lippen
  L(c, [-12, -84, 2, -78], 3.5, '#1b1020'); L(c, [8, -80, 18, -86], 3.5, '#1b1020');   // böse Brauen
  E(c, -6, -76, 4, 4.5, '#ffffff', 1.2); E(c, 12, -79, 4, 4.5, '#ffffff', 1.2); E(c, -4, -76, 2, 2.4, '#1b1020', 0); E(c, 14, -79, 2, 2.4, '#1b1020', 0);
  c.restore();
}
// Ladebildschirm (js/engine.js ruft ihn auf, solange G.screen === 'loading')
function drawLadebild() {
  const c = cx, t = G.t;
  c.fillStyle = grad(c, 0, 0, 0, H, [[0, '#090320'], [0.55, '#2a0f4a'], [0.85, '#5a1e62'], [1, '#2a0f3a']]); c.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) { const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.0012 + i * 1.7)); E(c, (i * 173) % W, (i * 97) % 330, 1.3, 1.3, `rgba(255,255,255,${a})`, 0); }
  if (!c.isPix) glowAt(c, 792, 120, 150, '#ffe8c0', 0.22);
  E(c, 792, 120, 52, 52, '#fff0c4', 3, 0, '#d8b070');
  for (const [x, y, r] of [[778, 104, 10], [812, 136, 8], [796, 142, 5]]) E(c, x, y, r, r * 0.8, 'rgba(226,196,140,0.55)', 0);
  P(c, [0, H, 0, 470, 160, 446, 340, 462, 520, 440, 700, 452, 960, 432, 960, H], '#1a0a2c', 0);   // Hügel
  villaSilhouette(c, t, 590, 470, 1.05);
  // Logo (wenn schon geladen), sonst Schriftzug
  if (!c.isPix && typeof LOGO_IMG !== 'undefined' && imgOk(LOGO_IMG)) {
    const w = 520, h = w * LOGO_IMG.naturalHeight / LOGO_IMG.naturalWidth, k = Math.min(1, t / 600), sc = 0.8 + 0.2 * (1 - Math.pow(1 - k, 3)) + Math.sin(t * 0.0021) * 0.01;
    c.save(); c.globalAlpha = k; c.translate(W / 2 - 110, 110); c.scale(sc, sc); c.drawImage(LOGO_IMG, -w / 2, -h / 2, w, h); c.restore();
  } else txt(c, 'TENTAKEL-TOAST', W / 2 - 110, 120, '400 52px "Titan One", sans-serif', '#ffd23a', 'center', 8, '#1b1020');
  // Verfolgungsjagd: der Toast flieht, der Lila Tentakel hüpft hinterher (Schleife über den Bildschirm)
  const per = 4200, q = (t % per) / per, bx = -80 + q * (W + 240), boden = 520;
  const hopT = Math.abs(Math.sin(t * 0.009)), hopL = Math.abs(Math.sin(t * 0.0075 + 0.8));
  E(c, bx, boden + 4, 30 - hopT * 10, 6, 'rgba(0,0,0,0.35)', 0);
  toastFigur(c, bx, boden - 26 - hopT * 34, 1 + (1 - hopT) * 0.08, -0.15 + Math.sin(t * 0.02) * 0.1);
  E(c, bx - 150, boden + 4, 28 - hopL * 8, 6, 'rgba(0,0,0,0.35)', 0);
  tentakelFigur(c, bx - 150, boden - hopL * 40, 1 + (1 - hopL) * 0.1, t);
  if (q > 0.1 && q < 0.9) txt(c, Math.floor(t / 900) % 2 ? 'AAAH!' : 'HILFE!', bx + 4, boden - 96 - hopT * 34, '400 18px "Titan One", sans-serif', '#ffffff', 'center', 4, '#1b1020');
  // Fortschrittsbalken und Tipp
  const p = ladeFortschritt(), bw = 360, bxx = W / 2 - bw / 2, by = 556;
  R(c, bxx - 4, by - 4, bw + 8, 26, 'rgba(10,4,20,0.7)', 3, 13, '#f1d6a0');
  if (p > 0.01) R(c, bxx, by, Math.max(18, bw * p), 18, grad(c, bxx, 0, bxx + bw, 0, [[0, '#ffd23a'], [1, '#ff8a2a']]), 0, 9);
  txt(c, `Lade … ${Math.round(p * 100)} %`, W / 2, by + 14, '800 13px "Baloo 2", sans-serif', '#1b1020', 'center');
  const tip = LADE_TIPPS[Math.floor(t / 2600) % LADE_TIPPS.length];
  txt(c, tip, W / 2, by - 16, '700 15px "Baloo 2", sans-serif', 'rgba(255,240,200,0.9)', 'center', 3, '#1b1020');
}

// ---------- Kino-Vorspann fürs Intro ----------
let kinoK = 0;
function drawKino() {
  const ziel = G.inIntro && G.screen === 'game' ? 1 : 0;
  kinoK += (ziel - kinoK) * 0.08;
  if (kinoK < 0.01) return;
  const h = 46 * kinoK, VB = typeof VH !== 'undefined' ? VH : SH;   // VB: Höhe der Szene (moderne Ansicht: ganzer Bildschirm)
  cx.save(); cx.fillStyle = '#05020a'; cx.fillRect(0, 0, W, h); cx.fillRect(0, VB - h, W, h);
  if (!cx.isPix) {   // weiche Vignette wie im Kino
    const vg = cx.createRadialGradient(W / 2, VB / 2, VB * 0.35, W / 2, VB / 2, W * 0.62);
    vg.addColorStop(0, 'rgba(5,2,10,0)'); vg.addColorStop(1, `rgba(5,2,10,${0.45 * kinoK})`);
    cx.fillStyle = vg; cx.fillRect(0, 0, W, VB);
  }
  cx.restore();
  const k = G.titelKarte; if (!k) return;
  const e = (G.t - k.t0) / k.dauer;
  if (e < 0 || e > 1) return;
  const ein = Math.min(1, e * 5), aus = Math.min(1, (1 - e) * 6), a = Math.min(ein, aus);
  cx.save(); cx.globalAlpha = a * (k.logo ? 0.82 : 0.6); cx.fillStyle = '#0a0414'; cx.fillRect(0, h, W, VB - 2 * h); cx.restore();
  cx.save(); cx.globalAlpha = a;
  const my = VB / 2;
  if (!k.logo) {   // Kapitelkarte: kleine Überschrift, Zierlinien, Text per Schreibmaschine
    const s = T(k.text), n = Math.floor(Math.max(0, e - 0.1) / 0.5 * s.length);
    txt(cx, k.kapitel || '', W / 2, my - 34, '800 18px "Baloo 2", sans-serif', '#ffd23a', 'center', 3, '#1b1020');
    L(cx, [W / 2 - 240, my - 18, W / 2 + 240, my - 18], 2, 'rgba(255,210,58,0.55)');
    txt(cx, s.slice(0, n), W / 2, my + 22, '400 34px "Titan One", sans-serif', '#ffe8b0', 'center', 6, '#1b1020');
    L(cx, [W / 2 - 240, my + 46, W / 2 + 240, my + 46], 2, 'rgba(255,210,58,0.55)');
    cx.restore(); return;
  }
  if (!cx.isPix && typeof LOGO_IMG !== 'undefined' && imgOk(LOGO_IMG)) {
    const w = 560, lh = w * LOGO_IMG.naturalHeight / LOGO_IMG.naturalWidth, z = 0.7 + 0.3 * (1 - Math.pow(1 - ein, 3)) + e * 0.06;
    cx.save(); cx.translate(W / 2, my - 40); cx.scale(z, z); cx.rotate(Math.sin(G.t * 0.002) * 0.015); cx.drawImage(LOGO_IMG, -w / 2, -lh / 2, w, lh); cx.restore();
  } else txt(cx, 'TENTAKEL-TOAST', W / 2, my - 30, '400 60px "Titan One", sans-serif', '#ffd23a', 'center', 8, '#1b1020');
  const s = T(k.text), n = Math.floor(Math.max(0, e - 0.18) / 0.45 * s.length);   // Schreibmaschine
  txt(cx, s.slice(0, n), W / 2, my + 92, '400 26px "Titan One", sans-serif', '#ffe8b0', 'center', 5, '#1b1020');
  cx.restore();
}
{
  const signOrig = drawSign;   // Kinobalken unter die Sprechblasen legen: drawSign kommt direkt vor Bark und Sprechblasen
  drawSign = function () { signOrig(); drawKino(); };
  const capOrig = drawCaption;   // im Intro: Kino-Untertitel statt Kasten
  drawCaption = function (y) {
    if (!G.caption || !G.inIntro) return capOrig(y);
    if (G._capText !== G.caption) { G._capText = G.caption; G._capT = G.t; }
    const s = T(G.caption), e = Math.min(1, (G.t - G._capT) / 450);
    cx.save(); cx.globalAlpha = e;
    const yy = (typeof VH !== 'undefined' ? VH : SH) - 46 * kinoK - 18;
    L(cx, [W / 2 - 220, yy - 34, W / 2 - 40, yy - 34], 2, 'rgba(255,210,58,0.6)'); L(cx, [W / 2 + 40, yy - 34, W / 2 + 220, yy - 34], 2, 'rgba(255,210,58,0.6)');
    E(cx, W / 2, yy - 34, 4, 4, '#ffd23a', 0);
    txt(cx, s, W / 2, yy, '400 24px "Titan One", sans-serif', '#ffe8b0', 'center', 5, '#1b1020');
    cx.restore();
  };
}
