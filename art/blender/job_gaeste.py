# Hintergrund-Job: Gäste und Tentakel als Echtzeit-3D-Modelle exportieren (img/3d/<name>.glb), ohne die .blend zu ändern
#   blender -b art/logo.blend --python art/blender/job_gaeste.py
import bpy
REPO = r'C:/Users/User/Documents/Tentakel-Toast'
for n in ('Rig3D_T_green', 'Rig3D_T_guard', 'Rig3D_T_lila'):   # zur Kontrolle: was steckt in den Tentakel-Szenen
    sc = bpy.data.scenes.get(n)
    print(n, sc and [(o.name, o.type, o.parent.name if o.parent else None) for o in sc.objects][:12])
import os
WHAT = os.environ.get('NUR', 'dave salad affe bender prof zoid glados simon bobbin zak gertrude hancock green guard purple').split()
for w in WHAT:
    try:
        exec(open(REPO + '/art/blender/echt3d_export.py', encoding='utf-8').read(), {'REPO': REPO, 'WHAT': [w], '__name__': 'exp'})
    except Exception as e:
        print('FEHLER', w, e)
print('GAESTE FERTIG')
