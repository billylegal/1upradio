/* Station picker: tap the 1UP logo to choose a station. Runs before app.js and tells it which schedule file to follow. */
(function () {
  var ST = [
    { id: '1up', name: '1UP Radio', sub: 'The main station: deep house, melodic, electronic, all day', sched: 'schedule.json', art: 'assets/logo.png', tag: 'Keep the volume up' },
    { id: 'cultureshock', name: 'Culture Shock', sub: 'Roots reggae and dub, all day', sched: 'schedule-culture.json', art: 'assets/cultureshock.svg?v=2', mark: 'assets/cultureshock-mark.svg?v=1', tag: 'Roots · reggae · dub', artmap: 'data/culture-art.json', skins: ['culture', 'shock', 'dubby'] },
    { id: 'vault', name: 'The Vault', sub: 'Hip hop vinyl: 90s underground demos, boom bap archives, digging in the crates', sched: 'schedule-hiphopvinyl.json', art: 'assets/vault-art.png?v=2', mark: 'assets/vault-mark.svg?v=3', tag: 'Hip hop vinyl · underground · boom bap', artmap: 'data/hiphopvinyl-art.json', start: 'vault', short: 'THE VAULT' },
    { id: 'movement', name: 'The Movement', sub: 'Hand-selected house and Afro tracks', sched: 'schedule-movement.json', art: 'assets/movement-art.png?v=2', mark: 'assets/movement-mark.svg?v=3', tag: 'House · Afro', artmap: 'data/movement-art.json', start: 'house', short: 'THE MOVEMENT' },
    { id: 'trap', name: 'Trap', sub: 'Heavy 808s and hard-hitting trap', soon: 1, art: 'assets/logo.png' }
  ];
  var KEY = 'up1-station', cur = ST[0], m, root = document.documentElement;
  function byId(id) { for (var i = 0; i < ST.length; i++) if (ST[i].id === id && !ST[i].soon) return ST[i]; return null; }
  try { m = /[?&]station=([a-z0-9]+)/.exec(location.search); var want = m ? m[1] : localStorage.getItem(KEY); cur = byId(want) || ST[0]; } catch (e) {}
  if (/[?&]ailocal=1/.test(location.search)) window.UP1_AI_URL = 'ai/';   // preview: read the AI lyrics from this PC instead of the live site
  // which skin a station opens in: Culture Shock = one of its three own (a different one each time), the others = their own look, the main station = Nebula
  function chooseSkin(st, first) {
    var ms = first && /[?&]skin=([a-z]+)/.exec(location.search), cm = first && /[?&]cs=([123])/.exec(location.search);
    if (st.skins) {
      var OWN = st.skins, pick = ms ? ms[1] : (cm ? OWN[+cm[1] - 1] : '');
      if (!pick) { var last = ''; try { last = localStorage.getItem('up1-cs-skin') || ''; } catch (e) {} var all = OWN.filter(function (n) { return n !== last; }); pick = all[Math.floor(Math.random() * all.length)]; }
      try { localStorage.setItem('up1-cs-skin', pick); } catch (e) {}
      return pick;
    }
    return ms ? ms[1] : (st.start || '');
  }
  function globals(st, first) {
    window.UP1_STATION = st.id; window.UP1_SCHEDULE = st.sched; window.UP1_ARTMAP = st.artmap || ''; window.UP1_OWN_SKINS = st.skins || null;
    window.UP1_START_SKIN = chooseSkin(st, first); root.setAttribute('data-station', st.id);
  }
  globals(cur, true);
  if (/[?&]nogate=1/.test(location.search)) { var gs = document.createElement('style'); gs.textContent = '#tapgate{display:none!important}'; (document.head || document.documentElement).appendChild(gs); }   // preview only
  try {
    if (sessionStorage.getItem('up1-skipgate') === '1') {
      sessionStorage.removeItem('up1-skipgate');
      var sg = document.createElement('style'); sg.textContent = '#tapgate{display:none!important}'; (document.head || document.documentElement).appendChild(sg);
      var rg = function () { var g = document.getElementById('tapgate'); if (g) g.remove(); };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', rg); else rg();
    }
  } catch (e) {}
  var WORDS = 'DIGGING IN THE CRATES \u2605 RARE \u2605 90s UNDERGROUND \u2605 BOOM BAP ARCHIVES \u2605 HIDDEN GEMS \u2605 DEMOS \u2605 VINYL ONLY \u2605 ';
  function vaultDeco(on) {   // The Vault: a tape ribbon above the lists and big words down both sides
    document.querySelectorAll('.vtape,.vside').forEach(function (e) { e.remove(); });
    if (!on) return;
    var cols = document.querySelector('main .cols');
    if (cols) { var t = document.createElement('div'); t.className = 'vtape'; t.setAttribute('aria-hidden', 'true'); t.innerHTML = '<div class="vtrack"><span>' + WORDS + WORDS + '</span><span>' + WORDS + WORDS + '</span></div>'; cols.parentNode.insertBefore(t, cols); }
    ['vl', 'vr'].forEach(function (c) { var d = document.createElement('div'); d.className = 'vside ' + c; d.setAttribute('aria-hidden', 'true'); d.textContent = WORDS + WORDS + WORDS; document.body.appendChild(d); });
  }
  var origTitle = document.title, origImg = '', box, logoEl;
  function paintUI(st) {   // everything on the page that carries the station's name, logo and look
    var rad = document.querySelector('.logo .rad'), img = document.querySelector('.logo img'), isMain = st.id === '1up';
    document.title = isMain ? origTitle : st.name + ' \u00b7 1UP Radio';
    if (rad) rad.textContent = isMain ? 'RADIO (ORIGINAL)' : (st.short || st.name).toUpperCase();
    if (img) { if (!origImg) origImg = img.getAttribute('src'); img.src = isMain ? origImg : (st.mark || st.art); }
    if (!isMain) { var na = document.getElementById('npArtist'); if (na && !document.getElementById('play').classList.contains('on')) na.textContent = st.tag + ' \u00b7 all day'; }
    var sbn = document.getElementById('shareBtn'); if (sbn) { sbn.title = 'Share ' + st.name; sbn.setAttribute('aria-label', 'Share ' + st.name); }
    vaultDeco(st.id === 'vault');
    if (box) box.querySelectorAll('.stcard').forEach(function (c) { var on = c.dataset.id === st.id, i = c.querySelector('i'); c.classList.toggle('on', on); if (i && !c.classList.contains('soon')) i.textContent = on ? 'ON AIR' : 'TUNE IN'; });
  }
  function stationFromUrl() { var mm = /[?&]station=([a-z0-9]+)/.exec(location.search); return byId(mm ? mm[1] : '1up') || ST[0]; }
  function switchTo(st, push) {   // change station without reloading the page, so the music never stops
    if (!st || st.soon || st.id === cur.id) return;
    cur = st; globals(st, false);
    try { localStorage.setItem(KEY, st.id); } catch (e) {}
    if (push) { try { history.pushState({ st: st.id }, '', location.pathname + (st.id === '1up' ? '' : '?station=' + st.id)); } catch (e) {} }
    paintUI(st);
    if (window.UP1_SWITCH) window.UP1_SWITCH(st); else location.reload();
  }
  window.addEventListener('popstate', function () { switchTo(stationFromUrl(), false); });
  function ready() {
    var rad = document.querySelector('.logo .rad');
    var lg = document.querySelector('.logo'), one = lg && lg.querySelector('.one');
    if (lg && one && rad) {   // the name on one line ("1UP RADIO (ORIGINAL)", "1UP CULTURE SHOCK") with "Keep the volume up" underneath
      var wrap = document.createElement('span'); wrap.className = 'stwrap'; var ln = document.createElement('span'); ln.className = 'stline';
      lg.insertBefore(wrap, one); ln.appendChild(one); ln.appendChild(rad); wrap.appendChild(ln);
      var sub = document.createElement('span'); sub.className = 'stsub'; sub.innerHTML = 'Keep the volume up<span class="blink">_</span>'; wrap.appendChild(sub);
    }
    root.classList.add('st-sub');
    // Share button after the volume: shares THIS station (1UP Radio = the home page, the others = their own link with a preview card)
    var ctl = document.querySelector('.ctl'), vol = ctl && ctl.querySelector('.vol');
    if (ctl) {
      var sb = document.createElement('button'); sb.type = 'button'; sb.id = 'shareBtn'; sb.className = 'sharebtn'; sb.title = 'Share ' + cur.name; sb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span class="sharetip" hidden></span>'; sb.setAttribute('aria-label', 'Share ' + cur.name);
      if (vol && vol.nextSibling) ctl.insertBefore(sb, vol.nextSibling); else ctl.appendChild(sb);
      // Pop-out button (computers): the player in its own small window you can drop in a corner or move anywhere - it keeps playing while you browse
      var pb = document.createElement('button'); pb.type = 'button'; pb.id = 'popBtn'; pb.className = 'sharebtn popbtn'; pb.title = 'Pop out the player'; pb.setAttribute('aria-label', 'Pop out the player');
      pb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h9v2H6v11h11v-7h2v9H4z"/><path d="M14 4h7v7h-2V7.4l-6.3 6.3-1.4-1.4L17.6 6H14z"/></svg><span class="sharetip" hidden></span>';
      sb.parentNode.insertBefore(pb, sb.nextSibling);
      pb.addEventListener('click', function () {
        var w = 400, h = 240, left = Math.max(0, (screen.availLeft || 0) + screen.availWidth - w - 24), top = (screen.availTop || 0) + 24;
        var win = null; try { win = window.open('player.html?station=' + cur.id, 'up1pop', 'popup=yes,width=' + w + ',height=' + h + ',left=' + left + ',top=' + top); } catch (e) {}
        var tip = pb.querySelector('.sharetip');
        if (!win) { tip.textContent = 'Allow pop-ups to use this'; tip.hidden = false; setTimeout(function () { tip.hidden = true; }, 2600); return; }
        var pl = document.getElementById('play'); if (pl && pl.classList.contains('on')) pl.click();   // the pop-out takes over, so the music is not doubled
        try { win.focus(); } catch (e) {}
      });
      sb.addEventListener('click', function () {
        var url = location.origin + (cur.id === '1up' ? '/' : '/s/' + cur.id + '/'), title = cur.name + ' \u00b7 1UP Radio', txt = 'Listen to ' + cur.name + ' on 1UP Radio. Keep the volume up.';
        var flash = function (m) { var t = sb.querySelector('.sharetip'); t.textContent = m; t.hidden = false; setTimeout(function () { t.hidden = true; }, 1800); };
        var copy = function () {
          var ta = document.createElement('textarea'); ta.value = url; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
          var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove();
          if (ok) flash('\u2713 Link copied'); else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { flash('\u2713 Link copied'); }, function () { flash(url); }); else flash(url);
        };
        if (navigator.share) navigator.share({ title: title, text: txt, url: url }).catch(function (e) { if (e && e.name !== 'AbortError') copy(); }); else copy();
      });
    }
    var logo = document.querySelector('a.logo'); if (!logo) return;
    logo.setAttribute('aria-haspopup', 'dialog'); logo.insertAdjacentHTML('beforeend', '<span class="stcaret" aria-hidden="true">&#9662;</span>');
    box = document.createElement('div'); box.id = 'stations'; box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Choose a station');
    box.innerHTML = '<div class="stbox"><button type="button" class="stx" aria-label="Close">&times;</button><h2>CHOOSE A STATION</h2>' + ST.map(function (s) {
      return '<button type="button" class="stcard' + (s.id === cur.id ? ' on' : '') + (s.soon ? ' soon' : '') + '" data-id="' + s.id + '"' + (s.soon ? ' disabled' : '') + '><img src="' + s.art + '" alt="" width="64" height="64"><span><b>' + s.name + '</b><small>' + s.sub + '</small></span><i>' + (s.soon ? 'COMING SOON' : s.id === cur.id ? 'ON AIR' : 'TUNE IN') + '</i></button>';
    }).join('') + '</div>';
    document.body.appendChild(box);
    function open(o) { box.hidden = !o; }
    logo.addEventListener('click', function (e) { e.preventDefault(); open(box.hidden); });
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.closest('.stx')) return open(false);
      var c = e.target.closest('.stcard'); if (!c || c.disabled) return;
      open(false); if (c.dataset.id !== cur.id) switchTo(byId(c.dataset.id), true);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') open(false); });
    try { history.replaceState({ st: cur.id }, ''); } catch (e) {}
    paintUI(cur);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();

/* Tap the album cover to see it big */
(function () {
  function ready() {
    var box = document.createElement('div'); box.id = 'artzoom'; box.hidden = true; box.innerHTML = '<img alt="Album cover"><button type="button" aria-label="Close">&times;</button>'; document.body.appendChild(box);
    var img = box.querySelector('img');
    function close() { box.hidden = true; img.removeAttribute('src'); }
    box.addEventListener('click', close); document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    document.addEventListener('click', function (e) {
      var a = e.target.closest('#npArt'); if (!a || !a.getAttribute('src')) return;
      var src = a.currentSrc || a.src, big = src.replace('/mqdefault.jpg', '/hqdefault.jpg');   // YouTube pictures come in a bigger size; album covers are already large
      img.onerror = function () { img.onerror = null; img.src = src; }; img.src = big; box.hidden = false;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();

/* The small shuttle flies in a lane just under the top bar (below THEME / SKIN, above the meters): tell the CSS where the bar ends */
(function () {
  function place() {
    var h = document.querySelector('header.top'); if (!h) return;
    document.documentElement.style.setProperty('--hb', (Math.round(h.getBoundingClientRect().bottom + (window.pageYOffset || 0)) ) + 'px');
  }
  function ready() {
    place(); window.addEventListener('resize', place); window.addEventListener('load', place);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    var n = 0, iv = setInterval(function () { place(); if (++n > 12) clearInterval(iv); }, 500);          // the bar settles as fonts and skins load
    try { new MutationObserver(function () { setTimeout(place, 60); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-skin'] }); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();

