'use strict';
// ============================================================
//  Zak McKracken und das Marsgesicht (Zukunft, Laverne) – Gästebuch-Seite 2
//  Zak will das Gesicht auf dem Mars fotografieren – lächelnd, sonst glaubt ihm keiner. Der Professor fliegt ohnehin hin und hat
//  Kopfschmerztabletten für „das Gesicht“ als Lieferung. Ein Ausflugsziel (nicht auf der Zeitreise-Karte).
//  Raum und Gäste sind eigene 3D-Modelle aus Blender (art/blender/gaeste_build.py, raum_build.py, items_neu.py).
// ============================================================
ITEMS.tabletten = { name: 'Kopfschmerztabletten', look: () => 'Ein Röhrchen „KOPF WEG“, extra stark. Lieferadresse: „Das Gesicht, Mars“. Die Packung ist größer als üblich. Der Empfänger auch.' };
ITEM_SFX.tabletten = 'click2';
ICON.tabletten = c => {
  R(c, -9, -10, 18, 28, '#f4f2ee', 2.5, 5); R(c, -10, -18, 20, 9, '#d8323a', 2.5, 3); R(c, -7, -2, 14, 13, '#ffe27a', 1.5, 2);
  txt(c, 'KOPF', 0, 3, '800 6px "Baloo 2", sans-serif', '#3a2a40'); txt(c, 'WEG', 0, 9, '800 6px "Baloo 2", sans-serif', '#3a2a40');
};
ICON_3D.tabletten = loadImg('img/items/tabletten.png');
{ const drawn = ICON.tabletten; ICON.tabletten = c => { const im = ICON_3D.tabletten; if (hd(c) && imgOk(im)) c.drawImage(im, -30, -30, 60, 60); else drawn(c); }; }

// Das Gesicht spricht aus dem Stein (Figur ohne Zeichnung: nur Stimme und Sprechblase)
CHAR.gesicht = () => {};
ACT.gesicht = mkA('gesicht', 'Das Gesicht', 'gesicht', '#ffb878', 20, 2, { shadowW: 0.01, voice: { pitch: 0.45, rate: 0.7, blip: 85, wave: 'sawtooth', formant: 0.4, tts: { g: 'm', pitch: 0.55, rate: 0.7, n: 1 } } });
START_POS.gesicht = { room: 'mars', x: 716, y: 70, dir: -1 };
BARKS.zak = ['Eine Schlagzeile liegt in der Luft. Ich rieche sie.', 'Es ist alles ein Komplott. Besonders das Wetter.', 'Zwölf Leser. Zwölf! Jeder einzelne ein Held.', 'Wenn ich das Foto habe, bin ich Chefredakteur. Von mir selbst.'];
(NPC_CHATS.landeplatz = NPC_CHATS.landeplatz || []).push(
  [['zak', 'Professor, ist das ein echtes Raumschiff?'], ['prof', 'Gute Nachrichten: ja. Schlechte: ich auch nicht ganz.']],
  [['bender', 'Reporter! Schreib über mich!'], ['zak', 'Und was soll ich schreiben?'], ['bender', 'Dass ich der Beste bin. Alles andere ist Lüge.']],
);

