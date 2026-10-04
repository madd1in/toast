'use strict';
// ============================================================
//  Tentakel-Toast – Räume (Hintergründe, Hotspots, Effekte)
//  7 Räume in 3 Zeitebenen: Gegenwart, 1776, Zukunft
// ============================================================

const ROOMS = {};
function room(def) { ROOMS[def.id] = Object.assign({ sMin: 0.8, sMax: 1.0, yTop: 318, yBot: 432, objs: [] }, def); }

// ---------- gemeinsame Bausteine ----------
function floorPlanks(c, poly, vx, col, rows) {
  c.save(); pth(c, poly); c.clip();
  for (let i = -6; i < 18; i++) { const xb = -320 + i * 100, xt = vx + (xb - vx) * 0.55; L(c, [xt, 290, xb, SH], 2, col); }
  if (rows) rows.forEach(y => L(c, [0, y, W, y - 6], 1.5, col));
  c.restore();
}
function checkerFloor(c, y0, y1, colA, colB, rowsN = 6, cols = 14) {
  const ys = [];
  for (let r = 0; r <= rowsN; r++) { const k = r / rowsN; ys.push(y0 + (y1 - y0) * (k * k * 0.5 + k * 0.5)); }
  const xAt = (u, y) => 480 + (u - 480) * (0.62 + 0.38 * (y - y0) / (y1 - y0));
  for (let r = 0; r < rowsN; r++) for (let i = -8; i < cols + 8; i++) {
    const u0 = i * (W / cols), u1 = (i + 1) * (W / cols);
    pth(c, [xAt(u0, ys[r]), ys[r], xAt(u1, ys[r]), ys[r], xAt(u1, ys[r + 1]), ys[r + 1], xAt(u0, ys[r + 1]), ys[r + 1]]);
    c.fillStyle = (r + i) % 2 ? colA : colB; c.fill();
  }
}
function drawClock(c, x, y, w, h, wood, lean, shine) {
  const dark = mix(wood, '#000000', 0.25), mid = mix(wood, '#000000', 0.12);
  P(c, [x, y, x + w, y, x + w + lean, y - h + 34, x + lean, y - h + 34], wood);
  R(c, x - 4, y - 10, w + 8, 10, dark, 3, 2);
  P(c, [x - 6 + lean, y - h + 36, x + w + 6 + lean, y - h + 36, x + w + 4 + lean, y - h + 2, x + w / 2 + lean, y - h - 14, x - 4 + lean, y - h + 2], mid);
  const cxx = x + w / 2 + lean, cyy = y - h + 20;
  E(c, cxx, cyy, w * 0.3, w * 0.3, shine ? '#fff7dc' : '#e2d6b8');
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; L(c, [cxx + Math.cos(a) * w * 0.24, cyy + Math.sin(a) * w * 0.24, cxx + Math.cos(a) * w * 0.27, cyy + Math.sin(a) * w * 0.27], 1.5); }
  L(c, [cxx, cyy, cxx, cyy - 10], 2); L(c, [cxx, cyy, cxx + 7, cyy + 3], 2);
  R(c, x + w * 0.24 + lean * 0.6, y - h + 60, w * 0.52, h * 0.44, '#2a1408', 2.5, 3);
  if (!shine) { L(c, [x + 6, y - 40, x + 14, y - 70], 1.5, mix(wood, '#ffffff', 0.15)); }
}
function pendulum(c, t, px, py, len, clip) {
  c.save(); c.beginPath(); c.rect(clip[0], clip[1], clip[2], clip[3]); c.clip();
  const a = Math.sin(t * 0.0032) * 0.22, bx = px + Math.sin(a) * len, by = py + Math.cos(a) * len;
  L(c, [px, py, bx, by], 2.5, '#c9a040'); E(c, bx, by, 9, 9, '#e2c050', 2.5);
  c.restore();
}
function cloud(c, x, y, s) {
  const blobs = [[0, 0, 40, 20], [28, -10, 28, 20], [-30, 2, 24, 14], [14, 6, 30, 14]];
  blobs.forEach(([dx, dy, rx, ry]) => E(c, x + dx * s, y + dy * s, rx * s, ry * s, null, 5, 0, '#b8daf0'));
  blobs.forEach(([dx, dy, rx, ry]) => E(c, x + dx * s, y + dy * s, rx * s, ry * s, '#ffffff', 0));
}
function flask(c, x, y, col, k) {
  const glass = 'rgba(220,240,255,0.35)';
  if (k === 0) {
    P(c, [x - 10, y - 9, x + 10, y - 9, x + 13, y - 1, x - 13, y - 1], col, 0);
    S(c, glass, 2.5, () => { c.moveTo(x - 4, y - 34); c.lineTo(x - 4, y - 22); c.lineTo(x - 14, y); c.lineTo(x + 14, y); c.lineTo(x + 4, y - 22); c.lineTo(x + 4, y - 34); c.closePath(); });
  } else if (k === 1) {
    E(c, x, y - 9, 10, 7, col, 0);
    E(c, x, y - 12, 12, 12, glass, 2.5); R(c, x - 3, y - 34, 6, 11, glass, 2.5);
  } else {
    R(c, x - 6, y - 16, 12, 15, col, 0, 2);
    R(c, x - 7, y - 30, 14, 30, glass, 2.5, 3);
  }
}
function kloFx(c, id, cxx, top, bot, bulbX, bulbY) {
  const blink = Math.floor(G.t / 500) % 2 === 0;
  E(c, bulbX, bulbY, 5, 5, blink ? '#ff5050' : '#7a2020', 2);
  if (blink) { c.save(); c.globalAlpha = 0.25; E(c, bulbX, bulbY, 12, 12, '#ff8080', 0); c.restore(); }
  const k = G.kloAnim && G.kloAnim.obj === id ? (G.t - G.kloAnim.t) / 1500 : 2;
  if (k >= 0 && k <= 1) {
    c.save(); c.globalAlpha = Math.sin(k * Math.PI);
    R(c, cxx - 12, 0, 24, top + 20, 'rgba(255,255,210,0.55)', 0);
    ['#7dff7a', '#ffd23a', '#ff5fa8', '#5fd3ff'].forEach((col, i) => {
      const r = 18 + ((k * 3 + i * 0.25) % 1) * 70;
      E(c, cxx, (top + bot) / 2 + 20, r, r * 1.5, null, 4, 0, col);
    });
    c.restore();
  }
}

