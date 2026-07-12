import bpy
import math
import os
import random
from mathutils import Vector


ROOT = r"C:\Users\pc\Downloads\nature"
ASSET_DIR = os.path.join(ROOT, "GLTF format")
OUT_DIR = os.path.join(ROOT, "public", "assets", "forest_defense")
SPRITE_DIR = os.path.join(OUT_DIR, "sprites")
LOCATION_GLB = os.path.join(OUT_DIR, "forest_defense_location.glb")
random.seed(7319)


def clean_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials,
                       bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def material(name, color, roughness=0.82, emission=None):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = next((node for node in nodes if node.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None:
        bsdf = nodes.new('ShaderNodeBsdfPrincipled')
        output = next((node for node in nodes if node.type == 'OUTPUT_MATERIAL'), None)
        if output is None:
            output = nodes.new('ShaderNodeOutputMaterial')
        mat.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 1.5
    return mat


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def import_glb(filepath, name=None):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=filepath)
    imported = [obj for obj in bpy.context.scene.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == 'MESH']
    if not meshes:
        raise RuntimeError(f"No mesh found in {filepath}")
    if len(meshes) == 1:
        result = meshes[0]
    else:
        bpy.ops.object.select_all(action='DESELECT')
        for obj in meshes:
            if obj.parent:
                world = obj.matrix_world.copy()
                obj.parent = None
                obj.matrix_world = world
            obj.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.join()
        result = bpy.context.object
    if result.parent:
        world = result.matrix_world.copy()
        result.parent = None
        result.matrix_world = world
    for obj in imported:
        try:
            if obj != result and obj.name in bpy.data.objects:
                bpy.data.objects.remove(obj, do_unlink=True)
        except ReferenceError:
            # `bpy.ops.object.join` already removed this source object.
            pass
    if name:
        result.name = name
    return result


def circle_mesh(name, radius, z, mat, vertices=64):
    coords = [(0, 0, z)] + [
        (math.cos(i / vertices * math.tau) * radius,
         math.sin(i / vertices * math.tau) * radius,
         z)
        for i in range(vertices)
    ]
    faces = []
    for i in range(vertices):
        faces.append((0, i + 1, ((i + 1) % vertices) + 1))
    mesh = bpy.data.meshes.new(name + '_Mesh')
    mesh.from_pydata(coords, [], faces)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def add_marker(name, location, kind):
    marker = bpy.data.objects.new(name, None)
    marker.location = location
    marker.empty_display_type = 'SPHERE'
    marker.empty_display_size = 0.7
    marker['markerType'] = kind
    bpy.context.scene.collection.objects.link(marker)
    return marker


def clone_asset(master, name, location, scale=1.0, rotation=0.0):
    obj = master.copy()
    obj.data = master.data
    obj.name = name
    bpy.context.scene.collection.objects.link(obj)
    # Masters stay hidden only as import templates. Copies are real location
    # objects and must remain visible in both the editable .blend and GLB.
    obj.hide_render = False
    obj.hide_viewport = False
    obj.hide_set(False)
    obj.location = location
    obj.scale = (scale, scale, scale)
    obj.rotation_euler.z = rotation
    return obj


def build_location():
    clean_scene()
    os.makedirs(OUT_DIR, exist_ok=True)
    grass_mat = material('ClearingGrass', (0.24, 0.43, 0.13))
    dirt_mat = material('WarmClearingDirt', (0.66, 0.48, 0.21))
    path_mat = material('ForestPath', (0.58, 0.40, 0.18))
    stake_mat = material('ConstructionStake', (0.30, 0.13, 0.055))

    circle_mesh('TerrainBase', 42.0, -0.12, grass_mat, 80)
    clearing = circle_mesh('CentralClearing', 20.5, -0.08, dirt_mat, 64)
    clearing.scale.y = 0.88

    # South entrance path built from overlapping rounded low-poly patches.
    for index in range(10):
        t = index / 9
        x = math.sin(t * math.pi) * 1.3
        y = -41 + t * 25
        patch = circle_mesh(f'PathPatch_{index:02d}', 3.7 + t * 0.5, -0.055 + index * 0.0002, path_mat, 18)
        patch.location = (x, y, 0)
        patch.scale.x = 0.7

    # Reused asset masters.
    pine_files = ['tree_pineTallA.glb', 'tree_pineTallB.glb', 'tree_pineDefaultA.glb', 'tree_pineDefaultB.glb']
    pine_masters = [import_glb(os.path.join(ASSET_DIR, file), f'_MASTER_{file[:-4]}') for file in pine_files]
    for master in pine_masters:
        master.hide_render = True

    # Dense but navigable forest ring; southern gate corridor stays open.
    tree_index = 0
    for ring, count in ((30.0, 26), (36.0, 34)):
        for i in range(count):
            angle = i / count * math.tau + (0.07 if ring > 32 else 0)
            if -1.86 < math.atan2(math.sin(angle), math.cos(angle)) < -1.28:
                continue
            jitter = random.uniform(-1.5, 1.5)
            radius = ring + jitter
            x, y = math.cos(angle) * radius, math.sin(angle) * radius
            master = pine_masters[tree_index % len(pine_masters)]
            clone_asset(master, f'ForestPine_{tree_index:03d}', (x, y, 0), random.uniform(7.3, 10.2), random.uniform(0, math.tau))
            tree_index += 1

    oak_master = import_glb(os.path.join(ASSET_DIR, 'tree_oak.glb'), '_MASTER_tree_oak')
    oak_master.hide_render = True
    chop_positions = [(-17, -9, 0), (17, -10, 0), (21, 8, 0), (-21, 11, 0), (12, 18, 0)]
    for index, pos in enumerate(chop_positions, 1):
        tree = clone_asset(oak_master, f'ChoppableTree_{index:02d}', pos, 8.0, random.uniform(0, math.tau))
        tree['choppable'] = True

    rock_master_a = import_glb(os.path.join(ASSET_DIR, 'rock_largeA.glb'), '_MASTER_rock_large')
    rock_master_b = import_glb(os.path.join(ASSET_DIR, 'rock_smallC.glb'), '_MASTER_rock_small')
    rock_master_a.hide_render = rock_master_b.hide_render = True
    rock_positions = [(-25,-16,2.2),(25,-14,1.8),(-29,5,1.5),(28,12,2.0),(-14,26,1.3),(16,27,1.8),(6,-28,1.0)]
    for index, (x,y,scale) in enumerate(rock_positions):
        clone_asset(rock_master_a if index % 2 == 0 else rock_master_b, f'RockCluster_{index:02d}', (x,y,0), scale, random.uniform(0,math.tau))

    grass_master = import_glb(os.path.join(ASSET_DIR, 'grass_large.glb'), '_MASTER_grass')
    grass_master.hide_render = True
    for index in range(32):
        angle = random.random() * math.tau
        radius = random.uniform(20.5, 28.5)
        clone_asset(grass_master, f'GrassPatch_{index:02d}', (math.cos(angle)*radius, math.sin(angle)*radius, 0), random.uniform(0.8,1.5), random.random()*math.tau)

    log_master = import_glb(os.path.join(ASSET_DIR, 'log_stackLarge.glb'), '_MASTER_log_stack')
    log_master.hide_render = True
    for index, pos in enumerate([(-27,-23,0),(26,-22,0),(-31,18,0)]):
        clone_asset(log_master, f'ForestLogStack_{index:02d}', pos, 2.0, random.uniform(0,math.tau))

    # Construction zone: only stakes and unloading planks in stage zero.
    for index in range(12):
        angle = index / 12 * math.tau
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.16, radius2=0.04, depth=1.1,
                                        location=(math.cos(angle)*10, math.sin(angle)*10, 0.55))
        stake = bpy.context.object
        stake.name = f'BuildStake_{index:02d}'
        stake.data.materials.append(stake_mat)
    plank_master = import_glb(os.path.join(ASSET_DIR, 'bridge_center_wood.glb'), '_MASTER_build_planks')
    plank_master.hide_render = True
    clone_asset(plank_master, 'BuildZone_Planks', (2.7,-2.4,0), 1.6, 0.35)

    markers = {
        'PlayerSpawn': (0,-15,0),
        'BuildZone': (0,0,0),
        'RepairZone': (0,-8.5,0),
        'FortGate': (0,-10,0),
        'Watchtower': (4.8,4.0,0),
        'TowerStoneSpawn': (4.8,4.0,7.5),
        'TowerPlayerPosition': (4.8,4.0,7.0),
        'GoblinSpawn_A': (-28,0,0),
        'GoblinSpawn_B': (25,16,0),
        'GoblinSpawn_C': (24,-18,0),
        'CatapultSpawn_A': (-27,14,0),
        'CatapultSpawn_B': (28,13,0),
        'CatapultSpawn_C': (2,31,0),
        'NoteDropZone': (0,15,0),
    }
    for name, pos in markers.items():
        add_marker(name, pos, name)

    # Delete master objects while linked clones retain shared mesh data.
    for master in pine_masters + [oak_master, rock_master_a, rock_master_b, grass_master, log_master, plank_master]:
        bpy.data.objects.remove(master, do_unlink=True)

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT_DIR, 'forest_defense_location.blend'))
    bpy.ops.export_scene.gltf(
        filepath=LOCATION_GLB,
        export_format='GLB',
        export_apply=True,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
    )
    print(f'EXPORTED_LOCATION={LOCATION_GLB}')


