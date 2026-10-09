'use strict';
// ============================================================
//  Tentakel-Toast – das Tentakel-Kostüm (eine Verbeugung vor Day of the Tentacle)
//  Laverne reißt im Palast das Propaganda-Plakat ab (Rückseite: Schnittmuster), Hoagie bringt es Oma Gertrude, die mit
//  Bernards Kaffee im Blut ein Tentakel-Kostüm aus Fahnenstoff näht – Hancock erklärt es zur Nationalfahne. 200 Jahre
//  später weht diese „Ur-Fahne“ am Mast im Zukunftsgarten. Bernard sticht im Konferenzsaal (Reste der Scherzartikel-Messe
//  von 1987) mit Gertrudes Schere den aufblasbaren Clown Lachi an und findet die Lach-Box; mit Kostüm und bösem Lachen
//  hält die Wache Laverne für Seine Lilaheit. Dazu: drei Chrono-Klos im Intro. Story-Regeln in story.js, 3D in
//  art/blender/altbau.py (Räume) und kostuem_build.py (Laverne im Kostüm).
// ============================================================

// Kamera-Führung für Zwischenszenen: G.camFokus (Spiel-x) überstimmt, wem die Kamera folgt
{
  const camOhneFokus = camTarget;
  camTarget = function () { return G.camFokus == null ? camOhneFokus() : Math.max(0, Math.min(W - VW, G.camFokus - VW / 2)); };
}

