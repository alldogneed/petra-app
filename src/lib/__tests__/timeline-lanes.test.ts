import { packLanes } from "../timeline-lanes";

describe("packLanes", () => {
  it("puts consecutive stays on one lane", () => {
    const r = packLanes([
      { id: "a", start: 0, end: 3.5 },
      { id: "b", start: 5, end: 8.5 },
      { id: "c", start: 10, end: 12.5 },
    ]);
    expect(r.lanes).toBe(1);
    expect([...r.laneOf.values()]).toEqual([0, 0, 0]);
  });

  it("stacks overlapping stays (check-out day = next check-in day overlaps visually)", () => {
    const r = packLanes([
      { id: "a", start: 0, end: 3.5 },
      { id: "b", start: 3, end: 6.5 },
      { id: "c", start: 4, end: 5.5 },
    ]);
    expect(r.lanes).toBe(2);
    expect(r.laneOf.get("a")).toBe(0);
    expect(r.laneOf.get("b")).toBe(1);
    expect(r.laneOf.get("c")).toBe(0);
  });

  it("reuses a freed lane", () => {
    const r = packLanes([
      { id: "a", start: 0, end: 2.5 },
      { id: "b", start: 1, end: 9.5 },
      { id: "c", start: 4, end: 6.5 },
    ]);
    expect(r.lanes).toBe(2);
    expect(r.laneOf.get("c")).toBe(0);
  });

  it("many historical stays in one room stay one lane", () => {
    const spans = Array.from({ length: 40 }, (_, i) => ({ id: `s${i}`, start: i * 5, end: i * 5 + 3.5 }));
    expect(packLanes(spans).lanes).toBe(1);
  });

  it("empty row", () => {
    expect(packLanes([]).lanes).toBe(0);
  });
});
