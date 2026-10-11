// ============================================================
//  Tentakel-Toast – Echtzeit-3D (Beta): alle Blender-Räume als echte 3D-Szenen
//  three.js rendert die aus Blender exportierten Räume (img/3d/<raum>.glb + <raum>.json, art/blender/echt3d_export.py)
//  mit Toon-Schattierung, Tusche-Konturen und Schattenwurf. Die Kamera ist dieselbe wie beim vorgerenderten Bild –
//  deshalb passen Laufwege, Hotspots und Figurengrößen der Spiel-Logik genau. Zustände (Falltür offen, Fahne am Mast …)
//  schalten Objekte nach Namen ein und aus, Pendel, Hebel, Kronleuchter, Apfelbaum und Clown bewegt das Spiel.
//  Bernard, Hoagie und Laverne sind voll beweglich: ihre Gelenke werden wie in Blender gestellt (figur_frames.py),
//  nur stufenlos – Gehen, Reden, Aufheben, Ziehen … – und sie federn mit der Cartoon-Mimik (js/mimik.js).
//  Räume werden erst beim ersten Besuch geladen; das Modul selbst erst, wenn „Echtzeit-3D“ an ist (js/echt3d.js).
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export let ready = false;
let kontextWeg = false;   // Grafikkontext vom Gerät entzogen (z. B. Konsole im Hintergrund): dann zurück zum vorgerenderten Bild
export function verloren() { return kontextWeg; }
const GW = 960, GH = 440;   // Spiel-Einheiten des Raumbilds
const INK = [0.04, 0.012, 0.07];
const V = '?v=' + (globalThis.TT_VER || 0);   // Versions-Anhang für Modelle und Raumdaten (Browser-Cache nach Updates)
const nm = o => ((o && o.userData && o.userData.name) || (o && o.name) || '').replace(/\.\d+$/, '');   // Originalname (der Loader entfernt Punkte)
let renderer, effect, GRAD, BASE = 'img/3d/', loader;
const rooms = {};   // id -> { scene, camera, sun, nodes, sprites, data, anim, ready, loading, failed }
const figs = {};    // id -> Figur (Helden mit Gelenken, Gäste im Hafen ohne)
const HELDEN = ['bernard', 'hoagie', 'laverne'];

// ---------- Materialien: Toon mit drei Stufen, Kontur wie Freestyle ----------
const matCache = new Map();
function toon(m, name, noLine) {
  noLine = noLine || (name && /Wedel|Zunge|Gabel|Meer|Wolke/.test(name));
  const key = m.uuid + (noLine ? 'n' : '');
  if (matCache.has(key)) return matCache.get(key);
  const glow = m.emissive && m.emissive.r + m.emissive.g + m.emissive.b > 0.02;
  const t = glow ? new THREE.MeshBasicMaterial({ color: m.map ? 0xffffff : m.color, map: m.map })
    : new THREE.MeshToonMaterial({ color: m.color, map: m.map, gradientMap: GRAD });
  t.side = m.side;
  t.userData.outlineParameters = { thickness: 0.0032, color: INK, alpha: 1, visible: !noLine };
  matCache.set(key, t);
  return t;
}
function prep(root, { cast = false, receive = true, ohne = null } = {}) {
  root.traverse(o => {
    if (!o.isMesh) return;
    const n0 = nm(o) || nm(o.parent), no = !!(ohne && (ohne.has(nm(o)) || ohne.has(nm(o.parent))));
    o.material = Array.isArray(o.material) ? o.material.map(m => toon(m, n0, no)) : toon(o.material, n0, no);
    o.castShadow = cast; o.receiveShadow = receive;
  });
}

// Statische Teile nach Material zusammenfassen (viel weniger Zeichenaufrufe)
function mergeStatic(root, isAnimated) {
  const groups = new Map(), drop = [];
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    for (let p = o; p; p = p.parent) if (isAnimated(nm(p))) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    const sig = o.material.uuid + '|' + Object.keys(g.attributes).sort().join(',') + '|' + (g.index ? 1 : 0) + '|' + o.castShadow;
    if (!groups.has(sig)) groups.set(sig, { mat: o.material, geos: [], cast: o.castShadow });
    groups.get(sig).geos.push(g); drop.push(o);
  });
  for (const o of drop) o.parent.remove(o);
  const out = new THREE.Group(); out.name = 'Statisch';
  for (const { mat, geos, cast } of groups.values()) {
    const g = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
    if (!g) continue;
    const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true; out.add(m);
  }
  return out;
}

// Teile unter einem Knoten (im Raum dieses Knotens) nach Material zusammenfassen; skip(o) lässt Unterbäume beweglich
const _m4 = new THREE.Matrix4();
function mergeUnder(node, skip = () => false, direct = false) {
  node.updateMatrixWorld(true);
  const inv = _m4.copy(node.matrixWorld).invert().clone(), groups = new Map(), drop = [];
  const visit = o => {
    for (const c of [...o.children]) {
      if (skip(c)) continue;
      if (c.isMesh && !Array.isArray(c.material) && !c.isSkinnedMesh) {
        const g = c.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld));
        const sig = c.material.uuid + '|' + Object.keys(g.attributes).sort().join(',') + '|' + (g.index ? 1 : 0);
        if (!groups.has(sig)) groups.set(sig, { mat: c.material, geos: [], cast: c.castShadow, rec: c.receiveShadow });
        groups.get(sig).geos.push(g); drop.push(c);
        if (c.children.length && !direct) visit(c);
      } else if (!direct && !c.isCamera && !c.isLight) visit(c);
    }
  };
  visit(node);
  for (const o of drop) { const kids = [...o.children]; o.parent.remove(o); for (const k of kids) node.attach(k); }
  for (const { mat, geos, cast, rec } of groups.values()) {
    const g = geos.length > 1 ? mergeGeometries(geos, false) : geos[0]; if (!g) continue;
    const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = rec; m.userData.merged = true; node.add(m);
  }
}
export function stats() { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries }; }
function find(root, name) { let r = null; root.traverse(o => { if (!r && nm(o) === name) r = o; }); return r; }
const bl = (x, y, z) => new THREE.Vector3(x, z, -y);   // Blender (z oben) -> glTF (y oben)
function himmel(top, unten) {
  const sky = document.createElement('canvas'); sky.width = 4; sky.height = 256;
  const sg = sky.getContext('2d'), lg = sg.createLinearGradient(0, 0, 0, 256);
  lg.addColorStop(0, top); lg.addColorStop(0.65, unten); lg.addColorStop(1, unten);
  sg.fillStyle = lg; sg.fillRect(0, 0, 4, 256);
  const tx = new THREE.CanvasTexture(sky); tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}

// ---------- Aufbau: Renderer und Figuren; Räume kommen beim ersten Besuch dazu ----------
export async function init(base = 'img/3d/') {
  BASE = base;
  // Renderer: erst mit voller Qualität, sonst sparsam (Xbox, ältere Grafikchips) – ohne Kantenglättung und Schatten
  let canvas = null, sparsam = false;
  for (const opt of [{ antialias: true, powerPreference: 'high-performance' }, { antialias: false, powerPreference: 'low-power' }]) {
    try {
      canvas = document.createElement('canvas');
      renderer = new THREE.WebGLRenderer({ canvas, preserveDrawingBuffer: true, alpha: false, failIfMajorPerformanceCaveat: false, ...opt });
      break;
    } catch (e) { console.warn('Echtzeit-3D: Renderer', opt, e); renderer = null; sparsam = true; }
  }
  if (!renderer) throw new Error('WebGL-Renderer ließ sich nicht starten');
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !sparsam && !/xbox/i.test(navigator.userAgent || '');
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); kontextWeg = true; console.warn('Echtzeit-3D: WebGL-Kontext verloren'); });
  effect = new OutlineEffect(renderer, { defaultThickness: 0.0032, defaultColor: INK, defaultAlpha: 1 });
  GRAD = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.RedFormat);
  GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true;
  loader = new GLTFLoader();
  const ids = [...HELDEN, 'guybrush', 'jack'];
  const glbs = await Promise.all(ids.map(n => loader.loadAsync(BASE + n + '.glb' + V)));
  ids.forEach((id, i) => addFig(id, glbs[i].scene, RIGS[id] || null));
  ready = true;
}

// Raum laden (einmal); bis er da ist, zeigt das Spiel das vorgerenderte Bild
export function hasRoom(id) {
  const r = rooms[id];
  if (r) { r.benutzt = performance.now(); return r.ready; }
  raeumeAuf(id);
  rooms[id] = { id, loading: true, ready: false, benutzt: performance.now() };
  (id === 'hafen' ? ladeHafen() : ladeRaum(id)).then(x => { Object.assign(rooms[id], x, { ready: true, loading: false }); },
    e => {
      console.error('Echtzeit-3D', id, e); rooms[id].failed = true;
      if (typeof note === 'function') note(`Echtzeit-3D: Raum „${id}“ ließ sich nicht laden (${String((e && e.message) || e).slice(0, 80)}) – dort bleibt das vorgerenderte Bild.`);
    });
  return false;
}
// Grafikspeicher schonen (Konsolen, Tablets): höchstens vier Räume geladen halten, den am längsten unbenutzten freigeben
const RAUM_MAX = 4;
function raeumeAuf(neu) {
  const geladen = Object.values(rooms).filter(r => r.ready && r.id !== neu && r.id !== letzterRaum);
  if (geladen.length < RAUM_MAX) return;
  geladen.sort((a, b) => (a.benutzt || 0) - (b.benutzt || 0));
  const R = geladen[0];
  for (const f of Object.values(figs)) if (f.holder.parent === R.scene) R.scene.remove(f.holder);   // Figuren gehören allen Räumen
  for (const k of karten.values()) if (k.mesh.parent === R.scene) R.scene.remove(k.mesh);
  R.scene.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    for (const m of [].concat(o.material || [])) { for (const v of Object.values(m)) if (v && v.isTexture && v !== GRAD) v.dispose(); m.dispose(); }
  });
  if (R.scene.background && R.scene.background.dispose) R.scene.background.dispose();
  delete rooms[R.id];
}
export function failed(id) { return !!(rooms[id] && rooms[id].failed); }

function grundlicht(scene, hell, dunkel, k = 1.15) { scene.add(new THREE.HemisphereLight(hell, dunkel, k)); }
function sonne(scene, dir, farbe, staerke, schatten) {
  const s = new THREE.DirectionalLight(farbe, staerke);
  s.position.copy(dir).multiplyScalar(-40).add(new THREE.Vector3(0, 0, -11));
  s.target.position.set(0, 0, -11); scene.add(s.target);
  if (schatten) {
    s.castShadow = true; s.shadow.mapSize.set(1024, 1024);
    Object.assign(s.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 120 });
    s.shadow.bias = -0.0006; s.shadow.normalBias = 0.02;
  }
  scene.add(s);
  return s;
}

// ---------- Requisiten: echte 3D-Modelle für Dinge, die im vorgerenderten Bild nur gezeichnet sind ----------
// boden: Spiel-Punkt auf dem Boden (x, y wie im Spiel); welt: Blender-Meter; wand: Bildpunkt auf einer Ebene in Tiefe d.
// Sichtbarkeit und Effekte kommen pro Bild aus js/echt3d.js (ctx.sprites['req_' + Schlüssel]).
export const REQUISITEN = {
  labor: { datei: 'req_labor', teile: {
    hamster: { wurzel: 'Req_Hamster', boden: [186, 362] },
    mumie: { wurzel: 'Req_Mumie', boden: [682, 344] },
    saber: { wurzel: 'Req_Saber', boden: [344, 336] },
    clawd: { wurzel: 'Req_Clawd', wand: [572, 168, 12.45] },
    absperrband: { wurzel: 'Req_Absperrband', welt: [1.83, 12.0, 1.18] },
  } },
};
export function hatRequisit(raum, key) { const r = rooms[raum]; return !!(r && r.ready && r.req && r.req[key]); }
function requisitenAufstellen(scene, cam, def, gltf) {
  const H = gltf.scene, out = {};
  prep(H, { cast: true, receive: true });
  H.updateMatrixWorld(true);
  for (const [key, t] of Object.entries(def.teile)) {
    const o = find(H, t.wurzel); if (!o) continue;
    const p = new THREE.Vector3();
    if (t.boden) toWorld(cam, t.boden[0], t.boden[1], p);
    else if (t.welt) p.copy(bl(...t.welt));
    else if (t.wand) {
      _n.set(t.wand[0] / GW * 2 - 1, 1 - t.wand[1] / GH * 2); ray.setFromCamera(_n, cam);
      ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), t.wand[2]), p);
    }
    scene.attach(o); o.position.copy(p);
    const teile = {}; o.traverse(c => { const n = nm(c); if (/^Req_(HamsterRad|HamsterTier|BandEnde|MumieAugen|SaberKlinge|Clawd)$/.test(n)) teile[n] = { o: c, q0: c.quaternion.clone(), p0: c.position.clone(), s0: c.scale.clone() }; });
    out[key] = { o, teile };
  }
  return out;
}
function requisitenBewegen(req, s, ctx) {
  for (const [key, r] of Object.entries(req)) {
    const st = ctx.sprites && ctx.sprites['req_' + key] ? ctx.sprites['req_' + key]() : {};
    r.o.visible = st.vis !== false;
    if (!r.o.visible) continue;
    const T = r.teile;
    if (T.Req_HamsterRad) T.Req_HamsterRad.o.quaternion.copy(T.Req_HamsterRad.q0).multiply(_q.setFromAxisAngle(_zA, -s * (st.schnell ? 14 : 5)));
    if (T.Req_HamsterTier) T.Req_HamsterTier.o.position.y = T.Req_HamsterTier.p0.y + Math.abs(Math.sin(s * (st.schnell ? 28 : 12))) * 0.012;
    if (T.Req_BandEnde) T.Req_BandEnde.o.quaternion.copy(T.Req_BandEnde.q0).multiply(_q.setFromAxisAngle(_zA, Math.sin(s * 3.1) * 0.25));
    if (T.Req_MumieAugen) T.Req_MumieAugen.o.position.x = T.Req_MumieAugen.p0.x + Math.sin(s * 0.7) * 0.025 * (Math.sin(s * 0.23) > 0 ? 1 : 0);
    if (T.Req_SaberKlinge) { const k = 1 + Math.sin(s * 40) * 0.04; T.Req_SaberKlinge.o.scale.set(T.Req_SaberKlinge.s0.x * k, T.Req_SaberKlinge.s0.y, T.Req_SaberKlinge.s0.z * k); }
    if (key === 'clawd') { r.o.position.y = (r.y0 = r.y0 ?? r.o.position.y) + Math.sin(s * 2.2) * 0.03 + (st.hops ? Math.abs(Math.sin(s * 9)) * 0.08 : 0); r.o.rotation.y = Math.sin(s * 0.9) * 0.2; }
  }
}

