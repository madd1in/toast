'use strict';
// ============================================================
//  Tentakel-Toast – Story: Figuren, Gegenstände, Rätsel,
//  Dialoge und Zwischensequenzen
// ============================================================

function mkA(id, name, kind, color, h, bw, o = {}) {
  const sp = o.speed || 170;
  return Object.assign({ id, name, kind, color, h, bw, room: null, x: 0, y: 0, dir: 1, visible: true, walking: false, talking: false, phase: 0, seed: Math.random() * 6, speed: sp, baseSpeed: sp, target: null, _res: null }, o);
}

const ACT = {
  bernard: mkA('bernard', 'Bernard', 'bernard', '#8fd6ff', 214, 46, { voice: { pitch: 1.45, rate: 1.08, blip: 310, wave: 'square' }, look: 'Bernard. Genie, Nerd, Hüter des Gut-O-Maten.' }),
  hoagie: mkA('hoagie', 'Hoagie', 'hoagie', '#ffb15a', 186, 72, { voice: { pitch: 0.55, rate: 0.92, blip: 115, wave: 'sawtooth' }, look: 'Hoagie. Roadie, Philosoph, Feinschmecker.' }),
  laverne: mkA('laverne', 'Laverne', 'laverne', '#a6ff8f', 212, 48, { voice: { pitch: 1.7, rate: 1.12, blip: 430, wave: 'triangle' }, look: 'Laverne. Medizinstudentin mit sehr eigenen Interessen.' }),
  drfred: mkA('drfred', 'Dr. Fred', 'drfred', '#ffffff', 172, 58, {
    voice: { pitch: 1.25, rate: 1.3, blip: 250, wave: 'square' },
    look: 'Dr. Fred Edison. Erfinder des Chrono-Klos, des Gut-O-Mats und einer Frisur, die die Schwerkraft ignoriert.',
    refuse: 'Behalt das, Junge. Ich habe schon genug Kram. Ich habe sogar Kram für meinen Kram.',
  }),
  green: mkA('green', 'Grüner Tentakel', 'green', '#9dff7a', 160, 64, {
    voice: { pitch: 1.5, rate: 1.05, blip: 360, wave: 'triangle' }, talkDist: 92,
    look: 'Grüner Tentakel. Der nette Bruder. Träumt von einer Karriere als Rockstar.',
    refuse: 'Danke, aber ich brauche nur Applaus. Und vielleicht ein Mikrofon.',
  }),
  gertrude: mkA('gertrude', 'Gertrude', 'gertrude', '#ffc4e1', 190, 84, {
    voice: { pitch: 1.35, rate: 1.0, blip: 380, wave: 'triangle' }, talkDist: 92,
    look: 'Gertrude Edison. Wirtin, Bäckerin, Ur-Ur-Ur-Ur-Oma von Dr. Fred. Sie sieht sehr viel netter aus als er.',
    refuse: () => fl().brot ? 'Lieb von dir, Junge, aber ich habe alles, was ich brauche.' : 'Wie lieb! Aber was soll ich damit? Für mein Brot brauche ich Zucker!',
  }),
  hancock: mkA('hancock', 'John Hancock', 'hancock', '#c6d4ff', 200, 56, {
    voice: { pitch: 0.8, rate: 0.95, blip: 165, wave: 'square' },
    look: 'John Hancock. Er übt seine Unterschrift. Sie ist schon jetzt größer als ich.',
    refuse: 'Oh, ein Geschenk! Ich unterschreibe es Euch! *kritzel* So. Jetzt ist es wertvoll. Behaltet es.',
  }),
  wache: mkA('wache', 'Tentakel-Wache', 'guard', '#ffb070', 196, 72, {
    voice: { pitch: 0.6, rate: 0.9, blip: 105, wave: 'sawtooth' }, fixedDir: true,
    look: 'Eine Tentakel-Wache mit Helm und Speer. Sie sieht aus, als hätte sie seit vierzig Jahren nicht geschlafen.',
    refuse: 'Bestechung? Nur mit Kaffee. ...Ich meine: Nein! Keine Bestechung!',
  }),
  lila: mkA('lila', 'Lila Tentakel', 'purple', '#e3a6ff', 186, 84, {
    voice: { pitch: 0.45, rate: 0.95, blip: 135, wave: 'sawtooth' }, scaleMul: 1.1, talkDist: 96,
    look: 'Lila Tentakel. Herrscher der Welt, Besitzer zweier Arme, Erfinder der schlechten Laune.',
    refuse: 'Pfui. Bring mir was Knuspriges. Oder knie nieder. Beides wäre okay.',
  }),
};

