# Wache: oranger Tentakel (Kopie des grünen aus Tentakel3D) mit Helm und Speer, eigene Szene "Wache3D"
import bpy, math, sys, importlib
sys.path.insert(0, REPO + '/art/blender')
import figur_lib as npc_lib
importlib.reload(npc_lib)
from figur_lib import toon, Builder

src = bpy.data.scenes['Tentakel3D']
SC = bpy.data.scenes.get('Wache3D') or bpy.data.scenes.new('Wache3D')
for o in list(SC.collection.objects):
    if o.name in ('MondT', 'FuellT'):
        SC.collection.objects.unlink(o)
    else:
        bpy.data.objects.remove(o, do_unlink=True)
for n in ('MondT', 'FuellT'):
    SC.collection.objects.link(bpy.data.objects[n])
SC.world = src.world
r, s = SC.render, src.render
r.engine = s.engine
r.resolution_x, r.resolution_y, r.resolution_percentage = 440, 640, 100
r.film_transparent = True
r.image_settings.file_format = 'PNG'
r.image_settings.color_mode = 'RGBA'
SC.view_settings.view_transform = src.view_settings.view_transform
SC.view_settings.look = src.view_settings.look
SC.eevee.taa_render_samples = src.eevee.taa_render_samples

# Kamera wie beim Tentakel, aber höher und weiter, damit die Speerspitze ins Bild passt
tc = bpy.data.objects['TentCam']
cd = tc.data.copy()
cd.ortho_scale = 5.6
cam = bpy.data.objects.new('WacheCam', cd)
SC.collection.objects.link(cam)
cam.rotation_euler = tc.rotation_euler
cam.location = (tc.location.x, tc.location.y, tc.location.z + 0.75)
SC.camera = cam

B = Builder(SC)
R = B.empty('Wache')
BODY = toon('W_Koerper', '#f08a2c')
LIP = toon('W_Lippe', '#c45a14')
NAPF = toon('W_Napf', '#ffd9a8')
MOUTH = bpy.data.materials['TentMund']
STEEL = toon('W_Stahl', '#c9cfdc', hi=0.85)
GOLD = toon('N_Gold', '#e9b53c', hi=0.6)
WOOD = toon('W_Holz', '#8a5a32')
remap = {'TentKoerper': BODY, 'TentLippe': LIP, 'TentNapf': NAPF, 'TentMund': MOUTH}
for o in src.objects:
    if o.type not in ('MESH', 'CURVE') or o.name.startswith('TentArm'):
        continue
    c = o.copy()
    c.data = o.data.copy()
    c.name = 'W_' + o.name[4:]
    SC.collection.objects.link(c)
    for i, m in enumerate(c.data.materials):
        c.data.materials[i] = remap.get(m.name, m)
    c.parent = R
    c.matrix_parent_inverse.identity()

# Helm (Kettenhaube wie beim Morion): Kuppel, breite Krempe, Kamm mit Goldknauf
top = 3.0
B.sphere('W_Helm', (0, 0, top + 0.12), (0.5, 0.5, 0.44), STEEL, R)
B.cone('W_Krempe', top + 0.04, top + 0.12, 0.68, 0.58, STEEL, R, bevel=0.03)
B.cone('W_Kamm', top + 0.5, top + 0.74, 0.09, 0.012, STEEL, R, bevel=0.005)
B.sphere('W_Knauf', (0, 0, top + 0.55), (0.07, 0.07, 0.07), GOLD, R)
B.torus('W_Helmband', (0, 0, top + 0.16), 0.49, 0.03, GOLD, R)
# Speer rechts neben dem Körper, leicht nach hinten geneigt, mit Arm-Stummel, der ihn hält
p0, p1 = (0.78, -0.25, -0.35), (0.9, -0.1, 4.2)
B.rod('W_Schaft', p0, p1, 0.045, WOOD, R)
d = [p1[i] - p0[i] for i in range(3)]
at = lambda t: tuple(p0[i] + d[i] * t for i in range(3))
B.rod('W_Spitze', at(1.0), tuple(at(1.0)[i] + d[i] * 0.12 for i in range(3)), 0.11, STEEL, R, r1=0.004, seg=4, bevel=0.01)
B.torus('W_Zwinge', at(0.995), 0.06, 0.025, GOLD, R)
B.rod('W_Arm', (0.3, -0.25, 1.75), at(0.45), 0.1, BODY, R, r1=0.085, bevel=0.03)
B.sphere('W_Hand', at(0.45), (0.12, 0.11, 0.13), LIP, R)
print('ok', len(R.children))
