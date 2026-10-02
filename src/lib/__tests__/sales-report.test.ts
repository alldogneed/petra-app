import {
  buildLeadSourceRows,
  buildSalesReport,
  parseStageChangeSummary,
  responseBucketOf,
  agingBucketOf,
  type SalesReportLead,
  type SalesReportStage,
  type SalesReportInput,
} from "@/lib/sales-report";
import { israelDayStart, israelDayEnd } from "@/lib/report-dates";

const STAGES: SalesReportStage[] = [
  { id: "s-new", name: "חדש", color: "#111", sortOrder: 0, isWon: false, isLost: false },
  { id: "s-contact", name: "נוצר קשר", color: "#222", sortOrder: 1, isWon: false, isLost: false },
  { id: "s-offer", name: "הצעת מחיר", color: "#333", sortOrder: 2, isWon: false, isLost: false },
  { id: "s-won", name: "נסגר בהצלחה", color: "#0f0", sortOrder: 3, isWon: true, isLost: false },
  { id: "s-lost", name: "אבוד", color: "#f00", sortOrder: 4, isWon: false, isLost: true },
];

const FROM = israelDayStart("2026-07-01");
const TO = israelDayEnd("2026-09-30");
const NOW = new Date("2026-10-01T09:00:00.000Z");

let seq = 0;
function lead(p: Partial<Omit<SalesReportLead, "createdAt">> & { createdAt: string }): SalesReportLead {
  seq++;
  return {
    id: p.id ?? `l${seq}`,
    name: p.name ?? `ליד ${seq}`,
    source: p.source ?? "manual",
    trafficSource: p.trafficSource ?? "unknown",
    landingPage: p.landingPage ?? null,
    stage: p.stage ?? "s-new",
    createdAt: new Date(p.createdAt),
    wonAt: p.wonAt ?? null,
    lostAt: p.lostAt ?? null,
    wonByUserId: p.wonByUserId ?? null,
    lostByUserId: p.lostByUserId ?? null,
    lostReasonCode: p.lostReasonCode ?? null,
    lostReasonText: p.lostReasonText ?? null,
    dealValue: p.dealValue ?? null,
    previousStageId: p.previousStageId ?? null,
    callLogs: p.callLogs ?? [],
  };
}
const d = (iso: string) => new Date(iso);

function report(leads: SalesReportLead[], over: Partial<SalesReportInput> = {}) {
  return buildSalesReport({
    leads,
    stages: STAGES,
    userNames: {},
    from: FROM,
    to: TO,
    basis: "cohort",
    canSeeMoney: true,
    now: NOW,
    ...over,
  });
}

describe("buildLeadSourceRows", () => {
  it("groups, computes open/conversion/wonValue and sorts by total desc", () => {
    const rows = buildLeadSourceRows(
      [
        { key: "google", isWon: true, isLost: false, dealValue: 1000 },
        { key: "google", isWon: true, isLost: false, dealValue: null },
        { key: "google", isWon: false, isLost: true, dealValue: 500 },
        { key: "google", isWon: false, isLost: false, dealValue: 300 },
        { key: "website", isWon: false, isLost: false, dealValue: null },
      ],
      true
    );
    expect(rows).toEqual([
      { source: "google", total: 4, won: 2, lost: 1, open: 1, conversionRate: 67, wonValue: 1000 },
      { source: "website", total: 1, won: 0, lost: 0, open: 1, conversionRate: null, wonValue: 0 },
    ]);
  });

  it("hides money", () => {
    const rows = buildLeadSourceRows([{ key: "a", isWon: true, isLost: false, dealValue: 10 }], false);
    expect(rows[0].wonValue).toBeNull();
  });

  it("returns [] for no leads", () => {
    expect(buildLeadSourceRows([], true)).toEqual([]);
  });
});

describe("helpers", () => {
  it("parses stage change summaries", () => {
    expect(parseStageChangeSummary('הועבר מ"חדש" ל"נוצר קשר"')).toEqual(["חדש", "נוצר קשר"]);
    expect(parseStageChangeSummary('הועבר מ" חדש " ל"הצעת מחיר "')).toEqual(["חדש", "הצעת מחיר"]);
    expect(parseStageChangeSummary("שיחה רגילה")).toBeNull();
  });

  it("buckets response hours", () => {
    expect(responseBucketOf(null)).toBe("none");
    expect(responseBucketOf(0.5)).toBe("lt1h");
    expect(responseBucketOf(1)).toBe("1to4h");
    expect(responseBucketOf(4)).toBe("4to24h");
    expect(responseBucketOf(24)).toBe("1to3d");
    expect(responseBucketOf(72)).toBe("gt3d");
  });

  it("buckets aging days", () => {
    expect(agingBucketOf(0)).toBe("0-7");
    expect(agingBucketOf(7)).toBe("0-7");
    expect(agingBucketOf(8)).toBe("8-14");
    expect(agingBucketOf(30)).toBe("15-30");
    expect(agingBucketOf(60)).toBe("31-60");
    expect(agingBucketOf(61)).toBe("60+");
  });
});

