'use strict';
// ============================================================
//  Tentakel-Toast – Cartoon-Mimik und -Gestik (Day of the Tentacle trifft Tom & Jerry)
//  Jeder Satz wird kurz „gelesen“: Bei Schreck (?!, HUCH, viele Großbuchstaben) holt die Figur aus, schnellt hoch,
//  die Augen quellen hervor und ein Ausrufezeichen ploppt auf; bei Wut zittert und dampft sie; bei Freude federt sie
//  zweimal und es funkelt; Staunen weitet die Augen; Verlegenheit bringt einen Schweißtropfen. Beim Reden federt jede
//  Figur im Silbentakt (Squash & Stretch). Rätsel gelöst = Freudensprung, Fehlschlag = Schreck.
//  Alles als Verformung und 2D-Zeichnung über den vorhandenen Figurenbildern, in HD wie im Pixel-Modus.
// ============================================================
const MIMIK_DAUER = { schreck: 1100, wut: 1800, freude: 1300, staunen: 1000, peinlich: 1700 };
function mimikVon(text) {
  const s = String(text || '').replace(/^[„"“*\s…]+/, '');
  const laut = (s.match(/\b[A-ZÄÖÜ]{3,}\b/g) || []).filter(w => !/^(GUT|BÖSE|LILA|KLO|CHRONO|KAFFEE|UNITREE|EHRENGAST|DR|ED|FRED)$/.test(w)).length;
  if (/^(Hups|Ups|Äh|Ähm|Oh-oh|Oje|Peinlich|Hm\. )/.test(s)) return 'peinlich';
  if (/(HALT|VERBOTEN|Finger weg|Staatseigentum|STAATSEIGENTUM|^HEY!|NEIN!|SOFORT|unverzeihlich|Wer hat .* genehmigt)/.test(s)) return 'wut';
  if (/(\?!|!\?)/.test(s) || /^(HUCH|Huch|OH NEIN|Oh nein|AAAH|Hilfe|Moment\. |Oh\. Oh)/.test(s)) return 'schreck';
  if (/^(JAAA|JA!|Juhu|JUHU|Hurra|Wunderbar|Großartig|Hervorragend|Exzellent|Perfekt|FERTIG|Erfolg|Bravo|WOOO|Yeah|ENDLICH|Endlich|Haha)/.test(s)) return 'freude';
  if (/^(Whoa|Wow|Wahnsinn|Donnerwetter|Ooh|Uiii|Alter!)/.test(s)) return 'staunen';
  if (laut >= 2) return /!/.test(s) ? 'schreck' : 'staunen';
  return null;
}
function mimikStart(a, kind) { if (a && kind && !G.fast && !G.skipAll) a.mimik = { kind, t0: G.t }; }
{
  const sayOhneMimik = say;
  say = function (id, text) { if (id && ACT[id]) mimikStart(ACT[id], mimikVon(text)); return sayOhneMimik(id, text); };
}
// Rätsel gelöst: Freudensprung; Fehlschlag, Stromschlag: Schreck (die Geräusche verraten, was passiert ist)
Sound.onSfx(n => {
  if (!G.state || G.screen !== 'game') return;
  const k = { chapter: 'freude', achieve: 'freude', solve: 'freude', bad: 'schreck', zap: 'schreck', pop: 'staunen', fart: 'peinlich' }[n];
  if (k && !(me().mimik && G.t - me().mimik.t0 < 300)) mimikStart(me(), k);
});

// Verformung zum Zeitpunkt t: Skalierung um die Füße, Sprunghöhe, Neigung, Zittern, Glubschaugen
function mimikForm(a, t) {
  let sx = 1, sy = 1, lift = 0, rot = 0, jx = 0, pop = 0, k = 0;
  const m = a.mimik;
  if (a.talking) { const b = Math.sin(t * 0.021 + (a.seed || 0) * 5); sy += b * 0.022; sx -= b * 0.014; }   // federt im Silbentakt
  if (m) {
    k = (t - m.t0) / MIMIK_DAUER[m.kind];
    if (k < 0 || k >= 1) a.mimik = null;
    else if (m.kind === 'schreck') {   // ausholen – hochschnellen – landen und nachfedern
      if (k < 0.08) { const q = k / 0.08; sy = 1 - 0.14 * q; sx = 1 + 0.12 * q; }
      else if (k < 0.45) { const q = (k - 0.08) / 0.37; lift = Math.sin(q * Math.PI) * 26; sy = 1.16 - 0.16 * q; sx = 0.88 + 0.12 * q; }
      else { const q = (k - 0.45) / 0.55, w = Math.exp(-q * 4) * Math.sin(q * 22); sy = 1 - 0.12 * w; sx = 1 + 0.1 * w; }
      pop = k < 0.75 ? Math.min(1, k / 0.1) : (1 - k) / 0.25;
    } else if (m.kind === 'wut') { jx = Math.sin(t * 0.09) * 2.4 * (1 - k * 0.5); sy = 1.03; sx = 0.98; rot = 0.05; }
    else if (m.kind === 'freude') { const q = (k * 2) % 1, h = Math.sin(q * Math.PI); lift = h * 15; sy = 1 + (h - 0.5) * 0.16; sx = 1 - (h - 0.5) * 0.12; }
    else if (m.kind === 'staunen') { lift = Math.sin(Math.min(1, k / 0.35) * Math.PI) * 8; sy = 1 + 0.06 * Math.sin(k * Math.PI); pop = Math.sin(Math.min(1, k * 1.2) * Math.PI) * 0.7; }
    else if (m.kind === 'peinlich') { sy = 1 - 0.04 * Math.sin(Math.min(1, k * 3) * Math.PI / 2); sx = 1.02; rot = -0.04; }
  }
  return { sx, sy, lift, rot, jx, pop, k, m: a.mimik };
}
// Glubschaugen über den Augen der 3D-Figur (Augenpunkte aus figuren3d.js: Index 8/9 vorn, 10/11 hinten)
function mimikAugen(c, a, pop) {
  const F = a._fig;
  if (!F || F.length < 12 || pop <= 0) return;
  const r = 4 + 6.5 * pop;
  for (const i of [10, 8]) {
    const x = F[i], y = F[i + 1] - pop * 5;
    E(c, x, y, r * 0.82, r, '#ffffff', 2);
    E(c, x + r * 0.22, y + r * 0.08, r * 0.36, r * 0.42, '#16121e', 0);
    E(c, x + r * 0.05, y - r * 0.38, r * 0.2, r * 0.16, 'rgba(255,255,255,0.95)', 0);
  }
}
function stern(c, x, y, r, col) { P(c, [x, y - r, x + r * 0.28, y - r * 0.28, x + r, y, x + r * 0.28, y + r * 0.28, x, y + r, x - r * 0.28, y + r * 0.28, x - r, y, x - r * 0.28, y - r * 0.28], col, 1.5); }
// Zeichen über dem Kopf: Ausrufezeichen, Dampf, Zornesader, Funkeln, Schweißtropfen (nicht gespiegelt, damit Schrift lesbar bleibt)
function mimikDeko(c, a, t, f) {
  const m = f.m;
  if (!m) return;
  const F = a._fig, top = F ? F[5] : -(a.h || 180) * 0.95, hx = F ? F[8] : 10, k = f.k;
  c.save(); c.translate(0, -f.lift); if (a.dir < 0) c.scale(-1, 1);
  const sx = a.dir < 0 ? -hx : hx;
  if (m.kind === 'schreck' && k < 0.85) {
    const s = Math.min(1, k / 0.12) * (1 + Math.sin(Math.min(1, k / 0.2) * Math.PI) * 0.35);
    c.save(); c.translate(sx * 0.4, top - 26); c.scale(s, s);
    txt(c, '!', 0, 12, '400 34px "Titan One", sans-serif', '#ffe066', 'center', 6, '#1b1020'); c.restore();
    for (let i = 0; i < 3; i++) {   // Schweißtropfen fliegen weg
      const q = Math.min(1, k * 2.2), ang = -0.9 + i * 0.9, d = 14 + q * 26;
      c.save(); c.globalAlpha = 1 - q; c.translate(Math.sin(ang) * d, top + 18 - Math.cos(ang) * d * 0.8); c.rotate(ang);
      P(c, [0, -6, 3.5, 1, 0, 4, -3.5, 1], '#8fd8ff', 1.2); c.restore();
    }
  } else if (m.kind === 'wut') {
    for (let i = 0; i < 2; i++) {   // Dampfwolken aus dem Kopf
      const q = ((t * 0.0016) + i * 0.5) % 1;
      c.save(); c.globalAlpha = (1 - q) * 0.85; E(c, (i ? 12 : -12) + Math.sin(q * 6 + i) * 4, top - 4 - q * 30, 6 + q * 8, 5 + q * 6, '#f4f2f8', 1.5); c.restore();
    }
    c.save(); c.translate(sx + 10, top + 14); const s = 1 + Math.sin(t * 0.03) * 0.15; c.scale(s, s);   // Zornesader
    for (const [rx, ry] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S(c, null, 2.6, () => { c.moveTo(rx * 2, ry * 7); c.quadraticCurveTo(rx * 2, ry * 2, rx * 7, ry * 2); }, '#e8303a');
    c.restore();
  } else if (m.kind === 'freude') {
    for (let i = 0; i < 4; i++) {
      const q = ((k * 1.6) + i * 0.25) % 1, ang = i * 1.57 + k * 2;
      c.save(); c.globalAlpha = Math.sin(q * Math.PI); stern(c, Math.cos(ang) * 30, top + 10 + Math.sin(ang) * 18 - q * 10, 4 + q * 4, i % 2 ? '#ffe066' : '#ffffff'); c.restore();
    }
  } else if (m.kind === 'staunen' && k < 0.8) {
    c.save(); c.globalAlpha = 1 - k / 0.8; stern(c, sx * 0.3 + 14, top - 10, 6 + k * 6, '#ffe066'); c.restore();
  } else if (m.kind === 'peinlich') {   // Schweißtropfen rinnt an der Schläfe herunter
    const q = Math.min(1, k * 1.3);
    c.save(); c.globalAlpha = 1 - Math.max(0, (k - 0.75) / 0.25); c.translate(-sx * 0.2 - 14, top + 14 + q * 16);
    P(c, [0, -8, 4.5, 2, 0, 6, -4.5, 2], '#8fd8ff', 1.5); E(c, -1.2, 1, 1.2, 1.8, 'rgba(255,255,255,0.8)', 0); c.restore();
  }
  c.restore();
}
// alle Figuren-Zeichner umhüllen (Helden, Nebenfiguren, Tentakel, Gäste, Laverne im Kostüm)
for (const kind of Object.keys(CHAR)) {
  const drawn = CHAR[kind];
  CHAR[kind] = (c, a, t) => {
    if (!a || a.x == null || !a.room) return drawn(c, a, t);   // Porträts und Karten bleiben ruhig
    const f = mimikForm(a, t);
    if (f.sx === 1 && f.sy === 1 && !f.lift && !f.rot && !f.jx && !f.m) return drawn(c, a, t);
    c.save(); c.translate(f.jx, -f.lift); c.rotate(f.rot); c.scale(f.sx, f.sy);
    try { drawn(c, a, t); mimikAugen(c, a, f.pop); } finally { c.restore(); }
    mimikDeko(c, a, t, f);
  };
}
