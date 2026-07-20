from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "public" / "assets" / "forest_defense" / "first_person"
OUT.mkdir(parents=True, exist_ok=True)
TAU = math.tau
bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, roughness=.8, metallic=0.0, emission=None):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = 2.4
    return mat


WOOD_DARK = material("FortWoodDark", (.20, .085, .03), .92)
WOOD = material("FortWood", (.36, .16, .055), .88)
WOOD_LIGHT = material("FreshWood", (.67, .39, .15), .82)
ROPE = material("FortRope", (.43, .27, .095), .96)
METAL = material("ForgedIron", (.13, .16, .17), .52, .62)
BLUE = material("WaldwachtBlue", (.055, .20, .34), .84)
BLUE_LIGHT = material("WaldwachtBlueTrim", (.10, .34, .53), .78)
STONE = material("DefenseStone", (.32, .34, .31), .96)
LEATHER = material("Leather", (.24, .105, .045), .90)
CATAPULT_WOOD_DARK = material("CatapultWoodDark", (.19, .065, .018), .92)
CATAPULT_WOOD = material("CatapultWood", (.47, .215, .052), .84)
CATAPULT_WOOD_LIGHT = material("CatapultWoodSun", (.53, .25, .065), .82)
CATAPULT_ROPE = material("CatapultRope", (.66, .43, .18), .97)
DESTROYED_CATAPULT_ROPE = material("DestroyedCatapultRope", (.78, .57, .27), .97)
CATAPULT_METAL = material("CatapultIron", (.07, .082, .078), .54, .72)
CATAPULT_LEATHER = material("CatapultLeather", (.24, .075, .018), .92)
CATAPULT_BUCKET_DARK = material("CatapultBucketInterior", (.055, .025, .012), .98)
SKIN = material("Skin", (.50, .35, .20), .92)
SKIN_LIGHT = material("SkinHighlight", (.67, .43, .27), .86)
NAIL = material("Fingernail", (.72, .49, .34), .78)
SLEEVE = material("Sleeve", (.17, .21, .17), .94)
GOBLIN_SKIN = material("GoblinSkin", (.25, .42, .12), .90)
GOBLIN_DARK = material("GoblinDark", (.105, .15, .065), .95)
GOBLIN_EYE = material("GoblinEye", (.95, .54, .06), .62, emission=(.95, .30, .02))
PAPER = material("NoteParchment", (.82, .61, .28), .88)
FIRE = material("FireEmissive", (1.0, .24, .025), .42, emission=(1.0, .12, .01))


def apply_bevel(obj, amount=.06, segments=1):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bevel = obj.modifiers.new("Crafted bevels", "BEVEL")
    bevel.width = amount
    bevel.segments = segments
    bpy.ops.object.shade_smooth_by_angle()
    obj.select_set(False)
    return obj


def add_box(name, location, scale, mat=WOOD, rotation=(0, 0, 0), bevel=.04):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        apply_bevel(obj, bevel)
    return obj


