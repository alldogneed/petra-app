# חקירת קוד פטרה לקראת הסוכן הקולי "אלירן" (AllDog)

תאריך: 11/11/2026 · ענף: `claude/petra-code-review-voice-agent-46visc` · קריאה בלבד, לא שונה שום קובץ בריפו.
שמות משתני סביבה מופיעים בשמם בלבד, בלי ערכים.

> הערה: ההודעה נקטעה בסעיף 7 ("האם חיפוש…"). סעיף 7 כאן עונה על נרמול טלפונים ועל ביצועי החיפוש לפי טלפון (אינדקסים), שזה כנראה ההמשך.

---

## תקציר מנהלים

1. **אין היום "פגישה לליד ביומן של רחלי".** המודל הכי קרוב הוא `LeadMeeting`: הוא מקושר לליד, חוסם שעות בהזמנה אונליין, מוצג ביומן ושולח תזכורת. אבל אין לו שיוך לאיש צוות, אין סנכרון לגוגל, אין בדיקת התנגשויות ואין הודעת אישור בזמן הקביעה. `Appointment` דורש `customerId` (חובה) ולא יכול להיקשר לליד.
2. **אין בפטרה מושג של יומן לפי איש צוות.** `Appointment.staffId` ו-`Task.assigneeUserId` מצביעים למודל הישן `User` ושום קוד לא כותב אליהם. מנוע הזמינות עובד לפי עסק, ושעות גוגל מאוחדות מכל חברי הצוות המחוברים.
3. **מדיניות גוגל:** הקוד כבר מונע במכוון העברת שעות תפוסות מגוגל ללקוח AI ב-MCP (`MCP_SLOT_OPTS = { useGoogleBusy: false }`). אותו עיקרון כנראה חל גם על ElevenLabs.
4. **שכבת ה-CRM של הבוט ניתנת לשימוש חוזר כמו שהיא:** יצירה ועדכון של ליד לפי טלפון, "פונה חוזר", משימות, שיוך מקור, התראות לאור והתראות כשל. **הפרומפט, לולאת Claude ושמירת השיחה צמודים לוואטסאפ.**
5. **כפילות מול PayCall:** אם שיחה שהועברה לאלירן תדווח ב-PayCall כ-ANSWER, צינור הסיכומים יוריד הקלטה, יתמלל ויסכם אותה שוב, גם מה-webhook וגם מ-paycall-sync. אין היום סינון לפי יעד.
6. **זמני תגובה:** פונקציות ב-Seoul (`icn1`) ובסיס הנתונים ב-Seoul. המדידה המתועדת מישראל: GET מאומת ≈1.1–1.3 שניות. זה כבר על גבול השנייה-שתיים, לפני כל לוגיקה.
7. **טלפונים:** יש עשרות נורמליזרים, וגם שתי פונקציות שונות עם אותו שם `normalizeIsraeliPhone`. הבוט ו-PayCall משתמשים כבר באותו מאתר ליד (`resolveLeadForContact`). ל-`Lead` אין עמודת טלפון מנורמל ואין אינדקס על טלפון.

---

## 1. פגישה לליד

### 1.1 האם Appointment יכול להיקשר ל-Lead?
**לא, רק ל-Customer.**
- `Appointment` (`prisma/schema.prisma`, מודל `Appointment`): `customerId String` הוא שדה חובה עם cascade. שדה `leadId`: **לא נמצא**.
- יש `staffId String?` → `User` (relation `"AssignedStaff"`), כלומר המודל הישן `User` ולא `PlatformUser`/`BusinessUser`. חיפוש `staffId` ב-`src/` מחזיר **0 שימושים**: השדה מת.
- `createAppointment()` (`src/services/appointments.ts`) לא מקבל staffId.

**המודל הקיים לפגישה עם ליד: `LeadMeeting`** (`prisma/schema.prisma`, DDL `prisma/lead_meetings.sql`)
- שדות: `leadId` (cascade), `date` (יום ישראלי 00:00Z), `startTime`/`endTime` ("HH:mm" שעון ישראל), `serviceId?`, `location?`, `notes?`, `status` (scheduled | completed | no_show | canceled), `outcomeAt?`, `appointmentId?`, `createdByUserId?`.
- **שדה איש צוות או משויך: לא נמצא.** `createdByUserId` הוא רק מי שיצר.
- לוגיקה טהורה: `src/lib/lead-meetings.ts` (`LEAD_MEETING_STATUSES`, `validateMeetingSlot`, `canTransition`, `LEAD_MEETING_REMINDER_HOURS = 24`, `LEAD_MEETING_ENTITY = "LEAD_MEETING"`).
- שירות: `src/services/lead-meetings.ts`. פונקציות:
  - `createLeadMeeting`: מסרב לליד שכבר יש לו `customerId`. **אין בדיקת התנגשויות.**
  - `updateLeadMeeting`, `cancelLeadMeeting`, `listLeadMeetingsInRange`.
  - `convertLeadToCustomer`.
  - `recordLeadMeetingOutcome`: completed → ממיר את הליד ללקוח ויוצר Appointment מתויג `[פגישת ליד]`; no_show → פולואפ למחר ב-10:00.
- חוסם שעות: `getAvailableSlots` ב-`src/lib/slots.ts` טוען `leadMeeting` בסטטוס scheduled והופך אותם לזמן תפוס.
- יומן: `GET /api/leads/calendar` (`src/app/api/leads/calendar/route.ts`) מחזיר `meetings`, והם מוצגים בסגול ב-`src/app/(dashboard)/calendar/page.tsx`.
- אין סנכרון לגוגל ל-LeadMeeting. אין כלי MCP ל-LeadMeeting (**לא נמצא**).
- פער מתועד: `findAppointmentConflicts` (`src/lib/mcp/tools-calendar.ts`) לא מתחשב ב-LeadMeeting.

### 1.2 מה הבוט עושה היום בסוף שיחה ("לחזור טלפונית")
- `scheduleCallback` ב-`src/lib/alldog-bot/actions.ts` (בתוך `createDbExecutor`) עושה שני דברים:
  - מוסיף fact לשורת היומן של השיחה (`updateConversationLog` + `callbackFact`).
  - אם אין משימת LEAD פתוחה עם "לחזור טלפונית", קורא ל-`createLeadTask` (`src/lib/alldog/leads.ts`) → `createTask` (`src/services/clients.ts`).