// =================== GEGENWART: LOBBY ===================
function bgLobby(c) {
  c.fillStyle = '#6a3f96'; c.fillRect(0, 0, W, SH);
  c.save(); pth(c, [0, 44, W, 36, W, 224, 0, 230]); c.clip();
  c.fillStyle = '#5a3484';
  for (let y = 46, r = 0; y < 240; y += 32, r++) for (let x = (r % 2) * 30 - 30; x < W + 40; x += 60) { pth(c, [x, y - 11, x + 8, y, x, y + 11, x - 8, y]); c.fill(); }
  c.fillStyle = '#8b62b8';
  for (let y = 62, r = 0; y < 240; y += 32, r++) for (let x = (r % 2) * 30; x < W + 40; x += 60) { c.beginPath(); c.arc(x, y, 2.2, 0, 7); c.fill(); }
  c.restore();
  P(c, [0, 0, W, 0, W, 30, 0, 38], '#3a1d5a');
  P(c, [0, 38, W, 30, W, 40, 0, 48], '#e2b85c', 2.5);
  // Fenster
  R(c, 556, 66, 108, 108, '#3b1d5c', 3, 4);
  R(c, 566, 76, 88, 88, grad(c, 0, 76, 0, 164, [[0, '#0e0a2e'], [1, '#3a2a6e']]), 2.5);
  E(c, 630, 100, 12, 12, '#fff2b0', 0); E(c, 636, 96, 10, 10, '#1a1440', 0);
  [[580, 90], [596, 140], [640, 146], [588, 112], [622, 128]].forEach(([x, y]) => E(c, x, y, 1.5, 1.5, '#ffffff', 0));
  L(c, [610, 76, 610, 164], 3); L(c, [566, 120, 654, 120], 3);
  P(c, [548, 58, 578, 58, 572, 176, 542, 186], '#a3223b'); P(c, [642, 58, 672, 58, 680, 186, 648, 176], '#a3223b');
  // Gemälde: Ur-Ur-Ur-Ur-Oma Gertrude
  R(c, 393, 62, 114, 134, '#d4a43a', 3, 4); R(c, 404, 73, 92, 104, '#2f4a3a', 2.5);
  c.save(); c.beginPath(); c.rect(404, 73, 92, 104); c.clip();
  E(c, 450, 176, 36, 26, '#3d6fb6', 2.5); E(c, 450, 115, 22, 18, '#fff', 2.5); E(c, 452, 122, 15, 17, '#f5c9a6', 2.5);
  E(c, 450, 107, 19, 7, '#fff', 2.5); E(c, 447, 121, 1.6, 1.8, OUT, 0); E(c, 457, 121, 1.6, 1.8, OUT, 0);
  S(c, null, 2, () => { c.moveTo(447, 129); c.quadraticCurveTo(452, 133, 457, 129); });
  c.restore();
  R(c, 418, 181, 64, 11, '#f2e6c0', 1.5, 2); txt(c, 'G. EDISON 1776', 450, 190, '800 8px "Baloo 2", sans-serif', '#5a3a10');
  // Wandverkleidung
  P(c, [0, 230, W, 224, W, 304, 0, 314], '#47276b');
  P(c, [0, 230, W, 224, W, 232, 0, 238], '#e2b85c', 2);
  for (let i = 0; i < 8; i++) R(c, 18 + i * 120, 248, 96, 48, '#522f78', 2);
  // Boden
  const fp = [0, 314, W, 304, W, SH, 0, SH]; P(c, fp, '#9a5f32');
  floorPlanks(c, fp, 480, '#7d4a24', [334, 358, 390, 424]);
  E(c, 560, 394, 190, 30, '#a3223b'); E(c, 560, 394, 160, 22, null, 2.5, 0, '#e2b85c'); E(c, 560, 394, 118, 13, '#8a1a30', 2);
  // Schlüsselbrett
  R(c, 66, 104, 150, 84, '#5a3418', 3, 4);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) {
    const x = 86 + i * 27, y = 120 + j * 34;
    E(c, x, y, 3, 3, '#e2b85c', 1.5); L(c, [x, y, x, y + 10], 2, '#c9a040'); R(c, x - 4, y + 10, 8, 9, '#c9a040', 1.5, 2);
  }
  // Rezeption
  P(c, [30, 234, 262, 226, 264, 242, 30, 250], '#b0602e');
  P(c, [36, 250, 258, 242, 254, 340, 40, 348], '#7a3d1f');
  R(c, 54, 262, 88, 66, '#6a3218', 2.5, 4); R(c, 152, 258, 88, 66, '#6a3218', 2.5, 4);
  txt(c, 'EMPFANG', 98, 300, '800 13px "Baloo 2", sans-serif', '#e2b85c');
  P(c, [60, 233, 104, 230, 108, 239, 62, 243], '#efe6cc', 2);
  E(c, 128, 237, 12, 4, '#8a6a20', 2);
  S(c, '#e2c050', 2.5, () => { c.moveTo(117, 237); c.quadraticCurveTo(128, 212, 139, 237); c.closePath(); });
  E(c, 128, 219, 2.5, 2.5, '#e2c050', 2);
  // Standuhr (alt, schief)
  drawClock(c, 294, 330, 54, 218, '#6a3a1c', -3, false);
  // Sofa
  R(c, 444, 340, 8, 10, '#3a1a10', 2); R(c, 628, 340, 8, 10, '#3a1a10', 2);
  P(c, [442, 258, 638, 258, 648, 306, 432, 306], '#c9563f');
  for (let i = 0; i < 3; i++) R(c, 450 + i * 62, 266, 58, 34, '#d8684e', 2.5, 8);
  P(c, [432, 300, 648, 300, 644, 344, 436, 344], '#b0442f');
  R(c, 444, 294, 94, 18, '#d8684e', 2.5, 6); R(c, 542, 294, 94, 18, '#d8684e', 2.5, 6);
  E(c, 432, 308, 18, 30, '#b8482f'); E(c, 648, 308, 18, 30, '#b8482f');
  // Kaffeeautomat
  R(c, 690, 136, 96, 200, '#d23c2c', 3, 8);
  R(c, 698, 146, 80, 32, '#ffd23a', 2.5, 4); txt(c, 'KAFFEE-O-MAT', 738, 167, '800 12px "Baloo 2", sans-serif', '#7a1a10');
  R(c, 700, 186, 76, 58, '#2a1a1a', 2.5, 3);
  for (let i = 0; i < 3; i++) P(c, [708 + i * 23, 234, 724 + i * 23, 234, 722 + i * 23, 212, 710 + i * 23, 212], '#f4efe6', 2);
  txt(c, '5000', 728, 262, '800 14px "Baloo 2", sans-serif', '#ffd23a');
  R(c, 706, 270, 40, 40, '#1a1010', 2.5, 4);
  R(c, 760, 254, 10, 22, '#222', 2, 2);
  E(c, 765, 292, 6, 6, '#3cf07a', 2); E(c, 765, 310, 6, 6, '#ffd23a', 2);
  P(c, [752, 196, 784, 192, 786, 206, 754, 210], '#fff', 2);
  txt(c, 'EXTRA STARK', 769, 205, '800 6px "Baloo 2", sans-serif', '#d23c2c');
  // Tür zum Labor
  P(c, [826, 340, 940, 334, 940, 102, 830, 110], '#7a4a22');
  P(c, [840, 334, 928, 330, 928, 116, 842, 122], grad(c, 0, 116, 0, 334, [[0, '#103a30'], [1, '#2a7a5a']]), 2.5);
  for (let i = 0; i < 3; i++) flask(c, 862 + i * 24, 300 - i * 8, ['#7dff7a', '#ff5fa8', '#5fd3ff'][i], i);
  R(c, 838, 74, 96, 26, '#f2e6c0', 2.5, 3); txt(c, 'LABOR', 886, 93, '800 16px "Baloo 2", sans-serif', '#7a1a10');
}
function drawSugarBowl(c) {
  S(c, '#f4f4fa', 2.5, () => { c.moveTo(184, 216); c.quadraticCurveTo(186, 236, 202, 236); c.quadraticCurveTo(218, 236, 220, 216); c.closePath(); });
  E(c, 202, 216, 18, 5, '#dcdce8', 2.5);
  if (!fl().zucker) { c.save(); c.translate(202, 210); c.scale(0.6, 0.6); cube(c, -8, 0); cube(c, 8, 2); cube(c, 0, -8); c.restore(); }
  txt(c, 'ZUCKER', 202, 230, '800 7px "Baloo 2", sans-serif', '#7a6a9a');
}

room({
  id: 'lobby', era: 'present', name: 'Lobby', floor: 'wood', amb: ['clock'],
  walk: [[20, 326], [940, 318], [955, 432], [5, 432]], yTop: 318,
  draw: bgLobby,
  dyn: (c, t) => {
    // Mondlicht fällt durchs Fenster auf den Teppich
    c.save(); c.globalAlpha = 0.07 + Math.sin(t * 0.0008) * 0.02;
    P(c, [566, 164, 654, 164, 700, 420, 470, 420], '#bfd8ff', 0);
    c.restore();
    // eine Motte umkreist die Klingel
    const mx = 128 + Math.cos(t * 0.004) * 26, my = 196 + Math.sin(t * 0.007) * 12, f = Math.sin(t * 0.06) * 3;
    E(c, mx, my, 3, 2, '#d9cdb8', 1.2); L(c, [mx - 4, my - f, mx, my, mx + 4, my - f], 1.2);
  },
  objs: [
    { id: 'fenster_heute', name: 'Fenster', rect: [542, 58, 140, 124], look: 'Draußen ist tiefe Nacht. Dr. Fred schläft nie. Wir anderen leider auch nicht.', txt: { open: 'Lieber nicht. Draußen jaulen die Waschbären.' } },
    { id: 'gemaelde', name: 'Gemälde', rect: [393, 62, 114, 134], look: 'Ur-Ur-Ur-Ur-Oma Gertrude Edison, 1776. Auf der Plakette steht: "Ihr Brot machte Feinde zu Freunden."', txt: { pick: 'Das hängt da seit 250 Jahren. Ich will nicht der sein, der es runterholt.' } },
    { id: 'schluesselbrett', name: 'Schlüsselbrett', rect: [66, 104, 150, 84], look: 'Schlüssel für Zimmer, die keiner bucht. Das Edison-Motel hat einen gewissen Ruf.', txt: { pick: 'Ich brauche keinen Zimmerschlüssel. Ich brauche Schlaf. Und einen Toast.' } },
    { id: 'rezeption', name: 'Rezeption', rect: [30, 240, 234, 108], walk: [150, 362], look: 'Die Rezeption des Edison-Motels. Seit 1987 unbesetzt.' },
    { id: 'klingel', name: 'Klingel', rect: [110, 208, 36, 34], walk: [130, 360], dv: 'push' },
    { id: 'zucker', name: 'Zuckerdose', rect: [178, 198, 50, 42], walk: [200, 360], dv: 'pick', draw: drawSugarBowl },
    { id: 'uhr_heute', name: 'Standuhr', rect: [284, 100, 72, 232], walk: [322, 352], dv: 'open', draw: (c, t) => pendulum(c, t, 319.2, 176, 78, [305, 172, 28, 96]) },
    { id: 'sofa', name: 'Sofa', rect: [418, 256, 244, 94], walk: [540, 374], dv: 'pull' },
    { id: 'automat', name: 'Kaffeeautomat', rect: [688, 134, 100, 206], walk: [738, 366], dv: 'use' },
    { id: 'tuer_labor', name: 'Labor', rect: [826, 70, 116, 270], walk: [880, 346], exit: ['labor', 140, 398, 1], look: 'Die Tür zu Dr. Freds Labor. Dahinter blubbert es verdächtig.' },
  ],
});

