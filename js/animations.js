/* ==========================================================================
   Scroll + intro choreography (GSAP · ScrollTrigger · SplitText)
   Rules: animate transform / opacity / clip-path only · one hero moment, then
   major sections → key images → supporting copy · everything honours reduced-motion.
   ========================================================================== */
import { $, $$, pad2, isDesktop, waitFor } from './utils.js';
import { scroller } from './scroll.js';

let gsap, ScrollTrigger, SplitText;

const EASE = { out: 'expo.out', io: 'expo.inOut', soft: 'power3.out' };

/* ---------- entry ---------- */
export function initAnimations({ reduced }) {
  ({ gsap, ScrollTrigger, SplitText } = window);
  if (!gsap || !ScrollTrigger) throw new Error('GSAP not available');
  gsap.registerPlugin(ScrollTrigger, SplitText, window.Flip, window.CustomEase);
  ScrollTrigger.config({ ignoreMobileResize: true });

  if (reduced) {
    // Calm path: everything is visible in its final state; only counters + essential state changes.
    $$('[data-count]').forEach((el) => { el.textContent = fmt(+el.dataset.count) + (el.dataset.suffix || ''); });
    initShowcaseStatic();
    return Promise.resolve();
  }

  prepareHero();
  playIntro();

  // ORDER MATTERS: pinned sections are created first, in page order, so every later trigger measures
  // its start/end *after* the pin-spacers above it exist.
  heroScroll();
  heroCover();
  showcase();
  lifestyle();
  textReveals();
  generalReveals();
  imageReveals();
  parallaxLayers();
  parallaxImgs();
  marquee();
  brandWord();
  counters();
  footerReveal();

  // Refresh once fonts + images settle so every trigger measures final geometry.
  const refresh = () => ScrollTrigger.refresh();
  window.addEventListener('load', refresh, { once: true });
  document.fonts && document.fonts.ready.then(() => setTimeout(refresh, 60));

  return Promise.resolve();
}

/* ---------- intro (home hero · inner-page hero · plain pages) ---------- */
const hero = () => $('[data-hero]');
const phero = () => $('[data-page-hero]');
let heroSplits = {};

function prepareHero() {
  gsap.set('.nav__bar', { autoAlpha: 0, y: -26 });
  const h = hero();
  const p = phero();
  if (h) {
    const scenes = $$('[data-hero-scene]', h);
    gsap.set(scenes, { scale: window.innerWidth < 768 ? 1 : 1.08, opacity: 0 });
    heroSplits.word = SplitText.create($('.hero__word-text', h), { type: 'chars', mask: 'chars', charsClass: 'hc' });
    gsap.set(heroSplits.word.chars, { yPercent: 112 });
    heroSplits.tag = SplitText.create($('[data-hero-tag]', h), { type: 'lines', mask: 'lines', linesClass: 'sl' });
    gsap.set(heroSplits.tag.lines, { yPercent: 112 });
    gsap.set($$('[data-hero-cta] > *', h), { autoAlpha: 0, y: 26 });
    gsap.set($$('[data-hero-meta]', h), { autoAlpha: 0, y: 14 });
  } else if (p) {
    gsap.set($('[data-phero-media]', p), { scale: 1.14 });
    heroSplits.title = SplitText.create($('[data-phero-title]', p), { type: 'chars', mask: 'chars', charsClass: 'hc' });
    gsap.set(heroSplits.title.chars, { yPercent: 112 });
    gsap.set($$('[data-phero-fade]', p), { autoAlpha: 0, y: 20 });
  }
}

