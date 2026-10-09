# Die alten, gezeichneten Räume als 3D-Hintergründe (von raum_build.py geladen, dort ROOMS3D und render()):
#   REPO = r'C:/.../Tentakel-Toast'; NAME = 'lobby'; exec(open(REPO + '/art/blender/raum_build.py').read())
# Gleiche Kamera wie die neuen 3D-Räume (Lauffläche y = 350 … 432). Damit die Spiel-Logik der alten Räume weiter passt,
# stehen die Möbel ungefähr dort, wo sie gezeichnet waren: wx()/wz()/wy() rechnen Spiel-Koordinaten in Welt-Koordinaten um.
# Zustände (Zuckerdose leer, Falltür offen, Automat mit Strom …) werden als Ausschnitte gerendert („Varianten“), bewegte Teile
# (Pendel) als eigene Bilder („Sprites“); altbau_post.py schneidet sie zu und schreibt js/altbau-daten.js.
import bpy, bmesh, json, math, os, random
from mathutils import Vector
from figur_lib import hexlin
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


def gp(gx, gy, y):
    """Welt-Punkt in Tiefe y, der an der Spiel-Koordinate (gx, gy) erscheint."""
    z = wz(gy, y)
    return Vector((wx(gx, y, z), y, z))


def upm(y, z=None):
    """Spiel-Einheiten pro Meter in Tiefe y (für Größen wie „Knauf mit 11 Einheiten Radius“)."""
    h, phi, F, fwd, up = _basis()
    z = h if z is None else z
    return 220 * F / (y * fwd.y + (z - h) * fwd.z)


def gbox(B, name, gx0, gy0, gx1, gy1, y, depth, mat, parent=None, bevel=0.02, rot=(0, 0, 0)):
    """Kasten, dessen Vorderseite (Tiefe y) im Bild das Rechteck gx0..gx1 × gy0..gy1 bedeckt und der depth nach hinten reicht."""
    a, b = gp(gx0, gy1, y), gp(gx1, gy0, y)
    return R.box(B, name, ((a.x + b.x) / 2, y + depth / 2, (a.z + b.z) / 2), (b.x - a.x, depth, b.z - a.z), mat, parent, rot=rot, bevel=bevel)


def toon(name, col, hi=None):
    """Toon wie in raum_build, aber ohne Glanz bei matten Stoffen (hi ≤ 0,1), siehe matt()."""
    m = R.toon(name, col, hi=hi)
    m.node_tree.nodes['ToonEmi2'].inputs['Strength'].default_value = 0.0 if hi is not None and hi <= 0.1 else 1.0
    return m


def tex(name, file, scale=0.35, uv=False, hi=None, rot=0.0):
    m = R.tex_toon(name, file, scale, uv=uv, hi=hi, rot=rot)
    m.node_tree.nodes['ToonEmi2'].inputs['Strength'].default_value = 0.0 if hi is not None and hi <= 0.1 else 1.0
    return m


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