async function ladeRaum(id) {
  const reqDef = REQUISITEN[id];
  const [gltf, data, reqGltf] = await Promise.all([loader.loadAsync(BASE + id + '.glb' + V), fetch(BASE + id + '.json' + V).then(r => r.json()),
    reqDef ? loader.loadAsync(BASE + reqDef.datei + '.glb' + V).catch(e => { console.error('Echtzeit-3D Requisiten', id, e); return null; }) : null]);
  const scene = new THREE.Scene(), H = gltf.scene;
  const [hor, top] = data.himmel && data.himmel.length ? data.himmel : ['#3a2a50', '#140828'];
  scene.background = himmel(top, hor);
  const camera = gltf.cameras[0] || new THREE.PerspectiveCamera(29.6, GW / GH, 0.1, 400);
  camera.aspect = GW / GH; camera.updateProjectionMatrix();
  // Licht aus Blender: Sonnen als gerichtetes Licht (die stärkste wirft Schatten), Lampen als Punktlichter
  grundlicht(scene, new THREE.Color(hor).lerp(new THREE.Color(0xffffff), 0.55), new THREE.Color(0x2a1a30), 1.0);
  const suns = data.lichter.filter(l => l.typ === 'SUN').sort((a, b) => b.energie - a.energie);
  suns.forEach((l, i) => sonne(scene, bl(...l.richtung).normalize(), new THREE.Color(...l.farbe), Math.min(3.2, l.energie * 0.55), i === 0));
  if (!suns.length) sonne(scene, new THREE.Vector3(0.4, -0.8, -0.45).normalize(), 0xfff0e0, 1.6, true);
  for (const l of data.lichter.filter(l => l.typ !== 'SUN').sort((a, b) => b.energie - a.energie).slice(0, 8)) {
    const p = new THREE.PointLight(new THREE.Color(...l.farbe), l.energie * 0.035, l.weite || 9, 2);
    p.position.copy(bl(...l.ort)); scene.add(p);
  }
  // Teile, die Zustände oder Bewegung haben, bleiben eigene Objekte; der Rest wird zusammengefasst
  const beweglich = new Set();
  for (const [vis, hid] of Object.values(data.zustaende || {})) for (const n of [...vis, ...hid]) beweglich.add(n);
  for (const s of Object.values(data.sprites || {})) for (const n of s.teile) beweglich.add(n);
  prep(H, { cast: false, receive: true, ohne: new Set(data.ohneKontur || []) });
  H.traverse(o => { if (o.isMesh && beweglich.has(nm(o))) o.castShadow = true; });
  const extraRe = EXTRA_BEWEGLICH[id];
  const stat = mergeStatic(H, n => beweglich.has(n) || !!(extraRe && extraRe.test(n)));
  scene.add(H); scene.add(stat);
  sprungToastStufen(scene, id);
  const nodes = new Map();
  H.traverse(o => { const n = nm(o); if (beweglich.has(n)) { if (!nodes.has(n)) nodes.set(n, []); nodes.get(n).push(o); } });
  const sprites = {};
  H.updateMatrixWorld(true);
  for (const [k, s] of Object.entries(data.sprites || {})) {
    const o = find(H, s.wurzel); if (!o) continue;
    // Drehachse: Blickrichtung der Kamera, im Raum des Elternknotens (so pendelt alles in der Bildebene)
    const pq = new THREE.Quaternion(); if (o.parent) o.parent.getWorldQuaternion(pq);
    const achse = new THREE.Vector3(0, 0, -1).applyQuaternion(pq.invert()).normalize();
    sprites[k] = { o, q0: o.quaternion.clone(), s0: o.scale.clone(), achse };
  }
  const extra = RAUM_EXTRAS[id] ? RAUM_EXTRAS[id](scene, H) : null;
  H.updateMatrixWorld(true);
  const req = reqGltf ? requisitenAufstellen(scene, camera, reqDef, reqGltf) : null;
  const innen = INNENRAUM.has(id) ? raumSchliessen(scene, camera, id) : null;
  if (KRUMM[id]) krummBiegen(scene, KRUMM[id]);
  return { scene, camera, data, nodes, sprites, extra, req, krumm: KRUMM[id] || null, innen };
}

async function ladeHafen() {
  const hafen = await loader.loadAsync(BASE + 'hafen.glb' + V), scene = new THREE.Scene(), H = hafen.scene;
  scene.background = himmel('#3a8ad0', '#9ad8f0');
  grundlicht(scene, 0xdff2ff, 0x6a5a40, 1.15);   // wie in raum_build.py: Sonne (0.95, 0.15, 0.65), weiches Grundlicht
  const e = new THREE.Euler(0.95, 0.15, 0.65, 'ZYX'), d = new THREE.Vector3(0, 0, -1).applyEuler(e);
  sonne(scene, bl(d.x, d.y, d.z), 0xfff0d8, 2.4, true);
  const camera = hafen.cameras[0] || new THREE.PerspectiveCamera(29.6, GW / GH, 0.1, 400);
  camera.aspect = GW / GH; camera.updateProjectionMatrix();
  prep(H);
  const anim = { ship: find(H, 'Schiff'), snake: find(H, 'Schlange_Kopf'), sea: find(H, 'Meer'), crew: [], clouds: [], waves: [] };
  anim.shipQ = anim.ship.quaternion.clone(); anim.shipP = anim.ship.position.clone();
  if (anim.snake) anim.snakeQ = anim.snake.quaternion.clone();
  H.traverse(o => {
    const n = nm(o);
    if (/^Wolke\d+$/.test(n)) anim.clouds.push({ o, x0: o.position.x, k: 0.6 + (n.charCodeAt(5) % 5) * 0.12 });
    if (/^Welle\d+$/.test(n)) anim.waves.push({ o, y0: o.position.y, s0: o.scale.clone(), ph: Math.random() * 6.28 });
    if (/^S_Crew\d$|^S_Ausguck$/.test(n)) anim.crew.push({ o, y0: o.position.y, ph: (n.charCodeAt(n.length - 1) % 4) / 4 });
  });
  H.traverse(o => { if (o.isMesh) { const n = nm(o) || nm(o.parent); o.castShadow = /^(Fass|Kiste|Poller|Laterne|Lager|Dach|Kante|Seilrolle|Banane|Ananas|Mango|Wimpel)/.test(n); } });
  if (anim.ship) mergeUnder(anim.ship, c => /^S_Crew\d$|^S_Ausguck$/.test(nm(c)));
  for (const c of anim.crew) mergeUnder(c.o);
  const stat = mergeStatic(H, n => n === 'Schiff' || n === 'Schlange' || n === 'Meer' || /^Wolke|^Welle/.test(n));
  scene.add(H); scene.add(stat);
  if (anim.sea) { anim.sea.material = anim.sea.material.clone(); anim.sea.receiveShadow = true; anim.seaBase = anim.sea.geometry.attributes.position.array.slice(); }
  return { scene, camera, anim, nodes: new Map(), sprites: {}, data: {} };
}
function hafenAnim(anim, s) {   // Schiff schaukelt, Crew hüpft, Wolken ziehen, Wellen und Meer bewegen sich, die Anakonda pendelt
  if (anim.ship) {
    const roll = Math.sin(s * 0.85) * 0.022, pitch = Math.sin(s * 0.55 + 1) * 0.008;
    anim.ship.quaternion.copy(anim.shipQ).multiply(_q.setFromEuler(_e.set(roll, 0, pitch, 'XYZ')));
    anim.ship.position.set(anim.shipP.x, anim.shipP.y + Math.sin(s * 1.3) * 0.07, anim.shipP.z);
  }
  for (const c of anim.crew) c.o.position.y = c.y0 + Math.max(0, Math.sin((s / 0.92 + c.ph) * Math.PI * 2)) * 0.1;
  for (const c of anim.clouds) { let x = c.x0 + s * 0.6 * c.k; x = ((x + 90) % 180 + 180) % 180 - 90; c.o.position.x = x; }
  for (const wv of anim.waves) { const k = Math.sin(s * 1.6 + wv.ph); wv.o.position.y = wv.y0 + k * 0.05; wv.o.scale.set(wv.s0.x * (1 + 0.15 * k), wv.s0.y, wv.s0.z); }
  if (anim.snake) anim.snake.quaternion.copy(anim.snakeQ).multiply(_q.setFromEuler(_e.set(0, Math.sin(s * 1.4) * 0.1, Math.sin(s * 0.9) * 0.05)));
  if (anim.sea && anim.seaBase) {
    const pos = anim.sea.geometry.attributes.position, b = anim.seaBase, arr = pos.array;
    for (let i = 0; i < arr.length; i += 3) arr[i + 1] = b[i + 1] + Math.sin(b[i] * 0.35 + s * 1.2) * 0.05 + Math.sin(b[i + 2] * 0.27 - s * 0.9) * 0.06;
    pos.needsUpdate = true; anim.sea.geometry.computeVertexNormals();
  }
}

function addFig(id, root, rig) {
  prep(root, { cast: true, receive: true });
  const holder = new THREE.Group(); holder.name = 'Figur_' + id;
  // Wurzel ausrichten: die Figuren sind für die Kamera schon leicht gedreht exportiert – das macht hier die Blickrichtung
  const top = root.children.length === 1 ? root.children[0] : root;
  top.rotation.set(0, 0, 0); top.position.set(0, 0, 0);
  holder.add(root);
  const nodes = {}; root.traverse(o => { nodes[nm(o)] = o; });
  if (!rig) mergeUnder(top);
  else { const keep = [rig.mouth, ...rig.eyes]; for (const o of Object.values(nodes)) if (!o.isMesh && /^[A-Z]{1,2}R_|Rig$/.test(nm(o))) mergeUnder(o, c => keep.includes(nm(c)), true); }   // Augen und Mund bleiben beweglich
  for (const k of Object.keys(nodes)) delete nodes[k];
  root.traverse(o => { if (!o.userData.merged) nodes[nm(o)] = o; });
  const base = {}; for (const [k, o] of Object.entries(nodes)) base[k] = { q: o.quaternion.clone(), p: o.position.clone(), s: o.scale.clone() };
  figs[id] = { id, holder, root, top, nodes, base, rig, yaw: -0.56, walkPh: 0, last: null, blinkT: 2000 + Math.random() * 3000 };
}

