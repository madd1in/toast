# Prozedurale Texturen für die 3D-Räume (Leinwand für Segel, Holzplanken, Putz, Dachziegel, Fassdauben, Piratenflagge).
# Aufruf aus dem Repo-Ordner:  python art/blender/texturen.py   -> art/textures/*.png (von raum_build.py geladen)
import math, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = 'art/textures/'
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def noise(w, h, scale, octaves=4, seed=0):
    """Weiches Wertrauschen (mehrere Oktaven, kachelbar), Werte 0..1."""
    r = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        n = max(2, int(scale * 2 ** o))
        g = r.random((n, n)).astype(np.float32)
        img = Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        out += np.asarray(img, np.float32) / 255 * amp
        tot += amp
        amp *= 0.5
    return out / tot


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32)


def save(arr, name):
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(OUT + name, optimize=True)


def planks(name, w, h, n, cols, seam='#2a1a10', grain=0.18, nails=True, seed=1):
    """Waagerechte Planken mit Maserung, Fugen und Nagelköpfen."""
    r = random.Random(seed)
    img = np.zeros((h, w, 3), np.float32)
    ph = h / n
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nz = noise(w, h, 6, 4, seed)
    for i in range(n):
        y0, y1 = int(i * ph), int((i + 1) * ph)
        c = hexrgb(r.choice(cols)) * r.uniform(0.9, 1.08)
        band = slice(y0, y1)
        # Maserung: gestreckte Wellen entlang der Planke
        ph0 = r.uniform(0, 6.28)
        g = np.sin((yy[band] - y0) / ph * r.uniform(7, 13) + np.sin(xx[band] / w * r.uniform(3, 8) * math.pi + ph0) * 2.2 + nz[band] * 6)
        k = 1 - grain * (0.5 + 0.5 * g) - 0.12 * nz[band]
        img[band] = c * k[..., None]
        img[y0:y0 + 3] *= 0.45   # Fuge
        # versetzte Stöße der Planken
        for _ in range(r.randint(1, 2)):
            x = r.randint(0, w - 1)
            img[y0:y1, max(0, x - 1):x + 2] *= 0.5
            if nails:
                for yn in (y0 + ph * 0.3, y0 + ph * 0.7):
                    img[int(yn) - 2:int(yn) + 2, max(0, x - 7):x - 3] = hexrgb('#3a3a40')
    img *= 0.92 + 0.16 * noise(w, h, 3, 3, seed + 9)[..., None]
    # kachelbar in Längsrichtung: die Ränder weich ineinander überblenden
    k = w // 8
    a = np.linspace(0, 1, k, dtype=np.float32)[None, :, None]
    left = img[:, :k].copy()
    img[:, :k] = img[:, -k:] * (1 - a) + left * a
    img = img[:, :w - k]
    save(np.asarray(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), np.float32), name)


def canvas_cloth(name, w=1024, h=1024, seed=3):
    """Segeltuch: warmes Leinen mit Bahnen, Nähten, Flicken, feinem Gewebe und Wetterspuren nach unten."""
    r = random.Random(seed)
    base = hexrgb('#efe4cc')
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    weave = (np.sin(xx * 1.6) * np.sin(yy * 1.6)) * 0.025
    img = base * (1 + weave[..., None] - 0.08 * noise(w, h, 4, 4, seed)[..., None])
    for i in range(1, 8):   # Bahnen mit Doppelnaht
        x = int(i * w / 8)
        img[:, x - 2:x + 1] *= 0.86
        img[::14, x + 4:x + 6] *= 0.8
    d = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    dr = ImageDraw.Draw(d)
    for _ in range(3):   # Flicken
        x0, y0 = r.randint(60, w - 220), r.randint(60, h - 220)
        x1, y1 = x0 + r.randint(80, 160), y0 + r.randint(70, 140)
        dr.rectangle([x0, y0, x1, y1], fill=(222, 206, 172))
        for t in range(x0, x1, 10):
            dr.line([t, y0 + 3, t + 4, y0 + 3], fill=(150, 130, 100), width=2)
            dr.line([t, y1 - 3, t + 4, y1 - 3], fill=(150, 130, 100), width=2)
        for t in range(y0, y1, 10):
            dr.line([x0 + 3, t, x0 + 3, t + 4], fill=(150, 130, 100), width=2)
            dr.line([x1 - 3, t, x1 - 3, t + 4], fill=(150, 130, 100), width=2)
    img = np.asarray(d, np.float32)
    img *= (1 - 0.18 * (yy / h) ** 2 * noise(w, h, 5, 3, seed + 2))[..., None]   # Schmutz unten
    dr2 = img.copy()
    dr2[:10] *= 0.7; dr2[-10:] *= 0.7   # Liek oben/unten
    save(dr2, name)


