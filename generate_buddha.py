#!/usr/bin/env python3
"""Generate one Infinite Buddha art piece and add it to public/data/manifest.json.

The prompt is assembled from words in data/vocabulary.json: one word per "slot"
(material, pose, place, lighting, ...) dropped into PROMPT_TEMPLATE below.

    python generate_buddha.py              # generate tonight's piece
    python generate_buddha.py --dry-run 20 # print 20 prompts, no API call, no files written
"""

import argparse
import io
import json
import os
import random
import re
import sys
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path

# Paths are anchored to this file, so the script works from any working directory.
ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT / "public" / "output"
THUMB_DIR = OUTPUT_DIR / "thumbs"
DISPLAY_DIR = OUTPUT_DIR / "display"
MANIFEST_PATH = ROOT / "public" / "data" / "manifest.json"
VOCABULARY_PATH = ROOT / "data" / "vocabulary.json"

MODEL = os.environ.get("BUDDHA_MODEL", "gemini-3.1-flash-image")
MAX_ATTEMPTS = 3
THUMB_SIZE = 640
DISPLAY_SIZE = 1600  # cap only; current images are ~1024px, so they keep full resolution
DISPLAY_QUALITY = 85  # ~200 KB vs ~1 MB for the original JPG

# How the chosen words become one prompt: a short descriptive paragraph, which image
# models follow better than a list of keywords. Each {slot} is replaced by that slot's
# word, or removed when the slot was not filled; a fragment with none of its slots
# filled is dropped whole, and render_prompt tidies spaces, commas and articles.
# Words carry their own prepositions ("at dawn", "with koi gliding...").
PROMPT_TEMPLATE = (
    "A {medium} of a {scale} {lineage} {material} Buddha {pose} {expression}",
    ", {place} {time} {atmosphere}, {companions}.",
    " Lit by {lighting}.",
    " A palette of {palette}.",
    " {camera}.",
    " {finish}.",
)
TEMPLATE_SLOTS = set(re.findall(r"{(\w+)}", "".join(PROMPT_TEMPLATE)))

# Chance that one slot borrows a word from the other theme (an organic Buddha in a
# cosmic place, say) instead of staying strictly on the day's theme.
CROSSOVER_RATE = 0.1

MIME_TO_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}

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
    "Painted": ("painting", "watercolor", "gouache", "woodblock", "charcoal", "ink wash"),
}


def derive_tags(prompt_text):
    text = prompt_text.lower()
    tags = [tag for tag, words in TAG_KEYWORDS.items() if any(w in text for w in words)]
    return tags + ["AI Art"]


# --------------------------------------------------------------------------- vocabulary


def load_vocabulary():
    """Read data/vocabulary.json, drop retired words and check it is well formed."""
    try:
        with open(VOCABULARY_PATH, "r", encoding="utf-8") as f:
            vocab = json.load(f)
    except FileNotFoundError:
        raise SystemExit(f"Vocabulary not found: {VOCABULARY_PATH}")
    except json.JSONDecodeError as exc:
        raise SystemExit(f"{VOCABULARY_PATH.name} is not valid JSON: {exc}")

    problems = []
    themes = vocab.get("themes") or {}
    if not themes or any(not isinstance(w, (int, float)) or w <= 0 for w in themes.values()):
        problems.append("'themes' must map each theme to a positive weight")

    slots = vocab.get("slots") or []
    slot_names = [s.get("name") for s in slots]
    for name in TEMPLATE_SLOTS - set(slot_names):
        problems.append(f"template uses slot {{{name}}} which is not in the vocabulary")

    for slot in slots:
        name = slot.get("name") or "<unnamed>"
        if name not in TEMPLATE_SLOTS:
            problems.append(f"slot '{name}' is not used by the template")
        fill = slot.get("fill", 1)
        if not isinstance(fill, (int, float)) or not 0 < fill <= 1:
            problems.append(f"slot '{name}': fill must be a number in (0, 1]")
        slot["words"] = [w for w in slot.get("words", []) if w.get("status", "active") == "active"]
        if not slot["words"]:
            problems.append(f"slot '{name}' has no active words")
        for word in slot["words"]:
            text = word.get("text")
            if not text or not isinstance(text, str):
                problems.append(f"slot '{name}': every word needs a 'text'")
                continue
            if not word.get("themes") or any(t not in themes for t in word["themes"]):
                problems.append(f"'{text}': themes must be a non-empty subset of {sorted(themes)}")
            for ex in word.get("excludes", []):
                if ex.split(":", 1)[0] not in slot_names:
                    problems.append(f"'{text}': exclusion '{ex}' names an unknown slot")

    if problems:
        raise SystemExit(f"{VOCABULARY_PATH.name} has problems:\n  - " + "\n  - ".join(problems))
    return vocab


def conflicts(word, slot_name, chosen):
    """True if `word` (from slot `slot_name`) is excluded by, or itself excludes, any
    already chosen word. An exclusion is a slot name ("camera") or "slot:text"."""

    def excluded(excludes, other_slot, other_text):
        return other_slot in excludes or f"{other_slot}:{other_text}" in excludes

    for other_slot, other in chosen.items():
        if excluded(word.get("excludes", ()), other_slot, other["text"]):
            return True
        if excluded(other.get("excludes", ()), slot_name, word["text"]):
            return True
    return False


