/* Station picker: tap the 1UP logo to choose a station. Runs before app.js and tells it which schedule file to follow. */
(function () {
  var ST = [
    { id: '1up', name: '1UP Radio', sub: 'The main station: deep house, melodic, electronic, all day', sched: 'schedule.json', art: 'assets/logo.png', tag: 'Keep the volume up' },
    { id: 'cultureshock', name: 'Culture Shock', sub: 'Roots reggae and dub, all day', sched: 'schedule-culture.json', art: 'assets/cultureshock.svg?v=2', tag: 'Roots · reggae · dub' },
    { id: 'movement', name: 'The Movement', sub: 'Hand-selected house and Afro tracks', soon: 1, art: 'assets/logo.png' },
    { id: 'trap', name: 'Trap', sub: 'Heavy 808s and hard-hitting trap', soon: 1, art: 'assets/logo.png' }
  ];
  var KEY = 'up1-station', cur = ST[0], m;
  try { m = /[?&]station=([a-z0-9]+)/.exec(location.search); var want = m ? m[1] : localStorage.getItem(KEY); ST.forEach(function (s) { if (s.id === want && !s.soon) cur = s; }); } catch (e) {}
  if (/[?&]ailocal=1/.test(location.search)) window.UP1_AI_URL = 'ai/';   // preview: read the AI lyrics from this PC instead of the live site
  if (cur.id === 'cultureshock') { var cm = /[?&]cs=([123])/.exec(location.search); var pick = cm ? cm[1] : '';
    if (!pick) { var last = ''; try { last = localStorage.getItem('up1-cs-look') || ''; } catch (e) {} var all = ['1', '2', '3'].filter(function (n) { return n !== last; }); pick = all[Math.floor(Math.random() * all.length)]; }   // a different look each time someone opens Culture Shock
    try { localStorage.setItem('up1-cs-look', pick); } catch (e) {}
    document.documentElement.setAttribute('data-cs', pick); }
  if (/[?&]nogate=1/.test(location.search)) { var gs = document.createElement('style'); gs.textContent = '#tapgate{display:none!important}'; (document.head || document.documentElement).appendChild(gs); }   // preview only
  window.UP1_SCHEDULE = cur.sched; window.UP1_STATION = cur.id;
  document.documentElement.setAttribute('data-station', cur.id);
  function ready() {
    var rad = document.querySelector('.logo .rad'), tag = document.querySelector('.top .tag'), img = document.querySelector('.logo img');
    if (cur.id !== '1up') {
      document.title = cur.name + ' · 1UP Radio';
      if (rad) rad.textContent = cur.name.toUpperCase();
      if (img) img.src = cur.art;
      var na = document.getElementById('npArtist'); if (na) na.textContent = cur.tag + ' · all day';
    }
    // Share button after the volume: shares THIS station (1UP Radio = the home page, the others = their own link with a preview card)
    var ctl = document.querySelector('.ctl'), vol = ctl && ctl.querySelector('.vol');
    if (ctl) {
      var sb = document.createElement('button'); sb.type = 'button'; sb.id = 'shareBtn'; sb.className = 'savebtn sharebtn'; sb.textContent = '\u2197 Share'; sb.setAttribute('aria-label', 'Share ' + cur.name);
      if (vol && vol.nextSibling) ctl.insertBefore(sb, vol.nextSibling); else ctl.appendChild(sb);
      sb.addEventListener('click', function () {
        var url = location.origin + (cur.id === '1up' ? '/' : '/s/' + cur.id + '/'), title = cur.name + ' \u00b7 1UP Radio', txt = 'Listen to ' + cur.name + ' on 1UP Radio. Keep the volume up.';
        var flash = function (m) { sb.textContent = m; setTimeout(function () { sb.textContent = '\u2197 Share'; }, 1800); };
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
    var box = document.createElement('div'); box.id = 'stations'; box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Choose a station');
    box.innerHTML = '<div class="stbox"><button type="button" class="stx" aria-label="Close">&times;</button><h2>CHOOSE A STATION</h2>' + ST.map(function (s) {
      return '<button type="button" class="stcard' + (s.id === cur.id ? ' on' : '') + (s.soon ? ' soon' : '') + '" data-id="' + s.id + '"' + (s.soon ? ' disabled' : '') + '><img src="' + s.art + '" alt="" width="64" height="64"><span><b>' + s.name + '</b><small>' + s.sub + '</small></span><i>' + (s.soon ? 'COMING SOON' : s.id === cur.id ? 'ON AIR' : 'TUNE IN') + '</i></button>';
    }).join('') + '</div>';
    document.body.appendChild(box);
    function open(o) { box.hidden = !o; }
    logo.addEventListener('click', function (e) { e.preventDefault(); open(box.hidden); });
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.closest('.stx')) return open(false);
      var c = e.target.closest('.stcard'); if (!c || c.disabled) return;
      if (c.dataset.id === cur.id) return open(false);
      try { localStorage.setItem(KEY, c.dataset.id); } catch (er) {}
      location.href = location.pathname + (c.dataset.id === '1up' ? '' : '?station=' + c.dataset.id);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') open(false); });
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