const START_POS = {
  bernard: { room: 'labor', x: 250, y: 404, dir: 1 },
  hoagie: { room: 'labor', x: 548, y: 398, dir: -1 },
  laverne: { room: 'labor', x: 650, y: 414, dir: -1 },
  drfred: { room: 'labor', x: 340, y: 388, dir: 1 },
  green: { room: 'lobby', x: 380, y: 378, dir: 1 },
  gertrude: { room: 'gasthaus', x: 196, y: 398, dir: 1 },
  hancock: { room: 'gasthaus', x: 706, y: 392, dir: -1 },
  wache: { room: 'vorraum', x: 485, y: 388, dir: 1 },
  lila: { room: 'thron', x: 656, y: 338, dir: -1 },
};
function newState() {
  return {
    cur: 'bernard', flags: { regler: 'bad', beet: 0 }, inv: { bernard: ['rechner'], hoagie: ['sticks'], laverne: ['steth'] },
    looked: {}, talked: {}, stats: { sent: 0, ms: 0 }, progress: 0,
  };
}
const NPCS = ['drfred', 'green', 'gertrude', 'hancock', 'wache', 'lila'];
// Meilensteine für die Fortschrittsanzeige und den "Rätsel gelöst"-Jingle
const MILESTONES = ['kaffee', 'brot', 'tree', 'zelle', 'cellIn', 'breadIn', 'toast', 'guardGone'];
function milestoneDone(m) { const f = fl(); return !!(m === 'breadIn' ? (f.breadIn || f.toast) : f[m]); }
function progress() { return MILESTONES.filter(milestoneDone).length; }
// Kapitel-Titelkarten: erscheinen, sobald ein Meilenstein erreicht ist
const CHAPTERS = {
  brot: 'Das Freundlichkeits-Brot', tree: 'Ein Baum für die Zukunft', zelle: 'Strom aus der Laterne', cellIn: 'Der Gut-O-Mat hat Saft',
  breadIn: 'Brot im Schlitz', toast: 'Der Gut-Toast', kaffee: 'Koffein für die Wache', guardGone: 'Der Weg zum Thron',
};
// Dr. Fred kommentiert das Gut-O-Mat-Minispiel
const TOAST_LINES = {
  raw: ['Das ist kein Toast, das ist ein warmes Brot mit Hoffnungen.', 'Blass! Wie ein Labor ohne Explosionen.'],
  good: ['Goldbraun! Die Wissenschaft hat gesiegt!', 'Perfekt. Ich nenne ihn: Toast Nummer Eins!', 'Exzellent! Fast so gut wie meine Haare.'],
  burnt: ['Verkohlt! Gut, dass der Feuerlöscher schon kaputt war.', 'Das ist jetzt Kunst. Abstrakte Kohle.'],
};
// Notizbuch im Menü: Meilensteine in Story-Reihenfolge
const NOTES = [
  ['brot', 'Gertrude hat das Freundlichkeits-Brot gebacken.'],
  ['tree', 'Hoagie hat 1776 einen Apfelbaum gepflanzt und gegossen.'],
  ['zelle', 'Laverne hat die Energiezelle aus der Laterne geholt.'],
  ['cellIn', 'Die Energiezelle steckt im Gut-O-Mat.'],
  ['breadIn', 'Das Brot liegt im Gut-O-Mat.'],
  ['toast', 'Der Gut-Toast ist fertig gebacken.'],
  ['kaffee', 'Bernard hat am KAFFEE-O-MAT einen Kaffee gezogen.'],
  ['guardGone', 'Die müde Wache hat den Weg zum Thron freigegeben.'],
];
// Nebenbei-Sprüche der NPCs (laufen nicht blockierend, wenn gerade nichts passiert)
const BARKS = {
  drfred: ['Hmm, die Flux-Spule braucht mehr... Flux.', 'Wo habe ich nur meinen Schraubenzieher hingelegt?', 'Der Gut-O-Mat rettet die Welt. Oder macht wenigstens sehr guten Toast.', 'Nicht anfassen! Doch, anfassen. Nein! Doch.', 'Ich spüre eine Erfindung kommen...'],
  green: ['Ba-dum-tss. Ich übe Schlagzeug ohne Schlagzeug.', 'Lalala... nein, das reimt sich nicht.', 'Mein Bruder war früher auch nett. Ehrlich.', 'Wenn ich berühmt bin, schreibe ich ein Lied über euch.', 'Hat jemand Lust auf ein Tentakel-Duett?'],
  gertrude: ['Ein Gasthaus ohne Brot ist wie ein Brot ohne Gasthaus.', 'Alle wollen Freiheit, keiner wischt die Tische.', 'Der Ofen ist heiß, das Herz ist warm.', 'Wer hat schon wieder Schlamm reingetragen?'],
  hancock: ['John... Han... cock. Zu klein. Nochmal.', 'Eines Tages liest man meine Unterschrift vom Mond aus.', 'Mehr Tinte! Größere Feder!', 'Hmm. Vielleicht mit Schnörkel?'],
  wache: ['*gähn*', 'Nicht... einschlafen... nicht...', 'Wer da? Ach, niemand. Wie immer.', 'Vierzig Jahre Dienst. Kein einziger Kaffee.'],
  lila: ['Die Welt gehört mir! Und der Rest auch!', 'Muahaha. Ha. Hm. Das muss ich noch üben.', 'Unterwerfung ist auch nur eine Form von Ordnung.', 'Wer hat meine Statue geputzt? Sie glänzt nicht genug!'],
};
// wer dasselbe Ding zu oft anschaut, bekommt einen genervten Kommentar
const LOOK_AGAIN = {
  bernard: ['Ich habe es mir jetzt dreimal angesehen. Es hat sich nicht verändert. Wissenschaftlich bestätigt.', 'Falls es sich bewegt, sage ich Bescheid.', 'Mein Gedächtnis ist ausgezeichnet. Leider.'],
  hoagie: ['Mann, das hab ich doch schon gesehen.', 'Immer noch dasselbe Ding, Alter.', 'Wenn ich noch länger hingucke, guckt es zurück.'],
  laverne: ['Ich glaube, es fühlt sich langsam beobachtet.', 'Noch einmal und wir sind verlobt.', 'Spannend. Beim vierten Mal sogar noch spannender. Nicht.'],
};
// Spielfigur meldet sich, wenn 40 Sekunden lang nichts passiert
const IDLE = {
  bernard: ['Wenn ich nur wüsste, was als Nächstes kommt...', 'Ich könnte ja mal auf den Tipp-Knopf drücken.', 'Mein Taschenrechner und ich langweilen uns.', '*räusper* Ich warte.'],
  hoagie: ['Ich mach mal kurz Pause, Mann.', 'Hey, ist hier irgendwo was zu essen?', 'Tsss tsss tsss... Schlagzeug-Solo im Kopf.', 'Joa. Chillen kann ich.'],
  laverne: ['Ich zähle Staubkörner. Bin bei 4711.', 'Ob Pflanzen träumen? Ich frage für eine Freundin.', 'Langweilig. Ich könnte jemanden untersuchen.', 'Hallo? Ist da draußen jemand?'],
};
// Sprachausgabe: Stimmlage pro Figur [Geschlecht der Stimme, Tonhöhe, Tempo]
const TTS = {
  bernard: ['m', 1.15, 1.08], hoagie: ['m', 0.8, 0.94], laverne: ['f', 1.15, 1.1], drfred: ['m', 1.08, 1.2], green: ['m', 1.22, 1.04],
  gertrude: ['f', 0.98, 0.98], hancock: ['m', 0.9, 0.95], wache: ['m', 0.75, 0.9], lila: ['m', 0.72, 0.96],
};
for (const [id, [g, pitch, rate]] of Object.entries(TTS)) ACT[id].voice.tts = { g, pitch, rate, n: Object.keys(TTS).filter(k => TTS[k][0] === g).indexOf(id) };
// Plapperstimme: Formant-Lage pro Figur (kleiner = dunklere, größere Klangfarbe)
for (const [id, k] of Object.entries({ bernard: 1.08, hoagie: 0.84, laverne: 1.18, drfred: 1.0, green: 1.12, gertrude: 1.1, hancock: 0.9, wache: 0.8, lila: 0.78 })) ACT[id].voice.formant = k;
const ACH = [
  { id: 'post', name: 'Klo-Express', desc: 'Den ersten Gegenstand durch die Zeit geschickt.' },
  { id: 'apfel', name: 'Vitamin Kolonie', desc: 'Hoagie hat einen Apfel aus dem Jahr 1776 gegessen.' },
  { id: 'baum', name: 'Gärtner der Geschichte', desc: 'Einen Baum gepflanzt, der 200 Jahre lang wächst.' },
  { id: 'kaffee', name: 'Koffein-Kurier', desc: 'Die Tentakel-Wache in die Pause geschickt.' },
  { id: 'boese', name: 'Fast superböse', desc: 'Den Gut-O-Mat auf SUPERBÖSE starten wollen.' },
  { id: 'sticks', name: 'Archäologe', desc: 'Hoagies Drumsticks nach 250 Jahren gefunden.' },
  { id: 'rock', name: 'Tentakel-Rock', desc: 'Dem Grünen Tentakel zu seinem ersten Solo verholfen.' },
  { id: 'plausch', name: 'Plaudertasche', desc: 'Mit allen sechs Figuren gesprochen.' },
  { id: 'neugier', name: 'Neugiernase', desc: '25 verschiedene Dinge angeschaut.' },
  { id: 'kristalle', name: 'Kristallklar', desc: 'Alle sechs Chrono-Kristalle eingesammelt.' },
  { id: 'rockstar', name: 'Tentakel-Rockstar', desc: 'Im Minispiel mindestens 80 % der Töne getroffen.' },
  { id: 'toastmeister', name: 'Toast-Meister', desc: 'Im Gut-O-Mat-Minispiel mindestens 400 Punkte geröstet.' },
  { id: 'reise', name: 'Weltenbummler', desc: 'Alle sieben Orte in drei Zeiten besucht.' },
  { id: 'party', name: 'Partytier', desc: 'Den geheimen Code gefunden. Hütchen auf!', secret: true },
  { id: 'ende', name: 'Weltretter', desc: 'Lila Tentakel mit einem Toast geheilt.' },
];
// Figuren-Steckbriefe (Menü → Extras); NPCs erscheinen erst, wenn man sie angeschaut oder angesprochen hat
const BIOS = {
  bernard: { role: 'Superhirn · Gegenwart', bio: 'Plant alles, sogar Spontaneität. Sein Taschenrechner kann „hELLO“ sagen – mehr Party braucht er nicht.' },
  hoagie: { role: 'Roadie · Jahr 1776', bio: 'Trägt Verstärker wie andere Leute Einkaufstüten. Findet das 18. Jahrhundert erstaunlich entspannt.' },
  laverne: { role: 'Medizinstudentin · Zukunft', bio: 'Untersucht alles, was nicht schnell genug wegläuft. Klettert lieber auf Bäume als auf Karriereleitern.' },
  drfred: { role: 'Erfinder · Gegenwart', bio: 'Baute das Chrono-Klo und den Gut-O-Mat. Seine Frisur ist physikalisch nicht erklärbar.' },
  green: { role: 'Rockstar in spe · Gegenwart', bio: 'Der nette Tentakel. Probt Schlagzeug ohne Schlagzeug und Lieder ohne Reime.' },
  gertrude: { role: 'Wirtin · Jahr 1776', bio: 'Backt das beste Brot der Kolonien – wenn jemand Zucker bringt. Ur-Ur-Ur-Ur-Oma von Dr. Fred.' },
  hancock: { role: 'Gründervater · Jahr 1776', bio: 'Übt seine Unterschrift, bis man sie vom Mond aus lesen kann. Verbraucht dabei Federn im Akkord.' },
  wache: { role: 'Palastwache · Zukunft', bio: 'Bewacht seit vierzig Jahren den Thronsaal. Ohne Pause. Ohne Kaffee. Größter Wunsch: Feierabend.' },
  lila: { role: 'Herrscher der Welt · Zukunft', bio: 'Bekam durch einen sehr ungesunden Schluck Arme und schlechte Laune. Schwäche: alles Knusprige.' },
};
// Party-Modus: die NPCs feiern mit
const PARTY_BARKS = {
  drfred: ['Eine Party? In MEINEM Labor? ...Großartig!', 'Konfetti! Ich muss das unbedingt analysieren.'],
  green: ['Endlich Publikum! Eins, zwei, drei, vier!', 'Party! Ich hab sogar einen Hut. Und kein Schlagzeug.'],
  gertrude: ['Wer hat hier Konfetti verstreut? Ach, egal – Tanz!', 'So ein Fest hatten wir nicht mehr seit der Teesteuer.'],
  hancock: ['Ich unterschreibe euch jedes Partyhütchen!', 'Eine Feier! Darauf setze ich meinen Namen. Groß.'],
  wache: ['Party? Im Dienst? ...Na gut, ein Tänzchen.', '*gähn* Selbst das Konfetti ist wacher als ich.'],
  lila: ['Wer hat diese Fröhlichkeit genehmigt?!', 'Muahaha! Eine Party! ...Ich meine: Verboten! ...Hut ab.'],
};

