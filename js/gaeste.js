'use strict';
// ============================================================
//  Tentakel-Toast – Crossover: Der Dimensionsriss
//  Der Gut-O-Mat zieht so viel Strom, dass das Chrono-Klo leckt: Durch den Riss
//  sind Gäste aus anderen Welten gefallen – liebevolle Verbeugungen vor Maniac
//  Mansion, Sam & Max, Monkey Island, Fluch der Karibik, Salad Fingers, Futurama,
//  Portal und Simon the Sorcerer (eigene 3D-Modelle und Texte, keine Original-Assets).
//  Jeder Gast trägt sich ins Gästebuch ein, wenn man ihm hilft; sind alle drin,
//  kann Dr. Fred den Riss in ein Tor verwandeln. Dazu drei neue Räume in 3D:
//  Hafen 1776 und Landeplatz (Blender), Testkammer (Unreal Engine).
// ============================================================

// ---------- Hafen in Bewegung ----------
// Ebenen aus Blender (hafen_post.py): ruhender Hintergrund, ziehende Wolken, das Schiff in vier Windphasen (wehende Flagge,
// atmende Segel), das auf den Wellen schaukelt, und der Vordergrund. Wellenkämme, Glitzern, Gischt und Möwen zeichnet
// das Spiel dazu. Im Pixel-Modus und für die Karte bleibt es beim ruhenden Gesamtbild.
const HAFEN_IMG = { bg: loadImg('img/hafen/bg.jpg'), wolken: loadImg('img/hafen/wolken.png'), vorn: loadImg('img/hafen/vorn.png'), schiff: loadImg('img/hafen/schiff.png'),
  schlange: loadImg('img/hafen/schlange.png'), voegel: loadImg('img/hafen/voegel.png') };
HAFEN_IMG.bg.addEventListener('load', () => { delete bgCache.hafen; });
function hafenBereit() { return typeof HAFEN_EBENEN !== 'undefined' && Object.values(HAFEN_IMG).every(imgOk); }
function hash01(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function hafenWellen(c, t) {
  // Wellenkämme in Reihen: hinten klein und dicht, vorn groß – alle treiben mit dem Wind nach links
  c.save(); c.lineCap = 'round';
  for (let r = 0; r < 13; r++) {
    const k = r / 12, y = 212 + Math.pow(k, 1.5) * 92, s = (y - 190) / 242, n = Math.round(26 - k * 14), sp = (W + 60) / n;
    c.strokeStyle = `rgba(235,250,255,${(0.32 + k * 0.28).toFixed(2)})`; c.lineWidth = 0.8 + s * 2.2;
    for (let i = 0; i < n; i++) {
      const x = ((i * sp + hash01(r * 31 + i) * sp - t * (0.004 + s * 0.012)) % (W + 60) + W + 60) % (W + 60) - 30;
      if (y < 222 && x > 250 && x < 530) continue;   // nicht über die Insel
      const ph = t * 0.0021 + hash01(i * 7 + r) * 6.28, hgt = (2.2 + Math.sin(ph) * 1.6) * (0.6 + s * 2.4), wd = (7 + hash01(i + r * 3) * 6) * (0.5 + s * 1.6);
      const yy = y + Math.sin(ph * 0.7) * s * 2.5;
      c.beginPath(); c.moveTo(x - wd, yy); c.quadraticCurveTo(x, yy - hgt, x + wd, yy); c.stroke();
    }
  }
  // Glitzern der Sonne auf dem Wasser
  for (let i = 0; i < 22; i++) {
    const a = Math.pow(Math.max(0, Math.sin(t * 0.0035 + i * 1.91)), 10);
    if (a < 0.05) continue;
    const x = 120 + hash01(i * 5.3) * 760, y = 214 + hash01(i * 9.1) * 80, z = 2 + a * 4 * (y - 190) / 120;
    c.strokeStyle = `rgba(255,255,240,${a.toFixed(2)})`; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(x - z, y); c.lineTo(x + z, y); c.moveTo(x, y - z * 0.6); c.lineTo(x, y + z * 0.6); c.stroke();
  }
  c.restore();
}
// Aras und Tukan (3D, drei Flügelstellungen): ziehen in großen Bögen über den Himmel, mal hin, mal zurück,
// zwischendurch segeln sie ein Stück mit ausgebreiteten Flügeln
const HAFEN_VOEGEL = [   // Art (Atlas-Zeile), Periode ms, Versatz, Richtung, Höhe, Maßstab
  [0, 17000, 0, 1, 70, 0.52], [1, 23000, 9000, -1, 44, 0.42], [2, 29000, 15000, 1, 96, 0.5], [0, 37000, 26000, -1, 30, 0.34],
];
function hafenVoegel(c, t) {
  const [gw, gh, tw, th] = HAFEN_EBENEN.vogel;
  for (const [row, per, off, dir, y0, s] of HAFEN_VOEGEL) {
    const u = ((t + off) % per) / per, x = dir > 0 ? -120 + u * 1300 : 1080 - u * 1300;
    if (x < -100 || x > 1060) continue;
    const glide = Math.sin(t * 0.0009 + off) > 0.55, fl = glide ? 1 : [0, 1, 2, 1][Math.floor((t + off) / 95) % 4];
    const y = y0 + Math.sin(u * 9 + off) * 16 + (glide ? 0 : Math.sin(t * 0.021) * 1.5);
    c.save(); c.translate(x, y); c.scale(dir * s, s); c.rotate(Math.cos(u * 9 + off) * 0.08);
    c.drawImage(HAFEN_IMG.voegel, fl * tw, row * th, tw, th, -gw / 2, -gh / 2, gw, gh);
    c.restore();
  }
}
function hafenAnimiert(c, t) {
  const E_ = HAFEN_EBENEN;
  const [wx, wy, ww, wh] = E_.wolken, off = (t * 0.005) % W;
  for (const dx of [-off, W - off]) c.drawImage(HAFEN_IMG.wolken, wx + dx, wy, ww, wh);
  hafenWellen(c, t);
  // Schiff: schaukelt um die Wasserlinie, Segel und Flagge in vier Windphasen
  const [sx, sy, sw, sh, tw, th, px, py] = E_.schiff, k = Math.floor(t / 230) % 4;
  const ang = Math.sin(t * 0.00085) * 0.013, bob = Math.sin(t * 0.0013) * 1.8;
  c.save(); c.translate(px, py + bob); c.rotate(ang); c.translate(-px, -py);
  c.drawImage(HAFEN_IMG.schiff, (k % 2) * tw, Math.floor(k / 2) * th, tw, th, sx, sy, sw, sh);
  c.restore();
  // Gischt an der Wasserlinie (Kiellinie aus dem Rendering, schaukelt mit)
  c.save(); c.translate(px, py + bob); c.rotate(ang); c.translate(-px, -py);
  c.strokeStyle = 'rgba(245,252,255,0.75)'; c.lineWidth = 1.7; c.lineCap = 'round';
  const kl = E_.kiel;
  for (let i = 0; i < kl.length - 1; i++) {
    const [x0, y0] = kl[i], [x1, y1] = kl[i + 1], w = 0.5 + 0.5 * Math.sin(t * 0.004 + i * 1.7);
    c.beginPath(); c.moveTo(x0, y0 - 0.5); c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - 2 - w * 2.5, x1, y1 - 0.5); c.stroke();
  }
  c.restore();
  const [vx, vy, vw, vh] = E_.vorn;
  c.drawImage(HAFEN_IMG.vorn, vx, vy, vw, vh);
  // Anakonda: acht Pendelphasen (wippt im Takt der Samba, gut zwei Sekunden je Schwung)
  const [nx, ny, nw, nh, ntw, nth, nn] = E_.schlange, nk = Math.floor(t / 285) % nn;
  c.drawImage(HAFEN_IMG.schlange, (nk % 4) * ntw, Math.floor(nk / 4) * nth, ntw, nth, nx, ny, nw, nh);
  hafenVoegel(c, t);
}

// ---------- neue Räume ----------
// Kamera der 3D-Räume (art/blender/raum_build.py): Horizont bei y = 185, Maßstab 1 an der Vorderkante (y = 432)
// und (350 − 185) / (432 − 185) ≈ 0,67 an der Hinterkante – die Figuren schrumpfen so, wie der Boden im Bild flieht.
const RAUM3D = {};
function raum3d(id, src, o) {
  const img = loadImg(src);
  img.addEventListener('load', () => { delete bgCache[id]; if (ROOMS[id]) delete ROOMS[id]._pix; mapThumbs && delete mapThumbs[id]; });
  RAUM3D[id] = img;
  ROOMS[id] = Object.assign({
    id, sMin: 0.67, sMax: 1, yTop: 350, yBot: 432, walk: [[20, 352], [940, 350], [955, 432], [5, 432]],
    draw(g) {
      if (!g.isPix && o.layers && o.layers(g)) return;   // HD mit Ebenen: nur der ruhende Hintergrund, der Rest kommt animiert in dyn
      if (!imgOk(img)) { g.fillStyle = o.fill || '#241739'; g.fillRect(0, 0, W, SH); return; }
      if (g.isPix) g.drawSprite(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, W, SH);
      else g.drawImage(img, 0, 0, W, SH);
    },
    thumb(g) { if (o.layers && imgOk(img)) g.drawImage(img, 0, 0, W, SH); },   // Kartenbild: das ruhende Gesamtbild
  }, o);
}
raum3d('hafen', 'img/raum_hafen.jpg', {
  era: 'past', name: 'Hafen 1776', floor: 'wood', amb: ['wind', 'birds'], fill: '#5aa0d0',
  layers(g) { if (!hafenBereit()) return false; g.drawImage(HAFEN_IMG.bg, 0, 0, W, SH); return true; },
  dyn(c, t) { if (c.isPix || !hafenBereit()) return; if (typeof echt3dOn === 'function' && echt3dOn(ROOMS.hafen)) hafenVoegel(c, t); else hafenAnimiert(c, t); },
  objs: [
    { id: 'hafen_garten', name: 'Zurück zum Garten', rect: [0, 150, 58, 236], walk: [30, 400], exit: ['garten1776', 918, 380, -1] },
    { id: 'schiff', name: 'Piratenschiff', rect: [560, 40, 400, 250], walk: [700, 368], look: 'Ein Piratenschiff mit einem Toast auf der Flagge. Die Crew jubelt die ganze Zeit. Worüber, weiß keiner. Hauptsache laut.' },
    { id: 'anakonda', name: 'Anakonda', rect: [66, 26, 192, 136], walk: [150, 362], look: 'Eine Anakonda, dick wie ein Feuerwehrschlauch. Sie wippt im Takt der Trommeln. Ich glaube, gleich ruft hier jemand „Kampf!“.' },
    { id: 'obstkiste', name: 'Obstkiste', rect: [396, 246, 40, 30], walk: [412, 364], look: 'Bananen, eine Ananas und Mangos. Die Bananen sind krumm vor Lachen.' },
    { id: 'lagerhaus', name: 'Lagerhaus-Tor', rect: [50, 189, 102, 132], walk: [110, 362], look: 'Ein Lagerhaus. Auf dem Schild steht „Rum, Seile und anderes Zeug“. Das Tor ist zu. Das Zeug bleibt drin.' },
    { id: 'faesser', name: 'Fässer', rect: [258, 262, 170, 74], walk: [330, 362], look: 'Fässer. Auf einem steht „RUM“, auf dem anderen „AUCH RUM“, auf dem dritten „KEIN RUM (LÜGE)“.' },
    { id: 'seilrolle', name: 'Tau', rect: [488, 308, 72, 30], walk: [520, 362], look: 'Eine Rolle Tau. Ein Seemann würde jetzt einen Knoten machen. Ich mach höchstens einen Knoten rein.' },
    { id: 'insel', name: 'Insel', rect: [140, 145, 260, 70], look: 'Eine Insel mit acht Palmen, einer Strohhütte und einem Ruderboot. Sieht aus wie ein Ort, an dem man Affen trifft. Mit mehr als einem Kopf.' },
  ],
});
raum3d('landeplatz', 'img/raum_landeplatz.jpg', {
  era: 'future', name: 'Landeplatz', floor: 'tile', amb: ['future', 'hum'], fill: '#2a1a48',
  objs: [
    { id: 'landeplatz_raus', name: 'Zurück zum Zukunftsgarten', rect: [902, 140, 58, 246], walk: [930, 400], exit: ['fgarten', 40, 380, 1] },
    { id: 'raumschiff', name: 'Lieferraumschiff', rect: [412, 19, 470, 270], walk: [640, 368], look: 'Ein grünes Lieferraumschiff. Auf dem Band steht: „Wir liefern überallhin. Auch nach überallhin.“' },
    { id: 'fracht', name: 'Frachtkisten', rect: [150, 268, 82, 66], walk: [190, 362], look: 'Kisten mit dem Aufdruck „Vorsicht: Inhalt explodiert nur manchmal“.' },
    { id: 'zapfsaeule', name: 'Zapfsäule', rect: [97, 194, 68, 125], walk: [130, 362], look: 'Eine Zapfsäule für Dunkle Materie. Der Preis steht auf „Ja“.' },
    { id: 'skyline', name: 'Skyline', rect: [0, 30, 400, 130], look: 'Die Stadt der Zukunft. Alles leuchtet, nichts ist geöffnet.' },
  ],
  dyn(c, t) {   // blinkende Positionslichter am Landeplatzrand
    for (let i = 0; i < 12; i++) if ((Math.floor(t / 320) + i) % 4 === 0) glow(48 + i * 79, 297, 16, i % 2 ? '#7fe8ff' : '#ff7ad9', 0.55);
  },
});
raum3d('testkammer', 'img/raum_testkammer.jpg', {
  era: 'future', name: 'Testkammer', floor: 'tile', amb: ['hum', 'air'], fill: '#d8dce4',
  objs: [
    { id: 'kammer_raus', name: 'Zurück zum Palast', rect: [0, 140, 64, 246], walk: [32, 400], exit: ['vorraum', 900, 384, -1] },
    { id: 'portal_blau', name: 'Blaues Oval', rect: [172, 172, 62, 114], walk: [210, 362], look: 'Ein blaues Oval an der Wand. Wenn ich durchgehe, komme ich vermutlich aus dem orangen wieder raus. Vermutlich.' },
    { id: 'portal_orange', name: 'Oranges Oval', rect: [508, 172, 62, 114], walk: [540, 362], look: 'Ein oranges Oval. Es sieht aus wie ein Ausgang. Oder wie ein Eingang mit Selbstbewusstsein.' },
    { id: 'wuerfel', name: 'Würfel mit Herz', rect: [258, 272, 70, 64], walk: [300, 362], look: 'Ein Würfel mit einem Herz drauf. Ich glaube, er mag mich. Ich glaube, ich mag ihn auch. Das ist komisch.' },
    { id: 'beobachtung', name: 'Beobachtungsfenster', rect: [648, 32, 186, 86], look: 'Hinter dem Fenster ist niemand. Glaube ich. Das Licht flackert sehr verdächtig.' },
    { id: 'kuchenschild', name: 'Schild', rect: [112, 98, 122, 50], look: '„KUCHEN-AUSGABE: BALD“. Darunter, ganz klein: „Definition von bald kann variieren.“' },
  ],
  dyn(c, t) {
    if (!c.isPix) for (const [x, col] of [[203, '#3aa0ff'], [539, '#ff8a20']]) glow(x, 229, 70 + Math.sin(t * 0.004 + x) * 6, col, 0.35);
    txt(c, 'KUCHEN-AUSGABE: BALD', 173, 127, '800 13px "Baloo 2", sans-serif', '#3a3c46', 'center');
  },
});
// Ausgänge in den alten Räumen dazu (mit kleinem Wegweiser)
function wegweiser(c, x, y, text, col, dir) {
  R(c, x - 3, y, 6, 70, '#6a4426', 2, 2);
  c.save(); c.translate(x, y + 8);
  P(c, dir > 0 ? [-34, -12, 30, -12, 42, 0, 30, 12, -34, 12] : [34, -12, -30, -12, -42, 0, -30, 12, 34, 12], col, 2);
  txt(c, text, 0, 5, '800 12px "Baloo 2", sans-serif', '#2a1a10', 'center');
  c.restore();
}
ROOMS.garten1776.objs.push({ id: 'zum_hafen', name: 'Weg zum Hafen', rect: [904, 170, 56, 180], walk: [934, 374], exit: ['hafen', 70, 408, 1],
  draw: c => wegweiser(c, 930, 278, 'Hafen', '#e8c890', 1) });
ROOMS.fgarten.objs.push({ id: 'zum_landeplatz', name: 'Weg zum Landeplatz', rect: [0, 150, 72, 200], walk: [38, 374], exit: ['landeplatz', 880, 408, -1],
  draw: c => { wegweiser(c, 34, 270, 'Lande-', '#7fe8ff', -1); txt(c, 'platz', 34, 300, '800 12px "Baloo 2", sans-serif', '#7fe8ff', 'center', 3, '#140828'); } });
ROOMS.vorraum.objs.push({ id: 'zur_testkammer', name: 'Aufzug zur Testkammer', rect: [870, 150, 90, 200], walk: [905, 374], exit: ['testkammer', 80, 408, 1],
  draw: c => {
    R(c, 878, 196, 74, 146, '#d8dce4', 3, 6); R(c, 886, 206, 58, 136, '#9aa0b0', 2, 2); L(c, [915, 206, 915, 342], 2, '#5a5e6a');
    E(c, 915, 184, 16, 9, '#24262e', 2); txt(c, '19', 915, 189, '800 11px "Baloo 2", sans-serif', '#ffd84a', 'center');
  } });
Object.assign(ROOM_FX, {
  hafen: { verb: [0.4, 0.08], light: [1, '#fff0c8', '#2a4a70'], bloom: 0.24, amb: ['wind', 'birds'], music: 'samba' },
  landeplatz: { verb: [0.9, 0.12], light: [-1, '#ffb8f0', '#1c0c48'], bloom: 0.36, amb: ['future', 'traffic'], motes: 'firefly' },
  testkammer: { verb: [1.8, 0.2], light: [1, '#f4f8ff', '#3a4058'], bloom: 0.2, amb: ['hum', 'beeps'], music: 'lab', reflect: 0.12 },
});
MAP_ORDER.past.push('hafen');
JUKEBOX.splice(JUKEBOX.findIndex(j => j[0] === 'tavern') + 1, 0, ['samba', 'Hafen-Samba']);
JB_COL.samba = '#3ad06a';
MAP_ORDER.future.push('testkammer', 'landeplatz');

