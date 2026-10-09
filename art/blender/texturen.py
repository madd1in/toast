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


def speckle(name, cols, w=512, h=512, scale=8, seed=12, blades=False, cracks=False, tile=False):
    """Gras, Fels, Sand: Farbverlauf aus Rauschen, dazu Halme bzw. Risse bzw. Körner. tile=True spiegelt das Rauschen, damit die Kanten
    nahtlos aneinanderpassen (große Böden sonst mit sichtbaren Kachelnähten)."""
    n = noise(w, h, scale, 5, seed)
    if tile:
        n = (n + n[:, ::-1]) / 2
        n = (n + n[::-1, :]) / 2
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


def bruchstein(name, w=1024, h=1024, seed=41, cols=('#7a746c', '#857d72', '#6c665e', '#8e867a'), mortar='#2e2a34', rows=8, floor=False):
    """Kellermauer aus unregelmäßigen Bruchsteinen (oder Kopfsteinpflaster): versetzte Reihen, gerundete Steine,
    Fugen dunkel, Moosflecken unten; kachelbar."""
    r = random.Random(seed)
    img = Image.new('RGB', (w, h), mortar)
    d = ImageDraw.Draw(img)
    rh = h / rows
    for j in range(rows):
        x = -r.uniform(0, w / 6)
        while x < w:
            sw = r.uniform(w / 9, w / 5) if not floor else r.uniform(w / 11, w / 8)
            y0, y1 = j * rh + r.uniform(3, 9), (j + 1) * rh - r.uniform(3, 9)
            k = r.uniform(0.85, 1.12)
            c = tuple(int(min(255, v * k)) for v in hexrgb(r.choice(cols)))
            for ox in (-w, 0, w):   # kachelbar in x
                d.rounded_rectangle([x + ox + 4, y0, x + ox + sw - 4, y1], radius=int(rh * 0.3), fill=c)
                d.line([x + ox + 10, y0 + 5, x + ox + sw - 12, y0 + 5], fill=tuple(min(255, int(v * 1.18)) for v in c), width=3)   # Lichtkante
            x += sw
    arr = np.asarray(img, np.float32) * (0.82 + 0.3 * noise(w, h, 9, 4, seed))[..., None]
    if not floor:   # feuchte, moosige Stellen unten
        yy = np.linspace(0, 1, h)[:, None, None]
        moss = np.clip((yy - 0.7) / 0.3, 0, 1) * noise(w, h, 6, 3, seed + 1)[..., None]
        arr = arr * (1 - 0.5 * moss) + hexrgb('#3e5a2e') * 0.5 * moss
    save(arr, name)