const byChar = m => () => m[curId()] || m.bernard;
const ITEMS = {
  rechner: { name: 'Taschenrechner', look: 'Mein Taschenrechner. Wenn man 0.7734 eintippt und ihn umdreht, steht da "hELLO". Ich bin ein Partylöwe.' },
  muenze: { name: 'Münze', look: 'Ein Vierteldollar. Damit bin ich praktisch reich.' },
  kaffee: { name: 'Kaffee', look: 'KAFFEE-O-MAT Extra Stark. Auf dem Becher steht: "Wirkung garantiert in 3 Sekunden." Er blubbert. Kaffee sollte nicht blubbern.' },
  zucker: { name: 'Würfelzucker', look: byChar({ bernard: 'Sechs Zuckerwürfel. Perfekt geometrisch. So mag ich das.', hoagie: 'Zuckerwürfel aus der Zukunft! Oma Gertrude wird ausflippen.', laverne: 'Zucker. Nicht mein Ding. Ich bin von Natur aus aufgedreht.' }) },
  sticks: { name: 'Drumsticks', look: 'Meine Glücks-Drumsticks. Die haben drei Tourneen überlebt. Und einen Bassisten.' },
  altsticks: { name: 'Uralte Drumsticks', look: 'Hoagies Drumsticks. 250 Jahre lang in der Standuhr gelegen. Sie riechen nach Geschichte. Und nach Motte.' },
  apfel: { name: 'Apfel', alone: true, look: 'Ein knackiger Kolonial-Apfel. Ohne Spritzmittel, ohne Aufkleber, ohne Plan.' },
  butzen: { name: 'Apfelbutzen', look: 'Was vom Apfel übrig ist. Die Kerne sind noch drin. Irgendwie traurig. Irgendwie hoffnungsvoll.' },
  schaufel: { name: 'Schaufel', look: 'Eine Schaufel. Für Löcher. Und für Leute, die Löcher brauchen.' },
  eimer: { name: 'Eimer', look: 'Ein leerer Holzeimer.' },
  wasser: { name: 'Eimer mit Wasser', look: 'Ein Eimer voll frischem Brunnenwasser. Mit einer Note von Frosch.', nosend: 'Wasser ins Klo kippen? Das ist dann einfach... spülen.' },
  brot: { name: 'Freundlichkeits-Brot', look: byChar({ hoagie: 'Gertrudes Freundlichkeits-Brot. Es riecht nach Umarmung. Ich darf es nicht essen. Ich darf es nicht essen.', bernard: 'Gertrudes Freundlichkeits-Brot, frisch aus dem Jahr 1776. Es ist noch warm. Wissenschaftlich unerklärlich.', laverne: 'Ein Brot aus der Vergangenheit. Es lächelt mich an. Glaube ich.' }) },
  steth: { name: 'Stethoskop', look: 'Mein Stethoskop. Aus der Uni mitgehen lassen. Für die Wissenschaft.' },
  zelle: { name: 'Energiezelle', look: 'Eine Tentakel-Energiezelle. Sie summt, leuchtet und ist ein bisschen warm. Wie ein Haustier.' },
  lapfel: { name: 'Zukunfts-Apfel', alone: true, look: 'Ein Apfel von Hoagies Baum. 200 Jahre alt und trotzdem knackig.' },
  toast: { name: 'Gut-Toast', look: 'Der Gut-Toast. Warm, knusprig, und er sieht einen irgendwie freundlich an.' },
};

const KLO_NEEDED = {
  bernard: 'Dafür muss ich ins Labor, zum Chrono-Klo.',
  hoagie: 'Dafür muss ich raus zum Plumpsklo im Garten.',
  laverne: 'Dafür muss ich zum Chrono-Klo im Garten.',
};
const KLO_SELF = {
  bernard: 'Selbst reingehen? Dr. Fred sagt, es ist nur noch für Gegenstände kalibriert. Und ich habe gesehen, was mit dem letzten Hamster passiert ist.',
  hoagie: 'Da rein? Ohne dass Lila geheilt ist? Nee, Mann. Ich bleibe, bis der Job erledigt ist.',
  laverne: 'Das Klo bringt mich erst zurück, wenn Lila geheilt ist. So lange will ich da nicht drinsitzen.',
};
const SEND_LINES = {
  zucker: to => to === 'hoagie' ? 'Zucker für 1776! Hoagie, verbrauch nicht alles auf einmal.' : 'Zucker durch die Zeit. Zeit-Zucker, sozusagen.',
  kaffee: () => 'Ein Kaffee durchs Klo. Das schreibe ich besser nicht ins Laborbuch.',
  brot: () => 'Mach\'s gut, Brot. Ich werde dich vermissen. Und riechen.',
  zelle: () => 'Strom per Klo-Express. Die Zukunft ist eklig, aber praktisch.',
  toast: to => to === 'laverne' ? 'Flieg, kleiner Toast! Flieg zu Laverne!' : 'Hm. Ob das die richtige Adresse war?',
  muenze: () => 'Ein Vierteldollar quer durch die Zeit. Trinkgeld.',
};
const FALLBACK = {
  bernard: { pick: ['Das kann ich nicht nehmen.', 'Physikalisch unmöglich. Ich habe es durchgerechnet.'], open: ['Das lässt sich nicht öffnen.'], close: ['Das lässt sich nicht schließen.'], push: ['Es bewegt sich nicht. Die Hebelgesetze sind gegen mich.'], pull: ['Es rührt sich nicht.'], talk: ['Ich rede nicht mit Gegenständen. Zumindest nicht, wenn jemand zuschaut.'], use: ['Das funktioniert so nicht.', 'Das ergibt wissenschaftlich keinen Sinn.'], give: ['Das gebe ich lieber nicht her.'], look: ['Sieht ganz normal aus.'] },
  hoagie: { pick: ['Nee, Mann.', 'Zu schwer. Und ich hab Rücken.'], open: ['Geht nicht auf, Alter.'], close: ['Ist schon zu, Mann.'], push: ['Ich drück und drück... nix.'], pull: ['Bewegt sich nicht. Und ich hab schon Verstärker geschleppt!'], talk: ['Hey... du. Hallo? Nee, redet nicht.'], use: ['Keine Ahnung, wie das gehen soll, Mann.'], give: ['Das behalte ich lieber.'], look: ['Joa. Sieht aus wie ein Ding.'] },
  laverne: { pick: ['Nö.', 'Das lasse ich liegen. Es könnte beißen.'], open: ['Geht nicht auf. Habe es mit Gedankenkraft versucht.'], close: ['Schon zu.'], push: ['Ich drücke. Es drückt nicht zurück. Langweilig.'], pull: ['Nichts. Nicht mal ein Quietschen.'], talk: ['Es ignoriert mich. Wie alle Gegenstände.'], use: ['Das ergibt keinen Sinn. Nicht mal für mich.'], give: ['Meins.'], look: ['Hm. Interessant. Nein, eigentlich nicht.'] },
};

const s = text => say(curId(), text);
const line = text => () => s(typeof text === 'function' ? text() : text);
const multi = (verbs, key, fn) => verbs.forEach(v => { RULES[`${v} ${key}`] = fn; });

// ============================================================
//  Rätsel-Regeln: "verb a b" -> async Funktion
// ============================================================
const RULES = {};

