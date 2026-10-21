// Culture Shock SOUND CLASH pad: four sound-system effects (dub siren, air horn, laser, bomb drop) made live in the browser with the Web Audio API (no audio files).
// They play only on the listener's own device, on top of the music. Hold SIREN and AIR HORN to keep them going; LASER and BOMB fire once per push.
(function () {
  var card, ctx = null, master = null, FX = null;
  function station() { return window.UP1_STATION || '1up'; }

  // ---- the sounds: every builder takes (audio context, destination, start time) so they can also be rendered offline for tests ----
  function chain(c, out) {                      // dub echo: a dry path plus a darker repeating delay, then a limiter so stacked effects never clip
    var inp = c.createGain(), dry = c.createGain(), dl = c.createDelay(1), fb = c.createGain(), lp = c.createBiquadFilter(), wet = c.createGain(), comp = c.createDynamicsCompressor();
    dry.gain.value = 0.85; dl.delayTime.value = 0.3; fb.gain.value = 0.38; lp.type = 'lowpass'; lp.frequency.value = 1900; wet.gain.value = 0.5;
    inp.connect(dry); dry.connect(comp); inp.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(comp); comp.connect(out);
    return inp;
  }
  function siren(c, dst, t, hold) {              // returns stop(t2)
    var o = c.createOscillator(), lfo = c.createOscillator(), depth = c.createGain(), g = c.createGain();
    o.type = 'square'; lfo.type = 'triangle'; lfo.frequency.value = 3.2; depth.gain.value = 140;
    var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(980, t + 0.9);     // the siren winds up...
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
    lfo.connect(depth); depth.connect(o.frequency); o.connect(lp); lp.connect(g); g.connect(dst); o.start(t); lfo.start(t);
    return function (t2) {                       // ...and winds down when you let go
      t2 = Math.max(t2, t + 0.1);
      o.frequency.cancelScheduledValues(t2); o.frequency.setValueAtTime(Math.max(o.frequency.value, 300), t2); o.frequency.exponentialRampToValueAtTime(150, t2 + 1.4);
      g.gain.cancelScheduledValues(t2); g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t2); g.gain.exponentialRampToValueAtTime(0.0001, t2 + 1.4);
      o.stop(t2 + 1.5); lfo.stop(t2 + 1.5);
    };
  }
  function horn(c, dst, t) {
    var g = c.createGain(), lp = c.createBiquadFilter(), os = [];
    lp.type = 'lowpass'; lp.frequency.value = 2800; lp.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.075, t + 0.02);
    [[415, -6], [523, 4], [622, 0], [830, 7]].forEach(function (f) { var o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f[0]; o.detune.value = f[1]; o.connect(lp); o.start(t); os.push(o); });
    lp.connect(g); g.connect(dst);
    return function (t2) { t2 = Math.max(t2, t + 0.25); g.gain.cancelScheduledValues(t2); g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t2); g.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.18); os.forEach(function (o) { o.stop(t2 + 0.25); }); };
  }
  function laser(c, dst, t) {                    // three quick "pew"s
    for (var i = 0; i < 3; i++) {
      var s = t + i * 0.17, o = c.createOscillator(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(2600, s); o.frequency.exponentialRampToValueAtTime(160, s + 0.15);
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.34, s + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.16);
      o.connect(g); g.connect(dst); o.start(s); o.stop(s + 0.2);
    }
  }
  function bomb(c, dst, t) {                     // sub-bass drop with a burst of noise
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.7);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    o.connect(g); g.connect(dst); o.start(t); o.stop(t + 1.2);
    var n = c.createBufferSource(), b = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate), d = b.getChannelData(0), ng = c.createGain(), nf = c.createBiquadFilter();
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    n.buffer = b; nf.type = 'lowpass'; nf.frequency.setValueAtTime(900, t); nf.frequency.exponentialRampToValueAtTime(120, t + 0.45);
    ng.gain.setValueAtTime(0.35, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    n.connect(nf); nf.connect(ng); ng.connect(dst); n.start(t);
  }
  window.UP1_SOUNDCLASH = { siren: siren, horn: horn, laser: laser, bomb: bomb, chain: chain };

  function audio() {
    if (!ctx) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); master = chain(ctx, ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  var BTNS = [
    { id: 'horn', label: 'AIR HORN', sub: 'hold', color: '#e8312f', hold: true, run: horn },
    { id: 'siren', label: 'DUB SIREN', sub: 'hold', color: '#f5c518', hold: true, run: siren },
    { id: 'laser', label: 'LASER', sub: 'tap', color: '#1fa54a', hold: false, run: laser },
    { id: 'bomb', label: 'BOMB DROP', sub: 'tap', color: '#111', hold: false, run: bomb }
  ];
  function build() {
    var cols = document.querySelector('.cols'); if (!cols) return false;
    card = document.createElement('section'); card.className = 'card clash'; card.hidden = true;
    card.innerHTML = '<h2>Sound clash</h2><p class="clashnote">Hold or tap. Only you hear it, right over the music.</p><div class="clashpad"></div>';
    var pad = card.querySelector('.clashpad');
    BTNS.forEach(function (b) {
      var el = document.createElement('button'); el.type = 'button'; el.className = 'clashbtn'; el.setAttribute('data-fx', b.id); el.style.setProperty('--c', b.color);
      el.innerHTML = '<span>' + b.label + '</span><small>' + b.sub + '</small>'; pad.appendChild(el);
      var stop = null, down = false;
      function start(e) {
        if (e) e.preventDefault(); if (down) return; down = true; el.classList.add('on');
        var c = audio(); if (!c) return; var r = b.run(c, master, c.currentTime + 0.01);
        stop = (typeof r === 'function') ? r : null;
        if (!b.hold) setTimeout(function () { down = false; el.classList.remove('on'); }, 450);
      }
      function end() { if (!down || !b.hold) return; down = false; el.classList.remove('on'); if (stop && ctx) stop(ctx.currentTime); stop = null; }
      el.addEventListener('pointerdown', start); ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { el.addEventListener(ev, end); });
      el.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) start(e); });
      el.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') end(); });
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
    cols.parentNode.insertBefore(card, cols);
    return true;
  }
  function paint() { if (card) card.hidden = station() !== 'cultureshock'; }
  function init() { if (!build()) { if (init.n++ < 40) setTimeout(init, 300); return; } paint(); setInterval(paint, 1000); }
  init.n = 0;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
