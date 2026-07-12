from __future__ import annotations

import math
import os
import random
from collections import defaultdict, deque
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "GLTF format"
OUT = ROOT / "public" / "assets" / "forest_defense" / "first_person"
OUT.mkdir(parents=True, exist_ok=True)
random.seed(948271)
TAU = math.tau

# These trees use the preserved authored chopping stages (0/25/50/75/fall).
# Keeping them inside the readable clearing makes every required construction
# run completable without converting the existing spruce assets.
CHOP_POSITIONS = [
    (-16, -9), (16, -10), (18, 7), (-18, 11), (11, 17), (-12, 17),
    (18, -3), (-17, -14), (14, 13), (19, -13), (-11, -18), (8, -19),
]


def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_material(name, color, roughness=.82, metallic=0.0, alpha=1.0, emission=None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, alpha)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if alpha < 1:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.surface_render_method = "DITHERED"
        mat.diffuse_color = (*color, alpha)
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = 1.2
    return mat


def import_glb(path: Path, name: str):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.context.scene.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"No mesh in {path}")
    if len(meshes) > 1:
        bpy.ops.object.select_all(action="DESELECT")
        for obj in meshes:
            if obj.parent:
                world = obj.matrix_world.copy()
                obj.parent = None
                obj.matrix_world = world
            obj.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.join()
        result = bpy.context.object
    else:
        result = meshes[0]
    if result.parent:
        world = result.matrix_world.copy()
        result.parent = None
        result.matrix_world = world
    for obj in imported:
        if obj != result and obj.name in bpy.data.objects:
            try:
                bpy.data.objects.remove(obj, do_unlink=True)
            except ReferenceError:
                pass
    result.name = name
    result.hide_render = True
    result.hide_viewport = True
    return result


def clone(master, name, location, scale=1.0, rotation=0.0, collection=None):
    obj = master.copy()
    obj.data = master.data
    obj.name = name
    (collection or bpy.context.scene.collection).objects.link(obj)
    obj.location = location
    obj.scale = (scale, scale, scale)
    obj.rotation_euler.z = rotation
    obj.hide_render = False
    obj.hide_viewport = False
    obj.hide_set(False)
    return obj


def stream_center(z):
    return -28.2 + math.sin(z * .085) * 2.3 + z * .035


def clearing_blend(x, z):
    r = math.hypot(x / 1.08, z)
    return max(0.0, min(1.0, (r - 18.0) / 8.0))


def terrain_height(x, z):
    broad = .55 * math.sin(x * .072) + .38 * math.cos(z * .091) + .22 * math.sin((x + z) * .14)
    hills = .00082 * max(0, math.hypot(x, z) - 23) ** 2
    natural = broad + hills
    flat = .08 * math.sin(x * .22) * math.cos(z * .18)
    base = flat * (1 - clearing_blend(x, z)) + natural * clearing_blend(x, z)
    water_distance = abs(x - stream_center(z))
    trench = 1.45 * math.exp(-((water_distance / 3.2) ** 2))
    return base - trench


