'use strict';
// ============================================================
//  Tentakel-Toast – Verbeugungen vor LucasArts, Indiana Jones und einer weit, weit entfernten Galaxis (js/hommagen.js)
//  Neue Easter Eggs (zählen im Menü „Easter Eggs“, im Echtzeit-3D erscheinen sie bei gedrehter Kamera als Bildkarten):
//    Dachboden  – goldener Götze auf dem Sockel (gegen Zucker tauschen … RUMPEL)
//    Obergeschoss – Garderobe mit Filzhut und Peitsche von „Dr. J.“
//    Keller     – ein Toast, eingefroren in Karbonit
//    Gasthaus 1776 – Spinnrad, das vier Töne spielt (Loom)
//    Uhrwerk    – eine glühende Orichalkum-Perle (Atlantis)
//    Landeplatz – ein kleiner Astro-Droide mit Toaster-Schlitz
// ============================================================
Object.assign(EGGS, {
  idol: { name: 'Goldener Götze', kind: 'idol', room: 'dachboden', x: 372, y: 372, w: 30, h: 64, walk: [400, 396], dv: 'look',
    look: ['Ein goldener Götze auf einem Steinsockel. Er grinst, als wüsste er von einer rollenden Steinkugel, von der ich nichts weiß.',
      'Auf dem Sockel steht: „Bitte nicht gegen Sandsäcke tauschen. Wir haben es nachgezählt.“'],
    pick: async p => {
      await say(p, 'Ich tausche ihn ganz vorsichtig gegen einen Beutel Würfelzucker. Gleiches Gewicht. Ungefähr.');
      G.eggFx.idol = G.t; Sound.sfx('boulder', panX(372)); shake(900, 7); rumble(700, 0.6, 1);
      if (typeof mimikStart === 'function') mimikStart(ACT[p], 'schreck');
      await wait(600);
      await say(p, '… „Ungefähr“ war offenbar nicht genau genug. Irgendwo unterm Dach rollt etwas sehr Rundes. Ich stelle ihn lieber zurück.');
    },
    use: ['Ich halte den Götzen nicht ins Licht. In solchen Filmen geht dann immer eine Falltür auf.'] },
  fedora: { name: 'Hut und Peitsche', kind: 'fedora', room: 'stockwerk', x: 300, y: 362, w: 40, h: 150, walk: [320, 386], dv: 'look',
    look: ['Ein abgewetzter Filzhut und eine aufgerollte Peitsche an der Garderobe. Am Hutband: „Dr. J. – Archäologie, nicht Zeitreisen“.',
      'Im Hut klebt ein Zettel: „Das gehört in ein Museum!“ Darunter, in Freds Schrift: „Das hier ist ein Museum. Irgendwie.“'],
    pick: ['Den Hut nimmt man nicht. Den Hut … bekommt man. Irgendwann. Nach drei Filmen.'],
    use: async p => { Sound.sfx('whoosh', panX(300)); await wait(140); Sound.sfx('knock'); shake(160, 2); await say(p, 'KNALL! Unten in der Lobby klirrt der Kronleuchter. Ich hänge die Peitsche zurück und tue so, als wäre nichts gewesen.'); } },
  karbonit: { name: 'Toast in Karbonit', kind: 'karbonit', room: 'keller', x: 262, y: 404, w: 54, h: 118, walk: [300, 412], dv: 'look',
    look: ['Ein Toast, eingefroren in einem Block aus Karbonit. Die Hände erhoben, der Blick sagt: „Ich weiß.“',
      'Am Block klebt ein Lieferschein: „Lieferung an einen Herrn J. T. H. – Wüstenplanet, zweites Haus links“.'],
    talk: ['„Ich liebe dich, Toast.“ … Der Block schweigt. Vielsagend.'],
    use: async p => { Sound.sfx('botbeep'); await wait(300); await say(p, 'Ich drücke den Auftau-Knopf. Es piept. Die Garantie ist leider vor langer Zeit in einer weit, weit entfernten Galaxis abgelaufen.'); },
    pick: ['Der Block wiegt so viel wie ein kleiner Raumfrachter. Er bleibt, wo er ist.'] },
  spinnrad: { name: 'Spinnrad', kind: 'spinnrad', room: 'gasthaus', x: 820, y: 392, w: 60, h: 76, walk: [790, 404], dv: 'use',
    look: ['Ein Spinnrad. Der Faden schimmert, als hätte ihn jemand mit Musik gesponnen. Auf dem Rad: „Weber-Gilde, Abteilung Töne“.'],
    use: async p => {
      G.eggFx.spinnrad = G.t;
      for (const n of ['dnE', 'dnG', 'dnA', 'dnC']) { Sound.sfx(n, panX(820)); await wait(380); }
      await say(p, 'E … G … A … C. Ich fühle mich, als könnte ich jetzt ein Schaf in einen Schwan verwandeln. Oder umgekehrt.');
    },
    pick: ['Ich spinne doch nicht. … Also, nicht mit dem Rad.'] },
  orichalkum: { name: 'Orichalkum-Perle', kind: 'orichalkum', room: 'uhrwerk', x: 190, y: 414, w: 22, h: 22, walk: [212, 404], dv: 'look',
    look: ['Eine glühende Perle aus Orichalkum. Auf einem Zettel daneben: „Atlantis – bitte NICHT in den Gut-O-Mat werfen. – F.“'],
    pick: ['Lieber nicht. Mit so etwas haben schon ganz andere ganze Kontinente versenkt.'],
    use: ['Ich halte die Perle ans Ohr. Sie rauscht wie das Meer. Wie ein sehr, sehr altes Meer.'] },
  droide: { name: 'Astro-Droide', kind: 'droide', room: 'landeplatz', x: 640, y: 414, w: 40, h: 64, walk: [600, 410], dv: 'talk',
    look: ['Ein kleiner Astro-Droide mit Toaster-Schlitz im Kopf. Er piept beleidigt, wenn man ihn „Mülleimer“ nennt.'],
    talk: async p => {
      G.eggFx.droide = G.t; Sound.sfx('botbeep', panX(640)); await wait(250); Sound.sfx('botbeep', panX(640));
      await say(p, 'Er projiziert ein flackerndes Hologramm: „Hilf mir, Fred-Wan. Du bist meine letzte Hoffnung.“');
      await say(p, 'Dann wirft er eine Scheibe Toast aus. Botschaft angekommen.');
    },
    pick: ['Er fährt ein winziges Schweißgerät aus. Ich verstehe den Hinweis.'] },
});

