# Tentakel als Spielfiguren rendern (in Blender ausführen, vorher REPO und NAME setzen):
#   REPO = r'C:/.../Tentakel-Toast'; NAME = 'green'; exec(open(REPO + '/art/blender/tent_build.py').read())
# Grün, Lila (auch nett/rosa) kommen aus dem Modell der Szene Tentakel3D_v2 (tent_v2.py), die Wache aus Wache3D.
# Jede Variante bekommt eine eigene Szene; gerendert werden Mund zu/offen, bei Lila dazu drei Armhaltungen.
# Wippen, Federn und Hüpfen macht das Spiel per Verformung des Bildes (wie bei den gezeichneten Tentakeln).
# Schreibt art/render/<name>/*.png und meta.json (danach figur_post.py und figur_js.py).
import bpy, json, os, sys, importlib
from mathutils import Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view
sys.path.insert(0, REPO + '/art/blender')
import figur_lib
importlib.reload(figur_lib)
from figur_lib import hexlin

SCALE = 0.567   # Titel-Modell (Kuppe bei 3,44 m) auf die Größe der Spielfiguren
YAW = 2.43      # Mund zur Kamera, Blick nach rechts wie bei den Helden
VARS = {
    'green': dict(src='Tentakel3D_v2', p='Tent', cols=('#4fbf3a', '#2c7a1f', '#b4ef98'), arms=False),
    'lila': dict(src='Tentakel3D_v2', p='Tent', cols=('#8e44c9', '#5b2589', '#d9b2f2'), arms=True),
    'nett': dict(src='Tentakel3D_v2', p='Tent', cols=('#ef7fc4', '#b5407f', '#ffd6ee'), arms=True),
    'guard': dict(src='Wache3D', p='W_', cols=None, arms=False),
}
ARM_ROOT = {'L': Vector((-0.35, 0, 1.6)), 'R': Vector((0.35, 0, 1.75))}   # Ansatz der Lila-Arme am Körper (vorn/hinten)
WAVE = [-0.35, 0.0, 0.35]   # Armhaltungen wie tArm() in draw.js: negativ = beide Arme hoch


def recolor(src_name, name, hexcol):
    m = bpy.data.materials.get(name) or bpy.data.materials[src_name].copy()
    m.name = name
    col = (*hexlin(hexcol), 1)
    m.node_tree.nodes['ToonMul'].inputs[6].default_value = col
    next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value = col
    m.diffuse_color = col
    hi = m.node_tree.nodes.get('ToonHi')
    if hi:   # matt wie Gummi statt glänzend wie Plastik
        hi.color_ramp.elements[1].color = (0.16, 0.16, 0.16, 1)
    return m


def world(o):
    """Lage in der Welt aus der Hierarchie (matrix_world ist in nicht aktiven Szenen oft veraltet)."""
    return (world(o.parent) @ o.matrix_parent_inverse if o.parent else Matrix.Identity(4)) @ o.matrix_basis