def build_terrain():
    size = 52
    step = 2.0
    count = int(size * 2 / step) + 1
    vertices = []
    for zi in range(count):
        z = -size + zi * step
        for xi in range(count):
            x = -size + xi * step
            vertices.append((x, z, terrain_height(x, z)))
    faces, material_indices = [], []
    for zi in range(count - 1):
        for xi in range(count - 1):
            a = zi * count + xi
            faces.extend([(a, a + 1, a + count + 1), (a, a + count + 1, a + count)])
            x, z = -size + (xi + .5) * step, -size + (zi + .5) * step
            r = math.hypot(x / 1.08, z)
            water_dist = abs(x - stream_center(z))
            path_width = 2.8 + max(0, (-z - 16) * .018)
            on_path = z < -13 and abs(x - math.sin((z + 13) * .07) * 1.2) < path_width
            if water_dist < 4.6:
                index = 3
            elif on_path:
                index = 2
            elif r < 20.5:
                index = 1
            else:
                index = 0
            material_indices.extend([index, index])
    mesh = bpy.data.meshes.new("WorldTerrain_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(make_material("ForestGrass", (.19, .34, .095), .94))
    mesh.materials.append(make_material("ClearingEarth", (.39, .25, .095), .97))
    mesh.materials.append(make_material("PackedPath", (.50, .33, .13), .98))
    mesh.materials.append(make_material("DampBank", (.16, .215, .11), .90))
    for polygon, index in zip(mesh.polygons, material_indices):
        polygon.material_index = index
    terrain = bpy.data.objects.new("WorldTerrain", mesh)
    terrain["collision"] = "terrain"
    bpy.context.scene.collection.objects.link(terrain)
    return terrain


def build_stream():
    vertices, faces = [], []
    segments = 56
    for i in range(segments + 1):
        z = -50 + i / segments * 100
        center = stream_center(z)
        width = 2.15 + .35 * math.sin(z * .17)
        water_z = terrain_height(center, z) + .72
        vertices.extend([(center - width, z, water_z), (center + width, z, water_z)])
        if i < segments:
            a = i * 2
            faces.append((a, a + 1, a + 3, a + 2))
    mesh = bpy.data.meshes.new("ForestStream_Mesh")
    mesh.from_pydata(vertices, [], faces)
    water_mat = make_material("StreamWater", (.055, .30, .38), .24, metallic=.05, alpha=.78)
    mesh.materials.append(water_mat)
    water = bpy.data.objects.new("ForestStream", mesh)
    water["collision"] = "water"
    bpy.context.scene.collection.objects.link(water)
    return water


def build_turf_patches():
    turf = make_material("ClearingTurf", (.245, .39, .105), .96)
    for index in range(32):
        angle = random.random() * TAU
        radius = random.uniform(11.5, 20.2)
        x, z = math.cos(angle) * radius, math.sin(angle) * radius
        patch_radius = random.uniform(.7, 2.4)
        segments = random.randint(7, 11)
        vertices = [(x, z, terrain_height(x, z) + .035)]
        for segment in range(segments):
            a = segment / segments * TAU
            local_radius = patch_radius * random.uniform(.68, 1.22)
            px, pz = x + math.cos(a) * local_radius, z + math.sin(a) * local_radius
            vertices.append((px, pz, terrain_height(px, pz) + .045))
        faces = [(0, segment + 1, ((segment + 1) % segments) + 1) for segment in range(segments)]
        mesh = bpy.data.meshes.new(f"TurfPatch_{index:02d}_Mesh")
        mesh.from_pydata(vertices, [], faces)
        mesh.materials.append(turf)
        obj = bpy.data.objects.new(f"TurfPatch_{index:02d}", mesh)
        bpy.context.scene.collection.objects.link(obj)


def cylinder_between(name, start, end, radius, mat, vertices=8):
    start_v, end_v = Vector(start), Vector(end)
    midpoint = (start_v + end_v) * .5
    direction = end_v - start_v
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=direction.length, location=midpoint)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    return obj


def build_construction_markers():
    wood = make_material("SurveyStakeWood", (.31, .14, .055), .93)
    rope = make_material("SurveyRope", (.48, .31, .12), .91)
    count = 18
    positions = []
    for index in range(count):
        angle = index / count * TAU
        x, z = math.cos(angle) * 10.2, math.sin(angle) * 10.2
        ground = terrain_height(x, z)
        bpy.ops.mesh.primitive_cone_add(
            vertices=7, radius1=.12, radius2=.035, depth=1.25,
            location=(x, z, ground + .625), rotation=(0, 0, angle),
        )
        stake = bpy.context.object
        stake.name = f"ConstructionStake_{index:02d}"
        stake.data.materials.append(wood)
        positions.append(Vector((x, z, ground + .34)))
    for index, start in enumerate(positions):
        end = positions[(index + 1) % count]
        # Keep a clear southern entrance in the planning ring.
        midpoint_angle = math.atan2((start.y + end.y) * .5, (start.x + end.x) * .5)
        if abs(math.atan2(math.sin(midpoint_angle + math.pi / 2), math.cos(midpoint_angle + math.pi / 2))) < .27:
            continue
        mid = (start + end) * .5
        mid.z -= .085
        cylinder_between(f"ConstructionRope_{index:02d}_A", start, mid, .018, rope, 7)
        cylinder_between(f"ConstructionRope_{index:02d}_B", mid, end, .018, rope, 7)


def add_marker(name, position, marker_type):
    marker = bpy.data.objects.new(name, None)
    marker.location = position
    marker.empty_display_type = "PLAIN_AXES"
    marker.empty_display_size = .8
    marker["markerType"] = marker_type
    bpy.context.scene.collection.objects.link(marker)


