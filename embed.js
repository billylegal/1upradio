(function () {
  var $ = function (id) { return document.getElementById(id); };
  var STS = [['1up', 'Original'], ['cultureshock', 'Culture Shock'], ['vault', 'The Vault'], ['movement', 'The Movement']];
  var SIZES = [['Small', 360, 190], ['Medium', 420, 215], ['Wide', 520, 215]];
  var st = '1up', sz = 0, base = location.origin + location.pathname.replace(/embed\.html$/, '');
  function url() { return base + 'player.html?station=' + st; }
  function paint() {
    $('pills').innerHTML = STS.map(function (s) { return '<button type="button" data-k="' + s[0] + '"' + (s[0] === st ? ' class="on"' : '') + '>' + s[1] + '</button>'; }).join('');
    $('sizes').innerHTML = SIZES.map(function (s, i) { return '<button type="button" data-i="' + i + '"' + (i === sz ? ' class="on"' : '') + '>' + s[0] + '</button>'; }).join('');
    var w = SIZES[sz][1], h = SIZES[sz][2];
    $('pv').width = w; $('pv').height = h; $('pv').src = 'player.html?station=' + st;
    $('code').value = '<iframe src="' + url() + '" width="' + w + '" height="' + h + '" style="border:0;border-radius:14px;max-width:100%" allow="autoplay; encrypted-media" title="1UP Radio"></iframe>';
    $('lnk').href = url(); $('lnk').textContent = url();
  }
  $('pills').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { st = b.dataset.k; paint(); } });
  $('sizes').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { sz = +b.dataset.i; paint(); } });
  $('cp').addEventListener('click', function () {
    var t = $('code'); t.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    if (!ok && navigator.clipboard) navigator.clipboard.writeText(t.value); $('cp').textContent = '✓ COPIED'; setTimeout(function () { $('cp').textContent = 'COPY CODE'; }, 1500);
  });
  paint();
})();
