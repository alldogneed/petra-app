/**
 * Run an async function over a list with a bounded concurrency limit.
 *
 * Bulk UI actions ("complete all", bulk VIP, bulk delete) used to fire one
 * request per item with `Promise.all(ids.map(fetch))` — all at once. With dozens
 * of selected items this opens dozens of simultaneous DB connections and
 * exhausts the Supabase PgBouncer pool, cascading into app-wide 500s (the
 * dashboard itself fails to load mid-storm). Capping concurrency keeps bulk
 * actions correct without overwhelming the pool.
 *
 * Mirrors `Promise.all` semantics: rejects on the first error (after in-flight
 * tasks settle), and results preserve input order. For "count failures, never
 * throw" callers, have `fn` catch internally and return a status object.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  const workerCount = Math.min(Math.max(1, limit), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
