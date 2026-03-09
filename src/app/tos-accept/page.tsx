"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Square, ShieldCheck } from "lucide-react";
import { CURRENT_TOS_VERSION } from "@/lib/tos";

const TOS_SECTIONS = [
  {
    title: "1. מבוא",
    items: [
      "תנאי שימוש אלו מהווים הסכם משפטי מחייב בין המשתמש לבין החברה המפעילה את המערכת.",
      "השימוש במערכת מהווה הסכמה מלאה מצד המשתמש לתנאים אלה. אם אינך מסכים – נא אל תעשה שימוש במערכת.",
      "תנאים נוספים, לרבות מדיניות פרטיות, מדיניות שימוש מקובל (AUP) ותנאים נוספים, מהווים חלק בלתי נפרד מהסכם זה.",
      "המשתמש מודע לכך שהמערכת נמצאת בשלבי פיתוח ושיפור מתמידים, ולכן ייתכנו שינויים, תקלות זמניות או פונקציות שאינן זמינות באופן מלא בכל עת.",
    ],
  },
  {
    title: "2. הגדרות",
    items: [
      '\"המערכת\" – מערכת Petra וכל שירותיה הדיגיטליים.',
      '\"החברה\" – הבעלים והמפעילים של Petra.',
      '\"משתמש\" – כל אדם פרטי או גוף עסקי המשתמש במערכת, לרבות במסגרת תקופת ניסיון.',
      '\"שירות\" – כלל הפונקציות והתכנים הניתנים באמצעות Petra.',
      '\"תוכן\" – כל נתון, קובץ, טקסט, מידע או חומר אחר שהוזן או נוצר באמצעות המערכת.',
    ],
  },
  {
    title: "3. רישום ושימוש",
    items: [
      "השימוש במערכת מותנה בהרשמה ובמסירת פרטים נכונים.",
      "המשתמש אחראי לשמירה על סודיות הסיסמה ולשימוש הנעשה תחת חשבונו.",
      "החברה שומרת לעצמה את הזכות לסרב להעניק שירות או להשעות חשבון לפי שיקול דעתה.",
      "חשבון יכול לכלול משתמש ראשי ומשתמשים מורשים בהתאם למבנה העסק.",
    ],
  },
  {
    title: "4. מדיניות שימוש מקובל (Acceptable Use)",
    items: [
      "אסור להשתמש במערכת לצרכים הבאים:",
      "4.1 העלאת תוכן בלתי חוקי, פוגעני, מזיק או מטעה.",
      "4.2 גישה לא מורשית, הנדסה לאחור או הפרעה לפעולת המערכת.",
      "4.3 שליחת ספאם או תכנים המוניים.",
      "4.4 פגיעה בזכויות קניין רוחני או התחזות.",
    ],
  },
  {
    title: "5. רישוי וקניין רוחני",
    items: [
      "כל זכויות הקניין הרוחני במערכת, לרבות העיצוב, הקוד, המותג והתוכן – שייכות לחברה.",
      "החברה מעניקה רישיון אישי, מוגבל, לא-בלעדי, בלתי ניתן להעברה, לשימוש במערכת לפי תנאים אלו.",
      "אין להעתיק, לשכפל, להפיץ או לשנות את המערכת ללא אישור מפורש מהחברה.",
      "החברה רשאית להשתמש במידע אנונימי לצורכי שיפור השירות.",
    ],
  },
  {
    title: "6. תשלומים ומנויים",
    items: [
      "השירות ניתן בתשלום חודשי או שנתי, בהתאם למסלול שנבחר.",
      "דמי שימוש נגבים מראש.",
      "ביטול השירות יתבצע דרך המערכת או בפנייה בכתב וייכנס לתוקף בתום תקופת החיוב.",
      "החברה רשאית לעדכן מחירים בהודעה מוקדמת של 30 יום.",
      "לא יינתן החזר אלא אם צוין אחרת.",
      "תום מנוי: עם פקיעת תוקף המנוי תרד הגישה באופן אוטומטי לתכנית החינמית (Free). הנתונים שהוזנו נשמרים ואינם נמחקים אוטומטית, אך הגישה לתכונות המתקדמות תיחסם עד לחידוש המנוי.",
      "תקופת ניסיון: בתום תקופת הניסיון החינמית, הגישה עוברת אוטומטית לתכנית החינמית. לא ניתן לאפס תקופת ניסיון לאחר שהסתיימה.",
    ],
  },
  {
    title: "7. שמירת מידע והעברת נתונים",
    items: [
      "מידע יישמר עד 90 ימים לאחר סיום השירות.",
      "ניתן לבקש מחיקה או העברה של מידע.",
      "כל עיבוד כפוף למדיניות פרטיות ולנספח DPA.",
    ],
  },
  {
    title: "8. פרטיות ואבטחת מידע",
    items: [
      "החברה מתחייבת לשמור על סודיות מידע אישי ועסקי.",
      "שימוש באמצעים סבירים ומקובלים להגנה על המידע.",
      "פרטי אשראי אינם נשמרים בשרתי החברה.",
    ],
  },
  {
    title: "9. אחריות ומגבלות",
    items: [
      "המערכת ניתנת As-Is, ללא אחריות לפעולה רציפה.",
      "החברה לא תשא באחריות לנזקים עקיפים.",
      "אחריות החברה מוגבלת לסכום ששולם ב-6 חודשים שקדמו.",
    ],
  },
  {
    title: "10. שיפוי",
    items: [
      "המשתמש מתחייב לשפות את החברה בגין כל תביעה או נזק הנובע מהפרת תנאים אלה.",
    ],
  },
  {
    title: "11. סיום שירות",
    items: [
      "החברה רשאית להשעות או לבטל שירות במקרה של הפרה.",
      "עם סיום השירות, תיתכן מחיקה של המידע לאחר תקופה מוגדרת.",
      "לא יינתן החזר חלקי לתקופה שלא נוצלה.",
    ],
  },
  {
    title: "12. שינויים בתנאים",
    items: [
      "החברה רשאית לעדכן את התנאים בהודעה של 30 יום מראש.",
      "שימוש מתמשך מהווה הסכמה לתנאים המעודכנים.",
    ],
  },
  {
    title: "13. סמכות שיפוט",
    items: [
      "הדין החל הוא הדין הישראלי.",
      "סמכות השיפוט לבתי המשפט במחוז תל אביב.",
      "ייתכן שימוש בהליך בוררות בהסכמה הדדית.",
    ],
  },
  {
    title: "14. כוח עליון",
    items: [
      "החברה לא תישא באחריות לאירועים שאינם בשליטתה (כגון תקלות תקשורת, מגפות, שביתות וכו').",
    ],
  },
];

