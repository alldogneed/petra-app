#!/usr/bin/env node
/**
 * build-assistant-knowledge.mjs
 *
 * Builds the single Hebrew knowledge document Petra AI (the in-app support
 * assistant) answers from. Writes two files under src/lib/assistant/:
 *   knowledge.generated.ts — the document itself (server only, it is large)
 *   catalog.generated.ts   — screen names + video links (small, also used by the drawer)
 *
 * Sources — all read from the code, nothing is typed in here by hand:
 *   - Help center FAQ          src/components/help/HelpCenter.tsx     (faqCategories)
 *   - Tutorial videos          src/lib/tutorials-config.ts
 *   - Menu names + routes      src/components/layout/sidebar.tsx      (navEntries)
 *   - Settings tabs            src/components/settings/settings-tabs.ts
 *   - Plans                    src/lib/feature-flags.ts
 *   - Setup steps              src/lib/onboarding-state.ts
 *   - Optional extra notes     scripts/assistant-knowledge/*.md        (transcripts, guides)
 *
 * Anything the code does not make clear is reported as a TODO (printed, and
 * exported as ASSISTANT_KNOWLEDGE_TODOS) — never guessed into the document.
 *
 * Usage: node scripts/build-assistant-knowledge.mjs          (write)
 *        node scripts/build-assistant-knowledge.mjs --check  (exit 1 when stale)
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "src", "lib", "assistant");
const KNOWLEDGE_OUT = join(OUT_DIR, "knowledge.generated.ts");
const CATALOG_OUT = join(OUT_DIR, "catalog.generated.ts");
const EXTRA_DIR = join(ROOT, "scripts", "assistant-knowledge");

const todos = [];
const todo = (msg) => todos.push(msg);

// ─── Reading literals out of the source files ────────────────────────────────

function parse(relPath) {
  const text = readFileSync(join(ROOT, relPath), "utf8");
  return ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/** Initializers of the file's top-level `const` declarations, by name. */
function topLevelConsts(sourceFile) {
  const out = new Map();
  for (const stmt of sourceFile.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.initializer) out.set(decl.name.text, decl.initializer);
    }
  }
  return out;
}

const UNRESOLVED = Symbol("unresolved");

/** Evaluate a literal expression. Anything that is not plain data becomes UNRESOLVED. */
function evaluate(node, consts) {
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node)) {
    return evaluate(node.expression, consts);
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isTemplateExpression(node)) {
    let text = node.head.text;
    for (const span of node.templateSpans) {
      const value = evaluate(span.expression, consts);
      if (typeof value !== "string" && typeof value !== "number") return UNRESOLVED;
      text += String(value) + span.literal.text;
    }
    return text;
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = evaluate(node.left, consts);
    const right = evaluate(node.right, consts);
    if (typeof left !== "string" || typeof right !== "string") return UNRESOLVED;
    return left + right;
  }
  if (ts.isIdentifier(node)) {
    const init = consts.get(node.text);
    return init ? evaluate(init, consts) : UNRESOLVED;
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((el) => evaluate(el, consts));
  if (ts.isObjectLiteralExpression(node)) {
    const obj = {};
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const key = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : null;
      if (key === null) continue;
      const value = evaluate(prop.initializer, consts);
      if (value !== UNRESOLVED) obj[key] = value;
    }
    return obj;
  }
  return UNRESOLVED;
}

function readConst(relPath, name) {
  const consts = topLevelConsts(parse(relPath));
  const init = consts.get(name);
  if (!init) throw new Error(`${relPath}: const ${name} not found — the knowledge build needs it`);
  const value = evaluate(init, consts);
  if (value === UNRESOLVED) throw new Error(`${relPath}: const ${name} is not a plain literal`);
  return value;
}

// ─── Sources ─────────────────────────────────────────────────────────────────

const faqCategories = readConst("src/components/help/HelpCenter.tsx", "faqCategories");
const videos = readConst("src/lib/tutorials-config.ts", "TUTORIAL_VIDEOS");
const navEntries = readConst("src/components/layout/sidebar.tsx", "navEntries");
const settingsTabs = readConst("src/components/settings/settings-tabs.ts", "SETTINGS_TABS");
const settingsGroups = readConst("src/components/settings/settings-tabs.ts", "SETTINGS_GROUPS");
const featureAccess = readConst("src/lib/feature-flags.ts", "FEATURE_ACCESS");
const tierDisplay = readConst("src/lib/feature-flags.ts", "TIER_DISPLAY");
const setupSteps = readConst("src/lib/onboarding-state.ts", "SETUP_STEPS");

const PUBLIC_TIERS = ["free", "basic", "pro"];
const ROLE_LABEL = { owner: "בעלים בלבד", manager: "מנהל ומעלה" };

