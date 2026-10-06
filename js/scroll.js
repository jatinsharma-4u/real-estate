/* Smooth scrolling (Lenis) wired into GSAP's ticker so ScrollTrigger and Lenis share one clock. */
import { prefersReduced } from './utils.js';

export const scroller = { lenis: null, locks: 0 };

export function initSmoothScroll() {
  const { Lenis, gsap, ScrollTrigger } = window;
  if (prefersReduced() || !Lenis) return null;

  const lenis = new Lenis({
    lerp: 0.07,                         // continuous smoothing: silky, still responsive
    smoothWheel: true,
    wheelMultiplier: 1,
    syncTouch: false,                    // touch devices keep their natural native momentum
    touchMultiplier: 1,
    anchors: false,                      // we handle in-page links ourselves (offsets, menu, hash)
  });
  scroller.lenis = lenis;

  if (gsap && ScrollTrigger) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  return lenis;
}

export function scrollToTarget(target, { offset = 0, duration = 1.5, immediate = false } = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  if (scroller.lenis) {
    // absolute target from the *native* scroll position: Lenis' cached value can be stale after the page height changed
    const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY + offset);
    scroller.lenis.resize && scroller.lenis.resize();
    scroller.lenis.scrollTo(y, { duration, immediate, easing: (t) => 1 - Math.pow(1 - t, 4) });
  } else {
    const top = el.getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo({ top, behavior: prefersReduced() || immediate ? 'auto' : 'smooth' });
  }
}

/** Reference-counted scroll lock for menu / modal / lightbox. */
export function lockScroll() {
  scroller.locks += 1;
  if (scroller.locks === 1) {
    scroller.lenis && scroller.lenis.stop();
    document.documentElement.classList.add('is-locked');
  }
}
export function unlockScroll() {
  scroller.locks = Math.max(0, scroller.locks - 1);
  if (scroller.locks === 0) {
    scroller.lenis && scroller.lenis.start();
    document.documentElement.classList.remove('is-locked');
  }
}
