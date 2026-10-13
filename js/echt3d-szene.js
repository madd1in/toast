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
export function kontextProbe() { const x = renderer && renderer.getContext().getExtension('WEBGL_lose_context'); if (x) x.loseContext(); return !!x; }   // zum Ausprobieren der Wiederbelebung (Konsole)
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
  noLine = noLine || (name && (/Wedel|Zunge|Gabel|Meer|Wolke/.test(name) || /_Boden$/.test(name)));   // Bodenkante ohne Kontur (sonst sieht die Naht wie eine Stufe aus)
  const key = m.uuid + (noLine ? 'n' : '');
  if (matCache.has(key)) return matCache.get(key);
  const glow = m.emissive && m.emissive.r + m.emissive.g + m.emissive.b > 0.02;
  const t = glow ? new THREE.MeshBasicMaterial({ color: m.map ? 0xffffff : m.color, map: m.map })
    : new THREE.MeshToonMaterial({ color: m.color, map: m.map, gradientMap: GRAD });
  t.side = m.side; t.name = m.name;
  t.userData.outlineParameters = { thickness: 0.0032, color: INK, alpha: 1, visible: !noLine };
  if (!glow && t.map && TEXTUR_WELLIG.test(t.name || '') && !TEXTUR_GERADE.test(t.name || '')) texturWelle(t);
  matCache.set(key, t);
  return t;
}
// Muster wie von Hand gemalt: Pflastersteine, Dielen, Tapete, Ziegel und Wiese laufen in sanften Wellen statt in
// Linealreihen. Der Shader verschiebt die Bildkoordinaten nach der Weltlage (Meter) – gleich stark, egal wie fein
// eine Textur gekachelt ist (Bildkoordinaten pro Meter aus den Ableitungen). Schilder, Bilder und Himmel bleiben gerade.
const TEXTUR_WELLIG = /Pflaster|Mauer|Rasen|Dielen|Ziegel|Erde|Wiese|Stein|Putz|Holz|Gras|Fels|Sand|Teppich|Paneel|Boden|Kacheln|Parkett|Tapete|Marmor|Wand|Steg|Taefel|Ufer/;
const TEXTUR_GERADE = /Himmel|Landschaft|Zifferblatt|Zettel|Tafel|Plakat|Gemaelde|Dia\b|Banner|Fahne|Flagge|Segel|Anakonda|Glas|Moebel/;
function texturWelle(t) {
  t.onBeforeCompile = sh => {
    sh.vertexShader = 'varying vec3 vWellLage;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWellLage = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWellLage;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
      vec3 wl = vWellLage;
      float uvProM = max(length(dFdx(vMapUv)), length(dFdy(vMapUv))) / max(1e-4, max(length(dFdx(wl)), length(dFdy(wl))));
      vec2 welle = vec2(sin(wl.x * 0.85 + wl.z * 0.55 + wl.y * 0.6 + 1.3) + 0.6 * sin(wl.z * 1.7 - wl.x * 0.45 + wl.y * 1.1),
                        sin(wl.z * 1.05 - wl.x * 0.7 + wl.y * 0.8 + 2.1) + 0.6 * sin(wl.x * 1.9 + wl.y * 1.3 + 0.3));
      diffuseColor *= texture2D(map, vMapUv + welle * 0.075 * min(uvProM, 8.0));
    #endif`);
  };
  t.customProgramCacheKey = () => 'welle';
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
// Renderer: erst mit voller Qualität, sonst sparsam (Xbox, ältere Grafikchips) – ohne Kantenglättung und Schatten
let neuT = 0;
function rendererBauen() {
  let canvas = null, sparsam = false, r = null;
  for (const opt of [{ antialias: !SPARSAM, powerPreference: 'high-performance' }, { antialias: false, powerPreference: 'low-power' }]) {
    try {
      canvas = document.createElement('canvas');
      r = new THREE.WebGLRenderer({ canvas, preserveDrawingBuffer: true, alpha: false, failIfMajorPerformanceCaveat: false, ...opt });
      break;
    } catch (e) { console.warn('Echtzeit-3D: Renderer', opt, e); r = null; sparsam = true; }
  }
  if (!r) throw new Error('WebGL-Renderer ließ sich nicht starten');
  r.setPixelRatio(1);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.shadowMap.enabled = !sparsam && !SPARSAM;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.shadowMap.autoUpdate = false;   // Schatten jedes zweite Bild (frame) – spart fast die Hälfte der Schattenkosten
  // Kontext verloren (Grafikspeicher voll, Konsole im Hintergrund, Zeitreise in einen großen Raum): nicht aufgeben –
  // sparsamer werden und kurz auf die Rückgabe warten; kommt sie nicht (Edge auf der Xbox gibt ihn oft nie zurück),
  // einen frischen Renderer bauen und den Raum neu laden
  canvas.addEventListener('webglcontextlost', e => {
    if (r !== renderer) return;
    e.preventDefault(); kontextWeg = true; kontextVerluste++; sparStufe = Math.max(sparStufe, 1);
    console.warn('Echtzeit-3D: WebGL-Kontext verloren');
    if (typeof note === 'function') note('Echtzeit-3D: Grafikspeicher knapp – kurz das gemalte Bild, 3D kommt gleich wieder.');
    clearTimeout(neuT); neuT = setTimeout(neuStarten, 2000);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    if (r !== renderer) return;
    clearTimeout(neuT);
    console.warn('Echtzeit-3D: WebGL-Kontext wieder da');
    for (const R of Object.values(rooms)) if (R.ready && R.id !== letzterRaum) raumFreigeben(R);
    kontextWeg = false;
  });
  renderer = r;
  effect = new OutlineEffect(r, { defaultThickness: 0.0032, defaultColor: INK, defaultAlpha: 1 });
}
function neuStarten() {
  if (!kontextWeg) return;
  try {
    const alt = renderer;
    for (const id of Object.keys(rooms)) delete rooms[id];   // die Räume lagen im verlorenen Kontext – frisch laden
    matCache.clear(); letzterRaum = null; letzterSchatten = null; fischRT = null; postRT = { 1: null, 2: null }; glanzA = glanzB = farbA = farbB = null;
    rendererBauen();
    try { alt.dispose(); } catch (e) { /* schon weg */ }
    kontextWeg = false;
    console.warn('Echtzeit-3D: neuer Renderer');
  } catch (e) { console.warn('Echtzeit-3D: Neustart', e); neuT = setTimeout(neuStarten, 5000); }
}
export async function init(base = 'img/3d/') {
  BASE = base;
  rendererBauen();
  GRAD = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.RedFormat);
  GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true;
  loader = new GLTFLoader();
  schilderP = fetch(BASE + 'schilder.json' + V).then(r => r.json()).catch(() => ({}));
  const ids = [...HELDEN, 'guybrush', 'jack'];
  const glbs = await Promise.all(ids.map(n => loader.loadAsync(BASE + n + '.glb' + V)));
  ids.forEach((id, i) => addFig(id, glbs[i].scene, RIGS[id] || null));
  ready = true;
}

// Raum laden (einmal); bis er da ist, zeigt das Spiel das vorgerenderte Bild
export function hasRoom(id) {
  const r = rooms[id];
  if (r && r.failed && (r.versuche || 1) < 3 && performance.now() - (r.failT || 0) > 12000) delete rooms[id];   // später noch einmal versuchen
  else if (r) { r.benutzt = performance.now(); return r.ready; }
  const versuche = (r && r.versuche || 0) + 1;
  raeumeAuf(id);
  rooms[id] = { id, loading: true, ready: false, benutzt: performance.now(), versuche };
  (id === 'hafen' ? ladeHafen() : ladeRaum(id)).then(x => { Object.assign(rooms[id], x, { ready: true, loading: false }); },
    e => {
      console.error('Echtzeit-3D', id, e); rooms[id].failed = true; rooms[id].failT = performance.now(); sparStufe = Math.max(sparStufe, 1);
      if (typeof note === 'function') note(`Echtzeit-3D: Raum „${id}“ ließ sich nicht laden (${String((e && e.message) || e).slice(0, 80)}) – dort bleibt das vorgerenderte Bild.`);
    });
  return false;
}
// Grafikspeicher schonen: am PC vier Räume im Speicher, auf Xbox und kleinen Geräten zwei; nach einem Speicher-Engpass nur
// noch der Raum, in dem man gerade ist (der vorige wird freigegeben, bevor der nächste lädt)
const SPARSAM = /xbox/i.test(navigator.userAgent || '') || !!(navigator.deviceMemory && navigator.deviceMemory <= 4);
let sparStufe = /xbox/i.test(navigator.userAgent || '') ? 1 : SPARSAM ? 0 : -1, kontextVerluste = 0;
export function speicherInfo() { return { sparsam: SPARSAM, stufe: sparStufe, verluste: kontextVerluste, raeume: Object.values(rooms).filter(r => r.ready).map(r => r.id) }; }
function raeumeAuf(neu) {
  const max = sparStufe >= 0 ? 0 : 2;   // so viele weitere Räume dürfen bleiben (neben dem neuen und – außer im Engpass – dem aktuellen)
  const geladen = Object.values(rooms).filter(r => r.ready && r.id !== neu && (sparStufe >= 1 || r.id !== letzterRaum));
  geladen.sort((a, b) => (a.benutzt || 0) - (b.benutzt || 0));
  while (geladen.length > max) raumFreigeben(geladen.shift());
}
function raumFreigeben(R) {
  for (const f of Object.values(figs)) if (f.holder.parent === R.scene) R.scene.remove(f.holder);   // Figuren gehören allen Räumen
  for (const k of karten.values()) if (k.mesh.parent === R.scene) R.scene.remove(k.mesh);
  R.scene.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    for (const m of [].concat(o.material || [])) { for (const v of Object.values(m)) if (v && v.isTexture && v !== GRAD) v.dispose(); m.dispose(); }
  });
  if (R.scene.background && R.scene.background.dispose) R.scene.background.dispose();
  const weg = new Set(); R.scene.traverse(o => { for (const m of [].concat(o.material || [])) weg.add(m); });
  for (const [k, m] of matCache) if (weg.has(m)) matCache.delete(k);   // sonst blieben Bilder der Texturen im Speicher
  delete rooms[R.id];
}
export function failed(id) { return !!(rooms[id] && rooms[id].failed); }
export function raumGeladen(id) { return !!(rooms[id] && rooms[id].ready); }   // nur nachsehen, nichts laden

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

// Lobby-Treppe an der linken Seitenwand: 14 Stufen (Blender x0, x1, y0, y1, Oberkante), von vorn nach hinten hinauf
export const LOBBY_TREPPE = Array.from({ length: 14 }, (_, i) => [-8.05, -6.85, 5.6 + i * 0.47, 6.07 + i * 0.47, 0.3 * (i + 1)]);

// ---------- Kollision: Möbel und Einbauten als Kisten (Blender x0, x1, y0, y1, Oberkante) ----------
// Was auf dem Boden steht (Sofa, Automat, Tresen, Tische, Schränke, Uhren), versperrt der gesteuerten Figur den Weg;
// niedrige Dinge sind Plattformen wie in Super Mario 64: hinaufspringen und obendrauf herumlaufen.
const _kb = new THREE.Box3(), FIGUR_R = 0.28, STUFE = 0.4;   // so hoch steigt man ohne Sprung (Treppenstufe, Bordstein, Podest)
const KISTEN_EXTRA = { lobby: LOBBY_TREPPE, auffahrt: [[-4.8, 0.2, 9.95, 12.05, 2.6], [-9.8, 9.8, 18.4, 28.6, 13]] };   // Tourbus und Spukhaus   // Tourbus und Villa (zu groß für die automatischen Kisten)   // eigene Bauten (Treppe) sperren von der Seite ebenfalls
function kollisionsKisten(root, out = [], beweglichRe = null) {
  root.updateMatrixWorld(true);
  const visit = list => {
    for (const c of list) {
      const n = nm(c);
      if (/^Figur_|^Kamera|^Camera|Wasser|Blase|Meer|Welle|Rauch|Licht|Strahl/.test(n) || (beweglichRe && beweglichRe.test(n)) || c.isLight || c.isCamera) continue;   // Bewegtes und Flüssiges sperrt nicht
      _kb.setFromObject(c); if (_kb.isEmpty()) continue;
      const { min, max } = _kb, bx = max.x - min.x, by = max.z - min.z;
      if (bx > 6 || by > 6 || bx * by > 14) { if (c.children.length) visit(c.children); continue; }   // Boden, Wände, Decke, Gruppen
      if (min.y > 0.5 || min.y < -0.3 || max.y < 0.3 || Math.min(bx, by) < 0.04) continue;   // Wandschmuck, Teppiche, Schächte
      out.push({ k: [min.x, max.x, -max.z, -min.z, max.y], o: c });
    }
  };
  visit(root.children);
  return out;
}
function sichtbar(o) { for (let q = o; q; q = q.parent) if (q.visible === false) return false; return true; }
function kisteSperrt(R, x, y, z) {   // steht an (x, y) etwas, das höher ist als eine Stufe über den Füßen?
  const r = FIGUR_R;
  for (const { k, o } of R.kisten) if (k[4] > z + STUFE && x > k[0] - r && x < k[1] + r && y > k[2] - r && y < k[3] + r && (!o || sichtbar(o))) return true;
  return false;
}
function kollision(R, a, p, id, erzwingen) {   // gesteuerte Figur: nicht durch Möbel, sondern an der Kante entlang
  const z = Math.max(0, a._z3d || 0);
  if (!kisteSperrt(R, p.x, -p.z, z)) { a._frei3d = [a.x, a.y, id]; return p; }
  const alt = a._frei3d;
  if (!erzwingen || !alt || alt[2] !== id) return p;
  const q = new THREE.Vector3(), nx = a.x, ny = a.y, frei = (x, y) => { toWorld(R.home, x, y, q); return !kisteSperrt(R, q.x, -q.z, z); };
  // ein Spiel-Schritt kann hinten im Raum 30 cm weit sein: bis an die Kante herantasten, dann an ihr entlang rutschen
  let lo = 0, hi = 1;
  for (let i = 0; i < 6; i++) { const t = (lo + hi) / 2; if (frei(alt[0] + (nx - alt[0]) * t, alt[1] + (ny - alt[1]) * t)) lo = t; else hi = t; }
  let bx = alt[0] + (nx - alt[0]) * lo, by = alt[1] + (ny - alt[1]) * lo;
  if (frei(nx, by)) bx = nx; else if (frei(bx, ny)) by = ny;
  a.x = bx; a.y = by; a._frei3d = [bx, by, id]; a._gestossen3d = performance.now();
  return toWorld(R.home, bx, by, q);
}

// ---------- übersetzte Schilder (img/3d/schilder.json, js/schilder.js): Schrift-Meshes gegen Texturen tauschen ----------
let schilderP = Promise.resolve({});
function schildTextur(st) {   // Text in Schildgröße auf eine Leinwand, Zeilen und Schriftgröße passend
  const ziel = typeof schildText === 'function' ? schildText(st.t) : st.t;
  if (st.zuletzt === ziel) return;
  st.zuletzt = ziel;
  const c = st.canvas, g = c.getContext('2d'), zeilen = String(ziel).split('\n');
  g.clearRect(0, 0, c.width, c.height);
  let fs = c.height / zeilen.length * 0.84;
  g.font = `400 ${fs}px "Titan One", sans-serif`;
  const breit = Math.max(...zeilen.map(z => g.measureText(z).width));
  if (breit > c.width * 0.96) fs *= c.width * 0.96 / breit;
  g.font = `400 ${fs}px "Titan One", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  zeilen.forEach((z, i) => {
    const y = c.height / 2 + (i - (zeilen.length - 1) / 2) * fs * 1.02;
    g.lineWidth = Math.max(2, fs * 0.12); g.strokeStyle = '#140a1c'; g.strokeText(z, c.width / 2, y);
    g.fillStyle = st.farbe; g.fillText(z, c.width / 2, y);
  });
  st.tex.needsUpdate = true;
}
function schilderBauen(H, liste) {   // vor dem Verbiegen: die Tafeln biegen sich mit dem Raum
  const out = [];
  if (!liste) return out;
  H.traverse(o => {
    const st = o.isMesh && liste[nm(o)]; if (!st || !st.t) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox, w = bb.max.x - bb.min.x, h = bb.max.z - bb.min.z;
    if (w < 0.02 || h < 0.01) return;
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = Math.max(32, Math.min(512, Math.round(512 * h / w * 1.25)));
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }); mat.userData.outlineParameters = { visible: false };
    const geo = new THREE.PlaneGeometry(w * 1.04, h * 1.25, 4, 2); geo.rotateX(-Math.PI / 2);   // Schrift liegt im glTF in der x-z-Ebene, Vorderseite +y
    geo.translate((bb.min.x + bb.max.x) / 2, bb.max.y + 0.004, (bb.min.z + bb.max.z) / 2);
    const tafel = new THREE.Mesh(geo, mat); tafel.name = 'Schild_' + nm(o);
    tafel.position.copy(o.position); tafel.quaternion.copy(o.quaternion); tafel.scale.copy(o.scale);
    o.parent.add(tafel); tafel.visible = false;
    out.push({ mesh: o, tafel, canvas, tex, t: st.t, farbe: st.c || '#ffe066', zuletzt: null });
  });
  return out;
}
function schilderTick(R) {   // jede Sekunde: Sprache gewechselt oder Übersetzung eingetroffen?
  if (!R.schilder || !R.schilder.length) return;
  const jetzt = performance.now(); if (jetzt - (R.schildT || 0) < 1000) return; R.schildT = jetzt;
  for (const st of R.schilder) {
    const ziel = typeof schildText === 'function' ? schildText(st.t) : st.t, an = !!ziel && ziel !== st.t;   // übersetzt oder umgewidmet
    st.mesh.visible = !an; st.tafel.visible = an;
    if (an) schildTextur(st);
  }
}

async function ladeRaum(id) {
  const reqDef = REQUISITEN[id];
  const [gltf, data, reqGltf] = await Promise.all([loader.loadAsync(BASE + id + '.glb' + V), fetch(BASE + id + '.json' + V).then(r => r.json()),
    reqDef ? loader.loadAsync(BASE + reqDef.datei + '.glb' + V).catch(e => { console.error('Echtzeit-3D Requisiten', id, e); return null; }) : null]);
  const scene = new THREE.Scene(), H = gltf.scene;
  const [hor, top] = data.himmel && data.himmel.length ? data.himmel : HIMMEL_EXTRA[id] || ['#3a2a50', '#140828'];
  scene.background = himmel(top, hor);
  scene.userData.horizont = hor;
  const camera = gltf.cameras[0] || new THREE.PerspectiveCamera(29.6, GW / GH, 0.1, 400);
  camera.aspect = GW / GH; camera.updateProjectionMatrix();
  // Licht aus Blender: Sonnen als gerichtetes Licht (die stärkste wirft Schatten), Lampen als Punktlichter
  grundlicht(scene, new THREE.Color(hor).lerp(new THREE.Color(0xffffff), 0.55), new THREE.Color(0x2a1a30), 1.0);
  const suns = data.lichter.filter(l => l.typ === 'SUN').sort((a, b) => b.energie - a.energie);
  suns.forEach((l, i) => sonne(scene, bl(...l.richtung).normalize(), new THREE.Color(...l.farbe), Math.min(3.2, l.energie * 0.55), i === 0));
  if (!suns.length) sonne(scene, new THREE.Vector3(0.4, -0.8, -0.45).normalize(), 0xfff0e0, 1.6, true);
  let kegel = 0;
  for (const l of data.lichter.filter(l => l.typ !== 'SUN').sort((a, b) => b.energie - a.energie).slice(0, 8)) {
    const p = new THREE.PointLight(new THREE.Color(...l.farbe), l.energie * 0.035, l.weite || 9, 2);
    p.position.copy(bl(...l.ort)); scene.add(p);
    if (POST.an && kegel < 6 && p.position.y > 1.7 && p.position.y < 6) { lichtKegel(scene, p.position, new THREE.Color(...l.farbe)); kegel++; }
  }
  // Teile, die Zustände oder Bewegung haben, bleiben eigene Objekte; der Rest wird zusammengefasst
  const beweglich = new Set();
  for (const [vis, hid] of Object.values(data.zustaende || {})) for (const n of [...vis, ...hid]) beweglich.add(n);
  for (const s of Object.values(data.sprites || {})) for (const n of s.teile) beweglich.add(n);
  prep(H, { cast: false, receive: true, ohne: new Set(data.ohneKontur || []) });
  if (RAUM_VORBAU[id]) RAUM_VORBAU[id](H);
  H.traverse(o => { if (o.isMesh && beweglich.has(nm(o))) o.castShadow = true; });
  const extraRe = EXTRA_BEWEGLICH[id];
  const kisten = kollisionsKisten(H, [], extraRe);
  const schildListe = (await schilderP)[id] || null;   // Schrift-Meshes bleiben einzeln (für die Übersetzung)
  const stat = mergeStatic(H, n => beweglich.has(n) || !!(extraRe && extraRe.test(n)) || !!(schildListe && schildListe[n]));
  const schilder = schilderBauen(H, schildListe);
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
  if (req) for (const r of Object.values(req)) kollisionsKisten({ children: [r.o], updateMatrixWorld() {} }, kisten);
  for (const k of KISTEN_EXTRA[id] || []) kisten.push({ k, o: null });
  const innen = INNENRAUM.has(id) ? raumSchliessen(scene, camera, id) : null;
  if (innen) kisten.push(...innen.dekoKisten);   // Möbel an der Vorderwand (nur bei gedrehter Kamera da)
  if (DRAUSSEN.has(id)) baeumeVerbiegen(scene);
  if (KRUMM[id]) krummBiegen(scene, KRUMM[id]);
  const leben = draussenLeben(scene, id, camera) || (innen && POST.an ? schwebeStaub(scene, innen) : null);   // draußen Wolken und Vögel, drinnen Staub im Licht
  return { scene, camera, data, leben, nodes, sprites, extra, req, krumm: KRUMM[id] || null, innen, kisten, schilder };
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
  figurVerbiegen(id, holder);
  holder.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) randLicht(m); });
  figs[id] = { id, holder, root, top, nodes, base, rig, yaw: -0.56, walkPh: 0, last: null, blinkT: 2000 + Math.random() * 3000 };
}
// Randlicht wie in Psychonauts 2: die Silhouette der Figuren leuchtet warm (Fresnel), hebt sie vom Raum ab
function randLicht(m) {
  if (!m || m.userData.randLicht || !m.isMeshToonMaterial) return;
  m.userData.randLicht = true;
  m.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `{ float fr = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
      outgoingLight += vec3(1.0, 0.8, 0.6) * pow(fr, 2.8) * 0.3; }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'randlicht';
  m.needsUpdate = true;
}
// Figuren wie gezeichnet – jede auf ihre Art schief: lehnt sich zur Seite, steht im S, dreht die Schultern gegen die
// Hüfte, wird oben breiter oder schmaler und streckt sich. In der Grundhaltung einmal in die Form gebacken (in
// Figuren-Koordinaten, die Füße bleiben, wo sie sind); die Gelenke bewegen die verbogenen Teile danach wie gewohnt
function figurVerbiegen(id, holder) {
  holder.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(holder), H = Math.max(0.3, bb.max.y - Math.max(0, bb.min.y)), y0 = Math.max(0, bb.min.y);
  let s = 11; for (const ch of id) s = (s * 31 + ch.charCodeAt(0)) % 10007;
  const r = k => ((s * (k * 2654435761 % 977 + 1)) % 1000) / 500 - 1;   // feste Zufallszahlen je Figur (-1 … 1)
  const lx = 0.14 * r(1), lz = 0.08 * r(2), sk = 0.06 * r(3), dreh = 0.42 * r(4), beule = 0.12 + 0.06 * r(5), ph = 3 * r(6), streck = 0.1 * r(7);
  const inv = new THREE.Matrix4().copy(holder.matrixWorld).invert(), m = new THREE.Matrix4(), mi = new THREE.Matrix4(), v = new THREE.Vector3();
  holder.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    o.geometry = o.geometry.clone();   // Teile teilen sich manchmal ein Modell (Augen) – jedes biegt seine Kopie
    m.multiplyMatrices(inv, o.matrixWorld); mi.copy(m).invert();
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      const h = Math.max(0, (v.y - y0) / H), w = dreh * h, c = Math.cos(w), sn = Math.sin(w), b = 1 + beule * Math.sin(h * Math.PI * 1.4 + ph) * h;
      const x = v.x * b, z = v.z * b;
      v.x = x * c - z * sn + lx * H * h * h + sk * H * Math.sin(h * Math.PI * 1.6);
      v.z = x * sn + z * c + lz * H * h * h;
      v.y = y0 + (v.y - y0) * (1 + streck * h);
      v.applyMatrix4(mi); pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true; o.geometry.computeBoundingBox(); o.geometry.computeBoundingSphere();
  });
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

