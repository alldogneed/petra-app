import { parseLeadCallDraft, hasDraftContent, LEAD_DRAFT_TTL_MS } from "@/lib/lead-call-draft";

const now = 1_800_000_000_000;
const raw = (o: Record<string, unknown>) => JSON.stringify(o);

describe("lead call draft", () => {
  it("restores typed notes", () => {
    const d = parseLeadCallDraft(raw({ summary: "דיברנו", treatment: "", nextFollowUpAt: "2026-10-21T10:00", followUpStatus: "pending", savedAt: now - 1000 }), now);
    expect(d?.summary).toBe("דיברנו");
    expect(d?.nextFollowUpAt).toBe("2026-10-21T10:00");
  });
  it("ignores empty, broken and expired drafts", () => {
    expect(parseLeadCallDraft(null, now)).toBeNull();
    expect(parseLeadCallDraft("{not json", now)).toBeNull();
    expect(parseLeadCallDraft(raw({ summary: "  ", treatment: "", savedAt: now }), now)).toBeNull();
    expect(parseLeadCallDraft(raw({ summary: "x", savedAt: now - LEAD_DRAFT_TTL_MS - 1 }), now)).toBeNull();
    expect(parseLeadCallDraft(raw({ summary: "x" }), now)).toBeNull();
  });
  it("fills defaults for missing fields", () => {
    const d = parseLeadCallDraft(raw({ treatment: "להתקשר", savedAt: now }), now);
    expect(d).toEqual({ summary: "", treatment: "להתקשר", nextFollowUpAt: "", followUpStatus: "pending", savedAt: now });
  });
  it("content = summary or treatment", () => {
    expect(hasDraftContent({ summary: "", treatment: "" })).toBe(false);
    expect(hasDraftContent({ summary: "", treatment: "a" })).toBe(true);
  });
});
