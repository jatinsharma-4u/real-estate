/* Gallery: Flip-animated category filters + full-screen lightbox (keyboard, swipe, preload, fullscreen). */
import { $, $$, pad2, prefersReduced, waitFor } from './utils.js';
import { lockScroll, unlockScroll, scrollToTarget } from './scroll.js';

const lb = $('[data-lightbox]');
let items = [];       // current lightbox items
let index = 0;
let trigger = null;
let busy = false;

export function initGallery() {
  initFilters();
  initLightbox();
  window.azOpenViewer = openViewer;
}

/* ---------- filters ---------- */
function initFilters() {
  const root = $('[data-gallery]');
  if (!root) return;
  const grid = $('[data-gal-grid]', root);
  const chips = $$('[data-filter]', root);
  const empty = $('[data-gal-empty]', root);
  const status = $('[data-gal-status]', root);
  const all = $$('.gal__item', grid);

  const matches = (el, cat) => cat === 'all' || el.dataset.cat.split(' ').includes(cat);

  const num = $('[data-gal-num]', root);
  let current = 'all';
  let token = 0;

  // counts on the chips
  chips.forEach((c) => {
    if (!c.closest('.chips') || c.dataset.filter === undefined) return;
    const n = all.filter((el) => matches(el, c.dataset.filter)).length;
    if (c.dataset.filter !== 'all') c.insertAdjacentHTML('beforeend', `<sup>${n}</sup>`);
  });

  function setActive(cat) {
    chips.forEach((c) => {
      if (c.closest('.chips')) {
        const on = c.dataset.filter === cat;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on) { const bar = c.closest('.chips'); bar.scrollTo({ left: c.offsetLeft - (bar.clientWidth - c.offsetWidth) / 2, behavior: 'smooth' }); }
      }
    });
  }

  function swap(cat) {
    let count = 0;
    all.forEach((el) => { const show = matches(el, cat); el.hidden = !show; if (show) count += 1; });
    empty.hidden = count !== 0;
    grid.hidden = count === 0;
    status.textContent = count ? `Showing ${count} image${count === 1 ? '' : 's'}` : 'No images in this category';
    if (num) num.textContent = String(count);
    return all.filter((el) => !el.hidden);
  }

  function apply(cat) {
    if (cat === current) return;
    current = cat;
    setActive(cat);
    const { gsap } = window;
    const run = ++token;
    if (!gsap || prefersReduced()) { swap(cat); return; }
    // 1) quick fade-out of what is on screen   2) swap in one frame (no layout animation → no glitch)
    // 3) staggered rise of the new set
    gsap.killTweensOf(all);
    const visible = all.filter((el) => !el.hidden);
    gsap.to(visible, {
      autoAlpha: 0, y: 10, duration: 0.22, ease: 'power2.in', stagger: { amount: 0.12 },
      onComplete: () => {
        if (run !== token) return;
        gsap.set(all, { clearProps: 'all' });
        const next = swap(cat);
        // the page just got shorter/longer: bring the first image back into view instead of landing at the bottom
        const bar = $('.gal__bar', root);
        const top = grid.getBoundingClientRect().top;
        if (top < (bar ? bar.offsetHeight : 0) + 90 || top > window.innerHeight * 0.6) scrollToTarget(grid, { offset: -((bar ? bar.offsetHeight : 60) + 96), duration: 0.9 });
        gsap.fromTo(next, { autoAlpha: 0, y: 28 }, {
          autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: { amount: 0.5, from: 'start' }, clearProps: 'transform,opacity,visibility',
        });
        window.ScrollTrigger && setTimeout(() => window.ScrollTrigger.refresh(), 900);
      },
    });
  }

  chips.forEach((c) => c.addEventListener('click', () => apply(c.dataset.filter)));
  window.azGalleryFilter = apply;
  if (num) num.textContent = String(all.length);

  // open lightbox
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lb]');
    if (!btn) return;
    const visible = all.filter((el) => !el.hidden);
    const list = visible.map((el) => fromButton($('[data-lb]', el)));
    const i = visible.indexOf(btn.closest('.gal__item'));
    openViewer(list, Math.max(0, i), btn);
  });
}

function fromButton(btn) {
  const img = $('img', btn);
  return { set: img.dataset.set, widths: img.dataset.w.split(',').map(Number), alt: img.alt, caption: btn.dataset.caption || img.alt };
}

/* ---------- lightbox ---------- */
function srcsetFor(it) {
  return it.widths.map((w) => `assets/images/${it.set}-${w}.webp ${w}w`).join(', ');
}

