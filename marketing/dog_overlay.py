"""Round talking-dog mascot over a silent render (any size). Used by reel-boarding/build.py.

items: [{"clip": mp4, "w0": window start, "w1": window end, "voice": time the clip starts playing,
         "x": dog left, "y": dog top, "size": dog diameter}]  (times in the final video)
The first/last frame of each clip is held to fill its window, so the dog is on screen continuously.
"""
import os, subprocess
from PIL import Image, ImageDraw, ImageFilter

FF = "/opt/homebrew/bin/ffmpeg"
R = 10  # orange ring width


def assets(size, workdir):
    S = size + 60
    ring = os.path.join(workdir, f"dog-ring-{size}.png")
    mask = os.path.join(workdir, f"dog-mask-{size}.png")
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse((14, 22, S - 14, S - 6), fill=(15, 23, 42, 70))
    img = Image.alpha_composite(img, sh.filter(ImageFilter.GaussianBlur(10)))
    c = (S - size - 2 * R) // 2
    ImageDraw.Draw(img).ellipse((c, c - 6, c + size + 2 * R, c - 6 + size + 2 * R), fill=(249, 115, 22, 255))
    img.save(ring)
    m = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    m.resize((size, size), Image.LANCZOS).save(mask)
    return ring, mask, 30


def overlay(silent, items, total, workdir, out=None):
    out = out or silent.replace(".mp4", "-dog.mp4")
    ins, graph, last = ["-i", silent], [], "[0:v]"
    k = 1
    for it in items:
        size = it["size"]
        ring, mask, pad = assets(size, workdir)
        a, b = it["w0"], it["w1"]
        dur = float(subprocess.run([FF, "-i", it["clip"]], capture_output=True, text=True).stderr
                    .split("Duration: ")[1].split(",")[0].split(":")[2]) + 0  # clips are < 1 min
        pre = max(0.0, it["voice"] - a)
        post = max(0.0, b - (it["voice"] + dur))
        ins += ["-i", it["clip"], "-loop", "1", "-i", mask, "-loop", "1", "-i", ring]
        # fade only at the very start / end of the whole mascot track; between consecutive lines it is a hard
        # cut (a cross-fade showed two dogs for a moment, one of them at the old position)
        fade = ",".join(([f"fade=t=in:st={a}:d=0.2:alpha=1"] if it.get("fin", True) else [])
                        + ([f"fade=t=out:st={b - 0.2}:d=0.2:alpha=1"] if it.get("fout", True) else [])) or "null"
        graph.append(f"[{k}:v]scale={size}:{size},tpad=start_duration={pre:.3f}:start_mode=clone:stop_duration={post:.3f}:stop_mode=clone,"
                     f"setpts=PTS-STARTPTS+{a}/TB,format=yuva420p[dv{k}]")
        graph.append(f"[dv{k}][{k + 1}:v]alphamerge,{fade}[dc{k}]")
        graph.append(f"[{k + 2}:v]format=yuva420p,{fade}[rc{k}]")
        graph.append(f"{last}[rc{k}]overlay={it['x'] - pad}:{it['y'] - pad + 6}:enable='gte(t,{a})*lt(t,{b})'[o{k}a]")
        graph.append(f"[o{k}a][dc{k}]overlay={it['x']}:{it['y']}:enable='gte(t,{a})*lt(t,{b})'[o{k}]")
        last = f"[o{k}]"
        k += 3
    subprocess.run([FF, "-loglevel", "error", "-y", *ins, "-filter_complex", ";".join(graph), "-map", last,
                    "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-t", str(total), out],
                   check=True)
    return out
