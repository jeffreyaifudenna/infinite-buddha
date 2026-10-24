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
DISPLAY_DIR = OUTPUT_DIR / "display"
MANIFEST_PATH = ROOT / "public" / "data" / "manifest.json"

MODEL = os.environ.get("BUDDHA_MODEL", "gemini-3.1-flash-image")
MAX_ATTEMPTS = 3
THUMB_SIZE = 640
DISPLAY_SIZE = 1600  # cap only; current images are ~1024px, so they keep full resolution
DISPLAY_QUALITY = 85  # ~200 KB vs ~1 MB for the original JPG

MIME_TO_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}

SUBJECTS = [
    # Grounded, Organic, Humble & Peaceful Realism
    "Hand-carved sandstone Buddha resting in quiet contemplation",
    "Weathered teak wood Buddha sculpture with gentle, compassionate features",
    "Simple unglazed terracotta Buddha figure embodying humble serenity",
    "Minimalist river-stone Buddha statue nestled among smooth pebbles",
    "Aged bronze Buddha with a soft, weathered patina and calm expression",
    "Hand-hewn granite Buddha bust with subtle, peaceful chisel marks",
    "Reclining wooden Buddha carved from reclaimed timber",
    "Subtle stone Buddha silhouette half-covered in soft green moss",
    "Matte ceramic Buddha figure radiating a calm, meditative stillness",
    "Classic white marble Buddha statue catching soft morning sunbeams",
    "Worn soapstone Buddha figure with smooth, touch-soft contours",
    "Simple bamboo-framed meditative Buddha silhouette",
    "Humble earthenware Buddha figure resting on a bed of dry autumn leaves",
    "Calm seated Buddha carved from dark walnut wood",
    "Minimalist river-rock stack forming a serene meditative figure",
    "Soft porcelain Buddha figure with a delicate, peaceful glaze",
    "Weathered limestone Buddha head with quiet, timeless eyes",
    "Hand-carved cedar Buddha figure resting in quiet dignity",
    "Subtle clay Buddha sculpture drying under gentle sunlight",
    "Peaceful bronze Buddha with an understated, gentle smile",
    "Realistic hand-carved weathered teak wood Buddha statue with serene facial expressions",
    "Grounded raw sandstone Buddha sculpture showing subtle natural rock texture and chisel marks",
    "Life-sized realistic bronze Buddha seated in lotus position with a soft weathered patina",
    "Simple unglazed terracotta Buddha figure with a warm, humble, and serene presence",
    "Realistic ancient stone Buddha relief carving embedded naturally into a mossy granite cliff",

    # Sacred Geometry & Celestial Forms
    "Low-poly sacred geometry Buddha floating in deep meditative stillness",
    "Minimalist low-poly Buddha statue resting in lotus pose",
    "Abstract low-poly golden Buddha face with intricate sacred geometry patterns",
    "Holographic wireframe Buddha sitting in lotus pose",
    "Crystalline prismatic Buddha sculpture refracting light into complex mandalas",
    "Floating cybernetic Buddha head composed of golden floating polygons",
    "Transcendent translucent glass Buddha holding a glowing energy sphere",
    "Celestial stellar Buddha figure woven entirely from golden stardust filaments",
    "Obsidian-carved minimalist Buddha bust inlaid with pulsating golden veins",
    "Floating mandala-patterned wireframe Buddha radiating soft pastel energy fields"
]

