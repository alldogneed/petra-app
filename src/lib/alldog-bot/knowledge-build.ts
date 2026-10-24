/**
 * AllDog bot knowledge — pure helpers for scripts/alldog-build-knowledge.ts.
 * No fs / network here, so the parsing and merge rules are unit-tested.
 *
 * Source: the AllDog site repo (alldogneed/alldog-landing-page):
 *   content/guides/<category>/<slug>.mdx  → kind "guide"
 *   src/app/guides/tools/page.tsx (TOOLS)  → kind "tool"
 */
import { createHash } from "node:crypto";
import type { KnowledgeEntry } from "@/lib/alldog-bot/knowledge";

export const SITE_URL = "https://all-dog.co.il";

export interface GuideSource {
  slug: string;
  category: string;
  title: string;
  description: string;
  tldr: string;
  keywords: string[];
  body: string;
  sourceHash: string;
}

/** The fields the model (or a person) writes for each article. */
export interface GeneratedInsights {
  topic: string;
  insights: string[];
  whenToRecommend: string;
  extraKeywords?: string[];
}

function unquote(v: string): string {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).replace(/\\"/g, '"');
  }
  return t;
}

/**
 * Minimal front-matter reader: top-level `key: "value"` and `key:` + `  - "item"` lists.
 * Nested structures (faq, learningPath…) are skipped — the bot does not need them.
 */
export function parseFrontmatter(src: string): { data: Record<string, string | string[]>; body: string } {
  const m = src.replace(/^﻿/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: src };
  const data: Record<string, string | string[]> = {};
  let listKey: string | null = null;
  for (const line of m[1].split(/\r?\n/)) {
    const top = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (top) {
      listKey = null;
      if (top[2].trim() === "") {
        listKey = top[1];
        data[listKey] = [];
      } else {
        data[top[1]] = unquote(top[2]);
      }
      continue;
    }
    const item = line.match(/^\s+-\s+(.*)$/);
    if (listKey && item && !/^\w+:\s/.test(item[1])) {
      (data[listKey] as string[]).push(unquote(item[1]));
    } else if (!/^\s/.test(line)) {
      listKey = null;
    }
  }
  return { data, body: m[2] };
}

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v.filter(Boolean) : []);

export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/** One .mdx file → GuideSource (category/slug from the front matter, else from the path). */
export function readGuide(relPath: string, src: string): GuideSource | null {
  const { data, body } = parseFrontmatter(src);
  const parts = relPath.replace(/\\/g, "/").replace(/\.mdx$/, "").split("/");
  const slug = str(data.slug) || parts[parts.length - 1];
  const category = str(data.category) || parts[parts.length - 2];
  const title = str(data.title);
  if (!slug || !category || !title) return null;
  return {
    slug,
    category,
    title,
    description: str(data.seoDescription) || str(data.description),
    tldr: str(data.tldr),
    keywords: list(data.keywords),
    body,
    sourceHash: hashText(src),
  };
}

export function guideUrl(category: string, slug: string): string {
  return `${SITE_URL}/guides/${category}/${slug}`;
}

export interface ToolSource {
  href: string;
  title: string;
  description: string;
}

/** The TOOLS array of src/app/guides/tools/page.tsx (href / title / description). */
export function parseToolsPage(src: string): ToolSource[] {
  const out: ToolSource[] = [];
  const re = /href:\s*"([^"]+)"\s*,\s*title:\s*"([^"]+)"\s*,\s*description:\s*"([^"]+)"/g;
  for (const m of src.replace(/\s+/g, " ").matchAll(re)) {
    out.push({ href: m[1], title: m[2], description: m[3] });
  }
  return out;
}

/**
 * When to point a customer to each tool. Written by hand (4 tools, rarely change);
 * a tool missing here is skipped with a warning.
 */
