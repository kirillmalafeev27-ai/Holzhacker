import bpy
import bmesh
import math
import os
import random
from mathutils import Vector, Quaternion


ROOT = r"C:\Users\pc\Downloads\nature"
ASSET_DIR = os.path.join(ROOT, "GLTF format")
OUT_BLEND = os.path.join(ROOT, "tree_chop_simulation.blend")
PREVIEW_DIR = os.path.join(ROOT, "preview_frames")
random.seed(2407)


def clean_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials,
                       bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def mat(name, color, metallic=0.0, roughness=0.5, emission=None, strength=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*color[:3], color[3] if len(color) > 3 else 1.0)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = m.diffuse_color
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    alpha = color[3] if len(color) > 3 else 1.0
    bsdf.inputs['Alpha'].default_value = alpha
    if alpha < 1.0 and hasattr(m, 'surface_render_method'):
        m.surface_render_method = 'DITHERED'
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1.0)
        bsdf.inputs['Emission Strength'].default_value = strength
    return m


def wood_ring_material():
    """Warm procedural wood grain used on every cut surface (no dark cavity)."""
    m = mat('Fresh wood texture', (0.93, 0.40, 0.085, 1), roughness=0.62)
    nodes = m.node_tree.nodes
    links = m.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    tex = nodes.new('ShaderNodeTexCoord')
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 6.0
    noise.inputs['Detail'].default_value = 4.0
    noise.inputs['Roughness'].default_value = 0.72
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.24
    ramp.color_ramp.elements[0].color = (0.72, 0.24, 0.035, 1)
    ramp.color_ramp.elements[1].position = 0.78
    ramp.color_ramp.elements[1].color = (1.0, 0.66, 0.18, 1)
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.16
    bump.inputs['Distance'].default_value = 0.06
    links.new(tex.outputs['Generated'], noise.inputs['Vector'])
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return m


def set_collection(obj, collection):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    collection.objects.link(obj)


def new_collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


def import_glb(filename, name, collection):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ASSET_DIR, filename))
    imported = [o for o in bpy.context.scene.objects if o not in before]
    meshes = [o for o in imported if o.type == 'MESH']
    if not meshes:
        raise RuntimeError(f"No mesh in {filename}")
    obj = meshes[0]
    obj.name = name
    if obj.parent:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = world
    for extra in imported:
        if extra != obj:
            bpy.data.objects.remove(extra, do_unlink=True)
    set_collection(obj, collection)
    return obj


def apply_transform(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)


def bisect_copy(source, name, cut_z, keep_above, cut_material, collection):
    obj = source.copy()
    obj.data = source.data.copy()
    obj.animation_data_clear()
    obj.hide_render = False
    obj.hide_viewport = False
    obj.name = name
    collection.objects.link(obj)
    obj.data.materials.append(cut_material)
    cut_mat_index = len(obj.data.materials) - 1

    bm = bmesh.new()
    bm.from_mesh(obj.data)
    result = bmesh.ops.bisect_plane(
        bm,
        geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
        dist=0.0001,
        plane_co=(0.0, 0.0, cut_z),
        plane_no=(0.0, 0.0, 1.0),
        clear_inner=keep_above,
        clear_outer=not keep_above,
    )
    boundary = [
        e for e in bm.edges
        if len(e.link_faces) == 1 and all(abs(v.co.z - cut_z) < 0.002 for v in e.verts)
    ]
    if boundary:
        fill = bmesh.ops.triangle_fill(bm, edges=boundary, use_beauty=True)
        for face in fill.get('geom', []):
            if isinstance(face, bmesh.types.BMFace):
                face.material_index = cut_mat_index
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return obj


