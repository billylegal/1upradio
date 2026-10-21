(function () {
  var LIVE_HTML = '<span class="live">You are live with the station.<span class="kvu"><br class="mbr"> Keep the volume up.</span></span>';
  var $ = function (id) { return document.getElementById(id); };
  var S = { plays: [], delay: 420 }, yt = null, ready = false, started = false, playing = false, idx = -1, errs = 0, skipped = 0;
  // times shown are when each song plays for you: the same clock time it aired in Athens, on your local clock
  var fmtT = function (t) { return new Date((t + S.delay) * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
  var dayKey = function (t) { return new Date((t + S.delay) * 1000).toLocaleDateString('en-CA'); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function split(t) { var i = t.indexOf(' - '); return i > 0 ? [t.slice(0, i), t.slice(i + 3)] : ['', t]; }

  var ART = {};   // song id -> album cover for the station's songs (data/<station>-art.json, built by tools/culture_art.py)
  function loadArt() {
    ART = {};
    if (window.UP1_ARTMAP) fetch(window.UP1_ARTMAP + '?t=' + Math.floor(Date.now() / 600000)).then(function (r) { return r.json(); }).then(function (j) { ART = j || {}; try { paintNP(); } catch (e) {} }).catch(function () {});
  }
  loadArt();
  window.UP1_COVER = function (id) { return ART[id] || ''; };
  function load() {
    return fetch((window.UP1_SCHEDULE || 'schedule.json') + '?t=' + Date.now()).then(function (r) { return r.json(); }).then(function (d) {
      var cur = idx >= 0 && S.plays[idx] ? S.plays[idx].t : null;
      S = d;
      if (cur !== null) { var k = S.plays.findIndex(function (p) { return p.t === cur; }); if (k >= 0) idx = k; }
      paintLists(); paintDays();
    });
  }
  function findNow() {
    var src = Date.now() / 1000 - S.delay, k = -1;
    for (var i = 0; i < S.plays.length; i++) { if (S.plays[i].t <= src) k = i; else break; }
    return k < 0 ? 0 : k;
  }
  function paintNP() { window.UP1_NOW = curP || (S.plays && S.plays[idx]) || null; try { paintArtLinks(window.UP1_NOW); } catch (e) {}
    var p = curP || S.plays[idx]; if (!p) return; var a = split(p.title);
    $('npTitle').textContent = a[1] || p.title; $('npArtist').textContent = a[0]; try { linkArtistLine(); } catch (e) {}
    var aw = $('npArtWrap'), ai = $('npArt'); if (aw && ai) { if (p.id) { var u = (ART[p.id]) ? ART[p.id] : 'https://i.ytimg.com/vi/' + encodeURIComponent(p.id) + '/mqdefault.jpg'; if (ai.getAttribute('src') !== u) ai.src = u; ai.removeAttribute('data-fallback'); aw.hidden = false; } else aw.hidden = true; }   // the spinning record: the real album cover, else the song's YouTube picture (on the vinyl stations that is usually the record label itself)
    document.title = (playing ? '▶ ' : '') + (a[1] || p.title) + ' · 1UP Radio';
    paintSave();
    paintLists();
    if (typeof msMeta === 'function') msMeta();
  }
  function hb(p) { var on = isSaved(p); return '<button class="hb' + (on ? ' on' : '') + '" type="button" data-t="' + p.t + '" aria-pressed="' + on + '" title="' + (on ? 'Remove from saved songs' : 'Save song') + '">' + (on ? '♥' : '♡') + '</button>'; }
  function paintHearts() { document.querySelectorAll('.hb').forEach(function (b) { var p = S.plays.find(function (x) { return x.t === +b.dataset.t; }), on = isSaved(p); b.classList.toggle('on', on); b.textContent = on ? '♥' : '♡'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.title = on ? 'Remove from saved songs' : 'Save song'; }); }
  function paintLists() {
    var row = function (p, cls) { var a = split(p.title); return '<li class="' + (cls || '') + '"><time>' + fmtT(p.t) + '</time><span>' + esc(a[0] ? a[0] + ' — ' + a[1] : a[1]) + '</span>' + hb(p) + '</li>'; };
    var ref = idx >= 0 ? idx : (S.plays.length ? findNow() : -1);
    $('next').innerHTML = ref >= 0 ? S.plays.slice(ref + 1, ref + 7).map(function (p) { return row(p); }).join('') : '';
    $('prev').innerHTML = ref >= 0 ? S.plays.slice(Math.max(0, ref - 6), ref).reverse().map(function (p) { return row(p); }).join('') : '';
  }

  // ---- saved songs (kept in this browser) ----
  var SAVE_KEY = 'up1-saved', saved = [];
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || '[]') || []; } catch (e) { saved = []; }
  function persistSaved() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(saved)); } catch (e) {} }
  function isSaved(p) { return !!p && saved.some(function (s) { return s.id === p.id; }); }
  function paintSave() {
    var p = curP || S.plays[idx], b = $('saveBtn'); if (!b) return;
    b.disabled = !p; var on = isSaved(p);
    b.textContent = on ? '♥ Saved' : '♡ Save Song'; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  var SICO = {   // round buttons in each service's own colours (simplified marks, 40x40)
    youtube: '<circle cx="20" cy="20" r="20" fill="#FF0000"/><g fill="#fff" transform="translate(10.64 10.64) scale(0.7800)"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></g>',
    ytmusic: '<circle cx="20" cy="20" r="20" fill="#fff"/><g fill="#FF0000" transform="translate(-0.00 -0.00) scale(1.6667)"><path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228s6.228-2.796 6.228-6.228S15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z"/></g>',
    apple: '<defs><linearGradient id="sa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FB5C74"/><stop offset="1" stop-color="#FA243C"/></linearGradient></defs><circle cx="20" cy="20" r="20" fill="url(#sa)"/><g fill="#fff" transform="translate(12.56 12.56) scale(0.6200)"><path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 001.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.045-1.773-.6-1.943-1.536a1.88 1.88 0 011.038-2.022c.323-.16.67-.25 1.018-.324.378-.082.758-.153 1.134-.24.274-.063.457-.23.51-.516a.904.904 0 00.02-.193c0-1.815 0-3.63-.002-5.443a.725.725 0 00-.026-.185c-.04-.15-.15-.243-.304-.234-.16.01-.318.035-.475.066-.76.15-1.52.303-2.28.456l-2.325.47-1.374.278c-.016.003-.032.01-.048.013-.277.077-.377.203-.39.49-.002.042 0 .086 0 .13-.002 2.602 0 5.204-.003 7.805 0 .42-.047.836-.215 1.227-.278.64-.77 1.04-1.434 1.233-.35.1-.71.16-1.075.172-.96.036-1.755-.6-1.92-1.544-.14-.812.23-1.685 1.154-2.075.357-.15.73-.232 1.108-.31.287-.06.575-.116.86-.177.383-.083.583-.323.6-.714v-.15c0-2.96 0-5.922.002-8.882 0-.123.013-.25.042-.37.07-.285.273-.448.546-.518.255-.066.515-.112.774-.165.733-.15 1.466-.296 2.2-.444l2.27-.46c.67-.134 1.34-.27 2.01-.403.22-.043.442-.088.663-.106.31-.025.523.17.554.482.008.073.012.148.012.223.002 1.91.002 3.822 0 5.732z"/></g>',
    deezer: '<circle cx="20" cy="20" r="20" fill="#121216"/><g><rect x="8" y="24" width="4.2" height="3" fill="#FF0092"/><rect x="13" y="24" width="4.2" height="3" fill="#FFAD00"/><rect x="18" y="24" width="4.2" height="3" fill="#3EBF4F"/><rect x="23" y="24" width="4.2" height="3" fill="#2EB5E0"/><rect x="28" y="24" width="4.2" height="3" fill="#A238FF"/><rect x="28" y="19.5" width="4.2" height="3" fill="#A238FF"/><rect x="23" y="19.5" width="4.2" height="3" fill="#2EB5E0"/><rect x="18" y="19.5" width="4.2" height="3" fill="#3EBF4F"/><rect x="28" y="15" width="4.2" height="3" fill="#A238FF"/><rect x="28" y="10.5" width="4.2" height="3" fill="#A238FF"/><rect x="13" y="19.5" width="4.2" height="3" fill="#FFAD00"/></g>',
    spotify: '<circle cx="20" cy="20" r="20" fill="#000"/><g fill="#1ED760" transform="translate(-0.00 -0.00) scale(1.6667)"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></g>',
    tiktok: '<circle cx="20" cy="20" r="20" fill="#000"/><g transform="translate(12.56 12.56) scale(0.6200)"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" fill="#25F4EE" transform="translate(-.8 -.6)"/><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" fill="#FE2C55" transform="translate(.8 .6)"/><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" fill="#fff"/></g>',
    x: '<circle cx="20" cy="20" r="20" fill="#000"/><g fill="#fff" transform="translate(12.56 12.56) scale(0.6200)"><path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"/></g>',
    instagram: '<defs><linearGradient id="si" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FEDA75"/><stop offset=".3" stop-color="#FA7E1E"/><stop offset=".55" stop-color="#D62976"/><stop offset=".8" stop-color="#962FBF"/><stop offset="1" stop-color="#4F5BD5"/></linearGradient></defs><circle cx="20" cy="20" r="20" fill="url(#si)"/><g fill="#fff" transform="translate(12.08 12.08) scale(0.6600)"><path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"/></g>',
    amazon: '<circle cx="20" cy="20" r="20" fill="#25D1DA"/><path d="M15 25V13l11-2.2v12" fill="none" stroke="#0B1F2A" stroke-width="2.4" stroke-linejoin="round"/><circle cx="13.2" cy="25.2" r="2.6" fill="#0B1F2A"/><circle cx="24.2" cy="23" r="2.6" fill="#0B1F2A"/><path d="M11 30.5c5.5 3 12.5 3 18-.4" fill="none" stroke="#0B1F2A" stroke-width="2" stroke-linecap="round"/>',
    tidal: '<circle cx="20" cy="20" r="20" fill="#000"/><g fill="#fff" transform="translate(11.60 11.60) scale(0.7000)"><path d="M12.012 3.992L8.008 7.996 4.004 3.992 0 7.996 4.004 12l4.004-4.004L12.012 12l-4.004 4.004 4.004 4.004 4.004-4.004L12.012 12l4.004-4.004-4.004-4.004zM16.042 7.996l3.979-3.979L24 7.996l-3.979 3.979z"/></g>',
    beatport: '<circle cx="20" cy="20" r="20" fill="#01FF95"/><g fill="#000" transform="translate(11.00 11.00) scale(0.7500)"><path d="M21.429 17.055a7.114 7.114 0 0 1-.794 3.246 6.917 6.917 0 0 1-2.181 2.492 6.698 6.698 0 0 1-3.063 1.163 6.653 6.653 0 0 1-3.239-.434 6.796 6.796 0 0 1-2.668-1.932 7.03 7.03 0 0 1-1.481-2.983 7.124 7.124 0 0 1 .049-3.345 7.015 7.015 0 0 1 1.566-2.937l-4.626 4.73-2.421-2.479 5.201-5.265a3.791 3.791 0 0 0 1.066-2.675V0h3.41v6.613a7.172 7.172 0 0 1-.519 2.794 7.02 7.02 0 0 1-1.559 2.353l-.153.156a6.768 6.768 0 0 1 3.49-1.725 6.687 6.687 0 0 1 3.845.5 6.873 6.873 0 0 1 2.959 2.564 7.118 7.118 0 0 1 1.118 3.8Zm-3.089 0a3.89 3.89 0 0 0-.611-2.133 3.752 3.752 0 0 0-1.666-1.424 3.65 3.65 0 0 0-2.158-.233 3.704 3.704 0 0 0-1.92 1.037 3.852 3.852 0 0 0-1.031 1.955 3.908 3.908 0 0 0 .205 2.213c.282.7.76 1.299 1.374 1.721a3.672 3.672 0 0 0 2.076.647 3.637 3.637 0 0 0 2.635-1.096c.347-.351.622-.77.81-1.231.188-.461.285-.956.286-1.456Z"/></g>'
  };
  function sico(k, href, title) { return '<a class="sico" href="' + esc(href) + '" target="_blank" rel="noopener" title="' + title + '" aria-label="' + title + '"><svg viewBox="0 0 40 40" aria-hidden="true">' + SICO[k] + '</svg></a>'; }
  // ---- the artists' own accounts under the player: everyone credited on the song (artist, featured artists, the remixer), official links only (data/artist-links.json, from MusicBrainz) ----
  // Billy Legal's own accounts: every Billy Legal song shows them (never looked up, always these)
  var OWN = { 'billy legal': { ig: 'https://www.instagram.com/billylegal', tt: 'https://www.tiktok.com/@billylegalthegreat', x: 'https://x.com/billylegal', yt: 'https://www.youtube.com/@billylegal', sp: 'https://open.spotify.com/artist/0hrBaKHfPnEGXWk1XTaCzs', bp: 'https://www.beatport.com/artist/billy-legal/2452846' } };
  function ownMerge(d) { d = d || {}; Object.keys(OWN).forEach(function (k) { d[k] = OWN[k]; }); return d; }
  var ALINKS = null, LABELS = null, alKey = '';   // LABELS: data/labels.json {video id: record label}
  function alNorm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function credits(title) {
    var t = String(title || ''), parts = t.split(/\s[-\u2013\u2014]\s/), segs = [parts[0]], names = [], seen = {};
    if (parts.length > 1 && window.UP1_STATION === 'cultureshock') segs.push(parts[parts.length - 1]);
    segs.forEach(function (sg) { sg.replace(/\s*[\(\[].*?[\)\]]/g, '').split(/\s*(?:,|&|\band\b|\bx\b|\bvs\.?|\bfeat\.?|\bft\.?|\bfeaturing|\bwith|\/|;)\s*/i).forEach(function (n) { n = n.trim(); if (n) names.push(n); }); });
    var rm = /[\(\[]([^()\[\]]*?)\s+(?:remix|rework|bootleg|edit|flip|vip|refix|mix)\s*[\)\]]/i.exec(t);
    if (rm) { var w = rm[1].split(/['\u2019]s\s/)[0].replace(/['\u2019]s$/i, '').trim(); if (w && !/^(original|extended|radio|club|main|album|instrumental|vocal|dub|full|short|long|new)$/i.test(w)) names.push(w); }
    return names.filter(function (n) { var k = alNorm(n); if (!k || seen[k]) return false; seen[k] = 1; return true; }).slice(0, 4);
  }
  // an artist nobody has looked up yet: the page asks MusicBrainz (and Wikidata) once, right now, for their official accounts and remembers the answer on this device for 30 days
  var LIVEQ = Promise.resolve(), LIVE_TRIED = {};
  function alWait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function alGet(u, again) {
    return fetch(u, { headers: { Accept: 'application/json' } }).then(function (r) {
      if (r.status === 503 && !again) return alWait(2500).then(function () { return alGet(u, true); });
      if (!r.ok) throw new Error('http ' + r.status); return r.json();
    });
  }
  function alParse(rels) {
    var out = {}, qid = null;
    (rels || []).forEach(function (rel) {
      var url = ((rel.url || {}).resource || '').trim(), m;
      if ((m = /^https?:\/\/(?:www\.|mobile\.)?(?:twitter\.com|x\.com)\/([A-Za-z0-9_]{1,15})\/?(?:\?.*)?$/.exec(url))) { if (!out.x) out.x = 'https://x.com/' + m[1]; }
      else if ((m = /^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_.]{1,30})\/?(?:\?.*)?$/.exec(url))) { if (!out.ig) out.ig = 'https://www.instagram.com/' + m[1] + '/'; }
      else if ((m = /^https?:\/\/(?:www\.|m\.)?tiktok\.com\/@([A-Za-z0-9_.]{1,30})\/?(?:\?.*)?$/.exec(url))) { if (!out.tt) out.tt = 'https://www.tiktok.com/@' + m[1]; }
      else if (/^https?:\/\/(?:www\.|m\.)?youtube\.com\/(channel\/|user\/|c\/|@)[^\/?#]+\/?$/.test(url)) { if (!out.yt) out.yt = url.replace(/\/$/, ''); }
      else if ((m = /^https?:\/\/(?:www\.)?wikidata\.org\/wiki\/(Q\d+)/.exec(url))) qid = m[1];
    });
    return { out: out, qid: qid };
  }
  function liveLinks(name, kind) {
    kind = kind || 'artist'; var nk = alNorm(name), k = (kind === 'label' ? 'label:' : '') + nk; if (!nk || LIVE_TRIED[k]) return; LIVE_TRIED[k] = 1;
    try { var c = JSON.parse(localStorage.getItem('up1-al:' + k) || 'null'); if (c && Date.now() - c.t < 30 * 864e5) { ALINKS[k] = c.l; return; } } catch (e) {}
    LIVEQ = LIVEQ.then(function () {
      return alGet('https://musicbrainz.org/ws/2/' + kind + '/?fmt=json&limit=3&query=' + encodeURIComponent(kind + ':"' + name.replace(/"/g, ' ') + '"')).then(function (j) {
        var a = (j[kind + 's'] || []).filter(function (x) { return x.score >= 96 && [x.name].concat((x.aliases || []).map(function (y) { return y.name; })).some(function (n) { return alNorm(n) === nk; }); })[0];
        if (!a) return {};
        return alWait(1100).then(function () { return alGet('https://musicbrainz.org/ws/2/' + kind + '/' + a.id + '?fmt=json&inc=url-rels'); }).then(function (d) {
          var p = alParse(d.relations); if (!p.qid || (p.out.x && p.out.ig && p.out.tt && p.out.yt)) return p.out;
          return alGet('https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims&format=json&origin=*&ids=' + p.qid).then(function (w) {
            var cl = ((w.entities || {})[p.qid] || {}).claims || {};
            function one(pid) { var l = cl[pid] || []; for (var q = 0; q < l.length; q++) { if (l[q].rank === 'deprecated') continue; var v = ((l[q].mainsnak || {}).datavalue || {}).value; if (typeof v === 'string' && v) return v; } }
            var tw = one('P2002'), ig = one('P2003'), tt = one('P7085'), yt = one('P2397');
            if (tw && !p.out.x && /^[A-Za-z0-9_]{1,15}$/.test(tw)) p.out.x = 'https://x.com/' + tw;
            if (ig && !p.out.ig && /^[A-Za-z0-9_.]{1,30}$/.test(ig)) p.out.ig = 'https://www.instagram.com/' + ig + '/';
            if (tt && !p.out.tt && /^[A-Za-z0-9_.]{1,30}$/.test(tt)) p.out.tt = 'https://www.tiktok.com/@' + tt;
            if (yt && !p.out.yt && /^UC[A-Za-z0-9_-]{22}$/.test(yt)) p.out.yt = 'https://www.youtube.com/channel/' + yt;
            return p.out;
          }).catch(function () { return p.out; });
        });
      }).then(function (out) { ALINKS[k] = out; try { localStorage.setItem('up1-al:' + k, JSON.stringify({ t: Date.now(), l: out })); } catch (e) {} alKey = ''; paintArtLinks(curP); return alWait(1100); }).catch(function () { return alWait(1100); });
    });
  }
  function artistHref(n) { var L = (ALINKS && ALINKS[alNorm(n)]) || {}; return L.ig || L.tt || L.x || L.yt || ''; }   // only a real official account: never a search
  function linkArtistLine() {   // the artist names under the song title are links to that artist's official Instagram (else TikTok, X, YouTube); no account known = plain text
    var el = $('npArtist'), p = window.UP1_NOW; if (!el || !p) return;
    var txt = el.textContent, low = txt.toLowerCase(), spots = [];
    credits(p.title).forEach(function (n) { var i = low.indexOf(n.toLowerCase()); if (i >= 0) spots.push([i, n.length, n]); });
    if (!spots.length) return;
    spots.sort(function (x, y) { return x[0] - y[0]; });
    var html = '', pos = 0;
    spots.forEach(function (s) {
      if (s[0] < pos) return;
      html += esc(txt.slice(pos, s[0])) + '<a class="artlnk" href="#" role="button" data-artist="' + esc(s[2]) + '" title="' + esc(s[2]) + ' \u00b7 artist profile">' + esc(txt.slice(s[0], s[0] + s[1])) + '</a>';
      pos = s[0] + s[1];
    });
    el.innerHTML = html + esc(txt.slice(pos));
  }
  // ---- the artist profile card: click an artist name under the song title. Photo and fan count from Deezer, a short bio from Wikipedia (credited), origin and style from our data, official accounts and label ----
  var PROF = { auto: null, hand: null }, acardFor = '';
  function profData() {
    var u = Math.floor(Date.now() / 1800000);
    if (!PROF.auto) PROF.auto = fetch('data/artist-auto.json?t=' + u).then(function (r) { return r.json(); }).catch(function () { return {}; });
    if (!PROF.hand) PROF.hand = fetch('data/artist-facts.json?t=' + u).then(function (r) { return r.json(); }).catch(function () { return []; });
    return Promise.all([PROF.auto, PROF.hand]);
  }
  function profDeezer(name) {
    var k = alNorm(name);
    return jsonp('https://api.deezer.com/search/artist?q=' + encodeURIComponent(name) + '&limit=6').then(function (d) {
      var hit = ((d && d.data) || []).filter(function (x) { return alNorm(x.name) === k; }).sort(function (x, y) { return (y.nb_fan || 0) - (x.nb_fan || 0); })[0];
      return hit ? { pic: hit.picture_big || hit.picture_medium, fans: hit.nb_fan || 0, link: hit.link } : null;
    });
  }
  function profWiki(name) {
    var k = alNorm(name);
    return fetch('https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&origin=*&srsearch=' + encodeURIComponent(name + ' musician OR band OR singer OR DJ OR rapper')).then(function (r) { return r.json(); }).then(function (j) {
      var t = (((j.query || {}).search || [])[0] || {}).title; if (!t) return null;
      return fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(t.replace(/ /g, '_'))).then(function (r) { return r.json(); }).then(function (s) {
        var ok = s && s.type === 'standard' && /music|singer|band|DJ|rapper|producer|duo|group|composer|songwriter|vocal|trio|record/i.test((s.description || '') + ' ' + (s.extract || '').slice(0, 200)) && alNorm(s.title || '').indexOf(k) === 0;
        if (!ok) return null;
        var ex = String(s.extract || ''), cut = ex.length > 330 ? ex.slice(0, 330).replace(/\s+\S*$/, '') + '…' : ex;
        return { text: cut, url: (s.content_urls && s.content_urls.desktop && s.content_urls.desktop.page) || '' };
      });
    }).catch(function () { return null; });
  }
  function profAccounts(name) {
    var L = ALINKS && ALINKS[alNorm(name)], h = '';
    if (L) h += (L.ig ? sico('instagram', L.ig, name + ' on Instagram') : '') + (L.tt ? sico('tiktok', L.tt, name + ' on TikTok') : '') + (L.x ? sico('x', L.x, name + ' on X (Twitter)') : '') + (L.yt ? sico('youtube', L.yt, name + ' on YouTube') : '') + (L.sp ? sico('spotify', L.sp, name + ' on Spotify') : '') + (L.bp ? sico('beatport', L.bp, name + ' on Beatport') : '');
    return h;
  }
  // ---- every website and profile we know for an artist (MusicBrainz's curated links), shown as pills in the profile card ----
  var PL_ORDER = ['Website', 'Wikipedia', 'Spotify', 'Apple Music', 'Deezer', 'Beatport', 'Bandcamp', 'SoundCloud', 'Facebook', 'Resident Advisor', 'Mixcloud', 'Discogs', 'AllMusic', 'Last.fm', 'Genius', 'Tour dates'];
  function plLabel(url) {
    if (/^https?:\/\/en\.wikipedia\.org\/wiki\//i.test(url)) return 'Wikipedia';
    if (/bandcamp\.com/i.test(url)) return 'Bandcamp'; if (/soundcloud\.com/i.test(url)) return 'SoundCloud'; if (/facebook\.com/i.test(url)) return 'Facebook';
    if (/open\.spotify\.com\/artist/i.test(url)) return 'Spotify'; if (/(music|itunes)\.apple\.com/i.test(url)) return 'Apple Music'; if (/deezer\.com/i.test(url)) return 'Deezer';
    if (/beatport\.com\/artist/i.test(url)) return 'Beatport'; if (/(\/\/ra\.co|residentadvisor\.net)/i.test(url)) return 'Resident Advisor'; if (/mixcloud\.com/i.test(url)) return 'Mixcloud';
    if (/discogs\.com\/artist/i.test(url)) return 'Discogs'; if (/allmusic\.com\/artist/i.test(url)) return 'AllMusic'; if (/last\.fm\/music/i.test(url)) return 'Last.fm'; if (/genius\.com\/artists/i.test(url)) return 'Genius';
    if (/(songkick|bandsintown)\.com/i.test(url)) return 'Tour dates';
    return '';
  }
  function profMore(name) {
    var k = alNorm(name);
    try { var c = JSON.parse(localStorage.getItem('up1-pl2:' + k) || 'null'); if (c && Date.now() - c.t < 30 * 864e5) return Promise.resolve(c); } catch (e) {}
    return new Promise(function (res) {
      LIVEQ = LIVEQ.then(function () {
        return alGet('https://musicbrainz.org/ws/2/artist/?fmt=json&limit=3&query=' + encodeURIComponent('artist:"' + name.replace(/"/g, ' ') + '"')).then(function (j) {
          var hit = (j.artists || []).filter(function (x) { return x.score >= 96 && [x.name].concat((x.aliases || []).map(function (y) { return y.name; })).some(function (n) { return alNorm(n) === k; }); })[0];
          if (!hit) return { l: [], lb: [] };
          return alWait(1100).then(function () { return alGet('https://musicbrainz.org/ws/2/artist/' + hit.id + '?fmt=json&inc=url-rels'); }).then(function (d) {
            var seen = {}, list = [];
            (d.relations || []).forEach(function (rel) {
              var url = ((rel.url || {}).resource || '').trim(); if (!/^https?:\/\//i.test(url)) return;
              var lab = rel.type === 'official homepage' ? 'Website' : plLabel(url); if (!lab || seen[lab]) return; seen[lab] = 1; list.push([lab, url]);
            });
            return alWait(1100).then(function () { return alGet('https://musicbrainz.org/ws/2/release?fmt=json&limit=100&inc=labels&artist=' + hit.id); }).then(function (rl) {   // every label on the artist's releases, most releases first
              var cnt = {}, nm = {};
              (rl.releases || []).forEach(function (r) { var seen = {}; (r['label-info'] || []).forEach(function (li) { var n = (li.label || {}).name; if (!n || /^\[no label\]$/i.test(n) || /^(self[- ]released|none)$/i.test(n)) return; var q = alNorm(n); if (seen[q]) return; seen[q] = 1; cnt[q] = (cnt[q] || 0) + 1; nm[q] = nm[q] || n; }); });
              var lb = Object.keys(cnt).sort(function (x, y) { return cnt[y] - cnt[x]; }).slice(0, 8).map(function (q) { return nm[q]; });
              return { l: list, lb: lb };
            });
          });
        }).then(function (o) { o.t = Date.now(); try { localStorage.setItem('up1-pl2:' + k, JSON.stringify(o)); } catch (e) {} res(o); return alWait(1100); }).catch(function () { res({ l: [], lb: [] }); return alWait(1100); });
      });
    });
  }
  function profPills(known, more) {   // known: links we already have for sure; more: from MusicBrainz; merged in a fixed order, one pill per kind
    var by = {}; (known || []).concat(more || []).forEach(function (p) { if (p && p[1] && !by[p[0]]) by[p[0]] = p[1]; });
    return PL_ORDER.filter(function (l) { return by[l]; }).map(function (l) { return '<a class="aclk" href="' + esc(by[l]) + '" target="_blank" rel="noopener noreferrer">' + esc(l) + '</a>'; }).join('');
  }
  function paintLabels(list, nowLab, name) {   // every record label the artist has released on (from MusicBrainz releases), with the label's own accounts when we know them
    var el = $('aclabs'); if (!el || acardFor !== alNorm(name)) return;
    var L = (list || []).slice(); if (nowLab && !L.some(function (n) { return alNorm(n) === alNorm(nowLab); })) { var np = window.UP1_NOW && alNorm((credits(window.UP1_NOW.title)[0]) || '') === alNorm(name); if (np) L.unshift(nowLab); }
    if (!L.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="aclh">Labels</div>' + L.map(function (n) {
      var q = ALINKS && ALINKS['label:' + alNorm(n)]; if (!q && ALINKS) liveLinks(n, 'label');
      return '<div class="aclr"><b>' + esc(n) + '</b>' + (q ? (q.ig ? sico('instagram', q.ig, n + ' on Instagram') : '') + (q.tt ? sico('tiktok', q.tt, n + ' on TikTok') : '') + (q.x ? sico('x', q.x, n + ' on X (Twitter)') : '') + (q.yt ? sico('youtube', q.yt, n + ' on YouTube') : '') : '') + '</div>';
    }).join('');
  }
  function cardShut() { var c = $('acard'); if (c) c.hidden = true; acardFor = ''; }
  function closeArtistCard() { cardShut(); if (window.UP1_BACKGUARD) UP1_BACKGUARD.closed(cardShut); }
  function openArtistCard(name) {
    var c = $('acard');
    if (!c) {
      c = document.createElement('div'); c.id = 'acard'; c.className = 'acard'; c.hidden = true; c.setAttribute('role', 'dialog'); c.setAttribute('aria-label', 'Artist profile');
      c.innerHTML = '<div class="acbox"><button type="button" class="acx" aria-label="Close">×</button><div class="acin"></div></div>'; document.body.appendChild(c);
      c.addEventListener('click', function (e) { if (e.target === c || e.target.closest('.acx')) closeArtistCard(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !c.hidden) closeArtistCard(); });
    }
    var inn = c.querySelector('.acin'), key = alNorm(name), own = key === 'billy legal';
    acardFor = key; if (c.hidden && window.UP1_BACKGUARD) UP1_BACKGUARD.opened(cardShut); c.hidden = false;
    if (ALINKS && ALINKS[key] === undefined) liveLinks(name);
    var lab = (LABELS && window.UP1_NOW && LABELS[window.UP1_NOW.id]) || '';
    function paint(dz, wk, auto, hand) {
      var facts = [];
      (hand || []).forEach(function (a) { if (a.n.some(function (n) { return alNorm(n) === key; })) facts = facts.concat(a.f); });
      if (!own) ((auto || {})[key] || []).forEach(function (f) { if (facts.indexOf(f) < 0) facts.push(f); });
      var pic = own ? 'assets/head-big.png' : (dz && dz.pic) || '';
      var bio = own ? 'Billy Legal, Toronto. The genre killer: house, deep house, afro house, tech house, hip hop, trap, downtempo, electronica and reggae.' : (wk && wk.text) || '';
      var h = '<div class="acl">1UP Radio · Artist profile</div><div class="achead">' + (pic ? '<img class="acpic" src="' + esc(pic) + '" alt="" referrerpolicy="no-referrer">' : '<div class="acpic ph">' + esc(name.charAt(0)) + '</div>') +
        '<div><h3>' + esc(name) + '</h3>' + (dz && dz.fans ? '<div class="acmeta">' + Number(dz.fans).toLocaleString() + ' fans on Deezer</div>' : '') + '</div></div>';
      if (bio) h += '<p class="acbio">' + esc(bio) + '</p>';
      facts.slice(0, 3).forEach(function (f) { h += '<p class="acfact">' + esc(f) + '</p>'; });
      if (!bio && !facts.length) h += '<p class="acfact">No profile text for this artist yet.</p>';
      var known = []; if (own) known = [['Website', 'https://billylegal.com'], ['Apple Music', 'https://music.apple.com/ca/artist/billy-legal/6788113036'], ['Deezer', 'https://www.deezer.com/artist/401877641'], ['Spotify', OWN['billy legal'].sp], ['Beatport', OWN['billy legal'].bp]]; else { if (wk && wk.url) known.push(['Wikipedia', wk.url]); if (dz && dz.link) known.push(['Deezer', dz.link]); }
      h += '<div class="acacc" id="acacc">' + profAccounts(name) + '</div><div class="aclinks" id="aclinks">' + profPills(known, []) + '</div>';
      h += '<div class="aclabs" id="aclabs"></div>';
      var npn = window.UP1_NOW && alNorm((credits(window.UP1_NOW.title)[0]) || '') === key;
      if (npn && /^(1up|movement)$/.test(window.UP1_STATION || '1up')) { var sp = split(window.UP1_NOW.title), bq = encodeURIComponent(sp[0] ? sp[0] + ' ' + sp[1] : sp[1]); h += '<div class="aclr"><b>This track</b>' + sico('beatport', 'https://www.beatport.com/search?q=' + bq, 'Find this track on Beatport') + '</div>'; }
      h += '<a class="azlink acaz" href="#">All artists A\u2013Z \u203a</a>';
      var cr = []; if (dz && dz.link && !own) cr.push('Photo and fans: <a href="' + esc(dz.link) + '" target="_blank" rel="noopener">Deezer</a>');
      if (wk && wk.url && !own) cr.push('Text: <a href="' + esc(wk.url) + '" target="_blank" rel="noopener">Wikipedia</a> (CC BY-SA)');
      if (!own) cr.push('Links: MusicBrainz');
      if (own) cr.push('<a href="https://billylegal.com" target="_blank" rel="noopener">BillyLegal.com</a>');
      if (cr.length) h += '<div class="accr">' + cr.join(' · ') + '</div>';
      inn.innerHTML = h;
      azSongsInCard(name, inn);
    }
    inn.innerHTML = '<div class="acl">1UP Radio · Artist profile</div><div class="achead"><div class="acpic ph">' + esc(name.charAt(0)) + '</div><div><h3>' + esc(name) + '</h3><div class="acmeta">Loading…</div></div></div>';
    Promise.all([own ? null : profDeezer(name), own ? null : profWiki(name), profData()]).then(function (r) {
      if (acardFor !== key) return; paint(r[0], r[1], r[2][0], r[2][1]);
      if (!own) profMore(name).then(function (o) { var more = o.l, el = $('aclinks'); paintLabels(o.lb, lab, name); if (acardFor !== key || !el) return; var kn = []; if (r[1] && r[1].url) kn.push(['Wikipedia', r[1].url]); if (r[0] && r[0].link) kn.push(['Deezer', r[0].link]); el.innerHTML = profPills(kn, more); });
      [1500, 5000, 12000].forEach(function (ms) { setTimeout(function () { var el = $('acc' + 'acc'); if (acardFor === key && el) el.innerHTML = profAccounts(name); }, ms); });   // official accounts found by a live lookup join the card when they arrive
    });
  }
  document.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('a.artlnk'); if (!t) return; e.preventDefault(); openArtistCard(t.getAttribute('data-artist') || t.textContent); });
  // ---- Artists A-Z: every artist on the four stations and their songs (data/artists/<letter>.json, loaded when a letter is opened) ----
  var AZ = { idx: null, cache: {}, L: 'A', stn: -1, q: '', el: null };
  function azLetter(n) { var c = String(n || '').trim().charAt(0).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); return /^[A-Z]$/.test(c) ? c : '#'; }
  function azLoad(L) {
    if (AZ.cache[L]) return Promise.resolve(AZ.cache[L]);
    return fetch('data/artists/' + (L === '#' ? 'num' : L.toLowerCase()) + '.json?t=' + Math.floor(Date.now() / 1800000)).then(function (r) { return r.json(); }).then(function (j) { AZ.cache[L] = j; return j; }).catch(function () { return []; });
  }
  function azSongsInCard(name, inn) {   // "the music they make": their songs on our stations, inside the profile card
    azLoad(azLetter(name)).then(function (rows) {
      var k = alNorm(name), row = rows.filter(function (r) { return alNorm(r[0]) === k; })[0];
      if (!row || acardFor !== k) return;
      var names = (AZ.idx && AZ.idx.stations) || ['1UP Radio', 'The Movement', 'Culture Shock', 'The Vault'], songs = row[1];
      var h = '<div class="acsongs"><div class="acsh">Songs on 1UP Radio (' + songs.length + ')</div>' + songs.slice(0, 8).map(function (s) { return '<div class="acsg"><span>' + esc(s[1]) + '</span><em>' + esc(names[s[0]] || '') + '</em></div>'; }).join('') + (songs.length > 8 ? '<div class="acsm">and ' + (songs.length - 8) + ' more</div>' : '') + '</div>';
      var box = inn.querySelector('.acsongs'); if (box) box.remove(); inn.insertAdjacentHTML('beforeend', h);
    });
  }
  function azShut() { if (AZ.el) AZ.el.hidden = true; }
  function azClose() { azShut(); if (window.UP1_BACKGUARD) UP1_BACKGUARD.closed(azShut); }
  function azRender() {
    var list = AZ.el.querySelector('.azlist'), q = AZ.q.trim().toLowerCase(), L = q.length >= 2 ? azLetter(q) : AZ.L;
    AZ.el.querySelectorAll('.azl button').forEach(function (b) { b.classList.toggle('on', b.dataset.l === L); });
    list.innerHTML = '<div class="azempty">Loading\u2026</div>';
    azLoad(L).then(function (rows) {
      if (AZ.q.trim().toLowerCase() !== q) return;
      var out = rows.filter(function (r) { return (AZ.stn < 0 || r[1].some(function (s) { return s[0] === AZ.stn; })) && (!q || r[0].toLowerCase().indexOf(q) >= 0); });
      var names = (AZ.idx && AZ.idx.stations) || [];
      list.innerHTML = out.length ? out.slice(0, 400).map(function (r) {
        var st = {}; r[1].forEach(function (s) { st[s[0]] = 1; });
        return '<button type="button" class="azrow" data-artist="' + esc(r[0]) + '"><b>' + esc(r[0]) + '</b><span>' + Object.keys(st).map(function (i) { return esc(names[i] || ''); }).join(' \u00b7 ') + ' \u00b7 ' + r[1].length + (r[1].length === 1 ? ' song' : ' songs') + '</span></button>';
      }).join('') + (out.length > 400 ? '<div class="azempty">Showing the first 400. Type a name to narrow it down.</div>' : '') : '<div class="azempty">No artists here.</div>';
      list.scrollTop = 0;
    });
  }
  function openAZ() {
    if (!AZ.el) {
      var el = document.createElement('div'); el.className = 'azov'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Artists A to Z');
      el.innerHTML = '<div class="azbox"><button type="button" class="acx" aria-label="Close">\u00d7</button><div class="acl">1UP Radio \u00b7 Artists A\u2013Z</div><input class="azq" type="search" placeholder="Find an artist" aria-label="Find an artist"><div class="azst"></div><div class="azl"></div><div class="azlist" role="list"></div></div>';
      document.body.appendChild(el); AZ.el = el;
      el.addEventListener('click', function (e) {
        if (e.target === el || e.target.closest('.acx')) { azClose(); return; }
        var lb = e.target.closest('.azl button'); if (lb) { AZ.L = lb.dataset.l; AZ.q = ''; el.querySelector('.azq').value = ''; azRender(); return; }
        var sb = e.target.closest('.azst button'); if (sb) { AZ.stn = +sb.dataset.s; el.querySelectorAll('.azst button').forEach(function (b) { b.classList.toggle('on', b === sb); }); azRender(); return; }
        var rw = e.target.closest('.azrow'); if (rw) openArtistCard(rw.dataset.artist);
      });
      el.querySelector('.azq').addEventListener('input', function (e) { AZ.q = e.target.value; azRender(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && AZ.el && !AZ.el.hidden && (!$('acard') || $('acard').hidden)) azClose(); });
      el.querySelector('.azl').innerHTML = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(function (c) { return '<button type="button" data-l="' + c + '">' + c + '</button>'; }).join('');
    }
    var wasHidden = AZ.el.hidden; AZ.el.hidden = false; if (wasHidden && window.UP1_BACKGUARD) UP1_BACKGUARD.opened(azShut);
    fetch('data/artists/index.json?t=' + Math.floor(Date.now() / 1800000)).then(function (r) { return r.json(); }).then(function (j) {
      AZ.idx = j; var s = AZ.el.querySelector('.azst'); AZ.stn = -1;
      s.innerHTML = '<button type="button" data-s="-1" class="on">All stations</button>' + j.stations.map(function (n, i) { return '<button type="button" data-s="' + i + '">' + esc(n) + '</button>'; }).join('');
      azRender();
    }).catch(function () { azRender(); });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('#azBtn, .azlink, #artBtn'); if (!t) return; e.preventDefault();
    if (t.id === 'artBtn') { var who = window.UP1_NOW && credits(window.UP1_NOW.title)[0]; if (who) { openArtistCard(who); return; } }
    openAZ();
  });
  function paintArtLinks(p) {
    var box = $('artlinks'); if (!box) return;
    var key = (p && p.id || '') + '|' + (ALINKS ? 1 : 0) + (LABELS ? 1 : 0); if (key === alKey) return; alKey = key;
    if (!p || !p.id) { box.hidden = true; return; }
    if (!ALINKS) { fetch(window.UP1_LINKS_URL || ('data/artist-links.json?t=' + Math.floor(Date.now() / 1800000))).then(function (r) { return r.json(); }).then(function (j) { ALINKS = ownMerge(j); }).catch(function () { ALINKS = ownMerge({}); }).then(function () { alKey = ''; paintArtLinks(curP || p); }); return; }
    if (!LABELS) { LABELS = {}; fetch('data/labels.json?t=' + Math.floor(Date.now() / 1800000)).then(function (r) { return r.json(); }).then(function (j) { LABELS = j || {}; alKey = ''; paintArtLinks(curP || p); }).catch(function () {}); }
    var html = '';
    function alIcons(L, n) { return (L.ig ? sico('instagram', L.ig, n + ' on Instagram') : '') + (L.tt ? sico('tiktok', L.tt, n + ' on TikTok') : '') + (L.x ? sico('x', L.x, n + ' on X (Twitter)') : '') + (L.yt ? sico('youtube', L.yt, n + ' on YouTube') : '') + (L.sp ? sico('spotify', L.sp, n + ' on Spotify') : '') + (L.bp ? sico('beatport', L.bp, n + ' on Beatport') : ''); }
    function grp(tag, name, icons) { return '<div class="alk"><div class="alkn"><em>' + tag + '</em><b>' + esc(name) + '</b></div><div class="alki">' + icons + '</div></div>'; }
    credits(p.title).forEach(function (n) {
      if (ALINKS[alNorm(n)] === undefined) liveLinks(n);
      var L = ALINKS[alNorm(n)]; if (!L || !(L.x || L.ig || L.tt || L.yt || L.sp || L.bp)) return;
      html += grp('Artist', n, alIcons(L, n));
    });
    var lab = LABELS && LABELS[p.id];   // the record label gets its own line after the artists
    if (lab) {
      var lk = 'label:' + alNorm(lab); if (ALINKS[lk] === undefined) liveLinks(lab, 'label');
      var LL = ALINKS[lk]; if (LL && (LL.x || LL.ig || LL.tt || LL.yt)) html += grp('Label', lab, alIcons(LL, lab));
    }
    if (/^(1up|movement)$/.test(window.UP1_STATION || '1up')) {   // house tunes are mostly on Beatport: a button for the playing track itself (a Beatport search for it)
      var sp = split(p.title), bq = encodeURIComponent(sp[0] ? sp[0] + ' ' + sp[1] : sp[1]);
      html += grp('Track', 'Find on Beatport', sico('beatport', 'https://www.beatport.com/search?q=' + bq, 'Find this track on Beatport'));
    }
    box.innerHTML = ''; html = html ? '<div class="alkhead"><span class="alklab">Playing now · artist &amp; label accounts</span><a class="azlink" href="#">All artists A–Z ›</a></div>' + html : ''; box.hidden = true;
    try { linkArtistLine(); } catch (e) {}
  }
  function paintSaved() {
    var el = $('saved'); if (!el) return; paintHearts();
    $('savedn').textContent = saved.length ? '(' + saved.length + ')' : '';
    $('savedhint').style.display = saved.length ? 'none' : '';
    el.innerHTML = saved.map(function (s, i) {
      var a = split(s.title), q = encodeURIComponent(a[0] ? a[0] + ' ' + a[1] : a[1]), L = s.links || null, lk = '';
      var dance = /^(1up|movement)$/.test(window.UP1_STATION || '1up'), sid = encodeURIComponent(s.id);   // the house stations: Beatport comes right after YouTube
      var yt = sico('youtube', 'https://www.youtube.com/watch?v=' + sid, 'Open on YouTube'), bp = sico('beatport', 'https://www.beatport.com/search?q=' + q, 'Search on Beatport');
      lk += yt + (dance ? bp : '');
      if (L && L.apple) lk += sico('apple', L.apple, 'Open on Apple Music');
      if (L && L.deezer) lk += sico('deezer', L.deezer, 'Open on Deezer');
      lk += sico('spotify', 'https://open.spotify.com/search/' + q, 'Search on Spotify') + sico('ytmusic', 'https://music.youtube.com/watch?v=' + sid, 'Open on YouTube Music') +
        sico('amazon', 'https://music.amazon.com/search/' + q, 'Search on Amazon Music') + sico('tidal', 'https://listen.tidal.com/search?q=' + q, 'Search on Tidal') + (dance ? '' : bp);
      lk += !(L && L.apple !== undefined && L.deezer !== undefined) ? '<span class="snf">checking Apple &amp; Deezer…</span>' : (L.apple || L.deezer ? '' : '<span class="snf">not found on Apple or Deezer</span>');
      var LY = s.ly && s.ly.text ? s.ly : null;
      var lyb = '';
      if (LY) lyb = '<button class="chip found lybtn" data-i="' + i + '" type="button" aria-expanded="false">♪ Lyrics ✓</button>';
      else if (s.ly === undefined && (s.lyt || 0) < 3) lyb = '<button class="chip lybtn lywait" type="button" disabled>♪ Lyrics …</button>';
      else lyb = '<button class="chip lybtn lyretry" data-i="' + i + '" type="button" title="No lyrics found yet. Tap to search again.">♪ Lyrics ?</button> <span class="snf">none found yet · tap to search again</span>';
      return '<li class="srow"><span class="st">' + esc(a[0] ? a[0] + ' — ' + a[1] : a[1]) + ' ' + lyb + '</span><button class="sdel" data-i="' + i + '" type="button" aria-label="Remove from saved songs" title="Remove">✕</button><div class="slinks">' + lk + '</div>' + (LY ? '<div class="slyr" hidden><div class="slyh"><span>' + esc((LY.t || '') + (LY.a ? ' · ' + LY.a : '') + (LY.ai ? ' · 🤖 AI-transcribed, may contain mistakes' : '')) + '</span><button class="chip lycopy" data-i="' + i + '" type="button">⧉ Copy</button></div><pre>' + esc(LY.text) + '</pre></div>' : '') + '</li>';
    }).join('');
    lookupMissing(); setTimeout(lookupLyricsForSaved, 1500);   // after the page has finished starting (the lyrics code is defined further down)
  }
  var lyLooking = false, lyRL = 0;   // lyRL: when LRCLIB last said "too many requests" (then a miss is not a real miss)
  function lookupLyricsForSaved() {   // find the words for saved songs, one at a time; kept with the song so they show in the list
    if (lyLooking || typeof fetchLyrics !== 'function') return;
    saved.forEach(function (s) { if (s.ly === '' && Date.now() - (s.lyat || 0) > 864e5) { s.ly = undefined; s.lyt = 0; } });   // not found? look again every 24 h (new lyrics get added over time)
    var x = saved.find(function (s) { return s.ly === undefined && (s.lyt || 0) < 3 && !/^\s*billy legal\b/i.test(s.title || ''); }); if (!x) return;
    lyLooking = true; x.lyt = (x.lyt || 0) + 1;
    var pr; try { pr = fetchLyrics([x.title], 0); } catch (e) { lyLooking = false; return; }
    pr.then(function (d) {
      if (!d && Date.now() - lyRL < 20000) { x.lyt = Math.max(0, (x.lyt || 1) - 1); lyLooking = false; setTimeout(lookupLyricsForSaved, 60000); return; }   // rate-limited: try again in a minute, do not call it "not found"
      x.ly = d && d.text ? { t: d.t, a: d.a, ai: !!d.ai, text: d.text.slice(0, 8000) } : ''; x.lyat = Date.now(); persistSaved(); lyLooking = false; paintSaved(); }).catch(function () { persistSaved(); lyLooking = false; });
  }
  // ---- which services carry a saved song: Apple Music (iTunes search) and Deezer (search, via JSONP) ----
  function sw(t) { return (t || '').toLowerCase().replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\b(feat|ft|featuring|remaster(ed)?|radio edit|original mix|mix|version|edit|official|video|audio|lyrics?)\b/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean); }
  // exact-song check: artist AND title must match ("Billy Legal - X" must not match "Billy Vaughn - X")
  function inter(x, y) { return x.filter(function (w) { return y.indexOf(w) >= 0; }).length; }
  function matchOne(A, T, cA, cT) {
    if (!T.length || !cT.length) return false;
    if (inter(T, cT) / T.length < 0.8 || inter(cT, T) / cT.length < 0.6) return false;
    return !A.length || inter(A, cA) / Math.min(A.length, cA.length || 1) >= 0.7;
  }
  function sameSong(saved, cArtist, cTrack) {
    var p = split(saved), A = sw(p[0]), T = sw(p[1]), cA = sw(cArtist), cT = sw(cTrack);
    return matchOne(A, T, cA, cT) || (A.length > 0 && matchOne(T, A, cA, cT));   // station may send "Title - Artist"
  }
  function jsonp(u) {
    return new Promise(function (res) {
      var cb = 'up1jp' + Math.random().toString(36).slice(2), s = document.createElement('script'), tm;
      function done(d) { clearTimeout(tm); try { delete window[cb]; } catch (e) { window[cb] = undefined; } s.remove(); res(d); }
      tm = setTimeout(function () { done(null); }, 7000); window[cb] = done; s.onerror = function () { done(null); };
      s.src = u + '&output=jsonp&callback=' + cb; document.head.appendChild(s);
    });
  }
  // links.apple / links.deezer: URL = found, '' = checked and not there, undefined = could not check yet
  function findLinks(title, prev) {
    var parts = split(title), plain = parts[0] ? parts[0] + ' ' + parts[1] : parts[1], links = {}, qq = encodeURIComponent(plain);
    if (prev) { links.apple = prev.apple; links.deezer = prev.deezer; }
    function apple(n) {
      if (links.apple !== undefined || n > 1) return Promise.resolve();
      return fetch('https://itunes.apple.com/search?media=music&entity=song&limit=8&term=' + qq).then(function (r) { return r.json(); }).then(function (r) {
        var m = (r.results || []).find(function (x) { return sameSong(title, x.artistName, x.trackName); });
        links.apple = m ? m.trackViewUrl.replace(/[?&]uo=\d+/, '') : '';
      }).catch(function () { return new Promise(function (ok) { setTimeout(ok, 1200); }).then(function () { return apple(n + 1); }); });
    }
    return apple(0).then(function () { return links.deezer !== undefined ? null : jsonp('https://api.deezer.com/search?limit=8&q=' + qq); }).then(function (d) {
      if (d && d.data) { var m = d.data.find(function (x) { return sameSong(title, x.artist.name, x.title_short || x.title); }); links.deezer = m ? m.link : ''; }
      return links;
    });
  }
  var lookingUp = false;
  function lookupMissing() {
    if (lookingUp) return;
    saved.forEach(function (s) { if (s.lv !== 2) { s.links = {}; s.tries = 0; s.lv = 2; } });   // re-check songs matched by the older, looser rule
    saved.forEach(function (s) { var l = s.links || {}; if (s.chk && Date.now() - s.chk > 864e5 && (l.apple === '' || l.deezer === '')) { if (l.apple === '') l.apple = undefined; if (l.deezer === '') l.deezer = undefined; s.tries = 0; s.chk = 0; } });   // not found yet? look again every 24 h
    var x = saved.find(function (s) { var l = s.links || {}; return (l.apple === undefined || l.deezer === undefined) && (s.tries || 0) < 3; }); if (!x) return;
    lookingUp = true; x.tries = (x.tries || 0) + 1;
    findLinks(x.title, x.links).then(function (l) { x.links = l; if (l.apple !== undefined && l.deezer !== undefined) x.chk = Date.now(); persistSaved(); lookingUp = false; paintSaved(); }).catch(function () { lookingUp = false; });
  }
  $('saveBtn').addEventListener('click', function () {
    var p = curP || S.plays[idx]; if (!p) return;
    var k = saved.findIndex(function (s) { return s.id === p.id; });
    if (k >= 0) saved.splice(k, 1); else saved.unshift({ id: p.id, title: p.title, at: Date.now() });
    persistSaved(); paintSave(); paintSaved();
  });
  $('saved').addEventListener('click', function (e) {
    var cb = e.target.closest('.lycopy'); if (cb) {   // copy the words (one line per row) to the clipboard
      var sv0 = saved[+cb.dataset.i], txt = sv0 && sv0.ly && sv0.ly.text ? sv0.ly.text : ''; if (!txt) return;
      var done = function () { cb.textContent = '✓ Copied'; setTimeout(function () { cb.textContent = '⧉ Copy'; }, 1500); };
      var ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
      var okc = false; try { okc = document.execCommand('copy'); } catch (er) {} ta.remove();
      if (okc) done(); else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () {});
      return;
    }
    var rt = e.target.closest('.lyretry'); if (rt) { var sv = saved[+rt.dataset.i]; if (sv) { sv.ly = undefined; sv.lyt = 0; persistSaved(); paintSaved(); } return; }
    var lb = e.target.closest('.lybtn'); if (lb) { var pn = lb.closest('.srow').querySelector('.slyr'); if (pn) { pn.hidden = !pn.hidden; lb.setAttribute('aria-expanded', pn.hidden ? 'false' : 'true'); } return; }
    var b = e.target.closest('.sdel'); if (!b) return; saved.splice(+b.dataset.i, 1); persistSaved(); paintSave(); paintSaved(); });
  document.addEventListener('click', function (e) {   // heart on any track row (week list, up next, just played)
    var b = e.target.closest('.hb'); if (!b) return;
    var p = S.plays.find(function (x) { return x.t === +b.dataset.t; }); if (!p) return;
    var n = saved.findIndex(function (s) { return s.id === p.id; });
    if (n >= 0) saved.splice(n, 1); else saved.unshift({ id: p.id, title: p.title, at: Date.now() });
    persistSaved(); paintSave(); paintSaved();
  });
  paintSaved();

  // ---- lyrics: LRCLIB (free, no key) timed lyrics that follow the song on the YouTube clock ----
  var lyr = { key: '', data: null, tok: 0, adj: 0, idx: -1, manual: 0, looking: false, cache: {} };
  var lyBox = $('lyrics');
  function fold(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function parseSong(t) {
    var s = String(t || '').replace(/\s*[\(\[][^)\]]*(remaster|version|edit|mix|live|feat|ft\.?|official|video|radio|explicit|lyrics?|audio)[^)\]]*[\)\]]/ig, '').replace(/\s+/g, ' ').trim(), m = s.split(/\s[-–—]\s/);
    return m.length >= 2 ? { artist: m[0].trim(), track: m.slice(1).join(' - ').trim() } : { artist: '', track: s };
  }
  function parseLRC(s) {
    if (!s) return null; var out = [];
    s.split('\n').forEach(function (row) { var m = /^\s*((?:\[\d+:\d+(?:\.\d+)?\]\s*)+)(.*)$/.exec(row); if (!m) return; (m[1].match(/\[(\d+):(\d+(?:\.\d+)?)\]/g) || []).forEach(function (ts) { var mm = /\[(\d+):(\d+(?:\.\d+)?)\]/.exec(ts); out.push({ t: +mm[1] * 60 + +mm[2], l: m[2].trim() }); }); });
    out.sort(function (x, y) { return x.t - y.t; }); return out.length > 4 ? out : null;
  }
  var STRIP = /\b(remix|mix|edit|version|remaster(?:ed)?|dub|rework|bootleg|vip)\b/i;
  function variants(t) {   // the station's title -> (artist, track) guesses: drop (brackets), feat., trailing "- X Remix"; first of "A/B", "A, B"
    var s = String(t || '').replace(/\s*[\(\[][^)\]]*[\)\]]/g, '').replace(/\b(feat|ft|featuring)\.?\s.*$/i, ''), parts = s.split(/\s[-–—]\s/).map(function (x) { return x.trim(); }).filter(Boolean);
    while (parts.length > 2 && STRIP.test(parts[parts.length - 1])) parts.pop();
    if (parts.length >= 2 && STRIP.test(parts[parts.length - 1])) parts.pop();
    if (parts.length < 2) return [{ artist: '', track: parts[0] || s }];
    var tr = parts.slice(1).join(' - '), first = parts[0].split(/\s*[\/,&]\s*/)[0].trim(), out = [{ artist: first, track: tr }];
    if (first !== parts[0]) out.push({ artist: parts[0], track: tr });
    if (window.UP1_STATION && window.UP1_STATION !== '1up') {   // Culture Shock's channel writes "Song / Version - Artist": try that order first
      var ra = parts[parts.length - 1].split(/\s*[\/,&]\s*/)[0].trim(), rt = parts.slice(0, -1).join(' - ').split(/\s*\/\s*/)[0].trim();
      if (ra && rt) out.unshift({ artist: ra, track: rt });
    }
    return out;
  }
  var AI_URL = window.UP1_AI_URL || 'https://aviewfromspace.com/data/', aiIdx = null;
  function aiKey(t) { var f = String(t || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); return crypto.subtle.digest('SHA-1', new TextEncoder().encode(f)).then(function (b) { return Array.prototype.slice.call(new Uint8Array(b), 0, 6).map(function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }); }
  function aiLyrics(titles) {   // lyrics transcribed from the audio on the PC (Radio Globe's library) for songs LRCLIB lacks
    var go = aiIdx ? Promise.resolve() : fetch(AI_URL + 'ai_lyrics_index.json').then(function (r) { return r.json(); }).then(function (j) { aiIdx = j.items || {}; setTimeout(function () { aiIdx = null; }, 300000); });
    return go.then(function () { return Promise.all(titles.filter(Boolean).map(aiKey)); }).then(function (ks) {
      var k = ks.find(function (x) { return aiIdx[x]; }); if (!k) return null;
      return fetch(AI_URL + 'ai_lyrics/' + k + '.json').then(function (r) { return r.json(); }).then(function (d) {
        if (!d.lines || !d.lines.length) return null; var p = parseSong(d.title || titles[0]);
        return { t: p.track || d.title, a: p.artist, ai: true, text: d.lines.map(function (x) { return x.l; }).join('\n'), sync: d.lines.map(function (x) { return { t: x.t, l: x.l }; }) };
      });
    }).catch(function () { return null; });
  }
  var lyTrouble = false;
  function fetchLyrics(titles, dur) {   // titles: the station's title + YouTube's own; best LRCLIB match (closest in length, timed preferred) else the AI library
    if (titles.some(function (t) { return /^\s*billy legal\b/i.test(t || ''); })) return Promise.resolve(null);   // Billy's own songs: no lyrics source is verified, never guess
    var enc = encodeURIComponent, seen = {}, vs = [];
    titles.forEach(function (t) { variants(t).forEach(function (v) { var k = fold(v.artist + '|' + v.track); if (v.track && v.track.length > 1 && !seen[k]) { seen[k] = 1; vs.push(v); } }); });
    function J(u, again) {
      return fetch(u).then(function (r) {
        if (r.status === 429) lyRL = Date.now();
        if (r.ok) return r.json();
        if (r.status === 404 || r.status === 400) return null;                                     // a real "not found"
        lyTrouble = true;                                                                           // 429 / 5xx: the free lyrics server is busy, which is not the same as "no lyrics"
        return again ? null : new Promise(function (go) { setTimeout(function () { go(J(u, true)); }, 1200); });
      }).catch(function () { lyTrouble = true; return null; });
    }
    function good(d) { return d && (d.plainLyrics || '').trim().length > 40 && !d.instrumental; }
    function pack(d) { return { t: d.trackName, a: d.artistName, text: d.plainLyrics.trim(), sync: parseLRC(d.syncedLyrics) }; }
    function score(d) { return Math.abs((d.duration || 0) - dur) - (d.syncedLyrics ? 30 : 0); }
    function tryV(i) {
      if (i >= vs.length) return Promise.resolve(null);
      var v = vs[i], ft = fold(v.track), fa = fold(v.artist), exact = v.artist ? J('https://lrclib.net/api/get?artist_name=' + enc(v.artist) + '&track_name=' + enc(v.track)) : Promise.resolve(null);
      return exact.then(function (d) {
        if (good(d)) return pack(d);
        var qs = ['track_name=' + enc(v.track) + (v.artist ? '&artist_name=' + enc(v.artist) : ''), 'q=' + enc((v.artist + ' ' + v.track).trim()), 'q=' + enc(v.track)];
        return Promise.all(qs.map(function (q) { return J('https://lrclib.net/api/search?' + q); })).then(function (rs) {
          var c = {}; rs.forEach(function (res) { (res || []).forEach(function (d) {
            if (!good(d)) return; var dt = fold(d.trackName), da = fold(d.artistName);
            if (!(dt === ft || (ft.length > 3 && (dt.indexOf(ft) >= 0 || ft.indexOf(dt) >= 0)))) return;
            if (fa && !fa.split(' ').some(function (w) { return da.split(' ').indexOf(w) >= 0; })) return; c[d.id] = d; }); });
          var l = Object.keys(c).map(function (k) { return c[k]; }); if (!l.length) return tryV(i + 1);
          l.sort(function (x, y) { return score(x) - score(y); }); return pack(l[0]);
        });
      });
    }
    return tryV(0).then(function (d) { return d || aiLyrics(titles); }).catch(function () { return aiLyrics(titles); });
  }
  function lyrCheck() {   // the song on air changed -> look its lyrics up
    var p = curP, key = p ? p.id + '|' + p.title : '';
    if (key === lyr.key) return; lyr.key = key; lyr.data = null; lyr.idx = -1; lyr.adj = 0; lyr.manual = 0; var tok = ++lyr.tok;
    var b = $('lyrBtn'); b.disabled = true; b.classList.remove('on'); if (!p) return;
    if (lyr.cache[key] !== undefined) { lyr.data = lyr.cache[key]; b.disabled = !lyr.data; b.classList.toggle('on', !!lyr.data); return; }
    lyr.looking = true;
    var ytT = ''; try { ytT = yt.getVideoData().title || ''; } catch (e) {}
    lyTrouble = false;
    fetchLyrics([p.title, ytT], p.dur || 0).then(function (d) {
      if (!d && lyTrouble) {   // the server had trouble: do not cache "none", look again in a little while (up to 4 times)
        lyr.tries = lyr.tries || {}; lyr.tries[key] = (lyr.tries[key] || 0) + 1;
        if (tok === lyr.tok && lyr.tries[key] < 4) setTimeout(function () { if (lyr.key === key) lyr.key = ''; }, 12000 * lyr.tries[key]);
      } else lyr.cache[key] = d;
      if (tok !== lyr.tok) return; lyr.data = d; lyr.looking = false; b.disabled = !d; b.classList.toggle('on', !!d);
    });
  }
  function lyrPaint() {
    var d = lyr.data; if (!d) return; $('lyT').textContent = d.t; $('lyA').textContent = d.a + (d.ai ? (d.a ? ' · ' : '') + '🤖 AI-transcribed, may contain mistakes' : ''); lyr.idx = -1; lyBox.dataset.k = lyr.key;
    if (d.sync) { $('lyB').innerHTML = d.sync.map(function (r, i) { return '<div class="ll" data-i="' + i + '">' + (r.l ? esc(r.l) : '♪') + '</div>'; }).join(''); lyBox.classList.add('sync'); }
    else { $('lyB').textContent = d.text; lyBox.classList.remove('sync'); }
    $('lyB').scrollTop = 0;
  }
  function lyrPos() { if (!yt || !ready) return null; try { return yt.getCurrentTime() + lyr.adj; } catch (e) { return null; } }
  function lyShut() { lyBox.classList.add('hidden'); lyWant = false; }   // used by the Back button (see UP1_BACKGUARD in stations.js)
  var lyWant = false, lyDesk = window.matchMedia ? matchMedia('(min-width:700px)') : { matches: false };   // lyWant: the listener opened the lyrics and has not closed them, so on a computer they come back by themselves for the next song that has words
  $('lyrBtn').addEventListener('click', function () { if (!lyr.data) return; if (lyBox.classList.contains('hidden')) { lyrPaint(); lyBox.classList.remove('hidden'); lyWant = true; if (!lyDesk.matches && window.UP1_BACKGUARD) UP1_BACKGUARD.opened(lyShut); } else { lyShut(); if (window.UP1_BACKGUARD) UP1_BACKGUARD.closed(lyShut); } });
  $('lyC').addEventListener('click', function () {   // copy the words (plain, one line per row) to the clipboard
    var d = lyr.data; if (!d) return; var txt = (d.sync ? d.sync.map(function (r) { return r.l; }).join('\n') : d.text);
    var b = $('lyC'); function ok() { b.textContent = '✓ Copied'; b.classList.add('done'); setTimeout(function () { b.textContent = '⧉ Copy'; b.classList.remove('done'); }, 1500); }
    function old() { var ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); ok(); } catch (e) {} ta.remove(); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, old); else old();
  });
  $('lyX').addEventListener('click', function () { lyShut(); if (window.UP1_BACKGUARD) UP1_BACKGUARD.closed(lyShut); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { lyShut(); if (window.UP1_BACKGUARD) UP1_BACKGUARD.closed(lyShut); } });
  $('lyM').addEventListener('click', function () { lyr.adj -= 0.5; }); $('lyP').addEventListener('click', function () { lyr.adj += 0.5; });
  $('lyB').addEventListener('click', function (e) {   // tap the line you hear -> lock the timing to it
    var ln = e.target.closest('.ll'); if (!ln || !lyr.data || !lyr.data.sync || !yt || !ready) return;
    try { lyr.adj = lyr.data.sync[+ln.dataset.i].t - yt.getCurrentTime(); } catch (x) {} lyr.manual = performance.now();
  });
  $('lyB').addEventListener('wheel', function () { lyr.manual = performance.now(); }, { passive: true });
  $('lyB').addEventListener('touchmove', function () { lyr.manual = performance.now(); }, { passive: true });
  setInterval(lyrCheck, 1000);
  (function follow() {
    requestAnimationFrame(follow);
    document.documentElement.classList.toggle('lyopen', !lyBox.classList.contains('hidden'));
    if (lyBox.classList.contains('hidden')) { if (lyWant && lyDesk.matches && lyr.data) { lyrPaint(); lyBox.classList.remove('hidden'); } return; }
    if (!lyr.data) { lyBox.classList.add('hidden'); if (window.UP1_BACKGUARD) UP1_BACKGUARD.closed(lyShut); return; }
    if (lyBox.dataset.k !== lyr.key) lyrPaint();   // next song started while the window was open
    var d = lyr.data, hint = $('lyH'); if (!d.sync) { hint.textContent = 'Words only · no timing for this song'; return; }
    var p = lyrPos(); if (p == null) { hint.textContent = 'Press play and the words will follow'; return; }
    hint.textContent = 'Following the song · tap a line to re-sync' + (lyr.adj ? ' · ' + (lyr.adj > 0 ? '+' : '') + lyr.adj.toFixed(1) + 's' : '');
    var i = -1; for (var k = 0; k < d.sync.length; k++) { if (d.sync[k].t <= p + 0.15) i = k; else break; }
    if (i !== lyr.idx) {
      var rows = $('lyB').children; if (rows[lyr.idx]) rows[lyr.idx].classList.remove('on'); lyr.idx = i;
      if (rows[i]) { rows[i].classList.add('on'); if (performance.now() - lyr.manual > 4000) { var b = $('lyB'), r = rows[i]; b.scrollTo({ top: r.offsetTop - b.clientHeight / 2 + r.offsetHeight / 2, behavior: 'smooth' }); } }
    }
  })();

  // ---- color themes: every tap on THEME switches to the next of 8 colors ----
  var THEMES = ['#39ff14', '#ffb000', '#ff3b3b', '#00e5ff', '#b4ff3c', '#ffe066', '#ff6a00', '#d946ff'], themeI = 0;
  var SKINS = ['retro', 'stream', 'glass', 'mono', 'synth', 'vinyl', 'terminal', 'brutal', 'aegean', 'gameboy', 'cassette', 'dash', 'space', 'marquee', 'blueprint', 'candy', 'glitch', 'press', 'meters', 'wormhole', 'nebula', 'culture', 'shock', 'dubby', 'vault', 'house'], skinI = 0;
  var SKIN_NAMES = ['Retro', 'Stream', 'Glass', 'Mono', 'Synth', 'Vinyl', 'Terminal', 'Brutal', 'Aegean', 'GameBoy', 'Cassette', 'Dash', 'Space', 'Marquee', 'Blueprint', 'Candy', 'Glitch', 'Press', 'Meters', 'Wormhole', 'Nebula', 'Culture', 'Shock', 'Dubby', 'Vault', 'House'];
  var LIGHT = { glass: 1, aegean: 1, cassette: 1, candy: 1, press: 1 }, NATIVE_OK = { retro: 0, stream: 0 };   // light skins get a darker tint of the colour; every other skin can also go back to its own native colours (-1)
  // Place the SKIN button right after the THEME button whatever the skin's font makes of their widths (desktop; phones lay them out in a row via CSS).
  function fitBtns() { var t = $('themeBtn'), s = $('skinBtn'); if (!t || !s) return; if (window.innerWidth <= 900) { s.style.left = ''; return; } s.style.left = (t.offsetLeft + t.offsetWidth + 10) + 'px'; }
  window.addEventListener('resize', fitBtns); if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitBtns);
  function skinName() { return SKINS[skinI]; }
  function themeKey() { return skinName() === 'retro' ? 'up1-theme' : 'up1-theme-' + skinName(); }
  function applyTheme(i) {
    var sk = skinName(), canNative = !(sk in NATIVE_OK), st = document.documentElement.style;
    ['--g', '--gr', '--g2', '--line', '--bg2', '--ga', '--gb', '--gc', '--gd2'].forEach(function (p) { st.removeProperty(p); });
    if (i < 0 && canNative) themeI = -1; else themeI = ((i % THEMES.length) + THEMES.length) % THEMES.length;
    if (themeI >= 0) {
      var hex = THEMES[themeI], r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
      var mix = function (k, base) { return 'rgb(' + [r, g, b].map(function (v) { return Math.min(255, Math.round(v * k + base)); }).join(',') + ')'; };
      if (sk === 'gameboy') {     // the four Game Boy tones, rebuilt from the chosen colour
        st.setProperty('--ga', mix(0.16, 0)); st.setProperty('--gb', mix(0.38, 0)); st.setProperty('--gc', mix(0.62, 40)); st.setProperty('--gd2', mix(0.66, 55));
      } else {
        var k = LIGHT[sk] ? 0.62 : 1, rr = Math.round(r * k), gg = Math.round(g * k), bb = Math.round(b * k);
        st.setProperty('--g', 'rgb(' + rr + ',' + gg + ',' + bb + ')'); st.setProperty('--gr', rr + ',' + gg + ',' + bb);
        if (!LIGHT[sk] && (sk === 'retro' || sk === 'stream' || sk === 'mono' || sk === 'synth' || sk === 'vinyl' || sk === 'terminal' || sk === 'dash' || sk === 'space' || sk === 'marquee' || sk === 'blueprint' || sk === 'glitch' || sk === 'wormhole')) st.setProperty('--g2', mix(0.45, 140));
        if (sk === 'retro' || sk === 'stream') { st.setProperty('--line', mix(0.16, 6)); st.setProperty('--bg2', mix(0.035, 9)); }
      }
    }
    if (themeI >= 0) document.documentElement.setAttribute('data-themed', ''); else document.documentElement.removeAttribute('data-themed');
    try { localStorage.setItem(themeKey(), String(themeI)); } catch (e) {}
  }
  function storedTheme() { try { var v = localStorage.getItem(themeKey()); if (v !== null) return +v; } catch (e) {} return (skinName() in NATIVE_OK) ? 0 : -1; }
  function setBars(n) {   // the meter bridge: 12 bars normally, a whole wall of them in the Meters skin (each its own colour, speed and height)
    var eq = $('eq'); if (!eq) return; var want = n || 12;
    if (eq.children.length !== want || (n && !eq.firstChild.style.getPropertyValue('--bc')) || (!n && eq.firstChild.getAttribute('style'))) {
      var html = ''; for (var i = 0; i < want; i++) html += n ? '<i style="--bc:hsl(' + Math.round(i * 360 / want) + ',95%,55%);--d:' + (0.45 + Math.random() * 0.9).toFixed(2) + 's;--dl:-' + (Math.random() * 1.6).toFixed(2) + 's;--hh:' + Math.round(55 + Math.random() * 45) + '%"></i>' : '<i></i>';
      eq.innerHTML = html;
    }
  }
  // ---- wormhole skin: a canvas flight down a glowing tunnel (rings, warp streaks, a spaceship, and meter bars) ----
  var wc = null, wx = null, wRaf = 0, wLast = 0, wZ = 0, wSpeed = 0.35, wStars = [], wHue = 270, wHueAt = 0, wDpr = 1;
  function wormHue(t) {   // rainbow-ish violet/blue/magenta by default; the chosen THEME colour when one is picked
    if (t - wHueAt > 0.5) { wHueAt = t; if (document.documentElement.hasAttribute('data-themed')) { var gr = (getComputedStyle(document.documentElement).getPropertyValue('--gr') || '169,139,255').split(',').map(Number), r = gr[0] / 255, g = gr[1] / 255, b = gr[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0; if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; } wHue = h; wThemed = true; } else { wThemed = false; } }
    return wHue;
  }
  var wThemed = false, wLogo = null, wLogoOk = false;
  function wormSize() { if (!wc) return; wDpr = Math.min(window.devicePixelRatio || 1, 1.5); wc.width = Math.round(innerWidth * wDpr); wc.height = Math.round(innerHeight * wDpr); }
  function wLevel(i, t, n) {   // fake spectrum (the YouTube player will not let the page hear the sound): lively while playing, calm when paused
    var p = playing ? 1 : 0.18, v = 0.35 + 0.3 * Math.sin(t * (1.4 + i * 0.11) + i * 1.7) + 0.25 * Math.abs(Math.sin(t * 2.3 + i * 0.63));
    var beat = playing ? Math.pow(Math.abs(Math.sin(t * 2.15)), 8) * (1 - i / n * 0.6) : 0;
    return Math.max(0.03, Math.min(1, (v * p + beat * 0.55)));
  }
  function wormFrame(ts) {
    wRaf = requestAnimationFrame(wormFrame);
    if (!wc || document.hidden) return;
    var t = ts / 1000, dt = Math.min(0.05, (ts - wLast) / 1000 || 0.016); wLast = ts;
    wSpeed += ((playing ? 1 : 0.35) - wSpeed) * Math.min(1, dt * 2);
    var W = wc.width, H = wc.height, cx = W / 2, cy = H * 0.45, M = Math.min(W, H), ctx = wx, hue0 = wormHue(t), sw = wThemed ? 28 : 70;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(2,2,12,0.32)'; ctx.fillRect(0, 0, W, H);
    wZ = (wZ + dt * 0.5 * wSpeed) % 1;
    var ang0 = t * 0.18 * (0.5 + wSpeed), k, a;
    ctx.globalCompositeOperation = 'lighter';
    var N = 26, prev = null;
    for (k = 0; k < N; k++) {                       // rings: small and far at the centre, big and near at the edge
      var u = (k + wZ) / N, r = Math.pow(u, 2.3) * Math.hypot(W, H) * 0.62, ox = Math.sin(t * 0.7 + u * 3.2) * W * 0.07 * (1 - u), oy = Math.cos(t * 0.9 + u * 2.6) * H * 0.05 * (1 - u);
      var hue = (hue0 + sw * Math.sin(u * 6 + t * 0.6)) % 360;
      ctx.strokeStyle = 'hsla(' + hue + ',100%,' + (48 + u * 14) + '%,' + (0.12 + u * 0.55) + ')'; ctx.lineWidth = (1 + u * 6) * wDpr;
      ctx.beginPath(); ctx.arc(cx + ox, cy + oy, Math.max(1, r), 0, 6.2832); ctx.stroke();
      if (prev && k % 2 === 0) {                    // tunnel ribs between neighbouring rings
        ctx.lineWidth = wDpr; ctx.strokeStyle = 'hsla(' + hue + ',100%,60%,' + (0.08 + u * 0.18) + ')';
        ctx.beginPath(); for (a = 0; a < 12; a++) { var an = a / 12 * 6.2832 + ang0 * (1 + u); ctx.moveTo(prev.x + Math.cos(an) * prev.r, prev.y + Math.sin(an) * prev.r); ctx.lineTo(cx + ox + Math.cos(an) * r, cy + oy + Math.sin(an) * r); } ctx.stroke();
      }
      prev = { x: cx + ox, y: cy + oy, r: Math.max(1, r) };
    }
    if (!wStars.length) for (k = 0; k < 110; k++) wStars.push({ a: Math.random() * 6.2832, r: Math.random(), s: 0.3 + Math.random() * 0.9 });
    ctx.lineCap = 'round';
    for (k = 0; k < wStars.length; k++) {           // warp streaks flying past
      var st = wStars[k]; st.r += dt * (0.25 + st.s) * (0.5 + wSpeed * 1.6) * (0.2 + st.r); if (st.r > 1.1) { st.r = 0.02; st.a = Math.random() * 6.2832; }
      var r1 = st.r * Math.hypot(W, H) * 0.55, r2 = r1 + (4 + st.r * 38 * wSpeed) * wDpr;
      ctx.strokeStyle = 'hsla(' + ((hue0 + k * 3) % 360) + ',90%,80%,' + Math.min(0.9, st.r * 1.2) + ')'; ctx.lineWidth = (0.6 + st.r * 2) * wDpr;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(st.a + ang0) * r1, cy + Math.sin(st.a + ang0) * r1); ctx.lineTo(cx + Math.cos(st.a + ang0) * r2, cy + Math.sin(st.a + ang0) * r2); ctx.stroke();
    }
    var gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, M * 0.2); gl.addColorStop(0, 'rgba(255,255,255,0.95)'); gl.addColorStop(0.25, 'hsla(' + hue0 + ',100%,65%,0.55)'); gl.addColorStop(1, 'hsla(' + hue0 + ',100%,50%,0)');
    ctx.fillStyle = gl; ctx.fillRect(cx - M * 0.2, cy - M * 0.2, M * 0.4, M * 0.4);
    var pulse = playing ? Math.pow(Math.abs(Math.sin(t * 2.15)), 8) : 0.2 * (0.5 + 0.5 * Math.sin(t * 1.2)), rl = M * 0.115 * (1 + 0.05 * pulse);
    var lg = ctx.createRadialGradient(cx, cy, rl * 0.8, cx, cy, rl * 3.2); lg.addColorStop(0, 'hsla(' + hue0 + ',100%,70%,' + (0.5 + 0.35 * pulse) + ')'); lg.addColorStop(0.35, 'hsla(' + hue0 + ',100%,60%,' + (0.2 + 0.2 * pulse) + ')'); lg.addColorStop(1, 'hsla(' + hue0 + ',100%,50%,0)');
    ctx.fillStyle = lg; ctx.fillRect(cx - rl * 3.2, cy - rl * 3.2, rl * 6.4, rl * 6.4);
    ctx.lineWidth = Math.max(1, wDpr * 1.4); ctx.lineCap = 'round';
    for (k = 0; k < 36; k++) {                      // light rays streaming out of the logo
      var ra = k / 36 * 6.2832 + t * 0.12, rs = 0.5 + 0.5 * Math.sin(t * 1.7 + k * 2.1), r0 = rl * 1.08, r1 = rl * (1.35 + rs * (0.7 + pulse * 0.9));
      ctx.strokeStyle = 'hsla(' + ((hue0 + k * 4) % 360) + ',100%,78%,' + (0.18 + 0.4 * rs) + ')';
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(ra) * r0, cy + Math.sin(ra) * r0); ctx.lineTo(cx + Math.cos(ra) * r1, cy + Math.sin(ra) * r1); ctx.stroke();
    }
    var NB = 56, R0 = M * 0.2;                      // meter ring around the tunnel mouth
    ctx.lineWidth = Math.max(2, M * 0.009);
    for (k = 0; k < NB; k++) {
      var lv = wLevel(k % 28, t, 28), an2 = k / NB * 6.2832 + ang0 * 0.5, len = M * (0.02 + lv * 0.2);
      ctx.strokeStyle = 'hsl(' + ((wThemed ? hue0 + (k % 8) * 5 : k / NB * 360 + t * 20) % 360) + ',100%,' + (50 + lv * 18) + '%)';
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(an2) * R0, cy + Math.sin(an2) * R0 * 0.9); ctx.lineTo(cx + Math.cos(an2) * (R0 + len), cy + Math.sin(an2) * (R0 + len) * 0.9); ctx.stroke();
    }
    var NF = 44, bw = W / NF;                       // meter bars along the bottom edge
    for (k = 0; k < NF; k++) {
      var lf = wLevel(k % 22, t + k * 0.05, 22), bh = lf * H * 0.3;
      var gb = ctx.createLinearGradient(0, H, 0, H - bh); var hh = (wThemed ? hue0 + (k % 6) * 6 : k / NF * 360 + t * 20) % 360; gb.addColorStop(0, 'hsla(' + hh + ',100%,55%,0.65)'); gb.addColorStop(1, 'hsla(' + hh + ',100%,65%,0.05)');
      ctx.fillStyle = gb; ctx.fillRect(k * bw + bw * 0.12, H - bh, bw * 0.76, bh);
    }
    ctx.globalCompositeOperation = 'source-over';   // the 1UP logo, in a glowing circle at the heart of the tunnel
    if (wLogoOk) {
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, rl, 0, 6.2832); ctx.closePath(); ctx.clip(); ctx.drawImage(wLogo, cx - rl, cy - rl, rl * 2, rl * 2); ctx.restore();
    }
    ctx.shadowColor = 'hsl(' + hue0 + ',100%,70%)'; ctx.shadowBlur = M * 0.04 * (1 + pulse); ctx.lineWidth = Math.max(2, M * 0.007); ctx.strokeStyle = 'hsla(' + hue0 + ',100%,88%,0.95)';
    ctx.beginPath(); ctx.arc(cx, cy, rl, 0, 6.2832); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';   // the ship, seen from behind, banking gently
    var sx = cx + Math.sin(t * 0.8) * W * 0.05, sy = H * 0.66 + Math.sin(t * 1.3) * H * 0.012, s = M / 480 * wDpr / wDpr * 1, bank = Math.sin(t * 0.8) * 0.16;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(bank); ctx.scale(s * 1.15, s * 1.15);
    var fl = 26 + Math.random() * 14 + wSpeed * 22, fg = ctx.createLinearGradient(0, 24, 0, 24 + fl * 2); fg.addColorStop(0, 'rgba(255,255,255,.95)'); fg.addColorStop(0.3, 'hsla(' + ((hue0 + 160) % 360) + ',100%,62%,.8)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(-10, 24); ctx.lineTo(0, 24 + fl * 2); ctx.lineTo(10, 24); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(11, -10); ctx.lineTo(44, 20); ctx.lineTo(15, 16); ctx.lineTo(9, 28); ctx.lineTo(-9, 28); ctx.lineTo(-15, 16); ctx.lineTo(-44, 20); ctx.lineTo(-11, -10); ctx.closePath();
    var bg = ctx.createLinearGradient(-40, -40, 40, 30); bg.addColorStop(0, '#f3f6ff'); bg.addColorStop(1, '#6a77a6'); ctx.fillStyle = bg; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'hsla(' + hue0 + ',100%,75%,.9)'; ctx.stroke();
    ctx.fillStyle = 'hsl(' + ((hue0 + 160) % 360) + ',100%,60%)'; ctx.beginPath(); ctx.ellipse(0, -8, 5, 11, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'hsla(' + hue0 + ',100%,70%,.9)'; ctx.fillRect(-30, 18, 8, 3); ctx.fillRect(22, 18, 8, 3);
    ctx.restore();
  }
  function wormhole(on) {
    if (on) {
      wc = $('wh'); if (!wc) return; if (!wx) wx = wc.getContext('2d'); wormSize();
      if (!wLogo) { wLogo = new Image(); wLogo.onload = function () { wLogoOk = true; }; wLogo.src = 'assets/logo.png'; }
      if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { wLast = 0; wormFrame(1000); cancelAnimationFrame(wRaf); return; }
      if (!wRaf) wRaf = requestAnimationFrame(wormFrame);
    } else if (wRaf) { cancelAnimationFrame(wRaf); wRaf = 0; }
  }
  addEventListener('resize', function () { if (wRaf) wormSize(); });
  function applySkin(i) {
    skinI = ((i % SKINS.length) + SKINS.length) % SKINS.length;
    if (SKINS[skinI] === 'retro') document.documentElement.removeAttribute('data-skin'); else document.documentElement.setAttribute('data-skin', SKINS[skinI]);
    try { localStorage.setItem('up1-skin', String(skinI)); } catch (e) {}
    applyTheme(storedTheme());
    setBars(SKINS[skinI] === 'meters' ? 36 : 0);
    wormhole(SKINS[skinI] === 'wormhole');
    if ($('skinName')) $('skinName').textContent = SKIN_NAMES[skinI];
    fitBtns(); setTimeout(fitBtns, 250);
  }
  var START_SKIN = window.UP1_START_SKIN || 'nebula';   // for now every visit opens in Nebula (set to '' to remember each visitor's last skin again)
  if (START_SKIN) skinI = Math.max(0, SKINS.indexOf(START_SKIN)); else { try { skinI = +(localStorage.getItem('up1-skin') || 0) || 0; } catch (e) {} }
  applySkin(skinI);
  $('themeBtn').addEventListener('click', function () { var n = themeI + 1; if (n >= THEMES.length) n = (skinName() in NATIVE_OK) ? 0 : -1; applyTheme(n); });
  if ($('skinBtn')) $('skinBtn').addEventListener('click', function (e) {
    var dir = (e.target && e.target.closest && e.target.closest('.sk-b')) ? -1 : 1;
    if (window.UP1_OWN_SKINS) {      // Culture Shock has just its own three skins
      var own = window.UP1_OWN_SKINS, k = own.indexOf(SKINS[skinI]); k = k < 0 ? 0 : (k + dir + own.length) % own.length; applySkin(SKINS.indexOf(own[k]));
    } else applySkin(skinI + dir);
  });

  window.__up1 = { chimeNow: function (h) { chimeNow(h); }, get chimeOn() { return chimeOn; }, get chimeT() { return chime.currentTime; }, get chimeErr() { return chime.error && chime.error.code; }, get idx() { return idx; }, get curP() { return curP; }, get S() { return S; }, get badIds() { return badIds; }, replay: function () { playIdx(idx, Date.now() / 1000 - S.delay - S.plays[idx].t, 0); } };
  var selDay = null;
  function paintDays() {
    var keys = []; S.plays.forEach(function (p) { var k = dayKey(p.t); if (keys.indexOf(k) < 0) keys.push(k); });
    if (!selDay || keys.indexOf(selDay) < 0) selDay = keys[keys.length - 1];
    $('days').innerHTML = keys.map(function (k) { var d = new Date(k + 'T12:00:00Z'); return '<button data-k="' + k + '" class="' + (k === selDay ? 'on' : '') + '">' + d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) + '</button>'; }).join('');
    var list = S.plays.filter(function (p) { return dayKey(p.t) === selDay; });
    var curT = idx >= 0 && S.plays[idx] ? S.plays[idx].t : -1;
    $('daylist').innerHTML = list.map(function (p) { var a = split(p.title); return '<li class="' + (p.t === curT ? 'now' : '') + '"><time>' + fmtT(p.t) + '</time><span>' + esc(a[0] ? a[0] + ' — ' + a[1] : a[1]) + '</span>' + hb(p) + '</li>'; }).join('');
    $('tznote').textContent = 'Keep the volume up. Times are shown in your local time (' + new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() + ').';
  }
  $('days').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; selDay = b.dataset.k; paintDays(); });

  var nextTimer = null, badIds = {}, curAlt = 0, curP = null;
  // ---- dead-air filler: when a song ends and the next slot is still a few seconds away, play station-ID jingles that finish before the next song starts ----
  var JINGLES = [{"f": "assets/jingles/j6.mp3", "d": 3.5}, {"f": "assets/jingles/j3.mp3", "d": 6.11}, {"f": "assets/jingles/j5.mp3", "d": 4.95}, {"f": "assets/jingles/j7.mp3", "d": 8.14, "msg": "Try out our new features: tap SKIN to change the whole look, and THEME to change the colors."}, {"f": "assets/jingles/j8.mp3", "d": 7.72, "msg": "New: tap SKIN for a new look, tap THEME for new colors."}, {"f": "assets/jingles/j9.mp3", "d": 7.3}], jing = new Audio(), jingOn = false, jingUnlocked = false;
  jing.preload = 'auto';
  var hintWas = null;
  function showPromo(msg) { var h = $('hint'); if (!h) return; if (msg) { if (hintWas === null) hintWas = h.textContent; h.textContent = msg; h.classList.add('promo'); } else if (hintWas !== null) { h.textContent = hintWas; hintWas = null; h.classList.remove('promo'); } }
  function stopJingle() { showPromo(null); if (!jingOn) return; jingOn = false; try { jing.pause(); } catch (e) {} }
  function unlockJingle() {
    if (jingUnlocked || !JINGLES.length) return; jingUnlocked = true;
    try { jing.src = JINGLES[0].f; jing.muted = true; var pr = jing.play(); var done = function () { try { jing.pause(); jing.currentTime = 0; } catch (e) {} jing.muted = false; }; if (pr && pr.then) pr.then(done, function () { jing.muted = false; jingUnlocked = false; }); else done(); } catch (e) { jing.muted = false; }
  }
  function fillGap(wait, n) {
    if (!JINGLES.length || !gestured || chimeOn || jingOn || userPaused || wait < 3.4) return;
    var left = wait - 0.5, seed = (Math.imul(n + 0x9e3779b9, 0x85ebca6b) >>> 0), list = [], k = 0; seed ^= seed >>> 13; seed = (Math.imul(seed, 0xc2b2ae35) >>> 0); seed ^= seed >>> 16; seed = seed >>> 0;
    while (left >= 3.2 && k < 3) { var fit = JINGLES.filter(function (j) { return j.d <= left; }); if (!fit.length) break; var promos = fit.filter(function (j) { return j.msg; }), plain = fit.filter(function (j) { return !j.msg; }), pick = (k === 0 && promos.length && seed % 4 === 0) ? promos[(seed >>> 4) % promos.length] : (plain.length ? plain : fit)[((seed >>> 2) + k * 5) % (plain.length || fit.length)]; list.push(pick); left -= pick.d + 0.4; k++; }
    if (!list.length) return;
    jingOn = true; var i = 0;
    (function step() {
      if (!jingOn || i >= list.length) { jingOn = false; showPromo(null); return; }
      jing.onended = function () { if (jingOn) setTimeout(step, 300); }; jing.onerror = function () { jingOn = false; showPromo(null); };
      var cur = list[i++]; showPromo(cur.msg || null); jing.src = cur.f; jing.volume = jingVol(); var pr = jing.play(); if (pr && pr.catch) pr.catch(function () { jingOn = false; });
    })();
  }

  function clearNext() { if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; } }
  // If YouTube will not play a song here, EVERY listener swaps in the same replacement for that slot (picked from the schedule by a fixed rule), so everyone stays in step.
  function altIdx(i, n) { var lo = Math.max(0, i - 900), hi = Math.max(lo + 1, i - 40), len = hi - lo; return lo + ((((i * 2654435761 + n * 40503 + 7) % len) + len) % len); }
  function slotPlay(i, n) { return n === 0 ? S.plays[i] : S.plays[altIdx(i, n)]; }
  function playIdx(i, offset, n) {
    clearNext(); stopJingle();
    if (!S.plays.length) return;
    if (i >= S.plays.length) { i = Math.max(0, S.plays.length - 40 + Math.floor(Math.random() * 30)); offset = 0; n = 0; }   // out of schedule: loop back over recent music
    n = n || 0; var p = slotPlay(i, n);
    while (n < 8 && badIds[p.id]) { n++; p = slotPlay(i, n); }
    idx = i; curAlt = n; curP = p; offset = Math.max(0, Math.floor(offset || 0));
    paintNP();
    if (offset > p.dur - 5 && i + 1 < S.plays.length) { next(); return; }       // this song is basically over: wait for the next slot
    yt.loadVideoById({ videoId: p.id, startSeconds: offset });
  }
  // after a song ends, the next one starts exactly when the schedule says it begins (never early), so every listener hears the same thing
  function next() {
    if (!started) return;
    var n = idx + 1;
    if (n >= S.plays.length) { playIdx(n, 0); return; }
    var wait = (S.plays[n].t + S.delay) - Date.now() / 1000;
    clearNext();
    if (wait > 3.4) fillGap(wait, n);
    if (wait > 1) nextTimer = setTimeout(function () { nextTimer = null; stopJingle(); if (!userPaused) playIdx(n, 0); }, wait * 1000);
    else if (!userPaused) playIdx(n, Math.max(0, -wait));
  }
  function setOn(on) {
    playing = on; $('play').classList.toggle('on', on); $('eq').classList.toggle('on', on); $('onair').classList.toggle('on', on);
    $('onairtxt').textContent = on ? 'ON AIR' : (started ? 'PAUSED' : 'OFF AIR'); $('play').setAttribute('aria-label', on ? 'Pause 1UP Radio' : 'Play 1UP Radio'); paintNP();
  }
  // volume: the YouTube player, the station jingles and the hourly chime all follow the one slider. The player's level is re-applied every time a song starts or resumes
  // (and eased in), because the embedded player can come back at a different level after a pause, a seek or a new video.
  function volNow() { return Math.max(0, Math.min(100, +$('vol').value || 0)); }
  function jingVol() { return Math.max(0.04, volNow() / 100); }
  var fadeT = null;
  function applyVol(fade) {
    if (!yt || !ready || IOS) return;   // iPhones ignore setVolume: the phone's own buttons set the level there
    clearInterval(fadeT); var to = volNow();
    try {
      if (!fade || to < 8) { yt.setVolume(to); return; }
      var from = Math.round(to * 0.25), n = 0; yt.setVolume(from);
      fadeT = setInterval(function () { n++; try { yt.setVolume(Math.round(from + (to - from) * n / 8)); } catch (e) {} if (n >= 8) clearInterval(fadeT); }, 90);
    } catch (e) {}
  }
  function init() {
    yt = new YT.Player('ytp', { width: 200, height: 200, host: 'https://www.youtube-nocookie.com', playerVars: { playsinline: 1, rel: 0, controls: 0, disablekb: 1, origin: location.origin }, events: {
      onReady: function () { ready = true; yt.setVolume(+$('vol').value); if (started) playIdx(findNow(), (Date.now() / 1000 - S.delay) - S.plays[findNow()].t); if (gestured) { try { yt.unMute(); } catch (e) {} } },
      onStateChange: function (e) { var st = YT.PlayerState; if (e.data === st.PLAYING) { if (userPaused) { try { yt.pauseVideo(); } catch (x) {} return; } errs = 0; setOn(true); if (!chimeOn) applyVol(true); } else if (e.data === st.PAUSED) setOn(false); else if (e.data === st.ENDED) next(); },
      onError: function () { if (curP) badIds[curP.id] = 1; if (++errs < 8) playIdx(idx, Date.now() / 1000 - S.delay - S.plays[idx].t, curAlt + 1); else { setOn(false); $('hint').textContent = 'Having trouble reaching the music. Please try again in a minute.'; } } } });
  }
  var unmutedAt = 0, gestured = false, lastKick = 0, apiTag = null;
  function loadApi() { if (apiTag || (window.YT && YT.Player)) return; apiTag = document.createElement('script'); apiTag.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(apiTag); }
  window.onYouTubeIframeAPIReady = function () { if (!yt) init(); };   // build the player BEFORE the first tap, so the tap itself can start it (in-app browsers like Instagram's only allow playback begun directly inside a tap)
  loadApi();
  $('play').addEventListener('click', function () {
    if (Date.now() - unmutedAt < 700) return;
    if (!S.plays.length) return;
    if (!started) {
      started = true; $('hint').innerHTML = LIVE_HTML; $('npTitle').textContent = 'Tuning in…';
      if (window.YT && YT.Player) { if (!yt) init(); else if (ready) { var k = findNow(); playIdx(k, Date.now() / 1000 - S.delay - S.plays[k].t); } }   // not ready yet: onReady starts it
      else { window.onYouTubeIframeAPIReady = function () { if (!yt) init(); }; loadApi(); }
      return;
    }
    if (!ready) return;
    var eff = (btnIntent !== null && Date.now() - btnAt < 2500) ? btnIntent : playing;      // what the button shows right now, even if YouTube has not reported it yet
    btnAt = Date.now();
    if (eff) { btnIntent = false; userPaused = true; try { yt.pauseVideo(); } catch (x) {} setOn(false); }
    else { btnIntent = true; userPaused = false; try { yt.playVideo(); } catch (x) {} }
  });
  $('vol').addEventListener('input', function (e) { $('volv').textContent = e.target.value; if (yt && ready) yt.setVolume(+e.target.value); if (jingOn) jing.volume = jingVol(); try { localStorage.setItem('up1-vol', e.target.value); } catch (x) {} });
  try { var v = localStorage.getItem('up1-vol'); if (v) { $('vol').value = v; $('volv').textContent = v; } } catch (x) {}
  // keep exactly in step with the live schedule: after a pause, a stall or a schedule change, jump back to the live position
  var lastSync = 0;
  setInterval(function () {
    if (!started || !playing || !yt || !ready || idx < 0 || !S.plays[idx] || nextTimer || Date.now() - lastSync < 20000) return;
    try {
      var now = Date.now() / 1000 - S.delay, k = findNow();
      if (k !== idx) { lastSync = Date.now(); playIdx(k, now - S.plays[k].t); return; }          // wrong song for this moment: jump to what is on air
      var expected = now - S.plays[idx].t, cur = yt.getCurrentTime(), dur = yt.getDuration();
      if (dur && expected < dur - 5 && Math.abs(cur - expected) > 20) { lastSync = Date.now(); yt.seekTo(expected, true); }   // paused or stalled: catch up to live
    } catch (x) {}
  }, 6000);
  setInterval(function () { if (!playing || !yt || !ready) return; try { var d = yt.getDuration(), c = yt.getCurrentTime(); if (d) $('npFill').style.width = Math.min(100, c / d * 100) + '%'; } catch (x) {} }, 500);

  // ---- hourly station ID: church bell, "The time is now ...", "One Up Radio. Keep the volume up." on the listener's local hour ----
  var chime = new Audio(), chimeOn = false, chimeUnlocked = false, chimeHour = -1, chimeKey = '', IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  chime.preload = 'auto';
  function chimeSrc(h) { return 'assets/chimes/chime-' + (h % 12 || 12) + '.mp3?v=5'; }   // 12 clips: a small ding, "The time is N o'clock.", "One Up Radio."
  function chimePrep(h) { if (chimeHour !== h) { chimeHour = h; chime.src = chimeSrc(h); try { chime.load(); } catch (e) {} } }
  function unlockChime() {            // phones only let a sound play later if one was started inside a real tap: start it silently once
    if (chimeUnlocked) return; chimeUnlocked = true;
    try { chimePrep((new Date().getHours() + 1) % 24); chime.muted = true; var pr = chime.play(); var done = function () { try { chime.pause(); chime.currentTime = 0; } catch (e) {} chime.muted = false; }; if (pr && pr.then) pr.then(done, function () { chime.muted = false; chimeUnlocked = false; }); else done(); } catch (e) { chime.muted = false; }
  }
  function chimeEnd() {
    if (!chimeOn) return; chimeOn = false;
    try { if (IOS) { if (!userPaused) { var k = findNow(); playIdx(k, Date.now() / 1000 - S.delay - S.plays[k].t); } } else applyVol(true); } catch (e) {}
  }
  function chimeNow(h) {
    if (chimeOn || !started || !playing || userPaused || !yt || !ready) return;
    chimeOn = true; chimePrep(h); chime.muted = false; chime.currentTime = 0; chime.volume = 0.55 * Math.max(0.15, volNow() / 100);
    try { if (IOS) yt.pauseVideo(); else yt.setVolume(Math.max(6, Math.round(+$('vol').value * 0.12))); } catch (e) {}
    var pr = chime.play(); if (pr && pr.catch) pr.catch(chimeEnd);
    setTimeout(chimeEnd, 16000);
  }
  chime.addEventListener('ended', chimeEnd); chime.addEventListener('error', chimeEnd);
  setInterval(function () {
    var d = new Date(), h = d.getHours();
    if (d.getMinutes() === 59 && d.getSeconds() > 30) chimePrep((h + 1) % 24);
    if (d.getMinutes() === 0 && d.getSeconds() < 4) { var key = d.toDateString() + h; if (key !== chimeKey) { chimeKey = key; chimeNow(h); } }
  }, 500);

  // ---- phone lock screen / background: Media Session (title, artwork, play/pause buttons) + a silent looping sound that keeps the page's audio session alive, and a jump back to live whenever the phone wakes the page up ----
  var userPaused = false, keep = new Audio('assets/silence.mp3'); keep.loop = true; keep.setAttribute('playsinline', '');
  var btnIntent = null, btnAt = 0;   // see the play button's click handler
  function keepSync() { try { if (started && gestured && !userPaused) { var pr = keep.play(); if (pr && pr.catch) pr.catch(function () {}); } else keep.pause(); } catch (e) {} }
  function goLive() { if (!started || !ready || !S.plays.length) return; userPaused = false; btnIntent = null; try { var k = findNow(); playIdx(k, Date.now() / 1000 - S.delay - S.plays[k].t); } catch (e) {} keepSync(); }
  var MS = 'mediaSession' in navigator ? navigator.mediaSession : null;
  function ART_FOR(p) {   // lock-screen picture: the song's cover when we have one, else its YouTube picture, else the logo
    var list = []; try { if (ART && ART[p.id]) list.push({ src: ART[p.id], sizes: '600x600' }); } catch (e) {}
    if (p.id) list.push({ src: 'https://i.ytimg.com/vi/' + encodeURIComponent(p.id) + '/hqdefault.jpg', sizes: '480x360', type: 'image/jpeg' });
    list.push({ src: location.origin + '/assets/icon-512.png', sizes: '512x512', type: 'image/png' }); return list;
  }
  function msMeta() {
    if (!MS || typeof MediaMetadata === 'undefined') return; var p = curP || S.plays[idx]; if (!p) return; var a = split(p.title);
    try { MS.metadata = new MediaMetadata({ title: a[1] || p.title, artist: a[0] || '1UP Radio', album: '1UP Radio · Keep the volume up', artwork: ART_FOR(p) }); MS.playbackState = playing ? 'playing' : 'paused'; } catch (e) {}
  }
  if (MS) {
    try { MS.setActionHandler('play', function () { if (!started) { $('play').click(); return; } goLive(); }); } catch (e) {}
    try { MS.setActionHandler('pause', function () { userPaused = true; btnIntent = false; try { yt.pauseVideo(); } catch (e) {} keepSync(); }); } catch (e) {}
    try { MS.setActionHandler('stop', function () { userPaused = true; btnIntent = false; try { yt.pauseVideo(); } catch (e) {} keepSync(); }); } catch (e) {}
    try { MS.setActionHandler('nexttrack', null); MS.setActionHandler('previoustrack', null); } catch (e) {}
  }
  setInterval(function () { msMeta(); keepSync(); }, 2000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && started && !playing && !userPaused && !chimeOn) goLive(); });
  addEventListener('pageshow', function () { if (started && !playing && !userPaused && !chimeOn) goLive(); });

  // open playing: start on load; browsers block sound before the first tap, so fall back to silent autoplay and unmute on the first touch
  var mutedAuto = false;
  function unmuteNow(ev) {
    var t = ev && ev.type, tap = !!(ev && ev.isTrusted) && (t === 'click' || t === 'touchend' || t === 'pointerup' || t === 'keydown');
    if (ev && ev.isTrusted) gestured = true;
    if (tap) { unlockChime(); unlockJingle(); if (typeof keepSync === 'function') keepSync(); }
    if (tap && yt && ready) {                                   // phones only allow sound inside a real tap: unmute / (re)start right here, in the tap
      try { if (yt.isMuted()) { yt.unMute(); yt.setVolume(+$('vol').value); } } catch (e) {}
      if (started && !playing && !userPaused && Date.now() - lastKick > 1500) { lastKick = Date.now(); try { yt.unMute(); var k = findNow(); playIdx(k, Date.now() / 1000 - S.delay - S.plays[k].t); } catch (e) {} }
    }
    if (!mutedAuto) { if (started && ready && !playing && !tap && !userPaused) { try { yt.playVideo(); } catch (e) {} } return; }
    mutedAuto = false; unmutedAt = Date.now(); try { yt.unMute(); yt.setVolume(+$('vol').value); if (yt.getPlayerState() !== 1) yt.playVideo(); } catch (e) {} $('hint').innerHTML = LIVE_HTML;
  }
  ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'keydown'].forEach(function (ev) { addEventListener(ev, unmuteNow, { passive: true, capture: true }); });
  load().then(function () {
    var k = findNow(); idx = -1; paintLists();
    function begin() {   // nothing plays until the TAP TO START gate has been tapped; then start right inside that tap
      $('play').click();
      [3500, 8000].forEach(function (ms) {
        setTimeout(function () {
          if (playing || mutedAuto || !yt || !ready) return; if (gestured) { try { yt.unMute(); yt.playVideo(); } catch (e) {} return; }
          try { yt.mute(); yt.playVideo(); mutedAuto = true; $('hint').textContent = 'Tap anywhere to turn the sound on.'; } catch (e) {}
        }, ms);
      });
    }
    if (document.getElementById('tapgate')) window.addEventListener('up1-start', begin, { once: true }); else begin();
  });
  setInterval(load, 3 * 60 * 1000);
  // ---- the station picker / the browser's Back button change station right here, without reloading: the music carries on ----
  window.UP1_SWITCH = function (st) {
    var wasPlaying = playing;
    clearNext(); stopJingle(); selDay = null; curP = null; idx = -1; S = { plays: [], delay: 0 };
    loadArt();
    try { applySkin(Math.max(0, SKINS.indexOf(window.UP1_START_SKIN || 'nebula'))); } catch (e) {}
    return load().then(function () {
      if (!S.plays.length) return;
      var k = findNow();
      if (started && ready && wasPlaying) { userPaused = false; playIdx(k, Date.now() / 1000 - S.delay - S.plays[k].t); }
      else { idx = k; curP = S.plays[k]; paintNP(); paintLists(); }
    });
  };
})();