const marsFroh = () => !!(G.state && G.state.flags && G.state.flags.marsFroh);
function marsBildNeu() { delete bgCache.mars; if (ROOMS.mars) delete ROOMS.mars._pix; delete mapThumbs.mars; }
const MARS_FROH_IMG = loadImg('img/raum_mars_froh.jpg');
MARS_FROH_IMG.addEventListener('load', marsBildNeu);
raum3d('mars', 'img/raum_mars.jpg', {
  era: 'future', name: 'Marsgesicht', floor: 'grass', amb: ['wind', 'hum'], fill: '#a8502e', noMap: true,
  draw(g) {   // das missmutige Bild, nach den Tabletten das lächelnde
    const img = marsFroh() && imgOk(MARS_FROH_IMG) ? MARS_FROH_IMG : RAUM3D.mars;
    if (!imgOk(img)) { g.fillStyle = '#a8502e'; g.fillRect(0, 0, W, SH); return; }
    if (g.isPix) g.drawSprite(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, W, SH); else g.drawImage(img, 0, 0, W, SH);
  },
  objs: [
    { id: 'mars_schiff', name: 'Lieferraumschiff', rect: [30, 80, 349, 170], walk: [380, 372], dv: 'use', look: 'Das Lieferraumschiff des Professors, mitten in der Marswüste geparkt. Unter dem Scheibenwischer klemmt ein Strafzettel. Für den Mars. Das ist auch ein Rekord.' },
    { id: 'gesicht', name: 'Das Gesicht', rect: [542, 13, 346, 242], walk: [716, 372], dv: 'talk',
      look: () => marsFroh() ? 'Ein riesiges Steingesicht, und es lächelt über beide Wangen. Seit vier Millionen Jahren das erste Mal. Ich glaube, es ist rot geworden. Oder das ist der Mars.'
        : 'Ein riesiges Steingesicht mit Eisbeutel auf der Stirn. Es guckt, als hätte man es gerade aus dem Mittagsschlaf gerissen. Mit einem Presslufthammer.' },
    { id: 'mars_schild', name: 'Schild', rect: [301, 196, 185, 74], walk: [394, 372], look: () => marsFroh() ? '„DANKE! Gesicht ist wieder gut.“ Darunter, kleiner: „Bitte weiter leise sein. Nur aus Gewohnheit.“' : '„BITTE LEISE! Gesicht hat Kopfweh.“ Das Schild hat jemand mit viel Mitgefühl und wenig Rechtschreibung gemalt.' },
    { id: 'rover', name: 'Rover', rect: [209, 209, 108, 101], walk: [260, 372], look: 'Ein Mars-Rover mit fünf Rädern. Das sechste liegt daneben. Er hat sich wohl verfahren und dann aufgegeben. Ich kenne das Gefühl.' },
    { id: 'mond', name: 'Mond', rect: [275, 37, 87, 75], look: 'Phobos, der kartoffelförmige Mond. Er sieht aus wie das, was übrig bleibt, wenn ein Planet die Reste in die Luft wirft.' },
    { id: 'briefkasten', name: 'Briefkasten', rect: [706, 222, 90, 56], walk: [750, 366], look: 'Ein knallroter Briefkasten mit der Aufschrift „FÜR: DAS GESICHT“. Die Fahne steht oben. Das Gesicht wartet seit Jahrmillionen auf Post.' },
  ],
  dyn(c, t) {
    if (c.isPix) return;
    if (!marsFroh()) {   // Kopfschmerzen: rote Blitze pulsieren am Kopf
      const k = 0.5 + 0.5 * Math.sin(t * 0.007);
      for (const [x, y, r] of [[566, 62, -0.5], [872, 58, 0.5], [904, 150, 0.9], [540, 150, -0.9]]) {
        c.save(); c.translate(x, y); c.rotate(r); c.globalAlpha = 0.35 + 0.5 * k; L(c, [0, 0, 8, -10, 2, -10, 12, -22], 4, '#0b0610'); L(c, [0, 0, 8, -10, 2, -10, 12, -22], 2.2, '#ff5a4a'); c.restore();
      }
    } else {             // Aufatmen: warme Funken schweben auf
      for (let i = 0; i < 6; i++) { const q = ((t * 0.0004) + i / 6) % 1; glow(600 + i * 52 + Math.sin(t * 0.002 + i) * 12, 210 - q * 170, 20 + q * 12, i % 2 ? '#ffe9a0' : '#ffb0c0', Math.sin(q * Math.PI) * 0.55); }
    }
  },
});
ROOM_FX.mars = { verb: [2.4, 0.16], light: [-1, '#ffd2a0', '#3a1a30'], bloom: 0.22, amb: ['wind', 'hum'], motes: 'dust' };
GRADE.mars = ['#ff9a6a', 0.12];
ACT.zak.refuse = item => item === 'tabletten' ? 'Die sind fürs Gesicht, nicht für mich. Mein Kopfweh heißt Redaktionsschluss und ist nicht heilbar.' : pick(['Danke, aber ich bin im Dienst. Notizblock und Kamera sind meine ganze Welt.', 'Behalt das, du brauchst es bestimmt noch.']);
ACT.gesicht.refuse = item => item === 'tabletten' ? null : 'Mmmh. Nicht … nicht so laut. Ich habe keine Hände. Ich bin ein Gesicht.';

