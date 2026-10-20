/* Phones: swipe right = next skin, swipe left = next theme colour. A one-time popup shows how; the THEME and SKIN buttons are hidden on phones. */
(function () {
  var Q = location.search, FORCE = /[?&]swipe=1/.test(Q);
  var touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  var small = window.matchMedia && matchMedia('(max-width:900px)').matches;
  if (!(FORCE || (touch && small))) return;
  var root = document.documentElement; root.classList.add('swipe-on');
  var $ = function (id) { return document.getElementById(id); };
  var toast, toastT;
  function say(html) {
    if (!toast) { toast = document.createElement('div'); toast.id = 'swtoast'; toast.setAttribute('role', 'status'); document.body.appendChild(toast); }
    toast.innerHTML = html; toast.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { toast.classList.remove('on'); }, 1400);
  }
  function skinNow() { var n = $('skinName'); return n ? n.textContent : ''; }
  function act(dir) {
    if (dir > 0) { var b = $('skinBtn'); if (b) { b.click(); setTimeout(function () { say('SKIN · <b>' + skinNow() + '</b> <i>→</i>'); }, 40); } }
    else { var t = $('themeBtn'); if (t) { t.click(); setTimeout(function () { var c = getComputedStyle(root).getPropertyValue('--g').trim() || '#fff'; say('<i>←</i> THEME <span class="swdot" style="background:' + c + '"></span>'); }, 40); } }
  }
  var x0 = 0, y0 = 0, t0 = 0, ok = false;
  function bad(el) { return el && el.closest && el.closest('input,button,a,textarea,select,#stations,#artzoom,#swtip,.slyr,.stbox'); }
  document.addEventListener('touchstart', function (e) { if (e.touches.length !== 1 || bad(e.target)) { ok = false; return; } var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); ok = true; }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (!ok) return; ok = false; var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    if (Date.now() - t0 > 700 || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.55) return;
    act(dx > 0 ? 1 : -1);
  }, { passive: true });
  if (FORCE) {   // preview on a computer: drag with the mouse like a thumb
    var mx = 0, my = 0, mt = 0, md = false;
    document.addEventListener('mousedown', function (e) { if (bad(e.target)) { md = false; return; } mx = e.clientX; my = e.clientY; mt = Date.now(); md = true; });
    document.addEventListener('mouseup', function (e) { if (!md) return; md = false; var dx = e.clientX - mx, dy = e.clientY - my; if (Date.now() - mt > 900 || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.55) return; act(dx > 0 ? 1 : -1); });
  }
  // how-to popup, once (after the start screen is gone)
  var SEEN = 'up1-swipe-tip';
  function seen() { try { return localStorage.getItem(SEEN) === '1'; } catch (e) { return false; } }
  function tip() {
    if ($('swtip')) return;
    var d = document.createElement('div'); d.id = 'swtip'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'How to change the look');
    d.innerHTML = '<div class="swbox"><h3>CHANGE THE LOOK</h3><p>Swipe with your thumb anywhere on the page.</p>' +
      '<div class="swrow"><div class="swhand r"><span>☝</span></div><div><b>Swipe right</b><small>next SKIN</small></div></div>' +
      '<div class="swrow"><div class="swhand l"><span>☝</span></div><div><b>Swipe left</b><small>next THEME colour</small></div></div>' +
      '<button type="button" id="swok">GOT IT</button></div>';
    document.body.appendChild(d);
    function close() { d.remove(); try { localStorage.setItem(SEEN, '1'); } catch (e) {} }
    $('swok').addEventListener('click', close); d.addEventListener('click', function (e) { if (e.target === d) close(); });
  }
  function maybeTip() { if (!FORCE && seen()) return; if (/[?&]swipetip=0/.test(Q)) return; var n = 0, iv = setInterval(function () { if (!$('tapgate') || ++n > 40) { clearInterval(iv); setTimeout(tip, 1200); } }, 300); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maybeTip); else maybeTip();
})();
