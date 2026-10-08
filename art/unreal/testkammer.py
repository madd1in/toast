# Testkammer für Tentakel-Toast in Unreal Engine bauen und als Hintergrund rendern (im Editor ausführen):
#   exec(open(r'C:/.../Tentakel-Toast/art/unreal/testkammer.py', encoding='utf-8').read())
# Legt /Game/TentakelToast/Maps/L_TT_Testkammer an (weiße Wandpaneele, Lichtleisten, Beobachtungsfenster,
# zwei Portal-Ovale, ein Begleiter-Würfel mit Herz, Deckenhalterung für die Test-KI) und rendert über eine
# SceneCapture-Kamera mit derselben Perspektive wie die Blender-Räume (raum_build.py) in eine Render-Textur,
# die als PNG nach art/render/raum_testkammer_ue.png exportiert wird.
import unreal, math, os

REPO = REPO if 'REPO' in globals() else r'C:/Users/User/Documents/Tentakel-Toast'
LEVEL = '/Game/TentakelToast/Maps/L_TT_Testkammer'
MAT_DIR = '/Game/TentakelToast/Materials'
CM = 100.0   # Unreal rechnet in Zentimetern
# Kamera wie raum_build.py: Höhe 2,375 m, Horizont bei Spiel-y 185, Brennweite 3,78 halbe Bildhöhen
CAM_H, PHI, F = (432 - 185) / 104, math.atan(((220 - 185) / 220) / 3.78), 3.78
HFOV = math.degrees(2 * math.atan((960 / 440) / F))
EXPO = globals().get('EXPO', 0.0)   # Belichtungskorrektur in Blendenstufen

eal = unreal.EditorAssetLibrary
mel = unreal.MaterialEditingLibrary
at = unreal.AssetToolsHelpers.get_asset_tools()
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)


