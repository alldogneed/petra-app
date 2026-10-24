/**
 * Item 30 (Or's real run from the site, 24/10 16:48 — "גורו").
 */
const updateLead = jest.fn();
const createLead = jest.fn();
const leadFindMany = jest.fn();
const leadUpdateMany = jest.fn();
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    lead: { findMany: (...a: unknown[]) => leadFindMany(...a), updateMany: (...a: unknown[]) => leadUpdateMany(...a) },
    leadStage: { findMany: async () => [] },
  },
}));
jest.mock("@/services/clients", () => ({
  updateLead: (...a: unknown[]) => updateLead(...a),
  createLead: (...a: unknown[]) => createLead(...a),
  createTask: jest.fn(),
  findCustomersByPhone: async () => [],
}));

import { botLeadAttribution, pageFromLabel, trafficSourceFromLabel } from "@/lib/alldog-bot/attribution";
import {
  areaFact,
  callbackFact,
  composeBotLog,
  otherIssueFact,
  splitBotLog,
  urgentFact,
  urgentFactOf,
  withBody,
  withFact,
} from "@/lib/alldog-bot/journal";
import { formatPetNotesBlock, mergePetDetails, parsePetNotesBlock, replacePetNotesBlock } from "@/lib/lead-pet-notes";
import { currentSession, parseAttributionLine, startsNewSession, SESSION_GAP_MS } from "@/lib/alldog-bot/logic";
import { nameWasTyped } from "@/lib/alldog-bot/actions";
import { upsertLeadFromContact } from "@/lib/alldog/leads";

describe("30a — the site's source label → traffic source", () => {
  it.each([
    ["כניסה ישירה", "direct"],
    ["חיפוש אורגני", "organic"],
    ["פרסום ממומן", "paid"],
    ["רשתות חברתיות", "social"],
    ["רשת חברתית", "social"],
    ["הפניה מאתר אחר", "referral"],
    ["הפניה", "referral"],
  ])("%s → %s", (label, expected) => {
    expect(trafficSourceFromLabel(label)).toBe(expected);
    expect(botLeadAttribution(label, "דף הבית")?.trafficSource).toBe(expected);
  });
  it("Or's line from the site: direct, home page", () => {
    const parsed = parseAttributionLine("היי AllDog, אשמח לעזרה עם הכלב שלי 🐶\n(הגעתי דרך: כניסה ישירה · דף הבית)");
    const a = botLeadAttribution(parsed.source, parsed.page);
    expect(a).toMatchObject({ trafficSource: "direct", landingPage: "/", pageType: "home" });
  });
  it("page labels", () => {
    expect(pageFromLabel("מדריך ׳נביחות׳")).toEqual({ landingPage: null, pageType: "guide" });
    expect(pageFromLabel("אזור רעננה")).toEqual({ landingPage: null, pageType: "area" });
    expect(pageFromLabel("עמוד פנסיון")).toEqual({ landingPage: "/rehabilitation", pageType: "service" });
    expect(pageFromLabel("כלי במרכז הידע")).toEqual({ landingPage: null, pageType: "tool" });
    expect(botLeadAttribution(null, null)).toBeNull();
    expect(trafficSourceFromLabel("משהו אחר")).toBe("unknown");
  });
});

describe("30b — one journal line per conversation", () => {
  it("facts go under the summary, single-kind facts replace, the body can change", () => {
    let log = withFact(null, callbackFact("מחפש אילוף בבית"));
    log = withFact(log, otherIssueFact("נובח על כלבים"));
    log = withFact(log, areaFact("קרני שומרון"));
    log = withFact(log, otherIssueFact("נובח על כלבים")); // once
    log = withBody(log, "[וואטסאפ · בוט] סיכום שיחה (24/10 16:48)\nכלב: גורו");
    log = withFact(log, callbackFact()); // replaces the older callback fact
    expect(log).toBe(
      [
        "[וואטסאפ · בוט] סיכום שיחה (24/10 16:48)",
        "כלב: גורו",
        "• בעיה נוספת: נובח על כלבים",
        "• אזור לבדיקה: קרני שומרון",
        "• לחזור טלפונית",
      ].join("\n")
    );
    expect(splitBotLog(log).facts).toHaveLength(3);
    expect(composeBotLog("", [])).toBe("[וואטסאפ · בוט] שיחה בוואטסאפ");
  });
  it("the urgent fact is found again (task priority)", () => {
    const log = withFact(withBody(null, "x"), urgentFact("השכנים מתלוננים", "השכנים כבר התלוננו"));
    expect(urgentFactOf(log)).toBe('⚠ דחוף: השכנים מתלוננים · "השכנים כבר התלוננו"');
    expect(urgentFactOf("x")).toBeNull();
  });
});

