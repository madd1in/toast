'use strict';
// ============================================================
//  Tentakel-Toast – Rätsel mit 3D-Mechanik (js/raetsel3d.js)
//  Im Echtzeit-3D werden Stellen der Geschichte, die vorher eine Animation waren, zu Sprungpassagen:
//  • Zukunftsgarten: Laverne klettert selbst den gewachsenen Apfelbaum hinauf – Wurzelstumpf, Äste, Astgabel – und
//    schnappt sich die Energiezelle aus der Laterne im Sprung (Plattformen: js/echt3d-szene.js, KLETTERBAUM).
//    Wer nicht hüpfen mag: beim zweiten Mal „Baum benutzen“ klettert Laverne wie gewohnt automatisch.
//  Ohne Echtzeit-3D bleibt alles beim Alten.
// ============================================================
const r3dAn = id => typeof echt3dOn === 'function' && !!ROOMS[id] && echt3dOn(ROOMS[id]);

// ---------- Kletterbaum: die Energiezelle ----------
{
  const klettern = CLIMB;
  const imSprung = async () => {
    if (!fl().tree || fl().zelle || !r3dAn('fgarten') || curId() !== 'laverne') return klettern();
    if (!fl().kletter3d) {
      fl().kletter3d = 1;
      await s('Hochklettern? Mach ich selbst! Wurzel, Ast, Astgabel – und dann rüber zur Laterne.');
      note('Kletterbaum: Leertaste/A springt von Ast zu Ast. Oben an der Laterne die Zelle im Sprung schnappen! (Nochmal „Baum benutzen“: Laverne klettert automatisch.)');
      return;
    }
    await s('Na gut. Ganz klassisch, mit Händen und Füßen.');
    return klettern();
  };
  multi(['use', 'push'], 'o:baum', imSprung);
  multi(['pick', 'use', 'pull', 'push'], 'o:laterne', async () => {
    if (fl().zelle) return s('Da ist nichts mehr zu holen.');
    if (fl().tree) return imSprung();
    return s('Die Energiezelle hängt viel zu hoch. Ich bräuchte eine Leiter. Oder einen Baum. Oder Flügel.');
  });
  // Zelle im Sprung berühren
  let holt = false;
  setInterval(async () => {
    if (holt || G.screen !== 'game' || !G.state || G.busy || fl().zelle || !fl().tree || !r3dAn('fgarten') || !ECHT3D.mod) return;
    const p = me(); if (!p || p.id !== 'laverne' || p.room !== 'fgarten' || !p._pos3d) return;
    const [kx, ky, kz] = ECHT3D.mod.ZELLE_WELT, [x, y, z] = p._pos3d;
    if (Math.hypot(x - kx, y - ky) > 0.85 || Math.abs(z + 0.95 - kz) > 0.6) return;
    holt = true;
    try {
      addItem('zelle'); fl().zelle = true; Sound.sfx('zap'); rumble(160, 0.3, 0.6);
      if (typeof mimikStart === 'function') mimikStart(p, 'freude');
      unlock('kletterbaum');
      await s('SCHNAPP! Mitten im Sprung! Die Zelle summt mir in der Hand wie ein zufriedener Hamster.');
      await s('Die Laterne ist aus. Die Tentakel werden es überleben. Im Dunkeln.');
      save();
    } finally { holt = false; }
  }, 80);
  if (typeof ACH !== 'undefined') ACH.push({ id: 'kletterbaum', name: 'Baumkletterin', desc: 'Im Echtzeit-3D den Apfelbaum hinaufgesprungen und die Energiezelle im Sprung geschnappt.' });
}
