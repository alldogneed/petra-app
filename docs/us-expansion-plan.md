# Petra — תוכנית הרחבה לשוק האמריקאי (גרסה אנגלית)

**תאריך:** 31.10.2026 · **סטטוס:** תוכנית מאושרת לביצוע, שלב 0 טרם התחיל
**בעלים:** Or · **מבצע:** Claude Code (תת‑סוכנים לפי `petra-mcp-dev-workflow`)

---

## 1. החלטות שהתקבלו (31.10.2026)

| נושא | החלטה |
|---|---|
| ארכיטקטורה | **קודבייס אחד, שפה לפי עסק.** `Business.locale` קובע שפה/כיוון/מטבע/טלפון. אין fork, אין deployment נפרד בשלב זה. |
| היקף | **כל המודולים** — פטרה המלאה באנגלית. מה משווקים קודם — החלטה שיווקית נפרדת. |
| ערוץ הודעות | **SMS (Twilio) כערוץ מקביל ל‑WhatsApp.** שכבת `messaging provider` — אותם flows, ספק לפי עסק. |
| חיוב | **Stripe לעסקים אמריקאים, Cardcom נשאר לישראל.** שכבת `billing provider` לפי locale. |

## 2. תמונת מצב (נמדד 31.10.2026)

- 728 קבצי `ts/tsx`, **555 מכילים עברית**, ~**14,600** שורות עם מחרוזות עבריות קשיחות.
  - UI (components + dashboard + landing): ~8,940
  - API routes: ~2,075
  - services + lib (שגיאות, הודעות, תבניות, MCP): ~2,120
- **אין תשתית i18n** (לא next-intl / i18next). `<html lang="he" dir="rtl">` קשיח ב‑`src/app/layout.tsx`.
- **4,419** קלאסים של Tailwind עם כיוון פיזי (`ml- mr- pl- pr- left- right- text-left text-right`) מול 67 לוגיים (`ms- me- ps- pe- start- end-`).
- עברית **בדאטה**: `LEAD_SOURCES`, `lead-stages.ts`, `DEFAULT_STAGES` (recipients, upsert לפי שם), `STARTER_TEMPLATES` (8 תבניות), `Business.customerTags` default, `legalEntityType`, seeds, `SERVICE_DOG_PHASES/TYPES` labels, `MEDICAL_PROTOCOL_CATEGORIES`.
- קשיח לישראל: `formatCurrency` (`he-IL`/ILS), `formatDate` (`he-IL`), `validateIsraeliPhone` + נורמליזציה ל‑05X, `timezone @default("Asia/Jerusalem")`, `vatEnabled/vatRate(0.18)`, Cardcom (9 routes + checkout), חשבוניות/זיכויים לפי דין ישראלי, תבניות Meta מאושרות בעברית, Heebo כפונט.
- כלים קיימים שמקלים: שכבת `src/services/` (19 קבצים) משותפת ל‑UI ול‑MCP; `date-fns` v4 (תומך locales); Tailwind תומך ב‑logical properties נייטיבית.

**מסקנה:** זה לא תרגום — זה שלושה פרויקטים: (א) תשתית i18n + RTL/LTR, (ב) לוקליזציה עסקית, (ג) התאמת מוצר (SMS, Stripe, משפטי, שיווק).

## 3. עקרונות ארכיטקטורה