def flat_material():
    """Einfaches Material mit Farbe und Leuchten als Parameter (Instanzen je Farbe)."""
    path = MAT_DIR + '/M_TT_Flach'
    if eal.does_asset_exist(path):
        return eal.load_asset(path)
    m = at.create_asset('M_TT_Flach', MAT_DIR, unreal.Material, unreal.MaterialFactoryNew())
    col = mel.create_material_expression(m, unreal.MaterialExpressionVectorParameter, -600, 0)
    col.set_editor_property('parameter_name', 'Farbe')
    col.set_editor_property('default_value', unreal.LinearColor(1, 1, 1, 1))
    emi = mel.create_material_expression(m, unreal.MaterialExpressionScalarParameter, -600, 200)
    emi.set_editor_property('parameter_name', 'Leuchten')
    emi.set_editor_property('default_value', 0.0)
    rough = mel.create_material_expression(m, unreal.MaterialExpressionScalarParameter, -600, 320)
    rough.set_editor_property('parameter_name', 'Rauheit')
    rough.set_editor_property('default_value', 0.55)
    mul = mel.create_material_expression(m, unreal.MaterialExpressionMultiply, -300, 200)
    mel.connect_material_expressions(col, '', mul, 'A')
    mel.connect_material_expressions(emi, '', mul, 'B')
    mel.connect_material_property(col, '', unreal.MaterialProperty.MP_BASE_COLOR)
    mel.connect_material_property(mul, '', unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    mel.connect_material_property(rough, '', unreal.MaterialProperty.MP_ROUGHNESS)
    mel.recompile_material(m)
    eal.save_asset(path)
    return m


def mi(name, rgb, glow=0.0, rough=0.55):
    path = f'{MAT_DIR}/MI_TT_{name}'
    inst = eal.load_asset(path) if eal.does_asset_exist(path) else at.create_asset(f'MI_TT_{name}', MAT_DIR, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
    mel.set_material_instance_parent(inst, BASE)
    mel.set_material_instance_vector_parameter_value(inst, 'Farbe', unreal.LinearColor(*[(c / 255) ** 2.2 for c in rgb], 1))
    mel.set_material_instance_scalar_parameter_value(inst, 'Leuchten', glow)
    mel.set_material_instance_scalar_parameter_value(inst, 'Rauheit', rough)
    eal.save_asset(path)
    return inst


CUBE = unreal.load_asset('/Engine/BasicShapes/Cube.Cube')
CYL = unreal.load_asset('/Engine/BasicShapes/Cylinder.Cylinder')
SPH = unreal.load_asset('/Engine/BasicShapes/Sphere.Sphere')


def block(label, loc, size, mat, mesh=None, rot=(0, 0, 0)):
    """Quader (Mittelpunkt loc und Größe size in Metern; x rechts, y in die Tiefe, z hoch) als StaticMeshActor."""
    # Unreal: X vorwärts (Tiefe), Y rechts, Z hoch  ->  Spiel-x = Unreal-Y, Tiefe = Unreal-X
    a = eas.spawn_actor_from_object(mesh or CUBE, unreal.Vector(loc[1] * CM, loc[0] * CM, loc[2] * CM), unreal.Rotator(*rot))
    a.set_actor_label(label)
    a.set_actor_scale3d(unreal.Vector(size[1], size[0], size[2]))   # Grundkörper sind 1 m groß
    sm = a.get_component_by_class(unreal.StaticMeshComponent)
    sm.set_material(0, mat)
    return a


def light(label, cls, loc, rot=(0, 0, 0), intensity=10.0, color=(255, 255, 255), radius=None):
    a = eas.spawn_actor_from_class(cls, unreal.Vector(loc[1] * CM, loc[0] * CM, loc[2] * CM), unreal.Rotator(*rot))
    a.set_actor_label(label)
    c = a.light_component
    c.set_intensity(intensity)
    c.set_light_color(unreal.LinearColor(color[0] / 255, color[1] / 255, color[2] / 255, 1))
    if radius and hasattr(c, 'set_attenuation_radius'):
        c.set_attenuation_radius(radius * CM)
    return a


# ---------------------------------------------------------------- Level anlegen
if not eal.does_asset_exist(LEVEL):
    les.new_level(LEVEL)
else:
    les.load_level(LEVEL)
for a in eas.get_all_level_actors():
    if a.get_actor_label().startswith('TK_'):
        eas.destroy_actor(a)
BASE = flat_material()
WHITE, SEAM, FLOOR, DARK = mi('Paneel', (214, 218, 226), rough=0.35), mi('Fuge', (70, 74, 84)), mi('Boden', (78, 82, 96), rough=0.4), mi('Dunkel', (34, 36, 44))
STRIP, BLUE, ORANGE = mi('Leiste', (255, 250, 236), glow=2.0), mi('PortalBlau', (40, 140, 255), glow=1.6), mi('PortalOrange', (255, 120, 20), glow=1.6)
GLASS, WARM, PINK, CUBEG = mi('Fenster', (40, 52, 66), rough=0.08), mi('Warm', (255, 190, 110), glow=1.2), mi('Herz', (255, 90, 170), glow=0.6), mi('Wuerfel', (170, 176, 188), rough=0.3)
SIGN = mi('Schild', (240, 236, 220))

# Boden aus Platten (Lauffläche liegt 7,9 bis 12 m vor der Kamera), Rückwand bei 17 m, Seitenwände schräg
for i in range(-6, 7):
    for j in range(7):
        block(f'TK_Boden{i}_{j}', (i * 2.0, 6.0 + j * 2.0, -0.05), (1.96, 1.96, 0.1), FLOOR)
for i in range(-7, 8):
    for j in range(4):
        block(f'TK_Paneel{i}_{j}', (i * 1.6, 17.0, 0.8 + j * 1.6), (1.56, 0.2, 1.56), WHITE)
block('TK_Fugen', (0, 17.15, 3.2), (24, 0.1, 6.4), SEAM)
for k in (-1, 1):
    for j in range(4):
        for i in range(6):
            block(f'TK_Seite{k}_{i}_{j}', (k * 9.6, 6.9 + i * 2.0, 0.8 + j * 1.6), (0.2, 1.96, 1.56), WHITE)
block('TK_Decke', (0, 12.0, 6.5), (24, 12, 0.3), DARK)
for i in range(-3, 4):   # Lichtleisten an der Decke
    block(f'TK_Leiste{i}', (i * 2.8, 13.5, 6.32), (2.2, 0.25, 0.06), STRIP)
block('TK_Sockel', (0, 16.85, 0.12), (24, 0.12, 0.24), DARK)
# Beobachtungsfenster oben rechts mit warmem Licht dahinter
block('TK_FensterRahmen', (5.2, 16.88, 4.6), (3.6, 0.1, 1.6), DARK)
block('TK_Fenster', (5.2, 16.84, 4.6), (3.3, 0.06, 1.3), GLASS)
block('TK_FensterLicht', (5.2, 17.3, 4.6), (3.2, 0.1, 1.2), WARM)
# zwei Portal-Ovale an der Rückwand
for lab, x, mat in (('Blau', -5.6, BLUE), ('Orange', 1.2, ORANGE)):
    o = block(f'TK_Portal{lab}', (x, 16.86, 1.5), (1, 1, 1), mat, mesh=CYL)
    o.set_actor_rotation(unreal.Rotator(roll=0, pitch=90, yaw=0), False)   # Zylinderachse zur Kamera: flache Scheibe
    o.set_actor_scale3d(unreal.Vector(2.3, 1.25, 0.05))                     # hoch, schmal, dünn
# Begleiter-Würfel mit Herz
block('TK_Wuerfel', (-3.0, 13.4, 0.45), (0.9, 0.9, 0.9), CUBEG)
block('TK_Herz', (-3.0, 12.94, 0.45), (0.32, 0.04, 0.32), PINK, mesh=SPH)
# Schild "Der Kuchen kommt bald" an der Wand links
block('TK_Schild', (-6.2, 16.84, 3.6), (2.4, 0.06, 1.0), SIGN)
# Deckenhalterung für die Test-KI (das Spiel hängt sie rechts von der Mitte auf)
block('TK_Halterung', (2.4, 13.0, 6.2), (1.2, 1.2, 0.4), DARK, mesh=CYL)
# Licht
light('TK_Sonne', unreal.DirectionalLight, (0, 0, 10), rot=(0, -50, 25), intensity=2.5, color=(255, 246, 236))
light('TK_Fuell', unreal.PointLight, (0, 10.0, 5.0), intensity=8000, color=(220, 232, 255), radius=30)
light('TK_FuellLinks', unreal.PointLight, (-6.5, 12.0, 4.0), intensity=7000, color=(230, 236, 255), radius=26)
light('TK_FensterGlanz', unreal.PointLight, (5.2, 16.0, 4.6), intensity=6000, color=(255, 190, 110), radius=8)
sky = eas.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 800), unreal.Rotator(0, 0, 0))
sky.set_actor_label('TK_Himmelslicht')
sky.light_component.set_intensity(0.6)

