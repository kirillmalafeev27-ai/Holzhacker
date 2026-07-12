from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "public" / "assets" / "forest_defense" / "first_person"
OUT = ROOT / "docs"


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def import_glb(filename):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ASSETS / filename))
    return [obj for obj in bpy.context.scene.objects if obj not in before]


def make_debug_material():
    mat = bpy.data.materials.new("NavmeshPreviewGreen")
    mat.diffuse_color = (.02, .95, .28, .58)
    mat.use_nodes = True
    bsdf = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (.01, .82, .17, 1)
    bsdf.inputs["Emission Color"].default_value = (.01, .42, .08, 1)
    bsdf.inputs["Emission Strength"].default_value = 1.8
    bsdf.inputs["Alpha"].default_value = .56
    mat.surface_render_method = "DITHERED"
    return mat


def setup_scene():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = scene.world or bpy.data.worlds.new("NavPreviewWorld")
    scene.world = world
    world.use_nodes = True
    background = next(node for node in world.node_tree.nodes if node.type == "BACKGROUND")
    background.inputs["Color"].default_value = (.035, .06, .05, 1)
    background.inputs["Strength"].default_value = .38
    bpy.ops.object.light_add(type="SUN", location=(-25, -30, 50))
    sun = bpy.context.object
    sun.rotation_euler = (.58, -.36, -.64)
    sun.data.energy = 2.1
    sun.data.color = (1.0, .72, .40)
    bpy.ops.object.camera_add(location=(55, -68, 67))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 104
    look_at(camera, (0, 0, 0))
    scene.camera = camera
    return scene


for nav_name, fort_name, output in (
    ("navmesh_stage_0.glb", None, "navmesh_stage_0_preview.png"),
    ("navmesh_stage_3_closed.glb", "fort_stage_3.glb", "navmesh_stage_3_closed_preview.png"),
):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    import_glb("first_person_world.glb")
    if fort_name:
        import_glb(fort_name)
    nav_objects = import_glb(nav_name)
    debug = make_debug_material()
    for obj in nav_objects:
        if obj.type == "MESH":
            obj.data.materials.clear()
            obj.data.materials.append(debug)
            obj.location.z += .12
    scene = setup_scene()
    scene.render.filepath = str(OUT / output)
    bpy.ops.render.render(write_still=True)
    print(f"RENDERED_NAV_PREVIEW={output}")
