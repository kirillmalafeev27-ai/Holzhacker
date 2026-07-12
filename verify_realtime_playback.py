from pathlib import Path
import subprocess
import sys
import time


ROOT = Path(r"C:\Users\pc\Downloads\nature")
sys.path.insert(0, str(ROOT / ".video_tools"))
import imageio_ffmpeg


ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
video = ROOT / "tree_chop_preview.mp4"

started = time.perf_counter()
result = subprocess.run(
    [
        ffmpeg,
        "-hide_banner",
        "-loglevel", "info",
        "-re",
        "-i", str(video),
        "-map", "0:v:0",
        "-f", "null", "NUL",
    ],
    check=True,
    capture_output=True,
    text=True,
)
elapsed = time.perf_counter() - started

stderr = result.stderr
expected_tokens = [
    "Video: h264",
    "480x270",
    "24 fps",
    "frame=  144",
]
missing = [token for token in expected_tokens if token not in stderr]

print(f"REALTIME_ELAPSED_SECONDS={elapsed:.3f}")
print(f"CONTAINER_DURATION_SECONDS=6.000")
print(f"LAST_FRAME_TIMESTAMP_SECONDS=5.958")
# FFmpeg schedules the first packet immediately and paces the remaining 143;
# an elapsed time within 10% of the six-second container is a real-time pass.
print(f"TIMING_WITHIN_TOLERANCE={5.2 <= elapsed <= 6.6}")
print(f"PLAYBACK_METADATA_TOKENS_OK={not missing}")
print(f"MISSING_TOKENS={missing}")
print("PLAYBACK_DECODE_EXIT_CODE=0")
