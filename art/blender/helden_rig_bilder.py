# Titelbild-Figuren und HUD-Porträts aus den umgestalteten Rigs (bernard_schick.py, hoagie_schick.py) rendern
# (in Blender, vorher REPO und optional WHO setzen):
#   REPO = r'C:/.../Tentakel-Toast'; WHO = ['bernard', 'hoagie']; exec(open(REPO + '/art/blender/helden_rig_bilder.py').read())
# Ganzfigur = das Ruhebild aus figur_frames.py (art/render/<name>/idle.png), Porträt = Kopf mit geschlossenem und
# offenem Mund über die RigCam. Schreibt nach art/render/helden/ – danach im Repo-Ordner:  python art/blender/helden_post.py
import bpy, math, os, shutil

WHO = globals().get('WHO') or ['bernard', 'hoagie']
OUT = REPO + '/art/render/helden/'
os.makedirs(OUT, exist_ok=True)
# Szene, Kopfmitte (m), Bildausschnitt (m), Mund, Wurzel (fürs Porträt fast frontal zur Kamera gedreht)
CFG = {'bernard': ('Rig3D', 2.02, 0.86, 'RB_Mund', 'BRig'), 'hoagie': ('Rig3D_Hoagie', 1.5, 0.78, 'RH_Mund', 'HRig'), 'laverne': ('Rig3D_Laverne', 1.66, 0.72, 'RL_Mund', 'LRig')}
win = bpy.context.window
prev = win.scene
for name in WHO:
    sn, kz, sc_m, mund, wurzel = CFG[name]
    rig = bpy.data.objects[wurzel]
    yaw0 = rig.rotation_euler[2]
    SC = bpy.data.scenes[sn]
    win.scene = SC
    cam = SC.camera
    alt = (cam.location.copy(), cam.data.ortho_scale, SC.render.resolution_x, SC.render.resolution_y, SC.render.filepath)
    m = bpy.data.objects[mund]
    ms = m.scale.copy()
    try:
        rig.rotation_euler[2] = -1.32
        neig = math.pi / 2 - cam.rotation_euler[0]   # die RigCam blickt leicht von oben: Bildmitte liegt tiefer als die Kamera
        cam.location = (alt[0].x, alt[0].y, kz + abs(alt[0].y) * math.tan(neig))
        cam.data.ortho_scale = sc_m
        SC.render.resolution_x = SC.render.resolution_y = 256
        for k, f in ((0, 1.0), (1, 3.4)):   # Mund zu, Mund auf
            m.scale = (ms.x * (1 + 0.25 * k), ms.y, ms.z * f)
            SC.render.filepath = OUT + f'portrait_{name}_{k}.png'
            bpy.ops.render.render(write_still=True, scene=SC.name)
    finally:
        m.scale = ms
        rig.rotation_euler[2] = yaw0
        cam.location, cam.data.ortho_scale, SC.render.resolution_x, SC.render.resolution_y, SC.render.filepath = alt
    idle = REPO + f'/art/render/{name}/idle.png'
    if os.path.exists(idle):
        shutil.copyfile(idle, OUT + f'held_{name}.png')
win.scene = prev
print('Heldenbilder aus den Rigs:', WHO)
