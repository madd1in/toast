// ============================================================
//  3D-Figuren: in Blender gerenderte Bilder ersetzen im HD-Modus die gezeichneten Figuren.
//  Pro Figur ein Bildatlas (Gehen in 8 Phasen, Stehen, Reden, Aktions-Posen). Licht, Randlicht und
//  Tusche-Kontur kommen wie bei den gezeichneten Figuren aus drawActorLit; Mund, Blinzeln und die Hand
//  fürs Lichtschwert sitzen an Ankerpunkten, die beim Rendern aus Blender mitprojiziert wurden.
//  Bild: [x, y, w, h im Atlas, linke obere Ecke relativ zum Fußpunkt, Mund, Pupille vorn, Pupille hinten, Hand]
//  (alles außer der Atlas-Lage in Spiel-Einheiten, Blickrichtung nach rechts)
// ============================================================
const FIG3D = {
  bernard: { src: 'img/figuren/bernard.png', upp: 0.435, f: {
    idle: [0,0,118,519,-24.4,-223.7,14.6,-177.3,12.0,-193.8,20.3,-194.8,-3.3,-103.7],
    walk0: [120,0,164,516,-41.8,-223.7,16.8,-176.6,14.7,-193.0,23.1,-194.0,-3.2,-103.3],
    walk1: [286,0,136,512,-21.8,-221.9,16.8,-175.1,14.7,-191.5,23.1,-192.5,-14.9,-101.7],
    walk2: [424,0,161,514,-26.5,-220.6,16.8,-173.7,14.7,-190.0,23.1,-191.0,-19.7,-101.3],
    walk3: [587,0,172,516,-37.4,-221.9,16.8,-175.1,14.7,-191.5,23.1,-192.5,-14.9,-101.7],
    walk4: [761,0,141,519,-31.8,-223.7,16.8,-176.6,14.7,-193.0,23.1,-194.0,-3.2,-103.3],
    walk5: [904,0,135,513,-29.1,-221.9,16.8,-175.1,14.7,-191.5,23.1,-192.5,13.7,-111.7],
    walk6: [1041,0,184,511,-34.8,-220.6,16.8,-173.7,14.7,-190.0,23.1,-191.0,18.7,-117.1],
    walk7: [1227,0,201,514,-47.4,-221.9,16.8,-175.1,14.7,-191.5,23.1,-192.5,13.7,-111.7],
    talk0: [1430,0,125,519,-24.4,-223.7,14.6,-177.3,12.0,-193.8,20.3,-194.8,23.0,-128.8],
    talk1: [1557,0,118,519,-24.4,-223.7,14.6,-177.3,12.0,-193.8,20.3,-194.8,7.8,-111.1],
    reach: [1677,0,144,519,-24.4,-223.7,14.6,-177.3,12.0,-193.8,20.3,-194.8,31.4,-145.2],
    pick: [1823,0,160,449,-17.8,-193.2,34.2,-143.7,36.1,-158.3,44.4,-159.3,28.5,-87.4],
    pull: [0,521,143,513,-32.2,-221.1,8.1,-176.3,4.0,-193.0,12.3,-194.0,23.0,-144.1],
    wave: [145,521,118,519,-24.4,-223.7,14.6,-177.3,12.0,-193.8,20.3,-194.8,-14.3,-183.7],
    yawn: [265,521,154,519,-40.9,-223.7,9.4,-178.7,5.6,-195.4,13.9,-196.4,-33.9,-190.3],
    saber0: [421,521,118,519,-24.4,-223.7,14.6,-177.3,12.0,-193.8,20.3,-194.8,18.9,-181.4],
    saber1: [541,521,137,519,-24.4,-223.7,14.6,-177.3,12.0,-193.8,20.3,-194.8,28.2,-157.0],
    saber2: [680,521,131,519,-24.4,-223.7,14.6,-177.3,12.0,-193.8,20.3,-194.8,25.5,-130.9],
    think: [813,521,118,519,-24.4,-223.7,14.6,-177.3,12.0,-193.8,20.3,-194.8,14.3,-169.8],
    eat: [933,521,118,519,-24.4,-223.7,14.6,-177.3,12.0,-193.8,20.3,-194.8,19.6,-175.8],
    glasses: [1053,521,118,519,-24.4,-223.7,14.6,-177.3,12.0,-193.8,20.3,-194.8,16.1,-192.3],
  } },
};
for (const d of Object.values(FIG3D)) d.img = loadImg(d.src);
// Aktions-Posen auf die gerenderten Bilder abbilden; fehlt eine, bleibt die Figur in der nächstliegenden Haltung
const FIG3D_POSE = { reach: 'reach', pick: 'pick', pull: 'pull', eat: 'eat', glasses: 'glasses', think: 'think', yawn: 'yawn', dig: 'pick', pour: 'reach', rope: 'yawn', airguitar: 'talk0', belly: 'talk1', fly: 'wave' };
function fig3dOk(kind) { const d = FIG3D[kind]; return !!d && imgOk(d.img); }
function fig3dFrame(d, a, t) {
  const po = pose(a, t);
  if (po && po.mix > 0.35) {
    if (a.pose.kind === 'saber') return po.front < -1.85 ? 'saber0' : po.front < -1.3 ? 'saber1' : 'saber2';
    const n = FIG3D_POSE[a.pose.kind]; if (n && d.f[n]) return n;
  }
  // Schrittgeräusch fällt auf phase = 0, π – dann soll gerade ein Fuß aufsetzen (Bild 2 bzw. 6)
  if (a.walking) return 'walk' + ((Math.round(((a.phase || 0) + Math.PI / 2) / (Math.PI / 4)) % 8) + 8) % 8;
  if (a.talking) return talkArm(a, t) < -0.32 ? 'talk0' : 'talk1';
  if (gesture(a, t) > 0.45) return 'wave';
  return 'idle';
}
function fig3d(c, a, t) {
  const d = FIG3D[a.kind];
  if (!d || !hd(c) || !imgOk(d.img)) { a._fig = null; return false; }
  const f = d.f[fig3dFrame(d, a, t)] || d.f.idle, u = d.upp;
  c.drawImage(d.img, f[0], f[1], f[2], f[3], f[4], f[5], f[2] * u, f[3] * u);
  if (blinking(a, t)) for (const i of [8, 10]) { E(c, f[i], f[i + 1], 3.3, 3.6, '#eef2f6', 0); L(c, [f[i] - 3, f[i + 1], f[i] + 3, f[i + 1]], 1.6); }
  const po = pose(a, t);
  if (mouthOpen(a, t) || (po && po.chew && Math.floor(t / 140) % 2)) { const k = mouthK(a, t); E(c, f[6], f[7] + 1, 4.4 * k[0], 3.6 * k[1], '#7a2222', 1.6); }
  a._fig = f;
  return true;
}
for (const id of Object.keys(FIG3D)) { const drawn = CHAR[id]; CHAR[id] = (c, a, t) => { if (!fig3d(c, a, t)) drawn(c, a, t); }; }