- **מודל:** `Task`. השדות:
  - כותרת `[דחוף: ]לחזור טלפונית ל<שם> (וואטסאפ)`
  - `category "LEADS"`, `relatedEntityType "LEAD"`, `relatedEntityId = leadId`
  - עדיפות `HIGH` (או `URGENT` אם הליד סומן דחוף, דרך `markUrgent`)
  - `dueDate` = היום, בלי שעה (במכוון: הבוט לא מתזמן)
- **בעלים:** אין. `Task.assigneeUserId` קיים בסכמה אבל מצביע ל-`User` הישן, ו-`createTask` לא מקבל אותו. כתוב במפורש ב-`src/services/business-admin-team.ts`: "nothing in Petra (UI, API, MCP) ever sets it — tasks are not assigned to team members".
- **איפה מוצג:**
  - `/tasks` (קטגוריית "לידים", עם קישור לליד מ-`listTasks`)
  - דשבורד ("משימות פתוחות")
  - יומן (`/api/tasks?from&to&status=OPEN`)
  - היסטוריית מכירה בכרטיס לקוח (`src/lib/lead-sales-history.ts`)
  - MCP `get_lead` / `list_tasks`
  - **כרטיס הליד (`LeadTreatmentModal`) לא מציג משימות.**
- בהעברה לנציג (`handoff`) נוצרת משימה URGENT "להתקשר ל…" עם התמליל, ונשלחת התראה לאור (`notifyOwnerAllDog`).

### 1.3 ScheduledMessage – האם אפשר לתזמן הודעה לליד?
- `ScheduledMessage` (`prisma/schema.prisma`): `customerId String?` (nullable), וזה הקשר היחיד. `leadId`: **לא נמצא**.
- ליד מקבל הודעה רק דרך `payloadJson.to` + `relatedEntityType`/`relatedEntityId`. ההערה בסכמה מזכירה רק GROUP_SESSION | BOOKING, אבל בפועל משתמשים גם ב-`APPOINTMENT`, `LEAD_MEETING`, `LEAD_FOLLOWUP`.
- **כן, אפשר, אבל רק מקוד שרת.** הדוגמאות הקיימות: `scheduleLeadMeetingReminder` ו-`scheduleLeadFollowup` ב-`src/lib/reminder-service.ts`.
- אין API ליצירת הודעה מתוזמנת שרירותית: `/api/scheduled-messages` מאפשר GET בלבד, `[id]` מאפשר GET/PATCH, ויש `[id]/send`.
- שער build: כל `scheduledMessage.create` בלי `templateChain` נכשל ב-`scripts/audit-whatsapp-free-text.mjs`.
- השליחה: `processPendingReminders` ב-`src/lib/scheduled-messages.ts` עם `phone = payload.to ?? customer.phone`. יש בדיקה בזמן שליחה ל-`LEAD_MEETING`: ההודעה נזרקת אם הפגישה כבר לא scheduled, הליד הומר, או שהשעה עברה.

### 1.4 מנגנון התזכורות
- **תור:** `scheduleAppointmentReminder` (`src/lib/reminder-service.ts`).
  - תנאים: `whatsappRemindersEnabled` + tier `whatsapp_reminders`.
  - offset: חוק `appointment_reminder`, אחרת `whatsappReminderLeadHours`, אחרת 48 שעות.
  - נוצר ScheduledMessage עם `relatedEntityType "APPOINTMENT"` ו-`templateChain = appointmentReminderChain`.
- **פגישת ליד:** `scheduleLeadMeetingReminder` (אותו קובץ).
  - ברירת מחדל 24 שעות לפני, או חוק `lead_meeting_reminder`.
  - `customerId: null`, `payload.to` = טלפון הליד, `flow "lead_meeting_reminder"`, אותה שרשרת `appointmentReminderChain`. פרמטר 4 = שם השירות או "הפגישה שלנו".
- **הפעלה:** `GET /api/cron/send-reminders` (אימות `verifyCronAuth` / `verifyCronAuthWithVault`).
  - ראשי: Supabase pg_cron כל 5 דקות (`prisma/cron_send_reminders.sql`).
  - גיבוי: `.github/workflows/cron.yml` ו-`vercel.json` (יומי).
- **ערוץ:** וואטסאפ דרך `sendWithTemplateChain` → `resolveWhatsAppSender`. זה **מספר הפלטפורמה של פטרה**, או מספר עצמי של העסק אם יש `WhatsAppConnection` פעיל. **לא מספר הבוט של AllDog.**
- **הודעת אישור בזמן קביעה:** קיימת ל-Appointment (`appointmentConfirmationChain` ב-`src/app/api/appointments/route.ts`, `orders/route.ts`, `book/[slug]/booking/route.ts`, `booking/bookings/[id]/route.ts`). **ל-LeadMeeting: לא נמצא.**

**תבניות רלוונטיות** (`META_TEMPLATES` ב-`src/lib/reminder-service.ts`, `PETRA_TEMPLATE_CATALOG` ב-`src/lib/meta-template-catalog.ts`):

| תבנית | מספר שולח | מצב לפי הקוד והתיעוד |
|---|---|---|
| `petra_appointment_reminder_v2` → `petra_appointment_reminder` | פלטפורמה | מאושרות, עם ניסוח של כלבים (`docs/verticals/meta-templates-audit.md`, ביקורת 31/10/2026) |
| `petra_appointment_confirmation_v2` → `petra_appointment_confirmation` | פלטפורמה | מאושרות, עם ניסוח של כלבים |
| `petra_meeting_reminder` / `petra_meeting_confirmation` | פלטפורמה | בקטלוג, ניסוח ניטרלי. בביקורת 31/10 עדיין חיכו לאישור. הסטטוס החי זמין רק מ-`GET /api/cron/sync-platform-templates` (לא הורץ) |
| `petra_appointment_followup` | פלטפורמה | לא מאושרת לפי CLAUDE.md |
| `petra_lead_followup_notice` → `petra_lead_followup` | פלטפורמה | `petra_lead_followup` מאושרת |
| `missed_call_followup`, `missed_call_after_hours`, `missed_call_weekend` | **בוט AllDog** (`src/lib/alldog/missed-call-rules.ts`) | מאושרות (גוף התבנית ב-`MISSED_CALL_TEMPLATE_TEXT`) |
| `lead_followup_open`, `lead_followup_closed`, `lead_followup_weekend` | **בוט AllDog** (`src/lib/alldog/form-lead-rules.ts`) | מסומנות "Approved Meta templates" |
| תבנית אישור או תזכורת לשיחה/פגישה במספר של AllDog | — | **לא נמצא** |

