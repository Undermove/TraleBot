#!/usr/bin/env python3
"""Рисует кадры комикса по файлу <id>.prompts.json: PNG 1024×1024 в указанную папку.

Запуск: python3 scripts/verbs/story-art/gen_frames.py <id истории> <папка для PNG>
Ключ OpenAI читается из ~/.config/openai/key и никуда не печатается. Готовые кадры не перерисовываются:
чтобы переделать кадр, удали его PNG. PNG в репозиторий не кладём — дальше scripts/verbs/story-frames.mjs.
"""
import base64, json, subprocess, sys
from pathlib import Path

ART = Path(__file__).parent
story, out_dir = sys.argv[1], Path(sys.argv[2])
spec = json.loads((ART / f"{story}.prompts.json").read_text(encoding="utf8"))
out_dir.mkdir(parents=True, exist_ok=True)
KEY = (Path.home() / ".config/openai/key").read_text().strip()

first = out_dir / f"{spec['frames'][0]['image']}.png"
for frame in spec["frames"]:
    out = out_dir / f"{frame['image']}.png"
    if out.exists(): continue
    cmd = ["curl", "-sS", "https://api.openai.com/v1/images/edits", "-H", f"Authorization: Bearer {KEY}", "--max-time", "600",
           "-F", "model=gpt-image-2", "-F", f"prompt={frame['scene']} {spec['style']}", "-F", "size=1024x1024", "-F", "quality=medium", "-F", "n=1",
           "-F", f"image[]=@{ART / 'mascot-reference.png'}"]
    # Первый кадр идёт вторым образцом во все остальные: так второй герой и манера не «плывут».
    if out != first and first.exists(): cmd += ["-F", f"image[]=@{first}"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    try:
        d = json.loads(r.stdout)
        if "error" in d: print(out.name, "ERROR", d["error"].get("message", "")[:300]); continue
        out.write_bytes(base64.b64decode(d["data"][0]["b64_json"])); print(out.name, "ok", flush=True)
    except Exception as e:
        print(out.name, "FAIL", type(e).__name__, r.stdout[:200].replace(KEY, "***"), r.stderr[:200].replace(KEY, "***"))
