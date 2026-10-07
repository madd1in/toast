# Baut die Szene "NPC3D" mit Dr. Fred, Gertrude und Hancock (Blick nach +X, wie die Helden)
import bpy, math, sys, importlib
sys.path.insert(0, REPO + '/art/blender')
import figur_lib as npc_lib
importlib.reload(npc_lib)
from figur_lib import toon, Builder

src = bpy.data.scenes['Helden3D']
SC = bpy.data.scenes.get('NPC3D') or bpy.data.scenes.new('NPC3D')
for o in list(SC.collection.objects):
    if o.name in ('MondH3', 'FuellH3', 'HeldCam'):
        SC.collection.objects.unlink(o)
    else:
        bpy.data.objects.remove(o, do_unlink=True)
for n in ('MondH3', 'FuellH3', 'HeldCam'):
    SC.collection.objects.link(bpy.data.objects[n])
SC.camera = bpy.data.objects['HeldCam']
SC.world = src.world
r, s = SC.render, src.render
r.engine = s.engine
r.resolution_x, r.resolution_y, r.resolution_percentage = 400, 560, 100
r.film_transparent = True
r.image_settings.file_format = 'PNG'
r.image_settings.color_mode = 'RGBA'
SC.view_settings.view_transform = src.view_settings.view_transform
SC.view_settings.look = src.view_settings.look
SC.eevee.taa_render_samples = src.eevee.taa_render_samples

B = Builder(SC)
SKIN = toon('N_Haut', '#f4cba8')
NOSE = toon('N_Nase', '#f0a283')
WHITE = toon('N_Weiss', '#f3f3f6')
BLACK = toon('N_Schwarz', '#16121e', hi=0.15)
EYE = toon('N_Auge', '#ffffff')
MOUTH = toon('N_Mund', '#7a2230')
GOLD = toon('N_Gold', '#e9b53c', hi=0.6)
YAW = -0.559


def face(root, z, nose=(0.07, 0.06, 0.065), eyes=True, ey=0.058, mouth=True, head=(0.165, 0.155, 0.18), nosemat=NOSE):
    hf = 0.02 + head[0]   # Vorderkante des Kopfes
    B.sphere(root.name + '_Kopf', (0.02, 0, z), head, SKIN, root)
    B.sphere(root.name + '_OhrL', (-0.01, head[1] - 0.005, z - 0.01), (0.035, 0.02, 0.05), SKIN, root)
    B.sphere(root.name + '_OhrR', (-0.01, -head[1] + 0.005, z - 0.01), (0.035, 0.02, 0.05), SKIN, root)
    B.sphere(root.name + '_Nase', (hf + nose[0] * 0.3, 0, z - 0.03), nose, nosemat, root)
    if eyes:
        for k, y in (('L', ey), ('R', -ey)):
            B.sphere(f'{root.name}_Auge{k}', (hf - 0.035, y, z + 0.04), (0.03, 0.034, 0.045), EYE, root)
            B.sphere(f'{root.name}_Pupille{k}', (hf - 0.008, y * 0.95, z + 0.035), (0.012, 0.016, 0.022), BLACK, root)
    if mouth:
        B.sphere(root.name + '_Mund', (hf - 0.02, 0, z - 0.12), (0.014, 0.045, 0.012), MOUTH, root)
    return hf


