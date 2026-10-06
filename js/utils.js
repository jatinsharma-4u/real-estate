/* Shared helpers — no dependencies. */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
export const prefersReduced = () => mqReduced.matches;
export const mqFine = window.matchMedia('(hover: hover) and (pointer: fine)');
export const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const pad2 = (n) => String(n).padStart(2, '0');

export function debounce(fn, ms = 150) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function rafThrottle(fn) {
  let ticking = false;
  return (...a) => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; fn(...a); });
  };
}

export function log(...a) { if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') console.info('[azure]', ...a); }

/** Site-level config pulled from <body data-*> (single source of truth: tools/build.py SITE). */
export const site = (() => {
  const d = document.body.dataset;
  return {
    wa: d.wa || '',
    waText: d.waText || '',
    endpoint: d.endpoint || '',
    phone: d.phone || '',
  };
})();

export const waUrl = (text) => `https://wa.me/${site.wa}?text=${encodeURIComponent(text || site.waText)}`;

export function toast(msg, ms = 3800) {
  const el = $('[data-toast]');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('is-on'), ms);
}

export function waitFor(promise, ms) {
  return Promise.race([promise, new Promise((r) => setTimeout(r, ms))]);
}
