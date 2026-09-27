"""Hebrew voiceover for the promo video (OpenAI TTS).

  python3 dub.py samples            # samples/coral.wav + samples/marin.wav, to pick a voice
  python3 dub.py voice marin        # one clip per scene in vo/, retime promo.html to fit
  python3 dub.py redo marin 2 7    # regenerate only those scenes, retime again
  python3 dub.py mix                # render the video and mix the clips in -> petra-promo-vo.mp4

Needs OPENAI_API_KEY and network access to api.openai.com.
"""
import base64, difflib, json, os, re, subprocess, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
HTML = os.path.join(HERE, "promo.html")
VO = os.path.join(HERE, "vo")
FF = "/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2"

# gpt-audio-1.5 read Hebrew far more accurately than gpt-4o-mini-tts in side-by-side tests,
# and niqqud made every model worse, so the lines are plain text.
MODEL = "gpt-audio-1.5"
VOICE = "coral"
SYSTEM = ("You are a professional native Israeli Hebrew voice-over artist. Read the user's text aloud "
          "EXACTLY as written, word for word, nothing added. Warm, natural, conversational, normal "
          "flowing pace - not slow, not salesy. The brand name פטרה is pronounced PET-ra.")
TAKES = 6    # max takes per line; the one whose transcript matches the text best wins
LEAD = 0.4   # seconds of picture before the voice starts in each scene
TAIL = 0.6   # breathing room after the voice before the next scene
XFADE = 0.4  # scene overlap (--d = gap to next scene + XFADE)

# One entry per <section class="scene">, in order.
# None = no narration.
LINES = [
    "יש לכם עסק של כלבים? אילוף, פנסיון, טיפוח?",
    "אז אתם מכירים את זה. תורים בוואטסאפ, חוזים על נייר, לקוחות ששוכחים להגיע. בשביל זה בנינו את פטרה.",
    "פֶּטְרָה, מערכת ניהול לעסקים של חיות מחמד.",
    "כל העסק שלכם במסך אחד. לקוחות, יומן, פנסיון, חוזים ותשלומים.",
    "הלקוחות קובעים תור לבד. שולחים להם קישור, הם בוחרים שירות ושעה פנויה, והתור נכנס ישר ליומן שלכם.",
    "יום לפני התור, הלקוח מקבל תזכורת בוואטסאפ, אוטומטית. ככה הרבה פחות לקוחות שוכחים להגיע.",
    "צריכים חתימה על חוזה? שולחים אותו ללקוח בוואטסאפ, ישר מהתיק שלו. הפרטים שלו ושל הכלב כבר ממולאים, הוא חותם מהטלפון, והעותק החתום נשמר אצלכם.",
    "בפנסיון, כל החדרים מול העיניים. מי נמצא, מי נכנס היום ומי יוצא. והצוות מקבל לוח יומי של האכלות ותרופות.",
    "ועכשיו, לראשונה בישראל: סוכן איי איי שמחובר ישירות לעסק שלכם. שואלים אותו מה יש היום, והוא עונה מהנתונים שלכם, ואם צריך גם קובע תור.",
    None,  # stats
    "תפסיקו לרדוף אחרי זנבות. תנו לפטרה לנהל את העסק שלכם. מתחילים בחינם ב-פטרה אפ דוט קום.",
]

SAMPLE = "פטרה, מערכת ניהול לעסקים של חיות מחמד. כל העסק שלכם במסך אחד."

SCENE_RE = re.compile(r'(<section class="scene[^"]*" style="--s:)([\d.]+)s;--d:([\d.]+)s')


def post(url, payload):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={
        "Authorization": "Bearer " + os.environ["OPENAI_API_KEY"], "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)


def tts(text, voice, out):
    r = post("https://api.openai.com/v1/chat/completions", {
        "model": MODEL, "modalities": ["text", "audio"], "audio": {"voice": voice, "format": "wav"},
        "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": text}]})
    with open(out, "wb") as f:
        f.write(base64.b64decode(r["choices"][0]["message"]["audio"]["data"]))


def transcribe(path):
    out = subprocess.run(["curl", "-sS", "https://api.openai.com/v1/audio/transcriptions",
                          "-H", "Authorization: Bearer " + os.environ["OPENAI_API_KEY"],
                          "-F", "model=gpt-4o-transcribe", "-F", "language=he",
                          "-F", "response_format=text", "-F", "file=@" + path],
                         capture_output=True, text=True, check=True).stdout
    return out.strip()


def words(t):
    t = re.sub(r"[\u0591-\u05C7]", "", t)  # niqqud
    t = t.lower().replace("petraapp.com", "פטרה אפ דוט קום").replace("ai", "איי איי")
    return re.sub(r"[^\w\s]", " ", t).split()


def score(text, heard):
    return difflib.SequenceMatcher(None, words(text), words(heard)).ratio()


def best_take(text, voice, out):
    best = None
    for k in range(TAKES):
        tmp = f"{out}.take{k}.wav"
        tts(text, voice, tmp)
        heard = transcribe(tmp)
        sc = score(text, heard)
        print(f"    take {k}: {sc:.2f} {heard}")
        if best is None or sc > best[0]:
            best = (sc, tmp)
        if sc == 1:
            break
    os.replace(best[1], out)
    for k in range(TAKES):
        if os.path.exists(f"{out}.take{k}.wav"):
            os.remove(f"{out}.take{k}.wav")
    return best[0]