def build(name):
    v = VARS[name]
    src = bpy.data.scenes[v['src']]
    SC = bpy.data.scenes.get('Rig3D_T_' + name) or bpy.data.scenes.new('Rig3D_T_' + name)
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
    # Der Körper der Titel-Modelle reicht unter den Boden: eine Holdout-Platte bei z = 0 blendet alles darunter aus
    hold = bpy.data.materials.get('T_Holdout')
    if hold is None:
        hold = bpy.data.materials.new('T_Holdout')
        hold.use_nodes = True
        nt = hold.node_tree
        for n in list(nt.nodes):
            if n.type != 'OUTPUT_MATERIAL':
                nt.nodes.remove(n)
        nt.links.new(nt.nodes.new('ShaderNodeHoldout').outputs[0], next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL').inputs['Surface'])
    me = bpy.data.meshes.get('T_Boden') or bpy.data.meshes.new('T_Boden')
    if not me.vertices:
        me.from_pydata([(-10, -10, 0), (10, -10, 0), (10, 10, 0), (-10, 10, 0)], [], [(0, 1, 2, 3)])
        me.materials.append(hold)
    floor = bpy.data.objects.new(f'T_{name}_Boden', me)
    SC.collection.objects.link(floor)
    root = bpy.data.objects.new(f'T_{name}_Rig', None)
    SC.collection.objects.link(root)
    root.scale = (SCALE,) * 3
    root.rotation_euler = (0, 0, YAW)
    mats = {}
    if v['cols']:
        body, dark, lite = v['cols']
        mats = {'TentKoerper': recolor('TentKoerper', f'T_{name}_Koerper', body), 'TentLippe': recolor('TentLippe', f'T_{name}_Lippe', dark),
                'TentNapf': recolor('TentNapf', f'T_{name}_Napf', lite)}
    piv = {}
    if v['arms']:
        for k, at in ARM_ROOT.items():
            e = bpy.data.objects.new(f'T_{name}_Arm{k}', None)
            SC.collection.objects.link(e)
            e.parent = root
            e.location = at
            piv[k] = e
    parts = {}
    for o in src.objects:
        if o.type not in ('MESH', 'CURVE') or not o.name.startswith(v['p']):
            continue
        if not v['arms'] and 'Arm' in o.name and v['p'] == 'Tent':
            continue
        base = o.name[len(v['p']):].split('.')[0]   # Tentakel3D_v2 teilt die Namen mit dem alten Modell (.001)
        c = o.copy()
        c.name = f'T_{name}_' + base
        c.hide_render = c.hide_viewport = False
        SC.collection.objects.link(c)
        for sl in c.material_slots:   # Farbe nur an diesem Objekt ändern, die Daten teilen sich alle Varianten
            mn = sl.material.name if sl.material else None
            if mn in mats:
                sl.link = 'OBJECT'
                sl.material = mats[mn]
        arm = next((k for k in piv if o.name.startswith(v['p'] + 'Arm' + k)), None)
        par = piv[arm] if arm else root
        c.parent = par
        c.matrix_parent_inverse = Matrix.Identity(4)
        c.matrix_basis = (Matrix.Translation(-ARM_ROOT[arm]) if arm else Matrix.Identity(4)) @ world(o)
        parts[base] = c
    print('tent', name, SC.name, sorted(parts))
    return SC, root, parts, piv


def render(name):
    SC, root, parts, piv = build(name)
    lip, slit = parts['Lippe'], parts['Schlitz']
    lip_s, slit_s = lip.scale.copy(), slit.scale.copy()
    frames = []
    for open_ in (False, True):
        for wi, w in enumerate(WAVE if piv else [0.0]):
            n = (f'a{wi}' if piv else ('idle' if not open_ else 'talk')) + ('o' if open_ and piv else '')
            frames.append((n, open_, w))
    out = REPO + f'/art/render/{name}/'
    os.makedirs(out, exist_ok=True)
    win = bpy.context.window
    prev = win.scene
    win.scene = SC
    cam = SC.camera
    W, H = SC.render.resolution_x, SC.render.resolution_y

    def px(co):
        p = world_to_camera_view(SC, cam, co)
        return [round(p.x * W, 1), round((1 - p.y) * H, 1)]

    meta = {'res': [W, H], 'ppm': H / cam.data.ortho_scale, 'frames': []}
    try:
        for n, open_, w in frames:
            lip.scale = (lip_s.x, lip_s.y, lip_s.z * (1.45 if open_ else 1))
            slit.scale = (slit_s.x * (1.6 if open_ else 1), slit_s.y * (1.12 if open_ else 1), slit_s.z * (3.4 if open_ else 1))
            if piv:
                piv['L'].rotation_euler = (0, -w, 0)   # vorderer Arm
                piv['R'].rotation_euler = (0, w, 0)    # hinterer Arm
            bpy.context.view_layer.update()
            m = px(lip.matrix_world.translation)
            top = parts['Kuppe'].matrix_world @ Vector((0, 0, max(c[2] for c in parts['Kuppe'].bound_box)))
            meta['frames'].append({'name': n, 'foot': px(root.matrix_world.translation), 'mouth': m, 'eyes': [m, m], 'hand': px(top)})
            SC.render.filepath = out + f'{n}.png'
            bpy.ops.render.render(write_still=True, scene=SC.name)
    finally:
        lip.scale, slit.scale = lip_s, slit_s
        for e in piv.values():
            e.rotation_euler = (0, 0, 0)
        win.scene = prev
    if piv:   # Stand = Arme in Ruhe, Mund zu
        meta['frames'].insert(0, dict(meta['frames'][1], name='idle'))
        import shutil
        shutil.copy(out + 'a1.png', out + 'idle.png')
    json.dump(meta, open(out + 'meta.json', 'w'), indent=1)
    print('frames', name, [f['name'] for f in meta['frames']])


if globals().get('NAME') in VARS:
    if globals().get('RENDER', True):
        render(NAME)
    else:
        build(NAME)
