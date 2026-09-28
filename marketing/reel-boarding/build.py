"""Boarding Reel (1080x1920): builds reel.html from vo/timing.json + vo/words.json, renders, mixes.

  python3 build.py html                 # write reel.html
  python3 build.py stills 3 9 20        # reel.html frames -> still_*.png
  python3 build.py video                # render + voice + music -> reel-boarding.mp4
  python3 build.py preview 17.6         # same, first N seconds only -> reel-preview.mp4
"""
import asyncio, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "promo-video"))
import dub  # noqa: E402
from voice import LINES  # noqa: E402

FF = dub.FF
W, H, FPS = 1080, 1920, 30
LEAD, TAIL = 0.2, 0.2
CTA_LEAD, CTA_HOLD = 0.6, 2.2
MUSIC_STOP = 52.10    # the track's built-in 1.25s stop; placed exactly at the CTA, then the track's ending
MUSIC_END = 59.36
MUSIC_GAIN = -8.0

# Subtitle chunks per line: (text, index of the word in vo/words.json where it starts)
SUBS = [
    [("עדיין מנהלים את הפנסיון", 0), ("על לוח מחיק?", 4), ("ביומן גוגל?", 7), ("במחברת?", 9)],
    [("בפטרה, כל כלב מקבל חדר", 0), ("בגרירה אחת", 5), ("ורואים את כל התפוסה", 7), ("על מסך אחד", 11)],
    [("מתכננים קדימה:", 0), ("כל ההזמנות של החודש הקרוב", 2), ("על ציר זמן אחד", 7)],
    [("ומה עם החצרות?", 0), ("פשוט גוררים כלב לחצר", 3), ("ורואים מראש", 7), ("מי מסתדר עם מי", 9)],
    [("בכל בוקר, הצוות מקבל", 0), ("לוח של האכלות ותרופות לכל כלב", 4), ("ומסמן מה כבר ניתן", 10)],
    [("והצוות?", 0), ("כל עובד רואה רק את הפנסיון", 1), ("בלי הכנסות ובלי לקוחות", 7), ("אתם מחליטים מה מותר", 11)],
    [("רוצים לראות איך זה עובד אצלכם?", 0), ("דברו איתנו בוואטסאפ", 6)],
]


def timeline():
    lens = json.load(open(os.path.join(HERE, "vo", "timing.json")))["lens"]
    words = json.load(open(os.path.join(HERE, "vo", "words.json")))
    starts, t = [], 0.0
    for i, l in enumerate(lens):
        starts.append(round(t, 2))
        t += LEAD + l + TAIL
    lead = [LEAD] * (len(lens) - 1) + [CTA_LEAD]
    total = round(starts[-1] + CTA_LEAD + lens[-1] + CTA_HOLD, 2)
    ends = starts[1:] + [total]
    subs = []  # (abs_start, abs_end, text)
    for i, chunks in enumerate(SUBS):
        wt = [w[1] for w in words[str(i)]]
        vs = starts[i] + lead[i]
        for k, (txt, wi) in enumerate(chunks):
            a = vs + wt[wi]
            b = vs + wt[chunks[k + 1][1]] if k + 1 < len(chunks) else min(ends[i] - 0.05, vs + lens[i] + 0.3)
            subs.append((round(a - 0.05, 2), round(b, 2), txt))
    return lens, starts, lead, total, subs


