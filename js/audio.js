'use strict';
// ============================================================
//  Tentakel-Toast – Sound: WebAudio-Synth für Musik & Effekte,
//  Browser-Sprachausgabe (Web Speech API) für die Dialoge.
// ============================================================

const Sound = (() => {
  let ac = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
  let musicOn = true;
  let cur = null, wanted = null, loopEnd = 0, loops = [];

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.8; master.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = musicOn ? 0.2 : 0; musicBus.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setInterval(tick, 250);
    if (wanted) { const w = wanted; wanted = null; play(w); }
  }

  function midi(n) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
    if (!m) return 60;
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 12 * (+m[3] + 1) + base;
  }
  const freq = n => 440 * Math.pow(2, (midi(n) - 69) / 12);

  function osc(type, f, t, dur, vol, bus, o = {}) {
    const { attack = 0.01, release = 0.08, lp = null, q = 1, f2 = null, detune = 0, decay = false } = o;
    const s = ac.createOscillator(); s.type = type; s.frequency.setValueAtTime(f, t);
    if (f2) s.frequency.exponentialRampToValueAtTime(f2, t + dur);
    if (detune) s.detune.value = detune;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack);
    if (decay) g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    else { g.gain.setValueAtTime(vol, Math.max(t + attack, t + dur - release)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    let n = s;
    if (lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = q; s.connect(fl); n = fl; }
    n.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.05);
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
  function inst(name, n, t, d, bus) {
    if (n === 'K') return osc('sine', 150, t, 0.16, 0.5, bus, { f2: 45, decay: true });
    if (n === 'S') { nz(t, 0.14, 0.22, bus, { type: 'bandpass', f: 1800, q: 0.8 }); return osc('triangle', 190, t, 0.08, 0.12, bus, { decay: true }); }
    if (n === 'H') return nz(t, 0.05, 0.1, bus, { type: 'highpass', f: 7000 });
    for (const part of n.split('+')) {
      const f = freq(part);
      switch (name) {
        case 'harp': osc('sawtooth', f, t, 0.5, 0.08, bus, { lp: 2800, decay: true, attack: 0.003 }); osc('square', f * 2, t, 0.25, 0.02, bus, { lp: 3500, decay: true, attack: 0.003 }); break;
        case 'bassoon': osc('square', f, t, d * 0.85, 0.06, bus, { lp: 1000, q: 2, attack: 0.02, release: 0.06 }); break;
        case 'pizz': osc('triangle', f, t, 0.3, 0.22, bus, { decay: true, attack: 0.004 }); break;
        case 'tuba': osc('sawtooth', f, t, d * 0.7, 0.12, bus, { lp: 420, attack: 0.02 }); break;
        case 'arp': osc('sawtooth', f, t, 0.2, 0.045, bus, { lp: 2000, decay: true }); osc('sawtooth', f, t, 0.2, 0.03, bus, { lp: 2000, decay: true, detune: 9 }); break;
        case 'synbass': osc('square', f, t, d * 0.9, 0.08, bus, { lp: 600, attack: 0.01 }); break;
        case 'bell': osc('sine', f, t, 0.9, 0.08, bus, { decay: true }); osc('sine', f * 2.01, t, 0.5, 0.025, bus, { decay: true }); break;
        case 'clar': osc('square', f, t, d * 0.9, 0.04, bus, { lp: 1500, attack: 0.03, release: 0.08 }); osc('triangle', f, t, d * 0.9, 0.05, bus, { attack: 0.03 }); break;
        default: osc('triangle', f, t, d, 0.08, bus);
      }
    }
  }

  // ---------- Musikstücke (eigene Kompositionen, je 8 Takte als Loop) ----------
  const x2 = s => s + ' ' + s;
  const THEMES = {
    title: { bpm: 100, tracks: [
      { inst: 'tuba', seq: x2('E2:1 B2:1 E2:1 B2:1 E2:1 B2:1 E2:1 B2:1 C2:1 G2:1 C2:1 G2:1 B1:1 F#2:1 B1:1 F#2:1') },
      { inst: 'clar', seq: 'E4:0.5 F#4:0.5 G4:1 B4:1 -:1 A4:0.5 G4:0.5 F#4:1 E4:1 -:1 C5:1 B4:0.5 A4:0.5 G4:1 E4:1 F#4:1 D#4:1 B3:2 E4:0.5 F#4:0.5 G4:1 B4:1 E5:1 D5:0.5 C5:0.5 B4:1 A4:1 G4:1 C5:1 E5:1 D#5:1 B4:1 E5:2 -:2' },
      { inst: 'drum', seq: Array(32).fill('-:0.5 H:0.5').join(' ') },
    ] },
    past: { bpm: 132, tracks: [
      { inst: 'harp', seq: 'G4:1 B4:1 D5:1 C5:1 B4:0.5 A4:0.5 B4:1 A4:1 F#4:1 D4:1 G4:2 D5:1 E5:1 D5:1 C5:1 B4:1 A4:1 G4:1 A4:1 B4:0.5 A4:0.5 F#4:1 G4:3' },
      { inst: 'harp', seq: 'G2:1 D3:1 B2:1 A2:1 D3:1 G2:1 D2:1 A2:1 F#2:1 G2:1 B2:1 D3:1 C3:1 E3:1 G2:1 G2:1 D3:1 B2:1 D2:1 F#2:1 A2:1 G2:1 D2:1 G2:1' },
    ] },
    present: { bpm: 116, tracks: [
      { inst: 'pizz', seq: x2('D2:1 A2:1 D3:1 A2:1 D2:1 A2:1 D3:1 A2:1 Bb1:1 F2:1 Bb2:1 F2:1 A1:1 E2:1 A2:1 C#3:1') },
      { inst: 'bassoon', seq: 'D4:0.5 -:0.5 F4:0.5 -:0.5 A4:1 G4:0.5 F4:0.5 E4:1 F4:0.5 E4:0.5 D4:2 Bb4:0.5 -:0.5 A4:0.5 -:0.5 G4:1 F4:1 E4:1 C#4:1 A3:2 D4:0.5 -:0.5 F4:0.5 -:0.5 A4:1 D5:1 C5:0.5 Bb4:0.5 A4:0.5 G4:0.5 A4:2 Bb4:1 G4:1 E4:1 C#4:1 D4:2 -:2' },
      { inst: 'drum', seq: Array(8).fill('K:1 H:1 S:1 H:1').join(' ') },
    ] },
    future: { bpm: 124, tracks: [
      { inst: 'arp', seq: x2('A3:0.5 C4:0.5 E4:0.5 A4:0.5 E4:0.5 C4:0.5 A3:0.5 C4:0.5 F3:0.5 A3:0.5 C4:0.5 F4:0.5 C4:0.5 A3:0.5 F3:0.5 A3:0.5 C4:0.5 E4:0.5 G4:0.5 C5:0.5 G4:0.5 E4:0.5 C4:0.5 E4:0.5 G3:0.5 B3:0.5 D4:0.5 G4:0.5 D4:0.5 B3:0.5 G3:0.5 B3:0.5') },
      { inst: 'synbass', seq: x2('A1:2 A2:2 F1:2 F2:2 C2:2 C3:2 G1:2 G2:2') },
      { inst: 'bell', seq: 'E5:2 D5:1 C5:1 A4:4 G4:2 C5:1 E5:1 D5:4 E5:2 G5:1 E5:1 F5:2 E5:1 C5:1 D5:2 B4:2 A4:4' },
      { inst: 'drum', seq: Array(8).fill('K:1 H:0.5 H:0.5 S:1 H:0.5 K:0.5').join(' ') },
    ] },
    ending: { bpm: 126, tracks: [
      { inst: 'bell', seq: x2('C5:1 E5:1 G5:1 E5:1 F5:1 A5:1 G5:2 E5:1 C5:1 D5:1 B4:1 C5:4') },
      { inst: 'pizz', seq: x2('C3:1 G2:1 C3:1 G2:1 F2:1 C3:1 G2:2 C3:1 A2:1 G2:1 G2:1 C3:4') },
      { inst: 'drum', seq: Array(8).fill('K:1 H:1 S:1 H:1').join(' ') },
    ] },
  };
  function parse(seq) {
    const ev = []; let b = 0;
    for (const tok of seq.trim().split(/\s+/)) {
      const [n, d] = tok.split(':'); const len = parseFloat(d || '1');
      if (n !== '-') ev.push({ b, n, len });
      b += len;
    }
    return { ev, len: b };
  }
  function scheduleLoop(t0) {
    const th = THEMES[cur]; if (!th) return;
    const spb = 60 / th.bpm;
    const lg = ac.createGain(); lg.gain.value = 1; lg.connect(musicBus);
    let maxLen = 0;
    for (const tr of th.tracks) {
      const p = tr._p || (tr._p = parse(tr.seq));
      maxLen = Math.max(maxLen, p.len);
      for (const e of p.ev) inst(tr.inst, e.n, t0 + e.b * spb, e.len * spb, lg);
    }
    loopEnd = t0 + maxLen * spb;
    loops.push({ g: lg, end: loopEnd + 1.5 });
    loops = loops.filter(l => { if (l.end < ac.currentTime) { try { l.g.disconnect(); } catch (e) { /* schon getrennt */ } return false; } return true; });
  }
  function tick() { if (ac && cur && ac.currentTime > loopEnd - 0.8) scheduleLoop(Math.max(loopEnd, ac.currentTime + 0.05)); }
  function stopMusic() {
    if (ac) for (const l of loops) { l.g.gain.setTargetAtTime(0, ac.currentTime, 0.08); const g = l.g; setTimeout(() => { try { g.disconnect(); } catch (e) { /* ok */ } }, 700); }
    loops = []; cur = null;
  }
  function play(name) {
    if (!ac) { wanted = name; return; }
    if (cur === name) return;
    stopMusic(); cur = name;
    if (name) scheduleLoop(ac.currentTime + 0.15);
  }
  function setMusic(on) { musicOn = on; if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.2 : 0, ac.currentTime, 0.1); }

  // ---------- Effekte ----------
  const SFX = {
    click: t => osc('square', 880, t, 0.04, 0.04, sfxBus, { decay: true }),
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
    door: t => { nz(t, 0.25, 0.4, sfxBus, { type: 'lowpass', f: 300 }); osc('sine', 90, t, 0.2, 0.2, sfxBus, { f2: 50, decay: true }); },
    fanfare: t => ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => osc('square', freq(n), t + i * 0.12, i === 3 ? 0.6 : 0.12, 0.06, sfxBus, { lp: 2500 })),
    run: t => { for (let i = 0; i < 8; i++) nz(t + i * 0.11, 0.05, 0.25, sfxBus, { type: 'bandpass', f: 600 + (i % 2) * 200, q: 2 }); },
    hearts: t => { for (let i = 0; i < 7; i++) osc('sine', 880 * Math.pow(1.19, i), t + i * 0.09, 0.3, 0.06, sfxBus, { decay: true }); },
    climb: t => { for (let i = 0; i < 5; i++) nz(t + i * 0.18, 0.12, 0.25, sfxBus, { type: 'bandpass', f: 1500, q: 1.5 }); },
    bake: t => ['E5', 'G5', 'C6'].forEach((n, i) => osc('sine', freq(n), t + i * 0.3, 0.5, 0.1, sfxBus, { decay: true })),
    bad: t => { osc('sawtooth', 220, t, 0.25, 0.07, sfxBus, { lp: 900, decay: true }); osc('sawtooth', 165, t + 0.25, 0.45, 0.07, sfxBus, { lp: 900, decay: true }); },
    click2: t => osc('triangle', 1200, t, 0.05, 0.08, sfxBus, { decay: true }),
  };
  function sfx(name) { if (!ac) return; const f = SFX[name]; if (f) f(ac.currentTime + 0.01); }

  return { init, play, sfx, setMusic, get musicOn() { return musicOn; } };
})();

