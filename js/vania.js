'use strict';
// ============================================================
//  Tentakelvania – der Spielautomat im Konferenzsaal (Scherzartikel-Messe 1987).
//  Ein 8-Bit-Jump'n'Run im Stil der alten Vampirjäger-Spiele: Hoagie mit Poolnudel statt Peitsche, die Villa Edison
//  statt des Schlosses, lila Tentakel statt Fledermäusen und Skeletten. Eigene Bildfläche mit 256 × 224 Bildpunkten
//  (wie die alte Konsole), pixelgenau hochskaliert im Automatengehäuse. Tastatur, Gamepad und Touch.
// ============================================================
const VA = {
  w: 256, h: 224, cv: null, g: null, phase: 'titel', acc: 0, f: 0, kam: 0, sektion: 0,
  p: null, gegner: [], schuesse: [], dinge: [], fx: [], kerzen: [], spawn: [], boss: null,
  punkte: 0, rekord: 0, leben: 3, herzen: 5, tasten: {}, pad: {}, touch: {}, bossKampf: false, ende: 0,
};
const VA_KEY = 'tt_vania_rekord';
const T16 = 16, VA_BREITE = 168;   // Level in Kacheln

// ---------- Pixelbilder ----------
const VA_PAL = {
  C: '#3a6ee0', c: '#1e3c9a', H: '#3a2216', S: '#f2b486', K: '#140c18', R: '#a02838', T: '#24202c', Y: '#f4d23c',
  J: '#3c5cb8', j: '#26387a', W: '#ececec', P: '#9a34c8', p: '#5e1c86', L: '#e88aea', E: '#ffffff', N: '#ff7ab8', n: '#ffd34a',
};
function vaBild(zeilen, pal = VA_PAL) {
  const c = document.createElement('canvas'); c.width = zeilen[0].length; c.height = zeilen.length;
  const g = c.getContext('2d');
  zeilen.forEach((z, y) => { for (let x = 0; x < z.length; x++) { const f = pal[z[x]]; if (f) { g.fillStyle = f; g.fillRect(x, y, 1, 1); } } });
  return c;
}
const VA_OBEN = [
  '......CCCC......', '.....CCCCCC.....', '....CCCCCCCCcc..', '....HSSSSSSH....', '...HHSSKSSKS....', '...HHSSSSSSSS...',
  '...HHSSSSRSS....', '...HHHSSSSS.....', '...HHTTTTTTT....'];
const VA_RUMPF = ['..TTTTTYYTTTT...', '..TTTTTYYTTTT...', '..STTTTTTTTTS...', '..SSTTTTTTTSS...', '...TTTTTTTTT....', '...TTTTTTTTT....'];
const VA_HIEB = ['..TTTTTYYTTTSSS.', '..TTTTTYYTTTSSS.', '..TTTTTTTTTTT...', '...TTTTTTTTTT...', '...TTTTTTTTT....', '...TTTTTTTTT....'];
const VA_AUSHOL = ['SSTTTTTYYTTTT...', 'SSTTTTTYYTTTT...', '..TTTTTTTTTTT...', '...TTTTTTTTTT...', '...TTTTTTTTT....', '...TTTTTTTTT....'];
const VA_BEINE = {
  steh: ['...JJJJJJJJJ....', '...JJJJJJJJJ....', '...JJJJ.JJJJ....', '...JJJ...JJJ....', '...JJJ...JJJ....', '...jjj...jjj....', '...jjj...jjj....', '..WWWW..WWWW....', '..WWWW..WWWW....'],
  lauf1: ['...JJJJJJJJJ....', '...JJJJJJJJJ....', '..JJJJ...JJJJ...', '..JJJ.....JJJ...', '.JJJ.......JJJ..', '.jjj.......jjj..', 'jjj.........jjj.', 'WWWW.......WWWW.', 'WWW.........WWW.'],
  lauf2: ['...JJJJJJJJJ....', '...JJJJJJJJJ....', '....JJJJJJJ.....', '....JJJ.JJJ.....', '....JJJ.JJJ.....', '....jjj.jjj.....', '....jjj.jjj.....', '...WWWWWWWW.....', '...WWWWWWWW.....'],
  sprung: ['...JJJJJJJJJ....', '..JJJJJJJJJJJ...', '..JJJJ...JJJJ...', '..jjj.....jjj...', '..WWW.....WWW...', '................', '................', '................', '................'],
};
const VA_TENTAKEL = [
  '....PPPP....', '...PPPPPP...', '..PPPPPPPP..', '..PEEPPEEP..', '..PEKPPEKP..', '..PPPPPPPP..', '..PRRRRRRP..', '..PPPPPPPP..',
  '..LPPPPPPPp.', '..PPPPPPPpp.', '..LPPPPPPPp.', '..PPPPPPPPp.', '.LPPPPPPPPpp', '.PPPPPPPPPp.', '.LPPPPPPPPpp', '.PPPPPPPPPPp',
  'LPPPPPPPPPPp', 'PPPPPPPPPPPP', 'PPPPPPPPPPPP', '.pppppppppp.'];
const VA_KOPF = ['..PPPPPP..', '.PPPPPPPP.', 'PPEEPPEEPP', 'PPEKPPEKPP', 'PPPPPPPPPP', 'PPRRRRRRPP', '.PPPPPPPP.', '..pPPPPp..', '...p..p...', '..p....p..'];
const VA_SPR = {};
function vaSprites() {
  if (VA_SPR.ok) return;
  const held = (oben, rumpf, beine) => vaBild([...oben, ...rumpf, ...beine]);
  VA_SPR.steh = held(VA_OBEN, VA_RUMPF, VA_BEINE.steh);
  VA_SPR.lauf1 = held(VA_OBEN, VA_RUMPF, VA_BEINE.lauf1);
  VA_SPR.lauf2 = held(VA_OBEN, VA_RUMPF, VA_BEINE.lauf2);
  VA_SPR.sprung = held(VA_OBEN, VA_RUMPF, VA_BEINE.sprung);
  VA_SPR.hieb = held(VA_OBEN, VA_HIEB, VA_BEINE.steh);
  VA_SPR.aushol = held(VA_OBEN, VA_AUSHOL, VA_BEINE.steh);
  VA_SPR.hiebLuft = held(VA_OBEN, VA_HIEB, VA_BEINE.sprung);
  VA_SPR.tent1 = vaBild(VA_TENTAKEL);
  VA_SPR.tent2 = vaBild(['............', ...VA_TENTAKEL.slice(0, 16), 'LPPPPPPPPPPPp'.slice(0, 12), 'PPPPPPPPPPPP', '.pppppppppp.']);
  VA_SPR.kopf = vaBild(VA_KOPF);
  VA_SPR.ok = true;
}

