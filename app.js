(function () {
  var $ = function (id) { return document.getElementById(id); };
  var S = { plays: [], delay: 420 }, yt = null, ready = false, started = false, playing = false, idx = -1, errs = 0, skipped = 0;
  // times shown are when each song plays for you: the same clock time it aired in Athens, on your local clock
  var fmtT = function (t) { return new Date((t + S.delay) * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
  var dayKey = function (t) { return new Date((t + S.delay) * 1000).toLocaleDateString('en-CA'); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function split(t) { var i = t.indexOf(' - '); return i > 0 ? [t.slice(0, i), t.slice(i + 3)] : ['', t]; }

  function load() {
    return fetch('schedule.json?t=' + Date.now()).then(function (r) { return r.json(); }).then(function (d) {
      var cur = idx >= 0 && S.plays[idx] ? S.plays[idx].t : null;
      S = d;
      if (cur !== null) { var k = S.plays.findIndex(function (p) { return p.t === cur; }); if (k >= 0) idx = k; }
      paintLists(); paintDays();
    });
  }
  function findNow() {
    var src = Date.now() / 1000 - S.delay, k = -1;
    for (var i = 0; i < S.plays.length; i++) { if (S.plays[i].t <= src) k = i; else break; }
    return k < 0 ? 0 : k;
  }
  function paintNP() {
    var p = curP || S.plays[idx]; if (!p) return; var a = split(p.title);
    $('npTitle').textContent = a[1] || p.title; $('npArtist').textContent = a[0];
    document.title = (playing ? '▶ ' : '') + (a[1] || p.title) + ' · 1UP Radio';
    paintSave();
    paintLists();
    if (typeof msMeta === 'function') msMeta();
  }
  function hb(p) { var on = isSaved(p); return '<button class="hb' + (on ? ' on' : '') + '" type="button" data-t="' + p.t + '" aria-pressed="' + on + '" title="' + (on ? 'Remove from saved songs' : 'Save song') + '">' + (on ? '♥' : '♡') + '</button>'; }
  function paintHearts() { document.querySelectorAll('.hb').forEach(function (b) { var p = S.plays.find(function (x) { return x.t === +b.dataset.t; }), on = isSaved(p); b.classList.toggle('on', on); b.textContent = on ? '♥' : '♡'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.title = on ? 'Remove from saved songs' : 'Save song'; }); }
  function paintLists() {
    var row = function (p, cls) { var a = split(p.title); return '<li class="' + (cls || '') + '"><time>' + fmtT(p.t) + '</time><span>' + esc(a[0] ? a[0] + ' — ' + a[1] : a[1]) + '</span>' + hb(p) + '</li>'; };
    var ref = idx >= 0 ? idx : (S.plays.length ? findNow() : -1);
    $('next').innerHTML = ref >= 0 ? S.plays.slice(ref + 1, ref + 7).map(function (p) { return row(p); }).join('') : '';
    $('prev').innerHTML = ref >= 0 ? S.plays.slice(Math.max(0, ref - 6), ref).reverse().map(function (p) { return row(p); }).join('') : '';
  }

  // ---- saved songs (kept in this browser) ----
  var SAVE_KEY = 'up1-saved', saved = [];
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || '[]') || []; } catch (e) { saved = []; }
  function persistSaved() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(saved)); } catch (e) {} }
  function isSaved(p) { return !!p && saved.some(function (s) { return s.id === p.id; }); }
  function paintSave() {
    var p = curP || S.plays[idx], b = $('saveBtn'); if (!b) return;
    b.disabled = !p; var on = isSaved(p);
    b.textContent = on ? '♥ Saved' : '♡ Save song'; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function paintSaved() {
    var el = $('saved'); if (!el) return; paintHearts();
    $('savedn').textContent = saved.length ? '(' + saved.length + ')' : '';
    $('savedhint').style.display = saved.length ? 'none' : '';
    el.innerHTML = saved.map(function (s, i) {
      var a = split(s.title);
      return '<li class="srow"><span>' + esc(a[0] ? a[0] + ' — ' + a[1] : a[1]) + '</span><a class="sgo" href="https://www.youtube.com/watch?v=' + encodeURIComponent(s.id) + '" target="_blank" rel="noopener" title="Open on YouTube">▶</a><button class="sdel" data-i="' + i + '" type="button" aria-label="Remove from saved songs" title="Remove">✕</button></li>';
    }).join('');
  }
  $('saveBtn').addEventListener('click', function () {
    var p = curP || S.plays[idx]; if (!p) return;
    var k = saved.findIndex(function (s) { return s.id === p.id; });
    if (k >= 0) saved.splice(k, 1); else saved.unshift({ id: p.id, title: p.title, at: Date.now() });
    persistSaved(); paintSave(); paintSaved();
  });
  $('saved').addEventListener('click', function (e) { var b = e.target.closest('.sdel'); if (!b) return; saved.splice(+b.dataset.i, 1); persistSaved(); paintSave(); paintSaved(); });
  document.addEventListener('click', function (e) {   // heart on any track row (week list, up next, just played)
    var b = e.target.closest('.hb'); if (!b) return;
    var p = S.plays.find(function (x) { return x.t === +b.dataset.t; }); if (!p) return;
    var n = saved.findIndex(function (s) { return s.id === p.id; });
    if (n >= 0) saved.splice(n, 1); else saved.unshift({ id: p.id, title: p.title, at: Date.now() });
    persistSaved(); paintSave(); paintSaved();
  });
  paintSaved();

  // ---- color themes: every tap on THEME switches to the next of 8 colors ----
  var THEMES = ['#39ff14', '#ffb000', '#ff3b3b', '#00e5ff', '#b4ff3c', '#ffe066', '#ff6a00', '#d946ff'], themeI = 0;
  var SKINS = ['retro', 'stream', 'glass', 'mono', 'synth', 'vinyl', 'terminal', 'brutal', 'aegean', 'gameboy', 'cassette', 'dash', 'space', 'marquee', 'blueprint', 'candy', 'glitch', 'press', 'meters', 'wormhole'], skinI = 0;
  var SKIN_NAMES = ['Retro', 'Stream', 'Glass', 'Mono', 'Synth', 'Vinyl', 'Terminal', 'Brutal', 'Aegean', 'GameBoy', 'Cassette', 'Dash', 'Space', 'Marquee', 'Blueprint', 'Candy', 'Glitch', 'Press', 'Meters', 'Wormhole'];
  var LIGHT = { glass: 1, aegean: 1, cassette: 1, candy: 1, press: 1 }, NATIVE_OK = { retro: 0, stream: 0 };   // light skins get a darker tint of the colour; every other skin can also go back to its own native colours (-1)
  function skinName() { return SKINS[skinI]; }
  function themeKey() { return skinName() === 'retro' ? 'up1-theme' : 'up1-theme-' + skinName(); }
  function applyTheme(i) {
    var sk = skinName(), canNative = !(sk in NATIVE_OK), st = document.documentElement.style;
    ['--g', '--gr', '--g2', '--line', '--bg2', '--ga', '--gb', '--gc', '--gd2'].forEach(function (p) { st.removeProperty(p); });
    if (i < 0 && canNative) themeI = -1; else themeI = ((i % THEMES.length) + THEMES.length) % THEMES.length;
    if (themeI >= 0) {
      var hex = THEMES[themeI], r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
      var mix = function (k, base) { return 'rgb(' + [r, g, b].map(function (v) { return Math.min(255, Math.round(v * k + base)); }).join(',') + ')'; };
      if (sk === 'gameboy') {     // the four Game Boy tones, rebuilt from the chosen colour
        st.setProperty('--ga', mix(0.16, 0)); st.setProperty('--gb', mix(0.38, 0)); st.setProperty('--gc', mix(0.62, 40)); st.setProperty('--gd2', mix(0.66, 55));
      } else {
        var k = LIGHT[sk] ? 0.62 : 1, rr = Math.round(r * k), gg = Math.round(g * k), bb = Math.round(b * k);
        st.setProperty('--g', 'rgb(' + rr + ',' + gg + ',' + bb + ')'); st.setProperty('--gr', rr + ',' + gg + ',' + bb);
        if (!LIGHT[sk] && (sk === 'retro' || sk === 'stream' || sk === 'synth' || sk === 'vinyl' || sk === 'terminal' || sk === 'dash' || sk === 'space' || sk === 'marquee' || sk === 'blueprint' || sk === 'glitch' || sk === 'wormhole')) st.setProperty('--g2', mix(0.45, 140));
        if (sk === 'retro' || sk === 'stream') { st.setProperty('--line', mix(0.16, 6)); st.setProperty('--bg2', mix(0.035, 9)); }
      }
    }
    if (themeI >= 0) document.documentElement.setAttribute('data-themed', ''); else document.documentElement.removeAttribute('data-themed');
    try { localStorage.setItem(themeKey(), String(themeI)); } catch (e) {}
  }
  function storedTheme() { try { var v = localStorage.getItem(themeKey()); if (v !== null) return +v; } catch (e) {} return (skinName() in NATIVE_OK) ? 0 : -1; }
  function setBars(n) {   // the meter bridge: 12 bars normally, a whole wall of them in the Meters skin (each its own colour, speed and height)
    var eq = $('eq'); if (!eq) return; var want = n || 12;
    if (eq.children.length !== want || (n && !eq.firstChild.style.getPropertyValue('--bc')) || (!n && eq.firstChild.getAttribute('style'))) {
      var html = ''; for (var i = 0; i < want; i++) html += n ? '<i style="--bc:hsl(' + Math.round(i * 360 / want) + ',95%,55%);--d:' + (0.45 + Math.random() * 0.9).toFixed(2) + 's;--dl:-' + (Math.random() * 1.6).toFixed(2) + 's;--hh:' + Math.round(55 + Math.random() * 45) + '%"></i>' : '<i></i>';
      eq.innerHTML = html;
    }
  }
  // ---- wormhole skin: a canvas flight down a glowing tunnel (rings, warp streaks, a spaceship, and meter bars) ----
  var wc = null, wx = null, wRaf = 0, wLast = 0, wZ = 0, wSpeed = 0.35, wStars = [], wHue = 270, wHueAt = 0, wDpr = 1;
  function wormHue(t) {   // rainbow-ish violet/blue/magenta by default; the chosen THEME colour when one is picked
    if (t - wHueAt > 0.5) { wHueAt = t; if (document.documentElement.hasAttribute('data-themed')) { var gr = (getComputedStyle(document.documentElement).getPropertyValue('--gr') || '169,139,255').split(',').map(Number), r = gr[0] / 255, g = gr[1] / 255, b = gr[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0; if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; } wHue = h; wThemed = true; } else { wThemed = false; } }
    return wHue;
  }
  var wThemed = false;
  function wormSize() { if (!wc) return; wDpr = Math.min(window.devicePixelRatio || 1, 1.5); wc.width = Math.round(innerWidth * wDpr); wc.height = Math.round(innerHeight * wDpr); }
  function wLevel(i, t, n) {   // fake spectrum (the YouTube player will not let the page hear the sound): lively while playing, calm when paused
    var p = playing ? 1 : 0.18, v = 0.35 + 0.3 * Math.sin(t * (1.4 + i * 0.11) + i * 1.7) + 0.25 * Math.abs(Math.sin(t * 2.3 + i * 0.63));
    var beat = playing ? Math.pow(Math.abs(Math.sin(t * 2.15)), 8) * (1 - i / n * 0.6) : 0;
    return Math.max(0.03, Math.min(1, (v * p + beat * 0.55)));
  }
  function wormFrame(ts) {
    wRaf = requestAnimationFrame(wormFrame);
    if (!wc || document.hidden) return;
    var t = ts / 1000, dt = Math.min(0.05, (ts - wLast) / 1000 || 0.016); wLast = ts;
    wSpeed += ((playing ? 1 : 0.35) - wSpeed) * Math.min(1, dt * 2);
    var W = wc.width, H = wc.height, cx = W / 2, cy = H * 0.45, M = Math.min(W, H), ctx = wx, hue0 = wormHue(t), sw = wThemed ? 28 : 70;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(2,2,12,0.32)'; ctx.fillRect(0, 0, W, H);
    wZ = (wZ + dt * 0.5 * wSpeed) % 1;
    var ang0 = t * 0.18 * (0.5 + wSpeed), k, a;
    ctx.globalCompositeOperation = 'lighter';
    var N = 26, prev = null;
    for (k = 0; k < N; k++) {                       // rings: small and far at the centre, big and near at the edge
      var u = (k + wZ) / N, r = Math.pow(u, 2.3) * Math.hypot(W, H) * 0.62, ox = Math.sin(t * 0.7 + u * 3.2) * W * 0.07 * (1 - u), oy = Math.cos(t * 0.9 + u * 2.6) * H * 0.05 * (1 - u);
      var hue = (hue0 + sw * Math.sin(u * 6 + t * 0.6)) % 360;
      ctx.strokeStyle = 'hsla(' + hue + ',100%,' + (48 + u * 14) + '%,' + (0.12 + u * 0.55) + ')'; ctx.lineWidth = (1 + u * 6) * wDpr;
      ctx.beginPath(); ctx.arc(cx + ox, cy + oy, Math.max(1, r), 0, 6.2832); ctx.stroke();
      if (prev && k % 2 === 0) {                    // tunnel ribs between neighbouring rings
        ctx.lineWidth = wDpr; ctx.strokeStyle = 'hsla(' + hue + ',100%,60%,' + (0.08 + u * 0.18) + ')';
        ctx.beginPath(); for (a = 0; a < 12; a++) { var an = a / 12 * 6.2832 + ang0 * (1 + u); ctx.moveTo(prev.x + Math.cos(an) * prev.r, prev.y + Math.sin(an) * prev.r); ctx.lineTo(cx + ox + Math.cos(an) * r, cy + oy + Math.sin(an) * r); } ctx.stroke();
      }
      prev = { x: cx + ox, y: cy + oy, r: Math.max(1, r) };
    }
    if (!wStars.length) for (k = 0; k < 110; k++) wStars.push({ a: Math.random() * 6.2832, r: Math.random(), s: 0.3 + Math.random() * 0.9 });
    ctx.lineCap = 'round';
    for (k = 0; k < wStars.length; k++) {           // warp streaks flying past
      var st = wStars[k]; st.r += dt * (0.25 + st.s) * (0.5 + wSpeed * 1.6) * (0.2 + st.r); if (st.r > 1.1) { st.r = 0.02; st.a = Math.random() * 6.2832; }
      var r1 = st.r * Math.hypot(W, H) * 0.55, r2 = r1 + (4 + st.r * 38 * wSpeed) * wDpr;
      ctx.strokeStyle = 'hsla(' + ((hue0 + k * 3) % 360) + ',90%,80%,' + Math.min(0.9, st.r * 1.2) + ')'; ctx.lineWidth = (0.6 + st.r * 2) * wDpr;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(st.a + ang0) * r1, cy + Math.sin(st.a + ang0) * r1); ctx.lineTo(cx + Math.cos(st.a + ang0) * r2, cy + Math.sin(st.a + ang0) * r2); ctx.stroke();
    }
    var gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, M * 0.2); gl.addColorStop(0, 'rgba(255,255,255,0.95)'); gl.addColorStop(0.25, 'hsla(' + hue0 + ',100%,65%,0.55)'); gl.addColorStop(1, 'hsla(' + hue0 + ',100%,50%,0)');
    ctx.fillStyle = gl; ctx.fillRect(cx - M * 0.2, cy - M * 0.2, M * 0.4, M * 0.4);
    var NB = 56, R0 = M * 0.2;                      // meter ring around the tunnel mouth
    ctx.lineWidth = Math.max(2, M * 0.009);
    for (k = 0; k < NB; k++) {
      var lv = wLevel(k % 28, t, 28), an2 = k / NB * 6.2832 + ang0 * 0.5, len = M * (0.02 + lv * 0.2);
      ctx.strokeStyle = 'hsl(' + ((wThemed ? hue0 + (k % 8) * 5 : k / NB * 360 + t * 20) % 360) + ',100%,' + (50 + lv * 18) + '%)';
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(an2) * R0, cy + Math.sin(an2) * R0 * 0.9); ctx.lineTo(cx + Math.cos(an2) * (R0 + len), cy + Math.sin(an2) * (R0 + len) * 0.9); ctx.stroke();
    }
    var NF = 44, bw = W / NF;                       // meter bars along the bottom edge
    for (k = 0; k < NF; k++) {
      var lf = wLevel(k % 22, t + k * 0.05, 22), bh = lf * H * 0.3;
      var gb = ctx.createLinearGradient(0, H, 0, H - bh); var hh = (wThemed ? hue0 + (k % 6) * 6 : k / NF * 360 + t * 20) % 360; gb.addColorStop(0, 'hsla(' + hh + ',100%,55%,0.65)'); gb.addColorStop(1, 'hsla(' + hh + ',100%,65%,0.05)');
      ctx.fillStyle = gb; ctx.fillRect(k * bw + bw * 0.12, H - bh, bw * 0.76, bh);
    }
    ctx.globalCompositeOperation = 'source-over';   // the ship, seen from behind, banking gently
    var sx = cx + Math.sin(t * 0.8) * W * 0.05, sy = H * 0.66 + Math.sin(t * 1.3) * H * 0.012, s = M / 480 * wDpr / wDpr * 1, bank = Math.sin(t * 0.8) * 0.16;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(bank); ctx.scale(s * 1.15, s * 1.15);
    var fl = 26 + Math.random() * 14 + wSpeed * 22, fg = ctx.createLinearGradient(0, 24, 0, 24 + fl * 2); fg.addColorStop(0, 'rgba(255,255,255,.95)'); fg.addColorStop(0.3, 'hsla(' + ((hue0 + 160) % 360) + ',100%,62%,.8)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(-10, 24); ctx.lineTo(0, 24 + fl * 2); ctx.lineTo(10, 24); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(11, -10); ctx.lineTo(44, 20); ctx.lineTo(15, 16); ctx.lineTo(9, 28); ctx.lineTo(-9, 28); ctx.lineTo(-15, 16); ctx.lineTo(-44, 20); ctx.lineTo(-11, -10); ctx.closePath();
    var bg = ctx.createLinearGradient(-40, -40, 40, 30); bg.addColorStop(0, '#f3f6ff'); bg.addColorStop(1, '#6a77a6'); ctx.fillStyle = bg; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'hsla(' + hue0 + ',100%,75%,.9)'; ctx.stroke();
    ctx.fillStyle = 'hsl(' + ((hue0 + 160) % 360) + ',100%,60%)'; ctx.beginPath(); ctx.ellipse(0, -8, 5, 11, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'hsla(' + hue0 + ',100%,70%,.9)'; ctx.fillRect(-30, 18, 8, 3); ctx.fillRect(22, 18, 8, 3);
    ctx.restore();
  }
  function wormhole(on) {
    if (on) {
      wc = $('wh'); if (!wc) return; if (!wx) wx = wc.getContext('2d'); wormSize();
      if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { wLast = 0; wormFrame(1000); cancelAnimationFrame(wRaf); return; }
      if (!wRaf) wRaf = requestAnimationFrame(wormFrame);
    } else if (wRaf) { cancelAnimationFrame(wRaf); wRaf = 0; }
  }
  addEventListener('resize', function () { if (wRaf) wormSize(); });
  function applySkin(i) {
    skinI = ((i % SKINS.length) + SKINS.length) % SKINS.length;
    if (SKINS[skinI] === 'retro') document.documentElement.removeAttribute('data-skin'); else document.documentElement.setAttribute('data-skin', SKINS[skinI]);
    try { localStorage.setItem('up1-skin', String(skinI)); } catch (e) {}
    applyTheme(storedTheme());
    setBars(SKINS[skinI] === 'meters' ? 36 : 0);
    wormhole(SKINS[skinI] === 'wormhole');
    if ($('skinName')) $('skinName').textContent = SKIN_NAMES[skinI];
  }
  try { skinI = +(localStorage.getItem('up1-skin') || 0) || 0; } catch (e) {}
  applySkin(skinI);
  $('themeBtn').addEventListener('click', function () { var n = themeI + 1; if (n >= THEMES.length) n = (skinName() in NATIVE_OK) ? 0 : -1; applyTheme(n); });
  if ($('skinBtn')) $('skinBtn').addEventListener('click', function () { applySkin(skinI + 1); });

  window.__up1 = { chimeNow: function (h) { chimeNow(h); }, get chimeOn() { return chimeOn; }, get chimeT() { return chime.currentTime; }, get chimeErr() { return chime.error && chime.error.code; }, get idx() { return idx; }, get curP() { return curP; }, get S() { return S; }, get badIds() { return badIds; }, replay: function () { playIdx(idx, Date.now() / 1000 - S.delay - S.plays[idx].t, 0); } };
  var selDay = null;
  function paintDays() {
    var keys = []; S.plays.forEach(function (p) { var k = dayKey(p.t); if (keys.indexOf(k) < 0) keys.push(k); });
    if (!selDay || keys.indexOf(selDay) < 0) selDay = keys[keys.length - 1];
    $('days').innerHTML = keys.map(function (k) { var d = new Date(k + 'T12:00:00Z'); return '<button data-k="' + k + '" class="' + (k === selDay ? 'on' : '') + '">' + d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) + '</button>'; }).join('');
    var list = S.plays.filter(function (p) { return dayKey(p.t) === selDay; });
    var curT = idx >= 0 && S.plays[idx] ? S.plays[idx].t : -1;
    $('daylist').innerHTML = list.map(function (p) { var a = split(p.title); return '<li class="' + (p.t === curT ? 'now' : '') + '"><time>' + fmtT(p.t) + '</time><span>' + esc(a[0] ? a[0] + ' — ' + a[1] : a[1]) + '</span>' + hb(p) + '</li>'; }).join('');
    $('tznote').textContent = 'Keep the volume up. Times are shown in your local time (' + new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() + ').';
  }
  $('days').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; selDay = b.dataset.k; paintDays(); });

  var nextTimer = null, badIds = {}, curAlt = 0, curP = null;
  // ---- dead-air filler: when a song ends and the next slot is still a few seconds away, play station-ID jingles that finish before the next song starts ----
  var JINGLES = [{"f": "assets/jingles/j1.mp3", "d": 5.39}, {"f": "assets/jingles/j2.mp3", "d": 5.2}, {"f": "assets/jingles/j3.mp3", "d": 6.04}, {"f": "assets/jingles/j4.mp3", "d": 3.39}, {"f": "assets/jingles/j5.mp3", "d": 4.94}, {"f": "assets/jingles/j6.mp3", "d": 3.5}], jing = new Audio(), jingOn = false, jingUnlocked = false;
  jing.preload = 'auto';
  function stopJingle() { if (!jingOn) return; jingOn = false; try { jing.pause(); } catch (e) {} }
  function unlockJingle() {
    if (jingUnlocked || !JINGLES.length) return; jingUnlocked = true;
    try { jing.src = JINGLES[0].f; jing.muted = true; var pr = jing.play(); var done = function () { try { jing.pause(); jing.currentTime = 0; } catch (e) {} jing.muted = false; }; if (pr && pr.then) pr.then(done, function () { jing.muted = false; jingUnlocked = false; }); else done(); } catch (e) { jing.muted = false; }
  }
  function fillGap(wait, n) {
    if (!JINGLES.length || !gestured || chimeOn || jingOn || wait < 3.4) return;
    var left = wait - 0.5, seed = ((n * 2654435761) >>> 0), list = [], k = 0;
    while (left >= 3.2 && k < 3) { var fit = JINGLES.filter(function (j) { return j.d <= left; }); if (!fit.length) break; var pick = fit[(seed + k * 7) % fit.length]; list.push(pick); left -= pick.d + 0.4; k++; }
    if (!list.length) return;
    jingOn = true; var i = 0;
    (function step() {
      if (!jingOn || i >= list.length) { jingOn = false; return; }
      jing.onended = function () { if (jingOn) setTimeout(step, 300); }; jing.onerror = function () { jingOn = false; };
      jing.src = list[i++].f; jing.volume = 1; var pr = jing.play(); if (pr && pr.catch) pr.catch(function () { jingOn = false; });
    })();
  }

  function clearNext() { if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; } }
  // If YouTube will not play a song here, EVERY listener swaps in the same replacement for that slot (picked from the schedule by a fixed rule), so everyone stays in step.
  function altIdx(i, n) { var lo = Math.max(0, i - 900), hi = Math.max(lo + 1, i - 40), len = hi - lo; return lo + ((((i * 2654435761 + n * 40503 + 7) % len) + len) % len); }
  function slotPlay(i, n) { return n === 0 ? S.plays[i] : S.plays[altIdx(i, n)]; }
  function playIdx(i, offset, n) {
    clearNext(); stopJingle();
    if (!S.plays.length) return;
    if (i >= S.plays.length) { i = Math.max(0, S.plays.length - 40 + Math.floor(Math.random() * 30)); offset = 0; n = 0; }   // out of schedule: loop back over recent music
    n = n || 0; var p = slotPlay(i, n);
    while (n < 8 && badIds[p.id]) { n++; p = slotPlay(i, n); }
    idx = i; curAlt = n; curP = p; offset = Math.max(0, Math.floor(offset || 0));
    paintNP();
    if (offset > p.dur - 5 && i + 1 < S.plays.length) { next(); return; }       // this song is basically over: wait for the next slot
    yt.loadVideoById({ videoId: p.id, startSeconds: offset });
  }
  // after a song ends, the next one starts exactly when the schedule says it begins (never early), so every listener hears the same thing
  function next() {
    if (!started) return;
    var n = idx + 1;
    if (n >= S.plays.length) { playIdx(n, 0); return; }
    var wait = (S.plays[n].t + S.delay) - Date.now() / 1000;
    clearNext();
    if (wait > 3.4) fillGap(wait, n);
    if (wait > 1) nextTimer = setTimeout(function () { nextTimer = null; stopJingle(); playIdx(n, 0); }, wait * 1000);
    else playIdx(n, Math.max(0, -wait));
  }
  function setOn(on) {
    playing = on; $('play').classList.toggle('on', on); $('eq').classList.toggle('on', on); $('onair').classList.toggle('on', on);
    $('onairtxt').textContent = on ? 'ON AIR' : (started ? 'PAUSED' : 'OFF AIR'); $('play').setAttribute('aria-label', on ? 'Pause 1UP Radio' : 'Play 1UP Radio'); paintNP();
  }
  function init() {
    yt = new YT.Player('ytp', { width: 200, height: 200, host: 'https://www.youtube-nocookie.com', playerVars: { playsinline: 1, rel: 0, controls: 0, disablekb: 1, origin: location.origin }, events: {
      onReady: function () { ready = true; yt.setVolume(+$('vol').value); if (started) playIdx(findNow(), (Date.now() / 1000 - S.delay) - S.plays[findNow()].t); if (gestured) { try { yt.unMute(); } catch (e) {} } },
      onStateChange: function (e) { var st = YT.PlayerState; if (e.data === st.PLAYING) { errs = 0; setOn(true); } else if (e.data === st.PAUSED) setOn(false); else if (e.data === st.ENDED) next(); },
      onError: function () { if (curP) badIds[curP.id] = 1; if (++errs < 8) playIdx(idx, Date.now() / 1000 - S.delay - S.plays[idx].t, curAlt + 1); else { setOn(false); $('hint').textContent = 'Having trouble reaching the music. Please try again in a minute.'; } } } });
  }
  var unmutedAt = 0, gestured = false, lastKick = 0, apiTag = null;
  function loadApi() { if (apiTag || (window.YT && YT.Player)) return; apiTag = document.createElement('script'); apiTag.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(apiTag); }
  window.onYouTubeIframeAPIReady = function () { if (started && !yt) init(); };
  loadApi();
  $('play').addEventListener('click', function () {
    if (Date.now() - unmutedAt < 700) return;
    if (!S.plays.length) return;
    if (!started) {
      started = true; $('hint').textContent = 'You are live with the station. Keep the volume up.'; $('npTitle').textContent = 'Tuning in…';
      if (window.YT && YT.Player) { if (!yt) init(); else { var k = findNow(); playIdx(k, Date.now() / 1000 - S.delay - S.plays[k].t); } }
      else { window.onYouTubeIframeAPIReady = function () { if (!yt) init(); }; loadApi(); }
      return;
    }
    if (!ready) return; if (playing) yt.pauseVideo(); else yt.playVideo();
  });
  $('vol').addEventListener('input', function (e) { $('volv').textContent = e.target.value; if (yt && ready) yt.setVolume(+e.target.value); try { localStorage.setItem('up1-vol', e.target.value); } catch (x) {} });
  try { var v = localStorage.getItem('up1-vol'); if (v) { $('vol').value = v; $('volv').textContent = v; } } catch (x) {}
  // keep exactly in step with the live schedule: after a pause, a stall or a schedule change, jump back to the live position
  var lastSync = 0;
  setInterval(function () {
    if (!started || !playing || !yt || !ready || idx < 0 || !S.plays[idx] || nextTimer || Date.now() - lastSync < 20000) return;
    try {
      var now = Date.now() / 1000 - S.delay, k = findNow();
      if (k !== idx) { lastSync = Date.now(); playIdx(k, now - S.plays[k].t); return; }          // wrong song for this moment: jump to what is on air
      var expected = now - S.plays[idx].t, cur = yt.getCurrentTime(), dur = yt.getDuration();
      if (dur && expected < dur - 5 && Math.abs(cur - expected) > 20) { lastSync = Date.now(); yt.seekTo(expected, true); }   // paused or stalled: catch up to live
    } catch (x) {}
  }, 6000);
  setInterval(function () { if (!playing || !yt || !ready) return; try { var d = yt.getDuration(), c = yt.getCurrentTime(); if (d) $('npFill').style.width = Math.min(100, c / d * 100) + '%'; } catch (x) {} }, 500);

  // ---- hourly station ID: church bell, "The time is now ...", "One Up Radio. Keep the volume up." on the listener's local hour ----
  var chime = new Audio(), chimeOn = false, chimeUnlocked = false, chimeHour = -1, chimeKey = '', IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  chime.preload = 'auto';
  function chimeSrc(h) { return 'assets/chimes/chime-' + (h % 12 || 12) + '.mp3'; }   // 12 clips: the bell, "the time is now N o'clock", the station ID
  function chimePrep(h) { if (chimeHour !== h) { chimeHour = h; chime.src = chimeSrc(h); try { chime.load(); } catch (e) {} } }
  function unlockChime() {            // phones only let a sound play later if one was started inside a real tap: start it silently once
    if (chimeUnlocked) return; chimeUnlocked = true;
    try { chimePrep((new Date().getHours() + 1) % 24); chime.muted = true; var pr = chime.play(); var done = function () { try { chime.pause(); chime.currentTime = 0; } catch (e) {} chime.muted = false; }; if (pr && pr.then) pr.then(done, function () { chime.muted = false; chimeUnlocked = false; }); else done(); } catch (e) { chime.muted = false; }
  }
  function chimeEnd() {
    if (!chimeOn) return; chimeOn = false;
    try { if (IOS) { var k = findNow(); playIdx(k, Date.now() / 1000 - S.delay - S.plays[k].t); } else yt.setVolume(+$('vol').value); } catch (e) {}
  }
  function chimeNow(h) {
    if (chimeOn || !started || !playing || !yt || !ready) return;
    chimeOn = true; chimePrep(h); chime.muted = false; chime.currentTime = 0; chime.volume = 1;
    try { if (IOS) yt.pauseVideo(); else yt.setVolume(Math.max(6, Math.round(+$('vol').value * 0.12))); } catch (e) {}
    var pr = chime.play(); if (pr && pr.catch) pr.catch(chimeEnd);
    setTimeout(chimeEnd, 16000);
  }
  chime.addEventListener('ended', chimeEnd); chime.addEventListener('error', chimeEnd);
  setInterval(function () {
    var d = new Date(), h = d.getHours();
    if (d.getMinutes() === 59 && d.getSeconds() > 30) chimePrep((h + 1) % 24);
    if (d.getMinutes() === 0 && d.getSeconds() < 4) { var key = d.toDateString() + h; if (key !== chimeKey) { chimeKey = key; chimeNow(h); } }
  }, 500);

  // ---- phone lock screen / background: Media Session (title, artwork, play/pause buttons) + a silent looping sound that keeps the page's audio session alive, and a jump back to live whenever the phone wakes the page up ----
  var userPaused = false, keep = new Audio('assets/silence.mp3'); keep.loop = true; keep.setAttribute('playsinline', '');
  $('play').addEventListener('click', function () { userPaused = playing; }, true);
  function keepSync() { try { if (started && gestured && !userPaused) { var pr = keep.play(); if (pr && pr.catch) pr.catch(function () {}); } else keep.pause(); } catch (e) {} }
  function goLive() { if (!started || !ready || !S.plays.length) return; userPaused = false; try { var k = findNow(); playIdx(k, Date.now() / 1000 - S.delay - S.plays[k].t); } catch (e) {} keepSync(); }
  var MS = 'mediaSession' in navigator ? navigator.mediaSession : null;
  function msMeta() {
    if (!MS || typeof MediaMetadata === 'undefined') return; var p = curP || S.plays[idx]; if (!p) return; var a = split(p.title);
    try { MS.metadata = new MediaMetadata({ title: a[1] || p.title, artist: a[0] || '1UP Radio', album: '1UP Radio · Keep the volume up', artwork: [{ src: 'assets/logo.png', sizes: '512x512', type: 'image/png' }] }); MS.playbackState = playing ? 'playing' : 'paused'; } catch (e) {}
  }
  if (MS) {
    try { MS.setActionHandler('play', function () { if (!started) { $('play').click(); return; } goLive(); }); } catch (e) {}
    try { MS.setActionHandler('pause', function () { userPaused = true; try { yt.pauseVideo(); } catch (e) {} keepSync(); }); } catch (e) {}
    try { MS.setActionHandler('stop', function () { userPaused = true; try { yt.pauseVideo(); } catch (e) {} keepSync(); }); } catch (e) {}
    try { MS.setActionHandler('nexttrack', null); MS.setActionHandler('previoustrack', null); } catch (e) {}
  }
  setInterval(function () { msMeta(); keepSync(); }, 2000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && started && !playing && !userPaused && !chimeOn) goLive(); });
  addEventListener('pageshow', function () { if (started && !playing && !userPaused && !chimeOn) goLive(); });
  // open playing: start on load; browsers block sound before the first tap, so fall back to silent autoplay and unmute on the first touch
  var mutedAuto = false;
  function unmuteNow(ev) {
    var t = ev && ev.type, tap = !!(ev && ev.isTrusted) && (t === 'click' || t === 'touchend' || t === 'pointerup' || t === 'keydown');
    if (ev && ev.isTrusted) gestured = true;
    if (tap) { unlockChime(); unlockJingle(); if (typeof keepSync === 'function') keepSync(); }
    if (tap && yt && ready) {                                   // phones only allow sound inside a real tap: unmute / (re)start right here, in the tap
      try { if (yt.isMuted()) { yt.unMute(); yt.setVolume(+$('vol').value); } } catch (e) {}
      if (started && !playing && Date.now() - lastKick > 1500) { lastKick = Date.now(); try { yt.unMute(); var k = findNow(); playIdx(k, Date.now() / 1000 - S.delay - S.plays[k].t); } catch (e) {} }
    }
    if (!mutedAuto) { if (started && ready && !playing && !tap) { try { yt.playVideo(); } catch (e) {} } return; }
    mutedAuto = false; unmutedAt = Date.now(); try { yt.unMute(); yt.setVolume(+$('vol').value); if (yt.getPlayerState() !== 1) yt.playVideo(); } catch (e) {} $('hint').textContent = 'You are live with the station. Keep the volume up.';
  }
  ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'keydown'].forEach(function (ev) { addEventListener(ev, unmuteNow, { passive: true, capture: true }); });
  load().then(function () {
    var k = findNow(); idx = -1; paintLists();
    $('play').click();
    [3500, 8000].forEach(function (ms) {
      setTimeout(function () {
        if (playing || mutedAuto || !yt || !ready) return; if (gestured) { try { yt.unMute(); yt.playVideo(); } catch (e) {} return; }
        try { yt.mute(); yt.playVideo(); mutedAuto = true; $('hint').textContent = 'Tap anywhere to turn the sound on.'; } catch (e) {}
      }, ms);
    });
  });
  setInterval(load, 3 * 60 * 1000);
})();

;(function(){var g=document.getElementById("tapgate");if(!g)return;function go(e){if(!g||!e.isTrusted)return;if(e.type==="click"){e.preventDefault();e.stopPropagation()}g.remove();g=null}window.addEventListener("click",go,true);window.addEventListener("keydown",go,true)})();

