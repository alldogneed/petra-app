/**
 * AllDog WhatsApp bot — local simulation (no WhatsApp, no database).
 * Talk to the bot in the terminal to check the tone. Uses the real prompt, tools,
 * reply shaping and silence rules; the tools are stubs that only print what they would do.
 *
 * Run (from the repo root, ANTHROPIC_API_KEY from your env):
 *   npm run alldog:sim
 *
 * Optional: ALLDOG_BOT_MODEL=… ; pipe a file of lines to replay a scripted conversation.
 * Commands: /reset (new conversation) · /quit
 */
import * as readline from "node:readline";
import Anthropic from "@anthropic-ai/sdk";
import { botModel } from "@/lib/alldog/config";
import { heDayLabel, isValidYmd, isWithinOfficeHours, israelInstant, israelParts, nextCallbackOptions } from "@/lib/alldog/time";
import { isStopRequest, parseAttributionLine, splitReply, toChatTurns, typingDelayMs } from "@/lib/alldog-bot/logic";
import { buildBotContext, enforceIdentityAnswer } from "@/lib/alldog-bot/prompt";
import { runBotTurn, ToolError, type BotToolExecutor } from "@/lib/alldog-bot/agent";

const gray = (s: string) => `\x1b[90m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;

type Status = "active" | "handoff" | "stopped";
let rows: Array<{ role: string; text: string }> = [];
let status: Status = "active";
let attribution: { source: string | null; page: string | null } | null = null;
let knownName: string | null = null;

const executor: BotToolExecutor = {
  async saveLead(input) {
    if (input.full_name) knownName = input.full_name;
    console.log(gray(`  ⚙ save_lead ${JSON.stringify(input)}`));
    return "נשמר";
  },
  async scheduleCallback({ date, time }) {
    console.log(gray(`  ⚙ schedule_callback ${date} ${time}`));
    if (!isValidYmd(date)) throw new ToolError("תאריך לא תקין");
    if (!isWithinOfficeHours(date, time)) throw new ToolError("מחוץ לשעות הפעילות (א׳–ה׳ 09:00–17:00, ו׳ 09:00–14:00). הצע זמן אחר מהרשימה");
    if (israelInstant(date, time).getTime() < Date.now() + 15 * 60 * 1000) throw new ToolError("המועד כבר עבר או קרוב מדי. הצע זמן אחר מהרשימה");
    return `נקבע: ${heDayLabel(date)} ב-${time}`;
  },
  async handoff(input) {
    console.log(gray(`  ⚙ handoff_to_human ${JSON.stringify(input)} → משימה דחופה + התראה (לא נשלחות בסימולציה)`));
    status = "handoff";
    return "הועבר לנציג. כתוב הודעה אחת קצרה שנציגה תחזור אליו בהקדם, ואל תשאל עוד שאלות";
  },
};

async function turn(client: Anthropic, raw: string): Promise<void> {
  const parsed = parseAttributionLine(raw);
  if ((parsed.source || parsed.page) && !attribution) {
    attribution = { source: parsed.source, page: parsed.page };
    console.log(gray(`  ⚙ שיוך: ${[parsed.source, parsed.page].filter(Boolean).join(" · ")}`));
  }
  const text = parsed.text || raw;
  rows.push({ role: "user", text });

  if (isStopRequest(text)) {
    status = "stopped";
    console.log(gray("  ⚙ הלקוח ביקש לעצור — הבוט שותק מעכשיו"));
    return;
  }
  if (status !== "active") {
    console.log(gray(`  ⚙ הבוט שותק (${status === "handoff" ? "הועבר לנציג" : "הלקוח ביקש לעצור"})`));
    return;
  }

  const now = new Date();
  const p = israelParts(now);
  const context = buildBotContext({
    nowLabel: `${heDayLabel(p.ymd)} בשעה ${p.hhmm}`,
    callbackOptions: nextCallbackOptions(now, 3).map((o) => `${o.label} (date=${o.ymd}, time=${o.hhmm})`),
    attribution,
    knownName,
    isFirstReply: !rows.some((r) => r.role === "assistant"),
  });
  const started = Date.now();
  const result = await runBotTurn({ client, model: botModel(), context, history: toChatTurns(rows), executor });
  const reply = enforceIdentityAnswer(text, result.reply);
  if (!reply) {
    console.log(gray(`  ⚙ אין תשובה (${result.stopReason ?? "?"}) — בפרודקשן: העברה לנציג`));
    return;
  }
  for (const part of splitReply(reply, 2)) {
    console.log(gray(`  …מקליד ${(typingDelayMs(part) / 1000).toFixed(1)} ש׳`));
    console.log(green(`AllDog: ${part}`));
    rows.push({ role: "assistant", text: part });
  }
  console.log(gray(`  (${((Date.now() - started) / 1000).toFixed(1)} ש׳ מודל · ${botModel()}${result.toolsUsed.length ? ` · כלים: ${result.toolsUsed.join(", ")}` : ""})`));
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY חסר");
    process.exit(1);
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  console.log(gray("סימולציית בוט AllDog. כתוב כמו לקוח. /reset להתחלה מחדש, /quit ליציאה."));
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
      rows = [];
      status = "active";
      attribution = null;
      knownName = null;
      console.log(gray("— שיחה חדשה —"));
      prompt();
      continue;
    }
    if (!process.stdin.isTTY) console.log(`את/ה: ${input}`);
    try {
      await turn(client, input);
    } catch (err) {
      console.error("שגיאה:", err instanceof Error ? err.message : err);
    }
    prompt();
  }
  rl.close();
}

main();
