The Infinite Buddha

A new Buddha Daily.

Project by Jeffrey Fudenna, learning to use AI.

Open Source!

## How a Buddha is made

Every night `generate_buddha.py` picks a theme (organic or cosmic), fills a set of slots
(material, pose, place, time of day, medium, lighting, ...) with words from
`data/vocabulary.json`, writes them into a short descriptive paragraph and asks Gemini for the image.
Edit the JSON to add words; preview the results without spending an API call:

```bash
python generate_buddha.py --dry-run 20
```
