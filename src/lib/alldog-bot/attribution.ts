/**
 * AllDog WhatsApp bot — the site's "(הגעתי דרך: <מקור> · <עמוד>)" line → lead attribution (Or, item 30a).
 *
 * The site (alldog-landing-page `SOURCE_LABELS_HE` / `pageLabelFor`) writes Hebrew labels; they used to
 * reach Petra as utm_source, so "כניסה ישירה" was classified "referral". Pure — tested.
 */
import { normalizeAttributionInput, type LeadAttribution, type TrafficSource } from "@/lib/lead-attribution";

/** Site label → traffic source. Order matters ("ממומן" before "חיפוש"). */
const SOURCE_LABELS: Array<[RegExp, TrafficSource]> = [
  [/ממומ|פרסום|מודע|גוגל\s*אדס|google\s*ads|\bpaid\b|\bcpc\b|\bppc\b/iu, "paid"],
  [/אורגני|חיפוש|organic|\bseo\b/iu, "organic"],
  [/רשת(?:ות)?\s*חברתי|פייסבוק|אינסטגרם|טיקטוק|facebook|instagram|tiktok|social/iu, "social"],
  [/וואטסאפ|ווטסאפ|whatsapp/iu, "whatsapp"],
  [/כניסה\s*ישירה|ישיר|direct/iu, "direct"],
  [/הפני(?:י)?ה|referral|אתר\s*אחר/iu, "referral"],
];

export function trafficSourceFromLabel(label: string | null | undefined): TrafficSource {
  const t = (label ?? "").trim();
  if (!t) return "unknown";
  return SOURCE_LABELS.find(([re]) => re.test(t))?.[1] ?? "unknown";
}

/** Site page label → landing page path (only when certain) + page type. */
export function pageFromLabel(label: string | null | undefined): { landingPage: string | null; pageType: string | null } {
  const t = (label ?? "").trim();
  if (!t) return { landingPage: null, pageType: null };
  if (t.startsWith("/")) return { landingPage: t, pageType: null };
  if (/^דף\s*הבית$/u.test(t)) return { landingPage: "/", pageType: "home" };
  if (/^עמוד\s*פנסיון$/u.test(t)) return { landingPage: "/rehabilitation", pageType: "service" };
  if (/^מחירון$/u.test(t)) return { landingPage: "/services/pricing", pageType: "service" };
  if (/^(?:מדריך|מרכז\s*הידע)/u.test(t)) return { landingPage: null, pageType: "guide" };
  if (/^כלי/u.test(t)) return { landingPage: null, pageType: "tool" };
  if (/^אזור/u.test(t)) return { landingPage: null, pageType: "area" };
  if (/^עמוד/u.test(t)) return { landingPage: null, pageType: "service" };
  return { landingPage: null, pageType: null };
}

/** The bot conversation's attribution for the lead (null = the conversation carried none). */
export function botLeadAttribution(source: string | null, page: string | null): LeadAttribution | null {
  if (!source && !page) return null;
  const p = pageFromLabel(page);
  return normalizeAttributionInput({
    traffic_source: trafficSourceFromLabel(source),
    ...(p.landingPage ? { landing_page: p.landingPage } : {}),
    ...(p.pageType ? { page_type: p.pageType } : {}),
  });
}
