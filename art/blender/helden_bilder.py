# Titelbild-Figuren und HUD-Porträts der Helden neu rendern (in Blender, vorher REPO und optional WHO setzen):
#   REPO = r'C:/.../Tentakel-Toast'; WHO = ['hoagie', 'laverne']; exec(open(REPO + '/art/blender/helden_bilder.py').read())
# Rendert in der Szene Helden3D jede Figur einzeln: ganz (HeldCam, 400 × 560) und als Kopf-Porträt (256 × 256)
# mit geschlossenem und offenem Mund. Danach im Repo-Ordner:  python art/blender/helden_post.py
import bpy, math, os, sys
from mathutils import Vector
sys.path.insert(0, REPO + '/art/blender')

WHO = globals().get('WHO') or ['bernard', 'hoagie', 'laverne']
OUT = REPO + '/art/render/helden/'
os.makedirs(OUT, exist_ok=True)
SC = bpy.data.scenes['Helden3D']
ROOTS = {'bernard': 'Bernard', 'hoagie': 'Hoagie', 'laverne': 'Laverne'}
# Porträt: Bildmitte (Höhe im Figurenraum), Bildausschnitt in Metern, Mund-Objekt
PORTRAIT = {'bernard': (1.72, 0.66, 'B_Mund', 0.04), 'hoagie': (1.49, 0.6, 'H_Mund', 0.075), 'laverne': (1.63, 0.62, 'L_Mund', 0.035)}   # + Versatz nach vorn


def tree(o):
    out = [o]
    for c in o.children:
        out += tree(c)
    return out


win = bpy.context.window
prev = win.scene
win.scene = SC
cam = SC.camera
keep_cam = (cam.location.copy(), cam.data.ortho_scale, SC.render.resolution_x, SC.render.resolution_y)
state = {o.name: o.hide_render for r in ROOTS.values() for o in tree(bpy.data.objects[r])}
red = bpy.data.materials.get('MundOffen')
if red is None:
    import figur_lib
    red = figur_lib.toon('MundOffen', '#7a1426', hi=0.4)
try:
    for who in WHO:
        for n, r in ROOTS.items():
            for o in tree(bpy.data.objects[r]):
                o.hide_render = (n != who) or state[o.name]
        cam.location, cam.data.ortho_scale = keep_cam[0], keep_cam[1]
        SC.render.resolution_x, SC.render.resolution_y = keep_cam[2], keep_cam[3]
        SC.render.filepath = OUT + f'held_{who}.png'
        bpy.ops.render.render(write_still=True, scene=SC.name)
        zc, size, mouth, dx = PORTRAIT[who]
        tilt = abs(keep_cam[0].y) * math.tan(math.pi / 2 - cam.rotation_euler.x)   # die Kamera blickt leicht nach unten
        cam.location = Vector((keep_cam[0].x + dx, keep_cam[0].y, zc + tilt))
        cam.data.ortho_scale = size
        SC.render.resolution_x = SC.render.resolution_y = 256
        mo = bpy.data.objects[mouth]
        for k in (0, 1):
            keep_m = (mo.scale.copy(), mo.active_material, mo.location.copy())
            if k:   # offener Mund: rund, dunkelrot und ein Stück unter der Nase hervor
                mo.scale = (mo.scale.x * 1.6, mo.scale.y * 0.9, max(mo.scale.z * 4.5, mo.scale.y * 0.9))
                mo.location.z -= mo.scale.z * 0.35
                mo.location.x += 0.03   # vor Kinn und Bart
                mo.active_material = red
            SC.render.filepath = OUT + f'portrait_{who}_{k}.png'
            bpy.ops.render.render(write_still=True, scene=SC.name)
            mo.scale, mo.active_material, mo.location = keep_m
finally:
    for r in ROOTS.values():
        for o in tree(bpy.data.objects[r]):
            o.hide_render = state[o.name]
    cam.location, cam.data.ortho_scale = keep_cam[0], keep_cam[1]
    SC.render.resolution_x, SC.render.resolution_y = keep_cam[2], keep_cam[3]
    win.scene = prev
print('helden', WHO, sorted(os.listdir(OUT)))
