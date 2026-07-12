import bpy


def connected_components(obj):
    adjacency = [set() for _ in obj.data.vertices]
    for edge in obj.data.edges:
        a, b = edge.vertices
        adjacency[a].add(b)
        adjacency[b].add(a)
    unseen = set(range(len(adjacency)))
    components = []
    while unseen:
        root = unseen.pop()
        stack = [root]
        component = [root]
        while stack:
            vertex = stack.pop()
            for neighbour in adjacency[vertex]:
                if neighbour in unseen:
                    unseen.remove(neighbour)
                    stack.append(neighbour)
                    component.append(neighbour)
        zs = [obj.data.vertices[index].co.z for index in component]
        components.append((len(component), min(zs), max(zs)))
    return sorted(components, reverse=True)


for name in (
    'TREE_STATE_00_INTACT',
    'TREE_STATE_25_BOOLEAN_CUT',
    'TREE_STATE_50_BOOLEAN_CUT',
    'TREE_STATE_75_BOOLEAN_CUT',
    'TREE_STATE_90_BOOLEAN_CUT',
):
    obj = bpy.data.objects[name]
    components = connected_components(obj)
    spanning = [c for c in components if c[1] < 1.20 and c[2] > 1.40]
    print('CONNECTIVITY', name, 'SPANNING', spanning, 'TOP', components[:10])


scene = bpy.context.scene
tree_objects = [obj for obj in scene.objects if obj.type == 'MESH' and obj.name.startswith('TREE_')]
visibility_errors = []
for frame in range(scene.frame_start, scene.frame_end + 1):
    scene.frame_set(frame)
    visible = [obj.name for obj in tree_objects if not obj.hide_render]
    expected = 2 if frame >= 110 else 1
    if len(visible) != expected:
        visibility_errors.append((frame, visible))
print('VISIBILITY_ERRORS', visibility_errors)

forbidden = [
    obj.name for obj in scene.objects
    if any(token in obj.name for token in ('TEMP', 'CUTTER', 'CUT_STAGE'))
]
print('FORBIDDEN_OBJECTS', forbidden)

low_face_render_meshes = [
    (obj.name, len(obj.data.polygons))
    for obj in scene.objects
    if obj.type == 'MESH' and not obj.hide_render and len(obj.data.polygons) <= 2
]
print('LOW_FACE_RENDER_MESHES', low_face_render_meshes)

scene.frame_set(110)
stump = bpy.data.objects['TREE_STUMP__final_boolean_cut']
crown = bpy.data.objects['TREE_CROWN__falling_boolean_cut']
stump_vertices = [stump.matrix_world @ vertex.co for vertex in stump.data.vertices]
crown_vertices = [crown.matrix_world @ vertex.co for vertex in crown.data.vertices]
minimum_contact_distance = min((a - b).length for a in stump_vertices for b in crown_vertices)
print('HINGE_CONTACT_MIN_DISTANCE', minimum_contact_distance)

scene.frame_set(144)
crown_z = [(crown.matrix_world @ vertex.co).z for vertex in crown.data.vertices]
print('FINAL_CROWN_Z_MIN_MAX', min(crown_z), max(crown_z))

remaining_fx = []
for obj in scene.objects:
    if obj.name.startswith(('Chip_', 'Spark_')) and max(abs(value) for value in obj.scale) > 0.01:
        remaining_fx.append((obj.name, tuple(obj.scale)))
print('VISIBLE_FINAL_FX', remaining_fx)
print('MARKERS', [(marker.name, marker.frame) for marker in scene.timeline_markers])
