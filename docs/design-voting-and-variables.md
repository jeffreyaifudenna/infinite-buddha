# Design exploration: word voting and richer prompt variables

Status: written 2026-10-25 against commit 965a52e. Step 1 of the suggested order (the
slot-based `data/vocabulary.json` and template prompt builder) is implemented; the "where
things stand" section below describes the code before that change. Voting is not started.

## Where things stand today

- The site is static (Vite + React) hosted on Vercel. There is no server, no database and no
  user accounts. The only data the site reads is `public/data/manifest.json`.
- Once a night a GitHub Action runs `generate_buddha.py`. It picks one entry from each of three
  hard-coded Python lists (`SUBJECTS`, `ENVIRONMENTS`, `STYLES`), joins them into one sentence,
  asks Gemini for a 1:1 image, and commits the image plus a new manifest entry to `main`.
  Vercel redeploys on the push.
- Repetition avoidance (`pick_fresh`) works per list: never reuse an option until all are used,
  then prefer the oldest third. The full prompt text must also be new.
- Tags are derived by keyword-matching the final prompt.

Both features below have to respect this shape: the only moment anything "decides" is the
nightly job, and the only durable store the job writes is git.

---

## Part 1: Letting visitors vote on words

### What the feature is

Each day the site shows a small ballot for tomorrow's Buddha: a handful of slots (for example
material, setting, light) with three or four candidate words each. Visitors tap one word per
slot. When the nightly job runs, the word with the most votes in each slot goes into the
prompt. The winners stay on the next ballot as defending champions, losers rotate out, and fresh
candidates are drawn from the pool. Over weeks the vocabulary evolves toward what the audience
likes, which is the "words move into the next generation" loop.

This is a genetic-algorithm framing with the audience as the fitness function:

| GA term | Infinite Buddha equivalent |
|---|---|
| Gene | one word or short phrase in a slot ("weathered bronze") |
| Chromosome | one full set of slot values = one prompt |
| Fitness | votes received, plus optional "like" on the finished image |
| Selection | top vote per slot wins the day |
| Crossover | winners from different days combine into new prompts |
| Mutation | new candidates injected into each ballot from the reserve pool |

### Lineage: Electric Sheep

The closest ancestor is Scott Draves's Electric Sheep (1999): a screensaver whose fractal
"sheep" are rated by viewers, and whose server breeds new sheep from the highest-rated
parents. The audience is the fitness function there too. The main borrowings and departures:

- **Mutation keeps novelty flowing.** Electric Sheep injects random mutations and freshly
  random sheep. The proposed ballot injects never-shown candidates each day, so the vocabulary
  cannot collapse onto a few favourites.
- **Votes on ingredients, not results.** Sheep are rated after they are seen; here words are
  chosen before the image exists. A later "like" on finished pieces would add result rating.
- **Selection per slot instead of parent crossover.** One winner per slot, recombined
  independently, rather than two whole parents bred into a child.
- **Closed vocabulary.** Every possible prompt is made of curated words, where a sheep's
  genome is open numeric parameters. That is a safety choice for an image model.
- **One generation a day**, so evolution shows over weeks rather than hours.

### The one hard problem: votes need somewhere to live

A static site cannot count votes. Three realistic options, in order of fit:

**Option A (recommended): a Vercel serverless function + Upstash Redis.**
Add an `api/vote.js` function to the repo. Vercel deploys files under `api/` as functions with no
extra config. Provision Upstash Redis from the Vercel Marketplace (free tier, REST API, atomic
increments). The function does `HINCRBY ballot:2026-10-26 material:bronze 1`. The nightly Python
job reads the hash back over Upstash's REST endpoint with a token stored as a GitHub secret.

- Pros: stays on infrastructure already in use, zero servers to run, atomic counters, the
  Python side is one HTTPS GET. Free tier is far above a hobby site's traffic.
- Cons: two new secrets (Upstash URL + token) in both Vercel and GitHub. The API code is
  JavaScript while generation is Python; that is fine, they only share Redis.

**Option B: Supabase (or Firebase) called straight from the browser.**
No serverless function. The browser inserts a row with the anon key; a Postgres function
tallies. The nightly job reads via the Supabase REST API.

- Pros: no `api/` code, built-in dashboard to inspect votes.
- Cons: abuse control has to live in row-level-security policies, which is awkward. Adds a
  second vendor. Over-featured for "count some words".

**Option C: GitHub only.** Use reactions on a daily GitHub Discussion or Issue as votes.

- Pros: literally zero infrastructure, votes are visible publicly.
- Cons: voters need a GitHub account and must leave the site. For a casual art audience this
  kills participation. Mentioned only to rule it out.

### Data flow with Option A

