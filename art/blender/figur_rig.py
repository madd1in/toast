# Bewegliche 3D-Figuren für das Spiel (in Blender ausführen, vorher REPO und NAME setzen):
#   REPO = r'C:/.../Tentakel-Toast'; NAME = 'hoagie'; exec(open(REPO + '/art/blender/figur_rig.py').read())
# Kopf und Rumpf werden aus den fertigen Modellen (Helden3D bzw. NPC3D) kopiert, Arme und Beine neu mit Gelenken
# (Hüfte, Knie, Knöchel, Schulter, Ellbogen) gebaut. Jede Figur bekommt eine eigene Szene, damit beim
# Rendern nie eine zweite Figur im Bild steht.
import bpy, sys, importlib
from mathutils import Euler, Matrix, Vector
sys.path.insert(0, REPO + '/art/blender')
import figur_lib
importlib.reload(figur_lib)
from figur_lib import Builder

# Maße in Metern (Figur blickt nach +x, Füße bei z = 0). Teilenamen mit {k} werden für R/L eingesetzt.
# head/torso: Teile für Kopf und Rumpf (oder split: alles über dieser Höhe gehört zum Kopf, drop wird weggelassen).
# abd: Arme etwas vom Körper weg; stride/knee: Schrittweite und Kniebeuge (passend zum Lauftempo im Spiel).
# h: Figurenhöhe im Spiel; frames: welche Bilder gerendert werden (None = alle).
HEROES = ['idle'] + [f'walk{i}' for i in range(8)] + ['talk0', 'talk1', 'reach', 'pick', 'pull', 'wave', 'yawn', 'saber0', 'saber1', 'saber2']
CHARS = {
    'bernard': dict(src='Bernard', rp='B', scene='Rig3D', head_z=1.64, top=2.05, h=214, abd=0.06, stride=0.26, knee=0.75,
                    head=['B_' + n for n in ['Kopf', 'Haar', 'Locke', 'Pony', 'OhrL', 'OhrR', 'Nase', 'Mund', 'BrilleL', 'BrilleR', 'GlasL', 'GlasR', 'PupilleL', 'PupilleR', 'Steg']],
                    torso=['B_Hemd', 'B_Guertel', 'B_Schnalle', 'B_Hals'],
                    hip=(0.98, 0.09), thigh=0.43, shin=0.41, leg_r=(0.08, 0.074, 0.068), leg_mat='HoseBraun', shoe='B_Schuh{k}', shoe_off=(0.06, 0, -0.07), sole=0.14,
                    sh=(1.47, 0.2), upper=0.22, fore=0.2, arm_r=(0.05, 0.047, 0.043), arm_mat=('HautB', 'HautB'), sleeve='B_Aermel{k}', sleeve_off=(0, 0, 0.01),
                    hand='B_Hand{k}', hand_off=(0.02, 0, -0.25), mouth='B_Mund', eyes=('B_PupilleR', 'B_PupilleL'),
                    frames=HEROES + ['think', 'eat', 'glasses']),
    'hoagie': dict(src='Hoagie', rp='H', scene='Rig3D_Hoagie', head_z=1.3, top=1.72, h=186, abd=0.24, stride=0.5, knee=0.9,
                   head=['H_' + n for n in ['Kopf', 'Haare', 'Kappe', 'Schirm', 'Nase', 'Mund', 'AugeL', 'AugeR', 'PupilleL', 'PupilleR',
                                             'OhrL', 'OhrR', 'KoteletteL', 'KoteletteR', 'BraueL', 'BraueR', 'Kinn', 'Bart', 'KappeKnopf'] + [f'Straehne{i}' for i in range(11)]],
                   torso=['H_Bauch', 'H_Blitz', 'H_Guertel'],
                   hip=(0.62, 0.12), thigh=0.24, shin=0.22, leg_r=(0.1, 0.096, 0.09), leg_mat='Jeans', shoe='H_Stiefel{k}', shoe_off=(0.06, 0, -0.07), sole=0.16,
                   sh=(1.22, 0.34), upper=0.2, fore=0.17, arm_r=(0.072, 0.068, 0.062), arm_mat=('HautB', 'HautB'), sleeve='H_Aermel{k}', sleeve_off=(0, 0, -0.02),
                   hand='H_Hand{k}', hand_off=(0.05, 0, -0.21), mouth='H_Mund', eyes=('H_AugeR', 'H_AugeL'),
                   frames=HEROES + ['think', 'eat', 'pour', 'dig0', 'dig1', 'rope0', 'rope1', 'airguitar0', 'airguitar1', 'belly0', 'belly1']),
    'laverne': dict(src='Laverne', rp='L', scene='Rig3D_Laverne', head_z=1.38, top=1.96, h=212, abd=0.08, stride=0.37, knee=0.8,
                    head=['L_' + n for n in ['Kopf', 'HaarKappe', 'Nase', 'Mund', 'AugeL', 'AugeR', 'PupilleL', 'PupilleR'] + [f'Haar{i}' for i in range(25)]],
                    torso=['L_Kleid', 'L_Kragen', 'L_Hals', 'L_Knopf0', 'L_Knopf1', 'L_Knopf2'],
                    hip=(0.72, 0.07), thigh=0.32, shin=0.30, leg_r=(0.05, 0.048, 0.045), leg_mat='Ringel', shoe='L_Schuh{k}', shoe_off=(0.05, 0, -0.04), sole=0.10,
                    sh=(1.28, 0.18), upper=0.16, fore=0.15, arm_r=(0.055, 0.052, 0.048), arm_mat=('KleidGruen', 'KleidGruen'), sleeve=None,
                    hand='L_Hand{k}', hand_off=(0.03, 0, -0.19), mouth='L_Mund', eyes=('L_AugeR', 'L_AugeL'),
                    frames=HEROES + ['think', 'eat', 'climb0', 'climb1', 'climb2', 'climb3']),
    # Nebenfiguren (Modelle aus npc_build.py, Szene NPC3D)
    'drfred': dict(src='DrFred', rp='F', scene='Rig3D_DrFred', head_z=1.56, split=1.56, h=172, abd=0.18, stride=0.3, knee=0.8,
                   drop=['F_ArmL', 'F_ArmR', 'F_UnterarmR', 'F_HandL', 'F_HandR', 'F_BeinL', 'F_BeinR', 'F_SchuhL', 'F_SchuhR', 'F_Lupe', 'F_LupeGlas', 'F_LupeStiel'],
                   hip=(0.62, 0.085), thigh=0.26, shin=0.26, leg_r=(0.062, 0.06, 0.056), leg_mat='F_Hose', shoe='F_Schuh{k}', shoe_off=(0.06, 0, -0.045), sole=0.10,
                   sh=(1.42, 0.2), upper=0.22, fore=0.2, arm_r=(0.062, 0.066, 0.07), arm_mat=('F_Kittel', 'F_Kittel'), sleeve=None,
                   hand='F_Hand{k}', hand_off=(0.02, 0, -0.26), mouth='DrFred_Mund', eyes=('F_PupilleR', 'F_PupilleL'),
                   frames=['idle'] + [f'walk{i}' for i in range(8)] + ['talk0', 'talk1', 'idea']),
    'gertrude': dict(src='Gertrude', rp='G', scene='Rig3D_Gertrude', head_z=1.46, split=1.46, h=190, abd=0.12, stride=0, knee=0,
                     drop=['G_ArmL', 'G_ArmR', 'G_HandL', 'G_HandR', 'G_PuffL', 'G_PuffR', 'G_SchuhL', 'G_SchuhR'], static=['G_SchuhL', 'G_SchuhR'],
                     hip=None, sh=(1.27, 0.21), upper=0.13, fore=0.13, arm_r=(0.046, 0.044, 0.04), arm_mat=('N_Haut', 'N_Haut'), sleeve='G_Puff{k}', sleeve_off=(0, 0, 0.03),
                     hand='G_Hand{k}', hand_off=(0.02, 0, -0.17), mouth='Gertrude_Mund', eyes=('Gertrude_AugeR', 'Gertrude_AugeL'),
                     frames=['idle'] + [f'walk{i}' for i in range(8)] + ['talk0', 'talk1', 'rub0', 'rub1']),
    'hancock': dict(src='Hancock', rp='K', scene='Rig3D_Hancock', head_z=1.5, split=1.5, h=200, abd=0.1, stride=0.3, knee=0.8,
                    drop=['H_ArmL.001', 'H_ArmR.001', 'H_UnterarmR', 'H_HandL.001', 'H_HandR.001', 'H_ManschL', 'H_ManschR', 'H_Feder', 'H_Kiel',
                          'H_HoseL', 'H_HoseR', 'H_StrumpfL', 'H_StrumpfR', 'H_SchuhL', 'H_SchuhR', 'H_SchnalleL', 'H_SchnalleR'],
                    hip=(0.84, 0.09), thigh=0.37, shin=0.37, leg_r=(0.09, 0.07, 0.05), leg_mat=('H_Hose', 'H_Strumpf'), shoe='H_Schuh{k}', shoe_off=(0.06, 0, -0.05), sole=0.10,
                    ankle_extra=[('H_Schnalle{k}', (0.12, 0, -0.015), (0, 0, 0))],
                    sh=(1.38, 0.21), upper=0.2, fore=0.18, arm_r=(0.06, 0.062, 0.064), arm_mat=('H_Rock', 'H_Rock'), sleeve=None,
                    hand='H_Hand{k}.001', hand_off=(0.02, 0, -0.24), mouth='Hancock_Mund', eyes=('Hancock_AugeR', 'Hancock_AugeL'),
                    wrist_extra=[('H_Mansch{k}', (0, 0, -0.17), (0, 0, 0)), ('H_Feder', (0.13, 0, -0.25), (0, 1.85, 0), 'R'), ('H_Kiel', (-0.03, 0, -0.205), (0, 1.85, 0), 'R')],
                    base=dict(aR=-0.85, eR=0.75, xR=0.1),   # hält die Feder vor der Brust
                    frames=['idle'] + [f'walk{i}' for i in range(8)] + ['talk0', 'talk1', 'sign0', 'sign1', 'sign2']),
}
YAW = -0.559