def plaster(name, w=1024, h=1024, seed=5):
    img = hexrgb('#e4d4ae') * (0.86 + 0.18 * noise(w, h, 5, 5, seed))[..., None]
    d = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    dr = ImageDraw.Draw(d)
    r = random.Random(seed)
    for _ in range(14):   # feine Risse
        x, y = r.randint(0, w), r.randint(0, h)
        pts = [(x, y)]
        for _ in range(r.randint(3, 7)):
            x += r.randint(-30, 30); y += r.randint(5, 40); pts.append((x, y))
        dr.line(pts, fill=(170, 150, 120), width=2)
    for _ in range(5):   # abgeplatzte Stellen mit Ziegel darunter
        x, y = r.randint(40, w - 120), r.randint(40, h - 120)
        dr.ellipse([x, y, x + r.randint(40, 110), y + r.randint(25, 60)], fill=(176, 104, 74))
        for k in range(3):
            dr.line([x + 6, y + 12 + k * 14, x + 70, y + 12 + k * 14], fill=(140, 80, 60), width=2)
    save(np.asarray(d.filter(ImageFilter.GaussianBlur(0.6)), np.float32), name)


def roof_tiles(name, w=1024, h=1024, seed=6):
    r = random.Random(seed)
    img = np.zeros((h, w, 3), np.float32)
    rows, cols = 12, 10
    th, tw = h / rows, w / cols
    for j in range(rows):
        off = (tw / 2) if j % 2 else 0
        for i in range(-1, cols + 1):
            x0, y0 = int(i * tw + off), int(j * th)
            c = hexrgb(r.choice(['#a8452e', '#b85238', '#963c28', '#ad4a30'])) * r.uniform(0.9, 1.1)
            yy, xx = np.mgrid[0:int(th), 0:int(tw)].astype(np.float32)
            shade = 1 - 0.35 * (yy / th) ** 2 + 0.1 * np.cos((xx / tw - 0.5) * math.pi)
            xs, xe = max(0, x0), min(w, x0 + int(tw))
            if xe <= xs:
                continue
            img[y0:y0 + int(th), xs:xe] = c * shade[:, xs - x0:xe - x0, None]
            img[y0:y0 + 2, xs:xe] *= 0.55
            img[y0:y0 + int(th), xs:xs + 2] *= 0.6
    img *= (0.9 + 0.15 * noise(w, h, 4, 4, seed))[..., None]
    save(img, name)


def jolly_roger(name, w=512, h=340):
    """Piratenflagge: schwarzes Tuch, ein Toast statt Totenkopf, darunter gekreuzte Knochen."""
    d = Image.new('RGB', (w, h), (22, 18, 26))
    dr = ImageDraw.Draw(d)
    cx, cy = w // 2, int(h * 0.42)
    for k in (-1, 1):   # gekreuzte Knochen
        x0, y0, x1, y1 = cx - 120, cy + 40 - 70 * k, cx + 120, cy + 40 + 70 * k
        dr.line([x0, y0, x1, y1], fill=(240, 232, 214), width=22)
        for (x, y) in ((x0, y0), (x1, y1)):
            dr.ellipse([x - 20, y - 20, x + 4, y + 4], fill=(240, 232, 214)); dr.ellipse([x - 4, y - 4, x + 20, y + 20], fill=(240, 232, 214))
    # Toastscheibe mit Kruste, zwei Augen und einem breiten Grinsen
    dr.rounded_rectangle([cx - 78, cy - 92, cx + 78, cy + 62], 38, fill=(150, 88, 34))
    dr.rounded_rectangle([cx - 64, cy - 78, cx + 64, cy + 50], 30, fill=(232, 178, 92))
    dr.ellipse([cx - 112, cy - 112, cx - 30, cy - 40], fill=(150, 88, 34)); dr.ellipse([cx + 30, cy - 112, cx + 112, cy - 40], fill=(150, 88, 34))
    dr.ellipse([cx - 100, cy - 100, cx - 40, cy - 48], fill=(232, 178, 92)); dr.ellipse([cx + 40, cy - 100, cx + 100, cy - 48], fill=(232, 178, 92))
    dr.ellipse([cx - 40, cy - 40, cx - 12, cy - 8], fill=(22, 18, 26)); dr.ellipse([cx + 12, cy - 40, cx + 40, cy - 8], fill=(22, 18, 26))
    dr.arc([cx - 34, cy - 10, cx + 34, cy + 30], 20, 160, fill=(22, 18, 26), width=7)
    arr = np.asarray(d, np.float32) * (0.85 + 0.25 * noise(w, h, 4, 3, 11))[..., None]
    save(arr, name)


