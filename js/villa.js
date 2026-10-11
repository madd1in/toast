'use strict';
// ============================================================
//  Tentakel-Toast – Die Villa über und unter der Diele (js/villa.js)
//  Der Keller war schon da (Falltür unter dem Teppich, js/gaeste.js). Neu: das Obergeschoss (Diele mit drei
//  verschlossenen Türen, Treppenabgang, Leiter zum Dachboden) und der Dachboden selbst (Kisten, Teleskop,
//  Weihnachtsbaum, Truhe, Spinnweben). Beide Räume sind Blender-Bauten (art/blender/raum_build.py:
//  build_stockwerk, build_dachboden) – vorgerendert und als Echtzeit-3D (img/3d/), jeweils mit Chrono-Kristall.
//  Die Treppe in der Lobby ist im vorgerenderten Bild ein gemalter Anbau; im Echtzeit-3D baut js/echt3d-szene.js sie echt auf.
// ============================================================

// ---------- Obergeschoss: Diele ----------
raum3d('stockwerk', 'img/raum_stockwerk.jpg', {
  era: 'present', name: 'Obergeschoss', floor: 'wood', amb: ['haus', 'wind'], fill: '#241a30',
  objs: [
    { id: 'treppe_runter', name: 'Treppe hinunter', rect: [700, 120, 240, 280], walk: () => [820, 368], dv: 'walk', exit: ['lobby', 210, 366, 1],
      look: 'Die Treppe hinunter zur Lobby. Das Geländer hält, solange man nicht daran rüttelt. Ich rüttle nicht. Meistens.' },
    { id: 'tuer_fred', name: 'Dr. Freds Zimmer', rect: [95, 86, 134, 214], walk: [160, 376],
      look: '„DR. FRED – BITTE NICHT ANKLOPFEN, ICH DENKE“. Aus dem Innern summt es leise, wie ein Transformator, der schlechte Laune hat.' },
    { id: 'tuer_bad', name: 'Badezimmer', rect: [345, 86, 110, 214], walk: [400, 376],
      look: () => Math.floor(G.t / 4000) % 2 ? 'Besetzt. Hinter der Tür plätschert es verdächtig fröhlich.Hier hat jemand SEHR lange warmes Wasser verdient.' : 'Besetzt. Ein Schild sagt „EIN MOMENT!“ – das hängt dort, seit wir angekommen sind. Der Moment ist jetzt offiziell eine Epoche.' },
    { id: 'tuer_gruen', name: 'Zimmer des Grünen Tentakels', rect: [573, 86, 132, 214], walk: [640, 376],
      look: 'Hinter der Tür probiert jemand Schlagzeug-Schlagflächen. Und Trompeten-Attacken. Gleichzeitig. Das Grüne Tentakel übt für seine Band. Respekt. Und Ohrstöpsel.' },
    { id: 'dachluke', name: 'Leiter zum Dachboden', rect: [170, 210, 120, 200], walk: [230, 392], dv: 'walk', exit: ['dachboden', 450, 398, 1],
      look: 'Eine ausziehbare Leiter zur Dachboden-Luke. Oben steht es, seit 200 Jahren keiner mehr nachgeschaut hat. Ich schaue nach. Ich bin Wissenschaftler. Neugier ist mein Geschäft.' },
    { id: 'fenster_oben', name: 'Fenster', rect: [40, 50, 40, 150], walk: [100, 380],
      look: 'Der Mond über dem Vorgarten. Der Zaun sieht von oben noch kaputter aus als von unten. Das nennt man Perspektive.' },
    { id: 'portrait', name: 'Ahnenportraits', rect: [230, 120, 240, 130], walk: [350, 380],
      look: 'Die Ahnengalerie der Familie Edison. Alle schauen streng. Einer schaut leicht grünlich – der Urgroßonkel, der angeblich „im Teich etwas angetippt“ hat.' },
    { id: 'teppich_oben', name: 'Teppich', rect: [136, 330, 687, 100], walk: [480, 396],
      look: 'Ein Teppich aus grauer Zeit. Er knistert, wenn man drübergeht, und das nicht nur, weil irgendwo Reis drunter liegt.' },
    { id: 'besen_oben', name: 'Besen', rect: [70, 280, 30, 100], walk: [120, 388],
      look: 'Ein Besen mit Ehrfurcht vor seiner Arbeit. Er hat Angst vor der Dachluke. Man sieht es ihm an.' },
  ],
  dyn(c, t) {
    if (c.isPix) return;
    if (!Math.floor(t / 6000) % 3) glow(360, 200, 26 + Math.sin(t * 0.003) * 4, '#b8c8ff', 0.16);   // Mondlicht durchs Fenster
  },
});
ROOM_FX.stockwerk = { verb: [0.5, 0.1], light: [1, '#c8c2ff', '#1a1428'], bloom: 0.14, amb: ['haus', 'wind'] };
GRADE.stockwerk = ['#8a86c8', 0.08];

