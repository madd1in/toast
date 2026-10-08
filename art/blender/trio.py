# Abspann-Gag in 3D: Bernard, Hoagie und Laverne kommen zu dritt aus dem Chrono-Klo – in einem einzigen riesigen grünen
# Shirt (Lavernes Kleid, auf drei Personen gedehnt) und halten sich für verschmolzen. In Blender ausführen:
#   REPO = r'C:/.../Tentakel-Toast'; exec(open(REPO + '/art/blender/trio.py').read())
# Kopiert die drei Heldenmodelle aus „Helden3D“ in die Szene „Trio3D“ (Original bleibt unangetastet), stellt sie
# nebeneinander, versteckt die inneren Arme, färbt Bernards Hemd und Hoagies Shirt grün und zieht ein großes Shirt
# mit Knöpfen über alle drei. Rendert art/render/trio/trio0.png (das Watscheln macht das Spiel)
# samt meta.json (Fußpunkt, drei Münder); danach im Repo-Ordner:  python art/blender/trio_post.py
import bpy, json, math, os, sys, importlib
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
sys.path.insert(0, REPO + '/art/blender')
import figur_lib
importlib.reload(figur_lib)
from figur_lib import Builder, toon

SC = bpy.data.scenes.get('Trio3D') or bpy.data.scenes.new('Trio3D')
KEEP = ('MondH3', 'FuellH3', 'RigCam')
for o in list(SC.collection.objects):
    if o.name in KEEP:
        SC.collection.objects.unlink(o)
    else:
        bpy.data.objects.remove(o, do_unlink=True)
for n in KEEP:
    SC.collection.objects.link(bpy.data.objects[n])
hel = bpy.data.scenes['Helden3D']
SC.camera, SC.world = bpy.data.objects['RigCam'], hel.world
r = SC.render
r.engine = hel.render.engine
r.resolution_x, r.resolution_y, r.resolution_percentage = 960, 840, 100   # 240 px pro Meter wie alle Figuren
r.film_transparent = True
r.image_settings.file_format, r.image_settings.color_mode = 'PNG', 'RGBA'
SC.view_settings.view_transform, SC.view_settings.look = hel.view_settings.view_transform, hel.view_settings.look
SC.eevee.taa_render_samples = 32
SC.camera.data.sensor_fit = 'VERTICAL'


def tree(o):
    out = [o]
    for c in o.children:
        out += tree(c)
    return out


B = Builder(SC)
ROOT = B.empty('Trio')
GREEN, BTN, WHITE = bpy.data.materials['KleidGruen'].copy(), bpy.data.materials['Knopf'], bpy.data.materials['Weiss']
GREEN.name = 'T_StoffGruen'
GREEN.node_tree.nodes['ToonHi'].color_ramp.elements[1].color = (0.08, 0.08, 0.08, 1)   # Stoff, kein Plastik
# Wer wo steht (nebeneinander quer zur Kamera, alle leicht nach rechts gedreht), was versteckt und was grün wird
PLAN = {
    'Bernard': dict(x=-0.5, y=0.06, hide=('B_ArmL', 'B_HandL', 'B_AermelL'), green=('B_Hemd', 'B_AermelR')),
    'Hoagie': dict(x=0.0, y=-0.06, hide=('H_ArmL', 'H_HandL', 'H_AermelL', 'H_ArmR', 'H_HandR', 'H_AermelR', 'H_Blitz'), green=('H_Bauch',)),
    'Laverne': dict(x=0.48, y=0.04, hide=('L_ArmR', 'L_HandR', 'L_AermelR'), green=()),
}
copies = {}
for name, pl in PLAN.items():
    src = tree(bpy.data.objects[name])
    m = {}
    for o in src:
        c = o.copy()
        if o.data is not None and o.name in pl['green']:
            c.data = o.data.copy()
            for s in c.material_slots:
                s.material = GREEN
        SC.collection.objects.link(c)
        m[o] = c
    for o, c in m.items():
        if o.parent in m:
            c.parent = m[o.parent]
            c.matrix_parent_inverse = o.matrix_parent_inverse.copy()
        c.hide_render = c.hide_viewport = o.name in pl['hide'] or o.hide_render
    top = m[bpy.data.objects[name]]
    top.parent = ROOT
    top.location, top.rotation_euler = (pl['x'], pl['y'], 0), (0, 0, -0.45)
    copies[name] = {o.name: c for o, c in m.items()}
# das gemeinsame Riesen-Shirt: ein praller Stoffsack über allen drei, weiße Kragen und drei große Knöpfe
B.sphere('T_Shirt', (0.0, 0.02, 1.0), (0.86, 0.36, 0.44), GREEN, ROOT)
B.sphere('T_Schulter', (-0.44, 0.04, 1.36), (0.3, 0.27, 0.22), GREEN, ROOT)   # zu Bernard hoch gezogen
for i, z in enumerate((1.18, 1.0, 0.82)):
    B.sphere(f'T_Knopf{i}', (0.06, -0.345, z), (0.05, 0.03, 0.05), BTN, ROOT)
for i, (xx, yy, zz) in enumerate(((-0.5, 0.06, 1.6), (0.0, -0.06, 1.3), (0.48, 0.04, 1.36))):
    B.torus(f'T_Kragen{i}', (xx, yy, zz), 0.075, 0.022, WHITE, ROOT, seg=24, sseg=6)

win = bpy.context.window
prev = win.scene
win.scene = SC
bpy.context.view_layer.update()
cam = SC.camera
W, H = r.resolution_x, r.resolution_y


def px(co):
    q = world_to_camera_view(SC, cam, co)
    return [round(q.x * W, 1), round((1 - q.y) * H, 1)]


out = REPO + '/art/render/trio/'
os.makedirs(out, exist_ok=True)
meta = {'ppm': H / cam.data.ortho_scale, 'foot': px(ROOT.matrix_world.translation),
        'mouth': {n.lower(): px(copies[n][p + '_Mund'].matrix_world.translation) for n, p in (('Bernard', 'B'), ('Hoagie', 'H'), ('Laverne', 'L'))},
        'top': max((o.matrix_world @ Vector(c)).z for o in SC.objects if o.type == 'MESH' and not o.hide_render for c in o.bound_box)}
try:
    r.filepath = out + 'trio0.png'
    bpy.ops.render.render(write_still=True, scene=SC.name)
finally:
    win.scene = prev
json.dump(meta, open(out + 'meta.json', 'w'), indent=1)
print('trio', meta)
