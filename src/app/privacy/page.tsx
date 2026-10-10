import Image from "next/image";
import { ShieldCheck } from "lucide-react";

export const metadata = {
  title: "מדיניות פרטיות – Petra",
  description: "מדיניות הפרטיות של מערכת Petra לניהול עסקי חיות מחמד",
};

const SECTIONS: { id?: string; title: string; items: string[] }[] = [
  {
    title: "1. מבוא",
    items: [
      'Petra ("המערכת", "אנחנו") היא פלטפורמה לניהול עסקים בתחום חיות המחמד – מאלפי כלבים, פנסיונים, וספקי שירותים.',
      "מדיניות פרטיות זו מסבירה אילו מידע אנו אוספים, כיצד אנו משתמשים בו ואיך אנו מגנים עליו.",
      "השימוש במערכת מהווה הסכמה למדיניות זו. אם אינך מסכים/ה, אנא הפסק/י את השימוש.",
      "תאריך עדכון אחרון: אוקטובר 2026.",
    ],
  },
  {
    title: "2. המידע שאנו אוספים",
    items: [
      "2.1 פרטי חשבון: שם, כתובת מייל, מספר טלפון, ופרטי העסק שלך.",
      "2.2 נתוני לקוחות: שמות, טלפונים, מיילים וכתובות של הלקוחות שתזין למערכת.",
      "2.3 נתוני חיות מחמד: שם, מין, גזע, תאריך לידה, פרטים רפואיים ומידע התנהגותי.",
      "2.4 פגישות ותורים: תאריכים, שעות, שירותים וסטטוסי טיפולים.",
      "2.5 נתוני תשלום ומנוי: סוג המנוי, תאריך סיום, היסטוריית תשלומים. פרטי כרטיס אשראי אינם נשמרים בשרתינו ומטופלים ישירות על ידי Stripe.",
      "2.6 Google Calendar: כאשר אתה מחבר את Google Calendar, אנחנו קוראים וכותבים אירועים ביומן שלך בלבד לצורך סנכרון פגישות.",
      "2.7 Google Contacts: כאשר אתה מחבר את Google Contacts, אנחנו יוצרים ומעדכנים בחשבונך אנשי קשר של הלידים שנרשמו ב-Petra. אנחנו לא קוראים את אנשי הקשר הקיימים שלך.",
      "2.8 נתוני שימוש: לוגים טכניים, כתובת IP, סוג דפדפן – לצורך אבטחה ושיפור המערכת.",
    ],
  },
  {
    title: "3. שימוש ב-Google Calendar API ומדיניות שימוש מוגבל (Limited Use)",
    items: [
      "אנחנו משתמשים ב-Google Calendar API אך ורק לסנכרון הפגישות שלך בין Petra ליומן Google שלך.",
      "אנחנו ניגשים ליומן Google שלך רק לאחר אישור מפורש שלך דרך תהליך OAuth של Google.",
      "אנחנו ניגשים, קוראים וכותבים אירועי לוח שנה אך ורק לצורך הפונקציה הגלויה למשתמש — סנכרון פגישות ב-Petra.",
      "אנחנו לא קוראים, לא אוגרים ולא משתפים אירועים מיומן Google שאינם קשורים לפגישות שנוצרו ב-Petra.",
      "אנחנו לא מוכרים, לא מעבירים ולא משתפים מידע שהתקבל מ-Google APIs עם כל צד שלישי.",
      "אנחנו לא משתמשים בנתוני Google לצרכי פרסום, מיקוד, מעקב, או כל שימוש שאינו ישירות קשור לתפקוד המערכת.",
      "גישת צוות לנתוני Google מוגבלת לחלוטין — גישה אפשרית רק לצורכי אבטחה, תמיכה טכנית מבוקשת, עמידה בדרישות חוק, או ניתוח אנונימי מצטבר של ביצועי המערכת.",
      "תוכל לבטל את הגישה בכל עת דרך הגדרות חשבון Google שלך (myaccount.google.com/permissions) או דרך הגדרות המערכת.",
      "השימוש שלנו ב-Google APIs עומד במלואו ב-Google API Services User Data Policy, כולל דרישות Limited Use (שימוש מוגבל).",
    ],
  },
  {
    id: "google-contacts",
    title: "4. שימוש ב-Google Contacts (People API) ומדיניות שימוש מוגבל (Limited Use)",
    items: [
      "הסנכרון ל-Google Contacts הוא אופציונלי, כבוי כברירת מחדל, ומופעל רק לאחר אישור מפורש שלך דרך תהליך OAuth של Google.",
      "אנחנו משתמשים בהרשאת contacts (https://www.googleapis.com/auth/contacts) אך ורק כדי ליצור ולעדכן אנשי קשר של לידים שנרשמו ב-Petra בחשבון Google Contacts שלך.",
      "המידע שנכתב לאיש הקשר: שם הליד, מספר טלפון, כתובת מייל (אם קיימת), עיר והערה קצרה מתוך Petra. אנחנו שומרים אצלנו רק את מזהה איש הקשר שיצרנו, כדי שנוכל לעדכן אותו בהמשך.",
      "אנחנו לא קוראים, לא מורידים, לא מאחסנים ולא מנתחים את אנשי הקשר הקיימים בחשבון Google שלך. הגישה היחידה היא לאנשי הקשר ש-Petra עצמה יצרה, לצורך עדכונם.",
      "אנחנו לא מוכרים, לא מעבירים ולא משתפים מידע שהתקבל מ-Google APIs עם כל צד שלישי, ולא משתמשים בו לפרסום, מיקוד, מעקב או אימון מודלים של בינה מלאכותית.",
      "ניתן לכבות את הסנכרון בכל עת בהגדרות ← אינטגרציות ב-Petra, או לבטל את הגישה דרך myaccount.google.com/permissions. לאחר הביטול לא ניצור ולא נעדכן אנשי קשר נוספים; אנשי קשר שכבר נוצרו נשארים בחשבונך ובשליטתך.",
      "הצהרת Limited Use: השימוש של Petra במידע המתקבל מ-Google APIs, והעברתו לכל אפליקציה אחרת, עומדים ב-Google API Services User Data Policy, כולל דרישות Limited Use (שימוש מוגבל).",
    ],
  },
  {
    id: "ai-and-google-data",
    title: "4א. בינה מלאכותית (AI) ומידע מ-Google",
    items: [
      "Petra AI, עוזר התמיכה בתוך המערכת, פועל באמצעות Claude API של Anthropic (שירות API מסחרי). הוא מקבל רק את השאלה שלך ונתונים כלליים על העסק במערכת (כמו מסלול המנוי ומספר הלקוחות), ולא מקבל שום מידע מ-Google APIs.",
      "עוזרי AI (חיבור MCP, בגרסת בטא סגורה): בעל העסק יכול לחבר את חשבון Claude או ChatGPT שלו לנתוני העסק ב-Petra. החיבור לא חושף שום מידע מ-Google APIs — לא אנשי קשר, ולא אירועים או זמנים תפוסים מיומן Google.",
      "אנחנו לא מעבירים מידע שהתקבל מ-Google APIs, גולמי, מצטבר, אנונימי או נגזר, לשום שירות AI של צד שלישי, ולא משתמשים בו כדי ליצור, לאמן או לשפר מודלים של בינה מלאכותית או למידת מכונה.",
      "אנחנו לא משתמשים באגרגטורים או ב-gateways של מודלים, ולא מפעילים מודלים בהתקנה עצמית (self-hosted).",
      "הצהרה: השימוש בנתונים גולמיים או נגזרים שהתקבלו מ-Google APIs יעמוד ב-Google API Services User Data Policy, כולל דרישות Limited Use (שימוש מוגבל).",
    ],
  },
  {
    title: "5. כיצד אנו משתמשים במידע",
    items: [
      "הפעלת המערכת ומתן השירותים: ניהול לקוחות, פגישות, משימות ותשלומים.",
      "שליחת תזכורות ועדכונים: SMS, WhatsApp ומייל ללקוחות העסק (בהסכמתם).",
      "שיפור המערכת: ניתוח אנונימי של דפוסי שימוש לשיפור הממשק.",
      "אבטחה: זיהוי גישה לא מורשית ומניעת שימוש לרעה.",
      "תמיכה טכנית: מענה לפניות ופתרון תקלות.",
    ],
  },
  {
    title: "6. שיתוף מידע עם צדדים שלישיים",
    items: [
      "אנחנו לא מוכרים, לא משכירים ולא סוחרים במידע אישי של משתמשים.",
      "6.1 שירותי דוא\"ל: Resend – שליחת מיילים טרנזקציוניים (איפוס סיסמה, תזכורות).",
      "6.2 WhatsApp / SMS: Twilio – שליחת הודעות WhatsApp ו-SMS ללקוחות העסק לפי בקשתך.",
      "6.3 עיבוד תשלומים: Stripe – עיבוד תשלומים מקוונים. פרטי אשראי מועברים ישירות ל-Stripe ואינם נשמרים אצלנו.",
      "6.4 אחסון קבצים: Vercel Blob – אחסון קבצים שהועלו למערכת (תמונות, מסמכים).",
      "6.5 Google: ניגשים ל-Google APIs לפי הרשאה שנתת. Google כפופה למדיניות הפרטיות שלה.",
      "6.6 דרישה חוקית: נחשוף מידע אם נדרש על פי חוק ישראלי.",
      "6.7 העברת עסק: במקרה של מכירה או מיזוג, המידע עשוי לעבור לחברה הרוכשת תחת אותם תנאים.",
    ],
  },
  {
    title: "7. אחסון ואבטחת מידע",
    items: [
      "המידע מאוחסן בשרתי ענן מאובטחים (Supabase / PostgreSQL) עם הצפנה בסטנדרטים מקובלים.",
      "תוקני OAuth של Google מוצפנים באמצעות AES-256 לפני שמירה.",
      "כניסה למערכת מוגנת בסיסמה מוצפנת (bcrypt) ועוגיית session מאובטחת.",
      "גישה לנתונים מוגבלת לעובדים המורשים לצורך תמיכה ותפעול.",
      "אנחנו מיישמים rate limiting ומוניטורינג לזיהוי פעילות חשודה.",
    ],
  },
  {
    title: "8. שמירת מידע",
    items: [
      "מידע חשבון נשמר כל עוד החשבון פעיל.",
      "לאחר סיום המנוי, המידע נשמר עד 90 ימים ולאחר מכן נמחק לצמיתות.",
      "ניתן לבקש מחיקה מוקדמת דרך יצירת קשר.",
    ],
  },
  {
    title: "9. זכויות המשתמש",
    items: [
      "עיון: תוכל לצפות בכל המידע השמור על חשבונך.",
      "תיקון: תוכל לעדכן פרטים אישיים ישירות במערכת.",
      "מחיקה: תוכל לבקש מחיקת חשבונך וכל הנתונים הקשורים אליו.",
      "ניידות: תוכל לייצא את הנתונים שלך בפורמט CSV/XLSX דרך הגדרות המערכת.",
      "ביטול גישה ל-Google: תוכל לבטל גישה בכל עת דרך myaccount.google.com/permissions.",
      "לממש את זכויותיך – פנה אלינו בכתובת המייל המופיעה בסעיף 11.",
    ],
  },
  {
    title: "10. עוגיות (Cookies)",
    items: [
      "אנחנו משתמשים בעוגיית session בודדת (petra_session) לצורך זיהוי משתמש מחובר.",
      "אנחנו לא משתמשים בעוגיות פרסומיות או מעקב.",
      "ניתן לחסום עוגיות בהגדרות הדפדפן, אך הדבר יפגע בפונקציונליות הכניסה למערכת.",
    ],
  },
  {
    title: "11. יצירת קשר",
    items: [
      "לשאלות, בקשות מחיקה, או כל עניין הנוגע לפרטיות:",
      "מייל: info@petra-app.com",
      "אנחנו נשיב בתוך 14 ימי עסקים.",
    ],
  },
  {
    title: "12. שינויים במדיניות",
    items: [
      "אנחנו עשויים לעדכן מדיניות זו מעת לעת.",
      "במקרה של שינוי מהותי, נודיע לך בדוא\"ל או בהתראה במערכת 30 יום מראש.",
      "המשך השימוש לאחר השינוי מהווה הסכמה למדיניות המעודכנת.",
    ],
  },
];

