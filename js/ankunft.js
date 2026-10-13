'use strict';
// ============================================================
//  Tentakel-Toast – Ankunft vor der Villa (js/ankunft.js)
//  Hommage an den Vorspann von Super Mario 64: Statt Lakitu filmt das Kamera-Tentakel von seiner Wolke aus. Im
//  Echtzeit-3D fliegt seine Kamera einmal um die ganze Villa (Sucherbild mit REC), dann landet der Blick beim Tourbus
//  der Helden, und Hoagie, Laverne und Bernard purzeln heraus. Danach geht es ins Labor (story.js, INTRO).
//  Der Vorplatz bleibt ein Raum: durch die Haustür der Lobby kommt man wieder hinaus.
//  Szene: art/blender/raum_build.py (build_auffahrt) – vorgerendertes Bild und img/3d/auffahrt.glb.
//  Musik: js/audio.js, Thema „ankunft“ (eigene Komposition).
// ============================================================

// ---------- der Raum ----------
raum3d('auffahrt', 'img/raum_auffahrt.jpg', {
  era: 'present', name: 'Vor der Villa', floor: 'stone', amb: ['crickets', 'wind', 'owl'], fill: '#3b2a6e',
  // Vorplatz bis an die Stufen (Blender y 8 … 14,3); Maßstab wie die Kamera: Horizont 185, Maßstab 1 an der Vorderkante
  walk: [[8, 324], [952, 324], [958, 432], [2, 432]], yTop: 322, sMin: (322 - 185) / (432 - 185),
  objs: [
    { id: 'haustuer_villa', name: 'Haustür', rect: [378, 75, 164, 182], walk: [462, 330], dv: 'walk', exit: ['lobby', 120, 420, 1],
      look: 'Die Haustür der Villa Edison. Zwei Flügel, zwei Klinken, null Klingel. Dr. Fred hält Klingeln für „einen Angriff auf die Konzentration“.' },
    { id: 'tourbus', name: 'Tourbus', rect: [86, 249, 406, 95], walk: [300, 352],
      look: 'Hoagies Tourbus. Auf dem Dachschild steht „TOAST WARS TOUR“. Die Tour bestand bisher aus einem Auftritt. In einer Garage. Vor drei Leuten. Zwei davon waren wir.' },
    { id: 'kamtent', name: 'Kamera-Tentakel', rect: [800, 10, 150, 150], walk: [820, 352],
      look: () => pick(['Das Kamera-Tentakel. Es filmt alles, was wir tun. Es sagt, man kann seinen Blick mit dem rechten Stick oder durch Ziehen drehen. Ich habe nicht gefragt.',
        'Das Kamera-Tentakel winkt mit der Linse. Auf seinem Barett steckt eine Fliegerbrille. Für Flüge. Auf einer Wolke. Klar.',
        'Es sagt: „Drück C oder den rechten Stick, dann bringe ich die Kamera wieder hinter dich.“ Ein Kameramann mit Kundendienst.']) },
    { id: 'villa_fassade', name: 'Villa Edison', rect: [0, 0, 960, 110],
      look: 'Die Villa Edison. Sie sieht aus, als hätte ein Architekt beim Zeichnen Schluckauf gehabt. Und dann noch einmal. Und dann ein Türmchen dazu.' },
  ],
});
ROOM_FX.auffahrt = { music: 'ankunft', verb: [0.4, 0.08], light: [-1, '#ffd2a0', '#3b2a6e'], bloom: 0.26, amb: ['crickets', 'wind', 'owl'], motes: 'firefly' };
if (typeof GRADE !== 'undefined') GRADE.auffahrt = ['#f0a070', 0.08];
// Lobby: Haustür nach draußen (vorne links, wo man hereinkommt)
ROOMS.lobby.objs.push({
  id: 'haustuer_lobby', name: 'Haustür', rect: [0, 300, 44, 132], walk: [26, 424], dv: 'walk', exit: ['auffahrt', 500, 336, 1],
  look: 'Die Haustür. Draußen steht noch unser Tourbus. Und vermutlich ein Tentakel mit Kamera.',
});

