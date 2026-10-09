/**
 * Petra AI limits — shared by the API routes and the drawer.
 * Pure constants: safe to import from client code.
 */

/** Longest single question the user can send. */
export const ASSISTANT_MAX_MESSAGE_CHARS = 2000;

/** Messages (user + assistant) allowed in one conversation before a new one must be started. */
export const ASSISTANT_MAX_CONVERSATION_MESSAGES = 40;

/** How many of the latest messages are sent to the model as history. */
export const ASSISTANT_HISTORY_MESSAGES = 12;

/** Upper bound on one answer. */
export const ASSISTANT_MAX_OUTPUT_TOKENS = 4096;

/** Longest transcript copied into a support ticket ("דבר עם אדם"). */
export const ASSISTANT_MAX_TRANSCRIPT_CHARS = 20_000;

/** Longest free-text note the user can add when asking for a human. */
export const ASSISTANT_MAX_NOTE_CHARS = 1000;