async function playIntro() {
  const h = hero();
  const p = phero();
  const loader = $('[data-loader]');
  const quick = !!sessionStorage.getItem('az:t');          // arrived via an in-site page transition
  sessionStorage.removeItem('az:t');

  const lead = h ? $('.hero__sky img', h) : p ? $('[data-phero-media] img', p) : null;
  await waitFor(Promise.all([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    lead && lead.decode ? lead.decode().catch(() => {}) : Promise.resolve(),
  ]), 2600);
  if (!quick) await new Promise((r) => setTimeout(r, 320));

  const tl = gsap.timeline({ defaults: { ease: EASE.out }, onComplete: () => { loader && loader.remove(); } });
  if (loader) {
    tl.to($('.loader__inner', loader), { y: -16, autoAlpha: 0, duration: quick ? 0.25 : 0.5, ease: 'power2.in' })
      .to(loader, { yPercent: -100, duration: quick ? 0.85 : 1.1, ease: EASE.io }, '-=0.1');
  }
  tl.to('.nav__bar', { autoAlpha: 1, y: 0, duration: 1 }, '-=0.6');

  if (h) {
    // navigation → image → heading → CTAs → metadata
    const scenes = $$('[data-hero-scene]', h);
    tl.to(scenes, { scale: 1, opacity: 1, duration: 2.2, ease: 'power3.out', stagger: window.innerWidth < 768 ? 0 : { each: 0.14, from: 'start' } }, '<')
      .to(heroSplits.word.chars, { yPercent: 0, duration: 1.6, stagger: 0.07 }, '-=1.9')
      .to(heroSplits.tag.lines, { yPercent: 0, duration: 1.2, stagger: 0.1 }, '-=1.1')
      .to($$('[data-hero-cta] > *', h), { autoAlpha: 1, y: 0, duration: 1, stagger: 0.1 }, '-=0.8')
      .to($$('[data-hero-meta]', h), { autoAlpha: 1, y: 0, duration: 1, stagger: 0.08 }, '-=0.85');
  } else if (p) {
    tl.to($('[data-phero-media]', p), { scale: 1, duration: 2, ease: 'power3.out' }, '<')
      .to(heroSplits.title.chars, { yPercent: 0, duration: 1.3, stagger: 0.04 }, '-=1.6')
      .to($$('[data-phero-fade]', p), { autoAlpha: 1, y: 0, duration: 1, stagger: 0.1 }, '-=0.9');
  }
  // NB: never return/await the timeline itself — GSAP timelines are thenable and would block boot until they finish.
}

function heroScroll() {
  const p = phero();
  if (p && window.innerWidth >= 768) {
    gsap.to($('[data-phero-media]', p), { yPercent: 10, ease: 'none', scrollTrigger: { trigger: p, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to($('.phero__inner', p), { yPercent: -10, autoAlpha: 0.2, ease: 'none', scrollTrigger: { trigger: p, start: 'top top', end: 'bottom 20%', scrub: true } });
  }
  const h = hero();
  if (!h) return;
  const L = {};
  $$('[data-hero-scene]', h).forEach((l) => { L[l.dataset.depth] = l; });
  const word = $('[data-hero-word]', h);
  const ui = $('.hero__ui', h);
  const veil = document.createElement('div');
  veil.className = 'hero__veil';
  veil.setAttribute('aria-hidden', 'true');
  h.append(veil);
  if (window.innerWidth < 768) return;

  // clouds also drift on their own
  const cl = $('.hero__clouds picture', h);
  if (cl) gsap.fromTo(cl, { xPercent: -2.5 }, { xPercent: 2.5, duration: 38, ease: 'sine.inOut', repeat: -1, yoyo: true });

  // The hero is pinned. Scrolling plays ONE choreographed sequence, then (and only then) the next section arrives:
  //   0 → .72   the AZURE title sinks slowly *behind* the villa while the depth planes drift at different speeds
  //   .72 → 1   the scene dims and settles
  const mobile = window.innerWidth < 768;
  if (mobile) return;                                   // phones: one single image, no pin, no parallax
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: h.parentElement, start: 'top top', end: mobile ? '+=125%' : '+=170%', pin: true, scrub: 1.5, anticipatePin: 1, invalidateOnRefresh: true },
  });
  tl.to(word, { yPercent: 120, ease: 'power1.inOut', duration: 0.72 }, 0)
    .to(word, { autoAlpha: 0, duration: 0.3, ease: 'power1.in' }, 0.3)
    .to(L.sky, { yPercent: 9, duration: 1 }, 0)
    .to(L.clouds, { yPercent: 5, xPercent: -3, duration: 1 }, 0)
    .to(L.house, { yPercent: -1.5, duration: 1 }, 0)
    .to(L.fore, { yPercent: -7, duration: 1 }, 0)
    .to(ui, { autoAlpha: 0, yPercent: -10, duration: 0.3 }, 0.04)
    .to(veil, { opacity: 0.5, duration: 0.28 }, 0.72);
}

/* ---------- next-level section choreography ---------- */

