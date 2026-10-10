# Neue Räume als 3D-Hintergründe (in Blender ausführen, vorher REPO und NAME setzen):
#   REPO = r'C:/.../Tentakel-Toast'; NAME = 'hafen'; exec(open(REPO + '/art/blender/raum_build.py').read())
# Hafen 1776 (Piraten) und Landeplatz (Zukunft, Lieferraumschiff) im Toon-Look der Figuren mit Freestyle-Kontur.
# Die Kamera ist so gerechnet, dass die Perspektive zum Spiel passt: Vorderkante der Lauffläche (y = 432) im
# Maßstab 1 (104 Spiel-Einheiten pro Meter), Hinterkante (y = 330) im Maßstab 0,8 – wie in den gezeichneten Räumen.
# Schreibt img/raum_<name>.jpg (1920 × 880) und art/render/raum_<name>.json (Bildpunkte von Ankern für Hotspots).
import bpy, bmesh, json, math, os, random, sys, importlib
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
sys.path.insert(0, REPO + '/art/blender')
import figur_lib
importlib.reload(figur_lib)
from figur_lib import Builder, toon

UPM = 104             # Spiel-Einheiten pro Meter bei Maßstab 1 (Vorderkante der Lauffläche, y = 432)
HORIZON = 185         # Horizont im Bild (Spiel-y); dann liegt Maßstab 1 bei y = 432 in Kamerahöhe (432 - 185) / UPM
Y_TOP = 350           # Hinterkante der Lauffläche; Maßstab dort (Y_TOP - HORIZON) / (432 - HORIZON) ≈ 0,67
LENS_F = 3.78         # Brennweite in halben Bildhöhen (≈ 45 mm), damit die Vorderkante gut 8 m vor der Kamera liegt


def solve_cam():
    """Kamera mit sichtbarem Horizont: Höhe h aus dem Maßstab, Neigung phi aus der Horizontlage, D1 = Tiefe der Vorderkante."""
    h = (432 - HORIZON) / UPM
    phi = math.atan(((220 - HORIZON) / 220) / LENS_F)
    v = lambda d: -LENS_F * (d * math.sin(phi) - h * math.cos(phi)) / (d * math.cos(phi) + h * math.sin(phi))
    lo, hi = 1.0, 60.0
    for _ in range(60):
        m = (lo + hi) / 2
        lo, hi = (m, hi) if v(m) > (432 - 220) / 220 else (lo, m)
    return h, phi, LENS_F, lo


def setup(name, sky):
    SC = bpy.data.scenes.get('Raum_' + name) or bpy.data.scenes.new('Raum_' + name)
    for o in list(SC.collection.objects) + [o for c in SC.collection.children for o in c.objects]:
        bpy.data.objects.remove(o, do_unlink=True)
    hel = bpy.data.scenes['Helden3D']
    r = SC.render
    r.engine = hel.render.engine
    r.resolution_x, r.resolution_y, r.resolution_percentage = 1920, 880, 100
    r.film_transparent = False
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGB'
    SC.view_settings.view_transform = hel.view_settings.view_transform
    SC.view_settings.look = hel.view_settings.look
    SC.eevee.taa_render_samples = 48
    # Himmel: eigene Welt mit Farbverlauf (Horizont hell, oben satt)
    w = bpy.data.worlds.get('Welt_' + name) or bpy.data.worlds.new('Welt_' + name)
    w.use_nodes = True
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    nt.links.new(tc.outputs['Window'], sep.inputs[0])
    nt.links.new(sep.outputs['Y'], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], bg.inputs['Color'])
    nt.links.new(bg.outputs[0], out.inputs[0])
    from figur_lib import hexlin
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[0].color = 0.35, (*hexlin(sky[0]), 1)
    ramp.color_ramp.elements[1].position, ramp.color_ramp.elements[1].color = 1.0, (*hexlin(sky[1]), 1)
    bg.inputs['Strength'].default_value = 1.0
    SC.world = w
    # Kamera nach solve_cam
    h, phi, f, d1 = solve_cam()
    cd = bpy.data.cameras.get('RaumCam') or bpy.data.cameras.new('RaumCam')
    cd.type = 'PERSP'
    cd.sensor_fit = 'VERTICAL'
    cd.sensor_height = 24
    cd.lens = f * 12   # Brennweite in Einheiten der halben Bildhöhe -> mm bei 24 mm Sensorhöhe
    cd.clip_end = 400
    cam = bpy.data.objects.new('RaumCam_' + name, cd)
    SC.collection.objects.link(cam)
    cam.location = (0, -0.0, h)
    cam.rotation_euler = (math.pi / 2 - phi, 0, 0)
    SC.camera = cam
    # Freestyle-Kontur wie die Tusche-Linien der gezeichneten Räume
    r.use_freestyle = True
    r.line_thickness_mode = 'ABSOLUTE'
    r.line_thickness = 2.2
    vl = SC.view_layers[0]
    vl.use_freestyle = True
    fs = vl.freestyle_settings
    ls = fs.linesets[0] if fs.linesets else fs.linesets.new('Kontur')
    ls.select_by_visibility = True
    ls.select_silhouette = ls.select_border = ls.select_crease = True
    ls.linestyle.color = (0.04, 0.012, 0.07)
    ls.linestyle.thickness = 2.2
    nk = bpy.data.collections.get('Ohne_Kontur') or bpy.data.collections.new('Ohne_Kontur')   # Palmwedel u. Ä. ohne Kontur
    ls.select_by_collection = True
    ls.collection = nk
    ls.collection_negation = 'EXCLUSIVE'
    print('cam h', round(h, 2), 'phi', round(phi, 3), 'lens', round(cd.lens, 1), 'Vorderkante bei', round(d1, 2), 'm')
    return SC, cam


