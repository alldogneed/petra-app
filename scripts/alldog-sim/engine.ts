/**
 * AllDog bot simulation engine (no WhatsApp, no database) — shared by
 * scripts/alldog-bot-sim.ts (interactive) and scripts/alldog-bot-compare.ts (before/after).
 * Uses the real prompt, tools, reply shaping and silence rules; save_lead / schedule_callback /
 * handoff are stubs that only record what they would do. lookup_guide is the real one.
 *
 * Checks printed as ⚙ lines (Or, 24/10 — items 15 + 22):
 *   - the collection order: name + dog → area → breed/age (`orderCheck`);
 *   - which basics were collected when the conversation closed (`basicsAtHandoff`);
 *   - warnings: a time / slot offer or "מתי נוח", an identity line nobody asked for,
 *     a repeated closing message, more than one echo + compliment, the surname asked twice,
 *     a doubled / merged word (`warnings`);
 *   - item 26h, per conversation (`report()`): ≤ 5 questions until the closing, ≥ 1 professional
 *     question, 0 identity lines nobody asked for, 0 repeated bot messages; "מכירים" warns;
 *   - "דחוף" when the customer says it is urgent (the lead would be marked urgent);
 *   - item 25: the address style each turn (gender f/m/unknown, plural) + warnings for "רשמנו /
 *     העברנו / אנחנו דואגים" and for "אתם / אליכם" the customer never used.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { heDayLabel, israelParts, nextCallbackPhrase } from "@/lib/alldog/time";
import { checkConversation, formatReport, type ConversationReport } from "@/lib/alldog-bot/conversation-checks";
import {
  INVENTED_FAMILIARITY_RE,
  applyConversationGuards,
  countMirrorPraise,
  findTextIssues,
  isStopRequest,
  parseAttributionLine,
  splitReply,
  SURNAME_QUESTION_RE,
  TEL_AVIV_RE,
  toChatTurns,
  cityAlreadyGiven,
  dropCheerfulOpeners,
  isSeriousIncident,
  namePlaceNote,
  MINOR_NOTE,
  seemsMinor,
  parseNamePlace,
  stripVocativeName,
  voiceNameNote,
  voiceOnlyName,
  VOICE_FAILED_REPLY,
  VOICE_FAILED_TEXT,
  voiceHistoryText,
  urgencyReason,
} from "@/lib/alldog-bot/logic";
import {
  buildBotContext,
  enforceIdentityAnswer,
  enforceOpening,
  HUMAN_BITE_NOTE,
  identityAnswerFor,
  mentionsHumanBite,
} from "@/lib/alldog-bot/prompt";
import { BOT_TOOLS, HANDOFF_MODE_TOOLS, LOOKUP_GUIDE_TOOL, runBotTurn, type BotToolExecutor } from "@/lib/alldog-bot/agent";
import { addressNote, addressStyleFor, applyAddressStyle, findAddressIssues, type AddressStyle } from "@/lib/alldog-bot/address";
import { areaToCheckNote, fixOutOfAreaLines, isKnownServiceCity, unknownAreaToolNote } from "@/lib/alldog-bot/areas";
import {
  CLOSED_NOTE,
  CLOSING_MARKER,
  HANDOFF_MODE_NOTE,
  humanOnTheWay,
  callbackClosingText,
  closingAlreadySent,
  handoffClosingText,
  closingWithTransition,
  TRANSITION_MARKER,
  isHumanRequest,
  withClosing,
} from "@/lib/alldog-bot/handoff";

type Field = "full_name" | "dog_name" | "city" | "neighborhood" | "dog_breed" | "dog_age" | "dog_since" | "callback_time";

/** The basics collected before the conversation closes (items 15a + 22a). Neighbourhood only in Tel Aviv (27a) → optional, like dog_since / callback_time. */
export const HANDOFF_BASICS: Array<[Field, string]> = [
  ["full_name", "שם מלא"],
  ["dog_name", "שם הכלב"],
  ["city", "עיר"],
  ["dog_breed", "גזע"],
  ["dog_age", "גיל"],
];

