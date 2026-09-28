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
    "ומה עם החצרות? פשוט גוררים כלב לחצר, ורואים מראש מי מסתדר עם מי.",
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


def continuous(takes=6):
    """One continuous read of the whole script (natural flow between sentences), best of N takes,
    then split into per-line clips at the pauses between lines."""
    import difflib, subprocess
    vo = os.path.join(HERE, "vo")
    os.makedirs(vo, exist_ok=True)
    dub.SYSTEM = NATURAL
    text = "\n".join(LINES)
    best = None
    for k in range(takes):
        p = os.path.join(vo, f"full.take{k}.wav")
        dub.tts(text, "coral", p)
        heard = dub.transcribe(p)
        sc = dub.score(text, heard)
        if sc >= 0.97:
            sc = min(sc, dub.score(text, dub.transcribe(p)))
        print(f"take {k}: {sc:.3f} {dub.duration(p):.1f}s")
        if best is None or sc > best[0]:
            best = (sc, p)
        if sc == 1:
            break
    full = os.path.join(vo, "full.wav")
    os.replace(best[1], full)
    for k in range(takes):
        q = os.path.join(vo, f"full.take{k}.wav")
        if os.path.exists(q):
            os.remove(q)
    # align whisper words to the script words, find each line's first/last word time
    ww = whisper_words(full)
    ref, owner = [], []
    for i, l in enumerate(LINES):
        for w in dub.words(l):
            ref.append(w)
            owner.append(i)
    hyp = [dub.words(w)[0] if dub.words(w) else "" for w, _, _ in ww]
    sm = difflib.SequenceMatcher(None, ref, hyp, autojunk=False)
    first, last = {}, {}
    for a, b, n in sm.get_matching_blocks():
        for j in range(n):
            i = owner[a + j]
            first.setdefault(i, ww[b + j][1])
            last[i] = ww[b + j][2]
    total = dub.duration(full)
    cuts = [0.0]
    for i in range(1, len(LINES)):
        cuts.append(round((last[i - 1] + first[i]) / 2, 3))
    cuts.append(total)
    lens, words = [], {}
    for i in range(len(LINES)):
        a, b = cuts[i], cuts[i + 1]
        out = os.path.join(vo, f"{i:02d}.wav")
        subprocess.run([dub.FF, "-loglevel", "error", "-y", "-i", full, "-ss", str(a), "-to", str(b),
                        "-af", "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,"
                               "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse",
                        out], check=True)
        lens.append(dub.duration(out))
        words[str(i)] = [(w, round(s - a, 2), round(e - a, 2)) for (w, s, e) in ww if a <= s < b]
    # word times relative to the trimmed clip start
    for i in range(len(LINES)):
        if words[str(i)]:
            off = words[str(i)][0][1]
            words[str(i)] = [(w, round(max(0, s - off), 2), round(e - off, 2)) for w, s, e in words[str(i)]]
    json.dump({"voice": "coral", "mode": "continuous", "score": best[0], "lens": lens},
              open(os.path.join(vo, "timing.json"), "w"), indent=1)
    json.dump(words, open(os.path.join(vo, "words.json"), "w"), ensure_ascii=False, indent=0)
    print("lens", [round(x, 2) for x in lens], "score", best[0])


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
