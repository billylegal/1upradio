// "Did you know?" pop-ups (like Pop-Up Video): while a song plays, a small bubble tells a true fact about the song or the artist (data/facts-<station>.json, built by tools/facts_build.py
// from YouTube, Deezer and MusicBrainz) and, when there is none, a fact about the style (data/genre-facts.json). Switch off with the bulb button (remembered on this device).
(function () {
  var KEY = 'up1-facts', on = true; try { on = localStorage.getItem(KEY) !== 'off'; } catch (e) {}
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
  var bubble, btn, hideT = null, songId = '', songT0 = 0, shown = 0, facts = null, token = 0;
  function build() {
    bubble = document.createElement('aside'); bubble.id = 'factbubble'; bubble.hidden = true; bubble.setAttribute('aria-live', 'polite');
    bubble.innerHTML = '<b>💡 DID YOU KNOW?</b><p></p><button type="button" aria-label="Close">✕</button>';
    document.body.appendChild(bubble);
    bubble.querySelector('button').addEventListener('click', hide);
    var share = document.getElementById('shareBtn');
    if (share) {
      btn = document.createElement('button'); btn.type = 'button'; btn.id = 'factsBtn'; btn.className = 'sharebtn xbtn'; btn.setAttribute('aria-label', 'Did-you-know pop-ups');
      btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21h6v-1.5H9zm3-19a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>';
      share.parentNode.appendChild(btn); btn.addEventListener('click', toggle); paintBtn();
    }
  }
  function paintBtn() { if (!btn) return; btn.classList.toggle('on', on); btn.title = on ? 'Did-you-know pop-ups: on (tap to turn off)' : 'Did-you-know pop-ups: off (tap to turn on)'; }
  function toggle() { on = !on; try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) {} paintBtn(); if (!on) hide(); }
  function hide() { if (bubble) bubble.hidden = true; clearTimeout(hideT); }
  function pop(f, who, withSrc) {
    bubble.querySelector('p').textContent = f; 
    bubble.hidden = false; bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    clearTimeout(hideT); hideT = setTimeout(hide, 13000);
  }
  function station2() { return window.UP1_STATION || '1up'; }
  function tick() {
    var p = window.UP1_NOW, play = document.getElementById('play'), playing = !!(play && play.classList.contains('on'));
    if (!p || !p.id) return;
    if (p.id !== songId) { songId = p.id; songT0 = Date.now(); shown = 0; facts = null; hide(); var my = ++token, st = station2(), sid = p.id;
      loadData(st).then(function () {
        if (my !== token) return;
        var pre = (DATA.st[st] || {})[sid] || [], gen = (DATA.genre || {})[st] || [], g = gen.length ? [gen[hash(sid) % gen.length]] : [];
        var all = pre.slice(0, 3).concat(g);
        if (!all.length && gen.length) all = [gen[hash(sid) % gen.length], gen[(hash(sid) + 3) % gen.length]];
        if (all.length) facts = { name: '', url: '', src: 0, facts: all };
      });
    }
    if (!on || !playing || !facts) return;
    var secs = (Date.now() - songT0) / 1000, due = [20, 85, 150, 215][shown];
    if (due !== undefined && secs >= due && secs < due + 40) { pop(facts.facts[shown % facts.facts.length], facts, shown < (facts.src || 0)); shown++; }
  }
  function init() { build(); setInterval(tick, 1000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 600); }); else setTimeout(init, 600);
})();