def add_cylinder(name, location, radius, depth, mat=WOOD, vertices=10, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def add_cone(name, location, radius1, radius2, depth, mat=WOOD, vertices=9, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def cylinder_between(name, start, end, radius, mat=WOOD, vertices=9):
    start_v, end_v = Vector(start), Vector(end)
    direction = end_v - start_v
    obj = add_cylinder(name, (start_v + end_v) * .5, radius, direction.length, mat, vertices)
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    return obj


def add_torus(name, location, major, minor, mat=ROPE, rotation=(0, 0, 0), major_segments=12):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor, major_segments=major_segments,
        minor_segments=5, location=location, rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def add_beam(name, start, end, half_width, half_depth=None, mat=WOOD, bevel=.04):
    """Create a bevelled square timber whose local Z axis follows start -> end."""
    start_v, end_v = Vector(start), Vector(end)
    direction = end_v - start_v
    depth = half_width if half_depth is None else half_depth
    obj = add_box(name, (start_v + end_v) * .5, (half_width, depth, direction.length * .5), mat, bevel=bevel)
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    return obj


def orient_z(obj, direction):
    obj.rotation_euler = Vector(direction).normalized().to_track_quat("Z", "Y").to_euler()
    return obj


def parent_keep_world(child, parent):
    # Blender updates matrix_world lazily after rotation/scale assignments.
    # Force evaluation before parenting or the exported child loses both.
    bpy.context.view_layer.update()
    world = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world
    bpy.context.view_layer.update()
    return child


def export_objects(filename, objects):
    bpy.ops.object.select_all(action="DESELECT")
    expanded = []
    for obj in objects:
        expanded.append(obj)
        expanded.extend(obj.children_recursive)
    for obj in dict.fromkeys(expanded):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = expanded[0]
    bpy.ops.export_scene.gltf(
        filepath=str(OUT / filename), export_format="GLB", use_selection=True,
        export_apply=True, export_animations=False, export_extras=True,
        export_cameras=False, export_lights=False,
    )
    for obj in dict.fromkeys(expanded):
        if obj.name in bpy.data.objects:
            bpy.data.objects.remove(obj, do_unlink=True)
    print(f"EXPORTED_GAMEPLAY_ASSET={filename}")


def palisade_post(index, angle, radius=10.2, damaged=False):
    x, y = math.cos(angle) * radius, math.sin(angle) * radius
    height = 3.4 if damaged else 4.9 + (index % 3) * .12
    base = add_cylinder(f"PalisadePost_{index:02d}_Body", (x, y, height * .5), .28, height - .55, WOOD_DARK, 9)
    tip = add_cone(f"PalisadePost_{index:02d}_Tip", (x, y, height - .275), .28, .035, .62, WOOD, 9)
    objects = [base, tip]
    base["collisionRadius"] = .32
    # Rope bindings and iron nail heads create readable construction detail.
    for band, z in enumerate((1.2, 2.65)):
        objects.append(add_torus(f"PalisadeRope_{index:02d}_{band}", (x, y, z), .30, .036, ROPE, major_segments=10))
    if index % 4 == 0:
        outward = Vector((math.cos(angle), math.sin(angle), 0))
        foot = Vector((x, y, .15)) + outward * 1.05
        objects.append(cylinder_between(f"PalisadeBrace_{index:02d}", foot, (x, y, 2.15), .12, WOOD, 8))
    return objects


def wall_arc(fraction):
    objects = []
    total = 46
    gate_half = .25
    angles = []
    for index in range(total):
        angle = -math.pi / 2 + gate_half + index / (total - 1) * (TAU - gate_half * 2)
        if index / (total - 1) > fraction:
            break
        angles.append(angle)
        objects.extend(palisade_post(index, angle))
    # Two horizontal structural rails sit inside the sharpened logs.
    for rail_z in (1.15, 2.55):
        for index in range(len(angles) - 1):
            a, b = angles[index], angles[index + 1]
            start = (math.cos(a) * 9.86, math.sin(a) * 9.86, rail_z)
            end = (math.cos(b) * 9.86, math.sin(b) * 9.86, rail_z)
            objects.append(cylinder_between(f"WallRail_{rail_z}_{index:02d}", start, end, .105, WOOD, 8))
    return objects, angles


def add_scaffold(angle, prefix):
    objects = []
    center = Vector((math.cos(angle) * 9.1, math.sin(angle) * 9.1, 0))
    tangent = Vector((-math.sin(angle), math.cos(angle), 0))
    outward = Vector((math.cos(angle), math.sin(angle), 0))
    corners = [center + tangent * s + outward * o for s in (-1.0, 1.0) for o in (-.45, .45)]
    for i, point in enumerate(corners):
        objects.append(add_cylinder(f"{prefix}_ScaffoldLeg_{i}", (point.x, point.y, 1.35), .08, 2.7, WOOD_LIGHT, 8))
    objects.append(add_box(f"{prefix}_ScaffoldPlatform", (center.x, center.y, 1.55), (1.35, .72, .11), WOOD_LIGHT, rotation=(0, 0, angle), bevel=.025))
    objects.append(cylinder_between(f"{prefix}_ScaffoldBraceA", corners[0], corners[3] + Vector((0, 0, 2.3)), .055, ROPE, 7))
    objects.append(cylinder_between(f"{prefix}_ScaffoldBraceB", corners[1], corners[2] + Vector((0, 0, 2.3)), .055, ROPE, 7))
    return objects


def add_gate(stage=3):
    objects = []
    y = -9.9
    for side in (-1, 1):
        x = side * 2.35
        objects.append(add_cylinder(f"GateReinforcedPost_{side}", (x, y, 2.8), .44, 5.6, WOOD_DARK, 10))
        objects.append(add_cone(f"GatePostTip_{side}", (x, y, 5.9), .45, .04, .7, WOOD, 10))
        outward = Vector((side * .85, -.6, .12))
        objects.append(cylinder_between(f"GateSupport_{side}", (x, y, 2.3), (x + outward.x, y + outward.y, .2), .16, WOOD, 9))
        for z in (1.35, 3.8):
            objects.append(add_torus(f"GatePostRope_{side}_{z}", (x, y, z), .47, .055, ROPE, major_segments=12))
    if stage >= 2:
        objects.append(cylinder_between("GateHeader", (-2.45, y, 5.25), (2.45, y, 5.25), .24, WOOD_DARK, 10))
        objects.append(add_box("GateBlueBanner", (0, y - .07, 4.65), (1.25, .035, .34), BLUE, bevel=.03))
    if stage < 3:
        return objects

    for side in (-1, 1):
        hinge_x = side * 2.08
        pivot = bpy.data.objects.new("GateLeftPivot" if side < 0 else "GateRightPivot", None)
        pivot.location = (hinge_x, y, 0)
        pivot["gateSide"] = "left" if side < 0 else "right"
        bpy.context.scene.collection.objects.link(pivot)
        objects.append(pivot)
        panel_center = side * 1.08
        panel_objects = []
        for plank in range(5):
            x = panel_center + (plank - 2) * .42
            panel_objects.append(add_box(f"Gate_{side}_Plank_{plank}", (x, y, 2.15), (.185, .18, 2.05), WOOD, bevel=.055))
            panel_objects.append(add_cone(f"Gate_{side}_Tip_{plank}", (x, y, 4.43), .25, .025, .55, WOOD_LIGHT, 8))
        panel_objects.append(add_box(f"Gate_{side}_BraceUpper", (panel_center, y - .19, 3.15), (1.05, .12, .12), WOOD_DARK, rotation=(0, .0, side * .12), bevel=.04))
        panel_objects.append(add_box(f"Gate_{side}_BraceLower", (panel_center, y - .19, 1.15), (1.05, .12, .12), WOOD_DARK, rotation=(0, .0, -side * .12), bevel=.04))
        for child in panel_objects:
            world = child.matrix_world.copy()
            child.parent = pivot
            child.matrix_world = world
            objects.append(child)
    return objects


def add_barrel(name, location, scale=1):
    objects = []
    objects.append(add_cylinder(name, (location[0], location[1], location[2] + .55 * scale), .38 * scale, 1.1 * scale, WOOD, 12))
    for z in (.18, .55, .92):
        objects.append(add_torus(f"{name}_Band_{z}", (location[0], location[1], location[2] + z * scale), .39 * scale, .035 * scale, METAL, major_segments=12))
    return objects


def add_crate(name, location, scale=1):
    objects = [add_box(name, (location[0], location[1], location[2] + .48 * scale), (.48 * scale, .48 * scale, .48 * scale), WOOD_LIGHT, bevel=.045)]
    for z in (.12, .84):
        objects.append(add_box(f"{name}_Band_{z}", (location[0], location[1] - .5 * scale, location[2] + z * scale), (.53 * scale, .045 * scale, .055 * scale), WOOD_DARK, bevel=.018))
    return objects


def add_torch(name, location):
    objects = [add_cylinder(name + "_Pole", (location[0], location[1], location[2] + 1.25), .055, 2.5, WOOD_DARK, 8)]
    objects.append(add_cone(name + "_Flame", (location[0], location[1], location[2] + 2.72), .17, .03, .62, FIRE, 7))
    return objects


def add_tower(full=True):
    objects = []
    cx, cy = 4.7, 3.9
    offsets = [(-1.15, -1.15), (1.15, -1.15), (-1.15, 1.15), (1.15, 1.15)]
    leg_height = 3.1 if not full else 6.2
    for index, (dx, dy) in enumerate(offsets):
        objects.append(add_cylinder(f"TowerLeg_{index}", (cx + dx, cy + dy, leg_height * .5), .20, leg_height, WOOD_DARK, 9))
        objects.append(cylinder_between(f"TowerBrace_{index}", (cx + dx, cy + dy, .45), (cx - dx * .62, cy - dy * .62, leg_height - .45), .10, WOOD, 8))
    if not full:
        objects.append(add_box("TowerFoundationDeck", (cx, cy, 2.65), (1.65, 1.65, .16), WOOD_LIGHT, bevel=.045))
        return objects
    objects.append(add_box("TowerPlatform", (cx, cy, 6.05), (1.72, 1.72, .16), WOOD_LIGHT, bevel=.05))
    # Railings, ladder and covered roof.
    for side in (-1, 1):
        for axis in (0, 1):
            for index in range(5):
                offset = -1.45 + index * .725
                x = cx + (side * 1.55 if axis == 0 else offset)
                y = cy + (offset if axis == 0 else side * 1.55)
                objects.append(add_cylinder(f"TowerRailPost_{axis}_{side}_{index}", (x, y, 6.72), .055, 1.2, WOOD_DARK, 7))
            a = (cx + (side * 1.55 if axis == 0 else -1.55), cy + (-1.55 if axis == 0 else side * 1.55), 7.2)
            b = (cx + (side * 1.55 if axis == 0 else 1.55), cy + (1.55 if axis == 0 else side * 1.55), 7.2)
            objects.append(cylinder_between(f"TowerRail_{axis}_{side}", a, b, .07, WOOD, 8))
    # Ladder along the south leg pair.
    objects.append(cylinder_between("TowerLadderLeft", (cx - .58, cy - 1.38, .15), (cx - .58, cy - 1.38, 6.0), .065, WOOD_LIGHT, 8))
    objects.append(cylinder_between("TowerLadderRight", (cx + .58, cy - 1.38, .15), (cx + .58, cy - 1.38, 6.0), .065, WOOD_LIGHT, 8))
    for index in range(13):
        z = .45 + index * .43
        objects.append(cylinder_between(f"TowerLadderRung_{index:02d}", (cx - .58, cy - 1.38, z), (cx + .58, cy - 1.38, z), .045, WOOD_LIGHT, 7))
    # Hipped blue roof and cloth flags.
    roof_z = 8.35
    objects.append(add_cone("TowerRoof", (cx, cy, roof_z), 2.35, .18, 1.55, BLUE, 4, rotation=(0, 0, math.pi / 4)))
    objects.append(add_cylinder("TowerFlagPole", (cx, cy, 9.7), .035, 2.5, METAL, 8))
    objects.append(add_box("TowerFlag", (cx + .55, cy, 10.35), (.55, .025, .32), BLUE_LIGHT, bevel=.025))
    # Readable stone stock on the platform.
    for index in range(8):
        angle = index / 8 * TAU
        objects.append(add_icosphere(f"TowerStone_{index}", (cx + math.cos(angle) * .72, cy + math.sin(angle) * .72, 6.48 + (index % 2) * .12), .16, STONE))
    return objects


def add_icosphere(name, location, radius, mat, subdivisions=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def add_workshop(full=True):
    objects = []
    cx, cy = -4.4, 1.2
    objects.append(add_box("WorkshopFloor", (cx, cy, .14), (2.35, 1.65, .14), WOOD_DARK, bevel=.05))
    height = 2.2 if full else 1.25
    for index, (dx, dy) in enumerate([(-2, -1.3), (2, -1.3), (-2, 1.3), (2, 1.3)]):
        objects.append(add_cylinder(f"WorkshopPost_{index}", (cx + dx, cy + dy, height * .5), .13, height, WOOD, 9))
    if not full:
        objects.extend(add_scaffold(math.pi, "WorkshopBuild"))
        return objects
    objects.append(add_box("WorkshopRoofLeft", (cx - 1.15, cy, 2.65), (1.55, 1.9, .11), BLUE, rotation=(0, .34, 0), bevel=.035))
    objects.append(add_box("WorkshopRoofRight", (cx + 1.15, cy, 2.65), (1.55, 1.9, .11), BLUE, rotation=(0, -.34, 0), bevel=.035))
    objects.append(add_box("WorkshopBench", (cx, cy - .5, .9), (1.45, .48, .10), WOOD_LIGHT, bevel=.04))
    objects.extend(add_crate("WorkshopCrate", (cx - 1.45, cy + .65, .2), .82))
    objects.extend(add_barrel("WorkshopBarrel", (cx + 1.45, cy + .55, .2), .88))
    return objects


def add_hut():
    objects = []
    cx, cy = 3.8, -2.0
    objects.append(add_box("StorehouseBody", (cx, cy, 1.2), (1.65, 1.45, 1.2), WOOD, bevel=.08))
    objects.append(add_box("StorehouseRoofLeft", (cx - .85, cy, 2.75), (1.2, 1.72, .12), BLUE, rotation=(0, .48, 0), bevel=.04))
    objects.append(add_box("StorehouseRoofRight", (cx + .85, cy, 2.75), (1.2, 1.72, .12), BLUE, rotation=(0, -.48, 0), bevel=.04))
    objects.append(add_box("StorehouseDoor", (cx, cy - 1.48, 1.0), (.48, .08, .9), WOOD_DARK, bevel=.04))
    for index, x in enumerate((-1.05, 1.05)):
        objects.append(add_cylinder(f"StorehouseCorner_{index}", (cx + x, cy - 1.48, 1.2), .11, 2.4, WOOD_LIGHT, 8))
    objects.extend(add_barrel("StorehouseBarrel", (cx + 2.0, cy + .4, .05), .82))
    objects.extend(add_crate("StorehouseCrate", (cx + 1.95, cy - .75, .05), .78))
    return objects


def add_campfire():
    objects = []
    cx, cy = -.2, -.2
    for index in range(10):
        a = index / 10 * TAU
        objects.append(add_icosphere(f"FireStone_{index}", (cx + math.cos(a) * .62, cy + math.sin(a) * .62, .18), .20, STONE))
    objects.append(cylinder_between("FireLogA", (cx - .45, cy - .28, .27), (cx + .45, cy + .28, .27), .12, WOOD_DARK, 8))
    objects.append(cylinder_between("FireLogB", (cx - .45, cy + .28, .27), (cx + .45, cy - .28, .27), .12, WOOD_DARK, 8))
    objects.append(add_cone("CampfireFlame", (cx, cy, .82), .34, .04, 1.05, FIRE, 7))
    return objects


def build_fort_stage(stage):
    fraction = {1: .34, 2: .68, 3: 1.0}[stage]
    objects, angles = wall_arc(fraction)
    if angles:
        objects.extend(add_scaffold(angles[-1], f"Stage{stage}End"))
    objects.extend(add_gate(stage))
    # Building progression is strongly different at each delivered log.
    if stage == 1:
        for index in range(8):
            objects.append(add_cylinder(f"Stage1LogStock_{index}", (-4.8 + (index % 4) * .36, -2.8 + (index // 4) * .34, .25), .13, 2.4, WOOD_LIGHT, 9, rotation=(0, math.pi / 2, 0)))
    if stage >= 2:
        objects.extend(add_tower(full=stage == 3))
        objects.extend(add_workshop(full=stage == 3))
    if stage == 3:
        objects.extend(add_hut())
        objects.extend(add_campfire())
        objects.extend(add_torch("GateTorchLeft", (-2.8, -9.6, 0)))
        objects.extend(add_torch("GateTorchRight", (2.8, -9.6, 0)))
        objects.extend(add_torch("InnerTorchA", (-7.2, 4.8, 0)))
        objects.extend(add_torch("InnerTorchB", (7.4, 5.0, 0)))
    for obj in objects:
        if obj.type == "MESH":
            obj["fortStage"] = stage
    return objects


def add_catapult_wheel(objects, prefix, index, x, y):
    """A solid low-poly cart wheel with iron tyre, inset hub and wooden cap."""
    axis_rotation = (0, math.pi / 2, 0)
    outward = -1 if x < 0 else 1
    center = (x, y, .57)
    objects.append(add_cylinder(prefix + f"_Wheel_{index}_IronTyre", center, .59, .20, CATAPULT_METAL, 14, axis_rotation))
    objects.append(add_cylinder(prefix + f"_Wheel_{index}_WoodDisc", center, .505, .25, CATAPULT_WOOD, 12, axis_rotation))
    face_x = x + outward * .135
    objects.append(add_torus(prefix + f"_Wheel_{index}_Rim", (face_x, y, .57), .505, .055, CATAPULT_METAL, axis_rotation, 14))
    objects.append(add_cylinder(prefix + f"_WheelHub_{index}_Iron", (x, y, .57), .205, .32, CATAPULT_METAL, 12, axis_rotation))
    objects.append(add_cylinder(prefix + f"_WheelHub_{index}_WoodCap", (x + outward * .18, y, .57), .12, .12, CATAPULT_WOOD_LIGHT, 10, axis_rotation))
    objects.append(add_torus(prefix + f"_WheelHub_{index}_Ring", (face_x + outward * .045, y, .57), .19, .025, CATAPULT_METAL, axis_rotation, 12))


def add_broken_beam(name, start, end, half_width, half_depth=None, mat=CATAPULT_WOOD, broken_start=False, broken_end=True, seed=0):
    """A rectangular timber with deliberately uneven, triangulated break faces."""
    start_v, end_v = Vector(start), Vector(end)
    direction = end_v - start_v
    depth = half_width if half_depth is None else half_depth
    length = direction.length
    corners = [(-half_width, -depth), (half_width, -depth), (half_width, depth), (-half_width, depth)]
    profiles = (
        (.02, .15, -.04, .08),
        (.11, -.03, .17, .02),
        (-.02, .12, .04, .18),
        (.16, .04, -.03, .10),
    )
    start_offsets = profiles[(seed + 1) % len(profiles)] if broken_start else (0, 0, 0, 0)
    end_offsets = profiles[seed % len(profiles)] if broken_end else (0, 0, 0, 0)
    vertices = []
    for index, (x, y) in enumerate(corners):
        vertices.append((x, y, -length * .5 + start_offsets[index]))
    for index, (x, y) in enumerate(corners):
        vertices.append((x, y, length * .5 + end_offsets[index]))
    vertices.extend(((0, 0, -length * .5 + sum(start_offsets) / 4), (0, 0, length * .5 + sum(end_offsets) / 4)))
    faces = []
    for index in range(4):
        next_index = (index + 1) % 4
        faces.append((index, next_index, next_index + 4, index + 4))
        faces.append((8, next_index, index))
        faces.append((9, index + 4, next_index + 4))
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = (start_v + end_v) * .5
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def add_break_spikes(objects, name, origin, direction, radius=.10, lengths=(.28, .38, .22)):
    direction_v = Vector(direction).normalized()
    side = direction_v.cross(Vector((0, 0, 1)))
    if side.length_squared < .01:
        side = Vector((1, 0, 0))
    else:
        side.normalize()
    up = side.cross(direction_v).normalized()
    offsets = (side * radius * .55, -side * radius * .45 + up * radius * .35, up * -radius * .42)
    for index, (offset, length) in enumerate(zip(offsets, lengths)):
        start = Vector(origin) + offset
        end = start + direction_v * length
        spike = add_cone(name + f"_Splinter_{index}", (start + end) * .5, radius * .42, .012, length, CATAPULT_WOOD_LIGHT, 5)
        orient_z(spike, direction_v)
        objects.append(spike)


def add_rope_path(objects, name, points, radius=.027, mat=CATAPULT_ROPE):
    for index in range(len(points) - 1):
        objects.append(cylinder_between(name + f"_{index}", points[index], points[index + 1], radius, mat, 7))


def add_wheel_sector(name, location, inner_radius, outer_radius, depth, start_angle, end_angle, mat, segments=7, rotation=(0, 0, 0)):
    """Extruded annular sector whose local X axis is the wheel axle."""
    vertices = []
    for index in range(segments + 1):
        angle = start_angle + (end_angle - start_angle) * index / segments
        cosine, sine = math.cos(angle), math.sin(angle)
        vertices.extend((
            (-depth * .5, cosine * inner_radius, sine * inner_radius),
            (-depth * .5, cosine * outer_radius, sine * outer_radius),
            (depth * .5, cosine * inner_radius, sine * inner_radius),
            (depth * .5, cosine * outer_radius, sine * outer_radius),
        ))
    faces = []
    for index in range(segments):
        a, b = index * 4, (index + 1) * 4
        faces.extend(((a, b, b + 1, a + 1), (a + 2, a + 3, b + 3, b + 2), (a + 1, b + 1, b + 3, a + 3), (a + 2, b + 2, b, a)))
    faces.extend(((0, 1, 3, 2), (segments * 4, segments * 4 + 2, segments * 4 + 3, segments * 4 + 1)))
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.rotation_euler = rotation
    obj.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def add_catapult_frame(objects, prefix):
    # Deep plank bed and heavy outer sills establish the rectangular chassis.
    for index, x in enumerate((-.72, -.36, 0, .36, .72)):
        objects.append(add_box(prefix + f"_DeckPlank_{index}", (x, -.02, .58), (.155, 1.58, .105), CATAPULT_WOOD, bevel=.035))
    objects.append(add_box(prefix + "_FrameLeft", (-1.02, -.02, .62), (.17, 1.74, .17), CATAPULT_WOOD_DARK, bevel=.055))
    objects.append(add_box(prefix + "_FrameRight", (1.02, -.02, .62), (.17, 1.74, .17), CATAPULT_WOOD_DARK, bevel=.055))
    objects.append(add_box(prefix + "_CrossFront", (0, -1.66, .68), (1.30, .18, .205), CATAPULT_WOOD, bevel=.055))
    objects.append(add_box(prefix + "_CrossRear", (0, 1.56, .65), (1.25, .17, .17), CATAPULT_WOOD, bevel=.05))

    # The front beam in the reference is armoured and studded.
    for side in (-1, 1):
        objects.append(add_box(prefix + f"_FrontIronCorner_{side}", (side * 1.12, -1.85, .68), (.145, .028, .255), CATAPULT_METAL, bevel=.025))
        for z in (.55, .82):
            objects.append(add_cylinder(prefix + f"_FrontCornerRivet_{side}_{z}", (side * 1.12, -1.89, z), .035, .065, CATAPULT_METAL, 8, (math.pi / 2, 0, 0)))
    for index, x in enumerate((-.64, -.22, .22, .64)):
        objects.append(add_cone(prefix + f"_FrontStud_{index}", (x, -1.88, .68), .065, .015, .14, CATAPULT_METAL, 8, (math.pi / 2, 0, 0)))

    # Two true wheel axles run across the chassis.
    for axle_index, y in enumerate((-1.20, 1.20)):
        objects.append(cylinder_between(prefix + f"_RunningAxle_{axle_index}", (-1.50, y, .57), (1.50, y, .57), .075, CATAPULT_METAL, 10))
    for wheel_index, (x, y) in enumerate(((-1.34, -1.20), (1.34, -1.20), (-1.34, 1.20), (1.34, 1.20))):
        add_catapult_wheel(objects, prefix, wheel_index, x, y)

    # Twin A-frames sit on the left and right sills, as on the reference.
    pivot_y, pivot_z = -.02, 2.64
    for side in (-1, 1):
        x = side * .80
        for leg_name, foot_y in (("Front", -1.18), ("Rear", 1.22)):
            objects.append(add_beam(prefix + f"_{leg_name}Support_{side}", (x, foot_y, .76), (x, pivot_y, pivot_z), .13, .105, CATAPULT_WOOD_LIGHT, .045))
            objects.append(add_box(prefix + f"_{leg_name}FootIron_{side}", (x, foot_y, .76), (.17, .18, .11), CATAPULT_METAL, bevel=.025))
            objects.append(add_cylinder(prefix + f"_{leg_name}FootBolt_{side}", (x - side * .18, foot_y, .77), .045, .055, CATAPULT_METAL, 8, (0, math.pi / 2, 0)))

    # Oversized wooden torsion axle, iron collars, cut end-grain and rope packs.
    objects.append(cylinder_between(prefix + "_TopBar", (-1.48, pivot_y, pivot_z), (1.48, pivot_y, pivot_z), .215, CATAPULT_WOOD, 12))
    for side in (-1, 1):
        objects.append(add_cylinder(prefix + f"_TopBarEnd_{side}", (side * 1.51, pivot_y, pivot_z), .19, .08, CATAPULT_WOOD_DARK, 12, (0, math.pi / 2, 0)))
        objects.append(add_torus(prefix + f"_TopIronCollar_{side}", (side * .80, pivot_y, pivot_z), .22, .045, CATAPULT_METAL, (0, math.pi / 2, 0), 12))
    for bundle, center_x in enumerate((-.38, .38)):
        for loop in range(4):
            x = center_x + (loop - 1.5) * .045
            objects.append(add_torus(prefix + f"_Rope_Axle_{bundle}_{loop}", (x, pivot_y, pivot_z), .225, .026, CATAPULT_ROPE, (0, math.pi / 2, 0), 12))

    # Reference-visible lashings around the chassis and the taut central cord.
    for side in (-1, 1):
        for loop in range(4):
            y = .82 + loop * .045
            objects.append(add_torus(prefix + f"_Rope_Frame_{side}_{loop}", (side * 1.02, y, .62), .205, .024, CATAPULT_ROPE, (math.pi / 2, 0, 0), 10))
    objects.append(cylinder_between(prefix + "_Rope_Tension", (0, -.04, 2.43), (0, -.48, .79), .025, CATAPULT_ROPE, 8))


def add_catapult_bucket(objects, prefix, pivot, arm_end, arm_direction):
    # An open, low-poly leather/wooden cup replaces the old solid box.
    opening = Vector((0, -.48, .88)).normalized()
    shell_center = arm_end - opening * .15
    shell = add_cone(prefix + "_Bucket_Shell", shell_center, .285, .47, .34, CATAPULT_LEATHER, 12)
    orient_z(shell, opening)
    shell.scale = (.86, 1.16, 1)
    objects.append(parent_keep_world(shell, pivot))

    lip = add_torus(prefix + "_Bucket_Lip", arm_end, .455, .072, CATAPULT_WOOD_LIGHT, major_segments=12)
    orient_z(lip, opening)
    lip.scale = (.86, 1.16, 1)
    objects.append(parent_keep_world(lip, pivot))

    inset_position = arm_end - opening * .035
    inset = add_cylinder(prefix + "_Bucket_Interior", inset_position, .365, .025, CATAPULT_BUCKET_DARK, 12)
    orient_z(inset, opening)
    inset.scale = (.86, 1.16, 1)
    objects.append(parent_keep_world(inset, pivot))

    # Keep the gameplay marker required by the asset contract, but recess it so
    # the showcase silhouette reads as the reference's dark, open cup.
    stone = add_icosphere(prefix + "_LoadedStone", arm_end - opening * .13, .12, CATAPULT_BUCKET_DARK, 1)
    stone.scale = (1.08, .92, .86)
    objects.append(parent_keep_world(stone, pivot))

    # Rope coils visibly lock the cup neck to the throwing beam.
    for loop in range(6):
        point = arm_end - arm_direction * (.43 + loop * .045)
        rope = add_torus(prefix + f"_Rope_Bucket_{loop}", point, .17, .026, CATAPULT_ROPE, major_segments=10)
        orient_z(rope, arm_direction)
        objects.append(parent_keep_world(rope, pivot))


def add_destroyed_catapult(objects, prefix):
    # The wreck keeps the recognizable rectangular chassis, but every long
    # timber has a readable failure point and the deck is split open.
    objects.append(add_broken_beam(prefix + "_FrameLeft", (-1.02, -1.62, .58), (-1.02, 1.46, .58), .17, .16, CATAPULT_WOOD_DARK, broken_end=True, seed=0))
    objects.append(add_broken_beam(prefix + "_FrameRight", (1.02, -1.62, .58), (1.02, 1.36, .58), .17, .16, CATAPULT_WOOD_DARK, broken_end=True, seed=2))
    objects.append(add_broken_beam(prefix + "_CrossFront", (-1.24, -1.58, .66), (1.18, -1.58, .66), .20, .16, CATAPULT_WOOD, broken_end=True, seed=1))
    objects.append(add_broken_beam(prefix + "_CrossRear", (-1.18, 1.42, .63), (1.20, 1.42, .63), .17, .15, CATAPULT_WOOD, broken_start=True, seed=3))

    # Corner armour survives the impact and anchors the wreck visually.
    for side in (-1, 1):
        for y, label in ((-1.72, "Front"), (1.52, "Rear")):
            objects.append(add_box(prefix + f"_{label}IronCorner_{side}", (side * 1.13, y, .65), (.14, .035, .245), CATAPULT_METAL, bevel=.024))
            for z in (.54, .77):
                objects.append(add_cylinder(prefix + f"_{label}CornerRivet_{side}_{z}", (side * 1.13, y - .035 if y < 0 else y + .035, z), .032, .065, CATAPULT_METAL, 8, (math.pi / 2, 0, 0)))
    for index, x in enumerate((-.62, -.20, .22, .64)):
        objects.append(add_cone(prefix + f"_FrontStud_{index}", (x, -1.78, .66), .06, .014, .13, CATAPULT_METAL, 8, (math.pi / 2, 0, 0)))

    # Shattered floorboards: paired fragments leave irregular longitudinal gaps.
    deck_layout = (
        (-.72, -1.38, -.18, .30, 1.20),
        (-.36, -1.35, .12, .48, 1.25),
        (0, -1.28, -.38, .36, .96),
        (.36, -1.34, -.02, .55, 1.26),
        (.72, -1.35, .18, .46, 1.18),
    )
    for index, (x, front_start, front_end, rear_start, rear_end) in enumerate(deck_layout):
        objects.append(add_broken_beam(prefix + f"_DeckPlank_{index}_Front", (x, front_start, .69 + index % 2 * .025), (x, front_end, .69 + index % 2 * .025), .145, .095, CATAPULT_WOOD, broken_end=True, seed=index))
        objects.append(add_broken_beam(prefix + f"_DeckPlank_{index}_Rear", (x, rear_start, .69), (x, rear_end, .69), .145, .095, CATAPULT_WOOD, broken_start=True, seed=index + 1))
    objects.append(add_box(prefix + "_DeckGapShadow", (.02, .20, .635), (.23, .68, .025), CATAPULT_BUCKET_DARK, bevel=0))

    # Only two wheels remain attached on the left side; the opposite wheel is
    # split into separated sectors on the ground.
    for axle_index, y in enumerate((-1.13, 1.12)):
        objects.append(cylinder_between(prefix + f"_BrokenRunningAxle_{axle_index}", (-1.56, y, .56), (-.72, y, .56), .075, CATAPULT_METAL, 10))
        add_catapult_wheel(objects, prefix, axle_index, -1.34, y)

    detached_center = Vector((1.76, -1.42, .17))
    flat_rotation = (0, -math.pi / 2, .08)
    sector_ranges = ((math.radians(12), math.radians(152)), (math.radians(184), math.radians(338)))
    for index, (start, end) in enumerate(sector_ranges):
        offset = Vector((.05 * index, .09 * index, .018 * index))
        center = detached_center + offset
        objects.append(add_wheel_sector(prefix + f"_Wheel_DetachedWood_{index}", center, .14, .50, .23, start, end, CATAPULT_WOOD, 7, flat_rotation))
        objects.append(add_wheel_sector(prefix + f"_Wheel_DetachedIron_{index}", center, .50, .59, .19, start, end, CATAPULT_METAL, 7, flat_rotation))
    objects.append(add_cylinder(prefix + "_Wheel_DetachedHub", (detached_center.x, detached_center.y, .21), .19, .18, CATAPULT_METAL, 10))
    objects.append(add_cylinder(prefix + "_Wheel_DetachedCap", (detached_center.x, detached_center.y, .32), .105, .08, CATAPULT_WOOD_LIGHT, 9))

    # One A-frame still forms a strong ruined silhouette. The opposite side is
    # reduced to a high broken leg and a short stump.
    apex = Vector((.70, .04, 2.30))
    for leg_name, foot_y in (("Front", -1.04), ("Rear", 1.08)):
        objects.append(add_broken_beam(prefix + f"_{leg_name}SupportStanding", (.70, foot_y, .76), apex, .13, .105, CATAPULT_WOOD_LIGHT, broken_end=True, seed=2 if foot_y < 0 else 3))
        objects.append(add_box(prefix + f"_{leg_name}FootIronStanding", (.70, foot_y, .75), (.17, .18, .10), CATAPULT_METAL, bevel=.022))
    objects.append(add_box(prefix + "_BrokenApexIronBand", (.70, .04, 2.24), (.18, .22, .085), CATAPULT_METAL, rotation=(.08, 0, -.08), bevel=.022))
    add_break_spikes(objects, prefix + "_Apex", apex + Vector((0, 0, -.02)), (0, 0, 1), .13, (.30, .24, .36))

    objects.append(add_broken_beam(prefix + "_RearSupportHigh", (-.70, 1.06, .75), (-.70, .18, 2.02), .13, .105, CATAPULT_WOOD, broken_end=True, seed=1))
    objects.append(add_broken_beam(prefix + "_FrontSupportStump", (-.70, -1.04, .75), (-.70, -.58, 1.34), .13, .105, CATAPULT_WOOD_LIGHT, broken_end=True, seed=0))
    for y in (1.06, -1.04):
        objects.append(add_box(prefix + f"_FootIronBroken_{y}", (-.70, y, .75), (.17, .18, .10), CATAPULT_METAL, bevel=.022))
    add_break_spikes(objects, prefix + "_SupportStump", (-.70, -.58, 1.34), Vector((0, .60, .80)), .10, (.24, .32, .21))

    # The torsion axle is the dominant foreground fragment from the reference.
    axle_y, axle_z = -2.28, .28
    objects.append(add_cylinder(prefix + "_BrokenTopAxle", (0, axle_y, axle_z), .205, 2.72, CATAPULT_WOOD, 12, (0, math.pi / 2, 0)))
    for side in (-1, 1):
        objects.append(add_torus(prefix + f"_BrokenTopAxleIron_{side}", (side * 1.18, axle_y, axle_z), .21, .043, CATAPULT_METAL, (0, math.pi / 2, 0), 12))
        add_break_spikes(objects, prefix + f"_TopAxleEnd_{side}", (side * 1.34, axle_y, axle_z), (side, 0, 0), .12, (.30, .22, .36))
    for bundle, center_x in enumerate((-.46, .36)):
        for loop in range(5):
            objects.append(add_torus(prefix + f"_Rope_BrokenAxle_{bundle}_{loop}", (center_x + (loop - 2) * .042, axle_y, axle_z), .215, .026, CATAPULT_ROPE, (0, math.pi / 2, 0), 12))

    # The throwing arm failed in two places and lies across / beside the bed.
    objects.append(add_broken_beam(prefix + "_BrokenArm_Main", (-.82, -.82, .84), (.48, .66, .92), .14, .105, CATAPULT_WOOD, broken_start=True, broken_end=True, seed=3))
    objects.append(add_broken_beam(prefix + "_BrokenArm_Ground", (.88, -.70, .18), (1.82, -.98, .25), .13, .095, CATAPULT_WOOD, broken_start=True, broken_end=True, seed=1))
    add_break_spikes(objects, prefix + "_BrokenArmTip", (.48, .66, .92), (.62, .78, .10), .10, (.34, .27, .42))

    # Detached half-cup on the left. Annular sectors keep the broken radial
    # edges open, unlike a capped cone which reads as a circular lid.
    bucket_opening = Vector((-.40, -.52, .76)).normalized()
    bucket_center = Vector((-1.95, -1.48, .28))
    bucket_rotation = bucket_opening.to_track_quat("X", "Z").to_euler()
    bucket_start, bucket_end = math.radians(-18), math.radians(196)
    bucket_shell = add_wheel_sector(prefix + "_BrokenBucket_Shell", bucket_center, .07, .41, .17, bucket_start, bucket_end, CATAPULT_LEATHER, 9, bucket_rotation)
    bucket_shell.scale = (1, .90, 1.13)
    objects.append(bucket_shell)
    bucket_lip = add_wheel_sector(prefix + "_BrokenBucket_Lip", bucket_center + bucket_opening * .012, .405, .475, .19, bucket_start, bucket_end, CATAPULT_METAL, 9, bucket_rotation)
    bucket_lip.scale = (1, .90, 1.13)
    objects.append(bucket_lip)
    bucket_dark = add_wheel_sector(prefix + "_BrokenBucket_Interior", bucket_center + bucket_opening * .095, .065, .345, .025, bucket_start + .06, bucket_end - .06, CATAPULT_BUCKET_DARK, 9, bucket_rotation)
    bucket_dark.scale = (1, .90, 1.13)
    objects.append(bucket_dark)
    add_break_spikes(objects, prefix + "_BucketBreak", bucket_center + Vector((.30, .06, .02)), (.8, .2, .1), .07, (.20, .28, .16))

    # Two long slack ropes sell the collapse and link the isolated fragments.
    add_rope_path(objects, prefix + "_Rope_SlackA", [
        (.70, .04, 2.24), (.66, -.02, 1.70), (.42, -.22, 1.10), (.10, -.58, .78),
        (-.32, -.94, .64), (-.82, -1.22, .42), (-1.34, -1.64, .24),
    ], .043, DESTROYED_CATAPULT_ROPE)
    add_rope_path(objects, prefix + "_Rope_SlackB", [
        (-.70, .18, 1.94), (-.50, .30, 1.42), (-.12, .45, .90), (.34, .66, .73),
        (.78, .86, .58), (1.28, 1.02, .25),
    ], .036, DESTROYED_CATAPULT_ROPE)
    add_rope_path(objects, prefix + "_Rope_GroundTrail", [
        (-1.83, -1.52, .23), (-1.50, -1.78, .105), (-1.02, -1.82, .10),
        (-.56, -1.62, .12), (-.22, -1.30, .20), (-.04, -.94, .46),
    ], .042, DESTROYED_CATAPULT_ROPE)

    # Art-directed debris field: long shards point away from the impact centre.
    debris = (
        ("A", (1.32, .74, .12), (2.02, 1.00, .18), .075),
        ("B", (1.16, -2.02, .10), (1.82, -2.28, .14), .065),
        ("C", (-1.66, .72, .10), (-2.22, .98, .15), .060),
        ("D", (.18, -2.62, .08), (.72, -2.78, .11), .045),
        ("E", (1.62, .18, .09), (2.00, .42, .16), .055),
        ("F", (-.92, 1.62, .09), (-1.38, 1.90, .13), .050),
    )
    for index, (label, start, end, size) in enumerate(debris):
        objects.append(add_broken_beam(prefix + f"_SplinterDebris_{label}", start, end, size, size * .55, CATAPULT_WOOD_LIGHT if index % 2 else CATAPULT_WOOD, broken_start=True, broken_end=True, seed=index))


def build_catapult(destroyed=False):
    objects = []
    prefix = "DestroyedCatapult" if destroyed else "Catapult"

    if destroyed:
        add_destroyed_catapult(objects, prefix)
    else:
        add_catapult_frame(objects, prefix)
        pivot = bpy.data.objects.new(prefix + "_ThrowingArmPivot", None)
        pivot.location = (0, -.02, 2.64)
        pivot["animatedPart"] = "throwingArm"
        bpy.context.scene.collection.objects.link(pivot)
        objects.append(pivot)

        arm_start = Vector((0, -.56, 2.16))
        arm_end = Vector((0, 1.56, 3.18))
        arm_direction = (arm_end - arm_start).normalized()
        arm = add_beam(prefix + "_LaunchBeam", arm_start, arm_end, .14, .105, CATAPULT_WOOD_LIGHT, .045)
        objects.append(parent_keep_world(arm, pivot))

        hinge = add_cylinder(prefix + "_ArmHinge", (0, -.02, 2.64), .285, .44, CATAPULT_WOOD, 12, (0, math.pi / 2, 0))
        objects.append(parent_keep_world(hinge, pivot))
        for side in (-1, 1):
            cap = add_cylinder(prefix + f"_ArmHingeIron_{side}", (side * .24, -.02, 2.64), .22, .055, CATAPULT_METAL, 12, (0, math.pi / 2, 0))
            objects.append(parent_keep_world(cap, pivot))

        add_catapult_bucket(objects, prefix, pivot, arm_end, arm_direction)

    for obj in objects:
        obj["kind"] = "catapult"
        obj["destroyed"] = destroyed
    return objects


def build_goblin():
    objects = []
    objects.append(add_cone("GoblinTorso", (0, 0, 1.22), .42, .31, .95, GOBLIN_DARK, 9))
    objects.append(add_icosphere("GoblinHead", (0, 0, 1.93), .40, GOBLIN_SKIN, 2))
    # Long ears, nose, glowing eyes and a riveted helmet.
    objects.append(add_cone("GoblinEarL", (-.48, 0, 2.0), .18, .025, .62, GOBLIN_SKIN, 7, rotation=(0, math.pi / 2, 0)))
    objects.append(add_cone("GoblinEarR", (.48, 0, 2.0), .18, .025, .62, GOBLIN_SKIN, 7, rotation=(0, -math.pi / 2, 0)))
    objects.append(add_cone("GoblinNose", (0, -.40, 1.90), .14, .025, .38, GOBLIN_SKIN, 7, rotation=(math.pi / 2, 0, 0)))
    objects.append(add_icosphere("GoblinEyeL", (-.14, -.34, 2.04), .055, GOBLIN_EYE, 1))
    objects.append(add_icosphere("GoblinEyeR", (.14, -.34, 2.04), .055, GOBLIN_EYE, 1))
    objects.append(add_cone("GoblinHelmet", (0, 0, 2.22), .45, .10, .55, METAL, 9))
    objects.append(add_box("GoblinHelmetBand", (0, -.31, 2.13), (.34, .09, .07), LEATHER, bevel=.03))
    # Limbs and club.
    for side in (-1, 1):
        objects.append(cylinder_between(f"GoblinArm_{side}", (side * .31, 0, 1.48), (side * .55, -.08, .86), .12, GOBLIN_SKIN, 8))
        objects.append(cylinder_between(f"GoblinLeg_{side}", (side * .19, 0, .92), (side * .25, -.04, .18), .15, GOBLIN_DARK, 8))
        objects.append(add_box(f"GoblinBoot_{side}", (side * .25, -.17, .12), (.18, .28, .11), LEATHER, bevel=.05))
    objects.append(cylinder_between("GoblinClubHandle", (.52, -.08, .9), (.82, -.12, 1.82), .075, WOOD_DARK, 8))
    objects.append(add_cone("GoblinClubHead", (.86, -.13, 1.98), .18, .13, .58, WOOD, 8, rotation=(0, .25, 0)))
    for obj in objects:
        obj["kind"] = "goblin"
    return objects


def build_arms():
    objects = []
    for side in (-1, 1):
        x = side * .36
        # Blender +Y maps to Three.js camera-forward -Z in glTF.
        sleeve_start = (x * 1.25, -.05, -.42)
        elbow = (x, .62, -.48)
        wrist = (side * .24, 1.18, -.30)
        forearm = Vector(elbow).lerp(Vector(wrist), .46)
        objects.append(cylinder_between(f"Arm_{side}_Sleeve", sleeve_start, elbow, .175, SLEEVE, 10))
        objects.append(cylinder_between(f"Arm_{side}_Forearm", elbow, wrist, .125, SKIN, 10))
        objects.append(cylinder_between(f"Arm_{side}_Bracer", forearm, wrist, .145, LEATHER, 10))
        for band, factor in enumerate((.48, .66, .84, .96)):
            center = Vector(elbow).lerp(Vector(wrist), factor)
            direction = (Vector(wrist) - Vector(elbow)).normalized()
            half = .025 if band in (1, 2) else .04
            objects.append(cylinder_between(
                f"Arm_{side}_BracerBand{band}", center - direction * half,
                center + direction * half, .152 - band * .004,
                METAL if band in (0, 3) else SKIN_LIGHT, 11,
            ))

        palm_center = Vector((wrist[0], wrist[1] + .13, wrist[2]))
        palm = add_box(f"Arm_{side}_Hand", palm_center, (.115, .16, .065), SKIN_LIGHT, bevel=.065)
        objects.append(palm)
        knuckles = add_icosphere(f"Arm_{side}_Knuckles", palm_center + Vector((0, .14, .004)), .105, SKIN_LIGHT, 2)
        knuckles.scale = (1.05, .58, .55)
        objects.append(knuckles)

        roots = (-.073, -.025, .026, .074)
        lengths = ((.080, .060, .046), (.090, .068, .052), (.085, .065, .050), (.071, .055, .043))
        for finger, (offset, segments) in enumerate(zip(roots, lengths)):
            point = palm_center + Vector((side * offset, .145, .005))
            curl = (.018, .040, .050)
            for joint, length in enumerate(segments):
                target = point + Vector((side * (finger - 1.5) * .003, length, -curl[joint]))
                radius = (.027, .024, .021)[joint] * (1 - abs(finger - 1.5) * .035)
                objects.append(cylinder_between(f"Arm_{side}_Finger{finger}_Phalanx{joint}", point, target, radius, SKIN_LIGHT, 7))
                joint_mesh = add_icosphere(f"Arm_{side}_Finger{finger}_Joint{joint}", target, radius * .96, SKIN_LIGHT, 1)
                objects.append(joint_mesh)
                point = target
            nail = add_icosphere(f"Arm_{side}_Finger{finger}_Nail", point + Vector((0, -.018, -.012)), .018, NAIL, 1)
            nail.scale = (.72, 1.0, .24)
            objects.append(nail)

        thumb_start = palm_center + Vector((-side * .105, .015, .005))
        thumb_mid = thumb_start + Vector((-side * .075, .052, -.025))
        thumb_end = thumb_mid + Vector((side * .012, .055, -.038))
        objects.append(cylinder_between(f"Arm_{side}_ThumbProximal", thumb_start, thumb_mid, .034, SKIN_LIGHT, 8))
        objects.append(add_icosphere(f"Arm_{side}_ThumbJoint", thumb_mid, .033, SKIN_LIGHT, 1))
        objects.append(cylinder_between(f"Arm_{side}_ThumbDistal", thumb_mid, thumb_end, .029, SKIN_LIGHT, 8))
        objects.append(add_icosphere(f"Arm_{side}_ThumbTip", thumb_end, .027, SKIN_LIGHT, 1))
    return objects


def build_note():
    objects = [add_box("NoteParchment", (0, 0, .03), (.32, .23, .025), PAPER, bevel=.045)]
    for side in (-1, 1):
        objects.append(add_cylinder(f"NoteRoll_{side}", (side * .30, 0, .04), .045, .46, PAPER, 8, rotation=(math.pi / 2, 0, 0)))
    for index in range(3):
        objects.append(add_box(f"NoteInk_{index}", (0, -.236, .09 - index * .055), (.18 - index * .025, .008, .008), METAL, bevel=.006))
    return objects


def build_stone():
    obj = add_icosphere("ThrowableStone", (0, 0, 0), .22, STONE, 2)
    obj.scale = (1.1, .85, .95)
    return [obj]


def main():
    for stage in (1, 2, 3):
        export_objects(f"fort_stage_{stage}.glb", build_fort_stage(stage))
    export_objects("catapult_intact.glb", build_catapult(False))
    export_objects("catapult_destroyed.glb", build_catapult(True))
    export_objects("goblin.glb", build_goblin())
    export_objects("first_person_arms.glb", build_arms())
    export_objects("note.glb", build_note())
    export_objects("throwable_stone.glb", build_stone())
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "first_person_gameplay_assets.blend"))


if __name__ == "__main__":
    main()
