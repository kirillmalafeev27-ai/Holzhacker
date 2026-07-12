from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "public" / "assets" / "forest_defense" / "forest_defense_location.blend"
OUTPUT = ROOT / "docs" / "forest_defense_location_preview.png"


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.film_transparent = False
scene.render.filepath = str(OUTPUT)
scene.view_settings.look = "AgX - Medium High Contrast"

world = scene.world or bpy.data.worlds.new("ForestWorld")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.055, 0.085, 0.075, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.38

for obj in list(scene.objects):
    if obj.type in {"CAMERA", "LIGHT"}:
        bpy.data.objects.remove(obj, do_unlink=True)

bpy.ops.object.light_add(type="AREA", location=(-28, -34, 52))
key = bpy.context.object
key.name = "Preview_Key"
key.data.energy = 2200
key.data.size = 28
key.data.color = (1.0, 0.72, 0.42)
look_at(key, (0, 0, 0))

bpy.ops.object.light_add(type="AREA", location=(28, 12, 30))
fill = bpy.context.object
fill.name = "Preview_Fill"
fill.data.energy = 1300
fill.data.size = 24
fill.data.color = (0.32, 0.52, 0.82)
look_at(fill, (0, 0, 2))

bpy.ops.object.light_add(type="SUN", location=(0, 0, 40))
sun = bpy.context.object
sun.name = "Preview_Sun"
sun.rotation_euler = (0.55, -0.35, -0.55)
sun.data.energy = 1.8
sun.data.color = (1.0, 0.78, 0.50)

bpy.ops.object.camera_add(location=(64, -79, 72))
camera = bpy.context.object
camera.name = "Preview_Camera"
camera.data.type = "ORTHO"
camera.data.ortho_scale = 94
look_at(camera, (0, 0, 0))
scene.camera = camera

scene.render.image_settings.file_format = "PNG"
bpy.ops.render.render(write_still=True)
print(f"LOCATION_PREVIEW={OUTPUT}")
