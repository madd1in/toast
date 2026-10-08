# Palmeninsel im Hintergrund des Hafens (wird von raum_build.py geladen): hügeliges Gelände mit Gras- und Felstextur,
# Sandstrand mit Brandung, Felsklippe, acht Palmen mit gebogenen, beringten Stämmen, gefiederten Wedeln und Kokosnüssen,
# eine Strohhütte, ein Ruderboot am Strand und eine dunstige Bergkette dahinter. Maße in Metern, Wasserlinie z = 0.
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, noise


def mesh_obj(SC, name, bm, mat, parent, loc=(0, 0, 0), smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    SC.collection.objects.link(o)
    o.parent = parent
    o.location = loc
    return o


RX, RY, H = 15.0, 7.5, 6.5   # Halbachsen und Höhe des Hügels


def hill_z(x, y):
    r = math.sqrt((x / RX) ** 2 + (y / RY) ** 2)
    base = H * max(0.0, 1 - r * r) ** 1.3
    bumps = 1 + 0.22 * math.sin(x * 0.55 + 1.3) * math.cos(y * 0.7) + 0.12 * noise.noise(Vector((x * 0.25, y * 0.25, 0.3)))
    return base * bumps - 0.25


def terrain(SC, mat, parent, n=48):
    bm = bmesh.new()
    grid = []
    for j in range(n + 1):
        row = []
        for i in range(n + 1):
            x, y = (i / n * 2 - 1) * RX * 0.96, (j / n * 2 - 1) * RY * 0.96
            row.append(bm.verts.new((x, y, hill_z(x, y))))
        grid.append(row)
    for j in range(n):
        for i in range(n):
            vs = (grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i])
            if max(v.co.z for v in vs) > 0.15:
                bm.faces.new(vs)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    return mesh_obj(SC, 'Insel_Gelaende', bm, mat, parent)


def rock(SC, name, mat, parent, loc, size, seed):
    r = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    for v in bm.verts:
        v.co *= 1 + r.uniform(-0.22, 0.22)
        v.co.z = max(v.co.z, -0.6)
    o = mesh_obj(SC, name, bm, mat, parent, loc, smooth=False)
    o.scale = size
    o.rotation_euler = (r.uniform(-0.2, 0.2), r.uniform(-0.2, 0.2), r.uniform(0, 6.28))
    return o


def frond(SC, name, mat, parent, length, droop, width, n=12):
    """Palmwedel als Fischgräte: Mittelrippe im Bogen, an jedem Abschnitt zwei schmale Fiederblätter nach außen-unten."""
    bm = bmesh.new()
    spine = []
    for i in range(n + 1):
        s = i / n
        spine.append(Vector((s * length, 0, length * 0.32 * math.sin(math.pi * s * 0.75) - droop * s * s)))
    for i in range(n):
        a, b = spine[i], spine[i + 1]
        d = (b - a).normalized()
        w = width * math.sin(math.pi * (i + 0.5) / n) ** 0.6
        for side in (-1, 1):
            tip = a + d * (length / n * 0.6) + Vector((0, side * w, -w * 0.35))
            va, vb, vt = bm.verts.new(a), bm.verts.new(b), bm.verts.new(tip)
            bm.faces.new((va, vb, vt) if side > 0 else (vb, va, vt))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)
    o = mesh_obj(SC, name, bm, mat, parent, smooth=False)
    o.modifiers.new('Dicke', 'SOLIDIFY').thickness = 0.04
    # ohne Freestyle-Kontur, sonst wird die Krone aus lauter Linien schwarz
    nk = bpy.data.collections.get('Ohne_Kontur') or bpy.data.collections.new('Ohne_Kontur')
    if nk.name not in SC.collection.children:
        SC.collection.children.link(nk)
    SC.collection.objects.unlink(o)
    nk.objects.link(o)
    return o


def palm(SC, B, tube, name, mats, parent, base, height, lean, turn, seed):
    TRUNK, RING, LEAF, LEAF2, NUT = mats
    r = random.Random(seed)
    bx, by, bz = base
    dx, dy = math.cos(turn) * lean, math.sin(turn) * lean
    pts = [(bx, by, bz - 0.3), (bx + dx * 0.25, by + dy * 0.25, bz + height * 0.35), (bx + dx * 0.7, by + dy * 0.7, bz + height * 0.75), (bx + dx, by + dy, bz + height)]
    tube(name + '_Stamm', pts, 0.32, TRUNK, parent, tip=0.6)
    for k in range(9):   # Ringe am Stamm
        s = (k + 0.5) / 9
        x = bx + dx * (s ** 1.6)
        y = by + dy * (s ** 1.6)
        z = bz + height * s
        B.torus(f'{name}_Ring{k}', (x, y, z), 0.3 * (1 - 0.35 * s), 0.05, RING, parent, seg=16, sseg=6)
    top = Vector((bx + dx, by + dy, bz + height))
    crown = B.empty(name + '_Krone')
    crown.parent = parent
    crown.location = top
    for k in range(9):
        f = frond(SC, f'{name}_Wedel{k}', LEAF if k % 2 else LEAF2, crown, r.uniform(3.6, 5.0), r.uniform(1.6, 2.6), r.uniform(0.75, 1.0))
        f.rotation_euler = (r.uniform(-0.15, 0.15), r.uniform(-0.35, 0.05), k * 2 * math.pi / 9 + r.uniform(-0.2, 0.2))
    for k in range(4):
        a = k * 1.7
        B.sphere(f'{name}_Nuss{k}', (math.cos(a) * 0.3, math.sin(a) * 0.3, -0.35), (0.22, 0.22, 0.24), NUT, crown)


