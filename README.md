# Azure Residences — premium real-estate website

Static, framework-free site: HTML5 · CSS3 · vanilla ES modules · **GSAP** (ScrollTrigger, SplitText, Flip) · **Lenis** · Google Maps embed (location page).
No build step is needed to *run* it; `tools/` is only used to regenerate images / HTML.

## Run locally
ES modules need http (not `file://`):
```bash
python -m http.server 5173      # then open http://localhost:5173
```
Responsive check at exact CSS widths: `http://localhost:5173/tools/device.html?w=375&h=812` (iframe harness).

## Structure
```
index · properties · details · about · amenities · gallery · location · contact · privacy · terms  (.html, generated from src/*.template.html — do not edit by hand)
src/index.template.html + src/partials/*.html   one partial per component
css/style.css (base) · responsive.css · animations.css · pages.css (theme + page components, loaded last)
js/main.js            entry, isolates each module
js/hero.js            anchors wordmark ↔ roofline, pointer depth (layer geometry from tools/hero-meta.json)
js/animations.js      GSAP/ScrollTrigger choreography (pins created first, in page order)
js/scroll.js          Lenis + GSAP ticker, scroll lock
js/navigation.js · forms.js · gallery.js · location.js · sections.js · cursor.js
assets/images         AVIF + WebP sets (480–2400w)   assets/plans   SVG floor plans   assets/vendor  local libs
tools/                images.py · hero_cgi.py · hero_images.py · lqip.py · plans.py · build.py · originals/ (source images)
```
Each page is `src/<page>.template.html` composed from partials. Page transitions (curtain) run between pages.
Edit content in `src/partials/*`, brand/contact data in `tools/build.py → SITE`, then:
```bash
python tools/build.py          # re-render HTML
python tools/images.py         # (only if photos change) rebuild responsive images
python tools/lqip.py           # blur-up placeholders so image slots are never blank
```

## Design system
* Display: **Outfit** (geometric sans, tight tracking) · UI/body: **Inter Tight**.
* Palette (`:root` in style.css): deep blue `#0a1f44`, royal `#0f3d91`, action blue `#1d6bf3`, sky `#86c1ff`, sky-soft `#e8f3ff`, white. Radius 16/24px, pill buttons.
* Readability rules: white type only over darkened/graded areas (scrims, gradient sky); dark type on light surfaces.

## Hero depth
Five layers (sky, clouds, **title**, house, foreground) are generated from `tools/originals/hero-desktop-src.png` and `hero-mobile-src.png`
by `python tools/hero_cgi.py && python tools/hero_images.py && python tools/build.py`. Clouds are the render's own wisps; only sky connected to
the open sky becomes transparent, so window reflections stay solid. Desktop: the hero pins, the title sinks behind the villa, the wordmark band
then grows full width. Phones: one flat image, no pin, no parallax.

## Connecting the lead form
Set `SITE['endpoint']` in `tools/build.py` and rebuild. The form POSTs JSON; with no endpoint it runs in **demo mode**
(logs payload, shows success; `?simulate=fail` / `?simulate=ratelimit` exercise error states).
Anti-spam on the client: honeypot (`company_website`), minimum fill time, cooldown. **Production must also validate and rate-limit
server-side** — see `server/enquiry.example.mjs`.

## Placeholders to replace
Brand, phone/email/WhatsApp, address, RERA number, prices, areas, awards/testimonials and map landmarks are sample content.
Photography is from Unsplash (free licence) — keep attribution/licence records with your assets, or swap in your own and rerun `tools/images.py`.

## Quality notes
Reduced-motion: no Lenis, no scroll choreography, content visible. `anim-failsafe` class reveals everything if JS animation fails.
Only transform/opacity/clip-path are animated. Images: AVIF/WebP, `srcset/sizes`, intrinsic width/height, lazy below the fold, hero preloaded.