// ---------- Fischauge: Tonnenverzeichnung als letzter Bildschritt (freie Kamera, Kameraflüge) ----------
// Die Szene wird etwas weitwinkliger in ein Zwischenbild gerechnet, ein Shader zieht die Mitte groß und staucht den
// Rand rund – wie eine Fischaugen-Linse. Klicks und Sprechblasen-Punkte rechnen dieselbe Verzeichnung hin und zurück.
// In der Bühnenansicht (gemalte Kamera) bleibt das Bild unverzerrt, damit es Punkt für Punkt zum Spiel passt.
// k: Stärke (Mitte 1 + k·(Seitenverhältnis² + 1) mal vergrößert), ss: Zwischenbild entsprechend feiner gerechnet, damit
// die vergrößerte Mitte nicht pixelig wird (statt 4× Kantenglättung – das Überabtasten glättet die Kanten mit)
const FISCH = { k: 0.06, fovPlus: 11, ss: 1.35 };
const fischPlus = () => SPARSAM ? 0 : FISCH.fovPlus;   // Xbox und schwache Geräte: ohne Linse (spart einen ganzen Bildschritt)
const ASP = 960 / 440;
let fischS = 0, fischRT = null, fischMat = null, fischSzene = null, fischKam = null;
const fischZ = k => 1 / (1 + k * (ASP * ASP + 1));   // Ecken bleiben Ecken: nichts außerhalb des Zwischenbilds
function fischVor(v) {   // Bildschirm (NDC) -> Punkt im unverzerrten Zwischenbild
  const k = FISCH.k * fischS; if (!k) return v;
  const px = v.x * ASP, f = (1 + k * (px * px + v.y * v.y)) * fischZ(k);
  return v.set(v.x * f, v.y * f);
}
function fischZurueck(v) {   // Punkt im unverzerrten Bild (NDC) -> Stelle auf dem Bildschirm
  const k = FISCH.k * fischS; if (!k) return v;
  const z = fischZ(k), ux = v.x, uy = v.y; let sx = ux, sy = uy;
  for (let i = 0; i < 8; i++) { const px = sx * ASP, f = (1 + k * (px * px + sy * sy)) * z; sx = ux / f; sy = uy / f; }
  return v.set(sx, sy, v.z);
}
function fischZiel(R) { if (SPARSAM) return 0; if (R.flug) return 1; const o = R.orbit; return o ? Math.min(1, Math.max(0, o.w || 0)) : 0; }
function fischBauen() {
  fischKam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  fischMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null }, k: { value: 0 }, z: { value: 1 }, asp: { value: ASP } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tex; uniform float k; uniform float z; uniform float asp; varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0, a = vec2(p.x * asp, p.y);
        vec2 uv = p * (1.0 + k * dot(a, a)) * z * 0.5 + 0.5;
        gl_FragColor = texture2D(tex, uv);
        gl_FragColor.rgb *= 1.0 - 2.4 * k * smoothstep(0.75, 1.5, length(p));   // Linsenrand etwas dunkler
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fischMat); quad.frustumCulled = false;
  fischSzene = new THREE.Scene(); fischSzene.add(quad);
}

// ---------- Nachbearbeitung (Psychonauts-2-Look): Leuchten (Bloom), Farbgebung, Vignette – und die Fischaugen-Linse ----------
// Szene ins Zwischenbild (mit 4× Kantenglättung, mit Linse 1,35× feiner); helle Stellen (Lampen, Fenster, Goldtoast,
// Glibber) werden auf Viertelgröße herausgezogen und weichgezeichnet, dann alles in einem Schritt zusammengesetzt.
const POST = { an: !SPARSAM, bloom: 0.6, schwelle: 0.8, saett: 1.14, waerme: [1.035, 1.0, 0.965], schattenLila: [0.014, 0.005, 0.024], vignette: 0.32 };
let farbA = null, farbB = null, postRT = { 1: null, 2: null }, glanzA = null, glanzB = null, hellMat = null, weichMat = null, postMat = null, postSzene = null, postKam = null, postQuad = null;
const POST_VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
function postBauen() {
  postKam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); postQuad.frustumCulled = false;
  postSzene = new THREE.Scene(); postSzene.add(postQuad);
  const shader = (uniforms, fs) => new THREE.ShaderMaterial({ uniforms, vertexShader: POST_VS, fragmentShader: fs, depthTest: false, depthWrite: false });
  hellMat = shader({ tex: { value: null }, schwelle: { value: POST.schwelle } }, `uniform sampler2D tex; uniform float schwelle; varying vec2 vUv;
    void main() { vec3 c = texture2D(tex, vUv).rgb; float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); gl_FragColor = vec4(c * smoothstep(schwelle, schwelle + 0.18, l), 1.0); }`);
  weichMat = shader({ tex: { value: null }, schritt: { value: new THREE.Vector2() } }, `uniform sampler2D tex; uniform vec2 schritt; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tex, vUv).rgb * 0.227027;
      c += (texture2D(tex, vUv + schritt * 1.3846).rgb + texture2D(tex, vUv - schritt * 1.3846).rgb) * 0.316216;
      c += (texture2D(tex, vUv + schritt * 3.2308).rgb + texture2D(tex, vUv - schritt * 3.2308).rgb) * 0.070270;
      gl_FragColor = vec4(c, 1.0);
    }`);
  postMat = shader({ tiefe: { value: null }, unscharf: { value: null }, dof: { value: 0 }, fokus: { value: 8 }, nah: { value: 0.1 }, fern: { value: 500 }, tex: { value: null }, glanz: { value: null }, k: { value: 0 }, z: { value: 1 }, asp: { value: ASP }, bloom: { value: POST.bloom }, saett: { value: POST.saett },
    waerme: { value: new THREE.Vector3(...POST.waerme) }, lila: { value: new THREE.Vector3(...POST.schattenLila) }, vignette: { value: POST.vignette } },
  `uniform sampler2D tex; uniform sampler2D glanz; uniform sampler2D tiefe; uniform sampler2D unscharf; uniform float dof; uniform float fokus; uniform float nah; uniform float fern;
    uniform float k; uniform float z; uniform float asp; uniform float bloom; uniform float saett;
    uniform vec3 waerme; uniform vec3 lila; uniform float vignette; varying vec2 vUv;
    void main() {
      vec2 p = vUv * 2.0 - 1.0, a = vec2(p.x * asp, p.y);
      vec2 uv = p * (1.0 + k * dot(a, a)) * z * 0.5 + 0.5;   // Fischauge (k = 0: unverzerrt)
      vec3 c = texture2D(tex, uv).rgb;
      if (dof > 0.0) {   // Kamerafahrt: was weit hinter dem Tentakel liegt, wird weich (Kino-Tiefenunschärfe)
        float zn = texture2D(tiefe, uv).x * 2.0 - 1.0, d = 2.0 * nah * fern / (fern + nah - zn * (fern - nah));
        c = mix(c, texture2D(unscharf, uv).rgb, smoothstep(fokus + 4.0, fokus + 26.0, d) * dof);
      }
      c += texture2D(glanz, uv).rgb * bloom;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, saett);                       // satter
      c = c * waerme + lila * (1.0 - clamp(l * 2.0, 0.0, 1.0));   // Lichter warm, Schatten ins Lila
      c *= 1.0 - vignette * smoothstep(0.55, 1.45, length(p * vec2(0.92, 1.0)));
      c *= 1.0 - 2.4 * k * smoothstep(0.75, 1.5, length(p));
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`);
}
export function nachbearbeitung(an) { if (an != null) POST.an = !!an && !SPARSAM; return POST.an; }   // Schalter (Einstellungen, Messen)
function postPass(mat, ziel) { postQuad.material = mat; renderer.setRenderTarget(ziel); renderer.render(postSzene, postKam); }
function postRender(R, camera, w, h) {
  if (!postMat) postBauen();
  const fein = fischS > 0.01, art = fein ? 2 : 1, rw = fein ? Math.min(2560, Math.round(w * FISCH.ss)) : w, rh = Math.round(h * rw / w);
  let rt = postRT[art];
  if (!rt || rt.width !== rw || rt.height !== rh) {
    if (rt) rt.dispose();
    rt = postRT[art] = new THREE.WebGLRenderTarget(rw, rh, { samples: fein ? 0 : 4, colorSpace: THREE.SRGBColorSpace });
    if (fein) rt.depthTexture = new THREE.DepthTexture(rw, rh);   // für die Tiefenunschärfe in Kamerafahrten
  }
  const qw = Math.max(64, Math.round(w / 4)), qh = Math.max(32, Math.round(h / 4));
  if (!glanzA || glanzA.width !== qw || glanzA.height !== qh) {
    if (glanzA) { glanzA.dispose(); glanzB.dispose(); }
    glanzA = new THREE.WebGLRenderTarget(qw, qh, { type: THREE.HalfFloatType }); glanzB = new THREE.WebGLRenderTarget(qw, qh, { type: THREE.HalfFloatType });
    if (farbA) { farbA.dispose(); farbB.dispose(); }
    farbA = new THREE.WebGLRenderTarget(qw, qh, { type: THREE.HalfFloatType }); farbB = new THREE.WebGLRenderTarget(qw, qh, { type: THREE.HalfFloatType });
  }
  renderer.setRenderTarget(rt); effect.render(R.scene, camera);
  hellMat.uniforms.tex.value = rt.texture; postPass(hellMat, glanzA);
  for (const weit of [1, 2.2]) {   // zweimal weichzeichnen, beim zweiten Mal weiter: ein breiter, weicher Schein
    weichMat.uniforms.tex.value = glanzA.texture; weichMat.uniforms.schritt.value.set(weit / qw, 0); postPass(weichMat, glanzB);
    weichMat.uniforms.tex.value = glanzB.texture; weichMat.uniforms.schritt.value.set(0, weit / qh); postPass(weichMat, glanzA);
  }
  const kino = !!(R.flug && fein && rt.depthTexture);
  if (kino) {   // unscharfe Farbfassung (Viertelgröße) für den Hintergrund
    weichMat.uniforms.tex.value = rt.texture; weichMat.uniforms.schritt.value.set(1 / qw, 0); postPass(weichMat, farbB);
    weichMat.uniforms.tex.value = farbB.texture; weichMat.uniforms.schritt.value.set(0, 1 / qh); postPass(weichMat, farbA);
    weichMat.uniforms.tex.value = farbA.texture; weichMat.uniforms.schritt.value.set(1.8 / qw, 0); postPass(weichMat, farbB);
    weichMat.uniforms.tex.value = farbB.texture; weichMat.uniforms.schritt.value.set(0, 1.8 / qh); postPass(weichMat, farbA);
    const ziel = R.flugKT || R.flugBlick || R.ziel || camera.position;
    postMat.uniforms.nah.value = camera.near; postMat.uniforms.fern.value = camera.far;
    postMat.uniforms.fokus.value = camera.position.distanceTo(ziel); postMat.uniforms.tiefe.value = rt.depthTexture; postMat.uniforms.unscharf.value = farbA.texture;
  }
  postMat.uniforms.dof.value = kino ? 0.85 : 0;
  const k = FISCH.k * fischS;
  postMat.uniforms.tex.value = rt.texture; postMat.uniforms.glanz.value = glanzA.texture; postMat.uniforms.k.value = k; postMat.uniforms.z.value = fein ? fischZ(k) : 1;
  postPass(postMat, null);
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
// erst bei Bedarf geladen: Dr. Fred, die Gäste und die Tentakel (ohne Gelenke: sie stehen und atmen; ohne Modell bleibt die Bildkarte)
const SPAETER = new Set(['drfred', 'sam', 'max', 'dave', 'salad', 'affe', 'bender', 'prof', 'zoid', 'glados', 'simon', 'bobbin', 'zak', 'gertrude', 'hancock', 'green', 'guard', 'purple']), laedt = new Set();
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
  if (R.flug && flugKamera(R, t)) { if (letzterRaum !== R.id) { letzterRaum = R.id; R.sweepT0 = t; } R.kT = t; return; }
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
  const o = R.orbit || (R.innen ? orbit(R.id) : null);
  if (o && R.innen) {   // Vorspann: Kinokamera an (die Orbit-Kamera trägt sie); danach gleitet sie in die Bühnenansicht zurück
    if (kinoAktiv(R)) { if (Math.abs(o.yaw) < 3e-3 && !o.zurueck) o.yaw = 3.1e-3; R.kinoAn = true; }
    else if (R.kinoAn) { R.kinoAn = false; R.kinoSp = null; o.zurueck = true; o.rueckT0 = null; }
  }
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
    if (!R.innen && R.fokus) {   // draußen folgt die Kamera der Figur näher (wie Mario 64), knapp über Kopfhöhe statt von oben
      const w = Math.min(1, o.w || 0), L = Math.hypot(_ab.x, _ab.z), lmax = Math.max(3.2, 6.0 + o.dist);
      const lz = L + (Math.min(L, lmax) - L) * w, hy = _ab.y + (Math.max(0.35, 0.75 + o.pitch * 2.5) - _ab.y) * w;
      if (L > 1e-4) { _ab.x *= lz / L; _ab.z *= lz / L; }
      _ab.y = hy;
    }
    cam.position.copy(R.ziel).add(_ab);
    if (cam.position.y < 0.45) cam.position.y = 0.45;
    if (!R.innen && R.fokus && (o.w || 0) > 0.05) {   // draußen: der Kameraarm stößt an Hauswände, Bäume und Zäune und rückt davor
      R.armN = (R.armN || 0) + 1;
      if (R.armN % 3 === 0 || !R.armDraussen) R.armDraussen = armFrei(R, R.ziel, cam.position);
      if (cam.position.distanceTo(R.ziel) > R.armDraussen) cam.position.sub(R.ziel).setLength(R.armDraussen).add(R.ziel);
    }
    if (R.innen && R.fokus) {   // Innenräume: Third-Person-Kamera wie in Psychonauts 2 / Super Mario 64 – hinter der Figur, im Raum
      const I = R.innen, m = 0.4, w = Math.min(1, o.w || 0), dtk = Math.min(100, t - (R.kT || t));
      const posD = new THREE.Vector3(), zielD = new THREE.Vector3();
      const kino = kinoAktiv(R);
      const gp = kino ? null : gespraechsPartner(R);
      if (kino) kinoKamera(R, posD, zielD, t, actors);
      else if (gp) {   // Gespräch: seitlich auf beide Sprecher, Kamera auf der Raumseite zur Vorderwand
        const mid = gp.a.clone().add(gp.b).multiplyScalar(0.5), d = gp.b.clone().sub(gp.a); d.y = 0;
        const len = Math.max(0.6, d.length()); d.normalize();
        const n = new THREE.Vector3(-d.z, 0, d.x); if (n.z < 0) n.negate();
        posD.copy(mid).addScaledVector(n, Math.max(3.8, len * 1.1 + 2.6)); posD.y = Math.min(I.y1 - m, 1.7);
        zielD.copy(mid); zielD.y = 1.35;
      } else {
        const weite = weiteAuto(o), hoch = Math.max(0.7, Math.min(I.y1 - m, 2.6, 1.8 + o.pitch * 2.5));   // knapp über Kopfhöhe, nicht von oben
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
        if (!gp && !kino && autoKamera && wirk < wunsch * 0.6 && R.armN % 12 === 0 && performance.now() - (R.handT || 0) > 2500) {
          const probe = y => {
            const test = new THREE.Vector3(0, posD.y - R.fokus.y, wunsch).applyAxisAngle(_yA, y).add(R.fokus);
            test.set(Math.max(I.x0 + m, Math.min(I.x1 - m, test.x)), test.y, Math.max(I.z0 + m, Math.min(I.z1 - m, test.z)));
            return Math.min(test.distanceTo(zielD), armFrei(R, zielD, test));
          };
          let best = o.yaw, bestL = wirk;
          for (const dy of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.6, -2.6].filter(d => !(lenktGerade(R) && Math.abs(d) > 1.3))) {
            const y = o.yaw + dy, l = probe(y);
            if (l > bestL + 0.4) { bestL = l; best = y; }
          }
          R.yawZiel = best;
        }
      }
      if (R.yawZiel != null && !gp && !kino && autoKamera) { o.yaw += (R.yawZiel - o.yaw) * Math.min(1, dtk / 700); if (Math.abs(R.yawZiel - o.yaw) < 0.02) R.yawZiel = null; }
      if (R.armFrei && posD.distanceTo(zielD) > R.armFrei) posD.sub(zielD).setLength(R.armFrei).add(zielD);
      if (!R.glatt) R.glatt = { p: posD.clone(), z: zielD.clone() };
      const k = Math.min(1, dtk / (kino ? 950 : gp ? 420 : 260));   // Vorspann: langsame, weiche Kinofahrten
      R.glatt.p.lerp(posD, k); R.glatt.z.lerp(zielD, k);
      cam.position.copy(home.position).lerp(R.glatt.p, w);
      R.ziel.copy(R.zielHome).lerp(R.glatt.z, w);
    }
    cam.quaternion.setFromRotationMatrix(_m.lookAt(cam.position, R.ziel, _yA));
    const fovZiel = home.fov + ((kinoAktiv(R) ? 40 : WEITWINKEL) + fischPlus() - home.fov) * Math.min(1, o.w || 0);
    if (Math.abs(cam.fov - fovZiel) > 0.05) { cam.fov = fovZiel; cam.updateProjectionMatrix(); }
  } else if (cam.fov !== home.fov) { cam.fov = home.fov; cam.updateProjectionMatrix(); }
  R.kT = t;
}

