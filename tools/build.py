"""Static multi-page builder (no framework).
  python tools/build.py      -> renders every src/*.template.html (+ partials, <picture> macros) to /<name>.html
Macros
  {{include name key="v" ...}}  -> src/partials/name.html ; inside it {{@key}} is replaced by the value
  {{site.key}}                  -> value from SITE below
  {{pic n="x" alt="..." ...}}   -> responsive <picture> (AVIF/WebP, srcset, sizes, width/height, blur-up background)
      n      image set name (assets/images/<n>-<w>.webp)    m   optional portrait set shown <600px
      sizes  sizes attr   cls  class on <picture>   load lazy|eager   prio 1 = fetchpriority high
      pos    object-position
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
META = json.load(open(os.path.join(ROOT, 'tools', 'image-meta.json')))

SITE = {
    'name': 'Azure Residences',
    'brand': 'Azure',
    'developer': 'Meridian Estates',
    'url': 'https://www.azureresidences.in',
    'phone': '+91 98765 43210',
    'phone_tel': '+919876543210',
    'whatsapp': '919876543210',
    'wa_text': "Hi, I'm interested in learning more about this property. Please share pricing and availability.",
    'wa_text_enc': 'Hi%2C%20I%27m%20interested%20in%20learning%20more%20about%20this%20property.%20Please%20share%20pricing%20and%20availability.',
    'email': 'hello@azureresidences.in',
    'address': 'Azure Experience Centre, Whitefield Main Road, Bengaluru 560066',
    'rera': 'PRM/KA/RERA/1251/309/PR/000000/000000',
    'endpoint': '',          # POST target for the lead form (leave empty for demo mode)
    'year': '2026',
}


_hm = os.path.join(ROOT, 'tools', 'hero-meta.json')
if os.path.exists(_hm):
    _h = json.load(open(_hm))
    SITE['hero_desk'] = '{w},{h},{roof},{terrace}'.format(**_h['desk'])
    SITE['hero_mob'] = '{w},{h},{roof}'.format(**_h['mob'])
else:
    SITE['hero_desk'] = '2400,1900,726,1532'
    SITE['hero_mob'] = '1440,2560,1386'


def srcset(name, ext, base='assets/images/'):
    m = META[name]
    return ', '.join(f'{base}{name}-{w}.{ext} {w}w' for w in m['widths'])


def pic(attrs):
    n = attrs['n']
    m = META[n]
    sizes = attrs.get('sizes', '100vw')
    mid = m['widths'][min(2, len(m['widths']) - 1)]
    w, h = m['ratio']
    load = attrs.get('load', 'lazy')
    cls = f' class="{attrs["cls"]}"' if attrs.get('cls') else ''
    bg = f' style="background-image:url(data:image/webp;base64,{m["lqip"]})"' if m.get('lqip') else ''
    out = [f'<picture{cls}{bg}>']
    if attrs.get('m'):
        mn = attrs['m']
        out.append(f'<source media="(max-width: 599px)" type="image/avif" srcset="{srcset(mn, "avif")}" sizes="100vw">')
        out.append(f'<source media="(max-width: 599px)" type="image/webp" srcset="{srcset(mn, "webp")}" sizes="100vw">')
    out.append(f'<source type="image/avif" srcset="{srcset(n, "avif")}" sizes="{sizes}">')
    out.append(f'<source type="image/webp" srcset="{srcset(n, "webp")}" sizes="{sizes}">')
    style = f' style="object-position:{attrs["pos"]}"' if attrs.get('pos') else ''
    pr = ' fetchpriority="high"' if attrs.get('prio') == '1' else ''
    alt = attrs.get('alt', '')
    wlist = ','.join(str(x) for x in m['widths'])
    out.append(f'<img src="assets/images/{n}-{mid}.webp" width="{w}" height="{h}" alt="{alt}" loading="{load}" decoding="async"{pr}{style} data-set="{n}" data-w="{wlist}" data-fallback>')
    out.append('</picture>')
    return ''.join(out)


def render(text):
    def inc(mo):
        name = mo.group(1)
        attrs = dict(re.findall(r'(\w+)="([^"]*)"', mo.group(2) or ''))
        body = open(os.path.join(SRC, 'partials', name + '.html'), encoding='utf8').read()
        body = re.sub(r'\{\{@(\w+)\}\}', lambda m2: attrs.get(m2.group(1), ''), body)
        return render(body)
    text = re.sub(r'\{\{include ([\w-]+)((?:\s+\w+="[^"]*")*)\s*\}\}', inc, text)
    text = re.sub(r'\{\{pic ([^}]+)\}\}', lambda mo: pic(dict(re.findall(r'(\w+)="([^"]*)"', mo.group(1)))), text)
    text = re.sub(r'\{\{site\.(\w+)\}\}', lambda mo: str(SITE[mo.group(1)]), text)
    return text


if __name__ == '__main__':
    for f in sorted(os.listdir(SRC)):
        if f.endswith('.template.html'):
            html = render(open(os.path.join(SRC, f), encoding='utf8').read())
            open(os.path.join(ROOT, f.replace('.template', '')), 'w', encoding='utf8').write(html)
            print('built', f)
