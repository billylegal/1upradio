// 1UP Radio chat room + reactions (fire, hearts...). Talks to a small Supabase project over plain REST (no library); hidden until chat-config.js has the project URL and key.
(function () {
  var C = window.UP1_CHAT || {}; if (!C.url || !C.key) return;
  var card = document.getElementById('chatcard'); if (!card) return;
  var KINDS = [['fire', '🔥'], ['heart', '❤️'], ['hands', '🙌'], ['music', '🎶'], ['clap', '👏']];
  var BAD = /(fuck|shit|bitch|cunt|nigg|fagg|rape|retard)/i;
  var $ = function (id) { return document.getElementById(id); };
  var list = $('chatlist'), form = $('chatform'), nickI = $('chatnick'), msgI = $('chatmsg'), bar = $('chatreact'), err = $('chaterr'), title = $('chattitle');
  var cid; try { cid = localStorage.getItem('up1-cid'); if (!cid) { cid = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); localStorage.setItem('up1-cid', cid); } } catch (e) { cid = String(Math.random()).slice(2); }
  try { nickI.value = localStorage.getItem('up1-nick') || ''; } catch (e) {}
  var H = { apikey: C.key, 'Content-Type': 'application/json' }; if (!/^sb_/.test(C.key)) H.Authorization = 'Bearer ' + C.key;   // new-style publishable keys (sb_...) go in apikey only
  function api(path, opt) { return fetch(C.url.replace(/\/$/, '') + '/rest/v1/' + path, Object.assign({ headers: H }, opt || {})).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t); }); return r.status === 204 ? null : r.json(); }); }
  function station() { return window.UP1_STATION || '1up'; }
  function songId() { var p = window.UP1_NOW; return p && p.id ? String(p.id) : ''; }
  var lastId = 0, shown = '', counts = {};

  function paintMsgs(rows) {
    var near = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    list.textContent = '';
    if (!rows.length) { var e = document.createElement('div'); e.className = 'chatempty'; e.textContent = 'No messages yet. Say hi!'; list.appendChild(e); }
    rows.forEach(function (m) {
      var d = document.createElement('div'); d.className = 'chatmsg';
      var n = document.createElement('b'); n.textContent = m.nick; var t = document.createElement('span'); t.textContent = m.body;
      d.appendChild(n); d.appendChild(t); list.appendChild(d);
    });
    if (near) list.scrollTop = list.scrollHeight;
  }
  function pollMsgs() {
    var st = station();
    if (st !== shown) { shown = st; lastId = 0; list.textContent = ''; title.textContent = ({ '1up': '1UP Radio', cultureshock: 'Culture Shock', vault: 'The Vault', movement: 'The Movement' }[st] || '1UP Radio') + ' chat'; }
    api('messages?select=id,nick,body&station=eq.' + encodeURIComponent(st) + '&order=id.desc&limit=40').then(function (rows) {
      rows.reverse(); var top = rows.length ? rows[rows.length - 1].id : 0;
      if (top !== lastId || !list.childNodes.length) { lastId = top; paintMsgs(rows); }
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
  function float(btn, emoji) {
    var f = document.createElement('span'); f.className = 'chatfloat'; f.textContent = emoji; btn.appendChild(f); setTimeout(function () { f.remove(); }, 1100);
  }
  KINDS.forEach(function (k) {
    var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-k', k[0]); b.setAttribute('aria-label', k[0]); b.disabled = true;
    b.innerHTML = '<span>' + k[1] + '</span><i></i>'; bar.appendChild(b);
    b.addEventListener('click', function () {
      var sid = songId(); if (!sid) return; counts[k[0]] = (counts[k[0]] || 0) + 1; paintReact(); float(b, k[1]);
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
  card.hidden = false;
  pollMsgs(); pollReact();
  setInterval(function () { if (!document.hidden) { pollMsgs(); } }, 4000);
  setInterval(function () { if (!document.hidden) pollReact(); }, 5000);
})();