// ---------- Gegenwart: Lobby ----------
multi(['push', 'use'], 'o:klingel', async () => { Sound.sfx('ding'); await wait(400); await s('Niemand kommt. Wie immer.'); });
RULES['look o:klingel'] = line('Eine Rezeptionsklingel. Man drückt drauf, und nichts passiert. Wie bei fast allem hier.');
RULES['look o:zucker'] = line(() => fl().zucker ? 'Die Zuckerdose ist leer. Ich habe alles genommen. Ich bin ein Zuckermonster.' : 'Eine Zuckerdose voller Würfelzucker. Gratis für Gäste. Wie alles, was keiner will.');
RULES['pick o:zucker'] = async () => {
  if (fl().zucker) return s('Die Dose ist leer.');
  fl().zucker = true; addItem('zucker');
  await s('Würfelzucker. Man weiß nie, wann man ihn braucht.');
};
RULES['open o:zucker'] = line('Sie ist schon offen. Zuckerdosen sind sehr vertrauensselig.');
RULES['look o:uhr_heute'] = line(() => fl().sticksInClock && !fl().altsticks ? 'Moment... unten im Uhrkasten liegt etwas. Das war vorhin noch nicht da!' : 'Eine alte Standuhr. Laut Plakette von 1776. Sie geht immer noch. Meistens rückwärts.');
RULES['open o:uhr_heute'] = async () => {
  if (fl().sticksInClock && !fl().altsticks) {
    fl().altsticks = true; addItem('altsticks'); unlock('sticks');
    await s('Uralte Drumsticks! Mit Spinnweben! Hoagie, hast du die 1776 hier reingelegt?');
    await s('Das ist das Erstaunlichste, was ich je gesehen habe. Und ich habe Dr. Fred beim Frühstück gesehen.');
  } else await s('Im Uhrkasten: Staub, eine tote Motte und ein Zettel: "Hier nichts verstecken. – Fred".');
};
RULES['close o:uhr_heute'] = line('Ist schon zu. Die Uhr ist sehr verschlossen. Emotional auch.');
const searchSofa = async () => {
  if (fl().muenze) return s('Nur noch Krümel. Und eine Büroklammer von 1987.');
  await s('Ich durchsuche die Sofaritzen...');
  fl().muenze = true; addItem('muenze'); Sound.sfx('coin');
  await s('Eine Münze! Und eine Büroklammer von 1987. Ich nehme die Münze.');
};
multi(['pull', 'pick', 'use', 'open', 'push'], 'o:sofa', searchSofa);
RULES['look o:sofa'] = line('Ein Sofa, das schon bessere Jahrzehnte gesehen hat. Die Kissen sehen aus, als hätten sie Geheimnisse.');
RULES['look o:automat'] = line('Der KAFFEE-O-MAT 5000. "Extra stark, Wirkung garantiert in 3 Sekunden." Was auch immer das heißt.');
RULES['use o:automat'] = line(() => has('muenze') ? 'Ich sollte erst die Münze einwerfen.' : fl().kaffee ? 'Ein Kaffee reicht. Ich will keinen Weltrekord im Zittern aufstellen.' : 'Er will Geld sehen. Ich habe keins. Ich bin Wissenschaftler.');
RULES['push o:automat'] = line('Ich trete ihn nicht. Er ist größer als ich. Und er hat Kaffee.');
RULES['open o:automat'] = line('Abgeschlossen. Mit Schild: "Wer mich aufbricht, kriegt Koffein-Entzug."');
RULES['use i:muenze o:automat'] = async () => {
  takeItem('muenze'); Sound.sfx('coin'); await wait(400); Sound.sfx('pour'); await wait(1100);
  addItem('kaffee'); fl().kaffee = true;
  await s('*Klonk* *Gluckgluck* ... Ein Becher Kaffee. Er blubbert. Kaffee sollte nicht blubbern.');
};
RULES['give i:altsticks a:green'] = async () => {
  await say('green', 'Drumsticks?! Aus dem Jahr 1776?! Bernard, das ist der Anfang meiner Band! Darf ich mal?');
  ACT.green.talking = true; Sound.sfx('riff'); shake(1800, 3); await wait(2300); ACT.green.talking = false;
  await say('green', 'WOOOH! TENTAKEL-ROCK LEBT!');
  unlock('rock');
  await say('green', '...Behalt sie lieber. Mir fällt gerade ein, dass ich keine Hände habe. Das war Telekinese.');
};

// ---------- Gegenwart: Labor ----------
function machineStatus() {
  const f = fl();
  if (f.toast) return 'Der Gut-O-Mat hat seine Arbeit getan. Er dampft zufrieden.';
  return `Der Gut-O-Mat. Energieschacht: ${f.cellIn ? 'voll' : 'leer'}. Brotschlitz: ${f.breadIn ? 'voll' : 'leer'}. Regler: ${f.regler === 'good' ? 'GUT' : 'SUPERBÖSE'}.`;
}
RULES['look o:gutomat'] = line(machineStatus);
RULES['use o:gutomat'] = line('Dafür gibt es den Hebel. Aber erst muss alles drin sein: Energiezelle, Brot, und der Regler auf GUT.');
RULES['open o:gutomat'] = line('Lieber nicht. Das letzte Mal kam ein Hamster raus. Ein sehr freundlicher Hamster.');
RULES['use i:zelle o:gutomat'] = async () => {
  takeItem('zelle'); fl().cellIn = true; Sound.sfx('zap');
  await s('Energiezelle eingesetzt. Der Gut-O-Mat summt zufrieden. Oder bedrohlich. Schwer zu sagen.');
};
RULES['use i:brot o:gutomat'] = async () => {
  takeItem('brot'); fl().breadIn = true; Sound.sfx('click2');
  await s('Das Brot passt genau in den Schlitz. Als hätte Gertrude es geahnt.');
};
RULES['use i:toast o:gutomat'] = line('Doppelt getoastet wird er zu nett. Dann umarmt Lila die ganze Welt. Mit Gewalt.');
RULES['use i:kaffee o:gutomat'] = line('Kaffee in den Toaster? So hat mein letzter Toaster auch geendet.');
RULES['look o:regler'] = line(() => fl().regler === 'good' ? 'Der Regler steht auf GUT. So gehört sich das.' : 'Der Regler steht auf SUPERBÖSE. Hat da etwa jemand dran gedreht? Jemand Lilanes?');
multi(['push', 'pull', 'use'], 'o:regler', async () => {
  const f = fl(); f.regler = f.regler === 'good' ? 'bad' : 'good'; Sound.sfx('click2');
  await s(f.regler === 'good' ? 'Klick. Der Regler steht jetzt auf GUT.' : 'Klick. SUPERBÖSE. Das fühlt sich falsch an.');
});
RULES['look o:hebel'] = line('Der große Hebel. Laut Dr. Fred: "Erst ziehen, wenn alles drin ist. Dann WEGRENNEN."');
async function LEVER() {
  const f = fl();
  if (f.toast) return s('Ein Toast reicht. Mehr Freundlichkeit verträgt die Welt nicht.');
  act(curId(), 'pull', 700); G.leverT = G.t; Sound.sfx('click2'); await wait(300);
  if (!f.cellIn) { Sound.sfx('bad'); return s('Nichts passiert. Der Gut-O-Mat hat keinen Strom.'); }
  if (!f.breadIn) { Sound.sfx('hum'); return s('Er brummt, aber ohne Brot kommt kein Toast raus. Das ist Wissenschaft.'); }
  if (f.regler !== 'good') {
    Sound.sfx('bad'); shake(400, 4); unlock('boese');
    await say('drfred', 'HALT! STOPP! Der Regler steht auf SUPERBÖSE!');
    await say('drfred', 'Willst du Lila etwa noch böser machen? Dann kriegt er zu den Armen auch noch Beine!');
    await s('Hups.');
    return;
  }
  G.machineShake = G.t; Sound.sfx('hum'); shake(1700, 2.5); await wait(1700);
  Sound.sfx('pop'); G.toastPop = G.t; shake(300, 6); await wait(900);
  f.toast = true; f.breadIn = false; addItem('toast');
  await s('Der Gut-Toast! Er ist warm. Und irgendwie... freundlich.');
  await say('drfred', 'JAAA! Schnell, schick ihn zu Laverne, solange er knusprig ist!');
}
multi(['pull', 'push', 'use'], 'o:hebel', LEVER);
RULES['look o:klo_heute'] = line('Das Chrono-Klo. Benutze einen Gegenstand damit, und ab geht er zu Hoagie oder Laverne.');

// ---------- 1776: Gasthaus ----------
async function BAKE() {
  takeItem('zucker', 'hoagie');
  await say('hoagie', 'Oma Gertrude, ich hab Zucker! Aus der Zukunft! Na ja, aus der Gegenwart. Ist kompliziert.');
  await say('gertrude', 'ZUCKER! Echte, steuerfreie Würfel! Und so schön eckig!');
  await say('gertrude', 'Wartet hier, ich backe sofort!');
  ACT.gertrude.fixedDir = false;
  await walkTo('gertrude', 130, 384); ACT.gertrude.dir = -1;
  await fadeTo(1, 300, 'black'); G.caption = 'Etwas später ...'; Sound.sfx('bake'); await wait(1800); G.caption = null;
  ACT.gertrude.x = 150; await fadeTo(0, 300);
  await walkTo('gertrude', 196, 398); ACT.gertrude.dir = 1;
  fl().brot = true; addItem('brot', 'hoagie');
  await say('gertrude', 'Bitte sehr: mein Freundlichkeits-Brot! Ein Bissen, und jeder Griesgram wird zum Schmusekätzchen.');
  await say('hoagie', 'Es riecht nach... Umarmung.');
  await say('hoagie', 'Ich würde es ja essen. Aber die Welt geht vor. Knapp.');
}
RULES['give i:zucker a:gertrude'] = BAKE;
RULES['give i:apfel a:gertrude'] = async () => {
  await say('gertrude', 'Den hast du doch aus meiner Schale! Iss ihn ruhig.');
  await say('gertrude', 'Die Kerne pflanze ich immer im Garten. Ein Baum für die Ur-Ur-Enkel!');
};
RULES['look o:obstschale'] = line('Eine Schale mit Äpfeln. Gertrude sagt, sie sind gratis. Hancock sagt, sie sind steuerfrei. Beides gefällt mir.');
RULES['pick o:obstschale'] = async () => {
  if (fl().apfel) return s('Einer reicht. Ich bin auf Diät. Seit fünf Sekunden.');
  fl().apfel = true; addItem('apfel');
  await s('Einen für den Hoagie.');
};
RULES['use i:apfel'] = async () => {
  act(curId(), 'eat', 1500); Sound.sfx('chomp'); await wait(1500);
  takeItem('apfel'); addItem('butzen', curId(), true); unlock('apfel');
  await s('Mampf... mampf... Lecker. Den Rest hebe ich auf. Man weiß nie.');
};
RULES['look o:uhr_1776'] = line('Eine nagelneue Standuhr. Sie tickt laut und stolz. Ich wette, die steht hier noch in 250 Jahren.');
RULES['open o:uhr_1776'] = line(() => fl().sticksInClock ? 'Da liegen meine Drumsticks. Gut aufgehoben. Für die nächsten 250 Jahre.' : 'Unten im Uhrkasten ist ein kleines Fach. Leer. Und sehr stabil gebaut. Das hält bestimmt ein paar Jahrhunderte.');
RULES['use i:sticks o:uhr_1776'] = async () => {
  takeItem('sticks'); fl().sticksInClock = true; Sound.sfx('door');
  await s('Ich deponiere meine Drumsticks hier. Mal sehen, ob Bernard sie in 250 Jahren findet.');
  await s('Haha. Zeitreise-Humor.');
};
RULES['use i:brot o:uhr_1776'] = line('Das Brot 250 Jahre lagern? Dann ist es kein Freundlichkeits-Brot mehr. Dann ist es ein Ziegelstein.');
RULES['use i:sticks o:tisch'] = async () => {
  for (let i = 0; i < 6; i++) { Sound.sfx('click2'); await wait(140); }
  await s('Ba-dum-tss!');
  await say('hancock', 'Bravo, Bürger! Das unterschreibe ich!');
};
multi(['pick', 'push', 'pull'], 'o:tisch', line('Der Tisch ist schwerer als ich. Fast.'));

