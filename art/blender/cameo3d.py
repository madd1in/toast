# Zwei Verbeugungen vor der Gruselvilla in 3D (in Blender ausführen, vorher REPO und optional WHO = ['ted'] setzen):
#   REPO = r'C:/.../Tentakel-Toast'; exec(open(REPO + '/art/blender/cameo3d.py').read())
# - Cousin Ted: Mumie im aufrecht stehenden, bemalten Sarkophag (Deckel offen), Binden in Wickellagen, ein loses Ende;
#   Bilder: idle, auge (ein Auge glimmt), wink (Arm hebt sich zum Gruß).
# - Die fleischfressende Riesenpflanze: Terrakotta-Topf, dicker gebogener Stiel, Blätter, ein Kopf mit zwei Kiefern,
#   innen rot, weiße Zähne, Zunge; Bilder: zu, auf, schnapp (nach vorn gestoßen).
# Szene je Figur wie bei den Gästen (RigCam, 240 px pro Meter). Schreibt art/render/<name>/*.png und meta.json;
# danach im Repo-Ordner:  python art/blender/cameo_post.py
import bpy, json, math, os, sys, importlib
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
sys.path.insert(0, REPO + '/art/blender')
import figur_lib
importlib.reload(figur_lib)
from figur_lib import Builder, toon


def scene(name):
    SC = bpy.data.scenes.get('Cameo3D_' + name) or bpy.data.scenes.new('Cameo3D_' + name)
    keep = ('MondH3', 'FuellH3', 'RigCam')
    for o in list(SC.collection.objects):
        if o.name in keep:
            SC.collection.objects.unlink(o)
        else:
            bpy.data.objects.remove(o, do_unlink=True)
    for n in keep:
        SC.collection.objects.link(bpy.data.objects[n])
    hel = bpy.data.scenes['Helden3D']
    SC.camera, SC.world = bpy.data.objects['RigCam'], hel.world
    r = SC.render
    r.engine = hel.render.engine
    r.resolution_x, r.resolution_y, r.resolution_percentage = 960, 840, 100
    r.film_transparent = True
    r.image_settings.file_format, r.image_settings.color_mode = 'PNG', 'RGBA'
    SC.view_settings.view_transform, SC.view_settings.look = hel.view_settings.view_transform, hel.view_settings.look
    SC.eevee.taa_render_samples = 32
    SC.camera.data.sensor_fit = 'VERTICAL'
    return SC