const armRay = new THREE.Raycaster();
const weiteAuto = o => Math.max(2.0, 4.7 * (1 + o.dist / 6));   // mit Weitwinkel näher dran und trotzdem mehr im Bild
const WEITWINKEL = 56;   // Grad senkrecht (die Bühnenkamera hat rund 30): fast Fischauge, viel Raum im Bild
function lenktGerade(R) { const a = typeof me === 'function' ? me() : null; return !!(a && a._gelenkt && a._lenk3d && performance.now() - a._lenk3d.t < 400); }
const _armBox = new THREE.Box3(), _armRay = new THREE.Ray(), _armHit = new THREE.Vector3();
function armFrei(R, von, bis) {   // freie Länge des Kameraarms von der Figur zur Kamera (mindestens 1,6 m)
  // gegen die Kollisionskisten (Möbel, Einbauten, Bäume) – Wände und Decke begrenzt schon die Raumbox; viel schneller als
  // ein Strahl durch alle Dreiecke der zusammengefassten Raumgeometrie
  const dir = bis.clone().sub(von), lang = dir.length();
  if (lang < 0.4) return lang;
  dir.divideScalar(lang); _armRay.set(von, dir);
  let frei = lang;
  for (const { k, o } of R.kisten || []) {
    if (k[4] < 1.1 || (o && !sichtbar(o))) continue;   // niedrige Dinge verdecken die Figur nicht
    _armBox.min.set(k[0], 0, -k[3]); _armBox.max.set(k[1], k[4], -k[2]);
    if (_armBox.containsPoint(von)) continue;
    if (_armRay.intersectBox(_armBox, _armHit)) { const d = _armHit.distanceTo(von); if (d < frei) frei = d; }
  }
  return frei < lang ? Math.max(1.6, frei - 0.3) : lang;
}
// Gesprächspartner der gesteuerten Figur: wer gerade spricht (oder im Dialog steht), im selben Raum
// ---------- Vorspann-Kino: Sprecher im Halbprofil (Seiten im Wechsel), Läufer begleiten, dazwischen langsame Raumtotale ----------
function kinoAktiv(R) { return typeof G !== 'undefined' && G.inIntro && !G.prolog && G.screen === 'game' && !!R.innen && !!R.zielHome && !G.menu; }
function kinoKamera(R, posD, zielD, t, actors) {
  const I = R.innen, sp = G.speech && G.speech.a, held = sp && sp.room === R.id && sp.visible ? sp : null;
  const geher = held ? null : actors.find(a => a.walking && a.visible && owns(a, R.id));
  const wer = held || geher;
  if (wer) {
    if (R.kinoSp !== wer) { R.kinoSp = wer; R.kinoN = (R.kinoN || 0) + 1; }
    const p = toWorld(R.home, wer.x, wer.y, new THREE.Vector3()), seite = R.kinoN % 2 ? 1 : -1;
    const nah = held ? 3.3 + Math.min(1.2, (G.speech.text || '').length / 90) : 4.6;   // lange Sätze: etwas weiter weg
    posD.set(p.x + seite * nah * 0.5, held ? 1.6 : 2.1, p.z + nah);
    zielD.set(p.x - seite * 0.35, held ? 1.3 : 1.0, p.z);
    posD.x += Math.sin(t * 0.0004) * 0.15;   // Handkamera-Atmen
  } else {
    const c = R.zielHome, w = Math.sin(t * 0.00011) * 0.55;
    posD.set(c.x + Math.sin(w) * 6.5, 2.7 + Math.sin(t * 0.00017) * 0.25, c.z + Math.cos(w) * 6.5);
    zielD.set(c.x, 1.25, c.z);
  }
  posD.y = Math.min(posD.y, I.y1 - 0.4);
}
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
  const key = Math.round(gx) + ':' + Math.round(gy), cache = R.bildCache || (R.bildCache = new Map());
  let p = cache.get(key);
  if (p === undefined) {   // einmal suchen, dann merken (der Weltpunkt hinter einem Bühnen-Punkt bleibt derselbe)
    _n.set(gx / GW * 2 - 1, 1 - gy / GH * 2); ray.setFromCamera(_n, R.home);
    p = null;
    for (const h of ray.intersectObjects(R.scene.children, true)) {
      let ok = true;
      for (let q = h.object; q && ok; q = q.parent) if (q.visible === false || (q.name || '').startsWith('Figur_')) ok = false;
      if (ok) { p = h.point.clone(); break; }
    }
    if (cache.size > 600) cache.clear();
    cache.set(key, p);
  }
  if (!p) return null;
  p = p.clone();
  fischZurueck(p.project(R.camera));
  if (p.z > 1 || Math.abs(p.x) > 1.05 || Math.abs(p.y) > 1.05) return null;
  return [(p.x + 1) / 2 * GW, (1 - p.y) / 2 * GH];
}
export function kopfPunkt(gx, gy, hoehePx, id) {
  const R = rooms[id || letzterRaum]; if (!R || !R.ready || !R.home || !(freiAktiv() || R.flug)) return null;
  const p = toWorld(R.home, gx, gy, new THREE.Vector3()), upm = unitsPerMeter(R.home, p);
  p.y += hoehePx / upm;
  fischZurueck(p.project(R.camera));
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
  fischVor(_n.set(gx / GW * 2 - 1, 1 - gy / GH * 2));
  ray.setFromCamera(_n, R.camera);
  let punkt = null, dist = 1e9;
  const boden = ray.ray.intersectPlane(ground, _pickV.clone());
  if (boden) { punkt = boden.clone(); dist = boden.distanceTo(R.camera.position); }
  const treffer = ray.intersectObjects(R.scene.children, true), selbst = 'Figur_' + (typeof ACT !== 'undefined' && ACT[curId()] ? ACT[curId()].kind : '');
  for (const h of treffer) {
    let sichtbar = true;   // die eigene Figur ist durchlässig: die Auto-Kamera steht hinter ihr, Klicks zielen an ihr vorbei
    for (let k = h.object; k; k = k.parent) if (k.visible === false || k.name === selbst) { sichtbar = false; break; }
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
  let rueckTreffer = [];
  const messen = (dir, quer, merken) => {   // 9 Strahlen über Möbelhöhe, Median der Treffer
    const r = [];
    for (const hgt of [2.4, 3.0, 3.6]) for (const q of [-2, 0, 2]) {
      const o = C.clone().add(new THREE.Vector3(0, hgt, 0)).addScaledVector(quer, q), h = strahl(o, dir);
      if (h) r.push(h);
    }
    if (merken) rueckTreffer = r.slice();
    if (r.length < 4) return null;
    r.sort((a, b) => a.distance - b.distance);
    return r[Math.floor(r.length / 2)];
  };
  const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
  const hinten = messen(new THREE.Vector3(0, 0, -1), X, true), links = messen(new THREE.Vector3(-1, 0, 0), Z), rechts = messen(new THREE.Vector3(1, 0, 0), Z);
  if (!hinten) return null;   // ohne Rückwand ist es kein Innenraum
  const oben = strahl(C.clone().add(new THREE.Vector3(0, 0.5, 0)), new THREE.Vector3(0, 1, 0));
  const z0 = C.z - hinten.distance + 0.02, x0 = links ? C.x - links.distance + 0.02 : -10.5, x1 = rechts ? C.x + rechts.distance - 0.02 : 10.5;
  const y1 = oben ? 0.5 + oben.distance - 0.02 : Math.max(4.6, 0);
  const z1 = VORNE_Z;
  // Stoffe: Wand von der Rückwand – der häufigste wandartige Stoff unter allen Treffern hinten und seitlich (ein einzelner
  // Treffer kann ein Gemälde, eine Tür oder ein Schrank sein), Boden: häufigster Stoff unter fünf Tastpunkten
  const stoffVon = h => Array.isArray(h.object.material) ? h.object.material[(h.face && h.face.materialIndex) || 0] || h.object.material[0] : h.object.material;
  const wandZaehl = new Map();
  for (const h of [...rueckTreffer, links, rechts].filter(Boolean)) {
    const m = stoffVon(h), wandig = /Wand|Tapete|Mauer|Putz|Paneel|Kachel|Ziegel|Taefel/.test(m.name || '') && !TEXTUR_GERADE.test(m.name || '');
    wandZaehl.set(m, (wandZaehl.get(m) || 0) + (wandig ? 10 : 1));
  }
  let wandMat = [...wandZaehl.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0])[0] || stoffVon(hinten);
  if (!/Wand|Tapete|Mauer|Putz|Paneel|Kachel|Ziegel/.test(wandMat.name || '')) {   // nur Vorhang, Schrank o. Ä. getroffen: die Wandfarbe des Raums suchen
    let w = null; scene.traverse(o => { if (!w && o.isMesh) for (const m of [].concat(o.material)) if (!w && /Wand|Tapete|Mauer|Putz|Paneel/.test(m.name || '') && !TEXTUR_GERADE.test(m.name || '')) w = m; });
    if (w) wandMat = w;
  }
  const zaehl = new Map(), proben = [];
  for (const [dx, dz] of [[-4, 0], [4, 0], [0, -1.5], [-2, 1], [2, 1]]) {
    const h = strahl(C.clone().add(new THREE.Vector3(dx, 1.2, dz)), new THREE.Vector3(0, -1, 0));
    if (h && h.point.y < 0.15) { const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material; zaehl.set(m, (zaehl.get(m) || 0) + 1); proben.push({ m, p: h.point, uv: h.uv }); }
  }
  const bodenMat = [...zaehl.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0])[0] || wandMat;
  // Kachelung des vorhandenen Bodens messen (u, v linear in x, z), damit der ergänzte Boden nahtlos weiterläuft
  let bodenUV = null;
  const pb = proben.filter(q => q.m === bodenMat && q.uv);
  for (let i = 0; i < pb.length && !bodenUV; i++) for (let j = i + 1; j < pb.length && !bodenUV; j++) for (let k = j + 1; k < pb.length && !bodenUV; k++) {
    const [A, B, Cc] = [pb[i], pb[j], pb[k]], x1 = B.p.x - A.p.x, z1_ = B.p.z - A.p.z, x2 = Cc.p.x - A.p.x, z2 = Cc.p.z - A.p.z, det = x1 * z2 - x2 * z1_;
    if (Math.abs(det) < 0.5) continue;
    const loes = (f1, f2) => [(f1 * z2 - f2 * z1_) / det, (x1 * f2 - x2 * f1) / det];
    const [ua, ub] = loes(B.uv.x - A.uv.x, Cc.uv.x - A.uv.x), [va, vb] = loes(B.uv.y - A.uv.y, Cc.uv.y - A.uv.y);
    bodenUV = { ua, ub, uc: A.uv.x - ua * A.p.x - ub * A.p.z, va, vb, vc: A.uv.y - va * A.p.x - vb * A.p.z };
  }
  // Tapete: Muster der Rückwand messen (u, v linear in x und Höhe), damit die ergänzten Wände dasselbe Muster im selben Maßstab zeigen
  let wandUV = null;
  const pw = rueckTreffer.filter(h => h.uv && stoffVon(h) === wandMat);
  for (let i = 0; i < pw.length && !wandUV; i++) for (let j = i + 1; j < pw.length && !wandUV; j++) for (let k = j + 1; k < pw.length && !wandUV; k++) {
    const [A, B2, C2] = [pw[i], pw[j], pw[k]], x1 = B2.point.x - A.point.x, y1_ = B2.point.y - A.point.y, x2 = C2.point.x - A.point.x, y2 = C2.point.y - A.point.y, det = x1 * y2 - x2 * y1_;
    if (Math.abs(det) < 0.3) continue;
    const loes = (f1, f2) => [(f1 * y2 - f2 * y1_) / det, (x1 * f2 - x2 * f1) / det];
    const [ua, ub] = loes(B2.uv.x - A.uv.x, C2.uv.x - A.uv.x), [va, vb] = loes(B2.uv.y - A.uv.y, C2.uv.y - A.uv.y);
    wandUV = { ua, ub, uc: A.uv.x - ua * A.point.x - ub * A.point.y, va, vb, vc: A.uv.y - va * A.point.x - vb * A.point.y };
  }
  const innenStoff = (m, dunkler) => {
    const n = m.clone(); n.side = THREE.FrontSide;
    if (m.onBeforeCompile && m.customProgramCacheKey) { n.onBeforeCompile = m.onBeforeCompile; n.customProgramCacheKey = m.customProgramCacheKey; }   // gleiche Wellen wie die Wand daneben
    if (dunkler && n.color) n.color = n.color.clone().multiplyScalar(dunkler);
    n.userData.outlineParameters = { thickness: 0.003, color: INK, alpha: 1, visible: false };
    return n;
  };
  const W = innenStoff(wandMat), B = innenStoff(bodenMat), D = innenStoff(wandMat, 0.55);
  const huelle = new THREE.Group(); huelle.name = 'Raumhuelle';
  const flaeche = (w, h, mat, pos, rotY, rotX = 0) => {   // Ebene mit Innenseite zum Raum, Kacheln im Meter-Maßstab
    const g = new THREE.PlaneGeometry(w, h, Math.max(1, Math.ceil(w / 0.6)), Math.max(1, Math.ceil(h / 0.6))), uv = g.attributes.uv;   // fein unterteilt: die schiefe DOTT-Verbiegung greift auch hier
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * 0.4, uv.getY(i) * h * 0.4);
    const m = new THREE.Mesh(g, mat); m.position.copy(pos); m.rotation.set(rotX, rotY, 0, 'YXZ'); m.receiveShadow = true; huelle.add(m);
    if (wandUV && mat === W && !rotX) {   // senkrechte Wand: Muster wie die Rückwand (Seitenwände laufen in der Tiefe weiter)
      m.updateMatrixWorld(true);
      const pos3 = g.attributes.position, v = new THREE.Vector3(), seite = Math.abs(Math.sin(rotY)) > 0.5;
      for (let i = 0; i < uv.count; i++) {
        v.fromBufferAttribute(pos3, i).applyMatrix4(m.matrixWorld);
        const hx = seite ? -v.z : v.x;
        uv.setXY(i, wandUV.ua * hx + wandUV.ub * v.y + wandUV.uc, wandUV.va * hx + wandUV.vb * v.y + wandUV.vc);
      }
      uv.needsUpdate = true;
    }
    return m;
  };
  const bx = (x0 + x1) / 2, bz = (z0 + z1) / 2, bw = x1 - x0, bd = z1 - z0;
  flaeche(bw, y1, W, new THREE.Vector3(bx, y1 / 2, z1), Math.PI);   // Vorderwand, schaut nach hinten in den Raum
  // Seitenwände immer über die ganze Tiefe: wo der Raum eine eigene Wand hat, steckt die Hülle unsichtbar in ihr,
  // vorn (wo das Bühnenbild offen war) schließt sie die Lücke
  flaeche(bd, y1, W, new THREE.Vector3(x0 - (links ? 0.06 : 0), y1 / 2, bz), Math.PI / 2);
  flaeche(bd, y1, W, new THREE.Vector3(x1 + (rechts ? 0.06 : 0), y1 / 2, bz), -Math.PI / 2);
  if (!oben) flaeche(bw, bd, D, new THREE.Vector3(bx, y1, bz), 0, Math.PI / 2);   // Decke, schaut nach unten
  // Boden nur vor dem vorhandenen ergänzen (Abgründe und Treppenlöcher bleiben offen): vordere Bodenkante abtasten
  let zKante = z1;
  for (let z = C.z; z < z1; z += 0.5) {
    let bedeckt = false;
    for (const x of [-6, -3, 0, 3, 6]) { const h = strahl(new THREE.Vector3(x, 1.2, z), new THREE.Vector3(0, -1, 0)); if (h && Math.abs(h.point.y) < 0.2) { bedeckt = true; break; } }
    if (!bedeckt) { zKante = z - 0.25; break; }
  }
  if (zKante < z1 - 0.05) {
    const bt = z1 - zKante + 0.3, g = new THREE.PlaneGeometry(bw, bt, Math.ceil(bw / 0.6), Math.ceil(bt / 0.6));
    g.rotateX(-Math.PI / 2); g.translate(bx, -0.004, (zKante - 0.3 + z1) / 2);   // greift ein Stück unter den vorhandenen Boden
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      if (bodenUV) uv.setXY(i, bodenUV.ua * x + bodenUV.ub * z + bodenUV.uc, bodenUV.va * x + bodenUV.vb * z + bodenUV.vc);
      else uv.setXY(i, x * 0.4, -z * 0.4);
    }
    const m = new THREE.Mesh(g, B); m.receiveShadow = true; huelle.add(m);
  }
  scene.add(huelle);
  const deko = vorderwandDeko(id, x0, x1, z1, y1);
  scene.add(deko);
  return { x0, x1, z0, z1, y1, deko, dekoKisten: kollisionsKisten(deko), wand: wandMat.name, boden: bodenMat.name };
}
// Möbel und Dinge an der Vorderwand, damit die Rückseite des Raums nicht leer ist (je Raum ein Thema).
// Nur bei gedrehter Kamera sichtbar – in der Bühnenansicht stünden sie sonst vor der Kamera.
function vorderwandDeko(id, x0, x1, z, y1) {
  const g = new THREE.Group(); g.name = 'Vorderwanddeko';
  const M = c => toonMat(c), holz = M(0x6a4428), holzD = M(0x4a2e1a), metall = M(0x8a92a8);
  const box = (w, h, d, mat, x, y, dz = 0, rot = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, Math.ceil(w / 0.5), Math.ceil(h / 0.5), 1), mat); b.position.set(x, y, z - d / 2 - 0.02 - dz); b.rotation.y = rot; b.castShadow = b.receiveShadow = true; g.add(b); return b; };
  const zyl = (r0, r1, h, mat, x, y, dz) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 14, Math.ceil(h / 0.5)), mat); c.position.set(x, y, z - dz); c.castShadow = true; g.add(c); return c; };
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
// Kein rechter Winkel mehr: Fächer (a, Wände kippen nach außen) und vor allem Wellen (b, c, d – kippen in alle Richtungen,
// auch mitten im Raum). Draußen ist der Fächer gedeckelt (xmax), sonst flögen ferne Hügel davon.
const DRAUSSEN = new Set(['auffahrt', 'garten1776', 'fgarten', 'landeplatz', 'mars', 'prolog']);
for (const [id, a0] of Object.entries({ lobby: 1.35, stockwerk: 1.3, dachboden: 1.1, keller: 1.0, uhrwerk: 0.9, labor: 1, konferenz: 1.1, gasthaus: 1.0, vorraum: 1.0, thron: 1.0, testkammer: 0.9,
  auffahrt: 0.5, garten1776: 0.5, fgarten: 0.5, landeplatz: 0.45, mars: 0.4, prolog: 0.6 })) {
  let ph = 0; for (const ch of id) ph = (ph * 31 + ch.charCodeAt(0)) % 628;
  const sprung = false;   // früher sanfter für die Sprung-Räume – jetzt biegen die Figuren auf Stufen und Kisten mit (frame)
  const fa = a0 * (sprung ? 1.2 : 1.5), fw = a0 * (sprung ? 1.2 : 2.2);
  KRUMM[id] = { a: 0.042 * fa, b: 0.075 * fw, c: 0.05 * fw, d: 0.06 * fw, ph: ph / 100, xmax: DRAUSSEN.has(id) ? 10 : 0 };
}
function krummVersatz(k, x, y, z, out) {   // Verschiebung eines Weltpunkts (three.js-Meter); Boden (y = 0) bleibt, wo er ist
  const h = Math.max(0, Math.min(8, y));
  if (!h) return out.set(0, 0, 0);
  const xm = k.xmax ? Math.max(-k.xmax, Math.min(k.xmax, x)) : x;
  return out.set(h * (k.a * xm + k.b * Math.sin(0.55 * x + 0.35 * z + k.ph)), h * k.d * Math.sin(0.5 * x - 0.3 * z + k.ph * 0.6), h * k.c * Math.sin(0.4 * x + k.ph * 1.7));
}
// Treffer auf der verbogenen Geometrie -> Punkt vor dem Verbiegen (Fixpunkt: q + Versatz(q) = p)
function entbiegen(k, p, out) {
  const d = new THREE.Vector3();
  out.copy(p);
  for (let i = 0; i < 8; i++) { krummVersatz(k, out.x, out.y, out.z, d); out.copy(p).sub(d); }
  return out;
}
// Bäume draußen: jeder lehnt sich in seine eigene Richtung, krümmt sich S-förmig und verdreht die Krone (wie gezeichnet)
function baeumeVerbiegen(scene) {
  scene.updateMatrixWorld(true);
  const gruppen = new Map(), kronen = [];
  scene.traverse(o => {
    if (!o.isMesh) return;
    if (/^P_Krone/.test(o.name || '')) { kronen.push(o); return; }
    let m = null; for (let q = o; q && !m; q = q.parent) m = /^(Baum[A-Z]?\d+|Tanne\d+|P_Stamm\d+)/.exec(q.name || '');
    if (m) { if (!gruppen.has(m[1])) gruppen.set(m[1], []); gruppen.get(m[1]).push(o); }
  });
  const _bc = new THREE.Vector3(), _bs = new THREE.Vector3();
  for (const k of kronen) {   // Prolog: die Kronenkugeln zum nächsten Stamm
    k.getWorldPosition(_bc); let best = null, bd = 1e9;
    for (const [key, ms] of gruppen) if (key.startsWith('P_Stamm')) { ms[0].getWorldPosition(_bs); const d = Math.hypot(_bs.x - _bc.x, _bs.z - _bc.z); if (d < bd) { bd = d; best = key; } }
    if (best && bd < 4) gruppen.get(best).push(k);
  }
  const v = new THREE.Vector3(), inv = new THREE.Matrix4(), bb = new THREE.Box3();
  for (const [key, ms] of gruppen) {
    bb.makeEmpty(); for (const o of ms) bb.expandByObject(o);
    const mx = (bb.min.x + bb.max.x) / 2, mz = (bb.min.z + bb.max.z) / 2, y0 = bb.min.y, H = Math.max(1, bb.max.y - y0);
    let s = 7; for (const ch of key) s = (s * 31 + ch.charCodeAt(0)) % 9973;
    const w = s * 0.37, dx = Math.cos(w), dz = Math.sin(w), lehn = 0.16 + (s % 7) * 0.03, bieg = 0.1 + (s % 5) * 0.035, dreh = (((s >> 3) % 9) - 4) * 0.09;
    for (const o of ms) {
      o.geometry = o.geometry.clone();   // Bäume teilen sich oft ein Modell – jeder bekommt seine eigene Form
      const pos = o.geometry.attributes.position; if (!pos) continue;
      inv.copy(o.matrixWorld).invert();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        const h = Math.max(0, (v.y - y0) / H);
        const a = dreh * h * Math.PI, rx = v.x - mx, rz = v.z - mz, c = Math.cos(a), sn = Math.sin(a);
        v.x = mx + rx * c - rz * sn; v.z = mz + rx * sn + rz * c;   // Krone verdreht
        const quer = bieg * H * Math.sin(h * Math.PI * 1.3) * h, vor = lehn * H * h * h;
        v.x += dx * vor - dz * quer; v.z += dz * vor + dx * quer;
        v.applyMatrix4(inv); pos.setXYZ(i, v.x, v.y, v.z);
      }
      pos.needsUpdate = true; o.geometry.computeBoundingBox(); o.geometry.computeBoundingSphere();
    }
  }
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

