# Bernard im Stil des Originals (Day of the Tentacle, 1993) – in Blender ausführen, vorher REPO setzen:
#   REPO = r'C:/.../Tentakel-Toast'; exec(open(REPO + '/art/blender/bernard_schick.py').read())
# Formt das Rig BRig (Szene Rig3D) nach der klassischen Figur um: langer, schmaler Eierkopf mit spitzem Kinn und
# langer Nase, schwarzes Strubbelhaar mit zwei Antennen-Strähnen, dicke schwarze Kastenbrille mit weißen Gläsern
# und Punkt-Pupillen, dünner langer Hals, schwarze Fliege am Kragen, Einstecktasche mit Stiften, hoch sitzende
# dunkelgraue Hose mit schwarzem Gürtel, weiße Socken, braune Schuhe. Neue Teile hängen an den Gelenken
# (BR_Torso, BR_Head, Knöchel), damit sie mit Gehen, Reden und Mimik mitlaufen; Augen (RB_Pupille*) und Mund
# bleiben die beweglichen Teile des Rigs. Mehrfach ausführbar: RB_Schick*-Teile werden ersetzt, umgeformte
# Originalteile merken sich ihre Ausgangswerte. Danach: WHAT = ['bernard']; exec(open(REPO + '/art/blender/echt3d_export.py').read())
import bpy, bmesh, math, sys, importlib
sys.path.insert(0, REPO + '/art/blender')
import figur_lib
importlib.reload(figur_lib)
from figur_lib import toon

for o in [o for o in bpy.data.objects if o.name.startswith('RB_Schick')]:
    bpy.data.objects.remove(o, do_unlink=True)
SC = bpy.data.scenes['Rig3D']
M = bpy.data.materials
O = bpy.data.objects
WEISS, HAUT, NASE = M['Weiss'], M['HautB'], M['NaseB']
SCHWARZ = toon('B_Schwarz', '#14101a', hi=0.35)
HAAR = toon('B_HaarSchwarz', '#1a1418', hi=0.45)
HOSE = toon('B_HoseGrau', '#4a4a54', hi=0.4)
FALTE = toon('B_HoseFalte', '#2e2e36', hi=0.3)
PLASTIK = toon('B_Einstecktasche', '#e8eef4', hi=0.8)
STIFTE = (toon('B_StiftOrange', '#e8782a', hi=0.7), toon('B_StiftBlau', '#2a5ad8', hi=0.7), toon('B_StiftRot', '#d8343a', hi=0.7))
KAPPE = toon('B_StiftKappe', '#c8c8d0', hi=0.9)
KNOPF = toon('B_Knopf', '#d8d4cc', hi=0.8)


def teil(name, kind, parent, loc, scale, mat, rot=(0, 0, 0), seg=16):
    bm = bmesh.new()
    if kind == 'kegel':
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=1, radius2=0, depth=2)
    elif kind == 'kugel':
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(6, seg // 2), radius=1)
    elif kind == 'zyl':
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=1, radius2=1, depth=2)
    else:
        bmesh.ops.create_cube(bm, size=2)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = kind != 'box'
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    SC.collection.objects.link(o)
    o.parent = O[parent]
    o.location, o.scale, o.rotation_euler = loc, scale, rot
    return o


def umformen(name, loc=None, scale=None, mat=None, weg=False):
    """Originalteil umformen (Ausgangswerte werden beim ersten Mal gemerkt) oder fürs Rendern/Exportieren ausblenden."""
    o = O[name]
    if 'orig_loc' not in o:
        o['orig_loc'], o['orig_scale'] = list(o.location), list(o.scale)
    o.location, o.scale = o['orig_loc'], o['orig_scale']
    if loc is not None: o.location = loc
    if scale is not None: o.scale = scale
    if mat is not None:
        for sl in o.material_slots: sl.material = mat
    o.hide_render = o.hide_viewport = weg
    return o


