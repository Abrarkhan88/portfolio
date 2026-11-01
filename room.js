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
      wall: 0x5a3a33,       // warm terracotta-brown
      wallDark: 0x47302b,
      floor: 0x7a5236,      // warm wood
      rug: 0x2f5d5b,        // teal
      desk: 0x2b2421,
      deskTop: 0x3a302b,
      metal: 0x1f1c1a,
      screen: 0x0f1416,
      board: 0x2a2320,
      paper: 0xece6da,
      marigold: 0xe9c14a,
      teal: 0x3e8c86,
      sky: 0xf2a463
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

    /* ---------- Lights ---------- */
    scene.add(new T.HemisphereLight(0xffd9b8, 0x2a1a14, 0.8));   // soft fill now that the room is closed

    var sunset = new T.DirectionalLight(0xffa86b, 1.1);     // low dusk sun through the window
    sunset.position.set(-14, 9, 4);
    sunset.castShadow = true;
    sunset.shadow.mapSize.width = 2048;
    sunset.shadow.mapSize.height = 2048;
    sunset.shadow.camera.left = -12; sunset.shadow.camera.right = 12;
    sunset.shadow.camera.top = 12; sunset.shadow.camera.bottom = -12;
    scene.add(sunset);

    var lamp = new T.PointLight(0xffc27a, 1.2, 9, 2);        // desk lamp
    lamp.position.set(-0.9, 3.1, -1.2);
    lamp.castShadow = true;
    scene.add(lamp);

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

    /* ---------- Room: a closed box, so the only view outside is the window ----------
       Inside spans x -8..13, z -6..14, height 7.5 */
    var RX0 = -8, RX1 = 13, RZ0 = -6, RZ1 = 14, RH = 7.5;
    var RW = RX1 - RX0, RD = RZ1 - RZ0, CX = (RX0 + RX1) / 2, CZ = (RZ0 + RZ1) / 2;

    var floor = new T.Mesh(new T.PlaneGeometry(RW, RD), mat(C.floor, { roughness: 0.7 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(CX, 0, CZ);
    floor.receiveShadow = true;
    scene.add(floor);

    var rug = new T.Mesh(new T.PlaneGeometry(6.4, 4.6), mat(C.rug, { roughness: 1 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0.6, 0.01, 0.6);
    rug.receiveShadow = true;
    scene.add(rug);

    var wallM = mat(C.wall), wallDarkM = mat(C.wallDark);
    box(RW + 0.6, RH, 0.3, wallM, CX, RH / 2, RZ0);                  // back wall
    box(0.3, RH, RD, wallM, RX1, RH / 2, CZ);                         // right wall
    box(RW + 0.6, RH, 0.3, wallM, CX, RH / 2, RZ1);                   // front wall (behind the camera)
    box(RW + 0.6, 0.3, RD + 0.6, mat(0x2a1d19, { roughness: 1 }), CX, RH + 0.15, CZ);  // ceiling

    // Left wall (x = -8), built around a window opening from z -3 to 3, y 1.6 to 5.6
    box(0.3, RH, 3.0, wallDarkM, RX0, RH / 2, -4.5);                  // behind the window
    box(0.3, RH, RZ1 - 3, wallDarkM, RX0, RH / 2, (3 + RZ1) / 2);     // in front of the window
    box(0.3, 1.6, 6.0, wallDarkM, RX0, 0.8, 0);                       // below the window
    box(0.3, RH - 5.6, 6.0, wallDarkM, RX0, (5.6 + RH) / 2, 0);       // above the window
    // Window frame
    var frameM = mat(C.metal, { roughness: 0.6 });
    box(0.36, 0.12, 6.0, frameM, RX0, 1.62, 0);
    box(0.36, 0.12, 6.0, frameM, RX0, 5.58, 0);
    box(0.36, 4.0, 0.12, frameM, RX0, 3.6, 0);
    box(0.36, 4.0, 0.12, frameM, RX0, 3.6, -2.95);
    box(0.36, 4.0, 0.12, frameM, RX0, 3.6, 2.95);

    // City beyond the window: a dusk sky placeholder sitting just outside the glass
    // (the Dhaka skyline arrives in stage 2)
    var skyCanvas = document.createElement('canvas');
    skyCanvas.width = 512; skyCanvas.height = 256;
    var g = skyCanvas.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#5b4a7a');
    grad.addColorStop(0.55, '#f08a5d');
    grad.addColorStop(1, '#f6c27a');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 256);
    var sky = new T.Mesh(new T.PlaneGeometry(14, 9), new T.MeshBasicMaterial({ map: new T.CanvasTexture(skyCanvas) }));
    sky.position.set(RX0 - 1.2, 3.6, 0);
    sky.rotation.y = Math.PI / 2;
    scene.add(sky);

    /* ---------- Desk with monitor, lamp and phone ---------- */
    var desk = new T.Group();
    desk.position.set(0, 0, -2.2);
    scene.add(desk);
    box(5.2, 0.16, 2.2, mat(C.deskTop, { roughness: 0.5 }), 0, 1.55, 0, desk);   // top
    box(0.16, 1.5, 2.0, mat(C.desk), -2.45, 0.75, 0, desk);                        // legs
    box(1.6, 1.5, 2.0, mat(C.desk), 1.8, 0.75, 0, desk);                           // drawer unit
    // Thin marigold light strip under the desk edge
    box(5.2, 0.03, 0.03, new T.MeshBasicMaterial({ color: C.marigold }), 0, 1.46, 1.1, desk);

    var monitor = new T.Group();
    monitor.position.set(-0.3, 1.63, -0.45);
    desk.add(monitor);
    box(0.5, 0.06, 0.4, mat(C.metal), 0, 0.03, 0, monitor);                         // foot
    box(0.12, 0.7, 0.08, mat(C.metal), 0, 0.4, -0.05, monitor);                     // neck
    box(2.5, 1.5, 0.12, mat(C.metal, { roughness: 0.4 }), 0, 1.4, 0, monitor);      // body
    var screen = new T.Mesh(new T.PlaneGeometry(2.36, 1.36), new T.MeshBasicMaterial({ color: C.screen }));
    screen.position.set(0, 1.4, 0.065);
    monitor.add(screen);
    box(1.9, 0.05, 0.6, mat(0x2e2a28), -0.3, 1.66, 0.45, desk);                     // keyboard

    var lampArm = new T.Group();
    lampArm.position.set(-2.1, 1.63, -0.6);
    desk.add(lampArm);
    box(0.4, 0.06, 0.4, mat(C.metal), 0, 0.03, 0, lampArm);
    box(0.06, 1.4, 0.06, mat(C.metal), 0, 0.73, 0, lampArm);
    box(0.5, 0.25, 0.35, mat(C.marigold, { emissive: 0x4a3510 }), 0.15, 1.45, 0.1, lampArm);

    var phone = box(0.34, 0.04, 0.66, mat(0x111214, { roughness: 0.3 }), 1.55, 1.65, 0.35, desk);
    phone.rotation.y = -0.35;

    /* ---------- Back wall: ID card board and a shelf ---------- */
    var board = box(4.6, 2.4, 0.08, mat(C.board), 3.6, 4.2, -5.8);
    box(4.6, 0.04, 0.12, new T.MeshBasicMaterial({ color: C.marigold }), 3.6, 2.97, -5.78);   // glow line under the board

    var shelf = new T.Group();
    shelf.position.set(-4.4, 0, -5.55);
    scene.add(shelf);
    box(3.2, 0.12, 0.6, mat(C.desk), 0, 4.6, 0, shelf);
    box(3.2, 0.12, 0.6, mat(C.desk), 0, 3.4, 0, shelf);
    var bookColors = [0x3e8c86, 0xe9c14a, 0xb5523b, 0xece6da, 0x5b4a7a, 0x2f5d5b];
    for (var i = 0; i < 9; i++) {
      var h = 0.55 + (i % 3) * 0.12;
      box(0.18, h, 0.42, mat(bookColors[i % bookColors.length]), -1.3 + i * 0.22, 4.66 + h / 2, 0, shelf);
    }

    /* ---------- Chair (the character sits here in stage 3) ---------- */
    var chair = new T.Group();
    chair.position.set(-0.3, 0, -0.4);
    scene.add(chair);
    box(1.1, 0.14, 1.0, mat(0x2b2a33), 0, 1.05, 0, chair);
    box(1.1, 1.3, 0.12, mat(0x2b2a33), 0, 1.75, 0.5, chair);
    box(0.1, 1.0, 0.1, mat(C.metal), 0, 0.5, 0, chair);

    /* ---------- Views: where the camera goes for each section ---------- */
    var VIEWS = {
      home:     { pos: [9.5, 6.6, 9.5],  look: [-0.6, 2.2, -2.2] },
      projects: { pos: [-0.3, 3.05, 0.2], look: [-0.3, 3.03, -2.65] },
      work:     { pos: [3.6, 4.2, -1.6],  look: [3.6, 4.2, -5.8] },
      about:    { pos: [-4.4, 4.4, -2.6], look: [-4.4, 4.1, -5.55] },
      contact:  { pos: [1.4, 3.1, -1.5],  look: [1.55, 1.65, -1.85] }
    };

    // Objects you can click, and where their floating markers sit
    var HOTSPOTS = [
      { view: 'projects', label: 'Projects', at: [-0.3, 4.2, -2.65], mesh: screen },
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
      lamp.intensity = 1.2 + Math.sin(t * 2.1) * 0.03;   // the faintest lamp flicker
      applyCamera();
      renderer.render(scene, camera);
      placeMarkers(W, H);
      raf = requestAnimationFrame(frame);
    }

    // Start in the far corner, then glide to the home view
    setCam({ pos: [12.2, 7.1, 13.2], look: [-0.6, 2.2, -2.2] });   // inside the room, near the far corner
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
