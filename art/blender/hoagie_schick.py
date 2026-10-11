# Hoagie im Stil des Originals (Day of the Tentacle, 1993) – in Blender ausführen, vorher REPO setzen:
#   REPO = r'C:/.../Tentakel-Toast'; exec(open(REPO + '/art/blender/hoagie_schick.py').read())
# Formt das Rig HRig (Szene Rig3D_Hoagie) nach der klassischen Figur um: blaue Baseballkappe verkehrt herum,
# lange schwarze Haare, schwarzes Metal-Shirt mit Totenkopf und Flammen statt des Blitzes, weite grau-blaue
# Hose, weiße Turnschuhe. Neue Teile hängen am Rumpf (HR_Torso), damit sie mit Gehen und Mimik mitlaufen.
# Mehrfach ausführbar: RH_Schick*-Teile werden ersetzt. Danach: WHAT = ['hoagie']; exec(open(REPO + '/art/blender/echt3d_export.py').read())
import bpy, bmesh, math, sys, importlib
from mathutils import Vector
sys.path.insert(0, REPO + '/art/blender')
import figur_lib
importlib.reload(figur_lib)
from figur_lib import toon

for o in [o for o in bpy.data.objects if o.name.startswith('RH_Schick')]:
    bpy.data.objects.remove(o, do_unlink=True)
SC = bpy.data.scenes['Rig3D_Hoagie']
O, M = bpy.data.objects, bpy.data.materials
KAPPE = toon('H_KappeBlau', '#2a4ac8', hi=0.6)
HAAR = toon('H_HaarSchwarz', '#1a1418', hi=0.45)
HOSE = toon('H_HoseGrauBlau', '#5c6c88', hi=0.4)
SNEAKER, SOHLE = toon('H_Turnschuh', '#f2f2ee', hi=0.85), toon('H_TurnschuhSohle', '#b8b8c0', hi=0.6)
KNOCHEN, LOCH = toon('H_Totenkopf', '#f4f0e4', hi=0.8), toon('H_TotenkopfLoch', '#14101a', hi=0.3)
FEUER = (toon('H_FlammeOrange', '#ff7a1a', hi=0.8), toon('H_FlammeGelb', '#ffd23a', hi=0.9))


def teil(name, kind, parent, loc, scale, mat, rot=(0, 0, 0), seg=16):
    bm = bmesh.new()
    if kind == 'kegel':
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=1, radius2=0, depth=2)
    elif kind == 'kugel':
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(6, seg // 2), radius=1)
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


def faerben(alt, neu):
    for o in SC.objects:
        if o.type == 'MESH':
            for sl in o.material_slots:
                if sl.material and sl.material.name in alt:
                    sl.material = neu


faerben(('KappeRot', 'H_KappeBlau'), KAPPE)
faerben(('H_HaarBraun', 'H_HaarSchwarz'), HAAR)
faerben(('Jeans', 'H_HoseGrauBlau'), HOSE)
faerben(('Stiefel', 'H_Turnschuh'), SNEAKER)
faerben(('H_Sohle', 'H_TurnschuhSohle'), SOHLE)
# Shirt: Totenkopf mit Flammen an der Stelle des Blitzes (Lage aus dessen Hülle, im Raum des Rumpfes)
T = O['HR_Torso']
blitz = O['RH_Blitz']
blitz.hide_render = blitz.hide_viewport = True
bauch = O['RH_Bauch']
SC.view_layers[0].update()
inv = T.matrix_world.inverted()
pts = [inv @ (bauch.matrix_world @ Vector(c)) for c in bauch.bound_box]
z = (min(p.z for p in pts) + max(p.z for p in pts)) / 2 + 0.06   # Brusthöhe, mitten auf dem Bauch
x, y = max(p.x for p in pts) - 0.03, (min(p.y for p in pts) + max(p.y for p in pts)) / 2
G = 1.45   # Motivgröße
teil('RH_SchickSchaedel', 'kugel', 'HR_Torso', (x, y, z + 0.05 * G), (0.02, 0.085 * G, 0.08 * G), KNOCHEN, seg=16)
teil('RH_SchickKiefer', 'box', 'HR_Torso', (x - 0.004, y, z - 0.03 * G), (0.014, 0.05 * G, 0.03 * G), KNOCHEN)
for s in (-1, 1):
    teil(f'RH_SchickAuge{s}', 'kugel', 'HR_Torso', (x + 0.014, y + s * 0.032 * G, z + 0.04 * G), (0.008, 0.022 * G, 0.024 * G), LOCH, seg=10)
teil('RH_SchickNase', 'kugel', 'HR_Torso', (x + 0.015, y, z), (0.006, 0.01 * G, 0.014 * G), LOCH, seg=8)
for i in range(3):
    teil(f'RH_SchickZahn{i}', 'box', 'HR_Torso', (x + 0.009, y + (i - 1) * 0.022 * G, z - 0.03 * G), (0.004, 0.003 * G, 0.022 * G), LOCH)
for i, (dy, h, w) in enumerate(((-0.12, 0.09, 0.03), (-0.075, 0.12, 0.032), (0.075, 0.12, 0.032), (0.12, 0.09, 0.03), (0.0, 0.06, 0.05))):
    for k, mat in enumerate(FEUER):   # zwei Lagen: außen orange, innen gelb
        teil(f'RH_SchickFlamme{i}{k}', 'kegel', 'HR_Torso', (x - 0.01 + k * 0.006, y + dy * G * (1 - k * 0.05), z - 0.07 * G + h * G * (1 + k * 0.1) * 0.6),
             (0.012, w * G * (1 - 0.45 * k), h * G * (1 - 0.4 * k)), mat, rot=(dy * 2.2, 0, 0), seg=8)
print('Hoagie im Original-Stil:', len([o for o in O if o.name.startswith('RH_Schick')]), 'neue Teile')
