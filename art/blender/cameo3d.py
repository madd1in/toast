# Zwei Verbeugungen vor der Gruselvilla in 3D (in Blender ausführen, vorher REPO und optional WHO = ['ted'] setzen):
#   REPO = r'C:/.../Tentakel-Toast'; exec(open(REPO + '/art/blender/cameo3d.py').read())
# - Cousin Ted: Mumie im aufrecht stehenden, bemalten Sarkophag (Deckel offen), Binden in Wickellagen, ein loses Ende;
#   Bilder: idle, auge (ein Auge glimmt), wink (Arm hebt sich zum Gruß).
# - Die fleischfressende Riesenpflanze: Terrakotta-Topf, dicker gebogener Stiel, Blätter, ein Kopf mit zwei Kiefern,
#   innen rot, weiße Zähne, Zunge; Bilder: zu, auf, schnapp (nach vorn gestoßen).
# Szene je Figur wie bei den Gästen (RigCam, 240 px pro Meter). Schreibt art/render/<name>/*.png und meta.json;
# danach im Repo-Ordner:  python art/blender/cameo_post.py
import bpy, json, math, os, sys, importlib
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
sys.path.insert(0, REPO + '/art/blender')
import figur_lib
importlib.reload(figur_lib)
from figur_lib import Builder, toon


def scene(name):
    SC = bpy.data.scenes.get('Cameo3D_' + name) or bpy.data.scenes.new('Cameo3D_' + name)
    keep = ('MondH3', 'FuellH3', 'RigCam')
    for o in list(SC.collection.objects):
        if o.name in keep:
            SC.collection.objects.unlink(o)
        else:
            bpy.data.objects.remove(o, do_unlink=True)
    for n in keep:
        SC.collection.objects.link(bpy.data.objects[n])
    hel = bpy.data.scenes['Helden3D']
    SC.camera, SC.world = bpy.data.objects['RigCam'], hel.world
    r = SC.render
    r.engine = hel.render.engine
    r.resolution_x, r.resolution_y, r.resolution_percentage = 960, 840, 100
    r.film_transparent = True
    r.image_settings.file_format, r.image_settings.color_mode = 'PNG', 'RGBA'
    SC.view_settings.view_transform, SC.view_settings.look = hel.view_settings.view_transform, hel.view_settings.look
    SC.eevee.taa_render_samples = 32
    SC.camera.data.sensor_fit = 'VERTICAL'
    return SC