// Landeplatz: Einstieg zum Lieferraumschiff
ROOMS.landeplatz.objs.push({ id: 'einstieg', name: 'Rampe zum Lieferraumschiff', rect: [684, 232, 156, 64], walk: [760, 366], dv: 'use',
  look: 'Die Rampe vom Lieferraumschiff. Daneben ein Schild: „Nächster Halt: überallhin.“ Der Professor hat es selbst gemalt und das Ziel nie geändert.' });
// Professor: bei Zaks Wunsch die Lieferung (Tabletten) und der Flug
{
  const profOrig = ACT.prof.talk;
  ACT.prof.talk = async () => {
    const f = fl();
    if (f.zakAuftrag && !f.marsFlug && curId() === 'laverne') {
      await say('prof', 'Gute Nachrichten! Du siehst aus wie jemand, der etwas will.');
      const c = await choose([{ id: 'mars', text: 'Können Sie uns zum Mars fliegen? Zak will das Gesicht fotografieren.' }, { id: 'spaeter', text: 'Nur ein Schwätzchen, Professor.' }]);
      if (c === 'mars') {
        await say('laverne', 'Können Sie uns zum Mars fliegen? Zak will das Gesicht fotografieren.');
        await say('prof', 'Das Gesicht? Natürlich! Ich muss ohnehin eine Lieferung hinbringen. Seit vier Millionen Jahren unzustellbar, aber ich bin hartnäckig.');
        await say('prof', 'Kopfschmerztabletten. Extra stark. Empfänger: „Das Gesicht, Mars“. Der Briefkasten steht gleich neben der Nase.');
        await say('prof', 'Hier, nimm die Lieferung. Nicht schlucken – es ist für ein sehr großes Gesicht.');
        Sound.sfx('pick'); addItem('tabletten', 'laverne'); f.marsFlug = 1;
        await say('bender', 'Ich fliege nur mit, wenn ich etwas mitgehen lassen darf.'); await say('prof', 'Bender bleibt hier.'); await say('bender', 'Ich bin gekränkt. Und reicher. Ich habe dein Portemonnaie.');
        await say('prof', 'Das Schiff ist startklar. Einfach die Rampe hoch! Gute Nachrichten, alle zusammen!');
        note('Neue Aufgabe: Lieferung zum Mars – an der Rampe des Lieferraumschiffs einsteigen.');
        return;
      }
      await say('laverne', 'Nur ein Schwätzchen, Professor.');
    }
    return profOrig();
  };
}

// ---------- Flug zum Mars und zurück ----------
async function marsFlug(hin) {
  const l = 'laverne', f = fl(), z = ACT.zak;
  if (hin && !f.marsFlug) return say(l, f.zakAuftrag ? 'Das Raumschiff gehört dem Professor. Ich frage ihn erst, ob er uns mitnimmt.' : 'Das ist ein Lieferraumschiff. Ohne Ziel und ohne Pilot fliege ich nirgendwohin.');
  if (!hin && !f.zakFertig) { const c = await choose([{ id: 'ja', text: 'Zurück zum Landeplatz fliegen.' }, { id: 'nein', text: 'Noch nicht. Das Gesicht braucht uns.' }]); if (c === 'nein') return say(l, 'Noch nicht. Das Gesicht braucht uns.'); }
  else if (hin) { const c = await choose([{ id: 'ja', text: 'Ab zum Mars!' }, { id: 'nein', text: 'Noch nicht.' }]); if (c === 'nein') return; }
  if (hin && z.room === 'landeplatz') await say('zak', 'Ich fliege mit! Warte, ich muss noch meine Kamera aufladen. Egal, ich fliege einfach!');
  await fadeTo(1, 500, 'black'); Sound.sfx('whoosh');
  G.caption = hin ? 'Ein Raketenflug später ...' : 'Und zurück auf dem Landeplatz ...'; await wait(1800); G.caption = null;
  const ziel = hin ? 'mars' : 'landeplatz', pos = hin ? [360, 394, 1] : [700, 392, -1];
  if (z.room === (hin ? 'landeplatz' : 'mars')) Object.assign(z, hin ? { room: 'mars', x: 440, y: 404, dir: 1 } : { room: 'landeplatz', x: 800, y: 424, dir: -1 });
  await goRoom(l, ziel, ...pos);
}
multi(['use', 'open', 'walk'], 'o:einstieg', () => marsFlug(true));
multi(['use', 'open', 'walk'], 'o:mars_schiff', () => marsFlug(false));
ROOMS.mars.onEnter = async () => {
  const f = fl(); if (f.marsAnkunft) return;
  f.marsAnkunft = 1;
  await wait(500);
  await say('laverne', 'Das ist … riesig. Und es guckt mich an.');
  await say('zak', 'Das Gesicht! Ich wusste es! Es existiert! Hast du das gehört? Es existiert!');
  await say('laverne', 'Ich hör vor allem dich.');
  await say('zak', 'Und es sieht sauer aus. Für die Titelseite brauche ich es lächelnd – „Gesicht auf dem Mars lächelt: Wissenschaftler ratlos“. Das verkauft sich.');
  await say('laverne', 'Und wie kriegen wir es zum Lächeln?'); await say('zak', 'Ich bin Reporter, kein Arzt. Frag doch das Gesicht.');
};