```
 nightly job (GitHub Action, Python)
   1. GET tallies for today's ballot from Upstash
   2. pick winner per slot (random among ties; random from pool if no votes)
   3. generate image, write manifest entry incl. winners + vote counts
   4. evolve vocabulary.json: winners stay, losers rotate, draw new candidates
   5. write tomorrow's ballot to public/data/ballot.json
   6. commit + push  -->  Vercel redeploys

 site (React)
   - reads ballot.json (static, no API call needed to show the ballot)
   - POST /api/vote {ballot, slot, word}  -->  function  -->  Upstash HINCRBY
   - GET  /api/tally?ballot=...           -->  optional live counts after voting

 vote function (Vercel, api/vote.js)
   - validates ballot id, slot and word against ballot.json (reject anything else)
   - one vote per slot per visitor: signed cookie or localStorage token + IP rate limit
   - HINCRBY, return new counts
```

Key simplification: the ballot itself is a committed static file, so the site only needs the
API for writes. Reads of the ballot are free and cached by the CDN like everything else.

### Files that would change or appear

| File | Change |
|---|---|
| `data/vocabulary.json` (new) | Single source of truth for all words: slot, text, status (`active` / `candidate` / `retired`), fitness, origin. Replaces the Python lists. |
| `public/data/ballot.json` (new) | Tomorrow's ballot: id (date), slots, candidates, closes-at. Written by the nightly job. |
| `generate_buddha.py` | Read vocabulary + tallies; pick winners; evolve; write ballot. Store `variables` and `votes` on the manifest entry. |
| `api/vote.js`, `api/tally.js` (new) | Vercel functions. |
| `src/App.jsx` | Ballot panel under the hero ("Shape tomorrow's Buddha"); "Chosen by you" badge on pieces that had votes. |
| `.github/workflows/generate_art.yml` | Pass `UPSTASH_REDIS_REST_URL` / `_TOKEN` secrets; `git add` the new JSON files. |
| `requirements.txt` | `requests` (or `upstash-redis`). |

### Design decisions worth making deliberately

- **How many slots on the ballot.** Three is the sweet spot. Every slot is three more taps;
  casual visitors will do three, not seven. Slots not on the ballot are still filled randomly
  from the active pool, so the image stays varied.
- **Winner-takes-all vs weighted.** Winner-takes-all is legible ("bronze won with 41 votes").
  Weighted sampling is fairer but visitors cannot see their influence. Start with winner-takes-all
  and show the count on the finished piece.
- **Champion persistence.** Keep yesterday's winner on today's ballot. If it wins again, the
  word's fitness climbs and it gets drawn more often in non-ballot slots too. Cap a streak at
  three days so the feed does not get stuck on "moss".
- **Zero-vote days.** Fall back to the current random behaviour. Nothing breaks if nobody votes.
- **Mutation rate.** Each ballot: one champion, one high-fitness word, one or two random
  candidates from the reserve pool (including never-shown words). That keeps novelty flowing.
- **Anti-abuse.** This is a fun project, not an election. A one-vote-per-slot cookie plus a
  per-IP limit in the function (say 30 requests per hour, also in Redis) is proportionate.
  Validating the word against the published ballot is the important part: it means nothing a
  visitor types can ever reach the prompt.
- **Where new words come from.** Phase 1: only curated words from the owner. Phase 2, if wanted:
  a "suggest a word" box that lands in a Redis list, which the nightly job screens (letters and
  spaces only, max three words, then a Gemini text-model safety and relevance check) before
  promoting to `candidate`. Free text into an image prompt is the main risk surface of the whole
  feature, so this must stay a separate, moderated phase.

### Showing influence back to the visitor

The loop only feels alive if the site closes it:

- Hero badge when the piece had votes: "Chosen by 128 votes: bronze · bamboo grove · dawn".
- In the detail modal, highlight the voted words inside the prompt.
- Optional later: a tiny "lineage" line ("bronze has won 4 of its last 6 ballots").

---

## Part 2: More variables for the Buddha prompts

### What limits the current approach