def build_ted(SC, B, R):
    WOOD, GOLD, TEAL, DARK = toon('C_Sarg', '#b8862e', hi=0.15), toon('C_SargGold', '#e8c048', hi=0.35), toon('C_SargTuerkis', '#2a9a9a', hi=0.1), toon('C_SargInnen', '#2a1a24', hi=0.0)
    LIN, LIND, EYE = toon('C_Binde', '#e8dcc0', hi=0.05), toon('C_BindeDunkel', '#c8b894', hi=0.0), toon('C_TedAuge', '#ffe066', hi=0.9)
    e = EYE.node_tree.nodes.get('ToonEmi')
    if e:
        e.inputs['Strength'].default_value = 2.0
    # Sarkophag: aufrecht, vorn offen (Mantel nur hinten und an den Seiten), innen dunkel, goldene Kanten; Deckel daneben
    B.cone('C_SargKasten', 0.0, 1.55, 0.36, 0.42, WOOD, R, scale=(0.55, 1.0, 1.0), seg=40, bevel=0.0, cut=(0.9, 2 * math.pi - 0.9), solid=0.03)
    B.sphere('C_SargKopf', (-0.1, 0, 1.55), (0.14, 0.42, 0.42), WOOD, R)
    B.cone('C_SargInnen', 0.04, 1.6, 0.32, 0.38, DARK, R, xy=(-0.13, 0), scale=(0.12, 1.0, 1.0), seg=32, bevel=0.0)
    for k, sg in (('L', 1), ('R', -1)):
        B.rod(f'C_SargKante{k}', (0.12, sg * 0.29, 0.0), (0.14, sg * 0.34, 1.5), 0.03, GOLD, R, seg=10)
        for i, z in enumerate((0.35, 0.8, 1.25)):
            B.sphere(f'C_SargZier{k}{i}', (0.13, sg * (0.3 + z * 0.025), z), (0.03, 0.05, 0.08), TEAL, R)
    D = B.empty('C_Deckel'); D.parent = R; D.location = (-0.05, 0.56, 0); D.rotation_euler = (0, 0, 0.6)   # lehnt seitlich hinten
    B.cone('C_DeckelBrett', 0.0, 1.55, 0.36, 0.42, WOOD, D, xy=(-0.05, 0.42), scale=(0.18, 1.0, 1.0), seg=32, bevel=0.02)
    B.sphere('C_DeckelGesicht', (0.02, 0.42, 1.62), (0.05, 0.16, 0.2), GOLD, D)
    for k, y in (('L', 0.36), ('R', 0.48)):
        B.sphere(f'C_DeckelAuge{k}', (0.06, y, 1.66), (0.02, 0.03, 0.018), TEAL, D)
    # Ted: gewickelte Mumie (Lagen aus flachen Ringen), Kopf mit Augenschlitz, ein Arm vor der Brust, ein loses Bindenende
    M = B.empty('C_Ted'); M.parent = R; M.location = (0.1, 0, 0.08)
    for i in range(16):
        z = 0.06 + i * 0.085
        rr = 0.17 + 0.03 * math.sin(i / 15 * math.pi) - (0.03 if i < 3 else 0)
        B.torus(f'C_Lage{i}', (0, 0, z), rr, 0.045, LIN if i % 2 else LIND, M, scale=(0.75, 1.0, 1.0), rot=(0.08 * (1 if i % 2 else -1), 0, 0), seg=28, sseg=8)
    B.cone('C_TedRumpf', 0.02, 1.38, 0.15, 0.17, LIN, M, scale=(0.75, 1.0, 1.0), seg=24, bevel=0.0)
    B.sphere('C_TedKopf', (0.0, 0, 1.52), (0.13, 0.13, 0.16), LIN, M)
    for i, z in enumerate((1.44, 1.52, 1.6)):
        B.torus(f'C_KopfLage{i}', (0, 0, z), 0.12, 0.03, LIND, M, rot=(0.15 * (i - 1), 0.1, 0), seg=24, sseg=6)
    B.sphere('C_Augenschlitz', (0.12, 0, 1.55), (0.02, 0.09, 0.015), DARK, M)
    B.sphere('C_TedAugeAuf', (0.125, -0.04, 1.55), (0.012, 0.022, 0.016), EYE, M)
    # Arme: der linke vor der Brust verschränkt, der rechte kann winken (Gelenk an der Schulter)
    B.rod('C_ArmL', (0.05, 0.16, 1.25), (0.15, -0.05, 1.05), 0.055, LIN, M, seg=12)
    S = B.empty('C_SchulterR'); S.parent = M; S.location = (0.02, -0.18, 1.28)
    B.rod('C_ArmR', (0, 0, 0), (0.12, 0.02, -0.38), 0.055, LIN, S, seg=12)
    B.sphere('C_HandR', (0.13, 0.02, -0.42), (0.06, 0.05, 0.06), LIND, S)
    B.rod('C_LoseBinde0', (0.1, -0.14, 0.95), (0.22, -0.2, 0.78), 0.02, LIN, M, seg=8)
    B.rod('C_LoseBinde1', (0.22, -0.2, 0.78), (0.24, -0.16, 0.6), 0.018, LIN, M, seg=8)
    return dict(frames=[('idle', {}), ('auge', {'auge': 1}), ('wink', {'wink': 1, 'auge': 1})], top=1.9)


def pose_ted(p):
    OB = bpy.data.objects
    for o in OB['C_Deckel'].children:   # im Labor steht rechts das Chrono-Klo: der Deckel bleibt weg
        o.hide_render = True
    OB['C_TedAugeAuf'].hide_render = not p.get('auge')
    OB['C_SchulterR'].rotation_euler = (-2.3, 0.4, 0) if p.get('wink') else (0, 0, 0)


