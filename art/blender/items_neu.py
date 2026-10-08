# Neue Inventar-Gegenstände in 3D (in Blender ausführen, vorher REPO setzen; optional ONLY = ['sicherung']):
#   REPO = r'C:/.../Tentakel-Toast'; exec(open(REPO + '/art/blender/items_neu.py').read())
# Baut sie in der Szene „Items“ neben den 16 alten Gegenständen (gleiche Kamerarichtung und Lichter), Toon-Material wie
# die Figuren, Kontur per Freestyle. Rendert art/render/items/<name>.png (192 × 192); danach python art/blender/items_post.py.
import bpy, bmesh, math, os, sys, importlib
from mathutils import Vector
sys.path.insert(0, REPO + '/art/blender')
import figur_lib
importlib.reload(figur_lib)
from figur_lib import Builder, toon


def i_sicherung(SC, B, R):
    """Schraubsicherung aus Porzellan: Messingfuß, Prägung „16A“, oben das rote Kennmelder-Plättchen (durchgebrannt fällt es raus)."""
    POR, MES, ROT, SCH = toon('I_Porzellan', '#f2ece0', hi=0.35), toon('I_Messing', '#d8b04a', hi=0.6), toon('I_Kennrot', '#d8323a', hi=0.4), toon('N_Schwarz', '#16121e', hi=0.15)
    B.cone('IS_Fuss', 0.0, 0.07, 0.055, 0.055, MES, R, seg=24, bevel=0.005)
    B.cone('IS_Koerper', 0.07, 0.36, 0.13, 0.13, POR, R, seg=40, bevel=0.012)
    B.torus('IS_Rille', (0, 0, 0.13), 0.131, 0.008, SCH, R, seg=40, sseg=6)
    B.cone('IS_Kappe', 0.36, 0.40, 0.112, 0.105, MES, R, seg=40, bevel=0.008)
    B.cone('IS_Melder', 0.40, 0.415, 0.055, 0.05, ROT, R, seg=24, bevel=0.004)
    cd = bpy.data.curves.get('IS_Text') or bpy.data.curves.new('IS_Text', 'FONT')
    cd.body, cd.size, cd.align_x, cd.align_y, cd.extrude = '16A', 0.075, 'CENTER', 'CENTER', 0.004
    cd.materials.clear(); cd.materials.append(SCH)
    t = bpy.data.objects.new('IS_Text', cd); SC.collection.objects.link(t)
    t.parent = R
    t.location, t.rotation_euler = (0, -0.128, 0.24), (math.pi / 2, 0, 0)


NEU = {'sicherung': i_sicherung}


def tree(o):
    out = [o]
    for c in o.children:
        out += tree(c)
    return out


def render_neu(only=None):
    SC = bpy.data.scenes['Items']
    cam = SC.camera
    out = REPO + '/art/render/items/'
    os.makedirs(out, exist_ok=True)
    win = bpy.context.window
    prev = win.scene
    win.scene = SC
    r, vl = SC.render, SC.view_layers[0]
    keep = (r.use_freestyle, r.line_thickness_mode, r.line_thickness, cam.location.copy(), cam.data.ortho_scale)
    hidden = {}
    try:
        r.use_freestyle, r.line_thickness_mode, r.line_thickness = True, 'ABSOLUTE', 1.6
        vl.use_freestyle = True
        ls = vl.freestyle_settings.linesets[0] if vl.freestyle_settings.linesets else vl.freestyle_settings.linesets.new('Kontur')
        ls.select_by_visibility, ls.select_silhouette, ls.select_border, ls.select_crease = True, True, True, True
        ls.linestyle.color, ls.linestyle.thickness = (0.04, 0.012, 0.07), 1.6
        look = (cam.matrix_world.to_3x3() @ Vector((0, 0, -1))).normalized()
        for name, build in NEU.items():
            if only and name not in only:
                continue
            old = bpy.data.objects.get(name)
            if old is not None:
                for o in reversed(tree(old)):
                    bpy.data.objects.remove(o, do_unlink=True)
            for o in SC.objects:
                if o.type in ('MESH', 'CURVE', 'FONT', 'EMPTY'):
                    hidden.setdefault(o.name, o.hide_render)
                    o.hide_render = True
            B = Builder(SC)
            R = B.empty(name)
            build(SC, B, R)
            bpy.context.view_layer.update()
            objs = tree(R)
            for o in objs:
                o.hide_render = False
            pts = [o.matrix_world @ Vector(c) for o in objs if o.type in ('MESH', 'CURVE', 'FONT') for c in o.bound_box]
            ctr = sum(pts, Vector()) / len(pts)
            cam.location = ctr - look * 10
            bpy.context.view_layer.update()
            inv = cam.matrix_world.inverted()
            q = [inv @ p for p in pts]
            ext = max(max(p.x for p in q) - min(p.x for p in q), max(p.y for p in q) - min(p.y for p in q))
            cam.data.ortho_scale = ext * 1.32
            r.resolution_x = r.resolution_y = 192
            r.resolution_percentage = 100
            r.film_transparent = True
            r.image_settings.file_format, r.image_settings.color_mode = 'PNG', 'RGBA'
            r.filepath = out + name + '.png'
            bpy.ops.render.render(write_still=True, scene=SC.name)
            for o in objs:   # neue Teile bleiben in der Szene, aber wie die alten nur bei Bedarf sichtbar
                hidden[o.name] = False
            print('item', name, round(ext, 3))
    finally:
        for n, h in hidden.items():
            o = bpy.data.objects.get(n)
            if o is not None:
                o.hide_render = h
        r.use_freestyle, r.line_thickness_mode, r.line_thickness = keep[0], keep[1], keep[2]
        cam.location, cam.data.ortho_scale = keep[3], keep[4]
        win.scene = prev


render_neu(globals().get('ONLY'))
