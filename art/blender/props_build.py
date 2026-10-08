# Gegenstände in den Räumen als 3D-Bilder (in Blender ausführen, vorher REPO setzen; optional ONLY = ['zucker', ...]):
#   REPO = r'C:/.../Tentakel-Toast'; exec(open(REPO + '/art/blender/props_build.py').read())
# Die drei Chrono-Klos (Gegenwart, Plumpsklo 1776, Klo 3000), Zuckerdose (voll/leer), Obstschale, Eimer, Schaufel und
# die Tentakel-Laterne (an/aus) – Objekte, die das Spiel einzeln zeichnet und die js/figuren3d.js im HD-Modus durch
# diese Bilder ersetzt. Jedes Teil wird allein gerendert; danach python art/blender/props_post.py.
import bpy, bmesh, json, math, os, sys, importlib
from mathutils import Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view
sys.path.insert(0, REPO + '/art/blender')
import figur_lib
importlib.reload(figur_lib)
from figur_lib import Builder, toon

YAW = -0.22   # leicht schräg, damit man die Tiefe sieht – die Räume sind fast frontal gezeichnet


def scene():
    SC = bpy.data.scenes.get('Props3D') or bpy.data.scenes.new('Props3D')
    keep = ('MondH3', 'FuellH3', 'PropCam')
    for o in list(SC.collection.objects):
        if o.name in keep:
            SC.collection.objects.unlink(o)
        else:
            bpy.data.objects.remove(o, do_unlink=True)
    cam = bpy.data.objects.get('PropCam')
    if cam is None:
        cd = bpy.data.cameras.new('PropCam')
        cd.type = 'ORTHO'
        cam = bpy.data.objects.new('PropCam', cd)
    for n in keep:
        SC.collection.objects.link(bpy.data.objects[n])
    hel = bpy.data.scenes['Helden3D']
    SC.camera = cam
    SC.world = hel.world
    r = SC.render
    r.engine = hel.render.engine
    r.film_transparent = True
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    SC.view_settings.view_transform = hel.view_settings.view_transform
    SC.view_settings.look = hel.view_settings.look
    SC.eevee.taa_render_samples = 32
    return SC, cam


def box(B, name, loc, size, mat, parent, rot=(0, 0, 0), bevel=0.01):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    return B.obj(name, bm, mat, parent, loc, rot, size, smooth=False, bevel=bevel)


def text(SC, name, body, loc, size, mat, parent, rot=(math.pi / 2, 0, 0)):
    cd = bpy.data.curves.get(name) or bpy.data.curves.new(name, 'FONT')
    cd.body = body
    cd.size = size
    cd.align_x, cd.align_y = 'CENTER', 'CENTER'
    cd.extrude = 0.004
    cd.materials.clear()
    cd.materials.append(mat)
    o = bpy.data.objects.new(name, cd)
    SC.collection.objects.link(o)
    o.parent = parent
    o.location = loc
    o.rotation_euler = rot
    return o


def tube(SC, name, pts, r, mat, parent, tip=1.0):
    cd = bpy.data.curves.get(name) or bpy.data.curves.new(name, 'CURVE')
    cd.splines.clear()
    cd.dimensions = '3D'
    cd.bevel_depth = r
    cd.bevel_resolution = 6
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


def copy_tree(SC, src, parent, prefix):
    """Ein vorhandenes Modell (mit Kindern) in die Props-Szene kopieren."""
    def cp(o, par):
        c = o.copy()
        c.name = prefix + o.name
        c.hide_render = c.hide_viewport = False
        c.animation_data_clear()   # das Zeitreise-Klo taumelt per Keyframes – hier soll es stillstehen
        SC.collection.objects.link(c)
        c.parent = par
        c.matrix_parent_inverse = o.matrix_parent_inverse.copy()
        for ch in o.children:
            cp(ch, c)
        return c
    root = cp(src, parent)
    return root