// ---------- Gegenwart: der Konferenzsaal neben der Lobby ----------
room({
  id: 'konferenz', era: 'present', name: 'Konferenzsaal', floor: 'carpet', amb: ['air', 'hum'],
  draw(g) { g.fillStyle = '#3a2618'; g.fillRect(0, 0, W, SH); },
  objs: [
    { id: 'konf_raus', name: 'Lobby', rect: [5, 180, 108, 155], walk: [60, 374], exit: ['lobby', 392, 366, 1], look: 'Die Tür zurück in die Lobby. Darüber leuchtet ein Schild: „← LOBBY“. Für den Fall, dass jemand vor Lachen die Orientierung verliert.' },
    { id: 'messebanner', name: 'Banner', rect: [148, 41, 685, 55], look: '„1. INTERNATIONALE SCHERZARTIKEL-MESSE 1987“. Eine zweite hat es nie gegeben. Jetzt weiß ich auch, warum.' },
    { id: 'leinwand', name: 'Leinwand', rect: [409, 86, 242, 146], walk: [530, 362], look: '„UMSATZ 1987“: Januar super, Juni im Keller. Darunter: „HA. HA. HA.“ Ich glaube, das war der letzte Witz dieser Branche.', txt: { pull: 'Wenn ich daran ziehe, rollt sie sich ein. Und mit ihr die letzte Hoffnung der Scherzartikel-Branche.' } },
    { id: 'konftisch', name: 'Konferenztisch', rect: [175, 249, 385, 77], walk: [360, 362], look: 'Namensschilder, Pappbecher, Luftschlangen und ein Klappergebiss. Das Protokoll dieser Sitzung muss spannend gewesen sein.', txt: { push: 'Der Tisch rührt sich nicht. Er hat schon Schlimmeres erlebt. Zum Beispiel 1987.' } },
    { id: 'ballons', name: 'Luftballons', rect: [115, 233, 83, 74], walk: [160, 368], look: 'Luftballons von 1987. Sie hängen genauso durch wie die Stimmung auf der Messe.' },
    { id: 'furzkissen', name: 'Furzkissen', rect: [130, 292, 40, 26], walk: [160, 368], dv: 'push' },
    { id: 'namensschild', name: 'Namensschild', rect: [278, 276, 44, 22], walk: [300, 362] },
    { id: 'gebiss', name: 'Klappergebiss', rect: [314, 278, 30, 20], walk: [330, 362], dv: 'use' },
    { id: 'projektor', name: 'Diaprojektor', rect: [518, 266, 44, 32], walk: [540, 362], dv: 'use' },
    { id: 'messestand', name: 'Ausverkaufs-Stand', rect: [646, 228, 135, 115], walk: [712, 364] },
    { id: 'kotze', name: 'Gummi-Erbrochenes', rect: [552, 384, 92, 26], walk: [656, 424] },
    { id: 'clownrest', name: 'Platter Clown', rect: [791, 300, 160, 62], walk: [830, 384], visible: () => !!fl().clownPlatt },
    { id: 'clown', name: 'Aufblasbarer Clown', rect: [788, 127, 149, 227], walk: [826, 376], dv: 'push', visible: () => !fl().clownPlatt },
    { id: 'lachkiste_k', name: 'Lach-Box', rect: [880, 328, 40, 30], walk: [880, 388], dv: 'pick', visible: () => !!fl().clownPlatt && !fl().lachkiste },
  ],
});
ROOM_FX.konferenz = { verb: [0.9, 0.14], light: [1, '#fff0d0', '#2a1a3a'], bloom: 0.2, amb: ['air', 'hum'], motes: 'dust', music: 'lounge' };
{
  const D = altbau3d('konferenz', {
    fill: '#3a2618',
    zustand: { clown_platt: () => flagOn('clownPlatt') && !flagOn('lachkiste'), clown_leer: () => flagOn('lachkiste') },
  });
  if (D) {
    const A = D.anchors, ob = id => ROOMS.konferenz.objs.find(q => q.id === id);
    const pad = (r, p) => [r[0] - p, r[1] - p, r[2] + 2 * p, r[3] + 2 * p];
    ob('konf_raus').rect = A.Tuer; ob('messebanner').rect = A.Banner; ob('leinwand').rect = A.Leinwand; ob('konftisch').rect = A.Tisch;
    ob('ballons').rect = A.Ballons; ob('furzkissen').rect = pad(A.Kissen, 8); ob('namensschild').rect = pad(A.Namensschild, 6);
    ob('gebiss').rect = pad(A.Gebiss, 7); ob('projektor').rect = pad(A.Projektor, 6); ob('messestand').rect = A.Stand; ob('kotze').rect = pad(A.Kotze, 6);
    ob('clownrest').rect = A.Platt; ob('clown').rect = A.Clown; ob('lachkiste_k').rect = pad(A.Lachkiste, 10);
    // Lachi: ein Bild, das sich sanft wiegt, beim Stupsen nachfedert und beim Anstechen in sich zusammenfällt
    const S = D.sprites.clown, im = loadImg(S.src), [px, py] = S.pivot;
    ob('clown').draw = (c, t) => {
      if (!imgOk(im)) return;
      let sx = 1, sy = 1, rot = Math.sin(t * 0.0013) * 0.025, k = 0;
      if (G.clownStoss) { const q = (G.t - G.clownStoss) / 1100; if (q < 1) { rot += Math.sin(q * Math.PI * 4) * 0.17 * (1 - q); sy = 1 - Math.sin(q * Math.PI * 4) * 0.04 * (1 - q); } }
      if (G.clownPlatt && G.t - G.clownPlatt > 2600) G.clownPlatt = 0;   // alter Zeitstempel aus einem früheren Spiel
      if (G.clownPlatt) {
        k = Math.min(1, (G.t - G.clownPlatt) / 1800);
        sy = 1 - 0.88 * Math.pow(k, 0.75); sx = 1 + 0.4 * k + Math.sin(k * 42) * 0.08 * (1 - k); rot += Math.sin(k * 33) * 0.22 * (1 - k);
        if (k >= 1) return;
      }
      if (!c.isPix) shadow(c, px, py + 2, 66 * sx, 13, 0.3);
      c.save(); c.translate(px, py); c.rotate(rot); c.scale(sx, sy); c.translate(-px, -py);
      malBild(c, im, S.x, S.y, S.w, S.h);
      c.restore();
      if (k > 0) for (let i = 0; i < 6; i++) {   // Luft pfeift aus dem Ventil
        const q = ((G.t * 0.004) + i / 6) % 1, ax = px + 30 * sx + q * 70, ay = py - 80 * sy - q * 30 + Math.sin(q * 9 + i) * 6;
        c.save(); c.globalAlpha = (1 - q) * 0.8; L(c, [ax, ay, ax + 12, ay - 3], 2.5, '#ffffff'); c.restore();
      }
    };
    const [lx, ly] = D.points.linse, [scx, scy] = D.points.leinwand, [l0, t0, lw, lh] = A.Leinwand;
    ROOMS.konferenz.dyn = (c, t) => {
      if (c.isPix) return;
      // Lichtkegel des Diaprojektors auf der Leinwand, mit tanzendem Staub
      c.save(); c.globalAlpha = 0.09 + Math.sin(t * 0.003) * 0.015;
      const g = c.createLinearGradient(lx, ly, scx, scy); g.addColorStop(0, '#fff8d8'); g.addColorStop(1, 'rgba(255,248,216,0.3)');
      P(c, [lx, ly, l0 + 6, t0 + lh - 4, l0 + 6, t0 + 14, l0 + lw - 6, t0 + 14, l0 + lw - 6, t0 + lh - 4], g, 0);
      c.restore();
      for (let i = 0; i < 10; i++) {
        const q = ((t * 0.00006 * (1 + i % 3)) + i * 0.1) % 1, x = lx + (scx - lx + Math.sin(i * 2.3) * 70) * q, y = ly + (scy - ly + Math.cos(i * 1.7) * 40) * q;
        c.save(); c.globalAlpha = 0.55 * Math.sin(q * Math.PI); E(c, x, y, 1.4, 1.4, '#fff6d0', 0); c.restore();
      }
      glowAt(c, lx, ly, 16, '#fff4c8', 0.5 + Math.sin(t * 0.01) * 0.05);
    };
  }
}
ROOMS.konferenz.onEnter = async () => {
  if (fl().konfGesehen) return;
  fl().konfGesehen = 1;
  await s('Der Konferenzsaal. Seit der Scherzartikel-Messe von 1987 hat hier offenbar niemand aufgeräumt.');
  Sound.sfx('giggle'); await wait(700);
  await s('Es riecht nach Gummi, Konfetti und verlorener Hoffnung. Und der Clown kichert. Von ganz allein.');
};
// Ausgang in der Lobby: die neue Tür zwischen Standuhr und Sofa
ROOMS.lobby.objs.push({ id: 'tuer_konferenz', name: 'Konferenzsaal', rect: (ALTBAU3D.lobby && ALTBAU3D.lobby.anchors.KonfTuer) || [347, 196, 89, 139], walk: [392, 364], exit: ['konferenz', 92, 398, 1],
  look: 'Die Tür zum Konferenzsaal. Darauf klebt ein vergilbtes Plakat: „1. Internationale Scherzartikel-Messe – HEUTE: 1987!“ Heute ist schon eine Weile her.' });

