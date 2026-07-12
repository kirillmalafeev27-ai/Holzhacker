from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parent
FRAME_DIR = ROOT / "docs" / "video_frames"
OUTPUT = ROOT / "docs" / "forest_defense_gameplay.mp4"
frames = sorted(FRAME_DIR.glob("frame_*.png"))
if not frames:
    raise RuntimeError(f"No video frames found in {FRAME_DIR}")

scene = bpy.context.scene
scene.sequence_editor_clear()
editor = scene.sequence_editor_create()
strip_collection = editor.strips if hasattr(editor, "strips") else editor.sequences
strip = strip_collection.new_image(
    name="Forest Defense Gameplay",
    filepath=str(frames[0]),
    channel=1,
    frame_start=1,
)
for frame in frames[1:]:
    strip.elements.append(frame.name)

scene.frame_start = 1
scene.frame_end = len(frames)
scene.render.fps = 10
scene.render.resolution_x = 960
scene.render.resolution_y = 540
scene.render.resolution_percentage = 100
# Blender 5.1 accepts FFMPEG through the CLI (`-F FFMPEG`) before this script.
if scene.render.image_settings.file_format != "FFMPEG":
    raise RuntimeError("Run Blender with -F FFMPEG before --python")
scene.render.ffmpeg.format = "MPEG4"
scene.render.ffmpeg.codec = "H264"
scene.render.ffmpeg.constant_rate_factor = "MEDIUM"
scene.render.ffmpeg.ffmpeg_preset = "GOOD"
scene.render.filepath = str(OUTPUT)

bpy.ops.render.render(animation=True)
print(f"Encoded {len(frames)} frames to {OUTPUT}")
