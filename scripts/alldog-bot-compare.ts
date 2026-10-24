/**
 * AllDog bot — before / after comparison on the scripted scenarios.
 * "before" = the first release (scripts/alldog-sim/prompt-v1.txt, no lookup_guide, old opening);
 * "after"  = the current prompt + tools + opening guard. Nothing is sent and nothing is saved.
 *
 *   npm run alldog:compare                      # all scenarios, report → alldog-sim-report.md
 *   npm run alldog:compare -- --only cats,price  # some scenarios
 *   npm run alldog:compare -- --variant after    # only one side
 *
 * Needs ANTHROPIC_API_KEY (and optionally ALLDOG_BOT_MODEL).
 */
import * as fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { botModel } from "@/lib/alldog/config";
import { readEnv } from "@/lib/read-env";
import { SCENARIOS } from "./alldog-sim/scenarios";
import { SimConversation, type SimEvent, type Variant } from "./alldog-sim/engine";

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function render(events: SimEvent[]): string {
  return events
    .map((e) => {
      if (e.kind === "user") return `**לקוח:** ${e.text}`;
      if (e.kind === "bot") return `**AllDog:** ${e.text.replace(/\n/g, " ⏎ ")}`;
      return `> ⚙ ${e.text}`;
    })
    .join("  \n");
}

async function main() {
  const key = readEnv("ANTHROPIC_API_KEY");
  if (!key) {
    console.error("ANTHROPIC_API_KEY חסר");
    process.exit(1);
  }
  const client = new Anthropic({ apiKey: key });
  const only = arg("only")?.split(",").map((s) => s.trim());
  const variants: Variant[] = arg("variant") ? [arg("variant") as Variant] : ["before", "after"];
  const out = arg("out") ?? "alldog-sim-report.md";
  const scenarios = SCENARIOS.filter((s) => !only || only.includes(s.id));

  const sections: string[] = [`# AllDog bot — לפני / אחרי\n\nמודל: ${botModel()} · ${new Date().toISOString().slice(0, 16)}\n`];
  for (const sc of scenarios) {
    sections.push(`## ${sc.title} (\`${sc.id}\`)`);
    for (const v of variants) {
      console.log(`\n=== ${sc.id} · ${v} ===`);
      const conv = new SimConversation(client, botModel(), v, (e) =>
        console.log(e.kind === "user" ? `לקוח: ${e.text}` : e.kind === "bot" ? `AllDog: ${e.text}` : `  ⚙ ${e.text}`)
      );
      for (const line of sc.lines) {
        if (conv.status === "stopped") break;
        try {
          await conv.send(line);
        } catch (err) {
          conv.events.push({ kind: "info", text: `שגיאה: ${err instanceof Error ? err.message : String(err)}` });
          break;
        }
      }
      const basics = conv.basicsAtHandoff
        ? `\n\n> פרטי בסיס בזמן ההעברה: ${conv.basicsAtHandoff.have.length}/${conv.basicsAtHandoff.have.length + conv.basicsAtHandoff.missing.length}${conv.basicsAtHandoff.missing.length ? ` · חסר: ${conv.basicsAtHandoff.missing.join(", ")}` : " ✓"}`
        : "";
      sections.push(`### ${v === "before" ? "לפני" : "אחרי"}\n\n${render(conv.events)}${basics}\n`);
    }
  }
  fs.writeFileSync(out, sections.join("\n\n"));
  console.log(`\n→ ${out}`);
}

main();