describe("buildSalesReport — cohort vs activity", () => {
  // created before range, won inside range
  const oldWon = lead({ createdAt: "2026-05-10T10:00:00Z", stage: "s-won", wonAt: d("2026-07-15T10:00:00Z"), dealValue: 2000 });
  // created in range, won in range
  const newWon = lead({ createdAt: "2026-07-05T10:00:00Z", stage: "s-won", wonAt: d("2026-07-20T10:00:00Z"), dealValue: 1000 });
  // created in range, lost in range
  const newLost = lead({ createdAt: "2026-08-01T10:00:00Z", stage: "s-lost", lostAt: d("2026-08-10T10:00:00Z"), lostReasonCode: "PRICE" });
  // created in range, still open
  const newOpen = lead({ createdAt: "2026-09-01T10:00:00Z", stage: "s-contact", dealValue: 700 });
  // created in range, wonAt set but stage reopened → not won, open
  const reopened = lead({ createdAt: "2026-07-10T10:00:00Z", stage: "s-offer", wonAt: d("2026-07-12T10:00:00Z") });
  const all = [oldWon, newWon, newLost, newOpen, reopened];

  it("cohort counts leads created in range by current outcome", () => {
    const r = report(all);
    expect(r.basis).toBe("cohort");
    expect(r.kpis.total).toBe(4);
    expect(r.kpis.won).toBe(1);
    expect(r.kpis.lost).toBe(1);
    expect(r.kpis.open).toBe(2);
    expect(r.kpis.conversionRate).toBe(50);
    expect(r.kpis.lostRate).toBe(50);
    expect(r.kpis.wonValue).toBe(1000);
    expect(r.kpis.wonWithValueCount).toBe(1);
    expect(r.kpis.avgDealValue).toBe(1000);
    expect(r.kpis.avgDaysToClose).toBe(15);
  });

  it("activity counts events in range (won by wonAt even if created earlier)", () => {
    const r = report(all, { basis: "activity" });
    expect(r.kpis.total).toBe(4);
    expect(r.kpis.won).toBe(2);
    expect(r.kpis.lost).toBe(1);
    expect(r.kpis.open).toBe(2);
    expect(r.kpis.conversionRate).toBe(67);
    expect(r.kpis.wonValue).toBe(3000);
    // the reopened lead's stale wonAt is ignored
    expect(r.monthly.find((m) => m.month === "2026-07")!.won).toBe(2);
  });

  it("cohort counts a lead created in range but won after it", () => {
    const late = lead({ createdAt: "2026-09-20T10:00:00Z", stage: "s-won", wonAt: d("2026-09-30T23:00:00Z") });
    const r = report([late], { to: israelDayEnd("2026-09-25") });
    expect(r.kpis.won).toBe(1);
    const a = report([late], { to: israelDayEnd("2026-09-25"), basis: "activity" });
    expect(a.kpis.won).toBe(0);
    expect(a.kpis.total).toBe(1);
  });

  it("conversion excludes open leads and is null when nothing closed", () => {
    const r = report([newOpen, reopened]);
    expect(r.kpis.conversionRate).toBeNull();
    expect(r.kpis.lostRate).toBeNull();
    expect(r.kpis.avgDaysToClose).toBeNull();
  });

  it("bySource in activity mode keeps total = created and open = created & open", () => {
    const r = report(all, { basis: "activity" });
    const manual = r.bySource.find((s) => s.source === "manual")!;
    expect(manual).toMatchObject({ total: 4, won: 2, lost: 1, open: 2 });
    expect(r.bySource.reduce((s, x) => s + x.total, 0)).toBe(r.kpis.total);
  });

  it("lost reasons map codes to Hebrew labels; no code → NONE / ללא סיבה", () => {
    const noCode = lead({ createdAt: "2026-08-02T10:00:00Z", stage: "s-lost", lostAt: d("2026-08-03T10:00:00Z") });
    const r = report([newLost, noCode]);
    expect(r.lostReasons).toEqual(
      expect.arrayContaining([
        { code: "PRICE", label: "יקר מדי", count: 1 },
        { code: "NONE", label: "ללא סיבה", count: 1 },
      ])
    );
  });
});

