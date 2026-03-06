# מודול אימונים — Training Module Handoff

> עדכון אחרון: מרץ 2026

---

## מה המודול עושה

מעקב לוגיסטי על כלבי אימון — מי בתהליך, באיזה שלב, כמה מפגשים נותרו, ומה השלב הבא.
מחולק ל-5 סוגי אימון:

| סוג | תיאור | נתון בסיס |
|-----|--------|-----------|
| **אילוף בבית הלקוח** | אילוף פרטי / חבילות / חלופת פנסיון | `TrainingProgram` עם `trainingType = HOME` |
| **אילוף בתנאי פנסיון** | כלב בפנסיון + תוכנית אימון מקושרת | `TrainingProgram` עם `boardingStayId` |
| **אילוף קבוצתי** | קבוצות שבועיות + סדנאות מיוחדות | `TrainingGroup` |
| **כלבי שירות** | תוכניות לכלבי שירות | `TrainingProgram` עם `trainingType = SERVICE_DOG` |
| **סקירה** | ריכוז כל הכלבים עם סטטוס + WhatsApp | נגזר מכל הנתונים |

---

## ניווט — טאבים ותת-טאבים

```
/training
├── סקירה (overview)           ← ריכוז כולל, מקובץ לפי דחיפות
├── אילוף בבית הלקוח (individual)
│   ├── אילוף פרטני             ← תוכניות ללא packageId ו-boardingStayId
│   ├── חבילת אילוף             ← תוכניות עם packageId + ניהול חבילות
│   └── חלופות פנסיון בבית הלקוח ← תוכניות עם boardingStayId
├── אילוף בתנאי פנסיון (boarding) ← לינות פעילות + תוכנית מקושרת
├── אילוף קבוצתי (groups)
│   ├── קבוצות אימון            ← groupType != WORKSHOP
│   └── סדנאות מיוחדות          ← groupType == WORKSHOP
└── כלבי שירות (service-dogs)   ← trainingType == SERVICE_DOG
```

---

## מבנה נתונים (Prisma Models)

### TrainingProgram
```
id, businessId, dogId, customerId
name, programType (BASIC_OBEDIENCE / REACTIVITY / PUPPY / BEHAVIOR / ADVANCED / CUSTOM)
trainingType (HOME / BOARDING / SERVICE_DOG)
status (ACTIVE / COMPLETED / PAUSED / CANCELED)
startDate, endDate, totalSessions
packageId?       ← מקושר לחבילה (TrainingPackage)
boardingStayId?  ← מקושר ללינה (BoardingStay)
location, frequency, price, notes
workPlan, behaviorBaseline, customerExpectations
sessions[]       ← TrainingProgramSession
goals[]          ← TrainingProgramGoal
homework[]       ← TrainingProgramHomework
```

### TrainingProgramSession
```
id, trainingProgramId
sessionNumber, sessionDate, durationMinutes
status (COMPLETED / SCHEDULED)
summary, rating (1-5), practiceItems, nextSessionGoals, homeworkForCustomer
```

**Auto-complete logic** (ב-`/api/training-programs/[id]/sessions` POST):
כשמוסיפים session עם status=COMPLETED, API בודק אם `completedCount >= totalSessions` → מעדכן `program.status = COMPLETED`.

### TrainingPackage
```
id, businessId, name, description
type (HOME / BOARDING / GROUP / WORKSHOP)
sessions (count), durationDays, price, isActive
```

### TrainingGroup
```
id, businessId, name, groupType (PUPPY_CLASS / REACTIVITY / OBEDIENCE / CUSTOM / WORKSHOP)
location, defaultDayOfWeek, defaultTime, maxParticipants, isActive
participants[]  ← TrainingGroupParticipant (dog + customer)
sessions[]      ← TrainingGroupSession (עם attendance)
```

---

## API Routes

