'use strict';
// ============================================================
//  Tentakel-Toast – Cartoon-Mimik und -Gestik (Day of the Tentacle trifft Tom & Jerry)
//  Jeder Satz wird kurz „gelesen“: Beim Schreck („?!“, HUCH, viele Großbuchstaben) holt die Figur tief aus,
//  schießt wild-gestreckt in die Höhe und FRIERT dort ein – Glubschaugen auf Stielen, Ausrufezeichen, Schweißtropfen
//  –, stürzt ab und landet mit platschendem Squash und langem Nachfedern. Bei Wut vibriert der ganze Körper,
//  der Kopf glüht rot und Dampf pafft aus den Ohren; bei Freude hüpft die Figur zweimal hoch – erst in die Hocke,
//  dann zack! –, Herzen steigen auf und es funkelt; Staunen reißt Augen und Kinnlade weit auf und lehnt zurück;
//  Ekel schaudert weg und winkt sich Luft zu; Verlegenheit lässt die Figur in sich zusammensinken, mit blauen
//  Wangen und einer Schwitzfontäne. Beim Reden federt jede Figur im Silbentakt (Squash & Stretch).
//  Rätsel gelöst = Freudensprung, Fehlschlag = Schreck.
//  Alles als Verformung und 2D-Zeichnung über den vorhandenen Figurenbildern, in HD wie im Pixel-Modus.
// ============================================================
const MIMIK_DAUER = { schreck: 1600, wut: 2100, freude: 1700, staunen: 1400, peinlich: 1800, ekel: 1500 };
function mimikVon(text) {
  const s = String(text || '').replace(/^[„"“*\s…]+/, '');
  const laut = (s.match(/\b[A-ZÄÖÜ]{3,}\b/g) || []).filter(w => !/^(GUT|BÖSE|LILA|KLO|CHRONO|KAFFEE|UNITREE|EHRENGAST|DR|ED|FRED)$/.test(w)).length;
  if (/^(Hups|Ups|Oops|Äh|Ähm|Oh-oh|Oje|Oh je|Peinlich|Sorry|Entschuldigung|Hm\. )/.test(s)) return 'peinlich';
  if (/(HALT|VERBOTEN|Finger weg|Staatseigentum|STAATSEIGENTUM|^HEY!|NEIN!|SOFORT|NIEMALS|Unerhört|Unverschämt|Frechheit|unverzeihlich|Wer hat .* genehmigt)/.test(s)) return 'wut';
  if (/(\?!|!\?)/.test(s) || /^(HUCH|Huch|OH NEIN|Oh nein|AAAH|AHH+|Hilfe|VORSICHT|Oh\. Oh)/.test(s)) return 'schreck';
  if (/^(JAAA|JA!|Juhu|JUHU|Hurra|HURRA|Wunderbar|Großartig|Hervorragend|Exzellent|Perfekt|FERTIG|Erfolg|Bravo|WOOO|Yeah|YES|ENDLICH|Endlich|Haha|Prima|Toll!|Super!|Geschafft|Jippie)/.test(s)) return 'freude';
  if (/^(Whoa|Wow|WOW|Wahnsinn|Donnerwetter|Ooh|Uiii|Oha|Aha|Alter!)/.test(s)) return 'staunen';
  if (/^(Igitt|Bäh|Ih+h|Würg)|widerlich|ekelhaft/.test(s)) return 'ekel';
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
  const k = { chapter: 'freude', achieve: 'freude', solve: 'freude', bad: 'schreck', zap: 'schreck', pop: 'staunen', fart: 'peinlich', deflate: 'schreck' }[n];
  if (k && !(me().mimik && G.t - me().mimik.t0 < 300)) mimikStart(me(), k);
});

// Verformung zum Zeitpunkt t: Skalierung um die Füße, Sprunghöhe, Neigung, Zittern, Glubschaugen, Kinnlade
function mimikForm(a, t) {
  let sx = 1, sy = 1, lift = 0, rot = 0, jx = 0, pop = 0, kinn = 0, k = 0;
  const m = a.mimik;
  if (a.talking) { const b = Math.sin(t * 0.021 + (a.seed || 0) * 5); sy += b * 0.026; sx -= b * 0.016; }   // federt im Silbentakt
  if (m) {
    k = (t - m.t0) / MIMIK_DAUER[m.kind];
    if (k < 0 || k >= 1) a.mimik = null;
    else if (m.kind === 'schreck') {   // der wilde Take: in die Hocke – hochschießen – einfrieren – abstürzen – platschen – nachfedern
      if (k < 0.07) { const q = k / 0.07; sy = 1 - 0.24 * q; sx = 1 + 0.22 * q; rot = Math.sin(q * 31) * 0.03 * q; }
      else if (k < 0.4) {   // Schuss auf Höhe: ganz lang und dünn, oben eingefroren mit Feinzittern
        const q = Math.min(1, (k - 0.07) / 0.1), fall = k > 0.28 ? Math.pow((k - 0.28) / 0.12, 2) : 0;
        lift = 52 * (1 - fall * fall);
        sy = 1 + 0.5 * q * (1 - fall * 0.8); sx = 1 - 0.32 * q * (1 - fall * 0.8);
        jx = k > 0.14 && k < 0.28 ? Math.sin(t * 0.1) * 1.6 : 0;
      } else if (k < 0.48) { const q = (k - 0.4) / 0.08; sy = 1 - 0.3 * q; sx = 1 + 0.34 * q; lift = 0; }   // Aufprall: platt wie ein Flunder
      else { const q = (k - 0.48) / 0.52, w = Math.exp(-q * 3.4) * Math.sin(q * 24); sy = 1 - 0.16 * w; sx = 1 + 0.13 * w; }   // Boing-Boing-Boing
      pop = k < 0.75 ? Math.min(1.25, k / 0.07) : Math.max(0, 1.25 * (1 - k) / 0.25);
    } else if (m.kind === 'wut') {   // der ganze Körper vibriert, füllt sich und bebt vor Wut
      const weg = 1 - k * 0.4;
      jx = Math.sin(t * 0.105) * 5.2 * weg;
      rot = 0.05 + Math.sin(t * 0.09) * 0.024 * weg;
      sy = 1.05 + Math.sin(t * 0.06) * 0.02; sx = 0.96;
    } else if (m.kind === 'freude') {   // erst in die Hocke, dann zwei richtig große Hüpfer mit Bodenplatscher
      if (k < 0.08) { const q = k / 0.08; sy = 1 - 0.14 * q; sx = 1 + 0.12 * q; }   // Hocke als Anlauf
      else {   // zwei Hüpfer: jeder mit eigener Phase, Bodenkontakt plattsch und wieder hoch
        const q = ((k - 0.08) * 2.2) % 1, h = Math.sin(q * Math.PI), boden = Math.max(0, 1 - h * 3);
        lift = h * 32; sy = 1 + (h - 0.35) * 0.2 - boden * 0.16; sx = 1 - (h - 0.35) * 0.16 + boden * 0.16;
      }
    } else if (m.kind === 'staunen') {   // Rückwärtslehne, Augen weit, Kinnlade fällt bodenwärts
      const an = Math.min(1, k * 2.6);
      lift = Math.sin(an * Math.PI) * 12;
      sy = 1 + 0.05 * Math.sin(k * Math.PI); rot = -0.09 * an;
      pop = Math.sin(Math.min(1, k * 1.5) * Math.PI) * 1.05;
      kinn = Math.sin(Math.min(1, Math.max(0, (k - 0.06)) * 1.35) * Math.PI);
    } else if (m.kind === 'ekel') {   // Schauder rückwärts, Kopf weg, ein Arm wedelt Luft
      const weg = Math.exp(-k * 2.2);
      jx = Math.sin(t * 0.13) * 2.2 * weg;
      rot = -0.055 * Math.min(1, k * 3) + Math.sin(t * 0.05) * 0.012;
      sy = 1 - 0.03 * Math.min(1, k * 3); sx = 1.01;
      kinn = 0.35 * Math.sin(k * Math.PI);
    } else if (m.kind === 'peinlich') {   // in sich zusammensinken, wie ein Luftballon ohne Luft
      sy = 1 - 0.11 * Math.sin(Math.min(1, k * 2.6) * Math.PI / 2); sx = 1.05; rot = -0.05;
    }
  }
  return { sx, sy, lift, rot, jx, pop, kinn, k, m: a.mimik };
}
// Glubschaugen über den Augen der Figur – bei Tom & Jerry wachsen sie auf Stielen aus dem Kopf
function mimikAugen(c, a, pop, kinn) {
  const F = a._fig;
  if (!F || F.length < 12 || pop <= 0) return;
  const r = 4 + 7.5 * pop, up = pop * 7;
  for (const i of [10, 8]) {
    const x = F[i], y = F[i + 1] - up, stiel = pop > 0.45;
    if (stiel) { c.save(); c.strokeStyle = '#16121e'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(x, F[i + 1] + 2); c.lineTo(x, y + r * 0.8); c.stroke(); c.restore(); }
    E(c, x, y, r * 0.82, r, '#ffffff',  2);
    E(c, x + r * 0.22, y + r * 0.08 + (kinn > 0.4 ? r * 0.18 : 0), r * 0.36, r * 0.42, '#16121e', 0);   // bei Staunen schauen die Pupillen aufs gefallene Kinn
    E(c, x + r * 0.05, y - r * 0.38, r * 0.2, r * 0.16, 'rgba(255,255,255,0.95)', 0);
  }
}
// Kinnlade: aufgerissener Mund beim Staunen (Anker F[6]/F[7] aus figuren3d.js)
function mimikMund(c, a, kinn, pop) {
  const F = a._fig;
  if (!F || F.length < 8 || kinn <= 0.05) return;
  const x = F[6], y = F[7] + 2 + kinn * 5, rx = 4.5 + kinn * 3.5, ry = 3 + kinn * 8;
  E(c, x, y, rx, ry, '#7a2222', 1.8);
  E(c, x, y + ry * 0.35, rx * 0.62, ry * 0.38, '#d05a6a', 0);
  if (pop > 0.3) E(c, x - rx * 0.5, y - ry * 0.55, 1.4, 1.6, 'rgba(255,255,255,0.85)', 0);   // Zahn blinkt
}
function stern(c, x, y, r, col) { P(c, [x, y - r, x + r * 0.28, y - r * 0.28, x + r, y, x + r * 0.28, y + r * 0.28, x, y + r, x - r * 0.28, y + r * 0.28, x - r, y, x - r * 0.28, y - r * 0.28], col, 1.5); }
function herz(c, x, y, s, col) {
  E(c, x - s * 0.42, y - s * 0.28, s * 0.5, s * 0.44, col, 1.2); E(c, x + s * 0.42, y - s * 0.28, s * 0.5, s * 0.44, col, 1.2);
  P(c, [x - s * 0.86, y - s * 0.14, x, y + s * 0.85, x + s * 0.86, y - s * 0.14], col, 1.2);
}
// Zeichen über dem Kopf: Ausrufezeichen, Speed-Linien, Dampf, Glut, Zornesader, Herzen, Funkeln, Schwitzfontäne (nicht gespiegelt, damit Schrift lesbar bleibt)
function mimikDeko(c, a, t, f) {
  const m = f.m;
  if (!m) return;
  const F = a._fig, top = F ? F[5] : -(a.h || 180) * 0.95, hx = F ? F[8] : 10, k = f.k, kopf = top + 30;
  c.save(); c.translate(0, -f.lift); if (a.dir < 0) c.scale(-1, 1);
  const sx = a.dir < 0 ? -hx : hx;
  if (m.kind === 'schreck') {
    const s = Math.min(1, k / 0.09) * (1 + Math.sin(Math.min(1, k / 0.16) * Math.PI) * 0.4);
    c.save(); c.translate(sx * 0.4, top - 30); c.rotate(Math.sin(k * 20) * 0.06 * (1 - k)); c.scale(s, s);
    for (let i = 0; i < 6; i++) { const w = i * Math.PI / 3 + 0.3; L(c, [Math.cos(w) * 22, Math.sin(w) * 22 + 12, Math.cos(w) * 30, Math.sin(w) * 30 + 12], 2.5, '#ffe066'); }   // Strahlenkranz
    txt(c, '!', 0, 14, '400 40px "Titan One", sans-serif', '#ffe066', 'center', 6, '#1b1020'); c.restore();
    if (k > 0.07 && k < 0.42) {   // Speed-Linien beim Hochschießen
      c.save(); c.globalAlpha = Math.sin((k - 0.07) / 0.35 * Math.PI) * 0.8;
      for (const dx of [-26, 30]) for (let i = 0; i < 3; i++) L(c, [dx + i * 3 - 3, top + 24 + i * 16, dx + i * 3 - 3, top - 8 + i * 16], 2, 'rgba(255,255,255,0.75)');
      c.restore();
    }
    if (k >= 0.42 && k < 0.62) {   // Aufprall: kleiner Sternenring am Boden
      const q = (k - 0.42) / 0.2;
      c.save(); c.globalAlpha = 1 - q;
      for (let i = 0; i < 5; i++) { const w = i / 5 * Math.PI - Math.PI; stern(c, Math.cos(w) * (14 + q * 26), -4 + Math.sin(w) * 6, 4 + q * 2, i % 2 ? '#ffe066' : '#ffffff'); }
      c.restore();
    }
    for (let i = 0; i < 3; i++) {   // Schweißtropfen fliegen weg
      const q = Math.min(1, k * 2.2), ang = -0.9 + i * 0.9, d = 16 + q * 30;
      c.save(); c.globalAlpha = 1 - q; c.translate(Math.sin(ang) * d, top + 20 - Math.cos(ang) * d * 0.8); c.rotate(ang);
      P(c, [0, -7, 4, 1, 0, 5, -4, 1], '#8fd8ff', 1.2); c.restore();
    }
  } else if (m.kind === 'wut') {
    c.save(); c.globalAlpha = 0.3 + Math.sin(t * 0.02) * 0.06;   // glühender roter Kopf
    const gl = c.createRadialGradient(sx * 0.3, kopf, 6, sx * 0.3, kopf, 54);
    gl.addColorStop(0, '#ff5a3a'); gl.addColorStop(1, 'rgba(255,90,58,0)');
    c.fillStyle = gl; c.fillRect(sx * 0.3 - 56, kopf - 56, 112, 112); c.restore();
    for (let i = 0; i < 5; i++) {   // weiße Dampfpuffs schießen im Takt aus dem Kopf
      const q = ((t * 0.0024) + i / 5) % 1;
      c.save(); c.globalAlpha = (1 - q) * 0.95; E(c, (i - 2) * 11 + Math.sin(q * 7 + i) * 4, top - 2 - q * 38, 7.5 + q * 11, 5.5 + q * 8, '#ffffff', 1.5); c.restore();
    }
    c.save(); c.translate(sx + 12, top + 12); const s = 1.45 + Math.sin(t * 0.035) * 0.22; c.scale(s, s);   // Zornesader pocht groß
    for (const [rx, ry] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S(c, null, 2.8, () => { c.moveTo(rx * 2, ry * 7); c.quadraticCurveTo(rx * 2, ry * 2, rx * 7, ry * 2); }, '#e8303a');
    c.restore();
    c.save(); c.globalAlpha = 0.75;   // Bebung-Linien am Kopf
    for (const dx of [-22, 24]) L(c, [dx + Math.sin(t * 0.024 + dx) * 3, top + 36, dx + Math.sin(t * 0.024 + dx) * 3, top + 14], 2, 'rgba(255,255,255,0.85)');
    c.restore();
  } else if (m.kind === 'freude') {
    for (let i = 0; i < 3; i++) {   // drei Herzen steigen auf
      const q = ((k * 1.5) + i / 3) % 1;
      c.save(); c.globalAlpha = Math.sin(q * Math.PI) * 0.95; c.translate(sx * 0.4 - 16 + i * 16, top + 6 - q * 36); c.rotate(Math.sin(q * 6 + i * 2) * 0.25);
      herz(c, 0, 0, 7 + q * 3.5, i % 2 ? '#ff7ab8' : '#ff9ecb'); c.restore();
    }
    for (let i = 0; i < 4; i++) {
      const q = ((k * 1.6) + i * 0.25) % 1, ang = i * 1.57 + k * 2;
      c.save(); c.globalAlpha = Math.sin(q * Math.PI); stern(c, Math.cos(ang) * 30, top + 10 + Math.sin(ang) * 18 - q * 10, 4 + q * 4, i % 2 ? '#ffe066' : '#ffffff'); c.restore();
    }
  } else if (m.kind === 'staunen') {
    if (k < 0.85) {   // „?!“ pulsiert und wächst, kräftig konturiert
      const q = Math.min(1, k / 0.15), pu = 1 + Math.sin(k * 9) * 0.08;
      c.save(); c.globalAlpha = 1 - k / 0.85; c.translate(sx * 0.35 + 13, top - 16); c.scale(q * pu, q * pu);
      txt(c, '?!', 0, 11, '400 31px "Titan One", sans-serif', '#ffe066', 'center', 7, '#1b1020'); c.restore();
    }
    c.save(); c.globalAlpha = 0.5 + Math.sin(t * 0.025) * 0.2;   // Kreise um den Kopf
    for (let i = 0; i < 3; i++) E(c, sx * 0.3 + Math.sin(t * 0.006 + i * 2) * 4, kopf + 6, 30 - i * 6, 9 - i * 2, null, 1.4, 0, 'rgba(255,255,255,0.55)');
    c.restore();
  } else if (m.kind === 'ekel') {
    c.save(); c.globalAlpha = 0.85;   // grüne Stinkwellen wedeln hoch
    for (let i = 0; i < 3; i++) {
      const q = ((k * 1.8) + i / 3) % 1, yy = top - 4 - q * 26, xx = sx * 0.25 + Math.sin(q * 5 + i * 2.1) * 7;
      S(c, null, 2.2, () => { c.moveTo(xx - 7, yy); c.quadraticCurveTo(xx, yy - 7, xx + 7, yy); c.quadraticCurveTo(xx + 14, yy + 7, xx + 21, yy); }, 'rgba(150,220,110,0.9)');
    }
    c.restore();
    c.save(); c.translate(sx * 0.65 + 5, top + 32); c.rotate(-0.25 + Math.sin(t * 0.03) * 0.3);   // wedelnde Hand direkt vor der Nase
    E(c, 0, 0, 7.5, 5.5, '#f2c8a0', 1.6); for (let i = 0; i < 4; i++) L(c, [i * 3.6 - 5.4, -3, i * 3.6 - 5.4 + Math.sin(t * 0.05 + i) * 2, -10], 2.4, '#f2c8a0');
    c.restore();
  } else if (m.kind === 'peinlich') {   // sechs Schweißtropfen als Fontäne, Wangen glühen blau
    for (let i = 0; i < 6; i++) {
      const q = (k * 1.6 + i / 6) % 1, ang = -1.25 + i * 0.28, d = 12 + Math.sin(q * Math.PI) * 30;
      c.save(); c.globalAlpha = (1 - q) * 0.95; c.translate(Math.sin(ang) * d, kopf - Math.cos(ang) * d * 0.7); c.rotate(ang);
      P(c, [0, -6.5, 4, 1, 0, 4.5, -4, 1], '#8fd8ff', 1.3); c.restore();
    }
    for (const dx of [-16, 16]) { c.save(); c.globalAlpha = 0.5; E(c, sx * 0.3 + dx, kopf + 13, 8, 5, '#7aa8ff', 0); c.restore(); }
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
    try { drawn(c, a, t); mimikAugen(c, a, f.pop, f.kinn); mimikMund(c, a, f.kinn, f.pop); } finally { c.restore(); }
    mimikDeko(c, a, t, f);
  };
}
