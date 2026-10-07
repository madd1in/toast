# Hilfsfunktionen für die NPC-Figuren (Toon-Material wie bei den Helden, Grundkörper per bmesh)
import bpy, bmesh, math
from mathutils import Vector


def srgb2lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexlin(h):
    h = h.lstrip('#')
    return tuple(srgb2lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))


def toon(name, hexcol, hi=None):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials['HautB'].copy()
        m.name = name
    col = (*hexlin(hexcol), 1)
    nt = m.node_tree
    nt.nodes['ToonMul'].inputs[6].default_value = col
    p = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = col
    if hi is not None:
        nt.nodes['ToonHi'].color_ramp.elements[1].color = (hi, hi, hi, 1)
    m.diffuse_color = col
    return m


class Builder:
    def __init__(self, scene):
        self.sc = scene

    def obj(self, name, bm, mat, parent, loc, rot=(0, 0, 0), scale=(1, 1, 1), smooth=True, bevel=0.0, solid=0.0):
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        for p in me.polygons:
            p.use_smooth = smooth
        me.materials.append(mat)
        o = bpy.data.objects.new(name, me)
        self.sc.collection.objects.link(o)
        o.parent = parent
        o.location = loc
        o.rotation_euler = rot
        o.scale = scale
        if solid:
            md = o.modifiers.new('Dicke', 'SOLIDIFY')
            md.thickness = solid
            md.offset = 0
        if bevel:
            md = o.modifiers.new('Fase', 'BEVEL')
            md.width = bevel
            md.segments = 3
            md.limit_method = 'ANGLE'
        return o

    def empty(self, name, loc=(0, 0, 0)):
        o = bpy.data.objects.new(name, None)
        self.sc.collection.objects.link(o)
        o.location = loc
        return o

    def sphere(self, name, loc, scale, mat, parent, rot=(0, 0, 0)):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=1.0)
        return self.obj(name, bm, mat, parent, loc, rot, scale)

    def cone(self, name, z0, z1, r0, r1, mat, parent, xy=(0, 0), scale=(1, 1, 1), seg=32, bevel=0.015, cut=None, solid=0.0, rot=(0, 0, 0)):
        """Kegelstumpf von z0 (Radius r0) bis z1 (Radius r1); cut=(a0, a1) lässt nur den Winkelbereich stehen (offener Mantel)."""
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=cut is None, cap_tris=False, segments=seg, radius1=r0, radius2=r1, depth=z1 - z0)
        if cut:
            a0, a1 = cut
            dead = [f for f in bm.faces if not (a0 <= math.atan2(f.calc_center_median().y, f.calc_center_median().x) <= a1)]
            bmesh.ops.delete(bm, geom=dead, context='FACES')
        return self.obj(name, bm, mat, parent, (xy[0], xy[1], (z0 + z1) / 2), rot, scale, bevel=bevel, solid=solid)

    def rod(self, name, p0, p1, r, mat, parent, r1=None, seg=16, bevel=0.0):
        """Zylinder (oder Kegel mit r1) zwischen zwei Punkten."""
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r if r1 is None else r1, depth=d.length)
        rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
        return self.obj(name, bm, mat, parent, (p0 + p1) / 2, rot, bevel=bevel)

    def torus(self, name, loc, R, r, mat, parent, rot=(0, 0, 0), scale=(1, 1, 1), seg=40, sseg=12):
        bm = bmesh.new()
        rings = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            ring = []
            for j in range(sseg):
                b = 2 * math.pi * j / sseg
                ring.append(bm.verts.new(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b))))
            rings.append(ring)
        for i in range(seg):
            for j in range(sseg):
                bm.faces.new((rings[i][j], rings[(i + 1) % seg][j], rings[(i + 1) % seg][(j + 1) % sseg], rings[i][(j + 1) % sseg]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        return self.obj(name, bm, mat, parent, loc, rot, scale)


def tree(root):
    out = [root]
    for c in root.children:
        out += tree(c)
    return out


def solo(scene, root):
    """Nur diese Figur rendern."""
    for o in scene.objects:
        if o.type in ('MESH', 'CURVE', 'EMPTY', 'FONT'):
            o.hide_render = True
    for o in tree(root):
        o.hide_render = False
