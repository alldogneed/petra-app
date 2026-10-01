/**
 * Tests for the customer sales-history journal — merge of call logs, follow-up
 * tasks and lifecycle markers (created / won / lost) + lead status derivation.
 * Pure module, no Prisma mocks needed.
 */

import {
  buildSalesJournal,
  leadStatusOf,
  TASK_STATUS_LABELS,
  type RawCallLog,
  type RawLeadTask,
} from "@/lib/lead-sales-history";

const log = (id: string, createdAt: string | Date | null, type = "call", treatment = "", summary = `s-${id}`): RawCallLog => ({
  id, type, summary, treatment, createdAt,
});

const task = (id: string, createdAt: string | null, status = "OPEN", extra: Partial<RawLeadTask> = {}): RawLeadTask => ({
  id, title: `t-${id}`, status, dueAt: null, dueDate: null, completedAt: null, createdAt, ...extra,
});

describe("buildSalesJournal", () => {
  it("returns only the created marker for a bare lead", () => {
    const j = buildSalesJournal({ leadId: "L", createdAt: "2026-01-01T10:00:00.000Z", callLogs: [], tasks: [] });
    expect(j).toHaveLength(1);
    expect(j[0]).toMatchObject({ id: "L:created", kind: "created", at: "2026-01-01T10:00:00.000Z" });
  });

  it("sorts everything chronologically oldest → newest regardless of input order", () => {
    const j = buildSalesJournal({
      leadId: "L",
      createdAt: "2026-01-01T00:00:00.000Z",
      wonAt: "2026-01-10T00:00:00.000Z",
      callLogs: [log("c3", "2026-01-05T00:00:00.000Z"), log("c1", "2026-01-02T00:00:00.000Z")],
      tasks: [task("t1", "2026-01-03T00:00:00.000Z")],
    });
    expect(j.map((e) => e.id)).toEqual(["L:created", "c1", "t1", "c3", "L:won"]);
  });

  it("orders ties created < call/task < won/lost", () => {
    const at = "2026-02-01T12:00:00.000Z";
    const j = buildSalesJournal({
      leadId: "L",
      createdAt: at,
      wonAt: at,
      lostAt: at,
      callLogs: [log("c1", at)],
      tasks: [task("t1", at)],
    });
    expect(j[0].kind).toBe("created");
    expect(j.slice(1, 3).map((e) => e.kind).sort()).toEqual(["call", "task"]);
    expect(j.slice(3).map((e) => e.kind)).toEqual(["won", "lost"]);
  });

  it("accepts Date objects and normalizes to ISO", () => {
    const j = buildSalesJournal({
      leadId: "L",
      createdAt: new Date("2026-03-01T08:00:00Z"),
      callLogs: [log("c1", new Date("2026-03-02T08:00:00Z"))],
      tasks: [],
    });
    expect(j.map((e) => e.at)).toEqual(["2026-03-01T08:00:00.000Z", "2026-03-02T08:00:00.000Z"]);
  });

  it("maps call log types to kinds; legacy/unknown types → call", () => {
    const j = buildSalesJournal({
      leadId: "L",
      createdAt: null,
      callLogs: [
        log("a", "2026-01-01T00:00:00Z", "call"),
        log("b", "2026-01-02T00:00:00Z", "stage_change"),
        log("c", "2026-01-03T00:00:00Z", "deal_value"),
        log("d", "2026-01-04T00:00:00Z", "whatsapp"),
        log("e", "2026-01-05T00:00:00Z", ""),
      ],
      tasks: [],
    });
    expect(j.map((e) => [e.id, e.kind])).toEqual([
      ["a", "call"], ["b", "stage_change"], ["c", "deal_value"], ["d", "call"], ["e", "call"],
    ]);
  });

  it("trims treatment and maps blank treatment to null", () => {
    const j = buildSalesJournal({
      leadId: "L",
      createdAt: null,
      callLogs: [
        log("a", "2026-01-01T00:00:00Z", "call", "  סוכם על מפגש  "),
        log("b", "2026-01-02T00:00:00Z", "call", "   "),
        { id: "c", type: "call", summary: "x", treatment: null, createdAt: "2026-01-03T00:00:00Z" },
      ],
      tasks: [],
    });
    expect(j.map((e) => e.treatment)).toEqual(["סוכם על מפגש", null, null]);
    expect(j[0].summary).toBe("s-a");
  });

  it("renders tasks with status label, raw status and due (dueAt preferred, dueDate fallback)", () => {
    const j = buildSalesJournal({
      leadId: "L",
      createdAt: null,
      callLogs: [],
      tasks: [
        task("t1", "2026-01-01T00:00:00Z", "OPEN", { dueAt: "2026-01-05T09:00:00Z", dueDate: "2026-01-06T00:00:00Z" }),
        task("t2", "2026-01-02T00:00:00Z", "COMPLETED", { dueDate: "2026-01-07T00:00:00Z" }),
        task("t3", "2026-01-03T00:00:00Z", "CANCELED"),
        task("t4", "2026-01-04T00:00:00Z", "WEIRD"),
      ],
    });
    expect(j.every((e) => e.kind === "task")).toBe(true);
    expect(j[0]).toMatchObject({ summary: "t-t1", taskStatus: "OPEN", treatment: TASK_STATUS_LABELS.OPEN, taskDue: "2026-01-05T09:00:00.000Z" });
    expect(j[1]).toMatchObject({ taskStatus: "COMPLETED", treatment: "הושלמה", taskDue: "2026-01-07T00:00:00.000Z" });
    expect(j[2]).toMatchObject({ taskStatus: "CANCELED", treatment: "בוטלה", taskDue: null });
    expect(j[3]).toMatchObject({ taskStatus: "WEIRD", treatment: "WEIRD" });
  });

  it("skips entries with missing or invalid dates", () => {
    const j = buildSalesJournal({
      leadId: "L",
      createdAt: "not-a-date",
      wonAt: "garbage",
      lostAt: null,
      callLogs: [log("ok", "2026-01-01T00:00:00Z"), log("bad", "nope"), log("none", null)],
      tasks: [task("tbad", "xx"), task("tnull", null)],
    });
    expect(j.map((e) => e.id)).toEqual(["ok"]);
  });

  it("lost marker includes the reason label when given", () => {
    const withReason = buildSalesJournal({
      leadId: "L", createdAt: null, lostAt: "2026-01-01T00:00:00Z", lostReasonLabel: "יקר מדי", callLogs: [], tasks: [],
    });
    expect(withReason[0]).toMatchObject({ id: "L:lost", kind: "lost" });
    expect(withReason[0].summary).toContain("יקר מדי");
    const noReason = buildSalesJournal({ leadId: "L", createdAt: null, lostAt: "2026-01-01T00:00:00Z", callLogs: [], tasks: [] });
    expect(noReason[0].summary).toBe("הליד סומן כאבוד");
  });

  it("does not leak the internal _order field", () => {
    const j = buildSalesJournal({ leadId: "L", createdAt: "2026-01-01T00:00:00Z", callLogs: [log("c", "2026-01-02T00:00:00Z")], tasks: [] });
    for (const e of j) expect(e).not.toHaveProperty("_order");
  });
});