# ------------------------------------------------------------------ die Teile (Fußpunkt bei z = 0, Vorderseite zur Kamera = -y)
def p_klo_heute(SC, B, R):
    k = copy_tree(SC, bpy.data.objects['KloPivot'], R, 'PH_')
    k.location = (0, 0, 1.56)
    k.rotation_euler = (0, 0, 0)
    plate = box(B, 'PH_Schild', (0, -0.6, 1.25), (0.62, 0.04, 0.14), toon('P_Gold', '#e9b53c', hi=0.6), R, bevel=0.01)
    text(SC, 'PH_SchildText', 'CHRONO-KLO', (0, -0.625, 1.25), 0.085, toon('P_Dunkel', '#3a2418'), R)
    B.sphere('PH_Mond', (0.04, -0.6, 1.72), (0.07, 0.02, 0.07), toon('P_Mond', '#fff4b0', hi=0.95), R)
    B.sphere('PH_Uhr', (0.6, -0.1, 2.0), (0.02, 0.12, 0.12), toon('P_Messing', '#d8c890', hi=0.7), R)
    B.sphere('PH_Knopf', (0.6, -0.1, 1.6), (0.03, 0.07, 0.07), toon('P_Tuerkis', '#2ad0d8', hi=0.9), R)


def p_plumpsklo(SC, B, R):
    WOOD, DARK, ROOF = toon('P_Holz', '#a8743e'), toon('P_HolzDunkel', '#6a4426'), toon('P_Schindel', '#8a5a34')
    box(B, 'PP_Haus', (0, 0, 1.1), (1.25, 1.1, 2.2), WOOD, R, bevel=0.02)
    for i in range(6):
        box(B, f'PP_Brett{i}', (-0.52 + i * 0.21, -0.556, 1.1), (0.02, 0.012, 2.15), DARK, R, bevel=0)
    box(B, 'PP_Tuer', (0, -0.57, 0.95), (0.82, 0.05, 1.8), toon('P_Tuer', '#94622e'), R, bevel=0.02)
    B.sphere('PP_MondLoch', (0, -0.6, 1.55), (0.14, 0.02, 0.14), toon('N_Schwarz', '#16121e', hi=0.15), R)
    B.sphere('PP_MondDeck', (0.07, -0.61, 1.6), (0.12, 0.02, 0.12), toon('P_Tuer', '#94622e'), R)
    B.sphere('PP_Griff', (0.3, -0.6, 0.95), (0.04, 0.03, 0.04), toon('P_Messing', '#d8c890', hi=0.7), R)
    roof = box(B, 'PP_Dach', (0, -0.05, 2.32), (1.55, 1.4, 0.12), ROOF, R, rot=(0.22, 0, 0), bevel=0.02)
    box(B, 'PP_Schild', (0, -0.62, 2.08), (0.58, 0.03, 0.16), toon('P_Schildholz', '#e8d2a0'), R, bevel=0.01)
    text(SC, 'PP_SchildText', 'ABORT', (0, -0.64, 2.08), 0.1, toon('P_Dunkel', '#3a2418'), R)
    B.rod('PP_Antenne', (0, 0.1, 2.4), (0, 0.1, 2.95), 0.018, toon('P_Metall', '#6a6a78'), R, seg=8)
    B.sphere('PP_Lampe', (0, 0.1, 2.98), (0.06, 0.06, 0.06), toon('P_Rot', '#e83a3a', hi=0.95), R)
    tube(SC, 'PP_Kabel', [(0.05, 0.1, 2.9), (0.55, 0.0, 2.6), (0.7, -0.2, 1.85)], 0.012, toon('P_Kabelrot', '#c83a3a'), R)
    B.sphere('PP_Uhr', (0.68, -0.3, 1.75), (0.03, 0.13, 0.13), toon('P_Messing', '#d8c890', hi=0.7), R)
    B.sphere('PP_Knopf', (0.68, -0.3, 1.38), (0.03, 0.07, 0.07), toon('P_Tuerkis', '#2ad0d8', hi=0.9), R)


