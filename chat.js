// 1UP Radio chat room + reactions (fire, hearts...). Talks to a small Supabase project over plain REST (no library); hidden until chat-config.js has the project URL and key.
(function () {
  var C = window.UP1_CHAT || {}; if (!C.url || !C.key) return;
  var card = document.getElementById('chatcard'), strip = document.getElementById('reactstrip'); if (!card || !strip) return;
  var KINDS = [['fire', '🔥'], ['heart', '❤️'], ['hands', '🙌'], ['music', '🎧'], ['clap', '👏']];
  var BAD = /(fuck|shit|bitch|cunt|nigg|fagg|rape|retard)/i;
  var $ = function (id) { return document.getElementById(id); };
  var list = $('chatlist'), form = $('chatform'), nickI = $('chatnick'), msgI = $('chatmsg'), bar = $('chatreact'), err = $('chaterr'), title = $('chattitle'), openB = $('chatopen'), closeB = $('chatclose'), back = $('chatback'), badge = $('chatbadge');
  var cid; try { cid = localStorage.getItem('up1-cid'); if (!cid) { cid = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); localStorage.setItem('up1-cid', cid); } } catch (e) { cid = String(Math.random()).slice(2); }
  try { nickI.value = localStorage.getItem('up1-nick') || ''; } catch (e) {}
  var H = { apikey: C.key, 'Content-Type': 'application/json' }; if (!/^sb_/.test(C.key)) H.Authorization = 'Bearer ' + C.key;   // new-style publishable keys (sb_...) go in apikey only
  function api(path, opt) { return fetch(C.url.replace(/\/$/, '') + '/rest/v1/' + path, Object.assign({ headers: H }, opt || {})).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t); }); return r.status === 204 ? null : r.json(); }); }
  function station() { return window.UP1_STATION || '1up'; }
  function songId() { var p = window.UP1_NOW; return p && p.id ? String(p.id) : ''; }
  var lastId = 0, shown = '', counts = {}, seen = 0;
  function isOpen() { return !card.hidden; }
  function openChat() { card.hidden = false; back.hidden = false; openB.setAttribute('aria-expanded', 'true'); seen = lastId; badge.hidden = true; list.scrollTop = list.scrollHeight; if (!nickI.value) nickI.focus(); else msgI.focus(); }
  function closeChat() { card.hidden = true; back.hidden = true; openB.setAttribute('aria-expanded', 'false'); openB.focus(); }
  openB.addEventListener('click', function () { isOpen() ? closeChat() : openChat(); });
  closeB.addEventListener('click', closeChat); back.addEventListener('click', closeChat);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) closeChat(); });

  function paintMsgs(rows) {
    var near = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    list.textContent = '';
    if (!rows.length) { var e = document.createElement('div'); e.className = 'chatempty'; e.textContent = 'No messages yet. Say hi!'; list.appendChild(e); }
    rows.forEach(function (m) {
      var d = document.createElement('div'), hue = 0; d.className = 'chatmsg'; for (var i = 0; i < m.nick.length; i++) hue = (hue * 31 + m.nick.charCodeAt(i)) % 360;
      var av = document.createElement('span'); av.className = 'av'; av.textContent = m.nick.charAt(0); av.style.background = 'hsl(' + hue + ',55%,42%)';
      var w = document.createElement('div'), n = document.createElement('b'); n.textContent = m.nick; n.style.color = 'hsl(' + hue + ',75%,72%)'; var t = document.createElement('span'); t.className = 't'; t.textContent = m.body;
      w.appendChild(n); w.appendChild(t); d.appendChild(av); d.appendChild(w); list.appendChild(d);
    });
    if (near) list.scrollTop = list.scrollHeight;
  }
  function pollMsgs() {
    var st = station();
    if (st !== shown) { shown = st; lastId = 0; list.textContent = ''; title.textContent = ({ '1up': '1UP Radio', cultureshock: 'Culture Shock', vault: 'The Vault', movement: 'The Movement' }[st] || '1UP Radio'); }
    api('messages?select=id,nick,body&station=eq.' + encodeURIComponent(st) + '&order=id.desc&limit=40').then(function (rows) {
      rows.reverse(); var top = rows.length ? rows[rows.length - 1].id : 0;
      if (top !== lastId || !list.childNodes.length) { lastId = top; paintMsgs(rows); }
      if (isOpen()) seen = top; else { var fresh = rows.filter(function (r) { return r.id > seen; }).length; if (seen === 0) seen = top; else { badge.textContent = fresh > 9 ? '9+' : String(fresh); badge.hidden = !fresh; } }
    }).catch(function () {});
  }
  function paintReact() {
    var sid = songId();
    bar.querySelectorAll('button').forEach(function (b) { var k = b.getAttribute('data-k'), n = counts[k] || 0; b.querySelector('i').textContent = n ? String(n) : ''; b.disabled = !sid; });
  }
  function pollReact() {
    var sid = songId(); if (!sid) { counts = {}; paintReact(); return; }
    api('rpc/reaction_counts', { method: 'POST', body: JSON.stringify({ song_id: sid }) }).then(function (rows) {
      if (sid !== songId()) return; counts = {}; rows.forEach(function (r) { counts[r.kind] = Number(r.n); }); paintReact();
    }).catch(function () {});
  }
  // live reactions: other people's taps float up at the corner of the screen, near the player, while you listen
  var fx = document.createElement('div'); fx.id = 'reactfx'; fx.setAttribute('aria-hidden', 'true'); strip.appendChild(fx);
  var EMO = {}; KINDS.forEach(function (k) { EMO[k[0]] = k[1]; });
  function burst(kind, x) {   // x = where along the strip it starts (px); random when someone else tapped
    if (!EMO[kind] || fx.childNodes.length > 30) return;
    var f = document.createElement('span'); f.className = 'rfx'; f.textContent = EMO[kind];
    var w = strip.clientWidth || 200; f.style.left = Math.round(x == null ? 12 + Math.random() * (w - 40) : Math.max(4, Math.min(w - 30, x - 10 + (Math.random() * 16 - 8)))) + 'px';
    f.style.setProperty('--dx', (Math.round(Math.random() * 60) - 30) + 'px'); f.style.fontSize = (22 + Math.round(Math.random() * 12)) + 'px';
    fx.appendChild(f); setTimeout(function () { f.remove(); }, 2400);
  }
  var head = null, headSt = '';
  function pollLive() {
    var st = station(); if (st !== headSt) { headSt = st; head = null; }
    if (head === null) { api('rpc/reaction_head', { method: 'POST', body: JSON.stringify({ st: st }) }).then(function (n) { if (st === station() && head === null) head = Number(n) || 0; }).catch(function () {}); return; }
    api('rpc/recent_reactions', { method: 'POST', body: JSON.stringify({ st: st, after_id: head, my_cid: cid }) }).then(function (rows) {
      if (st !== station()) return;
      rows.forEach(function (r, i) { head = Math.max(head, Number(r.id)); setTimeout(function () { burst(r.kind); }, i * 220); });
    }).catch(function () {});
  }
  KINDS.forEach(function (k) {
    var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-k', k[0]); b.setAttribute('aria-label', k[0]); b.disabled = true;
    b.innerHTML = '<span>' + k[1] + '</span><i></i>'; bar.appendChild(b);
    b.addEventListener('click', function () {
      var sid = songId(); if (!sid) return; counts[k[0]] = (counts[k[0]] || 0) + 1; paintReact(); var cx = b.offsetLeft + b.offsetWidth / 2; for (var j = 0; j < 3; j++) (function (d) { setTimeout(function () { burst(k[0], cx); }, d); })(j * 90);
      api('reactions', { method: 'POST', headers: Object.assign({ Prefer: 'return=minimal' }, H), body: JSON.stringify({ station: station(), song: sid, kind: k[0], cid: cid }) }).catch(function () { counts[k[0]] = Math.max(0, (counts[k[0]] || 1) - 1); paintReact(); });
    });
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault(); err.textContent = '';
    var nick = nickI.value.trim().replace(/\s+/g, ' ').slice(0, 20), body = msgI.value.trim().slice(0, 200);
    if (!nick) { err.textContent = 'Pick a nickname first.'; nickI.focus(); return; }
    if (!body) return;
    if (BAD.test(nick + ' ' + body)) { err.textContent = 'Keep it clean, please.'; return; }
    try { localStorage.setItem('up1-nick', nick); } catch (e2) {}
    form.querySelector('button').disabled = true;
    api('messages', { method: 'POST', headers: Object.assign({ Prefer: 'return=minimal' }, H), body: JSON.stringify({ station: station(), nick: nick, body: body, cid: cid }) })
      .then(function () { msgI.value = ''; pollMsgs(); })
      .catch(function (x) { err.textContent = /slow down|too many/.test(String(x.message)) ? 'Slow down a little.' : /language/.test(String(x.message)) ? 'Keep it clean, please.' : 'Could not send. Try again.'; })
      .then(function () { form.querySelector('button').disabled = false; });
  });
  strip.hidden = false;
  pollMsgs(); pollReact();
  setInterval(function () { if (!document.hidden) { pollMsgs(); } }, 4000);
  setInterval(function () { if (!document.hidden) pollReact(); }, 5000);
  pollLive(); setInterval(function () { if (!document.hidden) pollLive(); }, 2500);
})();
