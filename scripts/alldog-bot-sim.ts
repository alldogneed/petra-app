/**
 * AllDog WhatsApp bot — local simulation (no WhatsApp, no database).
 * Talk to the bot in the terminal to check the tone. Uses the real prompt, tools,
 * reply shaping and silence rules; save_lead / schedule_callback / handoff are stubs that
 * only print what they would do (scripts/alldog-sim/engine.ts). lookup_guide is the real one.
 *
 * Run (from the repo root, ALLDOG_ANTHROPIC_API_KEY or ANTHROPIC_API_KEY from your env):
 *   npm run alldog:sim
 *   npm run alldog:sim -- --scenario cats     # replay a scripted customer (scripts/alldog-sim/scenarios.ts)
 *   npm run alldog:sim -- --before            # the first release's prompt, for comparison
 * Before/after report of all scenarios: npm run alldog:compare
 *
 * Optional: ALLDOG_BOT_MODEL=… ; pipe a file of lines to replay a conversation.
 * Commands: /reset (new conversation) · /quit
 */
import * as readline from "node:readline";
import Anthropic from "@anthropic-ai/sdk";
import { allDogAnthropicKey, botModel } from "@/lib/alldog/config";
import { typingDelayMs } from "@/lib/alldog-bot/logic";
import { SimConversation, type SimEvent } from "./alldog-sim/engine";
import { SCENARIOS } from "./alldog-sim/scenarios";

const gray = (s: string) => `\x1b[90m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

function print(e: SimEvent, echoUser: boolean) {
  if (e.kind === "user") {
    if (echoUser) console.log(`את/ה: ${e.text}`);
  } else if (e.kind === "bot") {
    console.log(gray(`  …מקליד ${(typingDelayMs(e.text) / 1000).toFixed(1)} ש׳`));
    console.log(green(`AllDog: ${e.text}`));
  } else {
    console.log(gray(`  ⚙ ${e.text}`));
  }
}

async function main() {
  const key = allDogAnthropicKey();
  if (!key) {
    console.error("ALLDOG_ANTHROPIC_API_KEY / ANTHROPIC_API_KEY חסר");
    process.exit(1);
  }
  const client = new Anthropic({ apiKey: key });
  const variant = process.argv.includes("--before") ? "before" : "after";
  const scenarioId = process.argv[process.argv.indexOf("--scenario") + 1];
  const scenario = process.argv.includes("--scenario") ? SCENARIOS.find((s) => s.id === scenarioId) : null;
  const echo = !process.stdin.isTTY || !!scenario;
  const conv = new SimConversation(client, botModel(), variant, (e) => print(e, echo));

  if (process.argv.includes("--scenario")) {
    if (!scenario) {
      console.error(`תרחישים: ${SCENARIOS.map((s) => s.id).join(", ")}`);
      process.exit(1);
    }
    console.log(gray(`תרחיש: ${scenario.title} (${variant === "before" ? "לפני" : "אחרי"})`));
    for (const line of scenario.lines) {
      if (conv.status === "stopped") break;
      await conv.send(line);
    }
    return;
  }

  console.log(gray(`סימולציית בוט AllDog${variant === "before" ? " (גרסה ראשונה)" : ""}. כתוב כמו לקוח. /reset להתחלה מחדש, /quit ליציאה.`));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  const prompt = () => {
    if (!process.stdin.isTTY) return;
    rl.setPrompt("את/ה: ");
    rl.prompt();
  };
  prompt();
  for await (const line of rl) {
    const input = line.trim();
    if (!input) { prompt(); continue; }
    if (input === "/quit") break;
    if (input === "/reset") {
      conv.reset();
      console.log(gray("— שיחה חדשה —"));
      prompt();
      continue;
    }
    const started = Date.now();
    try {
      await conv.send(input);
      console.log(gray(`  (${((Date.now() - started) / 1000).toFixed(1)} ש׳ · ${botModel()})`));
    } catch (err) {
      console.error("שגיאה:", err instanceof Error ? err.message : err);
    }
    prompt();
  }
  rl.close();
}

main();
