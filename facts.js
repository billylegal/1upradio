// "Did you know?" pop-ups (like Pop-Up Video): while a song plays, a small bubble tells a true fact about the artist, taken from their Wikipedia page.
// Only used when the page is a musician / band (checked by Wikipedia's own description); switch off with the bulb button (remembered on this device).
(function () {
  var KEY = 'up1-facts', on = true; try { on = localStorage.getItem(KEY) !== 'off'; } catch (e) {}
  var cache = {}; try { cache = JSON.parse(sessionStorage.getItem('up1-facts-cache') || '{}'); } catch (e) {}
  function save() { try { sessionStorage.setItem('up1-facts-cache', JSON.stringify(cache)); } catch (e) {} }
  var MUSIC = /(music|singer|vocalist|\bDJ\b|rapper|\bband\b|producer|songwriter|\bgroup\b|\bduo\b|composer|guitarist|\btrio\b|musical|record label|MC\b|beatmaker|instrumentalist)/i;
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function names(title) {
    var t = String(title || '').replace(/\s*[\(\[][^)\]]*[\)\]]/g, ''), parts = t.split(/\s[-–—]\s/);
    var order = (window.UP1_STATION === 'cultureshock') ? [parts[parts.length - 1], parts[0]] : [parts[0], parts[parts.length - 1]];
    var out = [];
    order.forEach(function (p) { if (!p || parts.length < 2) return; p = p.split(/\s+(?:feat\.?|ft\.?|featuring|with|vs\.?|x)\s+|\s*[&,\/]\s*/i)[0].trim(); if (p.length > 1 && out.indexOf(p) < 0) out.push(p); });
    return out;
  }
  function lookup(name) {
    var k = norm(name); if (!k) return Promise.resolve(null);
    if (k in cache) return Promise.resolve(cache[k]);
    return fetch('https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=8&format=json&origin=*&srsearch=' + encodeURIComponent(name + ' musician OR band OR singer OR DJ OR rapper')).then(function (r) { return r.json(); }).then(function (j) {
      var hits = (j.query && j.query.search) || [], i = 0;
      function next() {
        if (i >= hits.length) return null;
        var h = hits[i++], base = norm(h.title);
        if (base !== k && base.indexOf(k) !== 0) return next();
        return fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(h.title.replace(/ /g, '_'))).then(function (r) { return r.json(); }).then(function (s) {
          if (!s || s.type !== 'standard' || !MUSIC.test((s.description || '') + ' ' + (s.extract || '').slice(0, 160))) return next();
          var sents = String(s.extract || '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+(?=\s|$)/g) || [];
          sents = sents.map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 25 && x.length < 260; }).slice(0, 4);
          return sents.length ? { name: s.title, url: (s.content_urls && s.content_urls.desktop && s.content_urls.desktop.page) || '', facts: sents } : next();
        });
      }
      return next();
    }).then(function (res) { cache[k] = res || false; save(); return res || false; }).catch(function () { return false; });
  }

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
    bubble.innerHTML = '<b>💡 DID YOU KNOW?</b><p></p><small><a target="_blank" rel="noopener">Wikipedia</a></small><button type="button" aria-label="Close">✕</button>';
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
    bubble.querySelector('p').textContent = f; var sm = bubble.querySelector('small'), a = bubble.querySelector('a'); sm.hidden = !who.name || !withSrc; if (who.url) { a.href = who.url; a.textContent = 'Wikipedia · ' + who.name; } else { a.removeAttribute('href'); a.textContent = who.name; }
    bubble.hidden = false; bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    clearTimeout(hideT); hideT = setTimeout(hide, 13000);
  }
  function station2() { return window.UP1_STATION || '1up'; }
  function tick() {
    var p = window.UP1_NOW, play = document.getElementById('play'), playing = !!(play && play.classList.contains('on'));
    if (!p || !p.id) return;
    if (p.id !== songId) { songId = p.id; songT0 = Date.now(); shown = 0; facts = null; hide(); var my = ++token, st = station2(), sid = p.id, cands = names(p.title);
      loadData(st).then(function () {
        if (my !== token) return;
        var pre = (DATA.st[st] || {})[sid] || [], gen = (DATA.genre || {})[st] || [], g = gen.length ? [gen[hash(sid) % gen.length]] : [];
        if (pre.length) { facts = { name: 'Wikipedia', url: '', src: Math.min(3, pre.length), facts: pre.slice(0, 3).concat(g) }; return; }
        (function go(i) {
          if (i >= cands.length) { if (my === token && g.length) facts = { name: '', url: '', src: 0, facts: g.concat(gen.length > 1 ? [gen[(hash(sid) + 3) % gen.length]] : []) }; return; }
          lookup(cands[i]).then(function (r) { if (my !== token) return; if (r) facts = { name: r.name, url: r.url, src: Math.min(3, r.facts.length), facts: r.facts.slice(0, 3).concat(g) }; else go(i + 1); });
        })(0);
      });
    }
    if (!on || !playing || !facts) return;
    var secs = (Date.now() - songT0) / 1000, due = [20, 85, 150, 215][shown];
    if (due !== undefined && secs >= due && secs < due + 40) { pop(facts.facts[shown % facts.facts.length], facts, shown < (facts.src || 0)); shown++; }
  }
  function init() { build(); setInterval(tick, 1000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 600); }); else setTimeout(init, 600);
})();