def tapete(name, base, dark, dot, w=512, h=512, seed=51):
    """Tapete mit Rautenmuster und Pünktchen (Lobby), leicht fleckig gealtert; kachelbar (Muster geht in w und h glatt auf)."""
    d = Image.new('RGB', (w, h), tuple(int(v) for v in hexrgb(base)))
    dr = ImageDraw.Draw(d)
    cw, ch = w // 4, h // 4
    for j in range(-1, 5):
        for i in range(-1, 5):
            x, y = i * cw + (j % 2) * cw // 2, j * ch
            dr.polygon([(x, y - ch * 0.36), (x + cw * 0.15, y), (x, y + ch * 0.36), (x - cw * 0.15, y)], fill=tuple(int(v) for v in hexrgb(dark)))
            dr.ellipse([x + cw // 2 - 7, y + ch // 2 - 7, x + cw // 2 + 7, y + ch // 2 + 7], fill=tuple(int(v) for v in hexrgb(dot)))
            dr.line([(x, y - ch * 0.46), (x, y - ch * 0.4)], fill=tuple(int(v) for v in hexrgb(dot)), width=2)
    arr = np.asarray(d.filter(ImageFilter.GaussianBlur(0.8)), np.float32)
    n = noise(w, h, 4, 4, seed)
    n = (n + n[:, ::-1] + n[::-1, :] + n[::-1, ::-1]) / 4
    arr *= (0.9 + 0.2 * n)[..., None]
    save(arr, name)


def zifferblatt(name, w=512):
    """Zifferblatt der Standuhr: elfenbein, römische Ziffern, Messingring, Mondphasen-Bogen oben."""
    s = 4 * w
    d = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    dr = ImageDraw.Draw(d)
    c = s / 2
    dr.ellipse([0, 0, s - 1, s - 1], fill=(196, 154, 64, 255))
    dr.ellipse([s * 0.05, s * 0.05, s * 0.95, s * 0.95], fill=(242, 230, 200, 255), outline=(90, 60, 20, 255), width=int(s * 0.012))
    try:
        from PIL import ImageFont
        font = ImageFont.truetype('C:/Windows/Fonts/georgiab.ttf', int(s * 0.085))
    except OSError:
        font = None
    roman = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']
    for i, t in enumerate(roman):
        a = i / 12 * 2 * math.pi
        x, y = c + math.sin(a) * s * 0.36, c - math.cos(a) * s * 0.36
        dr.text((x, y), t, fill=(40, 24, 12, 255), font=font, anchor='mm')
        for k in range(5):   # Minutenstriche
            b = a + k / 60 * 2 * math.pi
            r0 = 0.43 if k else 0.41
            dr.line([(c + math.sin(b) * s * r0, c - math.cos(b) * s * r0), (c + math.sin(b) * s * 0.445, c - math.cos(b) * s * 0.445)], fill=(40, 24, 12, 255), width=int(s * (0.008 if k else 0.014)))
    dr.ellipse([c - s * 0.04, c - s * 0.04, c + s * 0.04, c + s * 0.04], fill=(40, 24, 12, 255))
    # Zeiger: zehn vor zwei
    for ang, ln, wd in ((-1.05, 0.3, 0.024), (0.95, 0.22, 0.034)):
        dr.line([(c, c), (c + math.sin(ang) * s * ln, c - math.cos(ang) * s * ln)], fill=(30, 18, 10, 255), width=int(s * wd))
    d = d.resize((w, w), Image.LANCZOS)
    a = np.asarray(d, np.float32)
    a[..., :3] *= (0.92 + 0.12 * noise(w, w, 5, 3, 71))[..., None]
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(OUT + name, optimize=True)


def nachthimmel(name, w=1024, h=512, seed=81):
    """Nachthimmel für den Blick aus dem Fenster: tiefes Blau nach unten heller, Sterne, Sichelmond, Wolkenschleier, kahler Ast."""
    yy = np.linspace(0, 1, h)[:, None, None]
    arr = hexrgb('#0e0a2e') * (1 - yy) + hexrgb('#3a2a6e') * yy
    arr = arr * np.ones((1, w, 1), np.float32)
    n = noise(w, h, 3, 4, seed)
    arr += (n[..., None] - 0.5) * 30
    d = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    dr = ImageDraw.Draw(d)
    r = random.Random(seed)
    for _ in range(160):
        x, y, s = r.randint(0, w), r.randint(0, int(h * 0.8)), r.choice((1, 1, 1, 2, 2, 3))
        dr.ellipse([x - s, y - s, x + s, y + s], fill=(255, 250, 230))
    mx, my, mr = int(w * 0.66), int(h * 0.26), int(h * 0.12)
    halo = Image.new('L', (w, h), 0)   # weicher Hof um den Mond
    ImageDraw.Draw(halo).ellipse([mx - mr * 2.2, my - mr * 2.2, mx + mr * 2.2, my + mr * 2.2], fill=110)
    halo = halo.filter(ImageFilter.GaussianBlur(mr * 0.9))
    d = Image.composite(Image.new('RGB', (w, h), (150, 140, 220)), d, halo)
    moon = Image.new('L', (w, h), 0)   # Sichel: Vollkreis minus versetzter Kreis
    md = ImageDraw.Draw(moon)
    md.ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=255)
    md.ellipse([mx - mr + int(mr * 0.55), my - mr - int(mr * 0.25), mx + mr + int(mr * 0.55), my + mr - int(mr * 0.25)], fill=0)
    d = Image.composite(Image.new('RGB', (w, h), (255, 244, 196)), d, moon.filter(ImageFilter.GaussianBlur(0.8)))
    dr = ImageDraw.Draw(d)
    dr = ImageDraw.Draw(d)
    # kahler Ast von links oben, Spukvilla-Stimmung
    def ast(x, y, a, ln, wd, depth):
        if depth == 0 or wd < 1:
            return
        x2, y2 = x + math.cos(a) * ln, y + math.sin(a) * ln
        dr.line([(x, y), (x2, y2)], fill=(10, 6, 20), width=int(wd))
        ast(x2, y2, a + r.uniform(-0.6, -0.15), ln * 0.72, wd * 0.62, depth - 1)
        ast(x2, y2, a + r.uniform(0.15, 0.6), ln * 0.66, wd * 0.6, depth - 1)
    ast(-10, int(h * 0.12), 0.35, w * 0.22, 26, 6)
    save(np.asarray(d, np.float32), name)


def gemaelde(name, portrait, w=600, h=720, seed=91):
    """Ölporträt: das 3D-Rendering der Figur (art/render/portrait_*.png) vor dunkelgrünem Malgrund mit Vignette,
    gemalt wirkende Flächen (Medianfilter), Firnis-Gelbstich und feines Krakelee."""
    fig = Image.open(portrait).convert('RGBA').resize((w, h), Image.LANCZOS)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    rr = np.hypot((xx - w * 0.5) / (w * 0.62), (yy - h * 0.42) / (h * 0.62))
    bg = hexrgb('#3f6a4a') * (1 - np.clip(rr, 0, 1))[..., None] + hexrgb('#16261c') * np.clip(rr, 0, 1)[..., None]
    bg += (noise(w, h, 5, 4, seed)[..., None] - 0.5) * 40
    base = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8)).convert('RGBA')
    base.alpha_composite(fig)
    img = base.convert('RGB').filter(ImageFilter.ModeFilter(5)).filter(ImageFilter.SMOOTH_MORE)
    a = np.asarray(img, np.float32)
    a = a * np.array([1.0, 0.95, 0.8], np.float32) + np.array([14, 8, 0], np.float32)   # Firnis
    a *= (0.88 + 0.12 * (1 - np.clip(rr, 0, 1)))[..., None]
    cr = Image.new('L', (w, h), 0)   # Krakelee: feine Haarrisse, nur angedeutet
    dr = ImageDraw.Draw(cr)
    r = random.Random(seed)
    for _ in range(45):
        x, y = r.randint(0, w), r.randint(0, h)
        pts = [(x, y)]
        for _ in range(r.randint(2, 4)):
            x += r.randint(-30, 30); y += r.randint(-30, 30); pts.append((x, y))
        dr.line(pts, fill=255, width=1)
    k = np.asarray(cr.filter(ImageFilter.GaussianBlur(0.5)), np.float32)[..., None] / 255 * 0.22
    a = a * (1 - k) + np.array([40, 34, 20], np.float32) * k
    save(a, name)