// ---------- Gelenke der Helden (wie figur_rig.py / figur_frames.py, stufenlos) ----------
const RIGS = {
  bernard: { P: 'BR_', hz: 0.98, sole: 0.14, thigh: 0.43, shin: 0.41, stride: 0.26, knee: 0.75, abd: 0.06, mouth: 'RB_Mund', eyes: ['RB_PupilleL', 'RB_PupilleR'],
    rest: { tR: -0.12, tL: -0.12, kR: 0.24, kL: 0.24, lean: 0.11 },   // Nerd-Haltung wie im Original: Knie leicht eingeknickt, Oberkörper vorgebeugt
    gang: { eR: 0.35, eL: 0.35 }, zappel: 'glasses' },   // angewinkelte Arme beim Gehen; im Stand schiebt er ab und zu nervös die Brille hoch
  hoagie: { P: 'HR_', hz: 0.62, sole: 0.16, thigh: 0.24, shin: 0.22, stride: 0.5, knee: 0.9, abd: 0.24, mouth: 'RH_Mund', eyes: ['RH_AugeL', 'RH_AugeR', 'RH_PupilleL', 'RH_PupilleR'] },
  drfred: { P: 'FR_', hz: 0.62, sole: 0.10, thigh: 0.26, shin: 0.26, stride: 0.3, knee: 0.8, abd: 0.18, mouth: 'RDrFred_Mund', eyes: ['RF_PupilleL', 'RF_PupilleR'],
    rest: { lean: 0.08 }, gang: { eR: 0.3, eL: 0.3 } },   // der verrückte Professor: leicht vorgebeugt, Arme angewinkelt
  laverne: { P: 'LR_', hz: 0.72, sole: 0.10, thigh: 0.32, shin: 0.30, stride: 0.37, knee: 0.8, abd: 0.08, mouth: 'RL_Mund', eyes: ['RL_AugeL', 'RL_AugeR', 'RL_PupilleL', 'RL_PupilleR'] },
};
function pose(rig, kw) {
  const ab = rig.abd;
  return Object.assign({ aR: -0.12, aL: 0.12, eR: 0.12, eL: 0.12, xR: -ab, xL: ab, tR: 0, tL: 0, kR: 0, kL: 0, fR: 1, fL: 1, lean: 0, roll: 0 }, rig.rest || {}, kw);
}
const POSES = {   // Blender-Werte aus figur_frames.py
  talk0: { aR: -1.0, eR: 0.95, aL: 0.7, eL: 0.9, lean: 0.08, roll: 0.06 },
  talk1: { aR: -0.2, eR: 0.55, aL: 1.25, eL: 0.75, lean: -0.04, roll: -0.06 },
  reach: { aR: -1.35, eR: 0.15 }, pick: { aR: -0.9, eR: 0.2, aL: 0.3, tR: -0.75, tL: -0.75, kR: 1.5, kL: 1.5, lean: 0.32 },
  pull: { aR: -1.1, eR: 0.5, lean: -0.1, tR: -0.25, tL: -0.25, kR: 0.5, kL: 0.5 }, wave: { xR: -2.45, aR: 0.15, eR: 0.3 },
  pour: { aR: -1.25, eR: 0.7, aL: -1.05, eL: 0.6, lean: 0.06 }, eat: { aR: -1.85, eR: 0.0, xR: 0.74 }, think: { aR: -1.61, eR: 0.15, xR: 0.89 },
  glasses: { aR: -1.75, eR: 0.1, xR: 0.6 }, yawn: { aR: -2.6, eR: 0.3, aL: 2.6, eL: 0.3, lean: -0.08 },
  dig0: { aR: -0.95, eR: 0.5, aL: -0.8, eL: 0.6, tR: -0.22, tL: -0.22, kR: 0.45, kL: 0.45, lean: 0.06 },
  dig1: { aR: -0.05, eR: 0.5, aL: 0.1, eL: 0.6, tR: -0.52, tL: -0.52, kR: 1.05, kL: 1.05, lean: 0.06 },
  rope0: { aR: -1.9, eR: 0.4, aL: -3.0, eL: 0.4, xL: 0.3, tR: -0.2, tL: -0.2, kR: 0.4, kL: 0.4 },
  rope1: { aR: -3.0, eR: 0.4, xR: -0.3, aL: -1.9, eL: 0.4, tR: -0.2, tL: -0.2, kR: 0.4, kL: 0.4 },
  // Cartoon-Mimik als Ganzkörper-Geste, Tom-&-Jerry-überzeichnet: Schreck reißt die Arme weit über den Kopf
  // und lehnt zurück, Wut ballt beide Fäuste vor der Brust und drängt vor, Freude jubelt mit V-Armen, Staunen
  // breitet die Arme aus, Ekel wedelt mit der Hand vor der Nase (0/1-Posen pendeln im Sekundentakt)
  schreck: { xR: -1.15, aR: -2.75, eR: 0.55, xL: 1.15, aL: 2.75, eL: 0.55, lean: -0.2 },
  wut: { aR: -1.15, eR: 1.85, aL: 1.15, eL: 1.85, xR: -0.25, xL: 0.25, lean: 0.22 },
  freude: { xR: -2.8, aR: 0.25, eR: 0.1, xL: 2.8, aL: -0.25, eL: 0.1, lean: -0.08 },
  staunen: { xR: -1.5, aR: -0.5, eR: 0.35, xL: 1.5, aL: 0.5, eL: 0.35, lean: -0.1 },
  ekel0: { xR: -0.8, aR: -2.3, eR: 1.3, lean: -0.12 },
  ekel1: { xR: -0.95, aR: -2.55, eR: 0.9, lean: -0.12 },
  peinlich: { aR: -1.9, eR: 1.5, xR: 0.5, lean: 0.06 },
  // Schwindel nach dem Absturz: Arme baumeln, der Oberkörper eiert im Kreis, die Knie wackeln
  schwindel0: { xR: -0.5, aR: 0.35, eR: 0.2, xL: 0.5, aL: -0.35, eL: 0.2, kR: 0.3, kL: 0.1, lean: 0.14, roll: 0.16 },
  schwindel1: { xR: -0.3, aR: 0.2, eR: 0.3, xL: 0.3, aL: -0.2, eL: 0.3, kR: 0.1, kL: 0.3, lean: -0.06, roll: -0.16 },
};
function mix(a, b, k) { const o = {}; for (const key in a) o[key] = typeof a[key] === 'number' ? a[key] + (b[key] - a[key]) * k : a[key]; return o; }
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
function setRot(fig, name, x, y, z) {   // Blender-Euler XYZ im Blender-Raum -> Knoten im glTF-Raum
  const o = fig.nodes[name]; if (!o) return;
  _q.setFromEuler(_e.set(x, y, z, 'ZYX'));
  o.quaternion.set(_q.x, _q.z, -_q.y, _q.w);
}
function applyPose(fig, p) {
  const r = fig.rig, P = r.P;
  for (const k of 'RL') {
    const t = p['t' + k], kn = p['k' + k], f = p['f' + k];
    setRot(fig, `${P}Hip${k}`, 0, t, 0); setRot(fig, `${P}Knie${k}`, 0, kn, 0); setRot(fig, `${P}Knoechel${k}`, 0, -(t + kn) * f, 0);
    setRot(fig, `${P}Schulter${k}`, p['x' + k], p['a' + k], 0); setRot(fig, `${P}Ellbogen${k}`, 0, -p['e' + k], 0);
  }
  setRot(fig, `${P}Torso`, p.roll, p.lean, 0);
  const drop = Math.min(...['R', 'L'].map(k => r.hz - r.sole - r.thigh * Math.cos(p['t' + k]) - r.shin * Math.cos(p['t' + k] + p['k' + k])));
  const body = fig.nodes[`${P}Body`]; if (body) body.position.set(0, p.ground === false ? 0 : -drop, 0);
}
function walkPose(r, ph) {
  const p = walkPoseRoh(r, ph);
  if (r.gang) for (const k in r.gang) p[k] += r.gang[k];
  return p;
}
function walkPoseRoh(r, ph) {
  const s = Math.sin(ph), c = Math.cos(ph), st = r.stride, kn = r.knee;
  return pose(r, { tR: -st * s, tL: st * s, kR: Math.max(0, c) * kn, kL: Math.max(0, -c) * kn, fR: 1 - 0.4 * Math.max(0, c), fL: 1 - 0.4 * Math.max(0, -c),
    aR: -0.12 + 0.4 * s, aL: 0.12 - 0.4 * s, eR: 0.12 + Math.max(0, -s) * 0.5, eL: 0.12 + Math.max(0, s) * 0.5, lean: 0.035 + (r.rest ? r.rest.lean || 0 : 0) });
}

// ---------- Spiel-Koordinaten <-> Welt ----------
const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _v = new THREE.Vector3(), _n = new THREE.Vector2(), _w = new THREE.Vector3();
function toWorld(camera, x, y, out) {
  _n.set(x / GW * 2 - 1, 1 - y / GH * 2);
  ray.setFromCamera(_n, camera);
  return ray.ray.intersectPlane(ground, out) || out.set(0, 0, -10);
}
function unitsPerMeter(camera, p) {   // Spiel-Einheiten pro Meter Höhe an dieser Stelle (für Hüpfer aus der Mimik)
  const a = _w.copy(p).project(camera).y, b = _v.set(p.x, p.y + 1, p.z).project(camera).y;
  return Math.abs(b - a) * GH / 2;
}

// Figuren, die die 3D-Szene selbst zeigt: die Helden überall (außer beim Klettern), die Gäste im Hafen
// Nebenfiguren mit 3D-Modell: werden erst geladen, wenn sie das erste Mal in einem 3D-Raum stehen
const SPAETER = new Set(['drfred', 'sam', 'max']), laedt = new Set();
function figurLaden(kind) {
  if (laedt.has(kind)) return;
  laedt.add(kind);
  loader.loadAsync(BASE + kind + '.glb' + V).then(g => addFig(kind, g.scene, RIGS[kind] || null), e => console.error('Echtzeit-3D Figur', kind, e));
}
export function owns(a, roomId) {
  const f = figs[a.kind];
  if (!f && SPAETER.has(a.kind)) figurLaden(a.kind);
  if (!f || !rooms[roomId] || !rooms[roomId].ready || a.climb) return false;
  return f.rig || SPAETER.has(a.kind) ? true : roomId === 'hafen';
}