def render_sprite(asset_file, output_name):
    clean_scene()
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = True
    scene.view_settings.look = 'AgX - Medium High Contrast'

    obj = import_glb(os.path.join(ASSET_DIR, asset_file), output_name)
    bpy.context.view_layer.update()
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    min_v = Vector((min(v.x for v in corners), min(v.y for v in corners), min(v.z for v in corners)))
    max_v = Vector((max(v.x for v in corners), max(v.y for v in corners), max(v.z for v in corners)))
    center = (min_v + max_v) * 0.5
    obj.location.x -= center.x
    obj.location.y -= center.y
    obj.location.z -= min_v.z
    bpy.context.view_layer.update()
    width = max(max_v.x-min_v.x, max_v.y-min_v.y)
    height = max_v.z-min_v.z

    bpy.ops.object.light_add(type='AREA', location=(-4,-5,8))
    key = bpy.context.object
    key.data.energy = 900
    key.data.size = 5
    key.data.color = (1.0,0.69,0.38)
    look_at(key, (0,0,height*0.4))
    bpy.ops.object.light_add(type='AREA', location=(4,2,5))
    fill = bpy.context.object
    fill.data.energy = 460
    fill.data.size = 4
    fill.data.color = (0.28,0.55,1.0)
    look_at(fill, (0,0,height*0.45))

    bpy.ops.object.camera_add(location=(5.2,-7.2,5.4))
    camera = bpy.context.object
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = max(height*1.25, width*1.65, 1.4)
    look_at(camera, (0,0,height*0.46))
    scene.camera = camera
    scene.render.filepath = os.path.join(SPRITE_DIR, output_name + '.png')
    bpy.ops.render.render(write_still=True)
    print(f'RENDERED_SPRITE={output_name}')


def build_sprites():
    os.makedirs(SPRITE_DIR, exist_ok=True)
    assets = {
        'tree_pine': 'tree_pineTallA.glb',
        'tree_pine_small': 'tree_pineSmallB.glb',
        'tree_oak': 'tree_oak.glb',
        'tree_oak_fall': 'tree_oak_fall.glb',
        'stump': 'stump_roundDetailed.glb',
        'rock_large': 'rock_largeA.glb',
        'rock_small': 'rock_smallC.glb',
        'grass': 'grass_large.glb',
        'log': 'log_large.glb',
        'log_stack': 'log_stackLarge.glb',
        'fence': 'fence_simpleHigh.glb',
        'gate': 'fence_gate.glb',
        'tent': 'tent_detailedOpen.glb',
        'campfire': 'campfire_logs.glb',
        'pot': 'pot_large.glb',
    }
    for output_name, asset_file in assets.items():
        render_sprite(asset_file, output_name)


if __name__ == '__main__':
    build_location()
    build_sprites()
