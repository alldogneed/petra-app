/**
 * Builds src/lib/alldog-bot/knowledge-data.json — the professional knowledge of the AllDog
 * WhatsApp bot — from the AllDog site repo (alldogneed/alldog-landing-page).
 *
 *   npm run alldog:knowledge -- --src ../alldog-landing-page
 *
 * Re-run whenever articles are added or changed. Per article:
 *   - unchanged (same sourceHash) → the existing card is kept as is;
 *   - new / changed → insights are written by Claude (ANTHROPIC_API_KEY, model
 *     ALLDOG_KNOWLEDGE_MODEL, default the summary model) from the article text;
 *   - or, offline: --insights <dir> with <slug>.json files {topic, insights[], whenToRecommend, extraKeywords[]}.
 * Deleted articles are dropped. Every card is checked against the site's messaging rules
 * (validateInsights) — the build fails rather than write a bad card.
 *
 * Options: --src <dir> (default ../alldog-landing-page) · --insights <dir> · --force (rewrite all) · --dry-run
 */
import * as fs from "node:fs";
import * as path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { readEnv } from "@/lib/read-env";
import { summaryModel } from "@/lib/alldog/config";
import type { KnowledgeEntry, KnowledgeFile } from "@/lib/alldog-bot/knowledge";
import {
  INSIGHTS_INSTRUCTIONS,
  articleForPrompt,
  guideEntry,
  parseToolsPage,
  readGuide,
  reusable,
  toolEntry,
  validateInsights,
  type GeneratedInsights,
  type GuideSource,
} from "@/lib/alldog-bot/knowledge-build";

const OUT = path.join(process.cwd(), "src/lib/alldog-bot/knowledge-data.json");

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

function listMdx(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? listMdx(p) : d.name.endsWith(".mdx") ? [p] : [];
  });
}

const INSIGHTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["topic", "insights", "whenToRecommend", "extraKeywords"],
  properties: {
    topic: { type: "string" },
    insights: { type: "array", items: { type: "string" } },
    whenToRecommend: { type: "string" },
    extraKeywords: { type: "array", items: { type: "string" } },
  },
} as const;

async function generate(client: Anthropic, g: GuideSource): Promise<GeneratedInsights> {
  let feedback = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await client.messages.create({
      model: readEnv("ALLDOG_KNOWLEDGE_MODEL") || summaryModel(),
      max_tokens: 4000,
      system: INSIGHTS_INSTRUCTIONS,
      output_config: { format: { type: "json_schema", schema: INSIGHTS_SCHEMA } },
      messages: [{ role: "user", content: `${articleForPrompt(g)}${feedback}` }],
    });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed = JSON.parse(text) as GeneratedInsights;
    const problems = validateInsights(parsed);
    if (!problems.length) return parsed;
    feedback = `\n\n(ניסיון קודם נפסל: ${problems.join(" ; ")}. תקן.)`;
  }
  throw new Error(`insights for ${g.slug} failed validation 3 times`);
}

async function main() {
  const src = path.resolve(arg("src") ?? "../alldog-landing-page");
  const guidesDir = path.join(src, "content/guides");
  const files = listMdx(guidesDir);
  if (!files.length) {
    console.error(`no guides under ${guidesDir} — pass --src <path to alldog-landing-page>`);
    process.exit(1);
  }

  const previous: KnowledgeFile | null = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : null;
  const prevBySlug = new Map((previous?.entries ?? []).map((e) => [`${e.kind}:${e.slug}`, e]));
  const insightsDir = arg("insights");
  const force = flag("force");
  const key = readEnv("ANTHROPIC_API_KEY");
  const client = key ? new Anthropic({ apiKey: key }) : null;

  const entries: KnowledgeEntry[] = [];
  const missing: string[] = [];
  const stats = { kept: 0, fromFiles: 0, generated: 0 };

  for (const file of files.sort()) {
    const g = readGuide(path.relative(guidesDir, file), fs.readFileSync(file, "utf8"));
    if (!g) {
      console.warn(`skip (no title/slug): ${file}`);
      continue;
    }
    const existing = prevBySlug.get(`guide:${g.slug}`);
    const manual = insightsDir ? path.join(insightsDir, `${g.slug}.json`) : null;

    if (manual && fs.existsSync(manual)) {
      const ins = JSON.parse(fs.readFileSync(manual, "utf8")) as GeneratedInsights;
      const problems = validateInsights(ins);
      if (problems.length) throw new Error(`${manual}: ${problems.join(" ; ")}`);
      entries.push(guideEntry(g, ins));
      stats.fromFiles++;
    } else if (!force && reusable(existing, g)) {
      entries.push({ ...existing, title: g.title });
      stats.kept++;
    } else if (client) {
      process.stdout.write(`writing insights: ${g.slug}… `);
      entries.push(guideEntry(g, await generate(client, g)));
      stats.generated++;
      console.log("ok");
    } else {
      missing.push(g.slug);
    }
  }

  const toolsPage = path.join(src, "src/app/guides/tools/page.tsx");
  if (fs.existsSync(toolsPage)) {
    for (const t of parseToolsPage(fs.readFileSync(toolsPage, "utf8"))) {
      const e = toolEntry(t);
      if (e) entries.push(e);
      else console.warn(`tool without TOOL_NOTES (skipped): ${t.href}`);
    }
  }

  if (missing.length) {
    console.error(
      `${missing.length} new/changed articles need insights and there is no ANTHROPIC_API_KEY or --insights file:\n  ${missing.join("\n  ")}`
    );
    process.exit(1);
  }

  const out: KnowledgeFile = {
    generatedAt: new Date().toISOString().slice(0, 10),
    source: "alldogneed/alldog-landing-page (content/guides + /guides/tools)",
    entries,
  };
  console.log(
    `${entries.length} cards (${stats.kept} unchanged, ${stats.fromFiles} from --insights, ${stats.generated} written by Claude, ${entries.filter((e) => e.kind === "tool").length} tools)`
  );
  if (flag("dry-run")) return;
  fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`→ ${path.relative(process.cwd(), OUT)}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
