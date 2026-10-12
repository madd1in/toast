# Villa Edison als Spukhaus im Stil der Haunted Mansion (Disneyland): elfenbeinfarbenes Herrenhaus im Südstaatenstil
# auf rotem Backstein, Portikus mit sechs schlanken Säulen über zwei Geschosse, Balkon mit schmiedeeisernem Geländer,
# schiefergraues Mansarddach mit Gauben, Kuppel-Laterne mit Schiffs-Wetterfahne – und, ganz DOTT, alles krumm:
# ein Lattice biegt das Haus (oben kippt es, in der Mitte bauchig), Säulen, Kuppel und Schornsteine stehen schief.
# Ersetzt die Szene 'Haus' (die alte Villa bleibt als 'Haus_alt'); Namen wie TuerL/TuerR, FensterO*/FensterU*,
# Laterne0/1, Schornstein und Haupthaus bleiben, damit Titelbild, Auffahrt (raum_build.py) und Ladebild weiter passen.
# In Blender ausführen:  REPO = r'C:/.../Tentakel-Toast'; exec(open(REPO + '/art/blender/spukhaus.py').read())
import bpy, bmesh, math, random, sys, importlib
from mathutils import Vector, Matrix
sys.path.insert(0, REPO + '/art/blender')
import figur_lib
importlib.reload(figur_lib)
from figur_lib import Builder, toon

rnd = random.Random(1988)
HS = bpy.data.scenes['Haus']
# alte Villa sichern: eigene Szene 'Haus_alt' mit allen alten Objekten
neu_alt = 'Haus_alt' not in bpy.data.scenes
alt = bpy.data.scenes.get('Haus_alt') or bpy.data.scenes.new('Haus_alt')
for o in list(HS.collection.objects):
    if o.type in ('CAMERA', 'LIGHT'):
        continue
    if neu_alt:
        alt.collection.objects.link(o); HS.collection.objects.unlink(o)
        if not o.name.endswith('_alt'):
            o.name = o.name + '_alt'   # die neuen Teile sollen die alten Namen tragen (TuerL, Laterne0, FensterU0G …)
    elif o.name in alt.collection.objects:
        HS.collection.objects.unlink(o)
    else:
        bpy.data.objects.remove(o, do_unlink=True)   # Reste eines früheren Laufs
for c in list(HS.collection.children):
    HS.collection.children.unlink(c)

B = Builder(HS)
WAND = toon('S_Wand', '#d9cfd8', hi=0.72)   # blasses Lila-Grau: weißes Herrenhaus im Mondlicht
WEISS = toon('S_Weiss', '#ece6ee', hi=0.85)
DACH = toon('S_Dach', '#3c4250', hi=0.45)
ZIEGEL = toon('S_Ziegel', '#9a3c2c', hi=0.5)
LADEN = toon('S_Laden', '#1c2a24', hi=0.35)
EISEN = toon('S_Eisen', '#141218', hi=0.3)
TUER = bpy.data.materials.get('HausTuer') or toon('HausTuer', '#4a2a14')
FENSTER = bpy.data.materials.get('HausFenster')
LAMPE = bpy.data.materials.get('HausLampe') or toon('HausLampe', '#ffd27a', hi=1.0)
MESSING = bpy.data.materials.get('HausMessing') or toon('HausMessing', '#c8a04a')


def box(name, x0, x1, y0, y1, z0, z1, mat, cuts=0, bevel=0.0, parent=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    if cuts:   # fein unterteilt: der Lattice biegt dann die Wände selbst, nicht nur die Ecken
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    bmesh.ops.scale(bm, vec=(x1 - x0, y1 - y0, z1 - z0), verts=bm.verts)
    return B.obj(name, bm, mat, parent, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), smooth=False, bevel=bevel)


