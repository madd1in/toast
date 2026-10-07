# Die Tiere als 3D-Figuren (in Blender ausführen, vorher REPO und NAME setzen):
#   REPO = r'C:/.../Tentakel-Toast'; NAME = 'katze'; exec(open(REPO + '/art/blender/tiere_build.py').read())
# Katze Mozzarella (Lobby), Huhn Henriette (Garten 1776) und Saugroboter Staubi 3000 (Palast) – jedes Tier in einer
# eigenen Szene, aus Grundkörpern im Toon-Look der Figuren. Gerendert werden die Haltungen, die CRITTER_DRAW in
# draw.js kennt (Laufen, Sitzen, Putzen, Schlafen, Schmusen, Picken, Bürste). Schreibt art/render/<name>/*.png und
# meta.json (Fußpunkt, Anker; danach python art/blender/tiere_post.py).
import bpy, bmesh, json, math, os, sys, importlib
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
sys.path.insert(0, REPO + '/art/blender')
import figur_lib
importlib.reload(figur_lib)
from figur_lib import Builder, toon

YAW = -0.45   # leicht schräg wie die Figuren, Blick nach rechts


def scene_for(name):
    SC = bpy.data.scenes.get('Tier3D_' + name) or bpy.data.scenes.new('Tier3D_' + name)
    keep = ('MondH3', 'FuellH3', 'TierCam')
    for o in list(SC.collection.objects):
        if o.name in keep:
            SC.collection.objects.unlink(o)
        else:
            bpy.data.objects.remove(o, do_unlink=True)
    cam = bpy.data.objects.get('TierCam')
    if cam is None:
        cd = bpy.data.cameras.new('TierCam')
        cd.type = 'ORTHO'
        cam = bpy.data.objects.new('TierCam', cd)
    rig = bpy.data.objects['RigCam']   # gleicher Blickwinkel wie bei den Figuren, nur näher dran
    cam.rotation_euler = rig.rotation_euler
    cam.location = (0, -6, 0.65)
    if name == 'staubi':   # flaches Gerät am Boden: steiler von oben, damit Deckel und Logo zu sehen sind
        cam.rotation_euler = (1.2, 0, 0)
        cam.location = (0, -6, 0.1 + 6 / math.tan(1.2))
    cam.data.ortho_scale = 1.6
    for n in keep:
        SC.collection.objects.link(bpy.data.objects[n])
    hel = bpy.data.scenes['Helden3D']
    SC.camera = cam
    SC.world = hel.world
    r = SC.render
    r.engine = hel.render.engine
    r.resolution_x, r.resolution_y, r.resolution_percentage = 480, 320, 100   # 300 px pro Meter
    r.film_transparent = True
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    SC.view_settings.view_transform = hel.view_settings.view_transform
    SC.view_settings.look = hel.view_settings.look
    SC.eevee.taa_render_samples = 32
    return SC


def pivot(B, name, parent, loc):
    o = B.empty(name)
    o.parent = parent
    o.location = loc
    return o


def curve(SC, name, pts, r, mat, parent, loc=(0, 0, 0)):
    cd = bpy.data.curves.get(name) or bpy.data.curves.new(name, 'CURVE')
    cd.splines.clear()
    cd.dimensions = '3D'
    cd.bevel_depth = r
    cd.bevel_resolution = 6
    cd.use_fill_caps = True
    sp = cd.splines.new('BEZIER')
    sp.bezier_points.add(len(pts) - 1)
    for p, co in zip(sp.bezier_points, pts):
        p.co = co
        p.handle_left_type = p.handle_right_type = 'AUTO'
    sp.bezier_points[-1].radius = 0.55   # Spitze dünner
    cd.materials.clear()
    cd.materials.append(mat)
    o = bpy.data.objects.new(name, cd)
    SC.collection.objects.link(o)
    o.parent = parent
    o.location = loc
    return o


