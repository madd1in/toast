# Feinschliff für Hoagie und Laverne (in Blender ausführen, vorher REPO setzen):
#   REPO = r'C:/.../Tentakel-Toast'; exec(open(REPO + '/art/blender/helden_v2.py').read())
# Ändert die Quellmodelle in der Szene Helden3D (danach figur_rig.py und figur_frames.py für hoagie/laverne):
# Hoagie bekommt statt des Ei-Bauchs einen gedrechselten Rumpf (Bauch vorn, Brust, Schultern) mit T-Shirt-Saum,
# Rippkragen, Gürtel mit Schnalle und Blitz-Logo auf dem Bauch, dazu Ohren, Doppelkinn, Ziegenbart, Koteletten,
# buschige Brauen, lange Haarsträhnen unter der Kappe (mit Knopf), richtige Ärmel, Hände mit Daumen und
# Schweißband und klobige Stiefel mit Sohle und Schaft. Laverne bekommt statt der dünnen Igel-Stacheln eine
# wuschelige Frisur aus dicken, geschwungenen Büscheln mit Pony und Seitensträhnen.
# Alle Maße in Metern im Figurenraum: Blick nach +x, −y ist die rechte Körperseite, Füße bei z = 0.
import bpy, bmesh, math, random, sys, importlib
from mathutils import Vector, Matrix, Euler
sys.path.insert(0, REPO + '/art/blender')
import figur_lib, tropen
importlib.reload(figur_lib)
importlib.reload(tropen)
from figur_lib import toon

SC = bpy.data.scenes['Helden3D']
M = bpy.data.materials


