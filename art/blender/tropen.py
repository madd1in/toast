# Brasilien-Flair für den Hafen 1776 (wird von raum_build.py geladen): eine jubelnde Crew an Deck der Galeone (Arme
# und Hüpfer je Windphase, also im Takt der Schiffsbilder), eine dicke Anakonda, die vom Lagerhausdach hängt und mit
# dem Kopf pendelt, Aras und ein Tukan im Flug (drei Flügelstellungen), Wimpelketten und eine Kiste mit Tropenobst.
# Maße in Metern wie in raum_build.py (Steg-Vorderkante bei y ≈ 13, Wasserlinie z = -0.75).
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, Quaternion


# ------------------------------------------------------------------ Rohr mit UV (Schlangenkörper, Bananen)
def catmull(pts, n_per=8):
    P = [Vector(p) for p in pts]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n_per):
            t = k / n_per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t))
    out.append(P[-2].copy())
    return out


def tube_mesh(SC, name, pts, radius, mat, parent=None, ring=14, tile=1.2, n_per=8, face=None):
    """Glattes Rohr entlang einer Catmull-Rom-Kurve; radius(s) mit s = 0..1 längs. UV: u rundum, v = Länge / tile.
    Gemeinsame Ecken an der UV-Naht (keine offene Kante, sonst zieht Freestyle dort eine Linie)."""
    C = catmull(pts, n_per)
    n = len(C)
    acc = [0.0]
    for i in range(1, n):
        acc.append(acc[-1] + (C[i] - C[i - 1]).length)
    total = acc[-1]
    T = [(C[min(i + 1, n - 1)] - C[max(i - 1, 0)]).normalized() for i in range(n)]
    if face is not None:   # u = 0 zeigt überall möglichst in Richtung face (Rücken zur Kamera)
        f = Vector(face)
        N = [(f - t * t.dot(f)).normalized() for t in T]
    else:
        up = Vector((0, 0, 1))
        N = [(up - T[0] * T[0].dot(up)).normalized() if abs(T[0].z) < 0.95 else T[0].orthogonal().normalized()]
        for i in range(1, n):   # paralleler Transport: kein Verdrehen in senkrechten Stücken
            N.append((T[i - 1].rotation_difference(T[i]) @ N[-1]).normalized())
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    rows = []
    for i in range(n):
        Bi = T[i].cross(N[i])
        r = radius(acc[i] / total)
        rows.append([bm.verts.new(C[i] + (N[i] * math.cos(2 * math.pi * j / ring) + Bi * math.sin(2 * math.pi * j / ring)) * r) for j in range(ring)])
    for i in range(n - 1):
        for j in range(ring):
            f = bm.faces.new((rows[i][j], rows[i][(j + 1) % ring], rows[i + 1][(j + 1) % ring], rows[i + 1][j]))
            for lp, (a, b) in zip(f.loops, ((j, i), (j + 1, i), (j + 1, i + 1), (j, i + 1))):
                lp[uv].uv = (a / ring, acc[b] / tile)
    for i, d in ((0, -1), (n - 1, 1)):   # Enden mit Spitze schließen
        tip = bm.verts.new(C[i] + T[i] * d * radius(0 if i == 0 else 1) * 0.6)
        for j in range(ring):
            vs = (rows[i][j], rows[i][(j + 1) % ring], tip) if d > 0 else (rows[i][(j + 1) % ring], rows[i][j], tip)
            f = bm.faces.new(vs)
            for lp in f.loops:
                lp[uv].uv = (0.5, acc[i] / tile)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    SC.collection.objects.link(o)
    o.parent = parent
    return o, C, T


def look_at(B, name, parent, loc, direction, roll_up=(0, 0, 1)):
    """Empty an loc, lokale +x-Achse zeigt in direction (lokal +z möglichst nach oben)."""
    e = B.empty(name)
    e.parent = parent
    e.location = loc
    x = Vector(direction).normalized()
    z = Vector(roll_up)
    y = z.cross(x).normalized()
    z = x.cross(y)
    e.rotation_euler = Matrix((x, y, z)).transposed().to_euler()
    return e


# ------------------------------------------------------------------ jubelnde Crew an Deck
SKIN = ['#f0c8a0', '#c89070', '#8a5a3a', '#e8b890', '#a8704a', '#f4d0b0']
SHIRT = ['#e8e2d0', '#c8323a', '#2a5ab0', '#e8a82a', '#3a8a4a', '#f2f0e8', '#7a3a8a']