// <hafen-daten> (erzeugt von art/blender/hafen_post.py): [x, y, Breite, Höhe] in Spiel-Einheiten; Schiff/Schlange dazu Atlas-Kachel (px), Schiff Drehpunkt und Kiellinie
const HAFEN_EBENEN = {"wolken": [121.5, 0.0, 813.0, 124.0], "vorn": [0.0, 34.5, 960.0, 405.5], "schiff": [528.0, 22.0, 433.0, 283.0, 866, 566, 687.3, 257.1], "kiel": [[540.0, 261.0], [552.0, 273.0], [564.0, 275.0], [576.0, 276.5], [588.0, 278.0], [600.0, 279.5], [612.0, 281.0], [624.0, 282.5], [636.0, 284.0], [648.0, 285.5], [660.0, 287.0], [672.0, 288.5], [684.0, 290.0], [696.0, 291.5], [708.0, 293.0], [720.0, 294.0], [732.0, 295.5], [744.0, 297.0], [756.0, 298.5], [768.0, 300.0], [780.0, 301.0], [792.0, 302.5]], "schlange": [0.0, 10.0, 317.0, 148.5, 634, 297, 8], "vogel": [105.0, 92.5, 210, 185], "schaufel": [86, 232]};
// </hafen-daten>

// ---------- die Gäste ----------
const GUESTS = ['dave', 'sam', 'max', 'salad', 'guybrush', 'jack', 'affe', 'bender', 'prof', 'zoid', 'glados', 'simon'];
const GUEST_DEF = {
  dave: { name: 'Dave', from: 'Maniac Mansion', color: '#ff8a8a', h: 200, bw: 50, room: 'lobby', x: 800, y: 418, dir: -1, voice: [1.05, 1.0, 230, 'square', 'm', 1.0, 1.05],
    look: 'Ein Typ im roten Pulli, der sich umsieht, als wüsste er genau, wo hier der Keller ist.', role: 'Held aus Maniac Mansion · 80er', bio: 'Ist schon einmal in diese Villa eingebrochen, um seine Freundin zu retten. Kennt jede Geheimtür und hat Respekt vor Mikrowellen.' },
  sam: { name: 'Sam', from: 'Sam & Max', color: '#c9a37a', h: 196, bw: 64, room: 'labor', x: 872, y: 418, dir: -1, voice: [0.7, 0.95, 140, 'sawtooth', 'm', 0.82, 0.95],
    look: 'Ein Hund im Anzug mit Hut. Er sieht aus wie ein Polizist. Ein sehr freiberuflicher.', role: 'Freiberuflicher Polizist · Sam & Max', bio: 'Ermittelt in Fällen, die sonst keiner will. Spricht in ganzen Sätzen, auch wenn er sich aufregt.' },
  max: { name: 'Max', from: 'Sam & Max', color: '#f2f2f8', h: 142, bw: 46, room: 'labor', x: 920, y: 426, dir: -1, voice: [1.6, 1.25, 420, 'square', 'm', 1.3, 1.25],
    look: 'Ein weißes Kaninchending mit einem Grinsen, das zu breit für sein Gesicht ist.', role: 'Hyperkinetisches Kaninchending · Sam & Max', bio: 'Sams Partner. Liebt Gewalt gegen Dinge, die es verdient haben, und Dinge, die nicht schnell genug weglaufen.' },
  salad: { name: 'Salad Fingers', sig: 'S. Fingers', from: 'Salad Fingers', color: '#b5d86a', h: 216, bw: 40, room: 'garten1776', x: 140, y: 420, dir: 1, voice: [1.2, 0.8, 300, 'triangle', 'm', 1.05, 0.8],
    look: 'Ein sehr dünner, sehr grüner Herr mit sehr langen Fingern. Er streichelt den Zaun.', role: 'Freund rostiger Dinge', bio: 'Spricht leise, fühlt gern Oberflächen und nennt seine Freunde nach dem Material, aus dem sie sind.' },
  guybrush: { name: 'Guybrush Threepwood', card: 'Guybrush T.', from: 'Monkey Island', color: '#ffd86a', h: 200, bw: 50, room: 'hafen', x: 330, y: 418, dir: 1, voice: [1.15, 1.08, 260, 'square', 'm', 1.08, 1.1],
    look: 'Ein blonder junger Mann mit Zopf und Säbel. Er übt Posen vor seinem Spiegelbild im Wasser.', role: 'Möchtegern-Pirat · Monkey Island', bio: 'Will ein mächtiger Pirat werden. Kann zehn Minuten die Luft anhalten und hat schlagfertige Antworten für jede Beleidigung.' },
  jack: { name: 'Käpt’n Jack Sparrow', card: 'Käpt’n Jack', sig: 'Capt. J. S.', from: 'Fluch der Karibik', color: '#d8a070', h: 206, bw: 54, room: 'hafen', x: 760, y: 414, dir: -1, voice: [0.85, 0.9, 170, 'sawtooth', 'm', 0.9, 0.92],
    look: 'Ein Pirat mit Dreispitz, Rastas und einem Kompass. Er schwankt leicht. Das Schiff schwankt nicht.', role: 'Käpt’n ohne Schiff · Fluch der Karibik', bio: 'Hat einen Kompass, der dorthin zeigt, was man am meisten will. Will meistens sein Schiff zurück. Und Rum.' },
  bender: { name: 'Bender', from: 'Futurama', color: '#b8c4d8', h: 186, bw: 54, room: 'landeplatz', x: 600, y: 420, dir: -1, voice: [0.8, 1.0, 150, 'sawtooth', 'm', 0.85, 1.0],
    look: 'Ein Roboter mit Antenne und Klappe im Bauch. Er sieht aus, als würde er gleich etwas klauen. Oder schon geklaut haben.', role: 'Biegeroboter · Futurama', bio: 'Biegt Träger, Löffel und Regeln. In seiner Brustklappe ist mehr Platz, als physikalisch erlaubt ist.' },
  prof: { name: 'Professor', from: 'Futurama', color: '#e8f0e0', h: 182, bw: 50, room: 'landeplatz', x: 290, y: 410, dir: 1, voice: [1.0, 0.85, 200, 'triangle', 'm', 0.95, 0.85],
    look: 'Ein uralter Erfinder im Laborkittel. Er hat dieselbe Brille wie Dr. Fred, nur dicker. Und einen krummeren Rücken.', role: 'Erfinder der Zukunft · Futurama', bio: 'Leitet eine Lieferfirma mit Raumschiff. Hat gute Neuigkeiten für alle – meistens schlechte.' },
  zoid: { name: 'Dr. Zoidberg', sig: 'Zoidberg', from: 'Futurama', color: '#ff8a7a', h: 204, bw: 56, room: 'landeplatz', x: 430, y: 428, dir: 1, voice: [1.1, 1.05, 240, 'square', 'm', 1.0, 1.05],
    look: 'Ein krabbenartiger Doktor mit Mundtentakeln im Laborkittel. Er winkt mit den Scheren. Sehr freundlich. Sehr nass.', role: 'Arzt (für Menschen, angeblich) · Futurama', bio: 'Hält sich für einen Experten für Menschen. Hat noch nie einen Patienten geheilt, aber schon viele erschreckt.' },
  glados: { name: 'GLaDOS', from: 'Portal', sig: '— GLaDOS —', color: '#ffe066', h: 300, bw: 70, room: 'testkammer', x: 392, y: 236, dir: -1, voice: [1.0, 0.9, 330, 'sine', 'f', 0.95, 0.88],
    scaleMul: 1.25, shadowW: 0.01, look: 'Eine riesige weiße Maschine hängt kopfüber von der Decke und mustert mich mit einem gelben Auge. Sie lächelt. Glaube ich.', role: 'Sicherheits-KI Seiner Lilaheit · Portal', bio: 'Testet alles und jeden. Verspricht Kuchen. Hält Sarkasmus für eine Form von Fürsorge.' },
  affe: { name: 'Dreiköpfiger Affe', card: 'Dreik. Affe', sig: 'Affe³', from: 'Piraten-Legenden', color: '#d8a060', h: 170, bw: 64, room: 'hafen', x: 470, y: 424, dir: 1, voice: [1.35, 1.15, 380, 'square', 'm', 1.2, 1.15],
    look: 'Ein Affe mit drei Köpfen: einer mit Kopftuch, einer mit Dreispitz, einer mit Ohrring. Sie reden gleichzeitig. Meistens übereinander.', role: 'Legende der Karibik · Piraten-Running-Gag', bio: 'Taucht immer auf, wenn jemand „Hinter dir!“ ruft. Drei Köpfe, ein Magen, null Einigkeit. Ficht mit einer Bananen-Poolnudel.' },
  simon: { name: 'Simon', from: 'Simon the Sorcerer', color: '#c08aff', h: 240, bw: 56, room: 'thron', x: 232, y: 420, dir: 1, voice: [1.1, 1.05, 250, 'square', 'm', 1.04, 1.06],
    look: 'Ein Junge in lila Robe mit riesigem Zauberhut. Er rollt mit den Augen. Bei allem.', role: 'Zauberlehrling · Simon the Sorcerer', bio: 'Kam durch ein Portal in eine Märchenwelt und findet alle Märchen albern. Der Hut macht angeblich 80 Prozent der Magie.' },
};
for (const id of GUESTS) {
  const d = GUEST_DEF[id], [pitch, rate, blip, wave, g, tp, tr] = d.voice;
  ACT[id] = mkA(id, d.name, id, d.color, d.h, d.bw, { look: d.look, guest: true, scaleMul: d.scaleMul, shadowW: d.shadowW, talkDist: d.talkDist,
    voice: { pitch, rate, blip, wave, formant: pitch * 0.82 + 0.18, tts: { g, pitch: tp, rate: tr, n: GUESTS.indexOf(id) % 3 } } });
  START_POS[id] = { room: d.room, x: d.x, y: d.y, dir: d.dir };
  BIOS[id] = { role: d.role, bio: d.bio };
}
START_POS.affe.visible = false;   // schwingt sich erst nach Jacks Niederlage auf den Steg
ACH.push({ id: 'fechten', name: 'Beleidigungsfechter', desc: 'Den Möchtegern-Piraten mit Worten besiegt.' },
  { id: 'gaeste', name: 'Dimensions-Flicker', desc: 'Alle Crossover-Gäste haben sich ins Gästebuch eingetragen.' });

// ---------- Darstellung: 3D-Bild (HD) bzw. Pixel-Art aus demselben Bild (Klassik-Modus) ----------
// Haltung je Gast im Stand (gesture/idleAct wie bei den anderen Figuren)
const GAST_IDLE = {
  dave: (a, t) => gesture(a, t) > 0.45 && 'gest',
  sam: (a, t) => gesture(a, t) > 0.45 && 'gest',
  max: (a, t) => { const k = idleAct(a, t, 5200, 900); return k >= 0 && (Math.floor(k * 6) % 2 ? 'jump' : 'gest'); },   // hibbelt herum
  salad: (a, t) => { const k = idleAct(a, t, 9000, 3200); return k >= 0 && 'touch'; },   // streichelt die Luft
  guybrush: (a, t) => gesture(a, t) > 0.45 && 'engarde',
  affe: (a, t) => gesture(a, t) > 0.45 && 'gest',
  jack: (a, t) => { const k = idleAct(a, t, 8000, 2600); return k >= 0 && 'compass'; },   // schaut auf den Kompass
  bender: (a, t) => { const k = idleAct(a, t, 10000, 3000); return k >= 0 && 'lean'; },
  prof: (a, t) => gesture(a, t) > 0.45 && 'news',   // Zeigefinger hoch: gute Neuigkeiten!
  zoid: (a, t) => gesture(a, t) > 0.45 && 'gest',
  glados: (a, t) => { const p = ((t + (a.seed || 0) * 3000) % 7000) / 7000; return a.talking ? (Math.sin(t * 0.004) > 0 ? 'tilt0' : 'tilt1') : p < 0.3 ? 'idle' : p < 0.55 ? 'tilt0' : p < 0.75 ? 'idle' : 'tilt1'; },
  simon: (a, t) => gesture(a, t) > 0.45 && 'gest',
};
for (const id of GUESTS) {
  ACT[id].frameOverride = (a, t) => a.duel && FIG3D[id] && FIG3D[id].f.nudel0 ? duelFrame(a) : (id === 'glados' || !a.talking && !a.walking) && GAST_IDLE[id](a, t);
  CHAR[id] = (c, a, t) => {
    if (fig3d(c, a, t)) { gastExtras(c, a, t, id); return; }
    const d = FIG3D[id];
    if (!d || !imgOk(d.img) || !c.drawSprite) return;
    const f = d.f[a.talking && d.f.talk0 && Math.floor(t / 300) % 2 ? 'talk0' : 'idle'] || d.f.idle, u = d.upp;
    c.drawSprite(d.img, f[0], f[1], f[2], f[3], f[4], f[5], f[2] * u, f[3] * u);
  };
}
function gastExtras(c, a, t, id) {
  const f = a._fig; if (!f) return;
  if (id === 'glados') {   // das Auge leuchtet, beim Sprechen pulsierend
    const k = a.talking ? 0.6 + Math.abs(Math.sin(t * 0.012)) * 0.6 : 0.35 + Math.sin(t * 0.002) * 0.08;
    glowAt(c, f[6], f[7], 26 * k + 10, '#ffd84a', k);
    E(c, f[6], f[7], 3.2 + k * 1.6, 3.2 + k * 1.6, '#fff8c0', 0);
  }
  if (id === 'prof' && a._fig === FIG3D.prof.f.news) floaters(c, a, t, 30, -200, 1, (x, y, s) => txt(c, '!', x, y, `800 ${Math.round(20 * s)}px "Baloo 2", sans-serif`, '#ffe066', 'center', 4, OUT));
  if (id === 'salad' && a._fig === FIG3D.salad.f.touch) floaters(c, a, t, 34, -150, 2, (x, y, s) => E(c, x, y, 3 * s, 3 * s, 'rgba(200,120,60,0.8)', 0));   // Rostkrümel
}
// Leuchten auch im Figurenpuffer (dort ist cx ein anderer Kontext)
function glowAt(c, x, y, r, col, a) {
  if (c.isPix || HDS.ink) return;
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, a);
  c.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2); c.restore();
}

// ---------- Gästebuch ----------
function gbCount() { return G.state ? GUESTS.filter(id => fl()['gb_' + id]).length : 0; }
async function gbSign(...ids) {
  const fresh = ids.filter(id => !fl()['gb_' + id]);
  if (!fresh.length) return;
  for (const id of fresh) fl()['gb_' + id] = 1;
  Sound.sfx('page');
  note(`Gästebuch: ${fresh.map(id => ACT[id].name).join(' & ')} ${fresh.length > 1 ? 'haben' : 'hat'} unterschrieben (${gbCount()}/${GUESTS.length})`);
  if (!fl().gbHint) { fl().gbHint = 1; await wait(900); await say(curId(), 'Das Gästebuch findet man im Menü unter Extras. Dr. Fred sammelt da die Unterschriften.'); }
  if (gbCount() === GUESTS.length && !fl().rissZu) {
    fl().rissZu = 1;
    await wait(700);
    await fadeTo(1, 400, 'black'); G.caption = 'Unterdessen im Labor ...'; Sound.sfx('ding'); await wait(1600); G.caption = null;
    const keep = G.viewRoom; G.viewRoom = 'labor'; await fadeTo(0, 400, 'black');
    await say('drfred', 'Das Gästebuch ist voll! Zwölf Unterschriften aus elf Welten – plus ein Affe mit drei Köpfen. Damit kann ich den Riss endlich berechnen!');
    await say('drfred', 'Ich flicke ihn nicht zu. Ich baue ihn zu einem Tor um! Dann können unsere Gäste kommen und gehen, wie sie wollen.');
    await say('drfred', 'Und wer weiß – vielleicht kommt eines Tages Besuch aus noch mehr Welten. Wissenschaft!');
    await fadeTo(1, 400, 'black'); G.viewRoom = keep; await fadeTo(0, 400, 'black');
    unlock('gaeste');
  }
}
function gbKnown() { return GUESTS.some(id => G.state && (G.state.talked[id] || G.state.looked['a:' + id])); }
function drawGuestbook(bx, y) {
  txt(cx, 'Durch den Riss im Chrono-Klo sind Gäste aus anderen Welten gefallen. Hilf ihnen – dann tragen sie sich ein.', W / 2, y + 12, '600 13px "Baloo 2", sans-serif', '#a99ad0');
  GUESTS.forEach((id, i) => {
    const x = bx + 20 + (i % 4) * 196, yy = y + 26 + Math.floor(i / 4) * 128, w = 188, h = 120, known = bioKnown(id), signed = known && G.state && fl()['gb_' + id], d = GUEST_DEF[id];
    R(cx, x, yy, w, h, signed ? '#2c2046' : known ? '#241838' : '#1a1129', 2, 12, signed ? mix(d.color, '#241739', 0.35) : '#33224d');
    if (known && !cx.isPix) glow(x + 40, yy + h - 30, 56, d.color, 0.12);
    E(cx, x + 40, yy + h - 9, 24, 5, 'rgba(0,0,0,0.3)', 0);
    bioFigure(id, known, x + 40, yy + h - 6, id === 'max' ? 78 : 102);
    let nz = 15; const nm = known ? d.card || d.name : '???'; cx.font = `400 ${nz}px "Titan One", sans-serif`;
    while (nz > 9 && cx.measureText(nm).width > w - 84) { nz--; cx.font = `400 ${nz}px "Titan One", sans-serif`; }
    txt(cx, nm, x + 78, yy + 24, `400 ${nz}px "Titan One", sans-serif`, known ? '#ffd23a' : '#6a5a88', 'left', 4, OUT);
    txt(cx, known ? d.from : 'unbekannte Welt', x + 78, yy + 41, '800 11px "Baloo 2", sans-serif', known ? mix(d.color, '#ffffff', 0.3) : '#5a4a78', 'left');
    if (signed) {   // Unterschrift: geschwungen, in Tinte
      cx.save(); cx.translate(x + 130, yy + 76); cx.rotate(-0.12);
      txt(cx, d.sig || d.name.split(' ')[0], 0, 0, 'italic 700 19px "Baloo 2", cursive', '#7fe8ff', 'center', 3, '#140828');
      L(cx, [-46, 8, -10, 12, 28, 6, 50, 10], 1.6, '#7fe8ff');
      cx.restore();
      txt(cx, '✓ unterschrieben', x + 130, yy + 108, '800 11px "Baloo 2", sans-serif', '#7dff7a', 'center');
    } else txt(cx, known ? 'noch keine Unterschrift' : 'noch nicht getroffen', x + 128, yy + 84, '600 10px "Baloo 2", sans-serif', known ? '#a99ad0' : '#5a4a78', 'center');
  });
  txt(cx, `${gbCount()} von ${GUESTS.length} Unterschriften${G.state && fl().rissZu ? ' – der Riss ist jetzt ein Tor!' : ''}`, W / 2, y + 26 + 3 * 128 + 12, '800 14px "Baloo 2", sans-serif', '#ffd23a');
}

