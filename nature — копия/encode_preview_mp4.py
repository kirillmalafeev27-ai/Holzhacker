from pathlib import Path
import subprocess
import sys


ROOT = Path(r"C:\Users\pc\Downloads\nature")
sys.path.insert(0, str(ROOT / ".video_tools"))
import imageio_ffmpeg


ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
source = ROOT / "validation" / "video_frames" / "preview_%04d.png"
output = ROOT / "tree_chop_preview.mp4"

command = [
    ffmpeg,
    "-y",
    "-framerate", "24",
    "-start_number", "1",
    "-i", str(source),
    "-frames:v", "144",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    str(output),
]

print("FFMPEG=", ffmpeg)
print("ENCODING=", output)
subprocess.run(command, check=True)
print("SAVED_MP4=", output)
