// 1UP Radio extras: sleep timer, share-a-song card, song of the week. Plain DOM add-ons next to the player; nothing here touches the player itself except pausing it when the sleep timer ends.
(function () {
  var $ = function (s) { return document.querySelector(s); };
  function station() { return window.UP1_STATION || '1up'; }
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function mk(id, title, svg) {
    var b = document.createElement('button'); b.type = 'button'; b.id = id; b.className = 'sharebtn xbtn'; b.title = title; b.setAttribute('aria-label', title);
    b.innerHTML = svg + '<span class="sharetip" hidden></span>'; return b;
  }
  function tip(b, m, ms) { var t = b.querySelector('.sharetip'); t.textContent = m; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(function () { t.hidden = true; }, ms || 1800); }

  // ---------- sleep timer ----------
  var STEPS = [0, 30, 60, 90], si = 0, endAt = 0, tick = null, sb;
  function sleepPaint() {
    var m = endAt ? Math.max(1, Math.ceil((endAt - Date.now()) / 60000)) : 0;
    sb.classList.toggle('on', !!endAt); sb.querySelector('em').textContent = endAt ? m + 'm' : '';
    sb.title = endAt ? 'Sleep timer: stops in ' + m + ' min (tap to change)' : 'Sleep timer';
  }
  function sleepSet() {
    si = (si + 1) % STEPS.length; clearInterval(tick);
    if (!STEPS[si]) { endAt = 0; sleepPaint(); tip(sb, 'Sleep timer off'); return; }
    endAt = Date.now() + STEPS[si] * 60000; sleepPaint(); tip(sb, 'Stops in ' + STEPS[si] + ' min', 2200);
    tick = setInterval(function () {
      if (Date.now() >= endAt) {
        clearInterval(tick); endAt = 0; si = 0; sleepPaint();
        var p = document.getElementById('play'); if (p && p.classList.contains('on')) p.click();
        tip(sb, 'Good night ☾', 5000);
      } else sleepPaint();
    }, 15000);
  }

  // ---------- share card ----------
  function wrap(ctx, text, x, y, w, lh, maxLines) {
    var words = String(text).split(/\s+/), line = '', lines = [];
    words.forEach(function (wd) { var t = line ? line + ' ' + wd : wd; if (ctx.measureText(t).width > w && line) { lines.push(line); line = wd; } else line = t; });
    if (line) lines.push(line);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
    lines.forEach(function (l, i) { ctx.fillText(l, x, y + i * lh); });
    return y + lines.length * lh;
  }
  function loadImg(src) { return new Promise(function (ok) { var i = new Image(); i.crossOrigin = 'anonymous'; i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; }); }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function cardMake(btn) {
    var p = window.UP1_NOW; if (!p || !p.id) { tip(btn, 'Play a song first'); return; }
    var W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d');
    var acc = css('--g') || '#8B5CF6', radio = (($('.logo .rad') || {}).textContent || 'RADIO').replace(/\s*\(ORIGINAL\)/i, '');
    var title = String(p.title || ''), i = title.indexOf(' - '), artist = i > 0 ? title.slice(0, i) : '', song = i > 0 ? title.slice(i + 3) : title;
    var art = (typeof window.UP1_COVER === 'function' && window.UP1_COVER(p.id)) || '';
    Promise.all([art ? loadImg(art) : Promise.resolve(null), loadImg('assets/logo.png')]).then(function (r) {
      var g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#07050F'); g.addColorStop(1, '#1b1033'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      var rg = x.createRadialGradient(W / 2, 520, 40, W / 2, 520, 720); rg.addColorStop(0, acc + '66'); rg.addColorStop(1, 'transparent'); x.fillStyle = rg; x.fillRect(0, 0, W, H);
      x.textAlign = 'center'; x.fillStyle = '#ffffffcc'; x.font = '600 34px Barlow, sans-serif'; x.fillText('NOW PLAYING ON 1UP ' + String(radio).toUpperCase(), W / 2, 96);
      var S = 640, ax = (W - S) / 2, ay = 150;
      x.save(); rr(x, ax, ay, S, S, 36); x.clip();
      if (r[0]) x.drawImage(r[0], ax, ay, S, S); else if (r[1]) { x.fillStyle = '#000'; x.fillRect(ax, ay, S, S); x.drawImage(r[1], ax + 60, ay + 60, S - 120, S - 120); }
      x.restore(); x.strokeStyle = acc; x.lineWidth = 6; rr(x, ax, ay, S, S, 36); x.stroke();
      x.fillStyle = '#fff'; x.font = '700 64px Barlow, sans-serif'; var y = wrap(x, song, W / 2, 900, 900, 74, 2);
      if (artist) { x.fillStyle = acc; x.font = '600 44px Barlow, sans-serif'; wrap(x, artist, W / 2, y + 16, 900, 54, 1); }
      x.fillStyle = '#ffffffb0'; x.font = '600 36px Barlow, sans-serif'; x.fillText('Keep the volume up  ·  1upradio.com', W / 2, 1270);
      c.toBlob(function (blob) {
        if (!blob) { tip(btn, 'Could not make the card'); return; }
        var file = new File([blob], '1up-radio-song.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: song, text: 'Listening to ' + title + ' on 1UP Radio · 1upradio.com' }).catch(function () {});
        else { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '1up-radio-song.png'; document.body.appendChild(a); a.click(); a.remove(); tip(btn, 'Card saved'); }
      }, 'image/png');
    });
  }

  // ---------- song of the week (data/featured.json: {"1up": {"id": "VIDEOID", "title": "Artist - Song", "note": "why"}, "movement": {...}}) ----------
  var feat = {}, fcard, auto = {}, FILES = { '1up': 'main', movement: 'movement', cultureshock: 'culture', vault: 'hiphopvinyl', tdot6: 'tdot6', portal: 'portal' };
  function featAuto() {   // a channel without a hand-picked song gets one that changes every week (the same for everyone, picked from that channel's own songs)
    var st = station(), f = FILES[st]; if (!f || auto[st] === 0) return; auto[st] = 0;
    fetch('data/' + f + '-videos.json?t=' + Math.floor(Date.now() / 1800000)).then(function (r) { return r.json(); }).then(function (v) {
      var wk = Math.floor(Date.now() / 6048e5), ok = (v || []).filter(function (s) { return s.id && s.title && (s.dur || 300) >= 120 && !/\b(intro|jingle|id|promo)\b/i.test(s.title); });
      if (!ok.length) return; var s = ok[(wk * 2654435761 >>> 0) % ok.length];
      auto[st] = { id: s.id, title: s.title, note: 'This week\u2019s pick on the channel.' }; featPaint();
    }).catch(function () {});
  }
  var faces = {};
  function faceFor(name, img) {   // the artist's picture beside the button (Deezer; Billy Legal uses his own head)
    if (!img) return; img.hidden = true; if (!name) return;
    function show(u) { if (u && station() && img.isConnected) { img.src = u; img.hidden = false; } }
    if (/^billy legal$/i.test(name)) { show('assets/billy-beatport.jpg'); return; }
    if (faces[name] !== undefined) { show(faces[name]); return; }
    var cb = 'upf' + Math.floor(Math.random() * 1e9), s = document.createElement('script');
    window[cb] = function (d) { var k = String(name).toLowerCase(), h = ((d && d.data) || []).filter(function (a) { return String(a.name).toLowerCase() === k; })[0]; faces[name] = h ? (h.picture_medium || '') : ''; show(faces[name]); delete window[cb]; s.remove(); };
    s.onerror = function () { faces[name] = ''; delete window[cb]; s.remove(); };
    s.src = 'https://api.deezer.com/search/artist?q=' + encodeURIComponent(name) + '&limit=5&output=jsonp&callback=' + cb; document.head.appendChild(s);
  }
  function featPaint() {
    var f = feat[station()] || auto[station()];
    if (!f || !f.id) { fcard.hidden = true; if (!feat[station()] && !auto[station()]) featAuto(); return; }
    fcard.hidden = false; fcard.querySelector('.ftitle').textContent = f.title || ''; fcard.querySelector('.fnote').textContent = f.note || '';
    var fp = fcard.querySelector('.fprof'), who = String(f.title || '').split(/\s[-\u2013]\s/)[0].split(/\s*(?:,|&|\bfeat\.?|\bft\.?|\bx\b)\s*/i)[0].trim(); fp.hidden = !who; fp.setAttribute('data-artist', who);   // the week's pick opens the artist's profile card
    faceFor(who, fp.querySelector('.fface'));
  }
  function featInit() {
    var cols = $('.cols'); if (!cols) return;
    fcard = document.createElement('section'); fcard.className = 'card featured'; fcard.hidden = true;
    fcard.innerHTML = '<h2>★ Song of the week</h2><div class="ftitle"></div><div class="fnote"></div><div class="flinks"><a class="chip found fprof artlnk" href="#" role="button"><img class="fface" alt="" hidden referrerpolicy="no-referrer"><span>Artist profile</span></a><a class="chip found azlink fall" href="#" role="button">All artists</a></div>';
    cols.parentNode.insertBefore(fcard, cols);
    fetch('data/featured.json?t=' + Math.floor(Date.now() / 600000)).then(function (r) { return r.json(); }).then(function (j) { feat = j || {}; featPaint(); }).catch(function () {});
    var last = station(); setInterval(function () { if (station() !== last) { last = station(); featPaint(); } }, 1500);
    function pairUp() {   // Sound clash (left) and Song of the week (right) share one row
      var clash = document.querySelector('.card.clash'), pr = document.getElementById('cpair');
      if (!clash || !fcard || !cols.parentNode) return;
      if (!pr) { pr = document.createElement('div'); pr.id = 'cpair'; pr.className = 'cpair'; cols.parentNode.insertBefore(pr, cols); }
      if (clash.parentNode !== pr) pr.appendChild(clash);
      if (fcard.parentNode !== pr) pr.appendChild(fcard);
      if (pr.firstChild !== clash) pr.insertBefore(clash, pr.firstChild);
    }
    var pt = setInterval(function () { pairUp(); if (document.getElementById('cpair')) clearInterval(pt); }, 500);
  }

  function init() {
    var share = document.getElementById('shareBtn');
    if (!share) { if (init.n++ < 40) setTimeout(init, 300); return; }
    sb = mk('sleepBtn', 'Sleep timer', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/></svg><em></em>');
    share.parentNode.insertBefore(sb, share.nextSibling);
    sb.addEventListener('click', sleepSet);
    featInit();
  }
  init.n = 0;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