// ---------- Dachboden ----------
raum3d('dachboden', 'img/raum_dachboden.jpg', {
  era: 'present', name: 'Dachboden', floor: 'wood', amb: ['haus'], fill: '#170f0c',
  objs: [
    { id: 'leiter_runter', name: 'Leiter hinunter', rect: [390, 200, 130, 210], walk: () => [450, 398], dv: 'walk', exit: ['stockwerk', 230, 392, 1],
      look: 'Die Leiter zurück zur Diele. Unten ist es heller. Und lauter. Und bedeutend weniger staubig.' },
    { id: 'dachfenster', name: 'Dachfenster', rect: [318, 42, 98, 78], walk: [360, 376],
      look: 'Das Gaubenfenster mit Blick auf den Mond. Wenn man den Kopf ganz schief legt, sieht der Mond aus wie ein Toast. Ich habe zu lange keinen Kaffee gehabt.' },
    { id: 'teleskop', name: 'Teleskop', rect: [335, 165, 60, 95], walk: [390, 390],
      look: 'Ein altes Messing-Teleskop, aufs Dachfenster gerichtet. Am Okular klebt ein Zettel: „MOND GIBT ES WIRKLICH – F.“ Danke, Fred.' },
    { id: 'truhe', name: 'Alte Truhe', rect: [235, 250, 120, 70], walk: [295, 396],
      look: 'Eine Seemannstruhe. Drin: Wolldecken, ein totales Durcheinander und der Geruch von zwanzig Jahren Vorsicht.' },
    { id: 'kisten', name: 'Kistenstapel', rect: [692, 263, 280, 76], walk: [790, 396],
      look: 'Kisten, Kisten, Kisten. Eine ist beschriftet mit „GUT-O-MAT – ERSATZTEILE (HOFFENTLICH NIE BENÖTIGT)“. Wir haben sie benötigt. Wir haben sie SEHR benötigt.' },
    { id: 'baum', name: 'Weihnachtsbaum', rect: [49, 183, 156, 120], walk: [130, 400],
      look: 'Ein Weihnachtsbaum von 1987. Er ist so trocken, dass er schon wieder stolz darauf ist. An der Spitze steckt noch ein Stern aus Aluminiumfolie.' },
    { id: 'spinne', name: 'Spinne', rect: [866, 100, 46, 32], walk: [830, 380],
      look: 'Eine Kreuzspinne vom Dienst. Sie hat hier oben mehr Bodenfläche verwaltet als manche Hausmeister. Wir nennen beide einfach Regine.' },
    { id: 'netz', name: 'Spinnweben', rect: [820, 80, 130, 120], walk: [840, 384],
      look: 'Spinnweben von handwerklicher Qualität. Regine sagt, das hier sei ihre Ruhmeshalle. Ich sage nichts. Ich bin nur Gast.' },
  ],
  dyn(c, t) {
    if (c.isPix) return;
    const k = Math.sin(t * 0.0006) * 0.5 + 0.5;
    glow(366, 84, 46 + k * 12, '#cdd6ff', 0.22 + k * 0.1);   // Mondlichtkegel unterm Dachfenster
    if (Math.floor(t / 9000) % 4 === 3) for (let i = 0; i < 3; i++) glow(300 + i * 60 + Math.sin(t * 0.001 + i) * 10, 200 - ((t / 30 + i * 60) % 160), 3, '#e8e2d0', 0.3);   // Staub im Lichtstrahl
  },
});
ROOM_FX.dachboden = { verb: [0.6, 0.12], light: [1, '#d8cdb0', '#241a12'], bloom: 0.12, amb: ['haus'], motes: 'dust' };
GRADE.dachboden = ['#c8a86a', 0.1];

