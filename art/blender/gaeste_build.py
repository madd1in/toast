# Crossover-Gäste als 3D-Figuren (in Blender ausführen, vorher REPO und NAME setzen):
#   REPO = r'C:/.../Tentakel-Toast'; NAME = 'sam'; exec(open(REPO + '/art/blender/gaeste_build.py').read())
# Eigene Hommage-Modelle im Toon-Look der Spielfiguren (Grundkörper, keine Original-Assets): Gäste aus Sam & Max,
# Maniac Mansion, Monkey Island, Fluch der Karibik, Salad Fingers, Futurama, Portal und Simon the Sorcerer.
# Jede Figur bekommt eine eigene Szene, Arme mit Schulter und Ellbogen; gerendert werden Stand und Gesten.
# Schreibt art/render/<name>/*.png und meta.json (danach figur_post.py und figur_js.py).
import bpy, bmesh, json, math, os, sys, importlib
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
sys.path.insert(0, REPO + '/art/blender')
import figur_lib
importlib.reload(figur_lib)
from figur_lib import Builder, toon

YAW = -0.559
SKIN = toon('N_Haut', '#f4cba8')
WHITE = toon('N_Weiss', '#f3f3f6')
BLACK = toon('N_Schwarz', '#16121e', hi=0.15)
EYE = toon('N_Auge', '#ffffff')
MOUTH = toon('N_Mund', '#7a2230')
GOLD = toon('N_Gold', '#e9b53c', hi=0.6)


def scene_for(name):
    SC = bpy.data.scenes.get('Gast3D_' + name) or bpy.data.scenes.new('Gast3D_' + name)
    keep = ('MondH3', 'FuellH3', 'RigCam')
    for o in list(SC.collection.objects):
        if o.name in keep:
            SC.collection.objects.unlink(o)
        else:
            bpy.data.objects.remove(o, do_unlink=True)
    for n in keep:
        SC.collection.objects.link(bpy.data.objects[n])
    hel = bpy.data.scenes['Helden3D']
    SC.camera = bpy.data.objects['RigCam']
    SC.world = hel.world
    r = SC.render
    r.engine = hel.render.engine
    r.resolution_x, r.resolution_y, r.resolution_percentage = 600, 840, 100   # 240 px pro Meter wie die Figuren
    r.film_transparent = True
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    SC.view_settings.view_transform = hel.view_settings.view_transform
    SC.view_settings.look = hel.view_settings.look
    SC.eevee.taa_render_samples = 32
    return SC


def pivot(B, name, parent, loc):
    o = B.empty(name)
    o.parent = parent
    o.location = loc
    return o


def face(B, P, par, z, skin, head=(0.17, 0.16, 0.19), x=0.02, nose=(0.07, 0.06, 0.065), nose_mat=None, eye=(0.035, 0.04, 0.05), ey=0.065,
         eye_mat=None, pupil=(0.014, 0.017, 0.024), mouth=(0.016, 0.05, 0.012), mz=0.12, ears=True):
    """Kopf mit Ohren, Nase, Augen und Mund wie bei den Nebenfiguren; gibt die Vorderkante zurück."""
    hf = x + head[0]
    B.sphere(P + 'Kopf', (x, 0, z), head, skin, par)
    if ears:
        for k, y in (('L', 1), ('R', -1)):
            B.sphere(P + 'Ohr' + k, (x - 0.02, y * (head[1] - 0.005), z - 0.01), (0.035, 0.02, 0.05), skin, par)
    if nose:
        B.sphere(P + 'Nase', (hf + nose[0] * 0.3, 0, z - 0.03), nose, nose_mat or skin, par)
    for k, y in (('L', ey), ('R', -ey)):
        B.sphere(P + 'Auge' + k, (hf - 0.035, y, z + 0.04), eye, eye_mat or EYE, par)
        B.sphere(P + 'Pupille' + k, (hf - 0.008, y * 0.95, z + 0.035), pupil, BLACK, par)
    B.sphere(P + 'Mund', (hf - 0.02, 0, z - mz), mouth, MOUTH, par)
    return hf


def arm(B, P, k, par, at, upper, fore, r, sleeve, hand, hand_s=(0.05, 0.045, 0.06), fore_mat=None):
    sh = pivot(B, f'{P}Sh{k}', par, at)
    B.sphere(f'{P}ShK{k}', (0, 0, 0), (r * 1.1,) * 3, sleeve, sh)
    B.rod(f'{P}OA{k}', (0, 0, 0), (0, 0, -upper), r, sleeve, sh, r1=r * 0.94, seg=20)
    el = pivot(B, f'{P}El{k}', sh, (0, 0, -upper))
    B.sphere(f'{P}ElK{k}', (0, 0, 0), (r * 0.94,) * 3, fore_mat or sleeve, el)
    B.rod(f'{P}UA{k}', (0, 0, 0), (0, 0, -fore), r * 0.94, fore_mat or sleeve, el, r1=r * 0.86, seg=20)
    B.sphere(f'{P}Hand{k}', (0.01, 0, -fore - hand_s[2] * 0.7), hand_s, hand, el)
    return sh, el


def legs(B, P, par, hip_z, gap, r, mat, shoe, shoe_s=(0.13, 0.07, 0.06), r1=None):
    for k, y in (('L', 1), ('R', -1)):
        B.rod(f'{P}Bein{k}', (0, y * gap, hip_z), (0, y * gap, shoe_s[2]), r, mat, par, r1=r1 or r * 0.9, seg=20)
        B.sphere(f'{P}Schuh{k}', (0.05, y * gap, shoe_s[2]), shoe_s, shoe, par)


