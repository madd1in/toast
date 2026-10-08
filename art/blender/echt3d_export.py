# Echtzeit-3D: Szenen als glTF (GLB) für three.js exportieren (in Blender ausführen, vorher REPO und WHAT setzen):
#   REPO = r'C:/.../Tentakel-Toast'; WHAT = ['hafen', 'hoagie']; exec(open(REPO + '/art/blender/echt3d_export.py').read())
# Exportiert über eine Hilfsszene mit Kopien, damit die Toon-Szenen unangetastet bleiben:
# - Modifier, Kurven und Schrift werden zu fertigen Meshes (im lokalen Raum, Hierarchie und Namen bleiben – das Spiel
#   bewegt Schiff, Schlangenkopf, Wolken, Wellen und die Gelenke der Figuren über ihre Knotennamen),
# - die Toon-Knotenbäume werden zu einfachen glTF-Materialien (Grundfarbe bzw. Bild; leuchtende Teile als Emission),
# - Box-projizierte Texturen (Steg, Putz, Dach, Fässer, Insel) bekommen UVs aus der Weltlage, wie im Toon-Material.
# Schreibt img/3d/<name>.glb.
import bpy, bmesh, math, os
from mathutils import Vector, Matrix

OUT = REPO + '/img/3d/'
os.makedirs(OUT, exist_ok=True)
GLOW = ('Lampe', 'Laterne', 'Neon', 'Fenster', 'Schlangenauge', 'Feuer', 'Glas')


def principled_of(m):
    return next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if m and m.use_nodes else None


def export_material(m, cache):
    """Einfaches glTF-Material mit derselben Farbe bzw. demselben Bild wie das Toon-Material."""
    if m is None:
        return None
    if m.name in cache:
        return cache[m.name]
    x = bpy.data.materials.new('X_' + m.name)
    x.use_nodes = True
    nt = x.node_tree
    p = principled_of(x)
    src = principled_of(m)
    col = (0.8, 0.8, 0.8, 1)
    img = None
    if m.use_nodes:
        mul = m.node_tree.nodes.get('ToonMul')
        if mul is not None and not mul.inputs[6].is_linked:
            col = tuple(mul.inputs[6].default_value)
        elif src is not None:
            col = tuple(src.inputs['Base Color'].default_value)
        tex = m.node_tree.nodes.get('Tex_Bild')
        if tex is not None and tex.image is not None:
            img = tex.image
    else:
        col = tuple(m.diffuse_color)
    p.inputs['Base Color'].default_value = col
    p.inputs['Roughness'].default_value = 1.0
    p.inputs['Metallic'].default_value = 0.0
    if img is not None:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = img
        nt.links.new(t.outputs['Color'], p.inputs['Base Color'])
    if any(g in m.name for g in GLOW):
        p.inputs['Emission Color'].default_value = col
        p.inputs['Emission Strength'].default_value = 0.6
    x['box'] = 0 if img is None or not m.node_tree.nodes.get('Tex_Geo') else 1
    if x['box']:
        mp = m.node_tree.nodes.get('Tex_Map')
        x['box_scale'] = mp.inputs['Scale'].default_value[0] if mp else 0.35
        x['box_rot'] = mp.inputs['Rotation'].default_value[2] if mp else 0.0
    cache[m.name] = x
    return x


def box_uvs(me, mw, mats):
    """UVs wie die Box-Projektion im Toon-Material: je Fläche die Hauptachse der Normalen, Koordinaten aus der Weltlage."""
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    nmat = mw.to_3x3().inverted().transposed()
    for f in bm.faces:
        x = mats[f.material_index] if f.material_index < len(mats) else None
        if not x or not x.get('box'):
            continue
        s, rot = x['box_scale'], x['box_rot']
        n = (nmat @ f.normal)
        ax = max(range(3), key=lambda i: abs(n[i]))
        a, b = [(1, 2), (0, 2), (0, 1)][ax]
        c, si = math.cos(rot), math.sin(rot)
        for lp in f.loops:
            w = mw @ lp.vert.co
            u, v = w[a] * s, w[b] * s
            lp[uv].uv = (u * c - v * si, u * si + v * c)
    bm.to_mesh(me)
    bm.free()


def lod_ratio(o, tris):
    """Detailstufe fürs Echtzeit-Bild: Hintergrund und Schiff stark vereinfachen, Nahes nur bei sehr vielen Dreiecken."""
    n = o.name
    if tris < 400:
        return 1.0
    if n.startswith(('Palme', 'Wolke', 'Welle', 'Berg', 'Insel')):
        return 0.3
    if n.startswith('S_'):
        return 0.45
    return 0.55 if tris > 1500 else 1.0


