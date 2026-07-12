from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "public" / "assets" / "forest_defense" / "first_person"
OUT = ROOT / "docs"


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def import_glb(name):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ASSETS / name))
    return [obj for obj in bpy.context.scene.objects if obj not in before]


bpy.ops.wm.read_factory_settings(use_empty=True)
world_objects = import_glb("first_person_world.glb")
fort_objects = import_glb("fort_stage_3.glb")

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.look = "AgX - Medium High Contrast"
world = scene.world or bpy.data.worlds.new("PreviewWorld")
scene.world = world
world.use_nodes = True
background = next(node for node in world.node_tree.nodes if node.type == "BACKGROUND")
background.inputs["Color"].default_value = (.055, .085, .078, 1)
background.inputs["Strength"].default_value = .45

bpy.ops.object.light_add(type="SUN", location=(-25, -30, 50))
sun = bpy.context.object
sun.rotation_euler = (.58, -.36, -.64)
sun.data.energy = 2.35
sun.data.color = (1.0, .73, .42)
bpy.ops.object.light_add(type="AREA", location=(22, -18, 24))
fill = bpy.context.object
fill.data.energy = 1700
fill.data.size = 28
fill.data.color = (.28, .48, .78)
look_at(fill, (0, 0, 2.5))
bpy.ops.object.light_add(type="AREA", location=(0, -18, 12))
front = bpy.context.object
front.data.energy = 1150
front.data.size = 18
front.data.color = (1.0, .58, .30)
look_at(front, (0, -8, 2.8))

bpy.ops.object.camera_add(location=(0, -18, 2.05))
camera = bpy.context.object
camera.data.type = "PERSP"
camera.data.lens = 27
scene.camera = camera

look_at(camera, (0, -9, 2.7))
scene.render.filepath = str(OUT / "first_person_fort_outside.png")
bpy.ops.render.render(write_still=True)

camera.location = (-2.5, -5.8, 2.05)
look_at(camera, (3.8, 3.0, 5.0))
scene.render.filepath = str(OUT / "first_person_fort_inside.png")
bpy.ops.render.render(write_still=True)

# A clean lineup verifies the custom gameplay silhouettes and materials.
for obj in world_objects + fort_objects:
    bpy.data.objects.remove(obj, do_unlink=True)
lineup = []
for filename, x in (("goblin.glb", -2.2), ("catapult_intact.glb", 1.2), ("catapult_destroyed.glb", 5.3)):
    objects = import_glb(filename)
    for obj in objects:
        obj.location.x += x
    lineup.extend(objects)

bpy.ops.mesh.primitive_plane_add(size=30, location=(1.5, 0, -.05))
ground = bpy.context.object
mat = bpy.data.materials.new("LineupGround")
mat.diffuse_color = (.16, .25, .095, 1)
ground.data.materials.append(mat)
camera.location = (1.5, -11.5, 4.3)
look_at(camera, (1.5, 0, 1.3))
scene.render.filepath = str(OUT / "first_person_gameplay_models.png")
bpy.ops.render.render(write_still=True)
print("RENDERED_FIRST_PERSON_ASSET_PREVIEWS")