| Method | Route | תיאור |
|--------|-------|-------|
| GET/POST | `/api/training-programs` | רשימה / יצירה |
| GET/PATCH | `/api/training-programs/[id]` | פרופיל / עדכון |
| POST | `/api/training-programs/[id]/sessions` | הוספת מפגש |
| GET/POST/PATCH | `/api/training-programs/[id]/goals` | יעדים |
| GET/POST/PATCH/DELETE | `/api/training-programs/[id]/homework` | שיעורי בית |
| GET/POST | `/api/training-groups` | קבוצות |
| GET/PATCH | `/api/training-groups/[id]` | קבוצה בודדת |
| POST/DELETE | `/api/training-groups/[id]/participants` | הוספה/הסרת משתתף |
| POST | `/api/training-groups/[id]/sessions` | מפגש קבוצתי |
| PATCH | `/api/training-groups/[id]/sessions/[sid]` | עדכון מפגש |
| PATCH | `/api/training-attendance/[id]` | סימון נוכחות |
| GET/POST | `/api/training-packages` | חבילות |
| GET/PATCH/DELETE | `/api/training-packages/[id]` | חבילה בודדת |

**Query params שימושיים:**
- `GET /api/training-programs?trainingType=BOARDING` — רק תוכניות פנסיון
- `GET /api/training-programs?trainingType=SERVICE_DOG` — רק כלבי שירות
- `GET /api/training-packages?includeInactive=true` — כולל לא פעיל
- `GET /api/training-groups?active=true` — רק קבוצות פעילות

---

## לוגיקת Overview Tab

```typescript
// "דורשים תשומת לב" — אחת מהתנאים:
sessionsRemaining <= 2 && status === "ACTIVE"
daysSinceLastSession >= 14 && status === "ACTIVE"

// "באימון פעיל" — פעיל ולא בהתראה
// "הושלמו" — status === "COMPLETED"
```

כל כרטיסיה מציגה:
- נקודת סטטוס: 🟢 פעיל | 🔴 דחוף | ⚫ הושלם
- Progress bar (אדום אם מפגשים נמוכים)
- ימים מהמפגש האחרון
- כפתור WhatsApp → `https://web.whatsapp.com/send?phone=...`

---

## יצירת תוכנית אוטומטית מהזמנה

ב-`/api/orders` POST — כשמוסיפים הזמנת אילוף עם `petId`:
```typescript
if (orderType === "training" && appointmentData?.petId) {
  // מחשב totalSessions לפי lines עם unit="per_session"
  await tx.trainingProgram.create({ trainingType: "HOME", ... });
}
```

---

## סטטוס לקוח "לקוח פעיל" בפנסיון

בטאב "אילוף בתנאי פנסיון":
- אין תוכנית → badge אפור "ללא תוכנית אילוף"
- תוכנית ללא תאריכים → badge ענבר "בהגדרה — חסרים תאריכים"
- תוכנית עם `startDate` + `endDate` → badge ירוק "לקוח פעיל ✓"

---

## קבצים מרכזיים

```
src/app/(dashboard)/training/page.tsx    ← כל הלוגיקה והרנדר של המודול (~2500 שורות)
src/lib/training-programs.ts            ← PROGRAM_TYPE_COLORS
src/lib/training-groups.ts              ← GROUP_TYPE_LABELS, GROUP_TYPE_COLORS
src/app/api/training-programs/          ← API routes
src/app/api/training-groups/            ← API routes
src/app/api/training-packages/          ← API routes
src/app/api/training-attendance/        ← PATCH attendance
```

---

## מה עוד ניתן לפתח

- [ ] **לוח אימונים שבועי** — טאב שמציג מי מגיע איזה יום
- [ ] **תזכורת אוטומטית** — cron שמזהה כלבים ב-14+ ימים ללא מפגש ושולח WhatsApp
- [ ] **דוח PDF** — סיכום תוכנית לסיום לשליחה לבעל הכלב
- [ ] **ממשק לקוח** — לינק לבעל הכלב לצפייה בהתקדמות בלבד (read-only)
- [ ] **תחרויות / הסמכות** — שדה achievement ל-TrainingProgram
