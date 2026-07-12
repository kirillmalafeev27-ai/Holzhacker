from pathlib import Path
import subprocess
import sys


ROOT = Path(r"C:\Users\pc\Downloads\nature")
sys.path.insert(0, str(ROOT / ".video_tools"))
import imageio_ffmpeg


ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
video = ROOT / "tree_chop_preview.mp4"
decoded = ROOT / "validation" / "mp4_decoded"
decoded.mkdir(parents=True, exist_ok=True)
all_decoded = ROOT / "validation" / "mp4_all_frames"
all_decoded.mkdir(parents=True, exist_ok=True)

# Decode every frame. Any corrupt frame makes this command fail.
subprocess.run(
    [ffmpeg, "-v", "error", "-i", str(video), "-map", "0:v:0", "-f", "null", "NUL"],
    check=True,
)

for stale in all_decoded.glob("mp4_*.png"):
    stale.unlink()
subprocess.run(
    [
        ffmpeg, "-y", "-v", "error", "-i", str(video),
        "-vsync", "0", str(all_decoded / "mp4_%04d.png"),
    ],
    check=True,
)

# Extract acceptance frames from the MP4 itself, not from the PNG source sequence.
selected = [0, 35, 57, 79, 101, 109, 121, 135, 143]
expression = "+".join(f"eq(n\\,{frame})" for frame in selected)
subprocess.run(
    [
        ffmpeg, "-y", "-v", "error", "-i", str(video),
        "-vf", f"select={expression}", "-vsync", "0",
        str(decoded / "decoded_%02d.png"),
    ],
    check=True,
)

print("FULL_DECODE_OK=True")
print("DECODED_ACCEPTANCE_FRAMES=", len(list(decoded.glob("decoded_*.png"))))
print("DECODED_ALL_FRAMES=", len(list(all_decoded.glob("mp4_*.png"))))