;(function(){var g=document.getElementById("tapgate");if(!g)return;function go(e){if(!g||!e.isTrusted)return;if(e.type==="click"){e.preventDefault();e.stopPropagation()}g.remove();g=null;window.dispatchEvent(new Event("up1-start"))}window.addEventListener("click",go,true);window.addEventListener("keydown",go,true)})();


;(function(){   // one-time pop-up: "try our new skins and themes", pointing at the buttons
  var KEY = 'up1-tip-skins', tip = document.getElementById('tip'), tb = document.getElementById('themeBtn'), sb = document.getElementById('skinBtn'), timer = 0;
  if (!tip || !tb || !sb) return;
  try { if (localStorage.getItem(KEY) === '1') return; } catch (e) {}
  function place() {
    var a = tb.getBoundingClientRect(), b = sb.getBoundingClientRect(); if (!a.width && !b.width) { hide(); return; }
    tip.style.top = (Math.max(a.bottom, b.bottom) + 18) + 'px';
    var c1 = a.width ? a.left + a.width / 2 : b.left + b.width / 2, c2 = b.width ? b.left + b.width / 2 : c1, w = tip.offsetWidth, left = Math.min(Math.max(8, (c1 + c2) / 2 - w / 2), innerWidth - w - 8);
    tip.style.left = left + 'px'; document.getElementById('tipa1').style.left = (c1 - left - 9) + 'px'; document.getElementById('tipa2').style.left = (c2 - left - 9) + 'px';
    document.getElementById('tipa2').style.display = (a.width && b.width) ? '' : 'none';
  }
  function hide() { clearTimeout(timer); tip.hidden = true; tb.classList.remove('pulse'); sb.classList.remove('pulse'); removeEventListener('resize', place); try { localStorage.setItem(KEY, '1'); } catch (e) {} }
  function show() { tip.hidden = false; place(); tb.classList.add('pulse'); sb.classList.add('pulse'); addEventListener('resize', place); timer = setTimeout(hide, 16000); }
  document.getElementById('tipx').addEventListener('click', hide);
  tb.addEventListener('click', hide, true); sb.addEventListener('click', hide, true);
  addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
  var iv = setInterval(function () { if (document.getElementById('tapgate')) return; clearInterval(iv); setTimeout(show, 1400); }, 400);
})();

;(function(){var d=document.querySelector("#gclock .gd"),zs=document.querySelectorAll("#gclock .gt");if(!d||!zs.length)return;function tick(){var n=new Date();d.textContent=n.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"}).toUpperCase();zs.forEach(function(e){e.textContent=n.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",second:"2-digit"})})}tick();var iv=setInterval(function(){if(!document.getElementById("gclock"))return clearInterval(iv);tick()},1000)})();

// Nebula meter bars: thin bars that run across the whole player (the other skins use 12 wide bars)
(function () {
  var fit = function () { var e = document.getElementById('eq'); if (!e) return; var n = ['nebula', 'culture', 'shock', 'dubby', 'house'].indexOf(document.documentElement.getAttribute('data-skin')) >= 0 ? 44 : 12; while (e.children.length < n) e.appendChild(document.createElement('i')); while (e.children.length > n) e.removeChild(e.lastChild); };
  var go = function () { fit(); new MutationObserver(fit).observe(document.documentElement, { attributes: true, attributeFilter: ['data-skin'] }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
