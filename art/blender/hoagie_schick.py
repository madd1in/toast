# Hoagie im Stil des Originals (Day of the Tentacle, 1993) – in Blender ausführen, vorher REPO setzen:
#   REPO = r'C:/.../Tentakel-Toast'; exec(open(REPO + '/art/blender/hoagie_schick.py').read())
# Formt das Rig HRig (Szene Rig3D_Hoagie) nach der klassischen Figur um: blaue Baseballkappe verkehrt herum,
# lange schwarze Haare, schwarzes Shirt mit „TOAST WARS“-Logo statt des Blitzes, weite grau-blaue
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
# Shirt: der Blitz verschwindet, das Motiv sitzt mitten auf dem Bauch (Lage aus der Hülle des Bauchs, im Raum des Rumpfes)
T = O['HR_Torso']
blitz = O['RH_Blitz']
blitz.hide_render = blitz.hide_viewport = True
bauch = O['RH_Bauch']
SC.view_layers[0].update()
inv = T.matrix_world.inverted()
pts = [inv @ (bauch.matrix_world @ Vector(c)) for c in bauch.bound_box]
z = (min(p.z for p in pts) + max(p.z for p in pts)) / 2 + 0.06   # Brusthöhe, mitten auf dem Bauch
x, y = max(p.x for p in pts) - 0.03, (min(p.y for p in pts) + max(p.y for p in pts)) / 2
# Motiv: „TOAST WARS“ im Stil eines Weltraum-Filmlogos – gelbe Blockschrift, zweizeilig, flach auf den Bauch gewickelt
# (Shrinkwrap auf RH_Bauch: liegt auf dem Stoff statt wie ein Anhänger davor zu hängen)
GELB = toon('H_LogoGelb', '#ffd23a', hi=0.8)
for zeile, (txt_, dz, gr) in enumerate((('TOAST', 0.05, 0.085), ('WARS', -0.045, 0.1))):
    cd = bpy.data.curves.new(f'RH_SchickLogo{zeile}K', 'FONT')
    cd.body, cd.size, cd.align_x, cd.align_y = txt_, gr, 'CENTER', 'CENTER'
    cd.space_character, cd.extrude, cd.offset = 1.12, 0.0, 0.004   # breit gesperrt, leicht fett
    cd.materials.append(GELB)
    lo = bpy.data.objects.new(f'RH_SchickLogo{zeile}', cd)
    SC.collection.objects.link(lo)
    lo.parent = O['HR_Torso']
    lo.location = (x + 0.06, y, z + dz)
    lo.rotation_euler = (math.pi / 2, 0, math.pi / 2)   # Schrift blickt nach vorn (+x)
    lo.scale = (1.0, 1.25 if zeile == 0 else 1.0, 1.0)
    sw = lo.modifiers.new('AufsShirt', 'SHRINKWRAP')
    sw.target, sw.wrap_method, sw.wrap_mode, sw.offset = bauch, 'NEAREST_SURFACEPOINT', 'OUTSIDE_SURFACE', 0.004
for k in (-1, 1):   # Zierlinien über und unter dem Schriftzug, ebenfalls aufs Shirt gewickelt
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    me = bpy.data.meshes.new(f'RH_SchickLogoLinie{k}'); bm.to_mesh(me); bm.free(); me.materials.append(GELB)
    li = bpy.data.objects.new(f'RH_SchickLogoLinie{k}', me); SC.collection.objects.link(li)
    li.parent, li.location, li.scale = O['HR_Torso'], (x + 0.06, y, z + k * 0.115 + 0.003), (0.004, 0.11, 0.006)
    sw = li.modifiers.new('AufsShirt', 'SHRINKWRAP'); sw.target, sw.wrap_method, sw.wrap_mode, sw.offset = bauch, 'NEAREST_SURFACEPOINT', 'OUTSIDE_SURFACE', 0.004
print('Hoagie im Original-Stil:', len([o for o in O if o.name.startswith('RH_Schick')]), 'neue Teile')