# ---------------------------------------------------------------- Kamera und Aufnahme
rt_path = '/Game/TentakelToast/Textures/RT_TT_Testkammer'
rt = eal.load_asset(rt_path) if eal.does_asset_exist(rt_path) else at.create_asset('RT_TT_Testkammer', '/Game/TentakelToast/Textures', unreal.TextureRenderTarget2D, unreal.TextureRenderTargetFactoryNew())
rt.set_editor_property('size_x', 1920)
rt.set_editor_property('size_y', 880)
rt.set_editor_property('render_target_format', unreal.TextureRenderTargetFormat.RTF_RGBA8_SRGB)
cap = eas.spawn_actor_from_class(unreal.SceneCapture2D, unreal.Vector(0, 0, CAM_H * CM), unreal.Rotator(roll=0, pitch=-math.degrees(PHI), yaw=0))
cap.set_actor_label('TK_Kamera')
cc = cap.capture_component2d
cc.set_editor_property('fov_angle', HFOV)
cc.set_editor_property('texture_target', rt)
cc.set_editor_property('capture_source', unreal.SceneCaptureSource.SCS_FINAL_COLOR_LDR)
cc.set_editor_property('capture_every_frame', False)
pp = cc.get_editor_property('post_process_settings')   # feste Belichtung statt Augen-Anpassung
pp.set_editor_property('override_auto_exposure_method', True)
pp.set_editor_property('auto_exposure_method', unreal.AutoExposureMethod.AEM_MANUAL)
pp.set_editor_property('override_auto_exposure_bias', True)
pp.set_editor_property('auto_exposure_bias', EXPO)
pp.set_editor_property('override_bloom_intensity', True)
pp.set_editor_property('bloom_intensity', 0.25)
cc.set_editor_property('post_process_settings', pp)
cc.set_editor_property('post_process_blend_weight', 1.0)
cc.capture_scene()
out = REPO + '/art/render'
unreal.RenderingLibrary.export_render_target(unreal.EditorLevelLibrary.get_editor_world(), rt, out, 'raum_testkammer_ue')
les.save_current_level()
print('hfov', round(HFOV, 2), 'cam', round(CAM_H, 2), 'pitch', round(math.degrees(PHI), 2), 'export', os.listdir(out)[:50])