// ---------- Level: Boden je Spalte (Kachelzeile der Oberkante, 99 = Loch), Blöcke, Kerzen, Gegner ----------
const VA_LEVEL = (() => {
  const boden = new Array(VA_BREITE).fill(12), bloecke = [], kerzen = [], gegner = [];
  const loch = (a, b) => { for (let x = a; x <= b; x++) boden[x] = 99; };
  const block = (x0, x1, y) => bloecke.push([x0, x1, y]);
  // 1) Garten vor der Villa (0–43)
  loch(22, 23); block(21, 24, 9); loch(34, 35);
  for (const x of [6, 12, 18, 28, 38]) kerzen.push([x, 9]);
  for (const x of [15, 26, 31, 40]) gegner.push([x, 'tentakel']);
  // 2) Halle (44–111): Treppenblöcke, Löcher mit Brücken, Wandtoast in einer Mauer
  for (let i = 0; i < 4; i++) block(52 + i, 52 + i, 11 - i);
  block(56, 60, 8); loch(61, 63); block(61, 63, 10); block(64, 66, 8);
  loch(78, 81); block(77, 78, 9); block(81, 82, 9); block(73, 75, 6);
  for (let i = 0; i < 3; i++) block(92 + i * 2, 93 + i * 2, 10 - i);
  loch(100, 102); block(99, 103, 7);
  for (const x of [48, 54, 59, 66, 71, 76, 84, 89, 96, 104, 109]) kerzen.push([x, x % 2 ? 7 : 8]);
  for (const x of [50, 58, 68, 74, 86, 90, 98, 106]) gegner.push([x, 'tentakel']);
  gegner.push([70, 'koepfe'], [94, 'koepfe']);
  // 3) Laborgang (112–149)
  block(118, 121, 9); loch(124, 127); block(123, 128, 6); block(132, 135, 9); loch(138, 139);
  for (const x of [114, 120, 126, 131, 136, 142, 147]) kerzen.push([x, 8]);
  for (const x of [116, 122, 130, 134, 141, 145]) gegner.push([x, 'tentakel']);
  gegner.push([128, 'koepfe']);
  // 4) Bosszimmer (152–167)
  return { boden, bloecke, kerzen, gegner, bossX: 152 };
})();
function vaFest(tx, ty) {
  if (tx < 0 || tx >= VA_BREITE) return true;   // Ränder
  if (ty >= VA_LEVEL.boden[tx] && VA_LEVEL.boden[tx] !== 99) return true;
  for (const [x0, x1, y] of VA_LEVEL.bloecke) if (tx >= x0 && tx <= x1 && ty === y) return true;
  return false;
}
const vaSektion = x => x < 44 * T16 ? 0 : x < 112 * T16 ? 1 : x < 152 * T16 ? 2 : 3;

// ---------- Start, Ende ----------
function startVania() {
  vaSprites();
  if (!VA.cv) { VA.cv = document.createElement('canvas'); VA.cv.width = VA.w; VA.cv.height = VA.h; VA.g = VA.cv.getContext('2d'); }
  try { VA.rekord = +localStorage.getItem(VA_KEY) || 0; } catch (e) { VA.rekord = 0; }
  G.menu = null; G.screen = 'vania'; VA.phase = 'titel'; VA.f = 0; VA.tasten = {}; VA.touch = {};
  Sound.ambience([]); Sound.setReverb(0.6, 0.08); Sound.play('vania');
}
function vaNeu() {
  Object.assign(VA, { punkte: 0, leben: 3, herzen: 5, checkpunkt: 2 * T16 });
  vaLevelStart();
}
function vaLevelStart() {
  Object.assign(VA, { phase: 'spiel', gegner: [], schuesse: [], dinge: [], fx: [], boss: null, bossKampf: false, ende: 0 });
  VA.kerzen = VA_LEVEL.kerzen.map(([x, y]) => ({ x: x * T16 + 8, y: y * T16 + 8, an: true }));
  VA.spawn = VA_LEVEL.gegner.map(([x, art]) => ({ x: x * T16, art, da: false }));
  VA.p = { x: VA.checkpunkt, y: 12 * T16, vx: 0, vy: 0, blick: 1, boden: true, hieb: 0, unverwundbar: 60, hp: 16, tot: 0, lauf: 0 };
  VA.kam = Math.max(0, VA.p.x - 100);
  Sound.play(null); Sound.play('vania');
}
function endVania() {
  if (VA.punkte > VA.rekord) { VA.rekord = VA.punkte; try { localStorage.setItem(VA_KEY, String(VA.punkte)); } catch (e) { /* ok */ } }
  G.screen = G.state ? 'game' : 'title'; music();
}

