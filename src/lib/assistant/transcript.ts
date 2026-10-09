/**
 * Builds the support-ticket text for a Petra AI escalation ("דבר עם אדם").
 */

import { ASSISTANT_MAX_TRANSCRIPT_CHARS } from "./limits";

export interface TranscriptMessage {
  role: string;
  content: string;
}

export interface EscalationTextInput {
  screenName: string | null;
  note: string | null;
  messages: TranscriptMessage[];
}

const SPEAKER: Record<string, string> = { user: "משתמש", assistant: "Petra AI" };

/**
 * Ticket description: who asked, from which screen, the user's note and the chat.
 * When the chat is too long the oldest messages are dropped — the latest ones are
 * what the support person needs.
 */
export function buildEscalationText({ screenName, note, messages }: EscalationTextInput): string {
  const header = [
    "המשתמש ביקש לדבר עם אדם מתוך Petra AI.",
    `מסך: ${screenName ?? "לא ידוע"}`,
    ...(note ? [`הערת המשתמש: ${note}`] : []),
  ].join("\n");

  if (messages.length === 0) return header;

  const kept: string[] = [];
  let size = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const line = `${SPEAKER[messages[i].role] ?? messages[i].role}: ${messages[i].content}`;
    if (kept.length > 0 && size + line.length > ASSISTANT_MAX_TRANSCRIPT_CHARS) break;
    kept.unshift(line.slice(0, ASSISTANT_MAX_TRANSCRIPT_CHARS));
    size += line.length;
  }
  const dropped = messages.length - kept.length;

  return [
    header,
    "",
    "— תמלול השיחה —",
    ...(dropped > 0 ? [`(${dropped} הודעות מתחילת השיחה הושמטו)`] : []),
    kept.join("\n\n"),
  ].join("\n");
}
