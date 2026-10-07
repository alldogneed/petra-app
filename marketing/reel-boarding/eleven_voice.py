"""Boarding reel voiceover: the Petra dog mascot (ElevenLabs premade voice "Liam", model eleven_v3).

  python3 eleven_voice.py          # all lines -> vo/NN.wav, vo/timing.json, vo/words.json
  python3 eleven_voice.py 2 4      # only those lines

Each line is read with the previous and next line as context (eleven.tts), then checked with two Scribe
transcriptions (word for word against LINES). words.json = Scribe word timings aligned to the script words,
relative to the clip start (what build.py expects).
"""
import difflib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", "promo-video"))
import dub  # noqa: E402
import eleven  # noqa: E402
from voice import LINES  # noqa: E402

LIAM = "TX3LPaxmHKxFdv7VOQHJ"
PETRA = "פֶּטרָה"  # owner-approved pronunciation
TAKES = 12
VO = os.path.join(HERE, "vo")


def spoken(t):
    t = re.sub(r"פטרה", PETRA, t)
    # line 0: Liam read "הפנסיון" as "הפנסיה" in 11/11 takes; niqqud on that one word fixes it
    return t.replace("את הפנסיון על לוח", "את הפַּנְסִיוֹן על לוח")


def align_words(line, ww):
    """Scribe words [(w, a, b)] -> one (word, a, b) per whitespace token of the script line."""
    ref = line.split()
    hyp = [w for w, _, _ in ww]
    rn = [(eleven.norm(w) or [""])[0] for w in ref]
    hn = [(eleven.norm(w) or [""])[0] for w in hyp]
    out = [None] * len(ref)
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, rn, hn, autojunk=False).get_opcodes():
        if tag in ("equal", "replace") and j2 > j1 and i2 > i1:
            for i in range(i1, i2):
                j = j1 + min(j2 - j1 - 1, int((i - i1) * (j2 - j1) / (i2 - i1)))
                out[i] = (ref[i], round(ww[j][1], 2), round(ww[j][2], 2))
    for i, o in enumerate(out):  # unmatched words: interpolate between neighbours
        if o is None:
            prev = next((out[k] for k in range(i - 1, -1, -1) if out[k]), None)
            nxt = next((out[k] for k in range(i + 1, len(out)) if out[k]), None)
            a = prev[2] if prev else (nxt[1] - 0.2 if nxt else 0.0)
            out[i] = (ref[i], round(a, 2), round(a + 0.2, 2))
    return out


def main(only=None):
    eleven._VID = LIAM
    os.makedirs(VO, exist_ok=True)
    texts = [spoken(l) for l in LINES]
    tpath, wpath = os.path.join(VO, "timing.json"), os.path.join(VO, "words.json")
    t = json.load(open(tpath)) if only and os.path.exists(tpath) else {}
    lens = list(t.get("lens", [0.0] * len(LINES)))
    scores = list(t.get("scores", [0.0] * len(LINES)))
    words = json.load(open(wpath)) if only and os.path.exists(wpath) else {}
    for i, line in enumerate(LINES):
        if only and i not in only:
            continue
        out = os.path.join(VO, f"{i:02d}.wav")
        best = None
        for k in range(TAKES):
            tmp = f"{out}.take{k}.wav"
            m, d = eleven.tts(texts[i], tmp, prev=texts[i - 1] if i else None, nxt=texts[i + 1] if i + 1 < len(LINES) else None)
            if m < 0.75:
                print(f"  line {i} take {k}: alignment {m:.2f}, skip", flush=True)
                if os.path.exists(tmp):
                    os.remove(tmp)
                continue
            r1 = eleven._scribe(tmp)
            sc = dub.score(line, r1["text"])
            if sc == 1:
                sc = min(sc, dub.score(line, eleven.transcribe(tmp)))
            print(f"  line {i} take {k}: {sc:.2f} {d:.1f}s | {r1['text']}", flush=True)
            if best is None or sc > best[0]:
                if best:
                    os.remove(best[1])
                best = (sc, tmp, [(w["text"], w["start"], w["end"]) for w in r1["words"] if w.get("type") == "word"])
            else:
                os.remove(tmp)
            if sc == 1:
                break
        os.replace(best[1], out)
        lens[i], scores[i] = round(dub.duration(out), 2), round(best[0], 2)
        words[str(i)] = align_words(line, best[2])
        print(f"line {i}: {lens[i]}s match {scores[i]}", flush=True)
    json.dump({"voice": "elevenlabs Liam (eleven_v3)", "mode": "context", "scores": scores, "lens": lens},
              open(tpath, "w"), indent=1)
    json.dump(words, open(wpath, "w"), ensure_ascii=False, indent=0)
    print("scores", scores, "lens", lens)


if __name__ == "__main__":
    main([int(x) for x in sys.argv[1:]] or None)