// ---------- Regeln im Konferenzsaal ----------
RULES['look o:clown'] = line('Lachi, das Maskottchen der Messe: ein aufblasbarer Clown, größer als Dr. Fred. Er grinst seit 1987 ohne Pause. Respekt.');
async function CLOWN_STUPS() {
  G.clownStoss = G.t; Sound.sfx('rubber'); await wait(500); Sound.sfx('giggle'); fl().lachHinweis = 1;
  await s('Er federt zurück und stupst mich mit der Nase an. Und irgendwo in seinem Bauch kichert etwas: „Hihihi!“');
  await s('Da drin steckt ein Lautsprecher. Eine Lach-Box! Nur komme ich nicht ran, solange er so prall ist.');
}
multi(['push', 'use'], 'o:clown', CLOWN_STUPS);
RULES['pull o:clown'] = line('Ich umarme ihn. Er gibt nach und drückt zurück. Das ist die längste Umarmung meines Lebens. Und die einzige.');
RULES['pick o:clown'] = line('Lachi ist größer als ich und genauso aufgeblasen wie Dr. Freds Ego. Den kriege ich nicht in die Tasche.');
RULES['open o:clown'] = async () => { fl().lachHinweis = 1; await s('Das Ventil ist mit Sekundenkleber zugeklebt. Daneben ein Aufkleber: „Nie wieder platt! – Ihr Lachi-Team“.'); await s('Ich bräuchte etwas Spitzes. Etwas sehr Spitzes.'); };
RULES['talk o:clown'] = async () => { await s('Hallo, Lachi.'); Sound.sfx('giggle'); await wait(700); await s('Er kichert. Er kichert immer. Ich glaube, er hat keine Wahl.'); };
async function CLOWN_PLATT() {
  await s('Tut mir leid, Lachi. Es ist für die Weltrettung.');
  act('bernard', 'reach', 700); await wait(350);
  Sound.sfx('pop'); G.clownPlatt = G.t; Sound.sfx('deflate'); shake(1700, 2.5); await wait(1900);
  fl().clownPlatt = 1; unlock('clown'); await wait(300);
  Sound.sfx('giggle');
  await s('Pfffffft … und aus seinem Bauch ist eine kleine schwarze Kiste gekullert. Sie kichert noch.');
}
RULES['use i:schere o:clown'] = CLOWN_PLATT;
RULES['use i:rechner o:clown'] = line('Ich könnte ihn mit dem Taschenrechner anstechen. Wenn der spitz wäre. Ist er nicht. Er ist rund. Wie ich.');
RULES['look o:clownrest'] = line(() => fl().lachkiste ? 'Der arme Lachi. Platt wie ein Pfannkuchen, aber er grinst immer noch. Mit X-Augen.' : 'Der arme Lachi. Platt wie ein Pfannkuchen. Neben ihm liegt eine kleine schwarze Kiste.');
multi(['pick', 'push', 'pull', 'use'], 'o:clownrest', line('Ich lasse ihn in Frieden ruhen. Er hat genug durchgemacht.'));
RULES['look o:lachkiste_k'] = line('Eine kleine schwarze Kiste mit Lautsprecher und Schalter. Das war Lachis Stimme.');
multi(['pick', 'use'], 'o:lachkiste_k', async () => {
  act('bernard', 'pick', 650); await wait(300);
  fl().lachkiste = 1; addItem('lachkiste');
  await s('Die Lach-Box! Mit Schalter: KICHERN – LACHEN – BÖSES LACHEN. Er klemmt auf BÖSES LACHEN.');
  await s('Lachi war wohl auch für die Halloween-Messe vorgesehen. Die dann ausgefallen ist. Aus Gründen.');
});
RULES['look o:furzkissen'] = line('Ein Furzkissen auf dem Stuhl des Messeleiters. Ein Klassiker. Wie das Rad. Nur lauter.');
multi(['push', 'use'], 'o:furzkissen', async () => { Sound.sfx('fart'); await wait(900); await s('… Das war das Kissen. Ehrlich. Wissenschaftlich nachweisbar.'); });
RULES['pick o:furzkissen'] = line('Ein Furzkissen in der Tasche ist ein Unfall mit Ansage.');
RULES['look o:namensschild'] = line('„DR. FRED EDISON – EHRENGAST“. Dr. Fred war Ehrengast einer Scherzartikel-Messe? Das erklärt das Furzkissen in seinem Laborkittel.');
RULES['pick o:namensschild'] = line('Ich nehme Dr. Freds Namensschild nicht mit. Sonst halten mich die Leute noch für ein Genie. Oder für verrückt. Bei ihm weiß man das nie.');
RULES['look o:gebiss'] = line('Ein Klappergebiss zum Aufziehen. Es grinst. Alles hier grinst. Langsam wird es unheimlich.');
multi(['use', 'push'], 'o:gebiss', async () => { Sound.sfx('chatter'); await wait(900); await s('Klapper, klapper. Es hat seit 1987 auf diesen Moment gewartet.'); });
RULES['pick o:gebiss'] = line('Fremde Zähne nehme ich nicht mit. Auch keine aufziehbaren.');
RULES['look o:projektor'] = line('Ein Diaprojektor mit Rundmagazin. Er brummt und wärmt die Luft. Seit 1987.');
multi(['use', 'push'], 'o:projektor', async () => { Sound.sfx('click2'); await wait(300); Sound.sfx('click2'); await s('Klick. Klick. Das Magazin hat genau ein Dia. Und das ist deprimierend.'); });
RULES['pick o:projektor'] = line('Der ist am Tisch festgeschraubt. Vermutlich wegen eines Vorfalls mit Juckpulver.');
RULES['look o:messestand'] = line('Juckpulver, Niespulver, Schock-Kaugummi, ein Springteufel und Scherzbrillen mit Nase. Alles 87 Prozent billiger. Kaufen will trotzdem keiner.');
RULES['pick o:messestand'] = line('Ich nehme nichts. Juckpulver und Wissenschaft vertragen sich nicht.');
RULES['use o:messestand'] = line('Ich setze eine Scherzbrille auf. … Nein. Ich sehe damit genauso aus wie vorher. Das ist irgendwie beleidigend.');
RULES['look o:kotze'] = line('Gummi-Erbrochenes. Täuschend echt. Ich hoffe sehr, dass es Gummi ist.');
RULES['pick o:kotze'] = line('Erst wenn jemand schriftlich bestätigt, dass es Gummi ist. Mit Stempel.');
RULES['push o:kotze'] = line('Es wackelt. Es ist Gummi. Glaube ich. Hoffe ich. Bete ich.');
multi(['push', 'pull'], 'o:ballons', async () => { Sound.sfx('squeak'); await s('Sie quietschen beleidigt. Ich lasse sie in Ruhe.'); });