def quad(B, name, w, h, mat, loc, parent=None, rot=(0, 0, 0), su=1.0, sv=1.0):
    """Rechteck in der x-z-Ebene (schaut nach −y, zur Kamera) mit UV 0..su × 0..sv (su > 1 wiederholt das Bild)."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    vs = [bm.verts.new((x, 0, z)) for x, z in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2))]
    f = bm.faces.new(vs)
    for l, c in zip(f.loops, ((0, 0), (su, 0), (su, sv), (0, sv))):
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


# ------------------------------------------------------------------ Labor (Gegenwart)
def kolben(B, name, x, y, z, art, col, glas, parent=None):
    """Laborglas mit leuchtender Flüssigkeit: 0 Erlenmeyer, 1 Rundkolben, 2 Standzylinder (Größen in Metern)."""
    FL = glow(toon(f'L2_Fluessig{col}', col, hi=0.6), 1.5)
    # Toon-Glas ist undurchsichtig: die Flüssigkeit ist eine Spur dicker als das Glas und füllt so den unteren Teil sichtbar aus
    if art == 0:
        B.cone(name, z, z + 0.24, 0.13, 0.035, glas, parent, xy=(x, y), seg=24, bevel=0.005)
        B.cone(name + 'Inhalt', z + 0.003, z + 0.11, 0.135, 0.087, FL, parent, xy=(x, y), seg=24, bevel=0)
        B.cone(name + 'Hals', z + 0.24, z + 0.36, 0.035, 0.035, glas, parent, xy=(x, y), seg=16, bevel=0)
    elif art == 1:
        B.sphere(name, (x, y, z + 0.13), (0.13, 0.13, 0.13), glas, parent)
        B.sphere(name + 'Inhalt', (x, y, z + 0.115), (0.134, 0.134, 0.11), FL, parent)
        B.cone(name + 'Hals', z + 0.24, z + 0.4, 0.035, 0.035, glas, parent, xy=(x, y), seg=16, bevel=0)
    else:
        B.cone(name, z, z + 0.42, 0.075, 0.075, glas, parent, xy=(x, y), seg=20, bevel=0.005)
        B.cone(name + 'Inhalt', z + 0.03, z + 0.27, 0.079, 0.079, FL, parent, xy=(x, y), seg=20, bevel=0)
        B.cone(name + 'Fuss', z, z + 0.03, 0.1, 0.1, glas, parent, xy=(x, y), seg=20, bevel=0)


def build_labor(SC):
    """Dr. Freds Labor: türkise Kachelwand, Schachbrettboden mit Warnschraffur an der Wand, Kreidetafel, Regal mit
    leuchtenden Kolben, der Gut-O-Mat (Chromkasten mit Toasterschlitzen, Leuchtschild, Zellenschacht, Regler BÖSE/GUT,
    Hebel), das Chrono-Klo, Rohre, Neonröhren und ein Kabel, an dem ab und zu ein Lichtbogen überspringt.
    Die Teile stehen genau dort, wo sie gezeichnet waren: die Spiel-Overlays (LEDs, Toast, Dampf, Klo-Effekt) passen weiter."""
    B = R.Builder(SC)
    tube = R.tube_in(SC)
    WALL, FLOOR = tex('L2_Kacheln', 'kacheln_tuerkis.png', 0.25, hi=0.0), tex('L2_Boden', 'schachboden.png', 0.3125, hi=0.0)
    STRIPE = tex('L2_Warnstreifen', 'warnstreifen.png', uv=True, hi=0.0)
    CEIL, METAL, METALD = toon('L2_Decke', '#1d3b38', hi=0.0), toon('L2_Metall', '#8d959e', hi=0.7), toon('L2_MetallDunkel', '#5a6068', hi=0.5)
    CHROME, CHROMED, DARK = toon('L2_Chrom', '#c3ced8', hi=0.55), toon('L2_ChromDunkel', '#93a0ad', hi=0.7), toon('L2_Dunkel', '#15151a', hi=0.05)
    WOOD, WOODD, BRASS = toon('L2_Holz', '#8a4f26', hi=0.25), toon('L2_HolzDunkel', '#6a3a1c', hi=0.15), toon('L_Messing', '#d8a83c', hi=0.75)
    PURPLE, PURPLED, YEL = toon('L2_Lila', '#7b4bb5', hi=0.45), toon('L2_LilaDunkel', '#5e3492', hi=0.3), toon('L2_Gelb', '#ffd23a', hi=0.4)
    CREAM, RED, GREEN, BLACK = toon('L2_Creme', '#efe8d2', hi=0.2), toon('L2_Rot', '#d8243a', hi=0.6), toon('L2_Gruen', '#208040', hi=0.3), toon('N_Schwarz', '#16121e', hi=0.15)
    GLAS = toon('L2_Glas', '#dcf0ff', hi=0.9)
    NEON, BULB = glow(toon('L2_Neon', '#e8fbff', hi=0.95), 2.6), glow(toon('L2_Gluehbirne', '#ffe7a0', hi=0.95), 2.4)
    TAFEL = tex('L2_Tafel', 'kreidetafel.png', uv=True, hi=0.0)
    BLACKF = 'C:/Windows/Fonts/ariblk.ttf'
    YW_ = YW
    # Rückwand mit Türöffnung links, Decke, Boden, Warnschraffur
    dx0, dx1 = wx(28, YW_), wx(104, YW_)
    dz1 = 2.75
    flaeche(B, 'L2_Wand', 'xz', -9.5, 9.5, 0, ZC + 0.2, [(dx0, dx1, 0, dz1)], WALL, (0, YW_ + 0.2, 0), 0.4)
    for sx in (-1, 1):
        R.box(B, f'L2_Seitenwand{sx}', (sx * 8.4, 10.0, ZC / 2), (0.4, 7.0, ZC), WALL, bevel=0)
    R.box(B, 'L2_Boden', (0, 9.6, -0.06), (19, 8.4, 0.12), FLOOR, bevel=0)
    R.box(B, 'L2_Decke', (0, 9.5, ZC + 0.1), (19, 8.4, 0.2), CEIL, bevel=0)
    for i in range(7):
        R.box(B, f'L2_Deckentraeger{i}', (-7.5 + i * 2.5, 9.6, ZC - 0.1), (0.25, 8.0, 0.2), toon('L2_Traeger', '#16302e', hi=0.0), bevel=0.01)
    for k, (xa, xb) in enumerate(((-9.5, dx0 - 0.2), (dx1 + 0.2, 9.5))):
        quad(B, f'L2_Schraffur{k}', xb - xa, 0.32, STRIPE, ((xa + xb) / 2, YW_ - 0.015, 0.16), su=(xb - xa) / 2.56, sv=1.0)
        R.box(B, f'L2_Sockel{k}', ((xa + xb) / 2, YW_ - 0.03, 0.34), (xb - xa, 0.06, 0.05), METALD, bevel=0.005)
    # Rohre: oben entlang der Wand, senkrecht bei x 490 (zum Gut-O-Mat-Schild) und x 886 (neben dem Klo bis zum Boden)
    B.rod('L2_RohrOben', (-9.5, YW_ - 0.25, 4.3), (9.5, YW_ - 0.25, 4.3), 0.11, METAL, None, seg=20)
    for k, x in enumerate(range(-8, 9, 3)):
        R.box(B, f'L2_Rohrschelle{k}', (x, YW_ - 0.13, 4.3), (0.08, 0.28, 0.3), METALD, bevel=0.01)
    r1 = gp(490, 104, YW_ - 0.25)
    B.rod('L2_RohrMitte', (r1.x, YW_ - 0.25, 4.3), (r1.x, YW_ - 0.25, r1.z), 0.08, METAL, None, seg=16)
    B.torus('L2_RohrMitteFlansch', (r1.x, YW_ - 0.25, r1.z + 0.05), 0.1, 0.03, METALD, None, seg=24, sseg=6)
    r2 = gp(886, 330, YW_ - 0.25)
    B.rod('L2_RohrRechts', (r2.x, YW_ - 0.25, 4.3), (r2.x, YW_ - 0.25, 0.0), 0.09, METAL, None, seg=16)
    for k, z in enumerate((1.2, 2.6)):
        B.torus(f'L2_RohrFlansch{k}', (r2.x, YW_ - 0.25, z), 0.12, 0.035, METALD, None, seg=24, sseg=6)
    # Ventilrad und Manometer am rechten Rohr
    B.torus('L2_Ventilrad', (r2.x - 0.24, YW_ - 0.3, 1.9), 0.16, 0.025, RED, None, rot=(0, math.pi / 2, 0), seg=28, sseg=6)
    B.rod('L2_VentilStiel', (r2.x - 0.06, YW_ - 0.3, 1.9), (r2.x - 0.24, YW_ - 0.3, 1.9), 0.025, METALD, None, seg=8)
    B.cone('L2_Manometer', 0, 0.06, 0.16, 0.16, CREAM, None, rot=(math.pi / 2, 0, 0), seg=28, bevel=0.01)
    bpy.data.objects['L2_Manometer'].location = (r2.x, YW_ - 0.4, 3.2)
    B.torus('L2_ManoRing', (r2.x, YW_ - 0.43, 3.2), 0.16, 0.02, BRASS, None, rot=(math.pi / 2, 0, 0), seg=28, sseg=6)
    B.rod('L2_ManoZeiger', (r2.x, YW_ - 0.44, 3.2), (r2.x + 0.1, YW_ - 0.44, 3.27), 0.012, RED, None, seg=6)

    # --- Tür links (zur Lobby) ---
    T = B.empty('L2_Tuer')
    T.location = ((dx0 + dx1) / 2, YW_ + 0.12, 0)
    dw = dx1 - dx0
    R.box(B, 'L2_TuerBlatt', (0, 0, dz1 / 2), (dw - 0.04, 0.07, dz1 - 0.02), WOOD, T, bevel=0.015)
    for k, (z, h) in enumerate(((1.95, 1.05), (0.72, 1.0))):
        R.box(B, f'L2_TuerFeld{k}', (0, -0.045, z), (dw - 0.36, 0.03, h), WOODD, T, bevel=0.02)
    B.sphere('L2_Tuerknauf', (dw / 2 - 0.16, -0.09, 1.1), (0.05, 0.05, 0.05), BRASS, T)
    for k, (cx_, cz_, sx_, sz_) in enumerate((((dx0 + dx1) / 2, dz1 + 0.09, dw + 0.42, 0.18), (dx0 - 0.1, dz1 / 2, 0.2, dz1), (dx1 + 0.1, dz1 / 2, 0.2, dz1))):
        R.box(B, f'L2_Tuerrahmen{k}', (cx_, YW_ - 0.05, cz_), (sx_, 0.12, sz_), WOODD, bevel=0.015)
    R.box(B, 'L2_TuerSchild', ((dx0 + dx1) / 2, YW_ + 0.05, 2.25), (0.62, 0.02, 0.2), YEL, bevel=0.01)
    text(SC, 'L2_TuerSchildText', 'NUR MIT KITTEL!', 0.06, BLACK, ((dx0 + dx1) / 2, YW_ + 0.035, 2.245), font=BLACKF, extrude=0.003)

    # --- Kreidetafel mit Holzrahmen und Kreideablage ---
    t0, t1 = gp(146, 146, YW_ - 0.04), gp(308, 60, YW_ - 0.04)
    quad(B, 'L2_Tafel', t1.x - t0.x, t1.z - t0.z, TAFEL, ((t0.x + t1.x) / 2, YW_ - 0.05, (t0.z + t1.z) / 2))
    for k, (gx0, gy0, gx1, gy1) in enumerate(((136, 52, 318, 61), (136, 147, 318, 156), (136, 52, 145, 156), (309, 52, 318, 156))):
        gbox(B, f'L2_Tafelrahmen{k}', gx0, gy0, gx1, gy1, YW_ - 0.09, 0.08, WOOD, bevel=0.01)
    gbox(B, 'L2_Kreideablage', 150, 156, 304, 162, YW_ - 0.2, 0.18, WOODD, bevel=0.01)
    for k, (gx, col) in enumerate(((180, '#f4f4ee'), (196, '#ffd23a'), (214, '#ff9ad0'))):
        p = gp(gx, 157, YW_ - 0.12)
        B.rod(f'L2_Kreide{k}', (p.x - 0.05, p.y, p.z + 0.02), (p.x + 0.05, p.y, p.z + 0.02), 0.013, toon(f'L2_Kreide{k}', col, hi=0.1), None, seg=8)
    p = gp(270, 157, YW_ - 0.12)
    R.box(B, 'L2_Schwamm', (p.x, p.y, p.z + 0.04), (0.2, 0.08, 0.07), toon('L2_Schwamm', '#d8b04a', hi=0.0), bevel=0.02)
    # Lüftungsgitter mit Kabeln
    gbox(B, 'L2_Lueftung', 336, 56, 384, 86, YW_ - 0.06, 0.06, toon('L2_Gitter', '#22343a', hi=0.2), bevel=0.01)
    for i in range(4):
        gbox(B, f'L2_Lamelle{i}', 340, 61 + i * 6, 380, 63 + i * 6, YW_ - 0.08, 0.02, toon('L2_Lamelle', '#3d5560', hi=0.3), bevel=0)

    # --- Regal mit leuchtenden Kolben (Positionen wie gezeichnet: die Blasen im Spiel steigen aus ihnen auf) ---
    for k, gy in enumerate((236, 296)):
        gbox(B, f'L2_Regalbrett{k}', 132, gy, 322, gy + 8, YW_ - 0.42, 0.42, WOODD, bevel=0.01)
        for gx in (142, 312):
            a = gp(gx, gy + 8, YW_ - 0.1)
            B.rod(f'L2_Konsole{k}{gx}', (a.x, YW_ - 0.04, a.z), (a.x, YW_ - 0.36, a.z), 0.025, METALD, None, seg=8)
            B.rod(f'L2_Konsole{k}{gx}s', (a.x, YW_ - 0.04, a.z - 0.25), (a.x, YW_ - 0.34, a.z - 0.02), 0.02, METALD, None, seg=8)
    for row, gy, items in ((0, 236, ((152, '#7dff7a', 0), (186, '#ff5fa8', 1), (214, '#ffd23a', 2), (246, '#5fd3ff', 0), (284, '#c07dff', 1))),
                           (1, 296, ((160, '#ff8a3d', 2), (196, '#7dff7a', 1), (236, '#ff5fa8', 0), (276, '#e8e8e8', 2), (302, '#5fd3ff', 2)))):
        zb = wz(gy, YW_ - 0.42)   # Oberkante des Bretts (Vorderkante liegt im Bild bei gy)
        for i, (gx, col, art) in enumerate(items):
            fx = wx(gx, YW_ - 0.24, zb)
            kolben(B, f'L2_Kolben{row}{i}', fx, YW_ - 0.24, zb, art, col, GLAS)
            lamp(SC, f'L2_LichtKolben{row}{i}', (fx, YW_ - 0.5, zb + 0.15), 6, tuple(min(1.0, c * 1.4) for c in hexlin(col)), 0.1, dist=0.7)

    # --- Gut-O-Mat ---
    yM = 12.3
    GM = gbox(B, 'L2_GutOMat', 386, 166, 594, 322, yM, 1.25, CHROME, bevel=0.22)
    for i in range(3):
        gbox(B, f'L2_Rille{i}', 404, 235 + i * 9, 576, 237 + i * 9, yM - 0.015, 0.02, CHROMED, bevel=0)
    for k, (gx0, gx1) in enumerate(((404, 422), (558, 576))):
        gbox(B, f'L2_GMFuss{k}', gx0, 314, gx1, 342, yM + 0.15, 0.6, METALD, bevel=0.02)
    # Toasterschlitze oben
    top = gp(490, 166, yM).z
    for k, (gx0, gx1) in enumerate(((418, 482), (498, 562))):
        a, b = gp(gx0, 166, yM + 0.5), gp(gx1, 166, yM + 0.5)
        R.box(B, f'L2_Schlitzgehaeuse{k}', ((a.x + b.x) / 2, yM + 0.55, top + 0.08), (b.x - a.x, 0.7, 0.2), toon('L2_Schlitz', '#2a2a30', hi=0.4), bevel=0.06)
        R.box(B, f'L2_Schlitz{k}', ((a.x + b.x) / 2, yM + 0.55, top + 0.17), (b.x - a.x - 0.2, 0.12, 0.03), DARK, bevel=0)
    # Schild „GUT-O-MAT“ auf einer Stange, mit Glühbirnen-Rand
    s0, s1 = gp(412, 140, yM + 0.6), gp(568, 102, yM + 0.6)
    pole = gp(490, 140, yM + 0.6)
    B.rod('L2_Schildstange', (pole.x, yM + 0.6, top), (pole.x, yM + 0.6, s0.z), 0.05, METALD, None, seg=12)
    R.box(B, 'L2_Schild', ((s0.x + s1.x) / 2, yM + 0.6, (s0.z + s1.z) / 2), (s1.x - s0.x, 0.14, s1.z - s0.z), toon('L2_Schildlila', '#7a2f9a', hi=0.05), bevel=0.06)
    text(SC, 'L2_SchildText', 'GUT-O-MAT', 0.3, glow(toon('L2_SchildGelb', '#ffd23a', hi=0.5), 1.6), ((s0.x + s1.x) / 2, yM + 0.52, (s0.z + s1.z) / 2 - 0.02), font=BLACKF, extrude=0.02)
    nb = 0
    for i in range(14):
        u = i / 13
        for zz in (s0.z - 0.04, s1.z + 0.04):
            ohne_kontur(B.sphere(f'L2_SchildBirne{nb}', (s0.x + (s1.x - s0.x) * u, yM + 0.52, zz), (0.035, 0.035, 0.035), BULB, None))
            nb += 1
    lamp(SC, 'L2_LichtSchild', ((s0.x + s1.x) / 2, yM, (s0.z + s1.z) / 2), 60, (1.0, 0.82, 0.5), 0.4, dist=2.5)
    # Anzeige BÖSE/GUT mit Regler (Zeiger in der Grundfassung auf BÖSE, Variante „regler_gut“)
    gbox(B, 'L2_Anzeige', 416, 260, 508, 312, yM - 0.04, 0.04, CREAM, bevel=0.03)
    for name, body, gx, col in (('L2_Boese', 'BÖSE', 433, '#c02030'), ('L2_Gut', 'GUT', 493, '#208040')):
        p = gp(gx, 273, yM - 0.06)
        text(SC, name, body, 0.1, toon(name + 'Farbe', col, hi=0.2), (p.x, p.y, p.z), font=BLACKF, extrude=0.004)
    rc = gp(462, 292, yM - 0.07)
    u = upm(yM)
    B.cone('L2_Regler', 0, 0.05, 15 / u, 15 / u, METALD, None, rot=(math.pi / 2, 0, 0), seg=32, bevel=0.01)
    bpy.data.objects['L2_Regler'].location = (rc.x, rc.y - 0.02, rc.z)
    B.cone('L2_ReglerInnen', 0, 0.03, 10 / u, 10 / u, toon('L2_ReglerInnen', '#6a707a', hi=0.6), None, rot=(math.pi / 2, 0, 0), seg=32, bevel=0.005)
    bpy.data.objects['L2_ReglerInnen'].location = (rc.x, rc.y - 0.06, rc.z)

    def zeiger(name, a, mat):
        return B.rod(name, (rc.x, rc.y - 0.1, rc.z), (rc.x + math.cos(a) * 15 / u, rc.y - 0.1, rc.z - math.sin(a) * 15 / u), 0.03, mat, None, seg=8)
    boese = zeiger('L2_ZeigerBoese', -2.4, glow(toon('L2_ZeigerRot', '#ff4050', hi=0.6), 1.3))
    gut = zeiger('L2_ZeigerGut', -0.75, glow(toon('L2_ZeigerGruen', '#3cf07a', hi=0.6), 1.3))
    # Feld mit vier Lämpchen (das Spiel lässt sie leuchten) und Ausgabeschlitz
    gbox(B, 'L2_Lampenfeld', 520, 266, 580, 306, yM - 0.04, 0.04, toon('L2_Lampenfeld', '#4a4f58', hi=0.5), bevel=0.02)
    for i in range(4):
        p = gp(532 + i * 12, 278, yM - 0.07)
        B.sphere(f'L2_Laempchen{i}', (p.x, p.y, p.z), (4 / u, 0.02, 4 / u), toon('L2_LampeAus', '#2a2a30', hi=0.5), None)
    gbox(B, 'L2_Ausgabe', 536, 294, 564, 298, yM - 0.075, 0.02, DARK, bevel=0)
    # Zellenschacht links (Variante „zelle“: grün leuchtende Zelle steckt drin)
    gbox(B, 'L2_Zellschacht', 366, 208, 392, 268, yM + 0.1, 0.7, toon('L2_Schacht', '#4a4f58', hi=0.5), bevel=0.03)
    gbox(B, 'L2_ZellLoch', 372, 216, 386, 260, yM + 0.08, 0.04, DARK, bevel=0.01)
    c0, c1 = gp(373, 256, yM + 0.06), gp(385, 220, yM + 0.06)
    zelle = [R.box(B, 'L2_Zelle', ((c0.x + c1.x) / 2, yM + 0.04, (c0.z + c1.z) / 2), (c1.x - c0.x, 0.1, c1.z - c0.z), glow(toon('L2_Zellgruen', '#7dff7a', hi=0.8), 2.0), bevel=0.02)]
    zelle.append(R.box(B, 'L2_ZellKappe', ((c0.x + c1.x) / 2, yM + 0.04, c1.z - 0.02), (c1.x - c0.x + 0.03, 0.12, 0.06), BRASS, bevel=0.01))
    # Hebelgehäuse rechts; der Hebel selbst ist ein Sprite (Drehpunkt 603/262, oben 624/190)
    gbox(B, 'L2_Hebelkasten', 592, 236, 614, 290, yM + 0.1, 0.6, toon('L2_Hebelkasten', '#4a4f58', hi=0.5), bevel=0.03)
    pv = gp(603, 262, yM + 0.02)
    tip = gp(624, 190, yM + 0.02)
    HB = B.empty('L2_Hebel')
    HB.location = pv
    B.rod('L2_HebelStange', (0, 0, 0), tuple(tip - pv), 7 / u / 2, toon('L2_HebelMetall', '#9aa3ad', hi=0.8), HB, seg=12)
    B.sphere('L2_HebelKnauf', tuple(tip - pv), (11 / u, 11 / u, 11 / u), RED, HB)
    B.sphere('L2_HebelAchse', (0, 0, 0), (6 / u, 6 / u, 6 / u), METALD, HB)
    # Brot im linken Schlitz (Variante „brot“)
    b0, b1 = gp(424, 160, yM + 0.55), gp(476, 140, yM + 0.55)
    brot = [R.box(B, 'L2_Brot', ((b0.x + b1.x) / 2, yM + 0.55, top + 0.32), (b1.x - b0.x, 0.06, 0.34), toon('L2_Brotkruste', '#d8963e', hi=0.2), bevel=0.06)]
    brot.append(R.box(B, 'L2_BrotKrume', ((b0.x + b1.x) / 2, yM + 0.515, top + 0.31), (b1.x - b0.x - 0.08, 0.01, 0.28), toon('L2_Krume', '#f2dca0', hi=0.1), bevel=0.04))
    # Kabel: von der linken Seite zum Boden und an der Wand entlang, das Ende ist angekokelt (Funken im Spiel)
    lk = gp(386, 250, yM + 0.4)
    fun = Vector((wx(300, wy(345)), wy(345), 0.04))
    tube('L2_Kabel', [(lk.x, yM + 0.4, lk.z), (lk.x - 0.3, yM + 0.3, 0.6), (lk.x - 0.6, yM + 0.2, 0.05), ((lk.x + fun.x) / 2, fun.y + 0.2, 0.05), (fun.x, fun.y, 0.05)], 0.05, BLACK, None)
    B.cone('L2_KabelEnde', 0, 0.12, 0.06, 0.03, toon('L2_Kupfer', '#c87a3a', hi=0.6), None, rot=(0, -math.pi / 2, 0), seg=12, bevel=0)
    bpy.data.objects['L2_KabelEnde'].location = (fun.x - 0.06, fun.y, 0.05)
    # Lichtbogen-Kabel: hängt von der Decke, Klemme bei (392, 135), Pol oben links auf dem Gut-O-Mat bei (397, 167)
    ke = gp(392, 135, yM + 0.15)
    tube('L2_Haengekabel', [(ke.x - 0.4, yM + 0.6, ZC), (ke.x - 0.1, yM + 0.3, (ZC + ke.z) / 2 + 0.3), (ke.x, yM + 0.15, ke.z + 0.12)], 0.035, BLACK, None)
    B.cone('L2_Klemme', ke.z - 0.02, ke.z + 0.12, 0.02, 0.06, toon('L2_Kupfer', '#c87a3a', hi=0.6), None, xy=(ke.x, yM + 0.15), seg=12, bevel=0)
    kp = gp(397, 167, yM + 0.35)
    B.cone('L2_Pol', top - 0.05, top + 0.1, 0.05, 0.05, BRASS, None, xy=(kp.x, yM + 0.35), seg=16, bevel=0)
    POL = B.sphere('L2_PolKopf', (kp.x, yM + 0.35, top + 0.12), (0.06, 0.06, 0.05), BRASS, None)

    # --- Chrono-Klo ---
    yK = 12.15
    k0, k1 = gp(730, 340, yK), gp(846, 340, yK)
    kx, kw_ = (k0.x + k1.x) / 2, k1.x - k0.x
    KL = B.empty('L2_Klo')
    KL.location = (kx, yK, 0)
    R.box(B, 'L2_KloKorpus', (0, 0.5, 1.3), (kw_, 1.0, 2.6), PURPLE, KL, bevel=0.1)
    R.box(B, 'L2_KloKante', (-kw_ / 2 + 0.12, -0.01, 1.3), (0.1, 0.02, 2.3), toon('L2_LilaHell', '#9a6ad0', hi=0.5), KL, bevel=0.01)
    R.box(B, 'L2_KloTuer', (0, -0.02, 1.25), (kw_ - 0.42, 0.04, 2.25), PURPLED, KL, bevel=0.05)
    B.sphere('L2_KloKuppel', (0, 0.5, 2.6), (kw_ / 2 - 0.06, 0.5, 0.5), PURPLED, KL)
    B.rod('L2_KloRohr', (0, 0.5, 3.0), (0, 0.5, 3.45), 0.06, toon('L2_KloRohr', '#9aa3ad', hi=0.7), KL, seg=12)
    B.sphere('L2_KloBirne', (0, 0.5, 3.55), (0.1, 0.1, 0.1), toon('L2_Birnenrot', '#7a2020', hi=0.6), KL)
    B.torus('L2_Bullauge', (0, -0.06, 1.95), 0.19, 0.04, toon('L2_Bullaugenring', '#ffe9a0', hi=0.6), KL, rot=(math.pi / 2, 0, 0), seg=32, sseg=8)
    B.cone('L2_BullaugeGlas', 0, 0.02, 0.17, 0.17, glow(toon('L2_Zeitglas', '#3a1a6a', hi=0.8), 1.4), KL, rot=(math.pi / 2, 0, 0), seg=32, bevel=0)
    bpy.data.objects['L2_BullaugeGlas'].location = (0, -0.05, 1.95)
    R.box(B, 'L2_KloSchild', (0, -0.07, 1.5), (0.95, 0.03, 0.22), YEL, KL, bevel=0.02)
    text(SC, 'L2_KloSchildText', 'CHRONO-KLO', 0.12, toon('L2_KloSchrift', '#4a1a6a', hi=0.2), (0, -0.09, 1.495), font=BLACKF, extrude=0.005, parent=KL)
    R.box(B, 'L2_Besetzt', (0, -0.07, 2.35), (0.42, 0.03, 0.13), DARK, KL, bevel=0.01)
    text(SC, 'L2_BesetztText', 'FREI', 0.09, glow(toon('L2_FreiGruen', '#5aff8a', hi=0.8), 2.2), (0, -0.09, 2.345), font=BLACKF, extrude=0.004, parent=KL)
    B.sphere('L2_KloKnauf', (kw_ / 2 - 0.32, -0.09, 1.05), (0.05, 0.05, 0.05), BRASS, KL)
    B.cone('L2_KloUhr', 0, 0.04, 0.13, 0.13, CREAM, KL, rot=(0, -math.pi / 2, 0), seg=24, bevel=0.01)   # linke Seite: die sieht man
    bpy.data.objects['L2_KloUhr'].location = (-kw_ / 2 - 0.02, 0.25, 2.15)
    B.rod('L2_KloUhrZeiger', (-kw_ / 2 - 0.07, 0.25, 2.15), (-kw_ / 2 - 0.07, 0.17, 2.24), 0.01, RED, KL, seg=6)
    B.sphere('L2_KloLicht', (-kw_ / 2 - 0.03, 0.25, 1.75), (0.03, 0.08, 0.08), glow(toon('L2_Zyan', '#3cf0ff', hi=0.9), 2.4), KL)
    tube('L2_KloKabel', [(k0.x + 0.1, yK + 0.4, 0.2), (k0.x - 0.4, yK + 0.2, 0.05), (k0.x - 1.0, yK + 0.3, 0.04)], 0.04, toon('L2_KabelGrau', '#2a2a30', hi=0.3), None)
    # Klopapier am Halter, Spruch an der Seite
    R.box(B, 'L2_PapierHalter', (-kw_ / 2 - 0.04, 0.6, 1.0), (0.06, 0.2, 0.06), METALD, KL, bevel=0.005)
    B.cone('L2_Klopapier', -0.07, 0.07, 0.07, 0.07, CREAM, KL, rot=(math.pi / 2, 0, 0), seg=20, bevel=0.01)
    bpy.data.objects['L2_Klopapier'].location = (-kw_ / 2 - 0.12, 0.6, 0.92)
    lamp(SC, 'L2_LichtKlo', (kx, yK - 0.5, 2.0), 40, (0.75, 0.55, 1.0), 0.5, dist=2.0)

    # --- Neonröhren an der Decke (eine über dem Klo: dort hat das Spiel seinen Lichtkegel) ---
    for k, gx in enumerate((200, 789)):
        yl = 11.4
        p = gp(gx, 30, yl)
        for sx in (-0.6, 0.6):
            B.rod(f'L2_LampeSeil{k}{sx}', (p.x + sx, yl, ZC), (p.x + sx, yl, ZC - 0.5), 0.006, BLACK, None, seg=4)
        R.box(B, f'L2_LampeGehaeuse{k}', (p.x, yl, ZC - 0.55), (1.6, 0.25, 0.1), METALD, bevel=0.02)
        B.rod(f'L2_Neonroehre{k}', (p.x - 0.72, yl, ZC - 0.64), (p.x + 0.72, yl, ZC - 0.64), 0.04, NEON, None, seg=12)
        lamp(SC, f'L2_LichtNeon{k}', (p.x, yl, ZC - 0.75), 320, (0.82, 1.0, 0.98), 0.6)
    # Licht: kühles Grundlicht von vorn, Neon, Klo-Lila, Schild warm
    R.sun(SC, (1.2, 0.0, 0.3), 0.9, (0.75, 0.95, 1.0))
    R.sun(SC, (0.5, 0.0, -0.8), 0.6, (0.6, 1.0, 0.9))
    spec = {
        'anchors': {'Tuer': [bpy.data.objects[f'L2_Tuerrahmen{k}'] for k in range(3)], 'Tafel': [bpy.data.objects[f'L2_Tafelrahmen{k}'] for k in range(4)],
                    'Regal': [o for o in SC.objects if o.name.startswith(('L2_Regalbrett', 'L2_Kolben'))], 'GutOMat': [GM, bpy.data.objects['L2_Schild']],
                    'Regler': [bpy.data.objects['L2_Regler']], 'Hebel': [HB, bpy.data.objects['L2_Hebelkasten']], 'Klo': [KL]},
        'points': {'kloBirne': bpy.data.objects['L2_KloBirne'], 'kloOben': (kx, yK, 3.0), 'kloUnten': (kx, yK, 0.0), 'funken': tuple(fun), 'neon': (gp(789, 30, 11.4).x, 11.4, ZC - 0.64),
                   'klemme': (ke.x, yM + 0.15, ke.z - 0.02), 'pol': POL},
        'sprites': {'hebel': (HB, [o for o in SC.objects if o.parent == HB])},
        'variants': {'regler_gut': ([gut], [boese]), 'zelle': (zelle, []), 'brot': (brot, [])},
    }
    return spec


# ------------------------------------------------------------------ Gasthaus (1776)
def bogenzwickel(B, name, cx, zs, r, top, y, depth, mat):
    """Wandstück über einer Rundbogen-Öffnung: Rechteck bis 'top' mit halbkreisförmigem Ausschnitt (Bogen, Kämpfer bei zs)."""
    bm = bmesh.new()
    pts = [(cx - r, zs), (cx - r, top), (cx + r, top), (cx + r, zs)]
    pts += [(cx + math.cos(a) * r, zs + math.sin(a) * r) for a in (math.pi * i / 24 for i in range(1, 24))]
    f = bm.faces.new([bm.verts.new((x, 0, z)) for x, z in pts])
    if f.normal.y > 0:
        f.normal_flip()
    return B.obj(name, bm, mat, None, (0, y + depth / 2, 0), smooth=False, solid=depth)


def build_gasthaus(SC):
    """Gasthaus „Zum Krummen Kamin“ 1776: Fachwerk mit Putz, Holztäfelung, dunkle Dielen, riesiger Steinkamin mit Kessel am
    Kesselhaken und Glut, Kaminsims, neue glänzende Standuhr, langer Tisch mit Hancocks Zetteln, Tintenfass und Obstschale,
    Sprossenfenster ins Grüne, schief hängendes Schild, offene Hintertür zum Garten, Kräuterbündel unter den Balken.
    Feuer, Dampf, Funken und Sonnenstaub malt das Spiel weiter an den gezeichneten Stellen."""
    B = R.Builder(SC)
    tube = R.tube_in(SC)
    WALL, FLOOR = tex('G_Putz', 'putz.png', 0.3, hi=0.0), tex('G_Dielen', 'dielen_dunkel.png', 0.4, rot=math.pi / 2, hi=0.0)
    BEAM, PANEL, PANELD = toon('G_Balken', '#4e3218', hi=0.1), tex('G_Taefel', 'holz_moebel.png', 0.9, hi=0.05), toon('G_TaefelDunkel', '#5a3a1e', hi=0.05)
    STONE, SOOT, IRON = tex('G_Kaminstein', 'mauer.png', 0.55, hi=0.0), toon('G_Russ', '#1e120a', hi=0.0), toon('G_Eisen', '#2a2a30', hi=0.1)
    WOOD, WOODL, BRASS = toon('G_Holz', '#8a5a2e', hi=0.2), toon('G_HolzHell', '#a35a24', hi=0.45), toon('L_Messing', '#d8a83c', hi=0.75)
    CEIL, PAPER, PEWTER = toon('G_Decke', '#3e2712', hi=0.0), tex('G_Zettel', 'hancock_zettel.png', uv=True, hi=0.0), toon('G_Zinn', '#a8a8b4', hi=0.7)
    EMBER, LOG = glow(toon('G_Glut', '#ff7a2a', hi=0.9), 2.6), toon('G_Scheit', '#4a2a14', hi=0.05)
    VIEW = unlit('G_Landschaft', 'landschaft_1776.png', 1.0)
    FACE = tex('L_Zifferblatt', 'zifferblatt.png', uv=True, hi=0.3)
    SERIF = 'C:/Windows/Fonts/georgiab.ttf'
    # Öffnungen: Fenster (474..606 × 60..184 mit Rahmen) und Hintertür (842..928 bis 330)
    wx0, wx1, wz0, wz1 = wx(486, YW), wx(594, YW), wz(172, YW), wz(72, YW)
    tx0, tx1, tz1 = wx(846, YW), wx(928, YW), wz(122, YW)
    flaeche(B, 'G_Wand', 'xz', -9.5, 9.5, 0, ZC + 0.2, [(wx0, wx1, wz0, wz1), (tx0, tx1, 0, tz1)], WALL, (0, YW + 0.2, 0), 0.4)
    for sx in (-1, 1):
        R.box(B, f'G_Seitenwand{sx}', (sx * 8.4, 10.0, ZC / 2), (0.4, 7.0, ZC), WALL, bevel=0)
    R.box(B, 'G_Boden', (0, 9.6, -0.06), (19, 8.4, 0.12), FLOOR, bevel=0)
    R.box(B, 'G_Decke', (0, 9.5, ZC + 0.1), (19, 8.4, 0.2), CEIL, bevel=0)
    for i in range(10):   # Deckenbalken (an einem hängt das Gummihuhn)
        R.box(B, f'G_Deckenbalken{i}', (-8.1 + i * 1.8, 9.6, ZC - 0.14), (0.3, 8.0, 0.28), BEAM, bevel=0.02)
    # Holztäfelung unten (Lücke an der Hintertür)
    zt = 1.3
    for k, (xa, xb) in enumerate(((-9.5, tx0 - 0.2), (tx1 + 0.2, 9.5))):
        R.box(B, f'G_Taefelung{k}', ((xa + xb) / 2, YW - 0.04, zt / 2), (xb - xa, 0.08, zt), PANEL, bevel=0)
        R.box(B, f'G_TaefelLeiste{k}', ((xa + xb) / 2, YW - 0.1, zt + 0.03), (xb - xa, 0.12, 0.08), PANELD, bevel=0.01)
        n = int((xb - xa) / 0.5)
        for i in range(1, n):
            ohne_kontur(R.box(B, f'G_Brettfuge{k}_{i}', (xa + i * (xb - xa) / n, YW - 0.085, zt / 2), (0.025, 0.01, zt - 0.1), PANELD, bevel=0))
    # Fachwerk: Pfosten, Riegel, Streben (wie gezeichnet)
    zr = wz(128, YW)
    R.box(B, 'G_Riegel', (0, YW - 0.08, zr), (19, 0.16, 0.26), BEAM, bevel=0.02)
    for k, gx in enumerate((8, 150, 380, 612, 790, 950)):
        x = wx(gx, YW)
        if tx0 - 0.3 < x < tx1 + 0.3:
            continue
        R.box(B, f'G_Pfosten{k}', (x, YW - 0.08, (zt + ZC) / 2), (0.26, 0.16, ZC - zt), BEAM, bevel=0.02)
    for k, (a, b) in enumerate((((170, 136), (372, 228)), ((790, 136), (640, 228)))):
        pa, pb = gp(a[0], a[1], YW - 0.08), gp(b[0], b[1], YW - 0.08)
        d = pb - pa
        R.box(B, f'G_Strebe{k}', (pa + pb) / 2, (d.length, 0.14, 0.22), BEAM, rot=(0, -math.atan2(d.z, d.x), 0), bevel=0.02)

    # --- Kamin: Steinbrust mit Rundbogen, Kaminsims, Glut, Holzscheite, Kesselhaken mit Kessel ---
    yF = 12.25
    fx0, fx1 = wx(34, yF), wx(246, yF)
    ox0, ox1 = wx(80, yF), wx(200, yF)
    zs, zr_ = 1.25, (ox1 - ox0) / 2
    ocx = (ox0 + ox1) / 2
    ktop = 3.3   # Kaminbrust bis hier, darüber der schmalere Schlot
    flaeche(B, 'G_Kamin', 'xz', fx0, fx1, 0, ktop, [(ox0, ox1, 0, ktop)], STONE, (0, yF + 0.45, 0), 0.9)
    bogenzwickel(B, 'G_KaminBogen', ocx, zs, zr_, ktop, yF, 0.9, STONE)
    cx0, cx1 = wx(96, YW), wx(190, YW)
    R.box(B, 'G_Schlot', ((cx0 + cx1) / 2, YW - 0.35, (3.3 + ZC) / 2), (cx1 - cx0, 0.7, ZC - 3.3), STONE, bevel=0)
    R.box(B, 'G_Feuerraum', (ocx, yF + 0.85, zs), (ox1 - ox0, 0.1, 2.6), SOOT, bevel=0)
    R.box(B, 'G_Herd', (ocx, yF + 0.45, 0.03), (ox1 - ox0, 0.9, 0.06), toon('G_Herdstein', '#5a4a3e', hi=0.0), bevel=0)
    m0, m1 = gp(24, 186, yF - 0.12), gp(256, 202, yF - 0.12)
    R.box(B, 'G_Kaminsims', ((m0.x + m1.x) / 2, yF + 0.05, (m0.z + m1.z) / 2), (m1.x - m0.x, 0.4, m0.z - m1.z), WOOD, bevel=0.02)
    msz = m0.z   # Oberkante Sims (der Holzbecher steht bei x 226)
    for k, (gx, kind) in enumerate(((52, 'leuchter'), (90, 'teller'), (150, 'krug'), (186, 'teller'))):
        x = wx(gx, yF + 0.05, msz)
        if kind == 'leuchter':
            B.cone(f'G_Leuchter{k}', msz, msz + 0.04, 0.07, 0.07, BRASS, None, xy=(x, yF + 0.05), seg=16, bevel=0)
            B.cone(f'G_LeuchterStiel{k}', msz + 0.04, msz + 0.2, 0.02, 0.02, BRASS, None, xy=(x, yF + 0.05), seg=10, bevel=0)
            B.cone(f'G_Kerze{k}', msz + 0.2, msz + 0.36, 0.025, 0.025, toon('L_Kerze', '#fff4dc', hi=0.3), None, xy=(x, yF + 0.05), seg=10, bevel=0)
            ohne_kontur(B.sphere(f'G_Flamme{k}', (x, yF + 0.05, msz + 0.4), (0.016, 0.016, 0.035), glow(toon('L_Flamme', '#ffd27a', hi=0.95), 3.0), None))
        elif kind == 'teller':
            B.cone(f'G_Teller{k}', 0, 0.02, 0.17, 0.17, PEWTER, None, rot=(math.pi / 2 - 0.25, 0, 0), seg=28, bevel=0.005)
            bpy.data.objects[f'G_Teller{k}'].location = (x, yF + 0.18, msz + 0.17)
        else:
            B.cone(f'G_Krug{k}', msz, msz + 0.22, 0.08, 0.07, PEWTER, None, xy=(x, yF + 0.05), seg=20, bevel=0.01)
            B.torus(f'G_KrugHenkel{k}', (x + 0.08, yF + 0.05, msz + 0.12), 0.05, 0.012, PEWTER, None, rot=(math.pi / 2, 0, 0), seg=16, sseg=6)
    # Glut und Scheite im Feuerraum (die Flammen malt das Spiel), Kesselhaken mit Kessel (Dampf im Spiel bei 140/248)
    for k, (dx, a) in enumerate(((-0.35, 0.3), (0.0, -0.2), (0.35, 0.15))):
        B.rod(f'G_Scheit{k}', (ocx + dx - 0.35, yF + 0.55, 0.12), (ocx + dx + 0.35, yF + 0.45 + a * 0.2, 0.14), 0.07, LOG, None, seg=12)
    for k in range(9):
        rnd = random.Random(40 + k)
        ohne_kontur(B.sphere(f'G_Glutstueck{k}', (ocx + rnd.uniform(-0.6, 0.6), yF + rnd.uniform(0.35, 0.7), 0.08), (0.08, 0.06, 0.04), EMBER, None))
    R.box(B, 'G_Rost', (ocx, yF + 0.5, 0.06), (1.3, 0.5, 0.04), IRON, bevel=0.01)
    lamp(SC, 'G_LichtFeuer', (ocx, yF + 0.2, 0.5), 420, (1.0, 0.55, 0.22), 0.4)
    ke = gp(140, 256, yF + 0.5)
    B.rod('G_Kesselhaken', (ox0 + 0.1, yF + 0.5, ke.z + 0.75), (ke.x, yF + 0.5, ke.z + 0.75), 0.025, IRON, None, seg=8)
    B.rod('G_Kesselkette', (ke.x, yF + 0.5, ke.z + 0.75), (ke.x, yF + 0.5, ke.z + 0.05), 0.012, IRON, None, seg=6)
    kz = wz(290, yF + 0.5)
    B.sphere('G_Kessel', (ke.x, yF + 0.5, (ke.z + kz) / 2 - 0.02), (0.36, 0.3, (ke.z - kz) / 2 + 0.04), IRON, None)
    B.cone('G_KesselRand', ke.z - 0.02, ke.z + 0.04, 0.3, 0.3, IRON, None, xy=(ke.x, yF + 0.5), seg=32, bevel=0.01)
    B.torus('G_KesselBuegel', (ke.x, yF + 0.5, ke.z + 0.04), 0.3, 0.015, IRON, None, rot=(math.pi / 2, 0, 0), seg=32, sseg=6, scale=(1, 1, 1.4))
    # Besen am Kamin
    bx_ = wx(262, yF + 0.2)
    B.rod('G_Besenstiel', (bx_, yF + 0.2, 0.32), (bx_ + 0.16, yF + 0.45, 1.75), 0.025, WOODL, None, seg=8)
    B.cone('G_Besen', 0.0, 0.36, 0.17, 0.05, toon('G_Reisig', '#c8a050', hi=0.05), None, xy=(bx_, yF + 0.2), seg=12, bevel=0, scale=(1, 0.5, 1))
    # Kräuterbündel unter dem Balken
    for k, gx in enumerate((300, 340, 884)):
        p = gp(gx, 40, 11.0)
        B.rod(f'G_KrautSchnur{k}', (p.x, 11.0, ZC - 0.28), (p.x, 11.0, ZC - 0.6), 0.006, toon('G_Schnur', '#c8a870', hi=0.0), None, seg=4)
        KR = toon(f'G_Kraut{k}', ['#5a8a3a', '#7a9a4a', '#8a6a9a'][k], hi=0.0)
        B.cone(f'G_KrautBund{k}', ZC - 0.66, ZC - 0.58, 0.035, 0.03, toon('G_Schnur', '#c8a870', hi=0.0), None, xy=(p.x, 11.0), seg=8, bevel=0)
        for j in range(7):   # Blätter hängen kopfüber, unten gespreizt
            a = j * 0.9
            B.sphere(f'G_Kraut{k}_{j}', (p.x + math.cos(a) * 0.06, 11.0 + math.sin(a) * 0.04, ZC - 0.8 - (j % 3) * 0.04), (0.035, 0.035, 0.16), KR, None, rot=(math.sin(a) * 0.3, -math.cos(a) * 0.3, 0))

    # --- Standuhr 1776 (neu, gerade, glänzend; Pendel als Sprite) ---
    uy = 12.75
    uhr, uhr_fenster, pendel = standuhr(SC, B, 'G_Uhr', wx(320, uy), uy, False, (toon('G_UhrHolz', '#a35a24', hi=0.55), toon('G_UhrHolzDunkel', '#6a3a1c', hi=0.3), BRASS, toon('L_Dunkel', '#160c12', hi=0.05), FACE))

    # --- Tisch mit Zetteln, Tintenfass, Feder und Obstschale ---
    yT = 12.0
    t0, t1 = wx(384, yT), wx(654, yT)
    tz = wz(290, yT)
    R.box(B, 'G_Tischplatte', ((t0 + t1) / 2, yT + 0.5, tz - 0.04), (t1 - t0, 1.0, 0.08), WOODL, bevel=0.02)
    R.box(B, 'G_Zarge', ((t0 + t1) / 2, yT + 0.5, tz - 0.14), (t1 - t0 - 0.2, 0.86, 0.12), WOOD, bevel=0.01)
    for k, (x, y) in enumerate(((t0 + 0.25, yT + 0.15), (t1 - 0.25, yT + 0.15), (t0 + 0.25, yT + 0.85), (t1 - 0.25, yT + 0.85))):
        R.box(B, f'G_Tischbein{k}', (x, y, (tz - 0.08) / 2), (0.12, 0.12, tz - 0.08), WOOD, bevel=0.01)
    for k, (gx, dy, rz, s) in enumerate(((574, 0.4, 0.12, 1.0), (622, 0.55, -0.2, 0.8), (520, 0.65, 0.35, 0.7))):
        x = wx(gx, yT + dy, tz)
        quad(B, f'G_Zettel{k}', 0.5 * s, 0.36 * s, PAPER, (x, yT + dy, tz + 0.003 + k * 0.002), rot=(-math.pi / 2, 0, rz))
    ix = wx(530, yT + 0.3, tz)
    B.cone('G_Tintenfass', tz, tz + 0.09, 0.07, 0.05, toon('G_Tinte', '#1d1d2a', hi=0.6), None, xy=(ix, yT + 0.3), seg=16, bevel=0.005)
    tube('G_Gaensefeder', [(ix, yT + 0.3, tz + 0.06), (ix + 0.06, yT + 0.33, tz + 0.25), (ix + 0.14, yT + 0.38, tz + 0.42)], 0.018, toon('L_Weiss', '#f4efe6', hi=0.5), None, tip=0.2)
    ox_ = wx(468, yT + 0.4, tz)
    B.cone('G_Obstschale', tz, tz + 0.12, 0.13, 0.24, toon('G_Schale', '#c8a060', hi=0.3), None, xy=(ox_, yT + 0.4), seg=28, bevel=0.01)
    APPLE = toon('G_Apfel', '#e0302a', hi=0.7)
    aepfel = []
    for k, (dx, dz) in enumerate(((-0.11, 0.14), (0.12, 0.15), (0.0, 0.27))):
        a_ = B.sphere(f'G_Apfel{k}', (ox_ + dx, yT + 0.4, tz + dz), (0.1, 0.1, 0.095), APPLE, None)
        ohne_kontur(B.rod(f'G_Apfelstiel{k}', (ox_ + dx, yT + 0.4, tz + dz + 0.08), (ox_ + dx + 0.02, yT + 0.4, tz + dz + 0.14), 0.008, toon('G_Stiel', '#5a3a1e', hi=0.0), None, seg=4))
        aepfel.append(a_)
        aepfel.append(bpy.data.objects[f'G_Apfelstiel{k}'])
    # Leuchter auf dem Tisch
    lx = wx(626, yT + 0.75, tz)
    B.cone('G_TischLeuchter', tz, tz + 0.05, 0.08, 0.08, BRASS, None, xy=(lx, yT + 0.75), seg=16, bevel=0)
    B.cone('G_TischKerze', tz + 0.05, tz + 0.3, 0.03, 0.03, toon('L_Kerze', '#fff4dc', hi=0.3), None, xy=(lx, yT + 0.75), seg=10, bevel=0)
    ohne_kontur(B.sphere('G_TischFlamme', (lx, yT + 0.75, tz + 0.35), (0.02, 0.02, 0.04), glow(toon('L_Flamme', '#ffd27a', hi=0.95), 3.0), None))
    lamp(SC, 'G_LichtKerze', (lx, yT + 0.6, tz + 0.4), 30, (1.0, 0.8, 0.5), 0.1, dist=2.0)

    # --- Fenster ins Grüne: Sprossen 3 × 3, Rahmen, Fensterbank mit Geranie ---
    quad(B, 'G_Aussicht', 5.0, 3.2, VIEW, ((wx0 + wx1) / 2, YW + 2.4, (wz0 + wz1) / 2 + 0.2))
    bpy.data.objects['G_Aussicht'].visible_shadow = False
    WF = toon('G_Fensterholz', '#5a3a1e', hi=0.2)
    for i in (1, 2):
        x = wx0 + (wx1 - wx0) * i / 3
        R.box(B, f'G_SprosseV{i}', (x, YW + 0.2, (wz0 + wz1) / 2), (0.07, 0.07, wz1 - wz0), WF, bevel=0)
        z = wz0 + (wz1 - wz0) * i / 3
        R.box(B, f'G_SprosseH{i}', ((wx0 + wx1) / 2, YW + 0.2, z), (wx1 - wx0, 0.07, 0.07), WF, bevel=0)
    for k, (cx_, cz_, sx_, sz_) in enumerate((((wx0 + wx1) / 2, wz1 + 0.09, wx1 - wx0 + 0.36, 0.18), ((wx0 + wx1) / 2, wz0 - 0.07, wx1 - wx0 + 0.4, 0.14),
                                                (wx0 - 0.09, (wz0 + wz1) / 2, 0.18, wz1 - wz0), (wx1 + 0.09, (wz0 + wz1) / 2, 0.18, wz1 - wz0))):
        R.box(B, f'G_Fensterrahmen{k}', (cx_, YW - 0.05, cz_), (sx_, 0.12, sz_), WF, bevel=0.015)
    R.box(B, 'G_Fensterbank', ((wx0 + wx1) / 2, YW - 0.13, wz0 - 0.16), (wx1 - wx0 + 0.5, 0.32, 0.06), WF, bevel=0.01)
    px_ = wx0 + 0.35
    B.cone('G_Blumentopf', wz0 - 0.13, wz0 + 0.07, 0.08, 0.11, toon('G_Ton', '#c8643a', hi=0.1), None, xy=(px_, YW - 0.14), seg=16, bevel=0.01)
    for k in range(5):
        a = k * 1.25
        B.sphere(f'G_Geranie{k}', (px_ + math.cos(a) * 0.08, YW - 0.16 + math.sin(a) * 0.04, wz0 + 0.16 + (k % 2) * 0.05), (0.06, 0.06, 0.06), toon('G_Bluete', '#e8304a', hi=0.3), None)
    for k in range(4):
        a = k * 1.6 + 0.5
        B.sphere(f'G_Blatt{k}', (px_ + math.cos(a) * 0.1, YW - 0.16, wz0 + 0.1), (0.07, 0.04, 0.035), toon('G_Laub', '#3f8a3a', hi=0.1), None, rot=(0, 0, a))

    # --- Schild „Zum Krummen Kamin“ (hängt schief, wie alles hier) ---
    s0, s1 = gp(650, 104, YW - 0.08), gp(780, 64, YW - 0.08)
    R.box(B, 'G_Schild', ((s0.x + s1.x) / 2, YW - 0.08, (s0.z + s1.z) / 2), (s1.x - s0.x, 0.07, s1.z - s0.z), WOOD, rot=(0, 0.07, 0), bevel=0.03)
    text(SC, 'G_SchildText', 'Zum Krummen Kamin', 0.17, glow(toon('G_SchildSchrift', '#f2d48a', hi=0.3), 1.2), ((s0.x + s1.x) / 2, YW - 0.125, (s0.z + s1.z) / 2 - 0.03), font=SERIF, extrude=0.006, rot=(math.pi / 2, 0.07, 0))
    for k, u in enumerate((0.15, 0.85)):
        x = s0.x + (s1.x - s0.x) * u
        B.rod(f'G_SchildKette{k}', (x, YW - 0.08, s1.z - 0.02 + (0.5 - u) * 0.05), (x, YW - 0.05, s1.z + 0.3), 0.008, IRON, None, seg=4)

    # --- Hintertür (offen) mit Blick in den Garten ---
    quad(B, 'G_Gartenblick', 3.0, 3.4, VIEW, ((tx0 + tx1) / 2 + 0.4, YW + 1.6, 1.6), su=0.6, sv=1.0)
    bpy.data.objects['G_Gartenblick'].visible_shadow = False
    for k, (cx_, cz_, sx_, sz_) in enumerate((((tx0 + tx1) / 2, tz1 + 0.09, tx1 - tx0 + 0.42, 0.18), (tx0 - 0.1, tz1 / 2, 0.2, tz1), (tx1 + 0.1, tz1 / 2, 0.2, tz1))):
        R.box(B, f'G_Tuerrahmen{k}', (cx_, YW - 0.05, cz_), (sx_, 0.12, sz_), BEAM, bevel=0.015)
    R.box(B, 'G_Schwelle', ((tx0 + tx1) / 2, YW + 0.15, 0.03), (tx1 - tx0, 0.4, 0.06), BEAM, bevel=0.01)
    TD = B.empty('G_Tuerangel')   # Angel an der rechten Zarge: so verdeckt das offene Türblatt den Gartenblick nicht
    TD.location, TD.rotation_euler = (tx1 - 0.04, YW + 0.05, 0), (0, 0, 1.3)
    R.box(B, 'G_TuerBlatt', (-(tx1 - tx0) / 2 + 0.03, -0.04, tz1 / 2), (tx1 - tx0 - 0.06, 0.07, tz1 - 0.02), toon('G_Tuerholz', '#7a4a22', hi=0.2), TD, bevel=0.015)
    for k, z in enumerate((0.5, 1.4, 2.3)):
        R.box(B, f'G_TuerLeiste{k}', (-(tx1 - tx0) / 2 + 0.03, 0.005, z), (tx1 - tx0 - 0.16, 0.03, 0.12), BEAM, TD, bevel=0.01)
    B.sphere('G_TuerRing', (-(tx1 - tx0) + 0.16, -0.09, 1.2), (0.05, 0.02, 0.05), IRON, TD)

    # Licht: Nachmittagssonne durchs Fenster (Strahlen schräg nach rechts unten), Feuer, warmes Grundlicht von vorn
    R.sun(SC, (-0.63, 0, 0.68), 4.5, (1.0, 0.9, 0.7))
    R.sun(SC, (1.2, 0.0, -0.3), 0.9, (1.0, 0.85, 0.7))
    lamp(SC, 'G_LichtTuer', ((tx0 + tx1) / 2, YW - 0.6, 1.6), 60, (1.0, 0.95, 0.8), 0.6, dist=2.5)
    spec = {
        'anchors': {'Fenster': [bpy.data.objects[f'G_Fensterrahmen{k}'] for k in range(4)], 'Schild': [bpy.data.objects['G_Schild']],
                    'Kamin': [bpy.data.objects['G_Kamin'], bpy.data.objects['G_KaminBogen']],
                    'Kessel': [bpy.data.objects['G_Kessel']], 'Uhr': [uhr], 'Uhrfenster': [uhr_fenster],
                    'Tisch': [bpy.data.objects['G_Tischplatte']] + [bpy.data.objects[f'G_Tischbein{k}'] for k in range(4)],
                    'Obstschale': [bpy.data.objects['G_Obstschale']] + aepfel, 'Tuer': [bpy.data.objects[f'G_Tuerrahmen{k}'] for k in range(3)]},
        'points': {'grail': (wx(226, yF + 0.05, msz), yF + 0.05, msz), 'grog': (wx(404, yT + 0.2, tz), yT + 0.2, tz), 'kessel': (ke.x, yF + 0.5, ke.z + 0.06),
                   'feuer': (ocx, yF + 0.3, 0.1), 'fensterGlas0': (wx0, YW, wz1), 'fensterGlas1': (wx1, YW, wz0)},
        'sprites': {'pendel': (pendel, [o for o in SC.objects if o.parent == pendel])},
        'variants': {'apfel': ([], aepfel[4:6])},
    }
    return spec


# ------------------------------------------------------------------ Garten 1776
def sonne_aus(SC, richtung, energy, col):
    """Sonnenlicht, das in Richtung 'richtung' scheint (Vektor von der Sonne in die Szene)."""
    o = R.sun(SC, (0, 0, 0), energy, col)
    o.rotation_euler = Vector(richtung).normalized().to_track_quat('-Z', 'Y').to_euler()
    return o


def baum(B, name, x, y, s, LEAF, LEAF2, TRUNK, parent=None, aepfel=None):
    """Laubbaum im Toon-Stil: Stamm mit zwei Ästen und eine Krone aus Kugeln (optional mit roten Äpfeln)."""
    B.cone(name + 'Stamm', 0, 2.2 * s, 0.32 * s, 0.22 * s, TRUNK, parent, xy=(x, y), seg=16, bevel=0.02)
    for k, (dx, dz) in enumerate(((-0.9, 2.6), (0.8, 2.8))):
        B.rod(f'{name}Ast{k}', (x, y, 1.9 * s), (x + dx * s, y, dz * s), 0.12 * s, TRUNK, parent, r1=0.07 * s, seg=10)
    for k, (dx, dy, dz, r) in enumerate(((0, 0, 3.4, 1.5), (-1.2, 0.2, 2.9, 1.1), (1.15, -0.1, 3.0, 1.15), (-0.5, -0.4, 3.9, 1.0), (0.6, 0.3, 3.95, 1.05), (0, -0.6, 2.8, 0.9))):
        B.sphere(f'{name}Krone{k}', (x + dx * s, y + dy * s, dz * s), (r * s, r * s * 0.9, r * s * 0.85), LEAF if k % 2 else LEAF2, parent)
    if aepfel:   # gleichmäßig über die Vorderseite der Krone verteilt (Goldener Winkel)
        for k in range(9):
            a = k * 2.39996
            r_, zz = 0.35 + 0.85 * ((k * 0.618) % 1), 2.7 + (k % 4) * 0.38
            B.sphere(f'{name}Apfel{k}', (x + math.cos(a) * r_ * 1.5 * s, y - 1.05 * s, zz * s + math.sin(a) * 0.25 * s), (0.13 * s,) * 3, aepfel, parent)


def build_garten1776(SC):
    """Garten hinter dem Gasthaus 1776: Sommerhimmel mit Sonne und Wolken, Hügel mit Bäumen und Kühen, Weidezaun (Vögel und
    Eichhörnchen sitzen darauf), Fachwerkwand des Gasthauses mit Hintertür, Feldweg, Brunnen mit Kurbel und Eimer, Erdbeet
    (vier Stufen als Varianten), Plumpsklo mit Dr.-Fred-Technik und ein Wegweiser zum Hafen."""
    B = R.Builder(SC)
    tube = R.tube_in(SC)
    GRASS, DIRT = tex('GA_Gras', 'wiese.png', 0.12, hi=0.0), tex('GA_Erde', 'erde.png', 0.35, hi=0.0)
    HILL = [toon(f'GA_Huegel{i}', c, hi=0.0) for i, c in enumerate(('#9fd88a', '#7cc95a', '#5fae3e'))]
    LEAF, LEAF2, TRUNK = toon('GA_Laub', '#3f9a3a', hi=0.1), toon('GA_LaubHell', '#55b84a', hi=0.1), toon('GA_Stamm', '#6b4424', hi=0.05)
    WOOD, WOODL, WOODD = toon('GA_Holz', '#9a6a3a', hi=0.15), toon('GA_HolzHell', '#c69458', hi=0.15), toon('GA_HolzDunkel', '#6a3a1e', hi=0.1)
    STONE, ROOF, BEAM = tex('GA_Stein', 'mauer.png', 0.7, hi=0.0), toon('GA_Dach', '#a04a2a', hi=0.1), toon('G_Balken', '#4e3218', hi=0.1)
    WALL, CLOUD, IRON = tex('G_Putz', 'putz.png', 0.3, hi=0.0), toon('R_Wolke', '#ffffff', hi=0.5), toon('G_Eisen', '#2a2a30', hi=0.1)
    BLACKF = 'C:/Windows/Fonts/ariblk.ttf'
    # Boden: Wiese bis zum Horizont, Feldweg vom Gasthaus nach vorn
    wiese = R.plane(B, 'GA_Wiese', -210, 210, 4, 300, 0.0, GRASS)
    bm = bmesh.new()
    bm.from_mesh(wiese.data)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=60, use_grid_fill=True)   # viele kleine Flächen: sonst verdeckt Freestyle die Hügel unter der Wiese nicht
    bm.to_mesh(wiese.data)
    bm.free()
    pts = [(-6.4, 12.4), (-5.6, 12.4), (-3.2, 9.0), (-2.2, 6.0), (-6.4, 6.0), (-6.6, 9.0)]
    bm = bmesh.new()
    f = bm.faces.new([bm.verts.new((x, y, 0.004)) for x, y in pts])
    if f.normal.z < 0:
        f.normal_flip()
    ohne_kontur(B.obj('GA_Weg', bm, DIRT, None, (0, 0, 0), smooth=False))
    # Hügelketten, Bäume und Kühe in der Ferne, Sonne und Wolken
    for i in range(14):
        rnd = random.Random(200 + i)
        k = i % 3
        B.sphere(f'GA_Huegel{i}', (-120 + i * 19 + rnd.uniform(-6, 6), [70, 52, 36][k] + rnd.uniform(-4, 4), -2), (rnd.uniform(18, 30), 10, [9, 6.5, 4.5][k] + rnd.uniform(-1, 1.5)), HILL[k], None)
    for i, (x, y, s) in enumerate(((-14, 42, 1.6), (-5, 46, 1.3), (9, 40, 1.7), (22, 48, 1.4), (-24, 50, 1.5), (31, 38, 1.2))):
        baum(B, f'GA_Fernbaum{i}', x, y, s, LEAF, LEAF2, TRUNK)
    for i, (x, y, d) in enumerate(((-3.2, 28, 1), (6.8, 31, -1))):   # Kühe (es muht ja ständig)
        COW, SPOT = toon('GA_Kuh', '#f4f0ea', hi=0.2), toon('GA_Fleck', '#2a2228', hi=0.1)
        Kh = B.empty(f'GA_Kuh{i}')
        Kh.location, Kh.rotation_euler = (x, y, 0.3), (0, 0, 0.2 * d)
        B.sphere(f'GA_KuhLeib{i}', (0, 0, 1.0), (1.0, 0.5, 0.55), COW, Kh)
        B.sphere(f'GA_KuhKopf{i}', (d * 1.05, -0.05, 1.3), (0.32, 0.27, 0.3), COW, Kh)
        B.sphere(f'GA_KuhMaul{i}', (d * 1.3, -0.08, 1.2), (0.16, 0.2, 0.15), toon('GA_Maul', '#f0a8a8', hi=0.2), Kh)
        for j, (dx, dz) in enumerate(((-0.3, 1.25), (0.35, 0.95), (0.0, 1.15))):
            B.sphere(f'GA_KuhFleck{i}{j}', (dx, -0.45, dz), (0.22, 0.08, 0.18), SPOT, Kh)
        for j, (lx, ly) in enumerate(((-0.6, -0.25), (0.6, -0.25), (-0.6, 0.25), (0.6, 0.25))):
            B.cone(f'GA_KuhBein{i}{j}', -0.3, 0.6, 0.09, 0.1, COW, Kh, xy=(lx, ly), seg=10, bevel=0)
        for j, sx in enumerate((-1, 1)):
            B.cone(f'GA_KuhHorn{i}{j}', 1.55, 1.75, 0.04, 0.01, toon('GA_Horn', '#e8dcb8', hi=0.3), Kh, xy=(d * 1.05, sx * 0.15), seg=8, bevel=0)
    sp = gp(200, 68, 160)
    B.sphere('GA_Sonne', tuple(sp), (7.5, 7.5, 7.5), glow(toon('GA_Sonne', '#ffe36b', hi=0.9), 2.2), None)
    for i, (gx, gy, s) in enumerate(((380, 70, 1.0), (640, 46, 1.3), (900, 100, 0.9), (110, 130, 0.8))):
        p = gp(gx, gy, 120)
        for j in range(4):
            rnd = random.Random(500 + i * 7 + j)
            B.sphere(f'GA_Wolke{i}{j}', (p.x + (j - 1.5) * 4.6 * s, 120 + rnd.uniform(-2, 2), p.z + rnd.uniform(-1.2, 1.4) * s), (rnd.uniform(3.6, 5.2) * s, 2.5, rnd.uniform(2.2, 3.2) * s), CLOUD, None)
    # großer Apfelbaum hinter dem Zaun: seine Krone hängt oben ins Bild (dort fallen im Spiel Lichtbänder durch)
    baum(B, 'GA_Apfelbaum', wx(600, 26.0), 26.0, 2.2, LEAF, LEAF2, TRUNK, aepfel=toon('G_Apfel', '#e0302a', hi=0.7))

    # --- Weidezaun (Oberkante der oberen Latte bei Spiel-y 247: dort sitzen die Vögel) ---
    yZ = wy(302)
    za, zb = wx(344, yZ), wx(708, yZ)
    ztop = wz(247, yZ)
    for k, z in enumerate((ztop - 0.07, ztop - 0.6)):
        R.box(B, f'GA_Latte{k}', ((za + zb) / 2, yZ - 0.05, z), (zb - za, 0.08, 0.14), WOOD, bevel=0.01)
    n = 15
    for i in range(n):
        x = za + (zb - za) * (i + 0.5) / n
        R.box(B, f'GA_Pfahl{i}', (x, yZ + 0.02, ztop / 2 + 0.05), (0.16, 0.08, ztop + 0.1), WOODL, bevel=0.01)
        B.cone(f'GA_PfahlSpitze{i}', ztop + 0.1, ztop + 0.26, 0.11, 0.0, WOODL, None, xy=(x, yZ + 0.02), seg=4, bevel=0, scale=(1, 0.5, 1))

    # --- Fachwerkwand des Gasthauses links mit Hintertür, Fenster oben, Dachüberstand ---
    yH = 12.5
    hx1 = wx(124, yH)
    tx0, tx1 = wx(24, yH), wx(104, yH)
    flaeche(B, 'GA_Hauswand', 'xz', -10.0, hx1, 0, 5.6, [(tx0, tx1, 0, 2.75), (tx0 + 0.15, tx1 - 0.15, 3.4, 4.4)], WALL, (0, yH + 0.2, 0), 0.4)
    R.box(B, 'GA_HausSeite', (hx1 + 0.2, yH + 1.2, 2.8), (0.4, 2.4, 5.6), WALL, bevel=0)
    for k, x in enumerate((hx1 - 0.12, -9.0)):
        R.box(B, f'GA_Eckpfosten{k}', (x, yH - 0.06, 2.8), (0.24, 0.14, 5.6), BEAM, bevel=0.02)
    for k, z in enumerate((0.15, 3.0, 5.5)):
        R.box(B, f'GA_Schwelle{k}', ((hx1 - 10.0) / 2, yH - 0.06, z), (hx1 + 10.0, 0.14, 0.22), BEAM, bevel=0.02)
    R.box(B, 'GA_Dachkante', ((hx1 - 10.0) / 2, yH - 0.6, 5.85), (hx1 + 10.6, 1.4, 0.25), ROOF, rot=(0.35, 0, 0), bevel=0.02)
    TT = B.empty('GA_Tuer')
    TT.location = ((tx0 + tx1) / 2, yH + 0.12, 0)
    R.box(B, 'GA_TuerBlatt', (0, 0, 1.37), (tx1 - tx0 - 0.04, 0.07, 2.73), toon('G_Tuerholz', '#7a4a22', hi=0.2), TT, bevel=0.015)
    for i in range(4):
        ohne_kontur(R.box(B, f'GA_TuerBrett{i}', (-(tx1 - tx0) / 2 + (i + 1) * (tx1 - tx0) / 5, -0.04, 1.37), (0.02, 0.01, 2.6), WOODD, TT, bevel=0))
    B.sphere('GA_TuerKnauf', ((tx1 - tx0) / 2 - 0.16, -0.08, 1.15), (0.05, 0.05, 0.05), toon('L_Messing', '#d8a83c', hi=0.75), TT)
    for k, (cx_, cz_, sx_, sz_) in enumerate((((tx0 + tx1) / 2, 2.84, tx1 - tx0 + 0.36, 0.18), (tx0 - 0.09, 1.375, 0.18, 2.75), (tx1 + 0.09, 1.375, 0.18, 2.75))):
        R.box(B, f'GA_Tuerrahmen{k}', (cx_, yH - 0.05, cz_), (sx_, 0.12, sz_), BEAM, bevel=0.015)
    R.box(B, 'GA_Fensterkreuz', ((tx0 + tx1) / 2, yH + 0.25, 3.9), (tx1 - tx0 - 0.3, 0.06, 0.06), BEAM, bevel=0)
    R.box(B, 'GA_FensterInnen', ((tx0 + tx1) / 2, yH + 0.5, 3.9), (tx1 - tx0, 0.05, 1.2), toon('GA_Innen', '#3a2414', hi=0.0), bevel=0)
    B.cone('GA_Regentonne', 0, 0.95, 0.38, 0.38, tex('R_Fassholz', 'holz_fass.png', 1.1, hi=0.1), None, xy=(hx1 - 0.6, yH - 0.5), seg=24, bevel=0.03)
    for j, z in enumerate((0.15, 0.8)):
        B.torus(f'GA_TonnenReif{j}', (hx1 - 0.6, yH - 0.5, z), 0.385, 0.025, IRON, None, seg=32, sseg=6)

    # --- Brunnen mit Dach, Kurbel, Seil und Eimer ---
    yB = 12.83 + 0.95
    bx_ = wx(271, yB)
    B.cone('GA_Brunnen', 0, 0.96, 0.95, 0.95, STONE, None, xy=(bx_, yB), seg=40, bevel=0.03)
    B.torus('GA_BrunnenRand', (bx_, yB, 0.98), 0.92, 0.09, toon('GA_Randstein', '#b5ae9f', hi=0.0), None, seg=48, sseg=8)
    B.cone('GA_Wasser', 0.9, 0.93, 0.84, 0.84, toon('GA_Wasser', '#2a4a6a', hi=0.6), None, xy=(bx_, yB), seg=40, bevel=0)   # randvoll: sonst sieht man das Wasser nicht
    for k, sx in enumerate((-1, 1)):
        B.cone(f'GA_BrunnenPfosten{k}', 0.9, 2.45, 0.08, 0.08, WOODD, None, xy=(bx_ + sx * 0.84, yB), seg=10, bevel=0)
    for k, sx in enumerate((-1, 1)):
        R.box(B, f'GA_BrunnenDach{k}', (bx_ + sx * 0.55, yB, 2.62), (1.3, 1.5, 0.08), ROOF, rot=(0, sx * 0.62, 0), bevel=0.01)
    B.rod('GA_Kurbelwelle', (bx_ - 0.86, yB, 2.1), (bx_ + 0.95, yB, 2.1), 0.06, WOOD, None, seg=12)
    B.rod('GA_Kurbelarm', (bx_ + 0.95, yB, 2.1), (bx_ + 0.95, yB - 0.05, 1.82), 0.03, IRON, None, seg=8)
    B.rod('GA_Kurbelgriff', (bx_ + 0.95, yB - 0.05, 1.82), (bx_ + 1.12, yB - 0.05, 1.82), 0.035, WOODD, None, seg=8)
    B.rod('GA_Seil', (bx_, yB, 2.08), (bx_, yB, 1.2), 0.015, toon('GA_Seil', '#d8c098', hi=0.0), None, seg=6)
    ep = Vector((wx(322, yB - 0.75, 0.98), yB - 0.75, 0.98))
    eimer = [B.cone('GA_Eimer', 0.98, 1.3, 0.13, 0.16, toon('GA_Eimerholz', '#a87a48', hi=0.1), None, xy=(ep.x, ep.y), seg=20, bevel=0.01)]
    for j, z in enumerate((1.03, 1.24)):
        eimer.append(B.torus(f'GA_EimerReif{j}', (ep.x, ep.y, z), 0.15 + (z - 0.98) * 0.09, 0.012, IRON, None, seg=24, sseg=6))
    eimer.append(B.torus('GA_EimerBuegel', (ep.x, ep.y, 1.3), 0.15, 0.01, IRON, None, rot=(math.pi / 2, 0, 0), seg=24, sseg=6, scale=(1, 1, 1.2)))

    # --- Beet: Erdfleck (Grundbild), dann Loch, Hügel, Setzling (Varianten) ---
    yBe = wy(374)
    bex = wx(550, yBe)
    B.cone('GA_Beet', 0.0, 0.03, 0.92, 0.92, DIRT, None, xy=(bex, yBe), seg=40, bevel=0.01, scale=(1, 0.55, 1))
    beet1 = [B.cone('GA_Loch', 0.0, 0.035, 0.32, 0.32, toon('GA_Lochdunkel', '#2a1a0e', hi=0.0), None, xy=(bex, yBe), seg=32, bevel=0, scale=(1, 0.6, 1)),
             B.sphere('GA_Aushub', (bex + 0.55, yBe - 0.05, 0.03), (0.22, 0.14, 0.09), DIRT, None)]
    beet2 = [B.sphere('GA_Huegel', (bex, yBe, 0.02), (0.32, 0.22, 0.13), toon('GA_Huegelerde', '#5a3a1e', hi=0.0), None)]
    sapl = [B.rod('GA_Setzling', (bex, yBe, 0.1), (bex, yBe, 0.62), 0.025, TRUNK, None, seg=8)]
    for k, (dx, dz, r) in enumerate(((0, 0.66, 0), (-0.1, 0.42, -0.8), (0.1, 0.48, 0.8))):
        sapl.append(B.sphere(f'GA_SetzBlatt{k}', (bex + dx, yBe, dz), (0.09, 0.03, 0.05), toon('GA_Setzgruen', '#55b84a', hi=0.2), None, rot=(0, r, 0)))

    # --- Plumpsklo mit Dr.-Fred-Technik ---
    yP = 12.6
    px0, px1 = wx(770, yP), wx(882, yP)
    pcx, pw = (px0 + px1) / 2, px1 - px0
    PK = B.empty('GA_Plumpsklo')
    PK.location = (pcx, yP, 0)
    R.box(B, 'GA_KloHaus', (0, 0.7, 1.4), (pw, 1.4, 2.8), tex('R_Stegholz', 'holz_steg.png', 0.32, hi=0.1), PK, bevel=0.03)
    R.box(B, 'GA_KloTuer', (0, -0.02, 1.25), (pw - 0.5, 0.05, 2.3), WOOD, PK, bevel=0.02)
    for i in range(3):
        ohne_kontur(R.box(B, f'GA_KloBrett{i}', (-(pw - 0.5) / 2 + (i + 1) * (pw - 0.5) / 4, -0.05, 1.25), (0.02, 0.01, 2.2), WOODD, PK, bevel=0))
    for k, z in enumerate((0.5, 1.9)):
        R.box(B, f'GA_KloRiegel{k}', (0, -0.06, z), (pw - 0.6, 0.03, 0.12), WOODD, PK, bevel=0.01)
    mond = bmesh.new()   # Mondsichel in der Tür
    vs = [mond.verts.new((math.cos(a) * 0.17, 0, math.sin(a) * 0.17)) for a in (math.pi * (0.25 + 1.5 * i / 20) for i in range(21))]
    vs += [mond.verts.new((0.07 + math.cos(a) * 0.13, 0, math.sin(a) * 0.13)) for a in (math.pi * (1.75 - 1.5 * i / 20) for i in range(21))]
    mond.faces.new(vs)
    B.obj('GA_KloMond', mond, toon('GA_Mondloch', '#2a1408', hi=0.0), PK, (0, -0.06, 2.05), smooth=False)
    B.sphere('GA_KloKnauf', (pw / 2 - 0.35, -0.08, 1.2), (0.05, 0.05, 0.05), toon('L_Messing', '#d8a83c', hi=0.75), PK)
    for k, sx in enumerate((-1, 1)):
        R.box(B, f'GA_KloDach{k}', (sx * 0.5, 0.7, 3.05), (1.25, 1.8, 0.1), ROOF, PK, rot=(0, sx * 0.5, 0), bevel=0.01)
    R.box(B, 'GA_KloSchild', (0, -0.08, 2.62), (0.95, 0.03, 0.22), toon('GA_Schildcreme', '#f2e6c0', hi=0.1), PK, bevel=0.01)
    text(SC, 'GA_KloSchildText', 'ABORT', 0.15, toon('GA_Schildbraun', '#5a3a10', hi=0.1), (0, -0.1, 2.615), font=BLACKF, extrude=0.004, parent=PK)
    B.rod('GA_Antenne', (0, 0.7, 3.3), (0, 0.7, 3.95), 0.02, toon('L2_Metall', '#8d959e', hi=0.7), PK, seg=8)
    B.sphere('GA_Antennenbirne', (0, 0.7, 4.0), (0.08, 0.08, 0.08), toon('L2_Birnenrot', '#7a2020', hi=0.6), PK)
    B.cone('GA_Messuhr', 0, 0.04, 0.12, 0.12, toon('GA_Messing', '#d8b040', hi=0.6), PK, rot=(math.pi / 2, 0, 0), seg=24, bevel=0.01)
    bpy.data.objects['GA_Messuhr'].location = (-pw / 2 + 0.2, -0.04, 2.25)
    B.sphere('GA_KloLicht', (-pw / 2 + 0.2, -0.05, 1.85), (0.06, 0.03, 0.06), glow(toon('L2_Zyan', '#3cf0ff', hi=0.9), 2.4), PK)
    tube('GA_KloKabel', [(pcx - pw / 2 + 0.2, yP - 0.05, 2.3), (pcx - pw / 2 - 0.15, yP + 0.2, 3.0), (pcx - 0.1, yP + 0.6, 3.35)], 0.025, toon('GA_Kabelrot', '#c03030', hi=0.3), None)

    # --- Wegweiser zum Hafen (rechter Rand) ---
    ys = 11.4
    sx_ = wx(930, ys)
    B.rod('GA_WegPfahl', (sx_, ys, 0), (sx_, ys, 1.75), 0.06, WOODD, None, seg=10)
    WS = B.empty('GA_Wegschild')
    WS.location = (sx_, ys - 0.07, 1.45)
    bm = bmesh.new()
    f = bm.faces.new([bm.verts.new((x, 0, z)) for x, z in ((-0.45, -0.14), (0.35, -0.14), (0.52, 0), (0.35, 0.14), (-0.45, 0.14))])
    if f.normal.y > 0:
        f.normal_flip()
    B.obj('GA_WegBrett', bm, toon('GA_Wegholz', '#e8c890', hi=0.1), WS, (0, 0, 0), smooth=False, solid=0.05)
    text(SC, 'GA_WegText', 'Hafen', 0.15, toon('GA_Wegschrift', '#2a1a10', hi=0.1), (0.0, -0.035, -0.005), font=BLACKF, extrude=0.004, parent=WS)

    # Blumen auf der Wiese
    for i, (gx, gy, col) in enumerate(((60, 352, '#ff8a8a'), (180, 362, '#ffd23a'), (386, 356, '#fff0f0'), (446, 418, '#ff5f8a'), (690, 360, '#ffd23a'), (720, 420, '#fff0f0'), (900, 400, '#ff8a8a'), (330, 410, '#ffd23a'))):
        y = wy(gy)
        x = wx(gx, y)
        B.rod(f'GA_Stiel{i}', (x, y, 0), (x, y, 0.16), 0.008, toon('GA_Stielgruen', '#3f7a48', hi=0.0), None, seg=4)
        B.sphere(f'GA_Bluete{i}', (x, y, 0.18), (0.05, 0.05, 0.03), toon(f'GA_Bluete{col}', col, hi=0.3), None)
    # Licht: Sommersonne von links hinten, Himmelslicht von vorn
    sonne_aus(SC, (0.45, -0.5, -0.74), 4.2, (1.0, 0.95, 0.82))
    sonne_aus(SC, (-0.2, 0.9, -0.4), 0.9, (0.8, 0.9, 1.0))
    spec = {
        'anchors': {'Tuer': [bpy.data.objects[f'GA_Tuerrahmen{k}'] for k in range(3)], 'Zaun': [bpy.data.objects['GA_Latte0'], bpy.data.objects['GA_Latte1']] + [bpy.data.objects[f'GA_Pfahl{i}'] for i in range(n)],
                    'Brunnen': [bpy.data.objects['GA_Brunnen'], bpy.data.objects['GA_BrunnenDach0'], bpy.data.objects['GA_BrunnenDach1']], 'Eimer': eimer[:1],
                    'Beet': [bpy.data.objects['GA_Beet']], 'Klo': [PK], 'Wegweiser': [WS, bpy.data.objects['GA_WegPfahl']]},
        'points': {'kloBirne': bpy.data.objects['GA_Antennenbirne'], 'kloOben': (pcx, yP, 3.0), 'kloUnten': (pcx, yP, 0.0), 'sonne': tuple(sp),
                   'wasser': (bx_, yB, 0.93), 'beet': (bex, yBe, 0.0), 'zaunVogel0': (wx(376, yZ, ztop), yZ, ztop), 'zaunVogel1': (wx(478, yZ, ztop), yZ, ztop), 'zaunVogel2': (wx(640, yZ, ztop), yZ, ztop)},
        'sprites': {},
        'variants': {'eimer_weg': ([], eimer), 'beet1': (beet1, []), 'beet2': (beet2, []), 'beet3': (beet2 + sapl, [])},
    }
    return spec


# ------------------------------------------------------------------ Zukunftsgarten
def tentakelturm(B, tube, name, x, y, h, w, col, win, seed):
    """Organischer Wohnturm der Tentakel-Zukunft: geschwungener, sich verjüngender Schlauch mit Kuppe, hellen Saugnäpfen an
    einer Seite und leuchtenden Fenstern."""
    rnd = random.Random(seed)
    lean = rnd.uniform(-0.12, 0.12) * h
    pts = [(x, y, -0.5), (x - w * 0.15, y, h * 0.35), (x + w * 0.12 + lean * 0.5, y, h * 0.7), (x + lean, y, h)]
    mat = toon(f'FG_Turm{col}', col, hi=0.1)
    tube(name, pts, w / 2, mat, None, tip=0.55)
    B.sphere(name + 'Kuppe', (x + lean, y, h), (w * 0.3, w * 0.3, w * 0.34), mat, None)
    light = toon(f'FG_TurmHell{col}', '#' + ''.join(f'{min(255, int(int(col[i:i + 2], 16) * 1.45)):02x}' for i in (1, 3, 5)), hi=0.1)
    for i in range(5):
        z = h * (0.15 + i * 0.16)
        B.sphere(f'{name}Napf{i}', (x + w * 0.3 * (1 - z / h * 0.4) + lean * z / h, y - w * 0.32, z), (w * 0.09, w * 0.04, w * 0.07), light, None)
    for i in range(4):
        z = h * (0.2 + i * 0.18)
        on = rnd.random() < 0.75
        R.box(B, f'{name}Fenster{i}', (x - w * 0.12 + lean * z / h, y - w * 0.42, z), (w * 0.14, 0.05, w * 0.18), win if on else toon('FG_FensterAus', '#3a1858', hi=0.0), bevel=0)


def build_fgarten(SC):
    """Zukunftsgarten: Nachthimmel mit Mond, rosa Planet und geparkter Untertasse, Skyline aus geschwungenen Tentakel-Türmen,
    Wiese mit lila Weg, die Statue Seiner Lilaheit (das echte 3D-Modell, in Stein), das Klo 3000, die Laterne mit Energiezelle
    (Variante „zelle_weg“), der kahle Fleck für den Apfelbaum (der Baum ist ein Sprite und wächst im Spiel), der Palasteingang
    und ein Wegweiser zum Landeplatz."""
    B = R.Builder(SC)
    tube = R.tube_in(SC)
    GRASS, DIRT = tex('FG_Wiese', 'wiese_zukunft.png', 0.12, hi=0.0), tex('GA_Erde', 'erde.png', 0.35, hi=0.0)
    PATH, SKY = toon('FG_Weg', '#c9a8ea', hi=0.1), unlit('FG_Himmel', 'zukunftshimmel.png', 1.0)
    PURPLE, PURPLED, GOLD = toon('FG_Palast', '#5e2a86', hi=0.15), toon('FG_PalastDunkel', '#3a1252', hi=0.05), toon('FG_Gold', '#d8b040', hi=0.6)
    SILVER, SILVERD, VIO = toon('FG_Silber', '#c9d3dc', hi=0.4), toon('FG_SilberDunkel', '#8d959e', hi=0.4), toon('FG_Klotuer', '#6a2fa8', hi=0.1)
    STONE, STONED, LAMPP = toon('FG_Stein', '#b4a6d0', hi=0.2), toon('FG_SteinDunkel', '#8f86a6', hi=0.1), toon('FG_Laternenpfahl', '#3c2a5a', hi=0.2)
    WIN = glow(toon('FG_Fenster', '#ffe36b', hi=0.9), 1.8)
    BLACKF = 'C:/Windows/Fonts/ariblk.ttf'
    # Himmel, Mond, Planet, Untertasse
    quad(B, 'FG_Himmel', 300, 80, SKY, (0, 230, 25))
    bpy.data.objects['FG_Himmel'].visible_shadow = False
    mp = gp(180, 72, 190)
    B.sphere('FG_Mond', tuple(mp), (8.5, 8.5, 8.5), glow(toon('FG_Mond', '#ffe6a0', hi=0.9), 1.6), None)
    for k, (dx, dz, r) in enumerate(((-2.5, 2.0, 1.6), (3.0, -2.5, 1.1))):
        B.sphere(f'FG_MondKrater{k}', (mp.x + dx, mp.y - 7.6, mp.z + dz), (r, 0.6, r), glow(toon('FG_Krater', '#f0d488', hi=0.6), 1.3), None)
    pp = gp(250, 42, 200)
    B.sphere('FG_Planet', tuple(pp), (3.4, 3.4, 3.4), glow(toon('FG_Planet', '#ffc6e0', hi=0.8), 1.2), None)
    up = gp(700, 34, 110)
    B.sphere('FG_Untertasse', tuple(up), (6.0, 6.0, 1.6), toon('FG_Untertasse', '#9b2fd1', hi=0.5), None)
    B.sphere('FG_UntertasseKuppel', (up.x, up.y, up.z + 1.0), (2.4, 2.4, 1.6), SILVER, None)
    # Skyline aus Tentakel-Türmen (wie gezeichnet bei x 40, 300, 440, 640, 780, 920)
    for i, (gx, gh, gw, col) in enumerate(((40, 190, 54, '#3b1660'), (300, 150, 44, '#4a1f73'), (440, 230, 60, '#3b1660'), (640, 170, 50, '#5e2a8a'), (780, 240, 64, '#4a1f73'), (920, 160, 50, '#3b1660'))):
        yt = 55 + (i % 3) * 6
        u = upm(yt)
        tentakelturm(B, tube, f'FG_Turm{i}', wx(gx, yt), yt, gh / u * 0.9, gw / u, col, WIN, 300 + i)
    # Boden: Wiese (fein unterteilt für Freestyle), lila Weg zum Palast, kahler Fleck für den Baum
    wiese = R.plane(B, 'FG_Wiese', -150, 150, 4, 230, 0.0, GRASS)
    bm = bmesh.new()
    bm.from_mesh(wiese.data)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=60, use_grid_fill=True)
    bm.to_mesh(wiese.data)
    bm.free()
    left, right = [], []
    for i in range(13):
        k = i / 12
        gy = 440 - k * (440 - 338)
        y = wy(gy)
        gxc = 610 + k * 300
        half = 90 * (1 - k * 0.6)
        left.append((wx(gxc - half, y), y))
        right.append((wx(gxc + half, y), y))
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, 0.005)) for x, y in left + right[::-1]]
    f = bm.faces.new(vs)
    if f.normal.z < 0:
        f.normal_flip()
    ohne_kontur(B.obj('FG_Weg', bm, PATH, None, (0, 0, 0), smooth=False))
    yb = wy(356)
    B.cone('FG_Baumplatz', 0.0, 0.03, 84 / upm(yb), 84 / upm(yb), DIRT, None, xy=(wx(700, yb), yb), seg=40, bevel=0.01, scale=(1, 0.55, 1))

    # --- Klo 3000 (silberne Kapsel, Mitte unten bei 140/340: dort leuchtet im Spiel der Zyan-Ring) ---
    yK = wy(340) + 0.8
    kx = wx(140, yK)
    KZ = B.empty('FG_Klo')
    KZ.location = (kx, yK, 0)
    B.cone('FG_KloRumpf', 0.0, 2.3, 0.82, 0.82, SILVER, KZ, xy=(0, 0), seg=40, bevel=0.03)
    B.sphere('FG_KloKappe', (0, 0, 2.3), (0.82, 0.82, 0.55), SILVER, KZ)
    B.sphere('FG_KloHaube', (0, 0, 2.75), (0.5, 0.5, 0.2), toon('FG_Haube', '#e6edf2', hi=0.7), KZ)
    R.box(B, 'FG_KloTuer', (0, -0.78, 1.25), (0.95, 0.12, 2.0), VIO, KZ, bevel=0.2)
    R.box(B, 'FG_KloGlanz', (-0.28, -0.85, 1.4), (0.08, 0.02, 1.0), toon('FG_Glanz', '#f4f0ff', hi=0.6), KZ, bevel=0.03)
    R.box(B, 'FG_KloSchild', (0, -0.86, 0.75), (0.7, 0.03, 0.18), toon('FG_SchildGelb', '#ffd23a', hi=0.4), KZ, bevel=0.02)
    text(SC, 'FG_KloText', 'KLO 3000', 0.11, toon('FG_KloSchrift', '#4a1a6a', hi=0.2), (0, -0.885, 0.745), font=BLACKF, extrude=0.004, parent=KZ)
    B.rod('FG_KloRohr', (0, 0, 2.9), (0, 0, 3.35), 0.05, SILVERD, KZ, seg=10)
    B.sphere('FG_KloBirne', (0, 0, 3.42), (0.09, 0.09, 0.09), toon('L2_Birnenrot', '#7a2020', hi=0.6), KZ)
    B.cone('FG_KloSockel', 0.0, 0.06, 0.95, 0.95, toon('FG_Sockel', '#2a1a40', hi=0.2), KZ, xy=(0, 0), seg=40, bevel=0.01)

    # --- Statue Seiner Lilaheit: das 3D-Modell des Lila Tentakels, in Stein ---
    yS = wy(340) + 0.6
    sx = wx(350, yS)
    p0, p1 = gp(296, 262, yS - 0.5), gp(404, 340, yS - 0.5)
    pw = p1.x - p0.x
    R.box(B, 'FG_Sockel', (sx, yS, 0.6), (pw, 1.0, 1.2), STONED, bevel=0.03)
    R.box(B, 'FG_SockelPlatte', (sx, yS, 1.24), (pw + 0.2, 1.15, 0.1), STONE, bevel=0.02)
    text(SC, 'FG_SockelText1', 'SEINE LILAHEIT', 0.13, toon('FG_Inschrift', '#2a1a40', hi=0.1), (sx, yS - 0.51, 0.78), font=BLACKF, extrude=0.004)
    text(SC, 'FG_SockelText2', 'Herrscher der Welt', 0.09, toon('FG_Inschrift', '#2a1a40', hi=0.1), (sx, yS - 0.51, 0.55), font='C:/Windows/Fonts/georgiab.ttf', extrude=0.004)
    ST = B.empty('FG_Statue')
    src = bpy.data.scenes['Tentakel3D_v2']
    from mathutils import Matrix
    for o in list(src.objects):
        if o.type not in ('MESH', 'CURVE'):
            continue
        n = o.copy()
        n.data = o.data.copy()
        n.name = 'FG_Statue_' + o.name
        SC.collection.objects.link(n)
        n.data.materials.clear()
        n.data.materials.append(STONED if 'Napf' in o.name or 'Schlitz' in o.name else STONE)
        n.parent = ST
        n.matrix_parent_inverse = Matrix.Identity(4)
    # Krone: „Herrscher der Welt“ (und damit liest man die Statue eindeutig als Seine Lilaheit)
    CR = toon('FG_Krone', '#e8c040', hi=0.7)
    B.cone('FG_Krone', 3.32, 3.56, 0.36, 0.42, CR, ST, xy=(-0.12, 0.0), seg=24, bevel=0.01)
    for k in range(6):
        a = 2 * math.pi * k / 6
        B.cone(f'FG_KronenZacke{k}', 3.56, 3.86, 0.09, 0.0, CR, ST, xy=(-0.12 + math.cos(a) * 0.38, math.sin(a) * 0.38), seg=8, bevel=0)
        B.sphere(f'FG_KronenPerle{k}', (-0.12 + math.cos(a) * 0.38, math.sin(a) * 0.38, 3.88), (0.05, 0.05, 0.05), toon('FG_Perle', '#ff5fa8', hi=0.8), ST)
    ST.location, ST.rotation_euler, ST.scale = (sx, yS, 1.29), (0, 0, 0.95), (0.62, 0.62, 0.62)   # Dreiviertelansicht: Lippen und Arme sichtbar

    # --- Laterne mit Energiezelle (Kopf bei 545/47 wie gezeichnet: dort schwirren die Glühwürmchen) ---
    yL = wy(342)
    lb = Vector((wx(545, yL), yL, 0))
    lh = gp(545, 47, yL)
    tube('FG_Laternenpfahl', [(lb.x - 0.05, yL, -0.2), (lb.x - 0.18, yL, lh.z * 0.3), (lb.x + 0.15, yL, lh.z * 0.62), (lb.x - 0.05, yL, lh.z * 0.86), (lh.x, yL, lh.z - 0.32)], 0.1, LAMPP, None, tip=0.6)
    B.sphere('FG_LaternenFuss', (lb.x, yL, 0.02), (0.3, 0.3, 0.08), LAMPP, None)
    u = upm(yL)
    hw, hh = 54 / u, 46 / u
    for k, (dx, dz, sx_, sz_) in enumerate(((0, hh / 2, hw, 0.06), (0, -hh / 2, hw, 0.06), (-hw / 2, 0, 0.06, hh), (hw / 2, 0, 0.06, hh))):
        R.box(B, f'FG_LampenRahmen{k}', (lh.x + dx, yL, lh.z + dz), (sx_, hw, sz_), toon('FG_Lampenkopf', '#2a1d40', hi=0.3), bevel=0.01)
    B.cone('FG_LampenDach', lh.z + hh / 2, lh.z + hh / 2 + 0.25, hw * 0.75, 0.05, toon('FG_Lampenkopf', '#2a1d40', hi=0.3), None, xy=(lh.x, yL), seg=4, bevel=0, rot=(0, 0, math.pi / 4))
    glas_an = R.box(B, 'FG_LampenGlas', (lh.x, yL, lh.z), (hw - 0.06, hw - 0.12, hh - 0.06), glow(toon('FG_Lampenschein', '#a6ff9a', hi=0.8), 1.2), bevel=0)
    glas_aus = R.box(B, 'FG_LampenGlasAus', (lh.x, yL, lh.z), (hw - 0.06, hw - 0.12, hh - 0.06), toon('FG_LampeDunkel', '#14101e', hi=0.4), bevel=0)
    zelle = [glas_an, R.box(B, 'FG_Zelle', (lh.x, yL - hw / 2 + 0.02, lh.z), (hw * 0.6, 0.06, hh * 0.32), glow(toon('L2_Zellgruen', '#7dff7a', hi=0.8), 2.0), bevel=0.02)]
    for k, sx2 in enumerate((-1, 1)):
        zelle.append(R.box(B, f'FG_ZellKappe{k}', (lh.x + sx2 * hw * 0.32, yL - hw / 2 + 0.02, lh.z), (0.06, 0.08, hh * 0.36), toon('L_Messing', '#d8a83c', hi=0.75), bevel=0.01))
    zelle.append(lamp(SC, 'FG_LichtLaterne', (lh.x, yL - hw, lh.z), 60, (0.55, 1.0, 0.5), 0.3, dist=1.2))

    # --- Palasteingang rechts: lila Mauer mit Spitzbogentür, Goldsäule, Schild PALAST ---
    yP = 12.4
    px0 = wx(866, yP)
    dx0, dx1 = wx(886, yP), wx(1000, yP)
    flaeche(B, 'FG_Palastmauer', 'xz', px0, 9.5, 0, 5.5, [(dx0, dx1, 0, 4.4)], PURPLE, (0, yP + 0.3, 0), 0.6)
    bogenzwickel(B, 'FG_PalastBogen', (dx0 + dx1) / 2, 2.6, (dx1 - dx0) / 2, 4.4, yP, 0.6, PURPLE)
    R.box(B, 'FG_PalastInnen', ((dx0 + dx1) / 2, yP + 0.55, 2.2), (dx1 - dx0, 0.05, 4.4), toon('FG_PalastNacht', '#1a0a2a', hi=0.0), bevel=0)
    B.cone('FG_Goldsaeule', 0, 3.3, 0.12, 0.12, GOLD, None, xy=(dx0 - 0.1, yP - 0.12), seg=16, bevel=0.01)
    B.sphere('FG_SaeulenKnauf', (dx0 - 0.1, yP - 0.12, 3.36), (0.16, 0.16, 0.12), GOLD, None)
    s0, s1 = gp(872, 90, yP - 0.1), gp(958, 66, yP - 0.1)
    R.box(B, 'FG_PalastSchild', ((s0.x + s1.x) / 2, yP - 0.1, (s0.z + s1.z) / 2), (s1.x - s0.x, 0.08, s1.z - s0.z), GOLD, bevel=0.03)
    text(SC, 'FG_PalastText', 'PALAST', 0.26, toon('FG_SchildLila', '#4a1a6a', hi=0.2), ((s0.x + s1.x) / 2, yP - 0.15, (s0.z + s1.z) / 2 - 0.02), font=BLACKF, extrude=0.006)
    lamp(SC, 'FG_LichtPalast', ((dx0 + dx1) / 2, yP - 0.6, 3.0), 80, (1.0, 0.75, 0.95), 0.5, dist=3.0)

    # --- Wegweiser zum Landeplatz (linker Rand) ---
    ys = 11.4
    sx3 = wx(34, ys)
    B.rod('FG_WegPfahl', (sx3, ys, 0), (sx3, ys, 1.75), 0.06, toon('FG_Wegpfahl', '#3c2a5a', hi=0.2), None, seg=10)
    WS = B.empty('FG_Wegschild')
    WS.location = (sx3, ys - 0.07, 1.42)
    bm = bmesh.new()
    f = bm.faces.new([bm.verts.new((x, 0, z)) for x, z in ((0.45, -0.17), (-0.38, -0.17), (-0.56, 0), (-0.38, 0.17), (0.45, 0.17))])
    if f.normal.y > 0:
        f.normal_flip()
    B.obj('FG_WegBrett', bm, glow(toon('FG_WegNeon', '#7fe8ff', hi=0.6), 1.2), WS, (0, 0, 0), smooth=False, solid=0.05)
    text(SC, 'FG_WegText', 'Landeplatz', 0.115, toon('FG_WegSchrift', '#140828', hi=0.1), (-0.02, -0.035, -0.005), font=BLACKF, extrude=0.004, parent=WS)

    # --- Apfelbaum (Sprite: wächst im Spiel aus dem kahlen Fleck) ---
    BT = B.empty('FG_Baum')
    BT.location = (wx(700, yb), yb, 0)
    baum(B, 'FG_Baum', 0, 0, 0.92, toon('GA_Laub', '#3f9a3a', hi=0.1), toon('GA_LaubHell', '#55b84a', hi=0.1), toon('GA_Stamm', '#6b4424', hi=0.05), parent=BT, aepfel=toon('G_Apfel', '#e0302a', hi=0.7))

    # Licht: Mondlicht von links hinten (kühl-rosa), Stadtschein von vorn rechts, Klo-Zyan
    sonne_aus(SC, (0.5, -0.45, -0.74), 2.6, (0.95, 0.85, 1.0))
    sonne_aus(SC, (-0.4, 0.85, -0.35), 0.7, (1.0, 0.6, 0.9))
    lamp(SC, 'FG_LichtKlo', (kx, yK - 1.0, 0.3), 60, (0.3, 0.95, 1.0), 0.4, dist=2.0)
    spec = {
        'anchors': {'Klo': [KZ], 'Statue': [ST, bpy.data.objects['FG_Sockel']], 'Baumplatz': [bpy.data.objects['FG_Baumplatz']], 'Baum': [BT],
                    'Laterne': [bpy.data.objects['FG_Laternenpfahl'], bpy.data.objects['FG_LampenDach']], 'Palast': [bpy.data.objects['FG_Palastmauer'], bpy.data.objects['FG_PalastSchild']],
                    'Wegweiser': [WS, bpy.data.objects['FG_WegPfahl']]},
        'points': {'kloBirne': bpy.data.objects['FG_KloBirne'], 'kloOben': (kx, yK, 3.0), 'kloUnten': (kx, yK - 0.8, 0.0), 'lampe': tuple(lh), 'lampeFuss': (lb.x, yL, 0.0),
                   'baum': (wx(700, yb), yb, 0.0)},
        'sprites': {'baum': (BT, [o for o in SC.objects if o.parent == BT])},
        'variants': {'zelle_weg': ([glas_aus], zelle)},
    }
    return spec


ROOMS = {'lobby': (build_lobby, ('#2a2238', '#120c1c')), 'labor': (build_labor, ('#1a3a3a', '#0a1a1c')), 'gasthaus': (build_gasthaus, ('#d8b88a', '#4a2e18')),
         'garten1776': (build_garten1776, ('#d6f1ff', '#62bdf6')), 'fgarten': (build_fgarten, ('#c85a8e', '#1c0838'))}


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
