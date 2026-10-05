'use strict';
// ============================================================
//  Tentakel-Toast – Zeichenhelfer, Figuren und Inventar-Icons
//  Alles wird prozedural auf das Canvas gezeichnet.
// ============================================================

const W = 960, H = 600, SH = 440;   // logische Auflösung, SH = Szenenhöhe
const OUT = '#1b1020';               // Konturfarbe (dicke Cartoon-Linien)

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(typeof r === 'number' ? r : (r && r[0]) || 0, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
  };
}

if (typeof Path2D !== 'undefined' && !Path2D.prototype.roundRect) Path2D.prototype.roundRect = CanvasRenderingContext2D.prototype.roundRect;

function pth(c, p) { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); }
// HD-Feinschliff: einfarbige Flächen bekommen einen Licht-Verlauf (oben hell, unten dunkler),
// Konturen die abgedunkelte Flächenfarbe statt Schwarz – weg vom flachen Malprogramm-Look.
// Für Raum-Grafik (HDS.deco) zusätzlich: leicht handgezeichnete Kanten, Fasen, Holzmaserung
// und – beim einmaligen Zeichnen der Hintergründe (HDS.shadow) – weiche Schlagschatten.
// Der Pixel-Modus (c.isPix) schattiert selbst und bleibt unberührt.
const HDS = { on: true, deco: false, shadow: false, scale: 2 };
const shadeMemo = new Map();
function shadeOf(col) {
  let s = shadeMemo.get(col);
  if (!s) {
    const h = col.length === 4 ? '#' + col[1] + col[1] + col[2] + col[2] + col[3] + col[3] : col;
    const [r, g, b] = hexToRgb(h).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let hue = 0;
    if (d) hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue = (hue * 60 + 360) % 360;
    s = [mix(h, '#fff6e6', 0.17), h, mix(h, '#160a1e', 0.24), mix(h, '#160a1e', 0.64)];
    s.wood = hue >= 12 && hue <= 46 && sat >= 0.2 && sat <= 0.9 && l >= 0.12 && l <= 0.56;
    shadeMemo.set(col, s);
  }
  return s;
}
const isHex = f => typeof f === 'string' && f[0] === '#' && (f.length === 7 || f.length === 4);
function shadeFill(c, fill, box) {
  if (box && (box[3] - box[1] > 5 || box[2] - box[0] > 5)) {
    const s = shadeOf(fill), g = c.createLinearGradient(box[0], box[1], box[0] + (box[2] - box[0]) * 0.25, box[3]);
    g.addColorStop(0, s[0]); g.addColorStop(0.45, s[1]); g.addColorStop(1, s[2]);
    return g;
  }
  return fill;
}
function fs(c, fill, lw, stroke, box) {
  const hd = HDS.on && !c.isPix && isHex(fill);
  if (fill) { c.fillStyle = hd ? shadeFill(c, fill, box) : fill; c.fill(); }
  if (lw) {
    c.lineWidth = hd && !stroke ? lw * 0.82 : lw;
    c.strokeStyle = stroke || (hd ? shadeOf(fill)[3] : OUT);
    c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke();
  }
}
// Holzmaserung als kachelbares Graustufen-Muster (wird per multiply aufgetragen)
let woodTex = null;
function woodCanvas() {
  if (woodTex) return woodTex;
  const n = 256, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 54; i++) {
    const y0 = Math.random() * n, amp = 1.5 + Math.random() * 5, k = 1 + Math.floor(Math.random() * 3), ph = Math.random() * 6.3;
    const v = 140 + Math.floor(Math.random() * 100);
    g.strokeStyle = `rgb(${v},${v - 8},${v - 18})`; g.lineWidth = 0.6 + Math.random() * 2;
    for (const oy of [-n, 0, n]) {
      g.beginPath();
      for (let x = 0; x <= n; x += 4) { const y = y0 + oy + Math.sin(x / n * Math.PI * 2 * k + ph) * amp + Math.sin(x / n * Math.PI * 2 * (k + 2) + ph * 2) * amp * 0.3; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    }
  }
  for (let i = 0; i < 3; i++) {   // Astlöcher
    const x = 30 + Math.random() * 196, y = 30 + Math.random() * 196;
    for (let r = 2; r < 12; r += 2.5) { g.strokeStyle = `rgba(110,90,70,${0.5 - r / 30})`; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, r * 2.2, r * 0.8, 0, 0, Math.PI * 2); g.stroke(); }
  }
  return (woodTex = c);
}
// handgezeichnete Kante: Zwischenpunkte leicht versetzt, Ecken bleiben, damit Formen sauber aneinanderstoßen
function wobblePoly(t, pts) {
  const n = pts.length / 2;
  t.moveTo(pts[0], pts[1]);
  for (let i = 0; i < n; i++) {
    const x0 = pts[i * 2], y0 = pts[i * 2 + 1], x1 = pts[((i + 1) % n) * 2], y1 = pts[((i + 1) % n) * 2 + 1];
    const len = Math.hypot(x1 - x0, y1 - y0), segs = Math.max(1, Math.min(8, Math.round(len / 34)));
    const nx = -(y1 - y0) / (len || 1), ny = (x1 - x0) / (len || 1), amp = Math.min(0.75, len * 0.009);
    for (let j = 1; j <= segs; j++) {
      const k = j / segs, off = j === segs ? 0 : Math.sin(len * 0.37 + j * 2.399) * amp;
      t.lineTo(x0 + (x1 - x0) * k + nx * off, y0 + (y1 - y0) * k + ny * off);
    }
  }
  t.closePath();
}
const woodPats = new WeakMap();
function woodPat(c) { let p = woodPats.get(c); if (!p) { p = c.createPattern(woodCanvas(), 'repeat'); woodPats.set(c, p); } return p; }
function deco(c) { return HDS.on && HDS.deco && !c.isPix && typeof Path2D !== 'undefined'; }
function fsDeco(c, path, fill, lw, stroke, box) {
  const hex = isHex(fill), w = box[2] - box[0], h = box[3] - box[1];
  if (fill) {
    c.fillStyle = hex ? shadeFill(c, fill, box) : fill;
    if (HDS.shadow && hex && (w > 6 || h > 6)) {
      c.save(); const k = HDS.scale;
      c.shadowColor = 'rgba(12,2,24,0.32)'; c.shadowBlur = 7 * k; c.shadowOffsetX = 1.4 * k; c.shadowOffsetY = 2.8 * k;
      c.fill(path); c.restore();
    } else c.fill(path);
    // im laufenden Bild (nicht im Hintergrund-Cache) nur größere Flächen veredeln – spart Zeit
    const minSz = HDS.shadow ? 14 : 26;
    if (hex && w > minSz && h > minSz) {
      c.save(); c.clip(path);
      if (shadeOf(fill).wood && (HDS.shadow || w * h > 2600)) {
        const pat = woodPat(c), tall = h > w * 1.2;
        if (pat.setTransform) pat.setTransform(new DOMMatrix().translate(box[0] + (box[1] * 7) % 97, box[1]).rotate(tall ? 90 : 0).scale(tall ? 0.55 : 0.5, 0.5));
        c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.55; c.fillStyle = pat; c.fillRect(box[0] - 2, box[1] - 2, w + 4, h + 4);
        c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      }
      // Fase: dunkle Kante unten rechts, helle oben links
      const bw = Math.min(5, Math.min(w, h) * 0.18);
      c.lineWidth = bw; c.lineJoin = 'round';
      c.translate(-bw * 0.45, -bw * 0.55); c.strokeStyle = 'rgba(16,4,26,0.26)'; c.stroke(path);
      c.translate(bw * 0.9, bw * 1.1); c.strokeStyle = 'rgba(255,248,232,0.22)'; c.stroke(path);
      c.restore();
    }
  }
  if (lw) {
    c.lineWidth = hex && !stroke ? lw * 0.82 : lw;
    c.strokeStyle = stroke || (hex ? shadeOf(fill)[3] : OUT);
    c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(path);
  }
}
function P(c, pts, fill, lw = 3, stroke) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) { const x = pts[i], y = pts[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (deco(c)) { const p = new Path2D(); wobblePoly(p, pts); return fsDeco(c, p, fill, lw, stroke, [x0, y0, x1, y1]); }
  pth(c, pts);
  fs(c, fill, lw, stroke, [x0, y0, x1, y1]);
}
function R(c, x, y, w, h, fill, lw = 3, r = 0, stroke) {
  if (deco(c)) {
    const p = new Path2D();
    if (r) p.roundRect(x, y, w, h, r); else wobblePoly(p, [x, y, x + w, y, x + w, y + h, x, y + h]);
    return fsDeco(c, p, fill, lw, stroke, [x, y, x + w, y + h]);
  }
  c.beginPath(); if (r) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); fs(c, fill, lw, stroke, [x, y, x + w, y + h]);
}
function E(c, x, y, rx, ry, fill, lw = 3, rot = 0, stroke) {
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (deco(c)) { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); return fsDeco(c, p, fill, lw, stroke, [x - rx, y - ry, x + rx, y + ry]); }
  c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); fs(c, fill, lw, stroke, [x - rx, y - ry, x + rx, y + ry]);
}
function L(c, pts, lw = 3, stroke) {
  c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.lineWidth = lw; c.strokeStyle = stroke || OUT; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
}
function S(c, fill, lw, fn, stroke) { c.beginPath(); fn(); fs(c, fill, lw, stroke); }
function grad(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; }
function txt(c, s, x, y, font, col, align = 'center', stroke = 0, strokeCol = OUT) {
  c.font = font; c.textAlign = align; c.textBaseline = 'alphabetic';
  if (stroke) { c.lineWidth = stroke; c.strokeStyle = strokeCol; c.lineJoin = 'round'; c.strokeText(s, x, y); }
  c.fillStyle = col; c.fillText(s, x, y);
}
function heart(c, x, y, s, col, lw = 2) {
  S(c, col, lw, () => {
    c.moveTo(x, y + s * 0.9);
    c.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.7, y - s * 1.4, x, y - s * 0.45);
    c.bezierCurveTo(x + s * 0.7, y - s * 1.4, x + s * 1.6, y - s * 0.2, x, y + s * 0.9);
    c.closePath();
  });
}
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, k) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
}

