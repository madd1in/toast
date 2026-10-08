# Hoagies Bilder fürs Beleidigungsfechten (in Blender ausführen, vorher REPO setzen):
#   REPO = r'C:/.../Tentakel-Toast'; exec(open(REPO + '/art/blender/fecht_hoagie.py').read())
# Setzt pinke Poolnudel und Super-Spritzer (nudeln.py) an den rechten Unterarm der Hoagie-Rig-Kopie, rendert nur
# nudel0, nudel1 und spritz über figur_frames.py (Bild breiter, gleicher Maßstab) und räumt die Requisiten wieder weg.
# Danach im Repo-Ordner:  python art/blender/figur_post.py hoagie  und  python art/blender/figur_js.py
import bpy, sys, importlib
sys.path.insert(0, REPO + '/art/blender')
NAME, BUILD = 'hoagie', False
exec(open(REPO + '/art/blender/figur_rig.py', encoding='utf-8').read())   # liefert nur CHARS
import nudeln
importlib.reload(nudeln)

_SC = bpy.data.scenes[CHARS['hoagie']['scene']]
_el, _hand = bpy.data.objects['HR_EllbogenR'], bpy.data.objects['RH_HandR']
_nudel = nudeln.nudel(_SC, 'HR_Nudel', _el, tuple(_hand.location), color='#ff5aa8')
_spritz = nudeln.tree(nudeln.spritzer(_SC, 'HR_Spritzer', _el, tuple(_hand.location)))


def FRAME_HOOK(nm):
    _nudel.hide_render = nm not in ('nudel0', 'nudel1')
    for o in _spritz:
        o.hide_render = nm != 'spritz'


_res = _SC.render.resolution_x
_SC.render.resolution_x = 960
_SC.camera.data.sensor_fit = 'VERTICAL'   # 3,5 m Bildhöhe bleiben: 240 px pro Meter wie die übrigen Bilder
FECHT, ONLY = True, ['nudel0', 'nudel1', 'spritz']
try:
    exec(open(REPO + '/art/blender/figur_frames.py', encoding='utf-8').read())
finally:
    _SC.render.resolution_x = _res
    for o in reversed([_nudel] + _spritz):
        bpy.data.objects.remove(o, do_unlink=True)