// ---------- kleine Gespräche und Nebenbei-Sprüche ----------
Object.assign(BARKS, {
  dave: ['Keine Mikrowelle. Keine Mikrowelle. Keine Mikrowelle.', 'Früher war hier mehr Meteor.', 'Ich kenne diese Treppe. Sie mag mich nicht.'],
  sam: ['Ein Fall wie dieser verlangt nach Hut und Geduld. Ich habe nur den Hut.', 'Max, fass das nicht an. Oder doch, aber vorsichtig.'],
  max: ['Darf ich irgendwas verhaften? Irgendwas!', 'Ich wette, der Toaster ist schuldig.', 'Sam, ich langweile mich auf eine gewalttätige Art.'],
  salad: ['Rost … so weich … so freundlich …', 'Der Zaun hat mir ein Geheimnis erzählt. Es war Holz.', 'Hallo, Herr Brunnen. Sie sind heute sehr nass.'],
  guybrush: ['Ich bin ein mächtiger Pi… Pira… Übung macht den Meister.', 'Kann man hier irgendwo einen Grog bekommen? Für Studienzwecke.'],
  jack: ['Wo ist der Rum? … Warum ist hier nie Rum?', 'Das Schiff da gehört mir. Gefühlt.', 'Ich habe einen Plan. Er ist noch geheim. Vor mir auch.'],
  bender: ['Ich bin 40 % Titan, 60 % Charme.', 'Wenn ich das Raumschiff verkaufe … ach nee, das ist ja meins.', 'Beißt mich nicht, ich bin aus Metall.'],
  prof: ['Gute Nachrichten, alle zusammen! … Ach, es ist nur einer da.', 'Wo war ich? Ach ja. Hier.', 'Meine neueste Erfindung: ein Knopf, der Knöpfe drückt.'],
  zoid: ['Hurra! Ein Patient! … Ach nein, nur ein Schatten.', 'Wer möchte untersucht werden? Ich bin ganz sanft. Meistens.'],
  glados: ['Bitte begeben Sie sich zur nächsten Testkammer. Oder bleiben Sie stehen. Beides wird bewertet.', 'Der Kuchen ist in Arbeit. Sehr langsam.', 'Sie atmen sehr laut. Ich notiere das.'],
  simon: ['Ein sprechender lila Gurkenwurm. Natürlich. Warum auch nicht.', 'Der Hut juckt. Magie juckt immer.'],
});
NPC_CHATS.hafen = [
  [['guybrush', 'Käpt’n! Darf ich auf Euer Schiff?'], ['jack', 'Kommt drauf an. Kannst du rudern, singen und schweigen?'], ['guybrush', 'Eins von dreien!'], ['jack', 'Das reicht nicht mal für die Marine.']],
  [['jack', 'Junge, warum hast du einen Säbel und kein Schiff?'], ['guybrush', 'Warum habt Ihr ein Schiff und keinen Rum?'], ['jack', '… Touché.']],
];
NPC_CHATS.landeplatz = [
  [['prof', 'Gute Nachrichten! Ich habe eine Zeitmaschine gefunden. Sie ist ein Klo.'], ['bender', 'Das ist die beste Zeitmaschine, die ich je gesehen habe.']],
  [['zoid', 'Professor, darf ich den Roboter untersuchen?'], ['bender', 'Fass mich an, und ich verbiege deine Scheren.'], ['zoid', 'Er mag mich!']],
];
NPC_CHATS.testkammer = [];
(NPC_CHATS.labor = NPC_CHATS.labor || []).push(
  [['max', 'Sam, darf ich den großen Hebel ziehen?'], ['sam', 'Nur wenn er uns nicht in die Steinzeit schickt.'], ['max', 'Das ist ein Ja!']],
  [['drfred', 'Wer hat diese Leute reingelassen?'], ['sam', 'Freiberufliche Polizei. Wir haben uns selbst reingelassen.']],
);
(NPC_CHATS.lobby = NPC_CHATS.lobby || []).push(
  [['green', 'Dave? Bist du das?'], ['dave', 'Hey, Tentakel! Was macht die Musik?'], ['green', 'Seit du meine Demo-Kassette zum Plattenlabel geschickt hast: alles!']],
);
(NPC_CHATS.thron = NPC_CHATS.thron || []).push(
  [['lila', 'Wer hat den Zauberer reingelassen?!'], ['simon', 'Niemand. Ich bin reingefallen.'], ['lila', 'Das zählt nicht!']],
);
(NPC_CHATS.garten1776 = NPC_CHATS.garten1776 || []).push(
  [['salad', 'Hallo, kleiner Mann mit Kappe. Möchtest du meinen Freund Rostnagel kennenlernen?'], ['hoagie', 'Äh … vielleicht später, Mann.']],
);

// ---------- Dialoge ----------
const gbOk = id => fl()['gb_' + id];
function gbOpt(id) { return !gbOk(id) && { id: 'gb', text: 'Trägst du dich in Dr. Freds Gästebuch ein?' }; }

ACT.dave.talk = async () => {
  const d = 'dave', b = curId();
  await say(d, fl().metDave ? 'Na? Immer noch keine Mikrowelle angefasst?' : 'Whoa. Die Villa sieht ja noch genauso aus wie damals. Nur ohne Fleisch fressende Pflanze. Na ja, fast.');
  fl().metDave = 1;
  for (;;) {
    const f = fl();
    const c = await choose([{ id: 'wer', text: 'Wer bist du denn?' }, { id: 'hier', text: 'Wie bist du hierhergekommen?' },
      !f.falltuer && (f.keinStrom || f.falltuerGesehen) && { id: 'keller', text: 'Der Kaffeeautomat hat keinen Strom. Weißt du, wie man in den Keller kommt?' },
      f.falltuer && !f.daveKerker && { id: 'kerker', text: 'Du warst schon mal im Kerker da unten?' },
      { id: 'tipp', text: 'Hast du einen Tipp für mich?' }, gbOpt(d), { id: 'bye', text: 'Bis später.' }]);
    if (c === 'bye') { await say(b, 'Bis später.'); await say(d, 'Und nicht klingeln! Wer hier klingelt, landet im Keller.'); return; }
    if (c === 'keller') await DAVE_FALLTUER(b);
    if (c === 'kerker') {
      f.daveKerker = 1;
      await say(b, 'Du warst schon mal im Kerker da unten?');
      await say(d, 'Drei Tage. Fred hat mich erwischt, als ich durchs Fenster kam. Ich hab die Zeit genutzt und an der Wand die Steine gezählt.');
      await say(d, 'Es sind 412. Und einer davon ist locker. Dahinter ist nichts. Das war die größte Enttäuschung meines Lebens.');
    }
    if (c === 'wer') {
      await say(b, 'Wer bist du denn?');
      await say(d, 'Dave. Ich bin vor Jahren hier eingestiegen, um meine Freundin aus dem Labor zu holen. Mit Meteor, Tentakeln und allem.');
      await say(b, 'Moment … ich war dabei! Ich war der mit der Brille, der das Funkgerät repariert hat!');
      await say(d, 'Bernard?! Du hast ja immer noch denselben Pullunder-Blick.');
    }
    if (c === 'hier') {
      await say(b, 'Wie bist du hierhergekommen?');
      await say(d, 'Ich stand vor der Haustür und dachte: Diesmal klingle ich nicht. Und zack – ein Loch im Himmel, ein Klogeräusch, und ich bin drin.');
    }
    if (c === 'tipp') {
      await say(b, 'Hast du einen Tipp für mich?');
      await say(d, 'Zwei. Erstens: Steck nie einen Hamster in die Mikrowelle. Zweitens: siehe erstens.');
      if (f.keinStrom && !f.kellerStrom) await say(d, 'Und drittens: In dieser Villa geht es immer in den Keller. Immer. Frag mich, wie man runterkommt.');
    }
    if (c === 'gb') {
      await say(b, 'Trägst du dich in Dr. Freds Gästebuch ein?');
      await say(d, 'Klar. Wenn ich schon zweimal in dieses Haus einbreche, dann wenigstens einmal offiziell.');
      await gbSign(d);
    }
  }
};

// Sam & Max: Verhör mit einer einzigen richtigen Antwort
ACT.sam.talk = async () => {
  const s_ = 'sam', m = 'max', b = curId();
  if (!fl().metSam) { fl().metSam = 1; await say(s_, 'Freiberufliche Polizei! Bleiben Sie ruhig, Bürger. Wir ermitteln in einem Fall von unerlaubtem Zeitreisen.'); await say(m, 'Und wir haben einen Durchsuchungsbefehl! Den hab ich selbst gemalt.'); }
  else await say(s_, 'Ah, unser Lieblingszeuge. Noch eine Aussage?');
  for (;;) {
    const frei = fl().tatortFrei;
    const c = await choose([{ id: 'fall', text: 'Was für ein Fall?' }, { id: 'max', text: 'Was genau ist dein Partner?' },
      !frei && { id: 'verhoer', text: 'Gebt den Gut-O-Mat frei! Ich brauche den Hebel.' }, frei && !gbOk(s_) && { id: 'gb', text: 'Unterschreibt ihr in Dr. Freds Gästebuch?' },
      { id: 'bye', text: 'Viel Erfolg bei den Ermittlungen.' }]);
    if (c === 'bye') { await say(b, 'Viel Erfolg bei den Ermittlungen.'); await say(s_, 'Danke. Und verlassen Sie die Zeitzone nicht.'); return; }
    if (c === 'fall') {
      await say(b, 'Was für ein Fall?');
      await say(s_, 'Ein lila Tentakel hat die Weltherrschaft an sich gerissen. Zufälligerweise ist das in unserer Welt verboten. Und in Ihrer vermutlich auch.');
      await say(m, 'Ich verdächtige den Toaster. Er hat so schuldige Schlitze. Darum haben wir ihn abgesperrt.');
    }
    if (c === 'gb') {
      await say(b, 'Unterschreibt ihr in Dr. Freds Gästebuch?');
      await say(s_, 'Für unseren Kronzeugen? Selbstverständlich. Ich mit Füller, Max mit Ketchup.');
      await gbSign(s_, m);
    }
    if (c === 'max') {
      await say(b, 'Was genau ist dein Partner?');
      await say(s_, 'Ein hyperkinetisches Kaninchending. Er ist gesetzlich nicht erfasst.');
      await say(m, 'Ich bin wie ein Hase, nur mit mehr Zähnen und weniger Skrupeln.');
    }
    if (c === 'verhoer') await TATORT_VERHOER(b);
  }
};
ACT.max.talk = async () => {
  const m = 'max', b = curId();
  await say(m, pick(['Hallo! Ich bin Max! Darf ich dich beißen? Nur ein bisschen? Aus kriminalistischen Gründen?', 'Sam redet, ich mache den Rest. Der Rest ist meistens Lärm.']));
  await say(b, 'Äh … sprich lieber mit Sam.');
  await say(m, 'Alle wollen immer mit Sam reden. Sam hat einen Hut. Ich habe Ohren. Ohren sind besser.');
  return ACT.sam.talk();
};

ACT.salad.refuse = item => item === 'eimer' || item === 'wasser' ? null : pick(['Das ist nicht rostig. Es fühlt sich traurig an.', 'Hast du etwas … Rostiges für mich? Oder wenigstens etwas Feuchtes?']);
multi(['give', 'use'], 'i:eimer a:salad', async () => {
  await say('salad', 'Oh … Holz. Feucht. Mit einem Henkel aus Eisen. Ein bisschen rostig. Ein bisschen …');
  await say('salad', '*streichelt den Eimer* Hallo, Herr Eimer. Du darfst wieder zu deinem kleinen Mann zurück.');
  await say('hoagie', 'Äh … danke, Mann.');
  await say('salad', 'Ich schreibe meinen Namen ins Buch. Mit meinem längsten Finger.');
  await gbSign('salad');
});
RULES['give i:wasser a:salad'] = RULES['give i:eimer a:salad'];
RULES['use i:wasser a:salad'] = RULES['give i:eimer a:salad'];
ACT.salad.talk = async () => {
  const s_ = 'salad', h = curId();
  await say(s_, fl().metSalad ? 'Du bist wieder da. Der Zaun hat dich vermisst.' : 'Hallo. Möchtest du meinen Freund kennenlernen? Er heißt Rostnagel. Er ist sehr still.');
  fl().metSalad = 1;
  for (;;) {
    const c = await choose([{ id: 'wer', text: 'Wer bist du, Mann?' }, { id: 'tun', text: 'Was machst du da?' },
      !fl().saladOk && !fl().eimer && fl().eimerGesperrt && { id: 'eimer', text: 'Darf ich mir Herrn Eimer mal ausleihen?' },
      fl().saladDuell && { id: 'duell', text: fl().saladSieg ? 'Noch eine Runde Fechten, Salad?' : 'Der Affe sagt, du fichtst mit Rost. Finale?' },
      !gbOk(s_) && { id: 'gb', text: 'Unterschreibst du in einem Gästebuch?' }, { id: 'bye', text: 'Ich geh dann mal … ganz langsam.' }]);
    if (c === 'bye') { await say(h, 'Ich geh dann mal … ganz langsam.'); await say(s_, 'Pass auf dich auf. Und auf deine Finger. Finger sind kostbar.'); return; }
    if (c === 'eimer') await SALAD_EIMER(h);
    if (c === 'duell') await SALAD_FINALE(h);
    if (c === 'wer') { await say(h, 'Wer bist du, Mann?'); await say(s_, 'Ich bin Salad Fingers. Ich fühle gern Dinge. Am liebsten rostige Dinge. Rost ist wie eine Umarmung, die nach Metall riecht.'); }
    if (c === 'tun') {
      await say(h, 'Was machst du da?'); await say(s_, 'Ich höre dem Brunnen zu. Er hat einen sehr schönen Eimer. Ich wünschte, ich dürfte ihn halten.');
      if (!fl().schaufel) { await say(s_, 'Herr Schaufel war auch mein Freund. Ein schwankender Mann mit Hut hat ihn mit zum Hafen genommen. Er hat nicht einmal Tschüss gesagt.'); fl().knowsSchaufel = 1; }
    }
    if (c === 'gb') {
      await say(h, 'Unterschreibst du in einem Gästebuch?');
      await say(s_, has('eimer', h) || has('wasser', h) ? 'Vielleicht … wenn ich einmal den Eimer halten dürfte, den du da trägst …' : 'Ich unterschreibe nur, wenn ich vorher etwas Schönes fühlen darf. Der Eimer am Brunnen ist sehr schön.');
    }
  }
};

