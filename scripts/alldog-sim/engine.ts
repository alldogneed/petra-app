/**
 * AllDog bot simulation engine (no WhatsApp, no database) — shared by
 * scripts/alldog-bot-sim.ts (interactive) and scripts/alldog-bot-compare.ts (before/after).
 * Uses the real prompt, tools, reply shaping and silence rules; save_lead / schedule_callback /
 * handoff are stubs that only record what they would do. lookup_guide is the real one.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { heDayLabel, isValidYmd, isWithinOfficeHours, israelInstant, israelParts, nextCallbackOptions } from "@/lib/alldog/time";
import { isStopRequest, parseAttributionLine, splitReply, toChatTurns } from "@/lib/alldog-bot/logic";
import { buildBotContext, enforceIdentityAnswer, enforceOpening, HUMAN_BITE_NOTE, mentionsHumanBite } from "@/lib/alldog-bot/prompt";
import { BOT_TOOLS, LOOKUP_GUIDE_TOOL, runBotTurn, ToolError, type BotToolExecutor } from "@/lib/alldog-bot/agent";

export type Variant = "before" | "after";

/** "before" = the prompt + tools of the first release (no guides, old opening); "after" = current code. */
export function variantSetup(variant: Variant): { systemPrompt?: string; tools?: Anthropic.Tool[] } {
  if (variant === "after") return {};
  return {
    systemPrompt: fs.readFileSync(path.join(__dirname, "prompt-v1.txt"), "utf8").trimEnd(),
    tools: BOT_TOOLS.filter((t) => t.name !== LOOKUP_GUIDE_TOOL.name),
  };
}

export interface SimEvent {
  kind: "user" | "bot" | "tool" | "info";
  text: string;
}

type Status = "active" | "handoff" | "stopped";

export class SimConversation {
  rows: Array<{ role: string; text: string }> = [];
  status: Status = "active";
  attribution: { source: string | null; page: string | null } | null = null;
  knownName: string | null = null;
  readonly events: SimEvent[] = [];

  constructor(
    private client: Anthropic,
    private model: string,
    private variant: Variant = "after",
    private onEvent: (e: SimEvent) => void = () => {}
  ) {}

  private emit(kind: SimEvent["kind"], text: string) {
    const e = { kind, text };
    this.events.push(e);
    this.onEvent(e);
  }

  private executor(): BotToolExecutor {
    return {
      saveLead: async (input) => {
        if (input.full_name) this.knownName = input.full_name;
        this.emit("tool", `save_lead ${JSON.stringify(input)}`);
        return "נשמר";
      },
      scheduleCallback: async ({ date, time }) => {
        this.emit("tool", `schedule_callback ${date} ${time}`);
        if (!isValidYmd(date)) throw new ToolError("תאריך לא תקין");
        if (!isWithinOfficeHours(date, time)) throw new ToolError("מחוץ לשעות הפעילות (א׳–ה׳ 09:00–17:00, ו׳ 09:00–14:00). הצע זמן אחר מהרשימה");
        if (israelInstant(date, time).getTime() < Date.now() + 15 * 60 * 1000) throw new ToolError("המועד כבר עבר או קרוב מדי. הצע זמן אחר מהרשימה");
        return `נקבע: ${heDayLabel(date)} ב-${time}`;
      },
      handoff: async (input) => {
        this.emit("tool", `handoff_to_human ${JSON.stringify(input)} → משימה דחופה + התראה (לא נשלחות בסימולציה)`);
        this.status = "handoff";
        return "הועבר לנציג. כתוב הודעה אחת קצרה שנציגה תחזור אליו בהקדם, ואל תשאל עוד שאלות";
      },
    };
  }

  reset() {
    this.rows = [];
    this.status = "active";
    this.attribution = null;
    this.knownName = null;
  }

  async send(raw: string): Promise<void> {
    const parsed = parseAttributionLine(raw);
    if ((parsed.source || parsed.page) && !this.attribution) {
      this.attribution = { source: parsed.source, page: parsed.page };
      this.emit("info", `שיוך: ${[parsed.source, parsed.page].filter(Boolean).join(" · ")}`);
    }
    const text = parsed.text || raw;
    this.emit("user", text);
    this.rows.push({ role: "user", text });

    if (isStopRequest(text)) {
      this.status = "stopped";
      this.emit("info", "הלקוח ביקש לעצור — הבוט שותק מעכשיו");
      return;
    }
    if (this.status !== "active") {
      this.emit("info", `הבוט שותק (${this.status === "handoff" ? "הועבר לנציג" : "הלקוח ביקש לעצור"})`);
      return;
    }

    const isFirstReply = !this.rows.some((r) => r.role === "assistant");
    const now = new Date();
    const p = israelParts(now);
    let context = buildBotContext({
      nowLabel: `${heDayLabel(p.ymd)} בשעה ${p.hhmm}`,
      callbackOptions: nextCallbackOptions(now, 3).map((o) => `${o.label} (date=${o.ymd}, time=${o.hhmm})`),
      attribution: this.attribution,
      knownName: this.knownName,
      isFirstReply,
      note: mentionsHumanBite(text) ? HUMAN_BITE_NOTE : null,
    });
    if (this.variant === "before") {
      // The first release's wording of the first-reply line.
      context = context.replace(/^זו ההודעה הראשונה.*$/m, "זו ההודעה הראשונה שלך בשיחה הזו.")
        .replace(/^השיחה כבר התחילה.*$/m, "השיחה כבר התחילה — אל תפתח שוב ב'היי , כאן AllDog'.");
    }

    const result = await runBotTurn({
      client: this.client,
      model: this.model,
      context,
      history: toChatTurns(this.rows),
      executor: this.executor(),
      ...variantSetup(this.variant),
    });
    for (const name of result.toolsUsed.filter((n) => n === "lookup_guide")) this.emit("tool", name);
    let reply = enforceIdentityAnswer(text, result.reply);
    if (this.variant === "after" && !result.handedOff) {
      const firstUser = this.rows.filter((r) => r.role === "user").map((r) => r.text).join("\n");
      reply = enforceOpening(isFirstReply, firstUser, reply);
    }
    if (!reply) {
      this.emit("info", `אין תשובה (${result.stopReason ?? "?"}) — בפרודקשן: העברה לנציג`);
      return;
    }
    for (const part of splitReply(reply, 2)) {
      this.emit("bot", part);
      this.rows.push({ role: "assistant", text: part });
    }
  }
}
