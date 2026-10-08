'use strict';
// ============================================================
//  Gästebuch, Seite 2: Gäste, die erst durch das fertige Tor kommen (Dr. Fred hat den Riss zum Tor umgebaut)
//  Bobbin (Loom) im Gasthaus 1776: Sein Stab hat vier Töne vergessen – sie stecken in Standuhr, Kessel, Brunnen und Fass,
//  und die Reihenfolge verrät sein Vers. Gespielt wird auf dem Spinnrocken im Gasthaus (das alte Easter Egg).
//  Zak McKracken auf dem Landeplatz (Zukunft): will das Gesicht auf dem Mars fotografieren (Raum „Marsgesicht“).
//  Alles sind eigene Modelle, Texte und Rätsel zu Ehren der Vorbilder – keine Original-Assets.
// ============================================================

// Sichtbar erst, wenn der Riss zum Tor geworden ist (rissZu) – so gilt es für neue und alte Spielstände gleich
for (const id of ['bobbin', 'zak']) Object.defineProperty(ACT[id], 'visible', { get: () => !!(G.state && G.state.flags && G.state.flags.rissZu), set() { /* folgt dem Tor */ }, configurable: true });
ACH.push({ id: 'vierton', name: 'Vier Töne', desc: 'Bobbin die vier vergessenen Töne zurückgegeben.' },
  { id: 'exklusiv', name: 'Exklusivbericht', desc: 'Das Gesicht auf dem Mars zum Lächeln gebracht – und fotografiert.' });

// ---------- Bobbin: die vier Töne ----------
// Standuhr E5, Kessel G5, Brunnen A5, Fass C6 – genau die Melodie des alten Spinnrocken-Gags. Die Reihenfolge ist die Lösung.
const TON = {
  uhr: { sfx: 'tonUhr', dist: 'dnE', name: 'der Ton der Standuhr', fein: 'rund wie eine Glocke', kurz: 'Uhr', x: 320 },
  kessel: { sfx: 'tonKessel', dist: 'dnG', name: 'der Ton des Kessels', fein: 'hoch und pfeifend', kurz: 'Kessel', x: 140 },
  brunnen: { sfx: 'tonBrunnen', dist: 'dnA', name: 'der Ton des Brunnens', fein: 'ein glasklarer Tropfen', kurz: 'Brunnen', x: 271 },
  fass: { sfx: 'tonFass', dist: 'dnC', name: 'der Ton der Fässer', fein: 'hohl und holzig', kurz: 'Fass', x: 340 },
};
const TON_REIHE = ['uhr', 'kessel', 'brunnen', 'fass'];
const TON_ANZEIGE = ['brunnen', 'fass', 'uhr', 'kessel'];   // so stehen sie in der Auswahl – absichtlich nicht in der richtigen Reihenfolge
const TON_ZEILEN = {
  uhr: 'Ich halte das Ohr an die Standuhr. *BOOONG* … Ein runder, sauberer Ton. Wie eine Glocke, die gerade erst gegossen wurde.',
  kessel: 'Ich klopfe an den Kessel – und der Dampf pfeift! Hoch und scharf. Gertrude würde sagen: „Der Tee ist fertig.“ Dabei ist da gar kein Tee drin.',
  brunnen: 'Ich lasse einen Kiesel in den Brunnen plumpsen. *plink* … Ein glasklarer Tropfen-Ton. Das Echo hört gar nicht mehr auf.',
  fass: 'Ich klopfe auf ein Fass. *tok* Hohl, hell, holzig. Auf dem Fass steht „RUM“. Wer so klingt, hat keinen Rum.',
};
const BOBBIN_VERS = [
  '„Zuerst, was nie stillsteht und doch nie ankommt.“',
  '„Dann, was kocht und dabei pfeift.“',
  '„Dann, was tief ist und Tropfen sammelt.“',
  '„Zuletzt, was hohl klingt, obwohl ‚Rum‘ draufsteht.“',
];
const tonGehoert = () => TON_REIHE.filter(k => fl()['ton_' + k]);

