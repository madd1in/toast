'use strict';
// ============================================================
//  Tentakel-Toast – Sprachen
//  Deutsch ist die Originalfassung. Für Englisch, Französisch, Spanisch, Japanisch, Chinesisch
//  und Koreanisch übersetzt der eingebaute Übersetzer des Browsers (Chrome ab Version 138 am PC)
//  alle Texte direkt auf dem Gerät; die Sprachausgabe liest sie mit einer Stimme der Zielsprache vor.
//  Übersetzungen werden pro Sprache im Browser gespeichert, damit sie beim nächsten Mal sofort da sind.
// ============================================================

const LANGS = [
  { id: 'de', label: 'Deutsch' }, { id: 'en', label: 'English' }, { id: 'fr', label: 'Français' }, { id: 'es', label: 'Español' },
  { id: 'ja', label: '日本語' }, { id: 'zh', label: '中文' }, { id: 'ko', label: '한국어' },
];
const Lang = (() => {
  let cur = 'de', tr = null, state = 'off', progress = 0, busy = 0, saveT = 0, tagBg = false, bgCb = null;
  const bgWait = new Set();   // Schilder in Raum-Hintergründen: nach ihrer Übersetzung den Hintergrund neu malen
  const cache = new Map(), outs = new Set(), waiting = new Map(), queue = [];
  const KEY = 'tentakel-toast-lang-';
  const supported = () => typeof self !== 'undefined' && 'Translator' in self;
  // ein Null-Breiten-Leerzeichen am Anfang markiert Texte, die nie übersetzt werden (z. B. die Sprachwahl selbst)
  const wanted = s => typeof s === 'string' && s.length > 1 && s.charCodeAt(0) !== 0x200b && /[a-zäöüß]/.test(s) && /[A-Za-zÄÖÜäöüß]{3}/.test(s);
  function load(id) {
    cache.clear(); outs.clear();
    try { const o = JSON.parse(localStorage.getItem(KEY + id) || '{}'); for (const k in o) { cache.set(k, o[k]); outs.add(o[k]); } } catch (e) { /* leer */ }
  }
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { const o = {}; let n = 0; for (const [k, v] of cache) { if (++n > 4000) break; o[k] = v; } localStorage.setItem(KEY + cur, JSON.stringify(o)); } catch (e) { /* Speicher voll */ } }, 1500);
  }
  function done(s, out) {
    cache.set(s, out); outs.add(out); persist();
    const w = waiting.get(s); if (w) { waiting.delete(s); w.forEach(r => r(out)); }
    if (bgWait.delete(s) && !bgWait.size && bgCb) setTimeout(bgCb, 60);
  }
  function pump() {
    while (tr && busy < 3 && queue.length) {
      const s = queue.shift(), lang = cur, t = tr; busy++;
      t.translate(s).then(out => { if (lang === cur) done(s, out || s); }, () => { if (lang === cur) done(s, s); })
        .finally(() => { busy--; pump(); });
    }
  }
  // was gerade auf dem Bildschirm gebraucht wird, zieht an der Hintergrund-Vorübersetzung vorbei
  function request(s, urgent) {
    if (tagBg) bgWait.add(s);
    if (!waiting.has(s)) { waiting.set(s, []); if (urgent) queue.unshift(s); else queue.push(s); pump(); }
    else if (urgent) { const i = queue.indexOf(s); if (i > 0) { queue.splice(i, 1); queue.unshift(s); } }
  }
  // muss beim ersten Mal aus einem Klick heraus aufgerufen werden: das Sprachpaket wird erst dann geladen
  async function set(id) {
    if (id === cur && (id === 'de' || tr)) return true;
    cur = id; tr = null; queue.length = 0; waiting.clear(); bgWait.clear(); load(id);
    if (id === 'de') { state = 'off'; return true; }
    if (!supported()) { state = 'unsupported'; return false; }
    state = 'loading'; progress = 0;
    try {
      const t = await Translator.create({ sourceLanguage: 'de', targetLanguage: id, monitor(m) { m.addEventListener('downloadprogress', e => { progress = e.loaded || 0; }); } });
      if (cur !== id) return false;
      tr = t; state = 'ready'; pump(); return true;
    } catch (e) { if (cur === id) state = /not.?allowed|activation|gesture/i.test(String(e && e.message)) ? 'tap' : 'error'; return false; }
  }
  // sofort: Übersetzung aus dem Speicher – sonst das Original, und die Übersetzung wird im Hintergrund geholt
  function t(s) {
    if (cur === 'de' || !s) return s;
    const hit = cache.get(s); if (hit !== undefined) return hit;
    if (outs.has(s) || !wanted(s)) return s;
    if (tr) request(s, true);
    return s;
  }
  // mit Warten (z. B. vor einer Sprechblase), höchstens `ms` Millisekunden
  function tAsync(s, ms = 1800) {
    if (cur === 'de' || !s || !tr) return Promise.resolve(t(s));
    const hit = cache.get(s); if (hit !== undefined) return Promise.resolve(hit);
    if (outs.has(s) || !wanted(s)) return Promise.resolve(s);
    request(s, true);
    return new Promise(res => { let fin = false; const go = v => { if (!fin) { fin = true; res(v); } }; waiting.get(s).push(go); setTimeout(() => go(cache.get(s) || s), ms); });
  }
  function prewarm(list) { for (const s of list) if (s && wanted(s) && !cache.has(s) && !outs.has(s)) request(s); }
  return {
    set, t, tAsync, prewarm, supported, bgTag(on) { tagBg = !!on; }, onBg(fn) { bgCb = fn; },
    has: s => cur === 'de' || cache.has(s) || outs.has(s),
    get cur() { return cur; }, get active() { return cur !== 'de' && !!tr; }, get state() { return state; }, get progress() { return progress; },
    get charWrap() { return cur === 'ja' || cur === 'zh'; },
  };
})();
function T(s) { return Lang.t(s); }
