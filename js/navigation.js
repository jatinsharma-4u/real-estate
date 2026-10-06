/* Navigation: floating pill nav, scroll progress, active page, mobile full-screen menu,
   page transitions between the site's pages, in-page links (Lenis-aware), sticky CTAs. */
import { $, $$, rafThrottle, isDesktop, prefersReduced } from './utils.js';
import { scrollToTarget, lockScroll, unlockScroll, scroller } from './scroll.js';

const nav = $('[data-nav]');
const menu = $('[data-menu]');
const toggle = $('[data-menu-toggle]');
let menuOpen = false;
let menuTl = null;

export function initNavigation() {
  setupScrollState();
  setupActivePage();
  setupMenu();
  setupLinks();
  setupFloaters();
  setupPageTransitions();
}

/* ---------- scroll state: solid pill, hide on scroll-down, progress ---------- */
function setupScrollState() {
  const bar = $('[data-progress]');
  const heroEl = $('[data-hero-wrap], [data-page-hero]');
  let lastY = window.scrollY;
  // the bottom of the hero zone = bottom of its pin-spacer while pinned (home), else the hero itself
  const heroEnd = () => {
    if (!heroEl) return 40;
    const box = heroEl.closest('.pin-spacer') || heroEl;
    return box.getBoundingClientRect().bottom + window.scrollY - 76;
  };
  let end = heroEnd();
  window.addEventListener('resize', () => { end = heroEnd(); });
  window.addEventListener('load', () => setTimeout(() => { end = heroEnd(); }, 300));
  const update = rafThrottle(() => {
    const y = window.scrollY;
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    if (bar && max > 0) bar.style.transform = `scaleX(${Math.min(1, y / max)})`;
    if (!end || end < 80) end = heroEnd();
    const pastHero = y > end;
    nav.classList.toggle('is-solid', pastHero && !menuOpen);
    const dy = y - lastY;
    if (!menuOpen) {
      if (pastHero && y > end + 320 && dy > 6) nav.classList.add('is-hidden');
      else if (dy < -4 || !pastHero) nav.classList.remove('is-hidden');
    }
    doc.style.setProperty('--sticky-top', nav.classList.contains('is-hidden') ? '0px' : (window.innerWidth < 768 ? '60px' : '66px'));
    lastY = y;
  });
  window.addEventListener('scroll', update, { passive: true });
  update();
}

/* ---------- current page ---------- */
function setupActivePage() {
  const page = document.body.dataset.page;
  $$('[data-nav-page]').forEach((a) => {
    const on = a.dataset.navPage === page || (page === 'details' && a.dataset.navPage === 'properties');
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page');
  });
}

/* ---------- in-page (#hash) links ---------- */
function setupLinks() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const hash = a.getAttribute('href');
    if (hash.length < 2) return;
    const target = document.querySelector(hash);
    if (!target) return;
    e.preventDefault();
    const go = () => { scrollToTarget(target, { offset: -10 }); history.replaceState(null, '', hash); };
    if (menuOpen) closeMenu().then(go); else go();
  });

  // deep link on load (e.g. properties.html#plans)
  if (location.hash.length > 1) {
    window.addEventListener('load', () => {
      const t = document.querySelector(location.hash);
      t && setTimeout(() => scrollToTarget(t, { offset: -10, immediate: true }), 700);
    }, { once: true });
  }
}

/* ---------- page transitions ---------- */
function setupPageTransitions() {
  const curtain = document.createElement('div');
  curtain.className = 'curtain';
  curtain.setAttribute('aria-hidden', 'true');
  curtain.innerHTML = '<span class="curtain__mark"><svg viewBox="0 0 32 32"><path d="M4 28 16 4l12 24h-5.5L16 15.2 9.5 28z" fill="currentColor"/></svg>Azure</span>';
  document.body.append(curtain);

  window.addEventListener('pageshow', (e) => { if (e.persisted) { curtain.style.transform = ''; curtain.classList.remove('is-on'); } });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (!/\.html$|\/$/.test(url.pathname)) return;
    if (url.pathname === location.pathname && url.search === location.search) return;   // same page → hash handler
    e.preventDefault();
    const go = () => { sessionStorage.setItem('az:t', '1'); location.href = url.href; };
    const { gsap } = window;
    if (!gsap || prefersReduced()) return go();
    const run = () => {
      lockScroll();
      curtain.classList.add('is-on');
      gsap.fromTo(curtain, { yPercent: 100 }, { yPercent: 0, duration: 0.7, ease: 'expo.inOut', onComplete: go });
      // safety net: if animation frames are throttled, still navigate
      setTimeout(go, 1600);
    };
    if (menuOpen) closeMenu(true); run();
  });
}