// ---------- Kamera-Choreografie: damit das echte 3D zur Geltung kommt ----------
// Anfahrt beim Betreten (von weiter hinten, rechts und unten heran), echter Perspektiv-Zoom im Gespräch
// (Dolly statt flacher 2D-Skalierung – nahe Teile wandern weiter als ferne), sanfter Parallax-Schwung im Stand
// und ein Kamera-Ruck, wenn eine Figur den wilden Schreck-Take macht. Danach sitzt die Kamera wieder exakt
// auf der Blender-Pose, sodass Hotspots und Laufwege pixelgenau stimmen.
let letzterRaum = null;
const _fw = new THREE.Vector3(), _rt = new THREE.Vector3(), _up = new THREE.Vector3(), _an = new THREE.Vector3(), _ab = new THREE.Vector3(), _yA = new THREE.Vector3(0, 1, 0), _m = new THREE.Matrix4();
function kameraLoesen(R) {   // einmalig: Kamera aus ihrem glTF-Knoten lösen (World-Transform backen) und Home-Pose sichern
  const c = R.camera;
  if (c.parent) {
    c.position.setFromMatrixPosition(c.matrixWorld);
    c.quaternion.setFromRotationMatrix(c.matrixWorld);
    c.parent.remove(c);
    R.scene.add(c);
  }
  R.home = c.clone();
  R.home.aspect = c.aspect; R.home.updateProjectionMatrix();
  R.phase = (R.id || 'x').charCodeAt(0) % 7;
}
function kameraFahren(R, t, actors) {
  const cam = R.camera, home = R.home;
  cam.position.copy(home.position);
  cam.quaternion.copy(home.quaternion);
  if (letzterRaum !== R.id) { letzterRaum = R.id; R.sweepT0 = t; }
  _fw.set(0, 0, -1).applyQuaternion(home.quaternion);
  _rt.set(1, 0, 0).applyQuaternion(home.quaternion);
  _up.set(0, 1, 0).applyQuaternion(home.quaternion);
  const k = (t - R.sweepT0) / 1250;
  if (k < 1) {   // Anfahrt: weich heranfahren (ease-out), leicht aus schräg unten rechts
    const e = 1 - Math.pow(1 - k, 3);
    cam.position.addScaledVector(_fw, -(1 - e) * 1.15).addScaledVector(_rt, (1 - e) * 0.52).addScaledVector(_up, -(1 - e) * 0.26);
    cam.quaternion.multiply(_q.setFromAxisAngle(_yA, (1 - e) * 0.045));
  }
  const g = typeof G !== 'undefined' && G && G.cam ? G.cam : null;   // Gespräch: echter Dolly-Zoom zur Dialogkamera
  if (g && g.z > 1.001) {
    toWorld(home, g.x, 400, _an);
    _ab.copy(cam.position).sub(_an).divideScalar(g.z);
    cam.position.copy(_an).add(_ab);
  }
  let schreck = 0;   // Ruck beim wilden Take: kurzes Zurückzucken der Kamera
  for (const a of actors) { const m = a.mimik; if (m && m.kind === 'schreck') schreck = Math.max(schreck, 1 - Math.min(1, Math.max(0, (t - m.t0) / 700))); }
  if (schreck > 0) cam.position.addScaledVector(_fw, -0.09 * schreck).addScaledVector(_rt, Math.sin(t * 0.09) * 0.02 * schreck);
  cam.position.addScaledVector(_rt, Math.sin(t * 0.00019 + R.phase) * 0.011).addScaledVector(_up, Math.sin(t * 0.00013 + R.phase * 2) * 0.008);   // Parallax-Schwung im Stand
  if (typeof G !== 'undefined' && G.inIntro) cam.position.addScaledVector(_rt, Math.sin(t * 0.00021) * 0.3).addScaledVector(_up, 0.05 + Math.sin(t * 0.00016) * 0.05);   // Vorspann: langsame Kinofahrt

  // freie Kamera: 360° um den Raum, dazu neigen und zoomen – um einen Zielpunkt in der Raummitte
  const o = R.orbit;
  if (o && (o.zurueck || Math.abs(o.yaw) > 1e-4 || Math.abs(o.pitch) > 1e-4 || Math.abs(o.dist) > 1e-4) && R.kT == null) R.kT = t;
  if (o && (o.zurueck || Math.abs(o.yaw) > 1e-4 || Math.abs(o.pitch) > 1e-4 || Math.abs(o.dist) > 1e-4)) {
    if (o.zurueck) {
      if (o.rueckT0 == null) { o.rueckT0 = t; o.start = { yaw: o.yaw, pitch: o.pitch, dist: o.dist, w: o.w || 0 }; }
      const k = Math.min(1, (t - o.rueckT0) / 650), e = 1 - Math.pow(1 - k, 3);
      o.yaw = o.start.yaw * (1 - e); o.pitch = o.start.pitch * (1 - e); o.dist = o.start.dist * (1 - e); o.w = o.start.w * (1 - e);
      if (k >= 1) { o.yaw = o.pitch = o.dist = o.w = 0; o.zurueck = false; o.rueckT0 = null; }
    } else o.w = Math.min(1, (o.w || 0) + Math.min(100, t - (R.kT || t)) / 550);   // Übergang in ~0,5 s, unabhängig von der Bildrate
    if (!R.zielHome) { R.zielHome = toWorld(R.home, 480, 300, new THREE.Vector3()); R.ziel = R.zielHome.clone(); R.basis = R.home.position.clone().sub(R.zielHome); R.basisLen = Math.max(2, R.basis.length()); }
    // Folgekamera wie in Psychonauts: der Drehpunkt gleitet zur gesteuerten Figur (auf Brusthöhe) und folgt ihr
    R.ziel.copy(R.zielHome);
    if (R.fokus) { _an.copy(R.fokus); R.ziel.lerp(_an, 0.85 * (o.w || 0)); }
    const pitchAxis = _rt.set(1, 0, 0).applyQuaternion(R.home.quaternion).applyAxisAngle(_yA, o.yaw);
    const ran = 1 - 0.55 * (o.w || 0) * Math.min(1, Math.abs(o.yaw) / 1.1);   // je weiter gedreht, desto näher an die Figur – sonst stünde die Kamera vor der Seitenwand
    _ab.copy(R.basis).applyAxisAngle(_yA, o.yaw).applyAxisAngle(pitchAxis, o.pitch)
      .multiplyScalar(Math.max(0.3, ran + o.dist / R.basisLen));
    cam.position.copy(R.ziel).add(_ab);
    if (cam.position.y < 0.45) cam.position.y = 0.45;
    if (R.innen && R.fokus) {   // Innenräume: Third-Person-Kamera wie in Psychonauts 2 / Super Mario 64 – hinter der Figur, im Raum
      const I = R.innen, m = 0.4, w = Math.min(1, o.w || 0), dtk = Math.min(100, t - (R.kT || t));
      const posD = new THREE.Vector3(), zielD = new THREE.Vector3();
      const gp = gespraechsPartner(R);
      if (gp) {   // Gespräch: seitlich auf beide Sprecher, Kamera auf der Raumseite zur Vorderwand
        const mid = gp.a.clone().add(gp.b).multiplyScalar(0.5), d = gp.b.clone().sub(gp.a); d.y = 0;
        const len = Math.max(0.6, d.length()); d.normalize();
        const n = new THREE.Vector3(-d.z, 0, d.x); if (n.z < 0) n.negate();
        posD.copy(mid).addScaledVector(n, Math.max(5.0, len * 1.4 + 3.4)); posD.y = Math.min(I.y1 - m, 2.05);
        zielD.copy(mid); zielD.y = 1.35;
      } else {
        const weite = weiteAuto(o), hoch = Math.max(0.7, Math.min(I.y1 - m, 2.7, 2.3 + o.pitch * 3));
        posD.set(0, hoch, weite).applyAxisAngle(_yA, o.yaw).add(R.fokus);
        zielD.copy(R.fokus);
      }
      posD.set(Math.max(I.x0 + m, Math.min(I.x1 - m, posD.x)), posD.y, Math.max(I.z0 + m, Math.min(I.z1 - m, posD.z)));   // an den Wänden entlang statt hindurch
      // Kameraarm mit Kollision: steht etwas zwischen Figur und Kamera (Wand, Decke, Rohre, Möbel), rückt sie davor.
      // Ist der Blick so stark verstellt, sucht die Auto-Kamera seitlich einen freien Winkel und schwenkt dorthin.
      R.armN = (R.armN || 0) + 1;
      if (R.armN % 3 === 0 || !R.armFrei) {
        R.armFrei = armFrei(R, zielD, posD);
        // wirksame Entfernung: Raumgrenze (schon in posD) und Hindernisse; zu nah = Blick verstellt
        const wirk = Math.min(posD.distanceTo(zielD), R.armFrei), wunsch = weiteAuto(o);
        if (!gp && autoKamera && wirk < wunsch * 0.6 && R.armN % 12 === 0 && performance.now() - (R.handT || 0) > 2500) {
          const probe = y => {
            const test = new THREE.Vector3(0, posD.y - R.fokus.y, wunsch).applyAxisAngle(_yA, y).add(R.fokus);
            test.set(Math.max(I.x0 + m, Math.min(I.x1 - m, test.x)), test.y, Math.max(I.z0 + m, Math.min(I.z1 - m, test.z)));
            return Math.min(test.distanceTo(zielD), armFrei(R, zielD, test));
          };
          let best = o.yaw, bestL = wirk;
          for (const dy of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.6, -2.6]) {
            const y = o.yaw + dy, l = probe(y);
            if (l > bestL + 0.4) { bestL = l; best = y; }
          }
          R.yawZiel = best;
        }
      }
      if (R.yawZiel != null && !gp && autoKamera) { o.yaw += (R.yawZiel - o.yaw) * Math.min(1, dtk / 700); if (Math.abs(R.yawZiel - o.yaw) < 0.02) R.yawZiel = null; }
      if (R.armFrei && posD.distanceTo(zielD) > R.armFrei) posD.sub(zielD).setLength(R.armFrei).add(zielD);
      if (!R.glatt) R.glatt = { p: posD.clone(), z: zielD.clone() };
      const k = Math.min(1, dtk / (gp ? 420 : 260));
      R.glatt.p.lerp(posD, k); R.glatt.z.lerp(zielD, k);
      cam.position.copy(home.position).lerp(R.glatt.p, w);
      R.ziel.copy(R.zielHome).lerp(R.glatt.z, w);
    }
    cam.quaternion.setFromRotationMatrix(_m.lookAt(cam.position, R.ziel, _yA));
  }
  R.kT = t;
}

const armRay = new THREE.Raycaster();
const weiteAuto = o => Math.max(2.2, 6.2 * (1 + o.dist / 6));
function armFrei(R, von, bis) {   // freie Länge des Kameraarms von der Figur zur Kamera (mindestens 2 m)
  const dir = bis.clone().sub(von), lang = dir.length();
  if (lang < 0.4) return lang;
  dir.divideScalar(lang); armRay.set(von, dir); armRay.far = lang;
  for (const h of armRay.intersectObjects(R.scene.children, true)) {
    let ok = h.distance > 0.35;
    for (let q = h.object; q && ok; q = q.parent) if (q.visible === false || (q.name || '').startsWith('Figur_')) ok = false;
    if (ok) return Math.max(2.0, h.distance - 0.3);
  }
  return lang;
}
// Gesprächspartner der gesteuerten Figur: wer gerade spricht (oder im Dialog steht), im selben Raum
function gespraechsPartner(R) {
  if (typeof G === 'undefined' || !G.state || typeof curId !== 'function') return null;
  const ich = typeof ACT !== 'undefined' && ACT[curId()]; if (!ich || ich.room !== R.id) return null;
  const sp = G.speech && G.speech.a;
  let anderer = sp && sp !== ich && sp.room === R.id && sp.visible ? sp : null;
  if (!anderer && G.dialog && R.letzterPartner && G.t - R.letzterPartner.t < 30000) anderer = R.letzterPartner.a;
  if (!anderer && R.letzterPartner && G.speech && G.speech.a === ich && G.t - R.letzterPartner.t < 4000) anderer = R.letzterPartner.a;
  if (!anderer) return null;
  if (sp === anderer) R.letzterPartner = { a: anderer, t: G.t };
  return { a: toWorld(R.home, ich.x, ich.y, new THREE.Vector3()), b: toWorld(R.home, anderer.x, anderer.y, new THREE.Vector3()) };
}
// Auto-Kamera (Innenräume): an = Kamera hinter der Figur, aus = klassische Bühnenansicht (Taste C, RS-Klick)
let autoKamera = true;
export function autoKameraAn() { return autoKamera; }
export function autoKameraUmschalten() { autoKamera = !autoKamera; const o = orbit(letzterRaum); if (!autoKamera && o) { o.zurueck = true; o.rueckT0 = null; } return autoKamera; }
// Bildpunkt (Szenen-Koordinaten der aktuellen Kamera) für einen Punkt in Kopfhöhe – Sprechblasen folgen so jeder Kamera
export function bildVonSpiel(gx, gy, id) {   // Spiel-Punkt (Bühnenansicht) -> Bildpunkt der aktuellen Kamera, für das Steuerkreuz
  const R = rooms[id || letzterRaum]; if (!R || !R.ready || !R.home || !freiAktiv()) return null;
  _n.set(gx / GW * 2 - 1, 1 - gy / GH * 2); ray.setFromCamera(_n, R.home);
  let p = null;
  for (const h of ray.intersectObjects(R.scene.children, true)) {
    let ok = true;
    for (let q = h.object; q && ok; q = q.parent) if (q.visible === false || (q.name || '').startsWith('Figur_')) ok = false;
    if (ok) { p = h.point.clone(); break; }
  }
  if (!p) return null;
  p.project(R.camera);
  if (p.z > 1 || Math.abs(p.x) > 1.05 || Math.abs(p.y) > 1.05) return null;
  return [(p.x + 1) / 2 * GW, (1 - p.y) / 2 * GH];
}
export function kopfPunkt(gx, gy, hoehePx, id) {
  const R = rooms[id || letzterRaum]; if (!R || !R.ready || !R.home || !freiAktiv()) return null;
  const p = toWorld(R.home, gx, gy, new THREE.Vector3()), upm = unitsPerMeter(R.home, p);
  p.y += hoehePx / upm;
  p.project(R.camera);
  if (p.z > 1) return null;   // hinter der Kamera
  return [(p.x + 1) / 2 * GW, (1 - p.y) / 2 * GH];
}

