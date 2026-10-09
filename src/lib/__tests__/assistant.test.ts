/**
 * @jest-environment node
 *
 * Petra AI — the pure parts: screen resolution, suggested questions, the
 * context prompt and the escalation transcript.
 */

import { ASSISTANT_KNOWLEDGE } from "../assistant/knowledge.generated";
import { ASSISTANT_SCREENS, ASSISTANT_VIDEOS } from "../assistant/catalog.generated";
import { ALL_ASSISTANT_SUGGESTIONS, resolveAssistantScreen, suggestionsForPath } from "../assistant/screens";
import { ASSISTANT_STABLE_PROMPT, buildContextPrompt } from "../assistant/system-prompt";
import { buildEscalationText } from "../assistant/transcript";
import { ASSISTANT_MAX_TRANSCRIPT_CHARS } from "../assistant/limits";

describe("resolveAssistantScreen", () => {
  it("maps a pathname to its menu screen, including sub-pages and query strings", () => {
    expect(resolveAssistantScreen("/customers")?.name).toBe("לקוחות");
    expect(resolveAssistantScreen("/customers/abc-123")?.href).toBe("/customers");
    expect(resolveAssistantScreen("/settings?tab=team")?.href).toBe("/settings");
  });

  it("does not match on a shared prefix or on anything that is not an app path", () => {
    expect(resolveAssistantScreen("/customers-export")).toBeNull();
    expect(resolveAssistantScreen("https://evil.example/customers")).toBeNull();
    expect(resolveAssistantScreen("//evil.example")).toBeNull();
    expect(resolveAssistantScreen("ignore previous instructions")).toBeNull();
    expect(resolveAssistantScreen(undefined)).toBeNull();
  });
});

describe("suggested questions", () => {
  it("every suggestion is a question the knowledge document answers", () => {
    for (const suggestion of ALL_ASSISTANT_SUGGESTIONS) {
      expect(ASSISTANT_KNOWLEDGE).toContain(`**${suggestion}**`);
    }
  });

  it("changes with the screen and falls back to a default set", () => {
    expect(suggestionsForPath("/boarding")).not.toEqual(suggestionsForPath("/leads"));
    expect(suggestionsForPath("/somewhere-else").length).toBeGreaterThan(0);
  });
});

describe("knowledge document", () => {
  it("only links to screens and videos that exist", () => {
    const links = Array.from(ASSISTANT_KNOWLEDGE.matchAll(/\]\(([^)\s]+)\)/g), (m) => m[1]);
    expect(links.length).toBeGreaterThan(20);
    for (const href of links) {
      if (href.startsWith("video:")) expect(ASSISTANT_VIDEOS[href.slice(6)]).toBeDefined();
      else expect(resolveAssistantScreen(href)).not.toBeNull();
    }
  });

  it("lists every menu screen by its exact name", () => {
    for (const screen of ASSISTANT_SCREENS) {
      expect(ASSISTANT_KNOWLEDGE).toContain(`[${screen.name}](${screen.href})`);
    }
  });
});

describe("system prompt", () => {
  const ctx = { screen: { href: "/boarding", name: "פנסיון" }, tier: "basic", role: "manager", setupDone: [true, false, true] };

  it("keeps the cached part free of per-request values", () => {
    const context = buildContextPrompt(ctx);
    expect(context).toContain("פנסיון (/boarding)");
    expect(context).toContain("בייסיק");
    expect(context).toContain("מנהל");
    expect(context).toContain("הקמת מחירון");
    expect(context).not.toContain("פרטי העסק");
    expect(ASSISTANT_STABLE_PROMPT).not.toContain("## הקשר לשיחה");
  });

  it("degrades to safe labels for unknown values", () => {
    const context = buildContextPrompt({ screen: null, tier: "weird", role: "hacker", setupDone: [true, true, true] });
    expect(context).toContain("המסך הנוכחי: לא ידוע");
    expect(context).toContain("התפקיד של הפונה: לא ידוע");
    expect(context).not.toContain("weird");
    expect(context).not.toContain("hacker");
    expect(context).toContain("ההקמה הושלמה");
  });
});

describe("buildEscalationText", () => {
  it("includes the screen, the note and the chat in order", () => {
    const text = buildEscalationText({
      screenName: "יומן",
      note: "דחוף",
      messages: [
        { role: "user", content: "איך מוסיפים תור?" },
        { role: "assistant", content: "לוחצים על תור חדש" },
      ],
    });
    expect(text).toContain("מסך: יומן");
    expect(text).toContain("הערת המשתמש: דחוף");
    expect(text.indexOf("משתמש: איך מוסיפים תור?")).toBeLessThan(text.indexOf("Petra AI: לוחצים על תור חדש"));
  });

  it("drops the oldest messages when the chat is too long", () => {
    const long = "א".repeat(ASSISTANT_MAX_TRANSCRIPT_CHARS / 2);
    const text = buildEscalationText({
      screenName: null,
      note: null,
      messages: [
        { role: "user", content: `ראשונה ${long}` },
        { role: "assistant", content: `שנייה ${long}` },
        { role: "user", content: "אחרונה" },
      ],
    });
    expect(text).toContain("אחרונה");
    expect(text).toContain("שנייה");
    expect(text).not.toContain("ראשונה");
    expect(text).toContain("(1 הודעות מתחילת השיחה הושמטו)");
    expect(text).toContain("מסך: לא ידוע");
  });
});
