# שלב 3 — מיתוג (BrandingSettings)

Commit: `feat(verticals): phase 3 — branding`

## 3.1 מקור אחד
- [ ] `src/lib/verticals/branding.ts` (pure): `brandPalette(hex)` → 50..900 (RGB triplets), `isValidHexColor`,
      `resolveBrandingFrom(business, brandingSettings)` → `{ enabled, name, logoUrl, primaryColor, secondaryColor, senderName, palette }`.
      `enabled = vertical === "generic"`; לא enabled → ערכי פטרה (Petra, `/logo.svg`, `#F97316`).
- [ ] `src/services/branding.ts` (DB): `getBusinessBranding(businessId)`, `getBusinessBrandingBySlug(slug)`.

## 3.2 דשבורד
- [ ] Tailwind `brand-*` → `rgb(var(--brand-N) / <alpha-value>)`; `:root` מגדיר ערכים זהים ל-hex הקיים.
- [ ] `BrandThemeStyle` (client) ב-AppShell: generic + primaryColor → מחליף משתנים; לוגו + שם העסק בסיידבר במקום Petra.
- [ ] `getCurrentUser()` מחזיר `businessBranding` (logoUrl, primaryColor) רק ל-generic.

## 3.3 `/book/[slug]`
- [ ] `GET /api/book/[slug]` מחזיר `branding` (רק generic) → לוגו + צבע כפתורים, בלי "Powered by Petra"/לוגו פטרה.

## 3.4 מיילים
- [ ] `brandHeader()` / `brandFooter()` מקבלים branding אופציונלי; מיילים ללקוחות של עסק generic
      (פורטל, שיעורים, תעודות) מוצגים בשם/לוגו העסק. מיילי פלטפורמה לבעל העסק (חיוב, איפוס סיסמה) נשארים פטרה.

## 3.5 PDF
- [ ] PDF חוזה חתום (`/api/sign/[token]/pdf`): כותרת/footer עם שם העסק ובלי "Petra" ב-generic.

## 3.6 הגדרות
- [ ] Settings → פרטי העסק: ב-generic כרטיס "מיתוג" (צבע ראשי + צבע משני) שנשמר ל-`BrandingSettings`
      (upsert, owner / SETTINGS_CRITICAL). הלוגו = הלוגו הקיים של העסק (`Business.logo`) כשאין `logoUrl`.

## קריטריוני קבלה
- [ ] `tsc` נקי, `prisma validate` ×2 (אין שינוי סכמה בשלב זה).
- [ ] בדיקת יחידה ל-`brandPalette` (500 = הצבע עצמו) ול-`resolveBrandingFrom` (dogs → פטרה גם כשיש שורה).
- [ ] dogs: ערכי ה-CSS variables זהים ל-hex הישן (בדיקה).
- [ ] generic: לוגו + צבע בדשבורד, ב-`/book`, במיילים ללקוח וב-PDF.
