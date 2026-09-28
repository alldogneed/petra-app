"""Natural voiceover for the promo video, using the reel's continuous-take pipeline.

  python3 voice_continuous.py        # add takes to vo/pool until every line passes, then
                                     # copy the winners to vo/NN.wav (scene numbering) and retime promo.html

The whole script is read as one continuous take (voice-message tone), split per line at the pauses,
and every line is double-transcribed; the best version of each line across takes wins.
"""
import json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "reel-boarding"))
import dub  # noqa: E402
import voice  # noqa: E402  (reel-boarding/voice.py: split_take, continuous)

SCENES = [i for i, l in enumerate(dub.LINES) if l is not None]  # scene index of each spoken line
voice.LINES = [dub.LINES[i] for i in SCENES]
voice.HERE = os.path.join(HERE, "pool-voice")  # pool lives in pool-voice/vo/pool, winners copied below


def main(takes=4):
    voice.continuous(takes=takes)
    src = os.path.join(voice.HERE, "vo")
    t = json.load(open(os.path.join(src, "timing.json")))
    tpath = os.path.join(dub.VO, "timing.json")
    old = json.load(open(tpath))
    lens = [0.0] * len(dub.LINES)
    for k, scene in enumerate(SCENES):
        shutil.copy(os.path.join(src, f"{k:02d}.wav"), os.path.join(dub.VO, f"{scene:02d}.wav"))
        lens[scene] = t["lens"][k]
    html, _, _ = dub.read_scenes()
    starts, total = old["orig_starts"], old["orig_total"]
    new_starts, new_total = dub.retime(html, starts, total, lens)
    json.dump({"voice": "coral", "mode": "continuous", "scores": t["scores"], "starts": new_starts, "lens": lens,
               "total": new_total, "orig_starts": starts, "orig_total": total}, open(tpath, "w"), indent=1)
    print(f"retimed promo.html: {total:g}s -> {new_total:g}s")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 4)
