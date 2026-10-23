/* 1UP Radio mini player: one small page that plays a station live (the same schedule everyone hears). Used for the pop-out window and as an embeddable widget:
   <iframe src="https://1upradio.com/player.html?station=vault" width="380" height="200" style="border:0" allow="autoplay; encrypted-media"></iframe> */
(function () {
  var ST = [
    { id: '1up', name: '1UP Radio', sched: 'schedule.json', mark: 'assets/logo.png', c: '139,92,246', hex: '#8b5cf6' },
    { id: 'cultureshock', name: 'Culture Shock', sched: 'schedule-culture.json', mark: 'assets/cultureshock-mark.svg', art: 'data/culture-art.json', c: '245,197,24', hex: '#f5c518' },
    { id: 'vault', name: 'The Vault', sched: 'schedule-hiphopvinyl.json', mark: 'assets/vault-mark.svg', art: 'data/hiphopvinyl-art.json', c: '255,90,31', hex: '#ff5a1f' },
    { id: 'movement', name: 'The Movement', sched: 'schedule-movement.json', mark: 'assets/movement-mark.svg', art: 'data/movement-art.json', c: '255,61,160', hex: '#ff3da0' }
  ];
  var $ = function (id) { return document.getElementById(id); }, S = { plays: [], delay: 0 }, ART = {}, cur, yt = null, ready = false, wantPlay = false, playing = false, idx = -1, bad = {};
  // one clock for everybody: the server's time (this device's own clock can be minutes or hours off)
  var SKEW = 0, nowMs = function () { return Date.now() + SKEW; };
  function syncClock() {
    var best = null, tries = 0;
    function one() {
      var t0 = Date.now();
      return fetch('schedule.json?c=' + t0 + '.' + Math.floor(Math.random() * 1e6), { method: 'HEAD', cache: 'no-store' }).then(function (r) {
        var t1 = Date.now(), d = r.headers.get('date'); if (!d) return;
        var srv = Date.parse(d) + 500 + (parseInt(r.headers.get('age'), 10) || 0) * 1000, rtt = t1 - t0;
        if (!best || rtt < best.rtt) best = { rtt: rtt, sk: srv + rtt / 2 - t1 };
      }).catch(function () {});
    }
    function loop() { return one().then(function () { if (++tries < 4) return loop(); }); }
    return Promise.race([loop(), new Promise(function (res) { setTimeout(res, 3500); })]).then(function () { if (best && best.rtt < 3000) SKEW = Math.abs(best.sk) < 1200 ? 0 : Math.round(best.sk); });
  }
  setInterval(syncClock, 10 * 60 * 1000);
  function pick(id) { for (var i = 0; i < ST.length; i++) if (ST[i].id === id) return ST[i]; return ST[0]; }
  var q = /[?&]station=([a-z0-9]+)/.exec(location.search); cur = pick(q ? q[1] : (function () { try { return localStorage.getItem('up1-station'); } catch (e) { return ''; } })());
  function split(t) { var i = t.indexOf(' - '); return i > 0 ? [t.slice(0, i), t.slice(i + 3)] : ['', t]; }
  function findNow() { var now = nowMs() / 1000 - S.delay, k = -1; for (var i = 0; i < S.plays.length; i++) { if (S.plays[i].t <= now) k = i; else break; } return k < 0 ? 0 : k; }
  function paintSong(p) {
    if (!p) return; var a = split(p.title); $('t').textContent = a[1] || p.title; $('a').textContent = a[0] || cur.name;
    $('cv').src = ART[p.id] || ('https://i.ytimg.com/vi/' + encodeURIComponent(p.id) + '/mqdefault.jpg');
    try { if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: a[1] || p.title, artist: a[0] || cur.name, album: '1UP Radio', artwork: [{ src: ART[p.id] || ('https://i.ytimg.com/vi/' + p.id + '/hqdefault.jpg') }] }); } catch (e) {}
  }
  function setOn(on) { playing = on; $('pp').classList.toggle('on', on); $('rec').classList.toggle('on', on); $('air').classList.toggle('on', on); $('airt').textContent = on ? 'ON AIR' : (wantPlay ? 'TUNING IN' : 'OFF AIR'); $('pp').setAttribute('aria-label', on ? 'Pause' : 'Play'); }
  function paintStation() {
    document.documentElement.style.setProperty('--g', cur.hex); document.documentElement.style.setProperty('--gr', cur.c);
    $('nm').textContent = cur.name; $('mk').src = cur.mark; document.title = cur.name + ' · 1UP Radio';
    $('full').href = location.origin + (cur.id === '1up' ? '/' : '/?station=' + cur.id);
    $('pills').innerHTML = ST.map(function (s) { return '<button type="button" data-id="' + s.id + '"' + (s.id === cur.id ? ' class="on"' : '') + '>' + s.name.replace('1UP Radio', 'Original') + '</button>'; }).join('');
  }
  function load() {
    return fetch(cur.sched + '?t=' + Date.now()).then(function (r) { return r.json(); }).then(function (d) { S = d; var k = findNow(); idx = k; paintSong(S.plays[k]); });   // idx follows the schedule, so a refresh never restarts the song
  }
  function loadArt() { ART = {}; if (cur.art) fetch(cur.art + '?t=' + Math.floor(Date.now() / 600000)).then(function (r) { return r.json(); }).then(function (j) { ART = j || {}; paintSong(S.plays[findNow()]); }).catch(function () {}); }
  function playNow() {   // jump to what is on air right now
    if (!ready || !S.plays.length) return; var k = findNow(), p = S.plays[k]; if (bad[p.id]) return;
    idx = k; paintSong(p); try { yt.loadVideoById({ videoId: p.id, startSeconds: Math.max(0, Math.floor(nowMs() / 1000 - S.delay - p.t)) }); } catch (e) {}
  }
  function init() {
    yt = new YT.Player('ytp', { width: 200, height: 200, host: 'https://www.youtube-nocookie.com', playerVars: { playsinline: 1, rel: 0, controls: 0, disablekb: 1, origin: location.origin }, events: {
      onReady: function () { ready = true; yt.setVolume(+$('vol').value); if (wantPlay) playNow(); },
      onStateChange: function (e) { var s = YT.PlayerState; if (e.data === s.PLAYING) { if (!wantPlay) { try { yt.pauseVideo(); } catch (x) {} return; } setOn(true); } else if (e.data === s.PAUSED && !wantPlay) setOn(false); },
      onError: function () { var p = S.plays[idx]; if (p) bad[p.id] = 1; setOn(false); }
    } });
  }
  window.onYouTubeIframeAPIReady = init;
  var tag = document.createElement('script'); tag.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(tag);
  $('pp').addEventListener('click', function () {
    if (wantPlay) { wantPlay = false; try { yt.pauseVideo(); } catch (e) {} setOn(false); }
    else { wantPlay = true; $('airt').textContent = 'TUNING IN'; if (ready) playNow(); }
  });
  $('vol').addEventListener('input', function (e) { if (yt && ready) yt.setVolume(+e.target.value); try { localStorage.setItem('up1-pvol', e.target.value); } catch (x) {} });
  $('vol').value = 88;   // always 88 when it opens
  $('pills').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; cur = pick(b.dataset.id); try { localStorage.setItem('up1-station', cur.id); } catch (x) {} paintStation(); loadArt(); load().then(function () { if (wantPlay) playNow(); }); });
  setInterval(function () {   // stay in step with the live schedule: when the next song's time comes, start it
    if (!S.plays.length) return; var k = findNow();
    if (k !== idx) { idx = k; paintSong(S.plays[k]); if (wantPlay && ready) playNow(); }
  }, 1000);
  setInterval(load, 3 * 60 * 1000);
  paintStation(); loadArt(); syncClock().then(load);
})();
