# Die alten, gezeichneten Räume als 3D-Hintergründe (von raum_build.py geladen, dort ROOMS3D und render()):
#   REPO = r'C:/.../Tentakel-Toast'; NAME = 'lobby'; exec(open(REPO + '/art/blender/raum_build.py').read())
# Gleiche Kamera wie die neuen 3D-Räume (Lauffläche y = 350 … 432). Damit die Spiel-Logik der alten Räume weiter passt,
# stehen die Möbel ungefähr dort, wo sie gezeichnet waren: wx()/wz()/wy() rechnen Spiel-Koordinaten in Welt-Koordinaten um.
# Zustände (Zuckerdose leer, Falltür offen, Automat mit Strom …) werden als Ausschnitte gerendert („Varianten“), bewegte Teile
# (Pendel) als eigene Bilder („Sprites“); altbau_post.py schneidet sie zu und schreibt js/altbau-daten.js.
import bpy, bmesh, json, math, os, random
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

R = None   # Helfer aus raum_build.py (box, tex_toon, toon, tube_in, sun, Builder, solve_cam, REPO)
CAM = None


def init(ns):
    global R, CAM
    R = type('Helfer', (), {})()
    for k in ('box', 'plane', 'tex_toon', 'toon', 'tube_in', 'sun', 'Builder', 'solve_cam', 'REPO'):
        setattr(R, k, ns[k])
    CAM = R.solve_cam()


# ------------------------------------------------------------------ Kamera-Umrechnung
def _basis():
    h, phi, F, d1 = CAM
    return h, phi, F, Vector((0, math.cos(phi), -math.sin(phi))), Vector((0, math.sin(phi), math.cos(phi)))


def proj(p):
    """Welt -> Spiel-Koordinaten (960 × 440)."""
    h, phi, F, fwd, up = _basis()
    rel = Vector(p) - Vector((0, 0, h))
    z = rel.dot(fwd)
    return 480 + 220 * F * rel.x / z, 220 - 220 * F * rel.dot(up) / z


def wx(gx, y, z=0.0):
    """Welt-x, das bei Tiefe y und Höhe z an Spiel-x gx erscheint."""
    h, phi, F, fwd, up = _basis()
    return (gx - 480) / 220 * (y * fwd.y + (z - h) * fwd.z) / F


def wz(gy, y):
    """Höhe z, die bei Tiefe y an Spiel-y gy erscheint."""
    h, phi, F, fwd, up = _basis()
    v = (220 - gy) / 220
    return h + y * (v * math.cos(phi) - F * math.sin(phi)) / (F * math.cos(phi) + v * math.sin(phi))


def wy(gy, z=0.0):
    """Tiefe y eines Punkts in Höhe z, der an Spiel-y gy erscheint (Boden: z = 0)."""
    h, phi, F, fwd, up = _basis()
    v = (220 - gy) / 220
    t = (z - h) / (-F * math.sin(phi) + v * math.cos(phi))
    return t * (F * math.cos(phi) + v * math.sin(phi))


# ------------------------------------------------------------------ Bausteine
def matt(m):
    """Glanzzweig des Toon-Shaders aus: er gibt sonst weiche weiße Flecken (Lampen-Spiegelungen) auf großen Flächen."""
    m.node_tree.nodes['ToonEmi2'].inputs['Strength'].default_value = 0.0
    return m


def glow(m, s):
    """Toon-Material leuchtet selbst (Lampen, Flammen, Displays)."""
    e = m.node_tree.nodes.get('ToonEmi')
    if e:
        e.inputs['Strength'].default_value = s
    return m


def unlit(name, file, strength=1.0):
    """Bild ohne Licht (Nachthimmel hinter dem Fenster, Milchglas)."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out, em = nt.nodes.new('ShaderNodeOutputMaterial'), nt.nodes.new('ShaderNodeEmission')
    tc, img = nt.nodes.new('ShaderNodeTexCoord'), nt.nodes.new('ShaderNodeTexImage')
    img.image = bpy.data.images.load(R.REPO + '/art/textures/' + file, check_existing=True)
    img.image.reload()
    nt.links.new(tc.outputs['UV'], img.inputs['Vector'])
    nt.links.new(img.outputs['Color'], em.inputs['Color'])
    em.inputs['Strength'].default_value = strength
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    return m


def quad(B, name, w, h, mat, loc, parent=None, rot=(0, 0, 0)):
    """Rechteck in der x-z-Ebene (schaut nach −y, zur Kamera) mit UV 0..1."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    vs = [bm.verts.new((x, 0, z)) for x, z in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2))]
    f = bm.faces.new(vs)
    for l, c in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        l[uv].uv = c
    return B.obj(name, bm, mat, parent, loc, rot, smooth=False)