// =================== GEGENWART: LABOR ===================
function drawKloModern(c, x) {
  const col = '#7b4bb5', dark = '#5e3492';
  R(c, x + 56, 64, 6, 26, '#9aa3ad', 2.5);
  S(c, dark, 3.5, () => { c.moveTo(x - 6, 134); c.quadraticCurveTo(x + 58, 80, x + 122, 134); c.closePath(); });
  R(c, x, 130, 116, 210, col, 3.5, 8);
  R(c, x + 6, 140, 8, 190, 'rgba(255,255,255,0.18)', 0, 4);
  R(c, x + 16, 150, 84, 182, dark, 3, 6);
  S(c, '#ffe9a0', 2.5, () => c.arc(x + 58, 186, 12, 0, Math.PI * 2)); E(c, x + 64, 182, 10, 10, dark, 0);
  R(c, x + 24, 212, 68, 16, '#ffd23a', 2.5, 3); txt(c, 'CHRONO-KLO', x + 58, 224, '800 10px "Baloo 2", sans-serif', '#4a1a6a');
  E(c, x + 88, 264, 5, 5, '#e2b85c', 2);
  E(c, x + 116, 176, 9, 9, '#f2e6c0'); L(c, [x + 116, 176, x + 121, 170], 2);
  E(c, x + 116, 206, 6, 6, '#3cf0ff', 2.5);
  S(c, null, 3, () => { c.moveTo(x + 4, 330); c.quadraticCurveTo(x - 40, 336, x - 60, 300); }, '#2a2a30');
}
function bgLabor(c) {
  c.fillStyle = '#2e6964'; c.fillRect(0, 0, W, SH);
  c.save(); c.strokeStyle = '#265852'; c.lineWidth = 2;
  for (let x = 0; x < W; x += 32) { c.beginPath(); c.moveTo(x, 34); c.lineTo(x, 320); c.stroke(); }
  for (let y = 34; y < 320; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.restore();
  R(c, 0, 0, W, 34, '#1d3b38', 0);
  R(c, -6, 12, W + 12, 12, '#8d959e', 3, 6);
  R(c, 484, 20, 12, 84, '#8d959e', 3, 6);
  R(c, 880, 20, 12, 300, '#8d959e', 3, 6);
  [120, 300, 700].forEach(x => R(c, x, 8, 14, 20, '#6a727c', 2.5, 3));
  // Boden
  const fp = [0, 320, W, 312, W, SH, 0, SH];
  P(c, fp, '#3b4458'); c.save(); pth(c, fp); c.clip(); checkerFloor(c, 312, SH, '#465170', '#333b4f', 6, 14); c.restore();
  L(c, [0, 320, W, 312], 3);
  // Tür links
  P(c, [16, 336, 112, 330, 110, 108, 20, 100], '#6a3a1c');
  P(c, [26, 330, 102, 326, 100, 118, 30, 112], '#8a4f26');
  R(c, 40, 140, 48, 66, '#7a4422', 2, 3); R(c, 40, 226, 48, 80, '#7a4422', 2, 3);
  E(c, 92, 230, 5, 5, '#e2b85c', 2);
  // Tafel
  R(c, 136, 52, 182, 104, '#7a4a22', 3, 3); R(c, 144, 60, 166, 88, '#1f3a2a', 2);
  txt(c, 'E = mc²', 192, 88, '700 18px "Baloo 2", sans-serif', '#e8f0e0');
  txt(c, 'E = mc Toast', 238, 113, '700 15px "Baloo 2", sans-serif', '#e8f0e0'); L(c, [196, 107, 280, 107], 2, '#e8f0e0');
  txt(c, 'Brot kaufen!', 252, 139, '700 14px "Baloo 2", sans-serif', '#ffd23a');
  // Regal
  R(c, 132, 236, 190, 8, '#7a4a22', 2.5); R(c, 132, 296, 190, 8, '#7a4a22', 2.5);
  L(c, [140, 244, 150, 256], 3); L(c, [312, 244, 302, 256], 3);
  flask(c, 152, 236, '#7dff7a', 0); flask(c, 186, 236, '#ff5fa8', 1); flask(c, 214, 236, '#ffd23a', 2); flask(c, 246, 236, '#5fd3ff', 0); flask(c, 284, 236, '#c07dff', 1);
  flask(c, 160, 296, '#ff8a3d', 2); flask(c, 196, 296, '#7dff7a', 1); flask(c, 236, 296, '#ff5fa8', 0); flask(c, 276, 296, '#e8e8e8', 2); flask(c, 302, 296, '#5fd3ff', 2);
  // Gut-O-Mat (statische Teile)
  S(c, null, 7, () => { c.moveTo(372, 250); c.quadraticCurveTo(330, 330, 250, 318); }, '#2a2a30');
  R(c, 404, 316, 18, 26, '#5a6068', 3, 3); R(c, 558, 316, 18, 26, '#5a6068', 3, 3);
  R(c, 386, 166, 208, 156, '#c3ced8', 4, 30);
  R(c, 400, 178, 180, 10, 'rgba(255,255,255,0.6)', 0, 5);
  for (let i = 0; i < 3; i++) L(c, [404, 236 + i * 9, 576, 236 + i * 9], 2, '#93a0ad');
  R(c, 418, 156, 64, 18, '#2a2a30', 3, 7); R(c, 498, 156, 64, 18, '#2a2a30', 3, 7);
  L(c, [490, 138, 490, 156], 4);
  R(c, 412, 102, 156, 38, '#7a2f9a', 3, 8);
  txt(c, 'GUT-O-MAT', 490, 129, '400 21px "Titan One", sans-serif', '#ffd23a', 'center', 4, OUT);
  R(c, 366, 208, 26, 60, '#4a4f58', 3, 6); R(c, 372, 216, 14, 44, '#15151a', 2, 5);
  R(c, 416, 260, 92, 52, '#efe8d2', 2.5, 6);
  txt(c, 'BÖSE', 433, 276, '800 9px "Baloo 2", sans-serif', '#c02030'); txt(c, 'GUT', 493, 276, '800 9px "Baloo 2", sans-serif', '#208040');
  R(c, 592, 236, 22, 54, '#4a4f58', 3, 6);
  R(c, 520, 266, 60, 40, '#4a4f58', 2.5, 5);
  // Chrono-Klo
  drawKloModern(c, 730);
}
function drawMachineDyn(c, t) {
  const f = fl();
  for (let i = 0; i < 4; i++) {
    const on = f.cellIn ? Math.floor(t / 220 + i) % 3 !== 0 : false;
    E(c, 532 + i * 12, 278, 4, 4, on ? ['#7dff7a', '#ffd23a', '#ff5fa8', '#5fd3ff'][i] : '#2a2a30', 2);
  }
  E(c, 550, 296, 14, 3, f.cellIn ? '#3cf07a' : '#22262c', 1.5);
  if (f.cellIn) {
    const g = c.createRadialGradient(379, 238, 2, 379, 238, 34); g.addColorStop(0, 'rgba(140,255,130,0.6)'); g.addColorStop(1, 'rgba(140,255,130,0)');
    c.fillStyle = g; c.fillRect(345, 204, 68, 68);
    R(c, 373, 220, 12, 36, '#7dff7a', 2, 5);
  }
  if (f.breadIn && !f.toast) S(c, '#d8963e', 2.5, () => { c.moveTo(424, 160); c.quadraticCurveTo(424, 140, 450, 140); c.quadraticCurveTo(476, 140, 476, 160); c.closePath(); });
  const sh = G.machineShake ? (G.t - G.machineShake) : 1e9;
  if (sh < 1700) {
    for (let i = 0; i < 3; i++) {
      const k = ((sh / 600) + i * 0.33) % 1;
      c.save(); c.globalAlpha = 1 - k; E(c, 440 + i * 50 + Math.sin(sh * 0.02 + i) * 6, 150 - k * 70, 12 + k * 14, 10 + k * 10, '#eef2f6', 2.5); c.restore();
    }
    L(c, [378, 180 + Math.sin(sh * 0.08) * 3, 366, 176], 2.5); L(c, [602, 190 + Math.cos(sh * 0.08) * 3, 614, 186], 2.5);
  }
  const pop = G.toastPop ? (G.t - G.toastPop) : 1e9;
  if (pop < 1300) {
    const k = Math.min(1, pop / 300), y = 150 - Math.sin(k * Math.PI * 0.5) * 60 + Math.max(0, (pop - 700) / 600) * 60;
    c.save(); c.translate(450, y); c.rotate(Math.sin(pop * 0.01) * 0.3); ICON.toast(c); c.restore();
  }
}
function drawRegler(c) {
  const good = fl().regler === 'good';
  E(c, 462, 292, 15, 15, '#4a4f58');
  E(c, 462, 292, 10, 10, '#6a707a', 2);
  const a = good ? -0.75 : -2.4;
  L(c, [462, 292, 462 + Math.cos(a) * 15, 292 + Math.sin(a) * 15], 3.5, good ? '#3cf07a' : '#ff4050');
}
function drawHebel(c) {
  const lt = G.leverT ? G.t - G.leverT : 1e9;
  const down = lt < 900;
  const tx = down ? 630 : 624, ty = down ? 286 : 190;
  L(c, [603, 262, tx, ty], 9, OUT); L(c, [603, 262, tx, ty], 5, '#9aa3ad');
  E(c, tx, ty, 11, 11, '#d8243a');
  E(c, tx - 3, ty - 3, 3.5, 3, 'rgba(255,255,255,0.7)', 0);
}

room({
  id: 'labor', era: 'present', name: 'Labor', klo: 'klo_heute', floor: 'tile', amb: ['lab'],
  walk: [[20, 334], [940, 326], [955, 432], [5, 432]], yTop: 326,
  draw: bgLabor,
  dyn: (c, t) => {
    // gelegentliche Funken am Kabel
    const sp = (t % 5200) / 5200;
    if (sp < 0.06) for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + t * 0.01, r = 4 + sp * 260;
      L(c, [300 + Math.cos(a) * r * 0.4, 318 + Math.sin(a) * r * 0.25, 300 + Math.cos(a) * r * 0.5, 318 + Math.sin(a) * r * 0.32], 2.5, '#ffe36b');
    }
    for (let i = 0; i < 6; i++) {
      const x = [152, 186, 246, 196, 236, 284][i], y0 = [214, 214, 214, 274, 274, 214][i];
      const k = ((t * 0.0007) + i * 0.37) % 1;
      c.save(); c.globalAlpha = 1 - k; E(c, x + Math.sin(t * 0.004 + i) * 3, y0 - k * 34, 2.5 + k * 2, 2.5 + k * 2, null, 1.5, 0, '#e8fff0'); c.restore();
    }
  },
  objs: [
    { id: 'tuer_lobby', name: 'Lobby', rect: [14, 96, 100, 244], walk: [72, 354], exit: ['lobby', 815, 374, -1], look: 'Die Tür zur Lobby.' },
    { id: 'tafel', name: 'Tafel', rect: [134, 50, 186, 108], look: 'E = mc². Darunter, durchgestrichen: "E = mc Toast". Und ganz unten: "Brot kaufen!"', txt: { pick: 'Die Tafel ist an die Wand geschraubt. Dr. Fred hat schlechte Erfahrungen gemacht.' } },
    { id: 'regal', name: 'Regal', rect: [130, 196, 196, 110], walk: [228, 356], look: 'Dr. Freds Chemikalien. Eine Flasche trägt das Etikett "NICHT TRINKEN (diesmal ernsthaft)".', txt: { pick: 'Ich fasse keine von Dr. Freds Flaschen an. Die letzte hat meine Augenbrauen umgefärbt.' } },
    { id: 'gutomat', name: 'Gut-O-Mat', rect: [362, 98, 236, 244], walk: [490, 362], dv: 'look', draw: drawMachineDyn },
    { id: 'regler', name: 'Regler', rect: [440, 270, 46, 44], walk: [462, 362], dv: 'push', draw: drawRegler },
    { id: 'hebel', name: 'Hebel', rect: [588, 172, 54, 120], walk: [604, 362], dv: 'pull', draw: drawHebel },
    { id: 'klo_heute', name: 'Chrono-Klo', rect: [722, 56, 134, 286], walk: [788, 354], dv: 'open', klo: true, draw: (c) => kloFx(c, 'klo_heute', 788, 62, 340, 789, 60) },
  ],
});

