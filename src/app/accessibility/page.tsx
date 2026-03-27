import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { LandingNav } from "@/app/landing/_components/LandingNav";

export const metadata: Metadata = {
  title: "הצהרת נגישות — Petra",
  description: "הצהרת הנגישות של פטרה — מחויבות לנגישות דיגיטלית לפי תקן WCAG 2.1 AA וחוק שוויון זכויות לאנשים עם מוגבלות.",
};

const LAST_UPDATED = "מרץ 2026";
const CONTACT_EMAIL = "support@petra-app.com";
const CONTACT_PHONE = "051-531-1435";
const CONTACT_WHATSAPP = "https://wa.me/972542560964";

// ── Section component ─────────────────────────────────────────────────────────
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mb-10">
      <h2 id={id} className="text-xl font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">
        {title}
      </h2>
      <div className="text-slate-600 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden="true" className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 text-xs font-bold">✓</span>
      <span>{children}</span>
    </li>
  );
}

function IssueItem({ children, level }: { children: React.ReactNode; level: "partial" | "missing" }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden="true" className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${level === "partial" ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"}`}>
        {level === "partial" ? "~" : "!"}
      </span>
      <span>{children}</span>
    </li>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "var(--font-heebo), sans-serif" }}>

      <LandingNav />

      {/* Hero strip — matches landing dark style */}
      <div className="bg-slate-950 border-b border-white/8 pt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/25 flex items-center justify-center">
              <svg className="w-5 h-5 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="5" r="1.5"/>
                <path d="M9 19l3-8 3 8M9 12h6M5 8l2 2M19 8l-2 2"/>
              </svg>
            </div>
            <span className="text-xs font-semibold text-brand-400 tracking-widest uppercase">הצהרת נגישות</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-3">נגישות דיגיטלית — Petra</h1>
          <p className="text-slate-400 text-base md:text-lg max-w-2xl leading-relaxed">
            פטרה מחויבת לנגישות דיגיטלית מלאה לכלל המשתמשים, לרבות אנשים עם מוגבלויות, בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות (תשנ&quot;ח–1998) ותקנותיו.
          </p>
          <p className="mt-4 text-slate-500 text-sm">עודכן לאחרונה: {LAST_UPDATED}</p>
        </div>
      </div>

      {/* Main content */}
      <main id="main-content" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-10">

          {/* WCAG badges */}
          <div className="flex flex-wrap gap-3 mb-10">
            {[
              { label: "WCAG 2.1", sub: "Web Content Accessibility Guidelines", color: "bg-brand-50 border-brand-200 text-brand-800" },
              { label: "רמה AA", sub: "רמת ציות מלאה", color: "bg-emerald-50 border-emerald-200 text-emerald-800" },
              { label: "AA-IL", sub: "תקן ישראלי IS 5568", color: "bg-slate-100 border-slate-200 text-slate-700" },
            ].map((b) => (
              <div key={b.label} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${b.color}`}>
                <div>
                  <div className="font-bold text-sm">{b.label}</div>
                  <div className="text-xs opacity-70">{b.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <Section id="about-section" title="1. אודות פטרה">
            <p>
              פטרה היא מערכת ניהול עסקי B2B לעסקי חיות מחמד בישראל — מאלפי כלבים, גרומרים, פנסיונים וארגוני כלבי שירות.
              המערכת מפותחת ומתוחזקת על ידי החטיבה הדיגיטלית של{" "}
              <a href="https://all-dog.co.il" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline font-medium">All-Dog</a>.
            </p>
            <p>
              כתובת האתר: <span className="font-mono text-sm bg-slate-100 px-1.5 py-0.5 rounded">petra-app.com</span>
            </p>
          </Section>

          <Section id="commitment-section" title="2. מחויבותנו לנגישות">
            <p>
              אנו מאמינים שלכל אדם מגיע גישה שווה למידע ולשירותים דיגיטליים. אנו שואפים לעמוד ברמת ציות <strong>AA</strong> של תקן WCAG 2.1 ובתקן הישראלי IS 5568, ופועלים לשיפור מתמיד.
            </p>
            <p>
              הנגישות אינה רק חובה חוקית עבורנו — היא ערך מרכזי. ציבור לקוחותינו כולל בעלי עסקים ומאלפים המטפלים גם בכלבי שירות ואנשים עם מוגבלויות, ולכן נגישות המערכת חשובה לנו במיוחד.
            </p>
          </Section>

          <Section id="measures-section" title="3. אמצעים שננקטו">
            <ul className="space-y-2 list-none p-0">
              <CheckItem>ממשק RTL מלא בעברית — כל הרכיבים מיושרים ומסודרים לכיוון ימין-לשמאל</CheckItem>
              <CheckItem>ניגודיות צבעים עומדת בדרישות WCAG 2.1 AA (יחס מינימלי 4.5:1 לטקסט רגיל)</CheckItem>
              <CheckItem>כל הכפתורים והאלמנטים האינטראקטיביים נגישים למקלדת בלבד (Tab, Enter, Escape)</CheckItem>
              <CheckItem>תוויות ARIA מלאות על כל הרכיבים האינטראקטיביים</CheckItem>
              <CheckItem>גודל טקסט מינימלי 14px, עם תמיכה בהגדלה עד 200% ללא אובדן תוכן</CheckItem>
              <CheckItem>קישור "דלג לתוכן הראשי" בתחילת כל דף</CheckItem>
              <CheckItem>כל התמונות מכילות טקסט חלופי (alt) מתאים, ותמונות דקורטיביות מסומנות <span className="font-mono text-xs bg-slate-100 px-1 rounded">alt=&quot;&quot;</span></CheckItem>
              <CheckItem>כלי נגישות מובנה עם פרופילים: קוגניטיבי, לקויי ראייה, אפילפסיה, מוגבלות מוטורית</CheckItem>
              <CheckItem>שינוי גודל טקסט, ניגודיות, רוויית צבע ויישור ישירות מתפריט הנגישות</CheckItem>
              <CheckItem>עמודים ממובנים נכון עם כותרות היררכיות (h1–h4)</CheckItem>
              <CheckItem>טפסים עם תוויות ברורות ומסרי שגיאה מובנים</CheckItem>
              <CheckItem>ממשק מגיב מלא — תואם מובייל, טאבלט ודסקטופ</CheckItem>
            </ul>
          </Section>

          <Section id="limitations-section" title="4. מגבלות נגישות ידועות">
            <p className="text-sm text-slate-500 mb-4">
              להלן מגבלות שזוהו. אנו עובדים על תיקונן ברציפות:
            </p>
            <ul className="space-y-2 list-none p-0">
              <IssueItem level="partial">
                <strong>מסמכים מצורפים</strong> — מסמכי PDF שמועלים על ידי לקוחות עשויים שלא לכלול תגיות נגישות. נעבוד עם הלקוחות להגדלת נגישות המסמכים.
              </IssueItem>
              <IssueItem level="partial">
                <strong>תרשימים וגרפים</strong> — גרפי הכנסות ודוחות ויזואליים מכילים כותרות תיאוריות אך עשויים שלא לספק שולחן נתונים מלא חלופי.
              </IssueItem>
              <IssueItem level="partial">
                <strong>תוכן שנוצר על ידי משתמשים</strong> — הערות ותוכן שמשתמשים מזינים במערכת עשויים שלא לעמוד בתקני נגישות.
              </IssueItem>
            </ul>
          </Section>

          <Section id="tech-section" title="5. טכנולוגיות בהן אנו תומכים">
            <p>האתר נבנה תוך שימוש בטכנולוגיות הבאות ונבדק עם הכלים הבאים:</p>
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              {[
                { title: "דפדפנים נתמכים", items: ["Chrome 120+", "Firefox 120+", "Safari 17+", "Edge 120+"] },
                { title: "קוראי מסך", items: ["NVDA (Windows)", "VoiceOver (macOS / iOS)", "TalkBack (Android)"] },
                { title: "כלי בדיקה", items: ["WAVE Accessibility Tool", "axe DevTools", "Lighthouse Accessibility Audit"] },
                { title: "מסמכי ייחוס", items: ["WCAG 2.1 (W3C)", "תקן IS 5568 (ישראל)", "חוק שוויון זכויות תשנ\"ח–1998"] },
              ].map((group) => (
                <div key={group.title} className="bg-slate-50 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-slate-700 mb-2">{group.title}</h3>
                  <ul className="space-y-1 list-none p-0">
                    {group.items.map((item) => (
                      <li key={item} className="text-sm text-slate-500 flex items-center gap-1.5">
                        <span aria-hidden="true" className="text-brand-400">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          <Section id="feedback-section" title="6. פניות נגישות">
            <p>
              נתקלתם בבעיית נגישות? נשמח לשמוע ולטפל בה במהירות האפשרית. אנו מחויבים להגיב לפניות נגישות תוך <strong>5 ימי עסקים</strong>.
            </p>
            <div className="mt-5 grid sm:grid-cols-3 gap-4">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition-colors text-center group"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-brand-100 flex items-center justify-center text-xl transition-colors">📧</div>
                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-0.5">אימייל</div>
                  <div className="text-xs text-brand-600 break-all">{CONTACT_EMAIL}</div>
                </div>
              </a>
              <a
                href={`tel:${CONTACT_PHONE.replace(/-/g, "")}`}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition-colors text-center group"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-brand-100 flex items-center justify-center text-xl transition-colors">📞</div>
                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-0.5">טלפון</div>
                  <div className="text-xs text-brand-600" dir="ltr">{CONTACT_PHONE}</div>
                </div>
              </a>
              <a
                href={CONTACT_WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 hover:border-green-300 hover:bg-green-50 transition-colors text-center group"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-green-100 flex items-center justify-center text-xl transition-colors">💬</div>
                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-0.5">WhatsApp</div>
                  <div className="text-xs text-green-600">שלחו הודעה</div>
                </div>
              </a>
            </div>
            <p className="mt-5 text-sm text-slate-500">
              אם לא קיבלתם מענה מספק, ניתן לפנות לנציבות שוויון זכויות לאנשים עם מוגבלות במשרד המשפטים:{" "}
              <a href="https://www.gov.il/he/departments/units/commissioner-equal-rights-disabilities" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                אתר הנציבות
              </a>.
            </p>
          </Section>

          <Section id="date-section" title="7. תאריך הצהרה ועדכון">
            <p>
              הצהרת נגישות זו עודכנה לאחרונה בחודש <strong>{LAST_UPDATED}</strong> ותעודכן מחדש לכל הפחות אחת לשנה, או בעת שינויים מהותיים באתר.
            </p>
            <p>
              הבדיקה בוצעה על ידי צוות הפיתוח הפנימי של פטרה — החטיבה הדיגיטלית של All-Dog.
            </p>
          </Section>

        </div>

        {/* Back link */}
        <div className="text-center mt-8">
          <Link href="/landing" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors focus:outline-none focus:underline">
            ← חזרה לאתר פטרה
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-white/8 py-6 mt-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-slate-500 text-sm">
          © 2026 Petra — החטיבה הדיגיטלית של All-Dog
        </div>
      </footer>
    </div>
  );
}