The three lists bundle several ideas into each option. A `SUBJECTS` entry already fixes
material, pose, expression and sometimes scale ("Life-sized realistic bronze Buddha seated in
lotus position with a soft weathered patina"). That has two costs:

1. **Combinatorics are smaller than they look.** 35 × 28 × 15 = 14,700 prompts, but most of
   the variety is inside the subject sentence, so pieces with the same subject look alike.
2. **Voting needs single words.** You cannot vote for a 15-word subject sentence; you can vote
   for "bronze" or "reclining".

The fix is to split into orthogonal slots and compose a sentence from them.

### Proposed slots

| Slot | Example values | Notes |
|---|---|---|
| material | sandstone, weathered teak, aged bronze, jade, unglazed terracotta, white marble, obsidian, translucent glass, gold leaf, wireframe light | Strongest visual driver |
| form / pose | seated in lotus, reclining, standing with abhaya mudra, head only, bust, walking, bas-relief in rock, hands only | |
| expression / detail | gentle half-smile, eyes closed, downcast eyes, serene gaze, cracked and repaired (kintsugi) | Keep short |
| scale | hand-sized, life-sized, monumental, miniature on a palm | Big composition changes |
| lineage | Gandharan, Khmer, Sukhothai Thai, Kamakura Japanese, Tibetan, Sri Lankan, Tang Chinese, contemporary minimalist | Huge stylistic range; keep respectful, descriptive only |
| place | bamboo grove, zen rock garden, mountain lake, tea pavilion, cosmic cathedral, crystal cavern | Today's `ENVIRONMENTS`, trimmed to the noun phrase |
| time of day | dawn, golden hour, overcast noon, dusk, moonlit night | Was buried inside style and environment |
| weather / atmosphere | soft mist, light rain, falling snow, drifting incense smoke, clear air | |
| season | spring blossom, high summer, autumn maples, first snow | |
| companions | koi, a single deer, cranes, lotus flowers, candle flames, floating lanterns, none | "none" should be common |
| medium | photograph, ink wash painting, oil on canvas, woodblock print, watercolor, 3D render, charcoal sketch | Currently always photo-ish |
| lighting | diffused daylight, rim light, chiaroscuro, volumetric haze, candlelight | |
| palette | earth tones, gold and teal, monochrome, muted pastels, deep indigo | |
| camera | 35mm, macro detail, wide establishing shot, low angle, overhead | Only applies when medium is photographic |

Not every slot needs to be filled every day. A realistic prompt uses six to eight; the rest are
left empty. That alone yields millions of distinct prompts without any list growing past
15 entries.

### Keeping the mix coherent

More slots means more ways for a prompt to fight itself ("wireframe light Buddha, National
Geographic photography, ink wash painting"). Three guards:

1. **Theme tags on every word.** Each word carries `themes: ["organic"]`, `["cosmic"]` or both.
   The job picks a theme for the day first (weighted, say 75% organic, 25% cosmic, since the
   site's description promises stone, wood and natural light), then only draws words compatible
   with it. A 10% "crossover" chance ignores the guard for pleasant surprises.
2. **Exclusions.** A few pairs never mix: `medium: ink wash` excludes `camera: *`;
   `material: wireframe light` excludes `lineage: Gandharan`. A small `excludes` list per word.
3. **Sentence assembly.** Two ways to turn slot values into a prompt:
   - **Template** (deterministic, free; this is what is implemented): a short descriptive
     paragraph rather than a keyword list, since Gemini's image models follow prose better.
     `"A {medium} of a {scale} {lineage} {material} Buddha {pose} {expression}, {place} {time}
     {atmosphere} {companions}. Lit by {lighting}. A palette of {palette}. {camera}. {finish}."`
     Empty slots are dropped, a sentence with no filled slot is dropped whole, and articles,
     commas and capitals are tidied. Fully auditable.
   - **LLM composition** (one extra cheap text call): give Gemini Flash the slot values and ask
     for a single flowing 60-word prompt. Produces nicer prose and smooths odd combinations, at
     the cost of determinism and one more failure point. Store both the slot values and the
     final text in the manifest so nothing is lost either way.

   Recommendation: start with the template; add LLM composition later if prompts read as word
   salad.

### How this changes the existing code

- The three lists become `data/vocabulary.json` (the same file voting needs). Each entry:
  `{ "slot": "material", "text": "aged bronze", "themes": ["organic"], "status": "active",
  "fitness": 0, "origin": "seed", "excludes": [] }`.
- `pick_fresh` generalises unchanged: run it per slot over that slot's active words.
- Manifest entries gain `"variables": { "material": "aged bronze", ... }`. The existing
  `subject` / `environment` / `style` keys stay for old entries; `prompt_parts` already tolerates
  missing fields, and only one of the fifteen existing entries has them anyway.
- `derive_tags` can map slot values to tags directly (material → "Hand-Crafted", theme →
  "Sacred Geometry") instead of keyword-matching, which is more reliable.
- `TITLES` could be composed too (adjective + noun lists) or chosen to echo a winning word, so
  titles stop repeating as the archive grows past the 29 names.
- Model-side variables are limited: Gemini's image config exposes aspect ratio (keep 1:1 for the
  grid) and seed, and it has no negative prompt. Variety has to come from the text.

### Suggested order of work

1. **Vocabulary file + slot-based prompt builder** in `generate_buddha.py`, no UI change. This is
   the foundation for everything else and improves variety on its own. One evening of work;
   verify by dry-running the builder a few hundred times and eyeballing prompts.
2. **Ballot file + ballot panel** on the site, with Upstash and the vote function. Winners read
   back in the nightly job. Another evening or two.
3. **Close the loop in the UI**: "Chosen by you" badge, highlighted words, vote counts.
4. **Optional later**: word suggestions with moderation; LLM prompt composition; a "like" button
   on finished pieces feeding back into word fitness.

### Open questions for you

- Should voting shape every slot or only the three on the ballot? (Recommendation: ballot slots
  only; the rest stay random so the feed does not converge.)
- Is a cosmic/sacred-geometry day welcome at roughly one in four, or should the site stay
  mostly organic as the tagline says?
- Lineage names (Khmer, Gandharan, etc.) add a lot of visual range. Comfortable including them?
