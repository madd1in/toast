# Prolog „Wie alles begann“: breites 3D-Panorama für den Kameraschwenk vor dem Intro (in Blender ausführen):
#   REPO = r'C:/.../Tentakel-Toast'; exec(open(REPO + '/art/blender/prolog_build.py').read())
# Links eine Naturidylle (Wiese mit Blumen, Laubbäume, Hügel, ein gewundener Fluss mit Steinen und Holzbrücke),
# rechts auf einem Hügel das Herrenhaus vom Titelbild (Szene „Haus“, kopiert); aus dem Keller führt ein rostiges Rohr
# in den Fluss, wo sich ein lila-grüner Schleimfleck ausbreitet. Toon-Look mit Freestyle-Kontur wie die Räume.
# Optional PREVIEW = 0.25 (Vorschau in Viertelgröße). Schreibt art/render/prolog.png (3840 × 880) und
# art/render/prolog.json (Bildpunkte: Rohrmündung, Schleimfleck, Ufer für die Tentakel). Danach: python art/blender/prolog_post.py
import bpy, json, math, os, random
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
exec(open(REPO + '/art/blender/raum_build.py', encoding='utf-8').read())   # Builder, toon, tex_toon, box, setup … (rendert nichts ohne NAME)

PW, PH = 3840, 880


