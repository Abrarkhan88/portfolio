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

  /* ---------- Start ---------- */
  setupReportDemo();
  setupBridgeDemo();
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
