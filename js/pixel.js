'use strict';
// ============================================================
//  Tentakel-Toast – Pixel-Renderer für den Klassik-Modus
//  Ein kleiner Software-Rasterizer mit der Zeichen-API von
//  CanvasRenderingContext2D. Er zeichnet alle Grafiken direkt
//  als Pixel-Art auf 320×200 neu: harte Kanten ohne Glättung,
//  1-Pixel-Konturen, Farbverläufe und Transparenz als Bayer-Raster.
//  Texte werden gesammelt und in einer Pixel-Schrift darübergelegt.
// ============================================================

const PW = 320, PH = 200, PSCALE = 1 / 3;
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const MEASURE = document.createElement('canvas').getContext('2d');
const colCache = new Map();

function parseColor(s) {
  let c = colCache.get(s); if (c) return c;
  let r = 0, g = 0, b = 0, a = 1;
  if (typeof s === 'string' && s[0] === '#') {
    if (s.length === 4) { r = parseInt(s[1] + s[1], 16); g = parseInt(s[2] + s[2], 16); b = parseInt(s[3] + s[3], 16); }
    else { const n = parseInt(s.slice(1, 7), 16); r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255; if (s.length === 9) a = parseInt(s.slice(7, 9), 16) / 255; }
  } else if (typeof s === 'string') {
    const m = /rgba?\(([^)]+)\)/.exec(s);
    if (m) { const p = m[1].split(',').map(parseFloat); r = p[0]; g = p[1]; b = p[2]; a = p.length > 3 ? p[3] : 1; }
  }
  c = { r, g, b, a, u32: ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0 };
  colCache.set(s, c); return c;
}

class PixGrad {
  constructor(type, args) { this.type = type; this.args = args; this.stops = []; this.isPixGrad = true; }
  addColorStop(o, col) { this.stops.push([o, col, parseColor(col)]); this.stops.sort((p, q) => p[0] - q[0]); }
  colorAt(x, y) {
    const a = this.args; let t;
    if (this.type === 'linear') { const dx = a[2] - a[0], dy = a[3] - a[1]; t = ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1); }
    else t = (Math.hypot(x - a[3], y - a[4]) - a[2]) / ((a[5] - a[2]) || 1);
    const s = this.stops; if (!s.length) return { r: 0, g: 0, b: 0, a: 0 };
    if (t <= s[0][0]) return s[0][2];
    if (t >= s[s.length - 1][0]) return s[s.length - 1][2];
    for (let i = 1; i < s.length; i++) if (t <= s[i][0]) {
      const p = s[i - 1], q = s[i], k = (t - p[0]) / ((q[0] - p[0]) || 1), A = p[2], B = q[2];
      return { r: A.r + (B.r - A.r) * k, g: A.g + (B.g - A.g) * k, b: A.b + (B.b - A.b) * k, a: A.a + (B.a - A.a) * k };
    }
    return s[s.length - 1][2];
  }
}

class PixCtx {
  constructor(w, h, layers = 1) {
    this.w = w; this.h = h; this.isPix = true;
    this.imgs = []; this.bufs = [];
    for (let i = 0; i < layers; i++) { const img = new ImageData(w, h); this.imgs.push(img); this.bufs.push(new Uint32Array(img.data.buffer)); }
    this.texts = []; this.reset();
  }
  reset() {
    this.m = [PSCALE, 0, 0, PSCALE, 0, 0]; this.stack = []; this.clipMask = null; this.layerIdx = 0; this.buf = this.bufs[0];
    this.fillStyle = '#000'; this.strokeStyle = '#000'; this.lineWidth = 1; this.globalAlpha = 1;
    this.font = '10px sans-serif'; this.textAlign = 'start'; this.textBaseline = 'alphabetic';
    this.lineJoin = 'miter'; this.lineCap = 'butt'; this.miterLimit = 10; this.dash = null;
    this.imageSmoothingEnabled = false; this.imageSmoothingQuality = 'low';
    this.path = []; this.sub = null;
  }
  begin() { for (const b of this.bufs) b.fill(0); this.texts = []; this.reset(); }
  layer(n) { this.layerIdx = n; this.buf = this.bufs[n]; }