CSS = """
:root{--navy:#0F172A;--orange:#F97316;--orange2:#EA580C;--bg:#F6F7F9;--border:#E2E8F0;--muted:#5B6678;--wa:#25D366;--ease:cubic-bezier(.25,.8,.25,1)}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1920px;overflow:hidden;background:var(--navy);font-family:Heebo,sans-serif;color:var(--navy)}
.scene{position:absolute;inset:0;opacity:0;animation:scene var(--d) linear var(--s) both;overflow:hidden}
@keyframes scene{0%{opacity:0}3%{opacity:1}97%{opacity:1}100%{opacity:0}}
.scene.first{animation-name:sceneFirst}@keyframes sceneFirst{0%{opacity:1}97%{opacity:1}100%{opacity:0}}
.scene.last{animation-name:sceneLast}@keyframes sceneLast{0%{opacity:0}4%{opacity:1}100%{opacity:1}}
.dark{background:var(--navy)}.light{background:var(--bg)}
.fu{animation:fadeUp .7s var(--ease) calc(var(--s) + var(--o,0s)) both}
@keyframes fadeUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
.pop{animation:pop .45s cubic-bezier(.3,1.6,.5,1) calc(var(--s) + var(--o,0s)) both}
@keyframes pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:none}}
.fi{animation:fadeIn .5s ease calc(var(--s) + var(--o,0s)) both}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}

/* top headline */
.head{position:absolute;top:190px;left:70px;right:70px;text-align:right}
.eyebrow{font-size:36px;font-weight:700;color:var(--orange2)}
.title{font-size:78px;font-weight:800;line-height:1.08;margin-top:10px;letter-spacing:-.5px}

/* media card */
.card{position:absolute;left:60px;top:470px;width:960px;height:860px;border-radius:36px;background:#fff;overflow:hidden;
  box-shadow:0 30px 70px rgba(15,23,42,.16),0 0 0 2px var(--border)}
.card img.pan{position:absolute;left:0;top:0;transform-origin:0 0;
  animation:pan var(--pd) ease-in-out calc(var(--s) + var(--po,0s)) both}
@keyframes pan{from{transform:translate(var(--x0),var(--y0)) scale(var(--z0,1))}to{transform:translate(var(--x1),var(--y1)) scale(var(--z1,1))}}
.layer{position:absolute;inset:0;animation:fadeIn .45s ease calc(var(--s) + var(--o)) both}
.callout{position:absolute;border-radius:28px;background:#fff;overflow:hidden;
  box-shadow:0 30px 70px rgba(15,23,42,.28),0 0 0 2px var(--border)}
.callout img{display:block;width:100%}
.ring{position:absolute;border:6px solid var(--orange);border-radius:22px;
  animation:ring 1.2s ease-out calc(var(--s) + var(--o)) both}
@keyframes ring{0%{opacity:0;transform:scale(1.25)}30%{opacity:1;transform:scale(1)}85%{opacity:1}100%{opacity:.9}}

/* subtitles */
.sub{position:absolute;left:60px;right:60px;top:1390px;display:flex;justify-content:center;opacity:0;
  animation:sub var(--sd) linear var(--ss) both}
.sub span{background:var(--navy);color:#fff;font-size:58px;font-weight:800;line-height:1.25;padding:14px 34px 18px;border-radius:22px;text-align:center;
  box-shadow:0 12px 30px rgba(15,23,42,.25)}
.sub.onDark span{background:#fff;color:var(--navy)}
@keyframes sub{0%{opacity:0;transform:translateY(14px)}6%{opacity:1;transform:none}94%{opacity:1}100%{opacity:0}}

/* hook */
.hq{position:absolute;top:300px;left:60px;right:60px;text-align:center;color:#fff;font-size:84px;font-weight:800;line-height:1.1}
.opts{position:absolute;top:610px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:44px}
.opt{display:flex;align-items:center;gap:34px;background:#1E293B;border-radius:30px;padding:26px 44px;width:760px;position:relative}
.opt svg{width:120px;height:120px;flex:none}
.opt b{font-size:64px;font-weight:800;color:#fff}
.strike{position:absolute;left:30px;right:30px;top:50%;height:10px;margin-top:-5px;background:#EF4444;border-radius:6px;transform-origin:right;
  animation:strike .35s ease-out calc(var(--s) + var(--o)) both}
@keyframes strike{from{transform:scaleX(0)}to{transform:scaleX(1)}}

/* logo */
.wm{position:absolute;top:64px;left:60px;display:flex;align-items:center;gap:16px;opacity:0;z-index:20;animation:wm var(--wd) linear var(--ws) both}
.wm .logoTile{width:78px;height:78px;border-radius:20px;box-shadow:0 6px 16px rgba(15,23,42,.15)}
.wm b{font-size:44px;font-weight:800;color:var(--navy);letter-spacing:-.5px}
@keyframes wm{0%{opacity:0}3%{opacity:1}97%{opacity:1}100%{opacity:0}}
.bigLogo{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;background:var(--navy)}
.bigLogo .logoTile{width:260px;height:260px;border-radius:62px}
.bigLogo b{color:#fff;font-size:110px;font-weight:800;letter-spacing:-1px}
.brand{color:#fff;font-size:72px;font-weight:800;margin-top:24px;letter-spacing:-1px}

/* CTA */
.cta{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding-top:300px;text-align:center}
.logoTile{width:210px;height:210px;border-radius:50px;background:#fff;overflow:hidden}
.logoTile img{width:112%;height:112%;margin:-6%}
.ctaT{color:#fff;font-size:80px;font-weight:800;line-height:1.1;margin-top:60px}
.wa{margin-top:70px;display:flex;align-items:center;gap:26px;background:var(--wa);color:#fff;border-radius:999px;padding:30px 64px;font-size:62px;font-weight:800;
  box-shadow:0 20px 50px rgba(37,211,102,.35)}
.wa svg{width:78px;height:78px}
.num{margin-top:40px;color:#CBD5E1;font-size:56px;font-weight:700;direction:ltr;letter-spacing:1px}
.pulse{animation:fadeUp .7s var(--ease) calc(var(--s) + var(--o)) both, pulse 1.4s ease-in-out calc(var(--s) + var(--o) + .8s) infinite}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
"""