def set_stage_visibility(obj, start, end=None):
    """Make one complete tree state visible only in its intended frame range."""
    obj.hide_render = True
    obj.hide_viewport = True
    key(obj, 'hide_render', 1)
    key(obj, 'hide_viewport', 1)
    if start > 1:
        obj.hide_render = True
        obj.hide_viewport = True
        key(obj, 'hide_render', start - 1)
        key(obj, 'hide_viewport', start - 1)
    obj.hide_render = False
    obj.hide_viewport = False
    key(obj, 'hide_render', start)
    key(obj, 'hide_viewport', start)
    if end is not None:
        obj.hide_render = False
        obj.hide_viewport = False
        key(obj, 'hide_render', end - 1)
        key(obj, 'hide_viewport', end - 1)
        obj.hide_render = True
        obj.hide_viewport = True
        key(obj, 'hide_render', end)
        key(obj, 'hide_viewport', end)
    set_interpolation(obj, 'CONSTANT')


def make_wedge_cutter(name, cut_z, depth, height, front_dir, collection, materials, wood_index):
    """Closed triangular prism used only long enough to apply a Boolean difference."""
    front = Vector((front_dir[0], front_dir[1], 0.0)).normalized()
    side = Vector((-front.y, front.x, 0.0))
    # At the chosen cut height this asset's trunk is ~0.64 m across X.
    # Put the mouth just outside the bark so `depth` measures real penetration.
    mouth_center = front * 0.38
    apex = mouth_center - front * depth
    half_width = 1.34
    verts = []
    for lateral in (-half_width, half_width):
        base = mouth_center + side * lateral
        verts.extend([
            (base.x, base.y, cut_z + height * 0.5),
            (base.x, base.y, cut_z - height * 0.5),
            (apex.x + side.x * lateral, apex.y + side.y * lateral, cut_z),
        ])
    faces = [
        (0, 2, 1), (3, 4, 5),
        (0, 3, 5, 2),
        (1, 2, 5, 4),
        (0, 1, 4, 3),
    ]
    mesh = bpy.data.meshes.new(name + '_Mesh')
    mesh.from_pydata(verts, [], faces)
    for material in materials:
        mesh.materials.append(material)
    for poly in mesh.polygons:
        poly.material_index = wood_index
    cutter = bpy.data.objects.new(name, mesh)
    collection.objects.link(cutter)
    cutter.display_type = 'WIRE'
    cutter.hide_render = True
    return cutter


def boolean_damage_state(source, name, percent, depth, height, cut_z, front_dir,
                         wood_cut, target_collection, helper_collection):
    """Return a full tree mesh with a physically removed V-shaped volume."""
    obj = source.copy()
    obj.data = source.data.copy()
    obj.name = name
    target_collection.objects.link(obj)
    obj.data.materials.append(wood_cut)
    wood_index = len(obj.data.materials) - 1
    cutter = make_wedge_cutter(
        f'__TEMP_BOOLEAN_CUTTER_{percent}', cut_z, depth, height, front_dir,
        helper_collection, list(obj.data.materials), wood_index,
    )
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    cutter.select_set(False)
    mod = obj.modifiers.new(f'APPLIED_V_CUT_{percent}', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    if hasattr(mod, 'material_mode'):
        mod.material_mode = 'TRANSFER'
    mod.object = cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)
    bpy.data.objects.remove(cutter, do_unlink=True)
    obj['CUT_PERCENT'] = percent
    obj['CUT_DEPTH'] = depth
    return obj


def union_visible_hinge(obj, percent, location, half_scale, helper_collection, material_index=1):
    """Restore a small rear fibre bridge as applied geometry, not a renderable helper."""
    bridge = cube_obj(
        f'__TEMP_HINGE_UNION_{percent}', location, half_scale, None,
        helper_collection, bevel=0.0,
    )
    for material in obj.data.materials:
        bridge.data.materials.append(material)
    for poly in bridge.data.polygons:
        poly.material_index = material_index
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bridge.select_set(False)
    mod = obj.modifiers.new(f'APPLIED_REAR_HINGE_{percent}', 'BOOLEAN')
    mod.operation = 'UNION'
    mod.solver = 'EXACT'
    if hasattr(mod, 'material_mode'):
        mod.material_mode = 'TRANSFER'
    mod.object = bridge
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)
    bpy.data.objects.remove(bridge, do_unlink=True)
    obj['VISIBLE_HINGE_APPLIED'] = True


