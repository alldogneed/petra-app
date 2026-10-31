# שלב 0 — דוח סיום (31.10.2026)

## מה נעשה
| סעיף | תוצאה |
|---|---|
| 0.1 | `next-intl@3.26.5` + `libphonenumber-js@1.13.15`. postcss לא נגע (8.4.47). |
| 0.2 | `Business.locale/country/currency/messagingChannel/billingProvider` (defaults ישראליים) + `prisma/us_expansion_phase0.sql` (additive, idempotent — **לא הורץ ב‑prod**). `schema.production.prisma` מסונכרן. `src/lib/locale.ts`. `getCurrentUser()` חושף `businessLocale/Country/Currency/Timezone` (בלי `platformRole`). |
| 0.3 | next-intl בלי routing: `src/i18n/request.ts` + `resolve-locale.ts` (עסק מהסשן → cookie `NEXT_LOCALE` בדפים ציבוריים → he-IL; cache 60s לעסק). root layout: `<html lang dir>` דינמי, Inter לאנגלית, `NextIntlClientProvider`, Toaster לפי כיוון. **תוקן:** `globals.css` כפה `html { direction: rtl }` ודרס את `dir`. |
| 0.4 | `src/lib/format.ts` (מטבע/תאריך/שעה/טלפון, `dateFnsLocaleFor`, `currencySymbol`); `utils.formatCurrency/Date/Time` = wrappers זהים לפלט הקודם (נבדק על דגימות); `validatePhoneForCountry`; `useBusinessLocale()`. |
| 0.5 | `check:i18n` (עברית + ערכים ישראליים קשיחים + `lang="he"`/`dir="rtl"`/`direction:rtl` + זוגיות he/en + ICU + מפתחות קיימים), `codemod-logical-css.mjs`, `extract-hebrew.mjs`, `i18n-verify-he.mjs` (עברית זהה ל‑origin/main), `i18n-merge-fragments.mjs`, `i18n-check-keys.mjs`, `i18n-qa-screens.js` + `i18n-qa-diff.py`. |
| 0.6 | פיילוט `tasks/page.tsx` + `PetraLoader`: 207 מפתחות (≈268 מקטעי עברית), 13 החלפות codemod, 7× `lang="he"` → לפי עסק. |
| 0.7 | ראו "שער יציאה". |

## שער יציאה
- **tsc מלא** — 0 שגיאות. **next build** (production) — עובר.
- **עברית לפני/אחרי** (Playwright, 1440×900 + 390×844, שעון קפוא): tasks **0.000%** בשתי התצוגות, customers 0.000%, dashboard ≤0.08% (פיד "פעילות אחרונה" מוסיף שורת התחברות בכל ריצה — דאטה, לא קוד). צילומים: `docs/us-expansion/qa/phase0/`.
- **אנגלית** (`locale='en-US'` זמנית לעסק הדמו, הוחזר ל‑he-IL): tasks באנגלית, LTR, Inter, `MM/dd`, 12h. שאר הדשבורד עדיין עברית (צפוי — גל א).
- **סקירת אבטחה** (read-only): אין HIGH/MEDIUM. LOW: (1) locale לא נלקח ממנוי לא‑פעיל (עקבי עם ה‑session, UI בלבד); (2) `invalidateBusinessLocaleCache` יחובר כשיהיה מסך שמשנה locale; (3) `currency/timezone/country` חייבים allowlist כשיהיה נתיב כתיבה (שלב 3); (4) סיסמת seed ב‑QA script (dev בלבד); (5) כל הדפים עכשיו דינמיים (cookie) — עלות ביצועים לדפי שיווק, נבדק בשלב 8. middleware לא השתנה, `/api/mcp` עדיין ב‑`PUBLIC_EXACT_PATHS`, אין `platformRole` בקליינט, cookie לא גובר על עסק.
- **Vercel preview** — נבנה אוטומטית מה‑PR (ראו תיאור ה‑PR).

## סטיות מההוראות ולמה
1. **branch** `claude/gracious-dijkstra-p3eq67` בסשן ענן במקום worktree `feature/i18n` (D-001).
2. **המיפוי של ה‑codemod הפוך** (`ml→me` וכו', D-003) — המיפוי שבתוכנית היה שובר את העברית.
3. **אייקונים** מתהפכים ב‑`ltr:` ולא ב‑`rtl:` (D-004).
4. **`tsc` מלא** במקום scoped (D-002).
5. `check:i18n` מתעלם מהערות (D-007) ובודק יותר ממה שנדרש (ערכים ישראליים, כיוון, ICU, מפתחות).

## ממצאי codemod
13 החלפות בפיילוט, 0 חריגים. הוספנו טיפול ב‑`space-x-reverse` (→ `rtl:space-x-reverse`), skip לשורות `rtl-ok` ולתגיות `dir="ltr"`, ודיווח "MANUAL" ל‑translate-x/rotate/gradient.

## מה לומדים לקראת שלב 1
- מפות תוויות ברמת המודול (`CATEGORY_LABEL[x] ?? x`) → נשארים ה‑ids, תרגום בזמן render, `t.has` כשה‑id מגיע מה‑API.
- **בעברית אין ICU `#`/plural** — `#` מוסיף פסיק אלפים ("1,234") ומשנה פלט. אנגלית כן.
- `&quot;`/`&ldquo;` ב‑JSX → התו האמיתי בהודעה (ה‑verifier מפענח).
- `lang="he"` על inputs, `dir="rtl"` על מודלים, `direction:rtl` במחרוזות הדפסה — שכיחים מאוד; ה‑checker תופס.
- קבועים שה‑generator של Petra AI קורא (`navEntries`, `faqCategories`) נשארים literal עם שדות `<field>Key`; ה‑generator מתרגם מ‑he.json.
- מגבלת קצב API: גל רחב של סוכנים במקביל נעצר באמצע — סוכנים ממשיכים אחרי הודעה (העבודה נשמרת על הדיסק).
