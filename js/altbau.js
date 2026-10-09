'use strict';
// ============================================================
//  Tentakel-Toast – die alten, gezeichneten Räume in 3D
//  Hintergründe aus Blender (art/blender/altbau.py), Bildpositionen aus art/blender/altbau_post.py (js/altbau-daten.js).
//  Zustände wie „Falltür offen“ sind kleine Ausschnitte, die über das Grundbild gemalt werden; room.bgKey() sagt dem
//  Hintergrund-Puffer, welcher Zustand gerade gilt. Bewegte Teile (Pendel) sind eigene Bilder.
// ============================================================

const flagOn = k => !!(G.state && G.state.flags && G.state.flags[k]);
function altbauNeu(id) {   // Hintergrund neu malen (Bild geladen)
  for (const k of Object.keys(bgCache)) if (k === id || k.startsWith(id + '|')) delete bgCache[k];
  if (ROOMS[id]) delete ROOMS[id]._pix;
  delete mapThumbs[id];
}
function altbauBild(id, src) {
  const im = loadImg(src);
  im.addEventListener('load', () => altbauNeu(id));
  return im;
}
function malBild(g, im, x, y, w, h) {
  if (!imgOk(im)) return false;
  if (g.isPix) {
    g.drawSprite(im, 0, 0, im.naturalWidth, im.naturalHeight, x, y, w, h);
    // Sparmodus (Xbox): die Pixelkopie eines ganzen Raumbilds (6,7 MB) nicht behalten – der Pixel-Hintergrund ist ja schon gemalt
    if (LOWMEM && im.naturalWidth * im.naturalHeight > 1e6) delete im._pixSrc;
  } else g.drawImage(im, x, y, w, h);
  return true;
}
// Raum auf das 3D-Bild umstellen: Lauffläche wie die neuen 3D-Räume, Hotspots neu (o.objs: id -> Felder), Zustände (o.zustand: Variante -> Bedingung)
function altbau3d(id, o) {
  const room = ROOMS[id], data = ALTBAU3D[id];
  if (!room || !data) return null;
  const img = RAUM3D[id] = altbauBild(id, `img/raum_${id}.jpg`);
  const vars = Object.entries(o.zustand || {}).filter(([k]) => data.variants[k]).map(([k, on]) => {
    const v = data.variants[k], im = altbauBild(id, v.src);
    im.noSel = true;
    return { on, v, im };
  });
  Object.assign(room, {
    sMin: 0.67, sMax: 1, yTop: 350, yBot: 432, walk: o.walk || [[20, 352], [940, 350], [955, 432], [5, 432]],
    bgKey: () => vars.map(z => z.on() ? 1 : 0).join(''),
    draw(g) {
      if (!malBild(g, img, 0, 0, W, SH)) { g.fillStyle = o.fill || '#241739'; g.fillRect(0, 0, W, SH); return; }
      for (const z of vars) if (z.on()) malBild(g, z.im, z.v.x, z.v.y, z.v.w, z.v.h);
    },
  });
  for (const [oid, f] of Object.entries(o.objs || {})) {
    const ob = room.objs.find(q => q.id === oid);
    if (ob) Object.assign(ob, f);
  }
  return data;
}
// Pendel als Bild, das um seinen Drehpunkt schwingt (im Uhrfenster beschnitten)
function pendelDraw(data, name, fenster, amp = 0.16) {
  const s = data.sprites[name], im = loadImg(s.src), [px, py] = s.pivot, F = data.anchors[fenster];
  return (c, t) => {
    if (!imgOk(im)) return;
    c.save(); c.beginPath(); c.rect(F[0] + 1, F[1] + 1, F[2] - 2, F[3] - 2); c.clip();
    c.translate(px, py); c.rotate(Math.sin(t * 0.0032) * amp); c.translate(-px, -py);
    malBild(c, im, s.x, s.y, s.w, s.h);
    c.restore();
  };
}

// Bild, das sich um einen Drehpunkt dreht (Hebel); winkel(t) liefert den Drehwinkel
function drehDraw(data, name, winkel) {
  const s = data.sprites[name], im = loadImg(s.src), [px, py] = s.pivot;
  return (c, t) => {
    if (!imgOk(im)) return;
    c.save(); c.translate(px, py); c.rotate(winkel(t)); c.translate(-px, -py);
    malBild(c, im, s.x, s.y, s.w, s.h);
    c.restore();
  };
}