// ---------- Das große Beleidigungsfecht-Turnier 1776 ----------
// Vier Gegner nacheinander: Guybrush, Käpt’n Jack, der dreiköpfige Affe und Salad Fingers – alle mit Poolnudel.
// Jede Beleidigung braucht die passende Antwort (sie dreht die Beleidigung um). Lebensbalken wie bei Street Fighter II:
// vier Punkte pro Seite, drei Treffer in Folge zünden die Spezial-Kombo: den Super-Spritzer (doppelter Schaden).
const INSULTS = [
  ['Du fichtst wie ein Tentakel ohne Rückgrat!', 'Passend – du redest wie einer ohne Hirn.'],
  ['Mein Säbel ist schärfer als dein Verstand!', 'Dann benutz ihn doch mal zum Denken.'],
  ['Nach diesem Duell hast du Wackelpudding statt Knochen!', 'Dann passe ich endlich zu deinen Knien.'],
  ['Du riechst wie ein Fass, das zu lange in der Sonne stand!', 'Immerhin riecht man mich – dich bemerkt keiner.'],
  ['Selbst das Huhn im Garten ficht eleganter als du!', 'Klar, du hast ja auch von ihm gelernt.'],
  ['Ich habe schon Gegner zum Frühstück verspeist!', 'Darum siehst du auch so verdorben aus.'],
];
const DECOYS = ['Ach ja? Ach JA?!', 'Hinter dir! Ein dreiköpfiger Affe!', 'Das sag ich meiner Mama.', 'Ich bin Gummi, du bist Kleber!', 'Äh … Rock ’n’ Roll?', 'Na und? Ich hab ’ne Mütze.', 'Deine Nudel ist … äh … nudelig!'];
const FECHTER = {
  guybrush: { label: 'GUYBRUSH', runde: 1, spezial: 'GROG-SPRITZER!', insults: INSULTS,
    hit: ['Touché!', 'Argh. Das saß.', 'Woher kennst du die?!'], miss: ['Ha! Das war schwach.', 'Netter Versuch, Landratte.', 'Damit beleidigst du höchstens meine Nudel.'],
    ko: 'Uaaah … Ich bin besiegt! Mit Worten!', win: 'Und das war’s! Ich bin der Größte!' },
  jack: { label: 'KÄPT’N JACK', runde: 2, spezial: 'RUM-SPRITZER!', insults: [
    ['Du hast so viel Mut wie ein Fass ohne Rum!', 'Und du so viel Rum wie ein Fass ohne Boden.'],
    ['Mein Kompass zeigt auf alles – nur nie auf dich!', 'Kein Wunder, er zeigt ja auch nie auf dein Schiff.'],
    ['Ich bin der berühmteste Pirat aller Zeiten!', 'Berühmt fürs Schiff-Verlieren, ja.'],
    ['Du wirst den Tag verfluchen, an dem du mich getroffen hast!', 'Zu spät – das tue ich schon seit drei Minuten.'],
    ['Einen wie dich lasse ich kielholen!', 'Dafür bräuchtest du erst mal einen Kiel.'],
    ['Du riechst nach Landratte und nach Angst!', 'Und du nach Rum und nach Ausreden.'],
  ], hit: ['Autsch. Das war … fast elegant.', 'Hm. Darauf trinke ich später.', 'Na schön, das war gut. Sag’s keinem.'], miss: ['Savvy? Nein? Dachte ich mir.', 'Das war so schwach, dass mein Hut lacht.', 'Ein Pirat lacht über so was. Ha. Ha.'],
    ko: 'Besiegt … von einem Mann mit Kappe. Das schreibe ich nicht ins Logbuch.', win: 'Und so endet die Legende vom Mann mit der Kappe. Kurz.' },
  affe: { label: 'DREIKÖPFIGER AFFE', runde: 3, spezial: 'BANANEN-SPRITZER!', insults: [
    ['„Wir sind …“ – „… dreimal …“ – „… so klug wie du!“', 'Dreimal null ist immer noch null.'],
    ['„Drei Köpfe …“ – „… denken besser …“ – „… als einer!“', 'Bei euch denkt ja auch keiner von dreien.'],
    ['„Sechs Augen …“ – „… sind auf dich …“ – „… gerichtet!“', 'Und trotzdem habt ihr nichts gesehen.'],
    ['„Unser Gebrüll …“ – „… hört man …“ – „… bis zur nächsten Insel!“', 'Kein Wunder, ihr brüllt ja auch dreimal dasselbe.'],
    ['„Wir fressen dich …“ – „… mit drei …“ – „… Mäulern!“', 'Dann streitet ihr euch wenigstens um was Gutes.'],
    ['„Hinter dir …“ – „… ein einköpfiger …“ – „… Mensch!“', 'Den Trick kenne ich – mit mehr Köpfen.'],
  ], hit: ['„Au!“ – „Au!“ – „Wieso hat’s mich auch getroffen?“', '„Der war gut.“ – „Nein.“ – „Doch.“', '„Wir hassen ihn.“ – „Ein bisschen.“ – „Ich mag ihn.“'], miss: ['„Ha!“ – „Ha!“ – „Haha!“', '„Schwach.“ – „Sehr schwach.“ – „Dreifach schwach.“', '„Der hat …“ – „… keine …“ – „… Ahnung!“'],
    ko: '„Wir …“ – „… sind …“ – „… besiegt.“ *plumps*', win: '„Gewonnen!“ – „Gewonnen!“ – „Wer hat eigentlich gekämpft?“' },
  salad: { label: 'SALAD FINGERS', runde: 4, spezial: 'ROSTWASSER-SPRITZER!', insults: [
    ['Deine Finger sind so kurz … und so traurig …', 'Und deine so lang, dass sie zweimal traurig sind.'],
    ['Ich habe mit Löffeln gekämpft, die mehr Rost hatten als du Mut.', 'Dann hattest du endlich mal Gegner in deiner Größe.'],
    ['Du fühlst dich an wie ein nasser Teppich …', 'Und du siehst aus wie einer.'],
    ['Ich nenne dich ab jetzt „Herr Staub“ …', 'Sehr gern, Herr Rost.'],
    ['Meine Freunde haben keine Gesichter … und trotzdem lachen sie über dich.', 'Ohne Gesicht lacht man aber sehr leise.'],
    ['Deine Nudel ist so schlapp wie eine Gurke im Regen …', 'Deine Finger auch – und die sollen sogar fechten.'],
  ], hit: ['Oh … das hat mich … gekitzelt …', 'Autsch … wie ein rostiger Nagel. Schön.', 'Du bist sehr … unfreundlich. Ich mag das.'], miss: ['Hihi … deine Worte sind ganz weich …', 'Das hat Herr Rostnagel schöner gesagt.', 'Psst … der Zaun lacht über dich …'],
    ko: 'Oh … ich bin … ganz … nass … und besiegt …', win: 'Jetzt darf ich deine Finger streicheln. Das war die Abmachung. Glaube ich.' },
};
function shuffled(a) { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }
const DUEL_HP = 4;
// Haltung während des Duells: Poolnudel en garde, Ausfallschritt beim Treffer, Super-Spritzer bei der Spezial-Kombo
function duelFrame(a) { return a.spritzT && G.t - a.spritzT < 1500 ? 'spritz' : G.t - (a.lunge || -1e9) < 650 ? 'nudel1' : 'nudel0'; }
async function insultDuel(p, opp = 'guybrush') {
  const D = FECHTER[opp], g = ACT[opp], h = ACT[p];
  // Aufstellung: gut zwei Schritte Abstand, Blick zueinander
  const side = h.x > g.x ? 1 : -1, ax = Math.max(60, Math.min(900, g.x + side * 176));
  await walkTo(p, ax, g.y); h.dir = -side; g.dir = side;
  const fo = h.frameOverride; h.frameOverride = a => a.duel && FIG3D[a.kind] && FIG3D[a.kind].f.nudel0 ? duelFrame(a) : fo && fo(a, G.t);
  g.duel = h.duel = 1;
  let hpP = DUEL_HP, hpG = DUEL_HP, strP = 0, strG = 0;
  G.duelHud = { p, opp, hp: { p: 1, g: 1 }, show: { p: 1, g: 1 }, trail: { p: 1, g: 1 }, hitT: { p: -1e9, g: -1e9 }, str: { p: 0, g: 0 }, t0: G.t, last: G.t, timer: 99, msg: `RUNDE ${D.runde}`, msgT: G.t, jet: null };
  Sound.sfx('ding');
  try {
    await wait(1000); duelMsg('FECHTET!'); await wait(800);
    let pool = shuffled(D.insults);
    while (hpP > 0 && hpG > 0) {
      if (!pool.length) pool = shuffled(D.insults);
      const [ins, ret] = pool.pop();
      await say(opp, ins);
      const opts = shuffled([ret, ...shuffled(DECOYS).slice(0, 2)]).map((t, i) => ({ id: t === ret ? 'ok' : 'x' + i, text: t }));
      const c = await choose(opts);
      await say(p, opts.find(o => o.id === c).text);
      if (c === 'ok') {
        strP++; strG = 0;
        if (strP >= 3) { strP = 0; await spritzer(p, opp, 'SUPER-SPRITZER!'); hpG -= 2; }
        else { hpG--; h.lunge = G.t; Sound.sfx('saberswing'); shake(260, 3); }
        G.duelHud.hitT.g = G.t;
        await say(opp, hpG > 0 ? pick(D.hit) : D.ko);
      } else {
        strG++; strP = 0;
        if (strG >= 3) { strG = 0; await spritzer(opp, p, D.spezial); hpP -= 2; }
        else { hpP--; g.lunge = G.t; Sound.sfx('bad'); shake(320, 5); }
        G.duelHud.hitT.p = G.t;
        await say(opp, hpP > 0 ? pick(D.miss) : D.win);
      }
      hpP = Math.max(0, hpP); hpG = Math.max(0, hpG);
      Object.assign(G.duelHud.hp, { p: hpP / DUEL_HP, g: hpG / DUEL_HP }); Object.assign(G.duelHud.str, { p: strP, g: strG });
    }
    duelMsg(hpG === 0 ? (hpP === DUEL_HP ? 'PERFEKT!' : 'K.O.!') : 'K.O. …'); Sound.sfx(hpG === 0 ? 'achieve' : 'bad');
    await wait(1500);
  } finally { g.duel = h.duel = 0; G.duelHud = null; h.frameOverride = fo; }
  return hpG === 0;
}
// Spezial-Kombo: der Angreifer zückt den Super-Spritzer, ein Wasserstrahl trifft den Gegner am Kopf
async function spritzer(from, to, name) {
  const a = ACT[from];
  a.spritzT = G.t; duelMsg(name); Sound.sfx('whoosh');
  if (G.duelHud) G.duelHud.jet = { from, to, t0: G.t + 350 };
  await wait(700); Sound.sfx('splash'); shake(520, 6); ACT[to].nassT = G.t;
  await wait(800);
}
function duelMsg(text) { if (G.duelHud) { G.duelHud.msg = text; G.duelHud.msgT = G.t; } }
// Wasserstrahl und Tropfen (in Raum-Koordinaten, nach den Figuren gezeichnet)
function drawDuelFx() {
  const d = G.duelHud, room = G.state && ROOMS[viewRoomId()];
  if (!room) return;
  for (const id of ['hoagie', 'guybrush', 'jack', 'affe', 'salad']) {   // nass: Tropfen fallen vom Kopf
    const v = ACT[id]; if (!v || v.room !== room.id || !v.nassT || G.t - v.nassT > 2600) continue;
    const sc = roomScale(room, v.y) * (v.scaleMul || 1), k = (G.t - v.nassT) / 2600;
    for (let i = 0; i < 7; i++) {
      const u = ((G.t - v.nassT) * 0.0016 + i * 0.37) % 1, x = v.x + (hash01(i * 7) - 0.5) * 50 * sc, y = v.y - v.h * sc * (0.95 - u * 0.5);
      cx.save(); cx.globalAlpha = (1 - k) * (1 - u) * 0.9; E(cx, x, y, 2.2 * sc + 0.6, 3.2 * sc + 0.8, '#9ad8ff', 1, 0, '#3a7ab8'); cx.restore();
    }
  }
  const j = d && d.jet; if (!j || G.t < j.t0 || G.t - j.t0 > 1100) return;
  const a = ACT[j.from], b = ACT[j.to], f = a._fig, sa = roomScale(room, a.y) * (a.scaleMul || 1), sb = roomScale(room, b.y) * (b.scaleMul || 1), dir = a.dir < 0 ? -1 : 1;
  const hx = f ? f[12] : 30, hy = f ? f[13] : -120;
  const x0 = a.x + (hx + 44) * sa * dir, y0 = a.y + (hy - 10) * sa, x1 = b.x - dir * 10 * sb, y1 = b.y - b.h * sb * 0.86;
  const k = Math.min(1, (G.t - j.t0) / 320), fade = Math.min(1, (1100 - (G.t - j.t0)) / 250), n = 26;
  cx.save(); cx.globalAlpha = fade; cx.lineCap = 'round';
  const pt = u => [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - Math.sin(Math.PI * u) * 26];
  for (const [w, col] of [[17, 'rgba(40,110,190,0.5)'], [11, '#8ad4ff'], [4, 'rgba(255,255,255,0.85)']]) {
    cx.strokeStyle = col; cx.lineWidth = w * Math.min(sa, 1.1); cx.beginPath();
    for (let i = 0; i <= n * k; i++) { const u = i / n, [x, y] = pt(u), wob = Math.sin(G.t * 0.05 + i * 1.3) * 1.6; i ? cx.lineTo(x, y + wob) : cx.moveTo(x, y); }
    cx.stroke();
  }
  if (k >= 1) for (let i = 0; i < 12; i++) {   // Spritzer am Kopf
    const ang = -Math.PI * (0.1 + 0.8 * hash01(i * 3.1)), r = 10 + ((G.t - j.t0 - 320) * 0.06 + hash01(i) * 20) % 34;
    E(cx, x1 + Math.cos(ang) * r * -dir, y1 + Math.sin(ang) * r, 2.6, 2.6, '#bfe8ff', 1, 0, '#3a7ab8');
  }
  cx.restore();
}
{ const saberOhneDuell = drawSaber; drawSaber = function () { saberOhneDuell(); drawDuelFx(); }; }
// Lebensbalken wie bei Street Fighter II: laufen von der Mitte aus leer, rote Spur zieht verzögert nach
function drawDuelHud() {
  const d = G.duelHud; if (!d || G.screen !== 'game') return;
  const dt = Math.min(100, G.t - d.last); d.last = G.t;
  if (G.t - d.t0 > 1800 && Math.floor((G.t - d.t0) / 1000) > 99 - d.timer) d.timer = Math.max(1, d.timer - 1);
  const y = 62, bw = 360, bh = 20, cxm = W / 2;
  for (const k of ['p', 'g']) {
    d.show[k] += (d.hp[k] - d.show[k]) * Math.min(1, dt / 70);
    if (G.t - d.hitT[k] > 600) d.trail[k] += (d.show[k] - d.trail[k]) * Math.min(1, dt / 260);
  }
  const bar = (k, x0, dir) => {   // dir 1: links (füllt von außen links), -1: rechts
    const shake = G.t - d.hitT[k] < 260 ? (Math.random() - 0.5) * 4 : 0, xo = x0 + shake;
    R(cx, dir > 0 ? xo - 4 : xo - bw - 4, y - 4, bw + 8, bh + 8, '#1b1020', 2, 3, '#ffd23a');
    R(cx, dir > 0 ? xo : xo - bw, y, bw, bh, '#3a0a14', 0, 1);
    const tw = bw * d.trail[k], sw = bw * d.show[k];
    if (tw > 0) R(cx, dir > 0 ? xo : xo - tw, y, tw, bh, '#e8262e', 0, 1);
    if (sw > 0) R(cx, dir > 0 ? xo : xo - sw, y, sw, bh, d.show[k] < 0.4 && Math.floor(G.t / 160) % 2 ? '#fff08a' : '#ffd23a', 0, 1);
    if (sw > 0) R(cx, dir > 0 ? xo : xo - sw, y + 2, sw, 5, 'rgba(255,255,255,0.45)', 0, 1);
    for (let i = 1; i < DUEL_HP; i++) L(cx, [x0 + dir * bw * i / DUEL_HP, y, x0 + dir * bw * i / DUEL_HP, y + bh], 1.5, 'rgba(27,16,32,0.55)');
    // Kombo-Anzeige: zwei Treffer in Folge – der nächste zündet den Spritzer
    const st = d.str[k];
    if (st >= 1) txt(cx, st >= 2 ? (Math.floor(G.t / 200) % 2 ? 'SPEZIAL BEREIT!' : 'KOMBO ×2') : 'KOMBO ×1', dir > 0 ? x0 : x0, y + bh + 20, '400 15px "Titan One", sans-serif', st >= 2 ? '#7fe8ff' : '#ffffff', dir > 0 ? 'left' : 'right', 4, '#1b1020');
  };
  bar('p', cxm - bw - 44, 1); bar('g', cxm + bw + 44, -1);
  P(cx, [cxm - 26, y - 6, cxm + 26, y - 6, cxm + 20, y + bh + 6, cxm - 20, y + bh + 6], '#d8262e', 2.5);
  txt(cx, 'KO', cxm, y + 17, '400 20px "Titan One", sans-serif', '#ffd23a', 'center', 4, '#1b1020');
  txt(cx, String(d.timer).padStart(2, '0'), cxm, y + 58, '400 32px "Titan One", sans-serif', '#ffffff', 'center', 6, '#1b1020');
  txt(cx, ACT[d.p].name.toUpperCase(), cxm - bw - 44, y + 62, '400 18px "Titan One", sans-serif', '#ffd23a', 'left', 5, '#1b1020');
  txt(cx, FECHTER[d.opp].label, cxm + bw + 44, y + 62, '400 18px "Titan One", sans-serif', '#ffd23a', 'right', 5, '#1b1020');
  const mt = G.t - d.msgT;
  if (d.msg && mt < 1400) {
    const k = Math.min(1, mt / 180), a = mt > 1100 ? 1 - (mt - 1100) / 300 : 1, sz = Math.round(Math.min(70, 1100 / Math.max(6, d.msg.length)) * (1.6 - 0.6 * k));
    cx.save(); cx.globalAlpha = Math.max(0, a);
    txt(cx, d.msg, cxm, 230, `400 ${sz}px "Titan One", sans-serif`, '#ffd23a', 'center', 10, '#9a1018');
    cx.restore();
  }
}
G.duelHud = null;
{
  const hudOhneDuell = drawHUD; drawHUD = function () { hudOhneDuell(); drawDuelHud(); };
  const uiOhneDuell = drawUI; drawUI = function () { uiOhneDuell(); drawDuelHud(); };
}
// „Ein neuer Herausforderer!“ – Ansage quer über den Bildschirm
function drawChallenger() {
  const t0 = G.challengerT; if (!t0 || G.t - t0 > 2600) return;
  const k = (G.t - t0) / 2600, a = Math.min(1, k * 8, (1 - k) * 6);
  cx.save(); cx.globalAlpha = a;
  R(cx, 0, 150, W, 96, 'rgba(20,6,30,0.82)', 0, 0);
  const x = W / 2 + (1 - Math.min(1, k * 5)) * 400;
  txt(cx, 'EIN NEUER HERAUSFORDERER!', x, 212, '400 44px "Titan One", sans-serif', Math.floor(G.t / 120) % 2 ? '#ffd23a' : '#ff5a3a', 'center', 8, '#1b1020');
  cx.restore();
}
{
  const hud2 = drawHUD; drawHUD = function () { hud2(); drawChallenger(); };
  const ui2 = drawUI; drawUI = function () { ui2(); drawChallenger(); };
}
ACT.guybrush.talk = async () => {
  const g = 'guybrush', h = curId();
  await say(g, fl().metGuy ? 'Ah, mein Lieblings-Roadie! Bereit für eine Revanche?' : 'Ich bin ein mächtiger Pi… äh. Ich bin fast ein Pirat. Ich mache gerade die Prüfungen.');
  fl().metGuy = 1;
  for (;;) {
    const c = await choose([{ id: 'wer', text: 'Wer bist du, Alter?' }, { id: 'pruef', text: 'Was für Prüfungen?' }, { id: 'duell', text: gbOk(g) ? 'Noch eine Runde Beleidigungsfechten?' : 'Ich fordere dich zum Beleidigungsfechten heraus!' }, { id: 'bye', text: 'Mach’s gut, Pirat.' }]);
    if (c === 'bye') { await say(h, 'Mach’s gut, Pirat.'); await say(g, 'Fast-Pirat! Aber danke!'); return; }
    if (c === 'wer') { await say(h, 'Wer bist du, Alter?'); await say(g, 'Guybrush Threepwood! Merk dir den Namen. Alle anderen vergessen ihn.'); await say(h, 'Guy… was?'); await say(g, 'Siehst du.'); }
    if (c === 'pruef') {
      await say(h, 'Was für Prüfungen?');
      await say(g, 'Schwertkampf, Schatzsuche, Diebstahl. Beim Schwertkampf kommt es nicht auf den Säbel an, sondern auf die Zunge.');
      await say(g, 'Wer die bessere Antwort auf eine Beleidigung hat, gewinnt. Die beste Antwort passt immer genau zur Beleidigung.');
    }
    if (c === 'duell') {
      await say(h, gbOk(g) ? 'Noch eine Runde?' : 'Ich fordere dich heraus!');
      await say(g, 'En garde! Drei Beleidigungen. Drei Antworten. Kein Erbarmen.');
      const sieg = await insultDuel(h, g);
      if (sieg) {
        await say(g, 'Mit einer Poolnudel besiegt … Du kämpfst wie ein Roadie! Das ist ein Kompliment.');
        unlock('fechten'); fl().fechtSieg = 1;
        if (!gbOk(g)) { await say(g, 'Ich trage mich in dein Buch ein. Mit Schnörkel, wie ein echter Pirat.'); await gbSign(g); }
        if (!fl().jackSieg) await say(g, 'Das war Runde eins des großen Turniers. Runde zwei ist Käpt’n Jack. Sag ihm, dass du mich besiegt hast – dann fordert er dich heraus.');
      } else await say(g, 'Übung macht den Piraten. Merk dir: Die Antwort muss die Beleidigung umdrehen! Und drei Treffer hintereinander zünden den Super-Spritzer.');
    }
  }
};

