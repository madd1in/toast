# Tentakel, Version 2 – näher an den Klassikern (in Blender ausführen, vorher REPO setzen):
#   REPO = r'C:/.../Tentakel-Toast'; exec(open(REPO + '/art/blender/tent_v2.py').read())
# Baut die Szene „Tentakel3D_v2“ mit denselben Teilnamen wie das alte Titel-Modell (tent_build.py rendert daraus):
# ein leicht S-förmig geschwungener Schlauch mit breitem Saugfuß, die Kuppe nach vorn geneigt, vorn ein dicker,
# vorstehender Lippen-„Schnabel“ (Ober- und Unterlippe, dunkler Mundschlitz), darunter eine Reihe heller Saugnäpfe
# mit dunkler Mitte; dazu dünne, gebogene Arme mit runden Enden (nur Lila und der nette Rosa nutzen sie).
# Vorn ist −x (wie beim alten Modell), Kuppe bei 3,44 m.
import bpy, bmesh, math, sys, importlib
from mathutils import Vector
sys.path.insert(0, REPO + '/art/blender')
import figur_lib
importlib.reload(figur_lib)
from figur_lib import Builder

H = 3.44
SC = bpy.data.scenes.get('Tentakel3D_v2') or bpy.data.scenes.new('Tentakel3D_v2')
for o in list(SC.collection.objects):
    bpy.data.objects.remove(o, do_unlink=True)
M = bpy.data.materials
BODY, LIP, MOUTH, CUP = M['TentKoerper'], M['TentLippe'], M['TentMund'], M['TentNapf']


def spine(z):
    """Mittellinie: leichter Bauch nach vorn in der Mitte, oben neigt sich der Kopf nach vorn (−x)."""
    u = z / H
    return Vector((-0.06 * math.sin(math.pi * u) - 0.2 * max(0.0, u - 0.55) ** 2 / 0.2, 0, z))


def radius(z):
    if z < 0.18:   # Saugfuß: breit ausgestellt
        return 0.62 - (0.62 - 0.47) * (z / 0.18) ** 0.6
    if z < 0.6:
        return 0.47 - 0.04 * (z - 0.18) / 0.42
    return 0.43 - 0.05 * (z - 0.6) / (2.4)


B = Builder(SC)
# Körper als Loft aus Ringen entlang der Mittellinie (oben offen, die Kuppe schließt ab)
bm = bmesh.new()
N, K, ZT = 40, 40, 3.0
rings = []
for i in range(N + 1):
    z = ZT * (i / N) ** 1.15
    c, r = spine(z), radius(z)
    rings.append([bm.verts.new(c + Vector((math.cos(2 * math.pi * j / K) * r, math.sin(2 * math.pi * j / K) * r, 0))) for j in range(K)])
for a, b in zip(rings, rings[1:]):
    for j in range(K):
        bm.faces.new((a[j], a[(j + 1) % K], b[(j + 1) % K], b[j]))
bm.faces.new(list(reversed(rings[0])))
body = B.obj('TentKoerper', bm, BODY, None, (0, 0, 0), smooth=True)
# Kuppe: Halbkugel, etwas gestreckt, sitzt auf dem obersten Ring
ct, rt = spine(ZT), radius(ZT)
B.sphere('TentKuppe', tuple(ct), (rt, rt, H - ZT), BODY, None)


def front(z, ang=0.0, out=0.0):
    """Punkt auf der Körperoberfläche bei Höhe z, Richtung vorn (−x) um ang (rad, + = zur Kamera hin) gedreht."""
    d = Vector((-math.cos(ang), math.sin(ang), 0))
    return spine(z) + d * (radius(z) + out), d


# Lippen-Schnabel: dicke Unterlippe (TentLippe – das Spiel öffnet den Mund, indem es sie streckt), Oberlippe, Mundschlitz
zm = 2.42
p, d = front(zm + 0.06, 0.35, -0.02)   # Oberlippe: groß, wulstig, leicht nach unten gebogen – sitzt im Körper fest
B.sphere('TentOberlippe', tuple(p), (0.27, 0.37, 0.16), LIP, None, rot=(0, 0.22, -0.35))
p, d = front(zm - 0.13, 0.35, -0.05)   # Unterlippe (TentLippe – das Spiel öffnet den Mund, indem es sie streckt)
B.sphere('TentLippe', tuple(p), (0.22, 0.33, 0.13), LIP, None, rot=(0, -0.15, -0.35))
p, d = front(zm - 0.04, 0.35, 0.1)
B.sphere('TentSchlitz', tuple(p), (0.13, 0.3, 0.03), MOUTH, None, rot=(0, 0.05, -0.35))
# Saugnäpfe: helle Ringe mit dunkler Mitte, vorn unter dem Mund, nach unten etwas größer
for i, z in enumerate((1.95, 1.62, 1.29, 0.96, 0.63)):
    s = 0.075 + i * 0.008
    p, d = front(z, 0.5, -0.015)
    rot = (math.pi / 2, 0, math.atan2(d.y, d.x) + math.pi / 2)
    B.torus(f'TentNapf{i}', tuple(p), s, s * 0.42, CUP, None, rot=rot, seg=24, sseg=8)
    B.sphere(f'TentNapfMitte{i}', tuple(p - d * 0.005), (s * 0.55, s * 0.55, s * 0.25), LIP, None, rot=rot)


def arm(name, pts, r0, r1):
    cd = bpy.data.curves.get(name) or bpy.data.curves.new(name, 'CURVE')
    cd.splines.clear()
    cd.dimensions, cd.bevel_depth, cd.bevel_resolution, cd.use_fill_caps = '3D', r0, 6, True
    sp = cd.splines.new('BEZIER')
    sp.bezier_points.add(len(pts) - 1)
    for i, (bp, co) in enumerate(zip(sp.bezier_points, pts)):
        bp.co = co
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
        bp.radius = 1 - (1 - r1 / r0) * i / (len(pts) - 1)
    cd.materials.clear()
    cd.materials.append(BODY)
    o = bpy.data.objects.new(name, cd)
    SC.collection.objects.link(o)
    return o


# Arme: vorn (L, Ansatz −0,35/0/1,6) und hinten (R, Ansatz 0,35/0/1,75) wie im alten Modell – dünn, geschwungen
arm('TentArmL', [(-0.3, 0.0, 1.6), (-0.75, -0.12, 1.66), (-1.12, -0.2, 1.92), (-1.3, -0.22, 2.3)], 0.085, 0.055)
B.sphere('TentArmLHand', (-1.31, -0.22, 2.36), (0.09, 0.09, 0.1), LIP, None)
arm('TentArmR', [(0.3, 0.0, 1.75), (0.72, 0.12, 1.85), (1.06, 0.2, 2.15), (1.2, 0.22, 2.55)], 0.085, 0.055)
B.sphere('TentArmRHand', (1.21, 0.22, 2.61), (0.09, 0.09, 0.1), LIP, None)
print('tent_v2', sorted(o.name for o in SC.objects))
