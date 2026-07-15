"""Repack the Waldwacht world GLB with embedded textures capped at 1K.

Geometry, accessors, scene nodes, names, extras, and material assignments are
copied byte-for-byte. Only embedded raster images larger than the requested
edge are resized with Lanczos and re-encoded losslessly as PNG.
"""

from __future__ import annotations

import argparse
import io
import json
import struct
from pathlib import Path

from PIL import Image


JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def align4(data: bytearray, fill: int = 0) -> None:
    while len(data) % 4:
        data.append(fill)


def read_glb(path: Path) -> tuple[dict, bytes]:
    payload = path.read_bytes()
    if payload[:4] != b"glTF" or struct.unpack_from("<I", payload, 4)[0] != 2:
        raise ValueError(f"{path} is not a glTF 2.0 binary")
    cursor = 12
    document = None
    binary = b""
    while cursor < len(payload):
        length, kind = struct.unpack_from("<II", payload, cursor)
        cursor += 8
        chunk = payload[cursor : cursor + length]
        cursor += length
        if kind == JSON_CHUNK:
            document = json.loads(chunk.rstrip(b" \x00").decode("utf-8"))
        elif kind == BIN_CHUNK:
            binary = chunk
    if document is None:
        raise ValueError(f"{path} has no JSON chunk")
    return document, binary


def encode_image(raw: bytes, max_edge: int) -> tuple[bytes, tuple[int, int], tuple[int, int]]:
    with Image.open(io.BytesIO(raw)) as image:
        before = image.size
        if max(before) <= max_edge:
            return raw, before, before
        scale = max_edge / max(before)
        after = tuple(max(1, round(value * scale)) for value in before)
        resized = image.resize(after, Image.Resampling.LANCZOS)
        output = io.BytesIO()
        resized.save(output, format="PNG", optimize=True, compress_level=9)
        return output.getvalue(), before, after


def optimize(source: Path, target: Path, max_edge: int) -> None:
    document, binary = read_glb(source)
    image_by_view = {
        image["bufferView"]: image
        for image in document.get("images", [])
        if "bufferView" in image
    }
    replacement: dict[int, bytes] = {}
    saved = 0
    for view_index, image in image_by_view.items():
        view = document["bufferViews"][view_index]
        start = int(view.get("byteOffset", 0))
        raw = binary[start : start + int(view["byteLength"])]
        encoded, before, after = encode_image(raw, max_edge)
        replacement[view_index] = encoded
        saved += len(raw) - len(encoded)
        if before != after:
            print(
                f"TEXTURE_1K {image.get('name', view_index)} "
                f"{before[0]}x{before[1]} -> {after[0]}x{after[1]} "
                f"{len(raw) / 1048576:.2f}MB -> {len(encoded) / 1048576:.2f}MB"
            )

    rebuilt = bytearray()
    for view_index, view in enumerate(document.get("bufferViews", [])):
        align4(rebuilt)
        start = int(view.get("byteOffset", 0))
        raw = replacement.get(
            view_index,
            binary[start : start + int(view["byteLength"])],
        )
        view["byteOffset"] = len(rebuilt)
        view["byteLength"] = len(raw)
        rebuilt.extend(raw)
    align4(rebuilt)
    document["buffers"][0]["byteLength"] = len(rebuilt)

    encoded_json = json.dumps(
        document,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    json_chunk = bytearray(encoded_json)
    align4(json_chunk, fill=0x20)

    total_length = 12 + 8 + len(json_chunk) + 8 + len(rebuilt)
    output = bytearray(struct.pack("<4sII", b"glTF", 2, total_length))
    output.extend(struct.pack("<II", len(json_chunk), JSON_CHUNK))
    output.extend(json_chunk)
    output.extend(struct.pack("<II", len(rebuilt), BIN_CHUNK))
    output.extend(rebuilt)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(output)
    print(
        f"WORLD_1K_OK {source.name} {source.stat().st_size / 1048576:.2f}MB -> "
        f"{target.stat().st_size / 1048576:.2f}MB saved={saved / 1048576:.2f}MB"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    parser.add_argument("--max-edge", type=int, default=1024)
    args = parser.parse_args()
    optimize(args.source, args.target, args.max_edge)


if __name__ == "__main__":
    main()
