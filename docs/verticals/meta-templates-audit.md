# תבניות WhatsApp (Meta) — בדיקה לורטיקל generic (שלב 5)

נבדק 31/10/2026 מול הקוד (`META_TEMPLATES` ב-`src/lib/reminder-service.ts`, `PETRA_TEMPLATE_CATALOG` ב-`src/lib/meta-template-catalog.ts`).
**אין גישה ל-WhatsApp Manager מהסביבה הזו** — טקסט של תבנית שלא נוצרה מהקטלוג נמצא רק ב-Meta ולא בריפו.

## 1. תבניות שהטקסט שלהן בריפו (הקטלוג)

| תבנית | נשלחת ל | "פטרה"? | מילה כלבית? | generic |
|---|---|---|---|---|
| `petra_appointment_followup` | לקוח | לא | בגוף לא; `{{2}}` = שם החיה או fallback | ✅ fallback לפי ורטיקל: dogs "הכלב שלכם", generic "את/ה" ("איך את/ה מרגיש/ה…") |
| `petra_booking_request_received` | לקוח | לא | לא (רק ב-examples) | ✅ |
| `petra_booking_declined` | לקוח | לא | לא | ✅ |
| `petra_contract_to_sign` | לקוח | לא | לא | ✅ |
| `petra_vaccination_reminder` | לקוח | לא | `{{3}}` = שם החיה | — לא נשלחת: מודול החיות מוסתר |
| `petra_pet_birthday` | לקוח | לא | "עצמות", 🐾 | — לא נשלחת: אין חיות, הטריגר לא מוצע |
| `petra_alldog_owner_alert` | אור | **כן** ("מערכת פטרה") | — | לא רלוונטי ללקוחות |
| `petra_support_ticket_alert` / `_overdue_alert` | אור | **כן** | — | לא רלוונטי ללקוחות |
| `petra_payment_received_alert` | אור | **כן** | — | לא רלוונטי ללקוחות |
| `petra_whatsapp_failure_alert` | אור | **כן** | — | לא רלוונטי ללקוחות |

**מסקנה:** אף תבנית מהקטלוג שנשלחת **ללקוח** לא מכילה "פטרה". התבניות שמכילות "פטרה" נשלחות רק לבעל הפלטפורמה — אין צורך להגיש חדשות בשבילן.

## 2. תבניות שהטקסט שלהן לא בריפו — **לבדוק ב-WhatsApp Manager**

נוצרו ידנית לפני הקטלוג; שם התבנית (`petra_…`) לא מוצג ללקוח, רק הגוף.

| תבנית | זרימה | פרמטרים מהקוד | מה לבדוק |
|---|---|---|---|
| `petra_appointment_reminder_v2`, `petra_appointment_reminder` | תזכורת לתור (גם מפגש תוכנית — `{{4}}` = שם התוכנית ב-generic) | שם · תאריך · שעה · שירות · (טלפון) | אם הגוף מכיל "פטרה" / "כלב" / 🐾 |
| `petra_appointment_confirmation_v2`, `petra_appointment_confirmation` | אישור תור | שם · תאריך · שעה · שירות · (טלפון) | כנ"ל |
| `petra_lead_followup_notice`, `petra_lead_followup` | מעקב ליד | שם · שירות · טלפון | כנ"ל |
| `petra_boarding_*` | פנסיון | — | לא נשלחת ל-generic (מודול מוסתר) |

**אם אחת מהן מכילה "פטרה" או מילה כלבית בגוף** — להגיש תבנית UTILITY חדשה בניסוח ניטרלי (רשומה בקטלוג + `META_TEMPLATES` + builder),
ולהוסיף אותה **בתחילת** השרשרת (כלל #26 — לא במקום הישנה). דרך מהירה לראות את הטקסטים: מסך `/scheduled-messages` → תצוגה מקדימה
(`getPlatformTemplateTexts()` קורא את הטקסטים המאושרים מ-Meta), או `GET /api/cron/sync-platform-templates`.

## 3. שם השולח
עסק שלא חיבר מספר משלו (Embedded Signup) שולח מהמספר של הפלטפורמה — **ה-display name של המספר הזה נראה ללקוח**.
אם הוא "Petra" / "פטרה", לקוח של עסק generic יראה אותו. המלצה: לעסקי generic לחבר מספר עסקי משלהם
(הגדרות → אינטגרציות → WhatsApp), או להחליט על display name ניטרלי למספר הפלטפורמה. **החלטה עסקית — לא שיניתי.**

## 4. מה שונה בקוד (free text — חלון 24 שעות)
- `reminder-service.ts`: גופי ברירת המחדל (תזכורת תור, מעקב, ליד, פגישת ליד) — 🐾 → `vocab("messages.greeting_emoji")` (generic: 🙂);
  תזכורת מפגש תוכנית ב-generic: "תזכורת למפגש <שם התוכנית>" במקום "מפגש אילוף עם <כלב>".
- `/api/appointments/[id]/remind` + `payment-request.ts` — פתיח מהמילון.
- crons של שיעורים אונליין — 🐾 מוסר מגוף ההודעה ב-generic (`neutralizeForVertical`), מייל ממותג (שלב 3).
- הודעות שהעסק כתב בעצמו (תבניות מותאמות) — לא נוגעים; תבניות הפתיחה ב-generic כבר בלי 🐾 (שלב 2).
