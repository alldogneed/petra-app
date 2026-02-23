"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Users,
  GraduationCap,
  CreditCard,
  Upload,
  Calendar,
  Shield,
  Hotel,
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  id: string;
  name: string;
  icon: React.ElementType;
  items: FaqItem[];
}

const faqCategories: FaqCategory[] = [
  {
    id: "customers",
    name: "לקוחות וכלבים",
    icon: Users,
    items: [
      {
        question: "איך מוסיפים לקוח חדש?",
        answer:
          'היכנסו לעמוד "לקוחות" בתפריט הצדדי ולחצו על כפתור "לקוח חדש". מלאו את שם הלקוח, טלפון, אימייל ופרטים נוספים. לאחר השמירה, הלקוח יופיע ברשימה.',
      },
      {
        question: "איך מוסיפים כלב ללקוח קיים?",
        answer:
          'היכנסו לפרופיל הלקוח (לחצו על שם הלקוח ברשימה), גללו למטה לאזור "חיות מחמד" ולחצו על "הוסף חיה". מלאו את הפרטים: שם, מין (כלב/חתול/אחר), גזע, משקל ועוד.',
      },
      {
        question: "איך עורכים פרטי לקוח או כלב?",
        answer:
          "היכנסו לפרופיל הלקוח ולחצו על כפתור העריכה ליד הפרטים שברצונכם לשנות. לאחר ביצוע השינויים, לחצו שמירה.",
      },
      {
        question: "איך מוחקים לקוח מהמערכת?",
        answer:
          "כרגע ניתן לבטל לקוח אך לא למחוק אותו לצמיתות, כדי לשמור על היסטוריית נתונים. פנו למנהל המערכת אם נדרשת מחיקה מלאה.",
      },
    ],
  },
  {
    id: "training",
    name: "תיקי אילוף",
    icon: GraduationCap,
    items: [
      {
        question: "מה זה תיק אילוף ואיך פותחים אחד?",
        answer:
          'תיק אילוף הוא תוכנית מותאמת אישית לכלב. היכנסו ל"אימונים" בתפריט, בחרו בלשונית "תוכניות אישיות" ולחצו "תוכנית חדשה". הגדירו מטרות, שיעורי בית ומעקב התקדמות.',
      },
      {
        question: "איך מתעדים התקדמות באילוף?",
        answer:
          "בתוך תיק האילוף, ניתן להוסיף מפגשים חדשים עם תאריך, הערות ודירוג התקדמות. כל מפגש נשמר בהיסטוריית הכלב.",
      },
      {
        question: "איך מעבירים כלב בין שלבי אילוף?",
        answer:
          'פתחו את תיק האילוף ועדכנו את הסטטוס של כל מטרה. כשכל המטרות הושלמו, ניתן לסמן את התוכנית כ"הושלמה".',
      },
      {
        question: "איך מנהלים קבוצות אילוף?",
        answer:
          'בעמוד "אימונים", בחרו בלשונית "קבוצות". ניתן ליצור קבוצה חדשה, להגדיר מפגשים ולהוסיף משתתפים. כל קבוצה מציגה את מספר המפגשים והמשתתפים.',
      },
    ],
  },
  {
    id: "payments",
    name: "מחירון ותשלומים",
    icon: CreditCard,
    items: [
      {
        question: "איך מגדירים מחירון שירותים?",
        answer:
          'היכנסו ל"הגדרות" בתפריט ובחרו בלשונית "שירותים". כאן ניתן להוסיף, לערוך ולמחוק שירותים עם מחירים, משך זמן ותיאור.',
      },
      {
        question: "איך שולחים בקשת תשלום ללקוח?",
        answer:
          'היכנסו ל"תשלומים" בתפריט ולחצו "תשלום חדש". בחרו לקוח, הזינו סכום ושיטת תשלום. ניתן לשלוח התראה ללקוח דרך מערכת ההודעות.',
      },
      {
        question: "איך יוצרים הזמנה חדשה?",
        answer:
          'הזמנות נוצרות אוטומטית כשלקוח מזמין דרך עמוד ההזמנות הציבורי, או ידנית דרך עמוד "הזמנות" בפאנל הניהול.',
      },
      {
        question: "איך עוקבים אחרי תשלומים?",
        answer:
          'בעמוד "תשלומים" תוכלו לראות סיכום כולל: סך הכל, ממתינים ושולמו. ניתן לסנן לפי סטטוס ותאריך.',
      },
    ],
  },
  {
    id: "import",
    name: "ייבוא לקוחות",
    icon: Upload,
    items: [
      {
        question: "איך מייבאים לקוחות מקובץ Excel?",
        answer:
          "פיצ'ר ייבוא לקוחות נמצא בפיתוח. בקרוב תוכלו להעלות קובץ Excel או CSV ולייבא את כל הלקוחות בבת אחת.",
      },
      {
        question: "באיזה פורמט צריך להיות הקובץ?",
        answer:
          "הקובץ צריך להכיל עמודות: שם, טלפון, אימייל (אופציונלי), כתובת (אופציונלי). פורמטים נתמכים: Excel (.xlsx) ו-CSV. שורת הכותרת חייבת להיות בשורה הראשונה.",
      },
      {
        question: "מה קורה אם יש כפילויות?",
        answer:
          "המערכת תזהה כפילויות לפי מספר טלפון ותציג התראה. תוכלו לבחור אם לדלג, לעדכן או ליצור רשומה חדשה לכל כפילות.",
      },
    ],
  },
  {
    id: "gcal",
    name: "חיבור ליומן Google",
    icon: Calendar,
    items: [
      {
        question: "איך מחברים את המערכת ליומן Google?",
        answer:
          'היכנסו ל"הגדרות" ובחרו באפשרות חיבור ליומן Google. תצטרכו לאשר גישה לחשבון Google שלכם. לאחר החיבור, התורים יסתנכרנו אוטומטית.',
      },
      {
        question: "איך מסנכרנים תורים עם היומן?",
        answer:
          "לאחר החיבור, כל תור חדש שנוצר במערכת יופיע אוטומטית ביומן Google שלכם, ולהפך. הסנכרון מתבצע בזמן אמת.",
      },
      {
        question: "מה עושים אם הסנכרון לא עובד?",
        answer:
          'נסו להתנתק ולהתחבר מחדש ליומן Google דרך "הגדרות". אם הבעיה נמשכת, בדקו שההרשאות מאושרות בחשבון Google שלכם.',
      },
    ],
  },
  {
    id: "permissions",
    name: "הרשאות ועובדים",
    icon: Shield,
    items: [
      {
        question: "איך מוסיפים עובד למערכת?",
        answer:
          'היכנסו ל"הגדרות" ובחרו בניהול עובדים. לחצו "הוסף עובד" והזינו שם, אימייל וסיסמה. העובד יקבל הודעה עם פרטי הכניסה.',
      },
      {
        question: "איך מגדירים הרשאות לעובד?",
        answer:
          "בעת הוספת עובד או בעריכה שלו, ניתן לבחור את רמת ההרשאה שלו. כל רמה מגדירה אילו עמודים ופעולות העובד יכול לבצע.",
      },
      {
        question: "אילו רמות הרשאה קיימות?",
        answer:
          'קיימות 3 רמות: "בעלים" - גישה מלאה לכל הפיצ\'רים כולל הגדרות וחיוב. "מנהל" - גישה לכל הפיצ\'רים התפעוליים. "עובד" - גישה ליומן, לקוחות ומשימות בלבד.',
      },
    ],
  },
  {
    id: "boarding",
    name: "ניהול פנסיון",
    icon: Hotel,
    items: [
      {
        question: "איך מגדירים חדרים בפנסיון?",
        answer:
          'בעמוד "פנסיון" תוכלו לראות את רשימת החדרים. ניתן להוסיף חדרים חדשים עם שם, קיבולת ופרטים נוספים דרך ההגדרות.',
      },
      {
        question: "איך מבצעים צ'ק-אין לכלב?",
        answer:
          'בעמוד "פנסיון", לחצו על "שהייה חדשה". בחרו לקוח, כלב, חדר ותאריכים. לאחר היצירה, לחצו על כפתור "צ\'ק-אין" ליד השהייה.',
      },
      {
        question: "איך מנהלים לוח זמנים של הפנסיון?",
        answer:
          "לוח הזמנים מוצג בעמוד הפנסיון עם תצוגת רשת החדרים. ניתן לראות תפוסה נוכחית, שהיות מתוכננות וביצוע צ'ק-אין/צ'ק-אאוט.",
      },
      {
        question: "מה לעשות כשחדר מלא?",
        answer:
          "כשחדר הגיע לקיבולת המקסימלית, המערכת תציג אותו כתפוס ולא תאפשר הוספת שהיות נוספות. ניתן לשבץ לחדר אחר פנוי או ליצור רשימת המתנה.",
      },
    ],
  },
  {
    id: "general",
    name: "כללי",
    icon: HelpCircle,
    items: [
      {
        question: "איך משתמשים בדשבורד?",
        answer:
          "הדשבורד מציג סיכום של העסק: מספר לקוחות, תורים להיום, הכנסה חודשית ומשימות פתוחות. בנוסף, מוצגים התורים הקרובים והמשימות האחרונות.",
      },
      {
        question: "איך מנהלים משימות?",
        answer:
          'בעמוד "משימות" ניתן ליצור, לסנן ולנהל משימות. כל משימה כוללת קטגוריה, עדיפות ותאריך יעד. ניתן לסנן לפי סטטוס (פתוחות/הושלמו/בוטלו) ולפי קטגוריה.',
      },
      {
        question: "איך עובד מנהל הלידים?",
        answer:
          'מנהל הלידים מוצג כלוח קנבן עם עמודות: חדש, נוצר קשר, מתאים, זכייה. ניתן להעביר לידים בין שלבים בלחיצה, וליצור לידים חדשים עם פרטי קשר ומקור.',
      },
      {
        question: "איך שולחים הודעות ללקוחות?",
        answer:
          'בעמוד "הודעות" ניתן ליצור תבניות הודעה לוואטסאפ, SMS ואימייל. כל תבנית תומכת במשתנים אוטומטיים כמו שם הלקוח, שם החיה, תאריך ושעה.',
      },
    ],
  },
];

