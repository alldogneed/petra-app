/**
 * AllDog WhatsApp bot — service cities (Or, item 28b). Pure, unit-tested.
 *
 * A city outside the list gets a general, optimistic answer — never "מחוץ לאזור" / "לא באזור" /
 * "לא ברשימה" — and the lead is marked "אזור לבדיקה: <עיר>" for the rep.
 */
import { towardYou, type Gender } from "@/lib/alldog-bot/address";

/** Home-training cities (the same list as the prompt). Each entry: the name + spellings customers use. */
export const SERVICE_CITIES: Array<{ name: string; re: RegExp }> = [
  { name: "תל אביב", re: /תל[\s-]?אביב|^ת["״׳']?א$|יפו/u },
  { name: "רמת גן", re: /רמת[\s-]?גן|^ר["״׳']?ג$/u },
  { name: "גבעתיים", re: /גבעתיים/u },
  { name: "חולון", re: /חולון/u },
  { name: "פתח תקווה", re: /פתח[\s-]?תקו?וה|^פ["״׳']?ת$/u },
  { name: "ראש העין", re: /ראש[\s-]?העין/u },
  { name: "כפר סבא", re: /כפר[\s-]?סבא|^כ["״׳']?ס$/u },
  { name: "רעננה", re: /רעננה/u },
  { name: "הוד השרון", re: /הוד[\s-]?השרון/u },
  { name: "הרצליה", re: /הרצליה/u },
  { name: "נתניה", re: /נתניה/u },
  { name: "ראשון לציון", re: /ראשון(?:[\s-]?לציון)?|^ראשל["״׳']?צ$/u },
  { name: "רחובות", re: /רחובות/u },
  { name: "נס ציונה", re: /נס[\s-]?ציונה/u },
];

export function isKnownServiceCity(city: string | null | undefined): boolean {
  const c = (city ?? "").replace(/\s+/g, " ").trim();
  if (!c) return true; // nothing said yet — nothing to check
  return SERVICE_CITIES.some((s) => s.re.test(c));
}

/** Or's answer for a city outside the list, addressed by gender (unknown → neutral). */
export function unknownAreaLine(gender: Gender = "unknown"): string {
  const toYou = towardYou(gender);
  const back = toYou ? `תחזור ${toYou} עם תשובה` : "תחזור בטלפון עם תשובה";
  return `מעולה, אני בודק מי מהמאלפים שלנו זמין באזור שלך, והנציגה ${back} 🙂`;
}
/** Fixed part of the line (for detection). */
export const UNKNOWN_AREA_MARKER = "אני בודק מי מהמאלפים שלנו זמין באזור שלך";

/** The lead note for the rep. */
export function areaToCheckNote(city: string): string {
  return `[וואטסאפ · בוט] אזור לבדיקה: ${city.replace(/\s+/g, " ").trim().slice(0, 100)}`;
}

/** "מחוץ לאזור" / "לא באזור שלנו" / "לא ברשימה" / "אנחנו לא מגיעים ל…" — forbidden to the customer (28b). */
export const OUT_OF_AREA_RE =
  /מחוץ\s+ל(?:ה)?(?:אזור|אזורי|אזורים|תחום)|(?:לא|אינ(?:ה|ו|נה))\s+(?:נמצא(?:ת)?\s+)?ב(?:ה)?(?:אזור|אזורים|תחום)(?:\s+(?:שלנו|השירות))?|לא\s+ברשימה|(?:אנחנו\s+)?לא\s+(?:מגיעים|מגיע|עובדים|עובד|משרתים)\s+(?:ל|ב)(?!כל)/u;

/**
 * Lines that tell the customer he is out of the area are replaced by Or's optimistic line
 * (once per conversation — dropped when it was already sent). Pure — tested.
 */
export function fixOutOfAreaLines(text: string, gender: Gender, priorBotTexts: string[] = []): string {
  if (!OUT_OF_AREA_RE.test(text)) return text;
  const alreadySent = priorBotTexts.some((t) => t.includes(UNKNOWN_AREA_MARKER));
  let replaced = alreadySent;
  return text
    .split("\n")
    .map((line) => {
      if (!OUT_OF_AREA_RE.test(line)) return line;
      if (replaced) return null;
      replaced = true;
      return unknownAreaLine(gender);
    })
    .filter((l): l is string => l !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** What save_lead tells the model when the city is not on the list (the real executor and the simulator). */
export function unknownAreaToolNote(city: string, gender: Gender): string {
  return `העיר "${city}" לא ברשימת הערים. כתוב ללקוח בדיוק את המשפט: "${unknownAreaLine(gender)}" (בלי "מחוץ לאזור", "לא באזור" או "לא ברשימה"), ואז המשך לשאלה הבאה באותה הודעה.`;
}