// =================== 1776: GASTHAUS ===================
function bgGasthaus(c) {
  c.fillStyle = '#e6d2a2'; c.fillRect(0, 0, W, SH);
  const beam = '#4e3218';
  L(c, [170, 136, 372, 228], 16, OUT); L(c, [170, 136, 372, 228], 11, beam);
  L(c, [790, 136, 640, 228], 16, OUT); L(c, [790, 136, 640, 228], 11, beam);
  [0, 150, 372, 620, 790, 940].forEach(x => R(c, x, 40, 20, 192, beam, 2.5));
  R(c, -4, 120, W + 8, 16, beam, 2.5);
  R(c, 0, 0, W, 42, '#3e2712', 0);
  for (let i = 0; i < 9; i++) R(c, i * 118 - 6, 0, 28, 48, '#5a3a1e', 2.5, 3);
  // Täfelung
  P(c, [0, 230, W, 224, W, 310, 0, 318], '#8a5a2e');
  for (let x = 20; x < W; x += 34) L(c, [x, 236, x, 312], 2, '#6e4422');
  P(c, [0, 226, W, 220, W, 232, 0, 238], '#5a3a1e', 2.5);
  // Boden
  const fp = [0, 318, W, 310, W, SH, 0, SH]; P(c, fp, '#6e4626'); floorPlanks(c, fp, 480, '#55331a', [340, 368, 404]);
  // Fenster mit Blick ins Grüne
  R(c, 474, 60, 132, 124, '#5a3a1e', 3, 3);
  c.save(); c.beginPath(); c.rect(486, 72, 108, 100); c.clip();
  c.fillStyle = grad(c, 0, 72, 0, 172, [[0, '#9fd8ff'], [1, '#fff3c4']]); c.fillRect(486, 72, 108, 100);
  E(c, 530, 182, 90, 40, '#8fd06a', 2); E(c, 600, 176, 50, 30, '#7cc95a', 2); E(c, 512, 104, 14, 8, '#ffffff', 0);
  c.restore();
  R(c, 486, 72, 108, 100, null, 2.5);
  for (let i = 1; i < 3; i++) { L(c, [486 + 36 * i, 72, 486 + 36 * i, 172], 3, '#5a3a1e'); L(c, [486, 72 + 33 * i, 594, 72 + 33 * i], 3, '#5a3a1e'); }
  R(c, 466, 182, 148, 10, '#5a3a1e', 2.5, 2);
  P(c, [486, 190, 594, 190, 700, 336, 500, 344], 'rgba(255,240,180,0.16)', 0);
  // Schild
  R(c, 650, 64, 130, 40, '#7a4a22', 3, 4); txt(c, 'Zum Krummen Kamin', 715, 89, '700 13px "Baloo 2", sans-serif', '#f2d48a');
  // Kamin
  P(c, [96, 128, 190, 126, 184, 0, 102, 0], '#8f8a7e');
  const op = [34, 342, 246, 338, 238, 122, 42, 126];
  P(c, op, '#8f8a7e');
  c.save(); pth(c, op); c.clip();
  for (let y = 126, r = 0; y < 344; y += 22, r++) for (let x = 30 + (r % 2) * 20; x < 250; x += 40) R(c, x, y, 38, 20, '#a29c8e', 1.5, 4, '#77726a');
  c.restore(); P(c, op, null, 3);
  S(c, '#1e120a', 3, () => { c.moveTo(78, 334); c.lineTo(78, 250); c.quadraticCurveTo(140, 196, 202, 250); c.lineTo(202, 332); c.closePath(); });
  R(c, 24, 186, 232, 16, '#5a3a1e', 3, 3);
  // Standuhr (neu, gerade, glänzend)
  drawClock(c, 292, 330, 56, 218, '#a35a24', 0, true);
  // Tisch
  R(c, 404, 298, 14, 50, '#5e3a1c', 2.5); R(c, 622, 294, 14, 52, '#5e3a1c', 2.5);
  P(c, [390, 284, 644, 278, 654, 298, 384, 304], '#8a5a2e');
  P(c, [384, 304, 654, 298, 654, 306, 384, 312], '#6a4220', 2.5);
  P(c, [548, 272, 596, 268, 600, 284, 552, 288], '#f4ecd6', 2);
  S(c, null, 1.5, () => { c.moveTo(554, 280); c.bezierCurveTo(564, 270, 572, 286, 582, 274); c.bezierCurveTo(588, 270, 592, 280, 596, 276); });
  P(c, [604, 266, 636, 262, 640, 276, 608, 280], '#f4ecd6', 2);
  R(c, 524, 266, 12, 12, '#1d1d2a', 2, 2);
  // Hintertür (offen)
  P(c, [830, 338, 940, 332, 940, 104, 834, 110], '#5a3a1e');
  P(c, [842, 332, 928, 328, 928, 118, 846, 124], grad(c, 0, 118, 0, 330, [[0, '#bfe6ff'], [0.55, '#e8f6ff'], [0.56, '#7cc95a'], [1, '#5fae3e']]), 2.5);
  P(c, [846, 124, 884, 140, 884, 318, 842, 332], '#7a4a22');
  E(c, 876, 232, 4, 4, '#e2b85c', 2);
}
function drawFruitBowl(c) {
  const n = fl().apfel ? 2 : 3;
  const pos = [[456, 262], [480, 260], [468, 250]];
  for (let i = 0; i < n; i++) { c.save(); c.translate(pos[i][0], pos[i][1]); c.scale(0.55, 0.55); apple(c, ['#e0302a', '#e8402a', '#c8282a'][i]); c.restore(); }
  S(c, '#c8a060', 2.5, () => { c.moveTo(440, 266); c.quadraticCurveTo(444, 284, 468, 284); c.quadraticCurveTo(492, 284, 496, 266); c.closePath(); });
}

