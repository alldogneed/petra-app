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
import { BOT_TOOLS, HANDOFF_MODE_TOOLS, LOOKUP_GUIDE_TOOL, runBotTurn, ToolError, type BotToolExecutor } from "@/lib/alldog-bot/agent";
import {
  HANDOFF_MODE_NOTE,
  HUMAN_ON_THE_WAY,
  callbackClosingText,
  handoffClosingText,
  isHumanRequest,
  withClosing,
} from "@/lib/alldog-bot/handoff";

/** The basics Or wants before any handoff (item 15a) — checked when the simulated handoff happens. */
export const HANDOFF_BASICS: Array<[keyof SavedFields, string]> = [
  ["dog_breed", "גזע"],
  ["dog_age", "גיל"],
  ["dog_since", "כמה זמן אצלם"],
  ["city", "עיר"],
  ["neighborhood", "שכונה/אזור"],
  ["full_name", "שם הפונה"],
  ["callback_time", "מתי נוח לחזור"],
];
type SavedFields = Record<"dog_breed" | "dog_age" | "dog_since" | "city" | "neighborhood" | "full_name" | "callback_time", string>;

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
  saved: Partial<SavedFields> = {};
  humanAckSent = false;
  /** Filled at the moment of the simulated handoff: which basics were (not) collected. */
  basicsAtHandoff: { have: string[]; missing: string[] } | null = null;
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
    const ex: BotToolExecutor = {
      closing: null,
      saveLead: async (input) => {
        if (input.full_name) this.knownName = input.full_name;
        for (const [k] of HANDOFF_BASICS) if (input[k]) this.saved[k] = input[k] as string;
        this.emit("tool", `save_lead ${JSON.stringify(input)}`);
        return "נשמר";
      },
      scheduleCallback: async ({ date, time }) => {
        this.emit("tool", `schedule_callback ${date} ${time}`);
        if (!isValidYmd(date)) throw new ToolError("תאריך לא תקין");
        if (!isWithinOfficeHours(date, time)) throw new ToolError("מחוץ לשעות הפעילות (א׳–ה׳ 09:00–17:00, ו׳ 09:00–14:00). הצע זמן אחר מהרשימה");
        if (israelInstant(date, time).getTime() < Date.now() + 15 * 60 * 1000) throw new ToolError("המועד כבר עבר או קרוב מדי. הצע זמן אחר מהרשימה");
        ex.closing = callbackClosingText(heDayLabel(date), time);
        return `נקבע. כתוב ללקוח בדיוק: "${ex.closing}"`;
      },
      handoff: async (input) => {
        this.emit("tool", `handoff_to_human ${JSON.stringify(input)} → משימה דחופה + התראה (לא נשלחות בסימולציה)`);
        this.status = "handoff";
        const have = HANDOFF_BASICS.filter(([k]) => this.saved[k]).map(([, l]) => l);
        const missing = HANDOFF_BASICS.filter(([k]) => !this.saved[k]).map(([, l]) => l);
        this.basicsAtHandoff = { have, missing };
        this.emit("info", `פרטי בסיס לפני ההעברה: ${have.length}/${HANDOFF_BASICS.length}${missing.length ? ` · חסר: ${missing.join(", ")}` : " ✓"}`);
        ex.closing = handoffClosingText(input.urgency);
        return `הועבר. כתוב ללקוח בדיוק: "${ex.closing}" ואל תשאל עוד שאלות`;
      },
    };
    return ex;
  }

  reset() {
    this.rows = [];
    this.status = "active";
    this.attribution = null;
    this.knownName = null;
    this.saved = {};
    this.humanAckSent = false;
    this.basicsAtHandoff = null;
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
    if (this.status === "stopped") {
      this.emit("info", "הבוט שותק (הלקוח ביקש לעצור)");
      return;
    }
    const handoffMode = this.status === "handoff";
    if (handoffMode) {
      this.emit("info", "אחרי העברה: התראה לנציגה עם הטקסט (בסימולציה לא נשלחת)");
      if (this.variant === "after" && isHumanRequest(text)) {
        if (!this.humanAckSent) {
          this.humanAckSent = true;
          this.emit("bot", HUMAN_ON_THE_WAY);
          this.rows.push({ role: "assistant", text: HUMAN_ON_THE_WAY });
        }
        return;
      }
      if (this.variant === "before") {
        this.emit("info", "הבוט שותק (גרסה ראשונה: אחרי העברה לא עונים)");
        return;
      }
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
      note:
        [
          handoffMode ? HANDOFF_MODE_NOTE : null,
          !handoffMode && this.rows.some((r) => r.role === "user" && mentionsHumanBite(r.text)) ? HUMAN_BITE_NOTE : null,
        ]
          .filter(Boolean)
          .join("\n") || null,
    });
    if (this.variant === "before") {
      // The first release's wording of the first-reply line.
      context = context.replace(/^זו ההודעה הראשונה.*$/m, "זו ההודעה הראשונה שלך בשיחה הזו.")
        .replace(/^השיחה כבר התחילה.*$/m, "השיחה כבר התחילה — אל תפתח שוב ב'היי , כאן AllDog'.");
    }

    const executor = this.executor();
    const result = await runBotTurn({
      client: this.client,
      model: this.model,
      context,
      history: toChatTurns(this.rows),
      executor,
      ...variantSetup(this.variant),
      ...(handoffMode ? { tools: HANDOFF_MODE_TOOLS } : {}),
    });
    for (const name of result.toolsUsed.filter((n) => n === "lookup_guide")) this.emit("tool", name);
    let reply = enforceIdentityAnswer(text, result.reply);
    if (this.variant === "after") {
      if (executor.closing) reply = withClosing(reply, executor.closing);
      else if (!handoffMode) {
        const firstUser = this.rows.filter((r) => r.role === "user").map((r) => r.text).join("\n");
        reply = enforceOpening(isFirstReply, firstUser, reply);
      }
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
