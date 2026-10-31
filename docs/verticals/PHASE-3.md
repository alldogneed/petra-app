# שלב 3 — מיתוג (BrandingSettings)

Commit: `feat(verticals): phase 3 — branding`

## 3.1 מקור אחד
- [x] `src/lib/verticals/branding.ts` (pure): `brandPalette(hex)` → 50..900 (RGB triplets), `isValidHexColor`,
      `resolveBrandingFrom(business, brandingSettings)` → `{ enabled, name, logoUrl, primaryColor, secondaryColor, senderName, palette }`.
      `enabled = vertical === "generic"`; לא enabled → ערכי פטרה (Petra, `/logo.svg`, `#F97316`).
- [x] `src/services/branding.ts` (DB): `getBusinessBranding(businessId)`, `getBusinessBrandingBySlug(slug)`.

## 3.2 דשבורד
- [x] Tailwind `brand-*` → `rgb(var(--brand-N) / <alpha-value>)`; `:root` מגדיר ערכים זהים ל-hex הקיים.
- [x] `BrandThemeStyle` (client) ב-AppShell: generic + primaryColor → מחליף משתנים; לוגו + שם העסק בסיידבר במקום Petra.
- [x] `getCurrentUser()` מחזיר `businessBranding` (logoUrl, primaryColor) רק ל-generic.

## 3.3 `/book/[slug]`
- [x] `GET /api/book/[slug]` מחזיר `branding` (רק generic) → לוגו + צבע כפתורים, בלי "Powered by Petra"/לוגו פטרה.

## 3.4 מיילים
- [x] `brandHeader()` / `brandFooter()` מקבלים branding אופציונלי; מיילים ללקוחות של עסק generic
      (פורטל, שיעורים, תעודות) מוצגים בשם/לוגו העסק. מיילי פלטפורמה לבעל העסק (חיוב, איפוס סיסמה) נשארים פטרה.

## 3.5 PDF
- [x] PDF חוזה חתום (`/api/sign/[token]/pdf`): כותרת/footer עם שם העסק ובלי "Petra" ב-generic.

## 3.6 הגדרות
- [x] Settings → פרטי העסק: ב-generic כרטיס "מיתוג" (צבע ראשי + צבע משני) שנשמר ל-`BrandingSettings`
      (upsert, owner / SETTINGS_CRITICAL). הלוגו = הלוגו הקיים של העסק (`Business.logo`) כשאין `logoUrl`.

## קריטריוני קבלה
- ✅ `tsc` נקי; `prisma validate` ×2 (אין שינוי סכמה בשלב 3 — `BrandingSettings` הקיים בלבד).
- ✅ בדיקות יחידה (`verticals-branding.test.ts`, 13): `brandPalette` (500 = הצבע, Petra → הסקאלה המקורית), `resolveBranding`
  (dogs → Petra גם כשיש שורת BrandingSettings), header/footer של מייל (dogs זהה לפני; generic בלי Petra, escape), שם שולח, אמוג'י.
- ✅ dogs: ערכי `--brand-N` ב-`globals.css` = ה-hex הקודם (בדיקה שקוראת את הקובץ) + בדפדפן: `--brand-500` = `249 115 22`, סיידבר "Petra | PET BUSINESS",
  טאב "Petra", `/book` עם "מופעל על ידי Petra"; `GET/PATCH /api/settings/branding` → 404.
- ✅ generic (build פרודקשן, Playwright): `PATCH /api/settings/branding` (צבע לא תקין → 400, תקין → 200); דשבורד — `--brand-500` = `37 99 235`,
  כפתור ראשי `rgb(37, 99, 235)`, סיידבר "G | Gen Studio", טאב "Gen Studio", אין "Petra" בטקסט; `/book` — אותו צבע, לוגו/אות, בלי "Petra" (גם לא בכותרת);
  כרטיס "מיתוג" בהגדרות.
- ✅ מיילים ללקוח (crons של שיעורים אונליין): header/footer/שם שולח של העסק ב-generic (בדיקת יחידה; שליחה אמיתית לא נבדקה — אין RESEND_API_KEY בסביבה).
- ✅ PDF: ה-PDF החתום הוא תבנית החוזה של העסק + חתימה — אין בו סימני Petra (נבדק בקוד); דף החתימה ממותג ב-generic; metadata של ה-PDF
  (author / creator / producer) = שם העסק ב-generic. לא נבדק end-to-end בדפדפן (דורש העלאת PDF ל-Blob).
- ℹ️ נשאר בכוונה: `PetraLoader` (כלל #29 — זהות הפלטפורמה במסך טעינה), צבעי hex קבועים במסכים פנימיים (גרפים, תגיות) — רוב הממשק עובר דרך `brand-*`.