- שולח הבוט: `src/lib/alldog-bot/wa.ts` (`sendText` רק בחלון 24 שעות, `sendTemplate`, `sendTemplateSteps`). זו אפליקציית Meta נפרדת. משתני סביבה: `ALLDOG_WA_TOKEN`, `ALLDOG_WA_PHONE_NUMBER_ID`, `ALLDOG_WA_GRAPH_VERSION`. היא אף פעם לא עוברת דרך `whatsapp.ts` / `resolveWhatsAppSender`.

---

## 2. יומן ואיש צוות

### 2.1 שיוך פגישה לאיש צוות
- `Appointment.staffId` → `User` הישן, ולא בשימוש (ראו 1.1).
- `LeadMeeting`, `Booking`, `Lead`: אין שדה משויך (**לא נמצא**). לליד יש רק `wonByUserId` / `lostByUserId`.
- השיוך האמיתי היחיד לחבר צוות (`PlatformUser`) הוא `BoardingStay.assignedToUserId`.

### 2.2 מנוע הזמינות
- `getAvailableSlots(businessId, duration, localDateStr, bufferBefore, bufferAfter, { useGoogleBusy?, hours? })` ב-`src/lib/slots.ts`.
- **אין פרמטר איש צוות. לא יודע לחשב זמינות לפי איש צוות.**
- **כן יודע לחשב לפי שעות של שירות בודד:** `hours` = `PriceListItem.bookingHours`, שמחליף את שעות העסק (`resolveDayWindow` ב-`src/lib/booking-hours.ts`).
- מחסיר: `AvailabilityBlock`, `AvailabilityBreak`, `Booking` (confirmed/pending), `Appointment` (לא canceled/completed), `LeadMeeting` (scheduled), כולל buffers. מוסיף גם הודעה מינימלית מראש ו-`bookingMaxAdvance`. בונה חלונות בצעדים של 15 דקות.
- קוראים לו מ:
  - `/api/book/[slug]/slots`
  - הבדיקה החוזרת ב-booking POST
  - `/api/booking/slots`
  - MCP `find_free_slots` (`src/lib/mcp/tools-calendar.ts`, עד 7 ימים קדימה בלולאה סדרתית)
  - `reschedule_appointment`
- אין מודל שעות לאיש צוות (**לא נמצא**).

### 2.3 יומן גוגל
- הטוקנים נשמרים לכל משתמש על `PlatformUser`: `gcalAccessToken`/`gcalRefreshToken` מוצפנים, `gcalSyncEnabled`, `gcalCalendarId`.
- המתג העסקי: `Business.gcalBlockExternal`.
- `getGcalBusyIntervals` (`src/lib/google-calendar.ts`) עובר **סדרתית על כל חברי הצוות המחוברים** (`findConnectedUsersForBusiness`). לכל אחד: רענון טוקן אם צריך, ואז `freeBusy` על `primary`. הכל מאוחד לרשימה אחת לעסק כולו. **לא לפי איש צוות**, ו-**בלי timeout** ל-fetch.
- ב-MCP: `MCP_SLOT_OPTS = { useGoogleBusy: false }`. ההערה בקוד: נתוני גוגל (כולל נגזרות) לא יוצאים לשירות AI צד שלישי (Limited Use). ההערה התואמת ב-`slots.ts`.
- דחיפת אירועים לגוגל (`syncAppointmentToGcal` → `pushEventToConnectedCalendars`) הולכת **לכל** חבר צוות מסונכרן, לא למשויך מסוים.

### 2.4 איפה נשמרות השעות
- שעות פעילות: `AvailabilityRule` (שורה לכל יום בשבוע לעסק). ברירת מחדל `defaultBusinessDay` ב-`src/lib/booking-hours.ts`.
- חסימות: `AvailabilityBlock` (UTC). הפסקות: `AvailabilityBreak`.
- הגדרות הזמנה על `Business`: `bookingBuffer`, `bookingMinNotice`, `bookingMaxAdvance`, `gcalBlockExternal`, `timezone`.
- שעות לשירות: `PriceListItem.bookingHours` (Json). שירות: `src/services/booking-hours.ts`.

---

## 3. שלבי לידים

### 3.1 לוגיקה שנשענת על שם או מזהה של שלב
- `newLeadStageId` (`src/lib/alldog/leads.ts`): `PAYCALL_NEW_LEAD_STAGE_ID`, אחרת שלב בשם המדויק **"ליד חדש"**, אחרת השלב הפתוח הראשון. משמש את הבוט ואת PayCall.
- כשאין שלב זכייה נוצר שלב בשם "נסגר בהצלחה" (`convertLeadToCustomer` ב-`src/services/lead-meetings.ts`, `close-won/route.ts`). כשאין שלב הפסד: "אבד" (`close-lost`).
- ברירות מחדל: `DEFAULT_LEAD_STAGES` ב-`src/lib/lead-stages.ts` (ליד חדש, יצירת קשר, ייעוץ ראשוני, הצעת מחיר, ממתין להחלטה, לקוח=isWon, אבד=isLost). `ensureDefaultStages` רץ ב-`GET /api/leads/stages`.
- MCP: `resolveLeadStageByName` (`src/lib/mcp/tools-intake.ts`). מחפש התאמה מדויקת, אחרת התאמה חלקית יחידה, אחרת שגיאה.
- דוחות: `src/lib/sales-report.ts`. המשפך = שלבים פתוחים לפי `sortOrder` + שלב הזכייה. "הגיע לשלב" נקבע לפי השלב הנוכחי, `previousStageId`, ו**שמות** שלבים שנקראים מ-CallLog מסוג `stage_change` (`parseStageChangeSummary`: `הועבר מ"X" ל"Y"`).
- כל השאר משתמש בדגלים `isWon`/`isLost` או במזהה (קנבן ב-`src/app/(dashboard)/leads/page.tsx`, `resolveLeadForContact`).

