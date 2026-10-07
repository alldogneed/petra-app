"""Cut the real screen recordings (takeX.mp4, 690x780) into short scene clips: typing and slow waits are sped up,
the approval card and the answer play at normal speed. Output cards/sceneN.mp4 (762x860, 30 fps)."""
import subprocess, os
FF = "/opt/homebrew/bin/ffmpeg"
HERE = os.path.dirname(os.path.abspath(__file__))
# (start, end, speed) in the take's own seconds. Take B idx 5 shows a stale "Reconnect" banner: never use 4.9-6.9.
CUTS = {
    1: ("A", [(2.2, 5.0, 2.0), (5.0, 10.9, 10), (10.9, 12.9, 1), (12.9, 20.0, 10), (20.0, 23.0, 1)]),
    2: ("B", [(2.0, 4.8, 2.5), (7.0, 25.9, 14), (25.9, 27.9, 1), (27.9, 35.0, 12), (35.0, 38.5, 1)]),
    3: ("C", [(2.0, 5.0, 2.5), (5.0, 11.0, 10), (11.0, 12.9, 1), (12.9, 21.0, 12), (21.0, 25.0, 1)]),
    4: ("D", [(1.5, 7.5, 4.0), (7.5, 25.9, 14), (25.9, 28.0, 1), (28.0, 34.2, 10), (34.2, 39.2, 1)]),
}
for i, (take, segs) in CUTS.items():
    parts, labels = [], []
    for k, (a, b, sp) in enumerate(segs):
        parts.append(f"[0:v]trim={a}:{b},setpts=(PTS-STARTPTS)/{sp},fps=30,scale=762:860[v{k}]")
        labels.append(f"[v{k}]")
    fc = ";".join(parts) + ";" + "".join(labels) + f"concat=n={len(segs)}:v=1:a=0[o]"
    out = os.path.join(HERE, "cards", f"scene{i}.mp4")
    subprocess.run([FF, "-loglevel", "error", "-y", "-i", os.path.join(HERE, f"take{take}.mp4"), "-filter_complex", fc,
                    "-map", "[o]", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", out], check=True)
    d = subprocess.run([FF, "-i", out], capture_output=True, text=True).stderr.split("Duration: ")[1][:11]
    print(i, take, d)
