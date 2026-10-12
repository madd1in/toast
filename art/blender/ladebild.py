# Ladebildschirm als Blender-Rendering (in Blender ausführen, vorher REPO setzen):
#   REPO = r'C:/.../Tentakel-Toast'; exec(open(REPO + '/art/blender/ladebild.py').read())
# Nachtszene im Toon-Look der Räume: Vollmond, Sterne, die Villa (Szene „Haus“) leicht schief auf dem Hügel,
# davor Bernard, Hoagie und Laverne (Rigs im neuen Look), dazu ein Toast auf der Flucht vor dem Lila Tentakel.
# Figuren und Villa werden über Sammlungs-Instanzen eingesetzt – die Originale bleiben unverändert.
# Links oben bleibt Platz fürs Logo, unten für Fortschrittsbalken und Tipps (die malt js/vorspann.js darüber).
# Schreibt art/render/ladebild.png (1920 × 1200) – danach im Repo-Ordner: python art/blender/ladebild_post.py
import bpy, bmesh, math, random, sys, importlib
from mathutils import Vector
sys.path.insert(0, REPO + '/art/blender')
import figur_lib
importlib.reload(figur_lib)
from figur_lib import Builder, toon, hexlin

SC = bpy.data.scenes.get('Ladebild') or bpy.data.scenes.new('Ladebild')
for o in list(SC.collection.objects):
    bpy.data.objects.remove(o, do_unlink=True)
hel = bpy.data.scenes['Helden3D']
r = SC.render
r.engine = hel.render.engine
r.resolution_x, r.resolution_y, r.resolution_percentage = 1920, 1200, 100
r.film_transparent = False
r.image_settings.file_format, r.image_settings.color_mode = 'PNG', 'RGB'
SC.view_settings.view_transform, SC.view_settings.look = hel.view_settings.view_transform, hel.view_settings.look
SC.eevee.taa_render_samples = 64
r.use_freestyle = True
r.line_thickness_mode, r.line_thickness = 'ABSOLUTE', 2.4
vl = SC.view_layers[0]; vl.use_freestyle = True
ls = vl.freestyle_settings.linesets[0] if vl.freestyle_settings.linesets else vl.freestyle_settings.linesets.new('Kontur')
ls.select_by_visibility = ls.select_silhouette = ls.select_border = ls.select_crease = True
ls.linestyle.color, ls.linestyle.thickness = (0.04, 0.012, 0.07), 2.4
nk = bpy.data.collections.get('Ohne_Kontur') or bpy.data.collections.new('Ohne_Kontur')
ls.select_by_collection, ls.collection, ls.collection_negation = True, nk, 'EXCLUSIVE'

# Himmel: Verlauf von tiefem Violett nach Pflaume am Horizont
w = bpy.data.worlds.get('Welt_Ladebild') or bpy.data.worlds.new('Welt_Ladebild')
w.use_nodes = True
nt = w.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
out, bg, tc, sep, ramp = (nt.nodes.new(t) for t in ('ShaderNodeOutputWorld', 'ShaderNodeBackground', 'ShaderNodeTexCoord', 'ShaderNodeSeparateXYZ', 'ShaderNodeValToRGB'))
nt.links.new(tc.outputs['Window'], sep.inputs[0]); nt.links.new(sep.outputs['Y'], ramp.inputs[0])
nt.links.new(ramp.outputs[0], bg.inputs['Color']); nt.links.new(bg.outputs[0], out.inputs[0])
ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[0].color = 0.25, (*hexlin('#6a2a6a'), 1)
ramp.color_ramp.elements[1].position, ramp.color_ramp.elements[1].color = 1.0, (*hexlin('#0a0420'), 1)
SC.world = w

B = Builder(SC)
# Kamera: leicht schräg (Holländischer Winkel wie in Day of the Tentacle)
cd = bpy.data.cameras.get('LadeCam') or bpy.data.cameras.new('LadeCam')
cd.lens, cd.sensor_fit, cd.clip_end = 30, 'HORIZONTAL', 600
cam = bpy.data.objects.new('LadeCam', cd); SC.collection.objects.link(cam)
cam.location = (0.2, -8.6, 1.55)
cam.rotation_euler = (math.radians(90.5), math.radians(-3.0), 0)
SC.camera = cam