def scheibe(B, name, r, mat, loc, parent=None, seg=48, rot=(0, 0, 0)):
    """Kreisscheibe in der x-z-Ebene mit UV (Zifferblatt)."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    vs = [bm.verts.new((math.cos(a) * r, 0, math.sin(a) * r)) for a in (2 * math.pi * i / seg for i in range(seg))]
    f = bm.faces.new(vs)
    if f.normal.y > 0:
        f.normal_flip()
    for l in f.loops:
        l[uv].uv = (l.vert.co.x / r * 0.5 + 0.5, l.vert.co.z / r * 0.5 + 0.5)
    return B.obj(name, bm, mat, parent, loc, rot, smooth=False)


def flaeche(B, name, ebene, a0, a1, b0, b1, holes, mat, loc, thick):
    """Wand (ebene='xz', Vorderseite schaut nach −y) oder Boden (ebene='xy') mit rechteckigen Öffnungen, als ein Netz:
    so zeichnet Freestyle keine Kanten zwischen den Teilstücken, nur an den Öffnungen."""
    As = sorted({a0, a1, *[q[0] for q in holes], *[q[1] for q in holes]})
    Bs = sorted({b0, b1, *[q[2] for q in holes], *[q[3] for q in holes]})
    bm = bmesh.new()
    vid = {}

    def V(a, b):
        k = (round(a, 4), round(b, 4))
        if k not in vid:
            vid[k] = bm.verts.new((a, 0, b) if ebene == 'xz' else (a, b, 0))
        return vid[k]
    for i in range(len(As) - 1):
        for j in range(len(Bs) - 1):
            ca, cb = (As[i] + As[i + 1]) / 2, (Bs[j] + Bs[j + 1]) / 2
            if any(q[0] < ca < q[1] and q[2] < cb < q[3] for q in holes):
                continue
            f = bm.faces.new((V(As[i], Bs[j]), V(As[i + 1], Bs[j]), V(As[i + 1], Bs[j + 1]), V(As[i], Bs[j + 1])))
            if ebene == 'xy' and f.normal.z < 0:
                f.normal_flip()
    return B.obj(name, bm, mat, None, loc, smooth=False, solid=thick)


def ringloch(B, name, r, hx, hy, mat, loc, thick, seg=96):
    """Runde Scheibe (Teppich) mit rechteckigem Loch in der Mitte: Strahlen vom Mittelpunkt, innen auf dem Rechteck, außen auf dem Kreis."""
    angs = sorted({2 * math.pi * i / seg for i in range(seg)} | {math.atan2(sy * hy, sx * hx) % (2 * math.pi) for sx in (-1, 1) for sy in (-1, 1)})
    bm = bmesh.new()
    inner, outer = [], []
    for a in angs:
        c, s = math.cos(a), math.sin(a)
        t = min(hx / abs(c) if abs(c) > 1e-9 else 1e9, hy / abs(s) if abs(s) > 1e-9 else 1e9)
        inner.append(bm.verts.new((c * t, s * t, 0)))
        outer.append(bm.verts.new((c * r, s * r, 0)))
    n = len(angs)
    for i in range(n):
        f = bm.faces.new((inner[i], outer[i], outer[(i + 1) % n], inner[(i + 1) % n]))
        if f.normal.z < 0:
            f.normal_flip()
    return B.obj(name, bm, mat, None, loc, smooth=False, solid=thick)


def ohne_kontur(*objs):
    """Kleinteile (Schrift, Fransen, Kristalle) ohne Freestyle-Linie: sonst werden sie zu dunklen Klecksen."""
    nk = bpy.data.collections.get('Ohne_Kontur') or bpy.data.collections.new('Ohne_Kontur')
    for o in objs:
        if o.name not in nk.objects:
            nk.objects.link(o)
    return objs[0] if len(objs) == 1 else objs


def text(SC, name, body, size, mat, loc, font=None, rot=(math.pi / 2, 0, 0), extrude=0.01, align='CENTER', parent=None, spacing=1.0):
    """Schrift ohne Freestyle-Kontur (mit Linie wird sie unlesbar); die Materialien leuchten leicht, damit sie auch im Halbdunkel lesbar bleibt."""
    cd = bpy.data.curves.get(name) or bpy.data.curves.new(name, 'FONT')
    cd.body, cd.size, cd.align_x, cd.align_y, cd.extrude = body, size, align, 'CENTER', extrude
    cd.space_character = spacing
    if font:
        cd.font = bpy.data.fonts.load(font, check_existing=True)
    cd.materials.clear()
    cd.materials.append(mat)
    o = bpy.data.objects.new(name, cd)
    SC.collection.objects.link(o)
    o.parent = parent
    o.location, o.rotation_euler = loc, rot
    return ohne_kontur(o)


def lamp(SC, name, loc, energy, col, size=0.1, dist=None, kind='POINT', rot=None):
    ld = bpy.data.lights.new(name, kind)
    ld.energy, ld.color = energy, col
    if kind in ('POINT', 'SPOT'):
        ld.shadow_soft_size = size
    if dist:
        ld.use_custom_distance, ld.cutoff_distance = True, dist
    o = bpy.data.objects.new(name, ld)
    SC.collection.objects.link(o)
    o.location = loc
    if rot:
        o.rotation_euler = rot
    return o


def vorhang(B, name, xa, xb, z0, z1, y, aussen, mat, falten=7, tief=0.09):
    """Samtvorhang mit Falten, auf Höhe des Raffhalters zur Außenseite (aussen = −1 links, +1 rechts) zusammengerafft."""
    nx, nz = 28, 24
    bm = bmesh.new()
    rows = []
    zt = z0 + (z1 - z0) * 0.38   # Raffhalter
    for j in range(nz + 1):
        z = z0 + (z1 - z0) * j / nz
        if z >= zt:   # oben volle Breite, zum Raffhalter hin zusammengezogen
            g = 1 - 0.55 * (1 - (z - zt) / (z1 - zt)) ** 1.6
        else:
            g = 0.45 + 0.4 * ((zt - z) / (zt - z0)) ** 1.4
        row = []
        for i in range(nx + 1):
            u = i / nx
            ux = u * g if aussen < 0 else 1 - (1 - u) * g
            x = xa + (xb - xa) * ux
            yy = y - tief * (0.5 + 0.5 * math.sin(u * falten * 2 * math.pi)) * (1.4 - 0.4 * g)
            row.append(bm.verts.new((x, yy, z)))
        rows.append(row)
    for j in range(nz):
        for i in range(nx):
            bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.y > 0:
            f.normal_flip()
    return B.obj(name, bm, mat, None, (0, 0, 0), smooth=True, solid=0.02)


def leuchter(SC, B, tube, name, x, y, ztop, zb, arme, mats):
    """Kronleuchter: Messingstange von der Decke, Kugelkörper, geschwungene Arme mit Kerzen und Kristalltropfen."""
    BRASS, CANDLE, FLAME, CRYSTAL = mats
    B.rod(name + 'Stange', (x, y, ztop), (x, y, zb + 0.28), 0.025, BRASS, None, seg=10)
    B.sphere(name + 'Koerper', (x, y, zb + 0.18), (0.16, 0.16, 0.2), BRASS, None)
    B.cone(name + 'Spitze', zb - 0.12, zb + 0.02, 0.01, 0.07, BRASS, None, xy=(x, y), seg=16, bevel=0)
    B.torus(name + 'Ring', (x, y, zb + 0.2), 0.62, 0.018, BRASS, None, seg=48, sseg=6, scale=(1, 1, 1))
    for i in range(arme):
        a = 2 * math.pi * (i + 0.5) / arme
        ca, sa = math.cos(a), math.sin(a)
        r = 0.62
        tube(f'{name}Arm{i}', [(x + ca * 0.1, y + sa * 0.1, zb + 0.14), (x + ca * 0.38, y + sa * 0.38, zb - 0.04), (x + ca * r, y + sa * r, zb + 0.12)], 0.016, BRASS, None)
        cx, cy, cz = x + ca * r, y + sa * r, zb + 0.14
        B.cone(f'{name}Tuelle{i}', cz - 0.03, cz + 0.03, 0.035, 0.055, BRASS, None, xy=(cx, cy), seg=16, bevel=0)
        B.cone(f'{name}Kerze{i}', cz + 0.03, cz + 0.2, 0.022, 0.022, CANDLE, None, xy=(cx, cy), seg=12, bevel=0)
        ohne_kontur(B.sphere(f'{name}Flamme{i}', (cx, cy, cz + 0.24), (0.018, 0.018, 0.04), FLAME, None))
        for k in range(2):
            b = a + (k - 0.5) * 0.45
            ohne_kontur(B.sphere(f'{name}Tropfen{i}{k}', (x + math.cos(b) * 0.6, y + math.sin(b) * 0.6, zb + 0.1 - k * 0.06), (0.022, 0.022, 0.045), CRYSTAL, None))


def standuhr(SC, B, name, x, y, alt, mats, lean=0.0):
    """Standuhr (in der Lobby schief und alt, im Gasthaus 1776 neu): Sockel, Kasten mit Pendelfenster, Haube mit Zifferblatt,
    gesprengter Giebel. Gibt (Wurzel, Pendelfenster-Objekt, Pendel-Wurzel) zurück; das Pendel rendert render() als Sprite."""
    WOOD, WOODD, BRASS, DARK, FACE = mats
    U = B.empty(name)
    U.location, U.rotation_euler = (x, y, 0), (0, lean, 0)
    R.box(B, name + 'Sockel', (0, 0, 0.2), (0.78, 0.5, 0.36), WOODD, U, bevel=0.03)
    for sx in (-1, 1):
        B.sphere(f'{name}Fuss{sx}', (sx * 0.3, -0.16, 0.03), (0.07, 0.07, 0.05), WOODD, U)
    R.box(B, name + 'Kasten', (0, 0.02, 1.1), (0.6, 0.42, 1.46), WOOD, U, bevel=0.02)
    R.box(B, name + 'Leiste', (0, 0, 1.86), (0.7, 0.48, 0.08), WOODD, U, bevel=0.015)
    # Pendelfenster: dunkles Inneres, Messingrahmen
    fen = R.box(B, name + 'Fenster', (0, -0.215, 1.12), (0.34, 0.02, 0.86), DARK, U, bevel=0)
    for k, (dx, dz, sx, sz) in enumerate(((0, 0.44, 0.4, 0.04), (0, -0.44, 0.4, 0.04), (-0.19, 0, 0.04, 0.9), (0.19, 0, 0.04, 0.9))):
        R.box(B, f'{name}Rahmen{k}', (dx, -0.225, 1.12 + dz), (sx, 0.03, sz), BRASS if not alt else WOODD, U, bevel=0.005)
    R.box(B, name + 'Haube', (0, 0, 2.27), (0.74, 0.5, 0.74), WOOD, U, bevel=0.02)
    scheibe(B, name + 'Blatt', 0.27, FACE, (0, -0.255, 2.27), U)
    B.torus(name + 'BlattRing', (0, -0.25, 2.27), 0.285, 0.018, BRASS, U, rot=(math.pi / 2, 0, 0), seg=40, sseg=6)
    for sx in (-1, 1):   # Säulchen neben dem Zifferblatt
        B.cone(f'{name}Saeule{sx}', 1.93, 2.62, 0.035, 0.035, WOODD, U, xy=(sx * 0.33, -0.22), seg=12, bevel=0)
        R.box(B, f'{name}Giebel{sx}', (sx * 0.2, 0, 2.74), (0.42, 0.52, 0.09), WOODD, U, rot=(0, -sx * 0.42, 0), bevel=0.01)
    B.sphere(name + 'Knauf', (0, 0, 2.86), (0.07, 0.07, 0.09), BRASS, U)
    R.box(B, name + 'Plakette', (0, -0.23, 0.52), (0.2, 0.02, 0.07), BRASS, U, bevel=0.004)
    # Pendel (eigene Wurzel, Drehpunkt oben)
    P = B.empty(name + 'Pendel')
    P.parent = U
    P.location = (0, -0.19, 1.52)
    B.rod(name + 'PendelStab', (0, 0, 0), (0, 0, -0.62), 0.012, BRASS, P, seg=8)
    B.cone(name + 'PendelScheibe', -0.03, 0.03, 0.11, 0.11, BRASS, P, xy=(0, 0), rot=(math.pi / 2, 0, 0), seg=32, bevel=0.01)
    bpy.data.objects[name + 'PendelScheibe'].location = (0, 0, -0.66)
    return U, fen, P


# ------------------------------------------------------------------ Lobby (Gegenwart)
YW = 13.2     # Vorderseite der Rückwand
ZC = 4.7      # Decke


def build_lobby(SC):
    """Eingangshalle der Edison-Villa (Motel-Rezeption): lila Rautentapete, dunkle Täfelung, Parkett, runder Teppich (darunter
    die Falltür zum Keller), Rezeption mit Schlüsselbrett, Klingel und Zuckerdose, schiefe Standuhr, Gemälde von
    Ur-Ur-Ur-Ur-Oma Gertrude, Mondfenster mit Samtvorhängen, rotes Sofa, KAFFEE-O-MAT 5000 und die Tür zum Labor."""
    B = R.Builder(SC)
    tube = R.tube_in(SC)

    def toon(name, col, hi=None):   # Toon wie in raum_build, aber ohne Glanz bei matten Stoffen (hi ≤ 0,1)
        m = R.toon(name, col, hi=hi)
        m.node_tree.nodes['ToonEmi2'].inputs['Strength'].default_value = 0.0 if hi is not None and hi <= 0.1 else 1.0
        return m

    def tex(name, file, scale=0.35, uv=False, hi=None, rot=0.0):
        m = R.tex_toon(name, file, scale, uv=uv, hi=hi, rot=rot)
        m.node_tree.nodes['ToonEmi2'].inputs['Strength'].default_value = 0.0 if hi is not None and hi <= 0.1 else 1.0
        return m
    WALLP = tex('L_Tapete', 'tapete_lila.png', 0.55, hi=0.0)
    PANEL, PANELD, GOLD = toon('L_Taefel', '#4a2a70', hi=0.1), toon('L_TaefelDunkel', '#38205a', hi=0.05), toon('L_Gold', '#e2b85c', hi=0.6)
    FLOOR = tex('L_Parkett', 'parkett.png', 0.42, rot=math.pi / 2, hi=0.0)   # ganz matt (siehe matt())
    WOOD, WOODD, WOODL = tex('L_Moebel', 'holz_moebel.png', 0.9, hi=0.2), toon('L_HolzDunkel', '#4a2814', hi=0.1), toon('L_HolzHell', '#b0602e', hi=0.35)
    CEIL, BRASS, DARK = toon('L_Decke', '#2e1848', hi=0.0), toon('L_Messing', '#d8a83c', hi=0.75), toon('L_Dunkel', '#160c12', hi=0.05)
    RUG, RUGD, CREAM = toon('L_Teppich', '#a3223b', hi=0.0), toon('L_TeppichDunkel', '#7a1428', hi=0.0), toon('L_Creme', '#f2e6c0', hi=0.2)
    SOFA, SOFAL = toon('L_Sofa', '#c9563f', hi=0.15), toon('L_SofaHell', '#d8684e', hi=0.2)
    RED, YEL, WHITE, BLACK = toon('L_Rot', '#d23c2c', hi=0.45), toon('L_Gelb', '#ffd23a', hi=0.4), toon('L_Weiss', '#f4efe6', hi=0.5), toon('N_Schwarz', '#16121e', hi=0.15)
    VELVET, CANDLE = toon('L_Samt', '#a3223b', hi=0.25), toon('L_Kerze', '#fff4dc', hi=0.3)
    FLAME, BULB = glow(toon('L_Flamme', '#ffd27a', hi=0.95), 3.0), glow(toon('L_Birne', '#ffe8b0', hi=0.95), 2.4)
    CRYSTAL, SHADE = toon('L_Kristall', '#dff0ff', hi=0.95), glow(toon('L_Schirm', '#f6e2b8', hi=0.4), 1.3)
    GREEN = glow(toon('L_Lampengruen', '#2f8a4a', hi=0.8), 0.6)
    FACE = tex('L_Zifferblatt', 'zifferblatt.png', uv=True, hi=0.3)
    PAINT = tex('L_Gemaelde', 'gemaelde_gertrude.png', uv=True, hi=0.15)
    SKY, LABGLAS = unlit('L_Nachthimmel', 'nachthimmel.png', 1.0), unlit('L_Laborglas', 'labor_glas.png', 1.25)
    SERIF, BLACKF = 'C:/Windows/Fonts/georgiab.ttf', 'C:/Windows/Fonts/ariblk.ttf'

    # --- Maße der Wandöffnungen (aus den gezeichneten Positionen) ---
    win_x0, win_x1 = wx(570, YW), wx(654, YW)
    win_z0, win_z1 = 2.62, 4.02
    door_x0, door_x1 = wx(845, YW), wx(928, YW)
    door_z1 = 2.75
    # Rückwand mit Fenster- und Türöffnung, Seitenwände knapp außerhalb des Bildes
    flaeche(B, 'L_Wand', 'xz', -9.5, 9.5, 0, ZC + 0.2, [(win_x0, win_x1, win_z0, win_z1), (door_x0, door_x1, 0, door_z1)], WALLP, (0, YW + 0.2, 0), 0.4)
    for sx in (-1, 1):
        R.box(B, f'L_Seitenwand{sx}', (sx * 8.4, 10.0, ZC / 2), (0.4, 7.0, ZC), WALLP, bevel=0)
    # Boden mit verdeckter Falltür-Öffnung unter dem Teppich (die Öffnung braucht die Variante „falltuer“)
    rx, ry = wx(560, wy(394)), wy(394)
    hole = (rx - 0.55, rx + 0.55, ry - 0.5, ry + 0.5)
    flaeche(B, 'L_Boden', 'xy', -9.5, 9.5, 5.5, YW + 0.4, [hole], FLOOR, (0, 0, -0.06), 0.12)
    plug = R.box(B, 'L_BodenDeckel', (rx, ry, -0.06), (1.1, 1.0, 0.12), FLOOR, bevel=0)
    # Decke mit Kassetten-Balken und Goldleiste
    R.box(B, 'L_Decke', (0, 9.5, ZC + 0.1), (19, 8.4, 0.2), CEIL, bevel=0)
    for i in range(9):
        R.box(B, f'L_Deckenbalken{i}', (-8 + i * 2.0, 9.6, ZC - 0.08), (0.22, 8.0, 0.18), PANELD, bevel=0.01)
    R.box(B, 'L_Kranz', (0, YW - 0.08, ZC - 0.12), (19, 0.2, 0.24), PANELD, bevel=0.02)
    R.box(B, 'L_KranzGold', (0, YW - 0.19, ZC - 0.27), (19, 0.06, 0.06), GOLD, bevel=0.01)
    # Täfelung unten, Goldleiste, Sockelleiste – mit Lücke für die Labortür
    for k, (xa, xb) in enumerate(((-9.5, door_x0 - 0.22), (door_x1 + 0.22, 9.5))):
        cxk, wk = (xa + xb) / 2, xb - xa
        R.box(B, f'L_Taefelung{k}', (cxk, YW - 0.03, 0.6), (wk, 0.06, 1.2), PANEL, bevel=0)
        R.box(B, f'L_Brustleiste{k}', (cxk, YW - 0.08, 1.22), (wk, 0.1, 0.07), GOLD, bevel=0.01)
        R.box(B, f'L_Sockelleiste{k}', (cxk, YW - 0.08, 0.08), (wk, 0.08, 0.16), WOODD, bevel=0.01)
    for i in range(-6, 7):
        px = i * 1.45
        if door_x0 - 0.7 < px < door_x1 + 0.7:
            continue
        R.box(B, f'L_Paneel{i}', (px, YW - 0.075, 0.68), (1.1, 0.04, 0.72), PANELD, bevel=0.015)

    # --- Fenster mit Nachthimmel, Sprossen, Fensterbank, Samtvorhängen ---
    wcx, wcz = (win_x0 + win_x1) / 2, (win_z0 + win_z1) / 2
    quad(B, 'L_Himmel', 4.6, 3.2, SKY, (wcx + 0.3, YW + 2.2, wcz + 0.3))
    bpy.data.objects['L_Himmel'].visible_shadow = False
    WF = toon('L_Fensterrahmen', '#e8dcc0', hi=0.3)
    for k, (cx_, cz_, sx_, sz_) in enumerate((((win_x0 + win_x1) / 2, win_z1 + 0.09, win_x1 - win_x0 + 0.42, 0.18), ((win_x0 + win_x1) / 2, win_z0 - 0.06, win_x1 - win_x0 + 0.5, 0.12),
                                                (win_x0 - 0.12, wcz, 0.24, win_z1 - win_z0 + 0.3), (win_x1 + 0.12, wcz, 0.24, win_z1 - win_z0 + 0.3))):
        R.box(B, f'L_Fensterrahmen{k}', (cx_, YW - 0.05, cz_), (sx_, 0.12, sz_), WF, bevel=0.015)
    R.box(B, 'L_Fensterbank', (wcx, YW - 0.12, win_z0 - 0.14), (win_x1 - win_x0 + 0.6, 0.3, 0.06), WF, bevel=0.01)
    R.box(B, 'L_SprosseV', (wcx, YW + 0.2, wcz), (0.06, 0.06, win_z1 - win_z0), WF, bevel=0)
    R.box(B, 'L_SprosseH', (wcx, YW + 0.2, wcz + 0.05), (win_x1 - win_x0, 0.06, 0.06), WF, bevel=0)
    vorhang(B, 'L_VorhangL', win_x0 - 0.62, win_x0 + 0.2, win_z0 - 0.55, win_z1 + 0.38, YW - 0.16, -1, VELVET)
    vorhang(B, 'L_VorhangR', win_x1 - 0.2, win_x1 + 0.62, win_z0 - 0.55, win_z1 + 0.38, YW - 0.16, 1, VELVET)
    B.rod('L_Vorhangstange', (win_x0 - 0.78, YW - 0.2, win_z1 + 0.42), (win_x1 + 0.78, YW - 0.2, win_z1 + 0.42), 0.03, BRASS, None, seg=12)
    for sx, xx in ((-1, win_x0 - 0.8), (1, win_x1 + 0.8)):
        B.sphere(f'L_StangenKnauf{sx}', (xx, YW - 0.2, win_z1 + 0.42), (0.06, 0.06, 0.06), BRASS, None)
        B.torus(f'L_Raffhalter{sx}', (xx - sx * 0.42, YW - 0.24, win_z0 - 0.55 + (win_z1 - win_z0 + 0.93) * 0.38), 0.12, 0.025, GOLD, None, rot=(0, 0.3, 0), seg=24, sseg=6, scale=(1.4, 1, 0.6))

    # --- Gemälde: Ur-Ur-Ur-Ur-Oma Gertrude ---
    gx_ = wx(450, YW)
    gz = 3.25
    quad(B, 'L_Leinwand', 1.22, 1.46, PAINT, (gx_, YW - 0.07, gz))
    for k, (dx, dz, sx_, sz_) in enumerate(((0, 0.84, 1.62, 0.22), (0, -0.84, 1.62, 0.22), (-0.72, 0, 0.2, 1.9), (0.72, 0, 0.2, 1.9))):
        R.box(B, f'L_Bilderrahmen{k}', (gx_ + dx, YW - 0.08, gz + dz), (sx_, 0.1, sz_), GOLD, bevel=0.03)
    for k, (dx, dz) in enumerate(((-0.72, 0.84), (0.72, 0.84), (-0.72, -0.84), (0.72, -0.84))):
        B.sphere(f'L_Rahmenrosette{k}', (gx_ + dx, YW - 0.14, gz + dz), (0.13, 0.05, 0.13), GOLD, None)
    R.box(B, 'L_Plakette', (gx_, YW - 0.15, gz - 0.84), (0.6, 0.03, 0.13), CREAM, bevel=0.01)
    ohne_kontur(text(SC, 'L_PlakettenText', 'G. EDISON 1776', 0.075, toon('L_Schrift', '#4a2a10'), (gx_, YW - 0.17, gz - 0.845), font=SERIF, extrude=0.004))
    # Wandleuchter links und rechts des Gemäldes
    for k, sx in enumerate((-1, 1)):
        lx, lz = gx_ + sx * 1.08, 3.05
        B.cone(f'L_Wandplatte{k}', 0, 0.03, 0.09, 0.09, BRASS, None, xy=(0, 0), rot=(math.pi / 2, 0, 0), seg=24, bevel=0.005)
        bpy.data.objects[f'L_Wandplatte{k}'].location = (lx, YW - 0.02, lz)
        tube(f'L_Wandarm{k}', [(lx, YW - 0.04, lz), (lx, YW - 0.2, lz - 0.08), (lx, YW - 0.3, lz + 0.06)], 0.018, BRASS, None)
        B.cone(f'L_Wandtuelle{k}', lz + 0.04, lz + 0.1, 0.04, 0.06, BRASS, None, xy=(lx, YW - 0.3), seg=16, bevel=0)
        B.cone(f'L_Wandbirne{k}', lz + 0.1, lz + 0.22, 0.03, 0.03, BULB, None, xy=(lx, YW - 0.3), seg=12, bevel=0)
        B.cone(f'L_Wandschirm{k}', lz + 0.12, lz + 0.34, 0.14, 0.07, SHADE, None, xy=(lx, YW - 0.3), seg=24, bevel=0)
        lamp(SC, f'L_LichtWand{k}', (lx, YW - 0.45, lz + 0.18), 70, (1.0, 0.78, 0.5), 0.15)

    # --- Rezeption mit Schlüsselbrett ---
    dy0, dy1 = 12.32, YW - 0.02
    dxa, dxb = wx(30, dy0), wx(262, dy0)
    dcx, dcy, dw, dd = (dxa + dxb) / 2, (dy0 + dy1) / 2, dxb - dxa, dy1 - dy0
    R.box(B, 'L_Tresen', (dcx, dcy, 0.6), (dw, dd, 1.16), WOOD, bevel=0.02)
    R.box(B, 'L_TresenPlatte', (dcx, dcy - 0.04, 1.2), (dw + 0.12, dd + 0.12, 0.08), WOODL, bevel=0.02)
    R.box(B, 'L_TresenFuss', (dcx, dy0 + 0.02, 0.07), (dw + 0.04, 0.1, 0.14), WOODD, bevel=0.01)
    for k in range(2):
        px = dxa + dw * (0.25 + 0.5 * k)
        R.box(B, f'L_TresenFeld{k}', (px, dy0 - 0.02, 0.62), (dw * 0.42, 0.04, 0.78), WOODD, bevel=0.02)
        R.box(B, f'L_TresenFeldInnen{k}', (px, dy0 - 0.045, 0.62), (dw * 0.34, 0.03, 0.62), WOOD, bevel=0.02)
    R.box(B, 'L_Empfangsschild', (dcx, dy0 - 0.08, 1.0), (1.05, 0.03, 0.2), DARK, bevel=0.01)
    text(SC, 'L_EmpfangText', 'EMPFANG', 0.13, glow(toon('L_GoldSchrift', '#f2cc6a', hi=0.6), 1.7), (dcx, dy0 - 0.1, 0.995), font=SERIF, extrude=0.008, spacing=1.1)
    top = 1.24
    # Schreibtischlampe (grüner Bankerschirm)
    lx = wx(52, dy0 + 0.3, top)
    B.cone('L_LampenFuss', top, top + 0.04, 0.11, 0.09, BRASS, None, xy=(lx, dy0 + 0.35), seg=24, bevel=0.005)
    B.rod('L_LampenStab', (lx, dy0 + 0.35, top + 0.04), (lx, dy0 + 0.35, top + 0.36), 0.015, BRASS, None, seg=8)
    B.cone('L_LampenSchirm', top + 0.34, top + 0.46, 0.17, 0.12, GREEN, None, xy=(lx, dy0 + 0.3), scale=(1, 0.55, 1), seg=24, bevel=0.005)
    lamp(SC, 'L_LichtTisch', (lx, dy0 + 0.25, top + 0.3), 45, (1.0, 0.86, 0.6), 0.1)
    # Gästebuch mit Feder im Tintenfass
    bx = wx(92, dy0 + 0.25, top)
    for k, sx in enumerate((-1, 1)):
        R.box(B, f'L_BuchSeite{k}', (bx + sx * 0.15, dy0 + 0.28, top + 0.03), (0.3, 0.34, 0.03), CREAM, rot=(0, sx * 0.08, 0), bevel=0.005)
    R.box(B, 'L_BuchDeckel', (bx, dy0 + 0.28, top + 0.01), (0.64, 0.38, 0.02), toon('L_Buchrot', '#6a1422'), bevel=0.005)
    B.cone('L_Tintenfass', top, top + 0.07, 0.05, 0.04, BLACK, None, xy=(bx + 0.42, dy0 + 0.4), seg=16, bevel=0.005)
    tube('L_Feder', [(bx + 0.42, dy0 + 0.4, top + 0.05), (bx + 0.47, dy0 + 0.42, top + 0.2), (bx + 0.56, dy0 + 0.46, top + 0.34)], 0.012, WHITE, None, tip=0.3)
    # Klingel
    kx = wx(128, dy0 + 0.2, top)
    BELL = glow(toon('L_KlingelMessing', '#f0c050', hi=0.9), 1.4)
    B.cone('L_KlingelSockel', top, top + 0.04, 0.12, 0.12, WOODD, None, xy=(kx, dy0 + 0.2), seg=24, bevel=0.005)
    B.sphere('L_Klingel', (kx, dy0 + 0.2, top + 0.04), (0.11, 0.11, 0.09), BELL, None)
    B.cone('L_KlingelKnopf', top + 0.12, top + 0.16, 0.016, 0.016, BELL, None, xy=(kx, dy0 + 0.2), seg=10, bevel=0)
    B.sphere('L_KlingelKnauf', (kx, dy0 + 0.2, top + 0.165), (0.028, 0.028, 0.016), BELL, None)
    # Zuckerdose (voll in der Grundfassung, leer als Variante)
    zx, zy = wx(202, dy0 + 0.22, top), dy0 + 0.22
    PORZ = glow(toon('L_Porzellan', '#f6f6fb', hi=0.7), 1.6)   # etwas übergroß und hell, damit man sie auf dem Tresen sieht
    B.cone('L_Zuckerdose', top, top + 0.15, 0.11, 0.17, PORZ, None, xy=(zx, zy), seg=32, bevel=0.01)
    ohne_kontur(B.torus('L_ZuckerRand', (zx, zy, top + 0.15), 0.17, 0.016, PORZ, None, seg=32, sseg=6),
                B.torus('L_ZuckerBand', (zx, zy, top + 0.08), 0.145, 0.012, toon('L_Blau', '#4a6ad8', hi=0.5), None, seg=32, sseg=6))
    for k in range(2):
        ohne_kontur(B.torus(f'L_ZuckerHenkel{k}', (zx + (k * 2 - 1) * 0.18, zy, top + 0.09), 0.045, 0.013, PORZ, None, rot=(math.pi / 2, 0, 0), seg=16, sseg=6))
    cubes = []
    SUGAR = glow(toon('L_Zucker', '#ffffff', hi=0.5), 1.8)
    for k, (dx, dyy, dz, r_) in enumerate(((-0.06, 0.0, 0.16, 0.2), (0.05, -0.03, 0.165, -0.3), (0.0, 0.05, 0.2, 0.5), (0.03, -0.06, 0.21, 0.1), (-0.04, -0.04, 0.22, 0.7))):
        cubes.append(ohne_kontur(R.box(B, f'L_Zuckerwuerfel{k}', (zx + dx, zy + dyy, top + dz), (0.07, 0.07, 0.07), SUGAR, rot=(0.2 * k, 0.1, r_), bevel=0.008)))
    # Schlüsselbrett: 2 × 5 Haken mit Messingschlüsseln und Anhängern
    sbx = wx(140, YW)
    R.box(B, 'L_Schluesselbrett', (sbx, YW - 0.04, 2.55), (1.5, 0.06, 0.82), WOODD, bevel=0.02)
    R.box(B, 'L_SchluesselbrettLeiste', (sbx, YW - 0.08, 2.98), (1.6, 0.08, 0.08), GOLD, bevel=0.01)
    TAG = toon('L_Anhaenger', '#efe6cc', hi=0.2)
    for j in range(2):
        for i in range(5):
            hx, hz = sbx - 0.56 + i * 0.28, 2.78 - j * 0.38
            B.rod(f'L_Haken{j}{i}', (hx, YW - 0.07, hz), (hx, YW - 0.14, hz + 0.02), 0.01, BRASS, None, seg=6)
            if (i + j * 2) % 4 == 3:
                continue   # ein paar Zimmer sind „vergeben“ (keiner glaubt es)
            ohne_kontur(B.torus(f'L_SchlRing{j}{i}', (hx, YW - 0.13, hz - 0.03), 0.025, 0.006, BRASS, None, rot=(math.pi / 2, 0, 0), seg=12, sseg=4),
                        B.rod(f'L_SchlBart{j}{i}', (hx, YW - 0.13, hz - 0.055), (hx, YW - 0.13, hz - 0.16), 0.008, BRASS, None, seg=6))
            R.box(B, f'L_SchlTag{j}{i}', (hx + 0.03, YW - 0.12, hz - 0.2), (0.07, 0.01, 0.1), TAG, rot=(0, 0.15, 0), bevel=0.003)

    # --- Standuhr (alt, schief) ---
    ux, uy = wx(318, 12.75), 12.75
    uhr, uhr_fenster, pendel = standuhr(SC, B, 'L_Uhr', ux, uy, True, (WOOD, WOODD, BRASS, DARK, FACE), lean=-0.035)
    # Spinnweben oben an der Uhr – sie ist wirklich alt
    WEB = toon('L_Spinnweb', '#e8e4f0', hi=0.0)
    for k in range(4):
        a = 0.3 + k * 0.35
        ohne_kontur(B.rod(f'L_Spinnweb{k}', (ux + 0.38, uy - 0.2, 2.62), (ux + 0.38 - math.cos(a) * 0.34, uy - 0.2, 2.62 - math.sin(a) * 0.34), 0.0035, WEB, None, seg=4))

    # --- Sofa ---
    sx0, sx1, sy0 = wx(440, 12.25), wx(640, 12.25), 12.25
    scx, sw_ = (sx0 + sx1) / 2, sx1 - sx0
    R.box(B, 'L_SofaSockel', (scx, sy0 + 0.45, 0.32), (sw_, 0.9, 0.36), SOFA, bevel=0.05)
    R.box(B, 'L_SofaLehne', (scx, YW - 0.2, 0.86), (sw_, 0.32, 0.8), SOFA, rot=(-0.08, 0, 0), bevel=0.08)
    for k in range(3):
        cxk = sx0 + 0.3 + (sw_ - 0.6) * (k + 0.5) / 3
        R.box(B, f'L_Sitzkissen{k}', (cxk, sy0 + 0.42, 0.56), ((sw_ - 0.6) / 3 - 0.04, 0.82, 0.16), SOFAL, bevel=0.06)
        R.box(B, f'L_Rueckenkissen{k}', (cxk, YW - 0.42, 0.94), ((sw_ - 0.6) / 3 - 0.06, 0.2, 0.52), SOFAL, rot=(-0.14, 0, 0), bevel=0.08)
    for k, sx in enumerate((-1, 1)):
        ax = scx + sx * (sw_ / 2 - 0.14)
        R.box(B, f'L_Armlehne{k}', (ax, sy0 + 0.47, 0.6), (0.28, 0.94, 0.42), SOFA, bevel=0.05)
        B.rod(f'L_ArmRolle{k}', (ax, sy0 + 0.0, 0.82), (ax, YW - 0.06, 0.82), 0.17, SOFA, None, seg=24)
        for j, yy in enumerate((sy0 + 0.1, YW - 0.12)):
            B.cone(f'L_SofaFuss{k}{j}', 0.0, 0.14, 0.04, 0.055, WOODD, None, xy=(ax, yy), seg=12, bevel=0)
    R.box(B, 'L_Zierkissen', (sx0 + 0.6, YW - 0.62, 0.84), (0.34, 0.16, 0.34), toon('L_Kissengold', '#e2b85c', hi=0.3), rot=(-0.25, 0.75, 0.15), bevel=0.09)

    # --- Runder Teppich (darunter die Falltür) ---
    HX, HY = 0.55, 0.5   # halbe Lochgröße (wie im Boden)
    rug = [B.cone('L_Teppich', 0.0, 0.025, 2.0, 2.0, RUG, None, xy=(rx, ry), seg=96, bevel=0.01),
           B.cone('L_TeppichInnen', 0.02, 0.03, 1.28, 1.28, RUGD, None, xy=(rx, ry), seg=96, bevel=0),
           B.cone('L_TeppichMedaillon', 0.025, 0.034, 0.62, 0.62, GOLD, None, xy=(rx, ry), seg=4, bevel=0),
           B.cone('L_TeppichMitte', 0.03, 0.036, 0.36, 0.36, RUG, None, xy=(rx, ry), seg=4, bevel=0), plug]
    B.torus('L_TeppichBorte', (rx, ry, 0.027), 1.72, 0.035, GOLD, None, seg=96, sseg=6, scale=(1, 1, 0.3))
    for i in range(16):
        a = 2 * math.pi * i / 16
        B.sphere(f'L_TeppichPunkt{i}', (rx + math.cos(a) * 1.5, ry + math.sin(a) * 1.5, 0.03), (0.05, 0.05, 0.01), GOLD, None)
    for i in range(40):   # Fransen
        a = 2 * math.pi * i / 40
        ohne_kontur(B.rod(f'L_Franse{i}', (rx + math.cos(a) * 1.98, ry + math.sin(a) * 1.98, 0.01), (rx + math.cos(a) * 2.1, ry + math.sin(a) * 2.1, 0.008), 0.008, CREAM, None, seg=4))
    # Variante „falltuer“: Fred hat ein Loch in den Teppich geschnitten – Teppich mit Loch, die Klappe steht offen (man sieht ihre
    # Unterseite mit den Querleisten, oben klebt das ausgeschnittene Teppichstück), Leiter in den Schacht, warmes Licht von unten
    fall = [ringloch(B, 'L_TeppichLoch', 2.0, HX, HY, RUG, (rx, ry, 0.0125), 0.025),
            ringloch(B, 'L_TeppichInnenLoch', 1.28, HX, HY, RUGD, (rx, ry, 0.025), 0.01)]
    HP = B.empty('L_KlappeAngel')
    HP.location, HP.rotation_euler = (rx, ry + HY, 0.0), (-(math.pi / 2 + 0.22), 0, 0)
    fall.append(HP)
    R.box(B, 'L_Klappe', (0, -HY, 0.035), (2 * HX - 0.02, 2 * HY - 0.02, 0.07), WOOD, HP, bevel=0.02)
    R.box(B, 'L_KlappeTeppich', (0, -HY, 0.083), (2 * HX - 0.02, 2 * HY - 0.02, 0.025), RUG, HP, bevel=0.005)
    for k, yk in enumerate((-0.22, -0.78)):
        R.box(B, f'L_KlappeLeiste{k}', (0, yk, -0.02), (2 * HX - 0.12, 0.1, 0.05), WOODD, HP, bevel=0.01)
    R.box(B, 'L_KlappeStrebe', (0, -HY, -0.02), (0.1, 0.62, 0.045), WOODD, HP, rot=(0, 0, 0.9), bevel=0.01)
    for k, (cx_, cy_, sx_, sy_) in enumerate(((rx, ry - HY - 0.03, 2 * HX + 0.06, 0.06), (rx, ry + HY + 0.03, 2 * HX + 0.06, 0.06), (rx - HX - 0.03, ry, 0.06, 2 * HY), (rx + HX + 0.03, ry, 0.06, 2 * HY))):
        fall.append(R.box(B, f'L_Schacht{k}', (cx_, cy_, -1.2), (sx_, sy_, 2.3), toon('L_SchachtMauer', '#5a4a44', hi=0.0), bevel=0))
    fall.append(R.box(B, 'L_SchachtGrund', (rx, ry, -2.3), (2 * HX, 2 * HY, 0.1), toon('L_SchachtGrund', '#3a2a24', hi=0.0), bevel=0))
    for sx in (-1, 1):
        fall.append(B.rod(f'L_LeiterHolm{sx}', (rx + sx * 0.24, ry + HY - 0.14, -2.3), (rx + sx * 0.24, ry + HY - 0.1, 0.55), 0.035, WOODL, None, seg=10))
    for i in range(7):
        z = -1.75 + i * 0.36
        fall.append(B.rod(f'L_LeiterSprosse{i}', (rx - 0.24, ry + HY - 0.12, z), (rx + 0.24, ry + HY - 0.12, z), 0.025, WOODL, None, seg=8))
    fall.append(lamp(SC, 'L_LichtSchacht', (rx, ry, -0.9), 180, (1.0, 0.72, 0.42), 0.3, dist=2.6))

    # --- KAFFEE-O-MAT 5000 ---
    ky0 = 12.5
    kx0, kx1 = wx(706, ky0), wx(780, ky0)
    kcx, kw = (kx0 + kx1) / 2, kx1 - kx0
    K = B.empty('L_Automat')
    K.location = (kcx, ky0 + 0.33, 0)
    R.box(B, 'L_AutomatKoerper', (0, 0, 1.22), (kw, 0.66, 2.36), RED, K, bevel=0.07)
    R.box(B, 'L_AutomatSchild', (0, -0.34, 2.12), (kw - 0.14, 0.04, 0.34), YEL, K, bevel=0.03)
    text(SC, 'L_AutomatName', 'KAFFEE-O-MAT', 0.13, toon('L_Dunkelrot', '#7a1a10', hi=0.2), (0, -0.37, 2.12), font=BLACKF, extrude=0.008, parent=K)
    R.box(B, 'L_AutomatFenster', (0, -0.335, 1.55), (kw - 0.22, 0.04, 0.62), DARK, K, bevel=0.02)
    for i in range(3):   # Becher-Auslage
        B.cone(f'L_Becher{i}', 1.32, 1.5, 0.06, 0.08, WHITE, K, xy=(-0.3 + i * 0.3, -0.3), seg=20, bevel=0.005)
        B.torus(f'L_BecherHenkel{i}', (-0.3 + i * 0.3 + 0.08, -0.3, 1.41), 0.035, 0.01, WHITE, K, rot=(math.pi / 2, 0, 0), seg=12, sseg=4)
    text(SC, 'L_Preis', '5000', 0.15, glow(toon('L_GelbSchrift', '#ffd23a', hi=0.4), 1.3), (-0.18, -0.35, 1.08), font=BLACKF, extrude=0.008, parent=K)
    R.box(B, 'L_Muenzschlitz', (0.32, -0.34, 1.12), (0.08, 0.03, 0.18), DARK, K, bevel=0.005)
    for k, (col, z) in enumerate((('#3cf07a', 0.9), ('#ffd23a', 0.74))):
        B.sphere(f'L_Taste{k}', (0.32, -0.34, z), (0.055, 0.03, 0.055), toon(f'L_Taste{k}', col, hi=0.6), K)
    R.box(B, 'L_Ausgabe', (-0.12, -0.32, 0.62), (0.46, 0.06, 0.42), DARK, K, bevel=0.01)
    R.box(B, 'L_AusgabeGitter', (-0.12, -0.36, 0.43), (0.46, 0.04, 0.04), toon('L_Chrom', '#c8ccd8', hi=0.8), K, bevel=0.005)
    R.box(B, 'L_ExtraStark', (0.24, -0.36, 1.84), (0.32, 0.02, 0.12), WHITE, K, rot=(0, -0.12, 0), bevel=0.005)
    ohne_kontur(text(SC, 'L_ExtraText', 'EXTRA STARK', 0.04, RED, (0.24, -0.375, 1.84), font=BLACKF, extrude=0.003, parent=K, rot=(math.pi / 2, -0.12, 0)))
    for sx in (-1, 1):
        R.box(B, f'L_AutomatFuss{sx}', (sx * (kw / 2 - 0.12), 0, 0.04), (0.16, 0.5, 0.08), BLACK, K, bevel=0.01)
    tube('L_Stromkabel', [(kx1 - 0.02, ky0 + 0.55, 0.3), (kx1 + 0.12, ky0 + 0.6, 0.03), (kx1 + 0.26, YW - 0.12, 0.05), (kx1 + 0.3, YW - 0.06, 0.32)], 0.018, BLACK, None)
    R.box(B, 'L_Steckdose', (kx1 + 0.3, YW - 0.04, 0.34), (0.12, 0.03, 0.12), WHITE, bevel=0.01)
    # Grundfassung: kein Strom – Zettel „KEIN STROM! – Fred“. Variante „strom“: Fenster beleuchtet, Preis leuchtet, kein Zettel
    zettel = [R.box(B, 'L_Zettel', (0.02, -0.37, 1.58), (0.5, 0.01, 0.3), toon('L_Papier', '#fff6d8', hi=0.1), K, rot=(0, 0.1, 0), bevel=0.002),
              R.box(B, 'L_Klebeband', (0.02, -0.38, 1.73), (0.16, 0.012, 0.05), toon('L_Tesa', '#e6dcb4', hi=0.1), K, rot=(0, 0.1, 0), bevel=0)]
    zettel.append(ohne_kontur(text(SC, 'L_ZettelText', 'KEIN STROM!', 0.072, toon('L_Rotstift', '#c8262e'), (0.02, -0.385, 1.6), font=BLACKF, extrude=0.002, parent=K, rot=(math.pi / 2, 0.1, 0))))
    zettel.append(ohne_kontur(text(SC, 'L_ZettelGruss', '– Fred', 0.05, toon('L_Bleistift', '#3a2a40'), (0.12, -0.385, 1.49), font=SERIF, extrude=0.002, parent=K, rot=(math.pi / 2, 0.1, 0))))
    strom = [R.box(B, 'L_FensterLicht', (0, -0.36, 1.55), (kw - 0.3, 0.01, 0.52), glow(toon('L_Innenlicht', '#ff9a3a', hi=0.6), 1.15), K, bevel=0),
             text(SC, 'L_PreisLicht', '5000', 0.15, glow(toon('L_PreisGlut', '#ffe25a', hi=0.95), 2.4), (-0.18, -0.358, 1.08), font=BLACKF, extrude=0.008, parent=K),
             B.sphere('L_Bereit', (0.32, -0.355, 1.3), (0.03, 0.02, 0.03), glow(toon('L_LED', '#5aff8a', hi=0.95), 3.0), K)]   # keine Lampe: ihr Schein reichte über den Ausschnitt hinaus

    # --- Tür zum Labor ---
    dcx_, dw_ = (door_x0 + door_x1) / 2, door_x1 - door_x0
    T = B.empty('L_Tuer')
    T.location = (dcx_, YW + 0.12, 0)
    R.box(B, 'L_TuerBlatt', (0, 0, door_z1 / 2), (dw_ - 0.04, 0.07, door_z1 - 0.02), toon('L_Tuerholz', '#7a4a22', hi=0.25), T, bevel=0.015)
    quad(B, 'L_TuerGlas', dw_ - 0.42, 1.12, LABGLAS, (0, -0.045, 1.9), T)
    for k, (dx, dz, sx_, sz_) in enumerate(((0, 2.5, dw_ - 0.3, 0.1), (0, 1.3, dw_ - 0.3, 0.1), (-(dw_ - 0.36) / 2, 1.9, 0.1, 1.3), ((dw_ - 0.36) / 2, 1.9, 0.1, 1.3))):
        R.box(B, f'L_TuerSprosse{k}', (dx, -0.05, dz), (sx_, 0.04, sz_), toon('L_TuerholzDunkel', '#5a3416', hi=0.15), T, bevel=0.005)
    R.box(B, 'L_TuerFeld', (0, -0.045, 0.62), (dw_ - 0.4, 0.03, 0.9), toon('L_TuerholzDunkel', '#5a3416', hi=0.15), T, bevel=0.02)
    B.sphere('L_Tuerknauf', (-(dw_ / 2 - 0.16), -0.09, 1.08), (0.05, 0.05, 0.05), BRASS, T)
    for k, (cx_, cz_, sx_, sz_) in enumerate(((dcx_, door_z1 + 0.09, dw_ + 0.42, 0.18), (door_x0 - 0.1, door_z1 / 2, 0.2, door_z1), (door_x1 + 0.1, door_z1 / 2, 0.2, door_z1))):
        R.box(B, f'L_Tuerrahmen{k}', (cx_, YW - 0.05, cz_), (sx_, 0.12, sz_), WOODD, bevel=0.015)
    R.box(B, 'L_LaborSchild', (dcx_, YW - 0.08, door_z1 + 0.5), (1.3, 0.05, 0.34), CREAM, bevel=0.02)
    text(SC, 'L_LaborText', 'LABOR', 0.22, toon('L_Dunkelrot', '#7a1a10', hi=0.2), (dcx_, YW - 0.115, door_z1 + 0.49), font=BLACKF, extrude=0.008, spacing=1.15)
    lamp(SC, 'L_LichtLabor', (dcx_, YW - 0.5, 1.9), 40, (0.5, 1.0, 0.7), 0.4, dist=2.2)
    # Schirmständer neben der Tür
    sx_ = wx(818, 12.8)
    B.cone('L_Schirmstaender', 0.0, 0.62, 0.15, 0.15, BRASS, None, xy=(sx_, 12.8), seg=24, bevel=0.01)
    for k, (dx, col) in enumerate(((-0.05, '#2a3a8a'), (0.06, '#1a1a22'))):
        B.rod(f'L_Schirm{k}', (sx_ + dx, 12.8, 0.3), (sx_ + dx * 1.6, 12.8, 1.05), 0.03, toon(f'L_Schirmstoff{k}', col, hi=0.3), None, r1=0.012, seg=10)
        tube(f'L_SchirmGriff{k}', [(sx_ + dx * 1.6, 12.8, 1.05), (sx_ + dx * 1.6, 12.8, 1.15), (sx_ + dx * 1.6 + 0.06, 12.8, 1.17), (sx_ + dx * 1.6 + 0.08, 12.8, 1.1)], 0.014, WOODD, None)

    # --- Kronleuchter (zwei, vorn oben, schneiden den Bildrand an) ---
    for k, gxk in enumerate((250, 710)):
        cy_ = 9.9
        leuchter(SC, B, tube, f'L_Leuchter{k}', wx(gxk, cy_, 3.9), cy_, ZC, 3.86, 6, (BRASS, CANDLE, FLAME, CRYSTAL))
        lamp(SC, f'L_LichtLeuchter{k}', (wx(gxk, cy_, 3.9), cy_, 3.85), 260, (1.0, 0.78, 0.5), 0.5)

    # --- Licht: Mond durchs Fenster (kühl, schräg nach unten links), warmes Füll-Licht von vorn, Nacht-Grundlicht ---
    R.sun(SC, (-0.62, 0, -0.42), 4.5, (0.62, 0.72, 1.0))
    R.sun(SC, (1.25, 0.0, 0.25), 0.8, (1.0, 0.85, 0.75))
    # Anker für Hotspots und Spiel-Overlays
    E = B.empty('L_ChuckPunkt')
    E.location = (wx(246, dy0 + 0.12, top), dy0 + 0.12, top)
    spec = {
        'anchors': {'Fenster': [bpy.data.objects[f'L_Fensterrahmen{k}'] for k in range(4)], 'Gemaelde': [bpy.data.objects[f'L_Bilderrahmen{k}'] for k in range(4)],
                    'Schluesselbrett': [bpy.data.objects['L_Schluesselbrett'], bpy.data.objects['L_SchluesselbrettLeiste']],
                    'Rezeption': [bpy.data.objects['L_Tresen'], bpy.data.objects['L_TresenPlatte']], 'Klingel': [bpy.data.objects['L_Klingel'], bpy.data.objects['L_KlingelSockel']],
                    'Zucker': [bpy.data.objects['L_Zuckerdose']] + cubes, 'Uhr': [uhr], 'Uhrfenster': [uhr_fenster],
                    'Sofa': [o for o in SC.objects if o.name.startswith(('L_Sofa', 'L_Armlehne', 'L_ArmRolle', 'L_Rueckenkissen'))],
                    'Automat': [K], 'Zettel': zettel[:1], 'Tuer': [bpy.data.objects[f'L_Tuerrahmen{k}'] for k in range(3)], 'Teppich': rug[:1],
                    'Falltuer': [HP] + [o for o in fall if o.name.startswith('L_Schacht')], 'Glas': [bpy.data.objects['L_TuerGlas']]},
        'points': {'chuck': E, 'pendel': pendel, 'ed': (door_x1, YW, 0.0), 'fensterGlas0': (win_x0, YW, win_z1), 'fensterGlas1': (win_x1, YW, win_z0),
                   'teppich': (rx, ry, 0.0), 'mond': (wcx + 0.3 + 4.6 * (0.66 - 0.5), YW + 2.2, wcz + 0.3 + 3.2 * (0.5 - 0.26))},
        'sprites': {'pendel': (pendel, [o for o in SC.objects if o.parent == pendel])},
        'variants': {'zucker_leer': ([], cubes), 'falltuer': (fall, rug), 'strom': (strom, zettel)},
    }
    return spec


ROOMS = {'lobby': (build_lobby, ('#2a2238', '#120c1c'))}


# ------------------------------------------------------------------ Porträts für Gemälde (texturen.py: gemaelde())
def portrait(rig, out, rot_z, z, scale, res=(600, 720)):
    """Brustbild einer Figur aus ihrer Rig-Szene (z. B. 'Gertrude': Rig3D_Gertrude) frontal rendern; die Szene bleibt unverändert.
    Lobby-Gemälde: portrait('Gertrude', REPO + '/art/render/portrait_gertrude.png', -1.2, 2.3, 1.05)"""
    sc = bpy.data.scenes['Rig3D_' + rig]
    g = next(o for o in sc.objects if o.type == 'EMPTY' and o.parent is None and o.name.endswith('Rig'))
    cam = sc.camera
    old = (tuple(g.rotation_euler), tuple(cam.location), cam.data.ortho_scale, sc.render.resolution_x, sc.render.resolution_y, sc.render.filepath)
    win = bpy.context.window
    prev = win.scene
    try:
        g.rotation_euler = (0, 0, rot_z)
        cam.location = (0, cam.location.y, z)
        cam.data.ortho_scale = scale
        sc.render.resolution_x, sc.render.resolution_y = res
        sc.render.filepath = out
        win.scene = sc
        bpy.ops.render.render(write_still=True, scene=sc.name)
    finally:
        win.scene = prev
        g.rotation_euler = old[0]
        cam.location, cam.data.ortho_scale = old[1], old[2]
        sc.render.resolution_x, sc.render.resolution_y, sc.render.filepath = old[3], old[4], old[5]


# ------------------------------------------------------------------ Rendern
def tree(o):
    out = [o]
    for c in o.children:
        out += tree(c)
    return out


def _bbox(SC, cam, objs):
    pts = []
    for o in objs:
        for q in tree(o):
            if q.type in ('MESH', 'CURVE', 'FONT'):
                pts += [q.matrix_world @ Vector(c) for c in q.bound_box]
            elif q.type == 'LIGHT':
                continue
    q = [world_to_camera_view(SC, cam, p) for p in pts]
    return min(p.x for p in q), max(p.x for p in q), min(p.y for p in q), max(p.y for p in q)


def _show(objs, on):
    for o in objs:
        for q in tree(o):
            q.hide_render = not on


def render(name, setup, only=None, no_render=False):
    """Grundbild, Varianten (nur der veränderte Ausschnitt, mit Rand) und Sprites; Daten nach art/render/<name>/meta.json."""
    build, sky = ROOMS[name]
    SC, cam = setup(name, sky)
    spec = build(SC)
    out = R.REPO + f'/art/render/{name}/'
    os.makedirs(out, exist_ok=True)
    win = bpy.context.window
    prev = win.scene
    win.scene = SC
    meta = {'anchors': {}, 'points': {}, 'variants': {}, 'sprites': {}}
    try:
        # erst alle Bildpositionen messen (alles noch sichtbar und ausgewertet), dann ausblenden
        bpy.context.view_layer.update()
        for k, objs in spec['anchors'].items():
            x0, x1, y0, y1 = _bbox(SC, cam, objs)
            meta['anchors'][k] = [round(x0 * 960), round((1 - y1) * 440), round((x1 - x0) * 960), round((y1 - y0) * 440)]
        for k, p in spec['points'].items():
            v = p.matrix_world.translation if hasattr(p, 'matrix_world') else Vector(p)
            q = world_to_camera_view(SC, cam, v)
            meta['points'][k] = [round(q.x * 960, 1), round((1 - q.y) * 440, 1)]
        vbox = {}
        for k, (vis, hid) in spec['variants'].items():
            x0, x1, y0, y1 = _bbox(SC, cam, [o for o in vis + hid if o.type != 'LIGHT'])
            pad = 0.02
            vbox[k] = [max(0, x0 - pad), min(1, x1 + pad), max(0, y0 - pad * 2.2), min(1, y1 + pad * 2.2)]
            bx = vbox[k]
            meta['variants'][k] = [round(bx[0] * 1920), round((1 - bx[3]) * 880), round((bx[1] - bx[0]) * 1920), round((bx[3] - bx[2]) * 880)]
        for k, (root, objs) in spec['sprites'].items():
            pv = world_to_camera_view(SC, cam, root.matrix_world.translation)
            x0, x1, y0, y1 = _bbox(SC, cam, objs)
            meta['sprites'][k] = {'pivot': [round(pv.x * 960, 1), round((1 - pv.y) * 440, 1)], 'box': [round(x0 * 1920) - 4, round((1 - y1) * 880) - 4, round((x1 - x0) * 1920) + 8, round((y1 - y0) * 880) + 8]}
        for vis, hid in spec['variants'].values():   # Grundfassung: Variantenteile aus
            _show(vis, False)
            _show(hid, True)
        sprite_objs = [o for root, objs in spec['sprites'].values() for o in [root] + objs]
        _show(sprite_objs, False)
        SC.render.film_transparent = False
        SC.render.image_settings.color_mode = 'RGB'
        if not no_render and (not only or 'grund' in only):
            SC.render.filepath = R.REPO + f'/art/render/raum_{name}.png'
            bpy.ops.render.render(write_still=True, scene=SC.name)
        for k, (vis, hid) in spec['variants'].items():
            bx = vbox[k]
            if no_render or (only and k not in only):
                continue
            _show(vis, True)
            _show(hid, False)
            try:
                SC.render.border_min_x, SC.render.border_max_x, SC.render.border_min_y, SC.render.border_max_y = bx
                SC.render.use_border, SC.render.use_crop_to_border = True, False
                SC.render.filepath = out + f'var_{k}.png'
                bpy.ops.render.render(write_still=True, scene=SC.name)
            finally:
                SC.render.use_border = False
                _show(vis, False)
                _show(hid, True)
        for k, (root, objs) in spec['sprites'].items():
            if no_render or (only and k not in only):
                continue
            hidden = [o for o in SC.objects if not o.hide_render and o.type in ('MESH', 'CURVE', 'FONT')]
            for o in hidden:
                o.hide_render = True
            _show([root] + objs, True)
            try:
                SC.render.film_transparent = True
                SC.render.image_settings.color_mode = 'RGBA'
                SC.render.filepath = out + f'sprite_{k}.png'
                bpy.ops.render.render(write_still=True, scene=SC.name)
            finally:
                SC.render.film_transparent = False
                SC.render.image_settings.color_mode = 'RGB'
                for o in hidden:
                    o.hide_render = False
                _show([root] + objs, False)
    finally:
        win.scene = prev
    json.dump(meta, open(out + 'meta.json', 'w'), indent=1)
    print('altbau', name, json.dumps(meta['anchors']))
    return meta