describe("buildSalesReport — previous range", () => {
  it("uses the equal-length range right before `from` with the same basis", () => {
    const from = israelDayStart("2026-09-01");
    const to = israelDayEnd("2026-09-30"); // 30 days → previous = Aug 2 .. Aug 31
    const leads = [
      lead({ createdAt: "2026-08-15T10:00:00Z", stage: "s-won", wonAt: d("2026-09-05T10:00:00Z"), dealValue: 100 }),
      lead({ createdAt: "2026-08-20T10:00:00Z", stage: "s-lost", lostAt: d("2026-08-25T10:00:00Z") }),
      lead({ createdAt: "2026-08-01T10:00:00Z" }), // before previous range (Aug 1 Israel < Aug 2)
      lead({ createdAt: "2026-09-10T10:00:00Z" }),
    ];
    const cohort = report(leads, { from, to });
    expect(cohort.previous).toEqual({ total: 2, won: 1, lost: 1, conversionRate: 50, wonValue: 100 });
    expect(cohort.kpis.total).toBe(1);

    const activity = report(leads, { from, to, basis: "activity" });
    expect(activity.previous).toEqual({ total: 2, won: 0, lost: 1, conversionRate: 0, wonValue: 0 });
    expect(activity.kpis.won).toBe(1);
  });
});

describe("buildSalesReport — monthly", () => {
  it("includes every month even when empty, each event by its own date", () => {
    const leads = [
      lead({ createdAt: "2026-07-03T10:00:00Z", stage: "s-won", wonAt: d("2026-09-02T10:00:00Z"), dealValue: 50 }),
      lead({ createdAt: "2026-07-04T10:00:00Z", stage: "s-lost", lostAt: d("2026-09-03T10:00:00Z") }),
    ];
    const r = report(leads);
    expect(r.monthly).toEqual([
      { month: "2026-07", created: 2, won: 0, lost: 0, wonValue: 0 },
      { month: "2026-08", created: 0, won: 0, lost: 0, wonValue: 0 },
      { month: "2026-09", created: 0, won: 1, lost: 1, wonValue: 50 },
    ]);
  });

  it("buckets by Israel month (UTC 22:30 on Jul 31 = Aug 1 in Israel)", () => {
    const r = report([lead({ createdAt: "2026-07-31T22:30:00Z" })]);
    expect(r.monthly.find((m) => m.month === "2026-08")!.created).toBe(1);
  });
});

describe("buildSalesReport — first response", () => {
  it("buckets every lead created in range, always returns all 6 buckets in order", () => {
    const c = "2026-08-01T10:00:00Z";
    const at = (h: number) => new Date(new Date(c).getTime() + h * 3_600_000);
    const leads = [
      lead({ createdAt: c, callLogs: [{ type: "call", summary: "x", createdAt: at(0.5) }] }),
      lead({ createdAt: c, callLogs: [{ type: "call", summary: "x", createdAt: at(2) }] }),
      // stage_change / deal_value are not contact → this one is "none"
      lead({
        createdAt: c,
        callLogs: [
          { type: "stage_change", summary: 'הועבר מ"חדש" ל"נוצר קשר"', createdAt: at(0.1) },
          { type: "deal_value", summary: "ערך", createdAt: at(0.2) },
        ],
      }),
      // first contact is the earliest (logs not sorted)
      lead({
        createdAt: c,
        stage: "s-lost",
        lostAt: at(100),
        callLogs: [
          { type: "call", summary: "x", createdAt: at(90) },
          { type: "whatsapp", summary: "x", createdAt: at(30) },
        ],
      }),
    ];
    const r = report(leads);
    expect(r.responseTime.map((b) => b.bucket)).toEqual(["lt1h", "1to4h", "4to24h", "1to3d", "gt3d", "none"]);
    expect(r.responseTime.map((b) => b.count)).toEqual([1, 1, 0, 1, 0, 1]);
    expect(r.kpis.respondedCount).toBe(3);
    expect(r.kpis.avgFirstResponseHours).toBe(10.8); // (0.5+2+30)/3
    expect(r.kpis.medianFirstResponseHours).toBe(2);
    expect(r.kpis.unrespondedOpenCount).toBe(1);
  });

  it("returns all zero buckets and nulls when there are no leads", () => {
    const r = report([]);
    expect(r.responseTime).toHaveLength(6);
    expect(r.responseTime.every((b) => b.count === 0)).toBe(true);
    expect(r.kpis.avgFirstResponseHours).toBeNull();
    expect(r.kpis.medianFirstResponseHours).toBeNull();
    expect(r.aging).toHaveLength(5);
    expect(r.funnel).toHaveLength(4);
    expect(r.funnel.every((f) => f.reached === 0)).toBe(true);
  });
});

