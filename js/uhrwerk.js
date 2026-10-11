'use strict';
// ============================================================
//  Tentakel-Toast – Der Gang hinter der Standuhr (js/uhrwerk.js)
//  Zieht oder drückt man am Pendel der Lobby-Standuhr, schwingt die ganze Uhr wie eine Tür zur Seite. Dahinter:
//  der Uhrwerk-Schacht (art/blender/raum_build.py: build_uhrwerk) – ein Uhrturm mit einem Hauch Castlevania:
//  Spitzbogenfenster mit Vollmond, Kandelaber, blutrote Banner, Ketten, Fledermäuse. Dazwischen klafft der Abgrund
//  des Getriebes. Im vorgerenderten Bild führt ein Notsteg hinüber; im Echtzeit-3D ist der Steg weg, dort springt man
//  über ein liegendes Zahnrad, einen Hubkolben und ein zweites Zahnrad – und das Riesenpendel schwingt quer durch.
//  Rechts führt eine Steintreppe in den Keller; vom Keller aus geht es durch einen Mauerdurchbruch zurück.
// ============================================================
const imEcht3d = id => typeof echt3dOn === 'function' && !!ROOMS[id] && echt3dOn(ROOMS[id]);
const UHR_KRISTALL = { x: 613, y: 190, welt: [1.7, 10.6, 2.3] };   // Spiel-Bild (vorgerendert) und Blender-Weltlage über Zahnrad B

// Fledermaus als Silhouette, Flügel schlagen (Castlevania-Hauch)
function fledermaus(c, x, y, s, t, ph) {
  const f = Math.sin(t * 0.022 + ph), w = 14 * s, h = (4 + f * 7) * s;
  c.save(); c.translate(x, y);
  c.fillStyle = '#0c0812'; c.strokeStyle = '#0c0812'; c.lineWidth = 1;
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(-w * 0.5, -h - 2 * s, -w, -h * 0.6);
  c.quadraticCurveTo(-w * 0.75, 1 * s, -w * 0.55, 0.5 * s);
  c.quadraticCurveTo(-w * 0.3, 2.5 * s, 0, 2 * s);
  c.quadraticCurveTo(w * 0.3, 2.5 * s, w * 0.55, 0.5 * s);
  c.quadraticCurveTo(w * 0.75, 1 * s, w, -h * 0.6);
  c.quadraticCurveTo(w * 0.5, -h - 2 * s, 0, 0);
  c.fill();
  E(c, 0, 0.5 * s, 2.6 * s, 3.2 * s, '#0c0812', 0);
  E(c, -1 * s, 0, 0.6 * s, 0.6 * s, '#ff3a3a', 0); E(c, 1 * s, 0, 0.6 * s, 0.6 * s, '#ff3a3a', 0);
  c.restore();
}
function uhrKristallMalen(c, t) {
  if (G.state.crystals.uhrwerk || imEcht3d('uhrwerk')) return;   // im Echtzeit-3D schwebt ein echter Kristall in der Szene
  const bob = Math.sin(t * 0.0035) * 5, { x } = UHR_KRISTALL, y = UHR_KRISTALL.y + bob;
  c.save();
  if (!c.isPix) glowAt(c, x, y, 30 + Math.sin(t * 0.004) * 5, '#7fe8ff', 0.4 + Math.sin(t * 0.006) * 0.12);
  P(c, [x, y - 22, x + 13, y, x, y + 22, x - 13, y], '#c8f6ff', 2.5, '#2a8aaa');
  P(c, [x, y - 12, x + 6, y, x, y + 12, x - 6, y], '#f0fdff', 0);
  c.restore();
}

