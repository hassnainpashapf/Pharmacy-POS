/* ==========================================================================
   MedSync flagship animation layer — phone mockup + demo modal (mxp-*)
   --------------------------------------------------------------------------
   Progressive enhancement only. Every block is existence-guarded, so this
   file is safe to load whether or not the phone mockup is on the page.
   Existing interactive logic (dose toggles, updateRing, modal open/close,
   validation, focus handling) is never replaced or unbound.
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;

  function onReady(fn) {
    if (document.readyState !== 'loading') { fn(); }
    else { document.addEventListener('DOMContentLoaded', fn); }
  }

  /* ---------------- 1. Phone 3D tilt (lerp-smoothed) + glare ---------------- */
  function initTilt() {
    var phone = document.querySelector('.phone');
    if (!phone || !finePointer || reduceMotion) { return; }
    if (phone.hasAttribute('data-mxp-tilt')) { return; } // idempotent
    phone.setAttribute('data-mxp-tilt', '1');

    var stage = phone.parentElement; // .phone-float wrapper
    if (stage) { stage.classList.add('mxp-tilt-stage'); }
    phone.classList.add('mxp-tilt-on');

    var glare = document.createElement('div');
    glare.className = 'mxp-glare';
    glare.setAttribute('aria-hidden', 'true');
    phone.appendChild(glare);

    var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;

    function frame() {
      cx += (tx - cx) * 0.14;
      cy += (ty - cy) * 0.14;
      var settled = Math.abs(tx - cx) < 0.0008 && Math.abs(ty - cy) < 0.0008;
      if (settled) {
        if (tx === 0 && ty === 0) { cx = 0; cy = 0; phone.style.transform = ''; }
        raf = null; // hold last transform; kick() restarts on next pointer event
        return;
      }
      phone.style.transform =
        'rotateY(' + (cx * 12).toFixed(2) + 'deg)' +
        ' rotateX(' + (-cy * 10).toFixed(2) + 'deg)';
      glare.style.setProperty('--mxp-gx', (50 + cx * 70).toFixed(1) + '%');
      glare.style.setProperty('--mxp-gy', (32 + cy * 70).toFixed(1) + '%');
      raf = requestAnimationFrame(frame);
    }
    function kick() { if (raf === null) { raf = requestAnimationFrame(frame); } }

    var zone = stage || phone;
    zone.addEventListener('mousemove', function (e) {
      var r = phone.getBoundingClientRect();
      if (r.width === 0) { return; }
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      kick();
    });
    zone.addEventListener('mouseleave', function () {
      tx = 0; ty = 0;
      kick();
    });
  }

  /* ---------------- 2. Reminder banner progress line ---------------- */
  function initNotifBar() {
    var notif = document.querySelector('.phone-notif');
    if (!notif || notif.querySelector('.mxp-notif-bar')) { return; }
    var bar = document.createElement('div');
    bar.className = 'mxp-notif-bar';
    bar.setAttribute('aria-hidden', 'true');
    var fill = document.createElement('div');
    fill.className = 'mxp-notif-bar-fill';
    bar.appendChild(fill);
    notif.appendChild(bar);
  }

  /* ---------------- 3. Adherence ring: bump + glow + count-up ---------------- */
  function initRingFx() {
    var ringFg = document.getElementById('ringFg');
    var ringSvg = document.querySelector('.ring');
    if (!ringFg || !ringSvg) { return; }
    var ringText = ringFg.nextElementSibling; // the <text> with "60%"
    var wrap = ringSvg.closest('.ring-wrap');
    var glowTimer = null;
    var counting = false;
    var shown = ringText ? (parseInt(ringText.textContent, 10) || 0) : 0;

    // updateRing() writes style.strokeDashoffset -> bump + glow, never touching logic
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        if (muts[i].attributeName !== 'style') { continue; }
        if (reduceMotion) { return; }
        ringSvg.classList.remove('mxp-ring-bump');
        void ringSvg.getBoundingClientRect(); // restart the keyframes
        ringSvg.classList.add('mxp-ring-bump');
        if (wrap) {
          wrap.classList.add('mxp-ring-glow');
          clearTimeout(glowTimer);
          glowTimer = setTimeout(function () { wrap.classList.remove('mxp-ring-glow'); }, 700);
        }
      }
    }).observe(ringFg, { attributes: true, attributeFilter: ['style'] });

    // count the % label up/down instead of jumping
    if (ringText) {
      new MutationObserver(function () {
        if (counting) { return; }
        var target = parseInt(ringText.textContent, 10);
        if (isNaN(target) || target === shown) {
          if (!isNaN(target)) { shown = target; }
          return;
        }
        if (reduceMotion) { shown = target; return; }
        counting = true;
        var from = shown, t0 = null, dur = 650;
        function step(ts) {
          if (t0 === null) { t0 = ts; }
          var p = Math.min(1, (ts - t0) / dur);
          var e = 1 - Math.pow(1 - p, 3);
          ringText.textContent = Math.round(from + (target - from) * e) + '%';
          if (p < 1) { requestAnimationFrame(step); }
          else {
            ringText.textContent = target + '%';
            shown = target;
            // let the final write's mutation flush while guarded, then release
            requestAnimationFrame(function () { counting = false; });
          }
        }
        requestAnimationFrame(step);
      }).observe(ringText, { childList: true, characterData: true, subtree: true });
    }
  }

  /* ---------------- 4. Dose checkbox: scale pop + tick draw ---------------- */
  function initDoseFx() {
    var meds = document.querySelectorAll('#medList .med');
    if (!meds.length) { return; }
    Array.prototype.forEach.call(meds, function (m) {
      // registered after the page's own toggle handler; runs after it
      m.addEventListener('click', function () {
        if (reduceMotion) { return; }
        var box = m.querySelector('.box');
        if (!box) { return; }
        // read final toggled state on the next frame
        requestAnimationFrame(function () {
          if (!m.classList.contains('done')) { return; } // only on check, not uncheck
          box.classList.remove('mxp-pop');
          void box.offsetWidth; // restart the keyframes
          box.classList.add('mxp-pop');
        });
      });
      // the tick path's own animationend bubbles; only react to the box pop
      m.addEventListener('animationend', function (e) {
        var box = m.querySelector('.box');
        if (box && e.target === box && e.animationName === 'mxp-pop') {
          box.classList.remove('mxp-pop');
        }
      });
    });
  }

  /* ---------------- 5. Demo modal: spring entrance + success fx ---------------- */
  function initModalFx() {
    var modal = document.getElementById('rxDemoModal');
    if (modal) { modal.classList.add('mxp-modal'); } // enables blur-fade + spring CSS

    var success = document.getElementById('rxDemoSuccess');
    if (!success) { return; }
    var big = success.querySelector('.rx-big');
    var fired = false;

    function burst(el) {
      el.classList.add('mxp-confetti-stage');
      var colors = ['#2E6BF0', '#0EA5A4', '#F59E0B', '#EC4899', '#34D399', '#8B5CF6'];
      for (var i = 0; i < 12; i++) {
        (function (idx) {
          var s = document.createElement('span');
          s.className = 'mxp-confetti';
          s.setAttribute('aria-hidden', 'true');
          var ang = (idx / 12) * Math.PI * 2 + Math.random() * 0.5;
          var dist = 46 + Math.random() * 44;
          s.style.setProperty('--mxp-cx', (Math.cos(ang) * dist).toFixed(1) + 'px');
          s.style.setProperty('--mxp-cy', (Math.sin(ang) * dist).toFixed(1) + 'px');
          s.style.background = colors[idx % colors.length];
          s.style.animationDelay = (Math.random() * 0.12).toFixed(2) + 's';
          s.addEventListener('animationend', function () { s.remove(); });
          el.appendChild(s);
          requestAnimationFrame(function () { s.classList.add('mxp-burst'); });
        })(i);
      }
    }

    // success panel is shown via style.display='block' by the page's own submit
    // handler — react to it, never replace it
    new MutationObserver(function () {
      var visible = success.style.display !== 'none' &&
        window.getComputedStyle(success).display !== 'none';
      if (visible && !fired) {
        fired = true;
        if (!reduceMotion && big) {
          big.classList.add('mxp-go'); // pop + tick draw (CSS)
          burst(big);                  // confetti-lite
        }
      } else if (!visible && fired) {
        fired = false;
        if (big) { big.classList.remove('mxp-go'); }
      }
    }).observe(success, { attributes: true, attributeFilter: ['style'] });
  }

  onReady(function () {
    initTilt();
    initNotifBar();
    initRingFx();
    initDoseFx();
    initModalFx();
  });
})();