describe("buildSalesReport — funnel", () => {
  it("orders active stages by sortOrder then the won stage; applies the reached rule", () => {
    const stages: SalesReportStage[] = [STAGES[2], STAGES[4], STAGES[0], STAGES[3], STAGES[1]]; // shuffled
    const leads = [
      // open at first stage
      lead({ createdAt: "2026-08-01T10:00:00Z", stage: "s-new" }),
      // open at "הצעת מחיר" → reached new, contact, offer
      lead({ createdAt: "2026-08-01T10:00:00Z", stage: "s-offer" }),
      // lost, logs show it was at "נוצר קשר" (name match after trim) → reached new, contact
      lead({
        createdAt: "2026-08-01T10:00:00Z",
        stage: "s-lost",
        lostAt: d("2026-08-05T10:00:00Z"),
        callLogs: [
          { type: "stage_change", summary: 'הועבר מ"חדש" ל" נוצר קשר "', createdAt: d("2026-08-02T10:00:00Z") },
          { type: "stage_change", summary: 'הועבר מ"נוצר קשר" ל"אבוד"', createdAt: d("2026-08-05T10:00:00Z") },
        ],
      }),
      // lost with no evidence → only the first stage
      lead({ createdAt: "2026-08-01T10:00:00Z", stage: "s-lost", lostAt: d("2026-08-05T10:00:00Z") }),
      // won with no logs → reached everything
      lead({ createdAt: "2026-08-01T10:00:00Z", stage: "s-won", wonAt: d("2026-08-05T10:00:00Z") }),
    ];
    const r = report(leads, { stages });
    expect(r.funnel.map((f) => f.stageId)).toEqual(["s-new", "s-contact", "s-offer", "s-won"]);
    expect(r.funnel.map((f) => f.reached)).toEqual([5, 3, 2, 1]);
    expect(r.funnel.map((f) => f.current)).toEqual([1, 0, 1, 1]);
    expect(r.funnel.map((f) => f.stepConversion)).toEqual([null, 60, 67, 50]);
  });

  it("uses previousStageId as evidence for archived leads", () => {
    const r = report([
      lead({ createdAt: "2026-08-01T10:00:00Z", stage: "s-lost", lostAt: d("2026-08-02T10:00:00Z"), previousStageId: "s-offer" }),
    ]);
    expect(r.funnel.map((f) => f.reached)).toEqual([1, 1, 1, 0]);
  });
});