def evaluated_mesh(o, dg):
    """Mesh mit allen Modifiern; Kurven gröber, große Meshes per Decimate vereinfacht (Original bleibt unverändert)."""
    undo = None
    if o.type == 'CURVE':
        cd = o.data
        undo = ('curve', cd.resolution_u, cd.bevel_resolution)
        cd.resolution_u, cd.bevel_resolution = min(cd.resolution_u, 3), min(cd.bevel_resolution, 1)
    elif o.type == 'FONT':
        undo = ('font', o.data.resolution_u)
        o.data.resolution_u = min(o.data.resolution_u, 3)
    elif o.type == 'MESH' and globals().get('LOD', True):
        ev = o.evaluated_get(dg)
        tris = sum(len(p.vertices) - 2 for p in ev.data.polygons)
        r = lod_ratio(o, tris)
        if r < 1:
            md = o.modifiers.new('LOD_Export', 'DECIMATE')
            md.ratio = r
            undo = ('mod', md)
    if undo:
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
    try:
        return bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    finally:
        if undo:
            if undo[0] == 'curve':
                o.data.resolution_u, o.data.bevel_resolution = undo[1], undo[2]
            elif undo[0] == 'font':
                o.data.resolution_u = undo[1]
            else:
                o.modifiers.remove(undo[1])


def export(name, objs, cam=None):
    """objs: Objekte samt Hierarchie (Eltern vor Kindern egal); cam: optional Kamera-Objekt."""
    src_scene = objs[0].users_scene[0]
    T = bpy.data.scenes.new('Export3D_' + name)
    win = bpy.context.window
    prev = win.scene
    win.scene = src_scene
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    cache, made, mapping = {}, [], {}
    keep = set(objs)
    try:
        for o in objs:
            if o.type in ('MESH', 'CURVE', 'FONT', 'SURFACE', 'META'):
                if o.hide_render:
                    continue
                me = evaluated_mesh(o, dg)
                mats = [export_material(s.material, cache) for s in o.material_slots] or [None]
                me.materials.clear()
                for x in mats:
                    me.materials.append(x)
                if any(x and x.get('box') for x in mats):
                    box_uvs(me, o.matrix_world, mats)
                c = bpy.data.objects.new(o.name, me)
            elif o.type == 'EMPTY':
                c = bpy.data.objects.new(o.name, None)
            else:
                continue
            T.collection.objects.link(c)
            mapping[o] = c
            made.append(c)
        for o, c in mapping.items():
            par = o.parent
            while par is not None and par not in mapping:   # Eltern außerhalb der Auswahl: Weltlage übernehmen
                par = None
            if par is not None:
                c.parent = mapping[par]
                c.matrix_parent_inverse = o.matrix_parent_inverse.copy()
                c.matrix_basis = o.matrix_basis.copy()
            else:
                c.matrix_world = o.matrix_world.copy()
        if cam is not None:
            T.collection.objects.link(cam)
            T.camera = cam
        win.scene = T
        bpy.context.view_layer.update()
        path = OUT + name + '.glb'
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_active_scene=True, export_apply=False,
                                  export_image_format='JPEG', export_jpeg_quality=82, export_cameras=cam is not None, export_lights=False,
                                  export_extras=False, export_yup=True, export_animations=False, export_materials='EXPORT')
        print('glb', name, len(made), 'Objekte', os.path.getsize(path) // 1024, 'KB')
    finally:
        win.scene = prev
        if cam is not None and cam.name in T.collection.objects:
            T.collection.objects.unlink(cam)
        for c in made:
            me = c.data if c.type == 'MESH' else None
            bpy.data.objects.remove(c, do_unlink=True)
            if me is not None and me.users == 0:
                bpy.data.meshes.remove(me)
        for x in cache.values():
            bpy.data.materials.remove(x)
        bpy.data.scenes.remove(T)


def tree(o):
    out = [o]
    for c in o.children:
        out += tree(c)
    return out


WHAT = globals().get('WHAT') or ['hafen', 'hoagie', 'guybrush', 'jack']
for w in WHAT:
    if w == 'hafen':
        SC = bpy.data.scenes['Raum_hafen']
        objs = [o for o in SC.objects if not o.name.startswith(('Vogel_', 'V_')) and o.type != 'CAMERA' and o.type != 'LIGHT']
        export('hafen', objs, cam=SC.camera)
    elif w in ('hoagie', 'laverne', 'bernard'):
        root = bpy.data.objects[{'hoagie': 'HRig', 'laverne': 'LRig', 'bernard': 'BRig'}[w]]
        export(w, tree(root))
    else:   # Gäste: ganzes Modell der Gast-Szene in Grundhaltung
        SC = bpy.data.scenes['Gast3D_' + w]
        roots = [o for o in SC.objects if o.parent is None and o.type in ('EMPTY', 'MESH')]
        objs = [x for r in roots for x in tree(r)]
        export(w, objs)
