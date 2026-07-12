from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "public" / "assets" / "forest_defense" / "first_person" / "first_person_world.blend"
OUT = ROOT / "docs"


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.look = "AgX - Medium High Contrast"

world = scene.world or bpy.data.worlds.new("FirstPersonWorld")
scene.world = world
world.use_nodes = True
background = next((node for node in world.node_tree.nodes if node.type == "BACKGROUND"), None)
if background is None:
    background = world.node_tree.nodes.new("ShaderNodeBackground")
background.inputs["Color"].default_value = (.055, .09, .095, 1)
background.inputs["Strength"].default_value = .42

for obj in list(scene.objects):
    if obj.type in {"CAMERA", "LIGHT"}:
        bpy.data.objects.remove(obj, do_unlink=True)

bpy.ops.object.light_add(type="SUN", location=(-20, -30, 55))
sun = bpy.context.object
sun.rotation_euler = (.58, -.36, -.62)
sun.data.energy = 2.25
sun.data.color = (1.0, .73, .42)

bpy.ops.object.light_add(type="AREA", location=(18, -15, 28))
fill = bpy.context.object
fill.data.energy = 1550
fill.data.size = 30
fill.data.color = (.28, .49, .78)
look_at(fill, (0, 0, 0))

bpy.ops.object.camera_add(location=(64, -78, 70))
camera = bpy.context.object
camera.data.type = "ORTHO"
camera.data.ortho_scale = 112
look_at(camera, (0, 0, 0))
scene.camera = camera
scene.render.filepath = str(OUT / "first_person_world_aerial.png")
bpy.ops.render.render(write_still=True)

camera.data.type = "PERSP"
camera.data.lens = 28
camera.location = (0, -15, 2.15)
look_at(camera, (0, 1.5, 1.6))
scene.render.filepath = str(OUT / "first_person_world_ground.png")
bpy.ops.render.render(write_still=True)
print("RENDERED_FIRST_PERSON_WORLD_PREVIEWS")
