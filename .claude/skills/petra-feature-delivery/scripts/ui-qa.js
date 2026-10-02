// UI QA: log in as owner, visit every business-admin tab desktop+mobile, screenshot, collect console errors + overflow.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const B = process.argv[2] || 'http://localhost:3000', OUT = __dirname + '/shots';
const TABS = ['סקירה','פעילות','פעילות AI','צוות','סשנים','התראות אבטחה','בריאות נתונים'];
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  let problems = [];
  for (const vp of [{ name: 'desktop', width: 1400, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'he-IL' });
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
    page.on('pageerror', e => errs.push('PAGEERROR ' + e.message.slice(0, 200)));
    page.on('response', r => { if (r.url().includes('/api/business-admin') && r.status() >= 400) errs.push(`HTTP ${r.status()} ${r.url()}`); });
    await page.goto(B + '/login', { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(4000); // let React hydrate (dev compile is slow)
    await page.locator('input[type=email]').pressSequentially(process.env.QA_EMAIL || 'owner@petra.local', { delay: 20 });
    await page.locator('input[type=password]').pressSequentially(process.env.QA_PASSWORD || 'Admin1234!', { delay: 20 });
    await page.waitForSelector('button[type=submit]:not([disabled])', { timeout: 30000 });
    await page.click('button[type=submit]');
    await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 60000 });
    await page.goto(B + '/business-admin', { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(3000);
    for (const t of TABS) {
      const btn = page.getByRole('button', { name: t, exact: true }).first();
      await btn.click({ timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 60000 });
      await page.waitForTimeout(1200);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 2) problems.push(`${vp.name}/${t}: horizontal overflow ${overflow}px`);
      await page.screenshot({ path: `${OUT}/${vp.name}-${TABS.indexOf(t)}.png`, fullPage: true });
    }
    errs.forEach(e => problems.push(`${vp.name}: ${e}`));
    await ctx.close();
  }
  await browser.close();
  console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'UI OK — no console errors, no overflow');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
