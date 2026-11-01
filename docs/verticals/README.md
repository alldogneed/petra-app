# ורטיקלים ומיתוג — החלטות וארכיטקטורה

> **מקור המסמך:** המסמכים המקוריים (`docs/verticals/*` מהמחשב של אור) לא נדחפו לריפו בזמן
> הביצוע (31/10/2026). המסמכים כאן נכתבו מחדש לפי הבריף של אור (7 העקרונות + סדר העבודה)
> ולפי הקוד הקיים. אם המסמכים המקוריים שונים — הם גוברים, וצריך ליישב מולם.

## המטרה
עסק חדש שבוחר "עסק אחר" עובד מקצה לקצה — לקוח → פגישה → תוכנית → תשלום → WhatsApp —
בלי לראות את המילה "כלב", עם הלוגו והצבעים שלו בדשבורד, ב-`/book`, במיילים וב-PDF,
ובכתובת `{slug}.petra.app`.

## החלטות מחייבות
1. **אפס שינוי התנהגות לעסקים קיימים.** `Business.vertical` ברירת מחדל `"dogs"`. כל קוד חדש
   מתפצל רק על `vertical === "generic"`; ענף ה-dogs מחזיר בדיוק את מה שהיה לפני.
2. **לא מערכת חדשה.** אותו ריפו, אותו DB, אותו דף נחיתה (`/landing` לא נוגעים).
   הבחירה היא אופציית **"עסק אחר"** בשאלת סוג העסק באונבורדינג — לא שדה בהרשמה.
   - הערה: `PersonalizationScreen` קיים בקוד אבל **לא מחובר** לשום זרימה (גם `OnboardingWizardModal`
     שמשתמש ב-`StepWelcomeProfile` לא נפתח אף פעם). הזרימה החיה היא `register → /onboarding`.
     לכן: "עסק אחר" נוסף לשלוש הרשימות (`PersonalizationScreen`, `StepWelcomeProfile`) **וגם**
     לשלב "פרטי עסק" ב-`/onboarding` (שם הבחירה באמת נשמרת). ברירת המחדל המסומנת = עסק לחיות מחמד.
3. **שני ורטיקלים בלבד:** `dogs`, `generic`. אין "נושא שירות" (סוס / תלמיד / רכב) — מחוץ לתכולה.
   ב-generic פשוט **אין** ישות נושא: הלקוח הוא מקבל השירות.
4. **מיתוג = `BrandingSettings` הקיים** (logoUrl, primaryColor, secondaryColor, senderName).
   אין טבלת מיתוג חדשה. המיתוג מוחל רק ב-generic (כדי לא לשנות עסקי dogs שכבר יש להם שורת
   BrandingSettings בגלל פורטל השיעורים).
5. **מילון אחד:** `src/lib/verticals/vocab.ts` — `vocab(key, { locale, vertical, params })`.
   הערכים ב-`messages/{locale}.json` תחת namespace `vocab` (`vocab.<key>.<vertical>`), כך
   שכש-next-intl של תוכנית ה-US ייכנס (Phase 0) הוא קורא את אותם קבצים. אין כרגע next-intl
   בריפו → לא מתקינים אותו; הוספת `en` = קובץ `messages/en.json` עם אותם מפתחות, בלי שינוי קוד.
6. **כללי CLAUDE.md:** אין interactive `$transaction`; DDL פרוד additive, נשמר כ-
   `docs/verticals/ddl-00N-*.sql` ומורץ עם `prisma db execute --url $DIRECT_URL`; sync ל-
   `schema.production.prisma` אחרי כל שינוי; `businessId` מה-session בלבד;
   `requireBusinessAuth` + `isGuardError`; optional chain על כל `.dog` / `.pet`.
7. **מוסתר ≠ נעול.** ורטיקל שמסתיר מודול → האלמנט לא מרונדר (לא TierGate, לא מנעול),
   וה-API מחזיר **404**. Tier שנועל → TierGate / 403 כרגיל. ההסתרה נבדקת **לפני** ה-tier.

## ארכיטקטורה

```
Business.vertical ("dogs" | "generic")
   │
   ├─ src/lib/verticals/index.ts      ← pure: VERTICALS, normalizeVertical, HIDDEN_MODULES,
   │                                     isModuleHidden, hiddenScreenFor(path), hiddenApiFor(path)
   ├─ src/lib/verticals/vocab.ts      ← pure: vocab(key, {locale, vertical, params})
   ├─ messages/he.json                ← { "vocab": { "<key>": { "dogs": "...", "generic": "..." } } }
   ├─ src/lib/verticals/server.ts     ← getBusinessVertical(db, businessId), verticalApiGuard()
   ├─ src/hooks/useVertical.ts        ← client: { vertical, isGeneric, v(), hides() }
   └─ getCurrentUser().businessVertical  (→ AuthProvider → useVertical)
```

