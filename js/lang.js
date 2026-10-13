'use strict';
// ============================================================
//  Tentakel-Toast – Sprachen
//  Deutsch ist die Originalfassung. Für Englisch, Französisch, Spanisch, Japanisch, Chinesisch
//  und Koreanisch übersetzt der eingebaute Übersetzer des Browsers (Chrome ab Version 138 am PC)
//  alle Texte direkt auf dem Gerät; die Sprachausgabe liest sie mit einer Stimme der Zielsprache vor.
//  Browser ohne eingebauten Übersetzer (Edge, Firefox, Safari) übersetzen online nach – dieselbe Zeile wird
//  nur einmal geholt und genauso gespeichert; ohne Internet bleibt es beim Deutschen.
//  Übersetzungen werden pro Sprache im Browser gespeichert, damit sie beim nächsten Mal sofort da sind.
// ============================================================

const LANGS = [
  { id: 'de', label: 'Deutsch' }, { id: 'en', label: 'English' }, { id: 'fr', label: 'Français' }, { id: 'es', label: 'Español' },
  { id: 'ja', label: '日本語' }, { id: 'zh', label: '中文' }, { id: 'ko', label: '한국어' },
];
// Kurze Bedienwörter ohne Zusammenhang übersetzt die Maschine oft falsch („Weiter“ → „Further“, „Rede mit“ → „Talk to me“) –
// die Verben und Menüwörter stehen deshalb fest drin, wie in den alten SCUMM-Übersetzungen
const GLOSSAR = (() => {
  const de = ['Gib', 'Nimm', 'Benutze', 'Öffne', 'Schau an', 'Drücke', 'Schließe', 'Rede mit', 'Ziehe', 'Gehe zu', 'Streicheln', 'Weiter', 'Weiterspielen', 'Zurück', 'Nochmal', 'Gegenwart', 'Zukunft', 'Jahr 1776', 'Extras', 'Notizbuch'];
  const zu = {
    en: ['Give', 'Pick up', 'Use', 'Open', 'Look at', 'Push', 'Close', 'Talk to', 'Pull', 'Walk to', 'Pet', 'Continue', 'Continue', 'Back', 'Again', 'Present', 'Future', 'Year 1776', 'Extras', 'Notebook'],
    fr: ['Donner', 'Prendre', 'Utiliser', 'Ouvrir', 'Regarder', 'Pousser', 'Fermer', 'Parler à', 'Tirer', 'Aller vers', 'Caresser', 'Continuer', 'Continuer', 'Retour', 'Encore', 'Présent', 'Futur', 'An 1776', 'Bonus', 'Carnet'],
    es: ['Dar', 'Coger', 'Usar', 'Abrir', 'Mirar', 'Empujar', 'Cerrar', 'Hablar con', 'Tirar de', 'Ir a', 'Acariciar', 'Continuar', 'Continuar', 'Atrás', 'Otra vez', 'Presente', 'Futuro', 'Año 1776', 'Extras', 'Cuaderno'],
    ja: ['渡す', '取る', '使う', '開ける', '見る', '押す', '閉める', '話す', '引く', '歩く', 'なでる', '続ける', '続きから', '戻る', 'もう一度', '現在', '未来', '1776年', 'おまけ', 'ノート'],
    zh: ['给', '拿', '使用', '打开', '查看', '推', '关闭', '交谈', '拉', '走到', '抚摸', '继续', '继续游戏', '返回', '再来一次', '现在', '未来', '1776年', '额外内容', '笔记本'],
    ko: ['주기', '줍기', '사용', '열기', '보기', '밀기', '닫기', '말하기', '당기기', '걷기', '쓰다듬기', '계속', '이어하기', '뒤로', '다시', '현재', '미래', '1776년', '부가 기능', '노트'],
  };
  const o = {}; for (const id in zu) o[id] = new Map(de.map((w, i) => [w, zu[id][i]]));
  return o;
})();
const VERBINDER = { en: { mit: 'with', an: 'to' }, fr: { mit: 'avec', an: 'à' }, es: { mit: 'con', an: 'a' }, ja: { mit: '＋', an: '→' }, zh: { mit: '＋', an: '→' }, ko: { mit: '＋', an: '→' } };
const Lang = (() => {
  let cur = 'de', tr = null, state = 'off', progress = 0, busy = 0, saveT = 0, tagBg = false, bgCb = null;
  const bgWait = new Set();   // Schilder in Raum-Hintergründen: nach ihrer Übersetzung den Hintergrund neu malen
  const cache = new Map(), outs = new Set(), waiting = new Map(), queue = [];
  const KEY = 'tentakel-toast-lang-';
  const supported = () => typeof self !== 'undefined' && !!self.Translator;
  // ein Null-Breiten-Leerzeichen am Anfang markiert Texte, die nie übersetzt werden (z. B. die Sprachwahl selbst)
  const wanted = s => typeof s === 'string' && s.length > 1 && s.charCodeAt(0) !== 0x200b && /[a-zäöüß]/.test(s) && /[A-Za-zÄÖÜäöüß]{3}/.test(s);
  function load(id) {
    cache.clear(); outs.clear();
    for (const [k, v] of GLOSSAR[id] || []) { cache.set(k, v); outs.add(v); }
    try { const o = JSON.parse(localStorage.getItem(KEY + id) || '{}'); for (const k in o) if (!cache.has(k)) { cache.set(k, o[k]); outs.add(o[k]); } } catch (e) { /* leer */ }
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
  // Fallback für Browser ohne eingebauten Übersetzer (Edge, Firefox, Safari): übersetzt online, Zeile für Zeile,
  // und legt alles wie die native Übersetzung im Browser ab – offline oder bei Störung bleibt einfach Deutsch.
  function webTranslator() {
    return {
      async translate(s) {
        const r = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=de&tl=' + cur + '&dt=t&q=' + encodeURIComponent(s));
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = await r.json();
        return (d && d[0] || []).map(seg => seg && seg[0] || '').join('') || s;
      }
    };
  }
  // muss beim ersten Mal aus einem Klick heraus aufgerufen werden: das Sprachpaket wird erst dann geladen
  async function set(id) {
    if (id === cur && (id === 'de' || tr)) return true;
    cur = id; tr = null; queue.length = 0; waiting.clear(); bgWait.clear(); load(id);
    if (id === 'de') { state = 'off'; return true; }
    state = 'loading'; progress = 0;
    if (supported()) {   // eingebauter Übersetzer: offline auf dem Gerät, in Chrome ab 138
      // Das Sprachpaket kann Minuten zum Herunterladen brauchen – so lange übersetzt der Online-Weg, danach
      // übernimmt der eingebaute Übersetzer (ohne Internet bleibt es bis dahin beim Deutschen)
      let nativFertig = false;
      const nativ = Translator.create({ sourceLanguage: 'de', targetLanguage: id, monitor(m) { m.addEventListener('downloadprogress', e => { progress = e.loaded || 0; }); } })
        .then(t => { nativFertig = true; if (cur !== id) return false; tr = t; state = 'ready'; pump(); return true; },
          e => { nativFertig = true; if (cur === id && !tr && /not.?allowed|activation|gesture/i.test(String(e && e.message))) state = 'tap'; return false; });   // Sprachpaket braucht einen Klick
      const web = webTranslator();
      const netz = web.translate('Ja').then(() => { if (cur !== id) return false; if (!tr && !nativFertig) { tr = web; state = 'ready'; pump(); } return true; }, () => false);
      const ok = await new Promise(res => { let n = 0; const eins = v => { if (v) res(true); else if (++n === 2) res(false); }; nativ.then(eins); netz.then(eins); });
      if (cur !== id) return false;
      if (ok || tr) return true;
      if (state === 'tap') return false;
      state = 'error'; return false;
    }
    // Online-Fallback (Edge, Firefox, Safari – oder wenn der eingebaute Übersetzer versagt):
    // eine Zeile als Probe übersetzen; ohne Internet bleibt es beim Deutschen
    const w = webTranslator();
    try { await w.translate('Ja'); } catch (e) { if (cur === id) state = 'error'; return false; }
    if (cur !== id) return false;
    tr = w; state = 'ready'; pump(); return true;
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
    wort: w => (VERBINDER[cur] || {})[w] || w,
    get charWrap() { return cur === 'ja' || cur === 'zh'; },
  };
})();
function T(s) { return Lang.t(s); }