// ---------- Labor: drei Chrono-Klos im Intro ----------
// Die Reise-Klos von Hoagie (rechts) und Laverne (links) stehen nur im Intro (Flags kloH, kloL; Bilder als Varianten);
// solange sie stehen, verdecken sie Hebel, Absperrband und Cousin Ted.
{
  const P = (ALTBAU3D.labor || {}).points || {}, objs = ROOMS.labor.objs, ob = id => objs.find(q => q.id === id);
  for (const [id, key, flag, rect] of [['reiseklo_h', 'klo_hoagie', 'kloH', [850, 100, 110, 250]], ['reiseklo_l', 'klo_laverne', 'kloL', [612, 100, 112, 250]]]) {
    objs.push({ id, name: 'Chrono-Klo', rect, visible: () => flagOn(flag), look: 'Ein Chrono-Klo. Eins von dreien.',
      draw: c => { const o = P[key + '_oben'], u = P[key + '_unten'], b = P[key + '_birne']; if (o && u && b) kloFx(c, id, o[0], o[1], u[1], b[0], b[1]); } });
  }
  for (const id of ['hebel', 'absperrband']) {
    const o = ob(id);
    if (!o) continue;
    const vis = o.visible;
    o.visible = () => !flagOn('kloL') && (!vis || vis());
  }
  const tedMal = EGG_DRAW.mummy;
  EGG_DRAW.mummy = (c, e, t) => { if (!flagOn('kloL')) tedMal(c, e, t); };
}