### מודולים מוסתרים ב-generic (`HIDDEN_MODULES.generic`)
| מודול | מסכים | API |
|---|---|---|
| `boarding` | `/boarding`, `/feeding`, `/medications` | `/api/boarding`, `/api/feeding`, `/api/medications` |
| `service_dogs` | `/service-dogs` | `/api/service-dogs`, `/api/service-recipients`, `/api/service-recipient-stages`, `/api/service-placements`, `/api/service-compliance` |
| `pets` | `/pets`, `/vaccinations`, `/intake`, `/intake-forms` | `/api/pets`, `/api/customers/[id]/pets`, `/api/intake/*` (המסלולים עם session; טופס הקליטה הוא טופס לכלב) |
| `groomer_portfolio` | — | — |

- ה-404 של ה-API נעשה **במקום אחד**: `requireBusinessAuth()` בודק את ה-pathname מול
  `hiddenApiFor()`; רק כשיש התאמה הוא קורא את `vertical` (שאילתה אחת קטנה) — לעסקי dogs
  התוצאה זהה (עובר). כל route שעובר דרך `requireBusinessAuth` / `requireBusinessPermission` /
  `requireCustomerAccess` מכוסה.
- המסכים: `ScreenGuard` ב-`app-shell.tsx` מציג 404 (notFound UI) למסך מוסתר; הסיידבר והניווט
  במובייל מסננים לפי `hides()`; ווידג'טים בדשבורד עם `requires` חדש `"pets"` / `"boarding"`.
- **אימון (`training`) לא מוסתר** — ב-generic הוא "תוכניות" (חבילת מפגשים ללקוח). לכן
  `TrainingProgram.dogId` הופך ל-nullable (DDL 002, `DROP NOT NULL` — תואם אחורה).

### מילון
- מפתחות קצרים, באנגלית, לפי תחום: `nav.training`, `program.singular`, `program.plural`,
  `subject.singular`, `business.kind`, `appointment.followup_subject` …
- ענף `dogs` = הטקסט **הקיים תו-בתו**. אסור "לשפר" ניסוח בדרך.
- `vocab()` בלי `vertical` → `dogs`. מפתח חסר ב-generic → fallback ל-dogs **ונכשל בבדיקה**
  (`vocab.test.ts` דורש שלכל מפתח יש שני הענפים ושאף ענף generic לא מכיל "כלב").

### מיתוג (שלב 3)
- `src/lib/verticals/branding.ts` — `resolveBranding(db, businessId)` → `{ enabled, logoUrl,
  primaryColor, secondaryColor, senderName, palette }`; `enabled = vertical === "generic"`.
- צבעי Tailwind `brand-*` עוברים ל-CSS variables שערכי ברירת המחדל שלהם **זהים** ל-hex הקיים
  → dogs לא משתנה בפיקסל. ב-generic ה-`BrandThemeProvider` מחליף את המשתנים.

### תת-דומיין (שלב 4)
- `TENANT_ROOT_DOMAIN` (למשל `petra.app`) — כשלא מוגדר, הפיצ'ר כבוי לגמרי.
- `{slug}.petra.app/` → rewrite ל-`/book/{slug}`; שאר הנתיבים עובדים כרגיל על אותו host.
- `SESSION_COOKIE_DOMAIN` (למשל `.petra.app`) מוחל רק כשה-host מסתיים בו — `petra-app.com` לא מושפע.

## שלבים
| שלב | קובץ | תוצר |
|---|---|---|
| 1 | `PHASE-1.md` | תשתית: סכמה, DDL, lib, מילון, hook, guard, בחירה באונבורדינג |
| 2 | `PHASE-2.md` | החלפת טקסטים לפי קטגוריות + הסתרת Pet, תוכנית בלי כלב |
| 3 | `PHASE-3.md` | מיתוג: דשבורד, `/book`, מיילים, PDF |
| 4 | `PHASE-4.md` | `{slug}.petra.app` |
| 5 | `PHASE-5.md` | WhatsApp ומיילים ללקוחות בלי "פטרה" / "כלב" |

## מתי עוצרים ושואלים
שינוי שנוגע בעסקי dogs; החלטה שלא כתובה כאן; "כלב" שלא ברור אם דומייני או של כלבי שירות;
קונפליקט עם קוד i18n קיים.

## מצב פרודקשן (31/10/2026)
- DDL 001 + 002 קיימים ב-Supabase (`petra`): `Business.vertical` NOT NULL default `dogs`, `TrainingProgram.dogId` nullable; 70/70 עסקים = `dogs`.
- הקוד עוד לא מוזג ל-main — ענף `claude/fervent-johnson-2ffsxw`.