### 3.2 השלכות של הוספת "תואמה שיחת מכירה" לעסק אחד
- השלבים שמורים לכל עסק בנפרד, אז עסקים אחרים לא מושפעים. נוספת עמודת קנבן ושלב במשפך לפי `sortOrder`. `POST /api/leads/stages` מכניס שלב אחרי השלבים הפתוחים.
- זהירות:
  - אסור לקרוא לו "ליד חדש".
  - שם שמכיל שם של שלב אחר עלול לגרום ל-MCP `stage_name` להיות דו-משמעי.
  - שינוי שם בעתיד ישבור התאמה של לוגי `stage_change` ישנים בדוחות.

### 3.3 היסטוריית מעבר בין שלבים
- `CallLog` עם `type: "stage_change"` נכתב **רק מצד הלקוח בדפדפן**:
  - גרירה בקנבן (`src/app/(dashboard)/leads/page.tsx`)
  - `LeadTreatmentModal.tsx`
  - שניהם דרך `POST /api/leads/[id]/logs`
- `updateLead` (`src/services/clients.ts`) **לא כותב** stage_change. לכן שינוי שלב מ-MCP, API או אוטומציה לא משאיר היסטוריה.
- קיימים: `Lead.previousStageId`, `wonAt`/`wonByUserId`, `lostAt`/`lostByUserId`/`lostReasonCode` (נחתמים ב-`updateLead`).
- `stageChangedAt`: **לא נמצא**.

---

## 4. שימוש חוזר בבוט הוואטסאפ

### 4.1 איפה יושבים ההנחיות והכללים, ומה מופרד מהערוץ

