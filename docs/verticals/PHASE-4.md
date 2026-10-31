# שלב 4 — `{slug}.petra.app`

Commit: `feat(verticals): phase 4 — tenant subdomains`

## 4.1 middleware
- [x] `src/lib/verticals/tenant-host.ts` (pure, edge-safe): `tenantSlugFromHost(host, rootDomain)` →
      slug או null (מתעלם מ-`www`, `app`, `api`, תת-תת-דומיין, פורט; slug לפי אותו regex של `generateBusinessSlug`).
- [x] `middleware.ts`: כש-`TENANT_ROOT_DOMAIN` מוגדר ויש slug:
      `/` → rewrite ל-`/book/{slug}` (ציבורי); כל השאר כרגיל (login, dashboard, `/book/...`).
      header `x-petra-tenant-slug` לשימוש עמודים.
- [x] בלי `TENANT_ROOT_DOMAIN` — אפס שינוי (בדיקת יחידה).

## 4.2 עוגיות
- [x] `sessionCookieDomain(host)` — מחזיר `SESSION_COOKIE_DOMAIN` רק אם ה-host מסתיים בו; אחרת undefined (host-only כמו היום).
- [x] כל `Set-Cookie` של `petra_session` / `petra_rm` (login, logout, google callback, middleware rolling) משתמש בו.

## 4.3 היקף
- [x] ה-middleware רץ ב-edge ולא ניגש ל-DB, לכן ה-rewrite חל על כל slug. עסק dogs לא מושפע: הכתובת
      החדשה פשוט לא קיימת עבורו בשום מקום בממשק (מוצגת בהגדרות רק ל-generic), ו-`petra-app.com` לא משתנה.

## 4.4 הגדרות
- [x] Settings → פרטי העסק (generic): מציג את הכתובת `https://{slug}.{root}` כשהפיצ'ר פעיל
      (`NEXT_PUBLIC_TENANT_ROOT_DOMAIN`).

## מה להגדיר ידנית (Vercel / DNS)
1. Vercel → Project → Domains: להוסיף `petra.app` ו-`*.petra.app` (wildcard דורש nameservers של Vercel
   או CNAME `*` → `cname.vercel-dns.com` + אימות TXT).
2. Env (Production): `TENANT_ROOT_DOMAIN=petra.app`, `NEXT_PUBLIC_TENANT_ROOT_DOMAIN=petra.app`,
   `SESSION_COOKIE_DOMAIN=.petra.app` (אופציונלי — רק אם רוצים login אחד לכל התת-דומיינים).
3. Google OAuth: להוסיף `https://petra.app/api/auth/google/callback` (וכל host שממנו מתחברים) ל-redirect URIs.
4. CSP / `next.config.mjs` — אין צורך (אותו origin לכל host).

## קריטריוני קבלה
- ✅ `tsc` נקי, `prisma validate` ×2 (אין שינוי סכמה).
- ✅ `tenant-host.test.ts` (15): www / app / api / apex / תת-תת-דומיין / פורט / uppercase / נקודה בסוף / דומיין אחר / slug עברי → null;
  בלי `TENANT_ROOT_DOMAIN` → null (אפס שינוי); `sessionCookieDomain` רק על hosts תחת הדומיין.
- ✅ בדיקה חיה (build עם `TENANT_ROOT_DOMAIN=petra.test`): `Host: <slug>.petra.test /` → "Gen Studio — קביעת תור אונליין";
  `localhost` / `www.petra.test` → דף הנחיתה כרגיל; login מתת-דומיין → `Domain=.petra.test`, מ-`localhost` → בלי Domain (כמו היום).
- ✅ דפדפן (Chromium עם host-resolver): `http://<slug>.petra.test:3000/` — דף הזמנות ממותג, 5 שלבים בלי "כלבים", בלי "Petra"; ההגדרות מציגות את הכתובת.
- ℹ️ מגבלה: רק slug באותיות לטיניות / ספרות / מקף יכול להיות תת-דומיין (`generateBusinessSlug` משאיר אותיות עבריות) — לעסק כזה הכתובת לא מוצגת,
  ו-`/book/<slug>` בדומיין הראשי ממשיך לעבוד. אם רוצים כתובת לכולם — שדה slug לטיני נפרד (לא בתכולה).

## מה להגדיר ידנית — סיכום
- Vercel → Domains: `petra.app` + `*.petra.app` (wildcard דורש DNS אצל Vercel או CNAME `*` → `cname.vercel-dns.com` + TXT).
- Env (Production + Preview לפי הצורך): `TENANT_ROOT_DOMAIN=petra.app`, `NEXT_PUBLIC_TENANT_ROOT_DOMAIN=petra.app` (נבנה ל-client → דורש redeploy),
  `SESSION_COOKIE_DOMAIN=.petra.app` (רק אם רוצים login אחד לכל התת-דומיינים; בלי — כל תת-דומיין עם login משלו).
- Google OAuth: ה-callback עדיין חוזר ל-`NEXT_PUBLIC_APP_URL` (הדומיין הראשי) — אין צורך ב-redirect URI חדש; כניסה עם Google מתת-דומיין תסתיים בדומיין הראשי.
