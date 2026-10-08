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
      if (!imgOk(img)) { g.fillStyle = o.fill || '#241739'; g.fillRect(0, 0, W, SH); return; }
      if (g.isPix) g.drawSprite(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, W, SH);
      else g.drawImage(img, 0, 0, W, SH);
    },
  }, o);
}
raum3d('hafen', 'img/raum_hafen.jpg', {
  era: 'past', name: 'Hafen 1776', floor: 'wood', amb: ['wind', 'birds'], fill: '#5aa0d0',
  objs: [
    { id: 'hafen_garten', name: 'Zurück zum Garten', rect: [0, 150, 58, 236], walk: [30, 400], exit: ['garten1776', 918, 380, -1] },
    { id: 'schiff', name: 'Piratenschiff', rect: [560, 40, 400, 250], walk: [700, 368], look: 'Ein Piratenschiff mit einem Toast auf der Flagge. Ich glaube, die meinen das ernst.' },
    { id: 'lagerhaus', name: 'Lagerhaus-Tor', rect: [50, 189, 102, 132], walk: [110, 362], look: 'Ein Lagerhaus. Auf dem Schild steht „Rum, Seile und anderes Zeug“. Das Tor ist zu. Das Zeug bleibt drin.' },
    { id: 'faesser', name: 'Fässer', rect: [258, 262, 170, 74], walk: [330, 362], look: 'Fässer. Auf einem steht „RUM“, auf dem anderen „AUCH RUM“, auf dem dritten „KEIN RUM (LÜGE)“.' },
    { id: 'seilrolle', name: 'Tau', rect: [488, 308, 72, 30], walk: [520, 362], look: 'Eine Rolle Tau. Ein Seemann würde jetzt einen Knoten machen. Ich mach höchstens einen Knoten rein.' },
    { id: 'insel', name: 'Insel', rect: [140, 145, 260, 70], look: 'Eine Insel mit drei Palmen. Sieht aus wie ein Ort, an dem man Affen trifft. Mit mehr als einem Kopf.' },
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
  hafen: { verb: [0.4, 0.08], light: [1, '#fff0c8', '#2a4a70'], bloom: 0.24, amb: ['wind'], music: 'tavern' },
  landeplatz: { verb: [0.9, 0.12], light: [-1, '#ffb8f0', '#1c0c48'], bloom: 0.36, amb: ['future', 'traffic'], motes: 'firefly' },
  testkammer: { verb: [1.8, 0.2], light: [1, '#f4f8ff', '#3a4058'], bloom: 0.2, amb: ['hum', 'beeps'], music: 'lab', reflect: 0.12 },
});
MAP_ORDER.past.push('hafen');
MAP_ORDER.future.push('testkammer', 'landeplatz');

// ---------- die Gäste ----------
const GUESTS = ['dave', 'sam', 'max', 'salad', 'guybrush', 'jack', 'bender', 'prof', 'zoid', 'glados', 'simon'];
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
ACH.push({ id: 'fechten', name: 'Beleidigungsfechter', desc: 'Den Möchtegern-Piraten mit Worten besiegt.' },
  { id: 'gaeste', name: 'Dimensions-Flicker', desc: 'Alle Crossover-Gäste haben sich ins Gästebuch eingetragen.' });

// ---------- Darstellung: 3D-Bild (HD) bzw. Pixel-Art aus demselben Bild (Klassik-Modus) ----------
// Haltung je Gast im Stand (gesture/idleAct wie bei den anderen Figuren)
const GAST_IDLE = {
  dave: (a, t) => gesture(a, t) > 0.45 && 'gest',
  sam: (a, t) => gesture(a, t) > 0.45 && 'gest',
  max: (a, t) => { const k = idleAct(a, t, 5200, 900); return k >= 0 && (Math.floor(k * 6) % 2 ? 'jump' : 'gest'); },   // hibbelt herum
  salad: (a, t) => { const k = idleAct(a, t, 9000, 3200); return k >= 0 && 'touch'; },   // streichelt die Luft
  guybrush: (a, t) => a.duel ? (G.t - (a.lunge || -1e9) < 650 ? 'lunge' : 'engarde') : gesture(a, t) > 0.45 && 'engarde',
  jack: (a, t) => { const k = idleAct(a, t, 8000, 2600); return k >= 0 && 'compass'; },   // schaut auf den Kompass
  bender: (a, t) => { const k = idleAct(a, t, 10000, 3000); return k >= 0 && 'lean'; },
  prof: (a, t) => gesture(a, t) > 0.45 && 'news',   // Zeigefinger hoch: gute Neuigkeiten!
  zoid: (a, t) => gesture(a, t) > 0.45 && 'gest',
  glados: (a, t) => { const p = ((t + (a.seed || 0) * 3000) % 7000) / 7000; return a.talking ? (Math.sin(t * 0.004) > 0 ? 'tilt0' : 'tilt1') : p < 0.3 ? 'idle' : p < 0.55 ? 'tilt0' : p < 0.75 ? 'idle' : 'tilt1'; },
  simon: (a, t) => gesture(a, t) > 0.45 && 'gest',
};
for (const id of GUESTS) {
  ACT[id].frameOverride = (a, t) => (id === 'glados' || id === 'guybrush' && a.duel || !a.talking && !a.walking) && GAST_IDLE[id](a, t);
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
    await say('drfred', 'Das Gästebuch ist voll! Elf Unterschriften aus elf Welten – damit kann ich den Riss endlich berechnen!');
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
    const c = await choose([{ id: 'wer', text: 'Wer bist du denn?' }, { id: 'hier', text: 'Wie bist du hierhergekommen?' }, { id: 'tipp', text: 'Hast du einen Tipp für mich?' }, gbOpt(d), { id: 'bye', text: 'Bis später.' }]);
    if (c === 'bye') { await say(b, 'Bis später.'); await say(d, 'Und nicht klingeln! Wer hier klingelt, landet im Keller.'); return; }
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
    const c = await choose([{ id: 'fall', text: 'Was für ein Fall?' }, { id: 'max', text: 'Was genau ist dein Partner?' }, !gbOk(s_) && { id: 'verhoer', text: 'Unterschreibt ihr in Dr. Freds Gästebuch?' }, { id: 'bye', text: 'Viel Erfolg bei den Ermittlungen.' }]);
    if (c === 'bye') { await say(b, 'Viel Erfolg bei den Ermittlungen.'); await say(s_, 'Danke. Und verlassen Sie die Zeitzone nicht.'); return; }
    if (c === 'fall') {
      await say(b, 'Was für ein Fall?');
      await say(s_, 'Ein lila Tentakel hat die Weltherrschaft an sich gerissen. Zufälligerweise ist das in unserer Welt verboten. Und in Ihrer vermutlich auch.');
      await say(m, 'Ich verdächtige den Toaster. Er hat so schuldige Schlitze.');
    }
    if (c === 'max') {
      await say(b, 'Was genau ist dein Partner?');
      await say(s_, 'Ein hyperkinetisches Kaninchending. Er ist gesetzlich nicht erfasst.');
      await say(m, 'Ich bin wie ein Hase, nur mit mehr Zähnen und weniger Skrupeln.');
    }
    if (c === 'verhoer') {
      await say(b, 'Unterschreibt ihr in Dr. Freds Gästebuch?');
      await say(s_, 'Gern. Nach einem kurzen Verhör. Reine Routine. Frage eins: Wer ist der Täter?');
      const v = await choose([{ id: 'fred', text: 'Dr. Fred.' }, { id: 'lila', text: 'Lila Tentakel.' }, { id: 'toast', text: 'Der Toaster.' }, { id: 'ich', text: 'Ich war’s. Glaube ich.' }]);
      if (v === 'lila') {
        await say(b, 'Lila Tentakel.');
        await say(s_, 'Korrekt. Max, notier das.'); await say(m, 'Ich habe „Toaster“ notiert. Aus Prinzip.');
        await say(s_, 'Dann unterschreiben wir. Ich mit Füller, Max mit Ketchup.');
        await gbSign(s_, m);
      } else if (v === 'ich') {
        await say(b, 'Ich war’s. Glaube ich.'); await say(m, 'Ein Geständnis! Verhaften wir ihn, Sam!'); await say(s_, 'Max, wir verhaften niemanden, der so nervös schwitzt. Das ist unter unserer Würde.');
      } else {
        await say(b, v === 'fred' ? 'Dr. Fred.' : 'Der Toaster.');
        await say(m, v === 'toast' ? 'HA! Ich wusste es!' : 'Der Mann mit der Frisur? Plausibel.');
        await say(s_, 'Interessante Theorie. Leider falsch. Denken Sie noch mal nach – wer hat denn die Welt an sich gerissen?');
      }
    }
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
    const c = await choose([{ id: 'wer', text: 'Wer bist du, Mann?' }, { id: 'tun', text: 'Was machst du da?' }, !gbOk(s_) && { id: 'gb', text: 'Unterschreibst du in einem Gästebuch?' }, { id: 'bye', text: 'Ich geh dann mal … ganz langsam.' }]);
    if (c === 'bye') { await say(h, 'Ich geh dann mal … ganz langsam.'); await say(s_, 'Pass auf dich auf. Und auf deine Finger. Finger sind kostbar.'); return; }
    if (c === 'wer') { await say(h, 'Wer bist du, Mann?'); await say(s_, 'Ich bin Salad Fingers. Ich fühle gern Dinge. Am liebsten rostige Dinge. Rost ist wie eine Umarmung, die nach Metall riecht.'); }
    if (c === 'tun') { await say(h, 'Was machst du da?'); await say(s_, 'Ich höre dem Brunnen zu. Er hat einen sehr schönen Eimer. Ich wünschte, ich dürfte ihn halten.'); }
    if (c === 'gb') {
      await say(h, 'Unterschreibst du in einem Gästebuch?');
      await say(s_, has('eimer', h) || has('wasser', h) ? 'Vielleicht … wenn ich einmal den Eimer halten dürfte, den du da trägst …' : 'Ich unterschreibe nur, wenn ich vorher etwas Schönes fühlen darf. Der Eimer am Brunnen ist sehr schön.');
    }
  }
};

