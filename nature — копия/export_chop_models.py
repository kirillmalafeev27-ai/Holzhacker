from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "tree_chop_simulation.blend"
OUT = ROOT / "public" / "assets" / "forest_defense" / "chop"
OUT.mkdir(parents=True, exist_ok=True)


def evaluated_copy(source, name):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = source.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
    duplicate = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(duplicate)
    duplicate.matrix_world = evaluated.matrix_world.copy()
    return duplicate


def export_selected(filepath, objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_viewport = False
        obj.hide_render = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(filepath),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_animations=False,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
    )
    for obj in objects:
        bpy.data.objects.remove(obj, do_unlink=True)


bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene

stages = [
    ("tree_stage_0.glb", 30, [("TREE_STATE_00_INTACT", "TreeStage00")]),
    ("tree_stage_25.glb", 42, [("TREE_STATE_25_BOOLEAN_CUT", "TreeStage25")]),
    ("tree_stage_50.glb", 64, [("TREE_STATE_50_BOOLEAN_CUT", "TreeStage50")]),
    ("tree_stage_75.glb", 86, [("TREE_STATE_75_BOOLEAN_CUT", "TreeStage75")]),
    ("tree_stage_90.glb", 106, [("TREE_STATE_90_BOOLEAN_CUT", "TreeStage90")]),
    ("tree_stage_fallen.glb", 144, [
        ("TREE_STUMP__final_boolean_cut", "TreeStump"),
        ("TREE_CROWN__falling_boolean_cut", "TreeCrownFallen"),
    ]),
]

for filename, frame, names in stages:
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    exported = [evaluated_copy(bpy.data.objects[source], target) for source, target in names]
    export_selected(OUT / filename, exported)
    print(f"EXPORTED_CHOP_MODEL={filename}")

# The original animated axe is reused as the first-person held item.
scene.frame_set(30)
bpy.context.view_layer.update()
axe = [
    evaluated_copy(bpy.data.objects["Axe_Handle"], "AxeHandle"),
    evaluated_copy(bpy.data.objects["Axe_Head"], "AxeHead"),
]
corners = []
for obj in axe:
    corners.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
center = Vector((
    (min(v.x for v in corners) + max(v.x for v in corners)) * .5,
    (min(v.y for v in corners) + max(v.y for v in corners)) * .5,
    min(v.z for v in corners),
))
for obj in axe:
    obj.matrix_world.translation -= center
export_selected(OUT / "first_person_axe.glb", axe)
print("EXPORTED_CHOP_MODEL=first_person_axe.glb")
