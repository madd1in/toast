# Cousin Ted und die Riesenpflanze (cameo3d.py) als Bildstreifen fürs Spiel: zuschneiden, Kontrast wie figur_post.py,
# 256 Farben. Aufruf aus dem Repo-Ordner:  python art/blender/cameo_post.py  – schreibt img/<name>.png und gibt die
# Bilddaten aus: je Bild [x, y, w, h im Streifen, linke obere Ecke relativ zum Fuß in Spiel-Einheiten] (104 pro Meter).
import json
import numpy as np
from PIL import Image

out = {}
for name in ('ted', 'pflanze'):
    meta = json.load(open(f'art/render/{name}/meta.json'))
    upp = 104 / meta['ppm']
    crops = []
    for f in meta['frames']:
        im = Image.open(f'art/render/{name}/{f["name"]}.png').convert('RGBA')
        x0, y0, x1, y1 = im.getbbox()
        x0, y0 = max(0, x0 - 2), max(0, y0 - 2)
        crops.append((f, im.crop((x0, y0, x1 + 2, y1 + 2)), x0, y0))
    W, H = sum(c[1].width + 2 for c in crops), max(c[1].height for c in crops)
    sheet, x, data = Image.new('RGBA', (W, H), (0, 0, 0, 0)), 0, {}
    for f, im, x0, y0 in crops:
        sheet.alpha_composite(im, (x, 0))
        fx, fy = f['foot']
        data[f['name']] = [x, 0, im.width, im.height, round((x0 - fx) * upp, 1), round((y0 - fy) * upp, 1)]
        x += im.width + 2
    arr = np.array(sheet).astype(np.float32)
    rgb, al = arr[..., :3] / 255, arr[..., 3]
    m = rgb[al > 128].mean()
    rgb = (rgb - m) * 1.15 + m
    lum = rgb.mean(axis=2, keepdims=True)
    arr[..., :3] = np.clip(lum + (rgb - lum) * 1.2, 0, 1) * 255
    Image.fromarray(arr.round().astype(np.uint8), 'RGBA').quantize(256, method=Image.Quantize.FASTOCTREE).save(f'img/{name}.png', optimize=True)
    out[name] = {'upp': round(upp, 4), 'f': data}
print(json.dumps(out))
