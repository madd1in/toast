'use strict';
// ============================================================
//  Tentakel-Toast – drei Cameos (Easter Eggs, eigene 3D-Modelle: art/blender/cameo3d.py, cameo_post.py)
//  Karl Klammer, die Büroklammer mit Augenbrauen, sitzt im Konferenzsaal auf dem Tisch und will helfen.
//  Clawd, das kleine orange Maskottchen von Claude Code, hockt im Labor auf dem Gut-O-Mat.
//  Ein humanoider Roboter im Stil des Unitree G1 übt im Zukunftsgarten Kung-Fu (und kann Saltos).
// ============================================================
Object.assign(CAMEO_IMG, { klammer: loadImg('img/klammer.png'), clawd: loadImg('img/clawd.png'), roboter: loadImg('img/roboter.png') });
Object.assign(CAMEO, {"klammer": {"upp": 0.4333, "f": {"idle": [0, 0, 178, 190, -38.6, -78.5], "brauen": [180, 0, 178, 190, -38.6, -78.5], "blick": [360, 0, 178, 190, -38.6, -78.5]}}, "clawd": {"upp": 0.4333, "f": {"idle": [0, 0, 176, 130, -38.1, -53.8], "blinzel": [178, 0, 176, 130, -38.1, -53.8], "hops": [356, 0, 176, 130, -38.1, -63.4]}}, "roboter": {"upp": 0.4333, "f": {"idle": [0, 0, 148, 355, -32.1, -150.9], "kick": [150, 0, 226, 347, -22.5, -145.3], "gruss": [378, 0, 170, 390, -32.1, -166.1]}}});

const KLAMMER_S = 0.66, CLAWD_S = 0.66;
const fxSeit = (k, t) => (G.eggFx && G.eggFx[k] ? t - G.eggFx[k] : 1e9);

Object.assign(EGGS, {
  klammer: { name: 'Karl Klammer', kind: 'klammer', room: 'konferenz', x: 452, y: 294, w: 40, h: 46, walk: [452, 364], dv: 'talk',
    look: ['Eine Büroklammer mit Glupschaugen und sehr beweglichen Augenbrauen. Sie sitzt auf einem Notizblatt und wartet darauf, dass jemand einen Brief schreibt.',
      'Auf dem Notizblatt steht: „Liebe Wache, …“ Weiter ist sie nicht gekommen.'],
    talk: async p => {
      G.eggFx.klammer = G.t; Sound.sfx('squeak');
      if (fl().klammerNie) {
        await say(null, '„Sie haben „Bitte nie wieder fragen“ gewählt. Ich frage trotzdem: Möchten Sie Hilfe?“');
        await say(p, 'Er gibt nicht auf. Das muss man ihm lassen.');
      } else await say(null, '„Hallo! Ich bin Karl Klammer. Es sieht so aus, als wollten Sie die Welt retten. Möchten Sie Hilfe dabei?“');
      await say(p, pick(['Äh … ja?', 'Na gut. Aber nur kurz.', 'Wenn es sein muss.']));
      await say(null, `„Tipp: ${hintText().replace(/^(Bernard|Hoagie|Laverne): /, '')}“`);
      await say(null, '„War dieser Tipp hilfreich? ( ) Ja  ( ) Nein  ( ) Bitte nie wieder fragen“');
      if (!fl().klammerNie) { fl().klammerNie = 1; await say(p, 'Ich kreuze „Bitte nie wieder fragen“ an. Mit Nachdruck.'); }
    },
    use: async p => { G.eggFx.klammer = G.t; await say(null, '„Sie scheinen eine Büroklammer benutzen zu wollen. Soll ich Ihnen zeigen, wie das geht?“'); await say(p, 'Nein danke. Ich kenne Büroklammern. Ich bin Wissenschaftler.'); },
    pick: ['Er hält sich am Notizblatt fest. Mit den Augenbrauen. Ich weiß nicht, wie, aber es funktioniert.'],
    push: ['Er federt zurück. Büroklammern sind zäher, als man denkt.'] },
  clawd: { name: 'Clawd', kind: 'clawd', room: 'labor', x: 572, y: 168, w: 36, h: 40, walk: [566, 366], dv: 'talk',
    look: ['Ein kleiner oranger Klotz mit zwei Augen-Balken und vier Beinchen. Er hockt auf dem Gut-O-Mat und tippt auf einer Tastatur, die gar nicht da ist.',
      'Auf seinem Rücken steht klein: „Clawd – Code-Assistent“. Er behauptet, er hätte das ganze Haus in Blender nachgebaut. Ein Bild pro Aufruf.'],
    talk: async p => {
      G.eggFx.clawd = G.t; Sound.sfx('botbeep');
      if (!fl().clawdGesehen) {
        fl().clawdGesehen = 1;
        await say(null, '„Hallo! Ich bin Clawd. Ich helfe Dr. Fred beim Programmieren. Er sagt, ich soll weniger Kommentare schreiben. Auf Deutsch.“');
      } else await say(null, pick(['„Moment, ich lese erst die ganze Datei.“', '„Ich hab das getestet. Zweimal. Einmal davon hing Blender.“', '„Hallo nochmal! Du hast gefragt, also helfe ich.“']));
      await say(null, `„Soll ich dir einen Plan machen? Schritt eins: ${hintText().replace(/^(Bernard|Hoagie|Laverne): /, '')}“`);
      await say(null, '„Schritt zwei: alles testen. Schritt drei: committen. Aber erst, wenn du es sagst.“');
      await say(p, 'Sehr gewissenhaft. Fast schon unheimlich.');
    },
    use: async p => { G.eggFx.clawd = G.t; Sound.sfx('chirp'); await say(p, '„Pieps!“ Er hüpft einmal im Kreis und prüft dann, ob alles noch funktioniert.'); },
    pick: ['Er erklärt mir sehr höflich und ausführlich, warum er das lieber nicht möchte. Ich lasse ihn sitzen.'],
    push: ['„Vorsicht, ich bin gerade mitten in einem Render!“'] },
  roboter: { name: 'Kung-Fu-Roboter', kind: 'roboter', room: 'fgarten', x: 792, y: 362, w: 56, h: 104, walk: [736, 396], dv: 'talk',
    look: ['Ein humanoider Roboter, gut 1,30 Meter groß. Auf dem Rücken steht „UNITREE G1“. Er übt im Garten Seiner Lilaheit Kung-Fu.',
      'Er tritt gegen die Luft. Die Luft hat bisher jedes Mal verloren.'],
    talk: async p => {
      G.eggFx.roboter = G.t; Sound.sfx('botbeep');
      await say(null, '„PIEP. Lieferroboter G1, zurzeit Gärtner Seiner Lilaheit. Ich jäte Unkraut. Mit Kung-Fu.“');
      await say(p, 'Und, klappt das?');
      await say(null, '„Das Unkraut hat Angst. Das zählt.“');
    },
    use: async p => { await say(p, 'Ich tippe ihm auf die Schulter …'); await roboSalto(); await say(p, 'Ein Rückwärtssalto. Er landet perfekt. Applaus von genau einem Glühwürmchen.'); },
    pick: ['Er wiegt 35 Kilo und kann Kung-Fu. Ich lasse ihn lieber stehen.'],
    push: async p => { await roboSalto(); await say(p, 'Er weicht mit einem Salto aus. Angeber.'); } },
});
async function roboSalto() { G.eggFx.roboFlip = G.t; Sound.sfx('whoosh'); await wait(1050); Sound.sfx('thunk'); await wait(250); }

