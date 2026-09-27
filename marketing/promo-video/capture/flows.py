import asyncio, sys
from playwright.async_api import async_playwright
CH="/opt/pw-browsers/chromium-1194/chrome-linux/chrome"; BASE="http://localhost:3000"
FIX=open("shoot.py").read().split('FIX="""')[1].split('"""')[0]
async def mobile(p):
    b=await p.chromium.launch(executable_path=CH)
    ctx=await b.new_context(viewport={"width":390,"height":844},device_scale_factor=3,locale="he-IL",timezone_id="Asia/Jerusalem",service_workers="block",bypass_csp=True,is_mobile=True,has_touch=True)
    await ctx.add_init_script("""for (const C of [Map, WeakMap]) { if (!C.prototype.getOrInsertComputed) { C.prototype.getOrInsertComputed = function(k,f){ if(!this.has(k)) this.set(k,f(k)); return this.get(k); }; C.prototype.getOrInsert = function(k,v){ if(!this.has(k)) this.set(k,v); return this.get(k); }; } }""")
    import os
    async def pub(r):
        path="/home/user/petra-app/public"+r.request.url.split("localhost:3000")[1].split("?")[0]
        if os.path.isfile(path): await r.fulfill(status=200, body=open(path,"rb").read())
        else: await r.continue_()
    await ctx.route("**/cmaps/**", pub); await ctx.route("**/standard_fonts/**", pub)
    return b, await ctx.new_page()
async def snap(pg,name,w=1.2):
    await pg.wait_for_timeout(w*1000); await pg.evaluate(FIX); await pg.wait_for_timeout(300)
    await pg.screenshot(path=f"shots/{name}.png"); print("shot",name)
async def book(p):
    b,pg=await mobile(p)
    await pg.goto(BASE+"/book/kelev-vechaver",timeout=180000)
    await pg.wait_for_function("document.querySelectorAll('.petra-loader-toe').length===0",timeout=150000)
    await snap(pg,"book1",3)
    await pg.get_by_text("שיעור אילוף פרטי").first.click(); await snap(pg,"book2",2)
    # pick a future open day: click day buttons until time step
    await pg.get_by_role("button",name="29",exact=True).first.click(); await snap(pg,"book3",3)
    await pg.mouse.move(5,5); await snap(pg,"book3",0.5)
    await pg.get_by_role("button",name="10:00").first.click(); await snap(pg,"book4",2)
    inp=pg.locator('input[placeholder="050-0000000"]'); await inp.click(); await inp.type("0521234505",delay=60)
    await pg.keyboard.press("Tab"); await snap(pg,"book5",3)
    async def tryclick(txt):
        try: await pg.get_by_role("button",name=txt).first.click(timeout=8000); return True
        except Exception as e: print("noclick",txt); return False
    await tryclick("המשך"); await snap(pg,"book6",3)
    try: await pg.get_by_text("בל",exact=True).first.click(timeout=5000)
    except Exception: print("no dog pick")
    await snap(pg,"book7",1)
    await tryclick("המשך לאישור"); await snap(pg,"book8",2)
    await tryclick("אשר הזמנה"); await snap(pg,"book9",4)
    await b.close()