# ------------------------------------------------------------------ Dr. Fred
def build_fred():
    R = B.empty('DrFred')
    COAT = toon('F_Kittel', '#eef1f4', hi=0.3)
    PANTS = toon('F_Hose', '#7b7f8e')
    SHOE = toon('F_Schuh', '#3b3a46')
    GLASS = toon('F_Glas', '#d9f1ff', hi=0.8)
    RIM = toon('F_Brille', '#2b2a35')
    HAIR = toon('F_Haar', '#f6f6fa', hi=0.2)
    for k, y in (('L', 0.085), ('R', -0.085)):
        B.sphere(f'F_Schuh{k}', (0.06, y, 0.055), (0.15, 0.075, 0.06), SHOE, R)
        B.cone(f'F_Bein{k}', 0.06, 0.6, 0.055, 0.062, PANTS, R, xy=(0, y))
    B.cone('F_Kittel', 0.5, 1.46, 0.25, 0.175, COAT, R, scale=(1, 0.92, 1), bevel=0.03)
    B.cone('F_Kragen', 1.4, 1.5, 0.17, 0.11, COAT, R, bevel=0.02)
    # Knopfleiste und Knöpfe vorn, Brusttasche mit Stiften
    for i, z in enumerate((0.78, 0.98, 1.18)):
        rr = 0.25 - (z - 0.5) / 0.96 * 0.075
        B.sphere(f'F_Knopf{i}', (rr + 0.005, 0, z), (0.012, 0.022, 0.022), toon('F_Knopf', '#b9bdc8'), R)
    B.rod('F_Leiste', (0.252, 0, 0.52), (0.176, 0, 1.44), 0.006, toon('F_Naht', '#c6cad4'), R)
    pk = toon('F_Tasche', '#dfe3ea')
    B.sphere('F_Tasche', (0.17, -0.1, 1.27), (0.02, 0.055, 0.05), pk, R)
    B.rod('F_StiftRot', (0.17, -0.12, 1.27), (0.17, -0.125, 1.38), 0.01, toon('F_Rot', '#d8373d'), R)
    B.rod('F_StiftBlau', (0.17, -0.09, 1.27), (0.172, -0.085, 1.36), 0.01, toon('F_Blau', '#3456d6'), R)
    # Arme: Ärmel und Hände, die rechte Hand hält die Lupe
    B.rod('F_ArmL', (0.0, 0.2, 1.42), (0.03, 0.23, 1.0), 0.06, COAT, R, r1=0.07, bevel=0.02)
    B.sphere('F_HandL', (0.045, 0.235, 0.93), (0.05, 0.045, 0.06), SKIN, R)
    B.rod('F_ArmR', (0.0, -0.2, 1.42), (0.07, -0.25, 1.15), 0.06, COAT, R, r1=0.07, bevel=0.02)
    B.rod('F_UnterarmR', (0.07, -0.25, 1.15), (0.22, -0.22, 1.08), 0.065, COAT, R, r1=0.07, bevel=0.02)
    B.sphere('F_HandR', (0.26, -0.21, 1.08), (0.05, 0.045, 0.055), SKIN, R)
    B.cone('F_Hals', 1.45, 1.56, 0.06, 0.06, SKIN, R)
    z = 1.74
    hf = face(R, z, nose=(0.09, 0.075, 0.08), eyes=False, head=(0.2, 0.185, 0.21))
    # große Brille mit Pupillen
    for k, y in (('L', 0.085), ('R', -0.085)):
        B.torus(f'F_Rand{k}', (hf - 0.015, y, z + 0.05), 0.066, 0.012, RIM, R, rot=(0, math.pi / 2, 0))
        B.sphere(f'F_Glas{k}', (hf - 0.018, y, z + 0.05), (0.012, 0.064, 0.064), GLASS, R)
        B.sphere(f'F_Pupille{k}', (hf - 0.004, y * 0.9, z + 0.045), (0.008, 0.022, 0.026), BLACK, R)
        B.sphere(f'F_Braue{k}', (hf - 0.03, y, z + 0.135), (0.03, 0.065, 0.024), HAIR, R, rot=(0.25 if k == 'L' else -0.25, 0, 0))
    B.rod('F_Steg', (hf - 0.01, 0.022, z + 0.055), (hf - 0.01, -0.022, z + 0.055), 0.009, RIM, R)
    # Lupe in der rechten Hand, Glas nach oben
    B.rod('F_LupeStiel', (0.27, -0.21, 1.03), (0.3, -0.2, 1.2), 0.013, RIM, R)
    B.torus('F_Lupe', (0.33, -0.19, 1.28), 0.075, 0.013, RIM, R, rot=(0, math.pi / 2 - 0.35, 0.25))
    B.sphere('F_LupeGlas', (0.33, -0.19, 1.28), (0.01, 0.072, 0.072), GLASS, R, rot=(0, -0.35, 0.25))
    # wilde weiße Haare an Seiten und Hinterkopf, oben kahl
    tufts = [(-0.15, 0, z + 0.02, 0.11, 0.17, 0.12), (-0.09, 0.17, z + 0.0, 0.1, 0.08, 0.11), (-0.09, -0.17, z + 0.0, 0.1, 0.08, 0.11),
             (-0.19, 0.1, z - 0.07, 0.09, 0.08, 0.09), (-0.19, -0.1, z - 0.07, 0.09, 0.08, 0.09), (-0.02, 0.2, z + 0.07, 0.08, 0.07, 0.09),
             (-0.02, -0.2, z + 0.07, 0.08, 0.07, 0.09), (-0.2, 0, z + 0.11, 0.08, 0.11, 0.08)]
    for i, (x, y, zz, a, b, c) in enumerate(tufts):
        B.sphere(f'F_Haar{i}', (x, y, zz), (a, b, c), HAIR, R)
    for i, (y, zz, tilt) in enumerate(((0.2, z + 0.1, 0.9), (-0.2, z + 0.1, -0.9), (0.16, z + 0.17, 0.5), (-0.16, z + 0.17, -0.5), (0, z + 0.2, 0))):
        B.rod(f'F_Spitze{i}', (-0.12, y * 0.7, zz - 0.04), (-0.14, y * 1.3, zz + 0.1), 0.045, HAIR, R, r1=0.004)
    R.rotation_euler = (0, 0, YAW)
    return R