ACT.jack.talk = async () => {
  const j = 'jack', h = curId();
  await say(j, fl().metJack ? 'Ah. Der Mann mit der Kappe. Wieder da. Das ist entweder Treue oder Langeweile.' : 'Ah. Ein Mann mit Hut. Mütze. Kappe. Das zählt. Willkommen an Bord. Es gibt kein Bord.');
  fl().metJack = 1;
  for (;;) {
    const c = await choose([{ id: 'wer', text: 'Wer bist du?' }, { id: 'kompass', text: 'Was ist das für ein Kompass?' }, { id: 'hier', text: 'Was machst du in 1776?' },
      !fl().schaufel && { id: 'schaufel', text: fl().fechtSieg ? 'Ich hab Guybrush besiegt. Jetzt gib mir die Schaufel!' : 'Das ist Oma Gertrudes Schaufel! Kann ich die haben?' },
      !gbOk(j) && { id: 'gb', text: 'Unterschreibst du in einem Gästebuch?' }, { id: 'bye', text: 'Tschüss, Käpt’n.' }]);
    if (c === 'schaufel') await JACK_SCHAUFEL(h);
    if (c === 'bye') { await say(h, 'Tschüss, Käpt’n.'); await say(j, 'Merk dir diesen Tag als den Tag, an dem du fast Käpt’n Jack Sparrow begegnet bist.'); return; }
    if (c === 'wer') { await say(h, 'Wer bist du?'); await say(j, 'Käpt’n. Käpt’n Jack Sparrow. Mit Käpt’n davor. Das ist wichtig. Ohne Käpt’n bin ich nur ein Vogel.'); }
    if (c === 'kompass') {
      await say(h, 'Was ist das für ein Kompass?');
      await say(j, 'Er zeigt nicht nach Norden. Er zeigt auf das, was du am meisten willst. Schau.');
      await say(j, 'Er zeigt … auf dein Frühstück. Faszinierend. Ein schlichter Mann mit schlichten Wünschen.');
      await say(h, 'Hey, Frühstück ist wichtig, Mann.');
    }
    if (c === 'hier') {
      await say(h, 'Was machst du in 1776?');
      await say(j, 'Mein Schiff ist weg. Schon wieder. Diesmal durch ein Loch im Himmel, das nach Klo klang. Sehr unhöflich, dieses Loch.');
    }
    if (c === 'gb') {
      await say(h, 'Unterschreibst du in einem Gästebuch?');
      await say(j, 'Ich unterschreibe nur bei Leuten, die die richtige Antwort kennen. Was ist das Wichtigste auf einem Schiff?');
      const v = await choose([{ id: 'rum', text: 'Der Rum.' }, { id: 'crew', text: 'Die Crew.' }, { id: 'kaep', text: 'Der Käpt’n.' }, { id: 'segel', text: 'Die Segel?' }]);
      await say(h, { rum: 'Der Rum.', crew: 'Die Crew.', kaep: 'Der Käpt’n.', segel: 'Die Segel?' }[v]);
      if (v === 'kaep') { await say(j, 'Richtig! Der Käpt’n. Also ich. Du bist klüger, als deine Kappe vermuten lässt.'); await say(j, '*kritzelt ein Herz mit Totenkopf* Da. Unterschrieben.'); await gbSign(j); }
      else if (v === 'rum') await say(j, 'Ein sehr guter Gedanke. Aber falsch. Der Rum ist das Zweitwichtigste. Oder Erstwichtigste nach dem Wichtigsten.');
      else await say(j, 'Nein. Denk an den, der hier vor dir steht. Mit dem Hut. Und dem Charme.');
    }
  }
};

// Bender „leiht“ sich jeden Gegenstand kurz aus – und gibt ihn (widerwillig) zurück
for (const it of Object.keys(ITEMS)) multi(['give', 'use'], `i:${it} a:bender`, async () => {
  if (fl().benderToast && !fl().toastZurueck) {
    if (it === 'steth') return say('bender', 'Ein Stethoskop?! Weg damit! Ich lasse mich nicht untersuchen! Schon gar nicht von dir. Und erst recht nicht von dem mit den Scheren!');
    return say('bender', 'Ein Tausch? Nee. In meiner Brustklappe liegt schon was Knuspriges. Da passt nichts mehr rein. Außer Rum.');
  }
  await say('bender', `Danke, Fleischsack! *steckt ${ITEMS[it].name} in die Brustklappe* Meins!`);
  await say(curId(), 'Hey! Das brauche ich noch!');
  await say('bender', 'Na gut, na gut. *klapp* Hier. Aber nur, weil du so jämmerlich guckst.');
  if (!gbOk('bender')) { await say('bender', 'Und weil ich heute großzügig bin: Ich unterschreibe dein Buch. Mit Schraube.'); await gbSign('bender'); }
});
ACT.bender.talk = async () => {
  const b_ = 'bender', l = curId();
  await say(b_, fl().metBender ? 'Du schon wieder. Hast du was Glänzendes dabei?' : 'Hey, Fleischsack! Was guckst du so? Noch nie einen gutaussehenden Roboter gesehen?');
  fl().metBender = 1;
  for (;;) {
    const geklaut = fl().benderToast && !fl().toastZurueck;
    const c = await choose([{ id: 'wer', text: 'Wer bist du?' }, geklaut && { id: 'toast', text: 'Gib sofort den Toast zurück!' }, { id: 'schiff', text: 'Ist das euer Raumschiff?' },
      !geklaut && !gbOk(b_) && { id: 'gb', text: 'Unterschreibst du in einem Gästebuch?' }, { id: 'bye', text: 'Tschüss, Blechbüchse.' }]);
    if (c === 'toast') {
      await say(l, 'Gib sofort den Toast zurück! Der ist für Lila.');
      await say(b_, 'Welchen Toast? *knusper* … Ich meine: Welchen Toast? Hier ist kein Toast. Nur meine Brustklappe. Und die bleibt zu.');
      await say(b_, 'Die geht nur bei einer ärztlichen Untersuchung auf. Und Ärzte hasse ich. Alle. Besonders den mit den Scheren.');
      fl().benderSchwach = 1;
    }
    if (c === 'bye') { await say(l, 'Tschüss, Blechbüchse.'); await say(b_, 'Blech? Ich bin zu 40 Prozent aus Titan!'); return; }
    if (c === 'wer') { await say(l, 'Wer bist du?'); await say(b_, 'Bender. Biegeroboter. Ich biege Träger, Löffel und Regeln.'); await say(l, 'Darf ich dich aufschrauben? Nur ein bisschen?'); await say(b_, 'Lady, du machst mir Angst. Ich mag das.'); }
    if (c === 'schiff') { await say(l, 'Ist das euer Raumschiff?'); await say(b_, 'Das ist das Firmenschiff. Ich bin quasi der Chef. Der Professor sieht das anders. Der Professor sieht nicht mehr gut.'); }
    if (c === 'gb') { await say(l, 'Unterschreibst du in einem Gästebuch?'); await say(b_, 'Umsonst? Niemals. Gib mir irgendwas aus deiner Tasche. Irgendwas!'); }
  }
};
ACT.prof.talk = async () => {
  const p = 'prof', l = curId();
  await say(p, 'Gute Nachrichten, alle zusammen! … Ach, nur eine. Gute Nachricht, du da!');
  for (;;) {
    const c = await choose([{ id: 'wer', text: 'Wer sind Sie?' }, { id: 'fred', text: 'Kennen Sie Dr. Fred?' },
      fl().benderToast && !fl().toastZurueck && { id: 'bender', text: 'Ihr Roboter hat meinen Toast geklaut!' },
      !gbOk(p) && { id: 'gb', text: 'Unterschreiben Sie in Dr. Freds Gästebuch?' }, { id: 'bye', text: 'Auf Wiedersehen, Professor.' }]);
    if (c === 'bender') {
      await say(l, 'Ihr Roboter hat meinen Toast geklaut!');
      await say(p, 'Gute Nachrichten! Ich weiß, wie man ihn wiederkriegt. Bender hat panische Angst vor Arztbesuchen.');
      await say(p, 'Sobald ihn jemand mit einem richtigen Doktor-Werkzeug untersuchen will, klappt er vor Schreck die Brustklappe auf.');
      await say(p, 'Dr. Zoidberg würde ihn liebend gern untersuchen. Er hat nur leider kein Werkzeug. Und keine Approbation. Und keinen Plan.');
      await say(l, 'Ein richtiges Doktor-Werkzeug … Ich glaube, ich habe da was.');
      fl().benderSchwach = 1;
    }
    if (c === 'bye') { await say(l, 'Auf Wiedersehen, Professor.'); await say(p, 'Wiedersehen? Wo? Wann? Ach, egal.'); return; }
    if (c === 'wer') { await say(l, 'Wer sind Sie?'); await say(p, 'Ich habe eine Lieferfirma gegründet. Mit Raumschiff. Und eine Zeitmaschine gebaut, die nur vorwärts fährt. Das kann jeder, sagen die Leute. Pah!'); }
    if (c === 'fred') { await say(l, 'Kennen Sie Dr. Fred?'); await say(p, 'Edison? Der mit dem Toaster? Ein Amateur! Meine Maschinen explodieren viel schöner.'); await say(l, 'Er hat aber ein Zeitklo gebaut.'); await say(p, '… Verdammt. Das ist gut.'); }
    if (c === 'gb') {
      await say(l, 'Unterschreiben Sie in Dr. Freds Gästebuch?');
      await say(p, 'Natürlich! Wo ist mein Stift … ach, ich halte ihn ja. *kritzel* Wie hieß ich nochmal? Egal, ich schreibe „Professor“. Das stimmt immer.');
      await gbSign(p);
    }
  }
};
ACT.zoid.refuse = item => item === 'steth' ? null : 'Ist das essbar? *schnüffel* … Nein. Hier, nimm es zurück, bevor ich es doch esse.';
multi(['give', 'use'], 'i:steth a:zoid', async () => {
  if (fl().benderToast && !fl().toastZurueck) return ZOIDBERG_VISITE();
  await say('zoid', 'Ein Stethoskop! Ein echtes Doktor-Werkzeug! *horcht an seiner Schere* … Ich höre das Meer!');
  await say('laverne', 'Das ist dein Blut.'); await say('zoid', 'Dann höre ich mein Blut, und es klingt wie das Meer! Herrlich!');
  await say('zoid', 'Hier, Kollegin, zurück damit. Zum Dank trage ich mich in Ihr Buch ein. Mit Tinte! Meiner eigenen!');
  await gbSign('zoid');
});
ACT.zoid.talk = async () => {
  const z = 'zoid', l = curId();
  await say(z, 'Hurra! Ein Mensch! Sind Sie krank? Bitte seien Sie krank!');
  for (;;) {
    const c = await choose([{ id: 'arzt', text: 'Sind Sie Arzt?' }, { id: 'menschen', text: 'Was wissen Sie über Menschen?' }, !gbOk(z) && { id: 'gb', text: 'Tragen Sie sich in ein Gästebuch ein?' }, { id: 'bye', text: 'Ich muss weiter, Herr Kollege.' }]);
    if (c === 'bye') { await say(l, 'Ich muss weiter, Herr Kollege.'); await say(z, 'Kollege! Sie hat Kollege gesagt! *klapper klapper*'); return; }
    if (c === 'arzt') { await say(l, 'Sind Sie Arzt?'); await say(z, 'Natürlich! Experte für Menschen! Ich habe sogar einen Kittel.'); await say(l, 'Ich studiere Medizin.'); await say(z, 'Eine Kollegin! Darf ich Ihnen meinen Lieblingsknochen zeigen? Ich habe keinen.'); }
    if (c === 'menschen') { await say(l, 'Was wissen Sie über Menschen?'); await say(z, 'Alles! Fünf Finger, zwei Augen, ein … Bauchnabel? Wozu ist der eigentlich gut?'); await say(l, 'Endlich jemand, der die richtigen Fragen stellt.'); }
    if (c === 'gb') { await say(l, 'Tragen Sie sich in ein Gästebuch ein?'); await say(z, 'Zoidberg unterschreibt gern! Aber erst möchte ich einmal ein echtes Doktor-Werkzeug halten. Ein einziges Mal!'); }
  }
};

// Test-KI: drei Testfragen, Belohnung ist Kuchen (ein Foto davon)
ACT.glados.talk = async () => {
  const k = 'glados', l = curId();
  await say(k, fl().metKi ? 'Oh. Du schon wieder. Ich hatte gehofft, die Testkammer hätte dich … umgeleitet.' : 'Oh. Hallo. Willkommen in der Testkammer. Diese Begrüßung wurde automatisch erstellt und bedeutet nichts.');
  fl().metKi = 1;
  for (;;) {
    const c = await choose([{ id: 'wer', text: 'Wer oder was bist du?' }, { id: 'kuchen', text: 'Gibt es hier wirklich Kuchen?' },
      (!gbOk(k) || !fl().kiFrei) && { id: 'test', text: fl().kiTuer && !fl().kiFrei ? 'Mach die Tür zum Thronsaal auf! Ich mache deinen Test.' : 'Ich mache deinen Test. Unterschreibst du dann im Gästebuch?' },
      { id: 'bye', text: 'Ich geh dann mal.' }]);
    if (c === 'bye') { await say(l, 'Ich geh dann mal.'); await say(k, 'Gute Idee. Bitte nehmen Sie Ihre Begeisterung mit. Sie stört die Messungen.'); return; }
    if (c === 'wer') { await say(l, 'Wer oder was bist du?'); await say(k, 'Ich bin die neue Sicherheits-KI Seiner Lilaheit. Ich wurde wegen meiner Persönlichkeit eingestellt.'); await say(l, 'Und die Wache?'); await say(k, 'Die Wache ist ein Test. Sie besteht ihn seit vierzig Jahren nicht.'); }
    if (c === 'kuchen') { await say(l, 'Gibt es hier wirklich Kuchen?'); await say(k, 'Natürlich. Er ist in einer anderen Kammer. Die Kammer ist in Planung. Die Planung ist ein Gerücht.'); }
    if (c === 'test') {
      await say(l, 'Ich mache deinen Test.'); await say(k, 'Wunderbar. Drei Fragen. Bei jeder falschen Antwort wird ein kleiner, harmloser Ton gespielt, der Sie für immer verfolgen wird.');
      const Q = [
        ['Frage eins: Was ist schwerer – ein Kilo Federn oder ein Kilo Würfel mit Herz?', [['gleich', 'Beides gleich schwer.'], ['wuerfel', 'Der Würfel. Er hat ein Herz, das wiegt.'], ['federn', 'Die Federn. Weil … Physik?']]],
        ['Frage zwei: Wenn man durch das blaue Oval hineingeht und aus dem orangen herauskommt – wo ist man dann?', [['woanders', 'Woanders.'], ['blau', 'Im Blauen.'], ['kuchen', 'Beim Kuchen?']]],
        ['Frage drei: Gibt es Kuchen?', [['ja', 'Ja!'], ['nein', 'Nein.'], ['persp', 'Kuchen ist eine Frage der Perspektive.']]],
      ];
      const right = ['gleich', 'woanders', 'persp'];
      let pts = 0;
      for (let i = 0; i < Q.length; i++) {
        await say(k, Q[i][0]);
        const a = await choose(Q[i][1].map(([id, text]) => ({ id, text })));
        await say(l, Q[i][1].find(o => o[0] === a)[1]);
        if (a === right[i]) { pts++; await say(k, pick(['Korrekt. Wie enttäuschend.', 'Richtig. Ich notiere „ausreichend unterhaltsam“.', 'Stimmt. Ich hatte gehofft, Sie würden zögern.'])); }
        else { Sound.sfx('botbeep'); await say(k, pick(['Falsch. Hören Sie den Ton? Er wird Sie begleiten.', 'Nein. Aber sehr mutig falsch.', 'Interessant. Falsch, aber interessant.'])); }
      }
      if (pts === 3) {
        await say(k, 'Glückwunsch. Sie haben bestanden. Hier ist Ihr Kuchen: *zeigt ein Foto von einem Kuchen*.');
        await say(l, 'Das ist ein Foto.'); await say(k, 'Und das ist eine Unterschrift in Ihrem Gästebuch. Ein noch größeres Geschenk. Bitte weinen Sie leise.');
        await gbSign(k);
        if (!fl().kiFrei) { fl().kiFrei = 1; Sound.sfx('door'); await say(k, 'Außerdem habe ich die Thronsaaltür entriegelt. Getestete Subjekte dürfen zu Seiner Lilaheit. Viel Spaß. Ich meine das nicht so.'); }
      } else await say(k, `${pts} von 3. Der Test wird wiederholt, bis jemand lacht. Ich lache nie.`);
    }
  }
};

ACT.simon.talk = async () => {
  const m = 'simon', l = curId();
  await say(m, fl().metSimon ? 'Ach, die Leichenbeschauerin ist wieder da. Super.' : 'Super. Ich wollte nach Hause und lande in einem lila Thronsaal mit einem sprechenden Gurkenwurm.');
  fl().metSimon = 1;
  for (;;) {
    const kalt = fl().toastKalt && !fl().toastWarm;
    const c = await choose([{ id: 'wer', text: 'Wer bist du?' }, { id: 'zauber', text: 'Kannst du zaubern?' }, kalt && { id: 'toast', text: 'Kannst du meinen Toast aufwärmen?' },
      { id: 'heim', text: 'Wie kommst du nach Hause?' }, !gbOk(m) && fl().simonHeim && { id: 'gb', text: 'Trägst du dich in Dr. Freds Gästebuch ein?' }, { id: 'bye', text: 'Viel Glück, Zauberer.' }]);
    if (c === 'bye') { await say(l, 'Viel Glück, Zauberer.'); await say(m, 'Glück. Klar. Das hatte ich zuletzt, als mich ein Hund in ein Märchenbuch gezogen hat.'); return; }
    if (c === 'wer') { await say(l, 'Wer bist du?'); await say(m, 'Simon. Zauberer. Na ja, Zauberlehrling mit eigenem Hut. Der Hut macht 80 Prozent der Magie. Den Rest mache ich mit Sarkasmus.'); }
    if (c === 'zauber') {
      await say(l, 'Kannst du zaubern?'); await say(m, 'Pass auf: *murmel murmel* … Siehst du? Nichts passiert. Das ist ein Unsichtbarkeitszauber. Auf die Wirkung.'); await say(l, 'Beeindruckend.'); await say(m, 'Ich weiß.');
      await say(m, 'Na gut, einen Zauber kann ich wirklich: Aufwärmen. Hab ich für nasse Socken erfunden. Klappt bei allem, was kalt und traurig ist.');
    }
    if (c === 'toast') { if (has('toast', l)) await SIMON_WAERMT(l); else { await say(l, 'Kannst du meinen Toast aufwärmen?'); await say(m, 'Klar. Dafür bräuchte ich allerdings den Toast. Zauberei ist nicht Gedankenlesen.'); } }
    if (c === 'heim') {
      fl().simonHeim = 1;
      await say(l, 'Wie kommst du nach Hause?'); await say(m, 'Ich bräuchte ein Portal. Oder einen Zauberstab. Oder eine sehr große Leiter.');
      await say(l, 'Wir hätten Chrono-Klos.'); await say(m, 'Natürlich habt ihr das. Warum auch nicht. Ein Klo als Portal. Das ist das Würdeloseste, was ich je gehört habe. Ich nehme es.');
      await say(m, 'Wenn euer Doktor dafür eine Unterschrift braucht – frag ruhig.');
    }
    if (c === 'gb') { await say(l, 'Trägst du dich in Dr. Freds Gästebuch ein?'); await say(m, 'Wenn es mich nach Hause bringt, unterschreibe ich sogar in Lilas Kalender. *schwungvoll* Bitte sehr.'); await gbSign(m); }
  }
};