/* ---------- mobile / tablet menu ---------- */
function setupMenu() {
  if (!menu || !toggle) return;
  toggle.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) closeMenu(); });
  window.addEventListener('resize', () => { if (menuOpen && isDesktop()) closeMenu(true); });
  menu.addEventListener('click', (e) => { if (e.target.closest('[data-menu-cta]')) closeMenu(true); });
  resetMenuState();
}

/* content starts hidden, so the background always arrives first */
function resetMenuState() {
  const { gsap } = window;
  if (!gsap) return;
  const p = menuParts();
  gsap.set(p.bg, { clipPath: 'inset(0% 0% 100% 0%)' });
  gsap.set(p.links, { yPercent: 115 });
  gsap.set(p.side, { autoAlpha: 0, y: 30 });
  gsap.set(p.prev, { clipPath: 'inset(100% 0% 0% 0%)' });
}

const menuParts = () => ({
  bg: $('[data-menu-bg]', menu),
  links: $$('.menu__list li a > span', menu),
  rows: $$('.menu__list li a', menu),
  side: $('.menu__side', menu),
  prev: $('.menu__preview', menu),
});

function setInert(on) {
  ['main', '.foot', '[data-dock]', '[data-float]'].forEach((s) => { const el = $(s); if (el) el.inert = on; });
}

function openMenu() {
  if (menuOpen) return;
  menuOpen = true;
  nav.classList.remove('is-hidden');
  nav.classList.add('menu-open');
  nav.classList.remove('is-solid');
  toggle.setAttribute('aria-expanded', 'true');
  $('[data-menu-label]').textContent = 'Close';
  menu.inert = false;
  menu.classList.add('is-open');
  setInert(true);
  lockScroll();

  const { gsap } = window;
  const p = menuParts();
  if (!gsap || prefersReduced()) { p.bg.style.clipPath = 'inset(0)'; p.links.forEach((l) => (l.style.transform = 'none')); p.side.style.opacity = 1; p.side.style.visibility = 'visible'; (p.rows[0] || toggle).focus(); return; }
  menuTl && menuTl.kill();
  menuTl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  // 1) background first  2) links  3) side panel
  menuTl.to(p.bg, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.42, ease: 'power3.inOut' })
    .to(p.links, { yPercent: 0, duration: 0.5, stagger: 0.028, ease: 'power3.out' }, '-=0.12')
    .to(p.side, { autoAlpha: 1, y: 0, duration: 0.4 }, '-=0.4')
    .to(p.prev, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.5, ease: 'power3.inOut' }, '-=0.4');
  (p.rows[0] || toggle).focus({ preventScroll: true });
}

function closeMenu(instant = false) {
  if (!menuOpen) return Promise.resolve();
  menuOpen = false;
  toggle.setAttribute('aria-expanded', 'false');
  $('[data-menu-label]').textContent = 'Menu';
  const { gsap } = window;
  const p = menuParts();
  const finish = () => {
    menu.classList.remove('is-open');
    menu.inert = true;
    nav.classList.remove('menu-open');
    setInert(false);
    unlockScroll();
    if (window.scrollY > 40) nav.classList.add('is-solid');
    toggle.focus({ preventScroll: true });
    if (gsap) resetMenuState();
  };
  if (!gsap || prefersReduced() || instant) { finish(); return Promise.resolve(); }
  menuTl && menuTl.kill();
  return new Promise((resolve) => {
    menuTl = gsap.timeline({ onComplete: () => { finish(); resolve(); } });
    menuTl.to([p.side, p.prev], { autoAlpha: 0, duration: 0.18, ease: 'power2.in' })
      .to(p.links, { yPercent: -115, duration: 0.28, stagger: 0.012, ease: 'power3.in' }, 0)
      .to(p.bg, { clipPath: 'inset(100% 0% 0% 0%)', duration: 0.38, ease: 'power3.inOut' }, 0.08);
  });
}

/* ---------- sticky / floating CTAs ---------- */
function setupFloaters() {
  const float = $('[data-float]');
  const dock = $('[data-dock]');
  const hero = $('[data-hero], [data-page-hero]');
  const form = $('#enquire');

  if (float && hero) {
    const set = (on) => {
      float.classList.toggle('is-on', on);
      float.setAttribute('aria-hidden', on ? 'false' : 'true');
      $$('a, button', float).forEach((el) => (el.tabIndex = on ? 0 : -1));
    };
    new IntersectionObserver(([e]) => set(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0.12 }).observe(hero);
    if (form) new IntersectionObserver(([e]) => { if (e.isIntersecting) set(false); else if (hero.getBoundingClientRect().bottom < 0) set(true); }, { threshold: 0.25 }).observe(form);
  }
  if (dock && form) {
    new IntersectionObserver(([e]) => dock.classList.toggle('is-away', e.isIntersecting), { threshold: 0.3 }).observe(form);
  }
}

export const navApi = { closeMenu, isMenuOpen: () => menuOpen };