# ------------------------------------------------------------------ Gertrude (Wirtin 1776)
def build_gertrude():
    R = B.empty('Gertrude')
    SKIRT = toon('G_Rock', '#3f6cc4')
    DOT = toon('G_Punkt', '#eef3ff')
    APRON = toon('G_Schuerze', '#f5f0e4', hi=0.25)
    BOD = toon('G_Mieder', '#7a4828')
    CAP = toon('G_Haube', '#fbfbfd', hi=0.25)
    BAND = toon('G_Band', '#4a7ad0')
    CHEEK = toon('G_Wange', '#f19494')
    HAIR = toon('G_Haar', '#8a5434')
    for k, y in (('L', 0.08), ('R', -0.08)):
        B.sphere(f'G_Schuh{k}', (0.14, y, 0.04), (0.1, 0.06, 0.045), BLACK, R)
    B.cone('G_Rock', 0.02, 0.98, 0.36, 0.19, SKIRT, R, scale=(1, 0.95, 1), bevel=0.03)
    # weiße Punkte auf dem Rock (rundherum, vorn deckt die Schürze ab)
    import random
    rnd = random.Random(7)
    for i in range(46):
        z = 0.1 + (i % 9) * 0.095 + rnd.uniform(-0.02, 0.02)
        a = -math.pi + (i * 2.39996) % (2 * math.pi)
        if abs(a) < 0.62:
            continue
        rr = 0.36 - (z - 0.02) / 0.96 * 0.17 + 0.004
        B.sphere(f'G_Punkt{i}', (rr * math.cos(a), rr * math.sin(a) * 0.95, z), (0.014, 0.014, 0.014), DOT, R)
    B.cone('G_Schuerze', 0.06, 0.96, 0.372, 0.2, APRON, R, seg=48, bevel=0, cut=(-0.62, 0.62), solid=0.012)
    B.cone('G_Mieder', 0.94, 1.36, 0.2, 0.165, BOD, R, bevel=0.02)
    B.cone('G_Bund', 0.93, 0.99, 0.205, 0.2, APRON, R, bevel=0.01)
    B.torus('G_Tuch', (0, 0, 1.37), 0.12, 0.05, APRON, R)
    for k, y in (('L', 0.2), ('R', -0.2)):
        B.sphere(f'G_Puff{k}', (0, y, 1.3), (0.075, 0.07, 0.08), APRON, R)
    B.rod('G_ArmL', (0.0, 0.21, 1.26), (0.08, 0.2, 1.02), 0.045, SKIN, R, r1=0.04)
    B.rod('G_ArmR', (0.0, -0.21, 1.26), (0.1, -0.19, 1.03), 0.045, SKIN, R, r1=0.04)
    B.sphere('G_HandL', (0.11, 0.17, 1.0), (0.05, 0.045, 0.05), SKIN, R)
    B.sphere('G_HandR', (0.13, -0.15, 1.0), (0.05, 0.045, 0.05), SKIN, R)
    B.cone('G_Hals', 1.36, 1.46, 0.055, 0.055, SKIN, R)
    z = 1.6
    hf = face(R, z, nose=(0.065, 0.055, 0.06), head=(0.17, 0.16, 0.18), ey=0.06)
    for k, y in (('L', 0.09), ('R', -0.09)):
        B.sphere(f'G_Wange{k}', (hf - 0.04, y, z - 0.05), (0.02, 0.035, 0.03), CHEEK, R)
    B.sphere('G_Haar', (0.1, 0, z + 0.1), (0.1, 0.15, 0.06), HAIR, R, rot=(0, -0.5, 0))
    B.sphere('G_Haube', (-0.03, 0, z + 0.11), (0.19, 0.185, 0.13), CAP, R)
    B.torus('G_Rueschen', (0.0, 0, z + 0.06), 0.17, 0.035, CAP, R, rot=(0, -0.25, 0), scale=(1, 1.04, 1))
    B.torus('G_Hutband', (-0.02, 0, z + 0.1), 0.172, 0.016, BAND, R, rot=(0, -0.2, 0), scale=(1, 1.04, 1))
    R.rotation_euler = (0, 0, YAW)
    return R