def tube(SC, name, pts, r, mat, parent, tip=0.6, res=6):
    """Gebogenes Rohr (Haarsträhne, Zopf, Kabel, Antenne) als Kurve mit Rundprofil."""
    cd = bpy.data.curves.get(name) or bpy.data.curves.new(name, 'CURVE')
    cd.splines.clear()
    cd.dimensions = '3D'
    cd.bevel_depth = r
    cd.bevel_resolution = res
    cd.use_fill_caps = True
    sp = cd.splines.new('BEZIER')
    sp.bezier_points.add(len(pts) - 1)
    for i, (p, co) in enumerate(zip(sp.bezier_points, pts)):
        p.co = co
        p.handle_left_type = p.handle_right_type = 'AUTO'
        p.radius = 1 - (1 - tip) * i / max(1, len(pts) - 1)
    cd.materials.clear()
    cd.materials.append(mat)
    o = bpy.data.objects.new(name, cd)
    SC.collection.objects.link(o)
    o.parent = parent
    return o


# ------------------------------------------------------------------ Sam (Hund im Anzug, Freiberufler-Polizist)
def build_sam(SC, B, R):
    FUR, MUZ, SUIT, HAT, BAND = toon('G_SamFell', '#b98a5a'), toon('G_SamSchnauze', '#e2c49c'), toon('G_SamAnzug', '#7f8fa8'), toon('G_SamHut', '#6f7480'), toon('G_SamBand', '#2a2833')
    SHIRT, TIE, SHOE = toon('G_SamHemd', '#f2f0ea'), toon('G_SamKrawatte', '#2f3550'), toon('G_SamSchuh', '#3b2f2a')
    legs(B, 'Sa_', R, 0.72, 0.11, 0.075, SUIT, SHOE, (0.15, 0.08, 0.06))
    B.cone('Sa_Jacke', 0.6, 1.4, 0.3, 0.24, SUIT, R, scale=(0.95, 1, 1), bevel=0.03)
    B.cone('Sa_Hemd', 1.15, 1.42, 0.02, 0.13, SHIRT, R, xy=(0.15, 0), scale=(0.6, 1, 1), bevel=0.01)
    B.rod('Sa_Krawatte', (0.235, 0, 1.38), (0.255, 0, 1.0), 0.03, TIE, R, r1=0.045, seg=8)
    HEAD = pivot(B, 'Sa_Head', R, (0, 0, 1.45))
    B.sphere('Sa_Kopf', (0.02, 0, 0.17), (0.2, 0.18, 0.19), FUR, HEAD)
    B.sphere('Sa_Schnauze', (0.2, 0, 0.11), (0.14, 0.11, 0.08), MUZ, HEAD)
    B.sphere('Sa_Nase', (0.33, 0, 0.14), (0.045, 0.055, 0.04), BLACK, HEAD)
    B.sphere('Sa_Mund', (0.27, 0, 0.055), (0.05, 0.06, 0.012), MOUTH, HEAD)
    for k, y in (('L', 1), ('R', -1)):
        B.sphere(f'Sa_Auge{k}', (0.17, y * 0.07, 0.25), (0.03, 0.035, 0.045), EYE, HEAD)
        B.sphere(f'Sa_Pupille{k}', (0.195, y * 0.068, 0.245), (0.012, 0.016, 0.022), BLACK, HEAD)
        B.sphere(f'Sa_Ohr{k}', (-0.04, y * 0.19, 0.12), (0.06, 0.03, 0.15), toon('G_SamOhr', '#8a6440'), HEAD, rot=(y * 0.2, 0.15, 0))
    B.cone('Sa_Hut', 0.3, 0.44, 0.17, 0.15, HAT, HEAD, xy=(0.0, 0), scale=(1.1, 1, 1), bevel=0.02)
    B.cone('Sa_Krempe', 0.28, 0.31, 0.3, 0.3, HAT, HEAD, scale=(1.1, 0.95, 1), bevel=0.012)
    B.cone('Sa_Hutband', 0.305, 0.34, 0.172, 0.168, BAND, HEAD, scale=(1.1, 1, 1), bevel=0)
    for k, y in (('L', 1), ('R', -1)):
        arm(B, 'Sa_', k, R, (0, y * 0.27, 1.32), 0.26, 0.24, 0.07, SUIT, FUR, (0.065, 0.06, 0.07))
    return dict(mouth='Sa_Mund', eyes=('Sa_AugeR', 'Sa_AugeL'), hand='Sa_HandR', abd=0.12)