def tex_toon(name, file, scale=0.35, uv=False, hi=None, rot=0.0):
    """Toon-Material mit Bildtextur aus art/textures (texturen.py): UV-Koordinaten oder Box-Projektion in Weltkoordinaten."""
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials['HautB'].copy()
        m.name = name
    nt = m.node_tree
    for n in [n for n in nt.nodes if n.name.startswith('Tex_')]:
        nt.nodes.remove(n)
    img = nt.nodes.new('ShaderNodeTexImage')
    img.name = 'Tex_Bild'
    img.image = bpy.data.images.load(REPO + '/art/textures/' + file, check_existing=True)
    img.image.reload()   # texturen.py kann die Datei inzwischen neu erzeugt haben
    if not uv:
        img.projection, img.projection_blend = 'BOX', 0.25
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.name = 'Tex_Map'
    if uv:
        tc = nt.nodes.new('ShaderNodeTexCoord')
        tc.name = 'Tex_Koord'
        nt.links.new(tc.outputs['UV'], mp.inputs['Vector'])
    else:
        geo = nt.nodes.new('ShaderNodeNewGeometry')
        geo.name = 'Tex_Geo'
        nt.links.new(geo.outputs['Position'], mp.inputs['Vector'])
        mp.inputs['Scale'].default_value = (scale, scale, scale)
        mp.inputs['Rotation'].default_value = (0, 0, rot)
    nt.links.new(mp.outputs['Vector'], img.inputs['Vector'])
    nt.links.new(img.outputs['Color'], nt.nodes['ToonMul'].inputs[6])
    nt.links.new(img.outputs['Color'], next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'])
    if hi is not None:
        nt.nodes['ToonHi'].color_ramp.elements[1].color = (hi, hi, hi, 1)
    m.diffuse_color = (0.6, 0.45, 0.3, 1)
    return m


def tube_in(SC):
    """Kurven-Rohr (Seil, Zierleiste) mit Rundprofil, an die Szene gebunden."""
    def tube(name, pts, r, mat, parent, tip=1.0):
        cd = bpy.data.curves.get(name) or bpy.data.curves.new(name, 'CURVE')
        cd.splines.clear()
        cd.dimensions = '3D'
        cd.bevel_depth = r
        cd.bevel_resolution = 4
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
    return tube


def sun(SC, rot, energy, col):
    ld = bpy.data.lights.new('Sonne', 'SUN')
    ld.energy = energy
    ld.color = col
    ld.angle = 0.2
    o = bpy.data.objects.new('Sonne', ld)
    SC.collection.objects.link(o)
    o.rotation_euler = rot
    return o


def box(B, name, loc, size, mat, parent=None, rot=(0, 0, 0), bevel=0.02):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    o = B.obj(name, bm, mat, parent, loc, rot, size, smooth=False, bevel=bevel)
    return o


def plane(B, name, x0, x1, y0, y1, z, mat):
    bm = bmesh.new()
    vs = [bm.verts.new((x0, y0, z)), bm.verts.new((x1, y0, z)), bm.verts.new((x1, y1, z)), bm.verts.new((x0, y1, z))]
    bm.faces.new(vs)
    return B.obj(name, bm, mat, None, (0, 0, 0), smooth=False)


# ------------------------------------------------------------------ Hafen 1776
def build_hafen(SC):
    B = Builder(SC)
    WOOD, WOODD, WOODL = tex_toon('R_Stegholz', 'holz_steg.png', 0.32), toon('R_HolzDunkel', '#6a4426'), tex_toon('R_Stegholz2', 'holz_deck.png', 0.32)
    SEA, SEAD, FOAM = toon('R_Meer', '#2f8fb8', hi=0.85), toon('R_MeerTief', '#1f6a94'), toon('R_Gischt', '#e8f6ff')
    STONE, ROPE, SAIL, RED, BLACK = toon('R_Stein', '#9a948a'), toon('R_Seil', '#c8a870'), toon('R_Segel', '#f2ead6'), toon('R_Rot', '#b8323a'), toon('N_Schwarz', '#16121e', hi=0.15)
    ROOF, WALL, GOLD = tex_toon('R_Ziegel', 'dachziegel.png', 0.45), tex_toon('R_Putz', 'putz.png', 0.22), toon('N_Gold', '#e9b53c', hi=0.6)
    BARREL = tex_toon('R_Fassholz', 'holz_fass.png', 1.1)
    # Steg aus Planken (Lauffläche) und Wasser dahinter
    # Steg als eine durchgehende Fläche: die Planken kommen aus der Textur (einzelne Bretter gäben harte Konturlinien)
    box(B, 'Steg', (0, 10.7, -0.06), (40, 9.4, 0.12), tex_toon('R_Steg', 'holz_steg.png', 0.23, rot=math.pi / 2), bevel=0.0)
    meer = plane(B, 'Meer', -260, 260, 15.4, 380, -0.75, SEA)   # reicht bis an die Berge
    bm = bmesh.new()
    bm.from_mesh(meer.data)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=47, use_grid_fill=True)   # viele kleine Flächen: Freestyle verdeckt sonst nicht sauber
    bm.to_mesh(meer.data)
    bm.free()
    for i in range(36):   # Wellenkämme
        rnd = random.Random(i)
        x, y = rnd.uniform(-40, 40), rnd.uniform(18, 90)
        B.sphere(f'Welle{i}', (x, y, -0.72), (rnd.uniform(0.8, 2.2), 0.12, 0.05), FOAM, None)
    # Kante des Stegs mit Pollern und Tau
    box(B, 'Kante', (0, 15.35, -0.1), (24, 0.3, 0.3), WOODD, bevel=0.02)
    for i, x in enumerate([-5.2, -0.6, 3.6]):
        B.cone(f'Poller{i}', -0.1, 0.55, 0.16, 0.13, WOODD, None, xy=(x, 15.2), bevel=0.03)
        B.sphere(f'PollerKopf{i}', (x, 15.2, 0.58), (0.17, 0.17, 0.07), WOODD, None)
    # Lagerhaus links mit Schild
    box(B, 'Lager', (-7.8, 16.2, 2.2), (4.6, 3.4, 4.4), WALL)
    for i in range(6):
        box(B, f'Fachwerk{i}', (-9.8 + i * 0.8, 14.48, 2.2), (0.12, 0.05, 4.4), WOODD, bevel=0.005)
    box(B, 'Riegel', (-7.8, 14.47, 2.6), (4.6, 0.05, 0.12), WOODD, bevel=0.005)
    roof = box(B, 'Dach', (-7.8, 16.2, 4.75), (5.2, 4.0, 0.25), ROOF, rot=(0.0, 0, 0))
    box(B, 'Tor', (-6.6, 14.45, 1.15), (1.7, 0.08, 2.3), WOODD)
    box(B, 'Schild', (-8.1, 14.42, 3.4), (2.6, 0.06, 0.6), WOODL)
    cd = bpy.data.curves.get('SchildText') or bpy.data.curves.new('SchildText', 'FONT')
    cd.body, cd.size, cd.align_x, cd.align_y, cd.extrude = 'RUM & TAUE', 0.36, 'CENTER', 'CENTER', 0.01
    cd.materials.clear(); cd.materials.append(toon('R_Schrift', '#3a2010'))
    st = bpy.data.objects.new('SchildText', cd); SC.collection.objects.link(st)
    st.location, st.rotation_euler = (-8.1, 14.38, 3.38), (math.pi / 2, 0, 0)
    # Fässer, Kisten, Seilrolle, Kanone, Laterne
    for i, (x, y) in enumerate([(-2.7, 13.7), (-2.1, 14.3), (-3.4, 14.4), (4.8, 14.6)]):
        B.cone(f'Fass{i}', 0, 0.95, 0.38, 0.38, BARREL, None, xy=(x, y), bevel=0.04, scale=(1, 1, 1))
        for j, z in enumerate((0.12, 0.83)):
            B.torus(f'Reif{i}{j}', (x, y, z), 0.385, 0.025, BLACK, None, seg=32, sseg=6)
    for i, (x, y, s) in enumerate([(-1.4, 14.7, 0.8), (5.8, 14.2, 0.7), (5.9, 14.3, 0.5)]):
        box(B, f'Kiste{i}', (x, y, s / 2 + (0.7 if i == 2 else 0)), (s, s, s), WOOD, bevel=0.03)
    B.torus('Seilrolle', (0.7, 13.4, 0.12), 0.38, 0.12, ROPE, None, seg=32, sseg=10)
    B.cone('Laternenpfahl', 0, 3.2, 0.08, 0.07, WOODD, None, xy=(-1.0, 15.0), bevel=0)
    box(B, 'Laterne', (-1.0, 15.0, 3.35), (0.32, 0.32, 0.42), toon('R_Laternenglas', '#ffd77a', hi=0.95), bevel=0.04)
    # Piratenschiff: eigene Galeone (schiff.py), schräg im Hafenbecken, damit man die Segel von vorn sieht
    import schiff
    importlib.reload(schiff)
    global SHIP_BUILD
    import tropen
    importlib.reload(tropen)

    def ship_build(phase=0.0):   # Galeone samt jubelnder Crew (Arme im Takt der vier Windphasen)
        root = schiff.build(SC, Builder(SC), toon, lambda n, f, **k: tex_toon(n, f, **k), tube_in(SC), (9.0, 36.0, -0.75), -0.9, phase)
        tropen.crew(SC, Builder(SC), toon, root, phase, -0.9, schiff.x_at, schiff.half_width, schiff.deck_z)
        return root
    SHIP_BUILD = ship_build
    SH = SHIP_BUILD(0.0)
    # Palmeninsel (insel.py) zwischen Lagerhaus und Schiff, dahinter dunstige Berge
    import insel
    importlib.reload(insel)
    insel.build(SC, B, toon, tex_toon, tube_in(SC), (-11.0, 95.0, -0.75))
    for o in SC.objects:
        if o.name.startswith(('Berg', 'Insel_Strand')):
            tropen.clip_below(o, -0.95)
    # Brasilien-Flair: Anakonda am Dach, Wimpelketten, Tropenobst (Vögel nur als eigene Ebene, siehe render_hafen_layers)
    global SNAKE_BUILD
    SNAKE_BUILD = lambda phase=0.0: tropen.schlange(SC, Builder(SC), toon, tex_toon, phase)
    SNAKE_BUILD(0.0)
    tropen.wimpel(SC, B, toon, tube_in(SC))
    tropen.obst(SC, B, toon, tube_in(SC))
    # Wolken
    for i in range(7):
        rnd = random.Random(100 + i)
        x, y, z = rnd.uniform(-60, 60), rnd.uniform(110, 135), rnd.uniform(14, 30)
        for j in range(4):
            B.sphere(f'Wolke{i}{j}', (x + j * 3.2 - 5, y, z + rnd.uniform(-0.6, 1.2)), (rnd.uniform(2.8, 4.2), 2.0, rnd.uniform(1.6, 2.6)), toon('R_Wolke', '#ffffff', hi=0.5), None)
    sun(SC, (0.95, 0.15, 0.65), 4.2, (1.0, 0.94, 0.82))
    return {'Schiff': SH, 'Lager': bpy.data.objects['Tor'], 'Fass': bpy.data.objects['Fass0'], 'Laterne': bpy.data.objects['Laterne'], 'Seil': bpy.data.objects['Seilrolle'],
            'Schlange': bpy.data.objects['Schlange'], 'Obst': bpy.data.objects['Ananas']}


