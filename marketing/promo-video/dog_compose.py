"""Place the talking-dog mascot clips (../dog-avatar/clip-sN.mp4) after the narration of scenes N.

  python3 dog_compose.py     # retime promo.html (scene N lengthened by the dog line) + timing.json "dog"
  python3 dub.py mix && python3 dub.py music music-instrumental.wav -11
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dub  # noqa: E402

DOGS = {}  # scene index -> clip. Decision 2026-10-07: promo = one professional narrator, no dog (dog is for social shorts only). Was {0: "clip-s0.mp4", 9: "clip-s9.mp4", 11: "clip-s11.mp4"}
GAP = 0.35  # silence between the narration and the dog line

t = json.load(open(os.path.join(dub.VO, "timing.json")))
starts0, total0 = t["orig_starts"], t["orig_total"]
narr = [dub.duration(os.path.join(dub.VO, f"{i:02d}.wav")) if l else 0.0 for i, l in enumerate(dub.LINES)]
dur = {i: dub.duration(os.path.join(HERE, "..", "dog-avatar", c)) for i, c in DOGS.items()}
eff = [n + (GAP + dur[i] if i in dur else 0) if n else n for i, n in enumerate(narr)]
html, _, _ = dub.read_scenes()
starts, total = dub.retime(html, starts0, total0, eff)
dogs = [{"scene": i, "clip": os.path.abspath(os.path.join(HERE, "..", "dog-avatar", c)),
         "start": round(starts[i] + dub.LEAD + narr[i] + GAP, 2), "dur": round(dur[i], 2)} for i, c in DOGS.items()]
t.update({"starts": starts, "lens": narr, "total": total, "dog": dogs})
json.dump(t, open(os.path.join(dub.VO, "timing.json"), "w"), indent=1)
print("total", total, [(d["scene"], d["start"], d["dur"]) for d in dogs])