# ------------------------------------------------------------------ Katze Mozzarella
def build_katze(SC):
    B = Builder(SC)
    FUR, DARK, CREAM, PINK = toon('T_Fell', '#e89a4a'), toon('T_FellDunkel', '#b8682a'), toon('T_Schnauze', '#f8dcb8'), toon('T_Rosa', '#ff8aa0')
    EYE, BLACK = toon('T_KatzAuge', '#7bc043', hi=0.7), toon('N_Schwarz', '#16121e', hi=0.15)
    R = B.empty('Katze')
    R.rotation_euler = (0, 0, YAW)
    BODY = pivot(B, 'K_Body', R, (0, 0, 0.21))
    B.sphere('K_Rumpf', (0, 0, 0), (0.2, 0.105, 0.095), FUR, BODY)
    B.sphere('K_Brust', (0.12, 0, 0.01), (0.1, 0.095, 0.1), FUR, BODY)
    B.sphere('K_Bauch', (0.03, 0, -0.035), (0.15, 0.085, 0.06), CREAM, BODY)
    for i, x in enumerate((-0.11, -0.04, 0.03)):   # Tigerstreifen auf dem Rücken
        B.sphere(f'K_Streifen{i}', (x, 0, 0.044), (0.02, 0.093, 0.054), DARK, BODY)
    HEAD = pivot(B, 'K_Head', BODY, (0.2, 0, 0.1))
    B.sphere('K_Kopf', (0.04, 0, 0.04), (0.1, 0.105, 0.088), FUR, HEAD)
    B.sphere('K_Maul', (0.115, 0, 0.005), (0.045, 0.06, 0.035), CREAM, HEAD)
    B.sphere('K_Nase', (0.155, 0, 0.03), (0.014, 0.02, 0.012), PINK, HEAD)
    B.sphere('K_Zunge', (0.15, 0, -0.02), (0.02, 0.016, 0.01), PINK, HEAD).hide_render = True
    for k, y in (('L', 1), ('R', -1)):
        B.cone(f'K_Ohr{k}', 0.0, 0.075, 0.042, 0.004, FUR, HEAD, xy=(0.01, y * 0.058), rot=(y * -0.32, -0.12, 0), seg=16, bevel=0.004).location.z = 0.13
        B.cone(f'K_OhrInnen{k}', 0.0, 0.05, 0.026, 0.003, PINK, HEAD, xy=(0.022, y * 0.058), rot=(y * -0.32, -0.12, 0), seg=16, bevel=0).location.z = 0.13
        B.sphere(f'K_Auge{k}', (0.105, y * 0.042, 0.05), (0.022, 0.02, 0.027), EYE, HEAD)
        B.sphere(f'K_Pupille{k}', (0.122, y * 0.043, 0.05), (0.008, 0.006, 0.021), BLACK, HEAD)
        B.sphere(f'K_Zu{k}', (0.112, y * 0.042, 0.045), (0.02, 0.022, 0.0045), BLACK, HEAD).hide_render = True
        for j, dz in enumerate((-0.006, 0.008)):   # Schnurrhaare
            B.rod(f'K_Bart{k}{j}', (0.14, y * 0.045, 0.01 + dz), (0.15, y * 0.13, 0.02 + dz * 2.5), 0.0025, BLACK, HEAD, seg=6)
    for k, (x, y) in {'VL': (0.12, 0.055), 'VR': (0.12, -0.055), 'HL': (-0.13, 0.06), 'HR': (-0.13, -0.06)}.items():
        LEG = pivot(B, f'K_Bein{k}', BODY, (x, y, -0.03))
        B.rod(f'K_BeinRohr{k}', (0, 0, 0.02), (0, 0, -0.15), 0.03, FUR if y < 0 else DARK, LEG, r1=0.026, seg=16)
        B.sphere(f'K_Pfote{k}', (0.015, 0, -0.155), (0.038, 0.03, 0.025), CREAM if y < 0 else FUR, LEG)
    TAIL = pivot(B, 'K_Schwanz', BODY, (-0.19, 0, 0.03))
    curve(SC, 'K_SchwanzKurve', [(0, 0, 0), (-0.1, 0, 0.04), (-0.14, 0, 0.17), (-0.09, 0, 0.27)], 0.024, FUR, TAIL)
    return R