// ---------- Eingabe ----------
const vaTaste = k => !!VA.tasten[k];
const vaLinks = () => vaTaste('arrowleft') || vaTaste('a') || VA.pad.links || VA.touch.links;
const vaRechts = () => vaTaste('arrowright') || vaTaste('d') || VA.pad.rechts || VA.touch.rechts;
const vaOben = () => vaTaste('arrowup') || vaTaste('w') || VA.pad.oben;
window.addEventListener('keydown', e => {
  if (G.screen !== 'vania') return;
  e.preventDefault(); e.stopImmediatePropagation();
  const k = e.key.toLowerCase();
  if (k === 'escape') { endVania(); return; }
  if (e.repeat) return;
  VA.tasten[k] = true;
  if (VA.phase !== 'spiel') { if (k === 'enter' || k === ' ' || k === 'j' || k === 'z') vaStartKnopf(); return; }
  if (k === ' ' || k === 'k' || k === 'x') vaSpringen();
  if (k === 'j' || k === 'z' || k === 'enter') vaHauen();
  if (k === 'l' || k === 'c') vaWerfen();
}, true);
window.addEventListener('keyup', e => { if (G.screen === 'vania') { VA.tasten[e.key.toLowerCase()] = false; e.stopImmediatePropagation(); } }, true);
function vaStartKnopf() {
  if (VA.phase === 'titel') vaNeu();
  else if (VA.phase === 'aus') { VA.phase = 'titel'; VA.f = 0; }
  else if (VA.phase === 'sieg' && VA.f > 90) { VA.phase = 'titel'; VA.f = 0; }
}
function vaPadLesen() {
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  if (!gp) { VA.pad = {}; return; }
  const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed), ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, alt = VA.padAlt || {};
  const neu = { links: b(14) || ax < -0.4, rechts: b(15) || ax > 0.4, oben: b(12) || ay < -0.5, a: b(0), x: b(2) || b(1), y: b(3), start: b(9), zurueck: b(8) };
  if (neu.zurueck && !alt.zurueck) endVania();
  if (VA.phase !== 'spiel') { if ((neu.start && !alt.start) || (neu.a && !alt.a)) vaStartKnopf(); }
  else {
    if (neu.a && !alt.a) vaSpringen();
    if (neu.x && !alt.x) vaHauen();
    if (neu.y && !alt.y) vaWerfen();
  }
  VA.pad = neu; VA.padAlt = neu;
}
// Touch: Knöpfe unten im Automatengehäuse
function vaKnoepfe() {
  return { links: { x: 30, y: H - 120, w: 90, h: 90 }, rechts: { x: 130, y: H - 120, w: 90, h: 90 }, sprung: { x: W - 120, y: H - 120, w: 90, h: 90 },
    nudel: { x: W - 220, y: H - 120, w: 90, h: 90 }, raus: { x: W - 70, y: 14, w: 52, h: 40 } };
}
{
  const finger = new Map();
  const knopfBei = (x, y) => { const K = vaKnoepfe(); for (const [n, r] of Object.entries(K)) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return n; return null; };
  const neuBerechnen = () => { VA.touch = {}; for (const n of finger.values()) if (n) VA.touch[n] = true; };
  window.addEventListener('pointerdown', e => {
    if (G.screen !== 'vania') return;
    const p = typeof toLogical === 'function' ? toLogical(e) : { x: e.clientX, y: e.clientY }, n = knopfBei(p.x, p.y);
    e.preventDefault(); e.stopImmediatePropagation();
    if (n === 'raus') { endVania(); return; }
    if (VA.phase !== 'spiel') { vaStartKnopf(); return; }
    finger.set(e.pointerId, n);
    if (n === 'sprung') vaSpringen(); else if (n === 'nudel') vaHauen();
    neuBerechnen();
  }, true);
  const los = e => { if (G.screen !== 'vania' || !finger.has(e.pointerId)) return; finger.delete(e.pointerId); neuBerechnen(); e.stopImmediatePropagation(); };
  window.addEventListener('pointerup', los, true); window.addEventListener('pointercancel', los, true);
}

// ---------- Aktionen ----------
function vaSpringen() { const p = VA.p; if (p && p.boden && !p.hieb && !p.tot) { p.vy = -3.75; p.boden = false; Sound.sfx('vsprung'); } }
function vaHauen() { const p = VA.p; if (p && !p.hieb && !p.tot) { p.hieb = 1; Sound.sfx('vnudel'); if (vaOben()) vaWerfen(); } }
function vaWerfen() {   // Wurf-Toast (kostet ein Herz): fliegt im Bogen wie die Axt
  const p = VA.p; if (!p || p.tot || VA.herzen <= 0 || VA.schuesse.some(s => s.toast)) return;
  VA.herzen--; VA.schuesse.push({ toast: true, x: p.x + p.blick * 6, y: p.y - 20, vx: 1.9 * p.blick, vy: -3.6, w: 10, h: 10 }); Sound.sfx('vwurf');
}

