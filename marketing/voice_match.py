"""Pick takes by how close a word SOUNDS to a take the owner approved by ear.

Scribe transcribes "פטרה" / "AI" correctly even when the owner hears them wrong, so text QA cannot choose
between takes. distance(ref_wav, (a, b), cand_wav, (a, b)) = DTW over log-mel frames of the two word
segments (lower = closer). Pure numpy (no librosa on this machine).
"""
import subprocess
import numpy as np

FF = "/opt/homebrew/bin/ffmpeg"
SR = 16000


def load(path, a=None, b=None):
    cmd = [FF, "-loglevel", "error"]
    if a is not None:
        cmd += ["-ss", f"{max(0, a):.3f}", "-t", f"{b - max(0, a):.3f}"]
    raw = subprocess.run(cmd + ["-i", path, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768


def _mel_fb(n_fft=400, n_mels=32, fmin=80, fmax=7600):
    hz2mel = lambda f: 2595 * np.log10(1 + f / 700)
    mel2hz = lambda m: 700 * (10 ** (m / 2595) - 1)
    pts = mel2hz(np.linspace(hz2mel(fmin), hz2mel(fmax), n_mels + 2))
    bins = np.floor((n_fft + 1) * pts / SR).astype(int)
    fb = np.zeros((n_mels, n_fft // 2 + 1), dtype=np.float32)
    for m in range(1, n_mels + 1):
        l, c, r = bins[m - 1], bins[m], bins[m + 1]
        for k in range(l, c):
            fb[m - 1, k] = (k - l) / max(1, c - l)
        for k in range(c, r):
            fb[m - 1, k] = (r - k) / max(1, r - c)
    return fb


_FB = _mel_fb()


def feats(x):
    """log-mel frames (25 ms window, 10 ms hop), mean/variance normalised per segment."""
    n, hop = 400, 160
    if len(x) < n:
        x = np.pad(x, (0, n - len(x)))
    idx = np.arange(0, len(x) - n + 1, hop)
    fr = np.stack([x[i:i + n] for i in idx]) * np.hanning(n)
    mag = np.abs(np.fft.rfft(fr, n)) ** 2
    lm = np.log(mag @ _FB.T + 1e-8)
    return (lm - lm.mean(0)) / (lm.std(0) + 1e-5)


def dtw(a, b):
    na, nb = len(a), len(b)
    cost = np.linalg.norm(a[:, None, :] - b[None, :, :], axis=2)
    acc = np.full((na + 1, nb + 1), np.inf, dtype=np.float32)
    acc[0, 0] = 0
    for i in range(1, na + 1):
        for j in range(1, nb + 1):
            acc[i, j] = cost[i - 1, j - 1] + min(acc[i - 1, j], acc[i, j - 1], acc[i - 1, j - 1])
    return float(acc[na, nb] / (na + nb))


def distance(ref, rseg, cand, cseg, pad=0.03):
    fa = feats(load(ref, rseg[0] - pad, rseg[1] + pad))
    fb = feats(load(cand, cseg[0] - pad, cseg[1] + pad))
    return dtw(fa, fb)