// ---------- Der Raum ----------
const UHR_WALK_VOLL = [[20, 352], [940, 350], [955, 432], [5, 432]];
const UHR_WALK_STEG = [[20, 350], [940, 349], [944, 372], [16, 374]];   // vorgerendert: nur über den Notsteg
raum3d('uhrwerk', 'img/raum_uhrwerk.jpg', {
  era: 'present', name: 'Uhrwerk', floor: 'wood', amb: ['clock', 'wind', 'owl'], fill: '#1a1220',
  objs: [
    { id: 'uhrwerk_raus', name: 'Zurück durch die Standuhr', rect: [101, 118, 71, 192], walk: [140, 356], dv: 'walk',
      look: 'Die Rückseite der Standuhr. Von hier sieht man durchs Zifferblatt-Glas die Lobby – verkehrt herum. Wie alles hier.' },
    { id: 'uhrwerk_keller', name: 'Treppe in den Keller', rect: [748, 300, 212, 60], walk: [830, 358], dv: 'walk', exit: ['keller', 815, 392, -1],
      look: 'Eine Steintreppe in die Tiefe. Auf dem Schild steht KELLER. Darunter, sehr klein: „und Kerker, und Kühlbecken, und Sorgen“.' },
    { id: 'riesenpendel', name: 'Riesenpendel', rect: [495, 230, 106, 106], walk: [548, 360],
      look: () => imEcht3d('uhrwerk')
        ? 'Ein Pendel, so schwer wie ein Kleinwagen. Es schwingt genau über den Sprungweg. Wer im falschen Moment springt, wird zum Tischtennisball.'
        : 'Ein Pendel, so schwer wie ein Kleinwagen. Es tickt so laut, dass mein Herz versucht, im Takt mitzuschlagen.' },
    { id: 'kolben', name: 'Hubkolben', rect: [425, 300, 110, 56], walk: [480, 360],
      look: 'Ein Hubkolben mit gelbem Warnstreifen. Er pumpt hoch und runter, hoch und runter. Er hat seinen Lebenssinn gefunden.' },
    { id: 'zahnrad_a', name: 'Liegendes Zahnrad', rect: [256, 318, 174, 48], walk: [330, 360],
      look: 'Ein liegendes Zahnrad, groß wie ein Esstisch. Es dreht sich gemütlich. Man könnte darauf Karussell fahren. Oder springen.' },
    { id: 'zahnrad_b', name: 'Kupfernes Zahnrad', rect: [531, 290, 179, 42], walk: [620, 360],
      look: 'Ein Kupferzahnrad, etwas höher als das andere. Darüber glitzert etwas in der Luft.' },
    { id: 'zifferblatt_hinten', name: 'Riesiges Zifferblatt', rect: [404, 0, 220, 220], walk: [514, 356],
      look: 'Das Zifferblatt von hinten. Die Zeiger laufen rückwärts. Fred hat die Uhrzeit nicht verstellt – er hat sie umgedreht. Das erklärt einiges.' },
    { id: 'zahnraeder_wand', name: 'Wandzahnräder', rect: [638, 0, 189, 186], walk: [730, 356],
      look: 'Messingzahnräder, so groß wie Wagenräder. Sie greifen ineinander wie die Argumente meiner Mutter.' },
    { id: 'gotikfenster', name: 'Spitzbogenfenster', rect: [231, 40, 86, 168], walk: [274, 356],
      look: 'Ein Spitzbogenfenster mit Buntglas. Draußen ein Vollmond wie aus einem Vampirfilm. Irgendwo schreit eine Eule. Ich schreie innerlich mit.' },
    { id: 'gotikfenster2', name: 'Spitzbogenfenster', rect: [870, 40, 90, 168], walk: [880, 356],
      look: 'Noch ein Spitzbogenfenster. Wer baut in eine Villa einen Uhrturm mit Gotik-Fenstern? Ein Mann mit einem sehr bestimmten Fernsehgeschmack.' },
    { id: 'kandelaber', name: 'Kandelaber', rect: [169, 183, 68, 158], walk: [200, 358],
      look: 'Ein Kandelaber mit drei Kerzen. In solchen Gemäuern haut man auf Kerzen. Das weiß jeder, der je mit einer Peitsche durch ein Schloss gelaufen ist.' },
    { id: 'kandelaber2', name: 'Kandelaber', rect: [743, 183, 68, 158], walk: [770, 358],
      look: 'Noch ein Kandelaber. Die Kerzen flackern, obwohl hier kein Wind geht. Das ist entweder Physik oder Atmosphäre.' },
    { id: 'banner', name: 'Rote Banner', rect: [0, 0, 60, 120], walk: [60, 356],
      look: 'Blutrote Banner mit einem Wappen. Das Wappen zeigt … einen Toaster. Mit Fledermausflügeln. Familie Edison, Zweig „Gruft“.' },
    { id: 'abgrund', name: 'Abgrund', rect: [300, 372, 400, 68],
      look: () => imEcht3d('uhrwerk')
        ? 'Tief unten mahlen glühende Zahnräder. Wer da reinfällt, kommt als Konfetti wieder raus. Zum Glück setzt mich das Spiel dann aufs letzte Brett zurück.'
        : 'Tief unten mahlen glühende Zahnräder. Ich gehe schön auf dem Notsteg. Schön. Langsam. Nicht. Runter. Schauen.' },
    { id: 'notsteg', name: 'Notsteg', rect: [256, 340, 479, 32], walk: [480, 362], visible: () => !imEcht3d('uhrwerk'),
      look: 'Ein Notsteg aus Brettern mit Seilgeländer. Er quietscht bei jedem Schritt. Ich quietsche mit.' },
    { id: 'warnschild_uhr', name: 'Warnschild', rect: [43, 43, 192, 45], walk: [140, 356],
      look: '„UHRWERK – BETRETEN AUF EIGENE ZEIT! – F.“ Das ist entweder ein Wortspiel oder eine Drohung. Bei Fred ist das dasselbe.' },
    { id: 'kristall_uhr', name: 'Schwebender Chrono-Kristall', rect: [UHR_KRISTALL.x - 30, UHR_KRISTALL.y - 32, 60, 64], walk: [620, 360], dv: 'pick',
      visible: () => !G.state.crystals.uhrwerk,
      look: () => imEcht3d('uhrwerk')
        ? 'Ein Chrono-Kristall, hoch über dem Kupferzahnrad. Hinspringen, berühren, fertig! (WASD/Stick laufen, Leertaste/A springt.)'
        : 'Ein Chrono-Kristall, hoch über dem Kupferzahnrad. Mit einem beherzten Hopser vom Steg komme ich vielleicht ran.' },
  ],
  dyn(c, t) {
    const drei = imEcht3d('uhrwerk');
    if (!c.isPix && !drei) {   // Kerzenschein und Mondlicht (im Echtzeit-3D leuchten die Szene-Lichter selbst)
      for (const x of [203, 777]) { const fk = Math.sin(t * 0.019 + x) * Math.sin(t * 0.007 + x * 2); glowAt(c, x, 196, 34 + fk * 5, '#ffb04a', 0.34 + fk * 0.06); }
      glowAt(c, 271, 150, 40, '#a8c0ff', 0.2 + Math.sin(t * 0.0009) * 0.05);
      glowAt(c, 500, 430, 120, '#ff7a2a', 0.16 + Math.sin(t * 0.002) * 0.04);   // Glut aus dem Abgrund
    }
    uhrKristallMalen(c, t);
    for (let i = 0; i < 4; i++) {   // Fledermäuse kreisen unter der Decke
      const k = t * 0.00022 * (1 + i * 0.17) + i * 1.7;
      const x = 480 + Math.cos(k) * (360 - i * 40) + Math.sin(k * 2.3) * 30, y = 70 + i * 22 + Math.sin(k * 3.1) * 26;
      fledermaus(c, x, y, 0.9 + (i % 2) * 0.35, t, i * 1.3);
    }
  },
});
Object.defineProperty(ROOMS.uhrwerk, 'walk', { configurable: true, get: () => imEcht3d('uhrwerk') ? UHR_WALK_VOLL : UHR_WALK_STEG });
ROOM_FX.uhrwerk = { verb: [1.3, 0.2], light: [1, '#ffd8a0', '#120a18'], bloom: 0.22, amb: ['clock', 'wind', 'owl'], motes: 'dust' };
GRADE.uhrwerk = ['#8a6ac8', 0.08];
ROOMS.uhrwerk.zustand3d = {};
ROOMS.uhrwerk.onEnter = async () => {
  if (fl().uhrwerkBesucht) return;
  fl().uhrwerkBesucht = 1;
  await s('Ein Uhrturm. IN der Villa. Hinter der Standuhr. Mit Kerzen, Bannern und Fledermäusen.');
  await s('Fred, du bist ein Genie. Ein gruseliges, unbezahlbares, vermutlich vampirisches Genie.');
};
if (typeof MAP_ORDER !== 'undefined' && MAP_ORDER.present) {
  const i = MAP_ORDER.present.indexOf('keller');
  MAP_ORDER.present.splice(i < 0 ? MAP_ORDER.present.length : i, 0, 'uhrwerk');
}
if (typeof CRYSTAL_ROOMS !== 'undefined') CRYSTAL_ROOMS.push('uhrwerk');
{
  const crystalAtOrig = crystalAt;   // kein Boden-Kristall: er schwebt über Zahnrad B
  crystalAt = id => id === 'uhrwerk' ? null : crystalAtOrig(id);
}
function uhrKristallNehmen(text) {
  if (G.state.crystals.uhrwerk) return false;
  G.state.crystals.uhrwerk = Date.now();
  Sound.sfx('crystal', panX(UHR_KRISTALL.x)); rumble(120, 0.1, 0.5);
  puff(UHR_KRISTALL.x, UHR_KRISTALL.y, '#7fe8ff', 12, { vy: 70, vx: 140, r: 2.4, max: 700, spread: 10 });
  const n = crystalCount();
  note(n === CRYSTAL_ROOMS.length ? 'Alle Chrono-Kristalle gefunden!' : `Chrono-Kristall gefunden! (${n}/${CRYSTAL_ROOMS.length})`);
  if (n === CRYSTAL_ROOMS.length) unlock('kristalle');
  if (text) say(curId(), text);
  save();
  return true;
}
RULES['pick o:kristall_uhr'] = async () => {
  if (imEcht3d('uhrwerk')) return s('Zu hoch zum Greifen! Ich muss vom Kupferzahnrad aus HOCHSPRINGEN und ihn berühren.');
  await s('Ich nehme Anlauf auf dem Steg … und HOPS!');
  if (typeof mimikStart === 'function') mimikStart(me(), 'freude');
  uhrKristallNehmen('Erwischt! Und der Steg hat gehalten. Beide sind wir überrascht.');
};
// Echtzeit-3D: der Kristall wird eingesammelt, sobald man ihn im Sprung berührt (Lage aus js/echt3d-szene.js)
setInterval(() => {
  if (G.screen !== 'game' || !G.state || G.state.crystals.uhrwerk || !imEcht3d('uhrwerk')) return;
  const p = me(); if (!p || p.room !== 'uhrwerk' || !p._pos3d) return;
  const [kx, ky, kz] = UHR_KRISTALL.welt, [x, y, z] = p._pos3d;
  if (Math.hypot(x - kx, y - ky) < 0.75 && Math.abs(z + 0.95 - kz) < 0.5) {
    if (typeof mimikStart === 'function') mimikStart(p, 'freude');
    uhrKristallNehmen('SCHNAPP! Im Flug gefangen! Ich bin ein Vampirjäger! Ein … Kristalljäger. Mit Brille.');
  }
}, 60);