// ---------- Zukunftsgarten: Welt rundherum (Tentakel-Palast = die Villa in der Zukunft, Raumhafen links) ----------
function zukunftWelt(scene) {
  const welt = new THREE.Group(); welt.name = 'Zukunftswelt';
  const namens = (re, farbe) => { let f = null; scene.traverse(o => { if (!f && o.isMesh && !Array.isArray(o.material) && re.test(o.material.name || '')) f = o.material; }); return f || toonMat(farbe); };
  const wand = namens(/Palastmauer|Palast|Marmor/, 0x7a3aa8), wiese = namens(/FG_Wiese|Wiese/, 0x5a3a8a);
  const M = c => toonMat(c), ohne = m => { m.userData.outlineParameters = { visible: false }; return m; };
  const gold = M(0xe8b830), lila = M(0x8a3ac8), lilaD = M(0x4a1a78), glasT = leuchtMat(0x7ff0ff), glasM = leuchtMat(0xff7ad8), metall = M(0xb8c0d8), dunkel = M(0x241838);
  const teil = (geo, mat, x, y, h, gier = 0, ziel = welt) => { const m = new THREE.Mesh(geo, mat); m.position.copy(bl(x, y, h)); m.rotation.y = gier; m.receiveShadow = true; ziel.add(m); return m; };
  const kachel = g => {   // UVs im Meter-Maßstab
    const uv = g.attributes.uv, pos = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
      uv.setXY(i, (ax > 0.5 ? pos.getZ(i) : pos.getX(i)) * 0.4, (ay > 0.5 ? pos.getZ(i) : pos.getY(i)) * 0.4);
    }
    return g;
  };
  const kiste = (x0, x1, y0, y1, h0, h1, mat) => teil(kachel(new THREE.BoxGeometry(x1 - x0, h1 - h0, y1 - y0)), mat, (x0 + x1) / 2, (y0 + y1) / 2, (h0 + h1) / 2);
  const flach = (geo, mat, x, y, h) => { geo.rotateX(-Math.PI / 2); return teil(geo, mat, x, y, h); };
  const gierVon = (nx, ny) => Math.atan2(nx, -ny);
  // Boden, Dunstring in Abendrot-Magenta, Hügel
  flach(new THREE.CircleGeometry(420, 72), wiese, 0, 20, -0.15);
  const hor = scene.userData.horizont || '#c85a8e', hc = document.createElement('canvas'); hc.width = 4; hc.height = 128;
  const hg = hc.getContext('2d'), vl = hg.createLinearGradient(0, 0, 0, 128), c = new THREE.Color(hor), rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
  vl.addColorStop(0, `rgba(${rgb},0)`); vl.addColorStop(0.55, `rgba(${rgb},0.55)`); vl.addColorStop(0.8, `rgba(${rgb},1)`); vl.addColorStop(1, `rgba(${rgb},1)`);
  hg.fillStyle = vl; hg.fillRect(0, 0, 4, 128);
  const dt = new THREE.CanvasTexture(hc); dt.colorSpace = THREE.SRGBColorSpace;
  const dunst = new THREE.Mesh(new THREE.CylinderGeometry(330, 330, 80, 64, 1, true), ohne(new THREE.MeshBasicMaterial({ map: dt, transparent: true, depthWrite: false, side: THREE.BackSide })));
  dunst.position.copy(bl(0, 20, 22)); dunst.userData.beweglich = true; welt.add(dunst);
  const huegelM = [M(0x6a3a9a), M(0x7a4aa8), M(0x5a2a88)];
  for (let i = 0; i < 30; i++) {
    const w = i / 30 * Math.PI * 2 + Math.sin(i * 5.1) * 0.07, r = 160 + (i % 3) * 25, x = Math.sin(w) * r, y = 20 + Math.cos(w) * r;
    teil(new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), huegelM[i % 3], x, y, -1.5, w).scale.set(22 + (i * 11) % 18, 9 + (i * 7) % 10, 18 + (i * 5) % 12);
  }

  // ---- der Tentakel-Palast (die Villa Edison im Jahr 2226): hinter der Palastmauer rechts ----
  const PX0 = 6.0, PX1 = 28, PY0 = 13.05, PY1 = 30, HOCH = 13;
  kiste(PX0, PX1, PY0, PY1, 0, HOCH, wand);
  for (const h of [0.4, 5.4, 9.2, 12.7]) kiste(PX0 - 0.2, PX1 + 0.2, PY0 - 0.2, PY1 + 0.2, h, h + 0.32, gold);   // goldene Gesimse
  const fenster = (x, y, h, gier, mat = glasM) => {
    const g = new THREE.Group(); g.position.copy(bl(x, y, h)); g.rotation.y = gier; welt.add(g);
    const b = (w, hh, d, m, px, py, pz) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), m); o.position.set(px, py, pz); g.add(o); };
    b(1.5, 2.3, 0.14, gold, 0, 0, 0); b(1.15, 1.9, 0.1, mat, 0, -0.1, 0.05);
    const bogen = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.12, 16, 1, false, -Math.PI / 2, Math.PI), mat); bogen.rotation.x = Math.PI / 2; bogen.position.set(0, 0.85, 0.06); g.add(bogen);   // Rundbogen
  };
  const reihe = (ax, ay, bx, by, nx, ny, hoehen, abst = 3.4) => {
    const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.floor(len / abst)), gier = gierVon(nx, ny);
    for (const h of hoehen) for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; fenster(ax + (bx - ax) * t + nx * 0.08, ay + (by - ay) * t + ny * 0.08, h, gier, (i + Math.round(h)) % 3 ? glasM : glasT); }
  };
  reihe(10, PY0, PX1, PY0, 0, -1, [2.6, 7.3, 11.0]);
  reihe(PX0, PY0, 9.6, PY0, 0, -1, [7.3, 11.0]);
  reihe(PX1, PY0, PX1, PY1, 1, 0, [2.6, 7.3, 11.0]);
  reihe(PX1, PY1, PX0, PY1, 0, 1, [2.6, 7.3, 11.0]);
  reihe(PX0, PY1, PX0, 15.5, -1, 0, [2.6, 7.3, 11.0]);
  // Dach: lila Walmdach, darauf eine goldene Zwiebelkuppel mit Tentakel-Spitze
  const walm = new THREE.ConeGeometry(1, 1, 4, 1); walm.rotateY(Math.PI / 4);
  teil(walm, lilaD, (PX0 + PX1) / 2, (PY0 + PY1) / 2, HOCH + 3.4).scale.set((PX1 - PX0) * 0.76, 6.8, (PY1 - PY0) * 0.76);
  const kx = (PX0 + PX1) / 2, ky = (PY0 + PY1) / 2;
  teil(new THREE.CylinderGeometry(2.4, 2.6, 2.2, 20), gold, kx, ky, HOCH + 6.2);
  const zwiebel = teil(new THREE.SphereGeometry(2.9, 24, 16), lila, kx, ky, HOCH + 9.0); zwiebel.scale.set(1, 1.15, 1);
  teil(new THREE.ConeGeometry(1.2, 4.2, 20), lila, kx, ky, HOCH + 13.0);
  const spitzeT = teil(new THREE.CapsuleGeometry(0.45, 2.6, 6, 14), lila, kx, ky, HOCH + 16.4); spitzeT.rotation.z = 0.25;
  for (const s of [-1, 1]) teil(new THREE.SphereGeometry(0.2, 10, 8), M(0xffffff), kx - 0.2 + s * 0.22, ky - 0.42, HOCH + 17.0);
  // Tentakel-Türme an den Ecken: gewundene Säulen mit Saugnapf-Ringen und glühender Spitze
  const tentTurm = (x, y, h, farbe) => {
    const m = M(farbe);
    for (let i = 0; i < 6; i++) {
      const r0 = 1.9 - i * 0.26, r1 = 1.9 - (i + 1) * 0.26, z0 = i * h / 6;
      const seg = teil(new THREE.CylinderGeometry(r1, r0, h / 6 + 0.05, 16), m, x + Math.sin(i * 0.9) * 0.35, y, z0 + h / 12);
      seg.rotation.z = Math.sin(i * 0.9) * 0.08;
      teil(new THREE.TorusGeometry(r1 + 0.05, 0.12, 6, 18), gold, x + Math.sin(i * 0.9) * 0.35, y, z0 + h / 6).rotation.x = Math.PI / 2;
    }
    teil(new THREE.SphereGeometry(0.5, 14, 10), glasM, x + Math.sin(5.4) * 0.35, y, h + 0.4);
  };
  tentTurm(PX0 + 0.3, PY1 - 0.5, 21, 0x7a2ab8); tentTurm(PX1 - 0.3, PY0 + 0.3, 19, 0x9a3ad8); tentTurm(PX1 - 0.3, PY1 - 0.3, 17, 0x6a1aa8);
  // Banner mit Tentakel-Wappen an der Front
  for (const x of [12, 17, 22]) {
    kiste(x - 0.9, x + 0.9, PY0 - 0.12, PY0 - 0.05, 3.6, 8.6, M(0x5a1a8a));
    teil(new THREE.CapsuleGeometry(0.25, 1.4, 4, 10), gold, x, PY0 - 0.2, 6.3);
    for (const s of [-1, 1]) teil(new THREE.SphereGeometry(0.08, 8, 6), M(0xffffff), x + s * 0.11, PY0 - 0.46, 7.0);
  }
  const fahnen = [];
  for (const [x, y, h] of [[PX0 + 0.3, PY1 - 0.5, 21.9], [PX1 - 0.3, PY0 + 0.3, 19.9]]) {
    teil(new THREE.CylinderGeometry(0.06, 0.06, 3.0, 6), metall, x, y, h + 1.5);
    const f = teil(new THREE.BoxGeometry(1.6, 0.9, 0.05), M(0xc83ad8), x + 0.8, y, h + 2.5); f.userData.beweglich = true; fahnen.push(f);
  }

  // ---- der Raumhafen (links, wo der Weg zum Landeplatz hinführt) ----
  const RX = -58, RY = 34;
  const pad = (x, y, r) => {
    teil(new THREE.CylinderGeometry(r, r + 0.4, 0.6, 32), M(0x3a3a50), x, y, 0.3);
    teil(new THREE.TorusGeometry(r - 0.6, 0.12, 6, 40), glasT, x, y, 0.65).rotation.x = Math.PI / 2;
    teil(new THREE.TorusGeometry(r * 0.45, 0.1, 6, 32), glasM, x, y, 0.65).rotation.x = Math.PI / 2;
  };
  pad(RX, RY, 9); pad(RX + 24, RY + 8, 7); pad(RX - 6, RY + 26, 8);
  // Kontrollturm mit Kanzel und Blinklichtern
  teil(new THREE.CylinderGeometry(1.4, 2.2, 22, 16), metall, RX + 14, RY - 8, 11);
  teil(new THREE.CylinderGeometry(4.2, 2.6, 2.6, 24), dunkel, RX + 14, RY - 8, 23.3);
  teil(new THREE.CylinderGeometry(4.25, 4.25, 1.2, 24, 1, true), glasT, RX + 14, RY - 8, 23.6);
  teil(new THREE.ConeGeometry(2.0, 3.0, 16), metall, RX + 14, RY - 8, 26.1);
  const blink = [];
  for (const [x, y, h] of [[RX + 14, RY - 8, 27.8], [RX + 26, RY + 22, 9.5], [RX - 18, RY + 12, 11]]) {
    const b = teil(new THREE.SphereGeometry(0.4, 10, 8), leuchtMat(0xff3a3a), x, y, h); b.userData.beweglich = true; blink.push(b);
  }
  // Hangar-Kuppeln
  for (const [x, y, r] of [[RX + 26, RY + 22, 7], [RX - 18, RY + 12, 8], [RX + 6, RY + 40, 6]]) {
    teil(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0xd8dce8), x, y, 0);
    kiste(x - r * 0.4, x + r * 0.4, y - r - 0.1, y - r + 0.5, 0, r * 0.55, dunkel);
  }
  // das grüne Lieferraumschiff auf Pad 1 (vgl. Landeplatz) und eine Rakete auf Pad 3
  const schiff = new THREE.Group(); schiff.position.copy(bl(RX, RY, 3.2)); schiff.rotation.y = 0.5; schiff.userData.beweglich = true; welt.add(schiff);
  const rumpf = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), M(0x3ab86a)); rumpf.scale.set(7, 2.4, 3.2); schiff.add(rumpf);
  const kanzel = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 10), glasT); kanzel.position.set(4.4, 1.3, 0); schiff.add(kanzel);
  for (const s of [-1, 1]) { const fl = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 2.6), M(0x2a8a50)); fl.position.set(-2.4, -0.4, s * 3.6); fl.rotation.y = s * 0.3; schiff.add(fl); }
  for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 1.4, 14), glasM); d.rotation.z = Math.PI / 2; d.position.set(-7.2, -0.3, s * 1.2); schiff.add(d); }
  for (const [x, z] of [[3, 1.8], [3, -1.8], [-3, 1.8], [-3, -1.8]]) { const bein = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 2.6, 8), metall); bein.position.set(x, -2.2, z); schiff.add(bein); }
  mergeUnder(schiff);
  const rakete = new THREE.Group(); rakete.position.copy(bl(RX - 6, RY + 26, 0.6)); welt.add(rakete);
  const rk = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 14, 20), M(0xf2ece0)); rk.position.y = 7.6; rakete.add(rk);
  const rs = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.6, 20), M(0xd8302a)); rs.position.y = 16.9; rakete.add(rs);
  for (let i = 0; i < 4; i++) { const fl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 2.6), M(0xd8302a)); const w = i * Math.PI / 2; fl.position.set(Math.cos(w) * 2.2, 2.4, Math.sin(w) * 2.2); fl.rotation.y = -w; rakete.add(fl); }
  for (let i = 0; i < 3; i++) { const bu = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 14), glasT); bu.rotation.x = Math.PI / 2; bu.position.set(0, 9 + i * 2.2, 1.66); rakete.add(bu); }
  // Weg zum Raumhafen: leuchtende Spur
  for (let i = 0; i < 18; i++) teil(new THREE.BoxGeometry(1.4, 0.06, 0.4), glasT, -6 - i * 2.8, 10 + i * 1.3, 0.04, -0.43);
  // hinter der Kamera und ringsum: Zukunftsbäume (Lollipop mit Leuchtkugeln) und Schwebelaternen
  const krone = [M(0xff6ad8), M(0x6ad8ff), M(0xb86aff)];
  for (const [x, y, s] of [[-14, -10, 1.2], [10, -14, 1.3], [-26, 2, 1.1], [24, -4, 1.2], [-6, -24, 1.4], [18, 40, 1.3], [-24, 30, 1.2], [36, 20, 1.4], [-40, -8, 1.3]]) {
    teil(new THREE.CylinderGeometry(0.15 * s, 0.25 * s, 4 * s, 8), metall, x, y, 2 * s);
    teil(new THREE.SphereGeometry(1.6 * s, 16, 12), krone[Math.abs(Math.round(x + y)) % 3], x, y, 4.6 * s);
    teil(new THREE.TorusGeometry(1.9 * s, 0.08, 6, 24), gold, x, y, 4.6 * s).rotation.x = Math.PI / 2 - 0.3;
  }
  // Verkehr am Himmel: Untertassen und Schwebeautos ziehen ihre Bahnen
  const verkehr = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group(); g.userData.beweglich = true;
    if (i % 2) {   // Untertasse
      const d = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), metall); d.scale.set(2.2, 0.45, 2.2); g.add(d);
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), glasT); k.position.y = 0.45; g.add(k);
    } else {   // Schwebeauto mit Heckflossen
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.7, 1.4), M([0xff4a8a, 0x4ad8ff, 0xffd23a][i % 3])); g.add(b);
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), glasT); k.position.set(0.3, 0.45, 0); k.scale.set(1.4, 0.8, 1); g.add(k);
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.6, 10), glasM); f.rotation.z = Math.PI / 2; f.position.x = -1.6; g.add(f);
    }
    welt.add(g); verkehr.push({ g, r: 40 + i * 14, h: 14 + (i % 4) * 5, w0: i * 0.9, sp: (i % 2 ? 0.05 : -0.07) * (1 + i * 0.1), cx: -10 + (i % 3) * 15, cy: 40 + (i % 2) * 20 });
  }

  mergeUnder(welt, c => !!c.userData.beweglich || !!(c.parent && c.parent.userData.beweglich));
  scene.add(welt);
  // die gemalte Sternenhimmel-Kulisse des Bühnenbilds: nur in der Bühnenansicht, beim Drehen wäre sie eine flache Tafel
  const kulisse = []; scene.traverse(o => { if (o.isMesh && !Array.isArray(o.material) && /Himmel/.test(o.material.name || '')) kulisse.push(o); });
  return {
    tick(s) {
      const frei = freiAktiv(); for (const k of kulisse) k.visible = !frei;
      for (const f of fahnen) f.rotation.y = Math.sin(s * 2.6 + f.position.x) * 0.35;
      blink.forEach((b, i) => { b.visible = Math.floor(s * 1.6 + i * 0.5) % 2 === 0; });
      schiff.position.y = 3.2 + Math.sin(s * 0.8) * 0.12;
      for (const v of verkehr) {
        const w = v.w0 + s * v.sp;
        v.g.position.copy(bl(v.cx + Math.cos(w) * v.r, v.cy + Math.sin(w) * v.r, v.h + Math.sin(s * 0.7 + v.w0) * 0.8));
        v.g.rotation.y = -w + (v.sp > 0 ? -Math.PI / 2 : Math.PI / 2);
      }
    },
  };
}