def speckle(name, cols, w=512, h=512, scale=8, seed=12, blades=False, cracks=False):
    """Gras, Fels, Sand: Farbverlauf aus Rauschen, dazu Halme bzw. Risse bzw. Körner."""
    n = noise(w, h, scale, 5, seed)
    c0, c1, c2 = (hexrgb(c) for c in cols)
    img = np.where((n < 0.5)[..., None], c0 + (c1 - c0) * (n / 0.5)[..., None], c1 + (c2 - c1) * ((n - 0.5) / 0.5)[..., None])
    d = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    dr = ImageDraw.Draw(d)
    r = random.Random(seed)
    if blades:
        for _ in range(2600):
            x, y = r.randint(0, w), r.randint(0, h)
            k = r.uniform(0.75, 1.25)
            dr.line([x, y, x + r.randint(-3, 3), y - r.randint(5, 12)], fill=tuple(int(v * k) for v in c2), width=1)
    if cracks:
        for _ in range(40):
            x, y = r.randint(0, w), r.randint(0, h)
            pts = [(x, y)]
            for _ in range(r.randint(2, 6)):
                x += r.randint(-25, 25); y += r.randint(-25, 25); pts.append((x, y))
            dr.line(pts, fill=tuple(int(v * 0.6) for v in c0), width=2)
    if not blades and not cracks:
        for _ in range(3000):
            x, y = r.randint(0, w), r.randint(0, h)
            dr.point((x, y), fill=tuple(int(v * r.uniform(0.8, 1.15)) for v in c1))
    save(np.asarray(d, np.float32), name)


def schlangenhaut(name, w=512, h=512, seed=31):
    """Anakonda: olivgrün mit schwarzen Ovalflecken auf dem Rücken, Augenflecken an den Seiten, gelblicher Bauch.
    u (Breite) läuft rund um den Körper, v (Höhe) längs; kachelbar in beide Richtungen."""
    r = random.Random(seed)
    n = noise(w, h, 6, seed=seed)
    u = np.linspace(0, 1, w, endpoint=False)[None, :]
    bel = np.clip((np.cos((u - 0.5) * 2 * np.pi) - 0.72) / 0.22, 0, 1)[..., None] * np.ones((h, 1, 1), np.float32)
    img = hexrgb('#55661e') * (0.8 + 0.4 * n[..., None]) * (1 - bel) + hexrgb('#e0c878') * (0.88 + 0.24 * n[..., None]) * bel
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)

    def blob(cx, cy, rx, ry, col, ring=None):
        for ox in (-w, 0, w):
            for oy in (-h, 0, h):
                d.ellipse((cx + ox - rx, cy + oy - ry, cx + ox + rx, cy + oy + ry), fill=col)
                if ring:
                    d.ellipse((cx + ox - rx * 0.5, cy + oy - ry * 0.5, cx + ox + rx * 0.5, cy + oy + ry * 0.5), fill=ring)
    for j in range(6):   # Rücken (u um 0): zwei versetzte Reihen großer Flecken
        for k, uc in enumerate((0.07, 0.93)):
            blob(uc * w + r.uniform(-6, 6), (j + 0.5 * k) / 6 * h + r.uniform(-8, 8), w * r.uniform(0.08, 0.1), h * r.uniform(0.06, 0.08), (22, 20, 12))
    for j in range(8):   # Seiten (u um 0,27 und 0,73): kleinere Ringe mit hellem Kern
        for k, uc in enumerate((0.27, 0.73)):
            blob(uc * w + r.uniform(-5, 5), (j + 0.5 * k) / 8 * h + r.uniform(-6, 6), w * 0.055, h * 0.045, (26, 22, 12), ring=(214, 160, 52))
    save(np.asarray(im.filter(ImageFilter.GaussianBlur(1.0)), np.float32), name)


speckle('gras.png',['#3f7a2c', '#5a9a3a', '#7cbc4a'], blades=True, seed=21)
speckle('fels.png', ['#6a6460', '#8a847c', '#a8a298'], scale=6, cracks=True, seed=22)
speckle('sand.png', ['#d8c088', '#e8d29a', '#f4e4b4'], scale=10, seed=23)
planks('holz_steg.png', 1024, 1024, 8, ['#9a6a3a', '#a8743e', '#8f6236', '#b07c44'], seed=1)
planks('holz_rumpf.png', 1024, 1024, 16, ['#6a3e22', '#5e361e', '#734426', '#58321c'], grain=0.22, seed=2)
planks('holz_deck.png', 1024, 1024, 10, ['#c08a50', '#b47e48', '#c8955a'], grain=0.15, seed=4)
planks('holz_fass.png', 512, 512, 6, ['#b07a40', '#a06c36', '#bc864a'], grain=0.2, nails=False, seed=8)
canvas_cloth('segeltuch.png')
plaster('putz.png')
roof_tiles('dachziegel.png')
jolly_roger('flagge.png')
schlangenhaut('schlange.png')
print(sorted(os.listdir(OUT)))