def pirat(B, toon, name, parent, loc, yaw, phase, kind, seed):
    """Ein Matrose bis zur Hüfte sichtbar (steht hinter der Reling): Arme und Hüpfer nach kind und phase."""
    r = random.Random(seed)
    o = (seed % 4) / 4
    s = 0.5 + 0.5 * math.sin(2 * math.pi * (phase + o))
    hop = 0.12 * max(0.0, math.sin(2 * math.pi * (phase + o)))
    F = B.empty(name)
    F.parent = parent
    F.location = (loc[0], loc[1], loc[2] + hop)
    F.rotation_euler = (0, 0, yaw)
    F.scale = (1.3, 1.3, 1.3)   # etwas größer als echt, damit man die Crew auf die Entfernung erkennt
    skin, shirt = toon('C_Haut%d' % (seed % len(SKIN)), SKIN[seed % len(SKIN)]), toon('C_Hemd%d' % (seed % len(SHIRT)), SHIRT[seed % len(SHIRT)])
    dark, white, black = toon('C_Hose', '#2a2430'), toon('C_Weiss', '#ffffff', hi=0.9), toon('N_Schwarz', '#16121e', hi=0.15)
    for sd in (-1, 1):
        B.rod(f'{name}_Bein{sd}', (sd * 0.1, 0, 0), (sd * 0.1, 0, 0.82), 0.08, dark, F, seg=10)
    B.sphere(f'{name}_Rumpf', (0, 0, 1.1), (0.26, 0.18, 0.36), shirt, F)
    B.sphere(f'{name}_Kopf', (0, 0, 1.62), (0.16, 0.15, 0.17), skin, F)
    B.sphere(f'{name}_Nase', (0, -0.15, 1.6), (0.055, 0.05, 0.05), skin, F)
    for sd in (-1, 1):
        B.sphere(f'{name}_Auge{sd}', (sd * 0.055, -0.13, 1.67), (0.035, 0.03, 0.04), white, F)
        B.sphere(f'{name}_Pupille{sd}', (sd * 0.055, -0.158, 1.675), (0.017, 0.012, 0.02), black, F)
    B.sphere(f'{name}_Mund', (0, -0.135, 1.53), (0.05, 0.02, 0.03 + 0.02 * s), toon('C_Mund', '#5a1a1a'), F)   # Jubel: Mund auf
    hat = seed % 3
    if hat == 0:   # Kopftuch
        B.sphere(f'{name}_Tuch', (0, 0.01, 1.68), (0.165, 0.16, 0.12), toon('C_Tuch%d' % (seed % 3), ['#c8323a', '#2a5ab0', '#e8a82a'][seed % 3]), F)
    elif hat == 1:   # Dreispitz
        B.cone(f'{name}_Hut', 1.72, 1.86, 0.24, 0.12, black, F, seg=3, bevel=0.02, rot=(0, 0, math.pi / 6))
    else:   # Strubbelhaar und Bart
        B.sphere(f'{name}_Haar', (0, 0.02, 1.7), (0.16, 0.15, 0.1), toon('C_Haar', '#3a2418'), F)
        B.sphere(f'{name}_Bart', (0, -0.07, 1.5), (0.12, 0.1, 0.09), toon('C_Haar', '#3a2418'), F)
    for sd in (-1, 1):
        if kind == 'jubel':
            e = math.radians(-5 + 85 * s)
        elif kind == 'winken':
            e = math.radians(70 + 15 * s) if sd > 0 else math.radians(-60)
        else:   # faust: abwechselnd
            e = math.radians(-50 + 130 * (s if sd > 0 else 1 - s))
        lat = math.cos(e)
        if kind == 'winken' and sd > 0:
            lat = 0.25 + 0.6 * (s - 0.5)
        sh = Vector((sd * 0.24, 0, 1.32))
        d = Vector((sd * lat, -0.18, math.sin(e))).normalized()
        hand = sh + d * 0.6
        B.rod(f'{name}_Arm{sd}', sh, hand, 0.065, shirt, F, r1=0.055, seg=10)
        B.sphere(f'{name}_Hand{sd}', hand, (0.075, 0.075, 0.075), skin, F)
    return F


def crew(SC, B, toon, R, phase, yaw, x_at, half_width, deck_z):
    """Sechs Matrosen an der Steuerbord-Reling (zur Kamera) und ein Ausguck im Krähennest; alle drehen sich zur Kamera."""
    kinds = ['jubel', 'faust', 'winken', 'jubel', 'faust', 'jubel']
    for i, t in enumerate((0.33, 0.40, 0.46, 0.57, 0.64, 0.81)):
        pirat(B, toon, f'S_Crew{i}', R, (x_at(t), -half_width(t) * 0.7, deck_z(t) - 0.32), -yaw, phase, kinds[i], i + 3)
    x, z0 = x_at(0.5), deck_z(0.5) - 0.32
    pirat(B, toon, 'S_Ausguck', R, (x + 0.15, -0.2, z0 + 4.55), -yaw, phase, 'winken', 9)