  // ---------- Zustand & Transformation ----------
  save() { this.stack.push({ m: this.m.slice(), clip: this.clipMask, fs: this.fillStyle, ss: this.strokeStyle, lw: this.lineWidth, ga: this.globalAlpha, font: this.font, ta: this.textAlign, tb: this.textBaseline, dash: this.dash }); }
  restore() {
    const s = this.stack.pop(); if (!s) return;
    this.m = s.m; this.clipMask = s.clip; this.fillStyle = s.fs; this.strokeStyle = s.ss; this.lineWidth = s.lw; this.globalAlpha = s.ga;
    this.font = s.font; this.textAlign = s.ta; this.textBaseline = s.tb; this.dash = s.dash;
  }
  translate(x, y) { const m = this.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
  scale(sx, sy) { const m = this.m; m[0] *= sx; m[1] *= sx; m[2] *= sy; m[3] *= sy; }
  rotate(a) {
    const m = this.m, c = Math.cos(a), s = Math.sin(a), a0 = m[0], b0 = m[1], c0 = m[2], d0 = m[3];
    m[0] = a0 * c + c0 * s; m[1] = b0 * c + d0 * s; m[2] = -a0 * s + c0 * c; m[3] = -b0 * s + d0 * c;
  }
  setTransform(a, b, c, d, e, f) {
    if (typeof a === 'object') ({ a, b, c, d, e, f } = a);
    this.m = [a * PSCALE, b * PSCALE, c * PSCALE, d * PSCALE, e * PSCALE, f * PSCALE];
  }
  getTransform() { const m = this.m; return { a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] }; }
  tx(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  get sc() { const m = this.m; return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])); }
  setLineDash(a) { this.dash = a && a.length ? a.slice() : null; }

  // ---------- Pfade ----------
  beginPath() { this.path = []; this.sub = null; }
  newSub(p) { this.sub = { pts: [p], closed: false }; this.path.push(this.sub); }
  moveTo(x, y) { this.newSub(this.tx(x, y)); }
  lineTo(x, y) { const p = this.tx(x, y); if (!this.sub || this.sub.closed) this.newSub(p); else this.sub.pts.push(p); }
  last() { const s = this.sub; return s ? s.pts[s.pts.length - 1] : null; }
  segs(len) { return Math.max(3, Math.min(28, Math.ceil(len / 2.5))); }
  quadraticCurveTo(cx_, cy_, x, y) {
    const p0 = this.last() || this.tx(cx_, cy_), p1 = this.tx(cx_, cy_), p2 = this.tx(x, y);
    if (!this.sub || this.sub.closed) this.newSub(p0);
    const n = this.segs(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]));
    for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; this.sub.pts.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]); }
  }
  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
    const p0 = this.last() || this.tx(c1x, c1y), p1 = this.tx(c1x, c1y), p2 = this.tx(c2x, c2y), p3 = this.tx(x, y);
    if (!this.sub || this.sub.closed) this.newSub(p0);
    const n = this.segs(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + Math.hypot(p3[0] - p2[0], p3[1] - p2[1]));
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
      this.sub.pts.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
    }
  }
  arc(x, y, r, a0, a1, ccw) { this.ellipse(x, y, r, r, 0, a0, a1, ccw); }
  ellipse(x, y, rx, ry, rot, a0, a1, ccw) {
    rx = Math.abs(rx); ry = Math.abs(ry);
    const TAU = Math.PI * 2;
    let sweep = ccw ? a0 - a1 : a1 - a0;
    if (sweep >= TAU) sweep = TAU; else { sweep %= TAU; if (sweep < 0) sweep += TAU; }
    if (ccw) sweep = -sweep;
    const n = Math.max(8, Math.min(72, Math.ceil(Math.abs(sweep) * Math.max(rx, ry) * this.sc * 0.9)));
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + sweep * i / n, ex = rx * Math.cos(a), ey = ry * Math.sin(a);
      pts.push(this.tx(x + cr * ex - sr * ey, y + sr * ex + cr * ey));
    }
    if (!this.sub || this.sub.closed) this.newSub(pts[0]); else this.sub.pts.push(pts[0]);
    for (let i = 1; i < pts.length; i++) this.sub.pts.push(pts[i]);
  }
  rect(x, y, w, h) { this.newSub(this.tx(x, y)); this.sub.pts.push(this.tx(x + w, y), this.tx(x + w, y + h), this.tx(x, y + h)); this.sub.closed = true; }
  roundRect(x, y, w, h, r) {
    r = Math.max(0, Math.min(typeof r === 'number' ? r : (r && r[0]) || 0, Math.abs(w) / 2, Math.abs(h) / 2));
    if (!r) return this.rect(x, y, w, h);
    this.moveTo(x + r, y); this.lineTo(x + w - r, y);
    this.ellipse(x + w - r, y + r, r, r, 0, -Math.PI / 2, 0); this.lineTo(x + w, y + h - r);
    this.ellipse(x + w - r, y + h - r, r, r, 0, 0, Math.PI / 2); this.lineTo(x + r, y + h);
    this.ellipse(x + r, y + h - r, r, r, 0, Math.PI / 2, Math.PI); this.lineTo(x, y + r);
    this.ellipse(x + r, y + r, r, r, 0, Math.PI, Math.PI * 1.5);
    this.closePath();
  }
  closePath() { if (this.sub) this.sub.closed = true; }

  // ---------- Farbe ----------
  paint(style) {
    const ga = this.globalAlpha;
    if (style && style.isPixGrad) {
      const m = this.m, det = m[0] * m[3] - m[1] * m[2] || 1;
      const inv = [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
      return { grad: style, inv, ga };
    }
    const c = parseColor(style || '#000');
    return { u32: c.u32, a: c.a * ga };
  }
  plot(x, y, p) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    const i = y * this.w + x;
    if (this.clipMask && !this.clipMask[i]) return false;
    let u, a;
    if (p.grad) {
      // Verläufe in klaren Farbstufen (Banding) wie bei klassischer Pixel-Art; nur ein Hauch Raster an den Stufenkanten
      const ux = p.inv[0] * (x + 0.5) + p.inv[2] * (y + 0.5) + p.inv[4], uy = p.inv[1] * (x + 0.5) + p.inv[3] * (y + 0.5) + p.inv[5];
      const c = p.grad.colorAt(ux, uy), d = (BAYER4[((y & 3) << 2) | (x & 3)] - 0.5) * 0.5, q = 12;
      const qr = Math.max(0, Math.min(q, Math.round(c.r / 255 * q + d))) * 255 / q | 0;
      const qg = Math.max(0, Math.min(q, Math.round(c.g / 255 * q + d))) * 255 / q | 0;
      const qb = Math.max(0, Math.min(q, Math.round(c.b / 255 * q + d))) * 255 / q | 0;
      u = ((255 << 24) | (qb << 16) | (qg << 8) | qr) >>> 0; a = c.a * p.ga;
    } else { u = p.u32; a = p.a; }
    if (a <= 0.03) return false;
    if (a >= 0.985) { this.buf[i] = u; return true; }
    // Transparenz: echte Überblendung, danach auf grobe Farbstufen gerundet (sauberer Retro-Look statt Pixelrauschen)
    let base = this.buf[i];
    if ((base >>> 24) === 0 && this.layerIdx > 0) base = this.bufs[0][i];
    const k = 1 - a, st = v => Math.min(255, Math.round(v / 17) * 17);
    const r = st((u & 255) * a + (base & 255) * k), g = st(((u >>> 8) & 255) * a + ((base >>> 8) & 255) * k), b = st(((u >>> 16) & 255) * a + ((base >>> 16) & 255) * k);
    this.buf[i] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
    return true;
  }

  // ---------- Füllen (Scanline, Pixelmitten) ----------
  raster(rule, fn) {
    const edges = []; let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
    for (const sp of this.path) {
      const pts = sp.pts, n = pts.length; if (n < 2) continue;
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[(i + 1) % n];
        if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
        if (p[1] === q[1]) continue;
        const up = q[1] > p[1], ya = up ? p[1] : q[1], yb = up ? q[1] : p[1];
        edges.push({ ya, yb, x: up ? p[0] : q[0], k: (q[0] - p[0]) / (q[1] - p[1]), dir: up ? 1 : -1 });
        if (ya < minY) minY = ya; if (yb > maxY) maxY = yb;
      }
    }
    let count = 0;
    const y0 = Math.max(0, Math.ceil(minY - 0.5)), y1 = Math.min(this.h - 1, Math.floor(maxY - 0.5));
    const xs = [];
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5; xs.length = 0;
      for (const e of edges) if (sy >= e.ya && sy < e.yb) xs.push([e.x + (sy - e.ya) * e.k, e.dir]);
      if (xs.length < 2) continue;
      xs.sort((a, b) => a[0] - b[0]);
      let wn = 0;
      for (let k = 0; k < xs.length - 1; k++) {
        wn += xs[k][1];
        const inside = rule === 'evenodd' ? (k % 2 === 0) : wn !== 0;
        if (!inside) continue;
        const xa = Math.max(0, Math.ceil(xs[k][0] - 0.5)), xb = Math.min(this.w - 1, Math.floor(xs[k + 1][0] - 0.5));
        for (let x = xa; x <= xb; x++) if (fn(x, y)) count++;
      }
    }
    // winzige Formen (z. B. Pupillen) bekommen mindestens einen Pixel
    if (!count && isFinite(minX) && maxX - minX < 3 && maxY - minY < 3) fn(Math.floor((minX + maxX) / 2), Math.floor((minY + maxY) / 2));
  }
  fill(rule) { const p = this.paint(this.fillStyle); this.raster(rule, (x, y) => this.plot(x, y, p)); }
  clip() {
    const old = this.clipMask, mask = new Uint8Array(this.w * this.h), w = this.w;
    this.raster('nonzero', (x, y) => { const i = y * w + x; if (!old || old[i]) { mask[i] = 1; return true; } return false; });
    this.clipMask = mask;
  }
  fillRect(x, y, w, h) { const keep = this.path, ks = this.sub; this.beginPath(); this.rect(x, y, w, h); this.fill(); this.path = keep; this.sub = ks; }
  clearRect(x, y, w, h) {
    const a = this.tx(x, y), b = this.tx(x + w, y + h);
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]))), x1 = Math.min(this.w, Math.ceil(Math.max(a[0], b[0])));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]))), y1 = Math.min(this.h, Math.ceil(Math.max(a[1], b[1])));
    for (let yy = y0; yy < y1; yy++) this.buf.fill(0, yy * this.w + x0, yy * this.w + x1);
  }

  // ---------- Konturen (Bresenham, 1 Pixel bei normalen Linien) ----------
  stroke() {
    const wpx = this.lineWidth * this.sc;
    if (wpx < 0.34) return;
    const t = wpx < 1.7 ? 1 : Math.round(wpx), p = this.paint(this.strokeStyle);
    const dash = this.dash ? this.dash.map(v => v * this.sc) : null;
    let dd = 0;
    for (const sp of this.path) {
      const pts = sp.pts, n = pts.length; if (n < 2) { if (n === 1) this.stamp(Math.floor(pts[0][0]), Math.floor(pts[0][1]), t, p); continue; }
      const segN = sp.closed ? n : n - 1;
      for (let i = 0; i < segN; i++) dd = this.line(pts[i], pts[(i + 1) % n], t, p, dash, dd);
    }
  }
  stamp(x, y, t, p) {
    if (t === 1) { this.plot(x, y, p); return; }
    const o = Math.floor((t - 1) / 2), r2 = (t / 2) * (t / 2) + 0.3;
    for (let j = 0; j < t; j++) for (let i = 0; i < t; i++) {
      const dx = i - (t - 1) / 2, dy = j - (t - 1) / 2;
      if (t < 4 || dx * dx + dy * dy <= r2) this.plot(x - o + i, y - o + j, p);
    }
  }
  line(a, b, t, p, dash, dd) {
    let x0 = Math.floor(a[0]), y0 = Math.floor(a[1]); const x1 = Math.floor(b[0]), y1 = Math.floor(b[1]);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, guard = 0;
    const period = dash ? dash.reduce((s, v) => s + v, 0) : 0;
    for (;;) {
      let on = true;
      if (dash && period > 0) { const ph = dd % period; on = ph < dash[0]; dd++; }
      if (on) this.stamp(x0, y0, t, p);
      if ((x0 === x1 && y0 === y1) || guard++ > 4000) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return dd;
  }

  // ---------- Text: wird gesammelt und später scharf darübergelegt ----------
  fillText(t, x, y) { this.texts.push({ k: 'f', t, x, y, m: this.m.slice(), font: this.font, st: this.fillStyle, a: this.globalAlpha, al: this.textAlign, bl: this.textBaseline, layer: this.layerIdx }); }
  strokeText(t, x, y) { this.texts.push({ k: 's', t, x, y, m: this.m.slice(), font: this.font, st: this.strokeStyle, lw: this.lineWidth, a: this.globalAlpha, al: this.textAlign, bl: this.textBaseline, layer: this.layerIdx }); }
  measureText(t) { MEASURE.font = this.font; return MEASURE.measureText(t); }
  createLinearGradient(x0, y0, x1, y1) { return new PixGrad('linear', [x0, y0, x1, y1]); }
  createRadialGradient(x0, y0, r0, x1, y1, r1) { return new PixGrad('radial', [x0, y0, r0, x1, y1, r1]); }
  drawImage() { /* im Pixel-Modus nicht benötigt */ }

  // ---------- Raum-Hintergründe: einmal als Pixel-Art gerendert, dann kopiert ----------
  blitRoom(room) {
    if (!room._pix) {
      const pc = new PixCtx(PW, Math.ceil(SH * PSCALE));
      room.draw(pc);
      room._pix = { buf: pc.bufs[0], texts: pc.texts, h: pc.h };
    }
    const src = room._pix, dx = Math.round(this.m[4]), dy = Math.round(this.m[5]);
    if (!dx && !dy) this.buf.set(src.buf);
    else for (let y = 0; y < src.h; y++) {
      const ty = y + dy; if (ty < 0 || ty >= this.h) continue;
      for (let x = 0; x < PW; x++) { const tx = x + dx; if (tx >= 0 && tx < PW) this.buf[ty * PW + tx] = src.buf[y * PW + x]; }
    }
    for (const q of src.texts) { const m = q.m.slice(); m[4] += dx; m[5] += dy; this.texts.push({ ...q, m, layer: this.layerIdx }); }
  }
}

