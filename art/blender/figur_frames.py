# Posen einer Figur rendern (nach figur_rig.py; vorher REPO, NAME und optional ONLY setzen) und
# Ankerpunkte (Fuß, Mund, Augen, rechte Hand) in Bildpixeln nach art/render/<name>/meta.json schreiben.
import bpy, math, json, os, random
from mathutils import Euler, Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view

cfg = CHARS[NAME]
P = cfg['rp']
SC = bpy.data.scenes[cfg['scene']]
OB = bpy.data.objects
OUT = REPO + f'/art/render/{NAME}/'
os.makedirs(OUT, exist_ok=True)
legs = bool(cfg['hip'])
hz = cfg['hip'][0] if legs else 0.9
SH_AT = {'R': Vector((0, -cfg['sh'][1], cfg['sh'][0] - hz)), 'L': Vector((0, cfg['sh'][1], cfg['sh'][0] - hz))}   # Schulter im Rumpf-Raum


def hand_fk(k, rx, ry, ey):
    m = Matrix.Translation(SH_AT[k]) @ Euler((rx, ry, 0), 'XYZ').to_matrix().to_4x4() @ Matrix.Translation((0, 0, -cfg['upper'])) @ Euler((0, ey, 0), 'XYZ').to_matrix().to_4x4()
    return m @ Vector(cfg['hand_off'])


def ik(k, target, start=(0.0, -1.5, -1.0)):
    """Schulter (rx, ry) und Ellbogen (ey) so wählen, dass die Hand am Ziel (Rumpf-Raum) liegt; der Ellbogen knickt nur nach vorn."""
    t = Vector(target)
    best = list(start)
    err = lambda p: (hand_fk(k, *p) - t).length + (0 if p[2] <= 0 else p[2] * 2)
    e = err(best)
    rnd = random.Random(3)
    step = 0.6
    for _ in range(4000):
        cand = [best[i] + rnd.uniform(-step, step) for i in range(3)]
        ec = err(cand)
        if ec < e:
            best, e = cand, ec
        step = max(0.01, step * 0.9985)
    return best, e


ab = cfg['abd']
BASE = dict(aR=-0.12, aL=0.12, eR=0.12, eL=0.12, xR=-ab, xL=ab, tR=0, tL=0, kR=0, kL=0, fR=1, fL=1, lean=0, roll=0, ground=True)
BASE.update(cfg.get('base', {}))   # eigene Grundhaltung (Hancock hält die Feder vor sich)


def Pz(**kw):
    p = dict(BASE)
    p.update(kw)
    return p


FRAMES = [('idle', Pz())]
st, kn = cfg['stride'], cfg['knee']
for i in range(8):
    ph = 2 * math.pi * i / 8
    s, c = math.sin(ph), math.cos(ph)
    w = Pz(tR=-st * s, tL=st * s, kR=max(0, c) * kn, kL=max(0, -c) * kn,
           fR=1 - 0.4 * max(0, c), fL=1 - 0.4 * max(0, -c),
           aR=-0.12 + 0.4 * s, aL=0.12 - 0.4 * s, eR=0.12 + max(0, -s) * 0.5, eL=0.12 + max(0, s) * 0.5, lean=0.035)
    if not legs:
        w['roll'] = 0.045 * s   # ohne sichtbare Beine (langer Rock): watscheln
    if cfg.get('base'):
        w.update({k: v for k, v in cfg['base'].items() if k[0] in 'axe' and k[1] == 'R'})   # Feder-Arm bleibt vorn
    FRAMES.append((f'walk{i}', w))
