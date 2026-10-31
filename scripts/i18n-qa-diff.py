#!/usr/bin/env python3
"""
Pixel diff for i18n QA — before (origin/main) vs after (branch), Hebrew.

  python3 scripts/i18n-qa-diff.py <before_dir> <after_dir> [--threshold 0.5] [--out <diff_dir>]

For each PNG present in both dirs: % of pixels that differ (any channel > 16).
Different sizes count as a failure (full-page height changed). Writes a red
overlay <diff_dir>/<name> for failures and a summary.json. Exit 1 when any
image is above the threshold (percent).
"""
import json
import os
import sys

from PIL import Image, ImageChops

args = sys.argv[1:]
before, after = args[0], args[1]
threshold = float(args[args.index("--threshold") + 1]) if "--threshold" in args else 0.5
out = args[args.index("--out") + 1] if "--out" in args else None
if out:
    os.makedirs(out, exist_ok=True)

results = {}
failed = 0
for name in sorted(os.listdir(before)):
    if not name.endswith(".png") or not os.path.exists(os.path.join(after, name)):
        continue
    a = Image.open(os.path.join(before, name)).convert("RGB")
    b = Image.open(os.path.join(after, name)).convert("RGB")
    size_changed = a.size != b.size
    note = f"size {a.size} -> {b.size}" if size_changed else None
    if size_changed:
        # compare the common top area too, for information
        w, h = min(a.width, b.width), min(a.height, b.height)
        a, b = a.crop((0, 0, w, h)), b.crop((0, 0, w, h))
    diff = ImageChops.difference(a, b).convert("L").point(lambda v: 255 if v > 16 else 0)
    changed = sum(1 for v in diff.getdata() if v)
    pct = 100.0 * changed / (diff.width * diff.height)
    ok = not size_changed and pct <= threshold
    results[name] = {"pct": round(pct, 3), "ok": ok, **({"note": note} if note else {})}
    if not ok:
        failed += 1
    print(f"{'ok  ' if ok else 'FAIL'} {name}: {pct:.3f}%{'  (' + note + ')' if note else ''}")
    if out and not ok:
        red = Image.new("RGB", b.size, (255, 0, 0))
        Image.composite(red, b, diff).save(os.path.join(out, name))
if out:
    with open(os.path.join(out, "summary.json"), "w") as f:
        json.dump({"threshold_pct": threshold, "results": results}, f, indent=2)
print(f"{len(results)} compared, {failed} above {threshold}%")
sys.exit(1 if failed else 0)
