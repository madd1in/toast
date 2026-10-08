# Titelbild-Figuren und HUD-Porträts aus art/render/helden/ (helden_bilder.py) fürs Spiel aufbereiten:
# Figuren eng zuschneiden und mit Tusche-Kontur versehen, alles auf 256 Farben (mit Alpha) bringen.
# Aufruf aus dem Repo-Ordner:  python art/blender/helden_post.py
import os
from PIL import Image, ImageFilter

SRC, INK = 'art/render/helden/', (26, 12, 36, 255)


def outline(im, rad):
    ring = im.split()[3].point(lambda v: 255 if v > 80 else 0).filter(ImageFilter.MaxFilter(2 * rad + 1))
    ink = Image.new('RGBA', im.size, INK)
    ink.putalpha(ring)
    ink.alpha_composite(im)
    return ink


for f in sorted(os.listdir(SRC)):
    name, im = f[:-4], Image.open(SRC + f).convert('RGBA')
    if name.startswith('held_'):
        x0, y0, x1, y1 = im.getbbox()
        pad = 4
        im = outline(im.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad)), 2)
    im.quantize(256, method=Image.Quantize.FASTOCTREE).save(f'img/{name}.png', optimize=True)
    print(name, im.size, os.path.getsize(f'img/{name}.png') // 1024, 'KB')