def LRS(loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    return Matrix.LocRotScale(Vector(loc), Euler(rot).to_quaternion(), Vector(scale))


def prim(bm, kind, mtx, mi=0, **kw):
    """Grundkörper direkt in bm (mit Transformation und Materialnummer)."""
    if kind == 'sphere':
        r = bmesh.ops.create_uvsphere(bm, u_segments=kw.get('u', 28), v_segments=kw.get('v', 14), radius=1.0, matrix=mtx)
    elif kind == 'cone':
        r = bmesh.ops.create_cone(bm, cap_ends=kw.get('caps', True), cap_tris=False, segments=kw.get('seg', 28), radius1=kw['r0'], radius2=kw['r1'], depth=kw['d'], matrix=mtx)
    elif kind == 'cube':
        r = bmesh.ops.create_cube(bm, size=1.0, matrix=mtx)
    elif kind == 'torus':
        R_, r_, seg, ss = kw['R'], kw['r'], kw.get('seg', 40), kw.get('ss', 10)
        rings = [[bm.verts.new(mtx @ Vector(((R_ + r_ * math.cos(b)) * math.cos(a), (R_ + r_ * math.cos(b)) * math.sin(a), r_ * math.sin(b))))
                  for b in [2 * math.pi * j / ss for j in range(ss)]] for a in [2 * math.pi * i / seg for i in range(seg)]]
        fs = [bm.faces.new((rings[i][j], rings[(i + 1) % seg][j], rings[(i + 1) % seg][(j + 1) % ss], rings[i][(j + 1) % ss])) for i in range(seg) for j in range(ss)]
        for f in fs:
            f.material_index = mi
        return
    for f in {f for v in r['verts'] for f in v.link_faces}:
        f.material_index = mi


def ering(bm, x0, rx, w, z, r, mi=0, seg=48, ss=10):
    """Ring mit rundem Querschnitt (Radius r) entlang einer Ellipse (Mitte x0, Halbachsen rx/w) auf Höhe z."""
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        c = Vector((x0 + rx * math.cos(a), w * math.sin(a), z))
        n = Vector((math.cos(a) / rx, math.sin(a) / w, 0)).normalized()
        rings.append([bm.verts.new(c + (n * math.cos(2 * math.pi * j / ss) + Vector((0, 0, math.sin(2 * math.pi * j / ss)))) * r) for j in range(ss)])
    for i in range(seg):
        for j in range(ss):
            f = bm.faces.new((rings[i][j], rings[(i + 1) % seg][j], rings[(i + 1) % seg][(j + 1) % ss], rings[i][(j + 1) % ss]))
            f.material_index = mi


def put(name, bm, mats, parent, loc=(0, 0, 0), subsurf=0, smooth=True, solid=0.0):
    """Ersetzt die Mesh-Daten des Objekts (Name, Eltern und Platz bleiben für das Rig gleich) oder legt es neu an."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    for m in mats:
        me.materials.append(m)
    o = bpy.data.objects.get(name)
    if o is None:
        o = bpy.data.objects.new(name, me)
        SC.collection.objects.link(o)
    else:
        o.data = me
        o.modifiers.clear()
    o.parent = parent
    o.matrix_parent_inverse = Matrix.Identity(4)
    o.location, o.rotation_euler, o.scale = loc, (0, 0, 0), (1, 1, 1)
    if subsurf:
        o.modifiers.new('Glatt', 'SUBSURF').levels = subsurf
    if solid:
        md = o.modifiers.new('Dicke', 'SOLIDIFY')
        md.thickness = solid
    return o


def sphere_obj(name, loc, scale, mat, parent, rot=(0, 0, 0)):
    bm = bmesh.new()
    prim(bm, 'sphere', LRS(rot=rot, scale=scale))
    return put(name, bm, [mat], parent, loc)


def strand(name, pts, r0, mat, parent, r1=0.006, ring=12):
    """Haarsträhne als spitz zulaufendes Rohr (tropen.tube_mesh), hängt ohne Ausgleichsmatrix an parent."""
    o = bpy.data.objects.get(name)
    if o:
        bpy.data.objects.remove(o, do_unlink=True)
    o, C, T = tropen.tube_mesh(SC, name, pts, lambda s: r1 + (r0 - r1) * (1 - s) ** 0.85 * min(1.0, 0.55 + s * 4), mat, parent, ring=ring, n_per=6)
    o.matrix_parent_inverse = Matrix.Identity(4)
    return o


def drop(*names):
    for n in names:
        o = bpy.data.objects.get(n)
        if o:
            bpy.data.objects.remove(o, do_unlink=True)


# ------------------------------------------------------------------ Hoagie
H = bpy.data.objects['Hoagie']
SHIRT, SKIN, JEANS, CAP, BOOT = M['ShirtSchwarz'], M['HautB'], M['Jeans'], M['KappeRot'], M['Stiefel']
HAIR = toon('H_HaarBraun', '#3a2418', hi=0.5)
RIB = toon('H_Rippe', '#34303e', hi=0.4)
BELT, GOLD, SOLE, LOGO = toon('H_Leder', '#5a3a22', hi=0.5), toon('N_Gold', '#e9b53c', hi=0.6), toon('H_Sohle', '#2a1a12', hi=0.3), M['Weiss']

# Rumpf: Ringe mit ovalem Querschnitt; vorn wölbt sich der Bauch, oben werden Brust und Schultern schmaler
PROFILE = [   # z, halbe Breite, vorn, hinten
    (0.555, 0.27, 0.27, 0.21), (0.62, 0.295, 0.32, 0.22), (0.72, 0.33, 0.385, 0.235), (0.84, 0.355, 0.425, 0.25),
    (0.96, 0.355, 0.405, 0.26), (1.08, 0.345, 0.335, 0.26), (1.18, 0.325, 0.255, 0.24), (1.26, 0.285, 0.185, 0.2),
    (1.32, 0.19, 0.12, 0.135), (1.365, 0.1, 0.085, 0.09)]


def prof_at(z):
    for (z0, *a), (z1, *b) in zip(PROFILE, PROFILE[1:]):
        if z0 <= z <= z1:
            t = (z - z0) / (z1 - z0)
            t = t * t * (3 - 2 * t)
            return [u + (v - u) * t for u, v in zip(a, b)]
    return PROFILE[0][1:] if z < PROFILE[0][0] else PROFILE[-1][1:]


def torso_x(y, z):
    """Vorderseite des Rumpfs an (y, z) – für Logo und Schnalle."""
    w, f, b = prof_at(z)
    x0, rx = (f - b) / 2, (f + b) / 2
    return x0 + rx * math.sqrt(max(0.0, 1 - (y / w) ** 2))


bm = bmesh.new()
NZ, NA = 40, 36
rings = []
for i in range(NZ + 1):
    z = PROFILE[0][0] + (PROFILE[-1][0] - PROFILE[0][0]) * i / NZ
    w, f, b = prof_at(z)
    x0, rx = (f - b) / 2, (f + b) / 2
    rings.append([bm.verts.new((x0 + rx * math.cos(2 * math.pi * j / NA), w * math.sin(2 * math.pi * j / NA), z)) for j in range(NA)])
for i in range(NZ):
    for j in range(NA):
        bm.faces.new((rings[i][j], rings[i][(j + 1) % NA], rings[i + 1][(j + 1) % NA], rings[i + 1][j]))
bm.faces.new(list(reversed(rings[0])))
bm.faces.new(rings[-1])
for (zz, mi) in ((0.565, 0), (1.352, 1)):   # Saum unten, Rippkragen oben
    w, f, b = prof_at(zz)
    x0, rx = (f - b) / 2, (f + b) / 2
    ering(bm, x0, rx, w, zz, 0.024 if mi == 0 else 0.03, mi)
put('H_Bauch', bm, [SHIRT, RIB], H, subsurf=1)
# Gürtel mit Schnalle (der Bauch hängt vorn ein Stück drüber)
bm = bmesh.new()
w, f, b = prof_at(0.585)
ering(bm, (f - b) / 2 - 0.01, (f + b) / 2 - 0.02, w - 0.02, 0.585, 0.032, 0)
prim(bm, 'cube', LRS((torso_x(0, 0.585) - 0.005, 0, 0.583), scale=(0.03, 0.085, 0.06)), 1)
put('H_Guertel', bm, [BELT, GOLD], H)
# Blitz-Logo auf dem Bauch (auf die Bauchwölbung gelegt, etwas zur Kamera hin)
BOLT = [(0.07, 1.13), (-0.06, 0.95), (0.0, 0.95), (-0.07, 0.76), (0.09, 0.99), (0.025, 0.99), (0.1, 1.13)]
bm = bmesh.new()
vs = [bm.verts.new((0, -0.17 + y * 1.35, 0.95 + (z - 0.95) * 1.2)) for y, z in BOLT]
bm.faces.new(vs)
bmesh.ops.triangulate(bm, faces=bm.faces[:])
bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=3, use_grid_fill=True)
for v in bm.verts:   # auf die Wölbung legen
    v.co.x = torso_x(v.co.y, v.co.z) + 0.008
put('H_Blitz', bm, [LOGO], H, smooth=False, solid=0.01)
# Kopf: Ohren, Doppelkinn, Ziegenbart, Koteletten, Brauen, Knopf auf der Kappe
for k, y in (('L', 1), ('R', -1)):
    sphere_obj(f'H_Ohr{k}', (0.06, y * 0.192, 1.455), (0.045, 0.03, 0.062), SKIN, H)
    sphere_obj(f'H_Kotelette{k}', (0.105, y * 0.186, 1.445), (0.03, 0.016, 0.062), HAIR, H)
    sphere_obj(f'H_Braue{k}', (0.262, y * 0.075, 1.565), (0.05, 0.034, 0.02), HAIR, H, rot=(0, -0.25, y * 0.25))
sphere_obj('H_Kinn', (0.13, 0, 1.325), (0.155, 0.165, 0.085), SKIN, H)
sphere_obj('H_Bart', (0.245, 0, 1.318), (0.038, 0.055, 0.036), HAIR, H)
sphere_obj('H_KappeKnopf', (0.07, 0, 1.715), (0.03, 0.03, 0.022), CAP, H)
# Haare: lange Strähnen, die hinten unter der Kappe hervorkommen und über Nacken und Schultern fallen
drop('H_Haare')
sphere_obj('H_Haare', (-0.035, 0, 1.47), (0.19, 0.205, 0.19), HAIR, H)
rnd = random.Random(7)
for i in range(11):
    a = math.radians(108 + 144 * i / 10)   # rund um den Hinterkopf, von der rechten zur linken Schläfe
    ca, sa = math.cos(a), math.sin(a)
    root = Vector((0.04 + 0.18 * ca, 0.2 * sa, 1.53))
    flare = 1.0 + 0.25 * abs(sa)
    L = rnd.uniform(0.3, 0.38) + 0.06 * (1 - abs(sa))
    pts = [root, root + Vector((0.07 * ca * flare, 0.07 * sa * flare, -0.1)), root + Vector((0.1 * ca * flare - 0.02, 0.11 * sa * flare, -L * 0.6)),
           root + Vector((0.08 * ca * flare - 0.05 + rnd.uniform(-0.02, 0.02), 0.13 * sa * flare, -L))]
    strand(f'H_Straehne{i}', pts, rnd.uniform(0.05, 0.062), HAIR, H)
# Ärmel: kurzes, leicht ausgestelltes Rohr mit Saum und runder Schulter (Ursprung = Schultergelenk)
for k, y in (('L', 1), ('R', -1)):
    bm = bmesh.new()
    prim(bm, 'sphere', LRS((0, 0, 0.005), scale=(0.112, 0.108, 0.1)))
    prim(bm, 'cone', LRS((0, 0, -0.06)), r0=0.118, r1=0.108, d=0.15, seg=28, caps=False)
    prim(bm, 'torus', LRS((0, 0, -0.135)), 0, R=0.117, r=0.013, seg=32, ss=8)
    put(f'H_Aermel{k}', bm, [SHIRT], H, loc=(0, y * 0.33, 1.2))
    # Hände: Handballen, Finger, Daumen nach vorn, rotes Schweißband
    bm = bmesh.new()
    prim(bm, 'sphere', LRS((0, 0, 0), scale=(0.075, 0.058, 0.08)))
    prim(bm, 'sphere', LRS((0.025, 0, -0.06), scale=(0.062, 0.054, 0.05)))
    prim(bm, 'sphere', LRS((0.06, y * -0.022, 0.005), rot=(0, 0.5, 0), scale=(0.03, 0.026, 0.048)))
    prim(bm, 'torus', LRS((0, 0, 0.068), scale=(1, 0.95, 1)), 1, R=0.066, r=0.022, seg=28, ss=8)
    put(f'H_Hand{k}', bm, [SKIN, CAP], H, loc=(0.14, y * 0.34, 0.8))
    # Stiefel: Schaft, Oberleder, runde Kappe vorn, dicke Sohle
    bm = bmesh.new()
    prim(bm, 'cone', LRS((-0.03, 0, 0.095)), r0=0.09, r1=0.085, d=0.13, seg=24)
    prim(bm, 'sphere', LRS((0.0, 0, 0.02), scale=(0.16, 0.098, 0.08)))
    prim(bm, 'sphere', LRS((0.1, 0, -0.005), scale=(0.085, 0.092, 0.065)))
    prim(bm, 'cube', LRS((0.015, 0, -0.06), scale=(0.34, 0.2, 0.035)), 1)
    put(f'H_Stiefel{k}', bm, [BOOT, SOLE], H, loc=(0.06, y * 0.12, 0.09), subsurf=1)
drop('H_Blitz.001')

# ------------------------------------------------------------------ Laverne
Lv = bpy.data.objects['Laverne']
LHAIR = M['HaarL']
drop(*[f'L_Stachel{i}' for i in range(14)], *[f'L_Haar{i}' for i in range(40)])
kap = bpy.data.objects['L_HaarKappe']
kap.location, kap.scale = (-0.025, 0, 1.655), (0.175, 0.165, 0.14)
rnd = random.Random(21)
TUFTS = []
for i in range(12):   # oben: wuschelige Büschel in alle Richtungen, die Spitzen leicht eingedreht
    a = 2 * math.pi * i / 12 + rnd.uniform(-0.2, 0.2)
    rr = 0.05 if i % 2 else 0.09
    root = Vector((-0.04 + rr * math.cos(a), rr * math.sin(a), 1.765))
    out = Vector((math.cos(a) * rnd.uniform(0.7, 1.1), math.sin(a) * rnd.uniform(0.7, 1.1), rnd.uniform(0.9, 1.5))).normalized()
    L = rnd.uniform(0.12, 0.19)
    side = out.cross(Vector((0, 0, 1))).normalized() * rnd.uniform(0.02, 0.05) * (1 if i % 3 else -1)
    TUFTS.append(([root, root + out * L * 0.5 + side * 0.5, root + out * L + side * 1.6 + Vector((0, 0, -0.035))], rnd.uniform(0.05, 0.064)))
for i in range(4):   # hinten: nach hinten unten
    y = -0.12 + 0.08 * i
    root = Vector((-0.14, y, 1.68))
    TUFTS.append(([root, root + Vector((-0.08, y * 0.6, -0.04)), root + Vector((-0.13, y * 1.1, -0.11))], 0.05))
for k in (-1, 1):   # über den Ohren: zur Seite und nach unten
    for j in range(2):
        root = Vector((-0.04 + 0.07 * j, k * 0.15, 1.66))
        TUFTS.append(([root, root + Vector((0.0, k * 0.08, -0.03)), root + Vector((0.02 - 0.03 * j, k * 0.12, -0.11))], 0.045))
for i in range(5):   # Pony: über der Stirn nach vorn unten, die Augen bleiben frei
    y = -0.09 + 0.045 * i
    root = Vector((0.05, y, 1.75))
    TUFTS.append(([root, root + Vector((0.08, y * 0.25, -0.02)), root + Vector((0.13, y * 0.4 + rnd.uniform(-0.01, 0.01), -0.07))], 0.04))
for i, (pts, r0) in enumerate(TUFTS):
    strand(f'L_Haar{i}', pts, r0, LHAIR, Lv, r1=0.016)
HAIR_L = [f'L_Haar{i}' for i in range(len(TUFTS))]
HOAGIE_HEAD = ['H_OhrL', 'H_OhrR', 'H_KoteletteL', 'H_KoteletteR', 'H_BraueL', 'H_BraueR', 'H_Kinn', 'H_Bart', 'H_KappeKnopf'] + [f'H_Straehne{i}' for i in range(11)]
print('Hoagie', len(H.children), 'Laverne', len(Lv.children), 'Laverne-Büschel', len(TUFTS))