def labor_glas(name, w=256, h=384, seed=93):
    """Milchglas der Labortür: grünes Leuchten von hinten, Kolben-Schatten und Bläschen."""
    yy = np.linspace(0, 1, h)[:, None, None]
    arr = (hexrgb('#1c5a46') * (1 - yy) + hexrgb('#3aa878') * yy) * np.ones((1, w, 1), np.float32)
    xx = np.linspace(-1, 1, w)[None, :, None]
    arr *= 1.15 - 0.35 * xx ** 2
    d = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    dr = ImageDraw.Draw(d)
    dark = (12, 40, 30)
    for i, (cx, base, kind) in enumerate(((0.25, 0.92, 0), (0.52, 0.88, 1), (0.78, 0.9, 2))):
        x, y = cx * w, base * h
        if kind == 0:   # Erlenmeyer
            dr.polygon([(x - 34, y), (x + 34, y), (x + 9, y - 70), (x + 9, y - 110), (x - 9, y - 110), (x - 9, y - 70)], fill=dark)
        elif kind == 1:   # Rundkolben
            dr.ellipse([x - 30, y - 62, x + 30, y - 2], fill=dark)
            dr.rectangle([x - 8, y - 120, x + 8, y - 50], fill=dark)
        else:   # Reagenzglas im Ständer
            dr.rectangle([x - 26, y - 14, x + 26, y], fill=dark)
            for k in (-15, 0, 15):
                dr.rounded_rectangle([x + k - 5, y - 80, x + k + 5, y - 6], radius=5, fill=dark)
    r = random.Random(seed)
    for _ in range(26):
        x, y, s = r.uniform(0.1, 0.9) * w, r.uniform(0.1, 0.75) * h, r.uniform(2, 7)
        dr.ellipse([x - s, y - s, x + s, y + s], outline=(170, 255, 200), width=2)
    save(np.asarray(d.filter(ImageFilter.GaussianBlur(2.2)), np.float32), name)


