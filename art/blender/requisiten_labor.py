# Requisiten des Labors als echte 3D-Modelle fürs Echtzeit-3D (in Blender ausführen, vorher REPO setzen):
#   REPO = r'C:/.../Tentakel-Toast'; exec(open(REPO + '/art/blender/requisiten_labor.py').read())
# Im vorgerenderten Bild sind diese Dinge gezeichnete Überlagerungen (js/story.js, js/gaeste.js, js/cameos.js);
# im Echtzeit-3D stellt js/echt3d-szene.js stattdessen diese Modelle in den Raum:
#   Req_Hamster   – Onkel Eds Hamsterkäfig mit Namensschild, Trinkflasche, Futternapf und drehendem Laufrad (Req_HamsterRad)
#   Req_Absperrband – gelbes TATORT-Band als X vor dem Hebel des Gut-O-Mats, mit flatterndem Ende (Req_BandEnde)
#   Req_Mumie     – Cousin Ted im goldenen Sarkophag, Augen lugen durch die Binden (Req_MumieAugen)
#   Req_Saber     – Lichtschwert-Prototyp auf einem Ständer, Klinge leuchtet (Req_SaberKlinge)
#   Req_Clawd     – der orange Pixel-Kerl, der über dem Gut-O-Mat schwebt
# Jede Wurzel steht im Ursprung, Vorderseite zur Kamera (−y), Maße in Metern. Schreibt img/3d/req_labor.glb.
import bpy, bmesh, math, sys, importlib
sys.path.insert(0, REPO + '/art/blender')
import figur_lib
importlib.reload(figur_lib)
from figur_lib import Builder, toon

SC = bpy.data.scenes.get('Req3D_labor') or bpy.data.scenes.new('Req3D_labor')
for o in list(SC.collection.objects):
    bpy.data.objects.remove(o, do_unlink=True)
B = Builder(SC)


def box(name, loc, size, mat, parent, rot=(0, 0, 0), bevel=0.01):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    return B.obj(name, bm, mat, parent, loc, rot, size, smooth=False, bevel=bevel)


def text(name, body, loc, size, mat, parent, rot=(math.pi / 2, 0, 0)):
    cd = bpy.data.curves.new(name + 'K', 'FONT')
    cd.body, cd.size, cd.align_x, cd.align_y, cd.extrude = body, size, 'CENTER', 'CENTER', 0.004
    cd.materials.append(mat)
    o = bpy.data.objects.new(name, cd)
    SC.collection.objects.link(o)
    o.parent, o.location, o.rotation_euler = parent, loc, rot
    return o


GELB, SCHWARZ = toon('Rq_Gelb', '#ffd23a', hi=0.8), toon('Rq_Schwarz', '#16121e', hi=0.3)
STAHL, CHROM = toon('Rq_Stahl', '#8a92a8', hi=0.7), toon('Rq_Chrom', '#d8dce8', hi=0.9)
GOLD, GOLDD, TUERKIS = toon('Rq_Gold', '#e8b83a', hi=0.8), toon('Rq_GoldDunkel', '#9a6a1a', hi=0.4), toon('Rq_Tuerkis', '#2ab8b0', hi=0.7)
BINDE, BINDED = toon('Rq_Binde', '#efe6c8', hi=0.75), toon('Rq_BindeDunkel', '#b8a882', hi=0.5)
FELL, FELLH, ROSA = toon('Rq_Fell', '#c88a4a', hi=0.6), toon('Rq_FellHell', '#f2d8b0', hi=0.7), toon('Rq_Rosa', '#f48aa0', hi=0.7)
PLASTIK, WASSER = toon('Rq_KaefigRot', '#d83a4a', hi=0.6), toon('Rq_WasserGlas', '#7ac8f0', hi=0.9)
ORANGE = toon('Rq_ClawdOrange', '#e8783a', hi=0.6)
NEON = toon('Rq_SaberNeon', '#7af0ff', hi=1.0)
_emi = NEON.node_tree.nodes.get('ToonEmi')
if _emi is not None:
    _emi.inputs['Strength'].default_value = 2.0   # Klinge leuchtet (Export: Emission)

# ---------------------------------------------------------------- Onkel Eds Hamsterkäfig
H = B.empty('Req_Hamster')
box('Req_KaefigWanne', (0, 0, 0.06), (0.84, 0.5, 0.12), PLASTIK, H, bevel=0.02)
box('Req_KaefigStreu', (0, 0, 0.115), (0.8, 0.46, 0.02), toon('Rq_Streu', '#e8d49a', hi=0.6), H, bevel=0.0)
for i in range(15):   # Gitterstäbe vorn und hinten
    x = -0.4 + i * (0.8 / 14)
    for y in (-0.24, 0.24):
        B.rod(f'Req_KaefigStabV{i}{"v" if y < 0 else "h"}', (x, y, 0.12), (x, y, 0.62), 0.006, CHROM, H, seg=6)
