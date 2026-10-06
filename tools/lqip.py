"""Blur-up placeholders: tiny (28px) blurred WebP per image, base64 -> tools/image-meta.json ['lqip'].
Used by build.py as the <picture> background so image slots are never blank while loading.
Run after tools/images.py:  python tools/lqip.py"""
import base64, glob, io, json, os
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
meta_path = os.path.join(ROOT, 'tools', 'image-meta.json')
meta = json.load(open(meta_path))
for f in sorted(glob.glob(os.path.join(ROOT, 'tools', 'originals', '*.jpg'))):
    name = os.path.splitext(os.path.basename(f))[0]
    if name not in meta:
        continue
    im = Image.open(f).convert('RGB')
    im.thumbnail((28, 28))
    im = im.filter(ImageFilter.GaussianBlur(0.6))
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=40, method=6)
    meta[name]['lqip'] = base64.b64encode(buf.getvalue()).decode()
json.dump(meta, open(meta_path, 'w'), indent=1)
print('lqip for', sum(1 for v in meta.values() if 'lqip' in v), 'images')