def build_pflanze(SC, B, R):
    POT, POTD, SOIL = toon('C_Topf', '#c8643a', hi=0.1), toon('C_TopfRand', '#a84a2a', hi=0.1), toon('C_Erde', '#4a3020', hi=0.0)
    STEM, LEAF, LEAFD = toon('C_Stiel', '#3a8a3a', hi=0.08), toon('C_Blatt', '#4aa84a', hi=0.08), toon('C_BlattDunkel', '#2f7a34', hi=0.05)
    JAW, INNER, TEETH, TONGUE = toon('C_Kiefer', '#5ab84a', hi=0.12), toon('C_Rachen', '#c8243a', hi=0.25), toon('C_Zahn', '#f8f4e8', hi=0.3), toon('C_Zunge', '#e85a7a', hi=0.3)
    SPOT = toon('C_Tupfen', '#a8d84a', hi=0.05)
    B.cone('C_Topf', 0.0, 0.62, 0.36, 0.48, POT, R, seg=40, bevel=0.03)
    B.torus('C_TopfRand', (0, 0, 0.62), 0.5, 0.06, POTD, R, seg=40, sseg=8)
    B.cone('C_Erde', 0.56, 0.6, 0.45, 0.45, SOIL, R, seg=40, bevel=0.0)
    for i in range(6):   # große, gezackte Blätter am Fuß
        a = i * math.pi / 3 + 0.3
        L = B.empty(f'C_BlattRoot{i}'); L.parent = R; L.location = (math.cos(a) * 0.2, math.sin(a) * 0.2, 0.6); L.rotation_euler = (0, 0.95, a)
        B.sphere(f'C_Blatt{i}', (0.0, 0, 0.32), (0.07, 0.17, 0.36), LEAF if i % 2 else LEAFD, L)
    K = B.empty('C_Kopf'); K.parent = R
    # dicker Stiel in S-Form bis zum Kopf
    B.rod('C_Stiel0', (0, 0, 0.58), (0.06, 0, 1.15), 0.11, STEM, R, r1=0.1, seg=20)
    B.rod('C_Stiel1', (0.06, 0, 1.15), (0.0, 0, 1.6), 0.1, STEM, R, r1=0.09, seg=20)
    B.sphere('C_StielKnie', (0.06, 0, 1.15), (0.105, 0.105, 0.105), STEM, R)
    K.location = (0.0, 0, 1.62)
    # Kiefer: Unter- und Oberkiefer als Halbschalen, innen rot, Zahnreihen, Zunge; Gelenk hinten am Kopf
    O = B.empty('C_Oberkiefer'); O.parent = K; O.location = (-0.12, 0, 0.1)
    U = B.empty('C_Unterkiefer'); U.parent = K; U.location = (-0.12, 0, 0.0)
    B.sphere('C_Gelenk', (-0.1, 0, 0.05), (0.16, 0.2, 0.17), JAW, K)   # Kiefergelenk hinten: hält beide Hälften zusammen
    B.sphere('C_KieferOben', (0.3, 0, 0.06), (0.36, 0.3, 0.2), JAW, O)
    B.sphere('C_RachenOben', (0.32, 0, 0.0), (0.32, 0.25, 0.07), INNER, O)
    B.sphere('C_KieferUnten', (0.28, 0, -0.08), (0.33, 0.28, 0.17), JAW, U)
    B.sphere('C_RachenUnten', (0.3, 0, 0.0), (0.29, 0.23, 0.06), INNER, U)
    B.sphere('C_Zunge', (0.3, 0, 0.03), (0.18, 0.1, 0.04), TONGUE, U)
    for i in range(7):   # Zähne entlang der Kieferränder
        a = -1.25 + i * 2.5 / 6
        x, y = 0.3 + math.cos(a) * 0.3, math.sin(a) * 0.25
        B.cone(f'C_ZahnO{i}', -0.07, 0.0, 0.0, 0.03, TEETH, O, xy=(x, y), seg=10, bevel=0.0)
        B.cone(f'C_ZahnU{i}', 0.0, 0.07, 0.03, 0.0, TEETH, U, xy=(x - 0.02, y * 0.95), seg=10, bevel=0.0)
    for i, (x, y, z) in enumerate(((0.25, 0.2, 0.18), (0.45, -0.15, 0.16), (0.12, -0.22, 0.12), (0.4, 0.18, 0.1))):
        B.sphere(f'C_Tupfen{i}', (x, y, z), (0.04, 0.04, 0.02), SPOT, O)
    return dict(frames=[('zu', {}), ('auf', {'auf': 1}), ('schnapp', {'schnapp': 1})], top=2.1)


