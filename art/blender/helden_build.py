# Baut Hoagie- und Laverne-Rigs (Empty-Gelenke wie Bernard), posiert 21 Frames und rendert sie.
# Kopf/Körper-Meshes kommen aus der Szene Helden3D (als Kopien), Beine/Arme als frische Kegelstümpfe.
# Aufruf: blender --background art/logo.blend --python art/blender/helden_build.py
import bpy, math, json, sys, importlib
REPO = r'C:/Users/User/Documents/Tentakel-Toast'
sys.path.insert(0, REPO + '/art/blender')
import figur_lib
importlib.reload(figur_lib)
from figur_lib import toon, Builder

SRC = bpy.data.scenes['Helden3D']
SC = bpy.data.scenes.get('HeldenRig2') or bpy.data.scenes.new('HeldenRig2')
for o in list(SC.collection.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for n in ('MondH3', 'FuellH3'):
    SC.collection.objects.link(bpy.data.objects[n])
# eigene Kamera: nah genug für scharfe Pixel, aber flach genug für den Toon-Look (85 mm)
camd = bpy.data.cameras.get('HeldCam2') or bpy.data.cameras.new('HeldCam2')
camd.lens = 85
cam = bpy.data.objects.get('HeldCam2') or bpy.data.objects.new('HeldCam2', camd)
if cam.name not in SC.collection.objects:
    SC.collection.objects.link(cam)
cam.location = (0, -6.5, 0.95)
cam.rotation_euler = (1.496, 0, 0)
SC.camera = cam
SC.world = SRC.world
r, s = SC.render, SRC.render
r.engine = s.engine
r.resolution_x, r.resolution_y, r.resolution_percentage = 420, 760, 100
r.film_transparent = True
r.image_settings.file_format = 'PNG'
r.image_settings.color_mode = 'RGBA'
SC.view_settings.view_transform = SRC.view_settings.view_transform
SC.view_settings.look = SRC.view_settings.look
SC.eevee.taa_render_samples = SRC.eevee.taa_render_samples

B = Builder(SC)
YAW = -0.559
bpy.context.window.scene = SC   # alles Weitere (Render, Depsgraph, view_layer) passiert in unserer Szene


def grab(name, parent, loc):
    """Mesh aus Helden3D als Kopie übernehmen und ans Rig hängen."""
    src = SRC.objects[name]
    o = src.copy()
    o.data = src.data.copy()
    SC.collection.objects.link(o)
    o.parent = parent
    o.location = loc
    o.rotation_euler = (0, 0, 0)
    return o


def rig(prefix, scale, tor, headz, hips, knees, ankles, shoulders, elbows):
    """Leeres Gelenk-Rig nach Bernard-Vorbild. Werte relativ zum jeweiligen Elter."""
    root = B.empty(prefix + 'ig')
    root.rotation_euler = (0, 0, YAW)
    root.scale = (scale, scale, scale)
    body = B.empty(prefix + '_Body', (0, 0, 0)); body.parent = root
    torso = B.empty(prefix + '_Torso', (0, 0, tor)); torso.parent = body
    head = B.empty(prefix + '_Head', (0, 0, headz - tor)); head.parent = torso
    js = {}
    for k in ('L', 'R'):
        hip = B.empty(f'{prefix}_Hip{k}', (0, hips[1] if k == 'L' else -hips[1], hips[0])); hip.parent = body
        knee = B.empty(f'{prefix}_Knie{k}', (0, 0, -knees)); knee.parent = hip
        ank = B.empty(f'{prefix}_Knoechel{k}', (0, 0, -ankles)); ank.parent = knee
        sh = B.empty(f'{prefix}_Schulter{k}', (0, shoulders[1] if k == 'L' else -shoulders[1], shoulders[0] - tor))
        sh.parent = torso
        el = B.empty(f'{prefix}_Ellbogen{k}', (0, 0, -elbows)); el.parent = sh
        sh.rotation_euler = (0.06 if k == 'L' else -0.06, 0.12 if k == 'L' else -0.12, 0)
        el.rotation_euler = (0, -0.12, 0)
        js[k] = (hip, knee, ank, sh, el)
    return root, body, torso, head, js


def anchors(head, mundrel, puprel, elbowR, handrel):
    m = B.empty('AnkMund', mundrel); m.parent = head
    p1 = B.empty('AnkPupL', puprel[0]); p1.parent = head
    p2 = B.empty('AnkPupR', puprel[1]); p2.parent = head
    h = B.empty('AnkHand', handrel); h.parent = elbowR
    return m, p1, p2, h


# ------------------------------------------------------------------ Hoagie
SKIN_H = toon('HR_Haut', '#e9b088')
JEANS = toon('HR_Jeans', '#3d5fa6')
JEANS_B = toon('HR_JeansD', '#34518e')
BOOT = toon('HR_Boot', '#3a2416')


def build_hoagie():
    # Proportionen: Hüfte 0.60, Knie 0.60-0.30, Knöchel 0.30-0.10, Kopf-Mitte 1.47, Schulter 1.16
    root, body, torso, head, J = rig('HR', 0.936, 0.60, 1.47, (0.60, 0.12), 0.30, 0.20, (1.16, 0.33), 0.17)
    grab('H_Bauch', torso, (0.04, 0, 0.38))
    grab('H_Haare', torso, (-0.10, 0, 0.73))
    for nm in ('H_Kopf', 'H_Kappe', 'H_Schirm', 'H_Nase', 'H_Mund', 'H_AugeL', 'H_AugeR', 'H_PupilleL', 'H_PupilleR'):
        src = SRC.objects[nm]
        o = grab(nm, head, (src.location.x - 0.08, src.location.y, src.location.z - 1.47))
    for k, sg in (('L', 1), ('R', -1)):
        hip, knee, ank, sh, el = J[k]
        B.rod(f'HR_Ober{k}', (0, 0, 0), (0, 0, -0.30), 0.112, JEANS if k == 'L' else JEANS_B, hip, r1=0.104)
        B.rod(f'HR_Unter{k}', (0, 0, 0), (0, 0, -0.20), 0.100, JEANS if k == 'L' else JEANS_B, knee, r1=0.09)
        grab(f'H_Stiefel{k}', ank, (0.06, 0, -0.01))
        grab(f'H_Aermel{k}', sh, (0.0, sg * 0.03, 0.04))
        B.rod(f'HR_ArmO{k}', (0, 0, 0), (0, 0, -0.17), 0.062, SKIN_H, sh, r1=0.056)
        B.rod(f'HR_ArmU{k}', (0, 0, 0), (0, 0, -0.16), 0.056, SKIN_H, el, r1=0.05)
        grab(f'H_Hand{k}', el, (0.0, sg * 0.004, -0.20))
    m, p1, p2, h = anchors(head, (0.19, 0, -0.115), [(0.185, 0.07, 0.045), (0.185, -0.075, 0.045)], J['R'][4], (0.14, 0, -0.2))
    return root, torso, head, J, (m, p1, p2, h)


# ------------------------------------------------------------------ Laverne
SKIN_L = toon('LR_Haut', '#f7e0cd')
STOCK = toon('LR_Strumpf', '#f6f0f0')
STOCK_B = toon('LR_StrumpfB', '#e8e0e0')
RING = toon('LR_Ring', '#d8344a')
RING_B = toon('LR_RingB', '#b42a3a')
SHOE = toon('LR_Schuh', '#2a2430')


def build_laverne():
    # Tailse/Torso 1.22, Beine setzen unterm Rock bei 0.72 an, Kopf-Mitte 1.56, Schulter 1.125
    root, body, torso, head, J = rig('LR', 1.026, 1.22, 1.56, (0.72, 0.07), 0.33, 0.29, (1.125, 0.183), 0.14)
    for nm in ('L_Kleid', 'L_Kragen', 'L_Knopf0', 'L_Knopf1', 'L_Knopf2', 'L_Hals'):
        src = SRC.objects[nm]
        o = grab(nm, torso, (src.location.x, src.location.y, src.location.z - 1.22))
    for nm in ('L_Kopf', 'L_HaarKappe', 'L_Nase', 'L_Mund', 'L_AugeL', 'L_AugeR', 'L_PupilleL', 'L_PupilleR') + tuple(f'L_Stachel{i}' for i in range(12)):
        src = SRC.objects[nm]
        o = grab(nm, head, (src.location.x - 0.02, src.location.y, src.location.z - 1.56))
    for k, sg in (('L', 1), ('R', -1)):
        hip, knee, ank, sh, el = J[k]
        # Bein steckt im Rock: Oberschenkel ab Hüfte, sichtbar wird der Ringstrumpf ab Knie
        B.rod(f'LR_Ober{k}', (0, 0, 0), (0, 0, -0.33), 0.062, STOCK, hip, r1=0.055)
        un = B.rod(f'LR_Unter{k}', (0, 0, 0), (0, 0, -0.29), 0.052, STOCK if k == 'L' else STOCK_B, knee, r1=0.046)
        for i, zz in enumerate((-0.05, -0.15, -0.25)):
            B.torus(f'LR_Ring{k}{i}', (0, 0, zz), 0.0515 - i * 0.001, 0.008, RING if k == 'L' else RING_B, un, rot=(math.pi / 2, 0, 0))
        grab(f'L_Schuh{k}', ank, (0, 0, 0))
        grab(f'L_Aermel{k}', sh, (0.025, sg * 0.0, 0.0))
        B.rod(f'LR_ArmU{k}', (0, 0, 0), (0, 0, -0.14), 0.046, SKIN_L, el, r1=0.042)
        grab(f'L_Hand{k}', el, (0.0, sg * 0.0, -0.185))
    m, p1, p2, h = anchors(head, (0.17, 0, -0.115), [(0.15, 0.06, 0.04), (0.15, -0.07, 0.04)], J['R'][4], (0.05, 0, -0.185))
    return root, torso, head, J, (m, p1, p2, h)


# ------------------------------------------------------------------ Posen
def pose(J, torso, head, hipL, kneeL, hipR, kneeR, shL=0, elL=0, shR=0, elR=0, lean=0, headp=0):
    J['L'][0].rotation_euler = (0, hipL, 0); J['L'][1].rotation_euler = (0, kneeL, 0)
    J['R'][0].rotation_euler = (0, hipR, 0); J['R'][1].rotation_euler = (0, kneeR, 0)
    J['L'][3].rotation_euler = (0.06, 0.12 + shL, 0); J['L'][4].rotation_euler = (0, -0.12 + elL, 0)
    J['R'][3].rotation_euler = (-0.06, -0.12 + shR, 0); J['R'][4].rotation_euler = (0, -0.12 + elR, 0)
    torso.rotation_euler = (lean, 0, 0)
    head.rotation_euler = (headp, 0, 0)


def walk(p):
    sw = math.sin(p)
    return dict(hipL=-sw * 0.42, kneeL=0.16 * max(0, math.sin(p + 0.6)), hipR=sw * 0.42, kneeR=0.16 * max(0, math.sin(p + 0.6 + math.pi)),
                shL=sw * 0.45, shR=-sw * 0.45)


POSES = {'idle': {}, 'talk0': {'shR': -1.55, 'elR': -0.35}, 'talk1': {'shR': -0.25},
         'reach': {'shR': -1.85, 'elR': -0.15}, 'pick': {'lean': 0.42, 'hipL': -0.5, 'kneeL': 0.85, 'hipR': -0.3, 'kneeR': 0.6, 'shR': -1.0, 'elR': -0.3},
         'pull': {'shR': 0.35, 'elR': -1.5, 'lean': -0.08}, 'wave': {'shL': -2.9, 'elL': 0.3},
         'yawn': {'shR': -2.1, 'elR': -0.95, 'headp': -0.14}, 'think': {'shR': -1.35, 'elR': -1.5, 'headp': 0.1},
         'eat': {'shR': -1.75, 'elR': -1.25}, 'glasses': {'shR': -2.05, 'elR': -0.85},
         'saber0': {'shR': -2.6, 'elR': -0.3}, 'saber1': {'shR': -2.0, 'elR': -0.35}, 'saber2': {'shR': -1.4, 'elR': -0.4}}
for i in range(8):
    POSES[f'walk{i}'] = walk(i * math.pi / 4)

ORDER = ['idle'] + [f'walk{i}' for i in range(8)] + ['talk0', 'talk1', 'reach', 'pick', 'pull', 'wave', 'yawn', 'saber0', 'saber1', 'saber2', 'think', 'eat', 'glasses']

import bpy_extras.object_utils as ou

figs = {'hoagie': build_hoagie(), 'laverne': build_laverne()}
out = {}
for name, (root, torso, head, J, ank) in figs.items():
    out[name] = {}
    for pn in ORDER:
        pose(J, torso, head, **{**{'hipL': 0, 'kneeL': 0, 'hipR': 0, 'kneeR': 0, 'shL': 0, 'elL': 0, 'shR': 0, 'elR': 0, 'lean': 0, 'headp': 0}, **POSES[pn]})
        # Hüpfen beim Gehen wie in 2D (bob)
        root.location.z = 0 if not pn.startswith('walk') else abs(math.cos(int(pn[4:]) * math.pi / 4)) * 0.055
        bpy.context.view_layer.update()
        for o in SC.objects:
            if o.type == 'MESH':
                o.hide_render = False
        SC.render.filepath = f'{REPO}/art/render/helden_{name}_{pn}.png'
        bpy.ops.render.render(write_still=True)
        cam = SC.camera
        pts = {}
        for label, e in zip(('mund', 'pupL', 'pupR', 'hand'), ank):
            v = ou.world_to_camera_view(SC, cam, e.matrix_world.translation)
            pts[label] = [round(v.x * SC.render.resolution_x, 1), round((1 - v.y) * SC.render.resolution_y, 1)]
        out[name][pn] = pts
with open(REPO + '/art/render/anchors.json', 'w') as f:
    json.dump(out, f)
print('ANCHORS geschrieben')
sys.stdout.flush()
