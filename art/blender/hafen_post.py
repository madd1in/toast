# Hafen-Ebenen (art/render/hafen/ aus raum_build.py) fürs Spiel aufbereiten: Hintergrund als JPG, Wolken und
# Vordergrund zugeschnitten mit Alpha, das Schiff in vier Windphasen als Atlas; Lage und Drehpunkt (Wasserlinie)
# in Spiel-Einheiten (960 × 440) in js/gaeste.js (Block // <hafen-daten>). Aufruf aus dem Repo-Ordner.
import io, json, os, re
import numpy as np
from PIL import Image

SRC, OUT = 'art/render/hafen/', 'img/hafen/'
os.makedirs(OUT, exist_ok=True)
K = 960 / 1920   # Bildpunkte -> Spiel-Einheiten


def crop(name, pad=2):
    im = Image.open(SRC + name + '.png').convert('RGBA')
    x0, y0, x1, y1 = im.getbbox()
    x0, y0, x1, y1 = max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)
    return im.crop((x0, y0, x1, y1)), (x0, y0, x1, y1)


def save_png(im, path):
    im.quantize(256, method=Image.Quantize.FASTOCTREE).save(path, optimize=True)


Image.open(SRC + 'bg.png').convert('RGB').save(OUT + 'bg.jpg', quality=86, optimize=True, progressive=True)
data = {}
for name in ('wolken', 'vorn'):
    im, (x0, y0, x1, y1) = crop(name)
    save_png(im, OUT + name + '.png')
    data[name] = [round(x0 * K, 1), round(y0 * K, 1), round((x1 - x0) * K, 1), round((y1 - y0) * K, 1)]
# Schiff: gemeinsamer Ausschnitt aller Phasen, 2 × 2 im Atlas
frames = [Image.open(SRC + f'schiff{k}.png').convert('RGBA') for k in range(4)]
boxes = [f.getbbox() for f in frames]
x0, y0 = min(b[0] for b in boxes) - 2, min(b[1] for b in boxes) - 2
x1, y1 = max(b[2] for b in boxes) + 2, max(b[3] for b in boxes) + 2
w, h = x1 - x0, y1 - y0
atlas = Image.new('RGBA', (w * 2, h * 2), (0, 0, 0, 0))
for k, f in enumerate(frames):
    atlas.alpha_composite(f.crop((x0, y0, x1, y1)), ((k % 2) * w, (k // 2) * h))
save_png(atlas, OUT + 'schiff.png')
piv = json.load(open(SRC + 'meta.json'))['pivot']
data['schiff'] = [round(x0 * K, 1), round(y0 * K, 1), round(w * K, 1), round(h * K, 1), w, h, round(piv[0], 1), round(piv[1], 1)]
# Wasserlinie: Unterkante des Rumpfs (für die Gischt), nur bis zur tiefsten Stelle – dahinter verdeckt der Steg
a0 = np.asarray(frames[0])[:, :, 3]
kiel = []
for x in range(x0 + 24, x1 - 24, 24):
    col = np.nonzero(a0[y0:y1, x] > 128)[0]
    if len(col):
        kiel.append([round(x * K, 1), round((y0 + int(col.max())) * K, 1)])
deep = max(range(len(kiel)), key=lambda i: kiel[i][1])
data['kiel'] = kiel[:deep + 1]


def atlas(names, out, cols):
    """Gemeinsamer Ausschnitt aller Bilder, Kacheln zeilenweise; liefert [x, y, Breite, Höhe] (Spiel) und Kachel (px)."""
    ims = [Image.open(SRC + n + '.png').convert('RGBA') for n in names]
    bs = [im.getbbox() for im in ims]
    bx0, by0 = max(0, min(b[0] for b in bs) - 2), max(0, min(b[1] for b in bs) - 2)
    bx1, by1 = min(1920, max(b[2] for b in bs) + 2), min(880, max(b[3] for b in bs) + 2)
    tw, th = bx1 - bx0, by1 - by0
    rows = (len(ims) + cols - 1) // cols
    at = Image.new('RGBA', (tw * cols, th * rows), (0, 0, 0, 0))
    for k, im in enumerate(ims):
        at.alpha_composite(im.crop((bx0, by0, bx1, by1)), ((k % cols) * tw, (k // cols) * th))
    save_png(at, OUT + out)
    return [round(bx0 * K, 1), round(by0 * K, 1), round(tw * K, 1), round(th * K, 1), tw, th]


# Anakonda: acht Pendelphasen, 4 × 2 im Atlas
data['schlange'] = atlas([f'schlange{k}' for k in range(8)], 'schlange.png', 4) + [8]
# Vögel: jedes Bild enthält alle drei Arten nebeneinander; an den Lücken trennen, dann je Art eine Zeile mit drei Flügelstellungen
birds = [Image.open(SRC + f'vogel{k}.png').convert('RGBA') for k in range(3)]
used = (sum(np.asarray(b)[:, :, 3].astype(np.int32) for b in birds) > 0).any(axis=0).tolist()
spans, x = [], 0
while x < 1920:
    if used[x]:
        s0 = x
        while x < 1920 and used[x]:
            x += 1
        spans.append((s0, x))
    x += 1
assert len(spans) == 3, spans
tiles = []
for (s0, s1) in spans:
    crops = []
    for b in birds:
        c = b.crop((s0, 0, s1, 880))
        crops.append(c)
    bb = [c.getbbox() for c in crops]
    yy0, yy1 = min(q[1] for q in bb) - 2, max(q[3] for q in bb) + 2
    tiles.append([c.crop((0, yy0, s1 - s0, yy1)) for c in crops])
tw, th = max(t[0].width for t in tiles), max(t[0].height for t in tiles)
at = Image.new('RGBA', (tw * 3, th * 3), (0, 0, 0, 0))
for r, row in enumerate(tiles):
    for k, c in enumerate(row):
        at.alpha_composite(c, (k * tw + (tw - c.width) // 2, r * th + (th - c.height) // 2))
save_png(at, OUT + 'voegel.png')
data['vogel'] = [round(tw * K, 1), round(th * K, 1), tw, th]   # Zeilen: Ara rot, Ara blau, Tukan; Spalten: Flügel oben, Mitte, unten
block = '// <hafen-daten> (erzeugt von art/blender/hafen_post.py): [x, y, Breite, Höhe] in Spiel-Einheiten; Schiff/Schlange dazu Atlas-Kachel (px), Schiff Drehpunkt und Kiellinie\nconst HAFEN_EBENEN = ' + json.dumps(data) + ';\n// </hafen-daten>\n'
p = 'js/gaeste.js'
s = io.open(p, encoding='utf-8').read()
if '// <hafen-daten>' in s:
    s = re.sub(r'// <hafen-daten>.*?// </hafen-daten>\n', lambda m: block, s, flags=re.S)
else:
    s = s.replace("// ---------- die Gäste ----------", block + "\n// ---------- die Gäste ----------", 1)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print(data, {f: os.path.getsize(OUT + f) // 1024 for f in os.listdir(OUT)})