// Bein/Arm als gedrehtes Rechteck um den Drehpunkt (Hüfte/Schulter)
function limb(c, px, py, w, len, ang, fill, foot) {
  c.save(); c.translate(px, py); c.rotate(ang);
  R(c, -w / 2, 0, w, len, fill, 3, w / 2.2);
  if (foot) E(c, foot.dx || 6, len, foot.l, foot.h || 6, foot.fill, 3);
  c.restore();
}
function arm(c, px, py, ang, sleeve, sleeveLen, skin, len, w, hand = 5.5) {
  c.save(); c.translate(px, py); c.rotate(ang);
  R(c, -w / 2, 0, w, len, skin, 3, w / 2.2);
  if (sleeve) R(c, -w / 2 - 1.5, -2, w + 3, sleeveLen, sleeve, 3, 4);
  E(c, 0, len + 2, hand, hand, skin, 3);
  c.restore();
}
function mouthOpen(a, t) { return !!a.talking && Math.floor(t / 115) % 2 === 0; }
function blinking(a, t) { return ((t + (a.seed || 0) * 1777) % 3900) < 130; }
// Pupille – oder ein geschlossenes Lid, wenn die Figur gerade blinzelt
function pupil(c, a, t, x, y, r) { if (blinking(a, t)) L(c, [x - r * 2.2, y, x + r * 2.2, y], 2.2); else E(c, x, y, r, r * 1.15, OUT, 0); }
function swing(a) { return a.walking ? Math.sin(a.phase) : 0; }
function bobY(a, t) { return a.walking ? -Math.abs(Math.cos(a.phase)) * 3 : Math.sin(t * 0.002 + (a.seed || 0)) * 0.7; }