// ---------- Die Lieferung ----------
async function tablettenLiefern() {
  const l = 'laverne', f = fl(), z = ACT.zak;
  if (marsFroh()) return say(l, 'Das Gesicht hat seine Tabletten schon. Für mehr müsste es Kopfschmerzen auf Vorrat haben.');
  await say(l, 'Lieferung für das Gesicht. Persönlich zustellen? Der Briefkasten ist näher.');
  takeItem('tabletten', l); Sound.sfx('clank'); shake(500, 2.5);
  await wait(800);
  Sound.sfx('boulder'); shake(2200, 5); await wait(1300);
  await say('gesicht', 'Mmmmh … Post? … Tabletten?! *grollt* … Seit vier … Millionen … Jahren …');
  Sound.sfx('slurp'); await wait(1300); Sound.sfx('slurp'); await wait(1500);
  f.marsFroh = 1; marsBildNeu(); Sound.sfx('fanfare'); shake(500, 3);
  await say('gesicht', 'Aaaaah. Der Kopf … ist … LEER. Ich hab vergessen, wie das ist!');
  await say('laverne', 'Sie lächeln!'); await say('gesicht', 'Ich lächle?! … Wirklich? … Seit wann kann ich das?');
  await say('zak', 'Nicht bewegen! Halt dieses Lächeln! Drei, zwei …');
  z.fotoBis = G.t + 2400; await wait(900); G.photoFlash = G.t; Sound.sfx('photo'); await wait(900);
  await say('zak', 'Das ist es! Das Foto des Jahrhunderts! Titel: „Gesicht auf dem Mars lächelt: Wissenschaftler ratlos!“');
  await say('laverne', 'Die Wissenschaftler wissen nicht mal, dass es lächelt.'); await say('zak', 'Eben. Perfekt.');
  await say('gesicht', 'Ich lächle nicht für die Presse. … Okay. Doch. Ich mach das jetzt öfter.');
  await say('zak', 'Das muss ich sofort melden! Aber vorher …');
  await say('zak', 'Du hast mir geholfen, Laverne. Das hat vor dir noch keiner. Die meisten halten mich für einen Verrückten mit Kamera.');
  await say('laverne', 'Du bist ein Verrückter mit Kamera. Aber ein netter.');
  await say('zak', 'Wo ist dieses Gästebuch von Dr. Fred? Ich schreibe mich ein. Mit meinem Pressenamen.');
  f.zakFertig = 1;
  await gbSign('zak');
  unlock('exklusiv');
  await say('gesicht', 'Falls ihr mal wieder Tabletten habt … ich nehm auch Nasentropfen.');
}
multi(['use', 'give'], 'i:tabletten o:gesicht', tablettenLiefern);
multi(['use', 'give'], 'i:tabletten o:briefkasten', tablettenLiefern);
multi(['use', 'give'], 'i:tabletten a:gesicht', tablettenLiefern);
RULES['use o:briefkasten'] = line(() => marsFroh() ? 'Der Briefkasten ist leer. Die Fahne ist unten. Das Gesicht hat alles bekommen, was es wollte. Außer Ruhe vielleicht.' : 'Ich öffne den Briefkasten. Leer. Nur ein Zettel: „BITTE NUR EILIGE LIEFERUNGEN. KOPF WEH.“');
RULES['open o:briefkasten'] = RULES['use o:briefkasten'];