// ---------- Ein Schritt (60 Hz) ----------
function vaKollision(o, w, h) {   // o.x = Mitte, o.y = Füße; schiebt aus festen Kacheln heraus
  o.x += o.vx;
  const links = o.x - w / 2, rechts = o.x + w / 2;
  for (let ty = Math.floor((o.y - h + 2) / T16); ty <= Math.floor((o.y - 2) / T16); ty++) {
    if (o.vx > 0 && vaFest(Math.floor(rechts / T16), ty)) o.x = Math.floor(rechts / T16) * T16 - w / 2 - 0.01;
    if (o.vx < 0 && vaFest(Math.floor(links / T16), ty)) o.x = (Math.floor(links / T16) + 1) * T16 + w / 2 + 0.01;
  }
  o.vy = Math.min(4.5, o.vy + 0.19); o.y += o.vy; o.boden = false;
  const tx0 = Math.floor((o.x - w / 2 + 1) / T16), tx1 = Math.floor((o.x + w / 2 - 1) / T16);
  if (o.vy >= 0) { for (let tx = tx0; tx <= tx1; tx++) if (vaFest(tx, Math.floor(o.y / T16)) && o.y - o.vy <= Math.floor(o.y / T16) * T16 + 0.5) { o.y = Math.floor(o.y / T16) * T16; o.vy = 0; o.boden = true; break; } }
  else for (let tx = tx0; tx <= tx1; tx++) if (vaFest(tx, Math.floor((o.y - h) / T16))) { o.y = (Math.floor((o.y - h) / T16) + 1) * T16 + h; o.vy = 0.2; break; }
}
const vaUeber = (a, b) => Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
function vaSchaden(n, von) {
  const p = VA.p; if (p.unverwundbar || p.tot) return;
  p.hp -= n; p.unverwundbar = 70; p.vy = -2.4; p.vx = (von < p.x ? 1 : -1) * 1.4; p.hieb = 0; p.getroffen = 22; Sound.sfx('vschaden');
  if (p.hp <= 0) vaTot();
}
function vaTot() {
  const p = VA.p; if (p.tot) return;
  p.tot = 1; p.hp = 0; Sound.play(null); Sound.sfx('vtot');
}
function vaPuff(x, y, farbe, n = 6) { for (let i = 0; i < n; i++) { const w = Math.random() * Math.PI * 2, v = 0.6 + Math.random() * 1.6; VA.fx.push({ x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v - 0.6, t: 0, farbe }); } }
function vaSchritt() {
  VA.f++;
  vaPadLesen();
  if (VA.phase !== 'spiel') return;
  const p = VA.p, L = VA_LEVEL;
  // Tod und Neustart
  if (p.tot) {
    p.tot++; if (p.tot < 60) { p.vy += 0.1; p.y += p.vy * 0.3; }
    if (p.tot > 130) { VA.leben--; if (VA.leben < 0) { VA.phase = 'aus'; VA.f = 0; Sound.play(null); } else vaLevelStart(); }
    return;
  }
  // Steuerung: auf dem Boden steuern; in der Luft etwas nachsteuern (gnädiger als das Original)
  const will = (vaRechts() ? 1 : 0) - (vaLinks() ? 1 : 0);
  if (p.getroffen) { p.getroffen--; }
  else if (p.hieb && p.boden) p.vx = 0;
  else if (p.boden) { p.vx = will * 1.15; if (will) p.blick = will; }
  else p.vx += (will * 1.15 - p.vx) * 0.08;
  if (p.boden && will) p.lauf++;
  vaKollision(p, 12, 28);
  if (p.unverwundbar) p.unverwundbar--;
  if (p.y > VA.h + 40) { vaTot(); p.tot = 50; }
  // Poolnudel: ausholen (1–7), zuschlagen (8–15), zurück (16–19)
  if (p.hieb) {
    p.hieb++;
    if (p.hieb >= 8 && p.hieb <= 15) {
      const r = { x: p.x + p.blick * 30, y: p.y - 21, w: 44, h: 10 };
      for (const k of VA.kerzen) if (k.an && vaUeber(r, { x: k.x, y: k.y, w: 8, h: 16 })) {
        k.an = false; vaPuff(k.x, k.y, '#ffd34a', 5); Sound.sfx('vkerze'); VA.punkte += 50;
        const art = Math.random() < 0.18 ? 'toast' : Math.random() < 0.6 ? 'herz' : 'herzGross';
        VA.dinge.push({ art, x: k.x, y: k.y, vy: -1.5, w: 8, h: 8, zeit: 600 });
      }
      for (const e of VA.gegner) if (e.hp > 0 && !e.treffer && vaUeber(r, e)) vaTreffer(e);
      if (VA.boss && VA.boss.hp > 0 && !VA.boss.treffer && vaUeber(r, VA.boss)) vaTreffer(VA.boss);
    }
    if (p.hieb > 19) p.hieb = 0;
  }
  for (const e of VA.gegner) if (e.treffer) e.treffer--;
  if (VA.boss && VA.boss.treffer) VA.boss.treffer--;
  // Kamera, Kontrollpunkte, Bosszimmer
  const sek = vaSektion(p.x);
  if (sek !== VA.sektion) { VA.sektion = sek; if (sek < 3) VA.checkpunkt = [2, 45, 113][sek] * T16; }
  const kamMax = VA_BREITE * T16 - VA.w;
  if (!VA.bossKampf && p.x > L.bossX * T16 + 40) { VA.bossKampf = true; VA.boss = { x: (L.bossX + 12) * T16, y: 12 * T16, w: 22, h: 40, vx: 0, vy: 0, hp: 14, treffer: 0, t: 0, boden: true, blick: -1 }; Sound.play(null); Sound.play('vaniaBoss'); }
  VA.kam = VA.bossKampf ? kamMax : Math.max(0, Math.min(kamMax, VA.kam + ((p.x - 112) - VA.kam) * 0.2));
  if (VA.bossKampf && p.x < L.bossX * T16 + 8) { p.x = L.bossX * T16 + 8; }
  // Gegner auftauchen lassen
  for (const s of VA.spawn) {
    if (s.da || s.x > VA.kam + VA.w + 24 || s.x < VA.kam - 40) continue;
    s.da = true;
    if (s.art === 'tentakel') VA.gegner.push({ art: 'tentakel', x: s.x, y: 12 * T16 - 16, vx: 0, vy: 0, w: 12, h: 20, hp: 1, t: Math.random() * 60, boden: false });
    else s.koepfe = 5;
  }
  for (const s of VA.spawn) if (s.koepfe > 0 && VA.f % 70 === 0 && s.x < VA.kam + VA.w + 200) { s.koepfe--; VA.gegner.push({ art: 'kopf', x: VA.kam + VA.w + 8, y0: p.y - 40 + Math.random() * 30, y: 0, vx: -1.0, w: 10, h: 10, hp: 1, t: 0 }); }
  // Gegner bewegen
  for (const e of VA.gegner) {
    if (e.hp <= 0) continue;
    e.t++;
    if (e.art === 'tentakel') {
      if (Math.abs(e.x - p.x) < 180) e.vx = (p.x < e.x ? -1 : 1) * 0.55;
      if (e.boden && e.t % 90 === 0) e.vy = -2.2;   // hüpft ab und zu
      vaKollision(e, 12, 20);
      if (e.y > VA.h + 40) e.hp = 0;
    } else { e.x += e.vx; e.y = e.y0 + Math.sin(e.t * 0.08) * 22; if (e.x < VA.kam - 30) e.hp = 0; }
    if (vaUeber({ x: p.x, y: p.y - 14, w: 10, h: 26 }, { x: e.x, y: e.y - e.h / 2, w: e.w, h: e.h })) vaSchaden(2, e.x);
  }
  VA.gegner = VA.gegner.filter(e => e.hp > 0 || e.weg);
  // Boss: der Lila Tentakel mit Armen – hüpft heran, spuckt Glibber
  const B = VA.boss;
  if (B && B.hp > 0) {
    B.t++; B.blick = p.x < B.x ? -1 : 1;
    if (B.boden && B.t % 120 === 40) { B.vy = -4.2; B.vx = B.blick * 1.3; Sound.sfx('vsprung'); }
    if (B.boden) B.vx *= 0.8;
    if (B.t % 150 === 100) for (let i = 0; i < 3; i++) VA.schuesse.push({ glibber: true, x: B.x + B.blick * 10, y: B.y - 34, vx: B.blick * (1.0 + i * 0.6), vy: -2.6 + i * 0.5, w: 8, h: 8 });
    vaKollision(B, 22, 40);
    B.x = Math.max(L.bossX * T16 + 20, Math.min(VA_BREITE * T16 - 20, B.x));
    if (vaUeber({ x: p.x, y: p.y - 14, w: 10, h: 26 }, { x: B.x, y: B.y - 20, w: 22, h: 40 })) vaSchaden(3, B.x);
  } else if (B && B.hp <= 0 && !VA.ende) { VA.ende = 1; Sound.play(null); Sound.sfx('vsieg'); VA.punkte += 5000 + p.hp * 100; if (typeof unlock === 'function') unlock('tentakelvania'); }
  if (VA.ende) { VA.ende++; if (VA.ende % 8 === 0 && VA.ende < 120) vaPuff(B.x + (Math.random() - 0.5) * 30, B.y - Math.random() * 40, '#e88aea', 6); if (VA.ende > 200) { VA.phase = 'sieg'; VA.f = 0; } }
  // Würfe und Glibber
  for (const s of VA.schuesse) {
    s.vy += s.toast ? 0.16 : 0.12; s.x += s.vx; s.y += s.vy;
    if (s.toast) {
      for (const e of VA.gegner) if (e.hp > 0 && vaUeber(s, { x: e.x, y: e.y - e.h / 2, w: e.w, h: e.h })) vaTreffer(e);
      if (B && B.hp > 0 && !B.treffer && vaUeber(s, { x: B.x, y: B.y - 20, w: 22, h: 40 })) vaTreffer(B);
    } else if (vaUeber(s, { x: p.x, y: p.y - 14, w: 10, h: 26 })) { vaSchaden(2, s.x); s.weg = true; }
    if (s.y > VA.h + 20) s.weg = true;
  }
  VA.schuesse = VA.schuesse.filter(s => !s.weg);
  // Dinge: Herzen, Wandtoast
  for (const d of VA.dinge) {
    d.vy = Math.min(2, d.vy + 0.12); d.y += d.vy;
    if (vaFest(Math.floor(d.x / T16), Math.floor((d.y + 4) / T16))) { d.y = Math.floor((d.y + 4) / T16) * T16 - 4; d.vy = 0; }
    d.zeit--;
    if (vaUeber({ x: p.x, y: p.y - 14, w: 12, h: 28 }, d)) {
      d.weg = true; Sound.sfx('vauf');
      if (d.art === 'herz') VA.herzen += 1; else if (d.art === 'herzGross') VA.herzen += 5; else { p.hp = Math.min(16, p.hp + 8); VA.punkte += 100; }
    }
  }
  VA.dinge = VA.dinge.filter(d => !d.weg && d.zeit > 0 && d.y < VA.h + 20);
  for (const f of VA.fx) { f.t++; f.x += f.vx; f.y += f.vy; f.vy += 0.06; }
  VA.fx = VA.fx.filter(f => f.t < 30);
}
function vaTreffer(e) {
  e.hp--; e.treffer = 18; Sound.sfx('vtreffer');
  if (e.hp <= 0) { vaPuff(e.x, e.y - (e.h || 10) / 2, '#9a34c8', 8); Sound.sfx('vweg'); VA.punkte += e.art === 'kopf' ? 200 : e === VA.boss ? 0 : 100; if (e !== VA.boss && Math.random() < 0.25) VA.dinge.push({ art: 'herz', x: e.x, y: e.y - 8, vy: -1.2, w: 8, h: 8, zeit: 400 }); }
}