// ---------- Freie Kamera: Steuerung und 3D-Picking ----------
function orbit(id) { const R = rooms[id]; if (!R) return null; return R.orbit || (R.orbit = { yaw: 0, pitch: 0, dist: 0, zurueck: false, rueckT0: null }); }
export function freiAktiv() { const R = rooms[letzterRaum]; const o = R && R.orbit; return !!(o && (Math.abs(o.yaw) > 2e-3 || Math.abs(o.pitch) > 2e-3 || Math.abs(o.dist) > 2e-3)); }
export function freiDreh(dx, dy, id) {
  const o = orbit(id || letzterRaum); if (!o) return;
  const R0 = rooms[id || letzterRaum]; if (R0) { R0.handT = performance.now(); R0.yawZiel = null; }
  o.zurueck = false; o.rueckT0 = null;
  o.yaw = ((o.yaw + dx + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  o.pitch = Math.max(-1.35, Math.min(1.35, o.pitch + dy));
}
export function freiZoom(d, id) {
  const o = orbit(id || letzterRaum); if (!o) return;
  o.zurueck = false; o.rueckT0 = null;
  o.dist = Math.max(-2.2, Math.min(7, o.dist + d));
}
export function freiZurueck(id) { const o = orbit(id || letzterRaum); if (o && (o.yaw || o.pitch || o.dist)) { o.zurueck = true; o.rueckT0 = null; } }
// Klick in der freien Kamera: Strahl durchs Bild schneidet Raum oder Boden – der Trefferpunkt zurück in Spiel-Koordinaten
const _pickV = new THREE.Vector3();
export function pick(gx, gy, id) {
  const R = rooms[id || letzterRaum]; if (!R || !R.ready || !R.home) return null;
  _n.set(gx / GW * 2 - 1, 1 - gy / GH * 2);
  ray.setFromCamera(_n, R.camera);
  let punkt = null, dist = 1e9;
  const boden = ray.ray.intersectPlane(ground, _pickV.clone());
  if (boden) { punkt = boden.clone(); dist = boden.distanceTo(R.camera.position); }
  const treffer = ray.intersectObjects(R.scene.children, true);
  for (const h of treffer) {
    let sichtbar = true;
    for (let k = h.object; k; k = k.parent) if (k.visible === false) { sichtbar = false; break; }
    if (sichtbar && h.distance < dist) { punkt = h.point.clone(); dist = h.distance; break; }
  }
  if (!punkt) return null;
  if (R.krumm) entbiegen(R.krumm, punkt.clone(), punkt);
  punkt.project(R.home);
  return { x: (punkt.x + 1) / 2 * GW, y: (1 - punkt.y) / 2 * GH };
}

// ---------- Geschlossene Räume wie in Super Mario 64 ----------
// Die Räume sind als Bühnenbild gebaut: offen nach vorn, teils auch zur Seite. Beim Laden misst die Szene sich mit
// Tastrahlen selbst aus (Rückwand, Seitenwände, Decke) und ergänzt, was fehlt: Vorderwand, Seitenwände, Decke und
// einen durchgehenden Boden, in den Stoffen der vorhandenen Wände. Die neuen Flächen sind nur von innen sichtbar –
// die klassische Spielkamera vorn draußen blickt durch die Vorderwand hindurch, die frei gedrehte Kamera bleibt im
// Raum (kameraFahren) und sieht ringsum geschlossene Wände. Die Lauffläche reicht im Echtzeit-3D über den ganzen Boden.
const INNENRAUM = new Set(['lobby', 'stockwerk', 'dachboden', 'keller', 'uhrwerk', 'labor', 'konferenz', 'gasthaus', 'vorraum', 'thron', 'testkammer']);
const VORNE_Z = -2.6;   // Vorderwand (three.js-z): zwischen der Spielkamera (z = 0) und dem vorderen Bodenrand
function raumSchliessen(scene, cam, id) {
  scene.updateMatrixWorld(true);
  const C = toWorld(cam, 480, 392, new THREE.Vector3()), tast = new THREE.Raycaster(), hits = [];
  const strahl = (o, d) => {
    tast.set(o, d); tast.far = 30;
    for (const h of tast.intersectObjects(scene.children, true)) {
      let ok = h.object.visible !== false;
      for (let q = h.object; q && ok; q = q.parent) if (q.visible === false) ok = false;
      if (ok && h.distance > 0.3) return h;
    }
    return null;
  };
  const messen = (dir, quer) => {   // 9 Strahlen über Möbelhöhe, Median der Treffer
    const r = [];
    for (const hgt of [2.4, 3.0, 3.6]) for (const q of [-2, 0, 2]) {
      const o = C.clone().add(new THREE.Vector3(0, hgt, 0)).addScaledVector(quer, q), h = strahl(o, dir);
      if (h) r.push(h);
    }
    if (r.length < 4) return null;
    r.sort((a, b) => a.distance - b.distance);
    return r[Math.floor(r.length / 2)];
  };
  const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
  const hinten = messen(new THREE.Vector3(0, 0, -1), X), links = messen(new THREE.Vector3(-1, 0, 0), Z), rechts = messen(new THREE.Vector3(1, 0, 0), Z);
  if (!hinten) return null;   // ohne Rückwand ist es kein Innenraum
  const oben = strahl(C.clone().add(new THREE.Vector3(0, 0.5, 0)), new THREE.Vector3(0, 1, 0));
  const z0 = C.z - hinten.distance + 0.02, x0 = links ? C.x - links.distance + 0.02 : -10.5, x1 = rechts ? C.x + rechts.distance - 0.02 : 10.5;
  const y1 = oben ? 0.5 + oben.distance - 0.02 : Math.max(4.6, 0);
  const z1 = VORNE_Z;
  // Stoffe: Wand von der Rückwand, Boden: häufigster Stoff unter fünf Tastpunkten
  const wandMat = (Array.isArray(hinten.object.material) ? hinten.object.material[0] : hinten.object.material);
  const zaehl = new Map();
  for (const [dx, dz] of [[-4, 0], [4, 0], [0, -1.5], [-2, 1], [2, 1]]) {
    const h = strahl(C.clone().add(new THREE.Vector3(dx, 1.2, dz)), new THREE.Vector3(0, -1, 0));
    if (h && h.point.y < 0.15) { const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material; zaehl.set(m, (zaehl.get(m) || 0) + 1); }
  }
  const bodenMat = [...zaehl.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0])[0] || wandMat;
  const innenStoff = (m, dunkler) => {
    const n = m.clone(); n.side = THREE.FrontSide;
    if (dunkler && n.color) n.color = n.color.clone().multiplyScalar(dunkler);
    n.userData.outlineParameters = { thickness: 0.003, color: INK, alpha: 1, visible: false };
    return n;
  };
  const W = innenStoff(wandMat), B = innenStoff(bodenMat), D = innenStoff(wandMat, 0.55);
  const huelle = new THREE.Group(); huelle.name = 'Raumhuelle';
  const flaeche = (w, h, mat, pos, rotY, rotX = 0) => {   // Ebene mit Innenseite zum Raum, Kacheln im Meter-Maßstab
    const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * 0.4, uv.getY(i) * h * 0.4);
    const m = new THREE.Mesh(g, mat); m.position.copy(pos); m.rotation.set(rotX, rotY, 0, 'YXZ'); m.receiveShadow = true; huelle.add(m);
    return m;
  };
  const bx = (x0 + x1) / 2, bz = (z0 + z1) / 2, bw = x1 - x0, bd = z1 - z0;
  flaeche(bw, y1, W, new THREE.Vector3(bx, y1 / 2, z1), Math.PI);   // Vorderwand, schaut nach hinten in den Raum
  if (!links) flaeche(bd, y1, W, new THREE.Vector3(x0, y1 / 2, bz), Math.PI / 2);
  if (!rechts) flaeche(bd, y1, W, new THREE.Vector3(x1, y1 / 2, bz), -Math.PI / 2);
  if (!oben) flaeche(bw, bd, D, new THREE.Vector3(bx, y1, bz), 0, Math.PI / 2);   // Decke, schaut nach unten
  // Boden nur vor dem vorhandenen ergänzen (Abgründe und Treppenlöcher bleiben offen): vordere Bodenkante abtasten
  let zKante = z1;
  for (let z = C.z; z < z1; z += 0.5) {
    let bedeckt = false;
    for (const x of [-6, -3, 0, 3, 6]) { const h = strahl(new THREE.Vector3(x, 1.2, z), new THREE.Vector3(0, -1, 0)); if (h && Math.abs(h.point.y) < 0.2) { bedeckt = true; break; } }
    if (!bedeckt) { zKante = z - 0.25; break; }
  }
  if (zKante < z1 - 0.05) flaeche(bw, z1 - zKante, B, new THREE.Vector3(bx, -0.012, (zKante + z1) / 2), 0, -Math.PI / 2);
  scene.add(huelle);
  const deko = vorderwandDeko(id, x0, x1, z1, y1);
  scene.add(deko);
  return { x0, x1, z0, z1, y1, deko };
}
// Möbel und Dinge an der Vorderwand, damit die Rückseite des Raums nicht leer ist (je Raum ein Thema).
// Nur bei gedrehter Kamera sichtbar – in der Bühnenansicht stünden sie sonst vor der Kamera.
function vorderwandDeko(id, x0, x1, z, y1) {
  const g = new THREE.Group(); g.name = 'Vorderwanddeko';
  const M = c => toonMat(c), holz = M(0x6a4428), holzD = M(0x4a2e1a), metall = M(0x8a92a8);
  const box = (w, h, d, mat, x, y, dz = 0, rot = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z - d / 2 - 0.02 - dz); b.rotation.y = rot; b.castShadow = b.receiveShadow = true; g.add(b); return b; };
  const zyl = (r0, r1, h, mat, x, y, dz) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 14), mat); c.position.set(x, y, z - dz); c.castShadow = true; g.add(c); return c; };
  const kugel = (r, mat, x, y, dz) => { const k = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat); k.position.set(x, y, z - dz); g.add(k); return k; };
  const bild = (x, y, w, h, farbe) => { box(w + 0.12, h + 0.12, 0.05, M(0xc8a04a), x, y); box(w, h, 0.03, M(farbe), x, y, 0.02); };
  const glas = [0x5aff8a, 0xff5ab8, 0x5ac8ff, 0xffd23a, 0xb88aff].map(c => { const m = new THREE.MeshBasicMaterial({ color: c }); m.userData.outlineParameters = { thickness: 0.003, color: INK, alpha: 1, visible: true }; return m; });
  const xs = t => x0 + (x1 - x0) * t;
  if (id === 'labor') {
    for (const [t, w] of [[0.18, 2.4], [0.72, 2.6]]) {   // Labortische mit Kolben
      box(w, 0.08, 0.9, metall, xs(t), 0.95); box(0.08, 0.95, 0.85, metall, xs(t) - w / 2 + 0.1, 0.47); box(0.08, 0.95, 0.85, metall, xs(t) + w / 2 - 0.1, 0.47);
      for (let i = 0; i < 5; i++) { const x = xs(t) - w / 2 + 0.3 + i * (w - 0.6) / 4; zyl(0.06, 0.12, 0.26, glas[i % 5], x, 1.12, 0.45); kugel(0.05, glas[(i + 2) % 5], x, 1.3, 0.45); }
    }
    zyl(0.35, 0.45, 1.6, metall, xs(0.45), 0.8, 0.6);   // Tesla-Spule
    for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 8, 20), M(0xc87a3a)); r.rotation.x = Math.PI / 2; r.position.set(xs(0.45), 1.7 + i * 0.16, z - 0.6); g.add(r); }
    kugel(0.32, glas[2], xs(0.45), 2.75, 0.6);
    box(1.8, 1.0, 0.04, M(0x1e3a2e), xs(0.45), 2.2);   // Kreidetafel
    for (const t of [0.05, 0.95]) {   // Regale mit Gläsern
      box(0.5, Math.min(2.4, y1 - 0.3), 0.4, holzD, xs(t), Math.min(1.2, (y1 - 0.3) / 2));
      for (let k = 0; k < 3; k++) for (let i = 0; i < 3; i++) zyl(0.07, 0.07, 0.2, glas[(i + k) % 5], xs(t) - 0.12 + i * 0.12, 0.5 + k * 0.7, 0.2);
    }
    for (let i = 0; i < 3; i++) zyl(0.08, 0.08, x1 - x0 - 0.4, metall, (x0 + x1) / 2, Math.min(y1 - 0.4, 3.4) - i * 0.25, 0.25 + i * 0.1).rotation.z = Math.PI / 2;   // Rohre
  } else if (['lobby', 'stockwerk', 'gasthaus', 'konferenz', 'thron', 'vorraum'].includes(id)) {
    box(2.2, Math.min(2.6, y1 - 0.3), 0.45, holzD, xs(0.15), Math.min(1.3, (y1 - 0.3) / 2));   // Bücherregal
    const buch = [0x8a2a2a, 0x2a4a8a, 0x2a6a3a, 0xc8a04a, 0x5a2a6a];
    for (let k = 0; k < 4; k++) for (let i = 0; i < 9; i++) box(0.16, 0.36, 0.3, M(buch[(i + k) % 5]), xs(0.15) - 0.9 + i * 0.22, 0.35 + k * 0.6, 0.05);
    box(1.8, 1.1, 0.5, M(0x5a4a5a), xs(0.5), 0.55);   // Kamin mit Feuer
    box(1.1, 0.7, 0.1, M(0x1a0a10), xs(0.5), 0.45, 0.45);
    const feuer = new THREE.MeshBasicMaterial({ color: 0xff9a2a }); feuer.userData.outlineParameters = { visible: false };
    for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 8), feuer); f.position.set(xs(0.5) - 0.25 + i * 0.25, 0.32, z - 0.42); g.add(f); }
    const pl = new THREE.PointLight(0xff9a3a, 4, 5, 2); pl.position.set(xs(0.5), 0.8, z - 1.0); g.add(pl);
    bild(xs(0.5), 2.0, 1.2, 0.8, 0x3a2a5a); bild(xs(0.82), 1.8, 0.8, 1.0, 0x2a4a3a);
    for (const t of [0.7, 0.92]) { box(0.8, 0.5, 0.8, M(0x8a2a3a), xs(t), 0.25, 0.4); box(0.8, 0.8, 0.18, M(0x8a2a3a), xs(t), 0.65, 0.05); }   // Sessel
    zyl(0.22, 0.16, 0.45, M(0xa05a3a), xs(0.35), 0.22, 0.4); kugel(0.38, M(0x3a8a4a), xs(0.35), 0.7, 0.4);   // Topfpflanze
  } else {
    for (let i = 0; i < 4; i++) box(0.8, 0.8, 0.8, holz, xs(0.12) + (i % 2) * 0.85, 0.4 + Math.floor(i / 2) * 0.8, 0.3, (i % 3 - 1) * 0.08);   // Kisten
    box(1.6, 2.0, 0.5, holzD, xs(0.5), 1.0);   // Schrank
    bild(xs(0.8), 1.8, 1.0, 0.7, 0x3a2a4a);
    for (let i = 0; i < 2; i++) zyl(0.3, 0.3, 0.9, M(0x7a5a3a), xs(0.88) + i * 0.7, 0.45, 0.4);   // Fässer
  }
  return g;
}
export function laufflaeche3d(id) {   // Lauffläche über den ganzen Boden in Spiel-Koordinaten (Projektion der Spielkamera)
  const R = rooms[id]; if (!R || !R.ready || !R.innen || !R.home) return null;
  if (R.lauf3d) return R.lauf3d;
  const { x0, x1, z0, z1 } = R.innen, m = 0.45, v = new THREE.Vector3();
  R.lauf3d = [[x0 + m, z0 + m], [x1 - m, z0 + m], [x1 - m, z1 - m], [x0 + m, z1 - m]].map(([x, z]) => { v.set(x, 0, z).project(R.home); return [(v.x + 1) / 2 * GW, (1 - v.y) / 2 * GH]; });
  return R.lauf3d;
}

