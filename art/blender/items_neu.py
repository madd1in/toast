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


def i_tabletten(SC, B, R):
    """Röhrchen mit Kopfschmerztabletten: weißes Plastik, rote Kappe, gelbes Etikett „KOPF WEG“, daneben zwei Tabletten."""
    WEI, ROT, ETI, SCH, PIL = toon('I_Pillenweiss', '#f4f2ee', hi=0.5), toon('I_Pillenrot', '#d8323a', hi=0.5), toon('I_Etikett', '#ffe27a', hi=0.4), toon('N_Schwarz', '#16121e', hi=0.15), toon('I_Pille', '#ffb04a', hi=0.6)
    B.cone('IT_Roehre', 0.0, 0.32, 0.1, 0.1, WEI, R, seg=40, bevel=0.01)
    B.cone('IT_Kappe', 0.32, 0.4, 0.108, 0.1, ROT, R, seg=40, bevel=0.01)
    B.cone('IT_Etikett', 0.07, 0.27, 0.103, 0.103, ETI, R, seg=40, bevel=0)
    cd = bpy.data.curves.get('IT_Text') or bpy.data.curves.new('IT_Text', 'FONT')
    cd.body, cd.size, cd.align_x, cd.align_y, cd.extrude = 'KOPF\nWEG', 0.05, 'CENTER', 'CENTER', 0.004
    cd.materials.clear(); cd.materials.append(SCH)
    t = bpy.data.objects.new('IT_Text', cd); SC.collection.objects.link(t)
    t.parent = R
    t.location, t.rotation_euler = (0, -0.108, 0.17), (math.pi / 2, 0, 0)
    for i, (x, y) in enumerate(((0.2, -0.04), (0.3, 0.05))):
        B.sphere(f'IT_Pille{i}', (x, y, 0.03), (0.07, 0.07, 0.03), PIL, R)


