# Lieferraumschiff (Verbeugung vor dem Futurama-Lieferschiff) als Modell für Landeplatz und Marsgesicht (raum_build.py).
# Rumpf als Drehkörper (glatte Pillenform, zweifarbig: helles Oberdeck, dunklere Unterseite, rote Nahtlinie), Nasen- und Heckkappe,
# Glaskuppel, helle Schrift „WIR LIEFERN ÜBERALLHIN“, offene Luke mit warmem Licht und Kisten, Rampe mit Warnstreifen und Geländer,
# zwei Seitentriebwerke an Pylonen, geschwungenes Leitwerk mit Emblem, Höhenflossen, Landebeine mit Füßen, Lüftungsschlitze,
# Scheinwerfer und Positionslichter. Die Nase zeigt nach +x, die Kamera schaut von -y darauf; die Wurzel S gibt Ort und Drehung vor.
import bpy, bmesh, math
from mathutils import Vector

# Rumpfprofil (x, Radius) um die Längsachse; die Achse liegt auf Höhe AXIS über dem Boden
HULL = [(-5.5, 0.0), (-5.42, 0.5), (-5.0, 1.05), (-4.0, 1.55), (-2.4, 1.86), (-0.6, 1.98), (1.4, 2.0), (3.0, 1.93), (4.3, 1.72), (5.3, 1.32), (5.95, 0.82), (6.2, 0.4), (6.3, 0.0)]
AXIS = 2.6


def r_at(x):
    for (x0, r0), (x1, r1) in zip(HULL, HULL[1:]):
        if x0 <= x <= x1:
            return r0 + (r1 - r0) * (x - x0) / (x1 - x0)
    return 0.0