def pick_fresh(options, last_used):
    """Pick an option that has never been used; once all have been, pick from the
    third that was used longest ago. last_used maps option -> days ago (0 = newest)."""
    unused = [o for o in options if o not in last_used]
    if unused:
        return random.choice(unused)
    oldest_first = sorted(options, key=lambda o: last_used[o], reverse=True)
    return random.choice(oldest_first[: max(1, len(options) // 3)])


def choose_theme(vocab):
    themes = vocab["themes"]
    return random.choices(list(themes), weights=list(themes.values()))[0]


def choose_words(vocab, theme, last_used):
    """Fill the slots for one prompt. Returns {slot name: word dict}.

    Slots are visited in vocabulary order. Each is filled with probability `fill`,
    from words that fit the day's theme and do not conflict with words already chosen.
    One slot may cross over to the other theme. A slot with fill 1 is always filled,
    falling back to off-theme words if it must."""
    other_themes = [t for t in vocab["themes"] if t != theme]
    slot_names = [s["name"] for s in vocab["slots"]]
    crossover = random.choice(slot_names) if other_themes and random.random() < CROSSOVER_RATE else None

    chosen = {}
    for slot in vocab["slots"]:
        name = slot["name"]
        fill = slot.get("fill", 1)
        if fill < 1 and random.random() >= fill:
            continue
        compatible = [w for w in slot["words"] if not conflicts(w, name, chosen)]
        pool = []
        if name == crossover:
            pool = [w for w in compatible if any(t in w["themes"] for t in other_themes)]
        if not pool:
            pool = [w for w in compatible if theme in w["themes"]]
        if not pool and fill >= 1:
            pool = compatible
        if not pool:
            continue
        by_text = {w["text"]: w for w in pool}
        chosen[name] = by_text[pick_fresh(list(by_text), last_used.get(name, {}))]
    return chosen


def render_prompt(template, values):
    """Fill the template fragments, dropping empty slots and whole fragments with no
    filled slot, then tidy the spaces, punctuation and articles they leave behind."""
    filled = defaultdict(str, values)
    kept = [f for f in template if any(filled[s] for s in re.findall(r"{(\w+)}", f))]
    text = "".join(f.format_map(filled) for f in kept)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s+([,.])", r"\1", text)  # "lake ." -> "lake."
    text = re.sub(r",(\s*,)+", ",", text)  # ", , ," -> ","
    text = re.sub(r",\s*\.", ".", text)  # ", ." -> "."
    text = re.sub(r"\b([Aa]) (?=[aeiouAEIOU])", r"\1n ", text)  # "a ink wash" -> "an ink wash"
    text = re.sub(r"(^|\. )([a-z])", lambda m: m.group(1) + m.group(2).upper(), text)
    return text.strip()


def choose_prompt(manifest, vocab):
    """Build a prompt whose words were not used recently and whose full text is new.
    Returns (theme, {slot: text}, prompt)."""
    last_used = {}
    for age, entry in enumerate(manifest):  # newest first, so the first sighting is the latest
        for slot, text in (entry.get("variables") or {}).items():
            last_used.setdefault(slot, {}).setdefault(text, age)
    used_prompts = {e.get("prompt") for e in manifest}

    for _ in range(100):
        theme = choose_theme(vocab)
        words = choose_words(vocab, theme, last_used)
        values = {slot: w["text"] for slot, w in words.items()}
        prompt_text = render_prompt(PROMPT_TEMPLATE, values)
        if prompt_text not in used_prompts:
            return theme, values, prompt_text
    raise RuntimeError("Could not find an unused prompt; add more words to data/vocabulary.json.")


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


# --------------------------------------------------------------------------- generation


def request_image(client, prompt_text, seed):
    """Call the model, retrying with backoff. Returns (bytes, mime_type)."""
    from google.genai import types

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
    from PIL import Image

    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            img = img.convert("RGB")
            img.thumbnail((max_size, max_size), Image.LANCZOS)
            img.save(out_path, "WEBP", quality=quality, method=6)
        return True
    except Exception as exc:  # noqa: BLE001 - WebP copies are optional
        print(f"   warning: could not create {out_path.name}: {exc}")
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
    DISPLAY_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Fail fast on a corrupt manifest or vocabulary, before spending an API call.
    manifest = load_manifest()
    vocab = load_vocabulary()

    # Reads GEMINI_API_KEY from the environment.
    from google import genai

    client = genai.Client()

    theme, variables, prompt_text = choose_prompt(manifest, vocab)
    seed = random.randint(100000, 999999)
    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    timestamp_id = now.strftime("%Y%m%d-%H%M%S")

    print(f"-> Theme: {theme}")
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
        "theme": theme,
        "variables": variables,
        "seed": seed,
        "date": date_str,
        "tags": derive_tags(prompt_text),
    }
    if has_thumb:
        entry["thumbUrl"] = f"output/thumbs/{webp_name}"
    if has_display:
        entry["displayUrl"] = f"output/display/{webp_name}"

    update_manifest(entry)


def dry_run(count):
    """Print `count` prompts as if generated on consecutive nights. Nothing is written."""
    manifest = load_manifest()
    vocab = load_vocabulary()
    for i in range(count):
        theme, variables, prompt_text = choose_prompt(manifest, vocab)
        print(f"[{i + 1:>3}] ({theme}) {prompt_text}")
        # Pretend the piece was published, so freshness rules shape the next one.
        manifest.insert(0, {"prompt": prompt_text, "variables": variables})


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--dry-run",
        nargs="?",
        const=10,
        type=int,
        metavar="N",
        help="print N prompts (default 10) without generating an image or writing files",
    )
    args = parser.parse_args()

    try:
        if args.dry_run is not None:
            dry_run(args.dry_run)
        else:
            generate_art_piece()
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        print(f"Error generating art piece: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
