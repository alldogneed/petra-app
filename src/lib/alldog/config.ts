/**
 * AllDog-only automations inside Petra (PayCall call summaries + the WhatsApp bot).
 *
 * Nothing here is a product feature: every entry point checks one of the flags
 * below, and the flags only ever act on ALLDOG_BUSINESS_ID. Other businesses are
 * never touched. Read from process.env directly (not env.ts) so pure modules and
 * the local simulation script can import it.
 */
import { readEnv } from "@/lib/read-env";

const truthy = (v: string | undefined) => v?.trim().toLowerCase() === "true";

/** The one business these automations run for. Null = not configured → everything is off. */
export function allDogBusinessId(): string | null {
  return readEnv("ALLDOG_BUSINESS_ID") || null;
}

export function isAllDogBusiness(businessId: string | null | undefined): boolean {
  const id = allDogBusinessId();
  return !!id && !!businessId && businessId === id;
}

/**
 * Anthropic key for AllDog's Claude calls (bot + call summaries + AllDog scripts):
 * ALLDOG_ANTHROPIC_API_KEY (a separate key for AllDog), else ANTHROPIC_API_KEY.
 * The rest of Petra (Petra AI etc.) keeps using ANTHROPIC_API_KEY only.
 */
export function allDogAnthropicKey(): string | undefined {
  return readEnv("ALLDOG_ANTHROPIC_API_KEY") || readEnv("ANTHROPIC_API_KEY") || undefined;
}

/** Part A — answered PayCall calls → transcript → Claude summary → lead journal. */
export function isCallSummariesEnabled(): boolean {
  return (
    truthy(readEnv("ALLDOG_CALL_SUMMARIES_ENABLED")) &&
    !!allDogBusinessId() &&
    !!allDogAnthropicKey() &&
    !!readEnv("ELEVENLABS_API_KEY")
  );
}

/** Part B — the AllDog WhatsApp bot (separate Meta app, its own number). */
export function isWaBotEnabled(): boolean {
  return (
    truthy(readEnv("ALLDOG_WA_BOT_ENABLED")) &&
    !!allDogBusinessId() &&
    !!allDogAnthropicKey() &&
    !!readEnv("ALLDOG_WA_TOKEN") &&
    !!readEnv("ALLDOG_WA_PHONE_NUMBER_ID")
  );
}

export function botModel(): string {
  return readEnv("ALLDOG_BOT_MODEL") || "claude-sonnet-5-5";
}

export function summaryModel(): string {
  return readEnv("ALLDOG_SUMMARY_MODEL") || "claude-sonnet-5-5";
}
