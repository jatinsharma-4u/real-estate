/* Location: embedded Google map (route preview) tied to the "nearby places" list.
   An illustrative base map sits underneath, so the area is never empty while the live map loads. */
import { $, $$ } from './utils.js';

export function initLocation() {
  const root = $('[data-location]');
  if (!root) return;
  const lat = parseFloat(root.dataset.lat);
  const lng = parseFloat(root.dataset.lng);
  const wrap = $('[data-map-wrap]', root);
  const frame = $('[data-map-frame]', root);
  const label = $('[data-map-label-text]', root);
  const places = $$('.place', root);
  const chips = $$('[data-cat]', $('[data-loc-filters]', root));

  const home = `https://maps.google.com/maps?q=${lat},${lng}&z=14&output=embed`;
  const route = (p) => `https://maps.google.com/maps?saddr=${lat},${lng}&daddr=${p.dataset.lat},${p.dataset.lng}&output=embed`;

  function show(src, text) {
    if (frame.getAttribute('src') !== src) frame.setAttribute('src', src);
    label.textContent = text;
  }

  chips.forEach((chip) => chip.addEventListener('click', () => {
    const cat = chip.dataset.cat;
    chips.forEach((c) => { const on = c === chip; c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    const { gsap } = window;
    places.forEach((p) => { p.hidden = !(cat === 'all' || p.dataset.cat === cat); });
    if (gsap) gsap.fromTo(places.filter((p) => !p.hidden), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.05, ease: 'expo.out', clearProps: 'transform,opacity,visibility' });
    places.forEach((p) => p.classList.remove('is-active'));
    show(home, 'Azure Residences');
  }));

  places.forEach((p) => $('button', p).addEventListener('click', () => {
    places.forEach((x) => x.classList.toggle('is-active', x === p));
    show(route(p), `Azure Residences → ${p.dataset.name}`);
    wrap.classList.add('is-routed');
  }));

  // the iframe would otherwise trap page scrolling: it becomes interactive only after a click / tap
  const unlock = $('[data-map-unlock]', wrap);
  unlock.addEventListener('click', () => wrap.classList.remove('is-locked'));
  wrap.addEventListener('mouseleave', () => wrap.classList.add('is-locked'));
  frame.addEventListener('load', () => wrap.classList.add('is-ready'));
}