async function lausche(id) {
  const p = curId(), f = fl(), t = TON[id];
  Sound.sfx(t.sfx, panX(t.x));
  await wait(1100);
  const neu = !f['ton_' + id]; f['ton_' + id] = 1;
  await say(p, TON_ZEILEN[id]);
  if (!neu) return;
  const n = tonGehoert().length;
  if (f.bobbinHilfe && !f.bobbinFertig) {
    note(`Ton ${n} von 4 gehört: ${t.kurz}`);
    await say(p, n === 4 ? 'Das waren alle vier! Jetzt muss ich sie nur noch in die richtige Reihenfolge bringen. Bobbins Vers verrät sie bestimmt.' : pick(['Einer von vier! Mann, ich bin ein Gehör mit Beinen.', 'Der Ton gehört zu Bobbins Melodie. Das fühle ich in den Ohren.', 'Notiert. Also, im Kopf. Mein Kopf ist ein Notizbuch ohne Seiten.']));
  } else note(`Ein besonderer Ton: ${t.kurz}`);
}
// Quellen: Standuhr und Fässer hatten noch keine Benutzen-Regel, der Kessel ist neu, der Brunnen zeigt sonst nur den Eimer-Hinweis
ROOMS.gasthaus.objs.push({ id: 'kessel', name: 'Kessel', rect: [108, 244, 64, 52], walk: [196, 366], look: 'Ein Kessel über dem Feuer. Er blubbert und pfeift leise. Gertrude behauptet, das sei Tee. Es riecht nach Suppe.' });
RULES['use o:uhr_1776'] = () => lausche('uhr');
RULES['use o:kessel'] = () => lausche('kessel');
RULES['use o:faesser'] = () => lausche('fass');
{
  const brunnenOrig = RULES['use o:brunnen'];
  RULES['use o:brunnen'] = async () => (fl().bobbinHilfe && !fl().bobbinFertig ? lausche('brunnen') : brunnenOrig());
}

async function bobbinSpielt(b = ACT.bobbin) {
  b.spielBis = G.t + 4600;
  for (const k of TON_REIHE) { Sound.sfx(TON[k].dist, panX(b.x)); await wait(650); }
  await wait(500);
}

// der alte Spinnrocken: mit Bobbin im Haus spielt man darauf die vier Töne in der richtigen Reihenfolge
{
  const rockenOrig = EGGS.distaff.use;
  EGGS.distaff.use = async p => (ACT.bobbin.visible && fl().bobbinHilfe && !fl().bobbinFertig && p === 'hoagie' ? ROCKEN_SPIELEN(p) : rockenOrig(p));
}
async function ROCKEN_SPIELEN(p) {
  const f = fl(), b = 'bobbin';
  if (tonGehoert().length < 4) { await say(p, `Ich hab erst ${tonGehoert().length} von vier Tönen im Ohr. Ich sollte noch ein bisschen lauschen: Standuhr, Kessel, Brunnen, Fässer.`); return; }
  await say(p, 'Okay, Rocken. Vier Töne, richtige Reihenfolge, null Druck. Ich hab schon vor mehr Leuten gespielt. Wenn auch nicht gut.');
  const seq = [];
  for (let i = 0; i < 4; i++) {
    const c = await choose([...TON_ANZEIGE.map(id => ({ id, text: `Ton ${i + 1}: ${TON[id].name} (${TON[id].fein})` })), { id: 'no', text: 'Lieber doch nicht.' }]);
    if (c === 'no') { await say(p, 'Ich lass den Rocken erst mal in Ruhe. Der Vers muss erst sacken.'); return; }
    seq.push(c);
    Sound.sfx(TON[c].dist, panX(EGGS.distaff.x));
    note(`Gespielt: ${seq.map(k => TON[k].kurz).join(' – ')}`);
    await wait(560);
  }
  await wait(500);
  if (!seq.every((k, i) => k === TON_REIHE[i])) {
    Sound.sfx('tonFalsch'); f.bobbinFehl = (f.bobbinFehl || 0) + 1;
    await say(p, pick(['*klonk* … Das klingt, als hätte jemand einen Teppich in eine Orgel gestopft.', 'Autsch. Das war nicht die Melodie. Das war ihr schlecht gelaunter Cousin.', 'Mann, das hat sich verknotet. Der Rocken guckt mich beleidigt an.']));
    if (ACT[b].room === ACT[p].room) {
      await say(b, f.bobbinFehl >= 2 ? 'Denkt an den Vers. Die Reihenfolge steckt in den Worten: „was nie stillsteht“, „was kocht“, „was tief ist“, „was hohl klingt“.' : 'Der Faden wollte nicht halten. Hört noch einmal auf den Vers. Die Worte stehen in der Reihenfolge der Töne.');
    }
    return;
  }
  // richtig: die Melodie des alten Rocken-Gags, Schwan inklusive
  G.eggFx.draft = G.t; Sound.sfx('draft', panX(EGGS.distaff.x));
  ACT[b].spielBis = G.t + 4200;
  await wait(1700);
  G.eggFx.swan = G.t; Sound.sfx('swan'); await wait(1200);
  await say(p, 'Das waren sie! Und da fliegt schon wieder ein Schwan durchs Gasthaus. Okay, das ist jetzt echt Routine.');
  await say(b, 'Er klingt! Der Rocken! Der Faden! Ich spüre … *die Kapuze rutscht ein Stück* … ihn wieder. Er führt nach Hause.');
  await say(p, 'Und der Schwan?');
  await say(b, 'Ein Schwan ist immer ein gutes Zeichen. Meistens.');
  await say(b, 'Ihr habt mir mehr gegeben als vier Töne. Ihr habt mir gezeigt, dass man in einem Gasthaus Hilfe findet. Das ist … ungewohnt.');
  await say(p, 'Quatsch, Mann. Das war ein Gig. Und wo ein Gig ist, ist ein Autogramm: Unterschreib doch noch in Dr. Freds Gästebuch.');
  await say(b, 'Mit dem Stab? In Großbuchstaben? Das hat noch nie jemand von mir verlangt. Es gefällt mir.');
  f.bobbinFertig = 1;
  await gbSign(b);
  unlock('vierton');
}