export default function TosAcceptPage() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAccept() {
    if (!accepted) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tos/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: CURRENT_TOS_VERSION }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "שגיאה בשמירת ההסכמה");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("שגיאת רשת. נסה שוב.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-petra-bg flex flex-col items-center py-10 px-4" dir="rtl">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 overflow-hidden">
            <img src="/logo.svg" alt="Petra" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-petra-text">תנאי שימוש – Petra</h1>
          <p className="text-sm text-petra-muted mt-1">גרסה 1.0 | נא לקרוא בעיון לפני השימוש במערכת</p>
        </div>

        {/* ToS Content */}
        <div className="card p-6 mb-6 space-y-6 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
            <ShieldCheck className="w-5 h-5 text-brand-500" />
            <p className="text-sm text-petra-muted">
              ברוכים הבאים ל-Petra – מערכת ניהול מתקדמת למאלפי כלבים, בעלי פנסיונים ונותני שירותים פרטיים בתחום חיות המחמד. השימוש במערכת כפוף לתנאים המפורטים להלן.
            </p>
          </div>

          {TOS_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="font-bold text-petra-text mb-2">{section.title}</h3>
              <ul className="space-y-1">
                {section.items.map((item, i) => (
                  <li key={i} className="text-sm text-petra-muted leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Acceptance Card */}
        <div className="card p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Checkbox */}
          <button
            type="button"
            onClick={() => setAccepted(!accepted)}
            className="flex items-start gap-3 w-full text-right group"
          >
            <div className="mt-0.5 flex-shrink-0">
              {accepted ? (
                <CheckSquare className="w-5 h-5 text-brand-500" />
              ) : (
                <Square className="w-5 h-5 text-slate-400 group-hover:text-slate-500" />
              )}
            </div>
            <span className="text-sm text-petra-text leading-relaxed">
              קראתי והבנתי את{" "}
              <strong>תנאי השימוש של Petra</strong>{" "}
              (גרסה 1.0) ואני מסכים/ה לכל האמור בהם. אני מבין/ה כי הסכמתי זו תירשם לצרכים משפטיים.
            </span>
          </button>

          <button
            type="button"
            onClick={handleAccept}
            disabled={!accepted || loading}
            className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="animate-pulse">שומר הסכמה...</span>
            ) : (
              "אני מסכים/ה – המשך למערכת"
            )}
          </button>

          <p className="text-xs text-petra-muted text-center">
            הסכמתך תירשם יחד עם כתובת ה-IP, התאריך והשעה כהוכחה משפטית.
          </p>
        </div>
      </div>
    </div>
  );
}