// ---------- Sprachausgabe über die Web Speech API ----------
const Voice = (() => {
  const syn = window.speechSynthesis || null;
  let on = false, voice = null;
  function pick() {
    if (!syn) return;
    const vs = syn.getVoices();
    voice = vs.find(v => /^de/i.test(v.lang) && /natural|online|google/i.test(v.name)) || vs.find(v => /^de/i.test(v.lang)) || null;
  }
  if (syn) { pick(); if ('onvoiceschanged' in syn) syn.onvoiceschanged = pick; }
  function speak(text, prof) {
    return new Promise(res => {
      if (!syn || !on) return res();
      try {
        syn.cancel();
        const u = new SpeechSynthesisUtterance(text.replace(/\*/g, ''));
        u.lang = 'de-DE'; if (voice) u.voice = voice;
        u.pitch = prof && prof.pitch != null ? prof.pitch : 1;
        u.rate = prof && prof.rate != null ? prof.rate : 1;
        u.onend = () => res(); u.onerror = () => res();
        syn.speak(u);
      } catch (e) { res(); }
    });
  }
  function stop() { try { if (syn) syn.cancel(); } catch (e) { /* ok */ } }
  return {
    get on() { return on; }, set on(v) { on = !!v && !!syn; if (!on) stop(); },
    get available() { return !!syn; }, speak, stop,
  };
})();