// =================== GEGENWART: LOBBY ===================
{
  const D = altbau3d('lobby', {
    fill: '#2a1a3e',
    zustand: { zucker_leer: () => flagOn('zucker'), falltuer: () => flagOn('falltuer'), strom: () => flagOn('kellerStrom') },
    objs: {
      fenster_heute: { rect: [555, 68, 118, 111] },
      gemaelde: { rect: [397, 68, 105, 122] },
      schluesselbrett: { rect: [83, 144, 104, 56] },
      rezeption: { rect: [20, 256, 259, 87], walk: [150, 362] },
      klingel: { rect: [112, 242, 34, 26], walk: [130, 362] },
      zucker: { rect: [184, 234, 38, 32], walk: [204, 362], draw: null },
      uhr_heute: { rect: [279, 147, 67, 197], walk: [312, 362] },
      sofa: { rect: [438, 256, 205, 89], walk: [540, 374] },
      automat: { rect: [695, 183, 88, 158], walk: [738, 366] },
      zettel_automat: { rect: [722, 220, 50, 34], walk: [738, 366], draw: null },
      tuer_labor: { rect: [832, 150, 117, 185], walk: [888, 362] },
      lobby_teppich: { rect: [505, 382, 110, 26], walk: [600, 414] },
      falltuer: { rect: [500, 296, 120, 104], walk: [600, 418],
        draw: (c, t) => { if (!c.isPix) glowAt(c, 560, 392, 46, '#ffc070', 0.42 + Math.sin(t * 0.003) * 0.08); } },
    },
  });
  if (D) {
    ROOMS.lobby.objs.find(q => q.id === 'uhr_heute').draw = pendelDraw(D, 'pendel', 'Uhrfenster');
    // Fledermaus und Mondlicht durchs neue Fenster, Chuck auf dem Tresen, Onkel Ed an der rechten Türzarge
    const [gx0, gy0] = D.points.fensterGlas0, [gx1, gy1] = D.points.fensterGlas1;
    Object.assign(LOBBY_FENSTER, { x: gx0, y: gy0, w: gx1 - gx0, h: gy1 - gy0 });
    Object.assign(RAYS.lobby[0], { win: [gx0, gy0, gx1, gy1], floor: 384 });
    [EGGS.chuck.x, EGGS.chuck.y] = D.points.chuck;
    EGGS.ed.x = D.points.ed[0]; EGGS.ed.y = D.points.ed[1];
    const edMal = EGG_DRAW.ed;
    EGG_DRAW.ed = (c, e, t) => { c.save(); c.translate(0, 52); try { edMal(c, e, t); } finally { c.restore(); } };   // Kopf auf Türhöhe der neuen Tür
    ROOMS.lobby.dyn = (c, t) => {
      if (!c.isPix) {   // Mondlicht fällt schräg durchs Fenster auf den Teppich
        c.save(); c.globalAlpha = 0.06 + Math.sin(t * 0.0008) * 0.02;
        P(c, [gx0, gy1, gx1, gy1, gx1 - 70, 412, gx0 - 150, 412], '#bfd8ff', 0);
        c.restore();
      }
      // eine Motte umkreist den grünen Lampenschirm auf dem Tresen
      const mx = 54 + Math.cos(t * 0.004) * 24, my = 222 + Math.sin(t * 0.007) * 12, f = Math.sin(t * 0.06) * 3;
      E(c, mx, my, 3, 2, '#d9cdb8', 1.2); L(c, [mx - 4, my - f, mx, my, mx + 4, my - f], 1.2);
    };
  }
}