# frühere Fassungen aufräumen: gelbe Simpsons-Haut zurück auf die natürliche
for o in O:
    if o.type == 'MESH' and o.name.startswith(('RB_', 'BR_')):
        for sl in o.material_slots:
            if sl.material and sl.material.name == 'B_HautSimpson':
                sl.material = NASE if o.name == 'RB_Nase' else HAUT

T, K = 'BR_Torso', 'BR_Head'
# ---- Kopf: langes Ei, spitzes Kinn, lange Nase, dünner langer Hals; der ganze Kopf etwas größer (Cartoon-Proportion)
O[K].scale = (1.16, 1.16, 1.16)
umformen('RB_Kopf', loc=(0.015, 0.0, 0.22), scale=(0.15, 0.14, 0.235), mat=HAUT)
teil('RB_SchickKinn', 'kugel', K, (0.07, 0.0, 0.0), (0.075, 0.07, 0.09), HAUT, rot=(0, 0.45, 0), seg=16)
umformen('RB_Nase', weg=True)
teil('RB_SchickNase', 'kegel', K, (0.2, 0.0, 0.172), (0.05, 0.042, 0.11), NASE, rot=(0, 1.75, 0), seg=14)
teil('RB_SchickNasenspitze', 'kugel', K, (0.3, 0.0, 0.153), (0.026, 0.024, 0.024), NASE, seg=10)
umformen('RB_Mund', loc=(0.155, 0.0, 0.065))
umformen('RB_Hals', loc=(0.0, 0.0, 0.69), scale=(0.75, 0.75, 1.8), mat=HAUT)
for side in ('L', 'R'):
    umformen('RB_Ohr' + side, loc=(-0.01, 0.15 if side == 'L' else -0.15, 0.2), mat=HAUT)
# ---- Haar: schwarzer Strubbelschopf, zwei Antennen-Strähnen
umformen('RB_Haar', loc=(-0.035, 0.0, 0.37), scale=(0.16, 0.155, 0.12), mat=HAAR)
umformen('RB_Pony', loc=(0.07, 0.0, 0.42), scale=(0.09, 0.14, 0.055), mat=HAAR)
umformen('RB_Locke', weg=True)
for i, (x, y, z, r) in enumerate(((-0.1, 0.1, 0.36, 0.06), (-0.1, -0.1, 0.36, 0.06), (0.0, 0.12, 0.42, 0.055), (0.0, -0.12, 0.42, 0.055), (-0.14, 0.0, 0.32, 0.065), (0.06, 0.07, 0.47, 0.045))):
    teil(f'RB_SchickTolle{i}', 'kugel', K, (x, y, z), (r, r * 0.9, r * 0.8), HAAR, rot=(i * 0.7, i * 0.4, 0), seg=10)
for s in (-1, 1):   # die zwei abstehenden Strähnen
    teil(f'RB_SchickAntenne{s}', 'kegel', K, (-0.04, s * 0.04, 0.53), (0.012, 0.012, 0.075), HAAR, rot=(s * -0.35, -0.3, 0), seg=6)
# ---- Brille: dicke schwarze Kastenrahmen, weiße Gläser, Punkt-Pupillen davor
for n in ('RB_BrilleL', 'RB_BrilleR', 'RB_GlasL', 'RB_GlasR'):
    umformen(n, weg=True)
umformen('RB_Steg', mat=SCHWARZ)
for side, s in (('L', 1), ('R', -1)):
    y, z = s * 0.07, 0.255
    teil(f'RB_SchickGlas{side}', 'box', K, (0.183, y, z), (0.006, 0.054, 0.04), WEISS)
    for dz in (-1, 1):
        teil(f'RB_SchickRahmenH{side}{dz}', 'box', K, (0.19, y, z + dz * 0.046), (0.012, 0.064, 0.009), SCHWARZ)
    for dy in (-1, 1):
        teil(f'RB_SchickRahmenV{side}{dy}', 'box', K, (0.19, y + dy * 0.059, z), (0.012, 0.009, 0.05), SCHWARZ)
    teil(f'RB_SchickBuegel{side}', 'box', K, (0.1, s * 0.135, z + 0.01), (0.09, 0.006, 0.007), SCHWARZ, rot=(0, 0, -s * 0.12))
    umformen('RB_Pupille' + side, loc=(0.192, y + s * 0.004, z - 0.006))
