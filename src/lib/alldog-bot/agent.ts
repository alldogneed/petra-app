/**
 * AllDog WhatsApp bot — one model turn with tools (manual tool-use loop).
 *
 * The executor is injected: the real one (actions.ts) writes to Petra through the
 * lead services; the simulation script uses a stub. Tool inputs are validated
 * with zod here, so executors receive clean values.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ALLDOG_BOT_PROMPT } from "@/lib/alldog-bot/prompt";
import { polishReply } from "@/lib/alldog-bot/logic";
import { lookupGuide } from "@/lib/alldog-bot/knowledge";

// ─── Tools ───────────────────────────────────────────────────────────────────

export const LOOKUP_GUIDE_TOOL: Anthropic.Tool = {
  name: "lookup_guide",
  description:
    "חיפוש במדריכים המקצועיים של AllDog (all-dog.co.il/guides). מחזיר תובנות מקצועיות וקישור למדריך המתאים. לקרוא כשהלקוח מתאר בעיה התנהגותית או שואל שאלה מקצועית.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["topic"],
    properties: {
      topic: { type: "string", description: "הבעיה בכמה מילים, כמו שהלקוח תיאר, למשל 'רודף אחרי חתולים' או 'נובח על אנשים שעוברים ליד הבית'" },
    },
  },
};

export const BOT_TOOLS: Anthropic.Tool[] = [
  LOOKUP_GUIDE_TOOL,
  {
    name: "save_lead",
    description:
      "יצירה או עדכון של הליד של הלקוח הזה (לפי הטלפון של השיחה). לקרוא אחרי כל פרט חדש שהלקוח מסר. לשלוח רק שדות שהלקוח אמר בפועל.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        full_name: { type: "string", description: "שם הלקוח כפי שאמר" },
        dog_name: { type: "string" },
        dog_age: { type: "string", description: "טקסט חופשי, למשל 'שנה וחצי'" },
        dog_breed: { type: "string" },
        dog_since: { type: "string", description: "כמה זמן הכלב אצלם, למשל 'שנתיים' או 'מגיל 8 שבועות'" },
        problem: { type: "string", description: "הבעיה במשפט קצר, כולל ממתי והאם היו נשיכות אם נאמר" },
        city: { type: "string" },
        neighborhood: { type: "string", description: "שכונה או אזור בעיר, אם נאמר" },
        callback_time: { type: "string", description: "מתי נוח ללקוח שיחזרו אליו, כפי שאמר (למשל 'אחרי 17:00')" },
        service: { type: "string", description: "מה הלקוח מחפש: אילוף אינטנסיבי בבית / שיעורים פרטיים / אילוף בתנאי פנסיון / לא ברור" },
        summary: { type: "string", description: "סיכום של 1–3 משפטים של כל מה שידוע עד עכשיו, לצוות (כולל שכונה, כמה זמן הכלב אצלם ומתי נוח לחזור, אם נאמר)" },
      },
    },
  },
  {
    name: "schedule_callback",
    description:
      "קביעת מועד לשיחה טלפונית של נציגת AllDog עם הלקוח (נרשם כמשימת מעקב). רק בשעות פעילות: א׳–ה׳ 09:00–17:00, ו׳ 09:00–14:00, ובעתיד.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["date", "time"],
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM שעון ישראל" },
      },
    },
  },
  {
    name: "handoff_to_human",
    description:
      "העברה למאלף / לנציגה: נפתחת משימה דחופה והצוות מקבל התראה. לקרוא רק אחרי שנאספו פרטי הבסיס (או שהלקוח לא רצה לענות). להשתמש כשהלקוח מבקש בן אדם, במקרה בטיחות כמו נשיכה של אדם (urgency=urgent), או כשאין לך תשובה. מחזיר את הודעת הסגירה לכתוב ללקוח.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["reason", "urgency"],
      properties: {
        reason: { type: "string", description: "למה מעבירים, משפט אחד" },
        urgency: { type: "string", enum: ["urgent", "normal"] },
      },
    },
  },
];

/** While the conversation is with a person: answer questions and save details only. */
export const HANDOFF_MODE_TOOLS: Anthropic.Tool[] = BOT_TOOLS.filter((t) => t.name === "lookup_guide" || t.name === "save_lead");

const trimmed = (max: number) => z.string().transform((s) => s.replace(/\s+/g, " ").trim().slice(0, max)).optional();

export const saveLeadInput = z.object({
  full_name: trimmed(100),
  dog_name: trimmed(100),
  dog_age: trimmed(50),
  dog_breed: trimmed(100),
  dog_since: trimmed(100),
  problem: trimmed(500),
  city: trimmed(100),
  neighborhood: trimmed(100),
  callback_time: trimmed(200),
  service: trimmed(200),
  summary: trimmed(1000),
});
export const scheduleCallbackInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});
export const lookupGuideInput = z.object({
  topic: z.string().transform((s) => s.replace(/\s+/g, " ").trim().slice(0, 200)).pipe(z.string().min(2)),
});
export const handoffInput = z.object({
  reason: z.string().transform((s) => s.replace(/\s+/g, " ").trim().slice(0, 500)),
  urgency: z.enum(["urgent", "normal"]),
});

