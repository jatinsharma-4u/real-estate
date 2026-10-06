"""Generates clean architectural-style floor-plan SVGs (blue line work) -> assets/plans/"""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'plans'); os.makedirs(OUT, exist_ok=True)
INK, BLUE, SKY, MIST = '#071633', '#1F5BE0', '#DCEEFF', '#F2F7FD'

def room(x, y, w, h, label, dim, fill=MIST, lab_dy=0):
    cx, cy = x + w / 2, y + h / 2 + lab_dy
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" stroke="{INK}" stroke-width="3"/>'
            f'<text x="{cx}" y="{cy-4}" text-anchor="middle" class="l">{label}</text>'
            f'<text x="{cx}" y="{cy+16}" text-anchor="middle" class="d">{dim}</text>')

def door(x, y, r=26, flip=False, vertical=False):
    if vertical:
        return f'<path d="M{x} {y} v{r} a{r} {r} 0 0 {0 if flip else 1} {r if not flip else -r} {-r}" fill="none" stroke="{BLUE}" stroke-width="1.6"/>'
    return f'<path d="M{x} {y} h{r} a{r} {r} 0 0 {1 if flip else 0} {-r} {r}" fill="none" stroke="{BLUE}" stroke-width="1.6"/>'

def wrap(title, body, w=800, h=600):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{title}">'
            f'<style>.l{{font:600 15px Inter,Arial,sans-serif;fill:{INK}}}.d{{font:400 12.5px Inter,Arial,sans-serif;fill:#4C5B78}}'
            f'.t{{font:500 12px Inter,Arial,sans-serif;fill:{BLUE};letter-spacing:.16em}}</style>'
            f'<rect width="{w}" height="{h}" fill="#fff"/>{body}'
            f'<g transform="translate({w-70},{h-52})" fill="none" stroke="{INK}" stroke-width="1.5"><circle r="16"/><path d="M0-16v32M-16 0h32" stroke-width="1"/><path d="M0-16l5 11h-10z" fill="{INK}"/></g>'
            f'<text x="32" y="{h-26}" class="t">{title.upper()}</text></svg>')

def balcony(x, y, w, h, lab='Balcony'):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{SKY}" stroke="{INK}" stroke-width="2" stroke-dasharray="6 4"/>'
            f'<text x="{x+w/2}" y="{y+h/2+5}" text-anchor="middle" class="d">{lab}</text>')

def bath(x, y, w, h):
    return room(x, y, w, h, 'Bath', '', fill=SKY, lab_dy=-4)

def plan2():
    b = ''
    b += room(60, 70, 330, 250, 'Living & dining', "22′ × 14′")
    b += room(390, 70, 170, 150, 'Kitchen', "10′ × 9′")
    b += room(560, 70, 170, 150, 'Utility', "6′ × 8′", fill='#fff')
    b += room(390, 220, 170, 100, 'Foyer', '', fill='#fff')
    b += room(60, 320, 240, 190, 'Primary bedroom', "14′ × 12′")
    b += room(300, 320, 200, 190, 'Bedroom 2', "12′ × 11′")
    b += bath(500, 320, 110, 90) + bath(500, 410, 110, 100)
    b += room(610, 320, 120, 190, 'Passage', '', fill='#fff')
    b += balcony(60, 18, 330, 52)
    b += door(420, 320) + door(300, 360, vertical=True, flip=True) + door(500, 440, vertical=True)
    return wrap('2 BHK · The Courtyard · 1,250 sq. ft.', b)

def plan3():
    b = ''
    b += room(50, 70, 360, 230, 'Living & dining', "26′ × 15′")
    b += room(410, 70, 190, 140, 'Kitchen', "12′ × 10′")
    b += room(600, 70, 150, 140, 'Utility', "6′ × 8′", fill='#fff')
    b += room(410, 210, 340, 90, 'Foyer & passage', '', fill='#fff')
    b += room(50, 300, 230, 220, 'Primary bedroom', "16′ × 13′")
    b += room(280, 300, 190, 220, 'Bedroom 2', "13′ × 12′")
    b += room(470, 300, 190, 220, 'Bedroom 3', "13′ × 12′")
    b += bath(660, 300, 90, 110) + bath(660, 410, 90, 110)
    b += balcony(50, 16, 360, 54, 'Balcony 1') + balcony(600, 16, 150, 54, 'Balcony 2')
    b += door(300, 300) + door(480, 300, flip=True) + door(660, 340, vertical=True)
    return wrap('3 BHK · The Skyline · 1,780 sq. ft.', b)

def plan4():
    b = ''
    b += room(40, 80, 390, 220, 'Living & dining', "30′ × 17′")
    b += room(430, 80, 170, 130, 'Kitchen & pantry', "14′ × 11′")
    b += room(600, 80, 160, 130, 'Utility', '', fill='#fff')
    b += room(430, 210, 330, 90, 'Foyer & passage', '', fill='#fff')
    b += room(40, 300, 200, 230, 'Primary suite', "18′ × 14′")
    b += room(240, 300, 170, 230, 'Bedroom 2', "14′ × 12′")
    b += room(410, 300, 170, 230, 'Bedroom 3', "14′ × 12′")
    b += room(580, 300, 180, 230, 'Bedroom 4', "14′ × 12′")
    b += balcony(40, 18, 200, 62, 'Balcony 1') + balcony(240, 18, 190, 62, 'Balcony 2') + balcony(430, 18, 330, 62, 'Terrace')
    b += door(230, 300, flip=True) + door(400, 300, flip=True) + door(570, 300, flip=True)
    return wrap('4 BHK · The Terrace Penthouse · 2,520 sq. ft.', b)

for name, fn in (('plan-2bhk', plan2), ('plan-3bhk', plan3), ('plan-4bhk', plan4)):
    open(f'{OUT}/{name}.svg', 'w', encoding='utf8').write(fn())
open(f'{ROOT}/assets/icons/favicon.svg', 'w', encoding='utf8').write(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0B2A66"/><path d="M6 25 16 6l10 19h-4.4L16 14.6 10.4 25z" fill="#8EC8FF"/></svg>')
print('plans ok')
