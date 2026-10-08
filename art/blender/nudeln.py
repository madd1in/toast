# Requisiten fürs Beleidigungsfechten (Modul für gaeste_build.py und fecht_hoagie.py): eine gerippte Poolnudel aus
# Schaumstoff und der „Super-Spritzer“, eine dicke Wasserpistole mit Tank, Pumpgriff und Düse – eigene Entwürfe im
# Toon-Look, matt wie Schaumstoff und Spielzeug-Plastik. Beide sitzen am Unterarm (Ellbogen-Gelenk) einer Figur:
# Unterarm-Achse ist −z, +x zeigt bei nach vorn gestrecktem Arm nach oben.
import bpy, bmesh, math
from mathutils import Matrix, Vector
from figur_lib import Builder, toon


def _obj(SC, name, bm, mats, parent, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    for m in mats:
        me.materials.append(m)
    o = bpy.data.objects.new(name, me)
    SC.collection.objects.link(o)
    o.parent = parent
    return o


def nudel(SC, name, parent, start, direction=(0.35, 0, -1), length=0.85, color='#ff5aa8', r=0.042, bend=0.05):
    """Poolnudel: 16 Kanten (8 Rippen), hohl mit dunklem Loch an beiden Enden, leicht durchgebogen."""
    FOAM, HOLE = toon('NU_' + color.strip('#'), color, hi=0.1), toon('NU_Loch', '#2a1a2e', hi=0.0)
    d = Vector(direction).normalized()
    up = Vector((0, 1, 0)).cross(d).normalized()   # Biegerichtung (zur Oberseite des Arms)
    side = d.cross(up).normalized()
    bm = bmesh.new()
    N, K = 16, 16
    rings = []
    for i in range(N + 1):
        u = i / N
        c = Vector(start) + d * (length * u) + up * (bend * math.sin(math.pi * u) - bend * u * 0.6)
        ring = []
        for j in range(K):
            a = 2 * math.pi * j / K
            rr = r * (1.0 if j % 2 == 0 else 0.87)
            ring.append(bm.verts.new(c + (side * math.cos(a) + up * math.sin(a)) * rr))
        rings.append((c, ring))
    for i in range(N):
        for j in range(K):
            a, b = rings[i][1], rings[i + 1][1]
            bm.faces.new((a[j], a[(j + 1) % K], b[(j + 1) % K], b[j]))
    for end, sgn in ((0, -1), (N, 1)):   # hohle Enden: Ring nach innen, dunkle Scheibe etwas versenkt
        c, ring = rings[end]
        inner = [bm.verts.new(c + (v.co - c) * 0.42 - d * sgn * 0.004) for v in ring]
        for j in range(K):
            f = bm.faces.new((ring[j], ring[(j + 1) % K], inner[(j + 1) % K], inner[j]) if sgn > 0 else (inner[j], inner[(j + 1) % K], ring[(j + 1) % K], ring[j]))
        hole = [bm.verts.new(v.co - d * sgn * 0.03) for v in inner]
        f = bm.faces.new(hole if sgn > 0 else list(reversed(hole)))
        f.material_index = 1
        for j in range(K):
            g = bm.faces.new((inner[j], inner[(j + 1) % K], hole[(j + 1) % K], hole[j]) if sgn > 0 else (hole[j], hole[(j + 1) % K], inner[(j + 1) % K], inner[j]))
            g.material_index = 1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(SC, name, bm, [FOAM, HOLE], parent)


def spritzer(SC, name, parent, at, tilt=0.35):
    """Super-Spritzer: Griff liegt in der Hand (at, Ellbogen-Raum), Lauf zeigt den Unterarm entlang nach vorn."""
    B = Builder(SC)
    R = B.empty(name)
    R.parent = parent
    R.location = at
    fwd = Vector((math.sin(tilt), 0, -math.cos(tilt)))   # Lauf: den Unterarm entlang, leicht nach oben
    upv = Vector((math.cos(tilt), 0, math.sin(tilt)))
    R.matrix_basis = Matrix.Translation(Vector(at)) @ Matrix((fwd, upv.cross(fwd), upv)).transposed().to_4x4()
    BODY, DARK, TANK, PUMP, NOZ = (toon('SP_Gehaeuse', '#4ad86a', hi=0.2), toon('SP_Griff', '#2a8a48', hi=0.15), toon('SP_Tank', '#3ab8ff', hi=0.35),
                                   toon('SP_Pumpe', '#ffd23a', hi=0.2), toon('SP_Duese', '#ff8a2a', hi=0.25))
    def box(n, loc, size, mat, rot=(0, 0, 0)):
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
        return B.obj(n, bm, mat, R, loc, rot, size, smooth=False, bevel=0.2)   # Fase im Einheitswürfel: abgerundete Spielzeugkanten
    box(name + '_Gehaeuse', (0.12, 0, 0.02), (0.36, 0.07, 0.1), BODY)
    box(name + '_Griff', (-0.01, 0, -0.08), (0.065, 0.055, 0.17), DARK, rot=(0, 0.3, 0))
    box(name + '_Pumpe', (0.25, 0, -0.06), (0.13, 0.065, 0.05), PUMP)
    B.rod(name + '_Lauf', (0.28, 0, 0.02), (0.44, 0, 0.02), 0.024, BODY, R, seg=16)
    B.rod(name + '_Duese', (0.43, 0, 0.02), (0.47, 0, 0.02), 0.03, NOZ, R, r1=0.018, seg=16)
    B.rod(name + '_Tank', (0.0, 0, 0.13), (0.22, 0, 0.13), 0.062, TANK, R, seg=24)
    B.sphere(name + '_TankDeckel', (-0.01, 0, 0.13), (0.03, 0.05, 0.05), PUMP, R)
    B.torus(name + '_Abzug', (0.04, 0, -0.05), 0.03, 0.008, DARK, R, rot=(math.pi / 2, 0, 0), seg=16, sseg=6)
    return R


def tree(o):
    out = [o]
    for c in o.children:
        out += tree(c)
    return out
