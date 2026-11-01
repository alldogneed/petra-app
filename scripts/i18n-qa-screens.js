#!/usr/bin/env node
/**
 * i18n QA screenshots (docs/us-expansion PROGRESS "QA" column).
 *
 *   node scripts/i18n-qa-screens.js --base http://localhost:3000 --out docs/us-expansion/qa/phase0/after \
 *        --pages /tasks,/dashboard [--email owner@petra.local --password Admin1234!] [--mobile-only|--desktop-only]
 *
 * Logs in through the form, freezes the clock (2026-10-31 10:00 Israel) so
 * relative dates match between runs, kills animations, waits for the network
 * to go idle and the PetraLoader to disappear, then saves
 * <out>/<slug>-desktop.png (1440×900) and <out>/<slug>-mobile.png (390×844).
 * Console errors are written to <out>/console.json.
 * Pair with scripts/i18n-qa-diff.py for the pixel comparison.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i === -1 ? d : argv[i + 1];
};
const BASE = arg("base", "http://localhost:3000");
const OUT = arg("out", "qa-out");
const PAGES = arg("pages", "/dashboard").split(",").filter(Boolean);
const EMAIL = arg("email", "owner@petra.local");
const PASSWORD = arg("password", "Admin1234!");
const FIXED = new Date(arg("time", "2026-10-31T08:00:00Z"));
const VIEWPORTS = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
].filter(([n]) => !(argv.includes("--mobile-only") && n === "desktop") && !(argv.includes("--desktop-only") && n === "mobile"));

const slug = (p) => (p.replace(/^\//, "").replace(/[/?=&]+/g, "_") || "root");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const consoleErrors = {};
  for (const [vpName, viewport] of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      extraHTTPHeaders: { "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    await page.clock.install({ time: FIXED });
    page.on("console", (m) => {
      if (m.type() === "error") (consoleErrors[`${vpName} ${page.url()}`] ||= []).push(m.text().slice(0, 300));
    });
    // login (skip with --no-login for public pages)
    if (!argv.includes("--no-login")) {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }).catch(() => null),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForLoadState("networkidle").catch(() => null);
    }
    for (const p of PAGES) {
      await page.goto(`${BASE}${p}`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => null);
      await page.addStyleTag({
        content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important} [data-petra-loader]{display:none!important}",
      }).catch(() => null);
      await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 15000 }).catch(() => null);
      await page.waitForTimeout(1200);
      const file = path.join(OUT, `${slug(p)}-${vpName}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`${file}  ${page.url().replace(BASE, "")}`);
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "console.json"), JSON.stringify(consoleErrors, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
