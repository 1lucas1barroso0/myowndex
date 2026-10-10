#!/usr/bin/env python3
"""Measure the union of every authored frame, without editing source pixels.

Network requests are optional, verified by curl, bounded and cached. Browser
rendering only reads the resulting local index; it never scans canvas pixels.
"""
import argparse
import concurrent.futures
import hashlib
import json
import pathlib
import subprocess
from PIL import Image, ImageChops

ROOT = pathlib.Path(__file__).resolve().parents[1]


def measure(path):
    with Image.open(path) as image:
        width, height = image.size
        union = Image.new("L", (width, height))
        for frame in range(getattr(image, "n_frames", 1)):
            image.seek(frame)
            union = ImageChops.lighter(union, image.convert("RGBA").getchannel("A"))
        bounds = union.getbbox()
        if not bounds:
            raise ValueError(f"Sprite has no visible pixels: {path}")
        x, y, right, bottom = bounds
        return [width, height, x, y, right - x, bottom - y]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=pathlib.Path, required=True)
    parser.add_argument("--output", type=pathlib.Path, default=ROOT / "src/data/sprite-framing.json")
    parser.add_argument("--fetch", action="store_true")
    parser.add_argument("--include-static", action="store_true", help="Also measure the 2D PNG recovery sources; missing recovery URLs are omitted, never invented.")
    parser.add_argument("--workers", type=int, default=12)
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    animated = json.loads((ROOT / "src/data/animated-sprites.json").read_text())
    native = json.loads((ROOT / "src/data/native-sprites.json").read_text())
    sources = {}
    optional = set()
    prefix = f"https://raw.githubusercontent.com/PokeAPI/sprites/{animated['commit']}/sprites/pokemon/"
    for view, keys in {"": animated["regular"], "shiny": animated["shiny"], **animated["views"]}.items():
        for key in keys:
            path = f"versions/generation-v/black-white/animated/{view + '/' if view else ''}{key}.gif"
            sources[f"pokeapi/{path}"] = prefix + path
            if args.include_static:
                static_paths = [f"versions/generation-v/black-white/{view + '/' if view else ''}{key}.png"]
                if key.isdecimal() and 1 <= int(key) <= 649:
                    static_paths.append(f"{view + '/' if view else ''}{key}.png")
                for static_path in static_paths:
                    static_key = f"pokeapi/{static_path}"
                    sources[static_key] = prefix + static_path
                    optional.add(static_key)
    for views in native.get("external", {}).values():
        for path in views.values():
            if "/models/" in path:
                continue
            sources[f"smogon/{path}"] = f"https://raw.githubusercontent.com/smogon/sprites/{native['smogonCommit']}/{path}"

    missing = []
    def read_source(item):
        key, url = item
        digest = hashlib.sha256(url.encode()).hexdigest()
        file = args.cache / digest
        record = file.with_name(file.name + ".json")
        saved = {}
        valid = False
        if file.exists() and record.exists():
            saved = json.loads(record.read_text())
            valid = saved.get("status") == 200
        if not valid and args.fetch and saved.get("status") != 404:
            result = subprocess.run(["curl", "--silent", "--show-error", "--location", "--retry", "2", "--max-time", "45", "--output", str(file), "--write-out", "%{http_code}", url], check=True, capture_output=True, text=True)
            status = int(result.stdout)
            saved = {"url": url, "status": status}
            record.write_text(json.dumps(saved))
            valid = status == 200
        if not valid:
            return key, None
        original_sha256 = hashlib.sha256(file.read_bytes()).hexdigest()
        if saved.get("framingSha256") == original_sha256 and saved.get("framing"):
            return key, saved["framing"]
        bounds = measure(file)
        saved.update({"framingSha256": original_sha256, "framing": bounds})
        record.write_text(json.dumps(saved))
        return key, bounds

    assets = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(16, args.workers))) as executor:
        for count, (key, bounds) in enumerate(executor.map(read_source, sources.items()), 1):
            if bounds: assets[key] = bounds
            elif key not in optional: missing.append(key)
            if count % 500 == 0:
                print(f"Measured {count}/{len(sources)} remote sprites", flush=True)
    local_paths = {source.lstrip("/") for views in native.get("local", {}).values() for asset in views.values() for source in (asset.get("animated"), asset.get("static")) if source}
    for folder in (ROOT / "public/sprites", ROOT / "public/sprites/companions"):
        local_paths.update(file.relative_to(ROOT / "public").as_posix() for file in folder.iterdir() if file.suffix.lower() in (".png", ".gif", ".apng"))
    for path in sorted(local_paths):
        assets["local/" + path] = measure(ROOT / "public" / path)
    if missing:
        raise SystemExit(f"Missing {len(missing)} cached originals: {missing[:10]}")
    payload = {"schemaVersion": 1, "measurement": "alpha-union-all-authored-frames", "pokeapiCommit": animated["commit"], "smogonCommit": native["smogonCommit"], "assets": dict(sorted(assets.items()))}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    print(f"Published exact framing for {len(assets)} images ({args.output.stat().st_size} bytes)", flush=True)


if __name__ == "__main__":
    main()
