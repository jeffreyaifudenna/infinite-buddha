#!/usr/bin/env python3
"""Generate one Infinite Buddha art piece and add it to public/data/manifest.json."""

import io
import json
import os
import random
import sys
import time
from datetime import datetime
from pathlib import Path

from google import genai
from google.genai import types
from PIL import Image

# Paths are anchored to this file, so the script works from any working directory.
ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT / "public" / "output"
THUMB_DIR = OUTPUT_DIR / "thumbs"
MANIFEST_PATH = ROOT / "public" / "data" / "manifest.json"

MODEL = os.environ.get("BUDDHA_MODEL", "gemini-3.1-flash-image")
MAX_ATTEMPTS = 3
THUMB_SIZE = 640

MIME_TO_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}

SUBJECTS = [
    "Low-poly sacred geometry Buddha meditating",
    "Minimalist low-poly Buddha statue resting",
    "Abstract low-poly golden Buddha face with intricate sacred geometry patterns",
    "Holographic wireframe Buddha sitting in lotus pose",
    "Crystalline prismatic Buddha sculpture refracting light",
    "Gargantuan monolithic stone Buddha carved into a neon canyon cliffside",
    "Floating cybernetic Buddha head composed of golden floating polygons",
    "Transcendent translucent glass Buddha holding a glowing energy sphere",
    "Bioluminescent moss-covered ancient Buddha statue fused with organic technology",
    "Cybernetic bronze Buddha with intricate circuitry running down its arms",
    "Floating mandala-patterned wireframe Buddha radiating soft pastel energy",
    "Steampunk brass Buddha statue with glowing amber vacuum tubes",
    "Celestial stellar Buddha figure woven entirely from golden stardust and filaments",
    "Obsidian-carved minimalist Buddha bust inlaid with pulsating golden veins",
    "Liquid chrome Buddha sculpture melting into a serene geometric reflection pool",
    "Quantum holographic Buddha projected from a floating golden ring apparatus",
    "Ethereal translucent jade Buddha illuminated from within by sacred light geometry",
    "Carved wooden Buddha statue from weathered cedar wood resting peacefully",
    "Simple hand-carved stone Buddha statue nestled among river moss and wild ferns",
    "Unglazed terracotta Buddha figure embodying a grounded and serene presence",
]

ENVIRONMENTS = [
    "in a neon cyberpunk garden with glowing flora",
    "in a serene zen rock garden under a blood-red supermoon",
    "floating inside a bioluminescent deep-sea sacred temple",
    "surrounded by a glowing quantum matrix and digital constellations",
    "atop a misty neon-lit skyscraper rooftop overlooking a futuristic Tokyo cyberpunk skyline",
    "inside an ancient cosmic cathedral where starlight pours through stained glass etched with sacred geometry",
    "deep within a subterranean crystal cavern illuminated by pulsing neon ley lines",
    "floating gracefully in a zero-gravity orbital space station overlooking a vibrant planet curve",
    "amidst an ethereal floating island archipelago shrouded in mystical cyberpunk mist",
    "in a futuristic bamboo forest where the stalks are made of glowing green fiber optics",
    "within a towering digital archive library filled with floating holographic scrolls",
    "on a reflective salt flat mirror under an aurora borealis sky pulsing with gold and teal",
    "inside a monolithic brutalist concrete temple illuminated by a single vertical ray of golden sunlight",
    "floating above a tranquil midnight ocean reflecting a majestic cosmic nebula",
    "within a subterranean sanctuary lined with endless rows of glowing ancient scrolls",
    "amidst an ethereal floating garden of stone monoliths and luminous lotus flowers",
    "deep inside a high-tech orbital research sanctuary overlooking the curvature of a golden-rimmed earth",
    "under the shade of an ancient oak tree in an all natural forest grove",
    "beside a babbling mountain stream in a serene, grounded natural landscape",
    "within a simple life wooden sanctuary surrounded by wild uncultivated flora",
    "deep in a quiet, low-tech rural valley with soft morning sunlight filtering through pine needles",
]

STYLES = [
    "cinematic dramatic side-lighting, vibrant gold and iridescent teal gradients, 8k resolution, photorealistic digital art",
    "ethereal soft glow, dark moody cyberpunk aesthetic with metallic gold accents",
    "hyper-detailed volumetric lighting, mystic haze, unreal engine 5 render style",
    "cyber-zen aesthetic, floating geometric light particles, ultra-detailed generative art",
    "vaporwave pastel lighting, iridescent chrome reflections, synthwave color grading, 3D octane render",
    "chiaroscuro lighting, moody dark obsidian background, ultra-sharp polygonal edges, masterpiece",
    "bioluminescent ambient glow, volumetric smoke, cinematic depth of field, futuristic religious iconography",
    "cybernetic neon-noir lighting, high-contrast rim light, razor-sharp geometric polygons, futuristic art gallery piece",
    "extreme cinematic chiaroscuro, matte obsidian textures, glowing gold leaf accents, masterpiece museum exhibition quality",
    "hyper-detailed volumetric atmospheric haze, dramatic golden hour rim lighting, ultra-sharp polygonal precision",
    "surreal minimalist aesthetic, immaculate shadows, high-end gallery lighting, 8k resolution",
    "organic grounded texture, natural earth tones, soft morning light, hand-crafted simple life aesthetic, serene atmosphere",
    "warm organic wood grain, raw stone textures, peaceful natural lighting, unpretentious all natural look",
]