def p_klo_zukunft(SC, B, R):
    SHELL, PURP, GOLD, RING = toon('P_Kapsel', '#e8e4f0', hi=0.85), toon('P_Kapselinnen', '#7a2ac0', hi=0.7), toon('P_Gold', '#e9b53c', hi=0.6), toon('P_Ring', '#3ad8f0', hi=0.95)
    B.cone('PZ_Hülle', 0.15, 2.05, 0.58, 0.58, SHELL, R, bevel=0.03)
    B.sphere('PZ_Kuppel', (0, 0, 2.05), (0.58, 0.58, 0.32), SHELL, R)
    B.sphere('PZ_Boden', (0, 0, 0.15), (0.58, 0.58, 0.12), SHELL, R)
    B.sphere('PZ_Fenster', (0, -0.36, 1.12), (0.4, 0.3, 0.86), PURP, R)
    box(B, 'PZ_Schild', (0, -0.66, 0.95), (0.5, 0.03, 0.13), GOLD, R, bevel=0.01)
    text(SC, 'PZ_SchildText', 'KLO 3000', (0, -0.68, 0.95), 0.08, toon('P_Dunkel', '#3a2418'), R)
    B.torus('PZ_Ring', (0, 0, 0.04), 0.66, 0.035, RING, R, seg=48, sseg=8)
    B.rod('PZ_Antenne', (0, 0, 2.3), (0, 0, 2.75), 0.018, toon('P_Metall', '#6a6a78'), R, seg=8)
    B.sphere('PZ_Lampe', (0, 0, 2.78), (0.06, 0.06, 0.06), toon('P_Rot', '#e83a3a', hi=0.95), R)


def p_zucker(SC, B, R, full=True):
    POR = toon('P_Porzellan', '#f4f4fa', hi=0.6)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=1.0)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > 0.05], context='VERTS')
    bowl = B.obj('PU_Schale', bm, POR, R, (0, 0, 0.16), scale=(0.2, 0.2, 0.16), solid=0.06)
    B.cone('PU_Fuss', 0.0, 0.03, 0.08, 0.09, POR, R, bevel=0.005)
    box(B, 'PU_Band', (0, -0.165, 0.09), (0.2, 0.01, 0.05), toon('P_Etikett', '#5a86d0'), R, bevel=0.002)
    text(SC, 'PU_Text', 'ZUCKER', (0, -0.18, 0.09), 0.035, toon('P_Weiss', '#ffffff'), R)
    if full:
        for i, (x, y, z) in enumerate([(-0.07, 0, 0.17), (0.05, -0.04, 0.17), (0.0, 0.06, 0.18), (-0.02, -0.03, 0.22), (0.08, 0.05, 0.19), (-0.1, 0.06, 0.18)]):
            box(B, f'PU_Wuerfel{i}', (x, y, z), (0.06, 0.06, 0.06), toon('P_Zucker', '#ffffff', hi=0.4), R, rot=(i * 0.3, i * 0.2, i * 0.5), bevel=0.006)


def p_obstschale(SC, B, R):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=1.0)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > 0.05], context='VERTS')
    B.obj('PO_Schale', bm, toon('P_Schale', '#b07a40'), R, (0, 0, 0.14), scale=(0.34, 0.34, 0.14), solid=0.04)
    for i, (x, y, z) in enumerate([(-0.15, 0.02, 0.18), (0.0, -0.06, 0.2), (0.15, 0.03, 0.18), (-0.06, 0.1, 0.24), (0.08, 0.1, 0.25)]):
        B.sphere(f'PO_Apfel{i}', (x, y, z), (0.085, 0.085, 0.08), toon('P_Apfel', '#d8322e', hi=0.8), R)
        B.rod(f'PO_Stiel{i}', (x, y, z + 0.07), (x + 0.01, y, z + 0.11), 0.008, toon('P_Stiel', '#5a3a1a'), R, seg=6)
    B.sphere('PO_Blatt', (0.1, 0.08, 0.36), (0.04, 0.02, 0.025), toon('P_Blatt', '#3a9a3a'), R, rot=(0, 0.5, 0.4))


def p_items_copy(name, scale, rot):
    def build(SC, B, R):
        k = copy_tree(SC, bpy.data.objects[name], R, 'PI_')
        k.location = (0, 0, 0)
        k.rotation_euler = rot
        k.scale = (scale,) * 3
    return build