// ---------- Zurück und weiter ----------
async function uhrZurueck() {
  Sound.sfx('door');
  await goRoom(curId(), 'lobby', 312, 366, 1);
  fl().uhrGang = 0; Sound.sfx('thunk'); shake(220, 3);
  await s('KLONK. Die Standuhr schwingt hinter mir zu. Tick. Tack. Als wäre nie etwas gewesen.');
}
multi(['walk', 'open', 'use'], 'o:uhrwerk_raus', uhrZurueck);
multi(['push', 'pull', 'use'], 'o:riesenpendel', line('Ich lege die Hand ans Pendel. Das Pendel legt mich fast in den Abgrund. Wir lassen einander in Ruhe.'));
multi(['push', 'pull', 'use'], 'o:kolben', line('Ich drücke auf den Kolben. Der Kolben drückt zurück. Mit 40 Tonnen. Er gewinnt.'));
multi(['push', 'pull', 'use'], 'o:zahnrad_a', line('Ich drehe das Zahnrad ein Stück weiter. Irgendwo in der Lobby ist es jetzt zwei Minuten später. Gern geschehen.'));
RULES['use o:zifferblatt_hinten'] = line('Die Zeiger sind zu weit oben. Und ehrlich: Ich habe schon genug Ärger mit der Zeit.');
multi(['push', 'pull', 'use', 'pick'], 'o:kandelaber', async () => {
  Sound.sfx('whoosh'); await wait(160); Sound.sfx('ding');
  if (typeof mimikStart === 'function') mimikStart(me(), 'staunen');
  await s('Ich haue auf die Kerze, wie man das in solchen Gemäuern eben macht. Heraus fällt … ein kleines Herz!');
  await s('Ein Bonbon in Herzform. Abgelaufen 1987. Ich lasse es liegen. Selbst Vampirjäger haben Prinzipien.');
});
multi(['push', 'pull', 'use', 'pick'], 'o:kandelaber2', async () => {
  Sound.sfx('whoosh'); await wait(160); Sound.sfx('coin');
  await s('Ich schlage auf die Kerze. Heraus fällt eine Münze. Sie rollt in den Abgrund. Natürlich tut sie das.');
});
RULES['talk o:banner'] = line('„Hallo, Toaster mit Flügeln.“ Er antwortet nicht. Aber ich habe das Gefühl, er beobachtet mich.');

