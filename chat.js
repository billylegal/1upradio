// 1UP Radio live room, Instagram-Live style: comments float over the bottom-left, reactions (fire, hearts...) sit in a column on the right under your thumb and rise the full height of the screen.
// Talks to a small Supabase project over plain REST (no library); hidden until chat-config.js has the project URL and key. Nothing here touches the player.
(function () {
  var C = window.UP1_CHAT || {}; if (!C.url || !C.key) return;
  var live = document.getElementById('live'); if (!live) return;
  var KINDS = [['fire', '🔥'], ['heart', '❤️'], ['hands', '🙌'], ['music', '🎧'], ['clap', '👏']];
  var BAD = /(fuck|shit|bitch|cunt|nigg|fagg|rape|retard)/i, SHOW = 6;
  var $ = function (id) { return document.getElementById(id); };
  var list = $('chatlist'), form = $('chatform'), nickI = $('chatnick'), msgI = $('chatmsg'), bar = $('chatreact'), err = $('chaterr'), fx = $('reactfx'), editB = $('chatedit');
  var cid; try { cid = localStorage.getItem('up1-cid'); if (!cid) { cid = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); localStorage.setItem('up1-cid', cid); } } catch (e) { cid = String(Math.random()).slice(2); }
  var H = { apikey: C.key, 'Content-Type': 'application/json' }; if (!/^sb_/.test(C.key)) H.Authorization = 'Bearer ' + C.key;   // new-style publishable keys (sb_...) go in apikey only
  function api(path, opt) { return fetch(C.url.replace(/\/$/, '') + '/rest/v1/' + path, Object.assign({ headers: H }, opt || {})).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t); }); return r.status === 204 ? null : r.json(); }); }
  function station() { return window.UP1_STATION || '1up'; }
  function songId() { var p = window.UP1_NOW; return p && p.id ? String(p.id) : ''; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  var lastId = 0, shown = '', counts = {}, seen = 0;

  // ---- name: asked once, then folded away behind a small pencil ----
  function paintNick() { var has = !!nickI.value.trim(); form.classList.toggle('hasnick', has); editB.hidden = !has; msgI.placeholder = has ? 'Comment as ' + nickI.value.trim() + '...' : 'Say something...'; }
  nickI.value = store('up1-nick') || ''; paintNick();
  editB.addEventListener('click', function () { form.classList.remove('hasnick'); editB.hidden = true; nickI.focus(); nickI.select(); });
  nickI.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (nickI.value.trim()) { store('up1-nick', nickI.value.trim().slice(0, 20)); paintNick(); msgI.focus(); } } });

  // ---- chat open / minimised (the bubble in the column) ----
  var chatB = document.createElement('button'); chatB.type = 'button'; chatB.id = 'chatopen'; chatB.className = 'lvchat'; chatB.setAttribute('aria-label', 'Show or hide the chat'); chatB.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg><i id="chatbadge" hidden></i>';
  var badge = chatB.querySelector('i');
  function minimised() { return live.classList.contains('min'); }
  function setMin(on) { live.classList.toggle('min', on); chatB.setAttribute('aria-pressed', String(!on)); store('up1-chat-min', on ? '1' : '0'); if (!on) { seen = lastId; badge.hidden = true; list.scrollTop = list.scrollHeight; } }
  chatB.addEventListener('click', function () { setMin(!minimised()); });
  setMin(store('up1-chat-min') === '1');

  // ---- comments: the last few float over the bottom-left ----
  function hueOf(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function paintMsgs(rows) {
    list.textContent = '';
    if (!rows.length) { var e = document.createElement('div'); e.className = 'chatempty'; e.textContent = 'No comments yet. Say hi!'; list.appendChild(e); }
    rows.slice(-SHOW).forEach(function (m) {
      var hue = hueOf(m.nick), d = document.createElement('div'); d.className = 'chatmsg';
      var av = document.createElement('span'); av.className = 'av'; av.textContent = m.nick.charAt(0); av.style.background = 'hsl(' + hue + ',55%,42%)';
      var w = document.createElement('div'), n = document.createElement('b'); n.textContent = m.nick; n.style.color = 'hsl(' + hue + ',80%,78%)';
      var t = document.createElement('span'); t.className = 't'; t.textContent = m.body; w.appendChild(n); w.appendChild(t); d.appendChild(av); d.appendChild(w); list.appendChild(d);
    });
  }
  function pollMsgs() {
    var st = station();
    if (st !== shown) { shown = st; lastId = 0; seen = 0; list.textContent = ''; }
    api('messages?select=id,nick,body&station=eq.' + encodeURIComponent(st) + '&order=id.desc&limit=' + SHOW).then(function (rows) {
      rows.reverse(); var top = rows.length ? rows[rows.length - 1].id : 0;
      if (top !== lastId || !list.childNodes.length) { lastId = top; paintMsgs(rows); }
      if (!minimised()) seen = top; else if (!seen) seen = top; else { var fresh = rows.filter(function (r) { return r.id > seen; }).length; badge.textContent = fresh > 9 ? '9+' : String(fresh); badge.hidden = !fresh; }
    }).catch(function () {});
  }

  // ---- reactions: counts + the flames ----
  function paintReact() {
    var sid = songId();
    bar.querySelectorAll('button[data-k]').forEach(function (b) { var k = b.getAttribute('data-k'), n = counts[k] || 0; b.querySelector('i').textContent = n ? (n > 99 ? '99+' : String(n)) : ''; b.disabled = !sid; });
  }
  function pollReact() {
    var sid = songId(); if (!sid) { counts = {}; paintReact(); return; }
    api('rpc/reaction_counts', { method: 'POST', body: JSON.stringify({ song_id: sid }) }).then(function (rows) {
      if (sid !== songId()) return; counts = {}; rows.forEach(function (r) { counts[r.kind] = Number(r.n); }); paintReact();
    }).catch(function () {});
  }
  var EMO = {}; KINDS.forEach(function (k) { EMO[k[0]] = k[1]; });
  var REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;
  function burst(kind, big) {   // an emoji leaves the bottom of the screen and rises all the way up beside the column
    if (!EMO[kind] || fx.childNodes.length > 40) return;
    var f = document.createElement('span'), h = fx.clientHeight || window.innerHeight;
    f.className = 'rfx'; f.textContent = EMO[kind];
    f.style.right = Math.round(8 + Math.random() * (big ? 56 : 70)) + 'px';
    f.style.fontSize = (big ? 44 + Math.round(Math.random() * 26) : 34 + Math.round(Math.random() * 22)) + 'px';
    f.style.setProperty('--rise', '-' + (h - 20) + 'px'); f.style.setProperty('--dx', (Math.round(Math.random() * 90) - 60) + 'px');
    f.style.animationDuration = (REDUCE ? 1.4 : 2.6 + Math.random() * 1.4) + 's';
    fx.appendChild(f); setTimeout(function () { f.remove(); }, 4200);
  }
  var head = null, headSt = '';
  function pollLive() {   // other people's taps float up on your screen too
    var st = station(); if (st !== headSt) { headSt = st; head = null; }
    if (head === null) { api('rpc/reaction_head', { method: 'POST', body: JSON.stringify({ st: st }) }).then(function (n) { if (st === station() && head === null) head = Number(n) || 0; }).catch(function () {}); return; }
    api('rpc/recent_reactions', { method: 'POST', body: JSON.stringify({ st: st, after_id: head, my_cid: cid }) }).then(function (rows) {
      if (st !== station()) return;
      rows.forEach(function (r, i) { head = Math.max(head, Number(r.id)); setTimeout(function () { burst(r.kind, false); }, i * 220); });
    }).catch(function () {});
  }
  KINDS.forEach(function (k) {
    var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-k', k[0]); b.setAttribute('aria-label', k[0]); b.disabled = true;
    b.innerHTML = '<span>' + k[1] + '</span><i></i>'; bar.appendChild(b);
    b.addEventListener('click', function (e) {
      e.stopPropagation(); var sid = songId(); if (!sid) return;
      counts[k[0]] = (counts[k[0]] || 0) + 1; paintReact(); for (var j = 0; j < 5; j++) (function (d) { setTimeout(function () { burst(k[0], true); }, d); })(j * 110);
      api('reactions', { method: 'POST', headers: Object.assign({ Prefer: 'return=minimal' }, H), body: JSON.stringify({ station: station(), song: sid, kind: k[0], cid: cid }) }).catch(function () { counts[k[0]] = Math.max(0, (counts[k[0]] || 1) - 1); paintReact(); });
    });
  });
  bar.appendChild(chatB);

  // ---- sending a comment ----
  form.addEventListener('submit', function (e) {
    e.preventDefault(); err.textContent = '';
    var nick = nickI.value.trim().replace(/\s+/g, ' ').slice(0, 20), body = msgI.value.trim().slice(0, 200);
    if (!nick) { err.textContent = 'Pick a name first.'; form.classList.remove('hasnick'); nickI.focus(); return; }
    if (!body) return;
    if (BAD.test(nick + ' ' + body)) { err.textContent = 'Keep it clean, please.'; return; }
    store('up1-nick', nick); paintNick();
    form.querySelector('button[type=submit]').disabled = true;
    api('messages', { method: 'POST', headers: Object.assign({ Prefer: 'return=minimal' }, H), body: JSON.stringify({ station: station(), nick: nick, body: body, cid: cid }) })
      .then(function () { msgI.value = ''; pollMsgs(); })
      .catch(function (x) { err.textContent = /slow down|too many/.test(String(x.message)) ? 'Slow down a little.' : /language/.test(String(x.message)) ? 'Keep it clean, please.' : 'Could not send. Try again.'; })
      .then(function () { form.querySelector('button[type=submit]').disabled = false; });
  });
  live.hidden = false; document.documentElement.classList.add('has-live');
  pollMsgs(); pollReact(); pollLive();
  setInterval(function () { if (!document.hidden) pollMsgs(); }, 4000);
  setInterval(function () { if (!document.hidden) pollReact(); }, 5000);
  setInterval(function () { if (!document.hidden) pollLive(); }, 2500);
})();