// ------------------------------------------------------------
//  Figuren – Füße liegen bei (0,0), Blickrichtung nach rechts
// ------------------------------------------------------------
const CHAR = {};

CHAR.bernard = (c, a, t) => {
  const sw = swing(a), b = bobY(a, t), mo = mouthOpen(a, t);
  const skin = '#f3c9a1', shirt = '#f3f0e2', pants = '#7b5634', pantsB = '#664629', shoe = '#2b2320';
  limb(c, -4, -88, 13, 82, -sw * 0.42, pantsB, { l: 13, h: 6, dx: 7, fill: shoe });
  c.save(); c.translate(0, b); arm(c, -5, -144, 0.12 - sw * 0.45, shirt, 18, skin, 50, 9); c.restore();
  limb(c, 5, -88, 13, 82, sw * 0.42, pants, { l: 13, h: 6, dx: 7, fill: shoe });
  c.save(); c.translate(0, b);
  P(c, [-14, -84, 15, -84, 18, -148, -15, -150], shirt);
  R(c, -15, -93, 31, 8, '#4a2e18', 2.5, 2);
  R(c, 5, -137, 9, 13, '#5aa0e6', 2, 2);
  L(c, [7.5, -139, 7.5, -133], 2, '#d33'); L(c, [11, -140, 11, -133], 2, '#223');
  R(c, -3, -165, 9, 18, skin, 3, 3);
  P(c, [-8, -151, 2, -143, 11, -151, 2, -155], '#fff', 2);
  E(c, 5, -185, 20, 25, skin);
  E(c, -10, -183, 5, 7, skin, 2.5);
  S(c, '#6b3f1f', 3, () => {
    c.moveTo(-15, -186); c.quadraticCurveTo(-19, -214, 3, -213); c.quadraticCurveTo(25, -213, 25, -196);
    c.quadraticCurveTo(14, -205, 7, -198); c.quadraticCurveTo(-3, -206, -9, -190); c.closePath();
  });
  E(c, 12, -189, 7.5, 7.5, '#eaf5ff'); E(c, 27, -189, 7.5, 7.5, '#eaf5ff');
  L(c, [4.5, -189, -8, -187], 2.5);
  pupil(c, a, t, 14, -188, 2); pupil(c, a, t, 29, -188, 2);
  E(c, 29, -177, 8, 6.5, '#efb48c');
  if (mo) E(c, 18, -165, 5, 4, '#7a2222', 2); else L(c, [12, -165, 22, -166], 2.5);
  arm(c, 7, -144, -0.12 + sw * 0.45, shirt, 18, skin, 50, 9);
  c.restore();
};

