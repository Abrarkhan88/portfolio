/* =========================================================
   Abrar Sami Khan, portfolio
   room.js: the explorable 3D room (desktop).
   Phones, reduced motion, no-WebGL browsers, and anyone who picks
   "Flat version" get the regular site in index.html instead.

   While the room is being built it only opens with ?room in the URL.
   ========================================================= */
(function () {
  'use strict';

  var THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js';
  var ROOM_ENABLED_BY_DEFAULT = false;   // switched on once every room stage is finished

  var root = document.documentElement;
  var params = new URLSearchParams(location.search);

  /* ---------- Should the room open? ---------- */
  function webglAvailable() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (err) { return false; }
  }

  function prefersFlat() {
    try { return localStorage.getItem('asks-view') === 'flat'; } catch (err) { return false; }
  }
  function rememberView(v) {
    try { localStorage.setItem('asks-view', v); } catch (err) { /* private mode: fine */ }
  }

  var capable = window.matchMedia('(min-width: 900px)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    webglAvailable();
  var wanted = params.has('room') || (ROOM_ENABLED_BY_DEFAULT && !prefersFlat() && !params.has('flat'));

  if (!capable) return;            // flat site only
  // "Enter the room" link in the flat site's header (hidden from visitors until the room is finished)
  if (ROOM_ENABLED_BY_DEFAULT || params.has('room')) addEnterLink();
  if (!wanted) return;

  /* =========================================================
     DOM: loader, canvas, interface
     ========================================================= */
  var layer, stage, loader, logEl, barEl, menu, panel, panelTitle, panelBody, backBtn, hotspotsEl;

  function buildDom() {
    layer = document.createElement('div');
    layer.className = 'room';
    layer.setAttribute('role', 'region');
    layer.setAttribute('aria-label', 'Abrar Sami Khan, 3D room. Use the menu at the bottom to visit each part of the room.');
    layer.innerHTML =
      '<div class="room__stage"></div>' +
      '<div class="room__hotspots" aria-hidden="true"></div>' +

      '<div class="room__top">' +
        '<p class="room__id"><strong>Abrar Sami Khan</strong><span>Analytics, automation and machine learning, Dhaka</span></p>' +
        '<button class="room__flat" type="button">Flat version</button>' +
      '</div>' +

      '<button class="room__back" type="button" hidden>Step back <kbd>Esc</kbd></button>' +

      '<section class="room__panel" hidden aria-live="polite">' +
        '<h2 class="room__panel-title"></h2>' +
        '<div class="room__panel-body"></div>' +
      '</section>' +

      '<nav class="room__menu" aria-label="Room">' +
        '<button type="button" data-view="projects">Projects</button>' +
        '<button type="button" data-view="work">Work</button>' +
        '<button type="button" data-view="about">About</button>' +
        '<button type="button" data-view="contact">Contact</button>' +
      '</nav>' +

      '<div class="room__loader" role="status">' +
        '<div class="room__terminal">' +
          '<p class="room__cmd">abrar@dhaka:~$ <span>./open-room --city dhaka --time dusk</span></p>' +
          '<ol class="room__log"></ol>' +
          '<div class="room__bar"><span></span></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(layer);

    stage = layer.querySelector('.room__stage');
    hotspotsEl = layer.querySelector('.room__hotspots');
    loader = layer.querySelector('.room__loader');
    logEl = layer.querySelector('.room__log');
    barEl = layer.querySelector('.room__bar span');
    menu = layer.querySelector('.room__menu');
    panel = layer.querySelector('.room__panel');
    panelTitle = layer.querySelector('.room__panel-title');
    panelBody = layer.querySelector('.room__panel-body');
    backBtn = layer.querySelector('.room__back');

    // Keep wheel and touch scrolling inside the room from moving the page behind it
    ['wheel', 'touchmove'].forEach(function (type) {
      layer.addEventListener(type, function (e) { e.stopPropagation(); }, { passive: true });
    });

    layer.querySelector('.room__flat').addEventListener('click', function () {
      rememberView('flat');
      leaveRoom();
    });
  }

  /* ---------- Loader: a short script run themed to the work ---------- */
  var LOG_LINES = [
    'fetching three.js',
    'laying out the room: desk, wall, shelf',
    'lighting the Dhaka skyline at dusk',
    'switching on the ceiling fan',
    'sitting Abrar down at his desk',
    'putting projects on the monitor',
    'pinning ID cards to the wall',
    'leaving the phone on the desk'
  ];
  var logIndex = 0;

  function logStep(done) {
    if (logIndex >= LOG_LINES.length) return;
    var li = document.createElement('li');
    li.innerHTML = '<span class="room__ok">ok</span> ' + LOG_LINES[logIndex];
    logEl.appendChild(li);
    logIndex++;
    barEl.style.transform = 'scaleX(' + (logIndex / LOG_LINES.length) + ')';
    if (done) done();
  }

  function runLog(untilIndex, stepMs) {
    return new Promise(function (resolve) {
      (function next() {
        if (logIndex >= untilIndex) { resolve(); return; }
        logStep();
        setTimeout(next, stepMs);
      })();
    });
  }

  function loadThree() {
    if (window.THREE) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + THREE_URL + '"]');
      var s = existing || document.createElement('script');
      s.addEventListener('load', function () { window.THREE ? resolve() : reject(new Error('three missing')); });
      s.addEventListener('error', reject);
      if (!existing) { s.src = THREE_URL; s.async = true; document.head.appendChild(s); }
    });
  }

  /* =========================================================
     Enter / leave
     ========================================================= */
  var world = null;   // the 3D scene once built

  function enterRoom() {
    root.classList.add('room-mode');
    var pre = document.querySelector('.preloader');
    if (pre) pre.remove();   // the room has its own loader
    buildDom();

    var started = Date.now();
    var logging = runLog(1, 260);           // "fetching three.js" straight away

    loadThree()
      .then(function () { return logging; })
      .then(function () {
        world = buildWorld();
        return runLog(LOG_LINES.length, 230);
      })
      .then(function () {
        var wait = Math.max(0, 1800 - (Date.now() - started));
        return new Promise(function (r) { setTimeout(r, wait); });
      })
      .then(function () {
        var p = document.createElement('p');
        p.className = 'room__ready';
        p.textContent = 'ready. walking in…';
        logEl.parentNode.appendChild(p);
        return new Promise(function (r) { setTimeout(r, 500); });
      })
      .then(function () {
        hideLoader();
        world.intro();
      })
      .catch(function () {
        // Anything goes wrong: fall back to the flat site quietly
        leaveRoom();
      });
  }

  function hideLoader() {
    if (window.gsap) {
      gsap.to(loader, { autoAlpha: 0, duration: 0.7, ease: 'power2.out', onComplete: function () { loader.remove(); } });
    } else {
      loader.remove();
    }
  }

  function leaveRoom() {
    if (world) world.dispose();
    world = null;
    if (layer) layer.remove();
    layer = null;
    root.classList.remove('room-mode');
    if (window.ScrollTrigger) ScrollTrigger.refresh();
    var link = document.querySelector('.site-nav__room');
    if (link) link.hidden = false;
    var main = document.getElementById('main');
    if (main) { main.setAttribute('tabindex', '-1'); main.focus({ preventScroll: true }); }
  }

  function addEnterLink() {
    var list = document.querySelector('.site-nav__list');
    if (!list || document.querySelector('.site-nav__room')) return;
    var li = document.createElement('li');
    li.className = 'site-nav__room';
    var a = document.createElement('a');
    a.href = '?room';
    a.textContent = 'Enter the room';
    a.addEventListener('click', function (e) {
      if (root.classList.contains('room-mode')) return;
      e.preventDefault();
      rememberView('room');
      li.hidden = true;
      window.scrollTo(0, 0);
      enterRoom();
    });
    li.appendChild(a);
    list.appendChild(li);
    if (wanted) li.hidden = true;
  }

  /* =========================================================
     The 3D world
     ========================================================= */
  function buildWorld() {
    var T = window.THREE;

    // Dhaka dusk palette
    var C = {
      wall: 0x7b4a3a,       // warm terracotta
      wallDark: 0x6a3f33,
      floor: 0x8a5c3c,      // warm wood
      desk: 0x3a2e28,
      deskTop: 0x4a3b33,
      metal: 0x24201d,
      board: 0x3a2d26,
      paper: 0xece6da,
      marigold: 0xe9c14a,
      teal: 0x2f7d77,
      cane: 0xb98a4e
    };

    var renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setClearColor(0x1a1210, 1);
    var canvas = renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    stage.appendChild(canvas);

    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(40, 16 / 9, 0.1, 200);

    /* ---------- Small seeded random, so the city looks the same every visit ---------- */
    var seed = 20261101;
    function rnd() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    function between(a, b) { return a + rnd() * (b - a); }

    /* ---------- Lights ---------- */
    scene.add(new T.HemisphereLight(0xffe2c4, 0x3a2418, 1.05));   // warm evening fill

    var sunset = new T.DirectionalLight(0xffa463, 1.25);           // low dusk sun through the window
    sunset.position.set(-14, 8.5, 3);
    sunset.castShadow = true;
    sunset.shadow.mapSize.width = 2048;
    sunset.shadow.mapSize.height = 2048;
    sunset.shadow.camera.left = -12; sunset.shadow.camera.right = 12;
    sunset.shadow.camera.top = 12; sunset.shadow.camera.bottom = -12;
    scene.add(sunset);

    var lamp = new T.PointLight(0xffc27a, 1.3, 9, 2);              // desk lamp
    lamp.position.set(-1.9, 3.3, -2.5);
    lamp.castShadow = true;
    scene.add(lamp);

    // Wall lights above the shelf and the board, and the fan light
    [[-4.4, 6.4, -5.3], [3.6, 6.4, -5.3]].forEach(function (p) {
      var l = new T.PointLight(0xffb870, 0.7, 7, 2);
      l.position.set(p[0], p[1], p[2]);
      scene.add(l);
    });
    var fanLight = new T.PointLight(0xfff0d6, 0.45, 14, 2);
    fanLight.position.set(0.6, 6.5, 1);
    scene.add(fanLight);

    /* ---------- Helpers ---------- */
    function mat(color, opts) {
      var o = { color: color, roughness: 0.85, metalness: 0.05 };
      for (var k in opts) o[k] = opts[k];
      return new T.MeshStandardMaterial(o);
    }
    function box(w, h, d, m, x, y, z, parent) {
      var mesh = new T.Mesh(new T.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      (parent || scene).add(mesh);
      return mesh;
    }
    function cyl(rt, rb, h, m, x, y, z, parent, seg) {
      var mesh = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 20), m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      (parent || scene).add(mesh);
      return mesh;
    }
    function canvasTex(w, h, draw) {
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      return new T.CanvasTexture(c);
    }

    /* ---------- Room: a closed box, so the only view outside is the window ----------
       Inside spans x -8..13, z -6..14, height 7.5 */
    var RX0 = -8, RX1 = 13, RZ0 = -6, RZ1 = 14, RH = 7.5;
    var RW = RX1 - RX0, RD = RZ1 - RZ0, CX = (RX0 + RX1) / 2, CZ = (RZ0 + RZ1) / 2;

    // Floor boards
    var floorTex = canvasTex(1024, 1024, function (g, w, h) {
      g.fillStyle = '#8a5c3c'; g.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 64) {
        g.fillStyle = 'rgba(0,0,0,' + (0.04 + rnd() * 0.06) + ')';
        g.fillRect(0, y, w, 64);
        g.fillStyle = 'rgba(30,15,8,0.35)';
        g.fillRect(0, y, w, 2);
        var off = rnd() * w;
        g.fillRect(off, y, 2, 64);
      }
    });
    var floor = new T.Mesh(new T.PlaneGeometry(RW, RD), new T.MeshStandardMaterial({ map: floorTex, roughness: 0.7 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(CX, 0, CZ);
    floor.receiveShadow = true;
    scene.add(floor);

    // Kantha-style rug: deep teal with running-stitch borders and a simple centre motif
    var rugTex = canvasTex(1024, 740, function (g, w, h) {
      g.fillStyle = '#245f5a'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#e9c14a'; g.lineWidth = 6; g.setLineDash([18, 12]);
      for (var i = 0; i < 4; i++) { g.strokeRect(30 + i * 22, 30 + i * 22, w - 60 - i * 44, h - 60 - i * 44); }
      g.strokeStyle = '#c4553f'; g.setLineDash([10, 10]); g.lineWidth = 5;
      g.strokeRect(140, 140, w - 280, h - 280);
      g.setLineDash([]);
      g.translate(w / 2, h / 2);
      for (var k = 0; k < 8; k++) {
        g.rotate(Math.PI / 4);
        g.fillStyle = k % 2 ? '#ece6da' : '#e9c14a';
        g.beginPath(); g.ellipse(0, -60, 22, 56, 0, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#c4553f'; g.beginPath(); g.arc(0, 0, 26, 0, Math.PI * 2); g.fill();
    });
    var rug = new T.Mesh(new T.PlaneGeometry(6.4, 4.6), new T.MeshStandardMaterial({ map: rugTex, roughness: 1 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0.6, 0.01, 0.8);
    rug.receiveShadow = true;
    scene.add(rug);

    var wallM = mat(C.wall), wallDarkM = mat(C.wallDark);
    box(RW + 0.6, RH, 0.3, wallM, CX, RH / 2, RZ0);                  // back wall
    box(0.3, RH, RD, wallM, RX1, RH / 2, CZ);                         // right wall
    box(RW + 0.6, RH, 0.3, wallM, CX, RH / 2, RZ1);                   // front wall (behind the camera)
    box(RW + 0.6, 0.3, RD + 0.6, mat(0x5a3a30, { roughness: 1 }), CX, RH + 0.15, CZ);  // ceiling
    // Skirting along the walls
    box(RW, 0.25, 0.08, mat(0x4a2e25), CX, 0.125, RZ0 + 0.18);
    box(0.08, 0.25, RD, mat(0x4a2e25), RX0 + 0.18, 0.125, CZ);

    // Left wall (x = -8), built around a window opening from z -3 to 3, y 1.6 to 5.6
    box(0.3, RH, 3.0, wallDarkM, RX0, RH / 2, -4.5);
    box(0.3, RH, RZ1 - 3, wallDarkM, RX0, RH / 2, (3 + RZ1) / 2);
    box(0.3, 1.6, 6.0, wallDarkM, RX0, 0.8, 0);
    box(0.3, RH - 5.6, 6.0, wallDarkM, RX0, (5.6 + RH) / 2, 0);
    var frameM = mat(C.metal, { roughness: 0.6 });
    box(0.36, 0.12, 6.0, frameM, RX0, 1.62, 0);
    box(0.36, 0.12, 6.0, frameM, RX0, 5.58, 0);
    box(0.36, 4.0, 0.12, frameM, RX0, 3.6, 0);
    box(0.36, 4.0, 0.12, frameM, RX0, 3.6, -2.95);
    box(0.36, 4.0, 0.12, frameM, RX0, 3.6, 2.95);
    box(0.7, 0.1, 6.3, mat(0x4a2e25), RX0 + 0.3, 1.58, 0);            // window sill
    // Window grill, common on Dhaka windows
    for (var gz = -2.5; gz <= 2.5; gz += 0.5) box(0.04, 3.9, 0.04, frameM, RX0 - 0.12, 3.6, gz);

    // Teal curtains drawn to the sides
    var curtainM = mat(C.teal, { roughness: 1 });
    box(0.15, 4.8, 1.1, curtainM, RX0 + 0.35, 3.4, -3.65);
    box(0.15, 4.8, 1.1, curtainM, RX0 + 0.35, 3.4, 3.65);
    box(0.1, 0.1, 8.6, frameM, RX0 + 0.4, 5.85, 0);                     // curtain rod

    /* ---------- Dhaka at dusk, outside the window ----------
       Three layers at different depths so the city shifts as the camera moves. */
    var SKY_W = 2048, SKY_H = 1024;

    function drawBuildingsRow(g, w, h, opts) {
      var x = -20;
      while (x < w + 20) {
        var bw = between(opts.minW, opts.maxW);
        if (opts.clear && x + bw > opts.clear[0] && x < opts.clear[1]) { x = opts.clear[1] + between(0, 20); continue; }   // keep this view open
        var top = h * between(opts.topMin, opts.topMax);
        g.fillStyle = opts.colors[Math.floor(rnd() * opts.colors.length)];
        g.fillRect(x, top, bw, h - top);
        // Windows: a mix of warm bulbs and white tube lights; many dark
        var cols = Math.max(2, Math.floor(bw / opts.cell));
        var rows = Math.floor((h - top) / (opts.cell * 1.25));
        var cw = bw / cols;
        for (var r = 0; r < rows; r++) {
          for (var c = 0; c < cols; c++) {
            var lit = rnd();
            if (lit < opts.lit) {
              g.fillStyle = rnd() < 0.35 ? 'rgba(232,244,255,0.9)' : 'rgba(255,205,120,0.92)';
              g.fillRect(x + c * cw + cw * 0.22, top + 10 + r * opts.cell * 1.25, cw * 0.56, opts.cell * 0.6);
            } else if (opts.grills) {
              g.fillStyle = 'rgba(0,0,0,0.25)';
              g.fillRect(x + c * cw + cw * 0.22, top + 10 + r * opts.cell * 1.25, cw * 0.56, opts.cell * 0.6);
            }
            if (opts.grills) {
              // balcony rail under each floor
              g.fillStyle = 'rgba(0,0,0,0.35)';
              g.fillRect(x + c * cw + 2, top + 10 + r * opts.cell * 1.25 + opts.cell * 0.72, cw - 4, 3);
            }
          }
        }
        // Rooftop water tanks, the most Dhaka thing on a skyline
        if (rnd() < opts.tanks) {
          var tw = bw * between(0.18, 0.3), th = tw * between(0.7, 1.0);
          var tx = x + bw * between(0.1, 0.6);
          g.fillStyle = opts.tankColor;
          g.fillRect(tx, top - th, tw, th);
          g.fillRect(tx + tw * 0.1, top - th - 4, tw * 0.8, 4);
        }
        // Antennas and dishes on some roofs
        if (rnd() < 0.3) { g.fillStyle = opts.tankColor; g.fillRect(x + bw * 0.8, top - opts.cell * 1.6, 2, opts.cell * 1.6); }
        // AC units on facades of near buildings
        if (opts.ac) {
          for (var a = 0; a < 3; a++) if (rnd() < 0.5) {
            g.fillStyle = 'rgba(220,210,200,0.55)';
            g.fillRect(x + between(4, bw - 26), top + between(20, h - top - 30), 22, 14);
          }
        }
        x += bw + between(0, opts.gap);
      }
    }

    // Layer 1: sky, sun, far skyline with a mosque
    var farTex = canvasTex(SKY_W, SKY_H, function (g, w, h) {
      var sk = g.createLinearGradient(0, 0, 0, h);
      sk.addColorStop(0, '#3a2a5a');
      sk.addColorStop(0.32, '#8b4d7c');
      sk.addColorStop(0.55, '#ef7f58');
      sk.addColorStop(0.7, '#ffc373');
      sk.addColorStop(1, '#ffd9a0');
      g.fillStyle = sk; g.fillRect(0, 0, w, h);
      // Low sun with a soft glow
      var sx = w * 0.36, sy = h * 0.64;
      var glow = g.createRadialGradient(sx, sy, 10, sx, sy, 320);
      glow.addColorStop(0, 'rgba(255,240,190,1)');
      glow.addColorStop(0.18, 'rgba(255,214,140,0.8)');
      glow.addColorStop(1, 'rgba(255,170,100,0)');
      g.fillStyle = glow; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff1c8'; g.beginPath(); g.arc(sx, sy, 46, 0, Math.PI * 2); g.fill();
      // Long thin clouds
      g.fillStyle = 'rgba(255,190,170,0.35)';
      for (var i = 0; i < 9; i++) {
        g.beginPath(); g.ellipse(between(0, w), between(h * 0.18, h * 0.5), between(120, 380), between(6, 16), 0, 0, Math.PI * 2); g.fill();
      }
      // Distant haze line of buildings
      drawBuildingsRow(g, w, h, { minW: 30, maxW: 80, topMin: 0.6, topMax: 0.72, gap: 4, cell: 12, lit: 0.18,
        colors: ['#8a5a74', '#7d5270', '#94627a'], tanks: 0.4, tankColor: '#6d4762' });
      // Mid-distance blocks
      drawBuildingsRow(g, w, h, { minW: 50, maxW: 130, topMin: 0.66, topMax: 0.8, gap: 10, cell: 16, lit: 0.32,
        colors: ['#6b4462', '#5e3d58', '#734a66'], tanks: 0.55, tankColor: '#3f2840' });
      // Mosque: dome and two minarets, placed where the window looks from the main view
      var mx = w * 0.53, base = h * 0.68, k = 1.35;
      g.fillStyle = '#5c3a58';
      g.fillRect(mx - 70 * k, base - 40 * k, 140 * k, h - base + 40 * k);
      g.beginPath(); g.arc(mx, base - 40 * k, 62 * k, Math.PI, 0); g.fill();
      g.fillRect(mx - 3, base - 40 * k - 62 * k - 18, 6, 22);
      g.beginPath(); g.arc(mx, base - 40 * k - 62 * k - 20, 6, 0, Math.PI * 2); g.fill();
      [mx - 118 * k, mx + 104 * k].forEach(function (px) {
        g.fillStyle = '#5c3a58';
        g.fillRect(px, base - 190 * k, 14 * k, h - base + 190 * k);
        g.beginPath(); g.arc(px + 7 * k, base - 190 * k, 11 * k, Math.PI, 0); g.fill();
        g.fillRect(px + 6 * k, base - 214 * k, 3, 16 * k);
        g.fillRect(px - 5, base - 140 * k, 14 * k + 10, 6);   // balcony ring
        // small evening lights up the minarets
        for (var li = 0; li < 6; li++) {
          g.fillStyle = li % 2 ? 'rgba(170,255,190,0.95)' : 'rgba(255,250,225,0.95)';
          g.beginPath(); g.arc(px + 7 * k, base - 170 * k + li * 26 * k, 3.5, 0, Math.PI * 2); g.fill();
        }
      });
      // a soft glow behind the dome so it reads against the sky
      var halo = g.createRadialGradient(mx, base - 70 * k, 20, mx, base - 70 * k, 160 * k);
      halo.addColorStop(0, 'rgba(255,220,170,0.35)'); halo.addColorStop(1, 'rgba(255,220,170,0)');
      g.globalCompositeOperation = 'destination-over';
      g.fillStyle = halo; g.fillRect(mx - 200 * k, base - 260 * k, 400 * k, 300 * k);
      g.globalCompositeOperation = 'source-over';
      // lit arched windows on the prayer hall
      g.fillStyle = 'rgba(255,214,140,0.9)';
      for (var aw = -2; aw <= 2; aw++) {
        g.beginPath(); g.arc(mx + aw * 24 * k, base - 8 * k, 6 * k, Math.PI, 0); g.fill();
        g.fillRect(mx + aw * 24 * k - 6 * k, base - 8 * k, 12 * k, 16 * k);
      }
      // A few birds over the sky
      g.strokeStyle = 'rgba(40,24,40,0.7)'; g.lineWidth = 3;
      for (var b = 0; b < 7; b++) {
        var bx = between(w * 0.15, w * 0.85), by = between(h * 0.2, h * 0.45), s = between(8, 14);
        g.beginPath(); g.moveTo(bx - s, by); g.quadraticCurveTo(bx - s / 2, by - s / 2, bx, by); g.quadraticCurveTo(bx + s / 2, by - s / 2, bx + s, by); g.stroke();
      }
    });
    var far = new T.Mesh(new T.PlaneGeometry(34, 17), new T.MeshBasicMaterial({ map: farTex }));
    far.position.set(RX0 - 7, 4.9, -3);
    far.rotation.y = Math.PI / 2;
    scene.add(far);

    // Layer 2: closer residential blocks with balconies and AC units
    var nearTex = canvasTex(SKY_W, SKY_H, function (g, w, h) {
      drawBuildingsRow(g, w, h, { minW: 160, maxW: 320, topMin: 0.42, topMax: 0.62, gap: 30, cell: 34, lit: 0.42,
        colors: ['#3d2734', '#46303a', '#352230'], tanks: 0.7, tankColor: '#24161f', grills: true, ac: true,
        clear: [w * 0.44, w * 0.6] });   // the mosque shows through here
    });
    var near = new T.Mesh(new T.PlaneGeometry(26, 13), new T.MeshBasicMaterial({ map: nearTex, transparent: true }));
    near.position.set(RX0 - 3.6, 3.0, -1.5);
    near.rotation.y = Math.PI / 2;
    scene.add(near);

    // Layer 3: overhead electric wires, sagging across the view, with a few crows
    var wireTex = canvasTex(SKY_W, 512, function (g, w, h) {
      g.strokeStyle = 'rgba(28,16,22,0.92)';
      for (var i = 0; i < 9; i++) {
        var y0 = between(60, 260), y1 = between(60, 260), sag = between(40, 120);
        g.lineWidth = between(2, 4);
        g.beginPath(); g.moveTo(-10, y0); g.quadraticCurveTo(w / 2, Math.max(y0, y1) + sag, w + 10, y1); g.stroke();
      }
      // a tangle near one side
      for (var j = 0; j < 14; j++) {
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(w * 0.12, between(80, 200)); g.bezierCurveTo(w * between(0.2, 0.4), between(100, 380), w * between(0.4, 0.6), between(60, 300), w + 10, between(80, 340)); g.stroke();
      }
      // crows sitting on a wire
      g.fillStyle = 'rgba(20,12,18,0.95)';
      [[0.55, 214], [0.58, 216], [0.62, 219]].forEach(function (c) {
        var cx = w * c[0], cy = c[1];
        g.beginPath(); g.ellipse(cx, cy - 12, 9, 13, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(cx + 5, cy - 26, 6, 0, Math.PI * 2); g.fill();
      });
    });
    var wires = new T.Mesh(new T.PlaneGeometry(16, 4), new T.MeshBasicMaterial({ map: wireTex, transparent: true }));
    wires.position.set(RX0 - 1.4, 5.0, 0);
    wires.rotation.y = Math.PI / 2;
    scene.add(wires);

    /* ---------- Desk with monitor, lamp and phone ---------- */
    var desk = new T.Group();
    desk.position.set(0, 0, -2.2);
    scene.add(desk);
    box(5.2, 0.16, 2.2, mat(C.deskTop, { roughness: 0.5 }), 0, 1.55, 0, desk);
    box(0.16, 1.5, 2.0, mat(C.desk), -2.45, 0.75, 0, desk);
    box(1.6, 1.5, 2.0, mat(C.desk), 1.8, 0.75, 0, desk);
    box(1.4, 0.04, 0.04, mat(C.marigold, { metalness: 0.5 }), 1.8, 1.1, 1.01, desk);   // drawer handle
    box(5.2, 0.03, 0.03, new T.MeshBasicMaterial({ color: C.marigold }), 0, 1.46, 1.1, desk);

    var monitor = new T.Group();
    monitor.position.set(-0.3, 1.63, -0.45);
    desk.add(monitor);
    box(0.5, 0.06, 0.4, mat(C.metal), 0, 0.03, 0, monitor);
    box(0.12, 0.7, 0.08, mat(C.metal), 0, 0.4, -0.05, monitor);
    box(2.5, 1.5, 0.12, mat(C.metal, { roughness: 0.4 }), 0, 1.4, 0, monitor);
    // Glowing screen: a simple desktop (projects arrive in a later stage)
    var screenTex = canvasTex(1024, 590, function (g, w, h) {
      var bg = g.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#13232a'); bg.addColorStop(1, '#1e1a2c');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, 0, w, 34);
      g.fillStyle = '#ece6da'; g.font = '600 18px sans-serif'; g.fillText('abrar@desk', 16, 23);
      g.fillStyle = '#a7a194'; g.fillText('Dhaka, dusk', w - 130, 23);
      var tiles = ['#2f7d77', '#e9c14a', '#c4553f', '#5b4a7a', '#3e6e8c', '#8a5c3c'];
      for (var i = 0; i < 6; i++) {
        var tx = 40 + (i % 3) * 320, ty = 70 + Math.floor(i / 3) * 250;
        g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(tx, ty, 290, 220);
        g.fillStyle = tiles[i]; g.fillRect(tx, ty, 290, 8);
        g.fillStyle = 'rgba(236,230,218,0.25)';
        for (var r = 0; r < 4; r++) g.fillRect(tx + 18, ty + 40 + r * 34, 180 - r * 30, 12);
      }
    });
    var screen = new T.Mesh(new T.PlaneGeometry(2.36, 1.36), new T.MeshBasicMaterial({ map: screenTex }));
    screen.position.set(0, 1.4, 0.065);
    monitor.add(screen);
    var screenGlow = new T.PointLight(0x8fd1ff, 0.35, 4, 2);
    screenGlow.position.set(0, 1.4, 0.6);
    monitor.add(screenGlow);
    box(1.9, 0.05, 0.6, mat(0x2e2a28), -0.3, 1.66, 0.45, desk);                       // keyboard
    box(0.2, 0.05, 0.32, mat(0x2e2a28), 0.95, 1.66, 0.45, desk);                      // mouse
    cyl(0.14, 0.12, 0.3, mat(0xece6da), 1.1, 1.78, -0.35, desk);                       // tea cup
    box(0.04, 0.12, 0.04, mat(0xece6da), 1.27, 1.8, -0.35, desk);                     // cup handle

    var lampArm = new T.Group();
    lampArm.position.set(-2.1, 1.63, -0.6);
    desk.add(lampArm);
    box(0.4, 0.06, 0.4, mat(C.metal), 0, 0.03, 0, lampArm);
    box(0.06, 1.4, 0.06, mat(C.metal), 0, 0.73, 0, lampArm);
    box(0.5, 0.25, 0.35, mat(C.marigold, { emissive: 0x6a4a10 }), 0.15, 1.45, 0.1, lampArm);

    var phone = box(0.34, 0.04, 0.66, mat(0x111214, { roughness: 0.3 }), 1.55, 1.65, 0.35, desk);
    phone.rotation.y = -0.35;

    /* ---------- Back wall: ID card board, shelf and a rickshaw-art poster ---------- */
    var boardTex = canvasTex(920, 480, function (g, w, h) {
      g.fillStyle = '#3a2d26'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#271d18';
      for (var y = 20; y < h; y += 28) for (var x = 20; x < w; x += 28) { g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = '#5a4436'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    });
    var board = new T.Mesh(new T.BoxGeometry(4.6, 2.4, 0.08), [
      mat(C.board), mat(C.board), mat(C.board), mat(C.board),
      new T.MeshStandardMaterial({ map: boardTex, roughness: 0.9 }), mat(C.board)
    ]);
    board.position.set(3.6, 4.2, -5.8);
    board.castShadow = true; board.receiveShadow = true;
    scene.add(board);
    box(4.6, 0.04, 0.12, new T.MeshBasicMaterial({ color: C.marigold }), 3.6, 2.97, -5.78);

    var shelf = new T.Group();
    shelf.position.set(-4.4, 0, -5.55);
    scene.add(shelf);
    box(3.2, 0.12, 0.6, mat(C.desk), 0, 4.6, 0, shelf);
    box(3.2, 0.12, 0.6, mat(C.desk), 0, 3.4, 0, shelf);
    var bookColors = [0x2f7d77, 0xe9c14a, 0xc4553f, 0xece6da, 0x5b4a7a, 0x245f5a];
    for (var i = 0; i < 9; i++) {
      var bh = 0.55 + (i % 3) * 0.12;
      box(0.18, bh, 0.42, mat(bookColors[i % bookColors.length]), -1.3 + i * 0.22, 4.66 + bh / 2, 0, shelf);
    }
    box(0.5, 0.35, 0.4, mat(0x8a5c3c), 0.9, 3.64, 0, shelf);                        // a small box
    cyl(0.16, 0.12, 0.35, mat(C.teal), 1.3, 3.64, 0, shelf);                        // small pot
    box(0.08, 0.4, 0.08, mat(0x4f8a45), 1.3, 3.95, 0, shelf);

    // Rickshaw-art inspired poster: bright border, flowers and a peacock-blue field
    var posterTex = canvasTex(400, 560, function (g, w, h) {
      g.fillStyle = '#0f6f7a'; g.fillRect(0, 0, w, h);
      var stripes = ['#e9c14a', '#c4553f', '#ece6da', '#2a9d4b'];
      for (var s = 0; s < 4; s++) { g.strokeStyle = stripes[s]; g.lineWidth = 10; g.strokeRect(10 + s * 10, 10 + s * 10, w - 20 - s * 20, h - 20 - s * 20); }
      function flower(x, y, r, petal, centre) {
        g.fillStyle = petal;
        for (var p = 0; p < 8; p++) { g.beginPath(); g.ellipse(x + Math.cos(p * Math.PI / 4) * r, y + Math.sin(p * Math.PI / 4) * r, r * 0.55, r * 0.32, p * Math.PI / 4, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = centre; g.beginPath(); g.arc(x, y, r * 0.5, 0, Math.PI * 2); g.fill();
      }
      flower(w / 2, h * 0.42, 70, '#e64b6b', '#e9c14a');
      flower(w * 0.27, h * 0.72, 38, '#e9c14a', '#c4553f');
      flower(w * 0.73, h * 0.72, 38, '#ece6da', '#e64b6b');
      flower(w * 0.27, h * 0.18, 26, '#2a9d4b', '#ece6da');
      flower(w * 0.73, h * 0.18, 26, '#2a9d4b', '#ece6da');
    });
    var poster = new T.Mesh(new T.PlaneGeometry(1.6, 2.24), new T.MeshStandardMaterial({ map: posterTex, roughness: 0.8 }));
    poster.position.set(8.4, 4.3, -5.83);
    scene.add(poster);
    box(1.72, 2.36, 0.06, mat(0x2a1d19), 8.4, 4.3, -5.88);

    /* ---------- Chair (the character sits here in stage 3) ---------- */
    var chair = new T.Group();
    chair.position.set(-0.3, 0, -0.4);
    scene.add(chair);
    box(1.1, 0.14, 1.0, mat(0x2b2a33), 0, 1.05, 0, chair);
    box(1.1, 1.3, 0.12, mat(0x2b2a33), 0, 1.75, 0.5, chair);
    box(0.1, 1.0, 0.1, mat(C.metal), 0, 0.5, 0, chair);
    box(0.9, 0.06, 0.06, mat(C.metal), 0, 0.05, 0, chair);
    box(0.06, 0.06, 0.9, mat(C.metal), 0, 0.05, 0, chair);

    /* ---------- You: a stylised figure sitting at the desk ----------
       Built from rounded shapes. Faces the monitor (-z). Wavy black hair swept up,
       stubble, light grey T-shirt, black trousers, white-soled trainers. */
    var SKIN = 0x8d5a3b, SKIN_SHADE = 0x7a4c31, HAIR = 0x161214, STUBBLE = 0x4a3328,
        TEE = 0xa8aca9, TROUSERS = 0x1d1d22, SHOE = 0x2a2a2e, SOLE = 0xe8e4dc;
    var skinM = mat(SKIN, { roughness: 0.75 }), hairM = mat(HAIR, { roughness: 0.6 }),
        teeM = mat(TEE, { roughness: 0.95 }), trouserM = mat(TROUSERS, { roughness: 0.9 });

    var me = new T.Group();
    me.position.set(-0.3, 0, -0.45);
    scene.add(me);

    function part(geo, m, x, y, z, parent) {
      var mesh = new T.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      (parent || me).add(mesh);
      return mesh;
    }
    // A rounded limb between two points, in the parent's own coordinates
    var UP = new T.Vector3(0, 1, 0);
    function limb(from, to, radius, m, parent) {
      var dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
      var len = Math.hypot(dx, dy, dz);
      var cap = new T.Mesh(new T.CapsuleGeometry(radius, Math.max(0.01, len - radius * 2), 6, 12), m);
      cap.position.set(from[0] + dx / 2, from[1] + dy / 2, from[2] + dz / 2);
      cap.quaternion.setFromUnitVectors(UP, new T.Vector3(dx / len, dy / len, dz / len));   // capsule runs along y; aim it at `to`
      cap.castShadow = true;
      cap.receiveShadow = true;
      (parent || me).add(cap);
      return cap;
    }

    // Legs: thighs forward along the seat, shins down to the floor
    part(new T.BoxGeometry(0.74, 0.28, 0.6), trouserM, 0, 1.27, 0.02);
    [-0.19, 0.19].forEach(function (x) {
      limb([x, 1.27, -0.05], [x * 1.05, 1.25, -0.72], 0.15, trouserM);
      limb([x * 1.05, 1.22, -0.72], [x * 1.05, 0.22, -0.78], 0.13, trouserM);
      part(new T.BoxGeometry(0.24, 0.14, 0.46), mat(SHOE), x * 1.05, 0.12, -0.86);
      part(new T.BoxGeometry(0.25, 0.05, 0.48), mat(SOLE), x * 1.05, 0.03, -0.86);
    });

    // Torso in the grey T-shirt, leaning slightly toward the screen
    var torso = new T.Group();
    torso.position.set(0, 1.42, 0.05);
    torso.rotation.x = -0.1;
    me.add(torso);
    var chest = part(new T.CapsuleGeometry(0.33, 0.48, 6, 16), teeM, 0, 0.45, 0, torso);
    chest.scale.set(1.12, 1, 0.74);
    part(new T.CylinderGeometry(0.36, 0.34, 0.12, 16), teeM, 0, 0.08, 0, torso).scale.set(1.05, 1, 0.78);   // hem

    // Arms: short grey sleeves, bare forearms reaching for the keyboard
    var hands = [];
    [-1, 1].forEach(function (side) {
      var sh = [side * 0.44, 0.78, 0];
      part(new T.SphereGeometry(0.125, 16, 12), teeM, sh[0], sh[1], sh[2], torso);             // shoulder
      limb(sh, [side * 0.48, 0.5, -0.08], 0.118, teeM, torso);                                  // sleeve
      var elbow = [side * 0.47, 0.38, -0.56], wrist = [side * 0.25, 0.43, -1.19];   // elbow just over the desk edge
      limb([side * 0.48, 0.5, -0.08], elbow, 0.092, skinM, torso);                              // upper arm, down to the elbow
      part(new T.SphereGeometry(0.088, 12, 10), skinM, elbow[0], elbow[1], elbow[2], torso);    // elbow
      limb(elbow, wrist, 0.078, skinM, torso);                                                  // forearm, forward onto the desk
      var hand = part(new T.SphereGeometry(0.09, 14, 10), skinM, side * 0.24, 0.44, -1.31, torso);   // hand on the keyboard
      hand.scale.set(0.95, 0.42, 1.3);
      hands.push(hand);
    });

    // Neck and head
    part(new T.CylinderGeometry(0.1, 0.11, 0.2, 14), skinM, 0, 1.06, -0.02, torso);
    var head = new T.Group();
    head.position.set(0, 1.4, -0.04);
    torso.add(head);

    var skull = part(new T.SphereGeometry(0.3, 28, 20), skinM, 0, 0, 0, head);
    skull.scale.set(0.9, 1.06, 0.98);
    // Jaw with stubble: the lower front of the face, a little darker
    var jaw = part(new T.SphereGeometry(0.296, 24, 14, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.55, Math.PI * 0.35), mat(STUBBLE, { roughness: 1 }), 0, 0, 0, head);
    jaw.scale.set(0.92, 1.07, 1.0);
    jaw.rotation.y = Math.PI;            // face the front (-z)
    // Ears
    [-1, 1].forEach(function (side) {
      part(new T.SphereGeometry(0.07, 10, 8), mat(SKIN_SHADE), side * 0.27, -0.02, 0.02, head).scale.set(0.5, 1, 0.8);
    });
    // Eyes, brows and nose (small, since you mostly see him from behind)
    [-1, 1].forEach(function (side) {
      part(new T.SphereGeometry(0.03, 10, 8), mat(0x1a1210), side * 0.1, 0.04, -0.27, head);
      part(new T.BoxGeometry(0.11, 0.025, 0.03), hairM, side * 0.1, 0.12, -0.27, head).rotation.z = side * -0.1;
    });
    part(new T.SphereGeometry(0.045, 10, 8), mat(SKIN_SHADE), 0, -0.04, -0.3, head);

    // Hair: a cap plus wavy volume swept up and back
    var cap = part(new T.SphereGeometry(0.315, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), hairM, 0, 0.03, 0.01, head);
    cap.scale.set(0.95, 1.1, 1.04);
    var hairBack = part(new T.SphereGeometry(0.3, 22, 14, 0, Math.PI, Math.PI * 0.3, Math.PI * 0.32), hairM, 0, 0.0, 0.04, head);
    hairBack.scale.set(0.97, 1.05, 1.05);
    [
      [0, 0.3, -0.14, 0.15], [-0.11, 0.29, -0.08, 0.13], [0.11, 0.28, -0.1, 0.13],
      [0, 0.33, 0.0, 0.16], [-0.13, 0.27, 0.07, 0.13], [0.13, 0.27, 0.06, 0.13],
      [0, 0.28, 0.14, 0.14], [-0.06, 0.34, -0.04, 0.12], [0.07, 0.34, 0.03, 0.12]
    ].forEach(function (w) {
      part(new T.SphereGeometry(w[3], 14, 10), hairM, w[0], w[1], w[2], head).scale.set(1, 0.72, 1.1);
    });
    // A wave falling at the front
    var wave = part(new T.SphereGeometry(0.09, 12, 8), hairM, 0.06, 0.24, -0.25, head);
    wave.scale.set(1.3, 0.6, 0.8);

    /* Where he looks: the monitor by default, the object you open, and now and then you */
    var headTarget = new T.Vector3(-0.3, 3.03, -2.6);
    var headYaw = 0, headPitch = 0;
    var HEAD_WORLD = new T.Vector3(-0.3, 2.85, -0.55);   // roughly where the head sits in the room
    function lookAt(x, y, z) { headTarget.set(x, y, z); }

    /* ---------- Bangladeshi home details ---------- */
    // Ceiling fan, turning slowly
    var fan = new T.Group();
    fan.position.set(0.6, RH, 1);
    scene.add(fan);
    cyl(0.06, 0.06, 0.9, mat(0xd9d2c4), 0, -0.45, 0, fan, 8);
    cyl(0.35, 0.3, 0.25, mat(0xd9d2c4), 0, -0.95, 0, fan);
    var blades = new T.Group();
    blades.position.y = -0.98;
    fan.add(blades);
    for (var bl = 0; bl < 3; bl++) {
      var arm = new T.Group();
      arm.rotation.y = bl * (Math.PI * 2 / 3);
      blades.add(arm);
      var blade = box(2.4, 0.04, 0.45, mat(0xd9d2c4), 1.4, 0, 0, arm);
      blade.rotation.x = 0.12;
    }
    cyl(0.12, 0.12, 0.05, new T.MeshBasicMaterial({ color: 0xfff0d6 }), 0, -1.1, 0, fan);

    // Mora: a cane stool with a red cushion
    var mora = new T.Group();
    mora.position.set(7.4, 0, -3.2);
    scene.add(mora);
    var caneM = mat(C.cane, { roughness: 0.95 });
    cyl(0.28, 0.5, 0.55, caneM, 0, 0.275, 0, mora);
    cyl(0.5, 0.28, 0.55, caneM, 0, 0.825, 0, mora);
    cyl(0.48, 0.48, 0.1, mat(0xc4553f), 0, 1.15, 0, mora);

    // Plant by the window
    var plant = new T.Group();
    plant.position.set(-6.5, 0, 4.6);
    scene.add(plant);
    cyl(0.45, 0.35, 0.9, mat(0xc4553f), 0, 0.45, 0, plant);
    // Snake-plant style leaves: tall, thin and pointed, fanning out
    for (var lf = 0; lf < 11; lf++) {
      var lh = between(1.1, 2.0);
      var leafHolder = new T.Group();
      leafHolder.position.set(between(-0.15, 0.15), 0.85, between(-0.15, 0.15));
      leafHolder.rotation.set(between(-0.3, 0.3), lf * 0.57, between(-0.3, 0.3));
      plant.add(leafHolder);
      var leaf = new T.Mesh(new T.ConeGeometry(0.13, lh, 4), mat(lf % 3 ? 0x4f8a45 : 0x6aa055, { roughness: 0.7 }));
      leaf.scale.set(1, 1, 0.3);
      leaf.position.y = lh / 2;
      leaf.castShadow = true;
      leafHolder.add(leaf);
    }

    // A floor cushion near the window, for reading
    box(1.6, 0.35, 1.6, mat(0xe9c14a, { roughness: 1 }), -5.8, 0.18, -3.6);
    box(1.2, 0.5, 0.35, mat(0xc4553f, { roughness: 1 }), -6.4, 0.55, -3.6).rotation.y = Math.PI / 2;

    /* ---------- Views: where the camera goes for each section ---------- */
    var VIEWS = {
      home:     { pos: [9.8, 5.5, 9.8],  look: [-1.0, 2.6, -2.4] },
      projects: { pos: [-0.3, 3.05, 0.2], look: [-0.3, 3.03, -2.65] },
      work:     { pos: [3.6, 4.2, -1.6],  look: [3.6, 4.2, -5.8] },
      about:    { pos: [-4.4, 4.4, -2.6], look: [-4.4, 4.1, -5.55] },
      contact:  { pos: [1.4, 3.1, -1.5],  look: [1.55, 1.65, -1.85] }
    };

    // Objects you can click, and where their floating markers sit
    var HOTSPOTS = [
      { view: 'projects', label: 'Projects', at: [-0.3, 3.05, -2.5], mesh: screen },
      { view: 'work', label: 'Work', at: [3.6, 5.7, -5.7], mesh: board },
      { view: 'about', label: 'About', at: [-4.4, 5.6, -5.4], mesh: shelf },
      { view: 'contact', label: 'Contact', at: [1.55, 2.2, -1.85], mesh: phone }
    ];

    /* ---------- Camera: home view with a little drag-to-look ---------- */
    var cam = { x: 0, y: 0, z: 0, lx: 0, ly: 0, lz: 0 };
    var current = 'home';
    var yaw = 0, pitch = 0, yawTarget = 0, pitchTarget = 0;
    var dragging = false, dragX = 0, dragY = 0, moved = 0;

    function setCam(v) {
      cam.x = v.pos[0]; cam.y = v.pos[1]; cam.z = v.pos[2];
      cam.lx = v.look[0]; cam.ly = v.look[1]; cam.lz = v.look[2];
    }

    function applyCamera() {
      var x = cam.x, y = cam.y, z = cam.z;
      if (current === 'home') {
        // Swing the camera around the look point by the drag amount
        var dx = x - cam.lx, dz = z - cam.lz;
        var r = Math.hypot(dx, dz), a = Math.atan2(dx, dz) + yaw;
        x = cam.lx + Math.sin(a) * r;
        z = cam.lz + Math.cos(a) * r;
        y = y + pitch * 6;
      }
      camera.position.set(x, y, z);
      camera.lookAt(cam.lx, cam.ly, cam.lz);
    }

    function flyTo(name) {
      var v = VIEWS[name];
      if (!v) return;
      current = name === 'home' ? 'home' : name;
      yawTarget = 0; pitchTarget = 0;
      if (name === 'home' || name === 'projects') lookAt(-0.3, 3.03, -2.6);   // back to the screen
      else lookAt(v.look[0], v.look[1], v.look[2]);                         // turn toward what you opened
      var to = { x: v.pos[0], y: v.pos[1], z: v.pos[2], lx: v.look[0], ly: v.look[1], lz: v.look[2] };
      if (window.gsap) {
        gsap.to(cam, Object.assign({ duration: 1.4, ease: 'power3.inOut', overwrite: true }, to));
      } else {
        Object.assign(cam, to);
      }
      syncUi(name);
    }

    /* ---------- Section panels (filled in by later stages) ---------- */
    var SECTION_TEXT = {
      projects: { title: 'Projects', body: 'The computer will hold your projects here. Coming in a later stage.' },
      work: { title: 'Work', body: 'ID cards for Therap BD and your leadership roles will hang here. Coming in a later stage.' },
      about: { title: 'About', body: 'Your story will live here. Coming in a later stage.' },
      contact: { title: 'Contact', body: 'Your phone will show how to reach you. Coming in a later stage.' }
    };

    function syncUi(name) {
      menu.querySelectorAll('button').forEach(function (b) {
        if (b.getAttribute('data-view') === name) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      });
      var inSection = name !== 'home';
      backBtn.hidden = !inSection;
      hotspotsEl.classList.toggle('is-hidden', inSection);
      if (inSection) {
        panelTitle.textContent = SECTION_TEXT[name].title;
        panelBody.textContent = SECTION_TEXT[name].body;
        panel.hidden = false;
        if (window.gsap) gsap.fromTo(panel, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, delay: 0.9, ease: 'power2.out' });
      } else {
        panel.hidden = true;
      }
    }

    menu.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var name = b.getAttribute('data-view');
      flyTo(current === name ? 'home' : name);
    });
    backBtn.addEventListener('click', function () { flyTo('home'); });
    function onKey(e) { if (e.key === 'Escape' && current !== 'home') flyTo('home'); }
    document.addEventListener('keydown', onKey);

    /* ---------- Floating markers over clickable objects ---------- */
    var markers = HOTSPOTS.map(function (h) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'room__marker';
      b.setAttribute('tabindex', '-1');      // the menu is the keyboard path
      b.innerHTML = '<span>' + h.label + '</span>';
      b.addEventListener('click', function () { flyTo(h.view); });
      hotspotsEl.appendChild(b);
      return { el: b, at: new T.Vector3(h.at[0], h.at[1], h.at[2]) };
    });
    var tmp = new T.Vector3();

    function placeMarkers(w, h) {
      markers.forEach(function (m) {
        tmp.copy(m.at).project(camera);
        var visible = tmp.z < 1;
        m.el.style.transform = 'translate(' + ((tmp.x * 0.5 + 0.5) * w) + 'px,' + ((-tmp.y * 0.5 + 0.5) * h) + 'px)';
        m.el.style.opacity = visible ? '' : '0';
      });
    }

    /* ---------- Pointer: drag to look, click objects ---------- */
    var raycaster = new T.Raycaster();
    var pointer = new T.Vector2();

    function pickAt(clientX, clientY) {
      var r = canvas.getBoundingClientRect();
      pointer.x = ((clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      for (var i = 0; i < HOTSPOTS.length; i++) {
        var hits = raycaster.intersectObject(HOTSPOTS[i].mesh, true);
        if (hits.length) return HOTSPOTS[i].view;
      }
      return null;
    }

    function onDown(e) { dragging = true; moved = 0; dragX = e.clientX; dragY = e.clientY; canvas.style.cursor = 'grabbing'; }
    function onMove(e) {
      if (dragging && current === 'home') {
        moved += Math.abs(e.clientX - dragX) + Math.abs(e.clientY - dragY);
        yawTarget = Math.max(-0.25, Math.min(0.25, yawTarget - (e.clientX - dragX) * 0.003));
        pitchTarget = Math.max(-0.08, Math.min(0.08, pitchTarget + (e.clientY - dragY) * 0.0015));
        dragX = e.clientX; dragY = e.clientY;
      } else if (!dragging) {
        canvas.style.cursor = current === 'home' && pickAt(e.clientX, e.clientY) ? 'pointer' : 'grab';
      }
    }
    function onUp(e) {
      dragging = false;
      canvas.style.cursor = 'grab';
      if (moved < 6 && current === 'home') {
        var hit = pickAt(e.clientX, e.clientY);
        if (hit) flyTo(hit);
      }
    }
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    /* ---------- Size and render loop ---------- */
    var W = 0, H = 0;
    function resize() {
      W = stage.clientWidth; H = stage.clientHeight;
      if (!W || !H) return;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    resize();

    var raf = null, last = performance.now(), t = 0;
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now; t += dt;
      yaw += (yawTarget - yaw) * Math.min(1, dt * 5);
      pitch += (pitchTarget - pitch) * Math.min(1, dt * 5);
      if (current === 'home' && !dragging) {
        // Drift gently back to centre once you let go
        yawTarget += (0 - yawTarget) * Math.min(1, dt * 0.6);
        pitchTarget += (0 - pitchTarget) * Math.min(1, dt * 0.6);
      }
      lamp.intensity = 1.3 + Math.sin(t * 2.1) * 0.03;   // the faintest lamp flicker
      blades.rotation.y += dt * 2.4;                       // ceiling fan

      // You: breathing, short typing bursts, and the head turning toward its target
      chest.scale.y = 1 + Math.sin(t * 1.5) * 0.015;
      var typing = (current === 'home' || current === 'projects') && (t % 5.5) < 2.4;
      hands.forEach(function (hd, i) {
        hd.position.y = 0.44 + (typing ? Math.abs(Math.sin(t * 17 + i * 1.7)) * 0.025 : 0);
      });
      var glance = current === 'home' && (t % 11) > 9.2;              // now and then, he looks back at you
      var tx = glance ? camera.position.x : headTarget.x,
          ty = glance ? camera.position.y : headTarget.y,
          tz = glance ? camera.position.z : headTarget.z;
      var hx = tx - HEAD_WORLD.x, hy = ty - HEAD_WORLD.y, hz = tz - HEAD_WORLD.z;
      var wantYaw = Math.max(-1.25, Math.min(1.25, Math.atan2(-hx, -hz)));
      var wantPitch = Math.max(-0.45, Math.min(0.45, Math.atan2(hy, Math.hypot(hx, hz))));
      headYaw += (wantYaw - headYaw) * Math.min(1, dt * 3);
      headPitch += (wantPitch - headPitch) * Math.min(1, dt * 3);
      head.rotation.y = headYaw * 0.8;
      head.rotation.x = headPitch + 0.1;                 // undo the torso's lean
      torso.rotation.y = headYaw * 0.2;
      applyCamera();
      renderer.render(scene, camera);
      placeMarkers(W, H);
      raf = requestAnimationFrame(frame);
    }

    // Start in the far corner, then glide to the home view
    setCam({ pos: [12.0, 6.6, 13.2], look: [-1.0, 2.6, -2.4] });   // inside the room, near the far corner
    applyCamera();
    raf = requestAnimationFrame(frame);

    return {
      intro: function () {
        flyTo('home');
        menu.classList.add('is-in');
      },
      dispose: function () {
        cancelAnimationFrame(raf);
        document.removeEventListener('keydown', onKey);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('resize', resize);
        renderer.dispose();
      }
    };
  }

  enterRoom();
})();