function AccordionItem({ item }: { item: FaqItem }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-petra-border last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3.5 px-4 text-right hover:bg-slate-50 transition-colors duration-150 gap-3"
      >
        <span className="text-sm font-medium text-petra-text leading-relaxed">
          {item.question}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-petra-muted flex-shrink-0 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <p className="px-4 pb-4 text-sm text-petra-muted leading-relaxed">
          {item.answer}
        </p>
      </div>
    </div>
  );
}

interface HelpCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpCenter({ open, onOpenChange }: HelpCenterProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredCategories = useMemo(() => {
    if (!search.trim() && !selectedCategory) return faqCategories;

    return faqCategories
      .filter((cat) => !selectedCategory || cat.id === selectedCategory)
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            !search.trim() ||
            item.question.includes(search) ||
            item.answer.includes(search)
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [search, selectedCategory]);

  const totalResults = filteredCategories.reduce(
    (acc, cat) => acc + cat.items.length,
    0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-petra-border space-y-4">
          <DialogTitle className="text-xl font-bold text-petra-text">
            מרכז עזרה
          </DialogTitle>

          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-petra-muted" />
            <input
              type="text"
              placeholder="חפשו שאלה..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pr-10"
            />
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "badge transition-colors duration-150 cursor-pointer",
                !selectedCategory
                  ? "bg-brand-50 text-brand-700 border border-brand-100"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              הכל
            </button>
            {faqCategories.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() =>
                    setSelectedCategory(
                      selectedCategory === cat.id ? null : cat.id
                    )
                  }
                  className={cn(
                    "badge gap-1.5 transition-colors duration-150 cursor-pointer",
                    selectedCategory === cat.id
                      ? "bg-brand-50 text-brand-700 border border-brand-100"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {cat.name}
                </button>
              );
            })}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-5">
          {filteredCategories.length === 0 ? (
            <div className="empty-state py-12">
              <div className="empty-state-icon">
                <Search className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-petra-text mb-1">
                לא נמצאו תוצאות
              </p>
              <p className="text-xs text-petra-muted">
                נסו לחפש במילים אחרות
              </p>
            </div>
          ) : (
            filteredCategories.map((category) => {
              const Icon = category.icon;
              return (
                <div key={category.id} className="card overflow-hidden">
                  {/* Category header */}
                  <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-50/80 border-b border-petra-border">
                    <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5 text-brand-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-petra-text">
                      {category.name}
                    </h3>
                    <span className="badge-neutral text-[10px] mr-auto">
                      {category.items.length} שאלות
                    </span>
                  </div>

                  {/* Questions */}
                  {category.items.map((item, idx) => (
                    <AccordionItem key={idx} item={item} />
                  ))}
                </div>
              );
            })
          )}

          {search.trim() && filteredCategories.length > 0 && (
            <p className="text-center text-xs text-petra-muted pt-2">
              נמצאו {totalResults} תוצאות
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
