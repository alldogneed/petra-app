"""Rough lip-sync check for a Kling dog clip: correlation between how open the mouth is (dark pixels in the
mouth area) and the loudness of the voice line, and the lag (frames) at which they match best.
  python3 sync_check.py clip.mp4 line.wav
corr >= ~0.35 with |lag| <= 2 frames looks in sync; low corr or a big lag is worth regenerating."""
import subprocess, sys
import numpy as np
FF = "/opt/homebrew/bin/ffmpeg"

def mouth(clip, fps=30):
    w, h = 300, 150  # mouth box of the 960x960 clip (dog-closed-mouth.png framing)
    raw = subprocess.run([FF, "-loglevel", "error", "-i", clip, "-vf", f"fps={fps},scale=960:960,crop={w}:{h}:330:450,format=gray",
                          "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    fr = np.frombuffer(raw, dtype=np.uint8).reshape(-1, h, w).astype(np.float32)
    return (fr < 70).mean(axis=(1, 2))  # share of dark (open-mouth) pixels per frame

def env(wav, n, fps=30):
    raw = subprocess.run([FF, "-loglevel", "error", "-i", wav, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768
    hop = 16000 // fps
    e = np.array([np.sqrt((x[i * hop:(i + 1) * hop] ** 2).mean()) if (i + 1) * hop <= len(x) else 0 for i in range(n)])
    return e

def check(clip, wav):
    m = mouth(clip); e = env(wav, len(m))
    m = (m - m.mean()) / (m.std() + 1e-6); e = (e - e.mean()) / (e.std() + 1e-6)
    best = max(((float(np.mean(m[max(0, l):len(m) + min(0, l)] * e[max(0, -l):len(e) - max(0, l)])), l) for l in range(-10, 11)))
    c0 = float(np.mean(m * e))
    return round(c0, 2), round(best[0], 2), best[1]

if __name__ == "__main__":
    print(check(sys.argv[1], sys.argv[2]))
