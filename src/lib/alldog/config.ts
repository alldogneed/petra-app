/**
 * AllDog-only automations inside Petra (PayCall call summaries + the WhatsApp bot).
 *
 * Nothing here is a product feature: every entry point checks one of the flags
 * below, and the flags only ever act on ALLDOG_BUSINESS_ID. Other businesses are
 * never touched. Read from process.env directly (not env.ts) so pure modules and
 * the local simulation script can import it.
 */

const truthy = (v: string | undefined) => v?.trim().toLowerCase() === "true";

/** The one business these automations run for. Null = not configured → everything is off. */
export function allDogBusinessId(): string | null {
  return process.env.ALLDOG_BUSINESS_ID?.trim() || null;
}

export function isAllDogBusiness(businessId: string | null | undefined): boolean {
  const id = allDogBusinessId();
  return !!id && !!businessId && businessId === id;
}

/** Part A — answered PayCall calls → transcript → Claude summary → lead journal. */
export function isCallSummariesEnabled(): boolean {
  return (
    truthy(process.env.ALLDOG_CALL_SUMMARIES_ENABLED) &&
    !!allDogBusinessId() &&
    !!process.env.ANTHROPIC_API_KEY &&
    !!process.env.ELEVENLABS_API_KEY
  );
}

/** Part B — the AllDog WhatsApp bot (separate Meta app, its own number). */
export function isWaBotEnabled(): boolean {
  return (
    truthy(process.env.ALLDOG_WA_BOT_ENABLED) &&
    !!allDogBusinessId() &&
    !!process.env.ANTHROPIC_API_KEY &&
    !!process.env.ALLDOG_WA_TOKEN?.trim() &&
    !!process.env.ALLDOG_WA_PHONE_NUMBER_ID?.trim()
  );
}

export function botModel(): string {
  return process.env.ALLDOG_BOT_MODEL?.trim() || "claude-opus-5-5";
}

export function summaryModel(): string {
  return process.env.ALLDOG_SUMMARY_MODEL?.trim() || "claude-opus-5-5";
}