// ---------- Garten 1776: Welt rundherum für die freie Kamera ----------
// Das Bühnenbild zeigt nur die Gartenecke. Dreht man die Kamera, soll die ganze Villa dastehen, Wiese und Hügel bis zum
// Horizont reichen und rechts die Bucht mit dem Hafen von 1776 liegen (Stege, Segelschiffe, Leuchtturm, Möwen).
function gartenWelt(scene) {
  const welt = new THREE.Group(); welt.name = 'Rundumwelt';
  const namens = (re, farbe) => { let f = null; scene.traverse(o => { if (!f && o.isMesh && !Array.isArray(o.material) && re.test(o.material.name || '')) f = o.material; }); return f || toonMat(farbe); };
  const putz = namens(/Putz/, 0xf0e2c0), gras = namens(/GA_Gras/, 0x6cc04a), ziegel = namens(/GA_Dach/, 0xa04a2a), balken = namens(/G_Balken/, 0x4e3218);
  const M = c => toonMat(c), ohneKontur = m => { m.userData.outlineParameters = { visible: false }; return m; };
  const glas = M(0x24345e), laden = M(0x3c6e52), holz = M(0x8a5a32), holzD = M(0x4e3218), gold = M(0xe0b040), weiss = M(0xf2ece0), rotM = M(0xc03a2a), stein = M(0x8a8478);
  const kachel = (g, k = 0.4) => {   // UVs im Meter-Maßstab: Putz und Gras kacheln, statt über 20 m zu verschmieren
    const uv = g.attributes.uv, pos = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
      uv.setXY(i, (ax > 0.5 ? pos.getZ(i) : pos.getX(i)) * k, (ay > 0.5 ? pos.getZ(i) : pos.getY(i)) * k);
    }
    return g;
  };
  const teil = (geo, mat, x, y, h, gier = 0, ziel = welt) => { const m = new THREE.Mesh(geo, mat); m.position.copy(bl(x, y, h)); m.rotation.y = gier; m.receiveShadow = true; ziel.add(m); return m; };
  const kiste = (x0, x1, y0, y1, h0, h1, mat, k) => teil(kachel(new THREE.BoxGeometry(x1 - x0, h1 - h0, y1 - y0), k), mat, (x0 + x1) / 2, (y0 + y1) / 2, (h0 + h1) / 2);
  const flach = (geo, mat, x, y, h) => { geo.rotateX(-Math.PI / 2); return teil(geo, mat, x, y, h); };
  const gierVon = (nx, ny) => Math.atan2(nx, -ny);   // Blender-Normale der Fassade -> Drehung um die Hochachse

  // Boden bis zum Horizont (unter der Wiese des Bühnenbilds) und ein Dunstring, der den Rand in den Himmel blendet
  flach(kachel(new THREE.CircleGeometry(420, 72), 0.15), gras, 0, 20, -0.15);
  const hor = scene.userData.horizont || '#d6f1ff', hc = document.createElement('canvas'); hc.width = 4; hc.height = 128;
  const hg = hc.getContext('2d'), verlauf = hg.createLinearGradient(0, 0, 0, 128), c = new THREE.Color(hor), rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
  verlauf.addColorStop(0, `rgba(${rgb},0)`); verlauf.addColorStop(0.55, `rgba(${rgb},0.6)`); verlauf.addColorStop(0.8, `rgba(${rgb},1)`); verlauf.addColorStop(1, `rgba(${rgb},1)`);
  hg.fillStyle = verlauf; hg.fillRect(0, 0, 4, 128);
  const dunstT = new THREE.CanvasTexture(hc); dunstT.colorSpace = THREE.SRGBColorSpace;
  const dunst = new THREE.Mesh(new THREE.CylinderGeometry(330, 330, 80, 64, 1, true), ohneKontur(new THREE.MeshBasicMaterial({ map: dunstT, transparent: true, depthWrite: false, side: THREE.BackSide })));
  dunst.position.copy(bl(0, 20, 22)); dunst.userData.beweglich = true; welt.add(dunst);
  // Hügelkette ringsum (rechts liegt das Meer, dort keine)
  const huegelM = [M(0x5aa83a), M(0x6cb848), M(0x4a9a34), M(0x78c058)];
  for (let i = 0; i < 34; i++) {
    const w = i / 34 * Math.PI * 2 + Math.sin(i * 7.3) * 0.07, r = 150 + (i % 3) * 26, x = Math.sin(w) * r, y = 20 + Math.cos(w) * r;
    if (x > 45) continue;
    const h = teil(new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), huegelM[i % 4], x, y, -1.5, w);
    h.scale.set(24 + (i * 13) % 20, 10 + (i * 7) % 12, 18 + (i * 5) % 14);
  }

  // ---- die Villa: Hauptbau hinter der Gartenecke, Gesimse, Fensterreihen mit Läden, Walmdach, zwei Türme, Schornsteine ----
  const VX0 = -27, VX1 = -5.25, VY0 = 12.72, VY1 = 28, HOCH = 13;
  kiste(VX0, VX1, VY0, VY1, 0, HOCH, putz);
  for (const h of [5.42, 9.25, 12.75]) kiste(VX0 - 0.22, VX1 + 0.22, VY0 - 0.22, VY1 + 0.22, h, h + 0.3, balken);   // Gesimse
  for (const [x, y] of [[VX1, VY1], [VX0, VY1], [VX1, VY0]]) kiste(x - 0.2, x + 0.2, y - 0.2, y + 0.2, 0, HOCH, balken);   // Eckbalken
  const fenster = (x, y, h, gier, s = 1) => {
    const g = new THREE.Group(); g.position.copy(bl(x, y, h)); g.rotation.y = gier; g.scale.setScalar(s); welt.add(g);
    const b = (w, hh, d, mat, px, py, pz, rz = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), mat); m.position.set(px, py, pz); m.rotation.z = rz; g.add(m); };
    b(1.5, 2.15, 0.14, balken, 0, 0, 0); b(1.2, 1.8, 0.1, glas, 0, 0, 0.05);
    b(0.08, 1.8, 0.18, balken, 0, 0, 0.06); b(1.2, 0.08, 0.18, balken, 0, 0.25, 0.06);   // Fensterkreuz
    b(0.55, 1.95, 0.08, laden, -1.06, 0, 0.03, 0.05); b(0.55, 1.95, 0.08, laden, 1.06, 0, 0.03, -0.07);   // schiefe Läden (DOTT)
    b(1.8, 0.14, 0.42, balken, 0, -1.12, 0.14);   // Fensterbank
  };
  const reihe = (ax, ay, bx, by, nx, ny, hoehen, abst = 3.6) => {   // Fenster gleichmäßig auf einer Fassadenstrecke
    const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.floor(len / abst)), gier = gierVon(nx, ny);
    for (const h of hoehen) for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      fenster(ax + (bx - ax) * t + nx * 0.08, ay + (by - ay) * t + ny * 0.08, h, gier);
    }
  };
  reihe(-23.2, VY0, -10.8, VY0, 0, -1, [2.3]);   // vorn unten: neben der Gartenecke des Bühnenbilds
  reihe(-23.2, VY0, -6, VY0, 0, -1, [7.35, 11.0]);
  reihe(VX1, 15.2, VX1, VY1, 1, 0, [2.3, 7.35, 11.0]);   // Gartenseite
  reihe(VX1, VY1, VX0, VY1, 0, 1, [2.3, 7.35, 11.0]);   // Rückseite
  reihe(VX0, VY1, VX0, 16, -1, 0, [2.3, 7.35, 11.0]);   // Westseite
  const walm = new THREE.ConeGeometry(1, 1, 4, 1); walm.rotateY(Math.PI / 4);
  const dach = teil(walm, ziegel, (VX0 + VX1) / 2, (VY0 + VY1) / 2, HOCH + 3.7);
  dach.scale.set((VX1 - VX0) * 0.76, 7.4, (VY1 - VY0) * 0.76); dach.rotation.z = 0.035;
  const turm = (x, y, r, h, dachH, kipp, mitFahne) => {
    teil(kachel(new THREE.CylinderGeometry(r, r * 1.06, h, 18), 0.4), putz, x, y, h / 2);
    for (const hh of [h * 0.34, h * 0.67, h - 0.15]) teil(new THREE.CylinderGeometry(r + 0.18, r + 0.18, 0.3, 18), balken, x, y, hh);   // Gesimse am Turm
    const spitze = teil(new THREE.ConeGeometry(r * 1.3, dachH, 18), ziegel, x, y, h + dachH / 2 - 0.1);
    spitze.rotation.z = -kipp * 0.14;   // schiefe Zipfelmütze wie im Original
    const sx = x + Math.sin(kipp * 0.14) * dachH;   // dorthin zeigt die Spitze
    for (let i = 0; i < 4; i++) for (const hh of [h * 0.22, h * 0.55, h * 0.82]) {   // Turmfenster rundum (zur Wand hin weglassen)
      const w = i * Math.PI / 2 + (i % 2) * 0.25 + 0.5, nx = Math.sin(w), ny = -Math.cos(w);
      if (nx > 0.3 && ny > 0.3) continue;
      fenster(x + nx * (r + 0.05), y + ny * (r + 0.05), hh, gierVon(nx, ny), 0.7);
    }
    if (mitFahne) {   // Wetterfahne: ein lila Tentakel statt eines Hahns
      teil(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), holzD, sx, y, h + dachH + 0.9);
      const t = teil(new THREE.CapsuleGeometry(0.22, 0.9, 4, 10), M(0x8a3ab8), sx, y, h + dachH + 1.7);
      t.geometry.translate(0, 0.55, 0); t.rotation.z = -1.2; t.userData.beweglich = true; fahnen.push(t);
      for (const s of [-1, 1]) { const a = teil(new THREE.SphereGeometry(0.09, 8, 6), weiss, 0, 0, 0, 0, t); a.position.set(0.18, 0.85, s * 0.12); a.userData.beweglich = true; }
    }
  };
  const fahnen = [];
  turm(VX0, VY0, 3.0, 19, 8.5, 0.6, true);
  turm(VX1 - 0.6, VY1 - 0.4, 2.1, 16, 6.5, -0.5, false);
  const rauch = [];
  for (const [x, y, h] of [[-20, 17.5, 4.6], [-11, 24, 3.6]]) {   // schiefe Schornsteine mit Rauchwölkchen
    const s = kiste(x - 0.6, x + 0.6, y - 0.6, y + 0.6, HOCH + 1, HOCH + 1 + h, M(0x9a4a3a)); s.rotation.z = 0.06;
    for (let i = 0; i < 6; i++) {
      const r = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), ohneKontur(new THREE.MeshBasicMaterial({ color: 0xeef2f6, transparent: true, opacity: 0.5, depthWrite: false })));
      r.userData = { beweglich: true, x, y, h: HOCH + 1.4 + h, i }; welt.add(r); rauch.push(r);
    }
  }

  // ---- hinter der Kamera: Feldweg, Hecke mit Lücke, Bäume, Wegweiser zum Hafen ----
  flach(new THREE.PlaneGeometry(420, 4.2), M(0xc0a070), 0, -7.5, 0.02);
  const hecke = M(0x3a7a2e), heckeH = M(0x4e9a3a);
  for (const [x0, x1] of [[-60, -4], [3, 26]]) {
    kiste(x0, x1, -3.9, -2.7, 0, 1.25, hecke);
    for (let x = x0 + 1; x < x1; x += 2.2) teil(new THREE.SphereGeometry(0.75, 10, 6), heckeH, x, -3.3, 1.2 + Math.sin(x) * 0.12).scale.set(1.1, 0.55, 0.9);
  }
  const blatt = [M(0x4aa83a), M(0x6cc048), M(0x3a8a2e)];
  let baumNr = 0;
  const baum = (x, y, s) => {
    const nr = 'BaumW' + baumNr++;
    teil(new THREE.CylinderGeometry(0.28 * s, 0.4 * s, 3.4 * s, 8, 6), holzD, x, y, 1.7 * s).name = nr + 'Stamm';
    for (let i = 0; i < 4; i++) {
      const w = i * 1.9 + x;
      teil(new THREE.SphereGeometry((1.5 + (i % 2) * 0.5) * s, 12, 8), blatt[((i + Math.round(y)) % 3 + 3) % 3], x + Math.cos(w) * 0.9 * s, y + Math.sin(w) * 0.9 * s, (3.6 + (i % 3) * 0.7) * s).name = nr + 'Krone' + i;
    }
  };
  for (const [x, y, s] of [[-18, -13, 1.3], [-9, -17, 1.1], [7, -14, 1.2], [17, -11, 1.4], [-31, -5, 1.2], [27, -3, 1.0], [-38, 6, 1.5], [-36, 20, 1.3],
    [-34, 34, 1.4], [-46, 14, 1.2], [22, 3, 1.1], [-12, -30, 1.6], [12, -34, 1.5], [-52, -22, 1.4], [40, -30, 1.3]]) baum(x, y, s);
  teil(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), holzD, 14, -5, 1.2);
  const schild = teil(new THREE.BoxGeometry(1.6, 0.42, 0.08), holz, 14.6, -5, 2.05, 0); schild.rotation.z = -0.06;
  teil(new THREE.ConeGeometry(0.3, 0.5, 3), holz, 15.55, -5, 2.05).rotation.z = -Math.PI / 2;

  // ---- die Bucht mit dem Hafen ----
  flach(new THREE.CircleGeometry(267, 96), M(0xe8d49a), 300, 10, 0.06);   // Strand
  const meerM = ohneKontur(M(0x2f86c8));
  flach(new THREE.CircleGeometry(260, 96), meerM, 300, 10, 0.12);
  const kamm = ohneKontur(new THREE.MeshBasicMaterial({ color: 0xffffff })), wellen = [];
  for (let i = 0; i < 40; i++) {   // Schaumkämme
    const x = 46 + (i * 37) % 120, y = -40 + (i * 53) % 140;
    const w = teil(new THREE.BoxGeometry(2.2 + (i % 3), 0.06, 0.22), kamm, x, y, 0.16, (i % 5) * 0.3);
    w.userData = { beweglich: true, x, y, ph: i * 0.7 }; wellen.push(w);
  }
  for (const y of [4, 15]) {   // zwei Stege auf Pfählen, mit Fässern und Kisten
    kiste(36, 58, y - 1.1, y + 1.1, 0.75, 0.95, holz);
    for (let x = 37; x <= 57; x += 2.5) for (const s of [-1, 1]) teil(new THREE.CylinderGeometry(0.14, 0.14, 2.2, 6), holzD, x, y + s * 1.0, -0.2);
    for (let i = 0; i < 4; i++) teil(new THREE.CylinderGeometry(0.38, 0.38, 0.9, 10), holzD, 40 + i * 4.3, y + (i % 2 ? 0.5 : -0.4), 1.4);
    kiste(46, 47.1, y - 0.2, y + 0.9, 0.95, 2.0, holz);
  }
  const schiffe = [], segelM = new THREE.MeshToonMaterial({ color: 0xf6eedc, gradientMap: GRAD, side: THREE.DoubleSide });
  segelM.userData.outlineParameters = { thickness: 0.004, color: INK, alpha: 1, visible: true };
  const segel = (w, h) => {   // bauchiges Rahsegel quer zum Rumpf, vom Wind nach vorn gedrückt
    const g = new THREE.PlaneGeometry(w, h, 8, 4), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i) / (w / 2), v = p.getY(i) / (h / 2); p.setZ(i, 0.55 * (1 - u * u) * (1 - 0.35 * v * v)); }
    g.computeVertexNormals(); g.rotateY(Math.PI / 2);
    return new THREE.Mesh(g, segelM);
  };
  const schiff = (x, y, gier, s) => {
    const g = new THREE.Group(); g.position.copy(bl(x, y, 0.15)); g.rotation.y = gier; g.scale.setScalar(s); g.userData.beweglich = true; welt.add(g);
    const b = (w, h, d, mat, px, py, pz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(px, py, pz); g.add(m); return m; };
    b(9.6, 1.2, 2.2, holzD, 0, 0.1, 0); b(11, 1.1, 3.0, holz, 0, 1.2, 0);   // Rumpf
    b(2.6, 1.3, 3.0, holz, -4.3, 2.35, 0); b(2.8, 0.2, 3.2, gold, -4.3, 3.05, 0);   // Achterkastell
    b(11.2, 0.22, 3.12, gold, 0, 1.75, 0);   // Zierleiste
    for (let i = 0; i < 4; i++) b(0.32, 0.32, 3.14, M(0x1a1410), -2 + i * 1.6, 1.25, 0);   // Stückpforten
    const bug = new THREE.Mesh(new THREE.ConeGeometry(1.55, 2.8, 4), holz); bug.rotation.set(Math.PI / 4, 0, -Math.PI / 2); bug.scale.set(1, 1, 0.75); bug.position.set(6.8, 1.25, 0); g.add(bug);
    const spriet = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 5, 6), holzD); spriet.rotation.z = -1.2; spriet.position.set(8.4, 2.5, 0); g.add(spriet);
    for (const [mx, mh] of [[-2.6, 9], [0.6, 11.5], [3.6, 9.5]]) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, mh, 8), holzD); mast.position.set(mx, 1.7 + mh / 2, 0); g.add(mast);
      for (const [sh, sw, sy] of [[0.34, 1, 0.42], [0.28, 0.8, 0.74]]) { const sg = segel(sw * 4.4, sh * mh); sg.position.set(mx + 0.2, 1.7 + mh * sy, 0); g.add(sg); }
      const f = b(1.0, 0.5, 0.04, rotM, mx + 0.5, 1.95 + mh, 0); f.userData.fahne = true; fahnen.push(f);
    }
    mergeUnder(g, c => !!c.userData.fahne);   // ein Schiff = eine Handvoll Zeichenaufrufe
    schiffe.push({ g, ph: x * 0.37 + y * 0.11 });
  };
  schiff(51, 0.9, 0.04, 1); schiff(53, 18.2, Math.PI - 0.05, 0.95); schiff(86, 6, 0.6, 1.1); schiff(128, 44, -0.4, 1.2); schiff(150, -25, 2.2, 1.0);
  const haus = (x, y, w, d, h, wand, gier) => {   // Hafenhäuser mit Giebeldach, Tür und Fenstern zum Wasser
    const g = new THREE.Group(); g.position.copy(bl(x, y, 0)); g.rotation.y = gier; welt.add(g);
    const k = new THREE.Mesh(kachel(new THREE.BoxGeometry(w, h, d)), wand); k.position.y = h / 2; g.add(k);
    const form = new THREE.Shape([new THREE.Vector2(-d / 2 - 0.3, 0), new THREE.Vector2(d / 2 + 0.3, 0), new THREE.Vector2(0, h * 0.55)]);
    const gd = new THREE.ExtrudeGeometry(form, { depth: w + 0.5, bevelEnabled: false }); gd.translate(0, 0, -(w + 0.5) / 2); gd.rotateY(Math.PI / 2);
    const dm = new THREE.Mesh(gd, M(0x6a3a3a)); dm.position.y = h; g.add(dm);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.9, 1.0), M(0x3a2418)); t.position.set(w / 2 + 0.02, 0.95, 0); g.add(t);
    for (const [py, pz] of [[h * 0.75, -d * 0.28], [h * 0.75, d * 0.28], [h * 0.35, d * 0.3]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.7), glas); f.position.set(w / 2 + 0.03, py, pz); g.add(f); }
  };
  const wandF = [M(0xa84a3a), M(0xe8e0cc), M(0x6a7a9a), M(0xd8b878), M(0x8a5a8a)];
  [[30, 22, 4], [30.5, 28, 5], [29.5, 46, 4.5], [30, 52, 4], [31, 58, 5.5], [30.5, 65, 4]].forEach(([x, y, h], i) => haus(x, y, 4.2, 4.8, h, wandF[i % 5], 0));
  // Leuchtturm auf der Insel, mit kreisendem Lichtkegel
  const lt = new THREE.Group(); lt.position.copy(bl(89.7, 37.9, 2.4)); welt.add(lt);
  for (let i = 0; i < 6; i++) { const r0 = 1.5 - i * 0.1, r1 = 1.4 - i * 0.1, z = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 1.8, 14), i % 2 ? weiss : rotM); z.position.y = 0.9 + i * 1.8; lt.add(z); }
  const galerie = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.16, 14), holzD); galerie.position.y = 10.9; lt.add(galerie);
  const lampe = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.3, 12), leuchtMat(0xfff2a0)); lampe.position.y = 11.6; lt.add(lampe);
  const kappe = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.3, 12), rotM); kappe.position.y = 12.9; lt.add(kappe);
  const licht = new THREE.Group(); licht.position.y = 11.6; licht.userData.beweglich = true; lt.add(licht);
  const kegelM = ohneKontur(new THREE.MeshBasicMaterial({ color: 0xfff4b0, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  for (const s of [-1, 1]) { const k = new THREE.Mesh(new THREE.ConeGeometry(2.6, 26, 16, 1, true), kegelM); k.rotation.z = s * Math.PI / 2; k.position.x = -s * 13.5; licht.add(k); }
  mergeUnder(lt, c => c === licht);
  lt.userData.beweglich = true;
  // Möwen kreisen über dem Hafen
  const moewen = [], moeweM = ohneKontur(M(0xffffff));
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Group(); m.userData.beweglich = true;
    for (const s of [-1, 1]) m.add(new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.05, 0.22).translate(s * 0.37, 0, 0), moeweM));
    welt.add(m); moewen.push(m);
  }

  // Statisches zusammenfassen (wenige Zeichenaufrufe, wichtig für die Xbox), Bewegtes bleibt einzeln
  mergeUnder(welt, c => !!c.userData.beweglich || !!(c.parent && c.parent.userData.beweglich));
  scene.add(welt);
  return {
    tick(s) {
      for (const sh of schiffe) { sh.g.position.y = 0.15 + Math.sin(s * 0.9 + sh.ph) * 0.12; sh.g.rotation.x = Math.sin(s * 0.7 + sh.ph) * 0.03; sh.g.rotation.z = Math.sin(s * 0.55 + sh.ph) * 0.02; }
      for (const f of fahnen) f.rotation.y = Math.sin(s * 3 + f.position.x) * 0.35;
      licht.rotation.y = s * 0.7;
      for (const w of wellen) { const k = (s * 0.18 + w.userData.ph) % 1; w.scale.set(0.4 + k, 1, 1); w.visible = k < 0.85; }
      moewen.forEach((m, i) => {
        const w = s * (0.22 + i * 0.03) + i * 1.3, r = 9 + i * 2.2;
        m.position.copy(bl(46 + Math.cos(w) * r, 10 + Math.sin(w) * r, 9 + i * 1.4 + Math.sin(s + i) * 0.6)); m.rotation.y = w;
        const schlag = Math.sin(s * 7 + i * 2) * 0.45; m.children[0].rotation.z = -0.3 - schlag; m.children[1].rotation.z = 0.3 + schlag;
      });
      for (const r of rauch) {
        const u = r.userData, k = (s * 0.22 + u.i / 6) % 1;
        r.position.copy(bl(u.x + k * 2.2, u.y + k * 0.6, u.h + k * 6)); r.scale.setScalar(0.5 + k * 1.7); r.material.opacity = 0.55 * (1 - k);
      }
    },
  };
}