# ------------------------------------------------------------------ Anakonda am Lagerhausdach
def schlange(SC, B, toon, tex_toon, phase):
    """Hängt in einer Schlaufe vom Dach (Schwanz links über die Kante), der Kopf pendelt rechts neben dem Lagerhaus."""
    ph = 2 * math.pi * phase
    sx, sz = 0.24 * math.sin(ph), 0.07 * math.sin(2 * ph)
    pts = [(-9.95, 13.95, 3.75), (-9.85, 14.0, 4.45), (-9.6, 14.2, 4.98), (-8.8, 14.9, 5.08), (-7.6, 14.7, 5.08),
           (-6.65, 14.12, 4.98), (-6.45 + 0.03 * math.sin(ph - 1.6), 13.9, 4.25), (-6.15 + 0.06 * math.sin(ph - 1.3), 13.85, 3.3),
           (-5.6 + 0.08 * math.sin(ph - 1.0), 13.85, 3.1), (-5.0 + 0.1 * math.sin(ph - 0.7), 13.85, 3.35),
           (-4.55 + 0.14 * math.sin(ph - 0.4), 13.8, 3.75), (-4.15 + sx, 13.72, 3.95 + sz)]
    def rad(s):
        return 0.05 + 0.19 * min(1.0, s / 0.35) ** 0.8 if s < 0.84 else 0.24 - 0.55 * (s - 0.84)

    SKIN = tex_toon('T_Anakonda', 'schlange.png', uv=True, hi=0.35)
    body, C, T = tube_mesh(SC, 'Schlange_Koerper', pts, rad, SKIN, None, ring=16, tile=0.9, face=(0.15, -1, 0.35))
    # Kopf: flach, breit, mit Schnauze; schaut abwechselnd zur Kamera und nach rechts
    d = Vector((1.0, -0.35 + 0.55 * math.sin(ph + 0.4), -0.25))
    K = look_at(B, 'Schlange_Kopf', None, C[-1] + T[-1] * 0.05, d)
    K.scale = (1.7, 1.7, 1.7)
    head = toon('T_SchlangeKopf', '#5e6a26')
    B.sphere('Schlange_Schaedel', (0.14, 0, 0.02), (0.26, 0.15, 0.1), head, K)
    B.sphere('Schlange_Schnauze', (0.33, 0, 0.0), (0.12, 0.1, 0.07), head, K)
    B.sphere('Schlange_Kinn', (0.2, 0, -0.06), (0.2, 0.11, 0.05), toon('T_SchlangeBauch', '#d8c070'), K)
    for sd in (-1, 1):
        B.sphere(f'Schlange_Auge{sd}', (0.2, sd * 0.11, 0.08), (0.05, 0.035, 0.045), toon('T_Schlangenauge', '#ffd23a', hi=0.95), K)
        B.sphere(f'Schlange_Pupille{sd}', (0.225, sd * 0.138, 0.085), (0.012, 0.01, 0.038), toon('N_Schwarz', '#16121e', hi=0.15), K)
        B.sphere(f'Schlange_Nasenloch{sd}', (0.43, sd * 0.045, 0.04), (0.014, 0.012, 0.01), toon('N_Schwarz', '#16121e', hi=0.15), K)
    if round(phase * 8) % 4 == 2:   # Zunge raus
        red = toon('T_Zunge', '#ff3a4a', hi=0.9)
        parts = [B.rod('Schlange_Zunge', (0.42, 0, -0.03), (0.62, 0, -0.05), 0.02, red, K, seg=8)]
        for sd in (-1, 1):
            parts.append(B.rod(f'Schlange_Gabel{sd}', (0.61, 0, -0.05), (0.7, sd * 0.04, -0.07), 0.014, red, K, seg=8))
        nk = bpy.data.collections.get('Ohne_Kontur')   # dünn: mit Kontur wäre die Zunge nur ein schwarzer Strich
        for o in parts if nk else []:
            SC.collection.objects.unlink(o)
            nk.objects.link(o)
    root = B.empty('Schlange')
    body.parent = root
    K.parent = root
    return root


