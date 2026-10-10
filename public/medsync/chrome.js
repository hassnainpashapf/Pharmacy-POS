/* Shared page chrome for the public Optix MedSync pages: menu, scroll progress, back to top, counters, card spotlight, reveal. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  root.className += ' js';

  /* menu */
  var links = $('links'), burger = $('burger');
  function closeMenu() { if (!links) return; links.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }
  if (burger && links) {
    burger.addEventListener('click', function () { var o = links.classList.toggle('open'); burger.setAttribute('aria-expanded', String(o)); });
    links.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }

  /* scroll progress, sticky shadow, back to top */
  var nav = $('nav'), prog = $('progress'), totop = $('totop');
  function onScroll() {
    var h = document.documentElement, max = h.scrollHeight - h.clientHeight;
    if (prog) prog.style.width = (max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0) + '%';
    if (nav) nav.classList.toggle('stuck', h.scrollTop > 8);
    if (totop) totop.classList.toggle('show', h.scrollTop > 700);
  }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  if (totop) totop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches, hasIO = 'IntersectionObserver' in window;

  /* reveal on scroll */
  var rv = document.querySelectorAll('.rv:not(.in)');
  if (calm || !hasIO) rv.forEach(function (e) { e.classList.add('in'); });
  else {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    rv.forEach(function (e) { io.observe(e); });
  }

  /* count-up numbers */
  var items = document.querySelectorAll('[data-count]');
  if (items.length && !calm && hasIO) {
    var co = new IntersectionObserver(function (es) { es.forEach(function (e) {
      if (!e.isIntersecting) return; co.unobserve(e.target);
      var el = e.target, to = +el.dataset.count || 0, t0 = performance.now();
      (function tick(t) { var k = Math.min(1, (t - t0) / 900); el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(tick); })(t0);
    }); }, { threshold: 0.6 });
    items.forEach(function (i) { co.observe(i); });
  }

  /* a soft light follows the pointer on cards */
  document.addEventListener('pointermove', function (e) {
    var c = e.target.closest && e.target.closest('.spot'); if (!c) return;
    var r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  /* portal links (#/login, #/pos) must change the hash of the app window, not of this page when it sits in the app's iframe */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a'); var h = a && a.getAttribute('href');
    if (h && h.indexOf('#/') === 0) { e.preventDefault(); var hash = h.slice(1); try { (window.top || window).location.hash = hash; } catch (er) { window.location.hash = hash; } }
  });
})();