# ------------------------------------------------------------------ Max (hyperkinetisches Kaninchending)
def build_max(SC, B, R):
    W, IN = toon('G_MaxFell', '#f7f7fb', hi=0.3), toon('G_MaxOhrInnen', '#f2c2cc')
    legs(B, 'Mx_', R, 0.32, 0.08, 0.06, W, W, (0.1, 0.07, 0.05))
    B.sphere('Mx_Bauch', (0, 0, 0.5), (0.2, 0.2, 0.24), W, R)
    HEAD = pivot(B, 'Mx_Head', R, (0, 0, 0.72))
    B.sphere('Mx_Kopf', (0.03, 0, 0.18), (0.21, 0.2, 0.2), W, HEAD)
    B.sphere('Mx_Mund', (0.2, 0, 0.1), (0.04, 0.13, 0.05), MOUTH, HEAD)   # breites Grinsen
    B.sphere('Mx_Zaehne', (0.215, 0, 0.125), (0.03, 0.1, 0.018), WHITE, HEAD)
    B.sphere('Mx_Nase', (0.235, 0, 0.19), (0.025, 0.03, 0.022), BLACK, HEAD)
    for k, y in (('L', 1), ('R', -1)):
        B.sphere(f'Mx_Auge{k}', (0.19, y * 0.075, 0.25), (0.022, 0.026, 0.034), EYE, HEAD)
        B.sphere(f'Mx_Pupille{k}', (0.207, y * 0.072, 0.245), (0.01, 0.013, 0.02), BLACK, HEAD)
        ear = pivot(B, f'Mx_Ohr{k}', HEAD, (-0.02, y * 0.1, 0.33))
        ear.rotation_euler = (y * -0.35, -0.25, 0)
        B.sphere(f'Mx_OhrA{k}', (0, 0, 0.15), (0.05, 0.035, 0.18), W, ear)
        B.sphere(f'Mx_OhrI{k}', (0.02, 0, 0.15), (0.03, 0.025, 0.14), IN, ear)
    for k, y in (('L', 1), ('R', -1)):
        arm(B, 'Mx_', k, R, (0.02, y * 0.17, 0.62), 0.13, 0.12, 0.045, W, W, (0.045, 0.04, 0.045))
    return dict(mouth='Mx_Mund', eyes=('Mx_AugeR', 'Mx_AugeL'), hand='Mx_HandR', abd=0.35)


# ------------------------------------------------------------------ Dave (Maniac Mansion: zurück in der Villa)
def build_dave(SC, B, R):
    HAIR, SW, JEANS, SHOE, SOLE = toon('G_DaveHaar', '#3a2418'), toon('G_DavePulli', '#c8323c'), toon('G_DaveJeans', '#3f5f9f'), toon('G_DaveSchuh', '#f0f0f0'), toon('G_DaveSohle', '#c03040')
    legs(B, 'Dv_', R, 0.9, 0.1, 0.07, JEANS, SHOE, (0.14, 0.075, 0.06))
    B.cone('Dv_Pulli', 0.82, 1.48, 0.22, 0.2, SW, R, scale=(0.9, 1, 1), bevel=0.03)
    B.cone('Dv_Bund', 0.8, 0.88, 0.225, 0.225, toon('G_DaveBund', '#a0222c'), R, scale=(0.9, 1, 1), bevel=0.01)
    B.cone('Dv_Hals', 1.44, 1.56, 0.07, 0.065, SKIN, R, bevel=0)
    face(B, 'Dv_', R, 1.72, SKIN, head=(0.16, 0.15, 0.18), nose=(0.06, 0.05, 0.06))
    B.sphere('Dv_Haar', (-0.01, 0, 1.82), (0.17, 0.16, 0.12), HAIR, R)
    B.sphere('Dv_Tolle', (0.12, 0, 1.86), (0.08, 0.13, 0.06), HAIR, R, rot=(0, -0.3, 0))
    for k, y in (('L', 1), ('R', -1)):
        arm(B, 'Dv_', k, R, (0, y * 0.22, 1.42), 0.24, 0.22, 0.055, SW, SKIN)
    return dict(mouth='Dv_Mund', eyes=('Dv_AugeR', 'Dv_AugeL'), hand='Dv_HandR', abd=0.1)


# ------------------------------------------------------------------ Guybrush (Möchtegern-Pirat, Monkey Island)
def build_guybrush(SC, B, R):
    HAIR, SHIRT, PANTS, BOOT, BELT = toon('G_GuyHaar', '#f2c94a'), toon('G_GuyHemd', '#f6f3ea', hi=0.35), toon('G_GuyHose', '#4a5e8c'), toon('G_GuyStiefel', '#5a3a22'), toon('G_GuyGuertel', '#3a2a1c')
    STEEL = toon('W_Stahl', '#c8d0d8', hi=0.8)
    legs(B, 'Gb_', R, 0.9, 0.095, 0.065, PANTS, BOOT, (0.13, 0.075, 0.07))
    for k, y in (('L', 1), ('R', -1)):
        B.cone(f'Gb_Stiefel{k}', 0.05, 0.42, 0.075, 0.085, BOOT, R, xy=(0, y * 0.095), bevel=0.01)
    B.cone('Gb_Hemd', 0.86, 1.46, 0.21, 0.2, SHIRT, R, scale=(0.9, 1, 1), bevel=0.03)
    B.cone('Gb_Kragen', 1.38, 1.5, 0.15, 0.1, SHIRT, R, bevel=0.01)
    B.cone('Gb_Guertel', 0.86, 0.93, 0.215, 0.215, BELT, R, scale=(0.9, 1, 1), bevel=0.01)
    B.sphere('Gb_Schnalle', (0.19, 0, 0.895), (0.015, 0.04, 0.03), GOLD, R)
    B.cone('Gb_Hals', 1.44, 1.56, 0.065, 0.06, SKIN, R, bevel=0)
    face(B, 'Gb_', R, 1.72, SKIN, head=(0.15, 0.14, 0.18), nose=(0.065, 0.05, 0.06))
    B.sphere('Gb_Haar', (-0.02, 0, 1.82), (0.16, 0.15, 0.11), HAIR, R)
    B.sphere('Gb_Pony', (0.09, 0, 1.87), (0.07, 0.13, 0.04), HAIR, R, rot=(0, -0.25, 0))
    tube(SC, 'Gb_Zopf', [(-0.15, 0, 1.78), (-0.24, 0, 1.68), (-0.25, 0, 1.52)], 0.04, HAIR, R, tip=0.5)
    for k, y in (('L', 1), ('R', -1)):
        sh, el = arm(B, 'Gb_', k, R, (0, y * 0.22, 1.42), 0.24, 0.22, 0.07, SHIRT, SKIN)
    # Säbel in der rechten Hand (Klinge nach vorn-unten, beim Fechten nach vorn)
    el = bpy.data.objects['Gb_ElR']
    B.rod('Gb_Klinge', (0.03, 0, -0.29), (0.25, 0, -0.86), 0.012, STEEL, el, r1=0.004, seg=8)   # verlängert den Unterarm, leicht nach vorn
    B.torus('Gb_Korb', (0.035, 0, -0.29), 0.045, 0.008, GOLD, el, rot=(0, 0.37, 0), seg=24, sseg=8)
    return dict(mouth='Gb_Mund', eyes=('Gb_AugeR', 'Gb_AugeL'), hand='Gb_HandR', abd=0.1)