def revolve(B, name, prof, mat, parent, N=56, loc=(0, 0, 0), solid=0.0, arc=None):
    """Drehkörper um die x-Achse; arc=(a0, a1) baut nur einen Winkelbereich (a = 0 oben quer: +y, π/2 oben, π: -y zur Kamera)."""
    full = arc is None
    M = N if full else max(2, int(N * (arc[1] - arc[0]) / (2 * math.pi)))
    ang = [2 * math.pi * k / N for k in range(N)] if full else [arc[0] + (arc[1] - arc[0]) * k / M for k in range(M + 1)]
    bm = bmesh.new()
    rings = []
    for x, r in prof:
        rings.append([bm.verts.new((x, 0, 0))] if r < 1e-6 else [bm.verts.new((x, r * math.cos(a), r * math.sin(a))) for a in ang])
    n = len(ang)
    for a, b in zip(rings, rings[1:]):
        for k in range(n if full else n - 1):
            k1 = (k + 1) % n
            if len(a) == 1:
                bm.faces.new((a[0], b[k1], b[k]))
            elif len(b) == 1:
                bm.faces.new((a[k], a[k1], b[0]))
            else:
                bm.faces.new((a[k], a[k1], b[k1], b[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return B.obj(name, bm, mat, parent, loc, solid=solid)


def poly(B, name, pts, mat, parent, solid=0.15, bevel=0.0):
    bm = bmesh.new()
    bm.faces.new([bm.verts.new(p) for p in pts])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return B.obj(name, bm, mat, parent, (0, 0, 0), smooth=False, solid=solid, bevel=bevel)


def cube(B, name, loc, size, mat, parent, rot=(0, 0, 0), bevel=0.02):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    return B.obj(name, bm, mat, parent, loc, rot, size, smooth=False, bevel=bevel)


def side_y(x, dz):
    """y der Rumpfwand (kamerazugewandte Seite) in x bei Höhe dz über der Längsachse."""
    return -math.sqrt(max(0.05, r_at(x) ** 2 - dz ** 2))


def build(SC, B, toon, S):
    UPPER, LOWER, GREEND = toon('R_SchiffOben', '#74dd8a', hi=0.4), toon('R_Schiff', '#35a055', hi=0.35), toon('R_SchiffDunkel', '#2f8a4a')
    CREAM, RED, GLASS = toon('R_SchiffCreme', '#f4efdc', hi=0.6), toon('R_Band', '#ff5a4a'), toon('R_Fenster', '#bfefff', hi=0.95)
    METAL, DARK, ORANGE = toon('R_Metall', '#9aa0b8', hi=0.75), toon('R_Dunkel', '#241a38'), toon('R_Feuer', '#ffb04a', hi=0.95)
    WARM, CRATE, YEL = toon('R_SchiffLicht', '#ffe9a8', hi=1.0), toon('R_SchiffKiste', '#b8782e', hi=0.2), toon('R_Warnung', '#ffd23a', hi=0.4)
    TXT = toon('R_SchiffSchrift', '#f4efdc', hi=0.2)

    # --- Rumpf: Oberdeck hell, Unterseite dunkler, dazu rote Nahtlinie, Nasen- und Heckkappe ---
    revolve(B, 'SchiffOben', HULL, UPPER, S, loc=(0, 0, AXIS), arc=(0, math.pi))
    revolve(B, 'SchiffUnten', HULL, LOWER, S, loc=(0, 0, AXIS), arc=(math.pi, 2 * math.pi))
    revolve(B, 'SchiffNase', [(x, r * 1.014) for x, r in HULL if x >= 5.3], CREAM, S, loc=(0, 0, AXIS))
    revolve(B, 'SchiffHeck', [(x, r * 1.014) for x, r in HULL if x <= -4.9], GREEND, S, loc=(0, 0, AXIS))
    revolve(B, 'SchiffNaht', [(x, r_at(x) * 1.012) for x in [-5.0 + 0.5 * i for i in range(20)]], RED, S, loc=(0, 0, AXIS), arc=(math.pi - 0.04, math.pi + 0.04))
    for i, x in enumerate((-3.9, 3.6)):   # Querfugen
        B.torus(f'SchiffFuge{i}', (x, 0, AXIS), r_at(x) * 1.004, 0.012, GREEND, S, rot=(0, math.pi / 2, 0), seg=56, sseg=5)
    # --- Schrift auf dem Oberdeck, der Wand angeschmiegt, ohne Freestyle-Kontur ---
    zt = 0.85
    delta = math.asin(zt / r_at(0.3))
    cd = bpy.data.curves.get('SchiffText') or bpy.data.curves.new('SchiffText', 'FONT')
    cd.body, cd.size, cd.align_x, cd.align_y, cd.extrude = 'WIR LIEFERN\nÜBERALLHIN', 0.5, 'CENTER', 'CENTER', 0.01
    cd.space_line = 0.85
    cd.materials.clear()
    cd.materials.append(TXT)
    t = bpy.data.objects.new('SchiffText', cd)
    SC.collection.objects.link(t)
    t.parent = S
    t.location, t.rotation_euler = (-1.4, side_y(0.3, zt) - 0.03, AXIS + zt), (math.pi / 2 - delta, 0, 0)   # Wand am dicksten bei x ≈ 0: dort anliegen, links schwebt die Schrift minimal
    t.visible_shadow = False   # sonst wirft die Schrift je nach Sonnenstand einen Doppelgänger auf den Rumpf
    nk = bpy.data.collections.get('Ohne_Kontur')
    if nk is not None:
        nk.objects.link(t)
    # --- Glaskuppel mit Rahmen, Scheinwerfer an der Nase ---
    B.sphere('Kuppel', (3.9, 0, AXIS + 1.7), (1.75, 1.0, 0.72), GLASS, S)
    B.torus('KuppelRahmen', (3.9, 0, AXIS + 1.42), 1.0, 0.05, METAL, S, scale=(1.75, 1.0, 1.0), seg=40, sseg=6)
    B.rod('KuppelStrebe', (2.4, 0, AXIS + 1.55), (5.1, 0, AXIS + 1.35), 0.04, METAL, S, seg=8)
    for sgn, nm in ((-1, 'N'), (1, 'F')):
        B.sphere(f'Scheinwerfer{nm}', (5.55, sgn * 0.95, AXIS + 0.1), (0.24, 0.14, 0.24), WARM, S)
        B.torus(f'ScheinwerferRing{nm}', (5.52, sgn * 0.98, AXIS + 0.1), 0.24, 0.025, METAL, S, rot=(math.pi / 2, 0, 0), seg=24, sseg=5)
    # --- Bullaugen mit Rahmen und Lüftungsschlitzen am Heck ---
    for i, x in enumerate((-3.2, -1.8, -0.4)):
        y = side_y(x, -0.55) - 0.015
        B.sphere(f'Bullauge{i}', (x, y, AXIS - 0.55), (0.36, 0.1, 0.36), GLASS, S)
        B.torus(f'BullRahmen{i}', (x, y - 0.03, AXIS - 0.55), 0.36, 0.04, METAL, S, rot=(math.pi / 2, 0, 0), seg=28, sseg=6)
    for i in range(5):
        cube(B, f'Lamelle{i}', (-4.25, side_y(-4.25, 0.75 - i * 0.16) - 0.01, AXIS + 0.75 - i * 0.16), (0.9, 0.05, 0.07), GREEND, S, bevel=0.3)
    # --- Luke: offen, innen warm erleuchtet, mit Kisten; davor die Rampe mit Warnstreifen und Geländer ---
    zc = -0.35
    ys = side_y(1.2, zc) - 0.03
    tilt = -math.asin(zc / r_at(1.2))
    cube(B, 'LukenRahmen', (1.2, ys, AXIS + zc), (2.2, 0.28, 1.8), CREAM, S, rot=(tilt, 0, 0), bevel=0.12)
    cube(B, 'LukenLicht', (1.2, ys - 0.11, AXIS + zc), (1.8, 0.1, 1.42), WARM, S, rot=(tilt, 0, 0), bevel=0.1)
    for i, (x, w, h) in enumerate(((0.65, 0.5, 0.55), (1.3, 0.42, 0.75), (1.85, 0.46, 0.4))):
        cube(B, f'LukenKiste{i}', (x, ys - 0.2, AXIS + zc - 0.7 + h / 2), (w, 0.1, h), CRATE, S, rot=(tilt, 0, 0), bevel=0.12)
    cube(B, 'LukenGriff', (0.0, ys - 0.1, AXIS + zc), (0.1, 0.06, 0.5), METAL, S, rot=(tilt, 0, 0), bevel=0.3)
    rc, d, n = Vector((1.2, -2.35, 0.6)), Vector((0, 0.9, -0.435)), Vector((0, 0.435, 0.9))
    cube(B, 'Rampe', tuple(rc), (1.9, 2.6, 0.12), METAL, S, rot=(-0.45, 0, 0))
    for i in range(7):
        c = rc + d * (-1.1 + i * 0.37) + n * 0.095
        cube(B, f'Warnstreifen{i}', tuple(c), (1.8, 0.17, 0.05), YEL if i % 2 == 0 else DARK, S, rot=(-0.45, 0, 0), bevel=0.05)
    for i, x in enumerate((0.3, 2.1)):
        B.rod(f'RampenGeland{i}', (x, -1.98, 1.3), (x, -3.28, 0.62), 0.03, METAL, S, seg=8)
        B.rod(f'RampenPfosten{i}', (x, -3.28, 0.62), (x, -3.28, 0.2), 0.03, METAL, S, seg=8)
    # --- Leitwerk: geschwungene Flosse mit heller Spitze und Emblem, dazu kleine Höhenflossen mit Positionslichtern ---
    fin = [(-1.7, 0, AXIS + 1.85), (-2.9, 0, AXIS + 2.9), (-4.5, 0, 6.35), (-5.5, 0, 6.15), (-5.4, 0, AXIS + 0.8), (-4.0, 0, AXIS + 0.3)]
    poly(B, 'Flosse', fin, UPPER, S, solid=0.22)
    poly(B, 'FlossenSpitze', [(-4.0, 0, 5.85), (-4.5, 0, 6.38), (-5.5, 0, 6.18), (-5.47, 0, 5.55)], CREAM, S, solid=0.26)
    B.cone('FlossenEmblem', 4.73, 4.75, 0.55, 0.55, RED, S, xy=(-3.9, -0.13), rot=(math.pi / 2, 0, 0), bevel=0)
    B.cone('FlossenEmblemKern', 4.74, 4.76, 0.3, 0.3, CREAM, S, xy=(-3.9, -0.14), rot=(math.pi / 2, 0, 0), bevel=0)
    for sgn, nm in ((1, 'L'), (-1, 'R')):
        poly(B, f'Hoehenflosse{nm}', [(-3.5, sgn * 1.3, AXIS + 0.2), (-5.0, sgn * 3.5, AXIS + 0.5), (-5.6, sgn * 3.5, AXIS + 0.5), (-5.4, sgn * 1.2, AXIS + 0.2)], UPPER, S, solid=0.12)
        B.sphere(f'FlossenLicht{nm}', (-5.3, sgn * 3.5, AXIS + 0.5), (0.1, 0.1, 0.1), toon('R_NavRot' if sgn > 0 else 'R_NavGruen', '#ff4a5a' if sgn > 0 else '#5aff8a', hi=0.95), S)
    # --- Haupttriebwerk am Heck ---
    B.cone('Duese', AXIS - 0.4, AXIS + 0.4, 1.0, 0.78, GREEND, S, xy=(-5.95, 0), rot=(0, math.pi / 2, 0), bevel=0.03)
    B.cone('DueseInnen', AXIS - 0.1, AXIS + 0.1, 0.75, 0.7, DARK, S, xy=(-6.38, 0), rot=(0, math.pi / 2, 0), bevel=0)
    B.sphere('Turbine', (-6.45, 0, AXIS), (0.14, 0.62, 0.62), ORANGE, S)
    # --- Seitentriebwerke an Pylonen, mit roten Zierbändern ---
    for sgn, nm in ((-1, 'N'), (1, 'F')):   # N = nah an der Kamera
        y = sgn * 2.45
        cube(B, f'Pylon{nm}', (-3.7, sgn * 1.85, AXIS - 0.75), (1.8, 0.7, 0.16), GREEND, S, bevel=0.3)
        B.cone(f'Pod{nm}', AXIS - 2.0, AXIS + 0.4, 0.46, 0.46, LOWER, S, xy=(-3.9, y), rot=(0, math.pi / 2, 0), bevel=0.02)
        B.sphere(f'PodNase{nm}', (-2.7, y, AXIS - 0.8), (0.65, 0.46, 0.46), CREAM, S)
        for j, x in enumerate((-4.5, -3.3)):
            B.torus(f'PodRing{nm}{j}', (x, y, AXIS - 0.8), 0.47, 0.04, RED if j else GREEND, S, rot=(0, math.pi / 2, 0), seg=32, sseg=6)
        B.sphere(f'PodTurbine{nm}', (-5.12, y, AXIS - 0.8), (0.12, 0.4, 0.4), ORANGE, S)
    # --- Landebeine mit Kolben und Fußplatten ---
    for i, x in enumerate((-3.1, 0.9, 3.7)):
        for sgn, nm in ((-1, 'N'), (1, 'F')):
            y0, y1 = sgn * 1.15, sgn * 1.55
            B.sphere(f'BeinGelenk{i}{nm}', (x, y0, 1.15), (0.17, 0.17, 0.17), METAL, S)
            B.rod(f'Bein{i}{nm}', (x, y0, 1.15), (x, y1, 0.12), 0.09, METAL, S, r1=0.07, seg=12)
            B.rod(f'BeinKolben{i}{nm}', (x + 0.16, y0, 1.1), (x + 0.16, y1 * 0.93, 0.5), 0.04, DARK, S, seg=8)
            B.cone(f'BeinFuss{i}{nm}', 0.0, 0.09, 0.34, 0.3, DARK, S, xy=(x, y1), bevel=0.01)
    # --- Antenne mit Blinklicht und Schüssel ---
    B.rod('Antenne', (-1.2, 0, AXIS + 2.0), (-1.2, 0, AXIS + 2.8), 0.03, METAL, S, seg=8)
    B.sphere('AntenneLicht', (-1.2, 0, AXIS + 2.85), (0.09, 0.09, 0.09), toon('R_NavRot', '#ff4a5a', hi=0.95), S)
    B.sphere('Schuessel', (-0.4, 0, AXIS + 2.05), (0.42, 0.42, 0.1), METAL, S, rot=(0, -0.5, 0))
