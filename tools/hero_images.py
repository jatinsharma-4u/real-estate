"""Turns tools/originals/hero_*.png + heroM_*.png into the responsive AVIF/WebP sets (and og-image).
   python tools/hero_images.py"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import images

images.do_hero()
mp = os.path.join(images.ROOT, 'tools', 'image-meta.json')
old = json.load(open(mp))
for k in [k for k in old if k.startswith('hero')]:
    del old[k]
old.update(images.meta)
json.dump(old, open(mp, 'w'), indent=1)
print('hero sets:', {k: v['widths'] for k, v in old.items() if k.startswith('hero')})
