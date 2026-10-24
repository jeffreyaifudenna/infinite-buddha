#!/usr/bin/env python3
"""Create WebP thumbnails and display images for manifest entries that lack them.

Run from the project folder:  python make_thumbs.py
Safe to re-run: entries that already have a thumbUrl / displayUrl are skipped.
"""

import json
import os
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
MANIFEST = PUBLIC / "data" / "manifest.json"

# (manifest key, folder, max size in px, WebP quality) - matches generate_buddha.py
VARIANTS = [
    ("thumbUrl", "thumbs", 640, 80),
    ("displayUrl", "display", 1600, 85),
]


def main():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    made = skipped = 0

    for key, folder, max_size, quality in VARIANTS:
        out_dir = PUBLIC / "output" / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        for entry in manifest:
            if entry.get(key):
                skipped += 1
                continue
            src = PUBLIC / entry["imageUrl"].lstrip("/")
            if not src.exists():
                print(f"missing image, skipped: {src}")
                continue
            out = out_dir / f"{src.stem}.webp"
            with Image.open(src) as img:
                img = img.convert("RGB")
                img.thumbnail((max_size, max_size), Image.LANCZOS)
                img.save(out, "WEBP", quality=quality, method=6)
            entry[key] = f"output/{folder}/{out.name}"
            made += 1
            print(f"{folder}/{out.name}: {src.stat().st_size // 1024} KB -> {out.stat().st_size // 1024} KB")

    tmp = MANIFEST.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    os.replace(tmp, MANIFEST)
    print(f"Done: {made} images created, {skipped} already existed.")


if __name__ == "__main__":
    main()
