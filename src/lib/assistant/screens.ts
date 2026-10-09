/**
 * Which screen the user is on, and what Petra AI offers to answer there.
 * Screen names come from the generated catalog (the sidebar is the source);
 * safe to import from client code.
 */

import { ASSISTANT_SCREENS } from "./catalog.generated";

export interface AssistantScreen {
  /** Menu route the pathname belongs to, e.g. "/customers" for "/customers/123". */
  href: string;
  /** The screen's name in the sidebar. */
  name: string;
}

/**
 * Resolve a pathname to a known menu screen (longest matching prefix), or null.
 * The client sends its pathname; only the matched catalog entry is ever used
 * server-side, so nothing the client typed reaches the model.
 */
export function resolveAssistantScreen(pathname: string | null | undefined): AssistantScreen | null {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return null;
  const path = pathname.split(/[?#]/)[0];
  let best: AssistantScreen | null = null;
  for (const screen of ASSISTANT_SCREENS) {
    if (path !== screen.href && !path.startsWith(screen.href + "/")) continue;
    if (!best || screen.href.length > best.href.length) best = screen;
  }
  return best;
}

// Suggested questions per screen. Each one is a question the knowledge document
// answers word for word (assistant-knowledge.test.ts enforces it).
const DEFAULT_SUGGESTIONS = [
  "איך מוסיפים לקוח חדש?",
  "איך מוסיפים תור חדש?",
  "איפה נמצאים סרטוני ההדרכה?",
];

const SUGGESTIONS: Record<string, string[]> = {
  "/dashboard": ["מה מוצג בדשבורד?", "מה זה אזור המיקוד היומי?", "איך עובד החיפוש המהיר בראש המסך?"],
  "/customers": ["איך מוסיפים לקוח חדש?", "איך מייבאים ומייצאים לקוחות?", "מה כולל פרופיל הלקוח?"],
  "/leads": ["איך יוצרים ליד חדש?", "איך עוברים מליד ללקוח?", "מה זה מחוון הזדקנות ליד?"],
  "/tasks": ["איך יוצרים משימה חדשה?", "איך מסמנים ומסננים משימות?", "מה ההבדל בין תאריך יעד לשעת יעד?"],
  "/scheduler": ["איך עובדת ההזמנה האונליין?", "איך מאשרים ודוחים הזמנות?", "מה זה טפסי קליטה?"],
  "/calendar": ["איך מוסיפים תור חדש?", "איך עובדות תזכורות WhatsApp?", "איך מסננים את היומן לפי סוג פעילות?"],
  "/boarding": ["איך מבצעים צ'ק-אין וצ'ק-אאוט?", "איך מגדירים חדרים?", "מה זה לוח האכלה?"],
  "/service-dogs": ["מה הם שלבי האימון של כלב שירות?", "איך עובד שיבוץ כלב לזכאי?", "מה זה תעודת זיהוי דיגיטלית?"],
  "/training": ["איך יוצרים קבוצת אילוף?", "איך מנהלים תוכנית אישית?", "איך מנהלים נוכחות בקבוצות?"],
  "/pets": ["איך מוסיפים חיית מחמד ללקוח?", "איך עובד מעקב המשקל?", "מה כולל המידע הרפואי של כלב?"],
  "/pricing": ["איך מגדירים מחירון?", "איך יוצרים הזמנה חדשה?", "איך שולחים בקשת תשלום?"],
  "/scheduled-messages": [
    "למה לא נשלחות הודעות אוטומטיות ללקוחות שלי?",
    "איך יוצרים תבנית הודעה?",
    "איך עובד תור השליחה?",
  ],
  "/analytics": ["מה מוצג בעמוד הדוחות?", "איך מייצאים נתונים?", "איך מייבאים נתונים?"],
  "/settings": [
    "איך מנהלים צוות והרשאות?",
    "איך מחברים Google Calendar?",
    "איך מחברים את מספר הוואטסאפ של העסק?",
  ],
};

export const ALL_ASSISTANT_SUGGESTIONS: string[] = [...DEFAULT_SUGGESTIONS, ...Object.values(SUGGESTIONS).flat()];

/** Suggested questions for the screen the user is on. */
export function suggestionsForPath(pathname: string | null | undefined): string[] {
  const screen = resolveAssistantScreen(pathname);
  return (screen && SUGGESTIONS[screen.href]) || DEFAULT_SUGGESTIONS;
}
