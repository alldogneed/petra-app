import sys, subprocess, asyncio
from playwright.async_api import async_playwright
FF="/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2"
async def main():
    mode=sys.argv[1]
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
        pg=await b.new_page(viewport={"width":1920,"height":1080})
        import os; await pg.goto("file://"+os.path.join(os.path.dirname(os.path.abspath(__file__)),"promo.html")); await pg.wait_for_load_state("networkidle")
        await pg.evaluate("document.fonts.ready")
        if mode=="stills":
            for t in sys.argv[2:]:
                await pg.evaluate(f"renderAt({t})"); await pg.screenshot(path=f"still_{t}.png")
        else:
            fps=30; total=await pg.evaluate("TOTAL"); out=sys.argv[2]
            proc=subprocess.Popen([FF,"-loglevel","error","-y","-f","image2pipe","-framerate",str(fps),"-i","-","-c:v","libx264","-pix_fmt","yuv420p","-crf","18","-preset","medium","-movflags","+faststart",out],stdin=subprocess.PIPE)
            for i in range(int(total*fps)):
                await pg.evaluate(f"renderAt({i/fps})")
                proc.stdin.write(await pg.screenshot(type="jpeg",quality=95))
                if i%300==0: print(i,flush=True)
            proc.stdin.close(); proc.wait()
        await b.close()
asyncio.run(main())