// ---------- Lobby: Treppe hinauf (gemalter Anbau wie der Aufzug im Vorraum) ----------
ROOMS.lobby.objs.push({
  id: 'treppe_hoch', name: 'Treppe hinauf', rect: [60, 138, 130, 118], walk: [125, 372], dv: 'walk', exit: ['stockwerk', 820, 368, -1],
  look: 'Eine breite Holztreppe ins Obergeschoss. Die dritte Stufe knarzt – aus Prinzip. Und die achte auch. Es ist eine sehr prinzipienfreudige Treppe.',
  draw(c) {
    if (typeof echt3dOn === 'function' && echt3dOn(ROOMS.lobby)) return;   // im Echtzeit-3D steht eine echte Treppe in der Szene (js/echt3d-szene.js)
    c.save();
    for (let i = 0; i < 7; i++) {   // Stufen leicht perspektivisch nach oben
      const y = 350 - i * 28, x0 = 62 + i * 6, w = 128 - i * 9;
      R(c, x0, y, w, 22, i % 2 ? '#6a4a30' : '#755539', 2.5, '#2a1a10');
    }
    R(c, 58, 150, 8, 210, '#4a3220', 2, '#1c1208');   // Wangen
    R(c, 170, 154, 8, 200, '#4a3220', 2, '#1c1208');
    for (let i = 0; i < 6; i++) L(c, [58, 352 - i * 28, 58, 336 - i * 28], 4, '#4a3220');   // Geländerstäbe
    L(c, [58, 356, 66, 190], 5, '#54381f');
    txt(c, '1. STOCK', 126, 168, '800 12px "Baloo 2", sans-serif', '#e8cf8a', 'center', 3, '#241735');
    c.restore();
  },
});

// Karte und Chrono-Kristalle: beide Stockwerke sind begehbar; der Dachboden-Kristall hüpft man sich erst (js/echt3d.js)
if (typeof MAP_ORDER !== 'undefined' && MAP_ORDER.present) {
  const i = MAP_ORDER.present.indexOf('lobby');
  MAP_ORDER.present.splice(i + 1, 0, 'stockwerk', 'dachboden');
}
if (typeof CRYSTAL_ROOMS !== 'undefined') CRYSTAL_ROOMS.push('stockwerk');
{
  const crystalAtOrig = crystalAt;   // Dachboden: kein Boden-Kristall – der schwebt über dem Kistenstapel (s. u.)
  crystalAt = id => id === 'dachboden' ? null : crystalAtOrig(id);
  const HOCH = [782, 236, 1.12];   // Spiel-x, Spiel-y, Höhe in Metern über dem Kistenstapel
  ROOMS.dachboden.objs.push({
    id: 'kristall_hoch', name: 'Schwebender Chrono-Kristall', rect: [HOCH[0] - 58, HOCH[1] - 66, 116, 100], walk: [HOCH[0], 398], dv: 'pick',
    look: () => G.state.crystals.dachboden
      ? 'Da hing ein Chrono-Kristall. Jetzt hängt er nicht mehr. Physik: erledigt.'
      : typeof echt3dOn === 'function' && echt3dOn(ROOMS.dachboden)
        ? 'Ein Chrono-Kristall, hoch über dem Kistenstapel. Von unten nicht zu greifen – aber ich kann ja HÜPFEN. (WASD bewegt, Leertaste springt.)'
        : 'Ein Chrono-Kristall, hoch über dem Kistenstapel. Da komme ich nur mit einer Leiter rauf. Oder mit einem sehr überzeugenden Sprung.',
  });
  const dynOrig = ROOMS.dachboden.dyn;
  ROOMS.dachboden.dyn = (c, t) => {
    if (dynOrig) dynOrig(c, t);
    if (G.state.crystals.dachboden) return;
    const bob = Math.sin(t * 0.0035) * 5, x = HOCH[0], y = HOCH[1] - 16 + bob;
    c.save();
    if (!c.isPix) glow(c, x, y, 30 + Math.sin(t * 0.004) * 5, '#d79bff', 0.4 + Math.sin(t * 0.006) * 0.12);
    P(c, [x, y - 22, x + 13, y, x, y + 22, x - 13, y], '#e6c8ff', 2.5, '#8a5ad0');
    P(c, [x, y - 12, x + 6, y, x, y + 12, x - 6, y], '#f4e8ff', 0);
    c.restore();
  };
  RULES['pick o:kristall_hoch'] = async () => {
    if (G.state.crystals.dachboden) return s('Schon eingesammelt. Der Kistenstapel vermisst ihn schon nicht mehr.');
    const a = me(), hoch = (a._z3d || 0) >= 0.62;
    const dreiD = typeof echt3dOn === 'function' && echt3dOn(ROOMS.dachboden);
    if (!hoch && dreiD) {
      await s('Greifen … strecken … NEIN. Zu hoch. Ich müsste wirklich springen: LEERTASTE, direkt neben dem Stapel!');
      return;
    }
    if (!dreiD) { await s('Ich klettere die Kisten hoch – Stufe für Stufe, wie ein Professor mit Respekt vor hölzernen Türmen.'); await wait(500); }
    else await s('SCHWUPP! In der Luft gegriffen! Das nenne ich angewandte Gravitationswissenschaft!');
    G.state.crystals.dachboden = Date.now();
    Sound.sfx('crystal', panX(HOCH[0])); rumble(120, 0.1, 0.5);
    puff(HOCH[0], HOCH[1] - 14, '#d79bff', 12, { vy: 70, vx: 140, r: 2.4, max: 700, spread: 10 });
    const n = crystalCount();
    note(n === CRYSTAL_ROOMS.length ? 'Alle Chrono-Kristalle gefunden!' : `Chrono-Kristall gefunden! (${n}/${CRYSTAL_ROOMS.length})`);
    if (n === CRYSTAL_ROOMS.length) unlock('kristalle');
    save();
  };
}