# ------------------------------------------------------------------ Käpt'n Jack (Fluch der Karibik, als Cartoon-Pirat)
def build_jack(SC, B, R):
    HAIR, BAND, HAT, COAT, SHIRT, SASH, PANTS, BOOT = (toon('G_JackHaar', '#2a1a12'), toon('G_JackTuch', '#a8262c'), toon('G_JackHut', '#5a3a24'), toon('G_JackMantel', '#6a4a30'),
                                                      toon('G_JackHemd', '#ece4d2'), toon('G_JackSchaerpe', '#8a2a30'), toon('G_JackHose', '#4a3a2e'), toon('G_JackStiefel', '#3a281c'))
    TAN = toon('G_JackHaut', '#e8b88e')
    legs(B, 'Jk_', R, 0.9, 0.1, 0.065, PANTS, BOOT, (0.14, 0.075, 0.07))
    for k, y in (('L', 1), ('R', -1)):
        B.cone(f'Jk_Stiefel{k}', 0.05, 0.5, 0.078, 0.09, BOOT, R, xy=(0, y * 0.1), bevel=0.012)
    B.cone('Jk_Mantel', 0.55, 1.46, 0.27, 0.2, COAT, R, scale=(0.9, 1, 1), bevel=0.03, cut=(-2.55, 2.55), solid=0.02, rot=(0, 0, math.pi))   # vorn offen
    B.cone('Jk_Hemd', 0.85, 1.46, 0.2, 0.19, SHIRT, R, scale=(0.9, 1, 1), bevel=0.02)
    B.cone('Jk_Schaerpe', 0.86, 0.98, 0.205, 0.205, SASH, R, scale=(0.9, 1, 1), bevel=0.01)
    B.cone('Jk_Hals', 1.44, 1.56, 0.065, 0.06, TAN, R, bevel=0)
    face(B, 'Jk_', R, 1.72, TAN, head=(0.15, 0.14, 0.18), nose=(0.07, 0.05, 0.06), eye_mat=toon('G_JackAuge', '#fff6e8'))
    for k, y in (('L', 1), ('R', -1)):   # dunkler Lidstrich
        B.sphere(f'Jk_Kajal{k}', (0.155, y * 0.065, 1.765), (0.022, 0.045, 0.012), BLACK, R)
    B.sphere('Jk_Bart', (0.15, 0, 1.56), (0.04, 0.05, 0.05), HAIR, R)
    for k, y in (('L', 1), ('R', -1)):
        tube(SC, f'Jk_Zopf{k}', [(0.15, y * 0.02, 1.53), (0.16, y * 0.025, 1.45)], 0.012, HAIR, R, tip=0.6)
    B.sphere('Jk_Tuch', (0.0, 0, 1.83), (0.165, 0.155, 0.1), BAND, R)
    for i in range(7):   # Rastalocken hinten und seitlich
        a = math.pi * (0.55 + i * 0.15)
        x0, y0 = 0.13 * math.cos(a), 0.14 * math.sin(a)
        tube(SC, f'Jk_Locke{i}', [(x0, y0, 1.82), (x0 * 1.3, y0 * 1.35, 1.66), (x0 * 1.4, y0 * 1.4, 1.46)], 0.025, HAIR, R, tip=0.55)
        B.sphere(f'Jk_Perle{i}', (x0 * 1.4, y0 * 1.4, 1.47), (0.02, 0.02, 0.02), GOLD if i % 2 else toon('G_JackPerle', '#3a7ab8'), R)
    # Dreispitz
    B.cone('Jk_HutKopf', 1.84, 1.98, 0.15, 0.12, HAT, R, bevel=0.02)
    hat = B.cone('Jk_Krempe', 1.85, 1.88, 0.33, 0.33, HAT, R, seg=3, bevel=0.05, rot=(0, 0, 0.0))
    hat.rotation_euler = (0, 0, math.pi / 6 + math.pi)
    for k, y in (('L', 1), ('R', -1)):
        sh, el = arm(B, 'Jk_', k, R, (0, y * 0.22, 1.42), 0.24, 0.22, 0.07, COAT, TAN, fore_mat=SHIRT)
    # Kompass in der rechten Hand
    el = bpy.data.objects['Jk_ElR']
    B.cone('Jk_Kompass', -0.27, -0.24, 0.05, 0.05, GOLD, el, xy=(0.07, 0), bevel=0.006)
    return dict(mouth='Jk_Mund', eyes=('Jk_AugeR', 'Jk_AugeL'), hand='Jk_HandR', abd=0.22)