/** Fixed order (22a): step of each field. */
const STEP: Partial<Record<Field, number>> = { full_name: 1, dog_name: 1, city: 2, neighborhood: 2, dog_breed: 3, dog_age: 3 };

/** A bot message that offers a time / slot or asks when is convenient (forbidden, 22b). */
export function offersTime(text: string): boolean {
  return /מתי נוח|באיזו שעה|איזה יום|(^|\s)\d{1,2}:\d{2}|ביום (ראשון|שני|שלישי|רביעי|חמישי|שישי)|מחר ב|היום ב|בבוקר או|אחר הצהריים|בערב\?/u.test(text);
}

const IDENTITY_LINE = /העוזר המנהלתי|אני בוט|אני לא בן אדם/u;

/** Simulator input: "🎤 <text>" = a transcribed voice note, "🎤!" = one that could not be transcribed. */
export function parseSimVoice(raw: string): { isVoice: boolean; failed: boolean; text: string } {
  const m = raw.match(/^🎤\s*(!)?\s*([\s\S]*)$/u);
  if (!m) return { isVoice: false, failed: false, text: raw };
  return { isVoice: true, failed: !!m[1] || !m[2].trim(), text: m[2].trim() };
}

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
  rows: Array<{ role: string; text: string; voice?: boolean }> = [];
  status: Status = "active";
  attribution: { source: string | null; page: string | null } | null = null;
  knownName: string | null = null;
  /** An attack / bite was described (item 29c). */
  serious = false;
  /** Turn number at which each field was first saved. */
  savedAt: Partial<Record<Field, number>> = {};
  turn = 0;
  humanAckSent = false;
  /** How the customer is addressed this turn (item 25). */
  style: AddressStyle = { gender: "unknown", plural: false };
  /** Why the lead is urgent (null = not urgent). */
  urgent: string | null = null;
  /** Filled when the conversation closed (schedule_callback / handoff): which basics were (not) collected. */
  basicsAtHandoff: { have: string[]; missing: string[] } | null = null;
  warnings: string[] = [];
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

  private warn(text: string) {
    this.warnings.push(text);
    this.emit("info", `⚠ ${text}`);
  }

  private recordBasics() {
    if (this.basicsAtHandoff) return;
    const have = HANDOFF_BASICS.filter(([k]) => this.savedAt[k] !== undefined).map(([, l]) => l);
    const missing = HANDOFF_BASICS.filter(([k]) => this.savedAt[k] === undefined).map(([, l]) => l);
    this.basicsAtHandoff = { have, missing };
    this.emit("info", `פרטי בסיס בסגירה: ${have.length}/${HANDOFF_BASICS.length}${missing.length ? ` · חסר: ${missing.join(", ")}` : " ✓"}`);
    this.emit("info", this.orderCheck());
  }

  /** "סדר איסוף: …" — fields by the turn they were first saved, and whether steps 1 → 2 → 3 held. */
  orderCheck(): string {
    const firsts = (Object.entries(this.savedAt) as Array<[Field, number]>)
      .filter(([k]) => STEP[k])
      .sort((a, b) => a[1] - b[1]);
    let lastStep = 0;
    let ok = true;
    for (const [k] of firsts) {
      const step = STEP[k]!;
      if (step < lastStep) ok = false;
      lastStep = Math.max(lastStep, step);
    }
    const label = firsts.map(([k, t]) => `${k}@${t}`).join(" → ") || "—";
    return `סדר איסוף: ${label} ${ok ? "✓ (שם + כלב → אזור → השאר)" : "⚠ לא לפי הסדר"}`;
  }

  private transitionSent(): boolean {
    return this.rows.some((r) => r.role === "assistant" && r.text.includes(TRANSITION_MARKER));
  }

  private executor(): BotToolExecutor {
    const ex: BotToolExecutor = {
      closing: null,
      markUrgent: async (reason) => {
        if (!this.urgent) this.emit("info", `דחוף: ${reason} → הליד מסומן דחוף`);
        this.urgent = this.urgent ?? reason;
      },
      saveLead: async (input) => {
        if (input.urgent_reason) await ex.markUrgent?.(input.urgent_reason);
        if (input.full_name) this.knownName = input.full_name;
        for (const k of Object.keys(STEP).concat("dog_since", "callback_time") as Field[]) {
          if (input[k] && this.savedAt[k] === undefined) this.savedAt[k] = this.turn;
        }
        this.emit("tool", `save_lead ${JSON.stringify(input)}`);
        const notes: string[] = [];
        if (input.city && !isKnownServiceCity(input.city)) {
          this.emit("info", `${areaToCheckNote(input.city).replace("[וואטסאפ · בוט] ", "")} → נרשם בליד`);
          notes.push(unknownAreaToolNote(input.city, this.style.gender));
        }
        if (input.other_issues) this.emit("info", `בעיה נוספת נרשמה בליד: ${input.other_issues}`);
        return ["נשמר", ...notes].join(". ");
      },
      scheduleCallback: async ({ note }) => {
        this.emit("tool", `schedule_callback${note ? ` ${note}` : ""} → "לחזור טלפונית" + משימה לנציגה (בלי שעה${this.urgent ? ", URGENT" : ""})`);
        this.recordBasics();
        ex.closing = closingWithTransition(callbackClosingText(nextCallbackPhrase(new Date()), this.style.gender, { serious: this.serious }), this.transitionSent());
        return `סומן לחזרה טלפונית. כתוב ללקוח בדיוק: "${ex.closing}"`;
      },
      handoff: async (input) => {
        this.emit("tool", `handoff_to_human ${JSON.stringify(input)} → משימה דחופה + התראה (לא נשלחות בסימולציה)`);
        this.status = "handoff";
        this.recordBasics();
        const closing = handoffClosingText(nextCallbackPhrase(new Date()), this.style.gender, { serious: this.serious || input.urgency === "urgent" });
        ex.closing = input.urgency === "urgent" ? closing : closingWithTransition(closing, this.transitionSent());
        return `הועבר. כתוב ללקוח בדיוק: "${ex.closing}" ואל תשאל עוד שאלות`;
      },
    };
    return ex;
  }

  /** Item 26h: questions until the closing, professional questions, identity lines, repeats. */
  report(): ConversationReport {
    return checkConversation(
      this.events
        .filter((e) => e.kind === "user" || e.kind === "bot")
        .map((e) => ({ role: e.kind === "user" ? ("user" as const) : ("bot" as const), text: e.text }))
    );
  }

  reportLine(): string {
    return formatReport(this.report());
  }

  reset() {
    this.rows = [];
    this.status = "active";
    this.attribution = null;
    this.knownName = null;
    this.savedAt = {};
    this.turn = 0;
    this.humanAckSent = false;
    this.urgent = null;
    this.style = { gender: "unknown", plural: false };
    this.basicsAtHandoff = null;
    this.warnings = [];
  }

  private pushBot(text: string, userText: string) {
    if (this.variant === "after") {
      if (offersTime(text)) this.warn(`הצעת שעה / "מתי נוח": "${text.slice(0, 80)}"`);
      if (IDENTITY_LINE.test(text) && !identityAnswerFor(userText)) this.warn(`הודעת זהות בלי שנשאלו: "${text.slice(0, 80)}"`);
      if (text.includes(CLOSING_MARKER) && closingAlreadySent(this.rows)) this.warn("הודעת הסגירה חזרה פעם שנייה");
      const prior = this.rows.filter((r) => r.role === "assistant").map((r) => r.text);
      if (countMirrorPraise(text) && prior.some((t) => countMirrorPraise(t))) this.warn(`שיקוף + מחמאה בפעם השנייה: "${text.slice(0, 80)}"`);
      if (SURNAME_QUESTION_RE.test(text)) this.warn("נשאל שם משפחה (לא שואלים, 27b)");
      if (/שכונה/u.test(text) && /\?/.test(text) && !this.rows.some((r) => r.role === "user" && TEL_AVIV_RE.test(r.text))) this.warn("נשאלה שכונה מחוץ לתל אביב (27a)");
      if (INVENTED_FAMILIARITY_RE.test(text)) this.warn(`היכרות מומצאת ("מכירים"): "${text.slice(0, 80)}"`);
      for (const issue of findAddressIssues(text, this.style)) {
        this.warn(`${issue.kind === "self_plural" ? "הבוט מדבר ברבים על עצמו" : "פנייה ברבים שהלקוח לא השתמש בה"}: "${issue.text}"`);
      }
      for (const issue of findTextIssues(text)) this.warn(`${{ duplicate_word: "מילה כפולה", merged_word: "מילים מחוברות", wrong_form: "צורה שגויה", number_gender: "מספר במין הלא נכון" }[issue.kind]}: "${issue.text}"`);
    }
    this.emit("bot", text);
    this.rows.push({ role: "assistant", text });
  }

  async send(raw: string): Promise<void> {
    this.turn++;
    const parsed = parseAttributionLine(raw);
    if ((parsed.source || parsed.page) && !this.attribution) {
      this.attribution = { source: parsed.source, page: parsed.page };
      this.emit("info", `שיוך: ${[parsed.source, parsed.page].filter(Boolean).join(" · ")}`);
    }
    // "🎤 <text>" = a voice note transcribed to <text>; "🎤!" = a voice note that failed (item 28a).
    const voice = parseSimVoice(parsed.text || raw);
    if (voice.failed) {
      this.emit("user", VOICE_FAILED_TEXT);
      this.emit("info", `הודעה קולית: התמלול נכשל → "${VOICE_FAILED_REPLY}"`);
      const last = [...this.rows].reverse().find((r) => r.role === "assistant");
      this.rows.push({ role: "user", text: VOICE_FAILED_TEXT, voice: true });
      if (last?.text !== VOICE_FAILED_REPLY) this.pushBot(VOICE_FAILED_REPLY, "");
      return;
    }
    const text = voice.text;
    this.emit("user", voice.isVoice ? `🎤 ${text}` : text);
    if (voice.isVoice) this.emit("info", "הודעה קולית: תומללה (ElevenLabs בפרודקשן) → הבוט עונה לתמלול");
    this.rows.push({ role: "user", text, ...(voice.isVoice ? { voice: true } : {}) });

    if (isStopRequest(text)) {
      this.status = "stopped";
      this.emit("info", "הלקוח ביקש לעצור — הבוט שותק מעכשיו");
      return;
    }
    if (this.status === "stopped") {
      this.emit("info", "הבוט שותק (הלקוח ביקש לעצור)");
      return;
    }
    const why = this.urgent ? null : urgencyReason(text);
    if (why) {
      this.urgent = why;
      this.emit("info", `דחוף: ${why} → הליד מסומן דחוף + המשימה לנציגה URGENT`);
    }
    const prevGender = this.style.gender;
    const userTexts = this.rows.filter((r) => r.role === "user" && r.text !== VOICE_FAILED_TEXT).map((r) => r.text);
    const priorBot = this.rows.filter((r) => r.role === "assistant").map((r) => r.text);
    // Item 29d: a name heard only in a voice note is not used until confirmed.
    const voiceName = this.variant === "after"
      ? voiceOnlyName({
          name: this.knownName,
          typedTexts: this.rows.filter((r) => r.role === "user" && !r.voice).map((r) => r.text),
          voiceTexts: this.rows.filter((r) => r.role === "user" && r.voice && r.text !== VOICE_FAILED_TEXT).map((r) => r.text),
          priorBotTexts: priorBot,
        })
      : null;
    if (voiceName) this.emit("info", `השם "${voiceName}" נשמע רק בהודעה קולית → לא פונים בשם (29d)`);
    this.serious = isSeriousIncident(userTexts);
    this.style = addressStyleFor({
      texts: userTexts,
      name: voiceName ? null : this.knownName,
    });
    if (this.style.gender !== prevGender || this.turn === 1) {
      this.emit("info", `פנייה: ${{ f: "נקבה", m: "זכר", unknown: "לא ידוע (ניטרלי)" }[this.style.gender]}${this.style.plural ? " · הלקוח מדבר ברבים" : ""}`);
    }
    const handoffMode = this.status === "handoff";
    if (handoffMode) {
      this.emit("info", "אחרי העברה: התראה לנציגה עם הטקסט (בסימולציה לא נשלחת)");
      if (this.variant === "after" && isHumanRequest(text)) {
        if (!this.humanAckSent) {
          this.humanAckSent = true;
          this.pushBot(humanOnTheWay(this.style.gender), text);
        }
        return;
      }
      if (this.variant === "before") {
        this.emit("info", "הבוט שותק (גרסה ראשונה: אחרי העברה לא עונים)");
        return;
      }
    }

    const isFirstReply = !this.rows.some((r) => r.role === "assistant");
    const closed = this.variant === "after" && closingAlreadySent(this.rows);
    const now = new Date();
    const p = israelParts(now);
    let context = buildBotContext({
      nowLabel: `${heDayLabel(p.ymd)} בשעה ${p.hhmm}`,
      attribution: this.attribution,
      knownName: voiceName ? null : this.knownName,
      isFirstReply,
      note:
        [
          this.variant === "after" ? namePlaceNote(text) : null,
          voiceName ? voiceNameNote(voiceName, priorBot) : null,
          handoffMode ? HANDOFF_MODE_NOTE : null,
          closed ? CLOSED_NOTE : null,
          !handoffMode && this.rows.some((r) => r.role === "user" && mentionsHumanBite(r.text)) ? HUMAN_BITE_NOTE : null,
          this.variant === "after" && seemsMinor(this.rows.filter((r) => r.role === "user").map((r) => r.text)) ? MINOR_NOTE : null,
          this.variant === "after" ? addressNote(this.style) : null,
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
      history: toChatTurns(
        this.rows.map((r) =>
          r.voice ? { role: r.role, text: r.text === VOICE_FAILED_TEXT ? "[הודעה קולית שלא הצלחת לשמוע]" : voiceHistoryText(r.text) } : r
        )
      ),
      executor,
      ...variantSetup(this.variant),
      ...(handoffMode ? { tools: HANDOFF_MODE_TOOLS } : {}),
    });
    for (const name of result.toolsUsed.filter((n) => n === "lookup_guide")) this.emit("tool", name);
    let reply = enforceIdentityAnswer(text, result.reply);
    if (this.variant === "after") {
      const prior = this.rows.filter((r) => r.role === "assistant").map((r) => r.text);
      if (/מחוץ\s+ל(?:ה)?אזור|לא\s+ברשימה/u.test(reply)) this.warn(`המודל כתב "מחוץ לאזור" / "לא ברשימה" (הוחלף, 28b): "${reply.slice(0, 80)}"`);
      reply = fixOutOfAreaLines(applyAddressStyle(applyConversationGuards(reply, prior, {
        userTexts,
        known: {
          city: cityAlreadyGiven(this.rows),
          dogName: userTexts.some((t) => !!parseNamePlace(t)),
        },
      }), this.style), this.style.gender, prior);
      reply = stripVocativeName(reply, voiceName);
      if (this.serious) reply = dropCheerfulOpeners(reply);
    }
    if (this.variant === "after") {
      if (executor.closing && !closed) reply = withClosing(reply, executor.closing);
      else if (!handoffMode && !executor.closing) {
        const firstUser = this.rows.filter((r) => r.role === "user").map((r) => r.text).join("\n");
        reply = enforceOpening(isFirstReply, firstUser, reply);
      }
    }
    if (!reply) {
      this.emit("info", `אין תשובה (${result.stopReason ?? "?"}) — בפרודקשן: העברה לנציג`);
      return;
    }
    for (const part of splitReply(reply, 2)) this.pushBot(part, text);
  }
}