async def sign(p):
    b,pg=await mobile(p)
    pdf=open("contract.pdf","rb").read()
    await pg.route("**/api/sign/*/pdf", lambda r: r.fulfill(status=200, body=pdf, headers={"content-type":"application/pdf"}))
    async def post(r):
        if r.request.method=="POST": await r.fulfill(status=200, json={"ok":True,"signedFileUrl":"https://x.public.blob.vercel-storage.com/s.pdf"})
        else: await r.continue_()
    await pg.route("**/api/sign/promo-sign-live", post)
    wk=open("/home/user/petra-app/public/pdf.worker.min.mjs","rb").read()
    await pg.route("**/pdf.worker.min.mjs", lambda r: r.fulfill(status=200, body=wk, headers={"content-type":"text/javascript"}))
    await pg.goto(BASE+"/sign/promo-sign-live",timeout=180000)
    await pg.wait_for_function("document.querySelectorAll('.petra-loader-toe').length===0",timeout=150000)
    await snap(pg,"sign1",4)
    await pg.mouse.wheel(0,700); await snap(pg,"sign2",1.5)
    await pg.get_by_text("קראתי את החוזה").first.click(); await pg.wait_for_timeout(1500)
    cv=pg.locator("canvas").last; await cv.scroll_into_view_if_needed(); await pg.wait_for_timeout(800)
    bb=await cv.bounding_box(); import math
    x0,y0,w,h=bb["x"],bb["y"],bb["width"],bb["height"]
    def P(t): return (0.84-0.62*t+0.05*math.cos(t*21), 0.50-0.2*math.sin(t*21)*(0.55+0.45*abs(math.sin(t*4.2)))+0.06*t)
    await pg.mouse.move(x0+w*P(0)[0],y0+h*P(0)[1]); await pg.mouse.down()
    for k in range(1,241):
        x,y=P(k/240); await pg.mouse.move(x0+w*x,y0+h*y)
    await pg.mouse.up()
    await pg.mouse.move(x0+w*0.70,y0+h*0.80); await pg.mouse.down()
    for k in range(1,61):
        t=k/60; await pg.mouse.move(x0+w*(0.70-0.5*t), y0+h*(0.80-0.10*math.sin(t*math.pi)+0.02*t))
    await pg.mouse.up()
    await pg.locator("input[type=checkbox]").last.check(); await snap(pg,"sign3",1)
    await pg.get_by_text("שלח חתימה ואשר").first.click(); await snap(pg,"sign4",2.5)
    await b.close()
async def desk(p):
    b=await p.chromium.launch(executable_path=CH)
    ctx=await b.new_context(viewport={"width":1280,"height":800},device_scale_factor=2.5,locale="he-IL",timezone_id="Asia/Jerusalem",service_workers="block",bypass_csp=True,storage_state="state.json")
    pg=await ctx.new_page()
    async def go(path):
        await pg.goto(BASE+path,timeout=180000); await pg.wait_for_timeout(1500)
        await pg.wait_for_function("document.querySelectorAll('.petra-loader-toe').length===0",timeout=150000)
    for path,name in [("/dashboard","dash"),("/boarding","boarding"),("/boarding/daily","daily"),("/settings?tab=ai-agents","ai"),("/help/connect-ai","connectai"),("/scheduler","scheduler"),("/scheduled-messages","messages")]:
        await go(path); await snap(pg,name,3)
    await go("/settings"); 
    try: await pg.get_by_role("button",name="אינטגרציות").first.click(); await snap(pg,"integrations",3)
    except Exception as e: print("integ",e)
    await go("/customers/promo-c0"); await snap(pg,"customer",3)
    await pg.get_by_text("שלח לחתימה").first.scroll_into_view_if_needed(); await pg.mouse.wheel(0,250); await snap(pg,"customer_contracts",1.5)
    await pg.get_by_text("שלח לחתימה").first.click(); await pg.wait_for_timeout(800)
    try:
        await pg.locator("select").first.select_option(label="הסכם פנסיון ואילוף")
        await pg.locator("select").nth(1).select_option(label="רקס")
    except Exception as e: print("modal select",e)
    await snap(pg,"contract_modal",1)
    await b.close()
async def daily(p):
    b=await p.chromium.launch(executable_path=CH)
    ctx=await b.new_context(viewport={"width":1280,"height":800},device_scale_factor=2.5,locale="he-IL",timezone_id="Asia/Jerusalem",service_workers="block",bypass_csp=True,storage_state="state.json")
    pg=await ctx.new_page()
    await pg.goto(BASE+"/boarding/daily",timeout=180000); await pg.wait_for_timeout(1500)
    await pg.wait_for_function("document.querySelectorAll('.petra-loader-toe').length===0",timeout=150000)
    await pg.wait_for_timeout(2000)
    btns=pg.get_by_role("button",name="08:00")
    n=await btns.count(); print("08 buttons",n)
    for i in range(0):
        try: await btns.nth(i).click(timeout=4000); await pg.wait_for_timeout(700)
        except Exception as e: print("x",i)
    await pg.evaluate("document.querySelectorAll('*').forEach(e=>{if(e.scrollTop>0)e.scrollTop=0}); window.scrollTo(0,0)"); await pg.mouse.move(5,500); await snap(pg,"daily",2.5)
    await b.close()
async def main():
    async with async_playwright() as p:
        for f in sys.argv[1:]: await globals()[f](p)
asyncio.run(main())