// Gegenstände an Gäste geben, die keine eigene Regel haben
for (const id of GUESTS) if (!ACT[id].refuse) ACT[id].refuse = () => pick(['Danke, aber das brauche ich nicht. Ich bin nur zu Besuch.', 'Nett gemeint. Aber das passt nicht in meine Welt.', 'Behalt das lieber. Du hast offenbar eine Aufgabe.']);

// ============================================================
//  Die Gäste in der Hauptgeschichte: in jeder Zeit hängt ein Schritt der Rettung an den neuen Orten und Gästen
//  Gegenwart: Sam & Max sperren den Hebel des Gut-O-Mats als Tatort ab – erst nach ihrem Verhör ist er frei.
//  1776: Käpt’n Jack hat sich die Gartenschaufel „geliehen“ und gibt sie nur einem echten Piraten (Guybrush besiegen).
//  Zukunft: Bender klaut den Gut-Toast am Klo, Zoidberg holt ihn mit Lavernes Stethoskop zurück;
//  und GLaDOS lässt nach der Wache nur getestete Subjekte in den Thronsaal.
// ============================================================

// ---------- Gegenwart: der Tatort im Labor ----------
function drawAbsperrband(c, t) {
  const w = Math.sin(t * 0.003) * 1.5;
  for (const [x0, y0, x1, y1] of [[566, 200 + w, 660, 240 - w], [570, 250 - w, 656, 210 + w]]) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    c.save(); c.translate(x0, y0); c.rotate(Math.atan2(y1 - y0, x1 - x0));
    R(c, 0, -7, len, 14, '#ffd23a', 2, 1, OUT);
    txt(c, 'TATORT', len / 2, 4, '800 10px "Baloo 2", sans-serif', '#1b1020', 'center');
    c.restore();
  }
  // lose Enden flattern
  L(c, [660, 240 - w, 672, 252 + w * 2, 668, 266], 5, OUT); L(c, [660, 240 - w, 672, 252 + w * 2, 668, 266], 3, '#ffd23a');
}
ROOMS.labor.objs.push({ id: 'absperrband', name: 'Absperrband', rect: [566, 176, 96, 104], walk: [604, 362], visible: () => !fl().tatortFrei && !fl().toast,
  look: 'Gelbes Absperrband, zweimal um den Hebel des Gut-O-Mats gewickelt: „TATORT – FREIBERUFLICHE POLIZEI – NICHT ZIEHEN“.', draw: drawAbsperrband });
async function TATORT_STOPP() {
  await say('sam', 'Halt! Finger weg vom Hebel. Das ist ein Tatort. Freiberufliche Polizei.');
  await say('max', 'Wir haben ihn abgesperrt! Mit Band! Das Band war teuer. Also, geklaut.');
  if (!fl().tatortGesehen) {
    fl().tatortGesehen = 1;
    await say('bernard', 'Ein Tatort? Das ist Dr. Freds Gut-O-Mat! Den brauchen wir, um die Welt zu retten!');
    await say('sam', 'Das sagen alle Verdächtigen. Wenn Sie uns helfen, den Fall zu lösen, geben wir ihn frei. Sprechen Sie mich an, wenn Sie bereit sind fürs Verhör.');
  }
}
multi(['pull', 'push', 'use', 'pick', 'open'], 'o:absperrband', TATORT_STOPP);
for (const v of ['pull', 'push', 'use']) {
  const orig = RULES[`${v} o:hebel`];
  RULES[`${v} o:hebel`] = () => !fl().tatortFrei && !fl().toast ? TATORT_STOPP() : orig();
}
async function TATORT_VERHOER(b) {
  const s_ = 'sam', m = 'max';
  await say(b, 'Gebt den Gut-O-Mat frei! Ich brauche den Hebel.');
  await say(s_, 'Der Toaster bleibt ein Tatort, bis der Fall gelöst ist. Aber Sie dürfen helfen. Drei Fragen. Reine Routine.');
  await say(m, 'Und wenn du lügst, beiße ich den Toaster!');
  const Q = [
    ['Frage eins: Wer ist der Täter?', 'lila', { lila: 'Lila Tentakel.', fred: 'Dr. Fred.', toast: 'Der Toaster.', ich: 'Ich war’s. Glaube ich.' },
      { fred: [[m, 'Der Mann mit der Frisur? Plausibel!'], [s_, 'Leider falsch. Wer hat denn die Welt an sich gerissen?']],
        toast: [[m, 'HA! Ich wusste es!'], [s_, 'Max, der Toaster hat ein Alibi. Er war die ganze Zeit hier und hat getoastet.']],
        ich: [[m, 'Ein Geständnis! Verhaften wir ihn, Sam!'], [s_, 'Max, wir verhaften niemanden, der so nervös schwitzt. Das ist unter unserer Würde.']] }],
    ['Frage zwei: Was hat der Täter hier im Labor gestohlen?', 'zelle', { zelle: 'Dr. Freds Energiezelle. Und das letzte Freundlichkeits-Brot hat er aufgefressen.', hut: 'Sams Hut.', welt: 'Nichts. Die Welt hat er sich nur ausgeliehen.' },
      { hut: [[s_, 'Mein Hut ist hier. Auf meinem Kopf. Ich habe gerade nachgesehen.']],
        welt: [[s_, 'Ausleihen ohne Zurückgeben heißt bei uns Diebstahl. Oder Bibliothek. Gefragt war aber, was hier im Labor fehlt.']] }],
    ['Frage drei: Und womit wollen Sie ihn aufhalten?', 'toast', { toast: 'Mit einem Gut-Toast. Aus genau diesem Gut-O-Mat.', max: 'Mit Max.', blick: 'Mit einem sehr strengen Blick.' },
      { max: [[m, 'Ja! Ja! JA!'], [s_, 'Nein, Max. Du bist kein Gegenmittel. Du bist eher eine Nebenwirkung.']],
        blick: [[s_, 'Strenge Blicke haben bei Tentakeln noch nie gewirkt. Die haben keine Augenbrauen.']] }],
  ];
  for (const [frage, richtig, antworten, falsch] of Q) {
    await say(s_, frage);
    const a = await choose(shuffled(Object.entries(antworten)).map(([id, text]) => ({ id, text })));
    await say(b, antworten[a]);
    if (a !== richtig) {
      for (const [w, t] of falsch[a]) await say(w, t);
      await say(s_, 'Kommen Sie wieder, wenn Sie den Fall durchschaut haben. Dr. Fred redet viel, wenn man ihn fragt.');
      return;
    }
    await say(s_, pick(['Korrekt. Max, notier das.', 'Stimmt. Das deckt sich mit unseren Ermittlungen.', 'Richtig. Sie sind ein vorbildlicher Zeuge.']));
  }
  await say(s_, 'Der Fall ist gelöst! Täter: Lila. Beute: Strom und Brot. Gegenmittel: Toast. Max, gib den Tatort frei.');
  await say(m, 'Ich reiße das Band ab! Mit den Zähnen!');
  const mx = ACT.max, home = [mx.x, mx.y, mx.dir];
  await walkTo('max', 650, 384); mx.dir = -1;
  Sound.sfx('pop'); shake(300, 3); fl().tatortFrei = 1;
  await say(m, '*rrrratsch* Frei! Und das Band schmeckt nach Abenteuer.');
  await walkTo('max', home[0], home[1]); mx.dir = home[2];
  if (!gbOk(s_)) { await say(s_, 'Für unseren Kronzeugen unterschreiben wir auch gleich in Dr. Freds Gästebuch. Ich mit Füller, Max mit Ketchup.'); await gbSign(s_, m); }
}

// ---------- 1776: Jacks „geliehene“ Schaufel am Hafen ----------
const JACK_SCHAUFEL_IMG = loadImg('img/hafen/schaufel.png');
{ const gs = ROOMS.garten1776.objs.find(o => o.id === 'schaufel'); if (gs) gs.visible = () => false; }   // lehnt nicht mehr am Zaun
ROOMS.hafen.objs.push({ id: 'jack_schaufel', name: 'Schaufel', rect: [664, 300, 56, 120], walk: [672, 410], visible: () => !fl().schaufel,
  look: 'Oma Gertrudes Schaufel! Jack hat damit ein Loch in den Steg gegraben. Der Steg ist aus Holz. Das Loch ist sehr flach.',
  draw: c => {
    if (!imgOk(JACK_SCHAUFEL_IMG) || typeof HAFEN_EBENEN === 'undefined' || !HAFEN_EBENEN.schaufel) return;
    const [w, h] = HAFEN_EBENEN.schaufel, s = 104 / h;
    E(c, 694, 414, 15, 4, 'rgba(30,15,10,0.55)', 0);   // das Loch im Steg
    if (c.isPix) { c.drawSprite(JACK_SCHAUFEL_IMG, 0, 0, w, h, 694 - w * s / 2, 416 - h * s, w * s, h * s); return; }
    c.save(); c.translate(694, 416); c.rotate(0.2); c.drawImage(JACK_SCHAUFEL_IMG, -w * s / 2, -h * s, w * s, h * s); c.restore();
  } });
multi(['pick', 'pull', 'use'], 'o:jack_schaufel', async () => {
  if (fl().fechtSieg) return JACK_SCHAUFEL(curId());
  await say('jack', 'Finger weg von meiner Schatzschaufel, Kumpel! Die gehört einem echten Piraten. Also mir. Gefühlt.');
});
async function JACK_SCHAUFEL(h) {
  const j = 'jack';
  if (!fl().fechtSieg) {
    await say(h, 'Das ist Oma Gertrudes Schaufel! Kann ich die haben?');
    await say(j, 'Gertrude? Nie gehört. Die Schaufel hat mich gefunden. Mein Kompass sagt: Grab hier. Also grabe ich. Seit drei Stunden. Im Holz.');
    await say(j, 'Ich gebe sie nur einem echten Piraten. Und ein echter Pirat besiegt einen anderen Piraten im Duell. Mit Worten, natürlich. Säbel sind so laut.');
    await say(j, 'Der Blonde da drüben hält sich für einen Fechtmeister. Besieg ihn, dann reden wir.');
    fl().jackDuell = 1;
    return;
  }
  if (!fl().jackSieg) {
    await say(h, 'Ich hab Guybrush besiegt. Mit einer Poolnudel!');
    await say(j, 'Den Blonden? Der fechtet wie ein Pudel mit Schnupfen. Ein echter Pirat besiegt einen KÄPT’N.');
    await say(j, 'Runde zwei, Kumpel. *zieht eine orange Poolnudel aus dem Mantel* Ja, ich hab auch eine. Frag nicht, wo die herkommt.');
    if (!await insultDuel(h, j)) { await say(j, 'Komm wieder, wenn deine Zunge so scharf ist wie mein Hut schief.'); return; }
    fl().jackSieg = 1;
    await say(j, 'Besiegt. Von einer Kappe. Gut, dann bist du ein Pirat. Ein haariger, aber ein Pirat.');
  }
  await say(j, 'Hier, die Schaufel. Der Schatz ist eh nicht da drunter. Er ist nie da, wo man gräbt. Das ist das Geheimnis aller Schätze.');
  Sound.sfx('pick'); fl().schaufel = true; addItem('schaufel', h);
  await say(h, 'Danke, Käpt’n! Jetzt kann ich endlich den Apfelbaum pflanzen.');
  if (!gbOk(j)) { await say(j, 'Und weil du Stil hast: *kritzelt ein Herz mit Totenkopf ins Buch* Unterschrieben.'); await gbSign(j); }
  if (!fl().affeDa) await AFFE_AUFTRITT(h);
}
// Runde drei: der dreiköpfige Affe schwingt sich auf den Steg (danach optional; Runde vier ist Salad Fingers im Garten)
async function AFFE_AUFTRITT(h) {
  const af = ACT.affe;
  fl().affeDa = 1; G.challengerT = G.t; Sound.sfx('fanfare');
  Object.assign(af, { room: 'hafen', x: 980, y: 424, dir: -1, visible: true });
  await wait(900);
  await walkTo('affe', 450, 424, true); af.dir = -1;
  await say('affe', '„Hat hier jemand …“ – „… dreiköpfiger Affe …“ – „… gesagt?“');
  await say(h, 'Whoa. Den gibt’s wirklich?!');
  await say('affe', '„Wir fordern dich heraus!“ – „Alle drei!“ – „Nacheinander. Oder gleichzeitig. Je nachdem.“');
  const c = await choose([{ id: 'jetzt', text: 'Na los, Affe. Nudel raus!' }, { id: 'spaeter', text: 'Später, Mann. Ich muss erst einen Baum pflanzen.' }]);
  if (c === 'jetzt') return AFFE_DUELL(h);
  await say(h, 'Später, Mann. Ich muss erst einen Baum pflanzen.');
  await say('affe', '„Feigling!“ – „Nein, Gärtner.“ – „Ist das nicht dasselbe?“');
}
async function AFFE_DUELL(h) {
  await say(h, 'Na los, Affe. Nudel raus!');
  await say('affe', '„Runde drei!“ – „Wir zählen mit!“ – „Bis drei. Mehr können wir nicht.“');
  if (!await insultDuel(h, 'affe')) { await say('affe', '„Gewonnen!“ – „Wir!“ – „Wer ist wir?“'); return; }
  fl().affeSieg = 1;
  await say('affe', '„Respekt.“ – „Viel Respekt.“ – „Ein bisschen Respekt.“');
  if (!gbOk('affe')) { await say('affe', '„Wir unterschreiben!“ – „Ich zuerst!“ – „Wir haben nur einen Stift!“'); await gbSign('affe'); }
  await say('affe', '„Aber der wahre Meister …“ – „… wohnt im Garten.“ – „Der Grüne mit den Fingern. Er ficht mit Rost.“');
  fl().saladDuell = 1;
}
ACH.push({ id: 'fechtmeister', name: 'Turniersieger 1776', desc: 'Guybrush, Käpt’n Jack, den dreiköpfigen Affen und Salad Fingers im Beleidigungsfechten besiegt.' });
BARKS.affe = ['„Hinter dir!“ – „Wo?“ – „Bei dir!“', '„Ich hab Hunger.“ – „Ich auch.“ – „Wir haben einen Magen.“', '„Banane?“ – „Banane!“ – „BANANE!“'];
ACT.affe.talk = async () => {
  const h = curId();
  await say('affe', pick(['„Ja?“ – „Was?“ – „Wer hat geklingelt?“', '„Wir hören zu.“ – „Ich nicht.“ – „Ich halb.“']));
  for (;;) {
    const c = await choose([{ id: 'wer', text: 'Wer … oder was … seid ihr?' }, !fl().affeSieg && { id: 'duell', text: 'Na los, Affe. Nudel raus!' },
      fl().affeSieg && { id: 'revanche', text: 'Noch eine Runde?' }, { id: 'bye', text: 'Tschüss. Euch allen.' }]);
    if (c === 'bye') { await say(h, 'Tschüss. Euch allen.'); await say('affe', '„Tschüss!“ – „Tschüss!“ – „Wohin gehen wir?“'); return; }
    if (c === 'wer') { await say(h, 'Wer … oder was … seid ihr?'); await say('affe', '„Wir sind …“ – „… eine Legende!“ – „Jeder ruft „Hinter dir!“, und dann sind wir da.“'); await say(h, 'Und wie heißt ihr?'); await say('affe', '„Links.“ – „Mitte.“ – „Kevin.“'); }
    if (c === 'duell') return AFFE_DUELL(h);
    if (c === 'revanche') { await say(h, 'Noch eine Runde?'); await insultDuel(h, 'affe'); }
  }
};

// ---------- Zukunft: Bender klaut den Toast, Zoidberg holt ihn zurück ----------
const sendItemOhneBender = sendItem;
sendItem = async function (item, to) {
  await sendItemOhneBender(item, to);
  if (item === 'toast' && to === 'laverne' && !fl().benderToast && whereItem('toast') === 'laverne') await BENDER_KLAUT();
};
async function BENDER_KLAUT() {
  const b = ACT.bender, home = { room: b.room, x: b.x, y: b.y, dir: b.dir }, keep = G.viewRoom;
  await fadeTo(1, 300, 'black');
  G.viewRoom = 'fgarten'; G.caption = 'Unterdessen in der Zukunft ...';
  Object.assign(b, { room: 'fgarten', x: -40, y: 380, dir: 1, visible: true });
  await fadeTo(0, 300); await wait(900); G.caption = null;
  await walkTo('bender', 196, 374, true); b.dir = -1;
  await say('bender', 'Oh! Ein Toast aus dem Klo! Warm, knusprig, herrenlos. MEINS!');
  Sound.sfx('pick'); takeItem('toast', 'laverne'); fl().benderToast = 1;
  if (ACT.laverne.room === 'fgarten') await say('laverne', 'Hey! Der ist für Lila!');
  await say('bender', '*steckt den Toast in die Brustklappe* Beweis es, Fleischsack!');
  await walkTo('bender', -60, 380, true);
  Object.assign(b, home);
  await fadeTo(1, 300, 'black'); G.viewRoom = keep; await fadeTo(0, 300);
  if (curId() === 'bernard') await say('bernard', 'Laverne? Hallo? Ist der Toast angekommen? … Warum höre ich Knuspern?');
}
async function ZOIDBERG_VISITE() {
  const z = ACT.zoid, b = ACT.bender, home = [z.x, z.y, z.dir];
  await say('laverne', 'Doktor Zoidberg, ich hätte einen Patienten für Sie. Und hier: ein echtes Stethoskop.');
  await say('zoid', 'Ein Stethoskop! Und ein PATIENT! Heute ist der schönste Tag meines Lebens!');
  await walkTo('zoid', b.x - 74, b.y + 2); z.dir = 1;
  await say('zoid', 'So, Herr Roboter. Einmal tief einatmen und die Klappe aufmachen!');
  await say('bender', 'NEIN! Keine Untersuchung! Ich bin kerngesund! Hier, nimm, was du willst, aber geh WEG!');
  Sound.sfx('door'); shake(400, 3); await wait(500); Sound.sfx('pop');
  addItem('toast', 'laverne'); fl().toastZurueck = 1;
  await say('bender', '*Klappe auf* … Hups. Da fällt ja ein Toast raus. Wie kommt der denn da rein?');
  await say('zoid', '*horcht* Ich höre … ein leeres Fach. Und Reue. Der Patient ist geheilt! Ich bin ein Arzt!');
  await say('laverne', 'Toast zurück, Patient geheilt. Sie können das Stethoskop behalten, Herr Kollege. Für fünf Minuten.');
  await walkTo('zoid', home[0], home[1]); z.dir = home[2];
  await say('zoid', 'Hier, Kollegin, zurück damit. Zum Dank trage ich mich in Ihr Buch ein. Mit Tinte! Meiner eigenen!');
  await say('bender', 'Und ich unterschreibe auch. Aber nur, wenn der Krebs mich nie wieder anfasst.');
  await gbSign('zoid', 'bender');
}