# ------------------------------------------------------------------ Salad Fingers (dünn, grün, mag Rostiges)
def build_salad(SC, B, R):
    GREEN, SHIRT, PANTS, SHOE = toon('G_SaladHaut', '#a8c66a'), toon('G_SaladHemd', '#8a7e66'), toon('G_SaladHose', '#5e5648'), toon('G_SaladSchuh', '#3a3430')
    legs(B, 'Sf_', R, 1.0, 0.07, 0.04, PANTS, SHOE, (0.11, 0.055, 0.045))
    B.cone('Sf_Hemd', 0.92, 1.58, 0.12, 0.13, SHIRT, R, scale=(0.85, 1, 1), bevel=0.02)
    B.cone('Sf_Hals', 1.55, 1.72, 0.035, 0.035, GREEN, R, bevel=0)
    B.sphere('Sf_Kopf', (0.03, 0, 1.88), (0.16, 0.15, 0.2), GREEN, R)
    B.sphere('Sf_Mund', (0.18, 0, 1.79), (0.012, 0.025, 0.008), MOUTH, R)
    for k, y in (('L', 1), ('R', -1)):
        B.sphere(f'Sf_Auge{k}', (0.16, y * 0.06, 1.93), (0.018, 0.022, 0.022), BLACK, R)
        B.sphere(f'Sf_Pupille{k}', (0.172, y * 0.058, 1.935), (0.006, 0.007, 0.007), EYE, R)
    for k, y in (('L', 1), ('R', -1)):
        sh, el = arm(B, 'Sf_', k, R, (0, y * 0.13, 1.54), 0.27, 0.26, 0.032, SHIRT, GREEN, (0.03, 0.025, 0.035), fore_mat=GREEN)
        h = bpy.data.objects[f'Sf_Hand{k}']
        for j in range(3):   # lange, dünne Finger
            B.rod(f'Sf_Finger{k}{j}', (0.01, (j - 1) * 0.012, -0.29), (0.02 + (j - 1) * 0.005, (j - 1) * 0.02, -0.43), 0.006, GREEN, el, seg=6)
    return dict(mouth='Sf_Mund', eyes=('Sf_AugeR', 'Sf_AugeL'), hand='Sf_HandR', abd=0.08)


# ------------------------------------------------------------------ Bender (Futurama: Roboter mit Antenne)
def build_bender(SC, B, R):
    MET, DARK, VIS = toon('G_BenderMetall', '#9aa6b8', hi=0.75), toon('G_BenderDunkel', '#5a6474'), toon('G_BenderVisier', '#2a2e38', hi=0.6)
    YEL = toon('G_BenderAuge', '#fff7c8')
    for k, y in (('L', 1), ('R', -1)):
        B.rod(f'Bd_Bein{k}', (0, y * 0.09, 0.62), (0, y * 0.09, 0.08), 0.045, MET, R, seg=16)
        for j in range(5):
            B.torus(f'Bd_Ring{k}{j}', (0, y * 0.09, 0.16 + j * 0.1), 0.046, 0.008, DARK, R, seg=20, sseg=6)
        B.cone(f'Bd_Fuss{k}', 0.0, 0.1, 0.09, 0.06, MET, R, xy=(0.02, y * 0.09), bevel=0.01)
    B.cone('Bd_Rumpf', 0.58, 1.18, 0.24, 0.22, MET, R, bevel=0.03)
    B.cone('Bd_Klappe', 0.72, 1.02, 0.01, 0.01, DARK, R, xy=(0.215, 0), bevel=0)
    B.sphere('Bd_Tuer', (0.21, 0, 0.87), (0.02, 0.12, 0.13), DARK, R)
    B.cone('Bd_Hals', 1.16, 1.26, 0.08, 0.08, MET, R, bevel=0.01)
    HEAD = pivot(B, 'Bd_Head', R, (0, 0, 1.26))
    B.cone('Bd_Kopf', 0.0, 0.32, 0.13, 0.13, MET, HEAD, bevel=0.02)
    B.sphere('Bd_Kuppel', (0, 0, 0.32), (0.13, 0.13, 0.08), MET, HEAD)
    B.rod('Bd_Antenne', (0, 0, 0.38), (0, 0, 0.5), 0.012, MET, HEAD, seg=8)
    B.sphere('Bd_Knopf', (0, 0, 0.51), (0.025, 0.025, 0.025), MET, HEAD)
    B.sphere('Bd_Visier', (0.09, 0, 0.22), (0.07, 0.13, 0.055), VIS, HEAD)
    for k, y in (('L', 1), ('R', -1)):
        B.sphere(f'Bd_Auge{k}', (0.135, y * 0.055, 0.22), (0.035, 0.045, 0.045), YEL, HEAD)
        B.sphere(f'Bd_Pupille{k}', (0.165, y * 0.05, 0.215), (0.012, 0.015, 0.015), BLACK, HEAD)
    B.sphere('Bd_Mund', (0.115, 0, 0.08), (0.03, 0.09, 0.04), toon('G_BenderMund', '#e8ecf2'), HEAD)
    for j in range(3):
        B.rod(f'Bd_Gitter{j}', (0.142, -0.08 + j * 0.08, 0.05), (0.142, -0.08 + j * 0.08, 0.11), 0.004, DARK, HEAD, seg=6)
    for k, y in (('L', 1), ('R', -1)):
        arm(B, 'Bd_', k, R, (0, y * 0.25, 1.1), 0.24, 0.22, 0.035, MET, MET, (0.055, 0.05, 0.055))
    return dict(mouth='Bd_Mund', eyes=('Bd_AugeR', 'Bd_AugeL'), hand='Bd_HandR', abd=0.18)