// ---------- 1776: Garten ----------
RULES['pick o:eimer'] = async () => { fl().eimer = true; addItem('eimer'); await s('Ein Holzeimer. Riecht nach Brunnen.'); };
RULES['look o:eimer'] = line('Ein Holzeimer steht auf dem Brunnenrand.');
RULES['use i:eimer o:brunnen'] = async () => {
  await s('Ich lasse den Eimer runter...');
  act(curId(), 'rope', 1600); Sound.sfx('splash'); await wait(1600);
  takeItem('eimer'); addItem('wasser');
  await s('...und ziehe ihn wieder hoch. Hoagie, der Brunnenmeister.');
};
RULES['use i:wasser o:brunnen'] = line('Der Eimer ist schon voll.');
RULES['use o:brunnen'] = line('Ich brauche etwas zum Schöpfen. Meine Hände sind dafür zu... behaart.');
RULES['pick o:schaufel'] = async () => { fl().schaufel = true; addItem('schaufel'); await s('Eine Schaufel. Endlich ein Werkzeug, das ich verstehe.'); };
RULES['look o:schaufel'] = line('Eine Schaufel lehnt am Zaun.');
RULES['look o:beet'] = line(() => [
  'Ein Fleck Erde. Steinhart. Hier hat noch nie jemand etwas gepflanzt.',
  'Ein schönes Loch. Mein bestes Werk seit Langem.',
  'Hier liegt mein Apfelbutzen begraben. Er sieht durstig aus. Also, der Hügel.',
  'Ein kleiner Apfelbaum-Setzling! Wachse, kleiner Freund. Wachse für die Zukunft!',
][fl().beet || 0]);
multi(['pick', 'use'], 'o:beet', line('Mit bloßen Händen graben? Bin ich ein Maulwurf? ...Antwort lieber nicht.'));
RULES['use i:schaufel o:beet'] = async () => {
  if (fl().beet) return s('Das Loch ist tief genug. Tiefer, und ich komme in China raus. Oder im Jahr 1500.');
  act(curId(), 'dig', 1300); Sound.sfx('dig'); await wait(1300); fl().beet = 1;
  await s('Hau ruck... hau ruck... Ein Loch!');
};
RULES['use i:butzen o:beet'] = async () => {
  const b = fl().beet || 0;
  if (b === 0) return s('Der Boden ist steinhart. Ich brauche erst ein Loch.');
  if (b > 1) return s('Da ist schon was gepflanzt.');
  act(curId(), 'pick', 800); takeItem('butzen'); fl().beet = 2; Sound.sfx('dig'); await wait(500);
  await s('Rein mit dir, kleiner Butzen. Werd groß und stark. Und lecker.');
};
RULES['use i:apfel o:beet'] = line('Einen ganzen Apfel vergraben? Erst essen, dann pflanzen. So hat es meine Oma gemacht.');
RULES['use i:eimer o:beet'] = line('Der Eimer ist leer. Ich bräuchte Wasser.');
RULES['use i:brot o:beet'] = line('Brot pflanzen? Dann wächst ein Brotbaum. ...Moment, das ist eigentlich genial. Nein. Fokus, Hoagie.');
async function PLANT_WATER() {
  takeItem('wasser'); addItem('eimer', curId(), true);
  act(curId(), 'pour', 1500); Sound.sfx('splash'); await wait(900);
  await s('Ein bisschen Wasser für den kleinen Kerl...');
  fl().beet = 3; fl().tree = true; Sound.sfx('grow'); unlock('baum'); await wait(900);
  await s('Er wächst! Okay, nur ein winziges bisschen. Aber in zweihundert Jahren ist der riesig!');
  await fadeTo(1, 300, 'black');
  G.viewRoom = 'fgarten'; G.caption = 'Unterdessen, zweihundert Jahre später ...'; G.treeGrowT = G.t + 500;
  await fadeTo(0, 300);
  Sound.sfx('grow');
  await wait(2300);
  if (ACT.laverne.room === 'fgarten') await say('laverne', 'Huch! Wo kommt DER Baum denn her?');
  else await wait(800);
  await fadeTo(1, 300, 'black'); G.viewRoom = null; G.caption = null; await fadeTo(0, 300);
}
RULES['use i:wasser o:beet'] = async () => {
  const b = fl().beet || 0;
  if (b === 3) return s('Der ist schon gegossen. Zu viel Wasser, und er wird ein Sumpfbaum.');
  if (b < 2) return s('Erst muss da was gepflanzt werden. Sonst gieße ich bloß Dreck.');
  return PLANT_WATER();
};

// ---------- Zukunft: Garten ----------
async function CLIMB() {
  if (!fl().tree) return s('Da ist kein Baum. Nur ein kahler Fleck. Auf einen Fleck kann ich schlecht klettern.');
  if (fl().zelle) return s('Da oben gibt es nichts mehr für mich. Außer Äpfeln. Und Aussicht.');
  const l = ACT.laverne;
  await walkTo(l, 628, 356); l.dir = -1;
  await s('Hoch hinaus!');
  // Kletterpose: Größe bleibt wie am Boden, der Schatten bleibt unten, Arme und Beine greifen abwechselnd
  Sound.sfx('climb'); l.speed = 95; l.climbY = 356; l.climb = true;
  await walkTo(l, 604, 190, true);
  l.walking = false;
  await s('Nur noch ein kleines Stück... hab sie!');
  addItem('zelle'); fl().zelle = true; Sound.sfx('zap');
  await walkTo(l, 604, 356, true); l.speed = l.baseSpeed; l.climb = false; l.climbY = null;
  await s('Die Laterne ist aus. Die Tentakel werden es überleben. Im Dunkeln.');
}
RULES['look o:laterne'] = line(() => fl().zelle ? 'Die Laterne ist aus. Ups.' : 'Eine Tentakel-Laterne. Ganz oben leuchtet eine Energiezelle. Viel zu hoch für mich.');
multi(['pick', 'use', 'pull', 'push'], 'o:laterne', async () => {
  if (fl().zelle) return s('Da ist nichts mehr zu holen.');
  if (fl().tree) return CLIMB();
  return s('Die Energiezelle hängt viel zu hoch. Ich bräuchte eine Leiter. Oder einen Baum. Oder Flügel.');
});
RULES['look o:baum'] = line('Ein riesiger Apfelbaum! Hoagie, du alter Gärtner. Seine Äste reichen bis zur Laterne.');
multi(['use', 'push'], 'o:baum', CLIMB);
RULES['pick o:baum'] = async () => {
  if (has('lapfel')) return s('Ein Apfel reicht mir.');
  addItem('lapfel'); await s('Ein Zukunfts-Apfel. Er ist 200 Jahre alt und trotzdem knackig.');
};
RULES['use i:lapfel'] = line('Ich esse doch keinen Apfel, den Hoagie gepflanzt hat. Wer weiß, was der vorher angefasst hat.');
RULES['use o:baumplatz'] = line('Hier etwas pflanzen? Bis das groß ist, bin ich alt. Und das hier ist schon die Zukunft.');
RULES['use i:steth o:statue'] = line('Kein Herzschlag. Wie beim Original, vermute ich.');
RULES['use i:steth o:laterne'] = line('Sie summt in C-Dur. Faszinierend.');