// ---------- Reden mit dem Unsinn der Villa ----------
RULES['push o:tuer_fred'] = line('Ich schiebe nicht an Türen, hinter denen gedacht wird. Das wäre wie Reden in der Bibliothek eines very wütenden Mannes.');
multi(['push', 'pull'], 'o:tuer_bad', line('„EIN MOMENT!“ – okay. Ich nehme mir einen Moment. … Der Moment ist vorbei. Der Schild-Besitzer nicht.'));
multi(['push', 'pull'], 'o:tuer_gruen', async () => { Sound.sfx('riff'); await s('Die Tür wackelt. Hinter ihr fällt ein Schlagflächen-Halter um. „IST GUT! ICH HAB’S!“, ruft es. Es hat es nicht.'); });
RULES['open o:tuer_fred'] = RULES['open o:tuer_bad'] = RULES['open o:tuer_gruen'] = line('Abgeschlossen. Fred spart nicht an Schlössern, nur an alles anderem.');
multi(['pick', 'pull'], 'o:besen_oben', line('Ich lasse ihn stehen. Der Besen hat hier oben Ordnung geschaffen – eine Art Werk. Ich zerstöre keine Kunst.'));
RULES['use o:teleskop'] = async () => {
  await s('Ich drücke mein Auge ans Okular. Der Mond füllt das Bild …');
  await s('… auf dem Mond steht ein winziger Briefkasten. „FÜR: DAS GESICHT“. Der Universums-Postverkehr ist besser aufgestellt als der irdische.');
};
multi(['open', 'pick'], 'o:truhe', async () => {
  await s('Ich hebe den Deckel ein Stück …');
  Sound.sfx('shelf');
  await s('… Wolldecken, ein Ski (nur einer) und ein Schild „FALLS ZEITREISEN: NICHT DIE DECKEN VERGESSEN“. Zu spät, Schild. Viel zu spät.');
});
multi(['open', 'pick'], 'o:kisten', async () => {
  await s('Ich wühle durch die Ersatzteilkiste: drei Sicherungen, ein Relais, eine Anleitung mit dem Titel „SO NICKT DER GUT-O-MAT“.');
  await s('An der Anleitung klebt ein Zettel von Dr. Fred: „Wer das liest, hat den Gut-O-Mat kaputtgekriegt. Ich wusste es.“');
});
multi(['push', 'pull'], 'o:baum', async () => { Sound.sfx('rustle'); await s('Der Baum raschelt bedrohlich. Ich mache einen Schritt zurück. Wir haben eine Vereinbarung: Er bleibt stehen, ich komme nie wieder mit Kerzen.'); });
RULES['talk o:spinne'] = line('„Guten Tag, Regine.“ Regine sagt nichts. Regine webt. Regine hat das Sagen.');