CHAR.hoagie = (c, a, t) => {
  const sw = swing(a), b = bobY(a, t), mo = mouthOpen(a, t);
  const skin = '#e9b088', shirt = '#26232c', jeans = '#3d5fa6', jeansB = '#34518e', boot = '#3a2416', hair = '#1d1a1e';
  limb(c, -10, -70, 20, 64, -sw * 0.35, jeansB, { l: 16, h: 8, dx: 6, fill: boot });
  c.save(); c.translate(0, b); arm(c, -22, -126, 0.1 - sw * 0.4, shirt, 16, skin, 44, 15, 8); c.restore();
  limb(c, 10, -70, 20, 64, sw * 0.35, jeans, { l: 16, h: 8, dx: 6, fill: boot });
  c.save(); c.translate(0, b);
  R(c, -24, -82, 50, 18, jeans, 3, 7);
  S(c, hair, 3, () => { c.moveTo(-14, -168); c.quadraticCurveTo(-36, -150, -30, -110); c.lineTo(-8, -114); c.quadraticCurveTo(-10, -140, 2, -150); c.closePath(); });
  E(c, 4, -106, 38, 42, shirt);
  E(c, 10, -66, 15, 4.5, skin, 2);
  P(c, [-2, -126, 14, -126, 5, -110, 16, -110, -6, -86, 1, -104, -10, -104], '#f2f2f2', 2);
  E(c, 8, -151, 22, 22, skin);
  E(c, 15, -140, 15, 9, 'rgba(70,45,45,0.22)', 0);
  S(c, '#c8322e', 3, () => { c.moveTo(-15, -158); c.quadraticCurveTo(-12, -184, 10, -183); c.quadraticCurveTo(30, -182, 29, -160); c.closePath(); });
  P(c, [-13, -162, -36, -157, -34, -150, -11, -155], '#9e2420');
  L(c, [12, -182, 12, -161], 2, '#9e2420');
  pupil(c, a, t, 18, -154, 2.3); pupil(c, a, t, 27, -154, 2.3);
  L(c, [13, -160, 21, -161], 3); L(c, [24, -161, 31, -159], 3);
  E(c, 30, -147, 6.5, 5, '#df9a72');
  if (mo) E(c, 20, -136, 7, 5, '#6e1f1f', 2.5);
  else S(c, null, 2.5, () => { c.moveTo(12, -139); c.quadraticCurveTo(20, -132, 28, -139); });
  arm(c, 24, -126, -0.1 + sw * 0.4, shirt, 16, skin, 44, 15, 8);
  c.restore();
};

function stocking(c, px, py, ang, back) {
  c.save(); c.translate(px, py); c.rotate(ang);
  R(c, -4.5, 0, 9, 74, back ? '#e8e0e0' : '#f6f0f0', 0, 4);
  c.save(); c.beginPath(); c.roundRect(-4.5, 0, 9, 74, 4); c.clip();
  c.fillStyle = back ? '#b42a3a' : '#d8344a';
  for (let y = 6; y < 74; y += 12) c.fillRect(-6, y, 12, 5);
  c.restore();
  R(c, -4.5, 0, 9, 74, null, 3, 4);
  E(c, 6, 74, 11, 5.5, '#1e1a22', 3);
  c.restore();
}

CHAR.laverne = (c, a, t) => {
  const sw = swing(a), b = bobY(a, t), mo = mouthOpen(a, t);
  const skin = '#f7e0cd', dress = '#3e9e5e', dressB = '#348650', hair = '#18141d';
  stocking(c, -4, -80, -sw * 0.45, true);
  c.save(); c.translate(0, b); arm(c, -5, -138, 0.15 - sw * 0.45, dressB, 36, skin, 48, 8); c.restore();
  stocking(c, 5, -80, sw * 0.45, false);
  c.save(); c.translate(0, b);
  P(c, [-6, -186, -26, -196, -20, -178, -34, -170, -20, -160, -30, -146, -12, -150, -4, -140, 6, -160], hair);
  P(c, [-13, -142, 13, -142, 25, -74, -23, -74], dress);
  L(c, [-20, -84, 22, -84], 2, '#2f7a48');
  R(c, -2, -158, 8, 16, skin, 3, 3);
  E(c, 6, -168, 17, 20, skin);
  P(c, [-12, -176, -14, -196, -2, -188, 2, -208, 10, -190, 20, -204, 22, -186, 32, -190, 24, -176, 14, -182, 4, -178], hair);
  if (blinking(a, t)) { E(c, 13, -170, 5.5, 6.5, skin, 2.5); E(c, 25, -170, 5, 6.5, skin, 2.5); L(c, [8, -170, 18, -170], 2.2); L(c, [21, -170, 30, -170], 2.2); }
  else { E(c, 13, -170, 5.5, 6.5, '#fff', 2.5); E(c, 25, -170, 5, 6.5, '#fff', 2.5); E(c, 15, -169, 2, 2.2, OUT, 0); E(c, 27, -169, 2, 2.2, OUT, 0); }
  E(c, 26, -159, 3.5, 3, '#efc4ac', 2);
  if (mo) E(c, 18, -151, 4, 3.5, '#7a2222', 2); else L(c, [14, -151, 21, -152], 2.5);
  arm(c, 6, -138, -0.15 + sw * 0.45, dress, 36, skin, 48, 8);
  c.restore();
};

CHAR.drfred = (c, a, t) => {
  const sw = swing(a), b = bobY(a, t), mo = mouthOpen(a, t);
  const skin = '#f0c6a0', coat = '#f4f4f2', hairW = '#ffffff';
  limb(c, -5, -64, 11, 58, -sw * 0.4, '#30303e', { l: 13, h: 5.5, dx: 6, fill: '#1d1d1d' });
  limb(c, 5, -64, 11, 58, sw * 0.4, '#3a3a4a', { l: 13, h: 5.5, dx: 6, fill: '#1d1d1d' });
  c.save(); c.translate(0, b); c.rotate(0.08);
  arm(c, -8, -118, 0.25 - sw * 0.3, coat, 40, skin, 46, 10);
  P(c, [-18, -124, 14, -126, 26, -40, -26, -38], coat);
  L(c, [2, -124, 8, -42], 2);
  R(c, 8, -110, 10, 12, '#e6e6e6', 2, 2);
  L(c, [11, -112, 11, -104], 2, '#3a7ad8');
  E(c, -8, -150, 11, 9, hairW); E(c, -11, -136, 10, 8, hairW); E(c, -2, -162, 9, 7, hairW);
  E(c, 10, -142, 20, 22, skin);
  E(c, 4, -157, 9, 4.5, 'rgba(255,255,255,0.4)', 0);
  E(c, 16, -148, 8, 8, '#d7f0ff', 4); E(c, 31, -148, 8, 8, '#d7f0ff', 4);
  pupil(c, a, t, 17, -147, 3); pupil(c, a, t, 32, -147, 3);
  E(c, 35, -137, 9, 6.5, '#e9a888');
  if (mo) E(c, 25, -126, 6, 4.5, '#6a1a1a', 2); else L(c, [19, -127, 29, -126], 2.5);
  arm(c, 8, -118, -0.2 + sw * 0.3, coat, 40, skin, 46, 10);
  c.restore();
};