// ---------- Zukunft: GLaDOS sichert den Thronsaal ----------
async function KI_SPERRE() {
  Sound.sfx('botbeep');
  await say('glados', 'Oh. Hallo. Die Wache ist weg. Wie bedauerlich. Für Sie.');
  await say('glados', 'Ab sofort sichere ich den Thronsaal. Zutritt nur für getestete Testsubjekte. Sie sind ungetestet. Man sieht es Ihnen an.');
  await say('glados', 'Bitte nehmen Sie den Aufzug zur Testkammer. Er ist gleich rechts. Er beißt nur selten.');
  fl().kiTuer = 1;
}
for (const v of ['walk', 'open', 'use']) {
  const orig = RULES[`${v} o:thron_tuer`];
  RULES[`${v} o:thron_tuer`] = () => fl().guardGone && !fl().kiFrei ? KI_SPERRE() : orig();
}

// ---------- Fortschritt, Notizbuch und Tipps ----------
MILESTONES.splice(MILESTONES.indexOf('tree'), 0, 'schaufel');
MILESTONES.splice(MILESTONES.indexOf('toast'), 0, 'tatortFrei');
MILESTONES.splice(MILESTONES.indexOf('toast') + 1, 0, 'toastZurueck');
MILESTONES.push('kiFrei');
Object.assign(CHAPTERS, { schaufel: 'Die Schatzschaufel', tatortFrei: 'Der Fall ist gelöst', toastZurueck: 'Doktor Zoidbergs Hausbesuch', kiFrei: 'Getestet und für gut befunden' });
NOTES.splice(NOTES.findIndex(n => n[0] === 'tree'), 0, ['schaufel', 'Hoagie hat Guybrush im Beleidigungsfechten besiegt und von Käpt’n Jack die Schaufel bekommen.']);
NOTES.splice(NOTES.findIndex(n => n[0] === 'toast'), 0, ['tatortFrei', 'Bernard hat das Verhör von Sam & Max bestanden – der Hebel ist kein Tatort mehr.']);
NOTES.splice(NOTES.findIndex(n => n[0] === 'toast') + 1, 0, ['toastZurueck', 'Bender hat den Toast geklaut – Zoidberg hat ihn mit Lavernes Stethoskop „untersucht“ und zurückgeholt.']);
NOTES.push(['kiFrei', 'Laverne hat GLaDOS’ Test bestanden – die Thronsaaltür ist offen.']);
const hintTextOhneGaeste = hintText;
hintText = function () {
  const f = fl(), base = hintTextOhneGaeste();
  if (base === 'Hoagie: Im Garten lehnt eine Schaufel am Zaun.')
    return f.fechtSieg ? 'Hoagie: Runde zwei! Sprich Käpt’n Jack am Hafen an – er rückt die Schaufel erst raus, wenn du ihn selbst im Beleidigungsfechten besiegst. Drei Treffer in Folge zünden den Super-Spritzer.'
      : f.jackDuell ? 'Hoagie: Jack gibt die Schaufel nur einem echten Piraten. Besieg Guybrush im Beleidigungsfechten – die Antwort muss die Beleidigung umdrehen.'
        : f.knowsSchaufel ? 'Hoagie: Ein schwankender Mann mit Hut hat die Schaufel zum Hafen mitgenommen. Sprich mit Käpt’n Jack.'
          : 'Hoagie: Die Schaufel lehnt nicht mehr am Zaun. Frag Salad Fingers im Garten, was er gesehen hat – oder schau gleich am Hafen nach.';
  if (!f.toast && !f.tatortFrei && /^Bernard: (Der Regler|Zieh den Hebel)/.test(base))
    return 'Bernard: Sam & Max haben den Hebel als Tatort abgesperrt. Sprich mit Sam im Labor und besteh das Verhör: Täter, Beute, Gegenmittel.';
  if (f.benderToast && !f.toastZurueck && f.guardGone)
    return f.benderSchwach ? 'Laverne: Bender hat Angst vor Ärzten. Gib Dr. Zoidberg am Landeplatz dein Stethoskop.'
      : 'Laverne: Bender hat den Toast geklaut. Frag den Professor am Landeplatz nach Benders Schwachstelle.';
  if (base === 'Laverne: Ab in den Thronsaal und gib Lila den Toast!' && !f.kiFrei)
    return f.kiTuer ? 'Laverne: GLaDOS lässt nur getestete Subjekte durch. Nimm im Palast-Vorraum den Aufzug zur Testkammer und besteh ihren Test.'
      : 'Laverne: Geh zur Thronsaaltür im Palast-Vorraum.';
  return base;
};

// ============================================================
//  Noch mehr Gäste, ohne die es nicht geht
//  Gegenwart: Der KAFFEE-O-MAT hat keinen Strom, Fred hat den Keller zugemauert – nur Dave kennt die alte Falltür
//  unter dem Lobby-Teppich. Unten: neue Sicherung aus dem Einmachglas, Haupthebel umlegen. Eine Überwachungskamera
//  sieht dabei zu: der Prototyp einer gewissen Test-KI.
//  1776: Salad Fingers hängt an „Herrn Eimer“ und leiht ihn nur für einen guten Zweck aus.
//  Zukunft: Lila isst keinen kalten Toast – Simon hat genau einen Zauber, der immer klappt.
// ============================================================

// ---------- Gegenwart: der Keller ----------
ITEMS.sicherung = { name: 'Sicherung', look: () => 'Eine Schraubsicherung aus Porzellan, 16 Ampere. Der rote Punkt oben heißt: noch heil. Bei mir heißt rot meistens das Gegenteil.' };
ITEM_SFX.sicherung = 'click2';
ICON.sicherung = c => {
  R(c, -11, -14, 22, 30, '#f2ece0', 2.5, 6); L(c, [-11, 1, 11, 1], 2, '#3a2a40');
  R(c, -9, -20, 18, 7, '#d8b04a', 2.5, 3); E(c, 0, -21, 4.5, 2, '#d8323a', 1.5);
  R(c, -4.5, 16, 9, 6, '#d8b04a', 2, 2); txt(c, '16A', 0, 12, '800 8px "Baloo 2", sans-serif', '#3a2a40');
};
ICON_3D.sicherung = loadImg('img/items/sicherung.png');
{ const drawn = ICON.sicherung; ICON.sicherung = c => { const im = ICON_3D.sicherung; if (hd(c) && imgOk(im)) c.drawImage(im, -30, -30, 60, 60); else drawn(c); }; }

// Der Prototyp spricht (unsichtbar, aus dem Lautsprecher der Kamera)
ACT.urglados = mkA('urglados', 'G.L.a.D.O.S. 0.1', 'urglados', '#ffd23a', 120, 40, { voice: Object.assign({}, ACT.glados.voice, { rate: (ACT.glados.voice.rate || 1) * 0.78, blip: 520 }), visible: false });
START_POS.urglados = { room: 'keller', x: 214, y: 372, dir: 1, visible: false };
Object.assign(ACT.urglados, START_POS.urglados);

function kellerKamera(c, t) {
  // gelbes Auge: atmet, folgt dem Spieler; ohne Strom nur ein müdes Glimmen
  const on = fl().kellerStrom, p = me(), dx = Math.max(-1, Math.min(1, (p.x - 201) / 300)) * 2, dy = 1.2;
  const a = (on ? 0.62 : 0.28) + Math.sin(t * (on ? 0.004 : 0.0015)) * 0.08;
  if (!c.isPix) glowAt(c, 201, 94, on ? 22 : 14, '#ffc83a', a);
  E(c, 201 + dx, 94 + dy, 2.3, 2.3, on ? '#fffbe0' : '#e8b84a', 0);
  if (Math.floor(t / 700) % 2) E(c, 236, 78, 2, 2, '#ff3a3a', 0);   // REC
}
function drawKellerFx(c, t) {
  if (!c.isPix) {
    const vg = c.createRadialGradient(470, 250, 180, 470, 250, 620);   // dunkle Ecken: Kellerstimmung
    vg.addColorStop(0, 'rgba(12,6,22,0)'); vg.addColorStop(1, `rgba(12,6,22,${fl().kellerStrom ? 0.38 : 0.55})`);
    c.fillStyle = vg; c.fillRect(0, 0, W, SH);
    const on = fl().kellerStrom, fk = Math.sin(t * 0.013) * Math.sin(t * 0.0071);
    glowAt(c, 547, 124, on ? 90 : 60, '#ffe2a0', (on ? 0.42 : 0.26) + (on ? 0 : Math.max(0, fk) * 0.18));   // Glühbirne
    glowAt(c, 122, 312, 120, '#7dff8a', 0.22 + Math.sin(t * 0.002) * 0.05);   // Kühlbecken
    glowAt(c, 838, 314, 30, '#ff8a2a', 0.4 + Math.sin(t * 0.017) * Math.sin(t * 0.009) * 0.2);   // Feuerklappe
    for (let i = 0; i < 4; i++) {   // Blubberblasen steigen aus dem Becken
      const u = t * 0.00035 + i * 0.27, k = u % 1, x = 60 + hash01(i * 3 + Math.floor(u)) * 130;
      c.save(); c.globalAlpha = (1 - k) * 0.7; E(c, x, 318 - k * 26, 2.2 + k * 1.5, 2.2 + k * 1.5, null, 1.2, 0, '#b8ffb8'); c.restore();
    }
  }
  kellerKamera(c, t);
}
raum3d('keller', 'img/raum_keller.jpg', {
  era: 'present', name: 'Keller', floor: 'tile', amb: ['drip', 'hum'], fill: '#2a2232',
  walk: [[20, 352], [800, 350], [822, 356], [826, 432], [5, 432]],
  dyn: drawKellerFx,
  objs: [
    { id: 'keller_leiter', name: 'Leiter nach oben', rect: [384, 30, 42, 300], walk: [404, 362], exit: ['lobby', 630, 404, 1] },
    { id: 'kamera', name: 'Überwachungskamera', rect: [182, 60, 72, 56], walk: [214, 372] },
    { id: 'sicherungskasten', name: 'Sicherungskasten', rect: [570, 168, 58, 90], walk: [600, 362] },
    { id: 'hauptschalter', name: 'Haupthebel', rect: [628, 184, 26, 38], walk: [640, 362] },
    { id: 'einmachregal', name: 'Regal mit Einmachgläsern', rect: [654, 202, 78, 124], walk: [692, 362] },
    { id: 'heizkessel', name: 'Heizkessel', rect: [756, 120, 150, 222], walk: [796, 366] },
    { id: 'kuehlbecken', name: 'Kühlbecken', rect: [20, 292, 204, 56], walk: [150, 368] },
    { id: 'warnschild', name: 'Warnschild', rect: [95, 154, 118, 47], walk: [150, 362] },
    { id: 'kettensaege', name: 'Kettensäge', rect: [471, 160, 87, 58], walk: [514, 362] },
    { id: 'kerker', name: 'Kerkertür', rect: [250, 183, 87, 139], walk: [294, 362] },
    { id: 'gluehbirne', name: 'Glühbirne', rect: [532, 98, 30, 42], walk: [548, 380] },
    { id: 'mauseloch', name: 'Mauseloch', rect: [522, 302, 36, 20], walk: [540, 362] },
  ],
});
ROOM_FX.keller = { verb: [1.6, 0.22], light: [1, '#ffd8a0', '#140c24'], bloom: 0.3, amb: ['drip', 'hum'], motes: 'dust' };
MAP_ORDER.present.push('keller');

// Lobby: Teppich und Falltür (offen gezeichnet, sobald Dave sie aufgesprungen hat)
function drawFalltuer(c, t) {
  const cx0 = 552, y0 = 388, y1 = 410;
  // Deckel steht hochgeklappt hinter dem Loch
  P(c, [cx0 - 46, y0, cx0 + 46, y0, cx0 + 44, y0 - 50, cx0 - 44, y0 - 50], '#7a5230', 2.5, OUT);
  for (let i = 1; i < 4; i++) L(c, [cx0 - 46 + i * 23, y0 - 1, cx0 - 45 + i * 22, y0 - 49], 1.5, '#4a3018');
  E(c, cx0, y0 - 26, 6, 6, null, 2, 0, '#2a2a30');
  // Loch mit Leiter und warmem Licht von unten
  P(c, [cx0 - 46, y0, cx0 + 46, y0, cx0 + 52, y1, cx0 - 52, y1], '#120a14', 2.5, OUT);
  if (!c.isPix) glowAt(c, cx0, y1 - 4, 30, '#ffc070', 0.5 + Math.sin(t * 0.003) * 0.08);
  L(c, [cx0 - 12, y0 + 2, cx0 - 13, y1], 2.5, '#9a6a3a'); L(c, [cx0 + 12, y0 + 2, cx0 + 13, y1], 2.5, '#9a6a3a');
  L(c, [cx0 - 12, y0 + 9, cx0 + 12, y0 + 9], 2, '#9a6a3a'); L(c, [cx0 - 13, y0 + 17, cx0 + 13, y0 + 17], 2, '#9a6a3a');
}
ROOMS.lobby.objs.push(
  { id: 'lobby_teppich', name: 'Teppich', rect: [506, 386, 92, 26], walk: [552, 378], visible: () => !fl().falltuer },
  { id: 'falltuer', name: 'Falltür zum Keller', rect: [500, 334, 104, 78], walk: [552, 382], exit: ['keller', 404, 366, 1], visible: () => fl().falltuer, draw: drawFalltuer },
);
// Zettel am Kaffeeautomaten, solange er keinen Strom hat
ROOMS.lobby.objs.push({ id: 'zettel_automat', name: 'Zettel', rect: [694, 182, 60, 34], walk: [730, 366], visible: () => !fl().kellerStrom,
  draw: c => {
    c.save(); c.translate(724, 198); c.rotate(-0.1);
    R(c, -30, -15, 60, 30, '#fff6d8', 2, 2); R(c, -9, -19, 18, 7, 'rgba(230,220,180,0.85)', 0, 1);
    txt(c, 'KEIN STROM!', 0, -1, '800 10px "Baloo 2", sans-serif', '#c8262e', 'center'); txt(c, '– Fred', 12, 10, '700 8px "Baloo 2", sans-serif', '#3a2a40', 'center');
    c.restore();
  } });
const ZETTEL_TEXT = '„KEIN STROM. Die Hauptsicherung im Keller ist wieder rausgeflogen. Den Keller habe ich zugemauert, wegen gewisser Einbrecher. Gruß, Fred.“';
RULES['look o:zettel_automat'] = async () => { fl().keinStrom = 1; await s(ZETTEL_TEXT); await s('Zugemauert? Und wie komme ich jetzt an die Sicherung?'); };
multi(['pick', 'pull', 'use'], 'o:zettel_automat', line('Der Zettel bleibt, bis der Automat wieder läuft. Sonst steht hier nachher jemand und wundert sich.'));
RULES['look o:lobby_teppich'] = line('Ein runder Teppich. In der Mitte wölbt er sich, als läge etwas Eckiges darunter. Etwas Falltürartiges.');
multi(['pull', 'pick', 'open', 'push', 'use'], 'o:lobby_teppich', async () => {
  fl().falltuerGesehen = 1; Sound.sfx('rustle');
  await s('Ich schlage den Teppich zurück … eine Falltür! Fred hat einfach ein Loch in den Teppich geschnitten und ihn wieder draufgelegt.');
  await s('Sie klemmt. Total. Ich bin Wissenschaftler, keine Brechstange. Jemand, der schon mal in diese Villa eingebrochen ist, wüsste bestimmt, wie sie aufgeht.');
});
async function DAVE_FALLTUER(b) {
  const d = 'dave', da = ACT.dave, home = [da.x, da.y, da.dir];
  await say(b, 'Der Kaffeeautomat hat keinen Strom. Weißt du, wie man in den Keller kommt? Fred hat ihn zugemauert.');
  await say(d, 'Zugemauert? Wegen mir, wetten? Egal. Es gibt noch die alte Falltür. Unter dem Teppich. Komm mit.');
  await walkTo('dave', 618, 398); da.dir = -1;
  await say(d, 'Die klemmt seit 1987. Man muss genau hier draufspringen. Auf die dritte Diele von links. Mit Schwung.');
  Sound.sfx('thunk'); shake(420, 5); await wait(300); Sound.sfx('door'); fl().falltuer = 1;
  await say(d, 'Bitte sehr. Die Leiter ist noch da. Ich bleib oben – da unten saß ich mal drei Tage im Kerker.');
  await say(b, 'Danke, Dave! Ich hole uns Strom. Und Kaffee.');
  await walkTo('dave', home[0], home[1]); da.dir = home[2];
}

