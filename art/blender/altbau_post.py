# Altbau-Räume (altbau.py) fürs Spiel aufbereiten. Aufruf aus dem Repo-Ordner:  python art/blender/altbau_post.py [lobby …]
# Grundbild -> img/raum_<name>.jpg. Varianten (Zustände wie „Falltür offen“) werden mit dem Grundbild verglichen und nur dort
# ausgeschnitten, wo sich etwas ändert (plus Rand) -> img/altbau/<name>_<variante>.jpg; das Spiel malt sie über das Grundbild.
# Sprites (Pendel) freigestellt -> img/altbau/<name>_<sprite>.png. Alle Positionen in Spiel-Einheiten (960 × 440) nach
# js/altbau-daten.js.
import json, os, sys
import numpy as np
from PIL import Image

NAMES = sys.argv[1:] or ['lobby']
os.makedirs('img/altbau', exist_ok=True)
DATA = 'js/altbau-daten.js'
alle = {}
if os.path.exists(DATA):   # andere Räume beibehalten
    src = open(DATA, encoding='utf-8').read()
    alle = json.loads(src[src.index('{'):src.rindex('}') + 1])

for name in NAMES:
    meta = json.load(open(f'art/render/{name}/meta.json'))
    base = Image.open(f'art/render/raum_{name}.png').convert('RGB')
    base.save(f'img/raum_{name}.jpg', quality=86, optimize=True, progressive=True)
    b = np.asarray(base).astype(np.int16)
    out = {'anchors': meta['anchors'], 'points': meta['points'], 'variants': {}, 'sprites': {}}
    for k, (x, y, w, h) in meta['variants'].items():
        f = f'art/render/{name}/var_{k}.png'
        if not os.path.exists(f):
            continue
        v = np.asarray(Image.open(f).convert('RGB')).astype(np.int16)
        d = np.abs(v - b).max(axis=2)
        e = 5   # außerhalb des gerenderten Ausschnitts ist das Bild leer, an seinem Rand zeichnet Freestyle leicht anders
        d[:, :x + e] = 0; d[:, x + w - e:] = 0; d[:y + e, :] = 0; d[y + h - e:, :] = 0
        ys, xs = np.nonzero(d > 14)
        m = 8
        x0, x1 = max(x + e, xs.min() - m), min(x + w - e, xs.max() + m + 1)
        y0, y1 = max(y + e, ys.min() - m), min(y + h - e, ys.max() + m + 1)
        if y + h >= 880:   # Ausschnitt reicht bis zum unteren Bildrand: dort gibt es keinen Freestyle-Randfehler
            y1 = min(880, ys.max() + m + 1)
        x0, y0 = x0 - x0 % 2, y0 - y0 % 2   # gerade Pixel: halbe Spiel-Einheiten
        x1, y1 = x1 + x1 % 2, y1 + y1 % 2
        rand = np.concatenate([d[y0, x0:x1], d[y1 - 1, x0:x1], d[y0:y1, x0], d[y0:y1, x1 - 1]])
        Image.fromarray(v[y0:y1, x0:x1].astype(np.uint8)).save(f'img/altbau/{name}_{k}.jpg', quality=88, optimize=True)
        out['variants'][k] = {'src': f'img/altbau/{name}_{k}.jpg', 'x': x0 / 2, 'y': y0 / 2, 'w': (x1 - x0) / 2, 'h': (y1 - y0) / 2}
        print(name, k, 'Ausschnitt', x0, y0, x1 - x0, y1 - y0, 'Randabweichung max', int(rand.max()))
    for k, s in meta['sprites'].items():
        f = f'art/render/{name}/sprite_{k}.png'
        if not os.path.exists(f):
            continue
        im = Image.open(f).convert('RGBA')
        bb = im.getbbox()
        x0, y0 = bb[0] - bb[0] % 2, bb[1] - bb[1] % 2
        x1, y1 = bb[2] + bb[2] % 2, bb[3] + bb[3] % 2
        im.crop((x0, y0, x1, y1)).save(f'img/altbau/{name}_{k}.png', optimize=True)
        out['sprites'][k] = {'src': f'img/altbau/{name}_{k}.png', 'x': x0 / 2, 'y': y0 / 2, 'w': (x1 - x0) / 2, 'h': (y1 - y0) / 2, 'pivot': s['pivot']}
        print(name, k, 'Sprite', x0, y0, x1 - x0, y1 - y0, 'Drehpunkt', s['pivot'])
    alle[name] = out

with open(DATA, 'w', encoding='utf-8') as fh:
    fh.write("'use strict';\n// Erzeugt von art/blender/altbau_post.py – Bildpositionen der Altbau-Räume in 3D (Spiel-Einheiten 960 × 440)\n")
    fh.write('const ALTBAU3D = ' + json.dumps(alle, ensure_ascii=False, indent=1) + ';\n')
print({n: os.path.getsize(f'img/raum_{n}.jpg') // 1024 for n in NAMES}, 'KB')