// ---------- Zukunftsgarten: Fahnenmast (Lilas Wappen, dann die Ur-Fahne von 1776, dann leer) ----------
{
  const objs = ROOMS.fgarten.objs, A = (ALTBAU3D.fgarten || {}).anchors || {};
  const mast = { id: 'fahnenmast', name: () => fl().urFahne && !fl().kostuem ? 'Ur-Fahne' : 'Fahnenmast', rect: [372, 24, 110, 318], walk: [470, 364], dv: 'look',
    draw: (c, t) => {   // Blitz, wenn die Geschichte die Fahne austauscht
      if (!G.fahneBlitz || G.t - G.fahneBlitz > 900 || c.isPix) return;
      const k = (G.t - G.fahneBlitz) / 900, [x, y] = [A.Mast ? A.Mast[0] + 46 : 420, A.Mast ? A.Mast[1] + 34 : 62];
      glowAt(c, x, y, 40 + k * 90, '#fff6c8', (1 - k) * 0.9);
      for (let i = 0; i < 8; i++) { const a = i * 0.785 + k * 2, r = 20 + k * 80; c.save(); c.globalAlpha = 1 - k; L(c, [x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, x + Math.cos(a) * (r + 12), y + Math.sin(a) * (r + 12) * 0.7], 3, '#ffe9a0'); c.restore(); }
    } };
  objs.splice(Math.max(0, objs.findIndex(q => q.id === 'statue')), 0, mast);   // vor der Statue: dort, wo sich beide überlappen, gewinnt die Statue
}

// ---------- Palast-Vorraum: das Plakat heißt nach dem Abreißen „Schleimspuren“ ----------
{
  const o = ROOMS.vorraum.objs.find(q => q.id === 'plakat');
  if (o) o.name = () => fl().plakatWeg ? 'Schleimspuren' : 'Plakat';
}

// ---------- Gasthaus 1776: die neue Nationalfahne auf dem Besenstiel ----------
{
  const v = ((ALTBAU3D.gasthaus || {}).variants || {}).fahne;
  ROOMS.gasthaus.objs.push({ id: 'fahne1776', name: 'Fahne', rect: v ? [v.x + 4, v.y + 4, v.w - 8, v.h - 8] : [758, 182, 66, 166], walk: [796, 376], visible: () => !!fl().fahne });
}

