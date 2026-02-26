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
  Calendar,
  Hotel,
  HelpCircle,
  ChevronDown,
  LayoutDashboard,
  ListTodo,
  Target,
  MessageSquare,
  ShoppingCart,
  Globe,
  Settings,
  BarChart3,
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
    id: "dashboard",
    name: "דשבורד",
    icon: LayoutDashboard,
    items: [
      {
        question: "מה מוצג בדשבורד?",
        answer:
          "הדשבורד מציג תמונת מצב יומית של העסק: הזמנות פעילות, תשלומים ממתינים, תורים להיום ולידים פתוחים. בנוסף מוצגים גרף הכנסות חודשי, התורים הקרובים, הזמנות אחרונות ופיד פעילות אחרונה.",
      },
      {
        question: 'מה זה "מיקוד יומי" בדשבורד?',
        answer:
          "אזור המיקוד היומי מציג את המשימות שמיועדות להיום ומשימות באיחור שטרם הושלמו. ניתן לסמן משימה כהושלמה ישירות מהדשבורד בלחיצה על הצ'קבוקס.",
      },
      {
        question: "מה מציג פיד הפעילות?",
        answer:
          "פיד הפעילות מציג את כל הפעולות שבוצעו במערכת ב-24 השעות האחרונות: התחברויות, יצירת לקוחות, עדכון תורים, הזמנות, תשלומים, שינויי סטטוס לידים ועוד. הפיד מתרענן אוטומטית כל דקה.",
      },
      {
        question: "איך מסננים תורים לפי סוג שירות?",
        answer:
          'ברשימת התורים הקרובים בדשבורד ניתן לסנן לפי סוג: הכל, אילוף, פנסיון או טיפוח. לחצו על הלשונית המתאימה מעל רשימת התורים.',
      },
    ],
  },
  {
    id: "customers",
    name: "לקוחות וכלבים",
    icon: Users,
    items: [
      {
        question: "איך מוסיפים לקוח חדש?",
        answer:
          'היכנסו לעמוד "לקוחות" בתפריט הצדדי ולחצו על "לקוח חדש". מלאו שם, טלפון, אימייל, תגיות והערות. ניתן גם להוסיף לקוח ראשון דרך אשף ההקמה בכניסה הראשונה למערכת.',
      },
      {
        question: "איך מוסיפים חיית מחמד ללקוח?",
        answer:
          'בפרופיל הלקוח, גללו לאזור "חיות מחמד" ולחצו "הוסף חיה". מלאו שם, מין (כלב/חתול/אחר), גזע, משקל, מגדר ועוד. ניתן גם להוסיף חיה דרך טופס הקליטה הציבורי.',
      },
      {
        question: "איך מנהלים מידע רפואי והתנהגותי של כלב?",
        answer:
          "בפרופיל הלקוח, לחצו על כרטיס החיה להרחבה. ניתן לנהל: מידע בריאותי (סירוס, אלרגיות, מצבים רפואיים, ניתוחים), חיסונים (כלבת, משושה, תילוע), תרופות (שם, מינון, תדירות, הוראות), ודגלים התנהגותיים (תוקפנות, תגובתיות, קפיצות, חרדת נטישה ועוד).",
      },
      {
        question: "איך עורכים פרטי לקוח?",
        answer:
          "בפרופיל הלקוח לחצו על כפתור העריכה ליד הפרטים שברצונכם לשנות. ניתן לעדכן פרטי קשר, כתובת, תגיות והערות. כל שינוי נרשם בציר הזמן של הלקוח.",
      },
      {
        question: "איך מעלים מסמכים ותמונות?",
        answer:
          "בפרופיל הלקוח ניתן להעלות מסמכים (הסכמים, טפסים רפואיים). בכרטיס החיה ניתן להעלות תמונות ומסמכים נוספים. הקבצים נשמרים ומאורגנים לפי קטגוריה.",
      },
    ],
  },
  {
    id: "calendar",
    name: "יומן ותורים",
    icon: Calendar,
    items: [
      {
        question: "איך מוסיפים תור חדש?",
        answer:
          'בעמוד "יומן" לחצו על משבצת ריקה בשעה הרצויה ליצירת תור חדש. בחרו לקוח, שירות, חיית מחמד (אופציונלי), תאריך ושעה. התור יופיע ביומן בצבע השירות.',
      },
      {
        question: "איך מנווטים בין שבועות?",
        answer:
          'היומן מציג תצוגה שבועית (ראשון עד שבת, 08:00-20:00). השתמשו בחצים למעבר בין שבועות, או בכפתור "היום" לחזרה לשבוע הנוכחי.',
      },
      {
        question: "איך מעדכנים סטטוס של תור?",
        answer:
          'לחצו על תור ביומן כדי לפתוח את הפרטים. ניתן לסמן כהושלם, לבטל עם הערת ביטול, או לסמן כ"לא הגיע". כל שינוי סטטוס נרשם בהיסטוריה.',
      },
      {
        question: "איך מגדירים שעות פעילות וחסימות?",
        answer:
          'בעמוד "זמינות" ניתן להגדיר שעות פעילות לכל יום בשבוע (ראשון עד שבת). בנוסף ניתן ליצור חסימות זמן לחופשות, הפסקות או ימים מיוחדים.',
      },
    ],
  },
  {
    id: "tasks",
    name: "משימות",
    icon: ListTodo,
    items: [
      {
        question: "איך יוצרים משימה חדשה?",
        answer:
          'בעמוד "משימות" לחצו "משימה חדשה". הגדירו כותרת, תיאור, קטגוריה, עדיפות ותאריך יעד. ניתן גם לקשר משימה ללקוח, כלב או ליד ספציפי.',
      },
      {
        question: "אילו קטגוריות משימות קיימות?",
        answer:
          "המערכת תומכת ב-7 קטגוריות: כללי, פנסיון, אילוף, לידים, בריאות, תרופות והאכלה. ניתן לסנן משימות לפי קטגוריה בלחיצה על הלשוניות.",
      },
      {
        question: "מה המשמעות של רמות העדיפות?",
        answer:
          'קיימות 4 רמות עדיפות עם קידוד צבעים: נמוכה (ירוק), בינונית (צהוב), גבוהה (כתום) ודחופה (אדום). משימות דחופות ובאיחור מודגשות באזור "מיקוד יומי" בדשבורד.',
      },
      {
        question: "איך מסמנים משימה כהושלמה?",
        answer:
          "לחצו על הצ'קבוקס ליד המשימה לסימון כהושלמה. ניתן גם לסמן ישירות מהדשבורד. המשימה תעבור ללשונית \"הושלמו\" עם חותמת זמן.",
      },
    ],
  },
  {
    id: "training",
    name: "אימונים",
    icon: GraduationCap,
    items: [
      {
        question: "מה ההבדל בין קבוצות אילוף לתוכניות אישיות?",
        answer:
          'קבוצות אילוף מיועדות למספר כלבים יחד (כמו כיתת גורים או קבוצת תגובתיות) עם מפגשים קבועים. תוכניות אישיות הן תיק אילוף פרטני לכלב בודד עם מטרות, שיעורי בית ומעקב התקדמות.',
      },
      {
        question: "איך יוצרים קבוצת אילוף?",
        answer:
          'בעמוד "אימונים", בלשונית "קבוצות", לחצו "קבוצה חדשה". הגדירו שם, סוג, מיקום, יום ושעה קבועים, מספר משתתפים מקסימלי, ותזכורות אוטומטיות (48 שעות מראש או ביום המפגש).',
      },
      {
        question: "איך מנהלים תוכנית אילוף אישית?",
        answer:
          'בלשונית "תוכניות אישיות", לחצו "תוכנית חדשה". הגדירו מטרות עם אחוזי התקדמות, הוסיפו מפגשים עם סיכום ודירוג, והגדירו שיעורי בית עם תאריך יעד. הלקוח יכול להוסיף הערות על שיעורי הבית.',
      },
      {
        question: "איך מתעדים מפגש אילוף?",
        answer:
          "בתוך תוכנית האילוף או קבוצת האילוף, הוסיפו מפגש חדש עם מספר מפגש, תאריך, משך זמן, סיכום ודירוג (1-5). לקבוצות ניתן גם לנהל נוכחות של משתתפים.",
      },
    ],
  },
  {
    id: "leads",
    name: "לידים",
    icon: Target,
    items: [
      {
        question: "איך עובד לוח הלידים?",
        answer:
          'מנהל הלידים מוצג כלוח קנבן עם 4 עמודות: חדש, נוצר קשר, מתאים, נסגר. לידים שאבדו מוסתרים. ניתן להעביר ליד בין שלבים בלחיצה על הנקודות הצבעוניות בכרטיס.',
      },
      {
        question: "איך יוצרים ליד חדש?",
        answer:
          'לחצו "ליד חדש" בעמוד הלידים. מלאו שם, טלפון, אימייל, מקור (אתר, אינסטגרם, פייסבוק, המלצה, אחר) והערות. הליד ייווצר בעמודת "חדש".',
      },
      {
        question: "איך מתעדים שליד אבד?",
        answer:
          'כשמעבירים ליד לשלב "אבוד", ניתן לבחור קוד סיבה ולכתוב הסבר חופשי. המידע נשמר למעקב ולניתוח הסיבות הנפוצות לאובדן לידים.',
      },
    ],
  },
  {
    id: "messages",
    name: "הודעות",
    icon: MessageSquare,
    items: [
      {
        question: "איך יוצרים תבנית הודעה?",
        answer:
          'בעמוד "הודעות" לחצו "תבנית חדשה". בחרו ערוץ (וואטסאפ, SMS או אימייל), תנו שם לתבנית, ובאימייל גם נושא. כתבו את גוף ההודעה עם משתנים אוטומטיים.',
      },
      {
        question: "אילו משתנים ניתן להשתמש בתבניות?",
        answer:
          "המשתנים הזמינים: {customerName} - שם הלקוח, {petName} - שם החיה, {date} - תאריך, {time} - שעה, {serviceName} - שם השירות, {businessPhone} - טלפון העסק. לחצו על משתנה כדי להכניס אותו במיקום הסמן.",
      },
      {
        question: "איך מסננים תבניות לפי ערוץ?",
        answer:
          "בראש עמוד ההודעות יש לשוניות סינון: הכל, וואטסאפ, SMS, אימייל. לחצו על הלשונית הרצויה לצפייה בתבניות הרלוונטיות בלבד.",
      },
    ],
  },
  {
    id: "boarding",
    name: "פנסיון",
    icon: Hotel,
    items: [
      {
        question: "איך מגדירים חדרים בפנסיון?",
        answer:
          'בעמוד "פנסיון" מוצגת רשת החדרים עם שם וקיבולת. ניתן להוסיף חדרים חדשים עם שם, קיבולת מקסימלית ופרטים נוספים.',
      },
      {
        question: "איך מבצעים צ'ק-אין וצ'ק-אאוט?",
        answer:
          'בעמוד "פנסיון", לחצו "שהייה חדשה" ובחרו לקוח, כלב, חדר ותאריכי כניסה ויציאה. לאחר היצירה, לחצו "צ\'ק-אין" ליד השהייה. בסיום לחצו "צ\'ק-אאוט".',
      },
      {
        question: "איך רואים את תפוסת הפנסיון?",
        answer:
          "רשת החדרים מציגה בזמן אמת את התפוסה של כל חדר (מספר כלבים / קיבולת). חדרים מלאים מסומנים באדום. רשימת השהיות מציגה את כל האורחים הנוכחיים והמתוכננים.",
      },
      {
        question: "מה לעשות כשחדר מלא?",
        answer:
          "כשחדר הגיע לקיבולת המקסימלית, המערכת תציג אותו כתפוס. ניתן לשבץ לחדר אחר פנוי. מהדשבורד ניתן לראות את מספר השהיות הפעילות בפנסיון.",
      },
    ],
  },
  {
    id: "orders",
    name: "הזמנות ותשלומים",
    icon: ShoppingCart,
    items: [
      {
        question: "איך יוצרים הזמנה חדשה?",
        answer:
          'ניתן ליצור הזמנה מהדשבורד בלחיצה על "הזמנה חדשה", או מעמוד ההזמנות. כל הזמנה כוללת שורות פריטים עם כמות, מחיר ליחידה וחישוב מע"מ אוטומטי. ניתן גם להפיק הזמנה מעמוד בקשת תשלום.',
      },
      {
        question: "אילו סוגי הזמנות קיימים?",
        answer:
          "המערכת תומכת ב-3 סוגי הזמנות: מוצרים (מכירת מוצרים), תור (הזמנת שירות), ופנסיון (הזמנת שהייה). כל סוג מסומן בצבע ואייקון ייחודי.",
      },
      {
        question: "איך מנהלים תשלומים?",
        answer:
          'בעמוד "תשלומים" ניתן ליצור תשלום חדש, לסנן לפי סטטוס (ממתין, שולם, בוטל) ולראות סיכום כולל. כל תשלום כולל סכום, שיטת תשלום (מזומן, כרטיס, bit, העברה), מספר חשבונית והערות.',
      },
      {
        question: "איך שולחים בקשת תשלום ללקוח?",
        answer:
          'בעמוד "בקשת תשלום" בחרו פריטים מהמחירון, הגדירו כמויות והנחה, ושלחו ללקוח קישור לתשלום דרך וואטסאפ או אימייל. חישוב המע"מ מתבצע אוטומטית.',
      },
      {
        question: "איך מגדירים מחירון?",
        answer:
          'בעמוד "מחירון" ניתן ליצור רשימות מחירים עם פריטים מסוג שירות או מוצר. לכל פריט ניתן להגדיר מחיר, יחידה (למפגש, ליום, לשעה, ליחידה), משך זמן, מצב מס (כולל/לא כולל) ולהפעיל או לבטל.',
      },
    ],
  },
  {
    id: "booking",
    name: "הזמנה אונליין וקליטה",
    icon: Globe,
    items: [
      {
        question: "איך עובדת ההזמנה האונליין?",
        answer:
          "לקוחות יכולים להזמין תור דרך קישור ציבורי ייעודי לעסק. האשף מנחה אותם בבחירת שירות, בחירת חיית מחמד (קיימת או חדשה), בחירת תאריך ושעה פנויים ומילוי פרטים. ההזמנה מגיעה לאישור בפאנל הניהול.",
      },
      {
        question: "איך מאשרים או דוחים הזמנות?",
        answer:
          'בעמוד "הזמנות אונליין" מוצגות כל ההזמנות שממתינות לאישור. ניתן לאשר, לדחות או לבטל כל הזמנה. ההזמנה כוללת פרטי שירות, לקוח, חיית מחמד, תאריך ושעה.',
      },
      {
        question: "איך מגדירים שירות כזמין להזמנה אונליין?",
        answer:
          'בעמוד "מחירון" או "הגדרות שירותים", סמנו את השירות כ"זמין להזמנה אונליין". ניתן גם להגדיר דרישת מקדמה וסכום מקדמה לכל שירות.',
      },
      {
        question: "מה זה טופס קליטה?",
        answer:
          "טופס קליטה הוא שאלון מקוון שנשלח ללקוח לפני ביקור ראשון. הטופס כולל 4 שלבים: פרטי הכלב (שם, גזע, גיל, משקל), מידע רפואי (אלרגיות, חיסונים, וטרינר), הערכה התנהגותית (13+ דגלים) ותרופות. המידע נשמר אוטומטית בכרטיס הכלב.",
      },
    ],
  },
  {
    id: "settings",
    name: "הגדרות",
    icon: Settings,
    items: [
      {
        question: "איך מעדכנים את פרטי העסק?",
        answer:
          'בעמוד "הגדרות" בלשונית "פרופיל עסק" ניתן לעדכן שם, טלפון, אימייל, כתובת ומספר עוסק. ניתן גם להגדיר שעות צ\'ק-אין וצ\'ק-אאוט לפנסיון ומצב חישוב לילות.',
      },
      {
        question: "איך מנהלים שירותים?",
        answer:
          'בלשונית "שירותים" בהגדרות ניתן ליצור, לערוך ולמחוק שירותים. כל שירות כולל שם, סוג, משך זמן, מחיר, צבע, תיאור, האם כולל מע"מ, והאם זמין להזמנה אונליין.',
      },
      {
        question: "איך מוסיפים עובד למערכת?",
        answer:
          'בניהול עובדים לחצו "הוסף עובד" והזינו שם, אימייל וסיסמה. העובד יקבל הודעה עם פרטי הכניסה.',
      },
      {
        question: "אילו רמות הרשאה קיימות?",
        answer:
          'קיימות 3 רמות: "בעלים" - גישה מלאה לכל הפיצ\'רים כולל הגדרות, חיוב ואנליטיקס. "מנהל" - גישה לכל הפיצ\'רים התפעוליים. "עובד" - גישה ליומן, לקוחות ומשימות בלבד.',
      },
      {
        question: "איך מחברים את המערכת ליומן Google?",
        answer:
          'בהגדרות בחרו באפשרות חיבור ליומן Google ואשרו גישה לחשבון. לאחר החיבור, תורים יסתנכרנו אוטומטית בשני הכיוונים.',
      },
    ],
  },
  {
    id: "analytics",
    name: "אנליטיקס ודוחות",
    icon: BarChart3,
    items: [
      {
        question: "מה מוצג בעמוד האנליטיקס?",
        answer:
          "עמוד האנליטיקס מציג מדדים עסקיים: סך לקוחות ולקוחות חדשים, תורים ושיעור ביטול, הכנסות עם אחוז שינוי, משימות פתוחות מול הושלמו, לידים פעילים ושיעור המרה, תפוסת פנסיון ותוכניות אילוף פעילות.",
      },
      {
        question: "איך מייצאים נתונים?",
        answer:
          "ניתן לייצא נתונים לקובצי Excel או CSV דרך מערכת הייצוא. ניתן לבחור סוג נתונים (לקוחות, תורים, הזמנות) וטווח תאריכים.",
      },
      {
        question: "איך מייבאים לקוחות מקובץ?",
        answer:
          "ניתן להעלות קובץ Excel (.xlsx) או CSV עם עמודות: שם, טלפון, אימייל (אופציונלי), כתובת (אופציונלי). המערכת מזהה כפילויות לפי מספר טלפון ומאפשרת לבחור אם לדלג, לעדכן או ליצור רשומה חדשה.",
      },
    ],
  },
  {
    id: "general",
    name: "כללי",
    icon: HelpCircle,
    items: [
      {
        question: "מה קורה בכניסה הראשונה למערכת?",
        answer:
          "בכניסה הראשונה מוצג אשף הקמה שמנחה אתכם בהגדרת פרטי העסק, יצירת שירות ראשון והוספת לקוח ראשון. ניתן לדלג על האשף ולהשלים מאוחר יותר.",
      },
      {
        question: "איך מתחברים למערכת?",
        answer:
          'היכנסו לכתובת המערכת ומלאו אימייל וסיסמה. ניתן גם להתחבר באמצעות חשבון Google. הסשן תקף ל-8 שעות. אם הסשן פג, המערכת תפנה אוטומטית לדף ההתחברות.',
      },
      {
        question: "איך עובד חיפוש במערכת?",
        answer:
          "סרגל החיפוש בראש המסך מאפשר חיפוש חופשי בכל המערכת: לקוחות (לפי שם, טלפון, אימייל), תורים, משימות, הזמנות ולידים.",
      },
      {
        question: "המערכת תומכת במובייל?",
        answer:
          "כן, המערכת מותאמת לשימוש במובייל, טאבלט ומחשב. תפריט הצד מתכווץ אוטומטית במסכים קטנים.",
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
