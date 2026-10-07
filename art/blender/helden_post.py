# Nachbearbeitung der Helden-Renders: Comic-Kontur, Zuschnitt auf Spielgröße, Atlas, FIG3D-JS-Block.
import json
import numpy as np
from PIL import Image, ImageFilter

REPO = r'C:/Users/User/Documents/Tentakel-Toast'
D = REPO + '/art/render/'
OUT = REPO + '/img/figuren/'
UPP = 0.435
ZIEL_H = {'hoagie': 186, 'laverne': 212}   # Spielhöhen wie die gezeichneten Figuren (+12 Einheiten Luft)
ORDER = ['idle'] + [f'walk{i}' for i in range(8)] + ['talk0', 'talk1', 'reach', 'pick', 'pull', 'wave', 'yawn', 'saber0', 'saber1', 'saber2', 'think', 'eat', 'glasses']


def outline(im, rad=3.2):
    a = np.array(im).astype(np.float32) / 255
    m = a[..., 3] > 0.45
    d = np.zeros_like(m)
    r = int(np.ceil(rad))
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= rad * rad:
                d |= np.roll(np.roll(m, dy, 0), dx, 1)
    ol = Image.fromarray((d * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    base = Image.new('RGBA', im.size, (11, 3, 18, 0))
    base.putalpha(ol)
    base.alpha_composite(im)
    return base


def foot_x_of(o):
    al = np.array(o)[..., 3]
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
    _, a, b = max(runs)
    return (a + b) / 2


anchors = json.load(open(D + 'anchors.json', encoding='utf-8'))
out_js = {}
for fig in ('hoagie', 'laverne'):
    frames = []
    for pn in ORDER:
        im = Image.open(D + f'helden_{fig}_{pn}.png').convert('RGBA')
        pad = Image.new('RGBA', (im.width + 16, im.height + 16), (0, 0, 0, 0))
        pad.alpha_composite(im, (8, 8))
        o = outline(pad)
        al = np.array(o)[..., 3]
        ys, xs = np.where(al > 10)
        off_x, off_y = xs.min() - 8, ys.min() - 8   # Crop-Ursprung im Original-Bild
        o = o.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        ziel = round((ZIEL_H[fig] + 12) / UPP)
        k = ziel / o.height
        o = o.resize((max(1, round(o.width * k)), ziel), Image.LANCZOS)
        fx = foot_x_of(o)
        # Anker: Original-Pixel -> Crop -> Skalierung -> Spiel-Einheiten relativ zum Fußpunkt
        def rel(key):
            a = anchors[fig][pn][key]
            px = (a[0] - off_x) * k
            py = (a[1] - off_y) * k
            return round((px - fx) * UPP, 1), round((py - ziel) * UPP, 1)
        frames.append({'img': o, 'pn': pn, 'fx': fx,
                       'off': [round(-fx * UPP, 1), round(-ziel * UPP + 2.07, 1)],   # 2 Einheiten Schuhspitze unter dem Fußpunkt wie bei Bernard
                       'mund': rel('mund'), 'pupL': rel('pupL'), 'pupR': rel('pupR'), 'hand': rel('hand')})
    per = 7
    rows = [frames[i:i + per] for i in range(0, len(frames), per)]
    W = max(sum(f['img'].width + 2 for f in r) for r in rows) + 4
    H = sum(max(f['img'].height for f in r) + 4 for r in rows) + 2
    atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    lines = []
    y = 2
    for r in rows:
        x = 2
        hmax = 0
        for f in r:
            atlas.alpha_composite(f['img'], (x, y))
            m, p1, p2, h_ = f['mund'], f['pupL'], f['pupR'], f['hand']
            lines.append(f"    {f['pn']}: [{x},{y},{f['img'].width},{f['img'].height},{f['off'][0]},{f['off'][1]},{m[0]},{m[1]},{p1[0]},{p1[1]},{p2[0]},{p2[1]},{h_[0]},{h_[1]}],")
            x += f['img'].width + 2
            hmax = max(hmax, f['img'].height)
        y += hmax + 4
    atlas.save(OUT + fig + '.png', optimize=True)
    out_js[fig] = '\n'.join(lines)
    print(fig, 'atlas', atlas.size)

with open(D + 'fig3d_js.txt', 'w', encoding='utf-8') as f:
    for fig in ('hoagie', 'laverne'):
        block = "  " + fig + ": { src: 'img/figuren/" + fig + ".png', upp: " + str(UPP) + ", f: {\n" + out_js[fig] + "\n  } },\n"
        f.write(block)
print('fig3d_js.txt geschrieben')
