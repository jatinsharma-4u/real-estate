/* Entry point. Each module is isolated: one failing module never takes the page down. */
import { prefersReduced, log } from './utils.js';
import { initSmoothScroll } from './scroll.js';
import { initAnimations } from './animations.js';
import { initNavigation } from './navigation.js';
import { initForms } from './forms.js';
import { initGallery } from './gallery.js';
import { initLocation } from './location.js';
import { initSections } from './sections.js';
import { initCursor } from './cursor.js';
import { initHeroLayout } from './hero.js';

const safe = (name, fn) => { try { return fn(); } catch (e) { console.error(`[azure] ${name} failed`, e); } };

async function boot() {
  const reduced = prefersReduced();
  document.documentElement.classList.toggle('reduced', reduced);

  // Interaction layer first (works with or without motion)
  safe('sections', initSections);
  safe('forms', initForms);
  safe('gallery', initGallery);
  safe('location', initLocation);
  safe('navigation', initNavigation);
  safe('cursor', initCursor);
  safe('hero-layout', initHeroLayout);

  // Motion layer: Lenis + GSAP
  safe('smooth-scroll', initSmoothScroll);
  try {
    await initAnimations({ reduced });
    clearTimeout(window.__azFail);
    log('animations ready');
  } catch (e) {
    console.error('[azure] animations failed, revealing content', e);
    document.documentElement.classList.add('anim-failsafe');
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
