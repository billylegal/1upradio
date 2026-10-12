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
    var p = S.plays[idx]; if (!p) return; var a = split(p.title);
    $('npTitle').textContent = a[1] || p.title; $('npArtist').textContent = a[0];
    document.title = (playing ? '▶ ' : '') + (a[1] || p.title) + ' · 1UP Radio';
    paintSave();
    paintLists();
  }
  function paintLists() {
    var row = function (p, cls) { var a = split(p.title); return '<li class="' + (cls || '') + '"><time>' + fmtT(p.t) + '</time><span>' + esc(a[0] ? a[0] + ' — ' + a[1] : a[1]) + '</span></li>'; };
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
    var p = S.plays[idx], b = $('saveBtn'); if (!b) return;
    b.disabled = !p; var on = isSaved(p);
    b.textContent = on ? '♥ Saved' : '♡ Save song'; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function paintSaved() {
    var el = $('saved'); if (!el) return;
    $('savedn').textContent = saved.length ? '(' + saved.length + ')' : '';
    $('savedhint').style.display = saved.length ? 'none' : '';
    el.innerHTML = saved.map(function (s, i) {
      var a = split(s.title);
      return '<li class="srow"><span>' + esc(a[0] ? a[0] + ' — ' + a[1] : a[1]) + '</span><a class="sgo" href="https://www.youtube.com/watch?v=' + encodeURIComponent(s.id) + '" target="_blank" rel="noopener" title="Open on YouTube">▶</a><button class="sdel" data-i="' + i + '" type="button" aria-label="Remove from saved songs" title="Remove">✕</button></li>';
    }).join('');
  }
  $('saveBtn').addEventListener('click', function () {
    var p = S.plays[idx]; if (!p) return;
    var k = saved.findIndex(function (s) { return s.id === p.id; });
    if (k >= 0) saved.splice(k, 1); else saved.unshift({ id: p.id, title: p.title, at: Date.now() });
    persistSaved(); paintSave(); paintSaved();
  });
  $('saved').addEventListener('click', function (e) { var b = e.target.closest('.sdel'); if (!b) return; saved.splice(+b.dataset.i, 1); persistSaved(); paintSave(); paintSaved(); });
  paintSaved();
  var selDay = null;
  function paintDays() {
    var keys = []; S.plays.forEach(function (p) { var k = dayKey(p.t); if (keys.indexOf(k) < 0) keys.push(k); });
    if (!selDay || keys.indexOf(selDay) < 0) selDay = keys[keys.length - 1];
    $('days').innerHTML = keys.map(function (k) { var d = new Date(k + 'T12:00:00Z'); return '<button data-k="' + k + '" class="' + (k === selDay ? 'on' : '') + '">' + d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) + '</button>'; }).join('');
    var list = S.plays.filter(function (p) { return dayKey(p.t) === selDay; });
    var curT = idx >= 0 && S.plays[idx] ? S.plays[idx].t : -1;
    $('daylist').innerHTML = list.map(function (p) { var a = split(p.title); return '<li class="' + (p.t === curT ? 'now' : '') + '"><time>' + fmtT(p.t) + '</time><span>' + esc(a[0] ? a[0] + ' — ' + a[1] : a[1]) + '</span></li>'; }).join('');
    $('tznote').textContent = 'Keep the volume up. Times are shown in your local time (' + new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() + ').';
  }
  $('days').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; selDay = b.dataset.k; paintDays(); });

  function playIdx(i, offset) {
    if (!S.plays.length) return;
    if (i >= S.plays.length) i = Math.max(0, S.plays.length - 40 + Math.floor(Math.random() * 30));   // out of schedule: loop back over recent music
    idx = i; var p = S.plays[i]; offset = Math.max(0, Math.floor(offset || 0));
    if (offset > p.dur - 25) { offset = 0; idx = Math.min(i + 1, S.plays.length - 1); p = S.plays[idx]; }
    paintNP();
    yt.loadVideoById({ videoId: p.id, startSeconds: offset });
  }
  function next() { if (!started) return; playIdx(idx + 1, 0); }
  function setOn(on) {
    playing = on; $('play').classList.toggle('on', on); $('eq').classList.toggle('on', on); $('onair').classList.toggle('on', on);
    $('onairtxt').textContent = on ? 'ON AIR' : (started ? 'PAUSED' : 'OFF AIR'); $('play').setAttribute('aria-label', on ? 'Pause 1UP Radio' : 'Play 1UP Radio'); paintNP();
  }
  function init() {
    yt = new YT.Player('ytp', { width: 200, height: 200, host: 'https://www.youtube-nocookie.com', playerVars: { playsinline: 1, rel: 0, controls: 0, disablekb: 1, origin: location.origin }, events: {
      onReady: function () { ready = true; yt.setVolume(+$('vol').value); if (started) playIdx(findNow(), (Date.now() / 1000 - S.delay) - S.plays[findNow()].t); },
      onStateChange: function (e) { var st = YT.PlayerState; if (e.data === st.PLAYING) { errs = 0; setOn(true); } else if (e.data === st.PAUSED) setOn(false); else if (e.data === st.ENDED) next(); },
      onError: function () { if (++errs < 8) next(); else { setOn(false); $('hint').textContent = 'Having trouble reaching the music. Please try again in a minute.'; } } } });
  }
  var unmutedAt = 0;
  $('play').addEventListener('click', function () {
    if (Date.now() - unmutedAt < 700) return;
    if (!S.plays.length) return;
    if (!started) {
      started = true; $('hint').textContent = 'You are live with the station. Keep the volume up.'; $('npTitle').textContent = 'Tuning in…';
      if (window.YT && YT.Player) { if (!yt) init(); else { var k = findNow(); playIdx(k, Date.now() / 1000 - S.delay - S.plays[k].t); } }
      else { window.onYouTubeIframeAPIReady = init; var s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s); }
      return;
    }
    if (!ready) return; if (playing) yt.pauseVideo(); else yt.playVideo();
  });
  $('vol').addEventListener('input', function (e) { $('volv').textContent = e.target.value; if (yt && ready) yt.setVolume(+e.target.value); try { localStorage.setItem('up1-vol', e.target.value); } catch (x) {} });
  try { var v = localStorage.getItem('up1-vol'); if (v) { $('vol').value = v; $('volv').textContent = v; } } catch (x) {}
  // keep exactly in step with the live schedule: after a pause, a stall or a schedule change, jump back to the live position
  var lastSync = 0;
  setInterval(function () {
    if (!started || !playing || !yt || !ready || idx < 0 || !S.plays[idx] || Date.now() - lastSync < 20000) return;
    try {
      var expected = Date.now() / 1000 - S.delay, actual = S.plays[idx].t + yt.getCurrentTime();
      if (Math.abs(actual - expected) > 30) { var k = findNow(); lastSync = Date.now(); playIdx(k, expected - S.plays[k].t); }
    } catch (x) {}
  }, 8000);
  setInterval(function () { if (!playing || !yt || !ready) return; try { var d = yt.getDuration(), c = yt.getCurrentTime(); if (d) $('npFill').style.width = Math.min(100, c / d * 100) + '%'; } catch (x) {} }, 500);
  // open playing: start on load; browsers block sound before the first tap, so fall back to silent autoplay and unmute on the first touch
  var mutedAuto = false;
  function unmuteNow() { if (!mutedAuto) { if (started && ready && !playing) { try { yt.playVideo(); } catch (e) {} } return; } mutedAuto = false; unmutedAt = Date.now(); try { yt.unMute(); yt.setVolume(+$('vol').value); if (yt.getPlayerState() !== 1) yt.playVideo(); } catch (e) {} $('hint').textContent = 'You are live with the station. Keep the volume up.'; }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { addEventListener(ev, unmuteNow, { passive: true, capture: true }); });
  load().then(function () {
    var k = findNow(); idx = -1; paintLists();
    $('play').click();
    [3500, 8000].forEach(function (ms) {
      setTimeout(function () {
        if (playing || mutedAuto || !yt || !ready) return;
        try { yt.mute(); yt.playVideo(); mutedAuto = true; $('hint').textContent = 'Tap anywhere to turn the sound on.'; } catch (e) {}
      }, ms);
    });
  });
  setInterval(load, 3 * 60 * 1000);
})();
