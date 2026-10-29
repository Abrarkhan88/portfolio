/* =========================================================
   Abrar Sami Khan, portfolio
   main.js: preloader, smooth scroll, scroll sync, hero, reveals,
   header state, progress line, cursor, mobile menu
   ========================================================= */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------- Motion tokens, read from style.css ---------- */
  var cssVars = getComputedStyle(root);
  function token(name, fallback) {
    var v = cssVars.getPropertyValue(name).trim();
    return v || fallback;
  }
  function seconds(name, fallback) {
    var v = token(name, '');
    if (!v) return fallback;
    return v.indexOf('ms') > -1 ? parseFloat(v) / 1000 : parseFloat(v);
  }
  var MOTION = {
    fast: seconds('--dur-fast', 0.18),
    section: seconds('--dur-section', 0.64),
    preloader: seconds('--dur-preloader', 0.8),
    stagger: seconds('--stagger', 0.055),
    ease: token('--ease-gsap', 'power3.out'),
    parallaxMax: Math.min(parseFloat(token('--parallax-max', '0.04')) || 0.04, 0.049)
  };

  var header = document.querySelector('.site-header');
  var lenis = null; // set when smooth scroll is active

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---------- Mobile menu (works with or without GSAP) ---------- */
  function setupMenu() {
    var nav = document.querySelector('.site-nav');
    var toggle = document.querySelector('.site-nav__toggle');
    if (!nav || !toggle) return;

    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Close' : 'Menu';
      if (lenis) { open ? lenis.stop() : lenis.start(); }
    }

    toggle.addEventListener('click', function () {
      setOpen(!nav.classList.contains('is-open'));
    });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  /* ---------- In-page links: smooth with Lenis, native otherwise ---------- */
  function setupAnchors() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;
      var id = link.getAttribute('href');
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;

      if (lenis) {
        e.preventDefault();
        lenis.scrollTo(target, { offset: 0 });
        if (history.pushState) history.pushState(null, '', id);
      }
      // Move keyboard focus to the section for screen reader and keyboard users
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  }

  /* ---------- Active nav link follows the section in view ---------- */
  function setupActiveNav() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.site-nav__list a[href^="#"]'));
    links.forEach(function (link) {
      var section = document.querySelector(link.getAttribute('href'));
      if (!section) return;
      ScrollTrigger.create({
        trigger: section,
        start: 'top 50%',
        end: 'bottom 50%',
        onToggle: function (self) {
          if (self.isActive) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        }
      });
    });
  }

  /* ---------- Preloader (once per visit) ---------- */
  function runPreloader(reduce) {
    var el = document.querySelector('.preloader');
    if (!el) return Promise.resolve();

    var seen = false;
    try {
      seen = sessionStorage.getItem('asks-preloader') === '1';
      sessionStorage.setItem('asks-preloader', '1');
    } catch (err) { /* storage blocked: just show it */ }

    if (seen || reduce) {
      el.remove();
      return Promise.resolve();
    }

    var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    var minTime = new Promise(function (r) { setTimeout(r, 700); });
    var maxTime = new Promise(function (r) { setTimeout(r, 2500); });

    return new Promise(function (resolve) {
      var intro = gsap.timeline({ defaults: { ease: MOTION.ease } });
      intro
        .from('.preloader__name', { yPercent: 110, duration: MOTION.section })
        .to('.preloader__rule', { scaleX: 0.7, duration: 0.9, ease: 'power1.inOut' }, '<0.1');

      var introDone = new Promise(function (r) {
        if (intro.progress() === 1) r();
        else intro.eventCallback('onComplete', r);
      });

      Promise.race([Promise.all([fontsReady, minTime]), maxTime])
        .then(function () { return introDone; })
        .then(function () {
          gsap.timeline()
            .to('.preloader__rule', { scaleX: 1, duration: 0.3, ease: 'power2.out' })
            .to(el, { yPercent: -100, duration: MOTION.preloader, ease: 'power3.inOut' }, '>0.05')
            .add(function () { el.remove(); resolve(); });
        });
    });
  }

  /* ---------- Reveals ---------- */
  function setupReveals(isDesktop) {
    // Line-by-line text reveals (desktop with SplitText), simple fades elsewhere
    var lineEls = Array.prototype.slice.call(document.querySelectorAll('[data-reveal="lines"]'));
    lineEls.forEach(function (el) {
      if (isDesktop && window.SplitText) {
        SplitText.create(el, {
          type: 'lines',
          mask: 'lines',
          linesClass: 'line',
          autoSplit: true,
          onSplit: function (self) {
            return gsap.from(self.lines, {
              yPercent: 105,
              duration: MOTION.section,
              stagger: MOTION.stagger * 1.5,
              ease: MOTION.ease,
              scrollTrigger: { trigger: el, start: 'top 88%', once: true }
            });
          }
        });
      } else {
        gsap.from(el, {
          autoAlpha: 0,
          y: 18,
          duration: MOTION.section,
          ease: MOTION.ease,
          scrollTrigger: { trigger: el, start: 'top 90%', once: true }
        });
      }
    });

    // Fade-up for supporting copy, batched so neighbours stagger together
    var fadeEls = document.querySelectorAll('[data-reveal="fade"]');
    if (fadeEls.length) {
      gsap.set(fadeEls, { autoAlpha: 0, y: 16 });
      ScrollTrigger.batch(fadeEls, {
        start: 'top 92%',
        once: true,
        onEnter: function (batch) {
          gsap.to(batch, {
            autoAlpha: 1,
            y: 0,
            duration: MOTION.section,
            stagger: MOTION.stagger,
            ease: MOTION.ease,
            overwrite: true
          });
        }
      });
    }

    // Subtle parallax for media: data-parallax="0.03" (capped below 5%)
    if (isDesktop) {
      document.querySelectorAll('[data-parallax]').forEach(function (el) {
        var amount = Math.min(parseFloat(el.getAttribute('data-parallax')) || MOTION.parallaxMax, MOTION.parallaxMax) * 100;
        gsap.fromTo(el, { yPercent: -amount }, {
          yPercent: amount,
          ease: 'none',
          scrollTrigger: { trigger: el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      });
    }
  }

  /* ---------- Hero entrance + scroll behaviour ---------- */
  function setupHero(isDesktop, context) {
    var hero = document.querySelector('.hero');
    if (!hero) return;

    var name = hero.querySelector('.hero__name');
    var nameWrap = hero.querySelector('.hero__name-wrap');
    var lede = hero.querySelector('.hero__lede');
    var metas = hero.querySelectorAll('.hero__meta');
    var cue = hero.querySelector('.hero__cue');
    var cueText = hero.querySelector('.hero__cue-text');
    var cueLine = hero.querySelector('.hero__cue-line');

    function build() {
      var tl = gsap.timeline({ defaults: { ease: MOTION.ease, duration: MOTION.section } });

      if (isDesktop && window.SplitText) {
        // Desktop: the name rises word by word, the lede line by line
        var nameSplit = SplitText.create(name, { type: 'words', mask: 'words' });
        var ledeSplit = SplitText.create(lede, { type: 'lines', mask: 'lines' });

        tl.from(nameSplit.words, { yPercent: 110, duration: MOTION.section * 1.5, stagger: MOTION.stagger * 2 })
          .from(ledeSplit.lines, { yPercent: 105, stagger: MOTION.stagger * 1.5 }, '-=0.55')
          .add(function () {
            // Hand the text back to normal layout so it reflows on resize
            nameSplit.revert();
            ledeSplit.revert();
          }, '+=0.1');
      } else {
        // Mobile: simple fades
        tl.from(name, { autoAlpha: 0, y: 24 })
          .from(lede, { autoAlpha: 0, y: 16 }, '-=0.4');
      }

      tl.from(metas, { autoAlpha: 0, stagger: MOTION.stagger }, 0.15)
        .from(cueText, { autoAlpha: 0, y: 8 }, '-=0.35')
        .from(cueLine, { scaleX: 0, duration: 0.6 }, '<0.1');

      // The cue fades out over the first 240px of scroll
      gsap.to(cue, {
        autoAlpha: 0,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: '+=240', scrub: true }
      });

      // Subtle parallax on the name as the hero leaves (desktop, 4%)
      if (isDesktop) {
        gsap.to(nameWrap, {
          yPercent: -MOTION.parallaxMax * 100,
          ease: 'none',
          scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
        });
      }
    }

    // Split only after web fonts load, so line breaks are measured correctly
    if (!document.fonts || document.fonts.status === 'loaded') build();
    else document.fonts.ready.then(function () { context.add(build); });
  }

  /* ---------- Chapter stories: pinned + scrubbed on desktop ---------- */
  function setupStories() {
    var cleanups = [];

    document.querySelectorAll('[data-story]').forEach(function (story) {
      var items = Array.prototype.slice.call(story.querySelectorAll('.story__item'));
      var links = Array.prototype.slice.call(story.querySelectorAll('.story__index a'));
      var bar = story.querySelector('.story__progress-bar');
      var n = items.length;
      if (n < 2) return;

      story.classList.add('is-pinned');

      // Panels share one grid cell; only the first is visible at the start.
      // Opacity (not visibility) keeps every panel readable by screen readers.
      gsap.set(items, { opacity: 0 });
      gsap.set(items[0], { opacity: 1 });

      var hold = 0.7;          // scroll "dwell" per panel
      var midpoints = [];      // timeline time at which each panel takes over
      var tl = gsap.timeline({ defaults: { ease: 'power1.inOut', duration: 1 } });

      tl.to({}, { duration: hold });
      for (var i = 1; i < n; i++) {
        midpoints.push(tl.duration() + 0.5);
        tl.to(items[i - 1], { opacity: 0, y: -28 })
          .fromTo(items[i], { opacity: 0, y: 28 }, { opacity: 1, y: 0 }, '<')
          .to({}, { duration: hold });
      }
      if (bar) tl.fromTo(bar, { scaleY: 1 / n }, { scaleY: 1, ease: 'none', duration: tl.duration() }, 0);

      var current = -1;
      function setActive(idx) {
        if (idx === current) return;
        current = idx;
        items.forEach(function (item, j) { item.classList.toggle('is-active', j === idx); });
        links.forEach(function (link, j) {
          if (j === idx) link.setAttribute('aria-current', 'step');
          else link.removeAttribute('aria-current');
        });
      }
      setActive(0);

      var st = ScrollTrigger.create({
        trigger: story,
        start: 'top top',
        end: function () { return '+=' + Math.round(window.innerHeight * 0.65 * n); },
        pin: true,
        scrub: 0.6,
        animation: tl,
        invalidateOnRefresh: true,
        onUpdate: function () {
          var t = tl.time();
          var idx = 0;
          for (var k = 0; k < midpoints.length; k++) if (t >= midpoints[k]) idx = k + 1;
          setActive(idx);
        }
      });

      // Index links jump to that panel's scroll position inside the pin
      function onIndexClick(e) {
        var link = e.target.closest('a');
        if (!link) return;
        var idx = links.indexOf(link);
        if (idx < 0) return;
        e.preventDefault();
        e.stopPropagation();
        var t = idx === 0 ? 0 : midpoints[idx - 1] + 0.5;
        var y = st.start + (st.end - st.start) * (t / tl.duration());
        if (lenis) lenis.scrollTo(y);
        else window.scrollTo({ top: y, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
      var index = story.querySelector('.story__index');
      index.addEventListener('click', onIndexClick);

      cleanups.push(function () {
        index.removeEventListener('click', onIndexClick);
        story.classList.remove('is-pinned');
        items.forEach(function (item) { item.classList.remove('is-active'); });
        links.forEach(function (link) { link.removeAttribute('aria-current'); });
      });
    });

    return function () { cleanups.forEach(function (fn) { fn(); }); };
  }

  /* ---------- Custom cursor + magnetic links (desktop only) ---------- */
  function setupCursor() {
    var cursor = document.querySelector('.cursor');
    if (!cursor) return null;

    root.classList.add('has-cursor');
    gsap.set(cursor, { xPercent: -50, yPercent: -50, autoAlpha: 0 });

    var xTo = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' });
    var yTo = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });
    var visible = false;
    var interactive = 'a, button, [data-magnetic]';

    function onMove(e) {
      if (!visible) {
        gsap.set(cursor, { x: e.clientX, y: e.clientY });
        gsap.to(cursor, { autoAlpha: 1, duration: MOTION.fast });
        visible = true;
      }
      xTo(e.clientX);
      yTo(e.clientY);
    }
    function onLeaveWindow() {
      gsap.to(cursor, { autoAlpha: 0, duration: MOTION.fast });
      visible = false;
    }
    function onOver(e) {
      if (e.target.closest && e.target.closest(interactive)) cursor.classList.add('is-active');
    }
    function onOut(e) {
      var to = e.relatedTarget;
      if (!(to && to.closest && to.closest(interactive))) cursor.classList.remove('is-active');
    }

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeaveWindow);
    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);

    // Magnetic pull: elements drift up to 8px toward the pointer
    var magnets = Array.prototype.slice.call(document.querySelectorAll('[data-magnetic]')).map(function (el) {
      var mx = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' });
      var my = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' });
      function move(e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) * 0.25;
        var dy = (e.clientY - (r.top + r.height / 2)) * 0.35;
        mx(gsap.utils.clamp(-8, 8, dx));
        my(gsap.utils.clamp(-8, 8, dy));
      }
      function leave() { mx(0); my(0); }
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      return function () {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', leave);
        gsap.set(el, { clearProps: 'transform' });
      };
    });

    return function cleanup() {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeaveWindow);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      magnets.forEach(function (fn) { fn(); });
      root.classList.remove('has-cursor');
      cursor.classList.remove('is-active');
    };
  }

  /* ---------- Everything scroll-related, per media condition ---------- */
  function initMotion() {
    var mm = gsap.matchMedia();

    mm.add({
      isDesktop: '(min-width: 900px)',
      finePointer: '(hover: hover) and (pointer: fine)',
      reduce: '(prefers-reduced-motion: reduce)'
    }, function (context) {
      var c = context.conditions;
      var tick = null;
      var cleanupCursor = null;

      // Lenis smooth scroll, driven by the GSAP ticker (skipped for reduced motion)
      if (!c.reduce && window.Lenis) {
        lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
        lenis.on('scroll', ScrollTrigger.update);
        tick = function (time) { lenis.raf(time * 1000); };
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
      }

      // Scroll progress line (scroll-linked, so kept for reduced motion too)
      gsap.fromTo('.progress__bar', { scaleX: 0 }, {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: { start: 0, end: 'max', scrub: c.reduce ? true : 0.3 }
      });

      // Header gets a hairline and backing once the page has moved
      ScrollTrigger.create({
        start: 8,
        end: 'max',
        onToggle: function (self) { header.classList.toggle('is-scrolled', self.isActive); }
      });

      // Order matters: ScrollTriggers are created top to bottom, and pins
      // come before the triggers below them so their spacing is counted.
      var cleanupStories = null;
      if (!c.reduce) {
        setupHero(c.isDesktop, context);
        if (c.isDesktop) cleanupStories = setupStories();
      }

      setupActiveNav();

      if (!c.reduce) setupReveals(c.isDesktop);

      if (c.isDesktop && c.finePointer && !c.reduce) cleanupCursor = setupCursor();

      return function () {
        if (tick) gsap.ticker.remove(tick);
        if (lenis) { lenis.destroy(); lenis = null; }
        gsap.ticker.lagSmoothing(500, 33);
        if (cleanupCursor) cleanupCursor();
        if (cleanupStories) cleanupStories();
        header.classList.remove('is-scrolled');
      };
    });

    // Recalculate trigger positions once web fonts change line lengths
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }
  }

  /* =========================================================
     DEMOS (mock data only). Each works without GSAP and with
     reduced motion; GSAP only adds the transitions.
     ========================================================= */
  function canAnimate() { return !!window.gsap && !prefersReducedMotion(); }

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text;
    return node;
  }

  /* ---------- Demo: clean a monthly report (Work chapter) ---------- */
  function setupReportDemo() {
    var host = document.querySelector('[data-demo="report"]');
    if (!host) return;

    // Made-up export: two duplicates, one messy owner name, one blank owner
    var RAW = [
      { month: 'Sep 2026', account: 'Account 101', owner: 'Owner A', logins: 42 },
      { month: 'Sep 2026', account: 'Account 102', owner: '  owner b ', logins: 17 },
      { month: 'Sep 2026', account: 'Account 103', owner: 'Owner C', logins: 63 },
      { month: 'Sep 2026', account: 'Account 101', owner: 'Owner A', logins: 42 },
      { month: 'Sep 2026', account: 'Account 104', owner: '', logins: 8 },
      { month: 'Sep 2026', account: 'Account 105', owner: 'Owner B', logins: 29 },
      { month: 'Sep 2026', account: 'Account 103', owner: 'Owner C', logins: 63 },
      { month: 'Sep 2026', account: 'Account 106', owner: 'Owner C', logins: 51 }
    ];
    var DEFAULT_OWNER = 'Owner A';

    function tidyName(s) {
      return s.trim().replace(/\s+/g, ' ').toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }

    // The "script": work out what would change, without touching the data
    function plan(rows) {
      var seen = {};
      return rows.map(function (r) {
        var key = r.month + '|' + r.account;
        if (seen[key]) return { row: r, action: 'dup', note: 'Duplicate, skipped' };
        seen[key] = true;
        if (!r.owner.trim()) return { row: r, action: 'fill', owner: DEFAULT_OWNER, note: 'No owner, set to ' + DEFAULT_OWNER };
        var clean = tidyName(r.owner);
        if (clean !== r.owner) return { row: r, action: 'trim', owner: clean, note: 'Name tidied to ' + clean };
        return { row: r, action: 'keep', owner: r.owner, note: '' };
      });
    }

    function groupByOwner(steps) {
      var groups = {};
      steps.forEach(function (s) {
        if (s.action === 'dup') return;
        (groups[s.owner] = groups[s.owner] || []).push({ account: s.row.account, logins: s.row.logins });
      });
      return Object.keys(groups).sort().map(function (owner) {
        var rows = groups[owner].sort(function (a, b) { return a.account < b.account ? -1 : 1; });
        var total = rows.reduce(function (t, r) { return t + r.logins; }, 0);
        return { owner: owner, rows: rows, total: total };
      });
    }

    var steps = plan(RAW);
    var groups = groupByOwner(steps);
    var count = function (a) { return steps.filter(function (s) { return s.action === a; }).length; };

    // ----- Build the widget -----
    host.innerHTML = '';
    var bar = el('div', { class: 'demo__bar' });
    var file = el('p', { class: 'demo__file' }, 'monthly-export.csv, 8 rows');
    var buttons = el('div', { class: 'demo__bar' });
    var primary = el('button', { class: 'btn', type: 'button' }, 'Preview changes');
    var reset = el('button', { class: 'btn btn--quiet', type: 'button', hidden: '' }, 'Start over');
    buttons.append(primary, reset);
    bar.append(file, buttons);

    var status = el('p', { class: 'demo__status', 'aria-live': 'polite' }, 'Raw export as it arrives. Nothing has changed yet.');

    var views = el('div', { class: 'demo__views' });

    // Raw view
    var rawView = el('div', { class: 'demo__view' });
    var rawTable = el('table', { class: 'demo-table' });
    rawTable.innerHTML = '<caption class="visually-hidden">Raw monthly export</caption>' +
      '<thead><tr><th class="col-month" scope="col">Month</th><th scope="col">Account</th><th scope="col">Owner</th>' +
      '<th class="num" scope="col">Logins</th><th scope="col">Script note</th></tr></thead>';
    var rawBody = el('tbody');
    var noteCells = [];
    steps.forEach(function (s) {
      var tr = el('tr');
      tr.append(
        el('td', { class: 'col-month' }, s.row.month),
        el('td', null, s.row.account),
        el('td', null, s.row.owner.trim() ? '"' + s.row.owner + '"' : '(blank)'),
        el('td', { class: 'num' }, String(s.row.logins))
      );
      var note = el('td', { class: 'note' });
      var noteText = el('span', null, '');
      note.append(noteText);
      tr.append(note);
      rawBody.append(tr);
      noteCells.push({ tr: tr, span: noteText, step: s });
    });
    rawTable.append(rawBody);
    rawView.append(rawTable);

    // Output view
    var outView = el('div', { class: 'demo__view', hidden: '' });
    var tabs = el('div', { class: 'demo-tabs', role: 'tablist', 'aria-label': 'Owner tabs' });
    var panel = el('div', { role: 'tabpanel', id: 'demo-report-panel', tabindex: '0' });
    var tabButtons = groups.map(function (g, i) {
      var b = el('button', {
        type: 'button', role: 'tab', id: 'demo-report-tab-' + i,
        'aria-controls': 'demo-report-panel', 'aria-selected': i === 0 ? 'true' : 'false',
        tabindex: i === 0 ? '0' : '-1'
      }, g.owner + ' (' + g.rows.length + ')');
      tabs.append(b);
      return b;
    });

    var maxTotal = Math.max.apply(null, groups.map(function (g) { return g.total; }));
    var bars = el('div', { class: 'demo-bars', 'aria-label': 'Logins by owner' });
    var fills = groups.map(function (g) {
      var row = el('div', { class: 'demo-bars__row' });
      var track = el('span', { class: 'demo-bars__track', 'aria-hidden': 'true' });
      var fill = el('span', { class: 'demo-bars__fill' });
      fill.style.transform = 'scaleX(' + (g.total / maxTotal) + ')';
      track.append(fill);
      row.append(el('span', null, g.owner), track, el('span', { class: 'num' }, String(g.total)));
      bars.append(row);
      return { fill: fill, scale: g.total / maxTotal };
    });

    function renderPanel(i) {
      var g = groups[i];
      panel.setAttribute('aria-labelledby', 'demo-report-tab-' + i);
      panel.innerHTML = '';
      var t = el('table', { class: 'demo-table' });
      t.innerHTML = '<thead><tr><th scope="col">Account</th><th class="num" scope="col">Logins</th></tr></thead>';
      var tb = el('tbody');
      g.rows.forEach(function (r) {
        var tr = el('tr');
        tr.append(el('td', null, r.account), el('td', { class: 'num' }, String(r.logins)));
        tb.append(tr);
      });
      var tf = el('tfoot');
      var ftr = el('tr');
      ftr.append(el('td', null, 'Total'), el('td', { class: 'num' }, String(g.total)));
      tf.append(ftr);
      t.append(tb, tf);
      panel.append(t);
      if (canAnimate()) gsap.from(tb.children, { opacity: 0, x: -8, duration: 0.3, stagger: 0.04, ease: 'power2.out' });
    }

    function selectTab(i, focus) {
      tabButtons.forEach(function (b, j) {
        b.setAttribute('aria-selected', j === i ? 'true' : 'false');
        b.setAttribute('tabindex', j === i ? '0' : '-1');
      });
      if (focus) tabButtons[i].focus();
      renderPanel(i);
    }

    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('[role="tab"]');
      if (b) selectTab(tabButtons.indexOf(b), false);
    });
    tabs.addEventListener('keydown', function (e) {
      var i = tabButtons.indexOf(document.activeElement);
      if (i < 0) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); selectTab((i + 1) % tabButtons.length, true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); selectTab((i - 1 + tabButtons.length) % tabButtons.length, true); }
    });

    outView.append(tabs, panel, bars);
    views.append(rawView, outView);
    host.append(bar, status, views);

    // ----- States -----
    var state = 'raw';

    function preview() {
      state = 'preview';
      noteCells.forEach(function (c) {
        c.span.textContent = c.step.note;
        c.tr.classList.toggle('is-dup', c.step.action === 'dup');
      });
      status.textContent = '8 rows in. ' + count('dup') + ' duplicates will be skipped, ' + count('trim') +
        ' owner name tidied, ' + count('fill') + ' blank owner filled. ' + groups.length + ' owner tabs will be created.';
      primary.textContent = 'Run script';
      reset.hidden = false;
      if (canAnimate()) {
        var spans = noteCells.filter(function (c) { return c.step.note; }).map(function (c) { return c.span; });
        gsap.from(spans, { opacity: 0, x: -10, duration: 0.35, stagger: 0.06, ease: 'power2.out' });
      }
    }

    function run() {
      state = 'done';
      status.textContent = 'Done. ' + groups.length + ' tabs created from ' + (RAW.length - count('dup')) +
        ' clean rows. Pick an owner to see their tab.';
      primary.hidden = true;
      selectTab(0, false);
      if (canAnimate()) {
        gsap.timeline()
          .to(rawView, { opacity: 0, y: -12, duration: 0.3, ease: 'power2.in' })
          .add(function () { rawView.hidden = true; outView.hidden = false; })
          .fromTo(outView, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' })
          .fromTo(fills.map(function (f) { return f.fill; }), { scaleX: 0 },
            { scaleX: function (i) { return fills[i].scale; }, duration: 0.6, stagger: 0.08, ease: 'power3.out' }, '<0.1');
      } else {
        rawView.hidden = true;
        outView.hidden = false;
      }
    }

    function startOver() {
      state = 'raw';
      noteCells.forEach(function (c) { c.span.textContent = ''; c.tr.classList.remove('is-dup'); });
      status.textContent = 'Raw export as it arrives. Nothing has changed yet.';
      primary.textContent = 'Preview changes';
      primary.hidden = false;
      reset.hidden = true;
      outView.hidden = true;
      rawView.hidden = false;
      if (window.gsap) gsap.set([rawView, outView], { clearProps: 'opacity,transform' });
      primary.focus();
    }

    primary.addEventListener('click', function () {
      if (state === 'raw') preview();
      else if (state === 'preview') run();
    });
    reset.addEventListener('click', startOver);
  }

  /* ---------- Demo: align two views of the same genes (Bridge) ---------- */
  function setupBridgeDemo() {
    var host = document.querySelector('[data-demo="bridge"]');
    if (!host) return;

    // Seeded random numbers so the picture is the same on every visit
    var seed = 7;
    function rand() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    function gauss() { return (rand() + rand() + rand() - 1.5) / 1.5; }

    // Made-up genes in three "programs". Coordinates are in a 0..1 box.
    var centers = [[0.36, 0.38], [0.64, 0.36], [0.5, 0.66]];
    var genes = [];
    for (var i = 0; i < 54; i++) {
      var c = centers[i % 3];
      var shared = [c[0] + gauss() * 0.07, c[1] + gauss() * 0.07];
      genes.push({
        shared: shared,
        // Expression view: squashed into the left side
        a: [0.08 + shared[0] * 0.38 + gauss() * 0.05, 0.12 + (1 - shared[1]) * 0.7 + gauss() * 0.05],
        // CRISPR view: rotated and pushed right
        b: [0.56 + shared[1] * 0.38 + gauss() * 0.05, 0.12 + shared[0] * 0.7 + gauss() * 0.05]
      });
    }
    var middle = [0.5, 0.5];

    // ----- Build the widget -----
    host.innerHTML = '';
    var legend = el('p', { class: 'demo-legend' });
    legend.append(el('span', { class: 'is-filled' }, 'Expression view'), el('span', { class: 'is-ring' }, 'CRISPR view'));

    var canvasWrap = el('div', { class: 'bridge-canvas' });
    var canvas = el('canvas', { role: 'img', 'aria-label': 'Scatter plot of made-up genes in two views, moving into a shared space as training progresses' });
    canvasWrap.append(canvas);

    var controls = el('div', { class: 'demo-controls' });
    var rangeWrap = el('label', { class: 'demo-range' });
    var rangeText = el('span', null, 'Training progress');
    var range = el('input', { type: 'range', min: '0', max: '100', value: '0', step: '1' });
    rangeWrap.append(rangeText, range);
    var play = el('button', { class: 'btn', type: 'button' }, 'Play');
    var checkWrap = el('label', { class: 'demo-check' });
    var check = el('input', { type: 'checkbox', checked: '' });
    checkWrap.append(check, document.createTextNode('Keep diversity term'));
    controls.append(rangeWrap, play, checkWrap);

    var readout = el('dl', { class: 'demo-readout' });
    var gapBox = el('div'); var spreadBox = el('div');
    var gapVal = el('dd', null, '');
    var spreadVal = el('dd', null, '');
    gapBox.append(el('dt', null, 'Distance between matching pairs'), gapVal);
    spreadBox.append(el('dt', null, 'Spread between genes'), spreadVal);
    readout.append(gapBox, spreadBox);

    var status = el('p', { class: 'demo__status', 'aria-live': 'polite' }, '');

    host.append(legend, canvasWrap, controls, readout, status);

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0;

    function lerp(p, q, t) { return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; }
    function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

    // Where a gene's shared point ends up: with no diversity term the
    // whole space shrinks toward one point as training goes on.
    function target(g, t) {
      if (check.checked) return g.shared;
      return lerp(g.shared, middle, 0.94 * t);
    }

    function positions(t) {
      var e = ease(t);
      return genes.map(function (g) {
        var tgt = target(g, t);
        return { a: lerp(g.a, tgt, e), b: lerp(g.b, [tgt[0] + 0.006, tgt[1] + 0.006], e) };
      });
    }

    function stats(pos) {
      var gap = 0, mx = 0, my = 0;
      pos.forEach(function (p) {
        gap += Math.hypot(p.a[0] - p.b[0], p.a[1] - p.b[1]);
        mx += p.a[0]; my += p.a[1];
      });
      mx /= pos.length; my /= pos.length;
      var spread = 0;
      pos.forEach(function (p) { spread += Math.hypot(p.a[0] - mx, p.a[1] - my); });
      return { gap: gap / pos.length, spread: spread / pos.length };
    }

    var base = stats(positions(0));

    function draw(t) {
      var pos = positions(t);
      var ink = getComputedStyle(host).color;
      ctx.clearRect(0, 0, W, H);
      var pad = 12;
      function X(v) { return pad + v * (W - pad * 2); }
      function Y(v) { return pad + v * (H - pad * 2); }

      // Faint links between matching pairs while they travel
      ctx.globalAlpha = 0.18 * (1 - t) + 0.04;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      pos.forEach(function (p) { ctx.moveTo(X(p.a[0]), Y(p.a[1])); ctx.lineTo(X(p.b[0]), Y(p.b[1])); });
      ctx.stroke();

      ctx.globalAlpha = 1;
      var r = Math.max(3, Math.min(W, H) / 110);
      pos.forEach(function (p) {
        ctx.fillStyle = ink;
        ctx.beginPath(); ctx.arc(X(p.a[0]), Y(p.a[1]), r, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(X(p.b[0]), Y(p.b[1]), r + 1.5, 0, Math.PI * 2); ctx.stroke();
      });

      var s = stats(pos);
      var gapPct = Math.round(100 * s.gap / base.gap);
      var spreadPct = Math.round(100 * s.spread / base.spread);
      gapVal.textContent = gapPct + '% of start';
      spreadVal.textContent = spreadPct + '% of start';
      return { gapPct: gapPct, spreadPct: spreadPct };
    }

    var lastAnnounce = '';
    function update() {
      var t = range.value / 100;
      var s = draw(t);
      var msg;
      if (t === 0) msg = 'Before training: the two views sit apart.';
      else if (t < 1) msg = 'Training: matching pairs are moving together.';
      else if (check.checked) msg = 'Trained: pairs line up and the three gene groups stay distinct.';
      else msg = 'Collapsed: without the diversity term, every gene ends up in one spot.';
      if (msg !== lastAnnounce) { status.textContent = msg; lastAnnounce = msg; }
      range.setAttribute('aria-valuetext', range.value + '% trained, pairs at ' + s.gapPct + '% of starting distance');
    }

    function resize() {
      var rect = canvasWrap.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width; H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      update();
    }

    var playing = null;
    function stop() {
      if (playing) { playing.kill(); playing = null; }
      play.textContent = 'Play';
    }

    play.addEventListener('click', function () {
      if (playing) { stop(); return; }
      if (Number(range.value) >= 100) range.value = 0;
      if (!canAnimate()) { range.value = 100; update(); return; }
      var proxy = { v: Number(range.value) };
      play.textContent = 'Pause';
      playing = gsap.to(proxy, {
        v: 100,
        duration: 3.2 * (1 - proxy.v / 100),
        ease: 'none',
        onUpdate: function () { range.value = Math.round(proxy.v); update(); },
        onComplete: stop
      });
    });

    range.addEventListener('input', function () { stop(); update(); });
    check.addEventListener('change', update);

    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvasWrap);
    else window.addEventListener('resize', resize);
    resize();
  }

  /* ---------- Demo: find the green (Vegetation detection) ---------- */
  function setupVegetationDemo() {
    var host = document.querySelector('[data-demo="vegetation"]');
    if (!host) return;

    var GW = 192, GH = 128; // generated image size (scaled up for display)

    // Seeded value noise so the landscape is the same every visit
    function makeRand(seed) {
      return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    function makeNoise(seed, cells) {
      var r = makeRand(seed);
      var grid = [];
      for (var i = 0; i < (cells + 1) * (cells + 1); i++) grid.push(r());
      function at(x, y) { return grid[y * (cells + 1) + x]; }
      return function (u, v) { // u, v in 0..1
        var x = u * cells, y = v * cells;
        var x0 = Math.floor(x), y0 = Math.floor(y);
        var fx = x - x0, fy = y - y0;
        fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
        var x1 = Math.min(x0 + 1, cells), y1 = Math.min(y0 + 1, cells);
        var a = at(x0, y0) + (at(x1, y0) - at(x0, y0)) * fx;
        var b = at(x0, y1) + (at(x1, y1) - at(x0, y1)) * fx;
        return a + (b - a) * fy;
      };
    }
    var nBig = makeNoise(11, 5), nMid = makeNoise(23, 12), nFine = makeNoise(37, 40);

    // Cleared area in the later image (a soft-edged blob)
    function inClearing(u, v) {
      var dx = (u - 0.68) / 0.2, dy = (v - 0.36) / 0.24;
      return dx * dx + dy * dy + (nMid(u, v) - 0.5) * 0.9 < 1;
    }

    function build(later) {
      var px = new Uint8ClampedArray(GW * GH * 4);
      var jitter = makeRand(5); // same grain in both images
      for (var y = 0; y < GH; y++) {
        for (var x = 0; x < GW; x++) {
          var u = x / GW, v = y / GH;
          var h = nBig(u, v) * 0.6 + nMid(u, v) * 0.3 + nFine(u, v) * 0.1;
          var river = Math.abs(v - (0.72 + Math.sin(u * 7) * 0.08)) < 0.035 + nFine(u, v) * 0.012;
          var town = u < 0.26 && v < 0.42 + nMid(u, v) * 0.08;
          var R, G, B;
          if (river) { R = 32; G = 52; B = 68; }
          else if (town) {
            var g = 108 + nFine((u * 3) % 1, (v * 3) % 1) * 50;
            var block = ((x >> 3) + (y >> 3)) % 3 === 0;
            R = g; G = g - 4; B = g - 2 + (block ? 10 : 0);
          } else if (later && inClearing(u, v)) {
            R = 146 + nFine(u, v) * 30; G = 112 + nFine(u, v) * 20; B = 80;
          } else if (h > 0.5) { // forest and dense growth
            R = 44 + (1 - h) * 36; G = 78 + h * 44; B = 46 + h * 8;
          } else if (h > 0.36) { // fields and dry grass
            R = 98 + (0.5 - h) * 240; G = 104 + h * 26; B = 64;
          } else { // bare soil
            R = 140 + h * 40; G = 116 + h * 20; B = 84;
          }
          var j = (jitter() - 0.5) * 18;
          var i4 = (y * GW + x) * 4;
          px[i4] = R + j; px[i4 + 1] = G + j; px[i4 + 2] = B + j; px[i4 + 3] = 255;
        }
      }
      return px;
    }

    // Excess-green index: how much greener a pixel is than red and blue
    function greenness(px, i4) {
      var r = px[i4], g = px[i4 + 1], b = px[i4 + 2];
      return (2 * g - r - b) / (r + g + b + 1);
    }

    var images = { earlier: build(false), later: build(true) };

    // ----- Build the widget -----
    host.innerHTML = '';
    var top = el('div', { class: 'demo__bar' });
    var whenSwitch = el('div', { class: 'demo-switch', role: 'group', 'aria-label': 'Image date' });
    var bEarlier = el('button', { type: 'button', 'aria-pressed': 'true' }, 'Earlier image');
    var bLater = el('button', { type: 'button', 'aria-pressed': 'false' }, 'Later image');
    whenSwitch.append(bEarlier, bLater);
    var viewSwitch = el('div', { class: 'demo-switch', role: 'group', 'aria-label': 'View' });
    var bPhoto = el('button', { type: 'button', 'aria-pressed': 'true' }, 'Image');
    var bMap = el('button', { type: 'button', 'aria-pressed': 'false' }, 'Vegetation map');
    viewSwitch.append(bPhoto, bMap);
    top.append(whenSwitch, viewSwitch);

    var wrap = el('div', { class: 'veg-canvas' });
    var canvas = el('canvas', { role: 'img', 'aria-label': 'Generated aerial landscape with a town, a river, fields and forest' });
    wrap.append(canvas);

    var rangeWrap = el('label', { class: 'demo-range' });
    var rangeText = el('span', null, 'Greenness threshold');
    var range = el('input', { type: 'range', min: '0', max: '40', value: '14', step: '1' });
    rangeWrap.append(rangeText, range);

    var readout = el('dl', { class: 'demo-readout' });
    var coverBox = el('div'), changeBox = el('div');
    var coverVal = el('dd'), changeVal = el('dd');
    coverBox.append(el('dt', null, 'Counted as vegetation'), coverVal);
    changeBox.append(el('dt', null, 'Change from earlier image'), changeVal);
    readout.append(coverBox, changeBox);

    var status = el('p', { class: 'demo__status', 'aria-live': 'polite' }, '');
    host.append(top, wrap, rangeWrap, readout, status);

    var off = el('canvas');
    off.width = GW; off.height = GH;
    var offCtx = off.getContext('2d');
    var ctx = canvas.getContext('2d');
    var state = { when: 'earlier', view: 'photo' };

    function coverage(px, thr) {
      var n = 0;
      for (var i = 0; i < GW * GH; i++) if (greenness(px, i * 4) > thr) n++;
      return n / (GW * GH);
    }

    function render() {
      var thr = range.value / 100;
      var px = images[state.when];
      var out = offCtx.createImageData(GW, GH);
      if (state.view === 'photo') {
        out.data.set(px);
      } else {
        for (var i = 0; i < GW * GH; i++) {
          var veg = greenness(px, i * 4) > thr;
          var c = veg ? [236, 230, 218] : [24, 26, 22];
          out.data[i * 4] = c[0]; out.data[i * 4 + 1] = c[1]; out.data[i * 4 + 2] = c[2]; out.data[i * 4 + 3] = 255;
        }
      }
      offCtx.putImageData(out, 0, 0);

      var w = canvas.width, h = canvas.height;
      ctx.imageSmoothingEnabled = state.view === 'photo';
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(off, 0, 0, w, h);

      var nowCover = coverage(px, thr);
      var before = coverage(images.earlier, thr);
      coverVal.textContent = Math.round(nowCover * 100) + '% of pixels';
      if (state.when === 'earlier') changeVal.textContent = 'Pick the later image';
      else {
        var diff = Math.round((nowCover - before) * 100);
        changeVal.textContent = (diff > 0 ? '+' : diff < 0 ? '−' : '') + Math.abs(diff) + ' points';
      }
      range.setAttribute('aria-valuetext', 'Threshold ' + thr.toFixed(2) + ', ' + Math.round(nowCover * 100) + '% counted as vegetation');
    }

    function announce(msg) { status.textContent = msg; }

    function setPressed(a, b, aOn) {
      a.setAttribute('aria-pressed', aOn ? 'true' : 'false');
      b.setAttribute('aria-pressed', aOn ? 'false' : 'true');
    }

    function crossfade(change) {
      if (canAnimate()) {
        gsap.timeline()
          .to(canvas, { opacity: 0.2, duration: 0.15, ease: 'power1.in' })
          .add(change)
          .to(canvas, { opacity: 1, duration: 0.3, ease: 'power2.out' });
      } else change();
    }

    bEarlier.addEventListener('click', function () {
      if (state.when === 'earlier') return;
      setPressed(bEarlier, bLater, true);
      crossfade(function () { state.when = 'earlier'; render(); announce('Showing the earlier image.'); });
    });
    bLater.addEventListener('click', function () {
      if (state.when === 'later') return;
      setPressed(bEarlier, bLater, false);
      crossfade(function () { state.when = 'later'; render(); announce('Showing the later image. Part of the forest in the upper right has been cleared.'); });
    });
    bPhoto.addEventListener('click', function () {
      setPressed(bPhoto, bMap, true);
      crossfade(function () { state.view = 'photo'; render(); announce('Image view.'); });
    });
    bMap.addEventListener('click', function () {
      setPressed(bPhoto, bMap, false);
      crossfade(function () { state.view = 'map'; render(); announce('Vegetation map: light pixels pass the threshold.'); });
    });
    range.addEventListener('input', render);

    function resize() {
      var rect = wrap.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      render();
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
    else window.addEventListener('resize', resize);
    resize();
  }

  /* ---------- Demo: read a prediction (Skin disease detection) ---------- */
  function setupSkinDemo() {
    var host = document.querySelector('[data-demo="skin"]');
    if (!host) return;

    var THRESHOLD = 0.5; // this demo's cut-off for the low-confidence warning
    var SAMPLES = [
      { name: 'Sample 1', top: [['Condition A', 0.86], ['Condition B', 0.08], ['Condition C', 0.03]] },
      { name: 'Sample 2', top: [['Condition D', 0.61], ['Condition B', 0.27], ['Condition E', 0.06]] },
      { name: 'Sample 3', top: [['Condition F', 0.34], ['Condition C', 0.29], ['Condition A', 0.18]] }
    ];
    var GUIDE_AI = {
      sure: 'Keep an eye on changes in size, colour or discomfort. If it spreads, bleeds or lasts more than a couple of weeks, see a doctor.',
      unsure: 'The model is not sure, so the label is not worth relying on. A doctor can examine it properly.'
    };
    var GUIDE_FALLBACK = 'This is general advice, not a diagnosis. If you are worried about a skin change, see a doctor or dermatologist.';

    // ----- Build the widget -----
    host.innerHTML = '';
    var row = el('div', { class: 'sample-row', role: 'group', 'aria-label': 'Samples' });
    var sampleButtons = SAMPLES.map(function (s, i) {
      var b = el('button', { class: 'sample', type: 'button', 'aria-pressed': i === 0 ? 'true' : 'false' });
      b.append(el('span', { class: 'sample__swatch sample__swatch--' + (i + 1), 'aria-hidden': 'true' }), el('span', null, s.name));
      row.append(b);
      return b;
    });

    var result = el('div', { class: 'demo-guidance', 'aria-live': 'polite' });
    var heading = el('p', null, '');
    var list = el('ol', { class: 'pred' });
    var warning = el('p', { class: 'demo-warning', hidden: '' }, '');
    var guideSource = el('p', { class: 'demo-guidance__source' }, '');
    var guideText = el('p', null, '');
    result.append(heading, list, warning, guideSource, guideText);

    var checkWrap = el('label', { class: 'demo-check' });
    var aiOn = el('input', { type: 'checkbox', checked: '' });
    checkWrap.append(aiOn, document.createTextNode('Language model available'));

    host.append(row, checkWrap, result);

    var current = 0;
    function render(animate) {
      var s = SAMPLES[current];
      var best = s.top[0][1];
      var sure = best >= THRESHOLD;
      heading.textContent = s.name + ': top three classes';
      list.innerHTML = '';
      var fills = [];
      s.top.forEach(function (p) {
        var li = el('li');
        var track = el('span', { class: 'demo-bars__track', 'aria-hidden': 'true' });
        var fill = el('span', { class: 'demo-bars__fill' });
        fill.style.transform = 'scaleX(' + p[1] + ')';
        track.append(fill);
        li.append(el('span', null, p[0]), track, el('span', { class: 'num' }, Math.round(p[1] * 100) + '%'));
        list.append(li);
        fills.push({ fill: fill, v: p[1] });
      });

      if (sure) { warning.hidden = true; }
      else {
        warning.hidden = false;
        warning.textContent = 'Low confidence: the top class is under ' + Math.round(THRESHOLD * 100) + '%. Treat this result with caution.';
      }

      if (aiOn.checked) {
        guideSource.textContent = 'Guidance written by the language model (mock text)';
        guideText.textContent = sure ? GUIDE_AI.sure : GUIDE_AI.unsure;
      } else {
        guideSource.textContent = 'Language model unavailable. Showing built-in fallback guidance';
        guideText.textContent = GUIDE_FALLBACK;
      }

      if (animate && canAnimate()) {
        gsap.fromTo(fills.map(function (f) { return f.fill; }), { scaleX: 0 },
          { scaleX: function (i) { return fills[i].v; }, duration: 0.55, stagger: 0.07, ease: 'power3.out' });
        gsap.from([warning, guideText], { opacity: 0, y: 6, duration: 0.35, delay: 0.2, ease: 'power2.out' });
      }
    }

    row.addEventListener('click', function (e) {
      var b = e.target.closest('.sample');
      if (!b) return;
      current = sampleButtons.indexOf(b);
      sampleButtons.forEach(function (x, j) { x.setAttribute('aria-pressed', j === current ? 'true' : 'false'); });
      render(true);
    });
    aiOn.addEventListener('change', function () { render(false); });

    render(false);
  }

  /* ---------- Demo: walk the journey (Farmer onboarding) ---------- */
  function setupJourneyDemo() {
    var host = document.querySelector('[data-demo="journey"]');
    if (!host) return;

    var STAGES = [
      { name: 'Awareness',
        current: { feel: 'Curious', note: 'Hears about the service from an agent or a flyer', v: 100 },
        redesign: { feel: 'Interested', note: 'Agent shows a success story from a nearby farmer', v: 100 } },
      { name: 'Registration',
        current: { feel: 'Confused', note: 'A long form with many fields', v: 52 },
        redesign: { feel: 'Confident', note: 'Icon-based Bangla screens, name and phone only, agent on hand', v: 92 } },
      { name: 'OTP check',
        current: { feel: 'Frustrated', note: 'An SMS code with unclear instructions', v: 38 },
        redesign: { feel: 'Reassured', note: 'Clear visuals and an easy retry', v: 85 } },
      { name: 'First value',
        current: { feel: 'Lost', note: 'Unclear what to do next', v: 35 },
        redesign: { feel: 'Delighted', note: 'Weather and crop prices shown straight away', v: 80 } }
    ];
    var LABEL = { current: 'assumed', redesign: 'target' };

    host.innerHTML = '';
    var sw = el('div', { class: 'demo-switch', role: 'group', 'aria-label': 'Journey version' });
    var bCur = el('button', { type: 'button', 'aria-pressed': 'true' }, 'Current journey');
    var bNew = el('button', { type: 'button', 'aria-pressed': 'false' }, 'Redesigned journey');
    sw.append(bCur, bNew);

    var list = el('ol', { class: 'journey' });
    var cells = STAGES.map(function (s) {
      var li = el('li', { class: 'journey__step' });
      var name = el('p', { class: 'journey__name' }, s.name);
      var feel = el('p', { class: 'journey__feel' });
      var note = el('p', { class: 'journey__note' });
      var meter = el('div', { class: 'journey__meter' });
      var num = el('span', { class: 'num' });
      var track = el('span', { class: 'demo-bars__track', 'aria-hidden': 'true' });
      var fill = el('span', { class: 'demo-bars__fill' });
      track.append(fill);
      meter.append(num, track);
      li.append(name, feel, note, meter);
      list.append(li);
      return { feel: feel, note: note, num: num, fill: fill };
    });

    var status = el('p', { class: 'demo__status', 'aria-live': 'polite' });
    host.append(sw, list, status);

    var mode = 'current';
    function render(animate) {
      STAGES.forEach(function (s, i) {
        var d = s[mode];
        var c = cells[i];
        c.feel.textContent = d.feel;
        c.note.textContent = d.note;
        c.num.textContent = d.v + '% still here (' + LABEL[mode] + ')';
        if (animate && canAnimate()) {
          gsap.to(c.fill, { scaleX: d.v / 100, duration: 0.6, delay: i * 0.06, ease: 'power3.out' });
          gsap.fromTo([c.feel, c.note], { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.35, delay: i * 0.06, ease: 'power2.out' });
        } else {
          c.fill.style.transform = 'scaleX(' + d.v / 100 + ')';
        }
      });
      var last = STAGES[STAGES.length - 1][mode].v;
      status.textContent = mode === 'current'
        ? 'Current journey: ' + last + '% of farmers who start reach first value (working assumption).'
        : 'Redesigned journey: ' + last + '% of farmers who start reach first value (target).';
    }

    function setMode(m) {
      if (m === mode) return;
      mode = m;
      bCur.setAttribute('aria-pressed', m === 'current' ? 'true' : 'false');
      bNew.setAttribute('aria-pressed', m === 'redesign' ? 'true' : 'false');
      render(true);
    }
    bCur.addEventListener('click', function () { setMode('current'); });
    bNew.addEventListener('click', function () { setMode('redesign'); });

    render(false);
  }

  /* ---------- Demo: hold a seat (Wonderland Cinemas) ---------- */
  function setupCinemaDemo() {
    var host = document.querySelector('[data-demo="cinema"]');
    if (!host) return;

    var ROWS = 'ABCDEF'.split('');
    var COLS = 10;
    var HOLD_SECONDS = 300;            // five minutes, like the real locks
    var BOOKED = ['A3', 'A4', 'B6', 'C1', 'C2', 'D7', 'D8', 'E5', 'F9', 'F10'];

    var seats = {};                    // id -> { state: free | mine | held | booked, btn }
    var holdEnds = null;               // timestamp when my hold expires
    var tick = null, others = null;

    // ----- Build the widget -----
    host.innerHTML = '';
    var screen = el('div');
    screen.append(el('div', { class: 'screen-line', 'aria-hidden': 'true' }), el('p', { class: 'screen-label' }, 'Screen'));

    var grid = el('div', { class: 'seats', role: 'group', 'aria-label': 'Seat map, Hall 2, 7:00 pm (mock)' });
    ROWS.forEach(function (r) {
      grid.append(el('span', { class: 'seats__row', 'aria-hidden': 'true' }, r));
      for (var c = 1; c <= COLS; c++) {
        var id = r + c;
        var btn = el('button', { class: 'seat', type: 'button', 'data-seat': id });
        grid.append(btn);
        seats[id] = { state: 'free', btn: btn };
      }
    });

    var legend = el('p', { class: 'seat-legend' });
    [['', 'Available'], ['k-mine', 'Held by you'], ['k-held', 'Held by someone else'], ['k-booked', 'Booked']].forEach(function (k) {
      var s = el('span'); s.append(el('i', { class: k[0], 'aria-hidden': 'true' }), document.createTextNode(k[1])); legend.append(s);
    });

    var bar = el('div', { class: 'hold-bar' });
    var timerWrap = el('div');
    var timer = el('p', { class: 'hold-bar__timer', 'aria-hidden': 'true' }, '5:00');
    var summary = el('p', null, 'No seats held');
    timerWrap.append(timer, summary);
    var actions = el('div', { class: 'hold-bar__actions' });
    var payBtn = el('button', { class: 'btn', type: 'button', disabled: '' }, 'Pay (test)');
    var skipBtn = el('button', { class: 'btn btn--quiet', type: 'button', disabled: '' }, 'Skip ahead 4 min');
    var rivalBtn = el('button', { class: 'btn btn--quiet', type: 'button', disabled: '' }, 'Another customer tries my seat');
    var resetBtn = el('button', { class: 'btn btn--quiet', type: 'button' }, 'Reset');
    actions.append(payBtn, skipBtn, rivalBtn, resetBtn);
    bar.append(timerWrap, actions);

    var status = el('p', { class: 'demo__status', 'aria-live': 'polite' }, 'Pick any available seat to hold it.');
    host.append(screen, grid, legend, bar, status);

    // ----- Helpers -----
    function label(id, state) {
      var words = { free: 'available', mine: 'held by you', held: 'held by someone else', booked: 'booked' };
      return 'Row ' + id[0] + ' seat ' + id.slice(1) + ', ' + words[state];
    }

    function setState(id, state) {
      var s = seats[id];
      s.state = state;
      s.btn.className = 'seat' + (state === 'mine' ? ' is-mine' : state === 'held' ? ' is-held' : state === 'booked' ? ' is-booked' : '');
      s.btn.disabled = state === 'booked';
      s.btn.setAttribute('aria-pressed', state === 'mine' ? 'true' : 'false');
      s.btn.setAttribute('aria-label', label(id, state));
    }

    function mine() { return Object.keys(seats).filter(function (id) { return seats[id].state === 'mine'; }); }

    function fmt(sec) {
      sec = Math.max(0, Math.ceil(sec));
      return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    }

    function refreshBar() {
      var m = mine();
      payBtn.disabled = skipBtn.disabled = rivalBtn.disabled = m.length === 0;
      if (!m.length) {
        timer.textContent = '5:00';
        summary.textContent = 'No seats held';
      } else {
        summary.textContent = m.length + (m.length === 1 ? ' seat' : ' seats') + ' held: ' + m.join(', ');
      }
    }

    function pulse(btn) {
      if (canAnimate()) gsap.fromTo(btn, { scale: 0.85 }, { scale: 1, duration: 0.35, ease: 'back.out(2.5)', clearProps: 'transform' });
    }

    // ----- My hold -----
    function startHold() {
      if (holdEnds) return;
      holdEnds = Date.now() + HOLD_SECONDS * 1000;
      tick = setInterval(updateTimer, 500);
      updateTimer();
    }

    function stopHold() {
      holdEnds = null;
      clearInterval(tick);
      tick = null;
    }

    function updateTimer() {
      if (!holdEnds) return;
      var left = (holdEnds - Date.now()) / 1000;
      timer.textContent = fmt(left);
      if (left <= 0) {
        mine().forEach(function (id) { setState(id, 'free'); });
        stopHold();
        refreshBar();
        status.textContent = 'Your hold expired after five minutes, so the seats were released for everyone else.';
      }
    }

    grid.addEventListener('click', function (e) {
      var btn = e.target.closest('.seat');
      if (!btn || btn.disabled) return;
      var id = btn.getAttribute('data-seat');
      var s = seats[id];
      if (s.state === 'held') {
        status.textContent = 'Seat ' + id + ' is locked by another customer right now. Try another seat.';
        return;
      }
      if (s.state === 'mine') {
        setState(id, 'free');
        status.textContent = 'Seat ' + id + ' released. Its lock is removed so others can pick it.';
        if (!mine().length) stopHold();
      } else {
        if (mine().length >= 6) { status.textContent = 'This demo holds up to six seats at once.'; return; }
        setState(id, 'mine');
        startHold();
        pulse(btn);
        status.textContent = 'Seat ' + id + ' is held for you. Other customers now see it as taken.';
      }
      refreshBar();
    });

    payBtn.addEventListener('click', function () {
      var m = mine();
      if (!m.length) return;
      stopHold();
      status.textContent = 'Checking every lock is still yours…';
      payBtn.disabled = skipBtn.disabled = rivalBtn.disabled = true;
      setTimeout(function () {
        m.forEach(function (id) { setState(id, 'booked'); pulse(seats[id].btn); });
        refreshBar();
        timer.textContent = 'Booked';
        status.textContent = 'Payment confirmed (test). All locks were still yours, so ' + (m.length === 1 ? 'seat ' + m[0] + ' is' : 'seats ' + m.join(', ') + ' are') + ' now booked.';
      }, 700);
    });

    skipBtn.addEventListener('click', function () {
      if (!holdEnds) return;
      holdEnds -= 240 * 1000;
      updateTimer();
      if (holdEnds) status.textContent = 'Four minutes later. The hold ends at zero unless you pay.';
    });

    rivalBtn.addEventListener('click', function () {
      var m = mine();
      if (!m.length) return;
      var id = m[0];
      if (canAnimate()) gsap.fromTo(seats[id].btn, { x: -3 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)', clearProps: 'transform' });
      status.textContent = 'Another customer tried to lock seat ' + id + '. The lock already belongs to you, so their request was refused.';
    });

    // ----- Other customers holding and releasing seats -----
    function otherCustomers() {
      var free = Object.keys(seats).filter(function (id) { return seats[id].state === 'free'; });
      if (!free.length) return;
      var id = free[Math.floor(Math.random() * free.length)];
      setState(id, 'held');
      setTimeout(function () { if (seats[id].state === 'held') setState(id, 'free'); }, 6000 + Math.random() * 5000);
    }

    function startOthers() { if (!others) others = setInterval(otherCustomers, 2600); }
    function stopOthers() { clearInterval(others); others = null; }

    function reset() {
      stopHold();
      Object.keys(seats).forEach(function (id) { setState(id, BOOKED.indexOf(id) > -1 ? 'booked' : 'free'); });
      ['B2', 'E8'].forEach(function (id) { setState(id, 'held'); });
      refreshBar();
      status.textContent = 'Pick any available seat to hold it.';
    }
    resetBtn.addEventListener('click', reset);

    reset();

    // Only simulate other customers while the demo is on screen
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) startOthers(); else stopOthers(); });
      }).observe(host);
    } else startOthers();
  }

  /* ---------- Demo: take the skin quiz (Elara Botanics) ---------- */
  function setupElaraDemo() {
    var host = document.querySelector('[data-demo="elara"]');
    if (!host) return;

    // Fictional products and quiz rules, taken from the project's own data
    var PRODUCTS = {
      'cleanser-oat-milk': { name: 'Oat Milk Gentle Cleanser', price: 18.5, ff: true },
      'cleanser-clarifying-gel': { name: 'Willow Bark Clarifying Gel', price: 22, ff: false },
      'serum-hydration-boost': { name: 'Hyaluronic Dew Drops', price: 34, ff: true },
      'serum-brightening-c': { name: 'Kakadu Plum Vitamin C Serum', price: 38, ff: false },
      'serum-calming-barrier': { name: 'Centella Rescue Drops', price: 32, ff: true },
      'moisturiser-daily-light': { name: 'Cloudberry Light Lotion', price: 28, ff: false },
      'moisturiser-rich-repair': { name: 'Macadamia Night Cream', price: 36, ff: false },
      'moisturiser-peptide-firm': { name: 'Algae & Peptide Firming Cream', price: 42, ff: false },
      'mask-clay-purify': { name: 'Matcha & Bentonite Purifying Mask', price: 24, ff: true },
      'treatment-spot-clear': { name: 'Zinc & Tea Tree Blemish Paste', price: 16, ff: false }
    };
    var QUESTIONS = [
      { id: 'skin_type', q: 'How would you describe your skin?',
        options: [['Dry', 'dry'], ['Oily', 'oily'], ['Combination', 'combination'], ['Sensitive', 'sensitive'], ['Normal', 'normal']] },
      { id: 'main_concern', q: "What's your main concern?",
        options: [['Dehydration', 'dehydration'], ['Breakouts', 'breakouts'], ['Redness', 'redness'], ['Dullness', 'dullness'], ['Fine lines', 'fine_lines']] },
      { id: 'fragrance', q: 'Do you prefer fragrance-free products?',
        options: [['Yes', 'yes'], ['No preference', 'no']] }
    ];
    var ROUTINES = {
      'Calm & Soothe': ['cleanser-oat-milk', 'serum-calming-barrier', 'moisturiser-rich-repair'],
      'Balance & Clarify': ['cleanser-clarifying-gel', 'treatment-spot-clear', 'moisturiser-daily-light', 'mask-clay-purify'],
      'Hydrate & Glow': ['cleanser-oat-milk', 'serum-hydration-boost', 'serum-brightening-c', 'moisturiser-peptide-firm']
    };

    // Same scoring as the project's quiz.js
    function scoreQuiz(a) {
      var s = { 'Calm & Soothe': 0, 'Balance & Clarify': 0, 'Hydrate & Glow': 0 };
      if (a.skin_type === 'sensitive' || a.skin_type === 'dry') s['Calm & Soothe'] += 2;
      if (a.skin_type === 'oily' || a.skin_type === 'combination') s['Balance & Clarify'] += 2;
      if (a.skin_type === 'normal') s['Hydrate & Glow'] += 1;
      if (a.main_concern === 'redness') s['Calm & Soothe'] += 3;
      if (a.main_concern === 'breakouts') s['Balance & Clarify'] += 3;
      if (a.main_concern === 'dehydration' || a.main_concern === 'dullness') s['Hydrate & Glow'] += 3;
      if (a.main_concern === 'fine_lines') { s['Hydrate & Glow'] += 2; s['Calm & Soothe'] += 1; }
      var best = 'Hydrate & Glow', high = -1;
      Object.keys(s).forEach(function (k) { if (s[k] > high) { high = s[k]; best = k; } });
      return { routine: best, products: ROUTINES[best], fragranceFree: a.fragrance === 'yes' };
    }

    var gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
    var step = 0, answers = {}, result = null;

    var body = el('div', { class: 'quiz', 'aria-live': 'polite' });
    host.innerHTML = '';
    host.append(body);

    function fadeIn(node) {
      if (canAnimate()) gsap.from(node.children, { opacity: 0, y: 10, duration: 0.35, stagger: 0.05, ease: 'power2.out' });
    }

    function renderQuestion() {
      var q = QUESTIONS[step];
      body.innerHTML = '';
      var wrap = el('div', { class: 'quiz__result' });
      var prog = el('p', { class: 'quiz__progress' });
      prog.append(el('span', null, 'Question ' + (step + 1) + ' of ' + QUESTIONS.length));
      if (step > 0) {
        var back = el('button', { class: 'btn btn--quiet', type: 'button' }, 'Back');
        back.addEventListener('click', function () { step--; renderQuestion(); });
        prog.append(back);
      }
      var title = el('p', { class: 'quiz__question', id: 'elara-q' }, q.q);
      var opts = el('div', { class: 'quiz__options', role: 'group', 'aria-labelledby': 'elara-q' });
      q.options.forEach(function (o) {
        var b = el('button', { class: 'btn', type: 'button' }, o[0]);
        if (answers[q.id] === o[1]) b.setAttribute('aria-pressed', 'true');
        b.addEventListener('click', function () {
          answers[q.id] = o[1];
          step++;
          if (step < QUESTIONS.length) renderQuestion(); else renderResult();
        });
        opts.append(b);
      });
      wrap.append(prog, title, opts);
      body.append(wrap);
      fadeIn(wrap);
      var first = opts.querySelector('button');
      if (first && host.contains(document.activeElement)) first.focus();
    }

    function renderResult() {
      result = scoreQuiz(answers);
      body.innerHTML = '';
      var wrap = el('div', { class: 'quiz__result' });
      wrap.append(el('p', { class: 'quiz__progress' }, 'Your routine'));
      wrap.append(el('p', { class: 'quiz__question' }, result.routine));

      var list = el('ul', { class: 'products' });
      var subtotal = 0;
      result.products.forEach(function (id) {
        var p = PRODUCTS[id];
        subtotal += p.price;
        var li = el('li');
        li.append(el('span', null, p.name), el('span', { class: 'num' }, gbp.format(p.price)));
        var meta = result.fragranceFree
          ? (p.ff ? 'Fragrance-free' : 'Not fragrance-free')
          : (p.ff ? 'Fragrance-free' : '');
        if (meta) li.append(el('span', { class: 'meta' }, meta));
        list.append(li);
      });
      wrap.append(list);

      var cartLine = el('div', { class: 'cart-line' });
      var cartText = el('p', null, 'Cart is empty');
      var add = el('button', { class: 'btn', type: 'button' }, 'Add routine to cart');
      var again = el('button', { class: 'btn btn--quiet', type: 'button' }, 'Retake quiz');
      var btns = el('div', { class: 'quiz__options' });
      btns.append(add, again);
      cartLine.append(cartText, btns);
      wrap.append(cartLine);

      add.addEventListener('click', function () {
        // Shipping rule from the project's checkout: free over £50, else £5
        var shipping = subtotal > 50 ? 0 : 5;
        cartText.textContent = result.products.length + ' items, ' + gbp.format(subtotal) +
          (shipping ? ' + ' + gbp.format(shipping) + ' shipping' : ', free shipping') +
          ' = ' + gbp.format(subtotal + shipping);
        add.disabled = true;
        add.textContent = 'Added';
      });
      again.addEventListener('click', function () { step = 0; answers = {}; renderQuestion(); });

      body.append(wrap);
      fadeIn(wrap);
    }

    renderQuestion();
  }

  /* ---------- Demo: from cart to invoice (Django e-commerce) ---------- */
  function setupDjangoDemo() {
    var host = document.querySelector('[data-demo="django"]');
    if (!host) return;

    var PRODUCTS = [
      { id: 'tee', name: 'Cotton T-shirt', cat: 'Men, T-shirts', price: 650, sizes: ['S', 'M', 'L', 'XL'] },
      { id: 'sneaker', name: 'Canvas Sneakers', cat: 'Women, Shoes', price: 2400, sizes: ['36', '37', '38', '39', '40'] },
      { id: 'jacket', name: 'Denim Jacket', cat: 'Men, Jackets', price: 3200, sizes: ['M', 'L', 'XL'] },
      { id: 'kids', name: 'Kids Rain Boots', cat: 'Girls, Shoes', price: 1100, sizes: ['28', '30', '32'] }
    ];
    var taka = function (n) { return 'BDT ' + n.toLocaleString('en-IN'); };
    var cart = []; // { key, name, size, qty, unit }

    host.innerHTML = '';
    var list = el('ul', { class: 'shop-list', 'aria-label': 'Products (mock)' });
    PRODUCTS.forEach(function (p) {
      var li = el('li', { class: 'shop-item' });
      var info = el('div');
      info.append(el('span', null, p.name), el('span', { class: 'meta' }, p.cat + ', ' + taka(p.price)));
      var sel = el('select', { class: 'demo-select', 'aria-label': 'Size for ' + p.name });
      p.sizes.forEach(function (s) { sel.append(el('option', { value: s }, s)); });
      var add = el('button', { class: 'btn', type: 'button' }, 'Add');
      add.addEventListener('click', function () { addToCart(p, sel.value); });
      li.append(info, sel, add);
      list.append(li);
    });

    var cartBox = el('div', { class: 'demo-guidance' });
    var cartTitle = el('p', null, 'Cart');
    var cartTable = el('table', { class: 'demo-table' });
    var cartFoot = el('div', { class: 'cart-line' });
    var cartTotal = el('p', null, '');
    var gen = el('button', { class: 'btn', type: 'button', disabled: '' }, 'Generate invoice');
    var clear = el('button', { class: 'btn btn--quiet', type: 'button', disabled: '' }, 'Empty cart');
    var btns = el('div', { class: 'quiz__options' });
    btns.append(gen, clear);
    cartFoot.append(cartTotal, btns);
    cartBox.append(cartTitle, cartTable, cartFoot);

    var invoiceWrap = el('div', { 'aria-live': 'polite' });
    host.append(list, cartBox, invoiceWrap);

    function total() { return cart.reduce(function (t, i) { return t + i.qty * i.unit; }, 0); }

    function renderCart() {
      cartTable.innerHTML = '';
      if (!cart.length) {
        cartTable.innerHTML = '<tbody><tr><td>Your cart is empty. Add something above.</td></tr></tbody>';
      } else {
        cartTable.innerHTML = '<thead><tr><th scope="col">Item</th><th scope="col">Size</th><th class="num" scope="col">Qty</th><th class="num" scope="col">Price</th></tr></thead>';
        var tb = el('tbody');
        cart.forEach(function (i) {
          var tr = el('tr');
          tr.append(el('td', null, i.name), el('td', null, i.size), el('td', { class: 'num' }, String(i.qty)), el('td', { class: 'num' }, taka(i.qty * i.unit)));
          tb.append(tr);
        });
        cartTable.append(tb);
      }
      cartTotal.textContent = cart.length ? 'Total ' + taka(total()) : '';
      gen.disabled = clear.disabled = !cart.length;
    }

    function addToCart(p, size) {
      var key = p.id + '|' + size; // each size is its own line, like the real cart
      var line = cart.filter(function (i) { return i.key === key; })[0];
      if (line) line.qty++;
      else cart.push({ key: key, name: p.name, size: size, qty: 1, unit: p.price });
      invoiceWrap.innerHTML = '';
      renderCart();
      var rows = cartTable.querySelectorAll('tbody tr');
      if (canAnimate() && rows.length) gsap.from(rows[rows.length - 1], { opacity: 0, x: -8, duration: 0.3, ease: 'power2.out' });
    }

    gen.addEventListener('click', function () {
      invoiceWrap.innerHTML = '';
      var inv = el('div', { class: 'invoice' });
      inv.append(el('h5', null, 'Invoice'), el('p', null, 'Order summary'), el('p', null, 'Customer name: demo_user'));
      var t = el('table', { class: 'demo-table' });
      t.innerHTML = '<thead><tr><th scope="col">Product</th><th class="num" scope="col">Quantity</th><th class="num" scope="col">Price (BDT)</th></tr></thead>';
      var tb = el('tbody');
      cart.forEach(function (i) {
        var tr = el('tr');
        tr.append(el('td', null, i.name + ' (' + i.size + ')'), el('td', { class: 'num' }, String(i.qty)), el('td', { class: 'num' }, (i.qty * i.unit).toLocaleString('en-IN')));
        tb.append(tr);
      });
      t.append(tb);
      inv.append(t, el('p', { class: 'invoice__total' }, 'Total price: ' + taka(total())));
      invoiceWrap.append(inv);
      if (canAnimate()) gsap.from(inv, { opacity: 0, y: 16, scale: 0.98, duration: 0.45, ease: 'power3.out' });
    });

    clear.addEventListener('click', function () { cart = []; invoiceWrap.innerHTML = ''; renderCart(); });

    renderCart();
  }

  /* ---------- Start ---------- */
  setupDjangoDemo();
  setupElaraDemo();
  setupReportDemo();
  setupBridgeDemo();
  setupVegetationDemo();
  setupSkinDemo();
  setupJourneyDemo();
  setupCinemaDemo();
  setupMenu();
  setupAnchors();

  if (!window.gsap || !window.ScrollTrigger) {
    // Libraries failed to load: keep the page fully readable and static
    root.classList.add('no-anim');
    var pre = document.querySelector('.preloader');
    if (pre) pre.remove();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(SplitText);
  gsap.defaults({ duration: MOTION.section, ease: MOTION.ease });

  runPreloader(prefersReducedMotion()).then(initMotion);
})();
