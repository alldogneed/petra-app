"""Voiceover for the boarding Reel (reuses the promo-video TTS + double-transcription QA).

  python3 voice.py           # all lines -> vo/NN.wav + vo/timing.json (clip lengths)
  python3 voice.py 2 4       # regenerate only those lines
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

if __name__ == "__main__":
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
