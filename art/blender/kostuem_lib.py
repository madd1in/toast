# Das Tentakel-Kostüm aus Gertrudes Nähstube (1776): die Form des Tentakel-Modells (Szene Tentakel3D_v2, ohne Arme),
# aber aus Fahnenstoff – rot-weiße Ringelstreifen, oben ein blaues Feld mit weißen Sternen –, mit Saum, Nahtstichen und zwei
# Augenlöchern. Wird dreimal gebraucht: als Fahne im Gasthaus 1776, als „Ur-Fahne“ am Mast im Zukunftsgarten und von
# Laverne getragen (dann schauen ihre Augen und ihre Nase durch die Löcher, unten die Ringelbeine; kostuem_build.py).
# Alle Teile liegen in Modell-Einheiten (Saum bei z = 0, Kuppe bei 3,44) unter einer Wurzel, die man skaliert und dreht.
import bpy, math
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from figur_lib import hexlin

TOP = 3.44                          # Kuppe des Modells
FRONT = Vector((-0.955, 0.296, 0))  # Blickrichtung (zur Mundöffnung) in Modell-Koordinaten
SIDE = Vector((-FRONT.y, FRONT.x, 0))


def _world(o):
    return (_world(o.parent) @ o.matrix_parent_inverse if o.parent else Matrix.Identity(4)) @ o.matrix_basis


def _link(SC, o, parent):
    SC.collection.objects.link(o)
    o.parent = parent
    o.matrix_parent_inverse = Matrix.Identity(4)
    return o


def _toon_kopie(name, src='TentKoerper'):
    """Kopie eines Tentakel-Materials (Toon-Shader der Figuren); Farbe danach über ToonMul A / Base Color."""
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials[src].copy()
        m.name = name
    hi = m.node_tree.nodes.get('ToonHi')
    if hi:   # Stoff glänzt nicht
        hi.color_ramp.elements[1].color = (0.1, 0.1, 0.1, 1)
    return m


def farbe(name, hexcol, src='TentKoerper'):
    m = _toon_kopie(name, src)
    col = (*hexlin(hexcol), 1)
    nt = m.node_tree
    nt.nodes['ToonMul'].inputs[6].default_value = col
    next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value = col
    m.diffuse_color = col
    return m


