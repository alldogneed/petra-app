"""Voiceover for the boarding Reel (reuses the promo-video TTS + double-transcription QA).

  python3 voice.py           # all lines -> vo/NN.wav + vo/timing.json (clip lengths)
  python3 voice.py 2 4       # regenerate only those lines
  python3 voice.py continuous  # one natural continuous take of the whole script, split per line
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "promo-video"))
import dub  # noqa: E402

dub.SYSTEM = (
    "You are a native Israeli woman in her 30s recording a voice-over for an Instagram Reel. "
    "Read the user's Hebrew text aloud EXACTLY as written, word for word, nothing added. "
    "Everyday spoken Israeli Hebrew: warm, upbeat, smiling, a bit faster than normal conversation "
    "like a good social-media video, natural Israeli intonation, no announcer voice, no over-articulation. "
    "The brand name פטרה is pronounced PET-ra.")

LINES = [
    "עדיין מנהלים את הפנסיון על לוח מחיק? ביומן גוגל? במחברת?",
    "בפטרה, כל כלב מקבל חדר בגרירה אחת, ורואים את כל התפוסה על מסך אחד.",
    "מתכננים קדימה: כל ההזמנות של החודש הקרוב על ציר זמן אחד.",
    "ומה עם החצרות? מעבירים כלב לחצר בגרירה, ורואים מראש מי מסתדר עם מי.",
    "בכל בוקר, הצוות מקבל לוח של האכלות ותרופות לכל כלב, ומסמן מה כבר ניתן.",
    "והצוות? כל עובד רואה רק את הפנסיון, בלי הכנסות ובלי לקוחות. אתם מחליטים מה מותר.",
    "רוצים לראות איך זה עובד אצלכם? דברו איתנו בוואטסאפ.",
]

NATURAL = (
    "You are a native Israeli woman in her 30s who owns a dog boarding kennel. You are recording a WhatsApp "
    "voice message to a friend who also runs a kennel, telling her about a system you use. Read the user's "
    "Hebrew text aloud EXACTLY as written, word for word, nothing added or skipped - but say it the way you "
    "would really talk: relaxed, genuine, warm, a little smile in the voice, natural Israeli rhythm and "
    "intonation that flows from sentence to sentence, short natural pauses between sentences. "
    "This is NOT an ad and NOT a reading: no announcer voice, no sales tone, no over-articulation, not rushed. "
    "The brand name פטרה is pronounced PET-ra.")


def whisper_words(path):
    import subprocess
    r = subprocess.run(["curl", "-sS", "https://api.openai.com/v1/audio/transcriptions",
                        "-H", "Authorization: Bearer " + os.environ["OPENAI_API_KEY"],
                        "-F", "model=whisper-1", "-F", "language=he", "-F", "response_format=verbose_json",
                        "-F", "timestamp_granularities[]=word", "-F", "file=@" + path],
                       capture_output=True, text=True, check=True).stdout
    return [(w["word"], w["start"], w["end"]) for w in json.loads(r)["words"]]


def tidy(path, words=None):
    """Trim a line clip to the speech itself: start right before the first word, end right after the
    last word, before the breath that follows (a cut-off inhale at the end sounded like a caught
    breath). Short fades on both ends. Returns the new duration."""
    import array, math, subprocess
    raw = subprocess.run([dub.FF, "-loglevel", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    a = array.array("h", raw)
    hop = 320  # 20ms
    db = [20 * math.log10(max(1e-6, (sum(x * x for x in a[i:i + hop]) / hop) ** .5 / 32768)) for i in range(0, len(a) - hop, hop)]
    fr = lambda t: max(0, min(len(db) - 1, int(t / 0.02)))
    ww = words or whisper_words(path)
    s0, e0 = ww[0][1], ww[-1][2]
    # start: 40ms of real silence before the first word. Whisper's word start can be late, so search
    # back from 0.1s before it (max 0.4s); if there is no silence, keep the original start.
    start = 0.0
    for f in range(fr(s0 - 0.1), fr(s0 - 0.5), -1):
        if f >= 1 and db[f] < -50 and db[f - 1] < -50:
            start = max(0.0, f * 0.02 - 0.02)
            break
    # end: first 40ms of quiet after the last word (search from 0.15s before whisper's end, max 0.5s after)
    end = e0 + 0.15
    for f in range(fr(e0 - 0.15), fr(e0 + 0.5)):
        if f + 1 < len(db) and db[f] < -48 and db[f + 1] < -48:
            end = f * 0.02 + 0.03
            break
    end = min(end, len(db) * 0.02)
    tmp = path + ".tidy.wav"
    subprocess.run([dub.FF, "-loglevel", "error", "-y", "-i", path, "-ss", f"{start:.3f}", "-to", f"{end:.3f}",
                    "-af", f"afade=t=in:d=0.02,afade=t=out:st={max(0, end - start - 0.07):.3f}:d=0.07", tmp], check=True)
    os.replace(tmp, path)
    return end - start


def split_take(full, prefix):
    """Split one continuous take into per-line clips at the pauses between lines."""
    import difflib, subprocess
    ww = whisper_words(full)
    ref, owner = [], []
    for i, l in enumerate(LINES):
        for w in dub.words(l):
            ref.append(w)
            owner.append(i)
    hyp = [dub.words(w)[0] if dub.words(w) else "" for w, _, _ in ww]
    first, last = {}, {}
    for a, b, n in difflib.SequenceMatcher(None, ref, hyp, autojunk=False).get_matching_blocks():
        for j in range(n):
            i = owner[a + j]
            first.setdefault(i, ww[b + j][1])
            last[i] = ww[b + j][2]
    if len(first) < len(LINES):
        return None
    cuts = [0.0] + [round((last[i - 1] + first[i]) / 2, 3) for i in range(1, len(LINES))] + [dub.duration(full)]
    out = []
    for i in range(len(LINES)):
        p = f"{prefix}_{i:02d}.wav"
        subprocess.run([dub.FF, "-loglevel", "error", "-y", "-i", full, "-ss", str(cuts[i]), "-to", str(cuts[i + 1]),
                        "-af", "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,"
                               "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse",
                        p], check=True)
        tidy(p)
        out.append(p)
    return out


def continuous(takes=4):
    """Continuous reads of the whole script (natural flow between sentences), kept in vo/pool/.
    Every take is split into lines, each line is transcribed twice, and the best version of each
    line across all takes becomes vo/NN.wav."""
    import shutil
    vo = os.path.join(HERE, "vo")
    pool = os.path.join(vo, "pool")
    os.makedirs(pool, exist_ok=True)
    dub.SYSTEM = NATURAL
    text = "\n".join(LINES)
    scored = os.path.join(pool, "scores.json")
    scores = json.load(open(scored)) if os.path.exists(scored) else {}

    def rate(p, i):
        if p not in scores:
            scores[p] = min(dub.score(LINES[i], dub.transcribe(p)) for _ in range(2))
        return scores[p]

    fulls = sorted(f for f in os.listdir(pool) if f.endswith("_full.wav"))
    for f in fulls:  # takes already in the pool
        k = f.split("_")[0]
        clips = [os.path.join(pool, f"{k}_{i:02d}.wav") for i in range(len(LINES))]
        if not all(os.path.exists(c) for c in clips):
            clips = split_take(os.path.join(pool, f), os.path.join(pool, k))
        for i, c in enumerate(clips or []):
            rate(c, i)

    def best():
        out = []
        for i in range(len(LINES)):
            cands = [(s, p) for p, s in scores.items() if p.endswith(f"_{i:02d}.wav")]
            out.append(max(cands) if cands else (0, None))
        return out

    n0 = len(fulls)
    for k in range(n0, n0 + takes):
        if all(b[0] == 1 for b in best()):
            break
        full = os.path.join(pool, f"t{k}_full.wav")
        dub.tts(text, "coral", full)
        clips = split_take(full, os.path.join(pool, f"t{k}"))
        for i, c in enumerate(clips or []):
            rate(c, i)
        json.dump(scores, open(scored, "w"), indent=1)
        print(f"take {k}: best per line " + " ".join(f"{b[0]:.2f}" for b in best()), flush=True)
    json.dump(scores, open(scored, "w"), indent=1)
    lens, words = [], {}
    for i, (sc, p) in enumerate(best()):
        dst = os.path.join(vo, f"{i:02d}.wav")
        shutil.copy(p, dst)
        lens.append(dub.duration(dst))
        ww = whisper_words(dst)
        off = ww[0][1] if ww else 0
        words[str(i)] = [(w, round(max(0, s - off), 2), round(e - off, 2)) for w, s, e in ww]
    b = best()
    json.dump({"voice": "coral", "mode": "continuous", "scores": [x[0] for x in b],
               "sources": [os.path.basename(x[1]) for x in b], "lens": lens},
              open(os.path.join(vo, "timing.json"), "w"), indent=1)
    json.dump(words, open(os.path.join(vo, "words.json"), "w"), ensure_ascii=False, indent=0)
    print("scores", [round(x[0], 2) for x in b], "sources", [os.path.basename(x[1]) for x in b])
    print("lens", [round(x, 2) for x in lens])


if __name__ == "__main__":
    if sys.argv[1:] == ["continuous"]:
        continuous()
        sys.exit()
    vo = os.path.join(HERE, "vo")
    os.makedirs(vo, exist_ok=True)
    tpath = os.path.join(vo, "timing.json")
    lens = json.load(open(tpath))["lens"] if os.path.exists(tpath) else [0.0] * len(LINES)
    only = [int(x) for x in sys.argv[1:]] or range(len(LINES))
    dub.TAKES = 10
    for i in only:
        path = os.path.join(vo, f"{i:02d}.wav")
        print(f"line {i}")
        sc = dub.best_take(LINES[i], "coral", path)
        lens[i] = dub.duration(path)
        print(f"line {i}: {lens[i]:.2f}s, match {sc:.2f}")
    json.dump({"voice": "coral", "lens": lens}, open(tpath, "w"), indent=1)
    print("total voice", round(sum(lens), 2))