room({
  id: 'gasthaus', era: 'past', name: 'Gasthaus', floor: 'wood', amb: ['fire', 'clock'],
  walk: [[20, 334], [940, 326], [955, 432], [5, 432]], yTop: 326,
  draw: bgGasthaus,
  dyn: (c, t) => {
    const f = Math.sin(t * 0.02) * 4, g = Math.cos(t * 0.017) * 5;
    // Feuerschein auf dem Boden
    const glow = c.createRadialGradient(140, 330, 10, 140, 340, 230);
    glow.addColorStop(0, `rgba(255,150,40,${0.28 + Math.sin(t * 0.013) * 0.06})`); glow.addColorStop(1, 'rgba(255,150,40,0)');
    c.fillStyle = glow; c.fillRect(0, 150, 420, 290);
    // Staub tanzt im Sonnenstrahl
    for (let i = 0; i < 14; i++) {
      const k = ((t * 0.00004 * (1 + i % 3)) + i * 0.071) % 1, x = 500 + i * 13 + k * 150 + Math.sin(t * 0.001 + i) * 8, y = 190 + k * 140;
      c.save(); c.globalAlpha = 0.5 * Math.sin(k * Math.PI); E(c, x, y, 1.6, 1.6, '#fff6d0', 0); c.restore();
    }
    R(c, 100, 322, 86, 10, '#5a3418', 2.5, 4);
    S(c, '#ff8a1f', 2, () => { c.moveTo(96, 326); c.quadraticCurveTo(104 + f, 282, 122, 300 + g * 0.4); c.quadraticCurveTo(132, 264 + f, 146, 296); c.quadraticCurveTo(160 + g, 272, 170, 300); c.quadraticCurveTo(178, 286 - f, 186, 326); c.closePath(); });
    S(c, '#ffd23a', 0, () => { c.moveTo(112, 326); c.quadraticCurveTo(122, 300 + g, 134, 310); c.quadraticCurveTo(144, 290 - f, 154, 312); c.quadraticCurveTo(166, 300 + f, 172, 326); c.closePath(); });
    L(c, [140, 226, 140, 252], 2.5);
    S(c, '#2a2a30', 3, () => { c.moveTo(114, 256); c.quadraticCurveTo(112, 290, 140, 290); c.quadraticCurveTo(168, 290, 166, 256); c.closePath(); });
    E(c, 140, 256, 26, 5, '#3a3a40', 2.5);
    for (let i = 0; i < 2; i++) { const k = ((t * 0.0005) + i * 0.5) % 1; c.save(); c.globalAlpha = (1 - k) * 0.7; E(c, 134 + i * 14 + Math.sin(t * 0.003 + i) * 5, 248 - k * 40, 6 + k * 8, 5 + k * 6, '#f4f0ea', 0); c.restore(); }
  },
  objs: [
    { id: 'fenster_1776', name: 'Fenster', rect: [474, 60, 132, 124], look: 'Draußen scheint die Sonne auf das Jahr 1776. Keine Autos, kein WLAN. Nur Pferde. Sehr viele Pferde.' },
    { id: 'schild_1776', name: 'Schild', rect: [650, 64, 130, 40], look: '"Zum Krummen Kamin". Der Kamin ist tatsächlich krumm. Die Edisons bauen seit Generationen schief.' },
    { id: 'ofen', name: 'Kamin', rect: [34, 122, 214, 220], walk: [200, 362], look: 'Ein riesiger Steinkamin. Darüber blubbert ein Kessel. Es riecht nach Brot, das noch nicht gebacken wurde.', txt: { use: 'Ich koch hier nix. Das letzte Mal musste die Feuerwehr kommen. Und die gibt es hier noch gar nicht.', pick: 'Heiß! HEISS! Nein.' } },
    { id: 'uhr_1776', name: 'Standuhr', rect: [284, 100, 72, 232], walk: [320, 354], dv: 'open', draw: (c, t) => pendulum(c, t, 320, 176, 78, [305.4, 172, 29, 96]) },
    { id: 'tisch', name: 'Tisch', rect: [384, 276, 272, 72], walk: [520, 364], look: 'Ein Holztisch voller Zettel. Auf jedem steht "John Hancock". In riesigen Buchstaben.' },
    { id: 'obstschale', name: 'Obstschale', rect: [434, 238, 70, 48], walk: [470, 362], dv: 'pick', draw: drawFruitBowl },
    { id: 'tuer_garten', name: 'Garten', rect: [830, 100, 110, 240], walk: [884, 352], exit: ['garten1776', 120, 398, 1], look: 'Die Hintertür. Dahinter liegt der Garten.' },
  ],
});

// =================== 1776: GARTEN ===================
function bgGarten1776(c) {
  c.fillStyle = grad(c, 0, 0, 0, 300, [[0, '#62bdf6'], [1, '#d6f1ff']]); c.fillRect(0, 0, W, SH);
  E(c, 200, 70, 30, 30, '#ffe36b', 3, 0, '#f0b030');
  cloud(c, 380, 70, 1); cloud(c, 640, 46, 1.3); cloud(c, 900, 100, 0.9);
  S(c, '#8fd06a', 3, () => { c.moveTo(0, 250); c.quadraticCurveTo(200, 190, 420, 240); c.quadraticCurveTo(640, 180, 960, 236); c.lineTo(960, 300); c.lineTo(0, 300); c.closePath(); });
  [[470, 232, 22], [520, 226, 28], [700, 214, 24], [940, 222, 26]].forEach(([x, y, r]) => { R(c, x - 3, y, 6, 20, '#6b4424', 2); E(c, x, y - r * 0.4, r, r * 0.8, '#4f9a3a', 2.5); });
  P(c, [0, 294, W, 286, W, SH, 0, SH], '#5fae3e');
  for (let i = 0; i < 70; i++) { const x = (i * 137) % W, y = 300 + ((i * 53) % 130); L(c, [x, y, x - 3, y - 8], 2, '#4a9030'); L(c, [x, y, x + 3, y - 7], 2, '#4a9030'); }
  P(c, [100, 340, 220, 336, 300, SH, 30, SH], '#c8a06a', 2.5);
  // Gasthaus-Wand
  P(c, [0, 0, 124, 0, 124, 340, 0, 344], '#e6d2a2');
  R(c, 0, -4, 18, 350, '#4e3218', 2.5); R(c, 106, -4, 18, 346, '#4e3218', 2.5); R(c, 0, 90, 124, 14, '#4e3218', 2.5);
  P(c, [22, 338, 104, 334, 102, 126, 24, 122], '#7a4a22');
  for (let x = 40; x < 100; x += 18) L(c, [x, 126, x, 334], 2, '#5a3418');
  E(c, 92, 236, 4, 4, '#e2b85c', 2);
  // Zaun
  R(c, 344, 250, 364, 10, '#b07a3c', 2.5); R(c, 344, 280, 364, 10, '#b07a3c', 2.5);
  for (let x = 350; x <= 700; x += 26) P(c, [x, 302, x + 18, 302, x + 18, 236, x + 9, 226, x, 236], '#c69458', 2.5);
  // Brunnen
  R(c, 214, 182, 10, 98, '#6a4220', 2.5); R(c, 318, 182, 10, 98, '#6a4220', 2.5);
  P(c, [194, 194, 348, 194, 271, 146], '#a04a2a');
  for (let i = 1; i < 4; i++) L(c, [271 - i * 19, 146 + i * 12, 271 + i * 19, 146 + i * 12], 2, '#7a3418');
  L(c, [220, 202, 330, 202], 7); L(c, [220, 202, 330, 202], 4, '#8a6a3a');
  L(c, [330, 202, 342, 208, 342, 222], 4);
  L(c, [271, 204, 271, 258], 2, '#d8c098');
  R(c, 210, 276, 122, 62, '#9a948a', 3, 6);
  c.save(); c.beginPath(); c.rect(210, 276, 122, 62); c.clip();
  for (let y = 278, r = 0; y < 340; y += 16, r++) for (let x = 206 + (r % 2) * 14; x < 336; x += 28) R(c, x, y, 26, 14, '#aaa498', 1.5, 3, '#7a756c');
  c.restore(); R(c, 210, 276, 122, 62, null, 3, 6);
  E(c, 271, 276, 64, 14, '#b5ae9f'); E(c, 271, 276, 50, 9, '#1a2a3a', 2);
  // Plumpsklo mit Dr.-Fred-Technik
  P(c, [764, 342, 886, 338, 880, 132, 770, 136], '#9a6a3a');
  for (let x = 788; x < 880; x += 18) L(c, [x, 138, x, 340], 2, '#7a4e26');
  P(c, [750, 140, 898, 134, 884, 98, 764, 104], '#6a3a1e');
  R(c, 786, 152, 76, 182, '#8a5a2e', 3, 4);
  S(c, '#2a1408', 2.5, () => c.arc(824, 180, 11, 0, Math.PI * 2)); E(c, 830, 176, 9, 9, '#8a5a2e', 0);
  E(c, 850, 252, 4, 4, '#e2b85c', 2);
  E(c, 884, 196, 10, 10, '#d8b040'); L(c, [884, 196, 889, 190], 2);
  E(c, 884, 230, 7, 7, '#3cf0ff', 2.5);
  S(c, null, 2.5, () => { c.moveTo(884, 186); c.quadraticCurveTo(904, 140, 846, 104); }, '#c03030');
  L(c, [826, 102, 826, 66], 3);
  R(c, 794, 112, 60, 14, '#f2e6c0', 2, 2); txt(c, 'ABORT', 824, 123, '800 10px "Baloo 2", sans-serif', '#5a3a10');
}
function drawShovel(c) {
  L(c, [404, 186, 428, 296], 8, OUT); L(c, [404, 186, 428, 296], 4.5, '#b07a3c');
  R(c, 394, 178, 22, 9, '#b07a3c', 2.5, 3);
  P(c, [418, 292, 438, 288, 448, 318, 434, 330, 420, 318], '#9aa3ad');
}
function drawBeet(c, t) {
  const st = fl().beet || 0;
  E(c, 550, 374, 74, 20, '#6a4426'); E(c, 550, 370, 60, 13, '#7a5232', 0);
  if (st === 1) { E(c, 550, 372, 24, 8, '#2a1a0e', 2.5); E(c, 590, 366, 14, 6, '#7a5232', 2); }
  if (st >= 2) E(c, 550, 368, 22, 8, '#5a3a1e', 2.5);
  if (st === 3) {
    L(c, [550, 368, 550, 326], 6, OUT); L(c, [550, 368, 550, 326], 3, '#6b4424');
    [[550, 326, 0], [540, 342, -0.8], [560, 336, 0.8]].forEach(([x, y, r]) => {
      c.save(); c.translate(x, y); c.rotate(r);
      S(c, '#55b84a', 2.5, () => { c.moveTo(0, 0); c.quadraticCurveTo(10, -10, 0, -20); c.quadraticCurveTo(-10, -10, 0, 0); c.closePath(); });
      c.restore();
    });
  }
}