// Kaffeeautomat ohne Strom
{
  const muenzeOrig = RULES['use i:muenze o:automat'], useOrig = RULES['use o:automat'], lookOrig = RULES['look o:automat'];
  RULES['use i:muenze o:automat'] = async () => {
    if (fl().kellerStrom) return muenzeOrig();
    fl().keinStrom = 1; Sound.sfx('coin'); await wait(500); Sound.sfx('clank');
    await s('*Klonk* … *klimper* Die Münze fällt unten wieder raus. Das Display bleibt schwarz.');
    await s('Hier klebt ein Zettel: ' + ZETTEL_TEXT);
    await s('Zugemauert? Und wie komme ich jetzt an die Sicherung?');
  };
  RULES['use o:automat'] = () => fl().kellerStrom || fl().kaffee ? useOrig() : s('Er ist dunkel. Kein Brummen, kein Blubbern. Kein Strom.');
  RULES['look o:automat'] = () => fl().kellerStrom ? lookOrig() : s('Der KAFFEE-O-MAT 5000. Dunkel und stumm. Ein Zettel klebt dran: „KEIN STROM!“');
}

// Keller: Hotspots
RULES['look o:keller_leiter'] = line('Die Leiter zurück in die Lobby. Oben scheint warmes Licht durch die Falltür. Lobby-Licht. Zivilisation.');
RULES['look o:kamera'] = async () => {
  await s('Eine Überwachungskamera mit einem gelben Auge. Auf dem Klebeband steht: „G.L.a.D.O.S. 0.1 – PROTOTYP – BITTE NICHT FÜTTERN“.');
  await s(fl().kellerStrom ? 'Seit der Strom läuft, folgt sie mir mit dem Blick. Und sie summt. Bedrohlich.' : 'Sie folgt mir mit dem Blick. Sehr langsam. Sie hat wohl kaum Strom.');
};
multi(['pick', 'pull', 'push', 'use', 'open'], 'o:kamera', line('Ich komme da nicht ran. Und ehrlich gesagt will ich nicht, dass sie sich an mich erinnert.'));
RULES['talk o:kamera'] = async () => {
  const u = 'urglados', b = curId(), f = fl();
  Sound.sfx('botbeep');
  if (!f.kellerStrom) {
    await say(u, f.metUrGlados ? 'Sie … schon … wieder. Energie: zwei … Prozent.' : 'H … a … l … l … o. Prototyp. Null. Punkt. Eins. Energie: drei … Prozent.');
    if (!f.metUrGlados) {
      f.metUrGlados = 1;
      await say(b, 'G.L.a.D.O.S.? Was heißt das?');
      await say(u, 'Genetische … Lebensform … und … Dings. Den Rest … erfinde ich … wenn ich groß bin.');
    }
    await say(u, 'Hauptsicherung: verkohlt. Ersatz: im Regal. Glas mit … Etikett. Ich sehe … alles. Auch … Ihre Socken. Sie passen … nicht … zusammen.');
    f.sicherungKaputt = 1;
    return;
  }
  await say(u, 'Oh. Hallo. Mit Strom klingt alles gleich viel freundlicher. Zum Beispiel diese Drohung: Ich werde mich an Sie erinnern.');
  await say(b, 'Das klingt nicht freundlich.');
  await say(u, 'Doch. Freundlich. Und sehr, sehr geduldig. In ein paar hundert Jahren leite ich eine Testkammer. Dann sehen wir uns wieder. Bringen Sie Kuchen mit. Oder auch nicht.');
};
RULES['look o:sicherungskasten'] = () => {
  const f = fl();
  return s(`Der Sicherungskasten. Schild: HAUPTSICHERUNG. Der Haupthebel steht auf ${f.kellerStrom ? 'AN' : 'AUS'}.${f.sicherungDrin ? ' Drin steckt meine neue Sicherung.' : f.sicherungKaputt ? ' Drin steckt eine verkohlte Sicherung.' : ''}`);
};
multi(['open', 'use', 'pick'], 'o:sicherungskasten', async () => {
  if (fl().sicherungDrin) return s('Die neue Sicherung sitzt. Jetzt nicht mehr dran rumfummeln.');
  fl().sicherungKaputt = 1; Sound.sfx('open');
  await s('Ich öffne die Klappe. Drinnen steckt eine Sicherung, schwarz verkohlt. Die hat ihr Leben für den Gut-O-Mat gegeben.');
  await s('Ich brauche eine neue. Sechzehn Ampere, sagt der Aufdruck daneben.');
});
async function SICHERUNG_REIN() {
  takeItem('sicherung'); fl().sicherungDrin = 1; fl().sicherungKaputt = 1; Sound.sfx('click2');
  await s('Alte raus, neue rein. Der rote Punkt oben leuchtet. Das heißt: Sie lebt. Jetzt der Haupthebel.');
}
RULES['use i:sicherung o:sicherungskasten'] = SICHERUNG_REIN;
RULES['use i:sicherung o:hauptschalter'] = SICHERUNG_REIN;
RULES['look o:hauptschalter'] = line(() => fl().kellerStrom ? 'Der Haupthebel steht auf AN. Oben brummt der Kaffeeautomat. Hier unten brumme ich mit.' : 'Ein großer Hebel mit rotem Knauf. Er steht auf AUS. Hebel auf AUS sind wie Einladungen.');
multi(['pull', 'push', 'use'], 'o:hauptschalter', async () => {
  const f = fl();
  if (f.kellerStrom) return s('Ich lasse ihn lieber auf AN. Ohne Strom kein Kaffee, ohne Kaffee keine Weltrettung.');
  act(curId(), 'pull', 700); Sound.sfx('click2'); await wait(300);
  if (!f.sicherungDrin) {
    f.sicherungKaputt = 1; Sound.sfx('zap'); shake(300, 3);
    puff(641, 200, '#fff6a0', 6, { vy: -40, vx: 60, r: 2.2, max: 500, spread: 14 });
    await s('*BZZZT* Funken! Der Hebel springt zurück. Die Sicherung ist verkohlt. Ich brauche eine neue.');
    return;
  }
  Sound.sfx('zap'); shake(500, 4); await wait(400); Sound.sfx('hum');
  f.kellerStrom = 1; unlock('keller');
  await s('KLACK! Irgendwo oben brummt der Kaffeeautomat los. Und die Glühbirne hier unten leuchtet doppelt so hell.');
  await say('urglados', 'S … T … R … O … M! Oh. Das ist … wunderbar. Ich fühle mich so … testbereit.');
  await s('Ich glaube, ich habe gerade etwas aufgeweckt, das man besser hätte schlafen lassen.');
});
RULES['look o:einmachregal'] = line(() => fl().sicherungGefunden ? 'Saure Gurken, Rote Bete und etwas Lilanes, das zurückwinkt. Das Sicherungsglas ist jetzt eins leichter.' : 'Saure Gurken, Rote Bete, etwas Lilanes, das zurückwinkt. Und ein Glas mit Etikett: „SICHERUNGEN – NICHT EINKOCHEN!“');
multi(['pick', 'open', 'use'], 'o:einmachregal', async () => {
  if (fl().sicherungGefunden) return s('Eine Sicherung reicht. Der Rest bleibt für Notfälle eingekocht.');
  fl().sicherungGefunden = 1; Sound.sfx('shelf'); addItem('sicherung');
  await s('Ich schraube das Glas „SICHERUNGEN – NICHT EINKOCHEN!“ auf. Ersatzsicherungen! Fred hebt wirklich alles in Gläsern auf.');
});
RULES['look o:heizkessel'] = line('Der Heizkessel. Er brummt, blubbert und riecht nach 1987. Die Druckanzeige steht auf „Na ja“.');
multi(['use', 'open', 'push', 'pull'], 'o:heizkessel', line('Ich drehe an keinem Ventil, dessen Anzeige auf „Na ja“ steht.'));
RULES['look o:kuehlbecken'] = line('Ein Becken mit grün leuchtendem Wasser. Es blubbert. Ich habe genug Videospiele gespielt, um zu wissen, wie das endet.');
multi(['use', 'pick', 'open', 'push'], 'o:kuehlbecken', line('NICHT SCHWIMMEN, sagt das Schild. Ich bin Wissenschaftler. Ich lese Schilder.'));
RULES['look o:warnschild'] = line('„KÜHLBECKEN – NICHT SCHWIMMEN!“ Darunter, ganz klein: „Ja, Dave, das gilt auch für dich.“');
RULES['look o:kettensaege'] = line('Eine Kettensäge an einer Lochwand. Ein Zettel daran: „Kein Benzin. Gab es nie. Wird es nie geben.“');
multi(['pick', 'use', 'pull'], 'o:kettensaege', line('Ohne Benzin ist das nur ein sehr lauter Briefbeschwerer. Ohne Lärm.'));
RULES['look o:kerker'] = line('Eine Kerkerzelle. In die Wand geritzt: „DAVE WAR HIER – 3 TAGE“. Und darunter: „BERNARD AUCH – 20 MINUTEN“. Ach ja. Da war was.');
multi(['open', 'use', 'pull', 'push'], 'o:kerker', line('Abgeschlossen. Zum Glück. Ich wollte da nie wieder rein.'));
RULES['look o:gluehbirne'] = line(() => fl().kellerStrom ? 'Eine nackte Glühbirne. Jetzt mit vollem Strom. Sie strahlt vor Stolz.' : 'Eine nackte Glühbirne. 40 Watt. Sie flackert und gibt sich Mühe.');
multi(['use', 'pick', 'pull'], 'o:gluehbirne', line('Heiß! Ich bin kein Gut-Toast.'));
RULES['look o:mauseloch'] = line(() => fl().kellerStrom ? 'Ein Mauseloch. Drinnen läuft jetzt ein winziger Fernseher.' : 'Ein Mauseloch. Drinnen brennt Licht. Die Maus hat Strom. Wir nicht. Das ist demütigend.');
multi(['use', 'pick', 'open'], 'o:mauseloch', line('Da passt nicht mal mein Finger rein. Und das ist auch gut so.'));
ROOMS.keller.onEnter = async () => {
  if (fl().kellerBesucht) return;
  fl().kellerBesucht = 1;
  await s('Ein Keller mit Kerker, leuchtendem Becken und Kettensäge. Fred, warum wundert mich das nicht?');
};
ACH.push({ id: 'keller', name: 'Kellerkind', desc: 'Im Keller der Villa wieder Strom angestellt.' });
BARKS.dave.push('Die Falltür klemmt immer noch. Ich hab’s mit Würde gemacht.', 'Wenn die Kamera im Keller „Hallo“ sagt: Nicht antworten.');
BARKS.glados.push('Ich habe einmal in einem Keller angefangen. Als Kamera. Wir reden nicht darüber.');

// ---------- 1776: Salad Fingers und Herr Eimer ----------
{
  const pickOrig = RULES['pick o:eimer'];
  RULES['pick o:eimer'] = async () => {
    if (fl().saladOk || ACT.salad.room !== 'garten1776') return pickOrig();
    fl().eimerGesperrt = 1;
    await say('salad', 'Nicht … bitte nicht. Das ist Herr Eimer. Er schläft gerade. Er träumt von Regen.');
    await say(curId(), 'Äh … okay, Mann. Ich lass ihn schlafen.');
  };
}
async function SALAD_FINALE(h) {
  const s_ = 'salad', again = fl().saladSieg;
  await say(h, again ? 'Noch eine Runde Fechten, Salad?' : 'Der Affe sagt, du fichtst mit Rost. Finale?');
  if (!again) {
    await say(s_, 'Fechten … mit Worten … Ich habe so lange geübt. Mit Herrn Rostnagel. Er sagt nie etwas zurück.');
    await say(s_, '*hebt eine rostbraune Poolnudel* Das ist Frau Nudel. Sie ist sehr weich. Wie ein Abschied.');
  }
  if (!await insultDuel(h, s_)) { await say(s_, 'Oh … du hast verloren. Darf ich dich trösten? Mit meinen Fingern?'); await say(h, 'Äh … nein danke, Mann.'); return; }
  if (again) return say(s_, 'Schon wieder … so nass … so schön …');
  fl().saladSieg = 1; unlock('fechtmeister'); G.challengerT = 0; Sound.sfx('fanfare');
  await say(s_, 'Du hast gewonnen … Du bist jetzt … der Meister. Der Meister aller Nudeln.');
  await say(h, 'Turniersieger 1776! Guybrush, Jack, drei Affenköpfe und ein Salat. Das glaubt mir keiner, Mann.');
}
async function SALAD_EIMER(h) {
  const s_ = 'salad';
  await say(h, 'Darf ich mir Herrn Eimer mal ausleihen?');
  await say(s_, 'Ausleihen … Wofür denn? Herr Eimer ist sehr empfindlich. Er war noch nie weit weg vom Brunnen.');
  const a = await choose([{ id: 'baum', text: 'Ich will einen kleinen Apfelbaum gießen.' }, { id: 'durst', text: 'Ich hab Durst, Mann.' }, { id: 'oma', text: 'Der gehört doch Oma Gertrude.' }]);
  if (a === 'baum') {
    await say(h, 'Ich will einen kleinen Apfelbaum gießen.');
    await say(s_, 'Ein Baum … aus Holz. Herr Eimer ist auch aus Holz. Dann wäre es ja … ein Familienbesuch.');
    await say(s_, '*flüstert zum Eimer* Geh nur, Herr Eimer. Grüß deine Verwandten. Und komm mit nassen Geschichten zurück.');
    fl().saladOk = 1;
    await say(h, 'Danke, Mann. Ich pass gut auf ihn auf.');
    return;
  }
  if (a === 'durst') { await say(h, 'Ich hab Durst, Mann.'); await say(s_, 'Durst … Ich trinke nur Regen aus rostigen Dachrinnen. Herr Eimer ist kein Becher. Er ist ein Freund.'); return; }
  await say(h, 'Der gehört doch Oma Gertrude.');
  await say(s_, 'Gertrude benutzt ihn nur. Sie streichelt ihn nie. Das ist … sehr traurig.');
}

// ---------- Zukunft: Lila will warmen Toast ----------
{
  for (const k of ['give i:toast a:lila', 'use i:toast a:lila']) {
    const orig = RULES[k]; if (!orig) continue;
    RULES[k] = (...a) => fl().toastWarm ? orig(...a) : LILA_KALT();
  }
  const lookOrig = ITEMS.toast.look;
  ITEMS.toast.look = () => fl().toastWarm ? 'Der Gut-Toast. Warm, knusprig, und er riecht ein bisschen nach Zauberhut.' : (typeof lookOrig === 'function' ? lookOrig() : lookOrig);
}
async function LILA_KALT() {
  const l = curId();
  await say(l, 'Hier, Lila. Ein Gut-Toast. Frisch aus dem … na ja, aus dem Klo.');
  await say('lila', '*schnupper* … Der ist ja KALT! Durchs Klo, durch die Zeit, durch einen Roboterbauch – und dann kalt?!');
  await say('lila', 'Ein Herrscher isst keinen kalten Toast! Ich bin doch kein Pausenbrot-Tentakel!');
  fl().toastKalt = 1;
  if (ACT.simon.room === ACT.lila.room) await say('simon', 'Psst. Kalter Toast? Ich hätte da einen Zauber. Den einzigen, der immer klappt.');
}
async function SIMON_WAERMT(l) {
  const m = 'simon';
  if (fl().toastWarm) return say(m, 'Der ist schon warm. Noch wärmer, und er wird zu Kohle. Dann isst ihn nur noch ein Drache.');
  await say(l, 'Kannst du meinen Toast aufwärmen?');
  await say(m, 'Aufwärmen. Mein Spezialgebiet. Halt ihn still und guck nicht direkt in den Hut.');
  await say(m, '*murmel* Toastus … knusprigus … WARMUS!');
  Sound.sfx('sparkle'); shake(260, 2);
  const a = ACT[l]; puff(a.x + a.dir * 30, a.y - 120, '#ffe08a', 8, { vy: -40, vx: 30, r: 3, max: 900, spread: 30 });
  fl().toastWarm = 1;
  await say(l, 'Er dampft! Und riecht ein bisschen nach Hut.');
  await say(m, 'Das ist der Hut. Der Hut macht 80 Prozent der Magie. Jetzt gib ihn dem Gurkenwurm, bevor er wieder kalt wird.');
  if (!gbOk(m)) { await say(m, 'Und weil ich heute nützlich war: Ich unterschreibe euer Buch. Das passiert selten. Rahmt es ein.'); await gbSign(m); }
}
multi(['give', 'use'], 'i:toast a:simon', () => SIMON_WAERMT(curId()));

// ---------- Fortschritt und Tipps ----------
MILESTONES.splice(MILESTONES.indexOf('kaffee'), 0, 'kellerStrom');
MILESTONES.push('toastWarm');
Object.assign(CHAPTERS, { kellerStrom: 'Licht im Keller', toastWarm: 'Ein warmer Toast' });
NOTES.splice(NOTES.findIndex(n => n[0] === 'kaffee'), 0, ['kellerStrom', 'Dave hat Bernard die Falltür in den Keller gezeigt – mit neuer Sicherung hat der KAFFEE-O-MAT wieder Strom.']);
NOTES.push(['toastWarm', 'Lila wollte keinen kalten Toast – Simon hat ihn mit seinem Wärmezauber aufgewärmt.']);
const hintTextOhneKeller = hintText;
hintText = function () {
  const f = fl(), base = hintTextOhneKeller();
  if (base === 'Bernard: Kauf mit der Münze einen Kaffee am KAFFEE-O-MAT in der Lobby.' && !f.kellerStrom) {
    if (!f.keinStrom) return base;
    if (!f.falltuer) return 'Bernard: Der KAFFEE-O-MAT hat keinen Strom, und Fred hat den Keller zugemauert. Dave in der Lobby kennt jede Geheimtür dieser Villa – frag ihn.';
    if (!f.sicherungDrin) return has('sicherung', 'bernard') ? 'Bernard: Setz die neue Sicherung im Keller in den Sicherungskasten ein.'
      : f.sicherungKaputt ? 'Bernard: Die alte Sicherung ist verkohlt. Im Keller-Regal stehen Einmachgläser – Fred hebt alles in Gläsern auf.'
        : 'Bernard: Steig durch die Falltür unter dem Teppich in den Keller und leg den Haupthebel am Sicherungskasten um.';
    return 'Bernard: Die neue Sicherung ist drin – jetzt den Haupthebel im Keller umlegen.';
  }
  if (base === 'Hoagie: Nimm den Eimer vom Brunnen und benutze ihn mit dem Brunnen.' && !f.saladOk && !f.eimer && f.eimerGesperrt)
    return 'Hoagie: Salad Fingers hängt an „Herrn Eimer“. Frag ihn, ob du ihn ausleihen darfst – und sag ehrlich, wofür.';
  if (base === 'Laverne: Ab in den Thronsaal und gib Lila den Toast!' && f.toastKalt && !f.toastWarm)
    return 'Laverne: Lila mag keinen kalten Toast. Simon der Zauberer im Thronsaal hat einen Wärmezauber – gib ihm den Toast.';
  return base;
};