# Boden: Hügel, Weg, Gras
GRAS, GRASD, WEG = toon('LB_Gras', '#2e5a3a', hi=0.12), toon('LB_GrasDunkel', '#1c3a2c', hi=0.1), toon('LB_Weg', '#7a5a3e', hi=0.15)
B.sphere('LB_Huegel', (5.5, 34, -11.0), (24, 14, 13.4), GRAS, None)
B.sphere('LB_HuegelVorn', (0, 4, -8.0), (30, 14, 8.0), GRASD, None)
B.sphere('LB_Weg', (-0.6, 3.5, -0.03), (1.6, 9.0, 0.04), WEG, None)
nk.objects.link(bpy.data.objects['LB_Weg'])
rnd = random.Random(7)
BUSCH = (toon('LB_Busch', '#2f6a3c', hi=0.2), toon('LB_BuschDunkel', '#1f4a2c', hi=0.15))
for i, (x, y, r_) in enumerate(((-6.5, 6, 1.1), (-4.8, 9, 0.8), (7.2, 7, 1.2), (5.6, 10, 0.9), (9.5, 12, 1.4), (-8.5, 12, 1.3), (2.8, 16, 0.9))):
    for k in range(3):   # Büsche aus drei Kugeln
        B.sphere(f'LB_Busch{i}_{k}', (x + (k - 1) * r_ * 0.7, y + k * 0.2, r_ * (0.55 + 0.25 * (k == 1))), (r_ * 0.75, r_ * 0.7, r_ * 0.65), BUSCH[(i + k) % 2], None)
# Mond und Sterne (leuchtend, ohne Kontur)
MOND = toon('LB_MondLampe', '#fff2c8', hi=1.0)
m = B.sphere('LB_Mond', (16, 80, 26), (6.0, 0.3, 6.0), MOND, None)
nk.objects.link(m) if m.name not in nk.objects else None
for i in range(160):
    x, z = rnd.uniform(-60, 60), rnd.uniform(8, 48)
    st = B.sphere(f'LB_Stern{i}', (x, 95, z), (0.12, 0.05, 0.12), toon('LB_SternLampe', '#ffffff', hi=1.0), None)
    nk.objects.link(st)


def instanz(name, sc_name, root, loc, rot=0.0, scale=1.0):
    """Sammlung mit allen Objekten unter root (aus Szene sc_name) und eine Instanz davon."""
    coll = bpy.data.collections.get('Inst_' + name) or bpy.data.collections.new('Inst_' + name)
    def baum(o):
        yield o
        for c in o.children:
            yield from baum(c)
    for o in baum(bpy.data.objects[root]):
        if o.name not in coll.objects:
            coll.objects.link(o)
    e = bpy.data.objects.new('LB_' + name, None)
    e.instance_type, e.instance_collection = 'COLLECTION', coll
    e.location, e.rotation_euler, e.scale = loc, (0, 0, rot), (scale, scale, scale)
    SC.collection.objects.link(e)
    return e


# Villa: alle Wurzeln der Szene „Haus“ in eine Sammlung, auf dem Hügel, leicht gekippt
haus = bpy.data.collections.get('Inst_Villa') or bpy.data.collections.new('Inst_Villa')
for o in bpy.data.scenes['Haus'].objects:
    if o.type in ('MESH', 'EMPTY', 'CURVE', 'FONT') and o.name not in haus.objects:
        haus.objects.link(o)
v = bpy.data.objects.new('LB_Villa', None)
v.instance_type, v.instance_collection = 'COLLECTION', haus
v.location, v.rotation_euler, v.scale = (3.4, 28.0, 2.2), (math.radians(2), math.radians(-7), math.radians(-14)), (2.1, 2.1, 2.3)   # schief wie in Day of the Tentacle
SC.collection.objects.link(v)
# Fensterschein der Villa
for i, (x, z) in enumerate(((1.6, 4.0), (4.6, 4.4), (3.2, 8.2), (6.2, 6.6))):
    ld = bpy.data.lights.new(f'LB_Fensterlicht{i}', 'POINT'); ld.energy, ld.color = 900, (1.0, 0.78, 0.4)
    lo = bpy.data.objects.new(f'LB_Fensterlicht{i}', ld); SC.collection.objects.link(lo); lo.location = (x, 25.5, z)