FRAMES += [
    ('talk0', Pz(aR=-0.7, eR=0.65, xR=-ab * 0.4)),
    ('talk1', Pz(aR=-0.18, eR=0.6)),
    ('reach', Pz(aR=-1.35, eR=0.15, xR=0.05 - ab * 0.5)),
    ('pick', Pz(aR=-0.9, eR=0.2, aL=0.3, tR=-0.75, tL=-0.75, kR=1.5, kL=1.5, lean=0.32)),
    ('pull', Pz(aR=-1.1, eR=0.5, lean=-0.1, tR=-0.25, tL=-0.25, kR=0.5, kL=0.5)),
    ('wave', Pz(xR=-2.45, aR=0.15, eR=0.3)),
    ('yawn', Pz(aR=-2.85, aL=-2.9, eR=0.7, eL=0.7, xR=-0.5, xL=0.5, lean=-0.08)),
    ('saber0', Pz(aR=-2.15, eR=0.15)),
    ('saber1', Pz(aR=-1.6, eR=0.15)),
    ('saber2', Pz(aR=-1.05, eR=0.15)),
    ('pour', Pz(aR=-1.25, eR=0.7, aL=-1.05, eL=0.6, lean=0.06)),
    ('dig0', Pz(aR=-0.95, eR=0.5, aL=-0.8, eL=0.6, tR=-0.22, tL=-0.22, kR=0.45, kL=0.45, lean=0.06)),
    ('dig1', Pz(aR=-0.05, eR=0.5, aL=0.1, eL=0.6, tR=-0.52, tL=-0.52, kR=1.05, kL=1.05, lean=0.06)),
    ('rope0', Pz(aR=-1.9, eR=0.4, aL=-3.0, eL=0.4, xL=0.3, tR=-0.2, tL=-0.2, kR=0.4, kL=0.4)),
    ('rope1', Pz(aR=-3.0, eR=0.4, xR=-0.3, aL=-1.9, eL=0.4, tR=-0.2, tL=-0.2, kR=0.4, kL=0.4)),
    ('airguitar0', Pz(aR=-0.6, eR=1.4, xR=0.35, aL=-1.2, eL=0.5, xL=-0.1, tR=-0.17, tL=-0.17, kR=0.35, kL=0.35, lean=-0.09)),
    ('airguitar1', Pz(aR=-0.25, eR=1.2, xR=0.35, aL=-1.2, eL=0.5, xL=-0.1, tR=-0.17, tL=-0.17, kR=0.35, kL=0.35, lean=-0.09)),
    ('belly0', Pz(aR=-0.75, eR=1.6, xR=0.2, aL=-0.2, eL=1.5, xL=-0.15)),
    ('belly1', Pz(aR=-0.25, eR=1.6, xR=0.2, aL=-0.7, eL=1.5, xL=-0.15)),
    # Nebenfiguren: Dr. Freds Geistesblitz (Zeigefinger-Arm hoch), Gertrude wischt die Hände an der Schürze ab,
    # Hancock unterschreibt schwungvoll in die Luft
    ('idea', Pz(aR=-2.95, eR=0.3, xR=-0.38, lean=-0.04)),
    ('rub0', Pz(aR=-0.55, eR=1.05, xR=0.32, aL=-0.4, eL=1.15, xL=-0.3)),
    ('rub1', Pz(aR=-0.38, eR=1.15, xR=0.3, aL=-0.58, eL=1.05, xL=-0.32)),
    ('sign0', Pz(aR=-1.6, eR=0.1, xR=0.3)),
    ('sign1', Pz(aR=-1.78, eR=0.32, xR=0.14)),
    ('sign2', Pz(aR=-1.45, eR=0.0, xR=0.46)),
]
for i in range(4):   # Klettern: Arme greifen abwechselnd nach oben, Knie hoch; Füße stehen dabei nicht auf dem Boden
    cl = math.sin(i * math.pi / 2)
    FRAMES.append((f'climb{i}', Pz(tR=-0.55 - cl * 0.45, kR=0.9 - cl * 0.5, tL=-0.55 + cl * 0.45, kL=0.9 + cl * 0.5,
                                   aR=-2.55 - cl * 0.45, eR=0.35, aL=-2.75 + cl * 0.45, eL=0.35, xR=-0.15, xL=0.15, ground=False)))