ACT.bobbin.talk = async () => {
  const b = 'bobbin', h = curId(), f = fl();
  await say(b, f.metBobbin ? 'Ah, der Fremde ohne Kapuze. Ihr bringt Lärm mit. Das ist gut. Lärm ist ein Anfang.' : 'Ihr … seht mich? Gut. Die meisten hören mich nur.');
  if (!f.metBobbin) { await say(h, 'Hey, Mann. Schicke Kapuze. Bist du von einer Sekte?'); await say(b, 'Von einer Gilde. Der Gilde der Weber. Wir sind weniger gefährlich, als wir klingen.'); }
  f.metBobbin = 1;
  for (;;) {
    const n = tonGehoert().length, offen = f.bobbinHilfe && !f.bobbinFertig;
    const c = await choose([
      { id: 'wer', text: 'Wer bist du, Mann?' }, { id: 'stab', text: 'Was ist das für ein Stab? Der leuchtet ja.' },
      !f.bobbinHilfe && { id: 'hilfe', text: 'Du siehst aus, als bräuchtest du Hilfe.' },
      offen && { id: 'vers', text: 'Wie ging dein Vers noch mal?' }, offen && { id: 'melodie', text: 'Spiel mir die Töne bitte noch einmal vor.' },
      offen && { id: 'stand', text: n ? `Ich hab schon ${n} von 4 Tönen gehört.` : 'Wo finde ich die Töne eigentlich?' },
      !gbOk(b) && !offen && { id: 'gb', text: 'Trägst du dich in Dr. Freds Gästebuch ein?' },
      { id: 'bye', text: 'Ich muss weiter. Halt die Fäden zusammen.' }]);
    if (c === 'bye') { await say(h, 'Ich muss weiter. Halt die Fäden zusammen.'); await say(b, 'Das tue ich. Sie halten mich mehr als ich sie.'); return; }
    if (c === 'wer') {
      await say(h, 'Wer bist du, Mann?'); await say(b, 'Bobbin Threadbare. Weber. Ich bin durch eine Naht gefallen, die es nicht geben dürfte – und lande in einem Gasthaus, das nach Brot riecht.');
      await say(h, 'Das war Dr. Freds Klo. Das leckt manchmal. Wie mein Verstärker.'); await say(b, 'Ein Klo … natürlich. Ein Weg zwischen den Zeiten ist ein Faden. Ob er aus Gold ist oder aus Rohr, ist dem Muster gleich.');
    }
    if (c === 'stab') {
      await say(h, 'Was ist das für ein Stab? Der leuchtet ja.'); await say(b, 'Mein Rocken. Man spielt ihn. Vier Töne genügen: Wer sie in die richtige Ordnung bringt, webt ein Muster, das alles zusammenhält.');
      await say(h, 'Wie eine Gitarre mit vier Saiten?'); await say(b, 'Mit vier Tönen und ohne Saiten. Aber ja, ungefähr.');
      await say(b, 'Nur: Beim Fallen habe ich die Töne verloren. Der Stab schweigt.');
    }
    if (c === 'hilfe') {
      await say(h, 'Du siehst aus, als bräuchtest du Hilfe. Ich bin ein echter Musiker. Also, fast.');
      await say(b, 'Die Töne sind nicht weg. Sie sind verstreut – in vier Dingen, die diese Welt zusammenhalten. Hört meinen Vers:');
      for (const z of BOBBIN_VERS) await say(b, z);
      await say(b, 'Und hier ist die Melodie, wie sie war.');
      await bobbinSpielt();
      await say(b, 'Dort drüben steht ein alter Rocken. Wenn Ihr die vier Töne in der Ordnung des Verses spielt, hält der Faden. Mein Stab ist zu müde dafür.');
      await say(h, 'Der Spinnrocken neben der Standuhr? Der mit dem Schwan?'); await say(b, 'Ein Schwan?'); await say(h, 'Ist so ein Ding. Frag nicht.'); await say(b, 'Ich frage nie. Ich höre nur zu.');
      f.bobbinHilfe = 1; note('Neue Aufgabe: Bobbins vier Töne finden (Gasthaus, Garten, Hafen).');
    }
    if (c === 'vers') { await say(h, 'Wie ging dein Vers noch mal?'); for (const z of BOBBIN_VERS) await say(b, z); }
    if (c === 'melodie') { await say(h, 'Spiel mir die Töne bitte noch einmal vor.'); await say(b, 'Gern. Hört genau hin.'); await bobbinSpielt(); await say(b, 'Sie klingen traurig, ohne Rocken. Aber sie sind da.'); }
    if (c === 'stand') {
      await say(h, n ? `Ich hab schon ${n} von 4 Tönen gehört.` : 'Wo finde ich die Töne eigentlich?');
      const sp = { uhr: 'die Standuhr hier im Gasthaus', kessel: 'der Kessel überm Feuer', brunnen: 'der Brunnen im Garten', fass: 'die Fässer am Hafen' };
      const fehlt = TON_REIHE.filter(k => !f['ton_' + k]).map(k => sp[k]);
      await say(b, !fehlt.length ? 'Alle vier! Dann spielt sie auf dem Rocken, in der Ordnung des Verses.' : `${n ? 'Gut. ' : ''}Es fehlen noch: ${fehlt.join(', ')}. Benutzt sie – und hört auf das, was sie sagen.`);
    }
    if (c === 'gb') { await say(h, 'Trägst du dich in Dr. Freds Gästebuch ein?'); await say(b, 'Erst, wenn der Faden hält. Ich unterschreibe nur, was ich festgenäht habe.'); }
  }
};
BARKS.bobbin = ['Die Fäden hier sind … unordentlich.', 'Ich höre die Uhr. Sie tickt in E. Glaube ich.', 'Wo ist mein Schwan? Falls ich einen hatte.', 'Dieses Gasthaus hat eine Melodie. Sie stimmt nur nicht.'];
(NPC_CHATS.gasthaus = NPC_CHATS.gasthaus || []).push(
  [['gertrude', 'Junger Mann, noch einen Tee? Oder eine Garnrolle?'], ['bobbin', 'Habt Ihr Tee? Ich meine … Faden? Ich meine … beides.'], ['gertrude', 'Ich hab Brot. Das ist beides, nur essbar.']],
  [['hancock', 'Wollt Ihr hier unterschreiben, Fremder? Es kostet nur Eure Unterschrift.'], ['bobbin', 'Ich habe nur meinen Namen. Und einen Stab.'], ['hancock', 'Dann schreibt mit dem Stab! In Großbuchstaben!']],
);