// ---------- Lobby: die Standuhr wird zur Tür ----------
{
  const uhr = ROOMS.lobby.objs.find(o => o.id === 'uhr_heute');
  uhr.visible = () => !fl().uhrGang;
  const lookOrig = RULES['look o:uhr_heute'];
  RULES['look o:uhr_heute'] = async () => {
    await lookOrig();
    if (!fl().uhrGangGesehen) { fl().uhrGangGesehen = 1; await s('Hm. Das Pendel hat einen auffällig abgegriffenen Griff. Als hätte jemand sehr oft daran gezogen.'); }
  };
  const oeffnen = async () => {
    if (fl().sticksInClock && !fl().altsticks) return s('Erst mal in den Uhrkasten schauen. Da unten liegt doch was!');
    Sound.sfx('clank'); await wait(250);
    if (!fl().uhrGangKennt) await s('Ich ziehe am Pendel … es rastet mit einem KLICK ein …');
    Sound.sfx('door'); shake(380, 4); rumble(260, 0.3, 0.6);
    fl().uhrGang = 1; fl().uhrGangT = Date.now();
    if (typeof mimikStart === 'function') mimikStart(me(), fl().uhrGangKennt ? 'freude' : 'schreck');
    if (!fl().uhrGangKennt) {
      fl().uhrGangKennt = 1;
      await s('HUCH?! Die ganze Standuhr schwingt zur Seite wie eine Tür!');
      await s('Dahinter führt ein Gang hinab. Es tickt. Es knarrt. Es riecht nach Kerzenwachs und Maschinenöl. Ich LIEBE diese Villa.');
    } else await s('Klick, knarz – Geheimgang offen. Ich kenne den Trick jetzt.');
  };
  multi(['push', 'pull'], 'o:uhr_heute', oeffnen);
  ROOMS.lobby.objs.push({
    id: 'uhrgang', name: 'Geheimgang in der Standuhr', rect: [258, 147, 92, 197], walk: [312, 362], dv: 'walk', exit: ['uhrwerk', 150, 358, 1],
    visible: () => !!fl().uhrGang,
    look: 'Wo eben noch die Standuhr stand, führt jetzt eine Holztreppe hinab ins Ticken. Von unten flackert Kerzenlicht.',
    draw(c, t) {
      if (imEcht3d('lobby')) return;   // im Echtzeit-3D schwingt die echte Uhr zur Seite (js/echt3d-szene.js)
      const k = Math.min(1, (Date.now() - (fl().uhrGangT || 0)) / 700), e = 1 - Math.pow(1 - k, 3);
      c.save();
      R(c, 282, 150, 62, 194, '#120a10', 0);   // dunkle Öffnung mit Stufen und Kerzenschein
      for (let i = 0; i < 5; i++) R(c, 286, 330 - i * 26, 54, 8, i % 2 ? '#3a2416' : '#4a2e1a', 1.5, 0, '#0c0608');
      if (!c.isPix) glowAt(c, 313, 300, 40, '#ffb04a', 0.35 + Math.sin(t * 0.017) * 0.06);
      const w = 64 * Math.cos(e * 1.25), x0 = 282 - (64 - w) * 0.05;   // die Uhr als aufgeschwungenes Türblatt nach links
      P(c, [x0, 150, x0 - w * 0.55, 140 - e * 10, x0 - w * 0.55, 354 + e * 10, x0, 344], '#6a3a1c', 2.5, '#1b1020');
      P(c, [x0 - 4, 170, x0 - w * 0.45, 164 - e * 6, x0 - w * 0.45, 330 + e * 6, x0 - 4, 326], '#8a4f26', 0);
      c.restore();
    },
  });
  RULES['close o:uhrgang'] = async () => { fl().uhrGang = 0; Sound.sfx('thunk'); await s('Ich schiebe die Uhr zurück. KLONK. Tick. Tack.'); };
}

