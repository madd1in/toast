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
// HDS.ink: Figuren im HD-Modus – feine farbige Innenlinien, Cartoon-Schattierung, runde Ecken;
// die kräftige Außenkontur entsteht danach aus der Silhouette der ganzen Figur (engine.js, inkify)
const HDS = { on: true, deco: false, shadow: false, scale: 2, ink: false };
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
function toonFill(c, fill, box) {
  if (!box || (box[3] - box[1] <= 5 && box[2] - box[0] <= 5)) return fill;
  const s = shadeOf(fill), g = c.createLinearGradient(box[0], box[1], box[0] + (box[2] - box[0]) * 0.38, box[3]);
  g.addColorStop(0, s[0]); g.addColorStop(0.32, s[1]); g.addColorStop(0.66, s[1]); g.addColorStop(0.69, mix(s[1], s[2], 0.8)); g.addColorStop(1, s[2]);
  return g;
}
function fs(c, fill, lw, stroke, box) {
  const hd = HDS.on && !c.isPix && isHex(fill);
  if (HDS.ink && !c.isPix) {   // Figur: weiche Innenlinie in abgedunkelter Flächenfarbe
    if (fill) { c.fillStyle = hd ? toonFill(c, fill, box) : fill; c.fill(); }
    if (lw && !fill) { c.lineWidth = lw * 0.85; c.strokeStyle = stroke || OUT; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); return; }   // Mund, Falten: Linie bleibt Linie
    if (lw) {
      c.lineWidth = stroke ? lw * 0.8 : Math.max(0.8, lw * 0.4); c.strokeStyle = stroke || (hd ? shadeOf(fill)[3] : 'rgba(27,16,32,0.6)');
      c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke();
    }
    return;
  }
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
// Polygon als organische Cartoon-Form (Figuren): Kanten leicht nach außen gewölbt, Ecken weich gerundet,
// spitze Ecken (Haarspitzen, Kragen) bleiben spitz – nimmt den Formen den Lineal-Look
function roundPoly(c, pts) {
  const n = pts.length / 2, V = i => [pts[((i % n) + n) % n * 2], pts[((i % n) + n) % n * 2 + 1]];
  let cx0 = 0, cy0 = 0; for (let i = 0; i < n; i++) { cx0 += pts[i * 2]; cy0 += pts[i * 2 + 1]; } cx0 /= n; cy0 /= n;
  const A = [], B = [];
  for (let i = 0; i < n; i++) {
    const [px, py] = V(i - 1), [x, y] = V(i), [nx, ny] = V(i + 1), l1 = Math.hypot(x - px, y - py) || 1, l2 = Math.hypot(nx - x, ny - y) || 1;
    const cosA = ((px - x) * (nx - x) + (py - y) * (ny - y)) / (l1 * l2), r = Math.min(4.5, l1 / 3, l2 / 3) * Math.max(0.12, Math.min(1, (1 - cosA) / 1.3));
    A.push([x + (px - x) / l1 * r, y + (py - y) / l1 * r]); B.push([x + (nx - x) / l2 * r, y + (ny - y) / l2 * r]);
  }
  c.beginPath(); c.moveTo(B[0][0], B[0][1]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, [sx, sy] = B[i], [ex, ey] = A[j], len = Math.hypot(ex - sx, ey - sy) || 1;
    let nx = (ey - sy) / len, ny = -(ex - sx) / len; const mx = (sx + ex) / 2, my = (sy + ey) / 2;
    if ((mx - cx0) * nx + (my - cy0) * ny < 0) { nx = -nx; ny = -ny; }
    const bow = Math.min(3.2, len * 0.055);
    c.quadraticCurveTo(mx + nx * bow, my + ny * bow, ex, ey);
    const [vx, vy] = V(j); c.quadraticCurveTo(vx, vy, B[j][0], B[j][1]);
  }
  c.closePath();
}
function P(c, pts, fill, lw = 3, stroke) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) { const x = pts[i], y = pts[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (HDS.ink && !c.isPix && pts.length >= 6) { roundPoly(c, pts); return fs(c, fill, lw, stroke, [x0, y0, x1, y1]); }
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
// freie Kurvenform mit Licht-Verlauf (box = Begrenzung für die Schattierung)
function shape(c, fill, box, fn, lw = 3) { c.beginPath(); fn(); fs(c, fill, lw, null, box); }
function grad(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; }
function txt(c, s, x, y, font, col, align = 'center', stroke = 0, strokeCol = OUT) {
  if (typeof Lang !== 'undefined' && Lang.cur !== 'de') s = Lang.t(s);
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

// organisches Glied entlang der y-Achse: verjüngt sich von w0 (oben) zu w1 (unten), leicht gewölbt, runde Enden
function seg(c, y0, len, w0, w1, fill, bulge = 0.1, lw = 3) {
  const a = w0 / 2, b = w1 / 2, m = Math.max(a, b) * (1 + bulge), y1 = y0 + len, my = y0 + len * 0.42;
  c.beginPath();
  c.moveTo(-a, y0); c.quadraticCurveTo(-m, my, -b, y1);
  c.arc(0, y1, b, Math.PI, 0, true);
  c.quadraticCurveTo(m, my, a, y0);
  c.arc(0, y0, a, 0, Math.PI, true);
  c.closePath();
  fs(c, fill, lw, null, [-m, y0 - a, m, y1 + b]);
}
// Ärmel/Hosenbein-Stück: oben rund, zum Saum leicht ausgestellt
function sleeveSeg(c, y0, len, w0, w1, fill) {
  const a = w0 / 2, b = w1 / 2, y1 = y0 + len;
  c.beginPath();
  c.moveTo(-a, y0 + a * 0.6); c.quadraticCurveTo(-a * 1.08, y0 + len * 0.5, -b, y1);
  c.quadraticCurveTo(0, y1 + 2.2, b, y1);
  c.quadraticCurveTo(a * 1.08, y0 + len * 0.5, a, y0 + a * 0.6);
  c.quadraticCurveTo(a, y0 - a * 0.45, 0, y0 - a * 0.45); c.quadraticCurveTo(-a, y0 - a * 0.45, -a, y0 + a * 0.6);
  c.closePath();
  fs(c, fill, 3, null, [-b, y0 - a, b, y1 + 2]);
}
// Hand als Fäustling mit Daumen (zeigt nach vorn, +x)
function hand(c, x, y, r, fill) {
  if (!hd(c)) { E(c, x, y, r, r, fill, 3); return; }
  c.beginPath();
  c.moveTo(x - r * 0.85, y - r * 0.7);
  c.quadraticCurveTo(x - r * 1.2, y + r * 0.8, x - r * 0.15, y + r * 1.2);
  c.quadraticCurveTo(x + r * 1.0, y + r * 1.25, x + r * 0.95, y + r * 0.15);
  c.quadraticCurveTo(x + r * 1.65, y - r * 0.35, x + r * 1.25, y - r * 0.95);
  c.quadraticCurveTo(x + r * 0.75, y - r * 1.15, x + r * 0.5, y - r * 0.6);
  c.quadraticCurveTo(x - r * 0.1, y - r * 1.15, x - r * 0.85, y - r * 0.7);
  c.closePath();
  fs(c, fill, 3, null, [x - r, y - r, x + r, y + r]);
  L(c, [x - r * 0.25, y + r * 0.35, x - r * 0.3, y + r * 0.95], 0.9, 'rgba(120,60,40,0.45)');
  L(c, [x + r * 0.25, y + r * 0.35, x + r * 0.25, y + r * 1.0], 0.9, 'rgba(120,60,40,0.45)');
}
// Schuh: flache Sohle, runde Kappe vorn, Absatz hinten (Mitte x, y; halbe Länge l, halbe Höhe h)
function shoe(c, x, y, l, h, fill) {
  if (!hd(c)) { E(c, x, y, l, h, fill, 3); return; }
  const x0 = x - l, x1 = x + l;
  c.beginPath();
  c.moveTo(x0 + l * 0.3, y - h * 1.05);
  c.quadraticCurveTo(x0 - l * 0.08, y - h * 0.6, x0 + l * 0.02, y + h * 0.9);
  c.lineTo(x1 - l * 0.12, y + h * 0.9);
  c.quadraticCurveTo(x1 + l * 0.16, y + h * 0.85, x1 + l * 0.06, y - h * 0.05);
  c.quadraticCurveTo(x1 - l * 0.12, y - h * 1.3, x - l * 0.05, y - h * 1.1);
  c.closePath();
  fs(c, fill, 3, null, [x0, y - h, x1, y + h]);
  L(c, [x0 + l * 0.08, y + h * 0.42, x1 - l * 0.02, y + h * 0.42], 1.1, 'rgba(255,255,255,0.18)');   // Sohlenkante
  E(c, x + l * 0.35, y - h * 0.45, l * 0.32, h * 0.25, 'rgba(255,255,255,0.3)', 0);   // Glanz auf der Kappe
}
// Bein um den Drehpunkt (Hüfte): mit bend > 0 knickt es im Knie (Unterschenkel nach hinten), der Fuß bleibt fast waagrecht
function limb(c, px, py, w, len, ang, fill, foot, bend = 0) {
  c.save(); c.translate(px, py); c.rotate(ang);
  const drawFoot = (y) => { if (foot) shoe(c, foot.dx || 6, y, foot.l, foot.h || 6, foot.fill); };
  if (bend > 0.02) {
    const up = len * 0.52;
    c.save(); c.translate(0, up); c.rotate(bend);
    seg(c, -w * 0.3, len - up + w * 0.3, w * 0.92, w * 0.8, fill, 0.12);
    c.translate(0, len - up); c.rotate(-bend * 0.8 - ang * 0.5); drawFoot(0);
    c.restore();
    seg(c, 0, up + w * 0.25, w, w * 0.9, fill, 0.06);
  } else { seg(c, 0, len, w, w * 0.84, fill, 0.08); drawFoot(len); }
  c.restore();
}
// Arm: mit bend > 0 knickt der Unterarm im Ellbogen nach vorn; ein langer Ärmel läuft über beide Teile
function arm(c, px, py, ang, sleeve, sleeveLen, skin, len, w, hr = 5.5, bend = 0) {
  if (HDS.ink && !c.isPix) { w *= 1.12; hr *= 1.22; }   // HD: kräftigere Arme, cartoonhaft große Hände
  c.save(); c.translate(px, py); c.rotate(ang);
  if (bend > 0.02) {
    const up = len * 0.5;
    c.save(); c.translate(0, up); c.rotate(-bend);
    seg(c, -w * 0.3, len - up + w * 0.3, w * 0.9, w * 0.74, skin, 0.08);
    if (sleeve && sleeveLen > up) sleeveSeg(c, -w * 0.3, sleeveLen - up + w * 0.3, w + 3, w + 4.5, sleeve);
    hand(c, 0, len - up + 2, hr, skin);
    c.restore();
    seg(c, 0, up + w * 0.3, w, w * 0.9, skin, 0.08);
    if (sleeve) sleeveSeg(c, -2, Math.min(sleeveLen, up + w * 0.3) + 2, w + 3, w + 4, sleeve);
  } else {
    seg(c, 0, len, w, w * 0.76, skin, 0.08);
    if (sleeve) sleeveSeg(c, -2, sleeveLen, w + 3, w + 4.5, sleeve);
    hand(c, 0, len + 2, hr, skin);
  }
  c.restore();
}
// Gangzyklus: das nach vorn schwingende Bein knickt ein; side = 1 vorderes, -1 hinteres Bein
function knee(a, side) { return a.walking || a.climb ? Math.max(0, side * Math.cos(a.phase || 0)) * (a.climb ? 1.4 : a.run ? 1.1 : 0.8) : 0; }
function elbow(a, side) { return 0.12 + (a.walking ? Math.max(0, side * Math.cos(a.phase || 0)) * 0.55 : 0) + (a.talking && side > 0 ? 0.5 : 0); }
// beim Reden gestikuliert der vordere Arm
function talkArm(a, t) { return a.talking ? Math.sin(t * 0.0075 + (a.seed || 0) * 2) * 0.32 - 0.32 : 0; }
function nod(a, t) { return a.talking ? Math.sin(t * 0.013) * 1.3 : 0; }
// Aktions-Posen (Greifen, Aufheben, Graben, Essen, Seil ziehen, Gießen, Hebel): Überschreibungen für Arme, Knie, Hocke
function pose(a, t) {
  const p = a.pose; if (!p) return null;
  const k = (t - p.t0) / p.dur; if (k < 0 || k > 1) return null;
  const s = Math.sin(Math.PI * k), cyc = Math.sin((t - p.t0) * 0.012);
  switch (p.kind) {
    case 'reach': return { front: -1.35 * s, fb: 0.15, mix: s };
    case 'pick': return { front: -0.55 * s, fb: 0.25, back: 0.3 * s, knee: 1.5 * s, lean: 0.1 * s, mix: s };
    case 'dig': return { front: -0.5 + cyc * 0.45, fb: 0.5, back: -0.35 + cyc * 0.45, bb: 0.6, knee: 0.75 + cyc * 0.3, lean: 0.06, mix: Math.min(1, s * 3) };
    case 'eat': return { front: -2.1 + Math.abs(cyc) * 0.15, fb: 2.0, chew: true, mix: Math.min(1, s * 3) };
    case 'rope': return { front: -2.6 + cyc * 0.7, fb: 0.4, back: -2.6 - cyc * 0.7, bb: 0.4, knee: 0.4, mix: Math.min(1, s * 3) };
    case 'pour': return { front: -1.25, fb: 0.7, back: -1.05, bb: 0.6, lean: 0.06, mix: Math.min(1, s * 3) };
    case 'pull': return k < 0.4 ? { front: -1.5 * (k / 0.4), fb: 0.1, mix: 1 } : { front: -1.1, fb: 0.5, lean: -0.1 * s, knee: 0.5 * s, mix: 1 };
    // Leerlauf-Ticks (engine.js startet sie, wenn die Spielfigur eine Weile still steht)
    case 'glasses': return { front: -2.4, fb: 0.8, mix: Math.min(1, s * 2.2) };
    case 'think': return { front: -1.95, fb: 2.6, mix: Math.min(1, s * 2.5) };
    case 'airguitar': return { front: -1.95, fb: 0.3, back: -0.7 + Math.sin((t - p.t0) * 0.034) * 0.28, bb: 0.9, knee: 0.35, lean: -0.09, bang: Math.abs(Math.sin((t - p.t0) * 0.017)), mix: Math.min(1, s * 3) };
    case 'yawn': return { front: -3.35, fb: 0.35, back: -3.45, bb: 0.3, lean: -0.07, mix: s };
    case 'belly': return { front: -0.5 + Math.sin((t - p.t0) * 0.03) * 0.28, fb: 1.6, back: -0.45 - Math.sin((t - p.t0) * 0.03) * 0.28, bb: 1.5, mix: Math.min(1, s * 3) };
    case 'saber': { const sw = k > 0.25 && k < 0.85 ? Math.sin((k - 0.25) / 0.6 * Math.PI * 3) * 0.55 : 0; return { front: -1.6 + sw, fb: 0.2, mix: Math.min(1, s * 5) }; }
    case 'fly': return k < 0.8 ? null : { front: -2.6 + (k - 0.8) / 0.2 * 2.0, fb: 0.4, mix: 1 };   // am Ende: zuschlagen
  }
  return null;
}
function poseAng(base, po, key) { return po && po[key] != null ? base * (1 - po.mix) + po[key] * po.mix : base; }
// Oberkörper beim Gehen leicht nach vorn neigen (Drehpunkt in der Hüfte)
function lean(c, a, hipY) {
  const po = a.pose && pose(a, G.t), l = (a.walking ? (a.run ? 0.08 : 0.035) : 0) + (po && po.lean ? po.lean * po.mix : 0);
  if (l) { c.translate(0, hipY); c.rotate(l); c.translate(0, -hipY); }
}
// Hocke aus der Kniebeugung: Oberschenkel kippt um -b/2 nach vorn, Unterschenkel zurück – die Hüfte sinkt genau so weit, dass der Fuß am Boden bleibt
function squat(a, t) { const po = pose(a, t); return po && po.knee ? po.knee * po.mix : 0; }
function crouch(a, t, len) { return len * (1 - Math.cos(squat(a, t) / 2)); }
function poseKnee(a, t, side) { const po = pose(a, t); return knee(a, side) + (po && po.knee ? po.knee * po.mix : 0); }
// Lippen zur Plapperstimme: jede Silbe öffnet den Mund in der Form ihres Vokals (a weit, e/i breit, o/u rund)
const MOUTH = [[1.05, 1.3], [1.2, 0.75], [1.3, 0.55], [0.78, 1.15], [0.66, 1.0]];
function syllables(a) { return a.vowelT != null && typeof G !== 'undefined' && G.settings && G.settings.babble && !(typeof Voice !== 'undefined' && Voice.on); }
function mouthOpen(a, t) {
  if (syllables(a)) return !!a.talking && t - a.vowelT >= 0 && t - a.vowelT < 68;
  return !!a.talking && Math.floor(t / 115) % 2 === 0;
}
function mouthK(a, t) { return syllables(a) && t - a.vowelT < 68 ? MOUTH[a.vowel] || MOUTH[0] : MOUTH[0].map(() => 1); }
function blinking(a, t) { return ((t + (a.seed || 0) * 1777) % 3900) < 130; }
// Pupille – oder ein geschlossenes Lid, wenn die Figur gerade blinzelt
function pupil(c, a, t, x, y, r) {
  if (blinking(a, t)) { L(c, [x - r * 2.2, y, x + r * 2.2, y], 2.2); return; }
  // die Pupillen folgen leicht dem Zeiger – die Figuren wirken aufmerksam
  let dx = 0, dy = 0;
  const m = G && (G.ms || G.mouse);
  const fa = a.pose && a.pose.kind === 'fly' ? gnatAt(a, t) : null;
  if (fa) { dx = Math.max(-r * 0.85, Math.min(r * 0.85, (fa[0] - x) / 6)); dy = Math.max(-r * 0.6, Math.min(r * 0.6, (fa[1] - y) / 6)); }
  else if (a.x != null && a.h != null && m && m.x >= 0) {
    dx = Math.max(-r * 0.85, Math.min(r * 0.85, (m.x - a.x) / 45 * (a.dir || 1)));
    dy = Math.max(-r * 0.45, Math.min(r * 0.45, (m.y - (a.y - a.h * 0.85)) / 150));
  }
  E(c, x + dx, y + dy, r, r * 1.15, OUT, 0);
  if (!c.isPix && r > 1.2) { E(c, x - r * 0.38, y - r * 0.45, r * 0.42, r * 0.42, 'rgba(255,255,255,0.92)', 0); E(c, x + r * 0.4, y + r * 0.45, r * 0.18, r * 0.18, 'rgba(255,255,255,0.6)', 0); }
}
// Laverne und die Fliege: kreist um den Kopf, am Ende ein Klatsch – und weg ist sie
function gnatAt(a, t) {
  const p = a.pose, k = (t - p.t0) / p.dur; if (k < 0 || k > 0.86) return null;
  const w = (t - p.t0) * 0.0042;
  return [16 + Math.cos(w * 1.7) * 36 + Math.sin(w * 3.1) * 6, -186 + Math.sin(w * 2.3) * 20 - Math.cos(w) * 6];
}
function drawGnat(c, a, t) {
  const p = a.pose; if (!p || p.kind !== 'fly') return;
  const k = (t - p.t0) / p.dur, f = gnatAt(a, t);
  if (f) {
    const fl = Math.sin(t * 0.09) * 0.5 + 0.5;
    c.save(); c.translate(f[0], f[1]); c.scale(1.7, 1.7);
    E(c, -1.5, -3.5, 3, 1.4 + fl * 1.4, 'rgba(225,240,255,0.85)', 0.8, -0.5); E(c, 1.5, -3.5, 3, 1.4 + fl * 1.4, 'rgba(225,240,255,0.85)', 0.8, 0.5);
    E(c, 0, 0, 2.8, 2.2, '#2a2430', 0.8); E(c, 2, -0.5, 1, 1, '#d03030', 0);
    c.restore();
  } else if (k < 1) {
    const q = (k - 0.86) / 0.14;
    c.save(); c.globalAlpha *= 1 - q;
    for (let i = 0; i < 7; i++) { const an = i * 0.9; L(c, [40 + Math.cos(an) * (4 + q * 8), -168 + Math.sin(an) * (4 + q * 8), 40 + Math.cos(an) * (9 + q * 12), -168 + Math.sin(an) * (9 + q * 12)], 2.2, '#ffd23a'); }
    c.restore();
  }
}
// Feine Details (Haarsträhnen, Falten, Glanzlichter) nur im HD-Modus – in 320×200 wären sie nur Rauschen
const hd = c => HDS.on && !c.isPix;
function lensGlint(c, x, y, len = 3) { L(c, [x, y, x + len, y - len], 1.6, 'rgba(255,255,255,0.85)'); }
// kleine Geste im Stand: alle paar Sekunden für gut eine Sekunde (0 → 1 → 0), nur bei Figuren in der Szene
function gesture(a, t) {
  if (a.walking || a.talking || a.x == null) return 0;
  const c = (t + (a.seed || 0) * 2971) % 9000;
  return c < 1400 ? Math.sin(Math.PI * c / 1400) : 0;
}
// Nebenfiguren-Leben: wiederkehrende Mini-Aktion im Stand – liefert 0..1 während der Aktion, sonst -1
function idleAct(a, t, period, len, off = 0) {
  if (a.walking || a.talking || a.x == null) return -1;
  const p = ((t + off + (a.seed || 0) * 2311) % period) / len;
  return p < 1 ? p : -1;
}
function actEnv(k) { return k < 0 ? 0 : Math.min(1, Math.sin(Math.PI * k) * 2.2); }   // weich ein- und ausblenden
function noteGlyph(c, x, y, s, col) { c.save(); c.translate(x, y); c.scale(s, s); E(c, 0, 0, 4.2, 3.2, col, 1.5, -0.4); L(c, [3.8, -1, 3.8, -14, 9, -11], 2, col); c.restore(); }
function zGlyph(c, x, y, s, col, flip) { c.save(); c.translate(x, y); c.scale(s * flip, s); L(c, [-5, -5, 5, -5, -5, 5, 5, 5], 3.2); L(c, [-5, -5, 5, -5, -5, 5, 5, 5], 1.6, col); c.restore(); }
// aufsteigende Symbole (Noten, Zzz) über einer Figur
function floaters(c, a, t, x, y, n, draw, alpha = 1) {
  for (let i = 0; i < n; i++) {
    const q = (t * 0.00045 + i / n + (a.seed || 0)) % 1;
    c.save(); c.globalAlpha *= Math.sin(q * Math.PI) * alpha;
    draw(x + q * 18 + Math.sin(q * 7 + i * 2) * 5, y - q * 46, 0.7 + q * 0.5, i);
    c.restore();
  }
}
// Mimik: Augenbrauen je nach Satzzeichen beim Reden (! gehoben, ? eine schräg, ... besorgt), Überraschung bei Post
function mood(a, t) {
  let m = 0, q = 0;
  const sp = typeof G !== 'undefined' && G.speech;
  if (sp && sp.a === a) { const s = sp.text; if (/!/.test(s)) m = 1; if (/\?/.test(s)) q = 1; if (/\.\.\.|…/.test(s) && !m) m = -0.7; }
  else if (a.pose && !a.pose.fidget) m = -0.35;
  if (a.pose && a.pose.kind === 'think') q = 1;
  if (typeof G !== 'undefined' && G.flash && G.flash[a.id] && G.t - G.flash[a.id] < 1600) m = 1.3;
  const wob = m > 0 && a.talking ? Math.sin(t * 0.02) * 0.8 : 0;
  return { lift: m * 3.4 + wob, worry: m < 0 ? -m : 0, q };
}
// Augenbrauen-Paar: Mittelpunkte der Augen x1/x2, Höhe y, Breite w
function brows(c, a, t, x1, x2, y, w, col, lw) {
  const { lift, worry, q } = mood(a, t), k = w / 2;
  L(c, [x1 - k, y - lift + worry * 1.5, x1 + k, y - lift - worry * 1.5 - 0.6], lw, col);
  L(c, [x2 - k, y - lift - worry * 1.5 - 0.6 - q * 3, x2 + k, y - lift + worry * 1.5 - q * 1.5], lw, col);
}

// ---------- Easter Eggs: Verbeugungen vor anderen Klassikern (Fußpunkt bei 0,0, Raumkoordinaten) ----------
// Onkel Ed lugt alle 26 Sekunden für ein paar Sekunden aus der Labortür
function edPeek(t) { const p = (t + 7000) % 26000; return p < 400 ? p / 400 : p < 4400 ? 1 : p < 4800 ? 1 - (p - 4400) / 400 : 0; }
function eggFx(name, t, len) { const s = typeof G !== 'undefined' && G.eggFx && G.eggFx[name]; return s != null && t - s < len ? (t - s) / len : -1; }
const EGG_DRAW = {
  mummy(c, e, t) {   // Cousin Ted im offenen Sarkophag
    shape(c, '#c8a040', [-30, -176, 30, 0], () => { c.moveTo(-26, 0); c.lineTo(-30, -120); c.quadraticCurveTo(-30, -176, 0, -176); c.quadraticCurveTo(30, -176, 30, -120); c.lineTo(26, 0); c.closePath(); });
    shape(c, '#2a1a24', [-22, -166, 22, -4], () => { c.moveTo(-20, -4); c.lineTo(-23, -118); c.quadraticCurveTo(-23, -166, 0, -166); c.quadraticCurveTo(23, -166, 23, -118); c.lineTo(20, -4); c.closePath(); }, 2);
    for (const y of [-150, -110, -70, -30]) { L(c, [-29, y, -22, y], 3, '#2a8a8a'); L(c, [22, y, 29, y], 3, '#2a8a8a'); }
    shape(c, '#e6dcc0', [-16, -132, 16, -4], () => { c.moveTo(-12, -4); c.quadraticCurveTo(-16, -60, -15, -112); c.quadraticCurveTo(-15, -126, -9, -130); c.lineTo(9, -130); c.quadraticCurveTo(15, -126, 15, -112); c.quadraticCurveTo(16, -60, 12, -4); c.closePath(); });
    E(c, 0, -142, 11, 14, '#e6dcc0');
    if (hd(c)) for (let y = -150; y < -10; y += 9) L(c, [-12, y + 3, 12, y - 2], 1.1, 'rgba(120,100,70,0.45)');
    R(c, -8, -146, 16, 4, '#2a1a24', 0, 2);
    if (((t + 4000) % 11000) < 900) E(c, 4, -144, 2.2, 1.6, '#ffe066', 0);   // ein Auge geht kurz auf
    shape(c, '#ddd2b4', [-14, -110, 14, -88], () => { c.moveTo(-14, -96); c.quadraticCurveTo(0, -110, 14, -104); c.lineTo(14, -96); c.quadraticCurveTo(0, -102, -14, -88); c.closePath(); }, 2);
    const sw = Math.sin(t * 0.0013) * 0.6;
    S(c, null, 4.5, () => { c.moveTo(10, -96); c.quadraticCurveTo(22 + sw * 6, -86, 18 + sw * 10, -70); }, OUT);
    S(c, null, 2.5, () => { c.moveTo(10, -96); c.quadraticCurveTo(22 + sw * 6, -86, 18 + sw * 10, -70); }, '#e6dcc0');   // loses Bindenende
  },
  hamster(c, e, t) {   // Onkel Eds Hamster im Laufrad
    const sp = eggFx('hamster', t, 6000) >= 0 ? 0.03 : 0.012, ang = t * sp;
    R(c, -32, -8, 64, 8, '#3a5a8a', 2.5, 2);
    R(c, -30, -46, 60, 40, null, 2, 4, '#c8c8d8');
    for (let x = -24; x <= 24; x += 6) L(c, [x, -46, x, -8], 1, '#b8b8c8');
    E(c, 8, -24, 14, 14, null, 2.5, 0, '#e0a040');
    for (let i = 0; i < 6; i++) { const a = ang + i * 1.047; L(c, [8, -24, 8 + Math.cos(a) * 13, -24 + Math.sin(a) * 13], 1, '#c08030'); }
    const hop = Math.abs(Math.sin(t * sp * 3)) * 1.5;
    E(c, 8, -16 - hop, 7, 5, '#e8a050', 1.6); E(c, 13, -18 - hop, 3.6, 3.4, '#e8a050', 1.4); E(c, 14.5, -19 - hop, 0.9, 0.9, OUT, 0); E(c, 11, -21 - hop, 1.6, 1.6, '#f4c090', 1);
    E(c, -18, -12, 7, 3, '#d04a4a', 1.5);
    L(c, [-15, -58, -15, -46], 1, '#888898');
    R(c, -26, -60, 22, 12, '#fff8e0', 1.5, 2); txt(c, 'ED', -15, -51, '800 9px "Baloo 2", sans-serif', '#c02020');
  },
  saber(c, e, t) {   // Lichtschwert-Prototyp, an die Wand gelehnt
    if (typeof G !== 'undefined' && G.saber) return;
    c.save(); c.rotate(-0.28);
    R(c, -3.5, -38, 7, 36, '#c8ccd8', 2, 2); R(c, -4.5, -24, 9, 6, '#2a2a34', 1.5, 1); R(c, -4, -42, 8, 5, '#9aa0b0', 1.5, 1);
    for (const y of [-34, -31, -28]) L(c, [-3, y, 3, y], 1, '#2a2a34');
    E(c, 2, -16, 1.4, 1.4, '#d02020', 0);
    c.restore();
  },
  chuck(c, e, t) {   // Chuck, die Topfpflanze
    const sw = Math.sin(t * 0.0016) * 0.06;
    c.save(); c.translate(0, -18); c.rotate(sw);
    for (const [a, l, col] of [[-0.9, 26, '#3f9a4a'], [-0.35, 32, '#4fb258'], [0.2, 30, '#3f9a4a'], [0.7, 24, '#4fb258'], [-0.05, 22, '#5fc868']]) {
      c.save(); c.rotate(a); shape(c, col, [-6, -l, 6, 0], () => { c.moveTo(0, 0); c.quadraticCurveTo(-7, -l * 0.5, 0, -l); c.quadraticCurveTo(7, -l * 0.5, 0, 0); c.closePath(); }, 1.8); c.restore();
    }
    c.restore();
    P(c, [-11, -18, 11, -18, 8, 0, -8, 0], '#c8643a', 2);
    R(c, -12, -21, 24, 5, '#a84e2a', 2, 1.5);
    R(c, -2, -13, 22, 8, '#fff8e0', 1.2, 1); txt(c, 'Chuck', 9, -7, '700 6px "Baloo 2", sans-serif', '#2a1a10');
  },
  ed(c, e, t) {   // Onkel Ed lugt hinter dem rechten Türpfosten hervor (Gesicht nach links)
    const k = edPeek(t); if (k <= 0) return;
    const hx = 16 - 24 * k;
    c.save(); c.beginPath(); c.rect(-80, -230, 80, 240); c.clip();
    shape(c, '#5a6a3a', [hx - 18, -146, hx + 18, -100], () => { c.moveTo(hx - 16, -100); c.quadraticCurveTo(hx - 18, -140, hx, -142); c.quadraticCurveTo(hx + 18, -140, hx + 16, -100); c.closePath(); });
    E(c, hx - 2, -162, 13, 15, '#f0c8a0');
    R(c, hx - 15, -182, 26, 9, '#e8d060', 2, 2);
    for (let i = 0; i < 6; i++) L(c, [hx - 13 + i * 4.4, -182, hx - 13 + i * 4.4, -177], 1, '#c8a830');
    R(c, hx - 20, -168, 9, 7, '#d8f0ff', 1.8, 1.5); R(c, hx - 9, -168, 9, 7, '#d8f0ff', 1.8, 1.5);
    E(c, hx - 16.5, -164.5, 1.4, 1.6, OUT, 0); E(c, hx - 5.5, -164.5, 1.4, 1.6, OUT, 0);
    L(c, [hx - 14, -152, hx - 6, -153], 1.8);
    c.restore();
    if (k > 0.3) { E(c, -3, -150, 4, 6, '#f0c8a0', 1.6); for (const y of [-154, -150, -146]) L(c, [-6, y, -2, y], 1); }   // Hand am Türrahmen
  },
  grail(c, e, t) {   // schlichter Holzbecher auf dem Kaminsims
    P(c, [-6, -14, 6, -14, 4, -6, -4, -6], '#9a6a3a', 1.6);
    R(c, -1.5, -6, 3, 4, '#8a5a2a', 1.2); R(c, -5, -2.5, 10, 2.5, '#8a5a2a', 1.4, 1);
    if (hd(c)) L(c, [-4, -12, -3, -8], 1, 'rgba(255,230,180,0.5)');
    const k = eggFx('grail', t, 2500);
    if (k >= 0) floaters(c, e, t, 0, -16, 3, (x, y, s) => E(c, x, y, 1.6 * s, 1.6 * s, '#ffe066', 0), 1 - k);
  },
  grog(c, e, t) {   // Krug Grog – frisst sich durch den Boden
    R(c, -9, -26, 18, 26, '#8a8a98', 2, 3);
    S(c, null, 2.2, () => { c.moveTo(9, -20); c.quadraticCurveTo(16, -18, 15, -10); c.quadraticCurveTo(14, -5, 9, -6); }, OUT);
    E(c, 0, -26, 9, 3, '#6aff4a', 1.6);
    for (let i = 0; i < 3; i++) { const q = (t * 0.0012 + i / 3) % 1; E(c, -4 + i * 4, -27 - q * 10, 1.4 + q, 1.4 + q, `rgba(150,255,120,${(1 - q).toFixed(2)})`, 0); }
    E(c, 4, -3, 1.6, 1.2, '#2a2a30', 0);
    const d = (t * 0.001) % 1; E(c, 4, -1 + d * 6, 1.2, 1.6, '#6aff4a', 0);
  },
  chicken(c, e, t) {   // Gummihuhn mit Umlenkrolle, am Balken aufgehängt
    const k = eggFx('chicken', t, 3000);
    const sw = Math.sin(t * 0.0018) * 0.06 + (k >= 0 ? Math.sin(k * 36) * 0.35 * (1 - k) : 0);
    c.save(); c.translate(0, -104); c.rotate(sw);
    L(c, [0, 0, 0, 52], 1.6, '#8a6a40');
    c.translate(0, 52);
    shape(c, '#ffe066', [-18, 0, 14, 46], () => { c.moveTo(-3, 0); c.quadraticCurveTo(-6, 10, -14, 22); c.quadraticCurveTo(-18, 40, -2, 46); c.quadraticCurveTo(14, 44, 12, 26); c.quadraticCurveTo(4, 14, 3, 0); c.closePath(); });
    E(c, 0, 0, 6, 5, '#ffe066', 2);
    P(c, [-3, -5, -1, -9, 1, -5, 3, -9, 5, -4], '#e83030', 1.4);
    P(c, [5, 1, 10, 2, 5, 3], '#ff9a30', 1.2);
    E(c, -1, 26, 6, 6, '#9aa0b0', 1.8); E(c, -1, 26, 2, 2, '#4a4a58', 0);
    L(c, [-6, 44, -8, 50], 1.4, '#ff9a30'); L(c, [3, 45, 4, 51], 1.4, '#ff9a30');
    c.restore();
  },
  distaff(c, e, t) {   // Spinnrocken – vier Töne darauf, und die Welt wird neu verwoben
    c.save(); c.rotate(0.1);
    R(c, -2.5, -128, 5, 124, '#8a5a2a', 1.8, 2);
    R(c, -9, -6, 18, 6, '#6a4220', 1.8, 2);
    for (const [x, y, r] of [[0, -128, 10], [-6, -120, 8], [6, -118, 8], [0, -110, 9]]) E(c, x, y, r, r * 0.9, '#f4f0e6', 1.6);
    if (hd(c)) L(c, [-4, -126, 4, -112], 1, 'rgba(160,150,140,0.6)');
    S(c, null, 1, () => { c.moveTo(4, -104); c.quadraticCurveTo(14, -80, 8, -60); }, '#e8e0d0');
    c.restore();
    const k = eggFx('draft', t, 3200);
    if (k >= 0) for (let i = 0; i < 4; i++) {
      const q = Math.max(0, Math.min(1, (k * 3200 - i * 380) / 1400));
      if (q > 0) { c.save(); c.globalAlpha *= Math.sin(q * Math.PI); txt(c, 'EGAC'[i], -24 + i * 16, -140 - q * 30, '800 13px "Baloo 2", sans-serif', ['#9ad8ff', '#c8a8ff', '#ffd8a0', '#a8ffc8'][i], 'center', 3, OUT); c.restore(); }
    }
  },
  squirrel(c, e, t) {   // zweiköpfiges Eichhörnchen auf dem Zaun
    const fight = eggFx('squirrel', t, 2500) >= 0, tail = Math.sin(t * 0.004) * 0.15;
    c.save(); c.translate(-8, -6); c.rotate(-0.3 + tail);
    shape(c, '#b8682a', [-16, -32, 4, 0], () => { c.moveTo(0, 0); c.quadraticCurveTo(-16, -6, -12, -22); c.quadraticCurveTo(-6, -32, 2, -22); c.quadraticCurveTo(-4, -12, 4, -2); c.closePath(); });
    c.restore();
    E(c, 0, -10, 9, 10, '#c8783a', 2);
    E(c, 2, -7, 5, 6, '#f0c8a0', 0);
    for (const [hx, dir, ph] of [[-5, -1, 0], [6, 1, 1.7]]) {
      const x = hx + Math.sin(t * 0.003 + ph) * (fight ? 2 : 0.7), y = -22;
      E(c, x, y, 5.5, 5, '#c8783a', 1.8);
      P(c, [x - 3, y - 4, x - 2, y - 9, x, y - 5], '#c8783a', 1.2);
      E(c, x + dir * 2.5, y - 1, 1.1, 1.2, OUT, 0);
      E(c, x + dir * 5, y + 1, 1, 0.8, '#3a2010', 0);
    }
    E(c, 0, -13, 2.5, 3, '#8a5a2a', 1);
    if (fight) floaters(c, e, t, 0, -32, 2, (x, y, s) => txt(c, '!', x, y, `800 ${Math.round(10 * s)}px "Baloo 2", sans-serif`, '#ffe066', 'center', 3, OUT));
  },
  idol(c, e, t) {   // goldenes Götzenbild auf einem Sockel mit Druckplatten
    R(c, -18, -52, 36, 52, '#8a8278', 2.5, 2); R(c, -21, -56, 42, 7, '#9a9288', 2, 2);
    if (hd(c)) { L(c, [-14, -40, 14, -40], 1, 'rgba(0,0,0,0.2)'); L(c, [-14, -24, 14, -24], 1, 'rgba(0,0,0,0.2)'); }
    const y0 = -56 - (eggFx('idol', t, 900) >= 0 ? 4 : 0);
    shape(c, '#e8b830', [-10, y0 - 28, 10, y0], () => { c.moveTo(-7, y0); c.lineTo(-8, y0 - 10); c.quadraticCurveTo(-10, y0 - 28, 0, y0 - 28); c.quadraticCurveTo(10, y0 - 28, 8, y0 - 10); c.lineTo(7, y0); c.closePath(); });
    E(c, -3, y0 - 19, 1.6, 1.2, '#7a4a10', 0); E(c, 3, y0 - 19, 1.6, 1.2, '#7a4a10', 0); L(c, [-3, y0 - 13, 3, y0 - 13], 1.2, '#7a4a10');
    if (hd(c)) E(c, -3, y0 - 23, 2.5, 1.5, 'rgba(255,255,220,0.6)', 0);
  },
};
// fliegender Schwan (nach der Spinnrocken-Melodie) und lila Meteor über dem Zukunftsgarten
function drawSwan(c, x, y, t) {
  const fl = Math.sin(t * 0.016);
  c.save(); c.translate(x, y);
  S(c, null, 4, () => { c.moveTo(14, -2); c.quadraticCurveTo(26, -10, 30, -4); }, OUT); S(c, null, 2.4, () => { c.moveTo(14, -2); c.quadraticCurveTo(26, -10, 30, -4); }, '#ffffff');
  E(c, 0, 0, 16, 7, '#ffffff', 2);
  P(c, [30, -5, 37, -3, 30, -2], '#ff9a30', 1.2); E(c, 29, -6, 0.9, 0.9, OUT, 0);
  shape(c, '#f4f4ff', [-14, -26, 10, 0], () => { c.moveTo(-8, -2); c.quadraticCurveTo(-14, -14 - fl * 12, -2, -24 * fl - 2); c.quadraticCurveTo(4, -8, 8, -2); c.closePath(); }, 2);
  c.restore();
}
// ---------- Tiere (Katze in der Lobby, Huhn 1776, Saugroboter im Palast) ----------
// gezeichnet in Fußpunkt-Koordinaten, Blickrichtung +x
const CRITTER_DRAW = {
  cat(c, cr, t) {
    const walk = cr.mode === 'walk' || cr.mode === 'flee', ph = cr.phase || 0, fur = '#e89a4a', dark = '#b8682a';
    if (cr.mode === 'rub') {   // schmiegt sich an die Beine: Rücken hoch, Schwanz senkrecht mit Knick, Augen zu, Herzchen
      const sw = Math.sin(t * 0.006) * 3;
      c.save(); c.translate(sw, 0);
      S(c, null, 5, () => { c.moveTo(-15, -16); c.quadraticCurveTo(-22, -34, -18, -46); c.quadraticCurveTo(-15, -52, -10, -48); }, OUT);
      S(c, null, 3, () => { c.moveTo(-15, -16); c.quadraticCurveTo(-22, -34, -18, -46); c.quadraticCurveTo(-15, -52, -10, -48); }, fur);
      for (const [x, s] of [[-10, 1], [8, -1], [-6, -1], [12, 1]]) R(c, x - 2.2, -9, 4.4, 9, x < 0 ? dark : fur, 2, 2);
      shape(c, fur, [-17, -30, 18, -6], () => { c.moveTo(-16, -10); c.quadraticCurveTo(-18, -27, -2, -28); c.quadraticCurveTo(14, -29, 17, -14); c.quadraticCurveTo(10, -6, -16, -10); c.closePath(); });
      for (const x of [-9, -3, 3]) L(c, [x, -27, x + 2, -21], 2, dark);
      const hx = 16, hy = -22;
      E(c, hx, hy, 9, 8, fur, 3);
      P(c, [hx - 6, hy - 4, hx - 4, hy - 12, hx, hy - 6], fur, 2.5); P(c, [hx + 1, hy - 6, hx + 5, hy - 12, hx + 6, hy - 3], fur, 2.5);
      S(c, null, 1.6, () => { c.moveTo(hx, hy - 1); c.quadraticCurveTo(hx + 2, hy - 3, hx + 4, hy - 1); c.moveTo(hx + 5.5, hy - 1); c.quadraticCurveTo(hx + 7, hy - 3, hx + 9, hy - 1); });   // Augen zu
      E(c, hx + 8, hy + 3, 1.6, 1.2, '#ff8aa0', 0);
      c.restore();
      if (cr.x != null) floaters(c, cr, t, 16, -36, 2, (x, y, s) => heart(c, x, y, 5 * s, '#ff6fae', 1.6));
      return;
    }
    if (cr.mode === 'sleep') {   // eingerollt, Schwanz um den Körper, Zzz
      S(c, dark, 2.5, () => { c.moveTo(-16, -3); c.quadraticCurveTo(-24, -10, -10, -14); }, OUT);
      E(c, 0, -10, 18, 10, fur, 3); for (const x of [-8, -1, 6]) L(c, [x, -19, x + 2, -12], 2, dark);
      E(c, 13, -11, 8, 7, fur, 3); P(c, [8, -16, 10, -23, 14, -17], fur, 2.5); P(c, [14, -17, 18, -23, 19, -15], fur, 2.5);
      L(c, [12, -11, 16, -11], 1.6); L(c, [17, -11, 20, -11], 1.6);
      if (cr.x != null) floaters(c, cr, t, 18, -22, 2, (x, y, s) => zGlyph(c, x, y, s * 0.7, '#cfe0ff', cr.dir < 0 ? -1 : 1));
      return;
    }
    const tail = Math.sin(t * 0.004 + (cr.seed || 0)) * 6;
    S(c, null, 5, () => { c.moveTo(-15, -14); c.quadraticCurveTo(-28, -18 + tail, -24, -34 + tail); }, OUT);
    S(c, null, 3, () => { c.moveTo(-15, -14); c.quadraticCurveTo(-28, -18 + tail, -24, -34 + tail); }, fur);
    for (const [x, s] of [[-10, 1], [8, -1], [-6, -1], [12, 1]]) { const sw = walk ? Math.sin(ph + (s > 0 ? 0 : Math.PI)) * 0.5 : 0; c.save(); c.translate(x, -9); c.rotate(sw); R(c, -2.2, 0, 4.4, 9, x < 0 ? dark : fur, 2, 2); c.restore(); }
    E(c, 0, -15, 17, 9, fur, 3);
    for (const x of [-9, -3, 3]) L(c, [x, -23, x + 2, -17], 2, dark);
    const groom = cr.mode === 'groom', hx = groom ? 13 : 17, hy = groom ? -16 : -24;
    E(c, hx, hy, 9, 8, fur, 3);
    P(c, [hx - 6, hy - 4, hx - 4, hy - 12, hx, hy - 6], fur, 2.5); P(c, [hx + 1, hy - 6, hx + 5, hy - 12, hx + 6, hy - 3], fur, 2.5);
    if (groom) { E(c, hx + 6, hy + 4, 3, 2.5, '#ff9ab0', 0); L(c, [hx + 1, hy - 1, hx + 5, hy - 1], 1.6); }
    else { E(c, hx + 2, hy - 1, 1.8, 2.4, '#2a4a20', 0); E(c, hx + 7, hy - 1, 1.6, 2.2, '#2a4a20', 0); E(c, hx + 8, hy + 3, 1.6, 1.2, '#ff8aa0', 0); L(c, [hx + 9, hy + 4, hx + 15, hy + 2], 0.8, 'rgba(30,20,20,0.5)'); L(c, [hx + 9, hy + 5, hx + 15, hy + 6], 0.8, 'rgba(30,20,20,0.5)'); }
  },
  hen(c, cr, t) {
    const walk = cr.mode === 'walk' || cr.mode === 'flee', ph = cr.phase || 0, peck = cr.mode === 'peck' ? Math.max(0, Math.sin(t * 0.018)) : 0;
    for (const s of [1, -1]) { const sw = walk ? Math.sin(ph + (s > 0 ? 0 : Math.PI)) * 0.45 : 0; c.save(); c.translate(s * 3, -10); c.rotate(sw); L(c, [0, 0, 0, 10, 4, 10], 2.2, '#e8a020'); c.restore(); }
    P(c, [-12, -18, -22, -30, -19, -16, -12, -12], '#e8e2d6', 2.5);   // Schwanzfedern
    E(c, 0, -17, 14, 11, '#f6f2ea', 3);
    S(c, '#e6ded0', 2, () => { c.moveTo(-6, -20); c.quadraticCurveTo(2, -10, 8, -18); c.quadraticCurveTo(1, -22, -6, -20); }, null);
    c.save(); c.translate(8, -22); c.rotate(peck * 1.1);
    E(c, 3, -6, 6, 6.5, '#f6f2ea', 2.5);
    P(c, [0, -11, 2, -15, 4, -12, 6, -16, 8, -11], '#d8322e', 2);   // Kamm
    P(c, [8, -7, 13, -5, 8, -4], '#f0b020', 2);   // Schnabel
    E(c, 7, -1, 1.8, 2.6, '#d8322e', 1.2);   // Kehllappen
    E(c, 5, -7, 1.2, 1.4, OUT, 0);
    c.restore();
  },
  bot(c, cr, t) {
    const moving = cr.mode === 'walk' || cr.mode === 'flee', spin = t * (moving ? 0.03 : 0.012);
    for (let i = 0; i < 3; i++) { const a = spin + i * 2.094; L(c, [14, -2, 14 + Math.cos(a) * 7, -2 + Math.sin(a) * 2], 1.4, '#8a8aa0'); }
    E(c, 0, -6, 20, 7.5, '#5c4a7a', 3);
    E(c, 0, -9, 17, 4.5, '#7a66a0', 0); E(c, -4, -10, 8, 1.6, 'rgba(255,255,255,0.35)', 0);
    E(c, 9, -8, 2, 1.4, Math.floor(t / 400) % 2 ? '#7dff7a' : '#2a6a2a', 0);
    L(c, [-6, -8, -2, -10, 2, -8], 1.4, '#d9b2f2');   // Tentakel-Logo
  },
};
function swing(a) { return a.walking ? Math.sin(a.phase) : 0; }
function bobY(a, t) { return a.walking ? -Math.abs(Math.cos(a.phase)) * 3 : Math.sin(t * 0.002 + (a.seed || 0)) * 0.7; }

// ------------------------------------------------------------
//  Figuren – Füße liegen bei (0,0), Blickrichtung nach rechts
// ------------------------------------------------------------
const CHAR = {};

CHAR.bernard = (c, a, t) => {
  const sw = swing(a), b = bobY(a, t), mo = mouthOpen(a, t);
  const skin = '#f3c9a1', shirt = '#f3f0e2', pants = '#7b5634', pantsB = '#664629', shoe = '#2b2320';
  const po = pose(a, t), sq = squat(a, t), cr = crouch(a, t, 82);
  limb(c, -4, -88 + cr, 13, 82, -sw * 0.42 - sq * 0.45, pantsB, { l: 13, h: 6, dx: 7, fill: shoe }, poseKnee(a, t, -1));
  c.save(); c.translate(0, b + cr); lean(c, a, -88); arm(c, -5, -144, poseAng(0.12 - sw * 0.45, po, 'back'), shirt, 18, skin, 50, 9, 5.5, poseAng(elbow(a, -1), po, 'bb')); c.restore();
  limb(c, 5, -88 + cr, 13, 82, sw * 0.42 - sq * 0.55, pants, { l: 13, h: 6, dx: 7, fill: shoe }, poseKnee(a, t, 1));
  c.save(); c.translate(0, b + cr + nod(a, t)); lean(c, a, -88);
  shape(c, shirt, [-18, -151, 20, -83], () => { c.moveTo(-13, -84); c.quadraticCurveTo(-18, -112, -16, -139); c.quadraticCurveTo(-15, -151, -3, -151); c.lineTo(8, -150); c.quadraticCurveTo(19, -149, 19, -137); c.quadraticCurveTo(20, -110, 16, -84); c.quadraticCurveTo(1, -81, -13, -84); c.closePath(); });
  if (hd(c)) { S(c, null, 1.2, () => { c.moveTo(-11, -90); c.quadraticCurveTo(-6, -96, -2, -91); c.moveTo(4, -91); c.quadraticCurveTo(9, -97, 13, -90); }, 'rgba(120,105,80,0.4)'); }   // Hemd in die Hose gesteckt
  R(c, -15, -93, 31, 8, '#4a2e18', 2.5, 2);
  if (hd(c)) {
    R(c, -1, -93, 7, 8, '#c8a040', 1.5, 1.5);   // Gürtelschnalle
    L(c, [-9, -134, -6, -108], 1.5, 'rgba(120,105,80,0.35)'); L(c, [10, -112, 13, -96], 1.5, 'rgba(120,105,80,0.35)'); L(c, [-2, -100, 4, -94], 1.2, 'rgba(120,105,80,0.3)');
  }
  R(c, 5, -137, 9, 13, '#5aa0e6', 2, 2);
  L(c, [7.5, -139, 7.5, -133], 2, '#d33'); L(c, [11, -140, 11, -133], 2, '#223');
  R(c, -3, -165, 9, 18, skin, 3, 3);
  if (hd(c)) E(c, 3, -160.5, 7.5, 3.6, 'rgba(150,80,50,0.38)', 0);   // Schatten unterm Kinn
  if (hd(c)) E(c, 6.5, -156.5, 2, 2.6, skin, 1.4);   // Adamsapfel
  P(c, [-9, -151, -1, -143, 2, -150], '#ffffff', 2); P(c, [2, -150, 5, -143, 12, -151], '#ffffff', 2);   // Hemdkragen
  // Eierkopf: großer Hinterkopf, schmales Kinn
  shape(c, skin, [-16, -213, 26, -158], () => { c.moveTo(-14, -178); c.quadraticCurveTo(-17, -201, -5, -208); c.quadraticCurveTo(7, -214, 18, -206); c.quadraticCurveTo(26, -198, 25, -184); c.quadraticCurveTo(24, -170, 19, -164); c.quadraticCurveTo(12, -157, 4, -159); c.quadraticCurveTo(-6, -162, -11, -168); c.quadraticCurveTo(-15, -172, -14, -178); c.closePath(); });
  E(c, -10, -183, 5, 7, skin, 2.5);
  // Seitenscheitel mit Wirbel
  shape(c, '#6b3f1f', [-21, -221, 26, -182], () => { c.moveTo(-15, -182); c.quadraticCurveTo(-21, -211, 0, -214); c.quadraticCurveTo(21, -216, 26, -199); c.quadraticCurveTo(19, -204, 11, -201); c.quadraticCurveTo(2, -209, -6, -199); c.quadraticCurveTo(-10, -192, -15, -182); c.closePath(); });
  S(c, null, 2.6, () => { c.moveTo(0, -213); c.quadraticCurveTo(-5, -222, 4, -221); }, '#6b3f1f');
  if (hd(c)) {
    for (const [x0, y0, x1, y1] of [[-8, -205, -2, -197], [2, -210, 7, -201], [13, -209, 17, -201], [-13, -196, -10, -189]]) L(c, [x0, y0, x1, y1], 1.6, '#4a2a10');
    L(c, [-8, -208, 4, -211, 15, -209], 2.4, 'rgba(255,214,170,0.35)');
    S(c, null, 1.4, () => { c.moveTo(-12, -186); c.quadraticCurveTo(-8, -183, -11, -179); }, 'rgba(150,80,60,0.6)');   // Ohrmuschel
    E(c, 21, -175, 4.5, 2.6, 'rgba(240,120,110,0.25)', 0);
  }
  E(c, 12, -189, 7.5, 7.5, '#eaf5ff'); E(c, 27, -189, 7.5, 7.5, '#eaf5ff');
  L(c, [4.5, -189, -8, -187], 2.5);
  brows(c, a, t, 12, 27, -198.5, 10, '#3a2010', 2.8);
  pupil(c, a, t, 14, -188, 2); pupil(c, a, t, 29, -188, 2);
  if (hd(c)) { lensGlint(c, 8, -192); lensGlint(c, 23, -192); }   // Brillenglas-Reflex
  if (po && a.pose.kind === 'think') floaters(c, a, t, 30, -214, 2, (x, y, s) => txt(c, '?', x, y, `800 ${Math.round(18 * s)}px "Baloo 2", sans-serif`, '#ffe066', 'center', 4, OUT), po.mix);
  // Knollennase
  shape(c, '#efb48c', [21, -184, 38, -166], () => { c.moveTo(22, -180); c.quadraticCurveTo(31, -184, 35, -176); c.quadraticCurveTo(38, -168, 30, -167); c.quadraticCurveTo(24, -167, 22, -172); c.closePath(); });
  if (hd(c)) E(c, 30, -170.5, 1.7, 1.1, 'rgba(90,40,30,0.55)', 0);
  if (mo || (po && po.chew && Math.floor(t / 140) % 2)) { const k = mouthK(a, t); E(c, 18, -164, 5 * k[0], 4 * k[1], '#7a2222', 2); } else S(c, null, 2.5, () => { c.moveTo(11, -165); c.quadraticCurveTo(17, -161, 23, -166); }, OUT);
  const gB = po ? 0 : gesture(a, t);
  arm(c, 7, -144, poseAng((-0.12 + sw * 0.45 + talkArm(a, t)) * (1 - gB) - 2.75 * gB, po, 'front'), shirt, 18, skin, 50, 9, 5.5, poseAng(elbow(a, 1) * (1 - gB), po, 'fb'));
  c.restore();
};

CHAR.hoagie = (c, a, t) => {
  const gH = gesture(a, t), drum = Math.sin(t * 0.03) * 0.45 * gH;
  const sw = swing(a), b = bobY(a, t) + Math.abs(Math.sin(t * 0.015)) * 3 * gH, mo = mouthOpen(a, t);
  const skin = '#e9b088', shirt = '#26232c', jeans = '#3d5fa6', jeansB = '#34518e', boot = '#3a2416', hair = '#1d1a1e';
  const po = pose(a, t), sq = squat(a, t), cr = crouch(a, t, 64);
  limb(c, -10, -70 + cr, 20, 64, -sw * 0.35 - sq * 0.45, jeansB, { l: 16, h: 8, dx: 6, fill: boot }, poseKnee(a, t, -1));
  const ag = po && a.pose.kind === 'airguitar';
  if (!ag) { c.save(); c.translate(0, b + cr); lean(c, a, -70); arm(c, -22, -126, poseAng(0.1 - sw * 0.4 - gH * 0.9 + drum, po, 'back'), shirt, 16, skin, 44, 15, 8, poseAng(elbow(a, -1) + gH * 0.8, po, 'bb')); c.restore(); }
  limb(c, 10, -70 + cr, 20, 64, sw * 0.35 - sq * 0.55, jeans, { l: 16, h: 8, dx: 6, fill: boot }, poseKnee(a, t, 1));
  c.save(); c.translate(0, b + cr + nod(a, t) + (ag ? po.bang * 4 * po.mix : 0)); lean(c, a, -70);
  R(c, -24, -82, 50, 18, jeans, 3, 7);
  if (hd(c)) { L(c, [-16, -80, -16, -66], 1.3, 'rgba(255,230,160,0.35)'); L(c, [18, -80, 18, -66], 1.3, 'rgba(255,230,160,0.35)'); R(c, -6, -80, 6, 5, '#6a6a7a', 1, 1); }
  // lange Haare hinten, unten in Strähnen auslaufend
  shape(c, hair, [-40, -170, 2, -100], () => { c.moveTo(-14, -168); c.quadraticCurveTo(-40, -152, -34, -112); c.quadraticCurveTo(-31, -101, -25, -108); c.quadraticCurveTo(-20, -100, -15, -108); c.quadraticCurveTo(-9, -104, -6, -114); c.quadraticCurveTo(-10, -140, 2, -150); c.closePath(); });
  if (hd(c)) for (const [x0, y0, x1, y1] of [[-22, -150, -28, -116], [-15, -152, -19, -112], [-27, -140, -31, -114]]) L(c, [x0, y0, x1, y1], 1.2, 'rgba(140,130,160,0.35)');
  // Birnen-Bauch: schmalere Schultern, Bauch hängt über den Hosenbund
  shape(c, shirt, [-38, -150, 46, -62], () => { c.moveTo(-20, -142); c.quadraticCurveTo(-34, -132, -36, -108); c.quadraticCurveTo(-38, -80, -24, -68); c.quadraticCurveTo(4, -60, 34, -70); c.quadraticCurveTo(48, -84, 44, -106); c.quadraticCurveTo(40, -134, 26, -144); c.quadraticCurveTo(4, -150, -20, -142); c.closePath(); });
  if (hd(c)) {
    for (const k of [0, 1, 2]) S(c, null, 1.5, () => { c.moveTo(-20 + k * 4, -92 + k * 10); c.quadraticCurveTo(-4 + k * 4, -86 + k * 10, 12 + k * 3, -94 + k * 10); }, 'rgba(255,255,255,0.09)');
    L(c, [-24, -140, -27, -118], 1.5, 'rgba(255,255,255,0.12)'); L(c, [-18, -150, -22, -126], 1.5, 'rgba(255,255,255,0.1)');
  }
  E(c, 10, -66, 15, 4.5, skin, 2);
  if (hd(c)) for (let i = 0; i <= 8; i++) { const u = i / 8; E(c, 24 + u * 12, -64 + Math.sin(u * Math.PI) * 7, 1.4, 1.1, '#d0d0dc', 0.9, u, '#6a6a7a'); }   // Portemonnaie-Kette
  P(c, [-2, -126, 14, -126, 5, -110, 16, -110, -6, -86, 1, -104, -10, -104], '#f2f2f2', 2);
  if (hd(c)) E(c, 10, -129, 17, 5, 'rgba(0,0,0,0.3)', 0);   // Kinnschatten auf dem Shirt
  // Kopf mit Hängebacken
  shape(c, skin, [-14, -175, 32, -126], () => { c.moveTo(-12, -150); c.quadraticCurveTo(-14, -173, 7, -174); c.quadraticCurveTo(29, -174, 31, -152); c.quadraticCurveTo(32, -134, 19, -129); c.quadraticCurveTo(3, -126, -6, -133); c.quadraticCurveTo(-12, -139, -12, -150); c.closePath(); });
  if (hd(c)) E(c, 9, -159.5, 19, 3.2, 'rgba(90,40,30,0.3)', 0);   // Schatten der Kappe auf der Stirn
  E(c, 15, -140, 15, 9, 'rgba(70,45,45,0.22)', 0);
  S(c, '#c8322e', 3, () => { c.moveTo(-15, -158); c.quadraticCurveTo(-12, -184, 10, -183); c.quadraticCurveTo(30, -182, 29, -160); c.closePath(); });
  P(c, [-13, -162, -36, -157, -34, -150, -11, -155], '#9e2420');
  L(c, [12, -182, 12, -161], 2, '#9e2420');
  if (hd(c)) {
    E(c, 8, -183, 3.5, 2.2, '#9e2420', 1.2);   // Knopf auf der Kappe
    L(c, [-8, -175, 4, -180, 18, -178], 2.6, 'rgba(255,255,255,0.22)');
    for (const [x, y] of [[15, -137], [19, -135], [24, -135], [28, -137], [17, -132], [22, -131], [27, -133]]) E(c, x, y, 0.7, 0.7, 'rgba(60,35,35,0.45)', 0);   // Bartstoppeln
  }
  E(c, 18, -154, 4.2, 4.6, '#fffaf2', 1.6); E(c, 27, -154, 4, 4.4, '#fffaf2', 1.6);
  pupil(c, a, t, 18, -154, 2.3); pupil(c, a, t, 27, -154, 2.3);
  if (!blinking(a, t)) for (const [x, r] of [[18, 4.2], [27, 4]]) S(c, skin, 1.5, () => { c.moveTo(x - r - 0.6, -154); c.quadraticCurveTo(x, -161.5, x + r + 0.6, -154); c.quadraticCurveTo(x, -156.2, x - r - 0.6, -154); c.closePath(); }, '#7a4a3a');   // schwere, entspannte Lider
  brows(c, a, t, 17, 27.5, -161, 8, OUT, 3);
  shape(c, '#df9a72', [24, -155, 38, -140], () => { c.moveTo(25, -152); c.quadraticCurveTo(34, -155, 37, -148); c.quadraticCurveTo(38, -141, 31, -141); c.quadraticCurveTo(26, -141, 25, -145); c.closePath(); });   // breite Nase
  if (mo || ag || (po && po.chew && Math.floor(t / 140) % 2)) { const k = ag ? [1, 1] : mouthK(a, t); E(c, 20, -136, 7 * k[0], (ag ? 6 : 5) * k[1], '#6e1f1f', 2.5); }
  else S(c, null, 2.5, () => { c.moveTo(12, -139); c.quadraticCurveTo(20, -132, 28, -139); });
  P(c, [17, -131.5, 24, -131.5, 20.5, -124], hair, 1.5);   // Kinnbart
  if (po && po.chew) E(c, 22, -136, 5, 4.5, '#d8343a', 1.5);   // der Apfel in der Hand vorm Mund
  if (ag) arm(c, -22, -126, poseAng(0.1, po, 'back'), shirt, 16, skin, 44, 15, 8, poseAng(0.12, po, 'bb'));   // Luftgitarre: Greifhand vor dem Bauch
  arm(c, 24, -126, poseAng(-0.1 + sw * 0.4 - gH * 0.9 - drum + talkArm(a, t), po, 'front'), shirt, 16, skin, 44, 15, 8, poseAng(elbow(a, 1) + gH * 0.8, po, 'fb'));
  if (ag) floaters(c, a, t, 44, -168, 3, (x, y, s, i) => noteGlyph(c, x, y, s, ['#ffd23a', '#ff7ab8', '#7fe8ff'][i]), po.mix);
  c.restore();
};

function stocking(c, px, py, ang, back, bend = 0) {
  // Ringelstrumpf-Stück von y0 bis y1 (Streifen laufen über das Knie hinweg weiter)
  const piece = (y0, y1) => {
    R(c, -4.5, y0, 9, y1 - y0, back ? '#e8e0e0' : '#f6f0f0', 0, 4);
    c.save(); c.beginPath(); c.roundRect(-4.5, y0, 9, y1 - y0, 4); c.clip();
    c.fillStyle = back ? '#b42a3a' : '#d8344a';
    for (let y = 6; y < 74; y += 12) c.fillRect(-6, y, 12, 5);
    c.restore();
    R(c, -4.5, y0, 9, y1 - y0, null, 3, 4);
  };
  c.save(); c.translate(px, py); c.rotate(ang);
  if (bend > 0.02) {
    c.save(); c.translate(0, 37); c.rotate(bend); c.translate(0, -37);
    piece(34, 74); c.translate(6, 74); c.rotate(-bend * 0.8 - ang * 0.5); shoe(c, 0, 0, 11, 5.5, '#2a2430');
    c.restore();
    piece(0, 40);
  } else { piece(0, 74); shoe(c, 6, 74, 11, 5.5, '#2a2430'); }
  c.restore();
}

CHAR.laverne = (c, a, t) => {
  const sw = swing(a), b = a.climb ? 0 : bobY(a, t), mo = mouthOpen(a, t), cl = a.climb ? Math.sin(a.phase || 0) : 0;
  const skin = '#f7e0cd', dress = '#3e9e5e', dressB = '#348650', hair = '#18141d';
  if (a.climb) { c.translate(0, -80); c.rotate(-0.1); c.translate(0, 80); }   // beim Klettern zum Stamm geneigt
  const po = a.climb ? null : pose(a, t), sq = a.climb ? 0 : squat(a, t), cr = a.climb ? 0 : crouch(a, t, 74);
  stocking(c, -4, -80 + cr, a.climb ? -0.55 + cl * 0.45 : -sw * 0.45 - sq * 0.45, true, a.climb ? 0.9 + cl * 0.5 : poseKnee(a, t, -1));
  c.save(); c.translate(0, b + cr); lean(c, a, -80); arm(c, -5, -138, a.climb ? -2.75 + cl * 0.45 : poseAng(0.15 - sw * 0.45, po, 'back'), dressB, 36, skin, 48, 8, 5.5, a.climb ? 0.35 : poseAng(elbow(a, -1), po, 'bb')); c.restore();
  stocking(c, 5, -80 + cr, a.climb ? -0.55 - cl * 0.45 : sw * 0.45 - sq * 0.55, false, a.climb ? 0.9 - cl * 0.5 : poseKnee(a, t, 1));
  c.save(); c.translate(0, b + cr + nod(a, t)); lean(c, a, -80);
  P(c, [-6, -186, -26, -196, -20, -178, -34, -170, -20, -160, -30, -146, -12, -150, -4, -140, 6, -160], hair);
  shape(c, dress, [-26, -146, 27, -69], () => {
    c.moveTo(-12, -143); c.quadraticCurveTo(-18, -139, -16, -124); c.quadraticCurveTo(-16, -104, -22, -82); c.quadraticCurveTo(-27, -74, -20, -72);
    c.quadraticCurveTo(-10, -77, 0, -73); c.quadraticCurveTo(10, -69, 19, -73); c.quadraticCurveTo(28, -75, 24, -82);
    c.quadraticCurveTo(17, -104, 16, -124); c.quadraticCurveTo(17, -139, 12, -143); c.quadraticCurveTo(0, -147, -12, -143); c.closePath();
  });
  S(c, null, 2, () => { c.moveTo(-21, -84); c.quadraticCurveTo(-10, -88, 1, -84); c.quadraticCurveTo(12, -80, 23, -85); }, '#2f7a48');
  if (hd(c)) { L(c, [-5, -134, -12, -86], 1.5, 'rgba(0,0,0,0.18)'); L(c, [6, -134, 11, -86], 1.5, 'rgba(0,0,0,0.18)'); L(c, [-1, -138, 0, -90], 1.2, 'rgba(255,255,255,0.12)'); }
  R(c, -2, -158, 8, 16, skin, 3, 3);
  E(c, -3, -142, 7, 3.6, '#f6f0f0', 2); E(c, 9, -142, 7, 3.6, '#f6f0f0', 2);   // Bubikragen
  for (const y of [-130, -118, -106]) E(c, 2, y, 1.7, 1.7, '#2f7a48', 1);   // Knöpfe
  if (hd(c)) E(c, 3.5, -148.5, 5.5, 2.6, 'rgba(150,90,80,0.38)', 0);   // Halsschatten
  // Gesicht mit spitzem Kinn
  shape(c, skin, [-11, -189, 24, -146], () => { c.moveTo(-10, -170); c.quadraticCurveTo(-10, -188, 6, -189); c.quadraticCurveTo(23, -189, 23, -171); c.quadraticCurveTo(22, -157, 13, -150); c.quadraticCurveTo(7, -146, 2, -150); c.quadraticCurveTo(-9, -157, -10, -170); c.closePath(); });
  if (hd(c)) E(c, 7, -184.5, 15, 4, 'rgba(40,20,60,0.24)', 0);   // Haarschatten auf der Stirn
  P(c, [-12, -176, -14, -196, -2, -188, 2, -208, 10, -190, 20, -204, 22, -186, 32, -190, 24, -176, 14, -182, 4, -178], hair);
  const yw = po && a.pose.kind === 'yawn' && po.mix > 0.45;
  if (blinking(a, t) || yw) { E(c, 13, -170, 5.5, 6.5, skin, 2.5); E(c, 25, -170, 5, 6.5, skin, 2.5); L(c, [8, -170, 18, -170], 2.2); L(c, [21, -170, 30, -170], 2.2); }
  else {
    E(c, 13, -170, 5.5, 6.5, '#fff', 2.5); E(c, 25, -170, 5, 6.5, '#fff', 2.5);
    if (hd(c)) { E(c, 13, -174, 4.6, 2.2, 'rgba(120,100,150,0.22)', 0); E(c, 25, -174, 4.2, 2.2, 'rgba(120,100,150,0.22)', 0); }   // gewölbte Augäpfel
    pupil(c, a, t, 15, -169, 2); pupil(c, a, t, 27, -169, 2);
    brows(c, a, t, 13, 25, -179.5, 8, '#18141d', 2.2);
    if (hd(c)) {
      E(c, 14.2, -170, 0.85, 0.85, '#fff', 0); E(c, 26.2, -170, 0.85, 0.85, '#fff', 0);
      S(c, null, 1.5, () => { c.moveTo(7.5, -175.5); c.quadraticCurveTo(13, -179.5, 18.5, -175.5); c.moveTo(20, -175.5); c.quadraticCurveTo(25, -179.5, 30, -175.5); }, 'rgba(110,60,130,0.55)');   // Lidschatten
      L(c, [18.3, -174.5, 21, -177.5], 1.4); L(c, [29.8, -174.5, 32.5, -177.5], 1.4);   // Wimpern
    }
  }
  if (hd(c)) {
    for (const [x0, y0, x1, y1] of [[1, -202, 5, -191], [13, -199, 15, -189], [24, -186, 20, -182], [-10, -190, -6, -180]]) L(c, [x0, y0, x1, y1], 2, 'rgba(170,150,255,0.35)');
    E(c, 20, -160, 4, 2.4, 'rgba(240,120,130,0.22)', 0);
  }
  if (hd(c)) for (const [x, y] of [[16, -162], [19, -160.5], [22, -162], [28, -161.5]]) E(c, x, y, 0.8, 0.8, 'rgba(170,110,80,0.6)', 0);   // Sommersprossen
  shape(c, '#efc4ac', [22, -165, 29, -155], () => { c.moveTo(23, -164); c.quadraticCurveTo(28.5, -160, 28, -157); c.quadraticCurveTo(25, -155, 23, -158); c.closePath(); }, 2);   // Stupsnase
  if (yw) E(c, 18, -151, 4.4, 6, '#7a2222', 2); else if (mo) { const k = mouthK(a, t); E(c, 18, -151, 4 * k[0], 3.5 * k[1], '#7a2222', 2); } else S(c, null, 2.4, () => { c.moveTo(13, -151); c.quadraticCurveTo(17, -148.5, 21.5, -153); }, OUT);   // schiefes Grinsen
  const gL = gesture(a, t);
  if (a.climb) arm(c, 6, -138, -2.55 - cl * 0.45, dress, 36, skin, 48, 8, 5.5, 0.35);
  else arm(c, 6, -138, poseAng((-0.15 + sw * 0.45 + talkArm(a, t)) * (1 - gL) + (-2.9 + Math.sin(t * 0.02) * 0.35) * gL, po, 'front'), dress, 36, skin, 48, 8, 5.5, poseAng(elbow(a, 1) * (1 - gL), po, 'fb'));
  drawGnat(c, a, t);
  c.restore();
};

CHAR.drfred = (c, a, t) => {
  const sw = swing(a), b = bobY(a, t), mo = mouthOpen(a, t);
  const skin = '#f0c6a0', coat = '#f4f4f2', hairW = '#ffffff';
  limb(c, -5, -64, 11, 58, -sw * 0.4, '#30303e', { l: 13, h: 5.5, dx: 6, fill: '#1d1d1d' }, knee(a, -1));
  limb(c, 5, -64, 11, 58, sw * 0.4, '#3a3a4a', { l: 13, h: 5.5, dx: 6, fill: '#1d1d1d' }, knee(a, 1));
  c.save(); c.translate(0, b + nod(a, t)); c.rotate(0.08); lean(c, a, -64);
  arm(c, -8, -118, 0.25 - sw * 0.3, coat, 40, skin, 46, 10, 5.5, elbow(a, -1));
  shape(c, coat, [-28, -129, 27, -36], () => { c.moveTo(-16, -125); c.quadraticCurveTo(-24, -80, -27, -40); c.quadraticCurveTo(-1, -34, 26, -41); c.quadraticCurveTo(22, -84, 13, -126); c.quadraticCurveTo(-2, -130, -16, -125); c.closePath(); });
  L(c, [2, -124, 8, -42], 2);
  R(c, 8, -110, 10, 12, '#e6e6e6', 2, 2);
  L(c, [11, -112, 11, -104], 2, '#3a7ad8');
  if (hd(c)) {
    L(c, [14, -112, 14, -104], 2, '#d84a3a');
    for (const y of [-96, -78, -60]) E(c, 5 + (y + 96) * -0.05, y, 2, 2, '#d0d0d4', 1.2);
    L(c, [-14, -96, -19, -52], 1.5, 'rgba(0,0,0,0.12)'); L(c, [18, -100, 22, -54], 1.5, 'rgba(0,0,0,0.12)');
  }
  // wilder weißer Haarkranz: zerzauste Büschel nach hinten, oben eine blanke Glatze
  shape(c, hairW, [-36, -180, 0, -112], () => { c.moveTo(-2, -166); c.quadraticCurveTo(-10, -180, -16, -166); c.quadraticCurveTo(-30, -170, -24, -154); c.quadraticCurveTo(-36, -148, -25, -139); c.quadraticCurveTo(-33, -126, -19, -125); c.quadraticCurveTo(-15, -112, -6, -122); c.quadraticCurveTo(-1, -142, -2, -166); c.closePath(); });
  if (hd(c)) for (const [x0, y0, x1, y1] of [[-12, -160, -20, -156], [-14, -148, -26, -146], [-12, -136, -22, -130], [-8, -126, -12, -120]]) L(c, [x0, y0, x1, y1], 1.3, 'rgba(150,150,175,0.6)');
  // Kopf: hohe kahle Stirn, langes Kinn
  shape(c, skin, [-9, -168, 32, -114], () => { c.moveTo(-7, -146); c.quadraticCurveTo(-9, -168, 11, -168); c.quadraticCurveTo(30, -168, 31, -147); c.quadraticCurveTo(32, -128, 24, -121); c.quadraticCurveTo(15, -114, 6, -119); c.quadraticCurveTo(-5, -126, -7, -146); c.closePath(); });
  E(c, -5, -141, 4.5, 6.5, skin, 2.5);   // Ohr
  if (hd(c)) {
    S(c, null, 1.3, () => { c.moveTo(-6, -144); c.quadraticCurveTo(-3, -141, -6, -137); }, 'rgba(150,80,60,0.6)');
    E(c, 6, -160, 10, 4.5, 'rgba(255,255,255,0.45)', 0);   // Glanz auf der Glatze
    for (const y of [-161, -157]) S(c, null, 1.2, () => { c.moveTo(12, y); c.quadraticCurveTo(19, y - 2.5, 26, y); }, 'rgba(150,80,60,0.45)');   // Stirnfalten
    E(c, 24, -125, 6, 3.5, 'rgba(220,110,100,0.28)', 0);
  }
  L(c, [9, -149, -3, -144], 2.2);   // Brillenbügel
  E(c, 16, -148, 8, 8, '#d7f0ff', 4); E(c, 31, -148, 8, 8, '#d7f0ff', 4);
  if (hd(c)) { E(c, 16, -144.5, 6, 3.2, 'rgba(120,160,200,0.25)', 0); E(c, 31, -144.5, 6, 3.2, 'rgba(120,160,200,0.25)', 0); }
  pupil(c, a, t, 17, -147, 3); pupil(c, a, t, 32, -147, 3);
  brows(c, a, t, 16, 31, -159, 11, '#f4f4f8', 3.4);
  if (hd(c)) { lensGlint(c, 11, -152, 4); lensGlint(c, 26, -152, 4); S(c, null, 1.2, () => { c.moveTo(11, -136.5); c.quadraticCurveTo(16, -134.5, 21, -136.5); }, 'rgba(150,80,60,0.5)'); }   // Tränensäcke
  // Hakennase
  shape(c, '#e9a888', [28, -148, 45, -128], () => { c.moveTo(30, -146); c.quadraticCurveTo(40, -147, 43, -137); c.quadraticCurveTo(45, -129, 37, -130); c.quadraticCurveTo(31, -130, 30, -135); c.closePath(); });
  if (hd(c)) E(c, 37, -132, 1.8, 1.2, 'rgba(90,40,30,0.55)', 0);
  if (mo) { const k = mouthK(a, t); E(c, 25, -125, 6.5 * k[0], 4.8 * k[1], '#6a1a1a', 2); R(c, 25 - 4.5 * k[0], -125 - 4 * k[1], 9 * k[0], 2.4, '#fffaf0', 0, 1); }
  else { S(c, null, 2.5, () => { c.moveTo(18, -127); c.quadraticCurveTo(24, -122, 31, -128); }, OUT); if (hd(c)) L(c, [31, -129.5, 32.5, -126.5], 1.4); }   // schiefes Grinsen
  const gF = gesture(a, t);
  if (gF > 0.15) {   // Geistesblitz: Glühbirne über dem Kopf
    const by = -186 - gF * 10;
    c.save(); c.globalAlpha *= Math.min(1, gF * 1.6);
    if (hd(c) && !HDS.ink) { const g = c.createRadialGradient(8, by, 2, 8, by, 32); g.addColorStop(0, 'rgba(255,240,140,0.6)'); g.addColorStop(1, 'rgba(255,240,140,0)'); c.fillStyle = g; c.fillRect(-24, by - 32, 64, 64); }
    E(c, 8, by, 8, 9, '#fff3a0', 2.5); R(c, 4, by + 7, 8, 6, '#a8a8b8', 2, 1.5);
    L(c, [5, by + 3, 8, by - 3, 11, by + 3], 1.4, '#d8a020');
    if (gF > 0.5) for (let i = 0; i < 5; i++) { const an = -Math.PI / 2 + (i - 2) * 0.5; L(c, [8 + Math.cos(an) * 14, by + Math.sin(an) * 14, 8 + Math.cos(an) * 20, by + Math.sin(an) * 20], 2, '#ffd23a'); }
    c.restore();
  }
  arm(c, 8, -118, (-0.2 + sw * 0.3 + talkArm(a, t)) * (1 - gF) + (-2.35 + Math.sin(t * 0.025) * 0.12) * gF, coat, 40, skin, 46, 10, 5.5, elbow(a, 1) * (1 - gF) + gF * 0.9);
  c.restore();
};

CHAR.gertrude = (c, a, t) => {
  const b = bobY(a, t), mo = mouthOpen(a, t), sw = swing(a);
  const skin = '#f5c9a6';
  c.save(); c.translate(0, b + nod(a, t));
  S(c, '#3d6fb6', 3, () => {
    c.moveTo(-18, -92); c.quadraticCurveTo(-34 - sw * 3, -40, -42, 0); c.lineTo(44, 0);
    c.quadraticCurveTo(34 + sw * 3, -40, 18, -92); c.closePath();
  });
  if (hd(c)) for (let y = -80; y < -6; y += 13) for (let x = -36; x < 38; x += 12) {   // Pünktchenmuster auf dem Rock
    const half = 18 + (y + 92) / 92 * 24, xx = x + ((y / 13) % 2 ? 6 : 0);
    if (Math.abs(xx) < half - 5 && !(xx > -4 && xx < 26)) E(c, xx, y, 1.6, 1.6, 'rgba(255,255,255,0.5)', 0);
  }
  P(c, [-2, -92, 18, -92, 30, -8, 0, -8], '#f6f2e6', 2.5);
  if (hd(c)) { L(c, [6, -86, 10, -12], 1.3, 'rgba(0,0,0,0.12)'); L(c, [16, -86, 22, -12], 1.3, 'rgba(0,0,0,0.12)'); }
  const wk = idleAct(a, t, 11000, 2600), we = actEnv(wk), rub = Math.sin(t * 0.022) * 0.28, hk = idleAct(a, t, 13000, 3800, 6000);
  arm(c, -10, -134, 0.2 * (1 - we) + (-0.45 + rub) * we, '#f6f2e6', 16, skin, 44, 9, 5.5, 0.9 * we);
  P(c, [-16, -90, 18, -90, 16, -140, -14, -140], '#7a4a2a');
  P(c, [-14, -140, 16, -140, 2, -118], '#f6f2e6', 2);
  R(c, -2, -152, 9, 14, skin, 3, 3);
  // Haube: bauschiger Stoff hinten, Haarknoten darunter
  shape(c, '#ffffff', [-27, -190, 18, -146], () => { c.moveTo(-10, -148); c.quadraticCurveTo(-27, -152, -25, -170); c.quadraticCurveTo(-22, -190, -2, -189); c.quadraticCurveTo(14, -188, 18, -176); c.lineTo(-10, -148); c.closePath(); });
  if (hd(c)) for (const [x0, y0, x1, y1] of [[-18, -178, -12, -168], [-10, -184, -6, -172], [-20, -164, -13, -160]]) L(c, [x0, y0, x1, y1], 1.2, 'rgba(160,150,180,0.55)');   // Stofffalten
  E(c, -7, -153, 6, 5, '#8a5a3a', 2);
  // rundes Gesicht mit Doppelkinn
  shape(c, skin, [-12, -180, 24, -139], () => { c.moveTo(-11, -161); c.quadraticCurveTo(-12, -179, 6, -179); c.quadraticCurveTo(23, -179, 23, -161); c.quadraticCurveTo(24, -146, 12, -142); c.quadraticCurveTo(1, -139, -5, -146); c.quadraticCurveTo(-11, -152, -11, -161); c.closePath(); });
  if (hd(c)) { S(c, null, 1.3, () => { c.moveTo(4, -143.5); c.quadraticCurveTo(10, -140.5, 16, -143.5); }, 'rgba(160,90,70,0.5)'); E(c, 6, -173, 13, 3.6, 'rgba(120,70,60,0.18)', 0); }
  for (const [x, y] of [[-6, -169], [-2, -173]]) E(c, x, y, 3.2, 2.8, '#8a5a3a', 1.5);   // Löckchen an der Schläfe
  // Spitzenrand der Haube mit blauem Band
  shape(c, '#ffffff', [-16, -190, 27, -168], () => { c.moveTo(-15, -169); c.quadraticCurveTo(-14, -188, 5, -189); c.quadraticCurveTo(24, -189, 27, -172); c.quadraticCurveTo(14, -178, 5, -178); c.quadraticCurveTo(-6, -178, -15, -169); c.closePath(); });
  L(c, [-12, -179, 3, -185, 21, -182], 2.6, '#5a86d0');
  if (hd(c)) for (let i = 0; i < 7; i++) S(c, null, 1.3, () => { const x = -13 + i * 5.6, y0 = -172 - Math.sin(i / 7 * Math.PI) * 5.5, y1 = -172 - Math.sin((i + 1) / 7 * Math.PI) * 5.5; c.moveTo(x, y0); c.quadraticCurveTo(x + 2.8, (y0 + y1) / 2 + 3.5, x + 5.6, y1); }, 'rgba(160,150,170,0.7)');   // Rüschen
  E(c, 17, -152, 5, 3.5, 'rgba(240,120,130,0.55)', 0); E(c, 2, -153, 4, 3, 'rgba(240,120,130,0.4)', 0);
  E(c, 11.5, -163, 3.4, 4, '#fffaf2', 1.4); E(c, 21.5, -163, 3.2, 3.8, '#fffaf2', 1.4);
  pupil(c, a, t, 12, -163, 1.9); pupil(c, a, t, 22, -163, 1.9);
  brows(c, a, t, 11.5, 21.5, -170, 6, '#7a5a40', 1.8);
  if (hd(c)) { L(c, [14.8, -165.5, 16.6, -167.5], 1.2); L(c, [24.6, -165.5, 26.4, -167.5], 1.2); }   // Wimpern
  shape(c, '#eeb090', [21, -160, 30, -151], () => { c.moveTo(22, -159); c.quadraticCurveTo(29, -159, 29.5, -155); c.quadraticCurveTo(29, -151, 24, -151.5); c.quadraticCurveTo(21, -153, 22, -159); c.closePath(); }, 2);   // Knubbelnase
  if (mo) { const k = mouthK(a, t); E(c, 17, -147, 5 * k[0], 4 * k[1], '#7a2222', 2); }
  else if (hk >= 0) E(c, 17, -147, 2.6, 2.8, '#7a2222', 1.5);   // summt vor sich hin
  else S(c, null, 2.5, () => { c.moveTo(12, -149); c.quadraticCurveTo(17, -145, 22, -149); });
  arm(c, 10, -134, (-0.3 + talkArm(a, t)) * (1 - we) + (-0.55 - rub) * we, '#f6f2e6', 16, skin, 44, 9, 5.5, 0.15 + (a.talking ? 0.6 : 0) + 0.8 * we);
  if (hk >= 0) floaters(c, a, t, 24, -186, 2, (x, y, s) => noteGlyph(c, x, y, s, '#ff7ab8'), actEnv(hk));
  c.restore();
};

CHAR.hancock = (c, a, t) => {
  const sw = swing(a), b = bobY(a, t), mo = mouthOpen(a, t);
  const skin = '#f2c4a0', coat = '#2f4f8f', vest = '#e8d9b0';
  limb(c, -4, -82, 11, 76, -sw * 0.4, '#e6e0d2', { l: 13, h: 5.5, dx: 6, fill: '#1d1d1d' }, knee(a, -1));
  limb(c, 5, -82, 11, 76, sw * 0.4, '#f6f2e8', { l: 13, h: 5.5, dx: 6, fill: '#1d1d1d' }, knee(a, 1));
  c.save(); c.translate(0, b + nod(a, t)); lean(c, a, -82);
  R(c, -14, -96, 31, 24, vest, 3, 7);
  P(c, [-12, -142, -32, -54, -10, -60, 2, -120], coat);
  P(c, [-12, -142, 16, -142, 18, -88, -12, -88], vest);
  P(c, [-14, -144, 2, -144, -4, -84, -16, -88], coat);
  P(c, [10, -144, 20, -142, 24, -88, 14, -90], coat);
  for (let i = 0; i < 3; i++) E(c, 8, -130 + i * 14, 2, 2, '#d8b040', 1);
  if (hd(c)) { L(c, [-14, -143, -16, -88], 1.8, '#d8b040'); L(c, [20, -141, 24, -89], 1.8, '#d8b040'); for (const y of [-112, -100]) L(c, [-2, y, 12, y + 1], 1.2, 'rgba(120,90,40,0.3)'); }
  E(c, 6, -138, 6, 8, '#fff', 2);
  if (hd(c)) for (let i = 0; i < 3; i++) S(c, null, 1.2, () => { c.moveTo(1, -142 + i * 4); c.quadraticCurveTo(6, -139 + i * 4, 11, -142 + i * 4); }, 'rgba(150,150,170,0.6)');
  R(c, -2, -152, 9, 12, skin, 3, 3);
  // gepuderte Perücke mit Zopf und schwarzer Schleife
  S(c, '#f4f4f4', 3, () => { c.moveTo(-10, -168); c.quadraticCurveTo(-31, -160, -27, -136); c.lineTo(-18, -138); c.quadraticCurveTo(-20, -154, -6, -160); c.closePath(); });
  P(c, [-23, -144, -33, -151, -32, -137], '#1d1d1d', 2); P(c, [-23, -144, -15, -152, -14, -139], '#1d1d1d', 2); E(c, -23, -144, 3, 3, '#2a2a2a', 1.5);
  // Gesicht: kräftiges Kinn, leichte Hängebacken
  shape(c, skin, [-13, -181, 23, -138], () => { c.moveTo(-12, -163); c.quadraticCurveTo(-12, -181, 6, -181); c.quadraticCurveTo(22, -181, 22, -163); c.quadraticCurveTo(23, -147, 15, -142); c.quadraticCurveTo(5, -137, -3, -142); c.quadraticCurveTo(-12, -149, -12, -163); c.closePath(); });
  if (hd(c)) { S(c, null, 1.3, () => { c.moveTo(8, -142); c.quadraticCurveTo(10, -140, 12, -142); }, 'rgba(150,80,60,0.55)'); E(c, 17, -152, 5, 3, 'rgba(230,110,100,0.3)', 0); E(c, 4, -176, 12, 3, 'rgba(120,70,60,0.2)', 0); }
  for (const y of [-160, -149]) { E(c, -9, y, 7.5, 5.8, '#f4f4f4', 2.5); if (hd(c)) S(c, null, 1.2, () => { c.ellipse(-9, y, 3.6, 2.4, 0, 0.4, 5.6); }, 'rgba(150,150,170,0.7)'); }   // Lockenrollen
  E(c, 2, -175, 16, 7.5, '#f4f4f4', 2.5);
  // Dreispitz mit Goldborte und Kokarde
  shape(c, '#1d1d1d', [-27, -202, 32, -170], () => { c.moveTo(-27, -175); c.quadraticCurveTo(-20, -192, 2, -201); c.quadraticCurveTo(22, -194, 32, -177); c.quadraticCurveTo(18, -183, 3, -181); c.quadraticCurveTo(-12, -181, -27, -175); c.closePath(); });
  S(c, null, 2, () => { c.moveTo(-24, -176.5); c.quadraticCurveTo(-11, -182.5, 3, -182.5); c.quadraticCurveTo(18, -184.5, 30, -178); }, '#d8b040');
  if (hd(c)) L(c, [-14, -186, -2, -196, 6, -197], 1.6, 'rgba(255,255,255,0.18)');
  E(c, 21, -186, 4.2, 4.2, '#2a2a3a', 1.6); E(c, 21, -186, 1.6, 1.6, '#d8b040', 0);
  E(c, 11.5, -163, 3.5, 4, '#fffaf2', 1.4); E(c, 21.5, -163, 3.3, 3.9, '#fffaf2', 1.4);
  pupil(c, a, t, 12, -163, 2); pupil(c, a, t, 22, -163, 2);
  brows(c, a, t, 11.5, 21.5, -170.5, 7, '#6a5040', 2.4);
  // Adlernase
  shape(c, '#e9aa88', [20, -166, 31, -150], () => { c.moveTo(21, -165); c.quadraticCurveTo(27, -162, 30, -153); c.quadraticCurveTo(28, -150, 23, -151.5); c.quadraticCurveTo(21, -153, 21, -165); c.closePath(); }, 2.2);
  if (mo) { const k = mouthK(a, t); E(c, 16.5, -146, 5 * k[0], 4 * k[1], '#7a2222', 2); } else S(c, null, 2.5, () => { c.moveTo(11, -147.5); c.quadraticCurveTo(16, -145, 21, -148.5); }, OUT);   // selbstgefälliges Lächeln
  const sk = idleAct(a, t, 8000, 1700), se = actEnv(sk);
  c.save(); c.translate(12, -138);
  c.rotate(-0.5 + (a.talking ? Math.sin(t * 0.01) * 0.15 : Math.sin(t * 0.004) * 0.08) + se * (-0.35 + Math.sin(t * 0.045) * 0.14));
  R(c, -5, 0, 10, 40, coat, 3, 5); R(c, -6, 34, 12, 8, '#fff', 2, 3); E(c, 0, 46, 6, 6, skin);
  c.save(); c.translate(0, 46); c.rotate(-0.9);
  S(c, '#fffdf4', 2.5, () => { c.moveTo(0, 0); c.quadraticCurveTo(14, -30, 6, -64); c.quadraticCurveTo(-8, -34, 0, 0); c.closePath(); });
  L(c, [0, 0, 6, -60], 1.5, '#b8b0a0');
  c.restore(); c.restore();
  if (sk >= 0) {   // goldener Schnörkel, als würde er in die Luft unterschreiben
    const n = Math.floor(sk * 30), pts = [];
    for (let i = 0; i <= n; i++) { const s = i / 30; pts.push(40 + s * 48 + Math.cos(s * 22) * 6, -170 + Math.sin(s * 22) * 7 - s * 10); }
    c.save(); c.globalAlpha *= se;
    if (pts.length > 3) { L(c, pts, 3.4, 'rgba(60,30,0,0.35)'); L(c, pts, 1.8, '#ffd86a'); }
    c.restore();
  }
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
  if (hd(c)) {
    for (const [fx, fy, r] of [[-12, 0.32, 3], [-6, 0.46, 2.2], [-15, 0.6, 2.6], [-2, 0.2, 2], [6, 0.72, 2.2]]) E(c, fx + sway * fy, -h * fy, r, r * 0.8, 'rgba(0,0,0,0.13)', 0);
    E(c, 2 + sway, -h + 2, 7, 3, 'rgba(255,255,255,0.35)', 0);
  }
  for (let i = 0; i < 5; i++) {
    const u = 0.08 + i * 0.12;
    const x = 30 + (22 + sway - 30) * u - 6, y = -10 + (-h + 20) * u;
    E(c, x, y, 5.5 - i * 0.5, 4.4 - i * 0.4, lite, 2);
    E(c, x, y, 2 - i * 0.15, 1.6, dark, 0);
  }
  const u = 0.78, mx = 30 + (22 + sway - 30) * u + 6, my = -10 + (-h + 20) * u;
  const open = mouthOpen(a, t) || (o.sing > 0.3 && Math.floor(t / 240) % 2 === 0), mk = a.talking ? mouthK(a, t) : [1, 1];
  E(c, mx, my, 12, open ? 10.5 * Math.min(1.15, mk[1]) : 7.5, dark, 3);
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
CHAR.green = (c, a, t) => {
  const sk = idleAct(a, t, 9000, 3400, 2500), se = actEnv(sk), bop = se * Math.abs(Math.sin(t * 0.0105));   // singt und wippt im Takt
  c.save(); c.scale(1 + bop * 0.05, 1 - bop * 0.06);
  tentacleBody(c, a, t, '#4fbf3a', '#2c7a1f', '#b4ef98', { h: 145, sing: se });
  c.restore();
  if (sk >= 0) floaters(c, a, t, 34, -150, 3, (x, y, s, i) => noteGlyph(c, x, y, s, ['#ffd23a', '#7fe8ff', '#ff7ab8'][i]), se);
};
CHAR.purple = (c, a, t) => {
  const nice = a.nice ? Math.max(0, Math.min(1, (t - a.nice) / 1200)) : 0;
  const col = mix('#8e44c9', '#ef7fc4', nice), dark = mix('#5b2589', '#b5407f', nice);
  const sk = idleAct(a, t, 10000, 2400, 4000), se = actEnv(sk) * (1 - nice);   // heckt etwas aus: reibt sich die Arme
  const wave = a.talking ? Math.sin(t * 0.012) * 0.35 : Math.sin(t * 0.003) * 0.1 + se * Math.sin(t * 0.032) * 0.32;
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
  const awake = typeof G !== 'undefined' && G.state && G.state.flags.guardGone;
  if (!awake && !a.talking && a.x != null) floaters(c, a, t, 26, -176, 3, (x, y, s) => zGlyph(c, x, y, s * 1.1, '#cfe0ff', a.dir < 0 ? -1 : 1));   // döst im Stehen
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
const PORTRAIT_3D = Object.fromEntries(['bernard', 'hoagie', 'laverne'].map(id => [id, [0, 1].map(k => Object.assign(new Image(), { src: `img/portrait_${id}_${k}.png` }))]));
function drawPortrait(c, id, x, y, r, bg, t = 0, talking = false) {
  c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
  if (hd(c)) { const g = c.createRadialGradient(x - r * 0.3, y - r * 0.4, 2, x, y, r * 1.2); g.addColorStop(0, mix(bg, '#ffffff', 0.35)); g.addColorStop(1, mix(bg, '#0a0414', 0.45)); c.fillStyle = g; }
  else c.fillStyle = bg;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  // HD: Porträt aus Blender (Kopf in 3D, zweites Bild mit offenem Mund zum Sprechen)
  const p3 = hd(c) && PORTRAIT_3D[id], im = p3 && p3[talking && Math.floor(t / 130) % 2 ? 1 : 0];
  if (im && im.complete && im.naturalWidth) { const sz = r * 2.55; c.drawImage(im, x - sz * 0.47, y - sz * 0.43, sz, sz); c.restore(); return; }
  const [hx, hy, s] = PORTRAIT[id];
  c.translate(x - hx * s, y - hy * s + 6); c.scale(s, s);
  CHAR[id](c, { talking, walking: false, phase: 0, seed: { bernard: 1, hoagie: 2.3, laverne: 3.7 }[id] || 1 }, t);
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