def _prozedural(m, bau):
    """Farbe aus einem Knoten-Netz (bau(nt) -> Farb-Ausgang) in ToonMul A und Base Color einspeisen."""
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.name.startswith('KS_'):
            nt.nodes.remove(n)
    out = bau(nt)
    nt.links.new(out, nt.nodes['ToonMul'].inputs[6])
    nt.links.new(out, next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'])
    return m


def _node(nt, typ, name, **kw):
    n = nt.nodes.new(typ)
    n.name = 'KS_' + name
    for k, v in kw.items():
        setattr(n, k, v)
    return n


def _math(nt, name, op, a, b=None, val=None):
    n = _node(nt, 'ShaderNodeMath', name, operation=op)
    for i, x in enumerate((a, b)):
        if x is None:
            continue
        if isinstance(x, (int, float)):
            n.inputs[i].default_value = x
        else:
            nt.links.new(x, n.inputs[i])
    if val is not None:
        n.inputs[1].default_value = val
    return n.outputs[0]


def _mix(nt, name, fac, a, b):
    n = _node(nt, 'ShaderNodeMix', name, data_type='RGBA')
    nt.links.new(fac, n.inputs['Factor'])
    for sock, x in (('A', a), ('B', b)):
        inp = n.inputs[6 if sock == 'A' else 7]
        if isinstance(x, tuple):
            inp.default_value = x
        else:
            nt.links.new(x, inp)
    return n.outputs[2]


ROT, WEISS, BLAU = '#c8202e', '#f6f2ea', '#1f3a8a'


def sternenbanner(name='K_Sternenbanner', blau_ab=2.32, streifen=13):
    """Ringelstreifen rot/weiß unten, blaues Feld mit weißen Sternen ab z = blau_ab (Objekt-Koordinaten = Modell-Koordinaten)."""
    m = _toon_kopie(name)

    def bau(nt):
        tc = _node(nt, 'ShaderNodeTexCoord', 'tc')
        sep = _node(nt, 'ShaderNodeSeparateXYZ', 'sep')
        nt.links.new(tc.outputs['Object'], sep.inputs[0])
        z = sep.outputs['Z']
        k = math.pi * streifen / blau_ab
        s = _math(nt, 'gt', 'GREATER_THAN', _math(nt, 'sin', 'SINE', _math(nt, 'mul', 'MULTIPLY', z, k)), 0.0)
        streif = _mix(nt, 'streif', s, (*hexlin(WEISS), 1), (*hexlin(ROT), 1))
        vor = _node(nt, 'ShaderNodeTexVoronoi', 'vor', voronoi_dimensions='3D')
        vor.inputs['Scale'].default_value = 3.6
        vor.inputs['Randomness'].default_value = 0.35
        nt.links.new(tc.outputs['Object'], vor.inputs['Vector'])
        stern = _math(nt, 'st', 'LESS_THAN', vor.outputs['Distance'], 0.3)
        oben = _mix(nt, 'oben', stern, (*hexlin(BLAU), 1), (*hexlin(WEISS), 1))
        b = _math(nt, 'blau', 'GREATER_THAN', z, blau_ab)
        return _mix(nt, 'alles', b, streif, oben)
    return _prozedural(m, bau)


def ringelsocken(name='K_Ringelsocken', periode=0.085):
    """Lavernes Ringelstrümpfe (Objekt-z in Metern, Bein-Objekte ohne Drehung)."""
    m = _toon_kopie(name)

    def bau(nt):
        tc = _node(nt, 'ShaderNodeTexCoord', 'tc')
        sep = _node(nt, 'ShaderNodeSeparateXYZ', 'sep')
        nt.links.new(tc.outputs['Object'], sep.inputs[0])
        s = _math(nt, 'gt', 'GREATER_THAN', _math(nt, 'sin', 'SINE', _math(nt, 'mul', 'MULTIPLY', sep.outputs['Z'], math.pi / periode)), 0.0)
        return _mix(nt, 'socke', s, (*hexlin('#f4f0ea'), 1), (*hexlin('#e0262e'), 1))
    return _prozedural(m, bau)


def _flaeche(objs):
    """BVH aus Körper und Kuppe (Modell-Koordinaten), um Punkte auf die Oberfläche zu setzen."""
    vs, ps = [], []
    for o in objs:
        n0 = len(vs)
        vs += [v.co.copy() for v in o.data.vertices]
        ps += [[n0 + i for i in p.vertices] for p in o.data.polygons]
    return BVHTree.FromPolygons(vs, ps)


def auf_flaeche(bvh, z, quer):
    """Punkt auf der Vorderseite in Höhe z, seitlich um quer verschoben; (Punkt, Normale)."""
    start = Vector((0, 0, z)) + FRONT * 2.5 + SIDE * quer
    hit, nrm, _, _ = bvh.ray_cast(start, -FRONT)
    if hit is None:
        return Vector((0, 0, z)) + FRONT * 0.5 + SIDE * quer, FRONT.copy()
    return hit, nrm


def _kugel(SC, name, mat, loc, scale, parent, normal=None, seg=24):
    me = bpy.data.meshes.get(name) or bpy.data.meshes.new(name)
    if not me.vertices:
        import bmesh
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=1.0)
        bm.to_mesh(me)
        bm.free()
        for p in me.polygons:
            p.use_smooth = True
    me.materials.clear()
    me.materials.append(mat)
    o = _link(SC, bpy.data.objects.new(name, me), parent)
    rot = (normal or Vector((0, 0, 1))).to_track_quat('Z', 'Y').to_matrix().to_4x4()
    o.matrix_basis = Matrix.Translation(loc) @ rot @ Matrix.Diagonal((*scale, 1))
    return o


def _zylinder(SC, name, mat, p0, z1, r, parent, seg=20):
    """Senkrechter Zylinder in echter Größe (nicht skaliert: die Streifen kommen aus den Objekt-Koordinaten)."""
    import bmesh
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=z1 - p0.z)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, (z1 - p0.z) / 2))
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat)
    o = _link(SC, bpy.data.objects.new(name, me), parent)
    o.location = p0
    return o