// ---------- Zeichnen (auf der kleinen Bildfläche) ----------
function vaHintergrund(g) {
  const kam = VA.kam, sek = vaSektion(kam + 128);
  if (sek === 0) {   // Nacht im Garten, die Villa am Horizont (Parallaxe)
    const lg = g.createLinearGradient(0, 32, 0, 192); lg.addColorStop(0, '#120a2e'); lg.addColorStop(1, '#4a2a6a'); g.fillStyle = lg; g.fillRect(0, 32, VA.w, 160);
    g.fillStyle = '#f4f0d8'; g.beginPath(); g.arc(200 - kam * 0.05, 64, 14, 0, 7); g.fill();
    for (let i = 0; i < 30; i++) { g.fillStyle = i % 3 ? '#8a7ab0' : '#ffffff'; g.fillRect((i * 53 - kam * 0.05) % 256, 36 + (i * 37) % 60, 1, 1); }
    const vx = 330 - kam * 0.3;   // die Villa: Säulen, Kuppel, gelbe Fenster
    g.fillStyle = '#2a1a3e'; g.fillRect(vx, 96, 150, 96); g.fillRect(vx + 55, 70, 40, 26); g.beginPath(); g.moveTo(vx - 10, 98); g.lineTo(vx + 75, 74); g.lineTo(vx + 160, 98); g.fill();
    g.fillStyle = '#f2c24a'; for (let i = 0; i < 6; i++) { g.fillRect(vx + 10 + i * 24, 112, 8, 12); g.fillRect(vx + 10 + i * 24, 146, 8, 12); } g.fillRect(vx + 70, 80, 10, 10);
    g.fillStyle = '#1a3a26'; for (let i = 0; i < 12; i++) { const x = (i * 40 - kam * 0.55) % 300 - 20; g.beginPath(); g.arc(x, 186, 22, 0, 7); g.fill(); }
  } else if (sek === 3 || sek === 2) {   // Labor: Kacheln, Rohre, Glaskolben
    g.fillStyle = sek === 3 ? '#1a1a2a' : '#123a3a'; g.fillRect(0, 32, VA.w, 160);
    g.fillStyle = sek === 3 ? '#26263a' : '#1a4a4a'; for (let y = 32; y < 192; y += 16) for (let x = -((kam * 0.6) % 16); x < VA.w; x += 16) g.fillRect(x + 1, y + 1, 14, 14);
    g.fillStyle = '#6a6a7a'; g.fillRect(0, 52, VA.w, 4); for (let x = -((kam * 0.6) % 64); x < VA.w; x += 64) { g.fillRect(x + 20, 52, 4, 60); g.fillStyle = '#7aff9a'; g.fillRect(x + 40, 120, 6, 14); g.fillStyle = '#6a6a7a'; }
  } else {   // Halle: lila Tapete mit Rauten, Fenster im Mondlicht, Gemälde
    g.fillStyle = '#3a1a5a'; g.fillRect(0, 32, VA.w, 160);
    g.fillStyle = '#4a2470'; for (let y = 40; y < 192; y += 16) for (let x = -((kam * 0.6) % 16); x < VA.w; x += 16) { g.beginPath(); g.moveTo(x + 8, y); g.lineTo(x + 13, y + 6); g.lineTo(x + 8, y + 12); g.lineTo(x + 3, y + 6); g.fill(); }
    for (let x = -((kam * 0.6) % 128); x < VA.w; x += 128) {
      g.fillStyle = '#1a1030'; g.fillRect(x + 20, 60, 30, 46); g.fillStyle = '#5a6ab0'; g.fillRect(x + 23, 63, 24, 40); g.fillStyle = '#d8e0ff'; g.fillRect(x + 34, 63, 2, 40);
      g.fillStyle = '#c89a3a'; g.fillRect(x + 78, 70, 28, 22); g.fillStyle = '#7a4a2a'; g.fillRect(x + 81, 73, 22, 16);
    }
  }
}
function vaKacheln(g) {
  const kam = VA.kam, tx0 = Math.floor(kam / T16), sek = vaSektion(kam + 128);
  for (let tx = tx0; tx <= tx0 + 17; tx++) for (let ty = 2; ty < 14; ty++) {
    if (!vaFest(tx, ty)) continue;
    const x = tx * T16 - kam, y = ty * T16, oben = !vaFest(tx, ty - 1), s = vaSektion(tx * T16);
    if (s === 0) { g.fillStyle = oben ? '#4aa84a' : '#6a4a2a'; g.fillRect(x, y, 16, 16); if (oben) { g.fillStyle = '#6a4a2a'; g.fillRect(x, y + 5, 16, 11); g.fillStyle = '#7ad85a'; g.fillRect(x + (tx % 3) * 4, y, 3, 2); } }
    else if (s === 1) { g.fillStyle = '#7a5a8a'; g.fillRect(x, y, 16, 16); g.fillStyle = '#5a3a6a'; g.fillRect(x, y + 7, 16, 1); g.fillRect(x + ((ty % 2) ? 4 : 11), y, 1, 7); g.fillRect(x + ((ty % 2) ? 11 : 4), y + 8, 1, 8); if (oben) { g.fillStyle = '#9a7aaa'; g.fillRect(x, y, 16, 2); } }
    else { g.fillStyle = '#6a7a8a'; g.fillRect(x, y, 16, 16); g.fillStyle = '#4a5a6a'; g.fillRect(x + 1, y + 1, 14, 14); g.fillStyle = '#8a9aaa'; g.fillRect(x + 2, y + 2, 2, 2); g.fillRect(x + 12, y + 12, 2, 2); if (oben) { g.fillStyle = '#e8c83a'; for (let i = 0; i < 16; i += 4) g.fillRect(x + i, y, 2, 2); } }
  }
  void sek;
}
function vaFigur(g, bild, x, y, blick, blink) {
  if (blink && Math.floor(VA.f / 3) % 2) return;
  g.save(); g.translate(Math.round(x), Math.round(y)); if (blick < 0) g.scale(-1, 1);
  g.drawImage(bild, -bild.width / 2, -bild.height); g.restore();
}
function vaNudel(g, p) {   // die Poolnudel: pink, gestreift, schwabbelt beim Zuschlagen
  if (!p.hieb) return;
  const kam = VA.kam, x = p.x - kam, y = p.y - 21;
  if (p.hieb < 8) { g.save(); g.translate(x - p.blick * 6, y - 6); g.rotate(-p.blick * 0.9); g.fillStyle = '#ff7ab8'; g.fillRect(p.blick > 0 ? -22 : 0, -3, 22, 6); g.restore(); return; }
  const lang = p.hieb <= 15 ? 44 : 44 - (p.hieb - 15) * 10;
  for (let i = 0; i < lang; i += 2) {
    const yy = y + Math.round(Math.sin(i * 0.25 + p.hieb) * 1.5 * (i / lang));
    g.fillStyle = Math.floor(i / 6) % 2 ? '#ff7ab8' : '#ff9ad0'; g.fillRect(x + p.blick * (8 + i) - (p.blick < 0 ? 2 : 0), yy - 3, 2, 6);
    g.fillStyle = '#c84a8a'; g.fillRect(x + p.blick * (8 + i) - (p.blick < 0 ? 2 : 0), yy + 2, 2, 1);
  }
}
function vaText(g, s, x, y, farbe = '#ffffff', ausr = 'left', gr = 8) {
  g.font = `400 ${gr}px "Pixelify Sans", monospace`; g.textAlign = ausr; g.textBaseline = 'top';
  g.fillStyle = '#000000'; g.fillText(s, x + 1, y + 1); g.fillStyle = farbe; g.fillText(s, x, y);
}
function vaBalken(g, x, y, wert, farbe) { for (let i = 0; i < 16; i++) { g.fillStyle = i < wert ? farbe : '#3a2a3a'; g.fillRect(x + i * 4, y, 3, 6); } }
function vaZeichnen() {
  const g = VA.g; g.imageSmoothingEnabled = false;
  g.fillStyle = '#000000'; g.fillRect(0, 0, VA.w, VA.h);
  if (VA.phase === 'titel') { vaTitel(g); return; }
  const p = VA.p, kam = VA.kam;
  vaHintergrund(g); vaKacheln(g);
  for (const k of VA.kerzen) if (k.an) {   // Kerzen an der Wand (Hiebziel)
    const x = k.x - kam, y = k.y; if (x < -10 || x > VA.w + 10) continue;
    g.fillStyle = '#c8a03a'; g.fillRect(x - 4, y + 6, 8, 2); g.fillStyle = '#f0e8d0'; g.fillRect(x - 2, y - 2, 4, 8);
    g.fillStyle = VA.f % 8 < 4 ? '#ffd34a' : '#ff8a2a'; g.fillRect(x - 1, y - 6, 2, 4);
  }
  for (const d of VA.dinge) {
    const x = Math.round(d.x - kam), y = Math.round(d.y); if (d.zeit < 90 && VA.f % 4 < 2) continue;
    if (d.art === 'toast') { g.fillStyle = '#e0901c'; g.fillRect(x - 5, y - 5, 10, 9); g.fillStyle = '#f8d890'; g.fillRect(x - 4, y - 4, 8, 7); }
    else { const s = d.art === 'herz' ? 1 : 2; g.fillStyle = '#ff3a5a'; g.fillRect(x - 3 * s, y - 2 * s, 2 * s, 2 * s); g.fillRect(x + s, y - 2 * s, 2 * s, 2 * s); g.fillRect(x - 3 * s, y, 6 * s, 2 * s); g.fillRect(x - 2 * s, y + 2 * s, 4 * s, s); }
  }
  for (const e of VA.gegner) {
    if (e.hp <= 0) continue;
    if (e.art === 'tentakel') vaFigur(g, Math.floor((e.t + e.x) / 16) % 2 ? VA_SPR.tent1 : VA_SPR.tent2, e.x - kam, e.y, p.x < e.x ? 1 : -1, e.treffer);
    else vaFigur(g, VA_SPR.kopf, e.x - kam, e.y + 5, 1, false);
  }
  const B = VA.boss;
  if (B && (B.hp > 0 || VA.ende < 120)) {   // der Lila Tentakel, doppelt so groß und mit Armen
    if (!(B.treffer && Math.floor(VA.f / 2) % 2)) {
      g.save(); g.translate(Math.round(B.x - kam), Math.round(B.y)); g.scale(B.blick > 0 ? -2 : 2, 2); g.drawImage(VA_SPR.tent1, -6, -20); g.restore();
      const w = Math.sin(VA.f * 0.15) * 4, bx = B.x - kam;
      g.fillStyle = '#9a34c8'; g.fillRect(bx - 18, B.y - 26 + w, 8, 4); g.fillRect(bx + 10, B.y - 26 - w, 8, 4); g.fillRect(bx - 20, B.y - 32 + w, 4, 8); g.fillRect(bx + 16, B.y - 32 - w, 4, 8);
    }
  }
  for (const s of VA.schuesse) {
    const x = Math.round(s.x - kam), y = Math.round(s.y);
    if (s.toast) { g.save(); g.translate(x, y); g.rotate(VA.f * 0.3); g.fillStyle = '#e0901c'; g.fillRect(-5, -5, 10, 10); g.fillStyle = '#f8d890'; g.fillRect(-4, -4, 8, 8); g.restore(); }
    else { g.fillStyle = '#7aff6a'; g.fillRect(x - 3, y - 3, 6, 6); g.fillStyle = '#c0ffb0'; g.fillRect(x - 1, y - 2, 2, 2); }
  }
  if (p) {
    vaNudel(g, p);
    let bild = VA_SPR.steh;
    if (p.tot) bild = VA_SPR.sprung;
    else if (p.hieb) bild = p.hieb < 8 ? VA_SPR.aushol : p.boden ? VA_SPR.hieb : VA_SPR.hiebLuft;
    else if (!p.boden) bild = VA_SPR.sprung;
    else if (Math.abs(p.vx) > 0.1) bild = Math.floor(p.lauf / 8) % 2 ? VA_SPR.lauf1 : VA_SPR.lauf2;
    g.save(); if (p.tot) { g.globalAlpha = Math.max(0, 1 - p.tot / 100); }
    vaFigur(g, bild, p.x - kam, p.y, p.blick, p.unverwundbar && !p.tot);
    g.restore();
  }
  for (const f of VA.fx) { g.fillStyle = f.farbe; g.fillRect(Math.round(f.x - kam), Math.round(f.y), 2, 2); }
  // Anzeige oben
  g.fillStyle = '#000000'; g.fillRect(0, 0, VA.w, 32);
  vaText(g, `PUNKTE ${String(VA.punkte).padStart(6, '0')}`, 6, 3); vaText(g, `STUFE 01`, 140, 3);
  vaText(g, 'HOAGIE', 6, 13); vaBalken(g, 50, 15, p ? p.hp : 0, '#ff3a5a');
  vaText(g, 'TENTAKEL', 6, 22, '#e88aea'); vaBalken(g, 50, 24, B ? Math.ceil(B.hp * 16 / 14) : 16, '#e88aea');
  vaText(g, `♥-${String(VA.herzen).padStart(2, '0')}`, 178, 13, '#ff7a9a'); vaText(g, `P-${Math.max(0, VA.leben)}`, 178, 22);
  g.fillStyle = '#e0901c'; g.fillRect(222, 14, 12, 12); g.fillStyle = '#f8d890'; g.fillRect(224, 16, 8, 8);   // Unterwaffe: Toast
  if (VA.phase === 'aus') { g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(0, 80, VA.w, 64); vaText(g, T('SPIEL VORBEI'), 128, 96, '#ff5a7a', 'center', 16); vaText(g, T('START: zum Titel'), 128, 122, '#ffffff', 'center'); }
  if (VA.phase === 'sieg') {
    g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(0, 60, VA.w, 104);
    vaText(g, T('VILLA BEFREIT!'), 128, 72, '#ffd34a', 'center', 16);
    vaText(g, T('Der Lila Tentakel ist geschlagen.'), 128, 100, '#ffffff', 'center');
    vaText(g, `${T('Punkte')}: ${VA.punkte}`, 128, 116, '#ffffff', 'center');
    if (VA.f > 90) vaText(g, T('START: zum Titel'), 128, 140, '#e88aea', 'center');
  }
}
function vaTitel(g) {
  const f = VA.f;
  const lg = g.createLinearGradient(0, 0, 0, VA.h); lg.addColorStop(0, '#0a0620'); lg.addColorStop(1, '#3a1a5a'); g.fillStyle = lg; g.fillRect(0, 0, VA.w, VA.h);
  g.fillStyle = '#f4f0d8'; g.beginPath(); g.arc(200, 48, 16, 0, 7); g.fill();
  g.fillStyle = '#1a1030'; g.fillRect(40, 120, 176, 70); g.fillRect(110, 92, 36, 28); g.beginPath(); g.moveTo(30, 122); g.lineTo(128, 96); g.lineTo(226, 122); g.fill();
  g.fillStyle = '#f2c24a'; for (let i = 0; i < 7; i++) if ((i + Math.floor(f / 40)) % 5) g.fillRect(52 + i * 24, 140, 8, 12);
  for (let i = 0; i < 3; i++) { const x = (f * 0.6 + i * 90) % 300 - 20; g.drawImage(VA_SPR.kopf, Math.round(x), Math.round(70 + Math.sin(f * 0.07 + i) * 10)); }
  g.fillStyle = '#2a1a1a'; g.fillRect(0, 190, VA.w, 34);
  vaFigur(g, Math.floor(f / 10) % 2 ? VA_SPR.lauf1 : VA_SPR.lauf2, 60 + Math.sin(f * 0.01) * 20, 190, 1, false);
  const z = 1 + Math.sin(f * 0.05) * 0.03;
  g.save(); g.translate(128, 30); g.scale(z, z); g.rotate(-0.04);
  vaText(g, 'TENTAKELVANIA', 0, -8, '#e88aea', 'center', 22); g.restore();
  vaText(g, T('Hoagie gegen die lila Tentakel'), 128, 52, '#ffd34a', 'center');
  if (Math.floor(f / 30) % 2) vaText(g, T('START DRÜCKEN'), 128, 166, '#ffffff', 'center', 12);
  vaText(g, `${T('REKORD')} ${String(VA.rekord).padStart(6, '0')}`, 128, 204, '#8a7ab0', 'center');
  vaText(g, '© 1987 EDISON SOFT', 128, 214, '#5a4a7a', 'center');
}
// Kleines Vorschaubild für den Automaten im Konferenzsaal (Werbeschleife)
function vaVorschau() { vaSprites(); if (!VA.cv) { VA.cv = document.createElement('canvas'); VA.cv.width = VA.w; VA.cv.height = VA.h; VA.g = VA.cv.getContext('2d'); } if (G.screen !== 'vania') { VA.f = Math.floor(G.t / 16.7); vaTitel(VA.g); } return VA.cv; }

