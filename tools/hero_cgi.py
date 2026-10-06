"""Layered hero built from two supplied renders (never cropped: the whole villa stays in frame):
    tools/originals/hero-desktop-src.png   landscape
    tools/originals/hero-mobile-src.png    portrait
Layers (all share one canvas, so they can drift at different speeds without ghosting):
    sky    →  clouds  →  [ HTML title ]  →  house  →  foreground
 sky     clean sky (clouds + building painted out)
 clouds  the real cirrus wisps of the render, extracted as a transparent layer
 house   villa + garden, sky transparent
 fore    lawn / planting in front of the villa
Run:  python tools/hero_cgi.py && python tools/hero_images.py && python tools/build.py"""
import json, os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'originals')


def smoothstep(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def _box(arr, r, axis):
    n = arr.shape[axis]
    pad = [(0, 0)] * arr.ndim
    pad[axis] = (r + 1, r)
    c = np.cumsum(np.pad(arr, pad, mode='edge'), axis=axis, dtype=np.float64)
    hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return ((hi - lo) / (2 * r + 1)).astype(np.float32)


def blur_f(arr, sigma):
    """approximate gaussian blur of a float 2-D array (3 box passes per axis)"""
    r = max(1, int(round(sigma * 0.9)))
    out = arr.astype(np.float32)
    for _ in range(3):
        out = _box(_box(out, r, 0), r, 1)
    return out


def extend_bottom(arr, pb, blur=10):
    """grow an RGB canvas downward: last rows dissolve into a blurred, slightly darker lawn texture (no seam)"""
    if not pb:
        return arr
    n = min(240, arr.shape[0] // 4)
    tail = arr[-n:].astype(np.float32)
    blurred = np.asarray(Image.fromarray(arr[-n:]).filter(ImageFilter.GaussianBlur(blur))).astype(np.float32)
    t = smoothstep(np.linspace(0, 1, n), 0.0, 1.0)[:, None, None]
    arr = arr.copy()
    arr[-n:] = (tail * (1 - t) + blurred * t).astype(np.uint8)
    src_tail = blurred[::-1]
    reps = int(np.ceil(pb / n))
    ext = np.concatenate([src_tail if i % 2 == 0 else src_tail[::-1] for i in range(reps)], 0)[:pb]
    ext = np.clip(ext * np.linspace(1.0, 0.7, pb)[:, None, None], 0, 255).astype(np.uint8)
    return np.concatenate([arr, ext], 0)


def open_sky_region(key, step=4):
    """flood-fill from the top edge through sky-coloured pixels: reflections inside windows are NOT open sky"""
    H, W = key.shape
    small = np.asarray(Image.fromarray((key * 255).astype(np.uint8)).resize((W // step, H // step), Image.BILINEAR)) > 120
    h, w = small.shape
    seen = np.zeros((h, w), bool)
    stack = [(0, x) for x in range(w) if small[0, x]]
    for y, x in stack:
        seen[y, x] = True
    while stack:
        y, x = stack.pop()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and small[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                stack.append((ny, nx))
    reg = Image.fromarray((seen * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR).filter(ImageFilter.MaxFilter(2 * step + 1))
    return np.asarray(reg.filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255


def build(path, scale, pad, pb, horizon, fore_y, seed):
    src = Image.open(path).convert('RGB')
    U = src.resize((round(src.width * scale), round(src.height * scale)), Image.LANCZOS)
    U = U.filter(ImageFilter.UnsharpMask(radius=1.4, percent=45, threshold=2))
    a = np.asarray(U).astype(np.float32)
    H, W = a.shape[:2]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]

    # ---- sky key (vivid blue), only above the horizon
    key = smoothstep(b - r, 38, 72)
    sky_rows = int(horizon * H)
    key[sky_rows:] = 0
    key = np.asarray(Image.fromarray((key * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255
    key = key * open_sky_region(key)

    # ---- clean sky colour: row profile (wisp-proof median) + smooth horizontal variation, continued under the building
    valid = key > 0.92
    prof = np.zeros((H, 3), np.float32)
    for i in range(H):
        px = a[i][valid[i]]
        prof[i] = np.median(px, 0) if len(px) > 20 else (prof[i - 1] if i else a[0].mean(0))
    k = 61
    prof = np.stack([np.convolve(np.pad(prof[:, c], (k // 2, k // 2), mode='edge'), np.ones(k) / k, mode='valid') for c in range(3)], 1)
    # wisp alpha = how much lighter than the clean profile (red channel carries it)
    d = r - prof[:, 0][:, None]
    wisp = smoothstep(d, 14, 105) * key
    # horizontal tint: low-frequency colour of the real sky minus the row profile
    cm = ((key > 0.92) & (wisp < 0.04)).astype(np.float32)
    tint = np.zeros((H, W, 3), np.float32)
    s_blur = max(30, W // 18)
    den = blur_f(cm, s_blur) + 1e-4
    for c in range(3):
        num = blur_f((a[..., c] - prof[:, c][:, None]) * cm, s_blur)
        tint[..., c] = num / den
    tint *= (den > 0.02)[..., None]
    tint = np.clip(tint, -25, 25)
    sky_core = prof[:, None, :] + tint

    below = prof[min(H - 1, H // 6):min(H - 1, H // 6) + 25].mean(0)
    top = prof[:25].mean(0)
    deeper = np.clip((top - below) / (H // 6), -0.25, 0.25)           # a natural, gentle deepening of the blue going up
    base = sky_core[0]                                                  # continue each column exactly where the real sky starts
    dist = np.minimum(pad - np.arange(pad), 520)[:, None, None].astype(np.float32)
    ext_img = base[None, :, :] + deeper[None, None, :] * dist * 0.6 if pad else np.zeros((0, W, 3), np.float32)
    sky = np.concatenate([ext_img, sky_core], 0)
    rng = np.random.default_rng(seed)
    sky = np.clip(sky + rng.normal(0, 0.5, sky.shape), 0, 255)
    if pb:
        sky = np.concatenate([sky, np.broadcast_to(sky[-1:], (pb, W, 3))], 0)
    sky_img = Image.fromarray(sky.astype(np.uint8))

    # ---- clouds: the render's own wisps
    ca = np.concatenate([np.zeros((pad, W), np.float32), wisp, np.zeros((pb, W), np.float32)], 0)
    ca = np.clip(ca * 1.05, 0, 1)
    crgb = np.empty((H + pad + pb, W, 3), np.float32)
    crgb[...] = np.array([244, 249, 255], np.float32)
    clouds_img = Image.fromarray(np.dstack([crgb, ca * 255]).astype(np.uint8), 'RGBA')

    # ---- house + foreground
    full = np.concatenate([np.broadcast_to(a[:1], (pad, W, 3)), a], 0).astype(np.uint8)
    full = extend_bottom(full, pb)
    house_alpha = np.concatenate([np.zeros((pad, W), np.float32), 1 - key, np.ones((pb, W), np.float32)], 0)
    house = Image.fromarray(full).convert('RGBA')
    house.putalpha(Image.fromarray((house_alpha * 255).astype(np.uint8)))
    fy = int(fore_y * H) + pad
    yy = np.arange(H + pad + pb)[:, None]
    fa = smoothstep(yy, fy - 0.012 * H, fy + 0.006 * H) * np.ones((1, W), np.float32)
    fore = Image.fromarray(full).convert('RGBA')
    fore.putalpha(Image.fromarray((fa * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)))

    cover = (key < 0.5).mean(1)
    roof = int(np.argmax(cover[:max(sky_rows, 1)] > 0.15))
    meta = {'w': W, 'h': H + pad + pb, 'roof': pad + roof, 'terrace': fy}
    return {'sky': sky_img, 'clouds': clouds_img, 'house': house, 'fore': fore}, meta


# desktop landscape: scale the 1672px render up to 2400, add sky above for the title
dl, dm = build(os.path.join(OUT, 'hero-desktop-src.png'), 2400 / 1672, 430, 0, 0.50, 0.70, 4)
for k, im in dl.items():
    im.save(f'{OUT}/hero_{k}.png')
# phone portrait: scale to ~1412 wide; sky above + lawn below so the width always fits the screen
ml, mm = build(os.path.join(OUT, 'hero-mobile-src.png'), 1.5, 300, 520, 0.62, 0.68, 9)
for k, im in ml.items():
    im.save(f'{OUT}/heroM_{k}.png')
json.dump({'desk': dm, 'mob': mm}, open(os.path.join(ROOT, 'tools', 'hero-meta.json'), 'w'), indent=1)
print('hero layers ok', dm, mm)
