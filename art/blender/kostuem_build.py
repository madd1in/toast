# Laverne im Tentakel-Kostüm als Spielfigur rendern (in Blender ausführen, vorher REPO setzen; optional ONLY = ['idle']):
#   REPO = r'C:/.../Tentakel-Toast'; exec(open(REPO + '/art/blender/kostuem_build.py').read())
# Gleiche Kamera, Lichter und Holdout-Boden wie tent_build.py; das Kostüm kommt aus kostuem_lib.py (Fahnenstoff,
# Augenlöcher mit Lavernes Augen, ihre Nase, Ringelbeine). Bilder: idle (Mund zu), talk (Mund offen).
# Schreibt art/render/kostuem/*.png und meta.json (danach figur_post.py kostuem und figur_js.py).
import bpy, json, os, sys, importlib
from mathutils import Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view
sys.path.insert(0, REPO + '/art/blender')
import figur_lib, kostuem_lib
importlib.reload(figur_lib)
importlib.reload(kostuem_lib)

SCALE = 0.475   # Kuppe bei (3,44 + 0,8) × 0,475 ≈ 2,01 m
YAW = 2.43      # wie die Tentakel: Mundöffnung zur Kamera, Blick nach rechts


def szene():
    SC = bpy.data.scenes.get('Rig3D_T_kostuem') or bpy.data.scenes.new('Rig3D_T_kostuem')
    keep = ('MondH3', 'FuellH3', 'RigCam')
    for o in list(SC.collection.objects):
        if o.name in keep:
            SC.collection.objects.unlink(o)
        else:
            bpy.data.objects.remove(o, do_unlink=True)
    hel = bpy.data.scenes['Helden3D']
    for n in keep:
        SC.collection.objects.link(bpy.data.objects[n])
    SC.camera = bpy.data.objects['RigCam']
    SC.world = hel.world
    r, s = SC.render, hel.render
    r.engine = s.engine
    r.resolution_x, r.resolution_y, r.resolution_percentage = 600, 840, 100
    r.film_transparent = True
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    SC.view_settings.view_transform = hel.view_settings.view_transform
    SC.view_settings.look = hel.view_settings.look
    SC.eevee.taa_render_samples = 32
    floor = bpy.data.objects.new('T_kostuem_Boden', bpy.data.meshes['T_Boden'])
    SC.collection.objects.link(floor)
    root = bpy.data.objects.new('T_kostuem_Rig', None)
    SC.collection.objects.link(root)
    root.scale = (SCALE,) * 3
    root.rotation_euler = (0, 0, YAW)
    return SC, root


def render(only=None):
    out = REPO + '/art/render/kostuem/'
    os.makedirs(out, exist_ok=True)
    meta = {'res': [600, 840], 'frames': []}
    old = os.path.join(out, 'meta.json')
    if only and os.path.exists(old):
        meta = json.load(open(old))
    for name, offen in (('idle', False), ('talk', True)):
        if only and name not in only:
            continue
        SC, root = szene()
        k = kostuem_lib.build(SC, 'KF_', root, augen=True, nase=True, beine=True, mund_offen=offen)
        win = bpy.context.window
        prev = win.scene
        win.scene = SC
        cam = SC.camera
        meta['ppm'] = SC.render.resolution_y / cam.data.ortho_scale
        try:
            bpy.context.view_layer.update()

            def px(co):
                p = world_to_camera_view(SC, cam, co)
                return [round(p.x * 600, 1), round((1 - p.y) * 840, 1)]
            lip = k['parts']['Lippe']
            ctr = sum((Vector(v.co) for v in lip.data.vertices), Vector()) / len(lip.data.vertices)
            m = px(lip.matrix_world @ ctr)
            kup = k['parts']['Kuppe']
            top = kup.matrix_world @ Vector((0, 0, max(v.co.z for v in kup.data.vertices)))
            eyes = [px(o.matrix_world.translation) for o in k['augen'][::2]] or [m, m]
            fr = {'name': name, 'foot': px(root.matrix_world.translation), 'mouth': m, 'eyes': eyes, 'hand': px(top)}
            meta['frames'] = [f for f in meta['frames'] if f['name'] != name] + [fr]
            SC.render.filepath = out + f'{name}.png'
            bpy.ops.render.render(write_still=True, scene=SC.name)
        finally:
            win.scene = prev
        print('kostuem', name, fr)
    meta['frames'].sort(key=lambda f: ['idle', 'talk'].index(f['name']))
    json.dump(meta, open(out + 'meta.json', 'w'), indent=1)


if globals().get('RENDER', True):
    render(globals().get('ONLY'))