# ------------------------------------------------------------------ Landeplatz (Zukunft)
def build_landeplatz(SC):
    B = Builder(SC)
    PAD, PADL, NEON, NEONP, METAL, DARK = (toon('R_Platte', '#4a4064'), toon('R_PlatteHell', '#6a5a8c'), toon('R_Neon', '#7fe8ff', hi=0.95), toon('R_NeonPink', '#ff7ad9', hi=0.95),
                                           toon('R_Metall', '#9aa0b8', hi=0.75), toon('R_Dunkel', '#241a38'))
    SHIP, SHIPD, WIN = toon('R_Schiff', '#4fc06a', hi=0.7), toon('R_SchiffDunkel', '#2f8a4a'), toon('R_Fenster', '#bfefff', hi=0.95)
    for i in range(10):
        for j in range(7):
            box(B, f'Platte{i}{j}', (-11.25 + i * 2.5, 5.6 + j * 1.6, -0.06), (2.44, 1.54, 0.12), PAD if (i + j) % 2 else PADL, bevel=0.01)
    box(B, 'Rand', (0, 16.1, 0.05), (26, 0.4, 0.3), DARK)
    for i in range(12):
        B.sphere(f'Licht{i}', (-12 + i * 2.2, 15.85, 0.24), (0.12, 0.12, 0.06), NEON if i % 2 else NEONP, None)
    # Lieferraumschiff (grün, rund, mit Heckflosse) auf dem Landeplatz rechts
    S = B.empty('Raumschiff')
    S.location = (4.4, 20.5, 0.0)
    S.rotation_euler = (0, 0, 0.18)
    import lieferschiff
    importlib.reload(lieferschiff)
    lieferschiff.build(SC, B, toon, S)   # Drehkörper-Rumpf, Kuppel, Seitentriebwerke, Leitwerk, Landebeine (lieferschiff.py)
    # Skyline mit Neon-Fenstern weit hinten, darüber ein großer blasser Mond
    for i in range(20):
        rnd = random.Random(300 + i)
        x, y, hgt, w_ = -80 + i * 8.4 + rnd.uniform(-1.5, 1.5), rnd.uniform(85, 125), rnd.uniform(16, 48), rnd.uniform(5, 8)
        box(B, f'Turm{i}', (x, y, hgt / 2 - 1), (w_, w_, hgt), toon(f'R_Turm{i % 3}', ['#2a1e4a', '#33245a', '#241a40'][i % 3]), bevel=0.05)
        for j in range(int(hgt // 4.5)):
            if rnd.random() < 0.75:
                c = NEON if (i + j) % 4 == 0 else NEONP if (i + j) % 5 == 0 else toon('R_FensterGelb', '#ffd86a', hi=0.95)
                box(B, f'Fenster{i}_{j}', (x, y - w_ / 2 - 0.08, 2.5 + j * 4.5), (w_ * 0.72, 0.1, 0.9), c, bevel=0)
        if i % 4 == 1:
            B.cone(f'Antenne{i}', hgt - 1, hgt + 5, 0.25, 0.05, toon('R_Turm0', '#2a1e4a'), None, xy=(x, y), bevel=0)
            B.sphere(f'Blink{i}', (x, y, hgt + 5.2), (0.6, 0.6, 0.6), toon('R_Rot', '#ff4a5a', hi=0.95), None)
    B.sphere('Mond', (-35, 260, 70), (16, 2, 16), toon('R_Mond', '#f6eaff', hi=0.9), None)
    for i in range(5):   # schwebende Autos
        rnd = random.Random(500 + i)
        x, y, z = rnd.uniform(-40, 40), rnd.uniform(60, 80), rnd.uniform(8, 20)
        B.sphere(f'Gleiter{i}', (x, y, z), (1.6, 0.8, 0.45), toon('R_Gleiter', ['#ff7ad9', '#7fe8ff', '#ffd86a'][i % 3], hi=0.9), None)
    # Kisten, Zapfsäule, Schild links
    for i, (x, y, s) in enumerate([(-4.8, 13.8, 0.9), (-4.0, 14.4, 0.7), (-5.4, 14.6, 0.6)]):
        box(B, f'Fracht{i}', (x, y, s / 2), (s, s, s), toon('R_Fracht', '#c8823a'), bevel=0.03)
    box(B, 'Saeule', (-6.3, 15.0, 1.1), (0.9, 0.7, 2.2), METAL, bevel=0.06)
    box(B, 'SaeuleDisplay', (-6.3, 14.63, 1.6), (0.6, 0.05, 0.5), NEON, bevel=0.01)
    B.torus('Schlauch', (-5.6, 14.8, 0.6), 0.4, 0.05, DARK, None, rot=(1.57, 0, 0), seg=24, sseg=6)
    box(B, 'Tafel', (-8.2, 16.7, 3.2), (2.6, 0.1, 1.2), DARK, bevel=0.03)
    box(B, 'TafelNeon', (-8.2, 16.63, 3.2), (2.4, 0.05, 0.12), NEONP, bevel=0)
    sun(SC, (0.9, 0.0, -0.8), 1.6, (0.85, 0.75, 1.0))
    sun(SC, (1.2, 0.0, 0.9), 0.8, (1.0, 0.6, 0.9))
    return {'Raumschiff': S, 'Fracht': bpy.data.objects['Fracht0'], 'Saeule': bpy.data.objects['Saeule'], 'Tafel': bpy.data.objects['Tafel']}


# ------------------------------------------------------------------ Keller (unter der Lobby, Gegenwart)
def build_keller(SC):
    """Gewölbekeller im Toon-Look: Bruchsteinmauern, Kopfsteinpflaster, Leiter zur Falltür, Sicherungskasten mit
    Haupthebel, Heizkessel mit Rohren, grün leuchtendes Kühlbecken, Kettensäge am Haken, Regal mit Einmachgläsern,
    Kerkertür, nackte Glühbirne – eine Verbeugung vor den Kellern der alten Gruselvilla-Adventures."""
    B = Builder(SC)
    WALL, FLOOR = tex_toon('K_Mauer', 'mauer.png', 0.36, hi=0.0), tex_toon('K_Pflaster', 'pflaster.png', 0.55, hi=0.0)   # matt: kein Glanzfleck
    WOOD, WOODD = tex_toon('K_Holz', 'holz_deck.png', 0.4, hi=0.0), toon('K_HolzDunkel', '#4a3020', hi=0.0)
    METAL, IRON, RED, YEL = toon('K_Metall', '#8a8e98', hi=0.5), toon('K_Eisen', '#3a3a42', hi=0.3), toon('K_Rot', '#c8323a'), toon('K_Gelb', '#f0c83a')
    COPPER, BLACK, WHITE = toon('K_Kupfer', '#b8693a', hi=0.25), toon('N_Schwarz', '#16121e', hi=0.15), toon('K_Weiss', '#ece6da')
    GLOW, GREEN = toon('K_Lampe', '#ffe39a', hi=0.95), toon('K_Reaktor', '#7dff8a', hi=0.95)
    for m in (GLOW, GREEN):   # leuchten selbst
        e = m.node_tree.nodes.get('ToonEmi')
        if e:
            e.inputs['Strength'].default_value = 2.2
    # Boden, Rückwand, schräge Seitenwände (wie eine Bühne), Decke mit Balken
    box(B, 'K_Boden', (0, 11.2, -0.06), (24, 9.6, 0.12), FLOOR, bevel=0)
    box(B, 'K_Rueckwand', (0, 14.6, 2.7), (20, 0.5, 5.6), WALL, bevel=0)
    for k, sx in (('L', -1), ('R', 1)):
        a = math.atan2(6.9, 3.0)
        cxw, cyw = sx * 6.3, 10.95
        box(B, f'K_Seitenwand{k}', (cxw + sx * 0.22, cyw - 0.1, 2.7), (0.5, 7.8, 5.6), WALL, rot=(0, 0, -sx * (math.pi / 2 - a)), bevel=0)
    box(B, 'K_Decke', (0, 11.2, 5.0), (20, 9.6, 0.3), WOODD, bevel=0)
    for i, y in enumerate((9.2, 11.4, 13.6)):
        box(B, f'K_Balken{i}', (0, y, 4.75), (16, 0.35, 0.3), WOOD, bevel=0.02)
    # Leiter hinauf zur Falltür, warmes Licht aus der Luke
    lx, ly = -1.55, 13.75
    for sx in (-1, 1):
        B.rod(f'K_Holm{sx}', (lx + sx * 0.26, ly, 0.0), (lx + sx * 0.26, ly + 0.25, 4.9), 0.045, WOOD, None, seg=10)
    for i in range(14):
        z = 0.3 + i * 0.33
        B.rod(f'K_Sprosse{i}', (lx - 0.26, ly + z / 4.9 * 0.25, z), (lx + 0.26, ly + z / 4.9 * 0.25, z), 0.03, WOOD, None, seg=8)
    box(B, 'K_Luke', (lx, ly + 0.2, 4.84), (0.9, 0.9, 0.02), GLOW, bevel=0)
    # Sicherungskasten mit Haupthebel und Schild
    fx = 2.1
    box(B, 'K_Sicherung', (fx, 14.25, 1.75), (0.95, 0.2, 1.15), METAL, bevel=0.03)
    box(B, 'K_SicherungTuer', (fx - 0.12, 14.13, 1.75), (0.6, 0.04, 0.9), IRON, bevel=0.01)
    B.rod('K_Hebel', (fx + 0.33, 14.1, 1.55), (fx + 0.62, 13.95, 2.05), 0.035, IRON, None, seg=8)
    B.sphere('K_HebelKnauf', (fx + 0.63, 13.94, 2.08), (0.07, 0.07, 0.07), RED, None)
    box(B, 'K_Schild', (fx - 0.05, 14.13, 2.5), (1.1, 0.04, 0.22), YEL, bevel=0.01)
    cd = bpy.data.curves.get('K_SchildText') or bpy.data.curves.new('K_SchildText', 'FONT')
    cd.body, cd.size, cd.align_x, cd.align_y, cd.extrude = 'HAUPTSICHERUNG', 0.12, 'CENTER', 'CENTER', 0.005
    cd.materials.clear(); cd.materials.append(BLACK)
    st = bpy.data.objects.new('K_SchildText', cd); SC.collection.objects.link(st)
    st.location, st.rotation_euler = (fx - 0.05, 14.1, 2.49), (math.pi / 2, 0, 0)
    for i in range(3):
        B.rod(f'K_Kabel{i}', (fx - 0.3 + i * 0.3, 14.3, 2.33), (fx - 0.3 + i * 0.3, 14.3, 4.85), 0.025, BLACK, None, seg=6)
    # Heizkessel mit Nieten, Feuerklappe, Manometer und Rohren
    kx, ky = 5.5, 13.2
    B.cone('K_Kessel', 0.0, 2.3, 0.85, 0.85, COPPER, None, xy=(kx, ky), seg=32, bevel=0.03)
    B.sphere('K_KesselDach', (kx, ky, 2.3), (0.85, 0.85, 0.35), COPPER, None)
    for i, z in enumerate((0.25, 1.15, 2.05)):
        B.torus(f'K_KesselRing{i}', (kx, ky, z), 0.86, 0.035, IRON, None, seg=40, sseg=6)
    box(B, 'K_Feuerklappe', (kx, ky - 0.84, 0.55), (0.5, 0.06, 0.4), IRON, bevel=0.01)
    box(B, 'K_Glut', (kx, ky - 0.87, 0.5), (0.36, 0.02, 0.12), toon('K_Glut', '#ff8a2a', hi=0.95), bevel=0)
    B.cone('K_Manometer', 0.0, 0.06, 0.18, 0.18, WHITE, None, xy=(0, 0), rot=(math.pi / 2, 0, 0), bevel=0.01)
    bpy.data.objects['K_Manometer'].location = (kx + 0.35, ky - 0.86, 1.65)
    B.rod('K_Zeiger', (kx + 0.35, ky - 0.93, 1.65), (kx + 0.45, ky - 0.93, 1.74), 0.012, RED, None, seg=6)
    for i, (a, b) in enumerate((((kx, ky, 2.5), (kx, ky, 4.85)), ((kx - 0.4, ky, 2.4), (kx - 0.4, ky + 1.1, 4.0)), ((kx, ky, 4.5), (-1.0, ky + 1.1, 4.5)))):
        B.rod(f'K_Rohr{i}', a, b, 0.09, COPPER, None, seg=12)
    # Kühlbecken mit grün leuchtendem Wasser und Warnschild
    px0, px1, py0, py1 = -6.9, -4.3, 12.2, 14.2
    for i, (cxp, cyp, sxp, syp) in enumerate((((px0 + px1) / 2, py0, px1 - px0, 0.25), ((px0 + px1) / 2, py1, px1 - px0, 0.25), (px0, (py0 + py1) / 2, 0.25, py1 - py0), (px1, (py0 + py1) / 2, 0.25, py1 - py0))):
        box(B, f'K_Beckenrand{i}', (cxp, cyp, 0.2), (sxp, syp, 0.4), toon('K_Beton', '#8a8a80', hi=0.05), bevel=0.02)
    box(B, 'K_Reaktorwasser', ((px0 + px1) / 2, (py0 + py1) / 2, 0.33), (px1 - px0 - 0.2, py1 - py0 - 0.2, 0.02), GREEN, bevel=0)
    for i, (bx, by, br) in enumerate(((-6.1, 12.6, 0.07), (-5.3, 13.1, 0.05), (-4.9, 12.5, 0.06), (-5.8, 13.6, 0.04))):   # Blubberblasen
        B.sphere(f'K_Blase{i}', (bx, by, 0.36), (br, br, br * 0.8), GREEN, None)
    box(B, 'K_Warnschild', (-5.6, 14.32, 2.5), (2.0, 0.04, 0.8), YEL, bevel=0.01)
    for i, (txt_, z, sz) in enumerate((('KÜHLBECKEN', 2.68, 0.2), ('NICHT SCHWIMMEN!', 2.36, 0.14))):
        cdw = bpy.data.curves.get(f'K_WarnText{i}') or bpy.data.curves.new(f'K_WarnText{i}', 'FONT')
        cdw.body, cdw.size, cdw.align_x, cdw.align_y, cdw.extrude = txt_, sz, 'CENTER', 'CENTER', 0.005
        cdw.materials.clear(); cdw.materials.append(BLACK)
        ow = bpy.data.objects.new(f'K_WarnText{i}', cdw); SC.collection.objects.link(ow)
        ow.location, ow.rotation_euler = (-5.6, 14.29, z), (math.pi / 2, 0, 0)
    # Kettensäge am Haken einer Lochwand (mit Zettel)
    sx_, sz_ = 0.3, 2.25
    box(B, 'K_Lochwand', (sx_ + 0.3, 14.33, sz_ + 0.05), (1.5, 0.04, 1.0), toon('K_Hartfaser', '#a8865a', hi=0.0), bevel=0.01)
    for i in range(5):
        for j in range(3):
            B.sphere(f'K_Loch{i}{j}', (sx_ - 0.3 + i * 0.3, 14.305, sz_ - 0.27 + j * 0.32), (0.02, 0.01, 0.02), BLACK, None)
    B.rod('K_Haken', (sx_, 14.32, sz_ + 0.35), (sx_, 14.2, sz_ + 0.18), 0.02, IRON, None, seg=6)
    box(B, 'K_Saege', (sx_, 14.2, sz_), (0.42, 0.16, 0.26), toon('K_Orange', '#e8762a'), bevel=0.03)
    box(B, 'K_SaegeSchwert', (sx_ + 0.48, 14.2, sz_ - 0.02), (0.6, 0.03, 0.1), METAL, bevel=0.01)
    B.torus('K_SaegeGriff', (sx_ - 0.05, 14.2, sz_ + 0.17), 0.1, 0.02, BLACK, None, rot=(math.pi / 2, 0, 0), seg=16, sseg=6)
    box(B, 'K_Zettel', (sx_ - 0.05, 14.1, sz_ - 0.25), (0.22, 0.01, 0.14), WHITE, rot=(0, 0.15, 0), bevel=0)
    # Regal mit Einmachgläsern und Kerkertür an der Rückwand
    R = B.empty('K_RegalRoot'); R.location = (3.55, 14.15, 0)
    for i, z in enumerate((0.4, 1.05, 1.7)):
        box(B, f'K_Brett{i}', (0, 0, z), (1.3, 0.4, 0.05), WOOD, R, bevel=0.01)
        for j in range(4):
            col = ['#7ab84a', '#c84a5a', '#9a5ac8', '#e0b84a'][(i + j) % 4]
            B.cone(f'K_Glas{i}{j}', z + 0.03, z + 0.33, 0.1, 0.1, toon(f'K_Glas{(i + j) % 4}', col, hi=0.7), R, xy=(-0.45 + j * 0.3, 0.02), seg=16, bevel=0.01)
            B.cone(f'K_Deckel{i}{j}', z + 0.33, z + 0.38, 0.105, 0.105, COPPER, R, xy=(-0.45 + j * 0.3, 0.02), seg=16, bevel=0)
    for sx in (-1, 1):
        box(B, f'K_Regalseite{sx}', (sx * 0.65, 0, 1.0), (0.05, 0.4, 2.0), WOOD, R, bevel=0.01)
    K = B.empty('K_KerkerRoot'); K.location = (-3.2, 14.36, 0)
    box(B, 'K_KerkerBogen', (0, 0, 1.1), (1.2, 0.12, 2.2), toon('K_Dunkel', '#1a1620', hi=0.0), K, bevel=0)
    box(B, 'K_KerkerSturz', (0, -0.08, 2.3), (1.45, 0.16, 0.22), toon('K_Beton', '#8a8a80', hi=0.05), K, bevel=0.02)
    for i in range(6):
        B.rod(f'K_Gitter{i}', (-0.5 + i * 0.2, -0.1, 0.02), (-0.5 + i * 0.2, -0.1, 2.18), 0.025, IRON, K, seg=6)
    for z in (0.6, 1.6):
        B.rod(f'K_Querstab{z}', (-0.56, -0.1, z), (0.56, -0.1, z), 0.03, IRON, K, seg=6)
    box(B, 'K_Schloss', (0.42, -0.16, 1.1), (0.14, 0.06, 0.18), toon('K_Messing', '#c8a03a', hi=0.3), K, bevel=0.01)
    # Überwachungskamera „G.L.a.D.O.S. 0.1“ am Deckenbalken: der Prototyp der Test-KI aus der Zukunft – weiße Schale,
    # schwarzer Kern, ein gelbes Auge (das Spiel lässt es leuchten und dem Spieler folgen), Klebeband-Etikett
    SHELL, CORE = toon('K_Schale', '#eceae4', hi=0.3), toon('K_Kern', '#26242e', hi=0.2)
    EYE = toon('K_Lampe_Auge', '#ffc83a', hi=0.95)
    e = EYE.node_tree.nodes.get('ToonEmi')
    if e:
        e.inputs['Strength'].default_value = 2.6
    gx, gy, gz = -4.4, 13.55, 4.6
    box(B, 'K_KamHalter', (gx, gy, gz - 0.03), (0.34, 0.34, 0.06), IRON, bevel=0.01)
    B.rod('K_KamArm0', (gx, gy, gz - 0.04), (gx, gy - 0.04, gz - 0.42), 0.045, CORE, None, seg=10)
    B.sphere('K_KamGelenk', (gx, gy - 0.04, gz - 0.45), (0.075, 0.075, 0.075), SHELL, None)
    B.rod('K_KamArm1', (gx, gy - 0.04, gz - 0.45), (gx + 0.14, gy - 0.22, gz - 0.66), 0.04, CORE, None, seg=10)
    B.rod('K_KamKabel', (gx - 0.12, gy + 0.05, gz - 0.05), (gx + 0.05, gy - 0.12, gz - 0.62), 0.016, BLACK, None, seg=6)
    H = B.empty('K_KameraRoot'); H.location = (gx + 0.2, gy - 0.32, gz - 0.74); H.rotation_euler = (0.3, 0, -0.5)   # schaut nach −y, leicht nach unten in den Raum
    B.sphere('K_KamKopf', (0, 0.06, 0), (0.2, 0.32, 0.19), SHELL, H)
    box(B, 'K_KamPlatte', (0, 0.1, 0.16), (0.24, 0.34, 0.05), SHELL, H, rot=(0.12, 0, 0), bevel=0.02)
    B.torus('K_KamRing', (0, -0.22, 0), 0.135, 0.028, CORE, H, rot=(math.pi / 2, 0, 0), seg=32, sseg=8)
    B.sphere('K_KamLinse', (0, -0.24, 0), (0.11, 0.05, 0.11), CORE, H)
    B.sphere('K_KamAuge', (0, -0.285, 0), (0.062, 0.022, 0.062), EYE, H)
    box(B, 'K_KamEtikett', (0.2, 0.02, -0.01), (0.012, 0.22, 0.08), toon('K_Klebeband', '#d8d0b8', hi=0.0), H, bevel=0)
    # Glühbirne am Kabel, Mauseloch, Kisten
    B.rod('K_Birnenkabel', (0.9, 11.2, 4.85), (0.9, 11.2, 3.45), 0.012, BLACK, None, seg=6)
    B.cone('K_Fassung', 3.3, 3.45, 0.06, 0.05, IRON, None, xy=(0.9, 11.2), seg=12, bevel=0)
    B.sphere('K_Birne', (0.9, 11.2, 3.2), (0.11, 0.11, 0.14), GLOW, None)
    B.cone('K_Mauseloch', 0.0, 0.03, 0.17, 0.17, BLACK, None, xy=(0, 0), rot=(math.pi / 2, 0, 0), bevel=0, cut=(-0.01, math.pi + 0.01))
    bpy.data.objects['K_Mauseloch'].location = (1.05, 14.34, 0.0)
    for i, (x, y, s) in enumerate(((4.3, 8.9, 0.7), (4.7, 9.5, 0.6), (4.45, 9.1, 0.5))):
        box(B, f'K_Kiste{i}', (x, y, s / 2 + (0.7 if i == 2 else 0)), (s, s, s), WOOD, rot=(0, 0, 0.3 * i), bevel=0.02)
    # Licht: Glühbirne (warm), Kühlbecken (grün), Luke (warm von oben), schwaches Grundlicht
    def lamp(name, loc, energy, col, size=0.1, kind='POINT', rot=None):
        ld = bpy.data.lights.new(name, kind)
        ld.energy, ld.color = energy, col
        if kind == 'POINT':
            ld.shadow_soft_size = size
        o = bpy.data.objects.new(name, ld); SC.collection.objects.link(o); o.location = loc
        if rot:
            o.rotation_euler = rot
        return o
    lamp('K_LichtBirne', (0.9, 11.0, 3.0), 520, (1.0, 0.8, 0.55), 0.25)
    lamp('K_LichtBecken', (-5.6, 13.0, 0.9), 380, (0.45, 1.0, 0.5), 0.6)
    lamp('K_LichtLuke', (lx, ly, 4.6), 160, (1.0, 0.86, 0.6), 0.3)
    sun(SC, (0.8, 0.0, 0.3), 0.4, (0.62, 0.66, 0.9))
    return {'Sicherung': bpy.data.objects['K_Sicherung'], 'Hebel': bpy.data.objects['K_HebelKnauf'], 'Kessel': bpy.data.objects['K_Kessel'],
            'Becken': bpy.data.objects['K_Reaktorwasser'], 'Saege': bpy.data.objects['K_Saege'], 'Leiter': bpy.data.objects['K_Holm1'],
            'Regal': bpy.data.objects['K_RegalRoot'], 'Kerker': bpy.data.objects['K_KerkerRoot'], 'Birne': bpy.data.objects['K_Birne'],
            'Schild': bpy.data.objects['K_Warnschild'], 'Mauseloch': bpy.data.objects['K_Mauseloch'], 'Kamera': bpy.data.objects['K_KameraRoot'],
            'KameraAuge': bpy.data.objects['K_KamAuge'], 'Lochwand': bpy.data.objects['K_Lochwand']}


def tree(o):
    out = [o]
    for c in o.children:
        out += tree(c)
    return out


def render_hafen_layers(SC, cam):
    """Hafen in Ebenen für die Animation im Spiel: Himmel/Meer/Insel, Wolken, Vordergrund (Steg, Lager, Fässer …),
    das Schiff in vier Windphasen (schaukelt im Spiel) – dazu das Gesamtbild für Pixel-Modus und Karte."""
    out = REPO + '/art/render/hafen/'
    os.makedirs(out, exist_ok=True)

    import tropen

    def cls(o, sets):
        n = o.name
        for k, s in sets.items():
            if n in s:
                return k
        if n.startswith(('Vogel_', 'V_')):
            return 'vogel'
        if n.startswith('Wolke'):
            return 'wolken'
        if n.startswith('Welle'):
            return 'wellen'
        if n == 'Meer' or n.startswith(('Insel', 'Strand', 'Palme', 'Blatt', 'Berg')):
            return 'bg'
        return 'vorn'

    def roots():
        return {k: {o.name for o in tree(bpy.data.objects[k.capitalize()])} for k in ('schiff', 'schlange') if bpy.data.objects.get(k.capitalize())}

    def border(objs, pad=0.012):
        """Renderausschnitt um die Objekte (spart Zeit bei kleinen Ebenen); das Bild bleibt 1920 × 880."""
        q = [world_to_camera_view(SC, cam, o.matrix_world @ Vector(c)) for o in objs if o.type == 'MESH' for c in o.bound_box]
        SC.render.border_min_x, SC.render.border_max_x = max(0, min(p.x for p in q) - pad), min(1, max(p.x for p in q) + pad)
        SC.render.border_min_y, SC.render.border_max_y = max(0, min(p.y for p in q) - pad), min(1, max(p.y for p in q) + pad)
        SC.render.use_border, SC.render.use_crop_to_border = True, False

    def shoot(name, groups, transparent, holdout=(), frame=None):
        sets = roots()
        for o in SC.objects:
            if o.type in ('MESH', 'CURVE', 'FONT', 'EMPTY'):
                o.hide_render = cls(o, sets) not in groups and o not in holdout
                o.is_holdout = o in holdout
        nk = bpy.data.collections['Ohne_Kontur']
        for o in holdout:   # verdeckt, wird aber selbst nicht gezeichnet (auch keine Kontur)
            if o.name not in nk.objects:
                nk.objects.link(o)
        if frame:
            border(frame)
        SC.render.film_transparent = transparent
        SC.render.image_settings.color_mode = 'RGBA' if transparent else 'RGB'
        SC.render.filepath = out + name + '.png'
        try:
            bpy.ops.render.render(write_still=True, scene=SC.name)
        finally:
            SC.render.use_border = False
            for o in holdout:
                o.is_holdout = False
                if o.name in nk.objects:
                    nk.objects.unlink(o)

    want = globals().get('ONLY_LAYERS') or ['bg', 'wolken', 'vorn', 'schiff', 'schlange', 'vogel']
    for name, tr in (('bg', False), ('wolken', True), ('vorn', True)):
        if name in want:
            shoot(name, {name}, tr)
    for k in (globals().get('SHIP_FRAMES') or range(4)) if 'schiff' in want else []:
        for o in reversed(tree(bpy.data.objects['Schiff'])):
            bpy.data.objects.remove(o, do_unlink=True)
        SHIP_BUILD(k / 4)
        bpy.context.view_layer.update()
        shoot(f'schiff{k}', {'schiff'}, True, frame=tree(bpy.data.objects['Schiff']))
    # Anakonda in acht Pendelphasen; Lagerhaus und Dach verdecken die Teile, die auf dem Dach liegen
    haus = [o for o in SC.objects if o.name.startswith(('Lager', 'Dach'))]
    for k in (globals().get('SNAKE_FRAMES') or range(8)) if 'schlange' in want else []:
        for o in reversed(tree(bpy.data.objects['Schlange'])):
            bpy.data.objects.remove(o, do_unlink=True)
        SNAKE_BUILD(k / 8)
        bpy.context.view_layer.update()
        shoot(f'schlange{k}', {'schlange'}, True, holdout=haus, frame=tree(bpy.data.objects['Schlange']))
    if 'schlange' in want:
        for o in reversed(tree(bpy.data.objects['Schlange'])):
            bpy.data.objects.remove(o, do_unlink=True)
        SNAKE_BUILD(0.0)
    # Aras und Tukan: drei Flügelstellungen, alle drei Vögel nebeneinander in einem Bild (hafen_post.py trennt sie)
    for k in range(len(tropen.FLUEGEL)) if 'vogel' in want else []:
        B = Builder(SC)
        birds = [tropen.vogel(B, toon, kind, loc, tropen.FLUEGEL[k]) for kind, loc in tropen.VOEGEL]
        bpy.context.view_layer.update()
        try:
            shoot(f'vogel{k}', {'vogel'}, True, frame=[o for b in birds for o in tree(b)])
        finally:
            for b in birds:
                for o in reversed(tree(b)):
                    bpy.data.objects.remove(o, do_unlink=True)
    for o in SC.objects:
        o.hide_render = False
    SC.render.film_transparent = False
    SC.render.image_settings.color_mode = 'RGB'
    q = world_to_camera_view(SC, cam, bpy.data.objects['Schiff'].matrix_world.translation)
    json.dump({'pivot': [round(q.x * 960, 1), round((1 - q.y) * 440, 1)]}, open(out + 'meta.json', 'w'))


# ------------------------------------------------------------------ Marsgesicht (Zukunft: Ausflug vom Landeplatz)
def build_mars(SC, froh=False, echt=False):
    """Rote Wüste mit gelandetem Lieferraumschiff, Briefkasten und dem riesigen steinernen Gesicht (Verbeugung vor dem
    Mars-Gesicht der Boulevard-Presse): missmutig mit Eisbeutel auf der Stirn (froh=False) oder mit geschlossenen Freudenaugen
    und breitem Lächeln, nachdem es seine Kopfschmerztabletten bekommen hat (froh=True). Beide Bilder sonst identisch.
    echt=True (für den Echtzeit-3D-Export): baut BEIDE Gesichtszustände in eine Szene – die Froh-Teile mit Präfix F_
    und zunächst versteckt; das Spiel schaltet im laufenden Bild die Zustände um (img/3d/mars.json, Zustand „froh“)."""
    B = Builder(SC)
    tube = tube_in(SC)
    SAND, ROCK = tex_toon('R_MarsSand', 'marssand.png', 0.09), tex_toon('R_MarsFels', 'marsfels.png', 0.22, hi=0.15)   # Fels matt, kein Glanz
    ROCKD, ROCKL = toon('R_MarsFelsDunkel', '#6a3226', hi=0.1), toon('R_MarsFelsHell', '#d88252', hi=0.12)
    NK = bpy.data.collections.get('Ohne_Kontur') or bpy.data.collections.new('Ohne_Kontur')   # flache Dünen und Kraterränder ohne Freestyle-Kontur
    DARK, PALE, BLACK = toon('R_MarsDunkel', '#2a1418'), toon('R_MarsWeiss', '#f6efe4', hi=0.6), toon('N_Schwarz', '#16121e', hi=0.15)
    METAL, GREEN, GREEND, WIN = toon('R_Metall', '#9aa0b8', hi=0.75), toon('R_Schiff', '#4fc06a', hi=0.7), toon('R_SchiffDunkel', '#2f8a4a'), toon('R_Fenster', '#bfefff', hi=0.95)
    WOOD, ICE, BLUSH = toon('R_HolzDunkel', '#6a4426'), toon('R_Eis', '#9ad8f0', hi=0.8), toon('R_Wange', '#ff8f86', hi=0.3)
    # Boden, ferne Berge in drei Dunststufen, Dünen-Wellen
    box(B, 'Boden', (0, 160, -0.6), (700, 320, 1.2), SAND, bevel=0.0)
    for i in range(16):
        rnd = random.Random(700 + i)
        B.sphere(f'Berg{i}', (-300 + i * 40 + rnd.uniform(-10, 10), rnd.uniform(190, 250), -1), (rnd.uniform(28, 55), rnd.uniform(18, 26), rnd.uniform(9, 24)),
                 toon(f'R_MarsBerg{i % 3}', ['#c47a5c', '#b86e54', '#aa6450'][i % 3]), None)
    for i in range(40):
        rnd = random.Random(900 + i)
        NK.objects.link(B.sphere(f'Duene{i}', (rnd.uniform(-40, 40), rnd.uniform(14, 60), 0.02), (rnd.uniform(1.8, 5.5), 0.35, 0.05), ROCKL, None))
    # Felsbrocken (die Mitte vorn bleibt frei für die Lauffläche)
    for i in range(14):
        rnd = random.Random(300 + i)
        x, y = rnd.uniform(-34, 34), rnd.uniform(15, 62)
        if abs(x) < 9 and y < 20:
            x += 14 if x >= 0 else -14
        if 1.5 < x < 9.5 and y < 28:   # Briefkasten und Sicht aufs Gesicht freihalten
            x += 8
        s = rnd.uniform(0.5, 1.4)
        B.sphere(f'Fels{i}', (x, y, s * 0.3), (s * 1.3, s * 1.0, s * 0.7), ROCKD if i % 3 else ROCK, None, rot=(0, 0, rnd.uniform(0, 3)))
    for i, (x, y, r) in enumerate([(-12, 34, 4.2), (30, 40, 5.5), (-26, 52, 6.5)]):   # Krater
        NK.objects.link(B.torus(f'Krater{i}', (x, y, 0.05), r, 0.35, ROCKD, None, seg=40, sseg=8, scale=(1, 0.5, 1)))
    # Monde am Himmel: Phobos (Kartoffel mit Kratern) und das kleine Deimos
    B.sphere('Phobos', (-62, 320, 44), (13, 10, 10), toon('R_Mond1', '#c9b6aa', hi=0.5), None, rot=(0, 0.2, 0.4))
    for j, (dx, dz, rr) in enumerate([(-4, 2, 2.2), (3, -2, 1.7), (5, 3, 1.3), (-7, -3, 1.5)]):
        B.sphere(f'PhobosKrater{j}', (-62 + dx, 310.5, 44 + dz), (rr, 0.5, rr), toon('R_Mond1D', '#8a7a72'), None)
    B.sphere('Deimos', (96, 330, 37), (4.8, 4.5, 4.5), toon('R_Mond2', '#d8c8bc', hi=0.5), None)
    # --- das Gesicht ---
    FX, FY, FZ = 20.0, 75.0, 6.5
    G_ = B.empty('Gesicht')
    B.sphere('Sockel', (FX, FY + 3, 0.2), (13.5, 9.5, 3.6), ROCKD, G_)
    box(B, 'Kopf', (FX, FY, FZ + 1), (14, 10.5, 13.5), ROCK, G_, bevel=0.1)
    box(B, 'Kopfschmuck', (FX, FY + 0.6, FZ + 8.5), (12.6, 8.4, 3.0), ROCKD, G_, bevel=0.1)
    for i, x in enumerate((-4.2, 0, 4.2)):
        box(B, f'Zacke{i}', (FX + x, FY + 0.6, FZ + 10.4), (2.2, 3.0, 1.3), ROCKD, G_, bevel=0.1)
    for s, k in (('L', -1), ('R', 1)):   # Ohren und Wangen
        box(B, f'Ohr{s}', (FX + k * 7.4, FY + 0.6, FZ + 1.0), (1.3, 2.3, 4.2), ROCKD, G_, bevel=0.25)
        B.sphere(f'Wange{s}', (FX + k * 4.6, FY - 5.0, FZ - 1.8), (2.8, 1.5, 2.3), ROCKL, G_)
    FRONT = FY - 5.5
    B.sphere('Nase', (FX, FRONT - 0.7, FZ - 0.2), (1.4, 2.1, 2.5), ROCKL, G_)
    for s, k in (('L', -1), ('R', 1)):
        B.sphere(f'Nasenloch{s}', (FX + k * 0.7, FRONT - 2.6, FZ - 1.9), (0.4, 0.4, 0.3), DARK, G_)
        if froh or echt:   # Freudenaugen: zwei geschlossene Bögen, dazu rosige Wangen; beim Echtzeit-Export mit Präfix F_
            P = 'F_' if echt else ''
            box(B, f'{P}Braue{s}', (FX + k * 3.4, FRONT - 0.2, FZ + 4.5), (4.4, 1.2, 1.0), ROCKD, G_, rot=(0, k * 0.12, 0), bevel=0.2)
            tube(f'{P}Lachauge{s}', [(FX + k * 4.9, FRONT - 0.6, FZ + 1.7), (FX + k * 3.4, FRONT - 0.9, FZ + 2.9), (FX + k * 1.9, FRONT - 0.6, FZ + 1.7)], 0.3, DARK, G_)
            B.sphere(f'{P}Rouge{s}', (FX + k * 4.9, FRONT - 0.4, FZ - 0.5), (1.3, 0.25, 0.8), BLUSH, G_)
        if not froh or echt:   # Augen: dunkle Höhle, Augapfel, Pupille, schwere Oberlider; Brauen missmutig mit nach innen fallenden Enden
            box(B, f'Braue{s}', (FX + k * 3.4, FRONT - 0.2, FZ + 4.1), (4.4, 1.2, 1.0), ROCKD, G_, rot=(0, -k * 0.34, 0), bevel=0.2)
            B.sphere(f'Hoehle{s}', (FX + k * 3.4, FRONT - 0.1, FZ + 2.3), (2.2, 1.0, 1.8), DARK, G_)
            B.sphere(f'Augapfel{s}', (FX + k * 3.4, FRONT - 0.6, FZ + 2.1), (1.5, 0.8, 1.4), PALE, G_)
            B.sphere(f'Pupille{s}', (FX + k * 3.2, FRONT - 1.3, FZ + 1.8), (0.6, 0.3, 0.6), BLACK, G_)
            B.sphere(f'Lid{s}', (FX + k * 3.4, FRONT - 1.0, FZ + 3.0), (1.8, 0.9, 1.0), ROCK, G_)
    if froh or echt:   # breites Lächeln mit offenem Mund und Zahnreihe
        P = 'F_' if echt else ''
        B.sphere(f'{P}Mundoeffnung', (FX, FRONT - 0.2, FZ - 4.2), (3.6, 0.55, 1.4), DARK, G_)
        for i in range(5):
            box(B, f'{P}Zahn{i}', (FX - 2.4 + i * 1.2, FRONT - 0.65, FZ - 3.2), (0.9, 0.35, 0.9), PALE, G_, bevel=0.2)
        tube(f'{P}Lachen', [(FX - 4.0, FRONT - 0.5, FZ - 3.0), (FX - 2.0, FRONT - 0.9, FZ - 5.2), (FX + 2.0, FRONT - 0.9, FZ - 5.2), (FX + 4.0, FRONT - 0.5, FZ - 3.0)], 0.4, DARK, G_)
    if not froh or echt:   # Schmollmund
        tube('Schmollen', [(FX - 3.6, FRONT - 0.5, FZ - 5.0), (FX - 1.6, FRONT - 0.9, FZ - 3.8), (FX + 1.6, FRONT - 0.9, FZ - 3.8), (FX + 3.6, FRONT - 0.5, FZ - 5.0)], 0.45, DARK, G_)
        box(B, 'Eisbeutel', (FX + 0.4, FRONT - 0.5, FZ + 6.1), (5.0, 1.0, 2.6), ICE, G_, rot=(0, 0, 0.08), bevel=0.3)
        box(B, 'Band', (FX, FRONT - 0.15, FZ + 6.1), (14.2, 0.7, 0.8), PALE, G_, bevel=0.2)
        for i, x in enumerate((1.4, -0.3)):
            B.sphere(f'Tropfen{i}', (FX + x, FRONT - 0.9, FZ + 4.5 - i * 0.5), (0.22, 0.2, 0.4), ICE, G_)
    if echt:   # Froh-Teile initially versteckt; das Spiel blendet sie im Zustand „froh“ ein (img/3d/mars.json)
        for o in SC.objects:
            if o.name.startswith('F_'):
                o.hide_render = True
    # --- gelandetes Lieferraumschiff links ---
    S = B.empty('Raumschiff')
    S.location = (-10.5, 33.0, 0.0)
    S.rotation_euler = (0, 0, 0.18)
    import lieferschiff
    importlib.reload(lieferschiff)
    lieferschiff.build(SC, B, toon, S)
    # --- Briefkasten „Lieferungen für das Gesicht“, Warnschild und ein havarierter Rover ---
    B.cone('Pfosten', 0.0, 1.1, 0.07, 0.06, WOOD, None, xy=(4.6, 14.2), bevel=0)
    BK = box(B, 'Briefkasten', (4.6, 14.2, 1.3), (1.0, 0.6, 0.6), toon('R_Briefkasten', '#d8323a'), bevel=0.12)
    box(B, 'BriefSchlitz', (4.6, 13.89, 1.42), (0.55, 0.03, 0.08), DARK, bevel=0)
    box(B, 'BriefFahne', (5.14, 14.2, 1.55), (0.05, 0.05, 0.5), toon('R_BriefFahne', '#ffd23a'), bevel=0)
    for name, body, pos, size, extra in (('BriefText', 'FÜR: DAS GESICHT', (4.6, 13.88, 1.18), 0.085, None),):
        cd = bpy.data.curves.get(name + ('F' if froh else '')) or bpy.data.curves.new(name + ('F' if froh else ''), 'FONT')
        cd.body, cd.size, cd.align_x, cd.align_y, cd.extrude = body, size, 'CENTER', 'CENTER', 0.005
        cd.materials.clear(); cd.materials.append(toon('R_BriefSchrift', '#ffe9a0'))
        o = bpy.data.objects.new(name, cd); SC.collection.objects.link(o)
        o.location, o.rotation_euler = pos, (math.pi / 2, 0, 0)
    for x in (-2.7, -0.1):
        B.cone(f'SchildPfosten{int(x * 10)}', 0.0, 1.9, 0.06, 0.05, WOOD, None, xy=(x, 13.6), bevel=0)
    SCH = box(B, 'Schild', (-1.4, 13.52, 1.6), (3.0, 0.1, 1.2), toon('R_SchildHolz', '#c89a62'), bevel=0.05)
    cd = bpy.data.curves.get('SchildTextM' + ('F' if froh else '')) or bpy.data.curves.new('SchildTextM' + ('F' if froh else ''), 'FONT')
    cd.body, cd.size, cd.align_x, cd.align_y, cd.extrude = ('BITTE LEISE!\nGesicht hat Kopfweh' if not froh else 'DANKE!\nGesicht ist wieder gut'), 0.26, 'CENTER', 'CENTER', 0.01
    cd.materials.clear(); cd.materials.append(toon('R_SchildSchrift', '#6a1a1a'))
    st = bpy.data.objects.new('SchildTextM', cd); SC.collection.objects.link(st)
    st.location, st.rotation_euler = (-1.4, 13.44, 1.6), (math.pi / 2, 0, 0)
    RV = B.empty('Rover')
    RV.location, RV.rotation_euler = (-4.4, 16.8, 0.0), (0, 0, 0.5)
    box(B, 'RoverKoerper', (0, 0, 0.62), (1.8, 1.0, 0.5), toon('R_RoverGrau', '#d8d4cc', hi=0.6), RV, bevel=0.1)
    B.sphere('RoverKuppel', (0.5, 0, 0.98), (0.4, 0.35, 0.22), toon('R_RoverGlas', '#7fd8ff', hi=0.9), RV)
    B.rod('RoverMast', (-0.6, 0.2, 0.85), (-0.7, 0.2, 1.7), 0.03, METAL, RV, seg=8)
    B.sphere('RoverSchuessel', (-0.7, 0.2, 1.72), (0.22, 0.22, 0.08), METAL, RV, rot=(0.5, 0, 0))
    for i, (x, y) in enumerate([(-0.65, 0.5), (0, 0.5), (0.65, 0.5), (-0.65, -0.5), (0.65, -0.5)]):
        B.torus(f'RoverRad{i}', (x, y, 0.28), 0.2, 0.09, toon('R_RoverReifen', '#2a2630'), RV, rot=(math.pi / 2, 0, 0), seg=24, sseg=8)
    B.torus('RoverRadAb', (-1.5, -0.2, 0.09), 0.2, 0.09, toon('R_RoverReifen', '#2a2630'), None, seg=24, sseg=8)   # das sechste Rad liegt daneben
    box(B, 'RoverPanel', (0.1, 0, 1.15), (1.3, 0.8, 0.04), toon('R_RoverSolar', '#2a3a8a', hi=0.6), RV, rot=(0.25, 0, 0), bevel=0.01)
    sun(SC, (0.95, 0.0, -0.6), 4.0, (1.0, 0.86, 0.7))
    sun(SC, (1.2, 0.0, 0.9), 1.0, (0.9, 0.6, 0.62))
    return {'Gesicht': G_, 'Raumschiff': S, 'Briefkasten': BK, 'Schild': SCH, 'Rover': RV, 'Mond': bpy.data.objects['Phobos']}


# ---------------------------------------------------------------- Testkammer (Zukunft: GLaDOS' Prüfstand)
# Nachbau der in Unreal Engine gebauten Kammer (art/unreal/testkammer.py) für den Echtzeit-3D-Export:
# gleiche Kamera-Konvention (solve_cam), gleiche Maße (x rechts, y in die Tiefe, z hoch, Meter).
def build_testkammer(SC):
    B = Builder(SC)
    WEISS, FUGE, DUNKEL = toon('T_Paneel', '#e4eaee', hi=0.5), toon('T_Fuge', '#3c4048'), toon('T_KammerDunkel', '#2a2c34')
    BODEN = toon('T_KammerBoden', '#4e5260', hi=0.35)
    LEISTE = toon('T_LampeLeiste', '#fff8e8', hi=0.9)
    BLAU, ORANGE = toon('T_NeonBlau', '#3a9aff', hi=0.85), toon('T_NeonOrange', '#ff8a20', hi=0.85)
    GLAS, WARM, ROSA = toon('T_FensterGlas', '#b89a78', hi=0.8), toon('T_FensterWarm', '#ffd9a0', hi=0.85), toon('T_Herz', '#ff5aa8', hi=0.7)
    WUERFEL, SCHILD = toon('T_WuerfelGrau', '#a8b0bc', hi=0.5), toon('T_SchildWeiss', '#f0ecdc', hi=0.4)
    # Boden (Lauffläche ~6–18 m vor der Kamera), Decke, Sockel
    box(B, 'Boden', (0, 12.0, -0.05), (26, 12.4, 0.1), BODEN, bevel=0.0)
    box(B, 'Decke', (0, 12.0, 6.5), (24, 12, 0.3), DUNKEL, bevel=0.0)
    box(B, 'Sockel', (0, 16.85, 0.12), (24, 0.14, 0.24), DUNKEL, bevel=0.0)
    # Rückwand aus weißen Paneelen; hinter den Fugen die dunkle Wand
    box(B, 'WandHinten', (0, 17.15, 3.2), (24, 0.1, 6.4), FUGE, bevel=0.0)
    for i in range(-7, 8):
        for j in range(4):
            box(B, f'Paneel{i}_{j}', (i * 1.6, 17.0, 0.8 + j * 1.6), (1.56, 0.2, 1.56), WEISS, bevel=0.0)
    # Seitenwände schräg zur Kamera; links ein dunkler Durchgang (Ausgang zum Palast)
    for k in (-1, 1):
        box(B, f'Seitenwand{k}', (k * 9.6, 12.0, 3.2), (0.2, 10.4, 6.4), WEISS, bevel=0.0)
    box(B, 'TuerLoch', (-9.45, 9.2, 1.8), (0.12, 2.0, 3.4), FUGE, bevel=0.0)
    box(B, 'TuerRahmen', (-9.42, 9.2, 1.8), (0.14, 2.3, 3.7), DUNKEL, bevel=0.0)
    # Lichtleisten an der Decke
    for i in range(-3, 4):
        box(B, f'Leiste{i}', (i * 2.8, 13.5, 6.32), (2.2, 0.25, 0.06), LEISTE, bevel=0.0)
    # Beobachtungsfenster oben rechts mit warmem Licht dahinter
    box(B, 'FensterRahmen', (5.2, 16.88, 4.6), (3.6, 0.1, 1.6), DUNKEL, bevel=0.0)
    box(B, 'FensterGlas', (5.2, 16.86, 4.6), (3.3, 0.08, 1.3), GLAS, bevel=0.0)
    box(B, 'FensterWarm', (5.2, 17.05, 4.6), (3.2, 0.1, 1.2), WARM, bevel=0.0)
    # zwei Portal-Ovale an der Rückwand (flache, hochkant gestellte Ellipsen)
    B.sphere('PortalBlau', (-5.6, 16.86, 1.5), (0.62, 0.03, 1.15), BLAU, None)
    B.sphere('PortalOrange', (1.2, 16.86, 1.5), (0.62, 0.03, 1.15), ORANGE, None)
    # Begleiter-Würfel mit Herz
    box(B, 'Wuerfel', (-3.0, 13.4, 0.45), (0.9, 0.9, 0.9), WUERFEL, bevel=0.06)
    B.sphere('Herz', (-3.0, 12.94, 0.45), (0.3, 0.05, 0.3), ROSA, None)
    # Schild „KUCHEN-AUSGABE: BALD“ (der Text kommt aus dem Spiel, js/gaeste.js) mit dunklem Rahmen – sonst weiß auf weiß –
    # und Deckenhalterung für die Test-KI („Kuchenschild“, weil es auf dem Mars schon ein „Schild“ gibt)
    box(B, 'KuchenschildRahmen', (-6.2, 16.90, 3.6), (2.56, 0.06, 1.16), DUNKEL, bevel=0.0)
    box(B, 'Kuchenschild', (-6.2, 16.84, 3.6), (2.4, 0.08, 1.0), SCHILD, bevel=0.0)
    B.rod('Halterung', (2.4, 13.0, 6.5), (2.4, 13.0, 5.9), 0.5, DUNKEL, None, seg=24)
    B.torus('HalterungsRing', (2.4, 13.0, 5.9), 0.5, 0.07, DUNKEL, None, rot=(math.pi / 2, 0, 0), seg=24)
    # Licht wie in Unreal: kühle Fülllichter, warmes Fensterlicht, eine sanfte Sonne von vorn oben
    sun(SC, (0.9, 0.3, -0.55), 1.2, (1.0, 0.96, 0.92))
    for name, ort, watt, farbe, radius in (('Fuell', (0, 10.0, 5.0), 60, (0.86, 0.91, 1.0), 14),
                                           ('FuellLinks', (-6.5, 12.0, 4.0), 45, (0.9, 0.93, 1.0), 12),
                                           ('FensterGlanz', (5.2, 15.8, 4.6), 30, (1.0, 0.75, 0.43), 7)):
        ld = bpy.data.lights.new('Licht_' + name, 'POINT')
        ld.energy, ld.color, ld.shadow_soft_size = watt, farbe, 0.4
        ld.use_custom_distance, ld.cutoff_distance = True, radius
        lo = bpy.data.objects.new('Licht_' + name, ld)
        SC.collection.objects.link(lo)
        lo.location = ort
    return {'Wuerfel': bpy.data.objects['Wuerfel'], 'PortalBlau': bpy.data.objects['PortalBlau'], 'PortalOrange': bpy.data.objects['PortalOrange'], 'Schild': bpy.data.objects['Schild']}


ROOMS3D = {'hafen': (build_hafen, ('#9ad8f0', '#3a8ad0')), 'landeplatz': (build_landeplatz, ('#7a3a8a', '#140828')), 'keller': (build_keller, ('#2a2232', '#0c0a12')),
           'testkammer': (build_testkammer, ('#3a4058', '#20242e')),
           'mars': (lambda SC: build_mars(SC, False, echt=bool(globals().get('ECHT'))), ('#f4c496', '#7a3c52')), 'mars_froh': (lambda SC: build_mars(SC, True), ('#f4c496', '#7a3c52'))}


import altbau   # die alten, gezeichneten Räume in 3D (Lobby …): eigene Varianten und Sprites, siehe altbau.py
importlib.reload(altbau)
altbau.init(globals())
ROOMS3D.update(altbau.ROOMS)


def render(name):
    if name in altbau.ROOMS:
        return altbau.render(name, setup, only=globals().get('ONLY'), no_render=globals().get('NO_RENDER'))
    build, sky = ROOMS3D[name]
    SC, cam = setup(name, sky)
    anchors = build(SC)
    win = bpy.context.window
    prev = win.scene
    win.scene = SC   # erst in der aktiven Szene stimmen die Weltmatrizen
    bpy.context.view_layer.update()
    pts = {}
    for k, o in anchors.items():   # Bildpunkte (in Spiel-Einheiten 960 × 440) der Objekt-Mittelpunkte für die Hotspots
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box] if o.type != 'EMPTY' else [o.matrix_world.translation]
        if o.type == 'EMPTY':
            bb = [c.matrix_world @ Vector(v) for c in o.children for v in c.bound_box]
        q = [world_to_camera_view(SC, cam, p) for p in bb]
        xs, ys = [p.x * 960 for p in q], [(1 - p.y) * 440 for p in q]
        pts[k] = [round(min(xs)), round(min(ys)), round(max(xs) - min(xs)), round(max(ys) - min(ys))]
    try:
        if not globals().get('NO_RENDER') and name == 'hafen' and globals().get('LAYERS', True):
            render_hafen_layers(SC, cam)
        if not globals().get('NO_RENDER') and not globals().get('SKIP_COMPOSITE'):
            SC.render.filepath = REPO + f'/art/render/raum_{name}.png'
            bpy.ops.render.render(write_still=True, scene=SC.name)
    finally:
        win.scene = prev
    json.dump(pts, open(REPO + f'/art/render/raum_{name}.json', 'w'), indent=1)
    print('raum', name, pts)


if globals().get('NAME') in ROOMS3D:
    render(NAME)