describe("30c — the latest conversation wins", () => {
  it("dog details: same dog → merged, another dog → a fresh block", () => {
    const notes = `שורה\n\n${formatPetNotesBlock({ name: "גורו", breed: "לברדור", age: "שנה" })}\n\nעוד הערה`;
    expect(parsePetNotesBlock(notes)).toEqual({ name: "גורו", breed: "לברדור", age: "שנה" });
    expect(mergePetDetails(parsePetNotesBlock(notes), { age: "שנתיים" })).toEqual({ name: "גורו", breed: "לברדור", age: "שנתיים" });
    expect(mergePetDetails(parsePetNotesBlock(notes), { name: "באלו", breed: "רועה גרמני" })).toEqual({ name: "באלו", breed: "רועה גרמני" });
    const replaced = replacePetNotesBlock(notes, formatPetNotesBlock({ name: "באלו" }));
    expect(replaced).toBe(`שורה\n\n🐾 פרטי הכלב:\nשם: באלו\n\nעוד הערה`);
  });
  it("a customer back after a long silence = a new conversation", () => {
    const t = (h: number) => new Date(Date.UTC(2026, 9, 24, h));
    const rows = [{ createdAt: t(1) }, { createdAt: t(2) }, { createdAt: t(20) }, { createdAt: t(21) }];
    expect(currentSession(rows)).toEqual([{ createdAt: t(20) }, { createdAt: t(21) }]);
    expect(currentSession(rows.slice(0, 2))).toHaveLength(2);
    expect(startsNewSession(t(1), new Date(t(1).getTime() + SESSION_GAP_MS))).toBe(true);
    expect(startsNewSession(t(1), t(2))).toBe(false);
    expect(startsNewSession(null, t(2))).toBe(false);
  });
  it("an existing lead gets the name typed now, the new city and the new dog", async () => {
    leadFindMany.mockResolvedValue([
      {
        id: "L1", name: "Or Rabinovich", phone: "0542560964", stage: "s1", city: "תל אביב", requestedService: null,
        notes: formatPetNotesBlock({ name: "גורו", breed: "לברדור" }), createdAt: new Date(), lastContactedAt: new Date(),
        nextFollowUpAt: null, gclid: null, campaign: null, landingPage: null, trafficSource: "unknown", customerId: null,
      },
    ]);
    await upsertLeadFromContact({
      businessId: "b", phone: "972542560964", name: "אור", placeholderName: "Or Rabinovich", source: "וואטסאפ · בוט",
      city: "קרני שומרון", pet: { name: "באלו", breed: "רועה גרמני" }, refresh: true,
      attribution: botLeadAttribution("כניסה ישירה", "דף הבית"),
    });
    expect(updateLead).toHaveBeenCalledWith("b", expect.anything(), "L1", expect.objectContaining({
      name: "אור",
      city: "קרני שומרון",
      notes: "🐾 פרטי הכלב:\nשם: באלו\nגזע: רועה גרמני",
    }));
    expect(leadUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ trafficSource: "direct", landingPage: "/" }) }));
  });
  it("without refresh (PayCall) only empty fields are filled", async () => {
    updateLead.mockClear();
    leadFindMany.mockResolvedValue([
      { id: "L1", name: "דנה", phone: "0501234567", stage: "s1", city: "רעננה", requestedService: null, notes: null,
        createdAt: new Date(), lastContactedAt: new Date(), nextFollowUpAt: null, gclid: null, campaign: null, landingPage: null, trafficSource: "unknown" },
    ]);
    await upsertLeadFromContact({ businessId: "b", phone: "0501234567", name: "יוסי", placeholderName: "x", source: "s", city: "חיפה" });
    expect(updateLead).not.toHaveBeenCalled();
  });
});

describe("30d — a name from a voice note is not the lead's name", () => {
  it("only a typed name counts", () => {
    expect(nameWasTyped("יור", ["היי AllDog, אשמח לעזרה עם הכלב שלי 🐶", "גורו מתל אביב"])).toBe(false);
    expect(nameWasTyped("אור רבינוביץ", ["אני אור , הכלב גורו"])).toBe(true);
    expect(nameWasTyped("אור", ["אורית"])).toBe(false);
  });
});
