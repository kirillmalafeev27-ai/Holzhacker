from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path(__file__).resolve().parent
SPRITES = ROOT / "public" / "assets" / "forest_defense" / "sprites"
DOCS = ROOT / "docs"
SHOTS = DOCS / "screenshots"
VIDEO_FRAMES = DOCS / "video_frames"
WIDTH, HEIGHT = 960, 540
TAU = math.tau


def font(size: int, bold: bool = False):
    name = "arialbd.ttf" if bold else "arial.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size)


F12, F14, F16, F18, F22, F30 = (font(v) for v in (12, 14, 16, 18, 22, 30))
FB14, FB16, FB18, FB22, FB30 = (font(v, True) for v in (14, 16, 18, 22, 30))


SPRITE_FILES = {
    "pine": "tree_pine.png", "pine_small": "tree_pine_small.png",
    "oak": "tree_stage_0.png", "oak25": "tree_stage_25.png",
    "oak50": "tree_stage_50.png", "oak75": "tree_stage_75.png",
    "oak90": "tree_stage_90.png", "fallen": "tree_stage_fallen.png",
    "stump": "stump.png", "rock": "rock_large.png", "rock_small": "rock_small.png",
    "grass": "grass.png", "log": "log.png", "log_stack": "log_stack.png",
    "tent": "tent.png", "campfire": "campfire.png", "pot": "pot.png",
}
SPRITE_IMAGES = {key: Image.open(SPRITES / value).convert("RGBA") for key, value in SPRITE_FILES.items()}
RESIZED: dict[tuple[str, int], Image.Image] = {}


def project(x: float, z: float, y: float = 0) -> tuple[int, int]:
    return int(WIDTH * .5 + (x - z) * 9.1), int(HEIGHT * .405 + (x + z) * 4.55 - y * 10.2)


def sprite(key: str, size: int) -> Image.Image:
    cache_key = (key, size)
    if cache_key not in RESIZED:
        source = SPRITE_IMAGES[key]
        ratio = size / source.height
        RESIZED[cache_key] = source.resize((max(1, int(source.width * ratio)), size), Image.Resampling.LANCZOS)
    return RESIZED[cache_key]


