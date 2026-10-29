/* =========================================================
   Abrar Sami Khan, portfolio
   main.js: preloader, smooth scroll, scroll sync, reveals,
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

      setupActiveNav();

      if (!c.reduce) setupReveals(c.isDesktop);

      if (c.isDesktop && c.finePointer && !c.reduce) cleanupCursor = setupCursor();

      return function () {
        if (tick) gsap.ticker.remove(tick);
        if (lenis) { lenis.destroy(); lenis = null; }
        gsap.ticker.lagSmoothing(500, 33);
        if (cleanupCursor) cleanupCursor();
        header.classList.remove('is-scrolled');
      };
    });

    // Recalculate trigger positions once web fonts change line lengths
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }
  }

  /* ---------- Start ---------- */
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
