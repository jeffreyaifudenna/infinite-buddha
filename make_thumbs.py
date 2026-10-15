#!/usr/bin/env python3
"""Create WebP thumbnails for manifest entries that don't have one yet.

Run once from the project folder:  python make_thumbs.py
Safe to re-run: entries that already have a thumbUrl are skipped.
"""

import json
import os
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
THUMB_DIR = PUBLIC / "output" / "thumbs"
MANIFEST = PUBLIC / "data" / "manifest.json"
THUMB_SIZE = 640


def main():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    THUMB_DIR.mkdir(parents=True, exist_ok=True)
    made = skipped = 0

    for entry in manifest:
        if entry.get("thumbUrl"):
            skipped += 1
            continue
        src = PUBLIC / entry["imageUrl"].lstrip("/")
        if not src.exists():
            print(f"missing image, skipped: {src}")
            continue
        thumb = THUMB_DIR / f"{src.stem}.webp"
        with Image.open(src) as img:
            img = img.convert("RGB")
            img.thumbnail((THUMB_SIZE, THUMB_SIZE), Image.LANCZOS)
            img.save(thumb, "WEBP", quality=80, method=6)
        entry["thumbUrl"] = f"output/thumbs/{thumb.name}"
        made += 1
        print(f"{src.name}: {src.stat().st_size // 1024} KB -> {thumb.stat().st_size // 1024} KB")

    tmp = MANIFEST.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    os.replace(tmp, MANIFEST)
    print(f"Done: {made} thumbnails created, {skipped} already had one.")


if __name__ == "__main__":
    main()