// ---------- Automatengehäuse auf dem Bildschirm ----------
function drawVania() {
  const g0 = cx, s = Math.min((W - 120) / VA.w, (H - 124) / VA.h), w = VA.w * s, h = VA.h * s, x = (W - w) / 2, y = (H - h) / 2 + 20;
  g0.fillStyle = grad(g0, 0, 0, 0, H, [[0, '#1a0a2a'], [1, '#0a0410']]); g0.fillRect(0, 0, W, H);
  R(g0, x - 26, y - 26, w + 52, h + 52, '#2a1440', 4, 22, '#6a3a9a');   // Gehäuse (krumm wie alles)
  vaZeichnen();
  g0.save(); g0.imageSmoothingEnabled = false; g0.drawImage(VA.cv, x, y, w, h); g0.restore();
  if (!g0.isPix) {   // Bildröhre: Zeilen, leichte Wölbung, Glanz
    g0.save(); g0.globalAlpha = 0.16; g0.fillStyle = '#000000'; for (let yy = 0; yy < h; yy += s) g0.fillRect(x, y + yy, w, s * 0.42); g0.restore();
    const vg = g0.createRadialGradient(x + w / 2, y + h / 2, h * 0.35, x + w / 2, y + h / 2, h * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    g0.fillStyle = vg; g0.fillRect(x, y, w, h);
    g0.save(); g0.globalAlpha = 0.07; g0.fillStyle = '#ffffff'; g0.beginPath(); g0.ellipse(x + w * 0.3, y + h * 0.18, w * 0.25, h * 0.08, -0.2, 0, Math.PI * 2); g0.fill(); g0.restore();
  }
  txt(g0, 'TENTAKELVANIA', W / 2, y - 30, '400 24px "Titan One", sans-serif', '#e88aea', 'center', 6, '#1b0a2a');
  const K = vaKnoepfe(), touch = G.pointer === 'touch' || (typeof COARSE !== 'undefined' && COARSE);
  if (touch) for (const [n, r] of Object.entries(K)) {
    R(g0, r.x, r.y, r.w, r.h, VA.touch[n] ? 'rgba(232,138,234,0.5)' : 'rgba(40,20,60,0.55)', 2, 14, '#e88aea');
    txt(g0, { links: '◀', rechts: '▶', sprung: 'A', nudel: 'B', raus: '✕' }[n], r.x + r.w / 2, r.y + r.h / 2 + 10, '800 28px "Baloo 2", sans-serif', '#ffffff');
  } else txt(g0, T('Pfeile/WASD laufen · Leertaste springen · J/Z Poolnudel · ↑+J Toast werfen · Esc beenden'), W / 2, H - 14, '600 13px "Baloo 2", sans-serif', '#b8a4e8');
}

// ---------- in die Spielschleife einhängen ----------
{
  const drawScreenOhne = drawScreen;
  drawScreen = function () { if (G.screen === 'vania') { drawVania(); return; } drawScreenOhne(); };
  const updateOhne = update;
  update = function (dt) {
    updateOhne(dt);
    if (G.screen !== 'vania') return;
    VA.acc = Math.min(100, VA.acc + dt);
    while (VA.acc >= 1000 / 60) { VA.acc -= 1000 / 60; vaSchritt(); }
  };
  const musicOhne = music;
  music = function () { if (G.screen === 'vania') { Sound.setHero(null); Sound.play(VA.bossKampf ? 'vaniaBoss' : 'vania'); return; } musicOhne(); };
  const onClickOhne = onClick;
  onClick = function (x, y, right) { if (G.screen === 'vania') return; return onClickOhne(x, y, right); };
}
if (typeof ACH !== 'undefined') ACH.push({ id: 'tentakelvania', name: 'Nudelmeister', desc: 'Tentakelvania am Spielautomaten im Konferenzsaal durchgespielt.' });

// ---------- der Automat im Konferenzsaal ----------
const AUTOMAT_RECT = [212, 132, 84, 120];
ROOMS.konferenz.objs.push({ id: 'spielautomat', name: 'Spielautomat', rect: AUTOMAT_RECT, walk: [254, 364], dv: 'use',
  look: 'Ein Spielautomat: „TENTAKELVANIA – © 1987 Edison Soft“. Ein Hoagie-Männchen verhaut lila Tentakel mit einer Poolnudel. Wer denkt sich so was aus?' });
RULES['use o:spielautomat'] = async () => { Sound.sfx('coin'); await say(curId(), pick(['Eine Runde geht noch.', 'Mal sehen, ob ich den Rekord knacke.', 'Poolnudel bereit!'])); startVania(); };
RULES['open o:spielautomat'] = RULES['use o:spielautomat'];
RULES['pick o:spielautomat'] = line('Der wiegt mehr als Dr. Freds Ego. Und das ist schon viel.');
RULES['talk o:spielautomat'] = line('„INSERT COIN“, sagt der Automat. Er ist kein guter Zuhörer.');
// gemalter Automat (2D): steht hinter dem Konferenztisch, nur der obere Teil schaut über die Tischkante
function drawSpielautomat(c) {
  if (typeof echt3dOn === 'function' && echt3dOn(ROOMS.konferenz)) return;   // im 3D steht er als Modell im Raum
  const [x, y, w] = AUTOMAT_RECT;
  c.save(); c.beginPath(); c.rect(x - 10, y - 10, w + 20, 252 - y + 10); c.clip();   // unterhalb der Tischkante verdeckt
  c.translate(x + w / 2, y + 60); c.rotate(-0.035); c.translate(-x - w / 2, -y - 60);
  R(c, x, y + 4, w, 160, '#3a1a5a', 3, 6, '#160a24');
  R(c, x + 4, y - 4, w - 8, 22, '#e88aea', 3, 5, '#160a24');
  txt(c, 'TENTAKELVANIA', x + w / 2, y + 11, '400 9px "Titan One", sans-serif', '#3a0a4a');
  R(c, x + 9, y + 24, w - 18, 54, '#0a0410', 3, 4, '#160a24');
  if (!c.isPix) { c.save(); c.imageSmoothingEnabled = false; c.drawImage(vaVorschau(), x + 12, y + 27, w - 24, 48); c.restore(); }
  R(c, x + 6, y + 84, w - 12, 16, '#5a2a7a', 2, 3, '#160a24');
  E(c, x + 24, y + 90, 4, 4, '#ff5a7a', 1.5); E(c, x + 56, y + 92, 4, 4, '#ffd34a', 1.5); E(c, x + 66, y + 89, 4, 4, '#7ad8ff', 1.5);
  c.restore();
  if (!c.isPix) glowAt(c, x + w / 2, y + 50, 46, '#c070ff', 0.18 + Math.sin(G.t * 0.004) * 0.04);
}
