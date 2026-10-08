# Abspann-Gag (trio.py): Rendering zuschneiden, Kontrast wie bei den Figuren (figur_post.py), 256 Farben.
# Aufruf aus dem Repo-Ordner:  python art/blender/trio_post.py  – schreibt img/trio.png und gibt die Spieldaten aus
# (Ecke und Münder relativ zum Fußpunkt in Spiel-Einheiten, 104 pro Meter wie bei den Gästen).
import json
import numpy as np
from PIL import Image

meta = json.load(open('art/render/trio/meta.json'))
im = Image.open('art/render/trio/trio0.png').convert('RGBA')
x0, y0, x1, y1 = im.getbbox()
x0, y0 = max(0, x0 - 2), max(0, y0 - 2)
im = im.crop((x0, y0, x1 + 2, y1 + 2))
arr = np.array(im).astype(np.float32)
rgb, al = arr[..., :3] / 255, arr[..., 3]
m = rgb[al > 128].mean()
rgb = (rgb - m) * 1.18 + m
lum = rgb.mean(axis=2, keepdims=True)
arr[..., :3] = np.clip(lum + (rgb - lum) * 1.25, 0, 1) * 255
Image.fromarray(arr.round().astype(np.uint8), 'RGBA').quantize(256, method=Image.Quantize.FASTOCTREE).save('img/trio.png', optimize=True)
upp = 104 / meta['ppm']
fx, fy = meta['foot']
r = lambda v: round(v * upp, 1)
data = {'upp': round(upp, 4), 'at': [r(x0 - fx), r(y0 - fy)], 'mouth': {k: [r(x - fx), r(y - fy)] for k, (x, y) in meta['mouth'].items()}}
print(json.dumps(data))