def point_clear(x, z, radius=0):
    r = math.hypot(x, z)
    if r < 22 + radius:
        return False
    if abs(x - stream_center(z)) < 5.2 + radius:
        return False
    if z < -13 and abs(x - math.sin((z + 13) * .07) * 1.2) < 4.8 + radius:
        return False
    return r < 49


def scatter_environment():
    masters = {}
    files = {
        "pine_a": "tree_pineTallA_detailed.glb", "pine_b": "tree_pineTallB_detailed.glb",
        "pine_c": "tree_pineTallC.glb", "pine_d": "tree_pineTallD.glb",
        "pine_small_a": "tree_pineSmallA.glb", "pine_small_b": "tree_pineSmallB.glb",
        "pine_round": "tree_pineRoundC.glb", "bush": "plant_bushDetailed.glb",
        "bush_large": "plant_bushLarge.glb", "fern": "grass_leafsLarge.glb",
        "grass": "grass_large.glb", "flower_y": "flower_yellowB.glb",
        "flower_p": "flower_purpleC.glb", "flower_r": "flower_redA.glb",
        "rock_a": "rock_largeA.glb", "rock_b": "rock_largeD.glb",
        "rock_c": "rock_smallC.glb", "rock_d": "rock_smallFlatB.glb",
        "stump": "stump_roundDetailed.glb", "stump_old": "stump_oldTall.glb",
        "log": "log_large.glb", "log_stack": "log_stackLarge.glb",
        "bridge": "bridge_woodRoundNarrow.glb", "campfire": "campfire_stones.glb",
    }
    for key, filename in files.items():
        masters[key] = import_glb(ASSETS / filename, f"_MASTER_{key}")

    obstacles = []
    tree_keys = ["pine_a", "pine_b", "pine_c", "pine_d", "pine_small_a", "pine_small_b", "pine_round"]
    tree_count = 0
    attempts = 0
    while tree_count < 175 and attempts < 4000:
        attempts += 1
        angle = random.random() * TAU
        radius = math.sqrt(random.random() * (49 ** 2 - 22 ** 2) + 22 ** 2)
        x, z = math.cos(angle) * radius, math.sin(angle) * radius
        if not point_clear(x, z, .2):
            continue
        if any(math.hypot(x - ox, z - oz) < 2.0 for ox, oz, _ in obstacles):
            continue
        key = random.choices(tree_keys, weights=[18, 16, 13, 12, 15, 14, 10])[0]
        small = "small" in key or key == "pine_round"
        scale = random.uniform(3.7, 5.8) if small else random.uniform(6.3, 9.2)
        y = terrain_height(x, z)
        obj = clone(masters[key], f"ForestTree_{tree_count:03d}", (x, z, y), scale, random.random() * TAU)
        obj["collisionRadius"] = .65 if small else .9
        obj["kind"] = "forestTree"
        obstacles.append((x, z, .65 if small else .9))
        tree_count += 1

    # Natural rock clusters with reusable variants.
    rock_count = 0
    for _ in range(1100):
        if rock_count >= 54:
            break
        angle = random.random() * TAU
        radius = random.uniform(20, 48)
        x, z = math.cos(angle) * radius, math.sin(angle) * radius
        if not point_clear(x, z, .3) or any(math.hypot(x - ox, z - oz) < rr + 1.2 for ox, oz, rr in obstacles):
            continue
        key = random.choice(["rock_a", "rock_b", "rock_c", "rock_d"])
        large = key in {"rock_a", "rock_b"}
        scale = random.uniform(1.1, 2.5) if large else random.uniform(.65, 1.35)
        y = terrain_height(x, z)
        obj = clone(masters[key], f"RockCluster_{rock_count:03d}", (x, z, y), scale, random.random() * TAU)
        obj["collisionRadius"] = scale * (.75 if large else .38)
        obj["kind"] = "rock"
        if large:
            obstacles.append((x, z, scale * .65))
        rock_count += 1

    # Dense undergrowth, deliberately grouped around the forest edge.
    for index in range(330):
        angle = random.random() * TAU
        radius = random.uniform(19, 49)
        x, z = math.cos(angle) * radius, math.sin(angle) * radius
        if abs(x - stream_center(z)) < 3.2:
            key = random.choice(["fern", "bush", "grass"])
        else:
            key = random.choices(["grass", "fern", "bush", "bush_large", "flower_y", "flower_p", "flower_r"], [34, 22, 15, 8, 7, 7, 7])[0]
        if not point_clear(x, z, -.4):
            continue
        scale = random.uniform(.45, 1.35) * (1.25 if key == "bush_large" else 1)
        clone(masters[key], f"Undergrowth_{index:03d}", (x, z, terrain_height(x, z)), scale, random.random() * TAU)

    # Foreground detail around the future fort footprint, while keeping its
    # core and movement lanes free for construction.
    for index in range(105):
        angle = random.random() * TAU
        radius = random.uniform(11.2, 21.2)
        x, z = math.cos(angle) * radius, math.sin(angle) * radius
        key = random.choices(
            ["grass", "fern", "flower_y", "flower_p", "flower_r", "rock_c", "rock_d"],
            [33, 22, 10, 8, 8, 9, 10],
        )[0]
        scale = random.uniform(.34, .92)
        clone(masters[key], f"ClearingDetail_{index:03d}", (x, z, terrain_height(x, z) + .02), scale, random.random() * TAU)

    # Fallen timber, stumps and work-site storytelling.
    detail_positions = [
        (-18, -15, "stump", 1.5), (18, -17, "stump_old", 1.25), (-20, 14, "log", 1.5),
        (22, 15, "log", 1.35), (-13, 21, "stump", 1.15), (16, 23, "log_stack", 1.65),
        (-9, -19, "log_stack", 1.5), (6, 18, "stump_old", 1.0),
    ]
    for index, (x, z, key, scale) in enumerate(detail_positions):
        obj = clone(masters[key], f"ForestDetail_{index:02d}", (x, z, terrain_height(x, z)), scale, random.random() * TAU)
        obj["kind"] = "forestDetail"

    # Bridge is the only walkable crossing over the stream.
    bx, bz = stream_center(-7), -7
    bridge = clone(masters["bridge"], "StreamBridge", (bx, bz, terrain_height(bx, bz) + .8), 2.4, math.pi / 2)
    bridge["collision"] = "bridge"
    # Initial construction site is detailed but still open.
    clone(masters["campfire"], "OldCampfireRing", (0, 2.5, terrain_height(0, 2.5)), 1.35, .3)
    clone(masters["log_stack"], "BuildMaterials_A", (-5.5, -3.5, terrain_height(-5.5, -3.5)), 1.7, .4)
    clone(masters["log_stack"], "BuildMaterials_B", (5.8, -2.4, terrain_height(5.8, -2.4)), 1.4, -1.0)

    for master in masters.values():
        bpy.data.objects.remove(master, do_unlink=True)
    return obstacles


