(function () {
  var $ = function (id) { return document.getElementById(id); };
  var S = { plays: [], delay: 420 }, yt = null, ready = false, started = false, playing = false, idx = -1, errs = 0, skipped = 0;
  var fmtT = function (t) { return new Date(t * 1000).toLocaleTimeString('en-GB', { timeZone: 'Europe/Athens', hour: '2-digit', minute: '2-digit' }); };
  var dayKey = function (t) { return new Date(t * 1000).toLocaleDateString('en-CA', { timeZone: 'Europe/Athens' }); };
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
    paintLists();
  }
  function paintLists() {
    var row = function (p, cls) { var a = split(p.title); return '<li class="' + (cls || '') + '"><time>' + fmtT(p.t) + '</time><span>' + esc(a[0] ? a[0] + ' — ' + a[1] : a[1]) + '</span></li>'; };
    $('next').innerHTML = idx >= 0 ? S.plays.slice(idx + 1, idx + 7).map(function (p) { return row(p); }).join('') : '';
    $('prev').innerHTML = idx >= 0 ? S.plays.slice(Math.max(0, idx - 6), idx).reverse().map(function (p) { return row(p); }).join('') : '';
    if (idx < 0) { $('next').innerHTML = S.plays.slice(-6).map(function (p) { return row(p); }).join(''); }
  }
  var selDay = null;
  function paintDays() {
    var keys = []; S.plays.forEach(function (p) { var k = dayKey(p.t); if (keys.indexOf(k) < 0) keys.push(k); });
    if (!selDay || keys.indexOf(selDay) < 0) selDay = keys[keys.length - 1];
    $('days').innerHTML = keys.map(function (k) { var d = new Date(k + 'T12:00:00Z'); return '<button data-k="' + k + '" class="' + (k === selDay ? 'on' : '') + '">' + d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) + '</button>'; }).join('');
    var list = S.plays.filter(function (p) { return dayKey(p.t) === selDay; });
    var curT = idx >= 0 && S.plays[idx] ? S.plays[idx].t : -1;
    $('daylist').innerHTML = list.map(function (p) { var a = split(p.title); return '<li class="' + (p.t === curT ? 'now' : '') + '"><time>' + fmtT(p.t) + '</time><span>' + esc(a[0] ? a[0] + ' — ' + a[1] : a[1]) + '</span></li>'; }).join('');
    $('tznote').textContent = 'Times are Athens time (' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Europe/Athens', timeZoneName: 'short' }).split(' ').pop() + ').';
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
  $('play').addEventListener('click', function () {
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
  setInterval(function () { if (!playing || !yt || !ready) return; try { var d = yt.getDuration(), c = yt.getCurrentTime(); if (d) $('npFill').style.width = Math.min(100, c / d * 100) + '%'; } catch (x) {} }, 500);
  load().then(function () { var k = findNow(); idx = -1; paintLists(); });
  setInterval(load, 3 * 60 * 1000);
})();
