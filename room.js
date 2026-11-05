/* =========================================================
   Abrar Sami Khan, portfolio
   room.js: the explorable 3D room, on desktop and phones.
   Reduced motion, no-WebGL browsers, and anyone who picks
   "Flat version" get the regular site in index.html instead.

   Add ?flat to the URL to skip the room, or ?room to force it.
   ========================================================= */
(function () {
  'use strict';

  var THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js';
  var ROOM_ENABLED_BY_DEFAULT = true;    // desktop visitors land in the room

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

  var capable = !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    webglAvailable();
  var wanted = params.has('room') || (ROOM_ENABLED_BY_DEFAULT && !prefersFlat() && !params.has('flat'));

  if (!capable) return;            // flat site only
  // "Enter the room" link in the flat site's header, for anyone who chose the flat version
  if (ROOM_ENABLED_BY_DEFAULT || params.has('room')) addEnterLink();

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

      '<p class="room__id"><strong>Abrar Sami Khan</strong><span class="room__role">Analytics, Automation &amp; ML</span>' +
      '<span class="room__place"><svg viewBox="0 0 12 16" aria-hidden="true"><path d="M6 0a6 6 0 0 0-6 6c0 4.5 6 10 6 10s6-5.5 6-10a6 6 0 0 0-6-6zm0 8.2A2.2 2.2 0 1 1 6 3.8a2.2 2.2 0 0 1 0 4.4z"/></svg>Dhaka</span></p>' +
      '<div class="room__top">' +
        '<div class="room__actions">' +
          '<button class="room__flat" type="button">Flat version</button>' +
        '</div>' +
      '</div>' +

      '<button class="room__back" type="button" hidden>Step back <kbd>Esc</kbd></button>' +

      '<section class="room__panel" hidden aria-live="polite">' +
        '<h2 class="room__panel-title"></h2>' +
        '<div class="room__panel-body"></div>' +
      '</section>' +

      '<div class="room-desk" hidden></div>' +
      '<div class="room-phone" hidden></div>' +
      '<section class="room-music" hidden aria-label="Music player">' +
        '<header class="room-music__head">' +
          '<div class="room-music__now"><p class="room-music__kicker">Now playing</p><p class="room-music__track">Nothing yet</p></div>' +
          '<button class="room-music__mini" type="button" aria-label="Shrink to mini player"><span aria-hidden="true">&#8600;</span></button>' +
          '<button class="room-music__stop" type="button" aria-label="Stop music and close">&times;</button>' +
        '</header>' +
        '<div class="room-music__screen"><div class="room-music__player"></div></div>' +
        '<div class="room-music__side">' +
          '<p class="room-music__track room-music__track--mini">Nothing yet</p>' +
          '<div class="room-music__controls">' +
            '<button class="room-music__prev" type="button" aria-label="Previous">&#9198;</button>' +
            '<button class="room-music__play" type="button" aria-label="Play">&#9654;</button>' +
            '<button class="room-music__next" type="button" aria-label="Next">&#9197;</button>' +
          '</div>' +
          '<div class="room-music__minibar">' +
            '<button class="room-music__expand" type="button" aria-label="Open the music player"><span aria-hidden="true">&#8598;</span></button>' +
            '<button class="room-music__stop room-music__stop--mini" type="button" aria-label="Stop music and close">&times;</button>' +
          '</div>' +
        '</div>' +
        '<div class="room-music__body">' +
          '<form class="room-music__search" role="search">' +
            '<input type="search" name="q" placeholder="Search YouTube for a song or artist" aria-label="Search YouTube for music" autocomplete="off" maxlength="80">' +
            '<button type="submit">Search</button>' +
          '</form>' +
          '<button class="room-music__mine" type="button" hidden>&#9835; Play my playlist</button>' +
          '<p class="room-music__status" role="status" aria-live="polite"></p>' +
          '<ul class="room-music__results" data-lenis-prevent></ul>' +
          '<p class="room-music__note">Music plays through YouTube.</p>' +
        '</div>' +
      '</section>' +
      '<section class="room-book" hidden aria-labelledby="room-book-title"></section>' +
      '<div class="room-app" role="dialog" aria-modal="true" aria-labelledby="room-app-title" hidden>' +
        '<div class="room-app__bar">' +
          '<button class="room-app__home" type="button"><span aria-hidden="true">&larr;</span> Desktop</button>' +
          '<p class="room-app__title" id="room-app-title"></p>' +
          '<button class="room-app__close" type="button" aria-label="Close project">&times;</button>' +
        '</div>' +
        '<div class="room-app__body" data-lenis-prevent tabindex="-1"></div>' +
      '</div>' +

      '<p class="room__hint" hidden>' + (window.matchMedia('(pointer: coarse)').matches
        ? 'Pinch to zoom, drag to look around. Tap a glowing diamond, or use the menu below.'
        : 'Drag to look around, scroll to zoom. Click a glowing diamond, or use the menu below.') + '</p>' +

      '<nav class="room__menu" aria-label="Room">' +
        '<button type="button" data-view="projects"><span class="room__num">01</span> Projects</button>' +
        '<button type="button" data-view="work"><span class="room__num">02</span> Work</button>' +
        '<button type="button" data-view="about"><span class="room__num">03</span> About</button>' +
        '<button type="button" data-view="contact"><span class="room__num">04</span> Contact</button>' +
      '</nav>' +

      '<div class="room__loader" role="status">' +
        '<div class="room__terminal">' +
          '<p class="room__cmd">abrar@dhaka:~$ <span>./open-room --city dhaka --time night</span></p>' +
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
    'lighting up Dhaka at night',
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
      setTimeout(function () { reject(new Error('three.js took too long')); }, 15000);   // slow network: use the flat site
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
    setFlatInert(true);

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

  // While the room is open, keyboard and screen readers stay in the room, not the page behind it
  function setFlatInert(on) {
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el === layer || el.tagName === 'SCRIPT') return;
      if (on) el.setAttribute('inert', '');
      else el.removeAttribute('inert');
    });
  }

  function leaveRoom() {
    if (world) world.dispose();
    world = null;
    if (layer) layer.remove();
    layer = null;
    setFlatInert(false);
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

    // Night palette: charcoal-blue room, cool moonlight, cyan neon accents
    var C = {
      wall: 0x2f374a,
      wallDark: 0x282f40,
      desk: 0x20242e,
      deskTop: 0x2a303b,
      metal: 0x171a21,
      board: 0x1c2029,
      paper: 0xece6da,
      neon: 0x19d9ff,       // cyan neon
      violet: 0x5b8cff,
      marigold: 0xe9c14a,
      teal: 0x2f7d77
    };

    // Phones and tablets get a lighter render: lower resolution and no shadows
    var light = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900;
    var renderer = new T.WebGLRenderer({ antialias: !light, powerPreference: light ? 'low-power' : 'default' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, light ? 1.5 : 2));
    renderer.shadowMap.enabled = !light;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setClearColor(0x141219, 1);
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

    /* ---------- Lights: night in the room ---------- */
    var hemi = new T.HemisphereLight(0xdbe6f4, 0x2a3038, 1.4);      // soft night fill; the clock brightens it by day
    scene.add(hemi);

    var sunset = new T.DirectionalLight(0xb4ccff, 0.75);              // cool moonlight through the window
    sunset.position.set(-14, 8.5, 3);
    sunset.castShadow = true;
    sunset.shadow.bias = -0.0006;
    if ('normalBias' in sunset.shadow) sunset.shadow.normalBias = 0.03;
    sunset.shadow.mapSize.width = 2048;
    sunset.shadow.mapSize.height = 2048;
    sunset.shadow.camera.left = -12; sunset.shadow.camera.right = 12;
    sunset.shadow.camera.top = 12; sunset.shadow.camera.bottom = -12;
    scene.add(sunset);

    var lamp = new T.PointLight(0x7fe9ff, 1.5, 8, 2);               // cyan desk lamp
    lamp.position.set(1.45, 2.8, -2.55);
    lamp.castShadow = true;
    if (lamp.shadow) lamp.shadow.bias = -0.003;
    scene.add(lamp);

    // Neon glow from the desk edge and the board frame, a soft wall light over the shelf, and the fan light
    var neonLights = [];
    [[0.1, 1.3, -0.7, 0x19d9ff, 1.0, 5], [3.6, 4.2, -4.9, 0x19d9ff, 1.1, 6], [-4.4, 6.2, -5.1, 0x7fa6ff, 0.6, 6]].forEach(function (p) {
      var l = new T.PointLight(p[3], p[4], p[5], 2);
      l.position.set(p[0], p[1], p[2]);
      scene.add(l);
      neonLights.push({ l: l, base: p[4] });
    });
    // Cool glow pooling on the floor: light spilling in by the window, and a soft room light
    [[-5.2, 1.4, 0.2, 0xcfe0f5, 1.0, 7], [3.5, 5.6, 3.5, 0xdfeaff, 0.7, 16], [6.4, 2.6, 2.0, 0xcfe0f5, 0.55, 6]].forEach(function (p) {
      var l = new T.PointLight(p[3], p[4], p[5], 2);
      l.position.set(p[0], p[1], p[2]);
      scene.add(l);
    });
    var fanLight = new T.PointLight(0xe6f0ff, 0.5, 14, 2);
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

    // Dark herringbone parquet
    var floorTex = canvasTex(1024, 1024, function (g, w, h) {
      g.fillStyle = '#161a22'; g.fillRect(0, 0, w, h);
      // Chevron parquet: columns of slanted planks that meet in a V
      var cw = 128, W = 32, tones = ['#363c4d', '#3e4557', '#2f3544', '#434a5d', '#343a4a', '#3b4253'];
      for (var c = 0; c < w / cw; c++) {
        var x0 = c * cw, slope = c % 2 ? cw : -cw;
        for (var y = -cw - W; y < h + cw; y += W) {
          g.fillStyle = tones[Math.floor(rnd() * tones.length)];
          var y0 = c % 2 ? y : y + cw;
          g.beginPath();
          g.moveTo(x0, y0); g.lineTo(x0 + cw, y0 + slope); g.lineTo(x0 + cw, y0 + slope + W - 2); g.lineTo(x0, y0 + W - 2);
          g.closePath(); g.fill();
        }
      }
      // fine grain streaks along the planks
      g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1;
      for (var gr = 0; gr < 900; gr++) {
        var gx = Math.random() * w, gy = Math.random() * h, sl = (Math.floor(gx / cw) % 2 ? 1 : -1);
        g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + 18, gy + sl * 18); g.stroke();
      }
    });
    if (floorTex.wrapS !== undefined) { floorTex.wrapS = floorTex.wrapT = T.RepeatWrapping; if (floorTex.repeat) floorTex.repeat.set(3, 3); }
    var floor = new T.Mesh(new T.PlaneGeometry(RW, RD), new T.MeshStandardMaterial({ map: floorTex, roughness: 0.55 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(CX, 0, CZ);
    floor.receiveShadow = true;
    scene.add(floor);

    // Rug: charcoal-blue with pale grey bands and a thin cyan line, like a frame around the desk
    var rugTex = canvasTex(1024, 1024, function (g, w, h) {
      g.fillStyle = '#1a2030'; g.fillRect(0, 0, w, h);
      [[24, 26, '#6f7c98'], [70, 10, '#1a2030'], [92, 16, '#a9b6cf'], [128, 4, '#4fe3ff'], [150, 40, '#252c3c']].forEach(function (b) {
        g.strokeStyle = b[2]; g.lineWidth = b[1];
        g.strokeRect(b[0], b[0], w - b[0] * 2, h - b[0] * 2);
      });
      g.strokeStyle = 'rgba(160,180,215,0.35)'; g.lineWidth = 6;             // a faint diamond in the middle
      g.beginPath(); g.moveTo(w / 2, 240); g.lineTo(w - 240, h / 2); g.lineTo(w / 2, h - 240); g.lineTo(240, h / 2); g.closePath(); g.stroke();
    });
    var rug = new T.Mesh(new T.PlaneGeometry(7, 7), new T.MeshStandardMaterial({ map: rugTex, roughness: 1 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0.4, 0.012, -0.6);
    rug.receiveShadow = true;
    scene.add(rug);

    // Walls: dark grey panels with fine seams
    var panelCanvas = document.createElement('canvas');
    panelCanvas.width = 256; panelCanvas.height = 256;
    (function (g, w, h) {
      var pg = g.createLinearGradient(0, 0, w, h);
      pg.addColorStop(0, '#2e3648'); pg.addColorStop(1, '#262d3d');
      g.fillStyle = pg; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
      g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(3, 3, w - 3, 2); g.fillRect(3, 3, 2, h - 3);
    })(panelCanvas.getContext('2d'), 256, 256);
    function panelMat(across, up) {
      var t = new T.CanvasTexture(panelCanvas);
      if (t.repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(across, up); }
      return new T.MeshStandardMaterial({ map: t, roughness: 0.85 });
    }
    var wallM = panelMat(9, 3), wallDarkM = panelMat(1.2, 3);
    box(RW + 0.6, RH, 0.3, wallM, CX, RH / 2, RZ0);                  // back wall
    box(0.3, RH, RD, panelMat(8, 3), RX1, RH / 2, CZ);                  // right wall
    box(RW + 0.6, RH, 0.3, wallM, CX, RH / 2, RZ1);                   // front wall (behind the camera)
    box(RW + 0.6, 0.3, RD + 0.6, mat(0x161b25, { roughness: 1 }), CX, RH + 0.15, CZ);  // ceiling
    // Skirting along the walls
    box(RW, 0.25, 0.08, mat(0x161a22), CX, 0.125, RZ0 + 0.18);
    box(0.08, 0.25, RD, mat(0x161a22), RX0 + 0.18, 0.125, CZ);

    // Left wall (x = -8), built around a window opening from z -3 to 3, y 1.6 to 5.6
    box(0.3, RH, 3.0, wallDarkM, RX0, RH / 2, -4.5);
    box(0.3, RH, RZ1 - 3, panelMat(4.4, 3), RX0, RH / 2, (3 + RZ1) / 2);
    box(0.3, 1.6, 6.0, panelMat(2.4, 0.65), RX0, 0.8, 0);
    box(0.3, RH - 5.6, 6.0, panelMat(2.4, 0.75), RX0, (5.6 + RH) / 2, 0);
    /* Window: a slim dark frame set into the wall, a roller-blind box across the top,
       a centre bar, and two casement sashes pushed open outwards over the street */
    var frameM = mat(0x2a303d, { roughness: 0.5, metalness: 0.2 });
    var glassM = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.05, depthWrite: false, side: T.DoubleSide });
    function glass(wz, hy, x, y, z, parent) {
      var g = new T.Mesh(new T.PlaneGeometry(wz, hy), glassM);
      g.rotation.y = Math.PI / 2;
      g.position.set(x, y, z);
      g.renderOrder = 4;                                                 // after the city layers, so they show through
      (parent || scene).add(g);
      return g;
    }
    var revealM = mat(0x1f2430, { roughness: 0.8 });
    // dark lining on the inside faces of the opening
    box(0.3, 0.02, 6.0, revealM, RX0, 5.59, 0);
    box(0.3, 4.0, 0.02, revealM, RX0, 3.6, -2.99);
    box(0.3, 4.0, 0.02, revealM, RX0, 3.6, 2.99);
    // slim trim around the opening on the room side
    box(0.05, 0.1, 6.2, frameM, RX0 + 0.17, 5.65, 0);
    box(0.05, 4.1, 0.1, frameM, RX0 + 0.17, 3.6, -3.05);
    box(0.05, 4.1, 0.1, frameM, RX0 + 0.17, 3.6, 3.05);
    // a thin sill that just steps out from the wall
    box(0.42, 0.07, 6.35, mat(0x363d4d, { roughness: 0.45 }), RX0 + 0.2, 1.58, 0);
    box(0.02, 0.07, 6.35, mat(0x4a5468, { roughness: 0.4 }), RX0 + 0.41, 1.58, 0);   // lit front edge
    // the fixed frame in the opening, with one full-height bar down the middle
    box(0.12, 0.1, 6.0, frameM, RX0, 5.53, 0);                          // head
    box(0.12, 0.1, 6.0, frameM, RX0, 1.67, 0);                          // bottom rail
    box(0.12, 3.96, 0.1, frameM, RX0, 3.6, -2.95);                      // jambs
    box(0.12, 3.96, 0.1, frameM, RX0, 3.6, 2.95);
    box(0.12, 3.76, 0.12, frameM, RX0, 3.6, 0);                         // centre bar
    // Roller-blind box across the top, a little wider than the window, with end caps
    var blindM = mat(0x434b5e, { roughness: 0.55, metalness: 0.1 });
    var bx0 = RX0 + 0.4, by0 = 5.92, BLEN = 8.9;
    box(0.46, 0.3, BLEN, blindM, bx0, by0, 0);                          // housing (the curtains hang from inside it)
    box(0.03, 0.02, BLEN, mat(0x66728c, { roughness: 0.4 }), bx0 + 0.23, by0 + 0.14, 0);   // light catching the top edge
    [-1, 1].forEach(function (sd) {
      box(0.5, 0.34, 0.05, mat(0x353c4c, { roughness: 0.5 }), bx0, by0, sd * (BLEN / 2 + 0.02));   // end caps
    });
    cyl(0.05, 0.05, 0.06, mat(0x353c4c), bx0, by0, BLEN / 2 + 0.07, scene, 16).rotation.x = Math.PI / 2;   // bracket knob on the end
    // Curtains drawn back to either side: soft grey fabric with deep folds
    var curtainTex = canvasTex(256, 64, function (g, w, h) {
      var cg = g.createLinearGradient(0, 0, w, 0);
      for (var f = 0; f <= 8; f++) cg.addColorStop(f / 8, f % 2 ? '#8591ab' : '#566178');
      g.fillStyle = cg; g.fillRect(0, 0, w, h);
    });
    var curtainM = new T.MeshStandardMaterial({ map: curtainTex, roughness: 0.95, side: T.DoubleSide });
    [[2.95, 4.35], [-4.35, -2.95]].forEach(function (cz) {
      var cw2 = cz[1] - cz[0], chh = 5.0;
      var geo = new T.PlaneGeometry(cw2, chh, 32, 1);
      if (geo.attributes && geo.attributes.position) {                   // pleat the fabric
        var pos = geo.attributes.position;
        for (var v = 0; v < pos.count; v++) {
          var u = (pos.getX(v) + cw2 / 2) / cw2;
          pos.setZ(v, Math.sin(u * Math.PI * 8) * 0.09 + (pos.getY(v) < 0 ? Math.sin(u * Math.PI * 8) * 0.03 : 0));
        }
        geo.computeVertexNormals();
      }
      var cur = new T.Mesh(geo, curtainM);
      cur.rotation.y = Math.PI / 2;
      cur.position.set(RX0 + 0.42, by0 - chh / 2 + 0.05, (cz[0] + cz[1]) / 2);
      cur.castShadow = true; cur.receiveShadow = true;
      scene.add(cur);
    });
    // Two casement sashes, each hinged on its outer jamb and swung OUT over the street
    function casement(hingeZ, dir, angle) {
      var s = new T.Group();
      s.position.set(RX0 - 0.08, 3.6, hingeZ);
      s.rotation.y = -dir * angle;                                       // free edge moves outside (towards -x)
      scene.add(s);
      var W = 2.76, H = 3.68;
      box(0.06, 0.08, W, frameM, 0, H / 2 - 0.045, dir * W / 2, s);     // top rail
      box(0.06, 0.08, W, frameM, 0, -H / 2 + 0.045, dir * W / 2, s);    // bottom rail
      box(0.06, H, 0.08, frameM, 0, 0, dir * 0.045, s);                 // hinge stile
      box(0.06, H, 0.08, frameM, 0, 0, dir * (W - 0.045), s);           // free stile
      box(0.09, 0.2, 0.03, mat(0xb9b4c4, { metalness: 0.6, roughness: 0.35 }), 0.05, 0, dir * (W - 0.12), s);   // handle
      glass(W - 0.16, H - 0.16, 0, 0, dir * W / 2, s);
      return s;
    }
    casement(-2.88, 1, 0.5);                                           // left sash
    casement(2.88, -1, 0.72);                                           // right sash
    var windowGlow = new T.PointLight(0xb8c8ff, 0.95, 9, 2);              // the city's glow spilling in
    windowGlow.position.set(RX0 + 1.2, 3.6, 0);
    scene.add(windowGlow);

    /* ---------- Dhaka's clock and seasons ----------
       The room follows the time in Dhaka. Add ?time=22:30 (and ?season=shit) to the address to look at any moment.
       Only Hemonto has its own look so far; the other ritu borrow it, with their own sunrise and sunset. */
    var RITU = {
      grishmo: { sr: 5.55, ss: 18.35 }, borsha: { sr: 5.4, ss: 18.65 }, shorot: { sr: 5.75, ss: 18.0 },
      hemonto: { sr: 6.15, ss: 17.3 }, shit: { sr: 6.6, ss: 17.45 }, boshonto: { sr: 6.1, ss: 18.0 }
    };
    function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
    function hexRGB(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
    function mixc(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
    function rgbS(c) { return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'; }
    function rgbaS(c, a) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + a.toFixed(3) + ')'; }
    function dhakaClock() {
      var o = {};
      try {
        new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: 'numeric', minute: 'numeric', hour12: false, day: 'numeric', month: 'numeric' })
          .formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
      } catch (err) {
        var dd = new Date(Date.now() + 6 * 3600000);
        o = { hour: dd.getUTCHours(), minute: dd.getUTCMinutes(), day: dd.getUTCDate(), month: dd.getUTCMonth() + 1 };
      }
      var md = (+o.month) * 100 + (+o.day), id;       // the six ritu, split near the middle of each month
      if (md >= 1015 && md <= 1214) id = 'hemonto'; else if (md >= 1215 || md <= 213) id = 'shit'; else if (md >= 214 && md <= 413) id = 'boshonto';
      else if (md >= 414 && md <= 614) id = 'grishmo'; else if (md >= 615 && md <= 814) id = 'borsha'; else id = 'shorot';
      return { hours: ((+o.hour) % 24) + (+o.minute) / 60, ritu: id, fixed: false };
    }
    var testClock = null;                                   // set by the TIME TEST panel below
    function clockNow() {
      var c = dhakaClock(), q = params.get('time'), sId = params.get('season');
      if (q) { var mm = /^(\d{1,2})(?::(\d{2}))?$/.exec(q); if (mm) { c.hours = clamp(+mm[1] + (+mm[2] || 0) / 60, 0, 23.99); c.fixed = true; } }
      if (sId && RITU[sId]) c.ritu = sId;
      if (testClock) { c.hours = testClock.hours; c.ritu = testClock.ritu; c.fixed = true; }
      return c;
    }
    // Sky colours (top, middle, horizon) and how many stars show, at moments relative to sunrise and sunset
    var KEY = {
      N:    { t: hexRGB('#04061a'), m: hexRGB('#1b1659'), h: hexRGB('#5a2f7c'), s: 1 },      // the moonlit night
      PRE:  { t: hexRGB('#0b1235'), m: hexRGB('#2a2a6a'), h: hexRGB('#6a4a8a'), s: 0.8 },
      RISE: { t: hexRGB('#4a6ab0'), m: hexRGB('#f0a4a0'), h: hexRGB('#ffd08a'), s: 0 },
      MORN: { t: hexRGB('#5b94d6'), m: hexRGB('#9ec8ee'), h: hexRGB('#f6e2c0'), s: 0 },
      NOON: { t: hexRGB('#3f86d8'), m: hexRGB('#78b6ee'), h: hexRGB('#cde6f6'), s: 0 },
      AFT:  { t: hexRGB('#4a8ad4'), m: hexRGB('#86bbe8'), h: hexRGB('#e6e2c8'), s: 0 },
      GOLD: { t: hexRGB('#5a78c0'), m: hexRGB('#f0b27a'), h: hexRGB('#ffcf86'), s: 0 },
      SET:  { t: hexRGB('#3b3f8a'), m: hexRGB('#e5708a'), h: hexRGB('#ffa36a'), s: 0.05 },
      DUSK: { t: hexRGB('#171c52'), m: hexRGB('#6a3a86'), h: hexRGB('#d46a8a'), s: 0.6 }
    };
    var LOOKS = { hemonto: 1, borsha: 1, grishmo: 1, shorot: 1, shit: 1, boshonto: 1 };                       // the ritu that have their own look so far
    function moodAt(hours, ritu) {
      var R = RITU[ritu] || RITU.hemonto, sr = R.sr, ss = R.ss, noon = (sr + ss) / 2;
      var ks = [[0, 'N'], [sr - 1, 'N'], [sr - 0.4, 'PRE'], [sr + 0.25, 'RISE'], [sr + 1.5, 'MORN'], [noon, 'NOON'], [ss - 2, 'AFT'], [ss - 0.6, 'GOLD'], [ss + 0.1, 'SET'], [ss + 0.8, 'DUSK'], [ss + 1.5, 'N'], [24, 'N']];
      var i = 0; while (i < ks.length - 2 && hours > ks[i + 1][0]) i++;
      var a = ks[i], b = ks[i + 1], k = clamp((hours - a[0]) / (b[0] - a[0] || 1), 0, 1), A = KEY[a[1]], B = KEY[b[1]];
      var c = { t: mixc(A.t, B.t, k), m: mixc(A.m, B.m, k), h: mixc(A.h, B.h, k), s: A.s + (B.s - A.s) * k };
      var look = LOOKS[ritu] ? ritu : 'hemonto', dayK = 1 - c.s;      // seasons without their own look borrow Hemonto's
      if (look === 'hemonto') {                                      // a little soft gold in the daylight
        var gold = [255, 210, 150];
        c.t = mixc(c.t, gold, 0.1 * dayK); c.m = mixc(c.m, gold, 0.1 * dayK); c.h = mixc(c.h, gold, 0.1 * dayK);
      }
      if (look === 'borsha') {                                       // low grey cloud by day, dark slate cloud by night
        var kd = 0.62 * dayK, kn = 0.5 * c.s;
        ['t', 'm', 'h'].forEach(function (q) { c[q] = mixc(mixc(c[q], [112, 120, 134], kd), [34, 38, 58], kn); });
      }
      if (look === 'shorot') {                                       // clear washed air: a deeper blue sky with big white clouds
        c.t = mixc(c.t, [40, 120, 226], 0.5 * dayK); c.m = mixc(c.m, [118, 188, 246], 0.45 * dayK); c.h = mixc(c.h, [236, 245, 252], 0.4 * dayK);
      }
      if (look === 'shit') {                                         // cold grey-white air
        c.t = mixc(c.t, [190, 202, 214], 0.6 * dayK); c.m = mixc(c.m, [212, 220, 226], 0.7 * dayK); c.h = mixc(c.h, [232, 232, 230], 0.65 * dayK);
        c.t = mixc(c.t, [14, 22, 52], 0.25 * c.s); c.m = mixc(c.m, [34, 44, 86], 0.25 * c.s);
      }
      if (look === 'boshonto') {                                     // fresh, soft spring light with a warm pink-gold edge
        c.t = mixc(c.t, [112, 170, 226], 0.4 * dayK); c.m = mixc(c.m, [206, 228, 242], 0.5 * dayK); c.h = mixc(c.h, [255, 232, 214], 0.5 * dayK);
      }
      var storm = 0, dust = 0;
      if (look === 'grishmo') {                                      // dust haze by day; a Kalbaishakhi storm cloud builds in the afternoon and stays into the night
        var sr0 = sr, ss0 = ss;
        storm = clamp((hours - (ss0 - 3)) / 2.5, 0, 1) * (1 - 0.2 * clamp((hours - ss0 + 0.5) / 1.5, 0, 1));
        if (hours < sr0 - 0.5) storm = 0.8 * clamp((sr0 - 0.5 - hours) / 1.5 + (hours < sr0 - 2 ? 1 : 0), 0, 1);
        if (hours >= sr0 - 0.5 && hours < ss0 - 3) storm = 0;
        dust = dayK * (1 - 0.6 * storm);
        ['t', 'm', 'h'].forEach(function (q, qi) { c[q] = mixc(c[q], [216, 186, 142], [0.72, 0.84, 0.8][qi] * dust); });
        ['t', 'm'].forEach(function (q) { c[q] = mixc(mixc(c[q], [66, 54, 74], 0.7 * storm * dayK), [20, 23, 32], 0.8 * storm * c.s); });
        c.h = mixc(mixc(c.h, [226, 138, 78], 0.35 * storm * dayK), [38, 40, 54], 0.7 * storm * c.s);
      }
      var m = { c: c, d: c.s, hours: hours, ritu: ritu, look: look, storm: storm, dust: dust, starA: look === 'borsha' ? 0 : c.s * clamp(1 - 1.3 * storm, 0, 1), rain: look === 'borsha' ? 1 : 0, wet: look === 'borsha' ? 1 : 0, overcast: look === 'borsha' ? 1 : 0 };
      m.lit = clamp((m.d - 0.15) / 0.6, 0, 1);                       // city windows and lamps coming on
      if (m.overcast) m.lit = Math.max(m.lit, 0.3 * (1 - m.d));      // on a dark wet day some windows are lit already
      m.moonA = clamp((m.d - 0.5) * 2, 0, 1) * (look === 'borsha' ? 0.08 : 1 - 0.7 * storm);
      if (storm > 0) m.lit = Math.max(m.lit, 0.35 * storm);          // lamps come on under the storm cloud
      var fr = clamp((hours - sr) / (ss - sr), 0, 1);
      m.sun = { on: hours > sr - 0.2 && hours < ss + 0.2, frac: fr, alt: Math.sin(Math.PI * fr) };
      var since = hours - sr;                                        // morning mist, thickest just after sunrise
      m.mist = (1 - m.d) * (since < 0 ? 0.3 : clamp(0.34 - since * 0.04, 0.08, 0.34));
      m.mistCol = mixc([232, 232, 238], [92, 86, 132], m.d);
      if (look === 'boshonto') { m.mist = 0.1 * (1 - m.d); m.mistCol = mixc([255, 240, 232], [92, 86, 132], m.d); }   // a little morning dew haze
      if (look === 'shit') {                                         // thick fog at dawn, thinning by late morning, back again at dusk and through the night
        var fg = hours < sr ? 0.65 + 0.15 * clamp((hours - (sr - 3)) / 3, 0, 1) : Math.max(0.2 + 0.6 * clamp(1 - (hours - sr) / 4.5, 0, 1), 0.2 + 0.45 * clamp((hours - (ss - 1.5)) / 2, 0, 1));
        m.fog = fg; m.mist = fg; m.mistCol = mixc([228, 232, 236], [64, 72, 104], m.d);
      }
      if (look === 'shorot') { m.mist = 0.06 * (1 - m.d); m.mistCol = mixc([240, 246, 252], [92, 86, 132], m.d); m.cloud = 1; }   // crisp air
      if (look === 'grishmo') { m.mist = 0.3 * dust + 0.2 * storm * (1 - m.d) + (1 - m.d) * 0; m.mistCol = mixc(mixc([222, 196, 150], [96, 82, 100], storm), mixc([70, 60, 92], [44, 48, 62], storm), m.d); }   // dust haze
      if (look === 'borsha') { m.mist = 0.36 * (1 - m.d) + 0.2 * m.d; m.mistCol = mixc([172, 178, 190], [60, 58, 92], m.d); }   // rain haze all day
      return m;
    }
    function dcol(night, day, d) { return rgbS(mixc(hexRGB(day), hexRGB(night), d)); }          // night colour at d = 1
    function bcol(night, day, m, haze) {
      var col = mixc(hexRGB(day), hexRGB(night), m.d); if (haze) col = mixc(col, m.c.h, 0.2 * (1 - m.d));
      if (m.wet) col = mixc(col, mixc([88, 96, 114], [30, 34, 52], m.d), 0.35);          // wet walls
      if (m.dust) col = mixc(col, [204, 172, 128], 0.2 * m.dust);                        // dusty walls
      if (m.fog) col = mixc(col, m.mistCol, 0.5 * m.fog);                                // fog on the walls
      return rgbS(col);
    }

    /* ---------- Dhaka outside the window ----------
       Three layers at different depths so the city shifts as the camera moves. The two painted layers
       are repainted from the clock; the buildings stay exactly where they are. */
    var SKY_W = 2048, SKY_H = 1024;
    function skyLayer(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return { c: c, g: c.getContext('2d'), tex: new T.CanvasTexture(c) }; }

    function drawBuildingsRow(g, w, h, opts) {
      var x = -20, litK = opts.litK == null ? 1 : opts.litK;
      while (x < w + 20) {
        var bw = between(opts.minW, opts.maxW);
        if (opts.clear && x + bw > opts.clear[0] && x < opts.clear[1]) { x = opts.clear[1] + between(0, 20); continue; }   // keep this view open
        var top = h * between(opts.topMin, opts.topMax);
        if (opts.low && x + bw > opts.low[0] && x < opts.low[1]) top = Math.max(top, h * opts.low[2]);
        g.fillStyle = opts.colors[Math.floor(rnd() * opts.colors.length)];
        g.fillRect(x, top, bw, h - top);
        if (opts.out) opts.out.push([x, top, bw]);
        // Windows: a mix of warm bulbs and white tube lights; many dark. Which ones can light is fixed;
        // the clock decides how many of them are on.
        var cols = Math.max(2, Math.floor(bw / opts.cell));
        var rows = Math.floor((h - top) / (opts.cell * 1.25));
        var cw = bw / cols;
        for (var r = 0; r < rows; r++) {
          for (var c = 0; c < cols; c++) {
            var lit = rnd(), wx = x + c * cw + cw * 0.22, wy = top + 10 + r * opts.cell * 1.25;
            var on = false;
            if (lit < opts.lit) {
              var tone = rnd();
              if (lit < opts.lit * litK) {
                on = true;
                g.fillStyle = tone < 0.18 ? 'rgba(226,240,255,0.95)' : tone < 0.3 ? 'rgba(255,170,210,0.9)' : 'rgba(255,196,120,0.95)';
                if (opts.glow) { g.shadowColor = g.fillStyle; g.shadowBlur = opts.glow; }
                g.fillRect(wx, wy, cw * 0.56, opts.cell * 0.6);
                if (opts.glow) g.shadowBlur = 0;
              }
            }
            if (!on) {
              if (opts.glassA > 0.01) { g.fillStyle = 'rgba(30,40,90,' + opts.glassA.toFixed(3) + ')'; g.fillRect(wx, wy, cw * 0.56, opts.cell * 0.6); }   // daytime glass
              if (opts.grills) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(wx, wy, cw * 0.56, opts.cell * 0.6); }
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
            g.fillStyle = opts.acColor || 'rgba(150,140,190,0.35)';
            g.fillRect(x + between(4, bw - 26), top + between(20, h - top - 30), 22, 14);
          }
        }
        x += bw + between(0, opts.gap);
      }
    }

    // Layer 1: sky, sun and moon, stars, far skyline with a mosque
    function paintFar(g, w, h, m) {
      var c = m.c, d = m.d, day = 1 - d;
      var sk = g.createLinearGradient(0, 0, 0, h);
      sk.addColorStop(0, rgbS(c.t));
      sk.addColorStop(0.3, rgbS(mixc(c.t, c.m, 0.4)));
      sk.addColorStop(0.55, rgbS(c.m));
      sk.addColorStop(0.75, rgbS(mixc(c.m, c.h, 0.5)));
      sk.addColorStop(1, rgbS(c.h));
      g.fillStyle = sk; g.fillRect(0, 0, w, h);
      // Stars: a dense field, thickest over the window's view; a few bigger ones, some warm (drawn only when the sky is dark)
      for (var st = 0; st < 1500; st++) {
        var inView = st >= 1100;                               // the extra ones fill the strip the window shows
        var sx0 = inView ? between(w * 0.38, w * 0.68) : rnd() < 0.55 ? between(w * 0.3, w * 0.74) : between(0, w);
        var sy0 = inView ? between(h * 0.44, h * 0.62) : Math.pow(rnd(), 1.25) * h * 0.66;
        var sz = rnd() < 0.15 ? between(3, 4.5) : between(1.6, 3);
        var warm = rnd() < 0.2, sal = warm ? between(0.55, 1) : between(0.5, 1);
        if (m.starA > 0.02) {
          g.fillStyle = (warm ? 'rgba(255,225,190,' : 'rgba(225,235,255,') + (sal * m.starA).toFixed(3) + ')';
          g.fillRect(sx0, sy0, sz, sz);
        }
      }
      // A pale moon with a soft halo
      if (m.moonA > 0.02) {
        var sx = w * 0.47, sy = h * 0.505;
        var glow = g.createRadialGradient(sx, sy, 10, sx, sy, 200);
        glow.addColorStop(0, 'rgba(200,210,255,' + (0.42 * m.moonA).toFixed(3) + ')');
        glow.addColorStop(1, 'rgba(150,160,255,0)');
        g.fillStyle = glow; g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(244,241,255,' + m.moonA.toFixed(3) + ')'; g.beginPath(); g.arc(sx, sy, 40, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(150,150,205,' + (0.28 * m.moonA).toFixed(3) + ')';
        [[-12, -9, 9.5], [11, 7, 7], [-5, 15, 5.5], [14, -13, 4]].forEach(function (cr) { g.beginPath(); g.arc(sx + cr[0], sy + cr[1], cr[2], 0, Math.PI * 2); g.fill(); });
      }
      // The sun, low over the rooftops in the morning and the afternoon, high and out of frame at midday
      if (m.sun.on && day > 0.05 && !m.overcast && !(m.storm > 0.9)) {
        var sday = day * (1 - 0.9 * (m.storm || 0)) * (1 - 0.55 * (m.fog || 0)), al = m.sun.alt, sxp = w * (0.36 + 0.28 * m.sun.frac), syp = h * (0.62 - 0.22 * al);
        var scol = mixc([255, 160, 90], [255, 246, 220], Math.pow(al, 0.5));
        var sg = g.createRadialGradient(sxp, syp, 6, sxp, syp, h * 0.36);
        sg.addColorStop(0, rgbaS(scol, 0.7 * sday)); sg.addColorStop(1, rgbaS(scol, 0));
        g.fillStyle = sg; g.fillRect(0, 0, w, h);
        g.fillStyle = rgbaS(scol, sday); g.beginPath(); g.arc(sxp, syp, 44, 0, Math.PI * 2); g.fill();
      }
      // Long thin clouds
      g.fillStyle = rgbaS(mixc([255, 255, 255], [120, 100, 220], d), m.overcast ? 0 : 0.3 - 0.2 * d);
      for (var i = 0; i < 9; i++) {
        g.beginPath(); g.ellipse(between(0, w), between(h * 0.18, h * 0.5), between(120, 380), between(6, 16), 0, 0, Math.PI * 2); g.fill();
      }
      // Shit: kites in the winter sky, thin strings trailing down behind the city
      if ((m.look === 'shit' || m.look === 'boshonto') && day > 0.05) {
        var kk = 31, kkr = function () { kk = (kk * 16807) % 2147483647; return (kk - 1) / 2147483646; };
        var kites = [[0.41, 0.468, '#e63946'], [0.47, 0.5, '#ffd23f'], [0.52, 0.462, '#2ec4b6'], [0.57, 0.5, '#ff6fb5'], [0.62, 0.47, '#7b5cff'], [0.45, 0.535, '#ff9f1c'], [0.33, 0.4, '#e63946'], [0.7, 0.42, '#ffd23f'], [0.25, 0.5, '#2ec4b6'], [0.8, 0.46, '#ff6fb5']];
        (m.look === 'boshonto' ? [[0.6, 0.5, '#ff6fb5'], [0.645, 0.468, '#ffd23f'], [0.575, 0.455, '#2ec4b6']] : kites).forEach(function (kt) {
          var kx = w * kt[0], ky = h * kt[1], ks = 15 + kkr() * 9, rot = (kkr() - 0.5) * 0.7, ka = day * (1 - 0.35 * m.fog);
          g.save(); g.translate(kx, ky); g.rotate(rot); g.globalAlpha = ka;
          g.strokeStyle = 'rgba(60,60,80,0.7)'; g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(0, ks * 1.2); g.bezierCurveTo(-ks * 0.8, ks * 2.2, ks * 0.8, ks * 3.2, -ks * 0.3, ks * 4.2); g.stroke();        // the tail
          g.fillStyle = kt[2]; g.beginPath(); g.moveTo(0, -ks * 1.2); g.lineTo(ks * 0.85, 0); g.lineTo(0, ks * 1.2); g.lineTo(-ks * 0.85, 0); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.moveTo(0, -ks * 1.2); g.lineTo(0, ks * 1.2); g.moveTo(-ks * 0.85, 0); g.lineTo(ks * 0.85, 0); g.stroke();
          g.restore();
        });
      }
      // Shorot: big white cumulus drifting in a clean blue sky (warmed at sunset, faint and silvery at night)
      if (m.cloud) {
        var kr = 777, krr = function () { kr = (kr * 16807) % 2147483647; return (kr - 1) / 2147483646; };
        var gl = clamp(1 - Math.abs(m.hours - (m.sun.on ? 17.3 : 0)) / 1.6, 0, 1) * day;
        var cl = mixc(mixc([255, 255, 255], [255, 214, 190], gl * 0.7), [150, 150, 200], d), shd = mixc(mixc([196, 214, 236], [226, 170, 170], gl * 0.6), [70, 70, 120], d);
        var ca = clamp(day * 1.8, 0, 1) * 0.96;                       // opaque puffs, so no circles show; they fade out as the light goes
        for (var cu = 0; ca > 0.02 && cu < 11; cu++) {
          var ccx = cu < 3 ? w * (0.36 + krr() * 0.34) : krr() * w, ccy = cu < 3 ? h * (0.42 + krr() * 0.1) : h * (0.12 + krr() * 0.34), cs = (cu < 3 ? 0.5 : 0.8) + krr() * 0.6;
          var puffs = [];
          for (var pf = 0; pf < 7; pf++) puffs.push([ccx + (pf - 3) * 34 * cs + krr() * 14, ccy - Math.sin(pf / 6 * Math.PI) * 26 * cs - krr() * 12, (26 + krr() * 22) * cs]);
          g.fillStyle = rgbaS(shd, ca);
          puffs.forEach(function (p) { g.beginPath(); g.arc(p[0], p[1] + p[2] * 0.3, p[2], 0, Math.PI * 2); g.fill(); });
          g.fillStyle = rgbaS(cl, ca);
          puffs.forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], p[2], 0, Math.PI * 2); g.fill(); });
        }
      }
      // Borsha: a low, heavy cloud deck over the whole sky
      if (m.look === 'borsha') {
        var cr = 4242, crr = function () { cr = (cr * 16807) % 2147483647; return (cr - 1) / 2147483646; };
        var cc = mixc([96, 104, 120], [26, 30, 48], d);
        for (var q = 0; q < 26; q++) {
          var cx2 = crr() * w, cy2 = h * (0.02 + crr() * 0.5), crw = 180 + crr() * 320, crh = 40 + crr() * 70;
          g.fillStyle = rgbaS(mixc(cc, [200, 206, 220], (1 - d) * 0.25 * crr()), 0.55);
          g.beginPath(); g.ellipse(cx2, cy2, crw, crh, 0, 0, Math.PI * 2); g.fill();
        }
        var ov = g.createLinearGradient(0, 0, 0, h * 0.62); ov.addColorStop(0, rgbaS(cc, 0.75)); ov.addColorStop(1, rgbaS(cc, 0.25));
        g.fillStyle = ov; g.fillRect(0, 0, w, h * 0.62);
      }
      // Grishmo: a dark storm cloud mass building over the city, lit orange along its underside at dusk
      if (m.storm > 0.02) {
        var sr1 = 9091, srr = function () { sr1 = (sr1 * 16807) % 2147483647; return (sr1 - 1) / 2147483646; };
        var sc = mixc([92, 76, 98], [20, 23, 32], d);
        for (var q2 = 0; q2 < 34; q2++) {
          var qx = srr() * w, qy = h * (0.0 + srr() * 0.64), qw = 140 + srr() * 320, qh = 50 + srr() * 90;
          g.fillStyle = rgbaS(mixc(mixc(sc, [18, 20, 28], 0.5 * srr()), [170, 128, 124], (1 - d) * 0.3 * srr()), 0.6 * m.storm);
          g.beginPath(); g.ellipse(qx, qy, qw, qh, 0, 0, Math.PI * 2); g.fill();
        }
        var so = g.createLinearGradient(0, 0, 0, h * 0.7); so.addColorStop(0, rgbaS(sc, 0.9 * m.storm)); so.addColorStop(0.6, rgbaS(sc, 0.82 * m.storm)); so.addColorStop(1, rgbaS(sc, 0.5 * m.storm));
        g.fillStyle = so; g.fillRect(0, 0, w, h * 0.7);
        var rim = g.createLinearGradient(0, h * 0.44, 0, h * 0.64); rim.addColorStop(0, 'rgba(236,140,84,0)'); rim.addColorStop(1, rgbaS([236, 140, 84], 0.38 * m.storm * day));
        g.fillStyle = rim; g.fillRect(0, h * 0.44, w, h * 0.2);
      }
      if (m.dust > 0.02) {                                           // Grishmo: dust veil over the sky
        var dv = g.createLinearGradient(0, 0, 0, h * 0.7); dv.addColorStop(0, rgbaS([214, 184, 140], 0.3 * m.dust)); dv.addColorStop(1, rgbaS([226, 196, 150], 0.55 * m.dust));
        g.fillStyle = dv; g.fillRect(0, 0, w, h * 0.7);
      }
      // City glow on the horizon (a warm haze by day), then a distant haze line of buildings
      var hzc = mixc([255, 226, 196], [255, 150, 170], d);
      var haze = g.createLinearGradient(0, h * 0.42, 0, h * 0.78);
      haze.addColorStop(0, rgbaS(hzc, 0)); haze.addColorStop(1, rgbaS(hzc, (0.3 + 0.08 * d) * (1 - 0.6 * (m.storm || 0))));
      g.fillStyle = haze; g.fillRect(0, h * 0.42, w, h * 0.36);
      drawBuildingsRow(g, w, h, { minW: 30, maxW: 80, topMin: 0.6, topMax: 0.72, gap: 4, cell: 12, lit: 0.22, litK: m.lit, glassA: 0.2 * day,
        colors: [bcol('#2c2268', '#8d96bd', m, true), bcol('#32286f', '#848db6', m, true), bcol('#291f60', '#969fc4', m, true)], tanks: 0.4, tankColor: bcol('#241b58', '#7d86ad', m, true) });
      // Mosque: dome and two minarets, off to one side of the window view, behind the city
      var mx = w * 0.526, base = h * 0.7, k = 0.62, mosqueC = bcol('#1a1348', '#5d6694', m, true);
      g.fillStyle = mosqueC;
      g.fillRect(mx - 70 * k, base - 40 * k, 140 * k, h - base + 40 * k);
      g.beginPath(); g.arc(mx, base - 40 * k, 62 * k, Math.PI, 0); g.fill();
      g.fillRect(mx - 2, base - 40 * k - 62 * k - 14, 4, 16);
      g.beginPath(); g.arc(mx, base - 40 * k - 62 * k - 15, 4, 0, Math.PI * 2); g.fill();
      if (m.lit > 0.02) {
        g.fillStyle = 'rgba(255,214,150,' + (0.9 * m.lit).toFixed(3) + ')';                                // lit arched windows
        for (var mw = -2; mw <= 2; mw++) g.fillRect(mx + mw * 22 * k - 4 * k, base - 22 * k, 8 * k, 16 * k);
      }
      [mx - 118 * k, mx + 104 * k].forEach(function (px) {
        g.fillStyle = mosqueC;
        g.fillRect(px, base - 190 * k, 14 * k, h - base + 190 * k);
        g.beginPath(); g.arc(px + 7 * k, base - 190 * k, 11 * k, Math.PI, 0); g.fill();
        g.fillRect(px + 6 * k, base - 214 * k, 2, 16 * k);
        g.fillRect(px - 3, base - 140 * k, 14 * k + 6, 4);   // balcony ring
        if (m.lit > 0.02) for (var li = 0; li < 4; li++) {     // small evening lights on the minarets
          g.fillStyle = (li % 2 ? 'rgba(170,255,190,' : 'rgba(255,250,225,') + (0.85 * m.lit).toFixed(3) + ')';
          g.beginPath(); g.arc(px + 7 * k, base - 176 * k + li * 22 * k, 2.2, 0, Math.PI * 2); g.fill();
        }
      });
      // Mid-distance blocks, kept a little lower in front of the dome so it peeks over them
      drawBuildingsRow(g, w, h, { minW: 50, maxW: 130, topMin: 0.66, topMax: 0.8, gap: 10, cell: 16, lit: 0.4, litK: m.lit, glow: 5 * m.lit, glassA: 0.3 * day,
        colors: [bcol('#201858', '#707aa6', m, true), bcol('#261d60', '#6a749f', m, true), bcol('#1c1550', '#7d86ae', m, true)], tanks: 0.55, tankColor: bcol('#150f40', '#5e688f', m, true),
        low: [mx - 80 * k, mx + 80 * k, 0.735] });
      // Morning mist hanging over the rooftops
      if (m.mist > 0.01) {
        var mc = m.mistCol, mg = g.createLinearGradient(0, h * 0.46, 0, h * 0.82);
        mg.addColorStop(0, rgbaS(mc, 0)); mg.addColorStop(0.7, rgbaS(mc, m.mist * 0.85)); mg.addColorStop(1, rgbaS(mc, m.mist));
        g.fillStyle = mg; g.fillRect(0, h * 0.46, w, h * 0.36);
      }
    }
    var farL = skyLayer(SKY_W, SKY_H);
    var clock0 = clockNow(), mood = moodAt(clock0.hours, clock0.ritu), curMood = mood;
    var SEED_FAR = seed;                                   // the layers always repaint from the same random start, so the city never changes
    paintFar(farL.g, SKY_W, SKY_H, mood);
    var far = new T.Mesh(new T.PlaneGeometry(34, 17), new T.MeshBasicMaterial({ map: farL.tex }));
    far.position.set(RX0 - 7, 4.9, -3);
    far.rotation.y = Math.PI / 2;
    scene.add(far);

    // Twinkling stars: two sparse layers just in front of the sky that pulse out of step with each other
    var twinkle = [0, 1].map(function () {
      var tex = canvasTex(SKY_W, SKY_H, function (g, w, h) {
        for (var s = 0; s < 40; s++) {
          var tx0 = between(w * 0.38, w * 0.68), ty0 = between(h * 0.44, h * 0.6), r = between(2, 3.6);
          var tg = g.createRadialGradient(tx0, ty0, 0, tx0, ty0, r * 3);
          tg.addColorStop(0, 'rgba(255,255,255,0.95)'); tg.addColorStop(0.3, 'rgba(210,225,255,0.3)'); tg.addColorStop(1, 'rgba(210,225,255,0)');
          g.fillStyle = tg; g.fillRect(tx0 - r * 3, ty0 - r * 3, r * 6, r * 6);
          g.fillStyle = '#fff'; g.beginPath(); g.arc(tx0, ty0, r * 0.55, 0, Math.PI * 2); g.fill();
          if (s % 4 === 0) { g.fillRect(tx0 - r * 3, ty0 - 0.5, r * 6, 1); g.fillRect(tx0 - 0.5, ty0 - r * 3, 1, r * 6); }   // a little glint
        }
      });
      var tm = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      var tp = new T.Mesh(new T.PlaneGeometry(34, 17), tm);
      tp.position.set(RX0 - 6.9, 4.9, -3);
      tp.rotation.y = Math.PI / 2;
      scene.add(tp);
      return tm;
    });
    var twinkleT = 0;

    // Layer 2: closer residential blocks with balconies and AC units
    // The expressway's height across the near layer, as a fraction of its texture (0 = top)
    function deckV(u) { return 0.6 - 0.035 * u - Math.sin(u * Math.PI) * 0.012; }
    /* Electric poles just outside the window: plain posts with two cross-arms and a
       small box, and a few long wires sagging deep between them */
    var POLE_INK = '#0a0720', RIM_A = 0.35;
    function drawPole(g, x, h, top, boxSide, boxY, armsTop, armsLow) {
      g.fillStyle = POLE_INK;
      g.beginPath();                                                   // post, barely tapered
      g.moveTo(x - 5, top); g.lineTo(x + 5, top); g.lineTo(x + 7, h); g.lineTo(x - 7, h); g.closePath(); g.fill();
      var yA = top + 16, yB = top + 46;
      g.fillRect(x - armsTop[0], yA, armsTop[0] + armsTop[1], 7);     // upper cross-arm
      g.fillRect(x - armsLow[0], yB, armsLow[0] + armsLow[1], 7);     // lower cross-arm
      g.fillRect(x + boxSide * 5 - (boxSide < 0 ? 24 : 0), top + boxY, 24, 40);   // small box on the post
      // where the wires hang from: both ends and the middle of each arm
      return [
        [x - armsTop[0] + 4, yA + 4], [x + armsTop[1] - 4, yA + 4],
        [x - armsLow[0] + 4, yB + 4], [x + armsLow[1] - 4, yB + 4], [x, yA + 6]
      ];
    }
    var wireLog = null;
    function drawWire(g, x0, y0, x1, y1, sag) {
      if (wireLog) wireLog.push([x0, y0, x1, y1, sag]);
      g.beginPath(); g.moveTo(x0, y0);
      g.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + sag * 2, x1, y1);   // control point at twice the sag
      g.stroke();
    }
    // A faint rim along each wire, so it reads against the dark sky
    function drawWireRims(halo, wires) {
      halo.strokeStyle = 'rgba(170,150,255,' + RIM_A.toFixed(3) + ')'; halo.lineWidth = 6; halo.lineCap = 'round';
      wires.forEach(function (w) {
        halo.beginPath(); halo.moveTo(w[0], w[1]); halo.quadraticCurveTo((w[0] + w[2]) / 2, Math.max(w[1], w[3]) + w[4] * 2, w[2], w[3]); halo.stroke();
      });
    }
    function drawPolesAndWires(g, w, h, halo) {
      wireLog = [];
      var L = drawPole(g, w * 0.427, h, h * 0.385, -1, 100, [50, 50], [46, 54]);
      var R = drawPole(g, w * 0.618, h, h * 0.372, -1, 66, [40, 40], [36, 42]);
      g.strokeStyle = POLE_INK; g.lineCap = 'round'; g.lineWidth = 2.6;
      // long spans between the two poles, sagging well below the arms
      drawWire(g, L[1][0], L[1][1], R[0][0], R[0][1], 40);
      drawWire(g, L[4][0], L[4][1], R[4][0], R[4][1], 52);
      drawWire(g, L[3][0], L[3][1], R[2][0], R[2][1], 46);
      drawWire(g, L[1][0], L[1][1], R[2][0], R[2][1], 58);
      drawWire(g, L[3][0], L[3][1], R[0][0], R[0][1], 64);
      drawWire(g, L[2][0] + 12, L[2][1], R[3][0], R[3][1], 72);
      // from off the left edge up to the left pole
      drawWire(g, w * 0.3, L[0][1] + 90, L[0][0], L[0][1], 10);
      drawWire(g, w * 0.3, L[2][1] + 120, L[2][0], L[2][1], 12);
      drawWire(g, w * 0.3, L[2][1] + 160, L[0][0] + 16, L[0][1], 16);
      // and on past the right pole
      drawWire(g, R[1][0], R[1][1], w * 0.72, R[1][1] - 20, 10);
      drawWire(g, R[3][0], R[3][1], w * 0.72, R[3][1] + 20, 12);
      var spans = wireLog; wireLog = null;
      if (halo && RIM_A > 0.01) drawWireRims(halo, spans);
    }

    var frontC = document.createElement('canvas');   // blocks that stand in front of the road
    frontC.width = SKY_W; frontC.height = SKY_H;
    var frontTex = new T.CanvasTexture(frontC);
    function paintNear(g, w, h, m) {
      var d = m.d, day = 1 - d;
      POLE_INK = dcol('#0a0720', '#262a40', d); RIM_A = 0.35 * d;
      // The blocks go on their own canvas first, so some can be stamped back in front of the expressway
      var blocks = document.createElement('canvas'); blocks.width = w; blocks.height = h;
      var rects = [];
      drawBuildingsRow(blocks.getContext('2d'), w, h, { minW: 160, maxW: 320, topMin: 0.42, topMax: 0.66, gap: 30, cell: 34, lit: 0.5, litK: m.lit, glow: 8 * m.lit, glassA: 0.3 * day,
        colors: [bcol('#2a2058', '#59628f', m), bcol('#30265f', '#5f6896', m), bcol('#251c4f', '#525b88', m)], tanks: 0.7, tankColor: bcol('#171040', '#454e7c', m), grills: true, ac: true,
        acColor: rgbaS(mixc([214, 218, 230], [150, 140, 190], d), 0.55 - 0.2 * d),
        clear: [w * 0.49, w * 0.56], out: rects });   // a side street, looking through to the mosque
      g.drawImage(blocks, 0, 0);

      // Elevated expressway weaving through the blocks: concrete deck on pillars, traffic streaking along
      var deckY = function (x) { return h * deckV(x / w); };
      var line = function (off) { g.beginPath(); for (var dx = -10; dx <= w + 10; dx += 20) { if (dx < 0) g.moveTo(dx, deckY(dx) + off); else g.lineTo(dx, deckY(dx) + off); } g.stroke(); };
      g.fillStyle = dcol('#1e1646', '#4a5282', d);
      for (var px = 70; px < w; px += 240) {                       // pillars with pier caps
        var py = deckY(px);
        g.fillRect(px - 13, py + 18, 26, h - py);
        g.fillRect(px - 26, py + 14, 52, 9);
      }
      g.lineCap = 'butt';
      g.strokeStyle = dcol('#3a2d68', '#7a82aa', d); g.lineWidth = 24; line(0);          // deck
      g.strokeStyle = dcol('#140e32', '#383d62', d); g.lineWidth = 6; line(12);          // shadowed underside edge
      g.strokeStyle = dcol('#9d86d6', '#c6cce4', d); g.lineWidth = 4; line(-13);         // parapet catching the city glow
      var lightK = 0.35 + 0.65 * d;
      for (var cl = 0; cl < 16; cl++) {                               // a few far-off lights; real cars drive past below
        var cx = between(0, w), head = rnd() < 0.5;
        g.fillStyle = head ? 'rgba(255,244,210,' + (0.95 * lightK).toFixed(3) + ')' : 'rgba(255,80,64,' + (0.9 * lightK).toFixed(3) + ')';
        g.fillRect(cx, deckY(cx) + (head ? -6 : 2), between(10, 22), 3);
      }
      for (var lp = 50; lp < w; lp += 170) {                          // lamp posts along the parapet
        g.fillStyle = '#211a2e'; g.fillRect(lp, deckY(lp) - 48, 3, 36); g.fillRect(lp, deckY(lp) - 48, 10, 3);
        if (m.lit > 0.02) {
          var lg = g.createRadialGradient(lp + 10, deckY(lp) - 45, 2, lp + 10, deckY(lp) - 45, 38);   // a pool of warm light
          lg.addColorStop(0, 'rgba(255,214,140,' + (0.7 * m.lit).toFixed(3) + ')'); lg.addColorStop(1, 'rgba(255,214,140,0)');
          g.fillStyle = lg; g.fillRect(lp - 30, deckY(lp) - 85, 80, 80);
        }
        g.fillStyle = 'rgba(255,230,170,' + (0.45 + 0.55 * m.lit).toFixed(3) + ')'; g.beginPath(); g.arc(lp + 10, deckY(lp) - 45, 4, 0, Math.PI * 2); g.fill();
      }
      // Every other block stands in front of the road (on its own layer, so passing cars slip behind them)
      var fg = frontC.getContext('2d');
      rects.forEach(function (r, i) {
        if (i % 2) return;
        fg.drawImage(blocks, r[0], r[1], r[2], h - r[1], r[0], r[1], r[2], h - r[1]);
      });
      // Electric poles and wires just outside the window, in silhouette
      drawPolesAndWires(fg, w, h, g);
    }
    var nearL = skyLayer(SKY_W, SKY_H);
    var SEED_NEAR = seed;
    paintNear(nearL.g, SKY_W, SKY_H, mood);
    frontTex.needsUpdate = true;
    var near = new T.Mesh(new T.PlaneGeometry(26, 13), new T.MeshBasicMaterial({ map: nearL.tex, transparent: true }));
    near.position.set(RX0 - 3.6, 3.0, -1.5);
    near.rotation.y = Math.PI / 2;
    near.renderOrder = 1;
    scene.add(near);

    var front = new T.Mesh(new T.PlaneGeometry(26, 13), new T.MeshBasicMaterial({ map: frontTex, transparent: true, alphaTest: 0.5 }));
    front.position.set(RX0 - 3.5, 3.0, -1.5);
    front.rotation.y = Math.PI / 2;
    front.renderOrder = 3;
    scene.add(front);

    // Rain (Borsha): streaks drifting down a sheet just outside the glass, in front of the whole city
    var rainTex = canvasTex(256, 512, function (g, w, h) {
      var rs = 1234567, rr = function () { rs = (rs * 16807) % 2147483647; return (rs - 1) / 2147483646; };
      g.lineCap = 'round';
      for (var i = 0; i < 95; i++) {
        var x = rr() * w, y = rr() * h, len = 30 + rr() * 60;
        g.strokeStyle = 'rgba(205,220,245,' + (0.25 + 0.5 * rr()).toFixed(2) + ')'; g.lineWidth = 1 + rr() * 1.6;
        for (var wy = -1; wy <= 1; wy += 1) { g.beginPath(); g.moveTo(x, y + wy * h); g.lineTo(x - len * 0.12, y + wy * h + len); g.stroke(); }   // drawn again a tile up and down, so it wraps
      }
    });
    if (rainTex.wrapS !== undefined) { rainTex.wrapS = rainTex.wrapT = T.RepeatWrapping; if (rainTex.repeat) rainTex.repeat.set(2.5, 1.6); }
    var rainMat = new T.MeshBasicMaterial({ map: rainTex, transparent: true, opacity: 0, depthWrite: false });
    var rain = new T.Mesh(new T.PlaneGeometry(12, 7), rainMat);
    rain.position.set(RX0 - 1.5, 3.5, -0.8);
    rain.rotation.y = Math.PI / 2;
    rain.renderOrder = 4;
    rain.visible = false;
    scene.add(rain);
    var rainK = 0;

    // Repaint the sky and the city from the clock (the buildings are drawn from the same random start every time)
    function repaintSky(m) {
      var keep = seed;
      seed = SEED_FAR;
      farL.g.clearRect(0, 0, SKY_W, SKY_H); paintFar(farL.g, SKY_W, SKY_H, m); farL.tex.needsUpdate = true;
      seed = SEED_NEAR;
      nearL.g.clearRect(0, 0, SKY_W, SKY_H); frontC.getContext('2d').clearRect(0, 0, SKY_W, SKY_H);
      paintNear(nearL.g, SKY_W, SKY_H, m);
      if (m.fog) {                                                 // fog over the nearer blocks and the poles, only where something is painted
        [nearL.g, frontC.getContext('2d')].forEach(function (cg, ci) {
          cg.save(); cg.globalCompositeOperation = 'source-atop';
          var fv = cg.createLinearGradient(0, SKY_H * 0.35, 0, SKY_H); fv.addColorStop(0, rgbaS(m.mistCol, (ci ? 0.35 : 0.62) * m.fog)); fv.addColorStop(1, rgbaS(m.mistCol, (ci ? 0.5 : 0.8) * m.fog));
          cg.fillStyle = fv; cg.fillRect(0, 0, SKY_W, SKY_H); cg.restore();
        });
      }
      nearL.tex.needsUpdate = true; frontTex.needsUpdate = true;
      seed = keep;
    }

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
    // Vehicles only drive the stretch of road you can see through the window (plus a little either side),
    // so they come by often instead of spending most of their time out of view
    var ROAD_U0 = 0.3, ROAD_U1 = 0.72;
    var FLEET = ['car', 'bus', 'car', 'cng', 'car', 'bus', 'car', 'cng'];
    FLEET.forEach(function (kind, i) {
      var long = kind === 'bus', lenU = long ? 0.6 : 0.36;
      var m = new T.Mesh(new T.PlaneGeometry(lenU, 0.15), new T.MeshBasicMaterial({ map: vehicleTex(kind), transparent: true, alphaTest: 0.1 }));
      m.rotation.y = Math.PI / 2;
      m.renderOrder = 2;
      m.visible = false;
      scene.add(m);
      var dir = i % 2 ? 1 : -1;                             // two directions, two lanes
      if (dir < 0) m.scale.x = -1;                          // face the other way
      traffic.push({
        mesh: m,
        dir: dir,
        len: lenU / 26,
        speed: between(0.06, 0.1) * (long ? 0.75 : 1),
        u: ROAD_U0 + (ROAD_U1 - ROAD_U0) * (i / FLEET.length),   // start spread out along the visible stretch
        wait: 0
      });
    });
    seed = -2028929348;   // the plants and ID-card barcodes below draw from the same point as before the night sky
    function moveTraffic(dt) {
      twinkleT += dt;                                       // stars twinkle
      if (rainK > 0.01) {                                   // rain falls, and eases a little now and then
        rainTex.offset.y += dt * 2.0;
        rainMat.opacity = rainK * (0.62 + 0.14 * Math.sin(twinkleT * 0.35));
      }
      twinkle[0].opacity = (0.6 + 0.4 * Math.sin(twinkleT * 1.7)) * curMood.starA;
      twinkle[1].opacity = (0.6 + 0.4 * Math.sin(twinkleT * 1.3 + 2.2)) * curMood.starA;
      traffic.forEach(function (v) {
        if (v.wait > 0) {
          v.wait -= dt; v.mesh.visible = false;
          if (v.wait <= 0) {
            var start = v.dir > 0 ? ROAD_U0 - v.len : ROAD_U1 + v.len;
            // don't enter on top of a vehicle already in this lane; try again a moment later
            var blocked = traffic.some(function (o) { return o !== v && o.dir === v.dir && o.wait <= 0 && Math.abs(o.u - start) < v.len + o.len + 0.006; });
            if (blocked) v.wait = 0.4; else v.u = start;
          }
          return;
        }
        // keep a gap behind the vehicle in front instead of driving through it
        traffic.forEach(function (o) {
          if (o === v || o.dir !== v.dir || o.wait > 0) return;
          var ahead = (o.u - v.u) * v.dir;
          if (ahead > 0 && ahead < v.len + o.len + 0.004) v.u = o.u - v.dir * (v.len + o.len + 0.004);
        });
        v.u += v.dir * v.speed * dt;
        if (v.u < ROAD_U0 - v.len - 0.01 || v.u > ROAD_U1 + v.len + 0.01) { v.wait = between(1.5, 5); v.mesh.visible = false; return; }
        var lane = v.dir > 0 ? 0.004 : -0.002;              // the far lane sits a touch higher
        v.mesh.position.set(RX0 - 3.55, 9.5 - (deckV(v.u) + lane) * 13 + 0.02, 11.5 - v.u * 26);
        v.mesh.visible = true;
      });
    }


    /* ---------- Desk with monitor, lamp and phone ---------- */
    var desk = new T.Group();
    desk.position.set(0, 0, -2.2);
    scene.add(desk);
    box(5.2, 0.16, 2.2, mat(C.deskTop, { roughness: 0.5 }), 0, 1.55, 0, desk);
    box(0.16, 1.5, 2.0, mat(C.desk), -2.45, 0.75, 0, desk);
    box(1.6, 1.5, 2.0, mat(C.desk), 1.8, 0.75, 0, desk);
    var neonM = new T.MeshBasicMaterial({ color: C.neon });
    box(1.4, 0.04, 0.04, neonM, 1.8, 1.1, 1.01, desk);                                  // drawer handle
    box(5.24, 0.05, 0.05, neonM, 0, 1.47, 1.12, desk);                                   // neon strip along the front edge
    box(0.05, 0.05, 2.24, neonM, 2.62, 1.47, 0, desk);                                   // and down the right side

    var monitor = new T.Group();
    monitor.position.set(-0.3, 1.63, -0.45);
    desk.add(monitor);
    box(0.5, 0.06, 0.4, mat(C.metal), 0, 0.03, 0, monitor);
    box(0.12, 0.7, 0.08, mat(C.metal), 0, 0.4, -0.05, monitor);
    box(2.5, 1.5, 0.12, mat(C.metal, { roughness: 0.4 }), 0, 1.4, 0, monitor);
    /* Glowing screen: a terminal that types a short intro, one command at a time,
       and ends on "open projects". Up close the projects desktop sits over it. */
    var TERM_FONT = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, "Courier New", monospace';
    var TERM_SCRIPT = [
      { cmd: 'whoami', out: ['abrar sami khan', 'analytics · automation · ML'] },
      { cmd: 'cat now.txt', out: ['CX analytics @ Therap BD', 'automating monthly reports'] },
      { cmd: 'ls projects/', out: ['bridge  cinemas  tank-wars', '+ 7 more projects'] },
      { cmd: 'stack', out: ['python · sql · apps script', 'salesforce · pytorch'] },
      { cmd: 'open projects', out: ['click the screen \u21b5'], end: true }
    ];
    function drawTerminal(g, w, h, st) {
      var bg = g.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#0a1322'); bg.addColorStop(1, '#10243a');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      var halo = g.createRadialGradient(w * 0.35, h * 0.55, 10, w * 0.35, h * 0.55, w * 0.6);
      halo.addColorStop(0, 'rgba(25,217,255,0.14)'); halo.addColorStop(1, 'rgba(25,217,255,0)');
      g.fillStyle = halo; g.fillRect(0, 0, w, h);
      // title bar
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, 0, w, 58);
      [['#ff5f57', 34], ['#febc2e', 66], ['#28c840', 98]].forEach(function (d) { g.fillStyle = d[0]; g.beginPath(); g.arc(d[1], 29, 10, 0, Math.PI * 2); g.fill(); });
      g.textBaseline = 'middle'; g.textAlign = 'center';
      g.font = '500 24px ' + TERM_FONT; g.fillStyle = 'rgba(220,235,255,0.55)';
      g.fillText('abrar@dhaka: ~', w / 2, 30);
      // body
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      var x = 64, y = 215, lh = 96;
      g.font = '700 58px ' + TERM_FONT;
      g.shadowColor = 'rgba(25,217,255,0.8)'; g.shadowBlur = 14;
      g.fillStyle = '#19d9ff'; g.fillText('>', x, y);
      g.shadowColor = 'rgba(220,235,255,0.5)'; g.shadowBlur = 8;
      g.fillStyle = '#f0fcff'; g.fillText(st.typed, x + 54, y);
      var cw = g.measureText(st.typed).width;
      if (st.cursor) { g.shadowBlur = 12; g.fillStyle = '#19d9ff'; g.fillRect(x + 62 + cw, y - 46, 30, 56); }
      g.font = '500 50px ' + TERM_FONT;
      st.lines.forEach(function (ln, i) {
        g.shadowColor = 'rgba(130,170,255,0.5)'; g.shadowBlur = 8;
        g.fillStyle = st.end ? '#9fc2ff' : '#dff0ff';
        g.fillText(ln, x, y + lh * (i + 1));
      });
      g.shadowBlur = 0;
    }
    var term = { step: 0, phase: 'type', at: 0, typed: '', lines: [], cursor: true, end: false, sig: '' };
    var screenTex = canvasTex(1024, 590, function (g, w, h) {
      drawTerminal(g, w, h, { typed: '', lines: [], cursor: true, end: false });
    });
    // Advance the terminal; redraws only when something on it changes
    function updateTerminal(dt) {
      var sc = TERM_SCRIPT[term.step];
      term.at += dt;
      if (term.phase === 'type') {
        var n = Math.min(sc.cmd.length, Math.floor(term.at * 13));
        term.typed = sc.cmd.slice(0, n);
        if (n === sc.cmd.length && term.at > sc.cmd.length / 13 + 0.35) { term.phase = 'out'; term.at = 0; }
      } else if (term.phase === 'out') {
        term.lines = sc.out.slice(0, Math.min(sc.out.length, 1 + Math.floor(term.at / 0.3)));
        if (term.lines.length === sc.out.length) { term.phase = 'hold'; term.at = 0; }
      } else if (term.at > (sc.end ? 4.5 : 2.6)) {
        term.step = (term.step + 1) % TERM_SCRIPT.length;
        term.phase = 'type'; term.at = 0; term.typed = ''; term.lines = [];
      }
      term.end = !!sc.end;
      term.cursor = term.phase === 'type' || Math.floor(t * 2) % 2 === 0;
      var sig = term.typed + '|' + term.lines.length + '|' + term.cursor + '|' + term.step;
      if (sig === term.sig) return;
      term.sig = sig;
      var cv = screenTex.image;
      if (!cv || !cv.getContext) return;
      drawTerminal(cv.getContext('2d'), cv.width, cv.height, term);
      screenTex.needsUpdate = true;
    }
    var screen = new T.Mesh(new T.PlaneGeometry(2.36, 1.36), new T.MeshBasicMaterial({ map: screenTex }));
    screen.position.set(0, 1.4, 0.065);
    monitor.add(screen);
    var screenGlow = new T.PointLight(0x4fc8ff, 0.6, 4.5, 2);
    screenGlow.position.set(0, 1.4, 0.6);
    monitor.add(screenGlow);
    box(1.9, 0.05, 0.6, mat(0x2e2a28), -0.3, 1.66, 0.45, desk);                       // keyboard
    box(0.2, 0.05, 0.32, mat(0x2e2a28), 0.95, 1.66, 0.45, desk);                      // mouse
    cyl(0.14, 0.12, 0.3, mat(0xece6da), 1.1, 1.78, -0.35, desk);                       // tea cup
    box(0.04, 0.12, 0.04, mat(0xece6da), 1.27, 1.8, -0.35, desk);                     // cup handle

    // Studio speakers on either side of the screen
    [[-2.05, -0.6], [1.45, -0.72]].forEach(function (sp) {
      var spk = new T.Group(); spk.position.set(sp[0], 1.63, sp[1]); spk.rotation.y = sp[0] < 0 ? 0.15 : -0.2; desk.add(spk);
      box(0.5, 0.8, 0.5, mat(0x1e1c23, { roughness: 0.55 }), 0, 0.4, 0, spk);
      cyl(0.17, 0.17, 0.03, mat(0x2c2a33, { roughness: 0.4, metalness: 0.3 }), 0, 0.33, 0.255, spk, 24).rotation.x = Math.PI / 2;   // woofer
      cyl(0.06, 0.06, 0.03, mat(0x2c2a33, { roughness: 0.4, metalness: 0.3 }), 0, 0.64, 0.255, spk, 16).rotation.x = Math.PI / 2;  // tweeter
    });
    // A podcast mic on a boom arm, clamped to the back of the desk
    var micArm = new T.Group(); micArm.position.set(1.05, 1.63, -0.95); desk.add(micArm);
    var micM = mat(0x24222a, { roughness: 0.35, metalness: 0.5 });
    box(0.12, 0.14, 0.12, micM, 0, 0.07, 0, micArm);
    var mb1 = box(0.05, 0.95, 0.05, micM, 0, 0.55, 0.12, micArm); mb1.rotation.x = 0.28;
    var mb2 = box(0.05, 0.85, 0.05, micM, 0, 1.08, 0.55, micArm); mb2.rotation.x = 1.25;
    var mic = cyl(0.085, 0.085, 0.36, mat(0x8f8a98, { roughness: 0.35, metalness: 0.7 }), 0, 0.9, 0.92, micArm, 18);
    cyl(0.1, 0.1, 0.04, micM, 0, 0.71, 0.92, micArm, 18);
    cyl(0.12, 0.12, 0.012, mat(0x16141a, { roughness: 0.9 }), 0, 0.92, 1.12, micArm, 24).rotation.x = Math.PI / 2;   // pop filter

    // Arm lamp with a pink shade
    var lampArm = new T.Group();
    lampArm.position.set(2.1, 1.63, -0.55);
    desk.add(lampArm);
    var lampM = mat(0x2b2932, { roughness: 0.4, metalness: 0.4 });
    cyl(0.22, 0.26, 0.08, lampM, 0, 0.04, 0, lampArm);
    var arm1 = box(0.06, 1.0, 0.06, lampM, 0.0, 0.5, 0.12, lampArm); arm1.rotation.x = -0.28;
    var arm2 = box(0.06, 0.9, 0.06, lampM, -0.25, 1.15, 0.2, lampArm); arm2.rotation.z = 1.05;
    var shade = new T.Mesh(new T.ConeGeometry(0.26, 0.36, 20, 1, true), new T.MeshStandardMaterial({ color: C.neon, emissive: 0x0a6f87, roughness: 0.5, side: T.DoubleSide }));
    shade.position.set(-0.62, 1.32, 0.2); shade.rotation.z = 0.7;
    lampArm.add(shade);
    cyl(0.08, 0.08, 0.06, new T.MeshBasicMaterial({ color: 0xe6fbff }), -0.66, 1.24, 0.2, lampArm);

    /* iPhone 15 Pro: a rounded titanium body, edge-to-edge black glass, the Dynamic Island,
       side buttons and the triple camera on the back */
    var PW = 0.33, PL = 0.68, PT = 0.036, PR = 0.055;                 // width, length, thickness, corner radius
    var titaniumM = mat(0x8d8a84, { roughness: 0.32, metalness: 0.85 }); // natural titanium
    var phoneGeo;
    if (T.Shape && T.ExtrudeGeometry) {
      var ps = new T.Shape(), hw = PW / 2, hl = PL / 2;
      ps.moveTo(-hw + PR, -hl); ps.lineTo(hw - PR, -hl); ps.quadraticCurveTo(hw, -hl, hw, -hl + PR);
      ps.lineTo(hw, hl - PR); ps.quadraticCurveTo(hw, hl, hw - PR, hl); ps.lineTo(-hw + PR, hl);
      ps.quadraticCurveTo(-hw, hl, -hw, hl - PR); ps.lineTo(-hw, -hl + PR); ps.quadraticCurveTo(-hw, -hl, -hw + PR, -hl);
      phoneGeo = new T.ExtrudeGeometry(ps, { depth: PT - 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3, curveSegments: 10 });
      if (phoneGeo.rotateX) { phoneGeo.rotateX(-Math.PI / 2); phoneGeo.center(); }
    } else {
      phoneGeo = new T.BoxGeometry(PW, PT, PL);
    }
    var phone = new T.Mesh(phoneGeo, titaniumM);
    phone.position.set(1.55, 1.65, 0.35);
    phone.castShadow = true; phone.receiveShadow = true;
    desk.add(phone);
    phone.rotation.y = -0.35;
    var phoneGlass = new T.Mesh(new T.PlaneGeometry(PW - 0.014, PL - 0.014), new T.MeshBasicMaterial({ color: 0x0c0e11 }));
    phoneGlass.rotation.x = -Math.PI / 2;
    phoneGlass.position.y = PT / 2 + 0.0015;
    phone.add(phoneGlass);
    var island = new T.Mesh(new T.PlaneGeometry(0.085, 0.024), new T.MeshBasicMaterial({ color: 0x000000 }));
    island.rotation.x = -Math.PI / 2;
    island.position.set(0, PT / 2 + 0.002, -PL / 2 + 0.045);
    phone.add(island);
    // side buttons: action button and volume on the left, the side button on the right
    [[-1, -0.2, 0.035], [-1, -0.12, 0.06], [-1, -0.04, 0.06], [1, -0.1, 0.1]].forEach(function (bt) {
      box(0.008, 0.016, bt[2], titaniumM, bt[0] * (PW / 2 + 0.003), 0, bt[1], phone);
    });
    // camera plateau with three lenses on the back
    var camPad = box(0.13, 0.008, 0.13, mat(0x6f6c68, { roughness: 0.25, metalness: 0.7 }), -PW / 2 + 0.085, -PT / 2 - 0.004, -PL / 2 + 0.085, phone);
    [[-0.03, -0.03], [-0.03, 0.03], [0.03, 0]].forEach(function (ln) {
      var lens = cyl(0.024, 0.024, 0.014, mat(0x111216, { roughness: 0.15, metalness: 0.6 }), ln[0], -0.008, ln[1], camPad, 18);
      cyl(0.015, 0.015, 0.003, mat(0x1d2440, { roughness: 0.05, metalness: 0.9 }), 0, -0.008, 0, lens, 14);
    });
    var PHONE_REST = { x: 1.55, y: 1.65, z: 0.35, rx: 0, ry: -0.35 };
    var PHONE_UP = { x: 1.55, y: 2.55, z: 0.75, rx: Math.PI / 2, ry: 0 };   // lifted, facing you (desk sits at z -2.2)

    /* ---------- Back wall: ID card board and the shelf ---------- */
    var boardTex = canvasTex(920, 480, function (g, w, h) {
      g.fillStyle = '#1c2029'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#121116';
      for (var y = 20; y < h; y += 28) for (var x = 20; x < w; x += 28) { g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = '#1b1a20'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    });
    var board = new T.Mesh(new T.BoxGeometry(4.6, 2.4, 0.08), [
      mat(C.board), mat(C.board), mat(C.board), mat(C.board),
      new T.MeshStandardMaterial({ map: boardTex, roughness: 0.9 }), mat(C.board)
    ]);
    board.position.set(3.6, 4.2, -5.8);
    board.castShadow = true; board.receiveShadow = true;
    scene.add(board);
    // Pink neon frame around the board
    [[4.76, 0.06, 0, 1.23], [4.76, 0.06, 0, -1.23], [0.06, 2.52, 2.38, 0], [0.06, 2.52, -2.38, 0]].forEach(function (n) {
      box(n[0], n[1], 0.06, neonM, 3.6 + n[2], 4.2 + n[3], -5.74);
    });

    /* ---------- Work: ID cards on lanyards, hanging from the board ---------- */
    var workItems = Array.prototype.slice.call(document.querySelectorAll('#work .story__title')).map(function (el) { return el.textContent.trim(); });
    var CARDS = [
      { id: 'therap', org: 'Therap BD', short: 'Therap BD', role: 'Associate, Customer Experience Strategy & Analytics',
        period: 'Since September 2026', kind: 'Full-time role', color: '#d9741c', x: 1.95, w: 0.92, h: 1.24, app: 'work',
        initials: 'TB', logo: 'logos/therap.png',
        note: 'I turn manual monthly reporting into scripted tools, support the team’s Salesforce setup, and look for places where AI can save time.' },
      { id: 'robotics', org: 'Robotics Club of BRAC University', short: 'Robotics Club of BRAC University', role: 'Director, Editorial & Publications',
        period: '2022 to 2025', kind: 'Leadership', color: '#2c4ea3', x: 3.05, w: 0.8, h: 1.08,
        initials: 'RC', logo: 'logos/robotics-club.png' },
      { id: 'business', org: 'BRAC University Business Club - BIZBEE', short: 'BRAC University Business Club - BIZBEE', role: 'Assistant Director, Research & Publications',
        period: '2022 to 2025', kind: 'Leadership', color: '#5b4a7a', x: 4.0, w: 0.8, h: 1.08,
        initials: 'BC', logo: 'logos/business-club.png' },
      { id: 'edy', org: 'Enduring Developments by the Youths - EDY', short: 'Enduring Developments by the Youths - EDY', role: 'Lead, Media and Content Creation',
        period: '2020 to 2021', kind: 'Leadership', color: '#3e6e8c', x: 4.95, w: 0.8, h: 1.08,
        initials: 'EDY', logo: 'logos/edy.png' },
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
    // The organisation name in the coloured band: largest size that fits on up to two lines
    function fitHeader(g, text, w, band) {
      var maxW = w - 56, top = band * 0.34, room = band - top - 8;
      for (var size = 38; size >= 18; size -= 2) {
        g.font = '700 ' + size + 'px ' + CARD_FONT;
        var lines = [], line = '';
        text.split(' ').forEach(function (wd) {
          var t = line ? line + ' ' + wd : wd;
          if (g.measureText(t).width > maxW && line) { lines.push(line); line = wd; } else line = t;
        });
        if (line) lines.push(line);
        var lh = size * 1.12, fits = lines.length <= 2 && lines.every(function (l) { return g.measureText(l).width <= maxW; });
        if (fits && lines.length * lh <= room || size === 18) {
          var y = top + (room - lines.length * lh) / 2 + size * 0.85;
          lines.forEach(function (l, i) { g.fillText(l, w / 2, y + i * lh); });
          return;
        }
      }
    }

    /* Card fronts show the organisation's logo. Drop the files into a logos/ folder
       (names below); until a file is there, the card shows the organisation's initials. */
    var LOGO_BOX = { cy: 0.39, size: 0.46 };          // centre (fraction of height) and box size (fraction of width)
    function paintLogo(tex, img) {
      var cv = tex.image;
      if (!cv || !cv.getContext) return;
      var g = cv.getContext('2d'), w = cv.width, h = cv.height;
      var box = w * LOGO_BOX.size, cx = w / 2, cy = h * LOGO_BOX.cy;
      // The tile takes the logo's own background colour (white if the logo is transparent)
      var tile = '#ffffff';
      try {
        var probe = document.createElement('canvas'); probe.width = probe.height = 1;
        var pg = probe.getContext('2d'); pg.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);   // top-left pixel
        var px = pg.getImageData(0, 0, 1, 1).data;
        if (px[3] > 200) tile = 'rgb(' + px[0] + ',' + px[1] + ',' + px[2] + ')';
      } catch (err) { /* keep white */ }
      g.fillStyle = tile;
      g.beginPath();
      if (g.roundRect) g.roundRect(cx - box / 2, cy - box / 2, box, box, 18); else g.rect(cx - box / 2, cy - box / 2, box, box);
      g.fill();
      var pad = box * 0.07, fit = Math.min((box - pad * 2) / img.width, (box - pad * 2) / img.height);
      var iw = img.width * fit, ih = img.height * fit;
      g.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih);
      tex.needsUpdate = true;
    }
    function cardFront(c) {
      var tex = cardFrontTex(c);
      if (c.logo) {
        var img = new Image();
        img.addEventListener('load', function () { paintLogo(tex, img); });
        img.src = c.logo;                             // missing file: the initials stay
      }
      return tex;
    }
    function cardFrontTex(c) {
      return canvasTex(512, Math.round(512 * c.h / c.w), function (g, w, h) {
        g.fillStyle = '#f3eee4'; g.fillRect(0, 0, w, h);
        g.fillStyle = c.color; g.fillRect(0, 0, w, h * 0.2);
        g.fillStyle = '#f3eee4'; g.beginPath(); g.ellipse(w / 2, h * 0.045, 46, 11, 0, 0, Math.PI * 2); g.fill();   // lanyard slot
        g.fillStyle = '#fff'; g.textAlign = 'center';
        fitHeader(g, c.short, w, h * 0.2);
        // Initials in the card colour, replaced by the logo once it loads
        var box = w * LOGO_BOX.size, cy = h * LOGO_BOX.cy;
        g.fillStyle = '#ffffff';
        g.beginPath();
        if (g.roundRect) g.roundRect(w / 2 - box / 2, cy - box / 2, box, box, 18); else g.rect(w / 2 - box / 2, cy - box / 2, box, box);
        g.fill();
        g.fillStyle = c.color; g.font = '700 ' + (c.initials.length > 2 ? 64 : 80) + 'px ' + CARD_FONT;
        g.textBaseline = 'middle'; g.fillText(c.initials, w / 2, cy + 4); g.textBaseline = 'alphabetic';
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
        var disc = cyl(0.17, 0.17, 0.04, mat(0xc0844e, { metalness: 0.35, roughness: 0.45 }), 0, -0.56, 0.03, pivot, 32);
        disc.rotation.x = Math.PI / 2;
        cyl(0.11, 0.11, 0.045, mat(0xa36d3f, { metalness: 0.35, roughness: 0.5 }), 0, -0.56, 0.035, pivot, 32).rotation.x = Math.PI / 2;
        // A thin warm edge so the medal just reads against the dark board
        var rim = new T.Mesh(new T.RingGeometry(0.168, 0.18, 48), new T.MeshBasicMaterial({ color: 0xd6a06a, transparent: true, opacity: 0.85, side: T.DoubleSide }));
        rim.position.set(0, -0.56, 0.056); pivot.add(rim);
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
    var books = [];
    for (var i = 0; i < 9; i++) {
      var bh = 0.55 + (i % 3) * 0.12;
      books.push(box(0.18, bh, 0.42, mat(bookColors[i % bookColors.length]), -1.3 + i * 0.22, 4.66 + bh / 2, 0, shelf));
    }
    var aboutBook = books[1];                      // the marigold one slides out when you open About
    var aboutBookHome = { z: aboutBook.position.z, rx: aboutBook.rotation.x };
    // A framed photo of you on the lower shelf (the only place your photo appears)
    var photoFrame = new T.Group();
    photoFrame.position.set(-0.85, 3.46, 0.05);
    photoFrame.rotation.x = -0.12;                       // leaning back a little
    photoFrame.rotation.y = 0.18;
    shelf.add(photoFrame);
    // Portrait-shaped (3:4) frame holding your full photo
    box(0.64, 0.84, 0.05, mat(0x6b4a2f, { roughness: 0.6 }), 0, 0.42, 0, photoFrame);
    var frameTex = canvasTex(384, 512, function (g, w, h) {
      g.fillStyle = '#e3dccf'; g.fillRect(0, 0, w, h);
      drawAvatar(g, w / 2, h * 0.42, w * 0.38, '#e3dccf');     // stand-in until the photo loads
    });
    var framePhoto = new T.Mesh(new T.PlaneGeometry(0.54, 0.72), new T.MeshBasicMaterial({ map: frameTex, color: 0xe6dfd2 }));
    framePhoto.position.set(0, 0.42, 0.027);
    photoFrame.add(framePhoto);
    var fullPhoto = new Image();
    fullPhoto.addEventListener('load', function () {
      var cv = frameTex.image;
      if (!cv || !cv.getContext) return;
      var g = cv.getContext('2d');
      var fit = Math.max(cv.width / fullPhoto.width, cv.height / fullPhoto.height);   // fill the frame
      var iw = fullPhoto.width * fit, ih = fullPhoto.height * fit;
      g.drawImage(fullPhoto, (cv.width - iw) / 2, (cv.height - ih) / 2, iw, ih);
      frameTex.needsUpdate = true;
    });
    fullPhoto.src = 'photo-full.jpg';

    box(0.5, 0.35, 0.4, mat(0x8a5c3c), 0.9, 3.64, 0, shelf);                        // a small box
    cyl(0.16, 0.12, 0.35, mat(C.teal), 1.3, 3.64, 0, shelf);                        // small pot
    box(0.08, 0.4, 0.08, mat(0x4f8a45), 1.3, 3.95, 0, shelf);

    /* ---------- Chair: mesh office chair on a five-star base ---------- */
    var chair = new T.Group();
    chair.position.set(-0.3, 0, -0.4);
    scene.add(chair);
    var chairM = mat(0x1d2129, { roughness: 0.7 }), chromeM = mat(0x8c8796, { roughness: 0.3, metalness: 0.8 });
    for (var leg5 = 0; leg5 < 5; leg5++) {
      var la = leg5 * Math.PI * 2 / 5, legG = new T.Group();
      legG.rotation.y = la; legG.position.y = 0.16; chair.add(legG);
      box(0.08, 0.06, 0.62, chromeM, 0, 0, 0.31, legG);
      var caster = new T.Mesh(new T.SphereGeometry(0.075, 10, 8), mat(0x141317)); caster.position.set(0, -0.08, 0.6); legG.add(caster);
    }
    cyl(0.05, 0.05, 0.8, chromeM, 0, 0.55, 0, chair, 12);                  // gas lift
    box(1.1, 0.16, 1.0, chairM, 0, 1.03, 0, chair);                         // seat
    box(1.0, 0.04, 0.9, mat(0x2a303b, { roughness: 0.9 }), 0, 1.12, 0, chair);
    var backG = new T.Group(); backG.position.set(0, 1.15, 0.52); backG.rotation.x = 0.1; chair.add(backG);
    box(0.08, 1.6, 0.08, chairM, -0.5, 0.8, 0, backG); box(0.08, 1.6, 0.08, chairM, 0.5, 0.8, 0, backG);   // back frame
    box(1.08, 0.08, 0.08, chairM, 0, 1.6, 0, backG); box(1.0, 0.08, 0.08, chairM, 0, 0.12, 0, backG);
    var meshTex = canvasTex(64, 64, function (g, w, h) {
      g.fillStyle = '#1a191e'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#3a3742'; g.lineWidth = 1;
      for (var mm = 0; mm < w; mm += 4) { g.beginPath(); g.moveTo(mm, 0); g.lineTo(mm, h); g.stroke(); g.beginPath(); g.moveTo(0, mm); g.lineTo(w, mm); g.stroke(); }
    });
    if (meshTex.repeat) { meshTex.wrapS = meshTex.wrapT = T.RepeatWrapping; meshTex.repeat.set(6, 8); }
    box(0.94, 1.46, 0.03, new T.MeshStandardMaterial({ map: meshTex, roughness: 0.8 }), 0, 0.86, 0, backG);  // mesh back
    box(0.7, 0.32, 0.12, chairM, 0, 1.86, 0.02, backG);                    // headrest
    box(0.05, 0.3, 0.05, chairM, 0, 1.68, 0.02, backG);
    [-1, 1].forEach(function (sd) {                                          // armrests
      box(0.06, 0.42, 0.06, chairM, sd * 0.6, 1.3, 0.05, chair);
      box(0.14, 0.06, 0.5, mat(0x1d1c22, { roughness: 0.6 }), sd * 0.6, 1.53, -0.02, chair);
    });

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
    // Jaw and chin: a slightly fuller lower face, so the head isn't a plain ball
    var jawShape = part(new T.SphereGeometry(0.22, 20, 14), skinM, 0, -0.13, -0.06, head);
    jawShape.scale.set(1.05, 0.8, 1.0);
    // Light stubble just along the jaw and chin (a thin shell over the jaw, close to the skin tone)
    var stubbleM = mat(0x5e3d2c, { roughness: 1 });
    var stub = part(new T.SphereGeometry(0.226, 22, 12, Math.PI * 0.2, Math.PI * 0.6, Math.PI * 0.55, Math.PI * 0.4), stubbleM, 0, -0.13, -0.06, head);
    stub.scale.set(1.05, 0.8, 1.0);
    stub.rotation.y = Math.PI;
    // Ears
    [-1, 1].forEach(function (side) {
      part(new T.SphereGeometry(0.07, 12, 10), mat(SKIN_SHADE), side * 0.27, -0.01, 0.02, head).scale.set(0.45, 1, 0.75);
    });
    // Eyes: white, a dark iris, and a lid line; brows a little thicker
    var eyeWhiteM = mat(0xf2ece4, { roughness: 0.4 }), irisM = mat(0x1c120e, { roughness: 0.3 });
    [-1, 1].forEach(function (side) {
      var ew = part(new T.SphereGeometry(0.042, 14, 10), eyeWhiteM, side * 0.098, 0.035, -0.268, head);
      ew.scale.set(1.15, 0.8, 0.55);
      part(new T.SphereGeometry(0.024, 12, 10), irisM, side * 0.098, 0.033, -0.29, head).scale.set(1, 1, 0.5);
      var lid = part(new T.BoxGeometry(0.1, 0.014, 0.02), mat(SKIN_SHADE), side * 0.098, 0.066, -0.272, head);
      lid.rotation.z = side * -0.08;
      var brow = part(new T.BoxGeometry(0.12, 0.03, 0.035), hairM, side * 0.1, 0.12, -0.262, head);
      brow.rotation.z = side * -0.14;
    });
    // Nose: a bridge and a rounded tip
    var bridge = part(new T.BoxGeometry(0.045, 0.11, 0.05), skinM, 0, -0.005, -0.285, head);
    bridge.rotation.x = 0.25;
    part(new T.SphereGeometry(0.045, 12, 10), mat(SKIN_SHADE), 0, -0.065, -0.296, head).scale.set(1.15, 0.85, 0.8);
    // Mouth: a soft closed smile
    var mouth = part(new T.CylinderGeometry(0.05, 0.05, 0.016, 16, 1, false, Math.PI * 1.1, Math.PI * 0.8), mat(0x4a2620, { roughness: 0.8 }), 0, -0.15, -0.284, head);
    mouth.rotation.x = Math.PI / 2;
    // Moustache shadow, very light
    part(new T.BoxGeometry(0.11, 0.022, 0.02), stubbleM, 0, -0.112, -0.288, head);

    // Hair: short faded sides, more length on top swept up at the front and back over the crown
    var fadeM = mat(0x2a2224, { roughness: 0.9 });
    // the fade: a thin shell over the sides and back, stopping above the ears and away from the forehead
    var sides = part(new T.SphereGeometry(0.308, 30, 16, -Math.PI * 0.18, Math.PI * 1.36, Math.PI * 0.22, Math.PI * 0.36), fadeM, 0, 0.01, 0.01, head);
    sides.scale.set(0.92, 1.07, 1.0);
    // the top: a dome sitting higher than the skull, then swept strands
    var top = part(new T.SphereGeometry(0.29, 30, 16, 0, Math.PI * 2, 0, Math.PI * 0.36), hairM, 0, 0.07, 0.02, head);
    top.scale.set(0.95, 1.05, 1.05);
    // swept strands running front to back, lifted at the front (a soft quiff)
    [
      [0, 0.315, -0.02, 0.1, 0.36, -0.35], [-0.09, 0.3, -0.01, 0.085, 0.32, -0.3], [0.09, 0.3, -0.01, 0.085, 0.32, -0.3],
      [-0.17, 0.25, 0.01, 0.07, 0.28, -0.2], [0.17, 0.25, 0.01, 0.07, 0.28, -0.2],
      [-0.05, 0.33, 0.06, 0.08, 0.3, -0.15], [0.05, 0.33, 0.06, 0.08, 0.3, -0.15]
    ].forEach(function (st) {
      var strand = part(new T.CapsuleGeometry(st[3], st[4], 6, 12), hairM, st[0], st[1], st[2], head);
      strand.rotation.set(Math.PI / 2 + st[5], 0, -st[0] * 0.8);
      strand.scale.set(1, 1, 0.75);
    });
    // the quiff itself: volume rising over the forehead, swept slightly to one side
    var quiff = part(new T.SphereGeometry(0.13, 18, 12), hairM, 0.03, 0.33, -0.17, head);
    quiff.scale.set(1.55, 0.85, 1.0); quiff.rotation.set(-0.45, 0, -0.12);
    var curl = part(new T.CapsuleGeometry(0.05, 0.16, 6, 10), hairM, 0.1, 0.36, -0.2, head);
    curl.rotation.set(0.2, 0, 1.0);
    // a few lighter strands so the top doesn't read as a solid helmet
    var sheenM = mat(0x3a2f31, { roughness: 0.55 });
    [[-0.06, 0.375, -0.06, 0.25], [0.04, 0.38, 0.0, -0.15], [0.12, 0.35, -0.08, 0.3]].forEach(function (hl) {
      var sh = part(new T.CapsuleGeometry(0.014, 0.2, 4, 8), sheenM, hl[0], hl[1], hl[2], head);
      sh.rotation.set(Math.PI / 2 - 0.3, hl[3], 0);
    });
    // short sideburns
    [-1, 1].forEach(function (side) { part(new T.BoxGeometry(0.03, 0.1, 0.06), fadeM, side * 0.268, 0.06, -0.04, head); });

    /* ---------- Anime restyle of the figure ----------
       Cel-shaded (a few flat light steps) with a thin dark outline, a hand-drawn face, chunky spiky hair and a broader,
       more muscular build. It is built on top of the figure above: if anything here fails, the original figure comes back. */
    var animeOK = false;
    (function () {
      var oldTorso = [], legMeshes = [], aT = null, aH = null;
      try {
        torso.traverse(function (o) { if (o.isMesh) oldTorso.push(o); });
        me.children.forEach(function (o) { if (o.isMesh) legMeshes.push(o); });
        var grad = null;
        try { grad = new T.DataTexture(new Uint8Array([105, 185, 255]), 3, 1, T.RedFormat); grad.minFilter = grad.magFilter = T.NearestFilter; grad.needsUpdate = true; } catch (e0) { grad = null; }
        var tcache = {};
        function toon(c) { var k = typeof c === 'number' ? c : c.getHex(); return tcache[k] || (tcache[k] = new T.MeshToonMaterial({ color: k, gradientMap: grad })); }
        var inkM = new T.MeshBasicMaterial({ color: 0x1b1216, side: T.BackSide });
        function ink(mesh, k) { var o = new T.Mesh(mesh.geometry, inkM); o.scale.set(k, k, k); mesh.add(o); return o; }

        var aSkin = toon(0xcf9164), aTee = toon(0xf1f1f4), aHair = toon(0x17121b), aHair2 = toon(0x3d3760);
        aT = new T.Group(); torso.add(aT);
        aH = new T.Group(); head.add(aH);

        // ----- Body: a broad chest tapering to a narrower waist, big shoulders and arms -----
        var aChest = part(new T.CapsuleGeometry(0.34, 0.4, 8, 20), aTee, 0, 0.52, 0, aT);
        aChest.scale.set(1.36, 1, 0.8); ink(aChest, 1.035);
        var aWaist = part(new T.CylinderGeometry(0.4, 0.3, 0.46, 20), aTee, 0, 0.2, 0, aT);
        aWaist.scale.set(1.2, 1, 0.76); ink(aWaist, 1.04);
        [-1, 1].forEach(function (sd) { part(new T.SphereGeometry(0.17, 16, 12), aTee, sd * 0.2, 0.66, -0.19, aT).scale.set(1.05, 0.8, 0.6); });   // chest muscle under the shirt
        var aHands = [];
        [-1, 1].forEach(function (sd) {
          var sh = [sd * 0.54, 0.8, 0];
          ink(part(new T.SphereGeometry(0.175, 18, 14), aTee, sh[0], sh[1], sh[2], aT), 1.05);
          var bi = [sd * 0.57, 0.5, -0.09];
          ink(limb(sh, bi, 0.17, aTee, aT), 1.05);                                    // the sleeve, stretched over the arm
          var elbow = [sd * 0.5, 0.4, -0.56], wrist = [sd * 0.26, 0.45, -1.19];
          ink(limb(bi, elbow, 0.125, aSkin, aT), 1.06);                               // upper arm
          ink(part(new T.SphereGeometry(0.1, 14, 12), aSkin, elbow[0], elbow[1], elbow[2], aT), 1.08);
          ink(limb(elbow, wrist, 0.092, aSkin, aT), 1.08);                            // forearm
          var hnd = part(new T.SphereGeometry(0.105, 16, 12), aSkin, sd * 0.24, 0.45, -1.31, aT);
          hnd.scale.set(0.95, 0.5, 1.3); ink(hnd, 1.1); aHands.push(hnd);
        });
        ink(part(new T.CylinderGeometry(0.12, 0.14, 0.22, 16), aSkin, 0, 1.07, -0.02, aT), 1.07);   // thick neck

        // ----- Head: a softly tapered face -----
        var aSkull = part(new T.SphereGeometry(0.3, 32, 22), aSkin, 0, 0, 0, aH);
        aSkull.scale.set(0.93, 1.04, 0.97); ink(aSkull, 1.035);
        var aJaw = part(new T.SphereGeometry(0.2, 24, 16), aSkin, 0, -0.14, -0.07, aH);
        aJaw.scale.set(0.86, 0.9, 0.95); ink(aJaw, 1.045);
        var aChin = part(new T.SphereGeometry(0.1, 16, 12), aSkin, 0, -0.245, -0.12, aH);
        aChin.scale.set(0.78, 0.7, 0.8); ink(aChin, 1.06);
        var aNose = part(new T.SphereGeometry(0.04, 14, 12), aSkin, 0, -0.045, -0.292, aH);
        aNose.scale.set(0.95, 1.15, 1.1); ink(aNose, 1.12);
        var stubM = new T.MeshBasicMaterial({ color: 0x2c1f1a, transparent: true, opacity: 0.4, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
        [aJaw, aChin].forEach(function (src) {                                                       // stubble: a faint dark shell over the jaw and chin
          var sh = new T.Mesh(src.geometry, stubM); sh.scale.set(1.03, 1.03, 1.03); src.add(sh);
        });
        var aMous = part(new T.SphereGeometry(0.06, 14, 10), new T.MeshBasicMaterial({ color: 0x2c1f1a, transparent: true, opacity: 0.45 }), 0, -0.093, -0.283, aH);
        aMous.scale.set(1.5, 0.3, 0.5);
        [-1, 1].forEach(function (sd) {
          var ear = part(new T.SphereGeometry(0.06, 12, 10), aSkin, sd * 0.275, -0.01, 0.02, aH);
          ear.scale.set(0.4, 1, 0.7); ink(ear, 1.1);
        });
        // The face is painted on a curved patch that hugs the front of the head (big anime eyes, brows, nose, mouth, blush)
        var faceTex = canvasTex(512, 580, function (g, w, h) {
          function eye(cx, cy, sd) {
            g.save(); g.translate(cx, cy);
            g.beginPath(); g.moveTo(-56, 8); g.quadraticCurveTo(0, -84, 58, -2); g.quadraticCurveTo(0, 62, -56, 8); g.closePath();   // an almond-shaped eye
            g.fillStyle = '#f7f1ec'; g.fill();
            g.save(); g.clip();
            var ig = g.createLinearGradient(0, -34, 0, 34); ig.addColorStop(0, '#2b170d'); ig.addColorStop(0.5, '#5a3017'); ig.addColorStop(1, '#a8672c');
            g.fillStyle = ig; g.beginPath(); g.arc(sd * 4, -2, 38, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#0c0606'; g.beginPath(); g.arc(sd * 4, -2, 17, 0, Math.PI * 2); g.fill();
            g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(sd * -8, -15, 10, 0, Math.PI * 2); g.fill();
            g.beginPath(); g.arc(sd * 16, 14, 5, 0, Math.PI * 2); g.fill();
            g.restore();
            g.strokeStyle = '#150c0c'; g.lineCap = 'round'; g.lineWidth = 8;                         // the upper lash line
            g.beginPath(); g.moveTo(-sd * 58, 8); g.quadraticCurveTo(0, -88, sd * 60, -3); g.lineTo(sd * 72, -11); g.stroke();
            g.lineWidth = 3; g.strokeStyle = 'rgba(70,35,20,0.7)'; g.beginPath(); g.moveTo(-sd * 42, -30); g.quadraticCurveTo(0, -78, sd * 42, -34); g.stroke();   // lid crease
            g.restore();
          }
          eye(w / 2 - 104, 268, -1); eye(w / 2 + 104, 268, 1);
          g.strokeStyle = '#17110f'; g.lineCap = 'round';
          [-1, 1].forEach(function (sd) {                                                           // strong, slightly raised brows
            g.lineWidth = 17; g.beginPath(); g.moveTo(w / 2 + sd * 56, 196); g.quadraticCurveTo(w / 2 + sd * 118, 170, w / 2 + sd * 178, 190); g.stroke();
          });
          g.strokeStyle = 'rgba(110,55,35,0.7)'; g.lineWidth = 6;                                   // nose: shaded side and nostrils
          g.beginPath(); g.moveTo(w / 2 + 10, 322); g.quadraticCurveTo(w / 2 + 26, 352, w / 2 + 4, 372); g.stroke();
          g.fillStyle = 'rgba(80,38,25,0.55)';
          g.beginPath(); g.ellipse(w / 2 - 20, 376, 9, 6, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(w / 2 + 22, 376, 9, 6, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#6e2823'; g.beginPath();                                                   // an open, easy smile
          g.moveTo(w / 2 - 50, 432); g.quadraticCurveTo(w / 2, 450, w / 2 + 52, 428); g.quadraticCurveTo(w / 2 + 34, 472, w / 2 - 6, 474); g.quadraticCurveTo(w / 2 - 38, 468, w / 2 - 50, 432); g.fill();
          g.fillStyle = '#f6f0ea'; g.beginPath(); g.moveTo(w / 2 - 42, 436); g.quadraticCurveTo(w / 2, 450, w / 2 + 44, 432); g.lineTo(w / 2 + 38, 448); g.quadraticCurveTo(w / 2, 458, w / 2 - 36, 450); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(70,30,22,0.85)'; g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2 - 52, 431); g.quadraticCurveTo(w / 2, 448, w / 2 + 54, 427); g.stroke();
          g.fillStyle = 'rgba(255,110,90,0.14)';                                                    // faint warmth in the cheeks
          g.beginPath(); g.ellipse(w / 2 - 160, 360, 40, 22, 0, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.ellipse(w / 2 + 160, 360, 40, 22, 0, 0, Math.PI * 2); g.fill();
        });
        var facePatch = new T.Mesh(new T.SphereGeometry(0.3 * 1.012, 40, 28, Math.PI * 1.5 - 0.58, 1.16, Math.PI * 0.3, Math.PI * 0.42),
          new T.MeshBasicMaterial({ map: faceTex, transparent: true, color: 0xf3f0f2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
        facePatch.scale.set(0.93, 1.04, 0.97);
        aH.add(facePatch);

        // ----- Hair: medium-length, wavy, swept back off the forehead, with curls at the sides and the nape -----
        var cap = part(new T.SphereGeometry(0.326, 32, 20, -Math.PI * 0.3, Math.PI * 1.6, 0, Math.PI * 0.7), aHair, 0, 0.02, 0.025, aH);
        cap.scale.set(0.98, 1.06, 1.04); ink(cap, 1.04);
        var dome = part(new T.SphereGeometry(0.336, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.3), aHair, 0, 0.06, 0, aH);
        dome.scale.set(0.98, 1.1, 1.08); ink(dome, 1.04);
        function lock(x, y, z, r, len, rx, rz, m) {
          var c = part(new T.ConeGeometry(r, len, 10), m || aHair, x, y, z, aH);
          c.rotation.set(rx, 0, rz); ink(c, 1.14); return c;
        }
        function clump(x, y, z, sx, sy, sz, rx, ry, rz, m) {
          var c = part(new T.SphereGeometry(0.1, 16, 12), m || aHair, x, y, z, aH);
          c.scale.set(sx, sy, sz); c.rotation.set(rx, ry, rz); ink(c, 1.07); return c;
        }
        // waves on top, long clumps running front to back, with a soft sweep at the front over to one side
        [[-0.19, 0.31, 0.0, 0.9, 0.8, 1.9, -0.25, 0, 0.25], [-0.1, 0.36, 0.0, 0.95, 0.8, 2.0, -0.3, 0, 0.12], [0.0, 0.385, 0.0, 1.0, 0.8, 2.0, -0.3, 0, 0],
         [0.1, 0.36, 0.0, 0.95, 0.8, 2.0, -0.3, 0, -0.12], [0.19, 0.31, 0.0, 0.9, 0.8, 1.9, -0.25, 0, -0.25]].forEach(function (c) { clump(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8]); });
        clump(0.05, 0.325, -0.19, 1.7, 0.75, 1.0, 0.1, 0, -0.35);                                 // the swept front
        clump(-0.1, 0.3, -0.2, 1.3, 0.7, 0.9, 0.05, 0, 0.45);
        // curls at the temples and sideburns, wavy locks over the ears, curls at the nape
        [-1, 1].forEach(function (sd) {
          lock(sd * 0.215, 0.2, -0.205, 0.05, 0.16, Math.PI + 0.3, sd * 0.4);
          lock(sd * 0.29, 0.0, 0.0, 0.075, 0.34, Math.PI, sd * 0.3);
          lock(sd * 0.27, -0.06, 0.12, 0.07, 0.3, Math.PI - 0.15, sd * 0.45);
        });
        [-0.2, -0.1, 0.0, 0.1, 0.2].forEach(function (x, i) { lock(x, -0.08 - (i % 2) * 0.03, 0.24, 0.07, 0.3, Math.PI - 0.25, (i - 2) * 0.22); });
        [[-0.05, 0.43, -0.03, 0.25], [0.06, 0.42, -0.02, -0.2], [-0.2, 0.34, 0.02, 0.5]].forEach(function (hl) {   // lighter streaks so the hair reads as glossy
          var st = part(new T.SphereGeometry(0.05, 10, 8), aHair2, hl[0], hl[1], hl[2], aH); st.scale.set(0.5, 0.3, 2.4); st.rotation.set(-0.3, 0, hl[3]);
        });

        // ----- Switch over: hide the original torso, head and hair; keep the legs but cel-shade them -----
        oldTorso.forEach(function (o) { o.visible = false; });
        legMeshes.forEach(function (o) { o.material = toon(o.material.color); ink(o, 1.045); });
        chest = aChest; hands.length = 0; aHands.forEach(function (hd) { hands.push(hd); });
        animeOK = true;
      } catch (err) {
        if (window.console) console.warn('Anime figure failed, using the original', err);
        oldTorso.forEach(function (o) { o.visible = true; });
        if (aT && aT.parent) aT.parent.remove(aT);
        if (aH && aH.parent) aH.parent.remove(aH);
      }
    })();

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
    cyl(0.06, 0.06, 0.9, mat(0x303644), 0, -0.45, 0, fan, 8);
    cyl(0.35, 0.3, 0.25, mat(0x303644), 0, -0.95, 0, fan);
    var blades = new T.Group();
    blades.position.y = -0.98;
    fan.add(blades);
    for (var bl = 0; bl < 3; bl++) {
      var arm = new T.Group();
      arm.rotation.y = bl * (Math.PI * 2 / 3);
      blades.add(arm);
      var blade = box(2.4, 0.04, 0.45, mat(0x303644), 1.4, 0, 0, arm);
      blade.rotation.x = 0.12;
    }
    cyl(0.12, 0.12, 0.05, new T.MeshBasicMaterial({ color: 0xeaf4ff }), 0, -1.1, 0, fan);

    /* ---------- Lounge corner by the window: sofa, coffee table, floor lamp, art and a wall shelf ---------- */
    var sofa = new T.Group();
    sofa.position.set(-6.45, 0, 4.95);                               // back against the left wall, facing into the room
    scene.add(sofa);
    var fabricM = mat(0x364058, { roughness: 0.92 });
    var fabricDarkM = mat(0x303a50, { roughness: 0.95 });
    var SL = 3.8;                                                      // length along the wall
    box(1.5, 0.42, SL, fabricDarkM, 0, 0.4, 0, sofa);                  // base
    [-SL / 4, SL / 4].forEach(function (cz) {                          // two seat cushions with rounded fronts
      box(1.15, 0.24, SL / 2 - 0.06, fabricM, 0.1, 0.73, cz, sofa);
      var nose = new T.Mesh(new T.CapsuleGeometry(0.12, SL / 2 - 0.3, 6, 12), fabricM);
      nose.rotation.x = Math.PI / 2; nose.position.set(0.66, 0.73, cz); nose.castShadow = true; sofa.add(nose);
    });
    box(0.36, 1.0, SL, fabricDarkM, -0.6, 1.05, 0, sofa);             // back frame
    [-SL / 4, SL / 4].forEach(function (cz) {                          // back cushions, leaning slightly
      var bcu = box(0.3, 0.72, SL / 2 - 0.1, fabricM, -0.33, 1.2, cz, sofa); bcu.rotation.z = -0.12;
      var top = new T.Mesh(new T.CapsuleGeometry(0.15, SL / 2 - 0.4, 6, 12), fabricM);
      top.rotation.x = Math.PI / 2; top.position.set(-0.38, 1.56, cz); top.castShadow = true; sofa.add(top);
    });
    [-1, 1].forEach(function (sd) {                                    // arms with soft rolled tops
      box(1.5, 0.62, 0.3, fabricDarkM, 0, 0.62, sd * (SL / 2 + 0.1), sofa);
      var roll = new T.Mesh(new T.CapsuleGeometry(0.16, 1.2, 6, 12), fabricDarkM);
      roll.rotation.z = Math.PI / 2; roll.position.set(0, 0.95, sd * (SL / 2 + 0.1)); roll.castShadow = true; sofa.add(roll);
    });
    [[-0.6, -1], [0.6, -1], [-0.6, 1], [0.6, 1]].forEach(function (lp) {
      cyl(0.045, 0.03, 0.2, mat(0x2a1c14), lp[0], 0.1, lp[1] * (SL / 2 + 0.1), sofa, 8);
    });
    // Throw cushions: a patterned one and a pale one at each end
    function cushionTex(bg, fg) {
      return canvasTex(128, 128, function (g, w, h) {
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        g.strokeStyle = fg; g.lineWidth = 4;
        for (var d = -w; d < w * 2; d += 22) { g.beginPath(); g.moveTo(d, 0); g.lineTo(d + h, h); g.stroke(); g.beginPath(); g.moveTo(d + h, 0); g.lineTo(d, h); g.stroke(); }
      });
    }
    var cushA = new T.MeshStandardMaterial({ map: cushionTex('#8591ab', '#d4dcec'), roughness: 0.95 });
    var cushB = new T.MeshStandardMaterial({ map: cushionTex('#c3cddd', '#9aa6bd'), roughness: 0.95 });
    [[1.35, cushA, 0.25], [0.85, cushB, -0.2], [-1.35, cushA, -0.25]].forEach(function (cu) {
      var pil = new T.Mesh(new T.SphereGeometry(1, 20, 14), cu[1]);
      pil.scale.set(0.12, 0.3, 0.32); pil.position.set(-0.2, 1.15, cu[0]); pil.rotation.set(cu[2], 0, -0.25);
      pil.castShadow = true; sofa.add(pil);
    });

    // Coffee table in front of the sofa, with books and a mug
    var coffee = new T.Group(); coffee.position.set(-4.35, 0, 4.95); scene.add(coffee);
    var woodDarkM = mat(0x3a2c2a, { roughness: 0.55 });
    box(1.25, 0.08, 2.3, mat(0x4a3a36, { roughness: 0.45 }), 0, 0.82, 0, coffee);   // top
    box(1.1, 0.05, 2.1, woodDarkM, 0, 0.3, 0, coffee);                               // lower shelf
    [[-0.55, -1.08], [0.55, -1.08], [-0.55, 1.08], [0.55, 1.08]].forEach(function (lp) { box(0.07, 0.8, 0.07, woodDarkM, lp[0], 0.4, lp[1], coffee); });
    [[0x8a5c3c, 0.06], [0xe9c14a, 0.05], [0x2c4ea3, 0.06]].forEach(function (bk2, k) {     // a stack of books on top
      var b2 = box(0.55, bk2[1], 0.75, mat(bk2[0], { roughness: 0.8 }), -0.1, 0.89 + k * 0.06, -0.45, coffee); b2.rotation.y = k * 0.12;
    });
    [0x5b4a7a, 0x2f7d77].forEach(function (bc2, k) { box(0.6, 0.07, 0.8, mat(bc2, { roughness: 0.8 }), 0.05, 0.37 + k * 0.07, 0.4, coffee); });
    cyl(0.1, 0.09, 0.2, mat(0xece6da, { roughness: 0.5 }), 0.2, 0.96, 0.55, coffee, 16);  // mug
    box(0.035, 0.09, 0.035, mat(0xece6da), 0.33, 0.98, 0.55, coffee);

    // Tall floor lamp between the window and the shelves, with a warm glowing shade
    var flamp = new T.Group(); flamp.position.set(-6.7, 0, -3.95); scene.add(flamp);
    var flampM = mat(0x161a22, { roughness: 0.4, metalness: 0.5 });
    cyl(0.3, 0.32, 0.05, flampM, 0, 0.03, 0, flamp, 24);
    cyl(0.025, 0.025, 2.9, flampM, 0, 1.5, 0, flamp, 8);
    var lampShade = new T.Mesh(new T.CylinderGeometry(0.3, 0.36, 0.6, 24, 1, true),
      new T.MeshStandardMaterial({ color: 0xffe2b8, emissive: 0xffb36b, emissiveIntensity: 0.8, roughness: 0.9, side: T.DoubleSide }));
    lampShade.position.y = 3.15; flamp.add(lampShade);
    var flampLight = new T.PointLight(0xffc48a, 1.0, 7, 2);
    flampLight.position.set(-6.5, 3.0, -3.8);
    scene.add(flampLight);

    // Framed prints and a small book shelf on the left wall, above the sofa
    function wallPrint(z, y, w, h, draw) {
      var tex = canvasTex(256, Math.round(256 * h / w), draw);
      box(0.06, h + 0.14, w + 0.14, mat(0x141317, { roughness: 0.5 }), RX0 + 0.18, y, z);
      var pr = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, color: 0xd4dcec }));
      pr.rotation.y = Math.PI / 2; pr.position.set(RX0 + 0.215, y, z); scene.add(pr);
    }
    wallPrint(6.3, 4.3, 1.0, 1.25, function (g, w, h) {              // a figure walking in the rain, in ink
      g.fillStyle = '#e9e4ea'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(40,36,48,0.25)'; g.lineWidth = 1;
      for (var r = 0; r < 70; r++) { var rx = Math.random() * w, ry = Math.random() * h; g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx - 6, ry + 18); g.stroke(); }
      g.fillStyle = '#1f2530';
      g.beginPath(); g.arc(w / 2, h * 0.3, 14, 0, Math.PI * 2); g.fill();                   // head
      g.beginPath(); g.moveTo(w / 2 - 34, h * 0.86); g.lineTo(w / 2 - 18, h * 0.38); g.lineTo(w / 2 + 18, h * 0.38); g.lineTo(w / 2 + 40, h * 0.86); g.fill();   // coat
      g.beginPath(); g.ellipse(w / 2 - 6, h * 0.2, 62, 20, -0.1, Math.PI, 0); g.fill();       // umbrella
      g.fillRect(w / 2 - 7, h * 0.2, 3, h * 0.2);
    });
    wallPrint(7.65, 4.5, 0.9, 0.7, function (g, w, h) {               // soft abstract shapes
      g.fillStyle = '#d9d2dc'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#7a6f86'; g.beginPath(); g.arc(w * 0.35, h * 0.55, h * 0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3d3647'; g.fillRect(w * 0.55, h * 0.2, w * 0.25, h * 0.6);
      g.strokeStyle = '#4fe3ff'; g.lineWidth = 4; g.beginPath(); g.moveTo(w * 0.1, h * 0.85); g.lineTo(w * 0.9, h * 0.85); g.stroke();
    });
    // Small wall shelf with books and a few trinkets, further along
    var wshelf = new T.Group(); wshelf.position.set(RX0 + 0.45, 2.85, 7.0); scene.add(wshelf);
    box(0.55, 0.08, 1.9, mat(C.desk), 0, 0, 0, wshelf);
    var wsColors = [0xc4553f, 0xe9c14a, 0x2c4ea3, 0xece6da, 0x2f7d77, 0x5b4a7a];
    for (var wb = 0; wb < 6; wb++) {
      var wbh = 0.45 + (wb % 3) * 0.08;
      box(0.36, wbh, 0.12, mat(wsColors[wb], { roughness: 0.8 }), 0, 0.04 + wbh / 2, -0.8 + wb * 0.13, wshelf);
    }
    cyl(0.1, 0.08, 0.2, mat(0xd9d2c8, { roughness: 0.6 }), 0, 0.14, 0.45, wshelf, 14);   // tiny pot
    [0.1, 0.25, 0.4].forEach(function (lz) {
      var sm = new T.Mesh(new T.SphereGeometry(0.07, 10, 8), mat(0x3f8a3e)); sm.position.set(0, 0.3, 0.38 + lz * 0.2); wshelf.add(sm);
    });
    box(0.18, 0.18, 0.18, mat(0x8a5c3c), 0, 0.13, 0.75, wshelf);                           // a little wooden box

    /* ---------- Media cabinet along the back wall: turntable, records and a ring-lit speaker ---------- */
    var cab = new T.Group();
    cab.position.set(7.9, 0, -5.3);
    scene.add(cab);
    var cabM = mat(0x1f242e, { roughness: 0.55 }), cabTopM = mat(0x2a303c, { roughness: 0.45 });
    box(4.2, 0.1, 1.0, cabTopM, 0, 1.15, 0, cab);                                         // top
    box(4.1, 0.95, 0.94, cabM, 0, 0.62, 0, cab);                                          // body
    [-1.95, 1.95].forEach(function (lx) { box(0.08, 0.16, 0.08, mat(C.metal), lx, 0.08, 0.36, cab); box(0.08, 0.16, 0.08, mat(C.metal), lx, 0.08, -0.36, cab); });
    box(1.3, 0.62, 0.02, mat(0x161a22), -1.25, 0.66, 0.475, cab);                         // open shelf on the left
    box(1.2, 0.04, 0.4, mat(0x111015), -1.25, 0.9, 0.3, cab);                             // an amp in it
    [0.2, 1.35].forEach(function (dx) {                                                   // two doors with slim handles
      box(1.08, 0.82, 0.02, mat(0x262c38, { roughness: 0.5 }), dx, 0.63, 0.48, cab);
      box(0.03, 0.3, 0.03, mat(0x8d8698, { metalness: 0.6 }), dx - 0.44, 0.66, 0.5, cab);
    });
    // Turntable
    var tt = new T.Group(); tt.position.set(-1.35, 1.2, 0.05); cab.add(tt);
    box(1.0, 0.14, 0.8, mat(0x161a20, { roughness: 0.4 }), 0, 0.07, 0, tt);
    var platter = new T.Group(); platter.position.set(-0.1, 0.16, 0); tt.add(platter);       // spins while music plays
    cyl(0.34, 0.34, 0.03, mat(0x0d0c10, { roughness: 0.3 }), 0, 0, 0, platter, 32);
    cyl(0.11, 0.11, 0.032, mat(0x19d9ff, { roughness: 0.6 }), 0, 0.005, 0, platter, 20);  // record label
    box(0.03, 0.034, 0.1, mat(0xe6fbff), 0.05, 0.006, 0, platter);                          // a mark on the label, so you can see it turn
    var tone = box(0.03, 0.03, 0.55, mat(0x9a95a4, { metalness: 0.7, roughness: 0.3 }), 0.33, 0.21, 0.02, tt); tone.rotation.y = 0.35;
    cyl(0.05, 0.05, 0.08, mat(0x9a95a4, { metalness: 0.7 }), 0.38, 0.18, -0.25, tt, 12);
    var dust = box(1.02, 0.02, 0.82, new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.1 }), 0, 0.55, -0.42, tt);
    dust.rotation.x = -1.2;                                                                // lid propped open
    // A short stack of records lying flat
    [0x2b2733, 0xe9c14a, 0x3e6e8c].forEach(function (rc, k) {
      var rr = box(0.62, 0.025, 0.62, mat(rc, { roughness: 0.7 }), -0.35, 1.215 + k * 0.026, 0.05, cab); rr.rotation.y = k * 0.18 - 0.1;
    });
    // Records standing in a row
    var sleeveColors = [0xc4553f, 0x2c4ea3, 0xece6da, 0x5b4a7a, 0xe9c14a, 0x2f7d77, 0x181c24, 0x19d9ff, 0x8a5c3c, 0x3e6e8c, 0xd9741c, 0x4a4458];
    for (var rv = 0; rv < 12; rv++) {
      var sl2 = box(0.035, 0.66, 0.66, mat(sleeveColors[rv], { roughness: 0.8 }), 0.35 + rv * 0.06, 1.53, 0.0, cab);
      sl2.rotation.z = -0.12 + (rv === 11 ? -0.15 : 0);
    }
    box(0.04, 0.4, 0.5, mat(C.metal), 1.1, 1.4, 0, cab);                                   // bookend
    // Speaker with a glowing pink ring
    box(0.64, 0.9, 0.55, mat(0x181c24, { roughness: 0.5 }), 1.68, 1.65, 0, cab);
    var ring = new T.Mesh(new T.RingGeometry(0.16, 0.21, 40), new T.MeshBasicMaterial({ color: C.neon, side: T.DoubleSide }));
    ring.position.set(1.68, 1.68, 0.28);
    cab.add(ring);
    cyl(0.15, 0.15, 0.02, mat(0x0f0e12), 1.68, 1.68, 0.28, cab, 24).rotation.x = Math.PI / 2;
    var speakerGlow = new T.PointLight(0x19d9ff, 0.6, 3.2, 2);
    speakerGlow.position.set(9.6, 1.9, -4.5);
    scene.add(speakerGlow);

    /* ---------- Acoustic guitar leaning on the back wall, between the desk and the cabinet ---------- */
    var guitar = new T.Group();
    guitar.position.set(4.85, 0.0, -5.12);
    guitar.rotation.set(-0.2, -0.22, 0.03, 'YXZ');                 // leaning back against the wall
    guitar.scale.set(1.4, 1.4, 1.4);                                // full size: the headstock reaches just under the board
    scene.add(guitar);
    // Natural wood top: light honey spruce, only a touch warmer towards the edge
    var burstTex = canvasTex(256, 256, function (g, w, h) {
      var rg = g.createRadialGradient(w / 2, h * 0.6, 8, w / 2, h * 0.6, w * 0.62);   // canvas is flipped onto the top, so 0.6 down = 0.4 up the body
      rg.addColorStop(0, '#e6b262'); rg.addColorStop(0.55, '#d69d4a'); rg.addColorStop(0.85, '#b87a33'); rg.addColorStop(1, '#7c4a1e');
      g.fillStyle = rg; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(120,70,30,0.1)'; g.lineWidth = 1;          // fine spruce grain
      for (var gx = 0; gx < w; gx += 5) { g.beginPath(); g.moveTo(gx, 0); g.lineTo(gx + 2, h); g.stroke(); }
    });
    var gSideM = mat(0x8a5a2b, { roughness: 0.4 }), gDarkM = mat(0x2a1a12, { roughness: 0.5 });
    var gTopM = new T.MeshStandardMaterial({ map: burstTex, roughness: 0.42 });
    var bindM = mat(0x2a1a12, { roughness: 0.5 });
    var BW = 0.42, BH = 1.0, BD = 0.13;                              // half width, body length, depth
    if (T.Shape && T.ExtrudeGeometry) {
      // the body outline: wide lower bout, narrow waist, rounded shoulders
      var gs = new T.Shape();
      gs.moveTo(0, 0);
      gs.bezierCurveTo(0.3, 0, BW, 0.12, BW, 0.3);
      gs.bezierCurveTo(BW, 0.45, 0.27, 0.5, 0.265, 0.56);
      gs.bezierCurveTo(0.26, 0.62, 0.335, 0.66, 0.335, 0.8);
      gs.bezierCurveTo(0.335, 0.95, 0.18, BH, 0.07, BH);
      gs.lineTo(-0.07, BH);
      gs.bezierCurveTo(-0.18, BH, -0.335, 0.95, -0.335, 0.8);
      gs.bezierCurveTo(-0.335, 0.66, -0.26, 0.62, -0.265, 0.56);
      gs.bezierCurveTo(-0.27, 0.5, -BW, 0.45, -BW, 0.3);
      gs.bezierCurveTo(-BW, 0.12, -0.3, 0, 0, 0);
      var bodyGeo = new T.ExtrudeGeometry(gs, { depth: BD, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 28 });
      if (burstTex.repeat) { burstTex.repeat.set(1 / (BW * 2), 1 / BH); burstTex.offset.set(0.5, 0); }   // map the top's shape coords onto the texture
      var gBody = new T.Mesh(bodyGeo, [gTopM, gSideM]);              // caps get the wood top, the sides a darker brown
      var bindGeo = new T.ShapeGeometry(gs, 28);                     // dark binding: a hairline around the top's edge
      var binding = new T.Mesh(bindGeo, bindM);
      binding.scale.set(1.05, 1.035, 1); binding.position.set(0, -0.017, BD / 2 + 0.006);
      guitar.add(binding);
      gBody.position.z = -BD / 2;
      gBody.castShadow = true; gBody.receiveShadow = true;
      guitar.add(gBody);
    } else {
      box(BW * 2, BH, BD, gSideM, 0, BH / 2, 0, guitar);
    }
    var FZ = BD / 2 + 0.01;                                          // just in front of the top
    cyl(0.085, 0.085, 0.01, mat(0x0c0806), 0, 0.64, FZ, guitar, 28).rotation.x = Math.PI / 2;   // sound hole
    var rosette = new T.Mesh(new T.RingGeometry(0.09, 0.11, 32), new T.MeshStandardMaterial({ color: 0xe9dcc4, roughness: 0.5 }));
    rosette.position.set(0, 0.64, FZ + 0.002); guitar.add(rosette);
    var guard = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.004, 24, 1, false, Math.PI * 0.9, Math.PI * 0.9), mat(0x150d09, { roughness: 0.35 }));
    guard.rotation.x = Math.PI / 2; guard.position.set(0.05, 0.6, FZ); guitar.add(guard);       // pickguard
    box(0.24, 0.045, 0.02, gDarkM, 0, 0.24, FZ + 0.005, guitar);   // bridge
    box(0.15, 0.006, 0.006, mat(0xece6da), 0, 0.255, FZ + 0.016, guitar);   // saddle
    // neck, fretboard, frets
    var NECK0 = BH - 0.02, NECKL = 0.86;
    box(0.085, NECKL, 0.06, mat(0xa8763f, { roughness: 0.5 }), 0, NECK0 + NECKL / 2, 0.03, guitar);
    box(0.08, NECKL + 0.12, 0.014, gDarkM, 0, NECK0 + NECKL / 2 - 0.06, 0.067, guitar);
    for (var fr = 1; fr <= 14; fr++) {
      var fy = NECK0 + NECKL - NECKL * (1 - Math.pow(2, -fr / 12)) * 1.6;   // frets bunch up towards the body
      if (fy > NECK0 - 0.1) box(0.08, 0.004, 0.004, mat(0xb8b2a6, { metalness: 0.7, roughness: 0.3 }), 0, fy, 0.075, guitar);
    }
    // headstock with tuners
    var headY = NECK0 + NECKL;
    box(0.075, 0.012, 0.016, mat(0xece6da), 0, headY, 0.072, guitar);   // nut
    var gHead = new T.Group(); gHead.position.set(0, headY, 0.03); gHead.rotation.x = -0.25; guitar.add(gHead);
    box(0.12, 0.26, 0.035, gDarkM, 0, 0.13, 0, gHead);
    [-1, 1].forEach(function (sd) {
      for (var pg = 0; pg < 3; pg++) {
        var peg = cyl(0.012, 0.012, 0.06, mat(0xb8b2a6, { metalness: 0.8, roughness: 0.25 }), sd * 0.085, 0.06 + pg * 0.075, -0.005, gHead, 8);
        peg.rotation.z = Math.PI / 2;
      }
    });
    // six fine strings, from the bridge up to the nut
    var stringM = mat(0xa9a196, { metalness: 0.6, roughness: 0.35 });
    var sLen = headY - 0.255;
    for (var st = 0; st < 6; st++) box(0.0025, sLen, 0.0025, stringM, -0.03 + st * 0.012, 0.255 + sLen / 2, FZ + 0.012, guitar);

    /* ---------- Two neon art prints on the back wall ---------- */
    function poster(x, y, w, h, edge, draw) {
      var tex = canvasTex(320, Math.round(320 * h / w), draw);
      box(w + 0.12, h + 0.12, 0.06, mat(0x141317, { roughness: 0.5 }), x, y, RZ0 + 0.2);
      var pm = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex }));
      pm.position.set(x, y, RZ0 + 0.235);
      scene.add(pm);
      var em = new T.MeshBasicMaterial({ color: edge });
      box(w + 0.16, 0.03, 0.03, em, x, y + h / 2 + 0.08, RZ0 + 0.24); box(w + 0.16, 0.03, 0.03, em, x, y - h / 2 - 0.08, RZ0 + 0.24);
      box(0.03, h + 0.16, 0.03, em, x - w / 2 - 0.08, y, RZ0 + 0.24); box(0.03, h + 0.16, 0.03, em, x + w / 2 + 0.08, y, RZ0 + 0.24);
    }
    // A retro sunset over a grid, with a palm
    poster(6.95, 4.7, 1.25, 1.6, 0x19d9ff, function (g, w, h) {
      var bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#08142e'); bg.addColorStop(0.55, '#0b4a6e'); bg.addColorStop(0.62, '#071a33'); bg.addColorStop(1, '#040b18');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      var sun = g.createLinearGradient(0, h * 0.2, 0, h * 0.58);
      sun.addColorStop(0, '#d9fbff'); sun.addColorStop(1, '#19d9ff');
      g.fillStyle = sun; g.beginPath(); g.arc(w / 2, h * 0.45, w * 0.3, Math.PI, 0); g.fill();
      g.fillStyle = '#0b4a6e';
      for (var b = 0; b < 5; b++) g.fillRect(w * 0.18, h * (0.36 + b * 0.02), w * 0.64, 3 + b);   // sun stripes
      g.strokeStyle = '#19d9ff'; g.lineWidth = 2;
      for (var gl = 0; gl < 8; gl++) { var gy = h * 0.62 + Math.pow(gl / 7, 1.7) * h * 0.38; g.beginPath(); g.moveTo(0, gy); g.lineTo(w, gy); g.stroke(); }
      for (var gv = -6; gv <= 6; gv++) { g.beginPath(); g.moveTo(w / 2 + gv * 8, h * 0.62); g.lineTo(w / 2 + gv * 70, h); g.stroke(); }
      g.fillStyle = '#040b18';                                                              // palm silhouette
      g.fillRect(w * 0.78, h * 0.28, 7, h * 0.36);
      for (var pf = 0; pf < 7; pf++) {
        var pa = -Math.PI + pf * (Math.PI / 6);
        g.beginPath(); g.moveTo(w * 0.79, h * 0.28);
        g.quadraticCurveTo(w * 0.79 + Math.cos(pa) * 40, h * 0.28 + Math.sin(pa) * 30 - 10, w * 0.79 + Math.cos(pa) * 70, h * 0.28 + Math.sin(pa) * 20 + 22);
        g.lineWidth = 6; g.strokeStyle = '#040b18'; g.stroke();
      }
    });
    // A night drive: neon skyline inside a ring
    poster(8.75, 4.55, 1.2, 1.5, 0x5b8cff, function (g, w, h) {
      g.fillStyle = '#080e1c'; g.fillRect(0, 0, w, h);
      g.shadowColor = '#19d9ff'; g.shadowBlur = 18;
      g.strokeStyle = '#4fe3ff'; g.lineWidth = 6;
      g.beginPath(); g.arc(w / 2, h * 0.42, w * 0.34, 0, Math.PI * 2); g.stroke();
      g.shadowBlur = 0;
      g.fillStyle = '#142a52';
      [[0.22, 0.5], [0.3, 0.36], [0.4, 0.44], [0.5, 0.3], [0.6, 0.42], [0.7, 0.34], [0.78, 0.5]].forEach(function (bd) {
        g.fillRect(w * bd[0] - 16, h * bd[1], 32, h * 0.62 - h * bd[1]);
      });
      g.fillStyle = '#d6f7ff';
      for (var wl = 0; wl < 40; wl++) g.fillRect(between(w * 0.2, w * 0.8), between(h * 0.32, h * 0.6), 3, 4);
      g.fillStyle = '#19d9ff'; g.fillRect(0, h * 0.62, w, 3);
      g.fillStyle = '#9fc2ff'; g.font = '700 26px ' + '"Instrument Sans", Arial, sans-serif'; g.textAlign = 'center';
      if ('letterSpacing' in g) g.letterSpacing = '6px';
      g.fillText('NIGHT DRIVE', w / 2, h * 0.82);
    });

    /* ---------- Reading corner: leather armchair and a small round table ---------- */
    var armchair = new T.Group();
    armchair.position.set(7.4, 0, 1.6);
    armchair.rotation.y = -2.25;                                         // facing back into the room
    scene.add(armchair);
    var leatherM = mat(0x333c52, { roughness: 0.42, metalness: 0.05 });
    var cushionM = mat(0x3b4560, { roughness: 0.45 });
    function rounded(w, h, d, m, x, y, z, parent) {                   // a softened block: a box with capsule edges
      var g0 = new T.Group(); g0.position.set(x, y, z); (parent || scene).add(g0);
      box(w - 0.2, h, d, m, 0, 0, 0, g0);
      [-1, 1].forEach(function (sd) {
        var c = new T.Mesh(new T.CapsuleGeometry(0.1, Math.max(0.01, h - 0.2), 6, 12), m);
        c.position.set(sd * (w / 2 - 0.1), 0, 0); c.scale.set(1, 1, d / 0.2);
        c.castShadow = true; c.receiveShadow = true; g0.add(c);
      });
      return g0;
    }
    rounded(1.8, 0.55, 1.6, leatherM, 0, 0.55, 0, armchair);              // base
    rounded(1.4, 0.24, 1.25, cushionM, 0, 0.95, 0.12, armchair);          // seat cushion
    var backRest = rounded(1.8, 1.25, 0.4, leatherM, 0, 1.45, -0.62, armchair); backRest.rotation.x = -0.12;
    [-1, 1].forEach(function (sd) {
      var armRest = new T.Mesh(new T.CapsuleGeometry(0.2, 1.1, 8, 16), leatherM);
      armRest.rotation.x = Math.PI / 2; armRest.position.set(sd * 0.8, 1.05, 0.05);
      armRest.castShadow = true; armchair.add(armRest);
    });
    [[-0.7, 0.6], [0.7, 0.6], [-0.7, -0.6], [0.7, -0.6]].forEach(function (lp) { cyl(0.04, 0.03, 0.3, mat(0x2a1c14), lp[0], 0.15, lp[1], armchair, 8); });
    var sideT = new T.Group(); sideT.position.set(5.3, 0, 2.7); scene.add(sideT);
    cyl(0.58, 0.58, 0.06, mat(0x242a36, { roughness: 0.4 }), 0, 1.25, 0, sideT, 32);
    cyl(0.04, 0.04, 1.2, mat(C.metal, { metalness: 0.5 }), 0, 0.62, 0, sideT, 10);
    [0, 2.1, 4.2].forEach(function (la2) {
      var ft = box(0.05, 0.04, 0.5, mat(C.metal, { metalness: 0.5 }), Math.sin(la2) * 0.2, 0.03, Math.cos(la2) * 0.2, sideT); ft.rotation.y = la2;
    });
    cyl(0.12, 0.1, 0.24, mat(0xece6da, { roughness: 0.5 }), 0.18, 1.4, 0.12, sideT, 18);         // mug
    box(0.04, 0.1, 0.04, mat(0xece6da), 0.33, 1.42, 0.12, sideT);
    var tbook = box(0.5, 0.08, 0.36, mat(0x232a37, { roughness: 0.7 }), -0.15, 1.32, -0.1, sideT); tbook.rotation.y = 0.4;

    /* ---------- Plants: trailing pothos ---------- */
    var pothosTex = canvasTex(64, 64, function (g, w, h) {
      g.fillStyle = '#3f8a3e';
      g.beginPath(); g.moveTo(w / 2, h * 0.95);
      g.bezierCurveTo(w * 0.05, h * 0.6, w * 0.1, h * 0.05, w / 2, h * 0.22);
      g.bezierCurveTo(w * 0.9, h * 0.05, w * 0.95, h * 0.6, w / 2, h * 0.95); g.fill();
      g.strokeStyle = 'rgba(190,230,140,0.6)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(w / 2, h * 0.9); g.lineTo(w / 2, h * 0.3); g.stroke();
    });
    var pothosM = new T.MeshStandardMaterial({ map: pothosTex, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.65 });
    var pothosGeo = new T.PlaneGeometry(0.27, 0.27);

    // Pothos in hanging pots, trailing down beside the window
    function hangingPlant(x, z, potY) {
      var hp = new T.Group(); hp.position.set(x, potY, z); scene.add(hp);
      cyl(0.32, 0.22, 0.38, mat(0xd9d2c8, { roughness: 0.6 }), 0, 0, 0, hp, 20);
      [0, 2.1, 4.2].forEach(function (ca) {                                    // three cords up to the ceiling
        var len = RH - potY - 0.15, cx2 = Math.cos(ca) * 0.28, cz2 = Math.sin(ca) * 0.28;
        var cord = box(0.012, Math.hypot(len, 0.28), 0.012, mat(0x8c7a64), cx2 / 2, 0.15 + len / 2, cz2 / 2, hp);
        cord.rotation.set(Math.atan2(cz2, len), 0, -Math.atan2(cx2, len));
      });
      for (var tl = 0; tl < 26; tl++) {                                         // a mound of leaves on top
        var tlf = new T.Mesh(pothosGeo, pothosM);
        tlf.position.set(between(-0.28, 0.28), 0.2 + between(0, 0.12), between(-0.28, 0.28));
        tlf.rotation.set(between(-1.2, -0.2), between(0, 6.28), 0); hp.add(tlf);
      }
      for (var vn = 0; vn < 16; vn++) {                                         // vines
        var va = vn * 0.4 + between(-0.2, 0.2), vlen = Math.floor(between(10, 20));
        var vx = Math.cos(va) * 0.3, vz = Math.sin(va) * 0.3, vy = 0.12;
        for (var vk = 0; vk < vlen; vk++) {
          vx += Math.cos(va) * 0.025 + between(-0.02, 0.02); vz += Math.sin(va) * 0.025 + between(-0.02, 0.02); vy -= 0.1;
          var vl = new T.Mesh(pothosGeo, pothosM);
          vl.position.set(vx + between(-0.05, 0.05), vy, vz + between(-0.05, 0.05));
          vl.rotation.set(between(-0.6, 0.6), between(0, 6.28), between(-0.4, 0.4));
          var vs = 1 - vk / (vlen * 1.6); vl.scale.set(vs, vs, vs);
          hp.add(vl);
        }
      }
    }
    hangingPlant(-7.1, 5.0, 5.9);
    hangingPlant(-7.1, -4.9, 6.1);
    // and one more trailing off the end of the lower shelf
    (function () {
      for (var sv = 0; sv < 4; sv++) {
        var sx = -5.95 + sv * 0.07, sy = 3.5, sz = -5.35 + sv * 0.05;
        for (var sk = 0; sk < 7 + sv; sk++) {
          var svl = new T.Mesh(pothosGeo, pothosM);
          svl.position.set(sx + between(-0.06, 0.06), sy - sk * 0.13, sz + between(-0.04, 0.08));
          svl.rotation.set(between(-0.6, 0.6), between(-1, 1), between(-0.4, 0.4));
          scene.add(svl);
        }
      }
      cyl(0.14, 0.11, 0.26, mat(0xd9d2c8, { roughness: 0.6 }), -5.85, 3.59, -5.45, scene, 16);
    })();

    /* ---------- Views: where the camera goes for each section ---------- */
    var VIEWS = {
      home:     { pos: [9.8, 5.5, 9.8],  look: [-1.0, 2.6, -2.4] },
      projects: { pos: [-0.3, 3.05, 0.2], look: [-0.3, 3.03, -2.65] },
      work:     { pos: [4.6, 3.95, -0.3], look: [4.6, 3.95, -5.8] },   // off-centre so the panel sits beside the board
      about:    { pos: [-3.4, 4.25, -0.9], look: [-3.4, 4.0, -5.55] },   // shelf on the left, the open notebook on the right
      contact:  { pos: [1.55, 2.57, -0.3], look: [1.55, 2.55, -1.45] }
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
      var lx = cam.lx, ly = cam.ly, lz = cam.lz;
      if (current === 'home' && tallScreen()) {
        // Phones stand in the corner, so turn the head instead of walking around
        var tx = lx - x, tz = lz - z;
        var tr = Math.hypot(tx, tz), ta = Math.atan2(tx, tz) + yaw;
        lx = x + Math.sin(ta) * tr;
        lz = z + Math.cos(ta) * tr;
        ly = ly - pitch * 6;
      } else if (current === 'home') {
        // Swing the camera around the look point by the drag amount
        var dx = x - cam.lx, dz = z - cam.lz;
        var r = Math.hypot(dx, dz), a = Math.atan2(dx, dz) + yaw;
        x = cam.lx + Math.sin(a) * r;
        z = cam.lz + Math.cos(a) * r;
        y = y + pitch * 6;
      }
      if (lens.fov !== camera.fov) { camera.fov = lens.fov; camera.updateProjectionMatrix(); }
      camera.position.set(x, y, z);
      camera.lookAt(lx, ly, lz);
    }

    /* On small screens each view is re-framed so its object fits the screen,
       sitting above the sheet that slides up from the bottom */
    var FIT = {
      projects: { w: 2.5, h: 1.5, shift: 0.26 },
      work:     { w: 4.7, h: 2.5, shift: 0.24, look: [3.65, 4.15, -5.8] },
      about:    { w: 3.4, h: 2.4, shift: 0.24, look: [-4.4, 4.1, -5.55] },
      contact:  { w: 0.34, h: 0.66, shift: 0.03, margin: 1.28 }
    };
    function isCompact() { return window.innerWidth < 900 || window.innerHeight < 500; }
    function tallScreen() { return camera.aspect < 1; }
    // Lens: tall screens use a wide lens at home so the whole room fits; pinch or scroll zooms in
    var lens = { fov: 40 }, zoom = 1, ZOOM_MAX = 2.4;
    function deg(r) { return r * 180 / Math.PI; }
    function rad(d) { return d * Math.PI / 180; }
    function homeFov() {
      if (!tallScreen()) return 40;
      return Math.min(84, Math.max(40, deg(2 * Math.atan(Math.tan(rad(24.5)) / camera.aspect))));   // about 49 degrees across
    }
    function sectionFov() { return tallScreen() ? 55 : 40; }
    function fovFor(name) {
      if (name !== 'home') return sectionFov();
      return deg(2 * Math.atan(Math.tan(rad(homeFov() / 2)) / zoom));
    }
    function setZoom(z) {
      zoom = Math.max(1, Math.min(ZOOM_MAX, z));
      if (current !== 'home') return;
      if (window.gsap && gsap.killTweensOf) gsap.killTweensOf(lens);
      lens.fov = fovFor('home');
      if (zoom === 1) { yawTarget = 0; pitchTarget = 0; }   // zoomed all the way out: back to the full view
    }
    function framed(name) {
      var v = VIEWS[name];
      if (!isCompact()) return v;
      if (name === 'home') {
        // Tall screens: stand back in the far corner, where a wide lens takes in the window, shelf, desk and board
        return tallScreen() ? { pos: [12.3, 6.3, 13.3], look: [-1.0, 2.7, -2.4] } : v;
      }
      var f = FIT[name];
      if (!f) return v;
      var look = f.look || v.look;
      if (name === 'work' && camera.aspect > 1.4) {   // sideways phone: board on the left, panel on the right
        f = { w: f.w * 2.1, h: f.h, shift: 0, look: [look[0] + f.w * 0.55, look[1], look[2]] };
        look = f.look;
      }
      var dir = [v.pos[0] - v.look[0], v.pos[1] - v.look[1], v.pos[2] - v.look[2]];
      var len = Math.hypot(dir[0], dir[1], dir[2]);
      var t = Math.tan(sectionFov() * Math.PI / 360);
      var d = Math.max(f.h / 2 / t, f.w / 2 / (t * camera.aspect)) * (f.margin || 1.12);
      var drop = 2 * d * t * f.shift;                  // move the object up the screen
      return {
        pos: [look[0] + dir[0] / len * d, look[1] + dir[1] / len * d - drop, look[2] + dir[2] / len * d],
        look: [look[0], look[1] - drop, look[2]]
      };
    }

    function flyTo(name) {
      var v = VIEWS[name];
      if (!v) return;
      v = framed(name);
      current = name === 'home' ? 'home' : name;
      yawTarget = 0; pitchTarget = 0;
      if (name === 'home' || name === 'projects') lookAt(-0.3, 3.03, -2.6);   // back to the screen
      else lookAt(v.look[0], v.look[1], v.look[2]);                         // turn toward what you opened
      var to = { x: v.pos[0], y: v.pos[1], z: v.pos[2], lx: v.look[0], ly: v.look[1], lz: v.look[2] };
      if (window.gsap) {
        gsap.to(cam, Object.assign({ duration: 1.4, ease: 'power3.inOut', overwrite: true }, to));
        gsap.to(lens, { fov: fovFor(name), duration: 1.4, ease: 'power3.inOut', overwrite: true });
      } else {
        Object.assign(cam, to);
        lens.fov = fovFor(name);
      }
      syncUi(name);
    }

    /* ---------- Section panels (every section now has its own object; kept for future ones) ---------- */
    var SECTION_TEXT = {};

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
      showPhone(name === 'contact');
      showBook(name === 'about');
      if (name === 'projects' || name === 'contact' || name === 'about') {
        panel.hidden = true;
      } else if (name === 'work') {
        renderWorkPanel();
        panel.hidden = false;
        if (window.gsap) gsap.fromTo(panel, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, delay: 0.9, ease: 'power2.out' });
      } else if (inSection && SECTION_TEXT[name]) {
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
      if (isCompact()) {                              // phones: a sheet, styled in CSS
        if (deskUi.style.left) deskUi.removeAttribute('style');
        return;
      }
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

    /* ---------- Contact: the phone lifts off the desk and shows how to reach you ---------- */
    var EMAIL = 'abrark.3957@gmail.com';
    var RESUME = 'Abrar-Sami-Khan-Resume.pdf';
    var phoneUi = layer.querySelector('.room-phone');
    var contactLine = document.querySelector('.contact__text');
    var LINK_ICONS = {
      mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 7 8.5-7"/>',
      in: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>',
      gh: '<path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5a3 3 0 0 0-.9-2.4c3-.3 6-1.5 6-6.6a5 5 0 0 0-1.4-3.5 4.6 4.6 0 0 0-.1-3.5s-1.1-.3-3.6 1.4a12.5 12.5 0 0 0-6.5 0C6 1.2 4.9 1.5 4.9 1.5a4.6 4.6 0 0 0-.1 3.5A5 5 0 0 0 3.4 8.5c0 5 3 6.3 6 6.6a3 3 0 0 0-.9 2.4V21"/>',
      cv: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'
    };
    function phoneRow(href, icon, label, sub, attrs) {
      return '<a class="room-phone__row" href="' + href + '"' + (attrs || '') + '>' +
        '<span class="room-phone__icon"><svg viewBox="0 0 24 24" aria-hidden="true">' + LINK_ICONS[icon] + '</svg></span>' +
        '<span class="room-phone__label">' + label + '<small>' + sub + '</small></span></a>';
    }
    phoneUi.innerHTML =
      '<div class="room-phone__island" aria-hidden="true"></div>' +
      '<div class="room-phone__status" aria-hidden="true"><span class="room-phone__clock"></span>' +
        '<span class="room-phone__icons"><span class="room-phone__signal"><i></i><i></i><i></i><i></i></span>' +
        '<svg class="room-phone__wifi" viewBox="0 0 16 12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0zM3.4 6.8a6.5 6.5 0 0 1 9.2 0l-1.3 1.3a4.6 4.6 0 0 0-6.6 0zM1.2 4.6a9.6 9.6 0 0 1 13.6 0l-1.3 1.3a7.8 7.8 0 0 0-11 0z"/></svg>' +
        '<span class="room-phone__battery"></span></span></div>' +
      '<p class="room-phone__time" aria-hidden="true"></p>' +
      '<p class="room-phone__date"></p>' +
      '<div class="room-phone__card">' +
        '<h2 class="room-phone__name">Abrar Sami Khan</h2>' +
        '<p class="room-phone__text">' + (contactLine ? esc(contactLine.textContent.trim()) : 'Email is the fastest way to reach me.') + '</p>' +
      '</div>' +
      '<div class="room-phone__list">' +
        '<div class="room-phone__mail">' +
          phoneRow('mailto:' + EMAIL, 'mail', 'Email', EMAIL) +
          '<button type="button" class="room-phone__copy">Copy</button>' +
        '</div>' +
        phoneRow('https://www.linkedin.com/in/abrar-sami-khan/', 'in', 'LinkedIn', 'abrar-sami-khan', ' target="_blank" rel="noopener"') +
        phoneRow('https://github.com/Abrarkhan88', 'gh', 'GitHub', 'Abrarkhan88', ' target="_blank" rel="noopener"') +
        '<div class="room-phone__resume" hidden>' + phoneRow(RESUME, 'cv', 'Resume', 'PDF download', ' download') + '</div>' +
      '</div>' +
      '<p class="room-phone__toast" role="status" aria-live="polite"></p>' +
      '<span class="room-phone__home" aria-hidden="true"></span>';

    // The resume row appears only if the PDF is really there
    if (window.fetch && location.protocol !== 'file:') {
      fetch(RESUME, { method: 'HEAD' })
        .then(function (res) { if (res.ok) phoneUi.querySelector('.room-phone__resume').hidden = false; })
        .catch(function () {});
    }

    var toast = phoneUi.querySelector('.room-phone__toast');
    var toastTimer = null;
    phoneUi.querySelector('.room-phone__copy').addEventListener('click', function () {
      function done(msg) {
        toast.textContent = msg;
        toast.classList.add('is-on');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.classList.remove('is-on'); }, 1800);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(EMAIL).then(function () { done('Email copied'); }, function () { done(EMAIL); });
      } else done(EMAIL);
    });

    var phoneTime = phoneUi.querySelector('.room-phone__time'), phoneDate = phoneUi.querySelector('.room-phone__date'),
        phoneClock = phoneUi.querySelector('.room-phone__clock');
    function tickPhone() {
      var now = new Date();
      try {
        phoneTime.textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' });
        phoneDate.textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dhaka' }) + ' \u00b7 Dhaka';
        phoneClock.textContent = now.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Dhaka' }).replace(/\s?[ap]m$/i, '');
      } catch (err) { phoneTime.textContent = ''; }
    }
    tickPhone();
    var phoneTimer = setInterval(tickPhone, 30000);

    function posePhone(p, animate) {
      var props = [[phone.position, { x: p.x, y: p.y, z: p.z }], [phone.rotation, { x: p.rx, y: p.ry }]];
      props.forEach(function (pr) {
        if (animate && window.gsap) gsap.to(pr[0], Object.assign({ duration: 1.2, ease: 'power3.inOut', overwrite: true }, pr[1]));
        else Object.assign(pr[0], pr[1]);
      });
    }
    var phoneUp = false;
    function showPhone(on) {
      if (on === phoneUp) return;
      phoneUp = on;
      posePhone(on ? PHONE_UP : PHONE_REST, true);
      var glass = phoneGlass.material.color;
      if (glass && glass.set) glass.set(on ? 0x1d2a33 : 0x0c0e11);   // the screen wakes up
      if (on) {
        tickPhone();
        phoneUi.hidden = false;
        if (window.gsap) gsap.fromTo(phoneUi, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, delay: 1.15, ease: 'power2.out' });
      } else {
        if (window.gsap && gsap.killTweensOf) gsap.killTweensOf(phoneUi);
        phoneUi.hidden = true;
      }
    }
    // The HTML screen sits on the lifted phone's glass
    var PHONE_CORNERS = [[1.392, 2.883, -1.43], [1.708, 2.883, -1.43], [1.392, 2.217, -1.43], [1.708, 2.217, -1.43]];
    function placePhone(w, h) {
      if (phoneUi.hidden) return;
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      PHONE_CORNERS.forEach(function (c) {
        tmp.set(c[0], c[1], c[2]).project(camera);
        var px = (tmp.x * 0.5 + 0.5) * w, py = (-tmp.y * 0.5 + 0.5) * h;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      });
      if (!isFinite(x0)) return;
      phoneUi.style.left = x0 + 'px';
      phoneUi.style.top = y0 + 'px';
      phoneUi.style.width = (x1 - x0) + 'px';
      phoneUi.style.height = (y1 - y0) + 'px';
      phoneUi.style.fontSize = ((x1 - x0) / 19) + 'px';
    }

    /* ---------- About: a book slides off the shelf and opens as a notebook ---------- */
    var bookUi = layer.querySelector('.room-book');
    function fillBook() {
      var story = document.querySelector('#about .about__story');
      var facts = document.querySelector('#about .about__facts');
      bookUi.innerHTML =
        '<div class="room-book__page room-book__page--left">' +
          '<p class="room-book__kicker">About</p>' +
          '<h2 class="room-book__title" id="room-book-title">Abrar Sami Khan</h2>' +
          '<div class="room-book__story"></div>' +
        '</div>' +
        '<div class="room-book__page room-book__page--right">' +
          '<p class="room-book__kicker">Quick facts</p>' +
          '<div class="room-book__facts"></div>' +
          '<p class="room-book__more">Projects are on the computer, work is on the board, and the phone has my contact details.</p>' +
        '</div>';
      if (story) bookUi.querySelector('.room-book__story').appendChild(cleanCopy(story));
      if (facts) bookUi.querySelector('.room-book__facts').appendChild(cleanCopy(facts));
    }
    function slideBook(out) {
      var to = out ? { z: aboutBookHome.z + 0.38, rx: 0.22 } : aboutBookHome;   // pulled out, top tipped toward you
      if (window.gsap) {
        gsap.to(aboutBook.position, { z: to.z, duration: 0.9, delay: out ? 0.8 : 0, ease: 'power3.inOut', overwrite: true });
        gsap.to(aboutBook.rotation, { x: to.rx, duration: 0.9, delay: out ? 0.8 : 0, ease: 'power3.inOut', overwrite: true });
      } else {
        aboutBook.position.z = to.z; aboutBook.rotation.x = to.rx;
      }
    }
    var bookOpen = false;
    function showBook(on) {
      if (on === bookOpen) return;
      bookOpen = on;
      slideBook(on);
      if (on) {
        fillBook();
        bookUi.hidden = false;
        if (window.gsap) {
          gsap.fromTo(bookUi, { autoAlpha: 0, x: 40, rotationY: -12, transformPerspective: 1200 },
            { autoAlpha: 1, x: 0, rotationY: 0, duration: 0.7, delay: 1.3, ease: 'power3.out', clearProps: 'transform' });
        }
      } else {
        if (window.gsap && gsap.killTweensOf) gsap.killTweensOf(bookUi);
        bookUi.hidden = true;
        bookUi.innerHTML = '';
      }
    }

    /* ---------- Music: a YouTube player behind the record player ----------
       Click the turntable: a panel opens with the player, search and my playlist.
       Shrinking it docks a small player in the corner so music keeps going while you
       look around. YouTube's rules: the player always stays on screen, at least 200x200,
       with nothing on top of it, so there is no hidden "background" playback. */
    var MUSIC_PLAYLIST = '';                                  // YouTube / YouTube Music playlist ID (the part after list=)
    var MUSIC_SEARCH_URL = '/api/yt-search';                  // serverless search, keeps the API key private
    var music = (function () {
      var ui = layer.querySelector('.room-music');
      var playerEl = ui.querySelector('.room-music__player');
      var tracks = ui.querySelectorAll('.room-music__track');
      var playBtn = ui.querySelector('.room-music__play');
      var statusEl = ui.querySelector('.room-music__status');
      var resultsEl = ui.querySelector('.room-music__results');
      var mineBtn = ui.querySelector('.room-music__mine');
      var yt = null, ytReady = false, pending = null, playing = false, spin = 0, toneAngle = 0.35;
      if (MUSIC_PLAYLIST) mineBtn.hidden = false;

      function decode(str) { var t2 = document.createElement('textarea'); t2.innerHTML = str; return t2.value; }
      function setTrack(name) { Array.prototype.forEach.call(tracks, function (el) { el.textContent = name; }); }
      function say(msg) { statusEl.textContent = msg || ''; }

      function loadApi(cb) {
        if (window.YT && window.YT.Player) { cb(); return; }
        var prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function () { if (prev) prev(); cb(); };
        if (!document.querySelector('script[data-yt-api]')) {
          var sc = document.createElement('script');
          sc.src = 'https://www.youtube.com/iframe_api';
          sc.async = true; sc.setAttribute('data-yt-api', '');
          sc.onerror = function () { say('YouTube could not be reached. Check your connection or ad blocker.'); };
          document.head.appendChild(sc);
        }
      }
      function makePlayer() {
        if (yt) return;
        yt = new YT.Player(playerEl, {
          width: '100%', height: '100%',
          playerVars: { playsinline: 1, rel: 0, origin: location.origin },
          events: {
            onReady: function () {
              ytReady = true;
              if (pending) { pending(); pending = null; }
              else if (MUSIC_PLAYLIST) yt.cuePlaylist({ listType: 'playlist', list: MUSIC_PLAYLIST });
            },
            onStateChange: function (e) {
              playing = e.data === YT.PlayerState.PLAYING;
              playBtn.innerHTML = playing ? '&#10073;&#10073;' : '&#9654;';
              playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
              ui.classList.toggle('is-playing', playing);
              try { var d = yt.getVideoData(); if (d && d.title) setTrack(d.title); } catch (err) { /* not ready */ }
            },
            onError: function () {
              say('That one can’t play here (the owner blocks it on other sites). Skipping.');
              try { yt.nextVideo(); } catch (err) { /* single video */ }
            }
          }
        });
      }
      function whenReady(fn) { if (ytReady) fn(); else pending = fn; }

      function open() {
        ui.hidden = false;
        ui.classList.remove('is-mini');
        loadApi(makePlayer);
        if (window.gsap) gsap.fromTo(ui, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' });
        var q = ui.querySelector('input'); if (q && !isCompact()) q.focus({ preventScroll: true });
      }
      function mini() { ui.classList.add('is-mini'); }
      function stop() {
        try { if (yt && yt.stopVideo) yt.stopVideo(); } catch (err) { /* not ready */ }
        playing = false; ui.classList.remove('is-playing');
        ui.hidden = true; ui.classList.remove('is-mini');
      }

      ui.querySelector('.room-music__mini').addEventListener('click', mini);
      ui.querySelector('.room-music__expand').addEventListener('click', function () { ui.classList.remove('is-mini'); });
      Array.prototype.forEach.call(ui.querySelectorAll('.room-music__stop'), function (b) { b.addEventListener('click', stop); });
      playBtn.addEventListener('click', function () { whenReady(function () { if (playing) yt.pauseVideo(); else yt.playVideo(); }); });
      ui.querySelector('.room-music__prev').addEventListener('click', function () { whenReady(function () { yt.previousVideo(); }); });
      ui.querySelector('.room-music__next').addEventListener('click', function () { whenReady(function () { yt.nextVideo(); }); });
      mineBtn.addEventListener('click', function () {
        say('');
        whenReady(function () { yt.loadPlaylist({ listType: 'playlist', list: MUSIC_PLAYLIST }); });
      });
      ui.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !ui.classList.contains('is-mini')) { e.stopPropagation(); mini(); }
      });

      // Search runs on the server (/api/yt-search), so the YouTube key never reaches the browser
      ui.querySelector('.room-music__search').addEventListener('submit', function (e) {
        e.preventDefault();
        var q = e.target.q.value.trim();
        if (!q) return;
        say('Searching…');
        resultsEl.innerHTML = '';
        fetch(MUSIC_SEARCH_URL + '?q=' + encodeURIComponent(q))
          .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
          .then(function (data) {
            var items = (data && data.items) || [];
            say(items.length ? '' : 'Nothing found. Try another search.');
            items.forEach(function (it) {
              var li = document.createElement('li');
              var b = document.createElement('button');
              b.type = 'button';
              b.className = 'room-music__hit';
              b.innerHTML = '<img alt="" loading="lazy" src="' + it.thumb + '"><span><strong></strong><small></small></span>';
              b.querySelector('strong').textContent = decode(it.title);
              b.querySelector('small').textContent = decode(it.channel);
              b.addEventListener('click', function () {
                setTrack(decode(it.title)); say('');
                whenReady(function () { yt.loadVideoById(it.id); });
              });
              li.appendChild(b); resultsEl.appendChild(li);
            });
          })
          .catch(function () { say('Search isn’t available right now.'); });
      });

      return {
        open: open,
        tick: function (dt, time) {
          spin += ((playing ? 3.6 : 0) - spin) * Math.min(1, dt * 1.5);       // spins up and winds down
          platter.rotation.y -= spin * dt;
          toneAngle += ((playing ? 0.62 : 0.35) - toneAngle) * Math.min(1, dt * 2);
          tone.rotation.y = toneAngle;
          var pulse = playing ? 1 + Math.abs(Math.sin(time * 4.2)) * 0.12 : 1;
          ring.scale.set(pulse, pulse, 1);
        },
        destroy: function () { try { if (yt && yt.destroy) yt.destroy(); } catch (err) { /* gone */ } yt = null; }
      };
    })();

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
    // The record player opens music without moving the camera
    (function () {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'room__marker';
      b.setAttribute('tabindex', '-1');
      b.innerHTML = '<span>Music</span>';
      b.addEventListener('click', function () { music.open(); });
      hotspotsEl.appendChild(b);
      markers.push({ el: b, at: new T.Vector3(6.55, 2.25, -5.0), homeOnly: true });
    })();
    var tmp = new T.Vector3();

    function placeMarkers(w, h) {
      markers.forEach(function (m) {
        tmp.copy(m.at).project(camera);
        var visible = tmp.z < 1 && !(m.homeOnly && current !== 'home');
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
      if (raycaster.intersectObject(cab, true).length) return 'music';
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

    // Two fingers on the canvas pinch to zoom (home view only)
    var touches = {}, pinchStart = 0, pinchZoom = 1;
    function pinchDist() {
      var p = Object.keys(touches).map(function (k) { return touches[k]; });
      return p.length < 2 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    }
    function onDown(e) {
      touches[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (Object.keys(touches).length === 2) { pinchStart = pinchDist(); pinchZoom = zoom; moved = 99; return; }
      dragging = true; moved = 0; dragX = e.clientX; dragY = e.clientY; canvas.style.cursor = 'grabbing';
    }
    function onMove(e) {
      if (touches[e.pointerId]) touches[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (pinchStart && Object.keys(touches).length >= 2) {
        if (current === 'home') setZoom(pinchZoom * pinchDist() / pinchStart);
        return;
      }
      if (dragging && current === 'home') {
        moved += Math.abs(e.clientX - dragX) + Math.abs(e.clientY - dragY);
        if (tallScreen()) {
          // Looking around from the corner: the more you zoom in, the further you can turn
          var turn = 0.06 + (zoom - 1) * 0.28;
          yawTarget = Math.max(-turn, Math.min(turn, yawTarget + (e.clientX - dragX) * 0.004 / zoom));
          pitchTarget = Math.max(-0.05 * zoom, Math.min(0.05 * zoom, pitchTarget - (e.clientY - dragY) * 0.002 / zoom));
        } else {
          var range = isCompact() ? 0.4 : 0.25;
          yawTarget = Math.max(-range, Math.min(range, yawTarget - (e.clientX - dragX) * (isCompact() ? 0.005 : 0.003)));
          pitchTarget = Math.max(-0.08, Math.min(0.08, pitchTarget + (e.clientY - dragY) * 0.0015));
        }
        dragX = e.clientX; dragY = e.clientY;
      } else if (!dragging) {
        var over = current === 'home' ? !!pickAt(e.clientX, e.clientY) : current === 'work' && pickCard(e.clientX, e.clientY) >= 0;
        canvas.style.cursor = over ? 'pointer' : 'grab';
      }
    }
    function onUp(e) {
      delete touches[e.pointerId];
      if (Object.keys(touches).length < 2) pinchStart = 0;
      dragging = false;
      canvas.style.cursor = 'grab';
      if (moved < 6 && current === 'home') {
        var hit = pickAt(e.clientX, e.clientY);
        if (hit === 'music') music.open();
        else if (hit) flyTo(hit);
      } else if (moved < 6 && current === 'work' && e.target === canvas) {
        var ci = pickCard(e.clientX, e.clientY);
        if (ci >= 0) selectCard(ci);
      }
    }
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointercancel', onUp);
    // Scroll wheel or trackpad pinch zooms the home view
    function onWheel(e) {
      if (current !== 'home') return;
      e.preventDefault();
      setZoom(zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
    }
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // A one-time hint on how to get around; it leaves as soon as you do anything
    var hint = layer.querySelector('.room__hint'), hintTimer = null;
    function hideHint() {
      if (!hint || hint.hidden) return;
      clearTimeout(hintTimer);
      hint.classList.remove('is-in');
      setTimeout(function () { if (hint) hint.hidden = true; }, 500);
    }
    function showHint() {
      if (!hint) return;
      hint.hidden = false;
      requestAnimationFrame(function () { hint.classList.add('is-in'); });
      hintTimer = setTimeout(hideHint, 9000);
    }
    canvas.addEventListener('pointerdown', hideHint);
    menu.addEventListener('click', hideHint);

    // If the graphics card gives up, fall back to the flat site
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); leaveRoom(); });
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
      if (!(window.gsap && gsap.isTweening && gsap.isTweening(lens))) lens.fov = fovFor(current);
      if (VIEWS[current] && cam.x !== 0 && !(window.gsap && gsap.isTweening && gsap.isTweening(cam))) {
        var fv = framed(current);                     // phone turned: re-frame where you are
        cam.x = fv.pos[0]; cam.y = fv.pos[1]; cam.z = fv.pos[2];
        cam.lx = fv.look[0]; cam.ly = fv.look[1]; cam.lz = fv.look[2];
      }
    }
    window.addEventListener('resize', resize);
    resize();

    var raf = null, last = performance.now(), t = 0;
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now; t += dt;
      yaw += (yawTarget - yaw) * Math.min(1, dt * 5);
      pitch += (pitchTarget - pitch) * Math.min(1, dt * 5);
      if (current === 'home' && !dragging && !(tallScreen() && zoom > 1)) {
        // Drift gently back to centre once you let go
        yawTarget += (0 - yawTarget) * Math.min(1, dt * 0.6);
        pitchTarget += (0 - pitchTarget) * Math.min(1, dt * 0.6);
      }
      lamp.intensity = (1.3 + Math.sin(t * 2.1) * 0.03) * lampK;   // the faintest lamp flicker
      blades.rotation.y += dt * 2.4;                       // ceiling fan
      moveTraffic(dt);                                     // cars on the expressway
      checkMood(dt);                                       // the sky follows the Dhaka clock
      if (current === 'home') updateTerminal(dt);          // the intro typing itself out on the monitor
      music.tick(dt, t);                                   // record spins and the speaker ring pulses while music plays
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
      placePhone(W, H);
      raf = requestAnimationFrame(frame);
    }

    /* ---------- The clock moves the light ----------
       At night every value below is exactly what the room had before, so the moonlit look is unchanged. */
    var lampK = 1, NEON_RGB = [25 / 255, 217 / 255, 1];
    function setRGB(col, c) { col.setRGB(c[0] / 255, c[1] / 255, c[2] / 255); }
    function applyMood(m) {
      try {
        var d = m.d, day = 1 - d, sun = m.sun, al = sun.alt, oc = Math.max(m.overcast || 0, 0.7 * (m.storm || 0));
        var warm = mixc([255, 168, 104], [255, 242, 214], Math.pow(al, 0.5));       // low sun is orange, high sun is white
        hemi.intensity = 1.4 + 0.4 * day * (1 - 0.4 * oc);
        setRGB(hemi.color, mixc([219, 230, 244], mixc(mixc([255, 246, 232], m.c.h, 0.2), [205, 216, 232], 0.7 * oc), day));
        setRGB(hemi.groundColor, mixc([42, 48, 56], [96, 92, 100], day));
        setRGB(sunset.color, mixc([180, 204, 255], warm, day));
        sunset.intensity = 0.75 * d * (1 - 0.9 * oc) + (sun.on ? 0.4 + 1.0 * al : 0.15) * day * (1 - 0.85 * oc);
        sunset.position.set(-14, 8.5 * d + (3 + 9 * al) * day, 3 * d + (-8 + 16 * sun.frac) * day);
        neonLights.forEach(function (n) { n.l.intensity = n.base * (0.3 + 0.7 * d); });
        var nk = 0.5 + 0.5 * d + 0.25 * oc * day;                                      // neon is softer in daylight, a touch stronger on a dark wet day
        rainK = m.rain; rain.visible = m.rain > 0.01; if (!rain.visible) rainMat.opacity = 0;
        neonM.color.setRGB(NEON_RGB[0] * nk, NEON_RGB[1] * nk, NEON_RGB[2] * nk);
        ring.material.color.setRGB(NEON_RGB[0] * nk, NEON_RGB[1] * nk, NEON_RGB[2] * nk);
        speakerGlow.intensity = 0.6 * (0.4 + 0.6 * d);
        lampK = 0.3 + 0.7 * d;                                                         // the desk lamp
        var fl = 0.15 + 0.85 * clamp(d * 1.6, 0, 1);                                  // the floor lamp comes on at dusk
        flampLight.intensity = fl;
        lampShade.material.emissiveIntensity = 0.8 * (0.25 + 0.75 * fl);
        setRGB(windowGlow.color, mixc([184, 200, 255], mixc(m.c.h, [255, 255, 255], 0.3), day));
        windowGlow.intensity = 0.95 + 0.35 * day;
      } catch (err) { /* a stripped-down renderer: keep the night look */ }
    }
    var paintedAt = mood.hours, moodTimer = 0;
    function checkMood(dt) {
      moodTimer += dt;
      if (moodTimer < 15) return;
      moodTimer = 0;
      var c = clockNow();
      if (c.fixed) return;                                                            // ?time=... holds one moment still
      if (Math.abs(c.hours - paintedAt) < 2 / 60 && c.ritu === curMood.ritu) return;    // repaint about every two minutes
      curMood = moodAt(c.hours, c.ritu); paintedAt = c.hours;
      repaintSky(curMood); applyMood(curMood);
    }
    applyMood(curMood);

    /* ---------- TIME TEST: for checking every hour and season. Only appears with ?timetest in the address.
       Temporary: delete this whole block (and the testClock lines above) before launch. ---------- */
    if (params.has('timetest') && layer) {
      var tp = document.createElement('div');
      tp.setAttribute('style', 'position:absolute;left:50%;top:12px;transform:translateX(-50%);z-index:50;display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;max-width:92vw;padding:8px 12px;border-radius:12px;background:rgba(10,14,22,.85);border:1px solid rgba(25,217,255,.45);color:#e8f4ff;font:12px/1.2 system-ui,sans-serif;');
      tp.innerHTML = '<b style="letter-spacing:.08em">TIME TEST</b>' +
        '<input type="range" min="0" max="1439" step="5" aria-label="Time in Dhaka" style="width:min(320px,48vw)">' +
        '<output style="min-width:78px;font:12px ui-monospace,monospace"></output>' +
        '<button type="button" data-a="play">Play</button><button type="button" data-a="now">Live</button>' +
        '<select aria-label="Season"></select>';
      var tr = tp.querySelector('input'), tout = tp.querySelector('output'), tsel = tp.querySelector('select'),
          tplay = tp.querySelector('[data-a="play"]'), tlive = tp.querySelector('[data-a="now"]'), tpend = false, tgo = null;
      Object.keys(RITU).forEach(function (k) {
        var op = document.createElement('option'); op.value = k; op.textContent = k.charAt(0).toUpperCase() + k.slice(1); tsel.appendChild(op);
      });
      var tfmt = function (h) { var mm = Math.round(h * 60) % 1440, hh = Math.floor(mm / 60), ap = hh >= 12 ? 'pm' : 'am'; return (hh % 12 || 12) + ':' + ('0' + (mm % 60)).slice(-2) + ' ' + ap; };
      var tshow = function (h) {
        testClock = { hours: h, ritu: tsel.value };
        try {
          curMood = moodAt(h, tsel.value); paintedAt = h; repaintSky(curMood); applyMood(curMood);
          tout.textContent = tfmt(h) + '  [' + curMood.look + ' storm ' + (curMood.storm || 0).toFixed(2) + ' stars ' + curMood.starA.toFixed(2) + ' build G1]';
        } catch (err) { tout.textContent = tfmt(h) + '  ERROR: ' + err.message; }
      };
      var tstop = function () { if (tgo) { clearInterval(tgo); tgo = null; tplay.textContent = 'Play'; } };
      tr.addEventListener('input', function () { tstop(); if (tpend) return; tpend = true; requestAnimationFrame(function () { tpend = false; tshow(+tr.value / 60); }); });
      tsel.addEventListener('change', function () { tshow(+tr.value / 60); });
      tplay.addEventListener('click', function () {
        if (tgo) { tstop(); return; }
        tplay.textContent = 'Pause';
        tgo = setInterval(function () {
          if (!tp.isConnected) { clearInterval(tgo); tgo = null; return; }
          tr.value = (+tr.value + 10) % 1440; tshow(+tr.value / 60);        // about nine seconds for a whole day
        }, 100);
      });
      tlive.addEventListener('click', function () {
        tstop(); testClock = null;
        var c = clockNow(); curMood = moodAt(c.hours, c.ritu); paintedAt = c.hours; repaintSky(curMood); applyMood(curMood);
        tr.value = Math.round(c.hours * 60); tsel.value = c.ritu; tout.textContent = tfmt(c.hours) + ' (live)';
      });
      tr.value = Math.round(curMood.hours * 60); tsel.value = curMood.ritu; tout.textContent = tfmt(curMood.hours) + ' (live)';
      layer.appendChild(tp);
    }

    // Start in the far corner, then glide to the home view
    setCam({ pos: [12.0, 6.6, 13.2], look: [-1.0, 2.6, -2.4] });   // inside the room, near the far corner
    applyCamera();
    raf = requestAnimationFrame(frame);

    return {
      intro: function () {
        flyTo('home');
        menu.classList.add('is-in');
        showHint();
      },
      dispose: function () {
        cancelAnimationFrame(raf);
        clearTimeout(hintTimer);
        closeApp(false);                      // put any open demo back on the flat page
        clearInterval(clockTimer);
        clearInterval(phoneTimer);
        music.destroy();
        document.removeEventListener('keydown', onKey);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        window.removeEventListener('resize', resize);
        renderer.dispose();
      }
    };
  }

  // Open the room straight away only when wanted; otherwise it waits for the header link
  if (wanted) enterRoom();
})();