def build_ted(SC, B, R):
    WOOD, GOLD, TEAL, DARK = toon('C_Sarg', '#b8862e', hi=0.15), toon('C_SargGold', '#e8c048', hi=0.35), toon('C_SargTuerkis', '#2a9a9a', hi=0.1), toon('C_SargInnen', '#2a1a24', hi=0.0)
    LIN, LIND, EYE = toon('C_Binde', '#e8dcc0', hi=0.05), toon('C_BindeDunkel', '#c8b894', hi=0.0), toon('C_TedAuge', '#ffe066', hi=0.9)
    e = EYE.node_tree.nodes.get('ToonEmi')
    if e:
        e.inputs['Strength'].default_value = 2.0
    # Sarkophag: aufrecht, vorn offen (Mantel nur hinten und an den Seiten), innen dunkel, goldene Kanten; Deckel daneben
    B.cone('C_SargKasten', 0.0, 1.55, 0.36, 0.42, WOOD, R, scale=(0.55, 1.0, 1.0), seg=40, bevel=0.0, cut=(0.9, 2 * math.pi - 0.9), solid=0.03)
    B.sphere('C_SargKopf', (-0.1, 0, 1.55), (0.14, 0.42, 0.42), WOOD, R)
    B.cone('C_SargInnen', 0.04, 1.6, 0.32, 0.38, DARK, R, xy=(-0.13, 0), scale=(0.12, 1.0, 1.0), seg=32, bevel=0.0)
    for k, sg in (('L', 1), ('R', -1)):
        B.rod(f'C_SargKante{k}', (0.12, sg * 0.29, 0.0), (0.14, sg * 0.34, 1.5), 0.03, GOLD, R, seg=10)
        for i, z in enumerate((0.35, 0.8, 1.25)):
            B.sphere(f'C_SargZier{k}{i}', (0.13, sg * (0.3 + z * 0.025), z), (0.03, 0.05, 0.08), TEAL, R)
    D = B.empty('C_Deckel'); D.parent = R; D.location = (-0.05, 0.56, 0); D.rotation_euler = (0, 0, 0.6)   # lehnt seitlich hinten
    B.cone('C_DeckelBrett', 0.0, 1.55, 0.36, 0.42, WOOD, D, xy=(-0.05, 0.42), scale=(0.18, 1.0, 1.0), seg=32, bevel=0.02)
    B.sphere('C_DeckelGesicht', (0.02, 0.42, 1.62), (0.05, 0.16, 0.2), GOLD, D)
    for k, y in (('L', 0.36), ('R', 0.48)):
        B.sphere(f'C_DeckelAuge{k}', (0.06, y, 1.66), (0.02, 0.03, 0.018), TEAL, D)
    # Ted: gewickelte Mumie (Lagen aus flachen Ringen), Kopf mit Augenschlitz, ein Arm vor der Brust, ein loses Bindenende
    M = B.empty('C_Ted'); M.parent = R; M.location = (0.1, 0, 0.08)
    for i in range(16):
        z = 0.06 + i * 0.085
        rr = 0.17 + 0.03 * math.sin(i / 15 * math.pi) - (0.03 if i < 3 else 0)
        B.torus(f'C_Lage{i}', (0, 0, z), rr, 0.045, LIN if i % 2 else LIND, M, scale=(0.75, 1.0, 1.0), rot=(0.08 * (1 if i % 2 else -1), 0, 0), seg=28, sseg=8)
    B.cone('C_TedRumpf', 0.02, 1.38, 0.15, 0.17, LIN, M, scale=(0.75, 1.0, 1.0), seg=24, bevel=0.0)
    B.sphere('C_TedKopf', (0.0, 0, 1.52), (0.13, 0.13, 0.16), LIN, M)
    for i, z in enumerate((1.44, 1.52, 1.6)):
        B.torus(f'C_KopfLage{i}', (0, 0, z), 0.12, 0.03, LIND, M, rot=(0.15 * (i - 1), 0.1, 0), seg=24, sseg=6)
    B.sphere('C_Augenschlitz', (0.12, 0, 1.55), (0.02, 0.09, 0.015), DARK, M)
    B.sphere('C_TedAugeAuf', (0.125, -0.04, 1.55), (0.012, 0.022, 0.016), EYE, M)
    # Arme: der linke vor der Brust verschränkt, der rechte kann winken (Gelenk an der Schulter)
    B.rod('C_ArmL', (0.05, 0.16, 1.25), (0.15, -0.05, 1.05), 0.055, LIN, M, seg=12)
    S = B.empty('C_SchulterR'); S.parent = M; S.location = (0.02, -0.18, 1.28)
    B.rod('C_ArmR', (0, 0, 0), (0.12, 0.02, -0.38), 0.055, LIN, S, seg=12)
    B.sphere('C_HandR', (0.13, 0.02, -0.42), (0.06, 0.05, 0.06), LIND, S)
    B.rod('C_LoseBinde0', (0.1, -0.14, 0.95), (0.22, -0.2, 0.78), 0.02, LIN, M, seg=8)
    B.rod('C_LoseBinde1', (0.22, -0.2, 0.78), (0.24, -0.16, 0.6), 0.018, LIN, M, seg=8)
    return dict(frames=[('idle', {}), ('auge', {'auge': 1}), ('wink', {'wink': 1, 'auge': 1})], top=1.9)


def pose_ted(p):
    OB = bpy.data.objects
    for o in OB['C_Deckel'].children:   # im Labor steht rechts das Chrono-Klo: der Deckel bleibt weg
        o.hide_render = True
    OB['C_TedAugeAuf'].hide_render = not p.get('auge')
    OB['C_SchulterR'].rotation_euler = (-2.3, 0.4, 0) if p.get('wink') else (0, 0, 0)