// ---------- Vorspann: die Ankunft ----------
// Kameraflug des Tentakels (Blender-Meter: Ort x, y, z und Blickziel): vom Himmel über dem Tor die Auffahrt hinunter,
// einmal um die Villa herum und zum Schluss tief hinunter zum Tourbus
// Bahn des Kamera-Tentakels (Blender-Meter): vom Anflugpunkt am Tor die Auffahrt hinauf, einmal um die Villa, dann zu
// seinem Platz rechts vom Bus; die Kamera folgt dicht dahinter und landet zum Schluss auf dem Bus
// Genüsslich wie in Super Mario 64: eine weite Ellipse um das Spukhaus (21 × 16 m, mit Kuppel 24 m hoch), über der
// Rückseite am höchsten; die Kamera schaut dabei immer zur Villa, das Tentakel fliegt vorne im Bild
const ANKUNFT_VILLA = [-1, 22, 9];
const ANKUNFT_FLUG = [
  [1.2, -31.2, 6.1], [0.6, -20, 7.5],
  ...Array.from({ length: 16 }, (_, k) => {
    const w = 0.2 + k * (Math.PI * 2 - 0.8) / 15;   // vorn → links → hinten → rechts → wieder vorn rechts
    return [ANKUNFT_VILLA[0] - 34 * Math.sin(w), ANKUNFT_VILLA[1] - 30 * Math.cos(w), 9 + 9 * Math.pow(Math.sin(w / 2), 2)];
  }),
  [8, 6.5, 4.6], [4.6, 9.4, 3.0],
];
const ANKUNFT_FLUG_ENDE = [7.4, 0.8, 2.5, -0.8, 11.2, 1.55];   // Schlussbild: Bus, Haustür und das Tentakel rechts
const ANKUNFT_FLUGZEIT = 34000;
const KT = async text => say(null, '​' + await Lang.tAsync('Kamera-Tentakel') + ': ' + await Lang.tAsync(text));   // Sprecher und Satz getrennt übersetzt
function ankunftTween(key, ziel, ms) {   // G.ankunft[key] weich auf ziel (Spielzeit, läuft mit dem Vorspann-Tempo mit)
  const A = G.ankunft; if (!A) return Promise.resolve();
  if (G.fast || G.skipAll) { A[key] = ziel; return Promise.resolve(); }
  const von = A[key] || 0, t0 = G.t;
  return new Promise(res => {
    const schritt = () => {
      if (!G.ankunft) return res();
      const k = Math.min(1, (G.t - t0) / ms); G.ankunft[key] = von + (ziel - von) * (1 - Math.pow(1 - k, 3));
      if (k >= 1 || G.skipAll) { G.ankunft[key] = ziel; return res(); }
      wait(16).then(schritt);   // auf der Spieluhr: Überspringen und Vorspulen wirken sofort
    };
    schritt();
  });
}
async function aussteigen(id, tuerX, x, y, mimik) {   // aus der Bustür ploppen, ein paar Schritte, Bus federt nach
  const a = ACT[id];
  Object.assign(a, { room: 'auffahrt', x: tuerX, y: 392, dir: x > tuerX ? 1 : -1, visible: true, target: null, walking: false });
  Sound.sfx('pop'); G.ankunft.hopsT = G.t;
  if (typeof puff === 'function') puff(tuerX, 380, '#e8dcc8', 6, { vy: 40, r: 3, max: 380, spread: 14 });
  if (mimik && typeof mimikStart === 'function') mimikStart(a, mimik);
  await walkTo(id, x, y);
}
async function ANKUNFT() {
  if (G.fast || !G.state) return;
  const helden = ['hoagie', 'laverne', 'bernard'], vorher = {};
  for (const id of helden) { const a = ACT[id]; vorher[id] = { room: a.room, x: a.x, y: a.y, dir: a.dir, visible: a.visible }; }
  const keep = G.viewRoom;
  G.inIntro = true;
  G.ankunft = { schiebe: 0, tuerV: 0, haustuer: 0, hopsT: 0, kt: 'weg', sucher: false };
  for (const id of helden) Object.assign(ACT[id], { room: 'auffahrt', visible: false, target: null, walking: false });
  G.viewRoom = 'auffahrt'; G.viewRoomLast = null; markVisit('auffahrt'); music();
  try {
    await warmRoom('auffahrt');
    await ankunft3dBereit(15000);
    const drei = typeof echt3dOn === 'function' && echt3dOn(ROOMS.auffahrt) && !!ECHT3D.mod.kameraflug;
    // erste Einstellung (wie Lakitu in Super Mario 64): das Kamera-Tentakel selbst schwebt auf seiner Wolke heran
    if (drei) { ECHT3D.mod.kameraflug('auffahrt', [[0, -36, 6.4, 1.2, -20, 7.2], [0.3, -35.6, 6.5, 1.2, -24, 6.6]], 5200, 40); G.ankunft.kt = 'anflug'; G.ankunft.anflugT0 = G.t; }
    G.titelKarte = { t0: G.t, dauer: 4200, text: 'Villa Edison. Am Abend …' };
    Sound.sfx('whoosh');
    await fadeTo(0, 900);
    await KT('Hallo und herzlich willkommen! Hier spricht das Kamera-Tentakel – live vor der Villa Edison!');
    // das Tentakel dreht ab und fliegt einmal um die Villa; die Kamera folgt ihm, es bleibt schön im Bild
    const flug = drei && ECHT3D.mod.kameraflug('auffahrt', ANKUNFT_FLUG, ANKUNFT_FLUGZEIT, 50, { folgen: true, ende: ANKUNFT_FLUG_ENDE, blick: ANKUNFT_VILLA });
    G.ankunft.kt = flug ? 'flug' : 'schweben'; Sound.sfx('whoosh');
    const t0 = G.t;
    await wait(1200);
    await KT('Ich bleibe den ganzen Abend an euch dran. Wer mag, dreht meinen Blick selbst: rechter Stick, Ziehen oder Wischen.');
    if (flug) {   // ein paar Worte zur Villa, während es hinten herum geht
      await wait(Math.max(0, ANKUNFT_FLUGZEIT * 0.3 - (G.t - t0)));
      await KT('Und da ist sie: die Villa Edison! Zwei Stockwerke, zwei Kamine, eine Kuppel – und kein einziger rechter Winkel.');
      await wait(Math.max(0, ANKUNFT_FLUGZEIT * 0.55 - (G.t - t0)));
      await KT('Hinten raus der Garten – und irgendwo da drin ein Labor, aus dem es schon wieder raucht.');
    }
    if (flug) await wait(Math.max(0, ANKUNFT_FLUGZEIT - (G.t - t0) - 1200));
    G.ankunft.kt = 'schweben';
    await KT('Achtung, da kommen sie! Ton läuft … Kamera läuft … und: Action!');
    // die Helden purzeln aus dem Tourbus
    Sound.sfx('door'); await ankunftTween('schiebe', 1, 650);
    await aussteigen('hoagie', 261, 508, 410, 'freude');
    await say('hoagie', 'Endstation! Alle aussteigen – die Tour ist hiermit offiziell vorbei.');
    await aussteigen('laverne', 261, 150, 412, 'schwindel');
    await say('laverne', 'Sieben Schlaglöcher. Ich habe jedes einzelne gezählt. Mit dem Kopf.');
    Sound.sfx('door'); await ankunftTween('tuerV', 1, 500);
    await aussteigen('bernard', 375, 625, 400, 'staunen');
    G.ankunft.sucher = false;
    if (flug) ECHT3D.mod.kameraflugEnde('auffahrt');   // Schnitt auf die Totale: Bus, Villa und Tentakel
    await say('bernard', 'Laut Brief erwartet uns Dr. Fred im Labor. „SOFORT!!!“ – mit drei Ausrufezeichen. Für seine Verhältnisse ist das fast höflich.');
    await say('hoagie', 'Alter. Guckt mal nach oben. Da filmt uns ein Tentakel. Von einer Wolke.');
    await say('laverne', 'Huhu, Kamera! Darf ich dich später füttern?');
    await KT('Nicht während der Aufnahme! Weiter so, ihr drei – ich bleibe dran!');
    await say('bernard', 'Na schön. Rein da, bevor es noch Autogramme will.');
    Sound.sfx('door'); ankunftTween('haustuer', 1, 900);
    await Promise.all([walkTo('bernard', 470, 330), walkTo('hoagie', 500, 332), walkTo('laverne', 440, 334)]);
    await fadeTo(1, 800, 'black');
  } finally {
    if (typeof ECHT3D !== 'undefined' && ECHT3D.mod && ECHT3D.mod.kameraflugEnde) ECHT3D.mod.kameraflugEnde('auffahrt');
    for (const id of helden) Object.assign(ACT[id], vorher[id], { target: null, walking: false });
    G.ankunft = null; G.titelKarte = null; G.viewRoom = keep; G.viewRoomLast = null; G.caption = null;
  }
}
// Vorspann: Prolog (Tentakel am Fluss) → Ankunft vor der Villa → Labor (story.js)
// Während der Prolog läuft, lädt im Hintergrund schon die 3D-Auffahrt (sonst wartet der Kameraflug auf das Laden)
function ankunftVorladen() {
  if (!G.settings.echt3d || G.settings.retro || typeof echt3dLoad !== 'function') return;
  echt3dLoad();
  const t0 = performance.now(), los = () => {
    if (ECHT3D.failed || performance.now() - t0 > 30000) return;
    if (ECHT3D.mod && ECHT3D.mod.ready) ECHT3D.mod.hasRoom('auffahrt'); else setTimeout(los, 300);
  };
  los();
}
function ankunft3dBereit(ms) {   // bis die Szene da ist (oder klar ist, dass es beim gemalten Bild bleibt)
  const t0 = performance.now();
  return new Promise(fertig => {
    const p = () => {
      const m = ECHT3D.mod;
      if (!G.settings.echt3d || G.settings.retro || ECHT3D.failed || G.skipAll || performance.now() - t0 > ms || (m && m.ready && (m.raumGeladen('auffahrt') || m.failed('auffahrt')))) return fertig();
      setTimeout(p, 100);
    };
    p();
  });
}
// „Szene überspringen“ gilt nur für die laufende Szene (Prolog, Ankunft, Labor); „Alles überspringen“ für den ganzen Vorspann
{ const prologOhneAnkunft = PROLOG; PROLOG = async function () {
  G.introAlles = false; ankunftVorladen();
  await prologOhneAnkunft();
  if (G.introAlles) return;
  G.skipAll = false; await ANKUNFT();
  if (!G.introAlles) G.skipAll = false;
}; }

