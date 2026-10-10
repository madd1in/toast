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
const GW = 960, GH = 440;   // Spiel-Einheiten des Raumbilds
const INK = [0.04, 0.012, 0.07];
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
  const canvas = document.createElement('canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  effect = new OutlineEffect(renderer, { defaultThickness: 0.0032, defaultColor: INK, defaultAlpha: 1 });
  GRAD = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.RedFormat);
  GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true;
  loader = new GLTFLoader();
  const ids = [...HELDEN, 'guybrush', 'jack'];
  const glbs = await Promise.all(ids.map(n => loader.loadAsync(BASE + n + '.glb')));
  ids.forEach((id, i) => addFig(id, glbs[i].scene, RIGS[id] || null));
  ready = true;
}

// Raum laden (einmal); bis er da ist, zeigt das Spiel das vorgerenderte Bild
export function hasRoom(id) {
  const r = rooms[id];
  if (r) return r.ready;
  rooms[id] = { loading: true, ready: false };
  (id === 'hafen' ? ladeHafen() : ladeRaum(id)).then(x => { Object.assign(rooms[id], x, { ready: true, loading: false }); },
    e => { console.error('Echtzeit-3D', id, e); rooms[id].failed = true; });
  return false;
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

async function ladeRaum(id) {
  const [gltf, data] = await Promise.all([loader.loadAsync(BASE + id + '.glb'), fetch(BASE + id + '.json').then(r => r.json())]);
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
  const stat = mergeStatic(H, n => beweglich.has(n));
  scene.add(H); scene.add(stat);
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
  return { scene, camera, data, nodes, sprites };
}

async function ladeHafen() {
  const hafen = await loader.loadAsync(BASE + 'hafen.glb'), scene = new THREE.Scene(), H = hafen.scene;
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
  bernard: { P: 'BR_', hz: 0.98, sole: 0.14, thigh: 0.43, shin: 0.41, stride: 0.26, knee: 0.75, abd: 0.06, mouth: 'RB_Mund', eyes: ['RB_PupilleL', 'RB_PupilleR'] },
  hoagie: { P: 'HR_', hz: 0.62, sole: 0.16, thigh: 0.24, shin: 0.22, stride: 0.5, knee: 0.9, abd: 0.24, mouth: 'RH_Mund', eyes: ['RH_AugeL', 'RH_AugeR', 'RH_PupilleL', 'RH_PupilleR'] },
  laverne: { P: 'LR_', hz: 0.72, sole: 0.10, thigh: 0.32, shin: 0.30, stride: 0.37, knee: 0.8, abd: 0.08, mouth: 'RL_Mund', eyes: ['RL_AugeL', 'RL_AugeR', 'RL_PupilleL', 'RL_PupilleR'] },
};
function pose(rig, kw) {
  const ab = rig.abd;
  return Object.assign({ aR: -0.12, aL: 0.12, eR: 0.12, eL: 0.12, xR: -ab, xL: ab, tR: 0, tL: 0, kR: 0, kL: 0, fR: 1, fL: 1, lean: 0, roll: 0 }, kw);
}
const POSES = {   // Blender-Werte aus figur_frames.py
  talk0: { aR: -0.7, eR: 0.65 }, talk1: { aR: -0.18, eR: 0.6 },
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
  const s = Math.sin(ph), c = Math.cos(ph), st = r.stride, kn = r.knee;
  return pose(r, { tR: -st * s, tL: st * s, kR: Math.max(0, c) * kn, kL: Math.max(0, -c) * kn, fR: 1 - 0.4 * Math.max(0, c), fL: 1 - 0.4 * Math.max(0, -c),
    aR: -0.12 + 0.4 * s, aL: 0.12 - 0.4 * s, eR: 0.12 + Math.max(0, -s) * 0.5, eL: 0.12 + Math.max(0, s) * 0.5, lean: 0.035 });
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
export function owns(a, roomId) {
  const f = figs[a.kind];
  if (!f || !rooms[roomId] || !rooms[roomId].ready || a.climb) return false;
  return f.rig ? true : roomId === 'hafen';
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
  if (R.anim) hafenAnim(R.anim, s);
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
  // Figuren an ihre Spielposition, Blickrichtung, Haltung, Cartoon-Mimik
  const seen = new Set();
  for (const a of actors) {
    const f = figs[a.kind]; if (!f || !a.visible || !owns(a, ctx.id)) continue;
    seen.add(a.kind);
    if (f.holder.parent !== R.scene) R.scene.add(f.holder);
    const p = toWorld(camera, a.x, a.y, _v.clone());
    if (f.last && a.walking) f.walkPh += p.distanceTo(f.last) / 0.62 * Math.PI;
    f.last = (f.last || new THREE.Vector3()).copy(p);
    const mf = typeof mimikForm === 'function' ? mimikForm(a, t) : null;
    f.holder.position.copy(p);
    if (mf && (mf.lift || mf.jx)) { const upm = unitsPerMeter(camera, p); if (mf.lift) f.holder.position.y += mf.lift / upm; if (mf.jx) f.holder.position.x += mf.jx / upm; }   // Sprung und Zittern in Spiel-Pixeln
    f.holder.scale.set(mf ? mf.sx : 1, mf ? mf.sy : 1, mf ? mf.sx : 1);
    // Blickrichtung: beim Gehen zum Ziel, sonst leicht zur Kamera gedreht wie die Sprites
    let want = a.dir < 0 ? -Math.PI + 0.56 : -0.56;
    if (a.walking && a.target) {
      const q = toWorld(camera, a.target[0] !== undefined ? a.target[0] : a.target.x, a.target[1] !== undefined ? a.target[1] : a.target.y, new THREE.Vector3());
      const dx = q.x - p.x, dz = q.z - p.z;
      if (dx * dx + dz * dz > 0.01) want = Math.atan2(-dz, dx);   // Blender-Gierwinkel: +x vorn, −y zur Kamera
    }
    let dy = want - f.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    f.yaw += dy * Math.min(1, dt / 120);
    f.holder.rotation.set(0, f.yaw, mf && mf.rot ? -mf.rot : 0, 'YXZ');   // Mimik-Neigung nach vorn (Wut) oder hinten (Verlegenheit)
    if (f.rig) {
      let p0 = pose(f.rig, {});
      if (a.walking) p0 = walkPose(f.rig, f.walkPh);
      else if (a.pose && (POSES[a.pose.kind] || POSES[a.pose.kind + '0'])) {
        const k = a.pose.kind, el = (t - a.pose.t0) / Math.max(1, a.pose.dur), env = Math.sin(Math.min(1, el) * Math.PI);
        const tgt = POSES[k] ? pose(f.rig, POSES[k]) : mix(pose(f.rig, POSES[k + '0']), pose(f.rig, POSES[k + '1']), 0.5 + 0.5 * Math.sin(t * 0.012));
        p0 = mix(p0, tgt, Math.min(1, env * 1.6));
      } else if (a.talking) p0 = mix(pose(f.rig, POSES.talk0), pose(f.rig, POSES.talk1), 0.5 + 0.5 * Math.sin(t * 0.007));
      else p0.lean = 0.012 * Math.sin(t * 0.0021);   // Atmen
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
        const offen = a.talking ? 1 + 2.2 * Math.abs(Math.sin(t * 0.018)) : 1;
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
