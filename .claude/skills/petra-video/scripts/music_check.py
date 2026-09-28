"""Check a music track for voices and produce a clean instrumental.

  python3 music_check.py path/to/track.mp3 [--no-separate]

1. Structure: length, silences (the track's built-in stop and its natural ending), rough BPM.
2. Voice check: separates the track with audio-separator (UVR-MDX-NET-Inst_HQ_3) and measures the vocal
   stem per 4s window + whisper segments on it. Writes <track>-instrumental.wav next to the track.
   A vocal stem around -40 dB or lower everywhere = separation bleed only (track is clean).
   Windows ~10+ dB louder than the rest (e.g. -27 vs -38) + a whisper segment with low no_speech_prob
   = a real voice/vocal chop -> use the instrumental.

Setup once per container (CPU-only, ~1 GB):
  pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision
  pip install "audio-separator[cpu]"
"""
import argparse, os, shutil, subprocess, sys, tempfile

sys.path.insert(0, os.path.dirname(__file__))
from _common import FF, dub, levels, mean_db, whisper  # noqa: E402


def structure(track):
    d = dub.duration(track)
    out = subprocess.run([FF, "-i", track, "-af", "silencedetect=n=-45dB:d=0.3", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    sil = [l.split("silence_")[1] for l in out.splitlines() if "silence_start" in l or "silence_end" in l]
    print(f"length {d:.2f}s; silences (stop / ending candidates):")
    for s in sil:
        print("  " + s.strip())
    # rough BPM from onset autocorrelation on the first 30s
    try:
        import numpy as np
        e = np.array(levels(track, step=0.01, dur=min(30, d)))
        on = np.maximum(0, np.diff(e))
        on = on - on.mean()
        ac = np.correlate(on, on, "full")[len(on) - 1:]
        lags = np.arange(len(ac)) * 0.01
        m = (lags > 0.3) & (lags < 1.0)
        beat = lags[np.argmax(ac * m)]
        print(f"beat ~{beat:.3f}s (~{60 / beat:.0f} BPM), bar ~{4 * beat:.3f}s (verify by ear/visually)")
    except ImportError:
        print("(pip install numpy for a BPM estimate)")


def separate(track):
    exe = shutil.which("audio-separator")
    if not exe:
        raise SystemExit("audio-separator not installed - see the setup lines at the top of this file")
    tmp = tempfile.mkdtemp()
    bindir = os.path.join(tmp, "bin")
    os.makedirs(bindir)
    os.symlink(FF, os.path.join(bindir, "ffmpeg"))  # audio-separator shells out to `ffmpeg`
    env = dict(os.environ, PATH=bindir + os.pathsep + os.environ["PATH"])
    subprocess.run([exe, track, "--model_filename", "UVR-MDX-NET-Inst_HQ_3.onnx", "--output_dir", tmp,
                    "--output_format", "WAV", "--model_file_dir", os.path.join(tempfile.gettempdir(), "uvr-models")],
                   env=env, check=True, capture_output=True)
    voc = next(os.path.join(tmp, f) for f in os.listdir(tmp) if "(Vocals)" in f)
    inst = next(os.path.join(tmp, f) for f in os.listdir(tmp) if "(Instrumental)" in f)
    return voc, inst


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("track")
    ap.add_argument("--no-separate", action="store_true")
    args = ap.parse_args()
    structure(args.track)
    if args.no_separate:
        return
    voc, inst = separate(args.track)
    d = dub.duration(voc)
    lv = [(t, mean_db(voc, t, 4)) for t in range(0, int(d), 4)]
    print("\nvocal stem dB per 4s: " + " ".join(f"{t}:{v:.0f}" for t, v in lv))
    base = sorted(v for _, v in lv)[len(lv) // 2]
    hot = [t for t, v in lv if v > base + 8]
    wav = voc + ".16k.wav"
    subprocess.run([FF, "-loglevel", "error", "-y", "-i", voc, "-ac", "1", "-ar", "16000", wav], check=True)
    segs = [s for s in whisper(wav).get("segments", []) if s["no_speech_prob"] < 0.5]
    print("whisper segments on the vocal stem (no_speech_prob < 0.5):")
    for s in segs:
        print(f"  {s['start']:.1f}-{s['end']:.1f}s p={s['no_speech_prob']:.2f} {s['text'][:60]!r}")
    out = os.path.splitext(args.track)[0] + "-instrumental.wav"
    shutil.copy(inst, out)
    verdict = "VOICE FOUND" if (hot or segs) else "clean (bleed only)"
    print(f"\nverdict: {verdict}; louder vocal windows at {hot or '-'}s")
    print(f"instrumental written to {os.path.relpath(out)} - use it as the music source either way")


if __name__ == "__main__":
    main()
