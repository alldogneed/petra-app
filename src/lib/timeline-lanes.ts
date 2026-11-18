/**
 * Stack the bars of one timeline row into as few lanes as possible: a bar goes to the
 * first lane whose last bar ended at or before its start. Spans are in day units of the
 * timeline (end exclusive). Pure — shared by the boarding timeline and its tests.
 * Support ticket גבעת הכלבים 18/11/2026: with the scrolling window every stay of a room
 * got its own line, so rooms with history became very tall.
 */
export interface LaneSpan {
  id: string;
  start: number;
  end: number;
}

export interface LaneLayout {
  /** id → lane index (0 = top). */
  laneOf: Map<string, number>;
  /** Number of lanes used (0 for an empty row). */
  lanes: number;
}

export function packLanes(spans: LaneSpan[]): LaneLayout {
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id));
  const laneEnds: number[] = [];
  const laneOf = new Map<string, number>();
  for (const s of sorted) {
    const end = Math.max(s.end, s.start + 0.5);
    let lane = laneEnds.findIndex((e) => e <= s.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    laneOf.set(s.id, lane);
  }
  return { laneOf, lanes: laneEnds.length };
}