def build_prolog():
    SC, cam = setup('prolog', ('#bfe8ff', '#4a9ae0'))
    r = SC.render
    r.resolution_x, r.resolution_y = PW, PH
    cd = cam.data
    cd.sensor_fit, cd.sensor_width = 'HORIZONTAL', 36
    cd.lens = 18 / math.tan(math.radians(37))   # 74° breit: von der Wiese links bis zum Herrenhaus rechts
    cam.location, cam.rotation_euler = (0, -2, 3.2), (math.radians(86.5), 0, 0)
    B = Builder(SC)
    rnd = random.Random(7)
    GRASS = tex_toon('P_Gras', 'gras.png', 0.12, hi=0.0)
    HILL, HILLF, MOUNT = toon('P_Huegel', '#5aa848', hi=0.0), toon('P_HuegelFern', '#6ab0a0', hi=0.0), toon('P_Berg', '#8aa8d0', hi=0.0)
    WATER, BANK, SLUDGE = toon('P_Fluss', '#3a9ad8', hi=0.55), tex_toon('P_Ufer', 'sand.png', 0.5, hi=0.0), toon('P_Schleim', '#b44ae0', hi=0.9)
    BARK, ROCK, WOOD = toon('P_Rinde', '#6a4628', hi=0.0), tex_toon('P_Fels', 'fels.png', 0.8, hi=0.05), tex_toon('P_Holz', 'holz_steg.png', 0.5, hi=0.0)
    PIPE = toon('P_Rohr', '#8a5a3a', hi=0.25)
    e = SLUDGE.node_tree.nodes.get('ToonEmi')
    if e:
        e.inputs['Strength'].default_value = 1.4
    nk = bpy.data.collections['Ohne_Kontur']   # nur Mitgliedschaft (Freestyle-Ausschluss), nicht in die Szene hängen
    # Boden, Hügel, Berge
    boden = plane(B, 'P_Boden', -130, 130, -5, 185, 0.0, GRASS)
    bm = bmesh.new(); bm.from_mesh(boden.data)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=47, use_grid_fill=True)   # viele kleine Flächen: sonst scheinen Hügelkonturen durch den Boden (Freestyle)
    bm.to_mesh(boden.data); bm.free()
    for i in range(9):
        x, y = -70 + i * 18 + rnd.uniform(-5, 5), rnd.uniform(96, 118)   # hinter dem Herrenhaus
        B.sphere(f'P_Huegel{i}', (x, y, -2), (rnd.uniform(14, 22), rnd.uniform(8, 12), rnd.uniform(6, 10)), HILL if i % 2 else HILLF, None)
    for i in range(7):
        x = -90 + i * 32 + rnd.uniform(-6, 6)
        B.sphere(f'P_Berg{i}', (x, 150, -4), (rnd.uniform(22, 30), 12, rnd.uniform(18, 26)), MOUNT, None)
    B.sphere('P_HausHuegel', (24, 76, -3.5), (17, 10, 5.0), HILL, None)
    # Fluss: von hinten rechts (am Herrenhaus vorbei) in Schleifen nach vorn links, mit Sandufer
    path = [(46, 66), (32, 59), (21, 51), (11, 41), (3, 33), (-5, 27), (-13, 21), (-23, 17), (-40, 14)]   # alles im Bild: vorn ist die Wiese erst ab ~14 m zu sehen
    pts = []
    for (x0, y0), (x1, y1) in zip(path, path[1:]):
        for k in range(10):
            u = k / 10
            pts.append(Vector((x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, 0)))
    pts.append(Vector((*path[-1], 0)))
    sm = [pts[0]] + [(pts[i - 1] + pts[i] * 2 + pts[i + 1]) / 4 for i in range(1, len(pts) - 1)] + [pts[-1]]

    def ribbon(name, w, z, mat):
        bm = bmesh.new()
        prev = None
        for i, p in enumerate(sm):
            d = (sm[min(i + 1, len(sm) - 1)] - sm[max(i - 1, 0)]).normalized()
            n = Vector((-d.y, d.x, 0))
            ww = w * (1.4 if p.y > 35 else 1.0)
            a, b = bm.verts.new(p + n * ww + Vector((0, 0, z))), bm.verts.new(p - n * ww + Vector((0, 0, z)))
            if prev:
                bm.faces.new((prev[0], prev[1], b, a))
            prev = (a, b)
        return B.obj(name, bm, mat, None, (0, 0, 0), smooth=False)
    ribbon('P_Ufer', 3.4, 0.01, BANK)
    ribbon('P_Fluss', 2.4, 0.04, WATER)
    # Schleimfleck unter der Rohrmündung, mit Blasen
    near = lambda q: min(range(len(sm)), key=lambda i: (sm[i] - Vector((*q, 0))).length)
    ip = near((24.5, 54.0)); mouth = sm[ip]
    fleck = sm[min(ip + 3, len(sm) - 1)]
    B.sphere('P_Schleimfleck', (fleck.x, fleck.y, 0.05), (3.2, 2.2, 0.06), SLUDGE, None, rot=(0, 0, math.atan2(-9, -10)))
    for i in range(7):
        B.sphere(f'P_SchleimBlase{i}', (fleck.x + rnd.uniform(-2.2, 2.2), fleck.y + rnd.uniform(-1.4, 1.4), 0.1), (0.25, 0.25, 0.18), SLUDGE, None)
    # Ufer für die Tentakel: diesseits des Flusses (zur Kamera hin), knapp stromab vom Schleim
    ib = min(ip + 6, len(sm) - 2); pb = sm[ib]; dv = (sm[ib + 1] - sm[ib - 1]).normalized(); nv = Vector((-dv.y, dv.x, 0))
    if nv.y > 0:
        nv = -nv
    lila_at, gruen_at = pb + nv * 3.7, pb + nv * 4.6 + dv * 2.6
    # Steine am Ufer, Holzbrücke
    for i in range(14):
        p = sm[rnd.randrange(5, len(sm) - 5)]
        B.sphere(f'P_Stein{i}', (p.x + rnd.choice((-1, 1)) * rnd.uniform(2.6, 3.4), p.y + rnd.uniform(-1, 1), 0.1), (rnd.uniform(0.3, 0.7), rnd.uniform(0.3, 0.6), rnd.uniform(0.2, 0.4)), ROCK, None)
    bx, by = -5, 27
    for i in range(9):
        box(B, f'P_Brett{i}', (bx - 2.0 + i * 0.5, by, 0.32 + math.sin(i / 8 * math.pi) * 0.25), (0.46, 3.2, 0.08), WOOD, bevel=0.01)
    for sx in (-1, 1):
        B.rod(f'P_Gelaender{sx}', (bx - 2.2, by + sx * 1.55, 0.9), (bx + 2.2, by + sx * 1.55, 0.9), 0.05, WOOD, None, seg=8)
        for i in range(3):
            B.rod(f'P_Pfosten{sx}{i}', (bx - 2.0 + i * 2.0, by + sx * 1.55, 0.2), (bx - 2.0 + i * 2.0, by + sx * 1.55, 0.95), 0.05, WOOD, None, seg=8)
    # Laubbäume: Stamm mit drei, vier Kronenkugeln in verschiedenen Grüntönen
    LEAF = [toon(f'P_Laub{i}', c, hi=0.0) for i, c in enumerate(('#3f9a3a', '#5ab84a', '#2f7a3a', '#7ac85a'))]
    trees = [(-17, 33), (-22, 42), (-10, 46), (-30, 52), (-2, 54), (8, 62), (-38, 64), (-4, 38), (6, 30), (34, 44), (40, 70), (14, 74), (-22, 76), (-15, 25)]
    for i, (x, y) in enumerate(trees):
        s = rnd.uniform(0.75, 1.1) * (1.15 if y > 50 else 0.85 if y < 32 else 1.0)
        B.cone(f'P_Stamm{i}', 0, 2.6 * s, 0.32 * s, 0.2 * s, BARK, None, xy=(x, y), seg=12, bevel=0.02)
        for j in range(4):
            B.sphere(f'P_Krone{i}{j}', (x + rnd.uniform(-1.2, 1.2) * s, y + rnd.uniform(-0.8, 0.8) * s, (3.0 + rnd.uniform(0, 1.6)) * s),
                     (rnd.uniform(1.3, 1.9) * s,) * 2 + (rnd.uniform(1.1, 1.6) * s,), LEAF[(i + j) % 4], None)
    # Blumenwiese im Vordergrund (ohne Kontur, sonst wird es ein Gekritzel)
    FLW = [toon(f'P_Bluete{i}', c, hi=0.1) for i, c in enumerate(('#ff5a7a', '#ffd23a', '#ffffff', '#7a8aff', '#ff8a2a'))]
    for i in range(170):
        x, y = rnd.uniform(-18, 12), rnd.uniform(14, 26)
        if min((Vector((x, y, 0)) - q).length for q in sm) < 3.8:
            continue
        o = B.sphere(f'P_Blume{i}', (x, y, 0.12), (0.09, 0.09, 0.06), FLW[i % 5], None)
        nk.objects.link(o)
    # das Herrenhaus vom Titelbild (Kopie der Szene „Haus“), vergrößert auf den Hügel rechts gestellt
    src = bpy.data.scenes['Haus']
    H = B.empty('P_Haus')
    H.location, H.rotation_euler, H.scale = (24, 74, 1.3), (0, 0, 0.25), (1.75, 1.75, 1.75)
    made = {}
    for o in src.objects:
        if o.type not in ('MESH', 'CURVE', 'FONT', 'EMPTY'):
            continue
        c = o.copy()
        SC.collection.objects.link(c)
        made[o] = c
    for o, c in made.items():
        if o.parent in made:
            c.parent = made[o.parent]
            c.matrix_parent_inverse = o.matrix_parent_inverse.copy()
        else:
            c.parent = H
            c.matrix_parent_inverse.identity()
            c.matrix_basis = o.matrix_basis.copy()   # matrix_world der nicht aktiven Szene ist nicht ausgewertet
    # rostiges Abflussrohr vom Keller zum Fluss, Mündung mit Ring
    mo = mouth + (Vector((23.0, 70.0, 0)) - mouth).normalized() * 3.2 + Vector((0, 0, 1.1))   # Rohrende kurz vor dem Wasser
    B.rod('P_Rohr0', (23.0, 70.0, 1.8), (mo.x + 1.2, mo.y + 2.0, 1.8), 0.45, PIPE, None, seg=20)
    B.rod('P_Rohr1', (mo.x + 1.2, mo.y + 2.0, 1.8), tuple(mo), 0.45, PIPE, None, seg=20)
    B.sphere('P_RohrKnie', (mo.x + 1.2, mo.y + 2.0, 1.8), (0.5, 0.5, 0.5), PIPE, None)
    sun(SC, (0.75, 0.0, -0.6), 2.4, (1.0, 0.96, 0.88))
    win = bpy.context.window
    prev = win.scene
    win.scene = SC
    bpy.context.view_layer.update()

    def px(co):
        q = world_to_camera_view(SC, cam, Vector(co))
        return [round(q.x * PW, 1), round((1 - q.y) * PH, 1)]
    anchors = {'muendung': px(tuple(mo)), 'wasser': px((mouth.x, mouth.y, 0.05)), 'fleck': px((fleck.x, fleck.y, 0.05)), 'ufer_gruen': px(tuple(gruen_at)), 'ufer_lila': px(tuple(lila_at)),
               'haus': px((24, 74, 6)), 'ppm_ufer': round(abs(px(tuple(lila_at + Vector((0, 0, 2))))[1] - px(tuple(lila_at))[1]) / 2.0, 2)}
    try:
        pv = globals().get('PREVIEW')
        r.resolution_percentage = int(pv * 100) if pv else 100
        r.filepath = REPO + ('/art/render/prolog_preview.png' if pv else '/art/render/prolog.png')
        bpy.ops.render.render(write_still=True, scene=SC.name)
    finally:
        r.resolution_percentage = 100
        win.scene = prev
    json.dump(anchors, open(REPO + '/art/render/prolog.json', 'w'), indent=1)
    print('prolog', anchors)


build_prolog()