export type SaveLeadInput = z.infer<typeof saveLeadInput>;
export type ScheduleCallbackInput = z.infer<typeof scheduleCallbackInput>;
export type HandoffInput = z.infer<typeof handoffInput>;

/** Each returns a short Hebrew/plain result string for the model, or throws a ToolError. */
export interface BotToolExecutor {
  saveLead(input: SaveLeadInput): Promise<string>;
  scheduleCallback(input: ScheduleCallbackInput): Promise<string>;
  handoff(input: HandoffInput): Promise<string>;
  /** Set by scheduleCallback / handoff: the fixed closing message the customer must get. */
  closing?: string | null;
}

/** A failure the model should see and recover from (e.g. "outside office hours"). */
export class ToolError extends Error {}

// ─── Turn ────────────────────────────────────────────────────────────────────

export interface BotTurnResult {
  reply: string;
  handedOff: boolean;
  toolsUsed: string[];
  stopReason: string | null;
}

const MAX_TOOL_ROUNDS = 5;

async function runTool(executor: BotToolExecutor, block: Anthropic.ToolUseBlock): Promise<{ content: string; isError: boolean }> {
  try {
    switch (block.name) {
      case "lookup_guide": {
        // Read-only and local (knowledge-data.json) — no executor needed, same in production and the simulator.
        const p = lookupGuideInput.safeParse(block.input);
        if (!p.success) return { content: "topic חסר", isError: true };
        return { content: lookupGuide(p.data.topic), isError: false };
      }
      case "save_lead": {
        const p = saveLeadInput.safeParse(block.input);
        if (!p.success) return { content: "קלט לא תקין", isError: true };
        return { content: await executor.saveLead(p.data), isError: false };
      }
      case "schedule_callback": {
        const p = scheduleCallbackInput.safeParse(block.input);
        if (!p.success) return { content: "date חייב להיות YYYY-MM-DD ו-time חייב להיות HH:MM", isError: true };
        return { content: await executor.scheduleCallback(p.data), isError: false };
      }
      case "handoff_to_human": {
        const p = handoffInput.safeParse(block.input);
        if (!p.success) return { content: "קלט לא תקין", isError: true };
        return { content: await executor.handoff(p.data), isError: false };
      }
      default:
        return { content: `כלי לא מוכר: ${block.name}`, isError: true };
    }
  } catch (err) {
    if (err instanceof ToolError) return { content: err.message, isError: true };
    console.error(`[alldog-bot] tool ${block.name} failed:`, err instanceof Error ? err.message : err);
    return { content: "שגיאה פנימית — אל תזכיר אותה ללקוח, המשך בשיחה", isError: true };
  }
}

export async function runBotTurn(opts: {
  client: Anthropic;
  model: string;
  context: string;
  history: Anthropic.MessageParam[];
  executor: BotToolExecutor;
  /** Simulator only (before/after comparison): another system prompt / tool set. */
  systemPrompt?: string;
  tools?: Anthropic.Tool[];
}): Promise<BotTurnResult> {
  const messages: Anthropic.MessageParam[] = [...opts.history];
  const toolsUsed: string[] = [];
  let handedOff = false;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const response = await opts.client.messages.create({
      model: opts.model,
      max_tokens: 4000,
      output_config: { effort: "low" },
      system: [
        { type: "text", text: opts.systemPrompt ?? ALLDOG_BOT_PROMPT, cache_control: { type: "ephemeral" } },
        { type: "text", text: opts.context },
      ],
      tools: opts.tools ?? BOT_TOOLS,
      messages,
    });

    if (response.stop_reason === "refusal") {
      return { reply: "", handedOff, toolsUsed, stopReason: "refusal" };
    }

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || toolUses.length === 0 || round === MAX_TOOL_ROUNDS) {
      const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
      return { reply: polishReply(text), handedOff, toolsUsed, stopReason: response.stop_reason };
    }

    // Append the whole assistant content (thinking blocks included), then all results in one user turn.
    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUses) {
      toolsUsed.push(block.name);
      const r = await runTool(opts.executor, block);
      if (block.name === "handoff_to_human" && !r.isError) handedOff = true;
      results.push({ type: "tool_result", tool_use_id: block.id, content: r.content, is_error: r.isError || undefined });
    }
    messages.push({ role: "user", content: results });
  }
  return { reply: "", handedOff, toolsUsed, stopReason: null };
}