def build_navmesh(name, obstacles, base_stage=0, gate_open=False):
    extent, step = 47, 1.75
    coords = []
    value = -extent
    while value <= extent + .001:
        coords.append(value)
        value += step
    vertices = [(x, z, terrain_height(x, z) + .08) for z in coords for x in coords]
    width = len(coords)
    faces = []

    def wall_blocks(x, z):
        if base_stage == 0:
            return False
        r = math.hypot(x, z)
        if not 9.0 < r < 11.2:
            return False
        angle = (math.atan2(z, x) + TAU) % TAU
        start = (-math.pi / 2 + .25 + TAU) % TAU
        span = TAU - .50
        delta_from_start = (angle - start + TAU) % TAU
        if base_stage == 1:
            return delta_from_start < span * .34
        if base_stage == 2:
            return delta_from_start < span * .68
        if gate_open:
            gate_angle = -math.pi / 2
            delta = math.atan2(math.sin(math.atan2(z, x) - gate_angle), math.cos(math.atan2(z, x) - gate_angle))
            return abs(delta) > .24
        return True

    def walkable(x, z):
        if math.hypot(x, z) > 46:
            return False
        water_distance = abs(x - stream_center(z))
        on_bridge = abs(z + 7) < 2.25
        # The grid cell is 1.75 m wide; use a conservative bank margin so no
        # triangle corner reaches the visible water surface.
        if water_distance < 4.0 and not on_bridge:
            return False
        if wall_blocks(x, z):
            return False
        if any(math.hypot(x - ox, z - oz) < radius + .55 for ox, oz, radius in obstacles):
            return False
        return True

    for zi in range(width - 1):
        for xi in range(width - 1):
            x, z = (coords[xi] + coords[xi + 1]) * .5, (coords[zi] + coords[zi + 1]) * .5
            if not walkable(x, z):
                continue
            a = zi * width + xi
            faces.extend([(a, a + 1, a + width + 1), (a, a + width + 1, a + width)])

    # Remove tiny disconnected walkable islands created between tightly
    # clustered rocks/trees. Recast-style agents must only receive the large
    # continuous exterior region (and the interior region when the final gate
    # is closed).
    edge_faces = defaultdict(list)
    for face_index, face in enumerate(faces):
        for edge in ((face[0], face[1]), (face[1], face[2]), (face[2], face[0])):
            edge_faces[tuple(sorted(edge))].append(face_index)
    adjacency = defaultdict(set)
    for linked in edge_faces.values():
        if len(linked) < 2:
            continue
        for face_index in linked:
            adjacency[face_index].update(other for other in linked if other != face_index)
    unseen = set(range(len(faces)))
    kept_indices = set()
    dropped = 0
    while unseen:
        start = unseen.pop()
        queue = deque([start])
        component = {start}
        while queue:
            face_index = queue.popleft()
            for neighbor in adjacency[face_index]:
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    component.add(neighbor)
                    queue.append(neighbor)
        if len(component) >= 100:
            kept_indices.update(component)
        else:
            dropped += len(component)
    faces = [face for index, face in enumerate(faces) if index in kept_indices]
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(vertices, [], faces)
    navmat = make_material("NavmeshDebug", (.05, .72, .42), .65, alpha=.42, emission=(.03, .28, .12))
    mesh.materials.append(navmat)
    obj = bpy.data.objects.new(name, mesh)
    obj["navmeshStage"] = base_stage
    obj["gateOpen"] = gate_open
    bpy.context.scene.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=str(OUT / f"{name}.glb"), export_format="GLB", use_selection=True,
        export_apply=True, export_animations=False, export_extras=True,
        export_cameras=False, export_lights=False,
    )
    bpy.data.objects.remove(obj, do_unlink=True)
    print(f"EXPORTED_NAVMESH={name}.glb faces={len(faces)} dropped_island_faces={dropped}")