def build(SC, B, toon, tex_toon, tube, center):
    R = B.empty('Insel')
    R.location = center
    GRASS, ROCK, SAND = tex_toon('I_Gras', 'gras.png', 0.35), tex_toon('I_Fels', 'fels.png', 0.4), tex_toon('I_Sand', 'sand.png', 0.3)
    FOAM = toon('I_Gischt', '#f2fbff', hi=0.5)
    terrain(SC, GRASS, R)
    B.sphere('Insel_Strand', (0, 0, -0.35), (RX * 1.12, RY * 1.25, 0.75), SAND, R)
    B.torus('Insel_Brandung', (0, 0, 0.02), 1.0, 0.035, FOAM, R, scale=(RX * 1.2, RY * 1.36, 1), seg=64, sseg=6)
    # Felsklippe auf der rechten Seite
    for k, (x, y, s) in enumerate([(10.5, -1.0, (3.2, 2.6, 3.8)), (12.5, 1.5, (2.6, 2.2, 3.0)), (8.2, -3.2, (2.0, 1.8, 2.2)), (13.6, -2.6, (1.6, 1.4, 1.6))]):
        rock(SC, f'Insel_Fels{k}', ROCK, R, (x, y, 0.6), s, 40 + k)
    mats = (tex_toon('I_Stamm', 'holz_fass.png', 1.2), toon('I_StammRing', '#6a4a2a'), toon('I_Blatt', '#5cbc4a', hi=0.6), toon('I_Blatt2', '#46a03c', hi=0.5), toon('I_Nuss', '#6a4426'))
    for k, (x, y, h, lean, turn) in enumerate([(-9.0, -2.0, 7.0, 1.4, 3.4), (-6.0, 1.5, 8.6, 1.0, 2.6), (-3.5, -3.6, 6.4, 1.7, 4.2), (-0.5, 0.8, 9.2, 1.2, 1.2),
                                                 (2.2, -2.5, 7.4, 1.5, 5.6), (4.8, 2.4, 8.2, 0.9, 0.4), (6.8, -1.2, 6.6, 1.8, 0.0), (-11.6, 1.2, 5.8, 1.5, 3.0)]):
        palm(SC, B, tube, f'Palme{k}', mats, R, (x, y, hill_z(x, y)), h, lean, turn, 60 + k)
    # Strohhütte und Ruderboot am Strand (links vorn)
    hx, hy = -8.0, -6.6
    B.cone('Insel_Huette', 0.0, 2.2, 1.6, 1.5, tex_toon('I_Huettenholz', 'holz_deck.png', 0.8), R, xy=(hx, hy), seg=12, bevel=0.03)
    B.cone('Insel_Strohdach', 2.0, 3.9, 2.3, 0.15, toon('I_Stroh', '#d8b060', hi=0.5), R, xy=(hx, hy), seg=12, bevel=0.04)
    B.cone('Insel_Tuer', 0.1, 1.6, 0.42, 0.42, toon('I_Tuer', '#2a1a10'), R, xy=(hx + 0.25, hy - 1.4), seg=4, bevel=0, scale=(1, 0.2, 1))
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=1.0)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > 0.02], context='VERTS')
    boat = mesh_obj(SC, 'Insel_Boot', bm, tex_toon('I_Bootholz', 'holz_rumpf.png', 0.9), R, (-2.5, -8.2, 0.25))
    boat.scale = (2.2, 0.8, 0.55)
    boat.rotation_euler = (0, 0, 0.35)
    boat.modifiers.new('Dicke', 'SOLIDIFY').thickness = 0.08
    # Dunstige Berge weit dahinter
    HAZE = toon('I_Dunst', '#9ab8d0', hi=0.2)
    for k, (x, y, s) in enumerate([(-60, 230, (40, 20, 22)), (-20, 260, (55, 24, 30)), (40, 240, (45, 22, 18)), (90, 270, (60, 26, 26))]):
        B.sphere(f'Berg{k}', (x, y, -4), s, HAZE, None)
    return R
