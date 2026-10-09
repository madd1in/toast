# Renderings einer Figur (art/render/<name>/) eng zuschneiden, in einen Atlas packen und Ankerpunkte in
# Spiel-Einheiten umrechnen. Aufruf aus dem Repo-Ordner:  python art/blender/figur_post.py hoagie
# Schreibt img/figuren/<name>.png (256 Farben) und art/render/<name>_sprite.json (für figur_js.py).
import json, os, sys
import numpy as np
from PIL import Image

NAME = sys.argv[1]
# Spielhöhe h für den Scheitel bei top Metern (240 px pro Meter gerendert); welche Bilder die Figur braucht
CFG = {
    'bernard': dict(top=2.05, h=214, skip=[]),
    'hoagie': dict(top=1.72, h=186, skip=['climb0', 'climb1', 'climb2', 'climb3', 'glasses', 'yawn']),
    'laverne': dict(top=1.96, h=212, skip=['dig0', 'dig1', 'rope0', 'rope1', 'airguitar0', 'airguitar1', 'belly0', 'belly1', 'pour', 'glasses']),
    # Nebenfiguren: Scheitel (mit Haarbüscheln, Haube, Dreispitz) auf die Höhe der gezeichneten Figur
    'drfred': dict(top=2.041, h=180, skip=[]),
    'gertrude': dict(top=1.84, h=190, skip=[]),
    'hancock': dict(top=1.91, h=202, skip=[]),
    # Tentakel (tent_build.py): Kuppe bei 1,951 m auf die Scheitelhöhe der gezeichneten Tentakel
    'green': dict(top=1.951, h=157, skip=[]),
    'lila': dict(top=1.951, h=177, skip=[]),
    'nett': dict(top=1.951, h=177, skip=[]),
    'guard': dict(top=1.951, h=170, skip=[]),
    # Laverne im Tentakel-Kostüm (kostuem_build.py): Kuppe bei 2,01 m, etwas größer als Laverne selbst
    'kostuem': dict(top=2.01, h=214, skip=[]),
    # Bobbin: Kapuze bei 2,02 m; der Spinnstab ragt darüber hinaus und zählt nicht für die Größe
    'bobbin': dict(top=2.02, h=206, skip=[]),
}.get(NAME)   # Crossover-Gäste (gaeste_build.py): Scheitel aus meta.json, 104 Spiel-Einheiten pro Meter wie bei Bernard
CONTRAST, SATUR = 1.18, 1.25   # Raumlicht und Papierstruktur im Spiel legen sich darüber und machen die Figur sonst blass
SRC = f'art/render/{NAME}/'
meta = json.load(open(SRC + 'meta.json'))
CFG = CFG or dict(top=meta['top'], h=round(meta['top'] * 104), skip=[])
UPP = round(CFG['h'] / (CFG['top'] * meta['ppm']), 4)   # Spiel-Einheiten pro Bildpixel
crops = []
for f in meta['frames']:
    if f['name'] in CFG['skip']:
        continue
    im = Image.open(SRC + f['name'] + '.png').convert('RGBA')
    a = np.array(im)[..., 3]
    ys, xs = np.where(a > 6)
    x0, y0, x1, y1 = max(0, xs.min() - 2), max(0, ys.min() - 2), xs.max() + 3, ys.max() + 3
    crops.append((f, im.crop((x0, y0, x1, y1)), x0, y0))
# Regal-Packung: Reihen von links nach rechts, Atlasbreite 2048
AW, x, y, rowh, place = 2048, 0, 0, 0, []
for f, im, x0, y0 in crops:
    if x + im.width > AW:
        x, y, rowh = 0, y + rowh + 2, 0
    place.append((x, y))
    x += im.width + 2
    rowh = max(rowh, im.height)
atlas = Image.new('RGBA', (AW, y + rowh), (0, 0, 0, 0))
data = {}
r = lambda v: round(v * UPP, 1)
for (f, im, x0, y0), (px, py) in zip(crops, place):
    atlas.alpha_composite(im, (px, py))
    fx, fy = f['foot']
    rel = lambda p: [r(p[0] - fx), r(p[1] - fy)]
    # [x, y, w, h im Atlas, linke obere Ecke zum Fußpunkt, Mund, Auge vorn, Auge hinten, Hand] (Einheiten außer Atlas-Lage)
    data[f['name']] = [px, py, im.width, im.height, r(x0 - fx), r(y0 - fy), *rel(f['mouth']), *rel(f['eyes'][0]), *rel(f['eyes'][1]), *rel(f['hand'])]
arr = np.array(atlas).astype(np.float32)
rgb, al = arr[..., :3] / 255, arr[..., 3]
m = rgb[al > 128].mean()
rgb = (rgb - m) * CONTRAST + m
lum = rgb.mean(axis=2, keepdims=True)
rgb = np.clip(lum + (rgb - lum) * SATUR, 0, 1)
arr[..., :3] = rgb * 255
atlas = Image.fromarray(arr.round().astype(np.uint8), 'RGBA')
# Hautfarbe fürs Blinzeln: Wange im Stand-Bild (zwischen Auge und Ohr)
idle = next(c for c in zip(crops, place) if c[0][0]['name'] == 'idle')
(f, im, x0, y0), (px, py) = idle
ex, ey = f['eyes'][0]
sx, sy = int(px + ex - x0 - 0.07 * meta['ppm']), int(py + ey - y0 + 0.03 * meta['ppm'])
skin = '#%02x%02x%02x' % tuple(atlas.getpixel((sx, sy))[:3])
q = atlas.quantize(256, method=Image.Quantize.FASTOCTREE)
os.makedirs('img/figuren', exist_ok=True)
q.save(f'img/figuren/{NAME}.png', optimize=True)
json.dump({'upp': UPP, 'size': atlas.size, 'skin': skin, 'frames': data}, open(f'art/render/{NAME}_sprite.json', 'w'))
print(NAME, 'upp', UPP, 'atlas', atlas.size, os.path.getsize(f'img/figuren/{NAME}.png'), 'bytes, frames', len(data), 'skin', skin)
print('idle top (units above foot):', -data['idle'][5])