// =================== GEGENWART: LABOR ===================
// Der Gut-O-Mat steht wie gezeichnet: LEDs, Toast, Dampf und das Absperrband (rooms.js, gaeste.js) passen ohne Umrechnung.
{
  const D = altbau3d('labor', {
    fill: '#12302e',
    zustand: { regler_gut: () => !!(G.state && G.state.flags && G.state.flags.regler === 'good'), zelle: () => flagOn('cellIn'), brot: () => flagOn('breadIn') && !flagOn('toast'),
      klo_hoagie: () => flagOn('kloH'), klo_laverne: () => flagOn('kloL') },   // die Reise-Klos stehen nur im Intro (js/kostuem.js)
    objs: {
      tuer_lobby: { rect: [7, 150, 110, 185], walk: [72, 362] },
      tafel: { rect: [134, 52, 186, 104] },
      regal: { rect: [132, 208, 195, 96], walk: [228, 362] },
      gutomat: { rect: [385, 102, 209, 220], walk: [490, 366] },
      regler: { rect: [444, 274, 36, 36], walk: [462, 366], draw: null },
      hebel: { rect: [587, 172, 54, 120], walk: [604, 362] },
      klo_heute: { rect: [705, 100, 144, 247], walk: [788, 362] },
    },
  });
  if (D) {
    const P = D.points;
    // Hebel: Bild um die Achse drehen (gezogen = 2 rad nach unten, wie früher 900 ms lang)
    ROOMS.labor.objs.find(q => q.id === 'hebel').draw = drehDraw(D, 'hebel', () => {
      const lt = G.leverT ? G.t - G.leverT : 1e9;
      return 2.01 * (lt < 120 ? lt / 120 : lt < 900 ? 1 : lt < 1150 ? 1 - (lt - 900) / 250 : 0);
    });
    ROOMS.labor.objs.find(q => q.id === 'klo_heute').draw = c => kloFx(c, 'klo_heute', P.kloOben[0], P.kloOben[1], P.kloUnten[1], P.kloBirne[0], P.kloBirne[1]);
    Object.assign(LAB_ARC, { x0: P.klemme[0], y0: P.klemme[1], x1: P.pol[0], y1: P.pol[1] });
    RAYS.labor[0].cone[0] = P.neon[0]; RAYS.labor[0].cone[1] = P.neon[1] + 4;
    const [fx, fy] = P.funken;
    ROOMS.labor.dyn = (c, t) => {
      // gelegentliche Funken am angekokelten Kabelende
      const sp = (t % 5200) / 5200;
      if (sp < 0.06) for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + t * 0.01, r = 4 + sp * 260;
        L(c, [fx + Math.cos(a) * r * 0.4, fy + Math.sin(a) * r * 0.25, fx + Math.cos(a) * r * 0.5, fy + Math.sin(a) * r * 0.32], 2.5, '#ffe36b');
      }
      // Bläschen steigen aus den Kolben im Regal
      for (let i = 0; i < 6; i++) {
        const x = [152, 186, 246, 196, 236, 284][i], y0 = [208, 206, 208, 268, 266, 206][i];
        const k = ((t * 0.0007) + i * 0.37) % 1;
        c.save(); c.globalAlpha = 1 - k; E(c, x + Math.sin(t * 0.004 + i) * 3, y0 - k * 34, 2.5 + k * 2, 2.5 + k * 2, null, 1.5, 0, '#e8fff0'); c.restore();
      }
    };
  }
}

