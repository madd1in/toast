# Raum-Hintergründe fürs Spiel aufbereiten: Blender-Renderings (raum_build.py) direkt als JPG, das Unreal-Rendering der
# Testkammer (art/unreal/testkammer.py) bekommt vorher einen Comic-Look: Tonwerte in Stufen und Tusche-Konturen aus den
# Kanten, damit es zu den Toon-Räumen aus Blender passt. Aufruf aus dem Repo-Ordner:  python art/blender/raum_post.py
import numpy as np
from PIL import Image, ImageFilter

INK = np.array([11, 3, 18], np.float32)


def comic(im):
    a = np.asarray(im.convert('RGB')).astype(np.float32) / 255
    lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
    # Helligkeit in weiche Stufen ziehen (Cel-Shading), Farbe bleibt
    steps = np.round(lum * 6) / 6
    k = np.where(lum > 1e-3, (0.35 * steps + 0.65 * lum) / np.maximum(lum, 1e-3), 1)[..., None]
    a = np.clip(a * k * 0.86, 0, 1)   # etwas dunkler: die weißen Paneele sollen nicht ausbrennen
    m = a.mean(axis=2, keepdims=True)
    a = np.clip(m + (a - m) * 1.25, 0, 1)
    # Konturen: Sobel auf der Helligkeit, Schwelle, leicht verdickt
    L = Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))
    l = np.asarray(L).astype(np.float32)
    gx = np.zeros_like(l); gy = np.zeros_like(l)
    gx[1:-1, 1:-1] = (l[:-2, 2:] + 2 * l[1:-1, 2:] + l[2:, 2:]) - (l[:-2, :-2] + 2 * l[1:-1, :-2] + l[2:, :-2])
    gy[1:-1, 1:-1] = (l[2:, :-2] + 2 * l[2:, 1:-1] + l[2:, 2:]) - (l[:-2, :-2] + 2 * l[:-2, 1:-1] + l[:-2, 2:])
    g = np.hypot(gx, gy)
    edge = Image.fromarray(((g > 85) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    e = np.asarray(edge).astype(np.float32)[..., None] / 255 * 0.72
    out = a * 255 * (1 - e) + INK * e
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


if __name__ == '__main__':
    for name in ('hafen', 'landeplatz'):
        Image.open(f'art/render/raum_{name}.png').convert('RGB').save(f'img/raum_{name}.jpg', quality=86, optimize=True, progressive=True)
    comic(Image.open('art/render/raum_testkammer_ue')).save('img/raum_testkammer.jpg', quality=86, optimize=True, progressive=True)
    import os
    print({n: os.path.getsize(f'img/raum_{n}.jpg') // 1024 for n in ('hafen', 'landeplatz', 'testkammer')}, 'KB')