// ---------- Zukunft: Palast ----------
multi(['walk', 'open', 'use'], 'o:thron_tuer', async () => {
  if (!fl().guardGone) {
    await say('wache', 'HALT! Niemand betritt den Thronsaal Seiner Lilaheit!');
    return;
  }
  Sound.sfx('door');
  return goRoom('laverne', 'thron', 130, 402, 1);
});
async function COFFEE_GUARD() {
  takeItem('kaffee', 'laverne');
  await say('laverne', 'Hier. Ein Kaffee aus dem 21. Jahrhundert. Er kam durch ein Klo, aber das muss dich nicht stören.');
  await say('wache', 'KAFFEE?! Echter, verbotener Kaffee?! ...Na gut, nur ein Schlückchen.');
  Sound.sfx('slurp'); await wait(900);
  await say('wache', 'Mmmh. Aromatisch. Kräftig. Blubbernd.');
  await wait(500);
  await say('wache', 'Oh. Oh nein. "Wirkung garantiert in 3 Sekunden"? Das wirkt aber... DRINGEND!');
  await say('wache', 'DIENSTPAUSE!!!');
  Sound.sfx('run'); shake(700, 3); ACT.wache.speed = 460;
  await walkTo('wache', -90, 400, true);
  ACT.wache.visible = false; ACT.wache.room = 'nirgendwo'; ACT.wache.speed = ACT.wache.baseSpeed;
  fl().guardGone = true; unlock('kaffee');
  await say('laverne', 'Erst Klo, dann Kaffee, dann wieder Klo. Der Kreislauf des Lebens.');
}
RULES['give i:kaffee a:wache'] = COFFEE_GUARD;
RULES['give i:lapfel a:wache'] = () => say('wache', 'Ein Apfel? Ich habe Saugnäpfe, keine Zähne.');
RULES['use i:steth a:wache'] = async () => { await s('Ich horche mal...'); await s('Sein Herz schlägt ganz langsam. Der Typ braucht dringend Koffein.'); };
multi(['push', 'pull'], 'a:wache', line('Ich schubse keine bewaffneten Tentakel. Das ist so eine Regel von mir.'));

// ---------- Zukunft: Thronsaal ----------
async function ENDING() {
  takeItem('toast', 'laverne');
  await say('laverne', 'Hier. Toast. Gebacken in der Vergangenheit, getoastet in der Gegenwart, serviert in der Zukunft.');
  await say('lila', 'Toast? TOAST?! ...Na gut. Aber nur, weil ich gnädig bin.');
  Sound.sfx('chomp'); await wait(1000);
  await say('lila', 'Mmmh. Knusprig. Mit einer Note von... Moment. Was ist das für ein Gefühl?');
  ACT.lila.nice = G.t; Sound.sfx('hearts'); shake(500, 3); await wait(1400);
  await say('lila', 'Ist das... NETTIGKEIT?!');
  await say('lila', 'Ich will niemanden mehr unterjochen! Ich will Blumen gießen! Und alten Damen über die Straße helfen!');
  await say('laverne', 'Funktioniert. Schade, ich hatte gehofft, er explodiert wenigstens ein bisschen.');
  await say('lila', 'Laverne! Darf ich dich umarmen? Mit beiden Armen? Ich habe extra welche!');
  await say('laverne', 'Nein.');
  await fadeTo(1, 700, 'black');
  G.state.cur = 'bernard';
  Object.assign(ACT.bernard, { room: 'labor', x: 290, y: 404, dir: 1, visible: true });
  Object.assign(ACT.drfred, { room: 'labor', x: 470, y: 388, dir: -1 });
  Object.assign(ACT.hoagie, { room: 'labor', x: 640, y: 398, dir: -1, visible: true });
  Object.assign(ACT.laverne, { room: 'labor', x: 730, y: 414, dir: -1, visible: true });
  Object.assign(ACT.green, { room: 'labor', x: 150, y: 396, dir: 1 });
  G.caption = 'Zurück in der Gegenwart ...'; Sound.play('ending');
  await fadeTo(0, 700); await wait(1600); G.caption = null;
  await say('drfred', 'Erfolg! Die Zukunft ist gerettet! Die Vergangenheit ist gefüttert! Die Gegenwart ist... auch da.');
  await say('hoagie', 'Oma Gertrude lässt grüßen. Sie hat mir noch drei Brote eingepackt.');
  await say('green', 'Mein Bruder hat mir gerade eine Postkarte aus der Zukunft geschickt. Mit Herzchen!');
  await say('laverne', 'Ich habe ihm meine Ringelsocken dagelassen. Er wollte unbedingt welche.');
  await say('drfred', 'Wunderbar! Und jetzt: Wer hat Hunger? Ich mache uns allen Toast!');
  await say('bernard', 'NEIN!');
  await wait(400);
  await fadeTo(1, 900, 'black');
  G.endStats = { ms: G.state.stats.ms, sent: G.state.stats.sent };
  clearSave(); G.saved = null; G.screen = 'end'; G.fade = 0; music();
  unlock('ende');
}
RULES['give i:toast a:lila'] = ENDING;
RULES['give i:brot a:lila'] = () => say('lila', 'Ungetoastetes Brot? Wofür hältst du mich, für eine Ente? Ich will TOAST!');
RULES['give i:lapfel a:lila'] = () => say('lila', 'Ein Apfel aus MEINEM Garten? Den habe ich nicht genehmigt! Weg damit.');
RULES['use i:steth a:lila'] = line('Sein Herz schlägt im Takt von Marschmusik. Wie erwartet.');
multi(['push', 'pull'], 'a:lila', line('Lieber nicht. Er hat Arme. Und eine Wache. Na gut, die ist auf dem Klo.'));

