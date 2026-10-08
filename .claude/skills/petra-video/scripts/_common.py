"""Shared helpers for the petra-video skill scripts (paths, audio levels, project adapters)."""
import array, json, math, os, subprocess, sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
PROMO = os.path.join(REPO, "marketing", "promo-video")
REEL = os.path.join(REPO, "marketing", "reel-boarding")
sys.path.insert(0, PROMO)
sys.path.insert(0, REEL)
import dub  # noqa: E402  tts / transcribe / score / words / duration / FF

FF = dub.FF

# No OpenAI key -> use ElevenLabs Scribe for transcription / word timings (marketing/eleven.py).
USE_SCRIBE = not os.environ.get("OPENAI_API_KEY")
if USE_SCRIBE:
    sys.path.insert(0, os.path.join(REPO, "marketing"))
    import eleven  # noqa: E402
    dub.transcribe = eleven.transcribe


def levels(path, step=0.02, start=None, dur=None):
    """dBFS per `step` seconds (mono, 16 kHz)."""
    cmd = [FF, "-loglevel", "error"]
    if start is not None:
        cmd += ["-ss", str(start)]
    if dur is not None:
        cmd += ["-t", str(dur)]
    raw = subprocess.run(cmd + ["-i", path, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    a = array.array("h", raw)
    n = int(16000 * step)
    return [20 * math.log10(max(1e-6, (sum(x * x for x in a[i:i + n]) / n) ** .5 / 32768))
            for i in range(0, len(a) - n + 1, n)]


def mean_db(path, start=None, dur=None):
    cmd = [FF]
    if start is not None:
        cmd += ["-ss", str(start)]
    if dur is not None:
        cmd += ["-t", str(dur)]
    out = subprocess.run(cmd + ["-i", path, "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
    for line in out.splitlines():
        if "mean_volume" in line:
            return float(line.split(":")[1].split()[0])
    return None


def loudness(path):
    out = subprocess.run([FF, "-i", path, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    lines = out.splitlines()
    for i, line in enumerate(lines):
        if "Integrated loudness" in line:
            return float(lines[i + 1].split(":")[1].split()[0])
    return None


def whisper(path, lang=None, words=False):
    if USE_SCRIBE:
        return {"words": [{"word": w, "start": a, "end": b} for w, a, b in eleven.scribe_words(path)]}
    cmd = ["curl", "-sS", "https://api.openai.com/v1/audio/transcriptions",
           "-H", "Authorization: Bearer " + os.environ["OPENAI_API_KEY"],
           "-F", "model=whisper-1", "-F", "response_format=verbose_json", "-F", "file=@" + path]
    if lang:
        cmd += ["-F", f"language={lang}"]
    if words:
        cmd += ["-F", "timestamp_granularities[]=word"]
    return json.loads(subprocess.run(cmd, capture_output=True, text=True, check=True).stdout)


def project_scenes(project):
    """[(start, end, text)] for the spoken scenes of a known project + its final video + vo dir."""
    if project == "promo":
        t = json.load(open(os.path.join(PROMO, "vo", "timing.json")))
        st = t["starts"] + [t["total"]]
        sc = [(st[i], st[i + 1], l) for i, l in enumerate(dub.LINES) if l]
        return sc, os.path.join(PROMO, "petra-promo-final.mp4"), os.path.join(PROMO, "vo")
    if project == "reel":
        import voice
        t = json.load(open(os.path.join(REEL, "vo", "reel_timing.json")))
        st = t["starts"] + [t["total"]]
        sc = [(st[i], st[i + 1], l) for i, l in enumerate(voice.LINES)]
        return sc, os.path.join(REEL, "reel-boarding.mp4"), os.path.join(REEL, "vo")
    raise SystemExit(f"unknown project {project!r} (promo | reel, or pass --scenes scenes.json)")
