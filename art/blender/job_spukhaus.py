# Hintergrund-Job (ohne Blender-Oberfläche):
#   blender -b art/logo.blend --python art/blender/job_spukhaus.py
# Baut das Spukhaus (spukhaus.py), rendert das Titelbild (art/render/haus_spuk.png + haus_spuk.json mit Fenstern,
# Laternen und Schornstein), baut die Auffahrt neu (raum_build.py, NAME='auffahrt'), exportiert sie (echt3d_export.py)
# und speichert die .blend.
import bpy, json, os, sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
REPO = r'C:/Users/User/Documents/Tentakel-Toast'
ns = {'REPO': REPO, '__name__': 'spuk'}
exec(open(REPO + '/art/blender/spukhaus.py', encoding='utf-8').read(), ns)
HS = bpy.data.scenes['Haus']
r = HS.render
r.film_transparent = True
r.use_freestyle = True
r.line_thickness_mode = 'ABSOLUTE'; r.line_thickness = 2.4
vl = HS.view_layers[0]; vl.use_freestyle = True
fs = vl.freestyle_settings
ls = fs.linesets[0] if fs.linesets else fs.linesets.new('Kontur')
ls.select_by_visibility = True
ls.select_silhouette = ls.select_border = ls.select_crease = True
ls.linestyle.color = (0.05, 0.02, 0.08); ls.linestyle.thickness = 2.4
r.resolution_x, r.resolution_y, r.resolution_percentage = 1000, 1100, 100
r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGBA'
r.filepath = REPO + '/art/render/haus_spuk.png'
if not os.environ.get('OHNE_TITEL'):   # das Titelbild dauert gut zehn Minuten (Konturen); schon vorhanden -> überspringen
    bpy.ops.render.render(write_still=True, scene=HS.name)
cam = HS.camera
HS.view_layers[0].update()   # Weltlagen und Hüllkörper der neuen Teile


def bild(o):   # Mittelpunkt des Objekts in Bildpunkten (1000 × 1100)
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    m = sum(bb, Vector()) / 8
    q = world_to_camera_view(HS, cam, m)
    return [round(q.x * r.resolution_x, 1), round((1 - q.y) * r.resolution_y, 1)]


obj = {o.name: o for o in HS.objects}
at = {'chimney': bild(obj['SchornsteinKopf']),
      'windows': [bild(o) for o in HS.objects if (o.name.endswith('G') and o.name.startswith(('FensterU', 'FensterO'))) or o.name.startswith(('KuppelFenster', 'GaubeFenster'))],
      'lamps': [bild(obj[n]) for n in ('Laterne0', 'Laterne1')]}
json.dump(at, open(REPO + '/art/render/haus_spuk.json', 'w'), indent=1)
print('Titelbild fertig', len(at['windows']), 'Fenster')
# Auffahrt neu mit dem Spukhaus
ns2 = {'REPO': REPO, 'NAME': 'auffahrt', '__name__': 'raum'}
exec(open(REPO + '/art/blender/raum_build.py', encoding='utf-8').read(), ns2)
ns3 = {'REPO': REPO, 'WHAT': ['auffahrt'], '__name__': 'exp'}
exec(open(REPO + '/art/blender/echt3d_export.py', encoding='utf-8').read(), ns3)
bpy.ops.wm.save_mainfile()
print('JOB FERTIG')