export const TOOL_NOTES: Record<string, { topic: string; whenToRecommend: string; keywords: string[]; insights: string[] }> = {
  "behavior-check": {
    topic: "לא ברור מה הבעיה של הכלב",
    whenToRecommend: "כשהלקוח לא בטוח איך להגדיר את הבעיה או מתלבט אם בכלל צריך מאלף",
    keywords: ["לא יודע מה הבעיה", "מה הבעיה של הכלב", "שאלון", "בדיקה", "אבחון ראשוני", "מתלבט"],
    insights: [
      "6 שאלות קצרות ומקבלים כיוון ראשוני מיד",
      "זה לא מחליף אבחון בבית , זה עוזר לסדר את המחשבות לפני שיחה עם מאלף",
    ],
  },
  "chocolate-calculator": {
    topic: "הכלב אכל שוקולד",
    whenToRecommend: "כשהלקוח מספר שהכלב אכל שוקולד",
    keywords: ["שוקולד", "אכל שוקולד", "הרעלה", "קקאו"],
    insights: [
      "בוחרים את סוג השוקולד , משקל הכלב והכמות ומקבלים רמת סיכון ומה עושים",
      "אם יש ספק , לא מחכים , פונים לוטרינר חירום",
    ],
  },
  "emergency-vets": {
    topic: "מצב חירום רפואי",
    whenToRecommend: "בכל מצב רפואי דחוף: פציעה , הרעלה , קריסה , דימום , בליעת חפץ",
    keywords: ["וטרינר", "חירום", "פציעה", "הרעלה", "דימום", "בלע", "קרס", "מקיא", "וטרינר תורן"],
    insights: [
      "מרפאות חירום 24/7 לפי אזור , עם טלפון לחיוג ישיר",
      "מצב רפואי דחוף הולך לוטרינר עכשיו , לא לשיחה עם מאלף",
    ],
  },
  "can-dogs-eat": {
    topic: "מה מותר לכלב לאכול",
    whenToRecommend: "כשהלקוח שואל אם מותר לכלב לאכול מאכל מסוים",
    keywords: ["מותר לכלב לאכול", "אסור לכלב", "אוכל", "ענבים", "בצל", "עצמות", "מאכלים"],
    insights: [
      "יותר מ-70 מאכלים , כולל המטבח הישראלי , עם תשובה מיידית",
      "שאלה רפואית על משהו שהכלב כבר אכל הולכת לוטרינר",
    ],
  },
};

export function toolEntry(t: ToolSource): KnowledgeEntry | null {
  const slug = t.href.split("/").filter(Boolean).pop() ?? "";
  const note = TOOL_NOTES[slug];
  if (!note) return null;
  return {
    kind: "tool",
    slug,
    category: "tools",
    title: t.title,
    url: `${SITE_URL}${t.href}`,
    topic: note.topic,
    keywords: note.keywords,
    insights: note.insights,
    whenToRecommend: note.whenToRecommend,
    sourceHash: hashText(JSON.stringify([t, note])),
  };
}

const MAX_INSIGHT = 220;

