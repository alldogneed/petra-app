# שלב 5 — WhatsApp ומיילים ללקוחות בלי "פטרה" / "כלב"

Commit: `feat(verticals): phase 5 — customer messages`

## 5.1 סריקת תבניות
- [x] לעבור על כל תבנית ב-`META_TEMPLATES` + `PETRA_TEMPLATE_CATALOG` + `STARTER_TEMPLATES` ולסווג:
      מכילה "פטרה"/"Petra" · מכילה "כלב"/🐾/"עצמות" · פרמטר שמקבל ערך כלבי · נקייה.
- [x] לתעד ב-`docs/verticals/meta-templates-audit.md` — כולל אילו תבניות מאושרות (לא בקטלוג, הטקסט
      מגיע מ-Meta) **לא ניתן לבדוק מכאן** ודורשות בדיקה ב-WhatsApp Manager.

## 5.2 קוד
- [x] `appointmentFollowupChain` — fallback ל-{{2}} לפי ורטיקל (`vocab("messages.followup_subject")`).
- [x] זרימות שלא קיימות ב-generic (פנסיון, חיסונים, יום הולדת לחיה) — לא נשלחות כי המודול מוסתר
      (לוודא: `scheduleVaccinationReminder` / יום הולדת לא רצים לעסק generic).
- [x] free-text fallback (חלון 24h) — טקסטים עם "כלב" עוברים דרך `vocab`.
- [x] `STARTER_TEMPLATES` — ב-generic ניסוח בלי כלב.
- [x] Sender name / חתימת מיילים ללקוח — `BrandingSettings.senderName` → שם העסק.

## קריטריוני קבלה
- ✅ `tsc` נקי, `prisma validate` ×2.
- ✅ `meta-template-catalog.test.ts` + `whatsapp-free-text-guard.test.ts` + `audit-whatsapp-free-text` ירוקים (אין free-text חדש).
- ✅ `appointment-followup-chain.test.ts`: generic → `{{2}}` = "את/ה"; dogs → "הכלב שלכם" (כמו קודם); `lead-meeting-reminder.test.ts` ירוק.
- ✅ דוח: `docs/verticals/meta-templates-audit.md` — אף תבנית קטלוג שנשלחת **ללקוח** לא מכילה "פטרה" (רק התראות לבעל הפלטפורמה);
  התבניות הישנות (`petra_appointment_reminder*`, `petra_appointment_confirmation*`, `petra_lead_followup*`) — הטקסט רק ב-Meta, **לבדוק ב-WhatsApp Manager**.
- ✅ בדיקה אוטומטית בפרודקשן: `GET /api/cron/sync-platform-templates` מחזיר `verticalAudit` — תבניות ללקוח שהגוף המאושר שלהן ב-Meta
  מזכיר פטרה / מילה כלבית (`src/lib/verticals/template-audit.ts`, בדיקות). **הורץ בפרודקשן 31/10/2026**: תזכורת / אישור תור, מעקב ליד ישן,
  פנסיון ויום הולדת — ניסוח כלבי (בלי "פטרה"). תוקן: `adaptChainForVertical()` מחליף לעסק generic בתבניות קטלוג ניטרליות
  `petra_meeting_reminder` / `petra_meeting_confirmation` או מוריד (פירוט ב-`meta-templates-audit.md` §2א). dogs — ללא שינוי.
- ✅ שם השולח ב-WhatsApp: עסק generic בלי מספר משלו רואה בכרטיס המיתוג הסבר + קישור לחיבור מספר עסקי (Embedded Signup).
  ⚠️ החלטה עסקית שנשארת פתוחה: שם התצוגה של מספר הפלטפורמה עצמו (משפיע על כל העסקים, לא שיניתי).
- ✅ PDF + מייל: `verticals-pdf-email.test.ts` — round-trip של pdf-lib (author/creator/producer = העסק ב-generic, ברירות מחדל ב-dogs) ו-`sendEmail`
  מול Resend מדומה (שם שולח של העסק, HTML ממותג בלי Petra; dogs — שולח Petra כמו קודם).
