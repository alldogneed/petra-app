"""Talking dog mascot via the Hedra v3 API (image + ElevenLabs audio -> lip-synced video).

  python3 hedra_dog.py audio "text"            # ElevenLabs line (cloned voice) -> line.wav
  python3 hedra_dog.py run MODEL [out.mp4]     # MODEL: hedra-character-3 | kling-ai-avatar-v2

Key: HEDRA_API_KEY (.env.video, format key_id:secret, header "Authorization: Key ..."). Never printed.
"""
import json, os, subprocess, sys, time, urllib.request, uuid

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import eleven  # noqa: E402

API = "https://api.hedra.com/v3"
IMAGE = os.path.join(HERE, "dog-closed-mouth.png")
AUDIO = os.path.join(HERE, "line.wav")
PROMPT = ("A friendly cartoon dog mascot in a flat vector style talking to the camera. Mouth opens and closes "
          "naturally in sync with the speech, gentle head and ear movement, blinking, warm and cheerful. "
          "Keep the flat colors and the plain light background unchanged. The camera does not move.")


def key():
    k = os.environ.get("HEDRA_API_KEY")
    if not k:
        for line in open(os.path.join(HERE, "..", "..", ".env.video")):
            if line.startswith("HEDRA_API_KEY="):
                k = line.split("=", 1)[1].strip()
    assert k, "HEDRA_API_KEY missing"
    return k


def call(path, data=None, headers=None, method=None):
    h = {"Authorization": "Key " + key()}
    h.update(headers or {})
    r = urllib.request.Request(API + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=300) as resp:
            return json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{path} -> HTTP {e.code}: {e.read()[:500].decode('utf8', 'replace')}")


def upload(path):
    b = uuid.uuid4().hex
    body = (f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{os.path.basename(path)}"\r\n'
            f'Content-Type: application/octet-stream\r\n\r\n').encode() + open(path, "rb").read() + f"\r\n--{b}--\r\n".encode()
    return call("/files", body, {"Content-Type": "multipart/form-data; boundary=" + b})["url"]


def run(model, out, **extra):
    img, aud = upload(IMAGE), upload(AUDIO)
    inp = {"prompt": PROMPT, "aspect_ratio": "1:1", "start_image": {"source": "url", "url": img},
           "audio": {"source": "url", "url": aud}}
    inp.update(extra)
    job = call(f"/models/{model}", json.dumps({"input": inp}).encode(), {"Content-Type": "application/json"})
    jid = job.get("job_id") or job.get("id")
    print("job", jid, flush=True)
    while True:
        st = call(f"/jobs/{jid}/status")
        s = st.get("status")
        print(" ", s, st.get("progress", ""), flush=True)
        if s in ("COMPLETED", "FAILED"):
            break
        time.sleep(8)
    full = call(f"/jobs/{jid}")
    if s == "FAILED":
        raise SystemExit("FAILED: " + json.dumps(full)[:600])
    outs = full.get("outputs") or []
    url = outs[0].get("url") or outs[0].get("download_url")
    urllib.request.urlretrieve(url, out)
    print("saved", out, "cost", full.get("cost") or full.get("usage") or "")


if __name__ == "__main__":
    if sys.argv[1] == "audio":
        eleven._raw(sys.argv[2], AUDIO)
        print(AUDIO, subprocess.run([eleven.FF, "-i", AUDIO], capture_output=True, text=True).stderr.split("Duration:")[1][:12])
    elif sys.argv[1] == "run":
        model = sys.argv[2]
        extra = {"resolution": "540p"} if model == "hedra-character-3" else {"resolution": "720p"}
        run(model, sys.argv[3] if len(sys.argv) > 3 else os.path.join(HERE, f"test-{model}.mp4"), **extra)