def pose_pflanze(p):
    OB = bpy.data.objects
    a = 0.42 if p.get('auf') else 0.0
    OB['C_Oberkiefer'].rotation_euler = (0, -a, 0)
    OB['C_Unterkiefer'].rotation_euler = (0, a * 0.6, 0)
    OB['C_Kopf'].location = (0.08, 0, 1.6) if p.get('schnapp') else (0.0, 0, 1.62)
    OB['C_Kopf'].rotation_euler = (0, 0.35, 0) if p.get('schnapp') else (0, 0, 0)


# ---------- Drei neue Cameos (Konferenzsaal, Labor, Zukunftsgarten) ----------
def kasten(B, name, loc, size, mat, parent, bevel=0.0):
    """Quader (Voxel-Look), Größe über die Skalierung."""
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    return B.obj(name, bm, mat, parent, loc, scale=size, smooth=False, bevel=bevel)


def drahtweg(name, pts, r, mat, parent, SC):
    """Gebogener Draht als Kurve durch die Punkte (Büroklammer)."""
    cd = bpy.data.curves.get(name) or bpy.data.curves.new(name, 'CURVE')
    cd.splines.clear()
    cd.dimensions, cd.bevel_depth, cd.bevel_resolution, cd.use_fill_caps = '3D', r, 6, True
    sp = cd.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for q, co in zip(sp.points, pts):
        q.co = (*co, 1)
    cd.materials.clear()
    cd.materials.append(mat)
    o = bpy.data.objects.new(name, cd)
    SC.collection.objects.link(o)
    o.parent = parent
    return o