# ------------------------------------------------------------------ Aras und Tukan im Flug
VOGEL = {   # Rumpf, Bauch, Kopf, Flügel innen / Band / außen, Schwanz, Schwanzspitze, Schnabel
    'ara_rot': ('#d8262e', '#d8262e', '#d8262e', '#d8262e', '#ffcc22', '#2a5ad8', '#d8262e', '#2a5ad8', '#ece4d4'),
    'ara_blau': ('#2a6ad8', '#ffc828', '#2a8a4a', '#2a6ad8', '#2a6ad8', '#1a3a9a', '#2a6ad8', '#1a3a9a', '#2a2a30'),
    'tukan': ('#1a1a22', '#f8f4e8', '#1a1a22', '#1a1a22', '#1a1a22', '#24242c', '#1a1a22', '#c8262e', '#ff9a1a'),
}


def vogel(B, toon, kind, loc, wing):
    """Vogel im Seitenprofil, fliegt nach +x; wing = Flügelwinkel in Grad (+ oben, − unten)."""
    rumpf, bauch, kopf, f1, f2, f3, schw, spitze, schnabel = [toon(f'V_{kind}{i}', c, hi=0.75) for i, c in enumerate(VOGEL[kind])]
    white, black = toon('C_Weiss', '#ffffff', hi=0.9), toon('N_Schwarz', '#16121e', hi=0.15)
    R = B.empty('Vogel_' + kind)
    R.location = loc
    R.rotation_euler = (0, -0.12, 0)
    R.scale = (1.6, 1.6, 1.6)
    B.sphere(f'V_{kind}_Rumpf', (0, 0, 0), (0.24, 0.12, 0.12), rumpf, R)
    B.sphere(f'V_{kind}_Bauch', (0.03, -0.01, -0.04), (0.2, 0.11, 0.09), bauch, R)
    B.sphere(f'V_{kind}_Kopf', (0.24, 0, 0.07), (0.11, 0.1, 0.1), kopf, R)
    if kind == 'tukan':
        B.sphere(f'V_{kind}_Kehle', (0.26, -0.02, 0.0), (0.08, 0.08, 0.07), bauch, R)
        B.rod(f'V_{kind}_Schnabel', (0.3, 0, 0.06), (0.62, 0, 0.01), 0.07, schnabel, R, r1=0.025, seg=12)
        B.rod(f'V_{kind}_Spitze', (0.56, 0, 0.015), (0.66, 0, 0.0), 0.03, black, R, r1=0.008, seg=10)
        B.sphere(f'V_{kind}_Augring', (0.28, -0.075, 0.09), (0.04, 0.02, 0.04), toon('V_Augring', '#3aa0ff', hi=0.9), R)
    else:
        B.sphere(f'V_{kind}_Gesicht', (0.29, -0.05, 0.07), (0.055, 0.05, 0.06), white, R)
        B.rod(f'V_{kind}_Schnabel', (0.3, 0, 0.07), (0.4, 0, 0.0), 0.05, schnabel, R, r1=0.012, seg=12)
        B.sphere(f'V_{kind}_Unterschnabel', (0.33, 0, 0.0), (0.035, 0.03, 0.03), black, R)
    B.sphere(f'V_{kind}_Auge', (0.3, -0.085, 0.095), (0.022, 0.012, 0.022), black, R)
    tail = 0.36 if kind == 'tukan' else 0.62
    B.rod(f'V_{kind}_Schwanz', (-0.18, 0, -0.01), (-0.18 - tail, 0, -0.1), 0.065, schw, R, r1=0.02, seg=10)
    B.rod(f'V_{kind}_Schwanzspitze', (-0.18 - tail * 0.6, 0, -0.065), (-0.2 - tail, 0, -0.105), 0.04, spitze, R, r1=0.014, seg=10)
    a = math.radians(wing)
    for sd in (-1, 1):
        W = B.empty(f'V_{kind}_Fluegel{sd}')
        W.parent = R
        W.location = (0.04, sd * 0.08, 0.05)
        W.rotation_euler = (sd * a, 0, 0)
        B.sphere(f'V_{kind}_F1{sd}', (0.0, sd * 0.16, 0), (0.15, 0.18, 0.025), f1, W)
        B.sphere(f'V_{kind}_F2{sd}', (-0.05, sd * 0.24, 0), (0.17, 0.2, 0.02), f2, W)
        B.sphere(f'V_{kind}_F3{sd}', (-0.11, sd * 0.33, 0), (0.18, 0.27, 0.016), f3, W)
    return R


VOEGEL = [('ara_rot', (-5.0, 16.0, 3.6)), ('ara_blau', (0.0, 16.0, 3.6)), ('tukan', (5.0, 16.0, 3.6))]
FLUEGEL = [62, 5, -48]   # Flügel oben, Mitte, unten