def p_laterne(SC, B, R, on=True):
    POST, HEAD = toon('P_Laternenpfahl', '#3a2058'), toon('P_Laternenkopf', '#4a3a6a')
    tube(SC, 'PL_Pfahl', [(0, 0, 0), (0.05, 0, 0.9), (-0.08, 0, 1.9), (0.12, 0, 2.8), (0.0, 0, 3.2)], 0.07, POST, R, tip=0.6)
    B.cone('PL_Fuss', 0.0, 0.12, 0.25, 0.12, POST, R, bevel=0.02)
    box(B, 'PL_Kopf', (0.0, 0, 3.28), (0.42, 0.34, 0.32), HEAD, R, bevel=0.06)
    cell = toon('P_ZelleAn', '#7dff7a', hi=0.95) if on else toon('P_ZelleAus', '#2a4a2a', hi=0.3)
    B.cone('PL_Zelle', 3.2, 3.36, 0.11, 0.11, cell, R, xy=(0, -0.13), rot=(0, math.pi / 2, 0), bevel=0.02)
    for i in range(3):
        box(B, f'PL_Ring{i}', (-0.06 + i * 0.06, -0.14, 3.28), (0.015, 0.24, 0.24), HEAD, R, bevel=0.003)


PROPS = {
    'klo_heute': p_klo_heute, 'plumpsklo': p_plumpsklo, 'klo_zukunft': p_klo_zukunft,
    'zucker': lambda SC, B, R: p_zucker(SC, B, R, True), 'zucker_leer': lambda SC, B, R: p_zucker(SC, B, R, False),
    'obstschale': p_obstschale, 'eimer': p_items_copy('eimer', 1.0, (0, 0, 0)), 'schaufel': p_items_copy('schaufel', 1.0, (0, 0, 0)),
    'laterne': lambda SC, B, R: p_laterne(SC, B, R, True), 'laterne_aus': lambda SC, B, R: p_laterne(SC, B, R, False),
}


def render_all(only=None):
    SC, cam = scene()
    out = REPO + '/art/render/props/'
    os.makedirs(out, exist_ok=True)
    win = bpy.context.window
    prev = win.scene
    win.scene = SC
    meta = {}
    try:
        for name, build in PROPS.items():
            if only and name not in only:
                continue
            for o in list(SC.collection.objects):
                if o.name not in ('MondH3', 'FuellH3', 'PropCam'):
                    bpy.data.objects.remove(o, do_unlink=True)
            B = Builder(SC)
            R = B.empty('P_Root')
            R.rotation_euler = (0, 0, YAW)
            build(SC, B, R)
            bpy.context.view_layer.update()
            vis = [o for o in SC.objects if o.type in ('MESH', 'CURVE', 'FONT') and not o.hide_render]
            pts = [o.matrix_world @ Vector(c) for o in vis for c in o.bound_box]
            lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
            hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
            size = max(hi.x - lo.x, hi.z - lo.z) * 1.15 + 0.1
            ctr = (lo + hi) / 2
            cam.data.ortho_scale = size
            cam.rotation_euler = (math.radians(84), 0, 0)
            cam.location = (ctr.x, ctr.y - 10 * math.sin(math.radians(84)), ctr.z + 10 * math.cos(math.radians(84)))
            ppm = 300 if size < 1.2 else 220
            SC.render.resolution_x = SC.render.resolution_y = int(size * ppm)
            bpy.context.view_layer.update()
            W = H = SC.render.resolution_x
            q = world_to_camera_view(SC, cam, R.matrix_world.translation)
            meta[name] = {'res': [W, H], 'ppm': W / size, 'foot': [round(q.x * W, 1), round((1 - q.y) * H, 1)], 'height_m': round(hi.z, 3), 'width_m': round(hi.x - lo.x, 3)}
            SC.render.filepath = out + f'{name}.png'
            bpy.ops.render.render(write_still=True, scene=SC.name)
    finally:
        win.scene = prev
    old = json.load(open(out + 'meta.json')) if only and os.path.exists(out + 'meta.json') else {}
    old.update(meta)
    json.dump(old, open(out + 'meta.json', 'w'), indent=1)
    print('props', {k: (v['res'][0], v['height_m']) for k, v in meta.items()})


render_all(globals().get('ONLY'))