function openViewer(list, i = 0, from = null, opts = {}) {
  if (!lb || lb.open) return;
  items = list; index = i; trigger = from || document.activeElement;
  lb.classList.toggle('lb--plan', !!opts.plan);
  $('[data-lb-total]', lb).textContent = String(items.length);
  const multi = items.length > 1;
  $('[data-lb-prev]', lb).hidden = !multi;
  $('[data-lb-next]', lb).hidden = !multi;
  $('.lb__count', lb).hidden = !multi;
  $('[data-lb-fs]', lb).hidden = !document.fullscreenEnabled;
  lb.showModal();
  lockScroll();
  render(0, true);
  requestAnimationFrame(() => lb.classList.add('is-open'));
  $('[data-lb-close]', lb).focus({ preventScroll: true });
}

function closeViewer() {
  if (!lb.open) return;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  lb.classList.remove('is-open');
  const done = () => { lb.close(); unlockScroll(); trigger && trigger.focus && trigger.focus({ preventScroll: true }); };
  setTimeout(done, prefersReduced() ? 0 : 380);
}

function render(dir = 0, first = false) {
  const { gsap } = window;
  const img = $('[data-lb-img]', lb);
  const it = items[index];
  $('[data-lb-cur]', lb).textContent = String(index + 1);
  $('[data-lb-cap]', lb).textContent = it.caption || '';

  const apply = () => new Promise((res) => {
    img.alt = it.alt || '';
    if (it.src) { img.removeAttribute('srcset'); img.src = it.src; } else {
      img.sizes = '(min-width: 1024px) 92vw, 100vw';
      img.srcset = srcsetFor(it);
      img.src = `assets/images/${it.set}-${it.widths[Math.min(3, it.widths.length - 1)]}.webp`;
    }
    // never let a slow/stalled decode wedge the viewer: give it 1.4s then show regardless
    waitFor(img.decode ? img.decode().catch(() => {}) : Promise.resolve(), 1400).then(res);
  });

  const preload = (n) => { const o = items[(index + n + items.length) % items.length]; if (!o || o.src) return; const p = new Image(); p.srcset = srcsetFor(o); p.sizes = '92vw'; p.src = `assets/images/${o.set}-1600.webp`; };

  if (!gsap || prefersReduced() || first) {
    apply().then(() => { gsap && gsap.fromTo(img, { opacity: 0, y: first ? 24 : 0 }, { opacity: 1, y: 0, duration: first ? 0.9 : 0.01, ease: 'expo.out', delay: first ? 0.2 : 0 }); if (!gsap) img.style.opacity = 1; preload(1); preload(-1); });
    return;
  }
  busy = true;
  gsap.to(img, {
    x: -60 * dir, opacity: 0, duration: 0.32, ease: 'power2.in',
    onComplete: () => apply().then(() => {
      gsap.fromTo(img, { x: 60 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, ease: 'expo.out', onComplete: () => { busy = false; } });
      preload(1); preload(-1);
    }),
  });
}

function go(dir) {
  if (busy || items.length < 2) return;
  index = (index + dir + items.length) % items.length;
  render(dir);
}

function initLightbox() {
  if (!lb) return;
  $('[data-lb-close]', lb).addEventListener('click', closeViewer);
  $('[data-lb-prev]', lb).addEventListener('click', () => go(-1));
  $('[data-lb-next]', lb).addEventListener('click', () => go(1));
  $('[data-lb-fs]', lb).addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen(); else lb.requestFullscreen && lb.requestFullscreen().catch(() => {});
  });
  lb.addEventListener('cancel', (e) => { e.preventDefault(); closeViewer(); });
  lb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
  });
  // click on the dark area (not the image / controls) closes
  $('[data-lb-stage]', lb).addEventListener('click', (e) => { if (e.target.matches('[data-lb-stage], [data-lb-fig]')) closeViewer(); });

  // swipe / drag with live finger tracking
  const stage = $('[data-lb-stage]', lb);
  const img = $('[data-lb-img]', lb);
  let sx = 0; let sy = 0; let dx = 0; let tracking = false; let dragging = false;
  stage.addEventListener('pointerdown', (e) => { if (busy || e.target.closest('button')) return; tracking = true; dragging = false; sx = e.clientX; sy = e.clientY; dx = 0; });
  stage.addEventListener('pointermove', (e) => {
    if (!tracking) return;
    const mx = e.clientX - sx; const my = e.clientY - sy;
    if (!dragging && Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) { dragging = true; stage.setPointerCapture(e.pointerId); }
    if (dragging) { dx = mx; window.gsap ? window.gsap.set(img, { x: dx * 0.9, opacity: 1 - Math.min(0.45, Math.abs(dx) / 500) }) : null; }
  });
  const end = () => {
    if (!tracking) return;
    tracking = false;
    if (dragging && Math.abs(dx) > 70) { window.gsap && window.gsap.set(img, { x: 0 }); go(dx < 0 ? 1 : -1); }
    else if (dragging && window.gsap) window.gsap.to(img, { x: 0, opacity: 1, duration: 0.5, ease: 'expo.out' });
    dragging = false;
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
}

/* floor-plan "view larger" uses the same viewer */
export function openPlanViewer(src, alt, caption, from) {
  openViewer([{ src, alt, caption }], 0, from, { plan: true });
}

export { pad2 };