# ------------------------------------------------------------------ Wimpelketten und Tropenobst (Vordergrund)
def wimpel(SC, B, toon, tube):
    cols = [toon(f'W_{i}', c, hi=0.8) for i, c in enumerate(['#2aa84a', '#ffd23a', '#2a5ad8', '#ffffff', '#e8323a'])]
    rope = toon('R_Seil', '#c8a870')
    B.cone('Wimpelmast', 0, 3.9, 0.07, 0.06, toon('R_HolzDunkel', '#6a4426'), None, xy=(4.6, 15.25), bevel=0)
    for name, a, b, sag, n in (('Wimpel_L', (-5.45, 14.4, 2.95), (-1.0, 15.0, 3.05), 0.55, 9), ('Wimpel_R', (-1.0, 15.0, 3.05), (4.6, 15.25, 3.75), 0.75, 11)):
        A, Bv = Vector(a), Vector(b)
        pts = [A.lerp(Bv, i / 8) - Vector((0, 0, sag * math.sin(math.pi * i / 8))) for i in range(9)]
        tube(name + '_Leine', [tuple(p) for p in pts], 0.012, rope, None)
        for i in range(n):
            u = (i + 0.5) / n
            p = A.lerp(Bv, u) - Vector((0, 0, sag * math.sin(math.pi * u)))
            dirv = (Bv - A).normalized()
            bm = bmesh.new()
            w = 0.16
            v0, v1, v2 = bm.verts.new(p - dirv * w), bm.verts.new(p + dirv * w), bm.verts.new(p + Vector((0, -0.02, -0.34)))
            bm.faces.new((v0, v1, v2))
            o = B.obj(f'{name}{i}', bm, cols[i % len(cols)], None, (0, 0, 0), smooth=False)
            o.modifiers.new('Dicke', 'SOLIDIFY').thickness = 0.01


def obst(SC, B, toon, tube, base=(-1.4, 14.7, 0.8)):
    """Bananenstaude, Ananas und Mangos auf der Kiste neben der Laterne."""
    x, y, z = base
    yellow, brown = toon('O_Banane', '#ffd84a', hi=0.85), toon('O_Stiel', '#5a3a1a')
    for i in range(6):   # Bananen: gekrümmte Rohre um einen Stiel
        a = -0.9 + i * 0.36
        p0 = Vector((x - 0.12 + 0.05 * i, y - 0.05, z + 0.12))
        d = Vector((math.cos(a) * 0.12, -0.18 - 0.02 * (i % 2), 0))
        pts = [p0, p0 + d * 0.6 + Vector((0, 0, 0.1)), p0 + d * 1.3 + Vector((0, 0, 0.24))]
        o, C, T = tube_mesh(SC, f'Banane{i}', pts, lambda s: 0.012 + 0.045 * math.sin(math.pi * min(1, s * 1.1)) ** 0.6, yellow, None, ring=10, n_per=6)
    B.rod('Bananenstiel', (x - 0.05, y - 0.05, z), (x - 0.02, y - 0.06, z + 0.2), 0.035, brown, None, seg=8)
    B.sphere('Ananas', (x + 0.2, y + 0.05, z + 0.17), (0.11, 0.11, 0.17), toon('O_Ananas', '#d88a2a', hi=0.7), None)
    leaf = toon('O_Blatt', '#3a9a3a', hi=0.7)
    for k in range(7):
        a = k * 2 * math.pi / 7
        B.rod(f'Ananasblatt{k}', (x + 0.2, y + 0.05, z + 0.32), (x + 0.2 + math.cos(a) * 0.1, y + 0.05 + math.sin(a) * 0.1, z + 0.52 + 0.04 * (k % 2)), 0.02, leaf, None, r1=0.004, seg=6)
    for k, (dx, dy, c) in enumerate(((0.05, -0.2, '#e85a2a'), (0.22, -0.18, '#f0a020'), (-0.28, -0.22, '#c8402a'))):
        B.sphere(f'Mango{k}', (x + dx, y + dy, z + 0.07), (0.08, 0.065, 0.07), toon(f'O_Mango{k}', c, hi=0.8), None)


def clip_below(o, zmin):
    """Kugel-Teile unter Wasser abschneiden (flach drücken): sonst zeichnet Freestyle deren Umriss durchs Wasser."""
    mw = (o.parent.matrix_basis if o.parent else Matrix()) @ o.matrix_basis
    inv = mw.inverted()
    for v in o.data.vertices:
        w = mw @ v.co
        if w.z < zmin:
            w.z = zmin
            v.co = inv @ w