// =================== 1776: GASTHAUS ===================
// Kessel, Rost und Glut sind jetzt im 3D-Bild; das Spiel malt weiter Flammen, Feuerschein, Dampf und Sonnenstaub.
{
  const D = altbau3d('gasthaus', {
    fill: '#4a2e18',
    zustand: { apfel: () => flagOn('apfel'), fahne: () => flagOn('fahne') },
    objs: {
      fenster_1776: { rect: [473, 59, 135, 121] },
      schild_1776: { rect: [648, 59, 134, 50] },
      ofen: { rect: [29, 122, 233, 223], walk: [200, 362] },
      uhr_1776: { rect: [288, 147, 60, 196], walk: [318, 362] },
      tisch: { rect: [384, 282, 271, 65], walk: [520, 366] },
      obstschale: { rect: [446, 250, 44, 38], walk: [470, 364], draw: null },
      tuer_garten: { rect: [833, 110, 117, 225], walk: [884, 362] },
      kessel: { rect: [108, 250, 63, 46], walk: [196, 366] },
    },
  });
  if (D) {
    const P = D.points;
    ROOMS.gasthaus.objs.find(q => q.id === 'uhr_1776').draw = pendelDraw(D, 'pendel', 'Uhrfenster');
    [EGGS.grail.x, EGGS.grail.y] = P.grail;
    [EGGS.grog.x, EGGS.grog.y] = P.grog;
    const [gx0, gy0] = P.fensterGlas0, [gx1, gy1] = P.fensterGlas1;
    RAYS.gasthaus[0].win = [gx0, gy0, gx1, gy1];
    const [fx, fy] = P.feuer, [kx, ky] = P.kessel, dx = fx - 141, dy = fy - 326;   // Flammen wie gezeichnet, auf den neuen Herd verschoben
    ROOMS.gasthaus.dyn = (c, t) => {
      const f = Math.sin(t * 0.02) * 4, g = Math.cos(t * 0.017) * 5;
      if (!c.isPix) {   // Feuerschein auf dem Boden
        const gl = c.createRadialGradient(fx, fy + 4, 10, fx, fy + 14, 230);
        gl.addColorStop(0, `rgba(255,150,40,${0.24 + Math.sin(t * 0.013) * 0.06})`); gl.addColorStop(1, 'rgba(255,150,40,0)');
        c.fillStyle = gl; c.fillRect(fx - 240, fy - 180, 480, 300);
      }
      for (let i = 0; i < 14; i++) {   // Staub tanzt im Sonnenstrahl
        const k = ((t * 0.00004 * (1 + i % 3)) + i * 0.071) % 1, x = gx0 + 14 + i * 13 + k * 150 + Math.sin(t * 0.001 + i) * 8, y = gy1 + 18 + k * 140;
        c.save(); c.globalAlpha = 0.5 * Math.sin(k * Math.PI); E(c, x, y, 1.6, 1.6, '#fff6d0', 0); c.restore();
      }
      c.save(); c.translate(dx, dy);
      S(c, '#ff8a1f', 2, () => { c.moveTo(96, 326); c.quadraticCurveTo(104 + f, 282, 122, 300 + g * 0.4); c.quadraticCurveTo(132, 264 + f, 146, 296); c.quadraticCurveTo(160 + g, 272, 170, 300); c.quadraticCurveTo(178, 286 - f, 186, 326); c.closePath(); });
      S(c, '#ffd23a', 0, () => { c.moveTo(112, 326); c.quadraticCurveTo(122, 300 + g, 134, 310); c.quadraticCurveTo(144, 290 - f, 154, 312); c.quadraticCurveTo(166, 300 + f, 172, 326); c.closePath(); });
      for (let i = 0; i < 4; i++) {   // Funken steigen aus dem Feuer auf
        const k = ((t * 0.0008) + i * 0.25) % 1;
        c.save(); c.globalAlpha = (1 - k) * 0.9;
        E(c, 118 + i * 16 + Math.sin(t * 0.004 + i * 2) * 6, 298 - k * 88, 1.4, 1.4, k < 0.3 ? '#ffd23a' : '#ff8a3d', 0);
        c.restore();
      }
      c.restore();
      for (let i = 0; i < 2; i++) {   // Dampf aus dem Kessel
        const k = ((t * 0.0005) + i * 0.5) % 1;
        c.save(); c.globalAlpha = (1 - k) * 0.7; E(c, kx - 6 + i * 14 + Math.sin(t * 0.003 + i) * 5, ky - 4 - k * 40, 6 + k * 8, 5 + k * 6, '#f4f0ea', 0); c.restore();
      }
    };
  }
}