const GOOGLE_CONTACTS_EN = [
  "Petra is a business management platform for pet-service businesses (dog trainers, boarding kennels, groomers). Connecting Google Contacts is optional and happens only after you explicitly grant access through Google's OAuth consent screen.",
  "Petra uses the Google Contacts scope (https://www.googleapis.com/auth/contacts) only to create and update contacts for the leads recorded in your Petra account, inside your own Google Contacts.",
  "Data written to a contact: the lead's name, phone number, email address (if provided), city and a short note from Petra. Petra stores only the identifier of each contact it created, so it can update that contact later.",
  "Petra does not read, download, store or analyze your existing Google contacts. The only contacts it accesses are the ones Petra itself created, in order to update them.",
  "Petra does not sell Google user data, does not transfer or share it with third parties, and does not use it for advertising, targeting, tracking or training AI models.",
  "You can turn the sync off at any time in Petra under Settings → Integrations, or revoke access at myaccount.google.com/permissions. After that Petra creates and updates no further contacts; contacts already created remain in your Google account under your control.",
  "Limited Use: Petra's use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.",
  "Questions: info@petra-app.com",
];

const AI_EN = [
  "Petra AI, the in-app support assistant, runs on Anthropic's Claude API (a commercial API service). It receives only the user's question and general, non-Google information about the account (such as the subscription plan and the number of clients). It never receives any data obtained from Google APIs.",
  "AI assistants (MCP connector, private beta): a business owner can connect their own Claude or ChatGPT account to their Petra business records. This connector does not expose any data obtained from Google APIs — no Google contacts and no Google Calendar events or busy times.",
  "Petra does not transfer raw, aggregated, anonymized or derived data obtained from Google APIs to any third-party AI service, and does not use such data to create, train or improve AI or machine-learning models.",
  "Petra does not use AI model aggregators or gateways and does not run self-hosted models.",
  "The use of raw or derived user data received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.",
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4" dir="rtl">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 overflow-hidden">
            <Image src="/logo.svg" alt="Petra" width={64} height={64} className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">מדיניות פרטיות – Petra</h1>
          <p className="text-sm text-slate-500 mt-1">עדכון אחרון: אוקטובר 2026</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
            <ShieldCheck className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <p className="text-sm text-slate-600">
              אנחנו מחויבים להגן על פרטיות המשתמשים שלנו. מסמך זה מסביר בשקיפות מלאה כיצד אנו אוספים, משתמשים ומגנים על המידע שלך.
            </p>
          </div>

          {SECTIONS.map((section) => (
            <div key={section.title} id={section.id} className="scroll-mt-6">
              <h3 className="font-bold text-slate-800 mb-2">{section.title}</h3>
              <ul className="space-y-1.5">
                {section.items.map((item, i) => (
                  <li key={i} className="text-sm text-slate-600 leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* English disclosure — Google API Services User Data Policy */}
          <div dir="ltr" lang="en" id="google-contacts-en" className="pt-6 border-t border-slate-100 text-left scroll-mt-6">
            <h3 className="font-bold text-slate-800 mb-2">Google Contacts &amp; Limited Use Disclosure (English)</h3>
            <ul className="space-y-1.5">
              {GOOGLE_CONTACTS_EN.map((item, i) => (
                <li key={i} className="text-sm text-slate-600 leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div dir="ltr" lang="en" id="ai-en" className="pt-6 border-t border-slate-100 text-left scroll-mt-6">
            <h3 className="font-bold text-slate-800 mb-2">AI Services &amp; Google User Data (English)</h3>
            <ul className="space-y-1.5">
              {AI_EN.map((item, i) => (
                <li key={i} className="text-sm text-slate-600 leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-slate-400 text-center">
          © {new Date().getFullYear()} Petra. כל הזכויות שמורות.{" "}
          <a href="/terms" className="underline hover:text-slate-600">
            תנאי שימוש
          </a>
        </p>
      </div>
    </div>
  );
}