TITLES = [
    "Ethereal Meditation", "Digital Nirvana", "Quantum Awakening",
    "Neon Samadhi", "Obsidian Zen", "Astral Geometry", "Cyber Enlightenment",
    "Prismatic Silence", "Holographic Void", "Stellar Transcendence",
    "Silicon Karma", "Matrix Awakening", "Infinite Stillness", "Cosmic Resonance",
    "Cybernetic Sutra", "Neon Lotus", "Data Nirvana", "Singularity Zen",
    "Stellar Genesis", "Obsidian Sanctuary", "Golden Horizon", "Quantum Silence", "Sacred Echo",
    "Grounded Earth", "Serene Woods", "Simple Life", "Natural Harmony", "Rooted Stillness",
]

# Tags are derived from the words in the final prompt, so they match the image.
TAG_KEYWORDS = {
    "Low-Poly": ("low-poly", "polygon"),
    "Sacred Geometry": ("sacred", "geometr", "mandala"),
    "Cyber-Zen": ("cyber", "neon", "holograph", "quantum", "digital", "circuit", "matrix"),
    "Grounded Nature": (
        "natural", "oak", "stream", "rural", "wooden", "terracotta",
        "moss", "forest", "wild", "cedar", "pine", "earth tones",
    ),
}


def derive_tags(prompt_text):
    text = prompt_text.lower()
    tags = [tag for tag, words in TAG_KEYWORDS.items() if any(w in text for w in words)]
    return tags + ["AI Art"]


def request_image(client, prompt_text, seed):
    """Call the model, retrying with backoff. Returns (bytes, mime_type)."""
    last_error = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=prompt_text,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                    seed=seed,
                    image_config=types.ImageConfig(aspect_ratio="1:1"),
                ),
            )
            for part in response.parts or []:
                inline = getattr(part, "inline_data", None)
                if inline and inline.data:
                    return inline.data, (inline.mime_type or "image/png")
            feedback = getattr(response, "prompt_feedback", None)
            raise RuntimeError(f"No image data in response (feedback: {feedback})")
        except Exception as exc:  # noqa: BLE001 - retried, then re-raised
            last_error = exc
            print(f"   attempt {attempt}/{MAX_ATTEMPTS} failed: {exc}")
            if attempt < MAX_ATTEMPTS:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Image generation failed after {MAX_ATTEMPTS} attempts: {last_error}")


def save_thumbnail(image_bytes, thumb_path):
    """Write a small WebP thumbnail. Returns True on success."""
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            img = img.convert("RGB")
            img.thumbnail((THUMB_SIZE, THUMB_SIZE), Image.LANCZOS)
            img.save(thumb_path, "WEBP", quality=80, method=6)
        return True
    except Exception as exc:  # noqa: BLE001 - thumbnail is optional
        print(f"   warning: could not create thumbnail: {exc}")
        return False


def load_manifest():
    if not MANIFEST_PATH.exists():
        return []
    try:
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as exc:
        backup = MANIFEST_PATH.with_name(
            f"manifest.corrupt-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
        )
        os.replace(MANIFEST_PATH, backup)
        raise SystemExit(
            f"manifest.json is not valid JSON ({exc}). Moved it to {backup}; "
            "fix or restore it, then run again."
        )
    if not isinstance(data, list):
        raise SystemExit("manifest.json must contain a JSON list. Aborting without changes.")
    return data


def update_manifest(new_entry):
    manifest = load_manifest()
    manifest.insert(0, new_entry)  # newest first

    # Write to a temp file, then swap it in, so a crash can't leave a half-written file.
    tmp_path = MANIFEST_PATH.with_suffix(".json.tmp")
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    os.replace(tmp_path, MANIFEST_PATH)
    print(f"-> Manifest updated ({len(manifest)} pieces) at {MANIFEST_PATH}")


def generate_art_piece():
    print("Generating new Infinite Buddha art piece (square 1:1)...")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    THUMB_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Fail fast on a corrupt manifest, before spending an API call.
    load_manifest()

    # Reads GEMINI_API_KEY from the environment.
    client = genai.Client()

    prompt_text = (
        f"{random.choice(SUBJECTS)} {random.choice(ENVIRONMENTS)}, {random.choice(STYLES)}"
    )
    seed = random.randint(100000, 999999)
    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    timestamp_id = now.strftime("%Y%m%d-%H%M%S")

    print(f"-> Prompt: {prompt_text}")
    print(f"-> Seed: {seed}")

    image_bytes, mime = request_image(client, prompt_text, seed)
    ext = MIME_TO_EXT.get(mime, "png")

    filename = f"buddha-{timestamp_id}.{ext}"
    (OUTPUT_DIR / filename).write_bytes(image_bytes)
    print(f"-> Saved image to {OUTPUT_DIR / filename}")

    thumb_name = f"buddha-{timestamp_id}.webp"
    has_thumb = save_thumbnail(image_bytes, THUMB_DIR / thumb_name)

    # URLs are relative (no leading slash) so the site also works under a subpath.
    entry = {
        "id": f"buddha-{timestamp_id}",
        "title": f"{random.choice(TITLES)} #{random.randint(100, 999)}",
        "imageUrl": f"output/{filename}",
        "prompt": prompt_text,
        "seed": seed,
        "date": date_str,
        "tags": derive_tags(prompt_text),
    }
    if has_thumb:
        entry["thumbUrl"] = f"output/thumbs/{thumb_name}"

    update_manifest(entry)


def main():
    try:
        generate_art_piece()
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        print(f"Error generating art piece: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