# ------------------------------------------------------------------ Professor (Futurama: uralter Erfinder)
def build_prof(SC, B, R):
    COAT, PANTS, SHOE, GLAS, RIM, HAIR = (toon('G_ProfKittel', '#f2f4f2', hi=0.3), toon('G_ProfHose', '#7a8a5a'), toon('G_ProfSchuh', '#4a3a2e'), toon('F_Glas', '#d9f1ff', hi=0.8),
                                          toon('F_Brille', '#2b2a35'), toon('F_Haar', '#f6f6fa', hi=0.2))
    OLD = toon('G_ProfHaut', '#f0c8b0')
    legs(B, 'Pf_', R, 0.6, 0.085, 0.055, PANTS, SHOE, (0.13, 0.07, 0.055))
    BODY = pivot(B, 'Pf_Body', R, (0, 0, 0.55))
    BODY.rotation_euler = (0, 0.28, 0)   # krummer Rücken
    B.cone('Pf_Kittel', -0.05, 0.85, 0.24, 0.17, COAT, BODY, scale=(1, 0.95, 1), bevel=0.03)
    HEAD = pivot(B, 'Pf_Head', BODY, (0.06, 0, 0.88))
    HEAD.rotation_euler = (0, -0.28, 0)
    B.cone('Pf_Hals', -0.06, 0.08, 0.06, 0.055, OLD, HEAD, bevel=0)
    hf = face(B, 'Pf_', HEAD, 0.2, OLD, head=(0.16, 0.15, 0.17), nose=(0.06, 0.05, 0.055), eye=(0.03, 0.035, 0.04), pupil=(0.012, 0.014, 0.018), mz=0.11)
    for k, y in (('L', 1), ('R', -1)):   # dicke runde Brillengläser
        B.sphere(f'Pf_Glas{k}', (hf - 0.0, y * 0.065, 0.235), (0.02, 0.06, 0.06), GLAS, HEAD)
        B.torus(f'Pf_Rand{k}', (hf + 0.005, y * 0.065, 0.235), 0.058, 0.009, RIM, HEAD, rot=(0, 1.57, 0), seg=24, sseg=8)
        B.sphere(f'Pf_Haarkranz{k}', (-0.05, y * 0.13, 0.18), (0.1, 0.05, 0.07), HAIR, HEAD)
    B.sphere('Pf_Hinterkopf', (-0.12, 0, 0.2), (0.06, 0.12, 0.08), HAIR, HEAD)
    for k, y in (('L', 1), ('R', -1)):
        arm(B, 'Pf_', k, BODY, (0.0, y * 0.2, 0.78), 0.22, 0.2, 0.06, COAT, OLD)
    return dict(mouth='Pf_Mund', eyes=('Pf_AugeR', 'Pf_AugeL'), hand='Pf_HandR', abd=0.12)


# ------------------------------------------------------------------ Zoidberg (Futurama: Krabben-Doktor mit Mundtentakeln)
def build_zoid(SC, B, R):
    RED, LITE, COAT, SHIRT, SHOE = toon('G_ZoidHaut', '#e8746a'), toon('G_ZoidHell', '#f4a49a'), toon('G_ZoidKittel', '#f2f2f0', hi=0.3), toon('G_ZoidHemd', '#3a5aa0'), toon('G_ZoidSchuh', '#3a3040')
    legs(B, 'Zb_', R, 0.75, 0.1, 0.06, SHIRT, SHOE, (0.13, 0.08, 0.06))
    B.cone('Zb_Kittel', 0.5, 1.36, 0.27, 0.22, COAT, R, scale=(0.95, 1, 1), bevel=0.03, cut=(-2.6, 2.6), solid=0.02, rot=(0, 0, math.pi))   # vorn offen
    B.cone('Zb_Hemd', 0.72, 1.36, 0.2, 0.19, SHIRT, R, scale=(0.95, 1, 1), bevel=0.02)
    HEAD = pivot(B, 'Zb_Head', R, (0, 0, 1.38))
    B.sphere('Zb_Kopf', (0.02, 0, 0.24), (0.21, 0.2, 0.25), RED, HEAD)
    B.cone('Zb_Flosse', 0.38, 0.6, 0.12, 0.02, RED, HEAD, xy=(-0.04, 0), scale=(1.4, 0.25, 1), bevel=0.01)
    for k, y in (('L', 1), ('R', -1)):
        B.sphere(f'Zb_Auge{k}', (0.19, y * 0.075, 0.33), (0.028, 0.032, 0.038), toon('G_ZoidAuge', '#1c1420'), HEAD)
        B.sphere(f'Zb_Pupille{k}', (0.21, y * 0.075, 0.345), (0.008, 0.01, 0.012), EYE, HEAD)
    B.sphere('Zb_Mund', (0.21, 0, 0.17), (0.02, 0.06, 0.02), MOUTH, HEAD)
    for j, (y, l) in enumerate(((-0.075, 0.2), (-0.025, 0.24), (0.025, 0.24), (0.075, 0.2))):   # Mundtentakel
        tube(SC, f'Zb_Tentakel{j}', [(0.2, y, 0.16), (0.24, y * 1.1, 0.06), (0.22, y * 1.2, 0.16 - l)], 0.022, LITE, HEAD, tip=0.35)
    for k, y in (('L', 1), ('R', -1)):
        sh, el = arm(B, 'Zb_', k, R, (0, y * 0.26, 1.28), 0.24, 0.22, 0.07, COAT, RED, (0.07, 0.04, 0.09), fore_mat=COAT)
        h = bpy.data.objects[f'Zb_Hand{k}']
        B.sphere(f'Zb_Schere{k}', (0.06, 0, -0.32), (0.05, 0.03, 0.04), RED, el)   # Scherenfinger
    return dict(mouth='Zb_Mund', eyes=('Zb_AugeR', 'Zb_AugeL'), hand='Zb_HandR', abd=0.14)