// =================== 1776: GARTEN ===================
// Zaun, Brunnenwasser und Wiese liegen wie gezeichnet: Vögel, Eichhörnchen, Glitzern, Pfützen und Regenbogen passen weiter.
{
  const beet = k => () => ((G.state && G.state.flags && G.state.flags.beet) || 0) === k;
  const D = altbau3d('garten1776', {
    fill: '#62bdf6',
    zustand: { eimer_weg: () => flagOn('eimer'), beet1: beet(1), beet2: beet(2), beet3: beet(3) },
    objs: {
      tuer_gasthaus: { rect: [3, 148, 113, 196], walk: [66, 362] },
      zaun: { rect: [343, 242, 367, 60] },
      brunnen: { rect: [187, 143, 156, 195], walk: [272, 362] },
      eimer: { rect: [304, 248, 36, 32], walk: [306, 362], draw: null },
      beet: { rect: [474, 330, 156, 56], walk: [660, 386], draw: null },
      plumpsklo: { rect: [727, 77, 180, 264], walk: [826, 362] },
      zum_hafen: { rect: [901, 230, 59, 128], walk: [934, 374], draw: null },
    },
  });
  if (D) {
    const P = D.points;
    ROOMS.garten1776.objs.find(q => q.id === 'plumpsklo').draw = c => kloFx(c, 'plumpsklo', P.kloOben[0], P.kloOben[1], P.kloUnten[1], P.kloBirne[0], P.kloBirne[1]);
  }
}

// =================== ZUKUNFT: GARTEN ===================
// Der Apfelbaum ist ein 3D-Bild, das beim Wachsen um den Stammfuß skaliert; die Laterne leuchtet, solange die Zelle drinsteckt.
{
  const D = altbau3d('fgarten', {
    fill: '#3a1a5a',
    zustand: { zelle_weg: () => flagOn('zelle'), fahne_ur: () => flagOn('urFahne') && !flagOn('kostuem'), fahne_weg: () => flagOn('kostuem') },
    objs: {
      klo_zukunft: { rect: [52, 114, 165, 228], walk: [150, 362] },
      statue: { rect: [291, 98, 114, 241], walk: [350, 362] },
      baumplatz: { rect: [610, 338, 191, 32], walk: [700, 394] },
      baum: { rect: [560, 30, 300, 326], walk: [650, 382] },
      laterne: { rect: [516, 14, 60, 330], walk: [560, 362] },
      zum_palast: { rect: [848, 40, 112, 300], walk: [912, 362] },
      zum_landeplatz: { rect: [0, 226, 70, 134], walk: [38, 374], draw: null },
    },
  });
  if (D) {
    const Pt = D.points, S = D.sprites.baum, baumImg = loadImg(S.src), [bx, by] = S.pivot, [lx, ly] = Pt.lampe, [fx, fy] = Pt.lampeFuss;
    const objs = ROOMS.fgarten.objs, ob = id => objs.find(q => q.id === id);
    ob('klo_zukunft').draw = c => kloFx(c, 'klo_zukunft', Pt.kloOben[0], Pt.kloOben[1], Pt.kloUnten[1], Pt.kloBirne[0], Pt.kloBirne[1]);
    ob('baum').draw = c => {
      if (!imgOk(baumImg)) return;
      let k = 1;
      if (G.treeGrowT) {   // wächst mit kleinem Nachfedern aus dem Boden
        const x = Math.max(0, Math.min(1, (G.t - G.treeGrowT) / 1800));
        k = x < 1 ? (1 - Math.pow(1 - x, 3)) * (1 + Math.sin(x * Math.PI) * 0.08) : 1;
      }
      if (k <= 0) return;
      c.save(); c.translate(bx, by); c.scale(k, k); c.translate(-bx, -by);
      if (!c.isPix) shadow(c, bx, by + 4, 125, 20, 0.26);
      malBild(c, baumImg, S.x, S.y, S.w, S.h);
      c.restore();
    };
    ob('laterne').draw = (c, t) => {
      if (flagOn('zelle') || c.isPix) return;
      const p = 0.5 + Math.sin(t * 0.005) * 0.2;
      const g = c.createRadialGradient(lx, ly, 3, lx, ly, 60); g.addColorStop(0, `rgba(140,255,130,${p * 0.7})`); g.addColorStop(1, 'rgba(140,255,130,0)');
      c.fillStyle = g; c.fillRect(lx - 60, ly - 60, 120, 120);
      c.save(); c.translate(fx, fy + 4); c.scale(1, 0.26);   // grüner Schein der Zelle auf dem Boden
      const g2 = c.createRadialGradient(0, 0, 5, 0, 0, 85);
      g2.addColorStop(0, `rgba(140,255,130,${0.32 * p})`); g2.addColorStop(1, 'rgba(140,255,130,0)');
      c.fillStyle = g2; c.beginPath(); c.ellipse(0, 0, 85, 85, 0, 0, Math.PI * 2); c.fill(); c.restore();
    };
    const kx = Pt.kloOben[0];
    ROOMS.fgarten.dyn = (c, t) => {
      drawPuddles(c, t, [[210, 396, 48], [600, 408, 58], [880, 386, 40]], 'rgba(230,160,240,0.45)');
      // Tentakel-Ufo patrouilliert am Himmel
      const uk = (t % 14000) / 14000, ux = -80 + uk * (W + 160), uy = 120 + Math.sin(uk * Math.PI * 4) * 14;
      c.save(); c.globalAlpha = 0.18; P(c, [ux - 8, uy + 6, ux + 8, uy + 6, ux + 40, uy + 150, ux - 40, uy + 150], '#a6ff8f', 0); c.restore();
      E(c, ux, uy, 26, 8, '#9aa3ad', 2.5); E(c, ux, uy - 5, 11, 7, '#c9a6ff', 2.5);
      for (let i = -1; i <= 1; i++) E(c, ux + i * 12, uy + 1, 2, 2, Math.floor(t / 200 + i) % 2 ? '#ffe36b' : '#ff5fa8', 0);
      const k = 0.5 + Math.sin(t * 0.004) * 0.5;   // Zyan-Ring um den Sockel des Klo 3000
      E(c, kx, 334, 64, 11, null, 3, 0, `rgba(60,240,255,${0.4 + k * 0.6})`);
      for (let i = 0; i < 8; i++) {
        const x = (i * 131 + t * 0.012 * (i % 3 + 1)) % W, y = 120 + ((i * 47 + t * 0.008) % 160);
        E(c, x, y, 2, 2, `rgba(255,220,255,${0.3 + 0.3 * Math.sin(t * 0.003 + i)})`, 0);
      }
    };
  }
}