// ---------- Auffahrt (Ankunft der Helden, js/ankunft.js): Bus-Türen, Hüpfen, Haustür, Kamera-Tentakel ----------
// Steuerung über G.ankunft = { schiebe, tuerV, haustuer (je 0…1), hopsT, kt: 'weg' | 'schweben' }
// Spukhaus rundherum: in Blender hat nur die Vorderseite Fenster – Seiten und Rückseite bekommen hier ihre eigenen
// (warmes Licht, Kreuz, schiefe Läden, Fensterbank), damit die Umrundung im Vorspann keine kahlen Wände zeigt.
// Jedes Fenster sucht sich per Strahl von außen die (schiefe) Wand und richtet sich nach ihr aus.
// Jedes Fenster (mit Läden und Bank), jede Gaube, die Haustür und jede Laterne bekommt ihre eigene Schiefe: gekippt,
// zum Trapez gezogen, geschert; Laternen lehnen sich und tragen einen dicken Kopf. Teile eines Fensters biegen gemeinsam.
function fassadeVerbiegen(H) {
  H.updateMatrixWorld(true);
  const gruppen = new Map(), lampen = [];
  H.traverse(o => {
    if (!o.isMesh) return;
    const n = nm(o);
    let m = /^(?:Laden)?(Fenster(?:H?[OU]|S-?1[OU])\d)/.exec(n) || /^Gaube(?:Dach|Fenster|Korpus)(\d)/.exec(n) || /^(KuppelFenster\d)/.exec(n);
    let key = m ? (m[0].startsWith('Gaube') ? 'Gaube' + m[1] : m[1]) : /^(Tuer[LR]|TuerRahmen|Klinke\d)$/.test(n) ? 'Haustuer' : null;
    if (/^Laterne|^LaternenDach|^LaternenPfahl|^LaterneDach/.test(n)) { lampen.push(o); return; }
    if (!key) return;
    if (!gruppen.has(key)) gruppen.set(key, []);
    gruppen.get(key).push(o);
  });
  // Laternen: Teile nach ihrer Lage zusammenfassen (Mast, Gehäuse und Dach stehen übereinander)
  const _c = new THREE.Vector3(), bbL = new THREE.Box3();
  for (const o of lampen) {
    bbL.setFromObject(o).getCenter(_c);
    let g = null; for (const [k, v] of gruppen) if (k.startsWith('Lampe') && Math.hypot(v.x - _c.x, v.z - _c.z) < 0.7) { g = k; break; }
    if (!g) { g = 'Lampe' + gruppen.size; const arr = []; arr.x = _c.x; arr.z = _c.z; gruppen.set(g, arr); }
    gruppen.get(g).push(o);
  }
  const v = new THREE.Vector3(), mm = new THREE.Matrix4(), mi = new THREE.Matrix4(), bb = new THREE.Box3(), schon = new Set();
  for (const [key, ms] of gruppen) {
    bb.makeEmpty(); for (const o of ms) bb.expandByObject(o);
    const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2, cz = (bb.min.z + bb.max.z) / 2, y0 = bb.min.y, hoch = Math.max(0.2, bb.max.y - y0);
    const ex = bb.max.x - bb.min.x, ez = bb.max.z - bb.min.z, ueberX = ex >= ez;   // waagrechte Achse in der Wand
    let s = 5; for (const ch of key) s = (s * 31 + ch.charCodeAt(0)) % 10007;
    const r = k => ((s * (k * 7919 % 997 + 3)) % 1000) / 500 - 1;
    const lampe = key.startsWith('Lampe');
    const win = 0.13 * r(1) + (r(1) > 0 ? 0.04 : -0.04), trapez = 0.2 * r(2), scher = 0.14 * r(3), lx = 0.16 * r(4), lz = 0.12 * r(5), kopf = 0.22 + 0.12 * r(6);
    for (const o of ms) {
      if (!o.geometry || !o.geometry.attributes.position) continue;
      if (schon.has(o)) continue; schon.add(o);
      o.geometry = o.geometry.clone(); o.updateMatrixWorld(true); mm.copy(o.matrixWorld); mi.copy(mm).invert();
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mm);
        if (lampe) {   // Mast lehnt sich (je höher, desto mehr), oben ein dicker Kopf
          const h = Math.max(0, (v.y - y0) / hoch), k = 1 + kopf * Math.max(0, h - 0.7) / 0.3;
          v.x = cx + (v.x - cx) * k + lx * hoch * h * h; v.z = cz + (v.z - cz) * k + lz * hoch * h * h;
        } else {
          let a = ueberX ? v.x - cx : v.z - cz, b = v.y - cy;
          const c = Math.cos(win), sn = Math.sin(win), a2 = a * c - b * sn, b2 = a * sn + b * c;
          a = a2 * (1 + trapez * b2 / (hoch / 2)) + scher * b2; b = b2;
          if (ueberX) v.x = cx + a; else v.z = cz + a;
          v.y = cy + b;
        }
        v.applyMatrix4(mi); pos.setXYZ(i, v.x, v.y, v.z);
      }
      pos.needsUpdate = true; o.geometry.computeBoundingBox(); o.geometry.computeBoundingSphere();
    }
  }
}
// Prolog-Landschaft: Wellen im Boden und Schlängeln des Flusses (Blender-Meter); am Ufer der Tentakel bleibt alles flach
const prologFall = (x, y) => Math.max(0, Math.min(1, (Math.hypot(x - 20, y - 46) - 7) / 14));
const prologHoch = (x, y) => 0.9 * prologFall(x, y) * (Math.sin(x * 0.13 + y * 0.07) + 0.6 * Math.sin(y * 0.21 - x * 0.05));
const prologQuer = (x, y) => { const f = prologFall(x, y); return [f * (1.6 * Math.sin(y * 0.25) + 0.7 * Math.sin(x * 0.4)), f * 1.2 * Math.sin(x * 0.22 + 0.8)]; };
// Himmel für Szenen ohne eigene Angabe in Blender (Horizont, oben)
const HIMMEL_EXTRA = { prolog: ['#cfeeff', '#3f8ee0'] };
// Vor dem Zusammenfassen der festen Teile (danach gibt es die einzelnen Fenster nicht mehr)
const RAUM_VORBAU = {
  // Prolog-Landschaft wie gemalt: die Wiese wellt sich, der Fluss schlängelt sich schiefer, Ufer, Steine und Brücke
  // wandern mit; dort, wo die Tentakel stehen (und Rohr und Fleck sind), bleibt alles, wie es war
  prolog(H) {
    H.updateMatrixWorld(true);
    const hoch = prologHoch, quer = prologQuer;
    const v = new THREE.Vector3(), mm = new THREE.Matrix4(), mi = new THREE.Matrix4(), c = new THREE.Vector3(), bb = new THREE.Box3();
    const flussig = /^P_(Fluss|Ufer|Stein|Brett|Gelaender|Pfosten)/;
    const teile = []; H.traverse(o => { if (o.isMesh) teile.push(o); });
    for (const o of teile) {
      const n = nm(o);
      if (/^P_(Boden|Fluss|Ufer)$/.test(n)) {   // Flächen: jeder Punkt für sich
        o.geometry = o.geometry.clone(); mm.copy(o.matrixWorld); mi.copy(mm).invert();
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(mm);
          const bx = v.x, by = -v.z; v.y += hoch(bx, by);
          if (n !== 'P_Boden') { const [qx, qy] = quer(bx, by); v.x += qx; v.z -= qy; }
          v.applyMatrix4(mi); pos.setXYZ(i, v.x, v.y, v.z);
        }
        pos.needsUpdate = true; o.geometry.computeVertexNormals(); o.geometry.computeBoundingBox(); o.geometry.computeBoundingSphere();
      } else if (!/^P_(Huegel|Berg|HausHuegel|Rohr|Schleim)/.test(n)) {   // Dinge auf dem Boden (Bäume mit Kronen): als Ganzes mit
        let imHaus = false; for (let q = o.parent; q; q = q.parent) if (nm(q) === 'P_Haus') imHaus = true;
        if (imHaus) continue;   // das Haus auf dem Hügel bleibt beisammen
        bb.setFromObject(o);
        bb.getCenter(c); const bx = c.x, by = -c.z, d = new THREE.Vector3(0, hoch(bx, by), 0);
        if (flussig.test(n)) { const [qx, qy] = quer(bx, by); d.x += qx; d.z -= qy; }
        const ziel = o.getWorldPosition(new THREE.Vector3()).add(d);
        o.position.copy(o.parent ? o.parent.worldToLocal(ziel) : ziel);
      }
    }
  },
  auffahrt(H) {
    // die Rück- und Seitenfenster aus Blender stecken (durch die schiefe Wand) in der Mauer – villaRundum setzt eigene davor
    const weg = []; H.traverse(o => { if (/^(Laden)?Fenster(H[OU]|S-?1[OU])/.test(nm(o))) weg.push(o); });
    for (const o of weg) if (o.parent) o.parent.remove(o);
    fassadeVerbiegen(H);
  },
};
function villaRundum(scene, H) {
  scene.updateMatrixWorld(true);
  const glas = leuchtMat(0xffd27a), rahmen = toonMat(0xf2eee6), laden = toonMat(0x1f3a2a), gruppe = new THREE.Group(); gruppe.name = 'VillaRundum';
  const tast = new THREE.Raycaster(), n = new THREE.Vector3(), zA = new THREE.Vector3(0, 0, 1);
  const fenster = (p, nrm, nr) => {
    const f = new THREE.Group(), w = 1.35, h = 3.1, kipp = ((nr * 7) % 5 - 2) * 0.025;
    f.position.copy(p); f.quaternion.setFromUnitVectors(zA, nrm); f.rotateZ(kipp);
    const teil = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); f.add(m); return m; };
    teil(new THREE.BoxGeometry(w + 0.3, h + 0.3, 0.12), rahmen, 0, 0, 0.02);
    teil(new THREE.PlaneGeometry(w, h), glas, 0, 0, 0.09);
    teil(new THREE.BoxGeometry(0.12, h, 0.06), rahmen, 0, 0, 0.12); teil(new THREE.BoxGeometry(w, 0.12, 0.06), rahmen, 0, h * 0.15, 0.12);
    for (const sx of [-1, 1]) teil(new THREE.BoxGeometry(0.62, h + 0.1, 0.08), laden, sx * (w / 2 + 0.45), 0, 0.06).rotation.z = sx * kipp * 3;
    teil(new THREE.BoxGeometry(w + 0.6, 0.16, 0.3), rahmen, 0, -h / 2 - 0.2, 0.1);   // Fensterbank
    gruppe.add(f);
  };
  let nr = 0;
  const setze = (x, y, h, dx, dy) => {   // Blender-Meter: Wandpunkt und Blickrichtung von außen auf die Wand
    const von = bl(x - dx * 6, y - dy * 6, h), r = new THREE.Vector3(dx, 0, -dy).normalize();
    tast.set(von, r); tast.far = 10;
    for (const hit of tast.intersectObject(H, true)) {
      if (Math.abs(hit.distance - 6) > 2.5 || !hit.face) continue;
      n.copy(hit.face.normal).transformDirection(hit.object.matrixWorld); n.y = 0;
      if (n.lengthSq() < 0.1 || n.normalize().dot(r) > -0.6) continue;   // nur eine Wand, die zu uns schaut
      fenster(hit.point.clone().addScaledVector(n, 0.03), n.clone(), nr++);
      return;
    }
  };
  for (const h of [3.25, 8.95]) {
    for (const x of [-8.6, -5.5, -2.3, 0.9, 4.1, 7.0]) setze(x, 29.2, h, 0, -1);   // Rückseite
    for (const y of [20.7, 23.8, 26.9]) { setze(-11.2, y, h, 1, 0); setze(9.1, y, h, -1, 0); }   // Seiten
  }
  scene.add(gruppe);
}
// Der Tourbus als Gruselbus im Stil der 60er (Hommage an den Bus aus Scooby-Doo): oben himmelblau, unten grasgrün,
// ein orangener Zierstreifen und große orangene Blumen auf beiden Seiten – und krumm wie ein Zeichentrick-Van
function gruselBus(scene, auto, tv, st) {
  const farbe = (re, hex) => auto.traverse(o => {
    if (!o.isMesh) return;
    const ms = [].concat(o.material), neu = ms.map(m => re.test(m.name || '') ? Object.assign(m.clone(), { name: m.name }) : m);
    neu.forEach((m, i) => { if (m !== ms[i]) m.color.set(hex); });
    o.material = Array.isArray(o.material) ? neu : neu[0];
  });
  farbe(/BusDach/, 0x5ec6e0); farbe(/BusLack/, 0x7cc443);
  auto.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(auto), x0 = bb.min.x, x1 = bb.max.x, y0 = bb.min.y, H = bb.max.y - y0;
  // Lack zweifarbig: über dem Zierstreifen himmelblau, darunter grün (eine Fläche, darum per Höhe im Shader)
  const blau = new THREE.Color(0x5ec6e0), teilung = y0 + H * 0.47;
  auto.traverse(o => {
    if (!o.isMesh) return;
    const oy = o.getWorldPosition(new THREE.Vector3()).y;   // relativ zum Teil: der Bus federt beim Aussteigen
    for (const m of [].concat(o.material)) if (/BusLack/.test(m.name || '') && !m.userData.zweifarbig) {
      m.userData.zweifarbig = true;
      m.onBeforeCompile = sh => {
        sh.uniforms.uTeilung = { value: teilung - oy }; sh.uniforms.uOben = { value: blau };
        sh.vertexShader = 'varying vec3 vWeltLage;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWeltLage = (modelMatrix * vec4(transformed, 1.0)).xyz - modelMatrix[3].xyz;');
        sh.fragmentShader = 'varying vec3 vWeltLage;\nuniform float uTeilung;\nuniform vec3 uOben;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  if (vWeltLage.y > uTeilung) diffuseColor.rgb = uOben;');
      };
      m.customProgramCacheKey = () => 'gruselbus';
      m.needsUpdate = true;
    }
  });
  const orange = toonMat(0xf28a1e), gelb = toonMat(0xffd43a), streifen = toonMat(0xf07a18);
  const teile = [auto, tv, st].filter(Boolean), boxen = teile.map(o => new THREE.Box3().setFromObject(o));
  const anhaengen = (m) => {   // an das Teil hängen, auf dem die Blume sitzt (Schiebetür und Fahrertür bewegen sich)
    const w = m.getWorldPosition(new THREE.Vector3());
    let ziel = auto; for (const i of [2, 1]) if (teile[i] && boxen[i].containsPoint(w)) { ziel = teile[i]; break; }
    ziel.attach(m);
  };
  for (const seite of [1, -1]) {
    const z = seite > 0 ? bb.max.z + 0.012 : bb.min.z - 0.012, rot = seite > 0 ? 0 : Math.PI;
    const band = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - 0.5, 0.07, 0.015), streifen);   // Zierstreifen zwischen Blau und Grün
    band.position.set((x0 + x1) / 2, y0 + H * 0.47, z); scene.add(band); auto.attach(band);
    [[0.18, 0.3, 0.34], [0.42, 0.22, 0.24], [0.6, 0.36, 0.3], [0.8, 0.26, 0.22], [0.3, 0.58, 0.18]].forEach(([u, v, r], i) => {
      const blume = new THREE.Group(), x = seite > 0 ? x0 + (x1 - x0) * u : x1 - (x1 - x0) * u;
      for (let k = 0; k < 5; k++) {
        const w = k / 5 * Math.PI * 2 + i, bl_ = new THREE.Mesh(new THREE.CircleGeometry(r * 0.42, 14), orange);
        bl_.position.set(Math.cos(w) * r * 0.55, Math.sin(w) * r * 0.55, 0); bl_.scale.set(1, 1.25, 1); bl_.rotation.z = w + Math.PI / 2; blume.add(bl_);
      }
      const mitte = new THREE.Mesh(new THREE.CircleGeometry(r * 0.3, 14), gelb); mitte.position.z = 0.004; blume.add(mitte);
      blume.position.set(x, y0 + H * v, z); blume.rotation.set(0, rot, i * 0.4); scene.add(blume); anhaengen(blume);
    });
  }
  // krumm wie gezeichnet: das Dach wölbt sich in der Mitte, oben schmaler, vorn ein wenig nach vorn gekippt
  const mx = (x0 + x1) / 2, mz = (bb.min.z + bb.max.z) / 2, L = (x1 - x0) / 2, v = new THREE.Vector3(), mm = new THREE.Matrix4(), mi = new THREE.Matrix4();
  auto.updateMatrixWorld(true);
  auto.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    o.geometry = o.geometry.clone(); mm.copy(o.matrixWorld); mi.copy(mm).invert();
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mm);
      const u = (v.x - mx) / L, h = Math.max(0, (v.y - y0) / H);
      v.y += 0.07 * H * (1 - u * u) * h;
      v.x = mx + (v.x - mx) * (1 - 0.05 * h) + 0.07 * H * h * h;
      v.z = mz + (v.z - mz) * (1 - 0.13 * h) + 0.04 * H * u * h;
      v.applyMatrix4(mi); pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true; o.geometry.computeBoundingBox(); o.geometry.computeBoundingSphere();
  });
}
function auffahrtTeile(scene, H) {
  villaRundum(scene, H);
  const auto = find(H, 'Auto'), kt = find(H, 'KamTent'), tv = find(H, 'AutoTuerV'), st = find(H, 'AutoSchiebetuer');
  const tuer = [find(H, 'TuerL'), find(H, 'TuerR')];
  if (auto) mergeUnder(auto, c => c === tv || c === st);   // der Bus: eine Handvoll Zeichenaufrufe, Türen bleiben beweglich
  if (auto) gruselBus(scene, auto, tv, st);
  const rollen = [];
  if (kt) { kt.traverse(o => { if (/^KamRolle\d$/.test(nm(o))) rollen.push(o); }); mergeUnder(kt, c => rollen.includes(c) || /^KamLampe$/.test(nm(c))); }
  const lampe = kt && find(kt, 'KamLampe');
  const b = o => o && { p: o.position.clone(), q: o.quaternion.clone() };
  const B0 = { auto: b(auto), kt: b(kt), tv: b(tv), st: b(st), tuer: tuer.map(b) };
  // Türen der Villa drehen um ihre Außenkante nach innen; dahinter warmes Licht aus der Diele
  const angel = tuer.map((o, i) => { if (!o) return null; const bb = new THREE.Box3().setFromObject(o); return new THREE.Vector3(i ? bb.max.x : bb.min.x, 0, (bb.min.z + bb.max.z) / 2); });   // Scharnier: Außenkante
  if (tuer[0] && tuer[1]) {
    const bb = new THREE.Box3().setFromObject(tuer[0]).union(new THREE.Box3().setFromObject(tuer[1]));
    const licht = new THREE.Mesh(new THREE.PlaneGeometry(bb.max.x - bb.min.x, bb.max.y - bb.min.y), leuchtMat(0xf2c878));
    licht.material.userData.outlineParameters = { visible: false };
    licht.position.set((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, bb.min.z - 0.08); scene.add(licht);
  }
  const _q3 = new THREE.Quaternion(), _yy = new THREE.Vector3(0, 1, 0);
  let kamera = null;
  return {
    tick(s) {
      const A = (typeof G !== 'undefined' && G.ankunft) || {}, jetzt = typeof G !== 'undefined' ? G.t : s * 1000;
      if (tv && B0.tv) tv.quaternion.copy(B0.tv.q).multiply(_q3.setFromAxisAngle(_yy, (A.tuerV || 0) * 1.2));
      if (st && B0.st) st.position.set(B0.st.p.x - (A.schiebe || 0) * 1.55, B0.st.p.y, B0.st.p.z + Math.min(1, (A.schiebe || 0) * 4) * 0.12);
      if (auto && B0.auto) {   // Aussteigen: der Bus federt nach (gedämpfte Schwingung)
        const k = A.hopsT ? (jetzt - A.hopsT) / 1000 : 9;
        auto.position.y = B0.auto.p.y + (k < 1.6 ? Math.exp(-k * 3.2) * Math.sin(k * 18) * 0.09 : 0);
      }
      tuer.forEach((o, i) => {   // nach innen aufschwingen, um die Außenkante
        if (!o || !B0.tuer[i]) return;
        const w = (A.haustuer || 0) * 1.35 * (i ? -1 : 1), h = angel[i], c = Math.cos(w), sn = Math.sin(w);
        const dx = B0.tuer[i].p.x - h.x, dz = B0.tuer[i].p.z - h.z;
        o.quaternion.copy(B0.tuer[i].q).premultiply(_q3.setFromAxisAngle(_yy, w));
        o.position.set(h.x + dx * c + dz * sn, B0.tuer[i].p.y, h.z - dx * sn + dz * c);
      });
      if (kt && B0.kt) {
        kt.visible = A.kt !== 'weg';
        const Rf = rooms.auffahrt;
        if (A.kt === 'flug' && Rf && Rf.flugKT) {   // Kameraflug: auf seiner Bahn um die Villa, filmt dabei zu uns her
          kt.position.copy(Rf.flugKT); kt.position.y += Math.sin(s * 2.4) * 0.12; kt.scale.setScalar(1.15);
        } else if (A.kt === 'anflug') {   // Vorspann, erste Einstellung: das Tentakel schwebt auf seiner Wolke heran (wie Lakitu)
          const k = Math.min(1, Math.max(0, (jetzt - (A.anflugT0 || jetzt)) / 3800)), e = 1 - Math.pow(1 - k, 3);
          const von = bl(9, 26, 13), bis = bl(1.2, -31.2, 6.1);
          kt.position.lerpVectors(von, bis, e);
          kt.position.y += Math.sin(s * 2.2) * 0.18 + Math.sin(e * Math.PI) * 1.5;
          kt.scale.setScalar(1.25);
        } else {
          kt.scale.setScalar(1);
          kt.position.set(B0.kt.p.x + Math.sin(s * 0.7) * 0.25, B0.kt.p.y + Math.sin(s * 1.7) * 0.12 + 0.1, B0.kt.p.z + Math.cos(s * 0.55) * 0.18);
        }
        if (!kamera) scene.traverse(o => { if (!kamera && o.isCamera) kamera = o; });
        if (kamera) {   // dreht sich (mit Kamera in der Tentakelspitze) immer zum Geschehen
          const ziel = Math.atan2(kamera.position.x - kt.position.x, kamera.position.z - kt.position.z);
          kt.quaternion.copy(B0.kt.q).premultiply(_q3.setFromAxisAngle(_yy, ziel));
        }
        for (const r of rollen) r.rotation.x = s * 4;
        if (lampe) lampe.visible = Math.floor(s * 2) % 2 === 0;
      }
    },
  };
}

// ---------- Kameraflug (Vorspann, Super-Mario-64-Hommage): Catmull-Rom-Bahn durch Wegpunkte, Blick auf mitlaufendes Ziel ----------
// punkte: [[x, y, z, zx, zy, zz], …] in Blender-Metern (Ort und Blickziel); dauer in Spiel-Millisekunden
export function kameraflug(id, punkte, dauer, fov = 42, opt = {}) {
  const R = rooms[id]; if (!R || !R.ready) return false;
  R.flug = { punkte: punkte.map(p => [bl(p[0], p[1], p[2]), bl(p[3] ?? p[0], p[4] ?? p[1], p[5] ?? p[2])]), dauer, t0: null, fov,
    folgen: !!opt.folgen, schluss: opt.ende ? [bl(opt.ende[0], opt.ende[1], opt.ende[2]), bl(opt.ende[3], opt.ende[4], opt.ende[5])] : null,
    blick: opt.blick ? bl(opt.blick[0], opt.blick[1], opt.blick[2]) : null };
  R.flugKT = null;
  return true;
}
export function kameraflugEnde(id) { const R = rooms[id]; if (R && R.flug) R.flug.aus = true; }   // Schnitt: zurück zur Spielkamera
const _cr = (a, b, c, d, t, out) => {   // Catmull-Rom zwischen b und c
  const t2 = t * t, t3 = t2 * t;
  return out.set(
    0.5 * (2 * b.x + (-a.x + c.x) * t + (2 * a.x - 5 * b.x + 4 * c.x - d.x) * t2 + (-a.x + 3 * b.x - 3 * c.x + d.x) * t3),
    0.5 * (2 * b.y + (-a.y + c.y) * t + (2 * a.y - 5 * b.y + 4 * c.y - d.y) * t2 + (-a.y + 3 * b.y - 3 * c.y + d.y) * t3),
    0.5 * (2 * b.z + (-a.z + c.z) * t + (2 * a.z - 5 * b.z + 4 * c.z - d.z) * t2 + (-a.z + 3 * b.z - 3 * c.z + d.z) * t3));
};
const _fp = new THREE.Vector3(), _fz = new THREE.Vector3();
function flugKamera(R, t) {
  const F = R.flug, cam = R.camera;
  if (F.aus) { R.flug = null; cam.fov = R.home.fov; cam.updateProjectionMatrix(); return false; }
  if (F.t0 == null) F.t0 = t;
  const P = F.punkte, n = P.length - 1, roh = Math.min(1, (t - F.t0) / F.dauer);
  const k = roh * roh * (3 - 2 * roh);   // weich los, weich an
  const u = k * n, i = Math.min(n - 1, Math.floor(u)), f = u - i;
  const g = j => P[Math.max(0, Math.min(n, j))];
  _cr(g(i - 1)[0], g(i)[0], g(i + 1)[0], g(i + 2)[0], f, _fp);
  _cr(g(i - 1)[1], g(i)[1], g(i + 1)[1], g(i + 2)[1], f, _fz);
  if (F.folgen) {   // Verfolgung: _fp ist das Tentakel auf seiner Wolke, die Kamera hängt dicht dahinter (leicht seitlich, etwas höher)
    const u2 = Math.min(n, u + 0.06), i2 = Math.min(n - 1, Math.floor(u2)), f2 = u2 - i2;
    const vor = _cr(g(i2 - 1)[0], g(i2)[0], g(i2 + 1)[0], g(i2 + 2)[0], f2, new THREE.Vector3());
    const tan = vor.sub(_fp); tan.y *= 0.4; if (tan.lengthSq() < 1e-6) tan.set(0, 0, -1); tan.normalize();
    R.flugKT = (R.flugKT || new THREE.Vector3()).copy(_fp);
    const seite = new THREE.Vector3(-tan.z, 0, tan.x);
    let kp, kz;
    if (F.blick) {   // Umrundung wie Lakitu in Super Mario 64: Kamera außen neben und hinter dem Tentakel, Blick zum Haus – beide im Bild
      const raus = _fp.clone().sub(F.blick); raus.y = 0; if (raus.lengthSq() < 1e-6) raus.copy(seite); raus.normalize();
      const nah = Math.min(1, _fp.distanceTo(F.blick) / 12);   // nah am Haus (Anflug, Landung) weniger weit hinaus
      kp = _fp.clone().addScaledVector(raus, 4.6 * nah).addScaledVector(tan, -4.2); kp.y += 1.9;
      kz = _fp.clone().lerp(F.blick, 0.55 * nah);
    } else {
      kp = _fp.clone().addScaledVector(tan, -5.4).addScaledVector(seite, 1.9); kp.y += 1.5;
      kz = _fp.clone().addScaledVector(tan, 2.2); kz.y -= 0.4;   // etwas voraus: das Tentakel sitzt im Bild, der Weg liegt vor ihm
    }
    if (F.schluss) { const e = Math.max(0, Math.min(1, (roh - 0.84) / 0.16)), ee = e * e * (3 - 2 * e); kp.lerp(F.schluss[0], ee); kz.lerp(F.schluss[1], ee); }
    _fp.copy(kp); _fz.copy(kz);
  }
  _fp.x += Math.sin(t * 0.0021) * 0.06; _fp.y += Math.sin(t * 0.0017) * 0.05;   // Handkamera-Wackeln
  cam.position.copy(_fp);
  if (cam.fov !== F.fov + fischPlus()) { cam.fov = F.fov + fischPlus(); cam.updateProjectionMatrix(); }
  R.flugBlick = (R.flugBlick || new THREE.Vector3()).copy(_fz);   // dorthin scharf stellen (Tiefenunschärfe)
  cam.quaternion.setFromRotationMatrix(_m.lookAt(cam.position, _fz, _yA));
  return true;
}

// ---------- Raum-Extras: Teile, die das Spiel selbst bewegt oder dazubaut ----------
const EXTRA_BEWEGLICH = {
  uhrwerk: /^(Notsteg|Riesenpendel|Kolben|Zahnrad(\d+|[AB]|Tief\d+)|Zifferblatt|Zeiger(Gross|Klein))$/,
  lobby: /^L_Uhr$|^L_Konf|^L_Bilderrahmen|^L_Leinwand|^L_Rahmenrosette|^L_Plakett/,
  auffahrt: /^(KamTent|Auto|TuerL|TuerR)$/,
  prolog: /^P_Schleim/,
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
// ---------- Prolog „Wie alles begann“ in 3D: Glibberstrahl aus Dr. Freds Rohr, Fleck, Arme-Blitz ----------
export const PROLOG3D = { muendung: [24.05, 56.59, 1.1], wasser: [24.3, 53.4, 0.05], fleck: [21.025, 50.95, 0.05], gruen: [19.414, 42.909, 0], lila: [20.616, 45.384, 0], haus: [24, 74, 6] };
function prologTeile(scene, H) {
  const P = PROLOG3D, a = bl(...P.muendung), e = bl(...P.wasser);
  const lila = leuchtMat(0xb44ae0), hell = leuchtMat(0xecc0ff);
  const kurve = new THREE.CatmullRomCurve3([a, a.clone().lerp(e, 0.3).add(new THREE.Vector3(0.3, 0.15, 0)), a.clone().lerp(e, 0.7).add(new THREE.Vector3(0.12, -0.1, 0)), e]);
  const strahlGeo = new THREE.TubeGeometry(kurve, 40, 0.17, 8), strahl = new THREE.Mesh(strahlGeo, lila); strahl.visible = false; scene.add(strahl);
  const tropfen = Array.from({ length: 7 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), hell); m.visible = false; scene.add(m); return m; });
  let fleck = null; const blasen = [];
  H.traverse(o => { if (nm(o) === 'P_Schleimfleck') fleck = o; else if (/^P_SchleimBlase/.test(nm(o))) blasen.push({ o, y: o.position.y }); });
  const f0 = fleck && fleck.scale.clone();
  const blitz = new THREE.PointLight(0xff7ad9, 0, 10, 2); blitz.position.copy(bl(P.lila[0], P.lila[1], 1.8)); scene.add(blitz);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff9ae8, transparent: true }); ringMat.userData.outlineParameters = { visible: false };
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.07, 8, 40), ringMat); ring.rotation.x = Math.PI / 2; ring.position.copy(bl(P.lila[0], P.lila[1], 0.9)); ring.visible = false; scene.add(ring);
  const proSegment = 8 * 6;
  // Glitzer treiben den Fluss hinunter (vom Haus zur Wiese), auf der geschlängelten Bahn wie Wasser und Ufer
  const lauf = [[46, 66], [32, 59], [21, 51], [11, 41], [3, 33], [-5, 27], [-13, 21], [-23, 17], [-40, 14]].map(([x, y]) => { const [qx, qy] = prologQuer(x, y); return [x + qx, y + qy]; });
  const bahn = new THREE.CatmullRomCurve3(lauf.map(([x, y]) => bl(x, y, 0)));
  const glMat = new THREE.MeshBasicMaterial({ color: 0xeaffff, transparent: true, opacity: 0.75, depthWrite: false }); glMat.userData.outlineParameters = { visible: false };
  const glGeo = new THREE.CircleGeometry(0.32, 10); glGeo.rotateX(-Math.PI / 2);
  const glitzer = Array.from({ length: 80 }, (_, i) => { const m = new THREE.Mesh(glGeo, glMat); m.userData = { u: i / 80, quer: Math.sin(i * 2.7) * 1.4, v: 0.012 + (i % 5) * 0.002, l: 0.9 + (i % 3) * 0.5 }; scene.add(m); return m; });
  const _t = new THREE.Vector3(), _p = new THREE.Vector3();
  return {
    tick(s) {
      for (const m of glitzer) {
        const d = m.userData, u = (d.u + s * d.v) % 1;
        bahn.getPointAt(u, _p); bahn.getTangentAt(u, _t);
        const bx = _p.x, by = -_p.z;
        m.position.set(_p.x - _t.z * d.quer, 0.07 + prologHoch(bx, by), _p.z + _t.x * d.quer);
        const f = Math.sin(u * Math.PI), blink = 0.5 + 0.5 * Math.sin(s * 3 + d.quer * 4);
        m.scale.set(d.l * f * (0.7 + blink * 0.8), 1, 0.4 * f);
        m.rotation.y = Math.atan2(_t.x, _t.z);
      }
      const pr = typeof G !== 'undefined' && G.prolog, t = typeof G !== 'undefined' ? G.t : 0;
      const k = pr && pr.sludgeT ? Math.min(1, (t - pr.sludgeT) / 600) : 0, wachs = pr && pr.sludgeT ? Math.min(1, (t - pr.sludgeT) / 4000) : (pr ? 0 : 1);
      strahl.visible = k > 0; strahlGeo.setDrawRange(0, Math.max(1, Math.floor(40 * k)) * proSegment);
      strahl.position.x = Math.sin(s * 9) * 0.03;
      tropfen.forEach((m, i) => { m.visible = k >= 1; if (m.visible) { m.position.copy(kurve.getPoint((s * 0.7 + i / 7) % 1)); m.position.x += Math.sin(i * 3 + s * 6) * 0.06; } });
      if (fleck && f0) { const g = 0.3 + 0.7 * wachs + Math.sin(s * 3) * 0.03 * wachs; fleck.scale.set(f0.x * g, f0.y, f0.z * g); }
      blasen.forEach(({ o, y }, i) => { o.visible = wachs > 0.15; o.position.y = y + Math.abs(Math.sin(s * 2.2 + i * 1.7)) * 0.12; });
      const arme = pr && pr.armsT ? t - pr.armsT : -1;
      blitz.intensity = arme >= 0 ? 40 * Math.max(0, 1 - arme / 1300) : 0;
      ring.visible = arme >= 0 && arme < 1300;
      if (ring.visible) { const q = arme / 1300; ring.scale.setScalar(0.4 + q * 3.2); ringMat.opacity = 1 - q; }
    },
  };
}
// ---------- Leben draußen: ziehende Toon-Wolken, kreisende Vögel (abends Fledermäuse), Glühwürmchen ----------
const DRAUSSEN_LEBEN = {
  auffahrt: { wolken: 7, voegel: 5, gluehen: 50, nacht: true }, prolog: { wolken: 9, voegel: 6, gluehen: 0 },
  garten1776: { wolken: 8, voegel: 6, gluehen: 18 }, fgarten: { wolken: 6, voegel: 0, gluehen: 34, nacht: true },
};
function draussenLeben(scene, id, cam) {
  const L = DRAUSSEN_LEBEN[id]; if (!L) return null;
  const C = toWorld(cam, 480, 330, new THREE.Vector3());   // Mitte der Bühne am Boden
  const hell = toonMat(L.nacht ? 0xd8c8f0 : 0xffffff), schatten = toonMat(L.nacht ? 0xa898c8 : 0xe4ecf8);
  const kugel = new THREE.SphereGeometry(1, 12, 8), wolken = [], voegel = [];
  for (let i = 0; i < L.wolken; i++) {
    const w = new THREE.Group(), n = 4 + (i % 3);
    for (let j = 0; j < n; j++) {
      const b = new THREE.Mesh(kugel, j % 2 ? hell : schatten);
      b.position.set((j - n / 2) * 2.4 + Math.sin(i * 3 + j) * 0.8, Math.sin(j * 1.7 + i) * 0.9, Math.cos(j * 2.3 + i) * 1.1);
      const g = 2.2 + ((i + j) % 3) * 0.8; b.scale.set(g, g * 0.68, g); w.add(b);
    }
    w.userData = { a: i / L.wolken * Math.PI * 2 + 0.3, r: 75 + (i * 37 % 55), h: 24 + (i * 13 % 16), v: 0.006 + (i % 3) * 0.003 };
    scene.add(w); wolken.push(w);
  }
  const fl = new THREE.BoxGeometry(0.8, 0.04, 0.26), kp = new THREE.SphereGeometry(0.16, 8, 6), vm = toonMat(L.nacht ? 0x241834 : 0x3a2a44);
  for (let i = 0; i < L.voegel; i++) {
    const v = new THREE.Group(), seiten = [-1, 1].map(sx => { const piv = new THREE.Group(), m = new THREE.Mesh(fl, vm); m.position.x = sx * 0.4; piv.add(m); v.add(piv); return piv; });
    const k = new THREE.Mesh(kp, vm); k.scale.set(0.8, 0.7, 1.6); v.add(k);
    if (L.nacht) v.scale.setScalar(0.75);   // Fledermäuse: kleiner, hektischer
    v.userData = { seiten, a: i * 1.3, r: 16 + i * 5, h: 13 + (i % 3) * 3, w: (i % 2 ? 1 : -1) * (0.22 + (i % 3) * 0.05), ph: i * 0.9 };
    scene.add(v); voegel.push(v);
  }
  if (L.nacht) {   // Vollmond mit Hof und ein Sternenhimmel (die Nachbearbeitung lässt den Mond leuchten)
    if (!goldGlanz) goldtoastModell();
    const mondMat = new THREE.SpriteMaterial({ map: goldGlanz, color: 0xc8d8ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    mondMat.userData.outlineParameters = { visible: false };
    const hof = new THREE.Sprite(mondMat); hof.scale.set(30, 30, 1); hof.position.set(C.x - 40, 62, C.z - 105); scene.add(hof);
    const scheibe = new THREE.Mesh(new THREE.CircleGeometry(6, 40), leuchtMat(0xf4f6ff)); scheibe.material.userData.outlineParameters = { visible: false };
    scheibe.position.copy(hof.position); scheibe.lookAt(C.x, 1.5, C.z); scene.add(scheibe);
    const n = 260, sp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, h = 0.25 + Math.random() * 0.75, r = 115; sp.set([C.x + Math.cos(a) * r * Math.sqrt(1 - h * h), 10 + h * r * 0.8, C.z + Math.sin(a) * r * Math.sqrt(1 - h * h)], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const sterne = new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, color: 0xfff8e8, transparent: true, opacity: 0.85, depthWrite: false }));
    sterne.frustumCulled = false; scene.add(sterne);
  }
  let punkte = null, basis = null;
  if (L.gluehen) {
    const n = L.gluehen, pos = new Float32Array(n * 3), col = new Float32Array(n * 3); basis = [];
    for (let i = 0; i < n; i++) { const a = i * 2.39996, r = 2 + (i * 7 % 13); basis.push([C.x + Math.cos(a) * r, 0.4 + (i * 0.37 % 2.4), C.z + Math.sin(a) * r * 0.7, i * 1.7]); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!goldGlanz) goldtoastModell();   // gleiche weiche Leuchttextur
    const pm = new THREE.PointsMaterial({ size: 0.42, map: goldGlanz, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    punkte = new THREE.Points(geo, pm); punkte.frustumCulled = false; scene.add(punkte);
  }
  return {
    tick(s) {
      for (const w of wolken) { const d = w.userData, a = d.a + s * d.v; w.position.set(C.x + Math.cos(a) * d.r, d.h, C.z + Math.sin(a) * d.r * 0.8 - 20); }
      for (const v of voegel) {
        const d = v.userData, a = d.a + s * d.w, flap = Math.sin(s * (13 + d.ph) + d.ph) * (d.w > 0 ? 0.7 : 0.6);
        v.position.set(C.x + Math.cos(a) * d.r, d.h + Math.sin(s * 0.7 + d.ph) * 1.2, C.z - 8 + Math.sin(a) * d.r * 0.6);
        v.rotation.y = Math.atan2(-Math.sin(a) * Math.sign(d.w), Math.cos(a) * 0.6 * Math.sign(d.w));
        d.seiten[0].rotation.z = flap; d.seiten[1].rotation.z = -flap;
      }
      if (punkte) {
        const pos = punkte.geometry.attributes.position, col = punkte.geometry.attributes.color;
        basis.forEach(([x, y, z, ph], i) => {
          pos.setXYZ(i, x + Math.sin(s * 0.5 + ph) * 0.9, y + Math.sin(s * 0.8 + ph * 1.3) * 0.35, z + Math.cos(s * 0.42 + ph) * 0.9);
          const b = Math.max(0, Math.sin(s * 1.6 + ph * 2.1)) ** 3; col.setXYZ(i, 0.75 * b, 1.0 * b, 0.35 * b);
        });
        pos.needsUpdate = true; col.needsUpdate = true;
      }
    },
  };
}
// ---------- Atmosphäre: Lichtkegel unter Lampen, Staub im Licht (Innenräume) ----------
const KEGEL_VS = `varying vec3 vN; varying vec3 vV; varying float vH;
  void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vH = uv.y; gl_Position = projectionMatrix * mv; }`;
const KEGEL_FS = `uniform vec3 farbe; varying vec3 vN; varying vec3 vV; varying float vH;
  void main() { float rand = pow(abs(dot(vN, vV)), 1.6); float a = rand * (0.25 + 0.75 * vH) * 0.12; gl_FragColor = vec4(farbe * a, 1.0); }`;
function lichtKegel(scene, pos, farbe) {   // weicher Lichtschein von der Lampe zum Boden (additiv, zu den Rändern hin unsichtbar)
  const h = pos.y, geo = new THREE.ConeGeometry(Math.min(1.6, 0.45 + h * 0.32), h, 24, 1, true);
  const mat = new THREE.ShaderMaterial({ uniforms: { farbe: { value: farbe.clone().lerp(new THREE.Color(0xffe2b0), 0.4) } }, vertexShader: KEGEL_VS, fragmentShader: KEGEL_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  mat.userData.outlineParameters = { visible: false };
  const m = new THREE.Mesh(geo, mat); m.position.set(pos.x, h / 2, pos.z); m.userData.keinKrumm = true; m.renderOrder = 3; scene.add(m);
}
function schwebeStaub(scene, innen) {   // feiner Staub, der im Licht schwebt
  const n = 70, pos = new Float32Array(n * 3), basis = [];
  for (let i = 0; i < n; i++) basis.push([innen.x0 + Math.random() * (innen.x1 - innen.x0), 0.4 + Math.random() * Math.min(3.2, innen.y1 - 0.5), innen.z0 + Math.random() * (innen.z1 - innen.z0), Math.random() * 6.28]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (!goldGlanz) goldtoastModell();
  const pm = new THREE.PointsMaterial({ size: 0.07, map: goldGlanz, color: 0xffe8c0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, pm); pts.frustumCulled = false; scene.add(pts);
  return { tick(s) {
    basis.forEach(([x, y, z, ph], i) => pos.set([x + Math.sin(s * 0.13 + ph) * 0.5, y + Math.sin(s * 0.21 + ph * 1.7) * 0.25, z + Math.cos(s * 0.11 + ph) * 0.5], i * 3));
    geo.attributes.position.needsUpdate = true;
  } };
}
// ---------- Staubwölkchen (Rennen, Absprung, Landung) und der runde Schatten unter der Figur (wie in Super Mario 64) ----------
let weichTex = null;
function weichTextur() {   // weiche runde Wolke (für Staub)
  if (weichTex) return weichTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), rg = g.createRadialGradient(32, 32, 4, 32, 32, 31);
  rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(0.55, 'rgba(255,255,255,0.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64); weichTex = new THREE.CanvasTexture(c); return weichTex;
}
function staubWolke(R, pos, winkel, kraft) {
  const P = R.staub; let s = P.liste.find(x => !x.an);
  if (!s) {
    if (P.liste.length >= 30) return;
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: weichTextur(), color: R.innen ? 0xe0d2bc : 0xd8dcc8, transparent: true, depthWrite: false }));
    m.material.userData.outlineParameters = { visible: false }; R.scene.add(m); s = { m }; P.liste.push(s);
  }
  const w = winkel == null ? Math.random() * Math.PI * 2 : winkel;
  Object.assign(s, { an: true, t0: performance.now(), x: pos.x, y: pos.y + 0.06, z: pos.z, vx: Math.cos(w) * kraft * 0.55, vz: Math.sin(w) * kraft * 0.55, life: 480 + Math.random() * 220 });
  s.m.visible = true;
}
function staubPruefen(R, a, f, now) {
  const P = R.staub || (R.staub = { liste: [], letzt: 0, land: 0, sprung: 0 }), fuss = f.holder.position;
  if (a._landT3d && a._landT3d !== P.land) { P.land = a._landT3d; for (let i = 0; i < 7; i++) staubWolke(R, fuss, i / 7 * Math.PI * 2, 1.2 + (a._landV3d || 0) * 2.2); }
  if (a._jumpT3d && a._jumpT3d !== P.sprung) { P.sprung = a._jumpT3d; for (let i = 0; i < 4; i++) staubWolke(R, fuss, i / 4 * Math.PI * 2 + 0.4, 0.9); }
  if (a.run && a.walking && (a._vz3d || 0) === 0 && now - P.letzt > 105) { P.letzt = now; staubWolke(R, fuss, null, 0.5); }
}
function staubTick(R) {
  const P = R.staub; if (!P) return; const now = performance.now();
  for (const s of P.liste) {
    if (!s.an) continue;
    const q = (now - s.t0) / s.life;
    if (q >= 1) { s.an = false; s.m.visible = false; continue; }
    const e = 1 - (1 - q) * (1 - q), g = 0.22 + 0.8 * e;
    s.m.position.set(s.x + s.vx * e, s.y + 0.32 * e, s.z + s.vz * e); s.m.scale.set(g, g, 1); s.m.material.opacity = 0.6 * (1 - q);
  }
}
const _ss = new THREE.Vector3();
function sprungSchatten(R, a, id) {   // runder Schatten auf dem, was unter der gesteuerten Figur liegt – zum Zielen beim Springen
  let S = R.sprungSchatten;
  if (!S) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x140a20, transparent: true, opacity: 0.34, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    mat.userData.outlineParameters = { visible: false };
    S = R.sprungSchatten = new THREE.Mesh(new THREE.CircleGeometry(0.33, 24), mat); S.rotation.x = -Math.PI / 2; S.renderOrder = 2; R.scene.add(S);
  }
  const q = a._pos3d; if (!q) { S.visible = false; return; }
  const boden = Math.max(0, plattformHoehe(id, q[0], q[1], (a._z3d || 0) + 0.01)), ueber = Math.max(0, (a._z3d || 0) - boden);
  _ss.copy(bl(q[0], q[1], boden + 0.015));
  if (R.krumm && boden > 0.001) _ss.add(krummVersatz(R.krumm, _ss.x, _ss.y, _ss.z, _kv));
  S.position.copy(_ss); const k = 1 / (1 + ueber * 0.45); S.scale.set(k, k, 1); S.material.opacity = 0.34 * Math.max(0.35, k); S.visible = true;
}
// ---------- Wetter im Echtzeit-3D: Regenstriche rund um die Kamera, Spritzer am Boden; an der Villa ein fernes Gewitter ----------
function regenTick(R, an, dt) {
  let W = R.regen;
  if (!an) { if (W) W.linien.visible = false; return; }
  if (!W) {
    const n = 700, pos = new Float32Array(n * 6), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0.5, depthWrite: false });
    const linien = new THREE.LineSegments(geo, mat); linien.frustumCulled = false; R.scene.add(linien);
    const tropfen = Array.from({ length: n }, () => ({ x: 0, y: -99, z: 0, v: 13 + Math.random() * 5 }));
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xdcecff, transparent: true, opacity: 0.6, depthWrite: false }); ringMat.userData.outlineParameters = { visible: false };
    const ringGeo = new THREE.RingGeometry(0.06, 0.1, 14); ringGeo.rotateX(-Math.PI / 2);
    const ringe = Array.from({ length: 40 }, () => { const m = new THREE.Mesh(ringGeo, ringMat); m.visible = false; R.scene.add(m); return { m, t0: 0 }; });
    W = R.regen = { linien, tropfen, ringe, ri: 0 };
  }
  W.linien.visible = true;
  const cam = R.camera.position, ziel = R.ziel || cam, cxm = (cam.x + ziel.x) / 2, czm = (cam.z + ziel.z) / 2, sek = Math.min(0.05, dt / 1000), now = performance.now();
  const pos = W.linien.geometry.attributes.position;
  W.tropfen.forEach((d, i) => {
    d.y -= d.v * sek; d.x += 1.2 * sek;
    if (d.y < 0) {
      if (d.y > -90 && Math.random() < 0.25) { const r = W.ringe[W.ri++ % W.ringe.length]; r.m.position.set(d.x, 0.02, d.z); r.t0 = now; r.m.visible = true; }
      d.x = cxm + (Math.random() - 0.5) * 22; d.z = czm + (Math.random() - 0.5) * 22; d.y = 6 + Math.random() * 6;
    }
    pos.setXYZ(i * 2, d.x, d.y, d.z); pos.setXYZ(i * 2 + 1, d.x - 0.06, d.y + 0.5, d.z);
  });
  pos.needsUpdate = true;
  for (const r of W.ringe) if (r.m.visible) { const q = (now - r.t0) / 260; if (q >= 1) r.m.visible = false; else r.m.scale.setScalar(0.6 + q * 2.2); }
}
const GEWITTER = new Set(['auffahrt']);
function gewitterTick(R, t) {
  if (!GEWITTER.has(R.id)) return;
  const W = R.gewitter || (R.gewitter = { naechster: t + 6000 + Math.random() * 8000, t0: -1e9, licht: null, basis: 1 });
  if (!W.licht) R.scene.traverse(o => { if (!W.licht && o.isHemisphereLight) { W.licht = o; W.basis = o.intensity; } });
  if (t > W.naechster) {
    W.t0 = t; W.naechster = t + 14000 + Math.random() * 18000;
    const ms = 500 + Math.random() * 1300;   // Donner kommt etwas später (fern)
    if (typeof Sound !== 'undefined') setTimeout(() => Sound.sfx('thunder'), ms);
  }
  const x = (t - W.t0) / 1000, blitz = x < 0.6 ? Math.exp(-x * 7) * (0.7 + 0.3 * Math.sin(x * 55)) : 0;
  if (W.licht) W.licht.intensity = W.basis * (1 + 2.6 * Math.max(0, blitz));
}
// ---------- Krümel: kleine Sammeldinger in Spuren durch den Raum (wie die Figments in Psychonauts) ----------
// js/echt3d.js plant die Orte (begehbar, eine Spur führt zum goldenen Toast) und merkt sich die gefundenen (Bitmaske)
let kruemelGeo = null, kruemelMat = null;
export function kruemelDa(id) { const R = rooms[id]; return !!(R && R.ready && R.kruemel); }
export function bodenFrei(id, x, y) { const R = rooms[id]; return !!(R && R.ready && (!R.kisten || !kisteSperrt(R, x, y, 0))); }
export function kruemelSetzen(id, liste, weg) {
  const R = rooms[id]; if (!R || !R.ready || !liste.length) return false;
  if (R.kruemel) R.scene.remove(R.kruemel.mesh);
  if (!kruemelGeo) {
    kruemelGeo = new THREE.IcosahedronGeometry(0.08, 0);
    kruemelMat = new THREE.MeshToonMaterial({ color: 0xf2b448, emissive: 0x6a3a00, gradientMap: GRAD });
    kruemelMat.userData.outlineParameters = { thickness: 0.006, color: INK, alpha: 1, visible: true };
  }
  const mesh = new THREE.InstancedMesh(kruemelGeo, kruemelMat, liste.length); mesh.frustumCulled = false;
  const punkte = liste.map(([x, y, h]) => { const p = bl(x, y, h + 0.32); if (R.krumm && h > 0.001) p.add(krummVersatz(R.krumm, p.x, p.y, p.z, new THREE.Vector3())); return p; });
  R.kruemel = { mesh, punkte, liste, weg: weg >>> 0, anim: new Map() };
  R.scene.add(mesh);
  return true;
}
const _km = new THREE.Matrix4(), _kq = new THREE.Quaternion(), _ksk = new THREE.Vector3(), _ke = new THREE.Euler(), _kp = new THREE.Vector3();
function kruemelStellen(R, s) {
  const K = R.kruemel, now = performance.now();
  K.punkte.forEach((p, i) => {
    let sc = (K.weg >>> i) & 1 ? 0 : 1, y = p.y + Math.sin(s * 2.4 + i * 0.7) * 0.05;
    const a = K.anim.get(i);
    if (a != null) { const q = (now - a) / 360; if (q >= 1) K.anim.delete(i); else { sc = (1 + q * 1.2) * (1 - q); y += q * 0.7; } }
    _ke.set(s * 1.5 + i, s * 2.1 + i * 0.5, 0); _kq.setFromEuler(_ke); _ksk.setScalar(Math.max(0.0001, sc));
    K.mesh.setMatrixAt(i, _km.compose(_kp.set(p.x, y, p.z), _kq, _ksk));
  });
  K.mesh.instanceMatrix.needsUpdate = true;
}
function kruemelSammeln(R, a, id) {
  const K = R.kruemel, q = a._pos3d; if (!K || !q) return;
  K.liste.forEach(([x, y, h], i) => {
    if ((K.weg >>> i) & 1) return;
    if (Math.hypot(q[0] - x, q[1] - y) < 0.55 && Math.abs((a._z3d || 0) - h) < 0.9) {
      K.weg = (K.weg | (1 << i)) >>> 0; K.anim.set(i, performance.now());
      if (typeof kruemelGefunden === 'function') kruemelGefunden(id, K.weg);
    }
  });
}
// ---------- Goldene Toasts: einer pro Raum zum Einsammeln (wie die Sterne in Super Mario 64) ----------
// js/echt3d.js sucht den Platz aus (begehbar, Möbel zum Hinaufspringen) und merkt sich, was schon gefunden ist
export function goldtoastKandidaten(id) {   // Oberseiten von Möbeln, auf die man mit einem Sprung kommt (Blender-Meter)
  const R = rooms[id]; if (!R || !R.ready || !R.kisten) return [];
  return R.kisten.filter(({ k }) => k[4] >= 0.45 && k[4] <= 1.1 && k[1] - k[0] >= 0.45 && k[3] - k[2] >= 0.45).map(({ k }) => [(k[0] + k[1]) / 2, (k[2] + k[3]) / 2, k[4]]);
}
export function weltVonSpiel(id, gx, gy) { const R = rooms[id]; if (!R || !R.ready || !R.camera) return null; if (!R.home) kameraLoesen(R); const p = toWorld(R.home, gx, gy, new THREE.Vector3()); return [p.x, -p.z, 0]; }
export function goldtoastDa(id) { const R = rooms[id]; return !!(R && R.ready && R.goldtoast); }
export function goldtoastSetzen(id, ort) {
  const R = rooms[id]; if (!R || !R.ready) return false;
  if (R.goldtoast) R.scene.remove(R.goldtoast.g);
  const g = goldtoastModell(), p = bl(ort[0], ort[1], ort[2] + 0.5);
  if (R.krumm) p.add(krummVersatz(R.krumm, p.x, p.y, p.z, new THREE.Vector3()));   // sitzt auf dem verbogenen Möbel
  g.position.copy(p); R.scene.add(g);
  R.goldtoast = { g, y0: p.y, weg: 0 };
  return true;
}
export function goldtoastWeg(id) { const R = rooms[id]; if (R && R.goldtoast && !R.goldtoast.weg) R.goldtoast.weg = performance.now(); }
let goldGlanz = null;
function goldtoastModell() {
  const w = 0.42, h = 0.4, sh = new THREE.Shape();   // Toastscheibe: unten gerade, oben der gewölbte Brotrand
  sh.moveTo(-w / 2, -h / 2); sh.lineTo(w / 2, -h / 2); sh.lineTo(w / 2, h * 0.16);
  sh.bezierCurveTo(w / 2 + 0.08, h * 0.5, w * 0.26, h * 0.64, 0, h * 0.56);
  sh.bezierCurveTo(-w * 0.26, h * 0.64, -w / 2 - 0.08, h * 0.5, -w / 2, h * 0.16);
  sh.lineTo(-w / 2, -h / 2);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 10 });
  geo.center();
  const gold = new THREE.MeshToonMaterial({ color: 0xffd23a, emissive: 0x7a5200, gradientMap: GRAD }), kruste = new THREE.MeshToonMaterial({ color: 0xe0901c, emissive: 0x4a2a00, gradientMap: GRAD });
  for (const m of [gold, kruste]) m.userData.outlineParameters = { thickness: 0.005, color: INK, alpha: 1, visible: true };
  const toast = new THREE.Mesh(geo, [gold, kruste]);   // Vorder- und Rückseite gold, der Rand wie Kruste
  if (!goldGlanz) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g2 = c.getContext('2d'), rg = g2.createRadialGradient(32, 32, 2, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,240,170,1)'); rg.addColorStop(0.35, 'rgba(255,200,80,0.55)'); rg.addColorStop(1, 'rgba(255,180,40,0)');
    g2.fillStyle = rg; g2.fillRect(0, 0, 64, 64); goldGlanz = new THREE.CanvasTexture(c);
  }
  const sm = new THREE.SpriteMaterial({ map: goldGlanz, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  sm.userData.outlineParameters = { visible: false };
  const glanz = new THREE.Sprite(sm); glanz.scale.set(1.5, 1.5, 1);
  const licht = new THREE.PointLight(0xffc040, 2.2, 3.2, 2);
  const g = new THREE.Group(); g.name = 'Goldtoast'; g.add(glanz, toast, licht); g.userData.keinKrumm = true; g.userData.toast = toast;
  return g;
}
function goldtoastTick(R, s) {
  const T = R.goldtoast, g = T.g, toast = g.userData.toast;
  toast.rotation.y = s * 2.4; toast.rotation.z = Math.sin(s * 1.7) * 0.12;
  g.position.y = T.y0 + Math.sin(s * 2.1) * 0.08;
  if (T.weg) {   // eingesammelt: hochschnellen, aufblähen, verschwinden
    const q = (performance.now() - T.weg) / 750;
    if (q >= 1) { R.scene.remove(g); R.goldtoast = null; return; }
    g.position.y = T.y0 + q * 1.6; toast.rotation.y = s * 2.4 + q * 14;
    g.scale.setScalar(q < 0.5 ? 1 + q * 0.8 : 1.4 * (1 - (q - 0.5) / 0.5));
  }
}
// Spiel-Punkt (Bühnenkamera) zu einem Ort in Blender-Metern – wo Figuren stehen sollen, die im Raum frei platziert sind
export function spielVonWelt(id, p) {
  const R = rooms[id]; if (!R || !R.ready || !R.camera) return null;
  if (!R.home) kameraLoesen(R);
  const v = bl(p[0], p[1], p[2] || 0).project(R.home);
  return [(v.x + 1) / 2 * GW, (1 - v.y) / 2 * GH];
}
const RAUM_EXTRAS = {
  prolog: prologTeile,
  garten1776: gartenWelt,
  auffahrt: auffahrtTeile,
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
    const welt = zukunftWelt(scene);   // Tentakel-Palast und Raumhafen ringsum
    return { tick(s, ctx) { weg.visible = typeof flagOn === 'function' && flagOn('tree'); welt.tick(s, ctx); } };
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
    // Tür zum Konferenzsaal auf Labortür-Größe (Tür, Rahmen und Schild wachsen gemeinsam um die Unterkante)
    const konf = []; H.traverse(o => { if (/^(Schild_)?L_Konf/.test(nm(o)) && o.parent === H) konf.push(o); });   // samt übersetzter Schildtafel
    if (konf.length) {
      H.updateMatrixWorld(true);
      const bb = new THREE.Box3(); for (const o of konf) bb.expandByObject(o);
      const gruppe = new THREE.Group(); gruppe.position.set((bb.min.x + bb.max.x) / 2, 0, bb.max.z); scene.add(gruppe);
      for (const o of konf) gruppe.attach(o);
      gruppe.position.x += 0.12; gruppe.scale.set(1.3, 1.35, 1);   // so groß wie die Bürotür, ein Stück weg von der Standuhr
    }
    // das Gemälde darüber: hinauf bis unter das Gesims und auf 80 % (um seine Oberkante), damit es die Tür nicht berührt
    const bild = []; H.traverse(o => { if (/^(Schild_)?L_(Bilderrahmen|Leinwand|Rahmenrosette|Plakett)/.test(nm(o)) && o.parent === H) bild.push(o); });
    if (bild.length) {
      H.updateMatrixWorld(true);
      const bb = new THREE.Box3(); for (const o of bild) bb.expandByObject(o);
      const g = new THREE.Group(); g.position.set((bb.min.x + bb.max.x) / 2, bb.max.y, (bb.min.z + bb.max.z) / 2); scene.add(g);
      for (const o of bild) g.attach(o);
      g.scale.set(0.8, 0.8, 1); g.position.y += 0.2;
    }
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
    // Treppe ins Obergeschoss an der linken Seitenwand (frei vom Empfangstresen): begehbare Stufen, oben geht es hinauf
    const holz = toonMat(0x6a4a30), holzH = toonMat(0x755539), holzD = toonMat(0x4a3220), treppe = new THREE.Group();
    for (const [i, [x0, x1, y0, y1, h]] of LOBBY_TREPPE.entries()) {
      const w = Math.sin(i * 2.3) * 0.11, vs = Math.sin(i * 1.7 + 1) * 0.07;   // jede Stufe ein wenig verdreht und versetzt
      const st = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.08 + Math.sin(i * 3.1) * 0.08, 0.1, y1 - y0 + 0.06), i % 2 ? holz : holzH);
      st.position.copy(bl((x0 + x1) / 2 + vs, (y0 + y1) / 2, h - 0.05)); st.rotation.set(Math.sin(i * 1.3) * 0.03, w, Math.sin(i * 2.9) * 0.04); st.castShadow = st.receiveShadow = true; treppe.add(st);
      const block = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h - 0.1, y1 - y0), holzD);   // Treppenkörper darunter
      block.position.copy(bl((x0 + x1) / 2, (y0 + y1) / 2, (h - 0.1) / 2)); treppe.add(block);
      if (i % 2 === 0) { const stab = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.9, 6), holzD); stab.position.copy(bl(x1 - 0.04, (y0 + y1) / 2, h + 0.4)); stab.rotation.set(Math.sin(i * 1.9) * 0.18, 0, Math.sin(i * 2.6) * 0.16); treppe.add(stab); }
    }
    const tA = LOBBY_TREPPE[0], tZ = LOBBY_TREPPE[LOBBY_TREPPE.length - 1];
    const lauf = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, Math.hypot(tZ[3] - tA[2], tZ[4] - tA[4])), holz);   // Handlauf
    lauf.position.copy(bl(tA[1] - 0.04, (tA[2] + tZ[3]) / 2, (tA[4] + tZ[4]) / 2 + 0.9)); lauf.rotation.x = Math.atan2(tZ[4] - tA[4], tZ[3] - tA[2]); treppe.add(lauf);
    const pfosten = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.25, 0.12), holzD); pfosten.position.copy(bl(tA[1] - 0.04, tA[2] - 0.1, 0.62)); pfosten.rotation.set(0.06, 0.2, -0.12); treppe.add(pfosten);
    const knauf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), toonMat(0xc8a04a)); knauf.position.copy(bl(tA[1] + 0.03, tA[2] - 0.14, 1.3)); knauf.scale.set(1, 1.3, 0.9); treppe.add(knauf);
    lauf.rotation.z = 0.05;   // der Handlauf hängt ein wenig durch und schief
    // biegt mit dem Raum wie alles andere – wer auf den Stufen steht, wird in frame() genauso verschoben
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
  fischVor(_n.set(gx / GW * 2 - 1, 1 - gy / GH * 2));
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
  lobby: LOBBY_TREPPE,
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
    if (x >= p[0] - 0.25 && x <= p[1] + 0.25 && y >= p[2] - 0.25 && y <= p[3] + 0.25 && top <= z + STUFE + 0.01) h = Math.max(h, top);
  }
  const R = rooms[id], r = FIGUR_R;
  if (R && R.kisten) for (const { k, o } of R.kisten) if (k[4] > h && k[4] <= z + STUFE + 0.01 && x > k[0] - r && x < k[1] + r && y > k[2] - r && y < k[3] + r && (!o || sichtbar(o))) h = k[4];
  return h;
}
// Sprung zünden – Tom-&-Jerry-Anlauf: kurz in die Hocke. Verzeihend wie in Super Mario 64: kurz nach dem Herunterlaufen
// von einer Kante zählt der Knopf noch, und wer kurz vor der Landung drückt, springt gleich wieder ab
const HOCKE_MS = 55;
export function huepfen(a) {
  const now = performance.now();
  if (a._vorT3d || a._schub3d) return false;
  if ((a._vz3d || 0) !== 0) {
    if (a._vz3d < 0 && now - (a._bodenT3d || 0) < 150 && now - (a._jumpT3d || 0) > 350) { a._vz3d = SPRUNG_V0; a._jumpT3d = now; return true; }
    a._sprungWunsch3d = now; return false;
  }
  a._vorT3d = now;
  return true;
}
export function sprungLos(a) { if (a && (a._vz3d || 0) > 2.4) a._vz3d *= 0.55; }   // Knopf früh losgelassen: kleinerer Hüpfer
function sprungAbheben(a, now) {
  if (!a._vorT3d || now - a._vorT3d < HOCKE_MS) return;
  // Kombo wie in Super Mario 64: im Laufen direkt nach der Landung wieder abspringen – höher, beim dritten mit Salto
  const kombo = a.walking && now - (a._gelandetT3d || 0) < 240 ? ((a._kombo3d || 0) + 1) % 3 : 0;   // nach dem Salto wieder von vorn
  a._kombo3d = kombo;
  a._vorT3d = null; a._vz3d = SPRUNG_V0 * [1, 1.17, 1.38][kombo]; a._jumpT3d = now;
  if (kombo === 2) a._saltoT3d = now;
  if (typeof Sound !== 'undefined') Sound.sfx(['hopp', 'hopp2', 'hopp3'][kombo]);
  a._z3d = Math.max(a._z3d || 0, 0.0002);   // in der Luft: ab jetzt rechnet die Schwerkraft
}
export function schwerkraft(a, dt, id, px, py) {   // einen Frame Physik; px/py = Blender-Weltposition der Figur
  let z = a._z3d || 0, vz = a._vz3d || 0;
  const sek = Math.min(0.05, dt / 1000), loch = imSprungloch(id, px, py);
  if (vz === 0) {   // Stufe hinauf (Treppe, flache Kante): ohne Sprung hinaufsteigen
    const stufe = plattformHoehe(id, px, py, z);
    if (stufe > z + 0.001 && stufe <= z + STUFE) { a._z3d = stufe; if (stufe > 0.02) a._checkpoint3d = [a.x, a.y, stufe]; return stufe; }
  }
  if (z <= 0.0001 && vz === 0 && !loch) { a._bodenT3d = performance.now(); return z; }
  if (loch && z <= 0.0001 && vz === 0) vz = -0.35;
  vz -= G3D * sek;
  z += vz * sek;
  const boden = plattformHoehe(id, px, py, z);
  if (z <= boden && vz <= 0) {
    if (vz < -2.2) { a._landT3d = performance.now(); a._landV3d = Math.min(1, -vz / 9); if (typeof Sound !== 'undefined') Sound.sfx('plumps'); }   // Platsch: Squash bei der Landung
    if (vz < -0.6) a._gelandetT3d = performance.now();   // echte Landung (für den Kombo-Sprung)
    z = boden; a._vz3d = 0; a._bodenT3d = performance.now();
    if (z > 0.02) a._checkpoint3d = [a.x, a.y, z];
    if (a._sprungWunsch3d && performance.now() - a._sprungWunsch3d < 180) { a._sprungWunsch3d = 0; a._vorT3d = performance.now() - HOCKE_MS + 25; }   // vorgemerkter Sprung
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
// Direkte Steuerung (Stick/WASD): Geschwindigkeit in Metern pro Sekunde, weich beschleunigt und gebremst wie in
// Super Mario 64; die neue Lage wird über die Bühnenkamera in Spiel-Koordinaten zurückgerechnet
const LAUF = { max: 4.8, beschl: 8.5, brems: 11 };
export function lenken(a, dx, dy, sek, id = a.room) {
  const R = rooms[id]; if (!R || !R.ready || !R.home || !R.camera) return null;
  const kraft = Math.min(1, Math.hypot(dx, dy)), v = a._v3d || (a._v3d = { x: 0, z: 0 }), now = performance.now();
  let wx = 0, wz = 0;
  if (kraft > 0.05) {
    const L = a._lenk3d, w = Math.atan2(dy, dx);   // Richtung halten, solange der Stick gleich zeigt (Kamera darf schwenken)
    if (L && L.id === id && now - L.t < 350 && Math.abs(Math.atan2(Math.sin(w - L.w), Math.cos(w - L.w))) < 0.5) _fw.copy(L.fw);
    else {
      _fw.copy(R.camera.getWorldDirection(_fw)); _fw.y = 0;
      if (_fw.lengthSq() < 1e-5) return null;
      _fw.normalize(); a._lenk3d = { id, w, fw: _fw.clone(), t: now };
    }
    a._lenk3d.t = now;
    _rt.crossVectors(_fw, _yA).normalize();
    const n = Math.hypot(dx, dy), s = LAUF.max * kraft;
    wx = (_rt.x * dx - _fw.x * dy) / n * s; wz = (_rt.z * dx - _fw.z * dy) / n * s;
  }
  const k = Math.min(1, sek * (kraft > 0.05 ? LAUF.beschl : LAUF.brems));
  v.x += (wx - v.x) * k; v.z += (wz - v.z) * k;
  const tempo = Math.hypot(v.x, v.z);
  if (tempo < 0.08 && kraft <= 0.05) { v.x = v.z = 0; return { stand: true }; }
  const p = toWorld(R.home, a.x, a.y, new THREE.Vector3());
  p.x += v.x * sek; p.z += v.z * sek; p.y = 0;
  if (R.innen) { const I = R.innen, m = 0.45; p.x = Math.max(I.x0 + m, Math.min(I.x1 - m, p.x)); p.z = Math.max(I.z0 + m, Math.min(I.z1 - m, p.z)); }
  p.project(R.home);
  return { x: (p.x + 1) * GW / 2, y: (1 - p.y) * GH / 2, tempo, yaw: Math.atan2(-v.z, v.x), innen: !!R.innen };
}
export function bewegungsZiel(a, dx, dy, sek, id = a.room) {
  const R = rooms[id]; if (!R || !R.ready || !R.home || !R.camera) return null;
  const kraft = Math.hypot(dx, dy); if (kraft < 0.025) return null;
  const p = toWorld(R.home, a.x, a.y, new THREE.Vector3()), now = performance.now();
  // Richtung festhalten wie in Super Mario 64: solange der Stick gleich zeigt, gilt die Kamera vom Losgehen –
  // schwenkt die Kamera unterwegs (Ecke, Treppe), läuft die Figur trotzdem geradeaus weiter
  const L = a._lenk3d, w = Math.atan2(dy, dx);
  if (L && L.id === id && now - L.t < 350 && Math.abs(Math.atan2(Math.sin(w - L.w), Math.cos(w - L.w))) < 0.5) _fw.copy(L.fw);
  else {
    _fw.copy(R.camera.getWorldDirection(_fw)); _fw.y = 0;
    if (_fw.lengthSq() < 1e-5) return null;
    _fw.normalize();
    a._lenk3d = { id, w, fw: _fw.clone(), t: now };
  }
  a._lenk3d.t = now;
  _rt.crossVectors(_fw, _yA).normalize();
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
    k.mesh.visible = !(freiAktiv() && Math.hypot(R.camera.position.x - p.x, R.camera.position.z - p.z) < 1.2);   // direkt vor der Linse: ausblenden
  }
  for (const [key, k] of karten) if (!seen.has(key) || k.mesh.parent !== R.scene) k.mesh.visible = false;
}

// ---------- Bild für einen Spiel-Frame ----------
let lastT = 0;
const _vis = new Map();
const _v2 = new THREE.Vector3(), _kv = new THREE.Vector3();
let schattenN = 0, letzterSchatten = null;
function curKind(actors) { const id = curId(); const a = actors.find(x => x.id === id); return a ? a.kind : null; }
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
  if (R.goldtoast) goldtoastTick(R, s);
  if (R.kruemel) kruemelStellen(R, s);
  if (R.leben) R.leben.tick(s);
  staubTick(R); regenTick(R, !!ctx.regen, dt); gewitterTick(R, t);
  schilderTick(R);
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
      a._checkpointRoom3d = ctx.id; a._z3d = 0; a._vz3d = 0; a._checkpoint3d = [a.x, a.y, 0]; a._frei3d = null;
    }
    let p = toWorld(R.home, a.x, a.y, _v.clone());
    if (a.id === curId() && R.kisten && R.kisten.length) p = kollision(R, a, p, ctx.id, !!a._gelenkt || (a._vz3d || 0) !== 0);
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
    if (ich && ((a._vz3d || 0) !== 0 || (a._z3d || 0) > 0.0001 || imSprungloch(ctx.id, p.x, -p.z) || plattformHoehe(ctx.id, p.x, -p.z, a._z3d || 0) > (a._z3d || 0) + 0.001)) {   // gesteuerte Figur: Sprung, Plattform oder Loch
      const z = schwerkraft(a, dt, ctx.id, p.x, -p.z);
      if (a._respawned3d) { p.copy(toWorld(R.home, a.x, a.y, _v)); f.holder.position.copy(p); }
      if (z > 0.0001) f.holder.position.y += z;
      else if (z < -0.0001) f.holder.position.y += z;
    }
    // steht man auf einer Stufe, Kiste oder Treppe im verbogenen Raum, verbiegt man sich mit – genau wie der Boden darunter
    if (R.krumm && f.holder.position.y > 0.001) f.holder.position.add(krummVersatz(R.krumm, f.holder.position.x, f.holder.position.y, f.holder.position.z, _kv));
    if (ich) { staubPruefen(R, a, f, now); sprungSchatten(R, a, ctx.id); kruemelSammeln(R, a, ctx.id); R.ichPos = (R.ichPos || new THREE.Vector3()).copy(p); }
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
      if (ctx.id === 'lobby' && (a._z3d || 0) > 2.9 && !a._ausgang3d) a._ausgang3d = 'treppe_hoch';   // oben angekommen
      const fz = Math.max(0, a._z3d || 0) + 1.15;   // Folgekamera auf Brusthöhe: weich hinterher, Höhe gedämpft (Sprünge wackeln nicht)
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
    } else if (a.walking && a._blick3d != null) want = a._blick3d;   // direkt gesteuert: in Laufrichtung
    else if (!ich && !a.walking && R.ichPos && a.id !== curId()) {   // andere Figuren drehen sich zu dir, wenn du nah vorbeikommst
      const dx = R.ichPos.x - p.x, dz = R.ichPos.z - p.z, d2 = dx * dx + dz * dz;
      if (d2 < 20 && d2 > 0.05) want = Math.atan2(-dz, dx);
    }
    const jubel = a._jubelT3d && now - a._jubelT3d < 1300;   // goldener Toast: zur Kamera drehen und jubeln
    if (jubel) want = Math.atan2(-(camera.position.z - p.z), camera.position.x - p.x);
    let dy = want - f.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    f.yaw += dy * Math.min(1, dt / 120);
    const dreh = a._schub3d ? (now - a._schub3d.t0) * 0.03 : 0;   // getroffen: Figur wirbelt um sich selbst
    const salto = a._saltoT3d && now - a._saltoT3d < 620 ? (now - a._saltoT3d) / 620 : 0;   // dritter Kombo-Sprung: Salto vorwärts
    if (a._saltoT3d && !salto) a._saltoT3d = null;
    f.holder.rotation.set(0, f.yaw + dreh, (mf && mf.rot ? -mf.rot : 0) - kipp - salto * Math.PI * 2, 'YXZ');   // Mimik-Neigung, Losflitzen, Salto um die Seitenachse (vorn ist +x)
    if (f.rig) {
      let p0 = pose(f.rig, {});
      if (a._jubelT3d && now - a._jubelT3d < 1300) { const w = Math.sin((now - a._jubelT3d) * 0.018) * 0.25; p0 = pose(f.rig, { aR: -2.7 + w, eR: 0.2, aL: 2.7 - w, eL: 0.2, xR: -0.4, xL: 0.4, lean: -0.12 }); }   // Arme hoch!
      else if (a._vorT3d) p0 = pose(f.rig, { aR: 0.5, eR: 0.4, aL: -0.5, eL: 0.4, tR: -0.7, tL: -0.7, kR: 1.3, kL: 1.3, lean: 0.25 });   // Hocke, Arme nach hinten
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
  // Mitspieler und Gäste direkt vor der Linse ausblenden (sonst füllt ein Hinterkopf das halbe Bild)
  for (const f of Object.values(figs)) {
    let v = seen.has(f.id) && f.holder.parent === R.scene;
    if (v && f.id !== curKind(actors) && freiAktiv()) { _v2.copy(f.holder.position); _v2.y += 1.0; if (_v2.distanceTo(camera.position) < 1.5) v = false; }
    f.holder.visible = v;
  }
  schattenN = (schattenN + 1) % 2;
  if (renderer.shadowMap.enabled && (schattenN === 0 || R !== letzterSchatten)) { renderer.shadowMap.needsUpdate = true; letzterSchatten = R; }
  fischS = fischZiel(R);
  if (POST.an) postRender(R, camera, w, h);
  else if (fischS > 0.01) {
    if (!fischMat) fischBauen();
    const rw = Math.min(2560, Math.round(w * FISCH.ss)), rh = Math.round(h * rw / w);
    if (!fischRT || fischRT.width !== rw || fischRT.height !== rh) {
      if (fischRT) fischRT.dispose();
      fischRT = new THREE.WebGLRenderTarget(rw, rh, { samples: 0, colorSpace: THREE.SRGBColorSpace });
    }
    renderer.setRenderTarget(fischRT); effect.render(R.scene, camera); renderer.setRenderTarget(null);
    const k = FISCH.k * fischS; fischMat.uniforms.tex.value = fischRT.texture; fischMat.uniforms.k.value = k; fischMat.uniforms.z.value = fischZ(k);
    renderer.render(fischSzene, fischKam);
  } else effect.render(R.scene, camera);
  return renderer.domElement;
}
// Ausgänge im Raum: der Weltpunkt der Tür (Mitte ihrer Klickfläche, über die Bühnenkamera auf Wand oder Boden getroffen,
// zurückgebogen wie die Lauffläche) – damit „nah an der Tür“ in Metern zählt und nicht in perspektivisch verzerrten Bildpunkten
export function ausgangLage(id, key, gx, gy) {
  const R = rooms[id]; if (!R || !R.ready || !R.home) return null;
  const cache = R.ausgaenge || (R.ausgaenge = new Map());
  if (cache.has(key)) return cache.get(key);
  _n.set(gx / GW * 2 - 1, 1 - gy / GH * 2); ray.setFromCamera(_n, R.home);
  let p = null;
  for (const h of ray.intersectObjects(R.scene.children, true)) {
    let ok = true;
    // Figuren, Raumhülle und die Möbel an der Vorderwand (nur bei gedrehter Kamera sichtbar) nicht – sonst landet die Tür vorn
    const deko = R.innen && R.innen.deko;
    for (let q = h.object; q && ok; q = q.parent) if (q.visible === false || q === deko || /^(Figur_|Raumhuelle)/.test(q.name || '')) ok = false;
    if (ok) { p = h.point.clone(); break; }
  }
  if (p && R.krumm) entbiegen(R.krumm, p.clone(), p);
  const out = p ? [p.x, p.z] : null;
  cache.set(key, out);
  return out;
}
export function spielerLage(a, id) { const R = rooms[id || a.room]; if (!R || !R.ready || !R.home) return null; const p = toWorld(R.home, a.x, a.y, new THREE.Vector3()); return [p.x, p.z]; }
export function raumInfo(id) {   // Fehlersuche: Innenmaße und Kameralage
  const R = rooms[id || letzterRaum]; if (!R || !R.ready) return null;
  const c = R.camera.position;
  return { innen: R.innen, kamera: [c.x, c.y, c.z].map(v => +v.toFixed(2)), ziel: R.ziel && [R.ziel.x, R.ziel.y, R.ziel.z].map(v => +v.toFixed(2)),
    kisten: (R.kisten || []).map(({ k, o }) => (o ? o.name : '+') + ' ' + k.map(v => v.toFixed(2)).join(' ')) };
}
export function spielPunkt(bx, by, id) {   // Blender-Bodenpunkt -> Spiel-Koordinaten der Bühnenkamera (für Rätsel und Tests)
  const R = rooms[id || letzterRaum]; if (!R || !R.ready || !R.home) return null;
  const v = bl(bx, by, 0).project(R.home);
  return [(v.x + 1) / 2 * GW, (1 - v.y) / 2 * GH];
}
export function kisteAn(bx, by, z = 0, id) {   // Fehlersuche: welche Kisten sperren an diesem Blender-Bodenpunkt?
  const R = rooms[id || letzterRaum]; if (!R || !R.kisten) return null;
  const r = FIGUR_R;
  return R.kisten.filter(({ k, o }) => k[4] > z + STUFE && bx > k[0] - r && bx < k[1] + r && by > k[2] - r && by < k[3] + r && (!o || sichtbar(o))).map(({ k, o }) => (o ? o.name : '+') + ' ' + k.map(v => v.toFixed(2)).join(' '));
}