// Home: the section after the pinned hero opens from the centre (rounded sheet widening to full width)
function heroCover() {
  const h = hero();
  let s = h && h.parentElement.nextElementSibling;
  if (s && s.matches('[data-brandband]')) s = s.nextElementSibling;
  if (!s || window.innerWidth < 768) return;
  gsap.fromTo(s, { clipPath: 'inset(110px 7% 0% 7% round 40px 40px 0 0)' }, {
    clipPath: 'inset(0px 0% 0% 0% round 0px 0px 0 0)', ease: 'none',
    scrollTrigger: { trigger: s, start: 'top 100%', end: 'top 30%', scrub: 1.1 },
    onComplete: () => gsap.set(s, { clearProps: 'clipPath' }),
  });
  const media = $('.intro__media', s);
  if (media) gsap.fromTo(media, { y: 90 }, { y: 0, ease: 'none', scrollTrigger: { trigger: s, start: 'top 100%', end: 'top 20%', scrub: 1.2 } });
}

// every content section "opens" as it enters: inset + rounded top corners relax to full width
function sectionReveals() {
  const list = $$('main > section').filter((s) => !s.matches('.hero, .phero, [data-showcase], [data-life], .cta') && !s.previousElementSibling?.matches('.hero'));
  list.forEach((s) => {
    const px = window.innerWidth < 768 ? 28 : 64;
    gsap.fromTo(s, { clipPath: `inset(${px}px 2.5% 0% 2.5% round 28px 28px 0 0)` }, {
      clipPath: 'inset(0px 0% 0% 0% round 0px 0px 0 0)', ease: 'none',
      scrollTrigger: { trigger: s, start: 'top 98%', end: 'top 58%', scrub: 0.6 },
      onComplete: () => gsap.set(s, { clearProps: 'clipPath' }),
    });
  });
}

// big outlined ticker that travels with the scroll (and leans into fast scrolls)
function marquee() {
  $$('[data-marquee]').forEach((m) => {
    const track = $('.marquee__track', m);
    const dir = m.dataset.marquee === 'rtl' ? 1 : -1;
    gsap.fromTo(track, { xPercent: dir === -1 ? 0 : -33 }, {
      xPercent: dir === -1 ? -33 : 0, ease: 'none',
      scrollTrigger: { trigger: m, start: 'top bottom', end: 'bottom top', scrub: 0.5 },
    });
  });
}