def pose_katze(n, ph=0):
    OB = bpy.data.objects
    OB['K_Body'].location = (0, 0, 0.21)
    OB['K_Body'].rotation_euler = (0, 0, 0)
    OB['K_Head'].rotation_euler = (0, 0, 0)
    OB['K_Head'].location = (0.2, 0, 0.1)
    OB['K_Schwanz'].rotation_euler = (0, 0, 0)
    for k in ('VL', 'VR', 'HL', 'HR'):
        OB[f'K_Bein{k}'].rotation_euler = (0, 0, 0)
        for c in OB[f'K_Bein{k}'].children:
            c.hide_render = False
    for k in 'LR':
        OB[f'K_Zu{k}'].hide_render = True
        OB[f'K_Auge{k}'].hide_render = OB[f'K_Pupille{k}'].hide_render = False
    OB['K_Zunge'].hide_render = True
    eyes_closed = False
    if n.startswith('walk'):
        s = math.sin(ph)
        for k, sg in (('VL', 1), ('HR', 1), ('VR', -1), ('HL', -1)):
            OB[f'K_Bein{k}'].rotation_euler = (0, sg * s * 0.5, 0)
        OB['K_Schwanz'].rotation_euler = (math.sin(ph * 0.5) * 0.25, 0, 0)
        OB['K_Head'].rotation_euler = (0, 0.06 * math.cos(ph * 2), 0)
    elif n == 'groom':   # putzt sich: Kopf zur gehobenen Vorderpfote, Zunge raus
        OB['K_BeinVR'].rotation_euler = (0.35, -1.55, 0)
        OB['K_Head'].rotation_euler = (0.25, 0.55, -0.15)
        OB['K_Zunge'].hide_render = False
        eyes_closed = True
    elif n == 'sleep':   # eingerollt, Beine eingeklappt, Schwanz nach vorn um den Körper, Kopf auf den Pfoten
        OB['K_Body'].location = (0, 0, 0.1)
        for k in ('VL', 'VR', 'HL', 'HR'):
            for c in OB[f'K_Bein{k}'].children:
                c.hide_render = True
        OB['K_Head'].location = (0.19, 0, 0.03)
        OB['K_Head'].rotation_euler = (0.15, 0.25, -0.35)
        OB['K_Schwanz'].rotation_euler = (0, 1.45, -0.42)   # liegt flach neben dem Körper, Spitze vorn
        eyes_closed = True
    elif n == 'rub':   # schmiegt sich an: Rücken hoch, Schwanz senkrecht, Kopf gereckt, Augen zu
        OB['K_Body'].location = (0, 0, 0.23)
        OB['K_Body'].rotation_euler = (0, -0.06, 0)
        OB['K_Head'].rotation_euler = (0.2, -0.3, 0)
        OB['K_Schwanz'].rotation_euler = (0, -0.55, 0)
        eyes_closed = True
    for k in 'LR':
        OB[f'K_Zu{k}'].hide_render = not eyes_closed
        OB[f'K_Auge{k}'].hide_render = OB[f'K_Pupille{k}'].hide_render = eyes_closed