# Hand ans Gesicht per IK: Kinn (Grübeln), Mund (Essen), Augenhöhe (Brille/Stirn)
inv = bpy.data.objects[cfg['src']].matrix_world.inverted()
mouth_at = (inv @ OB[cfg['mouth']].matrix_world).translation
eye_at = (inv @ OB[cfg['eyes'][0]].matrix_world).translation
for nm, tgt in (('think', (mouth_at.x, -0.03, mouth_at.z - 0.06 - hz)), ('eat', (mouth_at.x + 0.06, -0.03, mouth_at.z - hz)), ('glasses', (eye_at.x + 0.04, -0.06, eye_at.z - hz))):
    if cfg.get('frames') and nm not in cfg['frames']:
        continue
    (rx, ry, ey), e = ik('R', tgt)
    print(nm, 'ik', round(rx, 2), round(ry, 2), round(ey, 2), 'err', round(e, 3))
    FRAMES.append((nm, Pz(xR=rx, aR=ry, eR=-ey)))
if cfg.get('frames'):
    FRAMES = [f for f in FRAMES if f[0] in cfg['frames']]


def apply(p):
    for k in 'RL':
        if legs:
            t, kn_, f = p['t' + k], p['k' + k], p['f' + k]
            OB[f'{P}R_Hip{k}'].rotation_euler = (0, t, 0)
            OB[f'{P}R_Knie{k}'].rotation_euler = (0, kn_, 0)
            OB[f'{P}R_Knoechel{k}'].rotation_euler = (0, -(t + kn_) * f, 0)
        OB[f'{P}R_Schulter{k}'].rotation_euler = (p['x' + k], p['a' + k], 0)
        OB[f'{P}R_Ellbogen{k}'].rotation_euler = (0, -p['e' + k], 0)
    OB[f'{P}R_Torso'].rotation_euler = (p['roll'], p['lean'], 0)
    drop = min(hz - cfg['sole'] - cfg['thigh'] * math.cos(p['t' + k]) - cfg['shin'] * math.cos(p['t' + k] + p['k' + k]) for k in 'RL') if legs and p['ground'] else 0
    OB[f'{P}R_Body'].location = (0, 0, -drop)


win = bpy.context.window
prev = win.scene
win.scene = SC
cam = SC.camera
W, H = SC.render.resolution_x, SC.render.resolution_y


def px(co):
    v = world_to_camera_view(SC, cam, co)
    return [round(v.x * W, 1), round((1 - v.y) * H, 1)]


ONLY = globals().get('ONLY')
meta = {'res': [W, H], 'ppm': H / cam.data.ortho_scale, 'frames': []}
try:
    for nm, p in FRAMES:
        if ONLY and nm not in ONLY:
            continue
        apply(p)
        bpy.context.view_layer.update()
        meta['frames'].append({'name': nm, 'foot': px(OB[f'{P}Rig'].matrix_world.translation), 'mouth': px(OB['R' + cfg['mouth']].matrix_world.translation),
                               'eyes': [px(OB['R' + e].matrix_world.translation) for e in cfg['eyes']],
                               'hand': px(OB['R' + cfg['hand'].format(k='R')].matrix_world.translation)})
        SC.render.filepath = OUT + f'{nm}.png'
        bpy.ops.render.render(write_still=True, scene=SC.name)
    apply(Pz())
finally:
    win.scene = prev
if ONLY and os.path.exists(OUT + 'meta.json'):   # nur einzelne Bilder neu: in die vorhandenen Ankerdaten einsetzen
    old = json.load(open(OUT + 'meta.json'))
    new = {f['name']: f for f in meta['frames']}
    old['frames'] = [new.get(f['name'], f) for f in old['frames']] + [f for f in meta['frames'] if f['name'] not in {g['name'] for g in old['frames']}]
    meta = old
json.dump(meta, open(OUT + 'meta.json', 'w'), indent=1)
print('frames', NAME, [f['name'] for f in meta['frames']])