// ---------- Laverne im Kostüm: 3D-Bild wie die Tentakel (hüpft und schwankt), in der Pixel-Grafik gezeichnet ----------
TENT3D.kostuem = ['kostuem'];
function kostuemAn(a) { return !!(G.state && fl().kostuemAn && ROOMS[a.room] && ROOMS[a.room].era === 'future'); }
function kostuem2d(c, a, t) {
  const hop = a.walking ? Math.abs(Math.sin(a.phase)) * 14 : 0;
  c.save(); c.translate(0, -hop);
  for (const lx of [-8, 8]) {   // Ringelbeine und Schuhe
    for (let i = 0; i < 4; i++) R(c, lx - 3.5, -27 + i * 6, 7, 6, i % 2 ? '#f4f0ea' : '#e0262e', 0, 0);
    R(c, lx - 3.5, -27, 7, 24, null, 2, 1); E(c, lx + 4, -2, 9, 4, '#4a4a5a', 2);
  }
  c.translate(0, -24);
  tentacleBody(c, Object.assign(Object.create(a), { walking: false }), t, '#e0262e', '#162a6a', '#f6f2ea', { h: 160, front: (sway, h) => {
    for (const f of [0.18, 0.34, 0.5]) {   // weiße Streifen
      const y = -h * f, x0 = -24 + 10 * f + sway * f + 4, x1 = 30 - 8 * f + sway * f - 6;
      L(c, [x0, y, x1, y], 7, '#f6f2ea');
    }
    E(c, 4 + sway, -h + 22, 17, 16, '#1f3a8a', 2.5);   // blaues Feld mit Sternen
    for (const [sx, sy] of [[-6, -6], [6, -10], [14, 0], [-2, 6], [10, 9]]) E(c, 4 + sway + sx, -h + 22 + sy, 1.6, 1.6, '#ffffff', 0);
    for (const ex of [3, 14]) { E(c, ex + sway, -h + 30, 5.5, 6.5, '#0e0a18', 1.5); E(c, ex + sway, -h + 30, 4, 5, '#ffffff', 0); E(c, ex + 1.5 + sway, -h + 31, 2, 2.4, '#101018', 0); }
    P(c, [9 + sway, -h + 37, 25 + sway, -h + 42, 9 + sway, -h + 44], '#f2b48c', 1.5);   // Lavernes Nase
  } });
  c.restore();
}
{
  const drawn = CHAR.laverne;
  CHAR.laverne = (c, a, t) => {
    if (!kostuemAn(a)) return drawn(c, a, t);
    if (!tent3d(c, Object.assign(Object.create(a), { kind: 'kostuem' }), t)) kostuem2d(c, a, t);
  };
}

// ---------- Inventar: 3D-Bilder, gezeichnete Symbole für die Pixel-Grafik ----------
Object.assign(ICON, {
  schnittmuster(c) {
    c.save(); c.rotate(0.12); R(c, -17, -20, 34, 40, '#ece2c8', 2, 2);
    c.setLineDash([4, 3]); S(c, null, 2, () => { c.moveTo(-9, 15); c.quadraticCurveTo(-12, -4, -4, -14); c.quadraticCurveTo(6, -18, 8, -4); c.quadraticCurveTo(10, 8, 9, 15); }, '#3a2a40'); c.setLineDash([]);
    E(c, -3, -6, 2, 2.5, null, 1.5, 0, '#c8262e'); E(c, 4, -6, 2, 2.5, null, 1.5, 0, '#c8262e'); c.restore();
  },
  schere(c) {
    c.save(); c.rotate(-0.5);
    for (const s_ of [-1, 1]) { P(c, [0, -2, s_ * 4, -24, s_ * 1, -24], '#c4ccd6', 2); E(c, s_ * 6, 12, 6, 8, null, 3, 0, '#3a3a46'); L(c, [0, 0, s_ * 5, 5], 3, '#3a3a46'); }
    E(c, 0, 0, 2.5, 2.5, '#d8b04a', 1.5); c.restore();
  },
  lachkiste(c) {
    R(c, -16, -13, 32, 28, '#3c3a4a', 2.5, 4);
    for (let i = 0; i < 4; i++) L(c, [-11, -5 + i * 5, 2, -5 + i * 5], 2, '#8a8a98');
    E(c, 9, -16, 5, 3, '#d8323a', 2); R(c, 6, 4, 7, 4, '#ffd23a', 1.5, 1);
  },
  kostuem(c) {
    c.save(); c.rotate(0.35);
    P(c, [-11, 20, -9, -10, -4, -20, 6, -20, 10, -10, 12, 20], '#e0262e', 2.5);
    for (const y of [12, 2, -6]) L(c, [-9, y, 11, y], 3.5, '#f6f2ea');
    E(c, 1, -14, 8, 7, '#1f3a8a', 2); E(c, -2, -14, 1.6, 2, '#0e0a18', 0); E(c, 4, -14, 1.6, 2, '#0e0a18', 0);
    c.restore();
  },
});
for (const id of ['schnittmuster', 'schere', 'lachkiste', 'kostuem']) {
  ICON_3D[id] = loadImg(`img/items/${id}.png`);
  const drawn = ICON[id];
  ICON[id] = c => { const im = ICON_3D[id]; if (hd(c) && imgOk(im)) c.drawImage(im, -30, -30, 60, 60); else drawn(c); };
}
