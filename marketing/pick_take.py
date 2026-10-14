"""Re-record lines of a reel, choosing the take whose brand/key words SOUND closest to takes the owner
approved by ear (voice_match), not the take the transcriber likes.

  python3 pick_take.py <reel-folder> 0 5 6        # e.g. python3 pick_take.py reel-boarding 0 5 6

A URL such as "לפטרה אפ דוט קום" comes back from Scribe as ONE token ("ל-petraapp.com"), so the word
"פטרה" cannot be cut out by word timing there: the first 0.55 s of that token is compared instead
(approximate - confirm those lines by ear).
"""
import json, os, sys
M = os.path.dirname(os.path.abspath(__file__))
HERE = os.path.join(M, sys.argv[1])
sys.path.insert(0, HERE)  # the reel's own voice.py (LINES) must be importable by its eleven_voice.py
sys.path.insert(0, M)
sys.path.insert(0, os.path.join(M, "promo-video"))
import importlib.util
spec = importlib.util.spec_from_file_location("ev_local", os.path.join(HERE, "eleven_voice.py"))
ev = importlib.util.module_from_spec(spec); spec.loader.exec_module(ev)
import dub, eleven, voice_match as vm  # noqa: E402

REF = {  # approved by ear: boarding reel "הקלטה 2", AI-agent reel v2
    "פטרה": [(os.path.join(M, "reel-boarding/vo/01.wav"), (0.12, 0.78))],
    "AI": [(os.path.join(M, "reel-ai-agent/vo/01.wav"), (1.84, 2.28)), (os.path.join(M, "reel-ai-agent/vo/05.wav"), (1.06, 1.42))],
    "פנסיון": [(os.path.join(M, "reel-ai-agent/vo/03.wav"), (0.48, 1.02))],  # "בפנסיון?" (AI-agent reel; approved with the reel, not singled out)
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
                url = [w for w in r["words"] if w.get("type") == "word" and "petra" in w["text"].lower()]
                if key == "פטרה" and url:  # the brand sits inside a URL token: compare its first 0.55 s
                    seg = (url[0]["start"], min(url[0]["end"], url[0]["start"] + 0.55))
                ds.append(min(vm.distance(p, s, tmp, seg) for p, s in REF[key]) + (0.6 if seg[1] - seg[0] < 0.3 else 0))
            dist = max(ds) if ds else 0
            print(f"  line {i} take {k}: text {sc:.2f} sound {dist:.2f} {[round(x, 2) for x in ds]} {d:.1f}s", flush=True)
            key = (sc < 0.9, dist)
            if best is None or key < best[0]: best = (key, tmp, ww, d, dist)
            if not tg and sc == 1: break  # no key word in this line: the first clean take is enough
        out = os.path.join(HERE, "vo", f"{i:02d}.wav")
        os.replace(best[1], out)
        t["lens"][i] = round(dub.duration(out), 2); words[str(i)] = best[2]
        print(f"line {i}: chose sound {best[4]:.2f}, {t['lens'][i]}s", flush=True)
    json.dump(t, open(os.path.join(HERE, "vo", "timing.json"), "w"), indent=1)
    json.dump(words, open(os.path.join(HERE, "vo", "words.json"), "w"), ensure_ascii=False, indent=0)

if __name__ == "__main__":
    main([int(x) for x in sys.argv[2:]])