ENVIRONMENTS = [
    # All-Natural, Organic & Grounded Landscapes
    "under the shade of an ancient weeping willow beside a quiet pond",
    "beside a gentle mountain stream flowing over smooth river stones",
    "within a tranquil bamboo grove with soft sunlight filtering through the stalks",
    "in a serene zen rock garden surrounded by raked white gravel and pine needles",
    "under a quiet autumn canopy of golden maple leaves and soft morning mist",
    "in a peaceful moss-covered forest clearing touched by early dawn light",
    "on a quiet hillside overlooking a misty green valley at sunrise",
    "inside a humble wooden tea pavilion with open windows framing a quiet garden",
    "beside a still mountain lake reflecting a clear twilight sky",
    "within a secluded stone courtyard shaded by blossoming cherry trees",
    "on a soft bed of pine needles under the boughs of a towering pine tree",
    "in a quiet rural courtyard filled with potted ferns and soft morning dew",
    "beside a trickling garden waterfall surrounded by ferns and smooth rocks",
    "within a minimalist wooden sanctuary overlooking a quiet misty meadow",
    "underneath an old gnarled olive tree in a sunlit Mediterranean orchard",
    "beside a quiet winding country path lined with wild lavender and sage",
    "in a sheltered garden alcove filled with quiet shade and soft earth",
    "on a high mountain overlook bathed in the quiet warmth of dawn",
    "within a peaceful earthen hermitage surrounded by quiet rolling hills",
    "beside a shallow forest pool reflecting quiet clouds and tall reeds",
    "under the shaded canopy of an ancient oak tree in a quiet, all-natural forest grove",
    "deep in a quiet, low-tech rural valley with soft morning sunlight filtering through pine needles",

    # Cosmic, Cathedral & Temple Spaces
    "inside an ancient cosmic cathedral where starlight pours through stained glass etched with sacred geometry",
    "surrounded by a glowing quantum matrix and digital star constellations",
    "on a reflective salt flat mirror under an aurora borealis sky pulsing with gold and teal",
    "floating inside a bioluminescent subterranean crystal cavern illuminated by pulsing ley lines",
    "floating gracefully in a zero-gravity orbital space station overlooking a vibrant planet curve",
    "inside a monolithic brutalist concrete temple illuminated by a single vertical ray of golden sunlight"
]

STYLES = [
    # Naturalistic, Organic & Authentic Lighting
    "photorealistic National Geographic photography style, natural sunlight, organic earth tones, sharp focus",
    "warm golden hour rim lighting, authentic material textures, soft natural depth of field, 8k resolution",
    "diffused overcast daylight, matte stone and wood grain textures, quiet contemplative mood, masterpiece",
    "soft morning sunlight, natural earth tones, fine film grain, serene unpretentious aesthetic",
    "authentic raw material finish, subtle shadows, peaceful outdoor ambient lighting, hyper-detailed photorealism",
    "quiet natural lighting, subtle earth textures, understated elegance, minimalist organic art style",
    "gentle diffused light, rich tactile textures, serene and grounded composition, timeless aesthetic",
    "warm amber morning light, soft shadows, organic material finish, peaceful meditative mood",
    "subtle directional lighting, matte stone and wood textures, serene minimalist composition, master craft quality",
    "natural open-air lighting, calm organic gradients, quiet contemplative atmosphere, fine art aesthetic",

    # Cinematic & Sacred High-Contrast Lighting
    "cinematic dramatic side-lighting, vibrant gold and iridescent teal gradients, 8k resolution, photorealistic digital art",
    "ethereal soft glow, dark moody aesthetic with floating geometric light particles, ultra-detailed digital art",
    "hyper-detailed volumetric lighting, mystic haze, unreal engine 5 render style",
    "chiaroscuro lighting, moody dark obsidian background, ultra-sharp polygonal edges, masterpiece",
    "extreme cinematic chiaroscuro, matte obsidian textures, glowing gold leaf accents, masterpiece museum exhibition quality"
]

TITLES = [
    "Quiet Stillness", "Serene Dawn", "Grounded Peace", "Gentle Awakening",
    "Whispering Pines", "Inner Calm", "River Stone", "Soft Morning",
    "Sublime Silence", "Peaceful Valley", "Timeless Solitude", "Earthen Grace",
    "Humble Path", "Quiet Waters", "Rooted Harmony", "Mindful Breath",
    "Mossy Stone", "Dawn Meditation", "Calm Sanctuary", "Tranquil Shade",
    "Natural Balance", "Quiet Horizon", "Pure Simplicity", "Serene Grove",
    "Simple Life", "Rooted Stillness", "Grounded Earth", "Quantum Silence", "Sacred Echo"
]

