#!/usr/bin/env python3
"""Reconstruct the exact Silicobra sprite shard from pinned, verified authored EBDX source sheets."""
import hashlib
import io
import json
import os
from pathlib import Path
import urllib.request
import zipfile

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PROVENANCE = ROOT / "public/sprites/native/provenance-silicobra.json"
MANIFEST = ROOT / "assets/sprites-2d/index.json"
OUT = ROOT / "assets/sprites-2d/sprites-2d-113.zip"

def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()

def run() -> None:
    provenance = json.loads(PROVENANCE.read_text())
    manifest = json.loads(MANIFEST.read_text())
    shard = next(row for row in manifest["shards"] if row["file"] == OUT.name)
    assembled = {}
    for entry in provenance["assets"]:
        url = entry["url"]
        assert url.startswith("https://raw.githubusercontent.com/ChromeValiant/Pokemon-Essentials-21-With-Unofficial-EBDX/836bb026ba8f6c3b3ee3bb6d461c510263953a02/")
        with urllib.request.urlopen(url, timeout=40) as stream:
            source = stream.read()
        assert len(source) == entry["sourceBytes"] and sha256(source) == entry["sourceSha256"]
        git_sha = hashlib.sha1(b"blob " + str(len(source)).encode() + b"\\0" + source).hexdigest()
        assert git_sha == entry["sourceBlob"]
        sheet = Image.open(io.BytesIO(source)).convert("RGBA")
        w, h = sheet.size
        assert w == h * entry["nativeFrames"] and [h, h] == entry["frameSize"]
        frames = [sheet.crop((i * h, 0, (i + 1) * h, h)) for i in range(entry["nativeFrames"])]
        animation = io.BytesIO()
        frames[0].save(animation, format="PNG", save_all=True, append_images=frames[1:],
                       duration=[entry["frameDurationMs"]] * len(frames), loop=0, disposal=0, blend=0)
        still = io.BytesIO()
        frames[0].save(still, format="PNG")
        for name, data, hash_field in [
            (entry["animated"].split("/")[-1], animation.getvalue(), "apngSha256"),
            (entry["static"].split("/")[-1], still.getvalue(), "staticSha256"),
        ]:
            assert sha256(data) == entry[hash_field], name
            assembled[name] = data
    expected = {row["name"]: row for row in shard["files"]}
    assert set(expected) == set(assembled) and len(assembled) == 8
    archive_bytes = io.BytesIO()
    with zipfile.ZipFile(archive_bytes, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name in sorted(assembled):
            data = assembled[name]
            assert expected[name]["bytes"] == len(data) and expected[name]["sha256"] == sha256(data)
            info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    raw = archive_bytes.getvalue()
    assert len(raw) == shard["bytes"] and sha256(raw) == shard["sha256"]
    temp = OUT.with_suffix(".tmp")
    temp.write_bytes(raw)
    os.replace(temp, OUT)
    print(f"OK: {OUT.name}, {len(raw)} bytes, SHA-256 {sha256(raw)}. 8 authored assets verified.")

if __name__ == "__main__":
    run()
