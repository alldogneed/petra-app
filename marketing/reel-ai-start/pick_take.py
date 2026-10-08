"""Re-record lines whose brand/English words the owner heard wrong, choosing the take that SOUNDS closest
to takes he approved (voice_match), not the take the transcriber likes.

  python3 pick_take.py 0 1 3
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", "promo-video"))
import importlib.util
spec = importlib.util.spec_from_file_location("ev_local", os.path.join(HERE, "eleven_voice.py"))
ev = importlib.util.module_from_spec(spec); spec.loader.exec_module(ev)
import dub, eleven, voice_match as vm  # noqa: E402

M = os.path.join(HERE, "..")
REF = {  # approved by ear: boarding reel "הקלטה 2", AI-agent reel v2
    "פטרה": [(os.path.join(M, "reel-boarding/vo/01.wav"), (0.12, 0.78))],
    "AI": [(os.path.join(M, "reel-ai-agent/vo/01.wav"), (1.84, 2.28)), (os.path.join(M, "reel-ai-agent/vo/05.wav"), (1.06, 1.42))],
}
N = 8

def targets(line):
    return [(k, key) for k, tok in enumerate(line.split()) for key in REF if key in tok]

def main(only):
    eleven._VID = ev.LIAM
    texts = [ev.spoken(l) for l in ev.LINES]
    t = json.load(open(os.path.join(HERE, "vo", "timing.json"))); words = json.load(open(os.path.join(HERE, "vo", "words.json")))
    while len(t["lens"]) < len(ev.LINES): t["lens"].append(0.0)
    for i in only:
        line, tg = ev.LINES[i], targets(ev.LINES[i])
        best = None
        for k in range(N):
            tmp = os.path.join(HERE, "cand", f"l{i}_{k}.wav"); os.makedirs(os.path.dirname(tmp), exist_ok=True)
            m, d = eleven.tts(texts[i], tmp, prev=texts[i - 1] if i else None, nxt=texts[i + 1] if i + 1 < len(texts) else None)
            if m < 0.75: continue
            r = eleven._scribe(tmp)
            sc = dub.score(line, r["text"])
            ww = ev.align_words(line, [(w["text"], w["start"], w["end"]) for w in r["words"] if w.get("type") == "word"])
            ds = []
            for idx, key in tg:
                seg = (ww[idx][1], ww[idx][2])
                ds.append(min(vm.distance(p, s, tmp, seg) for p, s in REF[key]) + (0.6 if seg[1] - seg[0] < 0.3 else 0))
            dist = max(ds) if ds else 0
            print(f"  line {i} take {k}: text {sc:.2f} sound {dist:.2f} {[round(x, 2) for x in ds]} {d:.1f}s", flush=True)
            key = (sc < 0.9, dist)
            if best is None or key < best[0]: best = (key, tmp, ww, d, dist)
        out = os.path.join(HERE, "vo", f"{i:02d}.wav")
        os.replace(best[1], out)
        t["lens"][i] = round(dub.duration(out), 2); words[str(i)] = best[2]
        print(f"line {i}: chose sound {best[4]:.2f}, {t['lens'][i]}s", flush=True)
    json.dump(t, open(os.path.join(HERE, "vo", "timing.json"), "w"), indent=1)
    json.dump(words, open(os.path.join(HERE, "vo", "words.json"), "w"), ensure_ascii=False, indent=0)

if __name__ == "__main__":
    main([int(x) for x in sys.argv[1:]])