CHAR.gertrude = (c, a, t) => {
  const b = bobY(a, t), mo = mouthOpen(a, t), sw = swing(a);
  const skin = '#f5c9a6';
  c.save(); c.translate(0, b);
  S(c, '#3d6fb6', 3, () => {
    c.moveTo(-18, -92); c.quadraticCurveTo(-34 - sw * 3, -40, -42, 0); c.lineTo(44, 0);
    c.quadraticCurveTo(34 + sw * 3, -40, 18, -92); c.closePath();
  });
  P(c, [-2, -92, 18, -92, 30, -8, 0, -8], '#f6f2e6', 2.5);
  arm(c, -10, -134, 0.2, '#f6f2e6', 16, skin, 44, 9);
  P(c, [-16, -90, 18, -90, 16, -140, -14, -140], '#7a4a2a');
  P(c, [-14, -140, 16, -140, 2, -118], '#f6f2e6', 2);
  R(c, -2, -152, 9, 14, skin, 3, 3);
  E(c, -2, -166, 21, 18, '#ffffff');
  E(c, 5, -160, 17, 19, skin);
  E(c, 2, -176, 21, 9, '#ffffff');
  E(c, 17, -153, 5, 3.5, 'rgba(240,120,130,0.6)', 0);
  pupil(c, a, t, 12, -163, 2.1); pupil(c, a, t, 22, -163, 2.1);
  E(c, 24, -156, 4, 3.5, '#eeb090', 2);
  if (mo) E(c, 17, -147, 5, 4, '#7a2222', 2);
  else S(c, null, 2.5, () => { c.moveTo(12, -149); c.quadraticCurveTo(17, -145, 22, -149); });
  arm(c, 10, -134, -0.3, '#f6f2e6', 16, skin, 44, 9);
  c.restore();
};

CHAR.hancock = (c, a, t) => {
  const sw = swing(a), b = bobY(a, t), mo = mouthOpen(a, t);
  const skin = '#f2c4a0', coat = '#2f4f8f', vest = '#e8d9b0';
  limb(c, -4, -82, 11, 76, -sw * 0.4, '#e6e0d2', { l: 13, h: 5.5, dx: 6, fill: '#1d1d1d' });
  limb(c, 5, -82, 11, 76, sw * 0.4, '#f6f2e8', { l: 13, h: 5.5, dx: 6, fill: '#1d1d1d' });
  c.save(); c.translate(0, b);
  R(c, -14, -96, 31, 24, vest, 3, 7);
  P(c, [-12, -142, -32, -54, -10, -60, 2, -120], coat);
  P(c, [-12, -142, 16, -142, 18, -88, -12, -88], vest);
  P(c, [-14, -144, 2, -144, -4, -84, -16, -88], coat);
  P(c, [10, -144, 20, -142, 24, -88, 14, -90], coat);
  for (let i = 0; i < 3; i++) E(c, 8, -130 + i * 14, 2, 2, '#d8b040', 1);
  E(c, 6, -138, 6, 8, '#fff', 2);
  R(c, -2, -152, 9, 12, skin, 3, 3);
  S(c, '#f4f4f4', 3, () => { c.moveTo(-10, -166); c.quadraticCurveTo(-30, -158, -26, -136); c.lineTo(-18, -138); c.quadraticCurveTo(-20, -154, -6, -160); c.closePath(); });
  E(c, -23, -144, 5, 4, '#1d1d1d', 2);
  E(c, 4, -160, 17, 20, skin);
  E(c, -9, -158, 7, 6, '#f4f4f4', 2.5); E(c, -9, -147, 7, 6, '#f4f4f4', 2.5);
  E(c, 2, -174, 16, 8, '#f4f4f4', 2.5);
  P(c, [-24, -176, 30, -176, 22, -186, 4, -199, -14, -187], '#1d1d1d');
  L(c, [-22, -177, 28, -177], 2, '#d8b040');
  pupil(c, a, t, 12, -163, 2.1); pupil(c, a, t, 22, -163, 2.1);
  E(c, 25, -155, 5, 4, '#e9aa88', 2);
  if (mo) E(c, 17, -146, 5, 4, '#7a2222', 2); else L(c, [12, -147, 21, -147], 2.5);
  c.save(); c.translate(12, -138);
  c.rotate(-0.5 + (a.talking ? Math.sin(t * 0.01) * 0.15 : Math.sin(t * 0.004) * 0.08));
  R(c, -5, 0, 10, 40, coat, 3, 5); R(c, -6, 34, 12, 8, '#fff', 2, 3); E(c, 0, 46, 6, 6, skin);
  c.save(); c.translate(0, 46); c.rotate(-0.9);
  S(c, '#fffdf4', 2.5, () => { c.moveTo(0, 0); c.quadraticCurveTo(14, -30, 6, -64); c.quadraticCurveTo(-8, -34, 0, 0); c.closePath(); });
  L(c, [0, 0, 6, -60], 1.5, '#b8b0a0');
  c.restore(); c.restore();
  c.restore();
};