# ------------------------------------------------------------------ Huhn Henriette
def build_huhn(SC):
    B = Builder(SC)
    WHITE, CREAM, RED, YEL, LEG = toon('T_Federn', '#f6f2ea', hi=0.35), toon('T_Fluegel', '#e3d9c6'), toon('T_Kamm', '#d8322e'), toon('T_Schnabel', '#f0b020'), toon('T_Huhnbein', '#e8a020')
    BLACK = toon('N_Schwarz', '#16121e', hi=0.15)
    R = B.empty('Huhn')
    R.rotation_euler = (0, 0, YAW)
    BODY = pivot(B, 'H_Body', R, (0, 0, 0.29))
    B.sphere('H_Rumpf', (0, 0, 0), (0.17, 0.13, 0.135), WHITE, BODY)
    B.sphere('H_Brust', (0.1, 0, 0.02), (0.1, 0.11, 0.11), WHITE, BODY)
    for k, y in (('L', 1), ('R', -1)):
        B.sphere(f'H_Fluegel{k}', (-0.02, y * 0.118, 0.01), (0.115, 0.035, 0.08), CREAM, BODY, rot=(0, 0.25, 0))
    for i, (a, l) in enumerate(((-0.55, 0.15), (-0.85, 0.17), (-1.15, 0.14))):   # Schwanzfedern
        B.rod(f'H_Feder{i}', (-0.12, 0, 0.03), (-0.12 - l * math.sin(-a), (i - 1) * 0.02, 0.03 + l * math.cos(-a)), 0.045, CREAM if i == 1 else WHITE, BODY, r1=0.012, seg=16)
    HEAD = pivot(B, 'H_Head', BODY, (0.13, 0, 0.08))
    B.rod('H_Hals', (0, 0, 0), (0.035, 0, 0.12), 0.062, WHITE, HEAD, r1=0.05, seg=20)
    B.sphere('H_Kopf', (0.05, 0, 0.15), (0.066, 0.06, 0.066), WHITE, HEAD)
    for i, x in enumerate((0.02, 0.05, 0.08)):
        B.sphere(f'H_Kamm{i}', (x, 0, 0.215 + (0.01 if i == 1 else 0)), (0.022, 0.012, 0.032), RED, HEAD)
    B.rod('H_Schnabel', (0.1, 0, 0.15), (0.165, 0, 0.138), 0.022, YEL, HEAD, r1=0.002, seg=12)
    B.sphere('H_Lappen', (0.1, 0, 0.1), (0.015, 0.01, 0.026), RED, HEAD)
    for k, y in (('L', 1), ('R', -1)):
        B.sphere(f'H_Auge{k}', (0.088, y * 0.042, 0.168), (0.012, 0.01, 0.014), BLACK, HEAD)
        LG = pivot(B, f'H_Bein{k}', BODY, (0.0, y * 0.05, -0.11))
        B.rod(f'H_BeinRohr{k}', (0, 0, 0.02), (0, 0, -0.165), 0.012, LEG, LG, seg=10)
        for j, a in enumerate((-0.5, 0, 0.5)):
            B.rod(f'H_Zeh{k}{j}', (0, 0, -0.165), (0.06 * math.cos(a), 0.06 * math.sin(a), -0.175), 0.008, LEG, LG, seg=8)
        B.rod(f'H_ZehHinten{k}', (0, 0, -0.165), (-0.035, 0, -0.175), 0.008, LEG, LG, seg=8)
    return R


def pose_huhn(n, ph=0):
    OB = bpy.data.objects
    OB['H_Head'].rotation_euler = (0, 0, 0)
    OB['H_Body'].rotation_euler = (0, 0, 0)
    for k in 'LR':
        OB[f'H_Bein{k}'].rotation_euler = (0, 0, 0)
    if n.startswith('walk'):
        s = math.sin(ph)
        OB['H_BeinL'].rotation_euler = (0, s * 0.42, 0)
        OB['H_BeinR'].rotation_euler = (0, -s * 0.42, 0)
        OB['H_Head'].rotation_euler = (0, 0.12 * math.cos(ph * 2), 0)   # Kopfnicken im Schritt
    elif n == 'peck0':
        OB['H_Head'].rotation_euler = (0, 0.55, 0)
        OB['H_Body'].rotation_euler = (0, 0.12, 0)
    elif n == 'peck1':   # Schnabel am Boden
        OB['H_Head'].rotation_euler = (0, 1.35, 0)
        OB['H_Body'].rotation_euler = (0, 0.3, 0)


