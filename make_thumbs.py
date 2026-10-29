#!/usr/bin/env python3
"""Create WebP thumbnails and display images for manifest entries that lack them.

Run from the project folder:  python make_thumbs.py
Safe to re-run: an entry is skipped when its thumbUrl / displayUrl is set and that
file exists. The manifest is only rewritten when something changed.
"""

import json
import os
from pathlib import Path

from PIL import Image

# Importing only reads constants; generate_buddha runs nothing unless it is the main script.
from generate_buddha import DISPLAY_QUALITY, DISPLAY_SIZE, THUMB_QUALITY, THUMB_SIZE

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"
MANIFEST = PUBLIC / "data" / "manifest.json"

# (manifest key, folder, max size in px, WebP quality) - shared with generate_buddha.py
VARIANTS = [
    ("thumbUrl", "thumbs", THUMB_SIZE, THUMB_QUALITY),
    ("displayUrl", "display", DISPLAY_SIZE, DISPLAY_QUALITY),
]


def main():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    made = skipped = failed = 0
    changed = False

    for key, folder, max_size, quality in VARIANTS:
        out_dir = PUBLIC / "output" / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        for entry in manifest:
            existing = entry.get(key)
            if existing and (PUBLIC / existing.lstrip("/")).exists():
                skipped += 1
                continue
            src = PUBLIC / str(entry.get("imageUrl", "")).lstrip("/")
            if not entry.get("imageUrl") or not src.is_file():
                print(f"missing image, skipped: {src}")
                failed += 1
                continue
            out = out_dir / f"{src.stem}.webp"
            try:
                with Image.open(src) as img:
                    img = img.convert("RGB")
                    img.thumbnail((max_size, max_size), Image.LANCZOS)
                    img.save(out, "WEBP", quality=quality, method=6)
            except Exception as exc:  # noqa: BLE001 - one bad image should not stop the rest
                print(f"could not create {folder}/{out.name}: {exc}")
                failed += 1
                continue
            url = f"output/{folder}/{out.name}"
            if entry.get(key) != url:
                entry[key] = url
                changed = True
            made += 1
            print(f"{folder}/{out.name}: {src.stat().st_size // 1024} KB -> {out.stat().st_size // 1024} KB")

    if changed:
        tmp = MANIFEST.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        os.replace(tmp, MANIFEST)
    print(
        f"Done: {made} images created, {skipped} already existed, {failed} failed."
        + ("" if changed else " Manifest unchanged.")
    )


if __name__ == "__main__":
    main()