# ------------------------------------------------------------------ Hancock (Gründervater mit Dreispitz und Federkiel)
def build_hancock():
    R = B.empty('Hancock')
    COAT = toon('H_Rock', '#2d4f9e')
    VEST = toon('H_Weste', '#d9c08a')
    BREECH = toon('H_Hose', '#ece6d6')
    STOCK = toon('H_Strumpf', '#f6f6f8')
    WIG = toon('H_Peruecke', '#ececf2', hi=0.25)
    HAT = toon('H_Hut', '#1c1a26', hi=0.2)
    QUILL = toon('H_Feder', '#fbfbfb', hi=0.2)
    for k, y in (('L', 0.09), ('R', -0.09)):
        B.sphere(f'H_Schuh{k}', (0.06, y, 0.05), (0.14, 0.065, 0.05), BLACK, R)
        B.sphere(f'H_Schnalle{k}', (0.12, y, 0.085), (0.02, 0.035, 0.02), GOLD, R)
        B.cone(f'H_Strumpf{k}', 0.06, 0.5, 0.048, 0.056, STOCK, R, xy=(0, y))
        B.cone(f'H_Hose{k}', 0.46, 0.84, 0.07, 0.09, BREECH, R, xy=(0, y), bevel=0.02)
    B.cone('H_Weste', 0.74, 1.4, 0.18, 0.165, VEST, R, bevel=0.02)
    for i, z in enumerate((0.86, 0.98, 1.1, 1.22)):
        rr = 0.18 - (z - 0.74) / 0.66 * 0.015
        B.sphere(f'H_WKnopf{i}', (rr + 0.004, 0, z), (0.01, 0.016, 0.016), GOLD, R)
    # langer Rock, vorn offen, mit Goldborte an den Kanten
    a = 0.6
    B.cone('H_Rock', 0.5, 1.42, 0.25, 0.19, COAT, R, seg=48, bevel=0, cut=(-math.pi, -a), solid=0.02)
    B.cone('H_Rock2', 0.5, 1.42, 0.25, 0.19, COAT, R, seg=48, bevel=0, cut=(a, math.pi), solid=0.02)
    for k, sg in (('L', 1), ('R', -1)):
        p0 = (0.255 * math.cos(a), sg * 0.255 * math.sin(a), 0.5)
        p1 = (0.195 * math.cos(a), sg * 0.195 * math.sin(a), 1.42)
        B.rod(f'H_Borte{k}', p0, p1, 0.014, GOLD, R)
        for i, t in enumerate((0.55, 0.7, 0.85)):
            B.sphere(f'H_Knopf{k}{i}', (p0[0] + (p1[0] - p0[0]) * t + 0.01, p0[1] + (p1[1] - p0[1]) * t, 0.5 + 0.92 * t), (0.016, 0.016, 0.016), GOLD, R)
    B.torus('H_Saum', (0, 0, 0.51), 0.25, 0.012, GOLD, R)
    B.cone('H_Kragen', 1.36, 1.46, 0.17, 0.1, COAT, R, bevel=0.02)
    B.sphere('H_Jabot', (0.13, 0, 1.36), (0.05, 0.07, 0.09), STOCK, R)
    # Arme: der linke hängt, der rechte hält den Federkiel vor die Brust
    B.rod('H_ArmL', (0.0, 0.21, 1.38), (0.04, 0.24, 1.0), 0.06, COAT, R, r1=0.065, bevel=0.02)
    B.torus('H_ManschL', (0.045, 0.242, 0.98), 0.055, 0.02, GOLD, R)
    B.sphere('H_HandL', (0.05, 0.245, 0.92), (0.045, 0.04, 0.055), SKIN, R)
    B.rod('H_ArmR', (0.0, -0.21, 1.38), (0.06, -0.25, 1.12), 0.06, COAT, R, r1=0.065, bevel=0.02)
    B.rod('H_UnterarmR', (0.06, -0.25, 1.12), (0.2, -0.17, 1.12), 0.06, COAT, R, r1=0.062, bevel=0.02)
    B.torus('H_ManschR', (0.21, -0.165, 1.12), 0.055, 0.02, GOLD, R, rot=(0, math.pi / 2, 0.5))
    B.sphere('H_HandR', (0.25, -0.15, 1.12), (0.05, 0.045, 0.05), SKIN, R)
    B.sphere('H_Feder', (0.3, -0.14, 1.26), (0.022, 0.01, 0.15), QUILL, R, rot=(0, 0.45, 0))
    B.rod('H_Kiel', (0.25, -0.145, 1.1), (0.27, -0.143, 1.15), 0.006, BLACK, R)
    B.cone('H_Hals', 1.42, 1.52, 0.055, 0.055, SKIN, R)
    z = 1.64
    hf = face(R, z, nose=(0.085, 0.05, 0.05), head=(0.165, 0.155, 0.18), ey=0.058)
    for k, y in (('L', 0.06), ('R', -0.06)):
        B.sphere(f'H_Braue{k}', (hf - 0.03, y, z + 0.1), (0.02, 0.04, 0.012), toon('H_Braue', '#6d6a74'), R)
    # Perücke mit Seitenlocken und Zopf mit schwarzer Schleife
    B.sphere('H_Peruecke', (-0.02, 0, z + 0.05), (0.175, 0.165, 0.15), WIG, R)
    for k, y in (('L', 0.155), ('R', -0.155)):
        for i, zz in enumerate((z - 0.0, z - 0.075)):
            B.rod(f'H_Locke{k}{i}', (-0.08, y, zz), (0.06, y, zz), 0.035, WIG, R, r1=0.035)
    B.sphere('H_Zopf', (-0.19, 0, z - 0.12), (0.045, 0.04, 0.11), WIG, R)
    B.sphere('H_SchleifeL', (-0.19, 0.035, z - 0.04), (0.02, 0.04, 0.03), BLACK, R)
    B.sphere('H_SchleifeR', (-0.19, -0.035, z - 0.04), (0.02, 0.04, 0.03), BLACK, R)
    # Dreispitz: Krempe als gerundetes Dreieck (eine Spitze nach vorn), Goldborte oben
    B.cone('H_Hut', z + 0.11, z + 0.2, 0.3, 0.255, HAT, R, seg=3, bevel=0.045, xy=(-0.01, 0))
    B.sphere('H_HutKopf', (-0.02, 0, z + 0.2), (0.14, 0.13, 0.07), HAT, R)
    B.cone('H_HutBorte', z + 0.195, z + 0.215, 0.262, 0.262, GOLD, R, seg=3, bevel=0.008, xy=(-0.01, 0))
    R.rotation_euler = (0, 0, YAW)
    return R


ROOTS = [build_fred(), build_gertrude(), build_hancock()]
print('ok', [len(r.children) for r in ROOTS])
