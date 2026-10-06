/* Custom cursor bubble ("View" / "Drag") — fine pointers only, never on touch, never with reduced motion. */
import { $, mqFine, prefersReduced } from './utils.js';

export function initCursor() {
  const { gsap } = window;
  const el = $('[data-cursor-el]');
  if (!gsap || !el || !mqFine.matches || prefersReduced()) return;

  document.body.classList.add('has-cursor');
  const label = $('[data-cursor-label]', el);
  const x = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' });
  const y = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' });
  let on = false;

  window.addEventListener('pointermove', (e) => { x(e.clientX); y(e.clientY); }, { passive: true });

  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest && e.target.closest('[data-cursor]');
    if (t) {
      // let real controls inside the zone (buttons, links) use the normal pointer
      const control = e.target.closest('button, a, input, select, textarea');
      if (control && !control.matches('.gal__btn, .showcase__viewport')) return setOn(false);
      label.textContent = t.dataset.cursor;
      setOn(true);
    } else setOn(false);
  });
  document.addEventListener('pointerleave', () => setOn(false));
  window.addEventListener('blur', () => setOn(false));

  function setOn(v) {
    if (v === on) return;
    on = v;
    document.body.classList.toggle('cursor-on', v);
  }
}