// ---------- Tentakel ----------
function tentacleBody(c, a, t, col, dark, lite, o = {}) {
  const h = o.h || 150;
  const hop = a.walking ? Math.abs(Math.sin(a.phase)) * 14 : 0;
  const sway = (o.still ? 0 : Math.sin(t * 0.0025 + (a.seed || 0)) * 4) + (a.walking ? Math.sin(a.phase) * 5 : 0);
  c.save(); c.translate(0, -hop);
  if (o.back) o.back(sway, h);
  S(c, col, 3, () => {
    c.moveTo(-24, 0);
    c.bezierCurveTo(-30, -h * 0.35, -26 + sway * 0.5, -h * 0.7, -14 + sway, -h + 8);
    c.bezierCurveTo(-8 + sway, -h - 10, 16 + sway, -h - 12, 22 + sway, -h + 10);
    c.bezierCurveTo(26 + sway, -h * 0.62, 20 + sway * 0.3, -h * 0.3, 30, -10);
    c.quadraticCurveTo(48, -6, 42, 3);
    c.quadraticCurveTo(10, 7, -24, 0);
    c.closePath();
  });
  S(c, 'rgba(255,255,255,0.18)', 0, () => {
    c.moveTo(-14 + sway * 0.8, -h + 14); c.quadraticCurveTo(-20 + sway * 0.4, -h * 0.55, -16, -h * 0.25);
    c.lineTo(-10, -h * 0.25); c.quadraticCurveTo(-12 + sway * 0.4, -h * 0.55, -6 + sway * 0.8, -h + 12); c.closePath();
  });
  for (let i = 0; i < 5; i++) {
    const u = 0.08 + i * 0.12;
    const x = 30 + (22 + sway - 30) * u - 6, y = -10 + (-h + 20) * u;
    E(c, x, y, 5.5 - i * 0.5, 4.4 - i * 0.4, lite, 2);
    E(c, x, y, 2 - i * 0.15, 1.6, dark, 0);
  }
  const u = 0.78, mx = 30 + (22 + sway - 30) * u + 6, my = -10 + (-h + 20) * u;
  const open = a.talking && Math.floor(t / 110) % 2 === 0;
  E(c, mx, my, 12, open ? 10.5 : 7.5, dark, 3);
  E(c, mx + 2, my, 6.5, open ? 6.5 : 2.2, OUT, 0);
  E(c, mx - 4, my - 4, 4, 1.8, 'rgba(255,255,255,0.35)', 0);
  if (o.front) o.front(sway, h);
  c.restore();
}
function tArm(c, x, y, ang, col, len = 30) {
  c.save(); c.translate(x, y); c.rotate(ang);
  S(c, col, 3, () => { c.moveTo(0, -6); c.quadraticCurveTo(len * 0.6, -13, len, -4); c.lineTo(len, 5); c.quadraticCurveTo(len * 0.6, -1, 0, 7); c.closePath(); });
  E(c, len + 5, 0, 8, 7, col, 3);
  L(c, [len + 6, -3, len + 9, -5], 2); L(c, [len + 7, 2, len + 11, 2], 2);
  c.restore();
}
CHAR.green = (c, a, t) => tentacleBody(c, a, t, '#4fbf3a', '#2c7a1f', '#b4ef98', { h: 145 });
CHAR.purple = (c, a, t) => {
  const nice = a.nice ? Math.max(0, Math.min(1, (t - a.nice) / 1200)) : 0;
  const col = mix('#8e44c9', '#ef7fc4', nice), dark = mix('#5b2589', '#b5407f', nice);
  const wave = a.talking ? Math.sin(t * 0.012) * 0.35 : Math.sin(t * 0.003) * 0.1;
  tentacleBody(c, a, t, col, dark, '#d9b2f2', {
    h: 165,
    back: (sw, h) => tArm(c, -14 + sw * 0.4, -h * 0.5, -2.6 - wave, dark, 30),
    front: (sw, h) => tArm(c, 18 + sw * 0.4, -h * 0.48, -0.5 + wave, col, 32),
  });
  if (nice > 0) for (let i = 0; i < 4; i++) {
    const k = ((t * 0.0006 + i * 0.25) % 1);
    c.globalAlpha = 1 - k;
    heart(c, -20 + i * 16 + Math.sin(t * 0.004 + i) * 6, -180 - k * 70, 7, '#ff5fa8');
    c.globalAlpha = 1;
  }
};
CHAR.guard = (c, a, t) => {
  tentacleBody(c, a, t, '#e07a2f', '#9a4a15', '#ffc690', {
    h: 158,
    back: (sw, h) => {
      L(c, [-36, 2, 4 + sw * 0.6, -h - 58], 8, OUT); L(c, [-36, 2, 4 + sw * 0.6, -h - 58], 4, '#9a6a3a');
      P(c, [-4 + sw * 0.6, -h - 52, 6 + sw * 0.6, -h - 86, 14 + sw * 0.6, -h - 50], '#c8d0d8');
    },
    front: (sw, h) => {
      S(c, '#a9b2bc', 3, () => { c.moveTo(-17 + sw, -h + 4); c.quadraticCurveTo(4 + sw, -h - 34, 25 + sw, -h + 6); c.closePath(); });
      L(c, [-14 + sw, -h + 2, 22 + sw, -h + 4], 3);
      P(c, [1 + sw, -h - 18, 5 + sw, -h - 34, 9 + sw, -h - 18], '#d8b040', 2.5);
    },
  });
};