// Beleidigungsfechten: drei Beleidigungen, jede braucht die passende Antwort
const INSULTS = [
  ['Du fichtst wie ein Tentakel ohne Rückgrat!', 'Passend – du redest wie einer ohne Hirn.'],
  ['Mein Säbel ist schärfer als dein Verstand!', 'Dann benutz ihn doch mal zum Denken.'],
  ['Nach diesem Duell hast du Wackelpudding statt Knochen!', 'Dann passe ich endlich zu deinen Knien.'],
  ['Du riechst wie ein Fass, das zu lange in der Sonne stand!', 'Immerhin riecht man mich – dich bemerkt keiner.'],
  ['Selbst das Huhn im Garten ficht eleganter als du!', 'Klar, du hast ja auch von ihm gelernt.'],
  ['Ich habe schon Gegner zum Frühstück verspeist!', 'Darum siehst du auch so verdorben aus.'],
];
const DECOYS = ['Ach ja? Ach JA?!', 'Hinter dir! Ein dreiköpfiger Affe!', 'Das sag ich meiner Mama.', 'Ich bin Gummi, du bist Kleber!', 'Äh … Rock ’n’ Roll?', 'Na und? Ich hab ’ne Mütze.'];
function shuffled(a) { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }
async function insultDuel(p) {
  const g = ACT.guybrush; g.duel = 1; let pts = 0;
  try {
    for (const [ins, ret] of shuffled(INSULTS).slice(0, 3)) {
      await say('guybrush', ins);
      const opts = shuffled([ret, ...shuffled(DECOYS).slice(0, 2)]).map((t, i) => ({ id: t === ret ? 'ok' : 'x' + i, text: t }));
      const c = await choose(opts);
      await say(p, opts.find(o => o.id === c).text);
      if (c === 'ok') { pts++; g.lunge = G.t; Sound.sfx('saber'); await say('guybrush', pick(['Touché!', 'Argh. Das saß.', 'Woher kennst du die?!'])); }
      else await say('guybrush', pick(['Ha! Das war schwach.', 'Netter Versuch, Landratte.', 'Damit beleidigst du höchstens meinen Säbel.']));
    }
  } finally { g.duel = 0; }
  return pts;
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
      const pts = await insultDuel(h);
      if (pts === 3) {
        await say(g, 'Drei von drei … Du kämpfst wie ein Roadie! Das ist ein Kompliment.');
        unlock('fechten');
        if (!gbOk(g)) { await say(g, 'Ich trage mich in dein Buch ein. Mit Schnörkel, wie ein echter Pirat.'); await gbSign(g); }
      } else await say(g, `${pts} von 3. Übung macht den Piraten. Merk dir: Die Antwort muss die Beleidigung umdrehen!`);
    }
  }
};