/** Lowest public plan that includes a feature, as shown to customers. */
function planFor(feature) {
  if (!feature) return null;
  const tier = PUBLIC_TIERS.find((t) => featureAccess[t]?.[feature] === true);
  if (!tier) {
    todo(`פיצ'ר "${feature}" לא פתוח באף מסלול ציבורי (חינמי/בייסיק/פרו) — לא ברור מהקוד באיזה מסלול הוא זמין.`);
    return null;
  }
  return tier === "free" ? null : tierDisplay[tier].name;
}

// Which screen and which tutorial video belong to each help-center category.
// A category missing here is reported as a TODO and gets no link.
const CATEGORY_LINKS = {
  dashboard: { href: "/dashboard", video: "dashboard" },
  customers: { href: "/customers", video: "customers" },
  pets: { href: "/pets", video: "pets" },
  calendar: { href: "/calendar", video: "calendar" },
  tasks: { href: "/tasks", video: "tasks" },
  leads: { href: "/leads", video: "sales" },
  "bookings-online": { href: "/scheduler", video: "booking-online" },
  boarding: { href: "/boarding", video: "boarding" },
  training: { href: "/training", video: "training" },
  "service-dogs": { href: "/service-dogs", video: null },
  finance: { href: "/pricing", video: "finances" },
  messages: { href: "/scheduled-messages", video: null },
  analytics: { href: "/analytics", video: null },
  settings: { href: "/settings", video: "settings" },
  general: { href: null, video: null },
};

const navItems = navEntries.filter((e) => typeof e.href === "string");
const navByHref = new Map(navItems.map((e) => [e.href, e]));
const videoById = new Map(videos.map((v) => [v.id, v]));

// ─── Document ────────────────────────────────────────────────────────────────

const lines = [];
const push = (...l) => lines.push(...l);

push("# מדריך השימוש בפטרה", "");
push(
  "המסמך נבנה אוטומטית מהקוד של פטרה. שמות המסכים, הלשוניות והכפתורים כתובים כאן בדיוק כפי שהם מופיעים בממשק.",
  ""
);

// 1. Menu
push("## התפריט הראשי — שמות המסכים והקישורים", "");
let group = null;
for (const entry of navEntries) {
  if (typeof entry.eyebrow === "string") {
    group = entry.eyebrow;
    push(`### ${group}`);
    continue;
  }
  if (typeof entry.href !== "string") continue;
  const notes = [];
  const plan = planFor(entry.lockedFeature);
  if (plan) notes.push(`זמין במסלול ${plan} ומעלה`);
  if (entry.minRole && ROLE_LABEL[entry.minRole]) notes.push(`מוצג ל: ${ROLE_LABEL[entry.minRole]}`);
  push(`- [${entry.name}](${entry.href})${notes.length ? ` — ${notes.join("; ")}` : ""}`);
}
push("");

// 2. Settings tabs
push("## הגדרות — הלשוניות", "");
push("מסך [הגדרות](/settings) מחולק לקבוצות. קישור ישיר ללשונית: `/settings?tab=<מזהה>`.", "");
for (const g of settingsGroups) {
  const tabs = settingsTabs.filter((t) => t.group === g.id);
  if (tabs.length === 0) continue;
  push(`### ${g.label}`);
  for (const tab of tabs) {
    const notes = [];
    const plan = tab.requiredTier && tierDisplay[tab.requiredTier] ? tierDisplay[tab.requiredTier].name : null;
    if (plan) notes.push(`זמין במסלול ${plan} ומעלה`);
    push(`- [${tab.label}](/settings?tab=${tab.id}) — ${tab.description}${notes.length ? ` (${notes.join("; ")})` : ""}`);
  }
}
push("");

// 3. Plans
push("## מסלולי המנוי", "");
for (const tier of PUBLIC_TIERS) {
  const { name, price } = tierDisplay[tier];
  push(`- ${name}${price > 0 ? ` — ₪${price} לחודש` : " — ללא תשלום"}`);
}
push("", "שדרוג מסלול: [מנוי וחיוב](/settings?tab=subscription).", "");

// 4. Setup steps
push("## שלבי ההקמה הראשונית של עסק חדש", "");
for (const step of setupSteps) {
  // A ?tab= that is not a real settings tab would be a dead deep link — link the screen only.
  const tab = step.hrefQuery?.startsWith("tab=") ? step.hrefQuery.slice(4) : null;
  const deadTab = tab !== null && !settingsTabs.some((t) => t.id === tab);
  if (deadTab) {
    todo(`שלב הקמה "${step.title}" מפנה ל-/settings?tab=${tab}, אבל אין לשונית כזו ב-SETTINGS_TABS — לבדוק לאן הקישור אמור להוביל.`);
  }
  const href = step.hrefQuery && !deadTab ? `${step.href}?${step.hrefQuery}` : step.href;
  push(`${step.step}. [${step.title}](${href}) — ${step.description}`);
}
push("");

