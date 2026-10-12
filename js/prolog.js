'use strict';
// ============================================================
//  Prolog „Wie alles begann“ – vor dem Intro eines neuen Spiels:
//  Die Kamera schwenkt über eine Naturidylle (3D-Panorama aus Blender, art/blender/prolog_build.py) bis zum
//  Herrenhaus, zoomt ans Flussufer, wo aus Dr. Freds Abflussrohr lila Glibber in den Fluss läuft – der Lila
//  Tentakel trinkt davon, bekommt Arme und wird größenwahnsinnig. Eine Verbeugung vor dem Anfang des Originals.
//  Läuft als eigener „Raum“ (nur Bild, keine Hotspots); überspringbar wie das Intro.
// ============================================================
const PROLOG_IMG = loadImg('img/prolog.jpg');
// Bildpunkte im Panorama (3840 × 880, aus prolog_build.py): Rohrmündung, Wasser darunter, Schleimfleck, Ufer
const PROLOG_AT = { muendung: [2965.5, 375.6], wasser: [3035.8, 429.1], fleck: [2929.9, 435.8], ufer: [3026.1, 456.2], ppm: 53.7 };
const PRO = { pw: 1920, ph: 440 };   // Panorama in Raum-Einheiten (halbe Pixel)
const pro = (p) => [p[0] / 2, p[1] / 2];
ROOMS.prolog = {
  id: 'prolog', name: 'Wie alles begann', era: 'prolog', sMin: 1, sMax: 1, yTop: 400, yBot: 432, walk: [[0, 420], [960, 420], [960, 432], [0, 432]], objs: [], floor: 'grass',
  draw(g) { g.fillStyle = '#5aa848'; g.fillRect(0, 0, W, SH); },
  dyn(c, t) { drawProlog(c, t); },
};
ROOM_FX.prolog = { music: 'past', amb: ['birds', 'wind'], verb: [0.3, 0.06], light: [1, '#fff4d8', '#3a5a40'], bloom: 0.2 };
// Kamera über dem Panorama: Mittelpunkt (x, y) und Zoom
function prologCam(t) {
  const P = G.prolog, k = Math.min(1, Math.max(0, (t - P.t0) / P.panMs)), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  let x = 480 + (PRO.pw - 960) * e, y = 220, z = 1;
  if (P.zoomT) {
    const u = Math.min(1, (t - P.zoomT) / 2600), ez = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, [fx, fy] = pro(PROLOG_AT.ufer);
    z = 1 + 0.95 * ez; x += (fx - 30 - x) * ez; y += (fy - 50 - y) * ez;
  }
  const hw = 480 / z, hh = 220 / z;
  return { x: Math.max(hw, Math.min(PRO.pw - hw, x)), y: Math.max(hh, Math.min(PRO.ph - hh, y)), z };
}
function drawTentSprite(c, im, x, y, h, flip, filter, rot) {
  if (!imgOk(im)) return;
  const w = h * im.naturalWidth / im.naturalHeight;
  c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(flip ? -1 : 1, 1);
  if (filter && !c.isPix) c.filter = filter;
  c.drawImage(im, -w * 0.5, -h, w, h);
  c.restore();
}
// Im Echtzeit-3D zeigt die Szene selbst alles (Kamerafahrt, Tentakel, Glibber) – dann malt der Prolog nichts dazu
function prolog3d() { return typeof echt3dOn === 'function' && echt3dOn(ROOMS.prolog) && !!(ECHT3D.mod && ECHT3D.mod.kameraflug); }
// Kamerafahrt (Blender-Meter: Ort und Blickziel): über die Blumenwiese links, an der Brücke vorbei, hinauf zum Haus
// auf dem Hügel und dann hinunter ans Ufer, wo die beiden Tentakel neben Dr. Freds Abflussrohr stehen
const PROLOG_FLUG = [
  [-26, 2, 2.4, -30, 40, 2.5], [-16, 6, 3.2, -14, 40, 2.5], [-6, 12, 3.6, -5, 27, 0.8], [4, 18, 4.5, 14, 50, 3],
  [10, 24, 6.5, 24, 74, 8], [18, 31, 4.0, 20, 46, 1.6], [25.8, 37.6, 2.6, 19.0, 47.5, 1.0],   // Schluss: Lila in der Mitte, Grün links, Rohr und Haus dahinter
];
function prolog3dWarten(ms) {
  const t0 = performance.now();
  return new Promise(fertig => {
    const p = () => {
      const m = ECHT3D.mod;
      if (!G.settings.echt3d || G.settings.retro || ECHT3D.failed || G.skipAll || performance.now() - t0 > ms || (m && m.ready && (m.raumGeladen('prolog') || m.failed('prolog')))) return fertig();
      if (m && m.ready) m.hasRoom('prolog');
      setTimeout(p, 100);
    };
    p();
  });
}
function drawProlog(c, t) {
  const P = G.prolog;
  if (P && prolog3d()) return;
  if (!P || !imgOk(PROLOG_IMG)) { c.fillStyle = '#5aa848'; c.fillRect(0, 0, W, SH); return; }
  const cam = prologCam(t);
  c.save();
  c.translate(480, 220); c.scale(cam.z, cam.z); c.translate(-cam.x, -cam.y);
  c.drawImage(PROLOG_IMG, 0, 0, PRO.pw, PRO.ph);
  // Vögel ziehen über die Idylle
  for (let i = 0; i < 5; i++) {
    const bx = ((t * 0.02 + i * 330) % (PRO.pw + 200)) - 100, by = 40 + Math.sin(i * 2.1) * 20 + Math.sin(t * 0.002 + i) * 6, wf = Math.sin(t * 0.02 + i * 2) * 4;
    L(c, [bx - 7, by - wf, bx, by, bx + 7, by - wf], 1.6, '#2a2440');
  }
  const [mx, my] = pro(PROLOG_AT.muendung), [wx, wy] = pro(PROLOG_AT.wasser), [fx, fy] = pro(PROLOG_AT.fleck), [ux, uy] = pro(PROLOG_AT.ufer);
  // Glibber aus dem Rohr: ein dicker, schwappender Strahl, Spritzer im Wasser, der Fleck leuchtet und wächst
  if (P.sludgeT) {
    const k = Math.min(1, (t - P.sludgeT) / 600), grow = Math.min(1, (t - P.sludgeT) / 4000);
    if (!c.isPix) glowAt(c, fx + 6, fy, 26 + 30 * grow, '#c06aff', 0.35 + 0.25 * grow);
    c.save(); c.lineCap = 'round';
    for (const [w, col] of [[10, '#4a1068'], [7, '#b44ae0'], [2.4, '#ecc0ff']]) {
      c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(mx, my);
      const ex = mx + (wx - mx) * k, ey = my + (wy - my) * k;
      c.quadraticCurveTo(mx + 6 + Math.sin(t * 0.01) * 1.5, my + (ey - my) * 0.2, ex, ey); c.stroke();
    }
    if (k >= 1) for (let i = 0; i < 5; i++) {   // Glibbertropfen fallen am Strahl entlang
      const u = ((t * 0.0016 + i * 0.2) % 1), qx = mx + (wx - mx) * u + Math.sin(i * 3 + t * 0.01) * 2.5, qy = my + (wy - my) * u * u;
      E(c, qx, qy, 2.6, 3.4, '#c46af0', 1, 0, '#4a1068');
    }
    if (k >= 1) for (let i = 0; i < 6; i++) {   // Blubb-Blasen und Spritzer
      const u = ((t * 0.0012 + i * 0.17) % 1), a = 1 - u;
      E(c, wx + (hash01(i * 5.3) - 0.5) * 22, wy - u * 8, 1.4 + u * 1.4, 1.4 + u * 1.4, `rgba(200,120,255,${a.toFixed(2)})`, 0.8, 0, '#5a1a7a');
    }
    c.restore();
  }
  // die beiden Tentakel am Ufer: Grün links, Lila nah am Wasser (vor dem Trinken noch ohne Arme)
  const th = 1.95 * PROLOG_AT.ppm / 2, bob = Math.sin(t * 0.004) * 1.2;
  drawTentSprite(c, TENT_IMG.green, ux - 30, uy + 5 + bob, th, false);
  const drink = P.drinkT ? Math.min(1, (t - P.drinkT) / 500) * (P.armsT ? Math.max(0, 1 - (t - P.armsT) / 400) : 1) : 0;
  const lx = ux + 8, ly = uy + Math.sin(t * 0.0045 + 1) * 1.2;
  if (P.armsT && t > P.armsT) {   // Arme! Kurz aufblitzen, dann ein Stück größer und triumphierend
    const a = Math.min(1, (t - P.armsT) / 300), pulse = 1 + Math.max(0, 1 - (t - P.armsT) / 700) * 0.25 * Math.sin((t - P.armsT) * 0.04);
    if (!c.isPix) glowAt(c, lx, ly - th * 0.6, th * 1.1, '#ff7ad9', 0.6 * (1 - Math.min(1, (t - P.armsT) / 1200)) + 0.12);
    drawTentSprite(c, TENT_IMG.lila, lx, ly, th * 1.18 * pulse * a + th * (1 - a), true);
  } else drawTentSprite(c, TENT_IMG.green, lx, ly, th, true, 'hue-rotate(165deg) saturate(1.15)', drink * 0.55);
  c.restore();
  // Kino-Balken zeichnet jetzt js/vorspann.js (drawKino) für den ganzen Vorspann
}
async function PROLOG() {
  if (G.fast || G.settings.retro || !G.state) return;
  if (!imgOk(PROLOG_IMG)) await new Promise(r => { const t0 = performance.now(), p = () => imgOk(PROLOG_IMG) || performance.now() - t0 > 4000 ? r() : setTimeout(p, 80); p(); });   // Panorama noch unterwegs: kurz warten
  if (!imgOk(PROLOG_IMG)) return;
  G.inIntro = true;
  G.prolog = { t0: G.t + 400, panMs: 10000, sludgeT: 0, drinkT: 0, armsT: 0, zoomT: 0 };
  const keep = G.viewRoom; G.viewRoom = 'prolog'; markVisit('prolog'); music();
  const tentakel = ['green', 'lila'], vorher = {};
  for (const id of tentakel) { const a = ACT[id]; vorher[id] = { room: a.room, x: a.x, y: a.y, dir: a.dir, visible: a.visible }; }
  try {
    if (G.settings.echt3d && !G.settings.retro && typeof echt3dLoad === 'function') { echt3dLoad(); await prolog3dWarten(9000); G.prolog.t0 = G.t + 400; }
    if (prolog3d()) {   // Echtzeit-3D: Kamerafahrt durch die Szene, die Tentakel stehen als 3D-Figuren am Ufer
      ECHT3D.mod.kameraflug('prolog', PROLOG_FLUG, G.prolog.panMs + 2600, 38);
      const O = ECHT3D.mod.PROLOG3D, g = ECHT3D.mod.spielVonWelt('prolog', O.gruen), l = ECHT3D.mod.spielVonWelt('prolog', O.lila);
      if (g && l) {
        Object.assign(ACT.green, { room: 'prolog', x: g[0], y: g[1], dir: 1, visible: true, target: null, walking: false });
        Object.assign(ACT.lila, { room: 'prolog', x: l[0], y: l[1], dir: -1, visible: true, target: null, walking: false });
      }
    }
    G.titelKarte = { t0: G.t, dauer: 4400, text: 'Wie alles begann ...', logo: true };   // Kino-Titelkarte mit Logo (js/vorspann.js)
    await fadeTo(0, 900);
    await wait(3500); G.titelKarte = null;
    await wait(Math.max(0, G.prolog.t0 + G.prolog.panMs - G.t));
    G.prolog.zoomT = G.t; await wait(2700);
    Sound.play('lab'); Sound.sfx('pour'); G.prolog.sludgeT = G.t; await wait(1500);
    await say('green', 'Bruder, trink das nicht! Das kommt aus Dr. Freds Glibber-O-Mat!');
    await say('lila', 'Ach was. Ein Schlückchen Fluss hat noch keinem geschadet.');
    G.prolog.drinkT = G.t; Sound.sfx('slurp'); await wait(1300);
    await say('lila', '*schmatz* … Hm. Schmeckt nach … nach …');
    G.prolog.armsT = G.t; Sound.sfx('warp'); shake(900, 6); await wait(1300);
    await say('lila', '… nach MACHT! Ich fühle mich, als könnte ich … DIE WELT EROBERN!');
    await say('green', 'Oh nein. Nicht schon wieder Arme.');
    await say('lila', 'MUAHAHAHA! Zuerst den Fluss! Dann die Wiese! Dann … ALLES!');
    await fadeTo(1, 900, 'black');
  } finally {
    if (typeof ECHT3D !== 'undefined' && ECHT3D.mod && ECHT3D.mod.kameraflugEnde) ECHT3D.mod.kameraflugEnde('prolog');
    for (const id of tentakel) Object.assign(ACT[id], vorher[id], { target: null, walking: false });
    G.prolog = null; G.viewRoom = keep; G.caption = null;
  }
}
{ const introOhneProlog = INTRO; INTRO = async function () { await PROLOG(); return introOhneProlog(); }; }
