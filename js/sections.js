/* Section-level interactions: buttons, magnetic hover, amenities, property types, floor plans, image fallback. */
import { $, $$, pad2, prefersReduced, mqFine, waUrl, toast } from './utils.js';
import { scrollToTarget } from './scroll.js';
import { openPlanViewer } from './gallery.js';

export function initSections() {
  initButtonIcons();
  initMagnetic();
  initAmenities();
  initTypes();
  initPlans();
  initImageFallback();
  initTilt();
  $$('[data-wa-link]').forEach((a) => { if (!a.closest('[data-leadform]')) a.href = waUrl(); });
}

/* ---------- buttons: duplicate the arrow so it can slide through on hover ---------- */
function initButtonIcons() {
  $$('.btn__icon').forEach((wrap) => {
    const svg = $('svg', wrap);
    if (svg && wrap.querySelectorAll('svg').length === 1) wrap.append(svg.cloneNode(true));
  });
}

/* ---------- magnetic buttons (fine pointers only) ---------- */
function initMagnetic() {
  const { gsap } = window;
  if (!gsap || !mqFine.matches || prefersReduced()) return;
  $$('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.18);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.28);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

/* ---------- amenities: wipe between slides ---------- */
function initAmenities() {
  const root = $('[data-amen]');
  if (!root) return;
  const items = $$('[data-amen-item]', root);
  const slides = $$('[data-amen-slide]', root);
  const cur = $('[data-amen-cur]', root);
  const stage = $('[data-amen-stage]', root);
  let active = 'pool';
  let hoverTimer;

  function activate(id, { scroll = false } = {}) {
    if (id === active) return;
    const prev = slides.find((s) => s.classList.contains('is-active'));
    const next = slides.find((s) => s.dataset.amenSlide === id);
    if (!next) return;
    slides.forEach((s) => s.classList.remove('is-prev'));
    if (prev) { prev.classList.remove('is-active'); prev.classList.add('is-prev'); }
    // force a reflow so the wipe restarts even on rapid switching
    void next.offsetWidth;
    next.classList.add('is-active');
    items.forEach((b) => {
      const on = b.dataset.amenItem === id;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    active = id;
    cur.textContent = pad2(items.findIndex((b) => b.dataset.amenItem === id) + 1);
    // phones: bring the image into view after a tap so the change is never off-screen
    if (scroll && window.innerWidth < 1024) {
      const r = stage.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight) scrollToTarget(stage, { offset: -90, duration: 1 });
    }
  }

  items.forEach((b) => {
    b.addEventListener('click', () => activate(b.dataset.amenItem, { scroll: true }));
    b.addEventListener('focus', () => activate(b.dataset.amenItem));
    if (mqFine.matches) {
      b.addEventListener('pointerenter', () => { clearTimeout(hoverTimer); hoverTimer = setTimeout(() => activate(b.dataset.amenItem), 90); });
      b.addEventListener('pointerleave', () => clearTimeout(hoverTimer));
    }
  });
}

/* ---------- residences: availability states ---------- */
function initTypes() {
  const cards = $$('[data-type]');
  let available = 0;
  cards.forEach((card) => {
    const state = card.dataset.availability;
    const badge = $('[data-badge]', card);
    const cta = $('[data-cta]', card);
    const label = cta && $('.btn__label', cta);
    if (state === 'sold-out') {
      badge.textContent = 'Sold out';
      if (cta) {
        cta.removeAttribute('href');
        cta.setAttribute('role', 'button');
        cta.setAttribute('data-open-lead', 'Join Waitlist');
        cta.dataset.planType = `${card.dataset.type} BHK`;
        cta.tabIndex = 0;
        cta.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cta.click(); } });
        label.textContent = 'Join Waitlist';
      }
    } else {
      available += 1;
      if (state === 'limited') badge.textContent = `Only ${card.dataset.unitsLeft || 'a few'} left`;
    }
  });
  // "no availability at all" empty state
  if (cards.length && available === 0) {
    const grid = $('[data-types]');
    const box = document.createElement('div');
    box.className = 'empty';
    box.innerHTML = '<svg class="i i--lg" aria-hidden="true"><use href="#i-alert"/></svg><p class="empty__t">All residences are currently reserved.</p><p class="empty__s">Join the waitlist and we’ll contact you first when the next phase opens.</p>';
    const b = document.createElement('button');
    b.className = 'btn btn--blue btn--sm'; b.type = 'button'; b.dataset.openLead = 'Join Waitlist';
    b.innerHTML = '<span class="btn__label">Join the waitlist</span><span class="btn__icon"><svg class="i"><use href="#i-arrow-ur"/></svg></span>';
    box.append(b);
    grid.after(box);
  }

  // "View Details" / footer links jump to the matching floor plan tab
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-plan]');
    if (a) setTab(a.dataset.plan, { focus: false, animate: false });
  });
}

