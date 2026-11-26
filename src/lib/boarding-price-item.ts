/**
 * Which price-list item a boarding order starts from (גבעת הכלבים 25/11/2026, item א.44).
 * Businesses price boarding by number of dogs ("פנסיון 1 כלב" 130 · "פנסיון 2 כלבים" 110 per dog)
 * and often save it with unit "per_session" — the old pick took the first per_night / per_day item
 * of the category, which for them was "דיי קר" (day care, 80). Pure, client-safe.
 *
 * Order: 1. a boarding item whose NAME carries the dog count ("2 כלבים", "כלב אחד", "שני כלבים");
 * more dogs than any listed count → the item with the largest count. 2. a per_night item. 3. a per_day
 * item that is not day care. 4. the old rule (any per_night / per_day). The price stays editable.
 */
export interface BoardingPriceCandidate {
  id: string;
  name: string;
  category?: string | null;
  unit: string;
  isActive?: boolean;
}

const HE_COUNTS: Record<string, number> = { "אחד": 1, "אחת": 1, "שני": 2, "שתי": 2, "שניים": 2, "שלושה": 3, "שלוש": 3, "ארבעה": 4, "ארבע": 4 };
const DAY_CARE_RE = /דיי\s*-?\s*קר|דייקר|day\s*care|גן\s*כלבים/i;

/** Dog count written in an item name, or null ("פנסיון 2 כלבים" → 2, "כלב אחד" → 1, "פנסיון 1 כלב" → 1). */
export function dogCountInName(name: string): number | null {
  const n = name.replace(/\s+/g, " ");
  const digit = n.match(/(\d+)\s*כלב/);
  if (digit) return Number(digit[1]);
  for (const [word, count] of Object.entries(HE_COUNTS)) {
    if (new RegExp(`(^|\\s)${word}\\s+כלב|כלב(ים)?\\s+${word}(\\s|$)`).test(n)) return count;
  }
  return null;
}

function isBoardingCategory(c: BoardingPriceCandidate): boolean {
  return (c.category ?? "").includes("פנסיון");
}

export function pickBoardingPriceItem<T extends BoardingPriceCandidate>(items: T[], dogCount: number): T | null {
  const active = items.filter((i) => i.isActive !== false);
  const boarding = active.filter(isBoardingCategory);
  const dogs = Math.max(1, Math.floor(dogCount || 1));

  const counted = boarding
    .filter((i) => !DAY_CARE_RE.test(i.name))
    .map((i) => ({ item: i, count: dogCountInName(i.name) }))
    .filter((x): x is { item: T; count: number } => x.count != null && x.count > 0);
  if (counted.length) {
    const exact = counted.find((x) => x.count === dogs);
    if (exact) return exact.item;
    const below = counted.filter((x) => x.count < dogs).sort((a, b) => b.count - a.count);
    if (below.length) return below[0].item;
    return counted.sort((a, b) => a.count - b.count)[0].item;
  }
  const perNight = boarding.find((i) => i.unit === "per_night");
  if (perNight) return perNight;
  const perDay = boarding.find((i) => i.unit === "per_day" && !DAY_CARE_RE.test(i.name));
  if (perDay) return perDay;
  return active.find((i) => (i.unit === "per_night" || i.unit === "per_day") && (i.category == null || isBoardingCategory(i))) ?? null;
}