for i in range(9):   # seitlich
    y = -0.24 + i * (0.48 / 8)
    for x in (-0.41, 0.41):
        B.rod(f'Req_KaefigStabS{i}{"l" if x < 0 else "r"}', (x, y, 0.12), (x, y, 0.62), 0.006, CHROM, H, seg=6)
for z in (0.36, 0.62):   # Querstreben
    for y in (-0.24, 0.24):
        B.rod(f'Req_KaefigQuer{z}{y}', (-0.41, y, z), (0.41, y, z), 0.008, CHROM, H, seg=6)
    for x in (-0.41, 0.41):
        B.rod(f'Req_KaefigQuerS{z}{x}', (x, -0.24, z), (x, 0.24, z), 0.008, CHROM, H, seg=6)
box('Req_KaefigDach', (0, 0, 0.63), (0.84, 0.5, 0.02), CHROM, H, bevel=0.005)
B.torus('Req_KaefigGriff', (0, 0, 0.66), 0.1, 0.012, CHROM, H, rot=(math.pi / 2, 0, 0), seg=20, sseg=6)
box('Req_KaefigSchild', (0, -0.262, 0.48), (0.22, 0.012, 0.1), toon('Rq_SchildWeiss', '#f4f0e0', hi=0.8), H, bevel=0.0)
text('Req_KaefigSchildText', 'ED', (0, -0.27, 0.48), 0.08, toon('Rq_SchildRot', '#c82a2a'), H)
B.rod('Req_Flasche', (0.36, -0.2, 0.3), (0.36, -0.2, 0.56), 0.035, WASSER, H, seg=12)   # Trinkflasche ans Gitter geklemmt
B.rod('Req_FlascheRohr', (0.36, -0.2, 0.3), (0.3, -0.16, 0.24), 0.006, CHROM, H, seg=6)
B.cone('Req_Napf', 0.12, 0.17, 0.06, 0.08, toon('Rq_Napf', '#4a7ad8', hi=0.6), H, xy=(-0.25, 0.05), seg=16, bevel=0.0)
RAD = B.empty('Req_HamsterRad'); RAD.parent = H; RAD.location = (0.08, 0.02, 0.33)   # Laufrad: dreht um seine y-Achse
for k in (-1, 1):
    B.torus(f'Req_RadRing{k}', (0, k * 0.07, 0), 0.19, 0.01, toon('Rq_RadBlau', '#3aa0e8', hi=0.7), RAD, rot=(math.pi / 2, 0, 0), seg=28, sseg=6)
for i in range(14):
    a = i / 14 * 2 * math.pi
    B.rod(f'Req_RadSprosse{i}', (math.cos(a) * 0.19, -0.07, math.sin(a) * 0.19), (math.cos(a) * 0.19, 0.07, math.sin(a) * 0.19), 0.006, toon('Rq_RadBlau', '#3aa0e8', hi=0.7), RAD, seg=6)
B.rod('Req_RadAchse', (0, 0.07, 0), (0, 0.24, 0), 0.01, CHROM, RAD, seg=6)
TIER = B.empty('Req_HamsterTier'); TIER.parent = H; TIER.location = (0.08, 0.02, 0.17)   # Ed läuft unten im Rad
B.sphere('Req_HamsterBauch', (0, 0, 0.05), (0.075, 0.05, 0.05), FELL, TIER)
B.sphere('Req_HamsterBrust', (0.04, 0, 0.04), (0.045, 0.04, 0.035), FELLH, TIER)
B.sphere('Req_HamsterKopf', (0.08, 0, 0.07), (0.04, 0.038, 0.036), FELL, TIER)
for k in (-1, 1):
    B.sphere(f'Req_HamsterOhr{k}', (0.07, k * 0.025, 0.105), (0.012, 0.016, 0.016), ROSA, TIER)
    B.sphere(f'Req_HamsterAuge{k}', (0.112, k * 0.018, 0.08), (0.008, 0.008, 0.009), SCHWARZ, TIER)
B.sphere('Req_HamsterNase', (0.12, 0, 0.065), (0.007, 0.007, 0.006), ROSA, TIER)

# ---------------------------------------------------------------- TATORT-Absperrband
A = B.empty('Req_Absperrband')
for k, w in ((0, 0.42), (1, -0.42)):
    S = B.empty(f'Req_Band{k}'); S.parent = A; S.rotation_euler = (0, w, 0); S.location = (0, -0.02 * k, 0)
    box(f'Req_BandStreifen{k}', (0, 0, 0), (1.55, 0.008, 0.14), GELB, S, bevel=0.0)
    for j, x in enumerate((-0.42, 0.42)):
        text(f'Req_BandText{k}{j}', 'TATORT', (x, -0.006, -0.03), 0.075, SCHWARZ, S)
E = B.empty('Req_BandEnde'); E.parent = A; E.location = (0.72, -0.03, -0.3)   # flatterndes Ende
box('Req_BandEndeStreifen', (0.05, 0, -0.12), (0.12, 0.008, 0.26), GELB, E, rot=(0, -0.3, 0), bevel=0.0)

