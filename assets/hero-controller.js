/* hero-controller.js — scroll-driven cinematic hero.
   Pinning is handled by native CSS position:sticky (compositor-driven, so it
   cannot jank or jump). This file only maps scroll position -> build progress
   and updates the progress indicator. */
(function () {
  function boot() {
    var hero   = document.querySelector('.hero');
    var stage  = document.querySelector('.hero__stage');
    var canvas = document.getElementById('hero-gl');
    var copy   = document.querySelector('.hero__in');
    var pbar   = document.querySelector('.hero-prog__bar');
    var pnum   = document.querySelector('.hero-prog__num');
    var prog   = document.querySelector('.hero-prog');
    if (!hero || !stage || !canvas) return;

    function bail(msg) {
      if (window.console && console.warn) console.warn('hero:', msg);
      hero.style.height = 'auto';
      stage.style.position = 'relative';
      stage.style.height = '100svh';
      if (prog) prog.style.display = 'none';
      if (copy) { copy.style.opacity = 1; copy.style.transform = 'none'; }
    }
    if (!window.THREE || !window.VillaScene) { bail('scene unavailable'); return; }

    var scene;
    try { scene = window.VillaScene.create(canvas); }
    catch (e) { bail(e.message); return; }

    /* ---- tuning ---- */
    var BUILD_SPAN = 0.90;   // build completes at 90% of the track, then a short hold
    var ACCEL      = 1.22;   // >1 = construction accelerates as you scroll
    var COPY_MIN   = 0.95;   // wording holds its opacity for the whole duration
    var EASE       = 0.22;   // scrub smoothing: responsive, still silky

    var REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function cl(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function smooth(x) { return x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (x * 6 - 15) + 10); }

    /* ---- drawing-buffer sizing only. The canvas DISPLAY size is owned by CSS
       (absolute, inset:0, 100%/100%) — never set inline px here, or a bad
       measurement can lock the canvas to a wrong box permanently. ---- */
    var lastW = 0, lastH = 0;
    function resize(force) {
      var w = stage.clientWidth  || 0;
      var h = stage.clientHeight || 0;
      // sanity guard: if layout isn't settled, fall back to the viewport
      if (w < 40 || h < 40) { w = window.innerWidth; h = window.innerHeight; }
      w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
      if (!force && w === lastW && h === lastH) return false;
      lastW = w; lastH = h;
      // never let inline px sizing linger on the canvas — CSS owns display size
      if (canvas.style.width || canvas.style.height) {
        canvas.style.removeProperty('width');
        canvas.style.removeProperty('height');
      }
      scene.resize(w, h);
      return true;
    }

    function frac() {
      var track = hero.offsetHeight - window.innerHeight;
      if (track <= 0) return 0;
      return cl(-hero.getBoundingClientRect().top / track);
    }

    if (REDUCE) {
      resize(true);
      scene.render(1);
      if (prog) prog.style.display = 'none';
      window.addEventListener('resize', function () { resize(true); scene.render(1); });
      return;
    }

    var target = 0, shown = -1, dirty = true;
    function onScroll() { target = frac(); dirty = true; }
    document.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { resize(true); onScroll(); });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { resize(true); onScroll(); }, 140);
    });
    if ('ResizeObserver' in window) {
      try { new ResizeObserver(function () { if (resize()) dirty = true; }).observe(stage); } catch (e) {}
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { resize(true); dirty = true; });
    }

    resize(true); onScroll();
    setTimeout(function () { resize(true); onScroll(); }, 140);
    setTimeout(function () { resize(true); onScroll(); }, 520);

    // don't burn frames while the hero is off-screen
    var visible = true;
    if ('IntersectionObserver' in window) {
      try {
        new IntersectionObserver(function (es) {
          visible = es[0].isIntersecting; if (visible) dirty = true;
        }, { rootMargin: '120px' }).observe(hero);
      } catch (e) {}
    }

    var lastPct = -1;
    function loop() {
      requestAnimationFrame(loop);
      if (!visible) return;

      if (shown < 0) shown = target;
      var d = target - shown;
      if (Math.abs(d) > 0.00015) { shown += d * EASE; dirty = true; }
      else if (shown !== target) { shown = target; dirty = true; }

      if (!dirty) return;      // nothing changed -> no work, no jank
      dirty = false;

      var f = shown;
      var b = Math.min(1, f / BUILD_SPAN);
      scene.render(Math.pow(b, ACCEL));

      // wording holds its opacity throughout; only a whisper of settle
      if (copy) {
        var t = smooth(cl((f - 0.18) / 0.5));
        copy.style.opacity = (1 - (1 - COPY_MIN) * t).toFixed(3);
      }

      // progress indicator
      var pv = cl(b), pct = Math.round(pv * 100);
      if (pbar) pbar.style.transform = 'scaleY(' + pv.toFixed(4) + ')';
      if (pct !== lastPct) {
        lastPct = pct;
        if (pnum) pnum.textContent = (pct < 10 ? '0' : '') + pct;
      }
      if (prog) prog.style.opacity = (1 - smooth(cl((f - 0.94) / 0.06))).toFixed(3);
    }
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
})();