// 5. Videos
push("## סרטוני הדרכה", "");
push("כל הסרטונים נמצאים במסך [סרטוני הדרכה](/tutorials). קישור לסרטון מסוים נכתב עם הקידומת video: ואחריה מזהה הסרטון, כמו ברשימה:", "");
for (const v of videos) {
  push(`- [${v.title}](video:${v.id}) (${v.durationLabel}) — ${v.description}`);
}
push("");
todo("אין תמלולים לסרטוני ההדרכה בריפו — הסרטונים מקושרים לפי נושא בלבד. תמלול אפשר להוסיף כקובץ ‎.md‎ ב-scripts/assistant-knowledge/.");

// 6. Tasks
push("## איך עושים — לפי משימה", "");
const linkedVideos = new Set();
for (const category of faqCategories) {
  const link = CATEGORY_LINKS[category.id];
  if (!link) todo(`קטגוריית עזרה "${category.name}" (${category.id}) לא ממופה למסך או לסרטון ב-CATEGORY_LINKS.`);
  const nav = link?.href ? navByHref.get(link.href) : null;
  if (link?.href && !nav) todo(`קטגוריית עזרה "${category.name}" ממופה ל-${link.href}, שלא קיים בתפריט הראשי.`);
  const video = link?.video ? videoById.get(link.video) : null;
  if (link?.video && !video) todo(`קטגוריית עזרה "${category.name}" ממופה לסרטון "${link.video}" שלא קיים ב-tutorials-config.`);
  if (video) linkedVideos.add(video.id);

  push(`### ${category.name}`);
  const refs = [];
  if (nav) refs.push(`מסך: [${nav.name}](${nav.href})`);
  if (video) refs.push(`סרטון: [${video.title}](video:${video.id})`);
  if (refs.length) push(refs.join(" · "));
  push("");
  for (const item of category.items ?? []) {
    if (typeof item.question !== "string" || typeof item.answer !== "string") {
      todo(`פריט עזרה בקטגוריה "${category.name}" אינו טקסט פשוט ולא נכלל במסמך.`);
      continue;
    }
    push(`**${item.question}**`, item.answer, "");
  }
}
for (const v of videos) {
  if (!linkedVideos.has(v.id)) todo(`סרטון "${v.title}" (${v.id}) לא משויך לאף נושא במסמך.`);
}

// 7. Extra notes
const extras = existsSync(EXTRA_DIR) ? readdirSync(EXTRA_DIR).filter((f) => f.endsWith(".md")).sort() : [];
if (extras.length) {
  push("## מידע נוסף", "");
  for (const file of extras) push(readFileSync(join(EXTRA_DIR, file), "utf8").trim(), "");
}

const knowledge = lines.join("\n").trim() + "\n";

// ─── Output ──────────────────────────────────────────────────────────────────

const videoIndex = Object.fromEntries(
  videos.map((v) => [v.id, { title: v.title, url: v.url, durationLabel: v.durationLabel }])
);

const screenIndex = navItems.map((e) => ({ href: e.href, name: e.name }));

const HEADER = `// GENERATED FILE — do not edit by hand.
// Source: scripts/build-assistant-knowledge.mjs (run it after changing the help
// center, the menu, the settings tabs, the plans or the tutorial videos).
`;

const outputs = [
  [
    KNOWLEDGE_OUT,
    `${HEADER}
/** The knowledge document Petra AI answers from. */
export const ASSISTANT_KNOWLEDGE = ${JSON.stringify(knowledge)};

/** Gaps the build could not fill from the code. Not sent to the model. */
export const ASSISTANT_KNOWLEDGE_TODOS: string[] = ${JSON.stringify(todos, null, 2)};
`,
  ],
  [
    CATALOG_OUT,
    `${HEADER}
/** Main-menu screens, exactly as named in the sidebar. */
export const ASSISTANT_SCREENS: { href: string; name: string }[] = ${JSON.stringify(screenIndex, null, 2)};

/** Tutorial videos by id — resolves the \`video:<id>\` links in the assistant's answers. */
export const ASSISTANT_VIDEOS: Record<string, { title: string; url: string; durationLabel: string }> = ${JSON.stringify(videoIndex, null, 2)};
`,
  ],
];

if (process.argv.includes("--check")) {
  const stale = outputs.some(([file, text]) => !existsSync(file) || readFileSync(file, "utf8") !== text);
  if (stale) {
    console.error("Assistant knowledge is stale — run: node scripts/build-assistant-knowledge.mjs");
    process.exit(1);
  }
  console.log("Assistant knowledge is up to date");
} else {
  for (const [file, text] of outputs) writeFileSync(file, text);
  const items = faqCategories.reduce((n, c) => n + (c.items?.length ?? 0), 0);
  console.log(`Wrote ${outputs.map(([file]) => file.slice(ROOT.length + 1)).join(", ")}`);
  console.log(`  ${knowledge.length} chars · ${faqCategories.length} topics · ${items} tasks · ${videos.length} videos · ${extras.length} extra files`);
}
if (todos.length) {
  console.log(`\nTODO (${todos.length}):`);
  for (const t of todos) console.log(`  - ${t}`);
}
