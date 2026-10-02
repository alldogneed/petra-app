import sys, asyncio, os
from playwright.async_api import async_playwright
CH="/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
BASE="http://localhost:3000"
FIX="""
document.querySelectorAll('img').forEach(i=>{ if(i.src.includes('/_next/image')){const u=new URL(i.src).searchParams.get('url'); if(u){i.removeAttribute('srcset'); i.src=u;}}});
if(!document.getElementById('promo-css')){const st=document.createElement('style');st.id='promo-css';st.textContent='nextjs-portal{display:none!important}';document.head.appendChild(st);}
"""
async def settle(pg, wait):
    await pg.wait_for_timeout(1500)
    try: await pg.wait_for_function("document.querySelectorAll('.petra-loader-toe').length===0", timeout=150000)
    except Exception as e: print("loader still visible")
    await pg.evaluate(FIX); await pg.wait_for_timeout(wait*1000)
async def main():
    # usage: shoot.py path1=name1 path2=name2 ...  [--w=1600 --h=1000]
    args=[a for a in sys.argv[1:] if not a.startswith("--")]
    opts=dict(a[2:].split("=") for a in sys.argv[1:] if a.startswith("--"))
    w=int(opts.get("w",1600)); h=int(opts.get("h",1000)); wait=float(opts.get("wait",6))
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=CH)
        st="state.json" if os.path.exists("state.json") and "login" not in opts else None
        ctx=await b.new_context(viewport={"width":w,"height":h},device_scale_factor=2,locale="he-IL",timezone_id="Asia/Jerusalem",service_workers="block",bypass_csp=True,storage_state=st)
        pg=await ctx.new_page()
        if not st:
            r=await ctx.request.post(BASE+"/api/auth/login",data={"email":opts.get("email","owner@petra.local"),"password":"Admin1234!"}); print(r.status)
            await ctx.storage_state(path="state.json"); print("logged in ->", pg.url)
        for a in args:
            path,name=a.split("=")
            await pg.goto(BASE+path, timeout=180000)
            await settle(pg, wait)
            await pg.screenshot(path=f"shots/{name}.png"); print(name, pg.url)
        await b.close()
asyncio.run(main())
