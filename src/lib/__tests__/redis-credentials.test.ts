import { resolveRedisCredentials } from "../rate-limit";

describe("resolveRedisCredentials", () => {
  it("prefers the Marketplace KV pair over a stale UPSTASH pair", () => {
    expect(
      resolveRedisCredentials({
        KV_REST_API_URL: "https://new-db.upstash.io",
        KV_REST_API_TOKEN: "new-token",
        UPSTASH_REDIS_REST_URL: "https://witty-fox-40579.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "old-token",
      })
    ).toEqual({ url: "https://new-db.upstash.io", token: "new-token", source: "KV_REST_API" });
  });

  it("falls back to the UPSTASH pair when KV is absent", () => {
    expect(
      resolveRedisCredentials({ UPSTASH_REDIS_REST_URL: "https://a.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t" })
    ).toEqual({ url: "https://a.upstash.io", token: "t", source: "UPSTASH_REDIS_REST" });
  });

  it("never mixes a URL from one pair with a token from the other", () => {
    expect(
      resolveRedisCredentials({
        KV_REST_API_URL: "https://new-db.upstash.io", // KV token missing → KV pair incomplete
        UPSTASH_REDIS_REST_URL: "https://old.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "old-token",
      })
    ).toEqual({ url: "https://old.upstash.io", token: "old-token", source: "UPSTASH_REDIS_REST" });
  });

  it("strips whitespace pasted into env vars", () => {
    expect(resolveRedisCredentials({ KV_REST_API_URL: " https://x.upstash.io\n", KV_REST_API_TOKEN: "tok \n" }))
      .toEqual({ url: "https://x.upstash.io", token: "tok", source: "KV_REST_API" });
  });

  it("returns null when nothing is configured", () => {
    expect(resolveRedisCredentials({})).toBeNull();
    expect(resolveRedisCredentials({ KV_REST_API_URL: "  ", KV_REST_API_TOKEN: "" })).toBeNull();
  });
});
