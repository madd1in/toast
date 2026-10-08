// ============================================================
//  Tentakel-Toast – Echtzeit-3D (Beta): der Hafen 1776 als echte 3D-Szene
//  three.js rendert die aus Blender exportierte Szene (img/3d/*.glb, art/blender/echt3d_export.py)
//  mit Toon-Schattierung, Tusche-Konturen und Schattenwurf. Die Kamera ist dieselbe wie beim
//  vorgerenderten Bild – deshalb passen Laufwege, Hotspots und Figurengrößen der Spiel-Logik genau.
//  Hoagie ist voll beweglich: seine Gelenke werden hier wie in Blender gestellt (figur_frames.py),
//  nur stufenlos – Gehen, Reden, Aufheben, Ziehen …
//  Wird erst geladen, wenn „Echtzeit-3D“ in den Einstellungen an ist (js/echt3d.js).
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export let ready = false;
const GW = 960, GH = 440;   // Spiel-Einheiten des Raumbilds
const INK = [0.04, 0.012, 0.07];
const nm = o => ((o && o.userData && o.userData.name) || (o && o.name) || '').replace(/\.\d+$/, '');   // Originalname (der Loader entfernt Punkte)
let renderer, effect, scene, camera, GRAD, sun;
const anim = { ship: null, shipQ: null, shipP: null, crew: [], clouds: [], waves: [], sea: null, seaBase: null, snake: null, snakeQ: null };
const figs = {};   // id -> { root, nodes, kind, ... }

