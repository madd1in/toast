'use strict';
// ============================================================
//  Tentakel-Toast – Sound: WebAudio-Synth für Musik, Effekte,
//  Umgebungsgeräusche, Schritte und Plapperstimmen;
//  Browser-Sprachausgabe (Web Speech API) für die Dialoge.
// ============================================================

const Sound = (() => {
  let ac = null, master = null, musicBus = null, sfxBus = null, ambBus = null, noiseBuf = null;
  let verbIn = null, verbSend = null, musicSend = null, verbWanted = [0.6, 0.18], muffleF = null, muffled = false, intensity = 0;
  const verbCache = {};
  let musicOn = true, ducked = false, retro = false, fadeNext = false, songT0 = 0;
  let cur = null, wanted = null, loopEnd = 0, loops = [];
  let ambList = [], ambWanted = [], ambCount = 0, offline = false;
  const pending = [];
  // Handys und Tablets: sparsamer Klang (weniger Oszillatoren pro Ton, kein Vibrato-LFO, kürzerer Hall)
  const MOBILE = (() => { try { return matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent); } catch (e) { return false; } })();
  let lite = MOBILE;
  // Musik wird nicht mehr als ganzer Loop auf einmal angelegt, sondern kurz vor dem Erklingen (Lookahead):
  // so warten nie Hunderte Klangknoten gleichzeitig, und der Hauptthread bekommt keine Lastspitzen
  let noteQ = [];
  const AHEAD = 1.5;
  function queueNote(t, i, n, d, out, tr = 0, layer = false) { noteQ.push({ t, i, n, d, out, tr, layer }); }
  function flushNotes(ahead = AHEAD) {
    if (!ac || !noteQ.length) return;
    const now = ac.currentTime; let k = 0;
    while (k < noteQ.length && noteQ[k].t < now + ahead) {
      const e = noteQ[k++];
      if (e.t > now - 0.04) inst(e.i, e.n, Math.max(e.t, now + 0.004), e.d, e.out, e.tr);
    }
    if (k) noteQ.splice(0, k);
  }
  // Aufräumen nach Ablauf von Audio-Zeit (offline läuft die Audio-Zeit nicht in Echtzeit)
  function later(fn, sec) { if (offline) pending.push({ at: ac.currentTime + sec, fn }); else setTimeout(fn, sec * 1000); }

  function init(useCtx) {
    if (ac) { if (!offline && ac.state !== 'running' && !document.hidden) ac.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC && !useCtx) return;
    if (useCtx) ac = useCtx;
    else { try { ac = new AC(MOBILE ? { latencyHint: 'balanced' } : undefined); } catch (e) { ac = new AC(); } }
    offline = !!useCtx;
    // Tiefpass hinter dem Master: dämpft alles, solange das Pausenmenü offen ist
    muffleF = ac.createBiquadFilter(); muffleF.type = 'lowpass'; muffleF.frequency.value = muffled ? 650 : 20000; muffleF.Q.value = 0.7; muffleF.connect(ac.destination);
    // Kompressor hält die Mischung zusammen und macht sie lauter, ohne dass Spitzen übersteuern
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 10; comp.ratio.value = 3.2; comp.attack.value = 0.008; comp.release.value = 0.22;
    const makeup = ac.createGain(); makeup.gain.value = 2.0; comp.connect(makeup); makeup.connect(muffleF);
    master = ac.createGain(); master.gain.value = 0.8; master.connect(comp);
    musicBus = ac.createGain(); musicBus.gain.value = musicOn ? 0.2 : 0; musicBus.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    ambBus = ac.createGain(); ambBus.gain.value = 0.5; ambBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    loadSamples();
    // Raumhall: Effekte und Umgebung bekommen einen Hall-Anteil, die Musik nur einen Hauch
    verbIn = ac.createGain();   // Sammelpunkt für den Hall; die Faltungs-Knoten je Raumgröße hängen dahinter
    verbSend = ac.createGain(); verbSend.gain.value = verbWanted[1]; verbSend.connect(verbIn);
    musicSend = ac.createGain(); musicSend.gain.value = retro ? 0 : 0.06; musicSend.connect(verbIn);
    sfxBus.connect(verbSend); ambBus.connect(verbSend); musicBus.connect(musicSend);
    setReverb(verbWanted[0], verbWanted[1]);
    if (!offline) {
      setInterval(tick, 100);
      // im Hintergrund (App gewechselt, Bildschirm aus) anhalten statt weiterzuspielen und zu stottern
      document.addEventListener('visibilitychange', () => { if (document.hidden) ac.suspend().catch(() => {}); else ac.resume().catch(() => {}); });
    }
    if (wanted) { const w = wanted; wanted = null; play(w); }
    ambience(ambWanted);
  }

  function midi(n) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
    if (!m) return 60;
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 12 * (+m[3] + 1) + base;
  }
  const freq = n => 440 * Math.pow(2, (midi(n) - 69) / 12);

  function osc(type, f, t, dur, vol, bus, o = {}) {
    const { attack = 0.01, release = 0.08, lp = null, lp2 = null, lpT = null, q = 1, f2 = null, detune = 0, decay = false, vib = 0 } = o;
    const s = ac.createOscillator(); s.type = type; s.frequency.setValueAtTime(f, t);
    if (f2) s.frequency.exponentialRampToValueAtTime(f2, t + dur);
    if (detune) s.detune.value = detune;
    if (vib && !lite) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.5; lg.gain.value = vib; l.connect(lg); lg.connect(s.frequency); l.start(t); l.stop(t + dur + 0.05); }
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack);
    if (decay) g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    else { g.gain.setValueAtTime(vol, Math.max(t + attack, t + dur - release)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    let n = s;
    if (lp) {
      const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(lp, t); fl.Q.value = q;
      if (lp2) fl.frequency.exponentialRampToValueAtTime(lp2, t + (lpT || dur));
      s.connect(fl); n = fl;
    }
    n.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.05);
  }
  // FM-Klang: Modulator steuert die Frequenz des Trägers (E-Piano, Glocken)
  function fm(f, t, dur, vol, bus, ratio = 1, index = 1.2) {
    const car = ac.createOscillator(), mod = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain();
    car.frequency.value = f; mod.frequency.value = f * ratio;
    mg.gain.setValueAtTime(f * index, t); mg.gain.exponentialRampToValueAtTime(Math.max(1, f * 0.04), t + Math.min(dur, 0.9));
    mod.connect(mg); mg.connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(g); g.connect(bus); car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
  }
  // E-Gitarre: zwei leicht verstimmte Sägezähne durch eine Verzerrung (tanh-Kennlinie) und einen Tiefpass
  let distCurve = null;
  function guitar(f, t, dur, vol, bus, mute) {
    if (!distCurve) { distCurve = new Float32Array(1024); for (let i = 0; i < 1024; i++) distCurve[i] = Math.tanh((i / 512 - 1) * 5); }
    const pre = ac.createGain(), sh = ac.createWaveShaper(), fl = ac.createBiquadFilter(), g = ac.createGain();
    pre.gain.value = 2.2; sh.curve = distCurve; fl.type = 'lowpass'; fl.frequency.value = mute ? 1400 : 3200; fl.Q.value = 1.2;
    for (const dt of lite ? [0] : [-6, 6]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt; o.connect(pre); o.start(t); o.stop(t + dur + 0.08); }
    pre.connect(sh); sh.connect(fl); fl.connect(g); g.connect(bus);
    const d = mute ? Math.min(dur, 0.16) : dur;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.setValueAtTime(vol * 0.7, t + Math.max(0.01, d * 0.6)); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.06);
  }
  function nz(t, dur, vol, bus, o = {}) {
    const { type = 'lowpass', f = 1000, f2 = null, q = 1, attack = 0.005 } = o;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    fl.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  // ---------- Instrumente ----------
  function inst(name, n, t, d, bus, tr = 0) {
    // Schlagzeug: K Kick, S Snare, H Hi-Hat, O offene Hi-Hat, C Klatschen, T Tom/Bodhrán, R Rimshot
    if (n === 'K') { nz(t, 0.012, 0.16, bus, { type: 'highpass', f: 3000 }); return osc('sine', 165, t, 0.24, 0.55, bus, { f2: 42, decay: true }); }
    if (n === 'S') { nz(t, 0.16, 0.2, bus, { type: 'bandpass', f: 1800, q: 0.8 }); nz(t, 0.08, 0.1, bus, { type: 'highpass', f: 5200 }); osc('triangle', 330, t, 0.06, 0.05, bus, { decay: true }); return osc('triangle', 185, t, 0.09, 0.12, bus, { decay: true }); }
    if (n === 'H') { nz(t, 0.045, 0.075, bus, { type: 'highpass', f: 8000 }); return nz(t, 0.03, 0.035, bus, { type: 'bandpass', f: 11000, q: 1.5 }); }
    if (n === 'O') return nz(t, 0.3, 0.06, bus, { type: 'highpass', f: 7000 });
    if (n === 'C') { [0, 0.011, 0.023].forEach(d => nz(t + d, 0.03, 0.14, bus, { type: 'bandpass', f: 1500, q: 1 })); return nz(t + 0.03, 0.16, 0.08, bus, { type: 'bandpass', f: 1300, q: 0.9 }); }
    if (n === 'T') { nz(t, 0.05, 0.18, bus, { type: 'lowpass', f: 420 }); return osc('sine', 125, t, 0.28, 0.34, bus, { f2: 68, decay: true }); }
    if (n === 'X') { nz(t, 1.7, 0.06, bus, { type: 'highpass', f: 5200 }); return nz(t, 0.7, 0.045, bus, { type: 'bandpass', f: 8800, q: 0.7 }); }   // Becken
    if (n === 'U') { nz(t, 0.04, 0.12, bus, { type: 'lowpass', f: 900 }); return osc('sine', 230, t, 0.22, 0.3, bus, { f2: 130, decay: true }); }   // hohes Tom
    if (n === 'M') { nz(t, 0.04, 0.12, bus, { type: 'lowpass', f: 700 }); return osc('sine', 170, t, 0.26, 0.32, bus, { f2: 92, decay: true }); }   // mittleres Tom
    if (n === 'R') { nz(t, 0.02, 0.1, bus, { type: 'bandpass', f: 2600, q: 2 }); return osc('square', 1700, t, 0.02, 0.05, bus, { decay: true }); }
    // Samba-Batterie: Surdo offen/gedämpft, Tamborim, Ganzá, Agogô hoch/tief, Cuíca rauf/runter, Pfeife (Apito)
    if (n === 'Su') { nz(t, 0.03, 0.1, bus, { type: 'lowpass', f: 300 }); return osc('sine', 74, t, 0.55, 0.5, bus, { f2: 50, decay: true }); }
    if (n === 'Sm') { nz(t, 0.02, 0.06, bus, { type: 'lowpass', f: 400 }); return osc('sine', 84, t, 0.14, 0.26, bus, { f2: 62, decay: true }); }
    if (n === 'Tb') { nz(t, 0.03, 0.07, bus, { type: 'bandpass', f: 3400, q: 3 }); return osc('triangle', 840, t, 0.05, 0.08, bus, { decay: true }); }
    if (n === 'Sh') return nz(t, 0.06, 0.045, bus, { type: 'bandpass', f: 6800, q: 1.1, attack: 0.012 });
    if (n === 'Ah' || n === 'Al') { const f = n === 'Ah' ? 1245 : 932; osc('sine', f, t, 0.3, 0.06, bus, { decay: true }); return osc('sine', f * 2.43, t, 0.12, 0.018, bus, { decay: true }); }
    if (n === 'Cu') return osc('sine', 430, t, 0.17, 0.07, bus, { f2: 780, attack: 0.02 });
    if (n === 'Cd') return osc('sine', 720, t, 0.2, 0.06, bus, { f2: 360, attack: 0.02 });
    if (n === 'Wh') {
      const s = ac.createOscillator(), l = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain(), e = Math.min(d, 0.9);
      s.frequency.value = 2650; l.frequency.value = 27; lg.gain.value = 170; l.connect(lg); lg.connect(s.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.035, t + 0.015); g.gain.setValueAtTime(0.035, t + e * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + e);
      s.connect(g); g.connect(bus); s.start(t); l.start(t); s.stop(t + e + 0.05); l.stop(t + e + 0.05); return;
    }
    for (const part of n.split('+')) {
      const f = freq(part) * (tr ? Math.pow(2, tr / 12) : 1);
      if (retro) {
        // "Demastered": klingt wie eine alte FM-/PC-Soundkarte – nur Rechteck und Dreieck, keine Filter
        if (name === 'pad' || name === 'organ') osc('triangle', f, t, d * 0.92, 0.03, bus, { attack: 0.005, release: 0.02 });
        else if (name === 'tuba' || name === 'synbass' || name === 'pizz') osc('triangle', f, t, Math.min(d * 0.8, 0.45), 0.17, bus, { decay: true, attack: 0.003 });
        else osc('square', f, t, Math.min(d * 0.85, 0.55), 0.04, bus, { attack: 0.003, release: 0.02, decay: name === 'harp' || name === 'bell' || name === 'arp' });
        continue;
      }
      if (lite && LITE_INST[name]) { LITE_INST[name](f, t, d, bus); continue; }
      switch (name) {
        case 'harp': osc('sawtooth', f, t, 0.5, 0.08, bus, { lp: 2800, decay: true, attack: 0.003 }); osc('square', f * 2, t, 0.25, 0.02, bus, { lp: 3500, decay: true, attack: 0.003 }); break;
        case 'bassoon': osc('square', f, t, d * 0.85, 0.06, bus, { lp: 1000, q: 2, attack: 0.02, release: 0.06 }); break;
        case 'pizz': osc('triangle', f, t, 0.3, 0.22, bus, { decay: true, attack: 0.004 }); break;
        case 'tuba': osc('sawtooth', f, t, d * 0.7, 0.12, bus, { lp: 420, attack: 0.02 }); break;
        case 'arp': osc('sawtooth', f, t, 0.2, 0.045, bus, { lp: 2000, decay: true }); osc('sawtooth', f, t, 0.2, 0.03, bus, { lp: 2000, decay: true, detune: 9 }); break;
        case 'synbass': osc('square', f, t, d * 0.9, 0.08, bus, { lp: 600, attack: 0.01 }); break;
        case 'bell': osc('sine', f, t, 0.9, 0.08, bus, { decay: true }); osc('sine', f * 2.01, t, 0.5, 0.025, bus, { decay: true }); break;
        case 'clar': osc('square', f, t, d * 0.9, 0.04, bus, { lp: 1500, attack: 0.03, release: 0.08, vib: 3 }); osc('triangle', f, t, d * 0.9, 0.05, bus, { attack: 0.03 }); break;
        case 'pad': osc('sawtooth', f, t, d, 0.022, bus, { lp: 900, attack: 0.25, release: 0.3, detune: -7 }); osc('sawtooth', f, t, d, 0.022, bus, { lp: 900, attack: 0.25, release: 0.3, detune: 7 }); break;
        case 'strings': for (const dt of [-9, 0, 9]) osc('sawtooth', f, t, d, 0.016, bus, { lp: 2400, attack: 0.18, release: 0.25, detune: dt, vib: 2.5 }); break;
        case 'brass': osc('sawtooth', f, t, d * 0.9, 0.045, bus, { lp: 480, lp2: 2600, lpT: 0.09, attack: 0.03, release: 0.08 }); osc('sawtooth', f, t, d * 0.9, 0.025, bus, { lp: 480, lp2: 2200, lpT: 0.1, attack: 0.04, detune: 7 }); break;
        case 'epiano': fm(f, t, Math.max(d, 0.5) * 1.3, 0.055, bus, 1, 1.6); fm(f, t, 0.35, 0.012, bus, 14, 0.4); break;
        case 'pluck': osc('triangle', f, t, 0.6, 0.11, bus, { decay: true, attack: 0.002 }); osc('sawtooth', f, t, 0.35, 0.035, bus, { lp: 3400, lp2: 600, lpT: 0.3, decay: true, attack: 0.002 }); break;
        case 'fiddle': osc('sawtooth', f, t, d * 0.95, 0.04, bus, { lp: 2800, attack: 0.04, release: 0.06, vib: 5 }); osc('sawtooth', f, t, d * 0.95, 0.018, bus, { lp: 2000, attack: 0.05, detune: 6, vib: 4 }); break;
        case 'guitar': guitar(f, t, d * 0.92, 0.07, bus); break;
        case 'chug': guitar(f, t, d, 0.06, bus, true); break;
        // Theremin: weicher Sinus mit langsamem Einschwingen und breitem Vibrato, dazu eine leise Oktave
        case 'theremin': osc('sine', f, t, d * 0.97, 0.07, bus, { attack: 0.09, release: 0.18, vib: f * 0.014 }); osc('triangle', f * 2, t, d * 0.97, 0.01, bus, { attack: 0.12, release: 0.18, vib: f * 0.028 }); break;
        case 'organ': osc('triangle', f, t, d * 0.95, 0.035, bus, { attack: 0.06, release: 0.15 }); osc('sine', f * 2, t, d * 0.95, 0.015, bus, { attack: 0.06, release: 0.15 }); break;
        default: osc('triangle', f, t, d, 0.08, bus);
      }
    }
  }

  // sparsame Fassungen der aufwendigen Instrumente: ein Oszillator statt zwei oder drei
  const LITE_INST = {
    harp: (f, t, d, bus) => osc('sawtooth', f, t, 0.5, 0.09, bus, { lp: 2800, decay: true, attack: 0.003 }),
    arp: (f, t, d, bus) => osc('sawtooth', f, t, 0.2, 0.06, bus, { lp: 2000, decay: true }),
    bell: (f, t, d, bus) => osc('sine', f, t, 0.9, 0.09, bus, { decay: true }),
    clar: (f, t, d, bus) => osc('square', f, t, d * 0.9, 0.055, bus, { lp: 1500, attack: 0.03, release: 0.08 }),
    pad: (f, t, d, bus) => osc('sawtooth', f, t, d, 0.034, bus, { lp: 900, attack: 0.25, release: 0.3 }),
    strings: (f, t, d, bus) => osc('sawtooth', f, t, d, 0.034, bus, { lp: 2400, attack: 0.18, release: 0.25 }),
    brass: (f, t, d, bus) => osc('sawtooth', f, t, d * 0.9, 0.06, bus, { lp: 480, lp2: 2600, lpT: 0.09, attack: 0.03, release: 0.08 }),
    epiano: (f, t, d, bus) => fm(f, t, Math.max(d, 0.5) * 1.3, 0.06, bus, 1, 1.6),
    pluck: (f, t, d, bus) => osc('triangle', f, t, 0.6, 0.12, bus, { decay: true, attack: 0.002 }),
    fiddle: (f, t, d, bus) => osc('sawtooth', f, t, d * 0.95, 0.05, bus, { lp: 2800, attack: 0.04, release: 0.06 }),
    organ: (f, t, d, bus) => osc('triangle', f, t, d * 0.95, 0.045, bus, { attack: 0.06, release: 0.15 }),
  };
  // ---------- Musikstücke (eigene Kompositionen, je 8 Takte als Loop) ----------
  const x2 = s => s + ' ' + s;
  // Begleitung aus Akkordsymbolen erzeugen: 'jig' = 6/8-Zupfmuster, 'bossa' = synkopierte Bossa-Akkorde
  const TRIADS = { D: ['D3', 'F#3', 'A3'], G: ['G2', 'B2', 'D3'], A: ['A2', 'C#3', 'E3'], Bm: ['B2', 'D3', 'F#3'] };
  function CHORDS(list, style) {
    return list.split(' ').map(ch => {
      if (style === 'jig') { const [r, m, f] = TRIADS[ch]; return `${r}:0.5 ${f}:0.5 ${m}:0.5 ${r.replace(/\d/, n => +n + 1)}:0.5 ${f}:0.5 ${m}:0.5`; }
      return `${ch}:1 -:0.5 ${ch}:0.5 -:0.5 ${ch}:1 ${ch}:0.5`;
    }).join(' ');
  }
  const THEMES = {
    title: { bpm: 100, tracks: [
      { inst: 'tuba', seq: x2('E2:1 B2:1 E2:1 B2:1 E2:1 B2:1 E2:1 B2:1 C2:1 G2:1 C2:1 G2:1 B1:1 F#2:1 B1:1 F#2:1') },
      { inst: 'clar', seq: 'E4:0.5 F#4:0.5 G4:1 B4:1 -:1 A4:0.5 G4:0.5 F#4:1 E4:1 -:1 C5:1 B4:0.5 A4:0.5 G4:1 E4:1 F#4:1 D#4:1 B3:2 E4:0.5 F#4:0.5 G4:1 B4:1 E5:1 D5:0.5 C5:0.5 B4:1 A4:1 G4:1 C5:1 E5:1 D#5:1 B4:1 E5:2 -:2' },
      { inst: 'pad', seq: x2('E3+G3+B3:4 E3+G3+B3:4 C3+E3+G3:4 B2+D#3+F#3:4') },
      { inst: 'drum', seq: Array(32).fill('-:0.5 H:0.5').join(' ') },
    ] },
    past: { bpm: 132, tracks: [
      { inst: 'harp', seq: 'G4:1 B4:1 D5:1 C5:1 B4:0.5 A4:0.5 B4:1 A4:1 F#4:1 D4:1 G4:2 D5:1 E5:1 D5:1 C5:1 B4:1 A4:1 G4:1 A4:1 B4:0.5 A4:0.5 F#4:1 G4:3 B4:1 C5:1 D5:1 E5:2 D5:1 C5:1 B4:1 A4:1 B4:2 G4:1 A4:1 B4:1 C5:1 D5:1 C5:1 B4:1 A4:1 G4:1 F#4:1 G4:3' },
      { inst: 'harp', seq: 'G2:1 D3:1 B2:1 A2:1 D3:1 G2:1 D2:1 A2:1 F#2:1 G2:1 B2:1 D3:1 C3:1 E3:1 G2:1 G2:1 D3:1 B2:1 D2:1 F#2:1 A2:1 G2:1 D2:1 G2:1 G2:1 B2:1 D3:1 C3:1 E3:1 G3:1 A2:1 C3:1 E3:1 G2:1 B2:1 D3:1 F#2:1 A2:1 D3:1 G2:1 B2:1 D3:1 D2:1 F#2:1 A2:1 G2:1 D2:1 G1:1' },
      { inst: 'organ', seq: 'G3+B3+D4:3 A3+C4+D4:3 D3+F#3+A3:3 G3+B3+D4:3 C3+E3+G3:3 G3+B3+D4:3 D3+F#3+A3:3 G3+B3+D4:3 G3+B3+D4:3 C3+E3+G3:3 A2+C3+E3:3 G3+B3+D4:3 D3+F#3+A3:3 G3+B3+D4:3 D3+F#3+A3:3 G3+B3+D4:3' },
      { inst: 'clar', lvl: 1, seq: 'D5:3 C5:3 A4:3 B4:3 C5:3 B4:3 A4:3 G4:3 B4:3 C5:3 C5:3 B4:3 A4:3 B4:3 A4:3 G4:3' },
      { inst: 'drum', lvl: 2, seq: Array(16).fill('K:1 H:1 H:1').join(' ') },
    ] },
    // Zeitalter-Themen jetzt mit A- und B-Teil (16 Takte), damit der Loop nicht so schnell ermüdet
    present: { fill: true, bpm: 116, tracks: [
      { inst: 'pizz', seq: x2('D2:1 A2:1 D3:1 A2:1 D2:1 A2:1 D3:1 A2:1 Bb1:1 F2:1 Bb2:1 F2:1 A1:1 E2:1 A2:1 C#3:1') + ' ' + x2('G2:1 D3:1 G3:1 D3:1 F2:1 C3:1 F3:1 C3:1 Bb1:1 F2:1 Bb2:1 F2:1 A1:1 E2:1 A2:1 E2:1') },
      { inst: 'bassoon', seq: 'D4:0.5 -:0.5 F4:0.5 -:0.5 A4:1 G4:0.5 F4:0.5 E4:1 F4:0.5 E4:0.5 D4:2 Bb4:0.5 -:0.5 A4:0.5 -:0.5 G4:1 F4:1 E4:1 C#4:1 A3:2 D4:0.5 -:0.5 F4:0.5 -:0.5 A4:1 D5:1 C5:0.5 Bb4:0.5 A4:0.5 G4:0.5 A4:2 Bb4:1 G4:1 E4:1 C#4:1 D4:2 -:2 G4:1 Bb4:0.5 A4:0.5 G4:1 D4:1 F4:1 A4:0.5 G4:0.5 F4:2 D5:1 C5:0.5 Bb4:0.5 A4:1 F4:1 E4:2 C#4:2 G4:0.5 A4:0.5 Bb4:1 D5:1 Bb4:1 A4:0.5 G4:0.5 F4:1 A4:2 Bb4:1 A4:1 G4:1 E4:1 D4:4' },
      { inst: 'pad', seq: x2('D3+F3+A3:4 D3+F3+A3:4 Bb2+D3+F3:4 A2+C#3+E3:4') + ' ' + x2('G2+Bb2+D3:4 F2+A2+C3:4 Bb2+D3+F3:4 A2+C#3+E3:4') },
      { inst: 'drum', seq: Array(16).fill('K:1 H:1 S:1 H:1').join(' ') },
      { inst: 'bell', lvl: 1, seq: x2('A5:1 -:1 F5:1 -:1 D5:1 -:1 A4:1 -:1 F5:1 -:1 D5:1 -:1 E5:1 -:1 C#5:1 -:1') + ' ' + x2('G5:1 -:1 D5:1 -:1 F5:1 -:1 C5:1 -:1 F5:1 -:1 D5:1 -:1 E5:1 -:1 A4:1 -:1') },
      { inst: 'drum', lvl: 2, seq: Array(64).fill('-:0.5 H:0.5').join(' ') },
    ] },
    future: { fill: true, bpm: 124, tracks: [
      { inst: 'arp', seq: x2('A3:0.5 C4:0.5 E4:0.5 A4:0.5 E4:0.5 C4:0.5 A3:0.5 C4:0.5 F3:0.5 A3:0.5 C4:0.5 F4:0.5 C4:0.5 A3:0.5 F3:0.5 A3:0.5 C4:0.5 E4:0.5 G4:0.5 C5:0.5 G4:0.5 E4:0.5 C4:0.5 E4:0.5 G3:0.5 B3:0.5 D4:0.5 G4:0.5 D4:0.5 B3:0.5 G3:0.5 B3:0.5') + ' ' + x2('D4:0.5 F4:0.5 A4:0.5 D5:0.5 A4:0.5 F4:0.5 D4:0.5 F4:0.5 F3:0.5 A3:0.5 C4:0.5 F4:0.5 C4:0.5 A3:0.5 F3:0.5 A3:0.5 G3:0.5 B3:0.5 D4:0.5 G4:0.5 D4:0.5 B3:0.5 G3:0.5 B3:0.5 A3:0.5 C4:0.5 E4:0.5 A4:0.5 E4:0.5 C4:0.5 A3:0.5 C4:0.5') },
      { inst: 'synbass', seq: x2('A1:2 A2:2 F1:2 F2:2 C2:2 C3:2 G1:2 G2:2') + ' ' + x2('D2:2 D3:2 F1:2 F2:2 G1:2 G2:2 A1:2 A2:2') },
      { inst: 'bell', seq: 'E5:2 D5:1 C5:1 A4:4 G4:2 C5:1 E5:1 D5:4 E5:2 G5:1 E5:1 F5:2 E5:1 C5:1 D5:2 B4:2 A4:4 A5:2 G5:1 F5:1 D5:4 F5:2 E5:1 D5:1 B4:4 C5:1 D5:1 E5:2 F5:2 E5:1 D5:1 E5:2 G#4:2 A4:4' },
      { inst: 'pad', seq: x2('A3+C4+E4:4 F3+A3+C4:4 C4+E4+G4:4 G3+B3+D4:4') + ' ' + x2('D3+F3+A3:4 F3+A3+C4:4 G3+B3+D4:4 A3+C4+E4:4') },
      { inst: 'drum', seq: Array(16).fill('K:1 H:0.5 H:0.5 S:1 H:0.5 K:0.5').join(' ') },
      { inst: 'harp', lvl: 1, seq: x2('A4:1.5 E5:1.5 A5:1 F4:1.5 C5:1.5 F5:1 C5:1.5 G5:1.5 C6:1 G4:1.5 D5:1.5 G5:1') + ' ' + x2('D5:1.5 A5:1.5 D6:1 F4:1.5 C5:1.5 F5:1 G4:1.5 D5:1.5 G5:1 A4:1.5 E5:1.5 A5:1') },
      { inst: 'drum', lvl: 2, seq: Array(32).fill('-:0.5 H:0.25 H:0.25 -:0.5 H:0.5').join(' ') },
    ] },
    palace: { fill: true, bpm: 96, tracks: [
      { inst: 'tuba', seq: x2('C2:1 G2:1 C2:1 G2:1 Ab1:1 Eb2:1 Ab1:1 Eb2:1 F1:1 C2:1 F1:1 C2:1 G1:1 D2:1 G1:1 B1:1') },
      { inst: 'clar', seq: 'C4:1 Eb4:0.5 F4:0.5 G4:1 G4:1 Ab4:1 G4:0.5 F4:0.5 Eb4:2 F4:1 Ab4:0.5 G4:0.5 F4:1 Eb4:1 D4:1 B3:1 G3:2 C4:1 Eb4:0.5 F4:0.5 G4:1 C5:1 Bb4:0.5 Ab4:0.5 G4:1 F4:2 Eb4:1 D4:1 F4:1 B3:1 C4:2 -:2' },
      { inst: 'pad', seq: x2('C3+Eb3+G3:4 Ab2+C3+Eb3:4 F2+Ab2+C3:4 G2+B2+D3:4') },
      { inst: 'drum', seq: Array(8).fill('K:1 -:1 S:1 -:0.5 S:0.5').join(' ') },
      { inst: 'organ', lvl: 1, seq: x2('C5+G5:4 C5+Eb5:4 C5+F5:4 B4+D5:4') },
      { inst: 'drum', lvl: 2, seq: Array(16).fill('K:0.5 K:0.5 -:1').join(' ') },
    ] },
    tavern: { fill: true, bpm: 150, tracks: [
      { inst: 'fiddle', seq: 'A4:0.5 F#4:0.5 A4:0.5 D5:0.5 A4:0.5 F#4:0.5 B4:0.5 G4:0.5 B4:0.5 D5:0.5 B4:0.5 G4:0.5 A4:0.5 F#4:0.5 A4:0.5 F#5:0.5 E5:0.5 D5:0.5 E5:0.5 C#5:0.5 A4:0.5 E4:0.5 F#4:0.5 G4:0.5 A4:0.5 F#4:0.5 A4:0.5 D5:0.5 A4:0.5 F#4:0.5 B4:0.5 D5:0.5 G5:0.5 F#5:0.5 E5:0.5 D5:0.5 C#5:0.5 E5:0.5 A5:0.5 G5:0.5 E5:0.5 C#5:0.5 D5:1.5 A4:0.5 B4:0.5 C#5:0.5 ' +
        'F#5:0.5 D5:0.5 B4:0.5 F#5:0.5 D5:0.5 B4:0.5 G5:0.5 D5:0.5 B4:0.5 G5:0.5 D5:0.5 B4:0.5 F#5:0.5 E5:0.5 D5:0.5 A4:0.5 F#4:0.5 A4:0.5 E5:0.5 F#5:0.5 E5:0.5 C#5:0.5 B4:0.5 A4:0.5 B4:0.5 D5:0.5 F#5:0.5 B5:0.5 A5:0.5 F#5:0.5 G5:0.5 F#5:0.5 E5:0.5 D5:0.5 B4:0.5 G4:0.5 A4:0.5 C#5:0.5 E5:0.5 A5:0.5 G5:0.5 E5:0.5 D5:1.5 D4:1.5' },
      { inst: 'pluck', seq: CHORDS('D G D A D G A D Bm G D A Bm G A D', 'jig') },
      { inst: 'pizz', seq: 'D2:1.5 A2:1.5 G2:1.5 D2:1.5 D2:1.5 A2:1.5 A2:1.5 E2:1.5 D2:1.5 A2:1.5 G2:1.5 D2:1.5 A2:1.5 E2:1.5 D2:1.5 A2:1.5 B1:1.5 F#2:1.5 G2:1.5 D2:1.5 D2:1.5 A2:1.5 A2:1.5 E2:1.5 B1:1.5 F#2:1.5 G2:1.5 D2:1.5 A2:1.5 E2:1.5 D2:3' },
      { inst: 'drum', seq: Array(16).fill('T:1.5 T:0.5 T:0.5 T:0.5').join(' ') },
      { inst: 'clar', lvl: 1, seq: 'D5:3 D5:3 F#5:3 E5:3 D5:3 D5:3 C#5:3 D5:3 B4:3 B4:3 A4:3 C#5:3 D5:3 B4:3 C#5:3 D5:3' },
      { inst: 'drum', lvl: 2, seq: Array(16).fill('-:0.5 H:0.5 H:0.5 -:0.5 H:0.5 H:0.5').join(' ') },
    ] },
    lounge: { fill: true, bpm: 112, tracks: [
      { inst: 'epiano', seq: CHORDS('A3+C4+E4+G4 D3+F3+A3+C4 G3+B3+D4+F4 C4+E4+G4+B4 F3+A3+C4+E4 B3+D4+F4+A4 E3+G#3+B3+D4 A3+C4+E4+G4', 'bossa') },
      { inst: 'pizz', seq: 'A2:1.5 E2:0.5 A2:1.5 E2:0.5 D2:1.5 A2:0.5 D2:1.5 A2:0.5 G2:1.5 D2:0.5 G2:1.5 D2:0.5 C2:1.5 G2:0.5 C2:1.5 G2:0.5 F2:1.5 C2:0.5 F2:1.5 C2:0.5 B1:1.5 F2:0.5 B1:1.5 F2:0.5 E2:1.5 B1:0.5 E2:1.5 B1:0.5 A2:1.5 E2:0.5 A2:1.5 E2:0.5' },
      { inst: 'clar', seq: 'E5:1.5 D5:0.5 C5:1 B4:1 A4:2 C5:1 D5:1 F5:1.5 E5:0.5 D5:1 B4:1 E5:3 -:1 A5:1.5 G5:0.5 E5:1 C5:1 D5:1.5 C5:0.5 A4:1 F4:1 G#4:1 B4:1 D5:1 F5:1 E5:2 -:2' },
      { inst: 'drum', seq: Array(8).fill('K:1 H:0.5 R:0.5 H:0.5 K:0.5 R:0.5 H:0.5').join(' ') },
      { inst: 'strings', lvl: 1, seq: 'E4:4 F4:4 F4:4 E4:4 E4:4 D4:4 D4:4 C4:4' },
      { inst: 'drum', lvl: 2, seq: Array(16).fill('-:1.5 O:0.5').join(' ') },
    ] },
    ending: { fill: true, bpm: 126, tracks: [
      { inst: 'bell', seq: x2('C5:1 E5:1 G5:1 E5:1 F5:1 A5:1 G5:2 E5:1 C5:1 D5:1 B4:1 C5:4') },
      { inst: 'pizz', seq: x2('C3:1 G2:1 C3:1 G2:1 F2:1 C3:1 G2:2 C3:1 A2:1 G2:1 G2:1 C3:4') },
      { inst: 'pad', seq: x2('C4+E4+G4:4 F3+A3+C4:4 C4+E4+G4:4 G3+B3+D4:4') },
      { inst: 'drum', seq: Array(8).fill('K:1 H:1 S:1 H:1').join(' ') },
      { inst: 'brass', seq: 'G4:2 E4:2 A4:2 C5:2 G4:3 E4:1 D4:4 G4:2 E4:2 A4:2 C5:2 G4:2 E5:2 D5:4' },
      { inst: 'strings', seq: x2('C4+E4+G4:4 F3+A3+C4:4 C4+E4+G4:4 G3+B3+D4:4') },
      { inst: 'drum', seq: Array(8).fill('-:1 C:1 -:1 C:1').join(' ') },
      { inst: 'drum', seq: Array(64).fill('H:0.5').join(' ') },
    ] },
    // Dr. Freds Laborwalzer: schauriger 3/4-Takt mit Theremin, Zupfbass auf der Eins und Orgel auf zwei und drei
    lab: { bpm: 138, tracks: [
      { inst: 'theremin', seq: 'A4:2 D5:1 F5:2 E5:1 D5:1.5 C5:0.5 Bb4:1 A4:3 Bb4:2 D5:1 G5:2 F5:1 E5:1 C#5:1 E5:1 A5:3 F5:2 E5:1 C5:2 A4:1 Bb4:1 D5:1 G5:1 F5:3 D5:1 F5:1 Bb5:1 G5:2 Bb4:1 A4:1 C#5:1 E5:1 D5:3' },
      { inst: 'pizz', seq: 'D2:1 -:2 D2:1 -:2 G1:1 -:2 D2:1 -:2 Bb1:1 -:2 G1:1 -:2 A1:1 -:2 A1:1 -:2 D2:1 -:2 F1:1 -:2 G1:1 -:2 D2:1 -:2 Bb1:1 -:2 G1:1 -:2 A1:1 -:2 D2:1 -:2' },
      { inst: 'organ', seq: ['D3+F3+A3', 'D3+F3+A3', 'G2+Bb2+D3', 'D3+F3+A3', 'Bb2+D3+F3', 'G2+Bb2+D3', 'A2+C#3+E3', 'A2+C#3+E3', 'D3+F3+A3', 'F2+A2+C3', 'G2+Bb2+D3', 'D3+F3+A3', 'Bb2+D3+F3', 'G2+Bb2+D3', 'A2+C#3+E3', 'D3+F3+A3'].map(c => `-:1 ${c}:1 ${c}:1`).join(' ') },
      { inst: 'bell', lvl: 1, seq: 'A5:3 F5:3 G5:3 A5:3 F5:3 G5:3 E5:3 C#6:3 A5:3 A5:3 Bb5:3 F5:3 F5:3 D6:3 E5:3 D6:3' },
      { inst: 'drum', lvl: 2, seq: Array(16).fill('K:1 H:1 H:1').join(' ') },
    ] },
    // Wachparade: komischer Marsch für den Palast-Vorraum
    march: { fill: true, bpm: 112, tracks: [
      { inst: 'tuba', seq: x2('Bb1:1 F2:1 Bb1:1 F2:1 Eb2:1 Bb1:1 Eb2:1 Bb1:1 F2:1 C2:1 F2:1 C2:1 Bb1:1 F2:1 Bb1:2') },
      { inst: 'brass', seq: 'F4:1 Bb4:0.5 C5:0.5 D5:1 Bb4:1 Eb5:1 D5:0.5 C5:0.5 Bb4:1 G4:1 A4:1 C5:0.5 Bb4:0.5 A4:1 F4:1 Bb4:2 F4:1 -:1 D5:1 C5:0.5 Bb4:0.5 F4:1 Bb4:1 G4:1 Bb4:0.5 C5:0.5 Eb5:1 G5:1 F5:1 Eb5:0.5 D5:0.5 C5:1 A4:1 Bb4:3 -:1' },
      { inst: 'drum', seq: Array(16).fill('S:0.5 S:0.25 S:0.25 S:1').join(' ') },
      { inst: 'drum', seq: Array(8).fill('K:2 K:2').join(' ') },
      { inst: 'clar', lvl: 1, seq: x2('D5:4 Eb5:4 C5:4 D5:4') },
      { inst: 'drum', lvl: 2, seq: Array(32).fill('-:0.5 H:0.5').join(' ') },
    ] },
    // Hafen-Samba: eigene Komposition im Karnevals-Stil (D-Dur, A- und B-Teil) – Bläser-Melodie, Cavaquinho-Zupfakkorde
    // im Partido-alto-Muster, Samba-Bass (Grundton punktiert, Quinte auf zwei) und die ganze Bateria
    samba: { fill: true, bpm: 104, tracks: [
      { inst: 'brass', seq: 'A4:0.5 B4:0.25 D5:0.75 F#5:0.5 E5:0.5 D5:0.5 B4:0.5 A4:0.5 -:0.5 F#4:0.25 A4:0.25 D5:0.5 E5:0.5 F#5:1 E5:0.5 D5:0.5 ' +
        'G5:0.75 F#5:0.25 E5:0.5 D5:0.5 B4:0.75 G4:0.25 B4:0.5 D5:0.5 C#5:1 E5:0.5 A5:0.5 G5:0.5 E5:0.5 C#5:0.5 A4:0.5 ' +
        'B4:0.5 E5:0.25 G5:0.75 B5:0.5 A5:0.5 G5:0.5 E5:0.5 -:0.5 A5:0.75 G5:0.25 E5:0.5 C#5:0.5 E5:0.5 G5:0.5 F#5:0.5 E5:0.5 ' +
        'D5:0.5 F#5:0.25 A5:0.75 F#5:0.5 D5:0.5 A4:0.5 B4:0.5 C#5:0.5 D5:1.5 -:0.5 A4:0.5 D5:0.5 F#5:0.5 A5:0.5 ' +
        'B5:1 A5:0.5 G5:0.5 D5:0.75 B4:0.25 D5:0.5 G5:0.5 Bb5:1 A5:0.5 G5:0.5 D5:0.75 Bb4:0.25 D5:0.5 G5:0.5 ' +
        'A5:0.75 F#5:0.25 D5:0.5 A4:0.5 F#4:0.5 A4:0.5 D5:0.5 F#5:0.5 D#5:0.75 F#5:0.25 A5:0.5 B5:0.5 A5:0.5 F#5:0.5 D#5:0.5 B4:0.5 ' +
        'E5:0.5 G5:0.25 B5:0.75 G5:0.5 E5:0.5 B4:0.5 D5:0.5 E5:0.5 C#5:0.5 E5:0.25 G5:0.75 A5:0.5 G5:0.5 E5:0.5 C#5:0.5 A4:0.5 ' +
        'D5:0.5 E5:0.25 F#5:0.75 A5:0.5 F#5:0.5 E5:0.5 D5:0.5 E5:0.5 C#5:0.5 A4:0.25 E5:0.75 -:0.5 A4:0.25 B4:0.25 C#5:0.5 E5:1' },
      { inst: 'pluck', seq: ['D4+F#4+A4', 'D4+F#4+A4', 'D4+G4+B4', 'C#4+E4+G4', 'D4+G4+B4', 'C#4+E4+G4', 'D4+F#4+A4', 'D4+F#4+A4',
        'D4+G4+B4', 'D4+G4+Bb4', 'F#4+A4+D5', 'D#4+F#4+A4', 'D4+G4+B4', 'C#4+E4+G4', 'D4+F#4+A4', 'C#4+E4+G4'].map(c => `${c}:0.75 ${c}:0.75 ${c}:0.5 ${c}:0.5 ${c}:0.75 ${c}:0.75`).join(' ') },
      { inst: 'pizz', seq: [['D2', 'A1'], ['D2', 'A1'], ['E2', 'B1'], ['A1', 'E2'], ['E2', 'B1'], ['A1', 'E2'], ['D2', 'A1'], ['D2', 'A1'],
        ['G1', 'D2'], ['G1', 'D2'], ['F#2', 'A1'], ['B1', 'F#2'], ['E2', 'B1'], ['A1', 'E2'], ['D2', 'A1'], ['A1', 'E2']].map(([r, f]) => `${r}:0.75 ${r}:0.25 ${f}:1 ${r}:0.75 ${r}:0.25 ${f}:1`).join(' ') },
      { inst: 'drum', seq: Array(16).fill('Sm:1 Su:1 Sm:1 Su:1').join(' ') },
      { inst: 'drum', pan: 0.25, seq: Array(16).fill('Tb:0.5 Tb:0.25 Tb:0.5 Tb:0.5 Tb:0.25 Tb:0.5 Tb:0.25 Tb:0.5 Tb:0.5 Tb:0.25').join(' ') },
      { inst: 'drum', pan: -0.2, seq: Array(256).fill('Sh:0.25').join(' ') },
      { inst: 'drum', lvl: 1, pan: -0.35, seq: Array(16).fill('Ah:0.5 Al:0.5 Ah:0.25 Ah:0.25 Al:0.5 -:0.5 Ah:0.5 Al:0.5 Ah:0.5').join(' ') },
      { inst: 'drum', lvl: 2, pan: 0.35, seq: Array(8).fill('-:2.5 Cu:0.5 Cd:0.5 Cu:0.5 -:4').join(' ') },
      { inst: 'drum', lvl: 2, seq: x2('-:28 Wh:0.5 -:0.5 Wh:0.5 Wh:0.5 Wh:2') },
    ] },
    // Fecht-Turnier: drei eigene Arcade-Kampfthemen im 16-Bit-Stil (eigene Melodien und Harmonien)
    // Fliegerhorst-Fight: treibender Rock in e-Moll – Powerchords, Achtelbass, Bläser-Stöße, Gitarren-Lead
    kampf_basis: { fill: true, bpm: 150, tracks: [
      { inst: 'guitar', seq: 'E4:0.5 G4:0.5 B4:1 A4:0.5 G4:0.5 E4:1 D4:0.5 G4:0.5 B4:1 D5:1 B4:1 C#5:1 A4:0.5 B4:0.5 C#5:1 E5:1 D5:1.5 C5:0.5 B4:1 A4:1 ' +
        'G4:0.5 B4:0.5 E5:1 D5:0.5 B4:0.5 G4:1 A4:0.5 B4:0.5 D5:1 G5:1 F#5:1 E5:1 C#5:0.5 E5:0.5 A5:1 G5:0.5 E5:0.5 F#5:2 D#5:1 B4:1' },
      { inst: 'synbass', seq: [['E', 'E'], ['G', 'G'], ['A', 'A'], ['C', 'D'], ['E', 'E'], ['G', 'G'], ['A', 'A'], ['B', 'B']].map(([a, b]) => `${a}2:0.5 ${a}2:0.5 ${a}3:0.5 ${a}2:0.5 ${b}2:0.5 ${b}2:0.5 ${b}3:0.5 ${b}2:0.5`).join(' ') },
      { inst: 'chug', seq: [['E3+B3', 'E3+B3'], ['G2+D3', 'G2+D3'], ['A2+E3', 'A2+E3'], ['C3+G3', 'D3+A3'], ['E3+B3', 'E3+B3'], ['G2+D3', 'G2+D3'], ['A2+E3', 'A2+E3'], ['B2+F#3', 'B2+F#3']].map(([a, b]) => `${a}:0.5 ${a}:0.5 -:0.5 ${a}:0.5 ${b}:0.5 ${b}:0.5 -:0.5 ${b}:0.5`).join(' ') },
      { inst: 'brass', seq: ['E4+G4+B4', 'D4+G4+B4', 'C#4+E4+A4', 'C4+E4+G4', 'E4+G4+B4', 'D4+G4+B4', 'C#4+E4+A4', 'D#4+F#4+B4'].map(c => `${c}:0.5 -:1 ${c}:0.5 -:2`).join(' ') },
      { inst: 'drum', seq: Array(8).fill('K:0.5 K:0.5 S:1 K:0.5 K:0.5 S:0.5 S:0.5').join(' ') },
      { inst: 'drum', seq: Array(128).fill('H:0.25').join(' ') },
    ] },
    // Dschungel-Fight: d-dorisch, Samba-Trommeln mit Pauken-Schlägen, synkopierter Bass, Bläser und Marimba-Arpeggien
    kampf_dschungel: { fill: true, bpm: 140, tracks: [
      { inst: 'brass', seq: 'D4:0.5 F4:0.5 A4:0.5 C5:0.5 A4:1 G4:1 B4:0.5 A4:0.5 G4:0.5 F4:0.5 G4:2 A4:0.5 C5:0.5 D5:1 C5:0.5 A4:0.5 F4:1 E4:1 G4:1 C5:1.5 -:0.5 ' +
        'D5:0.5 C5:0.5 A4:0.5 C5:0.5 D5:1 F5:1 F5:0.5 E5:0.5 D5:0.5 Bb4:0.5 D5:2 E5:1 C5:0.5 G4:0.5 C5:1 E5:1 C#5:1.5 E5:0.5 A5:2' },
      { inst: 'harp', seq: ['D4 F4 A4 D5', 'G4 B4 D5 G5', 'D4 F4 A4 D5', 'C4 E4 G4 C5', 'D4 F4 A4 D5', 'Bb3 D4 F4 Bb4', 'C4 E4 G4 C5', 'A3 C#4 E4 A4'].map(c => { const n = c.split(' '); return [...n, ...n.slice().reverse()].map(x => x + ':0.5').join(' '); }).join(' ') },
      { inst: 'synbass', seq: [['D', 'A'], ['G', 'D'], ['D', 'A'], ['C', 'G'], ['D', 'A'], ['Bb', 'F'], ['C', 'G'], ['A', 'E']].map(([r, f]) => `${r}2:0.75 ${r}2:0.25 ${r}3:0.5 ${r}2:0.5 ${f}2:0.75 ${r}2:0.25 ${r}3:1`).join(' ') },
      { inst: 'drum', seq: Array(8).fill('K:1 Su:1 K:0.5 Sm:0.5 Su:1').join(' ') },
      { inst: 'drum', pan: 0.25, seq: Array(8).fill('Tb:0.5 Tb:0.25 Tb:0.5 Tb:0.5 Tb:0.25 Tb:0.5 Tb:0.25 Tb:0.5 Tb:0.5 Tb:0.25').join(' ') },
      { inst: 'drum', pan: -0.2, seq: Array(128).fill('Sh:0.25').join(' ') },
      { inst: 'drum', pan: -0.35, seq: Array(8).fill('Ah:0.5 Al:0.5 -:1 Ah:0.5 Al:0.5 U:0.5 M:0.5').join(' ') },
    ] },
    // Tempel-Fight: Pentatonik mit Koto-Zupfen, Taiko-Trommeln, Glocken und Streichern – fürs Finale im Garten
    kampf_tempel: { fill: true, bpm: 132, tracks: [
      { inst: 'fiddle', seq: 'E5:1 B4:0.5 C5:0.5 B4:1 G4:1 F#4:0.5 G4:0.5 B4:1 E4:2 C5:1 B4:0.5 G4:0.5 C5:1 E5:1 F#5:1.5 E5:0.5 B4:2 ' +
        'E5:0.5 G5:0.5 F#5:0.5 E5:0.5 B4:1 C5:1 A4:1 C5:0.5 B4:0.5 A4:1 E4:1 G4:0.5 B4:0.5 C5:1 E5:1 G5:1 F#5:1 E5:0.5 B4:0.5 E5:2' },
      { inst: 'pluck', seq: ['E4 B4 E5 B4', 'E4 G4 B4 G4', 'C4 G4 C5 G4', 'B3 F#4 B4 F#4', 'E4 B4 E5 B4', 'A3 E4 A4 E4', 'C4 G4 C5 G4', 'B3 F#4 E4 B3'].map(c => c.split(' ').map(x => x + ':0.5').join(' ') + ' ' + c.split(' ').map(x => x + ':0.5').join(' ')).join(' ') },
      { inst: 'strings', seq: 'E3+B3+E4:4 E3+G3+B3:4 C3+G3+C4:4 B2+F#3+B3:4 E3+B3+E4:4 A2+E3+A3:4 C3+G3+C4:4 B2+F#3+B3:2 E3+B3+E4:2' },
      { inst: 'bell', seq: 'B5:4 -:4 E6:4 -:4 B5:4 -:4 G5:4 E6:4' },
      { inst: 'drum', seq: Array(8).fill('U:1 -:0.5 U:0.5 M:1 U:0.5 K:0.5').join(' ') },
      { inst: 'drum', seq: Array(16).fill('-:1 R:0.5 R:0.5').join(' ') },
    ] },
    // Tentakel-Rock: Begleitung fürs Minispiel – die Lead-Gitarre spielt der Spieler selbst
    rock: { bpm: 120, tracks: [
      { inst: 'drum', seq: Array(16).fill('K:1 S:1 K:0.5 K:0.5 S:1').join(' ') },
      { inst: 'drum', seq: Array(128).fill('H:0.5').join(' ') },
      { inst: 'synbass', seq: Array(4).fill('E2:0.5 E2:0.5 E3:0.5 E2:0.5 G2:0.5 G2:0.5 A2:0.5 B2:0.5 E2:0.5 E2:0.5 E3:0.5 E2:0.5 D2:0.5 D2:0.5 B1:0.5 D2:0.5 C2:0.5 C2:0.5 C3:0.5 C2:0.5 C2:0.5 G2:0.5 C3:0.5 B2:0.5 D2:0.5 D2:0.5 D3:0.5 D2:0.5 D2:0.5 A2:0.5 D3:0.5 F#2:0.5').join(' ') },
      { inst: 'chug', seq: Array(4).fill('E3+B3:0.5 E3+B3:0.5 -:0.5 E3+B3:0.5 E3+B3:0.5 -:0.5 E3+B3:1 E3+B3:0.5 E3+B3:0.5 -:0.5 E3+B3:0.5 E3+B3:0.5 -:0.5 E3+B3:1 C3+G3:0.5 C3+G3:0.5 -:0.5 C3+G3:0.5 C3+G3:0.5 -:0.5 C3+G3:1 D3+A3:0.5 D3+A3:0.5 -:0.5 D3+A3:0.5 D3+A3:0.5 -:0.5 D3+A3:1').join(' ') },
    ] },
  };
  const RIFFS = {
    A: [[0, 'E4'], [0.5, 'G4'], [1, 'A4'], [1.5, 'B4'], [2.5, 'A4'], [3, 'G4']],
    B: [[0, 'B4'], [1, 'D5'], [1.5, 'B4'], [2, 'A4'], [3, 'G4']],
    C: [[0, 'E5'], [1, 'D5'], [1.5, 'B4'], [2, 'G4'], [3, 'A4']],
    D: [[0, 'D5'], [0.5, 'E5'], [1, 'D5'], [2, 'B4'], [2.5, 'A4'], [3, 'B4']],
  };
  const ROCK_CHART = (() => {
    const out = [];
    'ABCD ABCD BACD ABC'.replace(/ /g, '').split('').forEach((r, bar) => RIFFS[r].forEach(([b, n]) => out.push({ beat: bar * 4 + b, note: n })));
    out.push({ beat: 60, note: 'E5', len: 3 });
    return out;
  })();
  function parse(seq) {
    const ev = []; let b = 0;
    for (const tok of seq.trim().split(/\s+/)) {
      const [n, d] = tok.split(':'); const len = parseFloat(d || '1');
      if (n !== '-') ev.push({ b, n, len });
      b += len;
    }
    return { ev, len: b };
  }
  const PAN = { harp: -0.35, organ: 0.3, clar: 0.22, bell: -0.25, arp: 0.32, pizz: -0.18, bassoon: 0.15, strings: -0.12, brass: 0.2, epiano: -0.22, pluck: -0.32, fiddle: 0.26 };
  let partyOn = false;
  // Jede Spielfigur färbt die Leitmelodie: Bernard spielt sie auf dem E-Piano mit, Hoagie eine Oktave tiefer
  // auf der E-Gitarre, Laverne eine Oktave höher auf Glocken – beim Figurenwechsel wechselt die Klangfarbe sofort
  const LEAD = { title: 1, past: 0, present: 1, future: 2, palace: 1, tavern: 0, lounge: 2, ending: 0, march: 1, lab: 0, samba: 0 };
  const HERO_INST = { bernard: ['epiano', 0, 0.85], hoagie: ['guitar', -12, 0.55], laverne: ['bell', 12, 0.65] };
  let hero = null, heroLayers = [], loopT0 = 0, loopN = 0;
  function scheduleHero(t0, from) {
    const th = THEMES[cur], hi = HERO_INST[hero], tr = th && LEAD[cur] != null ? th.tracks[LEAD[cur]] : null;
    if (!hi || !tr || retro) return;
    const spb = 60 / th.bpm, p = tr._p || (tr._p = parse(tr.seq)), g = ac.createGain();
    if (from) { g.gain.setValueAtTime(0.0001, from); g.gain.exponentialRampToValueAtTime(hi[2], from + 0.5); } else g.gain.value = hi[2];
    let out = g;
    if (ac.createStereoPanner) { out = ac.createStereoPanner(); out.pan.value = -(PAN[tr.inst] || 0) || 0.18; out.connect(g); }
    g.connect(musicBus);
    for (const e of p.ev) { const t = t0 + e.b * spb; if (!from || t >= from) queueNote(t, hi[0], e.n, e.len * spb, out, hi[1], true); }
    noteQ.sort((a, b) => a.t - b.t); flushNotes();
    heroLayers.push({ g, end: t0 + p.len * spb + 2 });
    heroLayers = heroLayers.filter(h => { if (h.end < ac.currentTime) { try { h.g.disconnect(); } catch (e) { /* ok */ } return false; } return true; });
  }
  function dropHero() {
    for (const h of heroLayers) { h.g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.12); const g = h.g; later(() => { try { g.disconnect(); } catch (e) { /* ok */ } }, 1.2); }
    heroLayers = []; noteQ = noteQ.filter(e => !e.layer);
  }
  function setHero(id) {
    id = id || null; if (hero === id) return; hero = id;
    if (!ac) return;
    dropHero();
    if (cur && hero) scheduleHero(loopT0, ac.currentTime + 0.05);
  }
  function scheduleLoop(t0) {
    const th = THEMES[cur]; if (!th) return;
    const spb = 60 / th.bpm;
    const lg = ac.createGain(); lg.connect(musicBus);
    if (fadeNext) { lg.gain.setValueAtTime(0.06, t0); lg.gain.exponentialRampToValueAtTime(1, t0 + 0.3); fadeNext = false; } else lg.gain.value = 1;
    let maxLen = 0;
    for (const tr of th.tracks) {
      const p = tr._p || (tr._p = parse(tr.seq));
      maxLen = Math.max(maxLen, p.len);
      if (tr.lvl && (intensity < (tr.lvl === 1 ? 0.25 : 0.6) || (lite && tr.lvl === 2))) continue;
      let out = lg; const pv = tr.pan != null ? tr.pan : PAN[tr.inst];
      if (pv && ac.createStereoPanner) { out = ac.createStereoPanner(); out.pan.value = pv; out.connect(lg); }
      for (const e of p.ev) queueNote(t0 + e.b * spb, tr.inst, e.n, e.len * spb, out);
    }
    // Schlagzeug-Fill im letzten Schlag und ein Becken, wenn der Loop von vorn beginnt – die Stücke wirken weniger wie eine Schleife
    if (th.fill && maxLen >= 8) {
      const fg = ac.createGain(); fg.gain.value = 0.7; fg.connect(lg);
      if (loopN > 0) queueNote(t0, 'drum', 'X', 1, fg);
      const e = t0 + (maxLen - 1) * spb;
      [['S', 0], ['S', 0.25], ['U', 0.5], ['M', 0.75]].forEach(([n, b]) => queueNote(e + b * spb, 'drum', n, 0.2, fg));
    }
    loopN++;
    if (partyOn && cur !== 'rock' && maxLen > 0) {   // Party-Modus: Disco-Beat über dem laufenden Stück
      const pg = ac.createGain(); pg.gain.value = 0.55; pg.connect(lg);
      for (let b = 0; b < maxLen; b += 1) {
        queueNote(t0 + b * spb, 'drum', 'K', 0.2, pg);
        queueNote(t0 + (b + 0.5) * spb, 'drum', 'O', 0.2, pg);
        if (b % 2 === 1) queueNote(t0 + b * spb, 'drum', 'C', 0.2, pg);
      }
    }
    loopEnd = t0 + maxLen * spb; loopT0 = t0;
    noteQ.sort((a, b) => a.t - b.t);
    if (hero) scheduleHero(t0, 0);
    flushNotes(2.5);   // beim Start gleich etwas mehr vorbereiten, falls der neue Raum kurz den Hauptthread belegt
    loops.push({ g: lg, end: loopEnd + 1.5 });
    loops = loops.filter(l => { if (l.end < ac.currentTime) { try { l.g.disconnect(); } catch (e) { /* schon getrennt */ } return false; } return true; });
  }

  // ---------- Umgebungsgeräusche ----------
  const AMB = {
    clock: t => { const hi = (ambCount++ % 2) === 0; osc('triangle', hi ? 2000 : 1550, t, 0.035, 0.03, ambBus, { decay: true }); nz(t, 0.02, 0.035, ambBus, { type: 'highpass', f: 4500 }); return 1.0; },
    fire: t => { for (let i = 0; i < 3; i++) if (Math.random() < 0.6) nz(t + Math.random() * 0.2, 0.02 + Math.random() * 0.03, 0.05 + Math.random() * 0.06, ambBus, { type: 'highpass', f: 1500 + Math.random() * 2500 }); if (Math.random() < 0.15) nz(t, 0.6, 0.03, ambBus, { type: 'lowpass', f: 200 }); return 0.25; },
    lab: t => { if (Math.random() < 0.7) osc('sine', 260 + Math.random() * 400, t, 0.07, 0.035, ambBus, { f2: 800 + Math.random() * 700, decay: true }); if (Math.random() < 0.1) osc('sawtooth', 60, t, 1.2, 0.012, ambBus, { lp: 200, attack: 0.3 }); return 0.25 + Math.random() * 0.7; },
    birds: t => { if (Math.random() < 0.55) { const f = 2300 + Math.random() * 1700, n = 2 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) osc('sine', f, t + i * 0.1, 0.07, 0.025, ambBus, { f2: f * (1.15 + Math.random() * 0.3), decay: true }); } return 0.7 + Math.random() * 1.8; },
    future: t => { osc('sine', 98 + Math.random() * 30, t, 3, 0.02, ambBus, { attack: 1, release: 1 }); if (Math.random() < 0.35) nz(t + Math.random(), 1.4, 0.025, ambBus, { type: 'bandpass', f: 300, f2: 1800, q: 5 }); return 2.2; },
    palace: t => { osc('sine', 65.4, t, 3.2, 0.028, ambBus, { attack: 1.2, release: 1.2 }); osc('sine', 98, t + 0.5, 2.8, 0.012, ambBus, { attack: 1, release: 1 }); return 2.8; },
    rain: t => { nz(t, 0.5, 0.035, ambBus, { type: 'bandpass', f: 2200 + Math.random() * 2400, q: 0.5, attack: 0.15 }); if (Math.random() < 0.3) osc('sine', 1800 + Math.random() * 900, t + Math.random() * 0.3, 0.04, 0.012, ambBus, { f2: 900, decay: true }); return 0.32; },
    beeps: t => { if (Math.random() < 0.6) { const n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) osc('square', [880, 1320, 1760, 2093][Math.floor(Math.random() * 4)], t + i * 0.09, 0.06, 0.01, ambBus, { decay: true }); } return 2.5 + Math.random() * 4; },
    traffic: t => { nz(t, 3.8, 0.045, ambBus, { type: 'lowpass', f: 260, f2: 700, q: 0.7, attack: 1.8 }); return 14 + Math.random() * 16; },
    moo: t => { if (Math.random() < 0.5) { osc('sawtooth', 128, t, 1.4, 0.035, ambBus, { f2: 96, lp: 650, q: 5, attack: 0.2 }); osc('sawtooth', 129.5, t, 1.4, 0.02, ambBus, { f2: 97, lp: 900, q: 3, attack: 0.25 }); } return 22 + Math.random() * 25; },
    crickets: t => { if (Math.random() < 0.7) { const f = 4200 + Math.random() * 600; for (let i = 0; i < 3; i++) osc('sine', f, t + i * 0.045, 0.03, 0.012, ambBus, { decay: true }); } return 0.5 + Math.random() * 0.9; },
    creak: t => { osc('sawtooth', 140 + Math.random() * 80, t, 0.5, 0.012, ambBus, { f2: 90 + Math.random() * 60, lp: 700, q: 6, attack: 0.08 }); return 5 + Math.random() * 8; },
    drip: t => { osc('sine', 1400 + Math.random() * 700, t, 0.09, 0.03, ambBus, { f2: 500, decay: true }); return 1.5 + Math.random() * 3.5; },
    owl: t => { if (Math.random() < 0.65) { osc('sine', 392, t, 0.42, 0.026, ambBus, { f2: 345, attack: 0.06 }); osc('sine', 370, t + 0.62, 0.2, 0.018, ambBus, { f2: 335, attack: 0.04 }); osc('sine', 380, t + 0.9, 0.55, 0.022, ambBus, { f2: 322, attack: 0.07 }); } return 9 + Math.random() * 13; },
    snore: t => { nz(t, 1.3, 0.045, ambBus, { type: 'bandpass', f: 300, f2: 520, q: 2, attack: 0.6 }); osc('sawtooth', 62, t + 1.45, 1.1, 0.028, ambBus, { f2: 48, lp: 380, q: 4, vib: 9, attack: 0.15 }); return 4.2 + Math.random() * 1.2; },
    hum: t => { osc('sine', 60, t, 4.2, 0.016, ambBus, { attack: 0.8, release: 0.8 }); osc('sine', 120, t, 4.2, 0.008, ambBus, { attack: 0.8, release: 0.8 }); if (Math.random() < 0.25) nz(t + Math.random() * 2, 0.6, 0.01, ambBus, { type: 'highpass', f: 6000 }); return 3.4; },   // Laborbrummen
    air: t => { nz(t, 4.4, 0.018, ambBus, { type: 'lowpass', f: 380, attack: 1.4, release: 1.4 }); return 3.6; },   // leise Lüftung / Raumton
    // Standuhr: ab und zu drei tiefe Schläge (Glocke mit unharmonischen Obertönen)
    chime: t => {
      if (Math.random() < 0.4) for (let i = 0; i < 3; i++) { const s = t + i * 1.3; osc('sine', 196, s, 2.6, 0.035, ambBus, { decay: true }); osc('sine', 196 * 2.76, s, 1.4, 0.012, ambBus, { decay: true }); osc('sine', 196 * 5.4, s, 0.7, 0.006, ambBus, { decay: true }); nz(s, 0.03, 0.02, ambBus, { type: 'bandpass', f: 1800, q: 2 }); }
      return 45 + Math.random() * 45;
    },
    // Gertrudes Kessel: ab und zu ein paar Blasen
    blub: t => { const n = 1 + (Math.random() * 3 | 0); for (let i = 0; i < n; i++) { const s = t + i * (0.12 + Math.random() * 0.15); osc('sine', 150 + Math.random() * 80, s, 0.09, 0.028, ambBus, { f2: 420 + Math.random() * 220, decay: true }); } return 1.8 + Math.random() * 3.5; },
    rainin: t => { nz(t, 0.6, 0.02, ambBus, { type: 'lowpass', f: 900 + Math.random() * 300, q: 0.4, attack: 0.2 }); if (Math.random() < 0.2) osc('sine', 900 + Math.random() * 500, t + Math.random() * 0.3, 0.03, 0.005, ambBus, { decay: true }); return 0.45; },
    wind: t => { nz(t, 2.6, 0.03, ambBus, { type: 'bandpass', f: 380 + Math.random() * 300, f2: 700 + Math.random() * 500, q: 1.4, attack: 1.1 }); return 2.1 + Math.random() * 1.2; },
  };
  // Hall-Impulsantwort: abklingendes Stereo-Rauschen, je Raumgröße einmal erzeugt
  // Je Raumgröße ein fertig vorbereiteter Faltungshall: beim Raumwechsel wird nur übergeblendet statt die
  // Impulsantwort neu zu laden (das kostete auf Handys spürbar Zeit und knackte); unbenutzte Knoten werden abgekoppelt
  let verbCur = null;
  function setReverb(sec, wet) {
    verbWanted = [sec, wet];
    if (lite) sec = Math.min(sec, 1.1);
    if (!ac) return;
    const key = sec.toFixed(2);
    let vn = verbCache[key];
    if (!vn) {
      const len = Math.max(1, Math.floor(ac.sampleRate * sec)), buf = ac.createBuffer(2, len, ac.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) * (i < 60 ? i / 60 : 1);
      }
      const conv = ac.createConvolver(), g = ac.createGain(); conv.buffer = buf; g.gain.value = 0.0001; conv.connect(g); g.connect(master);
      vn = verbCache[key] = { conv, g, on: false };
    }
    if (verbCur !== vn) {
      const t = ac.currentTime, old = verbCur;
      if (old) { old.g.gain.setTargetAtTime(0.0001, t, 0.12); later(() => { if (verbCur !== old && old.on) { try { verbIn.disconnect(old.conv); } catch (e) { /* ok */ } old.on = false; } }, 1.0); }
      if (!vn.on) { verbIn.connect(vn.conv); vn.on = true; }
      vn.g.gain.setTargetAtTime(1, t, 0.12); verbCur = vn;
    }
    verbSend.gain.setTargetAtTime(wet, ac.currentTime, 0.2);
  }
  function ambience(list) {
    ambWanted = list || [];
    if (!ac) return;
    const key = ambWanted.join(',');
    if (ambList.key === key) return;
    ambList = ambWanted.map(n => ({ n, next: ac.currentTime + 0.1 + Math.random() * 0.4 })); ambList.key = key;
  }

  function tick() {
    if (!ac) return;
    const now = ac.currentTime;
    for (let i = pending.length - 1; i >= 0; i--) if (pending[i].at <= now) { const f = pending[i].fn; pending.splice(i, 1); f(); }
    if (cur && now > loopEnd - 4) scheduleLoop(Math.max(loopEnd, now + 0.05));   // 4 s Vorlauf: auch gedrosselte Hintergrund-Tabs bekommen rechtzeitig Nachschub
    flushNotes();
    for (const a of ambList) {
      if (a.next < now) a.next = now + 0.05;
      let guard = 0;
      while (a.next < now + 0.35 && guard++ < 10) a.next += (AMB[a.n] ? AMB[a.n](a.next) : 1);
    }
  }
  function stopMusic() {
    // alter Loop blendet kurz aus; der neue startet fast sofort darüber
    if (ac) for (const l of loops) { l.g.gain.setTargetAtTime(0, ac.currentTime, 0.22); const g = l.g; later(() => { try { g.disconnect(); } catch (e) { /* ok */ } }, 1.0); }
    loops = []; cur = null; noteQ = [];
    if (ac) dropHero();
  }
  function play(name) {
    if (!ac) { wanted = name; return; }
    if (cur === name) return;
    const had = !!cur;
    stopMusic(); cur = name; fadeNext = had; loopN = 0;
    if (name) { songT0 = ac.currentTime + (had ? 0.12 : 0.05); scheduleLoop(songT0); }
  }
  // Musikbox: Spektrum des Musik-Busses und Besetzung eines Stücks
  let an = null, anData = null;
  function spectrum() {
    if (!ac || !musicBus || !ac.createAnalyser) return null;
    if (!an) { an = ac.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = 0.75; an.minDecibels = -96; an.maxDecibels = -36; musicBus.connect(an); anData = new Uint8Array(an.frequencyBinCount); }
    an.getByteFrequencyData(anData); return anData;
  }
  function info(id) { const th = THEMES[id]; return th ? { bpm: th.bpm, inst: [...new Set(th.tracks.map(t => t.inst))], lead: LEAD[id] != null } : null; }
  // einzelner Ton auf dem Musik-Bus (z. B. die selbst gespielte Lead-Gitarre)
  function note(instName, n, sec) { if (ac) inst(instName, n, ac.currentTime + 0.005, sec || 0.3, musicBus); }
  function musicLevel() { return musicOn ? (ducked ? 0.1 : 0.2) : 0; }
  function setMusic(on) { musicOn = on; if (musicBus) musicBus.gain.setTargetAtTime(musicLevel(), ac.currentTime, 0.1); }
  function duck(on) { if (ducked === on) return; ducked = on; if (musicBus) musicBus.gain.setTargetAtTime(musicLevel(), ac.currentTime, 0.15); }

  // ---------- Effekte ----------
  const SFX = {
    click: t => osc('square', 880, t, 0.04, 0.04, sfxBus, { decay: true }),
    tick: t => osc('triangle', 1400, t, 0.03, 0.04, sfxBus, { decay: true }),
    pick: t => { osc('square', 660, t, 0.07, 0.07, sfxBus, { decay: true }); osc('square', 990, t + 0.07, 0.12, 0.07, sfxBus, { decay: true }); },
    flush: t => {
      nz(t, 1.6, 0.35, sfxBus, { type: 'lowpass', f: 3200, f2: 180, q: 0.8 });
      for (let i = 0; i < 6; i++) osc('sine', 120 + Math.random() * 160, t + 0.3 + i * 0.17, 0.14, 0.12, sfxBus, { decay: true, f2: 300 + Math.random() * 200 });
      osc('sawtooth', 180, t + 1.1, 0.6, 0.05, sfxBus, { f2: 2400, lp: 3000 });
    },
    zap: t => { osc('sawtooth', 150, t, 0.35, 0.07, sfxBus, { f2: 1800, lp: 2500 }); osc('square', 1800, t + 0.3, 0.2, 0.035, sfxBus, { f2: 200, decay: true }); },
    coin: t => { osc('square', 988, t, 0.08, 0.06, sfxBus, { decay: true }); osc('square', 1319, t + 0.08, 0.28, 0.06, sfxBus, { decay: true }); },
    pour: t => nz(t, 1.2, 0.2, sfxBus, { type: 'bandpass', f: 700, f2: 1400, q: 3 }),
    slurp: t => nz(t, 0.7, 0.28, sfxBus, { type: 'bandpass', f: 300, f2: 1800, q: 6 }),
    chomp: t => [0, 0.22, 0.44].forEach(d => nz(t + d, 0.1, 0.4, sfxBus, { type: 'lowpass', f: 1100 })),
    dig: t => [0, 0.3, 0.6].forEach(d => nz(t + d, 0.16, 0.45, sfxBus, { type: 'lowpass', f: 500, f2: 200 })),
    splash: t => nz(t, 0.7, 0.35, sfxBus, { type: 'highpass', f: 900, f2: 3000 }),
    grow: t => { osc('sine', 220, t, 1.2, 0.12, sfxBus, { f2: 880 }); [0, 1, 2, 3, 4].forEach(i => osc('triangle', 1046 * Math.pow(1.122, i), t + 0.5 + i * 0.12, 0.25, 0.05, sfxBus, { decay: true })); },
    ding: t => { osc('sine', 1760, t, 1.2, 0.15, sfxBus, { decay: true }); osc('sine', 2637, t, 0.8, 0.06, sfxBus, { decay: true }); },
    pop: t => { osc('sine', 500, t, 0.15, 0.25, sfxBus, { f2: 160, decay: true }); osc('sine', 1568, t + 0.12, 0.6, 0.12, sfxBus, { decay: true }); },
    hum: t => { osc('sawtooth', 55, t, 1.8, 0.08, sfxBus, { lp: 300, attack: 0.2 }); osc('square', 110, t, 1.8, 0.03, sfxBus, { lp: 500, attack: 0.3 }); },
    door: t => {
      osc('sawtooth', 200, t, 0.42, 0.022, sfxBus, { f2: 340, lp: 900, q: 9, vib: 16, attack: 0.05 });   // Knarren
      nz(t + 0.38, 0.25, 0.4, sfxBus, { type: 'lowpass', f: 300 }); osc('sine', 90, t + 0.38, 0.2, 0.2, sfxBus, { f2: 50, decay: true });
    },
    firework: t => {
      osc('sine', 700, t, 0.55, 0.02, sfxBus, { f2: 2200, attack: 0.05 });   // Pfeifen beim Aufsteigen
      nz(t + 0.6, 0.5, 0.35, sfxBus, { type: 'lowpass', f: 1200, f2: 200 }); osc('sine', 70, t + 0.6, 0.4, 0.22, sfxBus, { f2: 40, decay: true });
      for (let i = 0; i < 10; i++) nz(t + 0.75 + Math.random() * 0.7, 0.025, 0.05 + Math.random() * 0.05, sfxBus, { type: 'highpass', f: 3000 + Math.random() * 3000 });
    },
    squeak: t => { for (let i = 0; i < 3; i++) osc('sine', 3200 + i * 300, t + i * 0.06, 0.05, 0.03, sfxBus, { f2: 4200, decay: true }); },
    wink: t => { osc('sine', 1200, t, 0.12, 0.05, sfxBus, { f2: 1800, decay: true }); osc('sine', 2400, t + 0.1, 0.25, 0.03, sfxBus, { decay: true }); },
    miss: t => osc('sawtooth', 110, t, 0.18, 0.05, sfxBus, { lp: 600, f2: 80, decay: true }),
    cheer: t => { nz(t, 2.2, 0.16, sfxBus, { type: 'bandpass', f: 1400, q: 0.6, attack: 0.25 }); for (let i = 0; i < 24; i++) nz(t + Math.random() * 1.8, 0.03, 0.08, sfxBus, { type: 'bandpass', f: 1800 + Math.random() * 1500, q: 2 }); },
    rustle: t => { nz(t, 0.16, 0.09, sfxBus, { type: 'bandpass', f: 2600 + Math.random() * 1200, q: 0.8 }); nz(t + 0.07, 0.12, 0.06, sfxBus, { type: 'highpass', f: 3500 }); },
    page: t => { nz(t, 0.16, 0.12, sfxBus, { type: 'bandpass', f: 2600, f2: 900, q: 1.2 }); nz(t + 0.12, 0.12, 0.08, sfxBus, { type: 'bandpass', f: 2000, f2: 700, q: 1.2 }); },
    menu: t => nz(t, 0.28, 0.05, sfxBus, { type: 'bandpass', f: 500, f2: 1700, q: 2, attack: 0.08 }),
    fanfare: t => ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => osc('square', freq(n), t + i * 0.12, i === 3 ? 0.6 : 0.12, 0.06, sfxBus, { lp: 2500 })),
    solve: t => {
      ['G4', 'C5', 'E5', 'G5'].forEach((n, i) => osc('square', freq(n), t + i * 0.09, 0.12, 0.05, sfxBus, { lp: 2600, decay: true }));
      ['C5', 'E5', 'G5', 'C6'].forEach(n => osc('triangle', freq(n), t + 0.38, 0.9, 0.05, sfxBus, { decay: true }));
    },
    achieve: t => { osc('sine', 1318, t, 0.3, 0.1, sfxBus, { decay: true }); osc('sine', 1976, t + 0.12, 0.6, 0.1, sfxBus, { decay: true }); for (let i = 0; i < 5; i++) osc('triangle', 2637 + i * 300, t + 0.25 + i * 0.05, 0.12, 0.03, sfxBus, { decay: true }); },
    warp: t => { osc('sawtooth', 1400, t, 0.55, 0.05, sfxBus, { f2: 90, lp: 2400, vib: 40 }); nz(t, 0.6, 0.12, sfxBus, { type: 'bandpass', f: 3000, f2: 300, q: 3 }); osc('sine', 80, t + 0.35, 0.4, 0.12, sfxBus, { f2: 900, decay: true }); },
    reveal: t => [0, 1, 2].forEach(i => osc('sine', 1568 * Math.pow(1.26, i), t + i * 0.05, 0.25, 0.04, sfxBus, { decay: true })),
    riff: t => {
      const seq = [['E2', 0.2], ['E2', 0.2], ['G2', 0.2], ['A2', 0.4], ['E2', 0.2], ['E2', 0.2], ['Bb2', 0.2], ['A2', 0.6]];
      let tt = t;
      for (const [n, d] of seq) {
        const f = freq(n);
        for (const m of [1, 1.5, 2]) { osc('sawtooth', f * m, tt, d * 0.9, 0.05, sfxBus, { lp: 1800, detune: -8 }); osc('sawtooth', f * m, tt, d * 0.9, 0.05, sfxBus, { lp: 1800, detune: 8 }); }
        nz(tt, 0.08, 0.3, sfxBus, { type: 'lowpass', f: 180 }); tt += d;
      }
      nz(tt, 0.6, 0.3, sfxBus, { type: 'highpass', f: 5000 });
    },
    run: t => { for (let i = 0; i < 8; i++) nz(t + i * 0.11, 0.05, 0.25, sfxBus, { type: 'bandpass', f: 600 + (i % 2) * 200, q: 2 }); },
    hearts: t => { for (let i = 0; i < 7; i++) osc('sine', 880 * Math.pow(1.19, i), t + i * 0.09, 0.3, 0.06, sfxBus, { decay: true }); },
    climb: t => { for (let i = 0; i < 5; i++) nz(t + i * 0.18, 0.12, 0.25, sfxBus, { type: 'bandpass', f: 1500, q: 1.5 }); },
    flutter: t => { for (let i = 0; i < 8; i++) nz(t + i * 0.042, 0.035, 0.09, sfxBus, { type: 'bandpass', f: 850 + (i % 3) * 380 + Math.random() * 220, q: 1.4 }); },
    chirp: t => { osc('sine', 1900, t, 0.07, 0.05, sfxBus, { f2: 2900, decay: true }); osc('sine', 2200, t + 0.09, 0.06, 0.045, sfxBus, { f2: 3200, decay: true }); },
    bake: t => ['E5', 'G5', 'C6'].forEach((n, i) => osc('sine', freq(n), t + i * 0.3, 0.5, 0.1, sfxBus, { decay: true })),
    bad: t => { osc('sawtooth', 220, t, 0.25, 0.07, sfxBus, { lp: 900, decay: true }); osc('sawtooth', 165, t + 0.25, 0.45, 0.07, sfxBus, { lp: 900, decay: true }); },
    click2: t => osc('triangle', 1200, t, 0.05, 0.08, sfxBus, { decay: true }),
    thunder: t => { nz(t, 0.25, 0.4, sfxBus, { type: 'lowpass', f: 900, f2: 300 }); nz(t + 0.15, 3.2, 0.32, sfxBus, { type: 'lowpass', f: 260, f2: 60, attack: 0.3 }); osc('sine', 48, t + 0.1, 2.6, 0.16, sfxBus, { f2: 32, attack: 0.25, release: 1.6 }); },
    open: t => { nz(t, 0.18, 0.18, sfxBus, { type: 'bandpass', f: 600, q: 2 }); osc('triangle', 220, t, 0.25, 0.06, sfxBus, { f2: 330, decay: true }); },
    whoosh: t => { nz(t, 1.1, 0.12, sfxBus, { type: 'bandpass', f: 400, f2: 2600, q: 2.5, attack: 0.35 }); osc('sawtooth', 90, t + 0.1, 0.9, 0.02, sfxBus, { f2: 220, lp: 600, attack: 0.3 }); },
    hover: t => osc('sine', 1900, t, 0.025, 0.012, sfxBus, { decay: true }),
    chapter: t => {
      [['C4', 'E4', 'G4'], ['D4', 'F4', 'A4'], ['E4', 'G4', 'C5']].forEach((ch, i) => ch.forEach(n => osc('sawtooth', freq(n), t + i * 0.16, i === 2 ? 0.9 : 0.15, 0.03, sfxBus, { lp: 600, lp2: 2600, lpT: 0.08, attack: 0.02 })));
      osc('sine', freq('C6'), t + 0.32, 1.2, 0.05, sfxBus, { decay: true }); nz(t + 0.32, 1.0, 0.06, sfxBus, { type: 'highpass', f: 6000 });
    },
    photo: t => { nz(t, 0.05, 0.3, sfxBus, { type: 'highpass', f: 3000 }); nz(t + 0.09, 0.08, 0.22, sfxBus, { type: 'bandpass', f: 1500, q: 2 }); },
    crystal: t => { ['E6', 'B5', 'G#6', 'E7'].forEach((n, i) => osc('sine', freq(n), t + i * 0.07, 0.5, 0.05, sfxBus, { decay: true })); osc('triangle', freq('E5'), t, 0.8, 0.04, sfxBus, { decay: true }); },
    sign: t => { ['G4', 'D5', 'G5', 'B5'].forEach((n, i) => osc('triangle', freq(n), t + i * 0.07, 1.0, 0.03, sfxBus, { decay: true })); nz(t, 0.6, 0.025, sfxBus, { type: 'highpass', f: 5500, attack: 0.12 }); },
    party: t => {
      osc('sawtooth', 520, t, 0.55, 0.05, sfxBus, { f2: 700, lp: 1800, vib: 22, attack: 0.03 });   // Partytröte
      osc('square', 523, t + 0.05, 0.5, 0.022, sfxBus, { f2: 690, lp: 1400, vib: 18 });
      nz(t + 0.5, 0.08, 0.3, sfxBus, { type: 'highpass', f: 1500 });   // Konfetti-Knall
      for (let i = 0; i < 12; i++) nz(t + 0.55 + Math.random() * 0.6, 0.02, 0.05, sfxBus, { type: 'highpass', f: 4000 + Math.random() * 3000 });
      ['C5', 'E5', 'G5', 'C6', 'G5', 'C6'].forEach((n, i) => osc('square', freq(n), t + 0.6 + i * 0.09, 0.1, 0.035, sfxBus, { lp: 3000, decay: true }));
    },
    unfold: t => { nz(t, 0.35, 0.1, sfxBus, { type: 'bandpass', f: 1200, f2: 3200, q: 1, attack: 0.05 }); nz(t + 0.18, 0.22, 0.07, sfxBus, { type: 'bandpass', f: 2600, f2: 1200, q: 1.4 }); },
    meow: t => { osc('sawtooth', 520, t, 0.55, 0.05, sfxBus, { f2: 760, lp: 1700, q: 4, vib: 6, attack: 0.05 }); osc('sawtooth', 720, t + 0.28, 0.32, 0.03, sfxBus, { f2: 470, lp: 1400, q: 3 }); },
    purr: t => { for (let i = 0; i < 12; i++) nz(t + i * 0.085, 0.07, 0.07, sfxBus, { type: 'lowpass', f: 240 }); },
    cluck: t => { [0, 0.11, 0.2, 0.46].forEach((d, i) => osc('square', i === 3 ? 520 : 780, t + d, i === 3 ? 0.2 : 0.06, 0.035, sfxBus, { f2: i === 3 ? 950 : 560, lp: 2400, decay: true })); },
    botbeep: t => { [1320, 1760, 1175, 1568].forEach((f, i) => osc('square', f, t + i * 0.075, 0.06, 0.03, sfxBus, { decay: true })); },
    shelf: t => nz(t, 0.22, 0.035, sfxBus, { type: 'bandpass', f: 900, f2: 2400, q: 1.5, attack: 0.06 }),
    sugar: t => { for (let i = 0; i < 7; i++) nz(t + i * 0.035 + Math.random() * 0.02, 0.018, 0.06, sfxBus, { type: 'highpass', f: 5000 + Math.random() * 3000 }); },
    slosh: t => { nz(t, 0.35, 0.12, sfxBus, { type: 'bandpass', f: 600, f2: 1400, q: 2.5, attack: 0.05 }); nz(t + 0.18, 0.25, 0.08, sfxBus, { type: 'bandpass', f: 1200, f2: 500, q: 2.5 }); },
    clank: t => { osc('square', 620, t, 0.18, 0.04, sfxBus, { f2: 590, lp: 3200, decay: true }); osc('triangle', 1870, t, 0.35, 0.03, sfxBus, { decay: true }); nz(t, 0.03, 0.12, sfxBus, { type: 'highpass', f: 3000 }); },
    knock: t => { [0, 0.09].forEach(d => { nz(t + d, 0.05, 0.18, sfxBus, { type: 'bandpass', f: 420, q: 3 }); osc('sine', 190, t + d, 0.08, 0.08, sfxBus, { f2: 140, decay: true }); }); },
    thunk: t => { osc('sine', 260, t, 0.12, 0.1, sfxBus, { f2: 150, decay: true }); nz(t, 0.04, 0.08, sfxBus, { type: 'lowpass', f: 900 }); },
    sparkle: t => { for (let i = 0; i < 6; i++) osc('sine', 2093 * Math.pow(1.12, i % 4), t + i * 0.05, 0.12, 0.025, sfxBus, { decay: true }); },
    // Leerlauf der Helden: Luftgitarren-Riff (leise, nur in Hoagies Kopf), Gähnen, Fliegensummen mit Klatsch, Brille, Grübeln
    airguitar: t => { [['E3', 0, 0.2], ['E3', 0.25, 0.2], ['G3', 0.5, 0.2], ['A3', 0.75, 0.4], ['E3', 1.3, 0.2], ['E3', 1.55, 0.2], ['B3', 1.8, 0.2], ['A3', 2.05, 0.2], ['G3', 2.3, 0.2], ['E3', 2.55, 0.55]].forEach(([n, d, l]) => { guitar(freq(n), t + 0.25 + d, l, 0.045, sfxBus); guitar(freq(n) * 1.498, t + 0.25 + d, l, 0.028, sfxBus); }); },
    yawn: t => { nz(t, 0.55, 0.035, sfxBus, { type: 'bandpass', f: 1300, f2: 700, q: 0.8, attack: 0.25 }); vowel(t + 0.5, 1.35, 340, 215, [[900, 1350], [560, 950]], 0.17); },
    buzz: t => {
      const s = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter(), l = ac.createOscillator(), lg = ac.createGain();
      s.type = 'sawtooth'; s.frequency.value = 215; l.frequency.value = 1.1; lg.gain.value = 45; l.connect(lg); lg.connect(s.frequency);
      f.type = 'bandpass'; f.frequency.value = 950; f.Q.value = 1.3;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.4);
      for (let i = 1; i < 6; i++) g.gain.linearRampToValueAtTime(i % 2 ? 0.011 : 0.034, t + 0.4 + i * 0.5);
      g.gain.linearRampToValueAtTime(0.03, t + 3.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.3);
      s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); l.start(t); s.stop(t + 3.4); l.stop(t + 3.4);
      nz(t + 3.27, 0.05, 0.16, sfxBus, { type: 'bandpass', f: 1500, q: 1 }); nz(t + 3.3, 0.12, 0.06, sfxBus, { type: 'bandpass', f: 1100, q: 0.9 });
    },
    // Nebenfiguren: Gertrude summt und wischt, Hancocks Feder kratzt, der Grüne Tentakel singt, Lila kichert, Dr. Freds Geistesblitz
    hummel: t => { [['G4', 0.5], ['A4', 0.4], ['B4', 0.6], ['A4', 0.4], ['G4', 0.5], ['E4', 0.8]].reduce((at, [n, d]) => { osc('sawtooth', freq(n), at, d, 0.028, sfxBus, { lp: 650, q: 1.2, attack: 0.06, release: 0.12, vib: 4 }); return at + d; }, t + 0.1); },
    wipe: t => { for (let i = 0; i < 5; i++) nz(t + i * 0.42, 0.34, 0.022, sfxBus, { type: 'bandpass', f: 1700 + (i % 2) * 700, q: 0.9, attack: 0.12 }); },
    quill: t => { for (let i = 0; i < 7; i++) nz(t + 0.15 + i * 0.17 + Math.random() * 0.04, 0.09, 0.03, sfxBus, { type: 'bandpass', f: 4200 + Math.random() * 2500, f2: 2600 + Math.random() * 1500, q: 4 }); osc('sine', 2637, t + 1.45, 0.5, 0.016, sfxBus, { decay: true }); },
    lala: t => { [['E4', 0.38], ['G4', 0.38], ['A4', 0.5], ['G4', 0.38], ['E4', 0.38], ['D4', 0.38], ['E4', 0.7]].reduce((at, [n, d]) => { const f = freq(n); vowel(at, d * 0.9, f, f * 0.97, [[420, 1100], [820, 1250]], 0.07); return at + d; }, t + 0.1); },
    scheme: t => { for (let i = 0; i < 4; i++) vowel(t + 0.1 + i * 0.19, 0.13, 175 - i * 14, 160 - i * 14, [[480, 1850], [430, 1750]], 0.09); },
    bulb: t => { osc('sawtooth', 120, t, 0.22, 0.012, sfxBus, { lp: 900 }); osc('sine', 1568, t + 0.12, 0.7, 0.04, sfxBus, { decay: true }); osc('sine', 3136, t + 0.12, 0.35, 0.014, sfxBus, { decay: true }); },
    bellydrum: t => { [0, 0.22, 0.44, 0.55, 0.77, 0.99, 1.21, 1.32, 1.6].forEach((d, i) => { osc('sine', i % 3 === 2 ? 105 : 145, t + 0.2 + d, 0.2, 0.09, sfxBus, { f2: i % 3 === 2 ? 70 : 95, decay: true }); nz(t + 0.2 + d, 0.05, 0.05, sfxBus, { type: 'lowpass', f: 600 }); }); },
    // Easter Eggs: Hamsterrad, Lichtschwert, Spinnrocken-Melodie, Schwan, Steinkugel, Gummihuhn, Kelch, Grog, Eichhörnchen, Meteor, Onkel Eds „Psst“
    wheel: t => { for (let i = 0; i < 10; i++) osc('triangle', 1400 + (i % 2) * 300, t + i * 0.11, 0.05, 0.012, sfxBus, { f2: 1800, decay: true }); },
    saberon: t => { osc('sawtooth', 70, t, 0.45, 0.06, sfxBus, { f2: 150, lp: 900, attack: 0.02 }); nz(t, 0.35, 0.05, sfxBus, { type: 'bandpass', f: 600, f2: 2400, q: 2 }); osc('sawtooth', 110, t + 0.35, 2.2, 0.04, sfxBus, { lp: 700, q: 3, vib: 2, attack: 0.1, release: 0.3 }); osc('sawtooth', 111.5, t + 0.35, 2.2, 0.03, sfxBus, { lp: 650, attack: 0.1, release: 0.3 }); },
    saberswing: t => { osc('sawtooth', 120, t, 0.35, 0.07, sfxBus, { f2: 190, lp: 1200, q: 4, attack: 0.03 }); nz(t, 0.3, 0.04, sfxBus, { type: 'bandpass', f: 800, f2: 1800, q: 1.5, attack: 0.05 }); },
    saberoff: t => { osc('sawtooth', 150, t, 0.4, 0.06, sfxBus, { f2: 50, lp: 900, attack: 0.01 }); nz(t, 0.3, 0.04, sfxBus, { type: 'bandpass', f: 2000, f2: 400, q: 2 }); },
    draft: t => { ['E5', 'G5', 'A5', 'C6'].forEach((n, i) => { osc('sine', freq(n), t + i * 0.38, 1.2, 0.06, sfxBus, { decay: true }); osc('sine', freq(n) * 2.01, t + i * 0.38, 0.8, 0.02, sfxBus, { decay: true }); osc('triangle', freq(n), t + i * 0.38, 0.9, 0.025, sfxBus, { decay: true, vib: 4 }); }); for (let i = 0; i < 8; i++) osc('sine', 2093 * Math.pow(1.122, i), t + 1.6 + i * 0.06, 0.4, 0.012, sfxBus, { decay: true }); },
    swan: t => { for (let i = 0; i < 6; i++) nz(t + i * 0.42, 0.25, 0.035, sfxBus, { type: 'lowpass', f: 700, f2: 300, attack: 0.08 }); vowel(t + 1.1, 0.35, 520, 470, [[600, 1000], [560, 950]], 0.05); },
    boulder: t => { nz(t, 2.8, 0.12, sfxBus, { type: 'lowpass', f: 160, f2: 90, attack: 0.4 }); for (let i = 0; i < 8; i++) osc('sine', 48 + Math.random() * 10, t + i * 0.32, 0.3, 0.08, sfxBus, { decay: true }); },
    rubber: t => { osc('square', 900, t, 0.22, 0.035, sfxBus, { f2: 1500, lp: 2200, q: 6, attack: 0.01 }); osc('square', 1450, t + 0.24, 0.35, 0.03, sfxBus, { f2: 700, lp: 2000, q: 6, attack: 0.01 }); },
    // Lichtbogen im Labor: kurzes Knistern mit tiefem Netzbrummen
    crackle: t => { for (let i = 0; i < 8; i++) nz(t + i * 0.04 + Math.random() * 0.02, 0.025, 0.045, sfxBus, { type: 'highpass', f: 2500 + Math.random() * 3500 }); osc('sawtooth', 100, t, 0.4, 0.018, sfxBus, { f2: 60, lp: 1400, decay: true }); },
    rainbow: t => { ['C6', 'E6', 'G6', 'B6', 'D7', 'G7'].forEach((n, i) => { osc('sine', freq(n), t + i * 0.16, 2.2, 0.018, sfxBus, { attack: 0.05, decay: true }); osc('triangle', freq(n) * 2, t + i * 0.16 + 0.01, 0.9, 0.005, sfxBus, { decay: true }); }); nz(t, 1.6, 0.012, sfxBus, { type: 'highpass', f: 7000, attack: 0.5 }); },
    grail: t => { ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, i) => osc('sine', freq(n), t + i * 0.12, 1.6, 0.03, sfxBus, { attack: 0.2, release: 0.6 })); },
    grog: t => { for (let i = 0; i < 9; i++) osc('sine', 220 + Math.random() * 300, t + i * 0.09 + Math.random() * 0.04, 0.06, 0.025, sfxBus, { f2: 500 + Math.random() * 400, decay: true }); },
    chatter: t => { for (let i = 0; i < 10; i++) osc('square', 2200 + Math.random() * 900, t + i * 0.07, 0.04, 0.012, sfxBus, { decay: true }); },
    meteor: t => { nz(t, 1.4, 0.05, sfxBus, { type: 'bandpass', f: 3000, f2: 300, q: 1.2, attack: 0.2 }); osc('sine', 900, t, 1.3, 0.015, sfxBus, { f2: 120, decay: true }); },
    psst: t => { nz(t, 0.35, 0.05, sfxBus, { type: 'highpass', f: 3500, attack: 0.05 }); },
    specs: t => { osc('sine', 2500, t + 0.45, 0.08, 0.014, sfxBus, { f2: 3300, decay: true }); nz(t + 0.42, 0.05, 0.02, sfxBus, { type: 'bandpass', f: 3000, q: 2 }); },
    hmm: t => { osc('sawtooth', 205, t + 0.35, 1.0, 0.05, sfxBus, { f2: 180, lp: 430, q: 2, attack: 0.1, vib: 3 }); osc('sawtooth', 236, t + 1.45, 0.4, 0.04, sfxBus, { f2: 262, lp: 520, q: 2, attack: 0.05 }); },
  };
  // gesungener Vokal: Sägezahn durch zwei wandernde Formant-Filter (Gähnen)
  function vowel(t, dur, fa, fb, fmts, vol) {
    const src = ac.createOscillator(), g = ac.createGain(), vb = ac.createOscillator(), vg = ac.createGain();
    src.type = 'sawtooth'; src.frequency.setValueAtTime(fa, t); src.frequency.exponentialRampToValueAtTime(fb, t + dur);
    vb.frequency.value = 5; vg.gain.value = fa * 0.012; vb.connect(vg); vg.connect(src.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25); g.gain.setValueAtTime(vol, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [[0, 6, 1], [1, 10, 0.6]].forEach(([i, q, lv]) => { const bp = ac.createBiquadFilter(), bg = ac.createGain(); bp.type = 'bandpass'; bp.Q.value = q; bp.frequency.setValueAtTime(fmts[0][i], t); bp.frequency.linearRampToValueAtTime(fmts[1][i], t + dur); bg.gain.value = lv; src.connect(bp); bp.connect(bg); bg.connect(g); });
    g.connect(sfxBus); src.start(t); vb.start(t); src.stop(t + dur + 0.05); vb.stop(t + dur + 0.05);
  }
  const listeners = [];
  // Stereo-Position: der Effekt wird kurz über einen Panner auf den Effekt-Bus geleitet
  function panned(pan, fn) {
    if (pan == null || !ac.createStereoPanner) return fn();
    const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(sfxBus);
    const keep = sfxBus; sfxBus = p;
    try { fn(); } finally { sfxBus = keep; }
    later(() => { try { p.disconnect(); } catch (e) { /* ok */ } }, 4);
  }
  // Echte Geräusch-Aufnahmen (mit ElevenLabs erzeugt): ersetzen den Synthesizer, sobald sie geladen sind.
  // Im Klassik-Modus bleibt der alte Soundkarten-Klang; fehlt eine Datei, spielt weiter die Synthese.
  const SAMPLE_URLS = { chomp: ['sfx/chomp.mp3', 0.5] };
  const samples = {};
  function loadSamples() {
    for (const [k, [u]] of Object.entries(SAMPLE_URLS)) {
      if (samples[k]) continue;
      samples[k] = 'loading';
      fetch(u).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(b => ac.decodeAudioData(b)).then(buf => { samples[k] = buf; }).catch(() => { delete samples[k]; });
    }
  }
  function playSample(name, pan) {
    const s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = samples[name]; s.playbackRate.value = 0.95 + Math.random() * 0.1;   // kleine Tonhöhen-Variation gegen Wiederholung
    g.gain.value = SAMPLE_URLS[name][1]; s.connect(g);
    if (pan != null && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(sfxBus); } else g.connect(sfxBus);
    s.start(ac.currentTime + 0.01);
  }
  function sfx(name, pan) {
    if (ac) {
      if (!retro && samples[name] instanceof AudioBuffer) playSample(name, pan);
      else { const f = SFX[name]; if (f) panned(pan, () => f(ac.currentTime + 0.01)); }
    }
    listeners.forEach(fn => fn(name));
  }
  function onSfx(fn) { listeners.push(fn); }

  // Plapperstimme: kurze Silben-Töne pro Figur (wenn keine Sprachausgabe aktiv ist)
  // Silbe = Sägezahn in Stimmlage durch zwei Bandpässe auf den Formanten eines zufälligen Vokals (a, e, i, o, u)
  const VOWELS = [[800, 1250], [450, 1900], [320, 2300], [520, 920], [360, 780]];
  function blip(v, pan) {
    const vi = Math.floor(Math.random() * VOWELS.length);   // der Vokal steuert auch die Mundform (engine.js)
    if (!ac || !v) return vi;
    const t = ac.currentTime + 0.005, f = (v.blip || 220) * (0.88 + Math.random() * 0.28);
    if (retro) {   // Klassik-Modus: altes Soundkarten-Piepsen
      panned(pan, () => { osc(v.wave || 'square', f, t, 0.065, 0.032, sfxBus, { lp: 1900, decay: true, attack: 0.004 }); });
      return vi;
    }
    const dur = 0.075 + Math.random() * 0.05, [f1, f2] = VOWELS[vi], k = v.formant || 1;
    panned(pan, () => {
      const src = ac.createOscillator(), g = ac.createGain();
      src.type = 'sawtooth'; src.frequency.setValueAtTime(f, t); src.frequency.linearRampToValueAtTime(f * (0.9 + Math.random() * 0.2), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3 / k, t + 0.014); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      for (const [ff, q, lv] of [[f1 * k, 6, 1], [f2 * k, 10, 0.7]]) {
        const bp = ac.createBiquadFilter(), bg = ac.createGain(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q; bg.gain.value = lv;
        src.connect(bp); bp.connect(bg); bg.connect(g);
      }
      g.connect(sfxBus); src.start(t); src.stop(t + dur + 0.02);
    });
    return vi;
  }
  // Schritte je nach Untergrund
  const STEP = { wood: { f: 900, q: 1.2, v: 0.1 }, tile: { f: 2400, q: 2, v: 0.07 }, grass: { f: 3800, q: 0.7, v: 0.045, type: 'highpass' }, marble: { f: 3000, q: 3, v: 0.06 }, carpet: { f: 380, q: 0.8, v: 0.06 } };
  // Schritt je nach Boden, Gewicht und Gangart: thud = schwere Stiefel, click = Absätze, scuff = Schlurfen, squish = Tentakel
  function step(kind, pan, weight = 1, wet, style) {
    if (!ac) return;
    const s = STEP[kind] || STEP.wood, k = Math.max(0.6, Math.min(1.6, weight)), t = ac.currentTime + 0.005, hard = kind !== 'grass' && kind !== 'carpet';
    panned(pan, () => {
      if (style === 'thud') { osc('sine', 62, t, 0.13, 0.08 * k, sfxBus, { f2: 36, decay: true }); nz(t, 0.09, s.v * 0.8, sfxBus, { type: 'lowpass', f: 420 }); if (Math.random() < 0.3) osc('sawtooth', 160 + Math.random() * 60, t + 0.04, 0.09, 0.008, sfxBus, { lp: 700, q: 6, decay: true }); }
      else if (style === 'click' && hard) { osc('triangle', 2500 + Math.random() * 400, t, 0.025, 0.035, sfxBus, { decay: true }); nz(t, 0.02, s.v * 0.6, sfxBus, { type: 'highpass', f: 4000 }); }
      else if (style === 'scuff') nz(t + 0.045, 0.1, s.v * 0.35, sfxBus, { type: 'bandpass', f: s.f * 1.5, q: 0.6, attack: 0.03 });
      else if (style === 'squish') { nz(t, 0.12, 0.07, sfxBus, { type: 'lowpass', f: 700, f2: 300 }); osc('sine', 180, t, 0.08, 0.03, sfxBus, { f2: 90, decay: true }); return; }
      nz(ac.currentTime + 0.005, 0.06, s.v * (0.75 + 0.3 * k), sfxBus, { type: s.type || 'bandpass', f: s.f * (0.9 + Math.random() * 0.2) / k, q: s.q });
      if (k > 1.15) osc('sine', 70, ac.currentTime + 0.005, 0.08, 0.05 * k, sfxBus, { f2: 45, decay: true });   // schwere Schritte wummern
      if (wet) nz(ac.currentTime + 0.012, 0.1, s.v * 0.7, sfxBus, { type: 'highpass', f: 2400 + Math.random() * 1000 });   // nasse Schritte platschen
    });
  }

  // Kurzes Erkennungsmotiv, wenn ein Gespräch mit einer Figur beginnt
  const STING = {
    drfred: ['bell', 'C5:0.25 E5:0.25 G5:0.25 C6:0.5'], green: ['arp', 'E4:0.25 G4:0.25 B4:0.5'], gertrude: ['harp', 'G4:0.5 B4:0.5 D5:1'],
    hancock: ['clar', 'D4:0.5 G4:0.5 B4:1'], wache: ['tuba', 'G2:0.5 D2:1'], lila: ['organ', 'C4+Eb4:0.5 B3+D4:1'],
    // Erkennungsmotive der drei Helden beim Figurenwechsel
    bernard: ['epiano', 'C5:0.25 E5:0.25 G5:0.25 B5:0.25 C6:0.5'], hoagie: ['guitar', 'E3:0.25 E3:0.25 G3:0.25 A3:0.75'], laverne: ['bell', 'A4:0.25 C5:0.25 E5:0.25 G#5:0.75'],
  };
  function sting(id) {
    const s = STING[id]; if (!ac || !s) return;
    const lg = ac.createGain(); lg.gain.value = 0.9; lg.connect(musicBus);
    let t = ac.currentTime + 0.05; const spb = 0.42;
    for (const e of parse(s[1]).ev) inst(s[0], e.n, t + e.b * spb, e.len * spb, lg);
    later(() => { try { lg.disconnect(); } catch (e) { /* ok */ } }, 4);
  }
  // kurzes Motiv der Epoche, wenn ein Raum zum ersten Mal betreten wird (Gegenwart E-Piano, 1776 Harfe, Zukunft Glocken)
  const MOTIF = { present: ['epiano', 'C5:0.25 G5:0.25 E5:0.5'], past: ['harp', 'G4:0.25 B4:0.25 D5:0.5'], future: ['bell', 'A5:0.25 E6:0.25 C#6:0.5'] };
  function motif(era) {
    const m = MOTIF[era]; if (!ac || !m || !musicOn) return;
    const lg = ac.createGain(); lg.gain.value = 0.7; lg.connect(musicBus);
    const t = ac.currentTime + 0.12, spb = 0.36;
    for (const e of parse(m[1]).ev) inst(m[0], e.n, t + e.b * spb, e.len * spb, lg);
    later(() => { try { lg.disconnect(); } catch (e) { /* ok */ } }, 3);
  }
  function muffle(on) {
    if (muffled === on) return; muffled = on;
    if (muffleF) muffleF.frequency.setTargetAtTime(on ? 650 : 20000, ac.currentTime, on ? 0.08 : 0.15);
  }
  // Fortschritt 0..1: schaltet zusätzliche Musik-Ebenen dazu (wirkt ab dem nächsten Loop-Durchlauf)
  function setIntensity(k) { intensity = Math.max(0, Math.min(1, k || 0)); }

  // Liefert den Spielton als MediaStream (z. B. für Trailer-Aufnahmen per MediaRecorder)
  function captureStream() {
    init(); if (!ac || !ac.createMediaStreamDestination) return null;
    const d = ac.createMediaStreamDestination(); master.connect(d); return d.stream;
  }

  // Retro-Klang umschalten: aktueller Loop wird sofort neu im passenden Stil gestartet
  function setRetro(on) {
    if (retro === on) return;
    retro = on;
    // Chiptunes klingen trocken am besten: Musik-Hall nur im HD-Modus
    if (ac && musicSend) musicSend.gain.setTargetAtTime(retro ? 0 : 0.06, ac.currentTime, 0.1);
    if (ac && cur) {
      const c = cur;
      // Stilwechsel: alter Loop endet sofort – sonst überlagern sich zwei Versionen desselben Stücks
      for (const l of loops) { try { l.g.disconnect(); } catch (e) { /* schon getrennt */ } }
      loops = [];
      cur = c; fadeNext = true;
      scheduleLoop(ac.currentTime + 0.06);
    } else if (ac && !cur && wanted) { const w = wanted; wanted = null; play(w); }   // Sicherheitsnetz: nie ohne Musik dastehen
  }

  // Für Trailer-Aufnahmen: Klang in einen OfflineAudioContext rendern, getaktet über tick()
  function initOffline(ctx) { init(ctx); }

  function setParty(on) { partyOn = !!on; }
  function setLite(on) { lite = on == null ? MOBILE : !!on; if (ac) setReverb(verbWanted[0], verbWanted[1]); }
  return { init, initOffline, tick, play, sfx, motif, setParty, setLite, get lite() { return lite; }, get mobile() { return MOBILE; }, setHero, spectrum, info, onSfx, setMusic, setRetro, setReverb, duck, ambience, blip, step, sting, muffle, setIntensity, captureStream, get musicOn() { return musicOn; }, get current() { return cur; }, get songT0() { return songT0; }, note, chart: ROCK_CHART, get ctx() { return ac; }, get out() { return master; } };
})();

