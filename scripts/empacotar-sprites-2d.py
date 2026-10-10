#!/usr/bin/env python3
"""Package the immutable 2D imports losslessly, with deterministic ZIPs."""
import hashlib
import json
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/sprites-2d"
proof = json.loads((ROOT / "public/sprites/native/provenance-2d.json").read_text())
paths = sorted({row[kind].lstrip("/") for row in proof["assets"] for kind in ("animated", "static")})
groups = []
current = []
size = 0
for relative in paths:
    source = ROOT / "public" / relative
    if current and size + source.stat().st_size > 700_000:
        groups.append(current)
        current, size = [], 0
    current.append(source)
    size += source.stat().st_size
if current:
    groups.append(current)
OUT.mkdir(parents=True, exist_ok=True)
manifest = {
    "schemaVersion": 1,
    "format": "zip-deflate-lossless",
    "provenance": "public/sprites/native/provenance-2d.json",
    "entries": len(paths),
    "bytes": sum(source.stat().st_size for group in groups for source in group),
    "shards": [],
}
for index, group in enumerate(groups):
    target = OUT / f"sprites-2d-{index:03d}.zip"
    entries = []
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for source in group:
            data = source.read_bytes()
            info = zipfile.ZipInfo(source.name, (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
            entries.append({"name": source.name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    data = target.read_bytes()
    manifest["shards"].append({"file": target.name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "files": entries})
(OUT / "index.json").write_text(json.dumps(manifest, separators=(",", ":")) + "\n")
print(json.dumps({"shards": len(groups), "images": len(paths), "archiveBytes": sum(shard["bytes"] for shard in manifest["shards"])}))
