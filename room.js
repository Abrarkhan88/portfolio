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

      '<p class="room__id"><strong>Abrar Sami Khan</strong><span>Analytics, Automation &amp; ML</span><span>Dhaka</span></p>' +
      '<div class="room__top">' +
        '<div class="room__actions">' +
          '<button class="room__sound" type="button" aria-pressed="false">Sound off</button>' +
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

    var soundBtn = layer.querySelector('.room__sound');
    soundBtn.addEventListener('click', function () {
      var on = toggleSound();
      soundBtn.setAttribute('aria-pressed', String(on));
      soundBtn.textContent = on ? 'Sound on' : 'Sound off';
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
    stopSound();
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
     Sound (off by default): a quiet Dhaka evening, made in the browser
     ========================================================= */
  var audio = null;   // { ctx, master, timers }

  function noiseBuffer(ctx, seconds) {
    var len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }   // brown-ish noise
    return buf;
  }
  function loopNoise(ctx, buf, filterType, freq, q, level, dest) {
    var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    var f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    var g = ctx.createGain(); g.gain.value = level;
    src.connect(f); f.connect(g); g.connect(dest); src.start();
    return g;
  }
  function wobble(ctx, param, rate, depth) {
    var lfo = ctx.createOscillator(), amt = ctx.createGain();
    lfo.frequency.value = rate; amt.gain.value = depth;
    lfo.connect(amt); amt.connect(param); lfo.start();
  }
  function ting(at, pan) {          // a rickshaw bell: two quick bright rings
    if (!audio) return;
    var ctx = audio.ctx, p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (p.pan) p.pan.value = pan;
    p.connect(audio.master);
    [0, 0.16].forEach(function (off) {
      [2093, 2637, 3520].forEach(function (f, k) {
        var o = ctx.createOscillator(), g = ctx.createGain(), t0 = at + off;
        o.frequency.value = f; o.type = 'sine';
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.035 / (k + 1), t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
        o.connect(g); g.connect(p); o.start(t0); o.stop(t0 + 0.75);
      });
    });
  }
  function horn(at) {               // a far-off horn, softened by distance
    if (!audio) return;
    var ctx = audio.ctx, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 380 + Math.random() * 120;
    f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.012, at + 0.05);
    g.gain.setValueAtTime(0.012, at + 0.22);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
    o.connect(f); f.connect(g); g.connect(audio.master); o.start(at); o.stop(at + 0.4);
  }
  function scheduleCity() {
    if (!audio) return;
    var now = audio.ctx.currentTime;
    if (Math.random() < 0.6) ting(now + 0.1, -0.6 + Math.random() * 0.4);   // from the window side
    else horn(now + 0.1);
    audio.timers.push(setTimeout(scheduleCity, 9000 + Math.random() * 18000));
  }
  function startSound() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    var ctx = new AC(), master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);
    audio = { ctx: ctx, master: master, timers: [] };
    var buf = noiseBuffer(ctx, 3);
    var city = loopNoise(ctx, buf, 'lowpass', 420, 0.5, 0.5, master);       // traffic rumble outside
    wobble(ctx, city.gain, 0.06, 0.18);                                       // it swells and fades
    var fan = loopNoise(ctx, buf, 'bandpass', 210, 0.9, 0.22, master);       // the ceiling fan
    wobble(ctx, fan.gain, 1.15, 0.06);                                        // three blades going round
    master.gain.exponentialRampToValueAtTime(0.6, ctx.currentTime + 1.5);
    audio.timers.push(setTimeout(scheduleCity, 2500));
    return true;
  }
  function stopSound() {
    if (!audio) return;
    var a = audio; audio = null;
    a.timers.forEach(clearTimeout);
    try {
      a.master.gain.cancelScheduledValues(a.ctx.currentTime);
      a.master.gain.setValueAtTime(a.master.gain.value, a.ctx.currentTime);
      a.master.gain.exponentialRampToValueAtTime(0.0001, a.ctx.currentTime + 0.4);
      setTimeout(function () { a.ctx.close(); }, 500);
    } catch (err) { /* already closed */ }
  }
  function toggleSound() {
    if (audio) { stopSound(); return false; }
    return startSound();
  }
  function whoosh() {               // the camera moving between spots
    if (!audio) return;
    var ctx = audio.ctx, t0 = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuffer(ctx, 1.2);
    f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t0); f.frequency.exponentialRampToValueAtTime(1400, t0 + 0.6); f.frequency.exponentialRampToValueAtTime(400, t0 + 1.1);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.15);
    src.connect(f); f.connect(g); g.connect(audio.master); src.start(t0); src.stop(t0 + 1.2);
  }

  /* =========================================================
     The 3D world
     ========================================================= */
  function buildWorld() {
    var T = window.THREE;

    // Night palette: charcoal room, violet moonlight, pink neon accents
    var C = {
      wall: 0x3b3843,
      wallDark: 0x353240,
      desk: 0x2b2932,
      deskTop: 0x34313b,
      metal: 0x1c1b21,
      board: 0x24222a,
      paper: 0xece6da,
      neon: 0xff5fd2,       // pink neon
      violet: 0x9b6bff,
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
    scene.add(new T.HemisphereLight(0xeedcf0, 0x3d3038, 1.4));      // soft night fill, a little warmer

    var sunset = new T.DirectionalLight(0xd8b4ff, 0.75);              // violet moonlight through the window
    sunset.position.set(-14, 8.5, 3);
    sunset.castShadow = true;
    sunset.shadow.bias = -0.0006;
    if ('normalBias' in sunset.shadow) sunset.shadow.normalBias = 0.03;
    sunset.shadow.mapSize.width = 2048;
    sunset.shadow.mapSize.height = 2048;
    sunset.shadow.camera.left = -12; sunset.shadow.camera.right = 12;
    sunset.shadow.camera.top = 12; sunset.shadow.camera.bottom = -12;
    scene.add(sunset);

    var lamp = new T.PointLight(0xff7ad9, 1.5, 8, 2);               // pink desk lamp
    lamp.position.set(1.45, 2.8, -2.55);
    lamp.castShadow = true;
    if (lamp.shadow) lamp.shadow.bias = -0.003;
    scene.add(lamp);

    // Neon glow from the desk edge and the board frame, a soft wall light over the shelf, and the fan light
    [[0.1, 1.3, -0.7, 0xff5fd2, 1.0, 5], [3.6, 4.2, -4.9, 0xff5fd2, 1.1, 6], [-4.4, 6.2, -5.1, 0xb28cff, 0.6, 6]].forEach(function (p) {
      var l = new T.PointLight(p[3], p[4], p[5], 2);
      l.position.set(p[0], p[1], p[2]);
      scene.add(l);
    });
    // Warm glow pooling on the floor: city light spilling in by the window, and a soft room light
    [[-5.2, 1.4, 0.2, 0xffa6d0, 1.1, 7], [3.5, 5.6, 3.5, 0xffc8b0, 0.7, 16], [6.4, 2.6, 2.0, 0xffb38a, 0.55, 6]].forEach(function (p) {
      var l = new T.PointLight(p[3], p[4], p[5], 2);
      l.position.set(p[0], p[1], p[2]);
      scene.add(l);
    });
    var fanLight = new T.PointLight(0xffe2d0, 0.5, 14, 2);
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
      g.fillStyle = '#231c24'; g.fillRect(0, 0, w, h);
      // Chevron parquet: columns of slanted planks that meet in a V
      var cw = 128, W = 32, tones = ['#4a3a44', '#54424c', '#40323d', '#5a4752', '#463741', '#4f3e48'];
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

    // Rug: charcoal with pale grey bands and a faint pink line, like a frame around the desk
    var rugTex = canvasTex(1024, 1024, function (g, w, h) {
      g.fillStyle = '#2c2933'; g.fillRect(0, 0, w, h);
      [[24, 26, '#9a93a6'], [70, 10, '#2c2933'], [92, 16, '#c9c2d2'], [128, 4, '#ff7ad9'], [150, 40, '#38343f']].forEach(function (b) {
        g.strokeStyle = b[2]; g.lineWidth = b[1];
        g.strokeRect(b[0], b[0], w - b[0] * 2, h - b[0] * 2);
      });
      g.strokeStyle = 'rgba(201,194,210,0.35)'; g.lineWidth = 6;             // a faint diamond in the middle
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
      pg.addColorStop(0, '#4d4553'); pg.addColorStop(1, '#433b4a');
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
    box(RW + 0.6, 0.3, RD + 0.6, mat(0x25222b, { roughness: 1 }), CX, RH + 0.15, CZ);  // ceiling
    // Skirting along the walls
    box(RW, 0.25, 0.08, mat(0x1d1b22), CX, 0.125, RZ0 + 0.18);
    box(0.08, 0.25, RD, mat(0x1d1b22), RX0 + 0.18, 0.125, CZ);

    // Left wall (x = -8), built around a window opening from z -3 to 3, y 1.6 to 5.6
    box(0.3, RH, 3.0, wallDarkM, RX0, RH / 2, -4.5);
    box(0.3, RH, RZ1 - 3, panelMat(4.4, 3), RX0, RH / 2, (3 + RZ1) / 2);
    box(0.3, 1.6, 6.0, panelMat(2.4, 0.65), RX0, 0.8, 0);
    box(0.3, RH - 5.6, 6.0, panelMat(2.4, 0.75), RX0, (5.6 + RH) / 2, 0);
    /* Window: a slim dark frame set into the wall, a roller-blind box across the top,
       a centre bar, and two casement sashes pushed open outwards over the street */
    var frameM = mat(0x2e2a37, { roughness: 0.5, metalness: 0.2 });
    var glassM = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.05, depthWrite: false, side: T.DoubleSide });
    function glass(wz, hy, x, y, z, parent) {
      var g = new T.Mesh(new T.PlaneGeometry(wz, hy), glassM);
      g.rotation.y = Math.PI / 2;
      g.position.set(x, y, z);
      g.renderOrder = 4;                                                 // after the city layers, so they show through
      (parent || scene).add(g);
      return g;
    }
    var revealM = mat(0x24212c, { roughness: 0.8 });
    // dark lining on the inside faces of the opening
    box(0.3, 0.02, 6.0, revealM, RX0, 5.59, 0);
    box(0.3, 4.0, 0.02, revealM, RX0, 3.6, -2.99);
    box(0.3, 4.0, 0.02, revealM, RX0, 3.6, 2.99);
    // slim trim around the opening on the room side
    box(0.05, 0.1, 6.2, frameM, RX0 + 0.17, 5.65, 0);
    box(0.05, 4.1, 0.1, frameM, RX0 + 0.17, 3.6, -3.05);
    box(0.05, 4.1, 0.1, frameM, RX0 + 0.17, 3.6, 3.05);
    // a thin sill that just steps out from the wall
    box(0.42, 0.07, 6.35, mat(0x3a3546, { roughness: 0.45 }), RX0 + 0.2, 1.58, 0);
    box(0.02, 0.07, 6.35, mat(0x4f4860, { roughness: 0.4 }), RX0 + 0.41, 1.58, 0);   // lit front edge
    // the fixed frame in the opening, with one full-height bar down the middle
    box(0.12, 0.1, 6.0, frameM, RX0, 5.53, 0);                          // head
    box(0.12, 0.1, 6.0, frameM, RX0, 1.67, 0);                          // bottom rail
    box(0.12, 3.96, 0.1, frameM, RX0, 3.6, -2.95);                      // jambs
    box(0.12, 3.96, 0.1, frameM, RX0, 3.6, 2.95);
    box(0.12, 3.76, 0.12, frameM, RX0, 3.6, 0);                         // centre bar
    // Roller-blind box across the top, a little wider than the window, with end caps
    var blindM = mat(0x4b4459, { roughness: 0.55, metalness: 0.1 });
    var bx0 = RX0 + 0.4, by0 = 5.92, BLEN = 8.9;
    box(0.46, 0.3, BLEN, blindM, bx0, by0, 0);                          // housing (the curtains hang from inside it)
    box(0.03, 0.02, BLEN, mat(0x6e6585, { roughness: 0.4 }), bx0 + 0.23, by0 + 0.14, 0);   // light catching the top edge
    [-1, 1].forEach(function (sd) {
      box(0.5, 0.34, 0.05, mat(0x3a3447, { roughness: 0.5 }), bx0, by0, sd * (BLEN / 2 + 0.02));   // end caps
    });
    cyl(0.05, 0.05, 0.06, mat(0x3a3447), bx0, by0, BLEN / 2 + 0.07, scene, 16).rotation.x = Math.PI / 2;   // bracket knob on the end
    // Curtains drawn back to either side: soft grey fabric with deep folds
    var curtainTex = canvasTex(256, 64, function (g, w, h) {
      var cg = g.createLinearGradient(0, 0, w, 0);
      for (var f = 0; f <= 8; f++) cg.addColorStop(f / 8, f % 2 ? '#8d8698' : '#5c5566');
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
    var windowGlow = new T.PointLight(0xe6b4ff, 0.95, 9, 2);              // the city's glow spilling in
    windowGlow.position.set(RX0 + 1.2, 3.6, 0);
    scene.add(windowGlow);

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
              var tone = rnd(); g.fillStyle = tone < 0.3 ? 'rgba(232,244,255,0.9)' : tone < 0.5 ? 'rgba(255,140,220,0.9)' : 'rgba(255,205,140,0.92)';
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
      sk.addColorStop(0, '#8a6cc4');
      sk.addColorStop(0.35, '#b98fdc');
      sk.addColorStop(0.6, '#dca6e0');
      sk.addColorStop(0.8, '#f2b6da');
      sk.addColorStop(1, '#fbd0e2');
      g.fillStyle = sk; g.fillRect(0, 0, w, h);
      for (var st = 0; st < 140; st++) {                                  // stars
        g.fillStyle = 'rgba(255,255,255,' + between(0.3, 0.9) + ')';
        g.fillRect(between(0, w), between(0, h * 0.45), between(1, 3), between(1, 3));
      }
      // A pale moon with a soft halo
      var sx = w * 0.36, sy = h * 0.3;
      var glow = g.createRadialGradient(sx, sy, 10, sx, sy, 220);
      glow.addColorStop(0, 'rgba(255,235,255,0.55)');
      glow.addColorStop(1, 'rgba(255,200,255,0)');
      g.fillStyle = glow; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fbeaff'; g.beginPath(); g.arc(sx, sy, 30, 0, Math.PI * 2); g.fill();
      // Long thin clouds
      g.fillStyle = 'rgba(255,170,230,0.18)';
      for (var i = 0; i < 9; i++) {
        g.beginPath(); g.ellipse(between(0, w), between(h * 0.18, h * 0.5), between(120, 380), between(6, 16), 0, 0, Math.PI * 2); g.fill();
      }
      // Distant haze line of buildings
      drawBuildingsRow(g, w, h, { minW: 30, maxW: 80, topMin: 0.6, topMax: 0.72, gap: 4, cell: 12, lit: 0.18,
        colors: ['#b48ad0', '#ab82c8', '#bc94d6'], tanks: 0.4, tankColor: '#9c74bc' });
      // Mosque: dome and two minarets, off to one side of the window view, behind the city
      var mx = w * 0.526, base = h * 0.7, k = 0.62;
      g.fillStyle = '#8f63b0';
      g.fillRect(mx - 70 * k, base - 40 * k, 140 * k, h - base + 40 * k);
      g.beginPath(); g.arc(mx, base - 40 * k, 62 * k, Math.PI, 0); g.fill();
      g.fillRect(mx - 2, base - 40 * k - 62 * k - 14, 4, 16);
      g.beginPath(); g.arc(mx, base - 40 * k - 62 * k - 15, 4, 0, Math.PI * 2); g.fill();
      [mx - 118 * k, mx + 104 * k].forEach(function (px) {
        g.fillStyle = '#8f63b0';
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
        colors: ['#8a5eae', '#8058a6', '#9466b6'], tanks: 0.55, tankColor: '#6c4892',
        low: [mx - 80 * k, mx + 80 * k, 0.735] });
      // A few birds over the sky
      g.strokeStyle = 'rgba(70,40,96,0.55)'; g.lineWidth = 3;
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
    /* A coconut palm: a tapering ringed trunk, a coconut cluster, and feathery
       fronds built from a curved midrib with leaflets hanging off both sides */
    function drawPalm(g, bx, baseY, top, side) {
      var lean = side * 34, cx = bx + lean * 1.0, ctlX = bx + lean * 2.4, ctlY = (baseY + top) / 2;
      function q(t) {                                    // point on the trunk curve, t 0 base .. 1 crown
        var a = 1 - t;
        return [a * a * bx + 2 * a * t * ctlX + t * t * cx, a * a * baseY + 2 * a * t * ctlY + t * t * top];
      }
      // Trunk
      var L = [], R = [], N = 48;
      for (var i = 0; i <= N; i++) {
        var t = i / N, p = q(t), p2 = q(Math.min(1, t + 0.01)), p1 = q(Math.max(0, t - 0.01));
        var tx = p2[0] - p1[0], ty = p2[1] - p1[1], tl = Math.hypot(tx, ty) || 1;
        var nx = -ty / tl, ny = tx / tl;
        var wd = (13 * (1 - t) + 7 * t) + 9 * Math.pow(1 - t, 6);    // flared foot, slim neck
        L.push([p[0] + nx * wd, p[1] + ny * wd]); R.push([p[0] - nx * wd, p[1] - ny * wd]);
      }
      var tg = g.createLinearGradient(bx - 30, 0, bx + 30, 0);
      tg.addColorStop(0, side > 0 ? '#2a2231' : '#5b4762');
      tg.addColorStop(0.5, '#3a3040');
      tg.addColorStop(1, side > 0 ? '#5b4762' : '#2a2231');
      g.fillStyle = tg;
      g.beginPath(); g.moveTo(L[0][0], L[0][1]);
      L.forEach(function (pp) { g.lineTo(pp[0], pp[1]); });
      for (var r = R.length - 1; r >= 0; r--) g.lineTo(R[r][0], R[r][1]);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(18,12,24,0.55)'; g.lineWidth = 2;   // growth rings
      for (var k = 2; k < N - 1; k += 2) {
        var l = L[k], rr = R[k];
        g.beginPath(); g.moveTo(l[0], l[1]); g.quadraticCurveTo((l[0] + rr[0]) / 2, (l[1] + rr[1]) / 2 + 4, rr[0], rr[1]); g.stroke();
      }
      // One frond: midrib curving out and drooping, leaflets on both sides
      function frond(ang, len, col, rim) {
        var pts = [];
        for (var s = 0; s <= 1.0001; s += 0.03) {
          pts.push([cx + Math.cos(ang) * len * s, top + Math.sin(ang) * len * s * 1.0 + 0.72 * len * s * s]);
        }
        g.lineCap = 'round';
        for (var j = 3; j < pts.length; j++) {
          var s2 = j / (pts.length - 1), p0 = pts[j - 1], p1 = pts[j];
          var dir = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
          var ll = (10 + 46 * Math.pow(Math.sin(Math.PI * Math.min(1, s2 * 1.1)), 0.8)) * (1 - 0.35 * s2);
          for (var sd = -1; sd <= 1; sd += 2) {
            var d = dir + sd * 0.75 + between(-0.08, 0.08);
            var ex = p1[0] + Math.cos(d) * ll, ey = p1[1] + Math.sin(d) * ll * 0.7 + ll * 0.6;   // leaflets hang
            g.strokeStyle = col; g.lineWidth = 3.2 * (1 - 0.4 * s2);
            g.beginPath(); g.moveTo(p1[0], p1[1]);
            g.quadraticCurveTo(p1[0] + Math.cos(d) * ll * 0.6, p1[1] + Math.sin(d) * ll * 0.45, ex, ey);
            g.stroke();
            if (rim && sd < 0) {                                       // city glow catching the upper leaflets
              g.strokeStyle = 'rgba(190,235,170,0.3)'; g.lineWidth = 1.1;
              g.beginPath(); g.moveTo(p1[0], p1[1]); g.quadraticCurveTo(p1[0] + Math.cos(d) * ll * 0.6, p1[1] + Math.sin(d) * ll * 0.45 - 1, ex, ey - 1); g.stroke();
            }
          }
        }
        g.strokeStyle = '#4d5a3c'; g.lineWidth = 3;                   // the midrib
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        pts.forEach(function (pp) { g.lineTo(pp[0], pp[1]); });
        g.stroke();
      }
      // Dry fronds hanging under the crown
      for (var dd = 0; dd < 3; dd++) {
        g.strokeStyle = '#4a3a2e'; g.lineWidth = 4;
        var da = Math.PI / 2 + (dd - 1) * 0.5;
        g.beginPath(); g.moveTo(cx, top + 6); g.quadraticCurveTo(cx + Math.cos(da) * 30, top + 40, cx + Math.cos(da) * 40, top + 70); g.stroke();
      }
      // Back fronds (darker), then the sides, then the near ones drooping towards us
      var back = [-1.9, -1.45, -1.15, -2.3], mid = [-0.35, -2.8, -0.75, -2.4, 0.0, -3.1], nearF = [-0.55, -2.6, 0.35, -2.95, -1.6];
      back.forEach(function (a) { frond(a + between(-0.06, 0.06), between(165, 195), '#1d3024', false); });
      // Coconuts tucked under the crown
      g.fillStyle = '#3c3a22';
      [[-8, 8], [7, 9], [0, 15], [-12, 17], [11, 18]].forEach(function (c) { g.beginPath(); g.arc(cx + c[0], top + c[1], 7.5, 0, Math.PI * 2); g.fill(); });
      mid.forEach(function (a) { frond(a + between(-0.06, 0.06), between(185, 225), '#284634', true); });
      nearF.forEach(function (a) { frond(a + between(-0.06, 0.06), between(165, 205), '#33583f', true); });
    }

    var frontC = document.createElement('canvas');   // blocks that stand in front of the road
    frontC.width = SKY_W; frontC.height = SKY_H;
    var nearTex = canvasTex(SKY_W, SKY_H, function (g, w, h) {
      // The blocks go on their own canvas first, so some can be stamped back in front of the expressway
      var blocks = document.createElement('canvas'); blocks.width = w; blocks.height = h;
      var rects = [];
      drawBuildingsRow(blocks.getContext('2d'), w, h, { minW: 160, maxW: 320, topMin: 0.42, topMax: 0.66, gap: 30, cell: 34, lit: 0.42,
        colors: ['#5e3f82', '#66468a', '#573a7a'], tanks: 0.7, tankColor: '#40295e', grills: true, ac: true,
        clear: [w * 0.49, w * 0.56], out: rects });   // a side street, looking through to the mosque
      g.drawImage(blocks, 0, 0);

      // Elevated expressway weaving through the blocks: concrete deck on pillars, traffic streaking along
      var deckY = function (x) { return h * deckV(x / w); };
      var line = function (off) { g.beginPath(); for (var dx = -10; dx <= w + 10; dx += 20) { if (dx < 0) g.moveTo(dx, deckY(dx) + off); else g.lineTo(dx, deckY(dx) + off); } g.stroke(); };
      g.fillStyle = '#4c3468';
      for (var px = 70; px < w; px += 240) {                       // pillars with pier caps
        var py = deckY(px);
        g.fillRect(px - 13, py + 18, 26, h - py);
        g.fillRect(px - 26, py + 14, 52, 9);
      }
      g.lineCap = 'butt';
      g.strokeStyle = '#6e5290'; g.lineWidth = 24; line(0);          // deck
      g.strokeStyle = '#3e2a58'; g.lineWidth = 6; line(12);          // shadowed underside edge
      g.strokeStyle = '#e6b8f4'; g.lineWidth = 4; line(-13);         // parapet catching the city glow
      for (var cl = 0; cl < 16; cl++) {                               // a few far-off lights; real cars drive past below
        var cx = between(0, w), head = rnd() < 0.5;
        g.fillStyle = head ? 'rgba(255,244,210,0.95)' : 'rgba(255,80,64,0.9)';
        g.fillRect(cx, deckY(cx) + (head ? -6 : 2), between(10, 22), 3);
      }
      for (var lp = 50; lp < w; lp += 170) {                          // lamp posts along the parapet
        g.fillStyle = '#211a2e'; g.fillRect(lp, deckY(lp) - 48, 3, 36); g.fillRect(lp, deckY(lp) - 48, 10, 3);
        g.fillStyle = 'rgba(255,214,140,0.95)'; g.beginPath(); g.arc(lp + 10, deckY(lp) - 45, 4, 0, Math.PI * 2); g.fill();
      }
      // Every other block stands in front of the road (on its own layer, so passing cars slip behind them)
      var fg = frontC.getContext('2d');
      rects.forEach(function (r, i) {
        if (i % 2) return;
        fg.drawImage(blocks, r[0], r[1], r[2], h - r[1], r[0], r[1], r[2], h - r[1]);
      });
      // Two palm trees just outside the window, in silhouette
      [[0.4, 0.47, 1], [0.662, 0.5, -1]].forEach(function (pt) { drawPalm(fg, w * pt[0], h, h * pt[1], pt[2]); });
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
      traffic.push({
        mesh: m,
        dir: dir,
        len: lenU / 26,
        speed: between(0.06, 0.1) * (long ? 0.75 : 1),
        u: i / 7,    // spreads the 7 vehicles across the length of the road (0 to 1)
        wait: 0
      });
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
    // Glowing screen: says HOME from across the room; up close the projects desktop sits over it
    var screenTex = canvasTex(1024, 590, function (g, w, h) {
      var bg = g.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#2a1446'); bg.addColorStop(1, '#5a1f5e');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      var halo = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.45);
      halo.addColorStop(0, 'rgba(255,120,220,0.35)'); halo.addColorStop(1, 'rgba(255,120,220,0)');
      g.fillStyle = halo; g.fillRect(0, 0, w, h);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '600 120px "Instrument Sans", "Helvetica Neue", Arial, sans-serif';
      if ('letterSpacing' in g) g.letterSpacing = '18px';
      g.shadowColor = 'rgba(255,110,220,0.9)'; g.shadowBlur = 30;
      g.fillStyle = '#ffd6f3'; g.fillText('HOME', w / 2, h / 2);
    });
    var screen = new T.Mesh(new T.PlaneGeometry(2.36, 1.36), new T.MeshBasicMaterial({ map: screenTex }));
    screen.position.set(0, 1.4, 0.065);
    monitor.add(screen);
    var screenGlow = new T.PointLight(0xc27bff, 0.6, 4.5, 2);
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
    var shade = new T.Mesh(new T.ConeGeometry(0.26, 0.36, 20, 1, true), new T.MeshStandardMaterial({ color: C.neon, emissive: 0x8a1f72, roughness: 0.5, side: T.DoubleSide }));
    shade.position.set(-0.62, 1.32, 0.2); shade.rotation.z = 0.7;
    lampArm.add(shade);
    cyl(0.08, 0.08, 0.06, new T.MeshBasicMaterial({ color: 0xffe6f6 }), -0.66, 1.24, 0.2, lampArm);

    var phone = box(0.34, 0.04, 0.66, mat(0x111214, { roughness: 0.3 }), 1.55, 1.65, 0.35, desk);
    phone.rotation.y = -0.35;
    var phoneGlass = new T.Mesh(new T.PlaneGeometry(0.3, 0.6), new T.MeshBasicMaterial({ color: 0x0c0e11 }));
    phoneGlass.rotation.x = -Math.PI / 2;
    phoneGlass.position.y = 0.021;
    phone.add(phoneGlass);
    var PHONE_REST = { x: 1.55, y: 1.65, z: 0.35, rx: 0, ry: -0.35 };
    var PHONE_UP = { x: 1.55, y: 2.55, z: 0.75, rx: Math.PI / 2, ry: 0 };   // lifted, facing you (desk sits at z -2.2)

    /* ---------- Back wall: ID card board and the shelf ---------- */
    var boardTex = canvasTex(920, 480, function (g, w, h) {
      g.fillStyle = '#26242c'; g.fillRect(0, 0, w, h);
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
    var chairM = mat(0x26242c, { roughness: 0.7 }), chromeM = mat(0x8c8796, { roughness: 0.3, metalness: 0.8 });
    for (var leg5 = 0; leg5 < 5; leg5++) {
      var la = leg5 * Math.PI * 2 / 5, legG = new T.Group();
      legG.rotation.y = la; legG.position.y = 0.16; chair.add(legG);
      box(0.08, 0.06, 0.62, chromeM, 0, 0, 0.31, legG);
      var caster = new T.Mesh(new T.SphereGeometry(0.075, 10, 8), mat(0x141317)); caster.position.set(0, -0.08, 0.6); legG.add(caster);
    }
    cyl(0.05, 0.05, 0.8, chromeM, 0, 0.55, 0, chair, 12);                  // gas lift
    box(1.1, 0.16, 1.0, chairM, 0, 1.03, 0, chair);                         // seat
    box(1.0, 0.04, 0.9, mat(0x34313b, { roughness: 0.9 }), 0, 1.12, 0, chair);
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
    cyl(0.06, 0.06, 0.9, mat(0x3a3742), 0, -0.45, 0, fan, 8);
    cyl(0.35, 0.3, 0.25, mat(0x3a3742), 0, -0.95, 0, fan);
    var blades = new T.Group();
    blades.position.y = -0.98;
    fan.add(blades);
    for (var bl = 0; bl < 3; bl++) {
      var arm = new T.Group();
      arm.rotation.y = bl * (Math.PI * 2 / 3);
      blades.add(arm);
      var blade = box(2.4, 0.04, 0.45, mat(0x3a3742), 1.4, 0, 0, arm);
      blade.rotation.x = 0.12;
    }
    cyl(0.12, 0.12, 0.05, new T.MeshBasicMaterial({ color: 0xf2eaff }), 0, -1.1, 0, fan);

    /* ---------- Lounge corner by the window: sofa, coffee table, floor lamp, art and a wall shelf ---------- */
    var sofa = new T.Group();
    sofa.position.set(-6.45, 0, 4.95);                               // back against the left wall, facing into the room
    scene.add(sofa);
    var fabricM = mat(0x4a4553, { roughness: 0.92 });
    var fabricDarkM = mat(0x403b49, { roughness: 0.95 });
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
    var cushA = new T.MeshStandardMaterial({ map: cushionTex('#8f8798', '#d8d2df'), roughness: 0.95 });
    var cushB = new T.MeshStandardMaterial({ map: cushionTex('#c9c2cf', '#a59cae'), roughness: 0.95 });
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
    var flampM = mat(0x1d1b22, { roughness: 0.4, metalness: 0.5 });
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
      var pr = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, color: 0xd8d0dc }));
      pr.rotation.y = Math.PI / 2; pr.position.set(RX0 + 0.215, y, z); scene.add(pr);
    }
    wallPrint(6.3, 4.3, 1.0, 1.25, function (g, w, h) {              // a figure walking in the rain, in ink
      g.fillStyle = '#e9e4ea'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(40,36,48,0.25)'; g.lineWidth = 1;
      for (var r = 0; r < 70; r++) { var rx = Math.random() * w, ry = Math.random() * h; g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx - 6, ry + 18); g.stroke(); }
      g.fillStyle = '#2a2630';
      g.beginPath(); g.arc(w / 2, h * 0.3, 14, 0, Math.PI * 2); g.fill();                   // head
      g.beginPath(); g.moveTo(w / 2 - 34, h * 0.86); g.lineTo(w / 2 - 18, h * 0.38); g.lineTo(w / 2 + 18, h * 0.38); g.lineTo(w / 2 + 40, h * 0.86); g.fill();   // coat
      g.beginPath(); g.ellipse(w / 2 - 6, h * 0.2, 62, 20, -0.1, Math.PI, 0); g.fill();       // umbrella
      g.fillRect(w / 2 - 7, h * 0.2, 3, h * 0.2);
    });
    wallPrint(7.65, 4.5, 0.9, 0.7, function (g, w, h) {               // soft abstract shapes
      g.fillStyle = '#d9d2dc'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#7a6f86'; g.beginPath(); g.arc(w * 0.35, h * 0.55, h * 0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3d3647'; g.fillRect(w * 0.55, h * 0.2, w * 0.25, h * 0.6);
      g.strokeStyle = '#ff7ad9'; g.lineWidth = 4; g.beginPath(); g.moveTo(w * 0.1, h * 0.85); g.lineTo(w * 0.9, h * 0.85); g.stroke();
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
    var cabM = mat(0x2a2730, { roughness: 0.55 }), cabTopM = mat(0x342f3a, { roughness: 0.45 });
    box(4.2, 0.1, 1.0, cabTopM, 0, 1.15, 0, cab);                                         // top
    box(4.1, 0.95, 0.94, cabM, 0, 0.62, 0, cab);                                          // body
    [-1.95, 1.95].forEach(function (lx) { box(0.08, 0.16, 0.08, mat(C.metal), lx, 0.08, 0.36, cab); box(0.08, 0.16, 0.08, mat(C.metal), lx, 0.08, -0.36, cab); });
    box(1.3, 0.62, 0.02, mat(0x1d1b22), -1.25, 0.66, 0.475, cab);                         // open shelf on the left
    box(1.2, 0.04, 0.4, mat(0x111015), -1.25, 0.9, 0.3, cab);                             // an amp in it
    [0.2, 1.35].forEach(function (dx) {                                                   // two doors with slim handles
      box(1.08, 0.82, 0.02, mat(0x302c36, { roughness: 0.5 }), dx, 0.63, 0.48, cab);
      box(0.03, 0.3, 0.03, mat(0x8d8698, { metalness: 0.6 }), dx - 0.44, 0.66, 0.5, cab);
    });
    // Turntable
    var tt = new T.Group(); tt.position.set(-1.35, 1.2, 0.05); cab.add(tt);
    box(1.0, 0.14, 0.8, mat(0x1c1a20, { roughness: 0.4 }), 0, 0.07, 0, tt);
    cyl(0.34, 0.34, 0.03, mat(0x0d0c10, { roughness: 0.3 }), -0.1, 0.16, 0, tt, 32);
    cyl(0.11, 0.11, 0.032, mat(0xff5fd2, { roughness: 0.6 }), -0.1, 0.165, 0, tt, 20);  // record label
    var tone = box(0.03, 0.03, 0.55, mat(0x9a95a4, { metalness: 0.7, roughness: 0.3 }), 0.33, 0.21, 0.02, tt); tone.rotation.y = 0.35;
    cyl(0.05, 0.05, 0.08, mat(0x9a95a4, { metalness: 0.7 }), 0.38, 0.18, -0.25, tt, 12);
    var dust = box(1.02, 0.02, 0.82, new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.1 }), 0, 0.55, -0.42, tt);
    dust.rotation.x = -1.2;                                                                // lid propped open
    // A short stack of records lying flat
    [0x2b2733, 0xe9c14a, 0x3e6e8c].forEach(function (rc, k) {
      var rr = box(0.62, 0.025, 0.62, mat(rc, { roughness: 0.7 }), -0.35, 1.215 + k * 0.026, 0.05, cab); rr.rotation.y = k * 0.18 - 0.1;
    });
    // Records standing in a row
    var sleeveColors = [0xc4553f, 0x2c4ea3, 0xece6da, 0x5b4a7a, 0xe9c14a, 0x2f7d77, 0x1f1d24, 0xff6ad5, 0x8a5c3c, 0x3e6e8c, 0xd9741c, 0x4a4458];
    for (var rv = 0; rv < 12; rv++) {
      var sl2 = box(0.035, 0.66, 0.66, mat(sleeveColors[rv], { roughness: 0.8 }), 0.35 + rv * 0.06, 1.53, 0.0, cab);
      sl2.rotation.z = -0.12 + (rv === 11 ? -0.15 : 0);
    }
    box(0.04, 0.4, 0.5, mat(C.metal), 1.1, 1.4, 0, cab);                                   // bookend
    // Speaker with a glowing pink ring
    box(0.64, 0.9, 0.55, mat(0x1f1d24, { roughness: 0.5 }), 1.68, 1.65, 0, cab);
    var ring = new T.Mesh(new T.RingGeometry(0.16, 0.21, 40), new T.MeshBasicMaterial({ color: C.neon, side: T.DoubleSide }));
    ring.position.set(1.68, 1.68, 0.28);
    cab.add(ring);
    cyl(0.15, 0.15, 0.02, mat(0x0f0e12), 1.68, 1.68, 0.28, cab, 24).rotation.x = Math.PI / 2;
    var speakerGlow = new T.PointLight(0xff5fd2, 0.6, 3.2, 2);
    speakerGlow.position.set(9.6, 1.9, -4.5);
    scene.add(speakerGlow);

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
    poster(6.95, 4.7, 1.25, 1.6, 0xff5fd2, function (g, w, h) {
      var bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#1a0f33'); bg.addColorStop(0.55, '#5b1d6e'); bg.addColorStop(0.62, '#2a0f3d'); bg.addColorStop(1, '#12081f');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      var sun = g.createLinearGradient(0, h * 0.2, 0, h * 0.58);
      sun.addColorStop(0, '#ffd36b'); sun.addColorStop(1, '#ff4fb8');
      g.fillStyle = sun; g.beginPath(); g.arc(w / 2, h * 0.45, w * 0.3, Math.PI, 0); g.fill();
      g.fillStyle = '#5b1d6e';
      for (var b = 0; b < 5; b++) g.fillRect(w * 0.18, h * (0.36 + b * 0.02), w * 0.64, 3 + b);   // sun stripes
      g.strokeStyle = '#ff6ad5'; g.lineWidth = 2;
      for (var gl = 0; gl < 8; gl++) { var gy = h * 0.62 + Math.pow(gl / 7, 1.7) * h * 0.38; g.beginPath(); g.moveTo(0, gy); g.lineTo(w, gy); g.stroke(); }
      for (var gv = -6; gv <= 6; gv++) { g.beginPath(); g.moveTo(w / 2 + gv * 8, h * 0.62); g.lineTo(w / 2 + gv * 70, h); g.stroke(); }
      g.fillStyle = '#12081f';                                                              // palm silhouette
      g.fillRect(w * 0.78, h * 0.28, 7, h * 0.36);
      for (var pf = 0; pf < 7; pf++) {
        var pa = -Math.PI + pf * (Math.PI / 6);
        g.beginPath(); g.moveTo(w * 0.79, h * 0.28);
        g.quadraticCurveTo(w * 0.79 + Math.cos(pa) * 40, h * 0.28 + Math.sin(pa) * 30 - 10, w * 0.79 + Math.cos(pa) * 70, h * 0.28 + Math.sin(pa) * 20 + 22);
        g.lineWidth = 6; g.strokeStyle = '#12081f'; g.stroke();
      }
    });
    // A night drive: neon skyline inside a ring
    poster(8.75, 4.55, 1.2, 1.5, 0x9b6bff, function (g, w, h) {
      g.fillStyle = '#0f0b1c'; g.fillRect(0, 0, w, h);
      g.shadowColor = '#ff5fd2'; g.shadowBlur = 18;
      g.strokeStyle = '#ff7ad9'; g.lineWidth = 6;
      g.beginPath(); g.arc(w / 2, h * 0.42, w * 0.34, 0, Math.PI * 2); g.stroke();
      g.shadowBlur = 0;
      g.fillStyle = '#2a1f4f';
      [[0.22, 0.5], [0.3, 0.36], [0.4, 0.44], [0.5, 0.3], [0.6, 0.42], [0.7, 0.34], [0.78, 0.5]].forEach(function (bd) {
        g.fillRect(w * bd[0] - 16, h * bd[1], 32, h * 0.62 - h * bd[1]);
      });
      g.fillStyle = '#ffd6f3';
      for (var wl = 0; wl < 40; wl++) g.fillRect(between(w * 0.2, w * 0.8), between(h * 0.32, h * 0.6), 3, 4);
      g.fillStyle = '#ff5fd2'; g.fillRect(0, h * 0.62, w, 3);
      g.fillStyle = '#c9b8ff'; g.font = '700 26px ' + '"Instrument Sans", Arial, sans-serif'; g.textAlign = 'center';
      if ('letterSpacing' in g) g.letterSpacing = '6px';
      g.fillText('NIGHT DRIVE', w / 2, h * 0.82);
    });

    /* ---------- Reading corner: leather armchair and a small round table ---------- */
    var armchair = new T.Group();
    armchair.position.set(7.4, 0, 1.6);
    armchair.rotation.y = -2.25;                                         // facing back into the room
    scene.add(armchair);
    var leatherM = mat(0x3b3542, { roughness: 0.42, metalness: 0.05 });
    var cushionM = mat(0x453e4d, { roughness: 0.45 });
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
    cyl(0.58, 0.58, 0.06, mat(0x2b2832, { roughness: 0.4 }), 0, 1.25, 0, sideT, 32);
    cyl(0.04, 0.04, 1.2, mat(C.metal, { metalness: 0.5 }), 0, 0.62, 0, sideT, 10);
    [0, 2.1, 4.2].forEach(function (la2) {
      var ft = box(0.05, 0.04, 0.5, mat(C.metal, { metalness: 0.5 }), Math.sin(la2) * 0.2, 0.03, Math.cos(la2) * 0.2, sideT); ft.rotation.y = la2;
    });
    cyl(0.12, 0.1, 0.24, mat(0xece6da, { roughness: 0.5 }), 0.18, 1.4, 0.12, sideT, 18);         // mug
    box(0.04, 0.1, 0.04, mat(0xece6da), 0.33, 1.42, 0.12, sideT);
    var tbook = box(0.5, 0.08, 0.36, mat(0x2a2733, { roughness: 0.7 }), -0.15, 1.32, -0.1, sideT); tbook.rotation.y = 0.4;

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
      if (name !== current) whoosh();
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
      '<div class="room-phone__status"><span>Dhaka</span><span class="room-phone__battery" aria-hidden="true"></span></div>' +
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
      '<p class="room-phone__toast" role="status" aria-live="polite"></p>';

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

    var phoneTime = phoneUi.querySelector('.room-phone__time'), phoneDate = phoneUi.querySelector('.room-phone__date');
    function tickPhone() {
      var now = new Date();
      try {
        phoneTime.textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' });
        phoneDate.textContent = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dhaka' });
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
    var PHONE_CORNERS = [[1.4, 2.85, -1.428], [1.7, 2.85, -1.428], [1.4, 2.25, -1.428], [1.7, 2.25, -1.428]];
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
        if (hit) flyTo(hit);
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
      placePhone(W, H);
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
        showHint();
      },
      dispose: function () {
        cancelAnimationFrame(raf);
        clearTimeout(hintTimer);
        closeApp(false);                      // put any open demo back on the flat page
        clearInterval(clockTimer);
        clearInterval(phoneTimer);
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