def frustum(name, x0, x1, y0, y1, z0, z1, ein, mat, cuts=4):
    """Dachstumpf: unten x0..x1/y0..y1, oben um 'ein' eingezogen."""
    bm = bmesh.new()
    unten = [bm.verts.new(v) for v in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0))]
    oben = [bm.verts.new(v) for v in ((x0 + ein, y0 + ein, z1), (x1 - ein, y0 + ein, z1), (x1 - ein, y1 - ein, z1), (x0 + ein, y1 - ein, z1))]
    for i in range(4):
        bm.faces.new((unten[i], unten[(i + 1) % 4], oben[(i + 1) % 4], oben[i]))
    bm.faces.new(oben); bm.faces.new(list(reversed(unten)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if cuts:
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    return B.obj(name, bm, mat, None, (0, 0, 0), smooth=False)


# ---- Körper ----
box('Sockel', -1.96, 1.96, -1.06, 1.06, 0.0, 0.14, ZIEGEL, cuts=6)
box('Haupthaus', -1.9, 1.9, -1.0, 1.0, 0.12, 2.5, WAND, cuts=9)
box('Gesims', -2.0, 2.0, -1.1, 1.1, 2.45, 2.58, WEISS, cuts=6)
frustum('Dach', -2.02, 2.02, -1.12, 1.12, 2.58, 3.18, 0.42, DACH, cuts=5)
frustum('DachOben', -1.6, 1.6, -0.7, 0.7, 3.18, 3.42, 0.5, DACH, cuts=3)
box('DachKante', -1.62, 1.62, -0.72, 0.72, 3.15, 3.2, WEISS, cuts=4)
# Zinnen-Gitter (Dachkamm aus Eisenspitzen) auf dem oberen Dach
for i in range(15):
    x = -1.05 + i * 0.15
    B.cone(f'Dachkamm{i}', 3.42, 3.56, 0.018, 0.0, EISEN, None, xy=(x, 0), seg=6, bevel=0.0)
box('DachkammLeiste', -1.08, 1.08, -0.012, 0.012, 3.42, 3.45, EISEN)
# Gauben im unteren Dach (vorn drei, hinten drei, seitlich je eine)
gauben = [(-1.15, -0.86, 0), (0.0, -0.86, 0), (1.15, -0.86, 0), (-1.15, 0.86, math.pi), (0.0, 0.86, math.pi), (1.15, 0.86, math.pi), (-1.72, 0, -math.pi / 2), (1.72, 0, math.pi / 2)]
for i, (x, y, rot) in enumerate(gauben):
    g = B.empty(f'Gaube{i}', (x, y, 2.78)); g.rotation_euler = (0, 0, rot)
    box(f'GaubeKorpus{i}', -0.17, 0.17, -0.12, 0.12, -0.02, 0.36, WAND, parent=g)
    box(f'GaubeFenster{i}', -0.1, 0.1, -0.135, -0.12, 0.04, 0.28, FENSTER, parent=g)
    gd = B.cone(f'GaubeDach{i}', 0.36, 0.58, 0.27, 0.0, DACH, g, seg=4, bevel=0.0, rot=(0, 0, math.pi / 4))
    gd.scale = (1.0, 0.65, 1.0)
# Kuppel-Laterne (Belvedere) mit Bogenfenstern, Haube und Schiffs-Wetterfahne
kp = B.empty('Kuppel', (0, 0.05, 3.42))
B.cone('KuppelSockel', 0.0, 0.08, 0.46, 0.46, WEISS, kp, seg=8)
B.cone('KuppelTurm', 0.08, 0.62, 0.36, 0.34, WAND, kp, seg=8)
for i in range(8):
    w = i * math.pi / 4 + math.pi / 8
    f = box(f'KuppelFenster{i}', -0.06, 0.06, -0.012, 0.012, 0.16, 0.5, FENSTER, parent=kp)
    f.location = (math.cos(w) * 0.352, math.sin(w) * 0.352, 0.33); f.rotation_euler = (0, 0, w + math.pi / 2)
B.cone('KuppelGesims', 0.6, 0.68, 0.44, 0.44, WEISS, kp, seg=8)
B.cone('KuppelHaube', 0.68, 1.12, 0.46, 0.03, DACH, kp, seg=8)
B.rod('KuppelSpitze', (0, 0, 1.1), (0, 0, 1.52), 0.014, EISEN, kp)
fahne = B.empty('Wetterfahne', (0, 0, 1.5)); fahne.parent = kp
box('FahneRumpf', -0.16, 0.16, -0.025, 0.025, -0.03, 0.03, EISEN, parent=fahne)
for j, (x, h) in enumerate(((-0.06, 0.16), (0.07, 0.2))):   # zwei Segel des Geisterschiffs
    s = B.cone(f'FahneSegel{j}', 0.03, 0.03 + h, 0.07, 0.0, EISEN, fahne, seg=3, bevel=0.0); s.location = (x, 0, 0.03 + h / 2); s.scale = (1, 0.15, 1)
# Portikus: sechs Säulen über zwei Geschosse, Gebälk, Balkon mit Eisengeländer
box('Veranda', -1.78, 1.78, -1.64, -1.0, 0.0, 0.14, ZIEGEL, cuts=4)
box('VerandaBoden', -1.76, 1.76, -1.62, -1.0, 0.14, 0.17, WEISS)
for i, x in enumerate((-1.5, -0.9, -0.3, 0.3, 0.9, 1.5)):
    s = B.cone(f'Saeule{i}', 0.17, 2.36, 0.07, 0.058, WEISS, None, xy=(x, -1.44), seg=14)
    s.rotation_euler = (rnd.uniform(-0.07, 0.07), rnd.uniform(-0.11, 0.11), 0)   # jede Säule anders schief
    box(f'SaeuleFuss{i}', x - 0.1, x + 0.1, -1.54, -1.34, 0.17, 0.24, WEISS)
    box(f'SaeuleKopf{i}', x - 0.11, x + 0.11, -1.55, -1.33, 2.33, 2.42, WEISS)
box('Gebaelk', -1.78, 1.78, -1.58, -1.0, 2.4, 2.54, WEISS, cuts=6)
box('Balkon', -1.66, 1.66, -1.52, -1.0, 1.18, 1.25, WEISS, cuts=4)
bm = bmesh.new()   # Geländer: Handlauf, Fußleiste, verschnörkelte Stäbe
for z in (1.27, 1.56):
    bmesh.ops.create_cube(bm, size=1, matrix=Matrix.LocRotScale((0, -1.49, z), None, (3.3, 0.025, 0.025)))
for i in range(44):
    x = -1.62 + i * 0.0755
    bmesh.ops.create_cube(bm, size=1, matrix=Matrix.LocRotScale((x, -1.49, 1.415), None, (0.012, 0.012, 0.29)))
    if i % 3 == 1:
        bmesh.ops.create_uvsphere(bm, u_segments=6, v_segments=4, radius=0.02, matrix=Matrix.Translation((x, -1.49, 1.42)))
B.obj('Gelaender', bm, EISEN, None, (0, 0, 0), smooth=False)
# Haustür: zwei Flügel, Oberlicht, Rahmen, Laternen, Stufen
box('TuerRahmen', -0.42, 0.42, -1.04, -0.99, 0.17, 1.17, WEISS)
box('TuerL', -0.34, -0.005, -1.07, -1.035, 0.18, 0.98, TUER)
box('TuerR', 0.005, 0.34, -1.07, -1.035, 0.18, 0.98, TUER)
for k, x in ((0, -0.07), (1, 0.07)):
    B.sphere(f'Klinke{k}', (x, -1.085, 0.56), (0.022, 0.015, 0.022), MESSING, None)
box('Oberlicht', -0.3, 0.3, -1.046, -1.03, 1.0, 1.13, FENSTER)   # Oberlicht über der Tür
for i, x in enumerate((-0.52, 0.52)):
    B.sphere(f'Laterne{i}', (x, -1.08, 0.78), (0.055, 0.055, 0.08), LAMPE, None)
    B.cone(f'LaterneDach{i}', 0.85, 0.92, 0.075, 0.0, EISEN, None, xy=(x, -1.08), seg=6, bevel=0.0)
for i, (y0, y1, z) in enumerate(((-1.98, -1.62, 0.05), (-1.88, -1.62, 0.1))):
    box(f'Stufe{i + 1}', -0.6 + i * 0.08, 0.6 - i * 0.08, y0, y1, 0.0, z + 0.05, ZIEGEL)
# Fenster: hoch und schmal, weiße Rahmen, schwarze Läden (leicht schief), warmes und grünliches Spuklicht
GRUEN = bpy.data.materials.get('S_FensterGruen')
if GRUEN is None and FENSTER is not None:
    GRUEN = FENSTER.copy(); GRUEN.name = 'S_FensterGruen'
    for n in GRUEN.node_tree.nodes:
        if n.type in ('EMISSION', 'BSDF_PRINCIPLED'):
            for k in ('Color', 'Emission Color', 'Base Color'):
                if k in n.inputs: n.inputs[k].default_value = (0.55, 1.0, 0.6, 1)


def fenster(name, x, y, z, w, h, normal, gruen=False):
    g = B.empty(name, (x, y, z)); g.rotation_euler = (0, 0, normal)
    box(name + 'R', -w / 2 - 0.035, w / 2 + 0.035, -0.022, 0.0, -h / 2 - 0.035, h / 2 + 0.06, WEISS, parent=g)
    box(name + 'G', -w / 2, w / 2, -0.03, -0.012, -h / 2, h / 2, GRUEN if gruen else FENSTER, parent=g)
    box(name + 'Kreuz', -0.008, 0.008, -0.034, -0.02, -h / 2, h / 2, WEISS, parent=g)
    box(name + 'Bank', -w / 2 - 0.06, w / 2 + 0.06, -0.06, 0.0, -h / 2 - 0.06, -h / 2 - 0.03, WEISS, parent=g)
    for k, sx in ((1, -1), (2, 1)):
        l = box(f'Laden{name}{k}', -w / 4, w / 4, -0.028, -0.014, -h / 2, h / 2, LADEN, parent=g)
        l.location = (sx * (w / 2 + w / 4 + 0.05), -0.01, 0); l.rotation_euler = (0, rnd.uniform(-0.06, 0.06), 0)
    return g


n = 0
for i, x in enumerate((-1.5, -0.95, 0.95, 1.5)):   # vorn unten (neben der Tür)
    fenster(f'FensterU{i}', x, -1.0, 0.68, 0.24, 0.62, 0, gruen=(i == 3)); n += 1
for i, x in enumerate((-1.55, -0.95, -0.32, 0.32, 0.95, 1.55)):   # vorn oben (hinter dem Balkon)
    fenster(f'FensterO{i}', x, -1.0, 1.84, 0.24, 0.66, 0, gruen=(i == 1))
for i, x in enumerate((-1.45, -0.5, 0.5, 1.45)):   # hinten
    fenster(f'FensterHU{i}', x, 1.0, 0.68, 0.24, 0.62, math.pi); fenster(f'FensterHO{i}', x, 1.0, 1.84, 0.24, 0.66, math.pi, gruen=(i == 2))
for k, xs in ((-1, -1.9), (1, 1.9)):   # Seiten
    for i, y in enumerate((-0.45, 0.45)):
        fenster(f'FensterS{k}U{i}', xs, y, 0.68, 0.24, 0.62, -k * math.pi / 2); fenster(f'FensterS{k}O{i}', xs, y, 1.84, 0.24, 0.66, -k * math.pi / 2, gruen=(k > 0 and i == 0))
# schiefe Backstein-Schornsteine
for i, (x, kipp) in enumerate(((-1.25, 0.2), (1.3, -0.26))):
    s = box('Schornstein' if i == 0 else 'Schornstein2', x - 0.13, x + 0.13, 0.15, 0.45, 2.75, 3.75, ZIEGEL, cuts=3)
    s.rotation_euler = (0, kipp, 0)
    k = box('SchornsteinKopf' if i == 0 else 'SchornsteinKopf2', x - 0.16, x + 0.16, 0.12, 0.48, 3.72, 3.8, WEISS)
    k.rotation_euler = (0, kipp, 0); k.location.x += kipp * 1.0
kp.rotation_euler = (0.09, -0.22, 0.12)   # Kuppel kippt kräftig
fahne.rotation_euler = (0, 0, 0.6)

# ---- alles krumm: Lattice über das ganze Haus, dann eingebacken ----
lat_data = bpy.data.lattices.new('SpukGitter')
lat_data.points_u, lat_data.points_v, lat_data.points_w = 3, 3, 4
lat = bpy.data.objects.new('SpukGitter', lat_data); HS.collection.objects.link(lat)
lat.location, lat.scale = (0, -0.25, 2.5), (4.6, 3.4, 5.4)
for p in lat_data.points:
    u, v, w = p.co   # -0.5 … 0.5
    hoch = max(0.0, min(1.0, w + 0.5))   # 0 unten, 1 oben
    d = Vector((-0.11 * hoch ** 1.5 + 0.02 * math.sin(v * 6 + hoch * 3),   # oben kippt das Haus kräftig nach links
                0.03 * hoch,
                0.0))
    d.x += 0.07 * (1 - abs(u) * 2) * math.sin(hoch * math.pi)   # bauchig in der Mitte
    d.z += -0.06 * (1 - abs(u) * 2) * hoch + 0.035 * u * hoch   # das Dach hängt durch und steigt nach rechts
    w_ = 0.13 * hoch   # leicht verdreht (oben gegen unten)
    d.x += u * (math.cos(w_) - 1) - v * math.sin(w_); d.y += u * math.sin(w_) + v * (math.cos(w_) - 1)
    p.co_deform = Vector((u, v, w)) + d
for o in list(HS.collection.objects):
    if o.type == 'MESH':
        m = o.modifiers.new('Krumm', 'LATTICE'); m.object = lat
HS.view_layers[0].update()
dg = HS.view_layers[0].depsgraph   # auch im Hintergrund-Job die Ebene dieser Szene
for o in list(HS.collection.objects):
    if o.type != 'MESH' or 'Krumm' not in o.modifiers:
        continue
    ev = o.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)   # alle Modifier eingebacken (Fase, Lattice)
    o.modifiers.clear()
    o.data = me
bpy.data.objects.remove(lat, do_unlink=True)
print('Spukhaus fertig:', len(HS.collection.objects), 'Objekte')