### 3.1 מודל הנתונים
שדות חדשים על `Business` (כולם additive, עם defaults שמשאירים עסקים קיימים ללא שינוי):
```prisma
locale          String @default("he-IL")   // "he-IL" | "en-US"
country         String @default("IL")      // ISO-3166 alpha-2 → phone region, tax, legal
currency        String @default("ILS")     // "ILS" | "USD"
messagingChannel String @default("whatsapp") // "whatsapp" | "sms"
billingProvider  String @default("cardcom")  // "cardcom" | "stripe"
```
- `timezone` קיים — ברירת מחדל נשארת `Asia/Jerusalem`; עסק אמריקאי מקבל את האזור שלו בהרשמה.
- `vatEnabled/vatRate` → נשארים, אבל ה‑UI מציג תווית גנרית (`t("tax.label")` = מע"מ / Sales tax). לא משנים שמות עמודות.
- Prod DDL: תמיד `prisma/us_expansion_*.sql` additive דרך `prisma db execute --url $DIRECT_URL` (אף פעם לא `db push`). לא לשכוח `schema.production.prisma`.

### 3.2 פתרון שפה (locale resolution)
| הקשר | מקור ה‑locale |
|---|---|
| Dashboard / API מאומת | `session.business.locale` (נגזר מהעסק, לא מהדפדפן) |
| דפים ציבוריים של עסק (`/book/[slug]`, `/intake`, `/my-booking`, `/sign`, portal) | `business.locale` של העסק שבנתיב |
| שיווק/auth (`/landing`, `/login`, `/register`, `/terms`, `/privacy`) | prefix `/en/...` (ברירת מחדל ללא prefix = עברית, כדי לא לשבור SEO וקישורים קיימים) |
| הרשמה | הטופס באנגלית קובע `locale=en-US, country=US, currency=USD, messagingChannel=sms, billingProvider=stripe` |
| הודעות יוצאות (WhatsApp/SMS/email) | `business.locale` — תמיד, גם מ‑cron |
| MCP | תיאורי כלים באנגלית תמיד (Claude קורא אנגלית מצוין); **פלט** הכלים (labels, שגיאות) לפי `business.locale` |

### 3.3 ספריית i18n: `next-intl`
- תומך App Router + Next 14.2, Server Components ו‑Client Components, ICU (plurals, select), `getTranslations` בצד שרת (API routes, cron, services).
- קבצי הודעות: `messages/he.json`, `messages/en.json`, מחולקים ל‑namespaces לפי feature: `common`, `nav`, `customers`, `leads`, `boarding`, `serviceDogs`, `training`, `orders`, `settings`, `landing`, `errors`, `messagingTemplates`, `email`, `mcp`.
- מפתחות: `feature.component.meaning` (למשל `leads.kanban.overdueBadge`). **לא** `text1`/`label2`.
- הגישה בצד שרת: `getTranslations({ locale: business.locale, namespace })` — אין שימוש ב‑cookies/headers של הדפדפן ל‑locale בתוך API.
- **כלל ברזל אחרי המיגרציה:** אפס מחרוזות עבריות ב‑`src/` מחוץ ל‑`messages/`. סקריפט `scripts/check-no-hebrew.ts` רץ ב‑CI ונכשל על עברית בקבצים שסומנו כמוגרים (allowlist שמצטמצם בכל גל).

### 3.4 RTL / LTR
- `<html lang dir>` דינמיים מה‑locale (root layout + layouts ציבוריים).
- codemod חד‑פעמי לכל גל: physical → logical (`ml-`→`ms-`, `mr-`→`me-`, `pl-`→`ps-`, `pr-`→`pe-`, `left-`→`start-`, `right-`→`end-`, `text-left/right`→`text-start/end`, `rounded-l/r`→`rounded-s/e`, `border-l/r`→`border-s/e`). חריגים אמיתיים (אייקונים, `dir="ltr"` לטלפונים/קוד) מסומנים `// rtl-ok`.
- אייקוני חיצים/`ChevronLeft/Right`: עטיפה `<DirIcon>` שמתהפכת לפי locale, או `rtl:rotate-180`.
- פונט: Heebo לעברית, Inter לאנגלית — נבחר ב‑layout לפי locale (`--font-sans`).
- QA חזותי: צילומי מסך לפני/אחרי לכל עמוד בשני הכיוונים (Playwright) — עברית חייבת להיראות **זהה** לפני ואחרי.

### 3.5 פורמטים (`src/lib/format.ts` — מחליף את הפונקציות ב‑utils.ts)
- `formatCurrency(amount, { locale, currency })`, `formatDate/Time(d, { locale, timezone })`, `formatPhone(phone, country)`.
- טלפון: `libphonenumber-js` — `validatePhone(phone, country)`, אחסון תמיד E.164 (`+972…`, `+1…`). `validateIsraeliPhone` נשאר כ‑wrapper ל‑IL עד שכל הקריאות יוחלפו.
- תאריכים: `date-fns` עם locale `he`/`enUS`; פורמט תצוגה `dd/MM/yyyy` מול `MM/dd/yyyy`; שבוע מתחיל ראשון בשני השווקים (נוח).
- שעות: 24h בישראל, 12h (AM/PM) בארה"ב — ב‑`Intl.DateTimeFormat` לפי locale.

### 3.6 דאטה בעברית שנטען ל‑DB
- **עסקים קיימים לא נוגעים בהם.** נתונים שכבר ב‑DB (שלבי לידים, תבניות, תגיות) נשארים בעברית.
- seeds/defaults חדשים נוצרים **לפי locale של העסק בזמן יצירתו**: `createDefaultLeadStages(businessId, locale)`, `STARTER_TEMPLATES[locale]`, `customerTags` default לפי locale.
- `DEFAULT_STAGES` (recipients) — upsert היום לפי `name` בעברית → לעבור ל‑upsert לפי `key` עם `label` לפי locale. מיגרציה: לשורות קיימות להוסיף `key` לפי מיפוי שם→key.
- enums עם labels (`SERVICE_DOG_PHASES`, `TYPES`, `PLACEMENT_STATUSES`, `MEDICAL_PROTOCOL_*`, `LEAD_SOURCES`, statuses ב‑`getStatusLabel`): ה‑**key** נשאר כפי שהוא (מקור אמת יחיד לפי CLAUDE.md #12–15), ה‑**label** עובר ל‑`messages/*.json` ונקרא דרך `t()`. `MEDICAL_PROTOCOL_MAP[key]?.label` → `t(\`medical.${key}\`)`.

### 3.7 הודעות ללקוחות — שכבת messaging
```
src/lib/messaging/
  index.ts        sendCustomerMessage({ businessId, to, flow, params, context })
  whatsapp.ts     → sendWithTemplateChain (קיים, ללא שינוי)
  sms.ts          → Twilio Messaging Service
  consent.ts      opt-in / STOP / HELP
```
- בחירה לפי `business.messagingChannel`. כל הקוראים הקיימים (`reminder-service`, `lead-alert`, `scheduled-messages`, `automation-triggers`, `processPendingReminders`) עוברים לקרוא ל‑`sendCustomerMessage` במקום ישירות ל‑WhatsApp. `resolveWhatsAppSender` נשאר כמו שהוא.
- `ScheduledMessage.payload` מקבל `channel`; `WhatsAppMessageLog` → נוסף `channel` (או טבלה `MessageLog` מקבילה) — להחליט בשלב 5.
- **רגולציה בארה"ב (חובה, לא אופציה):** TCPA — opt-in מפורש של הלקוח לפני SMS שיווקי; טיפול ב‑`STOP/HELP`; **A2P 10DLC registration** (brand + campaign) ב‑Twilio — לוקח שבועות ⇒ **להתחיל מוקדם, במקביל לשלב 1**. תזכורות לתור = transactional, nurture = marketing (דורש opt-in נפרד, מקביל לתיקון 40 אצלנו).
- תבניות SMS: טקסט חופשי (אין תבניות מאושרות כמו ב‑Meta) — התוכן מ‑`messages/en.json` namespace `messagingTemplates`, 160 תווים ליחידה.

### 3.8 חיוב — שכבת billing
```
src/lib/billing/
  index.ts     createCheckout / createTrial / cancel / webhook dispatch לפי business.billingProvider
  cardcom.ts   עוטף את /api/cardcom/* הקיימים (ללא שינוי לוגיקה)
  stripe.ts    Stripe Checkout + Billing (subscriptions, trial, customer portal), webhook /api/webhooks/stripe
```
- Stripe כותב לאותם שדות: `subscriptionStatus`, `subscriptionEndsAt`, `trialEndsAt`, `tier`. שדות ספציפיים: `stripeCustomerId`, `stripeSubscriptionId`.
- מחירון USD ב‑Stripe Products (Basic/Pro/Master, חודשי+שנתי) — **המספרים טרם נקבעו (שאלה פתוחה).**
- מס בחיוב של Petra עצמה: Stripe Tax (אוטומטי לפי מדינה) — SaaS חייב sales tax בחלק מהמדינות.
- Idempotency ב‑webhooks (אותו עיקרון כמו ב‑Cardcom, Vercel cron ללא retry).

### 3.9 חשבוניות ללקוחות של העסק (InvoiceDocument)
- ישראל: ללא שינוי (מספור, חשבונית מס/קבלה, זיכוי).
- ארה"ב: אין חובה חוקית למבנה חשבונית; שירותי אילוף לרוב לא חייבים sales tax, משתנה לפי מדינה. **MVP:** "Invoice / Receipt" פשוט, `taxRate` ידני לעסק (default 0), תווית "Sales tax". לא בונים מנוע מס לפי מדינה.

### 3.10 מה לא משתנה
- שכבת ה‑services, auth, IDOR, MCP auth, קיל‑סוויץ', middleware — ללא שינוי לוגי. רק מחרוזות ופורמטים.
- כל כללי CLAUDE.md (#1–#27) בתוקף. נוסף כלל: **לעולם לא `"he-IL"` / `"ILS"` / `"Asia/Jerusalem"` / `₪` קשיח — תמיד מהעסק.**

## 4. שלבים ושערים (gates)

כל שלב = branch משלו מ‑`origin/main`, PR, `tsc` scoped, Vercel preview, סקירת אבטחה (read-only subagent) לפני merge. העברית חייבת לעבור בכל שלב ללא רגרסיה.

| # | שלב | תכולה | שער יציאה | הערכה |
|---|---|---|---|---|
| **0** | **תשתית** | next-intl + `messages/{he,en}.json` ריקים; שדות `Business` + SQL additive; `html lang/dir` דינמי; `src/lib/format.ts`; `libphonenumber-js`; `scripts/check-no-hebrew.ts`; codemod logical-CSS; **פיילוט על עמוד אחד** (`tasks/page.tsx`, 233 שורות) מלא: חילוץ + תרגום + logical CSS + QA בשני הכיוונים. | פטרה בעברית זהה ל‑100%; עמוד tasks עובד באנגלית ובעברית; CI ירוק. | 2–3 ימי סוכן |
| **1** | **UI בגלים** (תת‑סוכנים, קובץ לסוכן) | גל א: nav/layout/common/topbar/search/help. גל ב: customers, pets, leads, calendar, scheduler, orders, dashboard. גל ג: settings, business-admin, messages-panel, onboarding. גל ד: boarding. גל ה: training + online-classes + portal. גל ו: service-dogs (הכבד ביותר). גל ז: landing, login/register/auth, terms/privacy/accessibility, book/intake/my-booking/sign, owner/admin. | כל גל: 0 עברית בקבצים שלו (CI), screenshots he לפני=אחרי, en נבדק ידנית. | 8–12 ימי סוכן |
| **2** | **צד שרת** | שגיאות ב‑API routes (`errors` namespace, לפי `business.locale` מה‑session); `email.ts` + כל תבניות Resend; `notify-owner`, `lead-alert`, `reminder-service`, cron; תיאורי כלי MCP → אנגלית, פלט → `t()`; `getStatusLabel`/`getTimelineIcon`. | API מחזיר שגיאות בשפת העסק; אימיילים בשתי שפות. | 3–4 ימי סוכן |
| **3** | **דאטה לפי locale** | seeds/defaults לפי locale; `DEFAULT_STAGES` לפי key; labels של enums ל‑messages; `customerTags` default; demo business אמריקאי (`qa-us@petra.local`) ל‑E2E. | עסק חדש en-US נולד עם שלבים/תבניות/תגיות באנגלית; עסקים קיימים ללא שינוי. | 2 ימי סוכן |
| **4** | **לוקליזציה עסקית** | כל קריאה ל‑`formatCurrency/formatDate/validateIsraeliPhone` → גרסאות מבוססות‑עסק; E.164 באחסון; `wa.me` links לפי מדינה; תווית מס; 12h/24h; דוחות/analytics/CSV export. | אותו עסק עם locale שונה מציג מטבע/תאריך/טלפון נכון בכל מסך. | 2–3 ימי סוכן |
| **5** | **SMS + messaging layer** | `src/lib/messaging/*`, Twilio, consent/STOP webhook, `channel` בלוגים, UI הגדרות "הודעות" מציג WhatsApp או SMS לפי עסק, Settings → אינטגרציות. **10DLC מתחיל כבר בשלב 1.** | תזכורת תור + התראת ליד + nurture נשלחות ב‑SMS לעסק US ב‑E2E. | 3–4 ימי סוכן |
| **6** | **Stripe** | `src/lib/billing/*`, Checkout, trial, webhook, customer portal, מחירון USD, `/checkout` + `/payment/*` דו‑ספקיים, cron `expire-subscriptions` ספק‑אגנוסטי, באנר חידוש. | הרשמה→trial→חיוב→חידוש→ביטול עובדים ב‑Stripe test mode. | 3–4 ימי סוכן |
| **7** | **שיווק ומשפטי** | `/en/landing` (עותק אנגלי, לא תרגום מילולי — copy לשוק US), `TRUST_STATS` באנגלית, ToS/Privacy לדין אמריקאי (CCPA, TCPA, CAN-SPAM), דף נגישות, help center + סרטוני הדרכה (אנגלית), onboarding checklist, `notifyOwnerNewUser` עם country. SEO: hreflang, sitemap דו‑לשוני, `robots`. | דף נחיתה אנגלי חי ב‑preview, מסמכים משפטיים נסקרו ע"י עו"ד. | 3 ימי סוכן + עו"ד |
| **8** | **QA ושחרור** | Playwright E2E בשני ה‑locales על שני עסקי QA; red-team (IDOR בין locales, webhook signatures Twilio/Stripe); ביקורת תרגום ע"י דובר אנגלית (אדם); perf; תיעוד (`docs/i18n.md`, עדכון CLAUDE.md); רשימת 5–10 מאלפים אמריקאים לבטא. | go/no-go | 3 ימי סוכן |

**סה"כ גס: ~30–38 ימי סוכן**, בעיקר שלב 1. במקביל (לא חוסם): 10DLC, חשבון Stripe, עו"ד, copy.

## 5. כללי עבודה לכל ה‑PRs

1. גל = branch מ‑`origin/main` → תת‑סוכנים (קובץ אחד לסוכן, לפי `petra-mcp-dev-workflow`) → `tsc` scoped → Vercel build → security review → merge ל‑main.
2. בכל קובץ מוגר: `"use client"` + `useTranslations("ns")` או `getTranslations` בשרת. אין `t()` עם מפתח דינמי לא‑מתועד.
3. אין להמציא מחרוזות אנגליות שיווקיות — טרמינולוגיה קבועה (ראו §6). ספק → להשאיר `TODO(en-copy)` ולרשום ב‑`docs/i18n-glossary.md`.
4. לא לשנות keys/enums/שמות עמודות. לא לגעת בלוגיקה עסקית בתוך PR של תרגום. באג שנמצא → issue נפרד.
5. `messages/he.json` הוא מקור האמת לעברית — הטקסט חייב להיות **זהה תו‑בתו** למה שהיה קשיח (אין "שיפורים" תוך כדי).
6. אחרי כל שינוי סכמה: `cp prisma/schema.prisma prisma/schema.production.prisma`.

## 6. מילון מונחים (בסיס — יורחב ב‑`docs/i18n-glossary.md`)

| עברית | English (US) | הערה |
|---|---|---|
| לקוח | Client | לא Customer — מקובל יותר אצל מאלפים בארה"ב; ה‑MCP כבר `list_clients` |
| ליד | Lead | |
| תור / פגישה | Appointment | |
| הזמנה | Order | |
| פנסיון | Boarding | |
| חצר | Yard / Play yard | |
| אילוף | Training | |
| מאלף | Trainer | |
| כלב שירות | Service dog | |
| נמען (כלב שירות) | Recipient / Handler | לבדוק מול ארגונים בארה"ב |
| קבוצת אימון | Group class | |
| מע"מ | Sales tax | תווית בלבד |
| עוסק מורשה / ח.פ | Business / EIN | שדה `businessRegNumber` → "EIN (optional)" |
| הוראת קבע | Subscription | |
| חשבונית מס / קבלה | Invoice / Receipt | |
| הודעות מפטרה | Messages from Petra | |
| דוחות | Reports | |

## 7. סיכונים

| סיכון | מיטיגציה |
|---|---|
| רגרסיה בעברית במהלך 14.6K שינויים | he.json זהה תו‑בתו; screenshots diff לכל עמוד; גלים קטנים; CI check |
| שבירת RTL מה‑codemod (מקרי קצה: אייקונים, dir=ltr מקומי) | פיילוט בשלב 0; `// rtl-ok` לחריגים; QA ויזואלי |
| 10DLC/Twilio לוקח 2–6 שבועות | להגיש בשבוע הראשון; עד אז SMS ב‑toll-free verified או test |
| Stripe דורש ישות — חשבון ישראלי יכול לחייב USD, אבל מס/חוקיות US עדיף דרך ישות אמריקאית | שאלה פתוחה לאור/עו"ד/רו"ח; Stripe test mode לא חוסם פיתוח |
| תרגום מכונה "נכון" אבל לא טבעי למאלפים | ביקורת דובר אנגלית + 2–3 מאלפים אמריקאים לפני שחרור |
| תבניות Meta לעסק US (אם ישתמש ב‑WhatsApp) | לא בתכולה; US = SMS |
| ביצועים: messages גדולים נטענים לכל עמוד | next-intl עם namespaces per-route; לא לטעון את הכול ב‑root |
| שם המותג "Petra" בארה"ב | בדיקת trademark + זמינות דומיין (שאלה פתוחה) |

## 8. שאלות פתוחות (לאור)

1. **דומיין/כתובת:** `petra-app.com/en` או דומיין נפרד? (משפיע על SEO ועל שלב 7 בלבד)
2. **ישות וחשבון Stripe:** ישראלי או אמריקאי (Atlas/LLC)? — להתייעץ עם רו"ח. לא חוסם פיתוח.
3. **מחירון USD** ל‑Basic/Pro/Master חודשי+שנתי.
4. **מי מבקר את האנגלית** — Ariel? דובר ילידי? מאלף אמריקאי מוכר?
5. **פונט** לאנגלית (ברירת מחדל מוצעת: Inter).
6. **Twilio vs. חלופה** (Telnyx כבר על השולחן להקלטת שיחות — אפשר ספק אחד ל‑SMS + voice).
7. **האם ה‑MCP לעסקים אמריקאים** נכנס ל‑MVP (private beta allowlist) או אחר כך.

## 9. הצעד הבא

אישור של אור → פתיחת branch `feature/i18n-foundation` והרצת **שלב 0** (תשתית + פיילוט על `tasks/page.tsx`). רק אחרי ששלב 0 עובר את השער מתחילים את גלי שלב 1.