ACT.jack.talk = async () => {
  const j = 'jack', h = curId();
  await say(j, fl().metJack ? 'Ah. Der Mann mit der Kappe. Wieder da. Das ist entweder Treue oder Langeweile.' : 'Ah. Ein Mann mit Hut. Mütze. Kappe. Das zählt. Willkommen an Bord. Es gibt kein Bord.');
  fl().metJack = 1;
  for (;;) {
    const c = await choose([{ id: 'wer', text: 'Wer bist du?' }, { id: 'kompass', text: 'Was ist das für ein Kompass?' }, { id: 'hier', text: 'Was machst du in 1776?' }, !gbOk(j) && { id: 'gb', text: 'Unterschreibst du in einem Gästebuch?' }, { id: 'bye', text: 'Tschüss, Käpt’n.' }]);
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
    const c = await choose([{ id: 'wer', text: 'Wer bist du?' }, { id: 'schiff', text: 'Ist das euer Raumschiff?' }, !gbOk(b_) && { id: 'gb', text: 'Unterschreibst du in einem Gästebuch?' }, { id: 'bye', text: 'Tschüss, Blechbüchse.' }]);
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
    const c = await choose([{ id: 'wer', text: 'Wer sind Sie?' }, { id: 'fred', text: 'Kennen Sie Dr. Fred?' }, !gbOk(p) && { id: 'gb', text: 'Unterschreiben Sie in Dr. Freds Gästebuch?' }, { id: 'bye', text: 'Auf Wiedersehen, Professor.' }]);
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
    const c = await choose([{ id: 'wer', text: 'Wer oder was bist du?' }, { id: 'kuchen', text: 'Gibt es hier wirklich Kuchen?' }, !gbOk(k) && { id: 'test', text: 'Ich mache deinen Test. Unterschreibst du dann im Gästebuch?' }, { id: 'bye', text: 'Ich geh dann mal.' }]);
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
      } else await say(k, `${pts} von 3. Der Test wird wiederholt, bis jemand lacht. Ich lache nie.`);
    }
  }
};

