# Comic-Kontur (#0b0312) um die Renderings, eng zuschneiden, auf 256 Farben reduzieren; gibt Fußpunkt und Höhe aus
import sys, json
import numpy as np
from PIL import Image, ImageFilter

D = 'art/render/'   # Renderings (nicht im Repo)
OUT = 'img/'
JOBS = [('DrFred', 'npc_drfred'), ('Gertrude', 'npc_gertrude'), ('Hancock', 'npc_hancock'), ('Wache', 'npc_wache')]


def outline(im, rad=3.6):
    a = np.array(im).astype(np.float32) / 255
    m = a[..., 3] > 0.45
    h, w = m.shape
    d = np.zeros_like(m)
    r = int(np.ceil(rad))
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= rad * rad:
                d |= np.roll(np.roll(m, dy, 0), dx, 1)
    ol = Image.fromarray((d * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    base = Image.new('RGBA', im.size, (11, 3, 18, 0))
    base.putalpha(ol)
    base.alpha_composite(im)
    return base


info = {}
for src, dst in JOBS:
    im = Image.open(D + f'npc_{src}.png').convert('RGBA')
    pad = Image.new('RGBA', (im.width + 16, im.height + 16), (0, 0, 0, 0))
    pad.alpha_composite(im, (8, 8))
    o = outline(pad)
    al = np.array(o)[..., 3]
    ys, xs = np.where(al > 10)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    o = o.crop(box)
    al = np.array(o)[..., 3]
    # Fußpunkt: Mitte des breitesten zusammenhängenden Stücks in den untersten Zeilen
    rows = al[-max(4, al.shape[0] // 25):] > 128
    col = rows.any(axis=0)
    runs, x = [], 0
    while x < len(col):
        if col[x]:
            x0 = x
            while x < len(col) and col[x]:
                x += 1
            runs.append((x - x0, x0, x))
        x += 1
    run = max(runs)
    fx = (run[1] + run[2]) / 2 / o.width
    q = o.quantize(256, method=Image.Quantize.FASTOCTREE)
    q.save(OUT + dst + '.png', optimize=True)
    info[dst] = dict(size=o.size, fx=round(fx, 3))
print(json.dumps(info))