// ---------- Keller: Mauerdurchbruch zum Uhrwerk, Falltür von unten ----------
ROOMS.keller.objs.push({
  id: 'keller_uhrwerk', name: 'Durchgang zum Uhrwerk', rect: [880, 150, 80, 226], walk: [815, 392], dv: 'walk', exit: ['uhrwerk', 830, 360, -1],
  look: 'Ein Mauerdurchbruch mit Stufen nach oben. Von dort tickt es. Und flattert es. Ich hoffe, das Flattern sind Tauben.',
  draw(c, t) {
    c.save();
    R(c, 898, 176, 62, 200, '#0e0a10', 2.5, 0, '#1b1020');
    P(c, [898, 176, 929, 150, 960, 176], '#0e0a10', 2.5, '#1b1020');
    for (let i = 0; i < 4; i++) R(c, 902, 356 - i * 22, 58, 7, '#4a4250', 1.5, 0, '#1b1020');
    if (!c.isPix) glowAt(c, 930, 250, 30, '#ffb04a', 0.28 + Math.sin(t * 0.017) * 0.05);
    txt(c, 'UHRWERK', 929, 138, '800 11px "Baloo 2", sans-serif', '#e8cf8a', 'center', 3, '#1b1020');
    c.restore();
  },
});
RULES['walk o:keller_leiter'] = async () => {
  if (fl().falltuer) return false;   // normaler Weg: Falltür steht offen
  await s('Die Falltür ist von oben zu. Aber von unten … ein kräftiger Schubs mit dem Kopf …');
  Sound.sfx('thunk'); shake(300, 4);
  fl().falltuer = 1; fl().falltuerGesehen = 1;
  Sound.sfx('door');
  await goRoom(curId(), 'lobby', 630, 404, 1);
  await s('TADA! Ich bin aus dem Boden gekommen wie ein sehr gebildeter Maulwurf.');
};