def build(SC, pre, parent, augen=False, nase=False, beine=False, mund_offen=False):
    """Kostüm unter parent bauen (Modell-Einheiten). augen/nase: Laverne steckt drin; beine: Ringelbeine und Schuhe darunter
    (dann steht der Saum bei z = HEM über dem Boden). Gibt dict mit den Teilen zurück."""
    src = bpy.data.scenes['Tentakel3D_v2']
    STOFF = sternenbanner()
    LIPPE, NAPF = farbe('K_Lippe', '#162a6a', 'TentLippe'), farbe('K_Napf', '#f6f2ea', 'TentNapf')
    MUND = bpy.data.materials.get('TentMund')
    LOCH, NAHT = farbe('K_Loch', '#0e0a18'), farbe('K_Naht', '#f6e8b0')
    hem = HEM if beine else 0.0
    K = bpy.data.objects.new(pre + 'Kostuem', None)
    _link(SC, K, parent)
    K.location = (0, 0, hem)
    parts = {}
    for o in src.objects:
        if o.type != 'MESH' or not o.name.startswith('Tent') or 'Arm' in o.name:
            continue
        base = o.name[4:].split('.')[0]
        me = o.data.copy()
        me.name = pre + base
        me.transform(_world(o))   # Objekt-Koordinaten = Modell-Koordinaten (für die Streifen)
        c = _link(SC, bpy.data.objects.new(pre + base, me), K)
        mat = {'Koerper': STOFF, 'Kuppe': STOFF, 'Lippe': LIPPE, 'Oberlippe': LIPPE, 'Schlitz': MUND}.get(base)
        if mat is None:
            mat = NAPF if base.startswith('Napf') and 'Mitte' not in base else LIPPE
        c.data.materials.clear()
        c.data.materials.append(mat)
        parts[base] = c
    if mund_offen:   # wie tent_build: Lippe und Schlitz öffnen
        for n, sx, sy, sz in (('Lippe', 1, 1, 1.45), ('Schlitz', 1.6, 1.12, 3.4)):
            o = parts[n]
            ctr = sum((Vector(v.co) for v in o.data.vertices), Vector()) / len(o.data.vertices)
            o.data.transform(Matrix.Translation(ctr) @ Matrix.Diagonal((sx, sy, sz, 1)) @ Matrix.Translation(-ctr))
    bvh = _flaeche([parts['Koerper'], parts['Kuppe']])
    # Saum unten mit Nahtstichen
    stiche = []
    for i in range(36):
        a = 2 * math.pi * i / 36
        p = Vector((math.cos(a) * 0.615, math.sin(a) * 0.615, 0.08))
        stiche.append(_kugel(SC, f'{pre}Stich{i}', NAHT, p, (0.026, 0.05, 0.01), K, normal=Vector((math.cos(a), math.sin(a), 0))))
    # Augenlöcher (dunkle Ovale auf der Oberfläche)
    ZA, QA = 2.98, 0.2
    loecher, augen_o = [], []
    for k, q in enumerate((-QA, QA)):
        p, n = auf_flaeche(bvh, ZA, q)
        loecher.append(_kugel(SC, f'{pre}Loch{k}', LOCH, p + n * 0.005, (0.12, 0.16, 0.03), K, normal=n))
        if augen:   # Lavernes Augen: weiß, große Pupillen, schauen nach vorn rechts
            WEISSA, PUP = farbe('K_Augenweiss', '#ffffff'), farbe('K_Pupille', '#101018')
            augen_o.append(_kugel(SC, f'{pre}Auge{k}', WEISSA, p + n * 0.02, (0.1, 0.13, 0.06), K, normal=n))
            augen_o.append(_kugel(SC, f'{pre}Pupille{k}', PUP, p + n * 0.075 + Vector((0, 0, -0.01)), (0.045, 0.055, 0.03), K, normal=n))
    nase_o = None
    if nase:   # Lavernes lange Nase sticht durch ein drittes Loch
        p, n = auf_flaeche(bvh, ZA - 0.2, 0.0)
        HAUT = farbe('K_Haut', '#f2b48c')
        _kugel(SC, f'{pre}NasenLoch', LOCH, p + n * 0.004, (0.07, 0.07, 0.02), K, normal=n)
        nase_o = _kugel(SC, f'{pre}Nase', HAUT, p + n * 0.26, (0.065, 0.065, 0.3), K, normal=(n + Vector((0, 0, -0.2))).normalized())
        # ihre schwarzen Haarbüschel stechen oben durch die Kuppe
        HAAR = farbe('K_Haar', '#0c0a14')
        kup = parts['Kuppe']
        ztop = max(v.co.z for v in kup.data.vertices)
        tx = sum(v.co.x for v in kup.data.vertices if v.co.z > ztop - 0.05) / max(1, sum(1 for v in kup.data.vertices if v.co.z > ztop - 0.05))
        for i, (ax, ay, l) in enumerate(((-0.5, 0.2, 0.42), (0.35, -0.3, 0.36), (0.1, 0.55, 0.32), (0.6, 0.35, 0.3), (-0.2, -0.6, 0.34))):
            d = Vector((ax, ay, 1.0)).normalized()
            base = Vector((tx, 0, ztop - 0.08)) + Vector((ax, ay, 0)) * 0.12
            _kugel(SC, f'{pre}Haar{i}', HAAR, base + d * l * 0.5, (0.07, 0.07, l * 0.55), K, normal=d)
    beine_o = []
    if beine:   # Ringelbeine vom Boden bis unter den Saum, graue Schuhe nach vorn
        SOCKE, SCHUH = ringelsocken(), farbe('K_Schuh', '#4a4a5a')
        for k, q in enumerate((-0.2, 0.2)):
            fx = FRONT * 0.05 + SIDE * q
            beine_o.append(_zylinder(SC, f'{pre}Bein{k}', SOCKE, Vector((fx.x, fx.y, -HEM)), 0.25, 0.085, K))
            sp = Vector((fx.x, fx.y, -HEM + 0.07)) + FRONT * 0.1
            sh = _kugel(SC, f'{pre}Schuh{k}', SCHUH, sp, (1, 1, 1), K)
            sh.matrix_basis = Matrix.Translation(sp) @ FRONT.to_track_quat('X', 'Z').to_matrix().to_4x4() @ Matrix.Diagonal((0.24, 0.14, 0.09, 1))
            beine_o.append(sh)
    return {'root': K, 'parts': parts, 'stiche': stiche, 'loecher': loecher, 'augen': augen_o, 'nase': nase_o, 'beine': beine_o}


HEM = 0.8   # getragen: Saum 0,8 Modell-Einheiten über dem Boden (bei Maßstab 0,475 gut 38 cm Ringelbein)
