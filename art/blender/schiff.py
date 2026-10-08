# Galeone für den Hafen 1776 (wird von raum_build.py geladen): Rumpf aus Spanten mit Sprung und Plankentextur,
# Achterkastell mit Fenstern, Back, Reling mit Docken, Stückpforten mit Kanonen, drei Masten mit Rahen und geblähten
# Segeln aus Segeltuch, Wanten und Stagen, Klüverbaum mit Vorsegeln, Krähennest, Flagge (Toast statt Totenkopf),
# Hecklaterne und eine goldene Tentakel-Galionsfigur. Maße in Metern, Bug zeigt nach +x, Wasserlinie bei z = 0.
import bpy, bmesh, math
from mathutils import Vector

L, WMAX = 17.0, 2.5   # Länge, halbe Breite mittschiffs


def half_width(t):
    """Halbe Breite an der Stelle t (0 = Heck, 1 = Bug): breites Heck (Spiegel), spitzer Bug."""
    if t >= 0.45:
        return WMAX * max(0.0, 1 - ((t - 0.45) / 0.55) ** 2) ** 0.55
    return WMAX * max(0.0, 1 - ((0.45 - t) / 0.62) ** 2) ** 0.5


def deck_z(t):
    """Oberkante des Rumpfs mit Sprung: Bug und Heck höher, achtern das Kastell."""
    return 1.9 + 0.55 * (2 * t - 1) ** 2 + (0.95 * (0.22 - t) / 0.22 if t < 0.22 else 0)


def keel_z(t):
    return -1.4 + (0.9 * (t - 0.82) / 0.18 if t > 0.82 else 0)


def x_at(t):
    return -L / 2 + t * L


def mesh_obj(SC, name, bm, mat, parent, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    SC.collection.objects.link(o)
    o.parent = parent
    return o


def hull(SC, mat, parent, N=34, M=18):
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    rows = []
    for i in range(N + 1):
        t = i / N
        x, w, zt, zb = x_at(t), half_width(t), deck_z(t), keel_z(t)
        ring = []
        for k in range(M + 1):
            a = math.pi * k / M
            s = math.sin(a)
            y = w * math.cos(a) * (1 - 0.06 * (1 - s) ** 6)   # leichtes Einziehen oben (tumblehome)
            ring.append(bm.verts.new((x, y, zt - (zt - zb) * s ** 0.7)))
        rows.append(ring)
    for i in range(N):
        for k in range(M):
            vs = (rows[i][k], rows[i + 1][k], rows[i + 1][k + 1], rows[i][k + 1])
            if len({v.co.to_tuple(4) for v in vs}) < 3:
                continue
            f = bm.faces.new(vs)
            for lp, (a, b) in zip(f.loops, ((i, k), (i + 1, k), (i + 1, k + 1), (i, k + 1))):
                lp[uv].uv = (a / N * L / 2.2, b / M * 2.4)   # Planken laufen längs
    bm.faces.new(rows[0])   # Spiegel am Heck
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.002)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = mesh_obj(SC, 'S_Rumpf', bm, mat, parent)
    o.modifiers.new('Glatt', 'SUBSURF').levels = 1
    return o


def deck(SC, mat, parent, N=30):
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    rows = []
    for i in range(N + 1):
        t = 0.02 + 0.95 * i / N
        x, w, z = x_at(t), half_width(t) * 0.96, deck_z(t) - 0.32
        rows.append((bm.verts.new((x, w, z)), bm.verts.new((x, -w, z)), t))
    for i in range(N):
        a, b = rows[i], rows[i + 1]
        if (a[0].co - a[1].co).length < 0.01 and (b[0].co - b[1].co).length < 0.01:
            continue
        f = bm.faces.new((a[0], b[0], b[1], a[1]))
        for lp, (u, v) in zip(f.loops, ((i, 1), (i + 1, 1), (i + 1, 0), (i, 0))):
            lp[uv].uv = (u / N * L / 3, v * 1.6)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.002)
    return mesh_obj(SC, 'S_Deck', bm, mat, parent, smooth=False)


def along(t0, t1, side, dz, n=24, inset=1.0):
    """Punkte entlang der Bordwand (side = -1 Steuerbord zur Kamera, +1 Backbord) dz unter der Oberkante."""
    pts = []
    for i in range(n + 1):
        t = t0 + (t1 - t0) * i / n
        pts.append((x_at(t), side * half_width(t) * inset, deck_z(t) - dz))
    return pts


