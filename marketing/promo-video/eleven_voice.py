"""Promo voiceover with ElevenLabs (cloned voice "or rabinovich", model eleven_v3).

  python3 eleven_voice.py            # all spoken scenes -> vo/NN.wav, retime promo.html, timing.json
  python3 eleven_voice.py 4 7        # only those scene indexes

Each line is generated with the previous and the next spoken line as context (see ../eleven.py), checked with
two Scribe transcriptions (must match the on-screen text word for word), trimmed to the speech (no breath tail).
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import dub  # noqa: E402
import eleven  # noqa: E402

# Spoken form only (the on-screen text and dub.LINES stay plain). Owner-approved pronunciation:
# פטרה -> פֶּטרָה (variant 4 of the 2026-10-06 listening test).
PETRA = "פֶּטרָה"
TAKES = 14


# Per-scene spoken wording where the plain text trips the voice (same words, only punctuation):
#  2: an ellipsis before "לעסקים" stops "ניהול לעסקים" collapsing into "ניהול העסקים"
#  3: a colon keeps the final ן of "פנסיון" (with a comma it was cut: "פנסיונ")
OVERRIDE = {
    2: "הכירו את {P}, מערכת ניהול... לעסקים של חיות מחמד.",
    3: "כל העסק במסך אחד: לקוחות, יומן, פנסיון, חוזים ותשלומים.",
}


def spoken(text, i=None):
    if i in OVERRIDE:
        return OVERRIDE[i].replace("{P}", PETRA)
    return re.sub(r"פטרה", PETRA, text)


def main(only=None):
    tpath = os.path.join(dub.VO, "timing.json")
    t = json.load(open(tpath))
    starts, total = t["orig_starts"], t["orig_total"]
    lens = [0.0] * len(dub.LINES)
    for i, l in enumerate(dub.LINES):  # lengths always come from the files on disk
        if l and os.path.exists(os.path.join(dub.VO, f"{i:02d}.wav")):
            lens[i] = dub.duration(os.path.join(dub.VO, f"{i:02d}.wav"))
    idx = [i for i, l in enumerate(dub.LINES) if l]
    voice_text = {i: spoken(dub.LINES[i], i) for i in idx}
    scores = list(t.get("scores", [])) if only else []
    report = {}
    for n, i in enumerate(idx):
        if only and i not in only:
            continue
        prev = voice_text[idx[n - 1]] if n else None
        nxt = voice_text[idx[n + 1]] if n + 1 < len(idx) else None
        out = os.path.join(dub.VO, f"{i:02d}.wav")
        best = None
        for k in range(TAKES):
            tmp = f"{out}.take{k}.wav"
            m, d = eleven.tts(voice_text[i], tmp, prev=prev, nxt=nxt)
            if m < 0.75:
                print(f"  scene {i} take {k}: alignment {m:.2f}, skip", flush=True)
                os.remove(tmp) if os.path.exists(tmp) else None
                continue
            h1 = eleven.transcribe(tmp)
            sc = dub.score(dub.LINES[i], h1)
            h2 = None
            if sc == 1:
                h2 = eleven.transcribe(tmp)
                sc = min(sc, dub.score(dub.LINES[i], h2))
            print(f"  scene {i} take {k}: {sc:.2f} {d:.1f}s | {h1}" + (f" // {h2}" if h2 and sc < 1 else ""), flush=True)
            if best is None or sc > best[0]:
                if best:
                    os.remove(best[1])
                best = (sc, tmp)
            else:
                os.remove(tmp)
            if sc == 1:
                break
        os.replace(best[1], out)
        lens[i] = dub.duration(out)
        report[i] = best[0]
        print(f"scene {i:2d}: {lens[i]:5.2f}s match {best[0]:.2f}", flush=True)
    html, _, _ = dub.read_scenes()
    new_starts, new_total = dub.retime(html, starts, total, lens)
    sc_all = [report.get(i, (t.get("scores") or [1] * len(idx))[n] if (t.get("scores") and n < len(t["scores"])) else 1)
              for n, i in enumerate(idx)]
    json.dump({"voice": "or rabinovich (elevenlabs eleven_v3)", "mode": "context", "scores": sc_all,
               "starts": new_starts, "lens": lens, "total": new_total, "orig_starts": starts, "orig_total": total},
              open(tpath, "w"), indent=1)
    print(f"retimed promo.html: {total:g}s -> {new_total:g}s")


if __name__ == "__main__":
    main([int(x) for x in sys.argv[1:]] or None)