# ---------------------------------------------------------------- Cousin Ted im Sarkophag
M = B.empty('Req_Mumie')
box('Req_SarkRueck', (0, 0.2, 1.2), (0.86, 0.08, 2.4), GOLD, M, bevel=0.03)
for k in (-1, 1):
    box(f'Req_SarkWand{k}', (k * 0.41, 0.0, 1.2), (0.06, 0.44, 2.4), GOLD, M, bevel=0.02)
    for i in range(5):   # türkise Zierstreifen
        box(f'Req_SarkZier{k}{i}', (k * 0.41, -0.225, 0.35 + i * 0.45), (0.065, 0.012, 0.08), TUERKIS, M, bevel=0.0)
box('Req_SarkDach', (0, 0.0, 2.42), (0.9, 0.46, 0.08), GOLDD, M, bevel=0.02)
box('Req_SarkSockel', (0, 0.0, 0.04), (0.92, 0.48, 0.08), GOLDD, M, bevel=0.02)
B.sphere('Req_SarkKrone', (0, -0.06, 2.5), (0.14, 0.04, 0.12), GOLD, M)
for i in range(13):   # Ted: Lage um Lage gewickelt, leicht versetzt
    z = 0.18 + i * 0.16
    r = 0.2 + 0.05 * math.sin(i / 12 * math.pi) - (0.08 if i > 10 else 0)
    B.torus(f'Req_MumieLage{i}', (0.012 * ((i % 3) - 1), 0.02, z), r, 0.055, BINDE if i % 2 else BINDED, M, rot=(0, 0.06 * ((i % 2) * 2 - 1), 0), scale=(1, 0.7, 1), seg=20, sseg=8)
B.sphere('Req_MumieKopf', (0, 0.02, 2.13), (0.16, 0.14, 0.18), BINDE, M)
AU = B.empty('Req_MumieAugen'); AU.parent = M; AU.location = (0, -0.12, 2.15)
for k in (-1, 1):
    B.sphere(f'Req_MumieAuge{k}', (k * 0.055, 0, 0), (0.03, 0.012, 0.024), toon('Rq_AugeWeiss', '#ffffff', hi=0.9), AU)
    B.sphere(f'Req_MumiePupille{k}', (k * 0.055 + 0.006, -0.012, -0.003), (0.011, 0.006, 0.011), SCHWARZ, AU)
box('Req_MumieBindeLos', (0.17, -0.05, 1.2), (0.05, 0.01, 0.4), BINDE, M, rot=(0, 0.25, 0), bevel=0.0)

# ---------------------------------------------------------------- Lichtschwert-Prototyp auf dem Ständer
L = B.empty('Req_Saber')
box('Req_SaberStaender', (0, 0, 0.03), (0.22, 0.16, 0.06), toon('Rq_Holz', '#7a4a2a', hi=0.4), L, bevel=0.01)
B.rod('Req_SaberHalter', (0, 0, 0.06), (0, 0, 0.16), 0.012, STAHL, L, seg=8)
B.rod('Req_SaberGriff', (0, 0, 0.14), (0, 0, 0.36), 0.026, STAHL, L, seg=12)
for i in range(3):
    B.torus(f'Req_SaberRille{i}', (0, 0, 0.18 + i * 0.05), 0.027, 0.005, SCHWARZ, L, seg=12, sseg=4)
B.sphere('Req_SaberKnopf', (0, -0.026, 0.3), (0.008, 0.006, 0.012), toon('Rq_KnopfRot', '#e82a2a', hi=0.8), L)
B.rod('Req_SaberKlinge', (0, 0, 0.36), (0, 0, 0.88), 0.018, NEON, L, seg=12)
B.sphere('Req_SaberSpitze', (0, 0, 0.88), (0.018, 0.018, 0.022), NEON, L)

# ---------------------------------------------------------------- Clawd, der Pixel-Kerl
C = B.empty('Req_Clawd')
box('Req_ClawdKoerper', (0, 0, 0.28), (0.5, 0.28, 0.3), ORANGE, C, bevel=0.0)
for k in (-1, 1):
    box(f'Req_ClawdArm{k}', (k * 0.31, 0, 0.28), (0.12, 0.2, 0.1), ORANGE, C, bevel=0.0)
    box(f'Req_ClawdAuge{k}', (k * 0.1, -0.142, 0.31), (0.05, 0.01, 0.1), SCHWARZ, C, bevel=0.0)
for i, x in enumerate((-0.19, -0.07, 0.07, 0.19)):
    box(f'Req_ClawdBein{i}', (x, 0, 0.07), (0.06, 0.12, 0.14), ORANGE, C, bevel=0.0)

roots = [H, A, M, L, C]
print('Requisiten Labor:', len(SC.objects), 'Objekte')
exec(open(REPO + '/art/blender/echt3d_export.py', encoding='utf-8').read().split('\nWHAT = globals()')[0])   # nur die Funktionen
export('req_labor', [o for o in SC.objects])