def sail(SC, name, mat, parent, width_top, width_bot, height, billow, nx=12, ny=9, tri=False):
    """Segel als gewölbtes Gitter (Mittelpunkt der oberen Kante im Ursprung, hängt nach -z, bauscht nach +x)."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    grid = []
    for j in range(ny + 1):
        v = j / ny
        row = []
        for i in range(nx + 1):
            u = i / nx
            w = width_top + (width_bot - width_top) * v
            if tri:   # Vorsegel: Dreieck, oben spitz
                w = width_bot * v
            y = (u - 0.5) * w
            z = -v * height
            x = billow * math.sin(math.pi * u) ** 0.8 * math.sin(math.pi * (0.12 + 0.88 * v)) ** 0.9
            row.append(bm.verts.new((x, y, z)))
        grid.append(row)
    for j in range(ny):
        for i in range(nx):
            vs = (grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i])
            if len({q.co.to_tuple(4) for q in vs}) < 3:
                continue
            f = bm.faces.new(vs)
            for lp, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                lp[uv].uv = (a / nx, 1 - b / ny)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.002)
    o = mesh_obj(SC, name, bm, mat, parent)
    o.modifiers.new('Dicke', 'SOLIDIFY').thickness = 0.03
    return o


def box(B, name, loc, size, mat, parent, rot=(0, 0, 0), bevel=0.01):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    return B.obj(name, bm, mat, parent, loc, rot, size, smooth=False, bevel=bevel)


def jib(SC, name, mat, parent, top, tack, clew, billow=0.45, n=8):
    """Vorsegel als gewölbtes Dreieck zwischen Kopf (am Mast), Hals (Klüverbaum) und Schothorn; bauscht nach -y."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    T, A, C = Vector(top), Vector(tack), Vector(clew)
    rows = []
    for j in range(n + 1):
        v = j / n
        l, r = T.lerp(A, v), T.lerp(C, v)
        row = []
        for i in range(j + 1):
            u = i / j if j else 0.5
            p = l.lerp(r, u)
            p.y -= billow * math.sin(math.pi * v) ** 0.8 * (math.sin(math.pi * u) if j else 0) ** 0.7
            row.append((bm.verts.new(p), (u, 1 - v)))
        rows.append(row)
    for j in range(n):
        for i in range(j + 1):
            for tri in ((rows[j][i], rows[j + 1][i], rows[j + 1][i + 1]),) + (((rows[j][i], rows[j + 1][i + 1], rows[j][i + 1]),) if i < j else ()):
                f = bm.faces.new([q[0] for q in tri])
                for lp, q in zip(f.loops, tri):
                    lp[uv].uv = q[1]
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = mesh_obj(SC, name, bm, mat, parent)
    o.modifiers.new('Dicke', 'SOLIDIFY').thickness = 0.03
    return o


def line(tube, name, a, b, mat, parent, r=0.022, sag=0.0):
    mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 - sag)
    return tube(name, [a, mid, b], r, mat, parent)