// ---------- Sucherbild der Tentakel-Kamera ----------
function drawSucher() {
  const H2 = typeof VH !== 'undefined' ? VH : SH, rand = 46, w = W - rand * 2, h = H2 - rand * 2 - 30, x0 = rand, y0 = rand + 12;
  const sek = (G.t - (G.ankunft.t0 || (G.ankunft.t0 = G.t))) / 1000, bild = Math.floor(sek * 25) % 25;
  const tc = [0, Math.floor(sek / 60), Math.floor(sek % 60), bild].map(v => String(v).padStart(2, '0')).join(':');
  cx.save();
  cx.strokeStyle = 'rgba(255,255,255,0.85)'; cx.lineWidth = 3; cx.lineCap = 'round';
  for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x0 + w, y0, -1, 1], [x0, y0 + h, 1, -1], [x0 + w, y0 + h, -1, -1]]) {
    cx.beginPath(); cx.moveTo(x, y + dy * 34); cx.lineTo(x, y); cx.lineTo(x + dx * 34, y); cx.stroke();
  }
  cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(W / 2 - 14, y0 + h / 2); cx.lineTo(W / 2 + 14, y0 + h / 2); cx.moveTo(W / 2, y0 + h / 2 - 14); cx.lineTo(W / 2, y0 + h / 2 + 14); cx.stroke();
  if (Math.floor(G.t / 520) % 2 === 0) E(cx, x0 + 22, y0 + 22, 7, 7, '#ff2a2a', 0);
  txt(cx, 'REC', x0 + 50, y0 + 28, '800 17px "Baloo 2", sans-serif', '#ffffff', 'left', 3, '#1b1020');
  txt(cx, tc, x0 + w - 18, y0 + h - 14, '700 16px "Baloo 2", monospace', '#ffffff', 'right', 3, '#1b1020');
  txt(cx, 'TENTAKEL-CAM 1', x0 + 18, y0 + h - 14, '800 14px "Baloo 2", sans-serif', '#ffe066', 'left', 3, '#1b1020');
  R(cx, x0 + w - 62, y0 + 12, 40, 18, 'rgba(0,0,0,0)', 2, 3, '#ffffff'); R(cx, x0 + w - 22, y0 + 17, 4, 8, '#ffffff', 0);
  R(cx, x0 + w - 59, y0 + 15, 22 + Math.round(Math.sin(G.t * 0.001) * 3), 12, '#7dff7a', 0);
  cx.restore();
}
{ const kinoOhneSucher = drawKino; drawKino = function () { kinoOhneSucher(); if (G.ankunft && G.ankunft.sucher && G.screen === 'game') drawSucher(); }; }

