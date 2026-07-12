from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(r"C:\Users\pc\Downloads\nature")
VALIDATION = ROOT / "validation"


def font(size):
    candidates = [
        Path(r"C:\Windows\Fonts\arialbd.ttf"),
        Path(r"C:\Windows\Fonts\segoeuib.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def contact_sheet(paths, labels, out_path, title):
    images = [Image.open(path).convert("RGB") for path in paths]
    tile_w, tile_h = 384, 216
    title_h, label_h, pad = 58, 42, 12
    sheet = Image.new("RGB", (pad + len(images) * (tile_w + pad), title_h + tile_h + label_h + pad), (24, 27, 31))
    draw = ImageDraw.Draw(sheet)
    draw.text((pad, 12), title, fill=(246, 214, 150), font=font(28))
    for i, (img, label) in enumerate(zip(images, labels)):
        x = pad + i * (tile_w + pad)
        y = title_h
        fitted = img.resize((tile_w, tile_h), Image.Resampling.LANCZOS)
        sheet.paste(fitted, (x, y))
        draw.rectangle((x, y, x + tile_w - 1, y + tile_h - 1), outline=(227, 142, 57), width=2)
        box = draw.textbbox((0, 0), label, font=font(23))
        tx = x + (tile_w - (box[2] - box[0])) // 2
        draw.text((tx, y + tile_h + 7), label, fill=(245, 245, 240), font=font(23))
    sheet.save(out_path, quality=95)


def timeline_audit_sheet(frame_dir, out_path):
    frame_numbers = list(range(1, 145, 6))
    if frame_numbers[-1] != 144:
        frame_numbers.append(144)
    cols, rows = 5, 5
    tile_w, tile_h, header, label_h, pad = 288, 162, 48, 24, 8
    sheet = Image.new("RGB", (pad + cols * (tile_w + pad), header + rows * (tile_h + label_h + pad)), (22, 25, 29))
    draw = ImageDraw.Draw(sheet)
    draw.text((pad, 8), "Full timeline audit — sampled every 6 frames", fill=(246, 214, 150), font=font(25))
    for i, frame in enumerate(frame_numbers):
        path = frame_dir / f"preview_{frame:04d}.png"
        img = Image.open(path).convert("RGB").resize((tile_w, tile_h), Image.Resampling.LANCZOS)
        x = pad + (i % cols) * (tile_w + pad)
        y = header + (i // cols) * (tile_h + label_h + pad)
        sheet.paste(img, (x, y))
        draw.rectangle((x, y, x + tile_w - 1, y + tile_h - 1), outline=(150, 99, 46), width=1)
        draw.text((x + 6, y + tile_h + 2), f"frame {frame}", fill=(235, 235, 230), font=font(17))
    sheet.save(out_path, quality=94)


def mp4_decode_sheet(frame_dir, out_path):
    labels = ["before", "F1 / 25%", "F2 / 50%", "F3 / 75%", "F4 / 90%", "fall start", "mid fall", "impact", "final"]
    paths = [frame_dir / f"decoded_{index:02d}.png" for index in range(1, 10)]
    cols, rows = 3, 3
    tile_w, tile_h, label_h, header, pad = 480, 270, 30, 50, 10
    sheet = Image.new("RGB", (pad + cols * (tile_w + pad), header + rows * (tile_h + label_h + pad)), (22, 25, 29))
    draw = ImageDraw.Draw(sheet)
    draw.text((pad, 8), "Frames decoded from final H.264 MP4", fill=(246, 214, 150), font=font(26))
    for i, (path, label) in enumerate(zip(paths, labels)):
        img = Image.open(path).convert("RGB").resize((tile_w, tile_h), Image.Resampling.LANCZOS)
        x = pad + (i % cols) * (tile_w + pad)
        y = header + (i // cols) * (tile_h + label_h + pad)
        sheet.paste(img, (x, y))
        draw.rectangle((x, y, x + tile_w - 1, y + tile_h - 1), outline=(227, 142, 57), width=2)
        draw.text((x + 8, y + tile_h + 3), label, fill=(240, 240, 235), font=font(20))
    sheet.save(out_path, quality=95)


def all_mp4_frames_sheet(frame_dir, out_path):
    paths = sorted(frame_dir.glob("mp4_*.png"))
    if len(paths) != 144:
        raise RuntimeError(f"Expected 144 decoded MP4 frames, found {len(paths)}")
    cols, rows = 12, 12
    tile_w, tile_h, header = 160, 90, 42
    sheet = Image.new("RGB", (cols * tile_w, header + rows * tile_h), (20, 23, 27))
    draw = ImageDraw.Draw(sheet)
    draw.text((8, 7), "All 144 frames decoded from final MP4 — chronological 12 x 12", fill=(246, 214, 150), font=font(23))
    for index, path in enumerate(paths):
        img = Image.open(path).convert("RGB").resize((tile_w, tile_h), Image.Resampling.LANCZOS)
        x = (index % cols) * tile_w
        y = header + (index // cols) * tile_h
        sheet.paste(img, (x, y))
        draw.text((x + 3, y + 2), str(index + 1), fill=(255, 235, 180), font=font(12))
    sheet.save(out_path, quality=93)


def animated_preview(frame_dir, out_path):
    paths = sorted(frame_dir.glob("preview_*.png"))
    if not paths:
        raise RuntimeError(f"No preview frames in {frame_dir}")
    frames = [Image.open(path).convert("RGB") for path in paths]
    frames[0].save(
        out_path,
        save_all=True,
        append_images=frames[1:],
        duration=42,
        loop=0,
        quality=82,
        method=4,
    )


def animated_gif_preview(frame_dir, out_path):
    paths = sorted(frame_dir.glob("preview_*.png"))
    if not paths:
        raise RuntimeError(f"No preview frames in {frame_dir}")
    frames = [Image.open(path).convert("RGB") for path in paths]
    frames[0].save(
        out_path,
        save_all=True,
        append_images=frames[1:],
        duration=42,
        loop=0,
        optimize=False,
        disposal=2,
    )


def main():
    close = VALIDATION / "close"
    contact_sheet(
        [close / f"close_{frame:03d}.png" for frame in (30, 42, 64, 86, 106)],
        ["0% / intact", "25%", "50%", "75%", "90% / hinge"],
        VALIDATION / "damage_stages_contact_sheet.png",
        "Boolean V-cut progression — same low-poly tree",
    )
    main_dir = VALIDATION / "main"
    contact_sheet(
        [main_dir / f"main_{frame:03d}.png" for frame in (30, 42, 64, 86, 106, 122, 136, 144)],
        ["before", "25%", "50%", "75%", "90%", "fall", "impact", "settled"],
        VALIDATION / "animation_story_contact_sheet.png",
        "Tree chopping and fall — validation frames",
    )
    animated_preview(VALIDATION / "video_frames", ROOT / "tree_chop_preview.webp")
    animated_gif_preview(VALIDATION / "video_frames", ROOT / "tree_chop_preview.gif")
    timeline_audit_sheet(VALIDATION / "video_frames", VALIDATION / "timeline_audit_contact_sheet.png")
    mp4_decode_sheet(VALIDATION / "mp4_decoded", VALIDATION / "mp4_decoded_contact_sheet.png")
    all_mp4_frames_sheet(VALIDATION / "mp4_all_frames", VALIDATION / "mp4_all_frames_contact_sheet.png")


if __name__ == "__main__":
    main()
