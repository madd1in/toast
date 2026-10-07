# Bewegliche 3D-Figuren für das Spiel (in Blender ausführen, vorher REPO und NAME setzen):
#   REPO = r'C:/.../Tentakel-Toast'; NAME = 'hoagie'; exec(open(REPO + '/art/blender/figur_rig.py').read())
# Kopf und Rumpf werden aus den Titelbild-Figuren (Szene Helden3D) kopiert, Arme und Beine neu mit Gelenken
# (Hüfte, Knie, Knöchel, Schulter, Ellbogen) gebaut. Jede Figur bekommt eine eigene Szene, damit beim
# Rendern nie eine zweite Figur im Bild steht.
import bpy, sys, importlib
from mathutils import Matrix, Vector
sys.path.insert(0, REPO + '/art/blender')
import figur_lib
importlib.reload(figur_lib)
from figur_lib import Builder

# Maße in Metern (Figur blickt nach +x, Füße bei z = 0). top/h: Scheitel in Blender und Figurenhöhe im Spiel.
# abd: Arme etwas vom Körper weg; stride/knee: Schrittweite und Kniebeuge (passend zum Lauftempo im Spiel).
CHARS = {
    'bernard': dict(src='Bernard', pre='B_', scene='Rig3D', head_z=1.64, top=2.05, h=214, abd=0.06, stride=0.26, knee=0.75,
                    head=['Kopf', 'Haar', 'Locke', 'Pony', 'OhrL', 'OhrR', 'Nase', 'Mund', 'BrilleL', 'BrilleR', 'GlasL', 'GlasR', 'PupilleL', 'PupilleR', 'Steg'],
                    torso=['Hemd', 'Guertel', 'Schnalle', 'Hals'],
                    hip=(0.98, 0.09), thigh=0.43, shin=0.41, leg_r=(0.08, 0.074, 0.068), leg_mat='HoseBraun', shoe='Schuh', shoe_off=(0.06, 0, -0.07), sole=0.14,
                    sh=(1.47, 0.2), upper=0.22, fore=0.2, arm_r=(0.05, 0.047, 0.043), arm_mat=('HautB', 'HautB'), sleeve='Aermel', sleeve_off=(0, 0, 0.01),
                    hand='Hand', hand_off=(0.02, 0, -0.25), mouth='Mund', eyes=('PupilleR', 'PupilleL')),
    'hoagie': dict(src='Hoagie', pre='H_', scene='Rig3D_Hoagie', head_z=1.3, top=1.72, h=186, abd=0.24, stride=0.5, knee=0.9,
                   head=['Kopf', 'Haare', 'Kappe', 'Schirm', 'Nase', 'Mund', 'AugeL', 'AugeR', 'PupilleL', 'PupilleR'],
                   torso=['Bauch', 'Blitz'],
                   hip=(0.62, 0.12), thigh=0.24, shin=0.22, leg_r=(0.1, 0.096, 0.09), leg_mat='Jeans', shoe='Stiefel', shoe_off=(0.06, 0, -0.07), sole=0.16,
                   sh=(1.22, 0.34), upper=0.2, fore=0.17, arm_r=(0.072, 0.068, 0.062), arm_mat=('HautB', 'HautB'), sleeve='Aermel', sleeve_off=(0, 0, -0.02),
                   hand='Hand', hand_off=(0.05, 0, -0.21), mouth='Mund', eyes=('AugeR', 'AugeL')),
    'laverne': dict(src='Laverne', pre='L_', scene='Rig3D_Laverne', head_z=1.38, top=1.96, h=212, abd=0.08, stride=0.37, knee=0.8,
                    head=['Kopf', 'HaarKappe', 'Nase', 'Mund', 'AugeL', 'AugeR', 'PupilleL', 'PupilleR'] + [f'Stachel{i}' for i in range(14)],
                    torso=['Kleid', 'Kragen', 'Hals', 'Knopf0', 'Knopf1', 'Knopf2'],
                    hip=(0.72, 0.07), thigh=0.32, shin=0.30, leg_r=(0.05, 0.048, 0.045), leg_mat='Ringel', shoe='Schuh', shoe_off=(0.05, 0, -0.04), sole=0.10,
                    sh=(1.28, 0.18), upper=0.16, fore=0.15, arm_r=(0.055, 0.052, 0.048), arm_mat=('KleidGruen', 'KleidGruen'), sleeve=None, sleeve_off=None,
                    hand='Hand', hand_off=(0.03, 0, -0.19), mouth='Mund', eyes=('AugeR', 'AugeL')),
}
YAW = -0.559