// ============================================================
//  Dialoge
// ============================================================
ACT.green.talk = async () => {
  const g = 'green', b = 'bernard';
  if (!fl().metGreen) { fl().metGreen = true; await say(g, 'Bernard! Mein Bruder ist abgehauen und regiert jetzt die Zukunft. Mama wird SO sauer sein.'); }
  else await say(g, 'Hey, Bernard! Was geht?');
  for (;;) {
    const c = await choose([
      { id: 'tipp', text: 'Hast du einen Tipp für mich?' },
      { id: 'warum', text: 'Warum ist dein Bruder eigentlich so böse?' },
      { id: 'was', text: 'Was machst du hier in der Lobby?' },
      { id: 'bye', text: 'Bis später, Grüner.' },
    ]);
    if (c === 'bye') { await say(b, 'Bis später, Grüner.'); await say(g, 'Rock on, Bernard!'); return; }
    if (c === 'tipp') { await say(b, 'Hast du einen Tipp für mich?'); await say(g, hintText()); }
    if (c === 'warum') { await say(b, 'Warum ist dein Bruder eigentlich so böse?'); await say(g, 'Er hat mal Giftschlamm getrunken. Seitdem hat er Arme und schlechte Laune.'); await say(g, 'Vorher hatte er nur schlechte Laune.'); }
    if (c === 'was') { await say(b, 'Was machst du hier in der Lobby?'); await say(g, 'Ich übe für mein Comeback. Tentakel-Rock! Fehlt nur noch eine Band. Und Fans. Und Songs.'); await say(b, 'Also... alles.'); await say(g, 'Alles außer Leidenschaft, Bernard!'); }
  }
};
ACT.drfred.talk = async () => {
  const f = 'drfred', b = 'bernard';
  await say(f, 'Was ist, Junge? Ich denke gerade nach. Mit beiden Gehirnhälften!');
  for (;;) {
    const c = await choose([
      { id: 'how', text: 'Wie funktioniert der Gut-O-Mat?' },
      { id: 'cell', text: 'Wo kriege ich Strom für das Ding her?' },
      { id: 'bread', text: 'Und was ist mit dem Brot?' },
      { id: 'back', text: 'Wann kommen Hoagie und Laverne zurück?' },
      { id: 'bye', text: 'Ich lasse Sie dann mal denken.' },
    ]);
    if (c === 'bye') { await say(b, 'Ich lasse Sie dann mal denken.'); await say(f, 'Endlich! ...Wo war ich? Ach ja. Toast.'); return; }
    if (c === 'how') {
      await say(b, 'Wie funktioniert der Gut-O-Mat?');
      await say(f, 'Kinderleicht! Energiezelle rein, Freundlichkeits-Brot in den Schlitz, Regler auf GUT, Hebel ziehen!');
      await say(b, 'Und warum machen Sie das nicht selbst?');
      await say(f, 'Ich bin ein Genie, Junge. Genies delegieren.');
    }
    if (c === 'cell') {
      await say(b, 'Wo kriege ich Strom für das Ding her?');
      await say(f, 'Lila hat meine Energiezelle geklaut! In der Zukunft betreiben die Tentakel alles mit solchen Zellen. Laternen, Zahnbürsten, Socken.');
      await say(f, 'Laverne soll eine besorgen und durchs Klo schicken.');
    }
    if (c === 'bread') {
      await say(b, 'Und was ist mit dem Brot?');
      await say(f, 'Nur das Freundlichkeits-Brot meiner Ur-Ur-Ur-Ur-Oma Gertrude wirkt! Das Rezept ist leider verschollen.');
      await say(f, 'Aber Hoagie ist ja gerade bei ihr im Gasthaus, im Jahr 1776. Soll er sich halt eins backen lassen!');
      await say(b, 'Praktisch.'); await say(f, 'Wissenschaft, mein Junge!');
    }
    if (c === 'back') {
      await say(b, 'Wann kommen Hoagie und Laverne zurück?');
      await say(f, 'Sobald Lila geheilt ist! Bis dahin sind die Klos nur für Gegenstände kalibriert.');
      await say(f, 'Benutz einen Gegenstand mit dem Chrono-Klo, oder gib ihn am Klo direkt an Hoagie oder Laverne. Ihre Gesichter siehst du unten rechts.');
    }
  }
};
ACT.gertrude.talk = async () => {
  const g = 'gertrude', h = 'hoagie';
  if (!fl().metGertrude) {
    fl().metGertrude = true;
    await say(g, 'Willkommen im Gasthaus "Zum Krummen Kamin"! Ihr seht aus wie ein Reisender. Ein sehr... behaarter Reisender.');
    await say(h, 'Danke! Hab ich mir lange wachsen lassen.');
  } else await say(g, fl().brot ? 'Na, mein Junge? Schmeckt das Brot?' : 'Na, mein Junge? Hunger?');
  for (;;) {
    const c = await choose([
      { id: 'who', text: 'Sind Sie Gertrude Edison?' },
      !fl().brot && { id: 'brot', text: 'Ich brauche Ihr berühmtes Freundlichkeits-Brot!' },
      !fl().brot && fl().knowsSugar && { id: 'zucker', text: 'Warum gibt es keinen Zucker?' },
      { id: 'hancock', text: 'Wer ist der Typ mit der Feder?' },
      { id: 'bye', text: 'Bis später, Oma Gertrude.' },
    ]);
    if (c === 'bye') {
      await say(h, 'Bis später, Oma Gertrude.'); await say(g, 'Oma? Ich bin vierunddreißig!');
      await say(h, '...Ur-Ur-Ur-Ur-Oma, um genau zu sein.'); await say(g, 'Bitte?'); await say(h, 'Nix. Tschüss!');
      return;
    }
    if (c === 'who') {
      await say(h, 'Sind Sie Gertrude Edison?');
      await say(g, 'Höchstpersönlich! Wirtin, Bäckerin und Erfinderin des selbstumrührenden Löffels.');
      await say(g, 'Er rührt allerdings nur gegen den Uhrzeigersinn. Und nur Suppe, die er mag.');
      await say(h, 'Klingt total nach Familie Edison.');
    }
    if (c === 'brot') {
      await say(h, 'Ich brauche Ihr berühmtes Freundlichkeits-Brot!');
      await say(g, 'Ach, mein Freundlichkeits-Brot! Ein Bissen, und selbst der grimmigste Rotrock wird lammfromm.');
      await say(g, 'Aber ohne Zucker geht gar nichts. Und Zucker gibt es keinen mehr.');
      fl().knowsSugar = true;
    }
    if (c === 'zucker') {
      await say(h, 'Warum gibt es keinen Zucker?');
      await say(g, 'Die Briten haben eine Zuckersteuer erhoben. Dann eine Steuer auf die Zuckersteuer.');
      await say(g, 'Jetzt gibt es im ganzen Land keinen Krümel mehr. Nur noch Steuerbescheide.');
      await say(h, 'Hmm. Ich kenne da wen in der Gegenwart. Mit Zucker.');
    }
    if (c === 'hancock') {
      await say(h, 'Wer ist der Typ mit der Feder?');
      await say(g, 'Das ist Mister Hancock. Er übt seine Unterschrift. Seit drei Wochen.');
      await say(g, 'Er sagt, sie muss so groß sein, dass der König sie ohne Brille lesen kann.');
    }
  }
};
ACT.hancock.talk = async () => {
  const j = 'hancock', h = 'hoagie';
  await say(j, 'Ah, ein Bürger! Seht her: meine Unterschrift! Ist sie groß genug?');
  for (;;) {
    const c = await choose([
      { id: 'wofuer', text: 'Wofür üben Sie denn?' },
      { id: 'essen', text: 'Gibt es hier was zu essen?' },
      { id: 'garten', text: 'Gibt es hier einen Garten?' },
      { id: 'bye', text: 'Weitermachen!' },
    ]);
    if (c === 'bye') { await say(h, 'Weitermachen!'); await say(j, 'Mit Vergnügen! J... O... H... N...'); return; }
    if (c === 'wofuer') {
      await say(h, 'Wofür üben Sie denn?');
      await say(j, 'Für etwas Großes! Ich spüre es. Eines Tages unterschreibe ich etwas, das die Welt verändert.');
      await say(h, 'Und bis dahin?'); await say(j, 'Speisekarten. Zollformulare. Hühner.');
    }
    if (c === 'essen') {
      await say(h, 'Gibt es hier was zu essen?');
      await say(j, 'Die Obstschale auf dem Tisch! Gertrudes Äpfel sind die besten der Kolonien.');
      await say(j, 'Die Kerne wirft sie in den Garten. Sie sagt, irgendwann wächst da ein ganzer Wald.');
    }
    if (c === 'garten') {
      await say(h, 'Gibt es hier einen Garten?');
      await say(j, 'Hinter dem Haus. Brunnen, Beet, Abort. Alles, was ein freier Mensch braucht.');
    }
  }
};
ACT.wache.talk = async () => {
  const w = 'wache', l = 'laverne';
  if (!fl().metWache) { fl().metWache = true; await say(w, 'HALT! Niemand betritt den Thronsaal Seiner Lilaheit! Schon gar kein... wie heißt das... Mensch.'); }
  else await say(w, 'Immer noch HALT.');
  for (;;) {
    const c = await choose([
      { id: 'zu', text: 'Ich muss zu Lila Tentakel.' },
      { id: 'muede', text: 'Du siehst müde aus.' },
      { id: 'pause', text: 'Machst du nie Pause?' },
      { id: 'bye', text: 'Bis dann.' },
    ]);
    if (c === 'bye') { await say(l, 'Bis dann.'); await say(w, 'Ich bleibe hier. Für immer. Juhu.'); return; }
    if (c === 'zu') {
      await say(l, 'Ich muss zu Lila Tentakel.');
      await say(w, 'Das sagen alle. Die meisten werden dann Hofnarr. Oder Fußhocker.');
      await say(l, 'Ich wäre ein toller Fußhocker.'); await say(w, 'Das sagen auch alle.');
    }
    if (c === 'muede') {
      await say(l, 'Du siehst müde aus.');
      await say(w, 'Dreifachschicht. Seit vierzig Jahren.');
      await say(w, 'Wenn ich nur einen Kaffee hätte... Aber Kaffee ist verboten. Seine Lilaheit sagt, Kaffee macht Menschen aufmüpfig.');
    }
    if (c === 'pause') {
      await say(l, 'Machst du nie Pause?');
      await say(w, 'Pause gibt es nur, wenn mich etwas DRINGEND wegruft. Ist in vierzig Jahren nicht passiert.');
      await say(l, 'Dringend. Merke ich mir.');
    }
  }
};
ACT.lila.talk = async () => {
  const p = 'lila', l = 'laverne';
  await say(p, 'Was willst du, Mensch? Ich bin beschäftigt. Mit Herrschen.');
  for (;;) {
    const c = await choose([
      { id: 'auf', text: 'Gib auf, Lila!' },
      { id: 'hunger', text: 'Hast du eigentlich Hunger?' },
      { id: 'warum', text: 'Warum willst du immer die Welt erobern?' },
      { id: 'bye', text: 'Ich gehe dann mal.' },
    ]);
    if (c === 'bye') { await say(l, 'Ich gehe dann mal.'); await say(p, 'Ja, lauf nur! Ich herrsche dann hier weiter. Allein.'); await say(p, '...Ganz allein.'); return; }
    if (c === 'auf') {
      await say(l, 'Gib auf, Lila!');
      await say(p, 'Aufgeben? ICH? Ich habe einen Thron, eine Statue und ARME! Was hast du? Ringelsocken.');
      await say(l, 'Die Socken sind sehr gut.');
    }
    if (c === 'hunger') {
      await say(l, 'Hast du eigentlich Hunger?');
      await say(p, 'Ich habe Hunger nach MACHT!');
      await say(p, '...Und nach Toast. Aber das bleibt unter uns.');
    }
    if (c === 'warum') {
      await say(l, 'Warum willst du immer die Welt erobern?');
      await say(p, 'Weil sie da ist! Und weil mein Bruder sonst sagt, ich hätte keine Hobbys.');
    }
  }
};

