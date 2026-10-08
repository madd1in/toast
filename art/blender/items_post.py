# Neue 3D-Gegenstände (items_neu.py) fürs Inventar verkleinern: Palette mit Transparenz wie die alten Symbole.
# Aufruf aus dem Repo-Ordner:  python art/blender/items_post.py
import os
from PIL import Image

for f in sorted(os.listdir('art/render/items')):
    if f.endswith('.png'):
        im = Image.open('art/render/items/' + f).convert('RGBA')
        im.quantize(colors=96, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save('img/items/' + f, optimize=True)
        print(f, os.path.getsize('img/items/' + f), 'B')
