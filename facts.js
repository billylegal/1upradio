// "Did you know?" pop-ups (like Pop-Up Video): while a song plays, a small bubble tells a true fact about the song or the artist (data/facts-<station>.json, built by tools/facts_build.py
// from YouTube, Deezer and MusicBrainz) and, when there is none, a fact about the style (data/genre-facts.json). They come up on their own at random moments and go away again; the X on the bubble closes one.
(function () {
  var cache = {}; try { cache = JSON.parse(sessionStorage.getItem('up1-facts-cache') || '{}'); } catch (e) {}
  function save() { try { sessionStorage.setItem('up1-facts-cache', JSON.stringify(cache)); } catch (e) {} }
  var DATA = { genre: null, st: {} };
  function loadData(st) {
    var g = DATA.genre ? Promise.resolve() : fetch('data/genre-facts.json?t=' + Math.floor(Date.now() / 3600000)).then(function (r) { return r.json(); }).then(function (j) { DATA.genre = j || {}; }).catch(function () { DATA.genre = {}; });
    var key = st === '1up' ? 'main' : st === 'cultureshock' ? 'culture' : st === 'vault' ? 'hiphopvinyl' : st;
    var f = DATA.st[st] ? Promise.resolve() : fetch('data/facts-' + key + '.json?t=' + Math.floor(Date.now() / 3600000)).then(function (r) { return r.json(); }).then(function (j) { DATA.st[st] = j || {}; }).catch(function () { DATA.st[st] = {}; });
    return Promise.all([g, f]);
  }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  var bubble, hideT = null, songId = '', songT0 = 0, shown = 0, facts = null, token = 0, plan = [], lastPop = 0;
  function build() {
    bubble = document.createElement('aside'); bubble.id = 'factbubble'; bubble.hidden = true; bubble.setAttribute('aria-live', 'polite');
    bubble.innerHTML = '<b>💡 DID YOU KNOW?</b><p></p><button type="button" aria-label="Close">✕</button>';
    document.body.appendChild(bubble);
    bubble.querySelector('button').addEventListener('click', hide);
  }
  function hide() { if (bubble) bubble.hidden = true; clearTimeout(hideT); }
  function pop(f, who, withSrc) {
    bubble.querySelector('p').textContent = f; 
    bubble.hidden = false; bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    lastPop = Date.now(); clearTimeout(hideT); hideT = setTimeout(hide, Math.min(32000, Math.max(16000, 9000 + String(f).length * 110)) * (0.9 + Math.random() * 0.2));
  }
  function station2() { return window.UP1_STATION || '1up'; }
  function tick() {
    var p = window.UP1_NOW, play = document.getElementById('play'), playing = !!(play && play.classList.contains('on'));
    if (!p || !p.id) return;
    if (p.id !== songId) { songId = p.id; songT0 = Date.now(); shown = 0; facts = null; hide(); makePlan(); var my = ++token, st = station2(), sid = p.id;
      loadData(st).then(function () {
        if (my !== token) return;
        var pre = (DATA.st[st] || {})[sid] || [], gen = (DATA.genre || {})[st] || [], g = gen.length ? [gen[hash(sid) % gen.length]] : [];
        var all = pre.slice(0, 3).concat(g);
        if (!all.length && gen.length) all = [gen[hash(sid) % gen.length], gen[(hash(sid) + 3) % gen.length]];
        if (all.length) facts = { name: '', url: '', src: 0, facts: all.sort(function () { return Math.random() - 0.5; }) };
      });
    }
    if (!playing || !facts || !plan.length) return;
    var secs = (Date.now() - songT0) / 1000;
    if (secs > plan[0] + 40) plan.shift();                                  // missed its moment (paused, or too soon after another one)
    else if (secs >= plan[0] && Date.now() - lastPop > 40000) { plan.shift(); pop(facts.facts[shown % facts.facts.length]); shown++; }
  }
  function makePlan() {   // random moments for this song; about one song in three gets none, so it stays a surprise
    plan = []; if (Math.random() < 0.3) return;
    var t = 12 + Math.random() * 35, n = 1 + Math.floor(Math.random() * 3);
    for (var i = 0; i < n; i++) { plan.push(t); t += 55 + Math.random() * 95; }
  }
  function init() { build(); setInterval(tick, 1000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 600); }); else setTimeout(init, 600);
})();