// ---------- Zeichnen: Federn, Blinzeln, Hüpfen, Kung-Fu und Salto ----------
EGG_DRAW.klammer = (c, e, t) => {
  const k = fxSeit('klammer', t), aktiv = k < 1500;
  const fr = aktiv || ((t + 2000) % 7000) < 700 ? 'brauen' : ((t + 5000) % 9000) < 1300 ? 'blick' : 'idle';
  const hop = aktiv ? Math.abs(Math.sin(k * 0.012)) * 6 * (1 - k / 1500) : 0;
  c.save(); c.translate(0, -hop); c.rotate(Math.sin(t * 0.003) * 0.03 + (aktiv ? Math.sin(k * 0.02) * 0.08 * (1 - k / 1500) : 0));
  drawCameo(c, 'klammer', fr, KLAMMER_S);
  c.restore();
};
EGG_DRAW.clawd = (c, e, t) => {
  const k = fxSeit('clawd', t), aktiv = k < 1200, hopIdle = ((t + 3000) % 11000) < 600;
  const fr = aktiv || hopIdle ? 'hops' : ((t + 700) % 4300) < 160 ? 'blinzel' : 'idle';
  const q = aktiv ? k / 1200 : ((t + 3000) % 11000) / 600;
  const hop = aktiv || hopIdle ? Math.abs(Math.sin(q * Math.PI * (aktiv ? 3 : 1))) * 7 : 0;
  if (!c.isPix) shadow(c, 0, 1, 14, 3, 0.22);
  c.save(); c.translate(0, -hop); drawCameo(c, 'clawd', fr, CLAWD_S); c.restore();
};
EGG_DRAW.roboter = (c, e, t) => {
  const s = roomScale(ROOMS[e.room], e.y), q = fxSeit('roboFlip', t) / 1100;
  let fr = ((t + 1500) % 5200) < 900 ? 'kick' : 'idle';
  if (fxSeit('roboter', t) < 2800) fr = 'gruss';
  if (!c.isPix) shadow(c, 0, 2, 30 * s, 7 * s, q < 1 ? 0.14 : 0.25);
  c.save();
  if (q < 1) {   // Rückwärtssalto um die Körpermitte, mit Sprungbogen
    const mid = -70 * s, h = Math.sin(q * Math.PI) * 60 * s;
    c.translate(0, mid - h); c.rotate(-q * Math.PI * 2); c.translate(0, -mid); fr = 'idle';
  }
  drawCameo(c, 'roboter', fr, s);
  c.restore();
};