// ---------- Übersetzung: Vorspann und Titelbild vorab übersetzen ----------
// Die Texte stehen im Code der Vorspann-Szenen; sobald eine andere Sprache aktiv ist, werden sie im Hintergrund geholt,
// damit Prolog, Ankunft und Labor gleich übersetzt laufen (und nicht Zeile für Zeile erst Deutsch aufblitzt)
function vorspannTexte(src) {
  const out = [];
  src.replace(/'((?:[^'\\\n]|\\.)*)'/g, (m, t) => { if (t.length > 5 && / /.test(t) && /[a-zäöüß]{3}/.test(t) && /^[A-Za-zÄÖÜäöü„“»«…*(]/.test(t) && !/[{}\[\]=;]|\$\{/.test(t)) out.push(t.replace(/\'/g, "'")); return m; });
  return out;
}
function vorspannVorwaermen() {
  if (typeof Lang === 'undefined' || Lang.cur === 'de') return;
  const v = typeof TT_VER !== 'undefined' ? '?v=' + TT_VER : '';
  Lang.prewarm(vorspannTexte(String(drawTitle)));
  for (const datei of ['js/prolog.js', 'js/ankunft.js', 'js/vorspann.js', 'js/story.js']) {
    fetch(datei + v).then(r => r.text()).then(src => {
      if (datei.endsWith('story.js')) { const a = src.indexOf('async function INTRO'); src = a < 0 ? '' : src.slice(a, src.indexOf('\n}\n', a)); }
      Lang.prewarm(vorspannTexte(src));
    }).catch(() => {});
  }
}
