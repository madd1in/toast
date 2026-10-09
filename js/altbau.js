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
  if (g.isPix) g.drawSprite(im, 0, 0, im.naturalWidth, im.naturalHeight, x, y, w, h); else g.drawImage(im, x, y, w, h);
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
