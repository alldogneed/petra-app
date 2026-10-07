"""ElevenLabs layer for the Petra videos (cloned voice "or rabinovich").

TTS : one clip per line, each with the previous and next sentence as context (previous_text/next_text)
QA  : ElevenLabs Scribe (speech-to-text) for transcription and word timings
Key : ELEVENLABS_API_KEY from the environment, else from .env.video next to the repo root. Never printed.
"""
import json, os, re, subprocess, sys, urllib.request, uuid

HERE = os.path.dirname(os.path.abspath(__file__))
FF = "/opt/homebrew/bin/ffmpeg"
VOICE_NAME = "or rabinovich"
MODEL = "eleven_v3"  # only model that reads Hebrew cleanly (v2/turbo: garbled or no "he"); no previous_text API
SETTINGS = {"stability": 0.5, "similarity_boost": 0.8}
API = "https://api.elevenlabs.io/v1"


def key():
    k = os.environ.get("ELEVENLABS_API_KEY")
    if not k:
        p = os.path.join(HERE, "..", ".env.video")
        if os.path.exists(p):
            for line in open(p):
                if line.startswith("ELEVENLABS_API_KEY="):
                    k = line.split("=", 1)[1].strip()
    assert k and k != "PASTE_KEY", "ELEVENLABS_API_KEY missing"
    return k


def _req(url, data=None, headers=None, method=None):
    h = {"xi-api-key": key()}
    h.update(headers or {})
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=300) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{url.split('/v1/')[1]} -> HTTP {e.code}: {e.read()[:300].decode('utf8', 'replace')}")


def voice_id(name=VOICE_NAME):
    d = json.loads(_req(API + "/voices"))
    for v in d["voices"]:
        if v["name"].strip().lower() == name.lower():
            return v["voice_id"]
    raise KeyError(name)


_VID = None


def _raw(text, out, settings=None):
    global _VID
    _VID = _VID or voice_id()
    body = {"text": text, "model_id": MODEL, "language_code": "he", "voice_settings": settings or SETTINGS}
    mp3 = _req(f"{API}/text-to-speech/{_VID}?output_format=mp3_44100_128", json.dumps(body).encode(),
               {"Content-Type": "application/json"})
    tmp = out + ".mp3"
    open(tmp, "wb").write(mp3)
    subprocess.run([FF, "-loglevel", "error", "-y", "-i", tmp, "-ac", "1", "-ar", "44100", out], check=True)
    os.remove(tmp)


def norm(t):
    t = re.sub(r"[\u0591-\u05C7]", "", t).lower()
    t = re.sub(r"petra-?\s?app\.com", "פטרה אפ דוט קום", t)
    return re.sub(r"[^\w\s]", " ", t).split()


def tts(text, out, prev=None, nxt=None):
    """One line -> out (.wav). The v3 model has no context parameters, so prev + line + next are read as
    one passage (the line gets the real intonation of its neighbours) and only the middle line is cut
    out, using Scribe word timings. Returns (match 0..1 of the line's own words, seconds)."""
    import difflib
    full = out + ".ctx.wav"
    ctx = [x for x in (prev, text, nxt) if x]
    _raw("\n".join(ctx), full)
    ww = scribe_words(full)
    ref, owner = [], []
    for k, seg in enumerate(ctx):
        for w in norm(seg):
            ref.append(w); owner.append(k)
    ww = [(t, a, b) for w, a, b in ww for t in (norm(w) or [""])]  # one entry per token (a URL is several)
    hyp = [w for w, _, _ in ww]
    me = 1 if prev else 0
    # owner segment of every heard word: matched words directly, mismatched ones (a mis-heard word is
    # still that spot of the script) proportionally inside their opcode block
    own = [None] * len(hyp)
    hit = 0
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, ref, hyp, autojunk=False).get_opcodes():
        for j in range(j1, j2):
            if tag == "equal":
                own[j] = owner[i1 + j - j1]
                hit += owner[i1 + j - j1] == me
            elif tag == "replace":
                own[j] = owner[min(i2 - 1, i1 + int((j - j1) * (i2 - i1) / (j2 - j1)))]
            elif tag == "insert":
                own[j] = owner[min(i1, len(owner) - 1)]
    mine = len(norm(text))
    match = hit / mine
    idx = [j for j, o in enumerate(own) if o == me]
    if not idx:
        os.remove(full); return 0.0, 0.0
    start, end = ww[idx[0]][1], ww[idx[-1]][2]
    prv = [j for j, o in enumerate(own) if o is not None and o < me]
    nxt_ = [j for j, o in enumerate(own) if o is not None and o > me]
    lo = (ww[prv[-1]][2] + start) / 2 if prv else 0.0
    hi = (end + ww[nxt_[0]][1]) / 2 if nxt_ else end + 0.5
    s = max(lo, start - 0.12)
    e = min(hi, end + 0.10)  # stop right after the last word: no inhale tail
    subprocess.run([FF, "-loglevel", "error", "-y", "-ss", f"{s:.3f}", "-t", f"{e - s:.3f}", "-i", full,
                    "-af", f"afade=t=in:d=0.02,afade=t=out:st={max(0, e - s - 0.07):.3f}:d=0.07", out], check=True)
    os.remove(full)
    return match, e - s


def _scribe(path):
    b = uuid.uuid4().hex
    fields = {"model_id": "scribe_v1", "language_code": "heb", "timestamps_granularity": "word",
              "tag_audio_events": "false", "diarize": "false"}
    parts = []
    for k, v in fields.items():
        parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    parts.append(f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="a.wav"\r\n'
                 f'Content-Type: audio/wav\r\n\r\n'.encode() + open(path, "rb").read() + b"\r\n")
    parts.append(f"--{b}--\r\n".encode())
    return json.loads(_req(API + "/speech-to-text", b"".join(parts),
                           {"Content-Type": "multipart/form-data; boundary=" + b}))


def transcribe(path):
    return _scribe(path)["text"].strip()


def scribe_words(path):
    """[(word, start, end)] - spoken words only (no spacing / audio-event tokens)."""
    return [(w["text"], w["start"], w["end"]) for w in _scribe(path)["words"] if w.get("type") == "word"]


if __name__ == "__main__":
    print(voice_id())