ACT.gesicht.talk = async () => {
  const g = 'gesicht', l = 'laverne', f = fl();
  if (!marsFroh()) {
    await say(g, 'Mmmh … Kopf … aua … Schschsch. Nicht so laut. Zu laut.');
    const c = await choose([{ id: 'was', text: 'Was fehlt Ihnen?' }, { id: 'hilfe', text: 'Kann ich Ihnen helfen?' }, { id: 'bye', text: 'Entschuldigung. Ich gehe ganz leise.' }]);
    if (c === 'was') { await say(l, 'Was fehlt Ihnen?'); await say(g, 'Kopfschmerzen. Seit vier Millionen Jahren. Der Sandsturm. Die Monde. Die Touristen. Und dieser Reporter, der immer „Lächeln!“ ruft.'); }
    if (c === 'hilfe') {
      await say(l, 'Kann ich Ihnen helfen?'); await say(g, 'Ich habe keine Hände. Ich bin ein Gesicht. Sonst würde ich selbst nach den Tabletten greifen.');
      await say(g, f.marsFlug ? 'Ach, der Professor hat doch immer was für mich! Die Post kommt in den Briefkasten. Da, bei der Nase.' : 'Wenn jemand … eine Lieferung hätte … aus dem Raumschiff dort … der Professor kennt mich.');
    }
    if (c === 'bye') await say(g, 'Danke. Das war der netteste Satz seit … zweihunderttausend Jahren.');
    return;
  }
  await say(g, 'Aaah, Laverne! Mein Kopf ist so leicht, dass ich schweben könnte. Wenn ich ein Kopf mit Körper wäre.');
  const c = await choose([{ id: 'wer', text: 'Wer sind Sie eigentlich?' }, { id: 'zufall', text: 'Manche sagen, Sie wären nur ein Schatten.' }, { id: 'bye', text: 'Ich muss weiter. Gute Besserung!' }]);
  if (c === 'wer') { await say(l, 'Wer sind Sie eigentlich?'); await say(g, 'Ein Gesicht. Ein altes Gesicht. Ich habe vor Jahrmillionen gelächelt, damit die Marsianer nicht traurig sind. Dann gingen sie, und ich blieb. Mit Kopfschmerzen.'); }
  if (c === 'zufall') { await say(l, 'Manche sagen, Sie wären nur ein Schatten.'); await say(g, 'Schatten! Pah! Ich bin ein natürlich entstandener Felsen. Wenn Sie mich fragen, ob ich eine Verschwörung bin, antworte ich: Ich habe Besseres zu tun. Ich lächle.'); }
  if (c === 'bye') await say(g, 'Danke! Und bringt beim nächsten Mal Nasentropfen mit.');
};