room({
  id: 'garten1776', era: 'past', name: 'Garten 1776', klo: 'plumpsklo', floor: 'grass', amb: ['birds'],
  walk: [[20, 334], [945, 330], [955, 432], [5, 432]], yTop: 330,
  draw: bgGarten1776,
  dyn: (c, t) => {
    // zwei Schmetterlinge
    for (let i = 0; i < 2; i++) {
      const x = 480 + Math.sin(t * 0.0006 + i * 2) * 160 + Math.sin(t * 0.0023 + i) * 30, y = 300 + Math.cos(t * 0.0009 + i * 3) * 40 + Math.sin(t * 0.004 + i) * 10;
      const w = Math.abs(Math.sin(t * 0.025 + i)) * 7 + 1, col = i ? '#ff8ac0' : '#ffd23a';
      E(c, x - 4, y, w, 5, col, 1.5); E(c, x + 4, y, w, 5, col, 1.5); L(c, [x, y - 4, x, y + 4], 2);
    }
    for (let i = 0; i < 2; i++) {
      const x = (t * 0.03 + i * 420) % (W + 200) - 100, y = 110 + i * 30 + Math.sin(t * 0.003 + i) * 8, f = Math.sin(t * 0.02 + i) * 5;
      L(c, [x - 8, y - f, x, y, x + 8, y - f], 2);
    }
  },
  objs: [
    { id: 'tuer_gasthaus', name: 'Gasthaus', rect: [18, 118, 92, 222], walk: [66, 354], exit: ['gasthaus', 815, 386, -1], look: 'Die Hintertür des Gasthauses.' },
    { id: 'zaun', name: 'Zaun', rect: [344, 224, 364, 78], look: 'Ein frisch gestrichener Zaun. Na ja, gestrichen. Angepinselt.', txt: { push: 'Der Zaun wackelt, hält aber. Wie die Kolonien.' } },
    { id: 'brunnen', name: 'Brunnen', rect: [190, 146, 160, 194], walk: [272, 360], look: 'Ein tiefer Brunnen. Ganz unten glitzert Wasser. Oder ein Goldstück. Oder ein Frosch mit Ambitionen.' },
    { id: 'eimer', name: 'Eimer', rect: [300, 244, 46, 40], walk: [306, 360], dv: 'pick', visible: () => !fl().eimer, draw: c => { c.save(); c.translate(322, 264); c.scale(0.95, 0.95); bucket(c, false); c.restore(); } },
    { id: 'schaufel', name: 'Schaufel', rect: [390, 176, 62, 156], walk: [418, 354], dv: 'pick', visible: () => !fl().schaufel, draw: drawShovel },
    { id: 'beet', name: () => ['Erdfleck', 'Erdloch', 'Erdhügel', 'Setzling'][fl().beet || 0], rect: [470, 320, 160, 74], walk: [660, 386], draw: drawBeet },
    { id: 'plumpsklo', name: 'Plumpsklo', rect: [748, 56, 154, 286], walk: [826, 356], dv: 'open', klo: true, draw: (c) => kloFx(c, 'plumpsklo', 826, 62, 340, 826, 62) },
  ],
});

// =================== ZUKUNFT: GARTEN ===================
function tower(c, x, base, h, w, col) {
  S(c, col, 3, () => {
    c.moveTo(x - w / 2, base);
    c.bezierCurveTo(x - w / 2 - 6, base - h * 0.5, x - w * 0.3, base - h * 0.85, x - w * 0.1, base - h);
    c.quadraticCurveTo(x + w * 0.25, base - h - 14, x + w * 0.35, base - h + 10);
    c.bezierCurveTo(x + w * 0.4, base - h * 0.6, x + w / 2 + 6, base - h * 0.3, x + w / 2, base);
    c.closePath();
  });
  for (let i = 0; i < 5; i++) E(c, x + w * 0.32, base - 20 - i * h * 0.16, 4.5, 3.5, mix(col, '#ffffff', 0.35), 1.5);
  for (let i = 0; i < 4; i++) R(c, x - w * 0.18, base - 30 - i * h * 0.2, 7, 9, (i * 7 + x) % 3 ? '#ffe36b' : '#3a1858', 1.5, 1);
}
function drawKloFuture(c, x) {
  R(c, x + 57, 80, 6, 34, '#9aa3ad', 2.5);
  E(c, x + 60, 340, 66, 12, '#2a1a40', 3);
  R(c, x + 6, 132, 108, 206, '#c9d3dc', 3.5, 44);
  R(c, x + 14, 150, 8, 160, 'rgba(255,255,255,0.6)', 0, 4);
  R(c, x + 24, 160, 72, 160, '#6a2fa8', 3, 34);
  R(c, x + 32, 170, 14, 80, 'rgba(255,255,255,0.25)', 0, 7);
  E(c, x + 60, 132, 46, 20, '#e6edf2', 3);
  R(c, x + 30, 262, 60, 16, '#ffd23a', 2.5, 3); txt(c, 'KLO 3000', x + 60, 274, '800 10px "Baloo 2", sans-serif', '#4a1a6a');
}
function bgFGarten(c) {
  c.fillStyle = grad(c, 0, 0, 0, 300, [[0, '#1c0838'], [0.6, '#6a2a7a'], [1, '#c85a8e']]); c.fillRect(0, 0, W, SH);
  for (let i = 0; i < 60; i++) E(c, (i * 137) % W, (i * 71) % 210, 1.3, 1.3, 'rgba(255,255,255,0.8)', 0);
  E(c, 180, 72, 30, 30, '#ffe6a0', 3, 0, '#c8a060'); E(c, 170, 64, 6, 5, '#f0d488', 0); E(c, 192, 82, 4, 3, '#f0d488', 0);
  E(c, 250, 42, 12, 12, '#ffc6e0', 2.5);
  [[40, 300, 190, 54, '#3b1660'], [300, 300, 150, 44, '#4a1f73'], [440, 300, 230, 60, '#3b1660'], [640, 300, 170, 50, '#5e2a8a'], [780, 300, 240, 64, '#4a1f73'], [920, 300, 160, 50, '#3b1660']]
    .forEach(([x, b, h, w, col]) => tower(c, x, b, h, w, col));
  S(c, '#9b2fd1', 2.5, () => c.ellipse(560, 70, 34, 10, 0, 0, Math.PI * 2)); E(c, 560, 64, 14, 8, '#c9d3dc', 2.5);
  const gp = [0, 302, W, 294, W, SH, 0, SH]; P(c, gp, '#86d457');
  c.save(); pth(c, gp); c.clip(); for (let i = 0; i < 26; i++) L(c, [i * 60 - 220, SH, i * 60 - 40, 294], 10, '#76c44a'); c.restore(); P(c, gp, null, 3);
  P(c, [520, SH, 700, SH, 960, 350, 960, 326, 880, 326], '#c9a8ea', 2.5);
  E(c, 700, 356, 84, 16, '#6a4a2a', 2.5);
  // Palast-Eingang
  P(c, [862, 340, 960, 336, 960, 86, 870, 104], '#5e2a86');
  S(c, '#1a0a2a', 3, () => { c.moveTo(884, 338); c.lineTo(884, 170); c.quadraticCurveTo(920, 116, 958, 160); c.lineTo(958, 336); c.closePath(); });
  L(c, [880, 172, 880, 336], 4, '#d8b040');
  R(c, 872, 66, 86, 24, '#d8b040', 2.5, 3); txt(c, 'PALAST', 915, 84, '800 14px "Baloo 2", sans-serif', '#4a1a6a');
  drawKloFuture(c, 80);
  // Statue
  R(c, 296, 262, 108, 78, '#8f86a6', 3, 4); R(c, 288, 254, 124, 14, '#a59cbc', 3, 3);
  txt(c, 'SEINE LILAHEIT', 350, 298, '800 11px "Baloo 2", sans-serif', '#2a1a40');
  txt(c, 'Herrscher der Welt', 350, 314, '700 9px "Baloo 2", sans-serif', '#2a1a40');
  c.save(); c.translate(346, 254); c.scale(0.8, 0.8); drawStatue(c); c.restore();
  // Laterne
  S(c, '#3c2a5a', 3, () => { c.moveTo(536, 340); c.bezierCurveTo(528, 260, 560, 180, 540, 110); c.quadraticCurveTo(530, 84, 544, 68); c.lineTo(554, 70); c.quadraticCurveTo(542, 86, 550, 110); c.bezierCurveTo(570, 180, 540, 260, 552, 340); c.closePath(); });
  E(c, 544, 342, 24, 7, '#3c2a5a', 3);
  R(c, 518, 24, 54, 46, '#2a1d40', 3, 8); R(c, 526, 31, 38, 32, '#14101e', 2, 6);
}
function drawLampDyn(c, t) {
  if (fl().zelle) return;
  const p = 0.5 + Math.sin(t * 0.005) * 0.2;
  const g = c.createRadialGradient(545, 47, 3, 545, 47, 60); g.addColorStop(0, `rgba(140,255,130,${p})`); g.addColorStop(1, 'rgba(140,255,130,0)');
  c.fillStyle = g; c.fillRect(485, -13, 120, 120);
  c.save(); c.translate(545, 47); c.rotate(Math.PI / 2); c.scale(0.7, 0.7); ICON.zelle(c); c.restore();
}
function drawBigTree(c, t) {
  let k = 1;
  if (G.treeGrowT) {
    const x = Math.max(0, Math.min(1, (G.t - G.treeGrowT) / 1800));
    k = x < 1 ? (1 - Math.pow(1 - x, 3)) * (1 + Math.sin(x * Math.PI) * 0.08) : 1;
  }
  if (k <= 0) return;
  c.save(); c.translate(700, 356); c.scale(k, k);
  S(c, '#6b4424', 3, () => { c.moveTo(-28, 0); c.quadraticCurveTo(-14, -80, -22, -170); c.lineTo(-4, -192); c.lineTo(18, -170); c.quadraticCurveTo(10, -80, 30, 0); c.closePath(); });
  L(c, [-14, -150, -96, -212], 14, OUT); L(c, [-14, -150, -96, -212], 9, '#6b4424');
  L(c, [6, -160, 80, -226], 12, OUT); L(c, [6, -160, 80, -226], 7, '#6b4424');
  const blobs = [[-150, -206, 52], [-104, -258, 66], [-30, -292, 78], [52, -272, 72], [108, -226, 56], [-60, -214, 60], [24, -212, 62]];
  blobs.forEach(([x, y, r]) => E(c, x, y, r, r * 0.8, null, 7, 0, OUT));
  blobs.forEach(([x, y, r]) => E(c, x, y, r, r * 0.8, '#3f9a3a', 0));
  blobs.forEach(([x, y, r]) => E(c, x - r * 0.25, y - r * 0.25, r * 0.55, r * 0.4, '#55b84a', 0));
  [[-140, -200], [-96, -244], [-40, -300], [20, -256], [80, -280], [120, -220], [-60, -196], [40, -200], [-10, -240]].forEach(([x, y]) => {
    E(c, x, y, 8, 8, '#e0302a', 2); E(c, x - 2, y - 2, 2.5, 2, 'rgba(255,255,255,0.6)', 0);
  });
  c.restore();
}

