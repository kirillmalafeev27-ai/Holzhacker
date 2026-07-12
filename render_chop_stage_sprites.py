import bpy
import os
from mathutils import Vector


ROOT = r"C:\Users\pc\Downloads\nature"
SOURCE = os.path.join(ROOT, "tree_chop_simulation.blend")
OUT = os.path.join(ROOT, "public", "assets", "forest_defense", "sprites")


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


bpy.ops.wm.open_mainfile(filepath=SOURCE)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 256
scene.render.resolution_y = 256
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
scene.view_settings.look = 'AgX - Medium High Contrast'
os.makedirs(OUT, exist_ok=True)

for obj in scene.objects:
    obj.hide_render = True

bpy.ops.object.light_add(type='AREA', location=(-4,-6,9))
key = bpy.context.object
key.name = '__SPRITE_KEY'
key.data.energy = 1050
key.data.size = 5
key.data.color = (1.0,0.58,0.28)
look_at(key, (0,0,3))

bpy.ops.object.light_add(type='AREA', location=(5,2,6))
fill = bpy.context.object
fill.name = '__SPRITE_FILL'
fill.data.energy = 600
fill.data.size = 4
fill.data.color = (0.24,0.52,1.0)
look_at(fill, (0,0,3))

bpy.ops.object.camera_add(location=(8,-12,7))
camera = bpy.context.object
camera.name = '__SPRITE_CAMERA'
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 8.1
look_at(camera, (0,0,3.1))
scene.camera = camera

stages = [
    ('tree_stage_0', 30, ['TREE_STATE_00_INTACT']),
    ('tree_stage_25', 42, ['TREE_STATE_25_BOOLEAN_CUT']),
    ('tree_stage_50', 64, ['TREE_STATE_50_BOOLEAN_CUT']),
    ('tree_stage_75', 86, ['TREE_STATE_75_BOOLEAN_CUT']),
    ('tree_stage_90', 106, ['TREE_STATE_90_BOOLEAN_CUT']),
    ('tree_stage_fallen', 144, ['TREE_STUMP__final_boolean_cut', 'TREE_CROWN__falling_boolean_cut']),
]

tree_names = {name for _label, _frame, names in stages for name in names}
for label, frame, names in stages:
    scene.frame_set(frame)
    for obj in scene.objects:
        if obj.name in tree_names:
            obj.hide_render = True
    for name in names:
        obj = bpy.data.objects[name]
        obj.hide_render = False
        obj.hide_viewport = False
    key.hide_render = fill.hide_render = camera.hide_render = False
    scene.render.filepath = os.path.join(OUT, label + '.png')
    bpy.ops.render.render(write_still=True)
    print(f'RENDERED_CHOP_STAGE={label}')