def kacheln(name, base, fuge, n=8, w=512, seed=101, var=0.06):
    """Quadratische Fliesen mit Fugen, jede Fliese leicht anders getönt, feiner Glanzstreifen (Labor-Wand)."""
    r = random.Random(seed)
    arr = np.zeros((w, w, 3), np.float32)
    s = w // n
    for j in range(n):
        for i in range(n):
            arr[j * s:(j + 1) * s, i * s:(i + 1) * s] = hexrgb(base) * r.uniform(1 - var, 1 + var)
    yy, xx = np.mgrid[0:w, 0:w]
    g = ((xx % s) < 3) | ((yy % s) < 3)
    arr[g] = hexrgb(fuge)
    hl = ((xx % s) > s * 0.15) & ((xx % s) < s * 0.28) & ((yy % s) > s * 0.12) & ((yy % s) < s * 0.8)
    arr[hl] *= 1.06
    arr *= (0.93 + 0.1 * noise(w, w, 4, 3, seed))[..., None]
    save(np.asarray(Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7)), np.float32), name)


def schachbrett(name, a, b, n=4, w=512, seed=103):
    """Schachbrett-Fliesen (Laborboden): kachelbar, mit dunklen Fugen und leichten Gebrauchsspuren."""
    s = w // n
    yy, xx = np.mgrid[0:w, 0:w]
    k = ((xx // s + yy // s) % 2)[..., None]
    arr = hexrgb(a) * k + hexrgb(b) * (1 - k)
    arr[((xx % s) < 2) | ((yy % s) < 2)] *= 0.6
    n_ = noise(w, w, 6, 4, seed)
    n_ = (n_ + n_[:, ::-1] + n_[::-1, :] + n_[::-1, ::-1]) / 4
    arr *= (0.9 + 0.18 * n_)[..., None]
    save(arr, name)


def warnstreifen(name, w=512, h=64):
    """Gelb-schwarze Warnschraffur (Sockel der Laborwand)."""
    yy, xx = np.mgrid[0:h, 0:w]
    k = (((xx + yy) // 32) % 2)[..., None]
    arr = hexrgb('#e2c040') * (1 - k) + hexrgb('#222028') * k
    arr *= (0.9 + 0.15 * noise(w, h, 6, 3, 105))[..., None]
    save(arr, name)


def kreidetafel(name, w=1024, h=600, seed=107):
    """Tafel im Labor: „E = mc²“, darunter durchgestrichen „E = mc Toast“, gelb „Brot kaufen!“, Kritzeleien (Toast, Tentakel, Formeln)."""
    from PIL import ImageFont
    arr = hexrgb('#1f3a2a') * np.ones((h, w, 1), np.float32)
    arr *= (0.85 + 0.25 * noise(w, h, 4, 4, seed))[..., None]
    d = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    dr = ImageDraw.Draw(d, 'RGBA')
    r = random.Random(seed)
    for _ in range(18):   # alte, schlecht weggewischte Kreide
        x, y = r.randint(0, w), r.randint(0, h)
        dr.ellipse([x - 90, y - 26, x + 90, y + 26], fill=(220, 235, 220, 14))
    f1 = ImageFont.truetype('C:/Windows/Fonts/segoeprb.ttf', 96)
    f2 = ImageFont.truetype('C:/Windows/Fonts/segoepr.ttf', 78)
    f3 = ImageFont.truetype('C:/Windows/Fonts/segoeprb.ttf', 70)
    f4 = ImageFont.truetype('C:/Windows/Fonts/segoepr.ttf', 40)
    chalk = (232, 240, 224, 235)
    dr.text((120, 60), 'E = mc²', font=f1, fill=chalk)
    dr.text((300, 215), 'E = mc Toast', font=f2, fill=chalk)
    dr.line([(300, 270), (770, 255)], fill=chalk, width=7)
    dr.text((470, 385), 'Brot kaufen!', font=f3, fill=(255, 214, 70, 240))
    dr.text((640, 90), '∫ Toast dt = ?', font=f4, fill=(232, 240, 224, 180))
    dr.text((80, 420), 'Zeit + Klo = ☺', font=f4, fill=(232, 240, 224, 180))
    # Toast-Kritzelei mit Pfeil
    dr.rounded_rectangle([800, 300, 910, 410], radius=24, outline=chalk, width=6)
    dr.arc([808, 280, 902, 330], 180, 360, fill=chalk, width=6)
    dr.ellipse([830, 340, 842, 352], fill=chalk); dr.ellipse([866, 340, 878, 352], fill=chalk)
    dr.arc([834, 352, 874, 384], 20, 160, fill=chalk, width=5)
    dr.line([(730, 470), (795, 425)], fill=chalk, width=5)
    dr.line([(795, 425), (770, 428)], fill=chalk, width=5)
    dr.line([(795, 425), (787, 449)], fill=chalk, width=5)
    # kleines lila Tentakel mit Saugnäpfen
    lila = (200, 140, 255, 220)
    pts = [(120 + math.sin(t / 7) * 22, 380 - t * 1.6) for t in range(0, 90)]
    dr.line(pts, fill=lila, width=16, joint='curve')
    for t in range(10, 80, 18):
        x, y = 120 + math.sin(t / 7) * 22 + 10, 380 - t * 1.6
        dr.ellipse([x - 4, y - 4, x + 4, y + 4], outline=(255, 220, 255, 230), width=2)
    dr.ellipse([108, 228, 120, 240], fill=(255, 255, 255, 230))
    d = d.filter(ImageFilter.GaussianBlur(0.8))
    save(np.asarray(d, np.float32), name)


def landschaft(name, w=1024, h=640, seed=111):
    """Blick aus dem Gasthaus 1776: Sommerhimmel mit Wolken, grüne Hügel, Bäume, ein Weidezaun und zwei Pferde in der Ferne."""
    yy = np.linspace(0, 1, h)[:, None, None]
    arr = (hexrgb('#62bdf6') * (1 - yy) + hexrgb('#e6f6ff') * yy) * np.ones((1, w, 1), np.float32)
    d = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    dr = ImageDraw.Draw(d)
    r = random.Random(seed)
    for cx_, cy_, s in ((180, 110, 1.0), (560, 70, 1.3), (860, 150, 0.9)):   # Wolken
        for dx, dy, rx, ry in ((0, 0, 70, 34), (50, -18, 52, 34), (-52, 4, 44, 26), (26, 12, 56, 26)):
            dr.ellipse([cx_ + dx * s - rx * s, cy_ + dy * s - ry * s, cx_ + dx * s + rx * s, cy_ + dy * s + ry * s], fill=(255, 255, 255))
    d = d.filter(ImageFilter.GaussianBlur(1.5))
    dr = ImageDraw.Draw(d)
    for k, (col, y0, amp) in enumerate((('#9fd88a', 0.48, 40), ('#7cc95a', 0.58, 50), ('#5fae3e', 0.7, 34))):   # drei Hügelketten
        pts = [(x, h * y0 + math.sin(x / w * (3 + k) * math.pi + k) * amp + math.sin(x / w * 11 + k * 2) * 10) for x in range(0, w + 8, 8)]
        dr.polygon(pts + [(w, h), (0, h)], fill=col)
    for x, y, s in ((140, 0.56, 1.0), (300, 0.6, 0.8), (720, 0.55, 1.1), (900, 0.62, 0.9)):   # Bäume
        y = h * y
        dr.rectangle([x - 5 * s, y - 10 * s, x + 5 * s, y + 30 * s], fill=(107, 68, 36))
        dr.ellipse([x - 40 * s, y - 70 * s, x + 40 * s, y + 4 * s], fill=(79, 154, 58))
        dr.ellipse([x - 26 * s, y - 84 * s, x + 30 * s, y - 30 * s], fill=(95, 176, 70))
    fy = h * 0.8   # Weidezaun
    dr.line([(0, fy), (w, fy - 12)], fill=(176, 122, 60), width=6)
    for x in range(10, w, 60):
        dr.rectangle([x, fy - 26 - x * 0.012, x + 7, fy + 18 - x * 0.012], fill=(198, 148, 88))
    for x, y, fl_ in ((420, 0.66, 1), (560, 0.69, -1)):   # Pferde als Silhouetten
        y = h * y
        dr.ellipse([x - 26, y - 14, x + 26, y + 10], fill=(110, 70, 40))
        dr.polygon([(x + fl_ * 20, y - 8), (x + fl_ * 40, y - 34), (x + fl_ * 50, y - 28), (x + fl_ * 30, y)], fill=(110, 70, 40))
        for lx in (-18, -8, 10, 20):
            dr.line([(x + lx, y + 6), (x + lx, y + 28)], fill=(90, 56, 32), width=5)
    save(np.asarray(d.filter(ImageFilter.GaussianBlur(0.8)), np.float32), name)


def unterschrift(name, w=512, h=360):
    """Zettel auf Hancocks Tisch: vergilbtes Papier, ein paar Zeilen Schreibschrift und riesig „John Hancock“."""
    from PIL import ImageFont
    arr = hexrgb('#f4ecd6') * np.ones((h, w, 1), np.float32)
    arr *= (0.9 + 0.12 * noise(w, h, 5, 3, 117))[..., None]
    d = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    dr = ImageDraw.Draw(d)
    ink = (40, 28, 50)
    small = ImageFont.truetype('C:/Windows/Fonts/segoesc.ttf', 22)
    for i, t in enumerate(('Wir halten diese Wahrheiten', 'für selbstverständlich, dass', 'jeder Toast gleich ist ...')):
        dr.text((40, 30 + i * 34), t, font=small, fill=ink)
    big = ImageFont.truetype('C:/Windows/Fonts/segoescb.ttf', 84)
    dr.text((24, 170), 'John Hancock', font=big, fill=ink)
    dr.arc([30, 250, 480, 330], 190, 350, fill=ink, width=5)   # Unterstreichungs-Schnörkel
    save(np.asarray(d.filter(ImageFilter.GaussianBlur(0.5)), np.float32), name)


JOBS = {
    'gras.png': lambda n: speckle(n, ['#3f7a2c', '#5a9a3a', '#7cbc4a'], blades=True, seed=21),
    'fels.png': lambda n: speckle(n, ['#6a6460', '#8a847c', '#a8a298'], scale=6, cracks=True, seed=22),
    'sand.png': lambda n: speckle(n, ['#d8c088', '#e8d29a', '#f4e4b4'], scale=10, seed=23),
    'marssand.png': lambda n: speckle(n, ['#b4502e', '#cf6c3c', '#e48c54'], scale=9, seed=61, tile=True),   # Marswüste (raum_build.py: Marsgesicht)
    'marsfels.png': lambda n: speckle(n, ['#7e3c2a', '#a85236', '#c8703f'], scale=6, cracks=True, seed=62),
    'holz_steg.png': lambda n: planks(n, 1024, 1024, 8, ['#9a6a3a', '#a8743e', '#8f6236', '#b07c44'], seed=1),
    'holz_rumpf.png': lambda n: planks(n, 1024, 1024, 16, ['#6a3e22', '#5e361e', '#734426', '#58321c'], grain=0.22, seed=2),
    'holz_deck.png': lambda n: planks(n, 1024, 1024, 10, ['#c08a50', '#b47e48', '#c8955a'], grain=0.15, seed=4),
    'holz_fass.png': lambda n: planks(n, 512, 512, 6, ['#b07a40', '#a06c36', '#bc864a'], grain=0.2, nails=False, seed=8),
    'segeltuch.png': canvas_cloth,
    'putz.png': plaster,
    'dachziegel.png': roof_tiles,
    'flagge.png': jolly_roger,
    'schlange.png': schlangenhaut,
    'mauer.png': bruchstein,
    'pflaster.png': lambda n: bruchstein(n, cols=('#6a645c', '#76706a', '#5c5850', '#807a70'), rows=10, seed=43, floor=True),
    # Altbau-Räume in 3D (art/blender/altbau.py)
    'parkett.png': lambda n: planks(n, 1024, 1024, 12, ['#9a5f32', '#8e5530', '#a46838', '#86502c'], grain=0.16, nails=False, seed=52),
    'holz_moebel.png': lambda n: planks(n, 512, 512, 5, ['#6a3a1c', '#5e3218', '#744020'], grain=0.25, nails=False, seed=53),
    'tapete_lila.png': lambda n: tapete(n, '#6a3f96', '#5a3484', '#8b62b8'),
    'zifferblatt.png': zifferblatt,
    'nachthimmel.png': nachthimmel,
    'gemaelde_gertrude.png': lambda n: gemaelde(n, 'art/render/portrait_gertrude.png'),
    'labor_glas.png': labor_glas,
    'kacheln_tuerkis.png': lambda n: kacheln(n, '#2e6964', '#1e4a46'),
    'schachboden.png': lambda n: schachbrett(n, '#465170', '#333b4f'),
    'warnstreifen.png': warnstreifen,
    'kreidetafel.png': kreidetafel,
    'dielen_dunkel.png': lambda n: planks(n, 1024, 1024, 9, ['#6e4626', '#5e3c20', '#7a4e2a', '#664024'], grain=0.2, seed=113),
    'landschaft_1776.png': landschaft,
    'hancock_zettel.png': unterschrift,
}

if __name__ == '__main__':
    import sys
    want = sys.argv[1:] or list(JOBS)   # python art/blender/texturen.py parkett.png tapete_lila.png -> nur diese
    for n in want:
        JOBS[n](n)
    print(sorted(os.listdir(OUT)))