ACT.simon.talk = async () => {
  const m = 'simon', l = curId();
  await say(m, fl().metSimon ? 'Ach, die Leichenbeschauerin ist wieder da. Super.' : 'Super. Ich wollte nach Hause und lande in einem lila Thronsaal mit einem sprechenden Gurkenwurm.');
  fl().metSimon = 1;
  for (;;) {
    const c = await choose([{ id: 'wer', text: 'Wer bist du?' }, { id: 'zauber', text: 'Kannst du zaubern?' }, { id: 'heim', text: 'Wie kommst du nach Hause?' }, !gbOk(m) && fl().simonHeim && { id: 'gb', text: 'Trägst du dich in Dr. Freds Gästebuch ein?' }, { id: 'bye', text: 'Viel Glück, Zauberer.' }]);
    if (c === 'bye') { await say(l, 'Viel Glück, Zauberer.'); await say(m, 'Glück. Klar. Das hatte ich zuletzt, als mich ein Hund in ein Märchenbuch gezogen hat.'); return; }
    if (c === 'wer') { await say(l, 'Wer bist du?'); await say(m, 'Simon. Zauberer. Na ja, Zauberlehrling mit eigenem Hut. Der Hut macht 80 Prozent der Magie. Den Rest mache ich mit Sarkasmus.'); }
    if (c === 'zauber') { await say(l, 'Kannst du zaubern?'); await say(m, 'Pass auf: *murmel murmel* … Siehst du? Nichts passiert. Das ist ein Unsichtbarkeitszauber. Auf die Wirkung.'); await say(l, 'Beeindruckend.'); await say(m, 'Ich weiß.'); }
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
