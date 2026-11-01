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

      '<div class="room-desk" hidden></div>' +
      '<div class="room-app" role="dialog" aria-modal="true" aria-labelledby="room-app-title" hidden>' +
        '<div class="room-app__bar">' +
          '<button class="room-app__home" type="button"><span aria-hidden="true">&larr;</span> Desktop</button>' +
          '<p class="room-app__title" id="room-app-title"></p>' +
          '<button class="room-app__close" type="button" aria-label="Close project">&times;</button>' +
        '</div>' +
        '<div class="room-app__body" data-lenis-prevent tabindex="-1"></div>' +
      '</div>' +

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
      .catch(function (err) {
        // Anything goes wrong: fall back to the flat site, leaving a note in the console
        if (window.console) console.warn('Room fell back to the flat site:', err);
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
        if (opts.low && x + bw > opts.low[0] && x < opts.low[1]) top = Math.max(top, h * opts.low[2]);
        g.fillStyle = opts.colors[Math.floor(rnd() * opts.colors.length)];
        g.fillRect(x, top, bw, h - top);
        if (opts.out) opts.out.push([x, top, bw]);
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
      // Mosque: dome and two minarets, off to one side of the window view, behind the city
      var mx = w * 0.603, base = h * 0.7, k = 0.62;
      g.fillStyle = '#5c3a58';
      g.fillRect(mx - 70 * k, base - 40 * k, 140 * k, h - base + 40 * k);
      g.beginPath(); g.arc(mx, base - 40 * k, 62 * k, Math.PI, 0); g.fill();
      g.fillRect(mx - 2, base - 40 * k - 62 * k - 14, 4, 16);
      g.beginPath(); g.arc(mx, base - 40 * k - 62 * k - 15, 4, 0, Math.PI * 2); g.fill();
      [mx - 118 * k, mx + 104 * k].forEach(function (px) {
        g.fillStyle = '#5c3a58';
        g.fillRect(px, base - 190 * k, 14 * k, h - base + 190 * k);
        g.beginPath(); g.arc(px + 7 * k, base - 190 * k, 11 * k, Math.PI, 0); g.fill();
        g.fillRect(px + 6 * k, base - 214 * k, 2, 16 * k);
        g.fillRect(px - 3, base - 140 * k, 14 * k + 6, 4);   // balcony ring
        for (var li = 0; li < 4; li++) {                       // small evening lights on the minarets
          g.fillStyle = li % 2 ? 'rgba(170,255,190,0.85)' : 'rgba(255,250,225,0.85)';
          g.beginPath(); g.arc(px + 7 * k, base - 176 * k + li * 22 * k, 2.2, 0, Math.PI * 2); g.fill();
        }
      });
      // Mid-distance blocks, kept a little lower in front of the dome so it peeks over them
      drawBuildingsRow(g, w, h, { minW: 50, maxW: 130, topMin: 0.66, topMax: 0.8, gap: 10, cell: 16, lit: 0.32,
        colors: ['#6b4462', '#5e3d58', '#734a66'], tanks: 0.55, tankColor: '#3f2840',
        low: [mx - 80 * k, mx + 80 * k, 0.735] });
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
    // The expressway's height across the near layer, as a fraction of its texture (0 = top)
    function deckV(u) { return 0.6 - 0.035 * u - Math.sin(u * Math.PI) * 0.012; }
    var frontC = document.createElement('canvas');   // blocks that stand in front of the road
    frontC.width = SKY_W; frontC.height = SKY_H;
    var nearTex = canvasTex(SKY_W, SKY_H, function (g, w, h) {
      // The blocks go on their own canvas first, so some can be stamped back in front of the expressway
      var blocks = document.createElement('canvas'); blocks.width = w; blocks.height = h;
      var rects = [];
      drawBuildingsRow(blocks.getContext('2d'), w, h, { minW: 160, maxW: 320, topMin: 0.42, topMax: 0.66, gap: 30, cell: 34, lit: 0.42,
        colors: ['#3d2734', '#46303a', '#352230'], tanks: 0.7, tankColor: '#24161f', grills: true, ac: true,
        clear: [w * 0.58, w * 0.63], out: rects });   // a side street, looking through to the mosque
      g.drawImage(blocks, 0, 0);

      // Elevated expressway weaving through the blocks: concrete deck on pillars, traffic streaking along
      var deckY = function (x) { return h * deckV(x / w); };
      var line = function (off) { g.beginPath(); for (var dx = -10; dx <= w + 10; dx += 20) { if (dx < 0) g.moveTo(dx, deckY(dx) + off); else g.lineTo(dx, deckY(dx) + off); } g.stroke(); };
      g.fillStyle = '#4e3846';
      for (var px = 70; px < w; px += 240) {                       // pillars with pier caps
        var py = deckY(px);
        g.fillRect(px - 13, py + 18, 26, h - py);
        g.fillRect(px - 26, py + 14, 52, 9);
      }
      g.lineCap = 'butt';
      g.strokeStyle = '#5f4654'; g.lineWidth = 24; line(0);          // deck
      g.strokeStyle = '#3e2c38'; g.lineWidth = 6; line(12);          // shadowed underside edge
      g.strokeStyle = '#a07b80'; g.lineWidth = 4; line(-13);         // parapet catching the sunset
      for (var cl = 0; cl < 16; cl++) {                               // a few far-off lights; real cars drive past below
        var cx = between(0, w), head = rnd() < 0.5;
        g.fillStyle = head ? 'rgba(255,244,210,0.95)' : 'rgba(255,80,64,0.9)';
        g.fillRect(cx, deckY(cx) + (head ? -6 : 2), between(10, 22), 3);
      }
      for (var lp = 50; lp < w; lp += 170) {                          // lamp posts along the parapet
        g.fillStyle = '#3e2c38'; g.fillRect(lp, deckY(lp) - 48, 3, 36); g.fillRect(lp, deckY(lp) - 48, 10, 3);
        g.fillStyle = 'rgba(255,214,140,0.95)'; g.beginPath(); g.arc(lp + 10, deckY(lp) - 45, 4, 0, Math.PI * 2); g.fill();
      }
      // Every other block stands in front of the road (on its own layer, so passing cars slip behind them)
      var fg = frontC.getContext('2d');
      rects.forEach(function (r, i) {
        if (i % 2) return;
        fg.drawImage(blocks, r[0], r[1], r[2], h - r[1], r[0], r[1], r[2], h - r[1]);
      });
    });
    var near = new T.Mesh(new T.PlaneGeometry(26, 13), new T.MeshBasicMaterial({ map: nearTex, transparent: true }));
    near.position.set(RX0 - 3.6, 3.0, -1.5);
    near.rotation.y = Math.PI / 2;
    near.renderOrder = 1;
    scene.add(near);

    var front = new T.Mesh(new T.PlaneGeometry(26, 13), new T.MeshBasicMaterial({ map: new T.CanvasTexture(frontC), transparent: true, alphaTest: 0.5 }));
    front.position.set(RX0 - 3.5, 3.0, -1.5);
    front.rotation.y = Math.PI / 2;
    front.renderOrder = 3;
    scene.add(front);

    /* Traffic on the expressway: cars and Dhaka buses drive past now and then.
       They sit between the road layer and the front blocks, so they weave behind buildings. */
    function vehicleTex(kind) {
      var long = kind === 'bus';
      return canvasTex(long ? 192 : 112, 48, function (g, w, h) {
        var body = { car: '#2b2230', cng: '#2f7d4a', bus: ['#b8332b', '#2f6f8f', '#c8862a'][Math.floor(rnd() * 3)] }[kind];
        g.fillStyle = body;
        if (long) {                                         // bus: tall box with a row of lit windows
          g.fillRect(4, 6, w - 8, 32); g.fillRect(6, 38, w - 12, 4);
          g.fillStyle = 'rgba(255,226,160,0.9)';
          for (var i = 0; i < 7; i++) g.fillRect(16 + i * 23, 11, 16, 10);
        } else if (kind === 'cng') {                        // CNG auto-rickshaw: rounded green cabin
          g.beginPath(); g.moveTo(10, 40); g.lineTo(10, 18); g.quadraticCurveTo(14, 6, 50, 6); g.quadraticCurveTo(w - 12, 8, w - 12, 30); g.lineTo(w - 10, 40); g.fill();
          g.fillStyle = 'rgba(255,230,180,0.55)'; g.fillRect(34, 14, 34, 12);
        } else {                                            // car: low body with a cabin
          g.beginPath(); g.moveTo(6, 40); g.lineTo(6, 28); g.lineTo(28, 24); g.lineTo(40, 12); g.lineTo(76, 12); g.lineTo(90, 24); g.lineTo(w - 6, 28); g.lineTo(w - 6, 40); g.fill();
          g.fillStyle = 'rgba(255,220,170,0.45)'; g.fillRect(44, 16, 30, 9);
        }
        g.fillStyle = '#141014';                            // wheels
        [long ? 26 : 22, w - (long ? 30 : 24)].forEach(function (x) { g.beginPath(); g.arc(x, 41, 6, 0, Math.PI * 2); g.fill(); });
        // headlight at the front (right), tail light at the back (left), each with a little glow
        [[w - 6, 'rgba(255,248,215,', 30], [6, 'rgba(255,70,55,', 18]].forEach(function (l) {
          var gl = g.createRadialGradient(l[0], 32, 1, l[0], 32, l[2] * 0.5);
          gl.addColorStop(0, l[1] + '1)'); gl.addColorStop(1, l[1] + '0)');
          g.fillStyle = gl; g.fillRect(l[0] - l[2], 32 - l[2], l[2] * 2, l[2] * 2);
        });
      });
    }
    var traffic = [];
    ['car', 'bus', 'car', 'cng', 'car', 'bus', 'car'].forEach(function (kind, i) {
      var long = kind === 'bus', lenU = long ? 0.6 : 0.36;
      var m = new T.Mesh(new T.PlaneGeometry(lenU, 0.15), new T.MeshBasicMaterial({ map: vehicleTex(kind), transparent: true, alphaTest: 0.1 }));
      m.rotation.y = Math.PI / 2;
      m.renderOrder = 2;
      m.visible = false;
      scene.add(m);
      var dir = i % 2 ? 1 : -1;                             // two directions, two lanes
      if (dir < 0) m.scale.x = -1;                          // face the other way
      traffic.push({ mesh: m, dir: dir, len: lenU / 26, speed: between(0.06, 0.1) * (long ? 0.75 : 1),
        u: 0, wait: between(0.5, 9) + i * 1.3 });
    });
    function moveTraffic(dt) {
      traffic.forEach(function (v) {
        if (v.wait > 0) { v.wait -= dt; v.mesh.visible = false; if (v.wait <= 0) v.u = v.dir > 0 ? -v.len : 1 + v.len; return; }
        v.u += v.dir * v.speed * dt;
        if (v.u < -v.len - 0.02 || v.u > 1 + v.len + 0.02) { v.wait = between(3, 12); v.mesh.visible = false; return; }
        var lane = v.dir > 0 ? 0.004 : -0.002;              // the far lane sits a touch higher
        v.mesh.position.set(RX0 - 3.55, 9.5 - (deckV(v.u) + lane) * 13 + 0.02, 11.5 - v.u * 26);
        v.mesh.visible = true;
      });
    }

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
    // Glowing screen: the projects desktop (the HTML desktop sits exactly over it up close)
    var screenTex = canvasTex(1024, 590, function (g, w, h) {
      var bg = g.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#16262b'); bg.addColorStop(1, '#221b2e');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, 0, w, 34);
      g.fillStyle = '#ece6da'; g.font = '600 17px sans-serif'; g.fillText('abrar@desk', 22, 23);
      var rows = [['#2e2f45', '#34391f', '#3b2b36', '#3d2f28'], ['#29323b', '#263530', '#2e2f45', '#34391f', '#3d2f28'], ['#34391f']];
      rows.forEach(function (row, r) {
        var y = 64 + r * 172;
        g.fillStyle = 'rgba(236,230,218,0.55)'; g.fillRect(40, y, 90, 8);
        row.forEach(function (c, i) {
          var x = 40 + i * 132;
          g.fillStyle = c; g.fillRect(x, y + 26, 88, 88);
          g.strokeStyle = 'rgba(233,193,74,0.7)'; g.lineWidth = 3; g.strokeRect(x + 26, y + 52, 36, 36);
          g.fillStyle = 'rgba(236,230,218,0.4)'; g.fillRect(x + 6, y + 126, 76, 7);
        });
      });
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

    /* ---------- Work: ID cards on lanyards, hanging from the board ---------- */
    var workItems = Array.prototype.slice.call(document.querySelectorAll('#work .story__title')).map(function (el) { return el.textContent.trim(); });
    var CARDS = [
      { id: 'therap', org: 'Therap BD', short: 'Therap BD', role: 'Associate, Customer Experience Strategy & Analytics',
        period: 'Since September 2026', kind: 'Full-time role', color: '#2f7d77', x: 1.95, w: 0.92, h: 1.24, app: 'work',
        note: 'I turn manual monthly reporting into scripted tools, support the team’s Salesforce setup, and look for places where AI can save time.' },
      { id: 'robotics', org: 'BRAC University Robotics Club', short: 'Robotics Club', role: 'Director, Editorial & Publications',
        period: '2022 to 2025', kind: 'Leadership', color: '#c4553f', x: 3.05, w: 0.8, h: 1.08 },
      { id: 'business', org: 'BRAC University Business Club', short: 'Business Club', role: 'Assistant Director, Research & Publications',
        period: '2022 to 2025', kind: 'Leadership', color: '#5b4a7a', x: 4.0, w: 0.8, h: 1.08 },
      { id: 'edy', org: 'EDY (Enduring Developments by the Youths)', short: 'EDY', role: 'Lead, Media and Content Creation',
        period: '2020 to 2021', kind: 'Leadership', color: '#3e6e8c', x: 4.95, w: 0.8, h: 1.08 },
      { id: 'dofe', org: 'The Duke of Edinburgh’s International Award', short: 'DofE Bronze', role: 'Bronze Award',
        period: '2023', kind: 'Award', medal: true, x: 5.62 }
    ];

    function wrapText(g, text, x, y, maxW, lineH) {
      var words = text.split(' '), line = '';
      words.forEach(function (wd) {
        var test = line ? line + ' ' + wd : wd;
        if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); y += lineH; line = wd; }
        else line = test;
      });
      if (line) { g.fillText(line, x, y); y += lineH; }
      return y;
    }
    // A small portrait of the character, matching the 3D one
    function drawAvatar(g, cx, cy, r, bg) {
      g.save();
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
      g.fillStyle = bg; g.fillRect(cx - r, cy - r, r * 2, r * 2);
      g.fillStyle = '#a8aca9'; g.beginPath(); g.ellipse(cx, cy + r * 1.02, r * 0.85, r * 0.55, 0, 0, Math.PI * 2); g.fill();   // T-shirt
      g.fillStyle = '#7a4c31'; g.fillRect(cx - r * 0.14, cy + r * 0.2, r * 0.28, r * 0.3);                                     // neck
      g.fillStyle = '#8d5a3b'; g.beginPath(); g.ellipse(cx, cy - r * 0.05, r * 0.36, r * 0.44, 0, 0, Math.PI * 2); g.fill();   // face
      g.fillStyle = 'rgba(60,38,28,0.55)'; g.beginPath(); g.ellipse(cx, cy + r * 0.16, r * 0.31, r * 0.22, 0, 0, Math.PI); g.fill();   // stubble
      g.fillStyle = '#161214';                                                                                                   // wavy hair, swept up
      [[-0.22, -0.42, 0.2], [0, -0.5, 0.24], [0.22, -0.42, 0.2], [-0.32, -0.25, 0.12], [0.32, -0.25, 0.12], [0.1, -0.6, 0.15]].forEach(function (b) {
        g.beginPath(); g.ellipse(cx + b[0] * r, cy + b[1] * r, b[2] * r * 1.25, b[2] * r * 0.85, 0, 0, Math.PI * 2); g.fill();
      });
      g.fillStyle = '#1a1210';
      g.beginPath(); g.arc(cx - r * 0.13, cy - r * 0.07, r * 0.035, 0, Math.PI * 2); g.arc(cx + r * 0.13, cy - r * 0.07, r * 0.035, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    var CARD_FONT = '"Instrument Sans", "Helvetica Neue", Arial, sans-serif';
    // Your photo goes on the card fronts once it loads; the drawn portrait stays as a fallback
    var portrait = new Image();
    var portraitReady = false, frontTexes = [];
    function paintPortrait(tex) {
      var cv = tex.image;
      if (!cv || !cv.getContext) return;
      var g = cv.getContext('2d'), w = cv.width, h = cv.height;
      var cx = w / 2, cy = h * 0.39, r = w * 0.2;
      g.save();
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
      g.drawImage(portrait, cx - r, cy - r, r * 2, r * 2);
      g.restore();
      g.strokeStyle = 'rgba(26,18,16,0.15)'; g.lineWidth = 3;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      tex.needsUpdate = true;
    }
    portrait.addEventListener('load', function () {
      portraitReady = true;
      frontTexes.forEach(paintPortrait);
    });
    portrait.src = 'portrait.jpg';

    function cardFront(c) {
      var tex = cardFrontTex(c);
      frontTexes.push(tex);
      if (portraitReady) paintPortrait(tex);
      return tex;
    }
    function cardFrontTex(c) {
      return canvasTex(512, Math.round(512 * c.h / c.w), function (g, w, h) {
        g.fillStyle = '#f3eee4'; g.fillRect(0, 0, w, h);
        g.fillStyle = c.color; g.fillRect(0, 0, w, h * 0.2);
        g.fillStyle = '#f3eee4'; g.beginPath(); g.ellipse(w / 2, h * 0.045, 46, 11, 0, 0, Math.PI * 2); g.fill();   // lanyard slot
        g.fillStyle = '#fff'; g.font = '700 38px ' + CARD_FONT; g.textAlign = 'center';
        wrapText(g, c.short, w / 2, h * 0.14, w - 60, 40);
        drawAvatar(g, w / 2, h * 0.39, w * 0.2, '#e3dccf');
        g.fillStyle = '#1a1210'; g.font = '700 40px ' + CARD_FONT;
        g.fillText('Abrar Sami Khan', w / 2, h * 0.64);
        g.fillStyle = '#4a3f38'; g.font = '500 27px ' + CARD_FONT;
        var y = wrapText(g, c.role, w / 2, h * 0.64 + 46, w - 70, 32);
        g.fillStyle = c.color; g.font = '600 25px ' + CARD_FONT;
        g.fillText(c.period, w / 2, y + 10);
        // decorative barcode
        g.fillStyle = '#1a1210';
        var bx = w * 0.22;
        while (bx < w * 0.78) { var bw = 2 + Math.floor(rnd() * 4); g.fillRect(bx, h - 62, bw, 34); bx += bw + 2 + Math.floor(rnd() * 4); }
      });
    }
    function cardBack(c) {
      return canvasTex(512, Math.round(512 * c.h / c.w), function (g, w, h) {
        g.fillStyle = '#ebe5d9'; g.fillRect(0, 0, w, h);
        g.fillStyle = c.color; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14);
        g.textAlign = 'left';
        g.fillStyle = c.color; g.font = '700 22px ' + CARD_FONT;
        g.fillText(c.kind.toUpperCase(), 40, 66);
        g.fillStyle = '#1a1210'; g.font = '700 34px ' + CARD_FONT;
        var y = wrapText(g, c.org, 40, 112, w - 80, 38) + 8;
        g.fillStyle = '#4a3f38'; g.font = '500 25px ' + CARD_FONT;
        y = wrapText(g, c.role, 40, y, w - 80, 31);
        g.fillStyle = c.color; g.font = '600 24px ' + CARD_FONT;
        g.fillText(c.period, 40, y + 6);
        y += 50;
        g.fillStyle = 'rgba(26,18,16,0.18)'; g.fillRect(40, y, w - 80, 2);
        y += 44;
        if (c.id === 'therap' && workItems.length) {
          g.fillStyle = c.color; g.font = '700 22px ' + CARD_FONT; g.fillText('WHAT I WORK ON', 40, y); y += 40;
          g.font = '500 25px ' + CARD_FONT;
          workItems.forEach(function (it) {
            g.fillStyle = c.color; g.fillRect(40, y - 12, 10, 10);
            g.fillStyle = '#1a1210'; g.fillText(it, 64, y); y += 38;
          });
        } else {
          g.fillStyle = '#4a3f38'; g.font = 'italic 500 24px ' + CARD_FONT;
          wrapText(g, 'Holder: Abrar Sami Khan', 40, y, w - 80, 30);
        }
      });
    }

    var cardEntries = [];
    var cardMeshes = [];
    var HOOK_Y = 5.24, CARD_Z = -5.68, STRAP = 0.62;
    CARDS.forEach(function (c, i) {
      var pivot = new T.Group();
      pivot.position.set(c.x, HOOK_Y, CARD_Z);
      scene.add(pivot);
      box(0.05, 0.05, 0.16, mat(C.metal, { metalness: 0.6, roughness: 0.4 }), 0, 0, -0.06, pivot);   // peg hook
      var entry = { c: c, pivot: pivot, kick: { z: 0 }, flipped: false };
      if (c.medal) {
        // A bronze medal on a short ribbon
        [-1, 1].forEach(function (side) {
          var r = box(0.07, 0.42, 0.012, mat(side < 0 ? 0x2f6f8f : 0xe9c14a), side * 0.04, -0.2, 0.01, pivot);
          r.rotation.z = side * 0.12;
        });
        var disc = cyl(0.17, 0.17, 0.04, mat(0xb07a45, { metalness: 0.7, roughness: 0.35 }), 0, -0.56, 0.03, pivot, 32);
        disc.rotation.x = Math.PI / 2;
        cyl(0.11, 0.11, 0.045, mat(0x8f5f34, { metalness: 0.7, roughness: 0.45 }), 0, -0.56, 0.035, pivot, 32).rotation.x = Math.PI / 2;
        disc.userData.card = i;
        cardMeshes.push(disc);
        entry.hold = disc;
      } else {
        // Lanyard: two straps in a V down to the card clip
        [-1, 1].forEach(function (side) {
          var dx = side * 0.07, len = Math.hypot(dx, STRAP);
          var strap = box(0.05, len, 0.006, mat(c.color, { roughness: 0.95 }), dx / 2, -STRAP / 2, 0.01, pivot);
          strap.rotation.z = Math.atan2(dx, STRAP);
        });
        var hold = new T.Group();
        hold.position.set(0, -STRAP - c.h / 2 - 0.04, 0.02);
        pivot.add(hold);
        var front = new T.Mesh(new T.PlaneGeometry(c.w, c.h), new T.MeshBasicMaterial({ map: cardFront(c), color: 0xe9e3d8 }));
        front.position.z = 0.007;
        var back = new T.Mesh(new T.PlaneGeometry(c.w, c.h), new T.MeshBasicMaterial({ map: cardBack(c), color: 0xe9e3d8 }));
        back.rotation.y = Math.PI;
        back.position.z = -0.007;
        hold.add(front, back);
        var edge = box(c.w + 0.02, c.h + 0.02, 0.01, mat(0xd8d1c4, { roughness: 0.5 }), 0, 0, 0, hold);
        box(0.16, 0.07, 0.03, mat(C.metal, { metalness: 0.6, roughness: 0.4 }), 0, c.h / 2 + 0.03, 0, hold);   // clip
        [front, back, edge].forEach(function (m) { m.userData.card = i; cardMeshes.push(m); });
        entry.hold = hold;
      }
      cardEntries.push(entry);
    });

    var selectedCard = -1;
    function tweenTo(target, props, opts) {
      if (window.gsap) gsap.to(target, Object.assign({ duration: 0.9, ease: 'power3.inOut', overwrite: true }, opts || {}, props));
      else Object.assign(target, props);
    }
    function setCard(i, open) {
      var e = cardEntries[i];
      if (!e) return;
      e.flipped = open;
      if (e.c.medal) {
        if (open && window.gsap) gsap.fromTo(e.kick, { z: 0.35 }, { z: 0, duration: 1.6, ease: 'elastic.out(1, 0.3)', overwrite: true });
        return;
      }
      tweenTo(e.hold.rotation, { y: open ? Math.PI : 0 });
      tweenTo(e.hold.scale, { x: open ? 1.3 : 1, y: open ? 1.3 : 1, z: open ? 1.3 : 1 });
      tweenTo(e.pivot.position, { z: open ? CARD_Z + 0.9 : CARD_Z });
    }
    function selectCard(i) {
      if (selectedCard === i) { setCard(i, false); selectedCard = -1; renderWorkPanel(); return; }
      if (selectedCard >= 0) setCard(selectedCard, false);
      selectedCard = i;
      setCard(i, true);
      renderWorkPanel();
    }
    function resetCards() {
      if (selectedCard >= 0) setCard(selectedCard, false);
      selectedCard = -1;
    }

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
      work:     { pos: [4.6, 3.95, -0.3], look: [4.6, 3.95, -5.8] },   // off-centre so the panel sits beside the board
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
      about: { title: 'About', body: 'Your story will live here. Coming in a later stage.' },
      contact: { title: 'Contact', body: 'Your phone will show how to reach you. Coming in a later stage.' }
    };

    // Work panel: the readable (and keyboard) side of the ID cards
    function esc(t) { return String(t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
    function renderWorkPanel() {
      if (current !== 'work') return;
      panelTitle.textContent = 'Work';
      var c = selectedCard >= 0 ? CARDS[selectedCard] : null;
      var html = c
        ? '<div class="room-card"><p class="room-card__kind">' + esc(c.kind) + '</p>' +
          '<h3 class="room-card__org">' + esc(c.org) + '</h3>' +
          '<p class="room-card__role">' + esc(c.role) + '</p>' +
          '<p class="room-card__period">' + esc(c.period) + '</p>' +
          (c.note ? '<p class="room-card__note">' + esc(c.note) + '</p>' : '') +
          (c.app ? '<button type="button" class="room-card__open" data-app="' + c.app + '">Read the full story and try the demo</button>' : '') +
          '</div>'
        : '<p class="room-card__hint">Click a card on the board to turn it over.</p>';
      html += '<ul class="room-cards" aria-label="Cards on the board">' + CARDS.map(function (cd, i) {
        return '<li><button type="button" data-card="' + i + '" aria-pressed="' + (i === selectedCard) + '">' + esc(cd.short) + '</button></li>';
      }).join('') + '</ul>';
      panelBody.innerHTML = html;
    }
    panelBody.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-card')) {
        var i = +b.getAttribute('data-card');
        selectCard(i);
        var again = panelBody.querySelector('[data-card="' + i + '"]');
        if (again) again.focus({ preventScroll: true });
      } else if (b.hasAttribute('data-app')) {
        openApp(b.getAttribute('data-app'), b);
      }
    });

    function syncUi(name) {
      menu.querySelectorAll('button').forEach(function (b) {
        if (b.getAttribute('data-view') === name) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      });
      var inSection = name !== 'home';
      backBtn.hidden = !inSection;
      hotspotsEl.classList.toggle('is-hidden', inSection);
      showDesk(name === 'projects');
      if (name !== 'work') resetCards();
      if (name === 'projects') {
        panel.hidden = true;
      } else if (name === 'work') {
        renderWorkPanel();
        panel.hidden = false;
        if (window.gsap) gsap.fromTo(panel, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, delay: 0.9, ease: 'power2.out' });
      } else if (inSection) {
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
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (appOpen) closeApp(true);               // first Esc closes the project, the next one steps back
      else if (current === 'work' && selectedCard >= 0) selectCard(selectedCard);   // turn the card back
      else if (current !== 'home') flyTo('home');
    }
    document.addEventListener('keydown', onKey);

    /* ---------- Projects: a desktop on the monitor, each project opens as an app ---------- */
    var ICONS = {
      bridge: '<circle cx="7" cy="9" r="3"/><circle cx="17" cy="15" r="3"/><path d="M10 10l4 4M4 19h16"/>',
      leaf: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l8-8"/>',
      scan: '<path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3"/><circle cx="12" cy="12" r="3.5"/>',
      sprout: '<path d="M12 20v-8"/><path d="M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 11c0-3 2-5 6-5 0 3-2 5-6 5z"/>',
      film: '<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4"/>',
      drop: '<path d="M12 4c3 4 6 7 6 10a6 6 0 0 1-12 0c0-3 3-6 6-10z"/>',
      cart: '<path d="M4 5h2l2 10h10l2-7H7"/><circle cx="10" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/>',
      lock: '<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
      book: '<path d="M5 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H5zM19 5h-4a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h4z"/>',
      tank: '<rect x="4" y="13" width="16" height="5" rx="2.5"/><path d="M7 13v-3h7v3M14 11h6"/>'
    };
    var PROJECTS = [
      { group: 'Research', items: [['bridge', 'Bridge', 'bridge'], ['vegetation', 'Vegetation detection', 'leaf'], ['skin', 'Skin disease detection', 'scan'], ['onboarding', 'Farmer onboarding', 'sprout']] },
      { group: 'Websites', items: [['cinema', 'Wonderland Cinemas', 'film'], ['elara', 'Elara Botanics', 'drop'], ['django-store', 'Django e\u2011commerce', 'cart'], ['password', 'Password checker', 'lock'], ['library', 'Online Library', 'book']] },
      { group: 'Game', items: [['tank-wars', 'Tank Wars 3D', 'tank']] }
    ];
    var deskUi = layer.querySelector('.room-desk');
    var app = layer.querySelector('.room-app');
    var appBody = app.querySelector('.room-app__body');
    var appTitle = app.querySelector('.room-app__title');
    var appOpen = null;           // { id, demo, placeholder, opener }

    deskUi.innerHTML =
      '<div class="room-desk__bar"><span>abrar@desk</span><span class="room-desk__clock"></span></div>' +
      '<div class="room-desk__groups">' + PROJECTS.map(function (grp) {
        return '<section class="room-desk__group"><h2>' + grp.group + '</h2><ul>' + grp.items.map(function (it) {
          var src = document.getElementById(it[0]);
          if (!src) return '';
          return '<li><button type="button" class="room-desk__icon" data-project="' + it[0] + '" data-field="' + (src.getAttribute('data-field') || '1') + '">' +
            '<span class="room-desk__glyph"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[it[2]] + '</svg></span>' +
            '<span class="room-desk__name">' + it[1] + '</span></button></li>';
        }).join('') + '</ul></section>';
      }).join('') + '</div>' +
      '<p class="room-desk__hint">Click a project to open it.</p>';

    var clockEl = deskUi.querySelector('.room-desk__clock');
    function tickClock() {
      try {
        clockEl.textContent = 'Dhaka ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' });
      } catch (err) { clockEl.textContent = 'Dhaka'; }
    }
    tickClock();
    var clockTimer = setInterval(tickClock, 30000);

    deskUi.addEventListener('click', function (e) {
      var b = e.target.closest('.room-desk__icon');
      if (b) openApp(b.getAttribute('data-project'), b);
    });

    // A copy of the project's write-up, without ids or the scroll-animation leftovers
    function cleanCopy(node) {
      var c = node.cloneNode(true);
      [c].concat(Array.prototype.slice.call(c.querySelectorAll('*'))).forEach(function (el) {
        el.removeAttribute('id');
        el.removeAttribute('style');
        el.removeAttribute('aria-labelledby');
        el.removeAttribute('data-reveal');
        if (el.classList) el.classList.remove('is-pinned', 'is-active');
      });
      return c;
    }

    function openApp(id, opener) {
      var src = document.getElementById(id);
      if (!src) return;
      if (appOpen) closeApp(false);
      appBody.innerHTML = '';
      appBody.setAttribute('data-field', src.getAttribute('data-field') || '1');
      var cover = src.querySelector('.chapter-cover');
      var story = src.querySelector('.story');
      if (cover) appBody.appendChild(cleanCopy(cover));
      if (story) appBody.appendChild(cleanCopy(story));
      // The demo itself is moved, not copied, so its controls keep working; it goes back on close
      var demo = src.querySelector('.demo');
      var placeholder = null;
      if (demo) {
        placeholder = document.createComment('demo-home');
        demo.parentNode.insertBefore(placeholder, demo);
        appBody.appendChild(demo);
      }
      var title = src.querySelector('.chapter-cover__title');
      appTitle.textContent = title ? title.textContent.trim() : id;
      appOpen = { id: id, demo: demo, placeholder: placeholder, opener: opener };
      app.hidden = false;
      backBtn.hidden = true;
      appBody.scrollTop = 0;
      if (window.gsap) {
        var r = opener ? opener.getBoundingClientRect() : null;
        var a = app.getBoundingClientRect();
        var ox = r ? (r.left + r.width / 2 - a.left) + 'px' : '50%';
        var oy = r ? (r.top + r.height / 2 - a.top) + 'px' : '50%';
        gsap.fromTo(app, { autoAlpha: 0, scale: 0.6, transformOrigin: ox + ' ' + oy },
          { autoAlpha: 1, scale: 1, duration: 0.55, ease: 'power3.out', clearProps: 'transform' });
      }
      window.dispatchEvent(new Event('resize'));    // demos size their canvases to the new spot
      app.querySelector('.room-app__close').focus({ preventScroll: true });
    }

    function closeApp(returnFocus) {
      if (!appOpen) return;
      var o = appOpen;
      appOpen = null;
      if (o.demo && o.placeholder && o.placeholder.parentNode) {
        o.placeholder.parentNode.insertBefore(o.demo, o.placeholder);
        o.placeholder.remove();
      }
      app.hidden = true;
      appBody.innerHTML = '';
      backBtn.hidden = current === 'home';
      if (returnFocus && o.opener && current === 'projects') o.opener.focus({ preventScroll: true });
    }

    app.querySelector('.room-app__close').addEventListener('click', function () { closeApp(true); });
    app.querySelector('.room-app__home').addEventListener('click', function () { closeApp(true); });

    function showDesk(on) {
      if (on) {
        deskUi.hidden = false;
        if (window.gsap) gsap.fromTo(deskUi, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45, delay: 1.05, ease: 'power2.out' });
      } else {
        if (window.gsap && gsap.killTweensOf) gsap.killTweensOf(deskUi);
        deskUi.hidden = true;
        closeApp(false);
      }
    }

    // Keep the HTML desktop glued to the monitor's glass
    var SCREEN_CORNERS = [[-1.48, 3.71, -2.585], [0.88, 3.71, -2.585], [-1.48, 2.35, -2.585], [0.88, 2.35, -2.585]];
    function placeDesk(w, h) {
      if (deskUi.hidden) return;
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      SCREEN_CORNERS.forEach(function (c) {
        tmp.set(c[0], c[1], c[2]).project(camera);
        var px = (tmp.x * 0.5 + 0.5) * w, py = (-tmp.y * 0.5 + 0.5) * h;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      });
      if (!isFinite(x0)) return;
      deskUi.style.left = x0 + 'px';
      deskUi.style.top = y0 + 'px';
      deskUi.style.width = (x1 - x0) + 'px';
      deskUi.style.height = (y1 - y0) + 'px';
      deskUi.style.fontSize = ((x1 - x0) / 46) + 'px';
    }

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
    function pickCard(clientX, clientY) {
      var r = canvas.getBoundingClientRect();
      pointer.x = ((clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      var hits = raycaster.intersectObjects ? raycaster.intersectObjects(cardMeshes, false) : [];
      return hits.length ? hits[0].object.userData.card : -1;
    }

    function onDown(e) { dragging = true; moved = 0; dragX = e.clientX; dragY = e.clientY; canvas.style.cursor = 'grabbing'; }
    function onMove(e) {
      if (dragging && current === 'home') {
        moved += Math.abs(e.clientX - dragX) + Math.abs(e.clientY - dragY);
        yawTarget = Math.max(-0.25, Math.min(0.25, yawTarget - (e.clientX - dragX) * 0.003));
        pitchTarget = Math.max(-0.08, Math.min(0.08, pitchTarget + (e.clientY - dragY) * 0.0015));
        dragX = e.clientX; dragY = e.clientY;
      } else if (!dragging) {
        var over = current === 'home' ? !!pickAt(e.clientX, e.clientY) : current === 'work' && pickCard(e.clientX, e.clientY) >= 0;
        canvas.style.cursor = over ? 'pointer' : 'grab';
      }
    }
    function onUp(e) {
      dragging = false;
      canvas.style.cursor = 'grab';
      if (moved < 6 && current === 'home') {
        var hit = pickAt(e.clientX, e.clientY);
        if (hit) flyTo(hit);
      } else if (moved < 6 && current === 'work' && e.target === canvas) {
        var ci = pickCard(e.clientX, e.clientY);
        if (ci >= 0) selectCard(ci);
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
      moveTraffic(dt);                                     // cars on the expressway
      cardEntries.forEach(function (ce, i) {               // ID cards sway a little in the fan's breeze
        ce.pivot.rotation.z = (ce.flipped && !ce.c.medal ? 0 : Math.sin(t * 0.9 + i * 1.7) * 0.03) + ce.kick.z;
      });

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
      placeDesk(W, H);
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
        closeApp(false);                      // put any open demo back on the flat page
        clearInterval(clockTimer);
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