describe("leadStatusOf", () => {
  const won = { isWon: true, isLost: false };
  const lost = { isWon: false, isLost: true };
  const open = { isWon: false, isLost: false };

  it("open when no markers and an open stage / no stage", () => {
    expect(leadStatusOf({ wonAt: null, lostAt: null }, open)).toBe("open");
    expect(leadStatusOf({ wonAt: null, lostAt: null })).toBe("open");
    expect(leadStatusOf({ wonAt: null, lostAt: null }, null)).toBe("open");
  });

  it("won stage wins", () => {
    expect(leadStatusOf({ wonAt: null, lostAt: null }, won)).toBe("won");
    expect(leadStatusOf({ wonAt: null, lostAt: "2026-01-01" }, won)).toBe("won");
  });

  it("lost stage wins", () => {
    expect(leadStatusOf({ wonAt: null, lostAt: null }, lost)).toBe("lost");
    expect(leadStatusOf({ wonAt: "2026-01-01", lostAt: null }, lost)).toBe("lost");
  });

  it("falls back to wonAt / lostAt when the stage is open or unknown", () => {
    expect(leadStatusOf({ wonAt: "2026-01-01", lostAt: null }, open)).toBe("won");
    expect(leadStatusOf({ wonAt: new Date(), lostAt: null })).toBe("won");
    expect(leadStatusOf({ wonAt: null, lostAt: "2026-01-01" }, open)).toBe("lost");
    expect(leadStatusOf({ wonAt: null, lostAt: new Date() }, null)).toBe("lost");
  });
});
