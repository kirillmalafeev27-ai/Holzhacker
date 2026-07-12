from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parent
GLB = ROOT / "public" / "assets" / "forest_defense" / "forest_defense_location.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)
result = bpy.ops.import_scene.gltf(filepath=str(GLB))
if "FINISHED" not in result:
    raise RuntimeError(f"Failed to reopen {GLB}: {result}")

objects = list(bpy.context.scene.objects)
markers = sorted(obj.name for obj in objects if any(token in obj.name for token in (
    "Spawn", "BuildZone", "RepairZone", "FortGate", "Watchtower", "NoteDropZone"
)))
mesh_count = sum(obj.type == "MESH" for obj in objects)
material_count = len(bpy.data.materials)
tree_count = sum("Tree" in obj.name or "tree" in obj.name for obj in objects)
required = {
    "PlayerSpawn", "BuildZone", "RepairZone", "FortGate", "Watchtower",
    "GoblinSpawn_A", "GoblinSpawn_B", "GoblinSpawn_C",
    "CatapultSpawn_A", "CatapultSpawn_B", "CatapultSpawn_C",
}
missing = sorted(name for name in required if not any(obj.name.startswith(name) for obj in objects))
if mesh_count < 40:
    raise RuntimeError(f"Unexpectedly sparse location: only {mesh_count} meshes")
if missing:
    raise RuntimeError(f"Missing gameplay markers: {missing}")

print(f"GLB_REOPEN_OK objects={len(objects)} meshes={mesh_count} materials={material_count} trees={tree_count}")
print("MARKERS=" + ",".join(markers))