def duration(path):
    # OpenAI's streamed wav header can carry a bogus length; decode to be safe.
    out = subprocess.run([FF, "-i", path, "-f", "null", "-"], capture_output=True, text=True).stderr
    h, m, s = re.findall(r"time=(\d+):(\d+):([\d.]+)", out)[-1]
    return int(h) * 3600 + int(m) * 60 + float(s)


def read_scenes():
    html = open(HTML, encoding="utf-8").read()
    starts = [float(m.group(2)) for m in SCENE_RE.finditer(html)]
    total = float(re.search(r"window\.TOTAL = ([\d.]+);", html).group(1))
    assert len(starts) == len(LINES), f"{len(starts)} scenes in promo.html vs {len(LINES)} lines"
    return html, starts, total


def retime(html, starts, total, lens):
    """Lengthen (never shorten) each narrated scene to fit its clip; rewrite --s/--d and TOTAL."""
    gaps = [b - a for a, b in zip(starts, starts[1:] + [total])]
    gaps = [max(g, round(LEAD + l + TAIL, 1)) if l else g for g, l in zip(gaps, lens)]
    new_starts = [round(sum(gaps[:i]), 2) for i in range(len(gaps))]
    new_total = round(sum(gaps), 2)
    it = iter(zip(new_starts, gaps))

    def sub(m):
        s, g = next(it)
        d = g if s == new_starts[-1] else g + XFADE
        return f"{m.group(1)}{s:g}s;--d:{round(d, 2):g}s"

    html = SCENE_RE.sub(sub, html)
    html = re.sub(r"window\.TOTAL = [\d.]+;", f"window.TOTAL = {new_total:g};", html)
    open(HTML, "w", encoding="utf-8").write(html)
    return new_starts, new_total


def voice(name, only=None):
    """Generate clips (all, or just the scene indexes in `only`) and retime promo.html.
    timing.json keeps the original scene timing, so re-runs always retime from scratch."""
    os.makedirs(VO, exist_ok=True)
    tpath = os.path.join(VO, "timing.json")
    html, starts, total = read_scenes()
    if only:
        t = json.load(open(tpath))
        starts, total, lens = t["orig_starts"], t["orig_total"], t["lens"]
    else:
        lens = [0.0] * len(LINES)
    gaps = [b - a for a, b in zip(starts, starts[1:] + [total])]
    for i, text in enumerate(LINES):
        if text is None or (only and i not in only):
            continue
        path = os.path.join(VO, f"{i:02d}.wav")
        print(f"scene {i}")
        sc = best_take(text, name, path)
        lens[i] = duration(path)
        print(f"scene {i:2d}: {lens[i]:5.2f}s voice / {gaps[i]:5.2f}s scene, match {sc:.2f}")
    new_starts, new_total = retime(html, starts, total, lens)
    json.dump({"voice": name, "starts": new_starts, "lens": lens, "total": new_total,
               "orig_starts": starts, "orig_total": total}, open(tpath, "w"), indent=1)
    print(f"total {total:g}s -> {new_total:g}s")


def mix():
    t = json.load(open(os.path.join(VO, "timing.json")))
    silent = os.path.join(HERE, "petra-promo-silent.mp4")
    subprocess.run([sys.executable, os.path.join(HERE, "render.py"), "video", silent], check=True)
    ins, chains, labels = [], [], []
    for i, (s, l) in enumerate(zip(t["starts"], t["lens"])):
        if not l:
            continue
        ins += ["-i", os.path.join(VO, f"{i:02d}.wav")]
        n = len(labels) + 1
        ms = int((s + LEAD) * 1000)
        chains.append(f"[{n}:a]aresample=48000,adelay={ms}|{ms}[a{n}]")
        labels.append(f"[a{n}]")
    graph = ";".join(chains) + ";" + "".join(labels) + \
        f"amix=inputs={len(labels)}:normalize=0,loudnorm=I=-16:TP=-1.5,aresample=48000,apad=whole_dur={t['total']}[aout]"
    subprocess.run([FF, "-loglevel", "error", "-y", "-i", silent, *ins, "-filter_complex", graph,
                    "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                    "-t", str(t["total"]), "-movflags", "+faststart", os.path.join(HERE, "petra-promo-vo.mp4")],
                   check=True)
    os.remove(silent)
    print("wrote petra-promo-vo.mp4")


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "samples":
        os.makedirs(os.path.join(HERE, "samples"), exist_ok=True)
        for v in ("coral", "marin"):
            tts(SAMPLE, v, os.path.join(HERE, "samples", f"{v}.wav"))
            print(v, "ok")
    elif cmd == "voice":
        voice(sys.argv[2])
    elif cmd == "redo":             # python3 dub.py redo coral 2 7
        voice(sys.argv[2], [int(x) for x in sys.argv[3:]])
    elif cmd == "mix":
        mix()
