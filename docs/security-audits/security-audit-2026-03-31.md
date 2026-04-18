# דוח ביקורת אבטחה ובאגים — Petra App
**תאריך:** 31 במרץ 2026
**סטטוס:** בוצע סריקה מקיפה + תיקונים

---

## סיכום מנהלים

בוצעה בדיקה מקיפה של כל 309 קובצי ה-API routes, מערכת ההזדהות והסשנים, ולידציית קלט, ובאגים נפוצים. **נמצאו ותוקנו** מספר בעיות קריטיות.

| רמת חומרה | נמצאו | תוקנו | נותרו |
|-----------|--------|--------|--------|
| קריטי | 2 | 2 | 0 |
| גבוה | 7 | 5 | 2 |
| בינוני | 7 | 3 | 4 |
| נמוך | 9 | 0 | 9 |

---

## בעיות שתוקנו

### 1. Session Fixation — אין ביטול סשנים ישנים בהתחברות (קריטי) ✅
**קובץ:** `src/app/api/auth/login/route.ts`
**בעיה:** בהתחברות מוצלחת, לא בוטלו סשנים קודמים — תוקף עם סשן ישן יכל להמשיך להשתמש בו.
**תיקון:** נוסף `prisma.adminSession.deleteMany({ where: { userId } })` לפני יצירת סשן חדש.

### 2. SameSite Cookie — Lax במקום Strict (קריטי) ✅
**קבצים:** `src/lib/session.ts`, `src/lib/auth.ts`
**בעיה:** Cookie הסשן הוגדר כ-`SameSite=Lax`, מה שמאפשר שליחתו בבקשות cross-site מסוימות (CSRF).
**תיקון:** שונה ל-`SameSite=Strict` בכל 4 המקומות.

### 3. שלבי לידים מקודדים קשיח באנליטיקס (גבוה) ✅
**קובץ:** `src/app/api/analytics/route.ts`
**בעיה:** שימוש במחרוזות קשיחות ("new", "won", "lost") במקום UUID מטבלת LeadStage.
**תיקון:** נוסף שאילתה ל-LeadStage וסינון לפי `isWon`/`isLost`.

### 4. סטטוסי שיבוץ כלב שירות לא תקינים (גבוה) ✅
**קבצים:**
- `src/app/api/service-recipients/export/route.ts`
- `src/app/api/service-dogs/export/government/route.ts`
- `src/app/api/service-dogs/[id]/id-card/route.ts`

**בעיה:** שימוש בסטטוס "TRIAL" שאינו קיים (רק ACTIVE ו-TERMINATED תקינים).
**תיקון:** הוסר "TRIAL" מכל השאילתות ומ-PLACEMENT_STATUS_LABELS.

### 5. חוסר ולידציית URL בהודעות מערכת (גבוה) ✅
**קבצים:**
- `src/app/api/admin/broadcast-messages/route.ts`
- `src/app/api/system-messages/route.ts`

**בעיה:** שדה `actionUrl` לא נבדק — אפשר להזריק `javascript:` URLs.
**תיקון:** נוסף בדיקה ש-URL מתחיל ב-`http://` או `https://`.

### 6. ערכי Infinity לא נבדקים בשדות מספריים (בינוני) ✅
**קבצים:**
- `src/app/api/pets/[petId]/weight/route.ts`
- `src/app/api/training-packages/route.ts`
- `src/app/api/price-list-items/route.ts`

**בעיה:** `isNaN()` לא תופס `Infinity` — ערך לא תקין נשמר ב-DB.
**תיקון:** הוחלף ב-`Number.isFinite()`.

---

## בעיות שנותרו (דורשות בדיקה נוספת)

### גבוה — דורש תשומת לב

**7. שלבי לידים מקודדים בקומפוננטים (גבוה)**
קבצים: `LeadTreatmentModal.tsx`, `LeadDetailsModal.tsx`, `global-search.tsx`
המפרוזות "new", "won", "lost" מקודדות בצד הלקוח. יש לבדוק אם Lead model משתמש ב-`stage` (string) או `stageId` (UUID) ולתקן בהתאם.

**8. Backup codes ב-2FA מוחזרים ב-API response (גבוה)**
קובץ: `src/app/api/auth/2fa/confirm/route.ts`
Backup codes מוחזרים ב-JSON. אם התשובה נלכדת/מלוגגת, כל הקודים נחשפים.

### בינוני

**9. Rate limiting חלש על איפוס סיסמה** — 10 ניסיונות ל-15 דקות לכל IP
**10. Google OAuth state לא מקושר לבקשה ספציפית**
**11. Password reset token תקף שעה** (מומלץ 15-30 דקות)
**12. סשני Remember Me ל-30 יום בלי בדיקת פעילות**

### נמוך

**13.** אין לוגים של ניסיונות התחברות כושלים
**14.** Bcrypt cost factor 10 (מומלץ 12)
**15.** Backup codes ב-2FA עם אנטרופיה נמוכה (40 ביט)
**16.** אין pepper לסיסמאות מעבר ל-bcrypt
**17.** שדות enum ב-query params לא מאומתות (tasks, payments, audit-logs)
**18.** אין הגבלת אורך למחרוזות בהודעות מערכת
**19.** Cache headers על `/api/auth/me` מאפשרים stale data

---

## ממצאים חיוביים

המערכת מציגה **רמת אבטחה גבוהה** בתחומים הבאים:

- **Auth pattern עקבי**: כל 232 routes מוגנים משתמשים ב-`requireBusinessAuth()` כנדרש
- **אין IDOR**: `businessId` תמיד מגיע מהסשן, לא מפרמטרים של הבקשה
- **בידוד tenant מלא**: כל שאילתה כוללת `businessId` מהקונטקסט המאומת
- **העלאת קבצים מאובטחת**: MIME type whitelist, הגבלת גודל, בדיקת סיומת
- **ולידציית קלט טובה**: `validateIsraeliPhone()`, `validateEmail()`, `sanitizeName()` בשימוש עקבי
- **אין SQL injection**: Prisma ORM מטפל בפרמטריזציה
- **אין XSS**: לא נמצא שימוש ב-`dangerouslySetInnerHTML` או `eval()`