// ---------- Materialien: Toon mit drei Stufen, Kontur wie Freestyle ----------
const matCache = new Map();
function toon(m, name) {
  const key = m.uuid + (name && /Wedel|Zunge|Gabel|Meer|Wolke/.test(name) ? 'n' : '');
  if (matCache.has(key)) return matCache.get(key);
  const glow = m.emissive && m.emissive.r + m.emissive.g + m.emissive.b > 0.02;
  const t = glow ? new THREE.MeshBasicMaterial({ color: m.color, map: m.map })
    : new THREE.MeshToonMaterial({ color: m.color, map: m.map, gradientMap: GRAD });
  t.side = m.side;
  const noLine = name && /Wedel|Zunge|Gabel|Meer|Wolke/.test(name);
  t.userData.outlineParameters = { thickness: 0.0032, color: INK, alpha: 1, visible: !noLine };
  matCache.set(key, t);
  return t;
}
function prep(root, { cast = false, receive = true } = {}) {
  root.traverse(o => {
    if (!o.isMesh) return;
    const n0 = nm(o) || nm(o.parent);
    o.material = Array.isArray(o.material) ? o.material.map(m => toon(m, n0)) : toon(o.material, n0);
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

// ---------- Aufbau ----------
export async function init(base = 'img/3d/') {
  const canvas = document.createElement('canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  effect = new OutlineEffect(renderer, { defaultThickness: 0.0032, defaultColor: INK, defaultAlpha: 1 });
  GRAD = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.RedFormat);
  GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true;

  const loader = new GLTFLoader();
  const [hafen, hoagie, guybrush, jack] = await Promise.all(['hafen', 'hoagie', 'guybrush', 'jack'].map(n => loader.loadAsync(base + n + '.glb')));
  scene = new THREE.Scene();
  // Himmel: Verlauf wie die Blender-Welt (Horizont hell, oben satt)
  const sky = document.createElement('canvas'); sky.width = 4; sky.height = 256;
  const sg = sky.getContext('2d'), lg = sg.createLinearGradient(0, 0, 0, 256);
  lg.addColorStop(0, '#3a8ad0'); lg.addColorStop(0.65, '#9ad8f0'); lg.addColorStop(1, '#9ad8f0');
  sg.fillStyle = lg; sg.fillRect(0, 0, 4, 256);
  scene.background = new THREE.CanvasTexture(sky); scene.background.colorSpace = THREE.SRGBColorSpace;

  // Licht: Sonne wie in raum_build.py (Rotation 0.95, 0.15, 0.65), weiches Grundlicht
  scene.add(new THREE.HemisphereLight(0xdff2ff, 0x6a5a40, 1.15));
  sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  const e = new THREE.Euler(0.95, 0.15, 0.65, 'ZYX'), d = new THREE.Vector3(0, 0, -1).applyEuler(e);
  const dir = new THREE.Vector3(d.x, d.z, -d.y);   // Blender (z oben) -> glTF (y oben)
  sun.position.copy(dir).multiplyScalar(-40).add(new THREE.Vector3(0, 0, -12));
  sun.target.position.set(0, 0, -12); scene.add(sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 120 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  scene.add(sun);

  // Hafen: Kamera aus dem Export, bewegliche Teile merken, Rest zusammenfassen
  const H = hafen.scene;
  camera = hafen.cameras[0] || new THREE.PerspectiveCamera(29.6, GW / GH, 0.1, 400);
  camera.aspect = GW / GH; camera.updateProjectionMatrix();
  prep(H);
  anim.ship = find(H, 'Schiff'); anim.shipQ = anim.ship.quaternion.clone(); anim.shipP = anim.ship.position.clone();
  anim.snake = find(H, 'Schlange_Kopf'); if (anim.snake) anim.snakeQ = anim.snake.quaternion.clone();
  anim.sea = find(H, 'Meer');
  H.traverse(o => {
    const n = nm(o);
    if (/^Wolke\d+$/.test(n)) anim.clouds.push({ o, x0: o.position.x, k: 0.6 + (n.charCodeAt(5) % 5) * 0.12 });
    if (/^Welle\d+$/.test(n)) anim.waves.push({ o, y0: o.position.y, s0: o.scale.clone(), ph: Math.random() * 6.28 });
    if (/^S_Crew\d$|^S_Ausguck$/.test(n)) anim.crew.push({ o, y0: o.position.y, ph: (n.charCodeAt(n.length - 1) % 4) / 4 });
  });
  // Steg, Lager, Fässer werfen Schatten; Figuren auch
  H.traverse(o => { if (o.isMesh) { const n = nm(o) || nm(o.parent); o.castShadow = /^(Fass|Kiste|Poller|Laterne|Lager|Dach|Kante|Seilrolle|Banane|Ananas|Mango|Wimpel)/.test(n); } });
  if (anim.ship) mergeUnder(anim.ship, c => /^S_Crew\d$|^S_Ausguck$/.test(nm(c)));
  for (const c of anim.crew) mergeUnder(c.o);
  const animated = n => n === 'Schiff' || n === 'Schlange' || n === 'Meer' || /^Wolke|^Welle/.test(n);
  const stat = mergeStatic(H, animated);
  scene.add(H); scene.add(stat);
  if (anim.sea) {   // Wellengang: Gitter bewegen
    anim.sea.material = anim.sea.material.clone(); anim.sea.receiveShadow = true;
    anim.seaBase = anim.sea.geometry.attributes.position.array.slice();
  }

  // Figuren
  addFig('hoagie', hoagie.scene, RIGS.hoagie);
  addFig('guybrush', guybrush.scene, null);
  addFig('jack', jack.scene, null);
  ready = true;
}

function addFig(id, root, rig) {
  prep(root, { cast: true, receive: true });
  const holder = new THREE.Group(); holder.name = 'Figur_' + id;
  // Wurzel ausrichten: die Figuren sind für die Kamera schon leicht gedreht exportiert – das macht hier die Blickrichtung
  const top = root.children.length === 1 ? root.children[0] : root;
  top.rotation.set(0, 0, 0); top.position.set(0, 0, 0);
  holder.add(root); scene.add(holder);
  const nodes = {}; root.traverse(o => { nodes[nm(o)] = o; });
  if (!rig) mergeUnder(top);
  else { const keep = [rig.mouth, ...rig.eyes]; for (const o of Object.values(nodes)) if (!o.isMesh && /^[A-Z]{1,2}R_|Rig$/.test(nm(o))) mergeUnder(o, c => keep.includes(nm(c)), true); }   // Augen und Mund bleiben beweglich
  for (const k of Object.keys(nodes)) delete nodes[k];
  root.traverse(o => { if (!o.userData.merged) nodes[nm(o)] = o; });
  const base = {}; for (const [k, o] of Object.entries(nodes)) base[k] = { q: o.quaternion.clone(), p: o.position.clone(), s: o.scale.clone() };
  figs[id] = { id, holder, root, top, nodes, base, rig, yaw: -0.56, walkPh: 0, last: null, blinkT: 2000 + Math.random() * 3000 };
}

// ---------- Hoagies Gelenke (wie figur_frames.py, stufenlos) ----------
const RIGS = {
  hoagie: { P: 'HR_', hz: 0.62, sole: 0.16, thigh: 0.24, shin: 0.22, stride: 0.5, knee: 0.9, abd: 0.24, mouth: 'RH_Mund', eyes: ['RH_AugeL', 'RH_AugeR', 'RH_PupilleL', 'RH_PupilleR'] },
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
  dig0: { aR: -0.95, eR: 0.5, aL: -0.8, eL: 0.6, tR: -0.22, tL: -0.22, kR: 0.45, kL: 0.45, lean: 0.06 },
  dig1: { aR: -0.05, eR: 0.5, aL: 0.1, eL: 0.6, tR: -0.52, tL: -0.52, kR: 1.05, kL: 1.05, lean: 0.06 },
  rope0: { aR: -1.9, eR: 0.4, aL: -3.0, eL: 0.4, xL: 0.3, tR: -0.2, tL: -0.2, kR: 0.4, kL: 0.4 },
  rope1: { aR: -3.0, eR: 0.4, xR: -0.3, aL: -1.9, eL: 0.4, tR: -0.2, tL: -0.2, kR: 0.4, kL: 0.4 },
};
function mix(a, b, k) { const o = {}; for (const key in a) o[key] = typeof a[key] === 'number' ? a[key] + (b[key] - a[key]) * k : a[key]; return o; }
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
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
const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _v = new THREE.Vector3(), _n = new THREE.Vector2();
function toWorld(x, y, out) {
  _n.set(x / GW * 2 - 1, 1 - y / GH * 2);
  ray.setFromCamera(_n, camera);
  return ray.ray.intersectPlane(ground, out) || out.set(0, 0, -10);
}

export function owns(a) { return !!figs[a.kind] && a.room === 'hafen'; }

// ---------- Bild für einen Spiel-Frame ----------
let lastT = 0;
export function frame(t, actors, pxW) {
  const w = Math.max(320, Math.min(1440, Math.round(pxW || 1280))), h = Math.round(w * GH / GW);
  if (renderer.domElement.width !== w) renderer.setSize(w, h, false);
  const dt = Math.min(100, Math.max(0, t - lastT)); lastT = t;
  const s = t / 1000;
  // Schiff schaukelt, Crew hüpft, Wolken ziehen, Wellen und Meer bewegen sich, die Anakonda pendelt
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
    for (let i = 0; i < arr.length; i += 3) {
      const x = b[i], z = b[i + 2];
      arr[i + 1] = b[i + 1] + Math.sin(x * 0.35 + s * 1.2) * 0.05 + Math.sin(z * 0.27 - s * 0.9) * 0.06;
    }
    pos.needsUpdate = true; anim.sea.geometry.computeVertexNormals();
  }
  // Figuren an ihre Spielposition, Blickrichtung, Haltung
  const seen = new Set();
  for (const a of actors) {
    const f = figs[a.kind]; if (!f || !a.visible) continue;
    seen.add(a.kind);
    const p = toWorld(a.x, a.y, _v);
    if (f.last && a.walking) f.walkPh += p.distanceTo(f.last) / 0.62 * Math.PI;
    f.last = (f.last || new THREE.Vector3()).copy(p);
    f.holder.position.copy(p);
    // Blickrichtung: beim Gehen zum Ziel, sonst leicht zur Kamera gedreht wie die Sprites
    let want = a.dir < 0 ? -Math.PI + 0.56 : -0.56;
    if (a.walking && a.target) {
      const q = toWorld(a.target[0] !== undefined ? a.target[0] : a.target.x, a.target[1] !== undefined ? a.target[1] : a.target.y, new THREE.Vector3());
      const dx = q.x - p.x, dz = q.z - p.z;
      if (dx * dx + dz * dz > 0.01) want = Math.atan2(-dz, dx);   // Blender-Gierwinkel: +x vorn, −y zur Kamera
    }
    let dy = want - f.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    f.yaw += dy * Math.min(1, dt / 120);
    f.holder.rotation.y = f.yaw;
    if (f.rig) {
      let p0 = pose(f.rig, {});
      if (a.walking) p0 = walkPose(f.rig, f.walkPh);
      else if (a.pose && POSES[a.pose.kind] || a.pose && POSES[a.pose.kind + '0']) {
        const k = a.pose.kind, el = (t - a.pose.t0) / Math.max(1, a.pose.dur), env = Math.sin(Math.min(1, el) * Math.PI);
        const tgt = POSES[k] ? pose(f.rig, POSES[k]) : mix(pose(f.rig, POSES[k + '0']), pose(f.rig, POSES[k + '1']), 0.5 + 0.5 * Math.sin(t * 0.012));
        p0 = mix(p0, tgt, Math.min(1, env * 1.6));
      } else if (a.talking) p0 = mix(pose(f.rig, POSES.talk0), pose(f.rig, POSES.talk1), 0.5 + 0.5 * Math.sin(t * 0.007));
      else p0.lean = 0.012 * Math.sin(t * 0.0021);   // Atmen
      applyPose(f, p0);
      const m = f.nodes[f.rig.mouth];
      if (m) { const b = f.base[f.rig.mouth].s; m.scale.set(b.x, a.talking ? b.y * (1 + 2.2 * Math.abs(Math.sin(t * 0.018))) : b.y, b.z); }
      f.blinkT -= dt; const blink = f.blinkT < 0;
      if (f.blinkT < -130) f.blinkT = 2200 + Math.random() * 3500;
      for (const e of f.rig.eyes) { const o = f.nodes[e]; if (o) { const b = f.base[e].s; o.scale.set(b.x, blink ? b.y * 0.12 : b.y, b.z); } }
    } else {
      f.root.scale.setScalar(1);
      f.root.position.y = Math.sin(t * 0.002 + a.x) * 0.006;   // Gäste: ruhiges Atmen
    }
  }
  for (const f of Object.values(figs)) f.holder.visible = seen.has(f.id);
  effect.render(scene, camera);
  return renderer.domElement;
}