ICON_BOARD = """<svg viewBox="0 0 120 120"><rect x="10" y="18" width="100" height="70" rx="6" fill="#F8FAFC" stroke="#94A3B8" stroke-width="5"/>
<path d="M24 40 q10-10 20 0 t20 0 M24 58 h40 M70 36 l18 18 M88 36 l-18 18" stroke="#3B82F6" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M40 88 l-10 22 M80 88 l10 22" stroke="#94A3B8" stroke-width="5" stroke-linecap="round"/></svg>"""
ICON_CAL = """<svg viewBox="0 0 120 120"><rect x="14" y="22" width="92" height="84" rx="10" fill="#fff" stroke="#94A3B8" stroke-width="5"/>
<rect x="14" y="22" width="92" height="22" rx="10" fill="#60A5FA"/><path d="M38 12v20M82 12v20" stroke="#475569" stroke-width="6" stroke-linecap="round"/>
<g fill="#CBD5E1"><rect x="28" y="54" width="14" height="12" rx="2"/><rect x="53" y="54" width="14" height="12" rx="2"/><rect x="78" y="54" width="14" height="12" rx="2"/>
<rect x="28" y="76" width="14" height="12" rx="2"/><rect x="53" y="76" width="14" height="12" rx="2" fill="#F97316"/><rect x="78" y="76" width="14" height="12" rx="2"/></g></svg>"""
ICON_BOOK = """<svg viewBox="0 0 120 120"><rect x="26" y="12" width="74" height="96" rx="8" fill="#FDE68A" stroke="#B45309" stroke-width="5"/>
<g stroke="#92400E" stroke-width="5" stroke-linecap="round"><path d="M18 28h16M18 48h16M18 68h16M18 88h16"/></g>
<path d="M46 38h40M46 54h40M46 70h28" stroke="#B45309" stroke-width="4" stroke-linecap="round"/></svg>"""
ICON_WA = """<svg viewBox="0 0 32 32"><path fill="#fff" d="M16 3C9 3 3.3 8.6 3.3 15.6c0 2.3.6 4.5 1.8 6.4L3 29l7.2-1.9c1.8 1 3.8 1.5 5.8 1.5 7 0 12.7-5.7 12.7-12.6S23 3 16 3zm0 23.1c-1.9 0-3.7-.5-5.3-1.4l-.4-.2-4.3 1.1 1.1-4.2-.3-.4c-1-1.6-1.6-3.5-1.6-5.4C5.2 9.8 10 5.1 16 5.1s10.8 4.7 10.8 10.5S22 26.1 16 26.1zm5.9-7.8c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1c-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2s0-.5.1-.6l.5-.6c.2-.2.2-.4.3-.6s0-.4 0-.6-.7-1.7-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.2 1.1-1.2 2.7 1.2 3.1 1.4 3.3c.2.2 2.4 3.6 5.7 5 .8.3 1.4.5 1.9.7.8.3 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5s.3-1.4.2-1.5c-.1-.2-.3-.3-.6-.4z"/></svg>"""


