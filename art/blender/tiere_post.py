# Tier-Renderings (art/render/katze|huhn|staubi/) zuschneiden, Comic-Kontur dazu, in einen Atlas packen und die Daten
# (Atlas-Lage, Fußpunkt, Anker) in js/figuren3d.js schreiben (Block // <tiere-daten>).
# Aufruf aus dem Repo-Ordner:  python art/blender/tiere_post.py
import io, json, os, re
import numpy as np
from PIL import Image, ImageFilter

# Spielname, Größe der gezeichneten Fassung: Scheitelhöhe ('h') oder Breite ('w') in Spiel-Einheiten
TIERE = {'katze': ('cat', 'h', 36), 'huhn': ('hen', 'h', 43), 'staubi': ('bot', 'w', 42)}
INK, RAD = (11, 3, 18), 5.5   # Tusche-Kontur wie bei den Figuren (#0b0312), Radius in Render-Pixeln
CONTRAST, SATUR = 1.12, 1.18


def outline(im, rad):
    a = np.array(im)[..., 3] > 110
    d = np.zeros_like(a)
    r = int(np.ceil(rad))
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= rad * rad:
                d |= np.roll(np.roll(a, dy, 0), dx, 1)
    ol = Image.fromarray((d * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    base = Image.new('RGBA', im.size, (*INK, 0))
    base.putalpha(ol)
    base.alpha_composite(im)
    return base


crops, data = [], {}
for name, (kind, dim, size) in TIERE.items():
    src = f'art/render/{name}/'
    meta = json.load(open(src + 'meta.json'))
    first = Image.open(src + meta['frames'][0]['name'] + '.png')
    bb = first.getbbox()
    # Spiel-Einheiten pro Bildpixel aus der Ruhehaltung: Höhe über dem Fuß bzw. Breite
    upp = size / ((meta['frames'][0]['foot'][1] - bb[1]) if dim == 'h' else (bb[2] - bb[0]))
    data[kind] = {'upp': round(upp, 4), 'f': {}}
    for f in meta['frames']:
        im = Image.open(src + f['name'] + '.png').convert('RGBA')
        pad = int(RAD) + 4
        big = Image.new('RGBA', (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
        big.alpha_composite(im, (pad, pad))
        o = outline(big, RAD)
        x0, y0, x1, y1 = o.getbbox()
        crops.append((kind, f, o.crop((x0, y0, x1, y1)), x0 - pad, y0 - pad))
# Regal-Packung in einen Atlas (Breite 1024)
AW, x, y, rowh, place = 1024, 0, 0, 0, []
for c in crops:
    im = c[2]
    if x + im.width > AW:
        x, y, rowh = 0, y + rowh + 2, 0
    place.append((x, y))
    x += im.width + 2
    rowh = max(rowh, im.height)
atlas = Image.new('RGBA', (AW, y + rowh), (0, 0, 0, 0))
for (kind, f, im, x0, y0), (px, py) in zip(crops, place):
    atlas.alpha_composite(im, (px, py))
    u = data[kind]['upp']
    fx, fy = f['foot']
    r = lambda v: round(v * u, 1)
    # [x, y, w, h im Atlas, linke obere Ecke relativ zum Fußpunkt, Anker (Kopf bzw. Leuchte)] – alles außer der Atlas-Lage in Spiel-Einheiten
    data[kind]['f'][f['name']] = [px, py, im.width, im.height, r(x0 - fx), r(y0 - fy), r(f['anchor'][0] - fx), r(f['anchor'][1] - fy)]
arr = np.array(atlas).astype(np.float32)
rgb, al = arr[..., :3] / 255, arr[..., 3]
m = rgb[al > 128].mean()
rgb = (rgb - m) * CONTRAST + m
lum = rgb.mean(axis=2, keepdims=True)
arr[..., :3] = np.clip(lum + (rgb - lum) * SATUR, 0, 1) * 255
atlas = Image.fromarray(arr.round().astype(np.uint8), 'RGBA').quantize(256, method=Image.Quantize.FASTOCTREE)
atlas.save('img/figuren/tiere.png', optimize=True)
rows = []
for kind, d in data.items():
    fr = ',\n'.join(f'    {k}: {json.dumps(v, separators=(",", ":"))}' for k, v in d['f'].items())
    rows.append(f"  {kind}: {{ upp: {d['upp']}, f: {{\n{fr},\n  }} }},")
block = "// <tiere-daten> (erzeugt von art/blender/tiere_post.py)\nconst TIER3D = { src: 'img/figuren/tiere.png',\n" + '\n'.join(rows) + '\n};\n// </tiere-daten>\n'
p = 'js/figuren3d.js'
s = io.open(p, encoding='utf-8').read()
if '// <tiere-daten>' in s:
    s = re.sub(r'// <tiere-daten>.*?// </tiere-daten>\n', lambda m: block, s, flags=re.S)
else:
    s += '\n' + block
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('atlas', atlas.size, os.path.getsize('img/figuren/tiere.png'), 'bytes;', {k: (d['upp'], len(d['f'])) for k, d in data.items()})