room({
  id: 'fgarten', era: 'future', name: 'Zukunftsgarten', klo: 'klo_zukunft', floor: 'grass', amb: ['future'],
  walk: [[20, 334], [945, 330], [955, 432], [5, 432]], yTop: 330,
  draw: bgFGarten,
  dyn: (c, t) => {
    // Tentakel-Ufo patrouilliert am Himmel
    const uk = (t % 14000) / 14000, ux = -80 + uk * (W + 160), uy = 120 + Math.sin(uk * Math.PI * 4) * 14;
    c.save(); c.globalAlpha = 0.18; P(c, [ux - 8, uy + 6, ux + 8, uy + 6, ux + 40, uy + 150, ux - 40, uy + 150], '#a6ff8f', 0); c.restore();
    E(c, ux, uy, 26, 8, '#9aa3ad', 2.5); E(c, ux, uy - 5, 11, 7, '#c9a6ff', 2.5);
    for (let i = -1; i <= 1; i++) E(c, ux + i * 12, uy + 1, 2, 2, Math.floor(t / 200 + i) % 2 ? '#ffe36b' : '#ff5fa8', 0);
    const k = 0.5 + Math.sin(t * 0.004) * 0.5;
    E(c, 140, 340, 66, 12, null, 3, 0, `rgba(60,240,255,${0.4 + k * 0.6})`);
    for (let i = 0; i < 8; i++) {
      const x = (i * 131 + t * 0.012 * (i % 3 + 1)) % W, y = 120 + ((i * 47 + t * 0.008) % 160);
      E(c, x, y, 2, 2, `rgba(255,220,255,${0.3 + 0.3 * Math.sin(t * 0.003 + i)})`, 0);
    }
  },
  objs: [
    { id: 'klo_zukunft', name: 'Chrono-Klo', rect: [76, 76, 132, 266], walk: [142, 358], dv: 'open', klo: true, draw: (c) => kloFx(c, 'klo_zukunft', 140, 82, 340, 140, 78) },
    { id: 'statue', name: 'Statue', rect: [286, 80, 128, 262], walk: [350, 360], look: 'Eine Statue von Lila Tentakel: "Seine Lilaheit, Herrscher der Welt". Er hat darauf bestanden, dass sie überlebensgroß ist.', txt: { push: 'Sie ist schwerer, als sie aussieht. Wie sein Ego.', pull: 'Keine Chance. Sie ist festgeschraubt. Und festgeklebt. Und vermutlich festgezaubert.', talk: 'Hallo, Stein-Lila. Du bist mir fast sympathischer als das Original.' } },
    { id: 'baumplatz', name: 'Kahler Fleck', rect: [612, 336, 176, 40], walk: [700, 394], visible: () => !fl().tree, look: 'Ein trauriger, kahler Fleck Erde. Hier hat wohl nie jemand etwas gepflanzt. Schade eigentlich.' },
    { id: 'baum', name: 'Apfelbaum', rect: [580, 40, 270, 316], walk: [650, 382], dv: 'use', visible: () => !!fl().tree, draw: drawBigTree },
    { id: 'laterne', name: 'Laterne', rect: [514, 20, 64, 324], walk: [560, 362], draw: drawLampDyn },
    { id: 'zum_palast', name: 'Palast', rect: [864, 60, 96, 282], walk: [912, 352], exit: ['vorraum', 120, 396, 1], look: 'Der Eingang zum Palast Seiner Lilaheit. Natürlich lila.' },
  ],
});

// =================== ZUKUNFT: PALAST-VORRAUM ===================
function banner(c, x) {
  P(c, [x, 40, x + 44, 40, x + 44, 214, x + 22, 232, x, 214], '#9b2fd1');
  L(c, [x + 5, 44, x + 5, 210], 2, '#d8b040'); L(c, [x + 39, 44, x + 39, 210], 2, '#d8b040');
  E(c, x + 22, 120, 14, 14, '#d8b040', 2.5);
  S(c, '#8e44c9', 2, () => { c.moveTo(x + 15, 130); c.quadraticCurveTo(x + 14, 108, x + 22, 108); c.quadraticCurveTo(x + 30, 108, x + 28, 130); c.closePath(); });
}
function bgVorraum(c) {
  c.fillStyle = '#4b1f6e'; c.fillRect(0, 0, W, SH);
  for (let x = 0; x < W; x += 40) R(c, x, 42, 20, 270, '#55267a', 0);
  R(c, 0, 0, W, 36, '#2e0f45', 0); R(c, -4, 34, W + 8, 8, '#d8b040', 2.5);
  const fp = [0, 316, W, 310, W, SH, 0, SH];
  P(c, fp, '#cdb6e6'); c.save(); pth(c, fp); c.clip(); checkerFloor(c, 310, SH, '#cdb6e6', '#9d7cc4', 6, 12); c.restore();
  R(c, -4, 302, W + 8, 14, '#2e0f45', 2.5);
  [104, 352, 592, 886].forEach(x => { R(c, x, 42, 34, 262, '#6b2f96', 3); R(c, x - 6, 42, 46, 16, '#d8b040', 2.5, 2); R(c, x - 6, 288, 46, 16, '#d8b040', 2.5, 2); });
  S(c, '#1a0a2a', 3, () => { c.moveTo(4, 340); c.lineTo(4, 170); c.quadraticCurveTo(48, 118, 92, 170); c.lineTo(92, 336); c.closePath(); });
  // Plakat
  R(c, 150, 92, 130, 146, '#ffd23a', 3, 3);
  txt(c, 'LILA IST', 215, 116, '800 16px "Baloo 2", sans-serif', '#5b2589');
  c.save(); c.translate(208, 214); c.scale(0.42, 0.42); CHAR.purple(c, { talking: false, walking: false, phase: 0, seed: 1 }, 0); c.restore();
  txt(c, 'DEIN FREUND', 215, 230, '800 13px "Baloo 2", sans-serif', '#5b2589');
  banner(c, 296); banner(c, 640);
  // Tür zum Thronsaal
  S(c, '#3a1252', 4, () => { c.moveTo(400, 338); c.lineTo(400, 160); c.quadraticCurveTo(485, 46, 570, 160); c.lineTo(570, 334); c.closePath(); });
  L(c, [485, 92, 485, 336], 3);
  L(c, [404, 204, 566, 204], 6, OUT); L(c, [404, 204, 566, 204], 3, '#d8b040');
  L(c, [402, 292, 568, 292], 6, OUT); L(c, [402, 292, 568, 292], 3, '#d8b040');
  E(c, 472, 250, 6, 6, '#d8b040', 2.5); E(c, 498, 250, 6, 6, '#d8b040', 2.5);
  E(c, 485, 140, 22, 22, '#d8b040', 3);
  S(c, '#8e44c9', 2.5, () => { c.moveTo(475, 156); c.quadraticCurveTo(472, 124, 485, 124); c.quadraticCurveTo(498, 124, 496, 156); c.closePath(); });
  // Verbotsschild
  R(c, 712, 96, 140, 80, '#f4f0f6', 3, 6);
  P(c, [742, 128, 760, 128, 758, 146, 744, 146], '#8a5a2a', 2);
  E(c, 752, 136, 24, 24, null, 5, 0, '#d8243a'); L(c, [736, 120, 768, 152], 5, '#d8243a');
  txt(c, 'KAFFEE', 812, 134, '800 15px "Baloo 2", sans-serif', '#d8243a');
  txt(c, 'VERBOTEN', 812, 154, '800 15px "Baloo 2", sans-serif', '#d8243a');
}