ACT.zak.talk = async () => {
  const z = 'zak', l = curId(), f = fl(), mars = ACT.zak.room === 'mars';
  if (!f.metZak) await say(z, 'Hey! Du hast den Blick von jemandem, der Gerüchte glaubt. Zak McKracken, Reporter bei „Die Sensation“. Auflage: zwölf. Aber zwölf Leser, die mir glauben!');
  else await say(z, f.zakFertig ? 'Die Titelseite steht! Gleich nach dem Rätsel und dem Horoskop. Danke noch mal.' : mars ? 'Siehst du es? Es sieht uns auch.' : 'Na? Schon eine Idee, wie ich zum Mars komme?');
  f.metZak = 1;
  for (;;) {
    const c = await choose([
      { id: 'wer', text: 'Worüber schreibst du so?' }, { id: 'foto', text: 'Was für ein Foto suchst du?' },
      !f.zakAuftrag && f.fotoErklaert && { id: 'hilfe', text: 'Ich helfe dir. Hier gibt es einen Professor mit Raumschiff.' },
      f.zakAuftrag && !f.marsFlug && !mars && { id: 'wie', text: 'Wie komme ich an das Raumschiff?' },
      mars && !marsFroh() && { id: 'smile', text: 'Wie bringen wir das Gesicht zum Lächeln?' },
      { id: 'bye', text: 'Ich muss weiter. Viel Erfolg!' }]);
    if (c === 'bye') { await say(l, 'Ich muss weiter. Viel Erfolg!'); await say(z, 'Erfolg ist, wenn man morgen noch dieselbe Schlagzeile hat. Bis dann!'); return; }
    if (c === 'wer') { await say(l, 'Worüber schreibst du so?'); await say(z, 'Über das, was keiner schreibt. Zwergelefanten in Lagerhallen. Aliens in der Kantine. Chefs, die sich in Insekten verwandeln. Alles wahr, alles belegt, alles auf Seite vier.'); }
    if (c === 'foto') {
      await say(l, 'Was für ein Foto suchst du?');
      await say(z, 'Das Gesicht auf dem Mars! Ein riesiges Steingesicht, das in die Kamera schaut. Alle sagen: Schatten, Zufall, Einbildung. Ich sage: Es lächelt, wenn keiner hinsieht.');
      await say(z, 'Ich brauche ein Foto mit Lächeln, sonst glaubt mir keiner. Aber ich hab keinen Flug. Und mein Blitz ist auch leer.');
      f.fotoErklaert = 1;
    }
    if (c === 'hilfe') {
      await say(l, 'Ich helfe dir. Hier gibt es einen Professor mit Raumschiff.');
      await say(z, 'Der Alte mit der Brille? Er sagt immer „Gute Nachrichten“, aber nie welche für mich. Frag ihn! Ich komme mit, sobald der Flug steht.');
      f.zakAuftrag = 1; note('Neue Aufgabe: Den Professor wegen eines Flugs zum Mars fragen.');
    }
    if (c === 'wie') { await say(l, 'Wie komme ich an das Raumschiff?'); await say(z, f.marsFlug ? 'Der Professor hat Ja gesagt? Dann nichts wie die Rampe hoch!' : 'Sprich den Professor an. Er mag Leute, die was wollen. Und Leute, die zuhören. Beides darfst du sein.'); }
    if (c === 'smile') {
      await say(l, 'Wie bringen wir das Gesicht zum Lächeln?');
      await say(z, 'Es hat Kopfweh, das sieht jeder, der einen Eisbeutel erkennt. Der Professor hat doch eine Lieferung! Und da steht ein Briefkasten: „FÜR: DAS GESICHT“. Ich sage nur: Hausaufgaben.');
    }
  }
};

// ---------- Tipps für die beiden Gäste von Seite 2: als Nebenhinweis hinter dem Haupttipp ----------
{
  const hintBasis = hintText;
  hintText = function () {
    const f = fl(), p = curId(), base = hintBasis();
    let extra = '';
    if (p === 'hoagie' && ACT.bobbin.visible && !f.bobbinFertig) {
      const n = tonGehoert().length;
      extra = !f.metBobbin ? ' Nebenbei: Im Gasthaus steht seit Neuestem ein Fremder in grauer Kapuze – sprich ihn an.'
        : !f.bobbinHilfe ? ' Nebenbei: Bobbin im Gasthaus sieht aus, als könnte er Hilfe brauchen.'
          : n < 4 ? ` Nebenbei: Bobbins vier Töne stecken in Standuhr, Kessel, Brunnen und den Fässern am Hafen – benutze sie (Rechtsklick). ${n} von 4 gehört.`
            : ' Nebenbei: Alle vier Töne sind gehört – spiel sie auf dem Spinnrocken in der Reihenfolge von Bobbins Vers.';
    }
    if (p === 'laverne' && ACT.zak.visible && !f.zakFertig) {
      extra = !f.metZak ? ' Nebenbei: Auf dem Landeplatz wartet ein Reporter mit Kamera – sprich ihn an.'
        : !f.zakAuftrag ? ' Nebenbei: Zak auf dem Landeplatz sucht jemanden, der ihm bei einem Foto hilft.'
          : !f.marsFlug ? ' Nebenbei: Frag den Professor am Landeplatz, ob er euch zum Mars fliegt.'
            : ACT.laverne.room !== 'mars' ? ' Nebenbei: Steig an der Rampe des Lieferraumschiffs ein – es geht zum Mars.'
              : ' Nebenbei: Das Gesicht auf dem Mars braucht seine Lieferung. Der Briefkasten steht neben seiner Nase.';
    }
    return base + extra;
  };
}