// =================== ZUKUNFT: PALAST-VORRAUM ===================
// Gartenbogen, Thronsaaltür und Aufzug liegen wie gezeichnet: Regen im Bogen, Wache, Götzenbild und Drohne passen weiter.
{
  altbau3d('vorraum', {
    fill: '#2e0f45',
    zustand: { plakat_weg: () => flagOn('plakatWeg') },
    objs: {
      zum_garten: { rect: [0, 137, 100, 198], walk: [52, 362] },
      plakat: { rect: [148, 92, 134, 146] },
      banner: { rect: [294, 40, 48, 192] },
      banner2: { rect: [640, 40, 44, 192] },
      verbot: { rect: [712, 96, 141, 80] },
      thron_tuer: { rect: [390, 64, 190, 271], walk: () => fl().guardGone ? [485, 358] : [396, 398] },
      zur_testkammer: { rect: [876, 174, 84, 160], walk: [905, 374], draw: null },
    },
  });
}

// =================== ZUKUNFT: THRONSAAL ===================
// Der Kronleuchter ist ein 3D-Bild, das an seiner Kette pendelt; die Kerzenflammen malt das Spiel (drawCandles).
{
  const D = altbau3d('thron', {
    fill: '#3a0f52',
    walk: [[20, 356], [945, 356], [955, 432], [5, 432]],
    objs: {
      thron_raus: { rect: [0, 137, 100, 198], walk: [52, 376] },
      thron: { rect: [573, 81, 179, 244] },
      teppich: { rect: [380, 352, 260, 88] },
    },
  });
  if (D) {
    const leuchter = drehDraw(D, 'leuchter', t => Math.sin(t * 0.0015) * 0.04);
    ROOMS.thron.dyn = (c, t) => {
      for (let i = 0; i < 6; i++) {   // Glitzer steigt um den Thron auf
        const k = ((t * 0.0004) + i / 6) % 1, x = 600 + Math.cos(i * 2.1) * 110, y = 300 - k * 220;
        c.save(); c.globalAlpha = Math.sin(k * Math.PI) * 0.8;
        L(c, [x - 4, y, x + 4, y], 2, '#ffe9a0'); L(c, [x, y - 4, x, y + 4], 2, '#ffe9a0'); c.restore();
      }
      leuchter(c, t);
    };
  }
}