describe("buildSalesReport — pipeline, aging, stale, forecast", () => {
  const leads = [
    lead({ createdAt: "2026-09-28T10:00:00Z", stage: "s-new", dealValue: 100 }), // 2 days
    lead({ createdAt: "2026-09-20T10:00:00Z", stage: "s-new" }), // 10 days
    lead({ createdAt: "2026-09-05T10:00:00Z", stage: "s-offer", dealValue: 300 }), // 25 days
    lead({ createdAt: "2026-08-10T10:00:00Z", stage: "s-offer" }), // 51 days
    lead({ createdAt: "2025-01-01T10:00:00Z", stage: "s-offer", dealValue: 600 }), // very old, outside range
    // closed in the last 365 days: 3 won, 1 lost → 75%
    lead({ createdAt: "2025-12-01T10:00:00Z", stage: "s-won", wonAt: d("2026-01-01T10:00:00Z") }),
    lead({ createdAt: "2025-12-01T10:00:00Z", stage: "s-won", wonAt: d("2026-02-01T10:00:00Z") }),
    lead({ createdAt: "2025-12-01T10:00:00Z", stage: "s-won", wonAt: d("2026-03-01T10:00:00Z") }),
    lead({ createdAt: "2025-12-01T10:00:00Z", stage: "s-lost", lostAt: d("2026-03-01T10:00:00Z") }),
    // closed more than 365 days ago → ignored
    lead({ createdAt: "2024-12-01T10:00:00Z", stage: "s-lost", lostAt: d("2025-01-01T10:00:00Z") }),
  ];

  it("pipeline is a snapshot of all open leads; forecast = pipeline × historical rate", () => {
    const r = report(leads);
    expect(r.kpis.pipelineValue).toBe(1000);
    expect(r.kpis.pipelineWithValueCount).toBe(3);
    expect(r.kpis.historicalConversionRate).toBe(75);
    expect(r.kpis.forecastValue).toBe(750);
  });

  it("aging always has 5 buckets", () => {
    const r = report(leads);
    expect(r.aging).toEqual([
      { bucket: "0-7", count: 1, value: 100 },
      { bucket: "8-14", count: 1, value: 0 },
      { bucket: "15-30", count: 1, value: 300 },
      { bucket: "31-60", count: 1, value: 0 },
      { bucket: "60+", count: 1, value: 600 },
    ]);
  });

  it("stale lists only active stages with leads, by sortOrder, with oldest age", () => {
    const r = report(leads);
    expect(r.stale.map((s) => [s.stageId, s.count])).toEqual([
      ["s-new", 2],
      ["s-offer", 3],
    ]);
    expect(r.stale[0].oldestDays).toBe(10);
    expect(r.stale[1].oldestDays).toBeGreaterThan(600);
  });

  it("hides every money field when canSeeMoney is false", () => {
    const r = report(
      [...leads, lead({ createdAt: "2026-08-01T10:00:00Z", stage: "s-won", wonAt: d("2026-08-02T10:00:00Z"), dealValue: 50, wonByUserId: "u1" })],
      { canSeeMoney: false }
    );
    expect(r.canSeeMoney).toBe(false);
    expect(r.kpis.wonValue).toBeNull();
    expect(r.kpis.avgDealValue).toBeNull();
    expect(r.kpis.pipelineValue).toBeNull();
    expect(r.kpis.forecastValue).toBeNull();
    expect(r.previous.wonValue).toBeNull();
    expect(r.monthly.every((m) => m.wonValue === null)).toBe(true);
    expect(r.bySource.every((s) => s.wonValue === null)).toBe(true);
    expect(r.byTrafficSource.every((s) => s.wonValue === null)).toBe(true);
    expect(r.byUser.every((u) => u.wonValue === null)).toBe(true);
    expect(r.aging.every((a) => a.value === null)).toBe(true);
    // non-money counts still present
    expect(r.kpis.wonWithValueCount).toBe(1);
    expect(r.kpis.historicalConversionRate).not.toBeNull();
  });
});

describe("buildSalesReport — breakdowns", () => {
  it("byTrafficSource, byLandingPage (top 15, skip null) and byUser", () => {
    const leads: SalesReportLead[] = [
      lead({ createdAt: "2026-08-01T10:00:00Z", trafficSource: "paid", landingPage: "/a", stage: "s-won", wonAt: d("2026-08-02T10:00:00Z"), wonByUserId: "u1", dealValue: 10 }),
      lead({ createdAt: "2026-08-01T10:00:00Z", trafficSource: "paid", landingPage: "/a", stage: "s-lost", lostAt: d("2026-08-02T10:00:00Z"), lostByUserId: "u1" }),
      lead({ createdAt: "2026-08-01T10:00:00Z", trafficSource: "organic", landingPage: null, stage: "s-won", wonAt: d("2026-08-02T10:00:00Z") }),
      lead({ createdAt: "2026-08-01T10:00:00Z", trafficSource: null, stage: "s-lost", lostAt: d("2026-08-02T10:00:00Z"), lostByUserId: "ghost" }),
    ];
    for (let i = 0; i < 20; i++) leads.push(lead({ createdAt: "2026-08-01T10:00:00Z", landingPage: `/p${i}` }));
    const r = report(leads, { userNames: { u1: "דנה" } });

    expect(r.byTrafficSource[0]).toMatchObject({ source: "unknown", total: 21 });
    expect(r.byTrafficSource.find((s) => s.source === "paid")).toMatchObject({ total: 2, won: 1, lost: 1, conversionRate: 50, wonValue: 10 });

    expect(r.byLandingPage).toHaveLength(15);
    expect(r.byLandingPage[0]).toEqual({ page: "/a", total: 2, won: 1, conversionRate: 50 });

    expect(r.byUser).toEqual([
      { userId: "u1", name: "דנה", won: 1, lost: 1, conversionRate: 50, wonValue: 10 },
      { userId: "unknown", name: "לא תועד", won: 1, lost: 0, conversionRate: 100, wonValue: 0 },
      { userId: "ghost", name: "משתמש שהוסר", won: 0, lost: 1, conversionRate: 0, wonValue: 0 },
    ]);
  });

  it("echoes range / basis / timestamps as ISO", () => {
    const r = report([], { basis: "activity" });
    expect(r.from).toBe(FROM.toISOString());
    expect(r.to).toBe(TO.toISOString());
    expect(r.generatedAt).toBe(NOW.toISOString());
    expect(r.basis).toBe("activity");
  });
});