def nm(base, k):
    return base.format(k=k)


def build(name):
    cfg = CHARS[name]
    P = cfg['rp']
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

    def piv(n, parent, loc):
        o = B.empty(f'{P}R_{n}')
        o.parent = parent
        o.location = loc
        o.rotation_mode = 'XYZ'
        return o

    hz = cfg['hip'][0] if cfg['hip'] else 0.9
    BODY = piv('Body', ROOT, (0, 0, 0))
    TORSO = piv('Torso', BODY, (0, 0, hz))
    HEAD = piv('Head', TORSO, (0, 0, cfg['head_z'] - hz))
    abs_at = {BODY.name: Vector((0, 0, 0)), TORSO.name: Vector((0, 0, hz)), HEAD.name: Vector((0, 0, cfg['head_z']))}
    # Lage relativ zur Figur: matrix_basis (die Teile hängen ohne Ausgleichsmatrix am Wurzel-Empty)
    local = lambda o: o.matrix_parent_inverse @ o.matrix_basis
    if 'split' in cfg:
        groups = {}
        for o in SRC.children:
            if o.name in cfg.get('static', []):
                groups[o.name] = BODY
            elif o.name not in cfg['drop']:
                groups[o.name] = HEAD if local(o).translation.z >= cfg['split'] else TORSO
    else:
        groups = {n: HEAD for n in cfg['head']}
        groups.update({n: TORSO for n in cfg['torso']})
    for o in SRC.children:
        par = groups.get(o.name)
        if not par:
            continue
        c = o.copy()   # Mesh-Daten geteilt, nur die Lage ist neu
        c.name = 'R' + o.name
        c.hide_render = c.hide_viewport = False   # die Abspann-Szene blendet Figuren einzeln aus (solo)
        SC.collection.objects.link(c)
        c.parent = par
        c.matrix_parent_inverse = Matrix.Identity(4)
        c.matrix_basis = Matrix.Translation(-abs_at[par.name]) @ local(o)

    M = bpy.data.materials

    def part_copy(n, parent, loc, rot=(0, 0, 0)):
        o = bpy.data.objects[n]
        c = o.copy()
        c.name = 'R' + o.name
        c.hide_render = c.hide_viewport = False
        SC.collection.objects.link(c)
        c.parent = parent
        c.matrix_parent_inverse = Matrix.Identity(4)
        c.location = loc
        c.rotation_euler = rot
        return c

    shz, shy = cfg['sh']
    a0, a1, a2 = cfg['arm_r']
    um, fm = M[cfg['arm_mat'][0]], M[cfg['arm_mat'][1]]
    for k, y in (('R', -1), ('L', 1)):
        if cfg['hip']:
            hy = cfg['hip'][1]
            r0, r1, r2 = cfg['leg_r']
            lm = cfg['leg_mat'] if isinstance(cfg['leg_mat'], tuple) else (cfg['leg_mat'], cfg['leg_mat'])
            hip = piv(f'Hip{k}', BODY, (0, hy * y, hz))
            B.rod(f'{P}R_Oberschenkel{k}', (0, 0, 0.04), (0, 0, -cfg['thigh'] - 0.02), r0, M[lm[0]], hip, r1=r1, seg=24, bevel=0.02)
            knee = piv(f'Knie{k}', hip, (0, 0, -cfg['thigh']))
            B.sphere(f'{P}R_KnieKugel{k}', (0, 0, 0), (r1, r1, r1), M[lm[0]], knee)
            B.rod(f'{P}R_Unterschenkel{k}', (0, 0, 0), (0, 0, -cfg['shin'] - 0.01), r2 if lm[0] != lm[1] else r1, M[lm[1]], knee, r1=r2 * (0.86 if lm[0] != lm[1] else 1), seg=24, bevel=0.02)
            ankle = piv(f'Knoechel{k}', knee, (0, 0, -cfg['shin']))
            part_copy(nm(cfg['shoe'], k), ankle, cfg['shoe_off'])
            for ex in cfg.get('ankle_extra', []):
                part_copy(nm(ex[0], k), ankle, ex[1], ex[2])
        sh = piv(f'Schulter{k}', TORSO, (0, shy * y, shz - hz))
        if cfg.get('sleeve'):
            part_copy(nm(cfg['sleeve'], k), sh, cfg['sleeve_off'])
        else:
            B.sphere(f'{P}R_SchulterKugel{k}', (0, 0, 0), (a0 * 1.05, a0 * 1.05, a0 * 1.05), um, sh)
        B.rod(f'{P}R_Oberarm{k}', (0, 0, 0), (0, 0, -cfg['upper'] - 0.01), a0, um, sh, r1=a1, seg=20, bevel=0.012)
        el = piv(f'Ellbogen{k}', sh, (0, 0, -cfg['upper']))
        B.sphere(f'{P}R_Gelenk{k}', (0, 0, 0), (a1, a1, a1), fm, el)
        B.rod(f'{P}R_Unterarm{k}', (0, 0, 0), (0, 0, -cfg['fore']), a1, fm, el, r1=a2, seg=20, bevel=0.012)
        part_copy(nm(cfg['hand'], k), el, cfg['hand_off'])
        for ex in cfg.get('wrist_extra', []):
            if len(ex) > 3 and ex[3] != k:
                continue
            part_copy(nm(ex[0], k), el, ex[1], ex[2])
    print('rig', name, SC.name, len(SC.objects))
    return SC


if globals().get('NAME') and globals().get('BUILD', True):
    build(NAME)