def build(SC, B, toon, tex_toon, tube, loc, yaw, phase=0.0):
    """Baut die Galeone an loc (Wasserlinie) mit Drehung yaw; phase (0..1) für Windböe in Segeln und Flagge."""
    gust = math.sin(phase * 2 * math.pi)
    HULL = tex_toon('S_Rumpfholz', 'holz_rumpf.png', uv=True)
    DECK = tex_toon('S_Deckholz', 'holz_deck.png', uv=True)
    CLOTH = tex_toon('S_Segeltuch', 'segeltuch.png', uv=True, hi=0.55)
    FLAG = tex_toon('S_Flagge', 'flagge.png', uv=True)
    GOLD, DARK, RED, WOOD = toon('N_Gold', '#e9b53c', hi=0.6), toon('S_Dunkel', '#1e1612'), toon('S_Rot', '#a8262c'), toon('S_Holz', '#6a4426')
    METAL, ROPE, GLASS, LAMP = toon('S_Eisen', '#2a2a30', hi=0.5), toon('S_Tau', '#3a2a1c'), toon('S_Glas', '#2a4a7a', hi=0.9), toon('S_Lampe', '#ffd27a', hi=0.95)
    R = B.empty('Schiff')
    R.location = loc
    R.rotation_euler = (0, 0, yaw)
    hull(SC, HULL, R)
    deck(SC, DECK, R)
    # Barkhölzer (Gold und Rot) längs der Bordwand, beide Seiten
    for side in (-1, 1):
        tube(f'S_Wale{side}', along(0.03, 0.97, side, 0.12, inset=1.01), 0.06, GOLD, R, tip=1.0)
        tube(f'S_Wale2{side}', along(0.06, 0.93, side, 1.05, inset=1.0), 0.07, RED, R, tip=1.0)
        tube(f'S_Reling{side}', [(p[0], p[1], p[2] + 0.55) for p in along(0.05, 0.9, side, 0.0, inset=0.98)], 0.045, WOOD, R, tip=1.0)
        for i in range(26):   # Docken der Reling
            t = 0.06 + 0.83 * i / 25
            x, y, z = x_at(t), side * half_width(t) * 0.98, deck_z(t)
            B.rod(f'S_Docke{side}_{i}', (x, y, z - 0.05), (x, y, z + 0.52), 0.03, WOOD, R, seg=6)
    # Stückpforten mit Kanonen auf der Kameraseite (Steuerbord) und angedeutet auf Backbord
    for side in (-1, 1):
        for i, t in enumerate((0.26, 0.35, 0.44, 0.53, 0.62, 0.71)):
            x, w, z = x_at(t), half_width(t), deck_z(t) - 0.78
            box(B, f'S_Pforte{side}_{i}', (x, side * w * 0.99, z), (0.36, 0.08, 0.32), DARK, R, bevel=0)
            box(B, f'S_Deckel{side}_{i}', (x, side * (w + 0.13), z + 0.3), (0.4, 0.05, 0.34), RED, R, rot=(-side * 0.95, 0, 0), bevel=0.01)
            B.rod(f'S_Kanone{side}_{i}', (x, side * (w - 0.1), z), (x, side * (w + 0.55), z + 0.04), 0.085, METAL, R, r1=0.07, seg=12)
    # Achterkastell mit Fenstern, Galerie und Hecklaterne
    t0, t1 = 0.0, 0.2
    xc, wc, zc = x_at(0.09), half_width(0.09) * 0.9, deck_z(0.09)
    B.cone('S_Kajuete', zc - 0.3, zc + 1.0, 1.0, 1.0, HULL, R, xy=(xc, 0), seg=4, bevel=0.04, rot=(0, 0, math.pi / 4), scale=(1.55, wc * 0.72, 1))
    B.cone('S_KajueteDach', zc + 1.0, zc + 1.12, 1.0, 1.0, GOLD, R, xy=(xc, 0), seg=4, bevel=0.02, rot=(0, 0, math.pi / 4), scale=(1.62, wc * 0.76, 1))
    for side in (-1, 1):
        for i in range(3):
            box(B, f'S_Fenster{side}_{i}', (xc - 0.9 + i * 0.85, side * (wc * 0.73 + 0.02), zc + 0.45), (0.42, 0.06, 0.5), GLASS, R, bevel=0)
            box(B, f'S_Rahmen{side}_{i}', (xc - 0.9 + i * 0.85, side * (wc * 0.73 + 0.005), zc + 0.45), (0.52, 0.04, 0.6), GOLD, R, bevel=0.005)
    for i in range(4):   # Heckgalerie mit Fenstern
        box(B, f'S_Heckfenster{i}', (x_at(0.0) - 0.05, -1.2 + i * 0.8, deck_z(0.0) - 0.5), (0.06, 0.45, 0.6), GLASS, R, bevel=0)
    B.rod('S_Laternenstab', (x_at(0.0) - 0.1, 0, deck_z(0.0) + 0.6), (x_at(0.0) - 0.6, 0, deck_z(0.0) + 1.2), 0.04, GOLD, R, seg=8)
    B.sphere('S_Laterne', (x_at(0.0) - 0.62, 0, deck_z(0.0) + 1.45), (0.2, 0.2, 0.32), LAMP, R)
    B.cone('S_LaterneDach', deck_z(0.0) + 1.72, deck_z(0.0) + 1.95, 0.22, 0.02, GOLD, R, xy=(x_at(0.0) - 0.62, 0), bevel=0.01)
    # Back (vorderer Aufbau)
    xb, wb = x_at(0.86), half_width(0.86) * 0.8
    B.cone('S_Back', deck_z(0.86) - 0.3, deck_z(0.86) + 0.55, 1.0, 1.0, HULL, R, xy=(xb, 0), seg=4, bevel=0.04, rot=(0, 0, math.pi / 4), scale=(1.1, wb, 1))
    # Masten, Rahen, Segel, Krähennest, Wanten
    masts = [(0.27, 6.6), (0.5, 8.0), (0.73, 7.2)]
    tops = []
    for mi, (t, h) in enumerate(masts):
        x, z0 = x_at(t), deck_z(t) - 0.32
        B.cone(f'S_Mast{mi}', z0, z0 + h, 0.2, 0.11, WOOD, R, xy=(x, 0), seg=16, bevel=0)
        tops.append((x, z0 + h))
        yards = [(0.4, 1.0, 0.3), (0.68, 0.76, 0.24), (0.9, 0.5, 0.14)] if mi != 0 else [(0.45, 0.8, 0.3), (0.75, 0.6, 0.22)]
        span = half_width(t) * 2.3
        for yi, (zf, wf, hf) in enumerate(yards):
            zy, wy = z0 + h * zf, span * wf
            Y = B.empty(f'S_Rah{mi}_{yi}')
            Y.parent = R
            Y.location = (x + 0.18, 0, zy)
            Y.rotation_euler = (0, 0, 0.42)   # Rahen gebrasst: die Segel stehen schräg zur Kamera
            B.rod(f'S_RahHolz{mi}_{yi}', (0, -wy / 2 - 0.2, 0), (0, wy / 2 + 0.2, 0), 0.07, WOOD, Y, r1=0.05, seg=10)
            sail(SC, f'S_Segel{mi}_{yi}', CLOTH, Y, wy * 0.92, wy * 1.04, h * hf, (0.55 + 0.25 * wf) * (1 + 0.16 * gust))
        nest = B.cone(f'S_Nest{mi}', z0 + h * 0.62, z0 + h * 0.66, 0.5, 0.5, WOOD, R, xy=(x, 0), seg=20, bevel=0.02) if mi == 1 else None
        for side in (-1, 1):   # Wanten: vom Rumpf zur Mastspitze
            for j in range(4):
                bx = x - 0.75 + j * 0.5
                tb = (bx + L / 2) / L
                a = (bx, side * half_width(tb) * 1.02, deck_z(tb) + 0.1)
                b = (x, side * 0.12, z0 + h * 0.62)
                line(tube, f'S_Want{mi}_{side}_{j}', a, b, ROPE, R, r=0.018)
    # Klüverbaum mit Vorsegeln und Stagen
    bow = (x_at(1.0) - 0.2, 0, deck_z(1.0) + 0.1)
    tip = (bow[0] + 4.4, 0, bow[2] + 1.9)
    B.rod('S_Kluever', bow, tip, 0.11, WOOD, R, r1=0.06, seg=12)
    fx, fz = tops[2]
    for k, f in enumerate((0.78, 0.58)):
        top = (fx + 0.15, 0, fz * f)
        tack = (tip[0] - 0.4 - k * 1.5, 0, tip[2] - 0.15 - k * 0.65)
        clew = (fx + 1.1 + k * 0.5, 0, deck_z(0.8) + 1.4)
        jib(SC, f'S_Vorsegel{k}', CLOTH, R, top, tack, clew, billow=0.45 * (1 + 0.2 * gust))
        line(tube, f'S_Stag{k}', top, tack, ROPE, R, r=0.02)
    for a, b in ((tops[0], tops[1]), (tops[1], tops[2])):
        line(tube, f'S_Stag_{a[0]:.1f}', (a[0], 0, a[1]), (b[0], 0, b[1] * 0.8), ROPE, R, r=0.02, sag=0.25)
    # Flagge oben am Großmast (wehend)
    mx, mz = tops[1]
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    nx, ny, fw, fh = 10, 6, 1.9, 1.25
    g = [[bm.verts.new((-u / nx * fw, 0.22 * math.sin(u / nx * 5.0 - phase * 2 * math.pi) * (u / nx), fh / 2 - v / ny * fh + 0.05 * math.sin(u / nx * 4 + phase * 6.28) * u / nx)) for u in range(nx + 1)] for v in range(ny + 1)]
    for v in range(ny):
        for u in range(nx):
            f = bm.faces.new((g[v][u], g[v][u + 1], g[v + 1][u + 1], g[v + 1][u]))
            for lp, (a, b) in zip(f.loops, ((u, v), (u + 1, v), (u + 1, v + 1), (u, v + 1))):
                lp[uv].uv = (1 - a / nx, 1 - b / ny)
    fl = mesh_obj(SC, 'S_Flagge', bm, FLAG, R)
    fl.location = (mx - 0.08, 0, mz - 0.55)
    fl.rotation_euler = (0, 0, math.pi)   # weht nach achtern
    fl.modifiers.new('Dicke', 'SOLIDIFY').thickness = 0.02
    # Galionsfigur: goldener Tentakel unter dem Klüverbaum
    tube('S_Galion', [(bow[0] - 0.2, 0, bow[2] - 0.9), (bow[0] + 0.7, 0, bow[2] - 0.5), (bow[0] + 1.2, 0, bow[2] + 0.1), (bow[0] + 1.0, 0, bow[2] + 0.5)], 0.18, GOLD, R, tip=0.35)
    return R