def union_hinge_fiber(obj, percent, start, end, radius, helper_collection):
    """Applied low-poly diagonal wood fibre joining both sides of the deepest notch."""
    start = Vector(start)
    end = Vector(end)
    direction = end - start
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=6,
        radius=radius,
        depth=direction.length,
        location=(start + end) * 0.5,
    )
    fiber = bpy.context.object
    fiber.name = f'__TEMP_HINGE_FIBER_{percent}'
    fiber.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
    apply_transform(fiber)
    set_collection(fiber, helper_collection)
    for material in obj.data.materials:
        fiber.data.materials.append(material)
    wood_index = len(obj.data.materials) - 1
    for poly in fiber.data.polygons:
        poly.material_index = wood_index
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    fiber.select_set(False)
    mod = obj.modifiers.new(f'APPLIED_WOOD_FIBER_{percent}', 'BOOLEAN')
    mod.operation = 'UNION'
    mod.solver = 'EXACT'
    if hasattr(mod, 'material_mode'):
        mod.material_mode = 'TRANSFER'
    mod.object = fiber
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)
    bpy.data.objects.remove(fiber, do_unlink=True)
    obj['VISIBLE_HINGE_APPLIED'] = True


def cube_obj(name, location, scale, material, collection, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    apply_transform(o)
    if material:
        o.data.materials.append(material)
    if bevel:
        mod = o.modifiers.new('Soft bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
    set_collection(o, collection)
    return o


def ico_obj(name, location, radius, material, collection, subdivisions=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius, location=location)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(material)
    set_collection(o, collection)
    return o


def cylinder_obj(name, location, radius, depth, material, collection, vertices=10):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(material)
    set_collection(o, collection)
    return o


def look_at(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def key(obj, data_path, frame):
    obj.keyframe_insert(data_path=data_path, frame=frame)


def set_interpolation(obj, mode='BEZIER'):
    if obj.animation_data and obj.animation_data.action:
        action = obj.animation_data.action
        if hasattr(action, 'fcurves'):
            curves = action.fcurves
        else:
            curves = [fc for layer in action.layers for strip in layer.strips
                      for bag in strip.channelbags for fc in bag.fcurves]
        for fc in curves:
            for kp in fc.keyframe_points:
                kp.interpolation = mode


def triangle_mesh(name, points, material, collection):
    mesh = bpy.data.meshes.new(name + '_Mesh')
    mesh.from_pydata(points, [], [(0, 1, 2)])
    mesh.materials.append(material)
    o = bpy.data.objects.new(name, mesh)
    collection.objects.link(o)
    return o


def wood_shard_obj(name, location, size, material, collection):
    """Small irregular low-poly splinter, deliberately not a repeated cube."""
    verts = [
        (-0.75, -0.20, -0.12), (0.80, -0.10, 0.0),
        (-0.48, 0.20, -0.18), (-0.38, -0.15, 0.22),
        (0.42, 0.11, 0.08),
    ]
    faces = [(0,1,2),(0,3,1),(1,3,4),(1,4,2),(2,4,3),(0,2,3)]
    mesh = bpy.data.meshes.new(name + '_Mesh')
    mesh.from_pydata([(x*size, y*size, z*size) for x,y,z in verts], [], faces)
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.location = location
    return obj


def curve_stroke(name, points, bevel, material, collection):
    curve = bpy.data.curves.new(name + '_Curve', 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 1
    curve.bevel_depth = bevel
    curve.bevel_resolution = 1
    spline = curve.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for p, co in zip(spline.points, points):
        p.co = (*co, 1.0)
    o = bpy.data.objects.new(name, curve)
    curve.materials.append(material)
    collection.objects.link(o)
    return o


def make_axe(collection, handle_mat, metal_mat):
    rig = bpy.data.objects.new('AXE_RIG__animated', None)
    collection.objects.link(rig)

    handle = cylinder_obj('Axe_Handle', (0, 0, 1.05), 0.075, 2.1, handle_mat, collection, vertices=10)
    handle.parent = rig

    verts = [
        (-0.24, -0.10, -0.13), (0.48, -0.10, -0.20), (0.48, -0.10, 0.28), (-0.24, -0.10, 0.13),
        (-0.24,  0.10, -0.13), (0.48,  0.10, -0.20), (0.48,  0.10, 0.28), (-0.24,  0.10, 0.13),
    ]
    faces = [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(4,0,3,7)]
    mesh = bpy.data.meshes.new('Axe_Head_Mesh')
    mesh.from_pydata(verts, [], faces)
    head = bpy.data.objects.new('Axe_Head', mesh)
    collection.objects.link(head)
    head.data.materials.append(metal_mat)
    head.location = (0.0, 0.0, 2.04)
    head.parent = rig

    # Positioned so the blade reaches the +X side Boolean notch, not the trunk centre.
    rig.location = (2.11, -0.45, 0.20)
    impacts = [36, 58, 80, 102]
    for i, f in enumerate(impacts):
        rig.rotation_euler = (math.radians(-4), math.radians(24), math.radians(-5))
        key(rig, 'rotation_euler', f - 10)
        rig.rotation_euler = (0.0, math.radians(-60), math.radians(2))
        key(rig, 'rotation_euler', f)
        rig.rotation_euler = (math.radians(2), math.radians(-18), math.radians(-2))
        key(rig, 'rotation_euler', f + 4)
    rig.rotation_euler = (0.0, math.radians(18), math.radians(-6))
    key(rig, 'rotation_euler', 112)
    set_interpolation(rig, 'BEZIER')
    return rig


def create_impact_fx(frame, idx, impact, chips_col, sparks_col, chip_mat, spark_mats):
    # Chunky wood chips: three-position ballistic keys make them readable even in viewport playback.
    for j in range(6):
        size = random.uniform(0.045, 0.105)
        chip = wood_shard_obj(f'Chip_H{idx+1}_{j+1:02d}', impact, size * 2.2, chip_mat, chips_col)
        chip.scale = (0.001, 0.001, 0.001)
        key(chip, 'scale', frame - 1)
        chip.scale = (1, 1, 1)
        key(chip, 'scale', frame)
        chip.rotation_euler = tuple(random.uniform(-1.0, 1.0) for _ in range(3))
        key(chip, 'rotation_euler', frame)
        vx = random.uniform(-0.18, 0.32)
        vy = random.uniform(-0.18, -0.48)
        vz = random.uniform(0.12, 0.38)
        chip.location = Vector(impact) + Vector((vx * 5, vy * 4, vz * 5))
        chip.rotation_euler = tuple(random.uniform(-4, 4) for _ in range(3))
        key(chip, 'location', frame + 6)
        key(chip, 'rotation_euler', frame + 6)
        chip.location += Vector((vx * 4, vy * 3, -random.uniform(0.3, 0.8)))
        chip.scale = (0.35, 0.35, 0.35)
        key(chip, 'location', frame + 14)
        key(chip, 'scale', frame + 14)
        chip.scale = (0.001, 0.001, 0.001)
        key(chip, 'scale', frame + 18)

    # Emissive streaks preserve the spark burst requested in the reference.
    for j in range(6):
        direction = Vector((random.uniform(-0.8, 0.8), random.uniform(-1.0, -0.15), random.uniform(-0.45, 1.0))).normalized()
        length = random.uniform(0.20, 0.48)
        spark = cylinder_obj(f'Spark_H{idx+1}_{j+1:02d}', impact, 0.012, length,
                             random.choice(spark_mats), sparks_col, vertices=6)
        spark.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
        spark.scale = (0.01, 0.01, 0.01)
        key(spark, 'scale', frame - 1)
        spark.scale = (1, 1, 1)
        key(spark, 'scale', frame)
        spark.location = Vector(impact) + direction * random.uniform(0.55, 1.25)
        key(spark, 'location', frame + 3)
        spark.scale = (0.01, 0.01, 0.01)
        key(spark, 'scale', frame + 5)


def create_dust_burst(frame, center, collection, dust_mat, prefix, count=9, spread=2.0):
    for i in range(count):
        p = Vector(center) + Vector((random.uniform(-0.5,0.5), random.uniform(-0.35,0.35), random.uniform(0.05,0.35)))
        puff = ico_obj(f'{prefix}_{i+1:02d}', p, random.uniform(0.22,0.5), dust_mat, collection, subdivisions=2)
        puff.scale = (0.01,0.01,0.01)
        key(puff, 'scale', frame-1)
        puff.scale = (0.65,0.65,0.65)
        key(puff, 'scale', frame+2)
        puff.location += Vector((random.uniform(-spread,spread), random.uniform(-0.6,0.6), random.uniform(0.3,1.0)))
        puff.scale = (1.8,1.8,1.8)
        key(puff, 'location', frame+14)
        key(puff, 'scale', frame+14)
        puff.scale = (0.01,0.01,0.01)
        key(puff, 'scale', frame+22)


def build():
    clean_scene()
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 144
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 640
    scene.render.resolution_y = 360
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.fps = 24
    scene.render.fps_base = 1.0
    scene.render.filepath = os.path.join(PREVIEW_DIR, 'chop_')
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.image_settings.color_depth = '8'
    scene.render.resolution_percentage = 100
    scene.render.use_file_extension = True
    scene.render.film_transparent = False
    scene.world.color = (0.015, 0.025, 0.035)

    # Color management: saturated low-poly look, close to the supplied reference.
    scene.view_settings.look = 'AgX - Medium High Contrast'

    env_col = new_collection('01_ENVIRONMENT__assets')
    tree_col = new_collection('02_HERO_TREE__real_cut')
    damage_col = new_collection('03_TREE_DAMAGE_STATES__boolean_applied')
    helper_col = new_collection('__TEMP_BOOLEAN_HELPERS__deleted_before_save')
    axe_col = new_collection('04_AXE__4_hits')
    chips_col = new_collection('05_WOOD_CHIPS__animated')
    sparks_col = new_collection('06_SPARKS__animated')
    rig_col = new_collection('07_RIGS_AND_CAMERA')

    ground_mat = mat('Ground moss', (0.085, 0.23, 0.075, 1), roughness=0.92)
    wood_cut = wood_ring_material()
    handle_mat = mat('Axe handle', (0.30, 0.075, 0.022, 1), roughness=0.65)
    metal_mat = mat('Axe forged steel', (0.075, 0.105, 0.13, 1), metallic=0.82, roughness=0.27)
    chip_mat = mat('Flying fresh wood', (1.0, 0.35, 0.045, 1), roughness=0.5,
                   emission=(0.45,0.055,0.004), strength=0.3)
    spark_orange = mat('Spark orange', (1.0,0.09,0.005,1), roughness=0.25,
                       emission=(1.0,0.025,0.001), strength=14.0)
    spark_gold = mat('Spark gold', (1.0,0.55,0.015,1), roughness=0.25,
                     emission=(1.0,0.12,0.002), strength=18.0)

    # Ground and asset dressing.
    cube_obj('Ground_Base', (0,0,-0.28), (8.5,6.2,0.28), ground_mat, env_col, bevel=0.20)
    grass_asset = import_glb('grass_large.glb', 'ASSET_grass_master', env_col)
    grass_asset.scale = (1.5,1.5,1.5)
    grass_asset.location = (-2.8,0.7,0.0)
    for i, (x,y,s,r) in enumerate([
        (-5.5,-0.8,1.2,0.2),(-4.0,2.4,1.5,1.1),(-1.8,-1.1,1.1,2.0),
        (2.3,1.7,1.3,0.7),(4.5,-1.4,1.6,2.5),(5.4,2.6,1.0,0.4),
        (0.9,2.9,1.1,1.7),(3.2,-2.7,1.2,2.2),(-6.0,2.7,1.4,2.9)]):
        g = grass_asset.copy()
        g.data = grass_asset.data
        g.name = f'ASSET_grass_{i+1:02d}'
        env_col.objects.link(g)
        g.location = (x,y,0.0)
        g.scale = (s,s,s)
        g.rotation_euler.z = r
    bpy.data.objects.remove(grass_asset, do_unlink=True)

    for i, (fname, loc, sc) in enumerate([
        ('rock_smallC.glb',(-3.8,1.7,0.0),0.75),
        ('rock_smallA.glb',(3.5,2.2,0.0),0.6),
        ('rock_smallF.glb',(4.7,-2.1,0.0),0.85),
    ]):
        rock = import_glb(fname, f'ASSET_rock_{i+1:02d}', env_col)
        rock.location = loc
        rock.scale = (sc,sc,sc)
        rock.rotation_euler.z = random.uniform(0, math.tau)

    # Build five complete states of the same supplied oak. Damage is applied Boolean
    # geometry: there are no renderable wedges, plates or proxy triangles in the file.
    intact = import_glb('tree_oak.glb', 'TREE_STATE_00_INTACT', damage_col)
    intact.scale = (5.25,5.25,5.25)
    intact.location = (0,0,0.27)
    intact.rotation_euler.z = math.radians(-8)
    apply_transform(intact)
    cut_z = 1.27
    # Side-facing notch: the main camera sees both depth and the opposite hinge.
    cut_front = Vector((1.0, 0.0, 0.0))
    state_specs = [
        (25, 0.23, 0.38, 36, 58),
        (50, 0.39, 0.50, 58, 80),
        (75, 0.54, 0.62, 80, 102),
        (90, 0.64, 0.72, 102, 110),
    ]
    states = {0: intact}
    for percent, depth, height, start, end in state_specs:
        states[percent] = boolean_damage_state(
            intact,
            f'TREE_STATE_{percent:02d}_BOOLEAN_CUT',
            percent, depth, height, cut_z, cut_front, wood_cut,
            damage_col, helper_col,
        )
    # Make the surviving rear fibres visually unambiguous at the two deepest stages.
    # These bridges are Boolean-unioned into the tree meshes; helper cubes are deleted.
    union_hinge_fiber(
        states[75], 75,
        (-0.28,-0.34,cut_z+0.18), (-0.08,-0.18,cut_z-0.18),
        0.050, helper_col,
    )
    union_hinge_fiber(
        states[90], 90,
        (-0.30,-0.34,cut_z+0.14), (-0.16,-0.20,cut_z-0.14),
        0.034, helper_col,
    )
    set_stage_visibility(intact, 1, 36)
    for percent, _depth, _height, start, end in state_specs:
        set_stage_visibility(states[percent], start, end)

    # The temporary cutter collection is physically removed before saving.
    bpy.data.collections.remove(helper_col)

    # Split the already-notched 90% state only through its small rear hinge.
    # The V-shaped Boolean surfaces remain on both final pieces.
    stump = bisect_copy(states[90], 'TREE_STUMP__final_boolean_cut', cut_z, False, wood_cut, tree_col)
    crown = bisect_copy(states[90], 'TREE_CROWN__falling_boolean_cut', cut_z, True, wood_cut, tree_col)
    set_stage_visibility(stump, 110, None)
    set_stage_visibility(crown, 110, None)

    hinge_center = Vector((-0.23,-0.27,0.0))
    fall_axis = Vector((cut_front.y, -cut_front.x, 0.0)).normalized()
    fall_pivot = bpy.data.objects.new('TREE_FALL_PIVOT__rear_wood_hinge', None)
    rig_col.objects.link(fall_pivot)
    fall_pivot.location = (hinge_center.x, hinge_center.y, cut_z)
    crown.parent = fall_pivot
    crown.location = (-hinge_center.x, -hinge_center.y, -cut_z)
    fall_pivot.rotation_mode = 'QUATERNION'
    for frame, degrees in [(1,0),(109,0),(110,0),(114,4),(122,27),(132,61),(136,88),(141,84),(144,87)]:
        fall_pivot.rotation_quaternion = Quaternion(fall_axis, math.radians(degrees))
        key(fall_pivot, 'rotation_quaternion', frame)
    set_interpolation(fall_pivot, 'BEZIER')

    axe = make_axe(axe_col, handle_mat, metal_mat)
    impacts = [36,58,80,102]
    impact_point = (0.34,-0.45,cut_z)
    for idx, frame in enumerate(impacts):
        create_impact_fx(frame, idx, impact_point, chips_col, sparks_col, chip_mat,
                         [spark_orange, spark_gold])

    # Lighting and camera.
    bpy.ops.object.light_add(type='AREA', location=(-4.5,-5.5,9.0))
    key_light = bpy.context.object
    key_light.name = 'Key_Sunlike_Area'
    key_light.data.energy = 1300
    key_light.data.shape = 'DISK'
    key_light.data.size = 5.5
    key_light.data.color = (1.0,0.55,0.25)
    look_at(key_light, (0,0,2.0))
    set_collection(key_light, rig_col)

    bpy.ops.object.light_add(type='AREA', location=(4.0,2.0,6.0))
    fill = bpy.context.object
    fill.name = 'Cool_Fill_Area'
    fill.data.energy = 780
    fill.data.size = 4.0
    fill.data.color = (0.18,0.42,1.0)
    look_at(fill, (0,0,2.0))
    set_collection(fill, rig_col)

    bpy.ops.object.light_add(type='POINT', location=(0,-1.6,cut_z+0.25))
    impact_light = bpy.context.object
    impact_light.name = 'Impact_Flash_Light'
    impact_light.data.color = (1.0,0.12,0.01)
    impact_light.data.energy = 0
    set_collection(impact_light, rig_col)
    for f in impacts:
        impact_light.data.energy = 0
        impact_light.data.keyframe_insert('energy', frame=f-1)
        impact_light.data.energy = 950
        impact_light.data.keyframe_insert('energy', frame=f)
        impact_light.data.energy = 0
        impact_light.data.keyframe_insert('energy', frame=f+3)

    bpy.ops.object.light_add(type='AREA', location=(4.2,-4.0,3.2))
    cut_fill = bpy.context.object
    cut_fill.name = 'Cut_Surface_Warm_Fill'
    cut_fill.data.energy = 520
    cut_fill.data.size = 2.2
    cut_fill.data.color = (1.0,0.44,0.12)
    look_at(cut_fill, (0,0,cut_z))
    set_collection(cut_fill, rig_col)

    bpy.ops.object.camera_add(location=(8.0,-6.0,3.8))
    cam = bpy.context.object
    cam.name = 'CAMERA__Chop_and_Fall'
    cam.data.lens = 58
    cam.data.sensor_width = 36
    look_at(cam, (0.0,0.0,1.55))
    set_collection(cam, rig_col)
    for frame in (1, 106, 109):
        cam.location = (8.0,-6.0,3.8)
        look_at(cam, (0.0,0.0,1.55))
        key(cam, 'location', frame)
        key(cam, 'rotation_euler', frame)
        cam.data.lens = 58
        cam.data.keyframe_insert('lens', frame=frame)
    cam.location = (10.8,-17.2,7.2)
    look_at(cam, (-1.0,0.0,2.45))
    key(cam, 'location', 120)
    key(cam, 'rotation_euler', 120)
    cam.data.lens = 54
    cam.data.keyframe_insert('lens', frame=120)
    set_interpolation(cam, 'BEZIER')

    bpy.ops.object.camera_add(location=(4.9,-3.7,2.45))
    close_cam = bpy.context.object
    close_cam.name = 'CAMERA__Damage_Closeup_Validation'
    close_cam.data.lens = 72
    close_cam.data.sensor_width = 36
    look_at(close_cam, (0.0,0.0,1.28))
    set_collection(close_cam, rig_col)
    scene.camera = cam

    # Timeline organization for handoff.
    for f, name in [(36,'F1_CUT_25_PERCENT'),(58,'F2_CUT_50_PERCENT'),(80,'F3_CUT_75_PERCENT'),(102,'F4_CUT_90_PERCENT'),
                    (110,'TREE_STARTS_FALLING'),(136,'GROUND_IMPACT'),(144,'SETTLED')]:
        scene.timeline_markers.new(name, frame=f)

    # Notes stored in the scene itself for easy continuation.
    scene['README_RU'] = (
        'Удары F1-F4: 36, 58, 80, 102. Стадии 25/50/75/90 созданы применённым Boolean Difference; '
        'временные cutters удалены до сохранения. Падение начинается на 110 вокруг задней перемычки. '
        'Основная камера приближена на рубке и плавно отъезжает к кадру 120.'
    )
    scene.frame_set(1)
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    print(f'SAVED_BLEND={OUT_BLEND}')


if __name__ == '__main__':
    build()
