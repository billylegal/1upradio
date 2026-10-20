/* Station picker: tap the 1UP logo to choose a station. Runs before app.js and tells it which schedule file to follow. */
(function () {
  var ST = [
    { id: '1up', name: '1UP Radio', sub: 'The main station: deep house, melodic, electronic, all day', sched: 'schedule.json', art: 'assets/logo.png', tag: 'Keep the volume up' },
    { id: 'cultureshock', name: 'Culture Shock', sub: 'Roots reggae and dub, straight from the Crucial Brew channel', sched: 'schedule-culture.json', art: 'assets/cultureshock.svg', tag: 'Roots · reggae · dub' },
    { id: 'movement', name: 'The Movement', sub: 'Hand-selected house and Afro tracks', soon: 1, art: 'assets/logo.png' },
    { id: 'trap', name: 'Trap', sub: 'Heavy 808s and hard-hitting trap', soon: 1, art: 'assets/logo.png' }
  ];
  var KEY = 'up1-station', cur = ST[0], m;
  try { m = /[?&]station=([a-z0-9]+)/.exec(location.search); var want = m ? m[1] : localStorage.getItem(KEY); ST.forEach(function (s) { if (s.id === want && !s.soon) cur = s; }); } catch (e) {}
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