// ---------- Krumme Villa wie in Day of the Tentacle ----------
// Die Räume der Villa (in allen drei Zeiten) werden beim Laden einmal verbogen: Der Boden bleibt topfeben – Laufen,
// Springen und Figuren merken nichts –, aber alles darüber kippt mit der Höhe nach außen und eiert in sanften
// Wellen: Wände hängen schief, Türen werden zu Trapezen, Schränke lehnen sich zur Seite. Damit Klicks trotzdem
// treffen, rechnet entkruemmt() einen Treffer auf der verbogenen Geometrie auf seine ursprüngliche Lage zurück.
// a: Kippen nach außen (pro Meter Höhe und Meter Abstand zur Mitte), b/c/d: Wellen seitlich, in die Tiefe, nach oben
const KRUMM = {};
// Räume mit Sprungpassagen etwas sanfter, damit Kisten, Stufen und Zahnräder dort bleiben, wo die Physik sie erwartet
for (const [id, a] of Object.entries({ lobby: 1, stockwerk: 0.7, dachboden: 0.55, keller: 0.9, uhrwerk: 0.55, labor: 1, konferenz: 1, gasthaus: 0.9, vorraum: 0.9, thron: 0.9 })) {
  let ph = 0; for (const ch of id) ph = (ph * 31 + ch.charCodeAt(0)) % 628;
  KRUMM[id] = { a: 0.042 * a, b: 0.075 * a, c: 0.05 * a, d: 0.06 * a, ph: ph / 100 };
}
function krummVersatz(k, x, y, z, out) {   // Verschiebung eines Weltpunkts (three.js-Meter); Boden (y = 0) bleibt, wo er ist
  const h = Math.max(0, Math.min(8, y));
  if (!h) return out.set(0, 0, 0);
  return out.set(h * (k.a * x + k.b * Math.sin(0.55 * x + 0.35 * z + k.ph)), h * k.d * Math.sin(0.5 * x - 0.3 * z + k.ph * 0.6), h * k.c * Math.sin(0.4 * x + k.ph * 1.7));
}
// Treffer auf der verbogenen Geometrie -> Punkt vor dem Verbiegen (Fixpunkt: q + Versatz(q) = p)
function entbiegen(k, p, out) {
  const d = new THREE.Vector3();
  out.copy(p);
  for (let i = 0; i < 8; i++) { krummVersatz(k, out.x, out.y, out.z, d); out.copy(p).sub(d); }
  return out;
}
function krummBiegen(scene, k) {
  const v = new THREE.Vector3(), dv = new THREE.Vector3(), inv = new THREE.Matrix4(), schon = new Set(), meshes = [];
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    if (!o.isMesh) return;
    for (let p = o; p; p = p.parent) if (p.userData.keinKrumm) return;
    if (schon.has(o.geometry)) o.geometry = o.geometry.clone();   // geteilte Geometrie: jede Instanz biegt ihre eigene Kopie
    schon.add(o.geometry); meshes.push(o);
  });
  for (const o of meshes) {
    const g = o.geometry, pos = g.attributes.position; if (!pos) continue;
    inv.copy(o.matrixWorld).invert();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      v.add(krummVersatz(k, v.x, v.y, v.z, dv));
      v.applyMatrix4(inv);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    g.computeBoundingBox(); g.computeBoundingSphere();
  }
}

// ---------- Raum-Extras: Teile, die das Spiel selbst bewegt oder dazubaut ----------
const EXTRA_BEWEGLICH = {
  uhrwerk: /^(Notsteg|Riesenpendel|Kolben|Zahnrad(\d+|[AB]|Tief\d+)|Zifferblatt|Zeiger(Gross|Klein))$/,
  lobby: /^L_Uhr$/,
};
// Uhrwerk-Takt (Sekunden): Kolben-Oberkante und Pendelwinkel – Bild und Sprungphysik nutzen dieselben Formeln
let uhrS = 0;   // Spielzeit des letzten Bildes in Sekunden – Takt für Bild und Physik
const kolbenOben = s =>0.75 + 0.4 * Math.sin(s * Math.PI * 2 / 3.4);
const pendelWinkel = s => 0.78 * Math.sin(s * Math.PI * 2 / 2.8);
const PENDEL = { x: 0.8, y: 10.0, z: 6.0, l: 4.8 };
function pendelBob(s) {   // Mittelpunkt der Pendelscheibe in Blender-Metern und Schwungrichtung (±1)
  const w = pendelWinkel(s);
  return [PENDEL.x + PENDEL.l * Math.sin(w), PENDEL.y, PENDEL.z - PENDEL.l * Math.cos(w), Math.cos(s * Math.PI * 2 / 2.8) >= 0 ? 1 : -1];
}
function toonMat(farbe) {
  const m = new THREE.MeshToonMaterial({ color: farbe, gradientMap: GRAD });
  m.userData.outlineParameters = { thickness: 0.004, color: INK, alpha: 1, visible: true };
  return m;
}
function leuchtMat(farbe) { const m = new THREE.MeshBasicMaterial({ color: farbe }); m.userData.outlineParameters = { thickness: 0.003, color: INK, alpha: 1, visible: true }; return m; }
const _zA = new THREE.Vector3(0, 0, 1);
const RAUM_EXTRAS = {
  // Zukunftsgarten: Astgabeln, Wurzelstumpf und Laubpolster als Kletterweg den Apfelbaum hinauf zur Laterne
  fgarten(scene) {
    const holz = toonMat(0x6a4226), laub = toonMat(0x4aa83a), laubH = toonMat(0x7ad85a), weg = new THREE.Group();
    const stamm = bl(3.06, 11.47, 0);
    KLETTERBAUM.forEach(([x, y, h], i) => {
      const p = bl(x, y, h);
      if (i === 0) {   // Wurzelstumpf
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, h, 10), holz); st.position.set(p.x, h / 2, p.z); st.castShadow = true; weg.add(st);
      } else {   // Ast vom Stamm zur Plattform
        const a = new THREE.Vector3(stamm.x, Math.max(0.3, h - 0.55), stamm.z), d = p.clone().setY(h - 0.12).sub(a), len = Math.max(0.3, d.length());
        const ast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, len, 8), holz);
        ast.position.copy(a).addScaledVector(d, 0.5); ast.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); ast.castShadow = true; weg.add(ast);
      }
      const polster = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.42, 0.14, 12), i ? laub : holz);
      polster.position.set(p.x, h - 0.07, p.z); polster.castShadow = polster.receiveShadow = true; weg.add(polster);
      if (i) for (let k = 0; k < 3; k++) {   // Blätterbüschel am Rand
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), k % 2 ? laub : laubH), w = k * 2.1 + i;
        b.position.set(p.x + Math.cos(w) * 0.42, h + 0.02, p.z + Math.sin(w) * 0.42); b.scale.set(1, 0.6, 1); weg.add(b);
      }
    });
    scene.add(weg);
    return { tick() { weg.visible = typeof flagOn === 'function' && flagOn('tree'); } };
  },
  // Uhrwerk: Zahnräder drehen sich, die Zeiger laufen rückwärts, der Kolben pumpt, das Riesenpendel schwingt,
  // die Kerzen flackern; der Notsteg (nur fürs vorgerenderte Bild) verschwindet, ein echter Kristall schwebt
  uhrwerk(scene, H) {
    const knoten = n => { let r = null; H.traverse(o => { if (!r && nm(o) === n) r = o; }); return r; };
    const raeder = [];
    H.traverse(o => {
      const m = /^Zahnrad(\d+|[AB]|Tief\d+)$/.exec(nm(o)); if (!m) return;
      const v = /[AB]/.test(m[1]) ? 0.5 : /Tief/.test(m[1]) ? 0.9 : 0.35;
      raeder.push({ o, q0: o.quaternion.clone(), v: raeder.length % 2 ? -v : v });
    });
    const zeiger = ['ZeigerGross', 'ZeigerKlein'].map(knoten).filter(Boolean).map((o, i) => ({ o, q0: o.quaternion.clone(), v: i ? 0.05 : 0.6 }));
    const kolben = knoten('Kolben'), pendel = knoten('Riesenpendel'), steg = knoten('Notsteg');
    const pq0 = pendel ? pendel.quaternion.clone() : null;
    if (steg) steg.visible = false;
    const kerzen = []; scene.traverse(o => { if (o.isPointLight) kerzen.push({ o, i0: o.intensity, ph: Math.random() * 9 }); });
    const kristall = new THREE.Group(); kristall.userData.keinKrumm = true;   // schwebt genau dort, wo js/uhrwerk.js ihn einsammelt
    const kk = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), leuchtMat(0x9af0ff));
    kk.scale.set(0.75, 1.25, 0.75); kristall.add(kk);
    kristall.add(new THREE.PointLight(0x7fe8ff, 3.2, 3.5, 2));
    kristall.position.copy(bl(1.7, 10.6, 2.3)); scene.add(kristall);
    return {
      tick(s, ctx) {
        for (const r of raeder) r.o.quaternion.copy(r.q0).multiply(_q.setFromAxisAngle(_yA, s * r.v));
        for (const z of zeiger) z.o.quaternion.copy(z.q0).multiply(_q.setFromAxisAngle(_zA, s * z.v));   // rückwärts!
        if (kolben) kolben.position.y = kolbenOben(s);
        if (pendel) pendel.quaternion.copy(pq0).multiply(_q.setFromAxisAngle(_zA, pendelWinkel(s)));
        const sp = ctx.sprites && ctx.sprites.uhrKristall ? ctx.sprites.uhrKristall() : { vis: true };
        kristall.visible = sp.vis !== false;
        kristall.rotation.y = s * 1.6; kristall.position.y = 2.3 + Math.sin(s * 3.5) * 0.07;
        for (const k of kerzen) k.o.intensity = k.i0 * (0.85 + 0.15 * Math.sin(s * 17 + k.ph) * Math.sin(s * 7.3 + k.ph * 2));
      },
    };
  },
  // Lobby: die Standuhr schwingt als Geheimtür auf (Scharnier rechts), dahinter Gang mit Kerzenschein;
  // dazu die Treppe ins Obergeschoss hinter dem Empfang, an der Rückwand entlang nach links hinauf
  lobby(scene, H) {
    let uhr = null; H.traverse(o => { if (!uhr && nm(o) === 'L_Uhr') uhr = o; });
    const teile = {};
    if (uhr) {
      uhr.updateMatrixWorld(true);
      const p = new THREE.Vector3().setFromMatrixPosition(uhr.matrixWorld);
      const angel = new THREE.Group(); angel.position.set(p.x + 0.43, 0, p.z); scene.add(angel); angel.attach(uhr);
      const gang = new THREE.Group(); gang.visible = false;
      const loch = new THREE.Mesh(new THREE.BoxGeometry(0.86, 2.75, 0.06), toonMat(0x0c0610));
      loch.position.set(p.x, 1.375, p.z - 0.38); gang.add(loch);
      for (let i = 0; i < 4; i++) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.07, 0.16), toonMat(i % 2 ? 0x3a2416 : 0x4a2e1a));
        st.position.set(p.x, 0.12 + i * 0.3, p.z - 0.3); gang.add(st);
      }
      const schein = new THREE.PointLight(0xffa040, 4, 3.5, 2); schein.position.set(p.x, 0.6, p.z - 0.1); gang.add(schein);
      scene.add(gang);
      Object.assign(teile, { angel, gang, schein });
    }
    const holz = toonMat(0x6a4a30), holzH = toonMat(0x755539), holzD = toonMat(0x4a3220), treppe = new THREE.Group();
    for (let i = 0; i < 15; i++) {
      const x = -4.35 - i * 0.31, h = 0.28 * (i + 1);
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 1.15), i % 2 ? holz : holzH);
      st.position.copy(bl(x, 12.6, h - 0.05)); st.castShadow = st.receiveShadow = true; treppe.add(st);
      const wange = new THREE.Mesh(new THREE.BoxGeometry(0.31, h - 0.1, 0.08), holzD);
      wange.position.copy(bl(x, 12.02, (h - 0.1) / 2)); treppe.add(wange);
      if (i % 2 === 0) { const stab = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6), holzD); stab.position.copy(bl(x, 12.06, h + 0.4)); treppe.add(stab); }
    }
    const lauf = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.07, 0.09), holz);
    lauf.position.copy(bl(-6.52, 12.06, 2.95)); lauf.rotation.z = -Math.atan2(0.28, 0.31); treppe.add(lauf);
    const pfosten = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.25, 0.12), holzD); pfosten.position.copy(bl(-4.2, 12.06, 0.62)); treppe.add(pfosten);
    const knauf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), toonMat(0xc8a04a)); knauf.position.copy(bl(-4.2, 12.06, 1.3)); treppe.add(knauf);
    scene.add(treppe);
    return {
      tick(s, ctx) {
        if (!teile.angel) return;
        const st = ctx.sprites && ctx.sprites.uhrtuer ? ctx.sprites.uhrtuer() : { offen: 0, seit: 1e9 };
        const k = st.offen ? Math.min(1, st.seit / 700) : 0;
        const e = k < 1 ? 1 - Math.pow(1 - k, 3) + Math.sin(k * Math.PI) * 0.12 : 1;   // Cartoon-Überschwinger beim Aufschwingen
        teile.angel.rotation.y = 1.25 * e;
        teile.gang.visible = !!st.offen;
        teile.schein.intensity = 3.4 + Math.sin(s * 15) * 0.5;
      },
    };
  },
};

export function entkruemmt(gx, gy, id) {   // Bildpunkt der Spielkamera -> Spielpunkt vor dem Verbiegen (Klicks, Mauszeiger)
  const R = rooms[id]; if (!R || !R.ready || !R.krumm || !R.home) return null;
  _n.set(gx / GW * 2 - 1, 1 - gy / GH * 2);
  ray.setFromCamera(_n, R.camera);
  let p = null;
  for (const h of ray.intersectObjects(R.scene.children, true)) {
    let ok = true;
    for (let o = h.object; o; o = o.parent) if (o.visible === false || (o.name || '').startsWith('Figur_')) { ok = false; break; }
    if (ok) { p = h.point; break; }
  }
  if (!p) return null;
  const q = entbiegen(R.krumm, p, new THREE.Vector3()).project(R.home);
  return { x: (q.x + 1) / 2 * GW, y: (1 - q.y) / 2 * GH };
}