# Tags are derived from the keywords in the final prompt.
TAG_KEYWORDS = {
    "Serenity": ("serene", "peaceful", "calm", "tranquil", "quiet", "stillness"),
    "Grounded Nature": (
        "natural", "moss", "stream", "forest", "stone", "wood", 
        "earth", "pine", "garden", "river", "leaves", "meadow", "oak", "cedar", "bamboo"
    ),
    "Hand-Crafted": ("carved", "ceramic", "terracotta", "bronze", "sculpture", "chiseled", "granite", "sandstone"),
    "Sacred Geometry": ("low-poly", "geometry", "wireframe", "crystalline", "prismatic", "mandala", "holographic"),
    "Soft Light": ("morning", "sunlight", "dawn", "soft", "warm", "diffused", "golden hour"),
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


def save_webp(image_bytes, out_path, max_size, quality):
    """Write a WebP copy no larger than max_size. Returns True on success."""
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            img = img.convert("RGB")
            img.thumbnail((max_size, max_size), Image.LANCZOS)
            img.save(out_path, "WEBP", quality=quality, method=6)
        return True
    except Exception as exc:  # noqa: BLE001 - WebP copies are optional
        print(f"   warning: could not create {out_path.name}: {exc}")
        return False


def prompt_parts(entry):
    """(subject, environment, style) of a past piece. Older entries only stored the
    full prompt, so match it against the current lists (None if it isn't in them)."""
    prompt = entry.get("prompt", "")
    subject = entry.get("subject") or next((s for s in SUBJECTS if prompt.startswith(s)), None)
    environment = entry.get("environment") or next((e for e in ENVIRONMENTS if e in prompt), None)
    style = entry.get("style") or next((s for s in STYLES if prompt.endswith(s)), None)
    return subject, environment, style


def pick_fresh(options, last_used):
    """Pick an option that has never been used; once all have been, pick from the
    third that was used longest ago. last_used maps option -> days ago (0 = newest)."""
    unused = [o for o in options if o not in last_used]
    if unused:
        return random.choice(unused)
    oldest_first = sorted(options, key=lambda o: last_used[o], reverse=True)
    return random.choice(oldest_first[: max(1, len(options) // 3)])


def choose_prompt(manifest):
    """Build a prompt whose subject, setting and style were not used recently, and
    whose full text has never been used. Returns (subject, environment, style, prompt)."""
    last_used = ({}, {}, {})
    for age, entry in enumerate(manifest):  # newest first, so the first sighting is the latest
        for seen, part in zip(last_used, prompt_parts(entry)):
            if part is not None:
                seen.setdefault(part, age)
    used_prompts = {e.get("prompt") for e in manifest}

    for _ in range(100):
        subject = pick_fresh(SUBJECTS, last_used[0])
        environment = pick_fresh(ENVIRONMENTS, last_used[1])
        style = pick_fresh(STYLES, last_used[2])
        prompt_text = f"{subject} {environment}, {style}"
        if prompt_text not in used_prompts:
            return subject, environment, style, prompt_text
    raise RuntimeError("Could not find an unused prompt; add more subjects, settings or styles.")


def choose_title(manifest):
    """A title name not used recently, with a number so the full title is unique."""
    used_titles = {e.get("title") for e in manifest}
    last_used = {}
    for age, entry in enumerate(manifest):
        last_used.setdefault(str(entry.get("title", "")).split(" #")[0], age)
    name = pick_fresh(TITLES, {t: a for t, a in last_used.items() if t in TITLES})
    for _ in range(1000):
        title = f"{name} #{random.randint(100, 999)}"
        if title not in used_titles:
            return title
    raise RuntimeError(f"Ran out of numbers for the title {name!r}.")


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
    DISPLAY_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Fail fast on a corrupt manifest, before spending an API call.
    manifest = load_manifest()

    # Reads GEMINI_API_KEY from the environment.
    client = genai.Client()

    subject, environment, style, prompt_text = choose_prompt(manifest)
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

    webp_name = f"buddha-{timestamp_id}.webp"
    has_thumb = save_webp(image_bytes, THUMB_DIR / webp_name, THUMB_SIZE, 80)
    has_display = save_webp(image_bytes, DISPLAY_DIR / webp_name, DISPLAY_SIZE, DISPLAY_QUALITY)

    # URLs are relative (no leading slash) so the site also works under a subpath.
    entry = {
        "id": f"buddha-{timestamp_id}",
        "title": choose_title(manifest),
        "imageUrl": f"output/{filename}",
        "prompt": prompt_text,
        "subject": subject,
        "environment": environment,
        "style": style,
        "seed": seed,
        "date": date_str,
        "tags": derive_tags(prompt_text),
    }
    if has_thumb:
        entry["thumbUrl"] = f"output/thumbs/{webp_name}"
    if has_display:
        entry["displayUrl"] = f"output/display/{webp_name}"

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