def tex_toon(name, file):
    """Toon-Material mit Bild (UV) statt Einzelfarbe."""
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials['HautB'].copy()
        m.name = name
    nt = m.node_tree
    img = nt.nodes.get('Bild') or nt.nodes.new('ShaderNodeTexImage')
    img.name = 'Bild'
    img.image = bpy.data.images.load(REPO + '/art/textures/' + file, check_existing=True)
    img.image.reload()
    nt.links.new(img.outputs['Color'], nt.nodes['ToonMul'].inputs[6])
    nt.links.new(img.outputs['Color'], next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'])
    return m


def i_schnittmuster(SC, B, R):
    """Die Rückseite des Propaganda-Plakats: Bastelbogen „Werde ein Tentakel!“, eine Ecke rollt sich hoch, Schleimrest am Rand."""
    PAP = tex_toon('I_Schnittmuster', 'schnittmuster.png')
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    n = 10
    vs = {}
    for j in range(n + 1):
        for i in range(n + 1):
            u, v = i / n, j / n
            curl = max(0.0, u + v - 1.35)
            vs[i, j] = (bm.verts.new(((u - 0.5) * 0.9, (v - 0.5) * 0.9 - curl * 0.12, curl * curl * 0.9)), (u, v))
    for j in range(n):
        for i in range(n):
            q = (vs[i, j], vs[i + 1, j], vs[i + 1, j + 1], vs[i, j + 1])
            f = bm.faces.new([a for a, _ in q])
            for l, (_, c) in zip(f.loops, q):
                l[uv].uv = c
    o = B.obj('IM_Bogen', bm, PAP, R, (0, 0, 0.01), rot=(0, 0, 0.25), smooth=True, solid=0.006)
    B.sphere('IM_Schleim', (-0.38, -0.3, 0.02), (0.08, 0.05, 0.015), toon('PV_Schleim', '#86e04e', hi=0.8), R)


def i_schere(SC, B, R):
    """Gertrudes Schneiderschere von 1776: lange Eisenklingen, ein großes und ein kleines Griffauge, Messingniete."""
    STAHL, EISEN, MES = toon('I_Klinge', '#c4ccd6', hi=0.8), toon('I_Eisen', '#3a3a46', hi=0.4), toon('I_Messing', '#d8b04a', hi=0.6)
    for k, a in enumerate((0.16, -0.16)):
        S = B.empty(f'IS_Haelfte{k}')
        S.parent = R
        S.rotation_euler = (0, 0, a)
        B.cone(f'IS_Klinge{k}', 0.0, 0.62, 0.035, 0.006, STAHL, S, scale=(1, 0.35, 1), rot=(-math.pi / 2, 0, 0), seg=4, bevel=0.004)
        bpy.data.objects[f'IS_Klinge{k}'].location = (0, 0.31, 0.02 + 0.012 * k)
        B.rod(f'IS_Schenkel{k}', (0, 0, 0.02 + 0.012 * k), (0.05 * (1 - 2 * k), -0.22, 0.02 + 0.012 * k), 0.022, EISEN, S, seg=8)
        rg = 0.1 if k == 0 else 0.075
        B.torus(f'IS_Auge{k}', (0.05 * (1 - 2 * k) + 0.02 * (1 - 2 * k), -0.22 - rg, 0.02 + 0.012 * k), rg, 0.022, EISEN, S, scale=(1, 1.25, 1), seg=24, sseg=6)
    B.cone('IS_Niete', 0.0, 0.05, 0.03, 0.03, MES, R, seg=16, bevel=0.005)


def i_lachkiste(SC, B, R):
    """Die Lach-Box aus Lachis Bauch: schwarzer Kasten, Lautsprechergitter, rote Taste, Schalter KICHERN – LACHEN – BÖSE."""
    SCH, GIT, ROT, GELB, WEI = toon('I_LKSchwarz', '#3c3a4a', hi=0.4), toon('I_LKGitter', '#7a7a88', hi=0.4), toon('I_Pillenrot', '#d8323a', hi=0.5), toon('I_LKGelb', '#ffd23a', hi=0.4), toon('I_LKWeiss', '#f4f0ea', hi=0.3)
    B.cone('IL_Kasten', 0.0, 0.26, 0.2, 0.2, SCH, R, seg=4, bevel=0.025, rot=(0, 0, math.pi / 4))
    for i in range(5):
        B.rod(f'IL_Gitter{i}', (-0.11, -0.145, 0.06 + i * 0.03), (0.02, -0.145, 0.06 + i * 0.03), 0.009, GIT, R, seg=6)
    B.sphere('IL_Taste', (0.12, 0.0, 0.27), (0.055, 0.055, 0.03), ROT, R)
    R2 = B.empty('IL_SchalterWurzel')
    R2.parent = R
    B.rod('IL_SchalterSchiene', (0.04, -0.146, 0.2), (0.12, -0.146, 0.2), 0.01, WEI, R2, seg=6)
    B.sphere('IL_Schalter', (0.115, -0.15, 0.2), (0.022, 0.018, 0.03), GELB, R2)
    cd = bpy.data.curves.get('IL_Text') or bpy.data.curves.new('IL_Text', 'FONT')
    cd.body, cd.size, cd.align_x, cd.align_y, cd.extrude = 'HA', 0.06, 'CENTER', 'CENTER', 0.004
    cd.materials.clear(); cd.materials.append(WEI)
    t = bpy.data.objects.new('IL_Text', cd); SC.collection.objects.link(t)
    t.parent = R
    t.location, t.rotation_euler = (0.08, -0.147, 0.09), (math.pi / 2, 0, 0)


def i_kostuem(SC, B, R):
    """Das Tentakel-Kostüm aus Fahnenstoff (kostuem_lib.py), ein bisschen schräg, damit man die Augenlöcher sieht."""
    import kostuem_lib
    importlib.reload(kostuem_lib)
    W = B.empty('IK_Wurzel')
    W.parent = R
    W.rotation_euler = (0.0, 0.75, 2.3)
    kostuem_lib.build(SC, 'IK_', W)


NEU = {'sicherung': i_sicherung, 'tabletten': i_tabletten, 'schnittmuster': i_schnittmuster, 'schere': i_schere, 'lachkiste': i_lachkiste, 'kostuem': i_kostuem}


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
