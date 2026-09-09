/* hero-controller.js — scroll-driven cinematic hero.
   Drives VillaScene (photoreal locked-off build) from scroll position, pins the
   stage with JS (immune to ancestor overflow), keeps the wording present but
   faded, and drives the progress indicator. */
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
      stage.classList.remove('is-fixed', 'is-bottom');
      stage.style.position = 'relative';
      if (prog) prog.style.display = 'none';
      if (copy) { copy.style.opacity = 1; copy.style.transform = 'none'; }
    }
    if (!window.THREE || !window.VillaScene) { bail('scene unavailable'); return; }

    var scene;
    try { scene = window.VillaScene.create(canvas); }
    catch (e) { bail(e.message); return; }

    /* ---- tuning ---- */
    var BUILD_SPAN = 0.90;   // build completes at 90% of the track; short hold, then hand off
    var ACCEL      = 1.22;   // >1 = construction accelerates as you scroll
    var COPY_MIN   = 0.30;   // wording never fully disappears (your note on IMG_5721)
    var FADE_A     = 0.16, FADE_B = 0.62;  // range over which copy settles to COPY_MIN

    var REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function cl(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function smooth(x) { return x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (x * 6 - 15) + 10); }

    /* ---- size the canvas to the stage (handles rotate / URL-bar resize) ---- */
    var lastW = 0, lastH = 0;
    function resize(force) {
      var r = stage.getBoundingClientRect();
      var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      if (!force && w === lastW && h === lastH) return;
      lastW = w; lastH = h;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      scene.resize(w, h);
    }

    /* ---- JS pin: works even when an ancestor has overflow set ---- */
    function pin() {
      var vh = window.innerHeight;
      var track = hero.offsetHeight - vh;
      var top = hero.getBoundingClientRect().top;
      if (track <= 0) { stage.classList.remove('is-fixed', 'is-bottom'); return; }
      if (top > 0) stage.classList.remove('is-fixed', 'is-bottom');
      else if (-top < track) { stage.classList.add('is-fixed'); stage.classList.remove('is-bottom'); }
      else { stage.classList.remove('is-fixed'); stage.classList.add('is-bottom'); }
    }

    function frac() {
      var track = hero.offsetHeight - window.innerHeight;
      if (track <= 0) return 0;
      return cl(-hero.getBoundingClientRect().top / track);
    }

    if (REDUCE) {
      hero.style.height = '100svh';
      resize(true); pin();
      scene.render(1);
      if (prog) prog.style.display = 'none';
      window.addEventListener('resize', function () { resize(true); scene.render(1); });
      return;
    }

    var target = 0, shown = -1;
    function onScroll() { target = frac(); pin(); }
    document.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { resize(true); onScroll(); });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { resize(true); onScroll(); }, 120);
    });
    if ('ResizeObserver' in window) { try { new ResizeObserver(function () { resize(); }).observe(stage); } catch (e) {} }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { resize(true); });

    resize(true); pin(); onScroll();
    setTimeout(function () { resize(true); onScroll(); }, 120);
    setTimeout(function () { resize(true); onScroll(); }, 500);

    var visible = true;
    if ('IntersectionObserver' in window) {
      try {
        new IntersectionObserver(function (es) { visible = es[0].isIntersecting; },
          { rootMargin: '10px' }).observe(hero);
      } catch (e) {}
    }

    var lastPct = -1;
    function loop() {
      pin();
      if (shown < 0) shown = target;
      shown += (target - shown) * 0.15;
      if (Math.abs(target - shown) < 0.0002) shown = target;

      var f = shown;
      var b = Math.min(1, f / BUILD_SPAN);
      var p = Math.pow(b, ACCEL);

      if (visible) { resize(); scene.render(p); }

      // wording: settles back but stays present — never fully gone
      if (copy) {
        var t = smooth(cl((f - FADE_A) / (FADE_B - FADE_A)));
        copy.style.opacity = (1 - (1 - COPY_MIN) * t).toFixed(3);
        copy.style.transform = 'translate3d(0,' + (-16 * t).toFixed(1) + 'px,0)';
        copy.style.filter = t > 0.02 ? 'blur(' + (0.7 * t).toFixed(2) + 'px)' : 'none';
      }

      // progress indicator
      var pct = Math.round(cl(b) * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        if (pbar) pbar.style.transform = 'scaleY(' + (cl(b)).toFixed(4) + ')';
        if (pnum) pnum.textContent = (pct < 10 ? '0' : '') + pct;
      }
      if (prog) prog.style.opacity = (1 - smooth(cl((f - 0.92) / 0.08))).toFixed(3);

      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
})();