// Doppelpuffer für das Spielbild: Ebene 0 (Hintergrund & Objekte), Ebene 1 (Figuren, Oberfläche)
const PIX = new PixCtx(PW, PH, 2);
const pixLow = [0, 1].map(() => { const c = document.createElement('canvas'); c.width = PW; c.height = PH; return c; });
function pixFont(f) {
  // Achtung: der Browser lässt das Gewicht 400 beim Auslesen von ctx.font weg ("74px Titan One")
  const sm = /(\d+(?:\.\d+)?)px/.exec(f), wm = /(?:^|\s)(\d{3})\s/.exec(f);
  const size = sm ? +sm[1] : 16, w = wm ? +wm[1] : (/bold/.test(f) ? 700 : 400);
  return `${w >= 600 || /Titan/.test(f) ? 700 : 500} ${Math.round(size)}px "Pixelify Sans", monospace`;
}
function pixComposite(main, canvas) {
  const k = canvas.width / PW;
  main.setTransform(1, 0, 0, 1, 0, 0);
  main.globalAlpha = 1; main.imageSmoothingEnabled = false;
  main.clearRect(0, 0, canvas.width, canvas.height);
  for (let L = 0; L < 2; L++) {
    pixLow[L].getContext('2d').putImageData(PIX.imgs[L], 0, 0);
    main.setTransform(1, 0, 0, 1, 0, 0); main.globalAlpha = 1;
    main.drawImage(pixLow[L], 0, 0, canvas.width, canvas.height);
    for (const q of PIX.texts) {
      if (q.layer !== L) continue;
      const m = q.m;
      main.setTransform(m[0] * k, m[1] * k, m[2] * k, m[3] * k, m[4] * k, m[5] * k);
      main.globalAlpha = q.a; main.font = pixFont(q.font); main.textAlign = q.al; main.textBaseline = q.bl;
      let st = q.st;
      if (st && st.isPixGrad) {
        const a = st.args, g = st.type === 'linear' ? main.createLinearGradient(a[0], a[1], a[2], a[3]) : main.createRadialGradient(a[0], a[1], a[2], a[3], a[4], a[5]);
        st.stops.forEach(s => g.addColorStop(s[0], s[1])); st = g;
      }
      if (q.k === 'f') { main.fillStyle = st; main.fillText(q.t, q.x, q.y); }
      else { main.strokeStyle = st; main.lineWidth = q.lw; main.lineJoin = 'miter'; main.miterLimit = 2; main.strokeText(q.t, q.x, q.y); }
    }
  }
  main.globalAlpha = 1; main.lineJoin = 'round'; main.imageSmoothingEnabled = true;
}