// images inside cards drift against the page for depth
function parallaxImgs() {
  const mm = gsap.matchMedia();
  mm.add('(min-width: 768px)', () => {
    $$('.xcard__img, .type__media, .amen__stage .amen__pic').forEach((box) => {
      const img = $('img', box);
      if (!img) return;
      gsap.set(img, { scale: 1.16 });
      gsap.fromTo(img, { yPercent: -7 }, { yPercent: 7, ease: 'none', scrollTrigger: { trigger: box, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    return () => gsap.set($$('.xcard__img img, .type__media img, .amen__stage .amen__pic img'), { clearProps: 'all' });
  });
}

// footer is revealed from underneath the last section (desktop)
function footerReveal() {
  const foot = $('.foot');
  if (!foot || window.innerWidth < 1024) return;
  document.documentElement.classList.add('foot-reveal');
  const set = () => document.documentElement.style.setProperty('--foot-h', `${foot.offsetHeight}px`);
  set();
  new ResizeObserver(() => { set(); ScrollTrigger.refresh(); }).observe(foot);
  gsap.fromTo($('.foot__word span', foot), { yPercent: 30 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: document.body, start: 'bottom 160%', end: 'bottom bottom', scrub: true } });
}

/* ---------- text ---------- */
function textReveals() {
  // headings: masked line reveal; SplitText re-splits on resize / font swap (autoSplit)
  $$('[data-split]').forEach((el) => {
    SplitText.create(el, {
      type: 'lines', mask: 'lines', linesClass: 'sl', autoSplit: true,
      onSplit(self) {
        return gsap.from(self.lines, {
          yPercent: 112, duration: 1.25, ease: EASE.out, stagger: 0.09,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        });
      },
    });
  });

  // statement: words light up as you read (scrubbed)
  $$('[data-words]').forEach((el) => {
    SplitText.create(el, {
      type: 'words', autoSplit: true,
      onSplit(self) {
        return gsap.fromTo(self.words, { opacity: 0.14 }, {
          opacity: 1, ease: 'none', stagger: 0.12, duration: 1,
          scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 48%', scrub: 0.6 },
        });
      },
    });
  });
}

function generalReveals() {
  $$('[data-reveal]').forEach((el) => {
    gsap.fromTo(el, { y: 32, autoAlpha: 0 }, {
      y: 0, autoAlpha: 1, duration: 1.15, ease: EASE.out,
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });
  $$('[data-stagger]').forEach((el) => {
    gsap.fromTo(el.children, { y: 40, autoAlpha: 0 }, {
      y: 0, autoAlpha: 1, duration: 1.1, ease: EASE.out, stagger: 0.09,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });
  // staggered card entrances (grid items)
  $$('.type').forEach((el, i) => {
    gsap.fromTo(el, { y: 70, autoAlpha: 0 }, {
      y: 0, autoAlpha: 1, duration: 1.2, ease: EASE.out, delay: i * 0.08,
      scrollTrigger: { trigger: '.types__grid', start: 'top 82%', once: true },
    });
  });
  $$('.quote').forEach((el) => {
    gsap.fromTo(el, { y: 40, autoAlpha: 0 }, {
      y: 0, autoAlpha: 1, duration: 1.1, ease: EASE.out,
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });
  const form = $('.enq__card');
  // the lead form must never be left invisible: translate only, no opacity gating
  if (form) gsap.fromTo(form, { y: 50 }, { y: 0, duration: 1.3, ease: EASE.out, scrollTrigger: { trigger: form, start: 'top 92%', once: true } });
}

/* ---------- images ---------- */
function imageReveals() {
  $$('[data-img-reveal]').forEach((el) => {
    const pic = $('picture', el);
    const img = $('img', el);
    const st = { trigger: el, start: 'top 86%', once: true };
    gsap.fromTo(el, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: EASE.io, scrollTrigger: st });
    gsap.fromTo(img, { scale: 1.32 }, { scale: 1, duration: 2.1, ease: EASE.out, scrollTrigger: st });
    // gentle scrubbed parallax on the wrapper picture (keeps GSAP transforms off the <img>)
    if (pic && el.classList.contains('frame--tall')) {
      gsap.fromTo(pic, { yPercent: -6, scale: 1.14 }, { yPercent: 6, scale: 1.14, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
    }
  });
}

function parallaxLayers() {
  $$('[data-parallax-wrap]').forEach((el) => {
    const speed = parseFloat(el.dataset.speed || '1.2');
    const amt = (speed - 1) * 42;               // 1.2 → ~8%, 1.4 → ~17%
    const isBg = el.classList.contains('stats__bg') || el.classList.contains('cta__bg');
    const host = isBg ? el.parentElement : el.closest('.intro__media') || el;
    gsap.fromTo(el, { yPercent: isBg ? -amt : amt }, {
      yPercent: isBg ? amt : -amt, ease: 'none',
      scrollTrigger: { trigger: host, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });
}

/* ---------- counters ---------- */
const fmt = (n) => Math.round(n).toLocaleString('en-IN');
function counters() {
  $$('[data-count]').forEach((el) => {
    const end = +el.dataset.count;
    const suffix = el.dataset.suffix || '';
    const o = { v: 0 };
    el.textContent = '0' + suffix;
    gsap.to(o, {
      v: end, duration: 2.4, ease: 'power3.out',
      onUpdate: () => { el.textContent = fmt(o.v) + suffix; },
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });
}

/* ---------- lifestyle: the photo opens from the centre to both sides as you scroll ---------- */
function lifestyle() {
  const root = $('[data-life]');
  if (!root) return;
  const stage = $('[data-life-stage]', root);
  const media = $('[data-life-media]', root);
  const img = $('img', media);
  const lines = $$('[data-life-line]', root);
  const notes = $$('[data-life-notes] > li', root);
  const eyebrow = $('[data-life-eyebrow]', root);
  const sub = $('[data-life-sub]', root);

  gsap.set(lines, { yPercent: 112 });
  gsap.set([sub, eyebrow], { autoAlpha: 0, y: 24 });
  gsap.set(notes, { autoAlpha: 0, y: 28 });

  // the photo is revealed top → bottom, tilting up out of the page (soft 3D) as you scroll
  const mm = gsap.matchMedia();
  const reveal = (mobile) => {
    gsap.set(stage, { perspective: 1400 });
    gsap.set(media, { clipPath: 'inset(0% 0% 100% 0%)', transformOrigin: '50% 0%', rotationX: mobile ? 10 : 16, y: mobile ? 40 : 80, scale: mobile ? 0.94 : 0.9, transformPerspective: 1400 });
    gsap.set(img, { scale: 1.3, yPercent: -6 });
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: stage, start: mobile ? 'top 90%' : 'top 86%', end: mobile ? 'top 30%' : 'top 10%', scrub: 1.2 },
    });
    tl.to(media, { clipPath: 'inset(0% 0% 0% 0%)', rotationX: 0, y: 0, scale: 1, duration: 1 }, 0)
      .to(img, { scale: 1, yPercent: 0, duration: 1 }, 0);
    return () => gsap.set([stage, media, img], { clearProps: 'all' });
  };
  mm.add('(min-width: 768px)', () => reveal(false));
  mm.add('(max-width: 767.98px)', () => reveal(true));

  gsap.timeline({ scrollTrigger: { trigger: root, start: 'top 70%', once: true }, defaults: { ease: EASE.out } })
    .to(eyebrow, { autoAlpha: 1, y: 0, duration: 1 })
    .to(lines, { yPercent: 0, duration: 1.4, stagger: 0.14 }, '-=0.7')
    .to(sub, { autoAlpha: 1, y: 0, duration: 1.1 }, '-=0.8');
  gsap.to(notes, { autoAlpha: 1, y: 0, duration: 1.1, ease: EASE.out, stagger: 0.12, scrollTrigger: { trigger: '[data-life-notes]', start: 'top 92%', once: true } });
}

/* ---------- showcase: pinned horizontal scroll on desktop, native swipe on touch ---------- */
function showcase() {
  const root = $('[data-showcase]');
  if (!root) return;
  const track = $('[data-showcase-track]', root);
  const viewport = $('[data-showcase-viewport]', root);
  const cur = $('[data-showcase-cur]', root);
  const bar = $('[data-showcase-bar]', root);
  const panels = $$('[data-panel]', root);

  const mm = gsap.matchMedia();
  mm.add('(min-width: 1024px)', () => {
    viewport.removeAttribute('tabindex');
    const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
    const tween = gsap.to(track, {
      x: () => -distance(), ease: 'none',
      scrollTrigger: {
        trigger: root, start: 'top top', end: () => '+=' + (distance() + window.innerHeight * 0.15),
        pin: true, scrub: 1.2, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate(self) {
          const p = self.progress;
          bar && (bar.style.transform = `scaleX(${p})`);
          cur && (cur.textContent = pad2(Math.min(panels.length, Math.round(p * (panels.length - 1)) + 1)));
        },
      },
    });
    // image parallax inside each panel, tied to the horizontal movement
    panels.forEach((p) => {
      const img = $('img', p);
      gsap.set(img, { scale: 1.2 });
      gsap.fromTo(img, { xPercent: -6 }, {
        xPercent: 6, ease: 'none',
        scrollTrigger: { trigger: p, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
      });
    });
    // drag-to-scroll (mouse): pointer drag drives page scroll, so the pinned track follows
    const stop = enableDrag(viewport);
    return () => { stop(); viewport.setAttribute('tabindex', '0'); gsap.set($$('img', root), { clearProps: 'all' }); gsap.set(track, { clearProps: 'all' }); };
  });
}

function initShowcaseStatic() { /* reduced motion: native horizontal scroll, nothing to wire */ }

function enableDrag(el) {
  let down = false; let sx = 0; let last = 0; let moved = false;
  const onDown = (e) => { if (e.pointerType !== 'mouse' || e.button !== 0) return; down = true; moved = false; sx = last = e.clientX; };
  const onMove = (e) => {
    if (!down) return;
    const dx = e.clientX - last;
    if (!moved && Math.abs(e.clientX - sx) < 6) return;
    moved = true; last = e.clientX;
    const y = (scroller.lenis ? scroller.lenis.scroll : window.scrollY) - dx * 1.6;
    scroller.lenis ? scroller.lenis.scrollTo(y, { immediate: true }) : window.scrollTo(0, y);
  };
  const onUp = () => { down = false; };
  el.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  return () => { el.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
}

export { fmt };


/* The title that sank behind the villa keeps travelling down: it slides out of the top edge of the next band at the
   same (smaller) size, then grows to the full width of the screen — one continuous gesture. */
function brandWord() {
  if (window.innerWidth < 768) return;
  $$('[data-brandword]').forEach((el) => {
    const band = el.closest('[data-brandband]');
    const mobile = window.innerWidth < 768;
    gsap.set(el, { transformOrigin: '50% 0%' });
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: band, start: () => `top bottom-=${Math.round(window.innerWidth * 0.14)}`, end: mobile ? 'top 30%' : 'top 16%', scrub: 1.1, invalidateOnRefresh: true },
    });
    tl.fromTo(el, { yPercent: -104, scale: 0.6 }, { yPercent: 0, scale: 1, ease: 'power2.out' }, 0);
  });
}
