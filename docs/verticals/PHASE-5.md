# שלב 5 — WhatsApp ומיילים ללקוחות בלי "פטרה" / "כלב"

Commit: `feat(verticals): phase 5 — customer messages`

## 5.1 סריקת תבניות
- [ ] לעבור על כל תבנית ב-`META_TEMPLATES` + `PETRA_TEMPLATE_CATALOG` + `STARTER_TEMPLATES` ולסווג:
      מכילה "פטרה"/"Petra" · מכילה "כלב"/🐾/"עצמות" · פרמטר שמקבל ערך כלבי · נקייה.
- [ ] לתעד ב-`docs/verticals/meta-templates-audit.md` — כולל אילו תבניות מאושרות (לא בקטלוג, הטקסט
      מגיע מ-Meta) **לא ניתן לבדוק מכאן** ודורשות בדיקה ב-WhatsApp Manager.

## 5.2 קוד
- [ ] `appointmentFollowupChain` — fallback ל-{{2}} לפי ורטיקל (`vocab("messages.followup_subject")`).
- [ ] זרימות שלא קיימות ב-generic (פנסיון, חיסונים, יום הולדת לחיה) — לא נשלחות כי המודול מוסתר
      (לוודא: `scheduleVaccinationReminder` / יום הולדת לא רצים לעסק generic).
- [ ] free-text fallback (חלון 24h) — טקסטים עם "כלב" עוברים דרך `vocab`.
- [ ] `STARTER_TEMPLATES` — ב-generic ניסוח בלי כלב.
- [ ] Sender name / חתימת מיילים ללקוח — `BrandingSettings.senderName` → שם העסק.

## קריטריוני קבלה
- [ ] `tsc` נקי, `prisma validate` ×2.
- [ ] `meta-template-catalog.test.ts` + `whatsapp-free-text-guard.test.ts` ירוקים.
- [ ] בדיקת יחידה: `appointmentFollowupChain` ב-generic לא מכיל "כלב"; ב-dogs זהה למקור.
- [ ] רשימה בדוח: תבניות מאושרות שמכילות "פטרה" וצריך להגיש חדשות.
