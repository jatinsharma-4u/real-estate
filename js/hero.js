/* Home hero layout: anchors the villa's roofline and the giant wordmark to each other, so the title always
   sits *behind* the building (overlapping the roof by a controlled amount) at every viewport size,
   plus pointer-driven depth between the two layers. */
import { $, $$, debounce, mqFine, prefersReduced } from './utils.js';

// canvas geometry (px of the hero-*.avif/webp masters) comes from tools/hero-meta.json via data attributes
const parse = (str, keys) => Object.fromEntries(str.split(',').map((v, i) => [keys[i], Number(v)]));

export function initHeroLayout() {
  const hero = $('[data-hero]');
  if (!hero) return;
  const DESK = parse(hero.dataset.desk, ['w', 'h', 'roof', 'terrace']);
  const MOB = parse(hero.dataset.mob, ['w', 'h', 'roof']);
  const layers = $$('.hero__layer', hero);
  const word = $('.hero__word', hero);
  const text = $('.hero__word-text', hero);

  const measure = (fs) => { word.style.fontSize = `${fs}px`; return text.getBoundingClientRect().width; };

  function layout() {
    const W = hero.clientWidth;
    const H = hero.clientHeight;
    const mobile = window.innerWidth <= 599;
    const k = mobile ? MOB : DESK;
    let roofY;
    let s;

    if (mobile) {
      roofY = H * 0.40;
      s = Math.max(W / k.w, (H - roofY) / (k.h - k.roof));            // full width of the render, never cropped at the sides
    } else {
      s = (W / k.w) * 1.03;                               // slight overscan so pointer drift never exposes an edge
      // show the roof-to-terrace band of the villa, leaving enough sky above for the wordmark
      const fit = 0.95 * H - (k.terrace - k.roof) * s;
      roofY = Math.max(0.36 * H, Math.min(0.46 * H, fit));
      s = Math.max(s, (H - roofY) / (k.h - k.roof));      // always cover the bottom edge
    }
    const w = k.w * s;
    const h = k.h * s;
    const top = roofY - k.roof * s;
    layers.forEach((l) => {
      l.style.inset = 'auto';
      l.style.width = `${w}px`;
      l.style.height = `${h}px`;
      l.style.left = `${(W - w) / 2}px`;
      l.style.top = `${top}px`;
    });

    // wordmark: fit 88% of the width AND the sky above the roof; baseline tucked ~9% of an em behind the roof
    const navBottom = mobile ? 100 : 96;
    const byHeight = (roofY - navBottom) / 0.67;
    let fs = Math.max(48, byHeight);
    let wpx = measure(fs);
    const maxW = W * (mobile ? 0.84 : 0.62);
    if (wpx > maxW) fs *= maxW / wpx;
    fs = Math.max(48, Math.min(fs, byHeight));
    measure(fs);
    word.style.top = `${roofY - 0.745 * fs}px`;   // baseline sits ~3% of an em behind the roofline; scrolling sinks it further
    hero.style.setProperty('--roof', `${roofY}px`);
  }

  layout();
  window.addEventListener('resize', debounce(layout, 80));
  document.fonts && document.fonts.ready.then(layout);
  window.addEventListener('load', layout, { once: true });

  // pointer depth: every layer drifts by its own amount (back = little, front = more); the title sits in between
  const { gsap } = window;
  if (!gsap || !mqFine.matches || prefersReduced()) return;
  const amt = { sky: 6, clouds: 14, house: -10, fore: -26 };
  const movers = layers.map((l) => ({ q: gsap.quickTo(l, 'x', { duration: 1.2, ease: 'power3.out' }), k: amt[l.dataset.depth] || 0 }));
  const wx = gsap.quickTo(word, 'x', { duration: 1.3, ease: 'power3.out' });
  const wy = gsap.quickTo(text, 'y', { duration: 1.3, ease: 'power3.out' });
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    movers.forEach((m) => m.q(nx * m.k));
    wx(nx * 30);
    wy(ny * 14);
  });
  hero.addEventListener('pointerleave', () => { movers.forEach((m) => m.q(0)); wx(0); wy(0); });
}