/* ---------- floor plans: accessible tabs with a sliding ink + crossfade ---------- */
let setTab = () => {};
function initPlans() {
  const root = $('[data-plans]');
  if (!root) return;
  const tabs = $$('[data-tab]', root);
  const panels = $$('[data-panel-id]', root);
  const ink = $('[data-tab-ink]', root);
  const wrap = $('[data-plan-tabs]', root);
  let current = '2';
  let tween = null;

  const moveInk = () => {
    const t = tabs.find((x) => x.dataset.tab === current);
    if (!t) return;
    ink.style.setProperty('--x', `${t.offsetLeft}px`);
    ink.style.setProperty('--w', `${t.offsetWidth}px`);
  };

  setTab = (id, { focus = true, animate = true } = {}) => {
    if (id === current) return;
    const { gsap } = window;
    const out = panels.find((p) => p.dataset.panelId === current);
    const inn = panels.find((p) => p.dataset.panelId === id);
    tabs.forEach((t) => {
      const on = t.dataset.tab === id;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    current = id;
    moveInk();
    tween && tween.kill();
    if (!gsap || prefersReduced() || !animate) { out.hidden = true; inn.hidden = false; gsap && gsap.set([out, inn], { clearProps: 'all' }); return; }
    tween = gsap.timeline()
      .to(out, { autoAlpha: 0, y: -14, duration: 0.28, ease: 'power2.in', onComplete: () => { out.hidden = true; gsap.set(out, { clearProps: 'all' }); inn.hidden = false; } })
      .fromTo(inn, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.85, ease: 'expo.out', clearProps: 'transform,opacity,visibility' });
  };

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => setTab(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      let n = null;
      if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = tabs.length - 1;
      if (n !== null) { e.preventDefault(); setTab(tabs[n].dataset.tab); }
    });
  });
  new ResizeObserver(moveInk).observe(wrap);
  const wanted = new URLSearchParams(location.search).get('plan');
  if (wanted && tabs.some((t) => t.dataset.tab === wanted)) setTab(wanted, { focus: false, animate: false });
  document.fonts && document.fonts.ready.then(moveInk);
  moveInk();

  $$('[data-plan-view]', root).forEach((b) => b.addEventListener('click', () => {
    const panel = b.closest('[data-panel-id]');
    const img = $('img', panel);
    openPlanViewer(img.currentSrc || img.src, img.alt, $('.plan__name', panel).textContent.replace(/\s+/g, ' ').trim(), b);
  }));
}

/* ---------- image failure: intentional placeholder instead of a broken icon ---------- */
function initImageFallback() {
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.hasAttribute('data-fallback')) return;
    const host = img.closest('picture') || img.closest('.plan__fig');
    host && host.classList.add('is-broken');
  }, true);
  document.addEventListener('load', (e) => {
    const img = e.target;
    if (img instanceof HTMLImageElement && img.hasAttribute('data-fallback')) (img.closest('picture') || img.closest('.plan__fig') || img).classList.remove('is-broken');
  }, true);
  // images that failed before the listener existed (checked once everything has settled)
  window.addEventListener('load', () => {
    $$('img[data-fallback]').forEach((img) => {
      if (img.complete && img.naturalWidth === 0 && img.currentSrc && img.loading !== 'lazy') (img.closest('picture') || img.parentElement).classList.add('is-broken');
    });
  }, { once: true });
}

export { toast };


/* ---------- cards: subtle 3D tilt + cursor spotlight (fine pointers only) ---------- */
function initTilt() {
  const { gsap } = window;
  if (!gsap || !mqFine.matches || prefersReduced()) return;
  $$('.xcard, .ccard, .quote').forEach((el) => {
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' });
    gsap.set(el, { transformPerspective: 900 });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      ry(nx * 5); rx(-ny * 5);
      el.style.setProperty('--mx', `${(nx + 0.5) * 100}%`);
      el.style.setProperty('--my', `${(ny + 0.5) * 100}%`);
    });
    el.addEventListener('pointerleave', () => { rx(0); ry(0); });
  });
}
