# Boarding reel screenshots. Usage: python3 shoot_boarding.py [shot names...]  (no args = all)
# Needs the app on http://localhost:3000 seeded with promo-seed.js + promo-seed-boarding.js.
import asyncio, sys, os, random
from playwright.async_api import async_playwright

CH = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
BASE = "http://localhost:3000"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shots")
OWNER = ("owner@petra.local", "Admin1234!")
STAFF = ("dana@petra.local", "Staff1234!")
CSS = """nextjs-portal{display:none!important} [data-sonner-toaster]{display:none!important}
button[aria-label="מרכז עזרה"]{display:none!important}
div.translate-x-full, div.translate-x-full *{box-shadow:none!important}
*{scrollbar-width:none!important} ::-webkit-scrollbar{display:none!important}"""
FIX = """(css)=>{
document.querySelectorAll('img').forEach(i=>{ if(i.src.includes('/_next/image')){const u=new URL(i.src).searchParams.get('url'); if(u){i.removeAttribute('srcset'); i.src=u;}}});
if(!document.getElementById('promo-css')){const st=document.createElement('style');st.id='promo-css';st.textContent=css;document.head.appendChild(st);}
}"""


STATE = {}


async def ctx_for(b, mobile, who):
    common = dict(locale="he-IL", timezone_id="Asia/Jerusalem", service_workers="block", bypass_csp=True, storage_state=STATE.get(who[0]))
    if mobile:
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True, **common)
    else:
        ctx = await b.new_context(viewport={"width": 1600, "height": 1000}, device_scale_factor=2, **common)
    if who[0] not in STATE:  # log in once per user (login is rate-limited)
        r = await ctx.request.post(BASE + "/api/auth/login", data={"email": who[0], "password": who[1]},
                                   headers={"x-forwarded-for": f"10.9.{random.randint(0,255)}.{random.randint(1,254)}"})  # local limiter key
        assert r.status == 200, r.status
        STATE[who[0]] = await ctx.storage_state()
    return ctx, await ctx.new_page()


async def settle(pg, wait=2.5):
    await pg.wait_for_timeout(1200)
    try:
        await pg.wait_for_function("document.querySelectorAll('.petra-loader-toe').length===0", timeout=150000)
    except Exception:
        print("loader still visible")
    await pg.evaluate(FIX, CSS)
    await pg.wait_for_timeout(wait * 1000)


async def go(pg, path, wait=2.5):
    await pg.goto(BASE + path, timeout=180000)
    await settle(pg, wait)


async def snap(pg, name):
    await pg.evaluate(FIX, CSS)
    await pg.screenshot(path=f"{OUT}/{name}.jpg", type="jpeg", quality=90)
    print("shot", name)


async def view(pg, label):
    await pg.get_by_role("button", name=label).first.click()
    await settle(pg, 2)


async def today_only(pg, to_offset=0):
    # room map defaults to a 7-day window; narrow it to today
    import datetime
    t = (datetime.date.today() + datetime.timedelta(days=to_offset)).isoformat()
    inp = pg.locator("input[type=date]")
    await inp.nth(1).fill(t)
    await pg.get_by_role("button", name="הצג", exact=True).first.click()
    await settle(pg, 2)


async def scroll_to(pg, text, off=0):
    await pg.evaluate("""([t,off])=>{const el=[...document.querySelectorAll('h1,h2,h3,span,div,p')].find(e=>e.children.length<3&&e.offsetParent!==null&&e.textContent.trim()===t);
      if(el){const y=el.getBoundingClientRect().top+window.scrollY+off; const sc=document.querySelector('main')||document.scrollingElement; window.scrollTo(0,y); if(sc&&sc!==document.scrollingElement){sc.scrollTop+=el.getBoundingClientRect().top+off;}}}""", [text, off])
    await pg.wait_for_timeout(600)


# ── shots ──────────────────────────────────────────────────────────────────
async def rooms(b):
    for mobile in (False, True):
        ctx, pg = await ctx_for(b, mobile, OWNER)
        await go(pg, "/boarding", 3)
        await today_only(pg)
        if mobile:
            await scroll_to(pg, "מפת חדרים", 44)
        await snap(pg, "rooms_mobile" if mobile else "rooms_desktop")
        await ctx.close()


async def timeline(b):
    ctx, pg = await ctx_for(b, False, OWNER)
    await go(pg, "/boarding", 2)
    await view(pg, "ציר זמן")
    await pg.get_by_role("button", name="30 ימים").first.click()
    await settle(pg, 2)
    await pg.mouse.move(5, 5)
    await snap(pg, "timeline_desktop")
    await pg.locator('button[title="שבוע קדימה"]').first.click()
    await settle(pg, 2)
    await pg.mouse.move(5, 5)
    await snap(pg, "timeline_desktop_next")
    await view(pg, "זמינות")
    await pg.mouse.move(5, 5)
    await snap(pg, "availability_desktop_thismonth")
    # next month = fully booked future -> main availability shot
    await pg.locator('button[aria-label="חודש הבא"]').first.click()
    await pg.wait_for_timeout(1500)
    await pg.mouse.move(5, 5)
    await snap(pg, "availability_desktop")
    await ctx.close()


