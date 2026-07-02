/* =====================================================================
   SMITH & TURNER — lux.js
   - Two Three.js wireframe "building" scenes (hero + about)
   - Construction-style clip-plane build-on, scroll-linked rotation
   - Luxurious scroll: progress bar, reveals, parallax, header state
   - Mobile menu, consultation form, footer year
   - Everything degrades gracefully (no Three / reduced motion)
   ===================================================================== */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasThree = typeof window.THREE !== "undefined";

  /* ---------------- Build a wireframe house geometry ---------------- */
  // Returns { group, amberLines, studLines, height } using line segments.
  function buildHouse(THREE) {
    var group = new THREE.Group();

    // key vertices (single clean gable, echoing the logo roofline)
    var V = {
      A:[-1.5,0,-1], B:[1.5,0,-1], C:[1.5,0,1], D:[-1.5,0,1],     // base
      E:[-1.5,1.45,-1], F:[1.5,1.45,-1], G:[1.5,1.45,1], H:[-1.5,1.45,1], // eaves
      R1:[0,2.35,-1], R2:[0,2.35,1]                                  // ridge
    };
    var silhouette = [
      "A","B","B","C","C","D","D","A",          // base square
      "A","E","B","F","C","G","D","H",          // verticals
      "E","F","F","G","G","H","H","E",          // eave square
      "E","R1","F","R1","H","R2","G","R2",      // gables
      "R1","R2"                                  // ridge
    ];
    var amberPos = [];
    for (var i = 0; i < silhouette.length; i++) {
      var p = V[silhouette[i]];
      amberPos.push(p[0], p[1], p[2]);
    }
    var amberGeo = new THREE.BufferGeometry();
    amberGeo.setAttribute("position", new THREE.Float32BufferAttribute(amberPos, 3));
    var amberMat = new THREE.LineBasicMaterial({ color: 0x15161A, transparent: true, opacity: 0.95 });
    var amberLines = new THREE.LineSegments(amberGeo, amberMat);
    group.add(amberLines);

    // faint interior framing — studs + a couple of rafters + door/window
    var studPos = [];
    function seg(a, b) { studPos.push(a[0],a[1],a[2], b[0],b[1],b[2]); }
    // wall studs (front face z=-1)
    for (var x = -1.0; x <= 1.0001; x += 0.5) seg([x,0,-1],[x,1.45,-1]);
    // floor joists
    for (var z = -0.6; z <= 0.6001; z += 0.6) seg([-1.5,0,z],[1.5,0,z]);
    // rafters
    seg([-1.5,1.45,-1],[0,2.35,-1]); seg([1.5,1.45,-1],[0,2.35,-1]);
    // a door + window on the front
    seg([-0.35,0,-1],[-0.35,0.95,-1]); seg([0.2,0,-1],[0.2,0.95,-1]); seg([-0.35,0.95,-1],[0.2,0.95,-1]);
    seg([0.7,0.6,-1],[1.15,0.6,-1]); seg([0.7,1.0,-1],[1.15,1.0,-1]); seg([0.7,0.6,-1],[0.7,1.0,-1]); seg([1.15,0.6,-1],[1.15,1.0,-1]);
    var studGeo = new THREE.BufferGeometry();
    studGeo.setAttribute("position", new THREE.Float32BufferAttribute(studPos, 3));
    var studMat = new THREE.LineBasicMaterial({ color: 0x45464B, transparent: true, opacity: 0.5 });
    var studLines = new THREE.LineSegments(studGeo, studMat);
    group.add(studLines);

    return { group: group, amberMat: amberMat, studMat: studMat, height: 2.35 };
  }

  /* ---------------- Generic scene runner ---------------- */
  function makeScene(opts) {
    var canvas = opts.canvas;
    if (!canvas || !hasThree) return null;
    var THREE = window.THREE;
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.localClippingEnabled = true;

    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xBEBCB5, opts.fogNear || 6.5, opts.fogFar || 16);

    var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(opts.camX || 0, opts.camY || 1.4, opts.camZ || 7.2);
    camera.lookAt(0, 1.1, 0);

    var house = buildHouse(THREE);
    var grp = house.group;
    grp.position.y = -0.4;
    grp.rotation.y = opts.startRotY || -0.5;
    scene.add(grp);

    // ground grid (drafting plane) — optional
    if (opts.grid) {
      var grid = new THREE.GridHelper(26, 26, 0x8f8d85, 0x9c9a91);
      grid.position.y = -0.42;
      grid.material.transparent = true; grid.material.opacity = 0.5;
      scene.add(grid);
    }

    // construction clip-plane (reveals bottom→top)
    var clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), reduce ? house.height + 0.5 : -0.5);
    house.amberMat.clippingPlanes = [clip];
    house.studMat.clippingPlanes = [clip];

    function resize() {
      var r = canvas.getBoundingClientRect();
      var w = Math.max(1, r.width), h = Math.max(1, r.height);
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);

    var built = reduce ? 1 : 0;     // 0..1 build-on progress
    var start = null;
    var scrollRot = 0;

    function frame(t) {
      if (start === null) start = t;
      // build-on over ~2.2s
      if (built < 1) {
        built = Math.min(1, (t - start) / 2200);
        var e = 1 - Math.pow(1 - built, 3); // easeOutCubic
        clip.constant = -0.5 + e * (house.height + 1.0);
      }
      // idle + scroll rotation
      if (!reduce) grp.rotation.y += 0.0016;
      grp.rotation.y += (scrollRot - grp.rotation.y) * 0 + 0; // (scrollRot applied below)
      grp.rotation.y = (opts.startRotY || -0.5) + (reduce ? 0 : (t - start) / 1000 * 0.12) + scrollRot;
      grp.rotation.x = -0.04 + scrollRot * 0.04;
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    return {
      setScroll: function (v) { scrollRot = v; },
      resize: resize
    };
  }

  /* ---------------- Init scenes ---------------- */
  var heroScene = makeScene({
    canvas: document.getElementById("hero-canvas"),
    camY: 1.5, camZ: 7.4, grid: true, startRotY: -0.6, fogNear: 7, fogFar: 16
  });
  if (heroScene) {
    var fb = document.querySelector(".hero__fallback");
    if (fb) fb.style.display = "none";
  }
  var aboutScene = makeScene({
    canvas: document.getElementById("about-canvas"),
    camY: 1.5, camZ: 6.8, grid: false, startRotY: 0.4, fogNear: 6, fogFar: 13
  });

  /* ---------------- Hero intro ---------------- */
  var hero = document.querySelector(".hero");
  if (hero) requestAnimationFrame(function () { setTimeout(function () { hero.classList.add("in"); }, 80); });

  /* ---------------- Scroll: progress + parallax + scenes ---------------- */
  var bar = document.querySelector(".progress__bar");
  var parallax = Array.prototype.slice.call(document.querySelectorAll("[data-parallax]"));
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY || window.pageYOffset;
      var docH = document.documentElement.scrollHeight - window.innerHeight;
      var prog = docH > 0 ? y / docH : 0;
      if (bar) bar.style.transform = "scaleX(" + prog + ")";

      // header state
      if (header) header.classList.toggle("scrolled", y > 60);

      // hero scene reacts to scroll within first viewport
      if (heroScene) heroScene.setScroll(Math.min(y / window.innerHeight, 1.2) * 0.6);

      // parallax
      for (var i = 0; i < parallax.length; i++) {
        var el = parallax[i];
        var speed = parseFloat(el.getAttribute("data-parallax")) || 0.1;
        var rect = el.getBoundingClientRect();
        var center = rect.top + rect.height / 2 - window.innerHeight / 2;
        el.style.transform = "translate3d(0," + (-center * speed) + "px,0)";
      }
      ticking = false;
    });
  }

  // about scene reacts to its own visibility
  var aboutStage = document.querySelector(".about__stage");
  if (aboutScene && aboutStage) {
    window.addEventListener("scroll", function () {
      var r = aboutStage.getBoundingClientRect();
      var p = 1 - (r.top + r.height / 2) / window.innerHeight; // ~ -1..1
      aboutScene.setScroll(p * 0.5);
    }, { passive: true });
  }

  var header = document.querySelector(".hd");
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------------- Reveal on enter ---------------- */
  var revealEls = document.querySelectorAll(".reveal,[data-stagger]");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------------- Mobile menu ---------------- */
  var burger = document.querySelector(".burger");
  var mnav = document.querySelector(".mnav");
  if (burger && mnav) {
    burger.addEventListener("click", function () {
      var open = mnav.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });
    mnav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        mnav.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); document.body.style.overflow = "";
      });
    });
  }

  /* ---------------- Consultation form ---------------- */
  var form = document.getElementById("consult-form");
  if (form) {
    var ok = document.getElementById("consult-ok");
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var valid = true;
      form.querySelectorAll("[required]").forEach(function (input) {
        var field = input.closest(".field");
        var good = input.value.trim() !== "";
        if (input.type === "email") good = good && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
        field.classList.toggle("invalid", !good);
        if (!good) valid = false;
      });
      if (!valid) { var bad = form.querySelector(".field.invalid input,.field.invalid select,.field.invalid textarea"); if (bad) bad.focus(); return; }

      var data = new FormData(form);
      var payload = {}; data.forEach(function (v, k) { payload[k] = v; });
      var lines = []; data.forEach(function (v, k) { lines.push(k + ": " + v); });
      var mail = "mailto:smithturnerconstruction@gmail.com?subject=" +
        encodeURIComponent("New enquiry — " + (data.get("name") || "")) +
        "&body=" + encodeURIComponent(lines.join("\n"));

      function reveal(openMail) {
        form.style.display = "none";
        if (ok) {
          ok.classList.add("show");
          var l = ok.querySelector("[data-mailto]"); if (l) l.setAttribute("href", mail);
          ok.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
        }
        if (openMail) { window.location.href = mail; }
      }

      var btn = form.querySelector("button[type=submit]");
      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = "Sending…"; }

      fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
        .then(function () { reveal(false); })          // sent server-side
        .catch(function () { reveal(true); })           // API absent/misconfigured -> open pre-filled email
        .then(function () { if (btn) { btn.disabled = false; if (btn.dataset.label) btn.textContent = btn.dataset.label; } });
    });
    form.querySelectorAll("input,select,textarea").forEach(function (el) {
      el.addEventListener("input", function () { el.closest(".field").classList.remove("invalid"); });
    });
  }

  /* ---------------- Footer year ---------------- */
  var yr = document.querySelector("[data-year]");
  if (yr) yr.textContent = new Date().getFullYear();
})();