// ---------- Hüpfen wie in Psychonauts 2: Plattformen, Schwerkraft, Sprung ----------
// Sprungflächen in Blender-Weltmetern: [x0, x1, y0, y1, Oberkante].
// Im Dachboden sind es Kisten, Koffer und Truhe; im Obergeschoss schweben Toaststufen über dem Treppenloch.
// Kletterbaum im Zukunftsgarten (Rätsel: die Energiezelle aus der Laterne holen): Blender-x, -y und Oberkante in Metern
export const KLETTERBAUM = [[3.95, 10.75, 0.55], [3.85, 11.55, 1.2], [3.06, 11.45, 2.0], [2.05, 11.75, 2.75], [1.2, 11.95, 3.4]];
export const ZELLE_WELT = [0.97, 12.5, 4.43];
const STOCKWERK_STUFEN = [
  [6.65, 7.8, 8.05, 9.25, 0.28], [5.35, 6.5, 8.55, 9.75, 0.58],
  [4.05, 5.2, 9.05, 10.25, 0.9], [2.75, 3.9, 9.55, 10.75, 0.56],
];
export const PLATTFORMEN = {
  dachboden: [[2.4, 3.5, 14.8, 15.6, 0.62], [-4.5, -2.3, 14.8, 16.0, 1.28], [4.4, 7.4, 12.9, 14.7, 1.06], [-0.1, 1.4, 15.0, 16.2, 0.84], [-6.7, -5.7, 14.3, 15.3, 0.26]],
  stockwerk: STOCKWERK_STUFEN,
  uhrwerk: [[-2.45, -0.75, 9.35, 11.05, 0.45], [-0.6, 0.6, 9.0, 10.2, kolbenOben], [0.82, 2.58, 9.72, 11.48, 0.8]],   // Zahnrad A, Hubkolben (Höhe läuft mit), Zahnrad B
  fgarten: KLETTERBAUM.map(([x, y, h]) => [x - 0.42, x + 0.42, y - 0.42, y + 0.42, () => (typeof flagOn === 'function' && flagOn('tree') ? h : -99)]),   // erst, wenn der Baum gewachsen ist
};
const SPRUNGLOCH = { stockwerk: [[2.7, 8.35, 7.0, 11.3]], uhrwerk: [[-2.6, 2.8, 5.0, 20.0]] };
function imSprungloch(id, x, y) { return (SPRUNGLOCH[id] || []).some(p => x >= p[0] && x <= p[1] && y >= p[2] && y <= p[3]); }
function sprungToastStufen(scene, id) {
  if (id !== 'stockwerk') return;
  const rand = new THREE.MeshToonMaterial({ color: 0x874522, gradientMap: GRAD });
  const krume = new THREE.MeshToonMaterial({ color: 0xf0bd68, gradientMap: GRAD });
  const butter = new THREE.MeshToonMaterial({ color: 0xffed9b, gradientMap: GRAD });
  for (const m of [rand, krume, butter]) m.userData.outlineParameters = { thickness: 0.004, color: INK, alpha: 1, visible: true };
  for (const [i, p] of STOCKWERK_STUFEN.entries()) {
    const x = (p[0] + p[1]) / 2, y = (p[2] + p[3]) / 2, w = p[1] - p[0], d = p[3] - p[2], h = p[4];
    const basis = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, d), rand);
    basis.position.set(x, h - 0.09, -y); basis.castShadow = true; basis.receiveShadow = true; scene.add(basis);
    const toast = new THREE.Mesh(new THREE.BoxGeometry(w - 0.12, 0.035, d - 0.12), krume);
    toast.position.set(x, h - 0.018, -y); toast.castShadow = true; toast.receiveShadow = true; scene.add(toast);
    const klecks = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 7), butter);
    klecks.scale.set(1.35, 0.23, 0.9); klecks.position.set(x + (i % 2 ? 0.16 : -0.16), h + 0.025, -y - 0.12); scene.add(klecks);
  }
}
const G3D = 18.0, SPRUNG_V0 = 6.8;   // Sprunghöhe ≈ 1,3 m: reicht für Kisten und die Toaststufen
function plattformHoehe(id, x, y, z) {
  let h = imSprungloch(id, x, y) ? -4 : 0;
  const s = uhrS;
  for (const p of PLATTFORMEN[id] || []) {
    const top = typeof p[4] === 'function' ? p[4](s) : p[4];
    if (x >= p[0] - 0.25 && x <= p[1] + 0.25 && y >= p[2] - 0.25 && y <= p[3] + 0.25 && top <= z + 0.3) h = Math.max(h, top);
  }
  return h;
}
export function huepfen(a) {   // Sprung zünden – nur, wenn die Figur steht; Tom-&-Jerry-Anlauf: erst 90 ms in die Hocke
  if ((a._vz3d || 0) !== 0 || a._vorT3d || a._schub3d) return false;
  a._vorT3d = performance.now();
  return true;
}
function sprungAbheben(a, now) {
  if (!a._vorT3d || now - a._vorT3d < 90) return;
  a._vorT3d = null; a._vz3d = SPRUNG_V0; a._jumpT3d = now;
  a._z3d = Math.max(a._z3d || 0, 0.0002);   // in der Luft: ab jetzt rechnet die Schwerkraft
}
export function schwerkraft(a, dt, id, px, py) {   // einen Frame Physik; px/py = Blender-Weltposition der Figur
  let z = a._z3d || 0, vz = a._vz3d || 0;
  const sek = Math.min(0.05, dt / 1000), loch = imSprungloch(id, px, py);
  if (z <= 0.0001 && vz === 0 && !loch) return z;
  if (loch && z <= 0.0001 && vz === 0) vz = -0.35;
  vz -= G3D * sek;
  z += vz * sek;
  const boden = plattformHoehe(id, px, py, z);
  if (z <= boden && vz <= 0) {
    if (vz < -2.2) { a._landT3d = performance.now(); a._landV3d = Math.min(1, -vz / 9); }   // Platsch: Squash bei der Landung
    z = boden; a._vz3d = 0;
    if (z > 0.02) a._checkpoint3d = [a.x, a.y, z];
  } else a._vz3d = vz;
  a._z3d = z;
  if (z < -2.4 && a._checkpoint3d) {
    const [x, y, h] = a._checkpoint3d;
    a._schub3d = null; a._vorT3d = null;
    a.x = x; a.y = y; a.target = null; a.walking = false; a.run = false;
    if (a._res) { const done = a._res; a._res = null; done(false); }
    a._z3d = h; a._vz3d = 0; a._respawned3d = true;
    return h;
  }
  return z;
}
export function stehHoehe(id, x, y) { return plattformHoehe(id, x, y, 99); }   // höchste Plattform am Ort
export function bewegungsZiel(a, dx, dy, sek, id = a.room) {
  const R = rooms[id]; if (!R || !R.ready || !R.home || !R.camera) return null;
  const kraft = Math.hypot(dx, dy); if (kraft < 0.025) return null;
  const p = toWorld(R.home, a.x, a.y, new THREE.Vector3());
  _fw.copy(R.camera.getWorldDirection(_fw)); _fw.y = 0;
  if (_fw.lengthSq() < 1e-5) return null;
  _fw.normalize(); _rt.crossVectors(_fw, _yA).normalize();
  const schritt = 5.2 * Math.min(1, kraft) * Math.max(0, sek);
  p.addScaledVector(_rt, dx / kraft * schritt).addScaledVector(_fw, -dy / kraft * schritt);
  p.y = 0; p.project(R.home);
  return [(p.x + 1) * GW / 2, (1 - p.y) * GH / 2];
}

// ---------- Billboards: gezeichnete Figuren und Dinge ohne 3D-Modell als Bildkarten im Raum ----------
// Beim freien Drehen der Kamera stünden gemalte Figuren sonst fest im Bild. js/echt3d.js malt sie in eine eigene
// Leinwand (Füße bei fussX/fussY, k Bildpunkte je Spiel-Einheit); hier steht die Karte am Fußpunkt im Raum und
// dreht sich um die Hochachse immer zur Kamera.
const karten = new Map();
function kartenStellen(R, liste) {
  const seen = new Set();
  for (const b of liste || []) {
    seen.add(b.key);
    let k = karten.get(b.key);
    if (!k) {
      const tex = new THREE.CanvasTexture(b.canvas); tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.08, depthWrite: true, side: THREE.DoubleSide });
      mat.userData.outlineParameters = { visible: false };
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); mesh.name = 'Figur_Karte_' + b.key;   // „Figur_“: kein Klickziel fürs Entbiegen
      k = { mesh, tex }; karten.set(b.key, k);
    }
    if (k.mesh.parent !== R.scene) R.scene.add(k.mesh);
    k.tex.image = b.canvas; k.tex.needsUpdate = true;
    const p = toWorld(R.home, b.x, b.y, new THREE.Vector3()), upm = unitsPerMeter(R.home, p);
    const w = b.canvas.width / b.k / upm, h = b.canvas.height / b.k / upm;
    k.mesh.scale.set(w, h, 1);
    k.mesh.position.set(p.x, p.y + (b.fussY - b.canvas.height / 2) / b.k / upm, p.z);
    k.mesh.rotation.set(0, Math.atan2(R.camera.position.x - p.x, R.camera.position.z - p.z), 0);
    k.mesh.visible = true;
  }
  for (const [key, k] of karten) if (!seen.has(key) || k.mesh.parent !== R.scene) k.mesh.visible = false;
}