# ------------------------------------------------------------------ GLaDOS-artige Test-KI (Portal), hängt von der Decke
def build_glados(SC, B, R):
    SHELL, MECH, EYEG, RING = toon('G_KiSchale', '#f4f4f6', hi=0.8), toon('G_KiMechanik', '#2e2f36', hi=0.5), toon('G_KiAuge', '#ffe066', hi=0.95), toon('G_KiRing', '#55565e')
    # Fußpunkt = unterster Punkt der Figur; darüber der kopfüber hängende Rumpf, Gelenkarm und Kabelstrang zur Decke
    B.cone('Ki_Rumpf', 0.12, 1.15, 0.09, 0.22, SHELL, R, scale=(0.72, 1, 1), bevel=0.03)
    B.cone('Ki_Gelenk', 1.12, 1.32, 0.16, 0.12, MECH, R, bevel=0.02)
    for i in range(5):
        B.torus(f'Ki_Ring{i}', (0, 0, 0.25 + i * 0.19), 0.12 + i * 0.022, 0.014, MECH, R, seg=24, sseg=6, scale=(0.72, 1, 1))
    B.rod('Ki_Arm', (0, 0, 1.3), (-0.06, 0, 2.95), 0.07, MECH, R, r1=0.085, seg=20)
    for j in range(3):
        tube(SC, f'Ki_Leitung{j}', [(0.06 * (j - 1), 0.09, 1.25), (-0.12 + 0.06 * j, 0.13, 1.9), (-0.05 + 0.03 * j, 0.1, 2.95)], 0.02, toon('G_KiLeitung', '#3a3c46'), R, tip=1.0)
    HEAD = pivot(B, 'Ki_Head', R, (0.03, 0, 0.14))
    HEAD.rotation_euler = (0, -0.3, -0.5)   # Blick zur Kamera
    B.sphere('Ki_Kopf', (0.26, 0, 0.0), (0.34, 0.16, 0.16), SHELL, HEAD)
    B.sphere('Ki_KopfHinten', (-0.02, 0, 0.0), (0.12, 0.17, 0.15), MECH, HEAD)
    B.torus('Ki_Fassung', (0.53, 0, -0.03), 0.085, 0.022, RING, HEAD, rot=(0, 1.57, 0), seg=24, sseg=8)
    B.sphere('Ki_Auge', (0.545, 0, -0.03), (0.045, 0.075, 0.075), EYEG, HEAD)
    B.sphere('Ki_Mund', (0.59, 0, -0.03), (0.01, 0.01, 0.01), EYEG, HEAD)   # Anker für das Leuchten beim Sprechen
    return dict(mouth='Ki_Mund', eyes=('Ki_Auge', 'Ki_Auge'), hand='Ki_Auge', abd=0, noarms=True)


# ------------------------------------------------------------------ Simon (Simon the Sorcerer: Zauberlehrling)
def build_simon(SC, B, R):
    ROBE, LINE, HAT, HAIR, SHOE = toon('G_SimonRobe', '#6a2a8a'), toon('G_SimonFutter', '#c8323c'), toon('G_SimonHut', '#5a2278'), toon('G_SimonHaar', '#6b3f1f'), toon('G_SimonSchuh', '#3a2a22')
    for k, y in (('L', 1), ('R', -1)):
        B.sphere(f'Sm_Schuh{k}', (0.06, y * 0.09, 0.05), (0.13, 0.07, 0.05), SHOE, R)
    B.cone('Sm_Robe', 0.04, 1.44, 0.3, 0.2, ROBE, R, scale=(0.9, 1, 1), bevel=0.03)
    B.cone('Sm_Saum', 0.04, 0.12, 0.305, 0.3, LINE, R, scale=(0.9, 1, 1), bevel=0.01)
    B.cone('Sm_Kragen', 1.36, 1.5, 0.2, 0.12, LINE, R, bevel=0.02)
    B.cone('Sm_Hals', 1.44, 1.56, 0.065, 0.06, SKIN, R, bevel=0)
    face(B, 'Sm_', R, 1.72, SKIN, head=(0.15, 0.14, 0.17), nose=(0.06, 0.05, 0.055))
    B.sphere('Sm_Haar', (-0.03, 0, 1.79), (0.15, 0.15, 0.1), HAIR, R)
    B.sphere('Sm_Pony', (0.1, 0, 1.83), (0.06, 0.12, 0.035), HAIR, R, rot=(0, -0.3, 0))
    B.cone('Sm_Krempe', 1.82, 1.85, 0.27, 0.27, HAT, R, bevel=0.012)
    tip = tube(SC, 'Sm_Hutspitze', [(0, 0, 1.84), (-0.02, 0, 2.1), (-0.12, 0, 2.3), (-0.26, 0, 2.28)], 0.16, HAT, R, tip=0.08, res=8)
    for k, y in (('L', 1), ('R', -1)):
        arm(B, 'Sm_', k, R, (0, y * 0.21, 1.4), 0.24, 0.22, 0.08, ROBE, SKIN, fore_mat=ROBE)
    return dict(mouth='Sm_Mund', eyes=('Sm_AugeR', 'Sm_AugeL'), hand='Sm_HandR', abd=0.12)


