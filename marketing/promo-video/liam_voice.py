"""Promo voiceover in the reels' voice (ElevenLabs premade "Liam", eleven_v3), no dog on screen.

  python3 liam_voice.py            # all spoken scenes -> vo/NN.wav, retime promo.html, timing.json
  python3 liam_voice.py 4 9        # only those scene indexes

Each line is read with the previous and the next spoken line as context (eleven.tts). Lines that say
"פטרה" or "איי איי" get N takes and keep the one whose word SOUNDS closest to a take the owner approved
in the reels (voice_match), not the one the transcriber likes; other lines keep the first clean take.
"""
import json, os, socket, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
M = os.path.join(HERE, "..")
sys.path.insert(0, M)
sys.path.insert(0, HERE)
import dub  # noqa: E402
import eleven  # noqa: E402
import eleven_voice as ev  # noqa: E402  (spoken(): פֶּטרָה + per-scene overrides)
import voice_match as vm  # noqa: E402

socket.setdefaulttimeout(60)
_open = urllib.request.urlopen
urllib.request.urlopen = lambda r, timeout=60, **k: _open(r, timeout=60, **k)  # the 300 s default hung on flaky uploads

LIAM = "TX3LPaxmHKxFdv7VOQHJ"
N = 8
REF = {  # owner-approved by ear in the reels
    "פטרה": [(os.path.join(M, "reel-boarding/vo/01.wav"), (0.12, 0.78))],
    "AI": [(os.path.join(M, "reel-ai-agent/vo/01.wav"), (1.84, 2.28)), (os.path.join(M, "reel-ai-agent/vo/05.wav"), (1.06, 1.42))],
}


def key_segments(line, words):
    """(key, (a, b)) for every brand / AI word Scribe heard in a take."""
    out = []
    for w in words:
        t = w["text"]
        if "פטר" in t or "petra" in t.lower():
            out.append(("פטרה", (w["start"], min(w["end"], w["start"] + 0.7))))
        elif "AI" in t.upper() and "איי" in line:
            out.append(("AI", (w["start"], w["end"])))
    return out


def main(only=None):
    eleven._VID = LIAM
    tpath = os.path.join(dub.VO, "timing.json")
    t = json.load(open(tpath))
    starts, total = t["orig_starts"], t["orig_total"]
    lens = list(t["lens"])
    idx = [i for i, l in enumerate(dub.LINES) if l]
    text = {i: ev.spoken(dub.LINES[i], i) for i in idx}
    for n, i in enumerate(idx):
        if only and i not in only:
            continue
        prev = text[idx[n - 1]] if n else None
        nxt = text[idx[n + 1]] if n + 1 < len(idx) else None
        keyed = "פטרה" in dub.LINES[i] or "איי" in dub.LINES[i]
        best = None
        for k in range(N * 2):
            tmp = os.path.join(dub.VO, f"{i:02d}.cand{k}.wav")
            try:
                m, d = eleven.tts(text[i], tmp, prev=prev, nxt=nxt)
                if m < 0.75:
                    continue
                r = eleven._scribe(tmp)
            except Exception as e:  # noqa: BLE001
                print(f"  scene {i} take {k}: retry ({str(e)[:50]})", flush=True)
                continue
            sc = dub.score(dub.LINES[i], r["text"])
            words = [w for w in r["words"] if w.get("type") == "word"]
            segs = key_segments(dub.LINES[i], words)
            dist = max((min(vm.distance(p, s, tmp, seg) for p, s in REF[key]) + (0.6 if seg[1] - seg[0] < 0.3 else 0)
                        for key, seg in segs), default=0.0)
            print(f"  scene {i} take {k}: text {sc:.2f} sound {dist:.2f} {d:.1f}s | {r['text'][:60]}", flush=True)
            rank = (sc < 0.9, dist)
            if best is None or rank < best[0]:
                if best:
                    os.remove(best[1])
                best = (rank, tmp, sc, dist)
            else:
                os.remove(tmp)
            done = len([f for f in os.listdir(dub.VO) if f.startswith(f"{i:02d}.cand")])
            if not keyed and sc == 1:
                break
            if keyed and k + 1 >= N and best[2] >= 0.9:
                break
        out = os.path.join(dub.VO, f"{i:02d}.wav")
        os.replace(best[1], out)
        for f in os.listdir(dub.VO):
            if f.startswith(f"{i:02d}.cand"):
                os.remove(os.path.join(dub.VO, f))
        lens[i] = round(dub.duration(out), 2)
        print(f"scene {i:2d}: {lens[i]:5.2f}s text {best[2]:.2f} sound {best[3]:.2f}", flush=True)
    for i in idx:  # lengths always come from the files on disk (a clip may have been placed by hand)
        p = os.path.join(dub.VO, f"{i:02d}.wav")
        if os.path.exists(p):
            lens[i] = round(dub.duration(p), 2)
    html, _, _ = dub.read_scenes()
    new_starts, new_total = dub.retime(html, starts, total, lens)
    json.dump({"voice": "elevenlabs Liam (eleven_v3), takes picked by sound", "mode": "context",
               "starts": new_starts, "lens": lens, "total": new_total, "orig_starts": starts, "orig_total": total,
               "dog": []}, open(tpath, "w"), indent=1)
    print(f"retimed promo.html: {total:g}s -> {new_total:g}s")


if __name__ == "__main__":
    main([int(x) for x in sys.argv[1:]] or None)