def build_pflanze(SC, B, R):
    POT, POTD, SOIL = toon('C_Topf', '#c8643a', hi=0.1), toon('C_TopfRand', '#a84a2a', hi=0.1), toon('C_Erde', '#4a3020', hi=0.0)
    STEM, LEAF, LEAFD = toon('C_Stiel', '#3a8a3a', hi=0.08), toon('C_Blatt', '#4aa84a', hi=0.08), toon('C_BlattDunkel', '#2f7a34', hi=0.05)
    JAW, INNER, TEETH, TONGUE = toon('C_Kiefer', '#5ab84a', hi=0.12), toon('C_Rachen', '#c8243a', hi=0.25), toon('C_Zahn', '#f8f4e8', hi=0.3), toon('C_Zunge', '#e85a7a', hi=0.3)
    SPOT = toon('C_Tupfen', '#a8d84a', hi=0.05)
    B.cone('C_Topf', 0.0, 0.62, 0.36, 0.48, POT, R, seg=40, bevel=0.03)
    B.torus('C_TopfRand', (0, 0, 0.62), 0.5, 0.06, POTD, R, seg=40, sseg=8)
    B.cone('C_Erde', 0.56, 0.6, 0.45, 0.45, SOIL, R, seg=40, bevel=0.0)
    for i in range(6):   # große, gezackte Blätter am Fuß
        a = i * math.pi / 3 + 0.3
        L = B.empty(f'C_BlattRoot{i}'); L.parent = R; L.location = (math.cos(a) * 0.2, math.sin(a) * 0.2, 0.6); L.rotation_euler = (0, 0.95, a)
        B.sphere(f'C_Blatt{i}', (0.0, 0, 0.32), (0.07, 0.17, 0.36), LEAF if i % 2 else LEAFD, L)
    K = B.empty('C_Kopf'); K.parent = R
    # dicker Stiel in S-Form bis zum Kopf
    B.rod('C_Stiel0', (0, 0, 0.58), (0.06, 0, 1.15), 0.11, STEM, R, r1=0.1, seg=20)
    B.rod('C_Stiel1', (0.06, 0, 1.15), (0.0, 0, 1.6), 0.1, STEM, R, r1=0.09, seg=20)
    B.sphere('C_StielKnie', (0.06, 0, 1.15), (0.105, 0.105, 0.105), STEM, R)
    K.location = (0.0, 0, 1.62)
    # Kiefer: Unter- und Oberkiefer als Halbschalen, innen rot, Zahnreihen, Zunge; Gelenk hinten am Kopf
    O = B.empty('C_Oberkiefer'); O.parent = K; O.location = (-0.12, 0, 0.1)
    U = B.empty('C_Unterkiefer'); U.parent = K; U.location = (-0.12, 0, 0.0)
    B.sphere('C_Gelenk', (-0.1, 0, 0.05), (0.16, 0.2, 0.17), JAW, K)   # Kiefergelenk hinten: hält beide Hälften zusammen
    B.sphere('C_KieferOben', (0.3, 0, 0.06), (0.36, 0.3, 0.2), JAW, O)
    B.sphere('C_RachenOben', (0.32, 0, 0.0), (0.32, 0.25, 0.07), INNER, O)
    B.sphere('C_KieferUnten', (0.28, 0, -0.08), (0.33, 0.28, 0.17), JAW, U)
    B.sphere('C_RachenUnten', (0.3, 0, 0.0), (0.29, 0.23, 0.06), INNER, U)
    B.sphere('C_Zunge', (0.3, 0, 0.03), (0.18, 0.1, 0.04), TONGUE, U)
    for i in range(7):   # Zähne entlang der Kieferränder
        a = -1.25 + i * 2.5 / 6
        x, y = 0.3 + math.cos(a) * 0.3, math.sin(a) * 0.25
        B.cone(f'C_ZahnO{i}', -0.07, 0.0, 0.0, 0.03, TEETH, O, xy=(x, y), seg=10, bevel=0.0)
        B.cone(f'C_ZahnU{i}', 0.0, 0.07, 0.03, 0.0, TEETH, U, xy=(x - 0.02, y * 0.95), seg=10, bevel=0.0)
    for i, (x, y, z) in enumerate(((0.25, 0.2, 0.18), (0.45, -0.15, 0.16), (0.12, -0.22, 0.12), (0.4, 0.18, 0.1))):
        B.sphere(f'C_Tupfen{i}', (x, y, z), (0.04, 0.04, 0.02), SPOT, O)
    return dict(frames=[('zu', {}), ('auf', {'auf': 1}), ('schnapp', {'schnapp': 1})], top=2.1)


def pose_pflanze(p):
    OB = bpy.data.objects
    a = 0.42 if p.get('auf') else 0.0
    OB['C_Oberkiefer'].rotation_euler = (0, -a, 0)
    OB['C_Unterkiefer'].rotation_euler = (0, a * 0.6, 0)
    OB['C_Kopf'].location = (0.08, 0, 1.6) if p.get('schnapp') else (0.0, 0, 1.62)
    OB['C_Kopf'].rotation_euler = (0, 0.35, 0) if p.get('schnapp') else (0, 0, 0)


WHAT = {'ted': (build_ted, pose_ted, -1.25), 'pflanze': (build_pflanze, pose_pflanze, -0.45)}   # Ted: offene Seite zur Kamera
for name in globals().get('WHO') or list(WHAT):
    build, pose, yaw = WHAT[name]
    SC = scene(name)
    B = Builder(SC)
    R = B.empty('C_Root_' + name)
    R.rotation_euler = (0, 0, yaw)
    info = build(SC, B, R)
    win = bpy.context.window
    prev = win.scene
    win.scene = SC
    cam = SC.camera
    W, H = SC.render.resolution_x, SC.render.resolution_y
    out = REPO + f'/art/render/{name}/'
    os.makedirs(out, exist_ok=True)
    meta = {'ppm': H / cam.data.ortho_scale, 'top': info['top'], 'frames': []}
    try:
        for fn, p in info['frames']:
            pose(p)
            bpy.context.view_layer.update()
            q = world_to_camera_view(SC, cam, R.matrix_world.translation)
            meta['frames'].append({'name': fn, 'foot': [round(q.x * W, 1), round((1 - q.y) * H, 1)]})
            SC.render.filepath = out + fn + '.png'
            bpy.ops.render.render(write_still=True, scene=SC.name)
        pose({})
    finally:
        win.scene = prev
    json.dump(meta, open(out + 'meta.json', 'w'), indent=1)
    print('cameo', name, [f['name'] for f in meta['frames']])