async def yards(b):
    ctx, pg = await ctx_for(b, True, OWNER)
    await go(pg, "/boarding/yards", 3)
    await snap(pg, "yards_mobile")
    await ctx.close()
    ctx, pg = await ctx_for(b, False, OWNER)
    await go(pg, "/boarding/yards", 3)
    await snap(pg, "yards_desktop")
    await snap(pg, "yards_drag_1")
    # drag the first waiting dog into "חצר משחקים"
    src = pg.locator("[aria-roledescription='draggable']").first
    sb = await src.bounding_box()
    tgt = pg.get_by_text("חצר קטנים", exact=True).first
    tb = await tgt.bounding_box()
    sx, sy = sb["x"] + sb["width"] / 2, sb["y"] + sb["height"] / 2
    tx, ty = tb["x"] + tb["width"] / 2, tb["y"] + 90
    await pg.mouse.move(sx, sy)
    await pg.mouse.down()
    for i in range(1, 25):
        await pg.mouse.move(sx + (tx - sx) * i / 24, sy + (ty - sy) * i / 24)
        await pg.wait_for_timeout(25)
    await pg.wait_for_timeout(400)
    await snap(pg, "yards_drag_2")
    await pg.mouse.up()
    await settle(pg, 2.5)
    await snap(pg, "yards_drag_3")
    await ctx.close()


async def warning(b):
    ctx, pg = await ctx_for(b, False, OWNER)
    await go(pg, "/boarding", 2)
    # open check-in dialog for זאוס (arrives today, has behaviour flags)
    btn = pg.locator("button:has-text('צ׳ק-אין')")
    card = pg.locator("div").filter(has_text="זאוס").filter(has=btn).last
    await card.locator("button:has-text('צ׳ק-אין')").first.click()
    await pg.wait_for_timeout(1200)
    await snap(pg, "stay_warning")
    el = pg.locator(".modal-content").last
    await el.screenshot(path=f"{OUT}/c_warning.png")
    print("shot c_warning")
    await ctx.close()


async def team(b):
    ctx, pg = await ctx_for(b, False, OWNER)
    await go(pg, "/settings", 2)
    await pg.get_by_role("button", name="ניהול צוות").first.click()
    await settle(pg, 2)
    await snap(pg, "team_desktop")
    row = pg.locator("div.card, div").filter(has_text="דנה לוי").filter(has=pg.get_by_role("button", name="הרשאות")).last
    await row.get_by_role("button", name="הרשאות").click()
    await pg.wait_for_timeout(1000)
    await row.scroll_into_view_if_needed()
    await pg.mouse.move(5, 5)
    await snap(pg, "perms_modal")
    await row.screenshot(path=f"{OUT}/c_perms.png")
    print("shot c_perms")
    await ctx.close()


async def staff(b):
    ctx, pg = await ctx_for(b, False, STAFF)
    await go(pg, "/boarding", 3)
    await snap(pg, "staff_desktop")
    await ctx.close()
    ctx, pg = await ctx_for(b, True, STAFF)
    await go(pg, "/boarding", 3)
    await snap(pg, "staff_mobile")
    opener = pg.locator("button[aria-label*='תפריט'], button[aria-label*='menu' i]").first
    await opener.click()
    await pg.wait_for_timeout(1200)
    await snap(pg, "staff_menu_mobile")
    await ctx.close()


def care_mode(mode):
    import subprocess
    env = dict(os.environ)
    subprocess.run(["node", os.path.join(os.path.dirname(os.path.abspath(__file__)), "promo-seed-care.js"), mode], check=True, env=env)


async def care(b):
    care_mode("daily")
    for mobile in (False, True):
        ctx, pg = await ctx_for(b, mobile, OWNER)
        await go(pg, "/boarding/daily", 3)
        await pg.mouse.move(5, 5)
        await snap(pg, "daily_mobile" if mobile else "daily_desktop")
        if not mobile:
            card = pg.locator(".card").filter(has_text="תוסף מפרקים").first
            await card.screenshot(path=f"{OUT}/c_care.png")
            print("shot c_care")
        await ctx.close()
    care_mode("feeding")
    for mobile in (False, True):
        ctx, pg = await ctx_for(b, mobile, OWNER)
        await go(pg, "/feeding", 3)
        await pg.mouse.move(5, 5)
        await snap(pg, "feeding_mobile" if mobile else "feeding_desktop")
        await go(pg, "/medications", 3)
        await pg.mouse.move(5, 5)
        await snap(pg, "meds_mobile" if mobile else "meds_desktop")
        await ctx.close()
    care_mode("daily")


async def rooms_cards(b):
    ctx, pg = await ctx_for(b, True, OWNER)
    await go(pg, "/boarding", 3)
    await today_only(pg)
    await scroll_to(pg, "מפת חדרים", 44)
    await pg.mouse.wheel(0, 0)
    y = await pg.evaluate("""()=>{const h=[...document.querySelectorAll('span,div,h3')].find(e=>e.offsetParent!==null&&e.children.length===0&&e.textContent.trim()==='חדר א1');
      let c=h; while(c&&!(c.className||'').toString().includes('card')) c=c.parentElement; return (c||h).getBoundingClientRect().top}""")
    await pg.evaluate(f"window.scrollBy(0,{y}-78)")
    await pg.wait_for_timeout(700)
    await snap(pg, "rooms_cards_mobile")
    await ctx.close()


SHOTS = {"care": care, "rooms_cards": rooms_cards, "rooms": rooms, "timeline": timeline, "yards": yards, "warning": warning, "team": team, "staff": staff}


async def main():
    names = sys.argv[1:] or list(SHOTS)
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CH)
        for n in names:
            try:
                await SHOTS[n](b)
            except Exception as e:
                print("FAILED", n, repr(e)[:400])
        await b.close()

asyncio.run(main())
