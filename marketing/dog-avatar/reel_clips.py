"""Kling-pro lip-sync clips of the dog for every line of the boarding reel (audio = ../reel-boarding/vo/NN.wav)."""
import json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
import hedra_dog as h

VO = os.path.join(h.HERE, "..", "reel-boarding", "vo")
OUT = os.path.join(h.HERE, "reel")
PROMPT = ("A friendly cartoon dog mascot in a flat vector style talking directly to the camera. The mouth shapes match "
          "every syllable of the speech precisely: opens wide on vowels, closes fully on b/m/p sounds, clear lip movement. "
          "Cheerful expression, small head nods, ears bounce slightly, natural blinking. Flat colors and plain light "
          "background unchanged. Static camera.")


def one(i):
    out = os.path.join(OUT, f"{i:02d}.mp4")
    if os.path.exists(out):
        return i, "cached"
    img, aud = h.upload(h.IMAGE), h.upload(os.path.join(VO, f"{i:02d}.wav"))
    inp = {"prompt": PROMPT, "aspect_ratio": "1:1", "resolution": "720p", "quality": "pro",
           "start_image": {"source": "url", "url": img}, "audio": {"source": "url", "url": aud}}
    job = h.call("/models/kling-ai-avatar-v2", json.dumps({"input": inp}).encode(), {"Content-Type": "application/json"})
    jid = job.get("job_id") or job.get("id")
    while True:
        s = h.call(f"/jobs/{jid}/status").get("status")
        if s in ("COMPLETED", "FAILED"):
            break
        time.sleep(8)
    full = h.call(f"/jobs/{jid}")
    if s == "FAILED":
        return i, "FAILED " + json.dumps(full)[:300]
    urllib.request.urlretrieve(full["outputs"][0]["url"], out)
    return i, f"ok cost {full.get('cost')}"


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    idx = [int(x) for x in sys.argv[1:]] or range(7)
    with ThreadPoolExecutor(4) as ex:
        for i, r in ex.map(one, idx):
            print(i, r, flush=True)