| רכיב | קובץ | מופרד מהערוץ? |
|---|---|---|
| פרומפט | `src/lib/alldog-bot/prompt.ts`: קבוע יחיד `ALLDOG_BOT_PROMPT` + `buildBotContext()` | טהור (בלי prisma ובלי wa.ts), אבל **הטקסט כתוב לוואטסאפ**: "אתה כותב בוואטסאפ", פיצול ל-2 הודעות, אימוג'י, קישורים, הודעות קוליות. אין builder או פרמטר ערוץ. העובדות העסקיות, המחירים, האזורים, סדר האיסוף ומקרי הבטיחות ניטרליים אבל ארוזים בתוך אותו קבוע |
| Playbook | `playbook.ts` (`OBJECTIONS`, `BOUNDARIES`, `ALWAYS`, `NEVER`, `renderPlaybook()`) | כמעט ניטרלי (מעט אימוג'י) |
| lookup_guide | `knowledge.ts` (`searchKnowledge`, `lookupGuide`), נתונים ב-`knowledge-data.json` | טהור לגמרי. רק ניסוח התוצאה של `lookupGuide` מניח זרימת וואטסאפ |
| הצעת מדריך | `guide-offer.ts` | צמוד (prisma + שורות `WaBotMessage`) |
| כללי טקסט | `logic.ts` (בלי imports) | מעורב. גנרי: `polishReply`, `fixHebrewSlips`, `applyConversationGuards`, `seemsMinor`, `isSeriousIncident`. וואטסאפ: `classifyInbound`, `botMayReply`/24h, `waitForQuiet`, `splitReply`, `typingDelayMs`, `arrangeGuideLink` |
| מחירים ושאלה אחת בכל פעם | `reply-rules.ts` | טהור, ניטרלי ברובו |
| פנייה כללית / כבר עם נציגה | `general-rules.ts` | טהור. חלק מהקבועים עם אימוג'י או `[וואטסאפ · בוט]` |
| שפה | `language.ts` | טהור |
| פנייה לפי מגדר | `address.ts` | טהור, ניטרלי |
| סגירה והעברה | `handoff.ts` | הסגירה כוללת "אפשר לכתוב לי פה" ו-🙏, כלומר וואטסאפ |

**מסקנה:** ערוץ קולי יכול לקרוא היום ישירות ל-`knowledge.ts`, `playbook.ts`, `address.ts`, `language.ts` ולחלק מ-`reply-rules.ts`/`logic.ts`. כדי לשתף את הפרומפט צריך לפצל את `ALLDOG_BOT_PROMPT` לחלק עסקי משותף ולחלק ערוץ. זה לא קיים היום.

### 4.2 סכמת WaBotConversation ו-WaBotMessage
- `WaBotConversation`:
  - `phone` (ספרות E.164 כמו ש-Meta שולחת), `status` (בפועל active | handoff | stopped | closed_partial | general)
  - `leadId?`, `profileName?`, `attributionSource?`, `attributionPage?`, `summaryCallLogId?`
  - חותמות זמן `lastInboundAt`, `lastBotReplyAt`, `handoffAt`, `handoffNotifiedAt`, `handoffAckAt`, `lastHumanAt`, `resumedAt`, `stoppedAt`
  - **`@@unique([businessId, phone])`**
- `WaBotMessage`:
  - `role` (user | assistant | human | system)
  - `kind`: בפועל text, voice, image, media וסוגי מערכת רבים (missed_call_*, form_lead_*, guide_*, nudge, partial_close…)
  - `text`, **`waMessageId? @unique`**
- **שדה ערוץ: לא נמצא** בשני המודלים.
- טכנית אפשר לשמור שם שיחה קולית כ-`kind` חדש עם `waMessageId` סינתטי (כמו `missed-call:<id>`). אבל בגלל `@@unique([businessId, phone])` השיחה הקולית תחלוק את אותה שורת שיחה עם הוואטסאפ, כולל הסטטוס, ה-handoff ו-`summaryCallLogId`.
- הנחות וואטסאפ בקוד:
  - `ingestMessage` (`inbound.ts`) עושה upsert לפי טלפון.
  - `botMayReply` (חלון 24 שעות).
  - סשן של 12 שעות שמנקה את `summaryCallLogId`.
  - קרון הסיכומים (`summarizeIdleConversations`) וקרון התזכורות (nudge) עובדים על שיחות active/handoff.
- **מודל נפרד (או עמודת ערוץ + DDL) בטוח יותר.**

### 4.3 יצירה ועדכון של ליד מתוך הבוט
**`src/lib/alldog/leads.ts`.** עובד עם `(businessId, phone, fields)` בלבד, בלי תלות ב-WaBotConversation. PayCall כבר משתמש בו כך.
- `upsertLeadFromContact(input: LeadContactInput)` → `{ leadId, created }`.
  - שדות הקלט: `businessId, phone, name?, placeholderName, source, city?, requestedService?, pet?, creationNote?, attribution?, contactedAt?, refresh?`
  - בלי `refresh` ממלא רק שדות ריקים. עם `refresh` (בוט בלבד) מחליף שם, עיר, שירות ובלוק כלב.
  - שדות השיוך (attribution) נכתבים רק כשהם ריקים.
- **פונה חוזר:**
  - `resolveLeadForContact` → `{ active, previous }`. ליד פעיל = שלב פתוח (won/lost נבדקים לפי id) שנגעו בו ב-`STALE_LEAD_DAYS = 60` הימים האחרונים, או שיש לו פולואפ עתידי (`isActiveLead`).
  - אין ליד פעיל → נוצר ליד חדש עם `returningContactNote()` ("פונה חוזר – ליד קודם…" / "לקוח קיים…").
  - `isPlaceholderLeadName` מזהה שמות גנריים.
- עזרים נוספים: `createLeadTask`, `addLeadCallLog`, `updateLeadCallLog`, `findCallLogForCall`/`callIdAlreadyLogged` (אידמפוטנטיות לפי `call_id:`), `setLeadFollowUp`. הם עוטפים את `createLead` / `updateLead` / `createTask` ב-`src/services/clients.ts`.
- **מקור:**
  - בוט: `BOT_LEAD_SOURCE = "וואטסאפ · בוט"` (`actions.ts`)
  - PayCall: `paycall_missed_call` / `paycall_answered_call`
  - שיוך תנועה מהבוט: `botLeadAttribution` (`src/lib/alldog-bot/attribution.ts`, טהור)
- **לקוח קיים:** הבוט תמיד יוצר או מעדכן ליד. PayCall בלבד הופך לקוח קיים להערה + משימה (`src/lib/paycall-customer.ts`).
- **צמוד לשיחת וואטסאפ:**
  - `createDbExecutor` ב-`actions.ts`: `ensureLead`, `saveLead`, `scheduleCallback`, `handoff` כותבים ל-`waBotConversation`.
  - `updateConversationLog` (שורת יומן דרך `summaryCallLogId`).
  - `summary.ts`: `summarizeBotConversation` קורא לפי conversationId, וההנחיה ל-Claude היא "מסכם שיחת וואטסאפ".
- **ניתן לשימוש חוזר:**
  - `journal.ts` (טהור; התחילית `BOT_LOG_PREFIX = "[וואטסאפ · בוט]"`)
  - `BOT_SUMMARY_JSON_SCHEMA`, `parseBotSummary`, `formatBotSummary`

### 4.4 התראות לבעל העסק והודעת גיבוי
- `notifyOwnerAllDog({ title, lines, url? })` (`src/lib/notify-owner.ts`): תבנית `petra_alldog_owner_alert` → `petra_owner_alert` → טקסט חופשי, ובנוסף מייל. ניטרלי לערוץ, ניתן לשימוש כמו שהוא.
- `alertNewLeadIfEnabled(businessId, lead)` / `sendLeadAlert` (`src/lib/lead-alert.ts`): לפי tier, אף פעם לא זורק.
- `alertAllDogFailure({ kind, error?, detail?, phone?, leadId?, test? })` (`src/lib/alldog/failure-alerts.ts`):
  - `AllDogFailureKind` = bot_reply | wa_send | transcription | webhook | call_summary | bot_summary
  - `FAILURE_KIND_TITLES` הוא `Record`, ולכן סוג חדש (למשל קולי) מחייב גם כותרת
  - הגבלה: אחת ל-30 דקות לכל סוג (`claimOnce`)
  - בדיקה ידנית: `/api/owner/alldog-test-alert`
- הודעת גיבוי: `failSafeReply` ב-`src/lib/alldog-bot/inbound.ts` (פרטית, לא מיוצאת).
  - שולחת התראה + `botFallbackText(gender)` (`handoff.ts`, "תודה! קיבלנו את ההודעה, נציגה תחזור…"), לכל היותר אחת ל-30 דקות לכל שיחה.
  - יוצרת משימה URGENT.
  - צמודה לוואטסאפ.
- Claude: `runBotTurn` ב-`src/lib/alldog-bot/agent.ts`.
  - הכלים: `lookup_guide`, `save_lead`, `schedule_callback`, `handoff_to_human`, עם ולידציית zod.
  - **ממשק `BotToolExecutor` מופשט** (`saveLead`, `scheduleCallback`, `handoff`, `markUrgent?`). הסימולטור כבר מממש stub (`scripts/alldog-sim/engine.ts`).
  - משתני סביבה: `ALLDOG_BOT_MODEL`, `ALLDOG_SUMMARY_MODEL`, `ALLDOG_ANTHROPIC_API_KEY` (נופל ל-`ANTHROPIC_API_KEY`).
  - ב-ElevenLabs ה-LLM רץ אצלם, כך ש-`runBotTurn` עצמו כנראה לא ישמש. סכמות הכלים והוולידציה כן רלוונטיות.
- דגלים (`src/lib/alldog/config.ts`): `ALLDOG_CALL_SUMMARIES_ENABLED`, `ALLDOG_WA_BOT_ENABLED`, `ALLDOG_BUSINESS_ID`. **דגל קולי או ElevenLabs Agents: לא נמצא.** קוד של ElevenLabs Agents או Telnyx: **לא נמצא**. ElevenLabs משמש רק ל-STT (`src/lib/stt.ts`).

---

## 5. PayCall

### 5.1 שיחה שלא נענתה
1. `GET /api/webhooks/paycall` (`src/app/api/webhooks/paycall/route.ts`).
   - אימות: `?secret=` מול `PAYCALL_WEBHOOK_SECRET` (`timingSafeEqual`).
   - פענוח: `parseLiveLinkParams` (`src/lib/paycall.ts`).
   - רק `Status=END` מטופל.
2. Disposition שאינו ANSWER → `getCallById` (גם `getCalls` של 7 ימים עם **limit 50** ואז find, כך שבקו עמוס אפשר לפספס) → `isMissedCall` לפי ה-DISPOSITION של ה-API (`MISSED_DISPOSITIONS`) → `processMissedCall`.
3. `processMissedCall` (`src/lib/paycall.ts`):
   - `claimOnce("paycall-call-handled:<ID>")` ל-30 יום.
   - לקוח קיים (`findCustomersByPhone`): הערה `[paycall] … call_id:` + משימה "לחזור ללקוח" (`src/lib/paycall-customer.ts`). **בלי ליד.**
   - אחרת: dedup לפי `CallLog.summary contains "call_id:<ID>"` → `resolveLeadForContact`.
     - ליד פעיל: עדכון.
     - אין: `prisma.lead.create` (שם `שיחה מ-<טלפון>`, מקור `paycall_missed_call`) + `alertNewLeadIfEnabled` + `scheduleLeadFollowup`.
   - CallLog `[paycall] שיחה שלא נענתה … call_id:<ID>`, ועדכון "מספר ניסיונות" בהערות.
4. **וואטסאפ אוטומטי:** `scheduleMissedCallWhatsApp` (`src/lib/alldog/missed-call-wa.ts`, כללים ב-`missed-call-rules.ts`). רץ אחרי התגובה, ורק אם `ALLDOG_MISSED_CALL_WA_ENABLED`.
   - תנאים:
     - קו `ALLDOG_MISSED_CALL_LINE` (התאמה ל-`PR_NUMBER`)
     - נייד ישראלי
     - שיחה מאחרי `ALLDOG_MISSED_CALL_WA_SINCE` ובת פחות מ-30 דקות
     - אין שיחת בוט פעילה, handoff או stopped
     - לא נשלחה הודעה כזו ב-7 ימים
     - לא נשלחה הודעת טופס ב-24 שעות
     - לא הייתה שיחת ANSWER מהמספר בשעה האחרונה (`answeredSince`, נבדק בזמן שליחה)
   - תור: `WaBotMessage` מסוג system/`missed_call_pending`, עם `waMessageId = missed-call:<ID>`.
   - שליחה מתוך `/api/cron/alldog-call-retry`, **מהמספר של הבוט**.
   - שעות שקטות: 21:30–08:00, שבת וחג.
   - paycall-sync **לא** מתזמן הודעות כאלה.

### 5.2 שיחה שהועברה ליעד אחר ונענתה שם (כפילות מול ElevenLabs)
- **מה PayCall ידווח בפועל על העברה ל-Telnyx (ANSWER או לא) – אי אפשר לקבוע מהקוד.** צריך לבדוק מול PayCall או על נתונים אמיתיים, למשל דרך `/api/cron/alldog-rep-report?probe=1` או הלוג של `logCallRecordKeysOnce`.
- `parseLiveLinkParams` **לא מפענח שום שדה יעד** (DST, CALLEE, PR_NUMBER).
- ברשומת ה-API (`PaycallCall` ב-`src/lib/paycall.ts`) יש `CALLEE` (הטלפון שאליו נותבה השיחה), `NAME`, `PR_NUMBER`, `ANS_TIME`.
- **אם תדווח ANSWER:**
  - ה-webhook (ענף answered, `summarizeAnsweredCall`) ואחריו `runAnsweredCall` (`src/lib/alldog/call-retry.ts`) → `processAnsweredCall` (`src/lib/alldog/call-summary.ts`).
  - **יוריד הקלטה** (`dlinkDirect`/`dlink`/`downloadRecord`), **יתמלל** (`transcribeAudio`, ElevenLabs Scribe), יסכם עם Claude, וייכתב CallLog `[paycall-answered] … call_id:`. אולי גם ייווצר ליד חדש עם התראה.
  - בנוסף: שורת coaching עם "נציג" = שם היעד או "נציג/ה …<4 ספרות אחרונות של מספר Telnyx>" (`repFromPaycall` ב-`src/lib/alldog/call-coaching.ts`).
  - תנאי: `isCallSummariesEnabled()` דולק ו-billsec ≥ 20.
- **paycall-sync** (`src/app/api/cron/paycall-sync/route.ts`, pg_cron כל 10 דקות + Vercel יומי) אוסף גם שיחות ANSWER (≥ 20 שניות) ומריץ `runAnsweredCall`, אלא אם `isQueued(callId)`.
- **סינון לפי יעד, קו או שלוחה בצינור הסיכומים: לא נמצא** (לא ב-webhook, לא ב-sync ולא ב-`runAnsweredCall`). הסינון היחיד הוא `isOfficeLine(PR_NUMBER)`, וגם הוא רק לוואטסאפ של שיחה שלא נענתה.
- **שדה אפשרי לזיהוי "נענתה ע"י אלירן":** `CALLEE` מול מספר ה-Telnyx (זמין אחרי `getCallById` וב-sync), או `NAME` אם היעד ב-PayCall יקבל תווית. אין היום דגל, עמודה או משתנה סביבה לזה.
- תופעת לוואי: וואטסאפ "שיחה שלא נענתה" **לא** יישלח לשיחה שאלירן ענה עליה (היא ANSWER, ו-`answeredSince` חוסם לשעה).
- אם ההעברה נכשלה ו-PayCall מדווח disposition של שיחה שלא נענתה, הזרימה הרגילה של 5.1 רצה.

### 5.3 PaycallCallRetry כדפוס ל-webhook של ElevenLabs
- מודל: `callId @unique`, `payload Json`, `attempts`, `nextAttemptAt`, `lockedUntil?`, `status` (pending | done | failed), `lastError?`, `coaching?`, `coachedAt?`. DDL ב-`prisma/paycall_call_retry.sql`.
- הדפוס (`src/lib/alldog/call-retry.ts`):
  - upsert לפי מזהה חיצוני, כך שזה אידמפוטנטי.
  - הנעילה היא השורה עצמה: `updateMany` מותנה עם `lockedUntil` של 5 דקות. בלי `$transaction`, ולכן מתאים ל-PgBouncer.
  - לוח ניסיונות: מיד, +3, +10, +30 דקות, +2 שעות.
  - ניסיון אחרון שנכשל → `alertAllDogFailure`.
  - קרון: `/api/cron/alldog-call-retry` (pg_cron כל 5 דקות `prisma/cron_alldog_call_retry.sql` + גיבוי ב-GitHub Actions).
- **הדפוס מתאים**, אבל אותה טבלה כמו שהיא לא: `processDueRetries` שולח כל שורה ממתינה ל-`processAnsweredCall`, שינסה להוריד הקלטת PayCall. צריך מבחין סוג (kind) או טבלה אחות. שדות ה-coaching ספציפיים לדוח הנציגים.

---

## 6. הזדהות וקריאות בזמן שיחה

### 6.1 מנגנוני M2M קיימים
| מנגנון | איפה | אופן |
|---|---|---|
| Cron | `src/lib/cron-auth.ts`: `verifyCronAuth`, `verifyCronAuthWithVault` | `Authorization: Bearer` או `x-cron-secret` מול `CRON_SECRET` / `CRON_SECRET_DB` / Vault `petra_cron_secret`, עם `timingSafeEqual` |
| Webhook לידים | `POST /api/webhooks/lead` | כותרת `x-api-key`: מפתח `pk_…` לכל עסק (`Business.webhookApiKey`, נשמר כטקסט גלוי, חיפוש ייחודי), או מפתח legacy `MAKE_WEBHOOK_SECRET` + `WEBHOOK_BUSINESS_ID` |
| PayCall | `src/app/api/webhooks/paycall/route.ts` | `?secret=` מול `PAYCALL_WEBHOOK_SECRET` (`timingSafeEqual`). יוצא: Basic auth עם `PAYCALL_USERNAME`/`PAYCALL_PASSWORD` + `PAYCALL_USER_ID` |
| Meta HMAC (בוט) | `src/app/api/webhooks/alldog-whatsapp/route.ts`: `verifyAllDogSignature` + `safeEqual` מקומי | `X-Hub-Signature-256`, HMAC-SHA256 של הגוף הגולמי עם `ALLDOG_WA_APP_SECRET`. fail-closed (503) |
| Meta HMAC (פלטפורמה) | `src/app/api/webhooks/whatsapp-status`: `verifySignature` | נאכף רק כש-`META_APP_SECRET` מוגדר |
| Cardcom | `src/lib/security/cardcom-helpers.ts`: `verifyIndicatorSignature` | HMAC של הנתיב עם `CARDCOM_WEBHOOK_SECRET` |
| חשבוניות | `src/app/api/webhooks/invoices/route.ts` | `x-webhook-signature` מול סוד מוצפן לכל עסק |
| MCP | `src/lib/mcp-auth.ts`: `validateMcpToken` | Bearer → SHA-256 → `McpConnection` (2–4 שאילתות + rate limit + audit) |

- **עוזר משותף לאימות HMAC או השוואה בזמן קבוע: לא נמצא.** כל route מממש לבד.
- **למה כל אחד מתאים:**
  - קריאות כלים מ-ElevenLabs (סוד בכותרת): הכי קרוב הוא דפוס `verifyCronAuth` (Bearer + `timingSafeEqual`) או `x-api-key` של webhook הלידים.
  - webhook סוף שיחה (HMAC על הגוף הגולמי): דפוס `verifyAllDogSignature` (קריאת raw body, fail-closed, `alertAllDogFailure` בכשל).
- Middleware (`src/middleware.ts`): `PUBLIC_PREFIX_PATHS` כולל `/api/webhooks/` ו-`/api/cron/`. לכן כל route חדש שם ציבורי ומחויב לאמת בעצמו. גם `scripts/audit-route-auth.mjs` (`PUBLIC_ROUTES`, `TOKEN_AUTH_PATTERNS`) יבדוק את זה.

### 6.2 הלוגיקה שמאחורי כלי ה-MCP

| כלי | פונקציה פנימית | מצב |
|---|---|---|
| `get_lead` | אין. `prisma.lead.findFirst` + `leadStage` + `task` + `callLog.count` inline ב-`src/app/api/mcp/route.ts` | **inline**, אין שירות `getLead` |
| `update_lead` | `updateLead(businessId, prisma, id, input, userId)` ב-`src/services/clients.ts` | שירות (בדיקת קיום ומשימת פולואפ inline ב-`tools-intake.ts`) |
| `create_lead` | `createLead` (`src/services/clients.ts`) + `updateLead` לפולואפ | שירות. שימו לב: `/api/webhooks/lead` **לא** משתמש ב-`createLead` אלא ב-`prisma.lead.create` inline |
| `find_free_slots` | `getAvailableSlots` (`src/lib/slots.ts`) + `loadCalendarSettings`/`loadRules` | מנוע רב-פעמי, פורמט inline |
| `create_appointment` | `findAppointmentConflicts` → `createAppointment` (`src/services/appointments.ts`) → `scheduleAppointmentReminder` + `scheduleAppointmentFollowup` → `syncAppointmentToGcal` | שירות. **דורש `customer_id`, לא יכול לקבוע לליד** |
| `create_task` | `createTask` (`src/services/clients.ts`) | שירות (בדיקות בעלות inline) |
| `find_duplicate` | inline (`contains` על 7 ספרות אחרונות) | **inline**. חלופות: `findCustomersByPhone`, `resolveLeadForContact` |
| פגישת ליד | `createLeadMeeting` (`src/services/lead-meetings.ts`) | שירות, **בלי כלי MCP** |

**מסקנה:** רוב הכתיבות זמינות כפונקציות שירות שאפשר לעטוף ב-endpoint דק. `get_lead` ו-`find_duplicate` בנויים inline בתוך ה-handler.

### 6.3 זמני תגובה
- אזור: `vercel.json` → `"regions": ["icn1"]` (Seoul). DB: Supabase `aws-1-ap-northeast-2` (Seoul), לפי `docs/deployment.md`.
- מדידה מתועדת מישראל (2/10/2026): edge בלבד ≈110ms, פונקציה בלי DB ≈530ms, GET מאומת ≈1.1–1.3 שניות. "~420ms Europe→Asia hop".
  - שימו לב: ElevenLabs ו-Telnyx לא בהכרח קוראים מאירופה. זמן הקפיצה תלוי במיקום השרתים שלהם (לא נבדק).
- Runtime: אין `export const runtime` או `preferredRegion` באף route, הכל Node. אין בלוק `functions` ב-`vercel.json`. `maxDuration` מוגדר רק ב-8 routes. CLAUDE.md מציין crons יומיים בלבד ב-Hobby, כלומר תוכנית Hobby.
- Cold start: **לא נמצא תיעוד** מפורש.
- Prisma: `src/lib/prisma.ts` הוא `PrismaClient` יחיד בלי הגדרות. `DATABASE_URL` דרך pooler (pgbouncer) ו-`DIRECT_URL`. `connection_limit`/`pool_timeout`: **לא נמצא**.
- **מסלולים איטיים:**
  - `getAvailableSlots`: 7 שאילתות במקביל + אולי שאילתת service, כלומר לפחות 2 סבבים ליום.
  - `find_free_slots`: כשהיום ריק, עד 7 קריאות נוספות **סדרתיות**, כלומר 14+ סבבים.
  - Google freeBusy (כשדולק): סדרתי לכל משתמש, כולל רענון טוקן אפשרי, **בלי timeout**.
  - `/api/mcp` לפני הכלי: `validateMcpToken` (2–4 שאילתות) + `rateLimitAsync` + בדיקת audit + `touchMcpConnection` + רישום ~71 כלים בכל בקשה, ו-insert של audit לכל כלי. **לא מתאים לנתיב קולי.**
  - חיפוש ליד לפי טלפון: לא מאונדקס (ראו 7).
  - `createLead`: בדיקת כפילות טוענת **את כל הלידים עם טלפון** של העסק ומשווה ב-JS.

---

## 7. טלפונים

### 7.1 נורמליזרים
| פונקציה | קובץ | פלט |
|---|---|---|
| `normalizeIsraeliPhone` | `src/lib/paycall.ts` | `0XXXXXXXXX` |
| `normalizeIsraeliPhone` (**אותו שם, פונקציה אחרת**) | `src/lib/validation.ts` | `05X-XXXXXXX` עם מקף |
| `phoneToNorm`, `duplicatePhoneWhere`, `leadPhoneToNorm` (פרטיות) | `src/services/clients.ts` | `972…` |
| `mcpPhoneToNorm` | `src/lib/mcp/tools-intake.ts` | `972…` |
| `toWhatsAppPhone` | `src/lib/utils.ts` | `972…` |
| `normalizePhone` | `src/lib/import-utils.ts` | `+972…` (עם +, לא תואם ל-`972…`) |
| `normalizePhone` (פרטית) | `src/app/api/import/route.ts` | ספרות |
| `normalizePhoneIL` | `src/lib/intake.ts` | `+972…` |
| `toE164IsraeliPhone` (פרטית) | `src/lib/portal-auth.ts` | `+972…` |
| `normalizePhoneSearch` / `normalizeStoredPhone` / `samePhone` | `src/lib/customer-filters.ts` | ספרות, 972→0 |
| `phoneTail` | `src/lib/customer-merge-plan.ts` | זנב |
| `israeliMobile` / `toWaId` | `src/lib/alldog/missed-call-rules.ts` | `05X…` / `972…` |
| `localPhone` | `src/lib/alldog/leads.ts` | עוטף את הגרסה של paycall.ts |
| `localIsraeliPhone` | `src/lib/alldog-bot/handoff.ts` | 972→0 |
| `localPhone` (פרטית) | `src/lib/alldog-bot/general.ts` | 972→0 |
| `phoneVariants` / `localPhone` | `src/lib/whatsapp-inbound-rules.ts` | וריאנטים / `0…` |
| `toPhoneNormLocal` (לקוח) | `src/app/(dashboard)/leads/page.tsx` | `972…` |
| IIFE inline | `src/app/api/book/[slug]/customer/route.ts`, `booking/route.ts` | — |
| `digitsOf` | `src/components/customers/CustomerPicker.tsx` | ספרות |
| SQL `regexp_replace` | `src/services/customer-list.ts`, `src/services/business-admin-health.ts` | ספרות, 972→0 |

יש כ-20 מימושים, וכמה מהם מחזירים פורמטים לא תואמים.

### 7.2 מה הבוט ו-PayCall משתמשים בו
- **ליד:** שניהם עוברים דרך `resolveLeadForContact` → `findLeadsByPhone` (`src/lib/alldog/leads.ts`).
  - נרמול ב-`localPhone` ל-`0XXXXXXXXX`.
  - ואז `prisma.lead.findMany({ where: { businessId, phone: { endsWith: <4 ספרות אחרונות> } }, take: 50 })`, כלומר `LIKE '%1234'`.
  - ואז השוואה מדויקת ב-JS.
- **לקוח:** שניהם עוברים דרך `findCustomersByPhone` (`src/services/clients.ts`): `phoneNorm` מדויק (`972…`) או, לשורות ישנות עם `phoneNorm` NULL, `phone in [3 כתיבים]`. ה-fallback הזה לא חסין לכל הכתיבים.

### 7.3 ביצועי חיפוש לפי טלפון ואינדקסים
- `Lead.phone String?`. **אין עמודת `phoneNorm` ב-Lead (לא נמצא).** **אין אינדקס על `Lead.phone`.** אינדקסי Lead: `[businessId, lastContactedAt]`, `[stage, lostReasonCode, createdAt]`, `[businessId, stage]`, `[businessId, trafficSource, createdAt]`.
- `Customer.phoneNorm String?` קיים, אבל **אין אינדקס** על `phone` או `phoneNorm` (רק `[businessId]` ו-`[businessId, createdAt]`). אין קובץ SQL שמוסיף אחד.
- כל חיפוש מסונן לפי `businessId`. הקידומת מצמצמת שורות, אבל תנאי הטלפון עצמו לא מאונדקס.
- dedup לפי `call_id` הוא `contains` על `CallLog.summary` / `TimelineEvent.description`, בלי אינדקס.
- שורות ישנות עם `phoneNorm` NULL מתועדות (CLAUDE.md #37) ומטופלות ב-`duplicatePhoneWhere`, ב-`regexp_replace` וב-`business-admin-health.ts`. בנוסף, ייבוא דרך `src/lib/import-utils.ts` כותב `phoneNorm` בפורמט `+972…`, וחיפוש מדויק לפי `972…` יחמיץ שורות כאלה.

---

## נספח: מה לא נמצא בקוד (ריכוז)
- `leadId` על `Appointment` או על `ScheduledMessage`.
- שיוך פעיל של פגישה, ליד או משימה לחבר צוות (`PlatformUser`). השדות הקיימים מצביעים ל-`User` הישן ולא בשימוש.
- זמינות לפי איש צוות, שעות לפי איש צוות, או freeBusy של איש צוות בודד.
- סנכרון גוגל, בדיקת התנגשויות, הודעת אישור או כלי MCP ל-`LeadMeeting`.
- תבנית אישור או תזכורת לשיחה במספר הוואטסאפ של AllDog.
- שדה ערוץ ב-`WaBotConversation` / `WaBotMessage`.
- קוד ElevenLabs Agents או Telnyx, ודגל קולי.
- סינון לפי יעד בצינור סיכומי PayCall.
- עוזר משותף לאימות HMAC.
- `stageChangedAt`, והיסטוריית שלבים שנכתבת בצד השרת.
- `phoneNorm` ואינדקס טלפון ב-`Lead`, ואינדקס טלפון ב-`Customer`.
- תיעוד cold start, `connection_limit`.