def main():
    clean_scene()
    build_terrain()
    build_stream()
    build_turf_patches()
    build_construction_markers()
    obstacles = scatter_environment()

    markers = {
        "PlayerSpawn": (0, -15, terrain_height(0, -15) + 1.7),
        "BuildZone": (0, 0, terrain_height(0, 0)), "RepairZone": (0, -8.5, terrain_height(0, -8.5)),
        "FortGate": (0, -10, terrain_height(0, -10)), "Watchtower": (5, 4, terrain_height(5, 4)),
        "GoblinSpawn_A": (-41, 1, terrain_height(-41, 1)), "GoblinSpawn_B": (37, 25, terrain_height(37, 25)),
        "GoblinSpawn_C": (34, -29, terrain_height(34, -29)), "CatapultSpawn_A": (-34, 19, terrain_height(-34, 19)),
        "CatapultSpawn_B": (36, 18, terrain_height(36, 18)), "CatapultSpawn_C": (4, 39, terrain_height(4, 39)),
    }
    for name, position in markers.items():
        add_marker(name, position, name)

    # Runtime chopping trees are separate GLBs so the exact damage stages can swap.
    for index, (x, z) in enumerate(CHOP_POSITIONS):
        add_marker(f"ChoppableTreeSpawn_{index + 1:02d}", (x, z, terrain_height(x, z)), "choppableTree")

    # Standing trunks and their permanent stumps remain physical obstacles.
    # Baking them into every construction-stage navmesh prevents goblins from
    # walking through a tree while still leaving navigable space after felling.
    obstacles.extend((x, z, .78) for x, z in CHOP_POSITIONS)

    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "first_person_world.blend"))
    bpy.ops.export_scene.gltf(
        filepath=str(OUT / "first_person_world.glb"), export_format="GLB", export_apply=True,
        export_animations=False, export_extras=True, export_cameras=False, export_lights=False,
    )
    print("EXPORTED_WORLD=first_person_world.glb")

    build_navmesh("navmesh_stage_0", obstacles, 0)
    build_navmesh("navmesh_stage_1", obstacles, 1)
    build_navmesh("navmesh_stage_2", obstacles, 2)
    build_navmesh("navmesh_stage_3_open", obstacles, 3, True)
    build_navmesh("navmesh_stage_3_closed", obstacles, 3, False)


if __name__ == "__main__":
    main()
