// "Did you know?" pop-ups (like Pop-Up Video): while a song plays, a small bubble tells a true fact about the song or the artist (data/facts-<station>.json, built by tools/facts_build.py
// from YouTube, Deezer and MusicBrainz) and, when there is none, a fact about the style (data/genre-facts.json). They come up on their own at random moments and go away again; the X on the bubble closes one.
(function () {
  var cache = {}; try { cache = JSON.parse(sessionStorage.getItem('up1-facts-cache') || '{}'); } catch (e) {}
  function save() { try { sessionStorage.setItem('up1-facts-cache', JSON.stringify(cache)); } catch (e) {} }
  var DATA = { genre: null, st: {}, artists: null, auto: null, wiki: null, more: null, bpm: null, labels: null, az: {}, azIdx: null };
  function nrm(s) { return ' ' + String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim() + ' '; }
  function artistFacts(title, st) {   // facts about whoever is playing: a known artist named in the ARTIST part of the title (the first part before a dash; on Culture Shock the last part too, because titles often end with the artist), never in the song's own name
    var parts = String(title || '').replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').split(/\s[-\u2013\u2014]\s/), segs = [parts[0]];
    if (parts.length > 1 && st === 'cultureshock') segs.push(parts[parts.length - 1]);
    var t = nrm(segs.join(' | ')), out = [];
    (DATA.artists || []).forEach(function (a) { if (a.n.some(function (n) { return t.indexOf(nrm(n)) >= 0; })) out = out.concat(a.f); });
    return out;
  }
  function mainArtist(seg) { return String(seg || '').replace(/\s*[\(\[].*?[\)\]]/g, '').split(/\s+(?:feat\.?|ft\.?|featuring|with|x|vs\.?|&|and)\s+|\s*[,\/;]\s*/i)[0].trim(); }
  function autoFacts(title, st) {   // data/artist-auto.json (tools/artist_auto.py, from MusicBrainz): where the artist is from, when a group formed, how listeners tag the style
    var parts = String(title || '').split(/\s[-\u2013\u2014]\s/), segs = [parts[0]], out = [];
    if (parts.length > 1 && st === 'cultureshock') segs.push(parts[parts.length - 1]);
    segs.forEach(function (s) { var f = DATA.auto && DATA.auto[nrm(mainArtist(s)).trim()]; if (f) out = out.concat(f); });
    return out;
  }
  function remixFact(title) {   // who made this version, of which song, from the title itself: "Artist - Song (Someone Remix)"
    var m = /[\(\[]([^()\[\]]*?)\s+(remix|rework|bootleg|edit|flip|vip|refix|mix)\s*[\)\]]/i.exec(title || ''), parts = String(title || '').split(/\s[-\u2013\u2014]\s/);
    if (!m || parts.length < 2) return '';
    var who = m[1].replace(/['\u2019]s$/i, '').trim(), kind = m[2].toLowerCase(), artist = mainArtist(parts[0]), song = parts[1].replace(/\s*[\(\[].*$/, '').trim();
    if (who.length < 2 || !artist || !song || /^(original|extended|radio|club|main|album|instrumental|vocal|dub|full|short|long|new|re ?edit|lp|single|version|official|unofficial|extended club|\d+)$/i.test(who)) return '';
    return kind === 'bootleg' ? 'This is an unofficial bootleg by ' + who + ' of \u201c' + song + '\u201d by ' + artist + '.'
         : kind === 'edit' ? who + ' re-edited \u201c' + song + '\u201d by ' + artist + ' for this version.'
         : kind === 'vip' ? 'A VIP mix is a producer\u2019s own reworking of a track, and this one is ' + who + '\u2019s take on \u201c' + song + '\u201d.'
         : /['\u2019]s\s/.test(m[1]) ? 'This is the ' + m[1].trim() + ' ' + kind + ' of \u201c' + song + '\u201d by ' + artist + '.'
         : 'In this version ' + who + ' reworks \u201c' + song + '\u201d by ' + artist + '.';
  }
  function loadData(st) {
    var g = DATA.genre ? Promise.resolve() : fetch('data/genre-facts.json?t=' + Math.floor(Date.now() / 3600000)).then(function (r) { return r.json(); }).then(function (j) { DATA.genre = j || {}; }).catch(function () { DATA.genre = {}; });
    var key = st === '1up' ? 'main' : st === 'cultureshock' ? 'culture' : st === 'vault' ? 'hiphopvinyl' : st;
    var f = DATA.st[st] ? Promise.resolve() : fetch('data/facts-' + key + '.json?t=' + Math.floor(Date.now() / 3600000)).then(function (r) { return r.json(); }).then(function (j) { DATA.st[st] = j || {}; }).catch(function () { DATA.st[st] = {}; });
    var a = DATA.artists ? Promise.resolve() : fetch('data/artist-facts.json?t=' + Math.floor(Date.now() / 3600000)).then(function (r) { return r.json(); }).then(function (j) { DATA.artists = j || []; }).catch(function () { DATA.artists = []; });
    var au = DATA.auto ? Promise.resolve() : fetch('data/artist-auto.json?t=' + Math.floor(Date.now() / 1800000)).then(function (r) { return r.json(); }).then(function (j) { DATA.auto = j || {}; }).catch(function () { DATA.auto = {}; });
    var hr = Math.floor(Date.now() / 3600000);
    var w = DATA.wiki ? Promise.resolve() : fetch('data/artist-wiki.json?t=' + hr).then(function (r) { return r.json(); }).then(function (j) { DATA.wiki = j || {}; }).catch(function () { DATA.wiki = {}; });
    var dp = DATA.deep ? Promise.resolve() : fetch('data/artist-deep.json?t=' + hr).then(function (r) { return r.json(); }).then(function (j) { DATA.deep = j || {}; }).catch(function () { DATA.deep = {}; });
    var mo = DATA.more ? Promise.resolve() : fetch('data/artist-more.json?t=' + hr).then(function (r) { return r.json(); }).then(function (j) { DATA.more = j || {}; }).catch(function () { DATA.more = {}; });
    var bp = DATA.bpm ? Promise.resolve() : fetch('data/bpm.json?t=' + Math.floor(Date.now() / 1800000)).then(function (r) { return r.json(); }).then(function (j) { DATA.bpm = j || {}; }).catch(function () { DATA.bpm = {}; });
    var lb = DATA.labels ? Promise.resolve() : fetch('data/labels.json?t=' + hr).then(function (r) { return r.json(); }).then(function (j) { DATA.labels = j || {}; }).catch(function () { DATA.labels = {}; });
    var ai = DATA.azIdx ? Promise.resolve() : fetch('data/artists/index.json?t=' + hr).then(function (r) { return r.json(); }).then(function (j) { DATA.azIdx = j || {}; }).catch(function () { DATA.azIdx = {}; });
    return Promise.all([g, f, a, au, w, bp, lb, ai, mo, dp]);
  }

  // ---- better facts: a line about the artist from Wikipedia, how many of their songs we play, the label, the tempo; the generic filler (YouTube view counts, "Original Mix" explained, bare release years) only if nothing else is left ----
  var STALE = /(upload has been watched|"Original Mix" is the label|In Jamaican music a "version"|^It was released in \d{4}\.$|An extended mix lengthens|A radio edit trims|An instrumental version is the same track)/i;
  var seenF = []; try { seenF = JSON.parse(localStorage.getItem('up1-seenf') || '[]'); } catch (e) {}
  function seenAdd(t) { seenF.push(hash(t)); if (seenF.length > 400) seenF = seenF.slice(-400); try { localStorage.setItem('up1-seenf', JSON.stringify(seenF)); } catch (e) {} }
  function azFor(name) {
    var c = String(name || '').trim().charAt(0).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), L = /^[A-Z]$/.test(c) ? c : 'num';
    if (DATA.az[L]) return Promise.resolve(DATA.az[L]);
    return fetch('data/artists/' + (L === 'num' ? 'num' : L.toLowerCase()) + '.json?t=' + Math.floor(Date.now() / 3600000)).then(function (r) { return r.json(); }).then(function (j) { DATA.az[L] = j; return j; }).catch(function () { return []; });
  }
  function tempoFact(b, st) {
    var n = parseFloat(String(b).replace('~', '')); if (!n) return '';
    var say = n < 80 ? 'a slow, heavy pace that makes you feel every beat' : n < 100 ? 'a laid-back head-nod pace' : n < 118 ? 'a mid-tempo groove that is easy to move to' : n <= 132 ? 'the house-music sweet spot, where most dance floors live' : n <= 150 ? 'a fast, driving pace' : 'a very fast pace that keeps the energy high';
    return 'At about ' + Math.round(n) + ' beats per minute, this song runs at ' + say + '.';
  }
  function songWiki(p) {   // look the playing song up on Wikipedia (only when its own article exists and names this artist)
    var parts = String(p.title || '').replace(/\s*[\(\[].*?[\)\]]/g, '').split(/\s[-\u2013\u2014]\s/), artist = mainArtist(parts[0]), song = String(parts[1] || '').replace(/\s*\/.*$/, '').trim();
    if (!artist || song.length < 3) return Promise.resolve('');
    var ck = 'sw:' + hash(artist + '|' + song); if (cache[ck] !== undefined) return Promise.resolve(cache[ck]);
    return fetch('https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=4&format=json&origin=*&srsearch=' + encodeURIComponent('"' + song + '" ' + artist + ' song')).then(function (r) { return r.json(); }).then(function (j) {
      var hits = (j.query && j.query.search) || [], ns = nrm(song), na = nrm(artist);
      var h = hits.filter(function (x) { var t = nrm(x.title), sn = nrm(String(x.snippet || '').replace(/<[^>]+>/g, '')); return t.indexOf(ns) >= 0 && (t.indexOf(na) >= 0 || sn.indexOf(na) >= 0); })[0];
      if (!h) return '';
      return fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(h.title.replace(/ /g, '_'))).then(function (r) { return r.json(); }).then(function (s) {
        var x = String((s && s.extract) || ''); if (!x || s.type !== 'standard' || !/\b(song|single|track|recording|album|ep)\b/i.test(x.slice(0, 320)) || nrm(x.slice(0, 400)).indexOf(na) < 0) return '';
        var sents = x.match(/[^.!?]+[.!?]+(\s|$)/g) || [x], t = ''; for (var i = 0; i < sents.length; i++) { if (t && (t + sents[i]).length > 340) break; t += sents[i]; }
        return t.trim() + ' \u2014 Wikipedia';
      });
    }).catch(function () { return ''; }).then(function (t) { cache[ck] = t; save(); return t; });
  }
  function buildFacts(p, st) {
    var parts = String(p.title || '').split(/\s[-–—]\s/), segs = [parts[0]]; if (parts.length > 1 && st === 'cultureshock') segs.push(parts[parts.length - 1]);
    var main = mainArtist(segs[0]), key = nrm(main).trim(), top = [], mid = [], low = [];
    var wk = DATA.wiki && (DATA.wiki[key] || (segs[1] && DATA.wiki[nrm(mainArtist(segs[1])).trim()]));
    if (wk && wk.x) top.push(wk.x + ' — Wikipedia');
    artistFacts(p.title, st).forEach(function (x) { top.push(x); });
    var dpl = DATA.deep && (DATA.deep[key] || (segs[1] && DATA.deep[nrm(mainArtist(segs[1])).trim()])); if (dpl) dpl.forEach(function (x) { top.push(x + ' \u2014 Wikipedia'); });   // story lines from the artist's Wikipedia article (how they work, what they did before, aliases, quotes): a different one each time
    var more = DATA.more && (DATA.more[key] || (segs[1] && DATA.more[nrm(mainArtist(segs[1])).trim()])); if (more) more.forEach(function (x) { mid.push(x); });   // from Deezer: fans, releases, best-known song, who their fans also listen to
    autoFacts(p.title, st).forEach(function (x) { mid.push(x); });
    var lab = DATA.labels && DATA.labels[p.id]; if (lab) mid.push('“' + String(parts[1] || parts[0]).replace(/\s*[\(\[].*$/, '').trim() + '” is released on ' + lab + '.');
    var b = DATA.bpm && DATA.bpm[p.id]; if (b) mid.push(tempoFact(b, st));
    var rx = remixFact(p.title); if (rx) mid.push(rx);
    var pre = ((DATA.st[st] || {})[p.id] || []); var good = pre.filter(function (x) { return !STALE.test(x); });
    good.forEach(function (x) { low.push(x); });
    var gen = (DATA.genre || {})[st] || []; gen.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 4).forEach(function (x) { low.push(x); });   // when a song has nothing of its own: a random fact about the channel's music (reggae on the reggae channel, house on the house channel...)
    var stale = pre.filter(function (x) { return STALE.test(x); });
    var shuf = function (l) { return l.slice().sort(function () { return Math.random() - 0.5; }); };
    var out = shuf(top).concat(shuf(mid)).concat(shuf(low)).filter(Boolean);
    var fresh = out.filter(function (x) { return seenF.indexOf(hash(x)) < 0; }); if (fresh.length) out = fresh.concat(out.filter(function (x) { return fresh.indexOf(x) < 0; }));
    if (!out.length) out = stale;
    return Promise.all([azFor(main), songWiki(p)]).then(function (pr) {   // how many of this artist's songs are on the stations + what Wikipedia says about this very song
      var rows = pr[0], sw = pr[1];
      if (sw && seenF.indexOf(hash(sw)) < 0) out.unshift(sw);
      var row = (rows || []).filter(function (r) { return nrm(r[0]).trim() === key; })[0];
      if (row && row[1].length >= 2) { var names = (DATA.azIdx && DATA.azIdx.stations) || ['1UP Radio', 'The Movement', 'Culture Shock', 'The Vault'], ss = {}; row[1].forEach(function (s) { ss[names[s[0]]] = 1; });
        var where = Object.keys(ss).join(' and '); var t = main + ' has ' + row[1].length + ' songs in our mix' + (where ? ', on ' + where : '') + '.';
        if (seenF.indexOf(hash(t)) < 0) out.splice(Math.min(1, out.length), 0, t); }
      return out;
    });
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
    lastPop = Date.now(); try { seenAdd(String(f).replace(/ \u2014 Wikipedia$/, '')); seenAdd(f); } catch (e) {} clearTimeout(hideT); hideT = setTimeout(hide, Math.min(32000, Math.max(16000, 9000 + String(f).length * 110)) * (0.9 + Math.random() * 0.2));
  }
  function station2() { return window.UP1_STATION || '1up'; }
  function tick() {
    var p = window.UP1_NOW, play = document.getElementById('play'), playing = !!(play && play.classList.contains('on'));
    if (!p || !p.id) return;
    if (p.id !== songId) { songId = p.id; songT0 = Date.now(); shown = 0; facts = null; hide(); makePlan(); var my = ++token, st = station2(), sid = p.id;
      loadData(st).then(function () {
        if (my !== token) return;
        buildFacts(p, st).then(function (all) { if (my !== token) return; if (all.length) facts = { name: '', url: '', src: 0, facts: all }; });
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
