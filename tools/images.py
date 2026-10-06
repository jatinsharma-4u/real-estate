"""Image pipeline: tools/originals/*.jpg -> assets/images/<name>-<w>.{avif,webp}
Run:  python tools/images.py
Also builds the hero layer sets (desktop + portrait mobile) from hero_bg/hero_fg.png
"""
import glob, json, os, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'originals')
OUT = os.path.join(ROOT, 'assets', 'images')
os.makedirs(OUT, exist_ok=True)
WIDTHS = [480, 800, 1200, 1600, 2000]
meta = {}

def save_set(im, name, widths, alpha=False, hq=False):
    jobs = []
    W, H = im.size
    for w in widths:
        if w > W: w = W
        h = round(H * w / W)
        r = im.resize((w, h), Image.LANCZOS)
        jobs.append((r, w))
    seen = set(); out = []
    for r, w in jobs:
        if w in seen: continue
        seen.add(w); out.append(w)
        r.save(f'{OUT}/{name}-{w}.webp', 'WEBP', quality=(92 if hq else (82 if not alpha else 88)), method=6)
        r.save(f'{OUT}/{name}-{w}.avif', 'AVIF', quality=(72 if hq else (52 if not alpha else 70)), speed=7)
    meta[name] = {'widths': out, 'ratio': [W, H]}

def do_jpg(f):
    name = os.path.splitext(os.path.basename(f))[0]
    im = Image.open(f).convert('RGB')
    save_set(im, name, WIDTHS)

def do_hero():
    """sky / clouds / house / fore layers (desktop landscape + phone portrait)"""
    for prefix, name, widths in (('hero', 'hero', [1280, 1920, 2400]), ('heroM', 'hero-m', [640, 900, 1200, 1412])):
        for k in ('sky', 'clouds', 'house', 'fore'):
            im = Image.open(f'{SRC}/{prefix}_{k}.png')
            if k == 'sky':
                save_set(im.convert('RGB'), f'{name}-{k}', widths, hq=True)
            else:
                save_set(im.convert('RGBA'), f'{name}-{k}', widths, alpha=True, hq=True)
    # social image: composite of the desktop layers
    L = [Image.open(f'{SRC}/hero_{k}.png').convert('RGBA') for k in ('sky', 'clouds', 'house', 'fore')]
    c = L[0]
    for l in L[1:]:
        c = Image.alpha_composite(c, l)
    c = c.convert('RGB')
    w, h = c.size
    c.crop((0, 0, w, round(w * 630 / 1200))).resize((1200, 630), Image.LANCZOS).save(f'{ROOT}/assets/images/og-image.jpg', quality=84)


if __name__ == '__main__':
    files = sorted(glob.glob(f'{SRC}/*.jpg'))
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(do_jpg, files))
    do_hero()
    json.dump(meta, open(f'{ROOT}/tools/image-meta.json', 'w'), indent=1)
    print('done', len(meta), 'sets')