def build_klammer(SC, B, R):
    """Karl Klammer: eine silberne Büroklammer (Doppelschleife, aufrecht, leicht gebogen) mit Glupschaugen und dicken
    Augenbrauen, die auf einem gelben Notizblatt steht. Bilder: idle, brauen (Brauen hoch: „Brauchen Sie Hilfe?“), blick."""
    WIRE, WHITE, BLACK = toon('C_Draht', '#c8ced8', hi=0.9), toon('C_AugeWeiss', '#ffffff', hi=0.6), toon('N_Schwarz', '#16121e', hi=0.15)
    PAPER, LINE = toon('C_Notiz', '#fff2a8', hi=0.1), toon('C_NotizLinie', '#8ab4e8', hi=0.0)
    # Notizblatt mit Linien
    kasten(B, 'C_Blatt', (0, 0, 0.006), (0.6, 0.44, 0.012), PAPER, R)
    for i in range(5):
        B.rod(f'C_BlattLinie{i}', (-0.26, -0.16 + i * 0.08, 0.014), (0.26, -0.16 + i * 0.08, 0.014), 0.004, LINE, R, seg=4)
    # Gem-Klammer in der x-z-Ebene: innere Schleife oben, Bogen unten, äußere Schleife oben, offenes Ende
    def bogen(cx, cz, rr, a0, a1, n=16):
        return [(cx + rr * math.cos(a0 + (a1 - a0) * i / n), 0.0, cz + rr * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]
    pts = [(0.03, 0, 0.36)] + bogen(-0.005, 0.65, 0.035, 0.0, math.pi) + bogen(0.025, 0.16, 0.065, math.pi, 2 * math.pi) + bogen(0.0, 0.72, 0.09, 0.0, math.pi) + [(-0.09, 0, 0.3)]
    W = B.empty('C_KlammerWurzel'); W.parent = R; W.location = (0, 0, -0.075); W.rotation_euler = (0.0, -0.1, 0)
    drahtweg('C_KlammerDraht', pts, 0.016, WIRE, W, SC)
    # Augen (über der unteren Schleife), Pupillen, Brauen (Wurzel zum Heben)
    for k, x in (('L', -0.065), ('R', 0.075)):
        B.sphere(f'C_KAuge{k}', (x, -0.06, 0.6), (0.06, 0.04, 0.075), WHITE, W)
        B.sphere(f'C_KPupille{k}', (x + 0.01, -0.1, 0.59), (0.025, 0.015, 0.03), BLACK, W)
        BR = B.empty(f'C_KBraueWurzel{k}'); BR.parent = W; BR.location = (x, -0.08, 0.7)
        B.rod(f'C_KBraue{k}', (-0.05, 0, -0.005 if k == 'L' else 0.012), (0.05, 0, 0.012 if k == 'L' else -0.005), 0.016, BLACK, BR, seg=8)
    return dict(frames=[('idle', {}), ('brauen', {'brauen': 1}), ('blick', {'blick': 1})], top=0.85)


def pose_klammer(p):
    OB = bpy.data.objects
    for k in 'LR':
        OB[f'C_KBraueWurzel{k}'].location.z = 0.76 if p.get('brauen') else 0.7
        OB[f'C_KBraueWurzel{k}'].rotation_euler = (0, (0.25 if k == 'L' else -0.25) if p.get('brauen') else 0, 0)
        OB[f'C_KAuge{k}'].scale = (0.06, 0.04, 0.09) if p.get('brauen') else (0.06, 0.04, 0.075)
        OB[f'C_KPupille{k}'].location = ((-0.065 if k == 'L' else 0.075) + (0.03 if p.get('blick') else 0.01), -0.1, 0.59 if not p.get('brauen') else 0.6)


def build_clawd(SC, B, R):
    """Clawd, das kleine Maskottchen von Claude Code, als Voxel-Figur: terrakotta-oranger Klotz mit zwei schwarzen
    Augen-Balken, Stummelärmchen an den Seiten und vier Beinchen. Bilder: idle, blinzel, hops (Ärmchen hoch, springt)."""
    ORANGE, ORANGED, BLACK = toon('C_Clawd', '#d97757', hi=0.12), toon('C_ClawdDunkel', '#b85c3e', hi=0.08), toon('N_Schwarz', '#16121e', hi=0.15)
    K = B.empty('C_ClawdKoerper'); K.parent = R
    kasten(B, 'C_ClawdRumpf', (0, 0, 0.31), (0.5, 0.3, 0.36), ORANGE, K, bevel=0.012)
    for k, sx in (('L', -1), ('R', 1)):
        kasten(B, f'C_ClawdAuge{k}', (sx * 0.1, -0.152, 0.34), (0.05, 0.012, 0.11), BLACK, K)
        A = B.empty(f'C_ClawdArm{k}'); A.parent = K; A.location = (sx * 0.25, 0, 0.3)
        kasten(B, f'C_ClawdArmKlotz{k}', (sx * 0.05, 0, 0), (0.1, 0.13, 0.1), ORANGE, A, bevel=0.008)
    for i, x in enumerate((-0.17, -0.06, 0.06, 0.17)):
        kasten(B, f'C_ClawdBein{i}', (x, -0.02, 0.07), (0.06, 0.09, 0.14), ORANGED, K, bevel=0.005)
    return dict(frames=[('idle', {}), ('blinzel', {'blinzel': 1}), ('hops', {'hops': 1})], top=0.5)


def pose_clawd(p):
    OB = bpy.data.objects
    for k in 'LR':
        OB[f'C_ClawdAuge{k}'].scale = (0.05, 0.012, 0.025 if p.get('blinzel') else 0.11)
        OB[f'C_ClawdArm{k}'].rotation_euler = (0, (-0.9 if k == 'R' else 0.9) if p.get('hops') else 0, 0)
    OB['C_ClawdKoerper'].location.z = 0.09 if p.get('hops') else 0.0


def build_roboter(SC, B, R):
    """Humanoider Roboter im Stil des Unitree G1 (gut 1,3 m): dunkles Gestell, helle Verkleidungen an Brust, Oberarmen und
    Oberschenkeln, runder Kopf mit dunklem Visier und blauem Lichtring, Kugelgelenke. Gelenk-Empties für die Posen;
    Bilder: idle, kick (Kung-Fu-Tritt zur Seite, Fäuste hoch), gruss (winkt)."""
    DARK, MID, LIGHT = toon('C_RoboDunkel', '#262a32', hi=0.4), toon('C_RoboMittel', '#4a505c', hi=0.5), toon('C_RoboHell', '#d6dae2', hi=0.5)
    VISOR, LED = toon('C_RoboVisier', '#0e1018', hi=0.9), toon('C_RoboLED', '#5fd3ff', hi=0.9)
    e = LED.node_tree.nodes.get('ToonEmi')
    if e:
        e.inputs['Strength'].default_value = 2.5
    H = B.empty('C_RoboHuefte'); H.parent = R; H.location = (0, 0, 0.66)
    # Rumpf mit Brustpanzer, Rucksack-Akku, Hals und Kopf
    T = B.empty('C_RoboRumpf'); T.parent = H
    B.sphere('C_RoboBecken', (0, 0, 0.0), (0.15, 0.1, 0.08), DARK, T)
    B.cone('C_RoboTaille', 0.02, 0.16, 0.08, 0.09, MID, T, seg=20, bevel=0.0)
    B.cone('C_RoboBrust', 0.14, 0.52, 0.14, 0.19, DARK, T, scale=(1, 0.62, 1), seg=24, bevel=0.03)
    B.sphere('C_RoboPanzer', (0, -0.085, 0.38), (0.15, 0.05, 0.12), LIGHT, T)
    B.rod('C_RoboLEDStreifen', (-0.08, -0.13, 0.27), (0.08, -0.13, 0.27), 0.008, LED, T, seg=6)
    B.sphere('C_RoboAkku', (0, 0.1, 0.32), (0.12, 0.06, 0.15), MID, T)
    B.rod('C_RoboHals', (0, 0, 0.5), (0, 0, 0.58), 0.035, MID, T, seg=12)
    K = B.empty('C_RoboKopf'); K.parent = T; K.location = (0, 0, 0.66)
    B.sphere('C_RoboSchaedel', (0, 0, 0.0), (0.11, 0.12, 0.12), LIGHT, K)
    B.sphere('C_RoboVisier', (0, -0.07, 0.0), (0.09, 0.07, 0.08), VISOR, K)
    B.torus('C_RoboRing', (0, -0.135, 0.0), 0.045, 0.008, LED, K, rot=(math.pi / 2, 0, 0), seg=24, sseg=6)
    B.sphere('C_RoboAuge', (0, -0.14, 0.0), (0.015, 0.008, 0.015), LED, K)
    # Arme: Schulterkugel, Oberarm (hell), Ellbogen, Unterarm, Hand
    for k, sx in (('L', -1), ('R', 1)):
        S = B.empty(f'C_RoboSchulter{k}'); S.parent = T; S.location = (sx * 0.23, 0, 0.42)
        B.cone(f'C_RoboSchulterKugel{k}', -0.05, 0.05, 0.065, 0.065, MID, S, rot=(0, math.pi / 2, 0), seg=24, bevel=0.01)
        B.cone(f'C_RoboSchulterDeckel{k}', -0.008, 0.008, 0.05, 0.05, LIGHT, S, rot=(0, math.pi / 2, 0), seg=24, bevel=0.0).location = (sx * 0.056, 0, 0)
        B.rod(f'C_RoboOberarm{k}', (0, 0, -0.02), (0, 0, -0.22), 0.045, LIGHT, S, seg=14)
        E = B.empty(f'C_RoboEllbogen{k}'); E.parent = S; E.location = (0, 0, -0.24)
        B.sphere(f'C_RoboEllKugel{k}', (0, 0, 0), (0.04, 0.04, 0.04), DARK, E)
        B.rod(f'C_RoboUnterarm{k}', (0, 0, -0.02), (0, 0, -0.2), 0.035, DARK, E, seg=12)
        B.sphere(f'C_RoboHand{k}', (0, 0, -0.24), (0.045, 0.035, 0.055), MID, E)
    # Beine: Hüftgelenk, Oberschenkel (hell), Knie, Unterschenkel, flacher Fuß
    for k, sx in (('L', -1), ('R', 1)):
        L = B.empty(f'C_RoboHueftGelenk{k}'); L.parent = H; L.location = (sx * 0.1, 0, -0.04)
        B.cone(f'C_RoboHueftKugel{k}', -0.06, 0.06, 0.075, 0.075, MID, L, rot=(0, math.pi / 2, 0), seg=24, bevel=0.01)
        B.rod(f'C_RoboOberschenkel{k}', (0, 0, -0.02), (0, 0, -0.27), 0.06, LIGHT, L, seg=14)
        N = B.empty(f'C_RoboKnie{k}'); N.parent = L; N.location = (0, 0, -0.29)
        B.cone(f'C_RoboKnieKugel{k}', -0.055, 0.055, 0.06, 0.06, DARK, N, rot=(0, math.pi / 2, 0), seg=24, bevel=0.01)
        B.cone(f'C_RoboKnieDeckel{k}', -0.007, 0.007, 0.045, 0.045, LIGHT, N, rot=(0, math.pi / 2, 0), seg=20, bevel=0.0).location = (sx * 0.06, 0, 0)
        B.rod(f'C_RoboUnterschenkel{k}', (0, 0, -0.02), (0, 0, -0.27), 0.042, DARK, N, seg=12)
        B.cone(f'C_RoboFuss{k}', -0.33, -0.29, 0.065, 0.055, MID, N, xy=(0, -0.05), scale=(0.85, 2.0, 1), seg=16, bevel=0.01)
    return dict(frames=[('idle', {}), ('kick', {'kick': 1}), ('gruss', {'gruss': 1})], top=1.36)


def pose_roboter(p):
    OB = bpy.data.objects
    for n in ('C_RoboSchulterL', 'C_RoboSchulterR', 'C_RoboEllbogenL', 'C_RoboEllbogenR', 'C_RoboHueftGelenkL', 'C_RoboHueftGelenkR', 'C_RoboKnieL', 'C_RoboKnieR', 'C_RoboRumpf', 'C_RoboKopf'):
        OB[n].rotation_euler = (0, 0, 0)
    OB['C_RoboHuefte'].location = (0, 0, 0.66)
    if p.get('kick'):   # Seitwärtstritt nach rechts, Standbein leicht gebeugt, Fäuste in Deckung, Oberkörper kippt weg
        OB['C_RoboHueftGelenkR'].rotation_euler = (0, -1.45, 0)
        OB['C_RoboKnieR'].rotation_euler = (0, 0.25, 0)
        OB['C_RoboHueftGelenkL'].rotation_euler = (0, 0.12, 0)
        OB['C_RoboKnieL'].rotation_euler = (-0.25, 0, 0)
        OB['C_RoboHuefte'].location = (0, 0, 0.63)
        OB['C_RoboRumpf'].rotation_euler = (0, 0.3, 0)
        OB['C_RoboKopf'].rotation_euler = (0, -0.3, 0)
        for k, sx in (('L', -1), ('R', 1)):
            OB[f'C_RoboSchulter{k}'].rotation_euler = (-1.1, sx * 0.3, 0)
            OB[f'C_RoboEllbogen{k}'].rotation_euler = (-1.6, 0, 0)
    if p.get('gruss'):
        OB['C_RoboSchulterR'].rotation_euler = (0, -2.6, 0)
        OB['C_RoboEllbogenR'].rotation_euler = (0, -0.5, 0)
        OB['C_RoboKopf'].rotation_euler = (0, 0.15, 0.2)


WHAT = {'ted': (build_ted, pose_ted, -1.25), 'pflanze': (build_pflanze, pose_pflanze, -0.45),
        'klammer': (build_klammer, pose_klammer, 0.35), 'clawd': (build_clawd, pose_clawd, 0.3), 'roboter': (build_roboter, pose_roboter, 0.35)}   # Ted: offene Seite zur Kamera
for name in globals().get('WHO') or list(WHAT):
    build, pose, yaw = WHAT[name]
    SC = scene(name)
    B = Builder(SC)
    R = B.empty('C_Root_' + name)
    R.rotation_euler = (0, 0, yaw)
    info = build(SC, B, R)
    win = bpy.context.window
    prev = win.scene
    win.scene = SC
    cam = SC.camera
    W, H = SC.render.resolution_x, SC.render.resolution_y
    out = REPO + f'/art/render/{name}/'
    os.makedirs(out, exist_ok=True)
    meta = {'ppm': H / cam.data.ortho_scale, 'top': info['top'], 'frames': []}
    only = globals().get('FRAMES')
    if only and os.path.exists(out + 'meta.json'):
        meta['frames'] = [f for f in json.load(open(out + 'meta.json'))['frames'] if f['name'] not in only]
    try:
        for fn, p in info['frames']:
            if only and fn not in only:
                continue
            pose(p)
            bpy.context.view_layer.update()
            q = world_to_camera_view(SC, cam, R.matrix_world.translation)
            meta['frames'].append({'name': fn, 'foot': [round(q.x * W, 1), round((1 - q.y) * H, 1)]})
            SC.render.filepath = out + fn + '.png'
            bpy.ops.render.render(write_still=True, scene=SC.name)
        pose({})
    finally:
        win.scene = prev
    order = [f[0] for f in info['frames']]
    meta['frames'].sort(key=lambda f: order.index(f['name']))
    json.dump(meta, open(out + 'meta.json', 'w'), indent=1)
    print('cameo', name, [f['name'] for f in meta['frames']])
