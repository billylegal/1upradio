/* Station picker: tap the 1UP logo to choose a station. Runs before app.js and tells it which schedule file to follow. */
(function () {
  var ST = [
    { id: '1up', name: '1UP Radio', sub: 'The main station: deep house, melodic, electronic, all day', sched: 'schedule.json', art: 'assets/logo.png', tag: 'Keep the volume up', artmap: 'data/main-art.json' },
    { id: 'cultureshock', name: 'Culture Shock', sub: 'Roots reggae and dub, all day', sched: 'schedule-culture.json', art: 'assets/cultureshock.svg?v=2', mark: 'assets/cultureshock-mark.svg?v=3', tag: 'Roots · reggae · dub', artmap: 'data/culture-art.json', skins: ['culture', 'shock', 'dubby'] },
    { id: 'vault', name: 'The Vault', sub: 'Hip hop vinyl: 90s underground demos, boom bap archives, digging in the crates', sched: 'schedule-hiphopvinyl.json', art: 'assets/vault-art.png?v=2', mark: 'assets/vault-mark.svg?v=3', tag: 'Hip hop vinyl · underground · boom bap', artmap: 'data/hiphopvinyl-art.json', start: 'vault', short: 'THE VAULT' },
    { id: 'movement', name: 'The Movement', sub: 'Hand-selected house and Afro tracks', sched: 'schedule-movement.json', art: 'assets/movement-art.png?v=2', mark: 'assets/movement-mark.svg?v=3', tag: 'House · Afro', artmap: 'data/movement-art.json', start: 'house', short: 'THE MOVEMENT' },
    { id: 'tdot6', name: 'T.DOT 6', sub: 'All Toronto music: slow, late-night R&B and rap', artmap: 'data/tdot6-art.json', sched: 'schedule-tdot6.json', art: 'assets/tdot6-art.png?v=3', mark: 'assets/tdot6-art.png?v=3', tag: 'Toronto · R&B · late night', start: 'space', short: 'T.DOT 6', soon: 1, locked: 1 },
    { id: 'tdot6dark', name: 'T.DOT 6 \u00b7 Dark R&B', sub: 'T.DOT 6, the dark R&B sound: The Weeknd, PARTYNEXTDOOR, dvsn, Majid Jordan and more', artmap: 'data/tdot6-art.json', sched: 'schedule-tdot6dark.json', art: 'assets/tdot6-art.png?v=3', mark: 'assets/tdot6-art.png?v=3', tag: 'Dark R&B', start: 'space', short: 'T.DOT 6 \u00b7 DARK R&B', soon: 1, locked: 1, group: 'tdot6' },
    { id: 'tdot6after', name: 'T.DOT 6 \u00b7 After Hours', sub: 'T.DOT 6, late night: the moodiest tracks, slow and dark', artmap: 'data/tdot6-art.json', sched: 'schedule-tdot6after.json', art: 'assets/tdot6-art.png?v=3', mark: 'assets/tdot6-art.png?v=3', tag: 'After Hours', start: 'space', short: 'T.DOT 6 \u00b7 AFTER HOURS', soon: 1, locked: 1, group: 'tdot6' },
    { id: 'tdot6slow', name: 'T.DOT 6 \u00b7 Slow Jams', sub: 'T.DOT 6, slow jams: Drake and mellow Toronto R&B', artmap: 'data/tdot6-art.json', sched: 'schedule-tdot6slow.json', art: 'assets/tdot6-art.png?v=3', mark: 'assets/tdot6-art.png?v=3', tag: 'Slow Jams', start: 'space', short: 'T.DOT 6 \u00b7 SLOW JAMS', soon: 1, locked: 1, group: 'tdot6' },
    { id: 'tdot6old', name: 'T.DOT 6 \u00b7 Old School Toronto', sub: 'T.DOT 6, old school Toronto R&B and soul', artmap: 'data/tdot6-art.json', sched: 'schedule-tdot6old.json', art: 'assets/tdot6-art.png?v=3', mark: 'assets/tdot6-art.png?v=3', tag: 'Old School Toronto', start: 'space', short: 'T.DOT 6 \u00b7 OLD SCHOOL', soon: 1, locked: 1, group: 'tdot6' },
    { id: 'tdot6hh', name: 'T.DOT 6 \u00b7 90s & 2000s Hip Hop', sub: 'T.DOT 6, 90s and early 2000s Toronto hip hop', artmap: 'data/tdot6-art.json', sched: 'schedule-tdot6hh.json', art: 'assets/tdot6-art.png?v=3', mark: 'assets/tdot6-art.png?v=3', tag: 'Toronto hip hop \u00b7 90s & 2000s', start: 'space', short: 'T.DOT 6 \u00b7 TORONTO HIP HOP', soon: 1, locked: 1, group: 'tdot6' },
    { id: 'portal', name: 'The Portal', sub: 'Every genre, one door: house, tech house, techno, bass, drum & bass and more, straight from the charts', artmap: 'data/portal-art.json', sched: 'schedule-portal.json', art: 'assets/portal-art.png?v=3', mark: 'assets/portal-mark.svg?v=3', tag: 'Every beat · every genre', start: 'portal', short: 'THE PORTAL' },
    { id: 'pgpeaktechno', name: 'Portal · Techno · Peak Time', sub: 'The Portal, Techno · Peak Time chart only', artmap: 'data/portal-art.json', sched: 'schedule-pgpeaktechno.json', art: 'assets/portal-art.png?v=3', mark: 'assets/portal-mark.svg?v=3', tag: 'Techno · Peak Time', start: 'portal', short: 'PORTAL · TECHNO · PEAK TIME', vfile: 'portal-techno-peak-time-driving', group: 'portal' },
    { id: 'pgrawtechno', name: 'Portal · Techno · Raw & Hypnotic', sub: 'The Portal, Techno · Raw & Hypnotic chart only', artmap: 'data/portal-art.json', sched: 'schedule-pgrawtechno.json', art: 'assets/portal-art.png?v=3', mark: 'assets/portal-mark.svg?v=3', tag: 'Techno · Raw & Hypnotic', start: 'portal', short: 'PORTAL · TECHNO · RAW & HYPNOTIC', vfile: 'portal-techno-raw-deep-hypnotic', group: 'portal' },
    { id: 'pghardtechno', name: 'Portal · Hard Techno', sub: 'The Portal, Hard Techno chart only', artmap: 'data/portal-art.json', sched: 'schedule-pghardtechno.json', art: 'assets/portal-art.png?v=3', mark: 'assets/portal-mark.svg?v=3', tag: 'Hard Techno', start: 'portal', short: 'PORTAL · HARD TECHNO', vfile: 'portal-hard-techno', group: 'portal' },
    { id: 'pgtechhouse', name: 'Portal · Tech House', sub: 'The Portal, Tech House chart only', artmap: 'data/portal-art.json', sched: 'schedule-pgtechhouse.json', art: 'assets/portal-art.png?v=3', mark: 'assets/portal-mark.svg?v=3', tag: 'Tech House', start: 'portal', short: 'PORTAL · TECH HOUSE', vfile: 'portal-tech-house', group: 'portal' },
    { id: 'pgdeephouse', name: 'Portal · Deep House', sub: 'The Portal, Deep House chart only', artmap: 'data/portal-art.json', sched: 'schedule-pgdeephouse.json', art: 'assets/portal-art.png?v=3', mark: 'assets/portal-mark.svg?v=3', tag: 'Deep House', start: 'portal', short: 'PORTAL · DEEP HOUSE', vfile: 'portal-deep-house', group: 'portal' },
    { id: 'pgminimal', name: 'Portal · Minimal / Deep Tech', sub: 'The Portal, Minimal / Deep Tech chart only', artmap: 'data/portal-art.json', sched: 'schedule-pgminimal.json', art: 'assets/portal-art.png?v=3', mark: 'assets/portal-mark.svg?v=3', tag: 'Minimal / Deep Tech', start: 'portal', short: 'PORTAL · MINIMAL / DEEP TECH', vfile: 'portal-minimal-deep-tech', group: 'portal' },
    { id: 'pgmelodic', name: 'Portal · Melodic House & Techno', sub: 'The Portal, Melodic House & Techno chart only', artmap: 'data/portal-art.json', sched: 'schedule-pgmelodic.json', art: 'assets/portal-art.png?v=3', mark: 'assets/portal-mark.svg?v=3', tag: 'Melodic House & Techno', start: 'portal', short: 'PORTAL · MELODIC HOUSE & TECHNO', vfile: 'portal-melodic-house-techno', group: 'portal' },
    { id: 'pgprogressive', name: 'Portal · Progressive House', sub: 'The Portal, Progressive House chart only', artmap: 'data/portal-art.json', sched: 'schedule-pgprogressive.json', art: 'assets/portal-art.png?v=3', mark: 'assets/portal-mark.svg?v=3', tag: 'Progressive House', start: 'portal', short: 'PORTAL · PROGRESSIVE HOUSE', vfile: 'portal-progressive-house', group: 'portal' },
    { id: 'pgafro', name: 'Portal · Afro House', sub: 'The Portal, Afro House chart only', artmap: 'data/portal-art.json', sched: 'schedule-pgafro.json', art: 'assets/portal-art.png?v=3', mark: 'assets/portal-mark.svg?v=3', tag: 'Afro House', start: 'portal', short: 'PORTAL · AFRO HOUSE', vfile: 'portal-afro-house', group: 'portal' },
    { id: 'pgorganic', name: 'Portal · Organic House', sub: 'The Portal, Organic House chart only', artmap: 'data/portal-art.json', sched: 'schedule-pgorganic.json', art: 'assets/portal-art.png?v=3', mark: 'assets/portal-mark.svg?v=3', tag: 'Organic House', start: 'portal', short: 'PORTAL · ORGANIC HOUSE', vfile: 'portal-organic-house', group: 'portal' },
    { id: 'pgdnb', name: 'Portal · Drum & Bass', sub: 'The Portal, Drum & Bass chart only', artmap: 'data/portal-art.json', sched: 'schedule-pgdnb.json', art: 'assets/portal-art.png?v=3', mark: 'assets/portal-mark.svg?v=3', tag: 'Drum & Bass', start: 'portal', short: 'PORTAL · DRUM & BASS', vfile: 'portal-drum-bass', group: 'portal' },
    { id: 'pgukg', name: 'Portal · UK Garage / Bassline', sub: 'The Portal, UK Garage / Bassline chart only', artmap: 'data/portal-art.json', sched: 'schedule-pgukg.json', art: 'assets/portal-art.png?v=3', mark: 'assets/portal-mark.svg?v=3', tag: 'UK Garage / Bassline', start: 'portal', short: 'PORTAL · UK GARAGE / BASSLINE', vfile: 'portal-uk-garage-bassline', group: 'portal' },
    { id: 'pgindiedance', name: 'Portal · Indie Dance', sub: 'The Portal, Indie Dance chart only', artmap: 'data/portal-art.json', sched: 'schedule-pgindiedance.json', art: 'assets/portal-art.png?v=3', mark: 'assets/portal-mark.svg?v=3', tag: 'Indie Dance', start: 'portal', short: 'PORTAL · INDIE DANCE', vfile: 'portal-indie-dance', group: 'portal' },
    { id: 'pgnudisco', name: 'Portal · Nu Disco / Disco', sub: 'The Portal, Nu Disco / Disco chart only', artmap: 'data/portal-art.json', sched: 'schedule-pgnudisco.json', art: 'assets/portal-art.png?v=3', mark: 'assets/portal-mark.svg?v=3', tag: 'Nu Disco / Disco', start: 'portal', short: 'PORTAL · NU DISCO / DISCO', vfile: 'portal-nu-disco-disco', group: 'portal' },
    { id: 'pgamapiano', name: 'Portal · Amapiano', sub: 'The Portal, Amapiano chart only', artmap: 'data/portal-art.json', sched: 'schedule-pgamapiano.json', art: 'assets/portal-art.png?v=3', mark: 'assets/portal-mark.svg?v=3', tag: 'Amapiano', start: 'portal', short: 'PORTAL · AMAPIANO', vfile: 'portal-amapiano', group: 'portal' },
    { id: 'pghouse', name: 'Portal · House', sub: 'The Portal, House chart only', artmap: 'data/portal-art.json', sched: 'schedule-pghouse.json', art: 'assets/portal-art.png?v=3', mark: 'assets/portal-mark.svg?v=3', tag: 'House', start: 'portal', short: 'PORTAL · HOUSE', vfile: 'portal-house', group: 'portal' },
    { id: 'pgbasshouse', name: 'Portal · Bass House', sub: 'The Portal, Bass House chart only', artmap: 'data/portal-art.json', sched: 'schedule-pgbasshouse.json', art: 'assets/portal-art.png?v=3', mark: 'assets/portal-mark.svg?v=3', tag: 'Bass House', start: 'portal', short: 'PORTAL · BASS HOUSE', vfile: 'portal-bass-house', group: 'portal' },
    { id: 'pgfunky', name: 'Portal · Funky House', sub: 'The Portal, Funky House chart only', artmap: 'data/portal-art.json', sched: 'schedule-pgfunky.json', art: 'assets/portal-art.png?v=3', mark: 'assets/portal-mark.svg?v=3', tag: 'Funky House', start: 'portal', short: 'PORTAL · FUNKY HOUSE', vfile: 'portal-funky-house', group: 'portal' },
    { id: 'pgdancepop', name: 'Portal · Dance / Pop', sub: 'The Portal, Dance / Pop chart only', artmap: 'data/portal-art.json', sched: 'schedule-pgdancepop.json', art: 'assets/portal-art.png?v=3', mark: 'assets/portal-mark.svg?v=3', tag: 'Dance / Pop', start: 'portal', short: 'PORTAL · DANCE / POP', vfile: 'portal-dance-pop', group: 'portal' },
    { id: 'pgindietech', name: 'Portal · Indie Tech', sub: 'The Portal, Indie Tech chart only', artmap: 'data/portal-art.json', sched: 'schedule-pgindietech.json', art: 'assets/portal-art.png?v=3', mark: 'assets/portal-mark.svg?v=3', tag: 'Indie Tech', start: 'portal', short: 'PORTAL · INDIE TECH', vfile: 'portal-indie-tech', group: 'portal' },
    { id: 'citycult', name: 'City Culture', sub: 'Hip hop, R&B and dancehall party mix', sched: 'schedule-playground.json', art: 'assets/city-culture-art.png?v=3', mark: 'assets/city-culture-mark.png?v=3', tag: 'Hip hop \u00b7 dancehall \u00b7 afro \u00b7 R&B', skins: ['city1', 'city2', 'city3'], first: 'city1', short: 'CITY CULTURE', vfile: 'playground' },
    { id: 'trap', name: 'Trap', sub: 'Heavy 808s and hard-hitting trap', soon: 1, art: 'assets/logo.png' }
  ];
  var KEY = 'up1-station', cur = ST[0], m, root = document.documentElement, GATE = 'f38db7da1ec91cbee23617615df0ee90444716d2f4587635b4d9f9369fc5ebe6', UNLOCKED = false;
  try { UNLOCKED = localStorage.getItem('up1-unlock') === GATE; } catch (e) {}   // a private preview: stations marked locked stay 'coming soon' until the code is entered on this device
  function byId(id) { for (var i = 0; i < ST.length; i++) if (ST[i].id === id && (!ST[i].soon || (ST[i].locked && UNLOCKED))) return ST[i]; return null; }
  try { m = /[?&]station=([a-z0-9]+)/.exec(location.search); var want = m ? m[1] : localStorage.getItem(KEY); cur = byId(want) || ST[0]; } catch (e) {}
  if (/[?&]ailocal=1/.test(location.search)) window.UP1_AI_URL = 'ai/';   // preview: read the AI lyrics from this PC instead of the live site
  // which skin a station opens in: Culture Shock = one of its three own (a different one each time), the others = their own look, the main station = Nebula
  function chooseSkin(st, first) {
    var ms = first && /[?&]skin=([a-z]+)/.exec(location.search), cm = first && /[?&]cs=([123])/.exec(location.search);
    if (st.skins) {
      var OWN = st.skins, pick = ms ? ms[1] : (cm ? OWN[+cm[1] - 1] : '');
      if (!pick && st.first) pick = st.first;   // a channel can always open in its own lead skin (City Culture: the yellow one)
      if (!pick) { var last = ''; try { last = localStorage.getItem('up1-cs-skin') || ''; } catch (e) {} var all = OWN.filter(function (n) { return n !== last; }); pick = all[Math.floor(Math.random() * all.length)]; }
      try { localStorage.setItem('up1-cs-skin', pick); } catch (e) {}
      return pick;
    }
    return ms ? ms[1] : (st.start || '');
  }
  function globals(st, first) {
    window.UP1_VFILE = st.vfile || ''; window.UP1_STATION = st.id; window.UP1_SCHEDULE = st.sched; window.UP1_ARTMAP = st.artmap || ''; window.UP1_MARK = st.mark || st.art || 'assets/logo.png'; window.UP1_OWN_SKINS = st.skins || null;
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
  var GROUPS = { portal: ['Portal \u00b7 pick a genre', 'All genres', /^Portal \u00b7 /], tdot6: ['T.DOT 6 \u00b7 pick a sound', 'All T.DOT 6', /^T\.DOT 6 \u00b7 /] };
  function paintGenres() {   // inside a channel that has sub-channels (the Portal's genres, T.DOT 6's sounds): pick one, or all, from a card above the lists
    var g = GROUPS[cur.id] ? cur.id : (GROUPS[cur.group] ? cur.group : ''), el = document.getElementById('pgsel');
    if (!g || !UNLOCKED) { if (el) el.hidden = true; return; }
    var cols = document.querySelector('main .cols'); if (!cols) return;
    if (!el) {
      el = document.createElement('section'); el.className = 'card pgsel'; el.id = 'pgsel'; cols.parentNode.insertBefore(el, cols);
      el.addEventListener('click', function (e) { var b = e.target.closest('button[data-id]'); if (b && b.dataset.id !== cur.id) switchTo(byId(b.dataset.id), true); });
    }
    el.hidden = false; var G = GROUPS[g];
    el.innerHTML = '<h2>' + G[0] + '</h2><div class="pgchips">' + [{ id: g, name: G[1] }].concat(ST.filter(function (x) { return x.group === g; })).map(function (x) {
      return '<button type="button" data-id="' + x.id + '" class="pgchip' + (x.id === cur.id ? ' on' : '') + '">' + String(x.name).replace(G[2], '') + '</button>';
    }).join('') + '</div>';
  }
  function paintUI(st) {   // everything on the page that carries the station's name, logo and look
    var rad = document.querySelector('.logo .rad'), img = document.querySelector('.logo img'), isMain = st.id === '1up';
    document.title = isMain ? origTitle : st.name + ' \u00b7 1UP Radio'; try { paintGenres(); } catch (e) {}
    if (rad) rad.textContent = isMain ? 'RADIO (ORIGINAL)' : (st.short || st.name).toUpperCase();
    if (img) { if (!origImg) origImg = img.getAttribute('src'); img.src = isMain ? origImg : (st.mark || st.art); }
    if (!isMain) { var na = document.getElementById('npArtist'); if (na && !document.getElementById('play').classList.contains('on')) na.textContent = st.tag + ' \u00b7 all day'; }
    var sbn = document.getElementById('shareBtn'); if (sbn) { sbn.title = 'Share ' + st.name; sbn.setAttribute('aria-label', 'Share ' + st.name); }
    vaultDeco(st.id === 'vault');
    if (box) box.querySelectorAll('.stcard').forEach(function (c) { var on = c.dataset.id === st.id, i = c.querySelector('i'); c.classList.toggle('on', on); if (i && !c.classList.contains('soon')) i.textContent = on ? 'ON AIR' : 'TUNE IN'; });
  }
  function stationFromUrl() { var mm = /[?&]station=([a-z0-9]+)/.exec(location.search); return byId(mm ? mm[1] : '1up') || ST[0]; }
  function switchTo(st, push) {   // change station without reloading the page, so the music never stops
    if (!st || (st.soon && !(st.locked && UNLOCKED)) || st.id === cur.id) return;
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
    box.innerHTML = '<div class="stbox"><button type="button" class="stx" aria-label="Close">&times;</button><h2>CHOOSE A STATION</h2>' + ST.filter(function (s) { return !s.group; }).map(function (s) {
      return '<button type="button" class="stcard' + (s.group ? ' stgrp' : '') + (s.id === cur.id ? ' on' : '') + (s.soon && !(s.locked && UNLOCKED) ? ' soon' : '') + (s.locked && !UNLOCKED ? ' lockd' : '') + '" data-id="' + s.id + '"' + (s.group ? ' data-g="' + s.group + '"' : '') + (s.soon && !s.locked ? ' disabled' : '') + '><img src="' + s.art + '" alt="" width="64" height="64"><span><b>' + s.name + '</b><small>' + s.sub + '</small></span><i>' + (s.soon && !(s.locked && UNLOCKED) ? 'COMING SOON' : s.id === cur.id ? 'ON AIR' : 'TUNE IN') + '</i></button>';
    }).join('') + '</div>';
    document.body.appendChild(box);
    (function () {   // grouped channels (the Portal's genres, T.DOT 6's sub-genres) live in a menu under their channel: tap the bar to open or close it
      var LBL = { tdot6: 'T.DOT 6 sub-genres', portal: 'Portal genres' };
      Object.keys(LBL).forEach(function (g) {
        var gs = box.querySelectorAll('.stcard.stgrp[data-g="' + g + '"]'); if (!gs.length) return;
        var wrap = document.createElement('div'), tg = document.createElement('button'), inCur = cur.group === g;
        wrap.className = 'stgbox'; wrap.hidden = !inCur;
        tg.type = 'button'; tg.className = 'stgtoggle'; tg.setAttribute('aria-expanded', inCur ? 'true' : 'false');
        tg.innerHTML = '<span>' + LBL[g] + ' \u00b7 ' + gs.length + '</span><i aria-hidden="true">' + (inCur ? '\u25B4' : '\u25BE') + '</i>';
        gs[0].parentNode.insertBefore(tg, gs[0]); tg.parentNode.insertBefore(wrap, gs[0]);
        Array.prototype.forEach.call(gs, function (c) { wrap.appendChild(c); });
      });
    })();
    function askCode(id) {
      var f = box.querySelector('.stcode'); if (f) f.remove();
      f = document.createElement('form'); f.className = 'stcode'; f.autocomplete = 'off';
      f.innerHTML = '<label>Coming soon. Have a code?</label><input type="password" name="c" autocomplete="off" aria-label="Access code" placeholder="Enter code"><button type="submit">Open</button><em></em>';
      box.querySelector('.stbox').appendChild(f); f.querySelector('input').focus();
      f.addEventListener('submit', function (ev) {
        ev.preventDefault(); var v = f.querySelector('input').value.trim().toLowerCase(), msg = f.querySelector('em');
        if (!v || !(window.crypto && crypto.subtle)) { msg.textContent = 'Not yet.'; return; }
        crypto.subtle.digest('SHA-256', new TextEncoder().encode('up1gate:' + v)).then(function (b) {
          var h = Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
          if (h !== GATE) { msg.textContent = 'Not yet.'; f.querySelector('input').select(); return; }
          try { localStorage.setItem('up1-unlock', GATE); } catch (e) {}
          location.href = location.pathname + '?station=' + id;
        });
      });
    }
    function open(o) { box.hidden = !o; if (!o) { var f = box.querySelector('.stcode'); if (f) f.remove(); } }
    // "tap here" nudge: until a visitor has opened the station list once, the logo pulses and a small bubble points at it
    var SEEN = 'up1-st-seen', seenIt = false; try { seenIt = localStorage.getItem(SEEN) === '1'; } catch (e) {}
    var nudge = null;
    function dropNudge() { if (nudge) { nudge.remove(); nudge = null; } logo.classList.remove('attn'); try { localStorage.setItem(SEEN, '1'); } catch (e) {} }
    if (!seenIt) {
      logo.classList.add('attn'); nudge = document.createElement('span'); nudge.className = 'stnudge'; nudge.setAttribute('aria-hidden', 'true'); nudge.textContent = 'TAP HERE \u00b7 MORE STATIONS'; logo.appendChild(nudge);
      setTimeout(function () { if (nudge) nudge.classList.add('calm'); }, 14000);     // the bubble quiets down after a while, the logo keeps pulsing until it is used
    }
    logo.addEventListener('click', function (e) { e.preventDefault(); dropNudge(); open(box.hidden); });
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.closest('.stx')) return open(false);
      if (e.target.closest('.stcode')) return;
      var tgb = e.target.closest('.stgtoggle');
      if (tgb) { var gb = tgb.nextElementSibling, op = gb.hidden; gb.hidden = !op; tgb.setAttribute('aria-expanded', op ? 'true' : 'false'); tgb.querySelector('i').textContent = op ? '\u25B4' : '\u25BE'; if (op) tgb.scrollIntoView({ block: 'nearest' }); return; }
      var c = e.target.closest('.stcard'); if (!c || c.disabled) return;
      if (c.classList.contains('lockd')) { askCode(c.dataset.id); return; }   // still coming soon for everyone else: ask for the code
      open(false); if (c.dataset.id !== cur.id) switchTo(byId(c.dataset.id), true);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') open(false); });
    try { history.replaceState({ st: cur.id }, ''); } catch (e) {}
    paintUI(cur);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();

/* Back button vs. overlays: an overlay (the big cover, the phone lyrics window) takes one history step when it opens, so the phone's Back button closes it instead of leaving the page
   (stations use history too: Back used to switch to the previous station and stop the music). closed(fn) pops that step again when the overlay is closed any other way. */
(function () {
  var owners = [], skip = 0;
  window.UP1_BACKGUARD = {
    opened: function (closeFn) { try { history.pushState({ ov: 1 }, '', location.href); owners.push(closeFn); } catch (e) {} },
    closed: function (closeFn) { var i = owners.lastIndexOf(closeFn); if (i < 0) return; owners.splice(i, 1); try { if (history.state && history.state.ov) { skip++; history.back(); } } catch (e) {} }
  };
  window.addEventListener('popstate', function () { if (skip > 0) { skip--; return; } var f = owners.pop(); if (f) f(); });
})();

/* Tap the album cover to see it big */
(function () {
  function ready() {
    var box = document.createElement('div'); box.id = 'artzoom'; box.hidden = true; box.innerHTML = '<img alt="Album cover"><button type="button" aria-label="Close">&times;</button>'; document.body.appendChild(box);
    var img = box.querySelector('img');
    function shut() { box.hidden = true; img.removeAttribute('src'); }
    function close() { shut(); if (window.UP1_BACKGUARD) UP1_BACKGUARD.closed(shut); }
    box.addEventListener('click', close); document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    document.addEventListener('click', function (e) {
      var a = e.target.closest('#npArt'); if (!a || !a.getAttribute('src') || a.hasAttribute('data-fallback')) return;   // the station-logo label (no cover yet) does not open big
      var src = a.currentSrc || a.src, big = src.replace('/mqdefault.jpg', '/hqdefault.jpg');   // YouTube pictures come in a bigger size; album covers are already large
      img.onerror = function () { img.onerror = null; img.src = src; }; img.src = big; box.hidden = false; if (window.UP1_BACKGUARD) UP1_BACKGUARD.opened(shut);
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