def build(name):
    cfg = CHARS[name]
    P = cfg['pre'][0]
    SRC = bpy.data.objects[cfg['src']]
    SC = bpy.data.scenes.get(cfg['scene']) or bpy.data.scenes.new(cfg['scene'])
    keep = ('MondH3', 'FuellH3', 'RigCam')
    for o in list(SC.collection.objects):
        if o.name in keep:
            SC.collection.objects.unlink(o)
        else:
            bpy.data.objects.remove(o, do_unlink=True)
    src = bpy.data.scenes['Helden3D']
    for n in keep:
        SC.collection.objects.link(bpy.data.objects[n])
    SC.camera = bpy.data.objects['RigCam']
    SC.world = src.world
    r, s = SC.render, src.render
    r.engine = s.engine
    r.resolution_x, r.resolution_y, r.resolution_percentage = 600, 840, 100   # 240 px pro Meter
    r.film_transparent = True
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    SC.view_settings.view_transform = src.view_settings.view_transform
    SC.view_settings.look = src.view_settings.look
    SC.eevee.taa_render_samples = 32

    B = Builder(SC)
    ROOT = B.empty(f'{P}Rig')
    ROOT.rotation_euler = (0, 0, YAW)

    def piv(nm, parent, loc):
        o = B.empty(f'{P}R_{nm}')
        o.parent = parent
        o.location = loc
        o.rotation_mode = 'XYZ'
        return o

    hz, hy = cfg['hip']
    BODY = piv('Body', ROOT, (0, 0, 0))
    TORSO = piv('Torso', BODY, (0, 0, hz))
    HEAD = piv('Head', TORSO, (0, 0, cfg['head_z'] - hz))
    abs_at = {TORSO.name: Vector((0, 0, hz)), HEAD.name: Vector((0, 0, cfg['head_z']))}
    inv_root = SRC.matrix_world.inverted()
    pre = cfg['pre']
    groups = {pre + n: HEAD for n in cfg['head']}
    groups.update({pre + n: TORSO for n in cfg['torso']})
    for o in SRC.children:
        par = groups.get(o.name)
        if not par:
            continue
        c = o.copy()   # Mesh-Daten geteilt, nur die Lage ist neu
        c.name = 'R' + o.name
        SC.collection.objects.link(c)
        c.parent = par
        c.matrix_parent_inverse = Matrix.Identity(4)
        c.matrix_basis = Matrix.Translation(-abs_at[par.name]) @ (inv_root @ o.matrix_world)

    M = bpy.data.materials

    def part_copy(nm, parent, loc):
        o = bpy.data.objects[nm]
        c = o.copy()
        c.name = 'R' + o.name
        SC.collection.objects.link(c)
        c.parent = parent
        c.matrix_parent_inverse = Matrix.Identity(4)
        c.location = loc
        c.rotation_euler = (0, 0, 0)
        return c

    shz, shy = cfg['sh']
    r0, r1, r2 = cfg['leg_r']
    a0, a1, a2 = cfg['arm_r']
    um, fm = M[cfg['arm_mat'][0]], M[cfg['arm_mat'][1]]
    for k, y in (('R', -1), ('L', 1)):
        hip = piv(f'Hip{k}', BODY, (0, hy * y, hz))
        B.rod(f'{P}R_Oberschenkel{k}', (0, 0, 0.04), (0, 0, -cfg['thigh'] - 0.02), r0, M[cfg['leg_mat']], hip, r1=r1, seg=24, bevel=0.02)
        knee = piv(f'Knie{k}', hip, (0, 0, -cfg['thigh']))
        B.sphere(f'{P}R_KnieKugel{k}', (0, 0, 0), (r1, r1, r1), M[cfg['leg_mat']], knee)
        B.rod(f'{P}R_Unterschenkel{k}', (0, 0, 0), (0, 0, -cfg['shin'] - 0.01), r1, M[cfg['leg_mat']], knee, r1=r2, seg=24, bevel=0.02)
        ankle = piv(f'Knoechel{k}', knee, (0, 0, -cfg['shin']))
        part_copy(pre + cfg['shoe'] + k, ankle, cfg['shoe_off'])
        sh = piv(f'Schulter{k}', TORSO, (0, shy * y, shz - hz))
        if cfg['sleeve']:
            part_copy(pre + cfg['sleeve'] + k, sh, cfg['sleeve_off'])
        else:
            B.sphere(f'{P}R_SchulterKugel{k}', (0, 0, 0), (a0 * 1.05, a0 * 1.05, a0 * 1.05), um, sh)
        B.rod(f'{P}R_Oberarm{k}', (0, 0, 0), (0, 0, -cfg['upper'] - 0.01), a0, um, sh, r1=a1, seg=20, bevel=0.012)
        el = piv(f'Ellbogen{k}', sh, (0, 0, -cfg['upper']))
        B.sphere(f'{P}R_Gelenk{k}', (0, 0, 0), (a1, a1, a1), fm, el)
        B.rod(f'{P}R_Unterarm{k}', (0, 0, 0), (0, 0, -cfg['fore']), a1, fm, el, r1=a2, seg=20, bevel=0.012)
        part_copy(pre + cfg['hand'] + k, el, cfg['hand_off'])
    print('rig', name, SC.name, len(SC.objects))
    return SC


if globals().get('NAME'):
    build(NAME)