def exists(name):
    return os.path.exists(os.path.join(HERE, "shots", name))


def first(*names):
    for n in names:
        if exists(n):
            return n
    return names[-1]


def img(name, w, x0, y0, x1, y1, pd, po=0.0, z0=1, z1=1, extra=""):
    return (f'<img class="pan" src="shots/{name}" style="width:{w}px;--x0:{x0}px;--y0:{y0}px;--x1:{x1}px;--y1:{y1}px;'
            f'--z0:{z0};--z1:{z1};--pd:{pd}s;--po:{po}s{extra}">')


def build_html():
    lens, st, lead, total, subs = timeline()
    d = [round(b - a, 2) for a, b in zip(st, st[1:] + [total])]
    v = [st[i] + lead[i] for i in range(len(st))]  # voice start per scene (abs)
    words = json.load(open(os.path.join(HERE, "vo", "words.json")))
    wt = lambda i, k: round(lead[i] + words[str(i)][k][1], 2)  # word time relative to scene start

    def scene(i, cls, inner):
        x = 0.35 if i < len(st) - 1 else 0
        return f'<section class="scene {cls}" style="--s:{st[i]}s;--d:{round(d[i] + x, 2)}s">\n{inner}\n</section>\n'

    out = []
    # 0 hook -> big Petra logo pops as the options are struck out
    o1, o2, o3 = wt(0, 5), wt(0, 7), wt(0, 9)
    so = round(d[0] - 0.95, 2)
    out.append(scene(0, "dark first", f"""
  <div class="hq fu" style="--o:.1s">עדיין מנהלים<br>את הפנסיון על...</div>
  <div class="opts">
    <div class="opt pop" style="--o:{o1}s">{ICON_BOARD}<b>לוח מחיק?</b><i class="strike" style="--o:{so}s"></i></div>
    <div class="opt pop" style="--o:{o2}s">{ICON_CAL}<b>יומן גוגל?</b><i class="strike" style="--o:{round(so + .12, 2)}s"></i></div>
    <div class="opt pop" style="--o:{o3}s">{ICON_BOOK}<b>מחברת?</b><i class="strike" style="--o:{round(so + .24, 2)}s"></i></div>
  </div>
  <div class="bigLogo pop" style="--o:{round(so + .45, 2)}s"><div class="logoTile"><img src="../../public/petra-logo.png"></div><b>Petra</b></div>"""))

    # 1 rooms: mobile counts + room card, then the full desktop room map
    rgrid = f'<div class="layer" style="--o:{wt(1, 7)}s;background:#fff">{img("rooms_desktop.jpg", 1760, -600, -190, -140, -190, d[1] - wt(1, 7), wt(1, 7))}</div>'
    rc = "rooms_cards_mobile.jpg" if exists("rooms_cards_mobile.jpg") else "rooms_mobile.jpg"
    out.append(scene(1, "light", f"""
  <div class="head"><div class="eyebrow fu" style="--o:.1s">מפת חדרים</div><div class="title fu" style="--o:.25s">חדר לכל כלב,<br>בגרירה אחת</div></div>
  <div class="card fu" style="--o:.2s">{img(rc, 960, 0, -300, 0, -1010, wt(1, 7), 0.4)}{rgrid}</div>"""))

    # 2 timeline
    out.append(scene(2, "light", f"""
  <div class="head"><div class="eyebrow fu" style="--o:.1s">ציר זמן · 30 ימים</div><div class="title fu" style="--o:.25s">כל החודש הקרוב<br>במבט אחד</div></div>
  <div class="card fu" style="--o:.2s">{img("timeline_desktop.jpg", 2100, -20, -452, -780, -452, d[2] - 0.5, 0.4)}</div>"""))

    # 3 yards + behaviour warning callout
    y1 = first("yards_drag_1.jpg", "yards_desktop.jpg", "rooms_desktop.jpg")
    y2 = first("yards_drag_2.jpg", y1)
    y3 = first("yards_drag_3.jpg", y2)
    warn = f'<div class="callout pop" style="--o:{wt(3, 7)}s;left:120px;top:900px;width:840px"><img src="shots/c_warning.png"></div>' if exists("c_warning.png") else ""
    out.append(scene(3, "light", f"""
  <div class="head"><div class="eyebrow fu" style="--o:.1s">שיבוץ לחצרות</div><div class="title fu" style="--o:.25s">גוררים כלב לחצר,<br>רואים מי מסתדר עם מי</div></div>
  <div class="card fu" style="--o:.2s">{img(y1, 1500, -470, -160, -470, -160, 1, 0)}
    <div class="layer" style="--o:{wt(3, 4)}s;background:#fff">{img(y2, 1500, -470, -160, -470, -160, 1, 0)}</div>
    <div class="layer" style="--o:{round(wt(3, 6) + .1, 2)}s;background:#fff">{img(y3, 1500, -470, -160, -470, -160, 1, 0)}</div></div>
  {warn}"""))

    # 4 feeding + meds
    f1 = first("daily_mobile.jpg", "feeding_mobile.jpg", "rooms_mobile.jpg")
    meds = f'<div class="layer" style="--o:{wt(4, 7)}s;background:#fff">{img("meds_mobile.jpg", 960, 0, -150, 0, -450, d[4] - wt(4, 7), wt(4, 7))}</div>' if exists("meds_mobile.jpg") else ""
    care = f'<div class="callout pop" style="--o:{wt(4, 10)}s;left:140px;top:560px;width:800px"><img src="shots/c_care_top.png"></div>' if exists("c_care_top.png") else ""
    out.append(scene(4, "light", f"""
  <div class="head"><div class="eyebrow fu" style="--o:.1s">האכלות ותרופות</div><div class="title fu" style="--o:.25s">לוח טיפול יומי<br>לכל כלב</div></div>
  <div class="card fu" style="--o:.2s">{img(f1, 960, 0, -150, 0, -560, d[4] - 0.6, 0.4)}{meds}</div>
  {care}"""))

    # 5 team / permissions
    staff = first("staff_menu_mobile.jpg", "staff_mobile.jpg", "rooms_mobile.jpg")
    perms = f'<div class="callout pop" style="--o:{wt(5, 11)}s;left:130px;top:520px;width:820px"><img src="shots/c_perms.png"></div>' if exists("c_perms.png") else ""
    out.append(scene(5, "light", f"""
  <div class="head"><div class="eyebrow fu" style="--o:.1s">הרשאות לצוות</div><div class="title fu" style="--o:.25s">כל עובד רואה<br>רק את מה שצריך</div></div>
  <div class="card fu" style="--o:.2s">{img(staff, 960, 0, 0, 0, -200, d[5] - 0.6, 0.5)}</div>
  {perms}"""))

    # 6 CTA
    out.append(scene(6, "dark last", f"""
  <div class="cta">
    <div class="logoTile pop" style="--o:.15s"><img src="../../public/petra-logo.png"></div>
    <div class="brand fu" style="--o:.35s">Petra</div>
    <div class="ctaT fu" style="--o:{wt(6, 0)}s">רוצים לראות איך<br>זה עובד אצלכם?</div>
    <div class="wa pulse" style="--o:{wt(6, 6)}s">{ICON_WA}דברו איתנו בוואטסאפ</div>
    <div class="num fu" style="--o:{round(wt(6, 6) + .4, 2)}s">054-256-0964</div>
  </div>"""))

    # persistent logo on every system screen
    out.append(f'<div class="wm" style="--ws:{st[1]}s;--wd:{round(st[-1] - st[1] + 0.2, 2)}s"><div class="logoTile"><img src="../../public/petra-logo.png"></div><b>Petra</b></div>\n')

    sub_html = []
    for a, b, txt in subs:
        on_dark = a < st[1] or a >= st[-1]
        if a >= st[-1]:
            continue  # the CTA screen already shows the words big
        sub_html.append(f'<div class="sub{" onDark" if on_dark else ""}" style="--ss:{a}s;--sd:{round(b - a, 2)}s"><span>{txt}</span></div>')

    html = f"""<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&display=block" rel="stylesheet">
<style>{CSS}</style></head><body>
{''.join(out)}
{chr(10).join(sub_html)}
<script>
window.renderAt = function (t) {{ for (const a of document.getAnimations()) {{ a.pause(); a.currentTime = t * 1000; }} }};
window.TOTAL = {total};
</script></body></html>"""
    open(os.path.join(HERE, "reel.html"), "w", encoding="utf-8").write(html)
    json.dump({"starts": st, "lead": lead, "lens": lens, "total": total}, open(os.path.join(HERE, "vo", "reel_timing.json"), "w"), indent=1)
    print(f"reel.html: {total}s, scenes at {st}")