// Graue Statue von Lila (für den Zukunftsgarten)
function drawStatue(c) {
  const a = { talking: false, walking: false, phase: 0, seed: 0 };
  tentacleBody(c, a, 0, '#bdb5cc', '#8a829c', '#dcd6e6', {
    h: 165, still: true,
    back: (sw, h) => tArm(c, -14, -h * 0.5, -2.4, '#9a92ac', 30),
    front: (sw, h) => tArm(c, 18, -h * 0.5, -1.2, '#bdb5cc', 34),
  });
}

// ---------- Portraits (Köpfe in den Charakter-Buttons) ----------
const PORTRAIT = { bernard: [8, -186, 0.86], hoagie: [8, -154, 0.92], laverne: [8, -176, 0.82] };
function drawPortrait(c, id, x, y, r, bg) {
  c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
  c.fillStyle = bg; c.fillRect(x - r, y - r, r * 2, r * 2);
  const [hx, hy, s] = PORTRAIT[id];
  c.translate(x - hx * s, y - hy * s + 6); c.scale(s, s);
  CHAR[id](c, { talking: false, walking: false, phase: 0, seed: 1 }, 0);
  c.restore();
}
// Pokal-Symbol für Erfolge
function trophy(c, x, y, s = 1) {
  c.save(); c.translate(x, y); c.scale(s, s);
  S(c, '#ffd23a', 2.5, () => { c.moveTo(-10, -12); c.lineTo(10, -12); c.quadraticCurveTo(10, 4, 0, 6); c.quadraticCurveTo(-10, 4, -10, -12); c.closePath(); });
  S(c, null, 2.5, () => { c.moveTo(-10, -8); c.quadraticCurveTo(-17, -8, -15, -1); c.quadraticCurveTo(-13, 3, -7, 2); });
  S(c, null, 2.5, () => { c.moveTo(10, -8); c.quadraticCurveTo(17, -8, 15, -1); c.quadraticCurveTo(13, 3, 7, 2); });
  R(c, -2, 6, 4, 5, '#ffd23a', 2); R(c, -7, 11, 14, 4, '#ffd23a', 2, 1);
  c.restore();
}