// ---------- Sprachausgabe über die Web Speech API ----------
const Voice = (() => {
  const syn = window.speechSynthesis || null;
  let on = false, voice = null, fem = [], mal = [], lang = 'de';
  const LOCALE = { de: 'de-DE', en: 'en-US', fr: 'fr-FR', es: 'es-ES', ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR' };
  // Stimmnamen der gängigen Systeme (Edge/Windows, Chrome, macOS/iOS, Android) nach Geschlecht
  // dazu die üblichen Stimmen für Englisch, Französisch, Spanisch, Japanisch, Chinesisch und Koreanisch
  const FEMALE = /katja|amala|seraphina|hedda|anna|petra|helena|ingrid|leni|elke|louisa|tanja|maja|gisela|klarissa|vicki|marlene|sabine|google deutsch|zira|aria|jenny|michelle|ana\b|sonia|libby|hazel|susan|samantha|karen|moira|tessa|denise|julie|hortense|amelie|am[ée]lie|brigitte|coralie|eloise|vivienne|elvira|laura|lucia|helena|paloma|monica|m[oó]nica|paulina|nanami|haruka|ayumi|sayaka|kyoko|aoi|xiaoxiao|xiaoyi|huihui|yaoyao|ting-?ting|mei-?jia|sin-?ji|sunhi|sun-?hi|heami|yuna|google us english|google uk english female|google fran[cç]ais|google 日本語|google 普通话|google 한국|\bfemale\b|weiblich/i;
  const MALE = /conrad|killian|florian|stefan|markus|yannick|martin|jonas|\bjan\b|ralf|bernd|kasper|christoph|hans|david|mark\b|guy\b|ryan|george|eric|daniel|alex\b|tom\b|fred\b|henri|paul\b|claude|thomas|remy|r[ée]my|alvaro|[áa]lvaro|pablo|jorge|diego|keita|ichiro|daichi|kangkang|yunxi|yunyang|yunjian|injoon|hyunsu|google uk english male|google español|\bmale\b|männlich/i;
  const quality = v => (/natural|neural|premium|enhanced|online/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 2 : 0) + (v.lang.replace('_', '-').toLowerCase() === (LOCALE[lang] || '').toLowerCase() ? 1 : 0) + (v.localService ? 0 : 0.5);
  function best(list) {
    // natürliche Stimmen bevorzugen und nicht mit roboterhaften mischen
    const top = Math.max(...list.map(quality));
    return list.filter(v => quality(v) >= top - 1);
  }
  function pick() {
    if (!syn) return;
    const vs = syn.getVoices().filter(v => v.lang.toLowerCase().startsWith(lang) && (lang !== 'zh' || /cn|hans|zh$/i.test(v.lang) || !/tw|hk/i.test(v.lang))).sort((a, b) => quality(b) - quality(a));
    voice = vs[0] || null;
    fem = vs.length ? best(vs.filter(v => FEMALE.test(v.name) && !MALE.test(v.name))) : [];
    mal = vs.length ? best(vs.filter(v => MALE.test(v.name))) : [];
  }
  if (syn) { pick(); if ('onvoiceschanged' in syn) syn.onvoiceschanged = pick; }
  // Bühnenanweisungen, Großbuchstaben-Schilder und Auslassungen so umbauen, dass sie natürlich klingen
  function clean(t) {
    if (lang !== 'de') return t.replace(/\*([^*]+)\*/g, '$1,').replace(/\.\.\.|…/g, ', ').replace(/\s{2,}/g, ' ').trim();
    return t.replace(/\*([^*]+)\*/g, '$1,').replace(/\.\.\.|…/g, ', ')
      .replace(/\bDr\./g, 'Doktor').replace(/\b([A-ZÄÖÜ])([A-ZÄÖÜ]{2,})\b/g, (m, a, b) => a + b.toLowerCase())
      .replace(/\s*,\s*([,.!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  }
  function cast(prof) {
    const tts = prof && prof.tts;
    if (!tts) return { v: voice, pitch: 1, rate: 1.02 };
    const pool = tts.g === 'f' ? fem : mal;
    if (pool.length) return { v: pool[tts.n % pool.length], pitch: tts.pitch, rate: tts.rate };
    // keine passende Stimme installiert: beste Stimme nehmen und die Tonlage leicht anpassen
    return { v: voice, pitch: Math.max(0.6, Math.min(1.5, tts.pitch * (tts.g === 'f' ? 1.2 : 0.85))), rate: tts.rate };
  }
  function speak(text, prof) {
    return new Promise(res => {
      if (!syn || !on) return res();
      try {
        syn.cancel();
        const c = cast(prof), u = new SpeechSynthesisUtterance(clean(text));
        u.lang = c.v ? c.v.lang : LOCALE[lang] || 'de-DE'; if (c.v) u.voice = c.v;
        u.pitch = c.pitch; u.rate = c.rate; u.volume = 1;
        u.onend = () => res(); u.onerror = () => res();
        syn.speak(u);
      } catch (e) { res(); }
    });
  }
  function stop() { try { if (syn) syn.cancel(); } catch (e) { /* ok */ } }
  return {
    get on() { return on; }, set on(v) { on = !!v && !!syn; if (!on) stop(); },
    get available() { return !!syn; }, speak, stop,
    setLang(id) { lang = LOCALE[id] ? id : 'de'; pick(); }, get lang() { return lang; },
    get hasVoice() { return !!voice; },
  };
})();