def paste_sprite(image: Image.Image, key: str, x: float, z: float, height: int, opacity: int = 255):
    item = sprite(key, height)
    if opacity != 255:
        item = item.copy()
        item.putalpha(item.getchannel("A").point(lambda value: value * opacity // 255))
    px, py = project(x, z)
    image.alpha_composite(item, (px - item.width // 2, py - item.height))


def polygon(draw: ImageDraw.ImageDraw, coords, fill, outline=None, width=1):
    points = [project(*coord) if len(coord) == 3 else project(coord[0], coord[1]) for coord in coords]
    draw.polygon(points, fill=fill)
    if outline:
        draw.line(points + [points[0]], fill=outline, width=width, joint="curve")


def pill(draw, box, fill, outline=(255, 255, 255, 32), radius=12, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def shadow_text(draw, xy, text, used_font, fill="white", anchor="la", shadow=(10, 14, 12, 210)):
    x, y = xy
    draw.text((x + 2, y + 2), text, font=used_font, fill=shadow, anchor=anchor)
    draw.text((x, y), text, font=used_font, fill=fill, anchor=anchor)


def draw_player(draw, x, z, carrying=False, tower=False, axe=False):
    px, py = project(x, z, 6.3 if tower else 0)
    draw.ellipse((px - 13, py - 2, px + 13, py + 7), fill=(13, 20, 15, 75))
    draw.polygon([(px - 8, py), (px + 8, py), (px + 6, py - 28), (px - 6, py - 28)], fill="#343b31")
    draw.rectangle((px - 7, py - 28, px + 7, py - 14), fill="#d8c398")
    draw.ellipse((px - 9, py - 46, px + 9, py - 28), fill="#523520")
    draw.arc((px - 9, py - 48, px + 9, py - 30), 180, 360, fill="#28231e", width=6)
    if carrying:
        draw.line((px - 20, py - 34, px + 21, py - 12), fill="#5e351e", width=10)
        draw.ellipse((px - 24, py - 37, px - 15, py - 28), fill="#d29c58")
    else:
        angle = -2.2 if axe else -.45
        ex, ey = px + 7, py - 22
        hx, hy = ex + math.cos(angle) * 30, ey + math.sin(angle) * 30
        draw.line((ex, ey, hx, hy), fill="#6a3c22", width=4)
        draw.line((hx - 7, hy - 4, hx + 7, hy + 4), fill="#39464b", width=8)


def draw_goblin(draw, x, z, attack=False):
    px, py = project(x, z)
    draw.ellipse((px - 13, py, px + 13, py + 6), fill=(10, 15, 9, 80))
    draw.ellipse((px - 10, py - 30, px + 10, py - 5), fill="#435d2f")
    draw.ellipse((px - 10, py - 45, px + 10, py - 25), fill="#789241")
    draw.polygon([(px - 8, py - 40), (px - 19, py - 33), (px - 8, py - 30)], fill="#789241")
    draw.polygon([(px + 8, py - 40), (px + 19, py - 33), (px + 8, py - 30)], fill="#789241")
    draw.rectangle((px - 5, py - 39, px - 2, py - 37), fill="#f0c04c")
    draw.rectangle((px + 3, py - 39, px + 6, py - 37), fill="#f0c04c")
    if attack:
        draw.line((px + 7, py - 16, px + 24, py - 44), fill="#694026", width=4)
        draw.polygon([(px + 20, py - 47), (px + 29, py - 50), (px + 25, py - 40)], fill="#b6b1a4")


def draw_catapult(draw, x, z, destroyed=False, recoil=False):
    px, py = project(x, z)
    draw.ellipse((px - 30, py, px + 30, py + 11), fill=(12, 16, 11, 90))
    wood = "#4b2c1d" if destroyed else "#714421"
    draw.line((px - 25, py, px + 24, py), fill=wood, width=7)
    draw.line((px - 18, py, px, py - 31, px + 18, py), fill=wood, width=7, joint="curve")
    for dx in (-18, 18):
        draw.ellipse((px + dx - 9, py - 4, px + dx + 9, py + 14), fill="#30251d", outline="#8b6033", width=2)
    if destroyed:
        draw.line((px - 18, py - 26, px + 12, py + 6), fill="#5a321f", width=7)
        draw.line((px + 1, py - 17, px + 28, py + 4), fill="#9b6233", width=3)
    else:
        tip_y = py - (9 if recoil else 64)
        draw.line((px, py - 27, px + (16 if recoil else -8), tip_y), fill=wood, width=7)
        draw.rectangle((px - 18, tip_y - 6, px + 4, tip_y + 7), fill="#593520")


def draw_fort(draw, stage: int, health: int = 1000):
    if stage == 0:
        points = [project(math.cos(i / 48 * TAU) * 10, math.sin(i / 48 * TAU) * 10) for i in range(48)]
        draw.line(points + [points[0]], fill="#76512c", width=2)
        for i in range(12):
            x, z = math.cos(i / 12 * TAU) * 10, math.sin(i / 12 * TAU) * 10
            a, b = project(x, z), project(x, z, 1.2)
            draw.line((a, b), fill="#6c3d20", width=3)
        return
    posts = []
    for index in range(36):
        angle = -.33 * math.pi + index / 36 * (TAU - .56)
        if abs(math.atan2(math.sin(angle + math.pi / 2), math.cos(angle + math.pi / 2))) < .23:
            continue
        posts.append((index, math.cos(angle) * 10, math.sin(angle) * 10))
    visible = math.ceil(len(posts) * stage / 3)
    damage = 1 - health / 1000
    for index, x, z in sorted(posts[:visible], key=lambda item: item[1] + item[2]):
        base, top = project(x, z), project(x, z, 2.4 if damage > .45 and index % 4 == 0 else 3.8)
        color = "#4c2b1c" if damage > .65 else "#85502b"
        draw.line((base, top), fill="#3c2417", width=10)
        draw.line((base, top), fill=color, width=7)
        draw.polygon([(top[0] - 4, top[1] + 4), (top[0], top[1] - 8), (top[0] + 4, top[1] + 4)], fill=color)
    if stage >= 2:
        left, right = project(-2.2, -9.6), project(2.2, -9.6)
        lt, rt = project(-2.2, -9.6, 4.7), project(2.2, -9.6, 4.7)
        draw.line((left, lt), fill="#52301d", width=10); draw.line((right, rt), fill="#52301d", width=10)
        draw.line((lt, rt), fill="#65401f", width=8)
        if stage == 3:
            draw.polygon([left, right, (rt[0], rt[1] + 8), (lt[0], lt[1] + 8)], fill="#704321", outline="#ae7138")


def draw_tower(draw):
    x, z = 4.8, 4
    platform, roof = project(x, z, 6.3), project(x, z, 8.4)
    for dx, dz in [(-1, -1), (1, -1), (-1, 1), (1, 1)]:
        draw.line((project(x + dx, z + dz), project(x + dx * .7, z + dz * .7, 6.2)), fill="#4f301d", width=6)
    draw.polygon([(platform[0] - 30, platform[1]), (platform[0], platform[1] - 14), (platform[0] + 30, platform[1]), (platform[0], platform[1] + 14)], fill="#754923")
    draw.polygon([(roof[0], roof[1] - 20), (roof[0] + 36, roof[1] + 8), (roof[0], roof[1] + 23), (roof[0] - 36, roof[1] + 8)], fill="#573621", outline="#a16a38")
    draw.line((roof[0], roof[1] - 18, roof[0], roof[1] - 52), fill="#44321e", width=3)
    draw.polygon([(roof[0], roof[1] - 51), (roof[0] + 30, roof[1] - 42), (roof[0], roof[1] - 34)], fill="#315e7c")


def draw_hud(image, stage, health, notes, title, timer="02:24", hearts=3):
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0)); draw = ImageDraw.Draw(overlay)
    pill(draw, (18, 16, 238, 116), (17, 29, 22, 222), (210, 177, 96, 90), 13)
    draw.text((34, 29), "ЗАЩИТНИК", font=FB14, fill="#e5d8b6")
    for i in range(3):
        color = "#dc5b45" if i < hearts else "#4b4a40"
        x = 37 + i * 27
        draw.polygon([(x, 53), (x - 7, 46), (x - 13, 51), (x - 12, 61), (x, 73), (x + 12, 61), (x + 13, 51), (x + 7, 46)], fill=color)
    draw.text((117, 48), f"Крепость {health}/1000", font=F12, fill="#eee4c9")
    draw.rounded_rectangle((117, 68, 220, 77), radius=4, fill="#332a22")
    draw.rounded_rectangle((117, 68, 117 + int(103 * health / 1000), 77), radius=4, fill="#7fbb62")
    draw.text((34, 89), f"Нападение  {timer}", font=FB14, fill="#f3c56c")
    pill(draw, (WIDTH - 287, 16, WIDTH - 18, 103), (17, 29, 22, 224), (210, 177, 96, 90), 13)
    draw.text((WIDTH - 269, 30), title, font=FB16, fill="#f2dfad")
    draw.text((WIDTH - 269, 57), f"Строительство {stage}/3", font=F14, fill="#d8d2bd")
    draw.text((WIDTH - 269, 78), f"Записки {notes}/6", font=F14, fill="#d8d2bd")
    image.alpha_composite(overlay)


SCENARIOS = [
    ("01_clearing", "Поляна до строительства", dict(stage=0)),
    ("02_fort_one_third", "Частокол построен на 1/3", dict(stage=1)),
    ("03_fort_two_thirds", "Частокол построен на 2/3", dict(stage=2)),
    ("04_fort_complete", "Крепость Waldwacht готова", dict(stage=3)),
    ("05_goblins_attack", "Гоблины атакуют частокол", dict(stage=3, attack=True, goblins=True, health=850)),
    ("06_catapult_fires", "Катапульта стреляет", dict(stage=3, attack=True, goblins=True, projectile=.12, health=820)),
    ("07_projectile_apex", "Снаряд в верхней точке дуги", dict(stage=3, attack=True, goblins=True, projectile=.5, health=790)),
    ("08_fort_damaged", "Повреждённая крепость", dict(stage=3, attack=True, goblins=True, health=410)),
    ("09_repair", "Ремонт крепости древесиной", dict(stage=3, attack=True, repair=True, health=660)),
    ("10_tower", "Защитник на башне", dict(stage=3, attack=True, tower=True, health=660)),
    ("11_stone_flight", "Камень летит к катапульте", dict(stage=3, attack=True, tower=True, stone=.52, health=650)),
    ("12_catapult_destroyed", "Разрушенная катапульта", dict(stage=3, attack=True, destroyed=1, health=620)),
    ("13_note_drop", "Записки выпали у врага", dict(stage=3, attack=True, destroyed=1, notes_world=2, health=610)),
    ("14_note_collect", "Защитник собирает записку", dict(stage=3, attack=True, destroyed=2, notes_world=4, collected=3, health=580)),
    ("15_victory", "Все записки собраны", dict(stage=3, attack=True, destroyed=3, collected=6, victory=True, health=540)),
    ("16_defeat", "Крепость разрушена", dict(stage=3, attack=True, goblins=True, defeat=True, health=0, hearts=2)),
]


def render_scene(title: str, state: dict) -> Image.Image:
    random.seed(112358)
    image = Image.new("RGBA", (WIDTH, HEIGHT), "#304b36")
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rectangle((0, 0, WIDTH, HEIGHT), fill="#587554")
    # Large low-poly ground and a warm oval clearing, matching the references.
    outer = [project(math.cos(i / 64 * TAU) * 42, math.sin(i / 64 * TAU) * 42) for i in range(64)]
    draw.polygon(outer, fill="#557637")
    clearing = [project(math.cos(i / 64 * TAU) * 22, math.sin(i / 64 * TAU) * 19, .01) for i in range(64)]
    draw.polygon(clearing, fill="#b19b4d")
    polygon(draw, [(-4, -42), (4, -42), (5, -19), (2, -12), (-2, -12), (-5, -20)], "#c99e51")
    polygon(draw, [(-43, 18), (-34, 27), (-31, 40), (-25, 43), (-20, 43), (-29, 28), (-35, 15)], "#4d93a6")
    for _ in range(140):
        angle, radius = random.random() * TAU, math.sqrt(random.random()) * 38
        x, z = math.cos(angle) * radius, math.sin(angle) * radius
        px, py = project(x, z)
        if 19 < radius < 38:
            color = "#406a34" if random.random() > .25 else "#d3b75a"
            draw.line((px, py, px + random.randint(-2, 3), py - random.randint(2, 6)), fill=color, width=1)
    entries = []
    for ring, count in ((29, 24), (35, 32)):
        for index in range(count):
            angle = index / count * TAU + (.09 if ring > 32 else 0)
            normalized = math.atan2(math.sin(angle), math.cos(angle))
            if -1.83 < normalized < -1.32:
                continue
            radius = ring + (random.random() - .5) * 3
            x, z = math.cos(angle) * radius, math.sin(angle) * radius
            key = "pine_small" if index % 3 == 0 else "pine"
            size = 118 if key == "pine_small" else 142
            entries.append((x + z, lambda x=x, z=z, key=key, size=size: paste_sprite(image, key, x, z, size)))
    for x, z in [(-24, -17), (25, -15), (-29, 4), (28, 12), (-14, 26), (16, 27)]:
        entries.append((x + z, lambda x=x, z=z: paste_sprite(image, "rock", x, z, 65)))
    for x, z in [(-27, -23), (26, -22), (-31, 18)]:
        entries.append((x + z, lambda x=x, z=z: paste_sprite(image, "log_stack", x, z, 58)))
    oak_positions = [(-17, -9), (17, -10), (21, 8), (-21, 11), (12, 18)]
    for index, (x, z) in enumerate(oak_positions):
        key = "oak"
        if state.get("chop") and index == 1:
            key = state["chop"]
        entries.append((x + z, lambda x=x, z=z, key=key: paste_sprite(image, key, x, z, 160)))
    stage, health = state.get("stage", 0), state.get("health", 1000)
    entries.append((0, lambda: draw_fort(draw, stage, health)))
    if stage == 3:
        entries.extend([
            (9, lambda: draw_tower(draw)),
            (-3.2, lambda: paste_sprite(image, "tent", -4.8, 1.6, 82)),
            (2, lambda: paste_sprite(image, "tent", 4.2, -2.2, 76)),
            (0.5, lambda: paste_sprite(image, "campfire", .4, .2, 47)),
            (-5, lambda: paste_sprite(image, "log_stack", -4.8, -.6, 54)),
        ])
    catapults = [(-27, 14), (28, 13), (3, 31)]
    destroyed = state.get("destroyed", 0)
    for index, (x, z) in enumerate(catapults):
        entries.append((x + z + .2, lambda x=x, z=z, index=index: draw_catapult(draw, x, z, index < destroyed, state.get("projectile") is not None and index == 0)))
    if state.get("goblins"):
        for x, z in [(-10.5, 0), (8, 6.8), (7, -7.5), (-7.5, -7), (-5, 8), (4, 9)]:
            entries.append((x + z + .3, lambda x=x, z=z: draw_goblin(draw, x, z, True)))
    notes_world = state.get("notes_world", 0)
    note_positions = [(-26, 14), (-28, 13), (27, 13), (29, 12), (2, 30), (4, 31)]
    for x, z in note_positions[:notes_world]:
        def note_draw(x=x, z=z):
            px, py = project(x, z, .5)
            draw.polygon([(px, py - 9), (px + 11, py), (px, py + 9), (px - 11, py)], fill="#f1d18b", outline="#7e542a")
            draw.line((px - 4, py - 2, px + 5, py - 2), fill="#9b6939", width=1)
        entries.append((x + z + .4, note_draw))
    player_x, player_z = (4.8, 4) if state.get("tower") else ((-26.2, 13.5) if state.get("collected", 0) else (0, -14))
    if state.get("repair"):
        player_x, player_z = 0, -8.2
    entries.append((player_x + player_z + .5, lambda: draw_player(draw, player_x, player_z, state.get("repair", False), state.get("tower", False), state.get("chop") is not None)))
    for _, callback in sorted(entries, key=lambda item: item[0]):
        callback()
    if state.get("repair"):
        for index in range(20):
            angle = index / 20 * TAU
            px, py = project(math.cos(angle) * 9, math.sin(angle) * 9, 1 + (index % 3) * .35)
            draw.rectangle((px - 3, py - 3, px + 3, py + 3), fill="#8ed66e")
    if state.get("projectile") is not None:
        t = state["projectile"]
        sx, sz, tx, tz = -27, 14, 7, 3
        x, z = sx + (tx - sx) * t, sz + (tz - sz) * t
        y = 2 * (1 - t) + .2 * t + math.sin(math.pi * t) * 8.5
        px, py = project(x, z, y); gx, gy = project(tx, tz)
        draw.ellipse((gx - 19, gy - 8, gx + 19, gy + 8), outline="#cf4b35", width=3)
        draw.ellipse((px - 8, py - 8, px + 8, py + 8), fill="#57534b", outline="#d0a65e", width=2)
        draw.line((px - 3, py + 3, px - 18, py + 15), fill=(241, 198, 110, 120), width=3)
    if state.get("stone") is not None:
        t = state["stone"]
        sx, sz, tx, tz = 4.8, 4, 28, 13
        x, z = sx + (tx - sx) * t, sz + (tz - sz) * t
        y = 7.6 * (1 - t) + t + math.sin(math.pi * t) * 9.5
        px, py = project(x, z, y)
        draw.ellipse((px - 8, py - 8, px + 8, py + 8), fill="#e1d095", outline="#fff0a3", width=3)
    timer = "БОЙ" if state.get("attack") else "03:00"
    draw_hud(image, stage, health, state.get("collected", 0), title, timer, state.get("hearts", 3))
    # Scenario ribbon.
    draw = ImageDraw.Draw(image, "RGBA")
    pill(draw, (18, HEIGHT - 48, 445, HEIGHT - 14), (17, 29, 22, 218), (226, 184, 90, 80), 10)
    draw.text((33, HEIGHT - 40), title, font=FB16, fill="#f4dfad")
    if state.get("tower") and not state.get("stone"):
        pill(draw, (WIDTH // 2 - 240, 128, WIDTH // 2 + 240, 314), (20, 28, 25, 242), (224, 188, 103, 190), 18, 2)
        draw.text((WIDTH // 2, 156), "DEUTSCH · WALDWACHT", font=FB14, fill="#d8b968", anchor="ma")
        draw.text((WIDTH // 2, 191), "Wir schützen ___ Burg.", font=FB22, fill="white", anchor="ma")
        for index, option in enumerate(("die", "der", "den")):
            x0 = WIDTH // 2 - 200 + index * 136
            pill(draw, (x0, 232, x0 + 120, 278), "#30473a", (201, 174, 102, 90), 9)
            draw.text((x0 + 60, 255), f"{index + 1}. {option}", font=FB16, fill="#f1ead5", anchor="mm")
    if state.get("victory") or state.get("defeat"):
        shade = Image.new("RGBA", image.size, (6, 13, 10, 168)); image.alpha_composite(shade)
        draw = ImageDraw.Draw(image, "RGBA")
        pill(draw, (WIDTH // 2 - 245, HEIGHT // 2 - 112, WIDTH // 2 + 245, HEIGHT // 2 + 112), (18, 30, 23, 244), (224, 183, 92, 170), 22, 2)
        if state.get("victory"):
            shadow_text(draw, (WIDTH // 2, HEIGHT // 2 - 57), "ПОБЕДА", FB30, "#f0d487", "ma")
            draw.text((WIDTH // 2, HEIGHT // 2), "Все 6 записок собраны. Waldwacht выстоял.", font=F18, fill="#f1ecdf", anchor="mm")
        else:
            shadow_text(draw, (WIDTH // 2, HEIGHT // 2 - 57), "КРЕПОСТЬ РАЗРУШЕНА", FB30, "#e88262", "ma")
            draw.text((WIDTH // 2, HEIGHT // 2), "Прочность частокола упала до нуля.", font=F18, fill="#f1ecdf", anchor="mm")
        pill(draw, (WIDTH // 2 - 92, HEIGHT // 2 + 43, WIDTH // 2 + 92, HEIGHT // 2 + 86), "#9c6934", None, 10)
        draw.text((WIDTH // 2, HEIGHT // 2 + 65), "НАЧАТЬ ЗАНОВО", font=FB14, fill="white", anchor="mm")
    return image.convert("RGB")


def build_evidence():
    SHOTS.mkdir(parents=True, exist_ok=True)
    VIDEO_FRAMES.mkdir(parents=True, exist_ok=True)
    rendered = []
    for slug, title, state in SCENARIOS:
        frame = render_scene(title, state)
        path = SHOTS / f"{slug}.png"
        frame.save(path, optimize=True)
        rendered.append((title, frame))

    cell_w, cell_h = 480, 270
    sheet = Image.new("RGB", (cell_w * 4, cell_h * 4), "#101a14")
    for index, (title, frame) in enumerate(rendered):
        thumb = frame.resize((cell_w, cell_h), Image.Resampling.LANCZOS)
        sheet.paste(thumb, ((index % 4) * cell_w, (index // 4) * cell_h))
        overlay = ImageDraw.Draw(sheet, "RGBA")
        x, y = (index % 4) * cell_w, (index // 4) * cell_h
        overlay.rectangle((x, y + cell_h - 31, x + cell_w, y + cell_h), fill=(8, 15, 11, 220))
        overlay.text((x + 10, y + cell_h - 24), f"{index + 1:02d} · {title}", font=FB14, fill="#f2dfad")
    sheet.save(DOCS / "forest_defense_contact_sheet.png", optimize=True)

    # A 24-second storyboard at 10 fps with short crossfades between all required states.
    sequence = [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 10, 11, 12, 13, 14]
    frame_number = 0
    for position, scene_index in enumerate(sequence):
        current = rendered[scene_index][1]
        next_image = rendered[sequence[min(position + 1, len(sequence) - 1)]][1]
        for local in range(14):
            if local >= 10 and position < len(sequence) - 1:
                composed = Image.blend(current, next_image, (local - 9) / 5)
            else:
                composed = current.copy()
            draw = ImageDraw.Draw(composed, "RGBA")
            progress = frame_number / (len(sequence) * 14 - 1)
            draw.rectangle((0, HEIGHT - 4, WIDTH, HEIGHT), fill=(15, 19, 16, 220))
            draw.rectangle((0, HEIGHT - 4, int(WIDTH * progress), HEIGHT), fill="#d7aa55")
            # Fast, deterministic frame output; the final MP4 performs compression.
            composed.save(VIDEO_FRAMES / f"frame_{frame_number:04d}.png", compress_level=1)
            frame_number += 1
    print(f"Rendered {len(rendered)} screenshots and {frame_number} video frames")


if __name__ == "__main__":
    build_evidence()