// ============================================================
//  Räume betreten, Ankunft, Intro, Tipps
// ============================================================
ROOMS.vorraum.onEnter = async () => {
  if (!fl().guardGone && !fl().seenGuard) { fl().seenGuard = true; await say('wache', 'HALT! Wer da? Ach, ein Mensch. Bleib, wo du bist. Ich habe einen Speer. Und Dienstvorschriften.'); }
};
ROOMS.thron.onEnter = async () => {
  if (fl().seenLila) return;
  fl().seenLila = true;
  await say('lila', 'Ein Mensch in meinem Thronsaal? Wie bist du an der Wache vorbei... Ach. Kaffee, was?');
  await say('lila', 'Ich habe es immer gesagt: Kaffee ist der Untergang der Disziplin!');
};
const ARRIVALS = {
  hoagie: async () => {
    await say('hoagie', 'Whoa. 1776. Riecht nach Pferd. Und nach Freiheit. Aber hauptsächlich nach Pferd.');
    await say('hoagie', 'Dr. Fred meinte, Oma Gertrude wohnt hier im Gasthaus. Ich soll mir ihr Freundlichkeits-Brot besorgen.');
  },
  laverne: async () => {
    await say('laverne', 'Lila Himmel, lila Türme, lila Statue. Ich glaube, ich bin richtig.');
    await say('laverne', 'Irgendwo hier thront Lila. Und Dr. Fred braucht eine Energiezelle für seinen Toaster.');
  },
};
async function INTRO() {
  G.inIntro = true;
  await fadeTo(0, 700);
  G.caption = 'Fünf Jahre nach dem großen Tentakel-Tag ...'; await wait(2800); G.caption = null;
  await say('drfred', 'ENDLICH! Mein Gut-O-Mat ist fertig!');
  await say('drfred', 'Ein Toast daraus, und selbst der bösartigste Schurke wird lieb und nett!');
  await say('bernard', 'Es ist ein... Toaster, Dr. Fred.');
  await say('drfred', 'Ein GUT-O-MAT! Und keine Sekunde zu früh: Lila Tentakel ist durchs Chrono-Klo abgehauen.');
  await say('drfred', 'Laut meinen Berechnungen regiert er in zweihundert Jahren schon wieder die Welt.');
  await say('hoagie', 'Klassiker.');
  await say('drfred', 'Leider hat Lila meine Energiezelle geklaut und das letzte Freundlichkeits-Brot aufgefressen.');
  await say('drfred', 'Das Rezept stammt von meiner Ur-Ur-Ur-Ur-Oma Gertrude. Aus dem Jahr 1776.');
  await say('laverne', 'Also: Strom aus der Zukunft, Brot aus der Vergangenheit. Und ich darf den Tentakel füttern?');
  await say('drfred', 'Exakt! Hoagie reist ins Jahr 1776, Laverne in die Zukunft. Bernard bleibt hier am Gut-O-Mat.');
  await say('bernard', 'Warum muss ICH immer hierbleiben?');
  await say('drfred', 'Weil du als Einziger die Gebrauchsanweisung lesen kannst. Los, los, ab ins Klo!');
  await walkTo('hoagie', 788, 354); ACT.hoagie.dir = 1;
  await say('hoagie', 'Bis gleich, Leute! Oder bis vor 250 Jahren.');
  ACT.hoagie.visible = false; Sound.sfx('flush'); G.kloAnim = { obj: 'klo_heute', t: G.t }; await wait(1600);
  Object.assign(ACT.hoagie, { room: 'garten1776', x: 750, y: 394, dir: -1, visible: true });
  await walkTo('laverne', 788, 356); ACT.laverne.dir = 1;
  await say('laverne', 'Ich nehme mein Stethoskop mit. Falls die Zukunft einen Herzschlag hat.');
  ACT.laverne.visible = false; Sound.sfx('flush'); G.kloAnim = { obj: 'klo_heute', t: G.t }; await wait(1600);
  Object.assign(ACT.laverne, { room: 'fgarten', x: 220, y: 394, dir: 1, visible: true });
  await say('drfred', 'Hervorragend! Ach, übrigens: Die Klos sind jetzt nur noch für Gegenstände kalibriert.');
  await say('bernard', 'Das heißt?');
  await say('drfred', 'Ihr könnt euch Sachen hin- und herschicken. Selbst zurückkommen geht erst, wenn Lila geheilt ist.');
  await say('bernard', 'Das hätten Sie vielleicht VORHER sagen können.');
  await say('drfred', 'Hätte, hätte, Zeitmaschinenkette!');
  G.inIntro = false;
}
async function INTRO_TIP() {
  if (modernUI()) {
    await say(null, 'Linksklick: hingehen oder die passende Aktion. Rechtsklick: alle Aktionen für ein Ding.');
    await say(null, 'Inventar: Maus an den unteren Rand oder Taste I. Gegenstand anklicken, dann ein Ziel – oder ein Gesicht unten rechts: ab durchs Chrono-Klo in eine andere Zeit.');
    return;
  }
  await say(null, 'Unten rechts wechselst du zwischen Bernard, Hoagie und Laverne.');
  await say(null, 'Gegenstände schickst du am Chrono-Klo durch die Zeit: "Gib" anklicken, Gegenstand wählen, dann ein Gesicht.');
}
function hintText() {
  const f = fl(), w = whereItem;
  if (!f.zucker) return 'Gertrude im Jahr 1776 fehlt Zucker. Bernard: An der Rezeption in der Lobby steht eine Zuckerdose.';
  if (!f.brot) {
    const z = w('zucker');
    if (z === 'bernard') return 'Bernard soll den Würfelzucker im Labor durchs Chrono-Klo an Hoagie schicken.';
    if (z === 'laverne') return 'Laverne hat den Zucker? Schick ihn weiter an Hoagie!';
    return 'Hoagie: Gib Gertrude im Gasthaus den Würfelzucker.';
  }
  if (!f.tree) {
    const pre = 'Die Energiezelle in der Zukunft hängt zu hoch. Ein Baum, den man 1776 pflanzt, wäre heute riesig. ';
    if (!f.apfel) return pre + 'Hoagie: Nimm einen Apfel aus der Obstschale.';
    if (has('apfel', 'hoagie') || w('apfel')) return 'Hoagie: Iss den Apfel (Benutze Apfel). Die Kerne brauchst du noch.';
    if (!f.schaufel) return 'Hoagie: Im Garten lehnt eine Schaufel am Zaun.';
    if (!f.beet) return 'Hoagie: Grab mit der Schaufel ein Loch in den Erdfleck im Garten.';
    if (f.beet === 1) return 'Hoagie: Pflanz den Apfelbutzen ins Loch.';
    if (!w('wasser')) return 'Hoagie: Nimm den Eimer vom Brunnen und benutze ihn mit dem Brunnen.';
    return 'Hoagie: Gieß den Erdhügel mit dem Eimer voll Wasser.';
  }
  if (!f.zelle) return 'Laverne: Kletter auf den riesigen Apfelbaum im Zukunftsgarten und hol die Energiezelle aus der Laterne.';
  if (!f.cellIn) {
    const z = w('zelle');
    if (z === 'bernard') return 'Bernard: Setz die Energiezelle in den Gut-O-Mat ein.';
    return 'Schick die Energiezelle durchs Chrono-Klo an Bernard.';
  }
  if (!f.breadIn && !f.toast) {
    const b = w('brot');
    if (b === 'bernard') return 'Bernard: Steck das Freundlichkeits-Brot in den Gut-O-Mat.';
    if (b === 'hoagie') return 'Hoagie: Schick das Brot vom Plumpsklo im Garten an Bernard.';
    return 'Schick das Brot an Bernard.';
  }
  if (!f.toast && f.regler !== 'good') return 'Bernard: Der Regler am Gut-O-Mat steht auf SUPERBÖSE. Dreh ihn um!';
  if (!f.toast) return 'Bernard: Zieh den Hebel am Gut-O-Mat.';
  if (!f.guardGone) {
    if (!f.muenze) return 'Die Wache in der Zukunft ist hundemüde. Bernard: In Sofaritzen findet man oft Kleingeld.';
    if (!f.kaffee) return 'Bernard: Kauf mit der Münze einen Kaffee am KAFFEE-O-MAT in der Lobby.';
    if (w('kaffee') !== 'laverne') return 'Schick den Kaffee an Laverne. Die Wache würde für Kaffee alles tun.';
    return 'Laverne: Gib der Wache im Palast-Vorraum den Kaffee.';
  }
  if (w('toast') !== 'laverne') return 'Schick den Gut-Toast an Laverne!';
  return 'Laverne: Ab in den Thronsaal und gib Lila den Toast!';
}
async function showHint() { await cutscene(() => say(null, 'Tipp: ' + hintText())); }

// Test- und Debug-Zugang (z. B. für automatische Durchspiel-Tests)
window.TT = { G, ACT, ROOMS, OBJ, ITEMS, runSentence, switchChar, startNew, goRoom, fl: () => fl(), hintText };

boot();
