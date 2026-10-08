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
    B.sphere('SchiffRumpf', (0, 0, 2.6), (5.2, 2.0, 1.9), SHIP, S)
    B.sphere('SchiffNase', (4.4, 0, 2.5), (1.6, 1.5, 1.4), SHIP, S)
    B.sphere('Cockpit', (4.9, -0.1, 3.3), (1.0, 1.2, 0.75), WIN, S)
    B.cone('Triebwerk', 2.0, 2.4, 1.0, 0.8, SHIPD, S, xy=(-5.0, 0), rot=(0, 1.57, 0), bevel=0.03)
    B.cone('Flosse', 3.8, 6.2, 1.2, 0.1, SHIP, S, xy=(-3.6, 0), scale=(1.5, 0.15, 1), bevel=0.03)
    B.sphere('Turbine', (-5.6, 0, 2.4), (0.4, 0.9, 0.9), toon('R_Feuer', '#ffb04a', hi=0.95), S)
    for i, x in enumerate((-2.5, 0.0, 2.5)):
        B.sphere(f'Bullauge{i}', (x, -1.86, 2.9), (0.38, 0.12, 0.38), WIN, S)
        B.cone(f'Bein{i}', 0.0, 1.2, 0.12, 0.08, METAL, S, xy=(x, -0.9 if i % 2 else 0.9), bevel=0)
    box(B, 'Rampe', (1.2, -2.2, 0.55), (1.8, 2.6, 0.12), METAL, S, rot=(-0.45, 0, 0))
    box(B, 'Schriftband', (0, -1.95, 3.6), (5.0, 0.1, 0.5), toon('R_Band', '#ff5a4a'), S, bevel=0.01)
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


ROOMS3D = {'hafen': (build_hafen, ('#9ad8f0', '#3a8ad0')), 'landeplatz': (build_landeplatz, ('#7a3a8a', '#140828'))}


def render(name):
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
