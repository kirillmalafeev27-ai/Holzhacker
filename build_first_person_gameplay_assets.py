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
SKIN = material("Skin", (.50, .35, .20), .92)
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
        # Repair workbench and visible material stock.
        objects.append(add_box("RepairBench", (0, -7.3, .72), (1.4, .52, .12), WOOD_LIGHT, bevel=.04))
        for index in range(6):
            objects.append(add_cylinder(f"RepairLog_{index}", (-1.1 + index * .43, -6.7, .32 + (index % 2) * .18), .13, 2.2, WOOD, 9, rotation=(0, math.pi / 2, 0)))
    for obj in objects:
        if obj.type == "MESH":
            obj["fortStage"] = stage
    return objects


def build_catapult(destroyed=False):
    objects = []
    prefix = "DestroyedCatapult" if destroyed else "Catapult"
    # Broad frame, axle and four detailed wheels.
    objects.append(add_box(prefix + "_FrameLeft", (-.95, 0, .62), (.12, 1.65, .12), WOOD_DARK, bevel=.045))
    objects.append(add_box(prefix + "_FrameRight", (.95, 0, .62), (.12, 1.65, .12), WOOD_DARK, bevel=.045))
    objects.append(add_box(prefix + "_CrossFront", (0, -1.3, .62), (1.1, .13, .13), WOOD, bevel=.045))
    objects.append(add_box(prefix + "_CrossRear", (0, 1.3, .62), (1.1, .13, .13), WOOD, bevel=.045))
    for index, (x, y) in enumerate([(-1.15, -1.05), (1.15, -1.05), (-1.15, 1.05), (1.15, 1.05)]):
        objects.append(add_torus(prefix + f"_Wheel_{index}", (x, y, .52), .48, .10, WOOD_DARK, rotation=(math.pi / 2, 0, 0), major_segments=14))
        objects.append(add_cylinder(prefix + f"_WheelHub_{index}", (x, y, .52), .12, .32, METAL, 10, rotation=(math.pi / 2, 0, 0)))
    objects.append(cylinder_between(prefix + "_Axle", (-1.45, 0, .92), (1.45, 0, .92), .11, METAL, 10))
    # A-frame supports and rope bundles.
    objects.append(cylinder_between(prefix + "_SupportL", (-.92, -.55, .7), (0, .15, 2.8), .13, WOOD, 9))
    objects.append(cylinder_between(prefix + "_SupportR", (.92, -.55, .7), (0, .15, 2.8), .13, WOOD, 9))
    objects.append(cylinder_between(prefix + "_TopBar", (-.72, .05, 2.52), (.72, .05, 2.52), .15, WOOD_DARK, 9))
    for offset in (-.22, 0, .22):
        objects.append(add_torus(prefix + f"_Rope_{offset}", (offset, .05, 2.5), .18, .035, ROPE, rotation=(0, math.pi / 2, 0), major_segments=10))
    if destroyed:
        objects.append(add_box(prefix + "_BrokenArm", (.4, .35, 1.05), (.10, 1.65, .10), WOOD, rotation=(.72, .15, .48), bevel=.035))
        objects.append(cylinder_between(prefix + "_SplinterA", (-.6, -.3, .45), (.8, .9, .8), .07, WOOD_LIGHT, 7))
        objects.append(cylinder_between(prefix + "_SplinterB", (.7, -.4, .35), (-.4, 1.2, .55), .06, WOOD_LIGHT, 7))
    else:
        arm = add_box(prefix + "_ThrowingArm", (0, .68, 2.35), (.115, 2.15, .115), WOOD, rotation=(-.34, 0, 0), bevel=.04)
        arm["animatedPart"] = "throwingArm"
        objects.append(arm)
        objects.append(add_box(prefix + "_Bucket", (0, 2.58, 3.15), (.48, .38, .18), LEATHER, rotation=(-.34, 0, 0), bevel=.10))
        objects.append(add_icosphere(prefix + "_LoadedStone", (0, 2.55, 3.21), .28, STONE))
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
        objects.append(cylinder_between(f"Arm_{side}_Sleeve", sleeve_start, elbow, .16, SLEEVE, 10))
        objects.append(cylinder_between(f"Arm_{side}_Bracer", elbow, wrist, .14, LEATHER, 10))
        objects.append(add_torus(f"Arm_{side}_BracerBandA", elbow, .15, .018, METAL, rotation=(math.pi / 2, 0, 0), major_segments=10))
        objects.append(add_torus(f"Arm_{side}_BracerBandB", wrist, .14, .018, METAL, rotation=(math.pi / 2, 0, 0), major_segments=10))
        objects.append(add_icosphere(f"Arm_{side}_Hand", (wrist[0], wrist[1] + .13, wrist[2]), .16, SKIN, 2))
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