async def render(mode, args):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
        pg = await b.new_page(viewport={"width": W, "height": H})
        await pg.goto("file://" + os.path.join(HERE, "reel.html"))
        await pg.wait_for_load_state("networkidle")
        await pg.evaluate("document.fonts.ready")
        if mode == "stills":
            for t in args:
                await pg.evaluate(f"renderAt({t})")
                await pg.screenshot(path=os.path.join(HERE, f"still_{t}.png"))
        else:
            total = args[1] if len(args) > 1 and args[1] else await pg.evaluate("TOTAL")
            proc = subprocess.Popen([FF, "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", str(FPS), "-i", "-",
                                     "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium",
                                     "-movflags", "+faststart", args[0]], stdin=subprocess.PIPE)
            for i in range(int(total * FPS)):
                await pg.evaluate(f"renderAt({i / FPS})")
                proc.stdin.write(await pg.screenshot(type="jpeg", quality=92))
            proc.stdin.close()
            proc.wait()
        await b.close()


def video(upto=None):
    """upto: render only the first N seconds (preview -> reel-preview.mp4)."""
    t = json.load(open(os.path.join(HERE, "vo", "reel_timing.json")))
    silent = os.path.join(HERE, "reel-silent.mp4")
    asyncio.run(render("video", [silent, upto]))
    total = upto or t["total"]
    ins, chains, labels = [], [], []
    for i, (s, ld) in enumerate(zip(t["starts"], t["lead"])):
        ins += ["-i", os.path.join(HERE, "vo", f"{i:02d}.wav")]
        ms = int((s + ld) * 1000)
        chains.append(f"[{i + 1}:a]aresample=48000,adelay={ms}|{ms}[a{i}]")
        labels.append(f"[a{i}]")
    n = len(labels)
    music = os.path.join(HERE, "music-gemini.mp3")
    off = round(MUSIC_STOP - t["starts"][-1], 2)  # music t = reel t + off
    fade_at = min(total, MUSIC_END - off) - 1.2
    graph = (";".join(chains) + ";" + "".join(labels) + f"amix=inputs={n}:normalize=0,"
             "highpass=f=90,acompressor=threshold=-22dB:ratio=3:attack=5:release=120:makeup=2,"
             "equalizer=f=3200:t=q:w=1.2:g=3,pan=stereo|c0=c0|c1=c0,apad[v];"
             f"[{n + 1}:a]aresample=48000,atrim={off}:{off + total},asetpts=PTS-STARTPTS,"
             f"volume={MUSIC_GAIN}dB,equalizer=f=2500:t=q:w=1:g=-3,afade=t=out:st={fade_at}:d=1.2[m];"
             "[v][m]amix=inputs=2:normalize=0:duration=shortest,volume=0dB,alimiter=limit=0.89,"
             f"aresample=48000,apad=whole_dur={total}[aout]")
    out = os.path.join(HERE, "reel-preview.mp4" if upto else "reel-boarding.mp4")
    subprocess.run([FF, "-loglevel", "error", "-y", "-i", silent, *ins, "-i", music, "-filter_complex", graph,
                    "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", str(total),
                    "-movflags", "+faststart", out], check=True)
    os.remove(silent)
    print("wrote", os.path.basename(out))


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "html":
        build_html()
    elif cmd == "stills":
        asyncio.run(render("stills", sys.argv[2:]))
    elif cmd == "video":
        video()
    elif cmd == "preview":          # python3 build.py preview 17.6
        video(float(sys.argv[2]))