# ---- Hemd: Kragen, Knopfleiste, Fliege, Einstecktasche mit Stiften
for s in (-1, 1):
    teil(f'RB_SchickKragen{s}', 'box', T, (0.075, s * 0.045, 0.63), (0.05, 0.04, 0.012), WEISS, rot=(s * 0.5, 0.55, s * 0.6))
for i in range(4):
    z = 0.5 - i * 0.11
    teil(f'RB_SchickKnopf{i}', 'kugel', T, (0.172 * math.sqrt(max(0.05, 1 - ((z - 0.29) / 0.36) ** 2)) + 0.004, 0.0, z), (0.011, 0.011, 0.011), KNOPF, seg=8)
for s in (-1, 1):   # Fliege: zwei Kegel mit den Spitzen zum Knoten
    teil(f'RB_SchickFliege{s}', 'kegel', T, (0.115, s * 0.04, 0.6), (0.032, 0.03, 0.038), SCHWARZ, rot=(s * math.pi / 2, 0, 0), seg=10)
teil('RB_SchickFliegeKnoten', 'kugel', T, (0.125, 0.0, 0.6), (0.016, 0.016, 0.018), SCHWARZ, seg=10)
teil('RB_SchickTasche', 'box', T, (0.135, 0.075, 0.42), (0.008, 0.042, 0.05), PLASTIK, rot=(0, -0.35, 0))
for i, (dy, mat) in enumerate(zip((-0.025, 0.0, 0.025), STIFTE)):
    teil(f'RB_SchickStift{i}', 'zyl', T, (0.138, 0.075 + dy, 0.48 + (i % 2) * 0.01), (0.008, 0.008, 0.035), mat, rot=(0, -0.3, 0), seg=8)
    teil(f'RB_SchickKappe{i}', 'kugel', T, (0.146, 0.075 + dy, 0.517 + (i % 2) * 0.01), (0.009, 0.009, 0.009), KAPPE, seg=8)
# ---- Hose: dunkelgrau und hochgezogen, schwarzer Gürtel, Bügelfalten, weiße Socken
for o in O:
    if o.type == 'MESH' and o.name.startswith(('BR_', 'RB_')) and not o.name.startswith('RB_Schick'):
        for sl in o.material_slots:
            if sl.material and sl.material.name in ('HoseBraun', 'B_HoseGrau'):
                sl.material = HOSE
teil('RB_SchickHosenbund', 'kugel', T, (0.0, 0.0, 0.0), (0.168, 0.152, 0.12), HOSE, seg=20)   # Hose bis über den Bauchnabel
umformen('RB_Guertel', loc=(0.0, 0.0, 0.08), mat=SCHWARZ)
umformen('RB_Schnalle', loc=(0.16, 0.0, 0.08))
for side in ('L', 'R'):
    for part in ('Oberschenkel', 'Unterschenkel'):
        o = O[f'BR_{part}{side}']
        teil(f'RB_SchickFalte{part}{side}', 'box', o.parent.name, (o.location.x + 0.072, o.location.y, o.location.z), (0.004, 0.006, 0.19), FALTE)
    teil(f'RB_SchickSocke{side}', 'zyl', f'BR_Knoechel{side}', (0.0, 0.0, 0.035), (0.055, 0.055, 0.035), WEISS, seg=12)
# Lichtpunkte in den Pupillen (Kinder der Pupillen: wachsen beim Glubschaugen-Take mit)
for side in ('L', 'R'):
    g = teil(f'RB_SchickGlanz{side}', 'kugel', K, (0, 0, 0), (1, 1, 1), WEISS, seg=8)
    g.parent = O['RB_Pupille' + side]
    g.matrix_parent_inverse.identity()
    g.location, g.scale = (0.6, 0.35, 0.4), (0.45, 0.35, 0.35)
print('Bernard im Original-Stil:', len([o for o in O if o.name.startswith('RB_Schick')]), 'neue Teile')