BUILD = {'sam': build_sam, 'max': build_max, 'dave': build_dave, 'guybrush': build_guybrush, 'jack': build_jack, 'salad': build_salad,
         'bender': build_bender, 'prof': build_prof, 'zoid': build_zoid, 'glados': build_glados, 'simon': build_simon}
PREFIX = {'sam': 'Sa_', 'max': 'Mx_', 'dave': 'Dv_', 'guybrush': 'Gb_', 'jack': 'Jk_', 'salad': 'Sf_', 'bender': 'Bd_', 'prof': 'Pf_', 'zoid': 'Zb_', 'glados': 'Ki_', 'simon': 'Sm_'}
# Posen: Schulter (seitlich, vor/zurück) und Ellbogen je Arm; Kopf-Neigung für die KI
FRAMES = [('idle', {}), ('talk0', dict(aR=-0.75, eR=0.7, xR=-0.05)), ('talk1', dict(aR=-0.25, eR=0.6)),
          ('gest', dict(aR=-0.6, eR=0.9, xR=-0.5, aL=-0.4, eL=0.8, xL=0.4))]
EXTRA = {
    'guybrush': [('engarde', dict(aR=-1.45, eR=0.15, xR=0.1, aL=-0.3, eL=1.6, xL=0.6)), ('lunge', dict(aR=-1.6, eR=0.0, xR=0.25, aL=0.4, eL=0.6, xL=0.5))],
    'jack': [('compass', dict(aR=-1.15, eR=1.05, xR=0.2, aL=-0.35, eL=1.2, xL=0.25))],
    'salad': [('touch', dict(aR=-0.9, eR=1.25, xR=0.35, aL=-0.7, eL=1.3, xL=-0.1))],
    'glados': [('tilt0', dict(head=(0.2, -0.55, -0.3))), ('tilt1', dict(head=(-0.15, -0.12, -0.7)))],
    'max': [('jump', dict(aR=-2.7, eR=0.3, xR=-0.6, aL=-2.7, eL=0.3, xL=0.6, lift=0.12))],
    'prof': [('news', dict(aR=-2.2, eR=0.6, xR=-0.3))],
    'bender': [('lean', dict(aR=-0.1, eR=1.8, xR=0.5, aL=-0.1, eL=1.8, xL=-0.5))],
}


def render(name):
    SC = scene_for(name)
    B = Builder(SC)
    P = PREFIX[name]
    R = B.empty(P + 'Rig')
    R.rotation_euler = (0, 0, YAW)
    info = BUILD[name](SC, B, R)
    ab = info['abd']
    OB = bpy.data.objects
    head = OB.get(P + 'Head')
    head0 = tuple(head.rotation_euler) if head else None

    def pose(p):
        if not info.get('noarms'):
            for k, sg in (('R', -1), ('L', 1)):
                OB[f'{P}Sh{k}'].rotation_euler = (p.get('x' + k, sg * ab), p.get('a' + k, sg * 0.1), 0)
                OB[f'{P}El{k}'].rotation_euler = (0, -p.get('e' + k, 0.15), 0)
        if head:
            h = p.get('head')
            head.rotation_euler = h if h else head0
        R.location = (0, 0, p.get('lift', 0))

    out = REPO + f'/art/render/{name}/'
    os.makedirs(out, exist_ok=True)
    win = bpy.context.window
    prev = win.scene
    win.scene = SC
    cam = SC.camera
    W, H = SC.render.resolution_x, SC.render.resolution_y

    def px(co):
        q = world_to_camera_view(SC, cam, co)
        return [round(q.x * W, 1), round((1 - q.y) * H, 1)]

    meta = {'res': [W, H], 'ppm': H / cam.data.ortho_scale, 'frames': []}
    frames = FRAMES + EXTRA.get(name, [])
    if info.get('noarms'):
        frames = [f for f in frames if f[0] in ('idle',)] + EXTRA.get(name, [])
    try:
        for n, p in frames:
            pose(p)
            bpy.context.view_layer.update()
            vis = [o for o in SC.objects if o.type in ('MESH', 'CURVE') and not o.hide_render]
            top = max((o.matrix_world @ Vector(c)).z for o in vis for c in o.bound_box)
            meta['frames'].append({'name': n, 'foot': px(Vector((0, 0, 0))), 'mouth': px(OB[info['mouth']].matrix_world.translation),
                                   'eyes': [px(OB[e].matrix_world.translation) for e in info['eyes']], 'hand': px(OB[info['hand']].matrix_world.translation), 'top_m': round(top, 3)})
            if not globals().get('NO_RENDER'):
                SC.render.filepath = out + f'{n}.png'
                bpy.ops.render.render(write_still=True, scene=SC.name)
    finally:
        pose({})
        win.scene = prev
    meta['top'] = meta['frames'][0]['top_m']
    json.dump(meta, open(out + 'meta.json', 'w'), indent=1)
    print('gast', name, meta['top'], [f['name'] for f in meta['frames']])


if globals().get('NAME') in BUILD:
    render(NAME)