// ---------- Bild für einen Spiel-Frame ----------
let lastT = 0;
const _vis = new Map();
export function frame(t, actors, pxW, ctx) {
  const R = rooms[ctx.id]; if (!R || !R.ready) return null;
  const w = Math.max(320, Math.min(1440, Math.round(pxW || 1280))), h = Math.round(w * GH / GW);
  if (renderer.domElement.width !== w) renderer.setSize(w, h, false);
  const dt = Math.min(100, Math.max(0, t - lastT)); lastT = t;
  const s = t / 1000, camera = R.camera;
  if (!R.home) kameraLoesen(R);
  kameraFahren(R, t, actors);
  if (R.anim) hafenAnim(R.anim, s);
  uhrS = s;
  if (R.extra) R.extra.tick(s, ctx);
  if (R.req) requisitenBewegen(R.req, s, ctx);
  if (R.home) kartenStellen(R, ctx.karten);
  if (R.innen && R.innen.deko) R.innen.deko.visible = freiAktiv();
  // Zustände: sichtbar, wenn ein eingeschalteter Zustand es zeigt; ausgeblendet, wenn einer es versteckt
  if (R.data.zustaende) {
    _vis.clear(); const weg = new Set();
    for (const [k, [vis, hid]] of Object.entries(R.data.zustaende)) {
      const on = !!(ctx.zustand && ctx.zustand[k] && ctx.zustand[k]());
      for (const n of vis) _vis.set(n, (_vis.get(n) || false) || on);
      if (on) for (const n of hid) weg.add(n);
    }
    for (const [n, list] of R.nodes) { const v = (_vis.has(n) ? _vis.get(n) : true) && !weg.has(n); for (const o of list) o.visible = v; }
  }
  // bewegte Teile: Drehung in der Bildebene, Skalierung, sichtbar/unsichtbar
  for (const [k, sp] of Object.entries(R.sprites)) {
    const p = ctx.sprites && ctx.sprites[k] && ctx.sprites[k](t); if (!p) continue;
    sp.o.visible = p.vis !== false;
    sp.o.quaternion.copy(sp.q0);
    if (p.rot) sp.o.quaternion.premultiply(_q2.setFromAxisAngle(sp.achse, p.rot));
    sp.o.scale.set(sp.s0.x * (p.sx || 1), sp.s0.y * (p.sy || 1), sp.s0.z * (p.sx || 1));
  }
  // Figuren an ihre Spielposition, Blickrichtung, Haltung, Cartoon-Mimik – über die Home-Kamera in der Welt
  // verankert, damit sie bei Kamerafahrten und Dolly-Zoom wie echte Bewohner des Raums mitwandern
  const seen = new Set();
  for (const a of actors) {
    const f = figs[a.kind]; if (!f || !a.visible || !owns(a, ctx.id)) continue;
    seen.add(a.kind);
    if (f.holder.parent !== R.scene) R.scene.add(f.holder);
    if (a.id === curId() && a._checkpointRoom3d !== ctx.id) {
      a._checkpointRoom3d = ctx.id; a._z3d = 0; a._vz3d = 0; a._checkpoint3d = [a.x, a.y, 0];
    }
    let p = toWorld(R.home, a.x, a.y, _v.clone());
    if (f.last && a.walking) f.walkPh += p.distanceTo(f.last) / 0.62 * Math.PI;
    f.last = (f.last || new THREE.Vector3()).copy(p);
    const mf = typeof mimikForm === 'function' ? mimikForm(a, t) : null;
    f.holder.position.copy(p);
    if (mf && (mf.lift || mf.jx)) { const upm = unitsPerMeter(R.home, p); if (mf.lift) f.holder.position.y += mf.lift / upm; if (mf.jx) f.holder.position.x += mf.jx / upm; }   // Sprung und Zittern in Spiel-Pixeln
    const ich = !!f.rig && a.id === curId(), now = performance.now();
    if (ich) {
      sprungAbheben(a, now);
      if (a._schub3d) {   // vom Pendel erwischt: im hohen Bogen quer durch den Raum (Tom & Jerry lässt grüßen)
        const sb = a._schub3d;
        if (now - sb.t0 > 900) a._schub3d = null;
        else {
          p.x += sb.vx * Math.min(0.05, dt / 1000);
          const q = p.clone().project(R.home);
          a.x = Math.max(16, Math.min(944, (q.x + 1) * GW / 2)); a.y = (1 - q.y) * GH / 2; a.target = null; a.walking = false;
          p.copy(toWorld(R.home, a.x, a.y, _v));
          f.holder.position.copy(p);
        }
      }
    }
    if (ich && ((a._vz3d || 0) !== 0 || (a._z3d || 0) > 0.0001 || imSprungloch(ctx.id, p.x, -p.z))) {   // gesteuerte Figur: Sprung, Plattform oder Loch
      const z = schwerkraft(a, dt, ctx.id, p.x, -p.z);
      if (a._respawned3d) { p.copy(toWorld(R.home, a.x, a.y, _v)); f.holder.position.copy(p); }
      if (z > 0.0001) f.holder.position.y += z;
      else if (z < -0.0001) f.holder.position.y += z;
    }
    if (ich) {
      if (R.innen && autoKamera) {   // Auto-Kamera hinter der Figur (Blickrichtung f.yaw: +x vorn, Kamera auf der Gegenseite)
        // wie Super Mario 64: die Kamera bleibt auf der vorderen Raumhälfte (höchstens ~70° seitlich) und schwenkt beim
        // Laufen träge hinter die Laufrichtung; läuft man auf sie zu, bleibt sie stehen
        const o = orbit(ctx.id), hinter = Math.max(-1.22, Math.min(1.22, Math.atan2(-Math.cos(f.yaw), Math.sin(f.yaw))));
        if (!freiAktiv() && !o.zurueck) { o.yaw = 0.01; o.rueckT0 = null; }
        else if (a.walking && !o.zurueck) {
          const roh = Math.atan2(-Math.cos(f.yaw), Math.sin(f.yaw)), d = Math.atan2(Math.sin(roh - o.yaw), Math.cos(roh - o.yaw));
          if (Math.abs(roh) < 2.0 && Math.abs(d) < 0.95) o.yaw += (hinter - o.yaw) * Math.min(1, dt / 1100);   // seitwärts/zurück: Kamera bleibt (kein Im-Kreis-Laufen)
          if (Math.abs(o.yaw) < 3e-3) o.yaw = 3e-3 * Math.sign(o.yaw || 1);
        }
      } else if (R.innen && !freiAktiv() && (a.y > GH - 16 || a.x < 14 || a.x > GW - 14)) {   // klassische Ansicht: aus dem Bild gelaufen
        const o = orbit(ctx.id); o.yaw = 0.012; o.zurueck = false; o.rueckT0 = null;
      }
      a._pos3d = [p.x, -p.z, a._z3d || 0];   // Blender-Weltlage für Sammelobjekte (js/uhrwerk.js)
      const fz = Math.max(0, a._z3d || 0) + 0.95;   // Folgekamera: weich hinterher, Höhe gedämpft (Sprünge wackeln nicht)
      if (!R.fokus) R.fokus = new THREE.Vector3(p.x, fz, p.z);
      R.fokus.x += (p.x - R.fokus.x) * Math.min(1, dt / 160); R.fokus.z += (p.z - R.fokus.z) * Math.min(1, dt / 160); R.fokus.y += (fz - R.fokus.y) * Math.min(1, dt / 400);
      if (ctx.id === 'uhrwerk' && !a._schub3d && now - (a._bonkT3d || 0) > 1600) {   // das Riesenpendel trifft
        const [bx, by, bz, dir] = pendelBob(uhrS), z = a._z3d || 0;
        if (Math.abs(p.x - bx) < 0.62 && Math.abs(-p.z - by) < 0.85 && Math.abs(z + 0.9 - bz) < 0.95) {
          a._bonkT3d = now; a._schub3d = { vx: dir * 5.5, t0: now }; a._vz3d = 5.2; a._z3d = Math.max(z, 0.0002); a._vorT3d = null;
          if (a._res) { const done = a._res; a._res = null; done(false); }
          a._gebonkt3d = true;   // js/echt3d.js: BONK, Schreck-Take, Sternchen
        }
      }
    }
    // Cartoon-Verformung: Mimik × Sprung-Hocke × Strecken im Steigen × Platsch bei der Landung × federnder Gang
    let sx = mf ? mf.sx : 1, sy = mf ? mf.sy : 1, kipp = 0;
    if (ich) {
      if (a._vorT3d) { const q = Math.min(1, (now - a._vorT3d) / 90); sy *= 1 - 0.3 * q; sx *= 1 + 0.22 * q; }
      else if ((a._vz3d || 0) > 0.5) { const q = Math.min(1, a._vz3d / SPRUNG_V0); sy *= 1 + 0.24 * q; sx *= 1 - 0.14 * q; }
      if (a._landT3d) {
        const q = (now - a._landT3d) / 360;
        if (q < 1) { const w = Math.exp(-q * 4) * Math.cos(q * 15) * (0.22 + 0.32 * (a._landV3d || 0)); sy *= 1 - w; sx *= 1 + w * 0.85; }
        else a._landT3d = null;
      }
    }
    if (a.walking && f.rig) {
      const b = Math.abs(Math.sin(f.walkPh));
      f.holder.position.y += b * (a.run ? 0.085 : 0.045);
      sy *= 1 + (b - 0.5) * 0.07; sx *= 1 - (b - 0.5) * 0.045;
      if (!f.lief) { f.zischT = now; if (ich && a.run) a._zischT3d = now; }   // Losflitzen: erst Rückenlage mit wirbelnden Beinen, dann Vorlage
    }
    f.lief = a.walking;
    if (f.zischT && a.run) {
      const q = (now - f.zischT) / 420;
      if (q < 1) {
        const zurueck = q < 0.3 ? Math.sin(q / 0.3 * Math.PI / 2) : Math.max(0, 1 - (q - 0.3) / 0.12);
        const vor = q < 0.3 ? 0 : Math.sin(Math.min(1, (q - 0.3) / 0.12) * Math.PI / 2) * (1 - (q - 0.3) / 0.7);
        kipp = -0.3 * zurueck + 0.24 * vor;
        if (q < 0.3) f.walkPh += dt * 0.06;   // Beine wirbeln auf der Stelle
      }
      else f.zischT = null;
    }
    f.holder.scale.set(sx, sy, sx);
    // Blickrichtung: beim Gehen zum Ziel, sonst leicht zur Kamera gedreht wie die Sprites
    let want = a.dir < 0 ? -Math.PI + 0.56 : -0.56;
    if (a.walking && a.target) {
      const q = toWorld(R.home, a.target[0] !== undefined ? a.target[0] : a.target.x, a.target[1] !== undefined ? a.target[1] : a.target.y, new THREE.Vector3());
      const dx = q.x - p.x, dz = q.z - p.z;
      if (dx * dx + dz * dz > 0.01) want = Math.atan2(-dz, dx);   // Blender-Gierwinkel: +x vorn, −y zur Kamera
    }
    let dy = want - f.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    f.yaw += dy * Math.min(1, dt / 120);
    const dreh = a._schub3d ? (now - a._schub3d.t0) * 0.03 : 0;   // getroffen: Figur wirbelt um sich selbst
    f.holder.rotation.set(0, f.yaw + dreh, (mf && mf.rot ? -mf.rot : 0) - kipp, 'YXZ');   // Mimik-Neigung, Losflitzen
    if (f.rig) {
      let p0 = pose(f.rig, {});
      if (a._vorT3d) p0 = pose(f.rig, { aR: 0.5, eR: 0.4, aL: -0.5, eL: 0.4, tR: -0.7, tL: -0.7, kR: 1.3, kL: 1.3, lean: 0.25 });   // Hocke, Arme nach hinten
      else if ((a._vz3d || 0) < -3.2 || a._schub3d) {   // freier Fall: Arme rudern wie Windmühlen, Beine strampeln
        const w = t * 0.03;
        p0 = pose(f.rig, { aR: -1.6 + Math.sin(w) * 1.4, eR: 0.3, aL: 1.6 + Math.sin(w + 1.6) * 1.4, eL: 0.3, xR: -1.2, xL: 1.2, tR: Math.sin(w * 1.3) * 0.7, tL: -Math.sin(w * 1.3) * 0.7, kR: 0.6, kL: 0.6, lean: -0.15 });
      } else if (Math.abs(a._vz3d || 0) > 0.15) p0 = pose(f.rig, { aR: -2.3, eR: 0.24, aL: 2.3, eL: 0.24, tR: -0.52, tL: -0.52, kR: 0.88, kL: 0.88, lean: -0.1 });
      else if (a.walking) p0 = walkPose(f.rig, f.walkPh);
      else if (a.pose && (POSES[a.pose.kind] || POSES[a.pose.kind + '0'])) {
        const k = a.pose.kind, el = (t - a.pose.t0) / Math.max(1, a.pose.dur), env = Math.sin(Math.min(1, el) * Math.PI);
        const tgt = POSES[k] ? pose(f.rig, POSES[k]) : mix(pose(f.rig, POSES[k + '0']), pose(f.rig, POSES[k + '1']), 0.5 + 0.5 * Math.sin(t * 0.012));
        p0 = mix(p0, tgt, Math.min(1, env * 1.6));
      } else if (a.talking) p0 = mix(pose(f.rig, POSES.talk0), pose(f.rig, POSES.talk1), 0.5 + 0.5 * Math.sin(t * 0.007));
      else {
        p0.lean += 0.012 * Math.sin(t * 0.0021);   // Atmen
        const z = (t + f.id.length * 997) % 7500;   // Ticks im Stand (Bernard: Brille hochschieben)
        if (f.rig.zappel && z < 1100 && POSES[f.rig.zappel]) p0 = mix(p0, pose(f.rig, POSES[f.rig.zappel]), Math.sin(z / 1100 * Math.PI));
      }
      if (mf && mf.m && !a.walking) {   // Geste zur Mimik, mit Aus- und Einschwingen (Einzelposen und pendelnde Paare wie ekel0/ekel1)
        const ein = POSES[mf.m.kind], p0p = POSES[mf.m.kind + '0'], p1p = POSES[mf.m.kind + '1'];
        if (ein || (p0p && p1p)) {
          const k = Math.max(0, Math.min(1, mf.k)), env = Math.min(1, Math.sin(k * Math.PI) * 2.2);
          const tgt = ein ? pose(f.rig, ein) : mix(pose(f.rig, p0p), pose(f.rig, p1p), 0.5 + 0.5 * Math.sin(t * 0.014));
          p0 = mix(p0, tgt, env);
        }
      }
      applyPose(f, p0);
      const m = f.nodes[f.rig.mouth];
      if (m) {   // Mund: Silbentakt beim Reden; bei Staunen/Ekel fällt die Kinnlade richtig herunter
        const b = f.base[f.rig.mouth].s, ki = mf ? (mf.kinn || 0) : 0;
        const offen = a.talking ? 1 + 3.0 * Math.abs(Math.sin(t * 0.018)) : 1;
        m.scale.set(b.x * (1 + ki * 0.25), b.y * Math.max(offen, 1 + 3.6 * ki), b.z);
      }
      f.blinkT -= dt; const blink = f.blinkT < 0;
      if (f.blinkT < -130) f.blinkT = 2200 + Math.random() * 3500;
      const pop = mf ? 1 + mf.pop * 1.25 : 1;   // Glubschaugen
      for (const e of f.rig.eyes) { const o = f.nodes[e]; if (o) { const b = f.base[e].s; o.scale.set(b.x * pop, (blink && pop === 1 ? 0.12 : 1) * b.y * pop, b.z * pop); } }
    } else {
      f.root.scale.setScalar(1);
      f.root.position.y = Math.sin(t * 0.002 + a.x) * 0.006;   // Gäste: ruhiges Atmen
    }
  }
  for (const f of Object.values(figs)) f.holder.visible = seen.has(f.id) && f.holder.parent === R.scene;
  effect.render(R.scene, camera);
  return renderer.domElement;
}
export function raumInfo(id) {   // Fehlersuche: Innenmaße und Kameralage
  const R = rooms[id || letzterRaum]; if (!R || !R.ready) return null;
  const c = R.camera.position;
  return { innen: R.innen, kamera: [c.x, c.y, c.z].map(v => +v.toFixed(2)), ziel: R.ziel && [R.ziel.x, R.ziel.y, R.ziel.z].map(v => +v.toFixed(2)) };
}
export function spielPunkt(bx, by, id) {   // Blender-Bodenpunkt -> Spiel-Koordinaten der Bühnenkamera (für Rätsel und Tests)
  const R = rooms[id || letzterRaum]; if (!R || !R.ready || !R.home) return null;
  const v = bl(bx, by, 0).project(R.home);
  return [(v.x + 1) / 2 * GW, (1 - v.y) / 2 * GH];
}