// ---------- Zeichnungen (Ursprung: Fußpunkt) ----------
Object.assign(EGG_DRAW, {
  idol(c, e, t) {
    const fx = G.eggFx && G.eggFx.idol && G.t - G.eggFx.idol < 1200 ? Math.sin(G.t * 0.08) * 2 : 0;
    R(c, -16, -26, 32, 26, '#7a6a5a', 2, 3, OUT); L(c, [-12, -16, 12, -16], 1.5, '#5a4a3a');
    c.save(); c.translate(fx, 0);
    E(c, 0, -40, 11, 13, '#e8b83a', 2, 0, OUT); E(c, 0, -56, 9, 9, '#f2c84a', 2, 0, OUT);
    E(c, -3.5, -57, 1.8, 2.2, '#5a3a10', 0); E(c, 3.5, -57, 1.8, 2.2, '#5a3a10', 0); L(c, [-4, -51, 4, -51], 1.5, '#5a3a10');
    if (!c.isPix) glowAt(c, 0, -48, 22, '#ffd860', 0.25 + Math.sin(t * 0.004) * 0.08);
    c.restore();
  },
  fedora(c, e, t) {
    L(c, [0, 0, 0, -150], 4, '#4a3220'); L(c, [-14, 0, 14, 0], 4, '#4a3220');
    L(c, [-16, -140, 16, -140], 3, '#4a3220');
    E(c, 10, -128, 18, 5, '#6a4a2a', 2, 0, OUT); R(c, 0, -146, 20, 16, '#6a4a2a', 2, 4, OUT); L(c, [0, -134, 20, -134], 3, '#2a1a10');   // Hut
    S(c, null, 3, () => { c.moveTo(-14, -120); c.quadraticCurveTo(-30, -96, -14, -78); c.quadraticCurveTo(0, -64, -16, -50); }, '#3a2414');   // Peitsche
    E(c, -14, -120, 4, 4, '#3a2414', 0);
  },
  karbonit(c, e, t) {
    R(c, -27, -118, 54, 118, '#5a6070', 2.5, 4, OUT); R(c, -22, -112, 44, 104, '#6a7282', 0, 3);
    E(c, 0, -74, 13, 15, '#7a8292', 1.5, 0, '#4a5060');   // Toast-Relief
    E(c, -5, -78, 2.5, 3, '#4a5060', 0); E(c, 5, -78, 2.5, 3, '#4a5060', 0); E(c, 0, -68, 4, 3, '#4a5060', 0);
    L(c, [-16, -92, -22, -104], 3, '#7a8292'); L(c, [16, -92, 22, -104], 3, '#7a8292');   // erhobene Hände
    for (let i = 0; i < 3; i++) E(c, -14 + i * 7, -22, 2.2, 2.2, Math.floor(t / 400 + i) % 3 ? '#4a5060' : ['#ff4a4a', '#4aff6a', '#ffd23a'][i], 0);
  },
  spinnrad(c, e, t) {
    const dreh = G.eggFx && G.eggFx.spinnrad && G.t - G.eggFx.spinnrad < 1800 ? G.t * 0.012 : t * 0.0008;
    L(c, [-24, 0, -10, -40], 3, '#6a4220'); L(c, [20, 0, 8, -40], 3, '#6a4220'); L(c, [-24, 0, 24, 0], 4, '#6a4220');
    E(c, 0, -46, 26, 26, null, 3, 0, '#7a4a24'); E(c, 0, -46, 4, 4, '#4a2a10', 0);
    for (let i = 0; i < 6; i++) { const a = dreh + i * Math.PI / 3; L(c, [0, -46, Math.cos(a) * 24, -46 + Math.sin(a) * 24], 1.5, '#7a4a24'); }
    S(c, null, 2, () => { c.moveTo(-10, -60); c.quadraticCurveTo(-30, -70, -26, -74); }, '#e8d8ff');
    if (!c.isPix) glowAt(c, -26, -74, 12, '#c8a8ff', 0.4 + Math.sin(t * 0.005) * 0.15);
  },
  orichalkum(c, e, t) {
    if (!c.isPix) glowAt(c, 0, -9, 20, '#ff8a2a', 0.45 + Math.sin(t * 0.006) * 0.15);
    E(c, 0, -9, 8, 8, '#ff9a3a', 2, 0, OUT); E(c, -2.5, -11.5, 2.5, 2, '#ffe0a0', 0);
  },
  droide(c, e, t) {
    const hop = G.eggFx && G.eggFx.droide && G.t - G.eggFx.droide < 1600 ? Math.abs(Math.sin(G.t * 0.02)) * 8 : 0;
    c.save(); c.translate(0, -hop);
    R(c, -20, -16, 8, 16, '#c8ccd8', 2, 2, OUT); R(c, 12, -16, 8, 16, '#c8ccd8', 2, 2, OUT);   // Beine
    R(c, -16, -50, 32, 38, '#f2f2f6', 2.5, 4, OUT); R(c, -10, -42, 20, 6, '#3a6ad8', 0, 2); R(c, -10, -32, 8, 12, '#3a6ad8', 0, 2);
    S(c, '#c8ccd8', 2.5, () => { c.moveTo(-16, -50); c.quadraticCurveTo(-16, -68, 0, -68); c.quadraticCurveTo(16, -68, 16, -50); c.closePath(); });
    R(c, -6, -66, 12, 3, '#3a2a1a', 0, 1);   // Toaster-Schlitz
    E(c, 6, -57, 3.5, 3.5, '#16121e', 1.2); E(c, 6, -57, 1.5, 1.5, Math.floor(t / 300) % 2 ? '#ff4a4a' : '#ff9a9a', 0);
    c.restore();
  },
});

// Uhrwerk: beim ersten Betreten ein sehr mieses Gefühl
{
  const ein = ROOMS.uhrwerk && ROOMS.uhrwerk.onEnter;
  if (ein) ROOMS.uhrwerk.onEnter = async () => {
    const erst = !fl().uhrwerkBesucht;
    await ein();
    if (erst) await s('Und ich hab da ein ganz mieses Gefühl bei der Sache.');
  };
}