# ------------------------------------------------------------------ Saugroboter Staubi 3000
def build_staubi(SC):
    B = Builder(SC)
    BODY, TOP, RING, BR = toon('T_Bot', '#5c4a7a'), toon('T_BotDeckel', '#7a66a0', hi=0.6), toon('T_BotRing', '#3a2c52'), toon('T_Borste', '#9a9ab0')
    LOGO, LED, GLAS = toon('T_BotLogo', '#d9b2f2'), toon('T_BotLed', '#2a6a2a'), toon('T_BotSensor', '#1c1428', hi=0.8)
    R = B.empty('Staubi')
    R.rotation_euler = (0, 0, YAW)
    B.cone('S_Ring', 0.0, 0.035, 0.3, 0.305, RING, R, seg=48, bevel=0.01)
    B.cone('S_Gehaeuse', 0.03, 0.085, 0.3, 0.29, BODY, R, seg=48, bevel=0.015)
    B.cone('S_Deckel', 0.085, 0.1, 0.262, 0.25, TOP, R, seg=48, bevel=0.006)
    B.cone('S_Sensor', 0.04, 0.075, 0.06, 0.06, GLAS, R, xy=(0.262, 0), scale=(0.5, 2.2, 1), seg=24, bevel=0.005)
    B.sphere('S_Led', (0.17, -0.09, 0.103), (0.02, 0.02, 0.012), LED, R)
    # Tentakel-Logo: kleiner liegender Tentakel mit Saugnapf-Punkten
    curve(SC, 'S_Logo', [(-0.12, 0.02, 0.103), (-0.05, -0.04, 0.104), (0.02, 0.03, 0.104), (0.07, -0.02, 0.103)], 0.014, LOGO, R)
    BR_ = pivot(B, 'S_Buerste', R, (0.2, -0.19, 0.012))
    for i in range(3):
        a = i * 2 * math.pi / 3
        B.rod(f'S_Borste{i}', (0, 0, 0), (0.12 * math.cos(a), 0.12 * math.sin(a), -0.004), 0.006, BR, BR_, seg=6)
    B.cone('S_Nabe', -0.005, 0.012, 0.018, 0.018, RING, BR_, seg=16, bevel=0)
    return R


def pose_staubi(n, ph=0):
    bpy.data.objects['S_Buerste'].rotation_euler = (0, 0, -int(n[1]) * 2 * math.pi / 9)   # b0/b1/b2: Bürste um 40° weiter


BUILD = {'katze': build_katze, 'huhn': build_huhn, 'staubi': build_staubi}
POSE = {'katze': pose_katze, 'huhn': pose_huhn, 'staubi': pose_staubi}
FRAMES = {
    'katze': [('sit', 0)] + [(f'walk{i}', i * math.pi / 2) for i in range(4)] + [('groom', 0), ('sleep', 0), ('rub', 0)],
    'huhn': [('idle', 0)] + [(f'walk{i}', i * math.pi / 2) for i in range(4)] + [('peck0', 0), ('peck1', 0)],
    'staubi': [('b0', 0), ('b1', 0), ('b2', 0)],
}
ANCHOR = {'katze': 'K_Kopf', 'huhn': 'H_Kopf', 'staubi': 'S_Led'}   # Kopf (Partyhütchen) bzw. Leuchte (blinkt im Spiel)


def render(name):
    SC = scene_for(name)
    root = BUILD[name](SC)
    out = REPO + f'/art/render/{name}/'
    os.makedirs(out, exist_ok=True)
    win = bpy.context.window
    prev = win.scene
    win.scene = SC
    cam = SC.camera
    W, H = SC.render.resolution_x, SC.render.resolution_y
    ppm = W / cam.data.ortho_scale

    def px(co):
        p = world_to_camera_view(SC, cam, co)
        return [round(p.x * W, 1), round((1 - p.y) * H, 1)]

    meta = {'res': [W, H], 'ppm': ppm, 'frames': []}
    try:
        for n, ph in FRAMES[name]:
            POSE[name](n, ph)
            bpy.context.view_layer.update()
            vis = [o for o in SC.objects if o.type in ('MESH', 'CURVE') and not o.hide_render]
            top = max((o.matrix_world @ Vector(c)).z for o in vis for c in o.bound_box)
            meta['frames'].append({'name': n, 'foot': px(root.matrix_world.translation), 'anchor': px(bpy.data.objects[ANCHOR[name]].matrix_world.translation), 'top_m': round(top, 4)})
            if not globals().get('NO_RENDER'):
                SC.render.filepath = out + f'{n}.png'
                bpy.ops.render.render(write_still=True, scene=SC.name)
    finally:
        POSE[name](FRAMES[name][0][0])
        win.scene = prev
    json.dump(meta, open(out + 'meta.json', 'w'), indent=1)
    print('tier', name, [(f['name'], f['top_m']) for f in meta['frames']])


if globals().get('NAME') in BUILD:
    render(NAME)
