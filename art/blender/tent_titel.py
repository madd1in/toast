# Tentakel fürs Titelbild und den Abspann (img/tent_*.png) aus den Spielfigur-Renderings (tent_build.py):
# zuschneiden, Tusche-Kontur wie bei den gezeichneten Figuren, Kontrast wie figur_post.py, auf 480 px Höhe.
# Aufruf aus dem Repo-Ordner:  python art/blender/tent_titel.py  – gibt den Fußpunkt (Anteil der Breite) für TENT_AT aus.
import json
import numpy as np
from PIL import Image, ImageFilter

INK = (27, 16, 32)
for src, frame, out in (('green', 'idle', 'tent_gruen'), ('lila', 'a0', 'tent_lila'), ('nett', 'a0', 'tent_nett')):
    meta = json.load(open(f'art/render/{src}/meta.json'))
    foot = next(f for f in meta['frames'] if f['name'] == frame)['foot']
    im = Image.open(f'art/render/{src}/{frame}.png').convert('RGBA')
    pad = 8
    x0, y0, x1, y1 = im.getbbox()
    im = im.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad))
    a = im.split()[3]
    ring = a.filter(ImageFilter.MaxFilter(7))   # Kontur: Alpha um 3 px verbreitern, dunkel darunterlegen
    base = Image.new('RGBA', im.size, INK + (0,))
    base.putalpha(ring)
    arr = np.array(im).astype(np.float32)
    rgb, al = arr[..., :3] / 255, arr[..., 3]
    m = rgb[al > 128].mean()
    rgb = (rgb - m) * 1.18 + m
    lum = rgb.mean(axis=2, keepdims=True)
    arr[..., :3] = np.clip(lum + (rgb - lum) * 1.2, 0, 1) * 255
    base.alpha_composite(Image.fromarray(arr.round().astype(np.uint8), 'RGBA'))
    k = 480 / base.height
    base = base.resize((round(base.width * k), 480), Image.LANCZOS)
    base.save(f'img/{out}.png', optimize=True)
    fx = (foot[0] - (x0 - pad)) * k / base.width
    print(out, base.size, 'fx', round(fx, 3))
