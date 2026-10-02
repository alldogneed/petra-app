"""Final QA of a rendered video: every spoken scene transcribed from the FINAL mp4 (N times),
loudness, duration, streams, and the edges of every voice clip.

  python3 qa_video.py promo                 # marketing/promo-video
  python3 qa_video.py reel                  # marketing/reel-boarding
  python3 qa_video.py --video X.mp4 --scenes scenes.json [--vo vo/]   # [{"start":..,"end":..,"text":..}]
  options: --runs 2 (transcriptions per scene)

Reading the result:
  * both runs 1.00 -> clean.  One run off by a spelling variant (פטרא, בווטסאפ, ט/ת, ההאכלות) -> transcriber noise.
  * a word missing/garbled in BOTH runs -> real problem. Test the clip alone (vo/NN.wav): clean alone but broken
    in the mix = music masking (see SKILL.md troubleshooting); broken alone = pick/record another take.
  * clip edges: "after" > ~0.15s = breath/tail left at the end of the sentence (run voice.tidy on it).
"""
import argparse, difflib, json, os, subprocess, sys, tempfile
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
from _common import FF, dub, levels, loudness, project_scenes, whisper  # noqa: E402


def check_scene(video, i, a, b, text, runs, tmp):
    p = os.path.join(tmp, f"seg{i}.wav")
    subprocess.run([FF, "-loglevel", "error", "-y", "-ss", str(a), "-to", str(b), "-i", video,
                    "-vn", "-ac", "1", "-ar", "16000", p], check=True)
    hs = [dub.transcribe(p) for _ in range(runs)]
    diffs = set()
    for h in hs:
        x, y = dub.words(text), dub.words(h)
        diffs |= {f"{' '.join(x[i1:i2])} -> {' '.join(y[j1:j2])}"
                  for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, x, y).get_opcodes() if op != "equal"}
    return i, [round(dub.score(text, h), 2) for h in hs], sorted(diffs)


def clip_edges(path):
    ww = whisper(path, lang="he", words=True).get("words", [])
    if not ww:
        return None
    d = dub.duration(path)
    return round(ww[0]["start"], 2), round(d - ww[-1]["end"], 2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project", nargs="?")
    ap.add_argument("--video")
    ap.add_argument("--scenes")
    ap.add_argument("--vo")
    ap.add_argument("--runs", type=int, default=2)
    args = ap.parse_args()
    if args.project:
        scenes, video, vo = project_scenes(args.project)
    else:
        scenes = [(s["start"], s["end"], s["text"]) for s in json.load(open(args.scenes))]
        video, vo = args.video, args.vo
    video = args.video or video

    out = subprocess.run([FF, "-i", video], capture_output=True, text=True).stderr
    print("file:", os.path.relpath(video))
    for line in out.splitlines():
        if "Duration" in line or "Stream" in line:
            print("  " + line.strip()[:110])
    print(f"  integrated loudness: {loudness(video)} LUFS (target -14; promo -15)")

    with tempfile.TemporaryDirectory() as tmp, ThreadPoolExecutor(6) as ex:
        res = list(ex.map(lambda s: check_scene(video, s[0], *s[1], args.runs, tmp), enumerate(scenes)))
    print("\nscenes (from the final mix):")
    bad = 0
    for i, sc, d in res:
        flag = "OK " if min(sc) == 1 else ("~  " if max(sc) == 1 else "BAD")
        bad += flag == "BAD"
        print(f"  {flag} {i:2d} {sc} {'; '.join(d)}")

    if vo and os.path.isdir(vo):
        print("\nvoice clip edges (speech starts at / audio left after the last word):")
        clips = sorted(f for f in os.listdir(vo) if f[:2].isdigit() and f.endswith(".wav"))
        with ThreadPoolExecutor(6) as ex:
            edges = list(ex.map(lambda f: (f, clip_edges(os.path.join(vo, f))), clips))
        for f, e in edges:
            if e:
                warn = "  <- tail/breath?" if e[1] > 0.15 else ""
                print(f"  {f}: start {e[0]:.2f}s, after {e[1]:.2f}s{warn}")
    print(f"\n{bad} scene(s) broken in both runs")


if __name__ == "__main__":
    main()
