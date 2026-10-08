"""Cut the real screen recordings (takeX.mp4, 690x780) into short scene clips: typing and slow waits are sped up,
the approval card and the answer play at normal speed. Output cards/sceneN.mp4 (762x860, 30 fps)."""
import subprocess, os
FF = "/opt/homebrew/bin/ffmpeg"
HERE = os.path.dirname(os.path.abspath(__file__))
# (start, end, speed) in the take's own seconds. takeF is only clean up to 88 s (the owner's own windows covered the pane after that).
CUTS = {
    1: ("E", [(1.5, 7.0, 1)]),                                             # Petra settings: the address + "copied" toast
    2: ("F", [(3.0, 5.0, 1), (20.0, 23.0, 2.5), (26.0, 35.0, 3)]),         # Claude: connector dialog -> Add -> Connect
    3: ("F", [(38.0, 41.0, 1), (51.5, 58.5, 2.5), (65.0, 68.0, 1.5)]),     # Petra consent: access level -> approve -> Connected
    4: ("A", [(10.9, 12.4, 1), (20.0, 22.5, 1)]),                          # first question: approval card -> answer (2026-10-07 take)
}
import json
VOICE = json.load(open(os.path.join(HERE, "vo", "timing.json")))["lens"]
for i, (take, segs) in CUTS.items():
    parts, labels = [], []
    for k, (a, b, sp) in enumerate(segs):
        parts.append(f"[0:v]trim={a}:{b},setpts=(PTS-STARTPTS)/{sp},fps=30,scale=762:860[v{k}]")
        labels.append(f"[v{k}]")
    fc = ";".join(parts) + ";" + "".join(labels) + f"concat=n={len(segs)}:v=1:a=0[o]"
    out = os.path.join(HERE, "cards", f"scene{i}.mp4")
    subprocess.run([FF, "-loglevel", "error", "-y", "-i", os.path.join(HERE, f"take{take}.mp4"), "-filter_complex", fc,
                    "-map", "[o]", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", out], check=True)
    dur = float(subprocess.run([FF, "-i", out], capture_output=True, text=True).stderr.split("Duration: ")[1][:11].split(":")[2])
    target = VOICE[i] - 0.3  # scene = max(voice, clip + 0.7): keep the clip inside the spoken line
    if dur > target:
        k = dur / target
        tmp = out + ".fit.mp4"
        subprocess.run([FF, "-loglevel", "error", "-y", "-i", out, "-vf", f"setpts=PTS/{k:.4f},fps=30", "-c:v", "libx264",
                        "-crf", "18", "-pix_fmt", "yuv420p", tmp], check=True)
        os.replace(tmp, out)
        print(i, take, f"{dur:.2f}s -> {target:.2f}s (x{k:.2f})")
    else:
        print(i, take, f"{dur:.2f}s (voice {VOICE[i]:.2f}s)")