/** Phrases the site's messaging rules forbid (alldog-landing-page CLAUDE.md, "Messaging & Business Model"). */
export const FORBIDDEN_PHRASES: Array<{ label: string; re: RegExp }> = [
  { label: "הפנסיון שלנו", re: /הפנסיון שלנו/ },
  { label: "המתקן שלנו", re: /המתקן שלנו/ },
  { label: "100%", re: /100\s*%/ },
  { label: "נפתור כל בעיה", re: /נפתור כל בעיה/ },
  { label: "תוצאות מובטחות", re: /תוצאות מובטחות|תוצאה מובטחת/ },
  { label: "מבטיחים", re: /(^|[^\u0590-\u05FF])מבטיחים/u },
  { label: "₪", re: /₪/ },
  { label: "ש״ח", re: /ש[״"]ח/ },
  // "שקל" as a word — not inside "משקל" (weight).
  { label: "שקל", re: /(^|[^\u0590-\u05FF])(ב|ל|ו)?שקל(ים)?($|[^\u0590-\u05FF])/u },
];

export function forbiddenIn(text: string): string[] {
  return FORBIDDEN_PHRASES.filter((p) => p.re.test(text)).map((p) => p.label);
}

/** Clean + validate one generated block; returns the problems found (empty = ok). */
export function validateInsights(g: GeneratedInsights): string[] {
  const problems: string[] = [];
  if (!g.topic?.trim()) problems.push("topic ריק");
  if (!g.whenToRecommend?.trim()) problems.push("whenToRecommend ריק");
  if (!Array.isArray(g.insights) || g.insights.length < 5 || g.insights.length > 8) problems.push("צריך 5–8 תובנות");
  const all = [g.topic, g.whenToRecommend, ...(g.insights ?? [])].join("\n");
  for (const p of forbiddenIn(all)) problems.push(`ביטוי אסור: ${p}`);
  if (/[—–]/.test(all)) problems.push("מקף ארוך");
  for (const i of g.insights ?? []) if (i.length > MAX_INSIGHT) problems.push(`תובנה ארוכה מדי (${i.length})`);
  return problems;
}

export function guideEntry(g: GuideSource, ins: GeneratedInsights): KnowledgeEntry {
  const keywords = [...new Set([...g.keywords, ...(ins.extraKeywords ?? [])].map((k) => k.trim()).filter(Boolean))];
  return {
    kind: "guide",
    slug: g.slug,
    category: g.category,
    title: g.title,
    url: guideUrl(g.category, g.slug),
    topic: ins.topic.trim(),
    keywords,
    insights: ins.insights.map((i) => i.trim()),
    whenToRecommend: ins.whenToRecommend.trim(),
    sourceHash: g.sourceHash,
  };
}

/** An existing entry can be reused only when the article did not change. */
export function reusable(existing: KnowledgeEntry | undefined, g: GuideSource): existing is KnowledgeEntry {
  return !!existing && existing.kind === "guide" && existing.sourceHash === g.sourceHash;
}

/** Article text sent to the model: front matter summary + body without MDX/JSX noise. */
export function articleForPrompt(g: GuideSource, maxChars = 24000): string {
  const body = g.body
    .replace(/^import .*$/gm, "")
    .replace(/<[^>\n]+\/>/g, "")
    .replace(/<\/?[A-Z][^>\n]*>/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return [`כותרת: ${g.title}`, `תקציר: ${g.tldr || g.description}`, "", body].join("\n").slice(0, maxChars);
}

/** Instructions for writing the insights — used by the build script (Claude) and for manual fills. */
export const INSIGHTS_INSTRUCTIONS = `אתה מכין כרטיס ידע לבוט הוואטסאפ של AllDog מתוך מאמר של אור רבינוביץ' (מאלף, מייסד AllDog).
הבוט ישלוף את הכרטיס כשלקוח מתאר בעיה, ייתן ממנו משפט מקצועי אחד–שניים ויפנה לשיחה עם נציגה או לאבחון.

כתוב:
- topic: הבעיה/הנושא במילים של לקוח, עד 8 מילים.
- insights: 5–8 תובנות מרכזיות מהמאמר בלבד, כל אחת משפט קצר אחד (עד 200 תווים), בקול של אור: ישיר, חם, בגובה העיניים, כמו בוואטסאפ. רווח לפני פסיק. בלי מקפים ארוכים, בלי הדגשות, בלי "חשוב לציין", בלי שלישיות.
  התובנה מסבירה למה זה קורה או מה הטעות הנפוצה. לא תוכנית אילוף, לא שלבי תרגול, לא אבחון. לפחות תובנה אחת מסבירה למה כדאי לעבוד עם מאלף / לאבחן.
- whenToRecommend: מתי הבוט צריך להביא את המאמר, משפט אחד.
- extraKeywords: 4–10 ניסוחים שלקוחות כותבים בוואטסאפ על הבעיה (שפה מדוברת, כולל שגיאות נפוצות), שלא מופיעים כבר במילות המפתח.

אסור: "הפנסיון שלנו", "אצלנו" על פנסיון, שמות של מרכזים, מחירים, הבטחת תוצאה ("100%", "נפתור", "מובטח"), מספרים שלא מופיעים במאמר. אם המאמר מזכיר מספר (שבועות, גילאים), מותר רק כפי שהוא כתוב שם.`;
