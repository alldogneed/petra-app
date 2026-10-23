/**
 * Env values saved through the Vercel CLI end in "\n" (production bug, PayCall webhook 401).
 * Every PayCall / AllDog / ElevenLabs read goes through readEnv() and must still authenticate.
 */
jest.mock("@/lib/prisma", () => ({ __esModule: true, default: {}, prisma: {} }));
jest.mock("@/lib/reminder-service", () => ({ scheduleLeadFollowup: jest.fn() }));

import { NextRequest } from "next/server";
import { readEnv } from "@/lib/read-env";

const OLD_ENV = process.env;
beforeEach(() => {
  process.env = { ...OLD_ENV };
});
afterAll(() => {
  process.env = OLD_ENV;
});

describe("readEnv", () => {
  it("trims a trailing newline / spaces", () => {
    process.env.PAYCALL_WEBHOOK_SECRET = "s3cret\n";
    process.env.PAYCALL_PASSWORD = "  pw\r\n";
    expect(readEnv("PAYCALL_WEBHOOK_SECRET")).toBe("s3cret");
    expect(readEnv("PAYCALL_PASSWORD")).toBe("pw");
  });

  it("empty or whitespace-only = undefined", () => {
    process.env.ALLDOG_BUSINESS_ID = "\n";
    delete process.env.ELEVENLABS_API_KEY;
    expect(readEnv("ALLDOG_BUSINESS_ID")).toBeUndefined();
    expect(readEnv("ELEVENLABS_API_KEY")).toBeUndefined();
  });
});

describe("PayCall webhook with a secret stored as 'secret\\n'", () => {
  const url = (secret: string) => new NextRequest(`https://petra-app.com/api/webhooks/paycall?secret=${encodeURIComponent(secret)}&Status=START&Id=1`);

  it("the right secret (without \\n) passes auth", async () => {
    process.env.PAYCALL_WEBHOOK_SECRET = "s3cret\n";
    const { GET } = await import("@/app/api/webhooks/paycall/route");
    const res = await GET(url("s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ignored: "START" });
  });

  it("a wrong secret is still rejected", async () => {
    process.env.PAYCALL_WEBHOOK_SECRET = "s3cret\n";
    const { GET } = await import("@/app/api/webhooks/paycall/route");
    expect((await GET(url("nope"))).status).toBe(401);
    expect((await GET(url("s3cret\n"))).status).toBe(401);
  });
});

describe("PayCall API Basic auth with credentials stored with \\n", () => {
  it("sends the trimmed user:password and uId", async () => {
    process.env.PAYCALL_USERNAME = "user\n";
    process.env.PAYCALL_PASSWORD = "pass\n";
    process.env.PAYCALL_USER_ID = "42\n";
    const fetchMock = jest.fn(async () => new Response("[]", { status: 200 }));
    const realFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      const { getCalls } = await import("@/lib/paycall");
      await getCalls({ fromDate: new Date(), toDate: new Date() });
    } finally {
      global.fetch = realFetch;
    }
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Basic " + Buffer.from("user:pass").toString("base64"));
    expect(String(init.body)).toContain("uId=42&");
  });
});