# die drei Helden im neuen Look, vorn links auf dem Weg
instanz('Bernard', 'Rig3D', 'BRig', (-4.3, 0.9, 0.0), rot=math.radians(22))
instanz('Hoagie', 'Rig3D_Hoagie', 'HRig', (-2.75, 0.2, 0.0), rot=math.radians(14))
instanz('Laverne', 'Rig3D_Laverne', 'LRig', (-1.35, 1.0, 0.0), rot=math.radians(8))

# Lila Tentakel jagt einen Toast über die Wiese
tent = instanz('Lila', 'Rig3D_T_lila', [o.name for o in bpy.data.scenes['Rig3D_T_lila'].objects if o.parent is None and o.type == 'EMPTY'][0], (3.9, 4.6, 0.0), rot=math.radians(-40), scale=0.8)
TOAST, KRUSTE = toon('LB_Toast', '#f6d898', hi=0.7), toon('LB_Kruste', '#c87a34', hi=0.5)
T = B.empty('LB_Toastfigur'); T.location = (1.7, 2.6, 0.62); T.rotation_euler = (0, math.radians(-14), math.radians(-25)); T.scale = (1.25, 1.25, 1.25)
bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
B.obj('LB_ToastKruste', bm, KRUSTE, T, (0, 0, 0.32), scale=(0.62, 0.16, 0.66), smooth=False, bevel=0.08)
bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
B.obj('LB_ToastKrume', bm, TOAST, T, (0, -0.02, 0.32), scale=(0.52, 0.16, 0.56), smooth=False, bevel=0.05)
for k in (-1, 1):
    B.sphere(f'LB_ToastAuge{k}', (k * 0.12, -0.11, 0.42), (0.07, 0.03, 0.09), toon('LB_AugeWeiss', '#ffffff', hi=0.9), T)
    B.sphere(f'LB_ToastPupille{k}', (k * 0.12 + 0.03, -0.135, 0.42), (0.03, 0.015, 0.04), toon('LB_Pupille', '#16121e'), T)
    B.rod(f'LB_ToastBein{k}', (k * 0.15, 0, 0.0), (k * 0.15 + 0.1 * k, -0.05, -0.42), 0.025, toon('LB_Pupille', '#16121e'), T)
    B.rod(f'LB_ToastArm{k}', (k * 0.3, 0, 0.36), (k * 0.55, -0.05, 0.6 + 0.1 * k), 0.022, toon('LB_Pupille', '#16121e'), T)
B.sphere('LB_ToastMund', (0.0, -0.12, 0.24), (0.07, 0.02, 0.06), toon('LB_Mund', '#7a2222'), T)

# Licht: kühles Mondlicht, warmes Füll- und ein lila Randlicht
for name, rot, en, col in (('LB_Mondlicht', (math.radians(55), 0, math.radians(-25)), 2.6, (0.72, 0.76, 1.0)), ('LB_Randlicht', (math.radians(70), 0, math.radians(150)), 1.6, (0.85, 0.5, 1.0))):
    ld = bpy.data.lights.new(name, 'SUN'); ld.energy, ld.color, ld.angle = en, col, 0.2
    lo = bpy.data.objects.new(name, ld); SC.collection.objects.link(lo); lo.rotation_euler = rot
ld = bpy.data.lights.new('LB_Fuell', 'AREA'); ld.energy, ld.color, ld.size = 900, (1.0, 0.85, 0.65), 6
lo = bpy.data.objects.new('LB_Fuell', ld); SC.collection.objects.link(lo); lo.location = (-3, -6, 5); lo.rotation_euler = (math.radians(60), 0, math.radians(-20))

win = bpy.context.window
prev = win.scene
win.scene = SC
try:
    if not globals().get('NO_RENDER'):
        SC.render.filepath = REPO + '/art/render/ladebild.png'
        bpy.ops.render.render(write_still=True, scene=SC.name)
finally:
    if not globals().get('BLEIBEN'):
        win.scene = prev
print('Ladebild fertig')
