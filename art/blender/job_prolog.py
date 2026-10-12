# Hintergrund-Job (ohne Blender-Oberfläche):
#   OHNE_RENDER=1 blender -b art/logo.blend --python art/blender/job_prolog.py
# Baut die Prolog-Szene neu (mit dem Spukhaus) und exportiert sie fürs Echtzeit-3D (img/3d/prolog.glb).
import bpy
REPO = r'C:/Users/User/Documents/Tentakel-Toast'
exec(open(REPO + '/art/blender/prolog_build.py', encoding='utf-8').read(), {'REPO': REPO, '__name__': 'prolog'})
exec(open(REPO + '/art/blender/echt3d_export.py', encoding='utf-8').read(), {'REPO': REPO, 'WHAT': ['prolog'], '__name__': 'exp'})
bpy.ops.wm.save_mainfile()
print('JOB FERTIG')