// ---------- Inventar-Icons (gezeichnet um 0,0 in ca. 56x50) ----------
function stick(c, ang, col) {
  c.save(); c.rotate(ang); R(c, -3, -22, 6, 44, col, 2.5, 3); E(c, 0, -22, 4, 4, col, 2.5); c.restore();
}
function cube(c, x, y) {
  P(c, [x - 7, y - 3, x, y - 7, x + 7, y - 3, x, y + 1], '#ffffff', 2);
  P(c, [x - 7, y - 3, x, y + 1, x, y + 9, x - 7, y + 5], '#e6e6ee', 2);
  P(c, [x + 7, y - 3, x, y + 1, x, y + 9, x + 7, y + 5], '#cfd0dc', 2);
}
function apple(c, col) {
  S(c, col, 3, () => {
    c.moveTo(0, -10); c.bezierCurveTo(10, -18, 22, -6, 16, 8); c.bezierCurveTo(12, 18, 4, 18, 0, 14);
    c.bezierCurveTo(-4, 18, -12, 18, -16, 8); c.bezierCurveTo(-22, -6, -10, -18, 0, -10); c.closePath();
  });
  E(c, -6, -3, 4, 6, 'rgba(255,255,255,0.45)', 0, -0.4);
  L(c, [0, -10, 2, -20], 2.5, '#5a3a1e');
  S(c, '#4fb43a', 2, () => { c.moveTo(2, -16); c.quadraticCurveTo(10, -24, 14, -16); c.quadraticCurveTo(8, -12, 2, -16); c.closePath(); });
}
function bucket(c, water) {
  S(c, null, 2.5, () => { c.moveTo(-14, -10); c.quadraticCurveTo(0, -30, 14, -10); });
  P(c, [-16, -10, 16, -10, 12, 18, -12, 18], '#b07a3c');
  L(c, [-15, -3, 15, -3], 2.5); L(c, [-13, 11, 13, 11], 2.5);
  E(c, 0, -10, 16, 4, water ? '#4aa8f0' : '#5a3a1e', 2.5);
}
const ICON = {
  rechner(c) {
    R(c, -13, -20, 26, 40, '#5c6470', 3, 4); R(c, -9, -16, 18, 9, '#b8e0a0', 2, 1);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R(c, -9 + j * 6.5, -3 + i * 6.5, 5, 5, '#e8e8e8', 1.2, 1);
  },
  muenze(c) { E(c, 0, 0, 15, 15, '#e8c040'); E(c, 0, 0, 10.5, 10.5, null, 2, 0, '#a3801c'); txt(c, '25', 0, 5, '800 12px "Baloo 2", sans-serif', '#7a5a10'); },
  kaffee(c) {
    for (let i = -1; i <= 1; i++) S(c, null, 2, () => { c.moveTo(i * 5, -22); c.quadraticCurveTo(i * 5 + 4, -26, i * 5, -30); }, '#c9c0d8');
    P(c, [-11, -12, 11, -12, 8, 19, -8, 19], '#f4efe6'); R(c, -14, -19, 28, 8, '#d23c2c', 2.5, 3); R(c, -9.5, -2, 19, 10, '#8a5a2a', 2, 1);
  },
  zucker(c) { cube(c, -10, 6); cube(c, 9, 7); cube(c, -1, -8); },
  sticks(c) { stick(c, -0.6, '#d9a865'); stick(c, 0.6, '#c99550'); },
  altsticks(c) {
    stick(c, -0.6, '#9a8a74'); stick(c, 0.6, '#8a7a64');
    for (let i = 0; i < 4; i++) L(c, [0, 0, Math.cos(i * 1.57 + 0.6) * 20, Math.sin(i * 1.57 + 0.6) * 20], 1, '#e8e8f0');
    E(c, 0, 0, 9, 9, null, 1, 0, '#e8e8f0'); E(c, 0, 0, 15, 15, null, 1, 0, '#e8e8f0');
  },
  apfel(c) { apple(c, '#e0302a'); },
  lapfel(c) { apple(c, '#d63a8a'); E(c, 14, -14, 2, 2, '#fff8a0', 0); E(c, -15, 10, 1.5, 1.5, '#fff8a0', 0); },
  butzen(c) {
    S(c, '#f6efcf', 3, () => { c.moveTo(-8, -14); c.quadraticCurveTo(-2, -2, -8, 14); c.lineTo(8, 14); c.quadraticCurveTo(2, -2, 8, -14); c.closePath(); });
    E(c, 0, -14, 9, 4, '#e0302a', 2.5); E(c, 0, 14, 9, 4, '#e0302a', 2.5);
    E(c, -1, -2, 1.6, 3, '#3a2414', 0); E(c, 2, 4, 1.6, 3, '#3a2414', 0); L(c, [0, -18, 2, -24], 2.5, '#5a3a1e');
  },
  schaufel(c) {
    L(c, [-16, -20, 6, 6], 7, OUT); L(c, [-16, -20, 6, 6], 3.5, '#b07a3c');
    R(c, -24, -26, 14, 6, '#b07a3c', 2.5, 2);
    P(c, [2, 2, 14, 2, 20, 18, 12, 24, 0, 14], '#9aa3ad');
  },
  eimer(c) { bucket(c, false); },
  wasser(c) { bucket(c, true); E(c, -4, -11, 4, 1.2, 'rgba(255,255,255,0.7)', 0); },
  brot(c) {
    E(c, 0, 3, 23, 13, '#c9852e'); E(c, -2, -1, 19, 8, '#e8ad58', 0);
    for (let i = -1; i <= 1; i++) L(c, [i * 9 - 3, -6, i * 9 + 3, 4], 2.5, '#9a5a20');
    heart(c, 15, -10, 4, '#ff6fae', 1.5);
  },
  steth(c) {
    S(c, null, 6, () => { c.moveTo(-10, -18); c.quadraticCurveTo(-14, 4, 0, 8); c.quadraticCurveTo(14, 4, 10, -18); });
    S(c, null, 3, () => { c.moveTo(-10, -18); c.quadraticCurveTo(-14, 4, 0, 8); c.quadraticCurveTo(14, 4, 10, -18); }, '#5a5f6a');
    L(c, [0, 8, 0, 12], 3, '#5a5f6a'); E(c, 0, 17, 7, 6, '#c8d0d8', 2.5);
    E(c, -10, -19, 2.5, 2.5, '#333', 0); E(c, 10, -19, 2.5, 2.5, '#333', 0);
  },
  zelle(c) {
    const g = c.createRadialGradient(0, 0, 2, 0, 0, 26); g.addColorStop(0, 'rgba(140,255,130,0.55)'); g.addColorStop(1, 'rgba(140,255,130,0)');
    c.fillStyle = g; c.fillRect(-26, -26, 52, 52);
    R(c, -9, -17, 18, 34, '#7dff7a', 3, 8); R(c, -6, -23, 12, 6, '#9aa3ad', 2.5, 2); R(c, -6, 17, 12, 6, '#9aa3ad', 2.5, 2);
    P(c, [2, -12, -5, 2, 0, 2, -2, 12, 5, -2, 0, -2], '#fffde0', 1.5);
  },
  toast(c) {
    R(c, -17, -16, 34, 32, '#b8742e', 3, 9); R(c, -13, -12, 26, 24, '#f0c27a', 0, 6);
    heart(c, 0, 1, 6, '#9a5a1e', 0);
    for (let i = -1; i <= 1; i += 2) S(c, null, 2, () => { c.moveTo(i * 8, -20); c.quadraticCurveTo(i * 8 + 4, -24, i * 8, -28); }, '#e8dcc8');
  },
};