room({
  id: 'vorraum', era: 'future', name: 'Palast-Vorraum', floor: 'marble', amb: ['palace'], theme: 'palace',
  walk: [[20, 334], [945, 330], [955, 432], [5, 432]], yTop: 330,
  draw: bgVorraum,
  dyn: (c, t) => {
    // Überwachungsdrohne Seiner Lilaheit
    const dx = 560 + Math.sin(t * 0.0005) * 300, dy = 64 + Math.sin(t * 0.002) * 8;
    L(c, [dx - 22, dy - 8, dx + 22, dy - 8], 2.5); E(c, dx - 22, dy - 9, 9, 2, '#c9d3dc', 1.5); E(c, dx + 22, dy - 9, 9, 2, '#c9d3dc', 1.5);
    E(c, dx, dy, 13, 10, '#5b2589', 2.5); E(c, dx + 4, dy + 1, 4, 4, Math.floor(t / 400) % 2 ? '#ff4050' : '#7a1020', 0);
    c.save(); c.globalAlpha = 0.12; P(c, [dx, dy + 8, dx + 50, 330, dx - 30, 330], '#ff4050', 0); c.restore();
  },
  objs: [
    { id: 'zum_garten', name: 'Garten', rect: [0, 110, 96, 232], walk: [52, 362], exit: ['fgarten', 830, 388, -1], look: 'Zurück in den Garten.' },
    { id: 'plakat', name: 'Plakat', rect: [150, 92, 130, 146], look: '"LILA IST DEIN FREUND". Darunter, ganz klein: "Widerspruch ist zwecklos und außerdem unhöflich."', txt: { pick: 'Es ist festgeklebt. Mit Tentakelschleim. Igitt.', pull: 'Es ist festgeklebt. Mit Tentakelschleim. Igitt.' } },
    { id: 'banner', name: 'Banner', rect: [296, 40, 44, 192], look: 'Ein Banner mit Lilas Wappen: ein Tentakel, der einen kleineren Tentakel umarmt. Oder würgt. Schwer zu sagen.' },
    { id: 'banner2', name: 'Banner', rect: [640, 40, 44, 192], look: 'Noch ein Banner. Lila hat offenbar einen Großhandel für Banner.' },
    { id: 'verbot', name: 'Schild', rect: [712, 96, 140, 80], look: '"KAFFEE VERBOTEN". Seit hundert Jahren. Die Menschheit war noch nie so müde.' },
    { id: 'thron_tuer', name: 'Thronsaal', rect: [400, 60, 170, 278], walk: () => fl().guardGone ? [485, 352] : [396, 398], look: 'Die Tür zum Thronsaal. Sie ist größer als nötig. Wie alles hier.' },
  ],
});

// =================== ZUKUNFT: THRONSAAL ===================
function bgThron(c) {
  c.fillStyle = '#3a0f52'; c.fillRect(0, 0, W, SH);
  for (let i = 0; i < 13; i++) {
    const x = i * 80 - 20;
    S(c, i % 2 ? '#7a1fa2' : '#6a1a8e', 2.5, () => { c.moveTo(x, 0); c.quadraticCurveTo(x + 20, 160, x - 6, 324); c.lineTo(x + 80, 324); c.quadraticCurveTo(x + 60, 160, x + 80, 0); c.closePath(); });
  }
  for (let i = 0; i < 8; i++) S(c, '#d8b040', 3, () => { c.moveTo(i * 120, -2); c.quadraticCurveTo(i * 120 + 60, 52, i * 120 + 120, -2); c.closePath(); });
  P(c, [0, 324, W, 318, W, SH, 0, SH], '#2a0a3a');
  P(c, [380, SH, 640, SH, 612, 350, 518, 350], '#b0213a');
  L(c, [380, SH, 518, 350], 3, '#d8b040'); L(c, [640, SH, 612, 350], 3, '#d8b040');
  P(c, [440, 352, 862, 352, 848, 332, 456, 332], '#c9a040');
  P(c, [456, 332, 848, 332, 834, 314, 470, 314], '#e0bc5a');
  S(c, '#f2c14e', 3, () => { c.moveTo(590, 318); c.lineTo(588, 170); c.bezierCurveTo(580, 90, 640, 56, 660, 100); c.bezierCurveTo(690, 40, 742, 90, 726, 170); c.lineTo(724, 318); c.closePath(); });
  S(c, '#7a1fa2', 3, () => { c.moveTo(606, 300); c.lineTo(604, 176); c.bezierCurveTo(600, 118, 640, 96, 658, 124); c.bezierCurveTo(680, 90, 716, 120, 708, 176); c.lineTo(706, 300); c.closePath(); });
  E(c, 657, 92, 8, 8, '#3cf0ff', 2.5);
  R(c, 572, 250, 30, 70, '#f2c14e', 3, 8); R(c, 712, 250, 30, 70, '#f2c14e', 3, 8);
  R(c, 596, 290, 122, 30, '#9b2fd1', 3, 6);
  S(c, '#1a0a2a', 3, () => { c.moveTo(4, 340); c.lineTo(4, 170); c.quadraticCurveTo(48, 118, 92, 170); c.lineTo(92, 336); c.closePath(); });
}

room({
  id: 'thron', era: 'future', name: 'Thronsaal', floor: 'carpet', amb: ['palace'], theme: 'palace',
  walk: [[20, 356], [945, 356], [955, 432], [5, 432]], yTop: 356,
  draw: bgThron,
  dyn: (c, t) => {
    for (let i = 0; i < 6; i++) {
      const k = ((t * 0.0004) + i / 6) % 1, x = 600 + Math.cos(i * 2.1) * 110, y = 300 - k * 220;
      c.save(); c.globalAlpha = Math.sin(k * Math.PI) * 0.8;
      L(c, [x - 4, y, x + 4, y], 2, '#ffe9a0'); L(c, [x, y - 4, x, y + 4], 2, '#ffe9a0'); c.restore();
    }
    const s = Math.sin(t * 0.0015) * 0.04;
    c.save(); c.translate(300, 0); c.rotate(s);
    L(c, [0, 0, 0, 80], 3); E(c, 0, 96, 50, 12, '#d8b040', 3);
    for (let i = -2; i <= 2; i++) { R(c, i * 20 - 3, 74, 6, 18, '#fff6e0', 2, 2); E(c, i * 20, 70 + Math.sin(t * 0.02 + i) * 1.5, 3, 5, '#ffd23a', 0); }
    c.restore();
  },
  objs: [
    { id: 'thron_raus', name: 'Vorraum', rect: [0, 110, 96, 232], walk: [52, 376], exit: ['vorraum', 485, 354, 1], look: 'Zurück in den Vorraum.' },
    { id: 'thron', name: 'Thron', rect: [570, 50, 176, 266], look: 'Ein Thron aus purem Gold. Mit Kissen. Und Getränkehalter. Weltherrschaft hat ihre Vorzüge.', txt: { use: 'Da sitzt schon wer. Sehr lila. Sehr eingebildet.' } },
    { id: 'teppich', name: 'Teppich', rect: [380, 352, 260, 88], look: 'Ein roter Teppich. Lila hat ihn selbst ausgerollt. Für sich selbst.' },
  ],
});
