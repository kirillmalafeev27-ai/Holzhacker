from __future__ import annotations

import math
from collections import defaultdict, deque
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "public" / "assets" / "forest_defense" / "first_person"
CHOP = ROOT / "public" / "assets" / "forest_defense" / "chop"


def fresh_import(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    result = bpy.ops.import_scene.gltf(filepath=str(path))
    if "FINISHED" not in result:
        raise RuntimeError(f"Failed to import {path}: {result}")
    return list(bpy.context.scene.objects)


def clean_name(name):
    return name.rsplit(".", 1)[0] if name.rsplit(".", 1)[-1].isdigit() else name


def connected_components(mesh):
    edge_faces = defaultdict(list)
    def point_key(vertex_index):
        point = mesh.vertices[vertex_index].co
        return (round(point.x, 4), round(point.y, 4), round(point.z, 4))
    for poly in mesh.polygons:
        vertices = list(poly.vertices)
        for index, vertex in enumerate(vertices):
            edge = tuple(sorted((point_key(vertex), point_key(vertices[(index + 1) % len(vertices)]))))
            edge_faces[edge].append(poly.index)
    adjacency = defaultdict(set)
    for faces in edge_faces.values():
        for a in faces:
            adjacency[a].update(face for face in faces if face != a)
    unseen = set(range(len(mesh.polygons)))
    components = []
    while unseen:
        start = unseen.pop()
        queue = deque([start])
        component = {start}
        while queue:
            face = queue.popleft()
            for neighbor in adjacency[face]:
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    component.add(neighbor)
                    queue.append(neighbor)
        components.append(component)
    return sorted((len(component) for component in components), reverse=True)


def stream_center(y):
    return -28.2 + math.sin(y * .085) * 2.3 + y * .035


def inspect_nav(filename, expected_components):
    objects = fresh_import(ASSETS / filename)
    meshes = [obj for obj in objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f"{filename}: expected 1 mesh, found {len(meshes)}")
    obj = meshes[0]
    components = connected_components(obj.data)
    meaningful = [size for size in components if size >= 4]
    if len(meaningful) != expected_components:
        raise RuntimeError(f"{filename}: components={meaningful}, expected={expected_components}")
    water_violations = 0
    for polygon in obj.data.polygons:
        center = obj.matrix_world @ polygon.center
        in_water = abs(center.x - stream_center(center.y)) < 3.0
        on_bridge = abs(center.y + 7) < 2.25
        if in_water and not on_bridge:
            water_violations += 1
    if water_violations:
        raise RuntimeError(f"{filename}: {water_violations} faces cross non-walkable water")
    print(f"NAV_OK {filename} faces={len(obj.data.polygons)} components={meaningful}")


def require_names(filename, patterns):
    objects = fresh_import(ASSETS / filename)
    names = [clean_name(obj.name) for obj in objects]
    missing = [pattern for pattern in patterns if not any(pattern in name for name in names)]
    if missing:
        raise RuntimeError(f"{filename}: missing {missing}")
    meshes = sum(obj.type == "MESH" for obj in objects)
    materials = len(bpy.data.materials)
    print(f"ASSET_OK {filename} objects={len(objects)} meshes={meshes} materials={materials}")


def inspect_world():
    objects = fresh_import(ASSETS / "first_person_world.glb")
    names = [clean_name(obj.name) for obj in objects]
    counts = {
        "trees": sum("ForestTree_" in name for name in names),
        "rocks": sum("RockCluster_" in name for name in names),
        "undergrowth": sum("Undergrowth_" in name for name in names),
        "clearing": sum("ClearingDetail_" in name for name in names),
        "turf": sum("TurfPatch_" in name for name in names),
        "stakes": sum("ConstructionStake_" in name for name in names),
    }
    minimums = {"trees": 160, "rocks": 45, "undergrowth": 250, "clearing": 85, "turf": 24, "stakes": 16}
    failures = {key: value for key, value in counts.items() if value < minimums[key]}
    if failures:
        raise RuntimeError(f"World density too low: {failures}")
    required = ["WorldTerrain", "ForestStream", "StreamBridge", "PlayerSpawn", "BuildZone", "ChoppableTreeSpawn_01"]
    missing = [name for name in required if not any(name in candidate for candidate in names)]
    if missing:
        raise RuntimeError(f"World missing {missing}")
    print("WORLD_OK " + " ".join(f"{key}={value}" for key, value in counts.items()))


def inspect_chop():
    for filename in (
        "tree_stage_0.glb", "tree_stage_25.glb", "tree_stage_50.glb",
        "tree_stage_75.glb", "tree_stage_90.glb", "tree_stage_fallen.glb",
        "first_person_axe.glb",
    ):
        objects = fresh_import(CHOP / filename)
        mesh_count = sum(obj.type == "MESH" for obj in objects)
        if mesh_count < 1:
            raise RuntimeError(f"{filename}: no mesh")
        print(f"CHOP_OK {filename} meshes={mesh_count}")


inspect_world()
inspect_nav("navmesh_stage_0.glb", 1)
inspect_nav("navmesh_stage_1.glb", 1)
inspect_nav("navmesh_stage_2.glb", 1)
inspect_nav("navmesh_stage_3_open.glb", 1)
inspect_nav("navmesh_stage_3_closed.glb", 2)
require_names("fort_stage_3.glb", [
    "PalisadePost", "PalisadeRope", "PalisadeBrace", "GateLeftPivot", "GateRightPivot",
    "TowerLadder", "TowerPlatform", "TowerRoof", "TowerStone", "Workshop", "Storehouse",
    "RepairBench", "GateTorch",
])
require_names("catapult_intact.glb", ["Wheel", "FrameLeft", "ThrowingArm", "Bucket", "Rope", "LoadedStone"])
require_names("catapult_destroyed.glb", ["BrokenArm", "Splinter", "Wheel"])
require_names("goblin.glb", ["GoblinHead", "GoblinEar", "GoblinHelmet", "GoblinClub", "GoblinEye"])
require_names("first_person_arms.glb", ["Arm_-1_Sleeve", "Arm_1_Sleeve", "Bracer", "Hand"])
inspect_chop()
print("FIRST_PERSON_ASSET_AUDIT_OK")
